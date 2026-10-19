-- Migration for NEX Onboarding Flow and Vault Commercials
-- Adds state tracking for onboarding, shop theme selection, and vault trial status.

ALTER TABLE nex_account
ADD COLUMN IF NOT EXISTS onboarding_step text DEFAULT 'chat_theme',
ADD COLUMN IF NOT EXISTS shop_theme_id text,
ADD COLUMN IF NOT EXISTS vault_trial_used_at timestamptz;

COMMENT ON COLUMN nex_account.onboarding_step IS 'Tracks onboarding progress: chat_theme -> shop_theme -> completed';
COMMENT ON COLUMN nex_account.shop_theme_id IS 'Stores the ID of the selected shop theme';
COMMENT ON COLUMN nex_account.vault_trial_used_at IS 'Timestamp when the 7-day Vault trial was first activated';
