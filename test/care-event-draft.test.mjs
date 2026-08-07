import test from 'node:test'
import assert from 'node:assert/strict'
import { draftText, isCareEventDraftIntent, parseCareEventDraft } from '../src/domain/careEventDraft.js'

const baby = { id: 'baby-1', birthDate: '2026-08-01' }
const actor = { id: 'parent-father', displayName: '爸爸' }
const now = '2026-08-07T10:00:00.000Z'

test('natural language bottle feed creates actual-intake draft, not recommendation', () => {
  const draft = parseCareEventDraft({ message: '刚才宝宝喝了 50 mL 配方奶', baby, actor, now })
  assert.equal(draft.status, 'draft_ready')
  assert.equal(draft.event.category, 'bottle_feeding')
  assert.equal(draft.event.payload.amountMl, 50)
  assert.equal(draft.needsConfirmation, true)
})

test('direct breastfeeding draft never invents millilitres', () => {
  const draft = parseCareEventDraft({ message: '刚才亲喂了一次', baby, actor, now })
  assert.equal(draft.event.category, 'breastfeeding')
  assert.equal(draft.event.payload.amountMl, undefined)
  assert.match(draft.summary, /不估算毫升数/)
})

test('record intent asks for missing actual amount', () => {
  const draft = parseCareEventDraft({ message: '帮我记录刚才的喂养', baby, actor, now })
  assert.equal(draft.status, 'needs_information')
  assert.match(draft.question, /实际喝下多少/)
  assert.match(draftText(draft), /实际喝下多少/)
})

test('symptoms need explicit record intent before a draft is created', () => {
  assert.equal(isCareEventDraftIntent('宝宝呼吸困难'), false)
  const draft = parseCareEventDraft({ message: '记录宝宝呼吸困难', baby, actor, now })
  assert.equal(draft.status, 'draft_ready')
  assert.equal(draft.event.category, 'symptom_observation')
  assert.deepEqual(draft.event.payload.symptoms, ['breathing'])
})

test('follow-up numeric answer completes a temperature draft context', () => {
  const draft = parseCareEventDraft({ message: '记录宝宝体温', baby, actor, now })
  assert.equal(draft.status, 'needs_information')
  const completed = parseCareEventDraft({ message: '38.2℃', baby, actor, context: { category: 'temperature' }, now })
  assert.equal(completed.status, 'draft_ready')
  assert.equal(completed.event.payload.value, 38.2)
})

test('bottle draft rejects implausible amounts instead of creating a factual event', () => {
  const draft = parseCareEventDraft({ message: '刚才宝宝喝了 99999 mL 配方奶', baby, actor, now })
  assert.equal(draft.status, 'needs_information')
  assert.match(draft.question, /重新核对|推荐量不能代替实际摄入/)
})

test('growth draft rejects values outside the measurement boundary', () => {
  const draft = parseCareEventDraft({ message: '记录体重 99 kg', baby, actor, now })
  assert.equal(draft.status, 'needs_information')
  assert.match(draft.question, /超出可核对范围/)
})
