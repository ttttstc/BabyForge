import { createCareEvent } from './careEvents.js'

export const CARE_EVENT_DRAFT_VERSION = 'care-event-draft-2026-08-07'

const RECORD_HINT = /记录|保存|录入|帮我|实际|刚(?:刚)?|刚才|喝了|喂了|换了|测了|量了/i
const FEEDING_HINT = /奶|喂|母乳|亲喂|配方|奶粉|瓶喂|喝/i
const DIAPER_HINT = /尿布|湿尿|尿尿|大便|便便|尿和便|尿便/i
const SYMPTOM_HINT = /发热|发烧|咳嗽|呕吐|腹泻|皮疹|呼吸|发青|叫不醒|症状/i

function numberMatch(value, pattern) {
  const match = String(value || '').match(pattern)
  if (!match) return null
  const number = Number(match[1])
  return Number.isFinite(number) ? number : null
}

function amountFrom(text) {
  return numberMatch(text, /(?:喝了|喂了|摄入|奶量|奶粉|配方奶|瓶喂)?[^\d]{0,18}(\d+(?:\.\d+)?)\s*(?:mL|ml|毫升)/i)
}

function temperatureFrom(text) {
  const value = numberMatch(text, /(?:体温|温度)[^\d]{0,10}(\d{2}(?:\.\d+)?)/i) ?? numberMatch(text, /^(\d{2}(?:\.\d+)?)\s*(?:°?C|℃|°?F|℉)?$/i)
  if (value === null || value < 30 || value > 45) return null
  const unit = /华氏|°F|℉/i.test(text) ? '°F' : '°C'
  return { value, unit }
}

function growthFrom(text) {
  const definitions = [
    { type: 'weight', pattern: /(?:体重|重量)[^\d]{0,10}(\d+(?:\.\d+)?)\s*(?:kg|公斤|千克)/i, unit: 'kg', label: '体重' },
    { type: 'length', pattern: /(?:身长|身高)[^\d]{0,10}(\d+(?:\.\d+)?)\s*(?:cm|厘米)/i, unit: 'cm', label: '身长' },
    { type: 'headCircumference', pattern: /(?:头围)[^\d]{0,10}(\d+(?:\.\d+)?)\s*(?:cm|厘米)/i, unit: 'cm', label: '头围' },
  ]
  for (const definition of definitions) {
    const value = numberMatch(text, definition.pattern)
    if (value !== null) return { ...definition, value }
  }
  return null
}

function eventDraft({ baby, actor, category, payload, kind = 'caregiver_observation', title, summary, now }) {
  const event = createCareEvent({
    babyId: baby?.id,
    kind,
    category,
    occurredAt: now,
    recordedAt: now,
    actor,
    source: 'caregiver',
    payload,
  }, { now })
  return {
    type: 'care_event',
    version: CARE_EVENT_DRAFT_VERSION,
    status: 'draft_ready',
    title,
    summary,
    event,
    needsConfirmation: true,
    occurredAtSource: 'message_entry_time',
  }
}

function missingDraft({ category, question, title = '照护事实记录', now }) {
  return {
    type: 'care_event',
    version: CARE_EVENT_DRAFT_VERSION,
    status: 'needs_information',
    category,
    title,
    question,
    occurredAtSource: 'message_entry_time',
    occurredAt: now,
  }
}

function parseDiaper(text) {
  if (/尿和便|尿便|大小便/i.test(text)) return 'both'
  if (/大便|便便|便/i.test(text)) return 'stool'
  if (/尿布|湿尿|尿尿|尿/i.test(text)) return 'urine'
  return null
}

function parseSymptoms(text) {
  const options = [
    ['fever', /发热|发烧/],
    ['cough', /咳嗽/],
    ['vomiting', /呕吐/],
    ['diarrhea', /腹泻/],
    ['rash', /皮疹/],
    ['breathing', /呼吸/],
    ['blue_lips', /发青|蓝唇|嘴唇青/],
    ['unresponsive', /叫不醒|无法唤醒/],
  ]
  return options.filter(([, pattern]) => pattern.test(text)).map(([id]) => id)
}

export function isCareEventDraftIntent(message = '') {
  const text = String(message || '')
  return (RECORD_HINT.test(text) && (FEEDING_HINT.test(text) || DIAPER_HINT.test(text) || SYMPTOM_HINT.test(text) || /体温|温度|体重|身长|头围/i.test(text)))
    || /刚(?:刚)?(?:喂|喝|换|测|量)|实际喝下|实际摄入/i.test(text)
}

export function parseCareEventDraft({ message = '', baby, actor, context = null, now = new Date().toISOString(), locale = 'zh-CN' } = {}) {
  const text = String(message || '').trim()
  const isEnglish = locale === 'en-US'
  if (!text && !context) return { status: 'unsupported', reason: 'empty_message' }

  const amount = amountFrom(text)
  const feeding = FEEDING_HINT.test(text) || context?.category === 'bottle_feeding'
  if (feeding && (amount !== null || /亲喂|母乳/i.test(text) || context?.category === 'breastfeeding')) {
    if (amount !== null) {
      return eventDraft({ baby, actor, category: 'bottle_feeding', payload: { amountMl: amount, unit: 'mL', note: text }, title: isEnglish ? 'Bottle-feeding fact' : '瓶喂事实', summary: isEnglish ? `${amount} mL bottle feed` : `瓶喂 ${amount} mL`, now })
    }
    return eventDraft({ baby, actor, category: 'breastfeeding', payload: { mode: 'breastfeeding', note: text }, title: isEnglish ? 'Breastfeeding fact' : '亲喂事实', summary: isEnglish ? 'Breastfeeding occurred; no mL estimate' : '发生了亲喂，不估算毫升数', now })
  }
  if (feeding && (isCareEventDraftIntent(text) || context?.category)) {
    return missingDraft({ category: 'bottle_feeding', title: isEnglish ? 'Feeding fact' : '喂养事实', question: isEnglish ? 'How much did the baby actually take, or was this breastfeeding?' : '宝宝实际喝下多少？如果是亲喂，请直接说明“亲喂”；不要把推荐量当成实际摄入。', now })
  }

  const diaper = parseDiaper(text)
  if (diaper && (isCareEventDraftIntent(text) || context?.category === 'diaper')) {
    return eventDraft({ baby, actor, category: 'diaper', payload: { kind: diaper, note: text }, title: isEnglish ? 'Diaper fact' : '尿便事实', summary: isEnglish ? `Diaper: ${diaper}` : `尿便：${diaper === 'both' ? '尿和便' : diaper === 'urine' ? '尿' : '便'}`, now })
  }

  const temperature = temperatureFrom(text)
  if (temperature || context?.category === 'temperature' || (/体温|温度/i.test(text) && isCareEventDraftIntent(text))) {
    if (!temperature) return missingDraft({ category: 'temperature', title: isEnglish ? 'Temperature fact' : '体温事实', question: isEnglish ? 'What was the measured temperature and unit?' : '请填写测得的体温数值和单位，例如 38.2℃。', now })
    return eventDraft({ baby, actor, kind: 'measurement', category: 'temperature', payload: { value: temperature.value, unit: temperature.unit, measuredAt: now, note: text }, title: isEnglish ? 'Temperature fact' : '体温事实', summary: isEnglish ? `${temperature.value}${temperature.unit}` : `${temperature.value}${temperature.unit}`, now })
  }

  const growth = growthFrom(text)
  if (growth) {
    return eventDraft({ baby, actor, kind: 'measurement', category: 'growth_measurement', payload: { type: growth.type, value: growth.value, unit: growth.unit, measuredAt: now, source: 'caregiver_observation', note: text }, title: isEnglish ? 'Growth measurement' : '成长测量', summary: isEnglish ? `${growth.label}: ${growth.value} ${growth.unit}` : `${growth.label}：${growth.value} ${growth.unit}`, now })
  }

  const symptoms = parseSymptoms(text)
  if (symptoms.length && (isCareEventDraftIntent(text) || context?.category === 'symptom_observation')) {
    return eventDraft({ baby, actor, category: 'symptom_observation', payload: { symptoms, symptomNotes: text, firstNoticedAt: now }, title: isEnglish ? 'Observed symptom' : '症状观察', summary: isEnglish ? `Observed: ${symptoms.join(', ')}` : `观察到：${symptoms.join('、')}`, now })
  }
  if (context?.category === 'symptom_observation') return missingDraft({ category: 'symptom_observation', title: isEnglish ? 'Observed symptom' : '症状观察', question: isEnglish ? 'What did you observe? Describe the symptom without guessing a diagnosis.' : '请描述你实际看到的表现，不要先填写疾病判断。', now })

  return { status: 'unsupported', reason: 'no_structured_fact', message: isEnglish ? 'I need a concrete observed fact before creating a draft.' : '需要先说清楚已经发生或看到的具体事实，才能生成记录草稿。' }
}

export function draftText(draft, locale = 'zh-CN') {
  if (!draft) return ''
  if (draft.status === 'needs_information') return draft.question || (locale === 'en-US' ? 'One key fact is missing.' : '还缺一个关键事实。')
  if (draft.status === 'unsupported') return draft.message || (locale === 'en-US' ? 'No record draft was created.' : '暂时没有生成记录草稿。')
  return locale === 'en-US' ? `I prepared a ${draft.title.toLowerCase()}. Check the time and facts before saving.` : `我准备了一条${draft.title}。请先核对发生时间和事实内容，再确认保存。`
}
