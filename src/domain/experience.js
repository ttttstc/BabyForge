export const EXPERIENCE_CACHE_VERSION = 'v2'
export const EXPERIENCE_CONTENT_LANGUAGE = 'zh-CN'
export const EXPERIENCE_FRESH_MS = 24 * 60 * 60 * 1000
export const EXPERIENCE_STALE_MS = 7 * EXPERIENCE_FRESH_MS

const DAY_MS = 86_400_000
const TRACKING_PARAMS = new Set(['fbclid', 'gclid', 'dclid', 'msclkid', 'mc_cid', 'mc_eid', 'ref', 'share'])
const HIGH_RISK_PATTERNS = [
  /偏方|秘方|祖传/u,
  /捂汗|酒精擦浴|喂(?:食)?蜂蜜/u,
  /自行(?:服用|用药|停药)|擅自(?:停药|换药|加量)|药物剂量/u,
  /(?:推荐|建议|可以|应该).{0,8}(?:吃|喝|服用|涂抹|使用).{0,8}(?:药|抗生素|退烧药|益生菌)/u,
]
const NEGATION_PATTERN = /不要|不建议|切勿|避免|禁止|不得|不可|严禁|不宜/u
const AD_PATTERNS = [
  /(?:立即|马上)(?:购买|下单|抢购|代理|加盟|报名)/u,
  /(?:立即|马上).{0,8}(?:优惠券|满减|折扣)/u,
  /限时|优惠券|满减|折扣|直播间|加微信|扫码|代理|加盟|课程报名/u,
  /(?:购买|优惠|推荐|代理|加盟|下单).{0,12}(?:奶粉|保健品|营养品)/u,
  /减肥|祛湿|排毒/u,
]

export const EXPERIENCE_CATEGORIES = [
  {
    id: 'recommended',
    label: { zh: '推荐', en: 'Recommended' },
    terms: '阶段育儿经验 家长分享 真实记录 中文社区',
  },
  {
    id: 'feeding',
    label: { zh: '喂养', en: 'Feeding' },
    terms: '喂养 吃奶 吃饱 拍嗝 吐奶 家长经验 真实记录',
  },
  {
    id: 'care',
    label: { zh: '护理', en: 'Care' },
    terms: '日常护理 脐带 换尿布 洗澡 皮肤 家长经验 真实记录',
  },
  {
    id: 'sleep',
    label: { zh: '睡眠', en: 'Sleep' },
    terms: '安全睡眠 睡姿 睡眠环境 夜间照护 家长经验 真实记录',
  },
  {
    id: 'health',
    label: { zh: '健康观察', en: 'Health observation' },
    terms: '健康观察 黄疸 体温 呼吸 尿便 精神状态 医院 医生科普',
  },
]

export const CHINA_COMMUNITY_SOURCES = Object.freeze([
  { domain: '*.xiaohongshu.com', name: '小红书', enabled: true },
  { domain: '*.zhihu.com', name: '知乎', enabled: true },
  { domain: '*.mama.cn', name: '妈妈网', enabled: true },
  { domain: '*.babytree.com', name: '宝宝树', enabled: true },
  { domain: '*.ci123.com', name: '育儿网', enabled: true },
  { domain: '*.weibo.com', name: '微博', enabled: true },
  { domain: 'tieba.baidu.com', name: '百度贴吧', enabled: true },
  { domain: 'mp.weixin.qq.com', name: '微信公众平台', enabled: true },
  { domain: '*.bilibili.com', name: '哔哩哔哩', enabled: true },
])

export const CONTENT_AGE_BANDS = [
  { id: 'newborn', label: '新生儿期', rangeLabel: '0～28天', queryLabel: '0到28天新生儿', minMonths: 0, maxMonths: 0, maxDays: 28, excludeTerms: ['3个月', '4个月', '5个月', '6个月', '半岁', '辅食', '学步', '1岁', '幼儿'] },
  { id: 'young-infant', label: '小月龄期', rangeLabel: '29天～2个月', queryLabel: '29天到2个月婴儿', minMonths: 0, maxMonths: 2, excludeTerms: ['辅食', '爬行', '学步', '1岁', '幼儿'] },
  { id: 'early-infant', label: '早期婴儿', rangeLabel: '3～5个月', queryLabel: '3到5个月婴儿', minMonths: 3, maxMonths: 5, excludeTerms: ['新生儿', '辅食', '学步', '1岁', '幼儿'] },
  { id: 'solid-food-start', label: '辅食起步期', rangeLabel: '6～8个月', queryLabel: '6到8个月婴儿', minMonths: 6, maxMonths: 8, excludeTerms: ['新生儿', '学步', '1岁半', '2岁', '幼儿园'] },
  { id: 'mobile-explorer', label: '移动探索期', rangeLabel: '9～11个月', queryLabel: '9到11个月婴儿', minMonths: 9, maxMonths: 11, excludeTerms: ['新生儿', '学步', '2岁', '幼儿园'] },
  { id: 'early-toddler', label: '初步幼儿期', rangeLabel: '12～17个月', queryLabel: '1岁到1岁半幼儿', minMonths: 12, maxMonths: 17, excludeTerms: ['新生儿', '3个月', '辅食起步'] },
  { id: 'rapid-development', label: '快速发展期', rangeLabel: '18～23个月', queryLabel: '1岁半到2岁幼儿', minMonths: 18, maxMonths: 23, excludeTerms: ['新生儿', '3个月', '辅食起步'] },
  { id: 'autonomy', label: '自主意识期', rangeLabel: '24～29个月', queryLabel: '2岁到2岁半幼儿', minMonths: 24, maxMonths: 29, excludeTerms: ['新生儿', '3个月', '辅食起步'] },
  { id: 'young-toddler', label: '低龄幼儿期', rangeLabel: '30～36个月', queryLabel: '2岁半到3岁幼儿', minMonths: 30, maxMonths: 36, excludeTerms: ['新生儿', '3个月', '辅食起步'] },
]

const CATEGORY_BY_ID = new Map(EXPERIENCE_CATEGORIES.map((category) => [category.id, category]))

function dateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''))
  if (!match) throw new TypeError('Date must use YYYY-MM-DD')
  const parts = match.slice(1).map(Number)
  const stamp = Date.UTC(parts[0], parts[1] - 1, parts[2])
  const parsed = new Date(stamp)
  if (parsed.getUTCFullYear() !== parts[0] || parsed.getUTCMonth() !== parts[1] - 1 || parsed.getUTCDate() !== parts[2]) throw new TypeError('Invalid calendar date')
  return { year: parts[0], month: parts[1], day: parts[2] }
}

function datePartsFromDate(value, timeZone = 'Asia/Shanghai') {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return dateParts(value)
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new TypeError('Invalid date')
  const values = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const result = Object.fromEntries(values.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
  return { year: result.year, month: result.month, day: result.day }
}

function serial({ year, month, day }) {
  return Date.UTC(year, month - 1, day) / DAY_MS
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function calendarMonths(birth, today) {
  let months = (today.year - birth.year) * 12 + today.month - birth.month
  const anniversaryDay = Math.min(birth.day, daysInMonth(today.year, today.month))
  if (today.day < anniversaryDay) months -= 1
  return Math.max(0, months)
}

export function getExperienceAge(birthDate, now = new Date(), timeZone = 'Asia/Shanghai') {
  const birth = dateParts(birthDate)
  const today = datePartsFromDate(now, timeZone)
  const ageDays = serial(today) - serial(birth)
  if (ageDays < 0) throw new RangeError('Birth date cannot be in the future')
  return { ageDays, ageMonths: calendarMonths(birth, today), today }
}

export function getContentAgeBand({ ageDays, ageMonths }) {
  if (!Number.isFinite(ageDays) || ageDays < 0) return null
  if (ageDays <= 28) return CONTENT_AGE_BANDS[0]
  if (!Number.isFinite(ageMonths)) return null
  return CONTENT_AGE_BANDS.slice(1).find((band) => ageMonths >= band.minMonths && ageMonths <= band.maxMonths) || null
}

export function getContentAgeBandForBaby(birthDate, now = new Date(), timeZone = 'Asia/Shanghai') {
  const age = getExperienceAge(birthDate, now, timeZone)
  return { ...age, band: getContentAgeBand(age) }
}

export function getExperienceCategory(categoryId) {
  return CATEGORY_BY_ID.get(categoryId) || null
}

export function buildExperienceQuery(band, categoryId) {
  const category = getExperienceCategory(categoryId)
  if (!band || !category) throw new TypeError('Unknown experience age band or category')
  return `${band.queryLabel} ${category.terms}`
}

export function formatExperienceAge({ ageDays, ageMonths }, locale = 'zh-CN') {
  if (locale === 'en-US') {
    if (ageDays <= 28) return `${ageDays} day${ageDays === 1 ? '' : 's'}`
    return `${ageMonths} month${ageMonths === 1 ? '' : 's'}`
  }
  if (ageDays <= 28) return `${ageDays}天`
  return `${ageMonths}个月`
}

export function getExperienceCacheKey({ babyId, categoryId, bandId, locale = EXPERIENCE_CONTENT_LANGUAGE }) {
  return `babyforge:experience:${EXPERIENCE_CACHE_VERSION}:${String(babyId)}:${locale}:${bandId}:${categoryId}`
}

export function getExperienceServerCacheKey({ categoryId, bandId, locale = EXPERIENCE_CONTENT_LANGUAGE, rulesVersion = EXPERIENCE_CACHE_VERSION }) {
  return `experience:${rulesVersion}:${locale}:${bandId}:${categoryId}`
}

export function getCacheState(value, now = Date.now()) {
  const generatedAt = Date.parse(value?.generatedAt || '')
  const expiresAt = Date.parse(value?.expiresAt || '')
  const staleUntil = Date.parse(value?.staleUntil || '')
  if (!Number.isFinite(generatedAt) || !Number.isFinite(expiresAt)) return 'invalid'
  if (now <= expiresAt) return 'fresh'
  if (Number.isFinite(staleUntil) && now <= staleUntil) return 'stale'
  return 'expired'
}

export function createCacheEnvelope(payload, generatedAt = new Date()) {
  const stamp = generatedAt instanceof Date ? generatedAt : new Date(generatedAt)
  const time = stamp.getTime()
  return {
    ...payload,
    generatedAt: stamp.toISOString(),
    expiresAt: new Date(time + EXPERIENCE_FRESH_MS).toISOString(),
    staleUntil: new Date(time + EXPERIENCE_STALE_MS).toISOString(),
    rulesVersion: EXPERIENCE_CACHE_VERSION,
  }
}

export function normalizeArticleUrl(value) {
  let parsed
  try {
    parsed = new URL(String(value || ''))
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null
  const hostname = parsed.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname === '::1' || /^(10\.|127\.|192\.168\.|169\.254\.)/.test(hostname)) return null
  for (const key of [...parsed.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMS.has(key.toLowerCase())) parsed.searchParams.delete(key)
  }
  parsed.hash = ''
  return parsed.toString()
}

function normalizeHostname(value) {
  return String(value || '').toLowerCase().replace(/\.$/u, '').replace(/^www\./u, '')
}

function hostnameFor(value) {
  try { return normalizeHostname(new URL(value).hostname) } catch { return '' }
}

export function isAllowedTrustedDomain(hostname, source) {
  const cleanHostname = normalizeHostname(hostname)
  const pattern = normalizeHostname(source?.domain)
  if (!cleanHostname || !pattern) return false
  if (pattern.startsWith('*.')) {
    const root = pattern.slice(2)
    return cleanHostname === root || cleanHostname.endsWith(`.${root}`)
  }
  return cleanHostname === pattern
}

export function trustedSourceForUrl(url, sources = []) {
  const hostname = hostnameFor(url)
  return sources.find((source) => isAllowedTrustedDomain(hostname, source) && source.enabled !== false) || null
}

function textContent(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/[#*_`>[\]]/g, ' ').replace(/\s+/g, ' ').trim()
}

function dangerousAdvice(text) {
  return HIGH_RISK_PATTERNS.some((pattern) => {
    const match = pattern.exec(text)
    if (!match) return false
    const clauseStart = Math.max(
      text.lastIndexOf('。', match.index - 1),
      text.lastIndexOf('！', match.index - 1),
      text.lastIndexOf('？', match.index - 1),
      text.lastIndexOf('!', match.index - 1),
      text.lastIndexOf('?', match.index - 1),
      text.lastIndexOf('；', match.index - 1),
      text.lastIndexOf(';', match.index - 1),
      text.lastIndexOf('\n', match.index - 1),
    ) + 1
    return !NEGATION_PATTERN.test(text.slice(clauseStart, match.index))
  })
}

function adContent(text) {
  return AD_PATTERNS.some((pattern) => pattern.test(text))
}

function obviousAgeMismatch(title, band) {
  return band.excludeTerms.some((term) => title.includes(term))
}

function inferCategory(text, requestedCategory) {
  if (requestedCategory !== 'recommended') return requestedCategory
  if (/黄疸|发热|呼吸|尿便|精神状态|疾病|症状/u.test(text)) return 'health'
  if (/睡眠|睡姿|夜间|睡觉/u.test(text)) return 'sleep'
  if (/喂养|吃奶|母乳|配方奶|吐奶|拍嗝/u.test(text)) return 'feeding'
  if (/脐带|洗澡|尿布|护理|皮肤/u.test(text)) return 'care'
  return 'recommended'
}

function summaryFrom(text) {
  const clean = textContent(text)
  if (!clean) return ''
  const sentences = clean.split(/(?<=[。！？!?])\s*/u).filter(Boolean).slice(0, 2).join('')
  if (sentences.length <= 180) return sentences
  return `${sentences.slice(0, 177).replace(/[，、；：,;:。！？!?\s]+$/u, '')}…`
}

function publishedDate(value) {
  const text = String(value || '').trim()
  if (!text) return undefined
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10)
}

export function normalizeExperienceResult(result, { band, categoryId, sources = [], communitySources = CHINA_COMMUNITY_SOURCES } = {}) {
  if (!result || !band) return null
  const url = normalizeArticleUrl(result.url)
  const title = textContent(result.title)
  const raw = textContent(result.raw_content || result.content)
  const combined = `${title} ${raw}`
  if (!url || !title || !raw || !/[\u3400-\u9fff]/u.test(combined) || adContent(combined) || obviousAgeMismatch(title, band)) return null
  if (dangerousAdvice(combined)) return null
  const source = trustedSourceForUrl(url, sources)
  const communitySource = trustedSourceForUrl(url, communitySources)
  if (!source && !communitySource) return null
  const category = inferCategory(combined, categoryId)
  const highRisk = category === 'health' || /黄疸|发热|呼吸异常|抽搐|用药|急救|疾病判断|异常发育/u.test(combined)
  if (highRisk && !source) return null
  return {
    id: url,
    title,
    summary: summaryFrom(result.content || result.raw_content),
    sourceName: source?.name || communitySource.name,
    sourceDomain: hostnameFor(url),
    sourceType: source ? 'professional' : 'experience',
    publishedAt: publishedDate(result.published_date),
    url,
    category,
    ageBandId: band.id,
    ageLabel: band.rangeLabel,
    score: Number.isFinite(Number(result.score)) ? Number(result.score) : 0,
  }
}

export function sortExperienceResults(articles = [], maxPerDomain = 3) {
  const remaining = [...articles].sort((a, b) => {
    if (a.sourceType !== b.sourceType) return a.sourceType === 'experience' ? -1 : 1
    if (Number(b.score || 0) !== Number(a.score || 0)) return Number(b.score || 0) - Number(a.score || 0)
    return String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''))
  })
  const pools = new Map()
  for (const [index, article] of remaining.entries()) {
    const domain = article.sourceDomain || `__unknown_${index}__`
    const pool = pools.get(domain) || []
    if (pool.length < maxPerDomain) pool.push(article)
    pools.set(domain, pool)
  }
  const selected = []
  let previousDomain = ''
  while (pools.size) {
    const domain = [...pools.keys()].find((candidate) => candidate !== previousDomain) || pools.keys().next().value
    const [article, ...rest] = pools.get(domain)
    if (rest.length) pools.set(domain, rest)
    else pools.delete(domain)
    selected.push(article)
    previousDomain = domain
  }
  return selected
}

export function stripInternalArticleFields(article) {
  if (!article) return article
  const publicArticle = { ...article }
  delete publicArticle.score
  return publicArticle
}
