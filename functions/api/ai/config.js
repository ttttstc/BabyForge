import { json, requireSession } from '../../_shared/auth.js'
import { maskLlmApiKey, normalizeLlmApiKey, normalizeLlmBaseUrl, normalizeLlmModel, normalizeLlmProtocol, readAccountLlmApiKey } from '../../_shared/llmConfig.js'
import { encryptLlmApiKey } from '../../_shared/llmKeyCrypto.js'

async function publicConfig(env, accountId, row) {
  if (!row) return null
  const apiKey = await readAccountLlmApiKey(env, accountId, row)
  return {
    configured: true,
    baseUrl: row.base_url,
    model: row.model,
    protocol: normalizeLlmProtocol(row.protocol),
    apiKeyMasked: maskLlmApiKey(apiKey),
    updatedAt: row.updated_at,
  }
}

async function loadConfig(env, accountId) {
  const row = await env.DB.prepare('SELECT base_url, model, api_key, ciphertext, nonce, key_version, protocol, updated_at FROM account_llm_configs WHERE account_id = ?').bind(accountId).first()
  return publicConfig(env, accountId, row)
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  try {
    return json({ config: await loadConfig(env, auth.session.accountId) })
  } catch (error) {
    console.error('LLM config read failed', error)
    return json({ error: '自定义模型配置暂不可用，请先应用数据库迁移' }, 503)
  }
}

export async function onRequestPut({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  if (auth.session.role === 'guest') return json({ error: '游客账号只读，不能修改模型配置' }, 403)
  let body
  try { body = await request.json() } catch { return json({ error: '请求格式无效' }, 400) }
  if (body?.clear === true) return onRequestDelete({ request, env })

  let baseUrl
  let model
  let protocol
  try {
    baseUrl = normalizeLlmBaseUrl(body?.baseUrl)
    if (!baseUrl) throw new Error('Base URL 不能为空')
    model = normalizeLlmModel(body?.model)
    protocol = normalizeLlmProtocol(body?.protocol)
  } catch (error) {
    return json({ error: error.message }, 422)
  }
  let existing
  try {
    existing = await env.DB.prepare('SELECT api_key, ciphertext, nonce, key_version FROM account_llm_configs WHERE account_id = ?').bind(auth.session.accountId).first()
  } catch (error) {
    console.error('LLM config lookup failed', error)
    return json({ error: '自定义模型配置暂不可用，请先应用数据库迁移' }, 503)
  }
  let apiKey = String(body?.apiKey || '').trim()
  if (!apiKey && existing) {
    try { apiKey = await readAccountLlmApiKey(env, auth.session.accountId, existing) } catch (error) {
      console.error('LLM config key read failed', error)
      return json({ error: '已保存的 API Key 无法安全读取，请检查加密密钥配置' }, 503)
    }
  }
  try { apiKey = normalizeLlmApiKey(apiKey) } catch (error) { return json({ error: error.message }, 422) }

  const now = new Date().toISOString()
  try {
    const encrypted = await encryptLlmApiKey(env, auth.session.accountId, apiKey)
    await env.DB.prepare(`
      INSERT INTO account_llm_configs (account_id, base_url, model, api_key, ciphertext, nonce, key_version, protocol, updated_at)
      VALUES (?, ?, ?, '', ?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET base_url = excluded.base_url, model = excluded.model, api_key = '', ciphertext = excluded.ciphertext, nonce = excluded.nonce, key_version = excluded.key_version, protocol = excluded.protocol, updated_at = excluded.updated_at
    `).bind(auth.session.accountId, baseUrl, model, encrypted.ciphertext, encrypted.nonce, encrypted.keyVersion, protocol, now).run()
    return json({ config: await loadConfig(env, auth.session.accountId) })
  } catch (error) {
    console.error('LLM config write failed', error)
    return json({ error: '自定义模型配置保存失败，请重试' }, 503)
  }
}

export async function onRequestDelete({ request, env }) {
  if (!env.DB) return json({ error: 'D1 未配置' }, 503)
  const auth = await requireSession(request, env)
  if (auth.response) return auth.response
  if (auth.session.role === 'guest') return json({ error: '游客账号只读，不能修改模型配置' }, 403)
  try {
    await env.DB.prepare('DELETE FROM account_llm_configs WHERE account_id = ?').bind(auth.session.accountId).run()
    return json({ config: null })
  } catch (error) {
    console.error('LLM config delete failed', error)
    return json({ error: '自定义模型配置删除失败，请重试' }, 503)
  }
}
