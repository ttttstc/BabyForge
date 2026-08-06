-- Issue #7 canonical CareEvent fields. The old columns remain as storage
-- aliases so this migration is safe for an already-created empty workspace;
-- API responses and new writes use only the canonical protocol.
ALTER TABLE care_events ADD COLUMN kind TEXT;
ALTER TABLE care_events ADD COLUMN category TEXT;
ALTER TABLE care_events ADD COLUMN actor_id TEXT;
ALTER TABLE care_events ADD COLUMN actor_display_name TEXT;
ALTER TABLE care_events ADD COLUMN event_source TEXT;
ALTER TABLE care_events ADD COLUMN corrected_from_id TEXT;

UPDATE care_events
SET kind = CASE
      WHEN type IN ('temperature', 'growth_measurement') THEN 'measurement'
      WHEN type = 'doctor_instruction' THEN 'professional_conclusion'
      ELSE 'caregiver_observation'
    END,
    category = COALESCE(type, 'care_action'),
    actor_id = recorded_by_id,
    actor_display_name = recorded_by_name,
    event_source = CASE source
      WHEN 'caregiver_entered' THEN 'caregiver'
      WHEN 'doctor_entered' THEN 'clinical_record'
      WHEN 'device_imported' THEN 'device_import'
      ELSE 'unknown'
    END
WHERE kind IS NULL;

CREATE INDEX IF NOT EXISTS idx_care_events_baby_category ON care_events(baby_id, category, occurred_at);
CREATE INDEX IF NOT EXISTS idx_care_events_baby_kind ON care_events(baby_id, kind, occurred_at);
