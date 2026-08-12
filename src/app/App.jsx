import { useEffect, useRef, useState } from 'react'
import { Onboarding } from '../features/Onboarding.jsx'
import { Workspace } from '../features/Workspace.jsx'
import { DoctorSummaryView } from '../features/DoctorSummaryView.jsx'
import { PediatricDiseasesView } from '../features/PediatricDiseasesView.jsx'
import { ExperienceView } from '../features/ExperienceView.jsx'
import { SettingsView } from '../features/SettingsView.jsx'
import { LoginView } from '../features/LoginView.jsx'
import { HouseholdGate } from '../features/HouseholdGate.jsx'
import { RecordCenter } from '../features/RecordCenter.jsx'
import { NaibaAiView } from '../features/NaibaAiView.jsx'
import { VaccineView } from '../features/VaccineView.jsx'
import { VisitorView } from '../features/VisitorView.jsx'
import { canEdit, loadSession, login, logout, persistSession, register, requestPasswordReset, resendVerification, resetPassword, resumeSession, SESSION_KEY, startGoogleLogin, updateNickname } from '../domain/auth.js'
import { acceptHouseholdInvite } from '../domain/householdAccess.js'
import { clearState, createDemoWorkspace, createInitialState, hydrateState, loadState, saveState } from '../domain/storage.js'
import { pullShowcaseWorkspace, pullWorkspace, pushWorkspace } from '../domain/sync.js'
import { applyCareEventsToLegacy, createCareEvent, migrateLegacyState } from '../domain/careEvents.js'
import { changedCareEvents, mergePulledState, pullCareActors, pullCareEvents, rollbackCareEventChanges, syncCareEventChanges } from '../domain/eventSync.js'
import { createEvaluatedGrowthMeasurement } from '../domain/growth.js'
import { clearExperienceCache } from '../domain/experienceApi.js'
import { clearLocalBabyAlbum } from '../domain/babyAlbum.js'
import { buildInviteRoute, inviteTokenFromLocation, navigate, resolveNaibaReturnTo, ROUTES, useHashLocation, visitorTokenFromLocation } from './router.js'

const REMOTE_WORKSPACE_FIELDS = ['baby', 'observations', 'questions', 'taskLogs', 'adminTaskRecords', 'growthMeasurements', 'milestoneRecords']

function demoWorkspace(session) {
  return createDemoWorkspace(new Date(), session?.demoVariant === 'mock' ? 'mock' : 'niwa')
}

function sameValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

export function App() {
  const location = useHashLocation()
  const route = location.route
  const inviteToken = inviteTokenFromLocation(location)
  const visitorToken = visitorTokenFromLocation(location)
  const [session, setSession] = useState(() => visitorToken ? null : loadSession())
  const sessionOwner = (value) => value?.userId || value?.username
  const initialOwnerRef = useRef(sessionOwner(session))
  const initialVisitorTokenRef = useRef(visitorToken)
  const sessionRef = useRef(session)
  const [state, setState] = useState(() => {
    if (visitorToken) return createInitialState()
    const currentSession = loadSession()
    if (currentSession?.mode === 'demo') return demoWorkspace(currentSession)
    const owner = sessionOwner(currentSession)
    return loadState(globalThis.localStorage, owner)
  })
  const [authError, setAuthError] = useState('')
  const stateRef = useRef(state)
  const syncingRef = useRef(false)
  const pendingSyncRef = useRef([])
  const pendingWorkspaceRef = useRef(null)
  const pendingWritesRef = useRef(0)
  const pendingSequenceRef = useRef(0)
  const localRevisionRef = useRef(0)
  const revokingRef = useRef(false)
  const sessionRefreshStartedRef = useRef(false)
  const hydrationCancelledRef = useRef(false)
  const readOnly = Boolean(session) && !canEdit(session)

  function hasPendingSync() {
    return pendingWritesRef.current > 0 || pendingSyncRef.current.length > 0 || Boolean(pendingWorkspaceRef.current)
  }

  function handleAuthRevoked() {
    if (revokingRef.current) return
    revokingRef.current = true
    const current = sessionRef.current
    const owner = sessionOwner(current)
    clearState(globalThis.localStorage, owner)
    if (current?.username && current?.userId) clearState(globalThis.localStorage, current.username)
    if (stateRef.current.baby?.id) void clearLocalBabyAlbum(stateRef.current.baby.id).catch(() => {})
    clearExperienceCache({ storage: globalThis.localStorage })
    globalThis.localStorage?.removeItem(SESSION_KEY)
    sessionRef.current = null
    setSession(null)
    const initial = createInitialState()
    stateRef.current = initial
    setState(initial)
    setAuthError('登录状态已失效，请重新登录。')
    navigate(ROUTES.login)
  }

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  function updateSyncMeta(patch) {
    const current = stateRef.current
    const next = { ...current, syncMeta: { ...(current.syncMeta || {}), ...patch } }
    stateRef.current = next
    saveState(globalThis.localStorage, next, sessionOwner(sessionRef.current))
    setState(next)
    return next
  }

  function commitState(updater, options = {}) {
    if (readOnly) return Promise.resolve(false)
    const previous = stateRef.current
    const rawNext = typeof updater === 'function' ? updater(previous) : updater
    const next = applyCareEventsToLegacy(rawNext, rawNext.careEvents || [])
    const eventChanges = changedCareEvents(previous.careEvents || [], next.careEvents || [])
    const nonEventWorkspaceChanged = REMOTE_WORKSPACE_FIELDS.some((field) => !sameValue(previous[field], next[field]))
    const shouldSyncRemotely = !options.skipSync && session?.mode === 'cloudflare' && Boolean(next.baby)
    const hasRemoteChanges = eventChanges.length > 0 || nonEventWorkspaceChanged
    if (shouldSyncRemotely && hasRemoteChanges) pendingWritesRef.current += 1
    const visibleNext = shouldSyncRemotely && hasRemoteChanges
      ? { ...next, syncMeta: { ...(next.syncMeta || {}), status: 'pending' } }
      : next
    localRevisionRef.current += 1
    stateRef.current = visibleNext
    saveState(globalThis.localStorage, visibleNext, sessionOwner(session))
    setState(visibleNext)
    if (!shouldSyncRemotely || !hasRemoteChanges) return Promise.resolve(true)
    const workspaceSnapshot = nonEventWorkspaceChanged ? visibleNext : null
    if (workspaceSnapshot) pendingWorkspaceRef.current = workspaceSnapshot
    const queuedEventChanges = eventChanges.map((change) => ({ ...change, syncId: ++pendingSequenceRef.current }))
    if (eventChanges.length) {
      pendingSyncRef.current = [...pendingSyncRef.current.filter((item) => !eventChanges.some((change) => change.event.id === item.event.id)), ...queuedEventChanges]
    }
    let eventSyncFailed = false
    const eventSync = eventChanges.length
      ? syncCareEventChanges(queuedEventChanges).then(() => {
        pendingSyncRef.current = pendingSyncRef.current.filter((item) => !queuedEventChanges.some((change) => change.syncId === item.syncId))
        return true
      }).catch((error) => {
        eventSyncFailed = true
        throw error
      })
      : Promise.resolve(true)
    const workspaceSync = workspaceSnapshot
      ? pushWorkspace(workspaceSnapshot).then((result) => {
        if (pendingWorkspaceRef.current === workspaceSnapshot) pendingWorkspaceRef.current = null
        return result
      })
      : Promise.resolve(null)
    return Promise.allSettled([eventSync, workspaceSync]).then((results) => {
      const failure = results.find((result) => result.status === 'rejected')
      if (failure) throw failure.reason
      pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1)
      updateSyncMeta({ status: hasPendingSync() ? 'pending' : 'online' })
      return true
    }).catch((error) => {
      if ([401, 403].includes(error?.status)) {
        handleAuthRevoked()
        pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1)
        throw error
      }
      pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1)
      // Event writes are optimistic. Revert every event touched by this
      // commit, including corrections and voids, so a failed save never looks
      // successful in the local timeline. The entry form remains mounted and
      // keeps its input for an explicit retry.
      if (eventChanges.length && eventSyncFailed) {
        const currentEvents = stateRef.current.careEvents || []
        const restored = rollbackCareEventChanges(previous.careEvents || [], currentEvents, eventChanges)
        const rolledBack = applyCareEventsToLegacy({ ...stateRef.current, careEvents: restored }, restored)
        const changedIds = new Set(eventChanges.flatMap((change) => [change.event.id, change.event.correctedFromId].filter(Boolean)))
        pendingSyncRef.current = pendingSyncRef.current.filter((item) => !changedIds.has(item.event.id))
        stateRef.current = rolledBack
        saveState(globalThis.localStorage, rolledBack, sessionOwner(session))
        setState(rolledBack)
      }
      if (workspaceSnapshot && pendingWorkspaceRef.current === workspaceSnapshot) pendingWorkspaceRef.current = stateRef.current
      updateSyncMeta({ status: hasPendingSync() ? 'pending' : 'offline' })
      throw error
    })
  }

  async function pullEventWorkspace(owner = sessionOwner(sessionRef.current), babyId = stateRef.current.baby?.id) {
    if (!babyId || sessionRef.current?.mode !== 'cloudflare' || syncingRef.current) return
    syncingRef.current = true
    try {
      const payload = await pullCareEvents(babyId)
      let actors = []
      try {
        actors = await pullCareActors(babyId)
      } catch {
        // Actor sync is best effort; event sync remains useful without it.
      }
      const currentSession = sessionRef.current
      const stillAuthorized = currentSession?.mode === 'cloudflare'
        && Boolean(currentSession.household)
        && sessionOwner(currentSession) === owner
        && currentSession.babies?.some((baby) => baby.id === babyId)
      if (!stillAuthorized) return
      // Both requests can overlap with optimistic local writes. Build the
      // merged snapshot only after every remote read resolves, using the
      // latest local state so stale responses never roll back a new event.
      let next = mergePulledState(stateRef.current, payload)
      next = applyCareEventsToLegacy(next, next.careEvents)
      if (actors.length) {
        const latest = stateRef.current
        const currentRecorderId = actors.some((actor) => actor.id === latest.preferences?.currentRecorderId) ? latest.preferences.currentRecorderId : actors[0].id
        next = { ...next, careActors: actors, preferences: { ...latest.preferences, currentRecorderId } }
      }
      next = { ...next, syncMeta: { ...(next.syncMeta || {}), status: hasPendingSync() ? 'pending' : 'online' } }
      stateRef.current = next
      saveState(globalThis.localStorage, next, owner)
      setState(next)
    } catch (error) {
      const currentSession = sessionRef.current
      const stillAuthorized = currentSession?.mode === 'cloudflare'
        && Boolean(currentSession.household)
        && sessionOwner(currentSession) === owner
        && currentSession.babies?.some((baby) => baby.id === babyId)
      if (!stillAuthorized) return
      if ([401, 403].includes(error?.status)) {
        handleAuthRevoked()
        return
      }
      stateRef.current = { ...stateRef.current, syncMeta: { ...(stateRef.current.syncMeta || {}), status: hasPendingSync() ? 'pending' : 'offline' } }
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
        pendingSyncRef.current = pendingSyncRef.current.filter((item) => !pending.some((change) => change.syncId === item.syncId))
      }
      if (pendingWorkspaceRef.current) {
        const pendingWorkspace = pendingWorkspaceRef.current
        await pushWorkspace(pendingWorkspace)
        if (pendingWorkspaceRef.current === pendingWorkspace) pendingWorkspaceRef.current = null
      }
      await pullEventWorkspace(sessionOwner(sessionRef.current), stateRef.current.baby?.id)
      updateSyncMeta({ status: hasPendingSync() ? 'pending' : 'online' })
    } catch (error) {
      if ([401, 403].includes(error?.status)) {
        handleAuthRevoked()
        return
      }
      updateSyncMeta({ status: hasPendingSync() ? 'pending' : 'offline' })
    }
  }

  useEffect(() => {
    if (route === ROUTES.resetPassword) return
    if (visitorToken) return
    if (!session) {
      if (route !== ROUTES.login && !inviteToken) navigate(ROUTES.login)
      return
    }
    if (session.mode === 'cloudflare' && !session.household) {
      if (route === ROUTES.login) navigate(ROUTES.household)
      else if (![ROUTES.household, ROUTES.onboarding].includes(route) && !inviteToken) navigate(ROUTES.household)
      return
    }
    if (session.mode === 'cloudflare' && session.household && inviteToken) {
      navigate(state.baby ? ROUTES.today : ROUTES.onboarding)
      return
    }
    if (route === ROUTES.login && state.baby) navigate(ROUTES.today)
    if (route === ROUTES.login && !state.baby && canEdit(session)) navigate(ROUTES.onboarding)
    if (!state.baby && route !== ROUTES.onboarding && route !== ROUTES.login) navigate(canEdit(session) ? ROUTES.onboarding : ROUTES.login)
    if (state.baby && route === ROUTES.onboarding) navigate(ROUTES.today)
  }, [inviteToken, route, session, state.baby, visitorToken])

  useEffect(() => {
    document.documentElement.lang = state.preferences.locale
  }, [state.preferences.locale])

  useEffect(() => {
    if (initialVisitorTokenRef.current) return undefined
    const initialSession = sessionRef.current
    if (initialSession?.mode === 'demo') {
      void Promise.all([
        clearState(globalThis.localStorage, initialSession.username),
        stateRef.current.baby?.id ? clearLocalBabyAlbum(stateRef.current.baby.id).catch(() => {}) : Promise.resolve(),
      ])
      clearExperienceCache({ storage: globalThis.localStorage })
      return undefined
    }
    let active = true
    const owner = initialOwnerRef.current
    const revisionAtEffectStart = localRevisionRef.current
    hydrateState(globalThis.localStorage, owner).then(async (next) => {
      if (!active || hydrationCancelledRef.current || !next?.version || sessionOwner(sessionRef.current) !== owner) return
      let hydrated = next
      const remoteBabyId = initialSession?.mode === 'cloudflare' ? initialSession.babies?.[0]?.id : null
      if (initialSession?.mode === 'showcase') {
        try {
          const remote = await pullShowcaseWorkspace()
          if (remote?.baby && sessionOwner(sessionRef.current) === owner) {
            hydrated = {
              ...createInitialState(),
              ...remote,
              preferences: { ...next.preferences, locale: remote.baby.locale || next.preferences.locale },
            }
          }
        } catch (error) {
          if ([401, 403].includes(error?.status)) handleAuthRevoked()
        }
      } else if (remoteBabyId) {
        const revisionBeforeRemote = localRevisionRef.current
        const stateBeforeRemote = stateRef.current
        try {
          const remote = await pullWorkspace(remoteBabyId)
          if (remote?.baby && sessionOwner(sessionRef.current) === owner) {
            const latest = stateRef.current
            const localChangedBeforeRemote = revisionBeforeRemote !== revisionAtEffectStart
            const localChangedDuringRemote = localRevisionRef.current !== revisionBeforeRemote
            const remoteState = { ...createInitialState(), ...remote }
            const localChanges = localChangedBeforeRemote || localChangedDuringRemote
            if (localChanges) {
              const baseline = localChangedBeforeRemote ? next : stateBeforeRemote
              REMOTE_WORKSPACE_FIELDS.forEach((field) => {
                if (!sameValue(latest[field], baseline[field])) remoteState[field] = latest[field]
              })
              remoteState.careEvents = latest.careEvents
              remoteState.carePlanItems = latest.carePlanItems
              remoteState.concerns = latest.concerns
              remoteState.careActors = latest.careActors
              remoteState.preferences = latest.preferences
              remoteState.syncMeta = latest.syncMeta
            } else {
              remoteState.preferences = { ...next.preferences, locale: remote.baby.locale || next.preferences.locale }
              remoteState.careEvents = next.careEvents
              remoteState.carePlanItems = next.carePlanItems
              remoteState.concerns = next.concerns
              remoteState.careActors = next.careActors
            }
            hydrated = remoteState
          }
        } catch {
          // Keep the account-scoped local copy if the remote refresh is offline.
          if (localRevisionRef.current !== revisionAtEffectStart) hydrated = stateRef.current
        }
      }
      if (!active || hydrationCancelledRef.current || sessionOwner(sessionRef.current) !== owner) return
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
  }, [session?.mode, session?.userId, session?.username, state.baby?.id])

  async function createBaby(baby) {
    if (readOnly || !session) return
    try {
      const { birthMeasurements = [], householdName, ...profile } = baby
      let nextSession = sessionRef.current
      if (session.mode === 'cloudflare' && !session.household) {
        const response = await fetch('/api/household', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: householdName || `${profile.nickname} 的家庭`, baby: profile }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || '创建家庭失败')
        nextSession = { ...nextSession, household: payload.household, role: payload.household?.role || 'owner', babies: payload.household?.baby ? [payload.household.baby] : [] }
        sessionRef.current = nextSession
        setSession(nextSession)
      }
      await commitState((current) => {
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
      }, { skipSync: true })
      if (nextSession.mode === 'cloudflare') await pushWorkspace(stateRef.current)
      navigate(ROUTES.today)
    } catch (error) {
      setAuthError(error.message || '创建家庭失败')
    }
  }

  async function activateSession(next) {
    revokingRef.current = false
    setSession(next)
    sessionRef.current = next
    // The Vite demo accounts share the seeded local workspace so the guest
    // flow mirrors the production household membership. Cloudflare always
    // uses the account-specific remote workspace returned by the API.
    const workspaceOwner = sessionOwner(next)
    if (next.mode === 'cloudflare' && !next.household) {
      hydrationCancelledRef.current = true
      const current = stateRef.current
      await Promise.all([
        clearState(globalThis.localStorage, workspaceOwner),
        next?.username && next?.userId ? clearState(globalThis.localStorage, next.username) : Promise.resolve(),
        current.baby?.id ? clearLocalBabyAlbum(current.baby.id).catch(() => {}) : Promise.resolve(),
      ])
      clearExperienceCache({ storage: globalThis.localStorage })
      const initial = createInitialState()
      stateRef.current = initial
      setState(initial)
      navigate(inviteToken ? buildInviteRoute(inviteToken) : ROUTES.household)
      return
    }
    let current = loadState(globalThis.localStorage, workspaceOwner)
    if (next.mode === 'demo') current = demoWorkspace(next)
    const remoteBaby = next.babies?.[0]
    if (next.mode === 'showcase') {
      try {
        const remote = await pullShowcaseWorkspace()
        if (remote?.baby) {
          current = {
            ...createInitialState(),
            ...remote,
            preferences: { ...current.preferences, locale: remote.baby.locale || current.preferences.locale },
          }
        }
      } catch (error) {
        if ([401, 403].includes(error?.status)) {
          handleAuthRevoked()
          return
        }
        setAuthError(error.message)
      }
    } else if (next.mode === 'cloudflare' && remoteBaby?.id) {
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
        if ([401, 403].includes(error?.status)) {
          handleAuthRevoked()
          return
        }
        setAuthError(error.message)
      }
      if (!current.baby) current = { ...current, baby: remoteBaby }
    }
    current = applyCareEventsToLegacy(migrateLegacyState(current), current.careEvents || [])
    stateRef.current = current
    saveState(globalThis.localStorage, current, workspaceOwner)
    setState(current)
    if (next.mode === 'cloudflare' && remoteBaby?.id) void pullEventWorkspace(sessionOwner(next), remoteBaby.id)
    if (next.role === 'guest' && !current.baby) {
      setAuthError('当前账号暂未关联宝宝档案，请联系管理员。')
      return
    }
    if (next.mode === 'cloudflare' && !next.household) {
      navigate(inviteToken ? buildInviteRoute(inviteToken) : ROUTES.household)
    } else {
      navigate(current.baby ? ROUTES.today : ROUTES.onboarding)
    }
  }

  useEffect(() => {
    if (visitorToken) return undefined
    if (sessionRefreshStartedRef.current || (session && session.mode !== 'cloudflare')) return undefined
    sessionRefreshStartedRef.current = true
    let active = true
    resumeSession().then(async (next) => {
      if (!active) return
      if (!next) {
        if (sessionRef.current?.mode === 'cloudflare') handleAuthRevoked()
        return
      }
      await activateSession(next)
    }).catch((error) => {
      if (active && error?.message) setAuthError(error.message)
    })
    return () => { active = false }
    // activateSession intentionally remains a stable-in-practice component
    // helper; the effect only needs to rerun when the auth state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, visitorToken])

  async function handleLogin(email, password) {
    setAuthError('')
    try {
      const next = await login(email, password)
      await activateSession(next)
    } catch (error) {
      setAuthError(error.message || '邮箱或密码不正确')
      return null
    }
  }

  async function handleNicknameChange(nickname) {
    try {
      const user = await updateNickname(nickname)
      const next = { ...sessionRef.current, nickname: user.nickname, displayName: user.nickname }
      persistSession(next)
      sessionRef.current = next
      setSession(next)
      return user
    } catch (error) {
      setAuthError(error.message || '昵称保存失败')
      throw error
    }
  }

  async function handleInviteAccepted(token) {
    const payload = await acceptHouseholdInvite(token)
    const household = payload.household
    const next = {
      ...sessionRef.current,
      household,
      role: household?.role || 'member',
      babies: household?.baby ? [household.baby] : [],
    }
    persistSession(next)
    await activateSession(next)
  }

  async function handleLogout() {
    const current = sessionRef.current
    const owner = sessionOwner(current)
    const babyId = stateRef.current.baby?.id
    await logout({ remote: ['cloudflare', 'showcase'].includes(current?.mode) })
    if (['demo', 'showcase'].includes(current?.mode)) sessionRefreshStartedRef.current = true
    clearState(globalThis.localStorage, owner)
    if (current?.userId && current?.username) clearState(globalThis.localStorage, current.username)
    if (babyId) void clearLocalBabyAlbum(babyId).catch(() => {})
    clearExperienceCache({ storage: globalThis.localStorage })
    sessionRef.current = null
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
    clearState(globalThis.localStorage, sessionOwner(session))
    if (session?.userId && session?.username) clearState(globalThis.localStorage, session.username)
    const initial = createInitialState()
    stateRef.current = initial
    setState(initial)
    navigate(session && canEdit(session) ? ROUTES.onboarding : ROUTES.login)
    return true
  }

  if (visitorToken) return <VisitorView token={visitorToken} locale={state.preferences.locale} />

  if (!session || route === ROUTES.login || route === ROUTES.resetPassword || (session?.role === 'guest' && !state.baby)) {
    const returnTo = inviteToken ? buildInviteRoute(inviteToken) : ROUTES.household
    const callbackURL = `${globalThis.location?.origin || ''}/${returnTo}`
    const resetParams = new URLSearchParams(globalThis.location?.search || '')
    const resetToken = route === ROUTES.resetPassword ? resetParams.get('token') || '' : ''
    const resetError = route === ROUTES.resetPassword ? resetParams.get('error') || '' : ''
    return <LoginView key={route} locale={state.preferences.locale} onLocaleChange={(locale) => commitState((current) => ({ ...current, preferences: { ...current.preferences, locale } }))} onLogin={handleLogin} onRegister={async (input) => { setAuthError(''); await register(input, { callbackURL }) }} onGoogleLogin={() => startGoogleLogin(returnTo)} onForgotPassword={(email) => requestPasswordReset(email)} onResetPassword={({ token, password }) => resetPassword({ token, password })} onResetComplete={() => { globalThis.history?.replaceState(null, '', `${globalThis.location?.pathname || '/'}${ROUTES.login}`); navigate(ROUTES.login) }} onResendVerification={(email) => resendVerification(email, { callbackURL })} resetMode={route === ROUTES.resetPassword} resetToken={resetToken} resetError={resetError} error={authError} noProfile={session?.role === 'guest' && !state.baby} />
  }

  if (session.mode === 'cloudflare' && !session.household && route !== ROUTES.onboarding) {
    return <HouseholdGate key={inviteToken || 'household'} locale={state.preferences.locale} inviteToken={inviteToken} onCreate={() => navigate(ROUTES.onboarding)} onOpenInvite={(token) => navigate(token ? buildInviteRoute(token) : ROUTES.household)} onAccept={handleInviteAccepted} />
  }

  if (!state.baby || route === ROUTES.onboarding) {
    return <Onboarding onCreate={createBaby} locale={state.preferences.locale} onLocaleChange={(locale) => commitState((current) => ({ ...current, preferences: { ...current.preferences, locale } }))} />
  }

  if (route === ROUTES.settings) {
    return <SettingsView state={state} setState={commitState} onClear={clearWorkspace} onLogout={handleLogout} readOnly={readOnly} cloudMode={session?.mode === 'cloudflare'} householdRole={session?.household?.role || session?.role} nickname={session?.nickname || session?.displayName || '家长'} onNicknameChange={handleNicknameChange} />
  }

  if (route === ROUTES.records) {
    return <RecordCenter state={state} commitState={commitState} onLogout={handleLogout} readOnly={readOnly} role={session?.role} />
  }

  if ([ROUTES.healthDiseases, ROUTES.healthOrgans].includes(route)) {
    return <PediatricDiseasesView key={route} route={route} state={state} setState={commitState} onClear={clearWorkspace} onLogout={handleLogout} readOnly={readOnly} role={session?.role} />
  }

  if (route === ROUTES.summary) {
    return <DoctorSummaryView state={state} onBack={() => navigate(ROUTES.today)} onClear={clearWorkspace} readOnly={readOnly} onLogout={handleLogout} />
  }

  if (route === ROUTES.experience) {
    return <ExperienceView state={state} setState={commitState} onClear={clearWorkspace} onLogout={handleLogout} readOnly={readOnly} role={session?.role} remote={session?.mode === 'cloudflare'} />
  }

  if (route === ROUTES.naibaAi) {
    const returnTo = resolveNaibaReturnTo(location.params.get('returnTo')) || ROUTES.today
    return <NaibaAiView state={state} commitState={commitState} cloudMode={session?.mode === 'cloudflare'} demoMode={['demo', 'showcase'].includes(session?.mode)} onBack={() => navigate(returnTo)} onClear={clearWorkspace} onLogout={handleLogout} readOnly={readOnly} role={session?.role} />
  }

  if (route === ROUTES.healthVaccines) {
    return <VaccineView state={state} setState={commitState} onClear={clearWorkspace} onLogout={handleLogout} readOnly={readOnly} role={session?.role} />
  }

  return <Workspace route={route} state={state} setState={commitState} onClear={clearWorkspace} onLogout={handleLogout} readOnly={readOnly} role={session?.role} cloudMode={session?.mode === 'cloudflare'} showcaseMode={session?.mode === 'showcase'} />
}
