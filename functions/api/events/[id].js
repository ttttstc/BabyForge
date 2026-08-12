import { json, requireSession } from '../../_shared/auth.js'
import { accessibleEvent, eventFromRow, legacySourceForEvent, legacyTypeForEvent, safeEventInput } from '../../_shared/care.js'
import { conflict } from '../events.js'
import { appAssetUrl, appUpdateUrl, EMAIL_UPDATE_CATEGORIES, scheduleUpdateNotifications } from '../../_shared/updateNotifications.js'

function readExpectedVersion(body, request) {
  const header = request.headers.get('if-match')
  let value = body?.event?.version ?? body?.version
  if (value === undefined || value === null) value = new URL(request.url).searchParams.get('version') || header
  const version = Number(String(value || '').replaceAll('"', ''))
  return Number.isInteger(version) && version > 0 ? version : null
}

function correctionPayload(currentEvent, patch, now) {
  // The replacement is a new recorded fact: occurredAt may be preserved,
  // while recordedAt/createdAt mark when this correction was entered.
  const merged = {
    ...currentEvent,
    ...patch,
    id: patch.id && patch.id !== currentEvent.id ? patch.id : undefined,
    babyId: currentEvent.babyId,
    recordedAt: patch.recordedAt || now,
    createdAt: now,
    updatedAt: now,
    status: 'active',
    version: 1,
    correctedFromId: currentEvent.id,
  }
  delete merged.type
  delete merged.recordedBy
  return merged
}

async function runAtomic(env, statements) {
  if (typeof env.DB.batch !== 'function') throw new Error('D1 batch 不可用')
  return env.DB.batch(statements)
}

async function correctEvent({ request, env, params, waitUntil }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  if (auth.session.role === 'guest') return json({ error: '游客账号只读，不能写入' }, 403)
  const current = await accessibleEvent(env, auth.session, params.id)
  if (!current) return json({ error: '事件不存在或无权访问' }, 404)
  if (current.status && current.status !== 'active') return conflict(current, '只有 active 事件可以纠正')
  let body
  try { body = await request.json() } catch { return json({ error: '请求格式不正确' }, 400) }
  const expectedVersion = readExpectedVersion(body, request)
  if (!expectedVersion) return json({ error: '修改必须携带 version', field: 'version' }, 422)
  if (expectedVersion !== Number(current.version)) return conflict(current)
  const now = new Date().toISOString()
  const currentEvent = eventFromRow(current)
  const raw = body?.event || body
  let next
  try {
    next = safeEventInput(correctionPayload(currentEvent, raw, now), {}, { allowCorrectedFromId: true, requireId: false, requireActor: true, requireTimestamps: true })
  } catch (error) {
    return json({ error: error.message || '事件数据不正确', field: error.field || null }, 422)
  }
  const id = raw?.id && raw.id !== current.id ? String(raw.id) : `event-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
  next.id = id
  next.babyId = current.baby_id
  const revisionSnapshot = JSON.stringify(eventFromRow(current))
  let results
  try {
    results = await runAtomic(env, [
      env.DB.prepare(`
        UPDATE care_events SET status = 'corrected', updated_at = ?, version = version + 1, updated_by = ?
        WHERE id = ? AND version = ? AND status = 'active'
      `).bind(now, auth.session.accountId, current.id, expectedVersion),
      env.DB.prepare(`
        INSERT OR IGNORE INTO care_event_revisions (id, event_id, version, snapshot_json, changed_at, changed_by)
        SELECT ?, id, version, ?, ?, ? FROM care_events
        WHERE id = ? AND status = 'corrected' AND version = ? AND updated_at = ? AND updated_by = ?
      `).bind(`${current.id}:v${current.version}`, revisionSnapshot, now, auth.session.accountId, current.id, expectedVersion + 1, now, auth.session.accountId),
      env.DB.prepare(`
        INSERT INTO care_events (
          id, baby_id, kind, category, type, occurred_at, recorded_at,
          actor_id, actor_display_name, recorded_by_id, recorded_by_name,
          source, event_source, payload_json, status, corrected_from_id,
          related_concern_id, version, created_at, updated_at, updated_by
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 1, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM care_events
          WHERE id = ? AND status = 'corrected' AND version = ? AND updated_at = ? AND updated_by = ?
        )
      `).bind(
        next.id, current.baby_id, next.kind, next.category, legacyTypeForEvent(next), next.occurredAt, next.recordedAt,
        next.actor.id, next.actor.displayName, next.actor.id, next.actor.displayName,
        legacySourceForEvent(next.source), next.source, JSON.stringify(next.payload), current.id,
        null, now, now, auth.session.accountId, current.id, expectedVersion + 1, now, auth.session.accountId,
      ),
    ])
  } catch (error) {
    return json({ error: error.message || '事件纠正未完成' }, 409)
  }
  const update = results?.[0] || {}
  if (typeof update.meta?.changes === 'number' && update.meta.changes === 0) {
    const latest = await accessibleEvent(env, auth.session, current.id)
    return conflict(latest || current)
  }
  const row = await env.DB.prepare('SELECT * FROM care_events WHERE id = ?').bind(next.id).first()
  const savedEvent = eventFromRow(row)
  if (EMAIL_UPDATE_CATEGORIES.has(currentEvent.category) || EMAIL_UPDATE_CATEGORIES.has(savedEvent.category)) {
    const baby = await env.DB.prepare('SELECT household_id AS householdId, nickname FROM baby_profiles WHERE id = ?').bind(current.baby_id).first()
    scheduleUpdateNotifications({
      env,
      householdId: baby?.householdId,
      actorUserId: auth.session.userId,
      actorName: auth.session.displayName || '家庭成员',
      babyName: baby?.nickname || '宝宝',
      action: '修改',
      previous: currentEvent,
      next: savedEvent,
      url: appUpdateUrl(request, env, `#/records?event=${encodeURIComponent(savedEvent.id)}`),
      heroUrl: appAssetUrl(request, env),
    }, waitUntil)
  }
  return json({ event: savedEvent, correctedFromId: current.id }, 201)
}

export async function onRequestPost(context) {
  return correctEvent(context)
}

export async function onRequestPatch(context) {
  return correctEvent(context)
}

export async function onRequestDelete({ request, env, params, waitUntil }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  if (auth.session.role === 'guest') return json({ error: '游客账号只读，不能写入' }, 403)
  const current = await accessibleEvent(env, auth.session, params.id)
  if (!current) return json({ error: '事件不存在或无权访问' }, 404)
  if (current.status && current.status !== 'active') return conflict(current, '只有 active 事件可以作废')
  let body = {}
  try { body = await request.json() } catch { /* DELETE may omit a body; query/header still work. */ }
  const expectedVersion = readExpectedVersion(body, request)
  if (!expectedVersion) return json({ error: '作废必须携带 version', field: 'version' }, 422)
  if (expectedVersion !== Number(current.version)) return conflict(current)
  const now = new Date().toISOString()
  let results
  try {
    results = await runAtomic(env, [
      env.DB.prepare(`
        UPDATE care_events SET status = 'voided', updated_at = ?, version = version + 1, updated_by = ?
        WHERE id = ? AND version = ? AND status = 'active'
      `).bind(now, auth.session.accountId, current.id, expectedVersion),
      env.DB.prepare(`
        INSERT OR IGNORE INTO care_event_revisions (id, event_id, version, snapshot_json, changed_at, changed_by)
        SELECT ?, id, version, ?, ?, ? FROM care_events
        WHERE id = ? AND status = 'voided' AND version = ? AND updated_at = ? AND updated_by = ?
      `).bind(`${current.id}:v${current.version}`, JSON.stringify(eventFromRow(current)), now, auth.session.accountId, current.id, expectedVersion + 1, now, auth.session.accountId),
    ])
  } catch (error) {
    return json({ error: error.message || '事件作废未完成' }, 409)
  }
  const update = results?.[0] || {}
  if (typeof update.meta?.changes === 'number' && update.meta.changes === 0) {
    const latest = await accessibleEvent(env, auth.session, current.id)
    return conflict(latest || current)
  }
  const row = await env.DB.prepare('SELECT * FROM care_events WHERE id = ?').bind(current.id).first()
  const voidedEvent = eventFromRow(row)
  const previousEvent = eventFromRow(current)
  if (EMAIL_UPDATE_CATEGORIES.has(previousEvent.category)) {
    const baby = await env.DB.prepare('SELECT household_id AS householdId, nickname FROM baby_profiles WHERE id = ?').bind(current.baby_id).first()
    scheduleUpdateNotifications({
      env,
      householdId: baby?.householdId,
      actorUserId: auth.session.userId,
      actorName: auth.session.displayName || '家庭成员',
      babyName: baby?.nickname || '宝宝',
      action: '删除',
      previous: previousEvent,
      url: appUpdateUrl(request, env, '#/records'),
      heroUrl: appAssetUrl(request, env),
    }, waitUntil)
  }
  return json({ event: voidedEvent })
}
