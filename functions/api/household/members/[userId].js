import { json } from '../../../_shared/auth.js'
import { findHouseholdForPrincipal, requireBetterAuthUser } from '../../../_shared/principal.js'

export async function onRequestDelete({ request, env, params }) {
  const principal = await requireBetterAuthUser(request, env)
  if (principal.response) return principal.response
  const household = await findHouseholdForPrincipal(env, principal)
  if (!household) return json({ error: '尚未加入家庭' }, 404)
  if (household.role !== 'owner') return json({ error: '只有 Owner 可以移除成员' }, 403)
  if (params.userId === principal.userId) return json({ error: 'Owner 不能移除自己' }, 400)
  const result = await env.DB.prepare(`
    UPDATE household_members
    SET active = 0, inactive_at = ?
    WHERE household_id = ? AND user_id = ? AND active = 1
  `).bind(new Date().toISOString(), household.id, params.userId).run()
  if (!result.meta?.changes) return json({ error: '成员不存在' }, 404)
  return json({ ok: true })
}
