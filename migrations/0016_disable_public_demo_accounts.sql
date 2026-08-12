-- Public showcase access now uses the isolated browser-only demo sandbox.
-- Disable seeded guest credentials so demo traffic never enters production D1.
DELETE FROM auth_sessions
WHERE account_id IN ('account-baby', 'account-guest');

UPDATE household_members
SET active = 0, inactive_at = CURRENT_TIMESTAMP
WHERE account_id IN ('account-baby', 'account-guest') AND active = 1;

UPDATE accounts
SET active = 0
WHERE id IN ('account-baby', 'account-guest');
