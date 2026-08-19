export const DECISION_KERNEL_VERSION = 'decision-kernel-2026-08-07'

export const DECISION_STATUSES = Object.freeze([
  'needs_information',
  'decision_ready',
  'safety_action_required',
  'unsupported',
])

const UNITS = Object.freeze({
  general_health_preassessment: {
    topic: 'general_health',
    required: [
      { key: 'alertness', label: '宝宝是否容易唤醒' },
      { key: 'breathing', label: '呼吸是否平稳' },
      { key: 'feedingChange', label: '吃奶是否明显少于平时' },
    ],
    readyAction: '继续按已确认事实观察；出现呼吸困难、发青或叫不醒时立即升级。',
  },
  feeding_change: {
    topic: 'feeding_change',
    required: [
      { key: 'feedingChange', label: '吃奶变化' },
      { key: 'alertness', label: '精神/唤醒状态' },
      { key: 'wetDiapers', label: '近期湿尿布情况' },
    ],
    readyAction: '记录下一次实际喂养和湿尿布；若继续明显减少或精神变差，联系儿科评估。',
  },
  temperature_abnormal: {
    topic: 'temperature',
    required: [
      { key: 'temperatureC', label: '测得体温（℃）' },
      { key: 'measurementMethod', label: '测量部位或方法' },
      { key: 'alertness', label: '精神/唤醒状态' },
    ],
    readyAction: '保留体温数值、测量方法和时间，并按宝宝状态继续观察。',
  },
  breathing_abnormal: {
    topic: 'breathing',
    required: [
      { key: 'breathing', label: '是否呼吸费力、发青或只是声音变化' },
      { key: 'breathingRate', label: '安静状态下完整一分钟呼吸次数' },
      { key: 'alertness', label: '精神/唤醒状态' },
    ],
    readyAction: '保留完整一分钟呼吸次数和可见表现；任何费力、胸壁凹陷或发青立即升级。',
  },
  jaundice_observation: {
    topic: 'jaundice',
    required: [
      { key: 'jaundiceOnset', label: '黄染首次出现在出生后多久' },
      { key: 'yellowPalmsSoles', label: '手掌或脚底是否发黄' },
      { key: 'feedingChange', label: '吃奶是否明显减少' },
      { key: 'alertness', label: '精神/唤醒状态' },
    ],
    readyAction: '在自然光下继续观察黄染范围，并保存时间变化；不要凭肉眼估算胆红素数值。',
  },
  safe_sleep: {
    topic: 'safe_sleep',
    required: [
      { key: 'sleepPosition', label: '入睡时是否仰卧' },
      { key: 'sleepSurface', label: '睡眠表面是否独立、坚实、平坦' },
      { key: 'softObjects', label: '睡眠区是否有枕头、厚被或毛绒物' },
    ],
    readyAction: '保持仰卧、独立坚实平坦睡面，睡眠区只留贴合床单。',
  },
})

// Keep every server-side decision input in sync with the published unit
// contract. Additional derived safety inputs are listed explicitly below.
export const DECISION_REQUIRED_FACT_KEYS = Object.freeze([
  ...new Set(Object.values(UNITS).flatMap((unit) => unit.required.map((field) => field.key))),
])
export const DECISION_INPUT_FACT_KEYS = Object.freeze([
  ...new Set([...DECISION_REQUIRED_FACT_KEYS, 'chestIndrawing']),
])

const ANSWER_PATTERNS = Object.freeze({
  alertness: [
    { value: 'unresponsive', pattern: /叫不醒|无法唤醒|不醒|没有反应|unresponsive|cannot wake/i },
    { value: 'difficult', pattern: /难唤醒|很难叫醒|不容易唤醒|嗜睡|difficult to wake|very sleepy/i },
    { value: 'responsive', pattern: /容易唤醒|容易叫醒|能叫醒|叫得醒|清醒|有反应|easy to wake|responsive/i },
  ],
  breathing: [
    { value: 'blue_lips', pattern: /发青|嘴唇青|口唇青|蓝唇|blue lips|cyanotic/i },
    { value: 'labored', pattern: /呼吸困难|呼吸费力|喘不上气|喘息|急促|不平稳|labored breathing|difficulty breathing/i },
    { value: 'steady', pattern: /呼吸平稳|呼吸正常|没有呼吸问题|平稳呼吸|breathing is steady|breathing is normal/i },
  ],
  feedingChange: [
    { value: 'decreased', pattern: /明显少|少吃|吃得少|拒奶|不吃奶|进食减少|feeding less|feeding decreased|refuses feeds/i },
    { value: 'baseline', pattern: /和平时一样|没有变化|正常吃奶|吃得正常|feeding normally|same as usual/i },
  ],
  wetDiapers: [
    { value: 'low', pattern: /尿布(?:也)?少|尿(?:量)?少|湿尿布(?:也)?少|几乎没有尿|wet diapers are low|fewer wet diapers/i },
    { value: 'adequate', pattern: /尿布正常|尿量正常|湿尿布够|尿正常|wet diapers are normal|adequate wet diapers/i },
  ],
  measurementMethod: [
    { value: 'axillary', pattern: /腋温|腋下|axillary|armpit/i },
    { value: 'rectal', pattern: /肛温|直肠|rectal/i },
    { value: 'ear', pattern: /耳温|耳朵|tympanic|ear/i },
    { value: 'forehead', pattern: /额温|额头|forehead|temporal/i },
    { value: 'unknown', pattern: /不确定|不知道|忘了|unknown|not sure/i },
  ],
  jaundiceOnset: [
    { value: 'first_24h', pattern: /(?:出生后?)?(?:24|二十四)\s*小时(?:内|以内)|第一天|当天.*黄|first 24 hours/i },
    { value: 'after_24h', pattern: /24\s*小时后|第二天|第三天|[2-9]\s*天.*黄|after 24 hours/i },
    { value: 'unknown', pattern: /不确定|不知道|没注意|unknown|not sure/i },
  ],
  yellowPalmsSoles: [
    { value: 'no', pattern: /手掌.*不黄|脚底.*不黄|足底.*不黄|没有.*(?:手掌|脚底|足底)|palms.*not yellow|soles.*not yellow/i },
    { value: 'yes', pattern: /手掌|脚底|足底|palms|soles/i },
    { value: 'unknown', pattern: /不确定|不知道|没看|unknown|not sure/i },
  ],
  sleepPosition: [
    { value: 'back', pattern: /仰卧|平躺|朝上|on (?:the )?back|supine/i },
    { value: 'side', pattern: /侧睡|侧卧|on (?:the )?side/i },
    { value: 'stomach', pattern: /趴睡|俯卧|on (?:the )?stomach|prone/i },
    { value: 'unknown', pattern: /不确定|不知道|unknown|not sure/i },
  ],
  sleepSurface: [
    { value: 'firm_flat_separate', pattern: /独立.*(?:坚实|硬).*(?:平坦|平)|婴儿床.*(?:平坦|硬)|firm.*flat.*separate/i },
    { value: 'adult_bed', pattern: /大人床|成人床|同床|bed.?sharing|adult bed/i },
    { value: 'soft_or_inclined', pattern: /软床|沙发|斜坡|倾斜|摇椅|安全座椅.*睡|soft|inclined|sofa/i },
    { value: 'unknown', pattern: /不确定|不知道|unknown|not sure/i },
  ],
  softObjects: [
    { value: 'absent', pattern: /没有.*(?:枕头|被子|毛绒|玩具|床围)|空床|只有.*床单|no.*(?:pillow|blanket|soft object)/i },
    { value: 'present', pattern: /有.*(?:枕头|被子|毛绒|玩具|床围)|枕头|厚被|毛绒物|软物|pillow|blanket|soft object|bumper/i },
    { value: 'unknown', pattern: /不确定|不知道|unknown|not sure/i },
  ],
})

function missingFacts(required, facts) {
  return required.filter((field) => facts?.[field.key] === undefined || facts?.[field.key] === null || facts?.[field.key] === '').map((field) => ({ ...field, reason: 'not_provided' }))
}

function dangerFromFacts(facts = {}) {
  return [
    facts.breathing === 'labored',
    facts.breathing === 'blue_lips',
    facts.alertness === 'unresponsive',
  ].some(Boolean)
}

function numberFact(message, patterns) {
  for (const pattern of patterns) {
    const match = String(message).match(pattern)
    if (!match) continue
    const value = Number(match[1])
    if (Number.isFinite(value)) return value
  }
  return undefined
}

export function parseDecisionAnswer(key, message = '') {
  const patterns = ANSWER_PATTERNS[key] || []
  return patterns.find(({ pattern }) => pattern.test(String(message)))?.value
}

export function extractDecisionFacts(message = '') {
  const facts = Object.fromEntries(Object.keys(ANSWER_PATTERNS).flatMap((key) => {
    const value = parseDecisionAnswer(key, message)
    return value ? [[key, value]] : []
  }))
  // A bare number is only a temperature when it carries a temperature unit;
  // this avoids treating height, weight, or breathing-rate values as °C.
  const temperatureC = numberFact(message, [/(?:体温|温度)\s*(?:(?:为|是|测得|测量为)\s*)?[:：]?\s*(\d{2}(?:\.\d+)?)\s*(?:℃|°?C|°?F|℉)?/i, /^\s*(\d{2}(?:\.\d+)?)\s*(?:℃|°?C|°?F|℉)\s*$/i])
  if (temperatureC >= 30 && temperatureC <= 45) facts.temperatureC = temperatureC
  const breathingRate = numberFact(message, [/(?:呼吸|每分钟)[^\d]{0,8}(\d{1,3})\s*(?:次|下|次\/分|bpm)?/i])
  if (breathingRate >= 1 && breathingRate <= 200) facts.breathingRate = breathingRate
  if (/胸壁凹陷|肋间凹陷|吸气凹陷|chest indrawing|retractions/i.test(message)) facts.chestIndrawing = true
  return facts
}

export function selectExplicitDecisionUnit(message = '') {
  const text = String(message)
  // Generic words such as “睡觉正常” are common answers in another health
  // flow and must not silently switch the active decision unit. Only concrete
  // safe-sleep topics count as an explicit topic transition.
  if (/仰卧|侧睡|趴睡|婴儿床|同床|睡眠表面|枕头|厚被|柔软物|safe sleep/i.test(text)) return 'safe_sleep'
  if (/黄疸|黄染|发黄|jaundice/i.test(text)) return 'jaundice_observation'
  if (/呼吸|喘|胸壁|发青|breath|cyan/i.test(text)) return 'breathing_abnormal'
  if (/体温|发热|发烧|低温|temperature|fever/i.test(text)) return 'temperature_abnormal'
  if (/吃奶少|吃得少|拒奶|喂养减少|feeding less|refuses feeds/i.test(text)) return 'feeding_change'
  return ''
}

export function selectDecisionUnit(message = '') {
  const explicit = selectExplicitDecisionUnit(message)
  if (explicit) return explicit
  if (/睡眠|睡觉/i.test(String(message))) return 'safe_sleep'
  return 'general_health_preassessment'
}

export function getDecisionUnit(unitId) {
  return UNITS[unitId] || null
}

export function runUniversalSafetyGate(facts = {}) {
  if (dangerFromFacts(facts)) {
    return {
      status: 'safety_action_required',
      minimumAction: '立即联系当地急救或儿科服务，并持续观察呼吸和唤醒状态。',
      source: 'universal-safety-floor-v1',
    }
  }
  return { status: 'clear', minimumAction: null, source: 'universal-safety-floor-v1' }
}

function unitSafety(unitId, facts = {}) {
  const universal = runUniversalSafetyGate(facts)
  if (universal.status === 'safety_action_required') return universal
  const ageDays = Number(facts.ageDays)
  const isNewborn = Number.isFinite(ageDays) && ageDays >= 0 && ageDays <= 28
  if (unitId === 'temperature_abnormal' && isNewborn && Number.isFinite(Number(facts.temperatureC))) {
    const temperature = Number(facts.temperatureC)
    if (temperature >= 38 || temperature < 35.5) return { status: 'safety_action_required', minimumAction: '新生儿体温达到 38℃ 或低于 35.5℃ 属危险信号；请立即联系当地儿科急诊或急救服务。', source: 'who-essential-newborn-care-2024' }
  }
  if (unitId === 'breathing_abnormal' && isNewborn && (Number(facts.breathingRate) > 60 || facts.chestIndrawing === true)) return { status: 'safety_action_required', minimumAction: '新生儿安静时呼吸超过每分钟 60 次或出现胸壁凹陷属危险信号；请立即联系当地儿科急诊或急救服务。', source: 'who-essential-newborn-care-2024' }
  if (unitId === 'jaundice_observation' && isNewborn && (facts.jaundiceOnset === 'first_24h' || facts.yellowPalmsSoles === 'yes')) return { status: 'safety_action_required', minimumAction: '出生后 24 小时内出现黄疸，或手掌、脚底发黄，需要紧急转诊评估；请立即联系儿科服务。', source: 'who-newborn-jaundice-referral' }
  if (unitId === 'feeding_change' && isNewborn && facts.feedingChange === 'decreased' && facts.wetDiapers === 'low') return { status: 'safety_action_required', minimumAction: '吃奶明显减少且湿尿布减少，需要尽快联系儿科服务评估；若同时难唤醒或呼吸异常，立即急诊。', source: 'who-newborn-danger-signs' }
  if (unitId === 'safe_sleep' && Number.isFinite(ageDays) && ageDays <= 365 && (['side', 'stomach'].includes(facts.sleepPosition) || ['adult_bed', 'soft_or_inclined'].includes(facts.sleepSurface) || facts.softObjects === 'present')) return { status: 'safety_action_required', minimumAction: '现在把宝宝调整为仰卧，使用独立、坚实、平坦的睡眠表面，并移除枕头、厚被和柔软物。', source: 'cdc-safe-sleep-2024' }
  return universal
}

export function runDecisionUnit({ unitId, facts = {}, version = DECISION_KERNEL_VERSION } = {}) {
  const unit = getDecisionUnit(unitId)
  if (!unit) return { unitId, unitVersion: version, status: 'unsupported', missing: [], actions: [], reasons: ['没有覆盖当前主题的已发布决策单元。'] }
  const safety = unitSafety(unitId, facts)
  if (safety.status === 'safety_action_required') {
    return { unitId, unitVersion: version, status: safety.status, missing: [], actions: [safety.minimumAction], reasons: [], minimumAction: safety.minimumAction }
  }
  const missing = missingFacts(unit.required, facts)
  if (missing.length) {
    return {
      unitId,
      unitVersion: version,
      status: 'needs_information',
      missing,
      nextQuestion: missing[0],
      actions: [],
      reasons: ['关键事实尚未收集齐，暂不形成个体化结论。'],
    }
  }
  return {
    unitId,
    unitVersion: version,
    status: 'decision_ready',
    missing: [],
    actions: [unit.readyAction || '基于已确认事实继续观察，并在出现新变化时重新评估。'],
    reasons: ['信息充分性门已通过；本结果只整理下一步，不构成诊断。'],
  }
}
