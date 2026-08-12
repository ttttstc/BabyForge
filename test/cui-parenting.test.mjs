import test from 'node:test'
import assert from 'node:assert/strict'

import { getCuiYutaoColumn, getInfantMonthlyGuidance } from '../src/content/cuiParenting.js'
import { getDailyHealthReminders } from '../src/domain/carePlan.js'

test('0–12 month guidance advances at month boundaries and stops after the first year', () => {
  assert.equal(getInfantMonthlyGuidance(0).month, 1)
  assert.equal(getInfantMonthlyGuidance(30).month, 1)
  assert.equal(getInfantMonthlyGuidance(31).month, 2)
  assert.equal(getInfantMonthlyGuidance(182).month, 6)
  assert.equal(getInfantMonthlyGuidance(183).month, 7)
  assert.equal(getInfantMonthlyGuidance(365).month, 12)
  assert.equal(getInfantMonthlyGuidance(366), null)
})

test('daily reminders expose rhythm, existing nutrition, care, and early learning', () => {
  const date = new Date('2026-08-07T12:00:00+08:00')
  const reminders = getDailyHealthReminders([], 93, date)
  assert.equal(reminders.routine[0].id, 'routine-month-4')
  assert.equal(reminders.nutrition[0].id, 'nutrition-vitamin-d')
  assert.equal(reminders.care[0].id, 'care-month-4')
  assert.equal(reminders.development[0].id, 'development-month-4')
  assert.match(reminders.routine[0].detail.zh, /12–16小时/)
})

test('Cui Yutao column contains every 0–12 month stage and prioritizes the current one', () => {
  const column = getCuiYutaoColumn('solid-food-start')
  assert.equal(column.curated, true)
  assert.equal(column.articles.length, 5)
  assert.equal(column.articles[0].ageLabel, '6～8个月')
  assert.equal(column.articles[0].isCurrent, true)
  assert.match(column.notice, /未经崔玉涛本人审核或授权/)
  assert.ok(column.articles.every((article) => article.principles.length === 3 && article.practice && article.url))
})
