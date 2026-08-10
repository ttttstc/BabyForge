import test from 'node:test'
import assert from 'node:assert/strict'
import { passwordPolicyError } from '../functions/_shared/betterAuth.js'
import { hashToken, randomToken } from '../functions/_shared/principal.js'

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
