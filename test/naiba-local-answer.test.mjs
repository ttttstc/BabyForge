import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNaibaLocalAnswer } from '../src/domain/naibaLocalAnswer.js'

test('local Naiba fallback speaks naturally instead of explaining the model', () => {
  const answer = buildNaibaLocalAnswer('你好')
  assert.equal(answer, '我在这儿。你直接告诉我现在最担心什么就好：吃、睡、排便，或者哪里和平时不一样，我们一起一步一步捋清楚。')
  assert.doesNotMatch(answer, /知识库|缺失信息|依据|模型/)
})

test('local Naiba fallback keeps the safety floor for urgent messages', () => {
  const answer = buildNaibaLocalAnswer('宝宝呼吸好像不对')
  assert.match(answer, /马上联系急救或儿科服务/)
})
