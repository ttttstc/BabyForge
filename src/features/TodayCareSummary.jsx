import { Baby, Droplets, Moon, Pill, Plus } from 'lucide-react'
import { buildRecordRoute, navigate, ROUTES } from '../app/router.js'
import { formatDurationMinutes, getDailyCareSummary, localDayKey } from '../domain/careSummary.js'

function clock(value, locale) {
  if (!value) return locale === 'en-US' ? 'Not recorded' : '暂无记录'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? (locale === 'en-US' ? 'Time missing' : '时间未填') : date.toLocaleTimeString(locale === 'en-US' ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function latestTime(event, locale) {
  if (!event) return locale === 'en-US' ? 'Not recorded' : '暂无记录'
  if (event.category === 'sleep' && event.payload?.endedAt) return `${clock(event.occurredAt, locale)}–${clock(event.payload.endedAt, locale)}`
  return clock(event.occurredAt || event.createdAt, locale)
}

export function TodayCareSummary({ careEvents = [], locale = 'zh-CN', readOnly = false }) {
  const isEnglish = locale === 'en-US'
  const daily = getDailyCareSummary(careEvents, localDayKey())
  const cards = [
    {
      id: 'feeding', icon: Baby, label: isEnglish ? 'Feeding' : '喂养',
      value: isEnglish ? `${daily.feeding.breastfeedingCount} breast · ${daily.feeding.bottleMl} mL / ${daily.feeding.bottleCount} bottles` : `亲喂 ${daily.feeding.breastfeedingCount} 次 · 瓶喂 ${daily.feeding.bottleMl} mL / ${daily.feeding.bottleCount} 次`,
      latest: latestTime(daily.feeding.latest, locale),
    },
    {
      id: 'sleep', icon: Moon, label: isEnglish ? 'Sleep' : '睡眠',
      value: isEnglish ? `${formatDurationMinutes(daily.sleep.minutes, locale)} · ${daily.sleep.segmentCount} intervals` : `${formatDurationMinutes(daily.sleep.minutes, locale)} · ${daily.sleep.segmentCount} 段`,
      latest: latestTime(daily.sleep.latest, locale),
    },
    {
      id: 'diaper', icon: Droplets, label: isEnglish ? 'Diapers' : '尿布',
      value: isEnglish ? `${daily.diaper.wetCount} wet · ${daily.diaper.stoolCount} stool` : `尿湿 ${daily.diaper.wetCount} 次 · 排便 ${daily.diaper.stoolCount} 次`,
      latest: latestTime(daily.diaper.latest, locale),
    },
    {
      id: 'medication', icon: Pill, label: isEnglish ? 'Medication' : '用药',
      value: daily.medication.count ? (isEnglish ? `${daily.medication.count} recorded doses` : `实际用药 ${daily.medication.count} 次`) : (isEnglish ? 'No record' : '暂无记录'),
      latest: latestTime(daily.medication.latest, locale),
    },
  ]

  return <section className="rail-card today-care-summary" data-testid="today-care-summary">
    <header className="today-care-summary-heading"><div><p className="eyebrow">{isEnglish ? 'Saved facts · today' : '今日已保存事实'}</p><h2>{isEnglish ? 'Care at a glance' : '照护汇总'}</h2></div><span>{isEnglish ? 'Today' : '今天'}</span></header>
    <div className="today-care-grid">
      {cards.map((card) => {
        const Icon = card.icon
        const viewRoute = buildRecordRoute({ filter: card.id, date: 'today', returnTo: ROUTES.today })
        const recordRoute = buildRecordRoute({ panel: card.id, returnTo: ROUTES.today })
        return <article className={`today-care-card ${card.id}`} key={card.id}>
          <button className="today-care-card-body" type="button" onClick={() => navigate(viewRoute)} aria-label={`${card.label} · ${isEnglish ? 'view today records' : '查看今天记录'}`}>
            <span className="today-care-card-icon"><Icon size={17} /></span>
            <span className="today-care-card-copy"><strong>{card.label}</strong><b>{card.value}</b><small>{isEnglish ? 'Latest' : '最近'} {card.latest}</small></span>
          </button>
          <button className="today-care-card-add" type="button" disabled={readOnly} onClick={() => navigate(recordRoute)} aria-label={`${isEnglish ? 'Add' : '新增'}${card.label}`}><Plus size={17} /></button>
        </article>
      })}
    </div>
    <p className="today-care-boundary">{isEnglish ? 'No record means only that no fact was saved.' : '“暂无记录”只表示尚未保存事实，不代表没有发生。'}</p>
  </section>
}
