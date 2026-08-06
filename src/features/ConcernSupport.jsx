import { useState } from 'react'
import { AlertTriangle, Check, ChevronRight, CircleAlert, X } from 'lucide-react'
import { evaluateSupport, HIGH_PRIORITY_FACTS, SUPPORT_TOPICS, topicById } from '../domain/healthSupport.js'

function text(value, locale) {
  return value?.[locale === 'en-US' ? 'en' : 'zh'] || value?.zh || value || ''
}

export function ConcernSupport({ locale = 'zh-CN', concerns = [], onCreate, onClose, onResolve, open: controlledOpen, onOpenChange, readOnly = false }) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen === undefined ? internalOpen : controlledOpen
  const [topicId, setTopicId] = useState(null)
  const [facts, setFacts] = useState([])
  const [notes, setNotes] = useState('')
  const [lastPlan, setLastPlan] = useState(null)
  const [saveError, setSaveError] = useState('')
  const isEnglish = locale === 'en-US'
  const topic = topicById(topicId)

  function setOpen(next) {
    if (controlledOpen === undefined) setInternalOpen(next)
    onOpenChange?.(next)
  }

  function toggleFact(id) {
    setFacts((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }

  async function submit(event) {
    event.preventDefault()
    if (!topicId) return
    const plan = evaluateSupport({ topicId, facts })
    setSaveError('')
    try {
      const concern = await onCreate?.({ topicId, facts, notes, plan })
      setLastPlan({ ...plan, concernId: concern?.id })
      setNotes('')
    } catch (error) {
      setSaveError(error?.message || (isEnglish ? 'Save failed. Your input is still here; retry.' : '保存失败，当前输入已保留，请重试。'))
    }
  }

  function close() {
    setOpen(false)
    setTopicId(null)
    setFacts([])
    setNotes('')
    setSaveError('')
    onClose?.()
  }

  return <section className="concern-support inspector-block" data-testid="concern-support">
    {!open && <button type="button" className="concern-open-button" disabled={readOnly} onClick={() => setOpen(true)}><CircleAlert size={18} /><span><strong>{isEnglish ? 'Found a change?' : '发现宝宝有变化？'}</strong><small>{isEnglish ? 'Start with facts, not a diagnosis.' : '从事实开始，不自行判断病因。'}</small></span><ChevronRight size={17} /></button>}
    {open && <div className="concern-flow"><header className="concern-flow-heading"><div><p className="eyebrow">{isEnglish ? 'Guided observation' : '受控观察'}</p><h2>{isEnglish ? 'What changed?' : '发生了什么变化？'}</h2></div><button type="button" onClick={close} aria-label={isEnglish ? 'Close' : '关闭'}><X size={17} /></button></header>{!topicId ? <div className="concern-topic-grid">{SUPPORT_TOPICS.map((item) => <button type="button" key={item.id} onClick={() => setTopicId(item.id)}><strong>{text(item.title, locale)}</strong><small>{text(item.detail, locale)}</small></button>)}</div> : <form className="concern-form" onSubmit={submit}><button type="button" className="concern-back" onClick={() => setTopicId(null)}>← {isEnglish ? 'Choose another' : '换一个关注点'}</button><h3>{text(topic.title, locale)}</h3><p>{text(topic.detail, locale)}</p><fieldset><legend>{isEnglish ? 'Check only what you observed' : '只勾选你确实看到的事实'}</legend><small className="concern-observation-note">{isEnglish ? 'These observations help organize what to share with a clinician; they do not diagnose or grade severity.' : '这些观察项用于整理联系专业人员时要提供的事实，不代表诊断或严重程度。'}</small>{HIGH_PRIORITY_FACTS.map((fact) => <label key={fact.id}><input type="checkbox" checked={facts.includes(fact.id)} onChange={() => toggleFact(fact.id)} />{text(fact.title, locale)}</label>)}</fieldset><label>{isEnglish ? 'Optional notes' : '补充事实（可选）'}<textarea rows="3" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={isEnglish ? 'When it started and what you saw' : '什么时候开始、看到了什么'} /></label><button type="submit" className="primary-button compact"><Check size={15} />{isEnglish ? 'Save and show next steps' : '保存并查看下一步'}</button></form>}
      {saveError && <p className="save-error" role="alert">{saveError}</p>}
      {lastPlan && <SupportPlan locale={locale} plan={lastPlan} onClose={() => setLastPlan(null)} />}</div>}
    {concerns.length > 0 && <div className="active-concern-list"><header><strong><AlertTriangle size={15} />{isEnglish ? 'Active follow-up' : '正在跟进'}</strong></header>{concerns.filter((item) => item.status === 'open').slice(0, 3).map((concern) => <article key={concern.id}><div><strong>{text(concern.title, locale)}</strong><small>{new Date(concern.createdAt).toLocaleString(isEnglish ? 'en-US' : 'zh-CN')}</small></div><button type="button" disabled={readOnly} onClick={() => onResolve?.(concern.id)}>{isEnglish ? 'Close' : '完成跟进'}</button></article>)}</div>}
  </section>
}

function SupportPlan({ locale, plan, onClose }) {
  const isEnglish = locale === 'en-US'
  return <div className={`support-plan ${plan.caregiverGuidance}`}><header><strong>{isEnglish ? 'Next steps' : '下一步'}</strong><button type="button" onClick={onClose} aria-label={isEnglish ? 'Close next steps' : '关闭下一步'}><X size={15} /></button></header><p><b>{isEnglish ? 'Now' : '现在'}：</b>{text(plan.action, locale)}</p><p><b>{isEnglish ? 'Recheck' : '复查'}：</b>{text(plan.recheck, locale)}</p><p><b>{isEnglish ? 'Escalate' : '需要升级'}：</b>{text(plan.escalation, locale)}</p>{plan.source?.url ? <small><a href={plan.source.url} target="_blank" rel="noreferrer">{text(plan.source.label, locale)} · {plan.source.accessedAt}</a></small> : plan.source && <small>{text(plan.source, locale)}</small>}</div>
}
