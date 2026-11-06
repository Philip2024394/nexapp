-- ============================================================================
-- NEX Migration 282 · nex_vault_export_log + rate-limit index + RLS
-- ============================================================================
--
-- STATUS: DRAFT · NOT YET APPLIED TO ANY DATABASE.
--
-- -- DRAFT · DO NOT APPLY WITHOUT OWNER AUTHORISATION PER CLAUDE.md § 5
--
-- Owner-authored preparation only (Phase 4 Batch 4.2 · Vault W5
-- download-everything endpoint · 2026-11-06). DO NOT APPLY to the
-- sealed Supabase project `ijvqdvsvwtwxzcqmoqit` without SEPARATE
-- explicit owner authorisation naming this file.
--
-- Purpose:
--   Back the "download all my Vault content" endpoint (Shop Entitlement
--   Contract § H-B7 release blocker + grace-promise § E) with a per-
--   account rate-limit log. Owner-locked policy 2026-11-06: 1 export
--   per 24h per account.
--
-- Scope of this migration (strictly):
--   · CREATE TABLE nex_vault_export_log (id, account_id, exported_at)
--   · Unique partial index on (account_id, UTC date of exported_at)
--     enforces at most one row per account per UTC calendar day. Any
--     attempt to insert a second row the same day fails with 23505
--     (unique_violation); the service layer catches that and returns
--     a 429. This is the DB-level backstop · the service also checks
--     before inserting so clients see a clean 429, not an SQL error.
--   · ENABLE ROW LEVEL SECURITY
--   · Policies: users SELECT/INSERT their own rows (joined through
--     nex_account.supabase_user_id = auth.uid()). Service-role
--     bypasses via BYPASSRLS as normal.
--   · nex_migration_history ledger entry.
--
-- NOT in scope (deferred):
--   · The service module itself (TypeScript) is shipped alongside this
--     migration file in the same commit but is NOT this migration.
--   · The API route handler is shipped alongside, not here.
--   · No retention / pruning job. Rows are small (uuid+uuid+timestamp)
--     and one-per-day-per-account · ~365 rows/account/year worst case.
--     If pruning becomes necessary a separate migration adds the cron.
--
-- Graceful degradation (service-side, not SQL-side):
--   · The service module tolerates the ABSENCE of this table. If a
--     query to `nex_vault_export_log` returns a "relation does not
--     exist" error (42P01), the service logs a warning and proceeds
--     WITHOUT a rate-limit check. This keeps the endpoint usable in
--     environments where 282 has not yet been applied, at the honest
--     cost that rate-limiting is inactive until this migration lands.
--
-- Rollback (copy-paste if ever needed):
--
--   BEGIN;
--   DO $$ BEGIN
--     IF session_user NOT IN ('postgres','supabase_admin') THEN
--       RAISE EXCEPTION 'Migration 282 rollback REFUSED · session_user=%', session_user;
--     END IF;
--   END $$;
--   DROP POLICY IF EXISTS nex_vault_export_log_select_own ON public.nex_vault_export_log;
--   DROP POLICY IF EXISTS nex_vault_export_log_insert_own ON public.nex_vault_export_log;
--   DROP INDEX IF EXISTS nex_vault_export_log_account_utc_day_uniq;
--   DROP TABLE IF EXISTS public.nex_vault_export_log;
--   DELETE FROM public.nex_migration_history WHERE version = '282';
--   COMMIT;
--
-- Risk level: LOW · new table, no reads from existing tables, no
--   writes to existing tables, no triggers on other objects.
--
-- ============================================================================

BEGIN;

-- Apply guard · DRAFT (CLAUDE.md § 5 · sealed project ijvqdvsvwtwxzcqmoqit)
DO $$
BEGIN
  RAISE EXCEPTION 'Migration 282 is DRAFT · requires explicit owner authorisation naming this file to apply.';
END $$;

-- ---------------------------------------------------------------------------
-- Pre-flight audit
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Idempotency · refuse re-apply.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='nex_vault_export_log'
  ) THEN
    RAISE EXCEPTION 'Migration 282 refused: public.nex_vault_export_log already exists. Did you apply 282 already? See `nex_migration_history`.';
  END IF;

  -- nex_account must exist (foreign-key parent).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='nex_account'
  ) THEN
    RAISE EXCEPTION 'Migration 282 refused: public.nex_account missing (foreign-key parent).';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Rate-limit log table
-- ---------------------------------------------------------------------------
CREATE TABLE public.nex_vault_export_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.nex_account(id) ON DELETE CASCADE,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.nex_vault_export_log IS
  'Per-account log of Vault export-manifest requests · one row per successful export. Rate-limit (1 per UTC day per account) enforced by the partial unique index nex_vault_export_log_account_utc_day_uniq. Sealed Phase 4 Batch 4.2 · 2026-11-06 · Shop Entitlement Contract § H-B7 release blocker.';

COMMENT ON COLUMN public.nex_vault_export_log.account_id IS
  'FK to nex_account.id · cascade delete so account deletion purges logs.';

COMMENT ON COLUMN public.nex_vault_export_log.exported_at IS
  'When the export manifest was built. Rate-limit partitions by this timestamp converted to UTC date.';

-- ---------------------------------------------------------------------------
-- 1-per-UTC-day unique index (partial — covers all rows · the condition
-- is `true`, kept as an explicit WHERE for clarity and to document the
-- rate-limit intent beside the index).
--
-- The expression `((exported_at AT TIME ZONE 'UTC')::date)` is IMMUTABLE
-- (timezone-literal + constant SQL cast · unlike date_trunc which is
-- STABLE and cannot be used in an index predicate directly).
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX nex_vault_export_log_account_utc_day_uniq
  ON public.nex_vault_export_log (
    account_id,
    ((exported_at AT TIME ZONE 'UTC')::date)
  );

-- Secondary non-unique index for the per-account history scan used
-- by future admin / support surfaces. Cheap · narrow row.
CREATE INDEX nex_vault_export_log_by_account_time
  ON public.nex_vault_export_log (account_id, exported_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.nex_vault_export_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY nex_vault_export_log_select_own
  ON public.nex_vault_export_log FOR SELECT
  USING (
    account_id IN (
      SELECT id FROM public.nex_account WHERE supabase_user_id = auth.uid()
    )
  );

CREATE POLICY nex_vault_export_log_insert_own
  ON public.nex_vault_export_log FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.nex_account WHERE supabase_user_id = auth.uid()
    )
  );

-- No UPDATE / DELETE policy · users cannot mutate or erase their own
-- export history from the client. Service-role bypasses RLS and MAY
-- delete during account-deletion cascade (handled by FK).

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, applied_at)
VALUES (
  '282',
  'nex_vault_export_log + 1-per-UTC-day unique partial index + RLS select/insert-own. Backs Vault W5 download-everything endpoint (Shop Entitlement Contract § H-B7 release blocker + grace promise § E).',
  now()
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- Positive / negative tests
-- ---------------------------------------------------------------------------
-- POS-T282-1 · Pre-apply: table nex_vault_export_log does NOT exist.
--              Post-apply: table exists with 3 columns (id, account_id, exported_at).
-- POS-T282-2 · INSERT one row for (account A, today-UTC) → succeeds.
-- POS-T282-3 · Second INSERT for (account A, today-UTC) → fails with 23505
--              (unique_violation on nex_vault_export_log_account_utc_day_uniq).
-- POS-T282-4 · INSERT for (account A, yesterday-UTC) → succeeds (different UTC date).
-- POS-T282-5 · INSERT for (account B, today-UTC) → succeeds (different account).
-- POS-T282-6 · As authed user X, SELECT * → only rows where account_id belongs to X.
-- POS-T282-7 · As authed user X, INSERT with account_id = Y → RLS rejects.
-- NEG-T282-8 · Re-apply after successful apply → pre-flight sees table exists → raises.
-- ---------------------------------------------------------------------------
