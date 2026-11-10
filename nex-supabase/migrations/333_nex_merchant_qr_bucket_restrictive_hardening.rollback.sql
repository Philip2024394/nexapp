-- Rollback for mig 333 · restores mig 321's PERMISSIVE deny policies.
BEGIN;
SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(333000001);

DROP POLICY IF EXISTS nex_merchant_qr_anon_deny ON storage.objects;
DROP POLICY IF EXISTS nex_merchant_qr_authenticated_deny ON storage.objects;
DROP POLICY IF EXISTS nex_merchant_qr_service_role_all ON storage.objects;

CREATE POLICY nex_merchant_qr_select_denied
  ON storage.objects AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (bucket_id <> 'nex-merchant-qr');
CREATE POLICY nex_merchant_qr_insert_denied
  ON storage.objects AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id <> 'nex-merchant-qr');
CREATE POLICY nex_merchant_qr_update_denied
  ON storage.objects AS PERMISSIVE FOR UPDATE TO anon, authenticated
  USING (bucket_id <> 'nex-merchant-qr')
  WITH CHECK (bucket_id <> 'nex-merchant-qr');
CREATE POLICY nex_merchant_qr_delete_denied
  ON storage.objects AS PERMISSIVE FOR DELETE TO anon, authenticated
  USING (bucket_id <> 'nex-merchant-qr');

DELETE FROM nex_migration_history WHERE version = '333';
COMMIT;
