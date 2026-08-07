import { useMemo } from 'react'
import { getAgeDays, getStage } from '../domain/baby.js'
import { getAdminTasks, getDailyTasks, localDateKey } from '../domain/carePlan.js'
import { createCareEvent, createConcern as createConcernRecord, occurredAtErrorMessage, validateOccurredAt, voidCareEvent } from '../domain/careEvents.js'
import { SUPPORT_TOPICS } from '../domain/healthSupport.js'
import { ROUTES } from '../app/router.js'
import { Header } from './Header.jsx'
import { LeftRail } from './LeftRail.jsx'
import { StageSurface } from './StageSurface.jsx'
import { BabyAlbum } from './BabyAlbum.jsx'
import { ContextInspector } from './ContextInspector.jsx'
import { StageDashboard } from './StageDashboard.jsx'

export function Workspace({ route, state, setState, onClear, onLogout, readOnly = false, role = 'admin', cloudMode = false }) {
  const ageDays = useMemo(() => getAgeDays(state.baby.birthDate), [state.baby.birthDate])
  const stage = useMemo(() => getStage(ageDays), [ageDays])
  const topicMode = route === ROUTES.jaundice
  const dailyTasks = useMemo(() => getDailyTasks(state.taskLogs, undefined, stage.id), [state.taskLogs, stage.id])
  const adminTasks = useMemo(() => getAdminTasks(stage.id, ageDays, state.adminTaskRecords), [stage.id, ageDays, state.adminTaskRecords])

  function updatePreference(key, value) {
    setState((current) => ({ ...current, preferences: { ...current.preferences, [key]: value } }))
  }

  function updateTask(taskId, input) {
    const now = new Date().toISOString()
    const date = input.date || localDateKey()
    const recorder = state.careActors.find((actor) => actor.id === state.preferences.currentRecorderId) || state.careActors[0]
    const event = createCareEvent({ babyId: state.baby.id, kind: 'caregiver_observation', category: 'care_action', occurredAt: `${date}T12:00:00.000Z`, recordedAt: now, actor: recorder, source: 'caregiver', payload: { taskId, date, status: input.status || 'done', performedBy: input.actor || null, note: input.note || '' } })
    return setState((current) => ({ ...current, careEvents: [...current.careEvents, event] }))
  }

  function updateAdminTask(taskId, input) {
    const now = new Date().toISOString()
    const recorder = state.careActors.find((actor) => actor.id === state.preferences.currentRecorderId) || state.careActors[0]
    return setState((current) => ({ ...current, careEvents: [...current.careEvents, createCareEvent({ babyId: current.baby.id, kind: 'caregiver_observation', category: 'admin_task', occurredAt: now, recordedAt: now, actor: recorder, source: 'caregiver', payload: { taskId, ...input } })] }))
  }

  function recordCareEvent(input) {
    const recorder = state.careActors.find((actor) => actor.id === state.preferences.currentRecorderId) || state.careActors[0]
    const { type, ...canonicalInput } = input || {}
    const category = String(canonicalInput.category || type || '').trim()
    if (!category) throw new Error('事件必须提供 category')
    const now = new Date().toISOString()
    const occurredAt = canonicalInput.occurredAt || now
    const timeError = validateOccurredAt(occurredAt, { birthDate: state.baby.birthDate })
    if (timeError) throw new Error(occurredAtErrorMessage(timeError, state.preferences.locale))
    const event = createCareEvent({ ...canonicalInput, babyId: state.baby.id, kind: canonicalInput.kind || 'caregiver_observation', category, occurredAt, recordedAt: canonicalInput.recordedAt || now, source: 'caregiver', actor: recorder })
    return setState((current) => ({ ...current, careEvents: [...current.careEvents, event] }))
  }

  function createSupportConcern(input) {
    const topic = SUPPORT_TOPICS.find((item) => item.id === input.topicId)
    if (!topic) throw new Error('未找到关注类型')
    const concern = { ...createConcernRecord({ babyId: state.baby.id, topicId: input.topicId, title: topic.title, status: 'open' }), plan: input.plan || null, facts: input.facts || [], notes: input.notes || '' }
    const event = createCareEvent({ babyId: state.baby.id, kind: 'caregiver_observation', category: 'concern_open', source: 'caregiver', actor: state.careActors.find((actor) => actor.id === state.preferences.currentRecorderId) || state.careActors[0], payload: { concernId: concern.id, topicId: input.topicId, supportTopic: input.topicId, supportTitle: topic.title, facts: input.facts || [], notes: input.notes || '', plan: input.plan || null } })
    return setState((current) => ({ ...current, concerns: [...current.concerns, concern], careEvents: [...current.careEvents, event] })).then(() => concern)
  }

  function resolveSupportConcern(concernId) {
    const now = new Date().toISOString()
    const concern = state.concerns.find((item) => item.id === concernId)
    const recorder = state.careActors.find((actor) => actor.id === state.preferences.currentRecorderId) || state.careActors[0]
    return setState((current) => ({ ...current, concerns: current.concerns.map((item) => item.id === concernId ? { ...item, status: 'closed', updatedAt: now } : item), careEvents: [...current.careEvents, createCareEvent({ babyId: current.baby.id, kind: 'caregiver_observation', category: 'care_action', source: 'caregiver', actor: recorder, payload: { concernId, supportStatus: 'closed', supportTitle: concern?.title || '' } })] }))
  }

  function deleteQuickRecord(eventId) {
    if (readOnly) return Promise.resolve(false)
    const event = state.careEvents.find((item) => item.id === eventId)
    if (!event || event.status !== 'active' || !['breastfeeding', 'bottle_feeding', 'diaper'].includes(event.category)) return Promise.resolve(false)
    const now = new Date().toISOString()
    return setState((current) => {
      const currentEvent = current.careEvents.find((item) => item.id === eventId)
      if (!currentEvent || currentEvent.status !== 'active' || !['breastfeeding', 'bottle_feeding', 'diaper'].includes(currentEvent.category)) return current
      return { ...current, careEvents: current.careEvents.map((item) => item.id === eventId ? voidCareEvent(item, { now }) : item) }
    })
  }

  if (route === ROUTES.stage) {
    return <StageDashboard state={state} setState={setState} onClear={onClear} onLogout={onLogout} readOnly={readOnly} role={role} />
  }

  return (
    <main className="app-shell">
      <Header route={route} baby={state.baby} ageDays={ageDays} onClear={onClear} onLogout={onLogout} readOnly={readOnly} role={role} locale={state.preferences.locale} careActors={state.careActors} currentRecorderId={state.preferences.currentRecorderId} onRecorderChange={(value) => updatePreference('currentRecorderId', value)} syncStatus={state.syncMeta?.status} onSyncRetry={() => window.dispatchEvent(new Event('babyforge:sync-retry'))} />
      <div className="workspace-grid">
        <LeftRail baby={state.baby} ageDays={ageDays} stage={stage} locale={state.preferences.locale} />
        {route === ROUTES.today ? (
          <BabyAlbum key={state.baby.id} baby={state.baby} locale={state.preferences.locale} readOnly={readOnly} remote={cloudMode} />
        ) : (
          <StageSurface
            key={topicMode ? 'topic' : 'stage'}
            topicMode={topicMode}
            sex={state.baby.sex}
            locale={state.preferences.locale}
            sceneMode={state.preferences.sceneMode}
            onSceneModeChange={(value) => updatePreference('sceneMode', value)}
            performanceMode={state.preferences.performanceMode}
            onPerformanceModeChange={(value) => updatePreference('performanceMode', value)}
          />
        )}
        <ContextInspector
          baby={state.baby}
          topicMode={topicMode}
          stage={stage}
          tasks={dailyTasks}
          onTaskUpdate={updateTask}
          adminTasks={adminTasks}
          onAdminTaskUpdate={updateAdminTask}
          careEvents={state.careEvents}
          carePlanItems={state.carePlanItems}
          onDeleteQuickRecord={deleteQuickRecord}
          concerns={state.concerns}
          onQuickRecord={recordCareEvent}
          onCreateConcern={createSupportConcern}
          onResolveConcern={resolveSupportConcern}
          locale={state.preferences.locale}
          readOnly={readOnly}
        />
      </div>
    </main>
  )
}
