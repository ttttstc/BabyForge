import { json } from '../_shared/auth.js'
import { authenticateDemo } from '../_shared/presetAccounts.js'

export async function onRequestPost({ request, env }) {
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: '请求格式不正确' }, 400)
  }
  const demo = await authenticateDemo(env, body.username, body.password)
  if (!demo) return json({ error: '账号或密码不正确' }, 401, { 'cache-control': 'no-store' })
  return json({ demo }, 200, { 'cache-control': 'no-store' })
}
