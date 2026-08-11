import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'

import { onRequestPost as loginDemo } from '../functions/api/demo-login.js'
import { onRequestGet as readShowcase } from '../functions/api/demo-showcase.js'
import { onRequestGet as listShowcasePhotos } from '../functions/api/demo-showcase/photos.js'
import { onRequestGet as readShowcasePhoto } from '../functions/api/demo-showcase/photos/[id].js'

function d1(database) {
  return {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() {
              const result = database.prepare(sql).run(...values)
              return { meta: { changes: Number(result.changes) } }
            },
            async first() { return database.prepare(sql).get(...values) || null },
            async all() { return { results: database.prepare(sql).all(...values) } },
          }
        },
      }
    },
  }
}

function fixture() {
  const database = new DatabaseSync(':memory:')
  database.exec(`
    CREATE TABLE baby_profiles (
      id TEXT PRIMARY KEY, nickname TEXT, birth_date TEXT, gestational_weeks INTEGER,
      gestational_days INTEGER, growth_age_basis TEXT, birth_multiplicity TEXT,
      sex TEXT, feeding_mode TEXT, locale TEXT, status TEXT
    );
    CREATE TABLE workspace_records (baby_id TEXT, collection TEXT, payload_json TEXT, updated_at TEXT);
    CREATE TABLE care_events (
      id TEXT PRIMARY KEY, baby_id TEXT, kind TEXT, category TEXT, type TEXT,
      occurred_at TEXT, recorded_at TEXT, actor_id TEXT, actor_display_name TEXT,
      recorded_by_id TEXT, recorded_by_name TEXT, event_source TEXT, source TEXT,
      payload_json TEXT, status TEXT, corrected_from_id TEXT, version INTEGER,
      created_at TEXT, updated_at TEXT
    );
    CREATE TABLE baby_photos (
      id TEXT PRIMARY KEY, baby_id TEXT, object_key TEXT, content_type TEXT,
      size_bytes INTEGER, taken_at TEXT, time_source TEXT, created_at TEXT
    );
    INSERT INTO baby_profiles VALUES ('baby-showcase', '宝宝真名', '2026-07-29', 39, 2, 'chronological', 'singleton', 'female', 'mixed', 'zh-CN', 'active');
    INSERT INTO workspace_records VALUES ('baby-showcase', 'growthMeasurements', '{"id":"growth-1","type":"weight","value":4.2,"unit":"kg","measuredAt":"2026-08-10"}', '2026-08-10');
    INSERT INTO workspace_records VALUES ('baby-showcase', 'questions', '["私密问题"]', '2026-08-10');
    INSERT INTO care_events VALUES ('feed-1', 'baby-showcase', 'care_fact', 'bottle_feeding', 'bottle_feeding', '2026-08-10T08:00:00Z', '2026-08-10T08:01:00Z', 'parent-1', '真实家长姓名', 'parent-1', '真实家长姓名', 'caregiver', 'caregiver', '{"amountMl":90,"milkType":"formula"}', 'active', NULL, 1, '2026-08-10', '2026-08-10');
    INSERT INTO care_events VALUES ('medicine-1', 'baby-showcase', 'care_fact', 'medication', 'medication', '2026-08-10T09:00:00Z', '2026-08-10T09:01:00Z', 'parent-1', '真实家长姓名', 'parent-1', '真实家长姓名', 'caregiver', 'caregiver', '{"medicationName":"私密药品"}', 'active', NULL, 1, '2026-08-10', '2026-08-10');
    INSERT INTO baby_photos VALUES ('photo-1', 'baby-showcase', 'babies/baby-showcase/photos/photo-1', 'image/jpeg', 4, '2026-08-10T10:00:00Z', 'upload', '2026-08-10');
  `)
  database.exec(readFileSync(new URL('../migrations/0018_demo_showcase_sessions.sql', import.meta.url), 'utf8'))
  const env = {
    DB: d1(database),
    BABYFORGE_PRESET_ACCOUNTS: JSON.stringify({
      demos: [{ username: 'branded-demo', password: 'test-password', variant: 'niwa', displayName: '品牌演示' }],
      admin: {
        username: 'formal-admin', password: 'admin-password', email: 'owner@example.test',
        accountId: 'account-owner', householdId: 'home-owner', babyId: 'baby-showcase',
      },
    }),
    BABY_PHOTOS: {
      async get(key) {
        return key.includes('photo-1') ? { body: new Uint8Array([1, 2, 3, 4]), httpEtag: 'etag-1' } : null
      },
    },
  }
  return { database, env }
}

async function signIn(env) {
  const response = await loginDemo({
    env,
    request: new Request('https://example.test/api/demo-login', {
      method: 'POST',
      body: JSON.stringify({ username: 'branded-demo', password: 'test-password' }),
    }),
  })
  assert.equal(response.status, 200)
  assert.equal((await response.clone().json()).demo.showcase, true)
  return response.headers.get('set-cookie').split(';')[0]
}

test('branded demo returns an allowlisted read-only view of real baby data', async () => {
  const { env } = fixture()
  const cookie = await signIn(env)
  const response = await readShowcase({ env, request: new Request('https://example.test/api/demo-showcase', { headers: { cookie } }) })
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(payload.readOnly, true)
  assert.equal(payload.baby.nickname, '宝宝真名')
  assert.equal(payload.baby.birthDate, '2026-07-01')
  assert.equal(payload.baby.birthDatePrecision, 'month')
  assert.equal(payload.growthMeasurements.length, 1)
  assert.deepEqual(payload.questions, [])
  assert.deepEqual(payload.careEvents.map((event) => event.category), ['bottle_feeding'])
  assert.equal(payload.careEvents[0].actor.displayName, '家长')
  assert.doesNotMatch(JSON.stringify(payload), /私密问题|私密药品|真实家长姓名/)
})

test('branded demo can list and view only photos belonging to its configured baby', async () => {
  const { env } = fixture()
  const cookie = await signIn(env)
  const request = new Request('https://example.test/api/demo-showcase/photos', { headers: { cookie } })
  const listed = await listShowcasePhotos({ env, request })
  const photos = (await listed.json()).photos
  assert.equal(photos.length, 1)
  assert.equal(photos[0].fileName, undefined)
  assert.equal(photos[0].contentUrl, '/api/demo-showcase/photos/photo-1')

  const content = await readShowcasePhoto({ env, request, params: { id: 'photo-1' } })
  assert.equal(content.status, 200)
  assert.equal(content.headers.get('content-disposition'), null)
  assert.deepEqual([...new Uint8Array(await content.arrayBuffer())], [1, 2, 3, 4])
  const missing = await readShowcasePhoto({ env, request, params: { id: 'other-photo' } })
  assert.equal(missing.status, 404)
})
