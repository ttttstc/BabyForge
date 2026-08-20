CREATE INDEX IF NOT EXISTS idx_baby_photos_baby_taken
ON baby_photos(baby_id, taken_at DESC, created_at DESC, id DESC);
