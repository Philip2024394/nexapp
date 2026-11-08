-- 291_nex_security_rate_limit_claim.sql
-- -----------------------------------------------------------------------------
-- NEX Security Programme · Phase 0 · Item 4 · Review B · atomic
-- counter for nex_security_rate_limit. Owner-sealed 2026-11-08.
--
-- STATUS: AUTHORED · NOT YET APPLIED. Owner directive 2026-11-08
-- authorises preparation + review only. A separate explicit
-- application authorisation is required.
-- Depends on migration 290 being applied first.
--
-- Problem addressed
--   Migration 290 ships a counter table + application-layer service.
--   The service reads then writes · two concurrent requests at a
--   fresh (key, action, window) tuple can both see count=0, both
--   write count=1, and both pass even though only one slot was
--   available. Inherited from the sealed community limiter.
--
-- Solution
--   A single SECURITY DEFINER function performs the read-check-
--   increment as one atomic SQL statement via INSERT ... ON CONFLICT
--   DO UPDATE WHERE count < max. Postgres guarantees the WHERE clause
--   is evaluated under row lock, so concurrent callers serialise
--   around the same (key, action, window) tuple.
--
-- Surface
--   · Function: nex_security_rate_limit_claim(
--       _key text, _action text, _window_minutes integer,
--       _max_per_window integer
--     ) RETURNS TABLE (allowed boolean, retry_after_seconds integer)
--   · SECURITY DEFINER · search_path pinned to pg_catalog, public
--   · Validates the action against the enum (same list as the table's
--     ck_sec_rl_action constraint · fail-closed on unknown input).
--   · Validates the key shape against the same regex the table CHECK
--     uses.
--   · Validates _window_minutes >= 1 AND _max_per_window >= 1 so
--     clients cannot pass a "0 limit" and starve themselves.
--   · EXECUTE granted to service_role ONLY · never to anon or
--     authenticated. The application service layer is the sole caller.
--
-- Cleanup
--   Window rows accumulate as (key, action, floor-of-window) tuples.
--   For active users this is bounded: active_users * 7 actions * ~2
--   overlapping windows per rolling cycle. A nightly cron
--   (nex_security_rate_limit_prune) deletes rows where
--   window_started_at < now() - interval '48 hours'. 48h chosen so
--   the longest window (60min) is covered with margin · never prunes
--   a row that could still be read by the application layer.

begin;

-- Pruning helper. Safe to call from any cron with service_role · all
-- rows older than 48h are expired by the longest window (60min).
create or replace function nex_security_rate_limit_prune()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  _deleted integer;
begin
  delete from nex_security_rate_limit
   where window_started_at < now() - interval '48 hours';
  get diagnostics _deleted = row_count;
  return _deleted;
end;
$$;

-- Owner-sealed defect fix 2026-11-08 · explicit revokes from
-- anon + authenticated · Supabase auto-grants EXECUTE on new
-- functions to those roles · REVOKE FROM PUBLIC alone is not
-- sufficient to close them off.
revoke all on function nex_security_rate_limit_prune() from public;
revoke all on function nex_security_rate_limit_prune() from authenticated;
revoke all on function nex_security_rate_limit_prune() from anon;
grant execute on function nex_security_rate_limit_prune() to service_role;

-- Atomic check-and-increment. Returns (true, 0) when the call is
-- allowed and the counter has been advanced; (false, retry_after)
-- when the window is full · retry_after is the whole-second gap
-- to the next window boundary.
create or replace function nex_security_rate_limit_claim(
  _key text,
  _action text,
  _window_minutes integer,
  _max_per_window integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  _window_ms  bigint;
  _now_ms     bigint;
  _window_at  timestamptz;
  _next_at    timestamptz;
  _claimed    integer;
begin
  -- Argument validation · fail-closed on bad input (treat as denied
  -- so an injection attempt doesn't accidentally unblock the caller).
  if _key is null or _action is null
     or _window_minutes is null or _max_per_window is null then
    return query select false, 1;
    return;
  end if;
  if _window_minutes < 1 or _max_per_window < 1 then
    return query select false, 1;
    return;
  end if;
  if _action not in (
    'password_change',
    'session_revoke',
    'session_revoke_all',
    'chat_message',
    'account_create',
    'webauthn_assert',
    'webauthn_enroll',
    'visitor_bootstrap'
  ) then
    return query select false, 1;
    return;
  end if;
  if _key !~ '^(acct|ip):[a-z0-9-]{16,}$' then
    return query select false, 1;
    return;
  end if;

  _window_ms := _window_minutes::bigint * 60000;
  _now_ms := (extract(epoch from now()) * 1000)::bigint;
  _window_at := to_timestamp(((_now_ms / _window_ms) * _window_ms) / 1000.0);
  _next_at := _window_at + make_interval(mins => _window_minutes);

  -- Atomic read-check-increment. INSERT fires for the first call in
  -- a fresh window (count becomes 1). ON CONFLICT DO UPDATE fires
  -- for subsequent calls · the WHERE clause is evaluated under the
  -- conflicting row's lock, so two concurrent callers see each
  -- other's increments. When count has reached _max_per_window the
  -- WHERE evaluates to false and the UPDATE is skipped · no row
  -- returned · claim denied.
  insert into nex_security_rate_limit
    (key, action, window_started_at, count, updated_at)
  values
    (_key, _action, _window_at, 1, now())
  on conflict (key, action, window_started_at) do update set
    count = nex_security_rate_limit.count + 1,
    updated_at = now()
  where nex_security_rate_limit.count < _max_per_window
  returning count into _claimed;

  if _claimed is null then
    -- Denied · return the gap to the next window boundary.
    return query
      select false,
             greatest(1, ceil(extract(epoch from (_next_at - now())))::integer);
    return;
  end if;

  return query select true, 0;
end;
$$;

revoke all on function nex_security_rate_limit_claim(text, text, integer, integer)
  from public;
revoke all on function nex_security_rate_limit_claim(text, text, integer, integer)
  from authenticated;
revoke all on function nex_security_rate_limit_claim(text, text, integer, integer)
  from anon;
grant execute on function nex_security_rate_limit_claim(text, text, integer, integer)
  to service_role;

comment on function nex_security_rate_limit_claim(text, text, integer, integer) is
  'Owner-sealed 2026-11-08 · atomic counter for nex_security_rate_limit.
   Returns (allowed, retry_after_seconds). Service-role only. Validates
   action + key shape + bounds server-side · never trusts client input.
   Depends on the table defined in migration 290.';

insert into nex_migration_history (version, description, notes)
  values (
    '291',
    'Phase 0 Security · atomic nex_security_rate_limit_claim + prune',
    'Owner-sealed 2026-11-08. Eliminates the cold-bucket race in the application-layer limiter. Depends on migration 290 (table). Cron: SELECT nex_security_rate_limit_prune(); nightly.'
  )
  on conflict (version) do nothing;

commit;
