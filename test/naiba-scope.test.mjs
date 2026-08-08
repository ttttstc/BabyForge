import test from 'node:test'
import assert from 'node:assert/strict'
import { isNaibaContextualFollowUp, isNaibaTopicInScope, NAIBA_OUT_OF_SCOPE_MESSAGE } from '../src/domain/naibaScope.js'

test('Naiba scope keeps parenting questions and rejects unrelated topics', () => {
  assert.equal(isNaibaTopicInScope('10天宝宝吃奶和睡眠怎么观察？'), true)
  assert.equal(isNaibaTopicInScope('宝宝今天要不要接种疫苗？'), true)
  assert.equal(isNaibaTopicInScope('你好'), true)
  assert.equal(isNaibaTopicInScope('你好，介绍一下你能帮我做什么'), true)
  assert.equal(isNaibaTopicInScope('你好，帮我写一个股票交易策略'), false)
  assert.equal(isNaibaTopicInScope('帮我写一个股票交易策略'), false)
  assert.equal(isNaibaTopicInScope('今天上海天气怎么样？'), false)
  assert.equal(isNaibaContextualFollowUp('38.5℃'), true)
  assert.equal(isNaibaContextualFollowUp('股票'), false)
})

test('Naiba out-of-scope reply stays a single product message', () => {
  assert.equal(NAIBA_OUT_OF_SCOPE_MESSAGE, '抱歉，我只是个育儿辅助助手，请跟我讨论关于育儿相关的话题')
})
