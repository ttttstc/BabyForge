import { getCacheState, getExperienceCacheKey } from './experience.js'

function readJson(storage, key) {
  try {
    const value = JSON.parse(storage?.getItem(key) || 'null')
    return value && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

export function readExperienceCache({ storage = globalThis.localStorage, babyId, bandId, categoryId, locale = 'zh-CN', now = Date.now() }) {
  const key = getExperienceCacheKey({ babyId, bandId, categoryId, locale })
  const value = readJson(storage, key)
  if (!value) return null
  const state = getCacheState(value, now)
  if (state === 'invalid' || state === 'expired') {
    storage?.removeItem(key)
    return null
  }
  return { ...value, cacheState: state }
}

export function writeExperienceCache({ storage = globalThis.localStorage, babyId, bandId, categoryId, locale = 'zh-CN', value }) {
  const key = getExperienceCacheKey({ babyId, bandId, categoryId, locale })
  storage?.setItem(key, JSON.stringify(value))
  return value
}

export async function fetchExperience({ babyId, categoryId, refresh = false, fetchImpl = globalThis.fetch }) {
  if (typeof fetchImpl !== 'function') throw new Error('经验服务不可用')
  const params = new URLSearchParams({ babyId: String(babyId), category: categoryId })
  if (refresh) params.set('refresh', '1')
  const response = await fetchImpl(`/api/experience?${params.toString()}`, { credentials: 'include' })
  let payload
  try { payload = await response.json() } catch { payload = null }
  if (!response.ok) throw new Error(payload?.error || '经验文章暂时无法加载')
  return payload
}
