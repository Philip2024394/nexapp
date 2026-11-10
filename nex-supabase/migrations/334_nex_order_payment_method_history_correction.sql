-- ============================================================================
-- NEX-native Migration 334 · payment_method history correction
-- ============================================================================
-- Owner-authorised 2026-11-10. Forward-only correction.
--
-- Discovery · while writing the world-class safety matrix the probe caught
-- that version '320' in nex_migration_history is held by a different,
-- older migration ("nex_device registry · Phase 2 Sprint 1 foundation ·
-- public keys only" · applied 2026-11-09). The source file
-- `320_nex_order_payment_method.sql` from Phase B · P5 shipped with
-- `ON CONFLICT (version) DO NOTHING` · when I applied it this cycle, the
-- INSERT silently swallowed · the column + CHECK landed on
-- `nex_order.payment_method` but the migration audit trail never recorded
-- which source file brought the schema change.
--
-- Fix · this migration records the payment_method column + CHECK as
-- version 334 in nex_migration_history, pointing readers at the correct
-- source file and the collision reason. The ALTER TABLE is wrapped in
-- `ADD COLUMN IF NOT EXISTS` and `DROP CONSTRAINT IF EXISTS` so it is
-- idempotent on any environment (sandbox already has the column; prod
-- does not yet).
--
-- Collision DOES NOT indicate the earlier migration is wrong. It
-- indicates that two authors picked version '320' independently. The
-- solution is forward-only: new version 334 claims the actual payment_
-- method story; the orphaned 320 history row for "nex_device registry"
-- stays as historical record of the first use of 320.
--
-- Prerequisite · none. The source file (mig 320_nex_order_payment_method)
-- may or may not have been applied. This migration is safe either way.
-- Rollback · 334_...rollback.sql removes both the column and the history
-- row (does not touch any device-registry rows).
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(334000001);

DO $pre$
BEGIN
  IF EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '334') THEN
    RAISE EXCEPTION 'Migration 334 already recorded in nex_migration_history.';
  END IF;
END
$pre$;

-- Idempotent column + CHECK · safe if 320_nex_order_payment_method.sql
-- already ran (sandbox) or hasn't yet (prod).
ALTER TABLE nex_order
  ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE nex_order
  DROP CONSTRAINT IF EXISTS nex_order_payment_method_check;

ALTER TABLE nex_order
  ADD CONSTRAINT nex_order_payment_method_check
    CHECK (payment_method IS NULL OR payment_method IN (
      'qr_manual',
      'stripe_checkout',
      'paypal',
      'qris_dynamic'
    ));

COMMENT ON COLUMN nex_order.payment_method IS
  'Phase B · P5 · which gateway completed this order. NULL for legacy rows. Set by the payment method resolver on checkout. Added by mig 334 (2026-11-10) · supersedes the swallowed mig 320_nex_order_payment_method history row.';

INSERT INTO nex_migration_history (version, applied_at, description, notes)
VALUES (
  '334',
  NOW(),
  'nex_order.payment_method column + 4-value CHECK (correction for swallowed mig 320)',
  'Mig 334 records what mig 320_nex_order_payment_method.sql attempted but could not record because version 320 was already held by an older migration (nex_device registry). Source file remains unchanged; this is the audit-trail fix. Idempotent · safe on any env.'
);

COMMIT;
