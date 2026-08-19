const CONTRACTS = [
  ['baby_context_injector', '宝宝上下文注入', 'system', ['baby', 'careEvents', 'concerns'], ['get_baby_context', 'get_recent_care_events'], 'BabyContextSummary', '只整理档案和事实，不做诊断'],
  ['authority_knowledge_retriever', '权威知识检索', 'support', ['topic', 'age'], ['search_approved_knowledge'], 'KnowledgeResult[]', '只返回 approved 版本化知识和来源'],
  ['daily_care_analysis', '今日照护分析', 'today', ['baby', 'careEvents'], ['calculate_care_statistics'], 'DailyCareAnalysis', '不把缺失当作零'],
  ['daily_feeding_recommender', '今日饮食建议', 'today', ['baby', 'feedingProfile', 'careEvents'], ['get_feeding_profile', 'calculate_feeding_reference', 'search_approved_knowledge'], 'FeedingRecommendation', '用量只来自 FeedingRuleSet'],
  ['detailed_care_analysis', '详细照护分析', 'analysis', ['babyContext', 'careEvents'], ['calculate_care_statistics', 'get_baby_context'], 'DetailedCareAnalysis', '最多三个可执行动作'],
  ['stage_parenting_qa', '阶段育儿问答', 'knowledge', ['babyContext', 'question'], ['search_approved_knowledge'], 'GroundedAnswer', '不以固定场景限制入口'],
  ['disease_explainer', '疾病概念解释', 'knowledge', ['age', 'question'], ['search_approved_knowledge'], 'DiseaseExplanation', '不转化为当前宝宝诊断'],
  ['triage_and_preassessment', '导诊与预评估', 'health', ['babyContext', 'facts'], ['run_universal_safety_gate', 'run_decision_unit'], 'DecisionResult', '信息不足不下结论'],
  ['growth_and_development_interpreter', '成长发育解读', 'growth', ['baby', 'growthSeries'], ['get_growth_series', 'calculate_growth_standard'], 'GrowthInterpretation', '计算与解释分离'],
  ['daily_growth_plan_builder', '每日成长计划', 'today', ['babyContext', 'professionalPlans'], ['get_baby_context', 'search_approved_knowledge'], 'GrowthPlan', '计划不替代健康行动'],
  ['medical_report_interpreter', '医疗报告解读', 'report', ['babyContext', 'report'], ['parse_medical_report'], 'MedicalReportDraft', 'OCR不确定值保持不确定'],
  ['visit_brief_generator', '就医摘要生成', 'summary', ['babyContext', 'careEvents', 'questions'], ['build_visit_brief'], 'VisitBrief', '不混入未确认推断'],
  ['caregiver_handoff_builder', '照护交接整理', 'handoff', ['babyContext', 'careEvents', 'professionalPlans'], ['build_caregiver_handoff'], 'CaregiverHandoff', '区分事实、安排和解释'],
]

const CONTEXT_POLICIES = Object.freeze({
  baby_context_injector: { careEvents: { windowHours: 72, limit: 40 }, concerns: true },
  authority_knowledge_retriever: {},
  daily_care_analysis: { careEvents: { windowHours: 24, limit: 40 }, pageSources: ['today', 'record'] },
  daily_feeding_recommender: { careEvents: { categories: ['breastfeeding', 'bottle_feeding'], windowHours: 72, limit: 40 }, plans: true, pageSources: ['today', 'record'] },
  detailed_care_analysis: { careEvents: { windowHours: 72, limit: 60 }, concerns: true, plans: true, pageSources: ['today', 'record'] },
  stage_parenting_qa: {},
  disease_explainer: { pageSources: ['explore'] },
  triage_and_preassessment: { careEvents: { categories: ['temperature', 'temperature_observation', 'symptom_observation', 'medication', 'health_visit'], windowHours: 72, limit: 30 }, concerns: true },
  growth_and_development_interpreter: { growthEvents: { limit: 80 }, pageSources: ['growth'] },
  daily_growth_plan_builder: { careEvents: { windowHours: 72, limit: 30 }, plans: true },
  medical_report_interpreter: {},
  visit_brief_generator: { careEvents: { windowHours: 168, limit: 60 }, concerns: true, plans: true },
  caregiver_handoff_builder: { careEvents: { windowHours: 72, limit: 60 }, concerns: true, plans: true },
})

export const NAIBA_SKILLS = Object.freeze(CONTRACTS.map(([id, label, entry, requiredContext, tools, outputSchema, boundary]) => Object.freeze({
  id,
  label,
  entry,
  requiredContext,
  contextPolicy: CONTEXT_POLICIES[id] || {},
  tools,
  outputSchema,
  safetyGate: id === 'triage_and_preassessment' ? 'deterministic_required' : 'preserve_global_floor',
  fallback: id === 'authority_knowledge_retriever' || id === 'stage_parenting_qa' || id === 'disease_explainer' ? 'state_knowledge_limit' : 'return_structured_limitation',
  boundary,
})))

const INTENT_PATTERNS = [
  { skillId: 'daily_feeding_recommender', pattern: /吃|奶|喂|饮食|辅食|用量|feed|milk|food|feeding|amount/i },
  { skillId: 'medical_report_interpreter', pattern: /报告|化验|检查单|report|lab/i },
  { skillId: 'visit_brief_generator', pattern: /就医摘要|问医生|就诊材料|visit brief/i },
  { skillId: 'caregiver_handoff_builder', pattern: /交接|换人照护|handoff/i },
  { skillId: 'daily_growth_plan_builder', pattern: /成长计划|今日计划|growth plan/i },
  { skillId: 'detailed_care_analysis', pattern: /详细分析|趋势分析|detailed analysis/i },
  { skillId: 'growth_and_development_interpreter', pattern: /体重|身长|头围|发育|成长|growth|weight|height/i },
  { skillId: 'disease_explainer', pattern: /是什么病|疾病|医学概念|病因|病理|症状|表现|disease|condition|etiology|pathology|symptom/i },
]

const BABY_SUBJECT_PATTERN = /宝宝|宝贝|婴儿|新生儿|孩子|小孩|我家(?:宝宝|孩子)?|娃|baby|infant|newborn|child|kid|my baby|my child/i
const HEALTH_OBSERVATION_PATTERN = /呼吸|喘(?:得|鸣)?|发热|发烧|体温\s*(?:是|为|:|：)?\s*\d|呕吐|吐奶|腹泻|拉稀|黄疸|发黄|发青|发紫|叫不醒|唤醒困难|嗜睡|出血|拒奶|不吃奶|吃奶(?:少|很少|减少)|吃得少|不吃饭|进食(?:减少|变少|差)|精神(?:差|不好)|抽搐|皮疹|疹子|咳嗽|鼻塞|疼痛|疼|趴睡|趴着(?:睡)?|侧睡|侧着(?:睡)?|同床|枕头|被子|safe sleep|breath(?:ing)?|fever|temperature\s*\d|vomit|diarrhea|jaundice|blue|cannot wake|drowsy|bleed|refuse(?:s)? feed|poor intake/i
const CONCRETE_HEALTH_OBSERVATION_PATTERN = /呼吸.{0,6}(?:急促|困难|费力|不顺|异常|很快)|喘(?:得|鸣)?|发热|发烧|体温\s*(?:是|为|:|：)?\s*\d|呕吐|吐奶|腹泻|拉稀|发青|发紫|叫不醒|唤醒困难|嗜睡|出血|拒奶|不吃奶|吃奶(?:少|很少|减少)|吃得少|不吃饭|进食(?:减少|变少|差)|精神(?:差|不好)|抽搐|皮疹|疹子|咳嗽|鼻塞|疼痛|疼|breath(?:ing)?\s*(?:fast|hard|difficult|labored)|fever|temperature\s*\d|vomit|diarrhea|blue|cannot wake|drowsy|bleed|refuse(?:s)? feed|poor intake/i
const HEALTH_CONCERN_PATTERN = /现在|当前|今天|刚刚|刚才|最近|这两天|出现|有点|突然|变得|一直|总是|反复|持续|越来越|看起来|摸起来|测到|测得|观察到|不舒服|异常|担心|着急|不对|有问题|怎么办|怎么处理|要不要|需要(?:就医|去医院|看医生)|严重|危险|不好|can't wake|now|today|recently|suddenly|always|worse|uncomfortable|worried|urgent|serious|dangerous|what should we do/i
const DIRECT_HEALTH_CONCERN_PATTERN = /不舒服|异常|担心|着急|不对|有问题|怎么办|怎么处理|要不要|需要(?:就医|去医院|看医生)|严重|危险|不好|can't wake|worried|urgent|serious|dangerous|what should we do/i
const GENERAL_PARENTING_TOPIC_PATTERN = /睡眠|睡觉|作息|哄睡|夜醒|哭闹|喂养|喂奶|吃奶|辅食|吃饭|饮食|排便|尿布|洗澡|睡眠|sleep|feeding|night waking|crying/i
const GENERAL_HEALTH_KNOWLEDGE_PATTERN = /什么是|是什么|病因|机制|原理|定义|概念|科普|知识|安全睡眠|睡眠安全|safe sleep|有哪些(?:表现|症状|原因|风险|方法)|(?:症状|表现)(?:有哪些|是什么)|如何|怎么|为什么|区别|what is|cause|etiology|mechanism|definition|symptom(?:s)?|how to/i
const DISEASE_KNOWLEDGE_PATTERN = /(?:黄疸|发热|发烧|呼吸|呕吐|腹泻|咳嗽|皮疹|疾病|感染|炎症|症状|病因|病理|表现).*(?:是什么|什么是|原因|机制|原理|怎么回事)|(?:什么是|what is).*(?:黄疸|发热|发烧|呼吸|呕吐|腹泻|咳嗽|皮疹|疾病|感染|炎症|症状|病因|病理|表现)/i

export function isCurrentBabyHealthComplaint(message = '') {
  const text = String(message).trim()
  if (!text) return false
  const hasBabySubject = BABY_SUBJECT_PATTERN.test(text)
  const hasHealthObservation = HEALTH_OBSERVATION_PATTERN.test(text)
  const hasConcreteObservation = CONCRETE_HEALTH_OBSERVATION_PATTERN.test(text)
  const hasCurrentConcern = HEALTH_CONCERN_PATTERN.test(text)
  const isGeneralKnowledge = GENERAL_HEALTH_KNOWLEDGE_PATTERN.test(text)

  // Conceptual questions must stay with knowledge skills unless the caregiver
  // also gives a current observation or asks for an immediate action.
  if (isGeneralKnowledge && !hasCurrentConcern && !(hasBabySubject && hasConcreteObservation)) return false
  if (hasHealthObservation && (hasCurrentConcern || hasBabySubject || !isGeneralKnowledge)) return true
  return hasBabySubject && DIRECT_HEALTH_CONCERN_PATTERN.test(text) && !GENERAL_PARENTING_TOPIC_PATTERN.test(text)
}

export function getNaibaSkill(skillId) {
  return NAIBA_SKILLS.find((skill) => skill.id === skillId) || null
}

export function selectNaibaSkill(message = '', explicitSkillId = '') {
  const text = String(message)
  if (isCurrentBabyHealthComplaint(text)) return getNaibaSkill('triage_and_preassessment')
  if (explicitSkillId && getNaibaSkill(explicitSkillId)) return getNaibaSkill(explicitSkillId)
  const match = INTENT_PATTERNS.find((item) => item.pattern.test(text))
  if (!match && DISEASE_KNOWLEDGE_PATTERN.test(text)) return getNaibaSkill('disease_explainer')
  if (!match && /不对|不舒服|担心|着急|救命|help|worried|something is wrong|not right/i.test(text)) return getNaibaSkill('triage_and_preassessment')
  return getNaibaSkill(match?.skillId || 'stage_parenting_qa')
}
