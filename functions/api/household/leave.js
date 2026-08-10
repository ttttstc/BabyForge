import { json } from '../../_shared/auth.js'
import { findHouseholdForPrincipal, requireBetterAuthUser } from '../../_shared/principal.js'

export async function onRequestPost({ request, env }) {
  const principal = await requireBetterAuthUser(request, env)
  if (principal.response) return principal.response
  const household = await findHouseholdForPrincipal(env, principal)
  if (!household) return json({ error: '尚未加入家庭' }, 404)
  if (household.role === 'owner') return json({ error: 'Owner 不能退出家庭，请删除家庭或联系支持' }, 400)
  await env.DB.prepare(`
    UPDATE household_members SET active = 0, inactive_at = ?
    WHERE household_id = ? AND user_id = ? AND active = 1
  `).bind(new Date().toISOString(), household.id, principal.userId).run()
  return json({ ok: true })
}
