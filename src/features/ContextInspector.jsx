import { AlertCircle, ArrowRight, BookOpenCheck, ExternalLink, ShieldCheck } from 'lucide-react'
import { evaluateMedicalTopic } from '../domain/safety.js'
import { JAUNDICE_TOPIC } from '../content/jaundice.js'
import { navigate, ROUTES } from '../app/router.js'
import { getCopy } from '../domain/i18n.js'
import { DailyHealthReminders } from './DailyHealthReminders.jsx'

export function ContextInspector({ topicMode, healthReminders, onTaskUpdate, locale = 'zh-CN', readOnly = false }) {
  const copy = getCopy(locale)
  if (!topicMode) {
    return (
      <aside className="context-inspector today-context-inspector" data-testid="context-inspector">
        <DailyHealthReminders reminders={healthReminders} locale={locale} onUpdate={onTaskUpdate} readOnly={readOnly} />
      </aside>
    )
  }

  const safety = evaluateMedicalTopic(JAUNDICE_TOPIC)
  return (
    <aside className="context-inspector" data-testid="context-inspector">
      <div className="inspector-hero topic-inspector">
        <p className="eyebrow">{locale === 'en-US' ? 'Condition learning topic' : '疾病认知专题'}</p>
        <h2>{locale === 'en-US' ? JAUNDICE_TOPIC.titleEn : JAUNDICE_TOPIC.title}</h2>
        <p>{locale === 'en-US' ? JAUNDICE_TOPIC.summaryEn : JAUNDICE_TOPIC.summary}</p>
        <span className="prototype-status"><AlertCircle size={14} />{locale === 'en-US' ? 'Care information' : '照护信息'}</span>
      </div>
      <section className="inspector-block mechanism-list">
        <div className="inspector-section-title"><BookOpenCheck size={18} /><span>{locale === 'en-US' ? 'Five-step explanation' : '五步解释'}</span></div>
        {JAUNDICE_TOPIC.steps.map((step, index) => <div className="mechanism-item" key={step.id}><span>{index + 1}</span><div><strong>{locale === 'en-US' ? step.titleEn : step.title}</strong><small>{locale === 'en-US' ? step.descriptionEn : step.description}</small></div></div>)}
      </section>
      {safety.status === 'unavailable' && <section className="safety-gate"><ShieldCheck size={19} /><div><strong>{locale === 'en-US' ? 'For care conversations' : '用于照护沟通'}</strong><p>{locale === 'en-US' ? 'The workspace records observations but does not provide a diagnosis, severity label, or care level. If you are worried, contact a pediatric clinician or local medical service.' : '工作台只整理观察，不提供诊断、严重度标签或就医等级。如果你担心宝宝，请联系儿科专业人员或当地医疗服务。'}</p></div></section>}
      <RecordsLink locale={locale} topic="illness" />
      <button className="summary-cta" onClick={() => navigate(ROUTES.summary)}>{copy.generateSummary}<ArrowRight size={17} /></button>
      <section className="source-panel">
        <div className="inspector-section-title"><BookOpenCheck size={17} /><span>{locale === 'en-US' ? 'Sources' : '内容依据'}</span></div>
        <p>{locale === 'en-US' ? 'Version' : '版本'}：{JAUNDICE_TOPIC.contentVersion}</p>
        {JAUNDICE_TOPIC.sources.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.label}<ExternalLink size={13} /></a>)}
        <small>{locale === 'en-US' ? 'Source updated 2026-08-05 · Use this information to organize care notes.' : '来源更新：2026-08-05 · 用于整理照护记录和咨询问题。'}</small>
      </section>
    </aside>
  )
}

function RecordsLink({ locale, topic }) {
  const isEnglish = locale === 'en-US'
  return <button className="record-center-cta" type="button" onClick={() => navigate(topic === 'illness' ? `${ROUTES.records}?panel=illness` : ROUTES.records)}><span><strong>{isEnglish ? 'Record in the center' : '去记录中心录入'}</strong><small>{topic === 'illness' ? (isEnglish ? 'Choose symptoms, timing, and measured facts.' : '选择表现、时间和测量事实。') : (isEnglish ? 'All facts stay in one place.' : '所有事实都从同一个入口保存。')}</small></span><ArrowRight size={16} /></button>
}
