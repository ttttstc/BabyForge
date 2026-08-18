import { getSession, json } from '../../_shared/auth.js'
import { accessibleBaby, eventFromRow } from '../../_shared/care.js'
import { runNaibaReportAgent } from '../../_shared/naibaAgent.js'
import { loadAccountLlmConfig, resolvedLlmConfig } from '../../_shared/llmConfig.js'
import { createReportFactDraft, parseMedicalReportText } from '../../../src/domain/naibaCapabilities.js'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'])

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const session = await getSession(request, env)
  if (!session) return json({ error: '未登录或登录已过期' }, 401)
  let body
  try { body = await request.json() } catch { return json({ error: '请求格式无效' }, 400) }
  const babyId = String(body?.babyId || '').trim()
  const name = String(body?.name || 'report').slice(0, 200)
  const mimeType = String(body?.mimeType || '').toLowerCase()
  const text = String(body?.text || '').slice(0, 20_000)
  const dataUrl = String(body?.dataUrl || '')
  if (!babyId) return json({ error: '缺少宝宝档案编号' }, 422)
  if (!ALLOWED_TYPES.has(mimeType)) return json({ error: '仅支持 JPG、PNG、WebP、PDF 或纯文本报告' }, 415)
  if (dataUrl.length > 8_000_000) return json({ error: '报告文件过大，请压缩到约 6 MB 以内' }, 413)
  if (!text && !dataUrl) return json({ error: '报告内容为空' }, 422)
  if (mimeType !== 'text/plain' && body?.thirdPartyProcessingConsent !== true) return json({ error: '上传图片或 PDF 前必须同意发送给已配置的 AI 服务商进行临时识别' }, 409)
  const baby = await accessibleBaby(env, session, babyId)
  if (!baby || baby.status === 'detached') return json({ error: '无权访问该宝宝档案' }, 403)
  const rows = await env.DB.prepare('SELECT * FROM care_events WHERE baby_id = ? AND status != \'voided\' ORDER BY occurred_at DESC LIMIT 30').bind(baby.id).all()
  const careEvents = (rows.results || []).map(eventFromRow).filter(Boolean).reverse()
  const actor = { id: session.accountId, displayName: session.displayName || '家庭成员' }
  if (mimeType === 'text/plain') {
    const report = parseMedicalReportText(text, { name })
    return json({ report, draft: createReportFactDraft({ report, baby, actor }) })
  }
  let llmConfig
  try {
    llmConfig = resolvedLlmConfig(env, await loadAccountLlmConfig(env, session.accountId))
  } catch (error) {
    console.error('Account LLM configuration failed closed', error)
    return json({ error: '自定义模型配置暂不可用，请检查加密密钥配置。' }, 503)
  }
  if (!llmConfig.apiKey) return json({ error: '当前账号未配置报告识别模型；可改用纯文本粘贴或在设置中配置自定义模型。' }, 503)
  try {
    const report = await runNaibaReportAgent({ name, mimeType, dataUrl, text, baby, careEvents, locale: baby.locale || 'zh-CN', model: llmConfig.model, apiKey: llmConfig.apiKey, baseURL: llmConfig.baseUrl, protocol: llmConfig.protocol, useResponses: llmConfig.useResponses })
    return json({ report, draft: createReportFactDraft({ report, baby, actor }) })
  } catch (error) {
    console.error('Naiba AI report parsing failed', error)
    return json({ error: '报告识别失败，原始文件未保存；请重试或改用文本。' }, 502)
  }
}
