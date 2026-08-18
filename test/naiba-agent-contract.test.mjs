import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  NAIBA_AGENT_CONTRACT,
  NAIBA_AGENT_CONTRACT_VERSION,
  normalizeNaibaAttachments,
  normalizeNaibaContext,
  normalizeNaibaHistory,
} from '../src/domain/naibaAgentContract.js'

test('shared Agent contract keeps multi-turn context bounded and ordered', () => {
  const history = Array.from({ length: 24 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', text: `turn-${index}` }))
  const normalized = normalizeNaibaHistory(history)
  assert.equal(normalized.length, 20)
  assert.equal(normalized[0].text, 'turn-4')
  assert.equal(normalized.at(-1).text, 'turn-23')
})

test('page context is allowlisted and image send requires explicit confirmation', () => {
  assert.deepEqual(normalizeNaibaContext({ source: 'growth', focus: 'weight', label: '体重趋势', ignored: 'x' }), { source: 'growth', focus: 'weight', label: '体重趋势' })
  assert.equal(normalizeNaibaContext({ source: 'settings' }), null)
  assert.throws(() => normalizeNaibaAttachments([{ kind: 'image', name: 'a.jpg', mimeType: 'image/jpeg', size: 1, dataUrl: 'data:image/jpeg;base64,AA==', confirmed: false }]), /consent/)
  assert.throws(() => normalizeNaibaAttachments([{ kind: 'image', name: 'a.jpg', mimeType: 'image/jpeg', size: 10, dataUrl: 'data:image/jpeg;base64,AA==', confirmed: true }]), /size/)
  assert.equal(normalizeNaibaAttachments([{ kind: 'image', name: 'a.jpg', mimeType: 'image/jpeg', size: 1, dataUrl: 'data:image/jpeg;base64,AA==', confirmed: true }]).length, 1)
  const image = { kind: 'image', name: 'a.jpg', mimeType: 'image/jpeg', size: 1, dataUrl: 'data:image/jpeg;base64,AA==', confirmed: true }
  const history = normalizeNaibaHistory([{ role: 'user', text: '第一张', attachments: [image] }, { role: 'assistant', text: '看到了' }, { role: 'user', text: '第二张', attachments: [image] }])
  assert.equal(history[0].attachments, undefined)
  assert.equal(history[2].attachments.length, 1)
})

test('Web and Harmony pin one Agent contract and endpoint without a native runtime fork', async () => {
  const [manifest, arkts, adapter] = await Promise.all([
    readFile(new URL('../contracts/naiba-agent-contract.v1.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../harmony/entry/src/main/ets/data/NativeAgentContract.ets', import.meta.url), 'utf8'),
    readFile(new URL('../harmony/entry/src/main/ets/data/NativeResourceAdapter.ets', import.meta.url), 'utf8'),
  ])
  assert.equal(manifest.contract, NAIBA_AGENT_CONTRACT)
  assert.equal(manifest.contractVersion, NAIBA_AGENT_CONTRACT_VERSION)
  assert.equal(manifest.conversationPersistence, false)
  assert.match(arkts, new RegExp(`NAIBA_AGENT_CONTRACT_VERSION: string = '${NAIBA_AGENT_CONTRACT_VERSION}'`))
  assert.match(adapter, /'\/api\/ai\/chat'/)
  assert.doesNotMatch(adapter, /\/api\/native\/ai\//)
})
