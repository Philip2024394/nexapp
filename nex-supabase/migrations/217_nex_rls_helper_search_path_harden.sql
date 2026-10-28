-- ============================================================================
-- NEX-native Migration 217 · RLS helper · search_path hardening
-- ============================================================================
--
-- STATUS: AUTHORED · NOT YET APPLIED TO ANY DATABASE.
--
-- Application to any Supabase project (including a dedicated non-production
-- sandbox) requires separate explicit authorisation. This migration must
-- NOT be applied to the sealed production project `ijvqdvsvwtwxzcqmoqit`
-- without explicit owner approval and a documented rollback drill.
--
-- Owner-authorised design review 2026-10-24. This migration is the
-- prerequisite to Migration 218 (nex_peer_message / nex_live_post RLS
-- repair). The two migrations should be applied in numeric order
-- (217 → 218) under the standard numeric-ascending Supabase migration
-- convention.
--
-- Purpose
-- ----------------------------------------------------------------------------
-- Pin `search_path` on the four SECURITY DEFINER helper functions
-- introduced by Migration 010. The helpers are used by current RLS
-- policies and will also be used by Migration 218.
--
--   nex_current_account_ids()
--   nex_current_owned_business_ids()
--   nex_current_participant_conversation_ids()
--   nex_conversations_of_my_businesses()
--
-- Without a pinned search_path, a SECURITY DEFINER function runs under
-- the invoker's effective search path. If the search path ever includes
-- a schema the invoker controls (or a shadow schema created by a role
-- with elevated privilege), the function could invoke a hijacked
-- `nex_account` / `nex_business` / `auth.uid()`. Pinning closes this
-- defence-in-depth gap. Other migrations in this repo already pin
-- search_path on their SECURITY DEFINER functions (011, 012, 013, 094,
-- 104, 105, 106) · this migration brings Migration 010 in line.
--
-- No behavioural change
-- ----------------------------------------------------------------------------
-- The function bodies reference only unqualified names: `nex_account`,
-- `nex_business`, `nex_conversation`, `nex_conversation_participant`,
-- plus `auth.uid()`. All are in `public` or `auth`, both of which are
-- part of the pinned search_path. The functions continue to return the
-- same SETOF uuid results under identical JWT inputs.
--
-- Scope
-- ----------------------------------------------------------------------------
-- `ALTER FUNCTION … SET search_path = pg_catalog, public` only. No
-- function body changes. No ownership change. No GRANT / REVOKE change.
-- No new objects. No RLS policy changes.
--
-- The `pg_catalog, public` value matches the pattern used in Migrations
-- 011/012/013 (which use `public, pg_temp`) and 094/104/105/106 (which
-- use `public`). This migration standardises on `pg_catalog, public` to
-- ensure built-in operators resolve before user schema in all cases.
-- `pg_catalog` is implicitly first in Postgres search resolution; adding
-- it explicitly is harmless and self-documenting.
--
-- Compatibility
-- ----------------------------------------------------------------------------
-- The helpers' only existing callers are the RLS policies defined in
-- Migration 010 (lines 103-141) which reference them via
-- `IN (SELECT nex_current_account_ids())` style. Those policies continue
-- to evaluate correctly after this migration · the function returns
-- the same results.
--
-- Rollback
-- ----------------------------------------------------------------------------
--   BEGIN;
--     ALTER FUNCTION nex_current_account_ids() RESET search_path;
--     ALTER FUNCTION nex_current_owned_business_ids() RESET search_path;
--     ALTER FUNCTION nex_current_participant_conversation_ids()
--       RESET search_path;
--     ALTER FUNCTION nex_conversations_of_my_businesses() RESET search_path;
--     DELETE FROM nex_migration_history WHERE version = '217';
--   COMMIT;
--
-- Rollback drops the search_path pin and returns each function to the
-- role's default search_path (its pre-217 behaviour). Zero data impact.
-- No downstream migrations assume this pin is in place at the SQL level ·
-- 218 adds its own trigger function with its own SET search_path clause.
--
-- Dependencies
-- ----------------------------------------------------------------------------
--   APPLIED (production assumption · must be verified in sandbox):
--     010_nex_rls_recursion_fix.sql  (defines the four helpers)
--
--   AWAITING APPLY (unapplied Slice 1C):
--     216_nex_discovery_signal_add_enquiry_cart_signals.sql
--
--   Blocks (should be applied before):
--     218_nex_rls_harden_peer_message_and_live_post.sql
--
-- Verification (manual · not executed)
-- ----------------------------------------------------------------------------
-- After applying, verify in sandbox:
--
--   SELECT proname, proconfig
--     FROM pg_proc
--    WHERE proname IN (
--      'nex_current_account_ids',
--      'nex_current_owned_business_ids',
--      'nex_current_participant_conversation_ids',
--      'nex_conversations_of_my_businesses'
--    );
--
-- Expected `proconfig` for each row:
--   {search_path=pg_catalog, public}
--
-- And verify the function body is unchanged by re-running:
--   SELECT pg_get_functiondef(oid) FROM pg_proc
--    WHERE proname = 'nex_current_account_ids';
-- ============================================================================

BEGIN;

ALTER FUNCTION nex_current_account_ids()
  SET search_path = pg_catalog, public;

ALTER FUNCTION nex_current_owned_business_ids()
  SET search_path = pg_catalog, public;

ALTER FUNCTION nex_current_participant_conversation_ids()
  SET search_path = pg_catalog, public;

ALTER FUNCTION nex_conversations_of_my_businesses()
  SET search_path = pg_catalog, public;

INSERT INTO nex_migration_history (version, description, notes)
VALUES (
  '217',
  'RLS helper · search_path hardening on 4 Migration 010 SECURITY DEFINER helpers',
  'Owner-authorised design review 2026-10-24. Prerequisite to Migration 218 (nex_peer_message / nex_live_post RLS repair). Pin search_path = pg_catalog, public on nex_current_account_ids / nex_current_owned_business_ids / nex_current_participant_conversation_ids / nex_conversations_of_my_businesses. No function body changes · no ownership / grant changes · no new objects. Behavioural invariant: identical SETOF uuid results under identical auth.uid(). Rollback: ALTER FUNCTION ... RESET search_path on all four. NOT YET APPLIED to any database.'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
