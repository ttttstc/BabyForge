import { getBetterAuth } from '../../../_shared/betterAuth.js'

const NATIVE_CALLBACK = 'babyforge://auth/callback'

function redirect(location) {
  return new Response(null, {
    status: 302,
    headers: {
      location,
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
    },
  })
}

export async function completeNativeAuth(request, auth) {
  try {
    const result = await auth.api.generateOneTimeToken({ headers: request.headers })
    if (!result?.token) return redirect(`${NATIVE_CALLBACK}?error=session_exchange_failed`)
    return redirect(`${NATIVE_CALLBACK}?token=${encodeURIComponent(result.token)}`)
  } catch {
    return redirect(`${NATIVE_CALLBACK}?error=session_missing`)
  }
}

export async function onRequestGet({ request, env }) {
  return completeNativeAuth(request, getBetterAuth(env))
}
