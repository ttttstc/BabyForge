import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestPost as createDraft } from '../functions/api/ai/drafts.js'
import { onRequestPost as confirmDraft } from '../functions/api/ai/confirm-draft.js'
import { onRequestPost as createEvent } from '../functions/api/events.js'
import { createCareEvent, DEFAULT_RECORDERS } from '../src/domain/careEvents.js'

const session = { token: 'token', expires_at: '2099-01-01T00:00:00.000Z', id: 'account-readonly', username: 'readonly', role: 'member', display_name: '只读成员' }
const baby = { id: 'baby-1', householdId: 'household-1', nickname: '小舟', birthDate: '2026-08-01', locale: 'zh-CN', status: 'active', membershipRole: 'readOnly' }

function env(event) {
  const writes = []
  return {
    writes,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes('FROM auth_sessions')) return session
                if (sql.includes('FROM ai_drafts')) return {
                  id: 'draft-1',
                  baby_id: baby.id,
                  payload_json: JSON.stringify({ event }),
                  status: 'pending',
                  expires_at: '2099-01-01T00:00:00.000Z',
                }
                if (sql.includes('FROM baby_profiles')) return args[0] === baby.id ? baby : null
                return null
              },
              async run() { writes.push(sql); return { meta: { changes: 1 } } },
            }
          },
        }
      },
    },
  }
}

function request(path, body) {
  return new Request(`https://babyforge.test${path}`, {
    method: 'POST',
    headers: { cookie: 'babyforge_session=token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

test('read-only household membership is enforced by AI draft and event write APIs', async () => {
  const now = '2026-08-19T10:00:00.000Z'
  const event = createCareEvent({ babyId: baby.id, category: 'bottle_feeding', occurredAt: now, recordedAt: now, actor: DEFAULT_RECORDERS[0], source: 'caregiver', payload: { milkType: 'formula', amountMl: 60 } }, { now })
  const fixture = env(event)
  const draftResponse = await createDraft({ request: request('/api/ai/drafts', { event }), env: fixture })
  const confirmResponse = await confirmDraft({ request: request('/api/ai/confirm-draft', { confirmed: true, draftId: 'draft-1', event }), env: fixture })
  const eventResponse = await createEvent({ request: request('/api/events', { event }), env: fixture })
  assert.equal(draftResponse.status, 403)
  assert.equal(confirmResponse.status, 403)
  assert.equal(eventResponse.status, 403)
  assert.deepEqual(fixture.writes, [])
})
