export const SESSION_COOKIE = 'babyforge_session'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
// Keep the demo login within Cloudflare Pages Functions' free CPU budget.
// Replace the seeded demo credentials before treating this as production auth.
export const PASSWORD_ITERATIONS = 10000
import { getBetterAuthSession } from './betterAuth.js'

function hexToBytes(value) {
  const clean = String(value || '').replace(/[^0-9a-f]/gi, '')
  return Uint8Array.from(clean.match(/.{1,2}/g) || [], (byte) => Number.parseInt(byte, 16))
}

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function token() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.get('cookie') || '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=')
    return index === -1 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))]
  }))
}

export async function derivePasswordHash(password, saltHex, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(password)), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: hexToBytes(saltHex), iterations, hash: 'SHA-256' }, key, 256)
  return bytesToHex(bits)
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } })
}

export async function createSession(env, account) {
  const value = token()
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString()
  await env.DB.prepare('INSERT INTO auth_sessions (token, account_id, expires_at) VALUES (?, ?, ?)').bind(value, account.id, expiresAt).run()
  const cookie = `${SESSION_COOKIE}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`
  return { value, expiresAt, cookie }
}

export async function getSession(request, env) {
  if (!env.DB) return null
  const better = await getBetterAuthSession(request, env)
  if (better?.user?.emailVerified) {
    const { ensureLegacyAccount } = await import('./principal.js')
    const account = await ensureLegacyAccount(env, better.user)
    return {
      token: null,
      expiresAt: null,
      accountId: account.id,
      userId: better.user.id,
      username: better.user.username || account.username,
      role: 'member',
      displayName: better.user.name || account.displayName,
      email: better.user.email,
      auth: 'better-auth',
    }
  }
  const value = parseCookies(request)[SESSION_COOKIE]
  if (!value) return null
  const row = await env.DB.prepare(`
    SELECT s.token, s.expires_at, a.id, a.username, a.role, a.display_name
    FROM auth_sessions s JOIN accounts a ON a.id = s.account_id
    WHERE s.token = ? AND a.active = 1 AND s.expires_at > ?
  `).bind(value, new Date().toISOString()).first()
  return row ? { token: row.token, expiresAt: row.expires_at, accountId: row.id, username: row.username, role: row.role, displayName: row.display_name } : null
}

export async function requireSession(request, env) {
  const session = await getSession(request, env)
  return session ? { session } : { response: json({ error: '未登录或登录已过期' }, 401) }
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

export async function findAccount(env, username) {
  return env.DB.prepare('SELECT id, username, role, display_name, password_salt, password_hash, password_iterations FROM accounts WHERE username = ? AND active = 1').bind(String(username || '').trim().toLowerCase()).first()
}

export async function samePassword(password, account) {
  const actual = await derivePasswordHash(password, account.password_salt, Number(account.password_iterations) || PASSWORD_ITERATIONS)
  return actual === String(account.password_hash || '').trim().toLowerCase()
}
