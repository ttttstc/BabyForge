import { json, requireSession } from '../_shared/auth.js'
import { accessibleBaby, eventFromRow, legacySourceForEvent, legacyTypeForEvent, planFromRow, safeEventInput } from '../_shared/care.js'

function conflict(current, message = '事件版本冲突，请刷新后重新修改') {
  return json({ error: message, code: 'EVENT_CONFLICT', current: eventFromRow(current) }, 409)
}

function sameEvent(current, next) {
  const existing = eventFromRow(current)
  return existing.kind === next.kind
    && existing.category === next.category
    && existing.occurredAt === next.occurredAt
    && existing.recordedAt === next.recordedAt
    && existing.actor?.id === next.actor?.id
    && existing.actor?.displayName === next.actor?.displayName
    && existing.source === next.source
    && existing.status === next.status
    && (existing.correctedFromId || null) === (next.correctedFromId || null)
    && JSON.stringify(existing.payload) === JSON.stringify(next.payload)
}

async function loadEvents(env, babyId, filters) {
  const clauses = ['baby_id = ?']
  const binds = [babyId]
  if (filters.category) { clauses.push('category = ?'); binds.push(filters.category) }
  if (filters.kind) { clauses.push('kind = ?'); binds.push(filters.kind) }
  if (filters.from) { clauses.push('occurred_at >= ?'); binds.push(filters.from) }
  if (filters.to) { clauses.push('occurred_at <= ?'); binds.push(filters.to) }
  if (!filters.includeVoided) clauses.push("status != 'voided'")
  const rows = await env.DB.prepare(`SELECT * FROM care_events WHERE ${clauses.join(' AND ')} ORDER BY occurred_at, created_at`).bind(...binds).all()
  return (rows.results || []).map(eventFromRow)
}

function dateBoundary(value, end = false) {
  if (!value) return ''
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T${end ? '23:59:59.999' : '00:00:00.000'}Z` : value
}

async function loadPlans(env, babyId) {
  const rows = await env.DB.prepare('SELECT * FROM care_plan_items WHERE baby_id = ? ORDER BY due_at, created_at').bind(babyId).all()
  return (rows.results || []).map(planFromRow)
}

async function loadConcerns(env, babyId) {
  const rows = await env.DB.prepare('SELECT * FROM concerns WHERE baby_id = ? ORDER BY updated_at').bind(babyId).all()
  return (rows.results || []).map((row) => ({ id: row.id, babyId: row.baby_id, topicId: row.topic_id, title: row.title, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at }))
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  const url = new URL(request.url)
  const babyId = url.searchParams.get('babyId')
  if (!babyId) return json({ events: [], carePlanItems: [], concerns: [] })
  const baby = await accessibleBaby(env, auth.session.accountId, babyId)
  if (!baby || baby.status === 'detached') return json({ error: '无权访问该宝宝档案' }, 403)
  const filters = {
    category: url.searchParams.get('category') || '',
    kind: url.searchParams.get('kind') || '',
    from: dateBoundary(url.searchParams.get('from') || ''),
    to: dateBoundary(url.searchParams.get('to') || '', true),
    includeVoided: url.searchParams.get('includeVoided') === 'true',
  }
  const events = await loadEvents(env, baby.id, filters)
  const [carePlanItems, concerns] = filters.category || filters.kind || filters.from || filters.to
    ? [[], []]
    : await Promise.all([loadPlans(env, baby.id), loadConcerns(env, baby.id)])
  return json({ events, carePlanItems, concerns })
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  if (auth.session.role === 'guest') return json({ error: '游客账号只读，不能写入' }, 403)
  let body
  try { body = await request.json() } catch { return json({ error: '请求格式不正确' }, 400) }
  const raw = body?.event || body
  const babyId = raw?.babyId || body?.babyId
  if (!babyId) return json({ error: '缺少 babyId' }, 422)
  const baby = await accessibleBaby(env, auth.session.accountId, babyId)
  if (!baby || baby.status === 'detached') return json({ error: '无权访问该宝宝档案' }, 403)
  let event
  try {
    event = safeEventInput(raw, {}, { requireId: true, requireActor: true, requireTimestamps: true })
  } catch (error) {
    return json({ error: error.message || '事件数据不正确', field: error.field || null }, 422)
  }
  if (event.status !== 'active') return json({ error: '新建事件必须使用 active 状态', field: 'status' }, 422)
  if (event.correctedFromId) return json({ error: '纠正事件必须通过版本化修改接口提交', field: 'correctedFromId' }, 422)
  if (event.babyId && event.babyId !== baby.id) return json({ error: '事件 babyId 与请求不一致' }, 422)
  const existing = await env.DB.prepare('SELECT * FROM care_events WHERE id = ?').bind(event.id).first()
  if (existing) {
    if (existing.baby_id !== baby.id) return json({ error: '事件编号已被其他档案使用' }, 422)
    return sameEvent(existing, event)
      ? new Response(null, { status: 204 })
      : conflict(existing, '事件编号已存在，请刷新后重新创建')
  }
  const now = new Date().toISOString()
  try {
    await env.DB.prepare(`
      INSERT INTO care_events (
        id, baby_id, kind, category, type, occurred_at, recorded_at,
        actor_id, actor_display_name, recorded_by_id, recorded_by_name,
        source, event_source, payload_json, status, corrected_from_id,
        related_concern_id, version, created_at, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).bind(
      event.id, baby.id, event.kind, event.category, legacyTypeForEvent(event), event.occurredAt, event.recordedAt,
      event.actor.id, event.actor.displayName, event.actor.id, event.actor.displayName,
      legacySourceForEvent(event.source), event.source, JSON.stringify(event.payload), event.status, event.correctedFromId || null,
      null, now, now, auth.session.accountId,
    ).run()
  } catch (error) {
    // A concurrent retry can race the initial id lookup. The primary key is
    // authoritative; resolve that race as the same idempotency decision.
    const raced = await env.DB.prepare('SELECT * FROM care_events WHERE id = ?').bind(event.id).first()
    if (raced) {
      if (raced.baby_id !== baby.id) return json({ error: '事件编号已被其他档案使用' }, 422)
      return sameEvent(raced, event)
        ? new Response(null, { status: 204 })
        : conflict(raced, '事件编号已存在，请刷新后重新创建')
    }
    throw error
  }
  const row = await env.DB.prepare('SELECT * FROM care_events WHERE id = ?').bind(event.id).first()
  return json({ event: eventFromRow(row) }, 201)
}

export { conflict }
