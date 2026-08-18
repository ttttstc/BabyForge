import { json } from '../../_shared/auth.js'
import { accessibleBaby } from '../../_shared/care.js'
import { findHouseholdForPrincipal, getPrincipal } from '../../_shared/principal.js'
import { maskLlmApiKey, readAccountLlmApiKey } from '../../_shared/llmConfig.js'
import { buildNativeSettingsModel, NATIVE_SETTINGS_CONTRACT, NATIVE_SETTINGS_CONTRACT_VERSION } from '../../../src/domain/nativeSettings.js'

function sourceVersion(env) {
  return String(env.BABYFORGE_RESOURCE_SOURCE_VERSION || env.CF_PAGES_COMMIT_SHA || 'web-runtime').slice(0, 120)
}

function errorResponse(status, code, message, source, retryable = false) {
  return json({
    contract: NATIVE_SETTINGS_CONTRACT,
    contractVersion: NATIVE_SETTINGS_CONTRACT_VERSION,
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
  return {
    role: readOnly ? 'readOnly' : household.role || 'member',
    readOnly,
    canEdit: !readOnly,
    canManageHousehold: household.role === 'owner',
  }
}

function linkStatus(row, now = Date.now()) {
  if (row.revokedAt) return 'revoked'
  return Date.parse(row.expiresAt) <= now ? 'expired' : 'active'
}

async function loadSubscription(env, principal) {
  if (!principal.userId) return { email: principal.email || '', enabled: false }
  const row = await env.DB.prepare(`
    SELECT s.enabled, u.email
    FROM "user" u
    LEFT JOIN email_update_subscriptions s ON s.user_id = u.id
    WHERE u.id = ?
  `).bind(principal.userId).first()
  return { email: row?.email || principal.email || '', enabled: row?.enabled === 1 }
}

async function loadContacts(env, householdId) {
  if (!householdId) return []
  const rows = await env.DB.prepare(`
    SELECT id, email, enabled, created_at AS createdAt, updated_at AS updatedAt
    FROM email_notification_contacts
    WHERE household_id = ?
    ORDER BY created_at, id
  `).bind(householdId).all()
  return rows.results || []
}

async function loadVisitorLinks(env, household, permissions) {
  if (!permissions.canManageHousehold) return []
  const rows = await env.DB.prepare(`
    SELECT id, expires_at AS expiresAt, revoked_at AS revokedAt, created_at AS createdAt
    FROM temporary_visitor_links
    WHERE household_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `).bind(household.id).all()
  return (rows.results || []).map(row => ({
    id: row.id,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt || null,
    createdAt: row.createdAt,
    status: linkStatus(row),
    permissions: { readOnly: true, deidentified: true },
  }))
}

async function loadLlmConfig(env, principal) {
  if (!principal.accountId) return null
  const row = await env.DB.prepare('SELECT base_url, model, api_key, ciphertext, nonce, key_version, protocol, updated_at FROM account_llm_configs WHERE account_id = ?').bind(principal.accountId).first()
  if (!row) return null
  const apiKey = await readAccountLlmApiKey(env, principal.accountId, row)
  return {
    configured: true,
    baseUrl: row.base_url,
    model: row.model,
    protocol: row.protocol || 'openai-compatible',
    apiKeyMasked: maskLlmApiKey(apiKey),
    updatedAt: row.updated_at,
  }
}

async function buildSettings({ request, env, principal, household, babyOverride = null, userOverride = null }) {
  const permissions = permissionsFor(household)
  const baby = babyOverride || await accessibleBaby(env, principal, household.baby.id)
  if (!baby) throw Object.assign(new Error('无权访问该宝宝档案。'), { status: 403, code: 'BABY_FORBIDDEN' })
  const [subscription, contacts, visitorLinks, llmConfig, syncRow] = await Promise.all([
    loadSubscription(env, principal),
    loadContacts(env, household.id),
    loadVisitorLinks(env, household, permissions),
    loadLlmConfig(env, principal),
    env.DB.prepare('SELECT MAX(updated_at) AS lastSyncedAt FROM workspace_records WHERE baby_id = ?').bind(baby.id).first(),
  ])
  return buildNativeSettingsModel({
    user: userOverride || {
      id: principal.userId || principal.accountId,
      email: principal.email || '',
      nickname: principal.displayName || '家长',
      name: principal.displayName || '家长',
      emailVerified: principal.emailVerified !== false,
    },
    baby,
    permissions,
    subscription,
    contacts,
    visitorLinks,
    llmConfig,
    sync: { status: 'synced', lastSyncedAt: syncRow?.lastSyncedAt || new Date().toISOString(), retryable: false },
    localCache: { available: true, clearable: true },
    locale: baby.locale || 'zh-CN',
    dataTimezone: timezoneFromRequest(request),
    sourceVersion: sourceVersion(env),
    now: new Date(),
  })
}

async function loadContext(request, env) {
  const principal = await getPrincipal(request, env, { allowLegacy: true })
  if (principal.response) return { principal }
  const household = await findHouseholdForPrincipal(env, principal)
  return { principal, household }
}

export async function onRequestGet({ request, env }) {
  const source = sourceVersion(env)
  if (!env.DB) return errorResponse(503, 'SERVICE_UNAVAILABLE', '设置资源暂时无法读取，请重试。', source, true)
  let context
  try { context = await loadContext(request, env) } catch {
    return errorResponse(503, 'RESOURCE_UNAVAILABLE', '设置资源暂时无法读取，请重试。', source, true)
  }
  if (context.principal.response) return errorResponse(context.principal.response.status, 'AUTH_REQUIRED', '登录状态已失效，请重新登录。', source)
  if (!context.household?.baby?.id) return errorResponse(409, 'BABY_REQUIRED', '请先创建或加入宝宝家庭。', source)
  try {
    return json(await buildSettings({ ...context, request, env }))
  } catch (error) {
    console.error('Native settings model failed', error)
    return errorResponse(error.status || 503, error.code || 'MODEL_UNAVAILABLE', error.message || '设置模型暂时无法生成，请重试。', source, true)
  }
}

function normalizeNickname(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function validNickname(value) {
  const normalized = normalizeNickname(value)
  return normalized && [...normalized].length <= 30 && ![...normalized].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
}

function validBirthDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now()
}

export async function onRequestPatch({ request, env }) {
  const source = sourceVersion(env)
  if (!env.DB) return errorResponse(503, 'SERVICE_UNAVAILABLE', '设置资源暂时无法写入，请重试。', source, true)
  let context
  try { context = await loadContext(request, env) } catch {
    return errorResponse(503, 'RESOURCE_UNAVAILABLE', '设置资源暂时无法读取，请重试。', source, true)
  }
  if (context.principal.response) return errorResponse(context.principal.response.status, 'AUTH_REQUIRED', '登录状态已失效，请重新登录。', source)
  if (!context.household?.baby?.id) return errorResponse(409, 'BABY_REQUIRED', '请先创建或加入宝宝家庭。', source)
  const permissions = permissionsFor(context.household)
  if (permissions.readOnly) return errorResponse(403, 'READ_ONLY', '当前访问只有只读权限。', source)

  let body
  try { body = await request.json() } catch { return errorResponse(400, 'INVALID_JSON', '请求格式不正确。', source) }
  const currentBaby = await accessibleBaby(env, context.principal, context.household.baby.id)
  if (!currentBaby) return errorResponse(403, 'BABY_FORBIDDEN', '无权访问该宝宝档案。', source)
  const now = new Date().toISOString()
  let updatedNickname = context.principal.displayName || '家长'

  if (body?.nickname !== undefined) {
    const nickname = normalizeNickname(body.nickname)
    if (!validNickname(nickname)) return errorResponse(422, 'INVALID_NICKNAME', '昵称需为 1–30 个常用字符。', source)
    updatedNickname = nickname
    if (context.principal.userId) {
      await env.DB.prepare('UPDATE "user" SET name = ?, updatedAt = ? WHERE id = ?').bind(nickname, now, context.principal.userId).run()
    }
  }

  if (body?.baby && typeof body.baby === 'object') {
    const input = body.baby
    const nickname = input.nickname === undefined ? currentBaby.nickname : normalizeNickname(input.nickname)
    const birthDate = input.birthDate === undefined ? currentBaby.birthDate : String(input.birthDate)
    if (!validNickname(nickname)) return errorResponse(422, 'INVALID_NICKNAME', '宝宝昵称需为 1–30 个常用字符。', source)
    if (!validBirthDate(birthDate)) return errorResponse(422, 'INVALID_BIRTH_DATE', '出生日期格式不正确。', source)
    const gestationalWeeks = input.gestationalWeeks === undefined ? Number(currentBaby.gestationalWeeks || 0) : Number(input.gestationalWeeks)
    const gestationalDays = input.gestationalDays === undefined ? Number(currentBaby.gestationalDays || 0) : Number(input.gestationalDays)
    const growthAgeBasis = input.growthAgeBasis === undefined ? currentBaby.growthAgeBasis || 'chronological' : input.growthAgeBasis
    const birthMultiplicity = input.birthMultiplicity === undefined ? currentBaby.birthMultiplicity || 'singleton' : input.birthMultiplicity
    if (!Number.isInteger(gestationalWeeks) || gestationalWeeks < 0 || gestationalWeeks > 45) return errorResponse(422, 'INVALID_GESTATION', '出生孕周不正确。', source)
    if (!Number.isInteger(gestationalDays) || gestationalDays < 0 || gestationalDays > 6) return errorResponse(422, 'INVALID_GESTATION_DAYS', '出生孕天不正确。', source)
    if (!['chronological', 'corrected', 'postmenstrual'].includes(growthAgeBasis)) return errorResponse(422, 'INVALID_AGE_BASIS', '年龄口径不正确。', source)
    if (!['singleton', 'multiple'].includes(birthMultiplicity)) return errorResponse(422, 'INVALID_MULTIPLICITY', '胎数信息不正确。', source)
    await env.DB.prepare(`
      UPDATE baby_profiles
      SET nickname = ?, birth_date = ?, gestational_weeks = ?, gestational_days = ?, growth_age_basis = ?, birth_multiplicity = ?, sex = ?, feeding_mode = ?, locale = ?, updated_at = ?, updated_by = ?
      WHERE id = ? AND household_id = ?
    `).bind(
      nickname,
      birthDate,
      gestationalWeeks,
      gestationalDays,
      growthAgeBasis,
      birthMultiplicity,
      input.sex === undefined ? currentBaby.sex || null : input.sex || null,
      input.feedingMode === undefined ? currentBaby.feedingMode || null : input.feedingMode || null,
      input.locale === undefined ? currentBaby.locale || 'zh-CN' : input.locale || 'zh-CN',
      now,
      context.principal.accountId,
      currentBaby.id,
      context.household.id,
    ).run()
  }

  try {
    const refreshed = await buildSettings({
      ...context,
      request,
      env,
      userOverride: {
        id: context.principal.userId || context.principal.accountId,
        email: context.principal.email || '',
        nickname: updatedNickname,
        name: updatedNickname,
        emailVerified: context.principal.emailVerified !== false,
      },
    })
    return json(refreshed)
  } catch (error) {
    console.error('Native settings update readback failed', error)
    return errorResponse(503, 'READBACK_UNAVAILABLE', '设置已提交，但最新共享状态暂时无法读取，请重试。', source, true)
  }
}
