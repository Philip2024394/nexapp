-- 299_nex_account_finalize_deletion.sql
-- -----------------------------------------------------------------------------
-- NEX Account Deletion recovery · HQ-operator SECURITY DEFINER to
-- finalize a soft-deleted account by clearing supabase_user_id after
-- a successful Supabase Auth delete.
-- Owner-authorised 2026-11-08.
-- STATUS · AUTHORED · NOT YET APPLIED.
--
-- Scenario
--   The sealed deleteOwnAccount workflow (service module) runs 6
--   steps:
--     1 · attempted audit (fail-loud)
--     2 · mass session invalidation
--     3 · nex_account_mark_deleted (soft-delete · migration 296)
--     4 · eraseActorIdentityInAudit (pseudonymise · migration 294)
--     5 · auth.admin.deleteUser (external call)
--     6 · completed audit (fail-loud)
--
--   If step 5 fails with a non-"user not found" error, the account
--   is left in a half-state:
--     · nex_account.deleted_at IS NOT NULL     (soft-delete done)
--     · nex_account.display_name = 'Deleted account' (scrubbed)
--     · nex_account.nex_handle IS NULL          (scrubbed)
--     · nex_account.supabase_user_id IS NOT NULL (Auth still active)
--
--   This function provides the "finalize" half of the recovery
--   workflow · called by the HQ-only retry server action AFTER a
--   fresh retry of auth.admin.deleteUser succeeds. It clears the
--   supabase_user_id so the account is fully reconciled.
--
-- Safety invariants
--   · Only operates on rows where deleted_at IS NOT NULL. Never
--     touches a live account.
--   · Idempotent · running twice on the same id is a no-op (second
--     call sees supabase_user_id IS NULL and does nothing).
--   · Does NOT restore any identity data. Does NOT un-soft-delete.
--   · Does NOT call auth.admin.deleteUser · that stays in the
--     application layer so it emits the audit events.
--   · service_role EXECUTE only · HQ authorisation gate runs BEFORE
--     this is invoked.

begin;

create or replace function nex_account_finalize_deletion(
  _account_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  _updated integer;
begin
  if _account_id is null then
    raise exception 'nex_account_finalize_deletion: _account_id required';
  end if;
  update nex_account
     set supabase_user_id = null
   where id = _account_id
     and deleted_at is not null
     and supabase_user_id is not null;
  get diagnostics _updated = row_count;
  return _updated > 0;
end;
$$;

revoke all on function nex_account_finalize_deletion(uuid) from public;
revoke all on function nex_account_finalize_deletion(uuid) from authenticated;
revoke all on function nex_account_finalize_deletion(uuid) from anon;
grant execute on function nex_account_finalize_deletion(uuid) to service_role;

comment on function nex_account_finalize_deletion(uuid) is
  'Owner-sealed 2026-11-08 · HQ-only · nulls supabase_user_id on a
  soft-deleted nex_account after auth deletion succeeds. Idempotent ·
  deleted_at guard prevents operating on live accounts.';

insert into nex_migration_history (version, description, notes)
  values (
    '299',
    'Account deletion recovery · nex_account_finalize_deletion SECURITY DEFINER',
    'Owner-sealed 2026-11-08. HQ-only · pairs with the retry workflow in account-deletion-recovery-service.ts. Does NOT call auth.admin.deleteUser (kept in app layer for audit event emission).'
  )
  on conflict (version) do nothing;

commit;
