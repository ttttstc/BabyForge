export const EVENT_TYPES = new Set([
  'breastfeeding', 'bottle_feeding', 'diaper', 'sleep', 'medication', 'temperature',
  'growth_measurement', 'symptom_observation', 'care_action', 'health_visit', 'vaccination', 'doctor_instruction',
])
export const EVENT_SOURCES = new Set(['caregiver_entered', 'doctor_entered', 'device_imported'])
export const EVENT_STATUSES = new Set(['active', 'corrected', 'voided'])

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
      b.gestational_weeks AS gestationalWeeks, b.sex, b.feeding_mode AS feedingMode, b.locale,
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

export function eventFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    babyId: row.baby_id,
    type: row.type,
    occurredAt: row.occurred_at,
    recordedAt: row.recorded_at,
    recordedBy: { id: row.recorded_by_id, displayName: row.recorded_by_name },
    source: row.source,
    payload: parseJson(row.payload_json),
    relatedConcernId: row.related_concern_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: Number(row.version) || 1,
    status: row.status,
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

export function safeEventInput(input = {}, fallback = {}, options = {}) {
  const event = input?.event || input
  if (options.requireId && !event?.id) throw new EventInputError('id', '缺少事件 id')
  if (!EVENT_TYPES.has(event?.type)) throw new EventInputError('type', `不支持的事件类型: ${event?.type || '空值'}`)
  if (!EVENT_SOURCES.has(event?.source)) throw new EventInputError('source', `不支持的事件来源: ${event?.source || '空值'}`)
  if (event?.status !== undefined && !EVENT_STATUSES.has(event.status)) throw new EventInputError('status', `不支持的事件状态: ${event.status}`)
  const id = String(event?.id || globalThis.crypto?.randomUUID?.() || `event-${Date.now()}`)
  const type = event.type
  const source = event.source
  const status = event.status || 'active'
  const recordedBy = event?.recordedBy && event.recordedBy.id && event.recordedBy.displayName
    ? { id: String(event.recordedBy.id), displayName: String(event.recordedBy.displayName) }
    : fallback.recordedBy?.id && fallback.recordedBy?.displayName
      ? { id: String(fallback.recordedBy.id), displayName: String(fallback.recordedBy.displayName) }
      : null
  if (!recordedBy && options.requireRecordedBy) throw new EventInputError('recordedBy', '必须提供记录人')
  const occurredAt = event?.occurredAt || fallback.occurredAt || fallback.now
  const recordedAt = event?.recordedAt || fallback.recordedAt || fallback.now
  if (options.requireTimestamps && !event?.occurredAt && !fallback.occurredAt) throw new EventInputError('occurredAt', '必须提供发生时间')
  if (options.requireTimestamps && !event?.recordedAt && !fallback.recordedAt) throw new EventInputError('recordedAt', '必须提供记录时间')
  if (event?.payload === null || typeof event?.payload !== 'object' || Array.isArray(event.payload)) throw new EventInputError('payload', 'payload 必须是对象')
  return {
    id,
    type,
    source,
    status,
    occurredAt,
    recordedAt,
    recordedBy,
    payload: event.payload,
    relatedConcernId: event?.relatedConcernId || null,
  }
}
