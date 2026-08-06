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
import { applyCareEventsToLegacy, bridgeLegacyChanges, mergeCareEvents } from '../domain/careEvents.js'
import { concernsFromCareEvents } from '../domain/healthSupport.js'
import { changedCareEvents, flushCareEventOutbox, mergePulledState, pullCareActors, pullCareEvents, enqueueCareEvent } from '../domain/eventSync.js'
import { createEvaluatedGrowthMeasurement } from '../domain/growth.js'
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
  const syncingRef = useRef(false)
  const outboxSyncRef = useRef(Promise.resolve())
  const readOnly = Boolean(session) && !canEdit(session)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  function updateSyncMeta(patch) {
    const current = stateRef.current
    const next = { ...current, syncMeta: { ...(current.syncMeta || {}), ...patch } }
    stateRef.current = next
    saveState(globalThis.localStorage, next, sessionRef.current?.username)
    setState(next)
    return next
  }

  function commitState(updater) {
    if (readOnly) return
    const previous = stateRef.current
    const rawNext = typeof updater === 'function' ? updater(previous) : updater
    const next = bridgeLegacyChanges(previous, rawNext, { babyId: rawNext.baby?.id })
    const eventChanges = changedCareEvents(previous.careEvents || [], next.careEvents || [])
    const nonEventWorkspaceChanged = JSON.stringify(previous.baby || null) !== JSON.stringify(next.baby || null)
      || JSON.stringify(previous.questions || []) !== JSON.stringify(next.questions || [])
    stateRef.current = next
    saveState(globalThis.localStorage, next, session?.username)
    setState(next)
    if (session?.mode === 'cloudflare' && next.baby) {
      outboxSyncRef.current = outboxSyncRef.current
        .then(async () => {
          const eventSync = (async () => {
            await Promise.all(eventChanges.map((change) => enqueueCareEvent(change.event, change.operation, session.username)))
            const result = await flushCareEventOutbox(session.username)
            updateSyncMeta({ status: result.pending ? 'offline' : 'online' })
            return result
          })()
          const workspaceSync = nonEventWorkspaceChanged ? pushWorkspace(stateRef.current) : Promise.resolve(null)
          const [result] = await Promise.all([eventSync, workspaceSync])
          return result
        })
        .catch((error) => {
          updateSyncMeta({ status: 'offline' })
          console.warn('云端同步失败，将在下次同步时重试', error)
        })
    }
  }

  async function pullEventWorkspace(owner = sessionRef.current?.username, babyId = stateRef.current.baby?.id) {
    if (!babyId || sessionRef.current?.mode !== 'cloudflare' || syncingRef.current) return
    syncingRef.current = true
    try {
      let current = stateRef.current
      const canWriteRemote = canEdit(sessionRef.current)
      let queuedLegacyEvents = false
      if (canWriteRemote && !current.syncMeta?.legacyEventsQueued) {
        for (const event of (current.careEvents || []).filter((item) => item.legacyKey)) {
          await enqueueCareEvent(event, 'create', owner)
        }
        queuedLegacyEvents = true
        stateRef.current = current
      }
      const since = current.syncMeta?.lastPulledAt || null
      const payload = await pullCareEvents(babyId, since)
      let next = mergePulledState(current, payload, { since })
      next = { ...next, careEvents: mergeCareEvents(current.careEvents || [], payload.events || []) }
      next = { ...next, concerns: concernsFromCareEvents(next.careEvents, next.concerns || []) }
      next = applyCareEventsToLegacy(next, next.careEvents)
      try {
        const actors = await pullCareActors(babyId)
        if (actors.length) {
          const currentRecorderId = actors.some((actor) => actor.id === next.preferences?.currentRecorderId) ? next.preferences.currentRecorderId : actors[0].id
          next = { ...next, careActors: actors, preferences: { ...next.preferences, currentRecorderId } }
        }
      } catch {
        // Actor sync is best effort; event sync remains useful without it.
      }
      if (canWriteRemote) {
        const result = await flushCareEventOutbox(owner)
        next = {
          ...next,
          syncMeta: {
            ...(next.syncMeta || {}),
            status: result.pending ? 'offline' : 'online',
            ...(queuedLegacyEvents && result.pending === 0 ? { legacyEventsQueued: true } : {}),
          },
        }
      }
      stateRef.current = next
      saveState(globalThis.localStorage, next, owner)
      setState(next)
    } catch {
      stateRef.current = { ...stateRef.current, syncMeta: { ...(stateRef.current.syncMeta || {}), status: 'offline' } }
      saveState(globalThis.localStorage, stateRef.current, owner)
      setState(stateRef.current)
    } finally {
      syncingRef.current = false
    }
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
          if (remote?.baby && sessionRef.current?.username === owner) hydrated = bridgeLegacyChanges(next, { ...createInitialState(), ...remote, preferences: { ...next.preferences, locale: remote.baby.locale || next.preferences.locale } }, { babyId: remote.baby.id })
        } catch {
          // Keep the account-scoped local copy if the remote refresh is offline.
        }
      }
      if (!active || sessionRef.current?.username !== owner) return
      stateRef.current = hydrated
      saveState(globalThis.localStorage, hydrated, owner)
      setState(hydrated)
      if (remoteBabyId) void pullEventWorkspace(owner, remoteBabyId)
    })
    return () => { active = false }
  // Login/logout transitions explicitly replace the in-memory state. Keeping
  // hydration to the initial boot prevents a slower IndexedDB read from
  // overwriting a freshly pulled account workspace after sign-in.
  }, [])

  useEffect(() => {
    if (session?.mode !== 'cloudflare' || !state.baby?.id) return undefined
    const sync = () => void pullEventWorkspace(session.username, stateRef.current.baby?.id)
    const timer = globalThis.setInterval(sync, 30_000)
    const onFocus = () => sync()
    const onOnline = () => sync()
    globalThis.addEventListener?.('focus', onFocus)
    globalThis.addEventListener?.('online', onOnline)
    const onManualRetry = () => sync()
    globalThis.addEventListener?.('babyforge:sync-retry', onManualRetry)
    sync()
    return () => {
      globalThis.clearInterval?.(timer)
      globalThis.removeEventListener?.('focus', onFocus)
      globalThis.removeEventListener?.('online', onOnline)
      globalThis.removeEventListener?.('babyforge:sync-retry', onManualRetry)
    }
  }, [session?.mode, session?.username, state.baby?.id])

  function createBaby(baby) {
    if (readOnly || !session) return
    const { birthMeasurements = [], ...profile } = baby
    const measurements = birthMeasurements.map((input) => createEvaluatedGrowthMeasurement(input, profile, []))
    commitState((current) => ({ ...current, baby: profile, growthMeasurements: [...current.growthMeasurements, ...measurements] }))
    navigate(ROUTES.today)
  }

  async function handleLogin(username, password) {
    setAuthError('')
    try {
      const next = await login(username, password)
      setSession(next)
      sessionRef.current = next
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
      if (next.mode === 'cloudflare' && remoteBaby?.id) void pullEventWorkspace(next.username, remoteBaby.id)
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
    return <DoctorSummaryView state={state} onBack={() => navigate(ROUTES.today)} onClear={clearWorkspace} readOnly={readOnly} onLogout={handleLogout} />
  }

  return <Workspace route={route} state={state} setState={commitState} onClear={clearWorkspace} onLogout={handleLogout} readOnly={readOnly} role={session?.role} />
}
