import { json } from '../../../_shared/auth.js'
import { findHouseholdForPrincipal, requireBetterAuthUser } from '../../../_shared/principal.js'

export async function onRequestDelete({ request, env, params }) {
  const principal = await requireBetterAuthUser(request, env)
  if (principal.response) return principal.response
  const household = await findHouseholdForPrincipal(env, principal)
  if (!household) return json({ error: '尚未加入家庭' }, 404)
  if (household.role !== 'owner') return json({ error: '只有 Owner 可以撤销邀请' }, 403)
  const result = await env.DB.prepare(`
    UPDATE household_invites
    SET revoked_at = ?
    WHERE id = ? AND household_id = ? AND used_at IS NULL AND revoked_at IS NULL
  `).bind(new Date().toISOString(), params.id, household.id).run()
  if (!result.meta?.changes) return json({ error: '邀请不存在或已被使用' }, 404)
  return json({ ok: true })
}
