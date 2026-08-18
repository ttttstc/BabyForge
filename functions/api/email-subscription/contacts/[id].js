import { json } from '../../../_shared/auth.js'
import { findHouseholdForPrincipal, requireBetterAuthUser } from '../../../_shared/principal.js'

export async function onRequestDelete({ request, env, params }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const principal = await requireBetterAuthUser(request, env)
  if (principal.response) return principal.response
  const household = await findHouseholdForPrincipal(env, principal)
  if (!household) return json({ error: '尚未加入家庭' }, 404)
  if (household.role !== 'owner') return json({ error: '只有 Owner 可以管理家庭通知联系人' }, 403)
  const result = await env.DB.prepare(`
    DELETE FROM email_notification_contacts
    WHERE id = ? AND household_id = ?
  `).bind(String(params?.id || ''), household.id).run()
  if (result?.meta?.changes === 0) return json({ error: '联系人不存在或已删除' }, 404)
  return json({ deleted: true, id: String(params.id) })
}
