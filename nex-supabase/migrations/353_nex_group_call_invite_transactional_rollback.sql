-- ============================================================================
-- APPLY-VERSION ROLLBACK PREVIEW · candidate migration 353
-- UNAPPLIED · REVIEW REQUIRED · DO NOT APPLY WITHOUT SEPARATE AUTHORISATION
-- ============================================================================
--
-- Rollback for the apply-version PREVIEW of migration 353
-- (`353_nex_group_call_invite_transactional_PREVIEW.sql`).
--
-- Still quarantined · still under `nex-supabase/candidate-migrations/`.
-- Will only be moved to `nex-supabase/migrations/` as part of the same
-- authorisation that promotes the forward migration.
--
-- Scope:
--   · DROP the function + its GRANT (REVOKE is implicit on DROP).
--   · DELETE the `nex_migration_history` row the forward migration
--     INSERTed (idempotent · WHERE migration_number = 353).
--
-- Deliberate non-actions:
--   · Does NOT touch `nex_group_call_session`,
--     `nex_group_call_participant`, `nex_peer_conversation`, or
--     `nex_peer_message` · those tables pre-date this migration and
--     are NOT created by the forward migration. Dropping them would
--     be destructive and out of scope.
--   · Does NOT remove any grants on the base tables · the forward
--     migration did not add any.
--   · Does NOT attempt to re-point production callers off the RPC ·
--     the TypeScript wrapper is still unactivated behind a feature
--     flag; a rollback here is safe because no production code path
--     imports the wrapper yet.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS nex_invite_to_call_tx(
  UUID, UUID, TEXT, TEXT, JSONB, TEXT, UUID
);

DELETE FROM nex_migration_history
 WHERE version = '353';

COMMIT;
