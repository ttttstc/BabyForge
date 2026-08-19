import test from 'node:test'
import assert from 'node:assert/strict'
import { searchAuthorityKnowledge } from '../functions/_shared/authoritySearch.js'

test('authority search returns structured provenance only from allowed HTTPS hosts', async () => {
  let sent
  const results = await searchAuthorityKnowledge('infant safe sleep', {
    apiKey: 'test-key',
    now: new Date('2026-08-19T00:00:00.000Z'),
    fetchImpl: async (_url, init) => {
      sent = JSON.parse(init.body)
      return { ok: true, async json() { return { results: [
        { url: 'https://www.who.int/example', title: 'WHO', content: 'General education.' },
        { url: 'https://who.int.attacker.example/bad', title: 'Bad', content: 'Bad.' },
        { url: 'http://cdc.gov/insecure', title: 'Insecure', content: 'Bad.' },
      ] } } }
    },
  })
  assert.deepEqual(sent.include_domains, ['nhc.gov.cn', 'who.int', 'cdc.gov'])
  assert.equal(results.length, 1)
  assert.equal(results[0].provisional, true)
  assert.equal(results[0].source.url, 'https://www.who.int/example')
  assert.equal(results[0].retrievedAt, '2026-08-19T00:00:00.000Z')
})

test('authority search fails closed without a key or on provider failure', async () => {
  assert.deepEqual(await searchAuthorityKnowledge('question'), [])
  assert.deepEqual(await searchAuthorityKnowledge('question', { apiKey: 'key', fetchImpl: async () => { throw new Error('offline') } }), [])
})
