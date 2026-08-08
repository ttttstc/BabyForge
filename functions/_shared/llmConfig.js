export async function loadAccountLlmConfig(env, accountId) {
  if (!env?.DB || !accountId) return null
  try {
    const row = await env.DB.prepare('SELECT base_url, model, api_key FROM account_llm_configs WHERE account_id = ?').bind(accountId).first()
    if (!row?.api_key || !row?.model || !row?.base_url) return null
    return { baseUrl: row.base_url, model: row.model, apiKey: row.api_key }
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

export function resolvedLlmConfig(env, custom = null) {
  const customConfigured = Boolean(custom?.apiKey && custom?.baseUrl && custom?.model)
  const baseUrl = normalizeLlmBaseUrl(custom?.baseUrl || env?.OPENAI_BASE_URL || '')
  const configuredProtocol = optionalBoolean(env?.OPENAI_USE_RESPONSES)
  return {
    apiKey: custom?.apiKey || env?.OPENAI_API_KEY || '',
    baseUrl,
    model: custom?.model || env?.OPENAI_MODEL || 'gpt-4o-mini',
    // Account-level custom gateways are OpenAI-compatible by contract. Chat
    // Completions is the broadest compatible protocol and avoids accidentally
    // calling /responses on gateways that only expose /chat/completions.
    useResponses: customConfigured ? false : (configuredProtocol ?? (baseUrl ? false : undefined)),
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
