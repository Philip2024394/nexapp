-- ============================================================================
-- NEX-native Migration 333 · merchant-qr bucket · RLS RESTRICTIVE hardening
-- ============================================================================
-- Owner-authorised 2026-11-10. Forward-only correction.
--
-- Discovery · sandbox probe 2026-11-10 showed mig 321 installed the 4
-- merchant-qr deny policies as PERMISSIVE. PERMISSIVE policies combine
-- with OR · a future PERMISSIVE policy that matches a merchant-qr row
-- would override the deny. RESTRICTIVE policies combine with AND · one
-- restrictive FALSE denies regardless of other permissives.
--
-- Mig 295 (ciphertext bucket) used the RESTRICTIVE pattern. Mig 333
-- brings the merchant-qr bucket inline with the sealed pattern.
--
-- Fix · DROP the 4 permissive policies · CREATE the equivalent RESTRICTIVE
-- policies with the same qual expression. Zero functional change in the
-- current state (service_role still bypasses RLS · anon/authenticated
-- still see zero rows) · strictly stronger invariant.
--
-- Prerequisite · mig 321 applied.
-- Rollback · 333_...rollback.sql reinstates the PERMISSIVE policies.
-- ============================================================================

BEGIN;

SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(333000001);

DO $pre$
BEGIN
  IF EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '333') THEN
    RAISE EXCEPTION 'Migration 333 already recorded in nex_migration_history.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '321') THEN
    RAISE EXCEPTION 'Prerequisite: migration 321 (merchant-qr bucket RLS) must be applied first.';
  END IF;
END
$pre$;

DROP POLICY IF EXISTS nex_merchant_qr_select_denied ON storage.objects;
DROP POLICY IF EXISTS nex_merchant_qr_insert_denied ON storage.objects;
DROP POLICY IF EXISTS nex_merchant_qr_update_denied ON storage.objects;
DROP POLICY IF EXISTS nex_merchant_qr_delete_denied ON storage.objects;

CREATE POLICY nex_merchant_qr_anon_deny
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (bucket_id <> 'nex-merchant-qr')
  WITH CHECK (bucket_id <> 'nex-merchant-qr');

CREATE POLICY nex_merchant_qr_authenticated_deny
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (bucket_id <> 'nex-merchant-qr')
  WITH CHECK (bucket_id <> 'nex-merchant-qr');

CREATE POLICY nex_merchant_qr_service_role_all
  ON storage.objects
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (bucket_id = 'nex-merchant-qr')
  WITH CHECK (bucket_id = 'nex-merchant-qr');

INSERT INTO nex_migration_history (version, applied_at, description, notes)
VALUES (
  '333',
  NOW(),
  'nex-merchant-qr bucket · 4 permissive deny policies replaced with 2 restrictive deny + 1 service_role_all',
  'Mig 333 upgrades mig 321 to the sealed RESTRICTIVE pattern used by mig 295. One restrictive FALSE now denies anon/authenticated regardless of future permissive policies. service_role_all policy encoded explicitly for audit clarity.'
);

COMMIT;
