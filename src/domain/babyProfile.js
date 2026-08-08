import { createCareEvent, correctCareEvent, voidCareEvent } from './careEvents.js'
import { calendarDateKey } from './date.js'
import { createEvaluatedGrowthMeasurement } from './growth.js'

function actorFor(state) {
  return state.careActors?.find((actor) => actor.id === state.preferences?.currentRecorderId) || state.careActors?.[0]
}

function measurementPayload(event) {
  const payload = event?.payload || {}
  return payload.record && typeof payload.record === 'object' ? payload.record : payload
}

function measurementInputChanged(previous, next) {
  return ['type', 'value', 'unit', 'measuredAt', 'source', 'method', 'note'].some((key) => String(previous?.[key] ?? '') !== String(next?.[key] ?? ''))
}

export function validateBasicInfoForm(form, isEnglish = false) {
  const message = (zh, en) => isEnglish ? en : zh
  if (!String(form.nickname || '').trim()) return message('请填写宝宝昵称。', 'Enter the baby nickname.')
  const birthDate = String(form.birthDate || '').trim()
  try {
    if (!birthDate || calendarDateKey(birthDate) !== birthDate) return message('请填写有效的出生日期。', 'Enter a valid birth date.')
  } catch {
    return message('请填写有效的出生日期。', 'Enter a valid birth date.')
  }
  const weeks = Number(form.gestationalWeeks)
  if (!Number.isFinite(weeks) || weeks < 20 || weeks > 44) return message('出生孕周必须在 20–44 周之间。', 'Gestational weeks must be between 20 and 44 weeks.')
  const days = Number(form.gestationalDays)
  if (!Number.isInteger(days) || days < 0 || days > 6) return message('孕周余天必须是 0–6 的整数。', 'Extra gestational days must be an integer from 0 to 6.')
  if (birthDate > calendarDateKey()) return message('出生日期不能晚于今天。', 'Birth date cannot be in the future.')
  for (const [key, label, max] of [['birthWeight', '体重', 20], ['birthLength', '身长', 100], ['birthHeadCircumference', '头围', 70]]) {
    const value = String(form[key] || '').trim()
    if (!value) continue
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > max) return message(`${label}必须在 0–${max} 范围内。`, `${key} must be between 0 and ${max}.`)
  }
  return ''
}

export function updateBabyProfileState(current, profile, { locale = 'zh-CN', now = new Date().toISOString() } = {}) {
  const validationError = validateBasicInfoForm(profile, locale === 'en-US')
  if (validationError) throw new Error(validationError)
  const { birthWeight, birthLength, birthHeadCircumference, ...profileFields } = profile
  const nextBaby = { ...current.baby, ...profileFields }
  const birthDate = nextBaby.birthDate
  const birthInputs = [
    ['weight', birthWeight, 'kg', 'weight_scale'],
    ['length', birthLength, 'cm', 'lying_length'],
    ['headCircumference', birthHeadCircumference, 'cm', 'head_circumference_tape'],
  ]
  const profileChanged = ['birthDate', 'gestationalWeeks', 'gestationalDays', 'birthMultiplicity'].some((key) => String(current.baby?.[key] ?? '') !== String(nextBaby[key] ?? ''))
  const birthEvents = (current.careEvents || []).filter((event) => {
    const measurement = measurementPayload(event)
    return event.status === 'active' && event.category === 'growth_measurement' && measurement.source === 'birth_record'
  })
  const existingByType = new Map(birthEvents.filter((event) => String(measurementPayload(event).measuredAt).slice(0, 10) === String(birthDate).slice(0, 10)).map((event) => [measurementPayload(event).type, event]))
  const nonBirth = (current.growthMeasurements || []).filter((item) => item.source !== 'birth_record')
  const actor = actorFor(current)
  if (!actor?.id || !actor?.displayName) throw new Error(locale === 'en-US' ? 'Choose the current role first.' : '请先选择当前角色。')
  const birthMeasurements = birthInputs.filter(([, value]) => String(value || '').trim()).map(([type, value, unit, method]) => {
    const prior = existingByType.get(type)
    return createEvaluatedGrowthMeasurement({ id: prior ? measurementPayload(prior).id || prior.id : undefined, type, value: String(value).trim(), unit, measuredAt: birthDate, method, source: 'birth_record' }, nextBaby, nonBirth)
  })
  const eventsById = new Map((current.careEvents || []).map((event) => [event.id, event]))
  for (const measurement of birthMeasurements) {
    const prior = existingByType.get(measurement.type)
    if (!prior) {
      const event = createCareEvent({ id: measurement.id, babyId: nextBaby.id, kind: 'measurement', category: 'growth_measurement', occurredAt: `${birthDate}T12:00:00.000Z`, recordedAt: now, actor, source: 'caregiver', payload: measurement })
      eventsById.set(event.id, event)
    } else if (profileChanged || measurementInputChanged(measurementPayload(prior), measurement)) {
      const corrected = correctCareEvent([...eventsById.values()], prior.id, { kind: 'measurement', category: 'growth_measurement', occurredAt: `${birthDate}T12:00:00.000Z`, recordedAt: now, actor, source: 'caregiver', payload: measurement }, { now })
      eventsById.clear()
      corrected.forEach((event) => eventsById.set(event.id, event))
    }
  }
  const retainedTypes = new Set(birthMeasurements.map((measurement) => measurement.type))
  for (const prior of birthEvents) {
    const priorMeasurement = measurementPayload(prior)
    const sameBirthDate = String(priorMeasurement.measuredAt).slice(0, 10) === String(birthDate).slice(0, 10)
    if (!sameBirthDate || !retainedTypes.has(priorMeasurement.type)) eventsById.set(prior.id, voidCareEvent(prior, { now }))
  }
  return { ...current, baby: nextBaby, careEvents: [...eventsById.values()] }
}
