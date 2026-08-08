import { calendarDateKey } from './date.js'

const DAY_MS = 86_400_000
const TERM_GESTATION_DAYS = 37 * 7
const STANDARD_GESTATION_DAYS = 40 * 7
const VERY_PRETERM_GESTATION_DAYS = 28 * 7
const CORRECTION_LIMIT_DAYS = 24 * 30.4375
const VERY_PRETERM_CORRECTION_LIMIT_DAYS = 36 * 30.4375

export const AGE_PURPOSES = Object.freeze([
  'dashboard',
  'stage',
  'development',
  'growth_standard',
  'birth_standard',
  'care_plan',
])

function dateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''))
  if (!match) throw new TypeError('Date must use YYYY-MM-DD')
  const stamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const date = new Date(stamp)
  if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) {
    throw new TypeError('Invalid calendar date')
  }
  return date
}

function localDateKey(value = new Date()) {
  return calendarDateKey(value)
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

export function getGestationalDays(baby) {
  if (baby?.gestationalWeeks === null || baby?.gestationalWeeks === undefined || String(baby.gestationalWeeks).trim() === '') return null
  const weeks = Number(baby.gestationalWeeks)
  const days = Number(baby.gestationalDays || 0)
  if (!Number.isFinite(weeks) || !Number.isFinite(days) || weeks < 20 || weeks > 44 || days < 0 || days > 6) return null
  return Math.round(weeks * 7 + days)
}

export function isPretermBaby(baby) {
  const gestation = getGestationalDays(baby)
  return gestation !== null && gestation < TERM_GESTATION_DAYS
}

function correctionLimitDays(gestation) {
  return gestation < VERY_PRETERM_GESTATION_DAYS ? VERY_PRETERM_CORRECTION_LIMIT_DAYS : CORRECTION_LIMIT_DAYS
}

function purposeUsesCorrectedAge(purpose) {
  return purpose === 'dashboard' || purpose === 'stage' || purpose === 'development' || purpose === 'growth_standard'
}

function normalizePurpose(purpose) {
  return AGE_PURPOSES.includes(purpose) ? purpose : 'dashboard'
}

function emptyContext(at, limitations = []) {
  return {
    purpose: 'dashboard',
    basis: 'chronological',
    at,
    chronological: { days: null, months: null },
    corrected: null,
    postmenstrual: null,
    gestationalDays: null,
    correctionActive: false,
    correctionLimitDays: null,
    limitations,
  }
}

/**
 * Resolve age once for a product purpose. The returned basis is policy-owned;
 * user profile preferences are intentionally not accepted as an override.
 */
export function resolveAgeContext({ baby, at = new Date(), purpose = 'dashboard' } = {}) {
  const normalizedPurpose = normalizePurpose(purpose)
  let measuredAt
  try {
    measuredAt = localDateKey(at)
  } catch {
    return { ...emptyContext(null, ['缺少有效评估日期']), purpose: normalizedPurpose }
  }
  if (!baby?.birthDate) return { ...emptyContext(measuredAt, ['缺少出生日期']), purpose: normalizedPurpose }

  let chronologicalAgeDays
  let chronologicalAgeMonths
  try {
    chronologicalAgeDays = Math.round((dateKey(measuredAt).getTime() - dateKey(baby.birthDate).getTime()) / DAY_MS)
    chronologicalAgeMonths = completedMonths(baby.birthDate, measuredAt)
  } catch {
    return { ...emptyContext(measuredAt, ['出生日期格式无效']), purpose: normalizedPurpose }
  }

  const limitations = []
  if (chronologicalAgeDays < 0) limitations.push('评估日期早于出生日期')
  const gestationalDays = getGestationalDays(baby)
  if (normalizedPurpose === 'birth_standard' && gestationalDays === null) {
    return {
      purpose: normalizedPurpose,
      basis: 'postmenstrual',
      at: measuredAt,
      ageDays: null,
      ageMonths: null,
      chronological: { days: chronologicalAgeDays, months: chronologicalAgeMonths },
      corrected: null,
      postmenstrual: null,
      gestationalDays: null,
      correctionActive: false,
      correctionLimitDays: null,
      limitations: ['缺少有效出生孕周，无法使用出生标准'],
    }
  }
  const preterm = gestationalDays !== null && gestationalDays < TERM_GESTATION_DAYS
  const correctionLimit = preterm ? correctionLimitDays(gestationalDays) : null
  const correctedAgeDays = gestationalDays === null ? null : chronologicalAgeDays - (STANDARD_GESTATION_DAYS - gestationalDays)
  const correctedAgeMonths = correctedAgeDays === null ? null : approximateMonthsFromDays(correctedAgeDays)
  const postmenstrualAgeDays = gestationalDays === null ? null : gestationalDays + chronologicalAgeDays
  const correctionActive = preterm && correctedAgeDays !== null && chronologicalAgeDays <= correctionLimit

  if (preterm && gestationalDays !== null && chronologicalAgeDays <= correctionLimit) {
    limitations.push('早产宝宝在适用期限内，阶段与发展参考使用矫正年龄')
  } else if (preterm && chronologicalAgeDays > correctionLimit) {
    limitations.push('已超过当前规则的矫正年龄适用期限，阶段与发展参考使用实际年龄')
  }
  if (gestationalDays === null && purposeUsesCorrectedAge(normalizedPurpose)) limitations.push('缺少有效出生孕周，不推算矫正年龄')

  const basis = purposeUsesCorrectedAge(normalizedPurpose) && correctionActive ? 'corrected' : normalizedPurpose === 'birth_standard' ? 'postmenstrual' : 'chronological'
  const selectedDays = basis === 'corrected' ? correctedAgeDays : basis === 'postmenstrual' ? postmenstrualAgeDays : chronologicalAgeDays
  const selectedMonths = basis === 'corrected' ? correctedAgeMonths : basis === 'postmenstrual' ? approximateMonthsFromDays(postmenstrualAgeDays) : chronologicalAgeMonths

  return {
    purpose: normalizedPurpose,
    basis,
    at: measuredAt,
    ageDays: selectedDays,
    ageMonths: selectedMonths,
    chronological: { days: chronologicalAgeDays, months: chronologicalAgeMonths },
    corrected: correctedAgeDays === null ? null : { days: correctedAgeDays, months: correctedAgeMonths },
    postmenstrual: postmenstrualAgeDays === null ? null : { days: postmenstrualAgeDays, months: approximateMonthsFromDays(postmenstrualAgeDays) },
    gestationalDays,
    correctionActive,
    correctionLimitDays: correctionLimit,
    limitations,
  }
}

export function ageBasisLabel(basis, locale = 'zh-CN') {
  const labels = locale === 'en-US'
    ? { chronological: 'Chronological age', corrected: 'Corrected age', postmenstrual: 'Postmenstrual age' }
    : { chronological: '实际年龄', corrected: '矫正年龄', postmenstrual: '经后年龄' }
  return labels[basis] || labels.chronological
}

export function ageContextSummary(context, locale = 'zh-CN') {
  if (!context) return locale === 'en-US' ? 'Age unavailable' : '年龄信息不足'
  if (context.ageDays < 0 && Number.isFinite(context.chronological?.days)) {
    const daysBeforeDue = Math.abs(context.ageDays)
    return locale === 'en-US'
      ? `Actual ${Math.max(0, context.chronological.days)} days · corrected age is ${daysBeforeDue} days before due date`
      : `实际 ${Math.max(0, context.chronological.days)} 天 · 矫正年龄尚未到预产期（还差 ${daysBeforeDue} 天）`
  }
  const age = context.ageMonths === null || context.ageMonths === undefined
    ? locale === 'en-US' ? 'age unavailable' : '年龄信息不足'
    : locale === 'en-US' ? `${context.ageMonths} months` : `${context.ageMonths} 个月`
  return `${age} · ${ageBasisLabel(context.basis, locale)}`
}

export const AGE_POLICY_CONSTANTS = Object.freeze({
  TERM_GESTATION_DAYS,
  STANDARD_GESTATION_DAYS,
  VERY_PRETERM_GESTATION_DAYS,
  CORRECTION_LIMIT_DAYS,
  VERY_PRETERM_CORRECTION_LIMIT_DAYS,
})
