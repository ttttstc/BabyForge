import { useMemo } from 'react'
import { getAgeDays, getStage } from '../domain/baby.js'
import { createObservation } from '../domain/observation.js'
import { getAdminTasks, getDailyTasks } from '../domain/carePlan.js'
import { createEvaluatedGrowthMeasurement, evaluateGrowthMeasurement } from '../domain/growth.js'
import { createCareEvent, occurredAtErrorMessage, validateOccurredAt, voidCareEvent } from '../domain/careEvents.js'
import { ROUTES } from '../app/router.js'
import { Header } from './Header.jsx'
import { LeftRail } from './LeftRail.jsx'
import { StageSurface } from './StageSurface.jsx'
import { ContextInspector } from './ContextInspector.jsx'
import { StageDashboard } from './StageDashboard.jsx'

export function Workspace({ route, state, setState, onClear, onLogout, readOnly = false, role = 'admin' }) {
  const ageDays = useMemo(() => getAgeDays(state.baby.birthDate), [state.baby.birthDate])
  const stage = useMemo(() => getStage(ageDays), [ageDays])
  const topicMode = route === ROUTES.jaundice
  const dailyTasks = useMemo(() => getDailyTasks(state.taskLogs), [state.taskLogs])
  const adminTasks = useMemo(() => getAdminTasks(stage.id, ageDays, state.adminTaskRecords), [stage.id, ageDays, state.adminTaskRecords])

  function updatePreference(key, value) {
    setState((current) => ({ ...current, preferences: { ...current.preferences, [key]: value } }))
  }

  function saveObservation(input) {
    const now = new Date().toISOString()
    const observation = createObservation(input, { now })
    const recorder = state.careActors.find((actor) => actor.id === state.preferences.currentRecorderId) || state.careActors[0]
    const event = createCareEvent({
      babyId: state.baby.id,
      kind: 'caregiver_observation',
      category: input.topicId || 'observation',
      occurredAt: input.firstNoticedAt || now,
      recordedAt: now,
      actor: recorder,
      source: 'caregiver',
      payload: observation,
    })
    return setState((current) => ({ ...current, careEvents: [...current.careEvents, event] }))
  }

  function updateTask(taskId, input) {
    const now = new Date().toISOString()
    const date = input.date || new Date().toISOString().slice(0, 10)
    const recorder = state.careActors.find((actor) => actor.id === state.preferences.currentRecorderId) || state.careActors[0]
    const event = createCareEvent({
      babyId: state.baby.id,
      kind: 'caregiver_observation',
      category: 'care_action',
      occurredAt: `${date}T12:00:00.000Z`,
      recordedAt: now,
      actor: recorder,
      source: 'caregiver',
      payload: { taskId, date, status: input.status || 'done', performedBy: input.actor || null, note: input.note || '' },
    })
    return setState((current) => ({ ...current, careEvents: [...current.careEvents, event] }))
  }

  function addGrowth(measurement) {
    const now = new Date().toISOString()
    const next = measurement?.id
      ? { ...measurement, evaluation: evaluateGrowthMeasurement(measurement, state.baby, state.growthMeasurements) }
      : createEvaluatedGrowthMeasurement(measurement || {}, state.baby, state.growthMeasurements)
    const recorder = state.careActors.find((actor) => actor.id === state.preferences.currentRecorderId) || state.careActors[0]
    const event = createCareEvent({
      id: next.id,
      babyId: state.baby.id,
      kind: 'measurement',
      category: 'growth_measurement',
      occurredAt: `${next.measuredAt}T12:00:00.000Z`,
      recordedAt: now,
      actor: recorder,
      source: 'caregiver',
      payload: next,
    })
    return setState((current) => ({ ...current, careEvents: [...current.careEvents, event] }))
  }

  function updateAdminTask(taskId, input) {
    const now = new Date().toISOString()
    const recorder = state.careActors.find((actor) => actor.id === state.preferences.currentRecorderId) || state.careActors[0]
    return setState((current) => ({
      ...current,
      careEvents: [...current.careEvents, createCareEvent({
        babyId: current.baby.id,
        kind: 'caregiver_observation',
        category: 'admin_task',
        occurredAt: now,
        recordedAt: now,
        actor: recorder,
        source: 'caregiver',
        payload: { taskId, ...input },
      })],
    }))
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
        <ContextInspector
          baby={state.baby}
          topicMode={topicMode}
          stage={stage}
          tasks={dailyTasks}
          onTaskUpdate={updateTask}
          adminTasks={adminTasks}
          onAdminTaskUpdate={updateAdminTask}
          growthMeasurements={state.growthMeasurements}
          onAddGrowth={addGrowth}
          observations={state.observations}
          onSaveObservation={saveObservation}
          careEvents={state.careEvents}
          onDeleteQuickRecord={deleteQuickRecord}
          concerns={state.concerns}
          onQuickRecord={recordCareEvent}
          questions={state.questions}
          onQuestionsChange={(questions) => setState((current) => ({ ...current, questions }))}
          locale={state.preferences.locale}
          readOnly={readOnly}
        />
      </div>
    </main>
  )
}
