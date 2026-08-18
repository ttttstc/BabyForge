export const NATIVE_AI_CONTRACT = 'babyforge.native.ai'
export const NATIVE_AI_CONTRACT_VERSION = '1.0.0'

export const NATIVE_AI_STATUSES = Object.freeze([
  'idle', 'loading', 'sending', 'generating', 'success', 'fallback', 'tool_failed', 'stopped', 'offline', 'read_only', 'draft_pending', 'draft_expired', 'draft_confirmed', 'draft_discarded',
])

export function validateNativeAiEnvelope(value) {
  if (!value || typeof value !== 'object') throw new Error('native-ai-envelope-invalid')
  if (value.contract !== NATIVE_AI_CONTRACT || value.contractVersion !== NATIVE_AI_CONTRACT_VERSION) throw new Error('native-ai-envelope-version-unsupported')
  return value
}
