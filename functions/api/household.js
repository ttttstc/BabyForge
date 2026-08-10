import { json } from '../_shared/auth.js'
import { findHouseholdForPrincipal, getPrincipal, requireBetterAuthUser } from '../_shared/principal.js'

function now() {
  return new Date().toISOString()
}

function normalizeName(value, fallback = '') {
  const name = String(value || '').trim().replace(/\s+/g, ' ')
  return (name || fallback).slice(0, 80)
}

function normalizeBaby(input) {
  if (!input || typeof input !== 'object') return null
  const birthDate = String(input.birthDate || '').trim()
  const nickname = String(input.nickname || '').trim().slice(0, 40)
  if (!nickname || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null
  return {
    id: String(input.id || crypto.randomUUID()),
    nickname,
    birthDate,
    gestationalWeeks: Number(input.gestationalWeeks) || 0,
    gestationalDays: Number(input.gestationalDays) || 0,
    sex: input.sex || null,
    feedingMode: input.feedingMode || null,
    locale: input.locale || 'zh-CN',
  }
}

export async function onRequestGet({ request, env }) {
  const principal = await getPrincipal(request, env, { allowLegacy: true })
  if (principal.response) return principal.response
  const household = await findHouseholdForPrincipal(env, principal)
  return json({ household })
}

export async function onRequestPost({ request, env }) {
  const principal = await requireBetterAuthUser(request, env)
  if (principal.response) return principal.response
  if (await findHouseholdForPrincipal(env, principal)) return json({ error: '当前账号已经加入家庭' }, 409)
  let body
  try { body = await request.json() } catch { return json({ error: '请求格式不正确' }, 400) }
  const baby = normalizeBaby(body?.baby)
  const name = normalizeName(body?.name)
  if (!name) return json({ error: '家庭名称不能为空' }, 400)
  const householdId = `household-${crypto.randomUUID()}`
  const timestamp = now()
  const statements = [
    env.DB.prepare(`
      INSERT INTO households (id, name, owner_account_id, owner_user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(householdId, name, principal.accountId, principal.userId, timestamp, timestamp),
    env.DB.prepare(`
      INSERT INTO household_members (household_id, account_id, role, active, user_id, membership_role, created_at)
      VALUES (?, ?, 'caregiver', 1, ?, 'owner', ?)
    `).bind(householdId, principal.accountId, principal.userId, timestamp),
  ]
  if (baby) {
    statements.push(env.DB.prepare(`
      INSERT INTO baby_profiles
        (id, household_id, nickname, birth_date, gestational_weeks, gestational_days,
         birth_multiplicity, growth_age_basis, sex, feeding_mode, locale, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      baby.id, householdId, baby.nickname, baby.birthDate, baby.gestationalWeeks, baby.gestationalDays,
      body?.baby?.birthMultiplicity || 'singleton', body?.baby?.growthAgeBasis || 'chronological',
      baby.sex, baby.feedingMode, baby.locale, timestamp, principal.accountId,
    ))
  }
  try {
    await env.DB.batch(statements)
  } catch (error) {
    if (String(error?.message || '').includes('idx_household_members_one_active_user')) return json({ error: '当前账号已经加入家庭' }, 409)
    throw error
  }
  return json({ household: await findHouseholdForPrincipal(env, principal) }, 201)
}

export async function onRequestPatch({ request, env }) {
  const principal = await requireBetterAuthUser(request, env)
  if (principal.response) return principal.response
  const household = await findHouseholdForPrincipal(env, principal)
  if (!household) return json({ error: '尚未加入家庭' }, 404)
  if (household.role !== 'owner') return json({ error: '只有 Owner 可以修改家庭' }, 403)
  let body
  try { body = await request.json() } catch { return json({ error: '请求格式不正确' }, 400) }
  const name = normalizeName(body?.name)
  if (!name) return json({ error: '家庭名称不能为空' }, 400)
  await env.DB.prepare('UPDATE households SET name = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').bind(name, now(), household.id).run()
  return json({ household: await findHouseholdForPrincipal(env, principal) })
}

export async function onRequestDelete({ request, env }) {
  const principal = await requireBetterAuthUser(request, env, { maxAgeSeconds: 10 * 60 })
  if (principal.response) return principal.response
  const household = await findHouseholdForPrincipal(env, principal)
  if (!household) return json({ error: '尚未加入家庭' }, 404)
  if (household.role !== 'owner') return json({ error: '只有 Owner 可以删除家庭' }, 403)
  const deletedAt = now()
  await env.DB.batch([
    env.DB.prepare('UPDATE households SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').bind(deletedAt, deletedAt, household.id),
    env.DB.prepare('UPDATE household_members SET active = 0, inactive_at = ? WHERE household_id = ? AND active = 1').bind(deletedAt, household.id),
  ])
  return json({ ok: true, recoveryWindowDays: 7 })
}
