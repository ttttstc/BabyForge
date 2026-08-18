import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
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

test('natural-day filters keep local midnight boundaries across timezones', () => {
  const probe = `
    import { createCareEvent, queryCareEvents } from './src/domain/careEvents.js'
    import { localDayKey } from './src/domain/careSummary.js'
    const actor = { id: 'parent', displayName: '家长' }
    const before = new Date(2026, 7, 7, 23, 59, 59, 999)
    const after = new Date(2026, 7, 8, 0, 0, 0, 0)
    const events = [
      createCareEvent({ id: 'before', babyId: 'baby-1', category: 'diaper', occurredAt: before.toISOString(), actor, source: 'caregiver', payload: { kind: 'urine' } }),
      createCareEvent({ id: 'after', babyId: 'baby-1', category: 'diaper', occurredAt: after.toISOString(), actor, source: 'caregiver', payload: { kind: 'stool' } }),
    ]
    console.log(JSON.stringify({
      beforeDay: localDayKey(before),
      afterDay: localDayKey(after),
      ids: queryCareEvents(events, { from: '2026-08-07', to: '2026-08-07' }).map((event) => event.id),
    }))
  `
  const expectedDays = { 'Asia/Shanghai': ['2026-08-07', '2026-08-08'], 'America/New_York': ['2026-08-07', '2026-08-08'] }
  for (const [timezone, days] of Object.entries(expectedDays)) {
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', probe], { env: { ...process.env, TZ: timezone }, encoding: 'utf8' })
    assert.equal(result.status, 0, `${timezone}: ${result.stderr}`)
    const output = JSON.parse(result.stdout)
    assert.deepEqual([output.beforeDay, output.afterDay], days, timezone)
    assert.deepEqual(output.ids, ['before'], timezone)
  }
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

test('cross-category corrections preserve extensions and remove incompatible family fields', () => {
  const bottle = createCareEvent({
    id: 'bottle-original',
    babyId: 'baby-1',
    category: 'bottle_feeding',
    occurredAt: localIso(2026, 8, 6, 21, 40),
    actor,
    source: 'caregiver',
    payload: { milkType: 'formula', amountMl: 60, unit: 'mL', note: '夜间记录', handoffTag: 'keep-me' },
  })
  const bottleToBreastfeeding = correctCareEvent([bottle], bottle.id, {
    category: 'breastfeeding',
    payload: {},
  }, { now: localIso(2026, 8, 8, 9, 0) }).find((event) => event.correctedFromId === bottle.id)
  assert.equal(bottleToBreastfeeding.payload.amountMl, undefined)
  assert.equal(bottleToBreastfeeding.payload.milkType, undefined)
  assert.equal(bottleToBreastfeeding.payload.unit, undefined)
  assert.equal(bottleToBreastfeeding.payload.note, '夜间记录')
  assert.equal(bottleToBreastfeeding.payload.handoffTag, 'keep-me')

  const temperature = createCareEvent({
    id: 'temperature-original',
    babyId: 'baby-1',
    kind: 'measurement',
    category: 'temperature',
    occurredAt: localIso(2026, 8, 6, 21, 40),
    actor,
    source: 'caregiver',
    payload: { value: 38.2, unit: '°C', method: 'axillary', note: '先观察' },
  })
  const temperatureToObservation = correctCareEvent([temperature], temperature.id, {
    kind: 'caregiver_observation',
    category: 'temperature_observation',
    payload: { method: 'forehead' },
  }, { now: localIso(2026, 8, 8, 9, 0) }).find((event) => event.correctedFromId === temperature.id)
  assert.equal(temperatureToObservation.payload.value, undefined)
  assert.equal(temperatureToObservation.payload.unit, undefined)
  assert.equal(temperatureToObservation.payload.method, 'forehead')
  assert.equal(temperatureToObservation.payload.note, '先观察')
})
