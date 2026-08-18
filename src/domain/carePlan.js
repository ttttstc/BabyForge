import { getInfantMonthlyGuidance } from '../content/cuiParenting.js'
import { calendarDateKey } from './date.js'

const DAY_MS = 86_400_000

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

const STAGE_DAILY_TASKS = {
  infant: [
    {
      id: 'feeding',
      icon: 'feeding',
      title: { zh: '观察吃奶和进食', en: 'Notice feeding and eating' },
      action: { zh: '记录进食方式与和平时相比的变化。', en: 'Record how feeding or eating compares with this baby’s usual pattern.' },
      acceptance: { zh: '完成一次进食观察并留下时间和看到的事实。', en: 'Observe one feed or meal and leave the time and observable facts.' },
      why: { zh: '持续的照护观察比凭印象回忆更容易交接。', en: 'A concrete observation is easier to hand off than a memory.' },
      duration: { zh: '约 2 分钟', en: 'About 2 min' },
    },
    {
      id: 'interaction',
      icon: 'interaction',
      title: { zh: '留意清醒互动', en: 'Notice awake interaction' },
      action: { zh: '记录宝宝回应声音、表情和互动的具体片段。', en: 'Record a concrete moment of responding to sounds, faces, or interaction.' },
      acceptance: { zh: '写下一次互动发生的时间和宝宝的具体回应，不做能力评分。', en: 'Write the time and concrete response without scoring development.' },
      why: { zh: '具体场景能帮助下一位照护者理解宝宝自己的节律。', en: 'Concrete scenes help the next caregiver understand this baby’s rhythm.' },
      duration: { zh: '约 2 分钟', en: 'About 2 min' },
    },
    {
      id: 'sleep-rhythm',
      icon: 'sleep',
      title: { zh: '记录睡眠节律', en: 'Note the sleep rhythm' },
      action: { zh: '记下入睡、醒来和需要安抚的时间点。', en: 'Note when the baby fell asleep, woke up, or needed soothing.' },
      acceptance: { zh: '留下至少一个睡眠片段的时间和照护事实，不解释是否正常。', en: 'Leave one sleep interval with its time and care facts without judging it.' },
      why: { zh: '按宝宝自己的节律记录，比套用固定标准更有用。', en: 'This baby’s own rhythm is more useful than a fixed standard.' },
      duration: { zh: '约 1 分钟', en: 'About 1 min' },
    },
  ],
  toddler: [
    {
      id: 'meals',
      icon: 'feeding',
      title: { zh: '观察一餐进食', en: 'Notice one meal' },
      action: { zh: '记录孩子吃了什么、如何参与和需要什么支持。', en: 'Record what the child ate, how they joined in, and what support they needed.' },
      acceptance: { zh: '完成一次进食观察并留下时间和看到的事实。', en: 'Observe one meal and leave the time and observable facts.' },
      why: { zh: '具体记录方便家庭交接，也避免用印象替代事实。', en: 'Concrete notes make handoffs easier and avoid replacing facts with impressions.' },
      duration: { zh: '约 2 分钟', en: 'About 2 min' },
    },
    {
      id: 'movement',
      icon: 'movement',
      title: { zh: '留出一次主动活动', en: 'Make room for active play' },
      action: { zh: '记录孩子今天主动移动、游戏或探索的片段。', en: 'Record a moment of active movement, play, or exploration today.' },
      acceptance: { zh: '留下一个具体活动场景和孩子需要的支持，不做能力评分。', en: 'Leave one concrete activity scene and the support needed without scoring development.' },
      why: { zh: '保留实际场景，帮助照护者接着支持孩子。', en: 'A real scene helps caregivers continue the right support.' },
      duration: { zh: '约 5 分钟', en: 'About 5 min' },
    },
    {
      id: 'communication',
      icon: 'interaction',
      title: { zh: '记录一次表达', en: 'Record one way of communicating' },
      action: { zh: '记下孩子用语言、动作或表情表达需要的场景。', en: 'Record a moment when the child used words, gestures, or expressions to communicate.' },
      acceptance: { zh: '留下发生场景和孩子的表达方式，不做能力评分。', en: 'Leave the scene and the way the child communicated without scoring development.' },
      why: { zh: '把可复述的场景留给下一位照护者。', en: 'A repeatable scene is easier to share with the next caregiver.' },
      duration: { zh: '约 2 分钟', en: 'About 2 min' },
    },
  ],
  child: [
    {
      id: 'routine',
      icon: 'routine',
      title: { zh: '回顾今天的生活节律', en: 'Review today’s routine' },
      action: { zh: '记录睡眠、进食和活动中最值得交接的一件事。', en: 'Record the one sleep, meal, or activity fact worth handing off.' },
      acceptance: { zh: '留下一个带时间的生活事实，另一位照护者能按记录复述。', en: 'Leave one timed routine fact another caregiver can repeat.' },
      why: { zh: '简短交接比事后凭印象回忆更可靠。', en: 'A short handoff is more reliable than recalling the day later.' },
      duration: { zh: '约 2 分钟', en: 'About 2 min' },
    },
    {
      id: 'movement',
      icon: 'movement',
      title: { zh: '安排一次主动活动', en: 'Make room for active play' },
      action: { zh: '记录孩子今天主动游戏、运动或户外活动的片段。', en: 'Record a moment of active play, movement, or outdoor time today.' },
      acceptance: { zh: '留下一个具体活动场景和孩子需要的支持，不做能力评分。', en: 'Leave one concrete activity scene and the support needed without scoring development.' },
      why: { zh: '具体场景能帮助家庭持续提供合适的支持。', en: 'Concrete scenes help the family continue useful support.' },
      duration: { zh: '约 5 分钟', en: 'About 5 min' },
    },
    {
      id: 'independence',
      icon: 'independence',
      title: { zh: '留意一次自主尝试', en: 'Notice one independent attempt' },
      action: { zh: '记录孩子自己完成日常小事时需要的支持。', en: 'Record what support the child needed while trying a daily task independently.' },
      acceptance: { zh: '留下一个具体任务和支持方式，不比较或评分。', en: 'Leave one concrete task and support approach without comparing or scoring.' },
      why: { zh: '把孩子自己的进步和需要交接给下一位照护者。', en: 'Share the child’s own progress and support needs with the next caregiver.' },
      duration: { zh: '约 2 分钟', en: 'About 2 min' },
    },
  ],
}

function dailyTaskDefinitions(stageId = 'newborn-early') {
  const group = stageId?.startsWith('infant') ? 'infant' : stageId?.startsWith('toddler') ? 'toddler' : stageId?.startsWith('child') ? 'child' : null
  return STAGE_DAILY_TASKS[group] || CARE_TASKS
}

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
  'infant-1-2-months': [
    { id: 'infant-1-2-month-review', dueDay: 45, dueLabel: { zh: '1–2 个月阶段', en: 'Months 1–2' }, title: { zh: '回顾 1–2 个月观察', en: 'Review months 1–2 observations' }, detail: { zh: '整理吃奶、睡眠和清醒互动中的稳定事实，不与同龄宝宝比较。', en: 'Gather steady facts about feeding, sleep, and awake interaction without comparing babies.' } },
  ],
  'infant-2-3-months': [
    { id: 'infant-2-3-month-interaction', dueDay: 75, dueLabel: { zh: '2–3 个月阶段', en: 'Months 2–3' }, title: { zh: '记录清醒互动节律', en: 'Notice awake interaction rhythms' }, detail: { zh: '记录宝宝何时更容易清醒、回应和休息，留给照护者交接。', en: 'Notice when the baby is more ready to be awake, respond, and rest for caregiver handoffs.' } },
  ],
  'infant-3-4-months': [
    { id: 'infant-3-4-month-movement', dueDay: 105, dueLabel: { zh: '3–4 个月阶段', en: 'Months 3–4' }, title: { zh: '观察动作变化', en: 'Observe movement changes' }, detail: { zh: '记录抬头、伸手和身体转动等看到的动作变化，不做能力评分。', en: 'Record observed changes such as head control, reaching, and turning without scoring development.' } },
  ],
  'infant-4-6-months': [
    { id: 'infant-4-6-month-exploration', dueDay: 150, dueLabel: { zh: '4–6 个月阶段', en: 'Months 4–6' }, title: { zh: '记录新的探索事实', en: 'Record new exploration facts' }, detail: { zh: '把伸手、抓握、声音和新的进食事实分开记录，保留发生时间。', en: 'Record reaching, grasping, sounds, and new feeding facts separately with their dates.' } },
  ],
  'infant-6-9-months': [
    { id: 'infant-6-9-month-safety', dueDay: 225, dueLabel: { zh: '6–9 个月阶段', en: 'Months 6–9' }, title: { zh: '检查移动空间安全', en: 'Check the moving space' }, detail: { zh: '随着翻身、爬行或坐起变化，重新检查地面、家具和可触及物品。', en: 'As rolling, crawling, or sitting changes, recheck floors, furniture, and reachable objects.' } },
  ],
  'infant-9-12-months': [
    { id: 'infant-9-12-month-communication', dueDay: 315, dueLabel: { zh: '9–12 个月阶段', en: 'Months 9–12' }, title: { zh: '整理声音和手势互动', en: 'Review sounds and gestures' }, detail: { zh: '记录宝宝用声音、表情或手势表达需求的具体场景。', en: 'Record concrete moments when the baby uses sounds, expressions, or gestures to communicate.' } },
  ],
  'toddler-12-15-months': [
    { id: 'toddler-12-15-month-review', dueDay: 410, dueLabel: { zh: '12–15 个月阶段', en: 'Months 12–15' }, title: { zh: '完成一岁后成长回顾', en: 'Review the first year after birth' }, detail: { zh: '把移动、沟通、进食和日常照护中最有变化的事实整理出来。', en: 'Gather the biggest changes in movement, communication, feeding, and daily care.' } },
  ],
  'toddler-15-18-months': [
    { id: 'toddler-15-18-month-independence', dueDay: 500, dueLabel: { zh: '15–18 个月阶段', en: 'Months 15–18' }, title: { zh: '记录自主尝试', en: 'Record independent attempts' }, detail: { zh: '记录宝宝尝试自己走、拿、吃或表达时需要什么支持。', en: 'Record what support the baby needs while trying to walk, hold, eat, or communicate independently.' } },
  ],
  'toddler-18-24-months': [
    { id: 'toddler-18-24-month-handoff', dueDay: 620, dueLabel: { zh: '18–24 个月阶段', en: 'Months 18–24' }, title: { zh: '更新日常照护交接', en: 'Refresh the daily care handoff' }, detail: { zh: '把睡眠、进食、情绪和安抚方式更新成全家都能复述的事实。', en: 'Update sleep, feeding, emotions, and soothing facts so every caregiver can repeat them.' } },
  ],
  'child-2-3-years': [
    { id: 'child-2-3-year-review', dueDay: 820, dueLabel: { zh: '2–3 岁阶段', en: 'Years 2–3' }, title: { zh: '回顾两岁阶段变化', en: 'Review the second-year changes' }, detail: { zh: '整理语言、游戏、生活自理和家庭节律中的具体变化。', en: 'Gather concrete changes in language, play, self-care, and family routines.' } },
  ],
  'child-3-4-years': [
    { id: 'child-3-4-year-observation', dueDay: 1180, dueLabel: { zh: '3–4 岁阶段', en: 'Years 3–4' }, title: { zh: '观察游戏、表达和自理', en: 'Observe play, expression, and self-care' }, detail: { zh: '用具体场景记录孩子如何游戏、表达想法和完成日常小事。', en: 'Use concrete scenes to record play, expression, and everyday self-care.' } },
  ],
  'child-4-5-years': [
    { id: 'child-4-5-year-routine', dueDay: 1540, dueLabel: { zh: '4–5 岁阶段', en: 'Years 4–5' }, title: { zh: '整理情绪和日常节律', en: 'Review emotions and routines' }, detail: { zh: '记录触发情绪变化的场景、有效的安抚方式和一天的主要节律。', en: 'Record situations linked to emotional changes, helpful soothing, and the day’s main routines.' } },
  ],
  'child-5-6-years': [
    { id: 'child-5-6-year-review', dueDay: 1900, dueLabel: { zh: '5–6 岁阶段', en: 'Years 5–6' }, title: { zh: '完成入学前成长回顾', en: 'Complete a pre-school-age review' }, detail: { zh: '整理生活自理、沟通、游戏和家庭需要继续支持的事实。', en: 'Gather facts about self-care, communication, play, and support the family wants to continue.' } },
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
  { id: 'weight', label: { zh: '体重', en: 'Weight' }, unit: 'kg', min: 0, max: 40 },
  { id: 'length', label: { zh: '身长', en: 'Length' }, unit: 'cm', min: 0, max: 160 },
  { id: 'headCircumference', label: { zh: '头围', en: 'Head circumference' }, unit: 'cm', min: 0, max: 70 },
]

function id(prefix) {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function localDateKey(value = new Date()) {
  try {
    return calendarDateKey(value)
  } catch {
    return ''
  }
}

export function getDailyTasks(taskLogs = [], date = new Date(), stageId = 'newborn-early') {
  const dateKey = localDateKey(date)
  return dailyTaskDefinitions(stageId).map((task) => {
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
    id: input.id || options.id || id('growth'),
    type,
    value: String(input.value ?? '').trim(),
    unit: input.unit || definition.unit,
    measuredAt: input.measuredAt || localDateKey(),
    source: input.source ? String(input.source).trim() : 'caregiver_observation',
    method: input.method ? String(input.method).trim() : null,
    ageBasis: input.ageBasis || null,
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

export function getDailyHealthReminders(taskLogs = [], ageDays = 0, date = new Date()) {
  const dateKey = localDateKey(date)
  const guidance = getInfantMonthlyGuidance(ageDays)
  const nutrition = guidance?.month <= 6 && guidance.supplement
    ? [{ id: `nutrition-month-${guidance.month}`, title: { zh: `第${guidance.month}个月营养补充`, en: `Month ${guidance.month} nutrition` }, detail: guidance.supplement }]
    : ageDays < 180
      ? [{ id: 'nutrition-vitamin-d', title: { zh: '维生素 D', en: 'Vitamin D' }, detail: { zh: '按儿保或医生确认的每日方案补充', en: 'Follow the daily plan confirmed by child health care or a clinician' } }]
      : ageDays < 730
        ? [{ id: 'nutrition-iron-food', title: { zh: '富铁食物', en: 'Iron-rich food' }, detail: { zh: '今天的辅食包含一种富铁动物性食物', en: 'Include one iron-rich animal food in today’s complementary feeding' } }]
        : [{ id: 'nutrition-variety', title: { zh: '食物多样', en: 'Food variety' }, detail: { zh: '今天正餐兼顾主食、蛋白质和蔬果', en: 'Include staple food, protein, vegetables, and fruit today' } }]
  const routine = guidance ? [{ id: `routine-month-${guidance.month}`, title: { zh: `第${guidance.month}个月作息`, en: `Month ${guidance.month} rhythm` }, detail: guidance.schedule }] : []
  const attachStatus = (item) => {
    const log = taskLogs.find((entry) => entry.taskId === item.id && entry.date === dateKey)
    return { ...item, date: dateKey, status: log?.status || 'pending' }
  }
  return { nutrition: nutrition.map(attachStatus), routine: routine.map(attachStatus) }
}
