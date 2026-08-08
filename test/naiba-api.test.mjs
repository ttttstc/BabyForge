import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestPost, SAFE_DECISION_FACT_KEYS, safeDecisionFacts } from '../functions/api/ai/chat.js'
import { DECISION_REQUIRED_FACT_KEYS } from '../src/domain/decisionKernel.js'

function apiFixture() {
  const session = { token: 'token', expires_at: '2099-01-01T00:00:00.000Z', id: 'account-admin', username: 'niwa', role: 'admin', display_name: '管理员' }
  const baby = { id: 'baby-1', householdId: 'household-1', nickname: '小舟', birthDate: new Date().toISOString().slice(0, 10), gestationalWeeks: 39, gestationalDays: 0, growthAgeBasis: 'chronological', birthMultiplicity: 'singleton', sex: 'male', feedingMode: 'formula', locale: 'zh-CN', status: 'active' }
  const event = { id: 'event-1', baby_id: 'baby-1', kind: 'caregiver_observation', category: 'bottle_feeding', type: 'bottle_feeding', occurred_at: new Date().toISOString(), recorded_at: new Date().toISOString(), actor_id: 'parent', actor_display_name: '爸爸', event_source: 'caregiver', payload_json: JSON.stringify({ amountMl: 30 }), status: 'active', version: 1 }
  const DB = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('FROM auth_sessions')) return session
              if (sql.includes('FROM baby_profiles')) return args[0] === baby.id ? baby : null
              return null
            },
            async all() {
              if (sql.includes('SELECT * FROM care_events')) return { results: [event] }
              return { results: [] }
            },
            async run() { return { meta: { changes: 1 } } },
          }
        },
      }
    },
    async batch(statements) {
      for (const statement of statements) await statement.run()
      return []
    },
  }
  return { DB, baby }
}

function request(body) {
  return new Request('https://babyforge.test/api/ai/chat', {
    method: 'POST',
    headers: { cookie: 'babyforge_session=token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

test('AI chat rejects a baby outside the authenticated household', async () => {
  const response = await onRequestPost({ request: request({ message: '今天宝宝怎么吃？', baby: { id: 'baby-other' } }), env: { DB: apiFixture().DB } })
  assert.equal(response.status, 403)
})

test('AI chat does not expose a client-supplied feeding reference when the model is unavailable', async () => {
  const fixture = apiFixture()
  const response = await onRequestPost({ request: request({
    message: '今天宝宝怎么吃？',
    baby: fixture.baby,
    recommendation: { recommendations: [{ quantity: '999 mL/次' }] },
  }), env: fixture })
  assert.equal(response.status, 200)
  const body = await response.text()
  assert.match(body, /conversationId/)
  assert.match(body, /model_not_configured/)
  assert.doesNotMatch(body, /999 mL\/次/)
})

test('AI chat returns provider error metadata without a fabricated answer', async () => {
  const fixture = apiFixture()
  const response = await onRequestPost({ request: request({ message: '请分析今天的照护记录。', skillId: 'detailed_care_analysis', baby: fixture.baby }), env: fixture })
  assert.equal(response.status, 200)
  const body = await response.text()
  assert.match(body, /model_not_configured/)
  assert.doesNotMatch(body, /type":"message"/)
})

test('decision fact allowlist stays a superset of every published unit requirement', () => {
  for (const key of DECISION_REQUIRED_FACT_KEYS) assert.ok(SAFE_DECISION_FACT_KEYS.includes(key), key)
  assert.deepEqual(safeDecisionFacts({ temperatureC: 38.2, unknown: 'discard', tooLong: 'x'.repeat(81) }), { temperatureC: 38.2 })
})
