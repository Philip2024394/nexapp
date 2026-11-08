-- 296_nex_account_deletion.sql
-- -----------------------------------------------------------------------------
-- NEX Account Deletion workflow · owner-authorised 2026-11-08.
-- STATUS · AUTHORED · NOT YET APPLIED.
--
-- Adds soft-delete columns to nex_account + a SECURITY DEFINER function
-- that performs the account-row scrubbing in one atomic statement.
-- The application-side deletion workflow (account-deletion-service.ts)
-- wraps this with the audit split (attempted/completed), the WebAuthn
-- credential deletion, mass session invalidation, audit actor
-- pseudonymisation (migration 294), and the Supabase Auth user
-- deletion. The SQL function is intentionally narrow · it only touches
-- nex_account.
--
-- Doctrine
--   · Soft delete · deleted_at + deletion_reason. The row is retained
--     so FKs to other rows (nex_message, nex_order, nex_business, etc.)
--     do not cascade-break historical records · but the identity is
--     scrubbed.
--   · display_name is cleared to "Deleted account" (NOT NULL
--     constraint prevents null · placeholder value matches the
--     industry convention).
--   · nex_handle is nulled · the user's public identifier is removed.
--   · supabase_user_id is nulled after the Auth user deletion in the
--     application layer · the SECURITY DEFINER does NOT delete the
--     Auth row (that is a Supabase Auth admin API call · stays in
--     application code with clear audit coverage).
--   · Function is service_role only · never callable by anon or
--     authenticated · same discipline as migrations 291-294.

begin;

alter table nex_account
  add column if not exists deleted_at timestamptz null,
  add column if not exists deletion_reason text null;

create index if not exists idx_nex_account_deleted_at
  on nex_account (deleted_at)
  where deleted_at is not null;

comment on column nex_account.deleted_at is
  'Owner-sealed 2026-11-08 · NULL for active accounts · set to now()
  by nex_account_mark_deleted during the deletion workflow. Soft-delete
  flag · the row is retained so historical FKs stay intact.';
comment on column nex_account.deletion_reason is
  'Owner-sealed 2026-11-08 · optional free-form reason supplied by the
  account owner · capped at 256 chars by the application layer.';

-- Soft-delete the account row. Idempotent · running twice on the same
-- id is a no-op after the first succeeds. Returns the previous
-- display_name so the caller can emit audit metadata (not PII beyond
-- what was already logged previously).
create or replace function nex_account_mark_deleted(
  _account_id uuid,
  _reason text default null
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
    raise exception 'nex_account_mark_deleted: _account_id must not be null';
  end if;
  update nex_account
     set deleted_at = coalesce(deleted_at, now()),
         deletion_reason = coalesce(deletion_reason, left(_reason, 256)),
         display_name = 'Deleted account',
         nex_handle = null
   where id = _account_id
     and deleted_at is null;
  get diagnostics _updated = row_count;
  return _updated > 0;
end;
$$;

-- Owner-sealed role scoping · identical pattern to 290-294.
revoke all on function nex_account_mark_deleted(uuid, text) from public;
revoke all on function nex_account_mark_deleted(uuid, text) from authenticated;
revoke all on function nex_account_mark_deleted(uuid, text) from anon;
grant execute on function nex_account_mark_deleted(uuid, text) to service_role;

comment on function nex_account_mark_deleted(uuid, text) is
  'Owner-sealed 2026-11-08 · soft-delete a nex_account row (deleted_at
  + scrub identity). Idempotent. service_role only.';

insert into nex_migration_history (version, description, notes)
  values (
    '296',
    'Account deletion · soft-delete columns + nex_account_mark_deleted SECURITY DEFINER',
    'Owner-sealed 2026-11-08. Pairs with migrations 292 (audit log) and 294 (actor pseudonymisation). Application workflow in account-deletion-service.ts calls this plus eraseActorIdentityInAudit plus the Supabase Auth admin delete. Idempotent soft-delete.'
  )
  on conflict (version) do nothing;

commit;
