export const NATIVE_TODAY_CONTRACT = 'babyforge.native.today'
export const NATIVE_TODAY_CONTRACT_VERSION = '1.0.0'

const ACTIVE = 'active'
const HIGH_FREQUENCY = new Set([
  'breastfeeding',
  'bottle_feeding',
  'sleep',
  'diaper',
  'medication',
  'temperature',
  'temperature_observation',
  'growth_measurement',
])

export class NativeTodayContractError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'NativeTodayContractError'
    this.code = code
  }
}

export function validateNativeTodayModel(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new NativeTodayContractError('INVALID_RESPONSE', '今日页面模型必须是对象。')
  if (payload.contract !== NATIVE_TODAY_CONTRACT) throw new NativeTodayContractError('UNKNOWN_CONTRACT', '今日页面模型合同不受支持。')
  if (payload.contractVersion !== NATIVE_TODAY_CONTRACT_VERSION) throw new NativeTodayContractError('UNKNOWN_VERSION', '今日页面模型版本不受支持。')
  for (const field of ['generatedAt', 'dataTimezone', 'selectedDay', 'baby', 'permissions', 'recorder', 'summary', 'guidance', 'photos', 'photoPolicy', 'tasks', 'recentFacts']) {
    if (payload[field] === undefined || payload[field] === null) throw new NativeTodayContractError('MISSING_REQUIRED_FIELD', `今日页面模型缺少 ${field}。`)
  }
  for (const field of ['photos', 'tasks', 'recentFacts']) if (!Array.isArray(payload[field])) throw new NativeTodayContractError('INVALID_FIELD', `今日页面模型 ${field} 必须是列表。`)
  for (const field of ['feeding', 'sleep', 'diaper']) {
    const metric = payload.summary?.[field]
    if (!metric || typeof metric.recorded !== 'boolean' || typeof metric.label !== 'string') throw new NativeTodayContractError('INVALID_FIELD', `今日摘要 ${field} 无效。`)
    if (!metric.recorded && (metric.value !== null || metric.label !== '未记录')) throw new NativeTodayContractError('INVALID_UNKNOWN', `今日摘要 ${field} 不得把缺失事实显示为零。`)
  }
  return payload
}

function validDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function localParts(value, timezone) {
  const date = validDate(value)
  if (!date) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type)?.value || ''
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  }
}

export function localDayForTimezone(value = new Date().toISOString(), timezone = 'UTC') {
  return localParts(value, timezone)?.day || ''
}

function timezoneOffsetMinutes(value, timezone) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' })
    .formatToParts(value)
    .find((item) => item.type === 'timeZoneName')?.value || 'GMT+00:00'
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(part)
  if (!match) return 0
  const minutes = Number(match[2]) * 60 + Number(match[3])
  return match[1] === '-' ? -minutes : minutes
}

function dayBounds(day, timezone) {
  const [year, month, date] = day.split('-').map(Number)
  const resolve = (utcGuess) => {
    const first = utcGuess - timezoneOffsetMinutes(new Date(utcGuess), timezone) * 60_000
    return utcGuess - timezoneOffsetMinutes(new Date(first), timezone) * 60_000
  }
  const start = resolve(Date.UTC(year, month - 1, date))
  const next = new Date(Date.UTC(year, month - 1, date))
  next.setUTCDate(next.getUTCDate() + 1)
  return { start, end: resolve(next.getTime()) }
}

function overlapsDay(event, bounds) {
  const start = validDate(event.occurredAt)?.getTime()
  if (!start) return false
  if (event.category !== 'sleep') return start >= bounds.start && start < bounds.end
  const end = validDate(event.payload?.endedAt)?.getTime() || start
  return end > bounds.start && start < bounds.end
}

function activeEvents(events) {
  const superseded = new Set(events.map((event) => event?.correctedFromId).filter(Boolean))
  return events.filter((event) => event?.status === ACTIVE && !superseded.has(event.id))
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function eventTitle(event) {
  const payload = event.payload || {}
  if (event.category === 'breastfeeding') return '亲喂'
  if (event.category === 'bottle_feeding') return `${payload.milkType === 'breast_milk' ? '母乳瓶喂' : '配方奶'}${number(payload.amountMl) === null ? '' : ` ${number(payload.amountMl)} mL`}`
  if (event.category === 'sleep') {
    const start = validDate(payload.start || event.occurredAt)
    const end = validDate(payload.endedAt)
    const minutes = start && end ? Math.max(0, Math.round((end - start) / 60000)) : null
    return minutes === null ? '睡眠记录' : `睡眠 ${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`
  }
  if (event.category === 'diaper') return payload.kind === 'stool' ? '尿布 · 排便' : payload.kind === 'both' ? '尿布 · 尿湿和排便' : '尿布 · 尿湿'
  if (event.category === 'medication') return `用药 · ${String(payload.medicationName || payload.name || '实际发生')}`
  if (event.category === 'temperature_observation') return '体温观察 · 数值未记录'
  if (event.category === 'temperature') return number(payload.value) === null ? '体温观察 · 数值未记录' : `体温 ${number(payload.value)} ${payload.unit || '°C'}`
  if (event.category === 'growth_measurement') return `${payload.type === 'length' ? '身长' : payload.type === 'headCircumference' ? '头围' : '体重'} ${payload.value ?? ''} ${payload.unit || ''}`.trim()
  return String(payload.title || payload.note || event.category || '照护事实')
}

function summaryForDay(events, bounds) {
  const feeding = events.filter((event) => event.category === 'breastfeeding' || event.category === 'bottle_feeding')
  const bottleAmounts = feeding.map((event) => number(event.payload?.amountMl)).filter((value) => value !== null)
  const sleepMinutes = events.filter((event) => event.category === 'sleep').map((event) => {
    const start = validDate(event.payload?.start || event.occurredAt)
    const end = validDate(event.payload?.endedAt)
    return start && end ? Math.max(0, Math.round((Math.min(end.getTime(), bounds.end) - Math.max(start.getTime(), bounds.start)) / 60000)) : null
  }).filter((value) => value !== null)
  const diapers = events.filter((event) => event.category === 'diaper')
  return {
    feeding: feeding.length === 0 ? { recorded: false, value: null, unit: null, label: '未记录' } : bottleAmounts.length > 0
      ? { recorded: true, value: bottleAmounts.reduce((sum, value) => sum + value, 0), unit: 'mL', label: `${bottleAmounts.reduce((sum, value) => sum + value, 0)} mL` }
      : { recorded: true, value: feeding.length, unit: '次', label: `${feeding.length} 次` },
    sleep: sleepMinutes.length === 0
      ? { recorded: false, value: null, unit: null, label: '未记录' }
      : { recorded: true, value: sleepMinutes.reduce((sum, value) => sum + value, 0), unit: '分钟', label: `${Math.round(sleepMinutes.reduce((sum, value) => sum + value, 0) / 6) / 10} 小时` },
    diaper: diapers.length === 0
      ? { recorded: false, value: null, unit: null, label: '未记录' }
      : { recorded: true, value: diapers.length, unit: '次', label: `${diapers.length} 次` },
  }
}

function normalizeTask(item, kind = 'plan') {
  return {
    id: String(item.id),
    kind,
    title: String(item.title?.zh || item.title || '今日事项'),
    detail: String(item.detail?.zh || item.detail || ''),
    status: item.status === 'done' ? 'done' : 'pending',
    source: String(item.source || (kind === 'plan' ? '共享成长计划' : '共享照护事项')),
    safetyNote: String(item.safetyNote || ''),
  }
}

export function buildNativeTodayModel({
  baby,
  events = [],
  photos = [],
  tasks = [],
  carePlanItems = [],
  permissions,
  recorder,
  timezone = 'Asia/Shanghai',
  selectedDay,
  now = new Date().toISOString(),
} = {}) {
  if (!baby?.id) throw new TypeError('native today model requires baby')
  const nowParts = localParts(now, timezone)
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(selectedDay || '')) ? String(selectedDay) : nowParts.day
  const canonical = activeEvents(events)
  const bounds = dayBounds(day, timezone)
  const dayEvents = canonical.filter((event) => overlapsDay(event, bounds))
  const recentFacts = dayEvents
    .filter((event) => HIGH_FREQUENCY.has(event.category) || event.category)
    .sort((left, right) => String(right.occurredAt).localeCompare(String(left.occurredAt)))
    .map((event) => ({
      id: String(event.id),
      category: String(event.category),
      title: eventTitle(event),
      occurredAt: String(event.occurredAt),
      localTime: localParts(event.occurredAt, timezone)?.time || '',
      recorder: String(event.actor?.displayName || '家庭成员'),
      status: String(event.status),
      version: Number(event.version || 1),
      correctedFromId: event.correctedFromId || null,
    }))
  const dayPhotos = photos.filter((photo) => localParts(photo.takenAt || photo.createdAt, timezone)?.day === day)
  const normalizedTasks = [...tasks.map((item) => normalizeTask(item, 'daily')), ...carePlanItems.map((item) => normalizeTask(item, 'plan'))]
  return validateNativeTodayModel({
    contract: NATIVE_TODAY_CONTRACT,
    contractVersion: NATIVE_TODAY_CONTRACT_VERSION,
    generatedAt: now,
    dataTimezone: timezone,
    selectedDay: day,
    baby: {
      id: String(baby.id),
      nickname: String(baby.nickname || '宝宝'),
      birthDate: String(baby.birthDate || ''),
    },
    permissions: {
      readOnly: Boolean(permissions?.readOnly),
      canEdit: Boolean(permissions?.canEdit),
      canDeletePhotos: Boolean(permissions?.canDeletePhotos ?? permissions?.canEdit),
    },
    recorder: {
      id: String(recorder?.id || ''),
      displayName: String(recorder?.displayName || '家庭成员'),
    },
    summary: summaryForDay(dayEvents, bounds),
    guidance: {
      feeding: '饮食建议来自共享年龄、喂养档案与已确认事实；未记录不代表未发生。',
      analysis: '今日分析只使用已确认事实，不替代医生判断。',
      source: '与桌面端共用家庭事实、成长计划和安全说明。',
    },
    photos: dayPhotos.map((photo) => ({
      id: String(photo.id),
      takenAt: String(photo.takenAt || photo.createdAt),
      caption: String(photo.caption || photo.fileName || ''),
      contentUrl: String(photo.contentUrl || ''),
      contentType: String(photo.contentType || ''),
      sizeBytes: Number(photo.sizeBytes || 0),
    })),
    photoPolicy: {
      aiUpload: 'explicit-only',
      reportsIncludeOriginals: false,
      sharesIncludeOriginals: false,
    },
    tasks: normalizedTasks,
    recentFacts,
    totalFacts: dayEvents.length,
  })
}
