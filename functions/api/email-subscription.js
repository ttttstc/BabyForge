import { json } from '../_shared/auth.js'
import { findHouseholdForPrincipal, requireBetterAuthUser } from '../_shared/principal.js'

async function currentSubscription(env, userId) {
  return env.DB.prepare(`
    SELECT s.enabled, u.email
    FROM "user" u
    LEFT JOIN email_update_subscriptions s ON s.user_id = u.id
    WHERE u.id = ?
  `).bind(userId).first()
}

async function currentContacts(env, householdId) {
  if (!householdId) return []
  const rows = await env.DB.prepare(`
    SELECT id, email, enabled, created_at AS createdAt, updated_at AS updatedAt
    FROM email_notification_contacts
    WHERE household_id = ?
    ORDER BY created_at, id
  `).bind(householdId).all()
  return (rows.results || []).map((row) => ({
    id: row.id,
    email: row.email,
    enabled: row.enabled === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }))
}

function subscriptionResponse(row, principal, contacts) {
  return {
    subscription: { email: row?.email || principal.email, enabled: row?.enabled === 1 },
    contacts,
  }
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const principal = await requireBetterAuthUser(request, env)
  if (principal.response) return principal.response
  const row = await currentSubscription(env, principal.userId)
  const household = await findHouseholdForPrincipal(env, principal)
  return json(subscriptionResponse(row, principal, await currentContacts(env, household?.id)))
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
  const household = await findHouseholdForPrincipal(env, principal)
  return json(subscriptionResponse(row, principal, await currentContacts(env, household?.id)))
}
