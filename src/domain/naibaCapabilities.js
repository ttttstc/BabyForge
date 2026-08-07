import { getAgeDays } from './baby.js'
import { projectBabyState } from './babyState.js'
import { createCareEvent } from './careEvents.js'
import { getCareSnapshot, eventTitle } from './careSummary.js'
import { parseCareEventDraft, sanitizeMedicalReport } from './careEventDraft.js'
import { calculateFeedingRecommendation } from './feedingRecommendation.js'
import { searchApprovedKnowledge } from './knowledgePack.js'
import { buildBabyContextSummary } from './naibaContext.js'
import { runDecisionUnit } from './decisionKernel.js'

const HOUR_MS = 3_600_000

function asTime(value) {
  const time = new Date(value || 0).getTime()
  return Number.isFinite(time) ? time : 0
}

function activeWithin(events, now, hours) {
  const cutoff = asTime(now) - hours * HOUR_MS
  return events.filter((event) => event?.status === 'active' && asTime(event.occurredAt || event.recordedAt) >= cutoff)
}

function countCategory(events, category) {
  return events.filter((event) => event.category === category).length
}

export function calculateCareStatistics({ events = [], concerns = [], now = new Date() } = {}) {
  const recent24h = activeWithin(events, now, 24)
  const recent72h = activeWithin(events, now, 72)
  const snapshot = getCareSnapshot(events, concerns, now)
  return {
    generatedAt: new Date(now).toISOString(),
    coverage: { recent24h: recent24h.length, recent72h: recent72h.length, status: recent24h.length >= 4 ? 'usable' : recent24h.length ? 'limited' : 'missing' },
    recent24h: {
      feedingCount: snapshot.metrics.feedingCount,
      bottleMl: snapshot.metrics.bottleMl,
      wetDiaperCount: snapshot.metrics.wetDiaperCount,
      stoolCount: snapshot.metrics.stoolCount,
      temperatureCount: countCategory(recent24h, 'temperature'),
      symptomCount: countCategory(recent24h, 'symptom_observation'),
    },
    recent72h: {
      feedingCount: recent72h.filter((event) => event.category === 'bottle_feeding' || event.category === 'breastfeeding').length,
      wetDiaperCount: recent72h.filter((event) => event.category === 'diaper' && ['urine', 'both'].includes(event.payload?.kind)).length,
      sourceEventIds: recent72h.map((event) => event.id),
    },
  }
}

export function buildDailyCareAnalysis({ events = [], concerns = [], now = new Date(), locale = 'zh-CN' } = {}) {
  const isEnglish = locale === 'en-US'
  const stats = calculateCareStatistics({ events, concerns, now })
  if (stats.coverage.status === 'missing') {
    return { status: 'needs_information', title: isEnglish ? 'Not enough records yet' : '今天还缺照护记录', summary: isEnglish ? 'No recent fact is treated as zero.' : '没有近期事实，系统不会把缺失记录当作 0。', actions: [isEnglish ? 'Record one actual feed or diaper event.' : '先记录一次实际喂养或尿便。'], stats }
  }
  const feedingText = stats.recent24h.feedingCount
    ? (isEnglish ? `${stats.recent24h.feedingCount} feeding events were recorded in 24 hours.` : `过去 24 小时记录了 ${stats.recent24h.feedingCount} 次喂养。`)
    : (isEnglish ? 'No feeding event was recorded; this does not mean no feeding occurred.' : '未记录喂养，不代表没有发生喂养。')
  const diaperText = stats.recent24h.wetDiaperCount
    ? (isEnglish ? `${stats.recent24h.wetDiaperCount} wet diapers were recorded.` : `记录了 ${stats.recent24h.wetDiaperCount} 次湿尿布。`)
    : (isEnglish ? 'Wet-diaper coverage is missing.' : '湿尿布记录不足。')
  return { status: stats.coverage.status === 'usable' ? 'ready' : 'limited', title: isEnglish ? 'Today’s care facts' : '今天的照护事实', summary: `${feedingText}${diaperText}`, actions: stats.coverage.status === 'limited' ? [isEnglish ? 'Continue recording actual events before reading a trend.' : '继续记录实际事件后再观察趋势。'] : [], stats }
}

export function buildDetailedCareAnalysis({ baby, events = [], concerns = [], now = new Date(), locale = 'zh-CN' } = {}) {
  const isEnglish = locale === 'en-US'
  const context = buildBabyContextSummary({ baby, events, concerns, now })
  const snapshot = projectBabyState({ baby, events, concerns, now })
  const daily = buildDailyCareAnalysis({ baby, events, concerns, now, locale })
  const changes = snapshot.current?.changes || []
  const actions = []
  if (daily.stats.coverage.status !== 'usable') actions.push(isEnglish ? 'Add actual feeding and diaper events; missing entries are not zero.' : '补记实际喂养和尿便；缺失记录不按 0 处理。')
  if (snapshot.current?.conflicts?.length) actions.push(isEnglish ? 'Confirm conflicting caregiver observations before using them.' : '先核对照护者之间冲突的观察。')
  if (context.activeConcerns.length) actions.push(isEnglish ? 'Keep the active concern timeline and clinician questions together.' : '把当前关注事项、时间线和咨询问题放在一起。')
  if (!actions.length) actions.push(isEnglish ? 'Continue the same recording method so future comparisons stay comparable.' : '保持相同记录口径，便于后续可比。')
  return {
    status: daily.status,
    currentSituation: daily.summary,
    trend: changes.length ? changes.map((item) => item.message).join(' ') : (isEnglish ? 'No reliable personal trend is available yet.' : '暂时没有足够可靠的个人趋势。'),
    possibleReasons: daily.stats.coverage.status === 'usable' ? [isEnglish ? 'A change may reflect care timing or the baby’s state; records alone cannot identify a disease cause.' : '变化可能与记录时段或宝宝当时状态有关；仅凭记录不能确定疾病原因。'] : [isEnglish ? 'Record coverage is the main limitation.' : '当前主要限制是记录覆盖不足。'],
    actions: actions.slice(0, 3),
    escalation: context.activeConcerns.length ? (isEnglish ? 'If a new danger sign appears, start health preassessment immediately.' : '出现新的危险信号时，立即进入健康预评估。') : null,
    usedFacts: context.recentKeyFacts,
    limitations: context.missingCriticalFacts,
  }
}

export function buildDailyGrowthPlan({ baby, events = [], concerns = [], carePlanItems = [], now = new Date(), locale = 'zh-CN' } = {}) {
  const isEnglish = locale === 'en-US'
  const context = buildBabyContextSummary({ baby, events, concerns, carePlanItems, now })
  const ageDays = context.profile.ageDays
  const plans = []
  if (context.baseline.coverage === 'none' || context.baseline.coverage === 'low') {
    plans.push({ id: 'record-baseline', reason: isEnglish ? 'Personal baseline coverage is low.' : '个人基线覆盖不足。', action: isEnglish ? 'Record one actual feed and one diaper event.' : '记录一次实际喂养和一次尿便。', completion: isEnglish ? 'Both facts are saved.' : '两条事实均已保存。' })
  }
  if (Number.isFinite(ageDays) && ageDays <= 28) {
    plans.push({ id: 'newborn-interaction', reason: isEnglish ? 'Newborns learn through calm face, voice, and touch.' : '新生儿通过安静的注视、声音和触摸建立互动。', action: isEnglish ? 'During one calm awake period, talk and make eye contact for a few minutes.' : '在一次安静清醒时段，进行几分钟说话和对视。', completion: isEnglish ? 'One calm interaction is completed.' : '完成一次安静互动。' })
    plans.push({ id: 'safe-sleep-check', reason: isEnglish ? 'Sleep environment is a daily safety condition.' : '睡眠环境是每天都需要核对的安全条件。', action: isEnglish ? 'Check back sleeping, a firm flat separate surface, and no soft objects.' : '核对仰卧、独立坚实平坦睡面、睡眠区无柔软物。', completion: isEnglish ? 'All three conditions are confirmed.' : '三个条件均已确认。' })
  } else {
    plans.push({ id: 'stage-play', reason: isEnglish ? 'Age-appropriate interaction supports development.' : '与年龄匹配的互动有助于发展。', action: isEnglish ? 'Choose one age-appropriate talk, read, or movement activity.' : '选择一次符合月龄的说话、阅读或动作互动。', completion: isEnglish ? 'One activity is completed.' : '完成一次活动。' })
  }
  if (context.professionalPlans.length) {
    plans.unshift({ id: 'professional-plan', reason: isEnglish ? 'An active professional plan takes priority.' : '已有专业安排，应优先执行。', action: context.professionalPlans[0].text, completion: isEnglish ? 'Mark according to the professional plan.' : '按专业安排记录完成情况。' })
  }
  return { status: 'ready', date: new Date(now).toISOString().slice(0, 10), plans: plans.slice(0, 3), source: Number.isFinite(ageDays) && ageDays <= 28 ? 'NHC early-development guidance + BabyForge facts' : 'BabyForge stage plan + BabyForge facts', usedFacts: context.recentKeyFacts }
}

export function buildGrowthInterpretation({ baby, events = [], locale = 'zh-CN' } = {}) {
  const isEnglish = locale === 'en-US'
  const measurements = events.filter((event) => event.status === 'active' && event.category === 'growth_measurement').sort((a, b) => asTime(b.occurredAt) - asTime(a.occurredAt))
  if (!measurements.length) return { status: 'needs_information', summary: isEnglish ? 'No growth measurement is available.' : '还没有成长测量记录。', measurements: [] }
  const latest = measurements[0]
  const evaluation = latest.payload?.evaluation || latest.payload?.reference || null
  return {
    status: evaluation ? 'ready' : 'limited',
    summary: evaluation ? (isEnglish ? 'The latest measurement keeps its stored standard evaluation.' : '最近一次测量沿用已保存的标准评价。') : (isEnglish ? 'The measurement is shown as a fact; no reference conclusion is invented.' : '只展示测量事实，不补造标准结论。'),
    measurements: measurements.slice(0, 6).map((event) => ({ id: event.id, occurredAt: event.occurredAt, type: event.payload?.type, value: event.payload?.value, unit: event.payload?.unit, evaluation: event.payload?.evaluation || null })),
    ageBasis: baby?.growthAgeBasis || 'chronological',
  }
}

export function parseMedicalReportText(text = '', { name = 'report', now = new Date() } = {}) {
  const sourceText = String(text || '').trim()
  if (!sourceText) return { status: 'needs_information', fields: [], uncertainties: ['报告内容为空。'] }
  const lines = sourceText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const fields = []
  for (const line of lines) {
    const match = line.match(/^([^:：\d]{1,40})[:：\s]+([<>≤≥+-]?\d+(?:\.\d+)?)\s*([^\s,，;；]*)\s*(?:参考(?:范围|值)?[:：\s]*([^,，;；]+))?$/i)
    if (!match) continue
    fields.push({ name: match[1].trim(), value: match[2], unit: match[3] || null, referenceRange: match[4]?.trim() || null, confidence: match[4] ? 'high' : 'medium', sourceLine: line })
  }
  return sanitizeMedicalReport({
    status: fields.length ? 'draft_ready' : 'needs_information',
    reportName: name,
    extractedAt: new Date(now).toISOString(),
    fields,
    uncertainties: fields.length ? fields.filter((field) => !field.referenceRange).map((field) => `${field.name}：未识别参考范围`) : ['未识别出可核对的“项目、数值、单位”结构。'],
    questionsForClinician: fields.slice(0, 3).map((field) => `${field.name} 的结果需要结合宝宝年龄和本次就诊背景如何理解？`),
  })
}

export function createReportFactDraft({ report, baby, actor, now = new Date().toISOString() } = {}) {
  const safeReport = sanitizeMedicalReport(report)
  if (!safeReport?.fields?.length) return { status: 'needs_information', question: '报告中还没有可核对字段，不能生成事实草稿。' }
  const event = createCareEvent({
    babyId: baby?.id,
    kind: 'measurement',
    category: 'medical_report_observation',
    occurredAt: now,
    recordedAt: now,
    actor,
    source: 'clinical_record',
    payload: { reportName: safeReport.reportName, fields: safeReport.fields, uncertainties: safeReport.uncertainties, extractedAt: safeReport.extractedAt },
  }, { now })
  return { type: 'care_event', status: 'draft_ready', title: '报告字段事实', summary: `识别 ${safeReport.fields.length} 个字段，确认后写入`, event, needsConfirmation: true }
}

export function buildVisitBrief({ baby, events = [], concerns = [], questions = [], now = new Date(), locale = 'zh-CN' } = {}) {
  const isEnglish = locale === 'en-US'
  const context = buildBabyContextSummary({ baby, events, concerns, now })
  return {
    generatedAt: new Date(now).toISOString(),
    baby: { nickname: baby?.nickname, ageDays: context.profile.ageDays, gestationalAgeAtBirth: context.profile.gestationalAgeAtBirth },
    facts: context.recentKeyFacts.slice(0, 12),
    activeConcerns: context.activeConcerns,
    professionalPlans: context.professionalPlans,
    questions: questions.filter(Boolean),
    missing: context.missingCriticalFacts,
    disclaimer: isEnglish ? 'Caregiver-entered facts only. No diagnosis or triage level is added.' : '只整理照护事实，不附加诊断或就医分级。',
  }
}

export function buildCaregiverHandoff({ baby, events = [], concerns = [], carePlanItems = [], now = new Date(), locale = 'zh-CN' } = {}) {
  const isEnglish = locale === 'en-US'
  const context = buildBabyContextSummary({ baby, events, concerns, carePlanItems, now })
  const recent = activeWithin(events, now, 24).sort((a, b) => asTime(b.occurredAt) - asTime(a.occurredAt))
  return {
    generatedAt: new Date(now).toISOString(),
    facts: recent.slice(0, 12).map((event) => ({ id: event.id, time: event.occurredAt, text: eventTitle(event, locale), recorder: event.actor?.displayName || null })),
    concerns: context.activeConcerns,
    arrangements: context.professionalPlans,
    systemNotes: context.missingCriticalFacts.length ? [isEnglish ? `Missing: ${context.missingCriticalFacts.join(', ')}` : `仍缺：${context.missingCriticalFacts.join('、')}`] : [],
    disclaimer: isEnglish ? 'Facts, arrangements, and system notes are kept separate.' : '事实、安排和系统说明保持分开。',
  }
}

export function executeNaibaSkill(skillId, input = {}, runtime = {}) {
  const common = { baby: runtime.baby, events: runtime.events || [], concerns: runtime.concerns || [], carePlanItems: runtime.carePlanItems || [], now: runtime.now || new Date(), locale: runtime.locale || 'zh-CN' }
  switch (skillId) {
    case 'baby_context_injector': return buildBabyContextSummary(common)
    case 'authority_knowledge_retriever': return { status: 'ready', results: searchApprovedKnowledge(input.query || '', { ageDays: getAgeDays(runtime.baby?.birthDate, common.now), ageMonths: Math.floor(getAgeDays(runtime.baby?.birthDate, common.now) / 30.4375), domain: input.domain }) }
    case 'care_event_quick_logger': return parseCareEventDraft({ message: input.message, baby: runtime.baby, actor: runtime.actor, context: input.context, now: new Date(common.now).toISOString(), locale: common.locale })
    case 'daily_care_analysis': return buildDailyCareAnalysis(common)
    case 'daily_feeding_recommender': return calculateFeedingRecommendation({ baby: runtime.baby, events: common.events, now: common.now, locale: common.locale })
    case 'detailed_care_analysis': return buildDetailedCareAnalysis(common)
    case 'stage_parenting_qa':
    case 'disease_explainer': return { status: 'ready', results: searchApprovedKnowledge(input.query || input.message || '', { ageDays: getAgeDays(runtime.baby?.birthDate, common.now), ageMonths: Math.floor(getAgeDays(runtime.baby?.birthDate, common.now) / 30.4375), domain: input.domain }) }
    case 'triage_and_preassessment': return runDecisionUnit({ unitId: input.unitId || 'general_health_preassessment', facts: input.facts || {} })
    case 'growth_and_development_interpreter': return buildGrowthInterpretation(common)
    case 'daily_growth_plan_builder': return buildDailyGrowthPlan(common)
    case 'medical_report_interpreter': return parseMedicalReportText(input.text, { name: input.name, now: common.now })
    case 'visit_brief_generator': return buildVisitBrief({ ...common, questions: runtime.questions || [] })
    case 'caregiver_handoff_builder': return buildCaregiverHandoff(common)
    default: return { status: 'unsupported', reason: 'unknown_skill' }
  }
}
