function normalized(value) {
  return String(value || '').trim().toLowerCase()
}

export function getPresetAccounts(env) {
  try {
    const parsed = JSON.parse(String(env?.BABYFORGE_PRESET_ACCOUNTS || ''))
    return {
      demos: Array.isArray(parsed?.demos) ? parsed.demos.filter((item) => (
        normalized(item?.username)
        && typeof item?.password === 'string' && item.password.length >= 6
        && ['mock', 'niwa'].includes(item?.variant)
      )) : [],
      admin: parsed?.admin && normalized(parsed.admin.username)
        && normalized(parsed.admin.email)
        && typeof parsed.admin.password === 'string' && parsed.admin.password.length >= 6
        && parsed.admin.accountId
        && parsed.admin.householdId
        && parsed.admin.babyId
        ? parsed.admin
        : null,
    }
  } catch {
    return { demos: [], admin: null }
  }
}

export async function safeEqual(left, right) {
  const encoder = new TextEncoder()
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(String(left || ''))),
    crypto.subtle.digest('SHA-256', encoder.encode(String(right || ''))),
  ])
  const leftBytes = new Uint8Array(leftHash)
  const rightBytes = new Uint8Array(rightHash)
  let difference = leftBytes.length ^ rightBytes.length
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index] ^ rightBytes[index]
  return difference === 0
}

export async function authenticateDemo(env, username, password) {
  const account = getPresetAccounts(env).demos.find((item) => normalized(item.username) === normalized(username))
  if (!account || !(await safeEqual(password, account.password))) return null
  return {
    username: normalized(account.username),
    displayName: String(account.displayName || '演示账号').slice(0, 80),
    variant: account.variant,
  }
}

export function getAdminPreset(env) {
  return getPresetAccounts(env).admin
}
