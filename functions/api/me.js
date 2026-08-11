import { getBetterAuthSession } from '../_shared/betterAuth.js'
import { json } from '../_shared/auth.js'
import { findHouseholdForPrincipal, getPrincipal } from '../_shared/principal.js'

export function normalizeNickname(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export function nicknamePolicyError(value) {
  const nickname = normalizeNickname(value)
  const characters = [...nickname]
  const hasControlCharacter = characters.some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  return !characters.length || characters.length > 30 || hasControlCharacter ? '昵称需为 1–30 个常用字符' : null
}

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
      nickname: user.name || '家长',
      displayName: user.name || '家长',
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
  const nickname = normalizeNickname(body?.nickname)
  const policyError = nicknamePolicyError(nickname)
  if (policyError) return json({ error: policyError }, 400)
  await env.DB.prepare('UPDATE "user" SET name = ?, updatedAt = ? WHERE id = ?').bind(nickname, new Date().toISOString(), current.user.id).run()
  return json({ user: { id: current.user.id, email: current.user.email, emailVerified: true, nickname, displayName: nickname, avatar: current.user.image || null } })
}
