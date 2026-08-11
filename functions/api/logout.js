import { clearSessionCookie, getLegacySessionToken } from '../_shared/auth.js'
import { getBetterAuth } from '../_shared/betterAuth.js'
import { clearShowcaseCookie, revokeShowcaseSession } from '../_shared/demoShowcase.js'

export async function logoutRequest(request, env, { createAuth = getBetterAuth } = {}) {
  const legacyToken = getLegacySessionToken(request)
  if (legacyToken && env.DB) {
    await env.DB.prepare('DELETE FROM auth_sessions WHERE token = ?').bind(legacyToken).run()
  }
  await revokeShowcaseSession(request, env)

  const headers = new Headers(request.headers)
  if (!headers.get('origin')) headers.set('origin', new URL(request.url).origin)
  const signOutRequest = new Request(new URL('/api/auth/sign-out', request.url), {
    method: 'POST',
    headers,
  })
  const response = await createAuth(env).handler(signOutRequest)
  const responseHeaders = new Headers(response.headers)
  responseHeaders.append('set-cookie', clearSessionCookie())
  responseHeaders.append('set-cookie', clearShowcaseCookie())
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

export async function onRequestPost({ request, env }) {
  return logoutRequest(request, env)
}
