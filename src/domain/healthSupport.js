export const SUPPORT_TOPICS = Object.freeze([
  { id: 'feeding-change', title: { zh: '喂养有明显变化', en: 'Feeding changed noticeably' }, detail: { zh: '记录一次完整喂养和实际喝下的奶量。', en: 'Record one complete feed and the amount actually taken.' } },
  { id: 'temperature', title: { zh: '体温变化', en: 'Temperature change' }, detail: { zh: '记录数值、单位、时间和测量方式。', en: 'Record value, unit, time, and method.' } },
  { id: 'breathing', title: { zh: '呼吸看起来不对', en: 'Breathing looks different' }, detail: { zh: '记录呼吸表现、颜色和清醒程度。', en: 'Record breathing, color, and alertness.' } },
  { id: 'jaundice', title: { zh: '黄疸观察有变化', en: 'Jaundice observation changed' }, detail: { zh: '记录部位、首次发现时间、吃奶和尿便。', en: 'Record area, onset, feeding, and urine/stool.' } },
  { id: 'alertness', title: { zh: '精神状态或持续哭闹变化', en: 'Alertness or crying changed' }, detail: { zh: '记录能否唤醒、吃奶和呼吸情况。', en: 'Record whether the baby wakes, feeds, and breathes normally.' } },
  { id: 'vomiting-diarrhea', title: { zh: '呕吐、腹泻或排泄变化', en: 'Vomiting, diarrhea, or elimination changed' }, detail: { zh: '记录次数、外观、吃奶和湿尿布。', en: 'Record frequency, appearance, feeding, and wet diapers.' } },
  { id: 'other', title: { zh: '其他变化', en: 'Other change' }, detail: { zh: '只写看到的事实和发生时间。', en: 'Write only what you saw and when it happened.' } },
])

export const URGENT_FACTS = Object.freeze([
  { id: 'breathing-difficulty', title: { zh: '呼吸费力或出现停顿', en: 'Labored breathing or pauses' } },
  { id: 'blue-color', title: { zh: '嘴唇或皮肤发青/灰', en: 'Blue or gray lips/skin' } },
  { id: 'hard-to-wake', title: { zh: '叫不醒或明显无反应', en: 'Hard to wake or markedly unresponsive' } },
  { id: 'seizure', title: { zh: '抽搐或异常抖动', en: 'Seizure-like movement' } },
  { id: 'repeated-vomiting', title: { zh: '反复呕吐且无法进食', en: 'Repeated vomiting with inability to feed' } },
])

export function topicById(topicId) {
  return SUPPORT_TOPICS.find((topic) => topic.id === topicId) || SUPPORT_TOPICS.at(-1)
}

export function evaluateSupport({ topicId, facts = [] } = {}) {
  const topic = topicById(topicId)
  const urgent = facts.some((fact) => URGENT_FACTS.some((item) => item.id === fact))
  if (urgent) {
    return {
      actionLevel: 'urgent-support',
      action: { zh: '现在联系当地急救服务或立即就医；不要等待原定复查。', en: 'Contact local emergency services or seek immediate care now; do not wait for a scheduled review.' },
      recheck: { zh: '在等待专业帮助时，记录发生时间、呼吸、颜色和清醒程度。', en: 'While waiting for help, record timing, breathing, color, and alertness.' },
      escalation: { zh: '把已记录的事实和时间线交给专业人员。', en: 'Share the recorded facts and timeline with the clinician.' },
      source: 'WHO newborn care · emergency signs require immediate professional help',
    }
  }
  if (topic.id === 'temperature' || topic.id === 'breathing' || topic.id === 'alertness') {
    return {
      actionLevel: 'contact-clinician',
      action: { zh: '保存测量或观察事实，尽快联系儿科专业人员确认下一步。', en: 'Keep the measured or observed facts and contact a pediatric clinician promptly.' },
      recheck: { zh: '按专业人员给出的时间和方法复查；记录复查时间。', en: 'Recheck at the time and with the method advised by the clinician.' },
      escalation: { zh: '若出现呼吸费力、发青、叫不醒等危急表现，立即升级为急救求助。', en: 'Escalate to emergency help for labored breathing, blue color, or inability to wake.' },
      source: 'WHO newborn care · observation and professional assessment',
    }
  }
  return {
    actionLevel: 'observe-and-recheck',
    action: { zh: '先记录时间和看到的事实；不要根据页面自行判断病因。', en: 'Record the timing and observed facts first; do not infer a cause from this page.' },
    recheck: { zh: '按宝宝平时节奏或专业人员安排再次观察，并补录变化。', en: 'Recheck with the baby’s usual routine or the clinician’s plan and record changes.' },
    escalation: { zh: '如果变化持续、加重或出现危急表现，联系专业人员或当地急救服务。', en: 'Contact a clinician or local emergency service if the change persists, worsens, or urgent signs appear.' },
    source: 'WHO newborn care · caregiver observation and professional follow-up',
  }
}

export function concernsFromCareEvents(events = [], existing = []) {
  const byId = new Map(existing.map((concern) => [concern.id, concern]))
  for (const event of events) {
    const concernId = event?.relatedConcernId
    const payload = event?.payload || {}
    if (!concernId || event.status === 'voided') continue
    if (payload.supportStatus === 'closed') {
      const prior = byId.get(concernId)
      if (prior) byId.set(concernId, { ...prior, status: 'closed', updatedAt: event.updatedAt || prior.updatedAt })
      continue
    }
    const topic = topicById(payload.supportTopic)
    byId.set(concernId, {
      id: concernId,
      babyId: event.babyId || null,
      topicId: payload.supportTopic || null,
      title: topic.title,
      status: 'open',
      createdAt: event.createdAt || event.occurredAt,
      updatedAt: event.updatedAt || event.createdAt || event.occurredAt,
      plan: payload.plan || null,
      facts: Array.isArray(payload.facts) ? payload.facts : [],
      notes: payload.notes || '',
    })
  }
  return [...byId.values()]
}
