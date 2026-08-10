import { getBetterAuthSession } from './betterAuth.js'
import { getSession, json } from './auth.js'

function idToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function legacyUsername(user) {
  const normalized = String(user.username || user.email || user.id || '').toLowerCase().replace(/[^a-z0-9_.]/g, '_').slice(0, 32)
  return `auth_${normalized || idToken().slice(0, 16)}`.slice(0, 48)
}

export async function ensureLegacyAccount(env, user) {
  const link = await env.DB.prepare(`
    SELECT l.user_id, l.account_id, a.username, a.role, a.display_name
    FROM auth_user_account_links l JOIN accounts a ON a.id = l.account_id
    WHERE l.user_id = ?
  `).bind(user.id).first()
  if (link) return { id: link.account_id, username: link.username, role: link.role, displayName: link.display_name }

  // Keep an existing legacy account's data when a user signs up with the
  // same username. The link is one-to-one, so a second user can never
  // silently take over the old account.
  const legacyUsernameValue = String(user.username || '').trim().toLowerCase()
  if (legacyUsernameValue) {
    const legacy = await env.DB.prepare(`
      SELECT id, username, role, display_name
      FROM accounts
      WHERE username = ? AND active = 1
    `).bind(legacyUsernameValue).first()
    if (legacy) {
      try {
        await env.DB.batch([
          env.DB.prepare('INSERT INTO auth_user_account_links (user_id, account_id) VALUES (?, ?)').bind(user.id, legacy.id),
          env.DB.prepare(`
            UPDATE household_members
            SET user_id = ?, membership_role = CASE WHEN role = 'owner' THEN 'owner' ELSE 'member' END
            WHERE account_id = ? AND active = 1 AND user_id IS NULL
          `).bind(user.id, legacy.id),
          env.DB.prepare(`
            UPDATE households
            SET owner_user_id = ?
            WHERE owner_account_id = ? AND owner_user_id IS NULL
          `).bind(user.id, legacy.id),
        ])
        return { id: legacy.id, username: legacy.username, role: legacy.role, displayName: legacy.display_name }
      } catch {
        // The legacy account may already be linked by another user. Continue
        // with an isolated compatibility account instead of merging users.
      }
    }
  }

  const accountId = `auth-${user.id}`
  const username = legacyUsername(user)
  const displayName = String(user.name || user.username || user.email || 'BabyForge 用户').slice(0, 80)
  const salt = idToken()
  const hash = idToken().padEnd(64, '0').slice(0, 64)
  await env.DB.batch([
    env.DB.prepare(`
      INSERT OR IGNORE INTO accounts
        (id, username, role, display_name, password_salt, password_hash, password_iterations)
      VALUES (?, ?, 'caregiver', ?, ?, ?, 10000)
    `).bind(accountId, username, displayName, salt, hash),
    env.DB.prepare(`
      INSERT OR IGNORE INTO auth_user_account_links (user_id, account_id)
      VALUES (?, ?)
    `).bind(user.id, accountId),
  ])
  return { id: accountId, username, role: 'caregiver', displayName }
}

export async function getPrincipal(request, env, { allowLegacy = true } = {}) {
  const current = await getBetterAuthSession(request, env)
  if (current?.user) {
    if (!current.user.emailVerified) return { response: json({ error: '请先验证邮箱' }, 403) }
    const account = await ensureLegacyAccount(env, current.user)
    return {
      userId: current.user.id,
      accountId: account.id,
      username: current.user.username || account.username,
      displayName: current.user.name || account.displayName,
      email: current.user.email,
      emailVerified: Boolean(current.user.emailVerified),
      role: 'member',
      auth: 'better-auth',
      user: current.user,
    }
  }
  if (allowLegacy) {
    const legacy = await getSession(request, env)
    if (legacy) return { ...legacy, userId: null, auth: 'legacy' }
  }
  return { response: json({ error: '未登录或登录已过期' }, 401) }
}

export async function requireBetterAuthUser(request, env, options = {}) {
  const current = await getBetterAuthSession(request, env)
  if (!current?.user) return { response: json({ error: '未登录或登录已过期' }, 401) }
  if (!current.user.emailVerified) return { response: json({ error: '请先验证邮箱' }, 403) }
  if (options.maxAgeSeconds) {
    const sessionTimestamp = Date.parse(current.session?.updatedAt || current.session?.createdAt || '')
    if (!sessionTimestamp || Date.now() - sessionTimestamp > Number(options.maxAgeSeconds) * 1000) {
      return { response: json({ error: '请重新登录后再执行此敏感操作' }, 403) }
    }
  }
  const account = await ensureLegacyAccount(env, current.user)
  return {
    userId: current.user.id,
    accountId: account.id,
    username: current.user.username || account.username,
    displayName: current.user.name || account.displayName,
    email: current.user.email,
    user: current.user,
    auth: 'better-auth',
  }
}

// Formal authorization primitives. Legacy account sessions still carry
// accountId for the expand/dual-read period, but all new membership checks
// prefer the stable Better Auth user id.
export async function requireUser(request, env, options = {}) {
  return requireBetterAuthUser(request, env, options)
}

export async function getActiveMembership(env, userId, householdId = null) {
  if (!userId) return null
  const clauses = ['m.user_id = ?', 'm.active = 1', 'h.deleted_at IS NULL']
  const binds = [userId]
  if (householdId) {
    clauses.push('m.household_id = ?')
    binds.push(householdId)
  }
  return env.DB.prepare(`
    SELECT m.household_id AS householdId,
      COALESCE(m.membership_role, CASE WHEN m.role = 'owner' THEN 'owner' ELSE 'member' END) AS role,
      m.user_id AS userId, m.account_id AS accountId,
      h.id, h.name, h.deleted_at AS deletedAt
    FROM household_members m
    JOIN households h ON h.id = m.household_id
    WHERE ${clauses.join(' AND ')}
    LIMIT 1
  `).bind(...binds).first()
}

export async function requireHouseholdMember(request, env, householdId, options = {}) {
  const principal = await requireUser(request, env, options)
  if (principal.response) return principal
  const membership = await getActiveMembership(env, principal.userId, householdId)
  if (!membership) return { response: json({ error: '无权访问该家庭' }, 403) }
  return { ...principal, membership }
}

export async function requireHouseholdOwner(request, env, householdId, options = {}) {
  const result = await requireHouseholdMember(request, env, householdId, options)
  if (result.response) return result
  if (result.membership.role !== 'owner') return { response: json({ error: '只有 Owner 可以执行此操作' }, 403) }
  return result
}

export async function requireBabyAccess(request, env, babyId, options = {}) {
  const principal = await requireUser(request, env, options)
  if (principal.response) return principal
  const baby = await env.DB.prepare(`
    SELECT b.id, b.household_id AS householdId, b.nickname,
      b.birth_date AS birthDate, b.gestational_weeks AS gestationalWeeks,
      b.gestational_days AS gestationalDays, b.growth_age_basis AS growthAgeBasis,
      b.birth_multiplicity AS birthMultiplicity, b.sex, b.feeding_mode AS feedingMode,
      b.locale, COALESCE(b.status, 'active') AS status
    FROM baby_profiles b
    JOIN household_members m ON m.household_id = b.household_id
    JOIN households h ON h.id = b.household_id
    WHERE b.id = ? AND m.user_id = ? AND m.active = 1 AND h.deleted_at IS NULL
    LIMIT 1
  `).bind(babyId, principal.userId).first()
  if (!baby) return { response: json({ error: '无权访问该宝宝档案' }, 403) }
  return { ...principal, baby }
}

export async function findHouseholdForPrincipal(env, principal) {
  const select = `
    SELECT
      h.id,
      h.name,
      h.created_at AS createdAt,
      h.deleted_at AS deletedAt,
      COALESCE(m.membership_role, CASE WHEN m.role = 'owner' THEN 'owner' ELSE 'member' END) AS role,
      m.active,
      m.user_id AS memberUserId,
      b.id AS babyId,
      b.nickname AS babyNickname,
      b.birth_date AS babyBirthDate,
      b.gestational_weeks AS babyGestationalWeeks,
      b.gestational_days AS babyGestationalDays,
      b.sex AS babySex,
      b.feeding_mode AS babyFeedingMode,
      b.locale AS babyLocale
    FROM household_members m
    JOIN households h ON h.id = m.household_id
    LEFT JOIN baby_profiles b ON b.household_id = h.id
    WHERE m.active = 1 AND h.deleted_at IS NULL
      AND %s
    ORDER BY h.created_at DESC
    LIMIT 1
  `
  let row = null
  if (principal.userId) {
    row = await env.DB.prepare(select.replace('%s', 'm.user_id = ?')).bind(principal.userId).first()
  }
  if (!row) {
    row = await env.DB.prepare(select.replace('%s', 'm.account_id = ?')).bind(principal.accountId).first()
  }
  if (!row) return null
  const baby = row.babyId ? {
    id: row.babyId,
    nickname: row.babyNickname,
    birthDate: row.babyBirthDate,
    gestationalWeeks: row.babyGestationalWeeks,
    gestationalDays: row.babyGestationalDays,
    sex: row.babySex,
    feedingMode: row.babyFeedingMode,
    locale: row.babyLocale,
  } : null
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
    baby,
  }
}

export function randomToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export async function hashToken(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
