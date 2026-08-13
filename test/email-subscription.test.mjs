import test from 'node:test'
import assert from 'node:assert/strict'

import {
  EMAIL_UPDATE_CATEGORIES,
  appAssetUrl,
  appUpdateUrl,
  sendUpdateNotifications,
} from '../functions/_shared/updateNotifications.js'
import { sendTransactionalEmail } from '../functions/_shared/email.js'
import { contactEmailError, normalizeContactEmail } from '../functions/api/email-subscription/contacts.js'

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
  const env = notificationEnv([{ email: 'other@example.com', householdName: '小满的家庭' }], calls)
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
    settingsUrl: 'https://babyforge.test/#/settings',
    heroUrl: 'https://babyforge.test/assets/login/login-hero-mobile.png',
  })

  assert.match(calls.sql, /u\.id <> \?/)
  assert.match(calls.sql, /email_notification_contacts/)
  assert.deepEqual(calls.binds, ['household-1', 'user-self', 'user-self', 'household-1', 'user-self', 'user-self', 'user-self'])
  assert.equal(calls.emails.length, 1)
  assert.deepEqual(calls.emails[0].to, ['other@example.com'])
  assert.match(calls.emails[0].subject, /小满的家庭｜小满宝宝的成长测量已更新/)
  assert.match(calls.emails[0].html, /小满的家庭的小满宝宝有新的动态/)
  assert.match(calls.emails[0].html, /这是一条成长测量记录/)
  assert.match(calls.emails[0].html, /3\.2 → 3\.5/)
  assert.match(calls.emails[0].html, /records\?event=event-1/)
  assert.match(calls.emails[0].html, /管理邮件提醒/)
  assert.match(calls.emails[0].text, /3\.2 → 3\.5/)
  assert.match(calls.emails[0].text, /打开 BabyForge 查看详情/)
  assert.match(calls.emails[0].html, /width="640"[^>]+background="https:\/\/babyforge\.test\/assets\/login\/login-hero-mobile\.png"[^>]+background-image:url\('https:\/\/babyforge\.test\/assets\/login\/login-hero-mobile\.png'\)/)
  assert.match(calls.emails[0].html, /background:rgba\(255,250,244,.9\);border:1px solid #eaded3/)
  assert.equal((calls.emails[0].html.match(/background-image:url\(/g) || []).length, 1)
  assert.match(calls.emails[0].html, /background-image:url\('https:\/\/babyforge\.test\/assets\/login\/login-hero-mobile\.png'\)/)
  assert.equal(calls.emails[0].html.includes('<img'), false)
  assert.equal(calls.emails[0].html.includes('font-family:Georgia'), true)
  assert.equal(calls.emails[0].html.includes('charset="utf-8"'), true)
})

test('photo email reports only the action and privacy boundary', async (context) => {
  const calls = { emails: [] }
  const env = notificationEnv([{ email: 'other@example.com', householdName: '小满的家庭' }], calls)
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
    settingsUrl: 'https://babyforge.test/#/settings',
    heroUrl: 'https://babyforge.test/assets/login/login-hero-mobile.png',
  })

  assert.match(calls.emails[0].html, /上传了新的照片/)
  assert.match(calls.emails[0].html, /不会加载或展示照片本身/)
  assert.match(calls.emails[0].subject, /小满的家庭｜小满宝宝的相册有新照片/)
  assert.match(calls.emails[0].html, /相册隐私说明/)
  assert.match(calls.emails[0].text, /不会加载或展示照片本身/)
  assert.equal((calls.emails[0].html.match(/background-image:url\(/g) || []).length, 1)
  assert.match(calls.emails[0].html, /background-image:url\('https:\/\/babyforge\.test\/assets\/login\/login-hero-mobile\.png'\)/)
  assert.doesNotMatch(calls.emails[0].html, /<img/i)
})

test('household contacts receive one shared event email each', async (context) => {
  const calls = { emails: [] }
  const env = notificationEnv([
    { email: 'other@example.com', householdName: '小满的家庭' },
    { email: 'grandma@example.com', householdName: '小满的家庭' },
  ], calls)
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
    action: '新增',
    next: { category: 'temperature', occurredAt: '2026-08-12T08:00:00Z', payload: { value: 36.8, unit: '°C' } },
    url: 'https://babyforge.test/#/records?event=event-2',
    settingsUrl: 'https://babyforge.test/#/settings',
    heroUrl: 'https://babyforge.test/assets/login/login-hero-mobile.png',
  })

  assert.deepEqual(calls.emails.map((email) => email.to[0]).sort(), ['grandma@example.com', 'other@example.com'])
  assert.equal(calls.emails[0].subject, calls.emails[1].subject)
})

test('contact email normalization rejects invalid addresses', () => {
  assert.equal(normalizeContactEmail('  Grandma@Example.COM '), 'grandma@example.com')
  assert.equal(contactEmailError('grandma@example.com'), null)
  assert.match(contactEmailError('not-an-email'), /有效的联系人邮箱/)
})

test('transactional transport sends plain text and optional sender headers', async (context) => {
  const calls = []
  context.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls.push(JSON.parse(options.body))
    return new Response('{}', { status: 200 })
  })

  await sendTransactionalEmail({
    RESEND_API_KEY: 'test-key',
    RESEND_FROM_EMAIL: 'BabyForge <updates@babyforge.test>',
    RESEND_REPLY_TO: 'support@babyforge.test',
    RESEND_LIST_UNSUBSCRIBE_URL: 'https://babyforge.test/#/settings',
  }, { to: 'other@example.com', subject: '家庭动态', html: '<p>小满有新的动态</p>' })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].text, '小满有新的动态')
  assert.equal(calls[0].reply_to, 'support@babyforge.test')
  assert.equal(calls[0].headers['List-Unsubscribe'], '<https://babyforge.test/#/settings>')
})

test('app update links use configured public origin and hash route', () => {
  const request = new Request('https://preview.example.test/api/events')
  assert.equal(appUpdateUrl(request, { BETTER_AUTH_URL: 'https://babyforge.example' }, '#/records?event=event-1'), 'https://babyforge.example/#/records?event=event-1')
  assert.equal(appAssetUrl(request, { BETTER_AUTH_URL: 'https://babyforge.example' }), 'https://babyforge.example/assets/login/login-hero-mobile.png')
})
