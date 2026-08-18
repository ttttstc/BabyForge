import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildNativeExploreModel } from '../src/domain/nativeExplore.js'
import { buildNativeGrowthModel } from '../src/domain/nativeGrowth.js'
import { buildNativeSettingsModel } from '../src/domain/nativeSettings.js'
import { createNativeResourceClient } from '../src/domain/nativeResourceAdapter.js'

const baby = {
  id: 'baby-72',
  nickname: '小满',
  birthDate: '2026-01-01',
  sex: 'female',
  gestationalWeeks: 35,
  gestationalDays: 4,
  growthAgeBasis: 'corrected',
  birthMultiplicity: 'singleton',
  locale: 'zh-CN',
}

const permissions = { role: 'owner', readOnly: false, canEdit: true, canManageHousehold: true }
const now = '2026-08-18T02:00:00.000Z'

function measurement(id, value, measuredAt = '2026-08-10') {
  return { id, type: 'weight', value, unit: 'kg', measuredAt, source: 'caregiver_observation', status: 'active' }
}

test('native growth model shares current facts, reference curves, age basis, conflicts, and care actions', () => {
  const model = buildNativeGrowthModel({
    baby,
    now,
    permissions,
    measurements: [
      measurement('weight-a', 7.1),
      measurement('weight-b', 7.6),
      { ...measurement('length-1', 66, '2026-08-01'), type: 'length', unit: 'cm' },
    ],
    milestoneRecords: [{ milestoneId: 'social-smile', status: 'done' }],
    adminTaskRecords: [{ taskId: 'newborn-review', status: 'pending' }],
    carePlanItems: [{ id: 'plan-1', title: '观察喂养', status: 'pending' }],
  })

  assert.equal(model.contract, 'babyforge.native.growth')
  assert.equal(model.metadata.timezone, 'Asia/Shanghai')
  assert.equal(model.age.basis, 'corrected')
  assert.equal(model.charts.length, 3)
  assert.equal(model.charts[0].reference.length, 7)
  assert.ok(model.metrics.find(metric => metric.id === 'weight').latest.conflict)
  assert.equal(model.metrics.find(metric => metric.id === 'weight').change.available, false)
  assert.ok(model.measurements.some(item => item.conflict))
  assert.ok(Array.isArray(model.milestones))
  assert.ok(Array.isArray(model.adminTasks))
  assert.ok(model.parentActions.some(item => item.id === 'plan-1'))
})

test('native growth model keeps missing metrics unknown and never invents a zero', () => {
  const model = buildNativeGrowthModel({ baby, now, permissions })
  const length = model.metrics.find(metric => metric.id === 'length')
  assert.equal(length.latest, null)
  assert.equal(length.change.value, null)
  assert.equal(model.interpretation.status, 'needs_information')
})

test('native explore model exposes vaccine status, full reviewed topics, anatomy fallback, and source policy', () => {
  const model = buildNativeExploreModel({
    baby,
    now,
    permissions,
    events: [{
      id: 'vaccine-event',
      category: 'vaccine',
      status: 'active',
      occurredAt: '2026-02-01T00:00:00.000Z',
      payload: { vaccineId: 'hepb-1', status: 'completed' },
    }],
    experienceFeed: {
      category: 'recommended',
      ageBand: { id: 'early-infant', label: '早期婴儿' },
      ageText: '7个月',
      generatedAt: '2026-08-17T00:00:00.000Z',
      expiresAt: '2026-08-18T00:00:00.000Z',
      staleUntil: '2026-08-25T00:00:00.000Z',
      cacheState: 'stale',
      articles: [{ id: 'article-1', title: '原文', url: 'https://example.com/article', sourceName: '第三方来源' }],
    },
  })

  assert.equal(model.contract, 'babyforge.native.explore')
  assert.equal(model.vaccines.length, 27)
  assert.equal(model.vaccines.find(item => item.id === 'hepb-1').status, 'completed')
  assert.equal(model.diseases.length, 51)
  assert.ok(model.diseases[0].mechanismSteps)
  assert.equal(model.organs.length, 16)
  assert.equal(model.anatomy.length, 16)
  assert.ok(model.anatomy.some(item => item.controlled3d.fallbackText.includes('完整结构')))
  assert.equal(model.experience.cacheState, 'stale')
  assert.equal(model.sourcePolicy.thirdPartyExperience, 'external-source')
  assert.equal(model.sourcePolicy.rawSourceRequired, true)
})

test('native settings model never returns a raw API key and preserves permissions/cache policy', () => {
  const model = buildNativeSettingsModel({
    baby,
    user: { id: 'user-72', email: 'parent@example.com', name: '家长' },
    permissions: { role: 'readOnly', readOnly: true, canEdit: false, canManageHousehold: false },
    llmConfig: { baseUrl: 'https://llm.example.com', model: 'model-x', apiKey: 'raw-secret', apiKeyMasked: '••••cret' },
    localCache: { available: true, clearable: true },
  })

  assert.equal(model.permissions.readOnly, true)
  assert.equal(model.llmConfig.apiKey, undefined)
  assert.equal(model.llmConfig.apiKeyMasked, '••••cret')
  assert.equal(model.localCache.clearable, true)
})

test('native web adapter validates issue 72 models and uses shared endpoints', async () => {
  const growth = buildNativeGrowthModel({ baby, now, permissions })
  const explore = buildNativeExploreModel({ baby, now, permissions, experienceFeed: { category: 'recommended', articles: [], cacheState: 'empty' } })
  const settings = buildNativeSettingsModel({ baby, user: { id: 'user-72', email: 'parent@example.com', name: '家长' }, permissions })
  const requests = []
  const client = createNativeResourceClient({
    baseUrl: 'https://babyforge.bbroot.com',
    timezone: 'Asia/Shanghai',
    fetchImpl: async (url, options) => {
      requests.push({ url, options })
      const path = new URL(url, 'https://babyforge.bbroot.com').pathname
      const body = path === '/api/native/growth' ? growth : path === '/api/native/explore' ? explore : settings
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })

  assert.equal((await client.growth()).contract, 'babyforge.native.growth')
  assert.equal((await client.explore({ category: 'recommended' })).contract, 'babyforge.native.explore')
  assert.equal((await client.settings()).contract, 'babyforge.native.settings')
  assert.equal((await client.updateSettings({ nickname: '家长', baby: { nickname: '小满' } })).contract, 'babyforge.native.settings')
  assert.deepEqual(requests.map(request => new URL(request.url).pathname), [
    '/api/native/growth',
    '/api/native/explore',
    '/api/native/settings',
    '/api/native/settings',
  ])
  assert.equal(requests[0].options.headers['x-babyforge-timezone'], 'Asia/Shanghai')
  assert.equal(requests[3].options.method, 'PATCH')
})

test('issue 72 JSON contracts keep all native surfaces versioned', async () => {
  const names = ['growth', 'explore', 'settings']
  for (const name of names) {
    const contract = JSON.parse(await readFile(new URL(`../contracts/native-${name}-contract.v1.json`, import.meta.url), 'utf8'))
    assert.equal(contract.contractVersion, '1.0.0')
    assert.ok(contract.requiredFields.length >= 10)
    assert.equal(contract.offlineQueue, false)
  }
})
