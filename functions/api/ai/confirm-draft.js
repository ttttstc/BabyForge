import { json, requireSession } from '../../_shared/auth.js'
import { onRequestPost as createCareEvent } from '../events.js'

function parsePayload(value) {
  try { return JSON.parse(value) } catch { return null }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  if (auth.session.role === 'guest') return json({ error: '游客账号只读，不能确认记录' }, 403)

  let body
  try { body = await request.json() } catch { return json({ error: '请求格式不正确' }, 400) }
  if (body?.confirmed !== true) return json({ error: '必须在确认卡上明确确认后才能写入' }, 409)

  const draftId = String(body?.draftId || '').trim()
  let event = body?.draft?.event || body?.event || null
  if (draftId) {
    const row = await env.DB.prepare(`
      SELECT id, payload_json, status, expires_at
      FROM ai_drafts
      WHERE id = ? AND account_id = ?
    `).bind(draftId, auth.session.accountId).first()
    if (!row) return json({ error: '记录草稿不存在或不属于当前账号' }, 404)
    if (row.status !== 'pending' || row.expires_at <= new Date().toISOString()) return json({ error: '记录草稿已过期或已处理' }, 409)
    const payload = parsePayload(row.payload_json)
    const storedEvent = payload?.event || payload
    const editedEvent = body?.event && typeof body.event === 'object' ? body.event : null
    if (editedEvent && editedEvent.id !== storedEvent?.id) return json({ error: '编辑后的事件与原草稿不一致' }, 409)
    event = editedEvent || storedEvent
  }
  if (!event || typeof event !== 'object') return json({ error: '缺少待确认的记录草稿' }, 422)

  const proxyHeaders = new Headers(request.headers)
  proxyHeaders.set('content-type', 'application/json')
  proxyHeaders.delete('content-length')
  const proxyRequest = new Request(request.url, {
    method: 'POST',
    headers: proxyHeaders,
    body: JSON.stringify(event),
  })
  const response = await createCareEvent({ request: proxyRequest, env })
  if (draftId && (response.status === 201 || response.status === 204)) {
    await env.DB.prepare(`
      UPDATE ai_drafts
      SET status = 'confirmed', confirmed_at = ?
      WHERE id = ? AND account_id = ? AND status = 'pending'
    `).bind(new Date().toISOString(), draftId, auth.session.accountId).run()
  }
  return response
}
