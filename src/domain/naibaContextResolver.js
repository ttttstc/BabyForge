function withinWindow(event, windowHours, now) {
  if (!windowHours) return true
  const occurredAt = new Date(event?.occurredAt || event?.recordedAt).getTime()
  return Number.isFinite(occurredAt) && occurredAt >= now.getTime() - windowHours * 3_600_000
}

function selectEvents(events, policy = {}, now = new Date()) {
  const categories = new Set(policy.categories || [])
  const filtered = (events || []).filter((event) => (!categories.size || categories.has(event.category)) && withinWindow(event, policy.windowHours, now))
  return filtered.slice(-Math.max(0, Number(policy.limit) || filtered.length))
}

export function resolveNaibaSkillContext({ skill, authorizedContext, pageContext = null, now = new Date() }) {
  const policy = skill?.contextPolicy || {}
  const allowedPage = pageContext && (policy.pageSources || []).includes(pageContext.source) ? pageContext : null
  const usedEventIds = new Set(allowedPage?.usedEventIds || [])
  const pageCareEvents = allowedPage && policy.careEvents ? selectEvents(authorizedContext.careEvents.filter((event) => usedEventIds.has(event.id)), policy.careEvents, now) : null
  const pageGrowthEvents = allowedPage && policy.growthEvents ? selectEvents(authorizedContext.growthEvents.filter((event) => usedEventIds.has(event.id)), policy.growthEvents, now) : null
  return {
    careEvents: pageCareEvents || (policy.careEvents ? selectEvents(authorizedContext.careEvents, policy.careEvents, now) : []),
    growthEvents: pageGrowthEvents || (policy.growthEvents ? selectEvents(authorizedContext.growthEvents, policy.growthEvents, now) : []),
    carePlanItems: policy.plans ? authorizedContext.carePlanItems : [],
    concerns: policy.concerns ? authorizedContext.concerns : [],
    pageContext: allowedPage,
  }
}
