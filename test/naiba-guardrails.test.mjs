import test from 'node:test'
import assert from 'node:assert/strict'
import { createNaibaTools } from '../functions/_shared/naibaTools.js'
import { isApprovedAuthorityUrl, outputAllowed, toolOutputAllowed } from '../src/domain/naibaGuardrails.js'

test('authority URL guard requires exact https hosts without URL tricks', () => {
  assert.equal(isApprovedAuthorityUrl('https://www.who.int/health'), true)
  assert.equal(isApprovedAuthorityUrl('http://www.who.int/health'), false)
  assert.equal(isApprovedAuthorityUrl('https://www.who.int@attacker.example/health'), false)
  assert.equal(isApprovedAuthorityUrl('https://www.who.int/health#https://attacker.example'), false)
  assert.equal(isApprovedAuthorityUrl('javascript://www.who.int/%0Aalert(1)'), false)
  assert.equal(outputAllowed('依据：https://www.who.int/health', {}), true)
  assert.equal(outputAllowed('依据：https://www.who.int@attacker.example/health', {}), false)
})

test('tool output uses the same medical and authority boundary', () => {
  assert.equal(toolOutputAllowed({ text: '请按处方剂量服用' }), false)
  assert.equal(toolOutputAllowed({ text: '来源：https://attacker.example' }), false)
  assert.equal(toolOutputAllowed({ text: '已记录事实，不含行动建议' }), true)
})

test('hosted search tools remain constructible while local tools are wrapped', () => {
  const tools = createNaibaTools('stage_parenting_qa', { allowExternalSearch: true })
  assert.ok(tools.some((item) => item.name === 'web_search'))
  assert.ok(tools.filter((item) => item.name !== 'web_search').every((item) => typeof item.invoke === 'function'))
})
