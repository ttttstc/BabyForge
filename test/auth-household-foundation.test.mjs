import test from 'node:test'
import assert from 'node:assert/strict'
import { passwordPolicyError } from '../functions/_shared/betterAuth.js'
import { hashToken, randomToken } from '../functions/_shared/principal.js'
import { startGoogleLogin } from '../src/domain/auth.js'

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
