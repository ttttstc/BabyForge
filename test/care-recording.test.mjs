import test from 'node:test'
import assert from 'node:assert/strict'
import { assertCareRecordInput, validateCareRecordInput } from '../src/domain/careEvents.js'
import { eventTitle, getDailyCareSummary, getLocalDayEvents } from '../src/domain/careSummary.js'

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

test('P0 care record validation keeps complete sleep intervals and numeric facts honest', () => {
  assert.equal(validateCareRecordInput({ category: 'sleep', occurredAt: '2026-08-07T23:30:00Z', payload: { endedAt: '2026-08-08T01:00:00Z' } }).valid, true)
  assert.equal(validateCareRecordInput({ category: 'sleep', occurredAt: '2026-08-07T23:30:00Z', payload: { endedAt: '2026-08-07T23:00:00Z' } }).valid, false)
  assert.equal(validateCareRecordInput({ category: 'temperature_observation', occurredAt: '2026-08-07T10:00:00Z', payload: {} }).valid, true)
  assert.equal(validateCareRecordInput({ category: 'temperature_observation', occurredAt: '2026-08-07T10:00:00Z', payload: { value: 36.5 } }).valid, false)
  assert.equal(validateCareRecordInput({ category: 'growth_measurement', occurredAt: '2026-08-07T10:00:00Z', payload: { type: 'weight', value: 3.5, unit: 'kg', measuredAt: '2026-08-07' } }).valid, true)
  assert.throws(() => assertCareRecordInput({ category: 'bottle_feeding', occurredAt: '2026-08-07T10:00:00Z', payload: { milkType: 'formula', amountMl: '' } }), /实际摄入量/)
})

test('daily care summary uses local calendar day and clips sleep across midnight', () => {
  const events = [
    event('bottle_feeding', '2026-08-07T15:40:00Z', { milkType: 'formula', amountMl: 50, unit: 'mL' }),
    event('breastfeeding', '2026-08-07T08:00:00Z', {}),
    event('sleep', '2026-08-06T15:30:00Z', { endedAt: '2026-08-06T17:30:00Z' }),
    event('diaper', '2026-08-07T12:00:00Z', { kind: 'both' }),
    event('medication', '2026-08-07T13:00:00Z', { medicationName: '维生素 D', amount: '1', unit: '滴' }),
    event('diaper', '2026-08-07T14:00:00Z', { kind: 'urine' }, { status: 'voided' }),
  ]
  const summary = getDailyCareSummary(events, '2026-08-07')
  assert.equal(summary.feeding.totalCount, 2)
  assert.equal(summary.feeding.bottleMl, 50)
  assert.equal(summary.sleep.segmentCount, 1)
  assert.equal(summary.sleep.minutes, 90)
  assert.equal(summary.diaper.wetCount, 1)
  assert.equal(summary.diaper.stoolCount, 1)
  assert.equal(summary.medication.count, 1)
  assert.equal(getLocalDayEvents(events, '2026-08-07').some((item) => item.status === 'voided'), false)
})

test('record titles expose type, interval, and missing temperature value', () => {
  assert.equal(eventTitle(event('bottle_feeding', '2026-08-07T10:00:00Z', { milkType: 'formula', amountMl: 50 }), 'zh-CN'), '配方奶 50 mL')
  assert.equal(eventTitle(event('sleep', '2026-08-07T10:00:00Z', { endedAt: '2026-08-07T11:15:00Z' }), 'zh-CN'), '睡眠 1小时15分')
  assert.equal(eventTitle(event('temperature_observation', '2026-08-07T10:00:00Z', {}), 'zh-CN'), '体温观察 · 数值未记录')
})
