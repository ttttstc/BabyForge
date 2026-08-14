PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS email_update_subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_update_subscriptions_enabled
  ON email_update_subscriptions (enabled, user_id);
