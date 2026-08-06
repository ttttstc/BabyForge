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
import { applyCareEventsToLegacy, bridgeLegacyChanges, createCareEvent, mergeCareEvents, migrateLegacyState, occurredAtErrorMessage, validateOccurredAt } from '../src/domain/careEvents.js'
import { changedCareEvents, mergePulledState } from '../src/domain/eventSync.js'
import { coalesceOutboxItem } from '../src/domain/localDb.js'
import { safeEventInput } from '../functions/_shared/care.js'
import { onRequestPost as onEventPost } from '../functions/api/events.js'
import { onRequestDelete as onEventDelete, onRequestPatch as onEventPatch } from '../functions/api/events/[id].js'
import { getCareSnapshot, eventTitle } from '../src/domain/careSummary.js'
import { concernsFromCareEvents, evaluateSupport } from '../src/domain/healthSupport.js'
import { createEvaluatedGrowthMeasurement, evaluateGrowthMeasurement, getGrowthAgeContext, growthReferenceLabel, growthSourceLabel, growthTrajectoryLabel, validateGrowthMeasurement } from '../src/domain/growth.js'

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
  assert.equal(migrated.version, 4)
  assert.equal(migrated.baby.nickname, '小舟')
  assert.equal(migrated.baby.sex, null)
  assert.equal(migrated.baby.gestationalDays, 0)
  assert.equal(migrated.baby.growthAgeBasis, 'chronological')
  assert.equal(migrated.baby.birthMultiplicity, 'singleton')
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

test('care plan keeps low-burden task feedback, milestones, and growth facts', () => {
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

test('official growth packages evaluate birth and postnatal measurements deterministically', () => {
  const baby = { id: 'baby-growth', birthDate: '2026-08-01', sex: 'male', gestationalWeeks: 40, gestationalDays: 0 }
  const birth = createEvaluatedGrowthMeasurement({ id: 'birth-weight', type: 'weight', value: '3.455', unit: 'kg', measuredAt: '2026-08-01', source: 'birth_record', method: 'weight_scale' }, baby, [], { now: '2026-08-06T10:00:00.000Z' })
  assert.equal(birth.evaluation.standardPackageId, 'ws-t-800-2022')
  assert.equal(birth.evaluation.percentile, 50)
  assert.equal(birth.evaluation.birthSizeCategory, 'appropriate-for-gestational-age')
  assert.equal(birth.evaluation.dataQuality, 'sufficient')
  const timestampBirth = evaluateGrowthMeasurement({ id: 'birth-timestamp', type: 'weight', value: '3.455', unit: 'kg', measuredAt: '2026-08-01T12:00:00.000Z', source: 'birth_record' }, baby, [], { now: '2026-08-06T10:00:00.000Z' })
  assert.equal(timestampBirth.standardPackageId, 'ws-t-800-2022')

  const current = createEvaluatedGrowthMeasurement({ id: 'current-weight', type: 'weight', value: '3.5', measuredAt: '2026-08-06', source: 'caregiver_observation', method: 'weight_scale' }, baby, [birth], { now: '2026-08-06T10:00:00.000Z' })
  assert.equal(current.evaluation.standardPackageId, 'ws-t-423-2022')
  assert.equal(current.evaluation.ageBasis, 'chronological')
  assert.equal(current.evaluation.referencePosition, 'p50-p75')
  assert.equal(current.evaluation.trajectoryStatus, 'insufficient_history')
  assert.equal(current.evaluation.inputObservationIds.includes('current-weight'), true)
})

test('growth evaluator keeps birth and corrected-age standards isolated', () => {
  const preterm = { id: 'baby-preterm', birthDate: '2026-06-01', sex: 'female', gestationalWeeks: 32, gestationalDays: 0 }
  const context = getGrowthAgeContext(preterm, '2026-07-27', 'corrected')
  assert.equal(context.ageDays, 0)
  assert.equal(context.ageMonths, 0)
  const correctedMeasurement = createEvaluatedGrowthMeasurement({ id: 'corrected-weight', type: 'weight', value: '3.2', measuredAt: '2026-07-27', source: 'caregiver_observation' }, { ...preterm, growthAgeBasis: 'corrected' }, [], { now: '2026-07-28T10:00:00.000Z' })
  assert.equal(correctedMeasurement.ageBasis, 'corrected')
  assert.equal(correctedMeasurement.evaluation.ageBasis, 'corrected')
  const missingGestation = evaluateGrowthMeasurement({ id: 'birth-no-gestation', type: 'weight', value: '3.2', measuredAt: '2026-06-01', source: 'birth_record' }, { ...preterm, gestationalWeeks: null }, [], { now: '2026-07-01T10:00:00.000Z' })
  assert.equal(missingGestation.standardPackageId, 'ws-t-800-2022')
  assert.equal(missingGestation.dataQuality, 'insufficient')
  assert.match(missingGestation.limitations.join(' '), /24–42/)
  const missingCorrected = evaluateGrowthMeasurement({ id: 'corrected-no-gestation', type: 'weight', value: '3.2', measuredAt: '2026-06-06', source: 'clinical', ageBasis: 'corrected' }, { ...preterm, gestationalWeeks: null }, [], { now: '2026-07-01T10:00:00.000Z' })
  assert.equal(missingCorrected.dataQuality, 'insufficient')
  assert.match(missingCorrected.limitations.join(' '), /矫正年龄|整月参考/)
  const multiple = evaluateGrowthMeasurement({ id: 'birth-multiple', type: 'weight', value: '3.2', measuredAt: '2026-06-01', source: 'birth_record' }, { ...preterm, birthMultiplicity: 'multiple' }, [], { now: '2026-07-01T10:00:00.000Z' })
  assert.equal(multiple.dataQuality, 'insufficient')
  assert.match(multiple.limitations.join(' '), /单胎/)
})

test('postmenstrual age is reported separately from the WS/T 423 reference month', () => {
  const baby = { id: 'baby-pma', birthDate: '2026-08-01', sex: 'male', gestationalWeeks: 40, gestationalDays: 0 }
  const context = getGrowthAgeContext(baby, '2026-08-06', 'postmenstrual')
  assert.equal(context.ageDays, 285)
  assert.equal(context.ageMonths, 9)
  assert.equal(context.referenceAgeMonths, 0)
  const evaluated = evaluateGrowthMeasurement({ id: 'pma-weight', type: 'weight', value: '3.5', measuredAt: '2026-08-06', source: 'clinical', ageBasis: 'postmenstrual' }, baby, [], { now: '2026-08-06T10:00:00.000Z' })
  assert.equal(evaluated.dataQuality, 'sufficient')
  assert.equal(evaluated.ageDays, 285)
  assert.equal(evaluated.referenceAgeMonths, 0)
})

test('preterm chronological follow-ups withhold term references until corrected age is selected', () => {
  const baby = { id: 'baby-preterm-default', birthDate: '2026-08-01', sex: 'female', gestationalWeeks: 28, gestationalDays: 0 }
  const chronological = evaluateGrowthMeasurement({ id: 'preterm-chronological', type: 'weight', value: '2.8', measuredAt: '2026-11-01', source: 'clinical' }, baby, [], { now: '2026-11-02T10:00:00.000Z' })
  assert.equal(chronological.dataQuality, 'insufficient')
  assert.match(chronological.limitations.join(' '), /早产儿.*矫正年龄/)
  const corrected = evaluateGrowthMeasurement({ id: 'preterm-corrected', type: 'weight', value: '2.8', measuredAt: '2026-11-01', source: 'clinical', ageBasis: 'corrected' }, baby, [], { now: '2026-11-02T10:00:00.000Z' })
  assert.equal(corrected.dataQuality, 'sufficient')
})

test('growth evaluator reports insufficient history and never fabricates reference values', () => {
  const baby = { id: 'baby-limited', birthDate: '2026-08-01', sex: 'female', gestationalWeeks: 40, gestationalDays: 0 }
  assert.match(validateGrowthMeasurement({ type: 'weight', value: '-1', measuredAt: '2026-08-06' }, baby, { now: '2026-08-06T10:00:00.000Z' }).join(' '), /正数/)
  const invalid = evaluateGrowthMeasurement({ id: 'future', type: 'weight', value: '3.4', measuredAt: '2026-08-07', source: 'caregiver_observation' }, baby, [], { now: '2026-08-06T10:00:00.000Z' })
  assert.equal(invalid.dataQuality, 'insufficient')
  assert.equal(invalid.percentile, undefined)
  assert.equal(invalid.trajectoryStatus, 'verify_measurement')
  const valid = evaluateGrowthMeasurement({ id: 'valid', type: 'headCircumference', value: '33.9', measuredAt: '2026-08-06', source: 'caregiver_observation' }, baby, [], { now: '2026-08-06T10:00:00.000Z' })
  assert.equal(valid.evaluation, undefined)
  assert.equal(valid.trajectoryStatus, 'insufficient_history')
  assert.equal(valid.percentile, 50)
})

test('growth evaluator covers invalid inputs, unsupported standard ages, and trajectory warnings', () => {
  const baby = { id: 'baby-branches', birthDate: '2026-08-01', sex: 'male', gestationalWeeks: 40 }
  assert.equal(getGrowthAgeContext(baby, '2026-08-01', 'unknown').basis, 'chronological')
  assert.match(getGrowthAgeContext({ ...baby, gestationalWeeks: null }, '2026-08-01', 'corrected').limitations.join(' '), /矫正年龄/)
  assert.match(getGrowthAgeContext({ ...baby, gestationalWeeks: null }, '2026-08-01', 'postmenstrual').limitations.join(' '), /经后年龄/)
  const preDue = getGrowthAgeContext({ ...baby, gestationalWeeks: 32 }, '2026-08-10', 'corrected')
  assert.ok(preDue.ageDays < 0)
  assert.match(preDue.limitations.join(' '), /尚未达到预产期/)
  const postmenstrual = getGrowthAgeContext(baby, '2026-08-06', 'postmenstrual')
  assert.equal(postmenstrual.postmenstrualAgeDays, 285)
  const errors = validateGrowthMeasurement({ type: 'unknown', value: '0', measuredAt: 'not-a-date', source: 'birth_record' }, { birthDate: '2026-08-02' }, { now: '2026-08-06T10:00:00.000Z' })
  assert.match(errors.join(' '), /不支持的成长指标/)
  assert.match(errors.join(' '), /缺少用于选择标准的宝宝性别/)
  assert.match(validateGrowthMeasurement({ type: 'weight', value: '3.2', measuredAt: '2026-07-31', source: 'birth_record' }, baby, { now: '2026-08-06T10:00:00.000Z' }).join(' '), /早于出生日期/)
  assert.match(validateGrowthMeasurement({ type: 'weight', value: '3.2', measuredAt: '2026-08-02', source: 'birth_record' }, baby, { now: '2026-08-06T10:00:00.000Z' }).join(' '), /出生日期一致/)
  assert.match(validateGrowthMeasurement({ type: 'weight', value: '3500', unit: 'g', measuredAt: '2026-08-06', source: 'clinical' }, baby, { now: '2026-08-06T10:00:00.000Z' }).join(' '), /单位必须为 kg/)
  const lengthAtBirth = evaluateGrowthMeasurement({ id: 'birth-length', type: 'length', value: '50', measuredAt: '2026-08-01', source: 'birth_record' }, baby, [], { now: '2026-08-06T10:00:00.000Z' })
  assert.equal(lengthAtBirth.dataQuality, 'sufficient')
  assert.match(lengthAtBirth.limitations.join(' '), /辅助指标/)
  const outOfRangeBirth = evaluateGrowthMeasurement({ id: 'birth-too-early', type: 'weight', value: '1.8', measuredAt: '2026-08-01', source: 'birth_record' }, { ...baby, gestationalWeeks: 23 }, [], { now: '2026-08-06T10:00:00.000Z' })
  assert.equal(outOfRangeBirth.dataQuality, 'insufficient')
  assert.match(outOfRangeBirth.limitations.join(' '), /24–42/)
  const unsupportedAge = evaluateGrowthMeasurement({ id: 'age-25', type: 'weight', value: '12', measuredAt: '2028-09-01', source: 'clinical' }, { ...baby, birthDate: '2026-08-01' }, [], { now: '2028-09-02T10:00:00.000Z' })
  assert.equal(unsupportedAge.dataQuality, 'insufficient')
  assert.match(unsupportedAge.limitations.join(' '), /官方标准缺少对应年龄或指标数据/)
  const previous = createEvaluatedGrowthMeasurement({ id: 'previous', type: 'weight', value: '2.4', measuredAt: '2026-08-01', source: 'clinical' }, baby, [], { now: '2026-08-06T10:00:00.000Z' })
  const shift = evaluateGrowthMeasurement({ id: 'shift', type: 'weight', value: '4.7', measuredAt: '2026-08-02', source: 'clinical' }, baby, [previous], { now: '2026-08-06T10:00:00.000Z' })
  assert.equal(shift.trajectoryStatus, 'shift_needs_review')
  const verifyPrevious = createEvaluatedGrowthMeasurement({ id: 'verify-previous', type: 'weight', value: '3.2', measuredAt: '2026-08-01', source: 'clinical' }, baby, [], { now: '2026-08-06T10:00:00.000Z' })
  const verify = evaluateGrowthMeasurement({ id: 'verify', type: 'weight', value: '5', measuredAt: '2026-08-02', source: 'clinical' }, baby, [verifyPrevious], { now: '2026-08-06T10:00:00.000Z' })
  assert.equal(verify.trajectoryStatus, 'verify_measurement')
  const postmenstrualEvaluation = evaluateGrowthMeasurement({ id: 'pma', type: 'weight', value: '3.5', measuredAt: '2026-08-06', source: 'clinical', ageBasis: 'postmenstrual' }, baby, [], { now: '2026-08-06T10:00:00.000Z' })
  assert.match(postmenstrualEvaluation.limitations.join(' '), /经后年龄仅保留/)
  assert.equal(growthReferenceLabel({ referencePosition: 'p50-p75' }, 'en-US'), 'P50–P75')
  assert.equal(growthReferenceLabel({}, 'zh-CN'), '暂无参考位置')
  assert.equal(growthSourceLabel('parent-entered', 'en-US'), 'Caregiver observation')
  assert.equal(growthTrajectoryLabel('verify_measurement', 'zh-CN'), '请复核这次测量')
})

test('legacy facts migrate into CareEvent without treating actor as performer', () => {
  const state = migrateLegacyState({
    baby: { id: 'baby-1' },
    taskLogs: [{ id: 'task-1', taskId: 'feeding', date: '2026-08-05', actor: 'nanny', status: 'done' }],
    observations: [],
  })
  assert.equal(state.careEvents.length, 1)
  assert.equal(state.careEvents[0].type, 'care_action')
  assert.equal(state.careEvents[0].recordedBy.displayName, '妈妈')
  assert.equal(state.careEvents[0].payload.record.actor, 'nanny')
  const unchanged = bridgeLegacyChanges(state, { ...state, preferences: { ...state.preferences } })
  assert.equal(unchanged.careEvents[0].version, state.careEvents[0].version)
})

test('removing a legacy growth record emits a void event for sync', () => {
  const baby = { id: 'baby-growth-delete' }
  const measurement = { id: 'birth-weight-old', type: 'weight', value: '3.2', unit: 'kg', measuredAt: '2026-08-01', source: 'birth_record' }
  const previous = bridgeLegacyChanges({ baby, growthMeasurements: [measurement], careEvents: [] }, { baby, growthMeasurements: [measurement], careEvents: [] }, { babyId: baby.id, now: '2026-08-06T10:00:00.000Z' })
  const next = bridgeLegacyChanges(previous, { ...previous, growthMeasurements: [] }, { babyId: baby.id, now: '2026-08-06T11:00:00.000Z' })
  const removed = next.careEvents.find((event) => event.payload?.legacyId === measurement.id)
  assert.equal(removed.status, 'voided')
  assert.deepEqual(changedCareEvents(previous.careEvents, next.careEvents).map((item) => item.operation), ['void'])
})

test('care event merge keeps newer server revision and detects local outbox operations', () => {
  const local = createCareEvent({ id: 'event-1', babyId: 'baby-1', occurredAt: '2026-08-05T08:00:00Z', payload: { value: 'local' } }, { now: '2026-08-05T08:01:00Z' })
  const remote = createCareEvent({ ...local, payload: { value: 'server' }, updatedAt: '2026-08-05T08:02:00Z', version: 2 }, { now: '2026-08-05T08:02:00Z' })
  assert.equal(mergeCareEvents([local], [remote])[0].payload.value, 'server')
  assert.deepEqual(changedCareEvents([], [local]).map((item) => item.operation), ['create'])
  assert.deepEqual(changedCareEvents([local], [{ ...local, ...remote, status: 'voided' }]).map((item) => item.operation), ['void'])
})

test('trajectory history ignores measurements recorded after the current backfilled date', () => {
  const baby = { id: 'baby-backfill', birthDate: '2026-08-01', sex: 'male', gestationalWeeks: 40 }
  const later = createEvaluatedGrowthMeasurement({ id: 'later', type: 'weight', value: '3.8', measuredAt: '2026-08-06', source: 'clinical' }, baby, [], { now: '2026-08-07T10:00:00.000Z' })
  const backfilled = evaluateGrowthMeasurement({ id: 'backfilled', type: 'weight', value: '3.2', measuredAt: '2026-08-03', source: 'clinical' }, baby, [later], { now: '2026-08-07T10:00:00.000Z' })
  assert.equal(backfilled.dataQuality, 'sufficient')
  assert.equal(backfilled.trajectoryStatus, 'insufficient_history')
})

test('server event input rejects unknown values and missing recorder', () => {
  assert.throws(() => safeEventInput({ id: 'event-1', type: 'unknown', source: 'caregiver_entered', payload: {} }, { now: '2026-08-05T10:00:00.000Z' }, { requireId: true, requireRecordedBy: true, requireTimestamps: true }), /不支持的事件类型/)
  assert.throws(() => safeEventInput({ id: 'event-1', type: 'care_action', source: 'caregiver_entered', payload: {} }, { now: '2026-08-05T10:00:00.000Z' }, { requireId: true, requireRecordedBy: true, requireTimestamps: true }), /必须提供记录人/)
  assert.throws(() => safeEventInput({ id: 'event-1', type: 'care_action', source: 'caregiver_entered', recordedBy: { id: 'nanny', displayName: '月嫂' }, payload: {} }, { now: '2026-08-05T10:00:00.000Z' }, { requireId: true, requireRecordedBy: true, requireTimestamps: true }), /必须提供发生时间/)
})

test('server revision wins over a future-dated local clock at the same version', () => {
  const local = createCareEvent({ id: 'event-clock', version: 2, updatedAt: '2099-01-01T00:00:00Z', payload: { value: 'local' } })
  const remote = { ...local, updatedAt: '2026-08-05T10:00:00Z', payload: { value: 'server' } }
  assert.equal(mergeCareEvents([local], [remote])[0].payload.value, 'server')
})

test('care event time validation bounds quick-record backfills', () => {
  const now = new Date('2026-08-06T10:00:00.000Z')
  assert.equal(validateOccurredAt('2026-08-01T09:00:00', { birthDate: '2026-08-01', now }), null)
  assert.equal(validateOccurredAt('2026-07-31T23:59:00', { birthDate: '2026-08-01', now }), 'before_birth')
  assert.equal(validateOccurredAt('2026-08-06T10:02:00Z', { birthDate: '2026-08-01', now }), 'future')
  assert.equal(occurredAtErrorMessage('future', 'zh-CN'), '发生时间不能晚于当前时间。')
})

test('legacy event application merges fields and removes voided records', () => {
  const state = { taskLogs: [{ id: 'task-1', actor: 'nanny', status: 'done' }] }
  const active = createCareEvent({ id: 'legacy-task-1', status: 'active', payload: { legacyCollection: 'taskLogs', legacyId: 'task-1', record: { id: 'task-1', status: 'pending' } } })
  const merged = applyCareEventsToLegacy(state, [active])
  assert.deepEqual(merged.taskLogs, [{ id: 'task-1', actor: 'nanny', status: 'pending' }])
  const voided = applyCareEventsToLegacy(merged, [{ ...active, status: 'voided' }])
  assert.deepEqual(voided.taskLogs, [])
})

test('outbox coalescing keeps create and sends a voided tombstone', () => {
  const create = coalesceOutboxItem(null, { event: { id: 'event-outbox', status: 'active' }, operation: 'create' }, 'niwa')
  const patched = coalesceOutboxItem(create, { event: { id: 'event-outbox', status: 'corrected' }, operation: 'patch' }, 'niwa')
  const voided = coalesceOutboxItem(create, { event: { id: 'event-outbox', status: 'voided' }, operation: 'void' }, 'niwa')
  assert.equal(patched.operation, 'create')
  assert.equal(voided.operation, 'create')
  assert.equal(voided.event.status, 'voided')
})

test('incremental pulls merge collections while full pulls can clear them', () => {
  const state = { careEvents: [], carePlanItems: [{ id: 'old-plan' }], concerns: [{ id: 'old-concern' }], syncMeta: {} }
  const full = mergePulledState(state, { events: [], carePlanItems: [], concerns: [], pulledAt: '2026-08-05T10:00:00Z' })
  assert.deepEqual(full.carePlanItems, [])
  assert.deepEqual(full.concerns, [])
  const incremental = mergePulledState(state, { events: [], carePlanItems: [{ id: 'new-plan' }], concerns: [], pulledAt: '2026-08-05T11:00:00Z' }, { since: '2026-08-05T10:00:00Z' })
  assert.deepEqual(incremental.carePlanItems.map((item) => item.id), ['old-plan', 'new-plan'])
  assert.deepEqual(incremental.concerns.map((item) => item.id), ['old-concern'])
})

test('guest sessions are denied by every event write endpoint', async () => {
  const guest = { token: 'token', expires_at: '2099-01-01T00:00:00.000Z', id: 'account-baby', username: 'baby', role: 'guest', display_name: '游客' }
  const env = { DB: { prepare: () => ({ bind: () => ({ first: async () => guest }) }) } }
  const request = (method, body) => new Request('https://babyforge.test/api/events/event-1', {
    method,
    headers: { cookie: 'babyforge_session=token', 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  assert.equal((await onEventPost({ request: request('POST', {}), env })).status, 403)
  assert.equal((await onEventPatch({ request: request('PATCH', {}), env, params: { id: 'event-1' } })).status, 403)
  assert.equal((await onEventDelete({ request: request('DELETE'), env, params: { id: 'event-1' } })).status, 403)
})

test('quick care records produce a personal 24-hour snapshot', () => {
  const events = [
    { id: 'feed-1', type: 'bottle_feeding', status: 'active', occurredAt: '2026-08-05T08:00:00Z', payload: { amountMl: 60 } },
    { id: 'urine-1', type: 'diaper', status: 'active', occurredAt: '2026-08-05T09:00:00Z', payload: { kind: 'urine' } },
    { id: 'old-1', type: 'diaper', status: 'active', occurredAt: '2026-08-03T09:00:00Z', payload: { kind: 'stool' } },
  ]
  const snapshot = getCareSnapshot(events, [], new Date('2026-08-05T12:00:00Z'))
  assert.equal(snapshot.metrics.feedingCount, 1)
  assert.equal(snapshot.metrics.bottleMl, 60)
  assert.equal(snapshot.metrics.wetDiaperCount, 1)
  assert.equal(eventTitle(events[0], 'zh-CN'), '瓶喂 60 mL')
})

test('guided support uses caregiver guidance without a triage label', () => {
  const urgent = evaluateSupport({ topicId: 'breathing', facts: ['blue-color'] })
  const routine = evaluateSupport({ topicId: 'feeding-change', facts: [] })
  assert.equal(urgent.caregiverGuidance, 'immediate-contact')
  assert.equal(routine.caregiverGuidance, 'observe-and-recheck')
  assert.equal(urgent.actionLevel, undefined)
  assert.match(routine.action.zh, /记录时间/)
  assert.match(urgent.source.url, /who.int/)
})

test('support concerns can be reconstructed from synced care events', () => {
  const event = { id: 'concern-event', babyId: 'baby-1', relatedConcernId: 'concern-1', status: 'active', createdAt: '2026-08-05T10:00:00Z', updatedAt: '2026-08-05T10:00:00Z', payload: { supportTopic: 'jaundice' } }
  const open = concernsFromCareEvents([event])
  assert.equal(open[0].status, 'open')
  const closed = concernsFromCareEvents([{ ...event, id: 'close-event', payload: { supportStatus: 'closed' } }], open)
  assert.equal(closed[0].status, 'closed')
})

test('reconstructing an unchanged concern preserves its timestamp and details', () => {
  const event = { id: 'concern-event', babyId: 'baby-1', relatedConcernId: 'concern-1', status: 'active', createdAt: '2026-08-05T10:00:00Z', updatedAt: '2026-08-05T10:00:00Z', payload: { supportTopic: 'jaundice', facts: ['blue-color'], notes: '观察到变化', plan: { caregiverGuidance: 'immediate-contact' } } }
  const existing = concernsFromCareEvents([event])
  const replayed = concernsFromCareEvents([event], existing)
  assert.strictEqual(replayed[0], existing[0])
})
