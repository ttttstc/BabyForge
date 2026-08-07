import { getSession, json } from '../../_shared/auth.js'
import { accessibleBaby, concernFromRow, eventFromRow, planFromRow } from '../../_shared/care.js'
import { runNaibaAgent } from '../../_shared/naibaAgent.js'
import { selectSkillId } from '../../_shared/skillRegistry.js'
import { getAgeDays } from '../../../src/domain/baby.js'
import { calculateFeedingRecommendation } from '../../../src/domain/feedingRecommendation.js'
import { extractDecisionFacts, getDecisionUnit, runDecisionUnit, selectDecisionUnit } from '../../../src/domain/decisionKernel.js'

function sse(events, status = 200) {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
  return new Response(body, { status, headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' } })
}

function newConversationId() {
  return globalThis.crypto?.randomUUID?.() || `conversation-${Date.now()}`
}

async function openConversation(env, accountId, babyId, requestedId = '') {
  const id = /^[a-zA-Z0-9_-]{1,120}$/.test(requestedId) ? requestedId : newConversationId()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 30 * 86_400_000).toISOString()
  try {
    const existing = await env.DB.prepare('SELECT id, account_id AS accountId, baby_id AS babyId, status, expires_at AS expiresAt FROM ai_conversations WHERE id = ?').bind(id).first()
    if (existing && (existing.accountId !== accountId || existing.babyId !== babyId || existing.status === 'deleted')) return { denied: true }
    if (!existing) {
      await env.DB.prepare(`
        INSERT INTO ai_conversations (id, baby_id, account_id, title, status, created_at, updated_at, expires_at)
        VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
      `).bind(id, babyId, accountId, '奶爸AI对话', now.toISOString(), now.toISOString(), expiresAt).run()
    } else if (existing.expiresAt <= now.toISOString()) {
      await env.DB.prepare('UPDATE ai_conversations SET status = \'active\', updated_at = ?, expires_at = ? WHERE id = ?').bind(now.toISOString(), expiresAt, id).run()
    }
    return { id }
  } catch (error) {
    // A deployment that has not applied 0007 can still use the safe chat path;
    // persistence becomes available as soon as the migration is applied.
    console.error('Naiba AI conversation persistence unavailable', error)
    return { id: null }
  }
}

async function appendMessage(env, conversationId, role, content, skillId = null, decisionResultId = null) {
  if (!conversationId) return
  const now = new Date().toISOString()
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO ai_messages (id, conversation_id, role, content_json, skill_id, decision_result_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newConversationId(), conversationId, role, JSON.stringify({ text: content }), skillId, decisionResultId, now),
      env.DB.prepare('UPDATE ai_conversations SET updated_at = ? WHERE id = ?').bind(now, conversationId),
    ])
  } catch (error) {
    console.error('Naiba AI message persistence unavailable', error)
  }
}

function localAnswer(message, recommendation = {}, decision = null) {
  const value = String(message || '').toLowerCase()
  if (decision?.status === 'safety_action_required') return `${decision.minimumAction} 不要等待剩余问询完成。`
  if (decision?.status === 'needs_information') return `我现在不会下健康结论。先请告诉我：${decision.nextQuestion?.label || '下一个关键事实'}？如果不确定，可以直接说“不确定”。`
  if (decision?.status === 'decision_ready') return '关键事实已经收集齐了。我现在可以整理下一步观察和沟通重点，但这不是诊断。'
  const isFeeding = /吃|奶|喂|饮食|辅食|量|feed|milk|food|feeding|amount/.test(value)
  if (recommendation.status === 'safety_action_required') return recommendation.message
  if (isFeeding && recommendation.recommendations?.length) {
    return recommendation.recommendations.map((item) => `${item.title}：${item.quantity}\n${item.detail}`).join('\n\n')
  }
  if (recommendation.status === 'needs_information') return recommendation.message || '请先补充当前缺失的关键事实。'
  return '我已收到。我会先核对宝宝事实和知识依据；缺失信息时不会轻易下结论。'
}

async function loadAuthorizedContext(env, accountId, babyId) {
  const baby = await accessibleBaby(env, accountId, babyId)
  if (!baby || baby.status === 'detached') return null
  const [rows, planRows, concernRows] = await Promise.all([
    env.DB.prepare(`
      SELECT * FROM care_events
      WHERE baby_id = ? AND status != 'voided'
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT 60
    `).bind(baby.id).all(),
    env.DB.prepare('SELECT * FROM care_plan_items WHERE baby_id = ? ORDER BY due_at, created_at').bind(baby.id).all(),
    env.DB.prepare('SELECT * FROM concerns WHERE baby_id = ? ORDER BY updated_at').bind(baby.id).all(),
  ])
  return {
    baby,
    careEvents: (rows.results || []).map(eventFromRow).filter(Boolean).reverse(),
    carePlanItems: (planRows.results || []).map(planFromRow).filter(Boolean),
    concerns: (concernRows.results || []).map(concernFromRow).filter(Boolean),
  }
}

function safeDecisionFacts(value) {
  const allowed = new Set(['alertness', 'breathing', 'feedingChange', 'wetDiapers', 'temperatureC', 'measurementMethod', 'breathingRate', 'chestIndrawing', 'jaundiceOnset', 'yellowPalmsSoles', 'sleepPosition', 'sleepSurface', 'softObjects'])
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => allowed.has(key) && (typeof item === 'number' || typeof item === 'boolean' || (typeof item === 'string' && item.length <= 80))))
}

async function persistDecision(env, accountId, babyId, result) {
  if (!result) return null
  const id = newConversationId()
  try {
    await env.DB.prepare('INSERT INTO decision_results (id, baby_id, account_id, unit_id, unit_version, status, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, babyId, accountId, result.unitId, result.unitVersion, result.status, JSON.stringify(result), new Date().toISOString()).run()
    return id
  } catch (error) {
    console.error('Naiba AI decision persistence unavailable', error)
    return null
  }
}

async function persistHealthEpisode(env, accountId, babyId, unitId, facts, result) {
  if (!result) return
  const now = new Date().toISOString()
  try {
    const existing = await env.DB.prepare('SELECT id FROM health_episodes WHERE baby_id = ? AND account_id = ? AND topic = ? AND status = \'open\' ORDER BY updated_at DESC LIMIT 1').bind(babyId, accountId, unitId).first()
    const summary = JSON.stringify({ facts, decision: result })
    if (existing?.id) await env.DB.prepare('UPDATE health_episodes SET summary_json = ?, updated_at = ? WHERE id = ?').bind(summary, now, existing.id).run()
    else await env.DB.prepare('INSERT INTO health_episodes (id, baby_id, account_id, topic, status, summary_json, created_at, updated_at) VALUES (?, ?, ?, ?, \'open\', ?, ?, ?)').bind(newConversationId(), babyId, accountId, unitId, summary, now, now).run()
  } catch (error) {
    console.error('Naiba AI health episode persistence unavailable', error)
  }
}

async function persistProvisionalEvidence(env, accountId, babyId, query, output) {
  const allowed = new Set(['www.nhc.gov.cn', 'nhc.gov.cn', 'www.who.int', 'who.int', 'www.cdc.gov', 'cdc.gov'])
  const urls = [...new Set(String(output).match(/https?:\/\/[^\s)\]]+/g) || [])].filter((url) => {
    try { return allowed.has(new URL(url).hostname) } catch { return false }
  })
  if (!urls.length) return
  const now = new Date()
  try {
    await env.DB.prepare('INSERT INTO provisional_knowledge_evidence (id, account_id, baby_id, query, evidence_json, policy_status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, \'accepted_general\', ?, ?)')
      .bind(newConversationId(), accountId, babyId, query, JSON.stringify({ urls, limitation: 'general_education_only' }), now.toISOString(), new Date(now.getTime() + 7 * 86_400_000).toISOString()).run()
  } catch (error) {
    console.error('Naiba AI provisional evidence persistence unavailable', error)
  }
}

export async function onRequestPost({ request, env }) {
  const session = await getSession(request, env)
  if (!session) return json({ error: '未登录或登录已过期' }, 401)
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: '请求格式无效' }, 400)
  }
  const message = String(body?.message || '').trim()
  if (!message) return json({ error: '请输入问题' }, 400)
  if (message.length > 4_000) return json({ error: '问题过长，请分段输入' }, 413)

  const babyId = String(body?.baby?.id || '').trim()
  if (!babyId) return json({ error: '缺少宝宝档案编号' }, 422)
  const context = await loadAuthorizedContext(env, session.accountId, babyId)
  if (!context) return json({ error: '无权访问该宝宝档案' }, 403)
  const conversation = await openConversation(env, session.accountId, babyId, String(body?.conversationId || '').trim())
  if (conversation.denied) return json({ error: '无权访问该 AI 对话' }, 403)
  const requestedSkillId = String(body?.skillId || '').slice(0, 120)
  await appendMessage(env, conversation.id, 'user', message, requestedSkillId || null)
  const recommendation = calculateFeedingRecommendation({ baby: context.baby, events: context.careEvents, locale: context.baby.locale || 'zh-CN' })
  const skillId = selectSkillId(message, requestedSkillId)
  const requestedDecisionUnitId = String(body?.decisionUnitId || '')
  const decisionUnitId = skillId === 'triage_and_preassessment'
    ? (getDecisionUnit(requestedDecisionUnitId) ? requestedDecisionUnitId : selectDecisionUnit(message))
    : ''
  const decisionFacts = { ...safeDecisionFacts(body?.decisionFacts), ...extractDecisionFacts(message), ageDays: getAgeDays(context.baby.birthDate) }
  const decision = decisionUnitId ? runDecisionUnit({ unitId: decisionUnitId, facts: decisionFacts }) : null
  const decisionResultId = await persistDecision(env, session.accountId, context.baby.id, decision)
  await persistHealthEpisode(env, session.accountId, context.baby.id, decisionUnitId, decisionFacts, decision)
  const fallback = localAnswer(message, recommendation, decision)
  async function respond(events, assistantText) {
    await appendMessage(env, conversation.id, 'assistant', assistantText, skillId, decisionResultId)
    return sse([{ type: 'meta', conversationId: conversation.id }, ...events])
  }

  if (skillId === 'triage_and_preassessment' && decision?.status !== 'decision_ready') return respond([{ type: 'message', delta: fallback }, { type: 'decision', result: decision }, { type: 'done' }], fallback)
  if (!env.OPENAI_API_KEY) return respond([{ type: 'message', delta: fallback }, { type: 'done' }], fallback)

  try {
    const output = await runNaibaAgent({
      message,
      skillId,
      baby: context.baby,
      careEvents: context.careEvents,
      carePlanItems: context.carePlanItems,
      concerns: context.concerns,
      questions: [],
      feedingReference: recommendation,
      decisionResult: decision,
      conversationId: conversation.id,
      locale: context.baby.locale || 'zh-CN',
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      apiKey: env.OPENAI_API_KEY,
    })
    await persistProvisionalEvidence(env, session.accountId, context.baby.id, message, output)
    return respond([{ type: 'message', delta: output }, { type: 'done' }], output)
  } catch (error) {
    console.error('Naiba AI agent failed; using safe fallback', error)
    return respond([{ type: 'message', delta: fallback }, { type: 'meta', fallback: true }, { type: 'done' }], fallback)
  }
}
