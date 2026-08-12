import { createSession, json } from '../_shared/auth.js'
import { getAdminPreset, safeEqual } from '../_shared/presetAccounts.js'

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: '请求格式不正确' }, 400)
  }
  const preset = getAdminPreset(env)
  if (!preset
    || String(body.username || '').trim().toLowerCase() !== String(preset.username).trim().toLowerCase()
    || !(await safeEqual(body.password, preset.password))) {
    return json({ error: '账号或密码不正确' }, 401)
  }
  const account = await env.DB.prepare(`
    SELECT id, username, role, display_name
    FROM accounts
    WHERE id = ? AND active = 1
  `).bind(preset.accountId).first()
  if (!account) return json({ error: '管理员账号配置不可用' }, 503)
  const session = await createSession(env, account)
  const babies = await env.DB.prepare(`
    SELECT b.id, b.nickname, b.birth_date AS birthDate, b.gestational_weeks AS gestationalWeeks, b.gestational_days AS gestationalDays, b.growth_age_basis AS growthAgeBasis, b.birth_multiplicity AS birthMultiplicity, b.sex, b.feeding_mode AS feedingMode, b.locale
    FROM baby_profiles b JOIN household_members m ON m.household_id = b.household_id
    JOIN households h ON h.id = b.household_id
    WHERE m.account_id = ? AND m.active = 1 AND h.deleted_at IS NULL
    ORDER BY b.updated_at DESC
  `).bind(account.id).all()
  return json({ username: account.username, role: account.role, displayName: account.display_name, expiresAt: session.expiresAt, babies: babies.results || [] }, 200, { 'set-cookie': session.cookie })
}
