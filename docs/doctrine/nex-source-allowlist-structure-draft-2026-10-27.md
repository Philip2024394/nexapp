# NEX · Source Allowlist Structure · DRAFT · 2026-10-27

> **Status: structural DRAFT · owner review required.** Documents the SHAPE of the allowlist, not the approved contents.
>
> **Authority**: owner approval 2026-10-27 (E-D2 clarification): "Prepare the source allowlist in the existing email doctrine and reference it from a standalone document if that improves reviewability. Assess sources against applicable jurisdictional requirements and their individual access terms. Re-review a source when a material legal, contractual or operational condition changes. No new source is approved merely by documenting it."
>
> **This document DOES NOT:**
> - Approve any source. Documenting a source ≠ approving a source.
> - Set a lawful basis for any source.
> - Modify `nex.source_registry` or any production record.
>
> **This document DOES:**
> - Define the fields every allowlist entry must carry.
> - Catalogue the sources currently coded in the application, with status = **UNAPPROVED** for all except historically grandfathered ones.
> - Define the re-review trigger.

## 1 · Allowlist entry schema

Every source candidate carries the following fields. All must be populated before an owner can approve the source.

| Field | Type | Required | Purpose |
|---|---|---|---|
| `source_id` | string | yes | Stable identifier; mirrors `nex.source_registry.source_id` once persisted |
| `display_name` | string | yes | Human-readable name for admin UIs |
| `access_mechanism` | enum | yes | `direct_http_walk` / `api_call` / `osm_overpass_tag` / `owner_upload` / `admin_upload` / `legacy_import` |
| `access_terms_url` | string | yes | Link to the source's Terms of Service or data licence |
| `access_terms_last_reviewed_at` | timestamp | yes | When counsel last reviewed those terms |
| `access_terms_summary` | text | yes | Counsel-approved summary of the terms as they apply to NEX use |
| `applicable_jurisdictions` | string[] | yes | List of jurisdictions whose law governs the source (per J-U1-J-U10 of the jurisdiction assessment) |
| `lawful_basis_per_jurisdiction` | object | yes | Map `jurisdiction → lawful_basis` (counsel-authored; not Claude-inferred) |
| `purpose_scope` | enum | yes | `qualification_only` / `directory_display` / `operational_contact` / `transactional_notification` / … (future values require sign-off) |
| `provenance_requirements` | object | yes | What evidence must be captured per record (source URL, retrieval timestamp, licence/consent token, …) |
| `retention_per_state` | object | yes | Per `qualification_status`/`email_status`: max retention window + deletion trigger |
| `rate_limit` | object | optional | Per-domain or per-source throughput ceiling |
| `robots_txt_posture` | enum | yes for direct-walk sources | `respect_always` / `not_applicable` / `respect_disallow_only` |
| `attribution_template` | string | yes if attribution required | Owner-authored display string per licence |
| `can_display` | boolean | yes | Mirrors `nex.source_registry.can_display`. Default false. |
| `approved_by` | string | yes once approved | Owner identity + counsel sign-off reference |
| `approved_at` | timestamp | yes once approved | Date of owner sign-off |
| `review_trigger_log` | array | yes | Each re-review event (date, trigger, outcome) |

**Important**: `applicable_jurisdictions` and `lawful_basis_per_jurisdiction` are populated by counsel + owner, NOT by Claude. See the jurisdiction fact assessment (deliverable #1).

## 2 · Catalogue of currently-coded source candidates

Every entry below is **UNAPPROVED** · listed because the code paths exist, not because any source has owner authorisation.

### 2.1 · `osm_overpass` (email tag) · UNAPPROVED

| Field | Current value |
|---|---|
| `source_id` | `osm_overpass` (already in `nex.source_registry`) |
| `display_name` | OpenStreetMap · Overpass API |
| `access_mechanism` | `osm_overpass_tag` |
| `access_terms_url` | https://www.openstreetmap.org/copyright + ODbL text |
| `access_terms_summary` | **PENDING counsel review**. ODbL is a database-rights licence; individual-field use (contact emails for mass processing) is a nuanced question. OSM community guidance generally discourages contact-tag use for marketing. |
| `applicable_jurisdictions` | PENDING (depends on data subject location per harvested row) |
| `lawful_basis_per_jurisdiction` | PENDING counsel |
| `purpose_scope` | PENDING owner decision (`qualification_only` is the draft default from the email doctrine) |
| `provenance_requirements` | OSM element ref (`osm_<type>_<id>`), tag name (`email` or `contact:email`), observation timestamp |
| `retention_per_state` | PENDING owner decision (see §13 of email doctrine) |
| `rate_limit` | Not applicable at tag-read time (data arrives alongside identity harvest) |
| `robots_txt_posture` | Not applicable (no HTTP walk) |
| `attribution_template` | "© OpenStreetMap contributors (ODbL)" (already in `nex.source_registry`) |
| `can_display` | **FALSE** (current live state preserved) |
| `approved_by` | — |

### 2.2 · `business_website` (direct walk) · UNAPPROVED

| Field | Current value |
|---|---|
| `source_id` | `business_website` (already in `nex.source_registry`) |
| `display_name` | Business's own apex website |
| `access_mechanism` | `direct_http_walk` |
| `access_terms_url` | **PER-SITE**. Each walked site has its own Terms of Service. |
| `access_terms_summary` | **PENDING per-site counsel review** cannot be summarised globally. Common relevant terms: anti-scraping clauses, rate limits, bot policies, authorised-user restrictions. |
| `applicable_jurisdictions` | PENDING (per-domain by site location + user jurisdiction) |
| `lawful_basis_per_jurisdiction` | PENDING counsel |
| `purpose_scope` | PENDING |
| `provenance_requirements` | Observed URL (full), HTTP status, retrieval timestamp, extraction method (JSON-LD / mailto / obfuscated / plain), site response headers (robots.txt result, licence meta tags) |
| `retention_per_state` | PENDING |
| `rate_limit` | DRAFT: 1 request per 1500ms per domain, hard floor 500ms (sealed `email-backfill-orchestrator.ts` constants) |
| `robots_txt_posture` | **PENDING owner decision E-D2c** (DRAFT: `respect_always` recommended) |
| `attribution_template` | PENDING; DRAFT candidate: `"Observed on {domain}"` |
| `can_display` | **FALSE** (current live state preserved) |
| `approved_by` | — |

### 2.3 · `owner_upload` (business owner's own email, future path) · UNAPPROVED

| Field | Current value |
|---|---|
| `source_id` | `owner_upload` (image-only today; reserved for a future owner-email path) |
| `display_name` | Business owner upload |
| `access_mechanism` | `owner_upload` |
| `access_terms_url` | NEX terms (**unauthored**) |
| `access_terms_summary` | Direct consent from the business owner at upload time. Consent captured as a signed-off field, not inferred. |
| `applicable_jurisdictions` | PENDING |
| `lawful_basis_per_jurisdiction` | GDPR Art 6(1)(a) consent is the obvious candidate; counsel confirms |
| `purpose_scope` | Owner specifies at upload time |
| `provenance_requirements` | Authenticated owner account id, business_claim ref, consent-timestamp, consent-version |
| `retention_per_state` | Follows owner's own request + account lifecycle |
| `rate_limit` | Not applicable (user-driven) |
| `robots_txt_posture` | Not applicable |
| `attribution_template` | "Supplied by business owner" (DRAFT) |
| `can_display` | **FALSE** (not implemented for email path today) |
| `approved_by` | — |

### 2.4 · Legacy sources (grandfathered · retained for audit)

| source_id | Status | Notes |
|---|---|---|
| `nex_food_business_legacy` | `can_display=true` (grandfathered) | Owner audit required per I-D2 clarifications |
| `nex_accommodation_business_legacy` | `can_display=true` (grandfathered) | Same |
| `nex_service_business_legacy` | `can_display=true` (grandfathered) | Same |
| `osm_overpass_products_v1` | `can_display=true` (grandfathered) | Same |
| `wikimedia_commons` | `can_display=false` | Not currently in email path (image path only) |
| `wikidata` | `can_display=false` | Not currently in email path (image path only) |
| `user_upload` | `can_display=false` | Non-owner uploads · recommended to stay false permanently (per image doctrine G6) |

**Legacy source audit** (per `nex-image-governance-draft-2026-10-27.md` G7) is a separate task not covered here.

## 3 · Re-review trigger (per owner clarification)

A source entry must be re-reviewed when ANY of the following occurs:

### 3.1 · Legal triggers

- A new jurisdiction becomes relevant (e.g. NEX user base expands to a new country).
- An applicable law changes (e.g. GDPR amendment, new state privacy law takes effect).
- The source's terms of service or data licence changes.
- A new interpretation / regulator guidance affects the source.
- A statutory notice (e.g. ICO ruling) touches the source.

### 3.2 · Contractual triggers

- The source's platform publisher changes commercial terms, API contract, or access permissions.
- A new DPA / sub-processor agreement is signed with the source operator.
- Rate limits or quotas change on the source's side.

### 3.3 · Operational triggers

- NEX changes `purpose_scope` for the source.
- NEX adds a new product surface that would use the source's data differently.
- The source begins returning materially different data (e.g. previously role-only addresses now include personal addresses).
- A documented complaint / takedown request / opt-out spike occurs against data from this source.
- A security incident touches the source's data path.

**Each re-review event is logged in `review_trigger_log` with**: date, trigger category, trigger description, review outcome (unchanged / modified / withdrawn), reviewer identity, counsel reference if applicable.

## 4 · Documenting a source ≠ approving a source

Per owner clarification: adding an entry to this allowlist structure or populating its fields does NOT constitute approval. Approval requires:

1. All fields populated (not PENDING).
2. Counsel sign-off on `access_terms_summary` + `lawful_basis_per_jurisdiction`.
3. Owner sign-off on `purpose_scope`, `retention_per_state`, and `can_display`.
4. Entry promoted into `nex.source_registry` live state via a separately-authorised DB write (NOT by writing this doctrine).

**Writing this doctrine does none of 1-4.**

## 5 · Companion documents

- `nex-harvester-email-qualification-2026-10-16.md` §10 (DRAFT 2026-10-27) · the embedded version of the allowlist (per owner clarification: "Prepare the source allowlist in the existing email doctrine and reference it from a standalone document if that improves reviewability")
- `nex-jurisdiction-fact-assessment-draft-2026-10-27.md` · provides the jurisdictional context counsel needs to answer `applicable_jurisdictions` + `lawful_basis_per_jurisdiction`
- `nex-image-governance-draft-2026-10-27.md` §2 · parallel source governance for image-capable sources

## 6 · What this document, as recorded, does and does not

### DOES
- Define the field schema for allowlist entries.
- Catalogue currently-coded source candidates with status UNAPPROVED.
- Define the re-review trigger per owner clarification.

### DOES NOT
- Approve any source.
- Modify `nex.source_registry` or any production record.
- Set a lawful basis.
- Authorise `can_display=true` for any source currently at `false`.
