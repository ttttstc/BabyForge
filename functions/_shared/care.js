export const EVENT_KINDS = new Set(['caregiver_observation', 'measurement', 'professional_conclusion'])
export const EVENT_SOURCES = new Set(['caregiver', 'clinical_record', 'device_import', 'unknown'])
export const EVENT_STATUSES = new Set(['active', 'corrected', 'voided'])

const SOURCE_ALIASES = { caregiver_entered: 'caregiver', doctor_entered: 'clinical_record', device_imported: 'device_import' }
const LEGACY_SOURCE = { caregiver: 'caregiver_entered', clinical_record: 'doctor_entered', device_import: 'device_imported', unknown: 'device_imported' }
const LEGACY_TYPES = new Set(['breastfeeding', 'bottle_feeding', 'diaper', 'sleep', 'medication', 'temperature', 'growth_measurement', 'symptom_observation', 'concern_open', 'care_action', 'health_visit', 'vaccination', 'doctor_instruction'])

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
