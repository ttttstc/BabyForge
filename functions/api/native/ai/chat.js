import { json } from '../../../_shared/auth.js'
import { onRequestPost as runWebChat } from '../../ai/chat.js'
import { NATIVE_AI_CONTRACT, NATIVE_AI_CONTRACT_VERSION } from '../../../../src/domain/nativeAiContract.js'
import { isApprovedAuthorityUrl } from '../../../../src/domain/naibaGuardrails.js'

function parseSse(raw) {
  let meta = {}
  let decision = null
  let text = ''
  for (const block of String(raw || '').split(/\r?\n\r?\n+/)) {
    const data = block.split(/\r?\n/)
      .filter((line) => /^data:\s*/.test(line))
      .map((line) => line.replace(/^data:\s*/, ''))
      .join('\n')
    if (!data) continue
    let item
    try { item = JSON.parse(data) } catch { continue }
    if (item.type === 'meta' || item.meta) meta = { ...meta, ...(item.meta || item) }
    if (item.type === 'message') text += String(item.delta || item.text || '')
    if (item.type === 'decision') decision = item.result || null
  }
  const sources = [...new Set(text.match(/https?:\/\/[^\s)\]]+/g) || [])]
    .filter(isApprovedAuthorityUrl)
    .map((url) => ({ url, kind: 'authority' }))
  const status = meta.fallback
    ? meta.reason === 'provider_timeout' || meta.reason === 'model_response_invalid' ? 'tool_failed' : 'fallback'
    : 'success'
  return { status, conversationId: meta.conversationId || null, text, reason: meta.reason || null, decision, artifact: null, sources }
}

export async function onRequestPost({ request, env }) {
  const response = await runWebChat({ request, env })
  const raw = await response.text()
  if (!response.ok) {
    let payload = null
    try { payload = JSON.parse(raw) } catch { /* preserve a compact native error */ }
    return json({ error: payload?.error || '奶爸 AI 请求未完成。' }, response.status)
  }
  const parsed = parseSse(raw)
  return json({
    contract: NATIVE_AI_CONTRACT,
    contractVersion: NATIVE_AI_CONTRACT_VERSION,
    ...parsed,
  })
}
