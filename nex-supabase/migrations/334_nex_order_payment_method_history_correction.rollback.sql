-- Rollback for mig 334 · removes the payment_method column + CHECK.
-- Does not touch the orphaned version-320 history row.
BEGIN;
SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_advisory_xact_lock(334000001);
ALTER TABLE nex_order DROP CONSTRAINT IF EXISTS nex_order_payment_method_check;
ALTER TABLE nex_order DROP COLUMN IF EXISTS payment_method;
DELETE FROM nex_migration_history WHERE version = '334';
COMMIT;
