import { getStage } from './baby.js'
import { resolveAgeContext } from './agePolicy.js'
import { getAdminTasks, getStageMilestones, GROWTH_TYPES } from './carePlan.js'
import {
  evaluateGrowthMeasurement,
  getGrowthChartModel,
  getGrowthMeasurementConflictIds,
} from './growth.js'
import { buildGrowthInterpretation } from './naibaCapabilities.js'
import { getGrowthStageContent } from '../content/growthStages.js'
import { localDayForTimezone } from './nativeToday.js'

export const NATIVE_GROWTH_CONTRACT = 'babyforge.native.growth'
export const NATIVE_GROWTH_CONTRACT_VERSION = '1.0.0'

const safeDate = (value, fallback = new Date()) => {
  const date = value instanceof Date ? value : new Date(value || fallback)
  return Number.isNaN(date.getTime()) ? new Date(fallback) : date
}

const asArray = value => (Array.isArray(value) ? value : [])

const byRecordedAt = (left, right) => {
  const leftTime = safeDate(left.measuredAt || left.recordedAt || left.createdAt, 0).getTime()
  const rightTime = safeDate(right.measuredAt || right.recordedAt || right.createdAt, 0).getTime()
  return rightTime - leftTime
}

const isActiveMeasurement = measurement => measurement && measurement.status !== 'voided' && measurement.status !== 'corrected'

const normalizePermissions = permissions => ({
  role: permissions?.role || 'readOnly',
  readOnly: permissions?.readOnly !== false,
  canEdit: permissions?.canEdit === true,
  canManageHousehold: permissions?.canManageHousehold === true,
})

const normalizeMeasurement = (measurement, baby, now, history = []) => {
  const evaluation = measurement?.evaluation || evaluateGrowthMeasurement(
    measurement,
    baby,
    history,
    { now },
  )
  const rawValue = measurement?.value
  const numericValue = rawValue === null || rawValue === undefined || String(rawValue).trim() === '' ? null : Number(rawValue)
  return {
    ...measurement,
    value: Number.isFinite(numericValue) ? numericValue : null,
    measuredAt: measurement?.measuredAt || measurement?.recordedAt || null,
    status: measurement?.status || 'active',
    evaluation: evaluation || null,
    conflict: false,
  }
}

const pickLatest = (measurements, type) => asArray(measurements)
  .filter(measurement => measurement?.type === type && isActiveMeasurement(measurement))
  .sort(byRecordedAt)

const buildMetric = (definition, measurements, conflictIds) => {
  const ordered = pickLatest(measurements, definition.id)
  const latest = ordered[0] || null
  const previous = ordered[1] || null
  const latestWithConflict = latest
    ? { ...latest, conflict: conflictIds.has(latest.id) }
    : null
  const previousWithConflict = previous
    ? { ...previous, conflict: conflictIds.has(previous.id) }
    : null
  const numericValue = value => {
    if (value === null || value === undefined || String(value).trim() === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  const latestValue = numericValue(latest?.value)
  const previousValue = numericValue(previous?.value)
  const hasChange = Number.isFinite(latestValue)
    && Number.isFinite(previousValue)
    && !latestWithConflict?.conflict
    && !previousWithConflict?.conflict

  return {
    id: definition.id,
    label: definition.label,
    unit: definition.unit,
    latest: latestWithConflict,
    previous: previousWithConflict,
    change: {
      available: hasChange,
      value: hasChange ? latestValue - previousValue : null,
      unit: definition.unit,
    },
  }
}

const buildMeasurementList = (measurements, baby, now, conflictIds) => {
  const history = asArray(measurements)
  return history.map(measurement => ({
    ...normalizeMeasurement(measurement, baby, now, history),
    conflict: conflictIds.has(measurement?.id),
  }))
  .sort(byRecordedAt)
}

const buildChart = (definition, baby, measurements, now) => getGrowthChartModel({
  baby,
  measurements,
  type: definition.id,
  startMonth: 0,
  endMonth: 83,
  now,
})

export function validateNativeGrowthModel(model) {
  if (!model || typeof model !== 'object') throw new TypeError('Native growth model must be an object')
  if (model.contract !== NATIVE_GROWTH_CONTRACT) throw new TypeError('Invalid native growth contract')
  if (model.contractVersion !== NATIVE_GROWTH_CONTRACT_VERSION) throw new TypeError('Invalid native growth contract version')
  if (!model.metadata?.generatedAt || !model.metadata?.timezone) {
    throw new TypeError('Missing native growth metadata')
  }
  if (!model.baby?.id || !model.age || !model.stage || !model.permissions) {
    throw new TypeError('Missing native growth identity')
  }
  for (const key of ['measurements', 'metrics', 'charts', 'milestones', 'carePlanItems', 'adminTasks']) {
    if (!Array.isArray(model[key])) throw new TypeError(`Invalid native growth ${key}`)
  }
  return model
}

export function buildNativeGrowthModel({
  baby,
  measurements = [],
  milestoneRecords = [],
  carePlanItems = [],
  adminTaskRecords = [],
  permissions = {},
  locale = 'zh-CN',
  dataTimezone = 'Asia/Shanghai',
  sourceVersion = 'shared-domain',
  now = new Date(),
} = {}) {
  if (!baby?.id) throw new TypeError('A baby is required to build native growth model')

  const generatedAt = safeDate(now)
  let generatedDay = generatedAt.toISOString().slice(0, 10)
  try { generatedDay = localDayForTimezone(generatedAt, dataTimezone) || generatedDay } catch { /* API validates timezone; keep deterministic UTC fallback */ }
  const age = resolveAgeContext({ baby, at: generatedDay, purpose: 'growth-dashboard' })
  const stageAgeDays = Number.isFinite(age.chronological?.days) ? age.chronological.days : age.ageDays
  const stage = getStage(Number.isFinite(stageAgeDays) ? Math.max(0, stageAgeDays) : -1)
  const sourceMeasurements = asArray(measurements)
  const normalizedMeasurements = sourceMeasurements
    .map(measurement => normalizeMeasurement(measurement, baby, generatedAt, sourceMeasurements))
  const conflictIds = getGrowthMeasurementConflictIds(normalizedMeasurements, baby, { now: generatedAt })
  const measurementList = buildMeasurementList(normalizedMeasurements, baby, generatedAt, conflictIds)
  const superseded = new Set(measurementList.map(item => item.correctedFromId).filter(Boolean))
  const currentMeasurementList = measurementList.filter(item => isActiveMeasurement(item) && !superseded.has(item.id))
  const metrics = GROWTH_TYPES.map(definition => buildMetric(definition, currentMeasurementList, conflictIds))
  const charts = GROWTH_TYPES.map(definition => buildChart(definition, baby, measurementList, generatedDay))
  const milestones = getStageMilestones(stage.id, milestoneRecords)
  const adminTasks = getAdminTasks(stage.id, Number.isFinite(stageAgeDays) ? Math.max(0, stageAgeDays) : 0, adminTaskRecords)
  const interpretation = buildGrowthInterpretation({
    baby,
    events: measurementList,
    measurements: measurementList,
    metric: metrics.find(metric => metric.latest)?.id || 'weight',
    type: metrics.find(metric => metric.latest)?.id || 'weight',
    locale,
    now: generatedDay,
  })

  return validateNativeGrowthModel({
    contract: NATIVE_GROWTH_CONTRACT,
    contractVersion: NATIVE_GROWTH_CONTRACT_VERSION,
    metadata: {
      generatedAt: generatedAt.toISOString(),
      timezone: dataTimezone,
      sourceVersion,
      locale,
    },
    permissions: normalizePermissions(permissions),
    baby: {
      id: baby.id,
      nickname: baby.nickname || '',
      birthDate: baby.birthDate || null,
      gestationalWeeks: baby.gestationalWeeks ?? null,
      gestationalDays: baby.gestationalDays ?? null,
      growthAgeBasis: baby.growthAgeBasis || null,
      birthMultiplicity: baby.birthMultiplicity || null,
      sex: baby.sex || null,
    },
    age,
    stage,
    stageContent: getGrowthStageContent(stage.id),
    measurements: measurementList,
    metrics,
    charts,
    milestones,
    carePlanItems: asArray(carePlanItems),
    adminTasks,
    parentActions: [
      ...asArray(carePlanItems).filter(item => item.status !== 'done'),
      ...adminTasks.filter(item => item.status !== 'done'),
    ],
    interpretation: interpretation || null,
    limitations: age.limitations || [],
    sources: {
      agePolicy: age.basis || 'chronological',
      growthReference: 'shared-growth-reference',
      stageContent: 'shared-growth-stage-content',
    },
  })
}
