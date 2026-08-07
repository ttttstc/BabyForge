import test from 'node:test'
import assert from 'node:assert/strict'
import { NAIBA_SKILLS, selectNaibaSkill } from '../src/domain/naibaSkills.js'

test('Naiba AI exposes the planned fourteen skill contracts', () => {
  assert.equal(NAIBA_SKILLS.length, 14)
  assert.ok(NAIBA_SKILLS.some((skill) => skill.id === 'daily_feeding_recommender'))
  assert.ok(NAIBA_SKILLS.some((skill) => skill.id === 'triage_and_preassessment'))
})

test('free text intent selects feeding or triage skill without restricting the entry point', () => {
  assert.equal(selectNaibaSkill('今天宝宝吃多少？').id, 'daily_feeding_recommender')
  assert.equal(selectNaibaSkill('宝宝呼吸好像有点费力').id, 'triage_and_preassessment')
  assert.equal(selectNaibaSkill('怎么建立睡眠习惯？').id, 'stage_parenting_qa')
  assert.equal(selectNaibaSkill('宝宝呼吸困难', 'stage_parenting_qa').id, 'triage_and_preassessment')
})
