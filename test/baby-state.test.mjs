import test from 'node:test'
import assert from 'node:assert/strict'

import { createCareEvent, correctCareEvent } from '../src/domain/careEvents.js'
import { projectBabyState, traceBabyState } from '../src/domain/babyState.js'

const NOW = '2026-08-07T12:00:00.000Z'
const BABY = { id: 'baby-state', nickname: '小舟', birthDate: '2026-07-01', sex: 'female' }

function event(id, input) {
  return createCareEvent({
    id,
    babyId: BABY.id,
    actor: { id: input.actorId || 'parent-mother', displayName: input.actorName || '妈妈' },
    source: input.source || 'caregiver',
    ...input,
  }, { now: NOW })
}

function feed(id, occurredAt, actorId = 'parent-mother') {
  return event(id, { category: 'breastfeeding', occurredAt, actorId, payload: { mode: 'breastfeeding' } })
}

test('BabyStateSnapshot forms a personal feeding baseline and flags a lower current count', () => {
  const events = [
    ...Array.from({ length: 9 }, (_, index) => feed(`day-1-${index}`, `2026-08-01T${String(index + 1).padStart(2, '0')}:00:00Z`)),
    ...Array.from({ length: 10 }, (_, index) => feed(`day-2-${index}`, `2026-08-02T${String(index + 1).padStart(2, '0')}:00:00Z`)),
    ...Array.from({ length: 9 }, (_, index) => feed(`day-3-${index}`, `2026-08-03T${String(index + 1).padStart(2, '0')}:00:00Z`)),
    ...Array.from({ length: 10 }, (_, index) => feed(`day-4-${index}`, `2026-08-04T${String(index + 1).padStart(2, '0')}:00:00Z`)),
    ...Array.from({ length: 5 }, (_, index) => feed(`today-${index}`, `2026-08-07T0${index + 1}:00:00Z`)),
  ]
  const snapshot = projectBabyState({ baby: BABY, events, now: NOW })
  assert.equal(snapshot.baseline.feeding.status, 'established')
  assert.deepEqual(snapshot.baseline.feeding.value.samples, [9, 10, 9, 10])
  assert.equal(snapshot.current.changes.find((item) => item.dimension === 'feeding')?.status, 'below-personal-baseline')
  assert.equal(snapshot.current.changes.find((item) => item.dimension === 'feeding')?.currentValue, 5)
})

test('BabyStateSnapshot states explicitly when there is not enough personal history', () => {
  const snapshot = projectBabyState({ baby: BABY, events: [feed('today', NOW)], now: NOW })
  assert.equal(snapshot.baseline.feeding.status, 'missing')
  assert.equal(snapshot.current.changes[0].status, 'baseline-unavailable')
  assert.match(snapshot.baseline.prior.limitation, /暂无个人基线/)
})

test('conflicting caregiver observations remain pending instead of being silently merged', () => {
  const events = [
    event('alert-mother', { category: 'observation', actorId: 'parent-mother', payload: { stateKey: 'alertness.observation', value: 'usual' }, occurredAt: '2026-08-07T08:00:00Z' }),
    event('alert-nanny', { category: 'observation', actorId: 'nanny', actorName: '月嫂', payload: { stateKey: 'alertness.observation', value: 'different' }, occurredAt: '2026-08-07T09:00:00Z' }),
  ]
  const snapshot = projectBabyState({ baby: BABY, events, now: NOW })
  assert.equal(snapshot.current.conflicts[0].status, 'conflict-pending')
  assert.deepEqual(new Set(snapshot.current.conflicts[0].sourceEventIds), new Set(['alert-mother', 'alert-nanny']))
})

test('a corrected temperature replaces the prior fact in current state while preserving traceability', () => {
  const original = event('temperature-old', { category: 'temperature', kind: 'measurement', occurredAt: '2026-08-07T08:00:00Z', payload: { value: 38.2, unit: '°C' } })
  const correctedEvents = correctCareEvent([original], original.id, { payload: { value: 36.8, unit: '°C' } }, { now: '2026-08-07T10:00:00Z' })
  const snapshot = projectBabyState({ baby: BABY, events: correctedEvents, now: NOW })
  const temperature = snapshot.current.known.find((item) => item.stateKey === 'temperature.reading')
  assert.equal(temperature.value.value, 36.8)
  assert.equal(snapshot.history.find((item) => item.eventId === original.id)?.status, 'corrected')
  assert.equal(traceBabyState(snapshot, original.id).some((item) => item.eventId === original.id), true)
  assert.ok(traceBabyState(snapshot, correctedEvents.find((item) => item.correctedFromId === original.id).id).length > 0)
})

test('professional conclusions win current-state priority without deleting parent observations', () => {
  const caregiver = event('alert-caregiver', { category: 'observation', payload: { stateKey: 'alertness.observation', value: 'usual' }, occurredAt: '2026-08-07T08:00:00Z' })
  const professional = event('alert-professional', { kind: 'professional_conclusion', category: 'doctor_instruction', source: 'clinical_record', actorId: 'doctor', actorName: '儿科医生', occurredAt: '2026-08-07T10:00:00Z', payload: { stateKey: 'alertness.observation', value: 'professional conclusion', conclusion: '按医生意见记录' } })
  const snapshot = projectBabyState({ baby: BABY, events: [caregiver, professional], now: NOW })
  const alertness = snapshot.current.known.find((item) => item.stateKey === 'alertness.observation')
  assert.equal(alertness.confidence, 'professional')
  assert.equal(alertness.value, 'professional conclusion')
  assert.ok(snapshot.history.some((item) => item.eventId === caregiver.id))
  assert.ok(traceBabyState(snapshot, caregiver.id).some((item) => item.eventId === caregiver.id))
})

test('short-lived illness and medication facts stay current only while their TTL is valid', () => {
  const snapshot = projectBabyState({
    baby: BABY,
    events: [
      event('old-illness', { category: 'symptom_observation', occurredAt: '2026-05-01T08:00:00Z', payload: { symptoms: ['cough'] } }),
      event('new-medication', { category: 'medication', occurredAt: '2026-08-07T08:00:00Z', payload: { medicationName: '已服用药物', amount: '1', unit: 'mL' } }),
    ],
    now: NOW,
  })
  assert.ok(snapshot.current.unknown.some((item) => item.dimension === 'illness'))
  assert.equal(snapshot.current.known.find((item) => item.dimension === 'medication')?.value.name, '已服用药物')
})
