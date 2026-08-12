PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS temporary_visitor_links (
  id TEXT NOT NULL PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visitor_link_access_logs (
  id TEXT NOT NULL PRIMARY KEY,
  link_id TEXT NOT NULL REFERENCES temporary_visitor_links (id) ON DELETE CASCADE,
  resource_scope TEXT NOT NULL,
  result TEXT NOT NULL,
  accessed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_temporary_visitor_links_household
  ON temporary_visitor_links (household_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_visitor_link_access_logs_link
  ON visitor_link_access_logs (link_id, accessed_at);
