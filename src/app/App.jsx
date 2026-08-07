import { useEffect, useRef, useState } from 'react'
import { Onboarding } from '../features/Onboarding.jsx'
import { Workspace } from '../features/Workspace.jsx'
import { DoctorSummaryView } from '../features/DoctorSummaryView.jsx'
import { PediatricDiseasesView } from '../features/PediatricDiseasesView.jsx'
import { ExperienceView } from '../features/ExperienceView.jsx'
import { SettingsView } from '../features/SettingsView.jsx'
import { LoginView } from '../features/LoginView.jsx'
import { RecordCenter } from '../features/RecordCenter.jsx'
import { NaibaAiView } from '../features/NaibaAiView.jsx'
import { VaccineView } from '../features/VaccineView.jsx'
import { canEdit, loadSession, login, logout } from '../domain/auth.js'
import { clearState, createInitialState, hydrateState, loadState, saveState } from '../domain/storage.js'
import { pullWorkspace, pushWorkspace } from '../domain/sync.js'
import { applyCareEventsToLegacy, createCareEvent, migrateLegacyState } from '../domain/careEvents.js'
import { changedCareEvents, mergePulledState, pullCareActors, pullCareEvents, rollbackCareEventChanges, syncCareEventChanges } from '../domain/eventSync.js'
import { createEvaluatedGrowthMeasurement } from '../domain/growth.js'
import { clearExperienceCache } from '../domain/experienceApi.js'
import { clearLocalBabyAlbum } from '../domain/babyAlbum.js'
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
  const pendingSyncRef = useRef([])
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

  function commitState(updater, options = {}) {
    if (readOnly) return Promise.resolve(false)
    const previous = stateRef.current
    const rawNext = typeof updater === 'function' ? updater(previous) : updater
    const next = applyCareEventsToLegacy(rawNext, rawNext.careEvents || [])
    const eventChanges = changedCareEvents(previous.careEvents || [], next.careEvents || [])
    const nonEventWorkspaceChanged = JSON.stringify(previous.baby || null) !== JSON.stringify(next.baby || null)
      || JSON.stringify(previous.questions || []) !== JSON.stringify(next.questions || [])
      || JSON.stringify(previous.growthMeasurements || []) !== JSON.stringify(next.growthMeasurements || [])
    stateRef.current = next
    saveState(globalThis.localStorage, next, session?.username)
    setState(next)
    if (options.skipSync || session?.mode !== 'cloudflare' || !next.baby) return Promise.resolve(true)
    if (eventChanges.length) {
      pendingSyncRef.current = [...pendingSyncRef.current.filter((item) => !eventChanges.some((change) => change.event.id === item.event.id)), ...eventChanges]
    }
    const eventSync = eventChanges.length
      ? syncCareEventChanges(eventChanges).then(() => {
        pendingSyncRef.current = pendingSyncRef.current.filter((item) => !eventChanges.some((change) => change.event.id === item.event.id))
        updateSyncMeta({ status: 'online' })
        return true
      })
      : Promise.resolve(true)
    const workspaceSync = nonEventWorkspaceChanged ? pushWorkspace(stateRef.current) : Promise.resolve(null)
    return Promise.all([eventSync, workspaceSync]).then(() => true).catch((error) => {
      // Event writes are optimistic. Revert every event touched by this
      // commit, including corrections and voids, so a failed save never looks
      // successful in the local timeline. The entry form remains mounted and
      // keeps its input for an explicit retry.
      if (eventChanges.length) {
        const currentEvents = stateRef.current.careEvents || []
        const restored = rollbackCareEventChanges(previous.careEvents || [], currentEvents, eventChanges)
        const rolledBack = applyCareEventsToLegacy({ ...stateRef.current, careEvents: restored }, restored)
        const changedIds = new Set(eventChanges.flatMap((change) => [change.event.id, change.event.correctedFromId].filter(Boolean)))
        pendingSyncRef.current = pendingSyncRef.current.filter((item) => !changedIds.has(item.event.id))
        stateRef.current = rolledBack
        saveState(globalThis.localStorage, rolledBack, session?.username)
        setState(rolledBack)
      }
      updateSyncMeta({ status: 'offline' })
      throw error
    })
  }

  async function pullEventWorkspace(owner = sessionRef.current?.username, babyId = stateRef.current.baby?.id) {
    if (!babyId || sessionRef.current?.mode !== 'cloudflare' || syncingRef.current) return
    syncingRef.current = true
    try {
      let current = stateRef.current
      const payload = await pullCareEvents(babyId)
      let next = mergePulledState(current, payload)
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
      next = { ...next, syncMeta: { ...(next.syncMeta || {}), status: 'online' } }
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

  async function retrySync() {
    try {
      if (pendingSyncRef.current.length) {
        const pending = [...pendingSyncRef.current]
        await syncCareEventChanges(pending)
        pendingSyncRef.current = pendingSyncRef.current.filter((item) => !pending.some((change) => change.event.id === item.event.id))
      }
      await pullEventWorkspace(sessionRef.current?.username, stateRef.current.baby?.id)
      updateSyncMeta({ status: 'online' })
    } catch {
      updateSyncMeta({ status: 'offline' })
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
          if (remote?.baby && sessionRef.current?.username === owner) hydrated = { ...createInitialState(), ...remote, preferences: { ...next.preferences, locale: remote.baby.locale || next.preferences.locale } }
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
    const onManualRetry = () => void retrySync()
    globalThis.addEventListener?.('babyforge:sync-retry', onManualRetry)
    return () => {
      globalThis.removeEventListener?.('babyforge:sync-retry', onManualRetry)
    }
    // retrySync closes over refs and the current pull helper; rerunning this
    // listener on every render would create duplicate handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.mode, session?.username, state.baby?.id])

  function createBaby(baby) {
    if (readOnly || !session) return
    const { birthMeasurements = [], ...profile } = baby
    commitState((current) => {
      const actor = current.careActors.find((item) => item.id === current.preferences.currentRecorderId) || current.careActors[0]
      const measurements = birthMeasurements.map((input) => createEvaluatedGrowthMeasurement(input, profile, current.growthMeasurements))
      const events = measurements.map((measurement) => createCareEvent({
        id: measurement.id,
        babyId: profile.id,
        kind: 'measurement',
        category: 'growth_measurement',
        occurredAt: `${measurement.measuredAt}T12:00:00.000Z`,
        recordedAt: measurement.createdAt,
        actor,
        source: 'caregiver',
        payload: measurement,
      }))
      return { ...current, baby: profile, careEvents: [...current.careEvents, ...events] }
    })
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
      current = applyCareEventsToLegacy(migrateLegacyState(current), current.careEvents || [])
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
    clearExperienceCache({ storage: globalThis.localStorage })
    setSession(null)
    const initial = createInitialState()
    stateRef.current = initial
    setState(initial)
    setAuthError('')
    navigate(ROUTES.login)
  }

  async function clearWorkspace() {
    const babyId = stateRef.current.baby?.id
    if (babyId) {
      try {
        await clearLocalBabyAlbum(babyId)
      } catch (error) {
        console.warn('[BabyForge] Failed to clear local baby album', error)
        const message = stateRef.current.preferences.locale === 'en-US'
          ? 'The local album could not be cleared. Your workspace was kept; please try again.'
          : '本地相册清理失败，工作区未清除，请重试。'
        if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(message)
        return false
      }
    }
    clearExperienceCache({ storage: globalThis.localStorage })
    clearState(globalThis.localStorage, session?.username)
    const initial = createInitialState()
    stateRef.current = initial
    setState(initial)
    navigate(session && canEdit(session) ? ROUTES.onboarding : ROUTES.login)
    return true
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

  if (route === ROUTES.records) {
    return <RecordCenter state={state} commitState={commitState} onClear={clearWorkspace} onLogout={handleLogout} readOnly={readOnly} role={session?.role} />
  }

  if (route === ROUTES.pediatric) {
    return <PediatricDiseasesView state={state} setState={commitState} onClear={clearWorkspace} onLogout={handleLogout} readOnly={readOnly} role={session?.role} />
  }

  if (route === ROUTES.summary) {
    return <DoctorSummaryView state={state} onBack={() => navigate(ROUTES.today)} onClear={clearWorkspace} readOnly={readOnly} onLogout={handleLogout} />
  }

  if (route === ROUTES.experience) {
    return <ExperienceView state={state} setState={commitState} onClear={clearWorkspace} onLogout={handleLogout} readOnly={readOnly} role={session?.role} />
  }

  if (route === ROUTES.naibaAi) {
    return <NaibaAiView state={state} commitState={commitState} cloudMode={session?.mode === 'cloudflare'} onBack={() => navigate(ROUTES.today)} onClear={clearWorkspace} onLogout={handleLogout} readOnly={readOnly} role={session?.role} />
  }

  if (route === ROUTES.vaccines) {
    return <VaccineView state={state} setState={commitState} onClear={clearWorkspace} onLogout={handleLogout} readOnly={readOnly} role={session?.role} />
  }

  return <Workspace route={route} state={state} setState={commitState} onClear={clearWorkspace} onLogout={handleLogout} readOnly={readOnly} role={session?.role} cloudMode={session?.mode === 'cloudflare'} />
}
