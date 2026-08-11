import { json } from '../../_shared/auth.js'
import { migrateLegacyAccountLlmKeys } from '../../_shared/llmConfig.js'
import { validHealthToken } from './health.js'

export async function onRequestPost({ request, env }) {
  if (!(await validHealthToken(request.headers.get('authorization'), env.AI_HEALTH_TOKEN))) return json({ error: 'Not found' }, 404)
  if (!env.DB) return json({ ok: false, reason: 'database_not_configured' }, 503)
  try {
    return json({ ok: true, ...(await migrateLegacyAccountLlmKeys(env)) })
  } catch (error) {
    console.error('LLM API Key migration failed closed', error)
    return json({ ok: false, reason: 'key_migration_failed' }, 503)
  }
}
