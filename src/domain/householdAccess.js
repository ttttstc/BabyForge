const INVITE_TOKEN = /^[A-Za-z0-9_-]{20,128}$/

export function parseInviteToken(value) {
  const input = String(value || '').trim()
  if (INVITE_TOKEN.test(input)) return input
  try {
    const url = new URL(input, 'https://babyforge.local')
    const hashMatch = url.hash.match(/^#\/household\/invite\/([^/?#]+)/)
    const pathMatch = url.pathname.match(/^\/invite\/([^/?#]+)/)
    const token = decodeURIComponent(hashMatch?.[1] || pathMatch?.[1] || '')
    return INVITE_TOKEN.test(token) ? token : ''
  } catch {
    return ''
  }
}

async function inviteRequest(token, options = {}) {
  const response = await (options.fetchImpl || globalThis.fetch)(`/api/household/invites/${encodeURIComponent(token)}/accept`, {
    method: options.method || 'GET',
    credentials: 'include',
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || '邀请链接无效或已过期')
  return payload
}

export function previewHouseholdInvite(token, options = {}) {
  return inviteRequest(token, options)
}

export function acceptHouseholdInvite(token, options = {}) {
  return inviteRequest(token, { ...options, method: 'POST' })
}

async function visitorLinkRequest(input, init = {}, options = {}) {
  const response = await (options.fetchImpl || globalThis.fetch)(input, { credentials: 'include', ...init })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || '临时访客链接操作失败')
  return payload
}

export function listVisitorLinks(options = {}) {
  return visitorLinkRequest('/api/visitor-links', {}, options)
}

export function createVisitorLink(options = {}) {
  return visitorLinkRequest('/api/visitor-links', { method: 'POST' }, options)
}

export function revokeVisitorLink(id, options = {}) {
  return visitorLinkRequest(`/api/visitor-links/${encodeURIComponent(id)}`, { method: 'DELETE' }, options)
}

export function loadVisitorSummary(token, options = {}) {
  return visitorLinkRequest('/api/visitor', {
    method: 'POST',
    credentials: 'omit',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  }, options)
}
