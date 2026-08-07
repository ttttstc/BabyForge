import { json, requireSession } from '../../_shared/auth.js'
import { accessibleBaby, safeEventInput } from '../../_shared/care.js'

function id() {
  return globalThis.crypto?.randomUUID?.() || `draft-${Date.now()}`
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  if (auth.session.role === 'guest') return json({ error: '游客账号只读，不能创建记录草稿' }, 403)
  let body
  try { body = await request.json() } catch { return json({ error: '请求格式不正确' }, 400) }
  const rawEvent = body?.draft?.event || body?.event
  let event
  try { event = safeEventInput(rawEvent, {}, { requireId: true, requireActor: true, requireTimestamps: true }) } catch (error) { return json({ error: error.message || '草稿事件不正确', field: error.field || null }, 422) }
  const baby = await accessibleBaby(env, auth.session.accountId, event.babyId)
  if (!baby || baby.status === 'detached') return json({ error: '无权访问该宝宝档案' }, 403)
  const draftId = id()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 3_600_000).toISOString()
  await env.DB.prepare('INSERT INTO ai_drafts (id, baby_id, account_id, draft_type, payload_json, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, \'pending\', ?, ?)')
    .bind(draftId, baby.id, auth.session.accountId, body?.draftType || event.category || 'care_event', JSON.stringify({ event }), now.toISOString(), expiresAt).run()
  return json({ draftId, expiresAt }, 201)
}

export async function onRequestPatch({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  let body
  try { body = await request.json() } catch { return json({ error: '请求格式不正确' }, 400) }
  const draftId = String(body?.draftId || '').trim()
  if (!draftId || body?.status !== 'discarded') return json({ error: '只能丢弃明确指定的草稿' }, 422)
  const result = await env.DB.prepare('UPDATE ai_drafts SET status = \'discarded\' WHERE id = ? AND account_id = ? AND status = \'pending\'').bind(draftId, auth.session.accountId).run()
  if (!result.meta?.changes) return json({ error: '草稿不存在或已处理' }, 404)
  return json({ draftId, status: 'discarded' })
}
