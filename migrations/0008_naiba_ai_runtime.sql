-- Naiba AI runtime records. AI messages are continuity data; only confirmed
-- CareEvents enter the formal baby state and care-event ledger.
CREATE TABLE IF NOT EXISTS ai_conversations (
  id TEXT PRIMARY KEY,
  baby_id TEXT NOT NULL REFERENCES baby_profiles(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_account_baby ON ai_conversations(account_id, baby_id, updated_at);

CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content_json TEXT NOT NULL,
  skill_id TEXT,
  decision_result_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created ON ai_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS decision_results (
  id TEXT PRIMARY KEY,
  baby_id TEXT NOT NULL REFERENCES baby_profiles(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  unit_id TEXT NOT NULL,
  unit_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('needs_information', 'decision_ready', 'safety_action_required', 'unsupported')),
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_decision_results_baby_created ON decision_results(baby_id, created_at);

CREATE TABLE IF NOT EXISTS ai_drafts (
  id TEXT PRIMARY KEY,
  baby_id TEXT NOT NULL REFERENCES baby_profiles(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  draft_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'discarded', 'expired')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  confirmed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_drafts_account_baby_status ON ai_drafts(account_id, baby_id, status, created_at);

CREATE TABLE IF NOT EXISTS knowledge_pack_manifests (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  manifest_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'retired')),
  created_at TEXT NOT NULL,
  approved_at TEXT
);

CREATE TABLE IF NOT EXISTS provisional_knowledge_evidence (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  baby_id TEXT REFERENCES baby_profiles(id),
  query TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  policy_status TEXT NOT NULL CHECK (policy_status IN ('accepted_general', 'rejected', 'conflict', 'stale')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS health_episodes (
  id TEXT PRIMARY KEY,
  baby_id TEXT NOT NULL REFERENCES baby_profiles(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  topic TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  summary_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO knowledge_pack_manifests (id, version, manifest_json, status, created_at, approved_at)
VALUES (
  'knowledge-pack-2026-08-07',
  'knowledge-pack-2026-08-07',
  '{"scope":"0-28 days complete beta core plus staged 0-6 year protocol","authorities":["NHC","WHO","CDC"],"networkPolicy":"restricted-authority-fallback"}',
  'approved',
  '2026-08-07T00:00:00.000Z',
  '2026-08-07T00:00:00.000Z'
);
