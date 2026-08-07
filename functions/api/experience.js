import { json, requireSession } from '../_shared/auth.js'
import { getContentAgeBandForBaby, EXPERIENCE_CATEGORIES, formatExperienceAge } from '../../src/domain/experience.js'
import { loadOrSearchExperience } from '../_shared/experience.js'

const CATEGORY_IDS = new Set(EXPERIENCE_CATEGORIES.map((category) => category.id))

async function accessibleBaby(env, accountId, babyId) {
  return env.DB.prepare(`
    SELECT b.id, b.birth_date AS birthDate, b.locale
    FROM baby_profiles b JOIN household_members m ON m.household_id = b.household_id
    WHERE b.id = ? AND m.account_id = ? AND m.active = 1
  `).bind(babyId, accountId).first()
}

function responsePayload(age, categoryId, feed, locale) {
  return {
    available: true,
    ageText: formatExperienceAge(age, locale),
    ageBand: { id: age.band.id, label: age.band.label, rangeLabel: age.band.rangeLabel },
    category: categoryId,
    generatedAt: feed.generatedAt,
    expiresAt: feed.expiresAt,
    staleUntil: feed.staleUntil,
    cacheState: feed.cacheState,
    articles: feed.articles || [],
    ...(feed.error ? { notice: '暂时无法更新，已展示最近结果。' } : {}),
  }
}

export async function onRequestGet({ request, env, waitUntil }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  const params = new URL(request.url).searchParams
  const babyId = String(params.get('babyId') || '').trim()
  const categoryId = String(params.get('category') || 'recommended').trim()
  const refresh = params.get('refresh') === '1' || params.get('refresh') === 'true'
  if (!babyId || !CATEGORY_IDS.has(categoryId)) return json({ error: '经验查询参数不正确' }, 400)
  const baby = await accessibleBaby(env, auth.session.accountId, babyId)
  if (!baby) return json({ error: '无权访问该宝宝档案' }, 403)
  if (refresh && auth.session.role === 'guest') return json({ error: '游客不能强制更新文章' }, 403)
  let age
  try {
    age = getContentAgeBandForBaby(baby.birthDate, new Date(), 'Asia/Shanghai')
  } catch (error) {
    return json({ error: error.message }, 422)
  }
  if (!age.band) {
    return json({ available: false, ageText: formatExperienceAge(age, baby.locale || 'zh-CN'), ageBand: null, category: categoryId, articles: [], notice: '当前年龄暂未覆盖经验推荐。' })
  }
  try {
    const feed = await loadOrSearchExperience({ requestUrl: request.url, env, band: age.band, categoryId, refresh, waitUntil })
    return json(responsePayload(age, categoryId, feed, baby.locale || 'zh-CN'))
  } catch (error) {
    return json({ error: error.message || '经验文章暂时无法更新' }, error.status || 502)
  }
}
