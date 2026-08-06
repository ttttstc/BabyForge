import { Baby, BookOpen, CheckCircle2, ChevronRight, Clock3 } from 'lucide-react'
import { getSexLabel } from '../domain/baby.js'
import { navigate, ROUTES } from '../app/router.js'
import { getCopy } from '../domain/i18n.js'
import { CareTaskList } from './CareTaskList.jsx'

const FEEDING_LABELS = {
  breastfeeding: '母乳喂养',
  formula: '配方奶喂养',
  mixed: '混合喂养',
  other: '其他 / 待确定',
}

export function LeftRail({ baby, ageDays, stage, locale = 'zh-CN', tasks = [], onTaskUpdate, readOnly = false }) {
  const copy = getCopy(locale)
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

      <section className="rail-card">
        <div className="section-heading"><span>{copy.growthStage}</span><Clock3 size={16} /></div>
        <button className={`timeline-item ${stage.id === 'newborn-early' ? 'active' : ''}`} onClick={() => navigate(ROUTES.stage)}>
          <span className="timeline-dot">{ageDays > 7 ? <CheckCircle2 size={14} /> : '●'}</span>
          <span><strong>{copy.newbornEarly}</strong><small>{copy.newbornEarlyRange}</small></span>
          {stage.id === 'newborn-early' && <em>{copy.current}</em>}
        </button>
        <button className={`timeline-item ${stage.id === 'newborn-adaptation' ? 'active' : ''}`} onClick={() => navigate(ROUTES.stage)}>
          <span className="timeline-dot">●</span>
          <span><strong>{copy.newbornAdaptation}</strong><small>{copy.newbornAdaptationRange}</small></span>
          {stage.id === 'newborn-adaptation' && <em>{copy.current}</em>}
        </button>
        {stage.id === 'out-of-scope' && <p className="scope-warning">{copy.outOfScope}</p>}
      </section>

      <CareTaskList tasks={tasks} locale={locale} onUpdate={onTaskUpdate} readOnly={readOnly} compact />

      <button className="topic-entry" onClick={() => navigate(ROUTES.pediatric)}>
        <span><BookOpen size={18} /><span><strong>{copy.topicEntry}</strong><small>{copy.topicEntryHint}</small></span></span>
        <ChevronRight size={18} />
      </button>
    </aside>
  )
}
