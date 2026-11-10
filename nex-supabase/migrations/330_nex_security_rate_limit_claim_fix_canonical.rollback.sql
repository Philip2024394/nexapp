-- ============================================================================
-- Rollback · Migration 330 · reinstate the OLD _claim.sql function body
-- ============================================================================
-- Restores the 8-value hardcoded enum variant. hq_admin_grant will be
-- rejected again. Use only if a regression requires reverting.
-- The prune function is untouched (it was never changed).
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(330000001);

CREATE OR REPLACE FUNCTION public.nex_security_rate_limit_claim(
  _key text,
  _action text,
  _window_minutes integer,
  _max_per_window integer
)
RETURNS TABLE (allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  _window_ms  bigint;
  _now_ms     bigint;
  _window_at  timestamptz;
  _next_at    timestamptz;
  _claimed    integer;
BEGIN
  IF _key IS NULL OR _action IS NULL OR _window_minutes IS NULL OR _max_per_window IS NULL THEN
    RETURN QUERY SELECT false, 1;
    RETURN;
  END IF;
  IF _window_minutes < 1 OR _max_per_window < 1 THEN
    RETURN QUERY SELECT false, 1;
    RETURN;
  END IF;
  IF _action NOT IN (
    'password_change',
    'session_revoke',
    'session_revoke_all',
    'chat_message',
    'account_create',
    'webauthn_assert',
    'webauthn_enroll',
    'visitor_bootstrap'
  ) THEN
    RETURN QUERY SELECT false, 1;
    RETURN;
  END IF;
  IF _key !~ '^(acct|ip):[a-z0-9-]{16,}$' THEN
    RETURN QUERY SELECT false, 1;
    RETURN;
  END IF;

  _window_ms := _window_minutes::bigint * 60000;
  _now_ms := (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
  _window_at := to_timestamp(((_now_ms / _window_ms) * _window_ms) / 1000.0);
  _next_at := _window_at + make_interval(mins => _window_minutes);

  INSERT INTO nex_security_rate_limit
    (key, action, window_started_at, count, updated_at)
  VALUES
    (_key, _action, _window_at, 1, now())
  ON CONFLICT (key, action, window_started_at) DO UPDATE SET
    count = nex_security_rate_limit.count + 1,
    updated_at = now()
  WHERE nex_security_rate_limit.count < _max_per_window
  RETURNING count INTO _claimed;

  IF _claimed IS NULL THEN
    RETURN QUERY
      SELECT false,
             greatest(1, ceil(extract(epoch from (_next_at - now())))::integer);
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 0;
END;
$$;

DELETE FROM nex_migration_history WHERE version = '330';

COMMIT;
