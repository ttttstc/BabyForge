PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'caregiver', 'guest')),
  display_name TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 10000,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_account_id TEXT NOT NULL REFERENCES accounts(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS household_members (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'caregiver', 'guest')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (household_id, account_id)
);

CREATE TABLE IF NOT EXISTS baby_profiles (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  gestational_weeks INTEGER NOT NULL,
  sex TEXT,
  feeding_mode TEXT,
  locale TEXT NOT NULL DEFAULT 'zh-CN',
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS workspace_records (
  baby_id TEXT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  collection TEXT NOT NULL,
  record_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES accounts(id),
  PRIMARY KEY (baby_id, collection, record_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_household_members_account ON household_members(account_id, active);
CREATE INDEX IF NOT EXISTS idx_workspace_records_baby ON workspace_records(baby_id, collection);

-- Demo credentials are stored as PBKDF2 hashes, never as plaintext passwords.
INSERT OR IGNORE INTO accounts (id, username, role, display_name, password_salt, password_hash, password_iterations)
VALUES ('account-niwa', 'niwa', 'admin', '管理员', 'c4f7d8e1b9a64d68b65a72f01c17a89b', '2161e8292005c2fa89253183d007fe1751d55a56618c6beceb1df73a00cd50f5', 10000);

INSERT OR IGNORE INTO accounts (id, username, role, display_name, password_salt, password_hash, password_iterations)
VALUES ('account-baby', 'baby', 'guest', '游客', 'a9e24e7c1f2d4b68a76e31c5f8a9012d', '58f1b52b52a7b8363be63bb1502027ee73c6b9b0b4a7c06c364c75e610c23ccf', 10000);
