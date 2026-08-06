import { useMemo, useState } from 'react'
import { Baby, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, LineChart, Plus, ShieldCheck } from 'lucide-react'
import { getAgeDays, getStage } from '../domain/baby.js'
import { GROWTH_TYPES, createGrowthMeasurement, getAdminTasks, getCalendarEvents, getMonthDays, getStageMilestones, localDateKey, upsertAdminTaskRecord, upsertMilestoneRecord } from '../domain/carePlan.js'
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

  const monthDays = useMemo(() => getMonthDays(calendarCursor.getFullYear(), calendarCursor.getMonth()), [calendarCursor])
  const selectedDateObject = new Date(`${selectedDate}T12:00:00`)
  const selectedLogs = state.taskLogs.filter((item) => item.date === selectedDate)
  const selectedMeasurements = state.growthMeasurements.filter((item) => item.measuredAt === selectedDate)
  const selectedCareEvents = state.careEvents.filter((item) => String(item.occurredAt || item.createdAt).slice(0, 10) === selectedDate && item.status !== 'voided')
  const completed = milestones.filter((item) => item.status === 'done').length

  function updateMilestone(milestoneId, status) {
    setState((current) => ({ ...current, milestoneRecords: upsertMilestoneRecord(current.milestoneRecords, milestoneId, { status }) }))
  }

  function addMeasurement(event) {
    event.preventDefault()
    if (!growthValue.trim()) return
    const measurement = createGrowthMeasurement({ type: growthType, value: growthValue, measuredAt: growthDate })
    setState((current) => ({ ...current, growthMeasurements: [...current.growthMeasurements, measurement] }))
    setGrowthValue('')
  }

  function updateAdminTask(taskId, input) {
    setState((current) => ({ ...current, adminTaskRecords: upsertAdminTaskRecord(current.adminTaskRecords, taskId, input) }))
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

          <GrowthCard locale={locale} measurements={state.growthMeasurements} growthType={growthType} setGrowthType={setGrowthType} growthValue={growthValue} setGrowthValue={setGrowthValue} growthDate={growthDate} setGrowthDate={setGrowthDate} onSubmit={addMeasurement} readOnly={readOnly} />

          <section className="stage-day-card">
            <header className="dashboard-card-heading"><div><p className="eyebrow">{isEnglish ? 'Selected day' : '选中日期'}</p><h2>{dayTitle(selectedDateObject, locale)}</h2></div><CalendarDays size={18} /></header>
            <div className="selected-day-grid"><div><span>{isEnglish ? 'Care actions' : '照护事项'}</span><strong>{selectedLogs.filter((item) => item.status === 'done').length} / {selectedLogs.length || 3}</strong></div><div><span>{isEnglish ? 'Care records' : '关键记录'}</span><strong>{selectedCareEvents.length}</strong></div><div><span>{isEnglish ? 'Measurements' : '成长测量'}</span><strong>{selectedMeasurements.length}</strong></div></div>
            {selectedLogs.length === 0 && selectedMeasurements.length === 0 && selectedCareEvents.length === 0 ? <p className="empty-dashboard">{isEnglish ? 'No extra records for this day. Today’s checklist stays lightweight.' : '这一天暂无补充记录。今日清单保持轻量即可。'}</p> : <ul className="selected-day-list">{selectedLogs.map((item) => <li key={item.id}><Check size={14} />{item.taskId} · {item.status === 'done' ? (isEnglish ? 'done' : '已完成') : item.status}</li>)}{selectedCareEvents.map((item) => <li key={item.id}><Baby size={14} />{eventTitle(item, locale)} · {item.recordedBy?.displayName || (isEnglish ? 'caregiver' : '照护者')}</li>)}{selectedMeasurements.map((item) => <li key={item.id}><LineChart size={14} />{item.type}: {item.value} {item.unit}</li>)}</ul>}
          </section>
        </div>
        <div className="stage-boundary-note"><ShieldCheck size={16} /><span>{isEnglish ? 'No health score or developmental conclusion is produced. Measurements stay as caregiver-entered facts.' : '不生成健康评分或发育结论。成长测量只作为照护者填写的原始事实保存。'}</span><CircleHelp size={15} /></div>
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
      return <button key={key} className={`calendar-day ${inMonth ? '' : 'muted'} ${key === today ? 'today' : ''} ${key === selectedDate ? 'selected' : ''}`} onClick={() => onSelect(key)} aria-label={`${key}${markerLabel ? ` · ${markerLabel}` : ''}`}><span>{date.getDate()}</span><i className="calendar-markers">{events.slice(0, 3).map((event) => <b key={event.id} className={`calendar-marker ${event.kind} ${event.status === 'done' ? 'done' : ''}`} aria-hidden="true" />)}{!events.length && (hasLog || hasMeasurement || hasCareEvent) && <b className="calendar-marker record" aria-hidden="true" />}</i></button>
    })}</div>
    <p className="calendar-legend"><span><b className="calendar-marker admin" /> {isEnglish ? 'care task' : '照护代办'}</span><span><b className="calendar-marker milestone" /> {isEnglish ? 'milestone' : '里程碑'}</span><span><b className="calendar-marker anniversary" /> {isEnglish ? 'anniversary' : '纪念日'}</span><span><b className="calendar-marker record" /> {isEnglish ? 'record' : '已有记录'}</span></p>
    {selectedEvents.length > 0 && <div className="calendar-event-list"><strong>{isEnglish ? 'Selected date' : '当天事项'}</strong>{selectedEvents.map((event) => <div key={event.id} className={event.status === 'done' ? 'done' : ''}><span className={`calendar-marker ${event.kind} ${event.status === 'done' ? 'done' : ''}`} /><p><b>{localized(event.title, locale)}</b><small>{localized(event.detail, locale)}</small></p></div>)}</div>}
  </section>
}

function GrowthCard({ locale, measurements, growthType, setGrowthType, growthValue, setGrowthValue, growthDate, setGrowthDate, onSubmit, readOnly = false }) {
  const isEnglish = locale === 'en-US'
  const values = measurements.filter((item) => item.type === growthType).slice(-8)
  const definition = GROWTH_TYPES.find((item) => item.id === growthType)
  const max = Math.max(...values.map((item) => Number(item.value) || 0), 1)
  return <section className="growth-card">
    <header className="dashboard-card-heading"><div><p className="eyebrow">{isEnglish ? 'Growth facts' : '成长参数'}</p><h2>{isEnglish ? 'A simple trend, not a score' : '看趋势，不打分'}</h2></div><LineChart size={18} /></header>
    <div className="growth-switcher">{GROWTH_TYPES.map((item) => <button key={item.id} className={growthType === item.id ? 'active' : ''} onClick={() => setGrowthType(item.id)}>{localized(item.label, locale)}</button>)}</div>
    {values.length ? <div className="growth-bars" aria-label={isEnglish ? `${localized(definition.label, locale)} trend` : `${localized(definition.label, locale)}趋势`}>{values.map((item) => <div key={item.id} className="growth-bar-item"><span style={{ height: `${Math.max(12, ((Number(item.value) || 0) / max) * 100)}%` }} /><small>{item.value}</small><em>{item.measuredAt.slice(5)}</em></div>)}</div> : <div className="growth-empty"><LineChart size={24} /><p>{isEnglish ? 'Add one optional measurement to begin.' : '可选地补录一次测量，开始看到自己的时间线。'}</p></div>}
    <form className="growth-entry" onSubmit={onSubmit}><fieldset disabled={readOnly}><label><span className="sr-only">{isEnglish ? 'Value' : '数值'}</span><input inputMode="decimal" value={growthValue} onChange={(event) => setGrowthValue(event.target.value)} placeholder={isEnglish ? 'Value' : '数值'} aria-label={isEnglish ? 'Growth value' : '成长数值'} /><small>{definition.unit}</small></label><label><span className="sr-only">{isEnglish ? 'Date' : '日期'}</span><input type="date" value={growthDate} onChange={(event) => setGrowthDate(event.target.value)} aria-label={isEnglish ? 'Measurement date' : '测量日期'} /></label><button className="primary-button compact" type="submit"><Plus size={15} />{isEnglish ? 'Add' : '补录'}</button></fieldset></form>
    <small className="growth-source"><Baby size={13} />{isEnglish ? 'Caregiver-entered · no reference-band interpretation' : '照护者填写 · 不解释参考区间'}</small>
  </section>
}

const ROUTES_STAGE = '#/stage/newborn'
