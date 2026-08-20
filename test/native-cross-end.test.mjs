import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { createNativeResourceClient, NativeResourceClientError } from '../src/domain/nativeResourceAdapter.js'
import { buildNativeTodayModel } from '../src/domain/nativeToday.js'

async function fixture() {
  return JSON.parse(await readFile(new URL('./fixtures/cross-end-today.json', import.meta.url), 'utf8'))
}

test('shared today fixture produces equivalent Web and Harmony resource fields', async () => {
  const input = await fixture()
  const webModel = buildNativeTodayModel(input)
  const client = createNativeResourceClient({
    timezone: input.timezone,
    fetchImpl: async (url) => {
      assert.equal(url, '/api/native/today?day=2026-08-18')
      return new Response(JSON.stringify(webModel), { status: 200 })
    },
  })

  const nativeModel = await client.today(input.selectedDay)
  assert.deepEqual(nativeModel.baby, webModel.baby)
  assert.deepEqual(nativeModel.permissions, webModel.permissions)
  assert.deepEqual(nativeModel.summary, webModel.summary)
  assert.deepEqual(nativeModel.photos, webModel.photos)
  assert.deepEqual(nativeModel.recentFacts, webModel.recentFacts)
  assert.equal(nativeModel.dataTimezone, input.timezone)
})

test('shared native write client preserves create, correct, void, and conflict semantics', async () => {
  const input = await fixture()
  const event = input.events[0]
  const requests = []
  const client = createNativeResourceClient({
    fetchImpl: async (url, options) => {
      requests.push({ url, options, body: options.body ? JSON.parse(options.body) : null })
      if (url.endsWith('/conflict')) {
        return new Response(JSON.stringify({ error: { code: 'EVENT_CONFLICT', message: '版本冲突', retryable: false } }), { status: 409 })
      }
      return new Response(JSON.stringify({ event }), { status: url.includes('/events/') ? 200 : 201 })
    },
  })

  await client.createCareEvent(event)
  await client.correctCareEvent(event.id, 1, { ...event, payload: { ...event.payload, amountMl: 130 } })
  await client.voidCareEvent(event.id, 2)
  assert.deepEqual(requests.map((request) => [request.options.method, request.url]), [
    ['POST', '/api/events'],
    ['PATCH', `/api/events/${event.id}`],
    ['DELETE', `/api/events/${event.id}`],
  ])
  assert.deepEqual(requests[0].body, { event })
  assert.equal(requests[1].body.version, 1)
  assert.equal(requests[1].body.event.payload.amountMl, 130)
  assert.deepEqual(requests[2].body, { version: 2 })

  const conflictClient = createNativeResourceClient({
    fetchImpl: async () => new Response(JSON.stringify({ error: { code: 'EVENT_CONFLICT', message: '版本冲突' } }), { status: 409 }),
  })
  await assert.rejects(
    conflictClient.voidCareEvent('event-conflict', 1),
    (error) => error instanceof NativeResourceClientError && error.code === 'EVENT_CONFLICT' && error.status === 409,
  )
})

test('cross-end and candidate gates are executable from the repository root', () => {
  const crossEnd = spawnSync(process.execPath, ['scripts/verify-cross-end-contracts.mjs'], { encoding: 'utf8' })
  assert.equal(crossEnd.status, 0, crossEnd.stdout + crossEnd.stderr)
  const candidate = spawnSync(process.execPath, ['scripts/verify-harmony-candidate.mjs'], { encoding: 'utf8' })
  assert.equal(candidate.status, 0, candidate.stdout + candidate.stderr)
})
