import { useMemo, useState } from 'react'
import { Maximize2, Minimize2, PanelBottom } from 'lucide-react'
import { getAgeDays, getStage } from '../domain/baby.js'
import { createObservation } from '../domain/observation.js'
import { getAdminTasks, getDailyTasks } from '../domain/carePlan.js'
import { createGrowthMeasurement } from '../domain/carePlan.js'
import { createCareEvent, createConcern as createConcernRecord } from '../domain/careEvents.js'
import { SUPPORT_TOPICS } from '../domain/healthSupport.js'
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
  const [sheet, setSheet] = useState('peek')
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
    const next = measurement?.id ? measurement : createGrowthMeasurement(measurement || {})
    const recorder = state.careActors.find((actor) => actor.id === state.preferences.currentRecorderId) || state.careActors[0]
    const event = createCareEvent({
      id: next.id,
      babyId: state.baby.id,
      kind: 'measurement',
      category: 'growth_measurement',
      occurredAt: `${next.measuredAt}T12:00:00.000Z`,
      recordedAt: next.createdAt,
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
    const event = createCareEvent({ ...canonicalInput, babyId: state.baby.id, kind: canonicalInput.kind || 'caregiver_observation', category, occurredAt: canonicalInput.occurredAt || now, recordedAt: canonicalInput.recordedAt || now, source: 'caregiver', actor: recorder })
    return setState((current) => ({ ...current, careEvents: [...current.careEvents, event] }))
  }

  function createSupportConcern(input) {
    const topic = SUPPORT_TOPICS.find((item) => item.id === input.topicId)
    if (!topic) throw new Error('未找到关注类型')
    const concern = { ...createConcernRecord({ babyId: state.baby.id, topicId: input.topicId, title: topic.title, status: 'open' }), plan: input.plan || null, facts: input.facts || [], notes: input.notes || '' }
    const recorder = state.careActors.find((actor) => actor.id === state.preferences.currentRecorderId) || state.careActors[0]
    const event = createCareEvent({
      babyId: state.baby.id,
      kind: 'caregiver_observation',
      category: input.topicId,
      source: 'caregiver',
      actor: recorder,
      payload: { concernId: concern.id, supportTopic: input.topicId, supportTitle: topic.title, facts: input.facts || [], notes: input.notes || '', plan: input.plan || null },
    })
    return setState((current) => ({ ...current, concerns: [...current.concerns, concern], careEvents: [...current.careEvents, event] })).then(() => concern)
  }

  function resolveSupportConcern(concernId) {
    const now = new Date().toISOString()
    const recorder = state.careActors.find((actor) => actor.id === state.preferences.currentRecorderId) || state.careActors[0]
    const concern = state.concerns.find((item) => item.id === concernId)
    return setState((current) => ({
      ...current,
      concerns: current.concerns.map((item) => item.id === concernId ? { ...item, status: 'closed', updatedAt: now } : item),
      careEvents: [...current.careEvents, createCareEvent({ babyId: state.baby.id, kind: 'caregiver_observation', category: 'care_action', source: 'caregiver', actor: recorder, payload: { concernId, supportStatus: 'closed', supportTitle: concern?.title || '' } })],
    }))
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
        <div className="mobile-sheet-controls" data-testid="mobile-sheet-controls" aria-label="详情抽屉高度">
          <button className={sheet === 'peek' ? 'active' : ''} onClick={() => setSheet('peek')}><Minimize2 size={15} />收起</button>
          <button className={sheet === 'half' ? 'active' : ''} onClick={() => setSheet('half')}><PanelBottom size={15} />半屏</button>
          <button className={sheet === 'full' ? 'active' : ''} onClick={() => setSheet('full')}><Maximize2 size={15} />全屏</button>
        </div>
        <ContextInspector
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
          concerns={state.concerns}
          onQuickRecord={recordCareEvent}
          onCreateConcern={createSupportConcern}
          onResolveConcern={resolveSupportConcern}
          questions={state.questions}
          onQuestionsChange={(questions) => setState((current) => ({ ...current, questions }))}
          sheet={sheet}
          locale={state.preferences.locale}
          readOnly={readOnly}
        />
      </div>
    </main>
  )
}
