import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestPost as onEventPost } from '../functions/api/events.js'

const session = {
  token: 'token',
  expires_at: '2099-01-01T00:00:00.000Z',
  id: 'account-owner',
  username: 'owner',
  role: 'admin',
  display_name: '家长',
}

function eventFixture(overrides = {}) {
  return {
    id: 'event-state-machine',
    babyId: 'baby-state-machine',
    kind: 'caregiver_observation',
    category: 'bottle_feeding',
    occurredAt: '2026-08-18T02:30:00.000Z',
    recordedAt: '2026-08-18T02:35:00.000Z',
    actor: { id: 'account-owner', displayName: '家长' },
    source: 'caregiver',
    payload: { milkType: 'breast_milk', amountMl: 120 },
    status: 'active',
    version: 1,
    ...overrides,
  }
}

function rowFromEvent(event) {
  return {
    id: event.id,
    baby_id: event.babyId,
    kind: event.kind,
    category: event.category,
    type: 'bottle_feeding',
    occurred_at: event.occurredAt,
    recorded_at: event.recordedAt,
    actor_id: event.actor.id,
    actor_display_name: event.actor.displayName,
    recorded_by_id: event.actor.id,
    recorded_by_name: event.actor.displayName,
    source: 'caregiver_entered',
    event_source: event.source,
    payload_json: JSON.stringify(event.payload),
    status: event.status,
    corrected_from_id: event.correctedFromId || null,
    related_concern_id: null,
    version: event.version,
    created_at: event.createdAt || event.recordedAt,
    updated_at: event.updatedAt || event.recordedAt,
    updated_by: 'account-owner',
  }
}

function statefulEnv({ membershipRole = 'member', role = 'admin', initial = null } = {}) {
  const rows = new Map(initial ? [[initial.id, rowFromEvent(initial)]] : [])
  const activeSession = { ...session, role }
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes('FROM auth_sessions')) return activeSession
                if (sql.includes('FROM baby_profiles')) return {
                  id: 'baby-state-machine', householdId: 'household-state-machine', nickname: '小满', status: 'active', membershipRole,
                }
                if (sql.includes('SELECT * FROM care_events WHERE id = ?')) return rows.get(args[0]) || null
                return null
              },
              async all() {
                if (sql.includes('FROM care_events')) return { results: [...rows.values()] }
                return { results: [] }
              },
              async run() {
                if (sql.includes('INSERT INTO care_events')) {
                  const event = {
                    id: args[0], babyId: args[1], kind: args[2], category: args[3], occurredAt: args[5], recordedAt: args[6],
                    actor: { id: args[7], displayName: args[8] }, source: args[12], payload: JSON.parse(args[13]), status: args[14], version: 1,
                    createdAt: args[17], updatedAt: args[18],
                  }
                  rows.set(event.id, rowFromEvent(event))
                }
                return { meta: { changes: 1 } }
              },
            }
          },
        }
      },
    },
  }
  return { env, rows }
}

function postRequest(event) {
  return new Request('https://babyforge.test/api/events', {
    method: 'POST',
    headers: { cookie: 'babyforge_session=token', 'content-type': 'application/json' },
    body: JSON.stringify({ event }),
  })
}

test('real event POST handler is idempotent and returns the production conflict envelope', async () => {
  const fixture = statefulEnv()
  const event = eventFixture()
  const first = await onEventPost({ request: postRequest(event), env: fixture.env })
  assert.equal(first.status, 201)
  const duplicate = await onEventPost({ request: postRequest(event), env: fixture.env })
  assert.equal(duplicate.status, 204)
  assert.equal(fixture.rows.size, 1)

  const conflict = await onEventPost({ request: postRequest({ ...event, payload: { ...event.payload, amountMl: 180 } }), env: fixture.env })
  assert.equal(conflict.status, 409)
  const body = await conflict.json()
  assert.equal(body.code, 'EVENT_CONFLICT')
  assert.equal(typeof body.error, 'string')
  assert.equal(body.current.id, event.id)
})

test('real event POST handler blocks guest and read-only writes', async () => {
  const guest = statefulEnv({ role: 'guest' })
  assert.equal((await onEventPost({ request: postRequest(eventFixture({ id: 'event-guest' })), env: guest.env })).status, 403)
  const readOnly = statefulEnv({ membershipRole: 'readOnly' })
  assert.equal((await onEventPost({ request: postRequest(eventFixture({ id: 'event-readonly' })), env: readOnly.env })).status, 403)
})
