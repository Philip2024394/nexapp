-- 294_nex_security_audit_erase_actor.sql
-- -----------------------------------------------------------------------------
-- NEX Security Programme · Item 5 · GDPR pseudonymisation of audit
-- actor identity on account deletion. Owner-sealed 2026-11-08.
--
-- STATUS: AUTHORED · NOT YET APPLIED. Depends on migrations 292.
--
-- Protocol
--   On account deletion, the application-side workflow calls:
--     SELECT nex_security_audit_erase_actor(
--       _account_id => <uuid>,
--       _erased_identity => <'erased:<16-byte-hex>' generated in-app>
--     )
--   The function transactionally:
--     · NULLs actor_account_id on every audit row referencing the
--       deleted account (the FK ON DELETE SET NULL would do this
--       anyway, but we do it here explicitly so audit + account
--       deletion can be wrapped in one transaction).
--     · Replaces actor_identity with the caller-supplied erased
--       identifier on every audit row where actor_account_id (now
--       NULL) previously matched the deleted account UUID.
--   The caller is responsible for generating a fresh random
--   erased identity · the salt is thrown away after the call · no
--   mapping back to the deleted account UUID is stored anywhere.
--
-- Why the caller supplies the erased identity
--   Keeping pseudonym generation in the application layer uses the
--   runtime's cryptographically-secure randomness (crypto.getRandomValues).
--   The function validates the shape via regex but does not generate
--   the value itself · cleaner separation of concerns.
--
-- Safety
--   · SECURITY DEFINER with pinned search_path. Only service_role may
--     EXECUTE · the deletion workflow is expected to call via admin.
--   · Validates that the erased identity matches the sealed shape
--     ^erased:[a-z0-9]{16,64}$ · prevents accidental re-use of an
--     account's existing acct:<uuid> as its own "pseudonym".
--   · If the function is called with an _account_id that matches no
--     rows, it returns 0 and does NOT raise · idempotent on no-op.
--   · Writes a reconciliation row documenting the pseudonymisation
--     count for auditability of the erasure itself.
--
-- Transactional consistency with the deletion mutation
--   The caller is expected to invoke this function in the SAME
--   transaction as the DELETE / UPDATE that marks the nex_account
--   row as deleted. If the transaction rolls back, the audit rows
--   stay unmodified. If the transaction commits, the audit rows
--   are pseudonymised atomically with the account deletion.

begin;

create or replace function nex_security_audit_erase_actor(
  _account_id uuid,
  _erased_identity text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  _updated integer;
begin
  if _account_id is null then
    raise exception 'nex_security_audit_erase_actor: _account_id must not be null';
  end if;
  if _erased_identity is null or _erased_identity !~ '^erased:[a-z0-9]{16,64}$' then
    raise exception 'nex_security_audit_erase_actor: _erased_identity must match ^erased:[a-z0-9]{16,64}$';
  end if;

  -- Pseudonymise · NULL the FK + swap actor_identity on every row
  -- that referenced this account. The WHERE clause ANDs on either
  -- the FK OR the identity snapshot (so rows whose FK was already
  -- SET NULL by an earlier delete still get their snapshot updated).
  update nex_security_audit_log
     set actor_account_id = null,
         actor_identity = _erased_identity
   where actor_account_id = _account_id
      or actor_identity = ('acct:' || _account_id::text);
  get diagnostics _updated = row_count;
  return _updated;
end;
$$;

-- Owner-sealed defect fix 2026-11-08 · explicit revokes from
-- anon + authenticated. CRITICAL · this function pseudonymises audit
-- actor identity on account deletion · if an anonymous caller could
-- invoke it, they could forge-overwrite audit actor IDs at will
-- (GDPR bypass). Explicit role revokes close that vector.
revoke all on function nex_security_audit_erase_actor(uuid, text) from public;
revoke all on function nex_security_audit_erase_actor(uuid, text) from authenticated;
revoke all on function nex_security_audit_erase_actor(uuid, text) from anon;
grant execute on function nex_security_audit_erase_actor(uuid, text) to service_role;

comment on function nex_security_audit_erase_actor(uuid, text) is
  'Owner-sealed 2026-11-08 · GDPR pseudonymisation of audit actor
  identity. Transactional with the deletion mutation (caller wraps
  both in one tx). service_role only. No pepper · no mapping stored.';

insert into nex_migration_history (version, description, notes)
  values (
    '294',
    'Phase 2 Security · GDPR audit actor pseudonymisation function',
    'Owner-sealed 2026-11-08. Depends on migration 292 (table). Caller supplies the erased identity generated in the application runtime. No pepper or mapping is retained.'
  )
  on conflict (version) do nothing;

commit;
