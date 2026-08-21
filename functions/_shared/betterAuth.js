import { betterAuth } from 'better-auth'
import { oneTimeToken } from 'better-auth/plugins/one-time-token'
import { sendTransactionalEmail } from './email.js'

const authByDatabase = new WeakMap()
const NATIVE_AUTH_ORIGIN = 'babyforge://auth'

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]))
}
function passwordMeetsPolicy(password) {
  const value = String(password || '')
  return value.length >= 6 && /[A-Za-z]/.test(value) && /\d/.test(value)
}

export function passwordPolicyError(password) {
  return passwordMeetsPolicy(password) ? null : '密码至少 6 位，并且同时包含字母和数字'
}

export function scheduleAuthEmailDelivery(delivery, waitUntil, reportError = (error) => {
  console.error('[BabyForge] Auth email delivery failed', error?.message || error)
}) {
  if (typeof waitUntil !== 'function') return delivery
  waitUntil(Promise.resolve(delivery).catch(reportError))
}

function createBetterAuth(env, waitUntil) {
  if (!env?.DB) throw new Error('D1 未配置')
  const baseURL = env.BETTER_AUTH_URL || undefined
  const deliverEmail = (message) => {
    const delivery = sendTransactionalEmail(env, {
      to: message.to,
      subject: message.subject,
      html: `<p>BabyForge ${escapeHtml(message.action)}</p><p><a href="${escapeHtml(message.url)}">${escapeHtml(message.url)}</a></p><p>如果这不是你的操作，可以忽略此邮件。</p>`,
    })
    return scheduleAuthEmailDelivery(delivery, waitUntil)
  }
  return betterAuth({
    appName: 'BabyForge',
    baseURL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB,
    socialProviders: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    } : {},
    // Native OAuth includes a manual system-browser confirmation step on
    // HarmonyOS; keep the single-use handoff short-lived but long enough for
    // the user to complete that confirmation without racing the expiry.
    plugins: [oneTimeToken({ expiresIn: 10, storeToken: 'hashed' })],
    account: {
      accountLinking: {
        enabled: false,
        disableImplicitLinking: true,
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60,
      sendVerificationEmail: ({ user, url }) => deliverEmail({
        to: user.email,
        subject: '验证你的 BabyForge 邮箱',
        url,
        action: '邮箱验证链接',
      }),
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, url }) => deliverEmail({
        to: user.email,
        subject: '重置你的 BabyForge 密码',
        url,
        action: '密码重置链接',
      }),
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 30,
      customRules: {
        '/sign-in/*': { window: 60, max: 8 },
        '/sign-up/*': { window: 60, max: 5 },
        '/request-password-reset': { window: 60, max: 3 },
        '/send-verification-email': { window: 60, max: 3 },
      },
    },
    advanced: {
      ipAddress: {
        ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'],
      },
      useSecureCookies: Boolean(baseURL?.startsWith('https://')),
    },
    trustedOrigins: [baseURL, NATIVE_AUTH_ORIGIN, 'http://localhost:8788', 'http://localhost:5173'].filter(Boolean),
  })
}

export function getBetterAuth(env) {
  if (!env?.DB) throw new Error('D1 未配置')
  const cached = authByDatabase.get(env.DB)
  if (cached) return cached
  const auth = createBetterAuth(env)
  authByDatabase.set(env.DB, auth)
  return auth
}

export async function getBetterAuthSession(request, env) {
  try {
    return await getBetterAuth(env).api.getSession({ headers: request.headers })
  } catch {
    return null
  }
}

export async function requiresPasswordSetup(env, userId) {
  if (!userId) return false
  const account = await env.DB.prepare(`
    SELECT 1 AS present
    FROM "account"
    WHERE userId = ? AND providerId = 'credential' AND password IS NOT NULL
    LIMIT 1
  `).bind(userId).first()
  return !account
}

export async function handleBetterAuthRequest(request, env, waitUntil) {
  const auth = typeof waitUntil === 'function' ? createBetterAuth(env, waitUntil) : getBetterAuth(env)
  return auth.handler(request)
}
