-- 293_nex_security_audit_reconcile.sql
-- -----------------------------------------------------------------------------
-- NEX Security Programme · Item 5 · reconciliation function for
-- attempted audit events that never got a matching completed/failed
-- row. Owner-sealed 2026-11-08.
--
-- STATUS: AUTHORED · NOT YET APPLIED. Depends on migration 292.
--
-- Protocol
--   For every row in nex_security_audit_log where:
--     · outcome = 'attempted'
--     · occurred_at < now() - reconciliation_window
--     · no matching completed|failed row exists for the same (actor,
--       event-prefix) within reconciliation_window after attempted
--     · no row in nex_security_audit_reconciliation yet
--   INSERT a reconciliation row with decision = 'unresolved'.
--
-- Idempotent · the UNIQUE(attempted_log_id) constraint on
-- nex_security_audit_reconciliation prevents duplicate rows if the
-- function runs multiple times. Repeat invocations are no-ops for
-- rows already reconciled.
--
-- Not a retry · once unresolved is recorded, it stays unresolved until
-- an authorised HQ operator transitions it to manually_resolved or
-- matched_late via a separate workflow. The reconciler does NOT
-- retroactively update rows when a very-late completion arrives.
--
-- Event-prefix matching · "security.password_change.attempted" pairs
-- with "security.password_change.completed" or ".failed" · the writer
-- uses the stable prefix `security.<namespace>.<action>` so the
-- reconciler strips the suffix and matches on the prefix.

begin;

-- Reconciliation window · default 5 minutes. Hardcoded at the function
-- boundary · tuning requires a schema migration or a config table
-- (not shipped here · follow-on work).
create or replace function nex_security_audit_reconcile_unmatched(
  _reconciliation_window_seconds integer default 300
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  _window interval;
  _inserted integer;
begin
  if _reconciliation_window_seconds < 60 or _reconciliation_window_seconds > 3600 then
    raise exception 'nex_security_audit_reconcile_unmatched: window must be [60, 3600] seconds';
  end if;
  _window := make_interval(secs => _reconciliation_window_seconds);

  with candidates as (
    select
      att.id              as attempted_log_id,
      att.event           as attempted_event,
      att.actor_account_id,
      att.actor_identity,
      att.occurred_at,
      -- Strip the trailing ".attempted" to get the event prefix.
      regexp_replace(att.event, '\.attempted$', '') as event_prefix
    from nex_security_audit_log att
    where att.outcome = 'attempted'
      and att.occurred_at < now() - _window
      -- Only rows not yet reconciled.
      and not exists (
        select 1 from nex_security_audit_reconciliation rec
        where rec.attempted_log_id = att.id
      )
  ),
  unmatched as (
    select c.*
    from candidates c
    where not exists (
      select 1 from nex_security_audit_log m
      where m.outcome in ('completed', 'failed')
        -- Same actor (or both null) + same event-prefix + within window
        and (
          (c.actor_account_id is null and m.actor_account_id is null)
          or c.actor_account_id = m.actor_account_id
        )
        and m.event like c.event_prefix || '.%'
        and m.occurred_at between c.occurred_at and c.occurred_at + _window
    )
  )
  insert into nex_security_audit_reconciliation
    (attempted_log_id, decision, notes)
  select
    attempted_log_id,
    'unresolved',
    'auto-detected · no matching completed/failed within window'
  from unmatched
  on conflict (attempted_log_id) do nothing;

  get diagnostics _inserted = row_count;
  return _inserted;
end;
$$;

-- Owner-sealed defect fix 2026-11-08 · explicit revokes from
-- anon + authenticated (Supabase auto-grants EXECUTE).
revoke all on function nex_security_audit_reconcile_unmatched(integer) from public;
revoke all on function nex_security_audit_reconcile_unmatched(integer) from authenticated;
revoke all on function nex_security_audit_reconcile_unmatched(integer) from anon;
grant execute on function nex_security_audit_reconcile_unmatched(integer) to service_role;

comment on function nex_security_audit_reconcile_unmatched(integer) is
  'Owner-sealed 2026-11-08 · reconcile attempted audit events older
  than the reconciliation window without a matching completed/failed
  row. Idempotent via UNIQUE(attempted_log_id). service_role only.';

-- Optional late-match helper · callable by HQ when a legitimate
-- very-late completion arrives. Transitions unresolved →
-- matched_late only · never reverses direction.
create or replace function nex_security_audit_reconcile_match_late(
  _attempted_log_id bigint,
  _completed_log_id bigint,
  _notes text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  _updated integer;
begin
  update nex_security_audit_reconciliation
     set decision = 'matched_late',
         notes = coalesce(_notes, 'HQ-authorised late match for log ' || _completed_log_id::text)
   where attempted_log_id = _attempted_log_id
     and decision = 'unresolved';
  get diagnostics _updated = row_count;
  return _updated > 0;
end;
$$;

revoke all on function nex_security_audit_reconcile_match_late(bigint, bigint, text) from public;
revoke all on function nex_security_audit_reconcile_match_late(bigint, bigint, text) from authenticated;
revoke all on function nex_security_audit_reconcile_match_late(bigint, bigint, text) from anon;
grant execute on function nex_security_audit_reconcile_match_late(bigint, bigint, text) to service_role;

insert into nex_migration_history (version, description, notes)
  values (
    '293',
    'Phase 2 Security · audit reconciliation functions',
    'Owner-sealed 2026-11-08. Idempotent unresolved-detection + HQ-authorised late-match transition. Depends on migration 292.'
  )
  on conflict (version) do nothing;

commit;
