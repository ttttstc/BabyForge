import { useState } from 'react'
import { Activity, AlertCircle, Baby, Clock3, Droplets, Thermometer, Trash2 } from 'lucide-react'
import { eventFacts, eventTitle, formatEventTime, getCareSnapshot, getRecentCareEvents } from '../domain/careSummary.js'
import { projectBabyState } from '../domain/babyState.js'

function text(value, locale) {
  return value?.[locale === 'en-US' ? 'en' : 'zh'] || value?.zh || value || ''
}

const QUICK_RECORD_CATEGORIES = new Set(['breastfeeding', 'bottle_feeding', 'diaper'])

export function CareOverview({ baby = null, careEvents = [], concerns = [], locale = 'zh-CN', onDeleteQuickRecord, readOnly = false }) {
  const isEnglish = locale === 'en-US'
  // BabyStateSnapshot is the canonical source for current metrics, changes,
  // conflicts, and concerns. careSummary is kept only for the presentation
  // timeline and its human-readable last-event labels.
  const timelineSnapshot = getCareSnapshot(careEvents, concerns)
  const stateSnapshot = projectBabyState({ baby, events: careEvents, concerns })
  const recent = getRecentCareEvents(careEvents, 6)
  const feedingFacts = stateSnapshot.recent24h.facts.filter((fact) => fact.stateKey === 'feeding.count')
  const diaperFacts = stateSnapshot.recent24h.facts.filter((fact) => fact.stateKey === 'elimination.count')
  const wetDiaperCount = diaperFacts.filter((fact) => ['urine', 'both'].includes(fact.value?.kind)).length
  const temperatureFact = stateSnapshot.current.known.find((fact) => fact.stateKey === 'temperature.reading')
  const openConcerns = stateSnapshot.activeProblems
  const [deletingId, setDeletingId] = useState('')
  const [deleteError, setDeleteError] = useState('')
  async function deleteQuickRecord(event) {
    if (!onDeleteQuickRecord || readOnly || deletingId) return
    const title = eventTitle(event, locale)
    const message = isEnglish
      ? `Void this quick record: ${title}? It will be removed from current records; audit history is kept.`
      : `确认撤销这条快捷记录“${title}”？它会从当前记录中移除，历史记录会保留。`
    if (typeof globalThis.confirm === 'function' && !globalThis.confirm(message)) return
    setDeleteError('')
    setDeletingId(event.id)
    try {
      const result = await onDeleteQuickRecord(event.id)
      if (result === false) setDeleteError(isEnglish ? 'This record could not be voided. Try again.' : '这条记录未能撤销，请重试。')
    } catch (error) {
      setDeleteError(error?.message || (isEnglish ? 'This record could not be voided. Try again.' : '这条记录未能撤销，请重试。'))
    } finally {
      setDeletingId('')
    }
  }
  return <section className="care-overview inspector-block" data-testid="care-overview">
    <header className="care-overview-heading"><div><p className="eyebrow">{isEnglish ? 'Baby now' : '宝宝当前状态'}</p><h2>{isEnglish ? 'What matters today' : '今天真正需要知道的'}</h2></div><Activity size={18} /></header>
    <div className="care-metric-grid">
      <Metric icon={Baby} label={isEnglish ? 'Feeds · 24h' : '喂养 · 24 小时'} value={feedingFacts.length || '—'} />
      <Metric icon={Droplets} label={isEnglish ? 'Wet diapers · 24h' : '湿尿布 · 24 小时'} value={wetDiaperCount || '—'} />
      <Metric icon={Thermometer} label={isEnglish ? 'Last temperature' : '最近体温'} value={temperatureFact ? `${temperatureFact.value?.value || '—'} ${temperatureFact.value?.unit || ''}` : '—'} />
      <Metric icon={AlertCircle} label={isEnglish ? 'Open concerns' : '进行中的关注'} value={openConcerns.length || '—'} />
    </div>
    <div className="care-overview-last"><span>{isEnglish ? 'Last feed' : '最近喂养'}</span><strong>{eventTitle(timelineSnapshot.lastFeeding, locale)}</strong><small>{formatEventTime(timelineSnapshot.lastFeeding, locale)}</small></div>
    <div className="care-overview-last"><span>{isEnglish ? 'Last diaper' : '最近尿便'}</span><strong>{eventTitle(timelineSnapshot.lastDiaper, locale)}</strong><small>{formatEventTime(timelineSnapshot.lastDiaper, locale)}</small></div>
    {openConcerns.length > 0 && <div className="care-overview-concerns"><strong><AlertCircle size={14} />{isEnglish ? 'Follow-up in progress' : '正在跟进'}</strong>{openConcerns.slice(0, 2).map((concern) => <p key={concern.id}>{text(concern.title, locale)}</p>)}</div>}
    <CareStateSummary snapshot={stateSnapshot} isEnglish={isEnglish} />
    <div className="care-timeline"><div className="inspector-section-title"><Clock3 size={16} /><span>{isEnglish ? 'Recent timeline' : '最近时间线'}</span></div>{recent.length === 0 ? <p className="care-empty">{isEnglish ? 'Quick records will appear here.' : '快捷记录会出现在这里。'}</p> : recent.map((event) => { const deletable = QUICK_RECORD_CATEGORIES.has(event.category); return <article key={event.id} className="care-timeline-item"><span className="care-timeline-dot" /><div><strong>{eventTitle(event, locale)}</strong><small>{formatEventTime(event, locale)} · {eventFacts(event, locale)}</small></div>{deletable && <button type="button" className="care-timeline-delete" disabled={readOnly || deletingId === event.id} onClick={() => deleteQuickRecord(event)} aria-label={isEnglish ? `Void ${eventTitle(event, locale)}` : `撤销${eventTitle(event, locale)}`} title={isEnglish ? 'Void quick record' : '撤销快捷记录'}><Trash2 size={14} /></button>}</article> })}</div>
    {deleteError && <p className="save-error" role="alert">{deleteError}</p>}
  </section>
}

function CareStateSummary({ snapshot, isEnglish }) {
  const missingBaselines = Object.values(snapshot.baseline).filter((item) => item?.dimension && item.status === 'missing')
  const hasSignals = snapshot.current.conflicts.length > 0 || snapshot.current.changes.length > 0 || missingBaselines.length > 0 || snapshot.current.unknown.length > 0
  if (!hasSignals) return null
  return <div className="care-state-summary"><strong>{isEnglish ? 'Calculated from records' : '根据记录自动整理'}</strong>{snapshot.current.conflicts.slice(0, 1).map((conflict) => <p key={conflict.id}>{isEnglish ? 'Conflicting caregiver observations need confirmation.' : conflict.message}</p>)}{snapshot.current.changes.slice(0, 2).map((change) => <p key={change.id}>{isEnglish ? `${change.dimension}: ${change.status.replaceAll('-', ' ')}` : change.message}</p>)}{missingBaselines.slice(0, 1).map((baseline) => <p key={`baseline-${baseline.dimension}`}>{isEnglish ? `${baseline.dimension}: personal baseline is not established yet.` : `${baseline.dimension === 'feeding' ? '喂养' : '尿便'}暂无个人基线，当前只显示已记录事实。`}</p>)}{snapshot.current.unknown.length > 0 && <p>{isEnglish ? `${snapshot.current.unknown.length} domains have no current fact.` : `还有 ${snapshot.current.unknown.length} 个领域尚未记录当前事实。`}</p>}</div>
}

function Metric({ icon: Icon, label, value }) {
  return <div className="care-metric"><Icon size={15} /><span>{label}</span><strong>{value}</strong></div>
}
