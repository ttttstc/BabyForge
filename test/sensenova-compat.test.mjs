import test from 'node:test'
import assert from 'node:assert/strict'
import { isSenseNovaGateway, runNaibaAgent } from '../functions/_shared/naibaAgent.js'

test('SenseNova uses text-only chat compatibility instead of Agents tools', async () => {
  assert.equal(isSenseNovaGateway('https://token.sensenova.cn/v1'), true)
  const calls = []
  const transportFetch = async (_input, init = {}) => {
    calls.push(JSON.parse(String(init.body || '{}')))
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: '今天继续观察吃奶、尿便和精神状态。' } }] }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const answer = await runNaibaAgent({
    message: '今天需要观察什么？',
    skillId: 'stage_parenting_qa',
    baby: { id: 'compat-test', name: '宝宝', birthDate: '2026-07-29', sex: 'male', locale: 'zh-CN' },
    careEvents: [],
    locale: 'zh-CN',
    model: 'deepseek-v4-flash',
    apiKey: 'test-key',
    baseURL: 'https://token.sensenova.cn/v1',
    useResponses: false,
    transportFetch,
  })
  assert.match(answer, /吃奶/)
  assert.equal(calls.length, 1)
  assert.equal('tools' in calls[0], false)
  assert.equal('max_tokens' in calls[0], false)
})
