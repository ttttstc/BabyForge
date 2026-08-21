import { getBetterAuth, getBetterAuthSession, passwordPolicyError, requiresPasswordSetup } from '../../_shared/betterAuth.js'
import { json } from '../../_shared/auth.js'

export async function onRequestPost({ request, env }) {
  const current = await getBetterAuthSession(request, env)
  if (!current?.user) return json({ error: '未登录或登录已过期' }, 401)
  if (!current.user.emailVerified) return json({ error: '请先验证邮箱', code: 'EMAIL_NOT_VERIFIED' }, 403)

  let body
  try { body = await request.json() } catch { return json({ error: '请求格式不正确' }, 400) }
  const newPassword = String(body?.newPassword || '')
  const policyError = passwordPolicyError(newPassword)
  if (policyError) return json({ error: policyError }, 400)
  if (!(await requiresPasswordSetup(env, current.user.id))) return json({ error: '该账号已经设置密码', code: 'PASSWORD_ALREADY_SET' }, 409)

  try {
    await getBetterAuth(env).api.setPassword({ body: { newPassword }, headers: request.headers })
    return json({ status: true, requiresPasswordSetup: false })
  } catch (error) {
    const status = Number(error?.statusCode || error?.status || 400)
    return json({ error: error?.body?.message || error?.message || '密码设置失败' }, status >= 400 && status < 600 ? status : 400)
  }
}
