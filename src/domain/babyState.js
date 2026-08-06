import { getAgeDays, getStage } from './baby.js'

export const BASELINE_WINDOW_DAYS = 7
export const MINIMUM_BASELINE_DAYS = 3
export const SHORT_TERM_TTL_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000
const CURRENT_DIMENSIONS = ['feeding', 'elimination', 'temperature', 'sleep', 'alertness', 'illness', 'medication', 'growth']

const PROFILE_FIELDS = [
  { key: 'nickname', label: '宝宝昵称' },
  { key: 'birthDate', label: '出生日期' },
  { key: 'gestationalWeeks', label: '出生孕周' },
  { key: 'gestationalDays', label: '孕周余天' },
  { key: 'birthMultiplicity', label: '出生情况' },
  { key: 'sex', label: '性别' },
  { key: 'feedingMode', label: '喂养方式' },
  { key: 'growthAgeBasis', label: '成长年龄口径' },
  { key: 'medicalHistory', label: '既往史' },
  { key: 'allergies', label: '过敏信息' },
  { key: 'longTermMedications', label: '长期用药' },
]

function asTime(value) {
  const time = new Date(value || 0).getTime()
  return Number.isFinite(time) ? time : 0
}

function dayKey(value) {
  return new Date(value).toISOString().slice(0, 10)
}

function startOfDay(value) {
  const date = new Date(value)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function clone(value) {
  if (value === undefined) return null
  try { return JSON.parse(JSON.stringify(value)) } catch { return null }
}

function stableValue(value) {
  if (value === undefined) return null
  if (value && typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function sourceFor(event) {
  const kind = event?.kind
  return {
    type: kind === 'professional_conclusion' ? 'professional-conclusion' : kind === 'measurement' ? 'measurement' : 'caregiver-observation',
    eventId: event?.id || null,
    actor: event?.actor || event?.recordedBy || null,
    eventKind: kind || null,
    category: event?.category || event?.type || null,
  }
}

function confidenceFor(event) {
  if (event?.kind === 'professional_conclusion') return 'professional'
  if (event?.kind === 'measurement') return 'measured'
  return 'caregiver-observed'
}

function stateFact(event, stateKey, value, options = {}) {
  const occurredAt = event.occurredAt || event.createdAt
  const occurredTime = asTime(occurredAt)
  const ttlDays = options.ttlDays === null ? null : Number(options.ttlDays ?? SHORT_TERM_TTL_DAYS)
  return {
    id: `${event.id}:${stateKey}:${options.metric || 'value'}`,
    stateKey,
    dimension: options.dimension || stateKey.split('.')[0],
    metric: options.metric || 'value',
    value: clone(value),
    occurredAt,
    recordedAt: event.recordedAt || event.updatedAt || event.createdAt,
    validUntil: ttlDays === null ? null : new Date(occurredTime + ttlDays * DAY_MS).toISOString(),
    confidence: confidenceFor(event),
    kind: event.kind || null,
    category: event.category || event.type || null,
    source: sourceFor(event),
    sourceEventIds: [event.id],
    actorId: event.actor?.id || event.recordedBy?.id || null,
    actorName: event.actor?.displayName || event.recordedBy?.displayName || null,
  }
}

function eventFacts(event) {
  if (!event?.id || event.status !== 'active') return []
  const occurredAt = event.occurredAt || event.createdAt
  if (!occurredAt || !asTime(occurredAt)) return []
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {}
  const category = event.category || event.type
  const facts = []

  if (category === 'breastfeeding' || category === 'bottle_feeding') {
    facts.push(stateFact(event, 'feeding.count', { mode: category, amountMl: payload.amountMl ?? null }, { dimension: 'feeding', metric: 'occurrence' }))
  }
  if (category === 'diaper') {
    facts.push(stateFact(event, 'elimination.count', { kind: payload.kind || 'unknown' }, { dimension: 'elimination', metric: 'occurrence' }))
  }
  if (category === 'temperature' && payload.value !== undefined) {
    facts.push(stateFact(event, 'temperature.reading', { value: payload.value, unit: payload.unit || null }, { dimension: 'temperature', metric: 'reading' }))
  }
  if (category === 'sleep') {
    facts.push(stateFact(event, 'sleep.observation', payload, { dimension: 'sleep', metric: 'signal' }))
  }
  if (payload.feedingChange) {
    facts.push(stateFact(event, 'feeding.change', payload.feedingChange, { dimension: 'feeding', metric: 'signal' }))
  }
  if (payload.alertness) {
    facts.push(stateFact(event, 'alertness.observation', payload.alertness, { dimension: 'alertness', metric: 'signal' }))
  }
  if (payload.eliminationNotes) {
    facts.push(stateFact(event, 'elimination.observation', payload.eliminationNotes, { dimension: 'elimination', metric: 'signal' }))
  }
  if (payload.temperatureValue !== undefined && payload.temperatureValue !== '') {
    facts.push(stateFact(event, 'temperature.reading', { value: payload.temperatureValue, unit: payload.temperatureUnit || null }, { dimension: 'temperature', metric: 'reading' }))
  }
  if (payload.symptoms?.length || payload.symptomNotes) {
    facts.push(stateFact(event, 'illness.observation', { symptoms: payload.symptoms || [], notes: payload.symptomNotes || '' }, { dimension: 'illness', metric: 'signal' }))
  }
  if (category === 'medication') {
    facts.push(stateFact(event, 'medication.event', {
      name: payload.medicationName || payload.name || null,
      amount: payload.amount || null,
      unit: payload.unit || null,
      route: payload.route || null,
      note: payload.note || '',
    }, { dimension: 'medication', metric: 'signal' }))
  }
  if (category === 'growth_measurement' || event.kind === 'measurement' && payload.type) {
    facts.push(stateFact(event, 'growth.measurement', payload, { dimension: 'growth', metric: 'measurement', ttlDays: null }))
  }

  const genericKey = payload.stateKey || payload.dimension
  if (genericKey && !facts.some((fact) => fact.stateKey === genericKey)) {
    facts.push(stateFact(event, String(genericKey), payload.value ?? payload.observation ?? payload.conclusion ?? payload.note ?? payload, {
      dimension: String(genericKey).split('.')[0],
      metric: payload.metric || 'signal',
      ttlDays: payload.validUntil ? null : undefined,
    }))
  }

  if (event.kind === 'professional_conclusion' && facts.length === 0) {
    facts.push(stateFact(event, `professional.${category || 'conclusion'}`, payload.conclusion ?? payload.note ?? payload, {
      dimension: payload.dimension || 'professional',
      metric: 'conclusion',
      ttlDays: payload.validUntil ? null : undefined,
    }))
  }

  return facts
}

function activeEvents(events, now) {
  const replaced = new Set(events.map((event) => event?.correctedFromId).filter(Boolean))
  const nowTime = asTime(now)
  return events
    .filter((event) => event?.status === 'active' && !replaced.has(event.id))
    .filter((event) => asTime(event.occurredAt || event.createdAt) <= nowTime)
}

function historicalEvents(events, now) {
  const nowTime = asTime(now)
  return events.filter((event) => event?.id && asTime(event.occurredAt || event.createdAt) <= nowTime)
}

function projectBackground(baby) {
  const known = []
  const unknown = []
  for (const field of PROFILE_FIELDS) {
    const value = baby?.[field.key]
    const hasValue = value !== undefined && value !== null && String(value).trim() !== ''
    const item = {
      id: `background:${field.key}`,
      key: field.key,
      label: field.label,
      value: hasValue ? clone(value) : null,
      confidence: 'profile-entered',
      source: { type: 'baby-profile', id: baby?.id || null, field: field.key },
      sourceEventIds: [],
      validUntil: null,
    }
    if (hasValue) known.push(item)
    else unknown.push({ ...item, reason: 'not-recorded' })
  }
  return { known, unknown }
}

function priorFor(baby, now) {
  let ageDays = null
  let stage = { id: 'unknown', label: '阶段未知', rangeLabel: '' }
  try {
    ageDays = getAgeDays(baby?.birthDate, new Date(now))
    stage = getStage(ageDays)
  } catch {
    // A missing profile date is represented as unknown, never guessed.
  }
  return {
    type: 'stage-prior',
    stageId: stage.id,
    stageLabel: stage.label,
    ageDays,
    domains: CURRENT_DIMENSIONS,
    limitation: '暂无个人基线；阶段先验只提供上下文，不替代个人记录或专业判断。',
  }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  if (!sorted.length) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function baselineFor(facts, dimension, now, options) {
  const currentDay = dayKey(now)
  const currentStart = startOfDay(now)
  const windowStart = currentStart - options.windowDays * DAY_MS
  const samples = facts.filter((fact) => fact.dimension === dimension && fact.metric === 'occurrence' && asTime(fact.occurredAt) >= windowStart && dayKey(fact.occurredAt) < currentDay)
  const byDay = new Map()
  for (const fact of samples) byDay.set(dayKey(fact.occurredAt), (byDay.get(dayKey(fact.occurredAt)) || 0) + 1)
  const values = [...byDay.values()]
  const observedDays = values.length
  const coverage = { observedDays, windowDays: options.windowDays, ratio: observedDays / options.windowDays }
  const base = {
    dimension,
    status: observedDays >= options.minimumDays ? 'established' : 'missing',
    minimumDays: options.minimumDays,
    windowDays: options.windowDays,
    coverage,
    sourceEventIds: samples.map((fact) => fact.source.eventId),
    value: values.length ? { min: Math.min(...values), max: Math.max(...values), median: median(values), samples: values, days: observedDays } : null,
  }
  if (base.status === 'missing') base.limitation = '样本不足，暂不形成个人基线。'
  return base
}

function todayCount(facts, dimension, now) {
  const current = dayKey(now)
  const matching = facts.filter((fact) => fact.dimension === dimension && fact.metric === 'occurrence' && dayKey(fact.occurredAt) === current)
  return {
    value: matching.length,
    sourceEventIds: matching.map((fact) => fact.source.eventId),
  }
}

function currentSignals(facts, now) {
  const valid = facts.filter((fact) => !fact.validUntil || asTime(fact.validUntil) > asTime(now))
  const conflicts = []
  const signalGroups = new Map()
  for (const fact of valid.filter((item) => item.metric === 'signal' || item.metric === 'reading' || item.metric === 'conclusion')) {
    const key = `${fact.stateKey}:${dayKey(fact.occurredAt)}`
    signalGroups.set(key, [...(signalGroups.get(key) || []), fact])
  }
  for (const [key, group] of signalGroups) {
    const caregiverFacts = group.filter((fact) => fact.kind === 'caregiver_observation')
    const values = new Set(caregiverFacts.map((fact) => stableValue(fact.value)))
    const actors = new Set(caregiverFacts.map((fact) => fact.actorId).filter(Boolean))
    if (values.size > 1 && actors.size > 1) {
      conflicts.push({
        id: `conflict:${key}`,
        stateKey: group[0].stateKey,
        status: 'conflict-pending',
        observedAt: group.map((fact) => fact.occurredAt).sort().at(-1),
        sourceEventIds: caregiverFacts.map((fact) => fact.source.eventId),
        facts: caregiverFacts,
        message: '不同记录人对同一状态的描述不一致，待确认。',
      })
    }
  }

  const latest = new Map()
  for (const fact of valid.filter((item) => item.metric !== 'occurrence')) {
    const current = latest.get(fact.stateKey)
    const rank = fact.confidence === 'professional' ? 3 : fact.confidence === 'measured' ? 2 : 1
    const currentRank = current?.confidence === 'professional' ? 3 : current?.confidence === 'measured' ? 2 : 1
    if (!current || rank > currentRank || (rank === currentRank && asTime(fact.occurredAt) >= asTime(current.occurredAt))) latest.set(fact.stateKey, fact)
  }
  const known = [...latest.values()].map((fact) => ({ ...fact, status: conflicts.some((item) => item.stateKey === fact.stateKey) ? 'conflict' : 'known' }))
  return { known, conflicts }
}

function projectProblems(events, concerns = []) {
  const allConcerns = Array.isArray(concerns) ? concerns : []
  return allConcerns.map((concern) => {
    const sourceEvents = events.filter((event) => event.payload?.concernId === concern.id || event.relatedConcernId === concern.id)
    return {
      ...clone(concern),
      sourceEventIds: sourceEvents.map((event) => event.id),
      status: concern.status === 'closed' ? 'resolved' : 'open',
      lifecycle: concern.status === 'closed' ? 'resolved' : 'active',
    }
  })
}

function projectChanges(facts, now, baseline) {
  const changes = []
  for (const dimension of ['feeding', 'elimination']) {
    const today = todayCount(facts, dimension, now)
    const base = baseline[dimension]
    if (!today.sourceEventIds.length && base.status === 'missing') continue
    if (base.status === 'missing') {
      changes.push({
        id: `change:${dimension}:baseline-missing`,
        dimension,
        status: 'baseline-unavailable',
        currentValue: today.value,
        sourceEventIds: today.sourceEventIds,
        message: '暂无个人基线，当前只显示已记录事实。',
      })
      continue
    }
    const status = today.value < base.value.min ? 'below-personal-baseline' : today.value > base.value.max ? 'above-personal-baseline' : 'within-personal-baseline'
    changes.push({
      id: `change:${dimension}:${status}`,
      dimension,
      status,
      currentValue: today.value,
      baseline: base.value,
      sourceEventIds: [...today.sourceEventIds, ...base.sourceEventIds],
      message: status === 'below-personal-baseline' ? '低于个人近期基线。' : status === 'above-personal-baseline' ? '高于个人近期基线。' : '处于个人近期基线范围内。',
    })
  }
  return changes
}

export function projectBabyState({ baby = null, events = [], concerns = [], now = new Date(), baselineWindowDays = BASELINE_WINDOW_DAYS, minimumBaselineDays = MINIMUM_BASELINE_DAYS } = {}) {
  const generatedAt = new Date(now).toISOString()
  const allEvents = Array.isArray(events) ? events : []
  const sourceEvents = activeEvents(allEvents, now)
  const historyEvents = historicalEvents(allEvents, now)
  const facts = sourceEvents.flatMap(eventFacts)
  const validFacts = facts.filter((fact) => !fact.validUntil || asTime(fact.validUntil) > asTime(now))
  const recentStart = asTime(now) - DAY_MS
  const recent24h = validFacts.filter((fact) => asTime(fact.occurredAt) >= recentStart)
  const baseline = {}
  for (const dimension of ['feeding', 'elimination']) baseline[dimension] = baselineFor(facts, dimension, now, { windowDays: baselineWindowDays, minimumDays: minimumBaselineDays })
  const signalState = currentSignals(validFacts, now)
  const background = projectBackground(baby)
  const problems = projectProblems(historyEvents, concerns)
  const knownDimensions = new Set(signalState.known.map((fact) => fact.dimension))
  const unknown = CURRENT_DIMENSIONS.filter((dimension) => !knownDimensions.has(dimension) && !recent24h.some((fact) => fact.dimension === dimension)).map((dimension) => ({
    id: `unknown:${dimension}`,
    dimension,
    status: 'unknown',
    reason: 'no-current-fact',
    sourceEventIds: [],
  }))
  const changes = projectChanges(facts, now, baseline)
  const current = {
    known: signalState.known,
    unknown,
    conflicts: signalState.conflicts,
    changes,
    sourceEventIds: [...new Set(signalState.known.flatMap((fact) => fact.sourceEventIds).concat(signalState.conflicts.flatMap((item) => item.sourceEventIds)).concat(changes.flatMap((change) => change.sourceEventIds)))],
  }
  const history = historyEvents.slice().sort((a, b) => asTime(a.occurredAt || a.createdAt) - asTime(b.occurredAt || b.createdAt)).map((event) => ({
    eventId: event.id,
    occurredAt: event.occurredAt || event.createdAt,
    status: event.status,
    correctedFromId: event.correctedFromId || null,
    category: event.category || event.type || null,
    kind: event.kind || null,
  }))
  return {
    id: `snapshot:${baby?.id || 'unknown'}:${generatedAt}`,
    babyId: baby?.id || null,
    generatedAt,
    stage: priorFor(baby, now),
    background,
    baseline: {
      ...baseline,
      prior: priorFor(baby, now),
      minimumDays: minimumBaselineDays,
      windowDays: baselineWindowDays,
    },
    current,
    recent24h: {
      facts: recent24h,
      sourceEventIds: [...new Set(recent24h.map((fact) => fact.source.eventId))],
    },
    activeProblems: problems.filter((problem) => problem.lifecycle === 'active'),
    problemHistory: problems,
    history,
  }
}

export function traceBabyState(snapshot, sourceId) {
  if (!snapshot || !sourceId) return []
  const matches = []
  const visit = (value) => {
    if (!value || typeof value !== 'object') return
    if (value.sourceEventIds?.includes(sourceId) || value.eventId === sourceId) matches.push(value)
    for (const child of Object.values(value)) {
      if (child && typeof child === 'object') visit(child)
    }
  }
  visit(snapshot)
  return matches
}
