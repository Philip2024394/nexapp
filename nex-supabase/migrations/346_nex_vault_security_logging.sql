-- Migration 346 · NEX Vault security logging + lockout + drawer feed.
-- -----------------------------------------------------------------------------
-- Owner-authorised 2026-11-15 as Phase 1 of the "world-class" Vault
-- escrow/notification/lockout system. Schema only. Sandbox apply only
-- (production sealed `ijvqdvsvwtwxzcqmoqit`).
--
-- Three concerns:
--   1. Extend nex_vault_pin_attempt with network context (ip, country,
--      user-agent family, attempt source) so each failed attempt can
--      surface to the owner with "best detail we can give".
--   2. Per-account lockout counter. Enforces the 3-strike rule server-
--      side so a leaked session cannot brute-force the PIN by iterating
--      across devices.
--   3. Security-events feed for the side drawer. One row per notable
--      security event (failed PIN, successful PIN from a new device,
--      lockout triggered, PIN reset requested/completed, device
--      approved/revoked). Unread flag so the drawer can badge a count.
--
-- RLS: left disabled on these tables intentionally. All writes go
-- through server routes using the service-role client (matches the
-- pre-existing pattern on nex_vault_pin_attempt + nex_vault_recovery_
-- attempt). Phase 2 server routes enforce account_id scoping. If a
-- future phase authorises end-user direct-reads over anon key, RLS
-- policies should be added in a separate migration.

-- 1 · Extend nex_vault_pin_attempt --------------------------------------------
ALTER TABLE public.nex_vault_pin_attempt
  ADD COLUMN IF NOT EXISTS ip_address inet,
  ADD COLUMN IF NOT EXISTS ip_country text,
  ADD COLUMN IF NOT EXISTS user_agent_family text,
  ADD COLUMN IF NOT EXISTS attempt_source text;

ALTER TABLE public.nex_vault_pin_attempt
  DROP CONSTRAINT IF EXISTS nex_vault_pin_attempt_attempt_source_check;
ALTER TABLE public.nex_vault_pin_attempt
  ADD CONSTRAINT nex_vault_pin_attempt_attempt_source_check
  CHECK (attempt_source IS NULL OR attempt_source IN ('device_pin', 'account_pin_escrow'));

ALTER TABLE public.nex_vault_pin_attempt
  DROP CONSTRAINT IF EXISTS nex_vault_pin_attempt_ip_country_check;
ALTER TABLE public.nex_vault_pin_attempt
  ADD CONSTRAINT nex_vault_pin_attempt_ip_country_check
  CHECK (ip_country IS NULL OR ip_country ~ '^[A-Z]{2}$');

ALTER TABLE public.nex_vault_pin_attempt
  DROP CONSTRAINT IF EXISTS nex_vault_pin_attempt_user_agent_family_check;
ALTER TABLE public.nex_vault_pin_attempt
  ADD CONSTRAINT nex_vault_pin_attempt_user_agent_family_check
  CHECK (
    user_agent_family IS NULL
    OR (length(user_agent_family) BETWEEN 1 AND 64)
  );

-- 2 · Per-account lockout counter ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.nex_vault_pin_lockout (
  account_id             uuid PRIMARY KEY REFERENCES public.nex_account(id) ON DELETE CASCADE,
  consecutive_failures   integer     NOT NULL DEFAULT 0,
  first_failure_at       timestamptz,
  last_failure_at        timestamptz,
  locked_at              timestamptz,
  reset_required         boolean     NOT NULL DEFAULT false,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nex_vault_pin_lockout
  DROP CONSTRAINT IF EXISTS nex_vault_pin_lockout_failures_nonneg;
ALTER TABLE public.nex_vault_pin_lockout
  ADD CONSTRAINT nex_vault_pin_lockout_failures_nonneg
  CHECK (consecutive_failures >= 0);

-- 3 · Security events feed -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nex_vault_security_event (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid        NOT NULL REFERENCES public.nex_account(id) ON DELETE CASCADE,
  event_type          text        NOT NULL,
  occurred_at         timestamptz NOT NULL DEFAULT now(),
  ip_address          inet,
  ip_country          text,
  user_agent_family   text,
  device_id           text,
  details             jsonb,
  read_at             timestamptz
);

ALTER TABLE public.nex_vault_security_event
  DROP CONSTRAINT IF EXISTS nex_vault_security_event_event_type_check;
ALTER TABLE public.nex_vault_security_event
  ADD CONSTRAINT nex_vault_security_event_event_type_check
  CHECK (event_type IN (
    'pin_attempt_failed',
    'pin_attempt_success_new_device',
    'lockout_triggered',
    'pin_reset_requested',
    'pin_reset_completed',
    'device_approved',
    'device_revoked'
  ));

ALTER TABLE public.nex_vault_security_event
  DROP CONSTRAINT IF EXISTS nex_vault_security_event_ip_country_check;
ALTER TABLE public.nex_vault_security_event
  ADD CONSTRAINT nex_vault_security_event_ip_country_check
  CHECK (ip_country IS NULL OR ip_country ~ '^[A-Z]{2}$');

CREATE INDEX IF NOT EXISTS idx_nex_vault_security_event_account_occurred
  ON public.nex_vault_security_event (account_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_vault_security_event_account_unread
  ON public.nex_vault_security_event (account_id, occurred_at DESC)
  WHERE read_at IS NULL;
