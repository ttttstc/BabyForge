const DAY_MS = 86_400_000

const STAGES = [
  { id: 'newborn-early', label: '新生儿早期', labelEn: 'Early newborn', rangeLabel: '出生后 0–7 天', rangeLabelEn: 'Days 0–7', min: 0, max: 7 },
  { id: 'newborn-adaptation', label: '新生儿适应期', labelEn: 'Newborn adjustment', rangeLabel: '出生后 8–28 天', rangeLabelEn: 'Days 8–28', min: 8, max: 28 },
  { id: 'infant-1-2-months', label: '婴儿早期', labelEn: 'Early infancy', rangeLabel: '出生后 1–2 个月', rangeLabelEn: 'Months 1–2', min: 29, max: 59 },
  { id: 'infant-2-3-months', label: '婴儿互动期', labelEn: 'Infant interaction', rangeLabel: '出生后 2–3 个月', rangeLabelEn: 'Months 2–3', min: 60, max: 89 },
  { id: 'infant-3-4-months', label: '婴儿动作期', labelEn: 'Infant movement', rangeLabel: '出生后 3–4 个月', rangeLabelEn: 'Months 3–4', min: 90, max: 119 },
  { id: 'infant-4-6-months', label: '婴儿探索期', labelEn: 'Infant exploration', rangeLabel: '出生后 4–6 个月', rangeLabelEn: 'Months 4–6', min: 120, max: 179 },
  { id: 'infant-6-9-months', label: '婴儿移动期', labelEn: 'Infant mobility', rangeLabel: '出生后 6–9 个月', rangeLabelEn: 'Months 6–9', min: 180, max: 269 },
  { id: 'infant-9-12-months', label: '婴儿沟通期', labelEn: 'Infant communication', rangeLabel: '出生后 9–12 个月', rangeLabelEn: 'Months 9–12', min: 270, max: 364 },
  { id: 'toddler-12-15-months', label: '幼儿起步期', labelEn: 'Early toddlerhood', rangeLabel: '出生后 12–15 个月', rangeLabelEn: 'Months 12–15', min: 365, max: 456 },
  { id: 'toddler-15-18-months', label: '幼儿自主期', labelEn: 'Toddler independence', rangeLabel: '出生后 15–18 个月', rangeLabelEn: 'Months 15–18', min: 457, max: 547 },
  { id: 'toddler-18-24-months', label: '幼儿成长期', labelEn: 'Toddler growth', rangeLabel: '出生后 18–24 个月', rangeLabelEn: 'Months 18–24', min: 548, max: 729 },
  { id: 'child-2-3-years', label: '幼儿后期', labelEn: 'Late toddlerhood', rangeLabel: '2–3 岁', rangeLabelEn: 'Years 2–3', min: 730, max: 1094 },
  { id: 'child-3-4-years', label: '学前早期', labelEn: 'Early preschool', rangeLabel: '3–4 岁', rangeLabelEn: 'Years 3–4', min: 1095, max: 1459 },
  { id: 'child-4-5-years', label: '学前中期', labelEn: 'Preschool middle years', rangeLabel: '4–5 岁', rangeLabelEn: 'Years 4–5', min: 1460, max: 1824 },
  { id: 'child-5-6-years', label: '学前后期', labelEn: 'Preschool later years', rangeLabel: '5–6 岁', rangeLabelEn: 'Years 5–6', min: 1825, max: 2191 },
]

const TODAY_PRIORITIES = [
  { id: 'feeding', title: '观察吃奶和吞咽', description: '记录喂养方式与和平时相比的变化。', assetKey: 'feeding' },
  { id: 'elimination', title: '记录尿便情况', description: '只记录家长看到的次数与变化。', assetKey: 'elimination' },
  { id: 'safe-sleep', title: '确认安全睡眠环境', description: '检查睡眠姿势、睡眠表面和周围物品。', assetKey: 'safeSleep' },
]

const TODAY_PRIORITIES_BY_STAGE = {
  newborn: TODAY_PRIORITIES,
  infant: [
    { id: 'feeding', title: '观察吃奶和进食', description: '记录进食方式与和平时相比的变化。', assetKey: 'feeding' },
    { id: 'interaction', title: '留意清醒互动', description: '记录宝宝回应声音、表情和互动的具体片段。', assetKey: 'interaction' },
    { id: 'sleep-rhythm', title: '记录睡眠节律', description: '记下入睡、醒来和需要安抚的时间点。', assetKey: 'sleep' },
  ],
  toddler: [
    { id: 'meals', title: '观察一餐进食', description: '记录孩子吃了什么、如何参与和需要什么支持。', assetKey: 'feeding' },
    { id: 'movement', title: '留出一次主动活动', description: '记录孩子今天主动移动、游戏或探索的片段。', assetKey: 'movement' },
    { id: 'communication', title: '记录一次表达', description: '记下孩子用语言、动作或表情表达需要的场景。', assetKey: 'interaction' },
  ],
  child: [
    { id: 'routine', title: '回顾今天的生活节律', description: '记录睡眠、进食和活动中最值得交接的一件事。', assetKey: 'routine' },
    { id: 'movement', title: '安排一次主动活动', description: '记录孩子今天主动游戏、运动或户外活动的片段。', assetKey: 'movement' },
    { id: 'independence', title: '留意一次自主尝试', description: '记录孩子自己完成日常小事时需要的支持。', assetKey: 'independence' },
  ],
}

export const SEX_LABELS = { male: '男孩', female: '女孩' }

export function getSexLabel(sex, locale = 'zh-CN') {
  if (locale === 'en-US') return sex === 'male' ? 'Boy' : sex === 'female' ? 'Girl' : 'Sex not set'
  return SEX_LABELS[sex] || '性别未设置'
}

function dayNumber(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new TypeError('Invalid date')
    return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / DAY_MS
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  if (!match) throw new TypeError('Date must use YYYY-MM-DD')
  const [, year, month, day] = match.map(Number)
  const stamp = Date.UTC(year, month - 1, day)
  const parsed = new Date(stamp)
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new TypeError('Invalid calendar date')
  }
  return stamp / DAY_MS
}

export function getAgeDays(birthDate, today = new Date()) {
  const days = dayNumber(today) - dayNumber(birthDate)
  if (days < 0) throw new RangeError('Birth date cannot be in the future')
  return days
}

export function getStages() {
  return STAGES.map((stage) => ({ ...stage }))
}

export function getStageLabel(stage, locale = 'zh-CN') {
  return locale === 'en-US' ? stage?.labelEn || '' : stage?.label || ''
}

export function getStageRangeLabel(stage, locale = 'zh-CN') {
  return locale === 'en-US' ? stage?.rangeLabelEn || '' : stage?.rangeLabel || ''
}

export function getStage(ageDays) {
  const stage = STAGES.find(({ min, max }) => ageDays >= min && ageDays <= max)
  return stage || {
    id: 'out-of-scope',
    label: '超出 0–6 岁范围',
    labelEn: 'Outside the 0–6 year range',
    rangeLabel: '当前工作台覆盖出生后 0 天至 6 岁',
    rangeLabelEn: 'This workspace covers birth through 6 years',
    min: 2192,
    max: Infinity,
  }
}

export function getTodayPriorities(stageOrId = 'newborn-early') {
  const stageId = typeof stageOrId === 'string' ? stageOrId : stageOrId?.id
  const group = stageId?.startsWith('newborn')
    ? 'newborn'
    : stageId?.startsWith('infant')
      ? 'infant'
      : stageId?.startsWith('toddler')
        ? 'toddler'
        : 'child'
  return (TODAY_PRIORITIES_BY_STAGE[group] || TODAY_PRIORITIES).map((item) => ({ ...item }))
}
