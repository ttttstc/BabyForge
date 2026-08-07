import test from 'node:test'
import assert from 'node:assert/strict'

import { getContentAgeBandForBaby, isAllowedTrustedDomain, normalizeExperienceResult, sortExperienceResults } from '../src/domain/experience.js'
import { clearExperienceCache, fetchExperience } from '../src/domain/experienceApi.js'
import { onRequestGet } from '../functions/api/experience.js'
import { searchExperience, writeExperienceCache } from '../functions/_shared/experience.js'

function d1For({ session, baby }) {
  return {
    prepare(sql) {
      return {
        bind() {
          return {
            first: async () => sql.includes('auth_sessions') ? session : baby,
          }
        },
      }
    },
  }
}

test('Tavily search sends only server-generated query context and returns filtered cards', async () => {
  const originalFetch = globalThis.fetch
  let requestBody
  let returnedResults
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'https://api.tavily.com/search')
      assert.equal(init.headers.authorization, 'Bearer test-key')
      requestBody = JSON.parse(init.body)
      returnedResults = [
        { title: '新生儿安全睡眠科普', url: 'https://www.nhc.gov.cn/sleep?utm_source=test', content: '介绍安全睡眠环境和睡姿。', raw_content: '介绍安全睡眠环境和睡姿，提醒不要自行用药。', score: 0.91 },
        { title: '新生儿奶粉优惠', url: 'https://example.com/ad', content: '立即购买奶粉，限时优惠。', score: 0.99 },
      ]
      return { ok: true, status: 200, json: async () => ({ results: returnedResults }) }
    }
    const band = getContentAgeBandForBaby('2026-08-01', '2026-08-05').band
    const articles = await searchExperience({ env: { TAVILY_API_KEY: 'test-key' }, band, categoryId: 'health' })
    assert.equal(requestBody.query, '0到28天新生儿 健康观察 黄疸 体温 呼吸 尿便 精神状态 医院 医生科普')
    assert.equal(requestBody.search_depth, 'basic')
    assert.equal(requestBody.auto_parameters, false)
    assert.equal(requestBody.include_answer, false)
    assert.equal(articles.length, 1)
    assert.equal(articles[0].sourceType, 'professional')
    assert.equal('score' in articles[0], false)
    assert.equal(returnedResults[0].raw_content, null)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('stalled Tavily requests time out without holding the server request open', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async (_url, init) => new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
    })
    const band = getContentAgeBandForBaby('2026-08-01', '2026-08-05').band
    await assert.rejects(
      searchExperience({ env: { TAVILY_API_KEY: 'test-key' }, band, categoryId: 'feeding', timeoutMs: 10 }),
      (error) => error.status === 504,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('experience client aborts stalled requests and exposes a local timeout error', async () => {
  let aborted = false
  const fetchImpl = async (_url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => {
      aborted = true
      reject(new DOMException('aborted', 'AbortError'))
    }, { once: true })
  })
  await assert.rejects(
    fetchExperience({ babyId: 'baby-1', categoryId: 'recommended', fetchImpl, timeoutMs: 10 }),
    (error) => error.code === 'EXPERIENCE_TIMEOUT',
  )
  assert.equal(aborted, true)
})

test('experience API denies guest refresh and returns unavailable for ages beyond 36 months', async () => {
  const session = { token: 'token', expires_at: '2999-01-01T00:00:00.000Z', id: 'account-1', account_id: 'account-1', username: 'baby', role: 'guest', display_name: '游客' }
  const baby = { id: 'baby-1', birthDate: '2026-08-01', locale: 'zh-CN' }
  const env = { DB: d1For({ session, baby }), TAVILY_API_KEY: 'unused' }
  const refreshResponse = await onRequestGet({ request: new Request('https://babyforge.test/api/experience?babyId=baby-1&category=feeding&refresh=1', { headers: { cookie: 'babyforge_session=token' } }), env })
  assert.equal(refreshResponse.status, 403)

  const oldBaby = { ...baby, birthDate: '2023-07-01' }
  const unavailableResponse = await onRequestGet({ request: new Request('https://babyforge.test/api/experience?babyId=baby-1&category=feeding', { headers: { cookie: 'babyforge_session=token' } }), env: { ...env, DB: d1For({ session, baby: oldBaby }) } })
  assert.equal(unavailableResponse.status, 200)
  assert.equal((await unavailableResponse.json()).available, false)

  const futureResponse = await onRequestGet({ request: new Request('https://babyforge.test/api/experience?babyId=baby-1&category=feeding', { headers: { cookie: 'babyforge_session=token' } }), env: { ...env, DB: d1For({ session, baby: { ...baby, birthDate: '2099-01-01' } }) } })
  assert.equal(futureResponse.status, 422)
})

const newbornBand = getContentAgeBandForBaby('2026-08-01', '2026-08-05').band

function normalizedArticle(content, title = '婴儿护理提醒') {
  return normalizeExperienceResult({ title, url: 'https://example.com/article', content }, { band: newbornBand, categoryId: 'care' })
}

test('trusted domains require explicit wildcard boundaries', () => {
  const source = { domain: '*.gov.cn', enabled: true }
  assert.equal(isAllowedTrustedDomain('evilgov.cn', source), false)
  assert.equal(isAllowedTrustedDomain('gov.cn.evil.example', source), false)
  assert.equal(isAllowedTrustedDomain('www.nhc.gov.cn', source), true)
  assert.equal(isAllowedTrustedDomain('hospital.gov.cn', source), true)
})

test('negated high-risk advice is retained while actionable advice is rejected', () => {
  assert.notEqual(normalizedArticle('在医生指导之外，切勿自行给孩子喂蜂蜜。'), null)
  assert.notEqual(normalizedArticle('医生提醒不要捂汗；出现异常应及时就医。'), null)
  assert.notEqual(normalizedArticle('切勿自行给孩子喂蜂蜜。请记录孩子的状态。'), null)
  assert.equal(normalizedArticle('家长可以给孩子喂蜂蜜。'), null)
})

test('medical urgency is not treated as advertising, but purchase urgency is', () => {
  assert.notEqual(normalizedArticle('孩子出现异常，请立即就医。', '需要及时就医'), null)
  assert.notEqual(normalizedArticle('发现异常请立即挂号。', '就医提醒'), null)
  assert.equal(normalizedArticle('请立即购买保温睡袋。', '安全睡眠用品推荐'), null)
})

test('unknown source domains use unique sort pools without changing stable order', () => {
  const articles = Array.from({ length: 5 }, (_, index) => ({ id: `unknown-${index}`, sourceDomain: '', sourceType: 'experience', score: 1, publishedAt: '2026-08-01' }))
  assert.deepEqual(sortExperienceResults(articles).map((article) => article.id), articles.map((article) => article.id))
})

test('experience cache cleanup removes only experience entries', () => {
  const values = new Map([
    ['babyforge:experience:v1:baby-1:zh-CN:newborn:care', '{}'],
    ['babyforge:experience:v1:baby-2:zh-CN:newborn:feeding', '{}'],
    ['babyforge:workspace:v1:baby-1', '{}'],
  ])
  const storage = {
    get length() { return values.size },
    key(index) { return [...values.keys()][index] || null },
    removeItem(key) { values.delete(key) },
  }
  assert.equal(clearExperienceCache({ storage }), 2)
  assert.deepEqual([...values.keys()], ['babyforge:workspace:v1:baby-1'])
})

test('cache write failures never reject the experience request path', async () => {
  const originalCaches = globalThis.caches
  try {
    globalThis.caches = { default: { put: async () => { throw new Error('cache unavailable') } } }
    await assert.doesNotReject(writeExperienceCache('https://babyforge.test/api/experience', 'experience:test', { articles: [] }))
  } finally {
    globalThis.caches = originalCaches
  }
})
