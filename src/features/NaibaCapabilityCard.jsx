import { ClipboardList, FileSearch, ListChecks, Repeat2, TrendingUp } from 'lucide-react'

function Section({ title, children }) {
  if (!children || (Array.isArray(children) && !children.length)) return null
  return <section className="naiba-artifact-section"><strong>{title}</strong>{children}</section>
}

function List({ items = [] }) {
  return items.length ? <ul>{items.map((item, index) => <li key={`${index}-${typeof item === 'string' ? item : item.id || item.action || item.text || item.fact}`}>{typeof item === 'string' ? item : item.text || item.fact || item.action || item.label}</li>)}</ul> : null
}

export function NaibaCapabilityCard({ artifact, locale = 'zh-CN' }) {
  const isEnglish = locale === 'en-US'
  const data = artifact?.data
  if (!data) return null
  if (artifact.skillId === 'daily_care_analysis') {
    return <article className="naiba-artifact-card"><header><TrendingUp size={16} /><strong>{data.title}</strong><span>{data.status}</span></header><p>{data.summary}</p><List items={data.actions} /></article>
  }
  if (artifact.skillId === 'detailed_care_analysis') {
    return <article className="naiba-artifact-card"><header><TrendingUp size={16} /><strong>{isEnglish ? 'Detailed care analysis' : '详细照护分析'}</strong><span>{data.status}</span></header><Section title={isEnglish ? 'Current situation' : '当前情况'}><p>{data.currentSituation}</p></Section><Section title={isEnglish ? 'Trend' : '变化趋势'}><p>{data.trend}</p></Section><Section title={isEnglish ? 'Possible reasons' : '可能原因'}><List items={data.possibleReasons} /></Section><Section title={isEnglish ? 'Next actions' : '接下来可以做什么'}><List items={data.actions} /></Section>{data.escalation && <Section title={isEnglish ? 'When to seek help' : '何时进一步关注'}><p>{data.escalation}</p></Section>}</article>
  }
  if (artifact.skillId === 'daily_growth_plan_builder') {
    return <article className="naiba-artifact-card"><header><ListChecks size={16} /><strong>{isEnglish ? 'Today’s growth plan' : '今日成长计划'}</strong><span>{data.date}</span></header><div className="naiba-plan-list">{data.plans.map((plan, index) => <section key={plan.id}><span>{index + 1}</span><div><strong>{plan.action}</strong><p>{plan.reason}</p><small>{isEnglish ? 'Done when' : '完成条件'}：{plan.completion}</small></div></section>)}</div></article>
  }
  if (artifact.skillId === 'medical_report_interpreter') {
    return <article className="naiba-artifact-card"><header><FileSearch size={16} /><strong>{isEnglish ? 'Report field draft' : '报告字段草稿'}</strong><span>{data.fields.length}</span></header><div className="naiba-report-fields">{data.fields.map((field, index) => <section key={`${field.name}-${index}`}><strong>{field.name}</strong><span>{field.value} {field.unit || ''}</span><small>{field.referenceRange ? `${isEnglish ? 'Reference' : '参考'}：${field.referenceRange}` : (isEnglish ? 'Reference not recognized' : '未识别参考范围')} · {field.confidence}</small></section>)}</div><Section title={isEnglish ? 'Uncertainty' : '不确定项'}><List items={data.uncertainties} /></Section><Section title={isEnglish ? 'Questions for clinician' : '可以询问医生'}><List items={data.questionsForClinician} /></Section><p className="naiba-draft-boundary">{isEnglish ? 'The original file is not retained. Extracted fields still require confirmation.' : '原始文件不保留；识别字段仍需确认后才能进入事实账本。'}</p></article>
  }
  if (artifact.skillId === 'visit_brief_generator') {
    return <article className="naiba-artifact-card"><header><ClipboardList size={16} /><strong>{isEnglish ? 'Visit brief' : '就医摘要'}</strong><span>{data.facts.length}</span></header><Section title={isEnglish ? 'Confirmed facts' : '已确认事实'}><List items={data.facts} /></Section><Section title={isEnglish ? 'Active concerns' : '当前关注'}><List items={data.activeConcerns} /></Section><Section title={isEnglish ? 'Questions' : '咨询问题'}><List items={data.questions} /></Section><p className="naiba-draft-boundary">{data.disclaimer}</p></article>
  }
  if (artifact.skillId === 'caregiver_handoff_builder') {
    return <article className="naiba-artifact-card"><header><Repeat2 size={16} /><strong>{isEnglish ? 'Caregiver handoff' : '照护交接'}</strong><span>{data.facts.length}</span></header><Section title={isEnglish ? 'Facts' : '最近事实'}><List items={data.facts} /></Section><Section title={isEnglish ? 'Arrangements' : '已有安排'}><List items={data.arrangements} /></Section><Section title={isEnglish ? 'System notes' : '系统说明'}><List items={data.systemNotes} /></Section><p className="naiba-draft-boundary">{data.disclaimer}</p></article>
  }
  return null
}
