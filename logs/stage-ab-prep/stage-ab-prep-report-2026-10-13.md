# Stage A + Stage B · preparation deliverable

**Run date:** 2026-10-13 WIB
**Scope authorised by owner:** Stage A + Stage B *preparation only* · no production writes · no migrations · no deletions · face-cover untouched
**Local commit (not pushed):** `a2427c7` (phase-3 thumbnail row + chat deep-link)
**Repo:** `C:/Users/Victus/nexapp` · `origin → https://github.com/Philip2024394/nexapp.git` · branch `main`
**Supporting artifacts:**
- `logs/stage-ab-prep/stageA-row-comparison-2026-10-13.json`
- `logs/stage-ab-prep/stageA-category-mapping-2026-10-13.json`
- `logs/stage-ab-prep/stageA-slug-validator-DRAFT.ts`
- `nex-supabase/migrations/999_WIP_add_canonical_business_id_to_nex_business.sql` *(pre-existing · not applied)*
- `src/lib/nex-native/cross-db-reconciler/reconciler.ts` *(pre-existing · dormant · default-off)*

---

## 0 · Operational verification (your closing point)

| field | value |
|---|---|
| working-tree root | `C:/Users/Victus/nexapp` ✓ |
| remote | `https://github.com/Philip2024394/nexapp.git` ✓ |
| branch | `main` |
| HEAD | `a2427c7b89950f6813f2ba6ba7871c2aab26467f` |
| HEAD author | Philip O'Farrell <phillipofarrell@gmail.com> |
| commits ahead of `origin/main` | **1** (`a2427c7`, unpushed) |
| `origin/main` tip | `8e67c72` |
| reflog of `origin/main` | last 5 pushes land on this remote · right repo |
| working-tree untracked | only `logs/`, `data/`, `src/app/nex-generated/`, 4 read-only audit scripts · nothing in `src/app/` or `src/lib/` beyond phase-3 |


---

## 1 · Stage A · row-level comparison (40,738 vs 40,541)

### Set differences

| metric | value |
|---|---|
| canonical rows | 40,738 |
| `business_directory_v` rows | 40,541 |
| gap (canonical − view) | **197** |
| gap classification (orthogonal) · no evidence row at all | **197** (all of them) |
| gap classification · has evidence but no `can_display=TRUE` source | 0 |
| gap classification · `superseded_by_business_id NOT NULL` | 0 |
| gap classification · lifecycle not VERIFIED/OWNER_CLAIMED/OWNER_VERIFIED | 1 (the synthetic row) |
| in `directory_v` ∩ ¬canonical | **0** · FK integrity holds |

The 197-row gap IS the orphan set. No row is filtered for any other reason (lifecycle, superseded, source gate). Every one of them fails only on the "has ≥1 evidence row citing a `can_display=TRUE` source" test.

### Fingerprint match against Stage 0

- Stage 0 saved orphan fingerprint: `8126d77daf495a64bf02fff4ae767fa3fb24a502411271d49f8fd3955b4d416d`
- Stage A re-measured orphan fingerprint: `8126d77daf495a64bf02fff4ae767fa3fb24a502411271d49f8fd3955b4d416d`
- **Byte-for-byte match.** 0 orphans deleted, 0 repaired, 0 new orphans since 2026-10-12 17:54 UTC.

### Provenance

| finding | note |
|---|---|
| orphan creation window | 2026-10-08 (1 row · synthetic) · 2026-10-09 (189 rows) · 2026-10-11 (7 rows) |
| cross-DB correlation | `NEX_POSTGRES_URL` in `.env.local` points at the SAME Supabase project (not `nex_dev` as CLAUDE.md hints). The planned nex_dev correlation cannot be performed from here. |
| hypothesis | the orphans were written to Supabase by an early backfill run that committed `business_canonical` rows but skipped `business_evidence` rows (e.g., ON CONFLICT (candidate_id) DO NOTHING on duplicate candidate_ids from the pre-dedupe nex_dev source). This remains **unverified without the pre-promotion archive**. |
| actionable | the row-level JSON dump at `logs/stage0-evidence/orphans-2026-10-13.json` captures all 197 ids + their name_canonical + city + osm_id + category_ids + created_at. That dump is sufficient to execute either path (repair OR delete) deterministically when authorised. |

**Owner decision recorded: preserve. No action taken.**

---

## 2 · Stage A · category mapping · before counts (reversible)

The proposed mapping handles the 11 alias collisions and 4 "-v2" variants flagged in Phase 4 (see Stage 0 §6). Measured BEFORE counts on the live DB:

| kind | from | to | canonical rows carrying `from` | library rows for `from` | owner profiles pinning `from` |
|---|---|---|---|---|---|
| variant | yoga-v2 | yoga | 0 | 1 | 0 |
| variant | camping-v2 | camping | 0 | 1 | 0 |
| variant | fishing-v2 | fishing | 0 | 1 | 0 |
| variant | bike-rental-v2 | bike-rental | 0 | 1 | 0 |
| alias-merge | **coat-seller** | **clothes** | **246** | **1** | **0** |
| alias-merge | kebab-house | meat-kebab | 0 | 1 | 0 |
| alias-merge | wedding-events | wedding-agents | 0 | 1 | 0 |
| alias-merge | pets-supplier | pet-supplies | 0 | 1 | 0 |
| alias-split | drop alias `dentist` on entry `health` | — | n/a | n/a | n/a |
| alias-split | drop alias `tour-guide` on entry `travel-agency` | — | n/a | n/a | n/a |
| alias-split | drop alias `massage-spa` on entry `massage` | — | n/a | n/a | n/a |

**Only one proposed rename moves data: `coat-seller → clothes` (246 canonical rows).** Every other rename is metadata-only — the DB has zero canonical rows and zero owner profiles using the "from" slug.

### Honouring Safeguard B · explicit, transactional, before/after

If approved, the rename is a single transaction. SQL draft (NOT applied):

```sql
BEGIN;

-- 1 · snapshot pre-counts (captured in a scratch table so a dry-run
--     and the apply can be compared row-by-row)
CREATE TEMP TABLE _rename_snapshot AS
  SELECT 'coat-seller'::text AS slug,
         (SELECT COUNT(*)::int FROM nex.business_canonical WHERE 'coat-seller' = ANY(category_ids)) AS before_canonical,
         (SELECT COUNT(*)::int FROM nex.business_canonical WHERE 'clothes'    = ANY(category_ids)) AS before_clothes;

-- 2 · the actual replace (array-safe · idempotent · reversible)
UPDATE nex.business_canonical
   SET category_ids = array_replace(category_ids, 'coat-seller', 'clothes')
 WHERE 'coat-seller' = ANY(category_ids);

-- 3 · verify
WITH after AS (
  SELECT (SELECT COUNT(*)::int FROM nex.business_canonical WHERE 'coat-seller' = ANY(category_ids)) AS a_coat,
         (SELECT COUNT(*)::int FROM nex.business_canonical WHERE 'clothes' = ANY(category_ids))     AS a_clothes
)
SELECT CASE
         WHEN a_coat <> 0 THEN raise_exception('coat-seller still present')
         WHEN a_clothes <> (SELECT before_canonical + before_clothes FROM _rename_snapshot)
              THEN raise_exception('clothes count mismatch')
         ELSE 'ok'
       END
  FROM after;

COMMIT;
```

Rollback is symmetric: `array_replace(category_ids, 'clothes', 'coat-seller')` **limited to the rows previously snapshotted** (we must preserve genuine `clothes` rows that existed before). The snapshot captures them so the rollback is targeted.

### Library-side mapping (metadata, zero row movement)

For the 4 "-v2" variants, the proposal is NOT to delete anything from `nex.category_image_library`. Instead:

- Add a second library row for the canonical slug (e.g., `yoga`) with `variant_tag = 'alt_2026-10-13'` and the image URL that was previously under `yoga-v2`.
- Mark the `yoga-v2` library row `active = false` (not deleted, so historical lookups still resolve). The resolver's `.filter((r) => r.active)` already honours this.
- Remove the four `-v2` entries from `CATEGORY_METADATA` in a code change.

Zero image file deletions. Zero data loss.

---

## 3 · Stage A · build-time slug/alias validator (DRAFT)

Location: `logs/stage-ab-prep/stageA-slug-validator-DRAFT.ts`

This is a vitest file **sitting outside `src/`** so it is not part of the live build. When Stage A rename is authorised and merged, the file moves to `src/lib/nex-native/directory/__tests__/category-metadata-validator.test.ts` and runs on every test run.

### What it catches

| guard | failure mode today | expected after Stage A |
|---|---|---|
| duplicate canonical slug | 0 (keys are unique) | 0 |
| slug pattern violation (DB CHECK: `^([a-z][a-z0-9-]*|\*)$`) | 0 | 0 |
| **alias collides with another entry's canonical slug** | **11** (Stage 0 count) | **0** (BLOCKING) |

Running the validator **today** will FAIL. That failure count (11) is the exact gate Stage A must bring to zero. The failure message prints every offending `(entry → alias → collides-with)` triple so the fix list is explicit.

### Why "logs/" placement, not "src/" yet

Per your Safeguard C — the validator landing in `src/` with 11 failing tests would immediately turn CI red. The agreed sequence is:
1. Approve Stage A rename plan.
2. Rename happens in one commit (metadata + library) · zero DB writes.
3. Validator moves into `src/` in the SAME commit.
4. Test suite runs green.
5. Separately, authorise the one-row-moving SQL (`coat-seller → clothes`).

---

## 4 · Stage B preparation · WIP migration review

File: `nex-supabase/migrations/999_WIP_add_canonical_business_id_to_nex_business.sql`

### Statement-by-statement audit

```sql
BEGIN;

ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS canonical_business_id uuid;

COMMENT ON COLUMN public.nex_business.canonical_business_id IS '...';

CREATE UNIQUE INDEX IF NOT EXISTS nex_business_canonical_business_id_uq
  ON public.nex_business (canonical_business_id)
  WHERE canonical_business_id IS NOT NULL;

COMMIT;
```

| statement | effect on live schema | risk | reversible? |
|---|---|---|---|
| `ALTER TABLE ... ADD COLUMN IF NOT EXISTS canonical_business_id uuid` | adds a nullable column · 169 existing rows get NULL · instant on 169 rows | low | yes · `DROP COLUMN IF EXISTS` |
| `COMMENT ON COLUMN` | metadata only | zero | yes · reset to NULL |
| `CREATE UNIQUE INDEX IF NOT EXISTS ... WHERE canonical_business_id IS NOT NULL` | partial unique index · zero rows match the predicate (all are NULL post-ALTER) · completes almost instantly | low | yes · `DROP INDEX IF EXISTS` |
| wrapped in `BEGIN; … COMMIT;` | atomic | low | if the operator aborts between statements, the whole migration rolls back |

### Known pre-flight checks (from Stage 0, re-usable)

- `nex_business.canonical_business_id` column **does NOT exist** today ✓ (confirmed in Stage 0 §1)
- `nex_business` row count = **169** · ALTER TABLE lock is microseconds ✓
- `nex.business_canonical.canonical_business_id` is `uuid` · matches the planned soft-FK type ✓
- `nex.business_claim` row count = **0** · migration lands with empty backfill ✓
- No index name collision for `nex_business_canonical_business_id_uq` (none of the 13 existing indexes use that name)
- No existing FKs out of `nex_business` to break

### Deviations from `CREATE INDEX CONCURRENTLY`

The migration uses plain `CREATE UNIQUE INDEX IF NOT EXISTS` **inside** a `BEGIN/COMMIT` block. On an empty partial index this is instant and takes an `ACCESS EXCLUSIVE` lock for the duration of the (very short) index build. On 169 rows this is sub-millisecond. **No need to upgrade to CONCURRENTLY.**

If the owner later authorises the migration at a time when `nex_business` has grown to hundreds of thousands of rows, the operator would at that point rewrite as:

```sql
-- OUTSIDE a transaction:
ALTER TABLE public.nex_business ADD COLUMN IF NOT EXISTS canonical_business_id uuid;
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS nex_business_canonical_business_id_uq
  ON public.nex_business (canonical_business_id) WHERE canonical_business_id IS NOT NULL;
```

Not required today.

### Rename-before-apply discipline (per the file's own header)

The file name begins `999_WIP_` deliberately so no automated migration runner picks it up. The operator step is:

```
mv 999_WIP_add_canonical_business_id_to_nex_business.sql 188_add_canonical_business_id_to_nex_business.sql
```

(188 continues from the sealed sequence 185/186/187 I shipped earlier this session.)

The rename happens in a single commit **together with** the reconciler enable toggle; the actual psql apply happens **separately** against the live DB.

---

## 5 · Stage B preparation · reconciler code review

File: `src/lib/nex-native/cross-db-reconciler/reconciler.ts` (396 lines) + `log-service.ts` + `feature-flag.ts` + `types.ts`

### Default-off safety posture (verified)

| gate | default | observed in code |
|---|---|---|
| `isReconcilerEnabled()` | `false` | reconciler returns `feature_disabled` immediately, no log row |
| `isReconcilerSimulateOnly()` | `true` | even with master=on, dry-run writes a simulated audit row and never hits Supabase |

### Decision tree (as implemented)

```
feature flag off           → feature_disabled              (no log row)
simulate-only on           → simulation_only               (one simulated log row)
Supabase client unavailable→ supabase_error                (one log row · retryable)
UPDATE affects 1 row       → linked_existing               ✓ happy path
UPDATE affects >1 row      → ambiguous_multiple_profiles   ← Safeguard A trigger
UPDATE affects 0 rows      → INSERT stub nex_business row
INSERT affects 1 row       → stubbed_new                   ✓ fresh-owner path
INSERT raises 23505        → ambiguous_multiple_profiles   ← unique-index enforcement
Any other error            → supabase_error                (retryable with backoff)
```

### Honouring Safeguard A · claim ≠ successful identity link

The reconciler's design ALREADY provides what Safeguard A asks for:

| Safeguard A requirement | Where it lives in the reconciler |
|---|---|
| canonical cannot link to multiple owners | the partial unique index `WHERE canonical_business_id IS NOT NULL` + `ambiguous_multiple_profiles` outcome |
| owner cannot link to multiple canonicals | the `UPDATE ... WHERE owner_account_id = X AND canonical_business_id IS NULL` guard · if the owner already has 2+ nex_business rows, `rowCount > 1` triggers `ambiguous_multiple_profiles` |
| linked account consistent with verified claim | the reconciler's `supabaseAccountId` is the `claimed_by_account_id` on `business_claim` · claim-service passes it in |
| failed reconciliation visible, logged, retryable | `log-service.ts` writes to `nex.reconcile_audit_log` with UNIQUE (idempotency_key, attempt_number) · `supabase_error` outcomes carry `retryAfterMs` with 1s/5s/25s exponential backoff |
| partial failure handling | the UPDATE/INSERT path is single-table so there's no multi-table partial state; failed inserts leave `canonical_business_id` NULL on the existing row |

### Missing piece — `VERIFYING_IDENTITY_LINK` state

You explicitly asked for a state between claim `PENDING` and claim `VERIFIED` that captures "code was correct, but the cross-DB link isn't written yet."

Today's `claim-service.ts` writes `OWNER_CLAIMED` on `business_canonical.lifecycle_state` as part of the same transaction that writes `business_claim.state = 'VERIFIED'`. It does NOT call the reconciler.

**Proposed Stage B wiring (code only; not applied):**

1. Add new claim state `VERIFYING_IDENTITY_LINK` (purely application-level, not DB-enforced yet — the sealed `business_claim.state` CHECK would need to admit the new value; migration deferred to Stage B apply).
2. `claim-service.verifyClaim()` flow becomes:
   a. Verify code.
   b. Set `business_claim.state = 'VERIFYING_IDENTITY_LINK'`.
   c. Call `reconcileVerifiedClaim(args)`.
   d. If outcome is `linked_existing` or `stubbed_new` → set `business_claim.state = 'VERIFIED'` + bump `business_canonical.lifecycle_state = 'OWNER_CLAIMED'`.
   e. If outcome is `ambiguous_multiple_profiles` → leave claim state at `VERIFYING_IDENTITY_LINK`, surface the ambiguity, retry is operator-driven.
   f. If outcome is `supabase_error` → leave claim at `VERIFYING_IDENTITY_LINK`, exponential retry queue (same backoff the reconciler already returns).
3. UI gates: the "verified" badge on the business page does not render until `business_claim.state = 'VERIFIED'`.

**None of this is implemented yet.** It is a Stage B deliverable waiting on Stage B authorisation.

---

## 6 · Stage B preparation · test plan

Required before any Stage B production apply:

### Reconciler tests (existing + proposed)

Existing: `src/lib/nex-native/cross-db-reconciler/reconciler.test.ts` already covers the eight outcomes above (`feature_disabled`, `simulation_only`, `supabase_error`, `linked_existing`, `ambiguous_multiple_profiles`, `stubbed_new`, `supabase_error from catch`, 23505-to-ambiguous).

New tests needed for Stage B:
1. **End-to-end claim verify path with reconciler enabled, simulate-off, mock Supabase returning `rowCount=1`** → claim state progresses `PENDING → VERIFYING_IDENTITY_LINK → VERIFIED`.
2. **Same path but reconciler returns `ambiguous_multiple_profiles`** → claim state stays `VERIFYING_IDENTITY_LINK`; the UI "verified" badge does not render; retry endpoint re-invokes the reconciler.
3. **Same path but reconciler returns `supabase_error` three times** → claim stays `VERIFYING_IDENTITY_LINK`; the ambient weekly orphan-sweep is responsible for repair (not implemented; separate stage).
4. **Idempotency** · same (claimId, canonicalId, accountId) retried → identical `idempotency_key`, `recordReconcileEvent` returns `alreadyRecorded = true`, no duplicate rows.
5. **Rollback drill** · apply migration 188 against a Supabase branch → add 1 nex_business row with `canonical_business_id` set → DROP INDEX + DROP COLUMN → confirm `nex_business` is intact and the backup table captures the dropped link.
6. **Face-cover regression** · migration apply does NOT touch any `cover_layout_id` value · spot-check on the 1 populated row.
7. **Pre-flight gate** · a run of `scripts/audit-stage0-production-baseline.mjs` immediately before + immediately after the migration apply shows identical fingerprints for everything OTHER than the schema delta.

### Identity 1:1 integration tests (hitting a scratch Supabase)

1. Create 2 nex_business rows for the same owner, both NULL — reconciler called → UPDATE affects 2 rows → `ambiguous_multiple_profiles`.
2. Reconciler called twice with the same (claimId, canonicalId, accountId) — second call is a no-op; audit log shows attempt 2 with `alreadyRecorded = true`.
3. Two owners each claim the SAME canonical — the second claim's reconciler INSERT raises 23505 → `ambiguous_multiple_profiles`.
4. Reconciler called with an unknown canonical id — the migration's constraint is NOT a FK, so Supabase accepts the write. The claim-service pre-flight (step a above) must reject before calling. Add that test on the claim-service side.

### Unclaimed-listing regression tests

Unclaimed directory listings must continue to resolve. Specifically:
- `/nex-native/directory/[id]` for a canonical row that is NOT the subject of any `business_claim` → shows the claim affordance (OwnerClaimForm). No reconciler call. No `nex_business` row required.
- `/nex-native/[businessSlug]` for a `nex_business` row with `canonical_business_id = NULL` → renders normally (today's behaviour).
- Peer chat `/nex-native/chat/peer/[peerAccountId]?focus_product=X` for a peer with no linked canonical → focused-shop-sheet still mounts if the peer has a nex_business + live products; the canonical linkage is irrelevant to the thumbnail path.

---

## 7 · Honouring your "guessing between identifier types" line

Your approval said: *"Directory detail, owner business pages and peer chat resolve to the intended business and account without guessing between identifier types."*

The three identifier spaces today:
- `canonical_business_id` (uuid) · directory routes
- `nex_business.slug` (text) · owner business pages
- `nex_account.id` (uuid) · peer chat

Stage B gives us one new column (`nex_business.canonical_business_id`) which lets a route explicitly express which identifier space it wants to join FROM. Proposed resolver service (code only, not written in this report):

```
getBusinessByCanonicalId(uuid)      // for /directory/[id] → owner redirect
getBusinessBySlug(slug)             // for /[businessSlug]  (today's path)
getPeerBusinessForAccountId(uuid)   // for /chat/peer/[accountId] → focused-shop-sheet
```

Each function knows exactly which column it queries. No implicit coercions. No ambiguity.

Stage B does NOT need any production routing changes to be authorised. The resolver service lands in a later stage **after** the reconciler proves out.

---

## 8 · Face-cover is still untouched

- No file under `src/app/nex-native/cover/*` is in the Stage 0/A/B scope.
- Schema inspection in Stage 0 only verified column existence + row counts. No cover_layout_id value or chat_theme value was fetched, dumped, or hashed.
- The planned Stage B migration adds a column to `nex_business` · it does not re-type, re-order, or modify `cover_layout_id`. Verified by reading migration 999_WIP line-by-line (§4 above).
- Rollback plan preserves everything else: the DROP COLUMN removes only `canonical_business_id`.

---

## 9 · Honouring your Safeguard C · deployment ≠ build

Before any Stage A row-moving SQL or Stage B migration is applied, I will deliver:

1. **Schema evidence** · `pg_get_constraintdef` + `information_schema.columns` output before + after.
2. **Data integrity** · the full `scripts/audit-stage0-production-baseline.mjs` run with its two fingerprint re-measurements; the orphan fingerprint stays identical, the canonical-slug fingerprint stays identical (unless the rename is the subject of this stage).
3. **Route-resolution evidence** · `curl -I` on `/nex-native/directory` + `/nex-native/directory/{a-sampled-id}` + `/nex-native/{aisha-vintage-cameras}` + `/nex-native/chat/peer/{peer}?focus_product={id}` after the apply.
4. **Regression test output** · 21 Phase 3 tests + the new reconciler integration tests all green.
5. **Rollback drill** · the exact SQL for backout and the backup table rows captured.

Nothing is reported "complete" until all five.

---

## 10 · What I did NOT do

- No `INSERT` / `UPDATE` / `DELETE` / `DDL` on live Supabase.
- No migration file renamed, no migration applied.
- No orphan canonical deleted (owner's A2 decision: preserve).
- No synthetic test row deleted.
- No category rename, no alias merged, no POI reclassification.
- No reconciler toggle flipped (both gates still default-off).
- No `src/` edit beyond what's already in commit `a2427c7` (phase-3 thumbnail row).
- No new file in `src/` from this stage (the slug validator is in `logs/` as a draft).
- No face-cover value read, dumped, hashed, or modified.

---

## 11 · What I'm asking you to approve next

| option | effect | my preference |
|---|---|---|
| **Stage A apply** · the category metadata cleanup commit (4 "-v2" removed + 7 colliding aliases dropped + validator moved into `src/`) + the one-row-moving SQL (`coat-seller → clothes`, 246 rows) | metadata-only commit + one targeted UPDATE in a transaction with pre/post count validation | recommended first |
| **Stage B migration apply** · rename `999_WIP_...sql → 188_...sql` + psql apply the ALTER + CREATE INDEX against the live DB | adds the nullable column + partial unique index · empty backfill (0 claims to migrate) · instant on 169 rows | low-risk, straightforward · ready after Stage A |
| **Stage B reconciler wire-in** · flip `isReconcilerSimulateOnly()` to false, add the `verifyClaim()` call-site, land `VERIFYING_IDENTITY_LINK` state, add the 7 new tests | code change · no DB writes until an actual claim verifies | after Stage B migration apply |
| **Deferred** · 197 orphans, synthetic row, POI labelling, directory image enrichment, slug history, Stage C/D/E/F | these all stay pending explicit, separately-worded approval | yes |

My recommendation: **approve Stage A apply as the next step** (metadata + the single 246-row rename in one transaction, with before/after counts captured). It is lower risk than Stage B, exercises the exact "explicit mapping with before/after" pattern Safeguard B demands, and when it lands green it builds confidence for the Stage B migration apply.

Awaiting your green light.
