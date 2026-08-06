import { enqueueOutbox, readOutbox, removeOutbox } from './localDb.js'
import { createCareEvent, mergeCareEvents } from './careEvents.js'

async function request(path, options = {}, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('同步服务不可用')
  const response = await fetchImpl(path, { credentials: 'include', ...options })
  if (!response.ok) throw new Error('线上同步暂时失败')
  return response.json()
}

export async function pullCareEvents(babyId, since, fetchImpl = globalThis.fetch) {
  if (!babyId) return { events: [], carePlanItems: [], concerns: [], pulledAt: null }
  const params = new URLSearchParams({ babyId: String(babyId) })
  if (since) params.set('since', since)
  const payload = await request(`/api/events?${params.toString()}`, {}, fetchImpl)
  return {
    events: Array.isArray(payload?.events) ? payload.events.map((event) => createCareEvent(event)) : [],
    carePlanItems: Array.isArray(payload?.carePlanItems) ? payload.carePlanItems : [],
    concerns: Array.isArray(payload?.concerns) ? payload.concerns : [],
    pulledAt: payload?.pulledAt || new Date().toISOString(),
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

async function sendOutboxItem(item, fetchImpl) {
  const event = item.event
  if (!event?.id) return
  if (item.operation === 'create') {
    await request('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event }) }, fetchImpl)
  } else if (item.operation === 'void') {
    await request(`/api/events/${encodeURIComponent(event.id)}`, { method: 'DELETE' }, fetchImpl)
  } else {
    await request(`/api/events/${encodeURIComponent(event.id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event }) }, fetchImpl)
  }
}

export async function enqueueCareEvent(event, operation, owner) {
  return enqueueOutbox({ event, operation, queuedAt: new Date().toISOString() }, owner)
}

export async function flushCareEventOutbox(owner, fetchImpl = globalThis.fetch) {
  const pending = await readOutbox(owner)
  let sent = 0
  for (const item of pending) {
    try {
      await sendOutboxItem(item, fetchImpl)
      await removeOutbox(item.event.id, owner)
      sent += 1
    } catch {
      break
    }
  }
  return { sent, pending: Math.max(0, pending.length - sent) }
}

export function changedCareEvents(previous = [], next = []) {
  const previousById = new Map(previous.map((event) => [event.id, event]))
  return next.flatMap((event) => {
    const prior = previousById.get(event.id)
    if (!prior) return [{ event, operation: 'create' }]
    if (prior.updatedAt === event.updatedAt && prior.version === event.version && prior.status === event.status) return []
    return [{ event, operation: event.status === 'voided' ? 'void' : 'patch' }]
  })
}

export function mergePulledState(state, payload) {
  return {
    ...state,
    careEvents: mergeCareEvents(state.careEvents || [], payload?.events || []),
    carePlanItems: payload?.carePlanItems?.length ? payload.carePlanItems : state.carePlanItems || [],
    concerns: payload?.concerns?.length ? payload.concerns : state.concerns || [],
    syncMeta: { ...(state.syncMeta || {}), status: 'online', lastPulledAt: payload?.pulledAt || new Date().toISOString() },
  }
}
