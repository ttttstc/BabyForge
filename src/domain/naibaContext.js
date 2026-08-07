import { getAgeDays, getStage } from './baby.js'
import { projectBabyState } from './babyState.js'
import { eventTitle } from './careSummary.js'

const DAY_MS = 86_400_000

function asTime(value) {
  const time = new Date(value || 0).getTime()
  return Number.isFinite(time) ? time : 0
}

function coverageLabel(snapshot) {
  const ratios = ['feeding', 'elimination'].map((key) => snapshot.baseline?.[key]?.coverage?.ratio || 0)
  const ratio = Math.max(...ratios, 0)
  if (ratio >= 0.7) return 'high'
  if (ratio >= 0.4) return 'medium'
  if (ratio > 0) return 'low'
  return 'none'
}

function factValue(fact) {
  if (fact?.value && typeof fact.value === 'object') return JSON.stringify(fact.value)
  return String(fact?.value ?? fact?.status ?? '')
}

export function buildBabyContextSummary({ baby, events = [], concerns = [], carePlanItems = [], now = new Date() } = {}) {
  const ageDays = baby?.birthDate ? getAgeDays(baby.birthDate, now) : null
  const ageMonths = Number.isFinite(ageDays) ? Math.max(0, Math.floor(ageDays / 30.4375)) : null
  const stage = Number.isFinite(ageDays) ? getStage(ageDays) : null
  const snapshot = projectBabyState({ baby, events, concerns, now })
  const activeEvents = events.filter((event) => event?.status === 'active')
  const recentCutoff = asTime(now) - 72 * 60 * 60 * 1000
  const recentEvents = activeEvents.filter((event) => asTime(event.occurredAt || event.recordedAt) >= recentCutoff)
    .sort((a, b) => asTime(b.occurredAt || b.recordedAt) - asTime(a.occurredAt || a.recordedAt))
    .slice(0, 12)
  const recentKeyFacts = recentEvents.map((event) => ({
    fact: eventTitle(event, baby?.locale || 'zh-CN'),
    occurredAt: event.occurredAt,
    sourceEventIds: [event.id],
    reliability: event.kind === 'professional_conclusion' ? 'professional' : event.kind === 'measurement' ? 'measured' : 'caregiver',
  }))
  const professionalPlans = activeEvents.filter((event) => event.kind === 'professional_conclusion' || event.category === 'doctor_instruction')
    .map((event) => ({ id: event.id, text: String(event.payload?.conclusion || event.payload?.instruction || event.payload?.note || eventTitle(event)), sourceEventIds: [event.id] }))
  for (const item of carePlanItems.filter((entry) => entry?.status !== 'done' && entry?.status !== 'cancelled')) {
    professionalPlans.push({ id: item.id, text: String(item.title || item.action || item.note || '照护安排'), sourceEventIds: item.sourceEventIds || [] })
  }
  const missingCriticalFacts = []
  if (!baby?.birthDate) missingCriticalFacts.push('birthDate')
  if (!baby?.feedingMode) missingCriticalFacts.push('feedingMode')
  if (snapshot.current?.conflicts?.length) missingCriticalFacts.push('conflictingCurrentFacts')
  const recentEventCount = activeEvents.filter((event) => asTime(event.occurredAt || event.recordedAt) >= asTime(now) - DAY_MS).length
  if (!recentEventCount) missingCriticalFacts.push('recentCareEvents')

  return {
    profile: {
      babyId: baby?.id || null,
      birthDate: baby?.birthDate || null,
      ageDays,
      ageMonths,
      sex: baby?.sex || null,
      gestationalAgeAtBirth: Number.isFinite(Number(baby?.gestationalWeeks)) ? `${baby.gestationalWeeks}+${baby.gestationalDays || 0}` : null,
      correctedAge: baby?.correctedAge || null,
      birthWeight: baby?.birthWeight ?? null,
      highRiskBackground: Array.isArray(baby?.highRiskBackground) ? baby.highRiskBackground : [],
    },
    currentStage: {
      stageId: stage?.id || snapshot.stage?.stageId || null,
      stageLabel: stage?.label || snapshot.stage?.label || null,
      supportedKnowledgePack: 'knowledge-pack-2026-08-07',
    },
    baseline: {
      feeding: snapshot.baseline?.feeding || null,
      elimination: snapshot.baseline?.elimination || null,
      coverage: coverageLabel(snapshot),
    },
    recentKeyFacts,
    currentSignals: (snapshot.current?.known || []).map((fact) => ({ key: fact.stateKey, value: factValue(fact), occurredAt: fact.occurredAt, sourceEventIds: fact.sourceEventIds || [] })),
    activeConcerns: (snapshot.activeProblems || []).map((problem) => ({ id: problem.id, label: problem.title || problem.category || problem.id, sourceEventIds: problem.sourceEventIds || [] })),
    professionalPlans,
    missingCriticalFacts,
    conflicts: snapshot.current?.conflicts || [],
    sourceEventIds: [...new Set(recentKeyFacts.flatMap((fact) => fact.sourceEventIds))],
    generatedAt: new Date(now).toISOString(),
  }
}
