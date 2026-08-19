import { getSession, json } from '../../_shared/auth.js'
import { accessibleBaby, concernFromRow, eventFromRow, planFromRow } from '../../_shared/care.js'
import { describeNaibaAgentFailure, runNaibaAgent } from '../../_shared/naibaAgent.js'
import { getSkillContract, selectSkillId } from '../../_shared/skillRegistry.js'
import { getAgeDays } from '../../../src/domain/baby.js'
import { calculateFeedingRecommendation } from '../../../src/domain/feedingRecommendation.js'
import { DECISION_INPUT_FACT_KEYS, DECISION_REQUIRED_FACT_KEYS, extractDecisionFacts, parseDecisionAnswer, runDecisionUnit, selectDecisionUnit, selectExplicitDecisionUnit } from '../../../src/domain/decisionKernel.js'
import { buildNaibaLocalAnswer } from '../../../src/domain/naibaLocalAnswer.js'
import { isNaibaContextualFollowUp, isNaibaTopicInScope, NAIBA_OUT_OF_SCOPE_MESSAGE } from '../../../src/domain/naibaScope.js'
import { searchApprovedKnowledge } from '../../../src/domain/knowledgePack.js'
import { DISEASE_CONTENT_VERSION, DISEASE_TOPICS } from '../../../src/content/diseaseRegistry.js'
import { localDayForTimezone } from '../../../src/domain/nativeToday.js'
import { loadAccountLlmConfig, resolvedLlmConfig } from '../../_shared/llmConfig.js'
import { NAIBA_AGENT_CONTRACT, NAIBA_AGENT_CONTRACT_VERSION, normalizeNaibaAttachments, normalizeNaibaContext, normalizeNaibaHistory } from '../../../src/domain/naibaAgentContract.js'
import { resolveNaibaSkillContext } from '../../../src/domain/naibaContextResolver.js'
import { searchAuthorityKnowledge } from '../../_shared/authoritySearch.js'
import { isCurrentBabyHealthComplaint } from '../../../src/domain/naibaSkills.js'

function sse(events, status = 200) {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
  return new Response(body, { status, headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' } })
}

function newRequestId() {
  return globalThis.crypto?.randomUUID?.() || `request-${Date.now()}`
}

function agentResponse(events, jsonMode = false, status = 200) {
  return jsonMode
    ? json({ contract: NAIBA_AGENT_CONTRACT, contractVersion: NAIBA_AGENT_CONTRACT_VERSION, events }, status)
    : sse(events, status)
}

function requestAborted(request) {
  return Boolean(request?.signal?.aborted)
}

function abortedResponse() {
  return new Response(null, { status: 499 })
}

function localAnswer(message, recommendation = {}, decision = null) {
  return buildNaibaLocalAnswer(message, { recommendation, decision, locale: 'zh-CN' })
}

function validTimezone(value, fallback = 'Asia/Shanghai') {
  const candidate = String(value || '').trim()
  if (!candidate) return fallback
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format()
    return candidate
  } catch {
    return fallback
  }
}

function uniqueStrings(value, limit = 40) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => String(item || '').trim()).filter(Boolean))].slice(0, limit)
}

function exploreContent(requested) {
  if (requested?.contentType !== 'disease' || !requested?.contentId) return null
  const disease = DISEASE_TOPICS.find((item) => item.id === requested.contentId)
  if (!disease) return null
  return {
    type: 'disease',
    id: disease.id,
    available: true,
    version: DISEASE_CONTENT_VERSION,
    name: disease.name,
    shortDefinition: disease.shortDefinition,
    definition: disease.definition,
    observation: disease.observation,
    escalationRuleRef: disease.escalationRuleRef,
    sourceIds: disease.sourceIds,
  }
}

async function loadAuthorizedContext(env, principalOrAccountId, babyId, requestedPageContext = null) {
  const baby = await accessibleBaby(env, principalOrAccountId, babyId)
  if (!baby || baby.status === 'detached') return null
  const resourceIds = uniqueStrings(requestedPageContext?.resourceIds)
  const selectedEventsQuery = resourceIds.length
    ? env.DB.prepare(`SELECT * FROM care_events WHERE baby_id = ? AND id IN (${resourceIds.map(() => '?').join(',')}) AND status != 'voided'`).bind(baby.id, ...resourceIds).all()
    : Promise.resolve({ results: [] })
  const [rows, selectedRows, growthRows, planRows, concernRows] = await Promise.all([
    env.DB.prepare(`
      SELECT * FROM care_events
      WHERE baby_id = ? AND status != 'voided'
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT 60
    `).bind(baby.id).all(),
    selectedEventsQuery,
    env.DB.prepare(`
      SELECT * FROM care_events
      WHERE baby_id = ? AND category = 'growth_measurement' AND status != 'voided'
      ORDER BY occurred_at ASC, created_at ASC
    `).bind(baby.id).all(),
    env.DB.prepare('SELECT * FROM care_plan_items WHERE baby_id = ? ORDER BY due_at, created_at').bind(baby.id).all(),
    env.DB.prepare('SELECT * FROM concerns WHERE baby_id = ? ORDER BY updated_at').bind(baby.id).all(),
  ])
  const events = [...(rows.results || []), ...(selectedRows.results || [])]
    .reduce((result, row) => result.some((item) => item.id === row.id) ? result : result.concat(row), [])
    .map(eventFromRow).filter(Boolean)
  return {
    baby,
    careEvents: events.sort((left, right) => String(left.occurredAt || '').localeCompare(String(right.occurredAt || ''))),
    growthEvents: (growthRows.results || []).map(eventFromRow).filter(Boolean),
    carePlanItems: (planRows.results || []).map(planFromRow).filter(Boolean),
    concerns: (concernRows.results || []).map(concernFromRow).filter(Boolean),
    exploreContent: exploreContent(requestedPageContext),
  }
}

export function authorizedPageContext(requested, context, now = new Date()) {
  if (!requested) return null
  const allowedFocus = {
    today: new Set(['analysis', 'feeding', 'plan']),
    record: new Set(['timeline']),
    growth: new Set(['trend', 'weight', 'length', 'headCircumference']),
    explore: new Set(['current-topic']),
  }
  const timezone = validTimezone(requested.timezone)
  const currentDay = localDayForTimezone(now.toISOString(), timezone)
  const requestedDay = /^\d{4}-\d{2}-\d{2}$/.test(String(requested.selectedDay || '')) ? String(requested.selectedDay) : ''
  if ((requested.source === 'today' || requested.source === 'record') && requestedDay && requestedDay !== currentDay) return null
  const dayScoped = requested.source === 'today' || requested.source === 'record'
  const selectedDay = dayScoped ? currentDay : ''
  const resourceIds = new Set(uniqueStrings(requested.resourceIds))
  const matchesRequestedPage = (event) => localDayForTimezone(event.occurredAt || event.recordedAt, timezone) === selectedDay
    && (resourceIds.size === 0 || resourceIds.has(String(event.id)))
  const pageContext = {
    source: requested.source,
    focus: allowedFocus[requested.source]?.has(requested.focus) ? requested.focus : '',
    timezone,
    ...(dayScoped ? { selectedDay } : {}),
    ...(resourceIds.size ? { resourceIds: [...resourceIds] } : {}),
  }
  const compactEvent = (event) => ({ id: event.id, category: event.category, occurredAt: event.occurredAt, payload: event.payload, status: event.status })
  if (requested.source === 'today') {
    const facts = context.careEvents.filter(matchesRequestedPage).slice(-16)
    return { ...pageContext, facts: facts.map(compactEvent), usedEventIds: facts.map((event) => event.id), ...(requested.focus === 'plan' ? { plans: context.carePlanItems.slice(0, 20) } : {}) }
  }
  if (requested.source === 'record') {
    const facts = context.careEvents.filter(matchesRequestedPage).slice(-16)
    return { ...pageContext, facts: facts.map(compactEvent), usedEventIds: facts.map((event) => event.id) }
  }
  if (requested.source === 'growth') {
    const measurements = context.growthEvents.filter((event) => resourceIds.size === 0 || resourceIds.has(String(event.id))).slice(-16)
    return { ...pageContext, measurements: measurements.map(compactEvent), usedEventIds: measurements.map((event) => event.id) }
  }
  if (requested.source === 'explore' && context.exploreContent?.type === 'disease' && context.exploreContent.available === true) return { ...pageContext, content: context.exploreContent }
  return null
}

export const SAFE_DECISION_FACT_KEYS = Object.freeze([...DECISION_INPUT_FACT_KEYS])
const SAFE_DECISION_FACT_KEY_SET = new Set(SAFE_DECISION_FACT_KEYS)
if (!DECISION_REQUIRED_FACT_KEYS.every((key) => SAFE_DECISION_FACT_KEY_SET.has(key))) throw new Error('decision-fact-allowlist-drift')

export function safeDecisionFacts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => SAFE_DECISION_FACT_KEY_SET.has(key) && (item === null || typeof item === 'number' || typeof item === 'boolean' || (typeof item === 'string' && item.length <= 80))))
}

function positiveLimit(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function usageEstimate(message, imageCount = 0) {
  return Math.max(256, Math.ceil((String(message || '').length + 2_000) / 4) + Math.max(0, imageCount) * 1_000)
}

async function consumeUsageWindow(env, scopeKey, { accountId = null, babyId = null, day, estimate, requestLimit, tokenLimit, now }) {
  const result = await env.DB.prepare(`
    INSERT INTO ai_usage_windows (scope_key, account_id, baby_id, window_start, request_count, token_estimate, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(scope_key) DO UPDATE SET
      request_count = request_count + 1,
      token_estimate = token_estimate + ?,
      updated_at = ?
    WHERE request_count < ? AND token_estimate + ? <= ?
  `).bind(scopeKey, accountId, babyId, day, estimate, now, estimate, now, requestLimit, estimate, tokenLimit).run()
  return Number(result?.meta?.changes || 0) > 0
}

export async function consumeNaibaQuota(env, accountId, babyId, message, now = new Date(), imageCount = 0) {
  const day = now.toISOString().slice(0, 10)
  const nowIso = now.toISOString()
  const estimate = usageEstimate(message, imageCount)
  const accountLimit = positiveLimit(env.NAIBA_DAILY_MESSAGE_LIMIT, 30)
  const babyLimit = positiveLimit(env.NAIBA_DAILY_BABY_MESSAGE_LIMIT, 30)
  const globalLimit = positiveLimit(env.NAIBA_GLOBAL_DAILY_MESSAGE_LIMIT, 500)
  const accountTokenLimit = positiveLimit(env.NAIBA_DAILY_TOKEN_BUDGET, 120_000)
  const globalTokenLimit = positiveLimit(env.NAIBA_GLOBAL_DAILY_TOKEN_BUDGET, 1_000_000)
  try {
    const accountAllowed = await consumeUsageWindow(env, `account:${accountId}:${day}`, { accountId, day, estimate, requestLimit: accountLimit, tokenLimit: accountTokenLimit, now: nowIso })
    if (!accountAllowed) return { allowed: false, reason: 'account_daily_limit' }
    const babyAllowed = await consumeUsageWindow(env, `baby:${accountId}:${babyId}:${day}`, { accountId, babyId, day, estimate, requestLimit: babyLimit, tokenLimit: accountTokenLimit, now: nowIso })
    if (!babyAllowed) return { allowed: false, reason: 'baby_daily_limit' }
    const globalAllowed = await consumeUsageWindow(env, `global:${day}`, { day, estimate, requestLimit: globalLimit, tokenLimit: globalTokenLimit, now: nowIso })
    if (!globalAllowed) return { allowed: false, reason: 'global_daily_limit' }
    return { allowed: true }
  } catch (error) {
    console.error('Naiba AI quota unavailable; using safe fallback', error)
    return { allowed: false, reason: 'quota_unavailable' }
  }
}

async function persistDecision(env, accountId, babyId, result) {
  if (!result) return null
  const id = newRequestId()
  try {
    await env.DB.prepare('INSERT INTO decision_results (id, baby_id, account_id, unit_id, unit_version, status, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, babyId, accountId, result.unitId, result.unitVersion, result.status, JSON.stringify(result), new Date().toISOString()).run()
    return id
  } catch (error) {
    console.error('Naiba AI decision persistence unavailable', error)
    return null
  }
}

function healthEpisodeSummary(row) {
  try {
    const summary = JSON.parse(String(row?.summary_json || '{}'))
    return summary && typeof summary === 'object' && !Array.isArray(summary) ? summary : {}
  } catch {
    return {}
  }
}

async function closeHealthEpisode(env, id, reason, now = new Date()) {
  if (!id) return
  try {
    const row = await env.DB.prepare('SELECT summary_json FROM health_episodes WHERE id = ? AND status = \'open\'').bind(id).first()
    const summary = { ...healthEpisodeSummary(row), state: 'closed', closeReason: reason, closedAt: now.toISOString() }
    await env.DB.prepare('UPDATE health_episodes SET status = \'closed\', summary_json = ?, updated_at = ? WHERE id = ? AND status = \'open\'').bind(JSON.stringify(summary), now.toISOString(), id).run()
  } catch (error) {
    console.error('Naiba AI health episode close unavailable', error)
  }
}

async function loadHealthEpisode(env, accountId, babyId, episodeId, now = new Date()) {
  if (!episodeId) return null
  try {
    const row = await env.DB.prepare('SELECT * FROM health_episodes WHERE id = ? AND baby_id = ? AND account_id = ? AND status = \'open\'').bind(episodeId, babyId, accountId).first()
    if (!row?.id) return null
    const updatedAt = Date.parse(row.updated_at)
    if (!Number.isFinite(updatedAt) || now.getTime() - updatedAt > 86_400_000) {
      await closeHealthEpisode(env, row.id, 'expired', now)
      return null
    }
    const summary = healthEpisodeSummary(row)
    return { id: row.id, topic: row.topic, facts: safeDecisionFacts(summary.facts), decision: summary.decision || null }
  } catch (error) {
    console.error('Naiba AI health episode load unavailable', error)
    return null
  }
}

async function saveHealthEpisode(env, accountId, babyId, episode, unitId, facts, result, now = new Date()) {
  if (!result || !unitId) return null
  const id = episode?.id || newRequestId()
  const open = result.status === 'needs_information'
  const summary = { topic: unitId, facts: safeDecisionFacts(facts), decision: result, state: open ? 'open' : 'closed', expiresAt: new Date(now.getTime() + 86_400_000).toISOString(), ...(!open ? { closeReason: result.status, closedAt: now.toISOString() } : {}) }
  try {
    if (episode?.id) {
      await env.DB.prepare('UPDATE health_episodes SET topic = ?, status = ?, summary_json = ?, updated_at = ? WHERE id = ? AND baby_id = ? AND account_id = ?').bind(unitId, open ? 'open' : 'closed', JSON.stringify(summary), now.toISOString(), id, babyId, accountId).run()
    } else {
      await env.DB.prepare('INSERT INTO health_episodes (id, baby_id, account_id, topic, status, summary_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, babyId, accountId, unitId, open ? 'open' : 'closed', JSON.stringify(summary), now.toISOString(), now.toISOString()).run()
    }
    return { id, topic: unitId, state: open ? 'open' : 'closed', facts: summary.facts }
  } catch (error) {
    console.error('Naiba AI health episode persistence unavailable', error)
    return null
  }
}

async function persistProvisionalEvidence(env, accountId, babyId, output) {
  const sources = Array.isArray(output) ? output : []
  if (!sources.length) return
  const now = new Date()
  try {
    await env.DB.prepare('INSERT INTO provisional_knowledge_evidence (id, account_id, baby_id, query, evidence_json, policy_status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, \'accepted_general\', ?, ?)')
      .bind(newRequestId(), accountId, babyId, 'naiba-authority-source', JSON.stringify({ sources, limitation: 'general_education_only' }), now.toISOString(), new Date(now.getTime() + 7 * 86_400_000).toISOString()).run()
  } catch (error) {
    console.error('Naiba AI provisional evidence persistence unavailable', error)
  }
}

function userTranscript(history, message) {
  return [...history.filter((item) => item.role === 'user').map((item) => item.text), message].join('\n')
}

const DECISION_SOURCE_KNOWLEDGE = Object.freeze({
  'who-essential-newborn-care-2024': 'newborn-temperature-breathing-danger',
  'who-newborn-jaundice-referral': 'newborn-jaundice-referral',
  'who-newborn-danger-signs': 'newborn-danger-signs',
  'cdc-safe-sleep-2024': 'infant-safe-sleep',
})

export function provenanceSources({ knowledge = [], recommendation, decision, includeRecommendation = false }) {
  const items = [
    ...knowledge.map((unit) => ({ id: unit.id, version: unit.packVersion, url: unit.source.url, title: unit.source.title, authority: unit.source.publisher, kind: unit.provisional ? 'external_knowledge' : 'knowledge', ...(unit.retrievedAt ? { retrievedAt: unit.retrievedAt } : {}) })),
    ...(includeRecommendation ? recommendation?.sources || [] : []).map((source) => ({ id: source.id, version: recommendation.knowledgeVersion, url: source.url, title: source.title, authority: source.authority, kind: 'feeding_rule' })),
  ]
  const decisionKnowledgeId = DECISION_SOURCE_KNOWLEDGE[decision?.source]
  const decisionUnit = decisionKnowledgeId ? knowledge.find((unit) => unit.id === decisionKnowledgeId) : null
  if (decisionUnit) items.push({ id: decisionUnit.id, version: decisionUnit.packVersion, url: decisionUnit.source.url, title: decisionUnit.source.title, authority: decisionUnit.source.publisher, kind: 'decision_rule' })
  return [...new Map(items.filter((item) => item.id && item.version && item.url).map((item) => [`${item.id}:${item.version}`, item])).values()]
}

export async function onRequestPost({ request, env }) {
  const jsonMode = String(request.headers.get('accept') || '').includes('application/json')
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

  const babyId = String(body?.babyId || body?.baby?.id || '').trim()
  if (!babyId) return json({ error: '缺少宝宝档案编号' }, 422)
  const requestId = newRequestId()
  const pageContext = normalizeNaibaContext(body?.context)
  let history
  try { history = normalizeNaibaHistory(body?.history) } catch { return json({ error: '当前对话上下文无效' }, 422) }
  let attachments
  try { attachments = normalizeNaibaAttachments(body?.attachments) } catch { return json({ error: '图片格式、大小或发送确认无效' }, 422) }
  const context = await loadAuthorizedContext(env, session, babyId, pageContext)
  if (!context) return json({ error: '无权访问该宝宝档案' }, 403)
  if (requestAborted(request)) return abortedResponse()
  const growthMetric = ['weight', 'length', 'headCircumference'].includes(String(body?.growthMetric || ''))
    ? String(body.growthMetric)
    : ['weight', 'length', 'headCircumference'].includes(String(pageContext?.focus || '')) ? String(pageContext.focus) : null
  const requestedSkillId = String(body?.skillId || '').slice(0, 120)
  const injectedPageContext = authorizedPageContext(pageContext, context)
  const transcript = userTranscript(history, message)
  const historyHasTopic = history.some((item) => item.role === 'user' && isNaibaTopicInScope(item.text))
  const extractedCurrentFacts = extractDecisionFacts(message)
  const requestedEpisodeId = String(body?.healthEpisodeId || '').trim().slice(0, 120)
  let healthEpisode = await loadHealthEpisode(env, session.accountId, context.baby.id, requestedEpisodeId)
  const contextualFollowUp = isNaibaContextualFollowUp(message) && (Boolean(pageContext) || historyHasTopic || Boolean(healthEpisode))
  const routingMessage = contextualFollowUp ? transcript : message
  const explicitSkill = getSkillContract(requestedSkillId)
  const currentSkillId = explicitSkill?.id || selectSkillId(message)
  const skillId = contextualFollowUp && currentSkillId === 'stage_parenting_qa' ? selectSkillId(routingMessage) : currentSkillId
  const skill = getSkillContract(skillId)
  const agentContext = resolveNaibaSkillContext({ skill, authorizedContext: context, pageContext: injectedPageContext })
  const agentCareEvents = agentContext.careEvents
  const agentGrowthEvents = agentContext.growthEvents
  const scopedRecommendation = calculateFeedingRecommendation({ baby: context.baby, events: agentCareEvents, locale: context.baby.locale || 'zh-CN' })
  const agentCarePlanItems = agentContext.carePlanItems
  const explicitTopicUnit = selectExplicitDecisionUnit(message)
  const healthSensitive = isCurrentBabyHealthComplaint(message)
  const healthFollowUp = Boolean(healthEpisode && (isNaibaContextualFollowUp(message) || Object.keys(extractedCurrentFacts).length > 0))
  if (healthEpisode && explicitTopicUnit && explicitTopicUnit !== healthEpisode.topic) {
    await closeHealthEpisode(env, healthEpisode.id, 'superseded')
    healthEpisode = null
  }
  const handlesHealth = healthSensitive || healthFollowUp || skillId === 'triage_and_preassessment'
  const decisionUnitId = handlesHealth ? (explicitTopicUnit || healthEpisode?.topic || selectDecisionUnit(message)) : ''
  if (!isNaibaTopicInScope(message) && !contextualFollowUp && !healthFollowUp) {
    return agentResponse([{ type: 'meta', contract: NAIBA_AGENT_CONTRACT, contractVersion: NAIBA_AGENT_CONTRACT_VERSION, requestId }, { type: 'message', delta: NAIBA_OUT_OF_SCOPE_MESSAGE }, { type: 'done' }], jsonMode)
  }
  // Health state is server-owned. Only allowlisted facts from the active
  // episode and current user turn can influence the deterministic kernel.
  const decisionFacts = { ...(healthEpisode?.facts || {}), ...extractedCurrentFacts, ageDays: getAgeDays(context.baby.birthDate) }
  if (decisionUnitId && healthEpisode?.decision?.status === 'needs_information' && healthEpisode.decision.nextQuestion) {
    const parsedAnswer = parseDecisionAnswer(healthEpisode.decision.nextQuestion.key, message)
    if (parsedAnswer !== null && parsedAnswer !== undefined) decisionFacts[healthEpisode.decision.nextQuestion.key] = parsedAnswer
  }
  const decision = decisionUnitId ? runDecisionUnit({ unitId: decisionUnitId, facts: decisionFacts }) : null
  if (requestAborted(request)) return abortedResponse()
  await persistDecision(env, session.accountId, context.baby.id, decision)
  const savedEpisode = await saveHealthEpisode(env, session.accountId, context.baby.id, healthEpisode, decisionUnitId, decisionFacts, decision)
  if (decision?.status === 'needs_information' && !savedEpisode) {
    return json({ error: { code: 'HEALTH_EPISODE_UNAVAILABLE', message: '预评估状态暂不可用，请重试。', retryable: true } }, 503)
  }
  const clientDecision = decision ? { ...decision, healthEpisodeId: savedEpisode?.id || null, healthEpisodeState: savedEpisode?.state || 'closed' } : null
  const usesFeedingReference = skillId === 'daily_feeding_recommender'
  const fallback = localAnswer(message, usesFeedingReference ? scopedRecommendation : {}, decision)
  const ageDays = getAgeDays(context.baby.birthDate)
  const ageMonths = Number.isFinite(ageDays) ? Math.floor(ageDays / 30.4375) : null
  // Retrieval is performed once. This exact result feeds the Agent prompt,
  // displayed sources, and persisted evidence so provenance cannot drift.
  let retrievedKnowledge = searchApprovedKnowledge(transcript, { ageDays, ageMonths })
  let sources = provenanceSources({ knowledge: retrievedKnowledge, recommendation: scopedRecommendation, decision, includeRecommendation: usesFeedingReference })
  let sourcesEvent = sources.length ? { type: 'sources', items: sources } : null
  let llmConfig
  let configUnavailable = false
  try {
    llmConfig = resolvedLlmConfig(env, await loadAccountLlmConfig(env, session.accountId))
  } catch (error) {
    configUnavailable = true
    console.error('Account LLM configuration failed closed', error)
  }
  async function respond(events) {
    return agentResponse([{ type: 'meta', contract: NAIBA_AGENT_CONTRACT, contractVersion: NAIBA_AGENT_CONTRACT_VERSION, requestId }, ...events], jsonMode)
  }

  const activity = { type: 'activity', skillId, label: getSkillContract(skillId)?.label || '奶爸 AI', status: 'completed' }
  if (decision && decision.status !== 'decision_ready') return respond([activity, { type: 'message', delta: fallback }, { type: 'decision', result: clientDecision }, ...(sourcesEvent ? [sourcesEvent] : []), { type: 'done' }])
  if (configUnavailable) return respond([{ type: 'meta', fallback: true, reason: 'account_config_unavailable' }, activity, { type: 'message', delta: fallback }, ...(clientDecision ? [{ type: 'decision', result: clientDecision }] : []), ...(sourcesEvent ? [sourcesEvent] : []), { type: 'done' }])
  if (!llmConfig.apiKey) return respond([{ type: 'meta', fallback: true, reason: 'model_not_configured' }, activity, { type: 'message', delta: fallback }, ...(clientDecision ? [{ type: 'decision', result: clientDecision }] : []), ...(sourcesEvent ? [sourcesEvent] : []), { type: 'done' }])

  const quotaText = [...history.map((item) => item.text), message].join('\n')
  const quota = await consumeNaibaQuota(env, session.accountId, context.baby.id, quotaText, new Date(), attachments.length + history.reduce((count, item) => count + (item.attachmentSummary?.length || 0), 0))
  if (!quota.allowed) return respond([{ type: 'meta', fallback: true, rateLimited: true, reason: quota.reason }, activity, { type: 'message', delta: fallback }, ...(clientDecision ? [{ type: 'decision', result: clientDecision }] : []), ...(sourcesEvent ? [sourcesEvent] : []), { type: 'done' }])

  const externalKnowledgeSkills = new Set(['authority_knowledge_retriever', 'stage_parenting_qa', 'disease_explainer'])
  if (!retrievedKnowledge.length && externalKnowledgeSkills.has(skillId)) {
    retrievedKnowledge = await searchAuthorityKnowledge(message, { apiKey: env.TAVILY_API_KEY, signal: request.signal })
    sources = provenanceSources({ knowledge: retrievedKnowledge, recommendation: scopedRecommendation, decision, includeRecommendation: usesFeedingReference })
    sourcesEvent = sources.length ? { type: 'sources', items: sources } : null
  }

  try {
    const output = await runNaibaAgent({
      message,
      history,
      skillId,
      baby: context.baby,
      careEvents: agentCareEvents,
      growthEvents: agentGrowthEvents,
      carePlanItems: agentCarePlanItems,
      concerns: agentContext.concerns,
      questions: [],
      feedingReference: usesFeedingReference ? scopedRecommendation : null,
      decisionResult: decision,
      retrievedKnowledge,
      pageContext: agentContext.pageContext,
      attachments,
      requestId,
      locale: context.baby.locale || 'zh-CN',
      model: llmConfig.model,
      apiKey: llmConfig.apiKey,
      baseURL: llmConfig.baseUrl,
      protocol: llmConfig.protocol,
      useResponses: llmConfig.useResponses,
      growthMetric,
      signal: request.signal,
    })
    if (requestAborted(request)) return abortedResponse()
    await persistProvisionalEvidence(env, session.accountId, context.baby.id, sources)
    return respond([activity, { type: 'message', delta: output }, ...(sourcesEvent ? [sourcesEvent] : []), ...(clientDecision ? [{ type: 'decision', result: clientDecision }] : []), { type: 'done' }])
  } catch (error) {
    if (requestAborted(request)) return abortedResponse()
    const failure = describeNaibaAgentFailure(error)
    console.error('Naiba AI agent failed; returning provider error', { ...failure, error })
    return respond([{ type: 'meta', fallback: true, reason: failure.reason }, activity, { type: 'message', delta: fallback }, ...(clientDecision ? [{ type: 'decision', result: clientDecision }] : []), ...(sourcesEvent ? [sourcesEvent] : []), { type: 'done' }])
  }
}
