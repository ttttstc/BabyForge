import { createCareEvent, createCarePlanItem, createConcern, mergeCareEvents } from './careEvents.js'
import { concernsFromCareEvents } from './healthSupport.js'

export class CareEventSyncError extends Error {
  constructor(message, status, payload) {
    super(message)
    this.name = 'CareEventSyncError'
    this.status = status
    this.payload = payload
  }
}

async function request(path, options = {}, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new CareEventSyncError('同步服务不可用', 0, null)
  const response = await fetchImpl(path, { credentials: 'include', ...options })
  if (response.ok) return response.status === 204 ? null : response.json()
  let payload = null
  try { payload = await response.json() } catch { /* text body is not needed by callers */ }
  throw new CareEventSyncError(payload?.error || '线上同步暂时失败', response.status, payload)
}

export async function pullCareEvents(babyId, fetchImpl = globalThis.fetch) {
  if (!babyId) return { events: [], carePlanItems: [], concerns: [] }
  const payload = await request(`/api/events?babyId=${encodeURIComponent(babyId)}&includeVoided=true`, {}, fetchImpl)
  return {
    events: Array.isArray(payload?.events) ? payload.events.map((event) => createCareEvent(event)) : [],
    carePlanItems: Array.isArray(payload?.carePlanItems) ? payload.carePlanItems : [],
    concerns: Array.isArray(payload?.concerns) ? payload.concerns : [],
  }
}

export async function pullCareActors(babyId, fetchImpl = globalThis.fetch) {
  if (!babyId) return []
  const payload = await request(`/api/actors?babyId=${encodeURIComponent(babyId)}`, {}, fetchImpl)
  return Array.isArray(payload?.actors) ? payload.actors : []
}

export async function createCareActor(babyId, actor, fetchImpl = globalThis.fetch) {
  const payload = await request('/api/actors', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ babyId, actor }),
  }, fetchImpl)
  return payload?.actor || null
}

export async function sendCareEvent(event, operation = 'create', fetchImpl = globalThis.fetch) {
  if (operation === 'void') {
    return request(`/api/events/${encodeURIComponent(event.id)}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version: event.expectedVersion || event.version }),
    }, fetchImpl)
  }
  if (operation === 'correct' || operation === 'patch') {
    return request(`/api/events/${encodeURIComponent(event.correctedFromId || event.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: { ...event, version: event.expectedVersion || event.version } }),
    }, fetchImpl)
  }
  return request('/api/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event }),
  }, fetchImpl)
}

export async function syncCareEventChanges(changes = [], fetchImpl = globalThis.fetch) {
  const completed = []
  for (const change of changes) {
    await sendCareEvent({ ...change.event, expectedVersion: change.expectedVersion }, change.operation, fetchImpl)
    completed.push(change)
  }
  return completed
}

export function changedCareEvents(previous = [], next = []) {
  const previousById = new Map(previous.map((event) => [event.id, event]))
  return next.flatMap((event) => {
    const prior = previousById.get(event.id)
    // A local correction is represented by a corrected tombstone plus a new
    // replacement event. The replacement carries the API write; the tombstone
    // is produced by that same correction request and must not be sent twice.
    if (event.status === 'corrected' && !event.correctedFromId) return []
    if (!prior) {
      const correctedOriginal = event.correctedFromId ? previousById.get(event.correctedFromId) : null
      return [{ event, expectedVersion: correctedOriginal?.version, operation: event.correctedFromId ? 'correct' : 'create' }]
    }
    if (prior.updatedAt === event.updatedAt && prior.version === event.version && prior.status === event.status) return []
    return [{ event, expectedVersion: prior.version, operation: event.status === 'voided' ? 'void' : event.status === 'corrected' ? 'correct' : 'patch' }]
  })
}

function mergeRecords(local = [], incoming = [], normalize = (item) => item) {
  const byId = new Map(local.map((item) => [item.id, item]))
  for (const item of incoming) {
    const normalized = normalize(item)
    byId.set(normalized.id, normalized)
  }
  return [...byId.values()]
}

export function mergePulledState(state, payload, { since = null } = {}) {
  const careEvents = mergeCareEvents(state.careEvents || [], payload?.events || [])
  const concerns = since
    ? mergeRecords(state.concerns || [], payload?.concerns || [], (item) => createConcern(item))
    : (Array.isArray(payload?.concerns) ? payload.concerns.map((item) => createConcern(item)) : [])
  return {
    ...state,
    careEvents,
    carePlanItems: since
      ? mergeRecords(state.carePlanItems || [], payload?.carePlanItems || [], (item) => createCarePlanItem(item))
      : (Array.isArray(payload?.carePlanItems) ? payload.carePlanItems.map((item) => createCarePlanItem(item)) : []),
    // The event log is authoritative for concern lifecycle; the API concern
    // rows only hydrate details that are not present in the event payload.
    concerns: concernsFromCareEvents(careEvents, concerns),
    syncMeta: { ...(state.syncMeta || {}), status: 'online' },
  }
}

// Kept for imports from callers that still pass a cursor during migration.
export function mergeIncrementalRecords(state, payload) {
  const careEvents = mergeCareEvents(state.careEvents || [], payload?.events || [])
  const concerns = mergeRecords(state.concerns || [], payload?.concerns || [], (item) => createConcern(item))
  return {
    ...state,
    careEvents,
    carePlanItems: mergeRecords(state.carePlanItems || [], payload?.carePlanItems || [], (item) => createCarePlanItem(item)),
    concerns: concernsFromCareEvents(careEvents, concerns),
  }
}
