-- ============================================================================
-- NEX-native Migration 232 · nex_watch_listing_rate_limit
-- R5 remediation 2026-10-26 · DB-backed account-scoped rate limit · NOT APPLIED
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Must not be applied to the sealed production project
-- `ijvqdvsvwtwxzcqmoqit` without explicit owner approval.
--
-- Purpose (owner directive R5 · 2026-10-26)
-- ----------------------------------------------------------------------------
-- The in-memory rate limiter at
-- `src/lib/nex-native/business-trial/rate-limit.ts` is explicitly
-- flagged as per-process · "multi-process rate limiting requires a
-- shared store." For the public `createWatchListingAction` surface,
-- the owner directive requires cross-instance correctness.
--
-- This migration introduces:
--   · nex_watch_listing_rate_limit · one row per (account, action,
--     window_start) · UNIQUE on that trio so the INSERT ... ON CONFLICT
--     upsert in the companion plpgsql function is atomic.
--   · nex_watch_listing_increment_rate_limit(account, action,
--     window_start) · SECURITY DEFINER plpgsql function that performs
--     the atomic increment and returns the new count.
--
-- The service layer at
-- `src/lib/nex-native/watches/watch-listing-rate-limit-service.ts`
-- calls the RPC via supabase.rpc() so the atomic path lives entirely
-- inside Postgres · no two-step read-then-write race in app code.
--
-- Dependencies
-- ----------------------------------------------------------------------------
--   PREREQUISITE:
--     001 · nex_account
--     217 · search_path hardening pattern (helpers)
--
-- Rollback
-- ----------------------------------------------------------------------------
--   BEGIN;
--     DROP FUNCTION IF EXISTS nex_watch_listing_increment_rate_limit;
--     DROP TABLE IF EXISTS nex_watch_listing_rate_limit CASCADE;
--     DELETE FROM nex_migration_history WHERE version = '232';
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_watch_listing_rate_limit (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid        NOT NULL
    REFERENCES nex_account(id) ON DELETE CASCADE,
  action         text        NOT NULL,
  window_start   timestamptz NOT NULL,
  count          integer     NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT nex_watch_listing_rate_limit_count_nonneg
    CHECK (count >= 0),
  CONSTRAINT nex_watch_listing_rate_limit_action_values
    CHECK (action IN ('create_draft'))
);

COMMENT ON TABLE nex_watch_listing_rate_limit IS
  'R5 remediation 2026-10-26 · DB-backed per-account rate limit counters. One row per (account, action, floored window). UPSERT via nex_watch_listing_increment_rate_limit() keeps increments atomic cross-instance.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_nex_watch_listing_rate_limit_bucket
  ON nex_watch_listing_rate_limit (account_id, action, window_start);

-- Cleanup helper · "which old buckets can be deleted"
CREATE INDEX IF NOT EXISTS idx_nex_watch_listing_rate_limit_window_start
  ON nex_watch_listing_rate_limit (window_start);

-- ----------------------------------------------------------------------------
-- Atomic increment function (SECURITY DEFINER · search_path hardened)
-- ----------------------------------------------------------------------------
--
-- Returns the new count after increment. Caller compares to the limit
-- in the app layer. Using SECURITY DEFINER so the function can bypass
-- RLS when called via nexSupabaseAdmin.rpc() · the UNIQUE constraint
-- on (account_id, action, window_start) makes the upsert atomic.
--
-- search_path is pinned to `public, pg_temp` per the sealed hardening
-- pattern (migration 217) to prevent search_path hijack.

CREATE OR REPLACE FUNCTION nex_watch_listing_increment_rate_limit(
  p_account_id uuid,
  p_action text,
  p_window_start timestamptz
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO nex_watch_listing_rate_limit (account_id, action, window_start, count, updated_at)
  VALUES (p_account_id, p_action, p_window_start, 1, now())
  ON CONFLICT (account_id, action, window_start)
  DO UPDATE SET
    count = nex_watch_listing_rate_limit.count + 1,
    updated_at = now()
  RETURNING count INTO v_count;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION nex_watch_listing_increment_rate_limit IS
  'R5 remediation 2026-10-26 · atomic rate-limit increment · returns new count. SECURITY DEFINER · search_path hardened per migration 217 pattern.';

-- Grant EXECUTE to the service role only. authenticated role never
-- calls this function directly · they call the server action which
-- calls nexSupabaseAdmin.rpc() (service role) internally.
REVOKE EXECUTE ON FUNCTION nex_watch_listing_increment_rate_limit FROM public;
REVOKE EXECUTE ON FUNCTION nex_watch_listing_increment_rate_limit FROM anon;
REVOKE EXECUTE ON FUNCTION nex_watch_listing_increment_rate_limit FROM authenticated;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

ALTER TABLE nex_watch_listing_rate_limit ENABLE ROW LEVEL SECURITY;

-- No authenticated SELECT / INSERT / UPDATE / DELETE policies.
-- All interactions happen via the service role through the RPC above.

COMMIT;
