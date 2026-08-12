CREATE TABLE IF NOT EXISTS demo_showcase_sessions (
  token_hash TEXT PRIMARY KEY,
  baby_id TEXT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_demo_showcase_sessions_expiry
  ON demo_showcase_sessions(expires_at);
