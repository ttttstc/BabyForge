const DEFAULT_KEY_VERSION = 1
const NONCE_BYTES = 12

function bytesToBase64(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value, label) {
  try {
    const binary = atob(String(value || ''))
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    throw new Error(`${label} 不是有效的 Base64`)
  }
}

export function activeLlmKeyVersion(env) {
  const version = Number(env?.LLM_KEY_ENCRYPTION_KEY_VERSION || DEFAULT_KEY_VERSION)
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('LLM Key 加密版本配置无效')
  return version
}

function encodedKey(env, version) {
  const activeVersion = activeLlmKeyVersion(env)
  if (version === activeVersion) return env?.LLM_KEY_ENCRYPTION_KEY
  return env?.[`LLM_KEY_ENCRYPTION_KEY_V${version}`]
}

async function importKey(env, version) {
  const raw = base64ToBytes(encodedKey(env, version), `LLM_KEY_ENCRYPTION_KEY_V${version}`)
  if (raw.byteLength !== 32) throw new Error(`LLM_KEY_ENCRYPTION_KEY_V${version} 必须是 32 字节 Base64 密钥`)
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, version === activeLlmKeyVersion(env) ? ['encrypt', 'decrypt'] : ['decrypt'])
}

function algorithm(nonce, accountId) {
  return {
    name: 'AES-GCM',
    iv: nonce,
    additionalData: new TextEncoder().encode(accountId),
    tagLength: 128,
  }
}

export async function encryptLlmApiKey(env, accountId, apiKey) {
  const version = activeLlmKeyVersion(env)
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES))
  const ciphertext = await crypto.subtle.encrypt(algorithm(nonce, accountId), await importKey(env, version), new TextEncoder().encode(apiKey))
  return { ciphertext: bytesToBase64(new Uint8Array(ciphertext)), nonce: bytesToBase64(nonce), keyVersion: version }
}

export async function decryptLlmApiKey(env, accountId, encrypted) {
  const version = Number(encrypted?.keyVersion)
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('LLM API Key 密文版本无效')
  const nonce = base64ToBytes(encrypted?.nonce, 'LLM API Key nonce')
  if (nonce.byteLength !== NONCE_BYTES) throw new Error('LLM API Key nonce 长度无效')
  const ciphertext = base64ToBytes(encrypted?.ciphertext, 'LLM API Key 密文')
  try {
    const plaintext = await crypto.subtle.decrypt(algorithm(nonce, accountId), await importKey(env, version), ciphertext)
    return new TextDecoder().decode(plaintext)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('LLM_KEY_ENCRYPTION_KEY_')) throw error
    throw new Error('LLM API Key 解密失败', { cause: error })
  }
}
