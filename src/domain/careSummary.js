const DAY_MS = 24 * 60 * 60 * 1000

const EVENT_LABELS = {
  breastfeeding: { zh: '亲喂', en: 'Breastfeed' },
  bottle_feeding: { zh: '瓶喂', en: 'Bottle feed' },
  sleep: { zh: '睡眠', en: 'Sleep' },
  diaper: { zh: '尿便', en: 'Diaper' },
  temperature: { zh: '体温', en: 'Temperature' },
  temperature_observation: { zh: '体温观察', en: 'Temperature observation' },
  growth_measurement: { zh: '成长测量', en: 'Growth measurement' },
  symptom_observation: { zh: '异常观察', en: 'Observation' },
  concern_open: { zh: '关注事项', en: 'Follow-up concern' },
  care_action: { zh: '照护记录', en: 'Care action' },
  health_visit: { zh: '就诊', en: 'Health visit' },
  vaccination: { zh: '疫苗', en: 'Vaccination' },
  medication: { zh: '用药记录', en: 'Medication' },
}

const EVENT_KIND_LABELS = {
  caregiver_observation: { zh: '照护观察', en: 'Caregiver observation' },
  measurement: { zh: '测量', en: 'Measurement' },
  professional_conclusion: { zh: '专业结论', en: 'Professional conclusion' },
}

const EVENT_CATEGORY_LABELS = {
  ...EVENT_LABELS,
  observation: { zh: '观察', en: 'Observation' },
  admin_task: { zh: '行政事项', en: 'Admin task' },
  milestone: { zh: '里程碑', en: 'Milestone' },
  language: { zh: '语言观察', en: 'Language observation' },
  emotion: { zh: '情绪观察', en: 'Emotion observation' },
  oxygen_saturation: { zh: '血氧饱和度', en: 'Oxygen saturation' },
  weight: { zh: '体重', en: 'Weight' },
  length: { zh: '身长', en: 'Length' },
  headCircumference: { zh: '头围', en: 'Head circumference' },
}

function asTime(value) {
  const time = new Date(value || 0).getTime()
  return Number.isFinite(time) ? time : 0
}

function isActive(event) {
  return event?.status === 'active'
}

function categoryOf(event) {
  return event?.category || event?.type
}

function eventPayload(event) {
  const payload = event?.payload || {}
  return payload.record && typeof payload.record === 'object' ? payload.record : payload
}

function normalizedGrowthType(value) {
  const normalized = String(value || '').replaceAll('_', '').toLowerCase()
  if (normalized === 'length') return 'length'
  if (normalized === 'headcircumference') return 'headCircumference'
  if (normalized === 'weight') return 'weight'
  return ''
}

export function localDayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function localDayBounds(day = localDayKey()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day))
  if (!match) return localDayBounds(localDayKey())
  const start = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (start.getFullYear() !== Number(match[1]) || start.getMonth() !== Number(match[2]) - 1 || start.getDate() !== Number(match[3])) return localDayBounds(localDayKey())
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: start.getTime(), end: end.getTime() }
}

function eventInterval(event) {
  const start = asTime(event?.occurredAt || event?.createdAt)
  const end = categoryOf(event) === 'sleep' ? asTime(event?.payload?.endedAt) : start
  return { start, end: end > start ? end : start }
}

function overlapsDay(event, bounds) {
  const interval = eventInterval(event)
  if (!interval.start) return false
  if (categoryOf(event) !== 'sleep') return interval.start >= bounds.start && interval.start < bounds.end
  return interval.end > bounds.start && interval.start < bounds.end
}

export function getLocalDayEvents(events = [], day = localDayKey(), category = '') {
  const bounds = localDayBounds(day)
  return events
    .filter(isActive)
    .filter((event) => !category || categoryOf(event) === category)
    .filter((event) => overlapsDay(event, bounds))
    .sort((a, b) => asTime(b.occurredAt || b.createdAt) - asTime(a.occurredAt || a.createdAt))
}

function clippedSleepMinutes(event, bounds) {
  const interval = eventInterval(event)
  if (!interval.start || interval.end <= interval.start) return 0
  const start = Math.max(interval.start, bounds.start)
  const end = Math.min(interval.end, bounds.end)
  return end > start ? Math.round((end - start) / 60_000) : 0
}

function latestEvent(events) {
  return events.slice().sort((a, b) => asTime(b.occurredAt || b.createdAt) - asTime(a.occurredAt || a.createdAt))[0] || null
}

export function formatDurationMinutes(minutes = 0, locale = 'zh-CN') {
  const total = Math.max(0, Math.round(Number(minutes) || 0))
  const hours = Math.floor(total / 60)
  const remaining = total % 60
  if (locale === 'en-US') return hours ? `${hours}h ${remaining}m` : `${remaining}m`
  return hours ? `${hours}小时${remaining ? `${remaining}分` : ''}` : `${remaining}分钟`
}

export function getDailyCareSummary(events = [], day = localDayKey()) {
  const bounds = localDayBounds(day)
  const daily = getLocalDayEvents(events, day)
  const feeding = daily.filter((event) => ['breastfeeding', 'bottle_feeding'].includes(categoryOf(event)))
  const bottle = feeding.filter((event) => categoryOf(event) === 'bottle_feeding')
  const sleep = daily.filter((event) => categoryOf(event) === 'sleep')
  const diapers = daily.filter((event) => categoryOf(event) === 'diaper')
  const medication = daily.filter((event) => categoryOf(event) === 'medication')
  const temperature = daily.filter((event) => ['temperature', 'temperature_observation'].includes(categoryOf(event)))
  const growth = daily.filter((event) => categoryOf(event) === 'growth_measurement' && ['weight', 'length'].includes(event.payload?.type))
  const wet = diapers.filter((event) => ['urine', 'both'].includes(event.payload?.kind)).length
  const stool = diapers.filter((event) => ['stool', 'both'].includes(event.payload?.kind)).length
  const bottleMl = bottle.reduce((sum, event) => sum + (Number(event.payload?.amountMl) || 0), 0)
  const sleepMinutes = sleep.reduce((sum, event) => sum + clippedSleepMinutes(event, bounds), 0)
  const latestSleep = latestEvent(sleep)
  return {
    day,
    events: daily,
    feeding: {
      totalCount: feeding.length,
      breastfeedingCount: feeding.filter((event) => categoryOf(event) === 'breastfeeding').length,
      bottleCount: bottle.length,
      bottleMl,
      breastMilkBottleCount: bottle.filter((event) => event.payload?.milkType === 'breast_milk').length,
      formulaBottleCount: bottle.filter((event) => event.payload?.milkType === 'formula').length,
      latest: latestEvent(feeding),
    },
    sleep: {
      segmentCount: sleep.length,
      minutes: sleepMinutes,
      latest: latestSleep,
    },
    diaper: {
      totalCount: diapers.length,
      wetCount: wet,
      stoolCount: stool,
      latest: latestEvent(diapers),
    },
    medication: {
      count: medication.length,
      latest: latestEvent(medication),
    },
    temperature: {
      count: temperature.length,
      latest: latestEvent(temperature),
    },
    growth: {
      count: growth.length,
      weightCount: growth.filter((event) => event.payload?.type === 'weight').length,
      lengthCount: growth.filter((event) => event.payload?.type === 'length').length,
      latest: latestEvent(growth),
    },
  }
}

function fallbackLabel(value, locale) {
  if (!value) return locale === 'en-US' ? 'Unknown' : '未分类'
  return locale === 'en-US' ? String(value).replaceAll('_', ' ') : String(value)
}

export function eventKindLabel(kindOrEvent, locale = 'zh-CN') {
  const kind = typeof kindOrEvent === 'string' ? kindOrEvent : kindOrEvent?.kind
  return EVENT_KIND_LABELS[kind]?.[locale === 'en-US' ? 'en' : 'zh'] || fallbackLabel(kind, locale)
}

export function eventCategoryLabel(categoryOrEvent, locale = 'zh-CN') {
  const category = typeof categoryOrEvent === 'string' ? categoryOrEvent : categoryOf(categoryOrEvent)
  return EVENT_CATEGORY_LABELS[category]?.[locale === 'en-US' ? 'en' : 'zh'] || fallbackLabel(category, locale)
}

export function getRecentCareEvents(events = [], limit = 8) {
  return events.filter(isActive).sort((a, b) => asTime(b.occurredAt || b.createdAt) - asTime(a.occurredAt || a.createdAt)).slice(0, limit)
}

export function eventTitle(event, locale = 'zh-CN') {
  const isEnglish = locale === 'en-US'
  const category = event?.category || event?.type
  const label = EVENT_CATEGORY_LABELS[category]?.[isEnglish ? 'en' : 'zh'] || fallbackLabel(category, locale)
  if (category === 'bottle_feeding') {
    const typeLabel = event.payload?.milkType === 'formula' ? (isEnglish ? 'Formula feed' : '配方奶') : event.payload?.milkType === 'breast_milk' ? (isEnglish ? 'Expressed breast milk' : '母乳瓶喂') : label
    return event.payload?.amountMl !== undefined ? `${typeLabel} ${event.payload.amountMl} mL` : typeLabel
  }
  if (category === 'sleep') {
    const minutes = event.payload?.endedAt ? Math.round((asTime(event.payload.endedAt) - asTime(event.occurredAt)) / 60_000) : 0
    return `${label} ${formatDurationMinutes(minutes, locale)}`
  }
  if (category === 'diaper') {
    const kind = event.payload?.kind
    if (kind === 'urine') return isEnglish ? 'Urine' : '只有尿'
    if (kind === 'stool') return isEnglish ? 'Stool' : '只有便'
    if (kind === 'both') return isEnglish ? 'Urine and stool' : '尿和便'
  }
  if (category === 'temperature' && event.payload?.value !== undefined && event.payload?.value !== null && event.payload?.value !== '') return `${label} ${event.payload.value} ${event.payload.unit || '°C'}`
  if (category === 'temperature_observation') return isEnglish ? 'Temperature observed · value not recorded' : '体温观察 · 数值未记录'
  if (category === 'medication') {
    const name = event.payload?.medicationName || event.payload?.name
    const amount = event.payload?.amount ? ` ${event.payload.amount} ${event.payload.unit || ''}`.trim() : ''
    return name ? `${isEnglish ? 'Medication' : '用药'} ${name}${amount ? ` · ${amount}` : ''}` : label
  }
  if (category === 'growth_measurement' || normalizedGrowthType(category)) {
    const payload = eventPayload(event)
    const typeKey = normalizedGrowthType(payload.type) || normalizedGrowthType(category) || 'weight'
    const type = typeKey === 'length' ? (isEnglish ? 'Length' : '身长') : typeKey === 'headCircumference' ? (isEnglish ? 'Head circumference' : '头围') : (isEnglish ? 'Weight' : '体重')
    return payload.value !== undefined ? `${type} ${payload.value} ${payload.unit || ''}`.trim() : type
  }
  if ((category === 'symptom_observation' || category === 'concern_open') && event.payload?.supportTitle) {
    const title = event.payload.supportTitle?.[isEnglish ? 'en' : 'zh'] || event.payload.supportTitle
    return `${isEnglish ? 'Concern' : '关注'}：${title}`
  }
  return label
}

export function getCareSnapshot(events = [], concerns = [], now = new Date()) {
  const active = events.filter(isActive)
  const since = asTime(now) - DAY_MS
  const recent = active.filter((event) => asTime(event.occurredAt || event.createdAt) >= since)
  const feeding = active.filter((event) => categoryOf(event) === 'breastfeeding' || categoryOf(event) === 'bottle_feeding')
  const diapers = recent.filter((event) => categoryOf(event) === 'diaper')
  const temperatures = active.filter((event) => categoryOf(event) === 'temperature')
  const latest = (items) => items.slice().sort((a, b) => asTime(b.occurredAt || b.createdAt) - asTime(a.occurredAt || a.createdAt))[0] || null
  const bottleMl = recent.reduce((sum, event) => sum + (categoryOf(event) === 'bottle_feeding' ? Number(event.payload?.amountMl) || 0 : 0), 0)
  const wet = diapers.filter((event) => event.payload?.kind === 'urine' || event.payload?.kind === 'both').length
  const stool = diapers.filter((event) => event.payload?.kind === 'stool' || event.payload?.kind === 'both').length
  const openConcerns = concerns.filter((concern) => concern.status === 'open')
  const lastUpdated = latest(active)
  return {
    lastFeeding: latest(feeding),
    lastDiaper: latest(active.filter((event) => categoryOf(event) === 'diaper')),
    lastTemperature: latest(temperatures),
    lastUpdated,
    openConcerns,
    metrics: {
      feedingCount: recent.filter((event) => categoryOf(event) === 'breastfeeding' || categoryOf(event) === 'bottle_feeding').length,
      bottleMl,
      diaperCount: diapers.length,
      wetDiaperCount: wet,
      stoolCount: stool,
      coverage: recent.length,
    },
  }
}

export function formatEventTime(event, locale = 'zh-CN') {
  if (!event) return locale === 'en-US' ? 'Not recorded' : '暂无记录'
  const value = event.occurredAt || event.createdAt
  return value ? new Date(value).toLocaleString(locale === 'en-US' ? 'en-US' : 'zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : (locale === 'en-US' ? 'Time not provided' : '时间未填')
}

export function eventFacts(event, locale = 'zh-CN') {
  const isEnglish = locale === 'en-US'
  if (categoryOf(event) === 'diaper') return isEnglish ? `Entered by ${event.actor?.displayName || event.recordedBy?.displayName || 'caregiver'}` : `记录人：${event.actor?.displayName || event.recordedBy?.displayName || '照护者'}`
  if (categoryOf(event) === 'bottle_feeding') return isEnglish ? `Actual amount · ${event.actor?.displayName || event.recordedBy?.displayName || 'caregiver'}` : `实际喝下奶量 · ${event.actor?.displayName || event.recordedBy?.displayName || '照护者'}`
  if (categoryOf(event) === 'sleep') return isEnglish ? `Interval · ${event.actor?.displayName || event.recordedBy?.displayName || 'caregiver'}` : `起止区间 · ${event.actor?.displayName || event.recordedBy?.displayName || '照护者'}`
  return isEnglish ? `Entered by ${event?.actor?.displayName || event?.recordedBy?.displayName || 'caregiver'}` : `记录人：${event?.actor?.displayName || event?.recordedBy?.displayName || '照护者'}`
}
