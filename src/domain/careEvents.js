export const CARE_EVENT_KINDS = Object.freeze([
  'caregiver_observation',
  'measurement',
  'professional_conclusion',
])

// Kept as a compatibility list for the existing quick-record UI. These are
// categories, not core event kinds.
export const CARE_EVENT_TYPES = Object.freeze([
  'breastfeeding',
  'bottle_feeding',
  'diaper',
  'sleep',
  'medication',
  'temperature',
  'temperature_observation',
  'growth_measurement',
  'symptom_observation',
  'concern_open',
  'care_action',
  'health_visit',
  'vaccination',
  'care_plan_item',
  'doctor_instruction',
])

export const CARE_EVENT_STATUSES = Object.freeze(['active', 'corrected', 'voided'])
export const CARE_EVENT_SOURCES = Object.freeze(['caregiver', 'clinical_record', 'device_import', 'unknown'])

export const CARE_RECORD_CATEGORIES = Object.freeze([
  'breastfeeding',
  'bottle_feeding',
  'sleep',
  'diaper',
  'medication',
  'temperature',
  'temperature_observation',
  'growth_measurement',
])

const DIAPER_KINDS = new Set(['urine', 'stool', 'both'])
const BOTTLE_MILK_TYPES = new Set(['breast_milk', 'formula'])
const GROWTH_MEASUREMENT_TYPES = new Set(['weight', 'length', 'headCircumference'])

const OCCURRED_AT_ERROR_MESSAGES = Object.freeze({
  invalid: { zh: '发生时间无效，请重新选择。', en: 'Choose a valid event time.' },
  before_birth: { zh: '发生时间不能早于宝宝出生日期。', en: 'The event time cannot be before the baby’s birth date.' },
  future: { zh: '发生时间不能晚于当前时间。', en: 'The event time cannot be in the future.' },
})

export const DEFAULT_RECORDERS = Object.freeze([
  { id: 'parent-mother', displayName: '妈妈', presetId: 'parent-mother' },
  { id: 'parent-father', displayName: '爸爸', presetId: 'parent-father' },
  { id: 'nanny', displayName: '月嫂', presetId: 'nanny' },
  { id: 'grandparent', displayName: '家人', presetId: 'grandparent' },
])

const TYPE_TO_KIND = Object.freeze({
  measurement: 'measurement',
  temperature: 'measurement',
  growth_measurement: 'measurement',
  doctor_instruction: 'professional_conclusion',
})

const SOURCE_ALIASES = Object.freeze({
  caregiver_entered: 'caregiver',
  doctor_entered: 'clinical_record',
  device_imported: 'device_import',
})

function makeId(prefix) {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function clone(value) {
  if (value === undefined) return {}
  try { return JSON.parse(JSON.stringify(value)) } catch { return {} }
}

function timestamp(value, fallback) {
  if (!value) return fallback
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

export function careEventKindForCategory(type) {
  return TYPE_TO_KIND[type] || 'caregiver_observation'
}

function normalizeSource(value) {
  return SOURCE_ALIASES[value] || (CARE_EVENT_SOURCES.includes(value) ? value : 'unknown')
}

export function validateOccurredAt(value, { birthDate = null, now = new Date(), futureSkewMs = 60_000 } = {}) {
  const occurredAt = new Date(value)
  if (Number.isNaN(occurredAt.getTime())) return 'invalid'
  const current = now instanceof Date ? now : new Date(now)
  if (Number.isNaN(current.getTime())) return 'invalid'
  if (birthDate) {
    const birthStart = new Date(`${String(birthDate).slice(0, 10)}T00:00:00`)
    if (!Number.isNaN(birthStart.getTime()) && occurredAt.getTime() < birthStart.getTime()) return 'before_birth'
  }
  if (occurredAt.getTime() > current.getTime() + futureSkewMs) return 'future'
  return null
}

export function occurredAtErrorMessage(code, locale = 'zh-CN') {
  return OCCURRED_AT_ERROR_MESSAGES[code]?.[locale === 'en-US' ? 'en' : 'zh'] || OCCURRED_AT_ERROR_MESSAGES.invalid.zh
}

export function normalizeRecorder(value, fallback = DEFAULT_RECORDERS[0]) {
  if (value && typeof value === 'object' && value.id && value.displayName) {
    return { id: String(value.id), displayName: String(value.displayName) }
  }
  if (typeof value === 'string' && value.trim()) {
    return { id: value.trim().toLowerCase().replace(/\s+/g, '-'), displayName: value.trim() }
  }
  return { id: fallback.id, displayName: fallback.displayName }
}

function addCompatibilityAliases(event, legacyType) {
  // Non-enumerable aliases keep older view code and external integrations
  // readable without changing the JSON CareEvent contract.
  Object.defineProperty(event, 'type', { enumerable: false, configurable: true, get: () => legacyType || event.category })
  Object.defineProperty(event, 'recordedBy', { enumerable: false, configurable: true, get: () => event.actor })
  return event
}

export function createCareEvent(input = {}, options = {}) {
  const now = options.now || new Date().toISOString()
  const legacyType = input.type || null
  const category = String(input.category || legacyType || 'care_action').trim() || 'care_action'
  const kind = CARE_EVENT_KINDS.includes(input.kind) ? input.kind : careEventKindForCategory(legacyType || category)
  const status = CARE_EVENT_STATUSES.includes(input.status) ? input.status : 'active'
  const actor = normalizeRecorder(input.actor || input.recordedBy || options.actor || options.recordedBy)
  const event = {
    id: String(input.id || options.id || makeId('event')),
    babyId: input.babyId || options.babyId || null,
    kind,
    category,
    occurredAt: timestamp(input.occurredAt, now),
    recordedAt: timestamp(input.recordedAt, now),
    actor,
    source: normalizeSource(input.source),
    payload: clone(input.payload),
    status,
    ...(input.correctedFromId ? { correctedFromId: String(input.correctedFromId) } : {}),
    version: Math.max(1, Number(input.version) || 1),
    createdAt: timestamp(input.createdAt, now),
    updatedAt: timestamp(input.updatedAt, now),
  }
  return addCompatibilityAliases(event, legacyType)
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
    plan: input.plan ? clone(input.plan) : null,
    facts: Array.isArray(input.facts) ? [...input.facts] : [],
    notes: typeof input.notes === 'string' ? input.notes : '',
  }
}

export function validateCareEvent(event = {}) {
  const errors = []
  if (!event.id) errors.push({ field: 'id', message: '缺少事件 id' })
  if (!event.babyId) errors.push({ field: 'babyId', message: '缺少 babyId' })
  if (!CARE_EVENT_KINDS.includes(event.kind)) errors.push({ field: 'kind', message: `不支持的事件 kind: ${event.kind || '空值'}` })
  if (!String(event.category || '').trim()) errors.push({ field: 'category', message: '必须提供事件 category' })
  if (!event.occurredAt) errors.push({ field: 'occurredAt', message: '必须提供发生时间' })
  if (!event.recordedAt) errors.push({ field: 'recordedAt', message: '必须提供记录时间' })
  if (!event.actor?.id || !event.actor?.displayName) errors.push({ field: 'actor', message: '必须提供记录人' })
  if (!CARE_EVENT_SOURCES.includes(event.source)) errors.push({ field: 'source', message: `不支持的事件来源: ${event.source || '空值'}` })
  if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) errors.push({ field: 'payload', message: 'payload 必须是对象' })
  if (!CARE_EVENT_STATUSES.includes(event.status)) errors.push({ field: 'status', message: `不支持的事件状态: ${event.status || '空值'}` })
  if (!Number.isInteger(Number(event.version)) || Number(event.version) < 1) errors.push({ field: 'version', message: 'version 必须是正整数' })
  return { valid: errors.length === 0, errors }
}

export function validateCareRecordInput(input = {}) {
  const errors = []
  const category = String(input.category || '').trim()
  const payload = input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload) ? input.payload : null
  const numberError = (field, message) => {
    if (payload?.[field] === '' || payload?.[field] === null || payload?.[field] === undefined) return
    if (!Number.isFinite(Number(payload[field]))) errors.push({ field: `payload.${field}`, message })
  }

  if (!CARE_RECORD_CATEGORIES.includes(category)) return { valid: true, errors }
  if (!payload) {
    errors.push({ field: 'payload', message: '记录内容必须是对象' })
    return { valid: false, errors }
  }
  if (!input.occurredAt || Number.isNaN(new Date(input.occurredAt).getTime())) errors.push({ field: 'occurredAt', message: '必须提供有效的发生时间' })

  if (category === 'bottle_feeding') {
    if (!BOTTLE_MILK_TYPES.has(payload.milkType)) errors.push({ field: 'payload.milkType', message: '瓶喂必须选择母乳瓶喂或配方奶' })
    if (payload.amountMl === '' || payload.amountMl === null || payload.amountMl === undefined) errors.push({ field: 'payload.amountMl', message: '瓶喂必须提供实际摄入量' })
    numberError('amountMl', '实际摄入量必须是数字')
    if (Number(payload.amountMl) < 0) errors.push({ field: 'payload.amountMl', message: '实际摄入量不能小于 0' })
  }
  if (category === 'sleep') {
    const start = new Date(input.occurredAt)
    const end = new Date(payload.endedAt)
    if (!payload.endedAt || Number.isNaN(end.getTime())) errors.push({ field: 'payload.endedAt', message: '睡眠必须提供有效的结束时间' })
    else if (!Number.isNaN(start.getTime()) && end.getTime() <= start.getTime()) errors.push({ field: 'payload.endedAt', message: '睡眠结束时间必须晚于开始时间' })
  }
  if (category === 'diaper' && !DIAPER_KINDS.has(payload.kind)) errors.push({ field: 'payload.kind', message: '尿布类型不正确' })
  if (category === 'medication' && !String(payload.medicationName || payload.name || '').trim()) errors.push({ field: 'payload.medicationName', message: '用药必须提供药品名称' })
  if (category === 'temperature') {
    numberError('value', '体温数值必须是数字')
    if (payload.value === '' || payload.value === null || payload.value === undefined) errors.push({ field: 'payload.value', message: '没有数值时应保存为体温观察' })
    if (!String(payload.unit || '').trim()) errors.push({ field: 'payload.unit', message: '体温必须提供单位' })
    if (!String(payload.method || '').trim()) errors.push({ field: 'payload.method', message: '体温必须提供测量部位或方法' })
  }
  if (category === 'temperature_observation' && payload.value !== undefined && payload.value !== null && payload.value !== '') errors.push({ field: 'payload.value', message: '体温观察不能包含数值，请使用体温测量' })
  if (category === 'growth_measurement') {
    if (!GROWTH_MEASUREMENT_TYPES.has(payload.type)) errors.push({ field: 'payload.type', message: '成长测量类型不正确' })
    if (payload.value === '' || payload.value === null || payload.value === undefined) errors.push({ field: 'payload.value', message: '成长测量必须提供数值' })
    numberError('value', '成长测量数值必须是数字')
    if (!String(payload.unit || '').trim()) errors.push({ field: 'payload.unit', message: '成长测量必须提供单位' })
    if (!String(payload.measuredAt || '').trim() || Number.isNaN(new Date(payload.measuredAt).getTime())) errors.push({ field: 'payload.measuredAt', message: '成长测量必须提供有效日期' })
  }
  return { valid: errors.length === 0, errors }
}

export function assertCareRecordInput(input = {}) {
  const result = validateCareRecordInput(input)
  if (!result.valid) {
    const error = new TypeError(result.errors[0].message)
    error.field = result.errors[0].field
    throw error
  }
  return input
}

export function assertCareEvent(event) {
  const result = validateCareEvent(event)
  if (!result.valid) {
    const error = new TypeError(result.errors[0].message)
    error.field = result.errors[0].field
    throw error
  }
  return event
}

export function createCorrectedCareEvent(original, patch = {}, options = {}) {
  const now = options.now || new Date().toISOString()
  const sameCategory = !patch.category || patch.category === original.category
  const payload = patch.payload && sameCategory
    ? { ...(original.payload || {}), ...clone(patch.payload) }
    : patch.payload === undefined ? original.payload : patch.payload
  return createCareEvent({
    ...original,
    ...patch,
    payload,
    id: patch.id || options.id || makeId('event'),
    babyId: original.babyId,
    actor: patch.actor || patch.recordedBy || original.actor,
    recordedAt: patch.recordedAt || now,
    createdAt: now,
    updatedAt: now,
    status: 'active',
    version: 1,
    correctedFromId: original.id,
  }, { now })
}

export function correctCareEvent(events = [], originalId, patch = {}, options = {}) {
  const original = events.find((event) => event.id === originalId)
  if (!original) throw new Error('原始事件不存在')
  const corrected = createCorrectedCareEvent(original, patch, options)
  return events.map((event) => event.id === originalId
    ? createCareEvent({ ...event, status: 'corrected', version: Number(event.version || 1) + 1, updatedAt: corrected.recordedAt }, { now: corrected.recordedAt })
    : event).concat(corrected)
}

export function voidCareEvent(event, options = {}) {
  const now = options.now || new Date().toISOString()
  const next = createCareEvent({ ...event, status: 'voided', version: Number(event.version || 1) + 1, updatedAt: now }, { now })
  return next
}

export function queryCareEvents(events = [], filters = {}) {
  const parseBoundary = (value, end = false) => {
    if (!value) return end ? Infinity : -Infinity
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      const date = new Date(`${value}T00:00:00`)
      if (Number.isNaN(date.getTime())) return Number.NaN
      if (end) {
        date.setDate(date.getDate() + 1)
        return date.getTime() - 1
      }
      return date.getTime()
    }
    return new Date(value).getTime()
  }
  const from = parseBoundary(filters.from)
  const to = parseBoundary(filters.to, true)
  return events
    .filter((event) => !filters.babyId || event.babyId === filters.babyId)
    .filter((event) => !filters.category || event.category === filters.category)
    .filter((event) => !filters.kind || event.kind === filters.kind)
    .filter((event) => filters.includeVoided || event.status !== 'voided')
    .filter((event) => {
      const time = new Date(event.occurredAt || event.recordedAt).getTime()
      return time >= from && time <= to
    })
    .sort((a, b) => String(a.occurredAt).localeCompare(String(b.occurredAt)))
}

export const findCareEvents = queryCareEvents

function legacyOccurredAt(collection, record, fallback) {
  if (collection === 'observations') return record.firstNoticedAt || record.measuredAt || record.createdAt || fallback
  if (collection === 'growthMeasurements') return record.measuredAt || record.createdAt || fallback
  if (collection === 'taskLogs') return record.date ? `${record.date}T12:00:00.000Z` : record.updatedAt || fallback
  return record.updatedAt || record.createdAt || fallback
}

function legacyCategory(collection, record) {
  if (collection === 'observations') return record.topicId || 'observation'
  if (collection === 'growthMeasurements') return record.type || 'growth_measurement'
  return 'care_action'
}

function legacyEvent(collection, record, index, options = {}, usedIds = new Set()) {
  const originalId = String(record?.id || `${collection}-${index}`)
  const id = usedIds.has(originalId) ? `legacy-${collection}-${originalId}` : originalId
  usedIds.add(id)
  const now = options.now || new Date().toISOString()
  const payload = { legacyCollection: collection, legacyId: originalId, record: clone(record) }
  return createCareEvent({
    id,
    babyId: options.babyId,
    kind: collection === 'growthMeasurements' ? 'measurement' : 'caregiver_observation',
    category: legacyCategory(collection, record || {}),
    occurredAt: legacyOccurredAt(collection, record || {}, now),
    recordedAt: record?.recordedAt || record?.createdAt || now,
    actor: options.actor || options.recordedBy,
    source: 'unknown',
    payload,
    createdAt: record?.createdAt || now,
    updatedAt: record?.updatedAt || record?.createdAt || now,
    version: 1,
  }, { now })
}

const LEGACY_COLLECTIONS = ['observations', 'taskLogs', 'growthMeasurements']

export function legacyEventsFromState(state = {}, options = {}) {
  const actors = Array.isArray(state.careActors) && state.careActors.length ? state.careActors : DEFAULT_RECORDERS
  const selected = options.actor || options.recordedBy || actors.find((actor) => actor.id === state.preferences?.currentRecorderId) || actors[0]
  const events = []
  const usedIds = new Set((state.careEvents || []).map((event) => event.id))
  const collections = Array.isArray(options.legacyCollections) ? options.legacyCollections : LEGACY_COLLECTIONS
  for (const collection of collections) {
    const values = Array.isArray(state[collection]) ? state[collection] : []
    values.forEach((record, index) => events.push(legacyEvent(collection, record, index, { ...options, babyId: options.babyId || state.baby?.id, actor: selected }, usedIds)))
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
  return {
    ...base,
    careActors: actors,
    careEvents: [...byId.values()],
    preferences: { ...(base.preferences || {}), currentRecorderId },
  }
}

function eventPayloadChanged(previous, next) {
  // Changing the recorder is metadata; it must not rewrite the historical fact.
  return JSON.stringify(previous?.payload) !== JSON.stringify(next?.payload)
    || previous?.occurredAt !== next?.occurredAt
}

export function bridgeLegacyChanges(previous = {}, next = {}, options = {}) {
  const migrated = migrateLegacyState(next, { ...options, legacyCollections: [] })
  const previousEvents = new Map((Array.isArray(previous.careEvents) ? previous.careEvents : []).map((event) => [event.id, event]))
  const events = new Map((Array.isArray(migrated.careEvents) ? migrated.careEvents : []).map((event) => [event.id, event]))
  const now = options.now || new Date().toISOString()
  const collections = !Array.isArray(previous.careEvents) || previous.careEvents.length === 0
    ? LEGACY_COLLECTIONS
    : LEGACY_COLLECTIONS.filter((collection) => JSON.stringify(previous[collection] || []) !== JSON.stringify(next[collection] || []))
  for (const collection of collections) {
    const currentIds = new Set((Array.isArray(next[collection]) ? next[collection] : []).map((record, index) => String(record?.id || `${collection}-${index}`)))
    for (const [eventId, event] of events) {
      if (event.status === 'voided' || event.payload?.legacyCollection !== collection) continue
      if (!currentIds.has(String(event.payload?.legacyId || ''))) {
        events.set(eventId, {
          ...event,
          status: 'voided',
          updatedAt: now,
          version: Math.max(1, Number(event.version) || 1) + 1,
        })
      }
    }
  }
  for (const generated of legacyEventsFromState(migrated, { ...options, legacyCollections: collections })) {
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
  const byId = new Map(local.map((event) => [event.id, createCareEvent(event)]))
  for (const incoming of remote) {
    const current = byId.get(incoming.id)
    if (!current || Number(incoming.version || 1) >= Number(current.version || 1)) byId.set(incoming.id, createCareEvent(incoming))
  }
  return [...byId.values()].sort((a, b) => String(a.occurredAt).localeCompare(String(b.occurredAt)))
}

export function applyCareEventsToLegacy(state = {}, events = []) {
  const next = { ...state }
  next.observations = []
  next.taskLogs = []
  next.growthMeasurements = []
  next.adminTaskRecords = []
  next.milestoneRecords = []
  next.carePlanItems = []
  for (const event of events) {
    if (event.status !== 'active') continue
    const payload = event.payload || {}
    const isNestedLegacyRecord = payload.record && typeof payload.record === 'object'
    const sourceRecord = isNestedLegacyRecord ? payload.record : payload
    const project = (record) => isNestedLegacyRecord ? record : { ...record, id: event.id, createdAt: event.createdAt, updatedAt: event.updatedAt }
    if (event.category === 'admin_task') {
      next.adminTaskRecords.push(isNestedLegacyRecord ? sourceRecord : { ...payload, id: event.id, updatedAt: event.updatedAt, provenance: 'parent-entered' })
    } else if (event.category === 'care_plan_item' || payload.carePlanItem || payload.planItemId) {
      next.carePlanItems.push(isNestedLegacyRecord ? sourceRecord : { ...payload, id: event.id, updatedAt: event.updatedAt, provenance: 'parent-entered' })
    } else if (payload.taskId || payload.legacyCollection === 'taskLogs') {
      const record = sourceRecord
      const prior = isNestedLegacyRecord ? (state.taskLogs || []).find((item) => item.id === record.id || (item.taskId === record.taskId && item.date === record.date)) : null
      next.taskLogs.push(isNestedLegacyRecord && prior ? { ...prior, ...record } : project(record))
    } else if (payload.legacyCollection === 'growthMeasurements' || event.category === 'growth_measurement') {
      const record = sourceRecord
      next.growthMeasurements.push(project(record))
    } else if (event.category === 'milestone' || payload.milestoneId) {
      next.milestoneRecords.push(isNestedLegacyRecord ? sourceRecord : { ...payload, id: event.id, updatedAt: event.updatedAt, provenance: 'parent-entered' })
    } else if (payload.legacyCollection === 'observations' || event.category === 'observation' || event.kind === 'caregiver_observation') {
      const record = sourceRecord
      next.observations.push(project(record))
    }
  }
  const latestBy = (records, keyOf) => {
    const byKey = new Map()
    for (const record of records) {
      const key = keyOf(record)
      const current = byKey.get(key)
      if (!current || String(record.updatedAt || record.createdAt || '') >= String(current.updatedAt || current.createdAt || '')) byKey.set(key, record)
    }
    return [...byKey.values()]
  }
  next.taskLogs = latestBy(next.taskLogs, (record) => `${record.taskId || record.id}:${record.date || ''}`)
  next.adminTaskRecords = latestBy(next.adminTaskRecords, (record) => record.taskId || record.id)
  next.milestoneRecords = latestBy(next.milestoneRecords, (record) => record.milestoneId || record.id)
  next.carePlanItems = latestBy(next.carePlanItems, (record) => record.taskId || record.planItemId || record.id)
  return next
}
