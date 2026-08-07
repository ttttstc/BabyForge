import { useMemo, useState } from 'react'
import { AlertTriangle, BookOpenCheck, ChevronDown, ChevronUp, Clock3, ExternalLink, Sparkles, Utensils } from 'lucide-react'
import { calculateFeedingRecommendation } from '../domain/feedingRecommendation.js'
import { navigate, ROUTES } from '../app/router.js'

export function TodayFeedingRecommendation({ baby, careEvents = [], locale = 'zh-CN' }) {
  const isEnglish = locale === 'en-US'
  const [expanded, setExpanded] = useState(false)
  const recommendation = useMemo(() => calculateFeedingRecommendation({ baby, events: careEvents, locale }), [baby, careEvents, locale])
  const title = isEnglish ? 'Today’s feeding reference' : '今日饮食建议'

  function openAi() {
    navigate(`${ROUTES.naibaAi}?topic=feeding`)
  }

  function openRecord() {
    navigate(`${ROUTES.records}?panel=feeding`)
  }

  return <section className={`today-feeding-card ${recommendation.status}`} data-testid="today-feeding-recommendation">
    <header className="today-feeding-heading">
      <div className="today-feeding-title"><span className="today-feeding-icon"><Utensils size={16} /></span><div><p className="eyebrow">{isEnglish ? 'Naiba AI · Today' : '奶爸AI · 今天'}</p><h2>{title}</h2></div></div>
      <span className="today-feeding-version">{recommendation.knowledgeVersion.replace('feeding-pack-', 'v')}</span>
    </header>
    {recommendation.status === 'safety_action_required' ? <div className="today-feeding-safety"><AlertTriangle size={17} /><div><strong>{isEnglish ? 'Safety first' : '先处理安全问题'}</strong><p>{recommendation.message}</p></div></div> : recommendation.status === 'needs_information' ? <div className="today-feeding-missing"><strong>{isEnglish ? 'Add one key fact first' : '先补充一个关键事实'}</strong><p>{recommendation.message}</p><button type="button" onClick={openAi}><Sparkles size={14} />{isEnglish ? 'Open Naiba AI' : '打开奶爸AI补充'}</button></div> : recommendation.status === 'unsupported' ? <div className="today-feeding-missing"><strong>{isEnglish ? 'Reference not available for this age' : '当前年龄暂无已验证用量规则'}</strong><p>{recommendation.message}</p><button type="button" onClick={openAi}><Sparkles size={14} />{isEnglish ? 'Ask Naiba AI' : '询问奶爸AI'}</button></div> : <>
      <div className="today-feeding-context"><span>{isEnglish ? `${recommendation.ageMonths} months · ${recommendation.feedingModeLabel}` : `${recommendation.ageMonths} 月龄 · ${recommendation.feedingModeLabel}`}</span><span><Clock3 size={13} />{isEnglish ? 'Generated from profile and records' : '根据档案和记录生成'}</span></div>
      <div className="today-feeding-items">{recommendation.recommendations.slice(0, 2).map((item, index) => <article className={`today-feeding-item ${index === 0 ? 'primary' : ''}`} key={item.id}>
        <div className="today-feeding-item-top"><strong>{index === 0 ? (isEnglish ? 'Today’s main reference' : '今日总目标') : (isEnglish ? 'Next meal direction' : '下一餐方向')}</strong><span>{item.timing}</span></div>
        <h3>{item.title}</h3><p className="today-feeding-quantity">{item.quantity}</p><p>{item.detail}</p>
        <button type="button" className="today-feeding-record" onClick={openRecord}>{isEnglish ? 'Record actual intake' : '去记录实际摄入'}</button>
      </article>)}</div>
      <div className="today-feeding-actions"><button type="button" className="today-feeding-ai" onClick={openAi}><Sparkles size={14} />{isEnglish ? 'Ask why' : '问问为什么这样推荐'}</button><button type="button" className="today-feeding-expand" onClick={() => setExpanded((value) => !value)}>{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{expanded ? (isEnglish ? 'Hide basis' : '收起依据') : (isEnglish ? 'View basis' : '查看依据')}</button></div>
      {expanded && <div className="today-feeding-details"><div className="today-feeding-detail-section"><div className="inspector-section-title"><BookOpenCheck size={15} /><span>{isEnglish ? 'Used baby facts' : '本次使用的宝宝信息'}</span></div><ul>{recommendation.usedFacts.map((fact) => <li key={fact.key}><span>{fact.label}</span><strong>{fact.value || '—'}</strong></li>)}</ul></div><div className="today-feeding-detail-section"><div className="inspector-section-title"><BookOpenCheck size={15} /><span>{isEnglish ? 'Knowledge sources' : '知识依据'}</span></div>{recommendation.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.id}>{source.authority} · {source.title}<ExternalLink size={12} /></a>)}<small>{recommendation.limitations?.[0]}</small></div></div>}
    </>}
  </section>
}
