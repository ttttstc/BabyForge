PRAGMA foreign_keys = ON;

ALTER TABLE baby_profiles ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'detached'));

CREATE TABLE IF NOT EXISTS care_actors (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  preset_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (household_id, display_name)
);

CREATE TABLE IF NOT EXISTS care_events (
  id TEXT PRIMARY KEY,
  baby_id TEXT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('breastfeeding', 'bottle_feeding', 'diaper', 'sleep', 'medication', 'temperature', 'growth_measurement', 'symptom_observation', 'care_action', 'health_visit', 'vaccination', 'doctor_instruction')),
  occurred_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  recorded_by_id TEXT NOT NULL,
  recorded_by_name TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('caregiver_entered', 'doctor_entered', 'device_imported')),
  payload_json TEXT NOT NULL,
  related_concern_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'corrected', 'voided')),
  updated_by TEXT NOT NULL REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS care_event_revisions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES care_events(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  changed_by TEXT NOT NULL REFERENCES accounts(id),
  UNIQUE (event_id, version)
);

CREATE TABLE IF NOT EXISTS care_plan_items (
  id TEXT PRIMARY KEY,
  baby_id TEXT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  payload_json TEXT NOT NULL,
  related_concern_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS concerns (
  id TEXT PRIMARY KEY,
  baby_id TEXT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  topic_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_care_events_baby_updated ON care_events(baby_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_care_events_baby_occurred ON care_events(baby_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_care_event_revisions_event ON care_event_revisions(event_id, version);
CREATE INDEX IF NOT EXISTS idx_care_plan_items_baby_updated ON care_plan_items(baby_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_concerns_baby_updated ON concerns(baby_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_care_actors_household ON care_actors(household_id, active);
