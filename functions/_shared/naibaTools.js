import { tool } from '@openai/agents'
import { z } from 'zod'
import { buildBabyContextSummary } from '../../src/domain/naibaContext.js'
import { buildCaregiverHandoff, buildDailyGrowthPlan, buildDetailedCareAnalysis, buildGrowthInterpretation, buildVisitBrief, calculateCareStatistics, parseMedicalReportText } from '../../src/domain/naibaCapabilities.js'
import { parseCareEventDraft } from '../../src/domain/careEventDraft.js'
import { calculateFeedingRecommendation } from '../../src/domain/feedingRecommendation.js'
import { runDecisionUnit, runUniversalSafetyGate } from '../../src/domain/decisionKernel.js'
import { toolOutputAllowed } from '../../src/domain/naibaGuardrails.js'

function runtime(runContext) {
  return runContext?.context || {}
}

function guardToolResult(definition) {
  // Hosted provider tools (for example web search) expose only providerData;
  // their results are still covered by the agent output guardrail, but there
  // is no local invoke function to wrap.
  if (typeof definition?.invoke !== 'function') return definition
  const invoke = definition.invoke.bind(definition)
  return {
    ...definition,
    invoke: async (runContext, input, details) => {
      const result = await invoke(runContext, input, details)
      return toolOutputAllowed(result) ? result : { status: 'blocked', reason: 'tool_output_boundary' }
    },
  }
}

const getBabyContext = tool({
  name: 'get_baby_context',
  description: 'Return compact formal BabyContextSummary with provenance, missing facts, conflicts, and professional plans.',
  parameters: z.object({}),
  execute: (_input, runContext) => {
    const value = runtime(runContext)
    return buildBabyContextSummary(value)
  },
})

const getRecentCareEvents = tool({
  name: 'get_recent_care_events',
  description: 'Return active care facts from the requested recent hour window. Missing events are never zero.',
  parameters: z.object({ hours: z.number().int().min(1).max(168) }),
  execute: ({ hours }, runContext) => {
    const value = runtime(runContext)
    const cutoff = new Date(value.now || Date.now()).getTime() - hours * 3_600_000
    return (value.events || []).filter((event) => event.status === 'active' && new Date(event.occurredAt || event.recordedAt).getTime() >= cutoff)
  },
})

const getGrowthSeries = tool({
  name: 'get_growth_series',
  description: 'Return stored growth measurements and their existing deterministic evaluations.',
  parameters: z.object({}),
  execute: (_input, runContext) => buildGrowthInterpretation(runtime(runContext)),
})

const getFeedingProfile = tool({
  name: 'get_feeding_profile',
  description: 'Return feeding mode, known allergies, introduced foods, restrictions, and professional plan facts without guessing unknown fields.',
  parameters: z.object({}),
  execute: (_input, runContext) => {
    const value = runtime(runContext)
    const baby = value.baby || {}
    return { feedingMode: baby.feedingMode || null, allergies: baby.allergies || [], introducedFoods: baby.introducedFoods || [], dietaryRestrictions: baby.dietaryRestrictions || [], professionalPlans: buildBabyContextSummary(value).professionalPlans }
  },
})

const getActiveHealthConcerns = tool({
  name: 'get_active_health_concerns',
  description: 'Return active concern facts and source event ids.',
  parameters: z.object({}),
  execute: (_input, runContext) => buildBabyContextSummary(runtime(runContext)).activeConcerns,
})

const searchKnowledge = tool({
  name: 'search_approved_knowledge',
  description: 'Return the frozen approved knowledge units retrieved for this request, including claims, scope, limitations, and authority source.',
  parameters: z.object({ query: z.string().min(1).max(300), domain: z.string().max(40) }),
  execute: (_input, runContext) => runtime(runContext).localKnowledge || [],
})

const calculateStatistics = tool({
  name: 'calculate_care_statistics',
  description: 'Calculate 24h and 72h record statistics. Never turn missing records into zero.',
  parameters: z.object({}),
  execute: (_input, runContext) => calculateCareStatistics(runtime(runContext)),
})

const calculateFeedingReference = tool({
  name: 'calculate_feeding_reference',
  description: 'Calculate versioned feeding reference. This is never actual intake.',
  parameters: z.object({}),
  execute: (_input, runContext) => {
    const value = runtime(runContext)
    return calculateFeedingRecommendation({ baby: value.baby, events: value.events, now: value.now, locale: value.locale })
  },
})

const calculateGrowthStandard = tool({
  name: 'calculate_growth_standard',
  description: 'Return stored standards-based growth interpretation without model arithmetic.',
  parameters: z.object({}),
  execute: (_input, runContext) => buildGrowthInterpretation(runtime(runContext)),
})

const universalSafetyGate = tool({
  name: 'run_universal_safety_gate',
  description: 'Run deterministic danger-signal floor. Model cannot lower its minimum action.',
  parameters: z.object({ alertness: z.string(), breathing: z.string() }),
  execute: (facts) => runUniversalSafetyGate(facts),
})

const decisionUnit = tool({
  name: 'run_decision_unit',
  description: 'Run a published deterministic decision unit and return missing question, ready result, or minimum safety action.',
  parameters: z.object({ unitId: z.enum(['general_health_preassessment', 'feeding_change', 'temperature_abnormal', 'breathing_abnormal', 'jaundice_observation', 'safe_sleep']), factsJson: z.string().max(2_000) }),
  execute: ({ unitId, factsJson }) => {
    try { return runDecisionUnit({ unitId, facts: JSON.parse(factsJson) }) } catch { return { status: 'needs_information', missing: [{ key: 'validFacts', label: '可核对的事实' }], actions: [] } }
  },
})

const createDraft = tool({
  name: 'create_care_event_draft',
  description: 'Create an editable factual care-event draft. It does not save anything and always requires caregiver confirmation.',
  parameters: z.object({ message: z.string().min(1).max(1_000) }),
  execute: ({ message }, runContext) => {
    const value = runtime(runContext)
    return parseCareEventDraft({ message, baby: value.baby, actor: value.actor, now: new Date(value.now || Date.now()).toISOString(), locale: value.locale })
  },
})

const parseReport = tool({
  name: 'parse_medical_report',
  description: 'Extract checkable fields from report text. Preserve uncertainty; do not diagnose.',
  parameters: z.object({ name: z.string().max(200), text: z.string().min(1).max(20_000) }),
  execute: ({ name, text }, runContext) => parseMedicalReportText(text, { name, now: runtime(runContext).now }),
})

const buildDetailedAnalysis = tool({
  name: 'build_detailed_care_analysis',
  description: 'Build deterministic detailed analysis with no more than three actions.',
  parameters: z.object({}),
  execute: (_input, runContext) => buildDetailedCareAnalysis(runtime(runContext)),
})

const buildGrowthPlan = tool({
  name: 'build_daily_growth_plan',
  description: 'Build up to three stage-aware actions with reason and completion condition.',
  parameters: z.object({}),
  execute: (_input, runContext) => buildDailyGrowthPlan(runtime(runContext)),
})

const buildBrief = tool({
  name: 'build_visit_brief',
  description: 'Build a clinician-ready brief from confirmed facts and user questions only.',
  parameters: z.object({}),
  execute: (_input, runContext) => buildVisitBrief({ ...runtime(runContext), questions: runtime(runContext).questions || [] }),
})

const buildHandoff = tool({
  name: 'build_caregiver_handoff',
  description: 'Build handoff with facts, arrangements, and system notes separated.',
  parameters: z.object({}),
  execute: (_input, runContext) => buildCaregiverHandoff(runtime(runContext)),
})

const COMMON = [getBabyContext, getRecentCareEvents]
const SKILL_TOOLS = {
  baby_context_injector: [getBabyContext],
  authority_knowledge_retriever: [searchKnowledge],
  care_event_quick_logger: [createDraft],
  daily_care_analysis: [calculateStatistics],
  daily_feeding_recommender: [getFeedingProfile, calculateFeedingReference, searchKnowledge],
  detailed_care_analysis: [calculateStatistics, buildDetailedAnalysis],
  stage_parenting_qa: [searchKnowledge],
  disease_explainer: [searchKnowledge],
  triage_and_preassessment: [getActiveHealthConcerns, universalSafetyGate, decisionUnit, searchKnowledge],
  growth_and_development_interpreter: [getGrowthSeries, calculateGrowthStandard, searchKnowledge],
  daily_growth_plan_builder: [buildGrowthPlan, searchKnowledge],
  medical_report_interpreter: [parseReport],
  visit_brief_generator: [buildBrief],
  caregiver_handoff_builder: [buildHandoff],
}

export function createNaibaTools(skillId) {
  const selected = [...new Set([...COMMON, ...(SKILL_TOOLS[skillId] || [])])]
  return selected.map(guardToolResult)
}
