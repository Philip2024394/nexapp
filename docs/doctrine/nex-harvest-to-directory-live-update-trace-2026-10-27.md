# NEX · Harvest → Directory Live Update Path · READ-ONLY TRACE · 2026-10-27

> **Status: READ-ONLY trace complete.**
>
> **Authority**: owner directive 2026-10-27 · check the live update path without changing code or production data.
>
> **This document DOES NOT:**
> - Change any code, config, or production data.
> - Trigger any job or cron.
> - Modify any schema, trigger, or policy.
>
> **This document DOES:**
> - Trace the harvest → directory update path end-to-end.
> - Report measured counts + timestamps from the live DB (read-only queries).
> - State explicitly which parts are working, which are broken, which are dormant.

---

## 1 · Owner's four questions · direct answers

| # | Question | Measured answer |
|---|---|---|
| **Q1** | When harvesting finds a NEW business, does it get saved to the Directory's data source? | **PARTIAL YES.** Row IS inserted into `nex.business_canonical` as `DISCOVERED`. Visible on `/nex-native/directory/landing` (which reads canonical directly). **NOT** visible on `/nex-native/directory` main search page (which requires lifecycle promotion to `VERIFIED`+). |
| **Q2** | When it finds UPDATED information for an existing business, does that information replace the old record correctly? | **NO.** The writer uses `ON CONFLICT (country, osm_id) DO NOTHING`. If OSM data for an existing business changes (name, address, phone, website, hours, email), the update is **silently dropped**. The DB row stays at its original state forever unless manually touched. |
| **Q3** | Does the live `/nex-native/directory/landing` page show those changes automatically, or does something else need to run? | **LANDING page: auto-shows new DISCOVERED rows** (no cache · `force-dynamic`). Nothing else needs to run **for new inserts** to appear there. **BUT** the main `/directory` search page needs a `DISCOVERED → VERIFIED` promotion that is currently **dormant** (frozen for 15 days). |
| **Q4** | Can Claude demonstrate using existing logs and read-only checks? | **YES.** `nex.aof_cycle` has 459+ cycles; last 10 show hourly cron active. `nex.business_canonical_lifecycle_log` has 17,118 transitions · all between 2026-10-12 11:55 UTC and 2026-10-12 17:09 UTC. Both evidence trails are read without touching production. |

---

## 2 · The five pipeline stages · measured status

### 2.1 · Stage 1 · Harvest cron (ACTIVE but low new-insert rate)

- **Code**: `src/app/api/nex-native/harvest/tick/route.ts` + `src/lib/nex-native/harvest/canonical-writer.ts`
- **Vercel cron**: `/api/nex-native/harvest/tick` on `0 * * * *` (hourly) · maxDuration 300s
- **Last 10 ticks observed** (ordered newest first):

| cycle_id (short) | started_at | ended_kind | candidates_added | city |
|---|---|---|---|---|
| 281f09f7 | 2026-10-27 07:00:41 | completed | **0** | it-milan |
| ad01f841 | 2026-10-27 06:00:41 | completed | **0** | it-rome |
| b8281a5c | 2026-10-27 05:00:41 | completed | **0** | es-barcelona |
| 64ed48bc | 2026-10-27 04:00:41 | completed | **0** | es-madrid |
| 399dc9ad | 2026-10-27 03:00:42 | completed | **0** | fr-lyon |
| 321817fa | 2026-10-27 02:00:41 | completed | **0** | fr-paris |
| c3fffb94 | 2026-10-27 01:00:41 | completed | **0** | de-hamburg |
| cbd9f7e0 | 2026-10-27 00:00:41 | completed | **0** | de-munich |
| 337f6814 | 2026-10-26 23:00:41 | completed | **1** | de-berlin |
| 53b2e10e | 2026-10-26 22:00:41 | completed | **1** | au-perth |

- **Totals**: last 24h added **5 rows**; last 1h added **0 rows**.
- **Interpretation**: cron IS firing but mature cities already saturated with OSM data. `ON CONFLICT DO NOTHING` means duplicates return rowCount=0 → `candidates_added=0`.

### 2.2 · Stage 2 · Writer behaviour on UPDATES (BROKEN by design)

Verified from `canonical-writer.ts` lines 118-170:

```sql
INSERT INTO nex.business_canonical
  (canonical_business_id, name_canonical, entity_type, country,
   lifecycle_state, city, district, category_ids, aliases, osm_id, metadata, …)
VALUES ( … 'DISCOVERED' … )
ON CONFLICT (country, osm_id) WHERE osm_id IS NOT NULL DO NOTHING
```

- A row that already exists for `(country, osm_id)` → **row count 0**, nothing changes.
- OSM-reported changes (new name, new address, new phone, new website, new hours, new email) → **silently dropped**.
- No `DO UPDATE SET` branch exists for the existing-row case.
- The 23,619 rows that have `updated_at > created_at` were updated during the one-time verification pass (see §2.4), not by the writer.

**This is the direct answer to Q2.** The pipeline does not currently handle updates.

### 2.3 · Stage 3 · Vertical walker (DORMANT for 54-59 days)

- `nex.food_business`: 23,328 rows · newest `created_at = 2026-09-04 15:11:44 UTC` · **54 days stale**
- `nex.accommodation_business`: 9,203 rows · newest `created_at = 2026-08-30 00:12:17 UTC` · **59 days stale**
- Rows added in last 24h: **0** across both tables.
- These vertical tables feed enriched detail (menus, amenities, ratings) that the directory JOINs to canonical.
- Current canonical rows (last 15 days) have **zero** attached vertical rows.

### 2.4 · Stage 4 · DISCOVERED → VERIFIED promotion (ONE-TIME · frozen 15 days)

Verified from `nex.business_canonical_lifecycle_log`:

- Total transition log rows: **17,118**
- **100%** are `DISCOVERED → VERIFIED` transitions.
- Earliest transition: `2026-10-12 11:55:41 UTC`
- Latest transition: `2026-10-12 17:09:16 UTC`
- **Window: 5h 13min on 2026-10-12. Nothing since.**
- `max(last_verified_at)` across the entire 87,013-row table: `2026-10-12 17:09:16 UTC` (**15 days ago**)

**Code search** for lifecycle-state writes to `nex.business_canonical`:
- `src/lib/nex-native/claims/claim-service.ts:361` writes `OWNER_CLAIMED` / `OWNER_VERIFIED` only.
- `src/lib/nex-native/harvest/email-backfill-orchestrator.ts` writes `qualification_status`, not `lifecycle_state`.
- **No code anywhere writes `lifecycle_state = 'VERIFIED'`.**

**Interpretation**: the 17,118 transitions on 2026-10-12 were performed by a one-time batch (likely manual SQL, migration script, or a pre-fork tool). The current `nexapp` fork contains no code that advances a `DISCOVERED` row to `VERIFIED`. Automatic end-to-end promotion is **not wired**.

Breakdown of the 40,737 VERIFIED rows:
- 17,118 (42%) have a transition log entry (observed 2026-10-12 promotion).
- 23,619 (58%) have **no** log entry · created directly as VERIFIED by a path other than the current writer.

### 2.5 · Stage 5 · Publication (two paths, different predicates)

**Path A · `/nex-native/directory` (search page)**:
- Code: `src/lib/nex-native/directory/directory-service.ts`
- Reads `nex.business_directory_v`
- View predicate (sealed): `lifecycle_state IN ('VERIFIED', 'OWNER_CLAIMED', 'OWNER_VERIFIED') AND superseded_by_business_id IS NULL AND EXISTS(evidence row with source_registry.can_display=true)`
- **Published row count: 40,541** · 100% ID (Indonesia only · see jurisdiction fact assessment)
- A newly-DISCOVERED row **never appears here** until something promotes it to VERIFIED. **Dormant.**

**Path B · `/nex-native/directory/landing` (landing page)**:
- Code: `src/app/nex-native/directory/landing/page.tsx` → `getLandingFeed` → `fetchCanonicalRows` → `listCanonicalBusinessesPaged`
- Reads `nex.business_canonical` **directly** (LEFT JOIN food/accommodation tables)
- Predicate (code · `local-directory-service.ts:312-314`): `superseded_by_business_id IS NULL AND length(trim(name_canonical)) > 0`
- **No lifecycle_state filter.**
- `export const dynamic = "force-dynamic"` · no cache; each visit re-queries.
- A newly-DISCOVERED row **WOULD appear here** on the next visit, SUBJECT to:
  - Country-filter / category-filter / seed-based ordering per visitor
  - Being within the paged slice the visitor loads
  - Not being superseded or missing a name

### 2.6 · Database triggers · ZERO

Verified from `pg_trigger`:
- `nex.business_canonical` has **zero** non-internal triggers.
- No auto-promotion logic exists at the DB layer.
- No auto-timestamp-stamping beyond default `now()` on `updated_at`.

---

## 3 · Reconciled lifecycle distribution (verified live)

| Lifecycle | Rows | Earliest `created_at` | Latest `created_at` |
|---|---|---|---|
| `DISCOVERED` | 46,276 | 2026-10-08 13:26:42 | **2026-10-26 23:03:45** (yesterday) |
| `VERIFIED` | 40,737 | 2026-10-08 17:47:09 | 2026-10-12 17:09:16 (**15 days ago**) |

**Honest reading**:
- Discovery HAS been continuous since 2026-10-08. New rows arrive (slowly) at the DISCOVERED stage.
- Verified rows are a FROZEN BATCH from 2026-10-08 to 2026-10-12. Nothing has been promoted since.
- The 5-day verified window + the one-off 2026-10-12 lifecycle_log batch indicate a one-time promotion event, not an ongoing process.

---

## 4 · What the owner's hypothesis says vs what the data shows

Owner's hypothesis (verbatim): *"harvesting is active, but automatic end-to-end updating of the visible Directory cards is still unproven."*

**Facts confirm the hypothesis with precision:**

| Pipeline aspect | Status | Evidence |
|---|---|---|
| Harvesting active | **YES** | 10 cycles in last 10 hours, all `ended_kind='completed'` |
| New-insert path (DISCOVERED stage) | **WORKING but slow** | 5 new rows in last 24h · mature cities return ~0 inserts due to `ON CONFLICT DO NOTHING` |
| Update-existing path (OSM data changed) | **BROKEN by design** | writer never issues UPDATE; `ON CONFLICT DO NOTHING` drops the change silently |
| Vertical enrichment (food / accommodation) | **DORMANT** | 54-59 day staleness |
| DISCOVERED → VERIFIED promotion | **DORMANT** | last transition 2026-10-12 17:09; no in-fork code performs this |
| Main search page (`/directory`) visibility of new rows | **BLOCKED** | sealed view requires VERIFIED + `can_display` evidence · new rows satisfy neither |
| Landing page (`/directory/landing`) visibility of new rows | **WORKING but low volume** | direct canonical read with no lifecycle filter + `force-dynamic` route; 5 new rows/day in practice |
| DB triggers that could auto-promote | **NONE** | `pg_trigger` has 0 non-internal triggers on canonical |

**The main `/directory` search page is effectively showing a 15-day-old snapshot** · 40,541 Indonesian businesses frozen from the 2026-10-12 one-time verification batch. New harvests pile up at `DISCOVERED` and never appear there.

---

## 5 · What exists in code to promote rows (BLOCKER inventory)

An honest inventory of what WOULD need to exist to make automatic promotion work (**NOT built or authorised**):

### 5.1 · Missing · a promotion worker

- A scheduled job that queries DISCOVERED rows and advances them based on documented criteria (e.g. has coordinates + name + evidence row + duplicate-check passed).
- Not present in `src/`. Nothing scheduled in `vercel.json` other than the harvest tick.

### 5.2 · Missing · an update path for existing rows

- The writer `ON CONFLICT DO NOTHING` would need to be replaced (or complemented) by `ON CONFLICT DO UPDATE SET …` for the fields that may change.
- A "delta observation" step would need to record WHAT changed in `business_evidence` or a sibling fact-conflict table.
- Not present. The sealed canonical directory spine documentation (`nex-canonical-directory-2026-10-17.md`) implies `business_fact_conflict` as a future primitive but it is not implemented.

### 5.3 · Missing · a reconciliation cadence

- Even with a working update path, OSM tags may be edited at any time. NEX would need a plan for how often to re-visit each row.
- No reconciliation design is captured.

### 5.4 · Missing · vertical walker activation

- `food_business` + `accommodation_business` tables haven't been written to in ≥54 days.
- Whatever walker populates them is not running in the current fork.

### 5.5 · Present but gated · owner-claim path

- `claim-service.ts` DOES write lifecycle `OWNER_CLAIMED` / `OWNER_VERIFIED`. This gate works for owner-driven flows.
- But `business_claim` has **0 rows** live (per earlier Phase 1 verification), so this path has had zero use.

---

## 6 · Prohibited actions preserved

This read-only trace changed nothing. Specifically **unchanged**:

- `canonical-writer.ts` and its `ON CONFLICT DO NOTHING` clause
- `nex.business_canonical` schema + 87,013 rows
- `nex.business_canonical_lifecycle_log` and its 17,118 transition rows
- `business_directory_v` view definition
- No new triggers, policies, grants, or workers
- No harvest cron state
- No change to migration 202 posture (still unapplied)
- No change to `nex-media` or any orphan object
- No change to `source_registry.can_display`

---

## 7 · Owner-decision gates (not advanced by this trace)

Before any automatic update becomes possible, the owner must decide:

| Gate | Decision |
|---|---|
| **UG-1** Does NEX want to promote DISCOVERED → VERIFIED automatically, or keep it manual? | OWNER |
| **UG-2** If automatic: what evidence qualifies a row for promotion? (name + coords only? + category? + OSM freshness proof?) | OWNER + per-source governance |
| **UG-3** Does NEX want OSM-updated data to overwrite existing fields, or preserve existing values on `(country, osm_id)` collisions? | OWNER (data integrity vs freshness trade-off) |
| **UG-4** How is a conflict surfaced when NEX's existing data disagrees with OSM's new data? | OWNER (the canonical spine doc hints at `business_fact_conflict`; not implemented) |
| **UG-5** Reconciliation cadence · how often does the harvester re-visit a city? | OWNER + Overpass rate budget |
| **UG-6** Verticals (food / accommodation) · are the dormant walkers being retired, migrated, or re-activated? | OWNER |
| **UG-7** Should the main `/directory` page continue to require VERIFIED, or soften its predicate to include recent DISCOVERED rows with sufficient evidence? | OWNER + legal review (publication implies NEX stands by the row) |

---

## 8 · What this trace, as recorded, does and does not

### DOES
- Record read-only measured facts about the harvest → directory update path.
- State explicitly which stages are working, which are broken, which are dormant.
- Confirm the owner's hypothesis with specific evidence (dates, counts, log row counts).
- Preserve ALL existing production state unchanged.

### DOES NOT
- Change any code.
- Modify any production data.
- Trigger any job.
- Promote any row.
- Modify the writer, the view, the triggers, or any schema.
- Decide any of the 7 owner gates above.
- Authorise building a promotion worker, update path, or reconciliation cadence.
