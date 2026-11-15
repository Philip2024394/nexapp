-- Migration 347 · NEX Vault PIN-reset tokens (Phase 2B).
-- -----------------------------------------------------------------------------
-- Owner-authorised 2026-11-15. Sandbox-only. Production sealed.
--
-- Backs the email reset-link flow that lifts the 3-strike lockout
-- (migration 346) without rotating the user's PIN. Flow:
--
--   1. User is locked out (reset_required = true in nex_vault_pin_lockout).
--   2. Signed-in but locked user POSTs /vault/escrow/reset-request.
--      Server inserts a row here · token_hash = SHA-256(random 32 bytes)
--      · ties the token to the specific `locked_at` timestamp so an old
--      token cannot unlock a later lockout cycle.
--      Server emails a URL carrying the plaintext token to the account's
--      verified email.
--   3. Owner clicks the link · POST /vault/escrow/reset-confirm with the
--      plaintext token. Server hashes, looks up row, checks:
--        · consumed_at IS NULL
--        · expires_at  > now()
--        · locked_at_at_issue matches the CURRENT lockout row's locked_at
--      If all pass: mark consumed_at, call clearLockoutAfterReset.
--
-- One-shot (consumed_at NOT NULL after use). 30-minute TTL. Multiple
-- outstanding tokens per account are allowed (owner retries), but ANY
-- consume invalidates the lockout state so subsequent tokens are moot.
--
-- RLS left disabled · writes/reads via service-role from the Phase 2B
-- routes only (same pattern as migration 346 tables).

CREATE TABLE IF NOT EXISTS public.nex_vault_pin_reset_token (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id           uuid         NOT NULL REFERENCES public.nex_account(id) ON DELETE CASCADE,
  token_hash           bytea        NOT NULL,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  expires_at           timestamptz  NOT NULL,
  consumed_at          timestamptz,
  consumed_ip_address  inet,
  consumed_ip_country  text,
  locked_at_at_issue   timestamptz  NOT NULL,
  issued_ip_address    inet,
  issued_ip_country    text
);

ALTER TABLE public.nex_vault_pin_reset_token
  DROP CONSTRAINT IF EXISTS nex_vault_pin_reset_token_hash_length;
ALTER TABLE public.nex_vault_pin_reset_token
  ADD CONSTRAINT nex_vault_pin_reset_token_hash_length
  CHECK (octet_length(token_hash) = 32);

ALTER TABLE public.nex_vault_pin_reset_token
  DROP CONSTRAINT IF EXISTS nex_vault_pin_reset_token_country_shape;
ALTER TABLE public.nex_vault_pin_reset_token
  ADD CONSTRAINT nex_vault_pin_reset_token_country_shape
  CHECK (
    (issued_ip_country   IS NULL OR issued_ip_country   ~ '^[A-Z]{2}$')
    AND
    (consumed_ip_country IS NULL OR consumed_ip_country ~ '^[A-Z]{2}$')
  );

-- Partial unique on token_hash while unconsumed · defends against hash
-- collisions if a second generate ever lands on the same random bytes
-- (astronomically unlikely but cheap to guard).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_nex_vault_pin_reset_token_live_hash
  ON public.nex_vault_pin_reset_token (token_hash)
  WHERE consumed_at IS NULL;

-- Fast lookup for "any live token for this account" + "live token by
-- hash for consume path".
CREATE INDEX IF NOT EXISTS idx_nex_vault_pin_reset_token_account_live
  ON public.nex_vault_pin_reset_token (account_id, created_at DESC)
  WHERE consumed_at IS NULL;
