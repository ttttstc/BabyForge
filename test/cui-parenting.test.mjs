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

test('daily reminders keep rhythm and nutrition separate from the parent guide', () => {
  const date = new Date('2026-08-07T12:00:00+08:00')
  const reminders = getDailyHealthReminders([], 93, date)
  assert.deepEqual(Object.keys(reminders).sort(), ['nutrition', 'routine'])
  assert.equal(reminders.routine[0].id, 'routine-month-4')
  assert.equal(reminders.nutrition[0].id, 'nutrition-month-4')
  assert.match(reminders.routine[0].detail.zh, /07:30.*11:30/s)
  assert.match(reminders.nutrition[0].detail.zh, /重点营养：铁/)
  assert.equal(reminders.care, undefined)
  assert.equal(reminders.development, undefined)
})

test('months 1–6 keep the detailed care and early-learning content in the guidance source', () => {
  const expected = [
    [0, '脐带脱落', '黑白卡追视'],
    [31, '肠胀气的表现', '复杂形状黑白卡'],
    [61, '距离宝宝眼睛30厘米', '黑白红卡'],
    [92, '口水疹', '尾巴布书故事'],
    [122, '长牙了', '趴着追红球'],
    [153, '补铁是关键', '独坐'],
  ]
  for (const [ageDays, careText, learningText] of expected) {
    const guidance = getInfantMonthlyGuidance(ageDays)
    assert.match(guidance.care.zh, new RegExp(careText))
    assert.match(guidance.learning.zh, new RegExp(learningText))
    assert.ok(guidance.schedule.zh.split('\n').length >= 5)
    assert.ok(guidance.supplement.zh)
  }
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
