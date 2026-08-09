import test from 'node:test'
import assert from 'node:assert/strict'
import { assertCareRecordInput, validateCareRecordInput } from '../src/domain/careEvents.js'
import { eventTitle, getDailyCareSummary, getLocalDayEvents, localDayKey } from '../src/domain/careSummary.js'

const actor = { id: 'mother', displayName: '妈妈' }

function event(category, occurredAt, payload, extra = {}) {
  return {
    id: `${category}-${occurredAt}`,
    babyId: 'baby-1',
    kind: extra.kind || 'caregiver_observation',
    category,
    occurredAt,
    recordedAt: occurredAt,
    actor,
    source: 'caregiver',
    payload,
    status: extra.status || 'active',
    version: 1,
  }
}

function localIso(year, month, day, hour, minute) {
  return new Date(year, month - 1, day, hour, minute).toISOString()
}

test('P0 care record validation keeps complete sleep intervals and numeric facts honest', () => {
  assert.equal(validateCareRecordInput({ category: 'sleep', occurredAt: '2026-08-07T23:30:00Z', payload: { endedAt: '2026-08-08T01:00:00Z' } }).valid, true)
  assert.equal(validateCareRecordInput({ category: 'sleep', occurredAt: '2026-08-07T23:30:00Z', payload: { endedAt: '2026-08-07T23:00:00Z' } }).valid, false)
  assert.equal(validateCareRecordInput({ category: 'temperature_observation', occurredAt: '2026-08-07T10:00:00Z', payload: {} }).valid, true)
  assert.equal(validateCareRecordInput({ category: 'temperature_observation', occurredAt: '2026-08-07T10:00:00Z', payload: { value: 36.5 } }).valid, false)
  assert.equal(validateCareRecordInput({ category: 'temperature_observation', occurredAt: '2026-08-07T10:00:00Z', payload: { value: null } }).valid, true)
  assert.equal(validateCareRecordInput({ category: 'temperature', occurredAt: '2026-08-07T10:00:00Z', payload: { value: 36.5, unit: '°C', method: 'axillary' } }).valid, true)
  assert.equal(validateCareRecordInput({ category: 'temperature', occurredAt: '2026-08-07T10:00:00Z', payload: { value: '', unit: '°C', method: 'axillary' } }).errors[0].field, 'payload.value')
  assert.equal(validateCareRecordInput({ category: 'growth_measurement', occurredAt: '2026-08-07T10:00:00Z', payload: { type: 'weight', value: 3.5, unit: 'kg', measuredAt: '2026-08-07' } }).valid, true)
  assert.equal(validateCareRecordInput({ category: 'growth_measurement', occurredAt: '2026-08-07T10:00:00Z', payload: { type: 'headCircumference', value: 35, unit: 'cm', measuredAt: '2026-08-07' } }).valid, true)
  assert.throws(() => assertCareRecordInput({ category: 'bottle_feeding', occurredAt: '2026-08-07T10:00:00Z', payload: { milkType: 'formula', amountMl: '' } }), /实际摄入量/)
  assert.throws(() => assertCareRecordInput({ category: 'diaper', occurredAt: '2026-08-07T10:00:00Z', payload: { kind: 'invalid' } }), /尿布类型/)
})

test('daily care summary uses local calendar day and clips sleep across midnight', () => {
  const selectedDay = localDayKey(new Date(2026, 7, 7, 12))
  const previousDay = localDayKey(new Date(2026, 7, 6, 12))
  const events = [
    event('bottle_feeding', localIso(2026, 8, 7, 15, 40), { milkType: 'formula', amountMl: 50, unit: 'mL' }),
    event('breastfeeding', localIso(2026, 8, 7, 8, 0), {}),
    event('sleep', localIso(2026, 8, 6, 23, 30), { endedAt: localIso(2026, 8, 7, 0, 30) }),
    event('diaper', localIso(2026, 8, 7, 12, 0), { kind: 'both' }),
    event('medication', localIso(2026, 8, 7, 13, 0), { medicationName: '维生素 D', amount: '1', unit: '滴' }),
    event('growth_measurement', localIso(2026, 8, 7, 14, 0), { type: 'headCircumference', value: 35, unit: 'cm', measuredAt: '2026-08-07' }),
    event('diaper', localIso(2026, 8, 7, 14, 0), { kind: 'urine' }, { status: 'voided' }),
  ]
  const summary = getDailyCareSummary(events, selectedDay)
  assert.equal(summary.feeding.totalCount, 2)
  assert.equal(summary.feeding.bottleMl, 50)
  assert.equal(summary.sleep.segmentCount, 1)
  assert.equal(summary.sleep.minutes, 30)
  assert.equal(summary.diaper.wetCount, 1)
  assert.equal(summary.diaper.stoolCount, 1)
  assert.equal(summary.medication.count, 1)
  assert.equal(summary.growth.count, 1)
  assert.equal(summary.growth.headCircumferenceCount, 1)
  assert.equal(getDailyCareSummary(events, previousDay).sleep.minutes, 30)
  assert.equal(getLocalDayEvents(events, selectedDay).some((item) => item.status === 'voided'), false)
})

test('daily care summary excludes corrected and voided facts', () => {
  const active = event('diaper', localIso(2026, 8, 7, 9, 0), { kind: 'urine' })
  const corrected = event('diaper', localIso(2026, 8, 7, 10, 0), { kind: 'stool' }, { status: 'corrected' })
  const replacement = event('diaper', localIso(2026, 8, 7, 10, 0), { kind: 'both' })
  const voided = event('diaper', localIso(2026, 8, 7, 11, 0), { kind: 'urine' }, { status: 'voided' })
  const summary = getDailyCareSummary([active, corrected, replacement, voided], localDayKey(new Date(2026, 7, 7, 12)))
  assert.equal(summary.diaper.totalCount, 2)
  assert.equal(summary.diaper.wetCount, 2)
  assert.equal(summary.diaper.stoolCount, 1)
})

test('record titles expose type, interval, and missing temperature value', () => {
  assert.equal(eventTitle(event('bottle_feeding', '2026-08-07T10:00:00Z', { milkType: 'formula', amountMl: 50 }), 'zh-CN'), '配方奶 50 mL')
  assert.equal(eventTitle(event('sleep', '2026-08-07T10:00:00Z', { endedAt: '2026-08-07T11:15:00Z' }), 'zh-CN'), '睡眠 1小时15分')
  assert.equal(eventTitle(event('temperature_observation', '2026-08-07T10:00:00Z', {}), 'zh-CN'), '体温观察 · 数值未记录')
})
