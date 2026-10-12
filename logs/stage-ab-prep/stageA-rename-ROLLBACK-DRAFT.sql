-- logs/stage-ab-prep/stageA-rename-ROLLBACK-DRAFT.sql
--
-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  Stage A rename · ROLLBACK · DRAFT · NOT APPLIED                     ║
-- ║  ------------------------------------------------------------------  ║
-- ║  Companion to stageA-rename-FORWARD-DRAFT.sql. Only valid WHILE      ║
-- ║  the public._stageA_rename_snapshot_2026_10_13 scratch table         ║
-- ║  still exists AND contains the 246 pre-rename rows.                  ║
-- ║                                                                      ║
-- ║  Safety: never operates on canonical rows that were NOT touched by   ║
-- ║  the forward rename · the rollback is scoped by the snapshot's       ║
-- ║  canonical_business_id list, not by a slug match. If a row was       ║
-- ║  further-edited between forward-apply and rollback (unlikely but    ║
-- ║  possible if an operator ran a hotfix), the rollback preserves the   ║
-- ║  edits for every slug OTHER than 'clothes' and surgically restores   ║
-- ║  the 'coat-seller' token in its original slot.                       ║
-- ╚══════════════════════════════════════════════════════════════════════╝

BEGIN;

-- ── Step 1 · pre-flight sanity gate ──────────────────────────────────
DO $$
DECLARE
  snap_exists bool;
  snap_count int;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='public'
       AND table_name='_stageA_rename_snapshot_2026_10_13'
  ) INTO snap_exists;
  IF NOT snap_exists THEN
    RAISE EXCEPTION 'STOP · snapshot table _stageA_rename_snapshot_2026_10_13 does not exist · rollback cannot proceed safely';
  END IF;

  SELECT COUNT(*) INTO snap_count FROM public._stageA_rename_snapshot_2026_10_13;
  RAISE NOTICE 'rollback · snapshot rows available: %', snap_count;
  IF snap_count = 0 THEN
    RAISE EXCEPTION 'STOP · snapshot table is empty · no rollback target';
  END IF;
END$$;

-- ── Step 2 · the inverse rename ──────────────────────────────────────
-- Restore 'coat-seller' into every canonical row that was in the
-- snapshot (joined by canonical_business_id so we only touch the
-- original 246 rows, never a wider set).
--
-- array_replace is used again · it will swap 'clothes' back to
-- 'coat-seller' ONLY in rows whose category_ids currently contains
-- 'clothes'. If a row has been further edited to remove 'clothes'
-- after the forward rename, the rollback leaves it alone (safer than
-- forcibly re-inserting a stale slug).

UPDATE nex.business_canonical bc
   SET category_ids = array_replace(bc.category_ids, 'clothes', 'coat-seller')
  FROM public._stageA_rename_snapshot_2026_10_13 s
 WHERE bc.canonical_business_id = s.canonical_business_id
   AND 'clothes' = ANY(bc.category_ids);

-- ── Step 3 · post-rollback verification ──────────────────────────────
DO $$
DECLARE
  cnt_coat_after int;
  cnt_clothes_after int;
  cnt_matched_snapshot int;
  cnt_duplicates int;
BEGIN
  SELECT COUNT(*) INTO cnt_coat_after
    FROM nex.business_canonical WHERE 'coat-seller' = ANY(category_ids);
  SELECT COUNT(*) INTO cnt_clothes_after
    FROM nex.business_canonical WHERE 'clothes'     = ANY(category_ids);
  SELECT COUNT(*) INTO cnt_matched_snapshot
    FROM nex.business_canonical bc
    JOIN public._stageA_rename_snapshot_2026_10_13 s
      ON s.canonical_business_id = bc.canonical_business_id
   WHERE 'coat-seller' = ANY(bc.category_ids);
  SELECT COUNT(*) INTO cnt_duplicates
    FROM nex.business_canonical
   WHERE cardinality(category_ids) <> cardinality(ARRAY(SELECT DISTINCT unnest(category_ids)));

  RAISE NOTICE 'post-rollback · coat-seller rows: %', cnt_coat_after;
  RAISE NOTICE 'post-rollback · clothes rows:     %', cnt_clothes_after;
  RAISE NOTICE 'post-rollback · matched-snapshot rows: %', cnt_matched_snapshot;
  RAISE NOTICE 'post-rollback · duplicate-slug rows: % (expected 0)', cnt_duplicates;

  IF cnt_duplicates <> 0 THEN
    RAISE EXCEPTION 'STOP · % rows now have duplicate slugs · investigate before COMMIT', cnt_duplicates;
  END IF;
END$$;

COMMIT;

-- ── Operator post-rollback tasks ─────────────────────────────────────
-- 1. Decide whether to DROP the snapshot table or keep it as audit
--    evidence. Default: keep it until the deployment incident is
--    closed. The table has no FK, is additive-only, and does not
--    affect any application code path.
--
--    To drop manually when the incident is closed:
--      DROP TABLE public._stageA_rename_snapshot_2026_10_13;
--
-- 2. Re-run scripts/audit-stage0-production-baseline.mjs and confirm
--    orphan_ids_fingerprint and canonical_slugs_fingerprint are both
--    byte-identical to the pre-forward baseline (2026-10-13).
--
-- 3. Revert the companion code commit via git revert · the metadata
--    entry and walker slug restoration MUST happen in lockstep with
--    this SQL rollback.
