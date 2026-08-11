export const SESSION_KEY = 'babyforge:session'

export const DEMO_MODE_ENABLED = Boolean(import.meta.env?.DEV || import.meta.env?.VITE_ENABLE_DEMO === 'true')
export const DEMO_CREDENTIALS = DEMO_MODE_ENABLED ? { username: 'demo', password: '123456' } : null

const LOCAL_TEST_ACCOUNTS = import.meta.env?.DEV ? {
  niwa: { username: 'niwa', password: 'niwaniwa', role: 'admin', displayName: '管理员' },
  baby: { username: 'baby', password: '0729', role: 'guest', displayName: '游客' },
  guest: { username: 'guest', password: '123', role: 'guest', displayName: '只读演示账号' },
} : {}

const DEMO_ACCOUNTS = DEMO_MODE_ENABLED ? {
  ...LOCAL_TEST_ACCOUNTS,
  demo: { ...DEMO_CREDENTIALS, role: 'admin', displayName: '演示账号' },
} : null

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase()
}

function saveSession(storage, session) {
  storage?.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

async function authFetch(fetchImpl, input, init) {
  try {
    return await fetchImpl(input, init)
  } catch (error) {
    if (error instanceof TypeError || /failed to fetch|networkerror|fetch failed/i.test(String(error?.message || ''))) {
      throw new Error('无法连接登录服务，请确认网络连接后重试。', { cause: error })
    }
    throw error
  }
}

async function loadBetterAuthSession(fetchImpl, storage = globalThis.localStorage) {
  const meResponse = await authFetch(fetchImpl, '/api/me', { credentials: 'include' })
  if (meResponse.status === 401 || meResponse.status === 404) return null
  if (meResponse.status === 403) throw new Error('请先验证邮箱')
  if (!meResponse.ok) throw new Error('登录状态无法确认')
  if (!meResponse.headers.get('content-type')?.includes('application/json')) return null
  const me = await meResponse.json()
  const householdResponse = await authFetch(fetchImpl, '/api/household', { credentials: 'include' })
  const householdPayload = householdResponse.ok && householdResponse.headers.get('content-type')?.includes('application/json')
    ? await householdResponse.json()
    : { household: null }
  const household = householdPayload.household || null
  return saveSession(storage, {
    userId: me.user.id,
    username: '',
    email: me.user.email,
    nickname: me.user.nickname || me.user.displayName || '家长',
    displayName: me.user.nickname || me.user.displayName || '家长',
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

  // Demo credentials create a browser-only sandbox. Production builds include
  // them only when VITE_ENABLE_DEMO explicitly marks that build as a showcase.
  const demo = (options.demoAccounts || DEMO_ACCOUNTS)?.[normalized]
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
  const response = await authFetch(fetchImpl, endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (response.status === 404 || response.status === 405 || response.status === 503) {
    const legacyResponse = await authFetch(fetchImpl, '/api/login', {
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
    throw new Error(payload?.error?.message || payload?.message || '邮箱或密码不正确')
  }
  return loadBetterAuthSession(fetchImpl, storage)
}

export async function resumeSession(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  if (typeof fetchImpl !== 'function') return null
  return loadBetterAuthSession(fetchImpl, options.storage || globalThis.localStorage)
}

export async function updateNickname(value, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const response = await authFetch(fetchImpl, '/api/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ nickname: String(value || '').trim() }),
  })
  let payload = {}
  try { payload = await response.json() } catch { /* handled below */ }
  if (!response.ok) throw new Error(payload?.error || '昵称保存失败')
  return payload.user
}

export async function register({ email, password }, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const response = await authFetch(fetchImpl, '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      email: String(email || '').trim().toLowerCase(),
      name: '家长',
      password,
      ...(options.callbackURL ? { callbackURL: options.callbackURL } : {}),
    }),
  })
  let payload = {}
  try { payload = await response.json() } catch { /* handled below */ }
  if (!response.ok) throw new Error(payload?.error?.message || payload?.message || '注册失败')
  return payload
}

export async function requestPasswordReset(email, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const response = await authFetch(fetchImpl, '/api/auth/request-password-reset', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email: String(email || '').trim().toLowerCase(), redirectTo: `${globalThis.location?.origin || ''}/#/reset-password` }),
  })
  if (!response.ok) throw new Error('如果邮箱存在，重置邮件将发送到该邮箱')
  return response.json().catch(() => ({}))
}

export async function resetPassword({ token, password }, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const response = await authFetch(fetchImpl, '/api/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token: String(token || '').trim(), newPassword: password }),
  })
  let payload = {}
  try { payload = await response.json() } catch { /* handled below */ }
  if (!response.ok) throw new Error(payload?.error?.message || payload?.message || '重置链接无效或已过期')
  return payload
}

export async function resendVerification(email, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const response = await authFetch(fetchImpl, '/api/auth/send-verification-email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email: String(email || '').trim().toLowerCase(), callbackURL: options.callbackURL || `${globalThis.location?.origin || ''}/#/login` }),
  })
  if (!response.ok) throw new Error('验证邮件暂时无法发送，请稍后重试')
  return response.json().catch(() => ({}))
}

export async function startGoogleLogin(callbackURL = '/', options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const locationImpl = options.location || globalThis.location
  if (typeof fetchImpl !== 'function' || !locationImpl?.origin || typeof locationImpl.assign !== 'function') throw new Error('Google 登录服务不可用')
  const absoluteCallbackURL = new URL(callbackURL, `${locationImpl.origin}/`).toString()
  const response = await authFetch(fetchImpl, '/api/auth/sign-in/social', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ provider: 'google', callbackURL: absoluteCallbackURL }),
  })
  let payload = {}
  try { payload = await response.json() } catch { /* handled below */ }
  if (!response.ok) throw new Error(payload?.error?.message || payload?.message || 'Google 登录暂时不可用')
  if (!payload?.url) throw new Error('Google 登录未返回跳转地址')
  locationImpl.assign(payload.url)
  return payload.url
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
