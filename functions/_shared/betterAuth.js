import { betterAuth } from 'better-auth'
import { username } from 'better-auth/plugins'

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

export function getBetterAuth(env) {
  if (!env?.DB) throw new Error('D1 未配置')
  const cached = authByDatabase.get(env.DB)
  if (cached) return cached

  const baseURL = env.BETTER_AUTH_URL || undefined
  const auth = betterAuth({
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
    plugins: [username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
      usernameValidator: (value) => /^[a-zA-Z0-9_.]+$/.test(value),
    })],
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
      sendVerificationEmail: ({ user, url }) => sendResend(env, {
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
      sendResetPassword: ({ user, url }) => sendResend(env, {
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

export async function handleBetterAuthRequest(request, env) {
  return getBetterAuth(env).handler(request)
}
