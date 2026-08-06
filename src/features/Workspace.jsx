import { useMemo, useState } from 'react'
import { Maximize2, Minimize2, PanelBottom } from 'lucide-react'
import { getAgeDays, getStage } from '../domain/baby.js'
import { createObservation } from '../domain/observation.js'
import { getAdminTasks, getDailyTasks, updateTaskLog, upsertAdminTaskRecord } from '../domain/carePlan.js'
import { createGrowthMeasurement } from '../domain/carePlan.js'
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
    const observation = createObservation(input)
    setState((current) => ({ ...current, observations: [...current.observations, observation] }))
  }

  function updateTask(taskId, input) {
    setState((current) => ({ ...current, taskLogs: updateTaskLog(current.taskLogs, taskId, input) }))
  }

  function addGrowth(measurement) {
    const next = measurement?.id ? measurement : createGrowthMeasurement(measurement || {})
    setState((current) => ({ ...current, growthMeasurements: [...current.growthMeasurements, next] }))
  }

  function updateAdminTask(taskId, input) {
    setState((current) => ({ ...current, adminTaskRecords: upsertAdminTaskRecord(current.adminTaskRecords, taskId, input) }))
  }

  if (route === ROUTES.stage) {
    return <StageDashboard state={state} setState={setState} onClear={onClear} onLogout={onLogout} readOnly={readOnly} role={role} />
  }

  return (
    <main className="app-shell">
      <Header route={route} baby={state.baby} ageDays={ageDays} onClear={onClear} onLogout={onLogout} readOnly={readOnly} role={role} locale={state.preferences.locale} careActors={state.careActors} currentRecorderId={state.preferences.currentRecorderId} onRecorderChange={(value) => updatePreference('currentRecorderId', value)} syncStatus={state.syncMeta?.status} />
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
