import test from 'node:test'
import assert from 'node:assert/strict'
import { NAIBA_SKILLS, selectNaibaSkill } from '../src/domain/naibaSkills.js'
import { buildNaibaLocalAnswer } from '../src/domain/naibaLocalAnswer.js'

test('Naiba AI exposes the thirteen approved skill contracts', () => {
  assert.equal(NAIBA_SKILLS.length, 13)
  assert.ok(NAIBA_SKILLS.some((skill) => skill.id === 'daily_feeding_recommender'))
  assert.ok(NAIBA_SKILLS.some((skill) => skill.id === 'triage_and_preassessment'))
  assert.equal(NAIBA_SKILLS.some((skill) => skill.id === 'care_event_quick_logger'), false)
})

test('free text intent selects feeding or triage skill without restricting the entry point', () => {
  assert.equal(selectNaibaSkill('今天宝宝吃多少？').id, 'daily_feeding_recommender')
  assert.equal(selectNaibaSkill('宝宝呼吸好像有点费力').id, 'triage_and_preassessment')
  assert.equal(selectNaibaSkill('怎么建立睡眠习惯？').id, 'stage_parenting_qa')
  assert.equal(selectNaibaSkill('宝宝呼吸困难', 'stage_parenting_qa').id, 'triage_and_preassessment')
})

test('unknown worried messages default to triage and record wording never selects an AI draft skill', () => {
  assert.equal(selectNaibaSkill('我的宝宝不对，我很担心').id, 'triage_and_preassessment')
  assert.equal(selectNaibaSkill('帮我记录刚喝了60毫升配方奶').id, 'daily_feeding_recommender')
  assert.match(buildNaibaLocalAnswer('帮我记录一片尿布'), /“记录”页/)
  assert.doesNotMatch(buildNaibaLocalAnswer('帮我记录一片尿布'), /生成记录草稿/)
})
