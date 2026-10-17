-- Migration 206 · nex_account.hq_role · 2026-10-17 Phase 2.1
-- --------------------------------------------------------------------------
-- STATUS: AUTHORED · NOT YET APPLIED. Owner authorisation covers
-- preparation and content review only. A separate explicit application
-- authorisation (plus live-project reverification against
-- `ijvqdvsvwtwxzcqmoqit`) is required before this migration touches
-- any database.
--
-- Adds ONE nullable column to nex_account for NEX HQ role governance:
--
--   hq_role  text  NULL default null
--   CHECK (hq_role IN ('reviewer','admin') OR hq_role IS NULL)
--
-- Semantics (owner-sealed Phase 2.1):
--   · NULL      · ordinary NEX account · no HQ access
--   · reviewer  · may READ HQ dashboards + future report-review
--                 queues · may NOT make enforcement decisions
--   · admin     · reviewer powers + may make enforcement decisions
--                 (set tiers · approve/reject images · future
--                 report-outcome actions)
--
-- Doctrine:
--   · Server-side enforcement only · the role is read by the sealed
--     `src/lib/nex-native/hq-authorization.ts` helper on every HQ
--     page + every HQ server action independently. Page gating is
--     NOT sufficient · each action re-verifies.
--   · Fail-closed · any lookup error returns null (no role) · never
--     silently grants access.
--   · Additive only · existing rows get hq_role = NULL on apply ·
--     zero backfill required · zero behavioural change for any
--     existing account.
--   · Reversible · `ALTER TABLE nex_account DROP COLUMN hq_role;
--     ALTER TABLE nex_account DROP CONSTRAINT nex_account_hq_role_check;`
--     restores the pre-apply schema. All role grants are lost on drop
--     (destructive to administrative intent).
--
-- ROLLBACK DISCIPLINE (owner-sealed 2026-10-18 · audit Finding 7):
-- DO NOT execute the rollback casually. The DROP COLUMN permanently
-- erases every hq_role grant in the database. Operational consequence:
-- the HQ gates (if still deployed in Phase 2.1 code) all return 404
-- for every account because `getHqRole` fail-closes on the missing
-- column · HQ surfaces become inaccessible to everyone until the
-- migration re-applies AND the seed re-runs.
--
-- MANDATORY pre-rollback discipline:
--   1. EXPORT every existing grant before any DROP:
--        SELECT id, nex_handle, display_name, hq_role, now() AS exported_at
--          FROM nex_account WHERE hq_role IS NOT NULL;
--      Save the result (CSV / text file / audit log) OUTSIDE the DB.
--   2. Execute the rollback:
--        BEGIN;
--          ALTER TABLE nex_account DROP CONSTRAINT nex_account_hq_role_check;
--          DROP INDEX IF EXISTS idx_nex_account_hq_role_set;
--          ALTER TABLE nex_account DROP COLUMN hq_role;
--          DELETE FROM nex_migration_history WHERE version = '206';
--        COMMIT;
--   3. If re-applying: run this migration again + replay EACH grant
--      from the exported list via its own authorised UPDATE statement.
--   · Idempotent · ADD COLUMN IF NOT EXISTS + DO $$ ... $$ guard on
--     CHECK constraint · safe to apply repeatedly.
--
-- RLS note: nex_account already has `nex_account_self_read` policy
-- (migration 001) allowing authenticated users to read their own
-- row. That reads their own hq_role only · which is fine (a
-- reviewer may know they are a reviewer). The HQ authorisation
-- helper uses the service role to read ANY account's hq_role for
-- its gating queries · bypasses RLS by design (role lookup must
-- work regardless of RLS policy state).
--
-- Related: a separately-authored seed script
-- `scripts/seed/seed-hq-admin.sql` grants the initial admin role to
-- the sealed owner account (nex-10842 · UUID 5c3e3d63-5c50-4f42-
-- 9e49-ba5f6fb4290b · resolved by read-only SELECT during the
-- Phase 2.1 audit). The seed is AUTHORED ONLY · not auto-applied.
--
-- OUT OF SCOPE for Phase 2.1 (sealed in the authorising directive):
--   · Report queue list / detail
--   · Report state transitions (under_review → action_taken etc.)
--   · Enforcement workflow
--   · Account hold / suspension mechanism
--   · Appeals system
--   · Public case history
--   · Audit trail table (Phase 2.2 · required before any new
--     report-review / enforcement workflow)
--
-- Owner directive 2026-10-17 (verbatim): "Do not apply this to the
-- live database. Do not run the seed SQL. Do not grant any role in
-- the live database."
--
-- MIGRATION HISTORY INSERTION (owner-sealed 2026-10-18 · audit
-- Finding 6):
-- This migration does NOT self-INSERT its history row · consistent
-- with the recent 198-205 batch convention. Two valid apply paths:
--
--   A · Sealed runner (`scripts/supabase-apply-directory-canonical.mjs`)
--       inserts the row automatically via its own INSERT at line 121.
--       Side effect: the runner also applies ANY other unapplied
--       migrations in filename order · would apply 204 + 205 + 206
--       together today. Choose this when you intend to apply the
--       whole unapplied queue in one go.
--
--   B · Supabase SQL editor (manual · recommended for Phase 2.1 scope
--       because 204 and 205 are separate decisions). After pasting +
--       executing the DDL below, run this history INSERT in the SAME
--       SQL editor session so the sealed runner won't re-attempt 206
--       on its next invocation:
--
--         INSERT INTO public.nex_migration_history
--           (version, description, applied_at)
--         VALUES (
--           '206',
--           'nex_account.hq_role · Phase 2.1 · reviewer/admin role column + CHECK + partial index',
--           now()
--         ) ON CONFLICT (version) DO NOTHING;

alter table nex_account
  add column if not exists hq_role text default null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nex_account_hq_role_check'
  ) then
    alter table nex_account
      add constraint nex_account_hq_role_check
      check (hq_role in ('reviewer','admin') or hq_role is null);
  end if;
end $$;

create index if not exists idx_nex_account_hq_role_set
  on nex_account (hq_role)
  where hq_role is not null;

comment on column nex_account.hq_role is
  'NEX HQ reviewer role · migration 206 · 2026-10-17. NULL default · granted only through authorised SQL updates by the sealed admin. "reviewer" may read HQ dashboards + future report-review queues; "admin" may additionally make enforcement decisions. Server-side enforcement at src/lib/nex-native/hq-authorization.ts · page gating is not sufficient · each HQ server action re-verifies independently.';
