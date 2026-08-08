import test from 'node:test'
import assert from 'node:assert/strict'

import { onRequestDelete, onRequestGet, onRequestPut } from '../functions/api/ai/config.js'
import { maskLlmApiKey, normalizeLlmBaseUrl, resolvedLlmConfig } from '../functions/_shared/llmConfig.js'

function fixture({ role = 'admin', config = null } = {}) {
  const session = { token: 'token', expires_at: '2099-01-01T00:00:00.000Z', id: 'account-1', username: 'niwa', role, display_name: '管理员' }
  let row = config ? { ...config } : null
  const DB = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('FROM auth_sessions')) return session
              if (sql.includes('FROM account_llm_configs')) return row
              return null
            },
            async run() {
              if (sql.includes('INSERT INTO account_llm_configs')) row = { base_url: args[1], model: args[2], api_key: args[3], updated_at: args[4] }
              if (sql.includes('DELETE FROM account_llm_configs')) row = null
              return { meta: { changes: 1 } }
            },
          }
        },
      }
    },
  }
  return { DB, get row() { return row } }
}

function request(method = 'GET', body) {
  return new Request('https://babyforge.test/api/ai/config', {
    method,
    headers: { cookie: 'babyforge_session=token', ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

test('custom LLM configuration takes account values before deployment defaults', () => {
  const custom = resolvedLlmConfig({ OPENAI_API_KEY: 'default-key', OPENAI_BASE_URL: 'https://default.test/v1', OPENAI_MODEL: 'default-model', OPENAI_USE_RESPONSES: 'true' }, { apiKey: 'account-key', baseUrl: 'https://account.test', model: 'account-model' })
  assert.deepEqual(custom, { apiKey: 'account-key', baseUrl: 'https://account.test/v1', model: 'account-model', useResponses: false })
  assert.deepEqual(resolvedLlmConfig({ OPENAI_API_KEY: 'default-key' }), { apiKey: 'default-key', baseUrl: '', model: 'gpt-4o-mini', useResponses: undefined })
  assert.deepEqual(resolvedLlmConfig({ OPENAI_API_KEY: 'default-key', OPENAI_BASE_URL: 'https://gateway.test' }), { apiKey: 'default-key', baseUrl: 'https://gateway.test/v1', model: 'gpt-4o-mini', useResponses: false })
  assert.equal(resolvedLlmConfig({ OPENAI_API_KEY: 'default-key', OPENAI_BASE_URL: 'https://gateway.test/v1', OPENAI_USE_RESPONSES: 'true' }).useResponses, true)
})

test('LLM config API saves only the current account and never returns the raw key', async () => {
  const env = fixture()
  const put = await onRequestPut({ request: request('PUT', { baseUrl: 'https://provider.test/v1///', model: '  baby-model ', apiKey: 'account-secret-key' }), env })
  assert.equal(put.status, 200)
  const payload = await put.json()
  assert.equal(payload.config.baseUrl, 'https://provider.test/v1')
  assert.equal(payload.config.model, 'baby-model')
  assert.equal(payload.config.apiKey, undefined)
  assert.equal(payload.config.apiKeyMasked, maskLlmApiKey('account-secret-key'))
  assert.equal(env.row.api_key, 'account-secret-key')

  const get = await onRequestGet({ request: request(), env })
  assert.equal(get.status, 200)
  assert.equal((await get.json()).config.apiKey, undefined)

  const keepKey = await onRequestPut({ request: request('PUT', { baseUrl: 'https://provider.test/v2', model: 'baby-model', apiKey: '' }), env })
  assert.equal(keepKey.status, 200)
  assert.equal(env.row.api_key, 'account-secret-key')

  const deleted = await onRequestDelete({ request: request('DELETE'), env })
  assert.equal(deleted.status, 200)
  assert.equal(env.row, null)
})

test('LLM config API validates URLs and keeps guest accounts read-only', async () => {
  assert.equal(normalizeLlmBaseUrl('https://provider.test'), 'https://provider.test/v1')
  assert.equal(normalizeLlmBaseUrl('https://provider.test/openai/v1/'), 'https://provider.test/openai/v1')
  assert.throws(() => normalizeLlmBaseUrl('javascript:alert(1)'), /http 或 https/)
  const guest = fixture({ role: 'guest' })
  const response = await onRequestPut({ request: request('PUT', { baseUrl: 'https://provider.test/v1', model: 'baby-model', apiKey: 'secret' }), env: guest })
  assert.equal(response.status, 403)
})
