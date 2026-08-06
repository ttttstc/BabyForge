export function buildDoctorSummary(baby, observations = [], questions = [], generatedAt = new Date().toISOString(), extras = {}) {
  return {
    id: `summary-${generatedAt}`,
    generatedAt,
    baby: { ...baby, provenance: 'parent-entered' },
    timeline: [...observations].sort((a, b) =>
      String(a.firstNoticedAt || a.createdAt).localeCompare(String(b.firstNoticedAt || b.createdAt)),
    ),
    questions: questions.filter(Boolean),
    taskLogs: Array.isArray(extras.taskLogs) ? extras.taskLogs : [],
    growthMeasurements: Array.isArray(extras.growthMeasurements) ? extras.growthMeasurements : [],
    milestoneRecords: Array.isArray(extras.milestoneRecords) ? extras.milestoneRecords : [],
    careEvents: Array.isArray(extras.careEvents) ? extras.careEvents : [],
    disclaimer: '本摘要仅整理照护者填写的事实，不提供诊断、数值解释或就医分级。',
  }
}
