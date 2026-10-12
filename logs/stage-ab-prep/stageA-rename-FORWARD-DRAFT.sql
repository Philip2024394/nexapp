-- logs/stage-ab-prep/stageA-rename-FORWARD-DRAFT.sql
--
-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Stage A rename · FORWARD · DRAFT · NOT APPLIED                      ║
-- ║  ------------------------------------------------------------------  ║
-- ║  Lives in logs/stage-ab-prep/ (not nex-supabase/migrations/) so no   ║
-- ║  automated runner picks it up. When Stage A is authorised, the      ║
-- ║  operator renames to nex-supabase/migrations/188_stageA_rename_...   ║
-- ║  AFTER:                                                              ║
-- ║    · the schema delta is reviewed line-by-line                       ║
-- ║    · the point-in-time Supabase snapshot is captured                 ║
-- ║    · scripts/audit-stage0-production-baseline.mjs is re-run and      ║
-- ║      produces the same two fingerprints as 2026-10-13                 ║
-- ║                                                                      ║
-- ║  This file only renames ONE slug on canonical rows (coat-seller →    ║
-- ║  clothes · 246 rows). The 4 "-v2" variants and 3 alias-splits are    ║
-- ║  metadata-only (zero DB writes · handled in the companion code       ║
-- ║  commit).                                                            ║
-- ║                                                                      ║
-- ║  Target database: Supabase · public database · schema nex.           ║
-- ║  Target table:    nex.business_canonical                             ║
-- ║  Date drafted:    2026-10-13                                         ║
-- ║  Author:          Phase A audit                                      ║
-- ╚══════════════════════════════════════════════════════════════════════╝

BEGIN;

-- ── Step 1 · pre-flight snapshot ─────────────────────────────────────
-- Capture the before-state in a scratch table so the operator can
-- (a) verify counts post-apply, (b) rollback by diffing current state
-- against the snapshot. The scratch table lives in the public schema
-- rather than nex. because it is operator-visible admin ephemera · not
-- part of the sealed canonical layer. Named with a date suffix so a
-- re-apply at a later date does not collide.

CREATE TABLE IF NOT EXISTS public._stageA_rename_snapshot_2026_10_13 (
  canonical_business_id uuid PRIMARY KEY,
  category_ids_before text[] NOT NULL,
  category_ids_after  text[],
  snapshotted_at timestamptz NOT NULL DEFAULT now()
);

-- Capture every row that currently carries 'coat-seller' in its
-- category_ids. Only the 246 rows the rename will touch · never
-- a wider scope.
INSERT INTO public._stageA_rename_snapshot_2026_10_13 (canonical_business_id, category_ids_before)
SELECT canonical_business_id, category_ids
  FROM nex.business_canonical
 WHERE 'coat-seller' = ANY(category_ids)
ON CONFLICT (canonical_business_id) DO NOTHING;

-- ── Step 2 · pre-flight sanity gate ──────────────────────────────────
-- Fail loudly if the environment doesn't match expectations. These are
-- the exact values Stage 0 + Stage A captured on 2026-10-13.
DO $$
DECLARE
  cnt_coat_before int;
  cnt_clothes_before int;
  cnt_snapshot int;
BEGIN
  SELECT COUNT(*) INTO cnt_coat_before
    FROM nex.business_canonical WHERE 'coat-seller' = ANY(category_ids);
  SELECT COUNT(*) INTO cnt_clothes_before
    FROM nex.business_canonical WHERE 'clothes'     = ANY(category_ids);
  SELECT COUNT(*) INTO cnt_snapshot
    FROM public._stageA_rename_snapshot_2026_10_13;

  RAISE NOTICE 'pre-flight · coat-seller rows: %', cnt_coat_before;
  RAISE NOTICE 'pre-flight · clothes rows:     %', cnt_clothes_before;
  RAISE NOTICE 'pre-flight · snapshot rows:    %', cnt_snapshot;

  IF cnt_coat_before <> 246 THEN
    RAISE EXCEPTION 'STOP · coat-seller count is %, expected 246 (Stage A baseline drifted)', cnt_coat_before;
  END IF;
  IF cnt_snapshot <> cnt_coat_before THEN
    RAISE EXCEPTION 'STOP · snapshot captured % rows, expected %', cnt_snapshot, cnt_coat_before;
  END IF;
END$$;

-- ── Step 3 · the rename ──────────────────────────────────────────────
-- array_replace is atomic per row. It leaves other category_ids
-- entries untouched · a row with ['coat-seller','products'] becomes
-- ['clothes','products']. No duplicates created · if a row already had
-- 'clothes' in category_ids (none do today, per the snapshot), the
-- array_replace would still produce an array with 'clothes' twice.
-- Guard below rejects that case.

UPDATE nex.business_canonical
   SET category_ids = array_replace(category_ids, 'coat-seller', 'clothes')
 WHERE 'coat-seller' = ANY(category_ids);

-- Capture the after-state into the same snapshot table (row-matched
-- by canonical_business_id).
UPDATE public._stageA_rename_snapshot_2026_10_13 s
   SET category_ids_after = bc.category_ids
  FROM nex.business_canonical bc
 WHERE bc.canonical_business_id = s.canonical_business_id;

-- ── Step 4 · post-flight verification ────────────────────────────────
DO $$
DECLARE
  cnt_coat_after int;
  cnt_clothes_after int;
  cnt_duplicates int;
  cnt_snapshot_mismatch int;
BEGIN
  SELECT COUNT(*) INTO cnt_coat_after
    FROM nex.business_canonical WHERE 'coat-seller' = ANY(category_ids);
  SELECT COUNT(*) INTO cnt_clothes_after
    FROM nex.business_canonical WHERE 'clothes'     = ANY(category_ids);
  SELECT COUNT(*) INTO cnt_duplicates
    FROM nex.business_canonical
   WHERE cardinality(category_ids) <> cardinality(ARRAY(SELECT DISTINCT unnest(category_ids)));
  SELECT COUNT(*) INTO cnt_snapshot_mismatch
    FROM public._stageA_rename_snapshot_2026_10_13 s
   WHERE s.category_ids_after IS NULL;

  RAISE NOTICE 'post-flight · coat-seller rows: % (expected 0)',   cnt_coat_after;
  RAISE NOTICE 'post-flight · clothes rows:     % (expected 246)', cnt_clothes_after;
  RAISE NOTICE 'post-flight · duplicate-slug rows: % (expected 0)', cnt_duplicates;
  RAISE NOTICE 'post-flight · unmatched snapshot rows: % (expected 0)', cnt_snapshot_mismatch;

  IF cnt_coat_after <> 0 THEN
    RAISE EXCEPTION 'STOP · coat-seller rows remain after UPDATE · rollback required';
  END IF;
  IF cnt_clothes_after <> 246 THEN
    RAISE EXCEPTION 'STOP · clothes rows after = %, expected 246', cnt_clothes_after;
  END IF;
  IF cnt_duplicates <> 0 THEN
    RAISE EXCEPTION 'STOP · % rows now have duplicate slugs in category_ids', cnt_duplicates;
  END IF;
END$$;

COMMIT;

-- ── Operator post-apply tasks (NOT part of this SQL) ─────────────────
-- 1. Re-run scripts/audit-stage0-production-baseline.mjs.
-- 2. Confirm orphan_ids_fingerprint is byte-identical to 2026-10-13.
-- 3. Confirm canonical_slugs_fingerprint has changed (new slug set).
-- 4. Record both fingerprints in the deployment log.
-- 5. Deploy the companion code commit (metadata entries removed,
--    walker config updated · see logs/stage-ab-prep/stageA-code-commit-plan.md).
--
-- ── Rollback ─────────────────────────────────────────────────────────
-- See companion file: stageA-rename-ROLLBACK-DRAFT.sql
