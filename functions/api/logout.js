import { clearSessionCookie, getSession, json } from '../_shared/auth.js'

export async function onRequestPost({ request, env }) {
  const session = await getSession(request, env)
  if (session && env.DB) await env.DB.prepare('DELETE FROM auth_sessions WHERE token = ?').bind(session.token).run()
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() })
}
