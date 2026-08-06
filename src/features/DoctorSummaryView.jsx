import { useMemo, useState } from 'react'
import { ArrowLeft, Baby, Check, Clipboard, FileHeart, LogOut, Printer, RotateCcw, ShieldCheck } from 'lucide-react'
import { buildDoctorSummary } from '../domain/doctorSummary.js'
import { getSexLabel } from '../domain/baby.js'
import { getCopy } from '../domain/i18n.js'
import { eventFacts, eventTitle, formatEventTime } from '../domain/careSummary.js'

const FEEDING_LABELS = {
  usual: { zh: '和平时相近', en: 'About the same' },
  'less-than-usual': { zh: '比平时少', en: 'Less than usual' },
  unknown: { zh: '不确定', en: 'Not sure' },
}
const ALERTNESS_LABELS = { usual: { zh: '和平时相近', en: 'About the same' }, different: { zh: '和平时不同', en: 'Different from usual' }, unknown: { zh: '不确定', en: 'Not sure' } }
const AREA_LABELS = { face: { zh: '面部', en: 'Face' }, eyes: { zh: '眼白', en: 'Sclera' }, chest: { zh: '胸腹', en: 'Chest / abdomen' }, limbs: { zh: '四肢', en: 'Limbs' } }
const SYMPTOM_LABELS = { fever: { zh: '发热', en: 'Fever' }, cough: { zh: '咳嗽', en: 'Cough' }, vomiting: { zh: '呕吐', en: 'Vomiting' }, diarrhea: { zh: '腹泻', en: 'Diarrhea' }, rash: { zh: '皮疹', en: 'Rash' }, breathing: { zh: '呼吸变化', en: 'Breathing change' } }
const TASK_LABELS = { feeding: { zh: '观察一次完整喂养', en: 'Watch one complete feed' }, elimination: { zh: '记下今天一次尿便', en: 'Note one urine / stool event' }, 'safe-sleep': { zh: '做一次睡眠环境检查', en: 'Run one safe-sleep check' } }
const GROWTH_LABELS = { weight: { zh: '体重', en: 'Weight' }, length: { zh: '身长', en: 'Length' }, headCircumference: { zh: '头围', en: 'Head circumference' } }

function label(value, locale, fallback = value) {
  return value?.[locale === 'en-US' ? 'en' : 'zh'] || fallback
}

function recorderFor(summary, collection, record) {
  return summary.careEvents.find((event) => event.payload?.legacyCollection === collection && event.payload?.legacyId === record.id)?.recordedBy?.displayName || ''
}

function formatSummaryText(summary, locale) {
  const isEnglish = locale === 'en-US'
  const lines = [
    'BabyForge care summary',
    `${isEnglish ? 'Baby' : '宝宝'}: ${summary.baby.nickname}`,
    `${isEnglish ? 'Sex' : '性别'}: ${isEnglish ? (summary.baby.sex === 'male' ? 'Boy' : summary.baby.sex === 'female' ? 'Girl' : 'Not set') : getSexLabel(summary.baby.sex)}`,
    `${isEnglish ? 'Birth date' : '出生日期'}: ${summary.baby.birthDate}`,
    '',
  ]
  summary.timeline.forEach((item, index) => {
    lines.push(`${isEnglish ? 'Observation' : '观察'} ${index + 1}: ${item.firstNoticedAt || item.createdAt}`)
    const recorder = recorderFor(summary, 'observations', item)
    if (recorder) lines.push(`${isEnglish ? 'Entered by' : '记录人'}: ${recorder}`)
    if (item.bodyAreas?.length) lines.push(`${isEnglish ? 'Areas' : '部位'}: ${item.bodyAreas.map((area) => label(AREA_LABELS[area], locale, area)).join(isEnglish ? ', ' : '、')}`)
    if (item.symptoms?.length) lines.push(`${isEnglish ? 'Symptoms' : '表现'}: ${item.symptoms.map((symptom) => label(SYMPTOM_LABELS[symptom], locale, symptom)).join(isEnglish ? ', ' : '、')}`)
    if (item.feedingChange) lines.push(`${isEnglish ? 'Feeding' : '吃奶'}: ${label(FEEDING_LABELS[item.feedingChange], locale, item.feedingChange)}`)
    if (item.alertness) lines.push(`${isEnglish ? 'Alertness' : '精神状态'}: ${label(ALERTNESS_LABELS[item.alertness], locale, item.alertness)}`)
    if (item.symptomNotes) lines.push(`${isEnglish ? 'Notes' : '备注'}: ${item.symptomNotes}`)
    if (item.temperatureValue) lines.push(`${isEnglish ? 'Temperature' : '体温'}: ${item.temperatureValue} ${item.temperatureUnit || ''}`)
    if (item.bilirubinValue) lines.push(`${isEnglish ? 'Measurement' : '测量'}: ${item.bilirubinValue} ${item.bilirubinUnit || ''}`)
    lines.push('')
  })
  if (summary.taskLogs.length) {
    lines.push(isEnglish ? 'Care actions:' : '照护事项：')
    summary.taskLogs.filter((item) => item.status === 'done').forEach((item) => lines.push(`- ${label(TASK_LABELS[item.taskId], locale, item.taskId)} · ${item.date}${recorderFor(summary, 'taskLogs', item) ? ` · ${isEnglish ? 'entered by' : '记录人'} ${recorderFor(summary, 'taskLogs', item)}` : ''}`))
    lines.push('')
  }
  if (summary.growthMeasurements.length) {
    lines.push(isEnglish ? 'Growth measurements:' : '成长测量：')
    summary.growthMeasurements.forEach((item) => lines.push(`- ${label(GROWTH_LABELS[item.type], locale, item.type)}: ${item.value} ${item.unit} · ${item.measuredAt}${recorderFor(summary, 'growthMeasurements', item) ? ` · ${isEnglish ? 'entered by' : '记录人'} ${recorderFor(summary, 'growthMeasurements', item)}` : ''}`))
    lines.push('')
  }
  if (summary.recentCareEvents.length) {
    lines.push(isEnglish ? 'Recent care timeline:' : '最近照护时间线：')
    summary.recentCareEvents.forEach((event) => lines.push(`- ${eventTitle(event, locale)} · ${event.occurredAt || event.createdAt} · ${event.recordedBy?.displayName || (isEnglish ? 'caregiver' : '照护者')}`))
    lines.push('')
  }
  if (summary.concerns.filter((item) => item.status === 'open').length) {
    lines.push(isEnglish ? 'Active follow-up:' : '进行中的关注：')
    summary.concerns.filter((item) => item.status === 'open').forEach((item) => {
      lines.push(`- ${item.title?.[isEnglish ? 'en' : 'zh'] || item.title}`)
      if (item.plan?.action) lines.push(`  ${isEnglish ? 'Now' : '现在'}: ${label(item.plan.action, locale)}`)
      if (item.plan?.recheck) lines.push(`  ${isEnglish ? 'Recheck' : '复查'}: ${label(item.plan.recheck, locale)}`)
      if (item.plan?.source) lines.push(`  ${isEnglish ? 'Source' : '依据'}: ${label(item.plan.source.label, locale, item.plan.source.label || item.plan.source)} ${item.plan.source.url || ''}`)
    })
    lines.push('')
  }
  if (summary.questions.length) lines.push(isEnglish ? 'Questions for a clinician:' : '希望咨询：', ...summary.questions.map((question) => `- ${question}`), '')
  lines.push(isEnglish ? 'This summary organizes caregiver-entered facts and does not diagnose or triage.' : summary.disclaimer)
  return lines.join('\n')
}

export function DoctorSummaryView({ state, onBack, onClear, onLogout, readOnly = false }) {
  const locale = state.preferences.locale
  const copy = getCopy(locale)
  const isEnglish = locale === 'en-US'
  const summary = useMemo(() => buildDoctorSummary(state.baby, state.observations, state.questions, undefined, { taskLogs: state.taskLogs, growthMeasurements: state.growthMeasurements, milestoneRecords: state.milestoneRecords, careEvents: state.careEvents, concerns: state.concerns }), [state.baby, state.observations, state.questions, state.taskLogs, state.growthMeasurements, state.milestoneRecords, state.careEvents, state.concerns])
  const [copied, setCopied] = useState(false)

  async function copySummary() {
    await navigator.clipboard.writeText(formatSummaryText(summary, locale))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <main className="summary-page">
      <header className="summary-header no-print">
        <button onClick={onBack}><ArrowLeft size={17} />{isEnglish ? 'Back to today' : '返回今天'}</button>
        <div className="brand-mark small"><Baby size={20} /><span>{copy.appName}</span></div>
        {!readOnly && <button onClick={onClear}><RotateCcw size={16} />{copy.clearLocalData}</button>}
        <button onClick={onLogout}><LogOut size={16} />{isEnglish ? 'Sign out' : '退出登录'}</button>
      </header>
      <article className="summary-sheet">
        <div className="summary-title-row"><div><p className="eyebrow">{isEnglish ? 'Parent-entered facts' : '家长记录整理'}</p><h1>{isEnglish ? 'Care summary' : '就医沟通摘要'}</h1><p>{isEnglish ? 'Generated' : '生成于'} {new Date(summary.generatedAt).toLocaleString(isEnglish ? 'en-US' : 'zh-CN')}</p></div><span className="summary-icon"><FileHeart size={30} /></span></div>
        <section className="summary-baby"><span className="large-avatar">{summary.baby.nickname.slice(0, 1)}</span><div><h2>{summary.baby.nickname}</h2><p>{isEnglish ? (summary.baby.sex === 'male' ? 'Boy' : summary.baby.sex === 'female' ? 'Girl' : 'Sex not set') : getSexLabel(summary.baby.sex)} · {isEnglish ? 'Birth date' : '出生日期'}: {summary.baby.birthDate} · {summary.baby.gestationalWeeks} {isEnglish ? 'weeks' : '周出生'}</p></div><span className="provenance">{isEnglish ? 'Parent entered' : '家长填写'}</span></section>
        <section className="summary-section"><h2>{isEnglish ? 'Observation timeline' : '观察时间线'}</h2>{summary.timeline.length === 0 ? <p className="empty-summary">{isEnglish ? 'No observations saved yet.' : '尚未保存观察记录。'}</p> : summary.timeline.map((item, index) => <article className="timeline-record" key={item.id}><span className="record-number">{index + 1}</span><div><h3>{item.firstNoticedAt ? new Date(item.firstNoticedAt).toLocaleString(isEnglish ? 'en-US' : 'zh-CN') : (isEnglish ? 'First noticed time not provided' : '未填写首次发现时间')}</h3><dl>
          {item.bodyAreas?.length > 0 && <><dt>{isEnglish ? 'Areas' : '观察部位'}</dt><dd>{item.bodyAreas.map((area) => label(AREA_LABELS[area], locale, area)).join(isEnglish ? ', ' : '、')}</dd></>}
          {item.symptoms?.length > 0 && <><dt>{isEnglish ? 'Symptoms' : '观察表现'}</dt><dd>{item.symptoms.map((symptom) => label(SYMPTOM_LABELS[symptom], locale, symptom)).join(isEnglish ? ', ' : '、')}</dd></>}
          {item.feedingChange && <><dt>{isEnglish ? 'Feeding' : '吃奶变化'}</dt><dd>{label(FEEDING_LABELS[item.feedingChange], locale, item.feedingChange)}</dd></>}
          {item.alertness && <><dt>{isEnglish ? 'Alertness' : '精神状态'}</dt><dd>{label(ALERTNESS_LABELS[item.alertness], locale, item.alertness)}</dd></>}
          {item.eliminationNotes && <><dt>{isEnglish ? 'Urine / stool notes' : '尿便备注'}</dt><dd>{item.eliminationNotes}</dd></>}
          {item.symptomNotes && <><dt>{isEnglish ? 'Notes' : '表现备注'}</dt><dd>{item.symptomNotes}</dd></>}
          {item.temperatureValue && <><dt>{isEnglish ? 'Temperature' : '体温测量'}</dt><dd>{item.temperatureValue} {item.temperatureUnit}</dd></>}
          {item.bilirubinValue && <><dt>{isEnglish ? 'Bilirubin' : '胆红素测量'}</dt><dd>{item.bilirubinValue} {item.bilirubinUnit}<small>{item.measuredAt || (isEnglish ? 'Time not provided' : '时间未填')} · {item.measurementSource || (isEnglish ? 'Source not provided' : '来源未填')}</small></dd></>}
        </dl><span className="provenance">{isEnglish ? 'Parent entered / raw fact' : '原始记录'}{recorderFor(summary, 'observations', item) ? ` · ${isEnglish ? 'Entered by' : '记录人'} ${recorderFor(summary, 'observations', item)}` : ''}</span></div></article>)}</section>
        {summary.taskLogs.length > 0 && <section className="summary-section"><h2>{isEnglish ? 'Care actions completed' : '已完成照护事项'}</h2><ul>{summary.taskLogs.filter((item) => item.status === 'done').map((item) => <li key={item.id}>{label(TASK_LABELS[item.taskId], locale, item.taskId)} · {item.date}{recorderFor(summary, 'taskLogs', item) ? ` · ${isEnglish ? 'Entered by' : '记录人'} ${recorderFor(summary, 'taskLogs', item)}` : ''}</li>)}</ul></section>}
        {summary.growthMeasurements.length > 0 && <section className="summary-section"><h2>{isEnglish ? 'Growth measurements' : '成长测量'}</h2><ul>{summary.growthMeasurements.map((item) => <li key={item.id}>{label(GROWTH_LABELS[item.type], locale, item.type)}: {item.value} {item.unit} · {item.measuredAt}{recorderFor(summary, 'growthMeasurements', item) ? ` · ${isEnglish ? 'Entered by' : '记录人'} ${recorderFor(summary, 'growthMeasurements', item)}` : ''}</li>)}</ul></section>}
        {summary.recentCareEvents.length > 0 && <section className="summary-section"><h2>{isEnglish ? 'Recent care timeline' : '最近照护时间线'}</h2><div className="summary-event-list">{summary.recentCareEvents.map((event) => <article key={event.id}><strong>{eventTitle(event, locale)}</strong><span>{formatEventTime(event, locale)} · {eventFacts(event, locale)}</span></article>)}</div></section>}
        {summary.concerns.filter((item) => item.status === 'open').length > 0 && <section className="summary-section"><h2>{isEnglish ? 'Active follow-up' : '进行中的关注'}</h2><div className="summary-concern-list">{summary.concerns.filter((item) => item.status === 'open').map((item) => <article key={item.id}><strong>{label(item.title, locale, item.title)}</strong>{item.plan?.action && <p>{isEnglish ? 'Now' : '现在'}：{label(item.plan.action, locale)}</p>}{item.plan?.recheck && <p>{isEnglish ? 'Recheck' : '复查'}：{label(item.plan.recheck, locale)}</p>}{item.plan?.source?.url && <small><a href={item.plan.source.url} target="_blank" rel="noreferrer">{isEnglish ? 'Source' : '依据'}：{label(item.plan.source.label, locale)} · {item.plan.source.accessedAt}</a></small>}</article>)}</div></section>}
        {summary.questions.length > 0 && <section className="summary-section"><h2>{isEnglish ? 'Questions for a clinician' : '希望咨询的问题'}</h2><ul>{summary.questions.map((question) => <li key={question}>{question}</li>)}</ul></section>}
        <section className="summary-disclaimer"><ShieldCheck size={22} /><div><strong>{isEnglish ? 'Information boundary' : '信息边界'}</strong><p>{isEnglish ? copy.noDiagnosis : summary.disclaimer}</p></div></section>
        <div className="summary-actions no-print"><button className="primary-button compact" onClick={copySummary}>{copied ? <Check size={17} /> : <Clipboard size={17} />}{copied ? (isEnglish ? 'Copied' : '已复制') : (isEnglish ? 'Copy summary' : '复制摘要')}</button><button className="secondary-button" onClick={() => window.print()}><Printer size={17} />{isEnglish ? 'Print / save PDF' : '打印 / 保存 PDF'}</button></div>
      </article>
    </main>
  )
}
