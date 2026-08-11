import { activeLlmKeyVersion, decryptLlmApiKey, encryptLlmApiKey } from './llmKeyCrypto.js'

export const LLM_PROTOCOLS = Object.freeze({
  ANTHROPIC_MESSAGES: 'anthropic_messages',
  OPENAI_CHAT_COMPLETIONS: 'openai_chat_completions',
  OPENAI_RESPONSES: 'openai_responses',
})

export const NAIBA_REASONING_EFFORT = 'high'
export const NAIBA_MAX_OUTPUT_TOKENS = 4_096
export const NAIBA_ANTHROPIC_THINKING_BUDGET = 2_048

export const LLM_PROTOCOL_OPTIONS = Object.freeze([
  { value: LLM_PROTOCOLS.ANTHROPIC_MESSAGES, label: 'Anthropic Messages（原生）' },
  { value: LLM_PROTOCOLS.OPENAI_CHAT_COMPLETIONS, label: 'OpenAI Chat Completions（需开启路由）' },
  { value: LLM_PROTOCOLS.OPENAI_RESPONSES, label: 'OpenAI Responses API（需开启路由）' },
])

export async function loadAccountLlmConfig(env, accountId) {
  if (!env?.DB || !accountId) return null
  const row = await env.DB.prepare('SELECT base_url, model, api_key, ciphertext, nonce, key_version, protocol FROM account_llm_configs WHERE account_id = ?').bind(accountId).first()
  if (!row || !row.model || !row.base_url) return null
  const apiKey = await readAccountLlmApiKey(env, accountId, row)
  return { baseUrl: row.base_url, model: row.model, apiKey, protocol: normalizeLlmProtocol(row.protocol) }
}

export async function migrateLegacyAccountLlmKeys(env, limit = 50) {
  const batchSize = Math.max(1, Math.min(100, Number(limit) || 50))
  const result = await env.DB.prepare(`
    SELECT account_id, api_key, ciphertext, nonce, key_version
    FROM account_llm_configs
    WHERE api_key <> ''
    LIMIT ?
  `).bind(batchSize).all()
  for (const row of result.results || []) await readAccountLlmApiKey(env, row.account_id, row)
  const remaining = await env.DB.prepare("SELECT COUNT(*) AS count FROM account_llm_configs WHERE api_key <> ''").first()
  return { migrated: result.results?.length || 0, remaining: Number(remaining?.count || 0) }
}

export async function readAccountLlmApiKey(env, accountId, row) {
  const hasEncryptedFields = row?.ciphertext != null || row?.nonce != null || row?.key_version != null
  if (hasEncryptedFields) {
    if (!row.ciphertext || !row.nonce || !row.key_version) throw new Error('LLM API Key 密文不完整')
    const apiKey = await decryptLlmApiKey(env, accountId, { ciphertext: row.ciphertext, nonce: row.nonce, keyVersion: row.key_version })
    if (Number(row.key_version) !== activeLlmKeyVersion(env)) {
      const encrypted = await encryptLlmApiKey(env, accountId, apiKey)
      await env.DB.prepare(`
        UPDATE account_llm_configs
        SET ciphertext = ?, nonce = ?, key_version = ?
        WHERE account_id = ? AND ciphertext = ? AND key_version = ?
      `).bind(encrypted.ciphertext, encrypted.nonce, encrypted.keyVersion, accountId, row.ciphertext, row.key_version).run()
    }
    return apiKey
  }
  if (!row?.api_key) throw new Error('LLM API Key 密文不完整')
  const apiKey = normalizeLlmApiKey(row.api_key)
  const encrypted = await encryptLlmApiKey(env, accountId, apiKey)
  await env.DB.prepare(`
    UPDATE account_llm_configs
    SET api_key = '', ciphertext = ?, nonce = ?, key_version = ?
    WHERE account_id = ? AND api_key = ? AND ciphertext IS NULL
  `).bind(encrypted.ciphertext, encrypted.nonce, encrypted.keyVersion, accountId, row.api_key).run()
  return apiKey
}

function optionalBoolean(value) {
  if (value === undefined || value === null || value === '') return undefined
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase())
}

export function normalizeLlmProtocol(value, fallback = LLM_PROTOCOLS.OPENAI_CHAT_COMPLETIONS) {
  const protocol = String(value || '').trim()
  if (!protocol) return fallback
  if (!Object.values(LLM_PROTOCOLS).includes(protocol)) throw new Error('API 格式不受支持')
  return protocol
}

export function resolvedLlmConfig(env, custom = null) {
  const customConfigured = Boolean(custom?.apiKey && custom?.baseUrl && custom?.model)
  const baseUrl = normalizeLlmBaseUrl(custom?.baseUrl || env?.OPENAI_BASE_URL || '')
  const configuredProtocol = optionalBoolean(env?.OPENAI_USE_RESPONSES)
  const protocol = normalizeLlmProtocol(custom?.protocol || (customConfigured ? LLM_PROTOCOLS.OPENAI_CHAT_COMPLETIONS : env?.OPENAI_PROTOCOL || (baseUrl ? (configuredProtocol ? LLM_PROTOCOLS.OPENAI_RESPONSES : LLM_PROTOCOLS.OPENAI_CHAT_COMPLETIONS) : LLM_PROTOCOLS.OPENAI_RESPONSES)))
  return {
    apiKey: custom?.apiKey || env?.OPENAI_API_KEY || '',
    baseUrl,
    model: custom?.model || env?.OPENAI_MODEL || 'gpt-4o-mini',
    protocol,
    useResponses: protocol === LLM_PROTOCOLS.OPENAI_RESPONSES ? true : protocol === LLM_PROTOCOLS.OPENAI_CHAT_COMPLETIONS ? false : undefined,
  }
}

export function maskLlmApiKey(value) {
  const key = String(value || '')
  if (!key) return ''
  if (key.length <= 8) return '••••••••'
  return `${key.slice(0, 4)}••••${key.slice(-4)}`
}

export function normalizeLlmBaseUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  let parsed
  try { parsed = new URL(raw) } catch { throw new Error('Base URL 格式不正确') }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) throw new Error('Base URL 必须使用 http 或 https')
  if (!parsed.pathname || parsed.pathname === '/') parsed.pathname = '/v1'
  return parsed.toString().replace(/\/+$/, '')
}

export function normalizeLlmModel(value) {
  const model = String(value || '').trim()
  if (!model || model.length > 160) throw new Error('模型名称不能为空且不能超过 160 个字符')
  return model
}

export function normalizeLlmApiKey(value) {
  const apiKey = String(value || '').trim()
  if (!apiKey || apiKey.length > 512) throw new Error('API Key 不能为空且不能超过 512 个字符')
  return apiKey
}
