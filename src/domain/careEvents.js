export const CARE_EVENT_TYPES = Object.freeze([
  'breastfeeding',
  'bottle_feeding',
  'diaper',
  'sleep',
  'medication',
  'temperature',
  'growth_measurement',
  'symptom_observation',
  'care_action',
  'health_visit',
  'vaccination',
  'doctor_instruction',
])

export const CARE_EVENT_STATUSES = Object.freeze(['active', 'corrected', 'voided'])
export const CARE_EVENT_SOURCES = Object.freeze(['caregiver_entered', 'doctor_entered', 'device_imported'])

export const DEFAULT_RECORDERS = Object.freeze([
  { id: 'parent-mother', displayName: '妈妈', presetId: 'parent-mother' },
  { id: 'parent-father', displayName: '爸爸', presetId: 'parent-father' },
  { id: 'nanny', displayName: '月嫂', presetId: 'nanny' },
  { id: 'grandparent', displayName: '家人', presetId: 'grandparent' },
])

function makeId(prefix) {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function timestamp(value, fallback) {
  return value ? new Date(value).toISOString() : fallback
}

function clone(value) {
  if (value === undefined) return {}
  try { return JSON.parse(JSON.stringify(value)) } catch { return {} }
}

export function normalizeRecorder(value, fallback = DEFAULT_RECORDERS[0]) {
  if (value && typeof value === 'object' && value.id && value.displayName) {
    return { id: String(value.id), displayName: String(value.displayName) }
  }
  if (typeof value === 'string' && value.trim()) return { id: value.trim().toLowerCase().replace(/\s+/g, '-'), displayName: value.trim() }
  return { id: fallback.id, displayName: fallback.displayName }
}

export function createCareEvent(input = {}, options = {}) {
  const now = options.now || new Date().toISOString()
  const type = CARE_EVENT_TYPES.includes(input.type) ? input.type : 'care_action'
  const status = CARE_EVENT_STATUSES.includes(input.status) ? input.status : 'active'
  const source = CARE_EVENT_SOURCES.includes(input.source) ? input.source : 'caregiver_entered'
  const recordedBy = normalizeRecorder(input.recordedBy || options.recordedBy)
  return {
    id: String(input.id || options.id || makeId('event')),
    babyId: input.babyId || options.babyId || null,
    type,
    occurredAt: timestamp(input.occurredAt, now),
    recordedAt: timestamp(input.recordedAt, now),
    recordedBy,
    source,
    payload: clone(input.payload),
    relatedConcernId: input.relatedConcernId || null,
    createdAt: timestamp(input.createdAt, now),
    updatedAt: timestamp(input.updatedAt, now),
    version: Math.max(1, Number(input.version) || 1),
    status,
    ...(input.legacyKey ? { legacyKey: String(input.legacyKey) } : {}),
  }
}

export function createCarePlanItem(input = {}, options = {}) {
  const now = options.now || new Date().toISOString()
  return {
    id: String(input.id || options.id || makeId('plan')),
    babyId: input.babyId || options.babyId || null,
    type: input.type || 'task',
    title: input.title || '',
    dueAt: input.dueAt || null,
    status: input.status || 'pending',
    payload: clone(input.payload),
    relatedConcernId: input.relatedConcernId || null,
    createdAt: timestamp(input.createdAt, now),
    updatedAt: timestamp(input.updatedAt, now),
  }
}

export function createConcern(input = {}, options = {}) {
  const now = options.now || new Date().toISOString()
  return {
    id: String(input.id || options.id || makeId('concern')),
    babyId: input.babyId || options.babyId || null,
    topicId: input.topicId || null,
    title: input.title || '',
    status: input.status || 'open',
    createdAt: timestamp(input.createdAt, now),
    updatedAt: timestamp(input.updatedAt, now),
  }
}

function legacyOccurredAt(collection, record, fallback) {
  if (collection === 'observations') return record.firstNoticedAt || record.measuredAt || record.createdAt || fallback
  if (collection === 'growthMeasurements') return record.measuredAt || record.createdAt || fallback
  if (collection === 'taskLogs') return record.date ? `${record.date}T12:00:00.000Z` : record.updatedAt || fallback
  return record.updatedAt || record.createdAt || fallback
}

function legacyEvent(collection, record, index, options = {}) {
  const key = String(record?.id || `${collection}-${index}`)
  const type = collection === 'observations'
    ? 'symptom_observation'
    : collection === 'growthMeasurements'
      ? 'growth_measurement'
      : 'care_action'
  const now = options.now || new Date().toISOString()
  const occurredAt = legacyOccurredAt(collection, record || {}, now)
  return createCareEvent({
    id: `legacy-${collection}-${key}`,
    babyId: options.babyId,
    type,
    occurredAt,
    recordedAt: record?.recordedAt || record?.createdAt || now,
    recordedBy: options.recordedBy,
    source: 'device_imported',
    payload: { legacyCollection: collection, legacyId: key, record: clone(record) },
    createdAt: record?.createdAt || now,
    updatedAt: record?.updatedAt || record?.createdAt || now,
    version: 1,
    legacyKey: `${collection}:${key}`,
  }, { now })
}

function eventPayloadChanged(previous, next) {
  return JSON.stringify(previous?.payload) !== JSON.stringify(next?.payload)
    || previous?.occurredAt !== next?.occurredAt
}

function recorderForState(state, options = {}) {
  const selected = options.recordedBy || state?.preferences?.currentRecorder
  if (selected) return normalizeRecorder(selected)
  const actors = Array.isArray(state?.careActors) ? state.careActors : []
  const currentId = state?.preferences?.currentRecorderId
  return normalizeRecorder(actors.find((actor) => actor.id === currentId) || actors[0])
}

const LEGACY_COLLECTIONS = ['observations', 'taskLogs', 'growthMeasurements', 'adminTaskRecords', 'milestoneRecords']

export function legacyEventsFromState(state = {}, options = {}) {
  const recordedBy = recorderForState(state, options)
  const events = []
  for (const collection of LEGACY_COLLECTIONS) {
    const values = Array.isArray(state[collection]) ? state[collection] : []
    values.forEach((record, index) => events.push(legacyEvent(collection, record, index, {
      ...options,
      babyId: options.babyId || state.baby?.id,
      recordedBy,
    })))
  }
  return events
}

export function migrateLegacyState(state = {}, options = {}) {
  const base = { ...state }
  const actors = Array.isArray(base.careActors) && base.careActors.length ? base.careActors : DEFAULT_RECORDERS.map((actor) => ({ ...actor }))
  const currentRecorderId = base.preferences?.currentRecorderId || actors[0].id
  const existing = Array.isArray(base.careEvents) ? base.careEvents.map((event) => createCareEvent(event, options)) : []
  const byId = new Map(existing.map((event) => [event.id, event]))
  for (const event of legacyEventsFromState({ ...base, careActors: actors, preferences: { ...base.preferences, currentRecorderId } }, options)) {
    if (!byId.has(event.id)) byId.set(event.id, event)
  }
  const planItems = Array.isArray(base.carePlanItems) ? base.carePlanItems.map((item) => createCarePlanItem(item, options)) : []
  for (const record of Array.isArray(base.adminTaskRecords) ? base.adminTaskRecords : []) {
    const id = `legacy-plan-admin-${record.taskId || record.id}`
    if (!planItems.some((item) => item.id === id)) planItems.push(createCarePlanItem({
      id,
      babyId: options.babyId || base.baby?.id,
      type: 'admin_task',
      title: record.taskId || '历史代办',
      status: record.status === 'done' ? 'done' : 'pending',
      payload: { legacyCollection: 'adminTaskRecords', legacyId: record.id || record.taskId, record: clone(record) },
      createdAt: record.createdAt || record.updatedAt,
      updatedAt: record.updatedAt,
    }, options))
  }
  return {
    ...base,
    careActors: actors,
    careEvents: [...byId.values()],
    carePlanItems: planItems,
    concerns: Array.isArray(base.concerns) ? base.concerns.map((item) => createConcern(item, options)) : [],
    preferences: { ...(base.preferences || {}), currentRecorderId },
  }
}

export function bridgeLegacyChanges(previous = {}, next = {}, options = {}) {
  const migrated = migrateLegacyState(next, options)
  const previousEvents = new Map((Array.isArray(previous.careEvents) ? previous.careEvents : []).map((event) => [event.id, event]))
  const events = new Map((Array.isArray(migrated.careEvents) ? migrated.careEvents : []).map((event) => [event.id, event]))
  for (const generated of legacyEventsFromState(migrated, options)) {
    const prior = previousEvents.get(generated.id) || events.get(generated.id)
    if (!prior) {
      events.set(generated.id, generated)
      continue
    }
    if (eventPayloadChanged(prior, generated)) {
      events.set(generated.id, {
        ...prior,
        ...generated,
        version: Math.max(1, Number(prior.version) || 1) + 1,
        status: 'corrected',
        createdAt: prior.createdAt || generated.createdAt,
      })
    } else {
      events.set(generated.id, prior)
    }
  }
  return { ...migrated, careEvents: [...events.values()] }
}

export function mergeCareEvents(local = [], remote = []) {
  const byId = new Map(local.map((event) => [event.id, event]))
  for (const incoming of remote) {
    const current = byId.get(incoming.id)
    if (!current || new Date(incoming.updatedAt || 0).getTime() >= new Date(current.updatedAt || 0).getTime()) {
      byId.set(incoming.id, createCareEvent(incoming))
    }
  }
  return [...byId.values()].sort((a, b) => String(a.occurredAt).localeCompare(String(b.occurredAt)))
}

export function applyCareEventsToLegacy(state = {}, events = []) {
  const next = { ...state }
  const collections = ['observations', 'taskLogs', 'growthMeasurements', 'adminTaskRecords', 'milestoneRecords']
  for (const collection of collections) next[collection] = Array.isArray(state[collection]) ? [...state[collection]] : []
  for (const event of events) {
    const legacy = event?.payload?.legacyCollection
    const record = event?.payload?.record
    if (!collections.includes(legacy) || !record || event.status === 'voided') continue
    const list = next[legacy]
    const index = legacy === 'taskLogs'
      ? list.findIndex((item) => item.id === record.id || (item.taskId === record.taskId && item.date === record.date))
      : legacy === 'adminTaskRecords'
        ? list.findIndex((item) => item.id === record.id || item.taskId === record.taskId)
        : legacy === 'milestoneRecords'
          ? list.findIndex((item) => item.id === record.id || item.milestoneId === record.milestoneId)
          : list.findIndex((item) => item.id === record.id)
    if (index === -1) next[legacy] = [...list, record]
    else next[legacy] = list.map((item, itemIndex) => itemIndex === index ? { ...item, ...record } : item)
  }
  return next
}
