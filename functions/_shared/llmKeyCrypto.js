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

function encryptionKeyring(env) {
  let parsed
  try { parsed = JSON.parse(String(env?.LLM_KEY_ENCRYPTION_KEYS || '')) } catch { throw new Error('LLM_KEY_ENCRYPTION_KEYS 必须是 JSON 对象') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('LLM_KEY_ENCRYPTION_KEYS 必须是 JSON 对象')
  return parsed
}

export function activeLlmKeyVersion(env) {
  const version = Number(env?.LLM_KEY_ENCRYPTION_KEY_VERSION || DEFAULT_KEY_VERSION)
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('LLM Key 加密版本配置无效')
  return version
}

function encodedKey(env, version) {
  return encryptionKeyring(env)[String(version)]
}

async function importKey(env, version) {
  const raw = base64ToBytes(encodedKey(env, version), `LLM_KEY_ENCRYPTION_KEY_V${version}`)
  if (raw.byteLength !== 32) throw new Error(`LLM_KEY_ENCRYPTION_KEY_V${version} 必须是 32 字节 Base64 密钥`)
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, version === activeLlmKeyVersion(env) ? ['encrypt', 'decrypt'] : ['decrypt'])
}

export function validateLlmKeyring(env) {
  const activeVersion = activeLlmKeyVersion(env)
  const keyring = encryptionKeyring(env)
  const versions = Object.keys(keyring)
  if (!versions.length) throw new Error('LLM_KEY_ENCRYPTION_KEYS 不能为空')
  for (const version of versions) {
    if (!Number.isSafeInteger(Number(version)) || Number(version) < 1 || String(Number(version)) !== version) throw new Error(`LLM Key 版本 ${version} 无效`)
    const raw = base64ToBytes(keyring[version], `LLM Key 版本 ${version}`)
    if (raw.byteLength !== 32) throw new Error(`LLM Key 版本 ${version} 必须是 32 字节 Base64 密钥`)
  }
  if (!keyring[String(activeVersion)]) throw new Error(`LLM Keyring 缺少当前版本 ${activeVersion}`)
  return { activeVersion, versions: versions.map(Number).sort((left, right) => left - right) }
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
    if (error instanceof Error && error.message.startsWith('LLM_KEY_ENCRYPTION_KEY')) throw error
    throw new Error('LLM API Key 解密失败', { cause: error })
  }
}
