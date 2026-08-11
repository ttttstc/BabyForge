import { betterAuth } from 'better-auth'

const authByDatabase = new WeakMap()

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]))
}
async function sendResend(env, { to, subject, url, action }) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new Error('邮件服务尚未配置')
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [to],
      subject,
      html: `<p>BabyForge ${escapeHtml(action)}</p><p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p><p>如果这不是你的操作，可以忽略此邮件。</p>`,
    }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`邮件发送失败（${response.status}）${detail ? `: ${detail.slice(0, 160)}` : ''}`)
  }
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
    const delivery = sendResend(env, message)
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
    trustedOrigins: [baseURL, 'http://localhost:8788', 'http://localhost:5173'].filter(Boolean),
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

export async function handleBetterAuthRequest(request, env, waitUntil) {
  const auth = typeof waitUntil === 'function' ? createBetterAuth(env, waitUntil) : getBetterAuth(env)
  return auth.handler(request)
}
