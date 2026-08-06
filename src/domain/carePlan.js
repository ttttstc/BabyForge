const DAY_MS = 86_400_000

export const CARE_ACTORS = [
  { id: 'parent', label: { zh: '家长', en: 'Parent' } },
  { id: 'nanny', label: { zh: '月嫂', en: 'Nanny' } },
  { id: 'other', label: { zh: '其他照护者', en: 'Other caregiver' } },
]

export const CARE_TASKS = [
  {
    id: 'feeding',
    icon: 'feeding',
    title: { zh: '观察一次完整喂养', en: 'Watch one complete feed' },
    action: { zh: '看一次吃奶、吞咽和结束后的状态，和宝宝平时相比即可。', en: 'Watch feeding, swallowing, and the after-feed state. Compare only with this baby’s usual pattern.' },
    acceptance: { zh: '完成一次喂养后，能说清是否有连续吞咽、喂后状态是否和平时相近；看不清就不勾选。', en: 'After one feed, you can state whether swallowing was continuous and whether the after-feed state matched usual. Leave unchecked if you could not observe it.' },
    why: { zh: '连续的照护观察比凭印象回忆更容易交接。', en: 'A concrete observation is easier to hand off than a memory.' },
    duration: { zh: '约 2 分钟', en: 'About 2 min' },
  },
  {
    id: 'elimination',
    icon: 'elimination',
    title: { zh: '记下今天一次尿便', en: 'Note one urine / stool event' },
    action: { zh: '只记时间和看到的事实；不需要解释颜色或次数是否正常。', en: 'Write the time and what you saw. Do not interpret color or frequency.' },
    acceptance: { zh: '写下最近一次发生时间和看到的尿便事实，另一位照护者能按记录复述；没有记录就不勾选。', en: 'Write the latest time and observable urine / stool facts so another caregiver can repeat them. Leave unchecked without a record.' },
    why: { zh: '把事实留给下一位照护者，也方便需要时告诉专业人员。', en: 'A factual note helps the next caregiver and a clinician if needed.' },
    duration: { zh: '约 1 分钟', en: 'About 1 min' },
  },
  {
    id: 'safe-sleep',
    icon: 'sleep',
    title: { zh: '做一次睡眠环境检查', en: 'Run one safe-sleep check' },
    action: { zh: '确认宝宝仰卧、睡眠表面平整，并移开松散物品。', en: 'Confirm the baby is on the back, on a firm flat surface, with loose items removed.' },
    acceptance: { zh: '现场确认仰卧、平整硬质睡眠表面、周围无枕头被褥玩偶等松散物品；任一项不满足就不勾选。', en: 'Confirm back sleeping, a firm flat surface, and no loose pillows, bedding, or toys. Leave unchecked if any item is not met.' },
    why: { zh: '把高价值安全动作变成可重复的交接步骤。', en: 'A repeatable safety step is easier to share across caregivers.' },
    duration: { zh: '约 1 分钟', en: 'About 1 min' },
  },
]

export const STAGE_MILESTONES = {
  'newborn-early': [
    { id: 'first-visit-plan', dueDay: 1, title: { zh: '准备新生儿访视资料', en: 'Prepare newborn visit notes' }, detail: { zh: '把出生信息、喂养方式和想问的问题放在一起。', en: 'Gather birth details, feeding mode, and questions in one place.' } },
    { id: 'care-handoff', dueDay: 2, title: { zh: '建立一次照护交接', en: 'Make one caregiver handoff' }, detail: { zh: '交接吃奶、尿便和睡眠环境这三项事实。', en: 'Hand off feeding, urine / stool, and sleep-environment facts.' } },
    { id: 'cord-observation', dueDay: 4, title: { zh: '完成一次脐部外观观察', en: 'Observe the cord area once' }, detail: { zh: '只描述干燥、分泌物或出血等看到的事实。', en: 'Describe only what you see, such as dryness, discharge, or bleeding.' } },
    { id: 'early-summary', dueDay: 7, title: { zh: '整理 0–7 天时间线', en: 'Review the days 0–7 timeline' }, detail: { zh: '把关键记录和希望咨询的问题整理成一页。', en: 'Gather key records and questions into one page.' } },
  ],
  'newborn-adaptation': [
    { id: 'feeding-rhythm', dueDay: 10, title: { zh: '看懂宝宝的喂养节律', en: 'Notice the feeding rhythm' }, detail: { zh: '观察一天中的吃奶与清醒片段，不追求完整打卡。', en: 'Notice feeds and awake periods without trying to log everything.' } },
    { id: 'care-team-language', dueDay: 14, title: { zh: '统一照护者描述方式', en: 'Align caregiver language' }, detail: { zh: '用时间、部位、变化、来源四类事实交接。', en: 'Use time, location, change, and source for handoffs.' } },
    { id: 'health-visit-questions', dueDay: 21, title: { zh: '准备儿童保健问题', en: 'Prepare health-visit questions' }, detail: { zh: '从记录中挑出最想向专业人员确认的三件事。', en: 'Choose up to three questions from your records.' } },
    { id: 'adaptation-review', dueDay: 28, title: { zh: '完成 0–28 天回顾', en: 'Review the first 28 days' }, detail: { zh: '查看阶段事项、成长测量和观察时间线。', en: 'Review stage tasks, measurements, and the observation timeline.' } },
  ],
}

// Administrative and preventive-care tasks are kept separate from daily
// observations. Timing varies by location, so the UI shows a due window and
// asks the caregiver to verify the local institution's instruction.
export const NEWBORN_ADMIN_TASKS = [
  {
    id: 'vaccination-record-check',
    stageIds: ['newborn-early', 'newborn-adaptation'],
    category: 'vaccination',
    priority: 'high',
    dueDay: 0,
    title: { zh: '核对出生相关疫苗记录', en: 'Check birth vaccine records' },
    detail: { zh: '查看接种证、医院记录或当地免疫规划平台，确认已记录的项目和下一次安排。', en: 'Check the immunization record, hospital note, or local schedule for recorded doses and the next appointment.' },
    dueHint: { zh: '按出生机构与当地免疫规划安排', en: 'Follow the birth facility and local immunization schedule' },
    acceptance: { zh: '能找到接种记录，并知道下一次需要向谁确认；没有记录就保持待办。', en: 'You can find the record and know who to contact about the next step; leave pending without a record.' },
  },
  {
    id: 'birth-certificate',
    stageIds: ['newborn-early', 'newborn-adaptation'],
    category: 'documents',
    priority: 'high',
    dueDay: 7,
    title: { zh: '办理出生医学证明', en: 'Arrange the birth certificate' },
    detail: { zh: '按医院和当地办理流程准备父母证件、分娩信息和申请材料。', en: 'Prepare the documents, birth details, and application materials required by the hospital and local process.' },
    dueHint: { zh: '尽快按医院/当地流程办理，不以本页面日期替代官方期限', en: 'Start promptly and follow the hospital/local process; this page is not an official deadline.' },
    acceptance: { zh: '已提交申请或明确办理窗口、所需材料和下一步；仅“打算办理”不算完成。', en: 'The application is submitted or the office, materials, and next step are confirmed; intention alone is not complete.' },
  },
  {
    id: 'newborn-health-visit',
    stageIds: ['newborn-early'],
    category: 'health-visit',
    priority: 'high',
    dueDay: 7,
    title: { zh: '完成首次新生儿访视 / 儿保预约', en: 'Complete or book the first newborn visit' },
    detail: { zh: '准备出生信息、喂养方式、观察记录和想咨询的问题，按当地安排完成访视或预约。', en: 'Prepare birth details, feeding mode, observations, and questions for the first visit or booking.' },
    dueHint: { zh: '出生后早期，具体时间按当地儿童保健安排', en: 'Early after birth; timing follows the local child-health service.' },
    acceptance: { zh: '已经完成访视，或已有明确预约时间、地点和需要携带的资料。', en: 'The visit is complete or a specific time, place, and materials-to-bring are confirmed.' },
  },
  {
    id: 'child-health-record',
    stageIds: ['newborn-early', 'newborn-adaptation'],
    category: 'health-visit',
    priority: 'medium',
    dueDay: 14,
    title: { zh: '建立儿童保健记录', en: 'Set up the child-health record' },
    detail: { zh: '确认儿童保健手册或当地电子档案入口，保存访视、测量和接种来源。', en: 'Confirm the child-health booklet or local digital record and keep visit, measurement, and vaccine sources together.' },
    dueHint: { zh: '按当地妇幼/社区服务流程', en: 'Follow the local maternal-child or community service process' },
    acceptance: { zh: '找得到记录入口，知道下一次更新由哪个机构完成；没有入口就保持待办。', en: 'You can find the record and know which service updates it next; leave pending without an access path.' },
  },
  {
    id: 'twenty-eight-day-health-visit',
    stageIds: ['newborn-adaptation'],
    category: 'health-visit',
    priority: 'high',
    dueDay: 28,
    title: { zh: '安排 28 天左右儿保复核', en: 'Arrange the around-day-28 health review' },
    detail: { zh: '把阶段内的喂养、尿便、观察和成长测量整理好，按当地机构安排复核。', en: 'Gather feeding, urine / stool, observations, and growth measurements for the local around-day-28 review.' },
    dueHint: { zh: '出生后约 28 天，具体时间按当地机构安排', en: 'Around day 28; exact timing follows the local service.' },
    acceptance: { zh: '已有完成记录或明确预约信息，并准备好要咨询的关键问题。', en: 'There is a completion record or confirmed appointment, with key questions ready.' },
  },
]

export const GROWTH_TYPES = [
  { id: 'weight', label: { zh: '体重', en: 'Weight' }, unit: 'kg', min: 0, max: 20 },
  { id: 'length', label: { zh: '身长', en: 'Length' }, unit: 'cm', min: 0, max: 100 },
  { id: 'headCircumference', label: { zh: '头围', en: 'Head circumference' }, unit: 'cm', min: 0, max: 70 },
]

function id(prefix) {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export function getDailyTasks(taskLogs = [], date = new Date()) {
  const dateKey = localDateKey(date)
  return CARE_TASKS.map((task) => {
    const log = taskLogs.find((item) => item.taskId === task.id && item.date === dateKey)
    return { ...task, date: dateKey, status: log?.status || 'pending', log: log || null }
  })
}

export function updateTaskLog(taskLogs = [], taskId, input = {}, now = new Date().toISOString()) {
  const date = input.date || localDateKey()
  const next = {
    id: input.id || id('task'),
    taskId,
    date,
    status: input.status || 'done',
    actor: input.actor || 'parent',
    note: input.note ? String(input.note).trim() : '',
    createdAt: input.createdAt || now,
    updatedAt: now,
    provenance: 'parent-entered',
  }
  const index = taskLogs.findIndex((item) => item.taskId === taskId && item.date === date)
  if (index === -1) return [...taskLogs, next]
  return taskLogs.map((item, itemIndex) => itemIndex === index ? { ...item, ...next, id: item.id, createdAt: item.createdAt } : item)
}

export function createGrowthMeasurement(input, options = {}) {
  const type = GROWTH_TYPES.some((item) => item.id === input.type) ? input.type : 'weight'
  const definition = GROWTH_TYPES.find((item) => item.id === type)
  const now = options.now || new Date().toISOString()
  return {
    id: options.id || id('growth'),
    type,
    value: String(input.value ?? '').trim(),
    unit: input.unit || definition.unit,
    measuredAt: input.measuredAt || localDateKey(),
    source: input.source ? String(input.source).trim() : 'parent-entered',
    note: input.note ? String(input.note).trim() : '',
    createdAt: now,
    updatedAt: now,
    provenance: 'parent-entered',
  }
}

export function upsertMilestoneRecord(records = [], milestoneId, input = {}, now = new Date().toISOString()) {
  const next = {
    id: input.id || id('milestone'),
    milestoneId,
    status: input.status || 'done',
    actor: input.actor || 'parent',
    note: input.note ? String(input.note).trim() : '',
    updatedAt: now,
    provenance: 'parent-entered',
  }
  const index = records.findIndex((item) => item.milestoneId === milestoneId)
  if (index === -1) return [...records, next]
  return records.map((item, itemIndex) => itemIndex === index ? { ...item, ...next, id: item.id } : item)
}

export function getStageMilestones(stageId, records = []) {
  return (STAGE_MILESTONES[stageId] || []).map((milestone) => ({
    ...milestone,
    record: records.find((item) => item.milestoneId === milestone.id) || null,
    status: records.find((item) => item.milestoneId === milestone.id)?.status || 'pending',
  }))
}

export function getAdminTasks(stageId, ageDays = 0, records = []) {
  return NEWBORN_ADMIN_TASKS
    .filter((task) => task.stageIds.includes(stageId))
    .map((task) => {
      const record = records.find((item) => item.taskId === task.id) || null
      const status = record?.status || 'pending'
      return {
        ...task,
        record,
        status,
        state: status === 'done' ? 'done' : ageDays >= task.dueDay ? 'due' : 'upcoming',
      }
    })
}

export function upsertAdminTaskRecord(records = [], taskId, input = {}, now = new Date().toISOString()) {
  const next = {
    id: input.id || id('admin-task'),
    taskId,
    status: input.status || 'done',
    updatedAt: now,
    provenance: 'parent-entered',
  }
  const index = records.findIndex((item) => item.taskId === taskId)
  if (index === -1) return [...records, next]
  return records.map((item, itemIndex) => itemIndex === index ? { ...item, ...next, id: item.id } : item)
}

export function getMonthDays(year, month) {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return { date, key: localDateKey(date), inMonth: date.getMonth() === month }
  })
}

export function dateForAge(birthDate, ageDays) {
  const date = new Date(`${birthDate}T12:00:00`)
  date.setTime(date.getTime() + ageDays * DAY_MS)
  return localDateKey(date)
}

export function getCalendarEvents(baby, milestoneRecords = [], adminTaskRecords = []) {
  if (!baby?.birthDate) return []
  const milestoneRecordMap = new Map(milestoneRecords.map((record) => [record.milestoneId, record]))
  const adminRecordMap = new Map(adminTaskRecords.map((record) => [record.taskId, record]))
  const events = [{
    id: 'birth-anniversary',
    date: baby.birthDate,
    kind: 'anniversary',
    title: { zh: '出生纪念日', en: 'Birth anniversary' },
    detail: { zh: '宝宝出生的日子', en: 'The day your baby was born' },
    status: 'scheduled',
  }]
  const seenMilestones = new Set()
  Object.values(STAGE_MILESTONES).flat().forEach((milestone) => {
    if (seenMilestones.has(milestone.id)) return
    seenMilestones.add(milestone.id)
    events.push({
      id: milestone.id,
      date: dateForAge(baby.birthDate, milestone.dueDay),
      kind: 'milestone',
      title: milestone.title,
      detail: milestone.detail,
      status: milestoneRecordMap.get(milestone.id)?.status || 'pending',
    })
  })
  NEWBORN_ADMIN_TASKS.forEach((task) => {
    events.push({
      id: task.id,
      date: dateForAge(baby.birthDate, task.dueDay),
      kind: 'admin',
      title: task.title,
      detail: task.detail,
      dueHint: task.dueHint,
      status: adminRecordMap.get(task.id)?.status || 'pending',
      priority: task.priority,
    })
  })
  return events
}
