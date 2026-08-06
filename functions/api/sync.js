import { json, requireSession } from '../_shared/auth.js'

function parseRecord(row) {
  try {
    return JSON.parse(row.payload_json)
  } catch {
    return null
  }
}

async function accessibleBaby(env, accountId, babyId) {
  return env.DB.prepare(`
    SELECT b.id, b.household_id AS householdId, b.nickname, b.birth_date AS birthDate, b.gestational_weeks AS gestationalWeeks, b.sex, b.feeding_mode AS feedingMode, b.locale
    FROM baby_profiles b JOIN household_members m ON m.household_id = b.household_id
    WHERE b.id = ? AND m.account_id = ? AND m.active = 1
  `).bind(babyId, accountId).first()
}

async function loadWorkspace(env, accountId, babyId) {
  const baby = await accessibleBaby(env, accountId, babyId)
  if (!baby) return null
  const rows = await env.DB.prepare('SELECT collection, record_id, payload_json FROM workspace_records WHERE baby_id = ? ORDER BY updated_at').bind(baby.id).all()
  const state = { baby, questions: [] }
  for (const row of rows.results || []) {
    const value = parseRecord(row)
    if (row.collection === 'questions') state.questions = Array.isArray(value) ? value : []
  }
  return state
}

async function ensureHousehold(env, session, baby) {
  const existing = await accessibleBaby(env, session.accountId, baby.id)
  if (existing) return existing.householdId
  const claimed = await env.DB.prepare('SELECT id, household_id AS householdId FROM baby_profiles WHERE id = ?').bind(baby.id).first()
  if (claimed) throw new Error('该宝宝档案已属于其他家庭')
  const householdId = `household-${session.accountId}`
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO households (id, name, owner_account_id) VALUES (?, ?, ?)').bind(householdId, `${baby.nickname} 的家庭`, session.accountId),
    env.DB.prepare('INSERT OR IGNORE INTO household_members (household_id, account_id, role) VALUES (?, ?, ?)').bind(householdId, session.accountId, 'owner'),
    env.DB.prepare('INSERT OR IGNORE INTO household_members (household_id, account_id, role) SELECT ?, id, ? FROM accounts WHERE username = ?').bind(householdId, 'guest', 'baby'),
  ])
  return householdId
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  const babyId = new URL(request.url).searchParams.get('babyId')
  if (!babyId) return json({ baby: null })
  const state = await loadWorkspace(env, auth.session.accountId, babyId)
  return state ? json(state) : json({ error: '无权访问该宝宝档案' }, 403)
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  if (auth.session.role === 'guest') return json({ error: '游客账号只读，不能写入' }, 403)
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: '请求格式不正确' }, 400)
  }
  const baby = body?.baby
  if (!baby?.id || !baby.nickname || !baby.birthDate) return json({ error: '宝宝档案字段不完整' }, 422)
  let householdId
  try {
    householdId = await ensureHousehold(env, auth.session, baby)
  } catch (error) {
    return json({ error: error.message }, 403)
  }
  const now = new Date().toISOString()
  await env.DB.prepare(`
    INSERT INTO baby_profiles (id, household_id, nickname, birth_date, gestational_weeks, sex, feeding_mode, locale, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET nickname=excluded.nickname, birth_date=excluded.birth_date, gestational_weeks=excluded.gestational_weeks, sex=excluded.sex, feeding_mode=excluded.feeding_mode, locale=excluded.locale, updated_at=excluded.updated_at, updated_by=excluded.updated_by
  `).bind(baby.id, householdId, baby.nickname, baby.birthDate, Number(baby.gestationalWeeks) || 0, baby.sex || null, baby.feedingMode || null, baby.locale || 'zh-CN', now, auth.session.accountId).run()

  const records = [[baby.id, 'questions', 'questions', JSON.stringify(Array.isArray(body.questions) ? body.questions : []), now, auth.session.accountId]]
  if (records.length) {
    await env.DB.batch(records.map((record) => env.DB.prepare(`
      INSERT INTO workspace_records (baby_id, collection, record_id, payload_json, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(baby_id, collection, record_id) DO UPDATE SET payload_json=excluded.payload_json, updated_at=excluded.updated_at, updated_by=excluded.updated_by
      WHERE excluded.updated_at >= workspace_records.updated_at
    `).bind(...record)))
  }
  const state = await loadWorkspace(env, auth.session.accountId, baby.id)
  return json(state)
}
