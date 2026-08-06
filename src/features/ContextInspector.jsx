import { useState } from 'react'
import { AlertCircle, ArrowRight, BookOpenCheck, ExternalLink, HeartHandshake, ShieldCheck, Sparkles } from 'lucide-react'
import { evaluateMedicalTopic } from '../domain/safety.js'
import { createGrowthMeasurement, GROWTH_TYPES, localDateKey } from '../domain/carePlan.js'
import { JAUNDICE_TOPIC } from '../content/jaundice.js'
import { navigate, ROUTES } from '../app/router.js'
import { getCopy } from '../domain/i18n.js'
import { ObservationForm } from './ObservationForm.jsx'
import { CareTaskList } from './CareTaskList.jsx'
import { AdminTaskList } from './AdminTaskList.jsx'
import { CareOverview } from './CareOverview.jsx'
import { ConcernSupport } from './ConcernSupport.jsx'
import { QuickRecordPanel } from './QuickRecordPanel.jsx'

export function ContextInspector({ topicMode, stage, tasks = [], onTaskUpdate, adminTasks = [], onAdminTaskUpdate, growthMeasurements = [], onAddGrowth, observations, onSaveObservation, careEvents = [], concerns = [], onQuickRecord, onCreateConcern, onResolveConcern, questions, onQuestionsChange, sheet, locale = 'zh-CN', readOnly = false }) {
  const copy = getCopy(locale)
  const [concernOpen, setConcernOpen] = useState(false)
  const stageLabel = stage.id === 'newborn-early' ? copy.newbornEarly : stage.id === 'newborn-adaptation' ? copy.newbornAdaptation : copy.outOfScope
  const stageRange = stage.id === 'newborn-early' ? copy.newbornEarlyRange : stage.id === 'newborn-adaptation' ? copy.newbornAdaptationRange : copy.outOfScope
  if (!topicMode) {
    return (
      <aside className="context-inspector" data-testid="context-inspector" data-sheet={sheet}>
        <div className="inspector-hero stage-inspector">
          <p className="eyebrow">{locale === 'en-US' ? 'Current stage' : '当前阶段'}</p>
          <h2>{stageLabel}</h2>
          <p>{stageRange}</p>
        </div>
        <CareOverview careEvents={careEvents} concerns={concerns} locale={locale} />
        <QuickRecordPanel locale={locale} onRecord={onQuickRecord} onConcern={() => setConcernOpen(true)} readOnly={readOnly} />
        <ConcernSupport open={concernOpen} onOpenChange={setConcernOpen} locale={locale} concerns={concerns} onCreate={onCreateConcern} onResolve={onResolveConcern} readOnly={readOnly} />
        <div className="inspector-block inspector-task-block"><HeartHandshake size={18} /><CareTaskList tasks={tasks} locale={locale} onUpdate={onTaskUpdate} readOnly={readOnly} /></div>
        <AdminTaskList tasks={adminTasks} locale={locale} onUpdate={onAdminTaskUpdate} readOnly={readOnly} />
        <section className="inspector-block tone-aqua">
          <div className="inspector-section-title"><ShieldCheck size={18} /><span>{locale === 'en-US' ? 'How to use this information' : '信息使用说明'}</span></div>
          <p>{locale === 'en-US' ? 'This helps you understand and record. It does not judge normality or provide a health score.' : '这里帮助你理解和记录，不判断宝宝是否正常，也不给健康评分。'}</p>
        </section>
        <QuickGrowthEntry locale={locale} measurements={growthMeasurements} onAdd={onAddGrowth} readOnly={readOnly} />
        <button className="summary-cta" onClick={() => navigate(ROUTES.summary)}>{copy.generateSummary}<ArrowRight size={17} /></button>
      </aside>
    )
  }

  const safety = evaluateMedicalTopic(JAUNDICE_TOPIC)
  return (
    <aside className="context-inspector" data-testid="context-inspector" data-sheet={sheet}>
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
      <ObservationForm observationCount={observations.length} onSave={onSaveObservation} questions={questions} onQuestionsChange={onQuestionsChange} locale={locale} readOnly={readOnly} />
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

function QuickGrowthEntry({ locale, measurements, onAdd, readOnly = false }) {
  const isEnglish = locale === 'en-US'
  const [type, setType] = useState('weight')
  const [value, setValue] = useState('')
  const [date, setDate] = useState(localDateKey())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  async function submit(event) {
    event.preventDefault()
    if (!value.trim() || !onAdd) return
    const definition = GROWTH_TYPES.find((item) => item.id === type)
    setSaveError('')
    setSaving(true)
    try {
      await onAdd(createGrowthMeasurement({ type, value, measuredAt: date, unit: definition.unit }))
      setValue('')
    } catch (error) {
      setSaveError(error?.message || (isEnglish ? 'Save failed. Retry.' : '保存失败，请重试。'))
    } finally {
      setSaving(false)
    }
  }
  return <section className="inspector-block quick-growth-entry"><div className="inspector-section-title"><Sparkles size={16} /><span>{isEnglish ? 'Quick growth note' : '快速补录成长参数'}</span></div><p>{isEnglish ? 'Optional: save one raw measurement for the stage trend.' : '可选：补录一次原始测量，阶段页会显示趋势。'}</p><form onSubmit={submit}><fieldset disabled={readOnly || saving}><div className="quick-growth-fields"><select value={type} onChange={(event) => setType(event.target.value)} aria-label={isEnglish ? 'Growth type' : '参数类型'}>{GROWTH_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label[locale === 'en-US' ? 'en' : 'zh']}</option>)}</select><label><span className="sr-only">{isEnglish ? 'Value' : '数值'}</span><input inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} placeholder={isEnglish ? 'Value' : '数值'} aria-label={isEnglish ? 'Growth value' : '成长数值'} /></label><button className="primary-button compact" type="submit">{saving ? (isEnglish ? 'Saving…' : '保存中…') : (isEnglish ? 'Save' : '记录')}</button></div><label><span className="sr-only">{isEnglish ? 'Date' : '日期'}</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label={isEnglish ? 'Measurement date' : '日期'} /></label></fieldset></form>{measurements.length > 0 && <small>{isEnglish ? `${measurements.length} saved locally` : `已保存 ${measurements.length} 条本地测量`}</small>}{saveError && <p className="save-error" role="alert">{saveError}</p>}</section>
}
