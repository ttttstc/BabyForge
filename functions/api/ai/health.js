import { json } from '../../_shared/auth.js'
import { describeNaibaAgentFailure, runNaibaAgent } from '../../_shared/naibaAgent.js'
import { resolvedLlmConfig } from '../../_shared/llmConfig.js'

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || ''))))
}

export async function validHealthToken(authorization, expected) {
  if (!expected || !String(authorization || '').startsWith('Bearer ')) return false
  const [providedDigest, expectedDigest] = await Promise.all([digest(String(authorization).slice(7)), digest(expected)])
  let mismatch = 0
  for (let index = 0; index < expectedDigest.length; index += 1) mismatch |= providedDigest[index] ^ expectedDigest[index]
  return mismatch === 0
}

export async function onRequestPost({ request, env }) {
  if (!(await validHealthToken(request.headers.get('authorization'), env.AI_HEALTH_TOKEN))) return json({ error: 'Not found' }, 404)
  const config = resolvedLlmConfig(env)
  if (!config.apiKey) return json({ ok: false, reason: 'model_not_configured' }, 503)
  try {
    const answer = await runNaibaAgent({
      message: '只用一句中文回答：新生儿精神状态不错时，今天还应继续观察什么？',
      skillId: 'stage_parenting_qa',
      baby: { id: 'production-health-check', name: '宝宝', birthDate: new Date().toISOString().slice(0, 10), sex: 'male' },
      careEvents: [],
      locale: 'zh-CN',
      model: config.model,
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      useResponses: config.useResponses,
    })
    return json({ ok: true, answerLength: answer.length })
  } catch (error) {
    return json({ ok: false, reason: describeNaibaAgentFailure(error).reason }, 503)
  }
}
