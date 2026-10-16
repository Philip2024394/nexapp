# NEX Harvester · Email Qualification Doctrine · DRAFT · 2026-10-16

> **Status: DRAFT · OWNER MUST FILL IN LEGAL BASIS + OPT-OUT MECHANISM BEFORE ENABLING LIVE WALKS.**
>
> This document pairs with migration 202 (`202_nex_business_canonical_email_qualification.sql`) and the sealed implementation in `src/lib/nex-native/harvest/email-backfill-orchestrator.ts`. Neither is live until the owner authorises the three gates named below.
>
> **Revision 2026-10-16 (same day):** owner review flagged "FOUND = QUALIFIED" as too permissive. The schema is unchanged but the state machine was revised so only `email_status='VALIDATED'` promotes to `qualification_status='QUALIFIED'`. `FOUND` keeps the row at `PENDING` awaiting the deliverability layer. Preservation rules added: `DISQUALIFIED` is an admin lock; `QUALIFIED` is never downgraded by a transient re-walk.
>
> **Phase 1.3 revision 2026-10-16 (same day):** Phase 1.2 audit identified three blockers which this revision fixes **code-only** · no new migration, no DB writes, no commits.
>
> 1. **UNQUALIFIED retry cooldown (7 days).** The orchestrator SELECT now picks up `qualification_status='UNQUALIFIED'` rows whose `email_last_attempted_at` is NULL or older than 7 days. `DISQUALIFIED` and `QUALIFIED` are still excluded. Admins can still manually flip a row back to `PENDING` to force an immediate re-walk.
> 2. **Failed-fetch cursor advancement.** Both the walker-throw path and the main-UPDATE-throw path now run a **cursor-only** `UPDATE … SET email_last_attempted_at = now()` recovery query before continuing. This advances the cursor without touching `email`, `email_status`, or `qualification_status`, so a transient failure can't deadlock the batch head. If even the recovery UPDATE throws, the error is counted and the next tick re-picks (NULLS FIRST), which is intentional · we never swallow repeated DB failures.
> 3. **VALIDATED contract defined.** New primitive at `src/lib/nex-native/harvest/email-validation.ts` with three distinct layers:
>    1. **Format gate** · lightweight regex matching migration 202's CHECK constraint.
>    2. **Authoritative source attribution** · email domain must equal, or be a strict subdomain of, the business's `website_apex` host. A `john@gmail.com` found on `acme.co` is a third-party address, not authoritative. Dot-boundary semantics prevent look-alikes (`acme-fake.co` is NOT a subdomain of `acme.co`).
>    3. **DNS MX record check** · `dns.resolveMx(emailDomain)` must return at least one record. This proves the domain is **configured** to receive mail · it deliberately does NOT prove a specific mailbox exists or will accept a message. SMTP RCPT TO handshake is explicitly not performed (noisy, often blocked, prone to false positives). An honest VALIDATED means "all three layers passed," not "we definitely delivered to this mailbox."
>
>    The validator is wired into `walkOneRowSafe` as an injectable option (default: the sealed `validateEmailForBusiness`). The walker is the ONLY runtime path that emits `status: 'VALIDATED'`, and only via the validator's return. This closes audit Finding 2.

---

## 1 · What this feature does

The NEX harvester has historically only persisted business **name + category + location** into `nex.business_canonical`. From this doctrine's effective date (owner-signed), only businesses with a **valid, publicly-sourced business email** are counted as qualified.

Qualification is derived strictly from the presence of a valid email · never from inference, construction, or name-based guessing. The sealed six-method extractor at `src/lib/nex/discovery-world/email-extractor.ts` is authoritative for walked emails. OSM contact tags are accepted directly when present (via `src/lib/nex-native/harvest/osm-email-extract.ts`).

The qualification label lives on `nex.business_canonical.qualification_status` (`PENDING` · `QUALIFIED` · `UNQUALIFIED` · `DISQUALIFIED`) · it is **distinct** from `lifecycle_state` (`DISCOVERED` → `OWNER_VERIFIED` …), which continues to describe canonical identity provenance.

### Qualification state machine (sealed 2026-10-16 revision)

Observed `email_status` drives `qualification_status` through the orchestrator UPDATE:

| email_status observed | qualification_status transition | Meaning |
|---|---|---|
| `VALIDATED` | → `QUALIFIED` | Address passed all three validator layers: format + authoritative source attribution + DNS MX. |
| `FOUND` | → `PENDING` | Address observed but validator did not reach VALIDATED (e.g. third-party source, missing MX, missing apex to attribute against). Awaits a future re-walk or admin review. |
| `NOT_FOUND` | → `UNQUALIFIED` | Walked the website, no email there. Retry-eligible after 7-day cooldown. |
| `INVALID` | → `UNQUALIFIED` | Format rejected. Same cooldown-gated retry rule. |

**Retry cursor (Phase 1.3):** the orchestrator's SELECT eligibility clause is:

```sql
WHERE qualification_status = 'PENDING'
   OR (
     qualification_status = 'UNQUALIFIED'
     AND (
       email_last_attempted_at IS NULL
       OR email_last_attempted_at < now() - INTERVAL '7 days'
     )
   )
```

`DISQUALIFIED` and `QUALIFIED` are deliberately excluded from the cursor. Admins may force an immediate re-walk by flipping a row back to `PENDING`.

**Preservation guards** (short-circuit the transitions above):

| Existing state | Observation | Result |
|---|---|---|
| `qualification_status='DISQUALIFIED'` | any observation | **stays DISQUALIFIED** · admin lock · never overwritten by the backfill |
| `qualification_status='QUALIFIED'` | observation ∈ {`FOUND`, `NOT_FOUND`} | **stays QUALIFIED** · never downgraded by a weak re-walk |
| `email_status='VALIDATED'` | observation ∈ {`FOUND`, `NOT_FOUND`} | **stays VALIDATED** · prevents email-status drift on a flaky re-walk |
| any other state | any observation | normal transition from the table above |

### VALIDATED contract (Phase 1.3 · code-only)

The validator at `src/lib/nex-native/harvest/email-validation.ts` is the ONLY path that emits `status: 'VALIDATED'`. The three layers are deliberately distinct:

| Layer | Purpose | Failure maps to |
|---|---|---|
| **1 · Format** | Matches migration 202's CHECK constraint regex. Rejects obvious garbage. | `INVALID` (no persistence) |
| **2 · Authoritative source attribution** | `emailDomain === apexHost || emailDomain.endsWith('.' + apexHost)`. A `john@gmail.com` on `acme.co` is a third-party address, not authoritative. Dot boundary prevents look-alike domains (`acme-fake.co` is NOT a subdomain of `acme.co`). | `FOUND` · reason `third_party_source` (or `missing_apex_host` if the business has no `website_apex`) |
| **3 · DNS MX record** | `dns.resolveMx(emailDomain)` must return ≥1 record. Proves the domain is **configured** to receive mail · does **NOT** prove a specific mailbox exists or accepts messages. SMTP RCPT TO handshake is deliberately NOT performed (too noisy, too often blocked, prone to false positives). | `FOUND` · reason `no_mx_record` or `mx_lookup_failed` |

An honest `VALIDATED` means **all three layers passed**, not "we definitely delivered to this mailbox." Deliverability-proof-of-receipt is out of scope · if the owner wants that later, it is a Phase 2 capability (double-opt-in email) separate from this qualification layer.

### What this does NOT auto-change

- An OSM-tag email found at discovery time sets `email_status='FOUND'` and lets `qualification_status` default to `PENDING`. The row does NOT become QUALIFIED merely because OSM contributors annotated an address.
- Public-facing directory read predicates stay separate · a QUALIFIED row is a prerequisite, not the whole visibility rule.

### Preservation guarantees under migration apply

- Migration 202 is `ADD COLUMN IF NOT EXISTS` + `DO $$ IF NOT EXISTS ... END $$` on constraints. Pre-existing rows are untouched beyond the PG 11+ fast-path default fill.
- All indexes are partial and additive. No existing index is modified.
- `nex.business_canonical` identity columns (`canonical_business_id`, `name_canonical`, `aliases`, `osm_id`, `wikidata_qid`, lifecycle_state) are not touched.
- Rollback is forward-only by default · see §6.

---

## 2 · Where emails come from

Two sources, in this order of attempt:

1. **OpenStreetMap contact tags** · `email` and `contact:email`. Zero outbound HTTP (we already fetched the tags during OSM harvesting). Low coverage (<10%).
2. **Website walker** · the sealed `website-walk-executor.ts` fetches the business's `website_apex` and runs the six-method extractor. One request per domain, rate-limited.

**Explicitly forbidden** · the governance hard-locks from `website-walk-executor.ts` apply here verbatim:

> * PUBLICLY FOUND EMAIL ≠ GENERATED EMAIL
>   - Never construct `info@domain`
>   - Never derive email from business name
>   - Never MX-invent an address
>   - Emails only from the existing 6-method extractor on real pages
> * Fetcher governance is the fetcher's concern · `NULL_FETCHER` refuses every URL
> * Preserve distinct counters: `pages_fetched` / `emails_found` / `evidence_written`

---

## 3 · Legal basis · OWNER TO COMPLETE

> This section is intentionally left blank in the draft. The owner MUST state the legal basis before the backfill orchestrator is enabled (`NEX_EMAIL_BACKFILL_ENABLED=true`).
>
> Candidate frameworks to consider:
>
> - **UK / EU GDPR**: Article 6(1)(f) legitimate interest (business contact emails published on the business's own site, used to contact that same business). Requires Article 14 notice when data is collected from a source other than the data subject.
> - **Indonesia · UU 27/2022 PDP**: Articles on consent + purpose limitation. `info@` and other role addresses may be out of scope; owner-named addresses are clearly in scope.
> - **Jurisdiction-of-use rules** · if NEX HQ or users operate in markets with ePrivacy / CAN-SPAM / CASL implications, the owner should note the subset of harvested emails that may be used for direct marketing vs. qualification-only internal flagging.
>
> **Owner must fill in** before Phase 4:
>
> > _[Owner statement of legal basis — e.g. "NEX harvests only publicly-published business contact emails for the purpose of determining whether a business is reachable for the NEX directory. Harvested emails are stored under the legitimate-interest basis of GDPR Art 6(1)(f) and NEX's internal 'qualification-only' use. No marketing emails are sent to harvested addresses without separate opt-in."]_

---

## 4 · Opt-out mechanism · OWNER TO COMPLETE

> Businesses whose public email was harvested must have a way to opt out. The owner should state the mechanism before Phase 4.
>
> Candidate shapes:
>
> - A public `/nex-opt-out?email=…` route that writes the email to a sealed exclusion list and purges it from `business_canonical`.
> - An email reply-to address (e.g. `optout@nexapp.com`) with a documented SLA.
> - A `robots.txt`-like `/.well-known/nex-no-harvest.json` convention that businesses can self-publish.
>
> **Owner must fill in** before Phase 4:
>
> > _[Owner statement of opt-out mechanism — route, SLA, and the retention/purge rule applied once an opt-out is received.]_

---

## 5 · Rollout order · HARD-GATED

| # | Phase | Owner gate |
|---|---|---|
| 1 | Draft migration 202 on disk (DONE this session) | — |
| 2 | Apply migration 202 to live DB `ijvqdvsvwtwxzcqmoqit` | **Separate "I, Philip, authorise…" DB-write grant** required |
| 3 | OSM-tag email extraction active on new discoveries (code already lands with the migration; writer falls back on 42703 pre-migration) | — (automatic once gate 2 is cleared) |
| 4 | Fill §3 legal basis + §4 opt-out mechanism above · wire a real `PageFetcher` into `email-backfill-orchestrator.ts` · set `NEX_EMAIL_BACKFILL_ENABLED=true` in staging | **Separate owner sign-off** |
| 5 | Monitor HQ dashboard "Canonical qualification status" + "Email status breakdown" (both sections hidden until migration 202 lands) | — |
| 6 | Promote to production env | **Separate owner sign-off** |

**No step jumps the gate ahead of it.**

---

## 6 · Rollback

Migration 202 is forward-only by default. Dropping the columns after user data has landed in them would destroy harvested email records. If a rollback is ever authorised:

1. Dump `email`, `email_source_url`, `email_verified_at`, `email_status`, `qualification_status`, `email_last_attempted_at` to a side table in the same DB (`nex.business_canonical_email_backup_<timestamp>`).
2. Verify the side-table row count matches the source.
3. Then run the rollback SQL in migration 202's trailer comment.

---

## 7 · Data flow diagram

```
                               ┌───────────────────────────┐
                               │ Vercel cron tick (240s)   │
                               │ src/app/api/.../harvest/  │
                               │   tick/route.ts           │
                               └───────────┬───────────────┘
                                           │
             ┌─────────────────────────────┼─────────────────────────────┐
             │                             │                             │
             ▼                             ▼                             ▼
┌──────────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐
│ overpass-fetcher.ts      │    │ canonical-writer.ts      │    │ email-backfill-          │
│   fetches OSM bbox       │───▶│   extracts OSM email     │    │   orchestrator.ts        │
└──────────────────────────┘    │   via osm-email-extract  │    │   (DORMANT ·             │
                                │                          │    │    env-gated)            │
                                │   INSERTS into           │    │                          │
                                │   nex.business_canonical │    │   pulls PENDING rows ·   │
                                │   · if OSM email · sets  │    │   walks website · writes │
                                │     QUALIFIED            │    │   email + QUALIFIED      │
                                │   · else · PENDING       │    │                          │
                                └──────────────────────────┘    │   gated on real          │
                                           │                    │   PageFetcher (not       │
                                           ▼                    │   NULL_FETCHER)          │
                                 ┌──────────────────────┐       │                          │
                                 │ nex.business_         │◀─────┤                          │
                                 │   canonical           │       └──────────────────────────┘
                                 │   (migration 202)     │
                                 └──────────┬───────────┘
                                            │
                                            ▼
                                 ┌──────────────────────┐
                                 │ HQ harvest dashboard │
                                 │ src/app/nex-native/  │
                                 │   hq/harvest/page    │
                                 │   .tsx               │
                                 │                      │
                                 │ · lifecycle counts   │
                                 │ · qualification      │
                                 │   counts (NEW)       │
                                 │ · email status       │
                                 │   breakdown (NEW)    │
                                 └──────────────────────┘
```

---

## 8 · What this doctrine does NOT authorise

- Running the backfill against live data (Phase 4 gate)
- Sending marketing emails to harvested addresses (separate consent flow required)
- Deleting rows from `nex.business_canonical` for being unqualified (we keep the row and set `qualification_status='UNQUALIFIED'`, retryable)
- Backfilling other contact fields (phone, WhatsApp) at this time
- Changing the directory read predicate · the HQ dashboard separates qualified / pending, but public-facing directory routes are a **separate decision** owner can make once email coverage is understood from the first full-pass backfill

---

## 9 · Sign-off

| Role | Name | Date |
|---|---|---|
| Owner · legal basis | _owner to fill_ | _tbd_ |
| Owner · opt-out mechanism | _owner to fill_ | _tbd_ |
| Owner · migration 202 apply | _owner to fill_ | _tbd_ |
| Owner · backfill enable in staging | _owner to fill_ | _tbd_ |
| Owner · backfill enable in production | _owner to fill_ | _tbd_ |

Until every row has a date, the backfill orchestrator stays dormant.
