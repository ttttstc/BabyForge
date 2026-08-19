export const NAIBA_AGENT_CONTRACT = 'babyforge.naiba.agent'
export const NAIBA_AGENT_CONTRACT_VERSION = '1.1.0'
export const NAIBA_CONTEXT_SOURCES = Object.freeze(['today', 'record', 'growth', 'explore'])
export const NAIBA_MAX_ATTACHMENTS = 3
export const NAIBA_MAX_ATTACHMENT_BYTES = 6_000_000
export const NAIBA_MAX_HISTORY_MESSAGES = 20
export const NAIBA_MAX_HISTORY_CHARACTERS = 16_000
export const NAIBA_MAX_ATTACHMENT_SUMMARIES = 3

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function normalizeNaibaContext(value) {
  if (!value || typeof value !== 'object' || !NAIBA_CONTEXT_SOURCES.includes(value.source)) return null
  const selectedDay = /^\d{4}-\d{2}-\d{2}$/.test(String(value.selectedDay || '')) ? String(value.selectedDay) : ''
  const timezone = String(value.timezone || '').trim().slice(0, 80)
  const resourceIds = Array.isArray(value.resourceIds)
    ? [...new Set(value.resourceIds.map((item) => String(item || '').trim().slice(0, 120)).filter(Boolean))].slice(0, 40)
    : []
  const contentType = ['disease', 'organ', 'article'].includes(String(value.contentType || '')) ? String(value.contentType) : ''
  const contentId = String(value.contentId || '').trim().slice(0, 160)
  return {
    source: value.source,
    focus: String(value.focus || '').slice(0, 80),
    label: String(value.label || '').slice(0, 80),
    ...(selectedDay ? { selectedDay } : {}),
    ...(timezone ? { timezone } : {}),
    ...(resourceIds.length ? { resourceIds } : {}),
    ...(contentType && contentId ? { contentType, contentId } : {}),
  }
}

export function normalizeNaibaAttachments(value) {
  if (!Array.isArray(value)) return []
  if (value.length > NAIBA_MAX_ATTACHMENTS) throw new TypeError('naiba-attachment-count')
  return value.map((attachment) => {
    const mimeType = String(attachment?.mimeType || '').toLowerCase()
    const dataUrl = String(attachment?.dataUrl || '')
    const size = Number(attachment?.size || 0)
    const prefix = `data:${mimeType};base64,`
    if (attachment?.kind !== 'image' || !IMAGE_TYPES.has(mimeType)) throw new TypeError('naiba-attachment-type')
    if (!Number.isFinite(size) || size <= 0 || size > NAIBA_MAX_ATTACHMENT_BYTES) throw new TypeError('naiba-attachment-size')
    if (!dataUrl.startsWith(prefix)) throw new TypeError('naiba-attachment-data')
    const encoded = dataUrl.slice(prefix.length)
    if (!/^[a-zA-Z0-9+/]+={0,2}$/.test(encoded)) throw new TypeError('naiba-attachment-data')
    const actualSize = Math.floor(encoded.length * 3 / 4) - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0)
    if (actualSize !== size || actualSize > NAIBA_MAX_ATTACHMENT_BYTES) throw new TypeError('naiba-attachment-size')
    if (attachment?.confirmed !== true) throw new TypeError('naiba-attachment-consent')
    return { kind: 'image', name: String(attachment.name || 'image').slice(0, 160), mimeType, size, dataUrl }
  })
}

function normalizeNaibaAttachmentSummaries(value) {
  if (!Array.isArray(value)) return []
  if (value.length > NAIBA_MAX_ATTACHMENT_SUMMARIES) throw new TypeError('naiba-attachment-summary-count')
  return value.map((attachment) => {
    const mimeType = String(attachment?.mimeType || '').toLowerCase()
    const size = Number(attachment?.size || 0)
    if (attachment?.kind !== 'image' || !IMAGE_TYPES.has(mimeType)) throw new TypeError('naiba-attachment-summary-type')
    if (!Number.isFinite(size) || size <= 0 || size > NAIBA_MAX_ATTACHMENT_BYTES) throw new TypeError('naiba-attachment-summary-size')
    return { kind: 'image', name: String(attachment.name || 'image').slice(0, 160), mimeType, size }
  })
}

export function normalizeNaibaHistory(value) {
  if (!Array.isArray(value)) return []
  const history = value.slice(-NAIBA_MAX_HISTORY_MESSAGES).reverse().map((item) => {
    const role = item?.role === 'assistant' ? 'assistant' : item?.role === 'user' ? 'user' : ''
    const text = String(item?.text || '').trim().slice(0, 4_000)
    if (!role || !text) throw new TypeError('naiba-history-message')
    const attachmentSummary = role === 'user'
      ? normalizeNaibaAttachmentSummaries(item?.attachmentSummary || item?.attachments)
      : []
    return { role, text, ...(attachmentSummary.length ? { attachmentSummary } : {}) }
  }).reverse()
  let remaining = NAIBA_MAX_HISTORY_CHARACTERS
  return history.reverse().reduce((result, item) => {
    if (remaining <= 0) return result
    const text = item.text.slice(Math.max(0, item.text.length - remaining))
    remaining -= text.length
    result.unshift({ ...item, text })
    return result
  }, [])
}

export function naibaContextLabel(context, locale = 'zh-CN') {
  const value = normalizeNaibaContext(context)
  if (!value) return ''
  if (value.label) return value.label
  const labels = locale === 'en-US'
    ? { today: 'Today\'s confirmed care facts', record: 'Care record timeline', growth: 'Growth measurements', explore: 'Current parenting topic' }
    : { today: '今天的已确认照护事实', record: '照护事实时间线', growth: '成长测量趋势', explore: '当前育儿内容' }
  return labels[value.source]
}
