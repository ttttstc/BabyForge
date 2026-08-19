const ALLOWED_AUTHORITY_HOSTS = Object.freeze(['nhc.gov.cn', 'who.int', 'cdc.gov'])

function allowedAuthorityUrl(value) {
  try {
    const url = new URL(String(value || ''))
    return url.protocol === 'https:' && ALLOWED_AUTHORITY_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}

function stableId(value) {
  let hash = 2166136261
  for (const character of String(value || '')) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return `external-${(hash >>> 0).toString(16)}`
}

export async function searchAuthorityKnowledge(query, { apiKey, fetchImpl = fetch, signal = null, now = new Date() } = {}) {
  const normalizedQuery = String(query || '').trim().slice(0, 500)
  if (!apiKey || !normalizedQuery) return []
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)
  const abort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) abort()
  try {
    const response = await fetchImpl('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, query: normalizedQuery, search_depth: 'advanced', max_results: 4, include_domains: ALLOWED_AUTHORITY_HOSTS }),
      signal: controller.signal,
    })
    if (!response.ok) return []
    const payload = await response.json()
    const retrievedAt = now.toISOString()
    return (Array.isArray(payload?.results) ? payload.results : [])
      .filter((item) => allowedAuthorityUrl(item?.url))
      .slice(0, 4)
      .map((item) => ({
        id: stableId(item.url),
        packVersion: `retrieved-${retrievedAt.slice(0, 10)}`,
        claims: [String(item.content || '').trim().slice(0, 1_500)].filter(Boolean),
        scope: { audience: 'caregiver', purpose: 'general_education' },
        limitations: ['External authority material; not a diagnosis or deterministic safety rule.'],
        source: { url: item.url, title: String(item.title || item.url).slice(0, 200), publisher: new URL(item.url).hostname },
        provisional: true,
        retrievedAt,
        query: normalizedQuery,
      }))
      .filter((item) => item.claims.length > 0)
  } catch {
    return []
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}
