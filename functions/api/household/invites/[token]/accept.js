import { json } from '../../../../_shared/auth.js'
import { findHouseholdForPrincipal, hashToken, requireBetterAuthUser } from '../../../../_shared/principal.js'

export async function onRequestPost({ request, env, params }) {
  const principal = await requireBetterAuthUser(request, env)
  if (principal.response) return principal.response
  if (await findHouseholdForPrincipal(env, principal)) return json({ error: '当前账号已经加入家庭' }, 409)
  const tokenHash = await hashToken(params.token)
  const invite = await env.DB.prepare(`
    SELECT id, household_id, expires_at, used_at, revoked_at
    FROM household_invites
    WHERE token_hash = ?
  `).bind(tokenHash).first()
  if (!invite || invite.used_at || invite.revoked_at || Date.parse(invite.expires_at) <= Date.now()) return json({ error: '邀请链接无效或已过期' }, 410)
  const household = await env.DB.prepare('SELECT id, deleted_at FROM households WHERE id = ?').bind(invite.household_id).first()
  if (!household || household.deleted_at) return json({ error: '家庭不存在或已删除' }, 410)
  const timestamp = new Date().toISOString()
  try {
    const results = await env.DB.batch([
      env.DB.prepare('UPDATE household_invites SET used_at = ? WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL').bind(timestamp, invite.id),
      env.DB.prepare(`
        INSERT INTO household_members (household_id, account_id, role, active, user_id, membership_role, created_at)
        SELECT ?, ?, 'caregiver', 1, ?, 'member', ?
        WHERE EXISTS (SELECT 1 FROM household_invites WHERE id = ? AND used_at = ?)
      `).bind(invite.household_id, principal.accountId, principal.userId, timestamp, invite.id, timestamp),
    ])
    if (!results?.[0]?.meta?.changes || !results?.[1]?.meta?.changes) return json({ error: '邀请链接无效或已被使用' }, 410)
  } catch (error) {
    if (String(error?.message || '').includes('idx_household_members_one_active_user')) return json({ error: '当前账号已经加入家庭' }, 409)
    throw error
  }
  return json({ household: await findHouseholdForPrincipal(env, principal) })
}
