import { getSession, json } from '../../_shared/auth.js'
import { accessibleBaby, eventFromRow } from '../../_shared/care.js'
import { runNaibaReportAgent } from '../../_shared/naibaAgent.js'
import { parseMedicalReportText } from '../../../src/domain/naibaCapabilities.js'

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
  const baby = await accessibleBaby(env, session.accountId, babyId)
  if (!baby || baby.status === 'detached') return json({ error: '无权访问该宝宝档案' }, 403)
  const rows = await env.DB.prepare('SELECT * FROM care_events WHERE baby_id = ? AND status != \'voided\' ORDER BY occurred_at DESC LIMIT 30').bind(baby.id).all()
  const careEvents = (rows.results || []).map(eventFromRow).filter(Boolean).reverse()
  if (mimeType === 'text/plain') return json({ report: parseMedicalReportText(text, { name }) })
  if (!env.OPENAI_API_KEY) return json({ error: '当前环境未配置报告识别模型；可改用纯文本粘贴。' }, 503)
  try {
    const report = await runNaibaReportAgent({ name, mimeType, dataUrl, text, baby, careEvents, locale: baby.locale || 'zh-CN', model: env.OPENAI_MODEL || 'gpt-4o-mini', apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL, useResponses: env.OPENAI_USE_RESPONSES })
    return json({ report })
  } catch (error) {
    console.error('Naiba AI report parsing failed', error)
    return json({ error: '报告识别失败，原始文件未保存；请重试或改用文本。' }, 502)
  }
}
