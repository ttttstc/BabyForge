import test from 'node:test'
import assert from 'node:assert/strict'

import { getAgeDays, getStage, getTodayPriorities } from '../src/domain/baby.js'
import { createObservation } from '../src/domain/observation.js'
import { buildDoctorSummary } from '../src/domain/doctorSummary.js'
import { evaluateMedicalTopic } from '../src/domain/safety.js'
import { STORAGE_KEY, loadState, saveState } from '../src/domain/storage.js'
import { ASSET_MANIFEST, resolveSexAsset } from '../src/content/assets.js'
import { ANATOMY_RESOURCES, getAnatomyHotspots, PEDIATRIC_DISEASES } from '../src/content/pediatricDiseases.js'
import { createGrowthMeasurement, getAdminTasks, getCalendarEvents, getDailyTasks, getStageMilestones, updateTaskLog, upsertAdminTaskRecord, upsertMilestoneRecord } from '../src/domain/carePlan.js'

test('age and stage boundaries follow the 0–28 day MVP contract', () => {
  assert.equal(getAgeDays('2026-08-05', '2026-08-05'), 0)
  assert.equal(getAgeDays('2026-07-29', '2026-08-05'), 7)
  assert.equal(getStage(0).id, 'newborn-early')
  assert.equal(getStage(7).id, 'newborn-early')
  assert.equal(getStage(8).id, 'newborn-adaptation')
  assert.equal(getStage(28).id, 'newborn-adaptation')
  assert.equal(getStage(29).id, 'out-of-scope')
})

test('today always exposes the three agreed priorities', () => {
  assert.deepEqual(
    getTodayPriorities().map((item) => item.id),
    ['feeding', 'elimination', 'safe-sleep'],
  )
})

test('observation records preserve facts, units, and parent provenance', () => {
  const record = createObservation(
    {
      firstNoticedAt: '2026-08-05T08:30',
      bodyAreas: ['face', 'eyes'],
      feedingChange: 'less-than-usual',
      alertness: 'usual',
      eliminationNotes: '尿便由家长记录',
      bilirubinValue: '178',
      bilirubinUnit: 'μmol/L',
      measuredAt: '2026-08-05T09:00',
      measurementSource: 'hospital',
    },
    { id: 'obs-1', now: '2026-08-05T10:00:00.000Z' },
  )

  assert.equal(record.id, 'obs-1')
  assert.equal(record.bilirubinValue, '178')
  assert.equal(record.bilirubinUnit, 'μmol/L')
  assert.equal(record.provenance.bilirubinValue, 'parent-entered')
  assert.equal('interpretation' in record, false)
})

test('unapproved medical content cannot produce a safety classification', () => {
  assert.deepEqual(evaluateMedicalTopic({ reviewStatus: 'prototype' }), {
    status: 'unavailable',
    classification: null,
  })
})

test('doctor summary keeps raw observations and their provenance', () => {
  const observation = createObservation(
    { firstNoticedAt: '2026-08-05T08:30', feedingChange: 'usual' },
    { id: 'obs-1', now: '2026-08-05T10:00:00.000Z' },
  )
  const summary = buildDoctorSummary(
    { id: 'baby-1', nickname: '小舟', birthDate: '2026-08-01' },
    [observation],
    ['需要复测胆红素吗？'],
    '2026-08-05T10:10:00.000Z',
  )

  assert.equal(summary.baby.nickname, '小舟')
  assert.equal(summary.timeline[0].id, 'obs-1')
  assert.equal(summary.timeline[0].provenance.firstNoticedAt, 'parent-entered')
  assert.deepEqual(summary.questions, ['需要复测胆红素吗？'])
  assert.match(summary.disclaimer, /不提供诊断/)
})

test('versioned storage preserves explicit sex and safely migrates legacy profiles', () => {
  const values = new Map([
    [STORAGE_KEY, JSON.stringify({ version: 1, baby: { id: 'baby-1', nickname: '小舟' }, observations: [] })],
  ])
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }

  const migrated = loadState(storage)
  assert.equal(migrated.version, 3)
  assert.equal(migrated.baby.nickname, '小舟')
  assert.equal(migrated.baby.sex, null)
  assert.equal(migrated.preferences.locale, 'zh-CN')
  migrated.baby.sex = 'female'
  saveState(storage, migrated)
  assert.deepEqual(loadState(storage), migrated)
})

test('workspace storage is isolated by account namespace', () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
  const niwa = { ...loadState(storage), baby: { id: 'baby-niwa', nickname: '泥蛙' } }
  const baby = { ...loadState(storage), baby: { id: 'baby-guest', nickname: '只读宝宝' } }
  saveState(storage, niwa, 'niwa')
  saveState(storage, baby, 'baby')
  assert.equal(loadState(storage, 'niwa').baby.nickname, '泥蛙')
  assert.equal(loadState(storage, 'baby').baby.nickname, '只读宝宝')
  assert.equal(loadState(storage).baby, null)
})

test('baby assets resolve to separate male and female files while shared assets stay shared', () => {
  assert.equal(
    resolveSexAsset(ASSET_MANIFEST.models.newborn, 'male').high,
    '/assets/models/newborn-boy.glb',
  )
  assert.equal(
    resolveSexAsset(ASSET_MANIFEST.models.newborn, 'female').high,
    '/assets/models/newborn-girl.glb',
  )
  assert.equal(
    resolveSexAsset(ASSET_MANIFEST.images.newbornFallback, 'female').src,
    '/assets/images/newborn-stage-fallback-girl.png',
  )
  assert.equal(
    resolveSexAsset(ASSET_MANIFEST.images.elimination, 'female').src,
    '/assets/images/elimination-record.png',
  )
  assert.equal(resolveSexAsset(ASSET_MANIFEST.models.newborn, null), null)
})

test('pediatric condition library reuses the nine anatomy resources', () => {
  assert.equal(PEDIATRIC_DISEASES.length, 9)
  assert.equal(ANATOMY_RESOURCES.length, 9)
  assert.ok(PEDIATRIC_DISEASES.every((item) => ANATOMY_RESOURCES.some((resource) => resource.id === item.organId)))
  assert.equal(PEDIATRIC_DISEASES.find((item) => item.id === 'jaundice')?.organId, 'liver')
  assert.equal(PEDIATRIC_DISEASES.find((item) => item.id === 'fever')?.modelLabel.zh, '循环参照')
  assert.equal(PEDIATRIC_DISEASES.find((item) => item.id === 'cardiovascular')?.organId, 'heart')
  assert.equal(PEDIATRIC_DISEASES.find((item) => item.id === 'urinary')?.organId, 'kidneys')
  assert.equal(PEDIATRIC_DISEASES.find((item) => item.id === 'neurologic')?.organId, 'brain')
  assert.deepEqual(getAnatomyHotspots('lungs').map((item) => item.id), ['trachea', 'right-lung', 'left-lung', 'bronchus', 'base'])
})

test('every pediatric category exposes four bilingual case guides with reserved artwork paths', () => {
  const cases = PEDIATRIC_DISEASES.flatMap((category) => category.cases)
  assert.equal(cases.length, 36)
  assert.equal(new Set(cases.map((item) => item.id)).size, 36)
  assert.ok(cases.every((item) => item.title.zh && item.title.en))
  assert.ok(cases.every((item) => item.scenario.zh && item.scenario.en))
  assert.ok(cases.every((item) => item.treatment?.zh && item.nextSteps?.zh))
  assert.ok(cases.every((item) => item.image === `/assets/pediatric-cases/${item.id}.webp`))
})

test('calendar exposes anniversaries, milestones, admin tasks, and completion state', () => {
  const events = getCalendarEvents({ birthDate: '2026-07-29' }, [{ milestoneId: 'first-visit-plan', status: 'done' }], [{ taskId: 'birth-certificate', status: 'done' }])
  assert.equal(events.find((item) => item.id === 'birth-anniversary')?.date, '2026-07-29')
  assert.equal(events.find((item) => item.id === 'first-visit-plan')?.date, '2026-07-30')
  assert.equal(events.find((item) => item.id === 'first-visit-plan')?.status, 'done')
  assert.equal(events.find((item) => item.id === 'birth-certificate')?.status, 'done')
})

test('pediatric observations preserve symptoms and optional temperature facts', () => {
  const record = createObservation({
    topicId: 'respiratory',
    firstNoticedAt: '2026-08-05T08:30',
    symptoms: ['fever', 'cough'],
    symptomNotes: '夜间更明显',
    temperatureValue: '38.2',
    temperatureUnit: '°C',
  }, { id: 'obs-pediatric-1', now: '2026-08-05T10:00:00.000Z' })
  assert.deepEqual(record.symptoms, ['fever', 'cough'])
  assert.equal(record.temperatureValue, '38.2')
  assert.equal(record.provenance.symptomNotes, 'parent-entered')
})

test('care plan keeps low-burden task feedback, caregiver provenance, milestones, and growth facts', () => {
  const tasks = getDailyTasks([] , new Date('2026-08-05T12:00:00'))
  assert.equal(tasks.length, 3)
  assert.ok(tasks.every((item) => item.acceptance?.zh && item.acceptance?.en))
  let logs = updateTaskLog([], 'feeding', { status: 'done', actor: 'nanny', date: '2026-08-05' }, '2026-08-05T10:00:00.000Z')
  assert.equal(getDailyTasks(logs, new Date('2026-08-05T12:00:00')).find((item) => item.id === 'feeding').status, 'done')
  assert.equal(logs[0].provenance, 'parent-entered')
  let milestones = upsertMilestoneRecord([], 'first-visit-plan', { status: 'done', actor: 'parent' }, '2026-08-05T10:00:00.000Z')
  assert.equal(getStageMilestones('newborn-early', milestones).find((item) => item.id === 'first-visit-plan').status, 'done')
  const measurement = createGrowthMeasurement({ type: 'weight', value: '3.4', measuredAt: '2026-08-05' }, { id: 'growth-1', now: '2026-08-05T10:00:00.000Z' })
  assert.deepEqual({ value: measurement.value, unit: measurement.unit, provenance: measurement.provenance }, { value: '3.4', unit: 'kg', provenance: 'parent-entered' })
  const adminTasks = getAdminTasks('newborn-early', 7, [])
  assert.ok(adminTasks.some((item) => item.id === 'birth-certificate' && item.state === 'due'))
  const adminRecords = upsertAdminTaskRecord([], 'birth-certificate', { status: 'done' }, '2026-08-05T10:00:00.000Z')
  assert.equal(getAdminTasks('newborn-early', 7, adminRecords).find((item) => item.id === 'birth-certificate').status, 'done')
})
