-- Per-account, per-baby, and global daily model usage windows.
-- Counters are intentionally coarse: they protect spend and abuse without
-- storing prompt or response contents.
CREATE TABLE IF NOT EXISTS ai_usage_windows (
  scope_key TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id),
  baby_id TEXT REFERENCES baby_profiles(id),
  window_start TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  token_estimate INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_windows_account_day ON ai_usage_windows(account_id, window_start);
CREATE INDEX IF NOT EXISTS idx_ai_usage_windows_baby_day ON ai_usage_windows(baby_id, window_start);
