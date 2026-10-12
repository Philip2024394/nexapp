# Stage 0 · Production baseline · evidence report

**Run timestamp:** 2026-10-12T17:54:01Z (local 2026-10-13 00:54 WIB)
**Scope:** read-only · zero writes · face-cover untouched beyond column-exists checks
**Audit script:** `scripts/audit-stage0-production-baseline.mjs`
**Full console log:** `logs/stage0-evidence/stage0-console-2026-10-13.log`
**Baseline snapshot JSON:** `logs/stage0-evidence/baseline-2026-10-13.json`
**Full orphan dump JSON:** `logs/stage0-evidence/orphans-2026-10-13.json`

---

## 1 · Environment proof

| field | value |
|---|---|
| approved project id | `ijvqdvsvwtwxzcqmoqit` |
| pooler username project id | `ijvqdvsvwtwxzcqmoqit` ✓ MATCHES |
| pooler host | `aws-0-eu-west-1.pooler.supabase.com` |
| current_database | `postgres` |
| current_user | `postgres` |
| server_version | PostgreSQL 17.6 (gcc 15.2.0, x86_64-pc-linux-gnu) |
| server timezone | UTC |
| pg_is_in_recovery | **false** (primary, not a replica) |
| conn fingerprint (sha256, pwd-redacted) | `25fd363d06d9c60b` |

Schemas visible to the pooler role: `auth`, `cron`, `extensions`, `graphql`, `graphql_public`, `nex`, `nex_taxonomy`, `nex_workforce`, `pgbouncer`, `public`, `realtime`, `storage`, `vault`.

---

## 2 · Headline integrity counts (unchanged from the earlier audit)

| metric | measured | note |
|---|---|---|
| `nex.business_canonical` rows | **40,738** | includes 197 orphans + 1 synthetic row |
| `nex.business_directory_v` rows | **40,541** | 197 orphan food rows + the single DISCOVERED synthetic are hidden by the view's evidence+can_display join |
| `nex.business_evidence` rows | **40,703** | implies 35 canonicals with multi-evidence; 197 with zero evidence |
| `nex.business_canonical_lifecycle_log` rows | **17,118** | 100 % `admin_verify` reason · all from this session's bulk promotions |
| `nex.category_image_library` rows | **307** / 292 active slugs | |
| `nex.source_registry` rows | **10** · 4 of them `can_display=TRUE` | nex_food/accommodation/service legacy + osm_overpass_products_v1 |
| `nex_business` rows | **169** | **cost basis for the identity-bridge ALTER TABLE** |
| `nex_product` rows (status='live') | **120** | across ~10 real seeded businesses |
| `nex.business_claim` rows | **0** | **no claims exist yet · identity-bridge backfill is empty-handed** |

---

## 3 · Orphan canonical rows (A2) · dependency evidence

| finding | value |
|---|---|
| orphan count | **197** |
| by state | 196 × `food/VERIFIED` · 1 × `food/DISCOVERED` (the synthetic row) |
| creation window | 2026-10-08 → 2026-10-11 |
| referenced in `nex.food_business.canonical_business_id` | **0** |
| referenced in `nex.accommodation_business.canonical_business_id` | **0** |
| referenced in `nex.service_business.canonical_business_id` | **0** |
| referenced in `nex.mp_seller.canonical_business_id` | **0** |
| referenced in `nex.business_evidence.canonical_business_id` | **0** (definitional) |
| referenced in `nex.business_media.canonical_business_id` | **0** |
| referenced in `nex.business_claim.canonical_business_id` | **0** |
| referenced in `nex.business_canonical_lifecycle_log.canonical_business_id` | **0** |
| referenced in `nex.business_fact_conflict.canonical_business_id` | **0** |

**ZERO downstream FK dependents across every table that references `nex.business_canonical`.** The 197 orphans are completely isolated identity rows.

**Sampled orphan names (real OSM-derived content, 2026-10-09+ creation):**
- `mansinam beach` · Manokwari
- `De'Java` · Medan
- `KFC` · Denpasar
- `Saga Bakery Cafe` · Jayapura

**Most plausible provenance** (not yet confirmed against `nex_dev`): these are rows copied by `scripts/supabase-backfill-directory-canonical.mjs` from the local `nex_dev` food backfill, where the matching evidence rows failed their `ON CONFLICT (candidate_id) DO NOTHING` guard because duplicate candidate_ids collided. The canonical copy succeeded; the evidence copy skipped. Confirming this would require a read-only cross-join against `nex_dev` (localhost:5433), which is a Stage 0 extension if you want it.

**Options for later authorisation (not executing now):**

| path | risk | reversibility |
|---|---|---|
| delete 197 rows | **lowest** — zero FK dependents, 0 lifecycle_log entries, hidden from directory_v, hidden from every downstream join | not reversible without a snapshot (we have the full JSON dump in `logs/stage0-evidence/orphans-2026-10-13.json`) |
| backfill evidence (synthesise rows citing `nex_food_business_legacy`) | medium — have to be honest about `observation_generator = 'orphan-backfill-2026-10-13'` not the walker | fully reversible by deleting the synthesised evidence; canonical rows stay as-is |
| leave in place | lowest cost | permanent · adds latent integrity debt that will mislead every future audit |

**Owner's decision (recorded):** PRESERVE until evidence confirms the correct action. The evidence above confirms zero downstream risk from deletion. Both options are safe; I await explicit go on which.

---

## 4 · Synthetic proof row

| field | value |
|---|---|
| canonical_business_id | `452568d4-3dab-4064-a0fa-2b9297f2ae3b` |
| name_canonical | `SYNTHETIC NEX FIRST LIVE WRITE PROOF 2026-10-08` |
| city | `SYNTHETIC-CITY` |
| entity_type | `food` |
| lifecycle_state | `DISCOVERED` (never promoted) |
| osm_id | null |
| created_at | 2026-10-08T13:26:42.867Z |
| category_ids | `[]` (empty) |
| **downstream FK references (all 9 tables)** | **ALL ZERO** |

Confirmed isolate · no production code or user path depends on this id. Also included in the 197-orphan set because it has no evidence row.

---

## 5 · Category slug distribution (top of 50 distinct slugs in canonical rows)

```
hotel              6,718
restaurants        1,890
guesthouse         1,706
banks              1,667   (POI landmark)
petrol-station       851   (POI landmark)
super-market         632
salons               615
car-repair           606
gyms                 292
hostel               267
coat-seller          246
kos                  215
atm-machines         213   (POI landmark)
bus-service          103   (POI landmark)
tour-guide           100
apartment             96
train-service         94   (POI landmark)
bars                  82
laundry               79
chalet                78
motel                 65
building-only         57
shoe-seller           52
pet-supplies          43
language-teacher      37
florist               36
noodle-soup           31
grilled-fish          30
car-rental            27
barber-hair           27
property-agent        24
pizza                 24
make-up               17
baby-clothes          13
laptop-repair         13
handbag-seller        12
carpenter              9
spaghetti              8
car-taxi               8
garden-supplies        7
… (10 more slugs with ≤6 rows each)
```

**Only 50 distinct slugs are in use** across all 40,738 canonical rows. The `category_image_library` holds 292 active slugs — meaning **242 slugs have library entries but zero canonical rows yet**. Those are the newly-registered tiles (the b01–b079 batch, plus the aa-tiles with no OSM yield). Images will resolve correctly for them once walker-sourced listings land under those slugs, or once an owner-signup picks them.

**Alias collisions** (from the earlier Phase 4 audit, re-confirmed by this run): 11 cases where an alias on one `CATEGORY_METADATA` entry is the canonical slug of another entry. The run-time `SLUG_INDEX` map silently overwrites earlier entries based on definition order — undefined-behaviour fodder. **No automatic renames executed; the mapping must be designed in Stage A.**

---

## 6 · Identity-bridge safety assessment

The planned migration adds `nex_business.canonical_business_id uuid NULL` + a partial UNIQUE INDEX `WHERE canonical_business_id IS NOT NULL`. Pre-flight checks:

| check | measured | verdict |
|---|---|---|
| column already present on `nex_business`? | **false** | safe to add |
| other table with that column name (archaeology) | `nex.business_canonical.canonical_business_id` (its own PK · expected) · `nex.business_claim.canonical_business_id` (expected FK) · nothing else | no stale shadow definition |
| `nex_business` row count (ALTER TABLE cost basis) | **169** | microseconds · zero-downtime |
| existing FKs OUT of `nex_business` | **none** | clean canvas · ADD CONSTRAINT on a cross-schema reference is novel but syntactically fine; the designed reconciler is a **soft** reference (no DB-level FK) because `nex.business_canonical` lives in a different schema from `public.nex_business` and both are managed in the same Supabase cluster. The reconciler enforces the invariant in application code. |
| `nex.business_canonical.canonical_business_id` data_type | `uuid` | matches |
| existing claim rows (would need backfill) | **0** | migration lands empty-handed · no legacy rows to repair |
| VERIFIED claim rows | **0** | reconciler has nothing to retroactively link |
| `nex_business` existing indexes | 13 indexes (incl. pkey, slug unique) | safe to add a 14th |
| CONCURRENT INDEX feasibility | Supabase user schemas allow `CREATE UNIQUE INDEX CONCURRENTLY ... WHERE ...` | yes |
| row-level locking during ALTER | NOT NULL default would require a rewrite · we're adding NULL · lock is instant on 169 rows | safe |

**Verdict:** the migration is safe to apply when authorised. The backfill is trivially empty because `nex.business_claim` has zero rows. Any later claim will go through the reconciler and get its link written at verify-time.

---

## 7 · Face-cover protection check (read-only)

Explicitly protected surfaces: `src/app/nex-native/cover/*` + `nex_business.cover_layout_id` + `nex_account.chat_theme`.

| field | status |
|---|---|
| `nex_business.cover_layout_id` column | present (unchanged) |
| `nex_account.chat_theme` column | present (unchanged) |
| rows in `nex_business` with `cover_layout_id` set | **1** (count only; values not read) |
| rows in `nex_account` with `chat_theme` non-null | **10** (count only; values not read) |

No cover layout values or chat theme values were queried, logged, dumped, or modified.

---

## 8 · Recoverable baseline

Written to `logs/stage0-evidence/baseline-2026-10-13.json`:

```json
{
  "canonical_total": 40738,
  "directory_v": 40541,
  "evidence": 40703,
  "lifecycle_log": 17118,
  "category_image_library": 307,
  "source_registry": 10,
  "nex_business": 169,
  "nex_product_live": 120,
  "business_claim": 0,
  "orphan_canonical_count": 197,
  "synthetic_proof_row_count": 1,
  "distinct_slugs_in_canonical": 50,
  "orphan_ids_fingerprint": "8126d77daf495a64bf02fff4ae767fa3fb24a502411271d49f8fd3955b4d416d",
  "canonical_slugs_fingerprint": "b80a51035f38c43bed00d87eb02ece8e87ad5116b40df8db9c457394baba51dc",
  "recorded_at": "2026-10-12T17:54:18.673Z",
  "project_id": "ijvqdvsvwtwxzcqmoqit"
}
```

Any later run of `scripts/audit-stage0-production-baseline.mjs` will produce the same two fingerprints iff the orphan set and the slug set are byte-for-byte identical. This is the regression gate for Stages A → F.

---

## 9 · Honouring your three safeguards

### Safeguard A · "do not equate a successful claim with a successful identity link"

Confirmed as a design constraint for the Stage B reconciler. Implementation plan when authorised:
- `nex.business_claim` state transitions to `VERIFIED` only after the reconciler has written `nex_business.canonical_business_id` AND confirmed exactly-one match on both sides (one canonical ↔ one `nex_business`).
- A failed reconciliation stays in a new `VERIFYING_IDENTITY_LINK` interim state, is logged with the failure cause, and is retryable from an admin panel.
- A green claim UI must NOT render until the link is written.
- Regression test: `claim verifies → reconciler writes link → re-fetch claim shows VERIFIED` **AND** `claim verifies → reconciler fails → claim stays non-VERIFIED → retry succeeds` are two separate flows with explicit tests.

### Safeguard B · "do not rename categories by editing strings alone"

Confirmed. Stage A plan when authorised:
- Produce the `OLD_SLUG → NEW_SLUG` mapping as a committed, reviewed TypeScript constant.
- A rename script runs in a single migration transaction: `UPDATE nex.business_canonical SET category_ids = array_replace(category_ids, 'old', 'new')` + corresponding library row additions.
- Historical aliases stay in the library as additional rows pointing to the SAME image under the OLD slug · the resolver already handles multi-row-per-slug deterministically. Old URLs continue to resolve.
- SLUG_INDEX never silently overwrites: the mapping goes through a build-time validation that errors when a new entry's alias clashes with an existing entry's slug.
- Pre- and post-counts for each affected slug are captured and compared.

### Safeguard C · "do not claim production success from a passing build"

Confirmed. For every production write-touching stage I will deliver:
1. Schema evidence: `pg_get_constraintdef` / `information_schema.columns` output BEFORE and AFTER.
2. Data integrity evidence: before/after row counts for every affected table + fingerprint diff of this baseline.
3. Route resolution evidence: `curl -I` HEAD on at least two representative production URLs per touched route.
4. Regression test evidence: targeted vitest + manual spot-check output.
5. Rollback readiness: the exact SQL / git revert plan written and verified before the apply.

No stage will be reported as "complete" without all five.

---

## 10 · Nothing was changed by this run

- No `INSERT` / `UPDATE` / `DELETE` / `DDL` was issued.
- No migration applied.
- No row deleted (orphans + synthetic row still present).
- No category renamed, no alias merged, no POI reclassified.
- No business page / chat page / sign-in page edited beyond the already-committed Phase 3 work (unrelated).
- Face-cover tables read only for column existence + row counts; **no cover value was fetched**.

Local git state unchanged from the Phase 3 commit `a2427c7`. **Still not pushed.**

---

## 11 · Awaiting authorisation

Per your approval, the next structural change in priority order is:

**Stage B · Identity bridge** — low-risk because: 169 nex_business rows, 0 existing claim rows, no shadow column. The migration lands with an empty backfill. Reconciler goes behind an off/sim/on toggle that already exists in `src/lib/nex-native/cross-db-reconciler/reconciler.ts`.

Before Stage B I will deliver:
- Stage B pre-flight evidence (same baseline fingerprint re-measured so we can confirm no drift between now and the apply).
- A dry-run of the migration against a Supabase snapshot or a one-off `CREATE INDEX ... CONCURRENTLY` test on a scratch table.
- The reconciler enablement toggle + a verified rollback (`DROP INDEX` + `ALTER TABLE DROP COLUMN`).

No code changes, no migration apply, nothing beyond this read-only audit until you say "proceed Stage B".
