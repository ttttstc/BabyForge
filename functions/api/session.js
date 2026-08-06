import { getSession, json } from '../_shared/auth.js'

export async function onRequestGet({ request, env }) {
  const session = await getSession(request, env)
  if (!session) return json({ authenticated: false }, 401)
  return json({ authenticated: true, username: session.username, role: session.role, displayName: session.displayName, expiresAt: session.expiresAt })
}
