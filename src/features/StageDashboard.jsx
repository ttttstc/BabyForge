import { useMemo, useState } from 'react'
import { Baby, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, LineChart, Plus, ShieldCheck } from 'lucide-react'
import { getAgeDays, getStage } from '../domain/baby.js'
import { GROWTH_TYPES, getAdminTasks, getCalendarEvents, getMonthDays, getStageMilestones, localDateKey } from '../domain/carePlan.js'
import { createEvaluatedGrowthMeasurement, evaluateGrowthMeasurement, getGrowthAgeContext, growthReferenceLabel, growthSourceLabel, growthTrajectoryLabel, GROWTH_AGE_BASES, GROWTH_SOURCES } from '../domain/growth.js'
import { createCareEvent } from '../domain/careEvents.js'
import { Header } from './Header.jsx'
import { AdminTaskList } from './AdminTaskList.jsx'
import { eventTitle } from '../domain/careSummary.js'

function localized(value, locale) {
  return value?.[locale === 'en-US' ? 'en' : 'zh'] || value?.zh || value || ''
}

function dayTitle(date, locale) {
  return date.toLocaleDateString(locale === 'en-US' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric', weekday: 'short' })
}

export function StageDashboard({ state, setState, onClear, onLogout, readOnly = false, role = 'admin' }) {
  const locale = state.preferences.locale
  const isEnglish = locale === 'en-US'
  const ageDays = useMemo(() => getAgeDays(state.baby.birthDate), [state.baby.birthDate])
  const stage = useMemo(() => getStage(ageDays), [ageDays])
  const milestones = useMemo(() => getStageMilestones(stage.id, state.milestoneRecords), [stage.id, state.milestoneRecords])
  const adminTasks = useMemo(() => getAdminTasks(stage.id, ageDays, state.adminTaskRecords), [stage.id, ageDays, state.adminTaskRecords])
  const calendarEvents = useMemo(() => getCalendarEvents(state.baby, state.milestoneRecords, state.adminTaskRecords), [state.baby, state.milestoneRecords, state.adminTaskRecords])
  const today = new Date()
  const [calendarCursor, setCalendarCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(localDateKey(today))
  const [growthType, setGrowthType] = useState('weight')
  const [growthValue, setGrowthValue] = useState('')
  const [growthDate, setGrowthDate] = useState(localDateKey(today))
  const [growthSource, setGrowthSource] = useState('caregiver_observation')
  const [growthAgeBasis, setGrowthAgeBasis] = useState(state.baby.growthAgeBasis || 'chronological')

  const monthDays = useMemo(() => getMonthDays(calendarCursor.getFullYear(), calendarCursor.getMonth()), [calendarCursor])
  const selectedDateObject = new Date(`${selectedDate}T12:00:00`)
  const selectedLogs = state.taskLogs.filter((item) => item.date === selectedDate)
  const selectedMeasurements = state.growthMeasurements.filter((item) => item.measuredAt === selectedDate)
  const selectedCareEvents = state.careEvents.filter((item) => String(item.occurredAt || item.createdAt).slice(0, 10) === selectedDate && item.status !== 'voided')
  const completed = milestones.filter((item) => item.status === 'done').length
  const evaluations = useMemo(() => state.growthMeasurements.map((item) => ({ ...item, evaluation: evaluateGrowthMeasurement(item, state.baby, state.growthMeasurements) })), [state.baby, state.growthMeasurements])

  function appendCareEvent(category, payload, occurredAt = new Date().toISOString(), kind = category === 'growth_measurement' ? 'measurement' : 'caregiver_observation') {
    return setState((current) => ({ ...current, careEvents: [...current.careEvents, createCareEvent({ id: payload?.id, babyId: current.baby.id, kind, category, occurredAt, recordedAt: new Date().toISOString(), actor: current.careActors.find((actor) => actor.id === current.preferences.currentRecorderId) || current.careActors[0], source: 'caregiver', payload })] }))
  }

  function updateMilestone(milestoneId, status) {
    return appendCareEvent('milestone', { milestoneId, status })
  }

  function addMeasurement(event) {
    event.preventDefault()
    if (!growthValue.trim()) return
    const method = growthType === 'weight' ? 'weight_scale' : growthType === 'length' ? 'lying_length' : 'head_circumference_tape'
    const measurement = createEvaluatedGrowthMeasurement({ type: growthType, value: growthValue, measuredAt: growthDate, source: growthSource, method, ageBasis: growthAgeBasis }, state.baby, state.growthMeasurements)
    const save = appendCareEvent('growth_measurement', measurement, `${growthDate}T12:00:00.000Z`, 'measurement')
    return Promise.resolve(save).then(() => {
      setGrowthValue('')
      return measurement
    })
  }

  function updateAdminTask(taskId, input) {
    return appendCareEvent('admin_task', { taskId, ...input })
  }

  function moveMonth(offset) {
    setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  return (
    <main className="app-shell stage-dashboard-shell">
      <Header route={ROUTES_STAGE} baby={state.baby} ageDays={ageDays} onClear={onClear} onLogout={onLogout} readOnly={readOnly} role={role} locale={locale} careActors={state.careActors} currentRecorderId={state.preferences.currentRecorderId} onRecorderChange={(value) => setState((current) => ({ ...current, preferences: { ...current.preferences, currentRecorderId: value } }))} syncStatus={state.syncMeta?.status} onSyncRetry={() => window.dispatchEvent(new Event('babyforge:sync-retry'))} />
      <div className="stage-dashboard">
        <header className="stage-dashboard-hero">
          <div><p className="eyebrow">{isEnglish ? 'Milestone workspace · 0–28 days' : '阶段里程碑工作台 · 0–28 天'}</p><h1>{localized(stage.label, locale)}</h1><p>{localized(stage.rangeLabel, locale)} · {isEnglish ? 'Turn a newborn stage into a few doable care steps.' : '把阶段目标变成少数几件今天能完成的照护动作。'}</p></div>
        </header>
        <div className="stage-dashboard-grid">
          <GrowthCard locale={locale} baby={state.baby} growthAgeBasis={growthAgeBasis} setGrowthAgeBasis={(value) => { setGrowthAgeBasis(value); setState((current) => ({ ...current, baby: { ...current.baby, growthAgeBasis: value } })) }} measurements={state.growthMeasurements} evaluations={evaluations} growthType={growthType} setGrowthType={setGrowthType} growthValue={growthValue} setGrowthValue={setGrowthValue} growthDate={growthDate} setGrowthDate={setGrowthDate} growthSource={growthSource} setGrowthSource={setGrowthSource} onSubmit={addMeasurement} readOnly={readOnly} />

          <section className="stage-board-card">
            <header className="dashboard-card-heading"><div><p className="eyebrow">{isEnglish ? 'Care milestones' : '照护里程碑'}</p><h2>{isEnglish ? 'What to complete in this stage' : '这个阶段要完成什么'}</h2></div><strong>{completed}/{milestones.length}</strong></header>
            <p className="dashboard-card-lede">{isEnglish ? 'These are caregiver actions, not developmental grades. Mark only what your family actually did.' : '这里记录的是照护动作，不是发育评分。只勾选家里确实完成的事项。'}</p>
            <div className="milestone-list">
              {milestones.map((milestone) => {
                const done = milestone.status === 'done'
                return <article className={`milestone-card ${done ? 'done' : ''}`} key={milestone.id}>
                  <button className="milestone-check" disabled={readOnly} onClick={() => updateMilestone(milestone.id, done ? 'pending' : 'done')} aria-pressed={done} aria-label={`${localized(milestone.title, locale)} ${done ? (isEnglish ? 'completed' : '已完成') : (isEnglish ? 'mark complete' : '标记完成')}`}>{done ? <Check size={16} /> : <span>{milestone.dueDay}</span>}</button>
                  <div><strong>{localized(milestone.title, locale)}</strong><p>{localized(milestone.detail, locale)}</p><small>{isEnglish ? `Around day ${milestone.dueDay}` : `出生后第 ${milestone.dueDay} 天左右`}</small></div>
                </article>
              })}
            </div>
          </section>

          <AdminTaskList tasks={adminTasks} locale={locale} onUpdate={updateAdminTask} readOnly={readOnly} />

          <CalendarCard locale={locale} monthDays={monthDays} cursor={calendarCursor} selectedDate={selectedDate} onSelect={setSelectedDate} onMove={moveMonth} taskLogs={state.taskLogs} measurements={state.growthMeasurements} careEvents={state.careEvents} calendarEvents={calendarEvents} />

          <section className="stage-day-card">
            <header className="dashboard-card-heading"><div><p className="eyebrow">{isEnglish ? 'Selected day' : '选中日期'}</p><h2>{dayTitle(selectedDateObject, locale)}</h2></div><CalendarDays size={18} /></header>
            <div className="selected-day-grid"><div><span>{isEnglish ? 'Care actions' : '照护事项'}</span><strong>{selectedLogs.filter((item) => item.status === 'done').length} / {selectedLogs.length || 3}</strong></div><div><span>{isEnglish ? 'Care records' : '关键记录'}</span><strong>{selectedCareEvents.length}</strong></div><div><span>{isEnglish ? 'Measurements' : '成长测量'}</span><strong>{selectedMeasurements.length}</strong></div></div>
            {selectedLogs.length === 0 && selectedMeasurements.length === 0 && selectedCareEvents.length === 0 ? <p className="empty-dashboard">{isEnglish ? 'No extra records for this day. Today’s checklist stays lightweight.' : '这一天暂无补充记录。今日清单保持轻量即可。'}</p> : <ul className="selected-day-list">{selectedLogs.map((item) => <li key={item.id}><Check size={14} />{item.taskId} · {item.status === 'done' ? (isEnglish ? 'done' : '已完成') : item.status}</li>)}{selectedCareEvents.map((item) => <li key={item.id}><Baby size={14} />{eventTitle(item, locale)} · {item.recordedBy?.displayName || (isEnglish ? 'caregiver' : '照护者')}</li>)}{selectedMeasurements.map((item) => <li key={item.id}><LineChart size={14} />{item.type}: {item.value} {item.unit}</li>)}</ul>}
          </section>
        </div>
        <div className="stage-boundary-note"><ShieldCheck size={16} /><span>{isEnglish ? 'Each measurement keeps its date and source for follow-up or a care conversation.' : '每次测量都保留日期和来源，方便后续复查或咨询专业人员。'}</span><CircleHelp size={15} /></div>
      </div>
    </main>
  )
}

function CalendarCard({ locale, monthDays, cursor, selectedDate, onSelect, onMove, taskLogs, measurements, careEvents = [], calendarEvents }) {
  const isEnglish = locale === 'en-US'
  const today = localDateKey()
  const dayLabels = isEnglish ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['日', '一', '二', '三', '四', '五', '六']
  const eventsByDate = new Map()
  calendarEvents.forEach((event) => eventsByDate.set(event.date, [...(eventsByDate.get(event.date) || []), event]))
  const selectedEvents = eventsByDate.get(selectedDate) || []
  return <section className="stage-calendar-card">
    <header className="dashboard-card-heading"><div><p className="eyebrow">{isEnglish ? 'Local calendar' : '本地日历'}</p><h2>{cursor.toLocaleDateString(isEnglish ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'long' })}</h2></div><div className="calendar-nav"><button onClick={() => onMove(-1)} aria-label={isEnglish ? 'Previous month' : '上个月'}><ChevronLeft size={15} /></button><button onClick={() => onMove(1)} aria-label={isEnglish ? 'Next month' : '下个月'}><ChevronRight size={15} /></button></div></header>
    <div className="calendar-weekdays">{dayLabels.map((label) => <span key={label}>{label}</span>)}</div>
    <div className="calendar-grid">{monthDays.map(({ date, key, inMonth }) => {
      const hasLog = taskLogs.some((item) => item.date === key)
      const hasMeasurement = measurements.some((item) => item.measuredAt === key)
      const hasCareEvent = careEvents.some((item) => item.status !== 'voided' && String(item.occurredAt || item.createdAt).slice(0, 10) === key)
      const events = eventsByDate.get(key) || []
      const markerLabel = events.map((event) => localized(event.title, locale)).join('、')
      const eventLabel = events.length > 0 ? `${localized(events[0].title, locale)}${events.length > 1 ? ` +${events.length - 1}` : ''}` : ''
      return <button key={key} className={`calendar-day ${inMonth ? '' : 'muted'} ${key === today ? 'today' : ''} ${key === selectedDate ? 'selected' : ''}`} onClick={() => onSelect(key)} aria-label={`${key}${markerLabel ? ` · ${markerLabel}` : ''}`} title={markerLabel || undefined}><span>{date.getDate()}</span><i className="calendar-markers">{events.slice(0, 3).map((event) => <b key={event.id} className={`calendar-marker ${event.kind} ${event.status === 'done' ? 'done' : ''}`} aria-hidden="true" />)}{!events.length && (hasLog || hasMeasurement || hasCareEvent) && <b className="calendar-marker record" aria-hidden="true" />}</i>{eventLabel && <small className="calendar-day-label">{eventLabel}</small>}</button>
    })}</div>
    <p className="calendar-legend"><span><b className="calendar-marker admin" /> {isEnglish ? 'care task' : '照护代办'}</span><span><b className="calendar-marker milestone" /> {isEnglish ? 'milestone' : '里程碑'}</span><span><b className="calendar-marker anniversary" /> {isEnglish ? 'anniversary' : '纪念日'}</span><span><b className="calendar-marker record" /> {isEnglish ? 'record' : '已有记录'}</span></p>
    {selectedEvents.length > 0 && <div className="calendar-event-list"><strong>{isEnglish ? 'Selected date' : '当天事项'}</strong>{selectedEvents.map((event) => <div key={event.id} className={event.status === 'done' ? 'done' : ''}><span className={`calendar-marker ${event.kind} ${event.status === 'done' ? 'done' : ''}`} /><p><b>{localized(event.title, locale)}</b><small>{localized(event.detail, locale)}</small></p></div>)}</div>}
  </section>
}

function GrowthCard({ locale, baby, growthAgeBasis, setGrowthAgeBasis, measurements, evaluations, growthType, setGrowthType, growthValue, setGrowthValue, growthDate, setGrowthDate, growthSource, setGrowthSource, onSubmit, readOnly = false }) {
  const isEnglish = locale === 'en-US'
  const [entryError, setEntryError] = useState('')
  const values = measurements.filter((item) => item.type === growthType).sort((a, b) => String(a.measuredAt).localeCompare(String(b.measuredAt))).slice(-8)
  const definition = GROWTH_TYPES.find((item) => item.id === growthType)
  const max = Math.max(...values.map((item) => Number(item.value) || 0), 1)
  const latest = [...evaluations].filter((item) => item.type === growthType && item.evaluation?.dataQuality === 'sufficient').sort((a, b) => String(a.measuredAt).localeCompare(String(b.measuredAt))).at(-1)
  const latestAttempt = [...evaluations].filter((item) => item.type === growthType).sort((a, b) => String(a.measuredAt).localeCompare(String(b.measuredAt))).at(-1)
  const age = getGrowthAgeContext(baby, localDateKey(), growthAgeBasis)
  const ageLabel = isEnglish ? `${age.ageDays} days · ${age.basis}` : `${age.ageDays} 天 · ${age.basis === 'corrected' ? '矫正年龄' : age.basis === 'postmenstrual' ? '经后年龄' : '实际年龄'}`
  return <section className="growth-card">
    <header className="dashboard-card-heading"><div><p className="eyebrow">{isEnglish ? 'Growth facts' : '成长参数'}</p><h2>{isEnglish ? 'Record and review growth' : '记录并查看成长参数'}</h2></div><LineChart size={18} /></header>
    <div className="growth-switcher">{GROWTH_TYPES.map((item) => <button key={item.id} className={growthType === item.id ? 'active' : ''} onClick={() => setGrowthType(item.id)}>{localized(item.label, locale)}</button>)}</div>
    {values.length ? <div className="growth-bars" aria-label={isEnglish ? `${localized(definition.label, locale)} changes over time` : `${localized(definition.label, locale)}按日期变化`}>{values.map((item) => <div key={item.id} className="growth-bar-item"><span style={{ height: `${Math.max(12, ((Number(item.value) || 0) / max) * 100)}%` }} /><small>{item.value}</small><em>{item.measuredAt.slice(5)}</em></div>)}</div> : <div className="growth-empty"><LineChart size={24} /><p>{isEnglish ? 'Record weight, length, or head circumference to review changes by date.' : '记录体重、身长或头围，之后按日期查看变化。'}</p></div>}
    <form className="growth-entry" onSubmit={(event) => { const result = onSubmit(event); if (!result) return; void Promise.resolve(result).then((value) => setEntryError(value?.evaluation?.dataQuality === 'sufficient' ? '' : value?.evaluation?.limitations?.[0] || (isEnglish ? 'Verify this measurement before relying on it.' : '请先复核这次测量。'))).catch((error) => setEntryError(error?.message || (isEnglish ? 'Could not save this measurement.' : '这次测量保存失败。'))) }}><fieldset disabled={readOnly}><label><span className="sr-only">{isEnglish ? 'Value' : '数值'}</span><input inputMode="decimal" value={growthValue} onChange={(event) => setGrowthValue(event.target.value)} placeholder={isEnglish ? 'Value' : '数值'} aria-label={isEnglish ? 'Growth value' : '成长数值'} /><small>{definition.unit}</small></label><label><span className="sr-only">{isEnglish ? 'Date' : '日期'}</span><input type="date" value={growthDate} onChange={(event) => setGrowthDate(event.target.value)} aria-label={isEnglish ? 'Measurement date' : '测量日期'} /></label><button className="primary-button compact" type="submit"><Plus size={15} />{isEnglish ? 'Add' : '补录'}</button></fieldset>{entryError && <p className="growth-entry-error" role="alert">{entryError}</p>}</form>
    <div className="growth-state-summary">
      <div><span>{isEnglish ? 'Age calculation' : '年龄计算方式'}</span><strong>{ageLabel}</strong></div>
      <div><span>{isEnglish ? 'Latest record' : '最近一次记录'}</span><strong>{latestAttempt ? `${latestAttempt.value} ${latestAttempt.unit} · ${latestAttempt.measuredAt}` : (isEnglish ? 'None yet' : '暂无')}</strong></div>
      <div><span>{isEnglish ? 'Reference information' : '参考信息'}</span><strong>{latest ? growthReferenceLabel(latest.evaluation, locale) : (isEnglish ? 'Appears after a valid record' : '记录后显示')}</strong></div>
    </div>
    {latest && <div className="growth-evaluation-note"><strong>{isEnglish ? `${latest.evaluation.standardPackageId} · version ${latest.evaluation.standardVersion}` : `${latest.evaluation.standardPackageId} · 版本 ${latest.evaluation.standardVersion}`}</strong><span>{growthSourceLabel(latest.evaluation.measurementSource, locale)} · {growthTrajectoryLabel(latest.evaluation.trajectoryStatus, locale)}</span>{latest.evaluation.birthSizeCategory && <span>{isEnglish ? `Birth size: ${latest.evaluation.birthSizeCategory}` : `出生时胎龄大小：${latest.evaluation.birthSizeCategory}`}</span>}<a href={latest.evaluation.standardSourceUrl} target="_blank" rel="noreferrer">{isEnglish ? 'Official standard source' : '官方标准来源'}</a></div>}
    {latestAttempt && latestAttempt.evaluation?.dataQuality !== 'sufficient' && <div className="growth-evaluation-warning" role="alert"><strong>{isEnglish ? 'This record needs checking before it can be used for reference.' : '这次记录需要核对后才能用于参考。'}</strong><span>{latestAttempt.evaluation.limitations?.[0] || (isEnglish ? 'Verify the date, unit, and profile details.' : '请核对日期、单位和档案信息。')}</span>{latestAttempt.evaluation.standardSourceUrl && <a href={latestAttempt.evaluation.standardSourceUrl} target="_blank" rel="noreferrer">{isEnglish ? 'Check the official source' : '查看官方标准来源'}</a>}</div>}
    <div className="growth-entry-meta"><label><span>{isEnglish ? 'Age basis' : '年龄口径'}</span><select value={growthAgeBasis} onChange={(event) => setGrowthAgeBasis(event.target.value)} disabled={readOnly} aria-label={isEnglish ? 'Growth age basis' : '成长年龄口径'}>{GROWTH_AGE_BASES.map((basis) => <option key={basis} value={basis}>{basis === 'corrected' ? (isEnglish ? 'Corrected age' : '矫正年龄') : basis === 'postmenstrual' ? (isEnglish ? 'Postmenstrual age' : '经后年龄') : (isEnglish ? 'Chronological age' : '实际年龄')}</option>)}</select></label><label><span>{isEnglish ? 'Source' : '来源'}</span><select value={growthSource} onChange={(event) => setGrowthSource(event.target.value)} disabled={readOnly} aria-label={isEnglish ? 'Growth measurement source' : '成长测量来源'}>{GROWTH_SOURCES.map((source) => <option key={source} value={source}>{growthSourceLabel(source, locale)}</option>)}</select></label></div>
    <small className="growth-source"><Baby size={13} />{isEnglish ? 'Reference information follows the selected official growth standard; it is not a diagnosis or developmental conclusion. Raw values and sources stay attached for follow-up.' : '参考信息来自所选官方生长标准，不代表诊断或发育结论；原始数值和来源会保留，方便后续复查。'}</small>
  </section>
}

const ROUTES_STAGE = '#/stage/newborn'
