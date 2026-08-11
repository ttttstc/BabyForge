ALTER TABLE account_llm_configs ADD COLUMN ciphertext TEXT;
ALTER TABLE account_llm_configs ADD COLUMN nonce TEXT;
ALTER TABLE account_llm_configs ADD COLUMN key_version INTEGER;
