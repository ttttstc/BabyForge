import { handleBetterAuthRequest, passwordPolicyError } from '../../_shared/betterAuth.js'
import { json } from '../../_shared/auth.js'

async function validatePasswordBody(request) {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, '')
  if (request.method !== 'POST' || !['/sign-up/email', '/reset-password', '/change-password'].includes(path)) return null
  let body
  try {
    body = await request.clone().json()
  } catch {
    return null
  }
  const password = body?.password || body?.newPassword
  const error = passwordPolicyError(password)
  return error ? json({ error: { message: error, code: 'INVALID_PASSWORD' } }, 400) : null
}
export async function onRequest({ request, env }) {
  const validation = await validatePasswordBody(request)
  if (validation) return validation
  try {
    return await handleBetterAuthRequest(request, env)
  } catch (error) {
    console.error('[BabyForge] Better Auth request failed', error?.message || error)
    return json({ error: '认证服务暂时不可用' }, 503)
  }
}
