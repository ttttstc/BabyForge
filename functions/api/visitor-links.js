import { json } from '../_shared/auth.js'
import { findHouseholdForPrincipal, hashToken, randomToken, requireBetterAuthUser } from '../_shared/principal.js'

const VISITOR_TTL_MS = 2 * 60 * 60 * 1000

async function requireOwner(request, env) {
  const principal = await requireBetterAuthUser(request, env)
  if (principal.response) return principal
  const household = await findHouseholdForPrincipal(env, principal)
  if (!household) return { response: json({ error: '尚未加入家庭' }, 404) }
  if (household.role !== 'owner') return { response: json({ error: '只有 Owner 可以管理临时访客链接' }, 403) }
  return { principal, household }
}

function linkStatus(link, now = Date.now()) {
  if (link.revokedAt) return 'revoked'
  return Date.parse(link.expiresAt) <= now ? 'expired' : 'active'
}

export async function createTemporaryVisitorLink(env, householdId, userId, now = Date.now()) {
  const token = randomToken()
  const id = `visitor-${crypto.randomUUID()}`
  const expiresAt = new Date(now + VISITOR_TTL_MS).toISOString()
  const result = await env.DB.prepare(`
    INSERT INTO temporary_visitor_links
      (id, household_id, token_hash, expires_at, created_by_user_id)
    SELECT ?, ?, ?, ?, ?
    WHERE EXISTS (
      SELECT 1 FROM households h WHERE h.id = ? AND h.deleted_at IS NULL
    )
  `).bind(id, householdId, await hashToken(token), expiresAt, userId, householdId).run()
  return result.meta?.changes ? { id, token, expiresAt, status: 'active', url: `/#/visit/${token}` } : null
}

export async function onRequestGet({ request, env }) {
  const access = await requireOwner(request, env)
  if (access.response) return access.response
  const rows = await env.DB.prepare(`
    SELECT id, expires_at AS expiresAt, revoked_at AS revokedAt, created_at AS createdAt
    FROM temporary_visitor_links
    WHERE household_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `).bind(access.household.id).all()
  return json({ links: (rows.results || []).map((link) => ({ ...link, status: linkStatus(link) })) })
}

export async function onRequestPost({ request, env }) {
  const access = await requireOwner(request, env)
  if (access.response) return access.response
  if (!access.household.baby) return json({ error: '家庭尚未建立宝宝档案' }, 409)
  const link = await createTemporaryVisitorLink(env, access.household.id, access.principal.userId)
  if (!link) return json({ error: '家庭已删除，无法生成链接' }, 409)
  return json({ link }, 201)
}
