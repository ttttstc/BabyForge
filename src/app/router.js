import { useEffect, useState } from 'react'

export const ROUTES = {
  login: '#/login',
  onboarding: '#/onboarding',
  today: '#/today',
  records: '#/records',
  growth: '#/growth',
  growthChart: '#/growth/chart',
  growthStage: '#/growth/stage',
  growthHistory: '#/growth/history',
  health: '#/health',
  healthVaccines: '#/health/vaccines',
  healthDiseases: '#/health/diseases',
  healthOrgans: '#/health/organs',
  vaccines: '#/vaccines',
  // Kept as an internal alias while existing surfaces migrate to Growth.
  stage: '#/growth',
  jaundice: '#/topic/jaundice',
  pediatric: '#/topic/pediatric-diseases',
  experience: '#/experience',
  naibaAi: '#/naiba-ai',
  summary: '#/doctor-summary',
  settings: '#/settings',
}

export const RECORD_RETURN_ROUTES = Object.freeze([
  ROUTES.today,
  ROUTES.growth,
  ROUTES.growthChart,
  ROUTES.growthStage,
  ROUTES.growthHistory,
])

export const RECORD_PANEL_TYPES = Object.freeze([
  'feeding',
  'sleep',
  'diaper',
  'medication',
  'temperature',
  'growth',
  'basic',
  'illness',
  'care',
  'concern',
  'professional',
  'questions',
])

export const RECORD_METRIC_TYPES = Object.freeze(['weight', 'length', 'headCircumference'])

export const HEALTH_ROUTES = Object.freeze([
  ROUTES.healthVaccines,
  ROUTES.healthDiseases,
  ROUTES.healthOrgans,
])

const APP_RETURN_ROUTES = Object.freeze([
  ROUTES.today,
  ROUTES.records,
  ROUTES.growth,
  ROUTES.growthChart,
  ROUTES.growthStage,
  ROUTES.growthHistory,
  ...HEALTH_ROUTES,
  ROUTES.experience,
  ROUTES.summary,
  ROUTES.settings,
])

export function buildRecordRoute({ panel, metric, filter, date, event, mode, returnTo } = {}) {
  const params = new URLSearchParams()
  if (panel) params.set('panel', panel)
  if (metric && RECORD_METRIC_TYPES.includes(metric)) params.set('metric', metric)
  if (filter) params.set('filter', filter)
  if (date) params.set('date', date)
  if (event) params.set('event', event)
  if (mode) params.set('mode', mode)
  if (returnTo) params.set('returnTo', returnTo)
  const query = params.toString()
  return query ? `${ROUTES.records}?${query}` : ROUTES.records
}

export function resolveRecordReturnTo(value) {
  if (!value) return null
  const parsed = parseHashLocation(value)
  return RECORD_RETURN_ROUTES.includes(parsed.route) ? value : null
}

export function buildNaibaRoute({ returnTo, skill, unit, topic, capability } = {}) {
  const params = new URLSearchParams()
  if (returnTo) params.set('returnTo', returnTo)
  if (skill) params.set('skill', skill)
  if (unit) params.set('unit', unit)
  if (topic) params.set('topic', topic)
  if (capability) params.set('capability', capability)
  const query = params.toString()
  return query ? `${ROUTES.naibaAi}?${query}` : ROUTES.naibaAi
}

export function resolveNaibaReturnTo(value) {
  if (!value) return null
  const parsed = parseHashLocation(value)
  return APP_RETURN_ROUTES.includes(parsed.route) ? `${parsed.route}${parsed.search}` : null
}

const LEGACY_ROUTE_ALIASES = {
  [ROUTES.health]: ROUTES.healthVaccines,
  [ROUTES.vaccines]: ROUTES.healthVaccines,
  '#/stage': ROUTES.growth,
  '#/stage/newborn': ROUTES.growth,
}

export function navigate(route) {
  window.location.hash = route.slice(1)
}

function hashValue() {
  return globalThis.window?.location?.hash || ROUTES.onboarding
}

export function parseHashLocation(value = hashValue()) {
  const normalized = String(value || ROUTES.onboarding).startsWith('#') ? String(value || ROUTES.onboarding) : `#${value}`
  const [pathname, query = ''] = normalized.slice(1).split('?')
  const rawRoute = `#${pathname || ROUTES.onboarding.slice(1)}`
  const params = new URLSearchParams(query)
  const pediatricRoute = rawRoute === ROUTES.pediatric
    ? (params.get('view') === 'organs' ? ROUTES.healthOrgans : ROUTES.healthDiseases)
    : null
  const route = pediatricRoute || LEGACY_ROUTE_ALIASES[rawRoute] || rawRoute
  const search = query ? `?${query}` : ''
  return { route, search, query, params }
}

export function useHashLocation() {
  const [location, setLocation] = useState(() => parseHashLocation())

  useEffect(() => {
    const update = () => {
      const nextLocation = parseHashLocation()
      const canonicalHash = `${nextLocation.route}${nextLocation.search}`
      if (hashValue() !== canonicalHash && globalThis.window?.history) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${canonicalHash}`)
      }
      setLocation(nextLocation)
    }
    update()
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  return location
}

export function useHashRoute() {
  return useHashLocation().route
}
