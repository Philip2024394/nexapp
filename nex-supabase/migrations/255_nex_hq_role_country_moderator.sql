-- ============================================================================
-- NEX Migration 255 · hq_role · widen CHECK to permit country_moderator:<ISO>
-- ============================================================================
--
-- STATUS: DRAFT · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised preparation only (NEX GLOBAL FEED PROPOSAL · Stage 3A ·
-- 2026-11-01 Decision D6). DO NOT APPLY to the sealed Supabase project
-- `ijvqdvsvwtwxzcqmoqit` without a SEPARATE explicit owner authorisation
-- naming this file.
--
-- Purpose:
--   Replace the existing `nex_account_hq_role_check` constraint
--     CHECK ((hq_role = ANY (ARRAY['reviewer','admin'])) OR (hq_role IS NULL))
--   with a widened form that accepts the per-country moderator pattern:
--     CHECK ((hq_role IS NULL)
--            OR (hq_role IN ('reviewer','admin'))
--            OR (hq_role ~ '^country_moderator:[A-Z]{2}$'))
--
--   This lets us store strings like `country_moderator:IE` and
--   `country_moderator:ID`. Combined with the Stage 3C server-side
--   `requireHqCountryModerator(country)` helper, this gives DB-level
--   format validation PLUS server-side country-match enforcement
--   (owner safeguard #2).
--
-- Why not a link table (option B from Stage 2):
--   Owner chose D6 Option 1 (regex on hq_role column). Simpler, one
--   column, no FK. If multi-country moderators are needed later, a
--   second migration can add a link table alongside without conflict.
--
-- Dependencies:
--   · nex_account.hq_role column + current CHECK constraint
--
-- Scope (strictly):
--   · DROP CONSTRAINT nex_account_hq_role_check (existing name)
--   · ADD CONSTRAINT nex_account_hq_role_check (new widened form)
--
-- NOT in scope:
--   · Country-moderator SERVER-SIDE enforcement helper (Stage 3C ·
--     src/lib/nex-native/hq-authorization.ts)
--   · Granting any specific account the country_moderator role · owner
--     does that via explicit UPDATE statements after this migration
--
-- Backfill: NONE. Existing values (`reviewer`, `admin`, NULL) all still
--   pass the new CHECK. Zero existing rows need to change.
--
-- Rollback: trivial · drop the new CHECK, restore the old one. No data
--   loss (unless an admin has written country_moderator values between
--   apply and rollback · guarded by Stage 3C only writing admin-authorised
--   values).
--
-- Risk level: LOW (constraint-only change, all existing rows pass).
--
-- ============================================================================

BEGIN;

-- Apply guard
DO $$
BEGIN
  RAISE EXCEPTION 'Migration 255 is DRAFT · requires explicit owner authorisation naming this file to apply.';
END $$;

-- ---------------------------------------------------------------------------
-- Pre-flight · existing constraint must be present as expected
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  _def text;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO _def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
   WHERE t.relname='nex_account' AND c.conname='nex_account_hq_role_check';
  IF _def IS NULL THEN
    RAISE EXCEPTION 'Migration 255 refused: nex_account_hq_role_check constraint not found. Audit the schema before proceeding.';
  END IF;
  -- Record the old definition in a NOTICE so the apply log shows what we replaced
  RAISE NOTICE 'Replacing existing nex_account_hq_role_check: %', _def;
END $$;

-- ---------------------------------------------------------------------------
-- Replace the CHECK
-- ---------------------------------------------------------------------------
ALTER TABLE public.nex_account
  DROP CONSTRAINT nex_account_hq_role_check;

ALTER TABLE public.nex_account
  ADD CONSTRAINT nex_account_hq_role_check
  CHECK (
    hq_role IS NULL
    OR hq_role IN ('reviewer','admin')
    OR hq_role ~ '^country_moderator:[A-Z]{2}$'
  );

COMMENT ON CONSTRAINT nex_account_hq_role_check ON public.nex_account IS
  'Widened 2026-11-01 (Migration 255) to accept country_moderator:<ISO alpha-2>. Full matrix: NULL (no HQ access) | reviewer | admin | country_moderator:XX. SQL layer validates FORMAT ONLY. Server-side `requireHqCountryModerator(country)` (Stage 3C) additionally enforces that the <ISO> suffix matches the target country of the action.';

-- ---------------------------------------------------------------------------
-- DUAL-LAYER ENFORCEMENT · owner safeguard 2026-11-01
-- ---------------------------------------------------------------------------
-- Layer 1 (DB · this migration):
--   The CHECK constraint validates that any string stored in hq_role has
--   the right SHAPE: NULL, or 'reviewer'/'admin', or matches regex
--   '^country_moderator:[A-Z]{2}$'. Bad format strings (lowercase, wrong
--   length, missing suffix, trailing whitespace) are rejected at DB level.
--   This stops ONE class of attack: an admin inadvertently storing a
--   malformed role value.
--
-- Layer 2 (server · Stage 3C · src/lib/nex-native/hq-authorization.ts):
--   `requireHqCountryModerator(viewerAccountId, targetCountry)` performs
--   the semantic check that Layer 1 cannot:
--     1. getHqRole(viewerAccountId) returns the raw string.
--     2. If role === 'admin' → pass (admin role covers all countries).
--     3. Else parse via regex /^country_moderator:([A-Z]{2})$/:
--        - If no match → throw HqAuthorizationError (role insufficient).
--        - If suffix !== targetCountry → throw HqAuthorizationError
--          (wrong country · an IE moderator cannot act on an ID
--          placement).
--     4. Otherwise pass.
--
-- Both layers must pass before any country-scoped HQ server action in Stage
-- 3C performs a write. The DB CHECK alone is NOT sufficient authorisation.
--
-- Code sketch for the Stage 3C helper (NOT written yet · drafted here only
-- for owner review before build authorisation):
--
--   export async function requireHqCountryModerator(
--     accountId: NexUuid | null | undefined,
--     targetCountry: string,
--   ): Promise<void> {
--     const role = await getHqRole(accountId);
--     if (role === 'admin') return;
--     const m = /^country_moderator:([A-Z]{2})$/.exec(role ?? '');
--     if (!m) throw new HqAuthorizationError(`country_moderator:${targetCountry}`, accountId ?? null);
--     if (m[1] !== targetCountry) {
--       throw new HqAuthorizationError(
--         `country_moderator:${targetCountry} (viewer holds country_moderator:${m[1]})`,
--         accountId ?? null,
--       );
--     }
--   }
--
-- Every Stage 3C server action that touches nex_country_placement WHERE
-- placement_status is changing (approve/reject/hold/remove) MUST call this
-- helper with the target country of the row being moderated. Code review
-- before Stage 3C ship enforces this contract.

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, applied_at)
VALUES (
  '255',
  'nex_account_hq_role_check widened to allow country_moderator:<ISO alpha-2>. Existing admin + reviewer values preserved. Server-side enforcement helper requireHqCountryModerator ships in Stage 3C.',
  now()
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification queries (run AFTER authorised apply)
-- ---------------------------------------------------------------------------
-- -- 1. New constraint definition
-- SELECT conname, pg_get_constraintdef(c.oid)
--   FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
--  WHERE t.relname='nex_account' AND conname='nex_account_hq_role_check';
--
-- -- 2. Existing admin/reviewer rows still pass (nex-90001 HQ Admin)
-- SELECT nex_handle, hq_role FROM public.nex_account WHERE hq_role IS NOT NULL;
--
-- -- 3. Positive test · country_moderator:IE is now accepted (TEST only · do not commit)
-- -- BEGIN;
-- --   UPDATE public.nex_account SET hq_role='country_moderator:IE' WHERE nex_handle='nex-90001';
-- --   SELECT nex_handle, hq_role FROM public.nex_account WHERE nex_handle='nex-90001';  -- expect updated
-- -- ROLLBACK;
--
-- -- 4. Negative test · bad format rejected
-- -- UPDATE public.nex_account SET hq_role='country_moderator:XXX' WHERE nex_handle='nex-90001';
-- --   → should fail with CHECK violation
-- -- UPDATE public.nex_account SET hq_role='country_moderator:ie' WHERE nex_handle='nex-90001';
-- --   → should fail (lowercase)

-- ---------------------------------------------------------------------------
-- Rollback (not part of this migration)
-- ---------------------------------------------------------------------------
-- BEGIN;
-- -- Refuse rollback if any row currently uses country_moderator (would corrupt it)
-- DO $$ BEGIN
--   IF EXISTS (SELECT 1 FROM public.nex_account WHERE hq_role LIKE 'country_moderator:%') THEN
--     RAISE EXCEPTION 'Migration 255 rollback REFUSED · existing country_moderator rows would violate the restored CHECK. Clear them first (UPDATE SET hq_role=NULL WHERE hq_role LIKE ''country_moderator:%'').';
--   END IF;
-- END $$;
-- ALTER TABLE public.nex_account DROP CONSTRAINT nex_account_hq_role_check;
-- ALTER TABLE public.nex_account ADD CONSTRAINT nex_account_hq_role_check
--   CHECK (((hq_role = ANY (ARRAY['reviewer'::text, 'admin'::text])) OR (hq_role IS NULL)));
-- DELETE FROM public.nex_migration_history WHERE version='255';
-- COMMIT;
