import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNativeTodayModel, NATIVE_TODAY_CONTRACT, NativeTodayContractError, validateNativeTodayModel } from '../src/domain/nativeToday.js'

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
