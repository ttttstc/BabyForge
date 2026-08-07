import test from 'node:test'
import assert from 'node:assert/strict'

import { getContentAgeBandForBaby } from '../src/domain/experience.js'
import { onRequestGet } from '../functions/api/experience.js'
import { searchExperience } from '../functions/_shared/experience.js'

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
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'https://api.tavily.com/search')
      assert.equal(init.headers.authorization, 'Bearer test-key')
      requestBody = JSON.parse(init.body)
      return new Response(JSON.stringify({ results: [
        { title: '新生儿安全睡眠科普', url: 'https://www.nhc.gov.cn/sleep?utm_source=test', content: '介绍安全睡眠环境和睡姿。', raw_content: '介绍安全睡眠环境和睡姿，提醒不要自行用药。', score: 0.91 },
        { title: '新生儿奶粉优惠', url: 'https://example.com/ad', content: '立即购买奶粉，限时优惠。', score: 0.99 },
      ] }), { status: 200, headers: { 'content-type': 'application/json' } })
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
  } finally {
    globalThis.fetch = originalFetch
  }
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
})
