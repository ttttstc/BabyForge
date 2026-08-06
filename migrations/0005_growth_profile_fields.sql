ALTER TABLE baby_profiles ADD COLUMN gestational_days INTEGER NOT NULL DEFAULT 0 CHECK (gestational_days BETWEEN 0 AND 6);
ALTER TABLE baby_profiles ADD COLUMN growth_age_basis TEXT NOT NULL DEFAULT 'chronological' CHECK (growth_age_basis IN ('chronological', 'corrected', 'postmenstrual'));
ALTER TABLE baby_profiles ADD COLUMN birth_multiplicity TEXT NOT NULL DEFAULT 'singleton' CHECK (birth_multiplicity IN ('singleton', 'multiple'));
