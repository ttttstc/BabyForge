import { useMemo, useState } from 'react'
import { ArrowRight, Baby, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, ExternalLink, Info, LineChart, ListChecks, ShieldCheck } from 'lucide-react'
import { getAgeDays, getStage } from '../domain/baby.js'
import { getAdminTasks, getCalendarEvents, getMonthDays, getStageMilestones, localDateKey, GROWTH_TYPES } from '../domain/carePlan.js'
import { ageBasisLabel, ageContextSummary, resolveAgeContext } from '../domain/agePolicy.js'
import { evaluateGrowthMeasurement, getGrowthChartModel, growthLevelLabel, growthReferenceLabel, growthSourceLabel, growthTrajectoryLabel } from '../domain/growth.js'
import { getGrowthStageContent } from '../content/growthStages.js'
import { createCareEvent } from '../domain/careEvents.js'

const GROWTH_CHART_TYPES = GROWTH_TYPES.filter((item) => item.id !== 'headCircumference')
const GROWTH_REFERENCE_TYPES = GROWTH_CHART_TYPES
import { navigate, ROUTES } from '../app/router.js'
import { Header } from './Header.jsx'
import { AdminTaskList } from './AdminTaskList.jsx'

function localized(value, locale) {
  return value?.[locale === 'en-US' ? 'en' : 'zh'] || value?.zh || value || ''
}

function formatDate(value, locale) {
  if (!value) return locale === 'en-US' ? 'Date unavailable' : '日期未知'
  return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString(locale === 'en-US' ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

function ageLabel(context, locale) {
  if (!context || context.ageDays === null || context.ageDays === undefined) return locale === 'en-US' ? 'Age unavailable' : '年龄信息不足'
  if (context.ageDays < 0) {
    const chronologicalDays = Math.max(0, context.chronological?.days ?? 0)
    const daysBeforeDue = Math.abs(context.ageDays)
    return locale === 'en-US' ? `Actual ${chronologicalDays} days · corrected age is ${daysBeforeDue} days before due` : `实际 ${chronologicalDays} 天 · 矫正年龄尚未到预产期（还差 ${daysBeforeDue} 天）`
  }
  const days = Math.max(0, context.ageDays)
  if (days < 60) return locale === 'en-US' ? `${days} days` : `${days} 天`
  const months = context.ageMonths ?? Math.floor(days / 30.4375)
  return locale === 'en-US' ? `${months} months` : `${months} 个月`
}

function growthAgeLimitation(context, locale) {
  if (context?.correctionActive) return locale === 'en-US' ? 'Development references use corrected age; the stage window uses days since birth.' : '发展参考年龄按矫正年龄；阶段范围按出生后的实际天数显示。'
  return context?.limitations?.[0] || ''
}

function metricLabel(type, locale) {
  const definition = GROWTH_TYPES.find((item) => item.id === type)
  return localized(definition?.label, locale)
}

function standardResultLabel(evaluation, locale) {
  const isEnglish = locale === 'en-US'
  if (evaluation?.standardPackageId !== 'ws-t-800-2022') return growthLevelLabel(evaluation, locale)
  const labels = {
    'small-for-gestational-age': isEnglish ? 'Small for gestational age' : '小于胎龄',
    'large-for-gestational-age': isEnglish ? 'Large for gestational age' : '大于胎龄',
    'appropriate-for-gestational-age': isEnglish ? 'Appropriate for gestational age' : '适于胎龄',
  }
  return labels[evaluation?.birthSizeCategory] || (isEnglish ? 'Birth reference' : '出生参考')
}

function standardResultDetail(evaluation, locale) {
  return evaluation?.standardPackageId === 'ws-t-800-2022'
    ? locale === 'en-US' ? 'WS/T 800 birth reference' : 'WS/T 800 出生标准'
    : growthReferenceLabel(evaluation, locale)
}

function latestForType(evaluations, type) {
  const candidates = evaluations.filter((item) => item.type === type).sort((a, b) => String(a.measuredAt).localeCompare(String(b.measuredAt)))
  const latest = candidates.at(-1) || null
  const previous = candidates.at(-2) || null
  return { latest, previous }
}

function changeLabel(latest, previous, locale) {
  if (!latest || !previous) return locale === 'en-US' ? 'Not enough records for a change' : '需要至少两次记录才能看变化'
  const current = Number(latest.value)
  const prior = Number(previous.value)
  if (!Number.isFinite(current) || !Number.isFinite(prior)) return locale === 'en-US' ? 'Change unavailable' : '变化暂不可计算'
  const delta = current - prior
  const sign = delta > 0 ? '+' : ''
  return locale === 'en-US' ? `${sign}${delta.toFixed(2)} ${latest.unit} since ${formatDate(previous.measuredAt, locale)}` : `较 ${formatDate(previous.measuredAt, locale)} ${sign}${delta.toFixed(2)} ${latest.unit}`
}

function recordRoute(panel, returnTo = ROUTES.growth) {
  return `${ROUTES.records}?panel=${panel}&returnTo=${encodeURIComponent(returnTo)}`
}

export function GrowthDashboard({ route = ROUTES.growth, state, setState, onClear, onLogout, readOnly = false, role = 'admin' }) {
  const locale = state.preferences.locale
  const [metric, setMetric] = useState('weight')
  const ageContext = useMemo(() => resolveAgeContext({ baby: state.baby, at: new Date(), purpose: 'dashboard' }), [state.baby])
  const stage = useMemo(() => getStage(Math.max(0, ageContext.chronological?.days ?? getAgeDays(state.baby.birthDate))), [ageContext.chronological?.days, state.baby.birthDate])
  const content = useMemo(() => getGrowthStageContent(stage.id), [stage.id])
  const evaluations = useMemo(() => state.growthMeasurements.map((item) => ({ ...item, evaluation: evaluateGrowthMeasurement(item, state.baby, state.growthMeasurements) })), [state.baby, state.growthMeasurements])
  const metricCards = useMemo(() => GROWTH_REFERENCE_TYPES.map((definition) => {
    const { latest, previous } = latestForType(evaluations, definition.id)
    return { ...definition, latest, previous }
  }), [evaluations])
  const parentActionRecords = useMemo(() => {
    const records = new Map((state.milestoneRecords || []).map((item) => [item.milestoneId, item]))
    ;(state.carePlanItems || []).forEach((item) => records.set(item.taskId || item.planItemId, { ...item, milestoneId: item.taskId || item.planItemId }))
    return [...records.values()]
  }, [state.carePlanItems, state.milestoneRecords])
  const milestones = useMemo(() => getStageMilestones(stage.id, parentActionRecords), [parentActionRecords, stage.id])
  const adminTasks = useMemo(() => getAdminTasks(stage.id, Math.max(0, ageContext.chronological?.days ?? 0), state.adminTaskRecords), [ageContext.chronological?.days, stage.id, state.adminTaskRecords])
  const calendarEvents = useMemo(() => getCalendarEvents(state.baby, state.milestoneRecords || [], state.adminTaskRecords || []).filter((event) => event.status !== 'done'), [state.adminTaskRecords, state.baby, state.milestoneRecords])
  const dataIssues = evaluations.filter((item) => item.type !== 'headCircumference' && item.evaluation?.dataQuality !== 'sufficient').slice(-3)
  const chartRoute = route === ROUTES.growthChart
  const stageRoute = route === ROUTES.growthStage
  const historyRoute = route === ROUTES.growthHistory

  function updateAdminTask(taskId, input) {
    const now = new Date().toISOString()
    const actor = state.careActors.find((item) => item.id === state.preferences.currentRecorderId) || state.careActors[0]
    return setState((current) => ({ ...current, careEvents: [...current.careEvents, createCareEvent({ babyId: current.baby.id, kind: 'caregiver_observation', category: 'admin_task', occurredAt: now, recordedAt: now, actor, source: 'caregiver', payload: { taskId, ...input } })] }))
  }

  return (
    <main className="app-shell growth-dashboard-shell">
      <Header route={ROUTES.growth} baby={state.baby} ageDays={Math.max(0, ageContext.chronological?.days ?? 0)} onClear={onClear} onLogout={onLogout} readOnly={readOnly} role={role} locale={locale} careActors={state.careActors} currentRecorderId={state.preferences.currentRecorderId} onRecorderChange={(value) => setState((current) => ({ ...current, preferences: { ...current.preferences, currentRecorderId: value } }))} syncStatus={state.syncMeta?.status} onSyncRetry={() => window.dispatchEvent(new Event('babyforge:sync-retry'))} />
      <div className="growth-page">
        <GrowthHero locale={locale} baby={state.baby} stage={stage} ageContext={ageContext} onRecord={() => navigate(recordRoute('growth', route))} />
        <GrowthSubnav route={route} locale={locale} />
        {chartRoute ? <GrowthChartPage locale={locale} baby={state.baby} measurements={state.growthMeasurements} metric={metric} onMetricChange={setMetric} /> : stageRoute ? <GrowthStagePage locale={locale} stage={stage} ageContext={ageContext} content={content} milestones={milestones} adminTasks={adminTasks} onOpenRecord={() => navigate(recordRoute('care', route))} /> : historyRoute ? <GrowthHistoryPage locale={locale} evaluations={evaluations} onRecord={() => navigate(recordRoute('growth', route))} /> : <GrowthOverview locale={locale} stage={stage} ageContext={ageContext} content={content} metricCards={metricCards} dataIssues={dataIssues} milestones={milestones} adminTasks={adminTasks} onAdminTaskUpdate={updateAdminTask} readOnly={readOnly} calendarEvents={calendarEvents} onRecord={() => navigate(recordRoute('growth', route))} onOpenRecord={() => navigate(recordRoute('care', route))} onOpenBasicInfo={() => navigate(recordRoute('basic', route))} onOpenChart={() => navigate(ROUTES.growthChart)} onOpenStage={() => navigate(ROUTES.growthStage)} onOpenHistory={() => navigate(ROUTES.growthHistory)} />}
      </div>
    </main>
  )
}

function GrowthHero({ locale, baby, stage, ageContext, onRecord }) {
  const isEnglish = locale === 'en-US'
  return <section className="growth-hero"><div><p className="eyebrow">{isEnglish ? 'Growth · birth to 6 years' : '成长 · 出生至 6 岁'}</p><h1>{isEnglish ? `${baby.nickname} is in ${stage.labelEn}` : `${baby.nickname} 现在处于${stage.label}`}</h1><p>{isEnglish ? `${stage.rangeLabelEn} · ${ageContextSummary(ageContext, locale)}` : `${stage.rangeLabel} · ${ageContextSummary(ageContext, locale)}`}</p>{ageContext.corrected && ageContext.corrected.days >= 0 && <small className="growth-age-note">{isEnglish ? `Chronological age ${ageContext.chronological.months} months · ${ageBasisLabel('corrected', locale)} ${ageContext.corrected.months} months` : `实际年龄 ${ageContext.chronological.months} 个月 · 当前发展参考使用${ageBasisLabel('corrected', locale)} ${ageContext.corrected.months} 个月`}</small>}{ageContext.corrected?.days < 0 && <small className="growth-age-note">{isEnglish ? 'The corrected-age reference starts at the due date.' : '矫正年龄从预产期开始计算。'}</small>}</div><button type="button" className="primary-button growth-hero-record" onClick={onRecord}><LineChart size={16} />{isEnglish ? 'Record a measurement' : '去记录中心录入成长测量'}</button></section>
}

function GrowthSubnav({ route, locale }) {
  const isEnglish = locale === 'en-US'
  const items = [[ROUTES.growth, isEnglish ? 'Overview' : '总览'], [ROUTES.growthChart, isEnglish ? 'Growth standard chart' : '生长标准曲线'], [ROUTES.growthStage, isEnglish ? 'Stage guide' : '阶段指南'], [ROUTES.growthHistory, isEnglish ? 'History' : '历史记录']]
  return <nav className="growth-subnav" aria-label={isEnglish ? 'Growth sections' : '成长分区'}>{items.map(([target, label]) => <button type="button" key={target} className={route === target ? 'active' : ''} aria-current={route === target ? 'page' : undefined} onClick={() => navigate(target)}>{label}</button>)}</nav>
}

function GrowthOverview({ locale, stage, ageContext, content, metricCards, dataIssues, milestones, adminTasks, onAdminTaskUpdate, readOnly, calendarEvents, onRecord, onOpenRecord, onOpenBasicInfo, onOpenChart, onOpenStage, onOpenHistory }) {
  const isEnglish = locale === 'en-US'
  return <div className="growth-overview">
    <section className="growth-board-card growth-age-board"><header className="growth-card-heading"><div><p className="eyebrow">{isEnglish ? 'Current stage' : '当前阶段'}</p><h2>{isEnglish ? stage.labelEn : stage.label}</h2></div><Baby size={20} /></header><div className="growth-age-grid"><div><span>{isEnglish ? 'Age today' : '今天的年龄'}</span><strong>{ageLabel({ ...ageContext, basis: 'chronological', ageDays: ageContext.chronological?.days, ageMonths: ageContext.chronological?.months }, locale)}</strong></div><div><span>{isEnglish ? 'Reference age' : '发展参考年龄'}</span><strong>{ageLabel(ageContext, locale)}</strong></div><div><span>{isEnglish ? 'Stage window' : '阶段范围'}</span><strong>{isEnglish ? stage.rangeLabelEn : stage.rangeLabel}</strong></div></div><p className="growth-card-note">{isEnglish ? content.introEn : content.intro}</p>{(ageContext.limitations?.length > 0 || ageContext.ageDays < 0) && <p className="growth-age-limit"><Info size={14} />{growthAgeLimitation(ageContext, locale)}</p>}</section>
    <GrowthCalendar locale={locale} events={calendarEvents} />
    <AdminTaskList tasks={adminTasks} locale={locale} onUpdate={onAdminTaskUpdate} readOnly={readOnly} testId="growth-admin-task-list" />
    <section className="growth-board-card"><header className="growth-card-heading"><div><p className="eyebrow">{isEnglish ? 'Growth standard reference' : '生长标准参考'}</p><h2>{isEnglish ? 'Recent measurements' : '最近成长测量'}</h2></div><button type="button" className="text-button" onClick={onOpenChart}>{isEnglish ? 'Open growth standard chart' : '看生长标准曲线'}<ArrowRight size={15} /></button></header><p className="growth-card-note">{isEnglish ? 'Each result is compared with the Chinese national standard population for the same age and sex.' : '每项结果都与中国国家标准中同年龄、同性别儿童人群比较，不做用户排名。'}</p><div className="growth-metric-grid">{metricCards.map((item) => <MetricCard key={item.id} item={item} locale={locale} />)}</div><div className="growth-board-actions"><button type="button" className="secondary-button compact" onClick={onRecord}>{isEnglish ? 'Add a record' : '补录一次测量'}</button><button type="button" className="text-button" onClick={onOpenHistory}>{isEnglish ? 'View all history' : '查看全部历史'}<ArrowRight size={15} /></button></div></section>
    <section className="growth-board-card"><header className="growth-card-heading"><div><p className="eyebrow">{isEnglish ? 'Parent actions' : '父母建议完成'}</p><h2>{isEnglish ? 'A few actions for this stage' : '这个阶段建议完成的事'}</h2></div><strong className="growth-count">{milestones.filter((item) => item.status === 'done').length}/{milestones.length}</strong></header><p className="growth-card-note">{isEnglish ? 'These are care-plan items. Completion is recorded in the Record center; this page only summarizes it.' : '这里是照护计划项。完成状态统一在记录中心记录；本页只展示汇总。'}</p><div className="growth-action-list">{milestones.slice(0, 4).map((item) => <ParentAction key={item.id} item={item} locale={locale} onOpenRecord={onOpenRecord} />)}</div><button type="button" className="text-button" onClick={onOpenStage}>{isEnglish ? 'Open the full stage guide' : '打开完整阶段指南'}<ArrowRight size={15} /></button></section>
    <section className="growth-board-card"><header className="growth-card-heading"><div><p className="eyebrow">{isEnglish ? 'Baby development highlights' : '宝宝发展重点'}</p><h2>{isEnglish ? 'What to notice' : '这阶段可以留意什么'}</h2></div><CircleHelp size={19} /></header><p className="growth-card-note">{isEnglish ? 'Keep concrete observations. These highlights are not a screening score.' : '只记录具体场景。这些重点不是发育筛查评分。'}</p><div className="growth-highlight-list">{content.babyHighlights.slice(0, 3).map((item) => <article key={item.id}><strong>{isEnglish ? item.titleEn : item.title}</strong><p>{isEnglish ? item.detailEn : item.detail}</p><small>{isEnglish ? item.cautionEn : item.caution}</small></article>)}</div></section>
    <section className="growth-board-card growth-activity-card"><header className="growth-card-heading"><div><p className="eyebrow">{isEnglish ? 'Optional activity' : '可选亲子活动'}</p><h2>{isEnglish ? content.recommendedActivities[0]?.titleEn : content.recommendedActivities[0]?.title}</h2></div><ShieldCheck size={19} /></header><p>{isEnglish ? content.recommendedActivities[0]?.detailEn : content.recommendedActivities[0]?.detail}</p><button type="button" className="secondary-button compact" onClick={onOpenRecord}>{isEnglish ? 'Record the baby’s response' : '去记录中心记录实际反应'}</button></section>
    {dataIssues.length > 0 && <DataIssueCard locale={locale} issues={dataIssues} onOpenBasicInfo={onOpenBasicInfo} />}
  </div>
}

function GrowthCalendar({ locale, events = [] }) {
  const isEnglish = locale === 'en-US'
  const today = localDateKey()
  const [cursor, setCursor] = useState(() => {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1)
  })
  const [selectedDay, setSelectedDay] = useState(today)
  const days = useMemo(() => getMonthDays(cursor.getFullYear(), cursor.getMonth()), [cursor])
  const eventsByDay = useMemo(() => events.reduce((map, event) => {
    const day = String(event.date || '').slice(0, 10)
    if (!day) return map
    const current = map.get(day) || []
    current.push(event)
    map.set(day, current)
    return map
  }, new Map()), [events])
  const selectedEvents = eventsByDay.get(selectedDay) || []
  const monthLabel = cursor.toLocaleDateString(isEnglish ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'long' })
  const weekdays = isEnglish ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['日', '一', '二', '三', '四', '五', '六']

  function shiftMonth(delta) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1)
    setCursor(next)
    setSelectedDay(localDateKey(next))
  }

  return <section className="growth-board-card growth-calendar-card" aria-labelledby="growth-calendar-title" data-testid="growth-calendar">
    <header className="growth-card-heading">
      <div><p className="eyebrow">{isEnglish ? 'Growth calendar' : '成长日历'}</p><h2 id="growth-calendar-title">{monthLabel}</h2></div><CalendarDays size={20} />
      <div className="calendar-nav">
        <button type="button" aria-label={isEnglish ? 'Previous month' : '上个月'} onClick={() => shiftMonth(-1)}><ChevronLeft size={16} /></button>
        <button type="button" aria-label={isEnglish ? 'Next month' : '下个月'} onClick={() => shiftMonth(1)}><ChevronRight size={16} /></button>
      </div>
    </header>
    <div className="calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
    <div className="calendar-grid">
      {days.map((day) => {
        const dayEvents = eventsByDay.get(day.key) || []
        const todayClass = day.key === today ? ' today' : ''
        const selectedClass = day.key === selectedDay ? ' selected' : ''
        const mutedClass = day.inMonth ? '' : ' muted'
        const label = dayEvents.length ? (isEnglish ? `${dayEvents.length} item${dayEvents.length > 1 ? 's' : ''}` : `${dayEvents.length} 项`) : ''
        return <button type="button" key={day.key} className={`calendar-day${todayClass}${selectedClass}${mutedClass}`} onClick={() => setSelectedDay(day.key)} aria-label={`${day.key}${label ? ` · ${label}` : ''}`}>
          <span>{day.date.getDate()}</span>
          <i>{dayEvents.slice(0, 3).map((event) => <b key={event.id} className={`calendar-marker ${event.kind} ${event.status === 'done' ? 'done' : ''}`} aria-hidden="true" />)}</i>
          {label && <small className="calendar-day-label">{label}</small>}
        </button>
      })}
    </div>
    <div className="calendar-legend"><span><i className="calendar-marker anniversary" />{isEnglish ? 'Birth day' : '出生纪念日'}</span><span><i className="calendar-marker milestone" />{isEnglish ? 'Stage item' : '阶段事项'}</span><span><i className="calendar-marker admin" />{isEnglish ? 'Health task' : '保健事项'}</span></div>
    <div className="calendar-event-list">
      <strong>{isEnglish ? `Items on ${selectedDay}` : `${selectedDay} 的事项`}</strong>
      {selectedEvents.length ? selectedEvents.map((event) => <div key={event.id}><i className={`calendar-marker ${event.kind} ${event.status === 'done' ? 'done' : ''}`} /><p><b>{localized(event.title, locale)}</b><small>{localized(event.detail, locale)}{event.dueHint ? ` · ${localized(event.dueHint, locale)}` : ''}</small></p></div>) : <p className="calendar-empty-day">{isEnglish ? 'No stage or health item on this day.' : '这一天没有阶段或保健事项。'}</p>}
    </div>
  </section>
}

function MetricCard({ item, locale }) {
  const isEnglish = locale === 'en-US'
  const latest = item.latest
  const evaluation = latest?.evaluation
  return <article className="growth-metric-card"><header><span>{localized(item.label, locale)}</span><span>{item.unit}</span></header><strong>{latest ? `${latest.value} ${latest.unit}` : '—'}</strong><small>{latest ? formatDate(latest.measuredAt, locale) : (isEnglish ? 'No record yet' : '暂无记录')}</small>{evaluation?.dataQuality === 'sufficient' ? <div className="growth-reference-result"><b>{standardResultLabel(evaluation, locale)}</b><span>{standardResultDetail(evaluation, locale)}</span></div> : <div className="growth-reference-result muted"><b>{isEnglish ? 'No result yet' : '暂无法比较'}</b><span>{evaluation?.limitations?.[0] || (isEnglish ? 'Record a valid value' : '录入有效测量后显示')}</span></div>}{item.previous && <p className="growth-change">{changeLabel(latest, item.previous, locale)}</p>}</article>
}

function ParentAction({ item, locale, onOpenRecord }) {
  const isEnglish = locale === 'en-US'
  const done = item.status === 'done'
  const dueDay = item.dueDay ?? null
  const dueLabel = dueDay === null ? (isEnglish ? 'When ready' : '按阶段安排') : (isEnglish ? `Around day ${dueDay}` : `出生后第 ${dueDay} 天左右`)
  return <article className={`growth-action-item ${done ? 'done' : ''}`}><button type="button" onClick={onOpenRecord} aria-label={isEnglish ? `Open Record center for ${localized(item.title, locale)}` : `去记录中心记录${localized(item.title, locale)}`}>{done ? <Check size={15} /> : <span>{dueDay ?? '·'}</span>}</button><div><strong>{localized(item.title, locale)}</strong><small>{localized(item.detail, locale)}</small></div><em>{done ? (isEnglish ? 'Done' : '已完成') : dueLabel}</em></article>
}

function DataIssueCard({ locale, issues, onOpenBasicInfo }) {
  const isEnglish = locale === 'en-US'
  return <section className="growth-board-card growth-issue-card" role="status"><header className="growth-card-heading"><div><p className="eyebrow">{isEnglish ? 'Data notes' : '数据提示'}</p><h2>{isEnglish ? 'Reference temporarily unavailable' : '暂时无法生成生长标准参考'}</h2></div><Info size={18} /></header><p className="growth-issue-summary">{isEnglish ? 'Check the baby’s birth date, sex, and measurement unit before comparing with the national reference.' : '请先核对宝宝出生日期、性别和测量单位，再查看国家生长标准参考。'}</p>{issues.map((item) => <p key={item.id}><strong>{metricLabel(item.type, locale)} · {formatDate(item.measuredAt, locale)}</strong><span>{item.evaluation?.limitations?.[0] || (isEnglish ? 'Reference unavailable' : '暂无法生成生长标准参考')}</span></p>)}<button type="button" className="text-button" onClick={onOpenBasicInfo}>{isEnglish ? 'Check basic information' : '去基础信息核对'}<ArrowRight size={15} /></button></section>
}

function GrowthStagePage({ locale, stage, ageContext, content, milestones, adminTasks, onOpenRecord }) {
  const isEnglish = locale === 'en-US'
  return <div className="growth-detail-page"><section className="growth-detail-lede"><p className="eyebrow">{isEnglish ? 'Stage guide' : '阶段指南'}</p><h2>{isEnglish ? stage.labelEn : stage.label}</h2><p>{isEnglish ? content.introEn : content.intro}</p><small>{ageContextSummary(ageContext, locale)}</small></section><div className="growth-detail-grid"><section className="growth-board-card"><header className="growth-card-heading"><div><p className="eyebrow">{isEnglish ? 'Parent actions' : '父母建议完成'}</p><h2>{isEnglish ? 'Care-plan items' : '照护计划项'}</h2></div><ListChecks size={19} /></header><div className="growth-action-list">{milestones.map((item) => <ParentAction key={item.id} item={item} locale={locale} onOpenRecord={onOpenRecord} />)}</div>{adminTasks.length > 0 && <p className="growth-detail-footnote">{isEnglish ? `${adminTasks.filter((item) => item.state === 'done').length}/${adminTasks.length} local health and document tasks recorded.` : `儿童保健与证件事项已记录 ${adminTasks.filter((item) => item.state === 'done').length}/${adminTasks.length} 项。`}</p>}</section><section className="growth-board-card"><header className="growth-card-heading"><div><p className="eyebrow">{isEnglish ? 'Baby development' : '宝宝发展重点'}</p><h2>{isEnglish ? 'What to notice' : '建议留意的观察'}</h2></div><CircleHelp size={19} /></header><div className="growth-highlight-list">{content.babyHighlights.map((item) => <article key={item.id}><strong>{isEnglish ? item.titleEn : item.title}</strong><p>{isEnglish ? item.detailEn : item.detail}</p><small>{isEnglish ? item.cautionEn : item.caution}</small></article>)}</div><p className="growth-detail-footnote">{isEnglish ? 'A missed observation is not a failed milestone. Use the Record center for the concrete scene.' : '没有观察到不代表没有完成发育；需要留下事实时，请去记录中心。'}</p></section></div><section className="growth-board-card"><header className="growth-card-heading"><div><p className="eyebrow">{isEnglish ? 'Optional activities' : '可选亲子活动'}</p><h2>{isEnglish ? 'Keep it light and responsive' : '轻量、跟随宝宝状态'}</h2></div><ShieldCheck size={19} /></header><div className="growth-activity-list">{content.recommendedActivities.map((item) => <article key={item.id}><strong>{isEnglish ? item.titleEn : item.title}</strong><span>{isEnglish ? item.detailEn : item.detail}</span></article>)}</div><button type="button" className="secondary-button compact" onClick={onOpenRecord}>{isEnglish ? 'Record an observation' : '去记录中心记录宝宝反应'}</button></section></div>
}

function GrowthChartPage({ locale, baby, measurements, metric, onMetricChange }) {
  const isEnglish = locale === 'en-US'
  const currentAgeMonths = useMemo(() => {
    const context = resolveAgeContext({ baby, at: new Date(), purpose: 'growth_standard' })
    return Math.min(83, Math.max(3, context.chronological?.months ?? 3))
  }, [baby])
  const defaultRange = currentAgeMonths > 12 ? currentAgeMonths : 12
  const [range, setRange] = useState(defaultRange)
  const rangeOptions = [...new Set([3, 12, defaultRange])]
  const model = useMemo(() => getGrowthChartModel({ baby, measurements, type: metric, startMonth: 0, endMonth: range }), [baby, measurements, metric, range])
  return <div className="growth-detail-page"><section className="growth-detail-lede"><p className="eyebrow">{isEnglish ? 'Growth standard chart' : '生长标准曲线'}</p><h2>{isEnglish ? 'Track the baby against the official reference' : '把宝宝轨迹放在生长标准曲线上看'}</h2><p>{isEnglish ? 'The chart draws P3, P10, P25, P50, P75, P90, and P97. Your measurements remain the strongest visual line.' : '曲线完整绘制 P3、P10、P25、P50、P75、P90、P97；宝宝自己的测量轨迹始终最突出。'}</p></section><section className="growth-board-card growth-chart-card"><header className="growth-card-heading"><div className="growth-switcher">{GROWTH_CHART_TYPES.map((item) => <button type="button" key={item.id} className={metric === item.id ? 'active' : ''} onClick={() => onMetricChange(item.id)}>{localized(item.label, locale)}</button>)}</div><div className="growth-range-switcher">{rangeOptions.map((option) => <button type="button" key={option} className={range === option ? 'active' : ''} onClick={() => setRange(option)}>0–{option} {isEnglish ? 'mo' : '个月'}{option === defaultRange && defaultRange > 12 ? (isEnglish ? ' · current' : ' · 当前') : ''}</button>)}</div></header><NationalGrowthChart locale={locale} model={model} /><footer className="growth-chart-footer"><span>{isEnglish ? `${model.standard.id} · version ${model.standard.version}` : `${model.standard.id} · 版本 ${model.standard.version}`}</span><a href={model.standard.sourceUrl} target="_blank" rel="noreferrer">{isEnglish ? 'Official source' : '国家卫健委标准原文'}<ExternalLink size={13} /></a></footer></section></div>
}

function NationalGrowthChart({ locale, model }) {
  const isEnglish = locale === 'en-US'
  const width = 760
  const height = 340
  const pad = { top: 20, right: 22, bottom: 42, left: 52 }
  const allValues = [...model.reference.flatMap((line) => line.points.map((point) => point.value)), ...model.points.map((point) => point.value)].filter(Number.isFinite)
  if (!allValues.length) return <div className="growth-chart-empty"><LineChart size={26} /><p>{isEnglish ? 'Set sex and add a valid measurement to draw the growth standard curve.' : '设置宝宝性别并录入有效测量后，才能绘制生长标准曲线。'}</p></div>
  const minValue = Math.min(...allValues)
  const maxValue = Math.max(...allValues)
  const yMin = Math.max(0, minValue - Math.max((maxValue - minValue) * 0.12, 0.2))
  const yMax = maxValue + Math.max((maxValue - minValue) * 0.12, 0.2)
  const x = (month) => pad.left + (month / model.range.endMonth) * (width - pad.left - pad.right)
  const y = (value) => height - pad.bottom - ((value - yMin) / (yMax - yMin)) * (height - pad.top - pad.bottom)
  const path = (points) => points.map((point, index) => `${index ? 'L' : 'M'}${x(point.month).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ')
  const ticks = Array.from({ length: model.range.endMonth + 1 }, (_, index) => index)
  const lineColors = { 3: '#d67e67', 10: '#dfa27f', 25: '#b9a680', 50: '#52746b', 75: '#b9a680', 90: '#dfa27f', 97: '#d67e67' }
  return <div className="growth-chart-wrap"><svg className="growth-chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={isEnglish ? 'Growth standard chart' : '生长标准曲线'}><rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={height - pad.top - pad.bottom} className="growth-chart-plot" />{ticks.map((tick) => <g key={tick}><line x1={x(tick)} x2={x(tick)} y1={pad.top} y2={height - pad.bottom} className="growth-chart-grid" /><text x={x(tick)} y={height - 15} textAnchor="middle">{tick}</text></g>)}{model.reference.map((line) => <path key={line.id} d={path(line.points)} fill="none" stroke={lineColors[line.percentile]} strokeWidth={line.percentile === 50 ? 2.4 : line.percentile === 3 || line.percentile === 97 ? 1.8 : 1.2} strokeDasharray={line.percentile === 50 ? undefined : '5 5'} opacity={line.percentile === 50 ? 0.95 : 0.65} />)}{model.points.length > 1 && <path d={path(model.points)} fill="none" stroke="#273f3a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}{model.points.map((point) => <circle key={point.id} cx={x(point.month)} cy={y(point.value)} r="5" className="growth-chart-baby-point"><title>{`${point.measuredAt} · ${point.value} ${model.unit}`}</title></circle>)}<text x={pad.left} y={14}>{model.unit}</text><text x={width - pad.right} y={height - 15} textAnchor="end">{isEnglish ? 'completed months' : '出生后整月'}</text></svg><div className="growth-chart-legend">{model.reference.map((line) => <span key={line.id}><i style={{ borderTopColor: lineColors[line.percentile] }} />P{line.percentile}</span>)}<span><i className="baby-line" />{isEnglish ? 'Baby' : '宝宝轨迹'}</span></div>{model.birthPoint && <p className="growth-birth-marker"><Info size={14} />{isEnglish ? `Birth record: ${model.birthPoint.value} ${model.unit}; WS/T 800 is shown separately.` : `出生记录：${model.birthPoint.value} ${model.unit}；出生点按 WS/T 800 单独评价，不与月龄曲线混画。`}</p>}</div>
}

function GrowthHistoryPage({ locale, evaluations, onRecord }) {
  const isEnglish = locale === 'en-US'
  const sorted = evaluations.filter((item) => item.type !== 'headCircumference').sort((a, b) => String(b.measuredAt).localeCompare(String(a.measuredAt)))
  return <div className="growth-detail-page"><section className="growth-detail-lede"><p className="eyebrow">{isEnglish ? 'Measurement history' : '成长历史记录'}</p><h2>{isEnglish ? 'Facts first, references attached' : '先看事实，再看参考'}</h2><p>{isEnglish ? 'Every value keeps its date, source, standard version, and limitations.' : '每个数值都保留日期、来源、标准版本和适用限制。'}</p><button type="button" className="primary-button compact" onClick={onRecord}><LineChart size={15} />{isEnglish ? 'Record another measurement' : '去记录中心录入'}</button></section><section className="growth-board-card growth-history-card">{sorted.length === 0 ? <div className="growth-chart-empty"><Baby size={26} /><p>{isEnglish ? 'No growth measurements yet.' : '还没有成长测量记录。'}</p></div> : <div className="growth-history-list">{sorted.map((item) => <article key={item.id}><div className="growth-history-value"><strong>{item.value} {item.unit}</strong><span>{metricLabel(item.type, locale)}</span></div><div><strong>{formatDate(item.measuredAt, locale)}</strong><small>{growthSourceLabel(item.source, locale)}</small></div><div className={`growth-history-result ${item.evaluation?.dataQuality === 'sufficient' ? 'good' : 'limited'}`}><strong>{item.evaluation?.dataQuality === 'sufficient' ? `${standardResultLabel(item.evaluation, locale)} · ${standardResultDetail(item.evaluation, locale)}` : (isEnglish ? 'Reference unavailable' : '暂无生长标准参考')}</strong><small>{item.evaluation?.dataQuality === 'sufficient' ? `${item.evaluation.standardPackageId} · ${ageBasisLabel(item.evaluation.ageBasis, locale)} · ${growthTrajectoryLabel(item.evaluation.trajectoryStatus, locale)}` : item.evaluation?.limitations?.[0]}</small></div></article>)}</div>}</section></div>
}
