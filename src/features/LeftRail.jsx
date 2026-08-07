import { useState } from 'react'
import { Baby, BookOpen, CheckCircle2, ChevronRight, CircleAlert, Clock3, HeartPulse, ShieldCheck } from 'lucide-react'
import { getSexLabel, getStageLabel, getStageRangeLabel, getStages } from '../domain/baby.js'
import { navigate, ROUTES } from '../app/router.js'
import { getCopy } from '../domain/i18n.js'

const FEEDING_LABELS = {
  breastfeeding: '母乳喂养',
  formula: '配方奶喂养',
  mixed: '混合喂养',
  other: '其他 / 待确定',
}

export function LeftRail({ baby, ageDays, stage, locale = 'zh-CN' }) {
  const copy = getCopy(locale)
  const stages = getStages()
  const [showCompleted, setShowCompleted] = useState(false)
  const activeIndex = stages.findIndex((item) => item.id === stage.id)
  const completedStages = stages.filter((item) => ageDays > item.max)
  const hiddenCompletedCount = completedStages.length > 3 ? completedStages.length - 1 : 0
  const contextCompletedIndex = activeIndex > 0 ? activeIndex - 1 : stage.id === 'out-of-scope' ? stages.length - 1 : -1
  const visibleStages = showCompleted || hiddenCompletedCount === 0
    ? stages
    : stages.filter((item, index) => ageDays <= item.max || index === contextCompletedIndex)
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

      <section className="rail-card stage-timeline-card">
        <div className="section-heading"><span>{copy.growthStage}</span><Clock3 size={16} /></div>
        <div className="stage-timeline-list">
          {visibleStages.map((item) => {
            const active = stage.id === item.id
            const completed = ageDays > item.max
            return <button className={`timeline-item ${active ? 'active' : ''}`} key={item.id} onClick={() => navigate(ROUTES.growth)} aria-current={active ? 'step' : undefined}>
              <span className="timeline-dot">{completed ? <CheckCircle2 size={14} /> : active ? '●' : '○'}</span>
              <span><strong>{getStageLabel(item, locale)}</strong><small>{getStageRangeLabel(item, locale)}</small></span>
              {active && <em>{copy.current}</em>}
            </button>
          })}
        </div>
        {hiddenCompletedCount > 0 && <button className="stage-timeline-toggle" type="button" aria-expanded={showCompleted} onClick={() => setShowCompleted((current) => !current)}>
          {showCompleted
            ? (locale === 'en-US' ? 'Hide completed stages' : '收起已完成阶段')
            : (locale === 'en-US' ? `Show ${hiddenCompletedCount} completed stages` : `显示 ${hiddenCompletedCount} 个已完成阶段`)}
          <ChevronRight size={14} className={showCompleted ? 'rotated' : ''} />
        </button>}
        {stage.id === 'out-of-scope' && <p className="scope-warning">{getStageRangeLabel(stage, locale)}</p>}
      </section>

      <section className="rail-card new-parent-guide">
        <div className="section-heading"><span>{locale === 'en-US' ? 'New parent guide' : '新手父母关注'}</span><HeartPulse size={16} /></div>
        <div className="new-parent-guide-list">
          <article><span className="guide-icon feeding"><HeartPulse size={15} /></span><div><strong>{locale === 'en-US' ? 'After a feed' : '喂养后看一眼'}</strong><p>{locale === 'en-US' ? 'Swallowing, breathing, and the state after feeding.' : '吞咽是否连续、呼吸是否平稳、喂后状态是否和平时相近。'}</p></div></article>
          <article><span className="guide-icon notice"><ShieldCheck size={15} /></span><div><strong>{locale === 'en-US' ? 'Keep a simple reference' : '先建立宝宝自己的参照'}</strong><p>{locale === 'en-US' ? 'Alertness, wet diapers, feeding, and sleep are more useful than comparisons.' : '先熟悉精神、湿尿布、吃奶和睡眠的平时状态，不急着和别人比较。'}</p></div></article>
          <article><span className="guide-icon alert"><CircleAlert size={15} /></span><div><strong>{locale === 'en-US' ? 'When to call for help' : '这些变化要及时求助'}</strong><p>{locale === 'en-US' ? 'Labored breathing, blue lips, inability to wake, or clearly reduced intake.' : '呼吸费力、嘴唇发青、叫不醒或明显吃不进去时，联系儿科或当地医疗服务。'}</p></div></article>
        </div>
        <button className="rail-guide-link" onClick={() => navigate(ROUTES.growth)}>{locale === 'en-US' ? 'Open growth stage guide' : '查看成长阶段指南'}<ChevronRight size={15} /></button>
      </section>

      <button className="topic-entry" onClick={() => navigate(ROUTES.pediatric)}>
        <span><BookOpen size={18} /><span><strong>{copy.topicEntry}</strong><small>{copy.topicEntryHint}</small></span></span>
        <ChevronRight size={18} />
      </button>
    </aside>
  )
}
