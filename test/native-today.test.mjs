import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCareEvent, correctCareEvent } from '../src/domain/careEvents.js'
import { buildNativeTodayModel, localDayForTimezone, NATIVE_TODAY_CONTRACT, NativeTodayContractError, validateNativeTodayModel } from '../src/domain/nativeToday.js'

const baby = { id: 'baby-1', nickname: '泥蛙', birthDate: '2026-05-24' }
const base = { baby, timezone: 'Asia/Shanghai', now: '2026-08-18T02:00:00.000Z', permissions: { canEdit: true }, recorder: { id: 'u1', displayName: '妈妈' } }

test('native today model keeps missing facts unknown instead of zero', () => {
  const model = buildNativeTodayModel(base)
  assert.equal(model.contract, NATIVE_TODAY_CONTRACT)
  assert.deepEqual(model.summary.feeding, { recorded: false, value: null, unit: null, label: '未记录' })
  assert.equal(model.summary.sleep.label, '未记录')
  assert.equal(model.summary.diaper.label, '未记录')
})

test('native today model uses local day, active correction state, and shared units', () => {
  const model = buildNativeTodayModel({
    ...base,
    events: [
      { id: 'old', category: 'bottle_feeding', occurredAt: '2026-08-18T00:00:00.000Z', status: 'corrected', version: 2, payload: { amountMl: 60 }, actor: { displayName: '爸爸' } },
      { id: 'new', correctedFromId: 'old', category: 'bottle_feeding', occurredAt: '2026-08-18T00:00:00.000Z', status: 'active', version: 1, payload: { amountMl: 90 }, actor: { displayName: '妈妈' } },
      { id: 'sleep', category: 'sleep', occurredAt: '2026-08-17T15:00:00.000Z', status: 'active', version: 1, payload: { endedAt: '2026-08-17T18:00:00.000Z' }, actor: { displayName: '妈妈' } },
      { id: 'void', category: 'diaper', occurredAt: '2026-08-18T01:00:00.000Z', status: 'voided', version: 2, payload: { kind: 'urine' } },
    ],
  })
  assert.equal(model.selectedDay, '2026-08-18')
  assert.equal(model.summary.feeding.label, '90 mL')
  assert.equal(model.summary.sleep.label, '2 小时')
  assert.equal(model.summary.diaper.label, '未记录')
  assert.deepEqual(model.recentFacts.map((event) => event.id), ['new', 'sleep'])
})

test('native today model carries photo privacy, permissions, tasks and metadata', () => {
  const model = buildNativeTodayModel({
    ...base,
    photos: [{ id: 'p1', takenAt: '2026-08-18T01:12:00.000Z', fileName: 'first.jpg', contentUrl: '/api/photos/p1', contentType: 'image/jpeg', sizeBytes: 42 }],
    tasks: [{ id: 'sleep-check', title: { zh: '检查睡眠环境' }, detail: { zh: '保持平整睡眠面' } }],
  })
  assert.equal(model.photos[0].contentUrl, '/api/photos/p1')
  assert.equal(model.photoPolicy.aiUpload, 'explicit-only')
  assert.equal(model.photoPolicy.reportsIncludeOriginals, false)
  assert.equal(model.tasks[0].source, '共享照护事项')
  assert.equal(model.permissions.canDeletePhotos, true)
})

test('cross-end today contract rejects invented zero values and unknown versions', () => {
  const valid = buildNativeTodayModel(base)
  assert.equal(validateNativeTodayModel(valid), valid)
  assert.throws(() => validateNativeTodayModel({ ...valid, contractVersion: '9.0.0' }), (error) => error instanceof NativeTodayContractError && error.code === 'UNKNOWN_VERSION')
  assert.throws(() => validateNativeTodayModel({ ...valid, summary: { ...valid.summary, feeding: { recorded: false, value: 0, unit: 'mL', label: '0 mL' } } }), (error) => error instanceof NativeTodayContractError && error.code === 'INVALID_UNKNOWN')
})

test('native today derives its default day at the local midnight boundary', () => {
  assert.equal(localDayForTimezone('2026-08-17T15:59:59.999Z', 'Asia/Shanghai'), '2026-08-17')
  assert.equal(localDayForTimezone('2026-08-17T16:00:00.000Z', 'Asia/Shanghai'), '2026-08-18')
  assert.equal(localDayForTimezone('2026-08-18T03:30:00.000Z', 'America/New_York'), '2026-08-17')
})

test('historical additions and corrections remain on their selected local day', () => {
  const original = createCareEvent({
    id: 'historical-diaper', babyId: baby.id, category: 'diaper', occurredAt: '2026-08-17T08:30:00.000Z',
    actor: { id: 'u1', displayName: '妈妈' }, source: 'caregiver', payload: { kind: 'urine' },
  }, { now: '2026-08-18T02:00:00.000Z' })
  const corrected = correctCareEvent([original], original.id, {
    id: 'historical-diaper-corrected', occurredAt: original.occurredAt, payload: { kind: 'both' },
  }, { now: '2026-08-18T02:05:00.000Z' })
  const model = buildNativeTodayModel({ ...base, selectedDay: '2026-08-17', events: corrected })
  assert.equal(model.summary.diaper.label, '1 次')
  assert.deepEqual(model.recentFacts.map((event) => event.id), ['historical-diaper-corrected'])
  assert.equal(model.recentFacts[0].occurredAt, original.occurredAt)
})

test('undoing a correction with a restoring correction reactivates the prior fact values', () => {
  const original = createCareEvent({
    id: 'temperature-original', babyId: baby.id, category: 'temperature', occurredAt: '2026-08-18T01:00:00.000Z',
    actor: { id: 'u1', displayName: '妈妈' }, source: 'caregiver', payload: { value: 36.8, unit: '°C', method: 'axillary' },
  }, { now: '2026-08-18T02:00:00.000Z' })
  const corrected = correctCareEvent([original], original.id, { id: 'temperature-corrected', payload: { value: 37.2, unit: '°C', method: 'axillary' } }, { now: '2026-08-18T02:05:00.000Z' })
  const replacement = corrected.find((event) => event.id === 'temperature-corrected')
  const restored = correctCareEvent(corrected, replacement.id, { id: 'temperature-restored', occurredAt: original.occurredAt, kind: original.kind, category: original.category, payload: original.payload }, { now: '2026-08-18T02:06:00.000Z' })
  const model = buildNativeTodayModel({ ...base, events: restored })
  assert.equal(model.recentFacts[0].id, 'temperature-restored')
  assert.equal(model.recentFacts[0].title, '体温 36.8 °C')
})

test('old imported photos stay on their captured day instead of the upload day', () => {
  const photos = [
    { id: 'old-photo', takenAt: '2026-08-12T02:00:00.000Z', createdAt: '2026-08-18T02:00:00.000Z', contentUrl: '/api/photos/old-photo', contentType: 'image/jpeg', sizeBytes: 42 },
  ]
  assert.deepEqual(buildNativeTodayModel({ ...base, selectedDay: '2026-08-12', photos }).photos.map((photo) => photo.id), ['old-photo'])
  assert.deepEqual(buildNativeTodayModel({ ...base, selectedDay: '2026-08-18', photos }).photos, [])
})

test('value-free temperature stays a caregiver observation across Web and native semantics', async () => {
  const event = createCareEvent({ category: 'temperature_observation', payload: { value: null } }, { now: '2026-08-18T02:00:00.000Z' })
  assert.equal(event.kind, 'caregiver_observation')
  const arkts = await readFile(new URL('../harmony/entry/src/main/ets/data/NativeTodayContract.ets', import.meta.url), 'utf8')
  assert.match(arkts, /kind: category === 'growth_measurement' \|\| category === 'temperature' \? 'measurement' : 'caregiver_observation'/)
})
