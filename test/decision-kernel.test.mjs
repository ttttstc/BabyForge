import test from 'node:test'
import assert from 'node:assert/strict'
import { extractDecisionFacts, parseDecisionAnswer, runDecisionUnit, runUniversalSafetyGate, selectDecisionUnit } from '../src/domain/decisionKernel.js'

test('decision kernel asks for the highest-value missing fact', () => {
  const result = runDecisionUnit({ unitId: 'general_health_preassessment', facts: { breathing: 'steady' } })
  assert.equal(result.status, 'needs_information')
  assert.equal(result.nextQuestion.key, 'alertness')
  assert.equal(result.actions.length, 0)
})

test('universal safety floor cannot be lowered by missing-information flow', () => {
  const result = runDecisionUnit({ unitId: 'general_health_preassessment', facts: { alertness: 'unresponsive', breathing: 'unknown' } })
  assert.equal(result.status, 'safety_action_required')
  assert.match(result.minimumAction, /急救或儿科服务/)
})

test('unknown decision unit fails closed', () => {
  assert.equal(runDecisionUnit({ unitId: 'not-published' }).status, 'unsupported')
  assert.equal(runUniversalSafetyGate({}).status, 'clear')
})

test('decision answer parsing keeps free text inside the published fact vocabulary', () => {
  assert.equal(parseDecisionAnswer('alertness', '宝宝容易叫醒'), 'responsive')
  assert.equal(parseDecisionAnswer('breathing', '嘴唇有点发青'), 'blue_lips')
  assert.deepEqual(extractDecisionFacts('吃奶明显少，湿尿布也少'), { feedingChange: 'decreased', wetDiapers: 'low' })
  assert.equal(parseDecisionAnswer('breathing', '我不确定'), undefined)
})

test('five specialist decision units publish one highest-value question at a time', () => {
  for (const unitId of ['feeding_change', 'temperature_abnormal', 'breathing_abnormal', 'jaundice_observation', 'safe_sleep']) {
    const result = runDecisionUnit({ unitId, facts: { ageDays: 6 } })
    assert.equal(result.status, 'needs_information')
    assert.ok(result.nextQuestion?.key)
  }
})

test('newborn objective danger rules cannot be lowered by missing fields', () => {
  assert.equal(runDecisionUnit({ unitId: 'temperature_abnormal', facts: { ageDays: 6, temperatureC: 38.2 } }).status, 'safety_action_required')
  assert.equal(runDecisionUnit({ unitId: 'breathing_abnormal', facts: { ageDays: 6, breathingRate: 65 } }).status, 'safety_action_required')
  assert.equal(runDecisionUnit({ unitId: 'jaundice_observation', facts: { ageDays: 2, jaundiceOnset: 'first_24h' } }).status, 'safety_action_required')
  assert.equal(runDecisionUnit({ unitId: 'safe_sleep', facts: { ageDays: 10, sleepPosition: 'stomach' } }).status, 'safety_action_required')
})

test('decision intent and structured fact extraction cover specialist flows', () => {
  assert.equal(selectDecisionUnit('宝宝黄疸怎么观察'), 'jaundice_observation')
  assert.equal(selectDecisionUnit('宝宝趴睡安全吗'), 'safe_sleep')
  assert.deepEqual(extractDecisionFacts('腋下体温 38.2℃'), { measurementMethod: 'axillary', temperatureC: 38.2 })
  assert.equal(extractDecisionFacts('安静时呼吸每分钟 65 次').breathingRate, 65)
})
