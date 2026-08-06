import { useMemo, useState } from 'react'
import { Activity, ArrowLeft, Baby, Check, ChevronRight, CircleHelp, ClipboardList, Clock3, FileText, HeartPulse, Pill, Plus, Save, ShieldCheck, Thermometer, Utensils, X } from 'lucide-react'
import { getAgeDays, getStage, getStageLabel, getStageRangeLabel } from '../domain/baby.js'
import { createCareEvent, createConcern as createConcernRecord, correctCareEvent, voidCareEvent } from '../domain/careEvents.js'
import { createEvaluatedGrowthMeasurement, GROWTH_AGE_BASES, GROWTH_SOURCES, growthSourceLabel } from '../domain/growth.js'
import { GROWTH_TYPES, getAdminTasks, getDailyTasks, getStageMilestones, localDateKey } from '../domain/carePlan.js'
import { SUPPORT_TOPICS } from '../domain/healthSupport.js'
import { projectBabyState } from '../domain/babyState.js'
import { navigate, ROUTES } from '../app/router.js'
import { Header } from './Header.jsx'
import { CareTaskList } from './CareTaskList.jsx'
import { AdminTaskList } from './AdminTaskList.jsx'
import { ConcernSupport } from './ConcernSupport.jsx'
import { QuickRecordPanel } from './QuickRecordPanel.jsx'

const RECORD_CARDS = [
  { id: 'basic', icon: Baby, eyebrow: '档案', title: '基础信息', detail: '出生资料、喂养方式、过敏与长期用药', tone: 'coral' },
  { id: 'feeding', icon: Utensils, eyebrow: '日常', title: '喂奶', detail: '亲喂、瓶喂和实际喝下奶量', tone: 'sage' },
  { id: 'illness', icon: Thermometer, eyebrow: '健康事实', title: '生病 / 症状', detail: '只记录看到的表现、时间和测量', tone: 'apricot' },
  { id: 'medication', icon: Pill, eyebrow: '健康事实', title: '用药', detail: '记录实际发生的用药，不提供剂量建议', tone: 'lavender' },
]

const MORE_CARDS = [
  { id: 'growth', icon: Activity, title: '成长测量', detail: '体重、身长和头围原始记录' },
  { id: 'care', icon: ClipboardList, title: '照护动作', detail: '今日行动、阶段代办和里程碑' },
  { id: 'concern', icon: HeartPulse, title: '关注事项', detail: '创建、跟进和结束一个关注主题' },
  { id: 'professional', icon: FileText, title: '专业记录', detail: '录入医生或专业人员给出的结论' },
  { id: 'questions', icon: CircleHelp, title: '咨询问题', detail: '保存下次想向专业人员确认的问题' },
]

function text(value, locale) {
  return value?.[locale === 'en-US' ? 'en' : 'zh'] || value?.zh || value || ''
}

function nowInputValue() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 16)
}

function actorFor(state) {
  return state.careActors?.find((actor) => actor.id === state.preferences?.currentRecorderId) || state.careActors?.[0]
}

function measurementPayload(event) {
  const payload = event?.payload || {}
  return payload.record && typeof payload.record === 'object' ? payload.record : payload
}

function measurementInputChanged(previous, next) {
  return ['type', 'value', 'unit', 'measuredAt', 'source', 'method', 'ageBasis', 'note'].some((key) => String(previous?.[key] ?? '') !== String(next?.[key] ?? ''))
}

function currentCount(snapshot, stateKey) {
  return snapshot.recent24h.facts.filter((fact) => fact.stateKey === stateKey).length
}

function validateBasicInfoForm(form, isEnglish) {
  const message = (zh, en) => isEnglish ? en : zh
  if (!String(form.nickname || '').trim()) return message('请填写宝宝昵称。', 'Enter the baby nickname.')
  if (!String(form.birthDate || '').trim() || Number.isNaN(new Date(form.birthDate).getTime())) return message('请填写有效的出生日期。', 'Enter a valid birth date.')
  const weeks = Number(form.gestationalWeeks)
  if (!Number.isFinite(weeks) || weeks < 20 || weeks > 44) return message('出生孕周必须在 20–44 周之间。', 'Gestational weeks must be between 20 and 44.')
  const days = Number(form.gestationalDays)
  if (!Number.isInteger(days) || days < 0 || days > 6) return message('孕周余天必须是 0–6 的整数。', 'Extra gestational days must be an integer from 0 to 6.')
  for (const [key, label, max] of [['birthWeight', '体重', 20], ['birthLength', '身长', 100], ['birthHeadCircumference', '头围', 70]]) {
    const value = String(form[key] || '').trim()
    if (!value) continue
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > max) return message(`${label}必须在 0–${max} 范围内。`, `${key} must be between 0 and ${max}.`)
  }
  return ''
}

export function RecordCenter({ state, commitState, onClear, onLogout, readOnly = false, role = 'admin' }) {
  const locale = state.preferences.locale
  const isEnglish = locale === 'en-US'
  const [activePanel, setActivePanel] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] || '').get('panel') === 'illness' ? 'illness' : null)
  const [toast, setToast] = useState('')
  const [entryError, setEntryError] = useState('')
  const ageDays = useMemo(() => getAgeDays(state.baby.birthDate), [state.baby.birthDate])
  const stage = useMemo(() => getStage(ageDays), [ageDays])
  const snapshot = useMemo(() => projectBabyState({ baby: state.baby, events: state.careEvents, concerns: state.concerns }), [state.baby, state.careEvents, state.concerns])
  const dailyTasks = useMemo(() => getDailyTasks(state.taskLogs), [state.taskLogs])
  const adminTasks = useMemo(() => getAdminTasks(stage.id, ageDays, state.adminTaskRecords), [stage.id, ageDays, state.adminTaskRecords])
  const milestones = useMemo(() => getStageMilestones(stage.id, state.milestoneRecords), [stage.id, state.milestoneRecords])

  function openPanel(panel) {
    setEntryError('')
    setToast('')
    setActivePanel((current) => current === panel ? null : panel)
  }

  function showSaved(message = isEnglish ? 'Saved' : '已保存') {
    setEntryError('')
    setToast(message)
    window.setTimeout(() => setToast(''), 1800)
  }

  function commitWithFeedback(updater, message) {
    setEntryError('')
    try {
      return Promise.resolve(commitState(updater)).then((result) => {
        if (result === false) return false
        showSaved(message)
        return true
      }).catch((error) => {
        setEntryError(error?.message || (isEnglish ? 'Save failed. Retry.' : '保存失败，请重试。'))
        throw error
      })
    } catch (error) {
      setEntryError(error?.message || (isEnglish ? 'Save failed. Retry.' : '保存失败，请重试。'))
      return Promise.reject(error)
    }
  }

  // `input` is the canonical CareEvent fields supplied by a panel; the
  // commit wrapper fills the shared baby, actor, source, and timestamps.
  function recordEvent(input = {}, message) {
    return commitWithFeedback((current) => {
      if (!current.baby?.id) throw new Error(isEnglish ? 'A baby profile is required.' : '请先建立宝宝档案。')
      const actor = input.actor || actorFor(current)
      if (!actor?.id || !actor?.displayName) throw new Error(isEnglish ? 'Choose the current role first.' : '请先选择当前角色。')
      const now = input.recordedAt || new Date().toISOString()
      const event = createCareEvent({
        ...input,
        babyId: current.baby.id,
        actor,
        source: input.source || 'caregiver',
        recordedAt: input.recordedAt || now,
        occurredAt: input.occurredAt || now,
      }, { now })
      return { ...current, careEvents: [...(current.careEvents || []), event] }
    }, message)
  }

  function updateProfile(profile) {
    const validationError = validateBasicInfoForm(profile, isEnglish)
    if (validationError) {
      setEntryError(validationError)
      return Promise.reject(new Error(validationError))
    }
    return commitWithFeedback((current) => {
      const { birthWeight, birthLength, birthHeadCircumference, ...profileFields } = profile
      const now = new Date().toISOString()
      const nextBaby = { ...current.baby, ...profileFields }
      const birthDate = nextBaby.birthDate
      const birthInputs = [
        ['weight', birthWeight, 'kg', 'weight_scale'],
        ['length', birthLength, 'cm', 'lying_length'],
        ['headCircumference', birthHeadCircumference, 'cm', 'head_circumference_tape'],
      ]
      const profileChanged = ['birthDate', 'gestationalWeeks', 'gestationalDays', 'growthAgeBasis', 'birthMultiplicity'].some((key) => String(current.baby?.[key] ?? '') !== String(nextBaby[key] ?? ''))
      const birthEvents = (current.careEvents || []).filter((event) => {
        const measurement = measurementPayload(event)
        return event.status === 'active' && event.category === 'growth_measurement' && measurement.source === 'birth_record'
      })
      const existingByType = new Map(birthEvents.filter((event) => String(measurementPayload(event).measuredAt).slice(0, 10) === String(birthDate).slice(0, 10)).map((event) => [measurementPayload(event).type, event]))
      const nonBirth = (current.growthMeasurements || []).filter((item) => item.source !== 'birth_record')
      const actor = actorFor(current)
      if (!actor?.id || !actor?.displayName) throw new Error(isEnglish ? 'Choose the current role first.' : '请先选择当前角色。')
      const birthMeasurements = birthInputs.filter(([, value]) => String(value || '').trim()).map(([type, value, unit, method]) => {
        const prior = existingByType.get(type)
        return createEvaluatedGrowthMeasurement({ id: prior ? measurementPayload(prior).id || prior.id : undefined, type, value: String(value).trim(), unit, measuredAt: birthDate, method, source: 'birth_record' }, nextBaby, nonBirth)
      })
      const eventsById = new Map((current.careEvents || []).map((event) => [event.id, event]))
      for (const measurement of birthMeasurements) {
        const prior = existingByType.get(measurement.type)
        if (!prior) {
          const event = createCareEvent({ id: measurement.id, babyId: nextBaby.id, kind: 'measurement', category: 'growth_measurement', occurredAt: `${birthDate}T12:00:00.000Z`, recordedAt: now, actor, source: 'caregiver', payload: measurement })
          eventsById.set(event.id, event)
        } else if (profileChanged || measurementInputChanged(measurementPayload(prior), measurement)) {
          const corrected = correctCareEvent([...eventsById.values()], prior.id, { kind: 'measurement', category: 'growth_measurement', occurredAt: `${birthDate}T12:00:00.000Z`, recordedAt: now, actor, source: 'caregiver', payload: measurement }, { now })
          eventsById.clear()
          corrected.forEach((event) => eventsById.set(event.id, event))
        }
      }
      const retainedTypes = new Set(birthMeasurements.map((measurement) => measurement.type))
      for (const prior of birthEvents) {
        const priorMeasurement = measurementPayload(prior)
        const sameBirthDate = String(priorMeasurement.measuredAt).slice(0, 10) === String(birthDate).slice(0, 10)
        if (!sameBirthDate || !retainedTypes.has(priorMeasurement.type)) eventsById.set(prior.id, voidCareEvent(prior, { now }))
      }
      return { ...current, baby: nextBaby, careEvents: [...eventsById.values()] }
    }, isEnglish ? 'Baby profile saved' : '基础信息已保存')
  }

  function saveGrowth(input) {
    const measurement = createEvaluatedGrowthMeasurement(input, state.baby, state.growthMeasurements)
    return recordEvent({ kind: 'measurement', category: 'growth_measurement', occurredAt: `${measurement.measuredAt}T12:00:00.000Z`, payload: measurement }, isEnglish ? 'Measurement saved' : '成长测量已保存')
  }

  function updateTask(taskId, input) {
    const date = input.date || localDateKey()
    return recordEvent({ category: 'care_action', occurredAt: `${date}T12:00:00.000Z`, payload: { taskId, date, status: input.status || 'done', performedBy: input.actor || null, note: input.note || '' } }, isEnglish ? 'Care action saved' : '照护动作已保存')
  }

  function updateAdminTask(taskId, input) {
    return recordEvent({ category: 'admin_task', payload: { taskId, ...input } }, isEnglish ? 'Task saved' : '代办已保存')
  }

  function updateMilestone(milestoneId, status) {
    return recordEvent({ category: 'milestone', payload: { milestoneId, status } }, isEnglish ? 'Milestone saved' : '里程碑已保存')
  }

  function createConcern(input) {
    const topic = SUPPORT_TOPICS.find((item) => item.id === input.topicId)
    if (!topic) throw new Error('未找到关注类型')
    const now = new Date().toISOString()
    const concern = { ...createConcernRecord({ babyId: state.baby.id, topicId: input.topicId, title: topic.title, status: 'open' }, { now }), plan: input.plan || null, facts: input.facts || [], notes: input.notes || '' }
    return commitWithFeedback((current) => {
      const actor = actorFor(current)
      if (!current.baby?.id) throw new Error(isEnglish ? 'A baby profile is required.' : '请先建立宝宝档案。')
      if (!actor?.id || !actor?.displayName) throw new Error(isEnglish ? 'Choose the current role first.' : '请先选择当前角色。')
      const event = createCareEvent({ babyId: current.baby.id, kind: 'caregiver_observation', category: 'concern_open', occurredAt: now, recordedAt: now, source: 'caregiver', actor, payload: { concernId: concern.id, topicId: input.topicId, supportTopic: input.topicId, supportTitle: topic.title, facts: input.facts || [], notes: input.notes || '', plan: input.plan || null } })
      return { ...current, concerns: [...(current.concerns || []), concern], careEvents: [...(current.careEvents || []), event] }
    }, isEnglish ? 'Follow-up saved' : '关注事项已保存').then(() => concern)
  }

  function resolveConcern(concernId) {
    const now = new Date().toISOString()
    return commitWithFeedback((current) => {
      const concern = current.concerns.find((item) => item.id === concernId)
      const actor = actorFor(current)
      if (!actor?.id || !actor?.displayName) throw new Error(isEnglish ? 'Choose the current role first.' : '请先选择当前角色。')
      return { ...current, concerns: current.concerns.map((item) => item.id === concernId ? { ...item, status: 'closed', updatedAt: now } : item), careEvents: [...(current.careEvents || []), createCareEvent({ babyId: current.baby.id, kind: 'caregiver_observation', category: 'care_action', occurredAt: now, recordedAt: now, source: 'caregiver', actor, payload: { concernId, supportStatus: 'closed', supportTitle: concern?.title || '' } })] }
    }, isEnglish ? 'Follow-up closed' : '关注事项已结束')
  }

  function saveQuestions(value) {
    const questions = String(value || '').split('\n').map((item) => item.trim()).filter(Boolean)
    return commitWithFeedback((current) => ({ ...current, questions }), isEnglish ? 'Questions saved' : '咨询问题已保存')
  }

  return (
    <main className="record-center-page">
      <Header route={ROUTES.records} baby={state.baby} ageDays={ageDays} onClear={onClear} onLogout={onLogout} readOnly={readOnly} role={role} locale={locale} careActors={state.careActors} currentRecorderId={state.preferences.currentRecorderId} onRecorderChange={(value) => commitState((current) => ({ ...current, preferences: { ...current.preferences, currentRecorderId: value } }))} syncStatus={state.syncMeta?.status} onSyncRetry={() => window.dispatchEvent(new Event('babyforge:sync-retry'))} />
      <div className="record-center-shell">
        <header className="record-center-hero">
          <div>
            <button className="record-back-link" onClick={() => navigate(ROUTES.today)}><ArrowLeft size={15} />{isEnglish ? 'Back to today' : '返回今天'}</button>
            <p className="eyebrow">{isEnglish ? 'One place for every fact' : '所有事实，一个入口'}</p>
            <h1>{isEnglish ? 'Record center' : '记录中心'}</h1>
            <p>{isEnglish ? 'Save what happened first. BabyForge calculates the baseline and current state from these records.' : '先记录发生了什么。基线和当前状态由这些原始记录自动整理。'}</p>
          </div>
          <div className="record-center-stage"><span>{isEnglish ? 'Current stage' : '当前阶段'}</span><strong>{getStageLabel(stage, locale)}</strong><small>{getStageRangeLabel(stage, locale)} · {isEnglish ? `${ageDays} days old` : `出生后 ${ageDays} 天`}</small></div>
        </header>

        <section className="record-center-notice"><ShieldCheck size={18} /><div><strong>{isEnglish ? 'Record facts, not conclusions' : '这里记录事实，不手工填写结论'}</strong><p>{isEnglish ? 'Every entry keeps its time, current role, source, and lifecycle. Current state, baseline, changes, and unknowns are calculated below.' : '每条记录都会保留时间、当前角色、来源和生命周期。当前状态、个人基线、变化与未知信息由系统自动计算。'}</p></div></section>

        <section className="record-card-section" aria-labelledby="record-card-heading">
          <div className="record-section-heading"><div><p className="eyebrow">{isEnglish ? 'Quick entry' : '快速记录'}</p><h2 id="record-card-heading">{isEnglish ? 'What do you want to record?' : '现在要记录什么？'}</h2></div><span>{isEnglish ? 'Tap a card to open a light form' : '点击卡片，打开低负荷记录'}</span></div>
          <div className="record-card-grid">{RECORD_CARDS.map((card) => <RecordCard key={card.id} card={card} active={activePanel === card.id} onClick={() => openPanel(card.id)} meta={cardMeta(card.id, state, snapshot, locale)} />)}</div>
        </section>

        {activePanel && <section className="record-entry-sheet" data-testid={`record-entry-${activePanel}`}>
          <header className="record-entry-header"><div><p className="eyebrow">{isEnglish ? 'Light entry' : '低负荷记录'}</p><h2>{entryTitle(activePanel, isEnglish)}</h2></div><button className="record-close" type="button" onClick={() => setActivePanel(null)} aria-label={isEnglish ? 'Close' : '关闭'}><X size={18} /></button></header>
          {activePanel === 'basic' && <BasicInfoPanel baby={state.baby} birthMeasurements={state.growthMeasurements} locale={locale} readOnly={readOnly} onSave={updateProfile} />}
          {activePanel === 'feeding' && <FeedingPanel locale={locale} readOnly={readOnly} onRecord={recordEvent} onConcern={() => openPanel('illness')} />}
          {activePanel === 'illness' && <IllnessPanel locale={locale} readOnly={readOnly} onRecord={recordEvent} />}
          {activePanel === 'medication' && <MedicationPanel locale={locale} readOnly={readOnly} onRecord={recordEvent} />}
        </section>}

        <section className="record-state-strip" aria-label={isEnglish ? 'Calculated state' : '自动整理的当前状态'}>
          <div><span>{isEnglish ? 'Recorded in last 24h' : '最近 24 小时有记录'}</span><strong>{snapshot.recent24h.sourceEventIds.length}</strong></div>
          <div><span>{isEnglish ? 'Feeding facts' : '喂奶事实'}</span><strong>{currentCount(snapshot, 'feeding.count') || '—'}</strong></div>
          <div><span>{isEnglish ? 'Open follow-up' : '进行中的关注'}</span><strong>{snapshot.activeProblems.length || '—'}</strong></div>
          <div><span>{isEnglish ? 'Unknown domains' : '尚未记录的领域'}</span><strong>{snapshot.current.unknown.length || '—'}</strong></div>
        </section>

        <section className="record-card-section record-more-section" aria-labelledby="record-more-heading">
          <div className="record-section-heading"><div><p className="eyebrow">{isEnglish ? 'More records' : '更多记录'}</p><h2 id="record-more-heading">{isEnglish ? 'Keep related facts together' : '把相关事实也放在这里'}</h2></div><span>{isEnglish ? 'No editing on other pages' : '其他页面只展示，不分散编辑入口'}</span></div>
          <div className="record-more-grid">{MORE_CARDS.map((card) => { const Icon = card.icon; return <button key={card.id} className={`record-more-card ${activePanel === card.id ? 'active' : ''}`} type="button" onClick={() => openPanel(card.id)}><span className="record-more-icon"><Icon size={17} /></span><span><strong>{isEnglish ? moreTitle(card.id) : card.title}</strong><small>{isEnglish ? moreDetail(card.id) : card.detail}</small></span><ChevronRight size={16} /></button> })}</div>
        </section>

        {activePanel === 'growth' && <RecordSubsection title={isEnglish ? 'Growth measurement' : '成长测量'} onClose={() => setActivePanel(null)}><GrowthPanel baby={state.baby} history={state.growthMeasurements} locale={locale} readOnly={readOnly} onSave={saveGrowth} /></RecordSubsection>}
          {activePanel === 'care' && <RecordSubsection title={isEnglish ? 'Care actions' : '照护动作'} onClose={() => setActivePanel(null)}><div className="record-subsection-stack"><CareTaskList tasks={dailyTasks} locale={locale} onUpdate={updateTask} readOnly={readOnly} /><AdminTaskList tasks={adminTasks} locale={locale} onUpdate={updateAdminTask} readOnly={readOnly} /><MilestonePanel milestones={milestones} locale={locale} readOnly={readOnly} onUpdate={updateMilestone} /></div></RecordSubsection>}
          {activePanel === 'concern' && <RecordSubsection title={isEnglish ? 'Follow-up topics' : '关注事项'} onClose={() => setActivePanel(null)}><ConcernSupport locale={locale} concerns={state.concerns} onCreate={createConcern} onResolve={resolveConcern} readOnly={readOnly} /></RecordSubsection>}
          {activePanel === 'professional' && <RecordSubsection title={isEnglish ? 'Professional record' : '专业记录'} onClose={() => setActivePanel(null)}><ProfessionalPanel locale={locale} readOnly={readOnly} onRecord={recordEvent} /></RecordSubsection>}
          {activePanel === 'questions' && <RecordSubsection title={isEnglish ? 'Questions for a clinician' : '咨询问题'} onClose={() => setActivePanel(null)}><QuestionPanel questions={state.questions} locale={locale} readOnly={readOnly} onSave={saveQuestions} /></RecordSubsection>}

        {(toast || entryError) && <div className={`record-toast ${entryError ? 'error' : ''}`} role={entryError ? 'alert' : 'status'}>{entryError || toast}</div>}
        <footer className="record-center-footer"><Clock3 size={15} /><span>{isEnglish ? 'The current role selector in the header applies to every new entry. Existing records keep their original recorder.' : '顶部当前角色选择会应用于新记录；已有记录保留原来的记录人。'}</span></footer>
      </div>
    </main>
  )
}

function RecordCard({ card, active, onClick, meta }) {
  const Icon = card.icon
  return <button type="button" className={`record-card ${card.tone} ${active ? 'active' : ''}`} onClick={onClick} aria-expanded={active}><span className="record-card-icon"><Icon size={21} /></span><span className="record-card-copy"><small>{card.eyebrow}</small><strong>{card.title}</strong><em>{card.detail}</em>{meta && <b>{meta}</b>}</span><ChevronRight className="record-card-arrow" size={18} /></button>
}

function cardMeta(id, state, snapshot, locale) {
  const isEnglish = locale === 'en-US'
  if (id === 'basic') return state.baby?.nickname || (isEnglish ? 'Profile incomplete' : '档案待补充')
  if (id === 'feeding') return `${currentCount(snapshot, 'feeding.count') || 0} ${isEnglish ? 'in 24h' : '次 / 24 小时'}`
  if (id === 'illness') return `${snapshot.current.known.filter((fact) => fact.dimension === 'illness').length || 0} ${isEnglish ? 'current observations' : '条当前观察'}`
  return `${state.careEvents.filter((event) => event.category === 'medication' && event.status === 'active').length || 0} ${isEnglish ? 'raw records' : '条原始记录'}`
}

function entryTitle(id, isEnglish) {
  return {
    basic: isEnglish ? 'Baby profile' : '基础信息',
    feeding: isEnglish ? 'Feeding' : '喂奶',
    illness: isEnglish ? 'Illness / symptoms' : '生病 / 症状',
    medication: isEnglish ? 'Medication' : '用药',
  }[id] || id
}

function moreTitle(id) {
  return { growth: 'Growth measurements', care: 'Care actions', concern: 'Follow-up topics', professional: 'Professional record', questions: 'Questions for a clinician' }[id]
}

function moreDetail(id) {
  return { growth: 'Weight, length, and head circumference', care: 'Daily actions, errands, and milestones', concern: 'Open, track, and close a topic', professional: 'Clinician conclusions and instructions', questions: 'Keep questions for the next professional conversation' }[id]
}

function PanelActions({ locale, saving = false, onCancel }) {
  const isEnglish = locale === 'en-US'
  return <div className="record-panel-actions"><button type="button" className="secondary-button compact" onClick={onCancel}>{isEnglish ? 'Cancel' : '取消'}</button><button type="submit" className="primary-button compact" disabled={saving}><Save size={15} />{saving ? (isEnglish ? 'Saving…' : '保存中…') : (isEnglish ? 'Save fact' : '保存事实')}</button></div>
}

function BasicInfoPanel({ baby, birthMeasurements = [], locale, readOnly, onSave }) {
  const isEnglish = locale === 'en-US'
  const initialForm = () => ({
    nickname: baby.nickname || '',
    birthDate: baby.birthDate || '',
    gestationalWeeks: baby.gestationalWeeks ?? 40,
    gestationalDays: baby.gestationalDays ?? 0,
    birthMultiplicity: baby.birthMultiplicity || 'singleton',
    growthAgeBasis: baby.growthAgeBasis || 'chronological',
    sex: baby.sex || '',
    feedingMode: baby.feedingMode || 'breastfeeding',
    birthWeight: birthMeasurements.find((item) => item.source === 'birth_record' && item.type === 'weight')?.value || '',
    birthLength: birthMeasurements.find((item) => item.source === 'birth_record' && item.type === 'length')?.value || '',
    birthHeadCircumference: birthMeasurements.find((item) => item.source === 'birth_record' && item.type === 'headCircumference')?.value || '',
    medicalHistory: baby.medicalHistory || '',
    allergies: baby.allergies || '',
    longTermMedications: baby.longTermMedications || '',
  })
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  function change(key, value) { setFormError(''); setForm((current) => ({ ...current, [key]: value })) }
  async function submit(event) {
    event.preventDefault()
    const validationError = validateBasicInfoForm(form, locale === 'en-US')
    if (validationError) {
      setFormError(validationError)
      return
    }
    setSaving(true)
    try { await onSave({ ...form, gestationalWeeks: Number(form.gestationalWeeks), gestationalDays: Number(form.gestationalDays) }); setFormError('') } catch (error) { setFormError(error?.message || (locale === 'en-US' ? 'Save failed. Retry.' : '保存失败，请重试。')) } finally { setSaving(false) }
  }
  return <form className="record-form" onSubmit={submit}><p className="record-form-lede">{isEnglish ? 'Profile facts are used as background context. Leave a field blank when you do not know it.' : '这些内容只作为稳定背景。不了解的字段可以留空，系统不会替你猜测。'}</p><fieldset disabled={readOnly || saving}><div className="form-grid two"><label>{isEnglish ? 'Nickname' : '宝宝昵称'}<input value={form.nickname} onChange={(event) => change('nickname', event.target.value)} required /></label><label>{isEnglish ? 'Birth date' : '出生日期'}<input type="date" value={form.birthDate} onChange={(event) => change('birthDate', event.target.value)} required /></label></div><div className="form-grid four"><label>{isEnglish ? 'Gestational weeks' : '出生孕周'}<input type="number" min="20" max="44" value={form.gestationalWeeks} onChange={(event) => change('gestationalWeeks', event.target.value)} /></label><label>{isEnglish ? 'Extra days' : '孕周余天'}<input type="number" min="0" max="6" value={form.gestationalDays} onChange={(event) => change('gestationalDays', event.target.value)} /></label><label>{isEnglish ? 'Birth type' : '出生情况'}<select value={form.birthMultiplicity} onChange={(event) => change('birthMultiplicity', event.target.value)}><option value="singleton">{isEnglish ? 'Singleton' : '单胎'}</option><option value="multiple">{isEnglish ? 'Multiple birth' : '多胎'}</option></select></label><label>{isEnglish ? 'Age basis' : '年龄口径'}<select value={form.growthAgeBasis} onChange={(event) => change('growthAgeBasis', event.target.value)}>{GROWTH_AGE_BASES.map((basis) => <option key={basis} value={basis}>{basis === 'corrected' ? (isEnglish ? 'Corrected age' : '矫正年龄') : basis === 'postmenstrual' ? (isEnglish ? 'Postmenstrual age' : '经后年龄') : (isEnglish ? 'Chronological age' : '实际年龄')}</option>)}</select></label></div><fieldset className="record-inline-fieldset"><legend>{isEnglish ? 'Profile details' : '档案细节'}</legend><div className="form-grid three"><label>{isEnglish ? 'Sex' : '性别'}<select value={form.sex} onChange={(event) => change('sex', event.target.value)}><option value="">{isEnglish ? 'Not set' : '未设置'}</option><option value="male">{isEnglish ? 'Boy' : '男孩'}</option><option value="female">{isEnglish ? 'Girl' : '女孩'}</option></select></label><label>{isEnglish ? 'Feeding mode' : '喂养方式'}<select value={form.feedingMode} onChange={(event) => change('feedingMode', event.target.value)}><option value="breastfeeding">{isEnglish ? 'Breastfeeding' : '母乳喂养'}</option><option value="formula">{isEnglish ? 'Formula' : '配方奶喂养'}</option><option value="mixed">{isEnglish ? 'Mixed' : '混合喂养'}</option><option value="other">{isEnglish ? 'Other / unknown' : '其他 / 未确定'}</option></select></label></div></fieldset><fieldset className="record-inline-fieldset"><legend>{isEnglish ? 'Birth measurements' : '出生测量'}</legend><div className="form-grid three"><label>{isEnglish ? 'Weight (kg)' : '体重（kg）'}<input type="number" min="0" max="20" step="0.01" inputMode="decimal" value={form.birthWeight} onChange={(event) => change('birthWeight', event.target.value)} /></label><label>{isEnglish ? 'Length (cm)' : '身长（cm）'}<input type="number" min="0" max="100" step="0.1" inputMode="decimal" value={form.birthLength} onChange={(event) => change('birthLength', event.target.value)} /></label><label>{isEnglish ? 'Head circumference (cm)' : '头围（cm）'}<input type="number" min="0" max="70" step="0.1" inputMode="decimal" value={form.birthHeadCircumference} onChange={(event) => change('birthHeadCircumference', event.target.value)} /></label></div></fieldset><div className="form-grid three"><label>{isEnglish ? 'Past history' : '既往史'}<textarea rows="2" value={form.medicalHistory} onChange={(event) => change('medicalHistory', event.target.value)} placeholder={isEnglish ? 'Optional factual note' : '可填写已知事实'} /></label><label>{isEnglish ? 'Allergies' : '过敏信息'}<textarea rows="2" value={form.allergies} onChange={(event) => change('allergies', event.target.value)} placeholder={isEnglish ? 'Unknown is okay' : '不确定可以留空'} /></label><label>{isEnglish ? 'Long-term medicines' : '长期用药'}<textarea rows="2" value={form.longTermMedications} onChange={(event) => change('longTermMedications', event.target.value)} placeholder={isEnglish ? 'Name and factual note' : '药名和已知事实'} /></label></div></fieldset>{formError && <p className="save-error" role="alert">{formError}</p>}{!readOnly && <PanelActions locale={locale} saving={saving} onCancel={() => { setForm(initialForm()); setFormError('') }} />}</form>
}

function QuestionPanel({ questions = [], locale, readOnly, onSave }) {
  const isEnglish = locale === 'en-US'
  const [value, setValue] = useState(() => questions.join('\n'))
  const [saving, setSaving] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await onSave(value)
    } finally {
      setSaving(false)
    }
  }
  return <form className="record-form" onSubmit={submit}><p className="record-form-lede">{isEnglish ? 'Keep one question per line for the next professional conversation. These are not diagnoses or answers.' : '每行保存一个问题，留给下次和专业人员沟通。这里不填写诊断，也不替你回答。'}</p><fieldset disabled={readOnly || saving}><label>{isEnglish ? 'Questions for a clinician' : '希望咨询的问题'}<textarea aria-label={isEnglish ? 'Questions for a clinician' : '希望咨询的问题'} rows="6" value={value} onChange={(event) => setValue(event.target.value)} placeholder={isEnglish ? 'One question per line' : '每行一个问题，例如：需要复测胆红素吗？'} /></label></fieldset>{!readOnly && <PanelActions locale={locale} saving={saving} onCancel={() => setValue(questions.join('\n'))} />}</form>
}

function FeedingPanel({ locale, readOnly, onRecord, onConcern }) {
  return <div className="record-panel-stack"><p className="record-form-lede">{locale === 'en-US' ? 'One tap saves the occurrence time and current role. Add amount only for bottle feeding.' : '点击一次就会保存发生时间和当前角色。瓶喂时再补充实际喝下奶量。'}</p><QuickRecordPanel locale={locale} onRecord={onRecord} onConcern={onConcern} readOnly={readOnly} includeDiapers={false} /></div>
}

function IllnessPanel({ locale, readOnly, onRecord }) {
  const isEnglish = locale === 'en-US'
  const [symptoms, setSymptoms] = useState([])
  const [bodyAreas, setBodyAreas] = useState([])
  const [occurredAt, setOccurredAt] = useState(nowInputValue)
  const [notes, setNotes] = useState('')
  const [temperature, setTemperature] = useState('')
  const [unit, setUnit] = useState('°C')
  const [bilirubinValue, setBilirubinValue] = useState('')
  const [bilirubinUnit, setBilirubinUnit] = useState('μmol/L')
  const [measuredAt, setMeasuredAt] = useState('')
  const [measurementSource, setMeasurementSource] = useState('hospital')
  const [saving, setSaving] = useState(false)
  const options = [['fever', '发热', 'Fever'], ['cough', '咳嗽', 'Cough'], ['vomiting', '呕吐', 'Vomiting'], ['diarrhea', '腹泻', 'Diarrhea'], ['rash', '皮疹', 'Rash'], ['breathing', '呼吸变化', 'Breathing change']]
  function toggle(value) { setSymptoms((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]) }
  function toggleBodyArea(value) { setBodyAreas((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]) }
  function reset() { setSymptoms([]); setBodyAreas([]); setNotes(''); setTemperature(''); setBilirubinValue(''); setMeasuredAt(''); setOccurredAt(nowInputValue()) }
  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await onRecord({
        kind: 'caregiver_observation',
        category: 'symptom_observation',
        occurredAt: new Date(occurredAt).toISOString(),
        payload: {
          symptoms,
          bodyAreas,
          symptomNotes: notes,
          temperatureValue: temperature,
          temperatureUnit: unit,
          bilirubinValue,
          bilirubinUnit,
          measuredAt: measuredAt ? new Date(measuredAt).toISOString() : '',
          measurementSource,
          firstNoticedAt: new Date(occurredAt).toISOString(),
        },
      }, isEnglish ? 'Observation saved' : '生病 / 症状已保存')
      reset()
    } catch { /* parent shows error */ } finally { setSaving(false) }
  }
  return <form className="record-form" onSubmit={submit}><p className="record-form-lede">{isEnglish ? 'Choose only what was observed. This entry does not diagnose or grade urgency.' : '只勾选确实看到的表现。这条记录不提供诊断，也不判断紧急程度。'}</p><fieldset disabled={readOnly || saving}><label>{isEnglish ? 'When did it start?' : '什么时候开始'}<input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required /></label><fieldset className="record-inline-fieldset"><legend>{isEnglish ? 'Observed symptoms' : '看到的表现'}</legend><div className="record-check-grid">{options.map(([value, zh, en]) => <label key={value}><input type="checkbox" checked={symptoms.includes(value)} onChange={() => toggle(value)} />{isEnglish ? en : zh}</label>)}</div></fieldset><label>{isEnglish ? 'Notes' : '补充事实'}<textarea rows="3" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={isEnglish ? 'What changed, and what did you see?' : '和平时相比哪里变了？你看到了什么？'} /></label><div className="form-grid two"><label>{isEnglish ? 'Temperature (optional)' : '体温（可选）'}<input inputMode="decimal" value={temperature} onChange={(event) => setTemperature(event.target.value)} /></label><label>{isEnglish ? 'Unit' : '单位'}<select value={unit} onChange={(event) => setUnit(event.target.value)}><option>°C</option><option>°F</option></select></label></div><fieldset className="record-inline-fieldset"><legend>{isEnglish ? 'Jaundice / measured details (optional)' : '黄疸 / 测量细节（可选）'}</legend><div className="record-check-grid"><label><input type="checkbox" checked={bodyAreas.includes('face')} onChange={() => toggleBodyArea('face')} />{isEnglish ? 'Face' : '面部'}</label><label><input type="checkbox" checked={bodyAreas.includes('eyes')} onChange={() => toggleBodyArea('eyes')} />{isEnglish ? 'Sclera' : '眼白'}</label><label><input type="checkbox" checked={bodyAreas.includes('chest')} onChange={() => toggleBodyArea('chest')} />{isEnglish ? 'Chest / abdomen' : '胸腹'}</label><label><input type="checkbox" checked={bodyAreas.includes('limbs')} onChange={() => toggleBodyArea('limbs')} />{isEnglish ? 'Limbs' : '四肢'}</label></div><div className="form-grid four"><label>{isEnglish ? 'Bilirubin value' : '胆红素数值'}<input inputMode="decimal" value={bilirubinValue} onChange={(event) => setBilirubinValue(event.target.value)} /></label><label>{isEnglish ? 'Unit' : '单位'}<select value={bilirubinUnit} onChange={(event) => setBilirubinUnit(event.target.value)}><option>μmol/L</option><option>mg/dL</option></select></label><label>{isEnglish ? 'Measured at' : '测量时间'}<input type="datetime-local" value={measuredAt} onChange={(event) => setMeasuredAt(event.target.value)} /></label><label>{isEnglish ? 'Source' : '来源'}<select value={measurementSource} onChange={(event) => setMeasurementSource(event.target.value)}><option value="hospital">{isEnglish ? 'Hospital' : '医院'}</option><option value="device">{isEnglish ? 'Device' : '设备'}</option><option value="manual">{isEnglish ? 'Manual' : '手工记录'}</option></select></label></div></fieldset></fieldset>{!readOnly && <PanelActions locale={locale} saving={saving} onCancel={reset} />}</form>
}

function MedicationPanel({ locale, readOnly, onRecord }) {
  const isEnglish = locale === 'en-US'
  const [form, setForm] = useState({ name: '', amount: '', unit: 'mg', route: '', takenAt: nowInputValue(), note: '' })
  const [saving, setSaving] = useState(false)
  function change(key, value) { setForm((current) => ({ ...current, [key]: value })) }
  async function submit(event) {
    event.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try { await onRecord({ kind: 'caregiver_observation', category: 'medication', occurredAt: new Date(form.takenAt).toISOString(), payload: { medicationName: form.name.trim(), amount: form.amount.trim(), unit: form.unit, route: form.route.trim(), takenAt: new Date(form.takenAt).toISOString(), note: form.note.trim() } }, isEnglish ? 'Medication fact saved' : '用药事实已保存'); setForm({ name: '', amount: '', unit: 'mg', route: '', takenAt: nowInputValue(), note: '' }) } catch { /* parent shows error */ } finally { setSaving(false) }
  }
  return <form className="record-form" onSubmit={submit}><p className="record-form-lede">{isEnglish ? 'Record what was actually taken or applied. BabyForge does not recommend medicines or doses.' : '只记录实际服用或使用了什么。BabyForge 不推荐药物，也不提供剂量建议。'}</p><fieldset disabled={readOnly || saving}><div className="form-grid two"><label>{isEnglish ? 'Medicine name' : '药品名称'}<input value={form.name} onChange={(event) => change('name', event.target.value)} required /></label><label>{isEnglish ? 'Taken at' : '发生时间'}<input type="datetime-local" value={form.takenAt} onChange={(event) => change('takenAt', event.target.value)} required /></label></div><div className="form-grid three"><label>{isEnglish ? 'Amount' : '实际用量'}<input inputMode="decimal" value={form.amount} onChange={(event) => change('amount', event.target.value)} placeholder={isEnglish ? 'Optional' : '可选'} /></label><label>{isEnglish ? 'Unit' : '单位'}<select value={form.unit} onChange={(event) => change('unit', event.target.value)}><option>mg</option><option>mL</option><option>tablet</option><option>滴</option><option>{isEnglish ? 'Other' : '其他'}</option></select></label><label>{isEnglish ? 'Route' : '使用方式'}<input value={form.route} onChange={(event) => change('route', event.target.value)} placeholder={isEnglish ? 'e.g. oral' : '例如：口服'} /></label></div><label>{isEnglish ? 'Factual note' : '事实备注'}<textarea rows="2" value={form.note} onChange={(event) => change('note', event.target.value)} /></label></fieldset>{!readOnly && <PanelActions locale={locale} saving={saving} onCancel={() => setForm({ name: '', amount: '', unit: 'mg', route: '', takenAt: nowInputValue(), note: '' })} />}</form>
}

function GrowthPanel({ baby, history, locale, readOnly, onSave }) {
  const isEnglish = locale === 'en-US'
  const [type, setType] = useState('weight')
  const [value, setValue] = useState('')
  const [date, setDate] = useState(localDateKey())
  const [source, setSource] = useState('caregiver_observation')
  const [saving, setSaving] = useState(false)
  const definition = GROWTH_TYPES.find((item) => item.id === type)
  async function submit(event) { event.preventDefault(); if (!value.trim()) return; setSaving(true); try { await onSave({ type, value, measuredAt: date, unit: definition.unit, source, ageBasis: baby.growthAgeBasis || 'chronological' }); setValue('') } finally { setSaving(false) } }
  return <form className="record-form" onSubmit={submit}><p className="record-form-lede">{isEnglish ? 'Keep the original value, date, unit, and source. Reference positions are not diagnoses.' : '保留原始数值、日期、单位和来源。参考位置不等于诊断。'}</p><fieldset disabled={readOnly || saving}><div className="form-grid four"><label>{isEnglish ? 'Type' : '类型'}<select value={type} onChange={(event) => setType(event.target.value)}>{GROWTH_TYPES.map((item) => <option key={item.id} value={item.id}>{text(item.label, locale)}</option>)}</select></label><label>{isEnglish ? 'Value' : '数值'}<input inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} required /><small>{definition.unit}</small></label><label>{isEnglish ? 'Measured at' : '测量日期'}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label>{isEnglish ? 'Source' : '来源'}<select value={source} onChange={(event) => setSource(event.target.value)}>{GROWTH_SOURCES.map((item) => <option key={item} value={item}>{growthSourceLabel(item, locale)}</option>)}</select></label></div></fieldset>{!readOnly && <PanelActions locale={locale} saving={saving} onCancel={() => setValue('')} />}{history.length > 0 && <p className="record-form-count">{isEnglish ? `${history.length} saved measurements` : `已保存 ${history.length} 条成长测量`}</p>}</form>
}

function MilestonePanel({ milestones, locale, readOnly, onUpdate }) {
  const isEnglish = locale === 'en-US'
  return <section className="record-milestone-panel"><p className="record-form-lede">{isEnglish ? 'These are care actions, not developmental grades.' : '这里记录照护动作，不是发育评分。'}</p>{milestones.map((milestone) => { const done = milestone.status === 'done'; return <article key={milestone.id} className={`record-milestone ${done ? 'done' : ''}`}><button type="button" disabled={readOnly} onClick={() => onUpdate(milestone.id, done ? 'pending' : 'done')} aria-pressed={done}>{done ? <Check size={15} /> : <Plus size={15} />}</button><div><strong>{text(milestone.title, locale)}</strong><small>{text(milestone.detail, locale)}</small></div></article> })}</section>
}

function ProfessionalPanel({ locale, readOnly, onRecord }) {
  const isEnglish = locale === 'en-US'
  const [form, setForm] = useState({ topic: '', conclusion: '', recordedAt: nowInputValue() })
  const [saving, setSaving] = useState(false)
  function change(key, value) { setForm((current) => ({ ...current, [key]: value })) }
  async function submit(event) { event.preventDefault(); if (!form.conclusion.trim()) return; setSaving(true); try { await onRecord({ kind: 'professional_conclusion', category: 'professional_conclusion', source: 'clinical_record', occurredAt: new Date(form.recordedAt).toISOString(), payload: { stateKey: form.topic.trim() || 'professional.conclusion', conclusion: form.conclusion.trim(), recordedAt: new Date(form.recordedAt).toISOString() } }, isEnglish ? 'Professional record saved' : '专业记录已保存'); setForm({ topic: '', conclusion: '', recordedAt: nowInputValue() }) } finally { setSaving(false) } }
  return <form className="record-form" onSubmit={submit}><p className="record-form-lede">{isEnglish ? 'Copy or summarize a professional conclusion as a source record. It stays separate from caregiver observations.' : '把专业人员的结论作为来源记录下来；它与家长观察分开保存，不覆盖原始事实。'}</p><fieldset disabled={readOnly || saving}><div className="form-grid two"><label>{isEnglish ? 'Topic (optional)' : '对应主题（可选）'}<input value={form.topic} onChange={(event) => change('topic', event.target.value)} placeholder={isEnglish ? 'e.g. temperature' : '例如：体温'} /></label><label>{isEnglish ? 'Date and time' : '发生时间'}<input type="datetime-local" value={form.recordedAt} onChange={(event) => change('recordedAt', event.target.value)} required /></label></div><label>{isEnglish ? 'Professional conclusion / instruction' : '专业结论 / 交代事项'}<textarea rows="4" value={form.conclusion} onChange={(event) => change('conclusion', event.target.value)} required placeholder={isEnglish ? 'Use the wording you received when possible.' : '尽量使用你实际收到的原话或准确转述。'} /></label></fieldset>{!readOnly && <PanelActions locale={locale} saving={saving} onCancel={() => setForm({ topic: '', conclusion: '', recordedAt: nowInputValue() })} />}</form>
}

function RecordSubsection({ title, onClose, children }) {
  return <section className="record-entry-sheet record-subsection"><header className="record-entry-header"><div><p className="eyebrow">记录中心</p><h2>{title}</h2></div><button className="record-close" type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button></header>{children}</section>
}
