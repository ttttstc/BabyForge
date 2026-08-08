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
  try {
    const row = await env.DB.prepare('SELECT base_url, model, api_key, protocol FROM account_llm_configs WHERE account_id = ?').bind(accountId).first()
    if (!row?.api_key || !row?.model || !row?.base_url) return null
    return { baseUrl: row.base_url, model: row.model, apiKey: row.api_key, protocol: normalizeLlmProtocol(row.protocol) }
  } catch (error) {
    // Keep AI available on deployments that have not applied the optional
    // account configuration migration yet.
    console.error('Account LLM configuration unavailable', error)
    return null
  }
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
