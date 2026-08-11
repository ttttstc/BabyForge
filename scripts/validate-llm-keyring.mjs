import { validateLlmKeyring } from '../functions/_shared/llmKeyCrypto.js'

const result = validateLlmKeyring(process.env)
console.log(`Validated LLM encryption keyring: active version ${result.activeVersion}, ${result.versions.length} key(s)`)
