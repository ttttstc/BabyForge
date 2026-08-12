import { json } from '../_shared/auth.js'
import { createShowcaseSession } from '../_shared/demoShowcase.js'
import { authenticateDemo, getAdminPreset } from '../_shared/presetAccounts.js'

export async function onRequestPost({ request, env }) {
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: '请求格式不正确' }, 400)
  }
  const demo = await authenticateDemo(env, body.username, body.password)
  if (!demo) return json({ error: '账号或密码不正确' }, 401, { 'cache-control': 'no-store' })
  if (demo.variant === 'niwa') {
    const preset = getAdminPreset(env)
    if (!env.DB || !preset?.babyId) return json({ error: '演示资料暂不可用' }, 503, { 'cache-control': 'no-store' })
    const baby = await env.DB.prepare("SELECT id FROM baby_profiles WHERE id = ? AND COALESCE(status, 'active') <> 'detached'").bind(preset.babyId).first()
    if (!baby) return json({ error: '演示资料暂不可用' }, 503, { 'cache-control': 'no-store' })
    const session = await createShowcaseSession(env, baby.id, request)
    return json({ demo: { ...demo, showcase: true }, expiresAt: session.expiresAt }, 200, {
      'cache-control': 'no-store',
      'set-cookie': session.cookie,
    })
  }
  return json({ demo }, 200, { 'cache-control': 'no-store' })
}
