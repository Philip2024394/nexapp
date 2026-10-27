# NEX · Directory Media View Design + Consumer Audit + Regression Plan · DRAFT · 2026-10-27

> **Status: review-only design · NOT deployed · owner review required before any deploy.**
>
> **Authority**: owner approval 2026-10-27 (I-D3 clarification): "Approve a review-only SQL design, consumer audit and regression plan. The proposed view must use an explicit column allowlist, preserve the four-state image approval progression, and exclude email addresses, phone numbers and personal identifiers unless separately approved. The existing directory view must remain unchanged. No deployment, grants or production schema changes are authorized."
>
> **This document DOES NOT:**
> - Alter `nex.business_directory_v` (SEALED).
> - Create, deploy, materialise, or grant permissions on any new view.
> - Modify production schema.
> - Expose email, phone, or personal identifiers.
>
> **This document DOES:**
> - Propose a sibling view SQL with explicit column allowlist.
> - Audit all current consumers of `business_directory_v`.
> - Propose a regression plan proving current directory behaviour would remain unchanged.

## 1 · Baseline · the sealed view

`nex.business_directory_v` is defined as (verified live 2026-10-27):

```sql
SELECT
  canonical_business_id,
  entity_type,
  country,
  lifecycle_state,
  name_canonical,
  name_norm,
  aliases,
  phone_e164,
  website_apex,
  osm_id,
  wikidata_qid,
  city,
  district,
  street_line,
  neighbourhood,
  address,
  coordinates,
  category_ids,
  services_products,
  supersedes_business_id,
  superseded_by_business_id,
  last_verified_at,
  created_at,
  updated_at
FROM nex.business_canonical bc
WHERE
  lifecycle_state = ANY (ARRAY['VERIFIED','OWNER_CLAIMED','OWNER_VERIFIED'])
  AND superseded_by_business_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM nex.business_evidence be
    JOIN nex.source_registry sr ON sr.source_id = be.source_id
    WHERE be.canonical_business_id = bc.canonical_business_id
      AND sr.can_display = true
  );
```

- Row count live: **40,541**
- Columns: 24 (identity, address, taxonomy, lifecycle metadata)
- **Already contains `phone_e164`** · note: this column is in the current public view. Deliverable #6 does NOT add phone; it is already there. Any decision about restricting it belongs in a separate review round.
- **Does NOT contain** any image reference, email, or personal identifier.

**This view is SEALED and will NOT be altered by this design.**

## 2 · Proposed sibling view · `nex.business_directory_with_media_v`

### 2.1 · Design intent

A new view that:
1. Starts from the exact same base selection as `business_directory_v`.
2. **LEFT JOINs** zero-or-one approved image per business (NEVER the full set).
3. Projects an **explicit column allowlist** · no `SELECT *`, no implicit JOIN column exposure.
4. **Preserves the four-state image approval progression** (`image-states.ts`) as a predicate in the JOIN condition.
5. Explicitly **excludes** email, phone, and personal identifiers unless separately approved.

### 2.2 · Proposed SQL (REVIEW-ONLY · NOT FOR DEPLOYMENT)

```sql
-- REVIEW-ONLY DRAFT · 2026-10-27 · DO NOT EXECUTE
-- Sibling to nex.business_directory_v. Adds zero-or-one approved image
-- per business via LEFT JOIN. Explicit column allowlist.
--
-- Preserves the sealed four-state image progression via the WHERE clause
-- on bm (business_media).
--
-- Excludes:
--   - phone_e164 (currently in parent view; this sibling omits by design
--     per I-D3 "exclude phone numbers unless separately approved")
--   - email (not in schema today anyway; migration 202 unapplied)
--   - any personal identifier
--
-- Column allowlist (23 columns):
--   22 identity/address/taxonomy/lifecycle columns from parent view
--   1 image column (image_url, nullable)

CREATE OR REPLACE VIEW nex.business_directory_with_media_v AS
SELECT
  bc.canonical_business_id,
  bc.entity_type,
  bc.country,
  bc.lifecycle_state,
  bc.name_canonical,
  bc.name_norm,
  bc.aliases,
  -- phone_e164 DELIBERATELY EXCLUDED per I-D3 "exclude phone numbers
  -- unless separately approved" · the parent view carries it; this
  -- sibling does not. If owner wants it included, a separate decision.
  bc.website_apex,
  bc.osm_id,
  bc.wikidata_qid,
  bc.city,
  bc.district,
  bc.street_line,
  bc.neighbourhood,
  bc.address,
  bc.coordinates,
  bc.category_ids,
  bc.services_products,
  bc.supersedes_business_id,
  bc.superseded_by_business_id,
  bc.last_verified_at,
  bc.created_at,
  bc.updated_at,
  -- One approved image per business, via a correlated LEFT JOIN LATERAL
  -- that enforces the sealed four-state image progression. Returns NULL
  -- when no approved image exists · the consumer must render a category-
  -- neutral placeholder (per image doctrine G12).
  bm.image_url
FROM nex.business_canonical bc
LEFT JOIN LATERAL (
  SELECT bm_inner.image_url
  FROM nex.business_media bm_inner
  JOIN nex.source_registry sr_bm ON sr_bm.source_id = bm_inner.source_id
  WHERE
    bm_inner.canonical_business_id = bc.canonical_business_id
    AND bm_inner.approved = true                 -- Aspect 4 admin review
    AND bm_inner.deleted_at IS NULL              -- Aspect 6 removal · requires column add
    AND sr_bm.can_display = true                 -- governance gate
    AND bm_inner.licence_id IS NOT NULL          -- fail-closed per I-D2
    AND bm_inner.state = 'ApprovedForDisplay'    -- sealed state-machine predicate
  ORDER BY bm_inner.updated_at DESC
  LIMIT 1
) bm ON true
WHERE
  bc.lifecycle_state = ANY (ARRAY['VERIFIED','OWNER_CLAIMED','OWNER_VERIFIED'])
  AND bc.superseded_by_business_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM nex.business_evidence be
    JOIN nex.source_registry sr ON sr.source_id = be.source_id
    WHERE be.canonical_business_id = bc.canonical_business_id
      AND sr.can_display = true
  );
```

### 2.3 · Predicate guarantees

The LEFT JOIN LATERAL clause enforces, per row:

| Predicate | Enforces | Current live schema state |
|---|---|---|
| `bm_inner.approved = true` | Admin review passed (Aspect 4) | Column exists · default `false` |
| `bm_inner.deleted_at IS NULL` | Not retracted (Aspect 6) | **COLUMN DOES NOT EXIST YET** · would require schema addition before this view can deploy |
| `sr_bm.can_display = true` | Source-level governance | Column exists · currently `false` for every image-capable source |
| `bm_inner.licence_id IS NOT NULL` | Rights evidence captured (I-D2) | Column exists · currently NULL for all 10 rows |
| `bm_inner.state = 'ApprovedForDisplay'` | Sealed 4-state progression (image-states.ts) | **COLUMN DOES NOT EXIST YET** · state is a code-level concept, not persisted today |

**Two schema prerequisites** emerge: `business_media.deleted_at` (Aspect 6) + `business_media.state` (sealed 4-state model persisted). Both are schema changes that require **separate authorisation** when the real persister is approved.

### 2.4 · What the sibling view DOES NOT include

| Field | Why excluded |
|---|---|
| `phone_e164` | I-D3 "exclude phone numbers unless separately approved" |
| `email` | Not in schema; migration 202 unapplied; would be excluded anyway |
| Any personal identifier | I-D3 explicit exclusion |
| `image_metadata` (EXIF, dimensions, licence_id) | Not needed for public display; audit uses `business_media` directly |
| Multiple images per business | Single-image per tile; selection is "most recently updated approved image." Owner may want different ordering (first_approved, highest_quality score) — flagged as open question. |

## 3 · Consumer audit · who reads `business_directory_v` today?

Verified via grep over `src/`:

| Consumer | File | Purpose | Would it break if the parent view's shape is unchanged? |
|---|---|---|---|
| `directory-service.ts` | `src/lib/nex-native/directory/directory-service.ts` | Core directory read path | NO (unchanged) |
| `country-counts.ts` | `src/lib/nex-native/directory/country-counts.ts:50` | Per-country directory tile counts | NO (unchanged) |
| `related-businesses/service.ts` | `src/lib/nex-native/directory/related-businesses/service.ts:154, 399` | "Related businesses" surface | NO (unchanged) |
| `directory-service.test.ts` | tests | Pins the FROM clause | NO (unchanged · test asserts current string) |
| `country-counts.test.ts` | tests | Pins the FROM clause | NO (unchanged) |
| `directory/[id]/page.tsx` | `src/app/nex-native/directory/[id]/page.tsx` | Directory detail page | NO (indirect · reads via directory-service) |
| `CountryPicker.tsx` | `src/components/nex-native/directory/CountryPicker.tsx` | UI picker | NO (reads via country-counts) |
| `relevance.ts` | `src/lib/nex-native/directory/related-businesses/relevance.ts` | Ranking | NO (data layer unchanged) |
| `tiers.ts` | `src/lib/nex-native/directory/related-businesses/tiers.ts` | Tier logic | NO (data layer unchanged) |

**Total**: 9 files reference the parent view (6 code + 3 test files). **None would be impacted** by the sibling view's existence because the parent is unchanged.

## 4 · Regression plan (REVIEW-ONLY · DO NOT RUN ON PRODUCTION)

The regression plan proves two things before any deploy:
1. The parent view's behaviour is unchanged.
2. The sibling view's shape conforms to the design.

### 4.1 · Parent-view regression

**R-1**: Row count equivalence. Both before + after proposed deploy:
```sql
SELECT count(*) FROM nex.business_directory_v;
-- Expected: 40,541 (±expected hourly growth from harvest)
```
Target: identical row count. Any deviation is a defect.

**R-2**: Column shape equivalence. Confirm `business_directory_v`'s column list is unchanged:
```sql
SELECT column_name, data_type, ordinal_position
FROM information_schema.columns
WHERE table_schema='nex' AND table_name='business_directory_v'
ORDER BY ordinal_position;
```
Diff against the pre-deploy snapshot. Any addition / removal / reorder is a defect.

**R-3**: Row-set equivalence. Hash the parent view's output before + after:
```sql
SELECT md5(string_agg(canonical_business_id::text, '|' ORDER BY canonical_business_id))
FROM nex.business_directory_v;
```
Identical hash required.

**R-4**: Behaviour-level regression. Run the consumer code's existing test suite:
```bash
npx vitest run src/lib/nex-native/directory/__tests__/
```
All pre-deploy tests pass.

### 4.2 · Sibling-view shape conformance

**S-1**: Column allowlist conformance.
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema='nex' AND table_name='business_directory_with_media_v'
ORDER BY ordinal_position;
```
Expected: 23 columns (22 identity/address/etc from parent minus `phone_e164`, plus `image_url`). No other columns.

**S-2**: Image-field NULL semantic. Confirm:
```sql
SELECT count(*) FILTER (WHERE image_url IS NOT NULL) AS with_image,
       count(*) FILTER (WHERE image_url IS NULL) AS without_image,
       count(*) AS total
FROM nex.business_directory_with_media_v;
```
Pre-first-approved-image state: `with_image = 0`, `without_image = total = ~40,541`.

**S-3**: Join-boundary tightness. Confirm the LEFT JOIN LATERAL cap at 1:
```sql
SELECT canonical_business_id, count(*) AS image_rows
FROM nex.business_directory_with_media_v
GROUP BY canonical_business_id
HAVING count(*) > 1;
```
Expected: empty result (zero rows). Any row ⇒ defect.

**S-4**: Sealed-predicate conformance. Insert a test image into a test canonical row at state `Matched` (not `ApprovedForDisplay`). The sibling view MUST NOT return it with a non-NULL `image_url`. (Requires sealed state column to exist · if not yet, this test is deferred.)

### 4.3 · Grants + visibility conformance (NOT TO BE RUN ON PRODUCTION)

**G-1**: Verify no new grants are issued without owner authorisation.
```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='nex' AND table_name='business_directory_with_media_v';
```
Pre-deploy: empty.  
Post-deploy (if authorised separately): only roles owner approves.

## 5 · Prohibited actions under this document

- Deploying either view (parent or sibling).
- Granting SELECT on the sibling view to any role.
- Running the regression plan against production without owner authorisation.
- Materialising the sibling view.
- Adding columns to `business_media` (`deleted_at`, `state`) under the authority of this document.
- Modifying the parent `business_directory_v` in any way.
- Including `phone_e164`, email, or personal identifiers in the sibling view.

## 6 · Open questions for owner

- **Q6a** Does the owner want `phone_e164` in the sibling view, or kept excluded as proposed?
- **Q6b** Image selection order when multiple approved images exist · "most recently updated" vs "first approved" vs "highest quality score" (requires an ordering column) · owner picks.
- **Q6c** The design assumes `business_media.deleted_at` and `business_media.state` columns will exist by deploy time. Owner confirms the schema addition is scoped with the real persister build (not shipped under this document)?
- **Q6d** When no approved image exists for a business, the view returns `image_url=NULL`. Owner confirms the UI renders a category-neutral placeholder per image doctrine G12?

## 7 · What this document, as recorded, does and does not

### DOES
- Propose sibling view SQL with explicit column allowlist.
- Audit the 9 current consumers of `business_directory_v`.
- Propose a regression plan covering 4 parent-equivalence checks + 4 sibling-conformance checks + 1 grants check.
- Preserve the parent view SEALED and unchanged.

### DOES NOT
- Deploy any view.
- Modify any production schema.
- Issue any grant.
- Insert into `business_media`.
- Flip any `can_display` value.
- Run the regression plan against production.
