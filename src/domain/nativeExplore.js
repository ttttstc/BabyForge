import { VACCINE_DOSES, VACCINE_GUIDANCE, VACCINE_STANDARD } from '../content/vaccines.js'
import {
  DISEASE_CONTENT_VERSION,
  DISEASE_SOURCES,
  DISEASE_TOPICS,
  ORGAN_TOPICS,
  diseasesForOrgan,
  searchDiseaseTopics,
} from '../content/diseaseRegistry.js'
import { ANATOMY_RESOURCES, getAnatomyHotspots } from '../content/pediatricDiseases.js'
import {
  EXPERIENCE_CATEGORIES,
  CHINA_COMMUNITY_SOURCES,
  formatExperienceAge,
  getContentAgeBandForBaby,
} from './experience.js'

export const NATIVE_EXPLORE_CONTRACT = 'babyforge.native.explore'
export const NATIVE_EXPLORE_CONTRACT_VERSION = '1.0.0'

const asArray = value => (Array.isArray(value) ? value : [])

const safeDate = (value, fallback = new Date()) => {
  const date = value instanceof Date ? value : new Date(value || fallback)
  return Number.isNaN(date.getTime()) ? new Date(fallback) : date
}

const dateKey = date => safeDate(date).toISOString().slice(0, 10)

const daysInMonth = (year, month) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

const addMonths = (date, months) => {
  const source = new Date(date)
  const targetMonth = source.getUTCMonth() + Number(months || 0)
  const year = source.getUTCFullYear() + Math.floor(targetMonth / 12)
  const month = ((targetMonth % 12) + 12) % 12
  const day = Math.min(source.getUTCDate(), daysInMonth(year, month))
  return new Date(Date.UTC(
    year,
    month,
    day,
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  ))
}

const addDays = (date, days) => {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + Number(days || 0))
  return result
}

const vaccineDueAt = (birthDate, dose) => {
  if (!birthDate) return null
  const base = safeDate(`${birthDate}T00:00:00.000Z`)
  const ageSpec = dose.ageSpec || {}
  const months = ageSpec.months != null
    ? ageSpec.months
    : ageSpec.years != null
      ? Number(ageSpec.years) * 12
      : 0
  const due = addDays(addMonths(base, months), ageSpec.days || (months ? 0 : dose.ageDays || 0))
  return dateKey(due)
}

const sourceList = sources => Object.values(sources || {})

const eventPayload = event => event?.payload && typeof event.payload === 'object' ? event.payload : {}

const completedVaccineIds = events => {
  const latest = new Map()
  for (const event of asArray(events)) {
    if (event?.status === 'voided' || (event?.category !== 'vaccine' && event?.category !== 'care_plan_item')) continue
    const payload = eventPayload(event)
    if (!payload.vaccineId) continue
    const current = latest.get(payload.vaccineId)
    const currentAt = String(current?.event?.occurredAt || current?.event?.createdAt || '')
    const incomingAt = String(event.occurredAt || event.createdAt || '')
    if (!current || incomingAt >= currentAt) latest.set(payload.vaccineId, { event, payload })
  }
  return new Set([...latest.values()]
    .filter(({ payload }) => ['done', 'completed', 'complete'].includes(payload.status || 'completed'))
    .map(({ payload }) => payload.vaccineId))
}

const buildVaccines = (baby, events) => {
  const completed = completedVaccineIds(events)
  return VACCINE_DOSES.map(dose => ({
    ...dose,
    dueAt: vaccineDueAt(baby.birthDate, dose),
    status: completed.has(dose.id) ? 'completed' : 'planned',
    completed: completed.has(dose.id),
    source: VACCINE_STANDARD,
  }))
}

const buildDiseases = ({ query = '', organId = null } = {}) => {
  if (organId) return diseasesForOrgan(organId)
  return query ? searchDiseaseTopics(query) : DISEASE_TOPICS
}

const normalizeExperience = ({ baby, experienceFeed, now }) => {
  const age = getContentAgeBandForBaby(baby.birthDate, now)
  const feed = experienceFeed && typeof experienceFeed === 'object' ? experienceFeed : {}
  return {
    category: feed.category || 'recommended',
    ageBand: feed.ageBand || age.band,
    ageText: feed.ageText || formatExperienceAge(age),
    generatedAt: feed.generatedAt || null,
    expiresAt: feed.expiresAt || null,
    staleUntil: feed.staleUntil || null,
    cacheState: feed.cacheState || 'empty',
    articles: asArray(feed.articles),
    notice: feed.notice || '内容来自第三方来源，请结合来源信息独立判断。',
    sources: asArray(feed.sources),
  }
}

export function validateNativeExploreModel(model) {
  if (!model || typeof model !== 'object') throw new TypeError('Native explore model must be an object')
  if (model.contract !== NATIVE_EXPLORE_CONTRACT) throw new TypeError('Invalid native explore contract')
  if (!model.contractVersion || !model.metadata?.generatedAt || !model.metadata?.timezone) {
    throw new TypeError('Missing native explore metadata')
  }
  if (!model.baby?.id || !model.permissions) throw new TypeError('Missing native explore identity')
  for (const key of ['vaccines', 'diseases', 'diseaseSources', 'organs', 'anatomy', 'experience', 'experienceCategories']) {
    if (key === 'experience' ? !model[key] : !Array.isArray(model[key])) {
      throw new TypeError(`Invalid native explore ${key}`)
    }
  }
  return model
}

export function buildNativeExploreModel({
  baby,
  events = [],
  experienceFeed = null,
  query = '',
  organId = null,
  permissions = {},
  locale = 'zh-CN',
  dataTimezone = 'Asia/Shanghai',
  sourceVersion = 'shared-domain',
  now = new Date(),
} = {}) {
  if (!baby?.id) throw new TypeError('A baby is required to build native explore model')

  const generatedAt = safeDate(now)
  const diseases = buildDiseases({ query, organId })
  const organs = ORGAN_TOPICS.map(organ => ({
    ...organ,
    relatedDiseaseIds: diseasesForOrgan(organ.id).map(disease => disease.id),
    hotspots: getAnatomyHotspots(organ.id),
  }))
  const anatomy = ANATOMY_RESOURCES.map(resource => ({
    ...resource,
    controlled3d: {
      model: resource.model || null,
      status: resource.model ? 'available' : 'text-fallback',
      fallbackText: '当前设备未加载三维模型，仍可查看完整结构、观察重点和相关疾病内容。',
    },
  }))

  return validateNativeExploreModel({
    contract: NATIVE_EXPLORE_CONTRACT,
    contractVersion: NATIVE_EXPLORE_CONTRACT_VERSION,
    metadata: {
      generatedAt: generatedAt.toISOString(),
      timezone: dataTimezone,
      sourceVersion,
      locale,
      vaccineSourceVersion: VACCINE_STANDARD.version || 'shared-vaccine-standard',
      diseaseContentVersion: DISEASE_CONTENT_VERSION,
    },
    permissions: {
      role: permissions?.role || 'readOnly',
      readOnly: permissions?.readOnly !== false,
      canEdit: permissions?.canEdit === true,
    },
    baby: {
      id: baby.id,
      nickname: baby.nickname || '',
      birthDate: baby.birthDate || null,
    },
    vaccines: buildVaccines(baby, events),
    vaccineGuidance: VACCINE_GUIDANCE,
    diseases,
    diseaseSources: sourceList(DISEASE_SOURCES),
    diseaseSearch: { query, organId },
    organs,
    anatomy,
    experience: normalizeExperience({ baby, experienceFeed, now: generatedAt }),
    experienceCategories: asArray(EXPERIENCE_CATEGORIES),
    experienceSources: sourceList(CHINA_COMMUNITY_SOURCES),
    sourcePolicy: {
      reviewedKnowledge: 'reviewed',
      thirdPartyExperience: 'external-source',
      rawSourceRequired: true,
    },
  })
}
