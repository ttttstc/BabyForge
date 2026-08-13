import { json } from '../../_shared/auth.js'
import { findHouseholdForPrincipal, requireBetterAuthUser } from '../../_shared/principal.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeContactEmail(value) {
  return String(value || '').trim().toLowerCase()
}

export function contactEmailError(value) {
  const email = normalizeContactEmail(value)
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return '请输入有效的联系人邮箱'
  return null
}

async function householdForRequest(request, env) {
  const principal = await requireBetterAuthUser(request, env)
  if (principal.response) return principal
  const household = await findHouseholdForPrincipal(env, principal)
  if (!household) return { response: json({ error: '尚未加入家庭' }, 404) }
  return { ...principal, household }
}

function contactFromRow(row) {
  return {
    id: row.id,
    email: row.email,
    enabled: row.enabled === 1,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  }
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await householdForRequest(request, env)
  if (auth.response) return auth.response
  const rows = await env.DB.prepare(`
    SELECT id, email, enabled, created_at, updated_at
    FROM email_notification_contacts
    WHERE household_id = ?
    ORDER BY created_at, id
  `).bind(auth.household.id).all()
  return json({ contacts: (rows.results || []).map(contactFromRow) })
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await householdForRequest(request, env)
  if (auth.response) return auth.response
  let body
  try { body = await request.json() } catch { return json({ error: '请求格式不正确' }, 400) }
  const email = normalizeContactEmail(body?.email)
  const error = contactEmailError(email)
  if (error) return json({ error, field: 'email' }, 422)
  const now = new Date().toISOString()
  const id = `email-contact-${crypto.randomUUID()}`
  await env.DB.prepare(`
    INSERT INTO email_notification_contacts (id, household_id, email, enabled, created_by_user_id, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?, ?)
    ON CONFLICT(household_id, email) DO UPDATE SET enabled = 1, updated_at = excluded.updated_at
  `).bind(id, auth.household.id, email, auth.userId, now, now).run()
  const row = await env.DB.prepare(`
    SELECT id, email, enabled, created_at, updated_at
    FROM email_notification_contacts
    WHERE household_id = ? AND email = ?
  `).bind(auth.household.id, email).first()
  return json({ contact: contactFromRow(row) }, row?.id === id ? 201 : 200)
}
