import { useMemo } from 'react'
import { ArrowRight, ChartNoAxesCombined, CircleHelp } from 'lucide-react'
import { getCareSnapshot } from '../domain/careSummary.js'
import { projectBabyState } from '../domain/babyState.js'
import { navigate, ROUTES } from '../app/router.js'

export function TodayAiAnalysis({ baby, careEvents = [], concerns = [], locale = 'zh-CN' }) {
  const isEnglish = locale === 'en-US'
  const snapshot = useMemo(() => projectBabyState({ baby, events: careEvents, concerns }), [baby, careEvents, concerns])
  const summary = useMemo(() => getCareSnapshot(careEvents), [careEvents])
  const change = snapshot.current.changes[0]
  const copy = change
    ? (isEnglish ? `${change.dimension}: ${change.status.replaceAll('-', ' ')}.` : change.message)
    : snapshot.recent24h.facts.length
      ? (isEnglish ? `${snapshot.recent24h.facts.length} recent facts are available. No automated conclusion is made from missing data.` : `最近 24 小时有 ${snapshot.recent24h.facts.length} 条事实记录，缺失数据不会被当作零。`)
      : (isEnglish ? 'There are not enough recent records for a trend. Keep recording what you observe.' : '最近记录还不足以形成趋势，先继续记录你看到的事实。')

  return <section className="today-ai-analysis" data-testid="today-ai-analysis"><header><div><p className="eyebrow">{isEnglish ? 'Naiba AI · Today' : '奶爸AI · 今天'}</p><h2>{isEnglish ? 'One thing worth knowing' : '今天值得知道的一件事'}</h2></div><ChartNoAxesCombined size={17} /></header><p className="today-ai-analysis-copy">{copy}</p><div className="today-ai-analysis-metrics"><span>{isEnglish ? 'Feeds · 24h' : '喂养 · 24 小时'} <strong>{summary.metrics.feedingCount || '—'}</strong></span><span>{isEnglish ? 'Wet diapers' : '湿尿布'} <strong>{summary.metrics.wetDiaperCount || '—'}</strong></span></div><button type="button" onClick={() => navigate(`${ROUTES.naibaAi}?topic=analysis`)}>{isEnglish ? 'Open detailed analysis' : '打开详细分析'}<ArrowRight size={14} /></button><small><CircleHelp size={12} />{isEnglish ? 'This is a record summary, not a health score.' : '这是记录整理，不是健康评分。'}</small></section>
}
