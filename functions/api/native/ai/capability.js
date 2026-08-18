import { json } from '../../../_shared/auth.js'
import { getPrincipal } from '../../../_shared/principal.js'
import { accessibleBaby, concernFromRow, eventFromRow, planFromRow } from '../../../_shared/care.js'
import { executeNaibaSkill } from '../../../../src/domain/naibaCapabilities.js'
import { getNaibaSkill } from '../../../../src/domain/naibaSkills.js'
import { buildBabyContextSummary } from '../../../../src/domain/naibaContext.js'
import { NATIVE_AI_CONTRACT, NATIVE_AI_CONTRACT_VERSION } from '../../../../src/domain/nativeAiContract.js'

async function authorizedContext(env, principal, babyId) {
  const baby = await accessibleBaby(env, principal, babyId)
  if (!baby || baby.status === 'detached') return null
  const [eventRows, planRows, concernRows] = await Promise.all([
    env.DB.prepare('SELECT * FROM care_events WHERE baby_id = ? AND status != \'voided\' ORDER BY occurred_at DESC, created_at DESC LIMIT 120').bind(baby.id).all(),
    env.DB.prepare('SELECT * FROM care_plan_items WHERE baby_id = ? ORDER BY due_at, created_at').bind(baby.id).all(),
    env.DB.prepare('SELECT * FROM concerns WHERE baby_id = ? ORDER BY updated_at').bind(baby.id).all(),
  ])
  return {
    baby,
    events: (eventRows.results || []).map(eventFromRow).filter(Boolean).reverse(),
    carePlanItems: (planRows.results || []).map(planFromRow).filter(Boolean),
    concerns: (concernRows.results || []).map(concernFromRow).filter(Boolean),
  }
}

function sourceIds(value) {
  return [...new Set([
    ...(Array.isArray(value?.sourceEventIds) ? value.sourceEventIds : []),
    ...(Array.isArray(value?.usedFacts) ? value.usedFacts.flatMap((item) => item?.sourceEventIds || []) : []),
    ...(Array.isArray(value?.facts) ? value.facts.map((item) => item?.id).filter(Boolean) : []),
  ])]
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: '共享数据库未配置。' }, 503)
  const principal = await getPrincipal(request, env, { allowLegacy: true })
  if (principal.response) return principal.response
  let body
  try { body = await request.json() } catch { return json({ error: '请求格式无效。' }, 400) }
  const skillId = String(body?.skillId || '').trim()
  const skill = getNaibaSkill(skillId)
  if (!skill) return json({ error: '不支持的 AI 能力。' }, 422)
  const babyId = String(body?.babyId || '').trim()
  if (!babyId) return json({ error: '缺少宝宝档案编号。' }, 422)
  const context = await authorizedContext(env, principal, babyId)
  if (!context) return json({ error: '无权访问该宝宝档案。' }, 403)
  const input = body?.input && typeof body.input === 'object' ? body.input : {}
  const now = new Date()
  const result = executeNaibaSkill(skillId, input, {
    baby: context.baby,
    events: context.events,
    careEvents: context.events,
    concerns: context.concerns,
    carePlanItems: context.carePlanItems,
    actor: { id: principal.userId || principal.accountId, displayName: principal.displayName || '家庭成员' },
    now,
    locale: context.baby.locale || 'zh-CN',
    questions: Array.isArray(input.questions) ? input.questions : [],
  })
  const summary = buildBabyContextSummary({ baby: context.baby, events: context.events, concerns: context.concerns, carePlanItems: context.carePlanItems, now })
  return json({
    contract: NATIVE_AI_CONTRACT,
    contractVersion: NATIVE_AI_CONTRACT_VERSION,
    skillId,
    status: result?.status || 'ready',
    data: result,
    sources: {
      eventIds: [...new Set([...sourceIds(result), ...summary.sourceEventIds])],
      knowledgePackVersion: summary.currentStage.supportedKnowledgePack,
      limitations: result?.limitations || [],
    },
  })
}
