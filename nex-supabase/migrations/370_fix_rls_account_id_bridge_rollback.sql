-- ============================================================================
-- NEX-native Migration 370 · ROLLBACK
-- Restores the pre-370 broken policies on `nex_notification`,
-- `nex_affiliate_promotion`, `nex.discovery_signal`
-- ============================================================================
--
-- Status: ROLLBACK · authoring-only · APPLY GATED
--
-- Reverts migration 370 by restoring the exact `auth.uid() = <col>` wording
-- from migrations 366 / 124 / 208. The rollback intentionally RE-INTRODUCES
-- the defect that migration 370 fixes · it exists only so an apply can be
-- cleanly reverted during the same review cycle if an adjacent issue
-- surfaces.
--
-- Running this rollback against sandbox does NOT itself leak data (the
-- affected tables are read via service-role today), but it DOES recreate
-- the defence-in-depth gap. Treat as a review tool, not a long-term
-- configuration.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1 · public.nex_notification · restore pre-370 SELECT + UPDATE
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS nex_notification_recipient_select ON public.nex_notification;
CREATE POLICY nex_notification_recipient_select
  ON public.nex_notification
  FOR SELECT
  TO authenticated
  USING (auth.uid() = recipient_account_id);

DROP POLICY IF EXISTS nex_notification_recipient_mark_read ON public.nex_notification;
CREATE POLICY nex_notification_recipient_mark_read
  ON public.nex_notification
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_account_id)
  WITH CHECK (auth.uid() = recipient_account_id);

-- ---------------------------------------------------------------------------
-- 2 · public.nex_affiliate_promotion · restore pre-370 SELECT
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS nex_affiliate_promotion_self_read ON public.nex_affiliate_promotion;
CREATE POLICY nex_affiliate_promotion_self_read
  ON public.nex_affiliate_promotion
  FOR SELECT
  USING (auth.uid() = affiliate_account_id);

-- ---------------------------------------------------------------------------
-- 3 · nex.discovery_signal · restore pre-370 SELECT + DELETE
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS discovery_signal_own_select ON nex.discovery_signal;
CREATE POLICY discovery_signal_own_select
  ON nex.discovery_signal
  FOR SELECT
  USING (auth.uid() = account_id);

DROP POLICY IF EXISTS discovery_signal_own_delete ON nex.discovery_signal;
CREATE POLICY discovery_signal_own_delete
  ON nex.discovery_signal
  FOR DELETE
  USING (auth.uid() = account_id);

-- ---------------------------------------------------------------------------
-- Migration history · remove the 370 row so a future re-apply is clean.
-- ---------------------------------------------------------------------------

DELETE FROM public.nex_migration_history WHERE version = '370';

COMMIT;
