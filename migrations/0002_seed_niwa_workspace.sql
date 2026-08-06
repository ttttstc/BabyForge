-- The shared demo workspace lets the owner and the read-only visitor enter the
-- same initial BabyForge view. It contains only the profile shell; care facts
-- are added by the owner or an authorized caregiver.
INSERT OR IGNORE INTO households (id, name, owner_account_id)
VALUES ('household-niwa', '泥蛙的家庭', 'account-niwa');

INSERT OR IGNORE INTO household_members (household_id, account_id, role)
VALUES ('household-niwa', 'account-niwa', 'owner');

INSERT OR IGNORE INTO household_members (household_id, account_id, role)
VALUES ('household-niwa', 'account-baby', 'guest');

INSERT OR IGNORE INTO baby_profiles (id, household_id, nickname, birth_date, gestational_weeks, sex, feeding_mode, locale, updated_at, updated_by)
VALUES ('baby-niwa', 'household-niwa', '泥蛙', '2026-08-01', 40, NULL, 'mixed', 'zh-CN', '2026-08-06T00:00:00.000Z', 'account-niwa');
