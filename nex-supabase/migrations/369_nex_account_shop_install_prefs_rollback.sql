-- 369_nex_account_shop_install_prefs_rollback.sql
-- -----------------------------------------------------------------------------
-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║ DATA-DESTRUCTIVE ROLLBACK · READ BEFORE RUNNING                         ║
-- ╚═════════════════════════════════════════════════════════════════════════╝
--
-- This rollback drops `public.nex_account_shop_install_prefs` and
-- deletes EVERY SIGNED-IN CUSTOMER'S saved dismissal + install state.
-- This is NOT non-breaking. The initial draft described it as
-- non-breaking; that description was wrong and has been removed per
-- owner review 2026-11-27 (cycle 2).
--
-- User-visible consequences after running this rollback:
--
--   1. Signed-in customers who previously dismissed the branded shop
--      install slide-in (dismissals = 1 or 2) lose that state and may
--      see the slide-in re-appear on their next visit.
--   2. Signed-in customers whose `installed` state was persisted here
--      (because `appinstalled` fired in a browser that had already
--      synced) lose cross-device installed-state suppression. The
--      guest localStorage mirror on each device that fired the event
--      still remembers, so the regression is bounded to devices that
--      had learned install-state only through server sync.
--   3. Cross-device continuity for both of the above resets to zero.
--      From the moment of rollback, each device returns to the
--      guest-only path (localStorage-only, no server mirror).
--
-- Guest viewers are UNAFFECTED by this rollback because the guest
-- code path never queried this table.
--
-- ───────────── REQUIRED PRE-ROLLBACK BACKUP PROCEDURE ─────────────
--
-- Before running this rollback in ANY environment (sandbox or
-- production), capture the table state so recovery is possible:
--
--   # Using Supabase connection string (service-role or db-owner).
--   # Replace $DB_URL with the authoritative URL for the target
--   # project (sandbox kdstoyyeygcopkogqsyv or prod
--   # ijvqdvsvwtwxzcqmoqit · prod remains sealed · owner approval
--   # required for prod access).
--
--   pg_dump "$DB_URL" \
--     --data-only \
--     --table=public.nex_account_shop_install_prefs \
--     --file=nex_account_shop_install_prefs_pre_rollback_$(date -u +%Y%m%dT%H%M%SZ).sql
--
-- Store the dump outside the repo (never committed · the rows
-- include account_id values and therefore count as user data).
-- Verify the dump is restorable by executing it against a scratch
-- schema BEFORE running this rollback.
--
-- ─────────────────── RECOVERY FROM BACKUP ───────────────────
--
-- If the forward migration is re-applied after this rollback and
-- the backup is available, restore the saved rows AFTER the
-- forward migration completes:
--
--   psql "$DB_URL" \
--     --single-transaction \
--     --file=nex_account_shop_install_prefs_pre_rollback_<ts>.sql
--
-- Rows are keyed by `(account_id, shop_slug)` so re-applying them
-- is idempotent against the freshly-created empty table. If any
-- accounts have been deleted during the interval they will fail
-- the FK and should be filtered from the restore file.
--
-- ─────────────────── ROLLBACK EXECUTION ───────────────────
--
-- Drop order:
--   · Policies first (symmetric with the forward migration's
--     DROP POLICY IF EXISTS calls · makes the rollback safe to re-run).
--   · Trigger is owned by the table and drops with it via DROP TABLE.
--   · Table drop CASCADEs policies that weren't explicitly dropped
--     (defence in depth against future edits).
--
-- Requires the same owner authorisation as the forward migration.
-- Rollback does not restore any row data · it removes the table.
-- Apply only after confirming the pre-rollback backup is complete
-- and restorable.

BEGIN;

DROP POLICY IF EXISTS nex_account_shop_install_prefs_owner_select
  ON public.nex_account_shop_install_prefs;
DROP POLICY IF EXISTS nex_account_shop_install_prefs_owner_insert
  ON public.nex_account_shop_install_prefs;
DROP POLICY IF EXISTS nex_account_shop_install_prefs_owner_update
  ON public.nex_account_shop_install_prefs;
DROP POLICY IF EXISTS nex_account_shop_install_prefs_owner_delete
  ON public.nex_account_shop_install_prefs;

DROP TRIGGER IF EXISTS trg_nex_account_shop_install_prefs_touch_updated_at
  ON public.nex_account_shop_install_prefs;

DROP TABLE IF EXISTS public.nex_account_shop_install_prefs;

DELETE FROM nex_migration_history WHERE version = '369';

COMMIT;
