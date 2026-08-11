CREATE UNIQUE INDEX IF NOT EXISTS idx_baby_profiles_one_per_household
  ON baby_profiles (household_id);
