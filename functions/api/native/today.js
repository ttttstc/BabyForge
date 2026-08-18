import { json } from '../../_shared/auth.js'
import { eventFromRow, planFromRow } from '../../_shared/care.js'
import { findHouseholdForPrincipal, getPrincipal } from '../../_shared/principal.js'
import { buildNativeTodayModel, NATIVE_TODAY_CONTRACT, NATIVE_TODAY_CONTRACT_VERSION } from '../../../src/domain/nativeToday.js'
import { getAgeDays, getStage } from '../../../src/domain/baby.js'
import { getAdminTasks, getDailyHealthReminders, getDailyTasks } from '../../../src/domain/carePlan.js'

function errorResponse(status, code, message, retryable = false) {
  return json({
    contract: NATIVE_TODAY_CONTRACT,
    contractVersion: NATIVE_TODAY_CONTRACT_VERSION,
    error: { code, message, retryable },
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

function photoFromRow(row) {
  return {
    id: row.id,
    babyId: row.baby_id,
    fileName: row.file_name,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    takenAt: row.taken_at,
    createdAt: row.created_at,
    contentUrl: `/api/photos/${encodeURIComponent(row.id)}`,
  }
}

function workspaceRecord(row) {
  try {
    return { collection: row.collection, value: JSON.parse(row.payload_json) }
  } catch {
    return null
  }
}

function queryWindow(selectedDay) {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(selectedDay) ? new Date(`${selectedDay}T00:00:00.000Z`) : new Date()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDay)) base.setUTCHours(0, 0, 0, 0)
  return {
    from: new Date(base.getTime() - 36 * 60 * 60 * 1000).toISOString(),
    to: new Date(base.getTime() + 60 * 60 * 60 * 1000).toISOString(),
  }
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return errorResponse(503, 'SERVICE_UNAVAILABLE', '共享业务资源暂时无法读取，请重试。', true)
  let principal
  try { principal = await getPrincipal(request, env, { allowLegacy: true }) } catch { return errorResponse(503, 'SERVICE_UNAVAILABLE', '共享业务资源暂时无法读取，请重试。', true) }
  if (principal.response) {
    const status = principal.response.status
    return errorResponse(status, status === 403 ? 'EMAIL_NOT_VERIFIED' : 'AUTH_REQUIRED', status === 403 ? '请先验证邮箱。' : '登录状态已失效，请重新登录。')
  }
  let household
  try { household = await findHouseholdForPrincipal(env, principal) } catch { return errorResponse(503, 'RESOURCE_UNAVAILABLE', '家庭资源暂时无法读取，请重试。', true) }
  if (!household?.baby?.id) return errorResponse(409, 'BABY_REQUIRED', '请先创建或加入宝宝家庭。')

  const baby = household.baby
  const url = new URL(request.url)
  const selectedDay = url.searchParams.get('day') || ''
  const window = queryWindow(selectedDay)
  let eventRows
  let photoRows
  let planRows
  let workspaceRows
  try {
    [eventRows, photoRows, planRows, workspaceRows] = await Promise.all([
      env.DB.prepare('SELECT * FROM care_events WHERE baby_id = ? AND occurred_at >= ? AND occurred_at < ? ORDER BY occurred_at DESC, created_at DESC').bind(baby.id, window.from, window.to).all(),
      env.DB.prepare('SELECT * FROM baby_photos WHERE baby_id = ? AND taken_at >= ? AND taken_at < ? ORDER BY taken_at DESC, created_at DESC').bind(baby.id, window.from, window.to).all(),
      env.DB.prepare('SELECT * FROM care_plan_items WHERE baby_id = ? ORDER BY due_at, created_at').bind(baby.id).all(),
      env.DB.prepare("SELECT collection, payload_json FROM workspace_records WHERE baby_id = ? AND collection IN ('taskLogs', 'adminTaskRecords') ORDER BY updated_at").bind(baby.id).all(),
    ])
  } catch {
    return errorResponse(503, 'RESOURCE_UNAVAILABLE', '今日事实、计划或媒体暂时无法读取，请重试。', true)
  }
  const workspace = (workspaceRows.results || []).map(workspaceRecord).filter(Boolean)
  const taskLogs = workspace.filter((item) => item.collection === 'taskLogs').map((item) => item.value)
  const adminTaskRecords = workspace.filter((item) => item.collection === 'adminTaskRecords').map((item) => item.value)
  const modelDay = /^\d{4}-\d{2}-\d{2}$/.test(selectedDay) ? selectedDay : new Date().toISOString().slice(0, 10)
  const modelDate = new Date(`${modelDay}T12:00:00.000Z`)
  let ageDays
  try { ageDays = getAgeDays(baby.birthDate, modelDate) } catch { ageDays = 0 }
  const stage = getStage(ageDays)
  const reminders = getDailyHealthReminders(taskLogs, ageDays, modelDate)
  const sharedTasks = [
    ...getDailyTasks(taskLogs, modelDate, stage.id),
    ...getAdminTasks(stage.id, ageDays, adminTaskRecords).filter((item) => item.state !== 'upcoming'),
    ...reminders.nutrition,
    ...reminders.routine,
  ]
  const readOnly = household.role === 'guest' || household.role === 'readOnly'
  const model = buildNativeTodayModel({
    baby,
    events: (eventRows.results || []).map(eventFromRow).filter(Boolean),
    photos: (photoRows.results || []).map(photoFromRow),
    tasks: sharedTasks,
    carePlanItems: (planRows.results || []).map(planFromRow).filter((item) => item.status !== 'done' && (!item.dueAt || String(item.dueAt).slice(0, 10) <= modelDay)).slice(0, 3),
    permissions: { readOnly, canEdit: !readOnly, canDeletePhotos: !readOnly },
    recorder: { id: principal.userId || principal.accountId, displayName: principal.displayName || '家庭成员' },
    timezone: timezoneFromRequest(request),
    selectedDay,
  })
  return json(model)
}
