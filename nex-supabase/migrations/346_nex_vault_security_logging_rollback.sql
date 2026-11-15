-- Rollback for migration 346.
-- Drops the new tables + indexes, removes the added columns from
-- nex_vault_pin_attempt. Safe to run against any environment where
-- Phase 2 routes have not yet shipped (they will depend on these
-- tables).

DROP INDEX IF EXISTS public.idx_nex_vault_security_event_account_unread;
DROP INDEX IF EXISTS public.idx_nex_vault_security_event_account_occurred;
DROP TABLE IF EXISTS public.nex_vault_security_event;
DROP TABLE IF EXISTS public.nex_vault_pin_lockout;

ALTER TABLE public.nex_vault_pin_attempt
  DROP CONSTRAINT IF EXISTS nex_vault_pin_attempt_attempt_source_check;
ALTER TABLE public.nex_vault_pin_attempt
  DROP CONSTRAINT IF EXISTS nex_vault_pin_attempt_ip_country_check;
ALTER TABLE public.nex_vault_pin_attempt
  DROP CONSTRAINT IF EXISTS nex_vault_pin_attempt_user_agent_family_check;

ALTER TABLE public.nex_vault_pin_attempt
  DROP COLUMN IF EXISTS attempt_source,
  DROP COLUMN IF EXISTS user_agent_family,
  DROP COLUMN IF EXISTS ip_country,
  DROP COLUMN IF EXISTS ip_address;
