import { json } from '../../../../_shared/auth.js'
import { findHouseholdForPrincipal, hashToken, requireBetterAuthUser } from '../../../../_shared/principal.js'

export async function onRequestGet({ request, env, params }) {
  const principal = await requireBetterAuthUser(request, env)
  if (principal.response) return principal.response
  if (await findHouseholdForPrincipal(env, principal)) return json({ error: '当前账号已经加入家庭' }, 409)
  const tokenHash = await hashToken(params.token)
  const invite = await env.DB.prepare(`
    SELECT i.expires_at, i.used_at, i.revoked_at,
      h.name AS household_name, h.deleted_at,
      b.nickname AS baby_nickname
    FROM household_invites i
    JOIN households h ON h.id = i.household_id
    LEFT JOIN baby_profiles b ON b.household_id = h.id
    WHERE i.token_hash = ?
    LIMIT 1
  `).bind(tokenHash).first()
  if (!invite || invite.used_at || invite.revoked_at || invite.deleted_at || Date.parse(invite.expires_at) <= Date.now()) {
    return json({ error: '邀请链接无效或已过期' }, 410)
  }
  return json({ invite: { householdName: invite.household_name, babyNickname: invite.baby_nickname || null, expiresAt: invite.expires_at } })
}

export async function acceptInviteMembership(env, invite, principal, timestamp) {
  return env.DB.batch([
    env.DB.prepare(`
      UPDATE household_invites
      SET used_at = ?
      WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?
        AND EXISTS (
          SELECT 1 FROM households h
          WHERE h.id = household_invites.household_id AND h.deleted_at IS NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM household_members m WHERE m.user_id = ? AND m.active = 1
        )
    `).bind(timestamp, invite.id, timestamp, principal.userId),
    env.DB.prepare(`
      INSERT INTO household_members (household_id, account_id, role, active, user_id, membership_role, created_at)
      SELECT i.household_id, ?, 'caregiver', 1, ?, 'member', ?
      FROM household_invites i
      JOIN households h ON h.id = i.household_id AND h.deleted_at IS NULL
      WHERE i.id = ? AND i.used_at = ? AND i.revoked_at IS NULL AND i.expires_at > ?
        AND NOT EXISTS (
          SELECT 1 FROM household_members m WHERE m.user_id = ? AND m.active = 1
        )
    `).bind(principal.accountId, principal.userId, timestamp, invite.id, timestamp, timestamp, principal.userId),
  ])
}

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
    const results = await acceptInviteMembership(env, invite, principal, timestamp)
    if (!results?.[0]?.meta?.changes || !results?.[1]?.meta?.changes) return json({ error: '邀请链接无效或已被使用' }, 410)
  } catch (error) {
    if (String(error?.message || '').includes('idx_household_members_one_active_user')) return json({ error: '当前账号已经加入家庭' }, 409)
    throw error
  }
  return json({ household: await findHouseholdForPrincipal(env, principal) })
}
