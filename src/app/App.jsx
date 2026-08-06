import { useEffect, useRef, useState } from 'react'
import { Onboarding } from '../features/Onboarding.jsx'
import { Workspace } from '../features/Workspace.jsx'
import { DoctorSummaryView } from '../features/DoctorSummaryView.jsx'
import { PediatricDiseasesView } from '../features/PediatricDiseasesView.jsx'
import { SettingsView } from '../features/SettingsView.jsx'
import { LoginView } from '../features/LoginView.jsx'
import { canEdit, loadSession, login, logout } from '../domain/auth.js'
import { clearState, createInitialState, hydrateState, loadState, saveState } from '../domain/storage.js'
import { pullWorkspace, pushWorkspace } from '../domain/sync.js'
import { navigate, ROUTES, useHashRoute } from './router.js'

export function App() {
  const route = useHashRoute()
  const [session, setSession] = useState(() => loadSession())
  const initialOwnerRef = useRef(session?.username)
  const sessionRef = useRef(session)
  const [state, setState] = useState(() => {
    const owner = loadSession()?.username
    return loadState(globalThis.localStorage, owner)
  })
  const [authError, setAuthError] = useState('')
  const stateRef = useRef(state)
  const readOnly = Boolean(session) && !canEdit(session)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  function commitState(updater) {
    if (readOnly) return
    const next = typeof updater === 'function' ? updater(stateRef.current) : updater
    stateRef.current = next
    saveState(globalThis.localStorage, next, session?.username)
    setState(next)
    if (session?.mode === 'cloudflare' && next.baby) void pushWorkspace(next).catch(() => {})
  }

  useEffect(() => {
    if (!session && route !== ROUTES.login) navigate(ROUTES.login)
    if (session && route === ROUTES.login && state.baby) navigate(ROUTES.today)
    if (session && route === ROUTES.login && !state.baby && canEdit(session)) navigate(ROUTES.onboarding)
    if (!state.baby && route !== ROUTES.onboarding && route !== ROUTES.login) navigate(canEdit(session) ? ROUTES.onboarding : ROUTES.login)
    if (state.baby && route === ROUTES.onboarding) navigate(ROUTES.today)
  }, [route, session, state.baby])

  useEffect(() => {
    document.documentElement.lang = state.preferences.locale
  }, [state.preferences.locale])

  useEffect(() => {
    let active = true
    const owner = initialOwnerRef.current
    const initialSession = sessionRef.current
    hydrateState(globalThis.localStorage, owner).then(async (next) => {
      if (!active || !next?.version || sessionRef.current?.username !== owner) return
      let hydrated = next
      const remoteBabyId = initialSession?.mode === 'cloudflare' ? initialSession.babies?.[0]?.id : null
      if (remoteBabyId) {
        try {
          const remote = await pullWorkspace(remoteBabyId)
          if (remote?.baby && sessionRef.current?.username === owner) hydrated = { ...createInitialState(), ...remote, preferences: { ...next.preferences, locale: remote.baby.locale || next.preferences.locale } }
        } catch {
          // Keep the account-scoped local copy if the remote refresh is offline.
        }
      }
      if (!active || sessionRef.current?.username !== owner) return
      stateRef.current = hydrated
      saveState(globalThis.localStorage, hydrated, owner)
      setState(hydrated)
    })
    return () => { active = false }
  // Login/logout transitions explicitly replace the in-memory state. Keeping
  // hydration to the initial boot prevents a slower IndexedDB read from
  // overwriting a freshly pulled account workspace after sign-in.
  }, [])

  function createBaby(baby) {
    if (readOnly || !session) return
    commitState((current) => ({ ...current, baby }))
    navigate(ROUTES.today)
  }

  async function handleLogin(username, password) {
    setAuthError('')
    try {
      const next = await login(username, password)
      setSession(next)
      // The Vite demo accounts share the seeded local workspace so the guest
      // flow mirrors the production household membership. Cloudflare always
      // uses the account-specific remote workspace returned by the API.
      const workspaceOwner = next.mode === 'demo' && next.role === 'guest' ? 'niwa' : next.username
      let current = loadState(globalThis.localStorage, workspaceOwner)
      const remoteBaby = next.babies?.[0]
      if (next.mode === 'cloudflare' && remoteBaby?.id) {
        try {
          const remote = await pullWorkspace(remoteBaby.id)
          if (remote?.baby) {
            current = {
              ...createInitialState(),
              ...remote,
              preferences: { ...current.preferences, locale: remote.baby.locale || current.preferences.locale },
            }
          }
        } catch (error) {
          setAuthError(error.message)
        }
      }
      stateRef.current = current
      saveState(globalThis.localStorage, current, next.username)
      setState(current)
      if (next.role === 'guest' && !current.baby) {
        setAuthError('当前账号暂未关联宝宝档案，请联系管理员。')
        return
      }
      navigate(current.baby ? ROUTES.today : ROUTES.onboarding)
    } catch (error) {
      setAuthError(error.message || '账号或密码不正确')
      return null
    }
  }

  async function handleLogout() {
    await logout()
    setSession(null)
    const initial = createInitialState()
    stateRef.current = initial
    setState(initial)
    setAuthError('')
    navigate(ROUTES.login)
  }

  function clearWorkspace() {
    clearState(globalThis.localStorage, session?.username)
    const initial = createInitialState()
    stateRef.current = initial
    setState(initial)
    navigate(session && canEdit(session) ? ROUTES.onboarding : ROUTES.login)
  }

  if (!session || route === ROUTES.login || (session?.role === 'guest' && !state.baby)) {
    return <LoginView locale={state.preferences.locale} onLocaleChange={(locale) => commitState((current) => ({ ...current, preferences: { ...current.preferences, locale } }))} onLogin={handleLogin} error={authError} noProfile={session?.role === 'guest' && !state.baby} />
  }

  if (!state.baby || route === ROUTES.onboarding) {
    return <Onboarding onCreate={createBaby} locale={state.preferences.locale} onLocaleChange={(locale) => commitState((current) => ({ ...current, preferences: { ...current.preferences, locale } }))} />
  }

  if (route === ROUTES.settings) {
    return <SettingsView state={state} setState={commitState} onClear={clearWorkspace} onLogout={handleLogout} readOnly={readOnly} />
  }

  if (route === ROUTES.pediatric) {
    return <PediatricDiseasesView state={state} setState={commitState} onClear={clearWorkspace} onLogout={handleLogout} readOnly={readOnly} role={session?.role} />
  }

  if (route === ROUTES.summary) {
    return <DoctorSummaryView state={state} onBack={() => navigate(ROUTES.pediatric)} onClear={clearWorkspace} readOnly={readOnly} onLogout={handleLogout} />
  }

  return <Workspace route={route} state={state} setState={commitState} onClear={clearWorkspace} onLogout={handleLogout} readOnly={readOnly} role={session?.role} />
}
