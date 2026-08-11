const COOKIE_NAME = 'babyforge_showcase'
const SESSION_SECONDS = 2 * 60 * 60

function cookieValue(request) {
  const header = request.headers.get('cookie') || ''
  for (const part of header.split(';')) {
    const [name, ...value] = part.trim().split('=')
    if (name === COOKIE_NAME) return decodeURIComponent(value.join('='))
  }
  return ''
}

async function hash(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function token() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export async function createShowcaseSession(env, babyId, request) {
  const value = token()
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString()
  await env.DB.prepare(`
    INSERT INTO demo_showcase_sessions (token_hash, baby_id, expires_at)
    VALUES (?, ?, ?)
  `).bind(await hash(value), babyId, expiresAt).run()
  return {
    expiresAt,
    cookie: `${COOKIE_NAME}=${encodeURIComponent(value)}; HttpOnly;${new URL(request.url).protocol === 'https:' ? ' Secure;' : ''} SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`,
  }
}

export async function getShowcaseSession(request, env) {
  if (!env.DB) return null
  const value = cookieValue(request)
  if (!value) return null
  return env.DB.prepare(`
    SELECT s.baby_id AS babyId, s.expires_at AS expiresAt
    FROM demo_showcase_sessions s
    JOIN baby_profiles b ON b.id = s.baby_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND COALESCE(b.status, 'active') <> 'detached'
  `).bind(await hash(value), new Date().toISOString()).first()
}

export async function revokeShowcaseSession(request, env) {
  const value = cookieValue(request)
  if (value && env.DB) await env.DB.prepare('DELETE FROM demo_showcase_sessions WHERE token_hash = ?').bind(await hash(value)).run()
}

export function clearShowcaseCookie(request) {
  return `${COOKIE_NAME}=; HttpOnly;${new URL(request.url).protocol === 'https:' ? ' Secure;' : ''} SameSite=Lax; Path=/; Max-Age=0`
}
