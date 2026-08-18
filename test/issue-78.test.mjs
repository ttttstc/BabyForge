import test from 'node:test'
import assert from 'node:assert/strict'
import { correctCareEvent, createCareEvent, queryCareEvents } from '../src/domain/careEvents.js'
import { localDateKey } from '../src/domain/carePlan.js'
import { calendarDateKey } from '../src/domain/date.js'
import { getDailyCareSummary, localDayKey } from '../src/domain/careSummary.js'

const actor = { id: 'parent', displayName: '家长' }

function localIso(year, month, day, hour, minute, second = 0, millisecond = 0) {
  return new Date(year, month - 1, day, hour, minute, second, millisecond).toISOString()
}

test('natural-day helpers share browser-local calendar date at midnight boundaries', () => {
  const beforeMidnight = new Date(2026, 7, 7, 23, 59, 59, 999)
  const afterMidnight = new Date(2026, 7, 8, 0, 0, 0, 0)
  assert.equal(localDayKey(beforeMidnight), calendarDateKey(beforeMidnight))
  assert.equal(localDateKey(beforeMidnight), calendarDateKey(beforeMidnight))
  assert.notEqual(localDayKey(beforeMidnight), localDayKey(afterMidnight))
})

test('date-only fact filters use browser-local natural-day bounds', () => {
  const events = [
    createCareEvent({ id: 'start', babyId: 'baby-1', category: 'diaper', occurredAt: localIso(2026, 8, 7, 0, 0), actor, source: 'caregiver', payload: { kind: 'urine' } }),
    createCareEvent({ id: 'end', babyId: 'baby-1', category: 'diaper', occurredAt: localIso(2026, 8, 7, 23, 59, 59, 999), actor, source: 'caregiver', payload: { kind: 'stool' } }),
    createCareEvent({ id: 'next', babyId: 'baby-1', category: 'diaper', occurredAt: localIso(2026, 8, 8, 0, 0), actor, source: 'caregiver', payload: { kind: 'both' } }),
  ]
  assert.deepEqual(queryCareEvents(events, { from: '2026-08-07', to: '2026-08-07' }).map((event) => event.id), ['start', 'end'])
  assert.equal(getDailyCareSummary(events, localDayKey(new Date(2026, 7, 7, 12))).diaper.totalCount, 2)
})

test('correcting historical facts keeps occurredAt and unedited payload fields', () => {
  const original = createCareEvent({
    id: 'original',
    babyId: 'baby-1',
    category: 'bottle_feeding',
    occurredAt: localIso(2026, 8, 6, 21, 40),
    actor,
    source: 'caregiver',
    payload: { milkType: 'formula', amountMl: 60, note: '夜间记录', handoffTag: 'keep-me' },
  })
  const correctedEvents = correctCareEvent([original], original.id, {
    category: 'bottle_feeding',
    payload: { milkType: 'formula', amountMl: 80 },
  }, { now: localIso(2026, 8, 8, 9, 0) })
  const corrected = correctedEvents.find((event) => event.correctedFromId === original.id)
  assert.equal(corrected.occurredAt, original.occurredAt)
  assert.equal(corrected.payload.amountMl, 80)
  assert.equal(corrected.payload.note, '夜间记录')
  assert.equal(corrected.payload.handoffTag, 'keep-me')
  assert.equal(correctedEvents.find((event) => event.id === original.id).status, 'corrected')
})
