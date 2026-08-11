import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'

import { onRequestDelete, onRequestGet, onRequestPut } from '../functions/api/ai/config.js'
import { onRequestPost as migrateKeys } from '../functions/api/ai/key-migration.js'
import { LLM_PROTOCOLS, loadAccountLlmConfig, maskLlmApiKey, normalizeLlmBaseUrl, normalizeLlmProtocol, resolvedLlmConfig } from '../functions/_shared/llmConfig.js'
import { decryptLlmApiKey, encryptLlmApiKey, validateLlmKeyring } from '../functions/_shared/llmKeyCrypto.js'

const encryptionKey = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, index) => index)))

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
              if (sql.includes('INSERT INTO account_llm_configs')) row = { base_url: args[1], model: args[2], api_key: '', ciphertext: args[3], nonce: args[4], key_version: args[5], protocol: args[6], updated_at: args[7] }
              if (sql.includes('UPDATE account_llm_configs')) row = { ...row, api_key: '', ciphertext: args[0], nonce: args[1], key_version: args[2] }
              if (sql.includes('DELETE FROM account_llm_configs')) row = null
              return { meta: { changes: 1 } }
            },
          }
        },
      }
    },
  }
  return { DB, LLM_KEY_ENCRYPTION_KEYS: JSON.stringify({ 1: encryptionKey }), LLM_KEY_ENCRYPTION_KEY_VERSION: '1', get row() { return row } }
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
  assert.deepEqual(custom, { apiKey: 'account-key', baseUrl: 'https://account.test/v1', model: 'account-model', protocol: LLM_PROTOCOLS.OPENAI_CHAT_COMPLETIONS, useResponses: false })
  assert.equal(resolvedLlmConfig({}, { apiKey: 'account-key', baseUrl: 'https://account.test', model: 'account-model', protocol: LLM_PROTOCOLS.ANTHROPIC_MESSAGES }).protocol, LLM_PROTOCOLS.ANTHROPIC_MESSAGES)
  assert.deepEqual(resolvedLlmConfig({ OPENAI_API_KEY: 'default-key' }), { apiKey: 'default-key', baseUrl: '', model: 'gpt-4o-mini', protocol: LLM_PROTOCOLS.OPENAI_RESPONSES, useResponses: true })
  assert.deepEqual(resolvedLlmConfig({ OPENAI_API_KEY: 'default-key', OPENAI_BASE_URL: 'https://gateway.test' }), { apiKey: 'default-key', baseUrl: 'https://gateway.test/v1', model: 'gpt-4o-mini', protocol: LLM_PROTOCOLS.OPENAI_CHAT_COMPLETIONS, useResponses: false })
  assert.equal(resolvedLlmConfig({ OPENAI_API_KEY: 'default-key', OPENAI_BASE_URL: 'https://gateway.test/v1', OPENAI_USE_RESPONSES: 'true' }).protocol, LLM_PROTOCOLS.OPENAI_RESPONSES)
  assert.equal(normalizeLlmProtocol('anthropic_messages'), LLM_PROTOCOLS.ANTHROPIC_MESSAGES)
  assert.throws(() => normalizeLlmProtocol('legacy'), /API 格式不受支持/)
})

test('LLM config API saves only the current account and never returns the raw key', async () => {
  const env = fixture()
  const put = await onRequestPut({ request: request('PUT', { baseUrl: 'https://provider.test/v1///', model: '  baby-model ', protocol: LLM_PROTOCOLS.ANTHROPIC_MESSAGES, apiKey: 'account-secret-key' }), env })
  assert.equal(put.status, 200)
  const payload = await put.json()
  assert.equal(payload.config.baseUrl, 'https://provider.test/v1')
  assert.equal(payload.config.model, 'baby-model')
  assert.equal(payload.config.protocol, LLM_PROTOCOLS.ANTHROPIC_MESSAGES)
  assert.equal(payload.config.apiKey, undefined)
  assert.equal(payload.config.apiKeyMasked, maskLlmApiKey('account-secret-key'))
  assert.equal(env.row.api_key, '')
  assert.ok(env.row.ciphertext)
  assert.doesNotMatch(env.row.ciphertext, /account-secret-key/)
  assert.equal(await decryptLlmApiKey(env, 'account-1', { ciphertext: env.row.ciphertext, nonce: env.row.nonce, keyVersion: env.row.key_version }), 'account-secret-key')

  const get = await onRequestGet({ request: request(), env })
  assert.equal(get.status, 200)
  assert.equal((await get.json()).config.apiKey, undefined)

  const keepKey = await onRequestPut({ request: request('PUT', { baseUrl: 'https://provider.test/v2', model: 'baby-model', protocol: LLM_PROTOCOLS.OPENAI_CHAT_COMPLETIONS, apiKey: '' }), env })
  assert.equal(keepKey.status, 200)
  assert.equal(await decryptLlmApiKey(env, 'account-1', { ciphertext: env.row.ciphertext, nonce: env.row.nonce, keyVersion: env.row.key_version }), 'account-secret-key')

  const deleted = await onRequestDelete({ request: request('DELETE'), env })
  assert.equal(deleted.status, 200)
  assert.equal(env.row, null)
})

test('legacy plaintext keys migrate on first server read and encrypted rows fail closed', async () => {
  const legacy = fixture({ config: { base_url: 'https://provider.test/v1', model: 'baby-model', api_key: 'legacy-secret-key', protocol: LLM_PROTOCOLS.OPENAI_CHAT_COMPLETIONS, updated_at: '2026-08-01T00:00:00.000Z' } })
  const loaded = await loadAccountLlmConfig(legacy, 'account-1')
  assert.equal(loaded.apiKey, 'legacy-secret-key')
  assert.equal(legacy.row.api_key, '')
  assert.ok(legacy.row.ciphertext)

  const oldCiphertext = legacy.row.ciphertext
  const rotatedKey = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, index) => 255 - index)))
  legacy.LLM_KEY_ENCRYPTION_KEYS = JSON.stringify({ 1: encryptionKey, 2: rotatedKey })
  legacy.LLM_KEY_ENCRYPTION_KEY_VERSION = '2'
  assert.equal((await loadAccountLlmConfig(legacy, 'account-1')).apiKey, 'legacy-secret-key')
  assert.equal(legacy.row.key_version, 2)
  assert.notEqual(legacy.row.ciphertext, oldCiphertext)

  const encrypted = await encryptLlmApiKey(legacy, 'account-1', 'bound-secret-key')
  await assert.rejects(() => decryptLlmApiKey(legacy, 'account-2', encrypted), /解密失败/)
  const missingKey = fixture({ config: { ...legacy.row } })
  delete missingKey.LLM_KEY_ENCRYPTION_KEYS
  const response = await onRequestGet({ request: request(), env: missingKey })
  assert.equal(response.status, 503)
  assert.doesNotMatch(await response.text(), /bound-secret-key|legacy-secret-key/)

  const partial = fixture({ config: { ...legacy.row, nonce: null } })
  const partialResponse = await onRequestGet({ request: request(), env: partial })
  assert.equal(partialResponse.status, 503)
})

test('LLM encryption keyring rejects invalid deployment configuration', () => {
  assert.deepEqual(validateLlmKeyring({ LLM_KEY_ENCRYPTION_KEYS: JSON.stringify({ 1: encryptionKey }), LLM_KEY_ENCRYPTION_KEY_VERSION: '1' }), { activeVersion: 1, versions: [1] })
  assert.throws(() => validateLlmKeyring({ LLM_KEY_ENCRYPTION_KEYS: '{', LLM_KEY_ENCRYPTION_KEY_VERSION: '1' }), /JSON 对象/)
  assert.throws(() => validateLlmKeyring({ LLM_KEY_ENCRYPTION_KEYS: JSON.stringify({ 1: btoa('short') }), LLM_KEY_ENCRYPTION_KEY_VERSION: '1' }), /32 字节/)
  assert.throws(() => validateLlmKeyring({ LLM_KEY_ENCRYPTION_KEYS: JSON.stringify({ 1: encryptionKey }), LLM_KEY_ENCRYPTION_KEY_VERSION: '2' }), /缺少当前版本 2/)
  assert.throws(() => validateLlmKeyring({ LLM_KEY_ENCRYPTION_KEYS: JSON.stringify({ 1: encryptionKey }), LLM_KEY_ENCRYPTION_KEY_VERSION: 'not-a-version' }), /版本配置无效/)
})

test('protected migration endpoint removes all remaining plaintext keys', async () => {
  const env = fixture({ config: { account_id: 'account-1', base_url: 'https://provider.test/v1', model: 'baby-model', api_key: 'legacy-secret-key', protocol: LLM_PROTOCOLS.OPENAI_CHAT_COMPLETIONS } })
  env.AI_HEALTH_TOKEN = 'migration-token'
  const denied = await migrateKeys({ request: new Request('https://babyforge.test/api/ai/key-migration', { method: 'POST', headers: { authorization: 'Bearer wrong-token' } }), env })
  assert.equal(denied.status, 404)
  const originalPrepare = env.DB.prepare
  env.DB.prepare = function prepare(sql) {
    if (sql.includes('WHERE api_key <>') && sql.includes('LIMIT')) return { bind: () => ({ all: async () => ({ results: env.row?.api_key ? [{ ...env.row, account_id: 'account-1' }] : [] }) }) }
    if (sql.includes('COUNT(*)')) return { first: async () => ({ count: env.row?.api_key ? 1 : 0 }) }
    return originalPrepare.call(this, sql)
  }
  const response = await migrateKeys({ request: new Request('https://babyforge.test/api/ai/key-migration', { method: 'POST', headers: { authorization: 'Bearer migration-token' } }), env })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true, migrated: 1, remaining: 0 })
  assert.equal(env.row.api_key, '')
  assert.ok(env.row.ciphertext)
})

test('D1 migration keeps legacy rows readable but rejects new plaintext writes', async () => {
  const database = new DatabaseSync(':memory:')
  database.exec('CREATE TABLE accounts (id TEXT PRIMARY KEY)')
  database.exec("INSERT INTO accounts (id) VALUES ('legacy'), ('plaintext'), ('encrypted')")
  database.exec(await readFile(new URL('../migrations/0010_account_llm_config.sql', import.meta.url), 'utf8'))
  database.prepare("INSERT INTO account_llm_configs (account_id, base_url, model, api_key, updated_at) VALUES (?, ?, ?, ?, ?)").run('legacy', 'https://provider.test/v1', 'model', 'legacy-key', '2026-08-01')
  database.exec(await readFile(new URL('../migrations/0016_encrypt_account_llm_keys.sql', import.meta.url), 'utf8'))
  assert.equal(database.prepare('SELECT api_key FROM account_llm_configs WHERE account_id = ?').get('legacy').api_key, 'legacy-key')
  assert.throws(() => database.prepare("INSERT INTO account_llm_configs (account_id, base_url, model, api_key, updated_at) VALUES (?, ?, ?, ?, ?)").run('plaintext', 'https://provider.test/v1', 'model', 'new-key', '2026-08-01'), /plaintext LLM API keys are forbidden/)
  database.prepare("INSERT INTO account_llm_configs (account_id, base_url, model, api_key, ciphertext, nonce, key_version, updated_at) VALUES (?, ?, ?, '', ?, ?, ?, ?)").run('encrypted', 'https://provider.test/v1', 'model', 'ciphertext', 'nonce', 1, '2026-08-01')
  assert.equal(database.prepare('SELECT api_key FROM account_llm_configs WHERE account_id = ?').get('encrypted').api_key, '')
  database.close()
})

test('LLM config API validates URLs and keeps guest accounts read-only', async () => {
  assert.equal(normalizeLlmBaseUrl('https://provider.test'), 'https://provider.test/v1')
  assert.equal(normalizeLlmBaseUrl('https://provider.test/openai/v1/'), 'https://provider.test/openai/v1')
  assert.throws(() => normalizeLlmBaseUrl('javascript:alert(1)'), /http 或 https/)
  const guest = fixture({ role: 'guest' })
  const response = await onRequestPut({ request: request('PUT', { baseUrl: 'https://provider.test/v1', model: 'baby-model', apiKey: 'secret' }), env: guest })
  assert.equal(response.status, 403)
})
