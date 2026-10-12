# Stage A + Stage B · final preparation deliverable

**Run date:** 2026-10-13 WIB
**Scope authorised by owner:** finalise Stage A preparation + Stage B preparation · NO production writes · NO migrations · NO reconciler activation · NO orphan or synthetic-row deletions
**Local commit (not pushed):** `a2427c7` · 1 ahead of `origin/main` at `8e67c72`
**Previous deliverables (unchanged):** `logs/stage0-evidence/*`, `logs/stage-ab-prep/stage-ab-prep-report-2026-10-13.md`

---

## 1 · Dependent-reference scan · the critical caution resolved

The 246-row `coat-seller → clothes` rename has **three source-level references** besides `business_canonical.category_ids`. The rename needs all three handled in lockstep:

| file | hit | criticality |
|---|---|---|
| `src/lib/nex-native/directory/category-metadata.ts` · line 361 | the entry itself + its `clothes` alias | metadata · update as part of the code commit |
| `scripts/supabase-osm-overpass-walker.mjs` · line 68 | `{ slug: "coat-seller", ..., osmFilter: '["shop"="clothes"]' }` | **blocker · without this edit the next walker run would re-emit `coat-seller` rows and undo the SQL** |
| `nex-supabase/migrations/187_nex_source_registry_osm_products.sql` · line 12 | human-readable comment only (lists the wave-1 slugs) | cosmetic |

**No other dependency** across the entire codebase. Verified via two grep passes:
- Exact `"coat-seller"` matches: only the three files above (plus audit scripts + logs, which are not production).
- The complementary `"clothes"` string literal: `category-metadata.ts` (lines 187 + 361), plus one unrelated user-facing error message in `product-section-service.ts:29` ("One word please — try Babyclothes or Kids-Wear.") that is NOT an identifier.

For the 4 "-v2" variants and the 3 alias-splits · they live only in `category-metadata.ts`. No walker reference. No test reference. No type definition. Metadata-only cleanup.

### Walker-side change required

The walker's CATEGORIES entry at `scripts/supabase-osm-overpass-walker.mjs:68`:

```diff
-  { slug: "coat-seller", entityType: "marketplace_seller", osmFilter: '["shop"="clothes"]' },
+  { slug: "clothes",     entityType: "marketplace_seller", osmFilter: '["shop"="clothes"]' },
```

OSM filter stays the same (we still want `shop=clothes`). Only the NEX-side slug changes. Any future walker run will emit `clothes` into `category_ids` instead of `coat-seller`. No regression risk.

---

## 2 · Validator dry-run · current + projected clean

Run `scripts/audit-stageA-validator-dryrun.mjs` captures:

| state | alias-canonical collisions | duplicate slugs | pattern violations |
|---|---|---|---|
| **current** CATEGORY_METADATA | **11** | 0 | 0 |
| **projected** (post Stage A rename) | **0** | 0 | 0 |

Net reduction: 11 → 0. Every one of the 11 flagged aliases is accounted for by the planned rename:

```
health         → drop alias 'dentist'
coat-seller    → drop entry (merge to clothes)
kebab-house    → drop entry (merge to meat-kebab)
bike-rental-v2 → drop entry (variant to bike-rental)
massage        → drop alias 'massage-spa'
wedding-events → drop entry (merge to wedding-agents)
travel-agency  → drop alias 'tour-guide'
pets-supplier  → drop entry (merge to pet-supplies)
fishing-v2     → drop entry (variant to fishing)
camping-v2     → drop entry (variant to camping)
yoga-v2        → drop entry (variant to yoga)
```

Full output: `logs/stage-ab-prep/stageA-validator-dryrun-stdout.log`

### Image-variant behaviour

For the 4 "-v2" entries, the four images stay on disk + stay in `nex.category_image_library`. The planned transition:

| asset | state today | after Stage A apply |
|---|---|---|
| `public/nex-category-images/yoga/aa31.png` (not actual path — illustrative) | library row `category_slug='yoga' url=<path> variant_tag=NULL` | unchanged |
| `public/nex-category-images/yoga-v2/b078.png` | library row `category_slug='yoga-v2' url=<path> variant_tag=NULL` | library row updated to `category_slug='yoga' variant_tag='alt-b078'`; the old `yoga-v2` row keeps for 90 days with `active=false` |
| resolver on a listing with `category_ids=['yoga']` | Tier 2 finds the one row keyed `yoga` + any aliases that match | Tier 2 finds **two** rows keyed `yoga` (primary + variant_tag=alt-b078). Deterministic FNV-1a over `canonical_business_id` picks between them · rotation across listings. |

Zero image file deletions. Zero data loss. The resolver already supports multi-row-per-slug via its tie-break (see `src/lib/nex-native/directory/category-image-resolver.ts` lines 112-125).

---

## 3 · Rollback SQL · forward + backward with pre/post gates

Two files written to `logs/stage-ab-prep/`:

- `stageA-rename-FORWARD-DRAFT.sql` · scoped to the 246 rows carrying `coat-seller`. Uses a `public._stageA_rename_snapshot_2026_10_13` scratch table to capture before+after state per row. Includes a pre-flight sanity gate that `RAISE EXCEPTION` if the live count differs from the baseline (246). Includes a post-flight check for duplicate slugs within any `category_ids` array (would catch any case where a row already had `clothes` and the rename would double-add it; the current baseline shows this is 0).

- `stageA-rename-ROLLBACK-DRAFT.sql` · inverse scoped to the SAME 246 canonical IDs via the snapshot table join (never a wider WHERE clause). Executes `array_replace('clothes', 'coat-seller')` only where the row still has `clothes` in its array. Pre-flight checks that the snapshot table exists and is non-empty. Post-flight checks for duplicate slugs.

Both files are explicitly in `logs/` so no automated migration runner can pick them up. The operator renames to `nex-supabase/migrations/188_stageA_rename_coat_seller_to_clothes.sql` after:
1. Owner authorises Stage A apply.
2. Point-in-time Supabase snapshot captured.
3. `scripts/audit-stage0-production-baseline.mjs` re-run shows unchanged orphan + slug fingerprints.

---

## 4 · Deployment baseline · `a2427c7` diff review

**Verification of ancestry and scope:**

| field | value |
|---|---|
| HEAD | `a2427c7b89950f6813f2ba6ba7871c2aab26467f` |
| origin/main tip | `8e67c72b` |
| commits in `origin/main..HEAD` | **exactly 1** (`a2427c7`, Phase 3) |
| files changed | 12 (8 new, 4 modified) |
| lines | +1,018 / -18 |
| files OUTSIDE `src/app/nex-native/` or `src/lib/nex-native/` | **0** |
| migrations touched | 0 |
| `src/app/nex-native/cover/*` touched | **0** |

**Per-file scope conformance (every modified file reviewed):**

| file | kind | scope confirmed to be Phase 3 only |
|---|---|---|
| `product-service.ts` | M | ✓ adds `ProductThumbnail` + `getProductThumbnailsByBusiness()` ONLY · no change to `listProductsByBusiness` behaviour |
| `[businessSlug]/page.tsx` | M | ✓ one new fetch + one new JSX block mounting `BusinessThumbnailRow` ONLY · hero + reach-bullets + chat href untouched |
| `_shop-slider.tsx` | M | ✓ additive `focusProductId` prop · default null preserves preview-mode behaviour exactly · verified against the diff hunk |
| `chat/peer/[accountId]/page.tsx` | M | ✓ adds `focus_product` to searchParams, preserves `?next=` through sign-in redirect, mounts `FocusedShopSheet` conditionally · zero changes to messaging, calls, E2E encryption, SafeTrade, archive panel |
| `_actions.ts` | M | ✓ adds exactly one `if (nextRaw valid) { ...; redirect(nextRaw); }` block inside `signInAction` · no other function in the file is touched · the hunk is 16 lines +0 lines modified |
| `sign-in/page.tsx` | M | ✓ adds `?next` to searchParams typing + `safeNext()` whitelist + one hidden input · face-button + legacy form behaviour preserved |
| 6 new files (components + tests) | A | ✓ all under `nex-native/*` · all Phase 3 scope |

**Clean to push when authorised.** Zero drift from the Phase 3 approval. Nothing surprising in the diff.

---

## 5 · Stage B integration tests · drafted

Seven tests specified in `logs/stage-ab-prep/stageB-integration-tests-DRAFT.md`, kept out of `src/` so CI stays green until Stage B apply is authorised. Numbered summary:

1. **Happy path** · verifyClaim progresses `PENDING → VERIFYING_IDENTITY_LINK → VERIFIED` when reconciler returns `linked_existing`
2. **Ambiguous** · claim stays `VERIFYING_IDENTITY_LINK` when reconciler returns `ambiguous_multiple_profiles`; retry endpoint progresses to `VERIFIED` after mock returns `rowCount=1`
3. **Backoff** · 2 `supabase_error` responses with `retryAfterMs = 1000 / 5000` then `linked_existing` on attempt 3; same idempotency key across all three
4. **Idempotency** · `recordReconcileEvent` with the same `(key, attempt_number)` returns `alreadyRecorded = true`; one row in audit table
5. **Rollback drill** · scratch Supabase branch · migration apply + partial-unique check + rollback · face-cover columns unchanged · timed under 500ms
6. **Face-cover regression** · `cover_layout_id` and `chat_theme` values byte-identical before and after a mock reconciler run
7. **Unclaimed regression** · `/nex-native/directory/[id]` for unclaimed canonical still renders claim form · `/nex-native/[slug]` for linkless business renders · `/nex-native/chat/peer/[id]?focus_product=X` works regardless of canonical linkage · verified badge gated on `claim.state = 'VERIFIED'` not `'VERIFYING_IDENTITY_LINK'`

**None of these tests are mounted in `src/` yet.** Landing them is Stage B's code-commit payload.

---

## 6 · Operator sequencing · unchanged from earlier plan + refined

| step | artefact | current state | gating approval |
|---|---|---|---|
| 0 | Finalise Stage A preparation | **COMPLETE** · this document | — |
| 1 | Code commit: 4 variants + 7 aliases dropped from metadata · walker CATEGORIES slug updated · validator moved into `src/` · 1 commit, 3 files | drafted, not applied | **Stage A code commit authorisation** |
| 2 | SQL: rename `stageA-rename-FORWARD-DRAFT.sql → nex-supabase/migrations/188_...sql` · apply against live DB · 246 rows affected | drafted, not applied | **Stage A SQL apply authorisation** |
| 3 | Re-run `scripts/audit-stage0-production-baseline.mjs` · `orphan_ids_fingerprint` unchanged, `canonical_slugs_fingerprint` changed by exactly the known-expected delta | n/a | automatic post-step-2 |
| 4 | Stage B migration apply · rename `999_WIP_...sql → nex-supabase/migrations/189_...sql` · psql apply · adds nullable column + partial unique index | drafted, not applied | **Stage B migration authorisation** |
| 5 | Stage B tests land in `src/` · 7 tests mounted · reconciler stays `simulate-only=true` | drafted, not landed | **Stage B test commit authorisation** |
| 6 | Reconciler wire-in · verifyClaim calls `reconcileVerifiedClaim` after code verification · `VERIFYING_IDENTITY_LINK` state introduced | not drafted | **Stage B wire-in authorisation** |
| 7 | Reconciler production enable · env var flip | n/a | **Stage B production enable authorisation** |

Every arrow between steps requires its own approval. Nothing cascades.

---

## 7 · What this stage changed, by category

**Source code:** nothing. Zero `src/` edits. Everything is in `logs/stage-ab-prep/` or `scripts/`.

**Production data:** nothing. No INSERT/UPDATE/DELETE/DDL.

**Face-cover:** untouched. Zero file in `src/app/nex-native/cover/*`. Zero `cover_layout_id` or `chat_theme` value read.

**Repository state:**
- `main` branch · HEAD `a2427c7` (unchanged from previous turn)
- `origin/main` tip `8e67c72` (unchanged)
- 1 commit ahead of origin
- untracked files are read-only audit scripts + logs/ + 2 generated-dir artefacts (`src/app/nex-generated/`, `data/`, `scripts/.phase12-audit-test/`) that are not my work

**Artefacts added to `logs/`:**
- `logs/stage-ab-prep/stageA-row-comparison-2026-10-13.json`
- `logs/stage-ab-prep/stageA-category-mapping-2026-10-13.json`
- `logs/stage-ab-prep/stageA-slug-validator-DRAFT.ts`
- `logs/stage-ab-prep/stageA-validator-dryrun-stdout.log`
- `logs/stage-ab-prep/stageA-rename-FORWARD-DRAFT.sql`
- `logs/stage-ab-prep/stageA-rename-ROLLBACK-DRAFT.sql`
- `logs/stage-ab-prep/stageB-integration-tests-DRAFT.md`
- `logs/stage-ab-prep/stage-ab-prep-report-2026-10-13.md` (prior turn)
- `logs/stage-ab-prep/stage-ab-FINAL-prep-2026-10-13.md` (this file)

**Scripts added to `scripts/`:**
- `scripts/audit-stageA-row-comparison.mjs`
- `scripts/audit-stageA-category-mapping.mjs`
- `scripts/audit-stageA-validator-dryrun.mjs`

All read-only. All hard-gated on project `ijvqdvsvwtwxzcqmoqit`.

---

## 8 · Awaiting your call

Per your decision — **preparation is complete, production writes remain on hold.** The next-step options from the prior turn stand unchanged:

| option | effect | risk |
|---|---|---|
| **1 · Stage A code commit** | one commit · drops 8 metadata entries + 3 aliases · updates walker CATEGORIES slug · moves validator into `src/` · zero DB writes | low · reversible via `git revert` |
| **2 · Stage A SQL apply** | `UPDATE nex.business_canonical … array_replace('coat-seller', 'clothes')` in a transaction with pre/post counts · 246 rows affected | low · fully reversible via companion ROLLBACK SQL + snapshot table |
| **3 · Stage B migration apply** | ADD COLUMN + CREATE PARTIAL UNIQUE INDEX on `nex_business` · 0 backfill (0 claims today) | low · trivially reversible |
| **4 · Push `a2427c7` to origin/main** | triggers Vercel build · Phase 3 live | low · Phase 3 scope confirmed · diff reviewed · face-cover untouched |

My recommendation remains: option 1 first (metadata + walker code commit, zero DB writes), then option 2 (the one-row-moving SQL under the explicit mapping discipline), then option 3 (identity bridge DDL). Option 4 can land independently whenever you want Phase 3 in production.

Nothing moves without your word.
