-- ============================================================================
-- APPLY-VERSION ROLLBACK PREVIEW · candidate migration 354 · Lane E · E-ATOM
-- UNAPPLIED · REVIEW REQUIRED · DO NOT APPLY WITHOUT SEPARATE AUTHORISATION
-- ============================================================================
--
-- Rollback for the apply-version PREVIEW of migration 354
-- (`354_nex_cart_order_create_transactional_PREVIEW.sql`).
--
-- Still quarantined · still under `nex-supabase/candidate-migrations/`.
-- Will only be moved to `nex-supabase/migrations/` as part of the same
-- authorisation that promotes the forward migration.
--
-- Scope:
--   · DROP the function + its GRANT (REVOKE is implicit on DROP).
--   · DELETE the `nex_migration_history` row the forward migration
--     INSERTed (idempotent · WHERE migration_number = 354).
--
-- Deliberate non-actions:
--   · Does NOT touch `nex_peer_message`, `nex_peer_conversation`,
--     `nex_order`, `nex_order_event`, or `nex_product` · those tables
--     pre-date this migration and are NOT created by the forward
--     migration. Dropping them would be destructive and out of scope.
--   · Does NOT remove any grants on the base tables · the forward
--     migration did not add any.
--   · Does NOT re-point production callers off the RPC · the
--     TypeScript wrapper is still unactivated behind a feature flag;
--     a rollback here is safe because no production code path imports
--     the wrapper yet.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS nex_create_cart_order_tx(
  UUID, UUID, UUID, TEXT, JSONB, TEXT, UUID, UUID, TEXT, TEXT
);

DELETE FROM nex_migration_history
 WHERE version = '354';

COMMIT;
