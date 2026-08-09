import { Activity, AlertCircle, Baby, Clock3, Droplets, Moon, Pill, Plus } from 'lucide-react'
import { eventFacts, eventTitle, formatDurationMinutes, formatEventTime, getDailyCareSummary, getRecentCareEvents, localDayKey } from '../domain/careSummary.js'
import { projectBabyState } from '../domain/babyState.js'
import { buildRecordRoute, navigate, ROUTES } from '../app/router.js'

function text(value, locale) {
  return value?.[locale === 'en-US' ? 'en' : 'zh'] || value?.zh || value || ''
}

export function CareOverview({ baby = null, careEvents = [], concerns = [], locale = 'zh-CN' }) {
  const isEnglish = locale === 'en-US'
  // BabyStateSnapshot is the canonical source for current metrics, changes,
  // conflicts, and concerns. careSummary is kept only for the presentation
  // timeline and its human-readable last-event labels.
  const stateSnapshot = projectBabyState({ baby, events: careEvents, concerns })
  const recent = getRecentCareEvents(careEvents, 6)
  const daily = getDailyCareSummary(careEvents, localDayKey())
  const openConcerns = stateSnapshot.activeProblems
  return <section className="care-overview inspector-block" data-testid="care-overview">
    <header className="care-overview-heading"><div><p className="eyebrow">{isEnglish ? 'Baby now' : '宝宝当前状态'}</p><h2>{isEnglish ? 'Today’s records' : '今日记录'}</h2></div><Activity size={18} /></header>
    <div className="care-metric-grid">
      <Metric type="feeding" icon={Baby} label={isEnglish ? 'Feeds · today' : '喂养 · 今天'} value={daily.feeding.totalCount || '—'} detail={daily.feeding.bottleMl ? `${daily.feeding.bottleMl} mL` : ''} />
      <Metric type="sleep" icon={Moon} label={isEnglish ? 'Sleep · today' : '睡眠 · 今天'} value={daily.sleep.segmentCount || '—'} detail={daily.sleep.minutes ? formatDurationMinutes(daily.sleep.minutes, locale) : ''} />
      <Metric type="diaper" icon={Droplets} label={isEnglish ? 'Diapers · today' : '尿布 · 今天'} value={daily.diaper.totalCount || '—'} detail={`${daily.diaper.wetCount} ${isEnglish ? 'wet' : '尿'} · ${daily.diaper.stoolCount} ${isEnglish ? 'stool' : '便'}`} />
      <Metric type="medication" icon={Pill} label={isEnglish ? 'Medication · today' : '用药 · 今天'} value={daily.medication.count || '—'} />
    </div>
    <div className="care-overview-last"><span>{isEnglish ? 'Last feed · today' : '今天最后喂养'}</span><strong>{eventTitle(daily.feeding.latest, locale)}</strong><small>{formatEventTime(daily.feeding.latest, locale)}</small></div>
    <div className="care-overview-last"><span>{isEnglish ? 'Last diaper · today' : '今天最后尿便'}</span><strong>{eventTitle(daily.diaper.latest, locale)}</strong><small>{formatEventTime(daily.diaper.latest, locale)}</small></div>
    {openConcerns.length > 0 && <div className="care-overview-concerns"><strong><AlertCircle size={14} />{isEnglish ? 'Follow-up in progress' : '正在跟进'}</strong>{openConcerns.slice(0, 2).map((concern) => <p key={concern.id}>{text(concern.title, locale)}</p>)}</div>}
    <CareStateSummary snapshot={stateSnapshot} isEnglish={isEnglish} />
    <div className="care-timeline"><div className="inspector-section-title"><Clock3 size={16} /><span>{isEnglish ? 'Recent records' : '最近记录'}</span></div>{recent.length === 0 ? <p className="care-empty">{isEnglish ? 'Saved records will appear here.' : '已保存的记录会出现在这里。'}</p> : recent.map((event) => <article key={event.id} className="care-timeline-item"><span className="care-timeline-dot" /><div><strong>{eventTitle(event, locale)}</strong><small>{formatEventTime(event, locale)} · {eventFacts(event, locale)}</small></div></article>)}</div>
  </section>
}

function CareStateSummary({ snapshot, isEnglish }) {
  const missingBaselines = Object.values(snapshot.baseline).filter((item) => item?.dimension && item.status === 'missing')
  const hasSignals = snapshot.current.conflicts.length > 0 || snapshot.current.changes.length > 0 || missingBaselines.length > 0 || snapshot.current.unknown.length > 0
  if (!hasSignals) return null
  return <div className="care-state-summary"><strong>{isEnglish ? 'Calculated from records' : '根据记录自动整理'}</strong>{snapshot.current.conflicts.slice(0, 1).map((conflict) => <p key={conflict.id}>{isEnglish ? 'Conflicting caregiver observations need confirmation.' : conflict.message}</p>)}{snapshot.current.changes.slice(0, 2).map((change) => <p key={change.id}>{isEnglish ? `${change.dimension}: ${change.status.replaceAll('-', ' ')}` : change.message}</p>)}{missingBaselines.slice(0, 1).map((baseline) => <p key={`baseline-${baseline.dimension}`}>{isEnglish ? `${baseline.dimension}: personal baseline is not established yet.` : `${baseline.dimension === 'feeding' ? '喂养' : '尿便'}暂无个人基线，当前只显示已记录事实。`}</p>)}{snapshot.current.unknown.length > 0 && <p>{isEnglish ? `${snapshot.current.unknown.length} domains have no current fact.` : `还有 ${snapshot.current.unknown.length} 个领域尚未记录当前事实。`}</p>}</div>
}

function Metric({ type, icon: Icon, label, value, detail }) {
  const panel = type === 'feeding' || type === 'sleep' || type === 'diaper' || type === 'medication' ? type : null
  return <article className="care-metric"><button type="button" className="care-metric-main" onClick={() => navigate(buildRecordRoute({ filter: type, date: 'today', returnTo: ROUTES.today }))} aria-label={label}><Icon size={15} /><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</button><button type="button" className="care-metric-add" onClick={() => navigate(buildRecordRoute({ panel, returnTo: ROUTES.today }))} aria-label={`${label} +`}> <Plus size={15} /><span>＋</span></button></article>
}
