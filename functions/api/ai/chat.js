import { getSession, json } from '../../_shared/auth.js'
import { accessibleBaby, concernFromRow, eventFromRow, planFromRow } from '../../_shared/care.js'
import { describeNaibaAgentFailure, runNaibaAgent } from '../../_shared/naibaAgent.js'
import { getSkillContract, selectSkillId } from '../../_shared/skillRegistry.js'
import { getAgeDays } from '../../../src/domain/baby.js'
import { calculateFeedingRecommendation } from '../../../src/domain/feedingRecommendation.js'
import { DECISION_INPUT_FACT_KEYS, DECISION_REQUIRED_FACT_KEYS, extractDecisionFacts, getDecisionUnit, runDecisionUnit, selectDecisionUnit, selectExplicitDecisionUnit } from '../../../src/domain/decisionKernel.js'
import { buildNaibaLocalAnswer } from '../../../src/domain/naibaLocalAnswer.js'
import { isNaibaContextualFollowUp, isNaibaTopicInScope, NAIBA_OUT_OF_SCOPE_MESSAGE } from '../../../src/domain/naibaScope.js'
import { searchApprovedKnowledge } from '../../../src/domain/knowledgePack.js'
import { DISEASE_CONTENT_VERSION, DISEASE_TOPICS, ORGAN_TOPICS } from '../../../src/content/diseaseRegistry.js'
import { localDayForTimezone } from '../../../src/domain/nativeToday.js'
import { loadAccountLlmConfig, resolvedLlmConfig } from '../../_shared/llmConfig.js'
import { NAIBA_AGENT_CONTRACT, NAIBA_AGENT_CONTRACT_VERSION, normalizeNaibaAttachments, normalizeNaibaContext, normalizeNaibaHistory } from '../../../src/domain/naibaAgentContract.js'
import { draftText, parseCareEventDraft } from '../../../src/domain/careEventDraft.js'

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
  if (!requested?.contentType || !requested?.contentId) return null
  if (requested.contentType === 'disease') {
    const disease = DISEASE_TOPICS.find((item) => item.id === requested.contentId)
    if (!disease) return { type: 'disease', id: requested.contentId, available: false }
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
  if (requested.contentType === 'organ') {
    const organ = ORGAN_TOPICS.find((item) => item.id === requested.contentId)
    if (!organ) return { type: 'organ', id: requested.contentId, available: false }
    return { type: 'organ', id: organ.id, available: true, version: DISEASE_CONTENT_VERSION, name: organ.name, description: organ.description, relatedDiseaseIds: organ.relatedDiseaseIds }
  }
  return { type: 'article', id: requested.contentId, available: false, reason: 'third_party_article_requires_server_verified_source' }
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
  const selectedDay = /^\d{4}-\d{2}-\d{2}$/.test(String(requested.selectedDay || ''))
    ? String(requested.selectedDay)
    : localDayForTimezone(now.toISOString(), timezone)
  const resourceIds = new Set(uniqueStrings(requested.resourceIds))
  const matchesRequestedPage = (event) => resourceIds.size > 0
    ? resourceIds.has(String(event.id))
    : localDayForTimezone(event.occurredAt || event.recordedAt, timezone) === selectedDay
  const pageContext = {
    source: requested.source,
    focus: allowedFocus[requested.source]?.has(requested.focus) ? requested.focus : '',
    selectedDay,
    timezone,
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
    const measurements = context.growthEvents.filter(matchesRequestedPage).slice(-16)
    return { ...pageContext, measurements: measurements.map(compactEvent), usedEventIds: measurements.map((event) => event.id) }
  }
  return { ...pageContext, content: context.exploreContent }
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

async function persistHealthEpisode(env, accountId, babyId, unitId, facts, result) {
  if (!result) return
  const now = new Date().toISOString()
  try {
    const existing = await env.DB.prepare('SELECT id FROM health_episodes WHERE baby_id = ? AND account_id = ? AND topic = ? AND status = \'open\' ORDER BY updated_at DESC LIMIT 1').bind(babyId, accountId, unitId).first()
    const summary = JSON.stringify({ facts, decision: result })
    if (existing?.id) await env.DB.prepare('UPDATE health_episodes SET summary_json = ?, updated_at = ? WHERE id = ?').bind(summary, now, existing.id).run()
    else await env.DB.prepare('INSERT INTO health_episodes (id, baby_id, account_id, topic, status, summary_json, created_at, updated_at) VALUES (?, ?, ?, ?, \'open\', ?, ?, ?)').bind(newRequestId(), babyId, accountId, unitId, summary, now, now).run()
  } catch (error) {
    console.error('Naiba AI health episode persistence unavailable', error)
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

const HEALTH_SENSITIVE_PATTERN = /呼吸|发热|体温|呕吐|腹泻|黄疸|叫不醒|唤醒|嗜睡|发青|疼|出血|吃得少|拒奶|疾病|病因|是什么病|症状|健康|睡眠|睡觉|仰卧|趴睡|侧睡|同床|枕头|被子|safe sleep|breath|fever|temperature|vomit|diarrhea|jaundice|blue|wake|pain|bleed|disease|symptom|health/i

function userTranscript(history, message) {
  return [...history.filter((item) => item.role === 'user').map((item) => item.text), message].join('\n')
}

function accumulatedDecisionFacts(history, message) {
  const historicalFacts = history.filter((item) => item.role === 'user').reduce((facts, item) => ({ ...facts, ...extractDecisionFacts(item.text) }), {})
  return { ...historicalFacts, ...extractDecisionFacts(message) }
}

const DECISION_SOURCE_KNOWLEDGE = Object.freeze({
  'who-essential-newborn-care-2024': 'newborn-temperature-breathing-danger',
  'who-newborn-jaundice-referral': 'newborn-jaundice-referral',
  'who-newborn-danger-signs': 'newborn-danger-signs',
  'cdc-safe-sleep-2024': 'infant-safe-sleep',
})

export function provenanceSources({ knowledge = [], recommendation, decision }) {
  const items = [
    ...knowledge.map((unit) => ({ id: unit.id, version: unit.packVersion, url: unit.source.url, title: unit.source.title, authority: unit.source.publisher, kind: 'knowledge' })),
    ...(recommendation?.sources || []).map((source) => ({ id: source.id, version: recommendation.knowledgeVersion, url: source.url, title: source.title, authority: source.authority, kind: 'feeding_rule' })),
  ]
  const decisionKnowledgeId = DECISION_SOURCE_KNOWLEDGE[decision?.source]
  const decisionUnit = decisionKnowledgeId ? knowledge.find((unit) => unit.id === decisionKnowledgeId) : null
  if (decisionUnit) items.push({ id: decisionUnit.id, version: decisionUnit.packVersion, url: decisionUnit.source.url, title: decisionUnit.source.title, authority: decisionUnit.source.publisher, kind: 'decision_rule' })
  return [...new Map(items.filter((item) => item.id && item.version && item.url).map((item) => [`${item.id}:${item.version}`, item])).values()]
}

const CARE_FACT_SKILLS = new Set(['daily_care_analysis', 'detailed_care_analysis', 'visit_brief_generator', 'caregiver_handoff_builder'])
const HEALTH_FACT_CATEGORIES = new Set(['temperature', 'temperature_observation', 'symptom_observation', 'medication', 'health_visit'])

export function scopeAgentContext(context, injectedPageContext, skillId = '', contextMode = 'auto') {
  if (contextMode === 'excluded') return { careEvents: [], growthEvents: [], carePlanItems: [], concerns: [], pageContext: null }
  if (contextMode === 'selected' && injectedPageContext) {
    const usedEventIds = new Set(injectedPageContext.usedEventIds || [])
    return {
      careEvents: context.careEvents.filter((event) => usedEventIds.has(event.id)),
      growthEvents: context.growthEvents.filter((event) => usedEventIds.has(event.id)),
      carePlanItems: injectedPageContext.source === 'today' && injectedPageContext.focus === 'plan' ? context.carePlanItems : [],
      concerns: [],
      pageContext: injectedPageContext,
    }
  }
  const careEvents = CARE_FACT_SKILLS.has(skillId)
    ? context.careEvents
    : skillId === 'daily_feeding_recommender'
      ? context.careEvents.filter((event) => ['breastfeeding', 'bottle_feeding'].includes(event.category))
      : skillId === 'triage_and_preassessment'
        ? context.careEvents.filter((event) => HEALTH_FACT_CATEGORIES.has(event.category))
        : []
  return {
    careEvents,
    growthEvents: skillId === 'growth_and_development_interpreter' ? context.growthEvents : [],
    carePlanItems: ['daily_growth_plan_builder', 'visit_brief_generator', 'caregiver_handoff_builder'].includes(skillId) ? context.carePlanItems : [],
    concerns: ['triage_and_preassessment', 'visit_brief_generator', 'caregiver_handoff_builder'].includes(skillId) ? context.concerns : [],
    pageContext: null,
  }
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
  const contextMode = body?.contextMode === 'excluded' ? 'excluded' : pageContext ? 'selected' : 'auto'
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
  const historyHasHealthTopic = HEALTH_SENSITIVE_PATTERN.test(transcript)
  const extractedCurrentFacts = extractDecisionFacts(message)
  const contextualFollowUp = isNaibaContextualFollowUp(message) && (Boolean(pageContext) || historyHasTopic || historyHasHealthTopic)
  const routingMessage = contextualFollowUp || historyHasHealthTopic ? transcript : message
  const skillId = selectSkillId(routingMessage, requestedSkillId)
  const agentContext = scopeAgentContext(context, injectedPageContext, skillId, contextMode)
  const agentCareEvents = agentContext.careEvents
  const agentGrowthEvents = agentContext.growthEvents
  const scopedRecommendation = calculateFeedingRecommendation({ baby: context.baby, events: agentCareEvents, locale: context.baby.locale || 'zh-CN' })
  const agentCarePlanItems = agentContext.carePlanItems
  const requestedDecisionUnitId = String(body?.decisionUnitId || '').trim()
  const explicitDecisionUnit = getDecisionUnit(requestedDecisionUnitId) ? requestedDecisionUnitId : ''
  const explicitTopicUnit = selectExplicitDecisionUnit(message)
  const healthSensitive = HEALTH_SENSITIVE_PATTERN.test(message)
  // Replay every bounded user turn deterministically. The model transcript is
  // not the state machine: the server owns the unit and the allowlisted facts.
  const decisionUnitId = explicitTopicUnit || explicitDecisionUnit || ((skillId === 'triage_and_preassessment' || healthSensitive || historyHasHealthTopic) ? selectDecisionUnit(transcript) : '')
  const accumulatedFacts = accumulatedDecisionFacts(history, message)
  const hasDecisionContext = Object.keys(accumulatedFacts).length > 0
  const decisionFollowUp = Boolean(decisionUnitId && historyHasHealthTopic && (isNaibaContextualFollowUp(message) || Object.keys(extractedCurrentFacts).length > 0))
  if (!isNaibaTopicInScope(message) && !contextualFollowUp && !decisionFollowUp && !(hasDecisionContext && isNaibaContextualFollowUp(message))) {
    return agentResponse([{ type: 'meta', contract: NAIBA_AGENT_CONTRACT, contractVersion: NAIBA_AGENT_CONTRACT_VERSION, requestId }, { type: 'message', delta: NAIBA_OUT_OF_SCOPE_MESSAGE }, { type: 'done' }], jsonMode)
  }
  // The browser may send a compatibility hint, but the safety state is
  // replayed from the bounded user transcript and the server-owned baby age.
  // Never let client-supplied facts override or add a decision fact.
  const decisionFacts = { ...accumulatedFacts, ageDays: getAgeDays(context.baby.birthDate) }
  const decision = decisionUnitId ? runDecisionUnit({ unitId: decisionUnitId, facts: decisionFacts }) : null
  if (requestAborted(request)) return abortedResponse()
  await persistDecision(env, session.accountId, context.baby.id, decision)
  await persistHealthEpisode(env, session.accountId, context.baby.id, decisionUnitId, decisionFacts, decision)
  const fallback = localAnswer(message, scopedRecommendation, decision)
  const ageDays = getAgeDays(context.baby.birthDate)
  const ageMonths = Number.isFinite(ageDays) ? Math.floor(ageDays / 30.4375) : null
  // Retrieval is performed once. This exact result feeds the Agent prompt,
  // displayed sources, and persisted evidence so provenance cannot drift.
  const retrievedKnowledge = searchApprovedKnowledge(transcript, { ageDays, ageMonths })
  const sources = provenanceSources({ knowledge: retrievedKnowledge, recommendation: scopedRecommendation, decision })
  const sourcesEvent = sources.length ? { type: 'sources', items: sources } : null
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
  if (skillId === 'care_event_quick_logger') {
    const draft = parseCareEventDraft({
      message: contextualFollowUp ? transcript : message,
      baby: context.baby,
      actor: { id: session.accountId, displayName: session.displayName || '家庭成员' },
      locale: context.baby.locale || 'zh-CN',
    })
    return respond([activity, { type: 'message', delta: draftText(draft, context.baby.locale || 'zh-CN') }, ...(draft.status === 'draft_ready' ? [{ type: 'draft', draft }] : []), { type: 'done' }])
  }
  if (skillId === 'triage_and_preassessment' && decision?.status !== 'decision_ready') return respond([activity, { type: 'message', delta: fallback }, { type: 'decision', result: decision }, ...(sourcesEvent ? [sourcesEvent] : []), { type: 'done' }])
  if (configUnavailable) return respond([{ type: 'meta', fallback: true, reason: 'account_config_unavailable' }, activity, { type: 'message', delta: fallback }, ...(decision ? [{ type: 'decision', result: decision }] : []), ...(sourcesEvent ? [sourcesEvent] : []), { type: 'done' }])
  if (!llmConfig.apiKey) return respond([{ type: 'meta', fallback: true, reason: 'model_not_configured' }, activity, { type: 'message', delta: fallback }, ...(decision ? [{ type: 'decision', result: decision }] : []), ...(sourcesEvent ? [sourcesEvent] : []), { type: 'done' }])

  const quotaText = [...history.map((item) => item.text), message].join('\n')
  const quota = await consumeNaibaQuota(env, session.accountId, context.baby.id, quotaText, new Date(), attachments.length + history.reduce((count, item) => count + (item.attachmentSummary?.length || 0), 0))
  if (!quota.allowed) return respond([{ type: 'meta', fallback: true, rateLimited: true, reason: quota.reason }, activity, { type: 'message', delta: fallback }, ...(decision ? [{ type: 'decision', result: decision }] : []), ...(sourcesEvent ? [sourcesEvent] : []), { type: 'done' }])

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
      feedingReference: scopedRecommendation,
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
    return respond([activity, { type: 'message', delta: output }, ...(sourcesEvent ? [sourcesEvent] : []), ...(decision ? [{ type: 'decision', result: decision }] : []), { type: 'done' }])
  } catch (error) {
    if (requestAborted(request)) return abortedResponse()
    const failure = describeNaibaAgentFailure(error)
    console.error('Naiba AI agent failed; returning provider error', { ...failure, error })
    return respond([{ type: 'meta', fallback: true, reason: failure.reason }, activity, { type: 'message', delta: fallback }, ...(decision ? [{ type: 'decision', result: decision }] : []), ...(sourcesEvent ? [sourcesEvent] : []), { type: 'done' }])
  }
}
