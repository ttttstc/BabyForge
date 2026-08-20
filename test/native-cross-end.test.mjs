import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createNativeResourceClient, NativeResourceClientError } from '../src/domain/nativeResourceAdapter.js'
import { buildNativeTodayModel } from '../src/domain/nativeToday.js'
import { buildNativeGrowthModel, validateNativeGrowthModel } from '../src/domain/nativeGrowth.js'
import { buildNativeExploreModel, validateNativeExploreModel } from '../src/domain/nativeExplore.js'
import { buildNativeSettingsModel, validateNativeSettingsModel } from '../src/domain/nativeSettings.js'
import { validateNativeResourceEnvelope } from '../src/domain/nativeResourceContract.js'
import { normalizeNaibaContext } from '../src/domain/naibaAgentContract.js'
import { conflict } from '../functions/api/events.js'

async function fixture(name = 'today') {
  return JSON.parse(await readFile(new URL(`./fixtures/cross-end-${name}.json`, import.meta.url), 'utf8'))
}

test('shared today fixture produces equivalent Web and Harmony resource fields', async () => {
  const input = await fixture()
  const webModel = buildNativeTodayModel(input)
  assert.equal(webModel.baby.id, input.expected.babyId)
  assert.equal(webModel.summary.feeding.value, input.expected.feedingValue)
  assert.equal(webModel.summary.feeding.unit, input.expected.feedingUnit)
  assert.equal(webModel.photos[0].id, input.expected.photoId)
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

test('shared bootstrap, growth, explore, settings, and AI fixtures project the same expected fields', async () => {
  const bootstrap = await fixture('bootstrap')
  const resource = validateNativeResourceEnvelope(bootstrap.input)
  assert.equal(resource.user.id, bootstrap.expected.userId)
  assert.equal(resource.household.id, bootstrap.expected.householdId)
  assert.equal(resource.household.baby.id, bootstrap.expected.babyId)
  assert.equal(resource.dataTimezone, bootstrap.expected.timezone)

  const growthFixture = await fixture('growth')
  const growth = validateNativeGrowthModel(buildNativeGrowthModel(growthFixture.input))
  assert.equal(growth.baby.id, growthFixture.expected.babyId)
  assert.equal(growth.metadata.timezone, growthFixture.expected.timezone)
  assert.equal(growth.metrics.find((metric) => metric.id === 'weight').latest.value, growthFixture.expected.latestWeight)
  assert.equal(growth.metrics.find((metric) => metric.id === 'weight').unit, growthFixture.expected.latestWeightUnit)
  assert.equal(growth.measurements.length, growthFixture.expected.measurementCount)
  assert.equal(growth.carePlanItems[0].id, growthFixture.expected.planId)

  const exploreFixture = await fixture('explore')
  const explore = validateNativeExploreModel(buildNativeExploreModel(exploreFixture.input))
  assert.equal(explore.baby.id, exploreFixture.expected.babyId)
  assert.equal(explore.metadata.timezone, exploreFixture.expected.timezone)
  assert.equal(explore.experience.cacheState, exploreFixture.expected.experienceCacheState)
  assert.equal(explore.sourcePolicy.rawSourceRequired, exploreFixture.expected.rawSourceRequired)
  assert.ok(explore.vaccines.length > 0)
  assert.ok(explore.diseases.length > 0)

  const settingsFixture = await fixture('settings')
  const settings = validateNativeSettingsModel(buildNativeSettingsModel(settingsFixture.input))
  assert.equal(settings.user.id, settingsFixture.expected.userId)
  assert.equal(settings.baby.id, settingsFixture.expected.babyId)
  assert.equal(settings.metadata.timezone, settingsFixture.expected.timezone)
  assert.equal(settings.contacts.length, settingsFixture.expected.contactCount)
  assert.equal(settings.visitorLinks.length, settingsFixture.expected.visitorLinkCount)
  assert.equal(settings.llmConfig.apiKeyMasked, settingsFixture.expected.apiKeyMasked)
  assert.equal(settings.sync.status, settingsFixture.expected.syncStatus)

  const aiFixture = await fixture('ai')
  const aiEvents = aiFixture.input.events
  const aiText = aiEvents.filter((event) => event.type === 'message').map((event) => event.delta || event.text || '').join('')
  const aiMeta = aiEvents.find((event) => event.type === 'meta')
  const aiSources = aiEvents.find((event) => event.type === 'sources')?.items || []
  assert.equal(aiFixture.input.contract, aiFixture.expected.contract)
  assert.equal(aiMeta.requestId, aiFixture.expected.requestId)
  assert.equal(aiText, aiFixture.expected.text)
  assert.equal(aiSources.length, aiFixture.expected.sourceCount)
  assert.equal(normalizeNaibaContext({ source: 'today', selectedDay: '2026-08-18', timezone: 'Asia/Shanghai' }).selectedDay, '2026-08-18')
})

test('shared contract validators reject unknown versions, units, statuses, permissions, and timezones', async () => {
  const input = await fixture()
  assert.throws(() => buildNativeTodayModel({ ...input, timezone: 'Mars/Olympus' }), /Invalid time zone|RangeError|今日页面模型/)
  assert.throws(() => validateNativeResourceEnvelope({ ...input, contractVersion: '9.9.9' }), /合同|version/i)
  const growth = await fixture('growth')
  assert.throws(() => validateNativeGrowthModel({ ...buildNativeGrowthModel(growth.input), contractVersion: '9.9.9' }), /contract version/i)
  const settings = await fixture('settings')
  assert.throws(() => validateNativeSettingsModel({ ...buildNativeSettingsModel(settings.input), permissions: null }), /identity/i)
  assert.equal(normalizeNaibaContext({ source: 'unknown' }), null)
})

test('shared native write client preserves create, correct, void, and conflict semantics', async () => {
  const input = await fixture()
  const event = input.events[0]
  const requests = []
  const client = createNativeResourceClient({
    fetchImpl: async (url, options) => {
      requests.push({ url, options, body: options.body ? JSON.parse(options.body) : null })
      if (url.endsWith('/conflict')) {
        return new Response(JSON.stringify({ error: '事件版本冲突，请刷新后重新修改', code: 'EVENT_CONFLICT', current: event }), { status: 409 })
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
    fetchImpl: async () => new Response(JSON.stringify({ error: '版本冲突', code: 'EVENT_CONFLICT', current: event }), { status: 409 }),
  })
  await assert.rejects(
    conflictClient.voidCareEvent('event-conflict', 1),
    (error) => error instanceof NativeResourceClientError && error.code === 'EVENT_CONFLICT' && error.status === 409,
  )

  const conflictResponse = conflict({
    id: event.id,
    baby_id: event.babyId,
    kind: event.kind,
    category: event.category,
    occurred_at: event.occurredAt,
    recorded_at: event.recordedAt,
    actor_id: event.actor.id,
    actor_display_name: event.actor.displayName,
    event_source: event.source,
    payload_json: JSON.stringify(event.payload),
    status: event.status,
    version: event.version,
  })
  assert.equal(conflictResponse.status, 409)
  const conflictBody = await conflictResponse.json()
  assert.equal(conflictBody.error, '事件版本冲突，请刷新后重新修改')
  assert.equal(conflictBody.code, 'EVENT_CONFLICT')
  assert.equal(conflictBody.current.id, event.id)
})

test('cross-end and candidate gates are executable from the repository root', () => {
  const crossEnd = spawnSync(process.execPath, ['scripts/verify-cross-end-contracts.mjs'], { encoding: 'utf8' })
  assert.equal(crossEnd.status, 0, crossEnd.stdout + crossEnd.stderr)
  const candidate = spawnSync(process.execPath, ['scripts/verify-harmony-candidate.mjs'], { encoding: 'utf8' })
  assert.equal(candidate.status, 0, candidate.stdout + candidate.stderr)
})

test('cross-end gate mutation tests fail closed for copied display constants and missing native evidence', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'babyforge-cross-end-'))
  try {
    const indexPath = join(temp, 'Index.ets')
    const indexSource = await readFile(new URL('../harmony/entry/src/main/ets/pages/Index.ets', import.meta.url), 'utf8')
    await writeFile(indexPath, `${indexSource}\nconst copiedDesktopView = 'className=';\n`)
    const displayMutation = spawnSync(process.execPath, ['scripts/verify-cross-end-contracts.mjs'], {
      encoding: 'utf8',
      env: { ...process.env, CROSS_END_NATIVE_INDEX: indexPath },
    })
    assert.notEqual(displayMutation.status, 0, displayMutation.stdout + displayMutation.stderr)
    assert.match(displayMutation.stdout + displayMutation.stderr, /展示常量/)

    const nativeManifest = JSON.parse(await readFile(new URL('../contracts/native-capability-manifest.v1.json', import.meta.url), 'utf8'))
    nativeManifest.surfaces.find((surface) => surface.id === 'album').capabilityEvidence['photo-lightbox'] = []
    const manifestPath = join(temp, 'native-capability-manifest.json')
    await writeFile(manifestPath, JSON.stringify(nativeManifest))
    const evidenceMutation = spawnSync(process.execPath, ['scripts/verify-cross-end-contracts.mjs'], {
      encoding: 'utf8',
      env: { ...process.env, CROSS_END_NATIVE_MANIFEST: manifestPath },
    })
    assert.notEqual(evidenceMutation.status, 0, evidenceMutation.stdout + evidenceMutation.stderr)
    assert.match(evidenceMutation.stdout + evidenceMutation.stderr, /独立证据/)

    const routerPath = join(temp, 'router.js')
    const routerSource = await readFile(new URL('../src/app/router.js', import.meta.url), 'utf8')
    await writeFile(routerPath, routerSource.replace("  visitor: '#/visit',", "  visitor: '#/visit',\n  futureRoute: '#/future',"))
    const routeMutation = spawnSync(process.execPath, ['scripts/verify-cross-end-contracts.mjs'], {
      encoding: 'utf8',
      env: { ...process.env, CROSS_END_ROUTER_SOURCE: routerPath },
    })
    assert.notEqual(routeMutation.status, 0, routeMutation.stdout + routeMutation.stderr)
    assert.match(routeMutation.stdout + routeMutation.stderr, /路由注册表/)
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})

test('Harmony candidate gate rejects a contaminated HAP archive', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'babyforge-hap-'))
  try {
    const rawfile = join(temp, 'rawfile')
    await (await import('node:fs/promises')).mkdir(rawfile)
    await writeFile(join(rawfile, 'config.json'), JSON.stringify({ apiKey: 'sk-contaminated-fixture-key-123456789' }))
    await writeFile(join(temp, 'module.json'), JSON.stringify({ app: { bundleName: 'com.ni.babyforge' }, module: { deviceTypes: ['phone'], abilities: [{ name: 'EntryAbility', orientation: 'portrait' }], requestPermissions: [] } }))
    const hapPath = join(temp, 'contaminated.hap')
    const archive = spawnSync('tar', ['-cf', hapPath, '-C', temp, 'rawfile', 'module.json'], { encoding: 'utf8' })
    assert.equal(archive.status, 0, archive.stdout + archive.stderr)
    const result = spawnSync(process.execPath, ['scripts/verify-harmony-candidate.mjs'], {
      encoding: 'utf8',
      env: { ...process.env, HARMONY_HAP_PATH: hapPath },
    })
    assert.notEqual(result.status, 0, result.stdout + result.stderr)
    assert.match(result.stdout + result.stderr, /秘密|真实数据|archive/)
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})
