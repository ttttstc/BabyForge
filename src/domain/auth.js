export const SESSION_KEY = 'babyforge:session'

const DEMO_ACCOUNTS = import.meta.env?.DEV ? {
  niwa: { username: 'niwa', password: 'niwaniwa', role: 'admin', displayName: '管理员' },
  baby: { username: 'baby', password: '0729', role: 'guest', displayName: '游客' },
} : null

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase()
}

function saveSession(storage, session) {
  storage?.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function persistSession(session, storage = globalThis.localStorage) {
  return saveSession(storage, session)
}

export function loadSession(storage = globalThis.localStorage) {
  try {
    const session = JSON.parse(storage?.getItem(SESSION_KEY) || 'null')
    if (!session?.username || !['admin', 'caregiver', 'guest'].includes(session.role)) return null
    if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now()) {
      storage?.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    return null
  }
}

export function canEdit(session) {
  return session?.role === 'admin' || session?.role === 'caregiver'
}

export async function login(username, password, options = {}) {
  const normalized = normalizeUsername(username)
  const secret = String(password || '')
  const storage = options.storage || globalThis.localStorage

  // Demo credentials are compiled only into Vite development builds. The
  // production bundle must use the Cloudflare Pages Function below.
  const demo = DEMO_ACCOUNTS?.[normalized]
  if (demo && demo.password === secret) {
    return saveSession(storage, {
      username: demo.username,
      role: demo.role,
      displayName: demo.displayName,
      mode: 'demo',
      issuedAt: new Date().toISOString(),
    })
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch
  if (typeof fetchImpl !== 'function') throw new Error('登录服务不可用')
  const response = await fetchImpl('/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username: normalized, password: secret }),
  })
  if (!response.ok) throw new Error('账号或密码不正确')
  const payload = await response.json()
  return saveSession(storage, { ...payload, mode: 'cloudflare' })
}

export async function logout(options = {}) {
  const storage = options.storage || globalThis.localStorage
  storage?.removeItem(SESSION_KEY)
  const fetchImpl = options.fetchImpl || globalThis.fetch
  if (typeof fetchImpl !== 'function') return
  try {
    await fetchImpl('/api/logout', { method: 'POST', credentials: 'include' })
  } catch {
    // Local/demo mode has no API; clearing the local session is sufficient.
  }
}
