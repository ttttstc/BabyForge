import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'

import { ensureConfiguredAdminAccount, hashToken } from '../functions/_shared/principal.js'
import { createTemporaryVisitorLink } from '../functions/api/visitor-links.js'
import { onRequestPost as viewVisitorSummary } from '../functions/api/visitor.js'

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

function fixture() {
  const database = new DatabaseSync(':memory:')
  database.exec(`
    CREATE TABLE "user" (id TEXT PRIMARY KEY);
    CREATE TABLE households (id TEXT PRIMARY KEY, deleted_at TEXT);
    CREATE TABLE baby_profiles (id TEXT PRIMARY KEY, household_id TEXT, nickname TEXT, birth_date TEXT, status TEXT);
    CREATE TABLE care_events (
      id TEXT PRIMARY KEY, baby_id TEXT, category TEXT, type TEXT, status TEXT,
      occurred_at TEXT, payload_json TEXT
    );
  `)
  database.exec(readFileSync(new URL('../migrations/0017_temporary_visitor_links.sql', import.meta.url), 'utf8'))
  database.prepare('INSERT INTO "user" VALUES (?)').run('owner-1')
  database.prepare('INSERT INTO households VALUES (?, NULL)').run('home-1')
  database.prepare('INSERT INTO baby_profiles VALUES (?, ?, ?, ?, ?)').run('baby-1', 'home-1', '私密昵称', '2026-08-01', 'active')
  return { database, env: { DB: d1Database(database) } }
}

async function addLink(database, { id, token, expiresAt, revokedAt = null }) {
  database.prepare(`
    INSERT INTO temporary_visitor_links
      (id, household_id, token_hash, expires_at, revoked_at, created_by_user_id)
    VALUES (?, 'home-1', ?, ?, ?, 'owner-1')
  `).run(id, await hashToken(token), expiresAt, revokedAt)
}

test('visitor API returns only a redacted 24-hour aggregate and writes an audit row', async () => {
  const { database, env } = fixture()
  const token = 'visitor-token-with-enough-entropy-1234567890'
  await addLink(database, { id: 'link-1', token, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() })
  const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  database.prepare('INSERT INTO care_events VALUES (?, ?, ?, ?, ?, ?, ?)').run('feed-1', 'baby-1', 'bottle_feeding', 'bottle_feeding', 'active', recent, '{"amountMl":90,"private":"secret"}')
  database.prepare('INSERT INTO care_events VALUES (?, ?, ?, ?, ?, ?, ?)').run('sleep-1', 'baby-1', 'sleep', 'sleep', 'active', recent, '{"endedAt":"private"}')
  database.prepare('INSERT INTO care_events VALUES (?, ?, ?, ?, ?, ?, ?)').run('diaper-1', 'baby-1', 'diaper', 'diaper', 'active', recent, '{"kind":"stool"}')

  const response = await viewVisitorSummary({ env, request: new Request('https://babyforge.test/api/visitor', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) }) })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const text = await response.text()
  const payload = JSON.parse(text)
  assert.deepEqual(payload.visitor.careSummary, { feedingCount: 1, sleepCount: 1, diaperCount: 1 })
  assert.equal(payload.visitor.label, '宝宝')
  assert.doesNotMatch(text, /私密昵称|2026-08-01|amountMl|secret|object_key|https?:\/\//i)
  assert.deepEqual({ ...database.prepare('SELECT link_id, resource_scope, result FROM visitor_link_access_logs').get() }, {
    link_id: 'link-1', resource_scope: 'care_summary_24h', result: 'success',
  })
})

test('revoked, expired, and deleted-household visitor links fail closed', async () => {
  const { database, env } = fixture()
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  await addLink(database, { id: 'revoked', token: 'revoked-token-12345678901234567890', expiresAt: future, revokedAt: past })
  await addLink(database, { id: 'expired', token: 'expired-token-12345678901234567890', expiresAt: past })
  await addLink(database, { id: 'deleted', token: 'deleted-token-12345678901234567890', expiresAt: future })

  const request = (token) => new Request('https://babyforge.test/api/visitor', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) })
  assert.equal((await viewVisitorSummary({ env, request: request('revoked-token-12345678901234567890') })).status, 410)
  assert.equal((await viewVisitorSummary({ env, request: request('expired-token-12345678901234567890') })).status, 410)
  database.prepare('UPDATE households SET deleted_at = ? WHERE id = ?').run(past, 'home-1')
  assert.equal((await viewVisitorSummary({ env, request: request('deleted-token-12345678901234567890') })).status, 410)
  assert.deepEqual(database.prepare('SELECT result FROM visitor_link_access_logs ORDER BY accessed_at, id').all().map((row) => row.result).sort(), ['expired', 'household_deleted', 'revoked'])
})

test('new visitor links persist only a hash, never the plaintext token', async () => {
  const { database, env } = fixture()
  const link = await createTemporaryVisitorLink(env, 'home-1', 'owner-1')
  const stored = database.prepare('SELECT token_hash, expires_at FROM temporary_visitor_links WHERE id = ?').get(link.id)
  assert.equal(link.token.length, 43)
  assert.equal(stored.token_hash, await hashToken(link.token))
  assert.notEqual(stored.token_hash, link.token)
  assert.equal(JSON.stringify(stored).includes(link.token), false)
})

test('public seeded guest credentials are disabled without touching other accounts', () => {
  const database = new DatabaseSync(':memory:')
  database.exec(`
    CREATE TABLE accounts (id TEXT PRIMARY KEY, active INTEGER);
    CREATE TABLE auth_sessions (token TEXT, account_id TEXT);
    CREATE TABLE household_members (account_id TEXT, active INTEGER, inactive_at TEXT);
    INSERT INTO accounts VALUES ('account-baby', 1), ('account-guest', 1), ('owner-real', 1);
    INSERT INTO auth_sessions VALUES ('guest-session', 'account-guest'), ('owner-session', 'owner-real');
    INSERT INTO household_members VALUES ('account-baby', 1, NULL), ('account-guest', 1, NULL), ('owner-real', 1, NULL);
  `)
  database.exec(readFileSync(new URL('../migrations/0016_disable_public_demo_accounts.sql', import.meta.url), 'utf8'))
  assert.deepEqual(database.prepare('SELECT id, active FROM accounts ORDER BY id').all().map((row) => ({ ...row })), [
    { id: 'account-baby', active: 0 }, { id: 'account-guest', active: 0 }, { id: 'owner-real', active: 1 },
  ])
  assert.deepEqual(database.prepare('SELECT token FROM auth_sessions').all().map((row) => row.token), ['owner-session'])
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM household_members WHERE account_id LIKE 'account-%' AND active = 1").get().count, 0)
})

test('configured admin email is rebound to the configured existing household', async () => {
  const database = new DatabaseSync(':memory:')
  database.exec(`
    CREATE TABLE accounts (id TEXT PRIMARY KEY, username TEXT, role TEXT, display_name TEXT, active INTEGER);
    CREATE TABLE households (id TEXT PRIMARY KEY, owner_account_id TEXT, owner_user_id TEXT, deleted_at TEXT);
    CREATE TABLE baby_profiles (id TEXT PRIMARY KEY, household_id TEXT, updated_by TEXT);
    CREATE TABLE household_members (
      household_id TEXT, account_id TEXT, role TEXT, active INTEGER,
      user_id TEXT, membership_role TEXT, inactive_at TEXT,
      PRIMARY KEY (household_id, account_id)
    );
    CREATE TABLE auth_user_account_links (user_id TEXT PRIMARY KEY, account_id TEXT UNIQUE);
    INSERT INTO accounts VALUES ('account-owner', 'ops-user', 'caregiver', '管理员', 1), ('account-old', 'old-user', 'caregiver', '旧账号', 1);
    INSERT INTO households VALUES ('home-owner', 'account-owner', NULL, NULL), ('home-old', 'account-old', 'user-1', NULL);
    INSERT INTO baby_profiles VALUES ('baby-owner', 'home-owner', 'account-owner');
    INSERT INTO household_members VALUES ('home-owner', 'account-owner', 'owner', 1, NULL, 'owner', NULL);
    INSERT INTO household_members VALUES ('home-old', 'account-old', 'owner', 1, 'user-1', 'owner', NULL);
    INSERT INTO auth_user_account_links VALUES ('user-1', 'account-old');
  `)
  const env = {
    DB: d1Database(database),
    BABYFORGE_PRESET_ACCOUNTS: JSON.stringify({ admin: {
      username: 'ops-user', password: 'test-password', email: 'owner@example.test',
      accountId: 'account-owner', householdId: 'home-owner', babyId: 'baby-owner',
    } }),
  }
  const account = await ensureConfiguredAdminAccount(env, { id: 'user-1', email: 'owner@example.test' })
  assert.equal(account.id, 'account-owner')
  assert.deepEqual({ ...database.prepare('SELECT account_id FROM auth_user_account_links WHERE user_id = ?').get('user-1') }, { account_id: 'account-owner' })
  assert.deepEqual({ ...database.prepare('SELECT user_id, membership_role, active FROM household_members WHERE household_id = ?').get('home-owner') }, {
    user_id: 'user-1', membership_role: 'owner', active: 1,
  })
  assert.equal(database.prepare('SELECT active FROM household_members WHERE household_id = ?').get('home-old').active, 0)
  assert.equal(database.prepare('SELECT owner_user_id FROM households WHERE id = ?').get('home-owner').owner_user_id, 'user-1')
})
