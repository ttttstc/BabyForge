export const SESSION_KEY = 'babyforge:session'

const DEMO_ACCOUNTS = import.meta.env?.DEV ? {
  niwa: { username: 'niwa', password: 'niwaniwa', role: 'admin', displayName: '管理员' },
  baby: { username: 'baby', password: '0729', role: 'guest', displayName: '游客' },
  guest: { username: 'guest', password: '123', role: 'guest', displayName: '只读演示账号' },
  demo: { username: 'demo', password: '123456', role: 'admin', displayName: '演示账号' },
} : null

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase()
}

function saveSession(storage, session) {
  storage?.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

async function loadBetterAuthSession(fetchImpl, storage = globalThis.localStorage) {
  const meResponse = await fetchImpl('/api/me', { credentials: 'include' })
  if (meResponse.status === 401 || meResponse.status === 404) return null
  if (meResponse.status === 403) throw new Error('请先验证邮箱')
  if (!meResponse.ok) throw new Error('登录状态无法确认')
  const me = await meResponse.json()
  const householdResponse = await fetchImpl('/api/household', { credentials: 'include' })
  const householdPayload = householdResponse.ok ? await householdResponse.json() : { household: null }
  const household = householdPayload.household || null
  return saveSession(storage, {
    userId: me.user.id,
    username: me.user.username || '',
    email: me.user.email,
    displayName: me.user.displayName,
    needsUsername: !me.user.username,
    role: household?.role || 'owner',
    household,
    babies: household?.baby ? [household.baby] : [],
    mode: 'cloudflare',
    auth: 'better-auth',
  })
}

export function persistSession(session, storage = globalThis.localStorage) {
  return saveSession(storage, session)
}

export function loadSession(storage = globalThis.localStorage) {
  try {
    const session = JSON.parse(storage?.getItem(SESSION_KEY) || 'null')
    if ((!session?.username && !session?.userId) || (session?.mode !== 'cloudflare' && !['admin', 'caregiver', 'guest'].includes(session.role))) return null
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
  if (session?.mode === 'cloudflare') return session.role !== 'guest'
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
  const endpoint = normalized.includes('@') ? '/api/auth/sign-in/email' : '/api/auth/sign-in/username'
  const body = normalized.includes('@')
    ? { email: normalized, password: secret, rememberMe: false }
    : { username: normalized, password: secret, rememberMe: false }
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (response.status === 404 || response.status === 405 || response.status === 503) {
    const legacyResponse = await fetchImpl('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username: normalized, password: secret }),
    })
    if (!legacyResponse.ok) throw new Error('账号或密码不正确')
    const payload = await legacyResponse.json()
    return saveSession(storage, { ...payload, mode: 'cloudflare', auth: 'legacy' })
  }
  let payload = {}
  try { payload = await response.json() } catch { /* handled below */ }
  if (!response.ok) {
    const code = payload?.error?.code || payload?.code
    if (code === 'EMAIL_NOT_VERIFIED') throw new Error('请先验证邮箱')
    throw new Error(payload?.error?.message || payload?.message || '账号或密码不正确')
  }
  return loadBetterAuthSession(fetchImpl, storage)
}

export async function resumeSession(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  if (typeof fetchImpl !== 'function') return null
  return loadBetterAuthSession(fetchImpl, options.storage || globalThis.localStorage)
}

export async function updateUsername(value, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const response = await fetchImpl('/api/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username: normalizeUsername(value) }),
  })
  let payload = {}
  try { payload = await response.json() } catch { /* handled below */ }
  if (!response.ok) throw new Error(payload?.error || '用户名不可用')
  return payload.user
}

export async function register({ email, username, password, name }, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const response = await fetchImpl('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email: String(email || '').trim().toLowerCase(), username: normalizeUsername(username), name: String(name || username || '').trim(), password }),
  })
  let payload = {}
  try { payload = await response.json() } catch { /* handled below */ }
  if (!response.ok) throw new Error(payload?.error?.message || payload?.message || '注册失败')
  return payload
}

export async function requestPasswordReset(email, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const response = await fetchImpl('/api/auth/request-password-reset', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email: String(email || '').trim().toLowerCase(), redirectTo: `${globalThis.location?.origin || ''}/#/reset-password` }),
  })
  if (!response.ok) throw new Error('如果邮箱存在，重置邮件将发送到该邮箱')
  return response.json().catch(() => ({}))
}

export async function resendVerification(email, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const response = await fetchImpl('/api/auth/send-verification-email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email: String(email || '').trim().toLowerCase(), callbackURL: `${globalThis.location?.origin || ''}/#/login` }),
  })
  if (!response.ok) throw new Error('验证邮件暂时无法发送，请稍后重试')
  return response.json().catch(() => ({}))
}

export function startGoogleLogin(callbackURL = '/') {
  if (typeof globalThis.location !== 'undefined') {
    const target = new URL('/api/auth/sign-in/social', globalThis.location.origin)
    target.searchParams.set('provider', 'google')
    target.searchParams.set('callbackURL', callbackURL)
    globalThis.location.assign(target.toString())
  }
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
