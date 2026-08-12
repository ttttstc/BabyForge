import test from 'node:test'
import assert from 'node:assert/strict'

import {
  EMAIL_UPDATE_CATEGORIES,
  appUpdateUrl,
  sendUpdateNotifications,
} from '../functions/_shared/updateNotifications.js'

function notificationEnv(results, calls) {
  return {
    RESEND_API_KEY: 'test-key',
    RESEND_FROM_EMAIL: 'BabyForge <updates@babyforge.test>',
    DB: {
      prepare(sql) {
        calls.sql = sql
        return {
          bind(...binds) {
            calls.binds = binds
            return { async all() { return { results } } }
          },
        }
      },
    },
  }
}

test('key update categories match the subscribed first release scope', () => {
  assert.deepEqual([...EMAIL_UPDATE_CATEGORIES], [
    'growth_measurement', 'temperature', 'temperature_observation', 'symptom_observation',
    'health_visit', 'medication', 'vaccination', 'doctor_instruction',
  ])
})

test('event email excludes the acting user in the household query and includes changed details', async (context) => {
  const calls = { emails: [] }
  const env = notificationEnv([{ email: 'other@example.com' }], calls)
  context.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls.emails.push(JSON.parse(options.body))
    return new Response('{}', { status: 200 })
  })

  await sendUpdateNotifications({
    env,
    householdId: 'household-1',
    actorUserId: 'user-self',
    actorName: '妈妈',
    babyName: '小满',
    action: '修改',
    previous: { category: 'growth_measurement', occurredAt: '2026-08-12T08:00:00Z', payload: { type: 'weight', value: 3.2, unit: 'kg' } },
    next: { category: 'growth_measurement', occurredAt: '2026-08-12T08:00:00Z', payload: { type: 'weight', value: 3.5, unit: 'kg' } },
    url: 'https://babyforge.test/#/records?event=event-1',
  })

  assert.match(calls.sql, /u\.id <> \?/)
  assert.deepEqual(calls.binds, ['household-1', 'user-self', 'user-self'])
  assert.equal(calls.emails.length, 1)
  assert.deepEqual(calls.emails[0].to, ['other@example.com'])
  assert.match(calls.emails[0].subject, /成长测量已修改/)
  assert.match(calls.emails[0].html, /3\.2 → 3\.5/)
  assert.match(calls.emails[0].html, /records\?event=event-1/)
})

test('photo email reports only the action and privacy boundary', async (context) => {
  const calls = { emails: [] }
  const env = notificationEnv([{ email: 'other@example.com' }], calls)
  context.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls.emails.push(JSON.parse(options.body))
    return new Response('{}', { status: 200 })
  })

  await sendUpdateNotifications({
    env,
    householdId: 'household-1',
    actorUserId: 'user-self',
    actorName: '爸爸',
    babyName: '小满',
    action: '新增',
    photo: true,
    url: 'https://babyforge.test/#/today',
  })

  assert.match(calls.emails[0].html, /上传了照片/)
  assert.match(calls.emails[0].html, /不展示照片内容/)
  assert.doesNotMatch(calls.emails[0].html, /<img/i)
})

test('app update links use configured public origin and hash route', () => {
  const request = new Request('https://preview.example.test/api/events')
  assert.equal(appUpdateUrl(request, { BETTER_AUTH_URL: 'https://babyforge.example' }, '#/records?event=event-1'), 'https://babyforge.example/#/records?event=event-1')
})
