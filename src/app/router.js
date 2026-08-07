import { useEffect, useState } from 'react'

export const ROUTES = {
  login: '#/login',
  onboarding: '#/onboarding',
  today: '#/today',
  records: '#/records',
  stage: '#/stage/newborn',
  jaundice: '#/topic/jaundice',
  pediatric: '#/topic/pediatric-diseases',
  naibaAi: '#/naiba-ai',
  settings: '#/settings',
}

const LEGACY_ROUTE_ALIASES = {
  '#/doctor-summary': ROUTES.records,
}

export function navigate(route) {
  window.location.hash = route.slice(1)
}

function rawHashRoute() {
  return (window.location.hash || ROUTES.onboarding).split('?')[0]
}

function hashRoute() {
  const rawRoute = rawHashRoute()
  return LEGACY_ROUTE_ALIASES[rawRoute] || rawRoute
}

export function useHashRoute() {
  const [route, setRoute] = useState(hashRoute)

  useEffect(() => {
    const update = () => {
      const nextRoute = hashRoute()
      if (rawHashRoute() !== nextRoute) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextRoute}`)
      }
      setRoute(nextRoute)
    }
    update()
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  return route
}
