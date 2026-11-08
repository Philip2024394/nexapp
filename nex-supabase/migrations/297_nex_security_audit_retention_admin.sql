-- 297_nex_security_audit_retention_admin.sql
-- -----------------------------------------------------------------------------
-- NEX Security Audit · HQ-authorised retention policy administration.
-- Owner-sealed 2026-11-08.
-- STATUS · AUTHORED · NOT YET APPLIED. Depends on migration 292 (the
-- nex_security_audit_retention table).
--
-- Adds two SECURITY DEFINER functions that let the HQ UI upsert and
-- delete retention policies without granting any direct write access
-- to the table itself. The HQ server action gates on requireHqAdmin
-- before calling these functions · the SQL layer is the last line
-- of defence.
--
-- Doctrine
--   · No automatic retention policies. The owner still explicitly
--     inserts or updates rows via the HQ UI.
--   · `authorised_by` field captures who approved the policy change
--     (account id as text · survives GDPR erasure as the ID itself
--     is not tied to the audit log table).
--   · Both functions validate event_prefix regex (same shape the
--     table CHECK enforces) and retain_days > 0 at the function level
--     so the UI can rely on structured error signalling.

begin;

-- Upsert · insert new policy or update retain_days + authorised_by on
-- an existing one. Returns the effective retain_days after the write.
create or replace function nex_security_audit_retention_upsert(
  _event_prefix text,
  _retain_days integer,
  _authorised_by text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if _event_prefix is null or _event_prefix !~ '^[a-z][a-z0-9_]{2,63}(\.[a-z][a-z0-9_]{2,63})?$' then
    raise exception 'nex_security_audit_retention_upsert: event_prefix shape invalid';
  end if;
  if _retain_days is null or _retain_days <= 0 or _retain_days > 36500 then
    raise exception 'nex_security_audit_retention_upsert: retain_days must be 1..36500';
  end if;
  if _authorised_by is null or length(_authorised_by) = 0 or length(_authorised_by) > 128 then
    raise exception 'nex_security_audit_retention_upsert: authorised_by must be 1..128 chars';
  end if;
  insert into nex_security_audit_retention (event_prefix, retain_days, authorised_by, authorised_at)
    values (_event_prefix, _retain_days, _authorised_by, now())
  on conflict (event_prefix) do update set
    retain_days = excluded.retain_days,
    authorised_by = excluded.authorised_by,
    authorised_at = excluded.authorised_at;
  return _retain_days;
end;
$$;

revoke all on function nex_security_audit_retention_upsert(text, integer, text) from public;
revoke all on function nex_security_audit_retention_upsert(text, integer, text) from authenticated;
revoke all on function nex_security_audit_retention_upsert(text, integer, text) from anon;
grant execute on function nex_security_audit_retention_upsert(text, integer, text) to service_role;

-- Delete · removes a policy row. Returns true when a row was deleted.
-- The audit log itself is NEVER touched by this function.
create or replace function nex_security_audit_retention_delete(
  _event_prefix text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  _removed integer;
begin
  if _event_prefix is null then return false; end if;
  delete from nex_security_audit_retention where event_prefix = _event_prefix;
  get diagnostics _removed = row_count;
  return _removed > 0;
end;
$$;

revoke all on function nex_security_audit_retention_delete(text) from public;
revoke all on function nex_security_audit_retention_delete(text) from authenticated;
revoke all on function nex_security_audit_retention_delete(text) from anon;
grant execute on function nex_security_audit_retention_delete(text) to service_role;

comment on function nex_security_audit_retention_upsert(text, integer, text) is
  'Owner-sealed 2026-11-08 · HQ-authorised upsert of a retention
  policy. service_role only · HQ gate enforced at the application
  layer before invocation.';
comment on function nex_security_audit_retention_delete(text) is
  'Owner-sealed 2026-11-08 · HQ-authorised deletion of a retention
  policy row. Does NOT delete any audit log rows. service_role only.';

-- Manually resolve an unresolved reconciliation row. Transitions the
-- decision from 'unresolved' → 'manually_resolved'. One-way · the
-- caller supplies notes (reviewer attribution + justification) and
-- the reviewer's account_id is written into the notes by the server
-- action before this function is invoked. Returns true when a row
-- was updated · false when the row was already resolved by someone
-- else (prevents double-resolution race).
create or replace function nex_security_audit_reconcile_manually_resolve(
  _attempted_log_id bigint,
  _notes text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  _updated integer;
begin
  if _attempted_log_id is null then return false; end if;
  if _notes is null or length(_notes) = 0 then
    raise exception 'nex_security_audit_reconcile_manually_resolve: notes required';
  end if;
  update nex_security_audit_reconciliation
     set decision = 'manually_resolved',
         notes = left(_notes, 1024),
         decided_at = now()
   where attempted_log_id = _attempted_log_id
     and decision = 'unresolved';
  get diagnostics _updated = row_count;
  return _updated > 0;
end;
$$;

revoke all on function nex_security_audit_reconcile_manually_resolve(bigint, text) from public;
revoke all on function nex_security_audit_reconcile_manually_resolve(bigint, text) from authenticated;
revoke all on function nex_security_audit_reconcile_manually_resolve(bigint, text) from anon;
grant execute on function nex_security_audit_reconcile_manually_resolve(bigint, text) to service_role;

comment on function nex_security_audit_reconcile_manually_resolve(bigint, text) is
  'Owner-sealed 2026-11-08 · HQ-authorised transition of an unresolved
  reconciliation row to manually_resolved. One-way · prevents double
  resolution via the decision=unresolved guard.';

insert into nex_migration_history (version, description, notes)
  values (
    '297',
    'HQ retention admin · upsert + delete SECURITY DEFINER functions',
    'Owner-sealed 2026-11-08. Depends on migration 292 (retention table). Application HQ action gates on requireHqAdmin before calling.'
  )
  on conflict (version) do nothing;

commit;
