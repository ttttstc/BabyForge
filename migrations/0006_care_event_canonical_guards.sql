-- SQLite cannot add NOT NULL to an existing column with ALTER TABLE.
-- These guards enforce the same canonical write invariant for direct D1 tools
-- and future scripts after the 0005 backfill has populated current rows.
CREATE TRIGGER IF NOT EXISTS care_events_canonical_insert_guard
BEFORE INSERT ON care_events
WHEN NEW.kind IS NULL
  OR NEW.category IS NULL
  OR NEW.actor_id IS NULL
  OR NEW.actor_display_name IS NULL
  OR NEW.event_source IS NULL
BEGIN
  SELECT RAISE(ABORT, 'care_events canonical fields are required');
END;

CREATE TRIGGER IF NOT EXISTS care_events_canonical_update_guard
BEFORE UPDATE OF kind, category, actor_id, actor_display_name, event_source ON care_events
WHEN NEW.kind IS NULL
  OR NEW.category IS NULL
  OR NEW.actor_id IS NULL
  OR NEW.actor_display_name IS NULL
  OR NEW.event_source IS NULL
BEGIN
  SELECT RAISE(ABORT, 'care_events canonical fields are required');
END;
