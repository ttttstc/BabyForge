import { eventFromRow } from '../_shared/care.js'
import { getShowcaseSession } from '../_shared/demoShowcase.js'
import { json } from '../_shared/auth.js'

const SHOWCASE_COLLECTIONS = new Set(['growthMeasurements', 'milestoneRecords'])
const SHOWCASE_CATEGORIES = ['breastfeeding', 'bottle_feeding', 'sleep', 'diaper']

function monthOnly(value) {
  const month = /^\d{4}-\d{2}/.exec(String(value || ''))?.[0]
  return month ? `${month}-01` : ''
}

function parseRecord(row) {
  try { return JSON.parse(row.payload_json) } catch { return null }
}

export async function onRequestGet({ request, env }) {
  const session = await getShowcaseSession(request, env)
  if (!session) return json({ error: '演示登录已过期' }, 401, { 'cache-control': 'no-store' })
  const baby = await env.DB.prepare(`
    SELECT id, nickname, birth_date, gestational_weeks, gestational_days,
      growth_age_basis, birth_multiplicity, sex, feeding_mode, locale
    FROM baby_profiles
    WHERE id = ?
  `).bind(session.babyId).first()
  if (!baby) return json({ error: '演示资料不存在' }, 404, { 'cache-control': 'no-store' })

  const [records, events] = await Promise.all([
    env.DB.prepare(`
      SELECT collection, payload_json
      FROM workspace_records
      WHERE baby_id = ? AND collection IN ('growthMeasurements', 'milestoneRecords')
      ORDER BY updated_at
    `).bind(session.babyId).all(),
    env.DB.prepare(`
      SELECT * FROM care_events
      WHERE baby_id = ? AND status = 'active'
        AND category IN (?, ?, ?, ?)
      ORDER BY occurred_at DESC
      LIMIT 200
    `).bind(session.babyId, ...SHOWCASE_CATEGORIES).all(),
  ])
  const state = {
    baby: {
      id: baby.id,
      nickname: baby.nickname,
      birthDate: monthOnly(baby.birth_date),
      gestationalWeeks: Number(baby.gestational_weeks) || 0,
      gestationalDays: Number(baby.gestational_days) || 0,
      growthAgeBasis: baby.growth_age_basis,
      birthMultiplicity: baby.birth_multiplicity,
      sex: baby.sex,
      feedingMode: baby.feeding_mode,
      locale: baby.locale || 'zh-CN',
      birthDatePrecision: 'month',
    },
    observations: [], questions: [], taskLogs: [], adminTaskRecords: [],
    growthMeasurements: [], milestoneRecords: [],
    careEvents: (events.results || []).reverse().map((row) => ({
      ...eventFromRow(row),
      actor: { id: 'caregiver', displayName: '家长' },
    })),
  }
  for (const row of records.results || []) {
    if (!SHOWCASE_COLLECTIONS.has(row.collection)) continue
    const value = parseRecord(row)
    if (value) state[row.collection].push(value)
  }
  return json({ ...state, readOnly: true }, 200, { 'cache-control': 'private, no-store' })
}
