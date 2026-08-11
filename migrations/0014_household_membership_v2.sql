-- Additive Household fields. Legacy account_id and role remain readable until
-- the authorization cutover and contract migrations land.
ALTER TABLE households ADD COLUMN owner_user_id TEXT;
ALTER TABLE households ADD COLUMN deleted_at TEXT;
ALTER TABLE households ADD COLUMN updated_at TEXT;

ALTER TABLE household_members ADD COLUMN user_id TEXT;
ALTER TABLE household_members ADD COLUMN membership_role TEXT;
ALTER TABLE household_members ADD COLUMN inactive_at TEXT;

UPDATE household_members
SET membership_role = CASE WHEN role = 'owner' THEN 'owner' ELSE 'member' END
WHERE membership_role IS NULL;

CREATE TABLE IF NOT EXISTS household_invites (
  id TEXT NOT NULL PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  revoked_at TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_household_members_user_active
  ON household_members (user_id, active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_household_members_one_active_user
  ON household_members (user_id) WHERE active = 1 AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_household_invites_household
  ON household_invites (household_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_households_deleted_at
  ON households (deleted_at);
