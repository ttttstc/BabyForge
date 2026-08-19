import { json, requireSession } from '../../_shared/auth.js'
import { safeEventInput, writableBaby } from '../../_shared/care.js'
import { onRequestPost as createCareEvent } from '../events.js'
import { validateCareEventDraft } from '../../../src/domain/careEventDraft.js'

function parsePayload(value) {
  try { return JSON.parse(value) } catch { return null }
}

const EDITABLE_PAYLOAD_KEYS = Object.freeze({
  bottle_feeding: new Set(['amountMl', 'note']),
  breastfeeding: new Set(['note']),
  temperature: new Set(['value', 'unit', 'note']),
  growth_measurement: new Set(['value', 'unit', 'note']),
  diaper: new Set(['kind', 'note']),
  symptom_observation: new Set(['symptomNotes', 'note']),
  medical_report_observation: new Set(['fields', 'note']),
})

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function validateEditedEvent(storedEvent, candidate, baby) {
  const immutableKeys = ['id', 'babyId', 'kind', 'category', 'recordedAt', 'actor', 'source', 'status', 'correctedFromId', 'version']
  for (const key of immutableKeys) {
    if (!sameValue(candidate?.[key] ?? null, storedEvent?.[key] ?? null)) return `不可修改草稿的 ${key}`
  }
  const storedPayload = storedEvent?.payload && typeof storedEvent.payload === 'object' ? storedEvent.payload : {}
  const candidatePayload = candidate?.payload && typeof candidate.payload === 'object' ? candidate.payload : null
  if (!candidatePayload) return '草稿 payload 不正确'
  const editable = EDITABLE_PAYLOAD_KEYS[candidate.category] || new Set(['note'])
  const keys = new Set([...Object.keys(storedPayload), ...Object.keys(candidatePayload)])
  for (const key of keys) {
    if (!editable.has(key) && !sameValue(candidatePayload[key] ?? null, storedPayload[key] ?? null)) return `不可修改草稿字段 ${key}`
  }
  const validation = validateCareEventDraft(candidate, { baby, now: new Date() })
  if (!validation.valid) return '编辑后的记录不符合事实、数值或时间校验'
  try { safeEventInput(candidate, {}, { requireId: true, requireActor: true, requireTimestamps: true }) } catch (error) { return error.message || '编辑后的记录格式不正确' }
  return null
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
  if (!draftId) return json({ error: '必须提供服务端记录草稿编号' }, 422)
  const row = await env.DB.prepare(`
    SELECT id, baby_id, payload_json, status, expires_at
    FROM ai_drafts
    WHERE id = ? AND account_id = ?
  `).bind(draftId, auth.session.accountId).first()
  if (!row) return json({ error: '记录草稿不存在或不属于当前账号' }, 404)
  if (row.status !== 'pending' || row.expires_at <= new Date().toISOString()) return json({ error: '记录草稿已过期或已处理' }, 409)
  const payload = parsePayload(row.payload_json)
  const storedEvent = payload?.event || payload
  if (!storedEvent || storedEvent.babyId !== row.baby_id) return json({ error: '记录草稿与宝宝档案不一致' }, 409)
  const baby = await writableBaby(env, auth.session, row.baby_id)
  if (!baby || baby.status === 'detached') return json({ error: '无权访问该宝宝档案' }, 403)
  const editedEvent = body?.event && typeof body.event === 'object' ? body.event : null
  const event = editedEvent || storedEvent
  const editError = validateEditedEvent(storedEvent, event, baby)
  if (editError) return json({ error: editError }, 409)

  const proxyHeaders = new Headers(request.headers)
  proxyHeaders.set('content-type', 'application/json')
  proxyHeaders.delete('content-length')
  const proxyRequest = new Request(request.url, {
    method: 'POST',
    headers: proxyHeaders,
    body: JSON.stringify(event),
  })
  const response = await createCareEvent({ request: proxyRequest, env })
  if (response.status !== 201 && response.status !== 204) return response
  await env.DB.prepare(`
    UPDATE ai_drafts
    SET status = 'confirmed', confirmed_at = ?
    WHERE id = ? AND account_id = ? AND status = 'pending'
  `).bind(new Date().toISOString(), draftId, auth.session.accountId).run()
  let savedEvent = event
  if (response.status === 201) {
    try { savedEvent = (await response.json())?.event || event } catch { /* idempotent response */ }
  }
  return json({ event: savedEvent, draftStatus: 'confirmed', draftId })
}
