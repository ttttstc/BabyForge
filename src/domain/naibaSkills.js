const CONTRACTS = [
  ['baby_context_injector', '宝宝上下文注入', 'system', ['baby', 'careEvents', 'concerns'], ['get_baby_context', 'get_recent_care_events'], 'BabyContextSummary', '只整理档案和事实，不做诊断'],
  ['authority_knowledge_retriever', '权威知识检索', 'support', ['topic', 'age'], ['search_approved_knowledge'], 'KnowledgeResult[]', '只返回 approved 版本化知识和来源'],
  ['care_event_quick_logger', '照护事件快速记录', 'record', ['baby', 'actor', 'message'], ['create_care_event_draft'], 'CareEventDraft', '只生成待确认草稿'],
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

export const NAIBA_SKILLS = Object.freeze(CONTRACTS.map(([id, label, entry, requiredContext, tools, outputSchema, boundary]) => Object.freeze({
  id,
  label,
  entry,
  requiredContext,
  tools,
  outputSchema,
  safetyGate: id === 'triage_and_preassessment' ? 'deterministic_required' : 'preserve_global_floor',
  fallback: id === 'authority_knowledge_retriever' || id === 'stage_parenting_qa' || id === 'disease_explainer' ? 'state_knowledge_limit' : 'return_structured_limitation',
  boundary,
})))

const INTENT_PATTERNS = [
  { skillId: 'care_event_quick_logger', pattern: /记录|保存|录入|log|record/i },
  { skillId: 'daily_feeding_recommender', pattern: /吃|奶|喂|饮食|辅食|用量|feed|milk|food|feeding|amount/i },
  { skillId: 'medical_report_interpreter', pattern: /报告|化验|检查单|report|lab/i },
  { skillId: 'visit_brief_generator', pattern: /就医摘要|问医生|就诊材料|visit brief/i },
  { skillId: 'caregiver_handoff_builder', pattern: /交接|换人照护|handoff/i },
  { skillId: 'daily_growth_plan_builder', pattern: /成长计划|今日计划|growth plan/i },
  { skillId: 'detailed_care_analysis', pattern: /详细分析|趋势分析|detailed analysis/i },
  { skillId: 'growth_and_development_interpreter', pattern: /体重|身长|头围|发育|成长|growth|weight|height/i },
  { skillId: 'disease_explainer', pattern: /是什么病|疾病|医学概念|disease|condition/i },
]

export function getNaibaSkill(skillId) {
  return NAIBA_SKILLS.find((skill) => skill.id === skillId) || null
}

export function selectNaibaSkill(message = '', explicitSkillId = '') {
  if (/呼吸|发热|体温|呕吐|腹泻|黄疸|叫不醒|唤醒|嗜睡|发青|疼|出血|吃得少|拒奶|breath|fever|temperature|vomit|diarrhea|jaundice|blue|wake|pain|bleed/i.test(String(message))) return getNaibaSkill('triage_and_preassessment')
  if (explicitSkillId && getNaibaSkill(explicitSkillId)) return getNaibaSkill(explicitSkillId)
  const match = INTENT_PATTERNS.find((item) => item.pattern.test(String(message)))
  return getNaibaSkill(match?.skillId || 'stage_parenting_qa')
}
