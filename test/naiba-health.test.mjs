import test from 'node:test'
import assert from 'node:assert/strict'

import { validHealthToken } from '../functions/api/ai/health.js'

test('Naiba production health check requires the exact bearer secret', async () => {
  assert.equal(await validHealthToken('Bearer expected-token', 'expected-token'), true)
  assert.equal(await validHealthToken('Bearer wrong-token', 'expected-token'), false)
  assert.equal(await validHealthToken('', 'expected-token'), false)
  assert.equal(await validHealthToken('Bearer expected-token', ''), false)
})
