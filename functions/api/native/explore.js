import { json } from '../../_shared/auth.js'
import { accessibleBaby, eventFromRow } from '../../_shared/care.js'
import { findHouseholdForPrincipal, getPrincipal } from '../../_shared/principal.js'
import { loadOrSearchExperience } from '../../_shared/experience.js'
import { EXPERIENCE_CATEGORIES, getContentAgeBandForBaby } from '../../../src/domain/experience.js'
import {
  buildNativeExploreModel,
  NATIVE_EXPLORE_CONTRACT,
  NATIVE_EXPLORE_CONTRACT_VERSION,
} from '../../../src/domain/nativeExplore.js'

const CATEGORY_IDS = new Set(EXPERIENCE_CATEGORIES.map(category => category.id))

function sourceVersion(env) {
  return String(env.BABYFORGE_RESOURCE_SOURCE_VERSION || env.CF_PAGES_COMMIT_SHA || 'web-runtime').slice(0, 120)
}

function errorResponse(status, code, message, source, retryable = false) {
  return json({
    contract: NATIVE_EXPLORE_CONTRACT,
    contractVersion: NATIVE_EXPLORE_CONTRACT_VERSION,
    error: { code, message, retryable },
    metadata: { sourceVersion: source },
  }, status)
}

function timezoneFromRequest(request) {
  const candidate = String(request.headers.get('x-babyforge-timezone') || 'Asia/Shanghai').trim()
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format()
    return candidate
  } catch {
    return 'Asia/Shanghai'
  }
}

function permissionsFor(household) {
  const readOnly = household.role === 'guest' || household.role === 'readOnly'
  return { role: readOnly ? 'readOnly' : household.role || 'member', readOnly, canEdit: !readOnly }
}

export async function onRequestGet({ request, env, waitUntil }) {
  const source = sourceVersion(env)
  if (!env.DB) return errorResponse(503, 'SERVICE_UNAVAILABLE', '探索资源暂时无法读取，请重试。', source, true)

  let principal
  try { principal = await getPrincipal(request, env, { allowLegacy: true }) } catch {
    return errorResponse(503, 'SERVICE_UNAVAILABLE', '探索资源暂时无法读取，请重试。', source, true)
  }
  if (principal.response) {
    const status = principal.response.status
    return errorResponse(status, status === 403 ? 'EMAIL_NOT_VERIFIED' : 'AUTH_REQUIRED', status === 403 ? '请先验证邮箱。' : '登录状态已失效，请重新登录。', source)
  }

  let household
  try { household = await findHouseholdForPrincipal(env, principal) } catch {
    return errorResponse(503, 'RESOURCE_UNAVAILABLE', '家庭资源暂时无法读取，请重试。', source, true)
  }
  if (!household?.baby?.id) return errorResponse(409, 'BABY_REQUIRED', '请先创建或加入宝宝家庭。', source)
  let baby
  try { baby = await accessibleBaby(env, principal, household.baby.id) } catch {
    return errorResponse(503, 'RESOURCE_UNAVAILABLE', '宝宝探索资料暂时无法读取，请重试。', source, true)
  }
  if (!baby) return errorResponse(403, 'BABY_FORBIDDEN', '无权访问该宝宝档案。', source)

  const url = new URL(request.url)
  const query = String(url.searchParams.get('q') || '').trim()
  const organId = String(url.searchParams.get('organ') || '').trim() || null
  const category = String(url.searchParams.get('category') || 'recommended').trim()
  const refresh = url.searchParams.get('refresh') === '1' || url.searchParams.get('refresh') === 'true'
  if (!CATEGORY_IDS.has(category)) return errorResponse(400, 'INVALID_CATEGORY', '经验内容分类不正确。', source)
  if (refresh && (household.role === 'guest' || household.role === 'readOnly')) {
    return errorResponse(403, 'READ_ONLY', '只读访问不能强制更新第三方经验内容。', source)
  }

  const timezone = timezoneFromRequest(request)
  let events
  try {
    const eventRows = await env.DB.prepare('SELECT * FROM care_events WHERE baby_id = ? ORDER BY occurred_at, created_at').bind(baby.id).all()
    events = (eventRows.results || []).map(eventFromRow).filter(Boolean)
  } catch {
    return errorResponse(503, 'RESOURCE_UNAVAILABLE', '疫苗事实暂时无法读取，请重试。', source, true)
  }

  let experienceFeed
  try {
    const age = getContentAgeBandForBaby(baby.birthDate, new Date(), timezone)
    if (age.band) {
      experienceFeed = await loadOrSearchExperience({
        requestUrl: request.url,
        env,
        band: age.band,
        categoryId: category,
        refresh,
        waitUntil,
      })
      experienceFeed = { ...experienceFeed, category }
    } else {
      experienceFeed = { category, cacheState: 'empty', articles: [], notice: '当前年龄暂未覆盖经验推荐。' }
    }
  } catch {
    experienceFeed = {
      category,
      cacheState: 'error',
      articles: [],
      notice: '第三方经验源暂时不可用；疫苗、疾病和器官学习仍可使用。请稍后重试。',
      sources: [],
    }
  }

  try {
    return json(buildNativeExploreModel({
      baby,
      events,
      experienceFeed,
      query,
      organId,
      permissions: permissionsFor(household),
      locale: baby.locale || 'zh-CN',
      dataTimezone: timezone,
      sourceVersion: source,
      now: new Date(),
    }))
  } catch (error) {
    console.error('Native explore model failed', error)
    return errorResponse(503, 'MODEL_UNAVAILABLE', '探索模型暂时无法生成，请重试。', source, true)
  }
}
