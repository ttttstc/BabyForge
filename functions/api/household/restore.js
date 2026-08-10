import { json } from '../../_shared/auth.js'
import { findHouseholdForPrincipal, requireBetterAuthUser } from '../../_shared/principal.js'

const RECOVERY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export async function onRequestPost({ request, env }) {
  const principal = await requireBetterAuthUser(request, env, { maxAgeSeconds: 10 * 60 })
  if (principal.response) return principal.response
  const deleted = await env.DB.prepare(`
    SELECT id, deleted_at AS deletedAt
    FROM households
    WHERE owner_user_id = ? AND deleted_at IS NOT NULL
    ORDER BY deleted_at DESC
    LIMIT 1
  `).bind(principal.userId).first()
  if (!deleted) return json({ error: '没有可恢复的家庭' }, 404)
  const deletedAtMs = Date.parse(deleted.deletedAt)
  if (!deletedAtMs || Date.now() - deletedAtMs > RECOVERY_WINDOW_MS) return json({ error: '家庭恢复窗口已结束' }, 410)
  const restoredAt = new Date().toISOString()
  try {
    await env.DB.batch([
      env.DB.prepare('UPDATE households SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at = ?').bind(restoredAt, deleted.id, deleted.deletedAt),
      env.DB.prepare('UPDATE household_members SET active = 1, inactive_at = NULL WHERE household_id = ? AND active = 0 AND inactive_at = ?').bind(deleted.id, deleted.deletedAt),
    ])
  } catch (error) {
    if (String(error?.message || '').includes('idx_household_members_one_active_user')) return json({ error: '恢复失败：账号已加入其他家庭' }, 409)
    throw error
  }
  return json({ household: await findHouseholdForPrincipal(env, principal) })
}
