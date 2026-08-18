import {
  NATIVE_RESOURCE_CONTRACT,
  NATIVE_RESOURCE_CONTRACT_VERSION,
  NativeResourceContractError,
  validateNativeResourceEnvelope,
} from './nativeResourceContract.js'
import { validateNativeTodayModel } from './nativeToday.js'

export class NativeResourceClientError extends Error {
  constructor(code, message, { status = 0, retryable = false, details = null } = {}) {
    super(message)
    this.name = 'NativeResourceClientError'
    this.code = code
    this.status = status
    this.retryable = retryable
    this.details = details
  }
}

function parseBody(response, body) {
  if (!body || typeof body !== 'object') {
    throw new NativeResourceClientError('INVALID_RESPONSE', '共享业务服务返回了无效响应。', { status: response.status, retryable: response.status >= 500 })
  }
  if (body.error) {
    throw new NativeResourceClientError(
      body.error.code || 'SERVICE_ERROR',
      body.error.message || '共享业务服务暂时不可用。',
      { status: response.status, retryable: Boolean(body.error.retryable), details: body.error.details || null },
    )
  }
  try {
    return validateNativeResourceEnvelope(body)
  } catch (error) {
    if (error instanceof NativeResourceContractError) throw error
    throw new NativeResourceClientError('INVALID_RESPONSE', '共享业务合同校验失败。', { status: response.status, retryable: false })
  }
}

function readErrorBody(response, body) {
  if (body?.error?.message) return body.error.message
  if (response.status === 401) return '登录状态已失效，请重新登录。'
  if (response.status === 403) return '当前账号没有执行此操作的权限。'
  if (response.status >= 500) return '共享业务服务暂时不可用，请重试。'
  return '请求未完成，请检查输入后重试。'
}

export function createNativeResourceClient({ fetchImpl = globalThis.fetch, baseUrl = '', timezone = 'Asia/Shanghai' } = {}) {
  if (typeof fetchImpl !== 'function') throw new NativeResourceClientError('NO_TRANSPORT', '当前平台没有可用的网络服务。')

  async function request(path, { method = 'GET', body, headers = {}, signal } = {}) {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      credentials: 'include',
      signal,
      headers: {
        accept: 'application/json',
        'x-babyforge-timezone': timezone,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }).catch((error) => {
      throw new NativeResourceClientError('NETWORK_UNAVAILABLE', '无法连接共享业务服务，请检查网络后重试。', { retryable: true, details: String(error?.message || error) })
    })
    let payload = {}
    try { payload = await response.json() } catch { /* handled below */ }
    if (!response.ok) {
      throw new NativeResourceClientError(
        payload?.error?.code || (response.status === 401 ? 'AUTH_REQUIRED' : 'SERVICE_ERROR'),
        readErrorBody(response, payload),
        { status: response.status, retryable: Boolean(payload?.error?.retryable) || response.status >= 500, details: payload?.error?.details || null },
      )
    }
    return payload
  }

  async function bootstrap(options = {}) {
    const payload = await request('/api/native/bootstrap', { signal: options.signal })
    return parseBody({ status: 200 }, payload)
  }

  return {
    bootstrap,
    async today(day = '') {
      const query = /^\d{4}-\d{2}-\d{2}$/.test(day) ? `?day=${encodeURIComponent(day)}` : ''
      return validateNativeTodayModel(await request(`/api/native/today${query}`))
    },
    async createCareEvent(event) {
      return request('/api/events', { method: 'POST', body: { event } })
    },
    async findCareEvent(babyId, eventId) {
      const payload = await request(`/api/events?babyId=${encodeURIComponent(babyId)}&includeVoided=true`)
      return (payload.events || []).find((event) => event.id === eventId) || null
    },
    async voidCareEvent(eventId, version) {
      return request(`/api/events/${encodeURIComponent(eventId)}`, { method: 'DELETE', body: { version } })
    },
    async photos(babyId) {
      return request(`/api/photos?babyId=${encodeURIComponent(babyId)}`)
    },
    async deletePhoto(photoId) {
      return request(`/api/photos/${encodeURIComponent(photoId)}`, { method: 'DELETE' })
    },
    async signInEmail(email, password) {
      await request('/api/auth/sign-in/email', { method: 'POST', body: { email: String(email || '').trim().toLowerCase(), password, rememberMe: true } })
      return bootstrap()
    },
    async register(email, password) {
      return request('/api/auth/sign-up/email', { method: 'POST', body: { email: String(email || '').trim().toLowerCase(), name: '家长', password } })
    },
    async resendVerification(email) {
      return request('/api/auth/send-verification-email', { method: 'POST', body: { email: String(email || '').trim().toLowerCase() } })
    },
    async requestPasswordReset(email) {
      return request('/api/auth/request-password-reset', { method: 'POST', body: { email: String(email || '').trim().toLowerCase() } })
    },
    async startSocialLogin(provider = 'google', callbackURL = '/') {
      const payload = await request('/api/auth/sign-in/social', { method: 'POST', body: { provider, callbackURL } })
      if (!payload?.url) throw new NativeResourceClientError('INVALID_RESPONSE', '第三方登录未返回跳转地址。')
      return payload.url
    },
    async createHousehold({ name, baby } = {}) {
      await request('/api/household', { method: 'POST', body: { name, baby } })
      return bootstrap()
    },
    async previewInvite(token) {
      return request(`/api/household/invites/${encodeURIComponent(token)}/accept`)
    },
    async acceptInvite(token) {
      await request(`/api/household/invites/${encodeURIComponent(token)}/accept`, { method: 'POST' })
      return bootstrap()
    },
    async createInvite() {
      return request('/api/household/invites', { method: 'POST' })
    },
    async removeMember(userId) {
      await request(`/api/household/members/${encodeURIComponent(userId)}`, { method: 'DELETE' })
      return bootstrap()
    },
    async logout() {
      try { await request('/api/logout', { method: 'POST' }) } finally { /* clear local adapter state at the caller */ }
      return null
    },
    contract: {
      name: NATIVE_RESOURCE_CONTRACT,
      version: NATIVE_RESOURCE_CONTRACT_VERSION,
    },
  }
}
