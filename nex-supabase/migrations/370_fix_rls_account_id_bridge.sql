-- ============================================================================
-- NEX-native Migration 370 · RLS defence-in-depth correction
-- `nex_notification` + `nex_affiliate_promotion` + `nex.discovery_signal`
-- ============================================================================
--
-- Status: DRAFT · authoring-only · APPLY GATED on owner approval phrase
--   `APPROVE MIGRATION 370 NEX_NOTIFICATION + NEX_AFFILIATE_MARKETPLACE +
--    NEX_DISCOVERY_SIGNAL RLS CORRECTION SANDBOX (kdstoyyeygcopkogqsyv)`
--
-- Authored 2026-11-27 as the corrective action for L-057
-- (`docs/engineering/NEX-DELIVERY-LEDGER.md`). This migration does NOT
-- cross the approval boundary on its own · it exists in the tree as a
-- reviewable artefact under the standing 2026-11-27 source-control
-- policy. It must NOT be applied against production (`ijvqdvsvwtwxzcqmoqit`)
-- under any circumstance, and must NOT be applied against sandbox
-- (`kdstoyyeygcopkogqsyv`) without the named approval phrase above.
--
-- ─── The defect this migration repairs ───────────────────────────────
--
-- `nex_account.id` is a `gen_random_uuid()` surrogate column. The bridge
-- to `auth.users.id` (which `auth.uid()` returns at RLS evaluation time)
-- is the SEPARATE column `nex_account.supabase_user_id`:
--
--   CREATE TABLE nex_account (
--     id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--     supabase_user_id uuid NOT NULL REFERENCES auth.users(id),
--     ...
--   );
--
-- Every correctly-authored sibling policy in the repo (see e.g.
-- `nex_business`, `nex_order`, `nex_conversation_participant`, and
-- every table rewritten by migration 010) uses the sealed
-- SECURITY DEFINER helper from migration 010:48-55:
--
--   CREATE FUNCTION nex_current_account_ids()
--   RETURNS SETOF uuid LANGUAGE SQL SECURITY DEFINER STABLE AS $$
--     SELECT id FROM nex_account WHERE supabase_user_id = auth.uid();
--   $$;
--
-- The pattern `<fk_col_to_nex_account.id> IN (SELECT nex_current_account_ids())`
-- bridges `auth.uid()` (an `auth.users.id` value) to the surrogate
-- `nex_account.id` values stored on the row.
--
-- Three migrations emitted policies that forget this bridge entirely
-- and compare `auth.uid()` directly against a column that FKs to
-- `nex_account.id`. Because an `auth.users.id` UUID can never equal a
-- freshly-minted `nex_account.id` UUID, the policies evaluate to false
-- for every authenticated row. The defect is defence-in-depth only
-- today — the three affected code paths all read via service-role
-- (`nexSupabaseAdmin()`), which BYPASSES RLS — but the moment any
-- future caller switches to the authenticated supabase-js client,
-- authenticated reads will silently return zero rows.
--
-- Affected policies (5 total; 2 tables have both SELECT and UPDATE/DELETE):
--
--   1. public.nex_notification · nex_notification_recipient_select
--      (migration 366:136-140)  · FOR SELECT  · USING (auth.uid() = recipient_account_id)
--   2. public.nex_notification · nex_notification_recipient_mark_read
--      (migration 366:143-148)  · FOR UPDATE  · USING + WITH CHECK (auth.uid() = recipient_account_id)
--   3. public.nex_affiliate_promotion · nex_affiliate_promotion_self_read
--      (migration 124:83-86)    · FOR SELECT  · USING (auth.uid() = affiliate_account_id)
--   4. nex.discovery_signal · discovery_signal_own_select
--      (migration 208:103-106)  · FOR SELECT  · USING (auth.uid() = account_id)
--   5. nex.discovery_signal · discovery_signal_own_delete
--      (migration 208:121-124)  · FOR DELETE  · USING (auth.uid() = account_id)
--
-- Policies that are already correct and are NOT touched by this migration:
--   · nex.discovery_signal · discovery_signal_service_write (service_role only)
--   · migration 369 shop-install prefs (all four policies use the sealed helper)
--
-- ─── What this migration does ─────────────────────────────────────────
--
-- Drops and recreates the five defective policies above using the
-- sealed `nex_current_account_ids()` bridge. Policy INTENT is unchanged
-- (same operation, same role, same column, same implicit scope · we are
-- only correcting the mechanical join). Grants, indexes, CHECK constraints,
-- foreign keys, and triggers are left exactly as the originating migrations
-- shipped them. Service-role policies and admin bypass paths are untouched.
--
-- ─── What this migration does NOT do ──────────────────────────────────
--
-- * Does not modify any data row.
-- * Does not change grant surface (`GRANT UPDATE (read_at)` on nex_notification
--   stays exactly as migration 366 shipped it).
-- * Does not add missing INSERT policies on `nex_affiliate_promotion` or
--   `nex_notification` (both are intentionally service-role-only on INSERT
--   per the authoring comments in migrations 124 and 366 · a decision to
--   add authenticated INSERT policies is a separate design question that
--   must not ride on this correction migration).
-- * Does not drop the known-correct service-role policies on
--   `nex.discovery_signal` (`discovery_signal_service_write`).
-- * Does not touch migration 369's correct helper-based policies.
--
-- ─── Rollback ─────────────────────────────────────────────────────────
--
-- `370_fix_rls_account_id_bridge_rollback.sql` restores the exact
-- `auth.uid() = <col>` wording from migrations 366 / 124 / 208. The
-- rollback RE-INTRODUCES the defect by design · it exists only so an
-- apply can be cleanly reverted during the same review cycle if an
-- adjacent issue surfaces. It is NOT a long-term configuration.
--
-- ─── Post-apply verification (manual · do not include in SQL) ─────────
--
-- After a successful sandbox apply the owner-approved integration spec
-- should prove:
--   · User A (`createTestAccount`) cannot SELECT User B's rows on each
--     of the three tables via the authenticated supabase-js client.
--   · User A CAN SELECT their own rows on each of the three tables
--     via the authenticated supabase-js client (this is the test
--     that fails against the pre-370 schema).
--   · Service-role continues to SELECT every row on every table
--     (sanity check that the migration did not accidentally revoke
--     the admin path).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1 · public.nex_notification · SELECT + UPDATE
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS nex_notification_recipient_select ON public.nex_notification;
CREATE POLICY nex_notification_recipient_select
  ON public.nex_notification
  FOR SELECT
  TO authenticated
  USING (recipient_account_id IN (SELECT nex_current_account_ids()));

DROP POLICY IF EXISTS nex_notification_recipient_mark_read ON public.nex_notification;
CREATE POLICY nex_notification_recipient_mark_read
  ON public.nex_notification
  FOR UPDATE
  TO authenticated
  USING  (recipient_account_id IN (SELECT nex_current_account_ids()))
  WITH CHECK (recipient_account_id IN (SELECT nex_current_account_ids()));

-- ---------------------------------------------------------------------------
-- 2 · public.nex_affiliate_promotion · SELECT
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS nex_affiliate_promotion_self_read ON public.nex_affiliate_promotion;
CREATE POLICY nex_affiliate_promotion_self_read
  ON public.nex_affiliate_promotion
  FOR SELECT
  TO authenticated
  USING (affiliate_account_id IN (SELECT nex_current_account_ids()));

-- ---------------------------------------------------------------------------
-- 3 · nex.discovery_signal · SELECT + DELETE
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS discovery_signal_own_select ON nex.discovery_signal;
CREATE POLICY discovery_signal_own_select
  ON nex.discovery_signal
  FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT nex_current_account_ids()));

DROP POLICY IF EXISTS discovery_signal_own_delete ON nex.discovery_signal;
CREATE POLICY discovery_signal_own_delete
  ON nex.discovery_signal
  FOR DELETE
  TO authenticated
  USING (account_id IN (SELECT nex_current_account_ids()));

-- ---------------------------------------------------------------------------
-- Migration history
-- ---------------------------------------------------------------------------

INSERT INTO public.nex_migration_history (version, description, applied_at)
VALUES (
  '370',
  'RLS defence-in-depth correction · fix auth.uid() = <account_id> pattern on nex_notification, nex_affiliate_promotion, nex.discovery_signal · route 5 policies through sealed nex_current_account_ids() helper',
  now()
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
