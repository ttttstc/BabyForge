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
}

export function navigate(route) {
  window.location.hash = route.slice(1)
}

function hashRoute() {
  return (window.location.hash || ROUTES.onboarding).split('?')[0]
}

export function useHashRoute() {
  const [route, setRoute] = useState(hashRoute)

  useEffect(() => {
    const update = () => setRoute(hashRoute())
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  return route
}
