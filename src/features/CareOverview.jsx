import { useState } from 'react'
import { Activity, AlertCircle, Baby, Clock3, Droplets, Thermometer, Trash2 } from 'lucide-react'
import { eventFacts, eventTitle, formatEventTime, getCareSnapshot, getRecentCareEvents } from '../domain/careSummary.js'

function text(value, locale) {
  return value?.[locale === 'en-US' ? 'en' : 'zh'] || value?.zh || value || ''
}

const QUICK_RECORD_CATEGORIES = new Set(['breastfeeding', 'bottle_feeding', 'diaper'])

export function CareOverview({ careEvents = [], concerns = [], locale = 'zh-CN', onDeleteQuickRecord, readOnly = false }) {
  const isEnglish = locale === 'en-US'
  const [deletingId, setDeletingId] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const snapshot = getCareSnapshot(careEvents, concerns)
  const recent = getRecentCareEvents(careEvents, 6)
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
      <Metric icon={Baby} label={isEnglish ? 'Feeds · 24h' : '喂养 · 24 小时'} value={snapshot.metrics.feedingCount || '—'} />
      <Metric icon={Droplets} label={isEnglish ? 'Wet diapers · 24h' : '湿尿布 · 24 小时'} value={snapshot.metrics.wetDiaperCount || '—'} />
      <Metric icon={Thermometer} label={isEnglish ? 'Last temperature' : '最近体温'} value={snapshot.lastTemperature ? `${snapshot.lastTemperature.payload?.value || '—'} ${snapshot.lastTemperature.payload?.unit || ''}` : '—'} />
      <Metric icon={AlertCircle} label={isEnglish ? 'Open concerns' : '进行中的关注'} value={snapshot.openConcerns.length || '—'} />
    </div>
    <div className="care-overview-last"><span>{isEnglish ? 'Last feed' : '最近喂养'}</span><strong>{eventTitle(snapshot.lastFeeding, locale)}</strong><small>{formatEventTime(snapshot.lastFeeding, locale)}</small></div>
    <div className="care-overview-last"><span>{isEnglish ? 'Last diaper' : '最近尿便'}</span><strong>{eventTitle(snapshot.lastDiaper, locale)}</strong><small>{formatEventTime(snapshot.lastDiaper, locale)}</small></div>
    {snapshot.openConcerns.length > 0 && <div className="care-overview-concerns"><strong><AlertCircle size={14} />{isEnglish ? 'Follow-up in progress' : '正在跟进'}</strong>{snapshot.openConcerns.slice(0, 2).map((concern) => <p key={concern.id}>{text(concern.title, locale)}</p>)}</div>}
    <div className="care-timeline"><div className="inspector-section-title"><Clock3 size={16} /><span>{isEnglish ? 'Recent timeline' : '最近时间线'}</span></div>{recent.length === 0 ? <p className="care-empty">{isEnglish ? 'Quick records will appear here.' : '快捷记录会出现在这里。'}</p> : recent.map((event) => { const deletable = QUICK_RECORD_CATEGORIES.has(event.category); return <article key={event.id} className="care-timeline-item"><span className="care-timeline-dot" /><div><strong>{eventTitle(event, locale)}</strong><small>{formatEventTime(event, locale)} · {eventFacts(event, locale)}</small></div>{deletable && <button type="button" className="care-timeline-delete" disabled={readOnly || deletingId === event.id} onClick={() => deleteQuickRecord(event)} aria-label={isEnglish ? `Void ${eventTitle(event, locale)}` : `撤销${eventTitle(event, locale)}`} title={isEnglish ? 'Void quick record' : '撤销快捷记录'}><Trash2 size={14} /></button>}</article> })}</div>
    {deleteError && <p className="save-error" role="alert">{deleteError}</p>}
  </section>
}

function Metric({ icon: Icon, label, value }) {
  return <div className="care-metric"><Icon size={15} /><span>{label}</span><strong>{value}</strong></div>
}
