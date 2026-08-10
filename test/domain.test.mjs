import test from 'node:test'
import assert from 'node:assert/strict'
import { stat } from 'node:fs/promises'

import { getAgeDays, getStage, getStageLabel, getStageRangeLabel, getStages, getTodayPriorities } from '../src/domain/baby.js'
import { createObservation } from '../src/domain/observation.js'
import { buildDoctorSummary } from '../src/domain/doctorSummary.js'
import { evaluateMedicalTopic } from '../src/domain/safety.js'
import { STORAGE_KEY, loadState, saveState } from '../src/domain/storage.js'
import { pushWorkspace } from '../src/domain/sync.js'
import { ASSET_MANIFEST, resolveSexAsset } from '../src/content/assets.js'
import { ANATOMY_RESOURCES, getAnatomyHotspots } from '../src/content/pediatricDiseases.js'
import { createGrowthMeasurement, getAdminTasks, getCalendarEvents, getDailyHealthReminders, getDailyTasks, getStageMilestones, updateTaskLog, upsertAdminTaskRecord, upsertMilestoneRecord } from '../src/domain/carePlan.js'
import { VACCINE_DOSES, VACCINE_STANDARD } from '../src/content/vaccines.js'
import { applyCareEventsToLegacy, bridgeLegacyChanges, createCareEvent, mergeCareEvents, migrateLegacyState, occurredAtErrorMessage, validateOccurredAt } from '../src/domain/careEvents.js'
import { changedCareEvents, mergePulledState } from '../src/domain/eventSync.js'
import { coalesceOutboxItem } from '../src/domain/localDb.js'
import { safeEventInput } from '../functions/_shared/care.js'
import { onRequestPost as onEventPost } from '../functions/api/events.js'
import { onRequestDelete as onEventDelete, onRequestPatch as onEventPatch } from '../functions/api/events/[id].js'
import { onRequestPost as onPhotoPost } from '../functions/api/photos.js'
import { onRequestDelete as onPhotoDelete, onRequestGet as onPhotoGet } from '../functions/api/photos/[id].js'
import { getCareSnapshot, eventTitle } from '../src/domain/careSummary.js'
import { concernsFromCareEvents, evaluateSupport } from '../src/domain/healthSupport.js'
import { createEvaluatedGrowthMeasurement, evaluateGrowthMeasurement, getGrowthAgeContext, getGrowthChartModel, getGrowthMeasurementConflictIds, growthLevelLabel, growthReferenceLabel, growthSourceLabel, growthTrajectoryLabel, isValidGrowthMeasurement, validateGrowthMeasurement } from '../src/domain/growth.js'
import { ageContextSummary, ageBasisLabel, resolveAgeContext } from '../src/domain/agePolicy.js'
import { buildExperienceQuery, getCacheState, getContentAgeBandForBaby, getExperienceCacheKey, normalizeArticleUrl, normalizeExperienceResult, sortExperienceResults } from '../src/domain/experience.js'
import { MAX_PHOTO_BYTES, dateTimeInputToIso, detectPhotoTime, isSupportedPhoto } from '../src/domain/babyAlbum.js'
import { getGrowthStageContent } from '../src/content/growthStages.js'
import { updateBabyProfileState, validateBasicInfoForm } from '../src/domain/babyProfile.js'

test('age and stage boundaries cover the full 0–6 year timeline', () => {
  assert.equal(getAgeDays('2026-08-05', '2026-08-05'), 0)
  assert.equal(getAgeDays('2026-07-29', '2026-08-05'), 7)
  assert.equal(getStage(0).id, 'newborn-early')
  assert.equal(getStage(7).id, 'newborn-early')
  assert.equal(getStage(8).id, 'newborn-adaptation')
  assert.equal(getStage(28).id, 'newborn-adaptation')
  assert.equal(getStage(29).id, 'infant-1-2-months')
  assert.equal(getStage(59).id, 'infant-1-2-months')
  assert.equal(getStage(60).id, 'infant-2-3-months')
  assert.equal(getStage(729).id, 'toddler-18-24-months')
  assert.equal(getStage(730).id, 'child-2-3-years')
  assert.equal(getStage(2191).id, 'child-5-6-years')
  assert.equal(getStage(2192).id, 'out-of-scope')
  assert.equal(getStages().length, 15)
})

test('baby profile updates keep time-plan inputs canonical and reject future birth dates', () => {
  const current = {
    ...loadState({ getItem: () => null }),
    baby: { id: 'baby-profile', nickname: '小舟', birthDate: '2026-08-01', gestationalWeeks: 39, gestationalDays: 0, birthMultiplicity: 'singleton', sex: 'male', feedingMode: 'mixed' },
  }
  const next = updateBabyProfileState(current, { ...current.baby, nickname: '小舟-更新', birthDate: '2026-07-01', gestationalWeeks: 32, gestationalDays: 3, birthMultiplicity: 'multiple', sex: 'female', feedingMode: 'formula' }, { now: '2026-08-08T10:00:00.000Z' })
  assert.equal(next.baby.birthDate, '2026-07-01')
  assert.equal(next.baby.gestationalWeeks, 32)
  assert.equal(next.baby.gestationalDays, 3)
  assert.equal(next.baby.birthMultiplicity, 'multiple')
  assert.equal(next.baby.feedingMode, 'formula')
  assert.equal(getCalendarEvents(next.baby).find((event) => event.id === 'birth-anniversary').date, '2026-07-01')
  assert.equal(getCalendarEvents(next.baby).find((event) => event.id === 'first-visit-plan').date, '2026-07-02')
  assert.match(validateBasicInfoForm({ ...next.baby, birthDate: '2999-01-01' }), /不能晚于今天|future/)
})

test('experience age bands cover 0–36 months without changing care stages', () => {
  assert.equal(getContentAgeBandForBaby('2026-08-05', '2026-08-05').band.id, 'newborn')
  assert.equal(getContentAgeBandForBaby('2026-07-07', '2026-08-05').band.id, 'young-infant')
  assert.equal(getContentAgeBandForBaby('2026-06-05', '2026-08-05').band.id, 'young-infant')
  assert.equal(getContentAgeBandForBaby('2026-05-05', '2026-08-05').band.id, 'early-infant')
  assert.equal(getContentAgeBandForBaby('2023-08-05', '2026-08-05').band.id, 'young-toddler')
  assert.equal(getContentAgeBandForBaby('2023-07-05', '2026-08-05').band, null)
  assert.throws(() => getContentAgeBandForBaby('2026-08-06', '2026-08-05'), /future/)
})

test('experience queries and cache keys contain only band, category, and locale', () => {
  const age = getContentAgeBandForBaby('2026-08-01', '2026-08-05')
  assert.match(buildExperienceQuery(age.band, 'feeding'), /0到28天新生儿/)
  assert.match(buildExperienceQuery(age.band, 'feeding'), /拍嗝/)
  assert.equal(getExperienceCacheKey({ babyId: 'baby-1', bandId: age.band.id, categoryId: 'feeding' }), 'babyforge:experience:v2:baby-1:zh-CN:newborn:feeding')
})

test('experience result filtering keeps trusted professional links and drops unsafe or promotional results', () => {
  const band = getContentAgeBandForBaby('2026-08-01', '2026-08-05').band
  const sources = [{ domain: 'nhc.gov.cn', name: '国家卫生健康委员会', enabled: true }]
  const professional = normalizeExperienceResult({ title: '新生儿安全睡眠科普', url: 'https://www.nhc.gov.cn/article?utm_source=test', content: '介绍安全睡眠环境和睡姿，提醒家长不要自行用药。', score: 0.9 }, { band, categoryId: 'health', sources })
  assert.equal(professional.sourceType, 'professional')
  assert.equal(professional.url, 'https://www.nhc.gov.cn/article')
  assert.equal(normalizeExperienceResult({ title: '新生儿健康偏方', url: 'https://www.xiaohongshu.com/explore/a', content: '祖传偏方可以治疗黄疸。', score: 0.9 }, { band, categoryId: 'health', sources }), null)
  assert.equal(normalizeExperienceResult({ title: '新生儿奶粉优惠', url: 'https://www.xiaohongshu.com/explore/a', content: '立即购买奶粉，限时优惠。', score: 0.9 }, { band, categoryId: 'feeding', sources }), null)
  assert.ok(normalizeExperienceResult({ title: '新生儿配方奶喂养观察', url: 'https://www.xiaohongshu.com/explore/feeding', content: '介绍配方奶喂养时的观察方法，不构成购买建议。', score: 0.8 }, { band, categoryId: 'feeding', sources }))
  assert.equal(normalizeExperienceResult({ title: '中文喂养讨论', url: 'https://www.reddit.com/r/parenting-cn', content: '介绍配方奶喂养时的观察方法。', score: 0.8 }, { band, categoryId: 'feeding', sources }), null)
  assert.equal(normalizeExperienceResult({ title: '中文喂养视频', url: 'https://www.youtube.com/watch?v=123', content: '介绍配方奶喂养时的观察方法。', score: 0.8 }, { band, categoryId: 'feeding', sources }), null)
  assert.equal(normalizeExperienceResult({ title: 'Newborn feeding guide', url: 'https://www.xiaohongshu.com/explore/en', content: 'A general guide for feeding.', score: 0.8 }, { band, categoryId: 'feeding', sources }), null)
  assert.equal(normalizeArticleUrl('javascript:alert(1)'), null)
})

test('experience result sorting diversifies adjacent sources and cache state is explicit', () => {
  const articles = sortExperienceResults([
    { id: 'experience', sourceType: 'experience', sourceDomain: 'xiaohongshu.com', score: 0.6 },
    { id: 'a', sourceType: 'professional', sourceDomain: 'a.cn', score: 0.9 },
    { id: 'b', sourceType: 'professional', sourceDomain: 'a.cn', score: 0.8 },
    { id: 'c', sourceType: 'professional', sourceDomain: 'b.cn', score: 0.7 },
  ])
  assert.deepEqual(articles.map((item) => item.id), ['experience', 'a', 'c', 'b'])
  assert.equal(sortExperienceResults([
    { id: 'a1', sourceDomain: 'a.cn', score: 1 },
    { id: 'a2', sourceDomain: 'a.cn', score: 0.9 },
    { id: 'a3', sourceDomain: 'a.cn', score: 0.8 },
    { id: 'a4', sourceDomain: 'a.cn', score: 0.7 },
  ]).length, 3)
  assert.equal(getCacheState({ generatedAt: '2026-08-05T00:00:00.000Z', expiresAt: '2026-08-06T00:00:00.000Z', staleUntil: '2026-08-12T00:00:00.000Z' }, Date.parse('2026-08-05T12:00:00.000Z')), 'fresh')
  assert.equal(getCacheState({ generatedAt: '2026-08-05T00:00:00.000Z', expiresAt: '2026-08-06T00:00:00.000Z', staleUntil: '2026-08-12T00:00:00.000Z' }, Date.parse('2026-08-07T00:00:00.000Z')), 'stale')
})

test('today priorities follow the current age stage', () => {
  assert.deepEqual(
    getTodayPriorities().map((item) => item.id),
    ['feeding', 'elimination', 'safe-sleep'],
  )
  assert.deepEqual(
    getTodayPriorities('child-5-6-years').map((item) => item.id),
    ['routine', 'movement', 'independence'],
  )
  assert.equal(getTodayPriorities('child-5-6-years').some((item) => item.id === 'safe-sleep'), false)
})

test('stage labels keep locale fallbacks in the requested language', () => {
  assert.equal(getStageLabel({ label: '中文' }, 'en-US'), '')
  assert.equal(getStageRangeLabel({ rangeLabel: '中文范围' }, 'en-US'), '')
  assert.equal(getStageLabel({ label: '中文', labelEn: 'English' }, 'en-US'), 'English')
})

test('every 0–6 stage has a concrete caregiver review prompt', () => {
  getStages().forEach((stage) => {
    const milestone = getStageMilestones(stage.id)[0]
    assert.ok(milestone?.title?.zh && milestone?.title?.en)
    assert.ok(milestone?.detail?.zh && milestone?.detail?.en)
    assert.ok(milestone?.dueLabel || Number.isFinite(milestone?.dueDay))
  })
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

test('cloud workspace writes send every persisted collection immediately', async () => {
  const state = {
    baby: { id: 'baby-1', nickname: '小舟', birthDate: '2026-01-01' },
    observations: [{ id: 'observation-1' }],
    questions: ['需要复测吗？'],
    taskLogs: [{ id: 'task-1' }],
    adminTaskRecords: [{ id: 'admin-1' }],
    growthMeasurements: [{ id: 'growth-1' }],
    milestoneRecords: [{ id: 'milestone-1' }],
  }
  let request
  const response = await pushWorkspace(state, async (url, options) => {
    request = { url, options }
    return new Response(JSON.stringify({ baby: state.baby }), { status: 200, headers: { 'content-type': 'application/json' } })
  })
  assert.deepEqual(response, { baby: state.baby })
  assert.equal(request.url, '/api/sync')
  assert.equal(request.options.method, 'POST')
  assert.deepEqual(JSON.parse(request.options.body), state)
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

test('pediatric anatomy library exposes sixteen reusable 3D resources under ten megabytes', async () => {
  assert.equal(ANATOMY_RESOURCES.length, 16)
  assert.equal(new Set(ANATOMY_RESOURCES.map((resource) => resource.id)).size, 16)
  for (const resource of ANATOMY_RESOURCES) {
    const info = await stat(new URL(`../public${resource.model}`, import.meta.url))
    assert.ok(info.size < 10 * 1024 * 1024, `${resource.id}: ${info.size} bytes`)
  }
  assert.deepEqual(getAnatomyHotspots('lungs').map((item) => item.id), ['trachea', 'right-lung', 'left-lung', 'bronchus', 'bronchioles', 'alveoli', 'base'])
  assert.deepEqual(getAnatomyHotspots('mouth').map((item) => item.id), ['upper-primary-incisors', 'lower-primary-incisors', 'upper-gingiva', 'lower-gingiva'])
  assert.ok(['ear', 'nose', 'throat', 'stomach', 'bladder', 'bone'].every((id) => getAnatomyHotspots(id).length >= 5))
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
  assert.deepEqual(getDailyTasks([], new Date('2026-08-05T12:00:00'), 'child-5-6-years').map((item) => item.id), ['routine', 'movement', 'independence'])
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
  const correctedMeasurement = createEvaluatedGrowthMeasurement({ id: 'corrected-weight', type: 'weight', value: '3.2', measuredAt: '2026-07-27', source: 'caregiver_observation' }, { ...preterm, growthAgeBasis: 'chronological' }, [], { now: '2026-07-28T10:00:00.000Z' })
  assert.equal(correctedMeasurement.ageBasis, null)
  assert.equal(correctedMeasurement.evaluation.ageBasis, 'corrected')
  const missingGestation = evaluateGrowthMeasurement({ id: 'birth-no-gestation', type: 'weight', value: '3.2', measuredAt: '2026-06-01', source: 'birth_record' }, { ...preterm, gestationalWeeks: null }, [], { now: '2026-07-01T10:00:00.000Z' })
  assert.equal(missingGestation.standardPackageId, 'ws-t-800-2022')
  assert.equal(missingGestation.dataQuality, 'insufficient')
  assert.match(missingGestation.limitations.join(' '), /24–42/)
  const missingCorrected = evaluateGrowthMeasurement({ id: 'corrected-no-gestation', type: 'weight', value: '3.2', measuredAt: '2026-06-06', source: 'clinical', ageBasis: 'corrected' }, { ...preterm, gestationalWeeks: null }, [], { now: '2026-07-01T10:00:00.000Z', ageBasis: 'corrected' })
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
  assert.equal(evaluated.ageDays, 5)
  assert.equal(evaluated.referenceAgeMonths, 0)
})

test('preterm follow-ups select corrected references automatically', () => {
  const baby = { id: 'baby-preterm-default', birthDate: '2026-08-01', sex: 'female', gestationalWeeks: 28, gestationalDays: 0 }
  const chronological = evaluateGrowthMeasurement({ id: 'preterm-chronological', type: 'weight', value: '2.8', measuredAt: '2026-11-01', source: 'clinical' }, baby, [], { now: '2026-11-02T10:00:00.000Z' })
  assert.equal(chronological.dataQuality, 'sufficient')
  assert.equal(chronological.ageBasis, 'corrected')
  const corrected = evaluateGrowthMeasurement({ id: 'preterm-corrected', type: 'weight', value: '2.8', measuredAt: '2026-11-01', source: 'clinical', ageBasis: 'corrected' }, baby, [], { now: '2026-11-02T10:00:00.000Z' })
  assert.equal(corrected.dataQuality, 'sufficient')
})

test('daily health reminders are age-aware and preserve today completion', () => {
  const date = new Date('2026-08-07T12:00:00+08:00')
  const newborn = getDailyHealthReminders([], 6, date)
  assert.equal(newborn.nutrition[0].id, 'nutrition-vitamin-d')
  assert.equal(newborn.care[0].id, 'care-cord-skin')
  const completed = getDailyHealthReminders([{ taskId: 'nutrition-vitamin-d', date: '2026-08-07', status: 'done' }], 6, date)
  assert.equal(completed.nutrition[0].status, 'done')
  assert.equal(getDailyHealthReminders([], 220, date).nutrition[0].id, 'nutrition-iron-food')
})

test('vaccine roadmap follows the 2026 national 0–6 year schedule', () => {
  assert.equal(VACCINE_STANDARD.version, '2026-06')
  assert.ok(VACCINE_DOSES.some((item) => item.id === 'dtap-1' && item.ageLabel === '2 月龄'))
  assert.ok(VACCINE_DOSES.some((item) => item.id === 'dtap-5' && item.ageLabel === '6 周岁'))
  assert.ok(VACCINE_DOSES.some((item) => item.id === 'je-i-1' && item.abbreviation === 'JE-I'))
  assert.ok(VACCINE_DOSES.some((item) => item.id === 'je-i-2' && item.ageSpec?.days === 7))
  assert.ok(VACCINE_DOSES.some((item) => item.id === 'je-l-2' && item.ageSpec?.years === 2))
})

test('every growth stage has distinct educational features, key points, and completion signals', () => {
  const stageContents = getStages().map((item) => getGrowthStageContent(item.id))
  for (const content of stageContents) {
    assert.equal(content.features.length, 3)
    assert.equal(content.keyPoints.length, 3)
    assert.equal(content.completionSignals.length, 3)
    assert.ok(content.features.every((item) => item.title.zh && item.title.en && item.detail.zh && item.detail.en))
  }
  assert.equal(new Set(stageContents.map((content) => content.intro)).size, getStages().length)
})

test('age policy selects the purpose-specific basis and never trusts the legacy preference', () => {
  const baby = { birthDate: '2026-01-01', gestationalWeeks: 32, gestationalDays: 0, growthAgeBasis: 'chronological' }
  const stage = resolveAgeContext({ baby, at: '2026-03-01', purpose: 'stage' })
  const carePlan = resolveAgeContext({ baby, at: '2026-03-01', purpose: 'care_plan' })
  assert.equal(stage.basis, 'corrected')
  assert.equal(carePlan.basis, 'chronological')
  assert.equal(ageBasisLabel(stage.basis), '矫正年龄')
  assert.match(ageContextSummary(stage), /矫正年龄/)
})

test('preterm newborns keep the chronological stage window while showing corrected-age limits', () => {
  const baby = { birthDate: '2026-07-29', gestationalWeeks: 32, gestationalDays: 0 }
  const context = resolveAgeContext({ baby, at: '2026-08-08', purpose: 'stage' })
  assert.equal(context.chronological.days, 10)
  assert.equal(context.ageDays, -46)
  assert.equal(getStage(Math.max(0, context.chronological.days)).id, 'newborn-adaptation')
  assert.match(ageContextSummary(context), /实际 10 天 · 矫正年龄尚未到预产期（还差 46 天）/)
})

test('calendar age uses one local calendar-day convention and birth standards fail closed without gestation', () => {
  assert.equal(getAgeDays('2026-01-31', '2026-02-28'), 28)
  assert.equal(getAgeDays('2026-01-31', new Date('2026-02-28T23:30:00+08:00')), 28)
  const birthStandard = resolveAgeContext({ baby: { birthDate: '2026-01-31', gestationalWeeks: null }, at: '2026-02-28', purpose: 'birth_standard' })
  assert.equal(birthStandard.basis, 'postmenstrual')
  assert.equal(birthStandard.ageDays, null)
  assert.match(birthStandard.limitations.join(' '), /出生孕周/)
})

test('growth chart model keeps all seven official percentile lines and the baby trajectory separate', () => {
  const baby = { id: 'chart-baby', birthDate: '2026-08-01', sex: 'male', gestationalWeeks: 40, gestationalDays: 0 }
  const measurement = createEvaluatedGrowthMeasurement({ id: 'chart-weight', type: 'weight', value: '3.5', measuredAt: '2026-08-06', source: 'clinical' }, baby, [], { now: '2026-08-06T10:00:00.000Z' })
  const model = getGrowthChartModel({ baby, measurements: [measurement], type: 'weight', startMonth: 0, endMonth: 3, now: '2026-08-06T10:00:00.000Z' })
  assert.deepEqual(model.reference.map((line) => line.percentile), [3, 10, 25, 50, 75, 90, 97])
  assert.equal(model.reference.every((line) => line.points.length === 4), true)
  assert.equal(model.points[0].value, 3.5)
  assert.equal(growthLevelLabel(measurement.evaluation), '中')
})

test('growth chart keeps birth-standard records outside the monthly trajectory', () => {
  const baby = { id: 'birth-chart-baby', birthDate: '2026-08-01', sex: 'male', gestationalWeeks: 40, gestationalDays: 0 }
  const birth = createEvaluatedGrowthMeasurement({ id: 'birth-weight', type: 'weight', value: '3.2', measuredAt: '2026-08-01', source: 'birth_record' }, baby, [], { now: '2026-08-06T10:00:00.000Z' })
  const followUp = createEvaluatedGrowthMeasurement({ id: 'follow-up-weight', type: 'weight', value: '3.5', measuredAt: '2026-08-06', source: 'clinical' }, baby, [birth], { now: '2026-08-06T10:00:00.000Z' })
  const model = getGrowthChartModel({ baby, measurements: [birth, followUp], type: 'weight', startMonth: 0, endMonth: 3, now: '2026-08-06T10:00:00.000Z' })
  assert.deepEqual(model.points.map((point) => point.id), ['follow-up-weight'])
  assert.equal(model.birthPoint?.id, 'birth-weight')
})

test('growth facts remain visible without sex while same-day conflicts stop comparisons', () => {
  const baby = { id: 'fact-only-baby', birthDate: '2026-08-01', sex: null, gestationalWeeks: 40, gestationalDays: 0 }
  const first = { id: 'fact-a', type: 'weight', value: '3.5', unit: 'kg', measuredAt: '2026-08-06' }
  const second = { id: 'fact-b', type: 'weight', value: '3.7', unit: 'kg', measuredAt: '2026-08-06' }
  assert.equal(isValidGrowthMeasurement(first, baby, { now: '2026-08-07' }), true)
  assert.deepEqual([...getGrowthMeasurementConflictIds([first, second], baby, { now: '2026-08-07' })].sort(), ['fact-a', 'fact-b'])
  const model = getGrowthChartModel({ baby, measurements: [first, second], type: 'weight', endMonth: 3, now: '2026-08-07' })
  assert.equal(model.points.length, 2)
  assert.equal(model.points.every((point) => point.conflicted), true)
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

test('growth care-plan actions project separately from legacy milestone records', () => {
  const state = { careEvents: [], milestoneRecords: [], carePlanItems: [] }
  const event = createCareEvent({ id: 'growth-plan-1', category: 'care_plan_item', payload: { taskId: 'first-visit-plan', status: 'done' } })
  const projected = applyCareEventsToLegacy(state, [event])
  assert.equal(projected.carePlanItems[0].taskId, 'first-visit-plan')
  assert.equal(projected.carePlanItems[0].status, 'done')
  assert.equal(projected.milestoneRecords.length, 0)
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

test('pulled concern events use the canonical concern category and rebuild the concern row', () => {
  const concernEvent = createCareEvent({
    id: 'concern-open-event',
    babyId: 'baby-1',
    category: 'concern_open',
    payload: { concernId: 'concern-1', topicId: 'jaundice', supportTopic: 'jaundice', supportTitle: { zh: '黄疸观察有变化', en: 'Jaundice observation changed' }, notes: '记录了观察变化' },
  })
  const merged = mergePulledState({ careEvents: [], carePlanItems: [], concerns: [], syncMeta: {} }, { events: [concernEvent], carePlanItems: [], concerns: [] })
  assert.equal(merged.careEvents[0].category, 'concern_open')
  assert.equal(merged.concerns[0].topicId, 'jaundice')
  assert.equal(merged.concerns[0].status, 'open')
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

test('album validates raster files and falls back to file time when EXIF is absent', async () => {
  const lastModified = Date.parse('2026-08-06T02:30:00.000Z')
  const photo = { name: 'first-day.jpg', type: 'image/jpeg', size: 1024, lastModified }
  assert.equal(isSupportedPhoto(photo), true)
  assert.equal(isSupportedPhoto({ ...photo, name: 'unsafe.svg', type: 'image/svg+xml' }), false)
  assert.equal(isSupportedPhoto({ ...photo, size: MAX_PHOTO_BYTES + 1 }), false)
  assert.equal(Date.parse(dateTimeInputToIso('2026-08-06T10:30')) > 0, true)
  assert.deepEqual(await detectPhotoTime(photo), { takenAt: '2026-08-06T02:30:00.000Z', timeSource: 'file' })
  const uploadFallback = await detectPhotoTime({ ...photo, lastModified: 0 })
  assert.equal(uploadFallback.timeSource, 'upload')
  assert.notEqual(uploadFallback.takenAt, '1970-01-01T00:00:00.000Z')
})

test('guest sessions cannot upload album photos', async () => {
  const guest = { token: 'token', expires_at: '2099-01-01T00:00:00.000Z', id: 'account-baby', username: 'baby', role: 'guest', display_name: '游客' }
  const env = { DB: { prepare: () => ({ bind: () => ({ first: async () => guest }) }) }, BABY_PHOTOS: {} }
  const request = new Request('https://babyforge.test/api/photos', { method: 'POST', headers: { cookie: 'babyforge_session=token' } })
  assert.equal((await onPhotoPost({ request, env })).status, 403)
})

test('guest sessions cannot delete album photos and authorized parents can', async () => {
  const guest = { token: 'token', expires_at: '2099-01-01T00:00:00.000Z', id: 'account-baby', username: 'baby', role: 'guest', display_name: '游客' }
  const guestEnv = { DB: { prepare: () => ({ bind: () => ({ first: async () => guest }) }) }, BABY_PHOTOS: { delete: async () => assert.fail('guest deletion must not reach R2') } }
  const guestRequest = new Request('https://babyforge.test/api/photos/photo-1', { method: 'DELETE', headers: { cookie: 'babyforge_session=token' } })
  assert.equal((await onPhotoDelete({ request: guestRequest, env: guestEnv, params: { id: 'photo-1' } })).status, 403)

  let deletedKey = ''
  const parent = { token: 'token', expires_at: '2099-01-01T00:00:00.000Z', id: 'account-1', username: 'parent', role: 'admin', display_name: '家长' }
  const parentEnv = {
    DB: {
      prepare: (sql) => ({
        bind: (...args) => ({
          first: async () => sql.includes('auth_sessions') ? parent : { id: 'photo-1', baby_id: 'baby-1', object_key: 'babies/baby-1/photos/photo-1', baby_status: 'active' },
          run: async () => { assert.match(sql, /DELETE FROM baby_photos/); assert.deepEqual(args, ['photo-1', 'baby-1']); return { success: true } },
        }),
      }),
    },
    BABY_PHOTOS: { delete: async (key) => { deletedKey = key } },
  }
  const parentResponse = await onPhotoDelete({ request: guestRequest, env: parentEnv, params: { id: 'photo-1' } })
  assert.equal(parentResponse.status, 200)
  assert.deepEqual(await parentResponse.json(), { deleted: true, id: 'photo-1' })
  assert.equal(deletedKey, 'babies/baby-1/photos/photo-1')

  const cleanupPendingEnv = {
    ...parentEnv,
    BABY_PHOTOS: { delete: async () => { throw new Error('R2 unavailable') } },
  }
  const cleanupPendingResponse = await onPhotoDelete({ request: guestRequest, env: cleanupPendingEnv, params: { id: 'photo-1' } })
  assert.equal(cleanupPendingResponse.status, 202)
  assert.deepEqual(await cleanupPendingResponse.json(), { deleted: true, id: 'photo-1', storageCleanupPending: true, warning: 'R2 unavailable' })
})

test('photo viewing stays available to guests while downloads require edit permission', async () => {
  const guest = { token: 'token', expires_at: '2099-01-01T00:00:00.000Z', id: 'account-baby', username: 'baby', role: 'guest', display_name: '游客' }
  const photoRow = { id: 'photo-1', object_key: 'babies/baby-1/photos/photo-1', file_name: '第一天.jpg', content_type: 'image/jpeg', baby_status: 'active' }
  const object = { body: 'photo-bytes', httpEtag: 'etag-1', writeHttpMetadata: (headers) => headers.set('content-type', 'image/jpeg') }
  const guestEnv = {
    DB: { prepare: (sql) => ({ bind: () => ({ first: async () => sql.includes('auth_sessions') ? guest : photoRow }) }) },
    BABY_PHOTOS: { get: async () => object },
  }
  const guestRequest = (url) => new Request(url, { headers: { cookie: 'babyforge_session=token' } })
  assert.equal((await onPhotoGet({ request: guestRequest('https://babyforge.test/api/photos/photo-1'), env: guestEnv, params: { id: 'photo-1' } })).status, 200)
  assert.equal((await onPhotoGet({ request: guestRequest('https://babyforge.test/api/photos/photo-1?download=1'), env: guestEnv, params: { id: 'photo-1' } })).status, 403)

  const parent = { ...guest, id: 'account-1', username: 'parent', role: 'admin', display_name: '家长' }
  const parentEnv = {
    ...guestEnv,
    DB: { prepare: (sql) => ({ bind: () => ({ first: async () => sql.includes('auth_sessions') ? parent : photoRow }) }) },
  }
  const parentResponse = await onPhotoGet({ request: guestRequest('https://babyforge.test/api/photos/photo-1?download=1'), env: parentEnv, params: { id: 'photo-1' } })
  assert.equal(parentResponse.status, 200)
  assert.match(parentResponse.headers.get('content-disposition'), /attachment/)
  assert.match(parentResponse.headers.get('content-disposition'), /%E7%AC%AC%E4%B8%80%E5%A4%A9\.jpg/)
  assert.equal(await parentResponse.text(), 'photo-bytes')
})

test('detached baby profiles cannot read retained cloud album URLs', async () => {
  const env = {
    DB: {
      prepare: (sql) => ({
        bind: () => ({
          first: async () => sql.includes('auth_sessions')
            ? { token: 'token', expires_at: '2099-01-01T00:00:00.000Z', id: 'account-1', username: 'parent', role: 'admin', display_name: '家长' }
            : { id: 'photo-1', object_key: 'babies/baby-1/photos/photo-1', content_type: 'image/jpeg', baby_status: 'detached' },
        }),
      }),
    },
    BABY_PHOTOS: { get: async () => assert.fail('detached photo must not reach R2') },
  }
  const request = new Request('https://babyforge.test/api/photos/photo-1', { headers: { cookie: 'babyforge_session=token' } })
  assert.equal((await onPhotoGet({ request, env, params: { id: 'photo-1' } })).status, 404)
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
  assert.equal(eventTitle({ category: 'vaccine', status: 'active' }, 'zh-CN'), '疫苗')
  assert.equal(eventTitle({ category: 'care_plan_item', status: 'active', payload: { planItemId: 'vaccine:hep-b-1' } }, 'zh-CN'), '疫苗')
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
