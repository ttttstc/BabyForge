ALTER TABLE account_llm_configs ADD COLUMN ciphertext TEXT;
ALTER TABLE account_llm_configs ADD COLUMN nonce TEXT;
ALTER TABLE account_llm_configs ADD COLUMN key_version INTEGER;

CREATE TRIGGER account_llm_configs_reject_plaintext_insert
BEFORE INSERT ON account_llm_configs
WHEN NEW.api_key <> ''
BEGIN
  SELECT RAISE(ABORT, 'plaintext LLM API keys are forbidden');
END;

CREATE TRIGGER account_llm_configs_reject_plaintext_update
BEFORE UPDATE OF api_key ON account_llm_configs
WHEN NEW.api_key <> ''
BEGIN
  SELECT RAISE(ABORT, 'plaintext LLM API keys are forbidden');
END;
