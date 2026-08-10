import { json } from '../../_shared/auth.js'
import { findHouseholdForPrincipal, hashToken, randomToken, requireBetterAuthUser } from '../../_shared/principal.js'

export async function onRequestPost({ request, env }) {
  const principal = await requireBetterAuthUser(request, env)
  if (principal.response) return principal.response
  const household = await findHouseholdForPrincipal(env, principal)
  if (!household) return json({ error: '尚未加入家庭' }, 404)
  if (household.role !== 'owner') return json({ error: '只有 Owner 可以邀请成员' }, 403)
  const token = randomToken()
  const tokenHash = await hashToken(token)
  const id = `invite-${crypto.randomUUID()}`
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  await env.DB.prepare(`
    INSERT INTO household_invites (id, household_id, token_hash, expires_at, created_by_user_id)
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, household.id, tokenHash, expiresAt, principal.userId).run()
  return json({ invite: { id, token, expiresAt, url: `/invite/${token}` } }, 201)
}
