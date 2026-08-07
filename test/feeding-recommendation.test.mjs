import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateFeedingRecommendation, FEEDING_KNOWLEDGE_VERSION } from '../src/domain/feedingRecommendation.js'

const now = new Date('2026-08-07T10:00:00.000Z')

test('newborn formula recommendation uses a versioned reference range', () => {
  const result = calculateFeedingRecommendation({
    baby: { birthDate: '2026-08-05', feedingMode: 'formula' },
    now,
  })

  assert.equal(result.status, 'decision_ready')
  assert.equal(result.knowledgeVersion, FEEDING_KNOWLEDGE_VERSION)
  assert.match(result.recommendations[0].quantity, /30–60mL\/次/)
  assert.match(result.recommendations[0].quantity, /8–12/) 
  assert.equal(result.sources[0].authority, 'CDC')
})

test('direct breastfeeding never fabricates a millilitre amount', () => {
  const result = calculateFeedingRecommendation({
    baby: { birthDate: '2026-07-20', feedingMode: 'breastfeeding' },
    now,
  })

  assert.equal(result.status, 'decision_ready')
  assert.match(result.recommendations[0].quantity, /不估算毫升数/)
  assert.doesNotMatch(result.recommendations[0].quantity, /\d+\s*mL/)
})

test('six-month recommendation includes milk and complementary-food frequency', () => {
  const result = calculateFeedingRecommendation({
    baby: { birthDate: '2026-02-07', feedingMode: 'formula' },
    now,
  })

  assert.equal(result.ageMonths, 6)
  assert.equal(result.recommendations.length, 2)
  assert.match(result.recommendations[0].quantity, /800–1000mL\/日/)
  assert.match(result.recommendations[1].quantity, /每日 1–2 次/)
  assert.ok(result.sources.some((source) => source.authority === '国家卫生健康委'))
})

test('unknown feeding mode blocks quantity generation', () => {
  const result = calculateFeedingRecommendation({
    baby: { birthDate: '2026-08-01', feedingMode: 'other' },
    now,
  })

  assert.equal(result.status, 'needs_information')
  assert.deepEqual(result.missing, ['feedingMode'])
  assert.equal(result.recommendations.length, 0)
})

test('recent breathing signal takes priority over the diet card', () => {
  const result = calculateFeedingRecommendation({
    baby: { birthDate: '2026-08-01', feedingMode: 'formula' },
    events: [{
      id: 'symptom-1',
      category: 'symptom_observation',
      occurredAt: '2026-08-07T09:30:00.000Z',
      payload: { symptoms: ['breathing'] },
      status: 'active',
    }],
    now,
  })

  assert.equal(result.status, 'safety_action_required')
  assert.equal(result.recommendations.length, 0)
})
