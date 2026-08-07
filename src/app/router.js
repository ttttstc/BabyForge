import { useEffect, useState } from 'react'

export const ROUTES = {
  login: '#/login',
  onboarding: '#/onboarding',
  today: '#/today',
  records: '#/records',
  stage: '#/stage/newborn',
  jaundice: '#/topic/jaundice',
  pediatric: '#/topic/pediatric-diseases',
  experience: '#/experience',
  naibaAi: '#/naiba-ai',
  summary: '#/doctor-summary',
  settings: '#/settings',
}

export function navigate(route) {
  window.location.hash = route.slice(1)
}

function rawHashRoute() {
  return (window.location.hash || ROUTES.onboarding).split('?')[0]
}

function hashRoute() {
  return rawHashRoute()
}

export function useHashRoute() {
  const [route, setRoute] = useState(hashRoute)

  useEffect(() => {
    const update = () => {
      setRoute(hashRoute())
    }
    update()
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  return route
}
