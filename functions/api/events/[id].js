import { json, requireSession } from '../../_shared/auth.js'
import { accessibleEvent, eventFromRow, safeEventInput } from '../../_shared/care.js'

async function saveRevision(env, row, accountId, changedAt) {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO care_event_revisions (id, event_id, version, snapshot_json, changed_at, changed_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(`${row.id}:v${row.version}`, row.id, Number(row.version) || 1, JSON.stringify(eventFromRow(row)), changedAt, accountId).run()
}

export async function onRequestPatch({ request, env, params }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  if (auth.session.role === 'guest') return json({ error: '游客账号只读，不能写入' }, 403)
  const current = await accessibleEvent(env, auth.session.accountId, params.id)
  if (!current) return json({ error: '事件不存在或无权访问' }, 404)
  let body
  try { body = await request.json() } catch { return json({ error: '请求格式不正确' }, 400) }
  const now = new Date().toISOString()
  const currentEvent = eventFromRow(current)
  const input = safeEventInput({ ...currentEvent, ...(body?.event || body), id: current.id, babyId: current.baby_id }, {
    now,
    recordedById: current.recorded_by_id,
    recordedByName: current.recorded_by_name,
  })
  await saveRevision(env, current, auth.session.accountId, now)
  const nextStatus = input.status === 'voided' ? 'voided' : (input.status === 'active' ? 'corrected' : input.status)
  await env.DB.prepare(`
    UPDATE care_events SET type = ?, occurred_at = ?, recorded_at = ?, recorded_by_id = ?, recorded_by_name = ?, source = ?, payload_json = ?, related_concern_id = ?, updated_at = ?, version = version + 1, status = ?, updated_by = ?
    WHERE id = ?
  `).bind(input.type, input.occurredAt, input.recordedAt, input.recordedBy.id, input.recordedBy.displayName, input.source, JSON.stringify(input.payload), input.relatedConcernId, now, nextStatus, auth.session.accountId, current.id).run()
  const row = await env.DB.prepare('SELECT * FROM care_events WHERE id = ?').bind(current.id).first()
  return json({ event: eventFromRow(row) })
}

export async function onRequestDelete({ request, env, params }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  if (auth.session.role === 'guest') return json({ error: '游客账号只读，不能写入' }, 403)
  const current = await accessibleEvent(env, auth.session.accountId, params.id)
  if (!current) return json({ error: '事件不存在或无权访问' }, 404)
  const now = new Date().toISOString()
  await saveRevision(env, current, auth.session.accountId, now)
  await env.DB.prepare('UPDATE care_events SET status = ?, updated_at = ?, version = version + 1, updated_by = ? WHERE id = ?').bind('voided', now, auth.session.accountId, current.id).run()
  const row = await env.DB.prepare('SELECT * FROM care_events WHERE id = ?').bind(current.id).first()
  return json({ event: eventFromRow(row) })
}
