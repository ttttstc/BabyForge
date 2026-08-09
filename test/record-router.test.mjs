import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRecordRoute, parseHashLocation, resolveRecordReturnTo, ROUTES } from '../src/app/router.js'

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
