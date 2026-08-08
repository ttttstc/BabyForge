import { useMemo, useState } from 'react'
import { CalendarDays, Droplets, Edit3, Save, Trash2, Utensils, X } from 'lucide-react'
import { eventFacts, eventTitle, formatDurationMinutes, getLocalDayEvents, localDayKey } from '../domain/careSummary.js'
import { GROWTH_SOURCES, growthSourceLabel } from '../domain/growth.js'
import { GROWTH_TYPES } from '../domain/carePlan.js'

const TYPE_LABELS = {
  feeding: { zh: '喂养', en: 'Feeding' },
  sleep: { zh: '睡眠', en: 'Sleep' },
  diaper: { zh: '尿布', en: 'Diaper' },
  medication: { zh: '用药', en: 'Medication' },
  temperature: { zh: '体温', en: 'Temperature' },
  growth: { zh: '成长', en: 'Growth' },
}

const TIMELINE_FILTERS = [
  ['', { zh: '全部', en: 'All' }],
  ['breastfeeding', { zh: '亲喂', en: 'Breastfeed' }],
  ['bottle_feeding', { zh: '瓶喂', en: 'Bottle feed' }],
  ['sleep', { zh: '睡眠', en: 'Sleep' }],
  ['diaper', { zh: '尿布', en: 'Diaper' }],
  ['medication', { zh: '用药', en: 'Medication' }],
  ['temperature', { zh: '体温', en: 'Temperature' }],
  ['temperature_observation', { zh: '体温观察', en: 'Temperature observation' }],
  ['growth_measurement', { zh: '成长', en: 'Growth' }],
]

const P0_CATEGORIES = new Set(['breastfeeding', 'bottle_feeding', 'sleep', 'diaper', 'medication', 'temperature', 'temperature_observation', 'growth_measurement'])

function text(value, locale) {
  return value?.[locale === 'en-US' ? 'en' : 'zh'] || value?.zh || value || ''
}

function nowInputValue(offsetMinutes = 0) {
  const date = new Date(Date.now() + offsetMinutes * 60_000)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function localInputValue(value, fallback = nowInputValue()) {
  const date = new Date(value || '')
  if (Number.isNaN(date.getTime())) return fallback
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function isoValue(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function initialForm(type, event, recentGrowth = {}, initialGrowthType = null) {
  const payload = event?.payload || {}
  if (type === 'feeding') {
    const mode = event?.category === 'breastfeeding'
      ? 'breastfeeding'
      : payload.milkType === 'breast_milk' ? 'bottle_breast_milk' : 'bottle_formula'
    return { mode, occurredAt: localInputValue(event?.occurredAt), amountMl: payload.amountMl ?? 50 }
  }
  if (type === 'sleep') return { start: localInputValue(event?.occurredAt, nowInputValue(-60)), end: localInputValue(payload.endedAt, nowInputValue()) }
  if (type === 'diaper') return { kind: payload.kind || 'urine', occurredAt: localInputValue(event?.occurredAt) }
  if (type === 'medication') return { name: payload.medicationName || payload.name || '', amount: payload.amount || '', unit: payload.unit || 'mg', route: payload.route || '', occurredAt: localInputValue(event?.occurredAt), note: payload.note || '' }
  if (type === 'temperature') return { value: payload.value ?? (event ? '' : '36.5'), unit: payload.unit || '°C', method: payload.method || (event ? '' : 'axillary'), occurredAt: localInputValue(event?.occurredAt) }
  const growthType = GROWTH_TYPES.some((item) => item.id === payload.type)
    ? payload.type
    : GROWTH_TYPES.some((item) => item.id === initialGrowthType) ? initialGrowthType : 'weight'
  return { type: growthType, value: payload.value ?? recentGrowth[growthType]?.value ?? '', measuredAt: String(payload.measuredAt || event?.occurredAt || localDayKey()).slice(0, 10), source: payload.source || 'caregiver_observation' }
}

function saveErrorMessage(error, locale) {
  return error?.message || (locale === 'en-US' ? 'Save failed. Retry.' : '保存失败，请重试。')
}

export function P0RecordComposer({ type, locale = 'zh-CN', readOnly = false, initialEvent = null, recentGrowth = {}, initialGrowthType = null, onSave, onCancel }) {
  const isEnglish = locale === 'en-US'
  const [form, setForm] = useState(() => initialForm(type, initialEvent, recentGrowth, initialGrowthType))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const editing = Boolean(initialEvent)
  const isObservationCorrection = editing && initialEvent.category === 'temperature_observation'

  const label = text(TYPE_LABELS[type], locale)
  function change(key, value) {
    setError('')
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function save(input, message) {
    setError('')
    setSaving(true)
    try {
      await onSave?.(input, message, initialEvent)
      if (!editing) setForm(initialForm(type, null, recentGrowth, initialGrowthType))
    } catch (saveError) {
      setError(saveErrorMessage(saveError, locale))
      throw saveError
    } finally {
      setSaving(false)
    }
  }

  async function saveFeeding(mode = form.mode) {
    const isBreast = mode === 'breastfeeding'
    await save({
      kind: 'caregiver_observation',
      category: isBreast ? 'breastfeeding' : 'bottle_feeding',
      occurredAt: isoValue(form.occurredAt),
      payload: isBreast ? {} : { milkType: mode === 'bottle_breast_milk' ? 'breast_milk' : 'formula', amountMl: Number(form.amountMl), unit: 'mL' },
    }, isEnglish ? 'Feeding saved' : '喂养已保存')
  }

  async function saveDiaper(kind = form.kind) {
    await save({ kind: 'caregiver_observation', category: 'diaper', occurredAt: isoValue(form.occurredAt), payload: { kind } }, isEnglish ? 'Diaper saved' : '尿布已保存')
  }

  async function submit(event) {
    event.preventDefault()
    if (type === 'feeding') return saveFeeding()
    if (type === 'diaper') return saveDiaper()
    if (type === 'sleep') {
      return save({ kind: 'caregiver_observation', category: 'sleep', occurredAt: isoValue(form.start), payload: { endedAt: isoValue(form.end) } }, isEnglish ? 'Sleep saved' : '睡眠已保存')
    }
    if (type === 'medication') {
      return save({ kind: 'caregiver_observation', category: 'medication', occurredAt: isoValue(form.occurredAt), payload: { medicationName: form.name.trim(), amount: form.amount.trim(), unit: form.unit, route: form.route.trim(), note: form.note.trim() } }, isEnglish ? 'Medication saved' : '用药已保存')
    }
    if (type === 'temperature') {
      const hasValue = !isObservationCorrection && String(form.value).trim() !== ''
      return save({ kind: hasValue ? 'measurement' : 'caregiver_observation', category: isObservationCorrection ? 'temperature_observation' : hasValue ? 'temperature' : 'temperature_observation', occurredAt: isoValue(form.occurredAt), payload: hasValue ? { value: Number(form.value), unit: form.unit, method: form.method } : { method: form.method } }, isEnglish ? 'Temperature saved' : '体温已保存')
    }
    const definition = GROWTH_TYPES.find((item) => item.id === form.type)
    return save({ kind: 'measurement', category: 'growth_measurement', occurredAt: `${form.measuredAt}T12:00:00`, payload: { type: form.type, value: String(form.value).trim(), unit: definition.unit, measuredAt: form.measuredAt, source: form.source } }, isEnglish ? 'Growth saved' : '成长测量已保存')
  }

  function renderHeader() {
    return <header className="record-entry-header"><div><p className="eyebrow">{editing ? (isEnglish ? 'Correct fact' : '纠正事实') : (isEnglish ? 'Quick record' : '快速记录')}</p><h2>{label}</h2></div><button className="record-close" type="button" onClick={onCancel} aria-label={isEnglish ? 'Close' : '关闭'}><X size={18} /></button></header>
  }

  if (type === 'feeding') {
    return <section className="record-entry-sheet p0-record-entry" data-testid="record-entry-feeding">{renderHeader()}<p className="record-form-lede">{isEnglish ? 'Breastfeed saves immediately. Bottle feed records actual amount.' : '亲喂直接保存；瓶喂记录实际喝下奶量。'}</p><div className="record-choice-grid"><button type="button" disabled={readOnly || saving} onClick={() => saveFeeding('breastfeeding')}><Utensils size={17} />{isEnglish ? 'Breastfeed' : '亲喂'}</button><button type="button" className={form.mode === 'bottle_breast_milk' ? 'selected' : ''} disabled={readOnly || saving} onClick={() => change('mode', 'bottle_breast_milk')}><Utensils size={17} />{isEnglish ? 'Expressed milk' : '母乳瓶喂'}</button><button type="button" className={form.mode === 'bottle_formula' ? 'selected' : ''} disabled={readOnly || saving} onClick={() => change('mode', 'bottle_formula')}><Utensils size={17} />{isEnglish ? 'Formula' : '配方奶'}</button></div>{form.mode !== 'breastfeeding' && <form className="record-form" onSubmit={submit}><fieldset disabled={readOnly || saving}><label>{isEnglish ? 'Actual amount (mL)' : '实际喝下奶量（mL）'}<input autoFocus type="number" min="0" step="1" inputMode="decimal" value={form.amountMl} onChange={(event) => change('amountMl', event.target.value)} required /></label><label>{isEnglish ? 'Occurred at' : '发生时间'}<input type="datetime-local" value={form.occurredAt} onChange={(event) => change('occurredAt', event.target.value)} required /></label></fieldset><FormActions locale={locale} saving={saving} onCancel={onCancel} /></form>}{error && <p className="save-error" role="alert">{error}</p>}</section>
  }

  if (type === 'diaper') {
    return <section className="record-entry-sheet p0-record-entry" data-testid="record-entry-diaper">{renderHeader()}<p className="record-form-lede">{isEnglish ? 'Choose what you saw. Normal diaper records need no extra text.' : '选择实际看到的情况，正常尿布记录不需要补充文字。'}</p><div className="record-choice-grid"><button type="button" disabled={readOnly || saving} onClick={() => saveDiaper('urine')}><Droplets size={17} />{isEnglish ? 'Urine' : '只有尿'}</button><button type="button" disabled={readOnly || saving} onClick={() => saveDiaper('stool')}><Droplets size={17} />{isEnglish ? 'Stool' : '只有便'}</button><button type="button" disabled={readOnly || saving} onClick={() => saveDiaper('both')}><Droplets size={17} />{isEnglish ? 'Both' : '尿和便'}</button></div><form className="record-form" onSubmit={submit}><fieldset disabled={readOnly || saving}><label>{isEnglish ? 'Occurred at' : '发生时间'}<input type="datetime-local" value={form.occurredAt} onChange={(event) => change('occurredAt', event.target.value)} required /></label></fieldset><FormActions locale={locale} saving={saving} onCancel={onCancel} /></form>{error && <p className="save-error" role="alert">{error}</p>}</section>
  }

  return <section className="record-entry-sheet p0-record-entry" data-testid={`record-entry-${type}`}>{renderHeader()}<form className="record-form" onSubmit={submit}><fieldset disabled={readOnly || saving}>{type === 'sleep' && <div className="form-grid two"><label>{isEnglish ? 'Start' : '开始时间'}<input type="datetime-local" value={form.start} onChange={(event) => change('start', event.target.value)} required /></label><label>{isEnglish ? 'End' : '结束时间'}<input type="datetime-local" value={form.end} onChange={(event) => change('end', event.target.value)} required /></label></div>}{type === 'medication' && <><div className="form-grid two"><label>{isEnglish ? 'Medicine name' : '药品名称'}<input value={form.name} onChange={(event) => change('name', event.target.value)} required /></label><label>{isEnglish ? 'Occurred at' : '发生时间'}<input type="datetime-local" value={form.occurredAt} onChange={(event) => change('occurredAt', event.target.value)} required /></label></div><div className="form-grid three"><label>{isEnglish ? 'Amount' : '实际用量'}<input inputMode="decimal" value={form.amount} onChange={(event) => change('amount', event.target.value)} /></label><label>{isEnglish ? 'Unit' : '单位'}<select value={form.unit} onChange={(event) => change('unit', event.target.value)}><option>mg</option><option>mL</option><option>tablet</option><option>滴</option><option>{isEnglish ? 'Other' : '其他'}</option></select></label><label>{isEnglish ? 'Route' : '使用方式'}<input value={form.route} onChange={(event) => change('route', event.target.value)} /></label></div></>}{type === 'temperature' && <><div className="form-grid two"><label>{isEnglish ? 'Value (optional)' : '数值（可选）'}<input inputMode="decimal" readOnly={isObservationCorrection} value={form.value} onChange={(event) => change('value', event.target.value)} /><small>{isObservationCorrection ? (isEnglish ? 'An observation correction stays a no-value fact.' : '体温观察纠正仍保留为无数值事实。') : isEnglish ? 'Blank means value not recorded.' : '留空表示数值未记录。'}</small></label><label>{isEnglish ? 'Occurred at' : '测量时间'}<input type="datetime-local" value={form.occurredAt} onChange={(event) => change('occurredAt', event.target.value)} required /></label></div><div className="form-grid two"><label>{isEnglish ? 'Unit' : '单位'}<select value={form.unit} onChange={(event) => change('unit', event.target.value)}><option>°C</option><option>°F</option></select></label><label>{isEnglish ? 'Method / site' : '测量部位 / 方法'}<select value={form.method} required={String(form.value).trim() !== '' && !isObservationCorrection} onChange={(event) => change('method', event.target.value)}><option value="">{isEnglish ? 'Not specified' : '未填写'}</option><option value="axillary">{isEnglish ? 'Armpit' : '腋下'}</option><option value="forehead">{isEnglish ? 'Forehead' : '额头'}</option><option value="ear">{isEnglish ? 'Ear' : '耳温'}</option><option value="rectal">{isEnglish ? 'Rectal' : '肛温'}</option><option value="other">{isEnglish ? 'Other' : '其他'}</option></select></label></div></>}{type === 'growth' && <div className="form-grid three"><label>{isEnglish ? 'Type' : '类型'}<select value={form.type} onChange={(event) => { const value = event.target.value; change('type', value); change('value', '') }}>{GROWTH_TYPES.filter((item) => ['weight', 'length', 'headCircumference'].includes(item.id)).map((item) => <option key={item.id} value={item.id}>{text(item.label, locale)}</option>)}</select></label><label>{isEnglish ? 'Value' : '数值'}<input inputMode="decimal" value={form.value} onChange={(event) => change('value', event.target.value)} required /><small>{GROWTH_TYPES.find((item) => item.id === form.type)?.unit}</small></label><label>{isEnglish ? 'Measured at' : '测量日期'}<input type="date" value={form.measuredAt} onChange={(event) => change('measuredAt', event.target.value)} required /></label><label>{isEnglish ? 'Source' : '来源'}<select value={form.source} onChange={(event) => change('source', event.target.value)}>{GROWTH_SOURCES.map((item) => <option key={item} value={item}>{growthSourceLabel(item, locale)}</option>)}</select></label></div>}{type === 'sleep' && <p className="record-form-lede">{isEnglish ? 'Save one completed interval. BabyForge does not infer sleep state.' : '一次保存已经确认的完整区间，系统不推断宝宝当前是否在睡。'}</p>}{type === 'medication' && <label>{isEnglish ? 'Factual note' : '事实备注'}<textarea rows="2" value={form.note} onChange={(event) => change('note', event.target.value)} /></label>}</fieldset>{error && <p className="save-error" role="alert">{error}</p>}<FormActions locale={locale} saving={saving} onCancel={onCancel} /></form></section>
}

function FormActions({ locale, saving, onCancel }) {
  const isEnglish = locale === 'en-US'
  return <div className="record-panel-actions"><button type="button" className="secondary-button compact" onClick={onCancel}>{isEnglish ? 'Cancel' : '取消'}</button><button type="submit" className="primary-button compact" disabled={saving}><Save size={15} />{saving ? (isEnglish ? 'Saving…' : '保存中…') : (isEnglish ? 'Save fact' : '保存事实')}</button></div>
}

export function DailyCareTimeline({ events = [], locale = 'zh-CN', selectedDay = localDayKey(), filter = '', onDayChange, onFilterChange, onEdit, onVoid, readOnly = false }) {
  const isEnglish = locale === 'en-US'
  const dayEvents = useMemo(() => getLocalDayEvents(events, selectedDay, filter), [events, selectedDay, filter])
  const dateLabel = new Date(`${selectedDay}T12:00:00`).toLocaleDateString(isEnglish ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
  return <section className="record-timeline-section" data-testid="care-timeline"><header className="record-timeline-header"><div><p className="eyebrow">{isEnglish ? 'Fact timeline' : '事实时间线'}</p><h2>{dateLabel}</h2></div><CalendarDays size={19} /></header><div className="record-timeline-controls"><label>{isEnglish ? 'Date' : '日期'}<input type="date" value={selectedDay} onChange={(event) => onDayChange?.(event.target.value)} /></label><label>{isEnglish ? 'Type' : '类型'}<select value={filter} onChange={(event) => onFilterChange?.(event.target.value)}>{TIMELINE_FILTERS.map(([value, item]) => <option key={value || 'all'} value={value}>{text(item, locale)}</option>)}</select></label></div>{dayEvents.length === 0 ? <p className="record-timeline-empty">{isEnglish ? 'No saved facts for this date.' : '这一天还没有已保存的事实。'}</p> : <div className="record-timeline-list">{dayEvents.map((event) => { const canEdit = !readOnly && P0_CATEGORIES.has(event.category); const title = eventTitle(event, locale); return <article className="record-timeline-item" key={event.id}><div className="record-timeline-time"><strong>{formatTimelineTime(event, locale)}</strong><small>{event.actor?.displayName || (isEnglish ? 'Caregiver' : '照护者')}</small></div><div className="record-timeline-copy"><strong>{title}</strong><small>{eventFacts(event, locale)}{event.category === 'sleep' && event.payload?.endedAt ? ` · ${formatDurationMinutes((new Date(event.payload.endedAt).getTime() - new Date(event.occurredAt).getTime()) / 60_000, locale)}` : ''}</small></div>{canEdit && <div className="record-timeline-actions"><button type="button" onClick={() => onEdit?.(event)} aria-label={`${isEnglish ? 'Correct' : '纠正'} ${title}`}><Edit3 size={14} />{isEnglish ? 'Correct' : '纠正'}</button><button type="button" onClick={() => onVoid?.(event)} aria-label={`${isEnglish ? 'Void' : '作废'} ${title}`}><Trash2 size={14} />{isEnglish ? 'Void' : '作废'}</button></div>}</article> })}</div>}</section>
}

function formatTimelineTime(event, locale) {
  const isEnglish = locale === 'en-US'
  const start = new Date(event.occurredAt || event.createdAt)
  if (event.category === 'sleep' && event.payload?.endedAt) {
    const end = new Date(event.payload.endedAt)
    return `${start.toLocaleTimeString(isEnglish ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit' })}–${end.toLocaleTimeString(isEnglish ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  }
  return start.toLocaleTimeString(isEnglish ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit' })
}
