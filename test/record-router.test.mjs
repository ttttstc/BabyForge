import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNaibaRoute, buildRecordRoute, parseHashLocation, resolveNaibaReturnTo, resolveRecordReturnTo, ROUTES } from '../src/app/router.js'

test('record routes preserve panel, metric, date, filter, event, and encoded return context', () => {
  const route = buildRecordRoute({
    panel: 'growth',
    metric: 'headCircumference',
    filter: 'growth',
    date: 'today',
    event: 'growth-1',
    mode: 'detail',
    returnTo: ROUTES.growthHistory,
  })

  const location = parseHashLocation(route)
  assert.equal(location.route, ROUTES.records)
  assert.equal(location.params.get('panel'), 'growth')
  assert.equal(location.params.get('metric'), 'headCircumference')
  assert.equal(location.params.get('filter'), 'growth')
  assert.equal(location.params.get('date'), 'today')
  assert.equal(location.params.get('event'), 'growth-1')
  assert.equal(location.params.get('mode'), 'detail')
  assert.equal(location.params.get('returnTo'), ROUTES.growthHistory)
})

test('record return context accepts Today and Growth routes but rejects arbitrary hashes', () => {
  assert.equal(resolveRecordReturnTo(ROUTES.today), ROUTES.today)
  assert.equal(resolveRecordReturnTo(`${ROUTES.growthChart}?metric=weight`), `${ROUTES.growthChart}?metric=weight`)
  assert.equal(resolveRecordReturnTo('#/settings'), null)
  assert.equal(resolveRecordReturnTo('not-a-hash'), null)
})

test('health routes canonicalize old vaccine and pediatric deep links', () => {
  assert.equal(parseHashLocation(ROUTES.health).route, ROUTES.healthVaccines)
  assert.equal(parseHashLocation(ROUTES.vaccines).route, ROUTES.healthVaccines)
  assert.equal(parseHashLocation(`${ROUTES.pediatric}?disease=croup`).route, ROUTES.healthDiseases)
  assert.equal(parseHashLocation(`${ROUTES.pediatric}?view=organs&organ=lung`).route, ROUTES.healthOrgans)
})

test('global AI preserves safe authenticated return context', () => {
  const route = buildNaibaRoute({ returnTo: `${ROUTES.healthDiseases}?disease=croup`, skill: 'triage_and_preassessment', unit: 'croup' })
  const location = parseHashLocation(route)
  assert.equal(location.route, ROUTES.naibaAi)
  assert.equal(location.params.get('returnTo'), `${ROUTES.healthDiseases}?disease=croup`)
  assert.equal(resolveNaibaReturnTo(location.params.get('returnTo')), `${ROUTES.healthDiseases}?disease=croup`)
  assert.equal(resolveNaibaReturnTo(ROUTES.settings), ROUTES.settings)
  assert.equal(resolveNaibaReturnTo('#/login'), null)
})
