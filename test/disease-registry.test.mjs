import test from 'node:test'
import assert from 'node:assert/strict'
import { DISEASE_TOPICS, ORGAN_TOPICS, getDiseaseTopic, searchDiseaseTopics } from '../src/content/diseaseRegistry.js'

test('issue 14 registry covers every listed high-frequency pediatric condition', () => {
  assert.equal(DISEASE_TOPICS.length, 51)
  assert.equal(new Set(DISEASE_TOPICS.map((topic) => topic.id)).size, DISEASE_TOPICS.length)
  for (const topic of DISEASE_TOPICS) {
    assert.ok(topic.name.zh && topic.name.en, topic.id)
    assert.ok(topic.shortDefinition.zh && topic.shortDefinition.en, topic.id)
    assert.ok(topic.anatomyBinding.displayUnits.length >= 1, topic.id)
    assert.ok(topic.causes.length && topic.mechanismSteps.length >= 4, topic.id)
    assert.ok(topic.commonSymptoms.length >= 3 && topic.observationGuidance.length >= 3, topic.id)
    assert.ok(topic.generalManagement.zh && topic.homeCareGuidance.length && topic.avoidActions.length, topic.id)
    assert.ok(topic.careDepartment.primary.zh && topic.carePreparation.length, topic.id)
    assert.ok(topic.prevention.length && topic.sourceRefs.every((source) => source.url.startsWith('https://')), topic.id)
    assert.match(topic.escalationRuleRef, /^decision-unit:/, topic.id)
    assert.equal(topic.status, 'PUBLISHED')
  }
})

test('formal names and common aliases resolve to the same DiseaseTopic', () => {
  assert.equal(searchDiseaseTopics('手足口')[0].id, 'hand-foot-mouth')
  assert.equal(searchDiseaseTopics('上感')[0].id, 'common-cold')
  assert.equal(searchDiseaseTopics('HFMD', 'en-US')[0].id, 'hand-foot-mouth')
  assert.equal(searchDiseaseTopics('pink eye', 'en-US')[0].id, 'conjunctivitis')
})

test('five issue 14 acceptance topics preserve precise anatomy and fallback behavior', () => {
  const bronchiolitis = getDiseaseTopic('bronchiolitis')
  assert.match(bronchiolitis.quickTake.location.zh, /细支气管/)
  assert.equal(bronchiolitis.anatomyBinding.displayUnits[0].modelAvailability, 'AVAILABLE')
  assert.match(bronchiolitis.anatomyBinding.displayUnits[0].modelRef, /\/lungs\.glb$/)

  const hfmd = getDiseaseTopic('hand-foot-mouth')
  assert.deepEqual(hfmd.anatomyBinding.displayUnits.map((unit) => unit.title.zh), ['口腔黏膜', '手掌', '足底'])

  const jaundice = getDiseaseTopic('newborn-jaundice')
  assert.deepEqual(jaundice.anatomyBinding.displayUnits.map((unit) => unit.viewType), ['SURFACE_MAP', 'PATHWAY'])

  assert.match(getDiseaseTopic('acute-otitis-media').quickTake.location.zh, /中耳腔/)
  assert.match(getDiseaseTopic('pneumonia').quickTake.location.zh, /肺实质和肺泡/)
})

test('organ learning links back to shared disease topics and tolerates missing models', () => {
  const lungs = ORGAN_TOPICS.find((organ) => organ.id === 'lungs')
  assert.ok(lungs.relatedDiseaseIds.includes('pneumonia'))
  assert.strictEqual(getDiseaseTopic(lungs.relatedDiseaseIds.find((id) => id === 'pneumonia')), getDiseaseTopic('pneumonia'))
  const ear = ORGAN_TOPICS.find((organ) => organ.id === 'ear')
  assert.equal(ear.modelAvailability, 'PLANNED')
  assert.ok(ear.relatedDiseaseIds.includes('acute-otitis-media'))
})

test('available disease models keep their resource reference and valid optional anchors', () => {
  const availableUnits = DISEASE_TOPICS.flatMap((topic) => topic.anatomyBinding.displayUnits.filter((unit) => unit.modelAvailability === 'AVAILABLE'))
  assert.ok(availableUnits.length > 0)
  assert.ok(availableUnits.every((unit) => unit.modelRef))
  assert.ok(availableUnits.every((unit) => unit.leaderLines.every((line) => unit.anchorIds.includes(line.anchorId))))
})
