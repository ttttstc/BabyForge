import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'

import { isSessionFresh } from '../functions/_shared/principal.js'
import { onRequest as handleAuthRequest } from '../functions/api/auth/[[path]].js'
import { restoreDeletedHousehold } from '../functions/api/household/restore.js'
import { logoutRequest } from '../functions/api/logout.js'
import { isOneBabyConstraintError } from '../functions/api/sync.js'

function d1Database(database) {
  return {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() {
              return database.prepare(sql).run(...values)
            },
          }
        },
      }
    },
    async batch(statements) {
      database.exec('BEGIN')
      try {
        const results = []
        for (const statement of statements) results.push(await statement.run())
        database.exec('COMMIT')
        return results
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    },
  }
}

test('logout revokes legacy token and clears both session cookies', async () => {
  const deletedTokens = []
  const env = {
    DB: {
      prepare(sql) {
        assert.match(sql, /DELETE FROM auth_sessions/)
        return {
          bind(token) {
            return { async run() { deletedTokens.push(token) } }
          },
        }
      },
    },
  }
  const request = new Request('https://babyforge.test/api/logout', {
    method: 'POST',
    headers: { cookie: 'better-auth.session_token=better-token; babyforge_session=legacy-token' },
  })
  const response = await logoutRequest(request, env, {
    createAuth: () => ({
      async handler(signOutRequest) {
        assert.equal(new URL(signOutRequest.url).pathname, '/api/auth/sign-out')
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'set-cookie': 'better-auth.session_token=; Path=/; Max-Age=0' },
        })
      },
    }),
  })

  assert.deepEqual(deletedTokens, ['legacy-token'])
  const cookies = response.headers.getSetCookie().join('\n')
  assert.match(cookies, /better-auth\.session_token=.*Max-Age=0/)
  assert.match(cookies, /babyforge_session=.*Max-Age=0/)
})

test('session refresh does not renew sensitive-operation freshness', () => {
  const now = Date.parse('2026-08-11T12:00:00.000Z')
  assert.equal(isSessionFresh({
    createdAt: '2026-08-11T10:00:00.000Z',
    updatedAt: '2026-08-11T11:59:30.000Z',
  }, 10 * 60, now), false)
  assert.equal(isSessionFresh({
    createdAt: '2026-08-11T11:55:00.000Z',
    updatedAt: '2026-08-11T11:59:30.000Z',
  }, 10 * 60, now), true)
})

test('direct email signup rejects numeric-only passwords before Better Auth', async () => {
  const response = await handleAuthRequest({
    request: new Request('https://babyforge.test/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'parent@example.com', password: '123456', name: '家长' }),
    }),
    env: {},
  })
  assert.equal(response.status, 400)
  const body = await response.json()
  assert.equal(body.error.code, 'INVALID_PASSWORD')
  assert.match(body.error.message, /字母和数字/)
})

test('household restore reactivates owner without conflicting former members', async () => {
  const database = new DatabaseSync(':memory:')
  database.exec(`
    CREATE TABLE households (id TEXT PRIMARY KEY, deleted_at TEXT, updated_at TEXT);
    CREATE TABLE household_members (
      household_id TEXT NOT NULL,
      user_id TEXT,
      role TEXT,
      membership_role TEXT,
      active INTEGER NOT NULL,
      inactive_at TEXT
    );
    CREATE UNIQUE INDEX idx_household_members_one_active_user
      ON household_members (user_id) WHERE active = 1 AND user_id IS NOT NULL;
  `)
  const deletedAt = '2026-08-11T10:00:00.000Z'
  database.prepare('INSERT INTO households VALUES (?, ?, ?)').run('old-home', deletedAt, deletedAt)
  database.prepare('INSERT INTO households VALUES (?, NULL, ?)').run('new-home', deletedAt)
  database.prepare('INSERT INTO household_members VALUES (?, ?, ?, ?, 0, ?)').run('old-home', 'owner', 'owner', 'owner', deletedAt)
  database.prepare('INSERT INTO household_members VALUES (?, ?, ?, ?, 0, ?)').run('old-home', 'member', 'caregiver', 'member', deletedAt)
  database.prepare('INSERT INTO household_members VALUES (?, ?, ?, ?, 1, NULL)').run('new-home', 'member', 'caregiver', 'member')

  await restoreDeletedHousehold(
    { DB: d1Database(database) },
    { id: 'old-home', deletedAt },
    { userId: 'owner' },
    '2026-08-11T12:00:00.000Z',
  )

  assert.equal(database.prepare('SELECT deleted_at FROM households WHERE id = ?').get('old-home').deleted_at, null)
  assert.equal(database.prepare('SELECT active FROM household_members WHERE household_id = ? AND user_id = ?').get('old-home', 'owner').active, 1)
  assert.equal(database.prepare('SELECT active FROM household_members WHERE household_id = ? AND user_id = ?').get('old-home', 'member').active, 0)
})

test('database enforces one baby per household', () => {
  const database = new DatabaseSync(':memory:')
  database.exec('CREATE TABLE baby_profiles (id TEXT PRIMARY KEY, household_id TEXT NOT NULL)')
  const migration = readFileSync(new URL('../migrations/0015_one_baby_per_household.sql', import.meta.url), 'utf8')
  database.exec(migration)
  database.prepare('INSERT INTO baby_profiles VALUES (?, ?)').run('baby-1', 'home-1')

  assert.throws(
    () => database.prepare('INSERT INTO baby_profiles VALUES (?, ?)').run('baby-2', 'home-1'),
    /UNIQUE constraint failed: baby_profiles\.household_id/,
  )
  assert.equal(isOneBabyConstraintError(new Error('UNIQUE constraint failed: baby_profiles.household_id')), true)
})
