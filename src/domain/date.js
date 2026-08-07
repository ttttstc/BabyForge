const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function assertDateParts(year, month, day) {
  const stamp = Date.UTC(year, month - 1, day)
  const parsed = new Date(stamp)
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new TypeError('Invalid calendar date')
  }
}

function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Return the calendar date in the host timezone. Date-only values stay
 * date-only so parsing them never shifts the day through UTC.
 */
export function calendarDateKey(value = new Date()) {
  if (typeof value === 'string') {
    const match = DATE_ONLY_RE.exec(value)
    if (match) {
      const [, year, month, day] = match.map(Number)
      assertDateParts(year, month, day)
      return value
    }
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new TypeError('Invalid date')
  return formatLocalDate(date)
}

export function calendarDayNumber(value) {
  const [year, month, day] = calendarDateKey(value).split('-').map(Number)
  return Date.UTC(year, month - 1, day) / 86_400_000
}
