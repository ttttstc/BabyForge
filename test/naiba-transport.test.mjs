import test from 'node:test'
import assert from 'node:assert/strict'

import { naibaFallbackMessage, parseNaibaSse } from '../src/domain/naibaTransport.js'
import { describeNaibaAgentFailure } from '../functions/_shared/naibaAgent.js'

test('Naiba SSE parser keeps answer text and top-level fallback metadata', () => {
  const result = parseNaibaSse([
    'data: {"type":"message","delta":"本地回答"}',
    'data: {"type":"meta","fallback":true,"reason":"provider_auth_failed"}',
    'data: {"type":"done"}',
  ].join('\n\n'))
  assert.equal(result.text, '本地回答')
  assert.equal(result.fallback, true)
  assert.equal(result.meta.reason, 'provider_auth_failed')
  assert.match(naibaFallbackMessage(result.meta.reason), /API Key/)
})

test('Naiba SSE parser accepts nested legacy metadata and rejects stream errors', () => {
  const result = parseNaibaSse('data: {"meta":{"fallback":true,"reason":"provider_timeout"}}\n\ndata: {"delta":"回答"}\n\n')
  assert.equal(result.text, '回答')
  assert.equal(result.meta.reason, 'provider_timeout')
  assert.throws(() => parseNaibaSse('data: {"error":"provider failed"}\n\n'), /provider failed/)
})

test('Naiba agent failures expose safe actionable categories', () => {
  assert.deepEqual(describeNaibaAgentFailure({ status: 401 }), { reason: 'provider_auth_failed', status: 401 })
  assert.deepEqual(describeNaibaAgentFailure({ status: 404 }), { reason: 'provider_endpoint_not_found', status: 404 })
  assert.deepEqual(describeNaibaAgentFailure({ name: 'MaxTurnsExceededError', message: 'Max turns (4) exceeded' }), { reason: 'model_response_invalid', status: 502 })
  assert.deepEqual(describeNaibaAgentFailure({ name: 'AbortError' }), { reason: 'provider_timeout', status: 504 })
})
