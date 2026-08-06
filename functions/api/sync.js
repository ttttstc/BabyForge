import { json, requireSession } from '../_shared/auth.js'

const COLLECTIONS = ['observations', 'taskLogs', 'adminTaskRecords', 'growthMeasurements', 'milestoneRecords']

function recordId(collection, value, index) {
  if (collection === 'questions') return 'questions'
  return String(value?.id || `${collection}-${index}`)
}

function parseRecord(row) {
  try {
    return JSON.parse(row.payload_json)
  } catch {
    return null
  }
}

async function accessibleBaby(env, accountId, babyId) {
  return env.DB.prepare(`
    SELECT b.id, b.household_id AS householdId, b.nickname, b.birth_date AS birthDate, b.gestational_weeks AS gestationalWeeks, b.gestational_days AS gestationalDays, b.growth_age_basis AS growthAgeBasis, b.birth_multiplicity AS birthMultiplicity, b.sex, b.feeding_mode AS feedingMode, b.locale
    FROM baby_profiles b JOIN household_members m ON m.household_id = b.household_id
    WHERE b.id = ? AND m.account_id = ? AND m.active = 1
  `).bind(babyId, accountId).first()
}

async function loadWorkspace(env, accountId, babyId) {
  const baby = await accessibleBaby(env, accountId, babyId)
  if (!baby) return null
  const rows = await env.DB.prepare('SELECT collection, record_id, payload_json FROM workspace_records WHERE baby_id = ? ORDER BY updated_at').bind(baby.id).all()
  const state = { baby, observations: [], questions: [], taskLogs: [], adminTaskRecords: [], growthMeasurements: [], milestoneRecords: [] }
  for (const row of rows.results || []) {
    const value = parseRecord(row)
    if (row.collection === 'questions') state.questions = Array.isArray(value) ? value : []
    else if (COLLECTIONS.includes(row.collection) && value) state[row.collection].push(value)
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
  const gestationalDays = Number.isInteger(Number(baby.gestationalDays)) && Number(baby.gestationalDays) >= 0 && Number(baby.gestationalDays) <= 6 ? Number(baby.gestationalDays) : 0
  const growthAgeBasis = ['chronological', 'corrected', 'postmenstrual'].includes(baby.growthAgeBasis) ? baby.growthAgeBasis : 'chronological'
  const birthMultiplicity = baby.birthMultiplicity === 'multiple' ? 'multiple' : 'singleton'
  await env.DB.prepare(`
    INSERT INTO baby_profiles (id, household_id, nickname, birth_date, gestational_weeks, gestational_days, growth_age_basis, birth_multiplicity, sex, feeding_mode, locale, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET nickname=excluded.nickname, birth_date=excluded.birth_date, gestational_weeks=excluded.gestational_weeks, gestational_days=excluded.gestational_days, growth_age_basis=excluded.growth_age_basis, birth_multiplicity=excluded.birth_multiplicity, sex=excluded.sex, feeding_mode=excluded.feeding_mode, locale=excluded.locale, updated_at=excluded.updated_at, updated_by=excluded.updated_by
  `).bind(baby.id, householdId, baby.nickname, baby.birthDate, Number(baby.gestationalWeeks) || 0, gestationalDays, growthAgeBasis, birthMultiplicity, baby.sex || null, baby.feedingMode || null, baby.locale || 'zh-CN', now, auth.session.accountId).run()

  const records = []
  const deletions = []
  for (const collection of COLLECTIONS) {
    if (!Array.isArray(body[collection])) continue
    const values = body[collection]
    const ids = values.map((value, index) => recordId(collection, value, index))
    const placeholders = ids.map(() => '?').join(', ')
    deletions.push(env.DB.prepare(ids.length
      ? `DELETE FROM workspace_records WHERE baby_id = ? AND collection = ? AND record_id NOT IN (${placeholders})`
      : 'DELETE FROM workspace_records WHERE baby_id = ? AND collection = ?').bind(...(ids.length ? [baby.id, collection, ...ids] : [baby.id, collection])))
    values.forEach((value, index) => records.push([baby.id, collection, recordId(collection, value, index), JSON.stringify(value), value?.updatedAt || value?.createdAt || now, auth.session.accountId]))
  }
  const questions = Array.isArray(body.questions) ? body.questions : []
  deletions.push(env.DB.prepare('DELETE FROM workspace_records WHERE baby_id = ? AND collection = ? AND record_id != ?').bind(baby.id, 'questions', 'questions'))
  records.push([baby.id, 'questions', 'questions', JSON.stringify(questions), now, auth.session.accountId])
  if (records.length || deletions.length) {
    await env.DB.batch([...deletions, ...records.map((record) => env.DB.prepare(`
      INSERT INTO workspace_records (baby_id, collection, record_id, payload_json, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(baby_id, collection, record_id) DO UPDATE SET payload_json=excluded.payload_json, updated_at=excluded.updated_at, updated_by=excluded.updated_by
      WHERE excluded.updated_at >= workspace_records.updated_at
    `).bind(...record))])
  }
  const state = await loadWorkspace(env, auth.session.accountId, baby.id)
  return json(state)
}
