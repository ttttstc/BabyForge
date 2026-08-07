import {
  buildExperienceQuery,
  createCacheEnvelope,
  getCacheState,
  getExperienceServerCacheKey,
  normalizeExperienceResult,
  sortExperienceResults,
  stripInternalArticleFields,
} from '../../src/domain/experience.js'

export const TRUSTED_PROFESSIONAL_SOURCES = [
  { domain: 'gov.cn', name: '中国政府网', enabled: true },
  { domain: 'nhc.gov.cn', name: '国家卫生健康委员会', enabled: true },
  { domain: 'chinacdc.cn', name: '中国疾病预防控制中心', enabled: true },
  { domain: 'cma.org.cn', name: '中华医学会', enabled: true },
]

const TAVILY_URL = 'https://api.tavily.com/search'
const CACHE_PATH = '/__babyforge_experience_cache__/'
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60

function cacheKeyRequest(requestUrl, key) {
  const url = new URL(requestUrl)
  url.pathname = `${CACHE_PATH}${encodeURIComponent(key)}`
  url.search = ''
  return new Request(url.toString(), { method: 'GET' })
}

function cacheApi() {
  return globalThis.caches?.default || null
}

export async function readExperienceCache(requestUrl, key) {
  const cache = cacheApi()
  if (!cache) return null
  const response = await cache.match(cacheKeyRequest(requestUrl, key))
  if (!response) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function writeExperienceCache(requestUrl, key, value, waitUntil) {
  const cache = cacheApi()
  if (!cache) return
  const request = cacheKeyRequest(requestUrl, key)
  const response = new Response(JSON.stringify(value), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${CACHE_TTL_SECONDS}`,
    },
  })
  const write = cache.put(request, response)
  if (typeof waitUntil === 'function') waitUntil(write)
  else await write
}

function tavilyError(response, body) {
  const error = new Error(body?.detail || body?.message || `Tavily request failed (${response.status})`)
  error.status = response.status === 429 ? 429 : 502
  return error
}

export async function searchExperience({ env, band, categoryId }) {
  const apiKey = String(env?.TAVILY_API_KEY || '').trim()
  if (!apiKey) {
    const error = new Error('TAVILY_API_KEY 未配置')
    error.status = 503
    throw error
  }
  const body = {
    query: buildExperienceQuery(band, categoryId),
    topic: 'general',
    search_depth: 'basic',
    auto_parameters: false,
    include_answer: false,
    include_raw_content: 'text',
    max_results: 12,
    country: 'china',
  }
  if (categoryId === 'health') body.include_domains = TRUSTED_PROFESSIONAL_SOURCES.map((source) => source.domain)
  let response
  try {
    response = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    })
  } catch {
    const error = new Error('Tavily 暂时无法连接')
    error.status = 502
    throw error
  }
  let payload
  try { payload = await response.json() } catch { payload = null }
  if (!response.ok) throw tavilyError(response, payload)
  const articles = (Array.isArray(payload?.results) ? payload.results : [])
    .map((result) => normalizeExperienceResult(result, { band, categoryId, sources: TRUSTED_PROFESSIONAL_SOURCES }))
    .filter(Boolean)
  const unique = [...new Map(articles.map((article) => [article.url, article])).values()]
  return sortExperienceResults(unique).slice(0, 12).map(stripInternalArticleFields)
}

export async function loadOrSearchExperience({ requestUrl, env, band, categoryId, refresh = false, waitUntil }) {
  const key = getExperienceServerCacheKey({ bandId: band.id, categoryId })
  const cached = await readExperienceCache(requestUrl, key)
  const cachedState = getCacheState(cached)
  if (!refresh && cached && cachedState !== 'expired' && cachedState !== 'invalid') {
    return { ...cached, cacheState: cachedState }
  }
  try {
    const envelope = createCacheEnvelope({ bandId: band.id, categoryId, articles: await searchExperience({ env, band, categoryId }) })
    await writeExperienceCache(requestUrl, key, envelope, waitUntil)
    return { ...envelope, cacheState: 'generated' }
  } catch (error) {
    if (cached && cachedState === 'stale') return { ...cached, cacheState: 'stale', error: error.message }
    throw error
  }
}
