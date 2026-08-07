import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestPost as createDraft } from '../functions/api/ai/drafts.js'
import { onRequestPost as parseReport } from '../functions/api/ai/report.js'
import { createCareEvent, DEFAULT_RECORDERS } from '../src/domain/careEvents.js'

function fixture() {
  const session = { token: 'token', expires_at: '2099-01-01T00:00:00.000Z', id: 'account-1', username: 'niwa', role: 'admin', display_name: '管理员' }
  const baby = { id: 'baby-1', householdId: 'household-1', nickname: '小舟', birthDate: '2026-08-01', gestationalWeeks: 39, gestationalDays: 0, feedingMode: 'formula', locale: 'zh-CN', status: 'active' }
  const writes = []
  return {
    baby,
    writes,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes('FROM auth_sessions')) return session
                if (sql.includes('FROM baby_profiles')) return args[0] === baby.id ? baby : null
                return null
              },
              async all() { return { results: [] } },
              async run() { writes.push({ sql, args }); return { meta: { changes: 1 } } },
            }
          },
        }
      },
    },
  }
}

function request(path, body) {
  return new Request(`https://babyforge.test${path}`, { method: 'POST', headers: { cookie: 'babyforge_session=token', 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

test('cloud draft endpoint stores an unconfirmed event without writing care_events', async () => {
  const env = fixture()
  const now = '2026-08-07T10:00:00.000Z'
  const event = createCareEvent({ babyId: env.baby.id, category: 'bottle_feeding', occurredAt: now, recordedAt: now, actor: DEFAULT_RECORDERS[0], source: 'caregiver', payload: { amountMl: 50 } }, { now })
  const response = await createDraft({ request: request('/api/ai/drafts', { event }), env })
  assert.equal(response.status, 201)
  assert.ok((await response.json()).draftId)
  assert.ok(env.writes.some((write) => write.sql.includes('INSERT INTO ai_drafts')))
  assert.ok(!env.writes.some((write) => write.sql.includes('INSERT INTO care_events')))
})

test('plain-text report endpoint parses locally and never requires model access', async () => {
  const env = fixture()
  const response = await parseReport({ request: request('/api/ai/report', { babyId: env.baby.id, name: '血常规.txt', mimeType: 'text/plain', text: '血红蛋白 135 g/L 参考范围: 110-160' }), env })
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.report.fields[0].value, '135')
  assert.equal(payload.report.status, 'draft_ready')
})

test('image report endpoint requires explicit third-party processing consent', async () => {
  const env = fixture()
  const response = await parseReport({ request: request('/api/ai/report', { babyId: env.baby.id, name: 'report.png', mimeType: 'image/png', dataUrl: 'data:image/png;base64,abc' }), env })
  assert.equal(response.status, 409)
})
