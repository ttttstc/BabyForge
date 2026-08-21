import { getBetterAuth } from '../../../_shared/betterAuth.js'

const NATIVE_CALLBACK = 'babyforge://auth/callback'

function appError(code) {
  return new Response(null, {
    status: 302,
    headers: {
      location: `${NATIVE_CALLBACK}?error=${encodeURIComponent(code)}`,
      'cache-control': 'no-store',
    },
  })
}

export async function startNativeAuth(request, auth) {
  const origin = new URL(request.url).origin
  const headers = new Headers(request.headers)
  headers.set('content-type', 'application/json')
  headers.set('origin', origin)
  const authResponse = await auth.handler(new Request(`${origin}/api/auth/sign-in/social`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ provider: 'google', callbackURL: `${origin}/api/native/auth/callback` }),
  }))
  let payload
  try { payload = await authResponse.json() } catch { return appError('oauth_start_failed') }
  if (!authResponse.ok || !payload?.url) return appError('oauth_start_failed')

  const responseHeaders = new Headers(authResponse.headers)
  responseHeaders.delete('content-length')
  responseHeaders.delete('content-type')
  responseHeaders.set('location', payload.url)
  responseHeaders.set('cache-control', 'no-store')
  return new Response(null, { status: 302, headers: responseHeaders })
}

export async function onRequestGet({ request, env }) {
  return startNativeAuth(request, getBetterAuth(env))
}
