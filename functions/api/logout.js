import { clearSessionCookie, getSession, json } from '../_shared/auth.js'
import { getBetterAuth, getBetterAuthSession } from '../_shared/betterAuth.js'

export async function onRequestPost({ request, env }) {
  if (await getBetterAuthSession(request, env)) {
    const headers = new Headers(request.headers)
    if (!headers.get('origin')) headers.set('origin', new URL(request.url).origin)
    const signOutRequest = new Request(new URL('/api/auth/sign-out', request.url), {
      method: 'POST',
      headers,
    })
    return getBetterAuth(env).handler(signOutRequest)
  }
  const session = await getSession(request, env)
  if (session && env.DB) await env.DB.prepare('DELETE FROM auth_sessions WHERE token = ?').bind(session.token).run()
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() })
}
