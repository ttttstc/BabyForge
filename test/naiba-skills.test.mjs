import test from 'node:test'
import assert from 'node:assert/strict'
import { isCurrentBabyHealthComplaint, NAIBA_SKILLS, selectNaibaSkill } from '../src/domain/naibaSkills.js'
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

test('health knowledge stays with knowledge skills while current baby observations enter triage', () => {
  for (const message of ['黄疸是什么病？', '婴儿睡眠安全怎么做？', '宝宝呼吸怎么发育？', '宝宝不爱睡觉怎么办？', '健康问题有哪些？']) {
    assert.equal(isCurrentBabyHealthComplaint(message), false, message)
  }
  for (const message of ['宝宝现在皮肤发黄，怎么办？', '宝宝体温 38.2℃', '宝宝吃奶少怎么办？', '宝宝睡觉总是趴着', '我的宝宝不对，我很担心']) {
    assert.equal(isCurrentBabyHealthComplaint(message), true, message)
  }
  assert.equal(selectNaibaSkill('黄疸是什么病？').id, 'disease_explainer')
  assert.equal(selectNaibaSkill('婴儿睡眠安全怎么做？').id, 'stage_parenting_qa')
  assert.equal(selectNaibaSkill('宝宝发热是什么原因？').id, 'triage_and_preassessment')
})

test('unknown worried messages default to triage and record wording never selects an AI draft skill', () => {
  assert.equal(selectNaibaSkill('我的宝宝不对，我很担心').id, 'triage_and_preassessment')
  assert.equal(selectNaibaSkill('帮我记录刚喝了60毫升配方奶').id, 'daily_feeding_recommender')
  assert.match(buildNaibaLocalAnswer('帮我记录一片尿布'), /“记录”页/)
  assert.doesNotMatch(buildNaibaLocalAnswer('帮我记录一片尿布'), /生成记录草稿/)
})
