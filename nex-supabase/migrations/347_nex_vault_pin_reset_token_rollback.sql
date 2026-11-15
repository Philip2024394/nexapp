-- Rollback for migration 347.
DROP INDEX IF EXISTS public.idx_nex_vault_pin_reset_token_account_live;
DROP INDEX IF EXISTS public.uniq_nex_vault_pin_reset_token_live_hash;
DROP TABLE IF EXISTS public.nex_vault_pin_reset_token;
