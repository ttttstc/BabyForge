import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { listSkillContracts } from '../functions/_shared/skillRegistry.js'
import { NATIVE_AI_CONTRACT, NATIVE_AI_CONTRACT_VERSION, NATIVE_AI_STATUSES, validateNativeAiEnvelope } from '../src/domain/nativeAiContract.js'

async function read(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

test('native AI contract pins the shared registry, status machine, and privacy floor', async () => {
  const manifest = JSON.parse(await read('contracts/native-ai-contract.v1.json'))
  assert.equal(manifest.contract, NATIVE_AI_CONTRACT)
  assert.equal(manifest.contractVersion, NATIVE_AI_CONTRACT_VERSION)
  assert.equal(manifest.sourceOfTruth, 'src/domain/naibaSkills.js')
  assert.deepEqual(manifest.statuses, NATIVE_AI_STATUSES)
  assert.equal(manifest.attachmentPolicy.photos, 'explicit-send-only')
  assert.equal(manifest.attachmentPolicy.photoPreview, 'required-before-send')
  assert.equal(manifest.attachmentPolicy.reportsIncludeOriginals, false)
  assert.equal(manifest.attachmentPolicy.shareIncludesOriginals, false)
  assert.ok(manifest.invariants.includes('sessions-are-continuity-not-facts'))
  assert.ok(manifest.invariants.includes('missing-facts-are-not-zero'))
  assert.ok(manifest.invariants.includes('read-only-cannot-confirm-drafts'))
  assert.deepEqual(listSkillContracts().map((skill) => skill.id), [
    'baby_context_injector',
    'authority_knowledge_retriever',
    'care_event_quick_logger',
    'daily_care_analysis',
    'daily_feeding_recommender',
    'detailed_care_analysis',
    'stage_parenting_qa',
    'disease_explainer',
    'triage_and_preassessment',
    'growth_and_development_interpreter',
    'daily_growth_plan_builder',
    'medical_report_interpreter',
    'visit_brief_generator',
    'caregiver_handoff_builder',
  ])
})

test('native AI envelope rejects contract drift before rendering', () => {
  const valid = { contract: NATIVE_AI_CONTRACT, contractVersion: NATIVE_AI_CONTRACT_VERSION, status: 'success' }
  assert.equal(validateNativeAiEnvelope(valid), valid)
  assert.throws(() => validateNativeAiEnvelope({ ...valid, contractVersion: '9.0.0' }), /version-unsupported/)
  assert.throws(() => validateNativeAiEnvelope(null), /envelope-invalid/)
})

test('native AI root exposes continuity, explicit context, multimodal confirmation, and recovery states', async () => {
  const [index, adapter, bootstrap, chat, capability, aiContract, webChat] = await Promise.all([
    read('harmony/entry/src/main/ets/pages/Index.ets'),
    read('harmony/entry/src/main/ets/data/NativeResourceAdapter.ets'),
    read('functions/api/native/ai/bootstrap.js'),
    read('functions/api/native/ai/chat.js'),
    read('functions/api/native/ai/capability.js'),
    read('harmony/entry/src/main/ets/data/NativeAiContract.ets'),
    read('functions/api/ai/chat.js'),
  ])
  for (const marker of ['aiSurface()', 'loadAi()', '新对话', '最近会话', 'aiContextVisible', '不会自动发送', '系统语音', '照片', '报告', '再次发送并识别', '停止', 'offline', 'draft_expired', 'ai_baby_anchor']) {
    assert.ok(index.includes(marker), `missing native AI state: ${marker}`)
  }
  for (const marker of ['/api/native/ai/bootstrap', '/api/native/ai/chat', '/api/native/ai/capability', '/api/ai/report', '/api/ai/drafts', 'cancelAiChat']) {
    assert.ok(adapter.includes(marker), `missing native adapter path: ${marker}`)
  }
  assert.match(bootstrap, /listSkillContracts\(\)/)
  assert.match(bootstrap, /photosImplicitlySent: false/)
  assert.match(chat, /runWebChat/)
  assert.match(webChat, /NATIVE_AI_CONTRACT_VERSION/)
  assert.match(capability, /executeNaibaSkill/)
  assert.match(capability, /buildBabyContextSummary/)
  assert.match(aiContract, /NATIVE_AI_CONTRACT_VERSION: string = '1\.0\.0'/)
})

test('native AI anchor is a real bundled resource rather than a remote image', async () => {
  const image = await stat(new URL('../harmony/entry/src/main/resources/base/media/ai_baby_anchor.png', import.meta.url))
  assert.ok(image.size > 100_000)
})
