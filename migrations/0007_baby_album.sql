PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS baby_photos (
  id TEXT PRIMARY KEY,
  baby_id TEXT NOT NULL REFERENCES baby_profiles(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  taken_at TEXT NOT NULL,
  time_source TEXT NOT NULL CHECK (time_source IN ('manual', 'exif', 'file', 'upload')),
  uploaded_by TEXT NOT NULL REFERENCES accounts(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_baby_photos_baby_created ON baby_photos(baby_id, created_at);
