import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateSourceAuthority, getKnowledgePackManifest, searchApprovedKnowledge } from '../src/domain/knowledgePack.js'

test('knowledge search is deterministic and only returns allowlisted authorities', () => {
  const first = searchApprovedKnowledge('辅食', { ageMonths: 6 })
  const second = searchApprovedKnowledge('辅食', { ageMonths: 6 })
  assert.deepEqual(first, second)
  assert.ok(first.length >= 1)
  assert.ok(first.every((unit) => evaluateSourceAuthority(unit.source).approved))
})

test('unknown source fails authority policy closed', () => {
  assert.equal(evaluateSourceAuthority({ url: 'https://example.com/advice', publisher: 'Unknown', editionOrVersion: '1' }).approved, false)
  assert.equal(getKnowledgePackManifest().status, 'approved')
})
