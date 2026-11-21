# NEX Universal Image Doctrine · Directory Reconciliation Gap Report · 2026-10-27

> **Status: READ-ONLY gap report.** No production data, schema, RLS, storage, publication rules, or source approvals changed. No code change performed by this document.
>
> **Authority**: owner directive 2026-10-27 · reconcile the Directory card implementation against the existing Universal Image Doctrine without redesigning Search/Explore or reopening governance decisions.
>
> **Scope**: locate the exact doctrine, quote the three tiers verbatim, map each tier to its current code path and live data, state which tier can operate under existing authorisations, and propose the smallest compliant implementation.

## 1 · The exact doctrine · verbatim

### 1.1 · Primary sealed anchors (in-tree source files)

| Path | Role |
|---|---|
| `src/lib/nex/images/resolveDirectoryHero.ts` | Pure-function resolver · implements the priority rule |
| `src/lib/nex/images/types.ts` | Sealed type union defining the three (and only three) image states |
| `src/lib/nex/images/categoryFallbackLibrary.ts` | Tier-3 fallback library (code-side, hard-coded) |
| `src/lib/nex/images/resolveDirectoryHero.test.ts` | Acceptance tests (contract) |

### 1.2 · Doctrine anchor identifiers (textual · referenced in sealed headers)

- `project_nex_universal_directory_image_doctrine_2026_08_22` (constitutional)
- `project_nex_country_scope_from_phone_country_code_2026_08_22` (country foundational)

### 1.3 · The three tiers · VERBATIM from `types.ts:7-8`

```ts
/** The three (and only three) image states per Universal Image Doctrine. */
export type ImageType = "OWNER_IMAGE" | "VERIFIED_REAL" | "CATEGORY_FALLBACK";
```

### 1.4 · Resolver contract · VERBATIM from `resolveDirectoryHero.ts:6-14`

```
Contract (per Universal Image Doctrine acceptance tests 1–7):
  · NEVER returns null.
  · NEVER returns a broken/empty URL.
  · Priority: OWNER_IMAGE (approved) > VERIFIED_REAL (approved) >
    CATEGORY_FALLBACK (library) > UNIVERSAL_FALLBACK.
  · Rows unrelated to (businessType, businessCountry, businessRef) are safely filtered.
  · Unapproved rows are ignored (owner_approved / approved gates).
  · CATEGORY_FALLBACK output always carries fallbackCategory.
  · VERIFIED_REAL output carries cycleRunId when present (Direct-Provenance A).
```

### 1.5 · Resolver input shape · VERBATIM from `resolveDirectoryHero.ts:22-39`

```ts
export interface ResolveDirectoryHeroInput {
  businessType: string;
  businessCountry: string;   // ISO 3166-1 alpha-2
  businessRef: string;
  categoryId: string;
  images: readonly BusinessImageRow[];
  fallbackLookup?: (categoryId: string, country: string) => string | null;
  universalFallback?: string;
}
```

### 1.6 · Resolver output shape · VERBATIM from `types.ts:29-39`

```ts
/** Return shape of the universal directory hero resolver.
 *  Contract: NEVER null. NEVER broken. Always resolves to a renderable state. */
export interface ResolvedDirectoryHero {
  url: string;
  imageType: ImageType;
  source: string;
  fallbackCategory?: string;
  provenance?: Record<string, unknown>;
  confidence?: number;
  cycleRunId?: string;
}
```

**Interpretation**: `UNIVERSAL_FALLBACK` is NOT a fourth image type · it is the terminal safety value within the `CATEGORY_FALLBACK` tier (per `resolveDirectoryHero.ts:97-103`, the universal fallback is returned with `imageType: "CATEGORY_FALLBACK"`). The owner's "three tier" characterisation is accurate.

## 2 · Tier-by-tier status · intended vs implemented

### Tier 1 · `OWNER_IMAGE`

**Intent (sealed)**: A business owner uploaded their own authoritative photo. Priority 1 · wins over everything.

**Required inputs for the resolver**:
- A row in `nex.business_image` where `image_type='OWNER_IMAGE' AND approved=true AND owner_approved=true` (both gates per `resolveDirectoryHero.ts:11-12` and `types.ts:23-24`)
- The row's `(business_type, business_country, business_ref)` must match the business being resolved

**Live data (measured 2026-10-27)**: **0 rows** in `nex.business_image` with `image_type='OWNER_IMAGE'`.

**Current code path**: The Directory card adapter at `src/lib/nex-native/directory/landing-feed-service.ts:605` (function `adaptRowToCard`) emits `imageUrl: row.logo_url ?? null`. For canonical rows this is **always null** because `adaptCanonical` in `src/lib/nex-native/local-directory-service.ts:195` sets `logo_url: null`. The sealed resolver is **never called**. Tier 1 is UNREACHABLE from the current Directory render path.

### Tier 2 · `VERIFIED_REAL`

**Intent (sealed)**: An image NEX observed via a verified mechanism (e.g. the sealed website walker · `source='business_website'`) and that an admin or deterministic process has approved for display. Priority 2.

**Required inputs for the resolver**:
- A row in `nex.business_image` where `image_type='VERIFIED_REAL' AND approved=true` (per `resolveDirectoryHero.ts:11` and the test contract)
- `(business_type, business_country, business_ref)` match

**Live data (measured 2026-10-27)**:
- **660 rows** in `nex.business_image` with `image_type='VERIFIED_REAL'`
- Split: 303 `accommodation` · 298 `food` · 59 `services`
- **ALL 660 have `approved=false AND owner_approved=false`**
- All `source='business_website'` — the walker DID capture real images from business websites at some point
- `business_ref` format examples: `#SB-2026-33FQS`, `#SB-2026-Q9G7F`

**Identity-space mismatch (critical)**:
- `business_image.business_ref` uses the `#SB-2026-*` format
- The current Directory operates on `canonical_business_id` UUIDs (87,013 rows)
- **0 of 660 image rows match any UUID in `business_canonical`** (verified via `JOIN ... ON bc.canonical_business_id::text = bi.business_ref`)

**Current code path**: The Directory card adapter does not query `business_image`. Tier 2 is UNREACHABLE from the current render path AND the identity-space mismatch would prevent a join even if the resolver were wired.

### Tier 3 · `CATEGORY_FALLBACK`

**Intent (sealed)**: A per-category, per-country curated artwork — the owner-approved "neutral representation" when no OWNER_IMAGE or VERIFIED_REAL exists. Priority 3. **Terminal safety** via `UNIVERSAL_FALLBACK_URL` (per `categoryFallbackLibrary.ts:35-40`).

**Required inputs for the resolver**:
- `categoryId` (string · maps to the business's category)
- `businessCountry` (ISO alpha-2)
- A fallback lookup function (default: `categoryFallbackFor` from the code-side library)

**Live data (measured 2026-10-27)** · TWO parallel fallback sources exist:

| Source | Where | Rows / entries | Scope today |
|---|---|---|---|
| **Code-side `categoryFallbackLibrary.ts`** | `src/lib/nex/images/categoryFallbackLibrary.ts:72-85` | Food family only · `food`, `restaurant`, `coffee-cafe`, `ice-cream-dessert`, `fast-food` · country `ID` only · references NEX_VISUAL_ASSETS `nva-*` entries | Owner Philip 2026-08-22 explicitly froze non-food curation: *"Do NOT solve the missing non-food fallback artwork yet"* |
| **DB-side `nex.category_image_library`** | Supabase table · seeded by `scripts/supabase-seed-category-image-library.mjs` on 2026-10-12 | **307 rows** · covers `fast-food`, `hotel`, `guesthouse`, `hostel`, `kos`, `apartment`, `resort`, `homestay`, `villa`, `products`, and more · URLs under `/nex-category-images/<slug>/*.png` | Added AFTER the code-side library was frozen · not referenced by the sealed resolver |

**UNIVERSAL_FALLBACK**: `nva-011` (a healthy grain bowl image). Documented placeholder: *"MUST be replaced by Philip-curated NEX-branded generic fallback before broad Phase 2 production activation"*. **Rendering a grain bowl on a Berlin hotel card would violate the sealed trust rule** (implies incorrect business photography).

**Current code path**: The resolver is **never called** from the Directory card adapter. The 307-row DB library is **never queried** from the Directory card adapter. Tier 3 is UNREACHABLE even though BOTH its data sources already exist in production.

## 3 · Where the three tiers are called today

Full grep for `resolveDirectoryHero` or `BusinessImageRow`:
```
src/lib/nex/images/resolveDirectoryHero.ts      ← definition
src/lib/nex/images/resolveDirectoryHero.test.ts ← tests only
src/lib/nex/images/types.ts                     ← definition
```

**The sealed resolver has ZERO production callers.** It is tested but never invoked from any live render path.

Full grep for `category_image_library` DB queries:
```
(none)
```

**The 307-row category library is never queried.**

Current Directory card adapter (`src/lib/nex-native/directory/landing-feed-service.ts:626-688`):
```ts
return {
  id: row.id,
  slug,
  title: row.display_name,
  ...
  imageUrl: row.logo_url ?? null,   // ← ALWAYS null for canonical rows
  ...
};
```

Current Directory listing card (`src/components/nex-native/directory/listing-card.tsx:160-170`):
```tsx
{listing.imageUrl ? (
  <img src={listing.imageUrl} alt="" ... />
) : (
  <NoImageMonogram title={listing.title} />
)}
```

Result on every canonical card today: letter-monogram placeholder.

## 4 · What each tier would require to actually render

| Tier | What exists today | What is MISSING under existing authorisations | What is MISSING under NEW owner decisions |
|---|---|---|---|
| **1 · OWNER_IMAGE** | sealed owner-upload service at `business-media/owner-upload-service.ts` (writes `nex.business_media` · different table) | identity bridge · `business_claim` rows (0 live) · the writer targets `business_media` not `business_image` | which table owns owner-upload (business_media vs business_image) · can_display per source |
| **2 · VERIFIED_REAL** | 660 captured images with source `business_website` · all unapproved · all in `business_image` with `#SB-2026-*` refs | identity bridge between `#SB-2026-*` and `canonical_business_id` · admin-approval workflow to flip `approved=true` | which 660 rows map to which canonical UUIDs · per-source governance per I-D1/I-D2 drafts · operator-identity for approval |
| **3 · CATEGORY_FALLBACK** | **307-row `nex.category_image_library`** (owner-seeded 2026-10-12) · covers hotel/food/products/services/etc · AND code-side food-family library · AND `UNIVERSAL_FALLBACK_URL` | **A thin adapter from `canonical.entity_type`+`category_ids` → `category_slug` in the library** · wiring the resolver (or an equivalent query) into `adaptRowToCard` | the `UNIVERSAL_FALLBACK_URL` is a food image · if we rely on it we would show food artwork for non-food businesses · owner must either approve a NEX-branded generic fallback OR confirm "monogram when category has no library entry" as the terminal safety |

## 5 · Gap report · categorised per owner's directive

### 5.1 · Existing product requirements (sealed · unchanged)

- Priority rule: `OWNER_IMAGE (approved) > VERIFIED_REAL (approved) > CATEGORY_FALLBACK (library) > UNIVERSAL_FALLBACK`.
- Approval gates: both `approved` AND `owner_approved` must be true for OWNER_IMAGE; `approved` must be true for VERIFIED_REAL.
- Row-filter rule: rows unrelated to `(businessType, businessCountry, businessRef)` are safely filtered.
- Resolver NEVER returns null or a broken URL.
- No invention of business photographs. No stock-as-business-photo. No unapproved media exposed.

### 5.2 · Implemented resolution behaviour (today, in the live Directory)

- **Tier 1 / Tier 2**: not reachable · adapter never calls the resolver · identity-space mismatch would block even if it did.
- **Tier 3**: not reachable · adapter never calls the resolver · category library never queried.
- Current effective behaviour: `imageUrl = null` on every canonical row → `NoImageMonogram` letter-placeholder.

### 5.3 · Unavailable or unapproved image sources

- `nex.business_image` 660 VERIFIED_REAL rows: ALL unapproved (approved=false AND owner_approved=false).
- `source_registry.can_display=true` for `business_website`: NOT SET (per earlier image governance assessment · same gate).
- 913 `nex-media/imported/*` orphans: explicitly NOT business photos; untouched.

### 5.4 · Missing implementation (under existing authorisations)

| # | Missing piece | Lives in | Owner decision needed? |
|---|---|---|---|
| M1 | Call `resolveDirectoryHero` (or equivalent) from the Directory card adapter | `landing-feed-service.ts` adapter | **No** · wiring an existing sealed resolver into an existing adapter |
| M2 | Map `canonical.entity_type` + `category_ids` → category slug the library understands | New small pure function | **No** · uses only pre-approved data |
| M3 | Query `nex.category_image_library` for the matching `category_slug` (sorted by `priority ASC`, `active=true`) | New read-only query | **No** · the table was owner-seeded for exactly this purpose |
| M4 | Pass `images: []` to the resolver (OR query `business_image` after identity bridge exists) | Adapter signature | **No** for the `images: []` case · Tier 1/2 remain honestly unreachable until bridge |

**M1-M4 together deliver Tier 3 CATEGORY_FALLBACK for canonical cards whose category has a library entry · zero new owner approvals required.**

### 5.5 · Owner decisions genuinely required (for the full three-tier picture)

| Decision | Scope |
|---|---|
| **UID-B1** · identity bridge · how do `#SB-2026-*` business_image rows join to `canonical_business_id` UUIDs? Does a mapping table exist elsewhere, or should the walker start writing images against canonical UUIDs going forward? | Needed to unblock Tier 2 (VERIFIED_REAL) |
| **UID-B2** · approval workflow · who flips `approved=true` on `business_image` rows, under what evidence, with what audit? | Needed to unblock Tier 2 |
| **UID-B3** · owner-upload target · does owner-upload write to `nex.business_image` (sealed · with the three-tier doctrine) or `nex.business_media` (newer · my earlier image-governance DRAFT referenced this)? **One of them is redundant.** | Blocks Tier 1 |
| **UID-B4** · universal fallback · the current `nva-011` is a food image · will show food on non-food cards · owner authors a NEX-branded generic fallback OR confirms "monogram when no library entry" | Blocks terminal safety for non-food non-ID categories |
| **UID-B5** · code-side library vs DB library · the frozen 2026-08-22 TS library covers food+ID only; the 2026-10-12 DB library covers more categories but was NEVER wired · which is authoritative? | Housekeeping · affects what Tier 3 can serve |
| **UID-B6** · source_registry.can_display per source · still unresolved (G1-G8 per `nex-image-governance-draft-2026-10-27.md`) · the Universal Doctrine's approval gates and source_registry's governance need to be reconciled too | Blocks the second image-governance system |

## 6 · Smallest compliant implementation · PROPOSED

### 6.1 · Scope · Tier 3 CATEGORY_FALLBACK only · no new owner decisions

Wire the Directory card adapter to call the sealed resolver with `images: []`. The resolver falls through to CATEGORY_FALLBACK · the DB `category_image_library` serves the artwork · when a category has no library entry, fall back to `NoImageMonogram` (not the food `nva-011`) to preserve the trust rule.

### 6.2 · Proposed changes · narrow, auditable

| # | Change | File | Risk |
|---|---|---|---|
| 1 | New pure function `resolveCategorySlugForCanonicalRow(row)` that maps `entity_type` + `category_ids[0]` + `country` → a `category_slug` the library understands (e.g. `food` → `restaurant`, `accommodation` + `hotel` tag → `hotel`) | New file `src/lib/nex-native/directory/category-fallback-adapter.ts` | Low · pure function · can be unit-tested |
| 2 | New read-only service `getCategoryFallbackUrl(categorySlug, country)` that queries `nex.category_image_library WHERE category_slug = $1 AND active = true ORDER BY priority ASC LIMIT 1` | Same new file | Low · one SELECT · parameterised |
| 3 | In `adaptRowToCard` · when `row.logo_url` is null AND source is `canonical`, substitute the resolver output. Owner-authored `nex_business.logo_url` keeps winning over fallback (preserves current behaviour for existing owner uploads). | `landing-feed-service.ts` · 3-5 lines | Low · falls back to current letter-monogram if lookup returns null |
| 4 | Regression tests · canonical row with known category → correct fallback URL · unknown category → null (monogram) · the resolver's trust rules unchanged | New test file | Low |

### 6.3 · What this change DOES

- Delivers Tier 3 CATEGORY_FALLBACK honestly for the subset of canonical rows whose category matches the 307-row library.
- Preserves current behaviour for everything else · rows without a library match still render the honest letter-monogram.
- Honours all sealed trust rules · never fabricates a photo · never presents stock as a business photograph · the library IS the owner-pre-approved artwork.
- Zero new owner decisions required.

### 6.4 · What this change DOES NOT

- Does NOT touch Tier 1 or Tier 2 (both remain honestly unreachable).
- Does NOT change source_registry, business_image approvals, business_media, business_claim, or any publication predicate.
- Does NOT use the frozen food-only TS library (would show food for non-food · trust violation). Uses the DB library only.
- Does NOT render the universal food fallback for non-matching categories (would show food on hotels/services · trust violation). Falls back to letter-monogram.
- Does NOT change search, Explore, pagination, or any other delivered scope.
- Does NOT bypass the owner's governance questions UID-B1 through UID-B6 · those remain owner-decisions.

## 7 · Prohibited actions this document preserves

- No production data write.
- No schema change.
- No RLS or grant change.
- No storage configuration change.
- No publication predicate change.
- No approval of any `business_image` row.
- No surfacing of the 913 `nex-media/imported/*` orphans.
- No stock-image substitution.
- No weakening of trust or licence gates.

## 8 · Companion documents

- `src/lib/nex/images/resolveDirectoryHero.ts` + `types.ts` + `categoryFallbackLibrary.ts` + its tests (primary sealed source · unchanged)
- `nex-image-governance-draft-2026-10-27.md` (I-D1 + I-D2 drafts · separate governance chain)
- `nex-directory-decisions-loc-d1-img-d3-2026-10-27.md` (LOOSE location rule + R1 stock-filter proposal)
- `nex-founder-hq-directory-url-register-2026-10-27.md` (20-card register honouring LOOSE)

## 9 · Awaiting owner direction

The owner may:
- **Authorise** the §6 "smallest compliant implementation" · Tier 3 CATEGORY_FALLBACK wiring via the pre-existing 307-row DB library · zero new governance decisions · isolated commit on request.
- **Hold** · pending resolution of UID-B1 through UID-B6, keep the current letter-monogram as the honest no-image state across the Directory.
- **Expand** · also pursue the identity bridge (UID-B1) + approval workflow (UID-B2) to unlock Tier 2's 660 captured VERIFIED_REAL images · separate scoped work.

**No code changed by this document. No commit yet.** This file is a doctrine deliverable only · ready to commit as an isolated batch on your word.
