import { json } from '../_shared/auth.js'
import { requireBetterAuthUser } from '../_shared/principal.js'

async function currentSubscription(env, userId) {
  return env.DB.prepare(`
    SELECT s.enabled, u.email
    FROM "user" u
    LEFT JOIN email_update_subscriptions s ON s.user_id = u.id
    WHERE u.id = ?
  `).bind(userId).first()
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const principal = await requireBetterAuthUser(request, env)
  if (principal.response) return principal.response
  const row = await currentSubscription(env, principal.userId)
  return json({ subscription: { email: row?.email || principal.email, enabled: row?.enabled === 1 } })
}

export async function onRequestPut({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const principal = await requireBetterAuthUser(request, env)
  if (principal.response) return principal.response
  let body
  try { body = await request.json() } catch { return json({ error: '请求格式不正确' }, 400) }
  if (typeof body?.enabled !== 'boolean') return json({ error: 'enabled 必须是布尔值', field: 'enabled' }, 422)
  const now = new Date().toISOString()
  await env.DB.prepare(`
    INSERT INTO email_update_subscriptions (user_id, enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at
  `).bind(principal.userId, body.enabled ? 1 : 0, now, now).run()
  const row = await currentSubscription(env, principal.userId)
  return json({ subscription: { email: row?.email || principal.email, enabled: row?.enabled === 1 } })
}
