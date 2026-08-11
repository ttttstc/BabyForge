import { json, requireSession } from '../_shared/auth.js'
import { accessibleBaby } from '../_shared/care.js'

const DEFAULT_ACTORS = [
  ['parent-mother', '妈妈', 'parent-mother'],
  ['parent-father', '爸爸', 'parent-father'],
  ['nanny', '月嫂', 'nanny'],
  ['grandparent', '家人', 'grandparent'],
]

function actorFromRow(row) {
  return { id: row.id, displayName: row.display_name, presetId: row.preset_id || null, active: Boolean(row.active) }
}

async function ensureDefaults(env, householdId) {
  const now = new Date().toISOString()
  await env.DB.batch(DEFAULT_ACTORS.map(([id, name, preset]) => env.DB.prepare(`
    INSERT OR IGNORE INTO care_actors (id, household_id, display_name, preset_id, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `).bind(`${householdId}:${id}`, householdId, name, preset, now, now)))
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  const babyId = new URL(request.url).searchParams.get('babyId')
  if (!babyId) return json({ actors: [] })
  const baby = await accessibleBaby(env, auth.session, babyId)
  if (!baby || baby.status === 'detached') return json({ error: '无权访问该宝宝档案' }, 403)
  if (auth.session.role !== 'guest') await ensureDefaults(env, baby.householdId)
  const rows = await env.DB.prepare('SELECT id, display_name, preset_id, active FROM care_actors WHERE household_id = ? AND active = 1 ORDER BY created_at, display_name').bind(baby.householdId).all()
  return json({ actors: (rows.results || []).map(actorFromRow) })
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  if (auth.session.role === 'guest') return json({ error: '游客账号只读，不能写入' }, 403)
  let body
  try { body = await request.json() } catch { return json({ error: '请求格式不正确' }, 400) }
  const baby = await accessibleBaby(env, auth.session, body?.babyId)
  if (!baby || baby.status === 'detached') return json({ error: '无权访问该宝宝档案' }, 403)
  const displayName = String(body?.actor?.displayName || '').trim()
  if (!displayName || displayName.length > 30) return json({ error: '记录人名称不正确' }, 422)
  const requestedId = String(body?.actor?.id || globalThis.crypto?.randomUUID?.() || `recorder-${Date.now()}`)
  const id = requestedId.startsWith(`${baby.householdId}:`) ? requestedId : `${baby.householdId}:${requestedId}`
  const duplicate = await env.DB.prepare('SELECT id FROM care_actors WHERE household_id = ? AND display_name = ? AND id != ? AND active = 1').bind(baby.householdId, displayName, id).first()
  if (duplicate) return json({ error: '记录人名称已存在' }, 409)
  const now = new Date().toISOString()
  await env.DB.prepare(`
    INSERT INTO care_actors (id, household_id, display_name, preset_id, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, active = 1, updated_at = excluded.updated_at
  `).bind(id, baby.householdId, displayName, body?.actor?.presetId || null, now, now).run()
  const row = await env.DB.prepare('SELECT id, display_name, preset_id, active FROM care_actors WHERE id = ?').bind(id).first()
  return json({ actor: actorFromRow(row) }, 201)
}
