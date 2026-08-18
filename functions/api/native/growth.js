import { json } from '../../_shared/auth.js'
import { accessibleBaby, eventFromRow, planFromRow } from '../../_shared/care.js'
import { findHouseholdForPrincipal, getPrincipal } from '../../_shared/principal.js'
import { applyCareEventsToLegacy } from '../../../src/domain/careEvents.js'
import {
  buildNativeGrowthModel,
  NATIVE_GROWTH_CONTRACT,
  NATIVE_GROWTH_CONTRACT_VERSION,
} from '../../../src/domain/nativeGrowth.js'

function sourceVersion(env) {
  return String(env.BABYFORGE_RESOURCE_SOURCE_VERSION || env.CF_PAGES_COMMIT_SHA || 'web-runtime').slice(0, 120)
}

function errorResponse(status, code, message, source, retryable = false) {
  return json({
    contract: NATIVE_GROWTH_CONTRACT,
    contractVersion: NATIVE_GROWTH_CONTRACT_VERSION,
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

function workspaceRecord(row) {
  try {
    return { collection: row.collection, value: JSON.parse(row.payload_json) }
  } catch {
    return null
  }
}

function latestRecords(records, keyOf) {
  const byKey = new Map()
  for (const record of records) {
    const key = keyOf(record)
    const current = byKey.get(key)
    if (!current || String(record.updatedAt || record.createdAt || '') >= String(current.updatedAt || current.createdAt || '')) {
      byKey.set(key, record)
    }
  }
  return [...byKey.values()]
}

function permissionsFor(household) {
  const readOnly = household.role === 'guest' || household.role === 'readOnly'
  return {
    role: readOnly ? 'readOnly' : household.role || 'member',
    readOnly,
    canEdit: !readOnly,
    canManageHousehold: household.role === 'owner',
  }
}

export async function onRequestGet({ request, env }) {
  const source = sourceVersion(env)
  if (!env.DB) return errorResponse(503, 'SERVICE_UNAVAILABLE', '共享成长资源暂时无法读取，请重试。', source, true)

  let principal
  try { principal = await getPrincipal(request, env, { allowLegacy: true }) } catch {
    return errorResponse(503, 'SERVICE_UNAVAILABLE', '共享成长资源暂时无法读取，请重试。', source, true)
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
    return errorResponse(503, 'RESOURCE_UNAVAILABLE', '宝宝成长资料暂时无法读取，请重试。', source, true)
  }
  if (!baby) return errorResponse(403, 'BABY_FORBIDDEN', '无权访问该宝宝档案。', source)
  const timezone = timezoneFromRequest(request)
  let eventRows
  let planRows
  let workspaceRows
  try {
    [eventRows, planRows, workspaceRows] = await Promise.all([
      env.DB.prepare('SELECT * FROM care_events WHERE baby_id = ? ORDER BY occurred_at, created_at').bind(baby.id).all(),
      env.DB.prepare('SELECT * FROM care_plan_items WHERE baby_id = ? ORDER BY due_at, created_at').bind(baby.id).all(),
      env.DB.prepare("SELECT collection, payload_json FROM workspace_records WHERE baby_id = ? AND collection IN ('growthMeasurements', 'milestoneRecords', 'adminTaskRecords', 'carePlanItems') ORDER BY updated_at").bind(baby.id).all(),
    ])
  } catch {
    return errorResponse(503, 'RESOURCE_UNAVAILABLE', '成长事实、计划或里程碑暂时无法读取，请重试。', source, true)
  }

  const events = (eventRows.results || []).map(eventFromRow).filter(Boolean)
  const workspace = (workspaceRows.results || []).map(workspaceRecord).filter(Boolean)
  const legacy = applyCareEventsToLegacy({
    growthMeasurements: [],
    milestoneRecords: [],
    adminTaskRecords: [],
    carePlanItems: [],
  }, events)
  const valuesFor = collection => workspace.filter(item => item.collection === collection).map(item => item.value)
  const measurements = latestRecords([...valuesFor('growthMeasurements'), ...legacy.growthMeasurements], item => item.id || `${item.type}:${item.measuredAt}`)
  const milestones = latestRecords([...valuesFor('milestoneRecords'), ...legacy.milestoneRecords], item => item.milestoneId || item.id)
  const adminTasks = latestRecords([...valuesFor('adminTaskRecords'), ...legacy.adminTaskRecords], item => item.taskId || item.id)
  const carePlanItems = latestRecords([
    ...(planRows.results || []).map(planFromRow).filter(Boolean),
    ...valuesFor('carePlanItems'),
    ...legacy.carePlanItems,
  ], item => item.taskId || item.planItemId || item.id)

  try {
    return json(buildNativeGrowthModel({
      baby,
      measurements,
      milestoneRecords: milestones,
      carePlanItems,
      adminTaskRecords: adminTasks,
      permissions: permissionsFor(household),
      locale: baby.locale || 'zh-CN',
      dataTimezone: timezone,
      sourceVersion: source,
      now: new Date(),
    }))
  } catch (error) {
    console.error('Native growth model failed', error)
    return errorResponse(503, 'MODEL_UNAVAILABLE', '成长模型暂时无法生成，请重试。', source, true)
  }
}
