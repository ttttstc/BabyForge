import { getCacheState, getExperienceCacheKey } from './experience.js'

export const EXPERIENCE_REQUEST_TIMEOUT_MS = 8000

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
  try { storage?.setItem(key, JSON.stringify(value)) } catch { /* Cache storage is optional. */ }
  return value
}

export function clearExperienceCache({ storage = globalThis.localStorage } = {}) {
  const prefix = 'babyforge:experience:'
  if (!storage || typeof storage.length !== 'number' || typeof storage.key !== 'function') return 0
  const keys = []
  for (let index = 0; index < storage.length; index += 1) {
    try {
      const key = storage.key(index)
      if (key?.startsWith(prefix)) keys.push(key)
    } catch {
      // Cache cleanup is best effort and must never block logout.
    }
  }
  for (const key of keys) {
    try { storage.removeItem(key) } catch { /* Cache cleanup is optional. */ }
  }
  return keys.length
}

function requestError(message, code) {
  const error = new Error(message)
  error.name = 'ExperienceRequestError'
  error.code = code
  return error
}

export async function fetchExperience({ babyId, categoryId, refresh = false, fetchImpl = globalThis.fetch, signal, timeoutMs = EXPERIENCE_REQUEST_TIMEOUT_MS }) {
  if (typeof fetchImpl !== 'function') throw new Error('经验服务不可用')
  const params = new URLSearchParams({ babyId: String(babyId), category: categoryId })
  if (refresh) params.set('refresh', '1')
  const controller = new AbortController()
  let timedOut = false
  let timer
  const onExternalAbort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  else signal?.addEventListener('abort', onExternalAbort, { once: true })
  if (!controller.signal.aborted && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
  }
  try {
    const response = await fetchImpl(`/api/experience?${params.toString()}`, { credentials: 'include', signal: controller.signal })
    let payload
    try { payload = await response.json() } catch { payload = null }
    if (!response.ok) throw new Error(payload?.error || '经验文章暂时无法加载')
    return payload
  } catch (error) {
    if (timedOut) throw requestError('经验查询超时，请稍后重试。', 'EXPERIENCE_TIMEOUT')
    if (signal?.aborted || controller.signal.aborted) throw requestError('经验查询已取消。', 'EXPERIENCE_ABORTED')
    throw error
  } finally {
    if (timer) clearTimeout(timer)
    signal?.removeEventListener('abort', onExternalAbort)
  }
}
