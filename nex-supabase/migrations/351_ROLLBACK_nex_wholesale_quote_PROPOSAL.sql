-- =============================================================================
-- Migration 351 ROLLBACK · nex_wholesale_quote · companion reversal
-- STATUS: PROPOSAL · NOT AUTHORISED FOR APPLY · NEVER EXECUTE WITHOUT
-- SEPARATE EXPLICIT OWNER AUTHORISATION naming this file by filename.
-- Target when authorised: sandbox kdstoyyeygcopkogqsyv ONLY
-- Prod ijvqdvsvwtwxzcqmoqit remains sealed (Memory #5, Oct 2026-11-10).
-- Authored 2026-11-18 · prompt-3 §3 (rollback companion authored locally).
-- =============================================================================
--
-- WHEN TO USE
--   · Only if migration 351 (nex_wholesale_quote_PROPOSAL.sql) has been
--     applied to a sandbox AND the forward migration itself must be
--     withdrawn end-to-end. Point fixes (e.g. renaming a column) should
--     be handled by a forward amendment, not by rollback.
--   · Never run this against prod · the forward migration itself is
--     scoped sandbox-only and has no production applied-state to undo.
--
-- IRREVERSIBLE / DESTRUCTIVE STEPS (be explicit)
--   1 · `DROP TABLE public.nex_wholesale_quote CASCADE` (below) will
--       delete EVERY ROW in that table. If any live quotes have been
--       written (seller-created, buyer-accepted, etc.) they will be
--       permanently lost. There is NO soft-delete fallback in this
--       script.
--   2 · The owner_insert / owner_update / owner_select / buyer_select /
--       buyer_update RLS policies are dropped. Any application code
--       that relied on those policy names for monitoring (e.g. a
--       separate observability job listing policies by name) will
--       stop finding them.
--   3 · The two trigger functions are dropped. If any other migration
--       author added a trigger that referenced
--       `nex_wholesale_quote_buyer_column_guard` on a different table,
--       that trigger will fail. A quick `pg_depend` scan is included
--       as a dry-run check at the top of this script (NOT executed on
--       apply; it is for pre-apply human review only).
--
-- PRE-ROLLBACK CHECKLIST (run manually before authorising execution)
--
--   [ ]  Confirm target project ref:
--          SELECT current_database(), inet_server_addr();
--        must resolve to the sandbox (kdstoyyeygcopkogqsyv) · never prod.
--
--   [ ]  Confirm row inventory first · write the output somewhere safe:
--          SELECT count(*) AS total,
--                 count(*) FILTER (WHERE status='accepted') AS accepted,
--                 count(*) FILTER (WHERE status='quoted')   AS quoted,
--                 count(*) FILTER (WHERE status='draft')    AS draft
--            FROM public.nex_wholesale_quote;
--        If total > 0 and the owner has not explicitly authorised data
--        loss, STOP here.
--
--   [ ]  Confirm no concurrent dependency exists on the trigger fn:
--          SELECT c.relname, t.tgname
--            FROM pg_trigger t
--            JOIN pg_proc p ON p.oid = t.tgfoid
--            JOIN pg_class c ON c.oid = t.tgrelid
--            WHERE p.proname IN ('nex_wholesale_quote_buyer_column_guard',
--                                'nex_wholesale_quote_touch_updated_at')
--              AND c.relname <> 'nex_wholesale_quote';
--        Expected: zero rows. Any row means a cross-table trigger
--        depends on this function and will break on DROP FUNCTION.
--
--   [ ]  Confirm 351 is in fact currently applied:
--          SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--            WHERE n.nspname='public' AND c.relname='nex_wholesale_quote';
--        Zero rows → nothing to roll back; this script is a no-op and
--        should NOT be run (per Constitution §6).
--
--   [ ]  Ensure migration 350 (buyer approval) is NOT also being rolled
--       back in the same session unless owner has authorised BOTH. 351
--       references the same approval flow conceptually but has no FK
--       into 350's table; they can be dropped independently.
--
-- DEPENDENCY ORDER
--   This rollback is intended to run in the order documented below:
--     1 · Drop the buyer-column-guard trigger (depends on 351 table).
--     2 · Drop the touch trigger (depends on 351 table).
--     3 · Drop the buyer-column-guard function (depends on nothing
--         external once the triggers are gone).
--     4 · Drop the touch_updated_at function (same reason).
--     5 · Drop the five RLS policies (depend on the table).
--     6 · Drop the three indexes (depend on the table; dropped
--         automatically by DROP TABLE CASCADE but we are explicit).
--     7 · DROP TABLE public.nex_wholesale_quote.
--
--   No external object should depend on `nex_wholesale_quote` outside
--   this migration. The forward-migration FK is FROM 351 TO the pre-
--   existing tables (nex_business, nex_account, nex_product); those
--   parents are not touched.
--
-- =============================================================================

BEGIN;

-- 1 · Triggers on the table.
DROP TRIGGER IF EXISTS nex_wholesale_quote_buyer_column_guard_t
  ON public.nex_wholesale_quote;

DROP TRIGGER IF EXISTS nex_wholesale_quote_touch
  ON public.nex_wholesale_quote;

-- 2 · Trigger functions.
--     SECURITY INVOKER functions in the public schema. Guarded by
--     IF EXISTS so a partial-apply state is still rollback-safe.
DROP FUNCTION IF EXISTS public.nex_wholesale_quote_buyer_column_guard();
DROP FUNCTION IF EXISTS public.nex_wholesale_quote_touch_updated_at();

-- 3 · RLS policies. Dropping policies before the table so we can see
--     any permission-error surprises per-policy rather than hiding
--     inside a CASCADE.
DROP POLICY IF EXISTS nex_wholesale_quote_owner_select
  ON public.nex_wholesale_quote;
DROP POLICY IF EXISTS nex_wholesale_quote_owner_insert
  ON public.nex_wholesale_quote;
DROP POLICY IF EXISTS nex_wholesale_quote_owner_update
  ON public.nex_wholesale_quote;
DROP POLICY IF EXISTS nex_wholesale_quote_buyer_select
  ON public.nex_wholesale_quote;
DROP POLICY IF EXISTS nex_wholesale_quote_buyer_update
  ON public.nex_wholesale_quote;

-- 4 · Indexes. Technically redundant with DROP TABLE below but we
--     keep this explicit so that a partial-apply state (table missing,
--     stray indexes left behind) can also be cleaned up by running the
--     script again.
DROP INDEX IF EXISTS public.nex_wholesale_quote_owner_live_ix;
DROP INDEX IF EXISTS public.nex_wholesale_quote_buyer_inbox_ix;
DROP INDEX IF EXISTS public.nex_wholesale_quote_expires_ix;

-- 5 · The table itself. CASCADE is deliberately NOT used here so that
--     any surprise dependency surfaces with a readable error rather
--     than being silently cascaded. If the pre-rollback checklist
--     above passed, there should be no dependents.
DROP TABLE IF EXISTS public.nex_wholesale_quote;

COMMIT;

-- =============================================================================
-- POST-ROLLBACK VERIFICATION QUERIES (run manually, read-only)
--
--   SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--     WHERE n.nspname='public' AND c.relname='nex_wholesale_quote';
--   -- expect: zero rows.
--
--   SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--     WHERE n.nspname='public'
--       AND p.proname IN ('nex_wholesale_quote_buyer_column_guard',
--                         'nex_wholesale_quote_touch_updated_at');
--   -- expect: zero rows.
--
-- =============================================================================
-- END · Migration 351 ROLLBACK PROPOSAL
-- =============================================================================
