-- ============================================================================
-- NEX-native Migration 291 · atomic rate-limit claim RPC (DRAFT · not applied)
-- ============================================================================
-- Phase 1.1 Security · owner-authorised 2026-11-09 remediation after
-- independent audit. DRAFT · requires explicit "apply mig 291 sandbox"
-- + separate production authorisation per Constitution §4+§5.
--
-- Purpose · eliminates the sealed cold-bucket race documented at the
-- top of `src/lib/nex-native/security-rate-limit.ts`. The service
-- layer already calls `supabase.rpc("nex_security_rate_limit_claim",
-- {_key, _action, _window_minutes, _max_per_window})` and gracefully
-- falls back to the 2-phase read-then-upsert if the function is
-- missing (via error code 42883). This migration installs the
-- function so the atomic path activates automatically.
--
-- Contract · the service layer expects:
--   function signature  · nex_security_rate_limit_claim(
--                            _key text,
--                            _action text,
--                            _window_minutes integer,
--                            _max_per_window integer
--                          )
--   returns             · TABLE (
--                            allowed boolean,
--                            retry_after_seconds integer
--                          )
--   atomicity           · row-level FOR UPDATE prevents the cold-
--                         bucket race where two concurrent calls at a
--                         fresh window both pass
--   SECURITY DEFINER    · function runs as table owner · service_role
--                         is still the ONLY caller (RLS enforced on
--                         the base table · function EXECUTE grant
--                         scoped to service_role only)
--
-- Window-floor logic · matches mig 290's existing contract that the
-- service layer sets `window_started_at` by flooring NOW() to the
-- windowMinutes boundary. This function uses the same flooring so
-- behaviour is identical between RPC and 2-phase paths.
--
-- Prerequisite · migration 290 (table) + 313 (CHECK constraint widened
-- to 9 action values). Function depends on both.
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(291000001);

DO $pre$
BEGIN
  IF EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '291') THEN
    RAISE EXCEPTION 'Migration 291 already recorded in nex_migration_history.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '290') THEN
    RAISE EXCEPTION 'Prerequisite: migration 290 (nex_security_rate_limit table) must be applied first.';
  END IF;
END
$pre$;

-- ---------------------------------------------------------------------------
-- The atomic claim function.
-- ---------------------------------------------------------------------------
-- Semantics:
--   1. Compute window_started_at by flooring NOW() to the windowMinutes
--      boundary (matches service layer).
--   2. INSERT ... ON CONFLICT (key, action, window_started_at)
--      DO UPDATE SET count = count + 1 WHERE count < max_per_window.
--      This is a single atomic upsert · no race.
--   3. Compare the RETURNING count to max_per_window:
--        count ≤ max  → allowed = true  · retry_after = 0
--        count > max  → NOT POSSIBLE (WHERE in UPDATE prevents it)
--        no row returned (WHERE blocked the update) → allowed = false
--                                                    · retry_after =
--                                                      seconds until
--                                                      window ends
--   4. When the row's window has rolled, the INSERT lands at the new
--      (key, action, next window) key automatically because the PK
--      includes window_started_at.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.nex_security_rate_limit_claim(
  _key text,
  _action text,
  _window_minutes integer,
  _max_per_window integer
)
RETURNS TABLE (allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_window_started_at timestamptz;
  v_window_ends_at    timestamptz;
  v_new_count         integer;
  v_now               timestamptz := clock_timestamp();
BEGIN
  -- Input validation · belt-and-braces against the CHECK constraints
  -- on the base table. Fail-safe (return allowed=false) rather than
  -- raising, since this is a hot path invoked many times per second.
  IF _key IS NULL OR _action IS NULL OR _window_minutes IS NULL OR _max_per_window IS NULL THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;
  IF _window_minutes < 1 OR _window_minutes > 1440 THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;
  IF _max_per_window < 1 THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  -- Floor NOW() to the window boundary · matches service-layer
  -- behaviour. date_trunc('minute') + (floor(minute/_w) * _w) gives
  -- the start of the current window.
  v_window_started_at := date_trunc('minute', v_now)
    - make_interval(mins := MOD(EXTRACT(MINUTE FROM v_now)::integer, _window_minutes));
  v_window_ends_at := v_window_started_at + make_interval(mins := _window_minutes);

  -- Atomic upsert. If a row for this (key, action, window) exists and
  -- count < max, we increment. If count >= max, the WHERE blocks the
  -- UPDATE and nothing lands in v_new_count.
  INSERT INTO nex_security_rate_limit AS t (
    key, action, window_started_at, count, updated_at
  )
  VALUES (_key, _action, v_window_started_at, 1, v_now)
  ON CONFLICT (key, action, window_started_at)
    DO UPDATE SET
      count      = t.count + 1,
      updated_at = v_now
    WHERE t.count < _max_per_window
  RETURNING t.count INTO v_new_count;

  IF v_new_count IS NOT NULL THEN
    -- Insert OR increment succeeded · allowed.
    RETURN QUERY SELECT true, 0;
    RETURN;
  END IF;

  -- WHERE blocked the update · we're over the limit for this window.
  -- Compute retry_after as the number of whole seconds until the
  -- window ends. Clamp to >= 1 so clients always see a positive
  -- Retry-After header.
  RETURN QUERY
    SELECT false,
           GREATEST(
             1,
             CEIL(EXTRACT(EPOCH FROM (v_window_ends_at - v_now)))::integer
           );
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.nex_security_rate_limit_claim IS
  'Phase 1.1 Security · atomic rate-limit claim (owner-sealed 2026-11-09).
   Eliminates the cold-bucket race in the 2-phase read-then-upsert
   fallback. Service layer at src/lib/nex-native/security-rate-limit.ts
   calls this RPC first and falls back to 2-phase if function missing
   (42883). SECURITY DEFINER · search_path pinned to public,pg_temp.';

-- Scope EXECUTE to service_role only. Supabase auto-grants EXECUTE to
-- public on SECURITY DEFINER functions · we revoke that defence-in-
-- depth to mirror the sealed table RLS posture.
REVOKE EXECUTE ON FUNCTION public.nex_security_rate_limit_claim(text, text, integer, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.nex_security_rate_limit_claim(text, text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.nex_security_rate_limit_claim(text, text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.nex_security_rate_limit_claim(text, text, integer, integer) TO service_role;

INSERT INTO nex_migration_history (version, applied_at, description, notes)
VALUES (
  '291',
  NOW(),
  'nex_security_rate_limit_claim atomic RPC · Phase 1.1 Security',
  'Eliminates cold-bucket race in 2-phase read-then-upsert path per sealed security-rate-limit.ts doctrine. SECURITY DEFINER with pinned search_path. EXECUTE grant service_role only. Service layer detects and uses this RPC automatically · falls back to 2-phase if missing (42883).'
);

COMMIT;
