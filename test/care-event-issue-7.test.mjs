import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CARE_EVENT_KINDS,
  applyCareEventsToLegacy,
  createCareEvent,
  correctCareEvent,
  migrateLegacyState,
  queryCareEvents,
  validateCareEvent,
  voidCareEvent,
} from '../src/domain/careEvents.js'
import { changedCareEvents, rollbackCareEventChanges, sendCareEvent } from '../src/domain/eventSync.js'
import { eventFromRow, safeEventInput } from '../functions/_shared/care.js'
import { onRequestDelete, onRequestPatch } from '../functions/api/events/[id].js'
import { eventCategoryLabel, eventKindLabel } from '../src/domain/careSummary.js'

test('CareEvent uses Issue #7 core protocol and open category payloads', () => {
  const event = createCareEvent({
    id: 'event-1',
    babyId: 'baby-1',
    kind: 'measurement',
    category: 'oxygen_saturation',
    occurredAt: '2026-08-06T08:00:00Z',
    recordedAt: '2026-08-06T09:00:00Z',
    actor: { id: 'nanny', displayName: '月嫂' },
    source: 'unknown',
    payload: { value: 98, unit: '%' },
  })
  assert.deepEqual(Object.keys(event), ['id', 'babyId', 'kind', 'category', 'occurredAt', 'recordedAt', 'actor', 'source', 'payload', 'status', 'version', 'createdAt', 'updatedAt'])
  assert.equal(validateCareEvent(event).valid, true)
  assert.ok(CARE_EVENT_KINDS.includes(event.kind))
})

test('legacy projection preserves original ids and separates occurred and recorded time', () => {
  const state = migrateLegacyState({
    baby: { id: 'baby-1' },
    observations: [{ id: 'obs-1', firstNoticedAt: '2026-08-06T08:00:00Z', createdAt: '2026-08-06T09:00:00Z' }],
    growthMeasurements: [],
    taskLogs: [],
  })
  assert.equal(state.careEvents[0].id, 'obs-1')
  assert.equal(state.careEvents[0].occurredAt, '2026-08-06T08:00:00.000Z')
  assert.equal(state.careEvents[0].recordedAt, '2026-08-06T09:00:00.000Z')
  assert.equal(state.careEvents[0].source, 'unknown')
})

test('correction creates a traceable replacement and void keeps a tombstone', () => {
  const original = createCareEvent({ id: 'event-1', babyId: 'baby-1', category: 'bottle_feeding', occurredAt: '2026-08-06T08:00:00Z', actor: { id: 'parent', displayName: '爸爸' }, source: 'caregiver', payload: { amountMl: 40 } })
  const correctedState = correctCareEvent([original], original.id, { payload: { amountMl: 60 } }, { now: '2026-08-06T09:00:00Z' })
  assert.equal(correctedState.find((event) => event.id === original.id).status, 'corrected')
  const corrected = correctedState.find((event) => event.correctedFromId === original.id)
  assert.equal(corrected.payload.amountMl, 60)
  assert.equal(voidCareEvent(corrected, { now: '2026-08-06T10:00:00Z' }).status, 'voided')
})

test('event queries filter baby, category, date and void status', () => {
  const events = [
    createCareEvent({ id: 'a', babyId: 'baby-1', category: 'language', occurredAt: '2026-08-06T08:00:00Z', source: 'caregiver', payload: {} }),
    createCareEvent({ id: 'b', babyId: 'baby-1', category: 'language', occurredAt: '2026-08-07T08:00:00Z', source: 'caregiver', payload: {}, status: 'voided' }),
    createCareEvent({ id: 'c', babyId: 'baby-2', category: 'language', occurredAt: '2026-08-06T08:00:00Z', source: 'caregiver', payload: {} }),
  ]
  assert.deepEqual(queryCareEvents(events, { babyId: 'baby-1', category: 'language', from: '2026-08-06', to: '2026-08-06T23:59:59Z' }).map((event) => event.id), ['a'])
  assert.deepEqual(queryCareEvents(events, { babyId: 'baby-1', includeVoided: true }).map((event) => event.id), ['a', 'b'])
})

test('canonical projections keep the latest action state and correction sends one request', () => {
  const base = { baby: { id: 'baby-1' }, taskLogs: [], adminTaskRecords: [], milestoneRecords: [], growthMeasurements: [] }
  const projected = applyCareEventsToLegacy(base, [
    createCareEvent({ id: 'admin-old', babyId: 'baby-1', category: 'admin_task', occurredAt: '2026-08-06T08:00:00Z', updatedAt: '2026-08-06T08:00:00Z', payload: { taskId: 'paperwork', status: 'pending' } }),
    createCareEvent({ id: 'admin-new', babyId: 'baby-1', category: 'admin_task', occurredAt: '2026-08-06T09:00:00Z', updatedAt: '2026-08-06T09:00:00Z', payload: { taskId: 'paperwork', status: 'done' } }),
    createCareEvent({ id: 'growth-1', babyId: 'baby-1', kind: 'measurement', category: 'growth_measurement', payload: { type: 'weight', value: 3.2 } }),
  ])
  assert.deepEqual(projected.adminTaskRecords.map((item) => item.status), ['done'])
  assert.equal(projected.growthMeasurements[0].value, 3.2)

  const original = createCareEvent({ id: 'original', babyId: 'baby-1', category: 'language', version: 3, payload: { note: 'old' } })
  const replacement = correctCareEvent([original], original.id, { payload: { note: 'new' } }, { now: '2026-08-06T10:00:00Z' })
  const correction = changedCareEvents([original], replacement)
  assert.deepEqual(correction.map((change) => change.operation), ['correct'])
  assert.equal(correction[0].expectedVersion, 3)
})

test('failed correction rollback restores the original active event', () => {
  const original = createCareEvent({ id: 'original', babyId: 'baby-1', category: 'language', version: 3, payload: { note: 'old' }, status: 'active' })
  const correctedState = correctCareEvent([original], original.id, { payload: { note: 'new' } }, { now: '2026-08-06T10:00:00Z' })
  const changes = changedCareEvents([original], correctedState)
  const restored = rollbackCareEventChanges([original], correctedState, changes)
  assert.equal(restored.length, 1)
  assert.equal(restored[0].id, original.id)
  assert.equal(restored[0].status, 'active')
  assert.equal(restored[0].version, 3)
})

test('event transport maps all write operations and preserves API errors', async () => {
  const calls = []
  const fetchImpl = async (path, options) => {
    calls.push({ path, options })
    return new Response(JSON.stringify({ event: { id: 'server-event' } }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const event = createCareEvent({ id: 'event-1', babyId: 'baby-1', category: 'language', payload: {} })
  await sendCareEvent(event, 'create', fetchImpl)
  await sendCareEvent({ ...event, correctedFromId: 'event-0', expectedVersion: 2 }, 'correct', fetchImpl)
  await sendCareEvent({ ...event, expectedVersion: 1 }, 'void', fetchImpl)
  assert.deepEqual(calls.map((call) => call.options.method || 'POST'), ['POST', 'PATCH', 'DELETE'])
  assert.equal(calls[1].path, '/api/events/event-0')
  assert.equal(calls[2].path, '/api/events/event-1')

  const failedFetch = async () => new Response(JSON.stringify({ error: '冲突', code: 'EVENT_CONFLICT' }), { status: 409, headers: { 'content-type': 'application/json' } })
  await assert.rejects(() => sendCareEvent(event, 'create', failedFetch), (error) => error.status === 409 && error.payload.code === 'EVENT_CONFLICT')
})

test('server canonical input and row mapping preserve actor, source and correction link', () => {
  const event = safeEventInput({ id: 'event-1', babyId: 'baby-1', kind: 'measurement', category: 'oxygen_saturation', occurredAt: '2026-08-06T08:00:00Z', recordedAt: '2026-08-06T09:00:00Z', actor: { id: 'device', displayName: '设备' }, source: 'unknown', payload: { value: 98 }, version: 1 }, {}, { requireId: true, requireActor: true, requireTimestamps: true })
  assert.equal(event.category, 'oxygen_saturation')
  assert.equal(event.actor.id, 'device')
  assert.equal(event.source, 'unknown')
  assert.deepEqual(eventFromRow({ id: 'event-1', baby_id: 'baby-1', kind: 'measurement', category: 'oxygen_saturation', occurred_at: event.occurredAt, recorded_at: event.recordedAt, actor_id: 'device', actor_display_name: '设备', event_source: 'unknown', payload_json: JSON.stringify(event.payload), status: 'active', corrected_from_id: 'event-0', version: 2 }), { id: 'event-1', babyId: 'baby-1', kind: 'measurement', category: 'oxygen_saturation', occurredAt: event.occurredAt, recordedAt: event.recordedAt, actor: { id: 'device', displayName: '设备' }, source: 'unknown', payload: { value: 98 }, status: 'active', correctedFromId: 'event-0', version: 2, createdAt: undefined, updatedAt: undefined })
})

test('server input defaults unclear source to unknown and rejects direct correction links', () => {
  const base = { id: 'event-1', babyId: 'baby-1', category: 'language', occurredAt: '2026-08-06T08:00:00Z', recordedAt: '2026-08-06T09:00:00Z', actor: { id: 'parent', displayName: '爸爸' }, payload: {} }
  assert.equal(safeEventInput(base, {}, { requireId: true, requireActor: true, requireTimestamps: true }).source, 'unknown')
  assert.throws(() => safeEventInput({ ...base, correctedFromId: 'event-0' }, {}, { requireId: true, requireActor: true, requireTimestamps: true }), /版本化修改接口/)
  assert.equal(safeEventInput({ ...base, correctedFromId: 'event-0' }, {}, { allowCorrectedFromId: true, requireId: true, requireActor: true, requireTimestamps: true }).correctedFromId, 'event-0')
})

test('server validates the six P0 record payloads without narrowing legacy categories', () => {
  const base = { id: 'p0', babyId: 'baby-1', occurredAt: '2026-08-07T08:00:00Z', recordedAt: '2026-08-07T08:00:00Z', actor: { id: 'parent', displayName: '爸爸' }, source: 'caregiver', payload: {} }
  assert.throws(() => safeEventInput({ ...base, category: 'bottle_feeding', payload: { milkType: 'formula' } }, {}, { requireId: true, requireActor: true, requireTimestamps: true }), /实际摄入量/)
  assert.throws(() => safeEventInput({ ...base, category: 'sleep', payload: { endedAt: '2026-08-07T07:00:00Z' } }, {}, { requireId: true, requireActor: true, requireTimestamps: true }), /结束时间必须晚于开始时间/)
  assert.throws(() => safeEventInput({ ...base, category: 'temperature', kind: 'measurement', payload: { value: 36.5, unit: '°C' } }, {}, { requireId: true, requireActor: true, requireTimestamps: true }), /测量部位或方法/)
  assert.throws(() => safeEventInput({ ...base, category: 'temperature', kind: 'measurement', payload: { value: '', unit: '°C', method: 'axillary' } }, {}, { requireId: true, requireActor: true, requireTimestamps: true }), /体温观察/)
  assert.equal(safeEventInput({ ...base, category: 'temperature_observation' }, {}, { requireId: true, requireActor: true, requireTimestamps: true }).category, 'temperature_observation')
  assert.equal(safeEventInput({ ...base, category: 'language' }, {}, { requireId: true, requireActor: true, requireTimestamps: true }).category, 'language')
})

test('summary labels keep canonical kind and open categories readable', () => {
  assert.equal(eventKindLabel('measurement', 'zh-CN'), '测量')
  assert.equal(eventCategoryLabel('oxygen_saturation', 'zh-CN'), '血氧饱和度')
  assert.equal(eventCategoryLabel('future_metric', 'en-US'), 'future metric')
})

function authorizedEventFixture(version = 1) {
  let current = {
    id: 'event-1', baby_id: 'baby-1', kind: 'caregiver_observation', category: 'language', type: 'care_action',
    occurred_at: '2026-08-06T08:00:00.000Z', recorded_at: '2026-08-06T09:00:00.000Z',
    actor_id: 'parent', actor_display_name: '爸爸', recorded_by_id: 'parent', recorded_by_name: '爸爸',
    source: 'caregiver_entered', event_source: 'caregiver', payload_json: JSON.stringify({ note: 'old' }),
    status: 'active', corrected_from_id: null, version, created_at: '2026-08-06T08:00:00.000Z', updated_at: '2026-08-06T09:00:00.000Z', updated_by: 'account-admin',
  }
  const session = { token: 'token', expires_at: '2099-01-01T00:00:00.000Z', id: 'account-admin', username: 'admin', role: 'admin', display_name: '管理员' }
  const env = { DB: { async batch(statements) {
    const results = []
    for (const statement of statements) results.push(await statement.run())
    return results
  }, prepare(sql) {
    return { bind(...args) {
      return {
        async first() {
          if (sql.includes('FROM auth_sessions')) return session
          if (sql.includes('SELECT e.* FROM care_events')) return current
          if (sql.includes('SELECT * FROM care_events WHERE id = ?')) return current
          return null
        },
        async run() {
          if (sql.includes("status = 'corrected'")) current = { ...current, status: 'corrected', version: current.version + 1 }
          if (sql.includes("status = 'voided'")) current = { ...current, status: 'voided', version: current.version + 1 }
          if (sql.includes('INSERT INTO care_events')) current = { ...current, id: args[0], status: 'active', corrected_from_id: 'event-1', version: 1 }
          return { meta: { changes: 1 } }
        },
      }
    } }
  } } }
  return { env, get current() { return current } }
}

test('authorized correction and void enforce version conflicts and preserve tombstones', async () => {
  const stale = authorizedEventFixture(2)
  const staleRequest = new Request('https://babyforge.test/api/events/event-1', { method: 'PATCH', headers: { cookie: 'babyforge_session=token', 'content-type': 'application/json' }, body: JSON.stringify({ version: 1, payload: { note: 'new' } }) })
  assert.equal((await onRequestPatch({ request: staleRequest, env: stale.env, params: { id: 'event-1' } })).status, 409)
  assert.equal(stale.current.status, 'active')

  const fixture = authorizedEventFixture()
  const patchRequest = new Request('https://babyforge.test/api/events/event-1', { method: 'PATCH', headers: { cookie: 'babyforge_session=token', 'content-type': 'application/json' }, body: JSON.stringify({ version: 1, payload: { note: 'corrected' } }) })
  const correctedResponse = await onRequestPatch({ request: patchRequest, env: fixture.env, params: { id: 'event-1' } })
  assert.equal(correctedResponse.status, 201)
  assert.equal(fixture.current.status, 'active')
  assert.equal(fixture.current.corrected_from_id, 'event-1')

  const staleDelete = authorizedEventFixture(2)
  const deleteRequest = new Request('https://babyforge.test/api/events/event-1', { method: 'DELETE', headers: { cookie: 'babyforge_session=token', 'content-type': 'application/json' }, body: JSON.stringify({ version: 1 }) })
  assert.equal((await onRequestDelete({ request: deleteRequest, env: staleDelete.env, params: { id: 'event-1' } })).status, 409)

  const voided = authorizedEventFixture()
  const voidRequest = new Request('https://babyforge.test/api/events/event-1', { method: 'DELETE', headers: { cookie: 'babyforge_session=token', 'content-type': 'application/json' }, body: JSON.stringify({ version: 1 }) })
  assert.equal((await onRequestDelete({ request: voidRequest, env: voided.env, params: { id: 'event-1' } })).status, 200)
  assert.equal(voided.current.status, 'voided')
})
