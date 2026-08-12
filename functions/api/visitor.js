import { json } from '../_shared/auth.js'
import { hashToken } from '../_shared/principal.js'

function ageBand(birthDate, now) {
  const ageDays = Math.max(0, Math.floor((now - Date.parse(`${birthDate}T00:00:00.000Z`)) / 86400000))
  if (ageDays < 28) return '0–4 周'
  const months = Math.floor(ageDays / 30.4375)
  if (months < 3) return '1–3 个月'
  if (months < 6) return '3–6 个月'
  if (months < 12) return '6–12 个月'
  if (months < 24) return '1–2 岁'
  if (months < 36) return '2–3 岁'
  return '3 岁以上'
}

async function audit(env, linkId, result, timestamp) {
  await env.DB.prepare(`
    INSERT INTO visitor_link_access_logs (id, link_id, resource_scope, result, accessed_at)
    VALUES (?, ?, 'care_summary_24h', ?, ?)
  `).bind(`visitor-access-${crypto.randomUUID()}`, linkId, result, timestamp).run()
}

function unavailable() {
  return json({ error: '临时查看链接无效或已过期' }, 410, {
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  })
}

export async function onRequestPost({ request, env }) {
  let body
  try { body = await request.json() } catch { return unavailable() }
  const token = String(body?.token || '')
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(token)) return unavailable()
  const now = Date.now()
  const timestamp = new Date(now).toISOString()
  const cutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const row = await env.DB.prepare(`
    SELECT l.id AS linkId, l.expires_at AS expiresAt, l.revoked_at AS revokedAt,
      h.deleted_at AS householdDeletedAt,
      b.birth_date AS birthDate,
      SUM(CASE WHEN COALESCE(e.category, e.type) IN ('breastfeeding', 'bottle_feeding') THEN 1 ELSE 0 END) AS feedingCount,
      SUM(CASE WHEN COALESCE(e.category, e.type) = 'sleep' THEN 1 ELSE 0 END) AS sleepCount,
      SUM(CASE WHEN COALESCE(e.category, e.type) = 'diaper' THEN 1 ELSE 0 END) AS diaperCount
    FROM temporary_visitor_links l
    JOIN households h ON h.id = l.household_id
    JOIN baby_profiles b ON b.household_id = h.id AND COALESCE(b.status, 'active') = 'active'
    LEFT JOIN care_events e ON e.baby_id = b.id AND e.status = 'active' AND e.occurred_at >= ?
    WHERE l.token_hash = ?
    GROUP BY l.id, l.expires_at, l.revoked_at, h.deleted_at, b.birth_date
    LIMIT 1
  `).bind(cutoff, await hashToken(token)).first()
  if (!row) return unavailable()
  const result = row.revokedAt ? 'revoked' : row.householdDeletedAt ? 'household_deleted' : Date.parse(row.expiresAt) <= now ? 'expired' : 'success'
  await audit(env, row.linkId, result, timestamp)
  if (result !== 'success') return unavailable()
  return json({
    visitor: {
      label: '宝宝',
      ageBand: ageBand(row.birthDate, now),
      windowHours: 24,
      careSummary: {
        feedingCount: Number(row.feedingCount) || 0,
        sleepCount: Number(row.sleepCount) || 0,
        diaperCount: Number(row.diaperCount) || 0,
      },
      hidden: ['photos', 'name', 'exactBirthDate', 'healthDetails', 'aiConversations'],
      expiresAt: row.expiresAt,
    },
  }, 200, {
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
    'x-robots-tag': 'noindex, nofollow',
  })
}
