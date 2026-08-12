import { Baby, Blocks, BookOpen, ChevronRight, CircleAlert, Clock3, HeartPulse, Leaf, ShieldCheck, Sparkles } from 'lucide-react'
import { getSexLabel } from '../domain/baby.js'
import { navigate, ROUTES } from '../app/router.js'
import { getCopy } from '../domain/i18n.js'
import { getInfantMonthlyGuidance } from '../content/cuiParenting.js'
import { TodayCareSummary } from './TodayCareSummary.jsx'

const FEEDING_LABELS = {
  breastfeeding: '母乳喂养',
  formula: '配方奶喂养',
  mixed: '混合喂养',
  other: '其他 / 待确定',
}

export function LeftRail({ baby, ageDays, careEvents = [], locale = 'zh-CN', readOnly = false }) {
  const copy = getCopy(locale)
  const guidance = getInfantMonthlyGuidance(ageDays)
  const isEnglish = locale === 'en-US'
  const guideItems = guidance ? [
    { id: 'routine', icon: Clock3, title: isEnglish ? 'Rhythm reference' : '作息表建议', detail: guidance.schedule },
    { id: 'nutrition', icon: Leaf, title: isEnglish ? 'Feeding and nutrition' : '营养与喂养', detail: guidance.nutrition },
    { id: 'care', icon: Sparkles, title: isEnglish ? 'Care focus' : '护理重点', detail: guidance.care },
    { id: 'development', icon: Blocks, title: isEnglish ? 'Early learning' : '早教安排', detail: guidance.learning },
  ] : [
    { id: 'feeding', icon: HeartPulse, title: isEnglish ? 'After a feed' : '喂养后看一眼', detail: { zh: '吞咽是否连续、呼吸是否平稳、喂后状态是否和平时相近。', en: 'Swallowing, breathing, and the state after feeding.' } },
    { id: 'notice', icon: ShieldCheck, title: isEnglish ? 'Keep a simple reference' : '先建立宝宝自己的参照', detail: { zh: '先熟悉精神、湿尿布、吃奶和睡眠的平时状态，不急着和别人比较。', en: 'Alertness, wet diapers, feeding, and sleep are more useful than comparisons.' } },
    { id: 'alert', icon: CircleAlert, title: isEnglish ? 'When to call for help' : '这些变化要及时求助', detail: { zh: '呼吸费力、嘴唇发青、叫不醒或明显吃不进去时，联系儿科或当地医疗服务。', en: 'Labored breathing, blue lips, inability to wake, or clearly reduced intake.' } },
  ]
  return (
    <aside className="left-rail">
      <section className="rail-card active-baby-card">
        <div className="section-heading"><span>{copy.currentBaby}</span><Baby size={16} /></div>
        <div className="active-baby-main">
          <span className="large-avatar">{baby.nickname.slice(0, 1)}</span>
          <div><h2>{baby.nickname}</h2><p>{locale === 'en-US' ? `Day ${ageDays}` : `出生后 ${ageDays} 天`}</p></div>
        </div>
        <div className="baby-facts"><span>{getSexLabel(baby.sex)}</span><span>{baby.gestationalWeeks} 周出生</span><span>{FEEDING_LABELS[baby.feedingMode]}</span></div>
      </section>

      <TodayCareSummary careEvents={careEvents} locale={locale} readOnly={readOnly} />

      <section className="rail-card new-parent-guide">
        <div className="section-heading"><span>{locale === 'en-US' ? 'New parent guide' : '新手父母关注'}</span><HeartPulse size={16} /></div>
        {guidance && <p className="new-parent-guide-source">{isEnglish ? `Public Cui Yutao education · Month ${guidance.month}` : `崔玉涛公开科普提炼 · 第${guidance.month}个月`}</p>}
        <div className="new-parent-guide-list">
          {guideItems.map(({ id, icon: Icon, title, detail }) => <article key={id}><span className={`guide-icon ${id}`}><Icon size={15} /></span><div><strong>{title}</strong><p>{isEnglish ? detail.en : detail.zh}</p></div></article>)}
        </div>
        {guidance && <p className="new-parent-guide-safety">{isEnglish ? 'A flexible reference, not a diagnosis or a mandatory timetable.' : '弹性参考，不作为诊断或必须执行的时间表。'}</p>}
        <button className="rail-guide-link" onClick={() => navigate(guidance ? `${ROUTES.experience}?category=cui-yutao` : ROUTES.growth)}>{guidance ? (isEnglish ? 'Open Cui Yutao parenting column' : '查看崔玉涛育儿专栏') : (isEnglish ? 'Open growth stage guide' : '查看成长阶段指南')}<ChevronRight size={15} /></button>
      </section>

      <button className="topic-entry" onClick={() => navigate(ROUTES.pediatric)}>
        <span><BookOpen size={18} /><span><strong>{copy.topicEntry}</strong><small>{copy.topicEntryHint}</small></span></span>
        <ChevronRight size={18} />
      </button>
    </aside>
  )
}
