import { useEffect, useState } from 'react'

export const ROUTES = {
  login: '#/login',
  onboarding: '#/onboarding',
  today: '#/today',
  records: '#/records',
  stage: '#/stage/newborn',
  jaundice: '#/topic/jaundice',
  pediatric: '#/topic/pediatric-diseases',
  settings: '#/settings',
  summary: '#/doctor-summary',
}

export function navigate(route) {
  window.location.hash = route.slice(1)
}

export function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash || ROUTES.onboarding)

  useEffect(() => {
    const update = () => setRoute(window.location.hash || ROUTES.onboarding)
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  return route
}
