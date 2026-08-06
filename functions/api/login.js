import { createSession, findAccount, json, samePassword } from '../_shared/auth.js'

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: '请求格式不正确' }, 400)
  }
  const account = await findAccount(env, body.username)
  if (!account || !(await samePassword(body.password, account))) return json({ error: '账号或密码不正确' }, 401)
  const session = await createSession(env, account)
  const babies = await env.DB.prepare(`
    SELECT b.id, b.nickname, b.birth_date AS birthDate, b.gestational_weeks AS gestationalWeeks, b.gestational_days AS gestationalDays, b.growth_age_basis AS growthAgeBasis, b.birth_multiplicity AS birthMultiplicity, b.sex, b.feeding_mode AS feedingMode, b.locale
    FROM baby_profiles b JOIN household_members m ON m.household_id = b.household_id
    WHERE m.account_id = ? AND m.active = 1
    ORDER BY b.updated_at DESC
  `).bind(account.id).all()
  return json({ username: account.username, role: account.role, displayName: account.display_name, expiresAt: session.expiresAt, babies: babies.results || [] }, 200, { 'set-cookie': session.cookie })
}
