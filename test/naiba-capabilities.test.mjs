import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBabyContextSummary } from '../src/domain/naibaContext.js'
import { buildCaregiverHandoff, buildDailyGrowthPlan, buildDetailedCareAnalysis, buildGrowthInterpretation, buildVisitBrief, executeNaibaSkill, parseMedicalReportText } from '../src/domain/naibaCapabilities.js'
import { createCareEvent, DEFAULT_RECORDERS } from '../src/domain/careEvents.js'
import { NAIBA_SKILLS } from '../src/domain/naibaSkills.js'

const now = new Date('2026-08-07T12:00:00.000Z')
const baby = { id: 'baby-1', nickname: '泥娃', birthDate: '2026-08-01', feedingMode: 'formula', gestationalWeeks: 39, gestationalDays: 2 }
const actor = DEFAULT_RECORDERS[0]

function event(category, occurredAt, payload = {}, kind = 'caregiver_observation') {
  return createCareEvent({ babyId: baby.id, category, kind, occurredAt, recordedAt: occurredAt, actor, source: 'caregiver', payload }, { now: occurredAt })
}

const events = [
  event('bottle_feeding', '2026-08-07T08:00:00.000Z', { amountMl: 50 }),
  event('diaper', '2026-08-07T09:00:00.000Z', { kind: 'urine' }),
]

test('BabyContextSummary keeps formal facts, coverage, provenance, and missing facts explicit', () => {
  const context = buildBabyContextSummary({ baby, events, now })
  assert.equal(context.profile.ageDays, 6)
  assert.equal(context.profile.babyId, baby.id)
  assert.equal(context.recentKeyFacts.length, 2)
  assert.ok(context.sourceEventIds.every(Boolean))
  assert.ok(['none', 'low', 'medium', 'high'].includes(context.baseline.coverage))
})

test('detailed analysis and growth plan never fabricate missing trends', () => {
  const analysis = buildDetailedCareAnalysis({ baby, events, now })
  assert.match(analysis.trend, /没有足够可靠|基线/)
  assert.ok(analysis.actions.length <= 3)
  const plan = buildDailyGrowthPlan({ baby, events, now })
  assert.ok(plan.plans.length > 0 && plan.plans.length <= 3)
  assert.ok(plan.plans.every((item) => item.reason && item.action && item.completion))
})

test('growth interpretation recomputes current facts and withholds conflict deltas', () => {
  const result = buildGrowthInterpretation({
    baby: { ...baby, sex: 'male' },
    metric: 'weight',
    measurements: [
      { id: 'old-weight', type: 'weight', value: 3.2, unit: 'kg', measuredAt: '2026-08-05', status: 'active' },
      { id: 'replacement-weight', type: 'weight', value: 3.5, unit: 'kg', measuredAt: '2026-08-06', status: 'active', correctedFromId: 'old-weight' },
      { id: 'conflict-a', type: 'weight', value: 3.6, unit: 'kg', measuredAt: '2026-08-07', status: 'active' },
      { id: 'conflict-b', type: 'weight', value: 3.8, unit: 'kg', measuredAt: '2026-08-07', status: 'active' },
    ],
    now,
  })
  assert.equal(result.status, 'conflicted')
  assert.equal(result.latest.conflicted, true)
  assert.equal(result.delta, null)
  assert.deepEqual(result.measurements.map((item) => item.id), ['conflict-a', 'conflict-b', 'replacement-weight'])
  assert.match(result.summary, /核对/)
})

test('report parser preserves uncertainty and only extracts checkable fields', () => {
  const report = parseMedicalReportText('血红蛋白 135 g/L 参考范围: 110-160\n备注：宝宝哭闹', { name: '血常规.txt', now })
  assert.equal(report.status, 'draft_ready')
  assert.equal(report.fields[0].name, '血红蛋白')
  assert.equal(report.fields[0].value, '135')
  assert.equal(report.fields[0].unit, 'g/L')
})

test('report parser drops an implausible temperature instead of saving it as a fact', () => {
  const report = parseMedicalReportText('体温 99.9 ℃', { name: '体温.txt', now })
  assert.equal(report.status, 'needs_information')
  assert.equal(report.fields.length, 0)
  assert.match(report.uncertainties.join(' '), /超出可核对范围/)
})

test('baby context caps active professional plans before model context is built', () => {
  const carePlanItems = Array.from({ length: 20 }, (_, index) => ({ id: `plan-${index}`, title: `计划 ${index}`, status: 'pending', updatedAt: `2026-08-${String(index + 1).padStart(2, '0')}T00:00:00.000Z` }))
  const context = buildBabyContextSummary({ baby, events, carePlanItems, now })
  assert.equal(context.professionalPlans.length, 10)
})

test('visit brief and handoff keep facts, arrangements, and system notes separated', () => {
  const brief = buildVisitBrief({ baby, events, questions: ['需要复查吗？'], now })
  assert.equal(brief.questions[0], '需要复查吗？')
  assert.ok(brief.facts.length)
  const handoff = buildCaregiverHandoff({ baby, events, now })
  assert.ok(handoff.facts.length)
  assert.ok(Array.isArray(handoff.arrangements))
  assert.ok(Array.isArray(handoff.systemNotes))
})

test('all thirteen approved skills have executable deterministic paths', () => {
  for (const skill of NAIBA_SKILLS) {
    const result = executeNaibaSkill(skill.id, { message: '记录亲喂', query: '黄疸', text: '体温 37.2 ℃', unitId: 'general_health_preassessment', facts: {} }, { baby, events, actor, now, questions: [] })
    assert.notEqual(result?.reason, 'unknown_skill', skill.id)
  }
})
