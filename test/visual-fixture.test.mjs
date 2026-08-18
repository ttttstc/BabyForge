import test from 'node:test'
import assert from 'node:assert/strict'
import { filterVisualEventsByBaby } from '../vite.config.js'

test('visual event fixture isolates events by baby', () => {
  const events = [
    { id: 'event-a', babyId: 'baby-a' },
    { id: 'event-b', babyId: 'baby-b' },
  ]

  assert.deepEqual(filterVisualEventsByBaby(events, 'baby-a'), [events[0]])
  assert.deepEqual(filterVisualEventsByBaby(events, 'baby-b'), [events[1]])
  assert.deepEqual(filterVisualEventsByBaby(events, ''), events)
})
