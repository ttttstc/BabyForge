const DAY_MS = 86_400_000

const STAGES = [
  { id: 'newborn-early', label: '新生儿早期', rangeLabel: '出生后 0–7 天', min: 0, max: 7 },
  { id: 'newborn-adaptation', label: '新生儿适应期', rangeLabel: '出生后 8–28 天', min: 8, max: 28 },
]

const TODAY_PRIORITIES = [
  { id: 'feeding', title: '观察吃奶和吞咽', description: '记录喂养方式与和平时相比的变化。', assetKey: 'feeding' },
  { id: 'elimination', title: '记录尿便情况', description: '只记录家长看到的次数与变化。', assetKey: 'elimination' },
  { id: 'safe-sleep', title: '确认安全睡眠环境', description: '查看教育示意，不替代专业指导。', assetKey: 'safeSleep' },
]

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

export function getStage(ageDays) {
  const stage = STAGES.find(({ min, max }) => ageDays >= min && ageDays <= max)
  return stage || {
    id: 'out-of-scope',
    label: '超出 MVP 范围',
    rangeLabel: '当前研究原型仅覆盖出生后 0–28 天',
    min: 29,
    max: Infinity,
  }
}

export function getTodayPriorities() {
  return TODAY_PRIORITIES.map((item) => ({ ...item }))
}
