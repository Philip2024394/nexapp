# NEX · Business Email Coverage Inventory + Missing Email Review Bin · 2026-10-27

> **Status: read-only inventory + proposed classification bin.**
>
> **Authority**: owner directive 2026-10-27 (Workstream C).
>
> **This document DOES NOT:**
> - Collect, fetch, or discover any email.
> - Enable `NEX_EMAIL_BACKFILL_ENABLED`.
> - Activate a real fetcher.
> - Apply migration 202.
> - Add any email field to production schema.
> - Publish, print, or expose any email VALUE.
> - Delete any business record.
>
> **This document DOES:**
> - Report measured counts from `nex.business_canonical` (87,013 rows).
> - Classify every record into the four Workstream C.4 bins without altering it.
> - Flag which decisions must land before any collection begins.

## 1 · Verified coverage facts (read-only, 2026-10-27)

| Fact | Value |
|---|---|
| Total canonical business records | **87,013** |
| Published records (via `nex.business_directory_v`) | **40,541** |
| Records with populated `website_apex` | **2,427** (2.8 %) |
| Records without `website_apex` | **84,586** (97.2 %) |
| Published records with `website_apex` | **2,415** |
| Migration 202 applied | **No** |
| Email columns on `business_canonical` | **None** |
| Captured email count | **0** |
| Email coverage | **0 %** |
| Duplicate name+country groups | 5,442 |
| Superseded rows | 0 |

### 1.1 · Lifecycle × website-availability

| Lifecycle | Total | With website | Without website |
|---|---|---|---|
| DISCOVERED | 46,276 | **0** | 46,276 |
| VERIFIED | 40,737 | 2,427 | 38,310 |
| **Total** | **87,013** | **2,427** | **84,586** |

**Honest reading**: website_apex is only populated on VERIFIED rows (the frozen 2026-10-12 batch per the live-update trace). The 46,276 DISCOVERED rows harvested since have NO website_apex — the canonical writer's `ON CONFLICT DO NOTHING` plus the dormant vertical walkers mean the enrichment chain hasn't attached website data to new rows for 15 days.

## 2 · Classification per Workstream C.4

Every one of the 87,013 records falls into one of four bins defined by the owner directive. **No record is deleted. No record is modified.**

### 2.1 · Bin 1 · Recoverable (approved source available)

**Count: 2,427 records.** All in lifecycle VERIFIED. All carry a non-empty `website_apex`.

**Why Recoverable**: a website is the sealed `business_website` source candidate for a future email-walk (per `nex-source-allowlist-structure-draft-2026-10-27.md` §2.2). The walker remains dormant pending owner authorisation.

**What this bin is NOT:**
- Not a confirmation that walking is permitted (E-D2 pending counsel review).
- Not an authorisation to walk.
- Not a claim that any specific site has a discoverable email.
- Not a prediction of actual yield.

**Required gates before Bin 1 can be acted on:**
- E-D1 Jurisdiction (counsel review)
- E-D2a-c Permitted sources (owner + counsel)
- E-D3 Confirmation definition (owner + counsel)
- E-D4 PII-safe logging sealed as policy
- Migration 202 applied
- `NEX_EMAIL_BACKFILL_ENABLED=true` in staging
- Real `fetchCandidate` injection (replaces `DORMANT_FETCHER`)

### 2.2 · Bin 2 · Uncertain (identity, source or business association needs review)

**Count: 5,442 duplicate name+country groups** (encompasses an unknown number of individual rows — count was done as groups).

**Why Uncertain**: identical lower-cased name within the same country suggests either (a) legitimate chain outlets (Starbucks, Burger King, Dia, Netto City) or (b) harvest duplicates where OSM has multiple entries for the same real-world business. The canonical spine does not currently flag "legitimate chain" vs "duplicate noise."

**Required follow-up:**
- Record-quality review (per owner's C.4 note) · owner authorises a separate scoped audit.
- Chain-detection heuristic design (e.g. compare phone numbers, addresses, OSM relation IDs across same-name rows).
- No action to this bin until the owner authorises the quality review.

### 2.3 · Bin 3 · No permitted source currently

**Count: 84,586 records** (97.2 % of the whole table).

**Why No Permitted Source**: `website_apex` is NULL or empty, and OSM-tag email extraction is architecturally silent-dropping pre-migration-202 (per canonical-writer.ts — tracked in email qualification doctrine, with the audit counter from commit `0718dd3`).

**Breakdown**:
- 46,276 DISCOVERED rows (no vertical table has written to them; harvester wrote identity only)
- 38,310 VERIFIED rows (older frozen batch; website never captured upstream)

**Required follow-up:**
- Vertical walker (food/accommodation) · currently dormant for 54-59 days per the harvest-trace. If the owner re-activates these walkers, they may populate website_apex for a subset.
- OSM contact-tag email path · currently silently dropped pre-migration-202. Audit counter proves the drop; migration 202 unblocks the capture (separately gated).

### 2.4 · Bin 4 · Retired / duplicate candidate (record-quality review)

**Count: 0 superseded rows** (`superseded_by_business_id` is NULL on all 87,013 rows).

**Note**: this bin OVERLAPS Bin 2 Uncertain in intent — Bin 4 is for records already-marked-superseded (none currently exist), while Bin 2 is for records that MAY be duplicates but have not been marked. Both are deferred to the owner-authorised record-quality review. **No record is deleted for being a duplicate candidate.**

## 3 · The missing-email count

Per the owner's framing:

> "The two reports identify owner-only questions. ... Email coverage: total records, existing email coverage, missing-email count."

- **Total records**: 87,013
- **Existing email coverage**: 0
- **Missing-email count**: 87,013

**Important interpretation**: this is a 100 % missing-email state, which is correct given that:
1. Migration 202 is unapplied — the schema has no column to hold an email.
2. Even if the column existed, the backfill is dormant and the fetcher is `DORMANT_FETCHER`.
3. OSM-tag emails observed on new rows are being silently dropped (now counted via `emails_dropped_schema_missing` per commit 0718dd3).

**No record is being removed from the Directory for being in the missing-email state.** All 40,541 published rows remain published whether or not an email is attached.

## 4 · Review bin as a logical queue (not a schema change)

Per the owner directive: "Create a logical **Missing Email Review Bin** in a report or queue artifact, without deleting database records."

### 4.1 · Queue shape

The queue is a MATERIALISABLE VIEW/REPORT (not a new table). To materialise today:

```sql
-- READ-ONLY · to be run as needed, never scheduled against production
SELECT
  canonical_business_id,
  name_canonical,
  entity_type,
  country,
  city,
  lifecycle_state,
  CASE
    WHEN website_apex IS NOT NULL AND length(trim(website_apex)) > 0
      THEN 'bin1_recoverable'
    ELSE 'bin3_no_permitted_source'
  END AS review_bin,
  website_apex,          -- NEVER the email VALUE · migration 202 unapplied
  last_verified_at
FROM nex.business_canonical
WHERE superseded_by_business_id IS NULL
  AND length(trim(name_canonical)) > 0
ORDER BY lifecycle_state, country, name_canonical;
```

### 4.2 · Per-record output fields (per the owner directive)

| Field | Source | Notes |
|---|---|---|
| Stable business record ID | `canonical_business_id` | UUID, immutable |
| Business name | `name_canonical` | Current OSM-sourced name |
| Publication status | `lifecycle_state` + whether in `business_directory_v` | 4 cards in both; most are canonical-only |
| Approved source available | `website_apex IS NOT NULL AND non-empty` | 2,427 YES, 84,586 NO |
| Email-recovery status | **Always `no_email_found`** today | Column does not exist; nothing has been captured |
| Last attempted check | **Always `null`** today | No authorised check has occurred |
| Reason no email is available | `migration_202_unapplied` | Terminal + accurate |
| Recommended next step | Per bin · see §2 | Bins 1/2/3/4 drive the next action |

### 4.3 · Important · NO deletion

Per the owner directive: "Missing email alone must never cause a business to be removed from the Directory or permanently deleted from the database."

- **No row has been deleted** by this inventory.
- **No row has been archived** by this inventory.
- **No row has been superseded** by this inventory.
- All 87,013 canonical rows remain in place.

If the owner later authorises retention/archive, that is a **separate, auditable process** with its own doctrine.

## 5 · Guard rails preserved (verified live post-inventory)

| Guard | State |
|---|---|
| Migration 202 | not applied (0 email columns) |
| `NEX_EMAIL_BACKFILL_ENABLED` | unset |
| Real fetcher | DORMANT_FETCHER |
| `nex.business_media` rows | 0 |
| `nex.business_claim` rows | 0 |
| Nex-media orphans | 913 untouched |
| nex-peer-chat-attachments | 26 untouched |
| Email VALUE leaked to this doctrine | **ZERO** (no email column exists; nothing to leak) |
| Rows deleted / archived | **ZERO** |

## 6 · Owner decisions needed before any collection begins

Recapping the sealed gates from the email qualification doctrine extension + first-round resolutions:

1. **E-D1 Jurisdiction** · unresolved · see `nex-jurisdiction-fact-assessment-draft-2026-10-27.md` (updated with 10 facts resolved + 6 owner-only remaining)
2. **E-D2 Permitted sources** · unresolved · see `nex-source-allowlist-structure-draft-2026-10-27.md`
3. **E-D3 Confirmed-email meaning** · unresolved · 5-state design in `nex-email-five-state-model-draft-2026-10-27.md` (Q1 alignment option A/B/C open)
4. **E-D4 PII-safe logging** · policy direction approved; 5 artefact designs recorded in `nex-pii-safe-logging-artefacts-draft-2026-10-27.md`; implementation gated
5. **Migration 202 apply** · blocked by 1-4
6. **Staging activation (G-B)** · blocked by migration 202
7. **Real fetcher injection (G-C)** · blocked by staging bake
8. **Production (G-D)** · blocked by all above

## 7 · What this inventory, as recorded, does and does not

### DOES
- Classify every one of 87,013 records into the four Workstream C.4 bins.
- Record precise coverage facts measured 2026-10-27.
- Provide the materialisable SELECT template for the review bin.
- Reinforce that no row is deleted for being in a missing-email state.

### DOES NOT
- Collect, discover, fetch, or construct any email.
- Add email fields to any schema.
- Enable backfill, activate a fetcher, or apply migration 202.
- Publish any email in the Directory.
- Delete, archive, or supersede any row.
- Advance any of the 8 gates in §6.

## 8 · Companion documents

- `nex-harvester-email-qualification-2026-10-16.md` (sealed §§1-9 + DRAFT §§10-18)
- `nex-source-allowlist-structure-draft-2026-10-27.md`
- `nex-email-five-state-model-draft-2026-10-27.md`
- `nex-pii-safe-logging-artefacts-draft-2026-10-27.md`
- `nex-first-round-owner-resolutions-2026-10-27.md`
- `nex-harvest-to-directory-live-update-trace-2026-10-27.md` (explains why website_apex is dormant for new rows)
