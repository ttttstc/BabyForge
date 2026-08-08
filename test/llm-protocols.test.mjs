import test from 'node:test'
import assert from 'node:assert/strict'
import { LLM_PROTOCOLS } from '../functions/_shared/llmConfig.js'
import { runNaibaAgent } from '../functions/_shared/naibaAgent.js'

function input() {
  return {
    message: '今天需要观察什么？',
    skillId: 'stage_parenting_qa',
    baby: { id: 'protocol-test', name: '宝宝', birthDate: '2026-07-29', sex: 'male', locale: 'zh-CN' },
    careEvents: [],
    locale: 'zh-CN',
    model: 'test-model',
    apiKey: 'test-key',
  }
}

test('OpenAI Chat Completions protocol uses standard chat request', async () => {
  let requestBody
  const answer = await runNaibaAgent({
    ...input(),
    baseURL: 'https://provider.test/v1',
    protocol: LLM_PROTOCOLS.OPENAI_CHAT_COMPLETIONS,
    transportFetch: async (_url, init) => {
      requestBody = JSON.parse(init.body)
      return new Response(JSON.stringify({ id: 'test-completion', object: 'chat.completion', created: 1, model: 'test-model', choices: [{ index: 0, message: { role: 'assistant', content: '继续观察吃奶、尿便和精神状态。' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  assert.match(answer, /吃奶/)
  assert.equal(requestBody.messages[0].role, 'system')
  assert.equal(requestBody.model, 'test-model')
  assert.equal(requestBody.reasoning_effort, 'high')
  assert.equal('thinking' in requestBody, false)
})

test('OpenAI Chat Completions enables DeepSeek thinking mode', async () => {
  let requestBody
  const answer = await runNaibaAgent({
    ...input(),
    model: 'deepseek-v4-flash',
    baseURL: 'https://token.sensenova.cn',
    protocol: LLM_PROTOCOLS.OPENAI_CHAT_COMPLETIONS,
    transportFetch: async (_url, init) => {
      requestBody = JSON.parse(init.body)
      return new Response(JSON.stringify({ id: 'test-completion', object: 'chat.completion', created: 1, model: 'deepseek-v4-flash', choices: [{ index: 0, message: { role: 'assistant', content: '继续观察吃奶、尿便和精神状态。' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  assert.match(answer, /吃奶/)
  assert.equal(requestBody.reasoning_effort, 'high')
  assert.deepEqual(requestBody.thinking, { type: 'enabled' })
})

test('OpenAI Responses protocol sends high reasoning effort', async () => {
  let requestBody
  const answer = await runNaibaAgent({
    ...input(),
    baseURL: 'https://provider.test/v1',
    protocol: LLM_PROTOCOLS.OPENAI_RESPONSES,
    useResponses: true,
    transportFetch: async (_url, init) => {
      requestBody = JSON.parse(init.body)
      return new Response(JSON.stringify({
        id: 'test-response',
        object: 'response',
        created_at: 1,
        status: 'completed',
        output: [{ id: 'test-message', type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '继续观察吃奶、尿便和精神状态。', annotations: [] }] }],
        output_text: '继续观察吃奶、尿便和精神状态。',
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  assert.match(answer, /尿便/)
  assert.deepEqual(requestBody.reasoning, { effort: 'high' })
})

test('Anthropic Messages protocol maps native headers and content blocks', async () => {
  let requestUrl
  let requestHeaders
  let requestBody
  const answer = await runNaibaAgent({
    ...input(),
    baseURL: 'https://api.anthropic.com/v1',
    protocol: LLM_PROTOCOLS.ANTHROPIC_MESSAGES,
    transportFetch: async (url, init) => {
      requestUrl = url
      requestHeaders = new Headers(init.headers)
      requestBody = JSON.parse(init.body)
      return new Response(JSON.stringify({ content: [{ type: 'text', text: '继续观察吃奶、尿便和精神状态。' }] }), { status: 200 })
    },
  })
  assert.match(answer, /尿便/)
  assert.equal(requestUrl, 'https://api.anthropic.com/v1/messages')
  assert.equal(requestHeaders.get('x-api-key'), 'test-key')
  assert.equal(requestHeaders.get('anthropic-version'), '2023-06-01')
  assert.equal(requestBody.system.includes('BabyForge Naiba AI'), true)
  assert.equal(requestBody.max_tokens, 4096)
  assert.deepEqual(requestBody.thinking, { type: 'enabled', budget_tokens: 2048 })
  assert.deepEqual(requestBody.output_config, { effort: 'high' })
})
