PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS email_notification_contacts (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (household_id, email)
);

CREATE INDEX IF NOT EXISTS idx_email_notification_contacts_household
  ON email_notification_contacts (household_id, enabled, created_at);
