import { json, requireSession } from '../_shared/auth.js'
import { accessibleBaby, eventFromRow, planFromRow, concernFromRow, safeEventInput } from '../_shared/care.js'

async function loadEvents(env, babyId, since) {
  const condition = since ? ' AND updated_at > ?' : ''
  const statement = since
    ? env.DB.prepare(`SELECT * FROM care_events WHERE baby_id = ?${condition} ORDER BY occurred_at, created_at`).bind(babyId, since)
    : env.DB.prepare('SELECT * FROM care_events WHERE baby_id = ? ORDER BY occurred_at, created_at').bind(babyId)
  const rows = await statement.all()
  return (rows.results || []).map(eventFromRow)
}

async function loadPlans(env, babyId, since) {
  const condition = since ? ' AND updated_at > ?' : ''
  const statement = since
    ? env.DB.prepare(`SELECT * FROM care_plan_items WHERE baby_id = ?${condition} ORDER BY due_at, created_at`).bind(babyId, since)
    : env.DB.prepare('SELECT * FROM care_plan_items WHERE baby_id = ? ORDER BY due_at, created_at').bind(babyId)
  const rows = await statement.all()
  return (rows.results || []).map(planFromRow)
}

async function loadConcerns(env, babyId, since) {
  const condition = since ? ' AND updated_at > ?' : ''
  const statement = since
    ? env.DB.prepare(`SELECT * FROM concerns WHERE baby_id = ?${condition} ORDER BY updated_at`).bind(babyId, since)
    : env.DB.prepare('SELECT * FROM concerns WHERE baby_id = ? ORDER BY updated_at').bind(babyId)
  const rows = await statement.all()
  return (rows.results || []).map(concernFromRow)
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  const url = new URL(request.url)
  const babyId = url.searchParams.get('babyId')
  if (!babyId) return json({ events: [], carePlanItems: [], concerns: [], pulledAt: new Date().toISOString() })
  const baby = await accessibleBaby(env, auth.session.accountId, babyId)
  if (!baby || baby.status === 'detached') return json({ error: '无权访问该宝宝档案' }, 403)
  const since = url.searchParams.get('since') || null
  // Capture the watermark before querying. Writes that happen while the three
  // reads are in flight must be returned by the next incremental pull.
  const pulledAt = new Date().toISOString()
  const [events, carePlanItems, concerns] = await Promise.all([
    loadEvents(env, baby.id, since),
    loadPlans(env, baby.id, since),
    loadConcerns(env, baby.id, since),
  ])
  return json({ events, carePlanItems, concerns, pulledAt })
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  if (auth.session.role === 'guest') return json({ error: '游客账号只读，不能写入' }, 403)
  let body
  try { body = await request.json() } catch { return json({ error: '请求格式不正确' }, 400) }
  const eventInput = body?.event || body
  const babyId = eventInput?.babyId || body?.babyId
  if (!babyId) return json({ error: '缺少 babyId' }, 422)
  const baby = await accessibleBaby(env, auth.session.accountId, babyId)
  if (!baby || baby.status === 'detached') return json({ error: '无权访问该宝宝档案' }, 403)
  const now = new Date().toISOString()
  let event
  try {
    event = safeEventInput(eventInput, { now }, { requireId: true, requireRecordedBy: true, requireTimestamps: true })
  } catch (error) {
    return json({ error: error.message || '事件数据不正确', field: error.field || null }, 422)
  }
  const existing = await env.DB.prepare('SELECT * FROM care_events WHERE id = ?').bind(event.id).first()
  if (existing && existing.baby_id !== baby.id) return json({ error: '事件编号已被其他档案使用' }, 422)
  if (!existing) {
    await env.DB.prepare(`
      INSERT INTO care_events (id, baby_id, type, occurred_at, recorded_at, recorded_by_id, recorded_by_name, source, payload_json, related_concern_id, created_at, updated_at, version, status, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).bind(event.id, baby.id, event.type, event.occurredAt, event.recordedAt, event.recordedBy.id, event.recordedBy.displayName, event.source, JSON.stringify(event.payload), event.relatedConcernId, now, now, event.status, auth.session.accountId).run()
  } else {
    // Event IDs are idempotent within a baby. A differing same-baby payload is
    // the latest submission under the product's last-write-wins rule.
    const currentEvent = eventFromRow(existing)
    const changed = currentEvent.type !== event.type
      || currentEvent.occurredAt !== event.occurredAt
      || currentEvent.recordedAt !== event.recordedAt
      || currentEvent.recordedBy?.id !== event.recordedBy?.id
      || currentEvent.recordedBy?.displayName !== event.recordedBy?.displayName
      || currentEvent.source !== event.source
      || currentEvent.status !== event.status
      || currentEvent.relatedConcernId !== event.relatedConcernId
      || JSON.stringify(currentEvent.payload) !== JSON.stringify(event.payload)
    if (changed) {
      await env.DB.prepare(`
        INSERT OR IGNORE INTO care_event_revisions (id, event_id, version, snapshot_json, changed_at, changed_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(`${existing.id}:v${existing.version}`, existing.id, Number(existing.version) || 1, JSON.stringify(currentEvent), now, auth.session.accountId).run()
      await env.DB.prepare(`
        UPDATE care_events SET type = ?, occurred_at = ?, recorded_at = ?, recorded_by_id = ?, recorded_by_name = ?, source = ?, payload_json = ?, related_concern_id = ?, updated_at = ?, version = version + 1, status = ?, updated_by = ?
        WHERE id = ?
      `).bind(event.type, event.occurredAt, event.recordedAt, event.recordedBy.id, event.recordedBy.displayName, event.source, JSON.stringify(event.payload), event.relatedConcernId, now, event.status, auth.session.accountId, existing.id).run()
    } else {
      // Idempotent replays are acknowledged without pretending that a new
      // version was written. The client treats 204 as a successful no-op.
      return new Response(null, { status: 204 })
    }
  }
  const row = await env.DB.prepare('SELECT * FROM care_events WHERE id = ?').bind(event.id).first()
  return json({ event: eventFromRow(row) }, existing ? 200 : 201)
}
