import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'

import { isSessionFresh } from '../functions/_shared/principal.js'
import { scheduleAuthEmailDelivery } from '../functions/_shared/betterAuth.js'
import { onRequest as handleAuthRequest } from '../functions/api/auth/[[path]].js'
import { acceptInviteMembership } from '../functions/api/household/invites/[token]/accept.js'
import { restoreDeletedHousehold } from '../functions/api/household/restore.js'
import { logoutRequest } from '../functions/api/logout.js'
import { isOneBabyConstraintError, onRequestPost as syncWorkspace } from '../functions/api/sync.js'

function d1Database(database) {
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

test('sync cannot update a baby that belongs to another household', async () => {
  const database = new DatabaseSync(':memory:')
  database.exec(`
    CREATE TABLE accounts (id TEXT PRIMARY KEY, username TEXT, role TEXT, display_name TEXT, active INTEGER);
    CREATE TABLE auth_sessions (token TEXT PRIMARY KEY, account_id TEXT, expires_at TEXT);
    CREATE TABLE households (id TEXT PRIMARY KEY, name TEXT, deleted_at TEXT);
    CREATE TABLE household_members (household_id TEXT, account_id TEXT, user_id TEXT, role TEXT, active INTEGER);
    CREATE TABLE baby_profiles (
      id TEXT PRIMARY KEY, household_id TEXT NOT NULL, nickname TEXT NOT NULL, birth_date TEXT NOT NULL,
      gestational_weeks INTEGER NOT NULL, gestational_days INTEGER NOT NULL DEFAULT 0,
      growth_age_basis TEXT NOT NULL DEFAULT 'chronological', birth_multiplicity TEXT NOT NULL DEFAULT 'singleton',
      sex TEXT, feeding_mode TEXT, locale TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
      updated_at TEXT NOT NULL, updated_by TEXT NOT NULL
    );
    CREATE UNIQUE INDEX idx_baby_profiles_one_per_household ON baby_profiles(household_id);
    CREATE TABLE workspace_records (
      baby_id TEXT, collection TEXT, record_id TEXT, payload_json TEXT, updated_at TEXT, updated_by TEXT,
      PRIMARY KEY (baby_id, collection, record_id)
    );
  `)
  database.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, 1)').run('attacker', 'attacker', 'caregiver', '攻击者')
  database.prepare('INSERT INTO auth_sessions VALUES (?, ?, ?)').run('attacker-token', 'attacker', '2099-01-01T00:00:00.000Z')
  database.prepare('INSERT INTO households VALUES (?, ?, NULL)').run('home-a', 'A')
  database.prepare('INSERT INTO households VALUES (?, ?, NULL)').run('home-b', 'B')
  database.prepare('INSERT INTO household_members VALUES (?, ?, NULL, ?, 1)').run('home-a', 'attacker', 'caregiver')
  database.prepare(`
    INSERT INTO baby_profiles
    VALUES (?, ?, ?, ?, 40, 0, 'chronological', 'singleton', 'female', 'mixed', 'zh-CN', 'active', ?, ?)
  `).run('victim-baby', 'home-b', '原始昵称', '2026-01-01', '2026-08-11T00:00:00.000Z', 'victim')

  const response = await syncWorkspace({
    env: { DB: d1Database(database) },
    request: new Request('https://babyforge.test/api/sync', {
      method: 'POST',
      headers: { cookie: 'babyforge_session=attacker-token', 'content-type': 'application/json' },
      body: JSON.stringify({
        baby: { id: 'victim-baby', nickname: '被篡改', birthDate: '2026-02-02', gestationalWeeks: 39 },
      }),
    }),
  })

  assert.equal(response.status, 403)
  assert.match((await response.json()).error, /无权/)
  assert.deepEqual({ ...database.prepare('SELECT household_id, nickname, birth_date FROM baby_profiles WHERE id = ?').get('victim-baby') }, {
    household_id: 'home-b', nickname: '原始昵称', birth_date: '2026-01-01',
  })
})

test('deleted households cannot gain an active member through an invite race', async () => {
  const database = new DatabaseSync(':memory:')
  database.exec(`
    CREATE TABLE households (id TEXT PRIMARY KEY, deleted_at TEXT);
    CREATE TABLE household_invites (
      id TEXT PRIMARY KEY, household_id TEXT, expires_at TEXT, used_at TEXT, revoked_at TEXT
    );
    CREATE TABLE household_members (
      household_id TEXT, account_id TEXT, role TEXT, active INTEGER, user_id TEXT,
      membership_role TEXT, created_at TEXT
    );
    CREATE UNIQUE INDEX idx_household_members_one_active_user
      ON household_members(user_id) WHERE active = 1 AND user_id IS NOT NULL;
  `)
  database.prepare('INSERT INTO households VALUES (?, ?)').run('deleted-home', '2026-08-11T11:59:59.000Z')
  database.prepare('INSERT INTO household_invites VALUES (?, ?, ?, NULL, NULL)').run('invite-1', 'deleted-home', '2099-01-01T00:00:00.000Z')

  const results = await acceptInviteMembership(
    { DB: d1Database(database) },
    { id: 'invite-1', household_id: 'deleted-home' },
    { accountId: 'account-new', userId: 'user-new' },
    '2026-08-11T12:00:00.000Z',
  )

  assert.equal(results[0].meta.changes, 0)
  assert.equal(results[1].meta.changes, 0)
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM household_members WHERE active = 1').get().count, 0)

  database.prepare('INSERT INTO households VALUES (?, NULL)').run('active-home')
  database.prepare('INSERT INTO household_invites VALUES (?, ?, ?, NULL, NULL)').run('invite-2', 'active-home', '2099-01-01T00:00:00.000Z')
  const accepted = await acceptInviteMembership(
    { DB: d1Database(database) },
    { id: 'invite-2', household_id: 'active-home' },
    { accountId: 'account-new', userId: 'user-new' },
    '2026-08-11T12:00:00.000Z',
  )
  assert.equal(accepted[0].meta.changes, 1)
  assert.equal(accepted[1].meta.changes, 1)
  assert.deepEqual({ ...database.prepare('SELECT household_id, user_id, active FROM household_members').get() }, {
    household_id: 'active-home', user_id: 'user-new', active: 1,
  })
})

test('auth email delivery is attached to the request lifetime without delaying it', async () => {
  let finishDelivery
  const delivery = new Promise((resolve) => { finishDelivery = resolve })
  let backgroundTask
  const result = scheduleAuthEmailDelivery(delivery, (task) => { backgroundTask = task }, assert.fail)

  assert.equal(result, undefined)
  assert.ok(backgroundTask)
  finishDelivery()
  await backgroundTask
})
