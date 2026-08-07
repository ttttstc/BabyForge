import { useMemo, useState } from 'react'
import { Activity, ArrowLeft, Baby, Check, ChevronRight, CircleHelp, ClipboardList, Clock3, Droplets, FileText, HeartPulse, Moon, Pill, Plus, Save, ShieldCheck, Thermometer, Utensils, X } from 'lucide-react'
import { getAgeDays, getStage, getStageLabel, getStageRangeLabel } from '../domain/baby.js'
import { assertCareRecordInput, createCareEvent, createConcern as createConcernRecord, correctCareEvent, voidCareEvent } from '../domain/careEvents.js'
import { getDailyCareSummary, localDayKey } from '../domain/careSummary.js'
import { createEvaluatedGrowthMeasurement } from '../domain/growth.js'
import { getAdminTasks, getDailyTasks, getStageMilestones, localDateKey } from '../domain/carePlan.js'
import { SUPPORT_TOPICS } from '../domain/healthSupport.js'
import { projectBabyState } from '../domain/babyState.js'
import { navigate, ROUTES } from '../app/router.js'
import { Header } from './Header.jsx'
import { CareTaskList } from './CareTaskList.jsx'
import { AdminTaskList } from './AdminTaskList.jsx'
import { ConcernSupport } from './ConcernSupport.jsx'
import { DailyCareTimeline, P0RecordComposer } from './CareRecordComposer.jsx'

const RECORD_CARDS = [
  { id: 'feeding', icon: Utensils, eyebrow: '日常事实', title: '喂奶', detail: '亲喂、母乳瓶喂或配方奶', tone: 'sage' },
  { id: 'sleep', icon: Moon, eyebrow: '日常事实', title: '睡眠', detail: '一次记录已确认的起止时间', tone: 'lavender' },
  { id: 'diaper', icon: Droplets, eyebrow: '日常事实', title: '尿布', detail: '一键记录尿、便或尿便都有', tone: 'aqua' },
  { id: 'medication', icon: Pill, eyebrow: '健康事实', title: '用药', detail: '只记录实际发生的用药', tone: 'apricot' },
  { id: 'temperature', icon: Thermometer, eyebrow: '健康事实', title: '体温', detail: '填写数值或只保存体温观察', tone: 'coral' },
  { id: 'growth', icon: Activity, eyebrow: '成长事实', title: '成长测量', detail: '体重 kg、身长 cm，参考最近一次', tone: 'sage' },
]

const MORE_CARDS = [
  { id: 'basic', icon: Baby, title: '基础信息', detail: '出生资料、喂养方式、过敏与长期用药' },
  { id: 'illness', icon: Thermometer, title: '生病 / 症状', detail: '只记录看到的表现、时间和测量' },
  { id: 'care', icon: ClipboardList, title: '照护动作', detail: '今日行动、阶段代办和里程碑' },
  { id: 'concern', icon: HeartPulse, title: '关注事项', detail: '创建、跟进和结束一个关注主题' },
  { id: 'professional', icon: FileText, title: '专业记录', detail: '录入医生或专业人员给出的结论' },
  { id: 'questions', icon: CircleHelp, title: '咨询问题', detail: '保存下次想向专业人员确认的问题' },
]

const P0_PANEL_TYPES = new Set(['feeding', 'sleep', 'diaper', 'medication', 'temperature', 'growth'])

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
  return ['type', 'value', 'unit', 'measuredAt', 'source', 'method', 'note'].some((key) => String(previous?.[key] ?? '') !== String(next?.[key] ?? ''))
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
  const initialQuery = new URLSearchParams(window.location.hash.split('?')[1] || '')
  const returnTo = (() => {
    const value = initialQuery.get('returnTo')
    return value && /^#\/(today|growth(?:\/|$))/.test(value) ? value : ROUTES.today
  })()
  const [activePanel, setActivePanel] = useState(() => {
    const panel = initialQuery.get('type') || initialQuery.get('panel')
    return ['illness', 'feeding', 'growth', 'care', 'basic', 'concern', 'professional', 'questions'].includes(panel) ? panel : null
  })
  const [editingEvent, setEditingEvent] = useState(null)
  const [selectedDay, setSelectedDay] = useState(() => localDayKey())
  const [timelineFilter, setTimelineFilter] = useState('')
  const [toast, setToast] = useState('')
  const [entryError, setEntryError] = useState('')
  const ageDays = useMemo(() => getAgeDays(state.baby.birthDate), [state.baby.birthDate])
  const stage = useMemo(() => getStage(ageDays), [ageDays])
  const snapshot = useMemo(() => projectBabyState({ baby: state.baby, events: state.careEvents, concerns: state.concerns }), [state.baby, state.careEvents, state.concerns])
  const dailyTasks = useMemo(() => getDailyTasks(state.taskLogs, undefined, stage.id), [state.taskLogs, stage.id])
  const adminTasks = useMemo(() => getAdminTasks(stage.id, ageDays, state.adminTaskRecords), [stage.id, ageDays, state.adminTaskRecords])
  const milestones = useMemo(() => getStageMilestones(stage.id, state.milestoneRecords), [stage.id, state.milestoneRecords])
  const dailySummary = useMemo(() => getDailyCareSummary(state.careEvents, selectedDay), [state.careEvents, selectedDay])
  const recentGrowth = useMemo(() => {
    const latest = {}
    state.careEvents
      .filter((event) => event.status === 'active' && event.category === 'growth_measurement' && ['weight', 'length'].includes(event.payload?.type))
      .sort((a, b) => new Date(b.payload?.measuredAt || b.occurredAt).getTime() - new Date(a.payload?.measuredAt || a.occurredAt).getTime())
      .forEach((event) => { if (!latest[event.payload.type]) latest[event.payload.type] = event.payload })
    return latest
  }, [state.careEvents])

  function openPanel(panel) {
    setEntryError('')
    setToast('')
    setEditingEvent(null)
    setActivePanel((current) => current === panel ? null : panel)
  }

  function closePanel() {
    setEditingEvent(null)
    setActivePanel(null)
    setEntryError('')
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
      const recordInput = {
        ...input,
        babyId: current.baby.id,
        actor,
        source: input.source || 'caregiver',
        recordedAt: input.recordedAt || now,
        occurredAt: input.occurredAt || now,
      }
      if (P0_PANEL_TYPES.has(input.category) || input.category === 'temperature_observation') assertCareRecordInput(recordInput)
      const event = createCareEvent(recordInput, { now })
      return { ...current, careEvents: [...(current.careEvents || []), event] }
    }, message)
  }

  function saveP0Record(input, message, originalEvent = null) {
    const operation = originalEvent ? correctRecord(originalEvent, input, message) : recordEvent(input, message)
    return operation.then((result) => {
      if (result !== false) {
        closePanel()
        setSelectedDay(localDayKey())
        setTimelineFilter('')
        const query = new URLSearchParams(window.location.hash.split('?')[1] || '')
        if (query.get('return') === 'today') navigate(ROUTES.today)
      }
      return result
    })
  }

  function correctRecord(originalEvent, input, message) {
    return commitWithFeedback((current) => {
      const actor = input.actor || actorFor(current)
      if (!actor?.id || !actor?.displayName) throw new Error(isEnglish ? 'Choose a recorder first.' : '请先选择记录人。')
      const now = input.recordedAt || new Date().toISOString()
      const patch = { ...input, babyId: current.baby.id, actor, source: input.source || 'caregiver', recordedAt: now }
      if (P0_PANEL_TYPES.has(input.category) || input.category === 'temperature_observation') assertCareRecordInput(patch)
      return { ...current, careEvents: correctCareEvent(current.careEvents || [], originalEvent.id, patch, { now }) }
    }, message)
  }

  function voidRecord(event) {
    const title = event.category === 'sleep' ? (isEnglish ? 'sleep interval' : '睡眠区间') : (isEnglish ? 'this fact' : '这条事实')
    const prompt = isEnglish ? `Void ${title}? The audit tombstone will be kept.` : `确认永久作废${title}？历史痕迹会保留。`
    if (typeof globalThis.confirm === 'function' && !globalThis.confirm(prompt)) return Promise.resolve(false)
    return commitWithFeedback((current) => ({
      ...current,
      careEvents: (current.careEvents || []).map((item) => item.id === event.id ? voidCareEvent(item) : item),
    }), isEnglish ? 'Fact voided' : '事实已作废').then((result) => result !== false).catch((error) => {
      setEntryError(error?.message || (isEnglish ? 'Could not void. Retry.' : '作废失败，请重试。'))
      return false
    })
  }

  function editRecord(event) {
    const panel = event.category === 'breastfeeding' || event.category === 'bottle_feeding'
      ? 'feeding'
      : event.category === 'temperature' || event.category === 'temperature_observation'
        ? 'temperature'
        : event.category === 'growth_measurement' ? 'growth' : event.category
    setEntryError('')
    setToast('')
    setEditingEvent(event)
    setActivePanel(panel)
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
      const profileChanged = ['birthDate', 'gestationalWeeks', 'gestationalDays', 'birthMultiplicity'].some((key) => String(current.baby?.[key] ?? '') !== String(nextBaby[key] ?? ''))
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
            <button className="record-back-link" onClick={() => navigate(returnTo)}><ArrowLeft size={15} />{isEnglish ? 'Back' : '返回'}</button>
            <p className="eyebrow">{isEnglish ? 'For new parents' : '新手爸妈记录'}</p>
            <h1>{isEnglish ? 'Record center' : '记录中心'}</h1>
            <p>{isEnglish ? 'Keep the moments you notice today, so your family can look back and share them clearly when needed.' : '把今天看到的宝宝情况记下来，之后自己回看或和家人、医生沟通都更清楚。'}</p>
          </div>
          <div className="record-center-stage"><span>{isEnglish ? 'Current stage' : '当前阶段'}</span><strong>{getStageLabel(stage, locale)}</strong><small>{getStageRangeLabel(stage, locale)} · {isEnglish ? `${ageDays} days old` : `出生后 ${ageDays} 天`}</small></div>
        </header>

        <section className="record-center-notice"><ShieldCheck size={18} /><div><strong>{isEnglish ? 'Start with what you noticed' : '从宝宝今天的日常开始'}</strong><p>{isEnglish ? 'Feeding, sleep, diapers, temperature, growth measurements, and changes worth watching can all be kept here.' : '喂奶、睡眠、尿便、体温、成长测量和需要继续留意的变化，都可以在这里留下。'}</p></div></section>

        <section className="record-card-section" aria-labelledby="record-card-heading">
          <div className="record-section-heading"><div><p className="eyebrow">{isEnglish ? 'Choose one moment' : '记录一件事'}</p><h2 id="record-card-heading">{isEnglish ? 'What did you notice today?' : '今天想记下什么？'}</h2></div><span>{isEnglish ? 'Choose the closest description' : '选择最符合宝宝情况的一项'}</span></div>
          <div className="record-card-grid">{RECORD_CARDS.map((card) => <RecordCard key={card.id} card={card} active={activePanel === card.id} onClick={() => openPanel(card.id)} meta={cardMeta(card.id, state, snapshot, locale, dailySummary)} />)}</div>
        </section>

        {activePanel && P0_PANEL_TYPES.has(activePanel) && <P0RecordComposer key={`${activePanel}:${editingEvent?.id || 'new'}`} type={activePanel} locale={locale} readOnly={readOnly} initialEvent={editingEvent} recentGrowth={recentGrowth} onSave={saveP0Record} onCancel={closePanel} />}

        {activePanel && !P0_PANEL_TYPES.has(activePanel) && <section className="record-entry-sheet" data-testid={`record-entry-${activePanel}`}>
          <header className="record-entry-header"><div><p className="eyebrow">{isEnglish ? 'Add a note' : '补充记录'}</p><h2>{entryTitle(activePanel, isEnglish)}</h2></div><button className="record-close" type="button" onClick={() => setActivePanel(null)} aria-label={isEnglish ? 'Close' : '关闭'}><X size={18} /></button></header>
          {activePanel === 'basic' && <BasicInfoPanel baby={state.baby} birthMeasurements={state.growthMeasurements} locale={locale} readOnly={readOnly} onSave={updateProfile} />}
          {activePanel === 'illness' && <IllnessPanel locale={locale} readOnly={readOnly} onRecord={recordEvent} />}
        </section>}

        <section className="record-state-strip" aria-label={isEnglish ? 'Calculated state' : '自动整理的当前状态'}>
          <div><span>{isEnglish ? 'Recorded in last 24h' : '最近 24 小时有记录'}</span><strong>{snapshot.recent24h.sourceEventIds.length}</strong></div>
          <div><span>{isEnglish ? 'Feeding facts' : '喂奶事实'}</span><strong>{currentCount(snapshot, 'feeding.count') || '—'}</strong></div>
          <div><span>{isEnglish ? 'Open follow-up' : '进行中的关注'}</span><strong>{snapshot.activeProblems.length || '—'}</strong></div>
          <div><span>{isEnglish ? 'Unknown domains' : '尚未记录的领域'}</span><strong>{snapshot.current.unknown.length || '—'}</strong></div>
        </section>

        <section className="record-daily-summary" aria-labelledby="record-daily-summary-heading">
          <div className="record-section-heading"><div><p className="eyebrow">{isEnglish ? 'Selected day' : '所选日期'}</p><h2 id="record-daily-summary-heading">{selectedDay}</h2></div><span>{isEnglish ? 'Only active facts are counted' : '只统计当前有效事实'}</span></div>
          <div className="record-daily-summary-grid">
            <DailySummaryMetric label={isEnglish ? 'Feeds' : '喂奶'} value={dailySummary.feeding.totalCount || '—'} detail={dailySummary.feeding.bottleMl ? `${dailySummary.feeding.bottleMl} mL` : ''} />
            <DailySummaryMetric label={isEnglish ? 'Sleep' : '睡眠'} value={dailySummary.sleep.segmentCount || '—'} detail={dailySummary.sleep.minutes ? `${dailySummary.sleep.minutes} min` : ''} />
            <DailySummaryMetric label={isEnglish ? 'Diapers' : '尿布'} value={dailySummary.diaper.totalCount || '—'} detail={`${dailySummary.diaper.wetCount}/${dailySummary.diaper.stoolCount}`} />
            <DailySummaryMetric label={isEnglish ? 'Medication' : '用药'} value={dailySummary.medication.count || '—'} detail="" />
          </div>
        </section>

        <DailyCareTimeline events={state.careEvents} locale={locale} selectedDay={selectedDay} filter={timelineFilter} onDayChange={setSelectedDay} onFilterChange={setTimelineFilter} onEdit={editRecord} onVoid={voidRecord} readOnly={readOnly} />

        <section className="record-card-section record-more-section" aria-labelledby="record-more-heading">
          <div className="record-section-heading"><div><p className="eyebrow">{isEnglish ? 'More to add' : '还可以记录'}</p><h2 id="record-more-heading">{isEnglish ? 'Other moments worth keeping' : '其他想留下的宝宝情况'}</h2></div><span>{isEnglish ? 'Keep related moments together' : '把相关情况放在一起，更方便回看'}</span></div>
          <div className="record-more-grid">{MORE_CARDS.map((card) => { const Icon = card.icon; return <button key={card.id} className={`record-more-card ${activePanel === card.id ? 'active' : ''}`} type="button" onClick={() => openPanel(card.id)}><span className="record-more-icon"><Icon size={17} /></span><span><strong>{isEnglish ? moreTitle(card.id) : card.title}</strong><small>{isEnglish ? moreDetail(card.id) : card.detail}</small></span><ChevronRight size={16} /></button> })}</div>
        </section>

          {activePanel === 'care' && <RecordSubsection title={isEnglish ? 'Care actions' : '照护动作'} onClose={() => setActivePanel(null)}><div className="record-subsection-stack"><CareTaskList tasks={dailyTasks} locale={locale} onUpdate={updateTask} readOnly={readOnly} /><AdminTaskList tasks={adminTasks} locale={locale} onUpdate={updateAdminTask} readOnly={readOnly} /><MilestonePanel milestones={milestones} locale={locale} readOnly={readOnly} onUpdate={updateMilestone} /></div></RecordSubsection>}
          {activePanel === 'concern' && <RecordSubsection title={isEnglish ? 'Follow-up topics' : '关注事项'} onClose={() => setActivePanel(null)}><ConcernSupport locale={locale} concerns={state.concerns} onCreate={createConcern} onResolve={resolveConcern} readOnly={readOnly} /></RecordSubsection>}
          {activePanel === 'professional' && <RecordSubsection title={isEnglish ? 'Professional record' : '专业记录'} onClose={() => setActivePanel(null)}><ProfessionalPanel locale={locale} readOnly={readOnly} onRecord={recordEvent} /></RecordSubsection>}
          {activePanel === 'questions' && <RecordSubsection title={isEnglish ? 'Questions for a clinician' : '咨询问题'} onClose={() => setActivePanel(null)}><QuestionPanel questions={state.questions} locale={locale} readOnly={readOnly} onSave={saveQuestions} /></RecordSubsection>}

        {(toast || entryError) && <div className={`record-toast ${entryError ? 'error' : ''}`} role={entryError ? 'alert' : 'status'}>{entryError || toast}</div>}
        <footer className="record-center-footer"><Clock3 size={15} /><span>{isEnglish ? 'You can switch the recorder in the header; older entries keep their original name.' : '顶部可以切换记录人；之前的记录会保留原记录人。'}</span><button type="button" onClick={() => navigate(ROUTES.summary)}>{isEnglish ? 'Care summary' : '就医摘要'}<ChevronRight size={15} /></button></footer>
      </div>
    </main>
  )
}

function RecordCard({ card, active, onClick, meta }) {
  const Icon = card.icon
  return <button type="button" className={`record-card ${card.tone} ${active ? 'active' : ''}`} onClick={onClick} aria-expanded={active}><span className="record-card-icon"><Icon size={21} /></span><span className="record-card-copy"><small>{card.eyebrow}</small><strong>{card.title}</strong><em>{card.detail}</em>{meta && <b>{meta}</b>}</span><ChevronRight className="record-card-arrow" size={18} /></button>
}

function DailySummaryMetric({ label, value, detail }) {
  return <div className="record-daily-summary-card"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>
}

function cardMeta(id, state, snapshot, locale, dailySummary) {
  const isEnglish = locale === 'en-US'
  if (id === 'basic') return state.baby?.nickname || (isEnglish ? 'Profile incomplete' : '档案待补充')
  if (id === 'feeding') return `${dailySummary?.feeding.totalCount || 0} ${isEnglish ? 'on selected day' : '所选日期'}`
  if (id === 'sleep') return `${dailySummary?.sleep.segmentCount || 0} ${isEnglish ? 'intervals' : '个区间'}`
  if (id === 'diaper') return `${dailySummary?.diaper.totalCount || 0} ${isEnglish ? 'on selected day' : '所选日期'}`
  if (id === 'illness') return `${snapshot.current.known.filter((fact) => fact.dimension === 'illness').length || 0} ${isEnglish ? 'current observations' : '条当前观察'}`
  if (id === 'medication') return `${dailySummary?.medication.count || 0} ${isEnglish ? 'on selected day' : '所选日期'}`
  if (id === 'temperature') return `${dailySummary?.temperature.count || 0} ${isEnglish ? 'on selected day' : '所选日期'}`
  if (id === 'growth') return `${dailySummary?.growth.count || 0} ${isEnglish ? 'on selected day' : '所选日期'}`
  return ''
}

function entryTitle(id, isEnglish) {
  return {
    basic: isEnglish ? 'Baby profile' : '基础信息',
    feeding: isEnglish ? 'Feeding' : '喂奶',
    sleep: isEnglish ? 'Sleep interval' : '睡眠区间',
    diaper: isEnglish ? 'Diaper' : '尿布',
    illness: isEnglish ? 'Illness / symptoms' : '生病 / 症状',
    medication: isEnglish ? 'Medication' : '用药',
    temperature: isEnglish ? 'Temperature' : '体温',
    growth: isEnglish ? 'Growth measurement' : '成长测量',
  }[id] || id
}

function moreTitle(id) {
  return { basic: 'Baby profile', illness: 'Illness / symptoms', care: 'Care actions', concern: 'Follow-up topics', professional: 'Professional record', questions: 'Questions for a clinician' }[id]
}

function moreDetail(id) {
  return { basic: 'Birth details and profile facts', illness: 'Observed symptoms and measured facts', care: 'Daily actions, errands, and milestones', concern: 'Open, track, and close a topic', professional: 'Clinician conclusions and instructions', questions: 'Keep questions for the next professional conversation' }[id]
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
  return <form className="record-form" onSubmit={submit}><p className="record-form-lede">{isEnglish ? 'Profile facts are used as background context. Leave a field blank when you do not know it.' : '这些内容只作为稳定背景。不了解的字段可以留空，系统不会替你猜测。'}</p><fieldset disabled={readOnly || saving}><div className="form-grid two"><label>{isEnglish ? 'Nickname' : '宝宝昵称'}<input value={form.nickname} onChange={(event) => change('nickname', event.target.value)} required /></label><label>{isEnglish ? 'Birth date' : '出生日期'}<input type="date" value={form.birthDate} onChange={(event) => change('birthDate', event.target.value)} required /></label></div><div className="form-grid three"><label>{isEnglish ? 'Gestational weeks' : '出生孕周'}<input type="number" min="20" max="44" value={form.gestationalWeeks} onChange={(event) => change('gestationalWeeks', event.target.value)} /></label><label>{isEnglish ? 'Extra days' : '孕周余天'}<input type="number" min="0" max="6" value={form.gestationalDays} onChange={(event) => change('gestationalDays', event.target.value)} /></label><label>{isEnglish ? 'Birth type' : '出生情况'}<select value={form.birthMultiplicity} onChange={(event) => change('birthMultiplicity', event.target.value)}><option value="singleton">{isEnglish ? 'Singleton' : '单胎'}</option><option value="multiple">{isEnglish ? 'Multiple birth' : '多胎'}</option></select></label></div><fieldset className="record-inline-fieldset"><legend>{isEnglish ? 'Profile details' : '档案细节'}</legend><div className="form-grid three"><label>{isEnglish ? 'Sex' : '性别'}<select value={form.sex} onChange={(event) => change('sex', event.target.value)}><option value="">{isEnglish ? 'Not set' : '未设置'}</option><option value="male">{isEnglish ? 'Boy' : '男孩'}</option><option value="female">{isEnglish ? 'Girl' : '女孩'}</option></select></label><label>{isEnglish ? 'Feeding mode' : '喂养方式'}<select value={form.feedingMode} onChange={(event) => change('feedingMode', event.target.value)}><option value="breastfeeding">{isEnglish ? 'Breastfeeding' : '母乳喂养'}</option><option value="formula">{isEnglish ? 'Formula' : '配方奶喂养'}</option><option value="mixed">{isEnglish ? 'Mixed' : '混合喂养'}</option><option value="other">{isEnglish ? 'Other / unknown' : '其他 / 未确定'}</option></select></label></div></fieldset><fieldset className="record-inline-fieldset"><legend>{isEnglish ? 'Birth measurements' : '出生测量'}</legend><div className="form-grid three"><label>{isEnglish ? 'Weight (kg)' : '体重（kg）'}<input type="number" min="0" max="20" step="0.01" inputMode="decimal" value={form.birthWeight} onChange={(event) => change('birthWeight', event.target.value)} /></label><label>{isEnglish ? 'Length (cm)' : '身长（cm）'}<input type="number" min="0" max="100" step="0.1" inputMode="decimal" value={form.birthLength} onChange={(event) => change('birthLength', event.target.value)} /></label><label>{isEnglish ? 'Head circumference (cm)' : '头围（cm）'}<input type="number" min="0" max="70" step="0.1" inputMode="decimal" value={form.birthHeadCircumference} onChange={(event) => change('birthHeadCircumference', event.target.value)} /></label></div></fieldset><div className="form-grid three"><label>{isEnglish ? 'Past history' : '既往史'}<textarea rows="2" value={form.medicalHistory} onChange={(event) => change('medicalHistory', event.target.value)} placeholder={isEnglish ? 'Optional factual note' : '可填写已知事实'} /></label><label>{isEnglish ? 'Allergies' : '过敏信息'}<textarea rows="2" value={form.allergies} onChange={(event) => change('allergies', event.target.value)} placeholder={isEnglish ? 'Unknown is okay' : '不确定可以留空'} /></label><label>{isEnglish ? 'Long-term medicines' : '长期用药'}<textarea rows="2" value={form.longTermMedications} onChange={(event) => change('longTermMedications', event.target.value)} placeholder={isEnglish ? 'Name and factual note' : '药名和已知事实'} /></label></div></fieldset>{formError && <p className="save-error" role="alert">{formError}</p>}{!readOnly && <PanelActions locale={locale} saving={saving} onCancel={() => { setForm(initialForm()); setFormError('') }} />}</form>
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
