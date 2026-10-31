# NEX · Migrations 244-248 · Individual Proposals · 2026-10-31

**Status**: DRAFT proposals · CI-4 condition satisfied.
**Owner directive verbatim**: *"Present each migration separately with: Purpose · Tables affected · Data backfill · RLS changes · Rollback approach · Risks and verification queries. Each production migration requires separate owner authorisation."*
**Hard boundary**: nothing in this doc authorises production application. Each migration listed here is a **PROPOSAL** awaiting individual owner authorisation.

Current state of the 244-248 slot:
- `244_nex_country_column.sql` DRAFT · over-scoped at 37 tables · reissue required per 99-table audit
- `245_nex_country_rls.sql` DRAFT · needs rewrite under visibility-OR-country semantics
- 246 / 247 / 248 not yet drafted

This doc is the plan for all five. Actual `.sql` files land in a follow-up commit AFTER owner acceptance.

---

## Migration 244 (REISSUED) · country column on 4 anchor tables

**Purpose**: Add `country text NULL` to the four tables that OWN a country column (per `nex-99-table-classification-2026-10-31.md`). Everything else inherits via FK.

**Tables affected (4 only · not 37)**:
1. `public.nex_business`
2. `public.nex_community_zone`
3. `public.nex_live_session`
4. `public.nex_report`

**Data backfill**: NONE in this migration. Column is nullable · existing rows get NULL. Backfill is Migration 246 (separate authorisation).

**RLS changes**: NONE in this migration. Policies added in Migration 245 after column exists.

**Rollback approach**:
```sql
BEGIN;
  ALTER TABLE public.nex_business DROP COLUMN IF EXISTS country;
  ALTER TABLE public.nex_community_zone DROP COLUMN IF EXISTS country;
  ALTER TABLE public.nex_live_session DROP COLUMN IF EXISTS country;
  ALTER TABLE public.nex_report DROP COLUMN IF EXISTS country;
  DELETE FROM public.nex_migration_history WHERE version = '244';
COMMIT;
```
Trivial · zero data loss (existing columns untouched).

**Risks**:
- **Low**: adding a nullable column is a non-blocking operation in Postgres · zero downtime.
- **Medium**: downstream code paths that enumerate columns (`SELECT *`) will see the new column immediately · must not misinterpret NULL as "no data".
- **Zero**: no RLS change, no visibility change, no behavioural change.

**Verification queries**:
```sql
-- Column exists + nullable
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('nex_business','nex_community_zone','nex_live_session','nex_report')
  AND column_name='country'
ORDER BY table_name;

-- Count of NULL vs non-NULL (expect 100% NULL post-apply)
SELECT 'nex_business' AS t, count(*) FILTER (WHERE country IS NULL) AS null_rows, count(*) FILTER (WHERE country IS NOT NULL) AS set_rows FROM public.nex_business
UNION ALL SELECT 'nex_community_zone', count(*) FILTER (WHERE country IS NULL), count(*) FILTER (WHERE country IS NOT NULL) FROM public.nex_community_zone
UNION ALL SELECT 'nex_live_session', count(*) FILTER (WHERE country IS NULL), count(*) FILTER (WHERE country IS NOT NULL) FROM public.nex_live_session
UNION ALL SELECT 'nex_report', count(*) FILTER (WHERE country IS NULL), count(*) FILTER (WHERE country IS NOT NULL) FROM public.nex_report;

-- Ledger
SELECT version, description FROM public.nex_migration_history WHERE version='244';
```

**Pre-reqs**: none. Can be applied in isolation.

---

## Migration 245 (REISSUED) · country-aware RLS with visibility-OR-country semantics

**Purpose**: Install RLS policies on the 4 anchor tables + the ~32 CO-I tables that inherit country via FK join. Replace the current `USING (true)` policy on `nex_business` (owner-flagged gap) with proper gates.

**Write policy** (strict · deployment can only create in its own country):
```sql
WITH CHECK (
  current_setting('nex.app_country', true) IS NOT NULL
  AND current_setting('nex.app_country', true) <> ''
  AND country = current_setting('nex.app_country', true)
)
```

**Read policy** (visibility-OR-country · new per global content doctrine):
```sql
USING (
  -- Same-country match
  country = current_setting('nex.app_country', true)
  -- OR visibility is cross-country-permissive
  OR visibility = 'WORLDWIDE'
  OR (
    visibility = 'SELECTED_COUNTRIES'
    AND current_setting('nex.app_country', true) = ANY(selected_countries)
  )
  OR (visibility = 'FOLLOWERS' AND EXISTS (
    SELECT 1 FROM public.nex_friend_edge
    WHERE a_account_id = auth.uid() AND b_account_id = <owner>
  ))
  -- (further scopes resolved similarly)
)
```

The `visibility` column + `selected_countries` array come from Migration 247 · so **245 can only apply AFTER 247**.

**Tables affected**:
- The 4 anchor tables: `nex_business`, `nex_community_zone`, `nex_live_session`, `nex_report`
- ~32 CO-I tables: policies JOIN via FK to one of the 4 anchors
- Public-discovery exception for `nex_business` where `visibility='WORLDWIDE'`

**Data backfill**: NONE. Policies are stateless once applied.

**RLS changes**: 148+ policies created (37 tables × 4 commands + a few exceptions).

**Rollback approach**:
```sql
BEGIN;
  -- Drop all country policies by naming convention
  DO $$
  DECLARE p record;
  BEGIN
    FOR p IN SELECT polname, polrelid::regclass::text AS tbl FROM pg_policy
             WHERE polname LIKE '%_country_%'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %s', p.polname, p.tbl);
    END LOOP;
  END $$;
  DELETE FROM public.nex_migration_history WHERE version='245';
COMMIT;
```

**Risks**:
- **HIGH** · if the backfill (246) hasn't completed and `country IS NULL` for most rows, those rows become invisible to EVERYONE after 245 applies. **245 must not apply before 246 reaches 100% coverage.**
- **MEDIUM** · policies that JOIN via FK to parent tables are slower than direct column reads. Mitigation: for the 4 anchor tables, use direct column; for CO-I tables, benchmark on realistic data before go-live.
- **LOW** · `current_setting` must be set on EVERY connection. The deployment pipeline needs a connection-init hook (per plan §2 of country-isolation doc). Missing hook = fail-closed denial · observable immediately in dev.

**Verification queries**:
```sql
-- Policy count per table
SELECT polrelid::regclass AS tbl, count(*) AS policies
FROM pg_policy
WHERE polname LIKE '%country%' OR polname LIKE '%visibility%'
GROUP BY polrelid
ORDER BY tbl;

-- Cross-country isolation smoke test (run as authenticated IE user)
SET LOCAL nex.app_country = 'IE';
SELECT count(*) FROM public.nex_business;  -- should NOT include country='ID' rows unless visibility='WORLDWIDE'
RESET nex.app_country;

-- Fail-closed check (empty setting)
SET LOCAL nex.app_country = '';
SELECT count(*) FROM public.nex_business;  -- MUST return 0 (fail-closed)
```

**Pre-reqs**: 244 (country column) + 246 (backfill complete · 0 NULL rows) + 247 (visibility column + enum type).

**NB** · the order is 244 → 246 → 247 → 245 → 248. Owner's "244-248" ordinal is for FILENAME convenience, NOT apply-order.

---

## Migration 246 · backfill country for existing rows

**Purpose**: Fill the `country` column on all existing rows in the 4 anchor tables. All existing data was created under dev-impersonation of Indonesian personas → safest baseline is `'ID'` for every pre-existing row.

**Tables affected**: Same 4 anchor tables as 244 · reading rows and setting `country`.

**Backfill rule (default)**:
```sql
UPDATE public.nex_business
   SET country = 'ID'
 WHERE country IS NULL;
-- same for nex_community_zone, nex_live_session, nex_report
```

Rationale: 100% of production data (actually dev data, since migrations haven't shipped anywhere else) was created under NEX_DEV_IMPERSONATE_HANDLE pointed at ID personas (nex-99901, nex-50001..nex-50024 Indonesian personas). No Irish records exist today. Everything is ID.

**Alternative backfill rule (owner-authorised override)**:
```sql
UPDATE public.nex_business SET country = CASE
  WHEN owner_account_id IN (<explicit Irish-owner list>) THEN 'IE'
  ELSE 'ID'
END WHERE country IS NULL;
```

**RLS changes**: NONE.

**Rollback approach**:
```sql
UPDATE public.nex_business          SET country = NULL WHERE country = 'ID';
UPDATE public.nex_community_zone    SET country = NULL WHERE country = 'ID';
UPDATE public.nex_live_session      SET country = NULL WHERE country = 'ID';
UPDATE public.nex_report            SET country = NULL WHERE country = 'ID';
-- Non-destructive · can be re-run with the original data by re-applying 246
```

**Risks**:
- **MEDIUM** · if any Irish-origin data existed and we blanket-assign ID, we silently misclassify it. Mitigation: run the audit query BEFORE applying, confirm 0 Irish rows exist.
- **LOW** · update locks on `nex_business` are brief · acceptable on current row count (small).

**Verification queries**:
```sql
-- Pre-backfill · how many rows are NULL
SELECT 'nex_business' AS t, count(*) AS null_count FROM public.nex_business WHERE country IS NULL
UNION ALL SELECT 'nex_community_zone', count(*) FROM public.nex_community_zone WHERE country IS NULL
UNION ALL SELECT 'nex_live_session', count(*) FROM public.nex_live_session WHERE country IS NULL
UNION ALL SELECT 'nex_report', count(*) FROM public.nex_report WHERE country IS NULL;

-- Pre-backfill · are there any owners that OWNER wants tagged IE?
-- (Owner specifies a list before 246 applies)

-- Post-backfill · 0 NULL rows
-- Same query as above · all rows must return 0
```

**Pre-reqs**: 244 (column exists).

---

## Migration 247 · visibility column + enum type

**Purpose**: Add the `visibility content_visibility` column (nullable to start · default 'COUNTRY') to tables that need per-record audience scope. Also create the enum type.

**Tables affected (per 99-table audit · GV + CO tables that need per-record scope)**:
- `nex_music_track` · GV · author audience scope per track
- `nex_uploaded_video` · GV · same
- `nex_business` · CO · owner opt-in international discovery
- `nex_product` · CO-I · author scope + separate delivery destinations
- `nex_live_session` · CO · broadcaster audience scope
- `nex_community_notice` · CO-I · address-anchored but may need per-post scope
- `nex_community_card` · CO-I · same

**Data backfill**: default value `'COUNTRY'` means existing rows remain country-only · zero exposure change.

**RLS changes**: NONE in this migration (policies in 245 reference the column).

**Enum type**:
```sql
CREATE TYPE public.content_visibility AS ENUM (
  'PRIVATE',
  'FRIENDS',
  'FOLLOWERS',
  'COUNTRY',
  'SELECTED_COUNTRIES',
  'WORLDWIDE'
);
```

**Additional column for SELECTED_COUNTRIES**:
```sql
ALTER TABLE public.nex_music_track
  ADD COLUMN selected_countries text[] NULL;
-- repeat for all tables that get visibility column
-- selected_countries is NULL unless visibility='SELECTED_COUNTRIES'
-- validated by trigger · see risks
```

**Rollback approach**:
```sql
BEGIN;
  ALTER TABLE public.nex_music_track DROP COLUMN IF EXISTS visibility, DROP COLUMN IF EXISTS selected_countries;
  -- repeat for all 7 tables
  DROP TYPE IF EXISTS public.content_visibility;
  DELETE FROM public.nex_migration_history WHERE version='247';
COMMIT;
```

**Risks**:
- **MEDIUM** · enum types are harder to extend later than text + CHECK constraints. If owner wants more scopes (BUSINESS_ONLY, SUBSCRIBER_ONLY), text + CHECK is more flexible. Owner picks the format.
- **LOW** · a trigger ensures `selected_countries IS NOT NULL ↔ visibility = 'SELECTED_COUNTRIES'`.
- **LOW** · default `'COUNTRY'` means existing tracks + products stay country-scoped · no cross-country exposure change.

**Verification queries**:
```sql
-- Type exists
SELECT typname FROM pg_type WHERE typname = 'content_visibility';

-- Columns exist · all default to 'COUNTRY'
SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema='public'
  AND column_name IN ('visibility','selected_countries')
ORDER BY table_name, column_name;

-- All existing rows start as COUNTRY · no cross-country exposure change
SELECT 'nex_music_track' AS t, visibility, count(*) FROM public.nex_music_track GROUP BY visibility
UNION ALL SELECT 'nex_business', visibility, count(*) FROM public.nex_business GROUP BY visibility;
```

**Pre-reqs**: 244 (country column, so visibility makes sense).

---

## Migration 248 · storage country prefixes

**Purpose**: Install Supabase Storage RLS policies on `nex-business-assets` so file paths are country-prefixed · reads validate the prefix against the user's current app country.

**Tables affected**: `storage.objects` (RLS policies on the storage schema · no application-table changes).

**Backfill**: migrate existing object paths from `{businessId}/...` to `{IE|ID}/{businessId}/...` based on the business's new `country` column.

**RLS changes** (storage policies):
```sql
-- Read: must match current app country or be public-marked
CREATE POLICY nex_business_assets_country_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'nex-business-assets'
    AND (
      -- Path starts with the viewer's current country prefix
      (storage.foldername(name))[1] = current_setting('nex.app_country', true)
      -- OR the asset is explicitly public (public-discovery businesses)
      OR EXISTS (
        SELECT 1 FROM public.nex_business b
        WHERE b.id::text = (storage.foldername(name))[2]
          AND b.visibility = 'WORLDWIDE'
      )
    )
  );

-- Write: must match current app country, service_role bypasses
CREATE POLICY nex_business_assets_country_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'nex-business-assets'
    AND (storage.foldername(name))[1] = current_setting('nex.app_country', true)
  );
```

**Rollback approach**:
```sql
BEGIN;
  DROP POLICY IF EXISTS nex_business_assets_country_read ON storage.objects;
  DROP POLICY IF EXISTS nex_business_assets_country_write ON storage.objects;
  -- Path rename rollback is NOT included · existing data in flight stays prefixed
  DELETE FROM public.nex_migration_history WHERE version='248';
COMMIT;
```

**Risks**:
- **HIGH** · existing object paths need to be renamed. If 248's backfill script errors partway, paths are in a mixed state (some prefixed, some not). Mitigation: migrate paths with explicit per-object try/catch · log every rename · idempotent re-runs.
- **HIGH** · public URLs change (anywhere the old path was embedded breaks). Need to also update stored URLs in `nex_business.qr_code_image_url`, `nex_business.logo_url`, etc.
- **MEDIUM** · PublicUrl signatures change · cache invalidation.
- **MEDIUM** · signed URLs minted BEFORE 248 may become unreachable AFTER.

**Verification queries**:
```sql
-- All objects follow new prefix pattern
SELECT COUNT(*) AS objects_at_root_not_prefixed
FROM storage.objects
WHERE bucket_id = 'nex-business-assets'
  AND (storage.foldername(name))[1] NOT IN ('IE','ID');
-- Expected: 0

-- Policies exist
SELECT polname FROM pg_policy
WHERE polrelid = 'storage.objects'::regclass
  AND polname LIKE 'nex_business_assets_%';
-- Expected: 2 rows
```

**Pre-reqs**: 244 + 246 + 247 all applied · `nex_business.country` populated so the backfill script can rename paths correctly.

---

## Correct apply order (not filename order)

| Order | Migration | Purpose |
|---|---|---|
| 1 | 244 | Country column (nullable) · zero behavioural change |
| 2 | 246 | Backfill all existing rows to `'ID'` (or owner-provided mix) |
| 3 | 247 | Visibility column + enum + selected_countries array |
| 4 | 245 | RLS policies (visibility-OR-country) · requires 244+246+247 complete |
| 5 | 248 | Storage prefix (path rename + storage.objects RLS) |

Each gets separate owner authorisation.

---

## Verification path · what passes before "go-live"

The 12 isolation tests from the country-isolation doctrine + the additional tests per owner CI-5:
- Storage isolation (test 9-10)
- Service-role country checks (unit test on server actions)
- API and server-action isolation
- HQ cross-country administration (test 6-7-11)
- Connection-pool context isolation (new test · pool a request from IE then ID, confirm settings don't leak)

**No "go-live" claim until all tests return green against the sealed Supabase project with real deployment env vars set.**

---

## Owner decisions requested on this doc

Return approve / request change / defer for:

| # | Decision |
|---|---|
| 1 | Reissue 244 with 4-table scope (not 37)? Approve |
| 2 | Backfill rule for 246: blanket `'ID'` for existing rows, OR explicit per-owner list? Approve blanket · request list · defer |
| 3 | Visibility type: PG enum (strict) vs text + CHECK constraint (flexible)? Approve enum · approve text · defer |
| 4 | Storage prefix path rename · attempt + fallback, OR require fresh data? Approve rename · defer |
| 5 | Correct apply order 244 → 246 → 247 → 245 → 248 · confirm each is a SEPARATE owner authorisation gate? Approve · modify |

---

*Migration proposals recorded 2026-10-31. No code change · no migration applied. Each migration requires separate owner authorisation to apply to any database.*
