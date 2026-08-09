import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Baby, CircleHelp, ExternalLink, Info, LineChart, ListChecks, Maximize2, MessageCircle, Plus, ShieldCheck } from 'lucide-react'
import { getAgeDays, getStage } from '../domain/baby.js'
import { getAdminTasks, GROWTH_TYPES } from '../domain/carePlan.js'
import { ageBasisLabel, ageContextSummary, resolveAgeContext } from '../domain/agePolicy.js'
import { buildGrowthInterpretation } from '../domain/naibaCapabilities.js'
import { evaluateGrowthMeasurement, getGrowthChartModel, getGrowthMeasurementConflictIds, growthLevelLabel, growthReferenceLabel, growthSourceLabel, growthTrajectoryLabel, isValidGrowthMeasurement } from '../domain/growth.js'
import { getGrowthStageContent } from '../content/growthStages.js'
import { buildRecordRoute, navigate, ROUTES } from '../app/router.js'
import { Header } from './Header.jsx'
import { GrowthRoadmap } from './GrowthRoadmap.jsx'
import { GrowthInterpretationDialog } from './GrowthInterpretationDialog.jsx'

const HOME_REFERENCE_PERCENTILES = [3, 50, 97]
const DETAIL_REFERENCE_PERCENTILES = [3, 10, 25, 50, 75, 90, 97]
const METRIC_IDS = new Set(GROWTH_TYPES.map((item) => item.id))

function localized(value, locale) {
  return value?.[locale === 'en-US' ? 'en' : 'zh'] || value?.zh || value?.en || value || ''
}

function formatDate(value, locale) {
  if (!value) return locale === 'en-US' ? 'Date unavailable' : '日期未知'
  return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString(locale === 'en-US' ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

function metricLabel(type, locale) {
  return localized(GROWTH_TYPES.find((item) => item.id === type)?.label, locale)
}

function queryMetric() {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.hash.split('?')[1] || '').get('metric')
  return METRIC_IDS.has(value) ? value : null
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

function currentEvaluationList(measurements, baby, now = new Date()) {
  const list = Array.isArray(measurements) ? measurements : []
  const conflictIds = getGrowthMeasurementConflictIds(list, baby, { now })
  const superseded = new Set(list.map((item) => item?.correctedFromId).filter(Boolean))
  return list
    .filter((item) => item?.status !== 'voided' && item?.status !== 'corrected' && !superseded.has(item?.id))
    .map((item) => ({ ...item, evaluation: evaluateGrowthMeasurement(item, baby, list, { now }), factValid: isValidGrowthMeasurement(item, baby, { now }), conflicted: conflictIds.has(item.id) }))
}

function latestForType(evaluations, type) {
  const candidates = evaluations.filter((item) => item.type === type && item.factValid).sort((a, b) => String(a.measuredAt).localeCompare(String(b.measuredAt)))
  const latest = candidates.at(-1) || null
  const priorCandidates = candidates.filter((item) => !item.conflicted && item.id !== latest?.id)
  return { latest, previous: priorCandidates.at(-1) || null }
}

function changeLabel(latest, previous, locale) {
  if (latest?.conflicted) return locale === 'en-US' ? 'Same-day values need verification' : '同日数值冲突，请先核对'
  if (!latest || !previous) return locale === 'en-US' ? 'Need at least two valid facts for a change' : '需要至少两次有效记录才能看变化'
  const current = Number(latest.value)
  const prior = Number(previous.value)
  if (!Number.isFinite(current) || !Number.isFinite(prior)) return locale === 'en-US' ? 'Change unavailable' : '变化暂不可计算'
  const delta = current - prior
  const sign = delta > 0 ? '+' : ''
  return locale === 'en-US' ? `${sign}${delta.toFixed(2)} ${latest.unit} since ${formatDate(previous.measuredAt, locale)}` : `较 ${formatDate(previous.measuredAt, locale)} ${sign}${delta.toFixed(2)} ${latest.unit}`
}

function normalizeParentActions(carePlanItems, adminTasks) {
  const planItems = (Array.isArray(carePlanItems) ? carePlanItems : []).map((item) => ({
    id: item.id || item.taskId || item.planItemId,
    title: item.title || item.name || { zh: '照护计划项', en: 'Care-plan item' },
    detail: item.detail || item.description || item.acceptance || { zh: '按计划完成并在记录中心留下事实。', en: 'Complete it and leave the fact in the Record center.' },
    status: item.status || item.state || 'pending',
    dueDay: item.dueDay ?? null,
    category: 'care-plan',
  })).filter((item) => item.id)
  const admin = (Array.isArray(adminTasks) ? adminTasks : []).map((item) => ({ ...item, category: 'admin-task' }))
  return [...planItems, ...admin]
}

export function GrowthDashboard({ route = ROUTES.growth, state, setState, onClear, onLogout, readOnly = false, role = 'admin', cloudMode = false }) {
  const locale = state.preferences.locale
  const [metric, setMetric] = useState(() => queryMetric() || 'weight')
  const [aiOpen, setAiOpen] = useState(false)
  const ageContext = useMemo(() => resolveAgeContext({ baby: state.baby, at: new Date(), purpose: 'dashboard' }), [state.baby])
  const chronologicalDays = Math.max(0, ageContext.chronological?.days ?? getAgeDays(state.baby.birthDate))
  const stage = useMemo(() => getStage(chronologicalDays), [chronologicalDays])
  const content = useMemo(() => getGrowthStageContent(stage.id), [stage.id])
  const evaluations = useMemo(() => currentEvaluationList(state.growthMeasurements, state.baby), [state.baby, state.growthMeasurements])
  const hasHeadHistory = evaluations.some((item) => item.type === 'headCircumference' && item.factValid)
  const visibleMetrics = useMemo(() => GROWTH_TYPES.filter((item) => item.id !== 'headCircumference' || chronologicalDays <= 36 * 30.4375 || hasHeadHistory), [chronologicalDays, hasHeadHistory])
  const activeMetric = visibleMetrics.some((item) => item.id === metric) ? metric : visibleMetrics[0]?.id || 'weight'
  const metricCards = useMemo(() => visibleMetrics.map((definition) => ({ ...definition, ...latestForType(evaluations, definition.id) })), [evaluations, visibleMetrics])
  const adminTasks = useMemo(() => getAdminTasks(stage.id, chronologicalDays, state.adminTaskRecords), [chronologicalDays, stage.id, state.adminTaskRecords])
  const parentActions = useMemo(() => normalizeParentActions(state.carePlanItems, adminTasks), [adminTasks, state.carePlanItems])
  const deterministicSummary = useMemo(() => buildGrowthInterpretation({ baby: state.baby, measurements: state.growthMeasurements, metric: activeMetric, locale }), [activeMetric, locale, state.baby, state.growthMeasurements])
  const chartRoute = route === ROUTES.growthChart
  const stageRoute = route === ROUTES.growthStage
  const historyRoute = route === ROUTES.growthHistory
  const returnTo = () => globalThis.window?.location?.hash || route
  const openRecord = (panel = 'growth', metric = null) => navigate(buildRecordRoute({ panel, metric, returnTo: returnTo() }))
  const openRecordEvent = (eventId) => navigate(buildRecordRoute({ panel: 'growth', event: eventId, mode: 'detail', returnTo: returnTo() }))
  const openChart = (nextMetric = activeMetric) => {
    setMetric(nextMetric)
    navigate(`${ROUTES.growthChart}?metric=${encodeURIComponent(nextMetric)}`)
  }

  return (
    <main className="app-shell growth-dashboard-shell">
      <Header route={ROUTES.growth} baby={state.baby} ageDays={chronologicalDays} onClear={onClear} onLogout={onLogout} readOnly={readOnly} role={role} locale={locale} careActors={state.careActors} currentRecorderId={state.preferences.currentRecorderId} onRecorderChange={(value) => setState((current) => ({ ...current, preferences: { ...current.preferences, currentRecorderId: value } }))} syncStatus={state.syncMeta?.status} onSyncRetry={() => window.dispatchEvent(new Event('babyforge:sync-retry'))} />
      <div className="growth-page">
        <GrowthHero locale={locale} baby={state.baby} stage={stage} ageContext={ageContext} onRecord={() => openRecord('growth')} />
        <GrowthRoadmap ageDays={chronologicalDays} stage={stage} locale={locale} />
        {route !== ROUTES.growth && <button type="button" className="growth-detail-back" onClick={() => navigate(ROUTES.growth)}><ArrowLeft size={15} />{locale === 'en-US' ? 'Back to growth dashboard' : '返回成长看板'}</button>}
        {chartRoute ? <GrowthChartPage locale={locale} baby={state.baby} measurements={state.growthMeasurements} metric={activeMetric} visibleMetrics={visibleMetrics} onMetricChange={setMetric} onOpenRecord={openRecordEvent} /> : stageRoute ? <GrowthStagePage locale={locale} stage={stage} ageContext={ageContext} content={content} parentActions={parentActions} onOpenRecord={() => openRecord('care')} /> : historyRoute ? <GrowthHistoryPage locale={locale} evaluations={evaluations} onRecord={() => openRecord('growth')} onOpenRecord={openRecordEvent} /> : <GrowthOverview locale={locale} metricCards={metricCards} activeMetric={activeMetric} measurements={state.growthMeasurements} evaluations={evaluations} baby={state.baby} summary={deterministicSummary} parentActions={parentActions} onOpenRecord={() => openRecord('care')} onRecord={() => openRecord('growth')} onRecordMetric={(metricType) => openRecord('growth', metricType)} onOpenChart={openChart} onOpenStage={() => navigate(ROUTES.growthStage)} onOpenHistory={() => navigate(ROUTES.growthHistory)} onOpenAi={() => setAiOpen(true)} onOpenRecordEvent={openRecordEvent} />}
      </div>
      {aiOpen && <GrowthInterpretationDialog state={state} metric={activeMetric} summary={deterministicSummary} cloudMode={cloudMode} onClose={() => setAiOpen(false)} />}
    </main>
  )
}

function GrowthHero({ locale, baby, stage, ageContext, onRecord }) {
  const isEnglish = locale === 'en-US'
  const birthDate = formatDate(baby.birthDate, locale)
  const gestation = baby.gestationalWeeks ? `${baby.gestationalWeeks}${isEnglish ? ' wk' : ' 周'}` : isEnglish ? 'Not recorded' : '未记录'
  return <section className="growth-hero"><div><p className="eyebrow">{isEnglish ? 'Growth · birth to 6 years' : '成长 · 出生至 6 岁'}</p><h1>{isEnglish ? `${baby.nickname} is in ${stage.labelEn}` : `${baby.nickname} 现在处于${stage.label}`}</h1><p>{isEnglish ? `${stage.rangeLabelEn} · ${ageContextSummary(ageContext, locale)}` : `${stage.rangeLabel} · ${ageContextSummary(ageContext, locale)}`}</p><div className="growth-basic-facts"><span>{isEnglish ? 'Birth' : '出生'} · {birthDate}</span><span>{isEnglish ? 'Gestation' : '出生孕周'} · {gestation}</span>{ageContext.correctionActive && <span className="growth-corrected-badge">{isEnglish ? 'Corrected-age reference active' : '当前使用矫正年龄参考'}</span>}</div>{ageContext.correctionActive && ageContext.corrected?.days < 0 && <small className="growth-age-note">{isEnglish ? 'The corrected-age reference starts at the due date.' : '矫正年龄从预产期开始计算。'}</small>}{ageContext.correctionActive && <small className="growth-age-note">{isEnglish ? `Chronological age ${ageContext.chronological.months} months · corrected age ${ageContext.corrected.months} months` : `实际年龄 ${ageContext.chronological.months} 个月 · 矫正年龄 ${ageContext.corrected.months} 个月`}</small>}</div><button type="button" className="primary-button growth-hero-record" onClick={onRecord}><LineChart size={16} />{isEnglish ? 'Record a measurement' : '去记录中心录入成长测量'}</button></section>
}

function GrowthOverview({ locale, metricCards, activeMetric, baby, measurements, evaluations, summary, parentActions, onOpenRecord, onRecord, onRecordMetric, onOpenChart, onOpenStage, onOpenHistory, onOpenAi, onOpenRecordEvent }) {
  const isEnglish = locale === 'en-US'
  return <div className="growth-overview growth-dashboard-order">
    <section className="growth-board-card growth-measurement-board"><header className="growth-card-heading"><div><p className="eyebrow">{isEnglish ? 'Growth measurements' : '成长数据'}</p><h2>{isEnglish ? 'Record and view three measurements' : '记录和查看三项测量'}</h2></div><button type="button" className="text-button" onClick={onRecord}>{isEnglish ? 'Record a measurement' : '录入测量'}<ArrowRight size={15} /></button></header><p className="growth-card-note">{isEnglish ? 'Record weight, length/height, and head circumference. Open a card to view the latest value and its reference.' : '记录体重、身长/身高和头围；打开指标卡查看最近测量和对应参考。'}</p><div className="growth-metric-grid">{metricCards.map((item) => <MetricCard key={item.id} item={item} locale={locale} onOpen={() => onOpenChart(item.id)} onRecord={() => onRecordMetric(item.id)} />)}</div></section>
    <GrowthTrendPanel locale={locale} baby={baby} measurements={measurements} metric={activeMetric} definitions={metricCards} onMetricChange={onOpenChart} onOpenAi={onOpenAi} compact referencePercentiles={HOME_REFERENCE_PERCENTILES} summary={summary} />
    <ParentActionsCard locale={locale} parentActions={parentActions} onOpenRecord={onOpenRecord} onOpenStage={onOpenStage} />
    <RecentGrowthRecords locale={locale} evaluations={evaluations} onOpenHistory={onOpenHistory} onOpenRecord={onOpenRecordEvent} />
  </div>
}

function MetricCard({ item, locale, onOpen, onRecord }) {
  const isEnglish = locale === 'en-US'
  const latest = item.latest
  const evaluation = latest?.evaluation
  return <article className={`growth-metric-card ${latest?.conflicted ? 'conflicted' : ''}`}><button type="button" className="growth-metric-card-button" onClick={onOpen}><header><span>{localized(item.label, locale)}</span><span>{item.unit}</span></header><strong>{latest?.conflicted ? (isEnglish ? 'Needs verification' : '需先核对') : latest ? `${latest.value} ${latest.unit}` : (isEnglish ? 'Not recorded' : '未记录')}</strong><small>{latest?.conflicted ? (isEnglish ? 'Same-day values need verification' : '同日数值需核对') : latest ? (isEnglish ? `Latest measurement · ${formatDate(latest.measuredAt, locale)}` : `最近测量 · ${formatDate(latest.measuredAt, locale)}`) : (isEnglish ? 'Record it to view the latest value' : '录入后查看最近测量')}</small>{latest?.conflicted ? <div className="growth-reference-result muted"><b>{isEnglish ? 'Multiple measurements on this day' : '同日有多次测量'}</b><span>{isEnglish ? 'Open Record center to verify.' : '请到记录中心核对。'}</span></div> : evaluation?.dataQuality === 'sufficient' ? <div className="growth-reference-result"><b>{standardResultLabel(evaluation, locale)}</b><span>{standardResultDetail(evaluation, locale)}</span></div> : <div className="growth-reference-result muted"><b>{isEnglish ? 'No reference available' : '暂无标准参考'}</b><span>{evaluation?.limitations?.[0] || (isEnglish ? 'Record the required profile details to view a reference.' : '补充适用资料后查看标准参考。')}</span></div>}{item.previous && <p className="growth-change">{changeLabel(latest, item.previous, locale)}</p>}</button><button type="button" className="growth-metric-record" onClick={onRecord}><Plus size={14} />{isEnglish ? 'Record' : '去记录'}</button></article>
}

function GrowthTrendPanel({ locale, baby, measurements, metric, definitions = GROWTH_TYPES, onMetricChange, onOpenAi, compact = false, referencePercentiles = DETAIL_REFERENCE_PERCENTILES, summary }) {
  const isEnglish = locale === 'en-US'
  return <section className={`growth-board-card growth-trend-card ${compact ? 'compact' : ''}`}><header className="growth-card-heading"><div><p className="eyebrow">{isEnglish ? 'Measurement trend' : '测量趋势'}</p><h2>{isEnglish ? `${metricLabel(metric, locale)} trajectory` : `${metricLabel(metric, locale)}趋势`}</h2></div><div className="growth-switcher">{definitions.map((item) => <button type="button" key={item.id} className={metric === item.id ? 'active' : ''} onClick={() => onMetricChange(item.id)}>{localized(item.label, locale)}</button>)}</div></header><GrowthChartPanel locale={locale} baby={baby} measurements={measurements} metric={metric} referencePercentiles={referencePercentiles} compact={compact} /><section className="growth-summary-card"><div><p className="eyebrow">{isEnglish ? 'Recent change' : '近期测量变化'}</p><h3>{summary?.latest?.conflicted ? (isEnglish ? 'Same-day values need verification' : '同日数值需核对') : summary?.latest ? `${summary.latest.value} ${summary.latest.unit} · ${formatDate(summary.latest.measuredAt, locale)}` : (isEnglish ? 'No measurement yet' : '还没有成长测量')}</h3><p>{summary?.summary || (isEnglish ? 'Record a measurement to view the trend.' : '录入测量后查看趋势。')}</p>{summary?.delta !== null && summary?.delta !== undefined && <small>{isEnglish ? `Change from the previous comparable fact: ${summary.delta > 0 ? '+' : ''}${Number(summary.delta).toFixed(2)} ${summary.latest?.unit || ''}` : `较上一条可比较事实：${summary.delta > 0 ? '+' : ''}${Number(summary.delta).toFixed(2)} ${summary.latest?.unit || ''}`}</small>}{summary?.limitations?.[0] && <small className="growth-limit-note"><Info size={13} />{summary.limitations[0]}</small>}</div><button type="button" className="secondary-button compact growth-ai-trigger" onClick={onOpenAi}><MessageCircle size={15} />{isEnglish ? 'Ask Naiba AI to explain' : '让奶爸 AI 解读趋势'}</button></section><button type="button" className="text-button growth-trend-detail-link" onClick={() => navigate(`${ROUTES.growthChart}?metric=${encodeURIComponent(metric)}`)}>{isEnglish ? 'Open full growth curve' : '打开完整生长曲线'}<ArrowRight size={15} /></button></section>
}

function ParentActionsCard({ locale, parentActions, onOpenRecord, onOpenStage }) {
  const isEnglish = locale === 'en-US'
  const done = parentActions.filter((item) => item.status === 'done').length
  return <section className="growth-board-card growth-parent-actions"><header className="growth-card-heading"><div><p className="eyebrow">{isEnglish ? 'Parent actions' : '父母建议完成'}</p><h2>{isEnglish ? 'Care-plan and preventive tasks' : '照护计划与保健代办'}</h2></div><strong className="growth-count">{done}/{parentActions.length}</strong></header><p className="growth-card-note">{isEnglish ? 'These are read-only summaries here. Completion, correction, and void actions stay in the Record center.' : '这里仅展示只读汇总；完成、纠正和作废统一回到记录中心。'}</p>{parentActions.length ? <div className="growth-action-list">{parentActions.slice(0, 5).map((item) => <ParentAction key={item.id} item={item} locale={locale} onOpenRecord={onOpenRecord} />)}</div> : <p className="growth-empty-note">{isEnglish ? 'No formal parent task is due in this stage.' : '当前阶段暂无正式父母代办。'}</p>}<button type="button" className="text-button" onClick={onOpenStage}>{isEnglish ? 'Open stage guide' : '打开阶段指南'}<ArrowRight size={15} /></button></section>
}

function ParentAction({ item, locale, onOpenRecord }) {
  const isEnglish = locale === 'en-US'
  const done = item.status === 'done'
  const dueLabel = item.dueDay === null || item.dueDay === undefined ? (isEnglish ? 'When ready' : '按阶段安排') : (isEnglish ? `Around day ${item.dueDay}` : `出生后第 ${item.dueDay} 天左右`)
  return <article className={`growth-action-item ${done ? 'done' : ''}`}><button type="button" onClick={onOpenRecord} aria-label={isEnglish ? `Open Record center for ${localized(item.title, locale)}` : `去记录中心记录${localized(item.title, locale)}`}>{done ? '✓' : '·'}</button><div><strong>{localized(item.title, locale)}</strong><small>{localized(item.detail, locale)}</small></div><em>{done ? (isEnglish ? 'Done' : '已完成') : dueLabel}</em></article>
}

function RecentGrowthRecords({ locale, evaluations, onOpenHistory, onOpenRecord }) {
  const isEnglish = locale === 'en-US'
  const sorted = evaluations.filter((item) => item.status !== 'voided').sort((a, b) => String(b.measuredAt).localeCompare(String(a.measuredAt))).slice(0, 5)
  return <section className="growth-board-card growth-recent-records"><header className="growth-card-heading"><div><p className="eyebrow">{isEnglish ? 'Recent records' : '最近记录'}</p><h2>{isEnglish ? 'Facts remain traceable' : '事实保留可追溯'}</h2></div><button type="button" className="text-button" onClick={onOpenHistory}>{isEnglish ? 'View all' : '查看全部'}<ArrowRight size={15} /></button></header>{sorted.length ? <div className="growth-recent-list">{sorted.map((item) => <article key={item.id}><div><strong>{item.value} {item.unit}</strong><span>{metricLabel(item.type, locale)} · {formatDate(item.measuredAt, locale)}</span><small>{growthSourceLabel(item.source, locale)}{item.evaluation?.dataQuality === 'sufficient' ? ` · ${standardResultDetail(item.evaluation, locale)}` : ''}</small></div><button type="button" className="text-button" onClick={() => onOpenRecord(item.id)}>{isEnglish ? 'View record' : '查看原记录'}</button></article>)}</div> : <p className="growth-empty-note">{isEnglish ? 'No growth measurement yet.' : '还没有成长测量。'}</p>}</section>
}

function GrowthStagePage({ locale, stage, ageContext, content, parentActions, onOpenRecord }) {
  const isEnglish = locale === 'en-US'
  return <div className="growth-detail-page"><section className="growth-detail-lede"><p className="eyebrow">{isEnglish ? 'Stage guide' : '阶段指南'}</p><h2>{isEnglish ? stage.labelEn : stage.label}</h2><p>{isEnglish ? content.introEn : content.intro}</p><small>{ageContextSummary(ageContext, locale)}</small></section><div className="growth-detail-grid"><section className="growth-board-card"><header className="growth-card-heading"><div><p className="eyebrow">{isEnglish ? 'Parent actions' : '父母建议完成'}</p><h2>{isEnglish ? 'Formal tasks' : '正式代办'}</h2></div><ListChecks size={19} /></header><div className="growth-action-list">{parentActions.map((item) => <ParentAction key={item.id} item={item} locale={locale} onOpenRecord={onOpenRecord} />)}</div></section><section className="growth-board-card"><header className="growth-card-heading"><div><p className="eyebrow">{isEnglish ? 'Baby development' : '宝宝发展重点'}</p><h2>{isEnglish ? 'What to notice' : '建议留意的观察'}</h2></div><CircleHelp size={19} /></header><div className="growth-highlight-list">{content.babyHighlights.map((item) => <article key={item.id}><strong>{isEnglish ? item.titleEn : item.title}</strong><p>{isEnglish ? item.detailEn : item.detail}</p><small>{isEnglish ? item.cautionEn : item.caution}</small></article>)}</div><p className="growth-detail-footnote">{isEnglish ? 'A missed observation is not a failed milestone. Use the Record center for the concrete scene.' : '没有观察到不代表没有完成发育；需要留下事实时，请去记录中心。'}</p></section></div><section className="growth-board-card"><header className="growth-card-heading"><div><p className="eyebrow">{isEnglish ? 'Optional activities' : '可选亲子活动'}</p><h2>{isEnglish ? 'Keep it light and responsive' : '轻量、跟随宝宝状态'}</h2></div><ShieldCheck size={19} /></header><div className="growth-activity-list">{content.recommendedActivities.map((item) => <article key={item.id}><strong>{isEnglish ? item.titleEn : item.title}</strong><span>{isEnglish ? item.detailEn : item.detail}</span></article>)}</div><button type="button" className="secondary-button compact" onClick={onOpenRecord}>{isEnglish ? 'Record an observation' : '去记录中心记录宝宝反应'}</button></section></div>
}

function GrowthChartPage({ locale, baby, measurements, metric, visibleMetrics, onMetricChange, onOpenRecord }) {
  const isEnglish = locale === 'en-US'
  return <div className="growth-detail-page"><section className="growth-detail-lede"><p className="eyebrow">{isEnglish ? 'Full growth curve' : '完整生长曲线'}</p><h2>{isEnglish ? 'One metric, all seven official reference lines' : '单项指标，完整七条官方参考线'}</h2><p>{isEnglish ? 'The detail view keeps the full P3, P10, P25, P50, P75, P90, and P97 set. Switch metrics instead of stacking three charts.' : '详情页完整展示 P3、P10、P25、P50、P75、P90、P97；切换指标查看，不同时堆叠三张图。'}</p></section><section className="growth-board-card growth-chart-card"><header className="growth-card-heading"><div className="growth-switcher">{visibleMetrics.map((item) => <button type="button" key={item.id} className={metric === item.id ? 'active' : ''} onClick={() => onMetricChange(item.id)}>{localized(item.label, locale)}</button>)}</div></header><GrowthChartPanel locale={locale} baby={baby} measurements={measurements} metric={metric} referencePercentiles={DETAIL_REFERENCE_PERCENTILES} onOpenRecord={onOpenRecord} /><footer className="growth-chart-footer"><span>WS/T 423—2022 · {isEnglish ? 'official reference' : '国家标准参考'}</span><a href="https://www.nhc.gov.cn/cms-search/downFiles/e38068f0a62d4a1eb1bd451414444ec1.pdf" target="_blank" rel="noreferrer">{isEnglish ? 'Official source' : '国家卫健委标准原文'}<ExternalLink size={13} /></a></footer></section></div>
}

function GrowthChartPanel({ locale, baby, measurements, metric, referencePercentiles, compact = false, onOpenRecord }) {
  const isEnglish = locale === 'en-US'
  const chartRef = useRef(null)
  const defaultRange = useMemo(() => {
    const context = resolveAgeContext({ baby, at: new Date(), purpose: 'growth_standard' })
    return Math.min(83, Math.max(3, context.chronological?.months ?? 3))
  }, [baby])
  const [range, setRange] = useState(null)
  const [selectedPointId, setSelectedPointId] = useState(null)
  const effectiveRange = range || defaultRange
  const model = useMemo(() => getGrowthChartModel({ baby, measurements, type: metric, startMonth: 0, endMonth: effectiveRange }), [baby, measurements, metric, effectiveRange])
  const rangeOptions = [...new Set([3, 12, 36, 60, 83, defaultRange])]
  const selected = model.points.find((point) => point.id === selectedPointId) || model.points.at(-1) || null

  async function toggleFullscreen() {
    if (!chartRef.current) return
    if (document.fullscreenElement) await document.exitFullscreen?.()
    else await chartRef.current.requestFullscreen?.()
  }

  return <div className={`growth-chart-panel ${compact ? 'compact' : ''}`} ref={chartRef}><div className="growth-chart-tools"><div className="growth-range-switcher">{rangeOptions.map((option) => <button type="button" key={option} className={effectiveRange === option ? 'active' : ''} onClick={() => setRange(option)}>0–{option} {isEnglish ? 'mo' : '个月'}</button>)}</div><button type="button" className="icon-button" onClick={toggleFullscreen} aria-label={isEnglish ? 'Fullscreen chart' : '横屏查看曲线'}><Maximize2 size={16} /></button></div><NationalGrowthChart locale={locale} model={model} referencePercentiles={referencePercentiles} selectedPointId={selected?.id} onSelectPoint={setSelectedPointId} /><div className="growth-point-detail">{selected ? <><div><strong>{metricLabel(metric, locale)} · {selected.value} {model.unit}</strong><span>{formatDate(selected.measuredAt, locale)} · {selected.quality === 'standard' ? standardResultLabel(selected.evaluation, locale) : (isEnglish ? 'Fact only' : '仅事实')}</span>{selected.conflicted && <small className="growth-conflict-note"><Info size={13} />{isEnglish ? 'Same-day values conflict; change is not calculated.' : '同日存在不同数值，暂不计算变化。'}</small>}</div><button type="button" className="text-button" onClick={() => onOpenRecord?.(selected.id)}>{isEnglish ? 'View original record' : '查看原记录'}</button></> : <span>{isEnglish ? 'Select a point to see details.' : '点击宝宝轨迹上的点查看详情。'}</span>}</div>{!compact && <GrowthDataTable locale={locale} model={model} onOpenRecord={onOpenRecord} />}</div>
}

function lineSegments(points = []) {
  const segments = []
  let current = []
  points.forEach((point) => {
    if (point.conflicted) {
      if (current.length) segments.push(current)
      current = []
      return
    }
    current.push(point)
  })
  if (current.length) segments.push(current)
  return segments
}

function NationalGrowthChart({ locale, model, referencePercentiles = DETAIL_REFERENCE_PERCENTILES, selectedPointId, onSelectPoint }) {
  const isEnglish = locale === 'en-US'
  const width = 760
  const height = 340
  const pad = { top: 20, right: 22, bottom: 42, left: 52 }
  const references = model.reference.filter((line) => referencePercentiles.includes(line.percentile))
  const allValues = [...references.flatMap((line) => line.points.map((point) => point.value)), ...model.points.map((point) => point.value)].filter(Number.isFinite)
  if (!allValues.length) return <div className="growth-chart-empty"><LineChart size={26} /><p>{isEnglish ? 'Add a valid measurement to draw the trajectory.' : '录入有效测量后，才能绘制宝宝轨迹。'}</p></div>
  const minValue = Math.min(...allValues)
  const maxValue = Math.max(...allValues)
  const yMin = Math.max(0, minValue - Math.max((maxValue - minValue) * 0.12, 0.2))
  const yMax = maxValue + Math.max((maxValue - minValue) * 0.12, 0.2)
  const x = (month) => pad.left + (month / Math.max(1, model.range.endMonth)) * (width - pad.left - pad.right)
  const y = (value) => height - pad.bottom - ((value - yMin) / Math.max(0.01, yMax - yMin)) * (height - pad.top - pad.bottom)
  const path = (points) => points.map((point, index) => `${index ? 'L' : 'M'}${x(point.month).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ')
  const ticks = model.range.endMonth <= 12 ? Array.from({ length: model.range.endMonth + 1 }, (_, index) => index) : [0, 3, 6, 9, 12, 18, 24, 36, 48, 60, 72, 83].filter((tick) => tick <= model.range.endMonth)
  const lineColors = { 3: '#d67e67', 10: '#dfa27f', 25: '#b9a680', 50: '#52746b', 75: '#b9a680', 90: '#dfa27f', 97: '#d67e67' }
  return <div className="growth-chart-wrap"><svg className="growth-chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={isEnglish ? 'Growth standard chart' : '生长标准曲线'}><rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={height - pad.top - pad.bottom} className="growth-chart-plot" />{ticks.map((tick) => <g key={tick}><line x1={x(tick)} x2={x(tick)} y1={pad.top} y2={height - pad.bottom} className="growth-chart-grid" /><text x={x(tick)} y={height - 15} textAnchor="middle">{tick}</text></g>)}{references.map((line) => <path key={line.id} d={path(line.points)} fill="none" stroke={lineColors[line.percentile]} strokeWidth={line.percentile === 50 ? 2.4 : line.percentile === 3 || line.percentile === 97 ? 1.8 : 1.2} strokeDasharray={line.percentile === 50 ? undefined : '5 5'} opacity={line.percentile === 50 ? 0.95 : 0.65} />)}{lineSegments(model.points).map((segment, index) => <path key={`baby-${index}`} d={path(segment)} fill="none" stroke="#273f3a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />)}{model.points.map((point) => <circle key={point.id} cx={x(point.month)} cy={y(point.value)} r={point.id === selectedPointId ? 7 : 5} className={`growth-chart-baby-point ${point.id === selectedPointId ? 'selected' : ''} ${point.conflicted ? 'conflict' : ''}`} tabIndex="0" role="button" aria-label={`${point.measuredAt} · ${point.value} ${model.unit}`} onClick={() => onSelectPoint?.(point.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelectPoint?.(point.id) }}><title>{`${point.measuredAt} · ${point.value} ${model.unit}`}</title></circle>)}<text x={pad.left} y={14}>{model.unit}</text><text x={width - pad.right} y={height - 15} textAnchor="end">{isEnglish ? 'completed months' : '出生后整月'}</text></svg><div className="growth-chart-legend">{references.map((line) => <span key={line.id}><i style={{ borderTopColor: lineColors[line.percentile] }} />P{line.percentile}</span>)}<span><i className="baby-line" />{isEnglish ? 'Baby' : '宝宝轨迹'}</span></div>{model.birthPoint && <p className="growth-birth-marker"><Info size={14} />{isEnglish ? `Birth record: ${model.birthPoint.value} ${model.unit}; WS/T 800 is shown separately.` : `出生记录：${model.birthPoint.value} ${model.unit}；出生点按 WS/T 800 单独评价，不与月龄曲线混画。`}</p>}</div>
}

function GrowthDataTable({ locale, model, onOpenRecord }) {
  const isEnglish = locale === 'en-US'
  return <section className="growth-chart-table"><header><strong>{isEnglish ? 'Measurement details' : '测量明细'}</strong><span>{isEnglish ? 'Fact and reference stay separate' : '事实与标准分开显示'}</span></header>{model.points.length ? <div className="growth-chart-table-scroll"><table><thead><tr><th>{isEnglish ? 'Date' : '日期'}</th><th>{isEnglish ? 'Value' : '数值'}</th><th>{isEnglish ? 'Reference' : '参考'}</th><th>{isEnglish ? 'Source' : '来源'}</th><th aria-label={isEnglish ? 'Actions' : '操作'} /></tr></thead><tbody>{model.points.map((point) => <tr key={point.id}><td>{formatDate(point.measuredAt, locale)}</td><td>{point.value} {model.unit}</td><td>{point.conflicted ? (isEnglish ? 'Verify' : '需核对') : point.quality === 'standard' ? `${standardResultLabel(point.evaluation, locale)} · ${standardResultDetail(point.evaluation, locale)}` : (isEnglish ? 'Fact only' : '仅事实')}</td><td>{growthSourceLabel(point.source || point.evaluation?.measurementSource, locale)}</td><td><button type="button" className="text-button" onClick={() => onOpenRecord?.(point.id)}>{isEnglish ? 'View' : '查看'}</button></td></tr>)}</tbody></table></div> : <p className="growth-empty-note">{isEnglish ? 'No measurements in this range.' : '这个月龄范围内还没有测量。'}</p>}</section>
}

function GrowthHistoryPage({ locale, evaluations, onRecord, onOpenRecord }) {
  const isEnglish = locale === 'en-US'
  const sorted = evaluations.filter((item) => item.status !== 'voided').sort((a, b) => String(b.measuredAt).localeCompare(String(a.measuredAt)))
  return <div className="growth-detail-page"><section className="growth-detail-lede"><p className="eyebrow">{isEnglish ? 'Measurement history' : '成长历史记录'}</p><h2>{isEnglish ? 'Facts first, references attached' : '先看事实，再看参考'}</h2><p>{isEnglish ? 'Every value keeps its date, source, standard version, and limitations.' : '每个数值都保留日期、来源、标准版本和适用限制。'}</p><button type="button" className="primary-button compact" onClick={onRecord}><LineChart size={15} />{isEnglish ? 'Record another measurement' : '去记录中心录入'}</button></section><section className="growth-board-card growth-history-card">{sorted.length === 0 ? <div className="growth-chart-empty"><Baby size={26} /><p>{isEnglish ? 'No growth measurements yet.' : '还没有成长测量记录。'}</p></div> : <div className="growth-history-list">{sorted.map((item) => <article key={item.id}><div className="growth-history-value"><strong>{item.value} {item.unit}</strong><span>{metricLabel(item.type, locale)}</span></div><div><strong>{formatDate(item.measuredAt, locale)}</strong><small>{growthSourceLabel(item.source, locale)}</small></div><div className={`growth-history-result ${item.conflicted ? 'limited' : item.evaluation?.dataQuality === 'sufficient' ? 'good' : 'limited'}`}><strong>{item.conflicted ? (isEnglish ? 'Verify same-day values' : '同日数值需核对') : item.evaluation?.dataQuality === 'sufficient' ? `${standardResultLabel(item.evaluation, locale)} · ${standardResultDetail(item.evaluation, locale)}` : (isEnglish ? 'Fact only' : '仅展示事实')}</strong><small>{item.conflicted ? (isEnglish ? 'Change is not calculated.' : '暂不计算变化。') : item.evaluation?.dataQuality === 'sufficient' ? `${item.evaluation.standardPackageId} · ${ageBasisLabel(item.evaluation.ageBasis, locale)} · ${growthTrajectoryLabel(item.evaluation.trajectoryStatus, locale)}` : item.evaluation?.limitations?.[0]}</small></div><button type="button" className="text-button" onClick={() => onOpenRecord?.(item.id)}>{isEnglish ? 'View original record' : '查看原记录'}</button></article>)}</div>}</section></div>
}
