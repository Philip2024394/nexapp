# NEX · Image Evidence Gate + Licence Catalogue + Rights Model · DRAFT · 2026-10-27

> **Status: combined design DRAFT (covers I-D1 + I-D2) · owner review required.**
>
> **Authority**: owner approval 2026-10-27:
> - **I-D1 clarification**: "Approve design of the required evidence gate only. The proposal must separately cover uploader authority, image-to-business association, rights evidence, admin review, rejection, removal and audit history. A verified business claim alone is insufficient. Keep all display permissions unchanged."
> - **I-D2 clarification**: "Approve design of a licence catalogue and rights-evidence model only. Compare a NEX-managed catalogue with references to recognized external licence identifiers and terms. Missing or conflicting evidence must fail closed or be quarantined from display pending review. Do not populate production records or change the display gate."
>
> **This document DOES NOT:**
> - Flip `source_registry.can_display` for any source.
> - Insert into `business_media`.
> - Populate `source_registry.licence_id` or `attribution_template`.
> - Modify the sealed image state machine (`image-states.ts`).
> - Build or wire a real persister.
>
> **This document DOES:**
> - Specify the required evidence gate design covering seven aspects (I-D1).
> - Specify the licence catalogue + rights-evidence model design (I-D2).
> - Define the fail-closed / quarantine semantic for missing or conflicting evidence.

## 1 · Required evidence gate · design

### 1.1 · The seven aspects

Per I-D1 clarification, the gate design must separately cover:

| # | Aspect | Role in the gate |
|---|---|---|
| 1 | **Uploader authority** | Who is empowered to supply the image |
| 2 | **Image-to-business association** | What evidence ties the specific image to the specific canonical business |
| 3 | **Rights evidence** | What evidence establishes NEX's right to display |
| 4 | **Admin review** | Who approves / rejects, how the decision is recorded |
| 5 | **Rejection** | How a non-approvable image is cleanly refused |
| 6 | **Removal** | How a previously-approved image is retracted |
| 7 | **Audit history** | What survives in the audit trail |

Each aspect is a **separately-approvable component**. A gate is complete only when all seven have passed.

### 1.2 · Aspect 1 · Uploader authority

**Rule**: an image's `source_id='owner_upload'` row may only exist if the uploader held, at upload time, uploader authority for the target canonical business.

**Authority is proven by**:
- `nex_account.id` matches `business_claim.claimed_by_account_id`
- `business_claim.state = 'VERIFIED'`
- `business_claim.verified_at` ≤ upload time
- `business_claim.revoked_at IS NULL` at upload time
- `business_claim.canonical_business_id` matches the target

**Already sealed** in `owner-upload-service.ts` (per header: "VERIFIED business_claim row for (canonical_business_id, claimed_by_account_id = session.account.id)").

**What this aspect alone does NOT prove**:
- That the image is of this specific business (Aspect 2).
- That the uploader has rights to grant NEX display (Aspect 3).

### 1.3 · Aspect 2 · Image-to-business association

**Rule**: an image may only progress to admin review if there is explicit evidence tying it to the specific canonical business — not merely to its owner.

**Candidate evidence types** (owner selects which qualify):

| Evidence type | What it proves | How captured |
|---|---|---|
| EXIF geotag within N metres of canonical coordinates | Image was taken at the business location | Automatic read from EXIF (then stripped) |
| Uploader-asserted association + metadata signature | Owner explicitly states "this is my business" at upload time | Form field + session attestation |
| Visual reviewer spot-check | Admin visually confirms the image appears to show the business | Admin review step |
| Composite (any two of the above) | Stronger confidence | Row carries which pieces matched |

**Currently in code**: `owner-upload-service.ts` strips EXIF before webp re-encoding. The EXIF geotag check, if added, must happen BEFORE strip.

**Owner decision open**: which combination of evidence types satisfies this aspect?

**What this aspect alone does NOT prove**:
- That NEX may display the image (Aspect 3 rights).

### 1.4 · Aspect 3 · Rights evidence

**Rule**: an image may only progress to admin review if a documented rights basis is captured at upload time.

**Candidate rights-evidence types** (owner selects which qualify):

| Evidence type | What it proves |
|---|---|
| Explicit in-UI click-through consent | Uploader actively accepted NEX's display licence terms at upload |
| Signed NEX terms acceptance (account-wide, one-time) | Uploader accepted NEX terms at account creation and those terms cover owner-upload display |
| Specific licence selector | Uploader selected from a dropdown of allowed licences (CC-BY, CC-BY-SA, "own work · NEX display licence", etc.) |

**Currently in code**: `owner-upload-service.ts` does NOT capture any of these explicitly. The sealed trust chain enumerates MIME / size / dimensions / thumbnail entitlement / EXIF strip / re-encode / INSERT — but no rights field.

**Gap**: `business_media` has `approved=false NOT NULL DEFAULT false`, but no column captures the specific rights evidence (consent timestamp, consent version, licence selection). A column addition (e.g. `rights_evidence_type`, `rights_consent_version`) would be needed when the real persister is authorised.

### 1.5 · Aspect 4 · Admin review

**Rule**: no image displays without an explicit admin approve decision.

**Already sealed** in `image-states.ts` `promoteRightsCheckedToApproved`:
- `reviewerAccountId: string` must be non-null
- `decision: "approve"` (vs `"reject"`)
- `decidedAtIso: ISO timestamp` must be valid

**Row-level sealed**: `business_media.approved: boolean NOT NULL DEFAULT false`.

**Open questions**:
- Who is the admin reviewer (operational title)?
- Review SLA target?
- Review tooling (admin page already exists at `src/app/nex-native/admin/image-review/page.tsx` per grep)?

### 1.6 · Aspect 5 · Rejection

**Rule**: a rejection must be as explicit as an approval. Rejected images do not sit in a passive "not approved" state indefinitely.

**Design**:

- `business_media.approved = false` AND an explicit rejection decision record (reviewer id, decidedAtIso, decision=`reject`, reason) is written to `nex.social_admin_access_log` or a parallel `nex.business_media_review_log`.
- Rejection reasons from a controlled vocabulary (not free text): `wrong_business`, `rights_evidence_missing`, `rights_evidence_contradictory`, `unsafe_content`, `exif_geotag_mismatch`, `uploader_authority_revoked`, `other_with_note`.
- A rejected row is NOT auto-deleted. The audit record persists.

**Open questions**:
- Does a rejected row's underlying bytes stay in `nex-media` bucket (orphan risk), get moved to a cold-storage quarantine bucket, or get deleted after N days? Owner decides.
- May an uploader see "your upload was rejected"? Required for GDPR Art 22 if automated; owner-visible for transparency even if the mechanism is manual.

### 1.7 · Aspect 6 · Removal

**Rule**: a previously-approved image may be retracted. Retraction must be auditable, reversible-tracked, and must honour downstream requests (owner's own removal request, GDPR Art 17 erasure, business reclassification).

**Design**:

- Soft-delete via `business_media.deleted_at` timestamp (would require a column add; `business_media` current schema has no deleted_at per Phase 1 verify).
- Hard-delete via admin action, with the review log preserving the row's existence (identifier + reason) but the row itself removed from `business_media`.
- Underlying storage object: moved to a time-limited quarantine prefix inside `nex-media`, OR deleted after a retention window — owner specifies.
- Any directory tile that references the removed row must gracefully fall back to the no-image placeholder (per image doctrine G12).

**Open questions**:
- Soft-delete or hard-delete default?
- Quarantine window?
- Does a removal propagate to downstream caches / CDN?

### 1.8 · Aspect 7 · Audit history

**Rule**: every state change on an image's gate is auditable.

**Required events logged**:
- Upload attempt (success / failure, reason if failure)
- Rights-evidence capture (which type, consent version)
- Association-evidence capture (which type)
- Admin decision (approve / reject, reviewer id, reason)
- Removal (actor id, reason, soft or hard)

**Already partially sealed**: `src/lib/nex/live/upload-validation.ts` + similar existing patterns. A unified `nex.business_media_audit_log` table would be needed; its schema is deferred.

## 2 · Licence catalogue + rights-evidence model · design

### 2.1 · Core choice: NEX-managed catalogue vs external references

**Per I-D2 clarification**: "Compare a NEX-managed catalogue with references to recognized external licence identifiers and terms."

Two models presented:

#### Model A · NEX-managed catalogue

A new table `nex.licence_registry`:

| Column | Purpose |
|---|---|
| `licence_id` | NEX internal identifier (e.g. `nex_owner_upload_consent_v1`) |
| `display_name` | Human-readable |
| `canonical_terms_url` | Link to the authoritative terms document (NEX-hosted or external) |
| `permits_display` | boolean |
| `permits_derive` | boolean |
| `permits_redistribute` | boolean |
| `attribution_required` | boolean |
| `attribution_template` | if required |
| `effective_from` | timestamp |
| `superseded_by_licence_id` | if the terms were replaced |
| `jurisdiction_notes` | per-jurisdiction nuances |

**Benefits**: NEX controls the mapping; versioned terms; can represent bespoke owner-upload licences cleanly.

**Costs**: licence catalogue needs maintenance; counsel review per entry; versioning discipline.

#### Model B · External identifier references

Instead of a catalogue, `source_registry.licence_id` carries an external identifier:
- SPDX identifiers for software licences
- Creative Commons short identifiers (`CC-BY-4.0`, `CC-BY-SA-4.0`, `CC0-1.0`)
- OSM / ODbL
- Vendor-specific terms URLs

**Benefits**: no table to maintain; well-known identifiers; counsel-reviewed once per external licence.

**Costs**: bespoke licences (e.g. "owner uploaded under NEX display terms v1") don't fit cleanly; display attribution requires separate authoring per identifier; versioning is implicit via the identifier itself.

#### Model C · Hybrid (RECOMMENDED FOR OWNER REVIEW)

NEX-managed catalogue for bespoke licences (owner_upload, user_upload). External identifier references for third-party sources (Wikimedia Commons, Wikidata, OSM).

| Entry | Model |
|---|---|
| `owner_upload` consent licence | NEX-managed (`nex_owner_upload_consent_v1`) |
| `user_upload` consent licence | NEX-managed (if ever approved) |
| Wikimedia Commons CC-BY-4.0 image | External SPDX reference `CC-BY-4.0` + per-image attribution text from the Commons API |
| OSM data | External `ODbL-1.0` reference |

**Open question for owner**: Model A, B, or C?

### 2.2 · Rights-evidence model (per image)

For each `business_media` row, the following rights-evidence fields are proposed (require a column add on real-persister build):

| Column | Purpose |
|---|---|
| `licence_id` | FK to `nex.licence_registry` OR external identifier string |
| `rights_consent_type` | enum: `in_ui_click_through` / `account_terms_v{N}` / `source_published_terms` / `third_party_api_captured` |
| `rights_consent_version` | string: terms version at consent time |
| `rights_consent_timestamp` | timestamp when consent was captured |
| `rights_evidence_payload` | jsonb: structured evidence (click-through token, Commons API response snippet, etc.) |
| `attribution_text` | string if licence requires attribution; owner-authored or source-captured |
| `attribution_url` | optional link to source |

### 2.3 · Fail-closed / quarantine semantic

**Per I-D2 clarification**: "Missing or conflicting evidence must fail closed or be quarantined from display pending review."

**Rule**:
- `licence_id IS NULL` or `rights_consent_type IS NULL` → **FAIL CLOSED** at display gate. Image is NEVER displayed.
- Licence catalogue entry says `permits_display=false` → **FAIL CLOSED**.
- Image is tagged with multiple contradictory licence identifiers (e.g. uploader asserts "own work" but a provenance check shows the file hash matches a Wikimedia Commons entry under CC-BY-SA) → **QUARANTINE** · move to `business_media_quarantine` state (new state), admin review required.
- Attribution required but attribution text missing → **FAIL CLOSED**.
- Governance mismatch (image's `sourceRegistryId` ≠ governance's `sourceId`) → **FAIL CLOSED** (sealed in `image-states.ts` as `governance_source_mismatch`).

**Already sealed enforcement** in `image-states.ts`:
- `promoteMatchedToRightsChecked` rejects `licence_unknown` (case-insensitive)
- Rejects `licence_forbids_display`
- Rejects `attribution_required_but_missing`
- Rejects `governance_source_mismatch`

The design above EXTENDS these to the per-row rights-evidence capture.

### 2.4 · Prohibited patterns

- Synthesising attribution ("Photo likely by X") when no attribution captured.
- Using a licence identifier that is not in the catalogue (Model A/C) or not a recognised external identifier (Model B/C).
- Flipping `licence_forbids_display=false` → `true` to force a display (would require a documented catalogue revision).
- Falling back to a default licence when a row's licence is NULL.

## 3 · Interaction with existing sealed artefacts

| Sealed artefact | How this design preserves it |
|---|---|
| `image-states.ts` state machine (Fetched → Matched → RightsChecked → ApprovedForDisplay) | Unchanged. This design slots into `Matched → RightsChecked` as the rights-evidence check and `RightsChecked → ApprovedForDisplay` as admin review (both already sealed). |
| `owner-upload-service.ts` trust chain | Extended, not changed. Current chain enforces Aspect 1 (uploader authority) and Aspect 4-partial (`approved=false`). This design adds Aspects 2, 3, 5, 6, 7 as additional required components. |
| `media-resolver.ts` resolver bypass for owner-upload | Only surfaces rows where `approved=true`. Unchanged. |
| `nex.business_media.approved` boolean | Unchanged. Required for Aspect 4. |
| `nex.source_registry.can_display` | Unchanged. All 6 image-capable sources stay `false` per owner clarification. |

## 4 · Not covered by this design

- Which of Model A/B/C to adopt (owner decision).
- The specific rights-evidence types that qualify (owner selects per Aspect 3).
- Soft-delete vs hard-delete default (owner specifies per Aspect 6).
- Quarantine window (owner specifies per Aspect 6).
- Specific licence catalogue CONTENTS if Model A/C is chosen (owner + counsel author per entry).
- The admin review tooling UI design (separate design document).
- Governance of grandfathered legacy sources (deferred per `nex-image-governance-draft-2026-10-27.md` G7).
- Resolver changes for the sibling directory view (handled in deliverable #6).
- Phase 2 (`G14`) content inspection of orphan objects (explicitly NOT APPROVED).

## 5 · What this document, as recorded, does and does not

### DOES
- Define a 7-aspect evidence gate design.
- Compare three licence catalogue models (A / B / C hybrid).
- Define the fail-closed / quarantine semantic for missing or conflicting evidence.
- Preserve the sealed image state machine unchanged.

### DOES NOT
- Insert into `business_media`.
- Create `nex.licence_registry`.
- Populate `source_registry.licence_id` or `attribution_template`.
- Flip any `can_display` value.
- Author the admin review tooling.
- Approve any orphan-object disposition.
