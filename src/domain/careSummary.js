const DAY_MS = 24 * 60 * 60 * 1000

const EVENT_LABELS = {
  breastfeeding: { zh: '亲喂', en: 'Breastfeed' },
  bottle_feeding: { zh: '瓶喂', en: 'Bottle feed' },
  diaper: { zh: '尿便', en: 'Diaper' },
  temperature: { zh: '体温', en: 'Temperature' },
  growth_measurement: { zh: '成长测量', en: 'Growth measurement' },
  symptom_observation: { zh: '异常观察', en: 'Observation' },
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
  if (category === 'bottle_feeding' && event.payload?.amountMl) return `${label} ${event.payload.amountMl} mL`
  if (category === 'diaper') {
    const kind = event.payload?.kind
    if (kind === 'urine') return isEnglish ? 'Urine' : '只有尿'
    if (kind === 'stool') return isEnglish ? 'Stool' : '只有便'
    if (kind === 'both') return isEnglish ? 'Urine and stool' : '尿和便'
  }
  if (category === 'temperature' && event.payload?.value) return `${label} ${event.payload.value} ${event.payload.unit || '°C'}`
  if (category === 'symptom_observation' && event.payload?.supportTitle) {
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
  return isEnglish ? `Entered by ${event?.actor?.displayName || event?.recordedBy?.displayName || 'caregiver'}` : `记录人：${event?.actor?.displayName || event?.recordedBy?.displayName || '照护者'}`
}
