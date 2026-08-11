import test from 'node:test'
import assert from 'node:assert/strict'
import { passwordPolicyError } from '../functions/_shared/betterAuth.js'
import { hashToken, randomToken } from '../functions/_shared/principal.js'
import { login, register, resetPassword, startGoogleLogin, updateNickname } from '../src/domain/auth.js'
import { parseInviteToken } from '../src/domain/householdAccess.js'
import { buildInviteRoute, buildVisitorRoute, inviteTokenFromLocation, parseHashLocation, visitorTokenFromLocation } from '../src/app/router.js'
import { nicknamePolicyError, normalizeNickname } from '../functions/api/me.js'

test('formal password policy requires letters and numbers', () => {
  assert.equal(passwordPolicyError('abc123'), null)
  assert.match(passwordPolicyError('abcdef'), /字母和数字/)
  assert.match(passwordPolicyError('123456'), /字母和数字/)
  assert.match(passwordPolicyError('a1'), /至少 6 位/)
})

test('invite tokens are high entropy and stored as one-way hashes', async () => {
  const token = randomToken()
  assert.equal(token.length, 43)
  assert.match(token, /^[A-Za-z0-9_-]+$/)
  assert.notEqual(await hashToken(token), token)
  assert.equal(await hashToken(token), await hashToken(token))
  assert.notEqual(await hashToken(token), await hashToken(randomToken()))
})

test('Google sign-in posts to Better Auth before navigating to the provider', async () => {
  const requests = []
  const destinations = []
  const url = await startGoogleLogin('#/login', {
    fetchImpl: async (path, options) => {
      requests.push({ path, options })
      return new Response(JSON.stringify({ url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test' }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
    location: { origin: 'http://localhost:8788', assign: (value) => destinations.push(value) },
  })
  assert.equal(requests[0].path, '/api/auth/sign-in/social')
  assert.equal(requests[0].options.method, 'POST')
  assert.deepEqual(JSON.parse(requests[0].options.body), { provider: 'google', callbackURL: 'http://localhost:8788/#/login' })
  assert.equal(destinations[0], url)
})

test('email registration needs only email and password and preserves the return route', async () => {
  let request
  await register({ email: ' Parent@Example.com ', password: 'abc123' }, {
    callbackURL: 'https://babyforge.bbroot.com/#/household/invite/token',
    fetchImpl: async (path, options) => {
      request = { path, options }
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  assert.equal(request.path, '/api/auth/sign-up/email')
  assert.deepEqual(JSON.parse(request.options.body), {
    email: 'parent@example.com',
    name: '家长',
    password: 'abc123',
    callbackURL: 'https://babyforge.bbroot.com/#/household/invite/token',
  })
})

test('password reset submits the link token and new password', async () => {
  let request
  await resetPassword({ token: 'reset-token', password: 'newpass1' }, {
    fetchImpl: async (path, options) => {
      request = { path, options }
      return new Response('{"status":true}', { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  assert.equal(request.path, '/api/auth/reset-password')
  assert.deepEqual(JSON.parse(request.options.body), { token: 'reset-token', newPassword: 'newpass1' })
})

test('network failures become an actionable auth message', async () => {
  await assert.rejects(
    login('parent@example.com', 'abc123', { fetchImpl: async () => { throw new TypeError('Failed to fetch') } }),
    /无法连接登录服务，请确认网络连接后重试/,
  )
})

test('nickname updates are non-unique display data', async () => {
  assert.equal(normalizeNickname('  泥巴   猪  '), '泥巴 猪')
  assert.equal(nicknamePolicyError('妈妈'), null)
  assert.match(nicknamePolicyError(''), /1–30/)
  let body
  const user = await updateNickname('泥巴猪', { fetchImpl: async (_path, options) => {
    body = JSON.parse(options.body)
    return new Response(JSON.stringify({ user: { nickname: '泥巴猪' } }), { status: 200, headers: { 'content-type': 'application/json' } })
  } })
  assert.deepEqual(body, { nickname: '泥巴猪' })
  assert.equal(user.nickname, '泥巴猪')
})

test('new and legacy invite links resolve to the shared household route', () => {
  const token = 'a'.repeat(43)
  const route = buildInviteRoute(token)
  assert.equal(route, `#/household/invite/${token}`)
  assert.equal(inviteTokenFromLocation(parseHashLocation(route)), token)
  assert.equal(parseInviteToken(`https://babyforge.bbroot.com/${route}`), token)
  assert.equal(parseInviteToken(`https://babyforge.bbroot.com/invite/${token}`), token)
  assert.equal(parseInviteToken('not-an-invite'), '')
})

test('demo login stays inside the injected browser sandbox', async () => {
  const values = new Map()
  const storage = { setItem: (key, value) => values.set(key, value), getItem: (key) => values.get(key) || null }
  const session = await login('demo', '123456', {
    storage,
    demoAccounts: { demo: { username: 'demo', password: '123456', role: 'admin', displayName: '演示账号' } },
    fetchImpl: async () => assert.fail('demo login must not call a server'),
  })
  assert.equal(session.mode, 'demo')
  assert.equal(session.username, 'demo')
  assert.equal(JSON.parse(values.get('babyforge:session')).mode, 'demo')
})

test('temporary visitor links have their own public route', () => {
  const token = 'v'.repeat(43)
  const route = buildVisitorRoute(token)
  assert.equal(route, `#/visit/${token}`)
  assert.equal(visitorTokenFromLocation(parseHashLocation(route)), token)
  assert.equal(visitorTokenFromLocation(parseHashLocation('#/today')), '')
})
