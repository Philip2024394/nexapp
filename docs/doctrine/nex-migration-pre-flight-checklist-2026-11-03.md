# NEX Migration + Seed Pre-flight Checklist

**Owner-sealed 2026-11-03 · Engineering Quality Correction directive.**

Nine of ten NEX schema+seed failures this session were caused by
skipping this list. Every row below is "do this BEFORE writing the
migration file". The 2026-11-03 Wexford slug incident (migration 271
assumed `slug='wexford'` but the sealed slug was `county-wexford` ·
42 orphan rows) is the single-sentence case study.

## 1 · Read the sealed migrations your change depends on

- **Grep for the table name** in `nex-supabase/migrations/*.sql` · read EVERY migration that touches it, oldest first.
- **Specifically note** CHECK constraints · partial unique indexes · default values · FK ON-DELETE actions · NOT NULL columns · trigger-maintained columns.
- Example you'll miss if you skip: `nex_community_zone.slug` has `ck_zone_slug_shape` (migration 146) · `uq_zone_parent_slug` is PARTIAL on `WHERE parent_zone_id IS NOT NULL` (ON CONFLICT inference REQUIRES the WHERE clause too).

## 2 · Verify actual column names and NOT NULL constraints

- `nex_community_membership` has FIVE NOT NULL preference columns added by migration 149 (`safety_pref · lost_found_pref · events_pref · voting_pref · life_news_pref`). Any INSERT must set all five.
- Run `\d <table>` (or equivalent) BEFORE writing INSERT · don't guess.

## 3 · Verify existing identifiers and slug conventions

- Query live state before referencing an identifier:
  ```sql
  SELECT id, slug FROM nex_community_zone
   WHERE country='IE' AND level='city' AND name ILIKE 'wex%';
  ```
- **Never assume** slug shape · migration 266 uses `county-wexford` not `wexford`. Migration 147 uses `kota-yogyakarta` not `yogyakarta`. Each seed file documents its own slug convention · READ IT.

## 4 · Check foreign-key relationships and affected rows

- If you're DELETE or UPDATE'ing: enumerate referencing rows FIRST.
- `nex_community_zone(id)` is referenced by `nex_community_membership.hyperlocal_zone_id` as `ON DELETE RESTRICT` · you cannot drop a zone that has members. Delete the memberships first, OR cascade manually in the server action.
- `nex_account(id)` is referenced by many tables with varied ON-DELETE semantics · always check.

## 5 · Verify the operation is safe to repeat

- EVERY seed migration MUST be idempotent · use `ON CONFLICT ... DO NOTHING` or `ON CONFLICT ... DO UPDATE`. The `ON CONFLICT` target must match an actual constraint INCLUDING its WHERE clause if partial:
  ```sql
  ON CONFLICT (parent_zone_id, slug) WHERE parent_zone_id IS NOT NULL DO NOTHING
  ```
  Not just `ON CONFLICT (parent_zone_id, slug)`.
- Test re-apply in dev · a single successful run isn't proof of idempotence.

## 6 · Check consequences for existing data BEFORE applying

- Will your migration orphan rows? (missing parent FK · mis-slugged WITH clause returning no rows · all NULLs)
- Will it leave the DB in a half-valid state if it fails mid-way? Wrap in a transaction if any doubt.
- If you're changing an existing row's parent/slug, record the pre-state in a backup table or scratch log before the UPDATE.

## 7 · The DRAFT guard convention

Every migration file ships with:
```sql
-- Apply guard
DO $$ BEGIN
  RAISE EXCEPTION 'Migration <version> is DRAFT · comment out this block before applying.';
END $$;
```
Apply scripts strip this block client-side at apply time (see
`scripts/apply-migration-*.mjs`). The sealed convention is "keep the
guard in the committed file" · do not commit a migration without it.

## 8 · Verify the project ID before any write

Every apply script does:
```js
if (!url?.includes("ijvqdvsvwtwxzcqmoqit")) process.exit(3);
```
Sealed Supabase project per CLAUDE.md §8. **Never bypass this guard.**

## 9 · Preserve + prove the apply

- Log the applied migration in `nex_migration_history (version, description, applied_at)` from inside the migration itself.
- Apply script should print the inserted history row + a sanity-count of changed rows AFTER applying.
- If you discovered a bug AFTER applying (e.g. 2026-11-03 Wexford slug mismatch), write a FIX-UP script that is idempotent and read-only until it finds something to repair.

## Pre-flight checklist (copy to the top of your apply script PR)

```
[ ] Read every prior migration that touches the table(s)
[ ] CHECK constraints noted · partial indexes noted · NOT NULL cols noted
[ ] Identifiers (slug/id) verified via live query
[ ] FK impact enumerated (rows that would break)
[ ] Idempotent (ON CONFLICT target + WHERE clause match a real constraint)
[ ] Transaction-safe if multi-statement
[ ] DRAFT guard present at top of migration file
[ ] Apply script verifies ijvqdvsvwtwxzcqmoqit before connecting
[ ] Apply script writes nex_migration_history on success
[ ] Dry-run on a test transaction first (BEGIN; ...migration...; ROLLBACK;)
```

## 2026-11-03 Wexford case study (preserve for training)

- Migration 271 WITH clause: `WHERE country='IE' AND level='city' AND slug='wexford'`
- Actual slug per migration 266 line 76+ : `'county-wexford'`
- Subquery returned 0 rows · INSERT ran with `parent_zone_id=NULL` for all 42 rows
- Rows orphaned (ON CONFLICT inference against partial index also tripped — fixed with WHERE clause addition)
- Fix-up: `scripts/fix-wexford-orphans.mjs` re-parented all 42 rows at the correct id
- Final verified state (via `scripts/investigate-wexford.mjs` 2026-11-03): 42 rows under the Wexford county zone · 0 orphans remaining · 0 affected memberships · no further data change needed
- Migration 271 file corrected to use `county-wexford` slug for future replays
- **Lesson**: 10 seconds of pre-query would have caught this before 90 minutes of fix-up + session churn.
