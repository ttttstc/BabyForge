-- Keep a public read-only account available for product showcase access.
-- The password is stored as a PBKDF2 hash; only the documented demo login is public.
INSERT OR IGNORE INTO accounts (id, username, role, display_name, password_salt, password_hash, password_iterations)
VALUES ('account-guest', 'guest', 'guest', '只读演示账号', '4c6f6e675f64656d6f5f73616c745f3132', 'b0baa133df8eb8305d3315643dcb22dcff75dc357feba077d3ae87f3596aa688', 10000);

INSERT OR IGNORE INTO household_members (household_id, account_id, role)
SELECT 'household-niwa', id, 'guest'
FROM accounts
WHERE username = 'guest';
