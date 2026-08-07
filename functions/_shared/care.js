export const EVENT_KINDS = new Set(['caregiver_observation', 'measurement', 'professional_conclusion'])
export const EVENT_SOURCES = new Set(['caregiver', 'clinical_record', 'device_import', 'unknown'])
export const EVENT_STATUSES = new Set(['active', 'corrected', 'voided'])

const SOURCE_ALIASES = { caregiver_entered: 'caregiver', doctor_entered: 'clinical_record', device_imported: 'device_import' }
const LEGACY_SOURCE = { caregiver: 'caregiver_entered', clinical_record: 'doctor_entered', device_import: 'device_imported', unknown: 'device_imported' }
const LEGACY_TYPES = new Set(['breastfeeding', 'bottle_feeding', 'diaper', 'sleep', 'medication', 'temperature', 'temperature_observation', 'growth_measurement', 'symptom_observation', 'concern_open', 'care_action', 'health_visit', 'vaccination', 'doctor_instruction'])
const P0_CATEGORIES = new Set(['breastfeeding', 'bottle_feeding', 'sleep', 'diaper', 'medication', 'temperature', 'temperature_observation', 'growth_measurement'])
const DIAPER_KINDS = new Set(['urine', 'stool', 'both'])
const MILK_TYPES = new Set(['breast_milk', 'formula'])
const GROWTH_TYPES = new Set(['weight', 'length'])

export class EventInputError extends Error {
  constructor(field, message) {
    super(message)
    this.name = 'EventInputError'
    this.field = field
  }
}

export async function accessibleBaby(env, accountId, babyId) {
  return env.DB.prepare(`
    SELECT b.id, b.household_id AS householdId, b.nickname, b.birth_date AS birthDate,
      b.gestational_weeks AS gestationalWeeks, b.gestational_days AS gestationalDays, b.growth_age_basis AS growthAgeBasis, b.birth_multiplicity AS birthMultiplicity, b.sex, b.feeding_mode AS feedingMode, b.locale,
      COALESCE(b.status, 'active') AS status
    FROM baby_profiles b JOIN household_members m ON m.household_id = b.household_id
    WHERE b.id = ? AND m.account_id = ? AND m.active = 1
  `).bind(babyId, accountId).first()
}

export async function accessibleEvent(env, accountId, eventId) {
  return env.DB.prepare(`
    SELECT e.* FROM care_events e
    JOIN baby_profiles b ON b.id = e.baby_id
    JOIN household_members m ON m.household_id = b.household_id
    WHERE e.id = ? AND m.account_id = ? AND m.active = 1
  `).bind(eventId, accountId).first()
}

export function parseJson(value, fallback = {}) {
  try { return JSON.parse(value) } catch { return fallback }
}

function kindFromLegacyType(type) {
  if (type === 'temperature' || type === 'growth_measurement') return 'measurement'
  if (type === 'doctor_instruction') return 'professional_conclusion'
  return 'caregiver_observation'
}

function sourceFromRow(row) {
  return row.event_source || SOURCE_ALIASES[row.source] || 'unknown'
}

export function eventFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    babyId: row.baby_id,
    kind: row.kind || kindFromLegacyType(row.type),
    category: row.category || row.type || 'care_action',
    occurredAt: row.occurred_at,
    recordedAt: row.recorded_at,
    actor: { id: row.actor_id || row.recorded_by_id, displayName: row.actor_display_name || row.recorded_by_name },
    source: sourceFromRow(row),
    payload: parseJson(row.payload_json),
    status: row.status,
    ...(row.corrected_from_id ? { correctedFromId: row.corrected_from_id } : {}),
    version: Number(row.version) || 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function planFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    babyId: row.baby_id,
    type: row.type,
    title: row.title,
    dueAt: row.due_at,
    status: row.status,
    payload: parseJson(row.payload_json),
    relatedConcernId: row.related_concern_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function concernFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    babyId: row.baby_id,
    topicId: row.topic_id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function legacyTypeForEvent(event) {
  if (event.kind === 'professional_conclusion') return 'doctor_instruction'
  return LEGACY_TYPES.has(event.category) ? event.category : 'care_action'
}

export function legacySourceForEvent(source) {
  // 0004's compatibility column does not accept `unknown`; canonical
  // `event_source` remains authoritative for Issue #7.
  return LEGACY_SOURCE[source] || 'device_imported'
}

function validateCareRecordPayload(category, payload, occurredAt) {
  if (!P0_CATEGORIES.has(category)) return
  const fail = (field, message) => { throw new EventInputError(field, message) }
  const time = new Date(occurredAt || '')
  if (Number.isNaN(time.getTime())) fail('occurredAt', '必须提供有效的发生时间')
  const numeric = (field, message) => {
    if (!Number.isFinite(Number(payload[field]))) fail(`payload.${field}`, message)
  }
  if (category === 'bottle_feeding') {
    if (!MILK_TYPES.has(payload.milkType)) fail('payload.milkType', '瓶喂必须选择母乳瓶喂或配方奶')
    if (payload.amountMl === '' || payload.amountMl === null || payload.amountMl === undefined) fail('payload.amountMl', '瓶喂必须提供实际摄入量')
    numeric('amountMl', '实际摄入量必须是数字')
    if (Number(payload.amountMl) < 0) fail('payload.amountMl', '实际摄入量不能小于 0')
  }
  if (category === 'sleep') {
    const end = new Date(payload.endedAt || '')
    if (Number.isNaN(end.getTime())) fail('payload.endedAt', '睡眠必须提供有效的结束时间')
    if (end.getTime() <= time.getTime()) fail('payload.endedAt', '睡眠结束时间必须晚于开始时间')
  }
  if (category === 'diaper' && !DIAPER_KINDS.has(payload.kind)) fail('payload.kind', '尿布类型不正确')
  if (category === 'medication' && !String(payload.medicationName || payload.name || '').trim()) fail('payload.medicationName', '用药必须提供药品名称')
  if (category === 'temperature') {
    numeric('value', '体温数值必须是数字')
    if (payload.value === '' || payload.value === null || payload.value === undefined) fail('payload.value', '没有数值时应保存为体温观察')
    if (!String(payload.unit || '').trim()) fail('payload.unit', '体温必须提供单位')
    if (!String(payload.method || '').trim()) fail('payload.method', '体温必须提供测量部位或方法')
  }
  if (category === 'temperature_observation' && payload.value !== undefined && payload.value !== null && payload.value !== '') fail('payload.value', '体温观察不能包含数值，请使用体温测量')
  if (category === 'growth_measurement') {
    if (!GROWTH_TYPES.has(payload.type)) fail('payload.type', '成长测量类型不正确')
    if (payload.value === '' || payload.value === null || payload.value === undefined) fail('payload.value', '成长测量必须提供数值')
    numeric('value', '成长测量数值必须是数字')
    if (!String(payload.unit || '').trim()) fail('payload.unit', '成长测量必须提供单位')
    if (Number.isNaN(new Date(payload.measuredAt || '').getTime())) fail('payload.measuredAt', '成长测量必须提供有效日期')
  }
}

export function safeEventInput(input = {}, fallback = {}, options = {}) {
  const event = input?.event || input
  if (options.requireId && !event?.id) throw new EventInputError('id', '缺少事件 id')
  const legacyType = event?.type || null
  if (legacyType && !LEGACY_TYPES.has(legacyType)) throw new EventInputError('type', `不支持的事件类型: ${legacyType}`)
  const kind = event?.kind || kindFromLegacyType(legacyType)
  if (!EVENT_KINDS.has(kind)) throw new EventInputError('kind', `不支持的事件 kind: ${kind || '空值'}`)
  const category = String(event?.category || legacyType || '').trim()
  if (!category) throw new EventInputError('category', '必须提供事件 category')
  const source = SOURCE_ALIASES[event?.source] || event?.source || 'unknown'
  if (!EVENT_SOURCES.has(source)) throw new EventInputError('source', `不支持的事件来源: ${event?.source || '空值'}`)
  const status = event?.status || 'active'
  if (!EVENT_STATUSES.has(status)) throw new EventInputError('status', `不支持的事件状态: ${status}`)
  if (event?.correctedFromId && !options.allowCorrectedFromId) throw new EventInputError('correctedFromId', '纠正事件必须通过版本化修改接口提交')
  const id = String(event?.id || globalThis.crypto?.randomUUID?.() || `event-${Date.now()}`)
  const actor = event?.actor?.id && event.actor.displayName
    ? { id: String(event.actor.id), displayName: String(event.actor.displayName) }
    : event?.recordedBy?.id && event.recordedBy.displayName
      ? { id: String(event.recordedBy.id), displayName: String(event.recordedBy.displayName) }
      : fallback.actor?.id && fallback.actor.displayName
        ? { id: String(fallback.actor.id), displayName: String(fallback.actor.displayName) }
        : null
  if (!actor && (options.requireActor || options.requireRecordedBy)) throw new EventInputError('actor', '必须提供记录人')
  const occurredAt = event?.occurredAt || fallback.occurredAt || fallback.now
  const recordedAt = event?.recordedAt || fallback.recordedAt || fallback.now
  if (options.requireTimestamps && !event?.occurredAt && !fallback.occurredAt) throw new EventInputError('occurredAt', '必须提供发生时间')
  if (options.requireTimestamps && !event?.recordedAt && !fallback.recordedAt) throw new EventInputError('recordedAt', '必须提供记录时间')
  if (!event?.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) throw new EventInputError('payload', 'payload 必须是对象')
  validateCareRecordPayload(category, event.payload, occurredAt)
  return {
    id,
    babyId: event?.babyId || fallback.babyId || null,
    kind,
    category,
    source,
    status,
    occurredAt,
    recordedAt,
    actor,
    payload: event.payload,
    correctedFromId: event?.correctedFromId || null,
    version: Number(event?.version || event?.expectedVersion || 1),
  }
}
