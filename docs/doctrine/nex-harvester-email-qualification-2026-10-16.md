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

---

> **Sections 10–17 added 2026-10-27 · owner-review DRAFT.** These sections capture the explicit rules the owner asked to see drafted before any email collection activates. Nothing in these sections authorises anything · every section ends with a clearly-labelled **OWNER DECISION REQUIRED** block. No legal conclusion has been invented. No source is being marked approved.

## 10 · Permitted sources + source-level restrictions · DRAFT 2026-10-27

Three distinct sources exist in the current code paths. Each has a different legitimacy posture that MUST be settled per source before activation.

### 10.1 · Source inventory (as implemented today)

| Source id (in `nex.source_registry`) | Technical path | OSM licence context | Current `can_display` | Required decision |
|---|---|---|---|---|
| `osm_overpass` | `canonical-writer.ts` reads `tags.email` + `tags["contact:email"]` from the Overpass response · zero outbound HTTP beyond the Overpass query already made for discovery | ODbL (database rights) + each contributor retains any individual rights in the field · OSM's own guidance explicitly discourages contact-tag use for mass marketing | `false` | Owner must decide: is OSM contact-tag email in-scope for NEX qualification? Separately: in-scope for display? |
| `business_website` | `email-backfill-orchestrator.ts` → `walkEntityWebsite` → six-method extractor → validator (format + authoritative-source + MX) | Public-facing contact page content, published by the business itself. Access rules depend on the destination site's terms. | `false` | Owner must decide: is walking the business's own website in-scope? If yes, with what rate limits, path allowlist, and `robots.txt` respect posture? |
| `owner_upload` | Not an email path today · owner-upload is image-only via `src/lib/nex-native/business-media/owner-upload-service.ts`. Reserved here for a future owner-provided email flow. | Direct consent from the data subject (the business owner). | `false` | Owner must decide: does NEX ever accept owner-uploaded emails? Different consent requirements apply. |

### 10.2 · Source-level restrictions proposed as DRAFT

| Restriction | Applies to | Rationale |
|---|---|---|
| **No scraping outside the business's own apex host** | `business_website` | Prevents sideways-fetching links on the business's site that point at third-party pages (social media, press articles, aggregators). Already enforced in `_WALKER_NEVER_LEAVES_ENTITY_DOMAIN` sealed export. |
| **No construction / inference** | all sources | Already sealed in `_EXTRACTOR_NEVER_FABRICATES` + the `email-extractor.ts` header. Reaffirmed here as a doctrine clause. |
| **No `robots.txt`-disallowed path fetches** | `business_website` | Not currently enforced. If owner approves `business_website` as a source, respect for the site's own `robots.txt` must be a prerequisite. |
| **Address must be email-shape AND pass the three-layer validator before any marketing use** | all sources | FOUND without VALIDATED is a tentative observation, not a confirmed deliverable address. See §1 state machine. |
| **Role-prefix addresses (`info@`, `contact@`, `hello@`) are flagged separately from personal-name addresses** | all sources | Many jurisdictions treat role addresses as less-sensitive than personal addresses. Flag at persistence time via a `role_prefix` boolean (would require a new column after migration 202 lands · not yet proposed). |

**OWNER DECISION REQUIRED (10.D1 – 10.D5):**
- **10.D1** Is `osm_overpass` email in-scope? YES / NO / qualified-only (no public display, no marketing)
- **10.D2** Is `business_website` walking in-scope? YES / NO / qualified-only
- **10.D3** Will NEX respect destination-site `robots.txt`? YES / NO (recommended: YES)
- **10.D4** Is owner-uploaded email in-scope at this layer? YES / NO / defer
- **10.D5** Should NEX distinguish role-prefix (`info@`, `contact@`) from personal addresses, and treat them differently in use (display, outreach)? YES / NO

---

## 11 · Purpose + lawful basis · DRAFT 2026-10-27

### 11.1 · Purpose statement (DRAFT · owner refines)

> NEX harvests business email addresses from publicly-available business sources (OSM contact tags and the business's own website) for the **sole** purpose of determining whether a business is **reachable** for inclusion in the NEX directory. The address is used, if at all, to send **non-marketing** service communications (directory listing notice · opt-out confirmation · claim-flow emails). Marketing use requires a separate, documented consent flow and is **out of scope** of the harvest layer.

### 11.2 · Lawful basis options · OWNER TO SELECT

| Jurisdiction | Candidate basis | What it permits | Boundary |
|---|---|---|---|
| **UK / EU GDPR Art 6(1)(f)** · legitimate interest | directory inclusion + non-marketing service email | Requires a documented legitimate-interests assessment (LIA) + Art 14 notice (data collected from a third-party source) + visible opt-out | Does NOT cover marketing to the harvested address |
| **UK / EU GDPR Art 6(1)(a)** · consent | any processing listed in the consent text | Requires affirmative, specific, informed opt-in | Not available at harvest time (we don't talk to the business first) |
| **Indonesia · UU 27/2022 PDP** · public-interest / contract preparation | directory inclusion if the directory is in the public interest, or preparing for a contract | Requires owner to formally state the basis + register as a Pengendali Data Pribadi if applicable | Role addresses (`info@`) have a narrower scope than personal addresses |
| **CAN-SPAM (US)** · B2B commercial email | commercial email to businesses if opt-out honoured | Only applies if NEX sends commercial email to these addresses; does not retroactively legitimise collection |
| **CASL (Canada)** · implied consent via published address | B2B commercial email to a published business address | Narrow · requires the address to be published by the business itself and used for a related purpose |

**OWNER DECISION REQUIRED (11.D1 – 11.D3):**
- **11.D1** Which jurisdiction(s) govern NEX's email processing? (depends on NEX HQ location, user location, business location, server location)
- **11.D2** Which lawful basis applies to each permitted source from §10?
- **11.D3** If GDPR legitimate interest is chosen, who authors the Legitimate Interests Assessment + Article 14 "data collected from third party" notice?

---

## 12 · Business-address association + verification evidence · DRAFT 2026-10-27

An email alone is not a confirmed business contact. The address must be associated with the specific canonical business the row represents. The three-layer validator at §1.VALIDATED-contract is the technical gate; this section records the **evidence trail** we store so an auditor can replay a decision.

### 12.1 · Evidence recorded per attempt (via migration 202 columns)

| Column | What it proves | Nullable? |
|---|---|---|
| `email` | the normalised address observed | NULL = never found |
| `email_source_url` | the exact URL where it was observed (e.g. `https://acme.co/contact`) | NULL = not sourced from a walked URL (OSM tag path uses the OSM element URL instead) |
| `email_verified_at` | timestamp of the VALIDATED decision (not persistence time) | NULL = never promoted past FOUND |
| `email_status` | FOUND / VALIDATED / INVALID (never NOT_FOUND persisted · that's a cursor-only state) | NOT NULL once walked |
| `qualification_status` | PENDING / QUALIFIED / UNQUALIFIED / DISQUALIFIED | NOT NULL once walked |
| `email_last_attempted_at` | cursor timestamp · advances on every tick | NOT NULL once walked |

**Not recorded** today: the specific extraction method that produced the candidate (JSON-LD / mailto / obfuscated / plain text / etc). Owner may want this later for evidence-quality ranking · it's a column add decision, deferred.

### 12.2 · Authoritative-source rule (sealed in `email-validation.ts`)

An email is attributed to the business ONLY if its domain **equals** or is a **strict subdomain** of the business's `website_apex`. Dot-boundary enforcement is sealed in `isAuthoritativeSource`:

```ts
emailDomain === apexHost || emailDomain.endsWith(`.${apexHost}`)
```

Edge cases:
- `info@acme.co` on `acme.co` apex → VALIDATED-eligible (domain matches apex)
- `info@orders.acme.co` on `acme.co` apex → VALIDATED-eligible (strict subdomain)
- `info@gmail.com` on `acme.co` apex → FOUND / `third_party_source` (gmail is not the business's apex)
- `info@acme-fake.co` on `acme.co` apex → FOUND / `third_party_source` (not a dot-bounded subdomain · look-alike protection)
- business has no `website_apex` → FOUND / `missing_apex_host` (cannot verify association · stays FOUND, never VALIDATED)

### 12.3 · What this layer does NOT prove

- **Mailbox existence** · a VALIDATED address proves the DOMAIN is configured to receive mail (one or more MX records exist). It does NOT prove the specific mailbox exists or accepts a message. SMTP RCPT TO handshake is **not** performed (sealed §1).
- **Current correctness** · the address may have been valid when scraped and no longer be valid. A re-walk after the 7-day UNQUALIFIED cooldown is the only automatic refresh. See §1.
- **Business ownership of the address** · a business operating from a shared coworking space may list a reception@building.example address. This passes authoritative-source if `building.example` is their published `website_apex`, but the business owner may not control it.

**OWNER DECISION REQUIRED (12.D1 – 12.D3):**
- **12.D1** Is three-layer VALIDATED (format + authoritative-source + MX) sufficient as the "confirmed business email" threshold? YES / NO (if NO, what additional evidence?)
- **12.D2** Should the extraction method be recorded per attempt (column add + schema change)? YES / NO
- **12.D3** For a business with no `website_apex`, is a FOUND email ever usable, or always discarded? KEEP-AS-FOUND / DISCARD

---

## 13 · Retention · deletion · suppression · DRAFT 2026-10-27

### 13.1 · Retention windows (DRAFT · owner approves)

| State | Proposed retention | Rationale |
|---|---|---|
| PENDING (walked once, awaiting a future re-walk) | ≤ 90 days from first `email_last_attempted_at`; if still PENDING after 90 days → auto-flip to UNQUALIFIED | Prevents indefinite "we tried but can't decide" state |
| QUALIFIED | retained while the business row is in the directory; purged when the canonical row is deleted or OWNER_UNCLAIMED | Email follows the business |
| UNQUALIFIED | retained for 7 days (the cooldown); if still UNQUALIFIED after N retries (TBD, suggest 3) → `DISQUALIFIED` | Terminal state after exhausting retries |
| DISQUALIFIED | admin lock · retained for audit (12 months DRAFT), then purged | Preserves the trail of a human decision |

### 13.2 · Deletion triggers

- **Owner-request deletion**: fully purge email + source URL + verified_at + status + qualification columns on the row (NULL them + set `qualification_status='DISQUALIFIED'` with admin note). Do NOT delete the canonical business row itself unless separately authorised.
- **Opt-out received** (see §14): same purge, plus write the normalised email to a suppression list so a future harvest skips it.
- **Canonical business deleted / superseded**: cascade purge the email fields.
- **Jurisdictional right-to-erasure**: honoured within the SLA of the applicable law (GDPR: 30 days; PDP: 30 days under UU 27/2022 Art 20).

### 13.3 · Suppression list

A sealed `nex.email_suppression_list` table (schema TBD · requires a separate migration) stores normalised addresses that MUST NOT be re-harvested. The harvester SELECT eligibility clause (see §1) MUST be extended to `AND normalised_email NOT IN (SELECT email FROM nex.email_suppression_list)` before any re-harvest activates.

**OWNER DECISION REQUIRED (13.D1 – 13.D4):**
- **13.D1** Approve the proposed retention windows, or state alternatives.
- **13.D2** For UNQUALIFIED → DISQUALIFIED promotion, how many retry attempts? (DRAFT: 3)
- **13.D3** Approve the suppression-list design (requires a separate migration, not migration 202).
- **13.D4** For jurisdictional right-to-erasure, who holds the operational responsibility and SLA?

---

## 14 · Opt-out processing + honouring across future harvests · DRAFT 2026-10-27

### 14.1 · Opt-out channels (DRAFT · owner approves one or more)

| Channel | Flow | Operator burden |
|---|---|---|
| **A** · Public `/nex-opt-out?email=…` route | Form submission → email verification (one-time code to the opt-out requester) → write to suppression list + purge row | Low · fully automated |
| **B** · `optout@nexapp.com` mailbox | Human triage → verify request → suppression list + purge | Medium · requires monitored inbox |
| **C** · `/.well-known/nex-no-harvest.json` on the business's own site | Harvester checks before walking | Low on NEX side; requires businesses to self-publish |
| **D** · Direct NEX account action (owner-claimed business clicks "remove email from NEX") | In-app flow in the owner-claimed business profile | Low · reuses existing claim/session infra |

Not every business will see every channel. DRAFT recommendation: **A + D** at minimum. A is the discoverable public opt-out; D is for owners who are already in NEX.

### 14.2 · Future-harvest honouring

Once suppressed, an email MUST stay suppressed across:
- Future OSM tick re-harvests
- Future `business_website` walks
- Future owner uploads (an owner cannot re-add an address that was previously opted-out from THEIR own business, unless they re-opt-in through an explicit affirmative confirmation UI)
- Future bulk operations

Enforcement is a SELECT-side predicate in the orchestrator + an INSERT-side check in `canonical-writer.ts`'s OSM-tag path (new code path · not written yet).

### 14.3 · Opt-out confirmation + audit

- Every opt-out produces an audit row (channel, timestamp, requester identity if any, outcome).
- No opt-out ever requires the opt-out requester to disclose which business the address belongs to · one submission can match multiple rows and all of them are purged.

**OWNER DECISION REQUIRED (14.D1 – 14.D4):**
- **14.D1** Which opt-out channels does NEX offer? (DRAFT: A + D)
- **14.D2** What SLA for honouring an opt-out? (DRAFT: 48 hours maximum, 24 hours target)
- **14.D3** Who monitors the public opt-out intake?
- **14.D4** Does an owner-claimed business's "remove email" action also prevent future RE-collection, or only remove the current row?

---

## 15 · Access control · auditability · PII-safe logging · DRAFT 2026-10-27

### 15.1 · PII-safe logging rule (SEALED by this doctrine)

**Email VALUES must never appear in logs, structured warn events, telemetry, dashboards (except as explicit user-visible counters), audit trails that leave the primary DB, or any artefact the development team can read without an authorised data-access ticket.**

Current enforcement:
- `canonical-writer.ts:224` structured warn for schema-missing drops · **email VALUE deliberately OMITTED** · only `email_source_url` is included (not the address itself).
- `email-backfill-orchestrator.ts:449` structured warn for walker throws · **email VALUE deliberately OMITTED** · only error.name is logged (not error.message, which may contain fragments of a malformed candidate).
- `email-extractor.ts` context_snippet is bounded to ≤200 chars and persisted ONLY in-process (never written to a log sink).

Known gaps:
- The orchestrator UPDATE statements include `$2` = email VALUE in the parameter array. pg's query logger (if enabled) would print this. **DO NOT enable pg query logging** on the harvest DB without a plan to redact the `nex.business_canonical` INSERT/UPDATE paths.
- The HQ dashboard query at `harvest-dashboard.ts` must never render the email VALUE · counters only.

### 15.2 · Access control (DRAFT · owner approves)

| Role | Access to email VALUES |
|---|---|
| Harvest cron (service account) | WRITE only (INSERT/UPDATE on canonical) · never SELECT |
| HQ dashboard page | COUNTS only (`count(*) FILTER (WHERE qualification_status = ...)`) · never SELECT raw emails |
| Admin review screens | SELECT a single row's email for the review decision · logged in `admin_access_log` with reason |
| Owner (Philip) | SELECT with ad-hoc query (today, via direct pooler access) · documented, not restricted |
| Developers (any) | NO access to raw emails in production · dev environment uses synthetic data only |

### 15.3 · Auditability

- Every INSERT/UPDATE of `email` is traceable to a `cycle_id` (already sealed in `aof_cycle` + canonical metadata).
- Every admin SELECT of a specific email VALUE is logged (schema TBD; requires migration or reuse of `nex.social_admin_access_log` structure).
- Every opt-out is auditable (§14.3).

**OWNER DECISION REQUIRED (15.D1 – 15.D4):**
- **15.D1** Confirm the PII-safe logging rule above as sealed policy. YES / NO
- **15.D2** Approve the access control matrix in §15.2 (or state alternatives).
- **15.D3** Who performs admin review of qualification-related rows, and how is their access logged?
- **15.D4** Should pg query logging be explicitly DISABLED on the production harvest DB, by policy? (recommended: YES)

---

## 16 · Downstream display · search · export restrictions · DRAFT 2026-10-27

Harvesting an email ≠ publishing it. Each downstream use is a separate decision gate.

### 16.1 · Public display (directory tile shows email)

- **Default: NO.** The public directory tile does not display a business email unless (a) the row is QUALIFIED, (b) the business is OWNER_CLAIMED or OWNER_VERIFIED, AND (c) the owner has not opted out of email display.
- The owner-claimed status gives us a human confirmation that the business approves of being contacted this way.
- A VALIDATED non-claimed row stays INTERNAL (used for internal "is this business reachable" scoring) · it does NOT light up a public mailto link.

### 16.2 · Search (type an email to find a business)

- **Default: NO.** Email is not a search index term for public users.
- Admin/owner search for operational purposes: separate gate · requires same access-control rules as §15.

### 16.3 · Export (CSV / API / bulk extract)

- **Default: NO public export** of email. The directory API MUST NOT include the email field for anonymous callers.
- Owner-authenticated export of their own business row's email: ALLOWED (it's their data).
- Admin export of operational slice: ALLOWED with audit log entry.

### 16.4 · Source attribution at display time

Any surface that renders an email VALUE (e.g. admin review screen, owner-only mailto) MUST render:
- The `email_source_url` (where NEX saw it)
- The `email_verified_at` timestamp
- The `email_status` + reason (e.g. "VALIDATED on 2026-11-15 via https://acme.co/contact")
- A visible "opt out" link under the address

**OWNER DECISION REQUIRED (16.D1 – 16.D5):**
- **16.D1** Approve the display rule in §16.1 (QUALIFIED + OWNER_CLAIMED required for public mailto), or state alternatives.
- **16.D2** Should email ever appear in public search? YES / NO (DRAFT: NO)
- **16.D3** Should the directory API ever return email for anonymous callers? YES / NO (DRAFT: NO)
- **16.D4** Who can export email data in bulk, under what circumstances?
- **16.D5** Approve the source-attribution-at-display rules in §16.4.

---

## 17 · Approval gates · DRAFT 2026-10-27

The sealed rollout in §5 lists six phases. This section ties each phase to the specific DECISIONS from §§10-16 that must land first.

| Gate | What it unblocks | Required DECISIONS before this gate can clear |
|---|---|---|
| **G-A** · Migration 202 applied | `email`, `email_source_url`, `email_status`, `qualification_status`, `email_last_attempted_at`, `email_verified_at` columns exist · OSM-tag persistence stops dropping · suppression-list migration (if §13 approved) is drafted separately | 10.D1 (OSM in-scope?) · 11.D1 (jurisdiction) · 11.D2 (legal basis) · 12.D1 (VALIDATED threshold) · 13.D1-D3 (retention policy) · 15.D1-D4 (logging + access control) |
| **G-B** · `NEX_EMAIL_BACKFILL_ENABLED=true` in staging | Orchestrator runs against staging rows · still DORMANT_FETCHER (no outbound HTTP) · verifies UPDATE paths against real schema | G-A cleared · 14.D1-D4 (opt-out mechanism exists before any attempt that could later be opted out of) |
| **G-C** · Real `fetchCandidate` injected (replaces DORMANT_FETCHER) | Live walking of business websites · outbound HTTP · real emails flow through validator → DB | G-B cleared · 10.D2 (business_website in-scope?) · 10.D3 (robots.txt policy) · 16.D1-D5 (display rules known) |
| **G-D** · Production enable | Live NEX directory accumulates qualified emails | G-C cleared + 48-hour staging soak + owner final sign-off |

**No gate jumps the gate ahead of it. Each gate is a separate owner authorisation.**

**OWNER DECISION REQUIRED (17.D1):**
- **17.D1** Confirm the gate chain G-A → G-B → G-C → G-D as sealed. YES / NO

---

## 18 · Consolidated owner-decision checklist · DRAFT 2026-10-27

Every DECISION flagged in §§10-17 collected in order:

### Governance
- [ ] 10.D1 `osm_overpass` email in-scope? Y/N/qualified-only
- [ ] 10.D2 `business_website` walking in-scope? Y/N/qualified-only
- [ ] 10.D3 Honour destination `robots.txt`? Y/N
- [ ] 10.D4 Owner-uploaded email in-scope? Y/N/defer
- [ ] 10.D5 Distinguish role-prefix (`info@`) from personal addresses? Y/N
- [ ] 11.D1 Jurisdiction(s)?
- [ ] 11.D2 Lawful basis per source?
- [ ] 11.D3 LIA + Art 14 notice authored by whom (if GDPR LI)?

### Validation threshold
- [ ] 12.D1 Three-layer VALIDATED sufficient as "confirmed"? Y/N
- [ ] 12.D2 Record extraction method per attempt? Y/N
- [ ] 12.D3 FOUND without apex: keep or discard?

### Retention + deletion
- [ ] 13.D1 Retention windows approved?
- [ ] 13.D2 Retry count before DISQUALIFIED (DRAFT: 3)?
- [ ] 13.D3 Suppression list migration approved (separate from 202)?
- [ ] 13.D4 Right-to-erasure operator + SLA?

### Opt-out
- [ ] 14.D1 Which opt-out channels (A/B/C/D)?
- [ ] 14.D2 Opt-out SLA (DRAFT: 48h max, 24h target)?
- [ ] 14.D3 Public opt-out intake owner?
- [ ] 14.D4 Owner-claimed removal also blocks re-collection?

### Logging + access
- [ ] 15.D1 PII-safe logging rule sealed? Y/N
- [ ] 15.D2 Access control matrix approved?
- [ ] 15.D3 Admin reviewer identity + logging mechanism?
- [ ] 15.D4 pg query logging DISABLED by policy? Y/N

### Display + search + export
- [ ] 16.D1 QUALIFIED + OWNER_CLAIMED required for public mailto?
- [ ] 16.D2 Email in public search? Y/N (DRAFT: N)
- [ ] 16.D3 Email in anonymous API? Y/N (DRAFT: N)
- [ ] 16.D4 Bulk export authority?
- [ ] 16.D5 Source-attribution-at-display rules confirmed?

### Gates
- [ ] 17.D1 Gate chain G-A → G-B → G-C → G-D confirmed?

### Final sign-off (brings §9 back into effect)
- [ ] §9 legal basis signed
- [ ] §9 opt-out mechanism signed
- [ ] §9 migration 202 apply signed
- [ ] §9 staging enable signed
- [ ] §9 production enable signed

**Until every box above is ticked, nothing enables.** The current working set — migration 202 unapplied, `NEX_EMAIL_BACKFILL_ENABLED` unset, `DORMANT_FETCHER` default — IS the correct state and must be preserved.
