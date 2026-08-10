import { getBetterAuthSession } from '../_shared/betterAuth.js'
import { json } from '../_shared/auth.js'
import { findHouseholdForPrincipal, getPrincipal } from '../_shared/principal.js'

export async function onRequestGet({ request, env }) {
  const current = await getBetterAuthSession(request, env)
  if (!current?.user) return json({ error: '未登录或登录已过期' }, 401)
  if (!current.user.emailVerified) return json({ error: '请先验证邮箱', code: 'EMAIL_NOT_VERIFIED' }, 403)
  const principal = await getPrincipal(request, env, { allowLegacy: false })
  if (principal.response) return principal.response
  const user = current.user
  return json({
    user: {
      id: user.id,
      email: user.email,
      emailVerified: Boolean(user.emailVerified),
      username: user.username || null,
      displayName: user.name || user.username || user.email,
      avatar: user.image || null,
    },
    household: await findHouseholdForPrincipal(env, principal),
  })
}

export async function onRequestPatch({ request, env }) {
  const current = await getBetterAuthSession(request, env)
  if (!current?.user) return json({ error: '未登录或登录已过期' }, 401)
  if (!current.user.emailVerified) return json({ error: '请先验证邮箱', code: 'EMAIL_NOT_VERIFIED' }, 403)
  let body
  try { body = await request.json() } catch { return json({ error: '请求格式不正确' }, 400) }
  const username = String(body?.username || '').trim().toLowerCase()
  if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username)) return json({ error: '用户名需为 3–30 位字母、数字、下划线或点' }, 400)
  const conflict = await env.DB.prepare('SELECT id FROM "user" WHERE username = ? AND id <> ?').bind(username, current.user.id).first()
  if (conflict) return json({ error: '用户名已被使用' }, 409)
  await env.DB.prepare('UPDATE "user" SET username = ?, displayUsername = ?, updatedAt = ? WHERE id = ?').bind(username, username, new Date().toISOString(), current.user.id).run()
  return json({ user: { id: current.user.id, email: current.user.email, emailVerified: true, username, displayName: current.user.name || username, avatar: current.user.image || null } })
}
