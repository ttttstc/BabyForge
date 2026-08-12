import test from 'node:test'
import assert from 'node:assert/strict'
import { passwordPolicyError } from '../functions/_shared/betterAuth.js'
import { hashToken, randomToken } from '../functions/_shared/principal.js'
import { login, logout, register, resetPassword, startGoogleLogin, updateNickname } from '../src/domain/auth.js'
import { parseInviteToken } from '../src/domain/householdAccess.js'
import { buildInviteRoute, buildVisitorRoute, inviteTokenFromLocation, parseHashLocation, visitorTokenFromLocation } from '../src/app/router.js'
import { nicknamePolicyError, normalizeNickname } from '../functions/api/me.js'
import { createDemoWorkspace } from '../src/domain/storage.js'
import { onRequestPost as demoLogin } from '../functions/api/demo-login.js'
import { onRequestPost as formalLogin } from '../functions/api/login.js'

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

test('demo login uses server-side authentication then stays in the browser sandbox', async () => {
  const values = new Map()
  const paths = []
  const storage = { setItem: (key, value) => values.set(key, value), getItem: (key) => values.get(key) || null }
  const session = await login('sandbox-user', 'test-password', {
    storage,
    fetchImpl: async (input) => {
      paths.push(input)
      return new Response(JSON.stringify({ demo: { username: 'sandbox-user', displayName: '中性演示', variant: 'mock' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })
  assert.equal(session.mode, 'demo')
  assert.equal(session.username, 'sandbox-user')
  assert.equal(session.role, 'guest')
  assert.equal(session.demoVariant, 'mock')
  assert.deepEqual(paths, ['/api/demo-login'])
  assert.equal(JSON.parse(values.get('babyforge:session')).mode, 'demo')
})

test('demo login surfaces unavailable local configuration instead of masking it as bad credentials', async () => {
  await assert.rejects(
    () => login('niwa-demo', '123456', {
      fetchImpl: async () => new Response(JSON.stringify({ error: '本地演示账号未配置' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    }),
    /本地演示账号未配置/,
  )
})

test('demo credentials are read only from the server runtime secret', async () => {
  const env = { BABYFORGE_PRESET_ACCOUNTS: JSON.stringify({ demos: [
    { username: 'sandbox-user', password: 'test-password', variant: 'mock', displayName: '中性演示' },
  ] }) }
  const success = await demoLogin({
    env,
    request: new Request('https://example.test/api/demo-login', { method: 'POST', body: JSON.stringify({ username: 'sandbox-user', password: 'test-password' }) }),
  })
  assert.equal(success.status, 200)
  assert.equal((await success.json()).demo.variant, 'mock')

  const rejected = await demoLogin({
    env: {},
    request: new Request('https://example.test/api/demo-login', { method: 'POST', body: JSON.stringify({ username: 'sandbox-user', password: 'test-password' }) }),
  })
  assert.equal(rejected.status, 401)
})

test('legacy admin login fails closed when the runtime preset is absent', async () => {
  let databaseReads = 0
  const response = await formalLogin({
    env: { DB: { prepare: () => { databaseReads += 1; throw new Error('must not query legacy credentials') } } },
    request: new Request('https://example.test/api/login', { method: 'POST', body: JSON.stringify({ username: 'legacy-user', password: 'legacy-password' }) }),
  })
  assert.equal(response.status, 401)
  assert.equal(databaseReads, 0)
})

test('demo profiles keep neutral mock data separate from the Niwa showcase', () => {
  const neutral = createDemoWorkspace(new Date('2026-08-11T12:00:00.000Z'), 'mock')
  const niwa = createDemoWorkspace(new Date('2026-08-11T12:00:00.000Z'), 'niwa')
  assert.equal(neutral.baby.nickname, '小满')
  assert.doesNotMatch(JSON.stringify(neutral), /niwa|泥蛙/i)
  assert.equal(niwa.baby.nickname, '泥蛙')
  assert.notEqual(neutral.baby.id, niwa.baby.id)
})

test('demo logout clears only local session state', async () => {
  const values = new Map([['babyforge:session', '{}']])
  let requests = 0
  await logout({
    remote: false,
    storage: { removeItem: (key) => values.delete(key) },
    fetchImpl: async () => { requests += 1 },
  })
  assert.equal(values.has('babyforge:session'), false)
  assert.equal(requests, 0)
})

test('temporary visitor links have their own public route', () => {
  const token = 'v'.repeat(43)
  const route = buildVisitorRoute(token)
  assert.equal(route, `#/visit/${token}`)
  assert.equal(visitorTokenFromLocation(parseHashLocation(route)), token)
  assert.equal(visitorTokenFromLocation(parseHashLocation('#/today')), '')
})
