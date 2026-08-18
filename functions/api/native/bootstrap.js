import { json } from '../../_shared/auth.js'
import { findHouseholdForPrincipal, getPrincipal } from '../../_shared/principal.js'
import { NATIVE_RESOURCE_CONTRACT, NATIVE_RESOURCE_CONTRACT_VERSION, NATIVE_RESOURCE_TIMEZONE } from '../../../src/domain/nativeResourceContract.js'

function sourceVersion(env) {
  return String(env.BABYFORGE_RESOURCE_SOURCE_VERSION || env.CF_PAGES_COMMIT_SHA || 'web-runtime').slice(0, 120)
}

function errorResponse(status, code, message, source, retryable = false, details = null) {
  return json({
    contract: NATIVE_RESOURCE_CONTRACT,
    contractVersion: NATIVE_RESOURCE_CONTRACT_VERSION,
    sourceVersion: source,
    error: {
      code,
      message,
      retryable,
      ...(details ? { details } : {}),
    },
  }, status)
}

function timezoneFromRequest(request) {
  const candidate = String(request.headers.get('x-babyforge-timezone') || '').trim()
  if (!candidate) return NATIVE_RESOURCE_TIMEZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format()
    return candidate
  } catch {
    return NATIVE_RESOURCE_TIMEZONE
  }
}

function mapRole(value) {
  if (value === 'owner') return 'owner'
  if (value === 'guest' || value === 'readOnly') return 'readOnly'
  return 'member'
}

async function listMembers(env, householdId) {
  const result = await env.DB.prepare(`
    SELECT
      COALESCE(m.user_id, m.account_id) AS id,
      COALESCE(a.display_name, '家庭成员') AS display_name,
      COALESCE(m.membership_role, CASE WHEN m.role = 'owner' THEN 'owner' WHEN m.role = 'guest' THEN 'readOnly' ELSE 'member' END) AS role,
      m.active,
      m.created_at AS created_at
    FROM household_members m
    LEFT JOIN accounts a ON a.id = m.account_id
    WHERE m.household_id = ?
    ORDER BY CASE WHEN m.membership_role = 'owner' OR m.role = 'owner' THEN 0 ELSE 1 END, m.created_at ASC
  `).bind(householdId).all()
  return (result.results || []).map((row) => ({
    id: String(row.id),
    displayName: String(row.display_name || '家庭成员'),
    role: mapRole(row.role),
    active: Number(row.active) === 1,
    createdAt: row.created_at || null,
  }))
}

async function listInvites(env, householdId, canManage) {
  if (!canManage) return []
  const result = await env.DB.prepare(`
    SELECT id, expires_at AS expiresAt, created_at AS createdAt, used_at AS usedAt, revoked_at AS revokedAt
    FROM household_invites
    WHERE household_id = ? AND used_at IS NULL AND revoked_at IS NULL
    ORDER BY created_at DESC
  `).bind(householdId).all()
  return (result.results || []).map((row) => ({
    id: String(row.id),
    expiresAt: String(row.expiresAt),
    createdAt: String(row.createdAt),
    status: Date.parse(row.expiresAt) > Date.now() ? 'active' : 'expired',
  }))
}

function mapUser(principal) {
  return {
    id: String(principal.userId || principal.accountId),
    email: principal.email || null,
    emailVerified: principal.emailVerified !== false,
    nickname: String(principal.displayName || '家长'),
    displayName: String(principal.displayName || '家长'),
    avatar: principal.user?.image || null,
  }
}

export async function onRequestGet({ request, env }) {
  const source = sourceVersion(env)
  let principal
  try {
    principal = await getPrincipal(request, env, { allowLegacy: true })
  } catch {
    return errorResponse(503, 'SERVICE_UNAVAILABLE', '共享业务资源暂时无法读取，请重试。', source, true)
  }
  if (principal.response) {
    const status = principal.response.status
    return errorResponse(status, status === 403 ? 'EMAIL_NOT_VERIFIED' : 'AUTH_REQUIRED', status === 403 ? '请先验证邮箱。' : '登录状态已失效，请重新登录。', source, status >= 500)
  }

  const generatedAt = new Date().toISOString()
  let household
  try {
    household = await findHouseholdForPrincipal(env, principal)
    if (household) {
      const canManageHousehold = household.role === 'owner'
      const mappedRole = mapRole(household.role)
      household = {
        ...household,
        role: mappedRole,
        readOnly: mappedRole === 'readOnly',
        members: await listMembers(env, household.id),
        pendingInvites: await listInvites(env, household.id, canManageHousehold),
      }
    }
  } catch {
    return errorResponse(503, 'RESOURCE_UNAVAILABLE', '家庭资源暂时无法读取，请重试。', source, true)
  }

  const role = household?.role || 'member'
  const readOnly = role === 'readOnly'
  return json({
    contract: NATIVE_RESOURCE_CONTRACT,
    contractVersion: NATIVE_RESOURCE_CONTRACT_VERSION,
    generatedAt,
    dataTimezone: timezoneFromRequest(request),
    sourceVersion: source,
    permissions: {
      authenticated: true,
      role,
      readOnly,
      canEdit: Boolean(household && !readOnly),
      canManageHousehold: role === 'owner',
      canCreateHousehold: !household,
      canAcceptInvite: !household,
    },
    user: mapUser(principal),
    household,
  })
}
