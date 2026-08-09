import { createGrowthMeasurement, GROWTH_TYPES } from './carePlan.js'
import { WS_T_423_2022, WS_T_800_2022 } from './growthStandards.js'
import { getGestationalDays, isPretermBaby, resolveAgeContext } from './agePolicy.js'

export const GROWTH_SOURCES = Object.freeze([
  'birth_record',
  'clinical',
  'caregiver_observation',
  'standardized_screening',
])

export const GROWTH_AGE_BASES = Object.freeze(['chronological', 'corrected', 'postmenstrual'])

const METRIC_LABELS = {
  weight: '体重',
  length: '身长/身高',
  headCircumference: '头围',
}

export const GROWTH_PERCENTILES = Object.freeze([3, 10, 25, 50, 75, 90, 97])
const SD_LEVELS = [-3, -2, -1, 0, 1, 2, 3]

function dateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''))
  if (!match) throw new TypeError('Date must use YYYY-MM-DD')
  const stamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const date = new Date(stamp)
  if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) throw new TypeError('Invalid calendar date')
  return date
}

function dateDiffInDays(start, end) {
  return Math.round((dateKey(end).getTime() - dateKey(start).getTime()) / 86_400_000)
}

function addDays(value, days) {
  const date = dateKey(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function completedMonths(start, end) {
  const from = dateKey(start)
  const to = dateKey(end)
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth()
  if (to.getUTCDate() < from.getUTCDate()) months -= 1
  return Math.max(0, months)
}

function approximateMonthsFromDays(days) {
  return days === null || days === undefined ? null : Math.max(0, Math.floor(days / 30.4375))
}

function gestationalDays(baby) {
  return getGestationalDays(baby)
}

function isPreterm(baby) {
  return isPretermBaby(baby)
}

export function getGrowthAgeContext(baby, measuredAt, requestedBasis = 'chronological') {
  const basis = GROWTH_AGE_BASES.includes(requestedBasis) ? requestedBasis : 'chronological'
  const measuredDate = dateKey(measuredAt)
  const chronologicalAgeDays = dateDiffInDays(baby.birthDate, measuredAt)
  const chronologicalAgeMonths = completedMonths(baby.birthDate, measuredAt)
  const gestation = gestationalDays(baby)
  let ageStart = baby.birthDate
  let ageDays = chronologicalAgeDays
  let ageMonths = chronologicalAgeMonths
  const limitations = []

  if (basis === 'corrected') {
    if (gestation === null) {
      limitations.push('缺少有效出生孕周，无法计算矫正年龄')
      ageStart = null
      ageDays = null
    } else {
      ageStart = addDays(baby.birthDate, 280 - gestation)
      ageDays = dateDiffInDays(ageStart, measuredAt)
      ageMonths = completedMonths(ageStart, measuredAt)
      if (ageDays < 0) limitations.push('矫正年龄尚未达到预产期')
    }
  }

  const postmenstrualAgeDays = gestation === null ? null : gestation + chronologicalAgeDays
  if (basis === 'postmenstrual' && postmenstrualAgeDays === null) {
    limitations.push('缺少有效出生孕周，无法计算经后年龄')
    ageDays = null
    ageMonths = null
  } else if (basis === 'postmenstrual') {
    ageDays = postmenstrualAgeDays
    ageMonths = approximateMonthsFromDays(postmenstrualAgeDays)
  }

  return {
    basis,
    chronologicalAgeDays,
    chronologicalAgeMonths,
    correctedAgeDays: basis === 'corrected' ? ageDays : gestation === null ? null : chronologicalAgeDays - (280 - gestation),
    postmenstrualAgeDays,
    ageDays,
    ageMonths: ageStart ? ageMonths : null,
    referenceAgeMonths: chronologicalAgeMonths,
    gestationalDays: gestation,
    measuredAt: measuredDate.toISOString().slice(0, 10),
    limitations,
  }
}

function normalizedSource(value) {
  if (value === 'parent-entered') return 'caregiver_observation'
  return GROWTH_SOURCES.includes(value) ? value : 'caregiver_observation'
}

function metricDefinition(type) {
  return GROWTH_TYPES.find((item) => item.id === type) || null
}

function measurementValue(measurement) {
  const value = Number(measurement?.value)
  return Number.isFinite(value) ? value : null
}

function validateMeasurement(measurement, baby, now = new Date()) {
  const errors = []
  const definition = metricDefinition(measurement?.type)
  const value = measurementValue(measurement)
  if (!definition) errors.push('不支持的成长指标')
  if (value === null || value <= 0) errors.push('成长测量数值必须为正数')
  if (definition && (value < definition.min || value > definition.max)) errors.push(`${METRIC_LABELS[definition.id]}超出可接受范围`)
  if (definition && measurement?.unit && measurement.unit !== definition.unit) errors.push(`${METRIC_LABELS[definition.id]}单位必须为 ${definition.unit}`)
  if (!baby?.birthDate) errors.push('缺少出生日期')
  try {
    const measuredAt = dateKey(measurement.measuredAt)
    if (baby?.birthDate && measuredAt < dateKey(baby.birthDate)) errors.push('测量日期不能早于出生日期')
    if (measurement?.source === 'birth_record' && baby?.birthDate && String(measurement.measuredAt).slice(0, 10) !== String(baby.birthDate).slice(0, 10)) errors.push('出生记录的测量日期必须与出生日期一致')
    const today = new Date(now)
    const todayKey = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
    if (measuredAt > todayKey) errors.push('测量日期不能晚于今天')
  } catch {
    errors.push('测量日期必须使用 YYYY-MM-DD')
  }
  if (!['male', 'female'].includes(baby?.sex)) errors.push('缺少用于选择标准的宝宝性别')
  return errors
}

function isActiveMeasurement(measurement) {
  return measurement?.status !== 'voided' && measurement?.status !== 'corrected'
}

function currentMeasurements(measurements = []) {
  const list = Array.isArray(measurements) ? measurements : []
  const superseded = new Set(list.map((item) => item?.correctedFromId).filter(Boolean))
  return list.filter((item) => isActiveMeasurement(item) && item?.id && !superseded.has(item.id))
}

/**
 * A valid fact is deliberately less strict than a standard comparison. Missing
 * sex only prevents choosing a national reference package; it does not erase a
 * positive, dated measurement from the baby's history.
 */
export function isValidGrowthMeasurement(measurement, baby, options = {}) {
  if (!measurement || !isActiveMeasurement(measurement)) return false
  const errors = validateMeasurement(measurement, baby, options.now || new Date())
  return errors.filter((error) => error !== '缺少用于选择标准的宝宝性别').length === 0
}

export function getGrowthMeasurementConflictIds(measurements = [], baby, options = {}) {
  const valid = currentMeasurements(measurements)
    .filter((item) => isValidGrowthMeasurement(item, baby, options))
  const conflicts = new Set()
  const byDate = new Map()
  for (const item of valid) {
    if (!item?.measuredAt) continue
    const key = `${item.type}:${String(item.measuredAt || '').slice(0, 10)}`
    const bucket = byDate.get(key) || []
    bucket.push(item)
    byDate.set(key, bucket)
  }
  for (const bucket of byDate.values()) {
    const values = new Set(bucket.map((item) => measurementValue(item)).filter((value) => value !== null))
    if (values.size > 1) bucket.forEach((item) => conflicts.add(item.id))
  }
  return conflicts
}

export function validateGrowthMeasurement(measurement, baby, options = {}) {
  return validateMeasurement(measurement, baby, options.now || new Date())
}

function tableRow(table, key) {
  return table?.find(([rowKey]) => rowKey === key)?.[1] || null
}

function metricRows(packageData, metric, sex, key) {
  return {
    percentile: tableRow(packageData.percentiles?.[metric]?.[sex], key),
    standardDeviation: tableRow(packageData.standardDeviations?.[metric]?.[sex], key),
  }
}

function officialLevel(value, row, levels) {
  if (!row) return undefined
  const index = row.findIndex((point) => point === value)
  return index === -1 ? undefined : levels[index]
}

function percentileBand(value, row) {
  if (!row) return null
  const labels = ['below-p3', 'p3-p10', 'p10-p25', 'p25-p50', 'p50-p75', 'p75-p90', 'p90-p97', 'p97-plus']
  for (let index = 0; index < row.length; index += 1) {
    if (value < row[index]) return labels[index]
  }
  return labels.at(-1)
}

function trajectoryStatus(measurement, history, baby, evaluation) {
  const measuredDate = String(measurement?.measuredAt || '').slice(0, 10)
  const previous = (Array.isArray(history) ? history : [])
    .filter((item) => item?.id !== measurement?.id && item?.type === measurement?.type && item?.status !== 'voided' && String(item?.measuredAt || '').slice(0, 10) < measuredDate)
    .sort((a, b) => String(a.measuredAt).localeCompare(String(b.measuredAt)))
    .at(-1)
  if (!previous) return 'insufficient_history'
  const previousEvaluation = previous.evaluation || evaluateGrowthMeasurement(previous, baby, history.filter((item) => item.id !== previous.id))
  if (previousEvaluation?.dataQuality !== 'sufficient' || previousEvaluation.ageBasis !== evaluation.ageBasis || previousEvaluation.standardPackageId !== evaluation.standardPackageId) return 'insufficient_history'
  if (evaluation.zScore !== undefined && previousEvaluation.zScore !== undefined && Math.abs(evaluation.zScore - previousEvaluation.zScore) >= 1.5) return 'shift_needs_review'
  const previousValue = measurementValue(previous)
  const currentValue = measurementValue(measurement)
  if (previousValue && currentValue && Math.abs(currentValue - previousValue) / previousValue >= 0.25) return 'verify_measurement'
  return 'tracking'
}

function baseResult(measurement, age, limitations, now) {
  return {
    inputObservationIds: [measurement.id].filter(Boolean),
    metric: measurement.type,
    standardPackageId: null,
    standardVersion: null,
    ageBasis: age.basis,
    ageDays: age.ageDays,
    ageMonths: age.ageMonths,
    referenceAgeMonths: age.referenceAgeMonths,
    trajectoryStatus: 'insufficient_history',
    dataQuality: 'insufficient',
    limitations: [...age.limitations, ...limitations],
    measurementSource: normalizedSource(measurement.source),
    measurementMethod: measurement.method || null,
    evaluatedAt: new Date(now).toISOString(),
  }
}

export function evaluateGrowthMeasurement(measurement, baby, history = [], options = {}) {
  const now = options.now || new Date()
  const policyAge = resolveAgeContext({ baby, at: measurement?.measuredAt, purpose: 'growth_standard' })
  // Only an explicit chronological/corrected override is accepted for
  // deterministic internal calculations. Persisted measurement ageBasis is
  // legacy metadata and cannot change the purpose-owned policy.
  const requestedBasis = ['chronological', 'corrected'].includes(options.ageBasis) ? options.ageBasis : policyAge.basis
  let age
  try {
    age = getGrowthAgeContext(baby, measurement?.measuredAt, requestedBasis)
    age.limitations = [...new Set([...(policyAge.limitations || []), ...(age.limitations || [])])]
  } catch {
    age = { basis: requestedBasis, ageMonths: null, ageDays: null, limitations: ['缺少有效出生日期或测量日期'] }
  }
  const result = baseResult(measurement || {}, age, [], now)
  if (measurement?.ageBasis === 'postmenstrual' && age.basis !== 'postmenstrual') {
    result.limitations.push('经后年龄仅保留为输入口径，不替代标准年龄')
  }
  result.inputObservationIds = [...new Set([...(Array.isArray(history) ? history : []).filter((item) => item?.type === measurement?.type && item?.status !== 'voided'), measurement].filter(Boolean).map((item) => item.id).filter(Boolean))]
  const validationErrors = validateMeasurement(measurement || {}, baby, now)
  if (validationErrors.length) {
    result.limitations.push(...validationErrors)
    result.trajectoryStatus = 'verify_measurement'
    return result
  }

  const source = normalizedSource(measurement.source)
  const isBirthRecord = String(measurement.measuredAt).slice(0, 10) === String(baby.birthDate).slice(0, 10) && source === 'birth_record'
  let standard
  let rows
  if (isBirthRecord) {
    result.standardPackageId = WS_T_800_2022.metadata.id
    result.standardVersion = WS_T_800_2022.metadata.version
    result.standardSourceUrl = WS_T_800_2022.metadata.sourceUrl
    if (baby.birthMultiplicity === 'multiple') {
      result.limitations.push('WS/T 800 仅适用于单胎新生儿，多胎出生记录暂不计算')
      return result
    }
    const gestation = age.gestationalDays
    const gestationalWeek = gestation === null ? null : Math.floor(gestation / 7)
    if (gestationalWeek === null || gestationalWeek < 24 || gestationalWeek > 42) {
      result.limitations.push('出生标准仅适用于胎龄 24–42 周单胎新生儿')
      return result
    }
    standard = WS_T_800_2022
    rows = { percentile: tableRow(standard.percentiles?.[measurement.type]?.[baby.sex], gestationalWeek) }
    if (!rows.percentile) {
      result.limitations.push('官方出生标准缺少对应胎龄数据')
      return result
    }
    result.ageBasis = 'postmenstrual'
    if (measurement.type === 'weight') {
      const value = measurementValue(measurement) * 1000
      result.referencePosition = percentileBand(value, rows.percentile)
      result.percentile = officialLevel(value, rows.percentile, GROWTH_PERCENTILES)
      result.birthSizeCategory = value < rows.percentile[1] ? 'small-for-gestational-age' : value > rows.percentile[5] ? 'large-for-gestational-age' : 'appropriate-for-gestational-age'
    } else {
      const value = measurementValue(measurement)
      result.referencePosition = percentileBand(value, rows.percentile)
      result.percentile = officialLevel(value, rows.percentile, GROWTH_PERCENTILES)
      result.limitations.push('出生身长和出生头围为辅助指标，WS/T 800 不据此单独判定胎龄大小')
    }
  } else {
    result.standardPackageId = WS_T_423_2022.metadata.id
    result.standardVersion = WS_T_423_2022.metadata.version
    result.standardSourceUrl = WS_T_423_2022.metadata.sourceUrl
    if (isPreterm(baby) && age.basis !== 'corrected') {
      result.limitations.push('早产儿参考需要使用矫正年龄；当前年龄口径不计算足月儿童标准')
      return result
    }
    const standardAgeMonths = age.basis === 'postmenstrual' ? age.referenceAgeMonths : age.ageMonths
    if (standardAgeMonths === null || age.ageDays === null || standardAgeMonths > 83 || age.ageDays < 0) {
      result.limitations.push('WS/T 423 仅提供未满 84 月龄的整月参考数据')
      return result
    }
    standard = WS_T_423_2022
    rows = metricRows(standard, measurement.type, baby.sex, standardAgeMonths)
    if (!rows.percentile || !rows.standardDeviation) {
      result.limitations.push('官方标准缺少对应年龄或指标数据')
      return result
    }
    const value = measurementValue(measurement)
    result.referencePosition = percentileBand(value, rows.percentile)
    result.percentile = officialLevel(value, rows.percentile, GROWTH_PERCENTILES)
    result.zScore = officialLevel(value, rows.standardDeviation, SD_LEVELS)
    if (age.basis === 'postmenstrual') result.limitations.push('WS/T 423 的年龄口径为出生后整月；经后年龄仅保留为输入口径，不替代标准年龄')
  }

  result.dataQuality = 'sufficient'
  result.trajectoryStatus = trajectoryStatus(measurement, history, baby, result)
  return result
}

export function createEvaluatedGrowthMeasurement(input, baby, history = [], options = {}) {
  // Age basis is derived at evaluation time from the age policy; do not copy
  // a legacy basis into a new observation.
  const measurement = createGrowthMeasurement({ ...input, ageBasis: null }, options)
  return { ...measurement, evaluation: evaluateGrowthMeasurement(measurement, baby, history, options) }
}

export function growthReferenceLabel(evaluation, locale = 'zh-CN') {
  const labels = locale === 'en-US'
    ? { 'below-p3': 'below P3', 'p3-p10': 'P3–P10', 'p10-p25': 'P10–P25', 'p25-p50': 'P25–P50', 'p50-p75': 'P50–P75', 'p75-p90': 'P75–P90', 'p90-p97': 'P90–P97', 'p97-plus': 'P97 or above' }
    : { 'below-p3': '低于 P3', 'p3-p10': 'P3–P10', 'p10-p25': 'P10–P25', 'p25-p50': 'P25–P50', 'p50-p75': 'P50–P75', 'p75-p90': 'P75–P90', 'p90-p97': 'P90–P97', 'p97-plus': 'P97 及以上' }
  return labels[evaluation?.referencePosition] || (locale === 'en-US' ? 'Reference unavailable' : '暂无参考位置')
}

export function growthLevelKey(evaluation) {
  const position = evaluation?.referencePosition
  if (!position) return null
  if (position === 'below-p3') return 'low'
  if (position === 'p97-plus') return 'high'
  if (position === 'p3-p10' || position === 'p10-p25') return 'mid-low'
  if (position === 'p75-p90' || position === 'p90-p97') return 'mid-high'
  return 'mid'
}

export function growthLevelLabel(evaluation, locale = 'zh-CN') {
  const labels = locale === 'en-US'
    ? { low: 'Low', 'mid-low': 'Below middle', mid: 'Middle', 'mid-high': 'Above middle', high: 'High' }
    : { low: '下', 'mid-low': '中下', mid: '中', 'mid-high': '中上', high: '上' }
  return labels[growthLevelKey(evaluation)] || (locale === 'en-US' ? 'Reference unavailable' : '暂无标准结论')
}

export function getGrowthReferenceSeries({ baby, type = 'weight', startMonth = 0, endMonth = 3 } = {}) {
  const definition = metricDefinition(type)
  const sex = baby?.sex
  if (!definition || !['male', 'female'].includes(sex)) return []
  const rows = WS_T_423_2022.percentiles?.[type]?.[sex] || []
  const min = Number.isFinite(Number(startMonth)) ? Math.max(0, Number(startMonth)) : 0
  const max = Number.isFinite(Number(endMonth)) ? Math.max(min, Number(endMonth)) : min + 3
  return GROWTH_PERCENTILES.map((percentile, percentileIndex) => ({
    id: `p${percentile}`,
    percentile,
    points: rows.filter(([month]) => month >= min && month <= max).map(([month, values]) => ({ month, value: values[percentileIndex] })),
  }))
}

export function getGrowthChartModel({ baby, measurements = [], type = 'weight', startMonth = 0, endMonth = 3, now = new Date() } = {}) {
  const current = currentMeasurements(measurements)
  const conflictIds = getGrowthMeasurementConflictIds(current, baby, { now })
  const evaluations = current
    .filter((item) => item?.type === type)
    .map((item) => ({
      ...item,
      evaluation: evaluateGrowthMeasurement(item, baby, measurements, { now }),
      factValid: isValidGrowthMeasurement(item, baby, { now }),
      conflicted: conflictIds.has(item.id),
    }))
  const points = evaluations
    .filter((item) => item.factValid && item.source !== 'birth_record' && item.evaluation?.standardPackageId !== WS_T_800_2022.metadata.id && Number.isFinite(Number(item.evaluation.ageMonths)))
    .map((item) => ({ id: item.id, month: Number(item.evaluation.ageMonths), value: Number(item.value), unit: item.unit, measuredAt: String(item.measuredAt).slice(0, 10), source: item.source, evaluation: item.evaluation, conflicted: item.conflicted, quality: item.evaluation?.dataQuality === 'sufficient' ? 'standard' : 'fact-only' }))
    .filter((point) => point.month >= startMonth && point.month <= endMonth && Number.isFinite(point.value))
    .sort((a, b) => a.month - b.month || a.measuredAt.localeCompare(b.measuredAt))
  const birthPoint = evaluations
    .filter((item) => item.evaluation?.standardPackageId === WS_T_800_2022.metadata.id && item.evaluation?.dataQuality === 'sufficient' && String(item.measuredAt).slice(0, 10) === String(baby?.birthDate).slice(0, 10))
    .sort((a, b) => String(a.measuredAt).localeCompare(String(b.measuredAt)))
    .at(-1)
  return {
    metric: type,
    unit: metricDefinition(type)?.unit || null,
    range: { startMonth, endMonth },
    reference: getGrowthReferenceSeries({ baby, type, startMonth, endMonth }),
    points,
    conflictIds: [...conflictIds],
    birthPoint: birthPoint ? { id: birthPoint.id, value: Number(birthPoint.value), measuredAt: String(birthPoint.measuredAt).slice(0, 10), evaluation: birthPoint.evaluation } : null,
    standard: { id: WS_T_423_2022.metadata.id, version: WS_T_423_2022.metadata.version, sourceUrl: WS_T_423_2022.metadata.sourceUrl },
  }
}

export function growthSourceLabel(source, locale = 'zh-CN') {
  const labels = locale === 'en-US'
    ? { birth_record: 'Birth record', clinical: 'Clinical', caregiver_observation: 'Caregiver observation', standardized_screening: 'Standardized screening' }
    : { birth_record: '出生记录', clinical: '临床测量', caregiver_observation: '家长观察/测量', standardized_screening: '标准化筛查' }
  return labels[normalizedSource(source)]
}

export function growthTrajectoryLabel(status, locale = 'zh-CN') {
  const labels = locale === 'en-US'
    ? { insufficient_history: 'Need another reliable measurement', tracking: 'Tracking consistently', shift_needs_review: 'Change needs review', verify_measurement: 'Verify the measurement' }
    : { insufficient_history: '需要更多可靠测量', tracking: '趋势保持稳定', shift_needs_review: '变化需要复核', verify_measurement: '请复核这次测量' }
  return labels[status] || labels.insufficient_history
}
