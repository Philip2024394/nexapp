-- ============================================================================
-- NEX Migration 248 · storage.objects country-prefix RLS + path rename plan
-- ============================================================================
--
-- STATUS: DRAFT · NOT YET APPLIED TO ANY DATABASE.
--
-- Owner-authorised preparation only (NEX OWNER RESPONSE — W-1 THROUGH W-9,
-- 2026-10-31 · 7-migration path · W-5 "checkout independently decides
-- eligibility · visibility is never proof of purchasability"). 248 is
-- the last migration in the sequence · changes behaviour at the storage
-- layer.
--
-- Purpose:
--   Install Supabase Storage RLS policies on `nex-business-assets` so
--   file paths are country-prefixed (`{IE|ID}/{businessId}/{filename}`).
--   Policies restrict reads to the viewer's current `nex.app_country`
--   plus a `WORLDWIDE`-visibility branch to mirror the application-side
--   RLS. The pre-existing `nex-music-media` bucket is NOT changed by this
--   migration (sealed music doctrine stays as-is).
--
-- Dependencies:
--   · 244 + 246 (nex_business.country must exist and be populated) ·
--     needed to compute each row's expected prefix.
--   · 247 (nex_business.visibility must exist) · the WORLDWIDE branch
--     references it.
--   · 245 (application RLS must be live) · otherwise storage would deny
--     access that the application-side still permits · broken UX.
--
-- Scope of this migration:
--   · Install 2 RLS policies on storage.objects (SELECT + INSERT) scoped
--     to the `nex-business-assets` bucket.
--   · Path-rename plan for existing objects (expressed as a documented
--     procedure · the physical rename is a SEPARATE scripted job because
--     storage.objects renames are not transactional with application
--     tables in all setups).
--   · Update `nex_business.qr_code_image_url` + `.logo_url` where the
--     stored path matches the old shape.
--
-- NOT in scope:
--   · nex-music-media bucket (sealed H2 doctrine)
--   · Signed URL re-minting (the operator revokes + re-mints via a
--     separate script after apply)
--   · CDN cache invalidation (environment-specific operational step)
--
-- Risk level: HIGH (path renames observable to CDN caches · in-flight
--   signed URLs become unreachable · operational verification required).
--
-- ============================================================================

BEGIN;

-- Apply guard
DO $$
BEGIN
  RAISE EXCEPTION 'Migration 248 is DRAFT · requires explicit owner authorisation naming this file to apply. Verify 244+246+247+245 applied and the path-rename script has been run or will be run alongside.';
END $$;

-- ---------------------------------------------------------------------------
-- Pre-flight
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nex_business' AND column_name='country';
  IF NOT FOUND THEN RAISE EXCEPTION 'Migration 248 refused: nex_business.country missing · apply 244 first.'; END IF;
  PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nex_business' AND column_name='visibility';
  IF NOT FOUND THEN RAISE EXCEPTION 'Migration 248 refused: nex_business.visibility missing · apply 247 first.'; END IF;
  PERFORM 1 FROM pg_policy WHERE polrelid='public.nex_business'::regclass;
  IF NOT FOUND THEN RAISE EXCEPTION 'Migration 248 refused: nex_business has no RLS policies · apply 245 first.'; END IF;

  -- Zero-NULL invariant · 246 complete
  IF EXISTS (SELECT 1 FROM public.nex_business WHERE country IS NULL) THEN
    RAISE EXCEPTION 'Migration 248 refused: nex_business has rows with NULL country · 246 did not complete.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- storage.objects · SELECT policy on nex-business-assets
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS nex_business_assets_country_select ON storage.objects;
CREATE POLICY nex_business_assets_country_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'nex-business-assets'
    AND public.nex_current_app_country() IS NOT NULL
    AND (
      -- Branch 1 · path starts with the viewer's current country prefix
      (storage.foldername(name))[1] = public.nex_current_app_country()
      -- Branch 2 · the asset belongs to a WORLDWIDE business (public discovery)
      OR EXISTS (
        SELECT 1 FROM public.nex_business b
         WHERE b.id::text = (storage.foldername(name))[2]
           AND b.visibility = 'WORLDWIDE'
           AND b.status = 'active'
           AND b.moderation_status = 'ok'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- storage.objects · INSERT policy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS nex_business_assets_country_insert ON storage.objects;
CREATE POLICY nex_business_assets_country_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'nex-business-assets'
    AND public.nex_current_app_country() IS NOT NULL
    AND (storage.foldername(name))[1] = public.nex_current_app_country()
    -- Owner-of-business check at app level · storage cannot enforce it alone
  );

-- UPDATE and DELETE on storage.objects for this bucket · service_role only
-- (Supabase's default; no additional policy means no authenticated writes
-- except INSERT which is governed above).

-- ---------------------------------------------------------------------------
-- Path rename · DOCUMENTED PROCEDURE (not executed by this migration)
-- ---------------------------------------------------------------------------
-- Rename every existing object in nex-business-assets from
--   {businessId}/<rest>
-- to
--   {country}/{businessId}/<rest>
-- where {country} = (SELECT country FROM nex_business WHERE id = businessId).
--
-- Procedure (external script · pseudocode):
--   1. SELECT id, country FROM nex_business
--   2. For each business, LIST storage.objects WHERE name LIKE businessId || '/%'
--   3. For each object · COPY to new path (`{country}/` + old name) · verify
--      byte-size match · DELETE original
--   4. On error, log and continue · idempotent re-run safe (COPY of already-
--      renamed object → no-op path check)
--
-- Why not inline this in the migration:
--   · storage.objects writes bypass SQL transactions · a mid-transaction
--     failure can leave the DB and storage out of sync. External script
--     controls error handling and resumption.
--   · The storage API is the right tool · not raw storage.objects rows.
--
-- The rename script lands as `scripts/nex-storage-country-rename-2026-10-31.ts`
-- in a SEPARATE commit when owner authorises the storage change. Not drafted
-- in this migration file.

-- ---------------------------------------------------------------------------
-- Update stored URLs in nex_business for renamed paths
-- ---------------------------------------------------------------------------
-- Only run AFTER the rename script has moved the files. Column names below
-- assumed from current schema; verify at install.
-- These UPDATEs are safe to run in this migration IF the rename script has
-- already executed. If it hasn't, the policy's Branch 1 will deny access to
-- the un-renamed paths — fail-closed, as intended.
--
-- To be enabled by uncommenting after the rename script completes:
--
-- UPDATE public.nex_business
--    SET qr_code_image_url = regexp_replace(qr_code_image_url,
--                              '^(.*/nex-business-assets/)(' || id::text || '/)',
--                              '\1' || country || '/\2')
--  WHERE qr_code_image_url ~ ('/nex-business-assets/' || id::text || '/');
-- UPDATE public.nex_business
--    SET logo_url = regexp_replace(logo_url,
--                      '^(.*/nex-business-assets/)(' || id::text || '/)',
--                      '\1' || country || '/\2')
--  WHERE logo_url ~ ('/nex-business-assets/' || id::text || '/');

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------
INSERT INTO public.nex_migration_history (version, description, applied_at)
VALUES (
  '248',
  'storage.objects RLS on nex-business-assets · 2 policies (SELECT + INSERT) · country prefix + WORLDWIDE branch. External path-rename script required separately. nex-music-media untouched.',
  now()
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- Rollback (not part of this migration · path rename is NOT reversed)
-- ---------------------------------------------------------------------------
-- BEGIN;
-- DO $$ BEGIN
--   IF session_user NOT IN ('postgres','supabase_admin') THEN
--     RAISE EXCEPTION 'Migration 248 rollback REFUSED · session_user=%', session_user;
--   END IF;
-- END $$;
-- DROP POLICY IF EXISTS nex_business_assets_country_select ON storage.objects;
-- DROP POLICY IF EXISTS nex_business_assets_country_insert ON storage.objects;
-- -- Note · the physical path rename is NOT reversed by SQL rollback.
-- -- A separate reverse-rename script would be required if we need to
-- -- return objects to their original paths · costly and operationally
-- -- fraught (same CDN cache + signed URL issues as the forward direction).
-- DELETE FROM public.nex_migration_history WHERE version = '248';
-- COMMIT;
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Positive / negative tests
-- ---------------------------------------------------------------------------
-- POS-T248-1 · As IE viewer with nex.app_country='IE', download object
--              `IE/<businessId>/image.png` where business.country='IE' → 200.
-- NEG-T248-2 · As IE viewer, download `ID/<businessId>/image.png` where
--              business.visibility='COUNTRY' → 404.
-- POS-T248-3 · As IE viewer, download `ID/<businessId>/image.png` where
--              business.visibility='WORLDWIDE' AND status='active' AND
--              moderation_status='ok' → 200.
-- NEG-T248-4 · As IE viewer with nex.app_country='', download any object → 404.
-- NEG-T248-5 · INSERT object at path `ID/<businessId>/x.png` from IE
--              deployment → policy denies.
-- POS-T248-6 · service_role INSERT at any path → succeeds (bypasses RLS).
-- ---------------------------------------------------------------------------
