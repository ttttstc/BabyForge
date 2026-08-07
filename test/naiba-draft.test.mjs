import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestPost } from '../functions/api/ai/confirm-draft.js'

function envFor(role = 'admin') {
  return {
    DB: {
      prepare(sql) {
        return {
          bind() {
            return {
              async first() {
                if (sql.includes('FROM auth_sessions')) return { token: 'token', expires_at: '2099-01-01T00:00:00.000Z', id: 'account-1', username: 'niwa', role, display_name: '管理员' }
                return null
              },
            }
          },
        }
      },
    },
  }
}

function request(body) {
  return new Request('https://babyforge.test/api/ai/confirm-draft', {
    method: 'POST',
    headers: { cookie: 'babyforge_session=token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

test('confirm-draft never writes without an explicit confirmation', async () => {
  const response = await onRequestPost({ request: request({ draft: { event: {} } }), env: envFor() })
  assert.equal(response.status, 409)
})

test('confirm-draft keeps guest accounts read-only', async () => {
  const response = await onRequestPost({ request: request({ confirmed: true, draft: { event: {} } }), env: envFor('guest') })
  assert.equal(response.status, 403)
})
