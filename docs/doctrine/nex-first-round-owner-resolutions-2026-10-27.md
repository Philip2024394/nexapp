# NEX First-Round Owner Decision Resolutions · RECORDED 2026-10-27

> **Status: RECORDED but NOT owner-signed.**
>
> This document captures the owner's 2026-10-27 approve-with-clarifications response to the eight first-round decision cards. The response is recorded for audit and future reference. **The sign-off block at the end is deliberately empty · final sign-off requires explicit owner confirmation that this recorded response constitutes final authorisation.**
>
> **Policy approval of any item below does NOT authorise implementation.** Implementation gates (migration apply, env flip, real fetcher injection, DB write, view deploy, orphan-object touch) remain separate owner decisions.
>
> **Companion documents:**
> - `nex-first-round-owner-decisions-2026-10-27.md` (the proposed decision sheet)
> - `nex-harvester-email-qualification-2026-10-16.md` §§10-18 (email doctrine draft)
> - `nex-image-governance-draft-2026-10-27.md` (image doctrine draft)

---

## Preamble (owner-authored, verbatim)

> **Status: APPROVE WITH CLARIFICATIONS** — subject to the specific conditions below.
>
> I approve the policy direction of E-D1, E-D2, E-D3, E-D4, I-D1, I-D2, I-D3 and I-D4, subject to the clarifications below.
>
> This approval authorizes only the expressly listed doctrine, design and read-only analysis deliverables. It does not authorize implementation or activation.

---

## E-D1 · Jurisdiction

**Owner clarification (verbatim):**
> Claude may prepare a fact-based, counsel-facing assessment of NEX's actual operations using existing code, documentation and verified operational facts. Separate verified facts from assumptions and unresolved questions. Do not expose secrets or credentials in the report. Qualified counsel must review legal conclusions. Claude must not choose the applicable jurisdiction or lawful basis.

**Operational effect:**
- Claude is authorised to prepare a counsel-facing jurisdiction assessment deliverable.
- The assessment separates verified facts, assumptions, and unresolved questions.
- The assessment exposes no secrets or credentials.
- Jurisdiction and lawful basis remain owner + counsel decisions.

**Prohibited actions this clarification does not override:**
- Claude may NOT state which jurisdiction applies.
- Claude may NOT select a lawful basis.
- Claude may NOT author the Legitimate Interests Assessment.
- The deliverable may NOT be used to justify Gate G-A activation.

---

## E-D2 · Permitted sources

**Owner clarification (verbatim):**
> Prepare the source allowlist in the existing email doctrine and reference it from a standalone document if that improves reviewability. Assess sources against applicable jurisdictional requirements and their individual access terms. Re-review a source when a material legal, contractual or operational condition changes. No new source is approved merely by documenting it.

**Operational effect:**
- Source allowlist structure prepared in existing email doctrine (§10) with optional standalone reference.
- Per-source assessment considers (a) jurisdictional requirements and (b) individual access terms.
- Re-review trigger: material legal, contractual, or operational condition change.
- Documenting a source ≠ approving a source.

---

## E-D3 · Confirmed email

**Owner clarification (verbatim):**
> Approve the five-state design as a proposed model for owner review, not as implemented behavior. The first four states may be assessed without sending email where the evidence supports them. The confirmation mechanism remains unresolved until the jurisdiction assessment and confirmation requirements are reviewed. Do not send email, contact businesses, or implement the model under this approval. Prepare a mapping from the sealed labels to the proposed model without changing the sealed doctrine.

**Operational effect:**
- Five-state design prepared as proposed model, not implemented.
- First four states (discovery · syntax · deliverability · business-association) assessable from existing evidence.
- Fifth state (confirmation) deliberately left mechanism-unresolved pending E-D1 outcome.
- No email send, no business contact.
- Sealed labels (`FOUND`/`VALIDATED`/`INVALID` + `PENDING`/`QUALIFIED`/`UNQUALIFIED`/`DISQUALIFIED`) remain in place; a mapping to the proposed model is prepared without changing the sealed text.

---

## E-D4 · PII-safe logging

**Owner clarification (verbatim):**
> Approve the no-email-values-in-logs policy direction. Prepare the CI leakage-test design, retention proposal, redaction design, access-control proposal, and database query-logging review as separate deliverables. Use 30 days only as a proposed production-log retention period, not an approved universal retention rule. Do not change production logging settings. Treat reviewer screens displaying email addresses as a separate privacy-control question for the next review round.

**Operational effect:**
- Policy direction approved; artefacts prepared as separate design deliverables, not implemented.
- 30 days is a PROPOSAL for production log retention, not approved.
- No production logging settings changed.
- Reviewer-screen privacy question deferred to next review round.

---

## I-D1 · Owner uploads

**Owner clarification (verbatim):**
> Approve design of the required evidence gate only. The proposal must separately cover uploader authority, image-to-business association, rights evidence, admin review, rejection, removal and audit history. A verified business claim alone is insufficient. Keep all display permissions unchanged.

**Operational effect:**
- Required evidence gate DESIGN authorised.
- Design must separately cover: uploader authority · image-to-business association · rights evidence · admin review · rejection · removal · audit history.
- `business_claim` verification alone is insufficient as the gate.
- All `can_display` values stay as currently set (`false` for `owner_upload`).

---

## I-D2 · Licence and attribution

**Owner clarification (verbatim):**
> Approve design of a licence catalogue and rights-evidence model only. Compare a NEX-managed catalogue with references to recognized external licence identifiers and terms. Missing or conflicting evidence must fail closed or be quarantined from display pending review. Do not populate production records or change the display gate.

**Operational effect:**
- Licence catalogue DESIGN authorised with explicit comparison of NEX-managed vs external (SPDX / CC) references.
- Fail-closed rule for missing or conflicting rights evidence.
- No production record populated, no display gate changed.

**Scoping note (recorded by Claude):**
I-D1 and I-D2 share a boundary (I-D1's "rights evidence" leg relies on I-D2's licence catalogue). To honour both while matching the owner's "seven deliverables" count, deliverables #5 covers both items as a single coherent design.

---

## I-D3 · Directory media view

**Owner clarification (verbatim):**
> Approve a review-only SQL design, consumer audit and regression plan. The proposed view must use an explicit column allowlist, preserve the four-state image approval progression, and exclude email addresses, phone numbers and personal identifiers unless separately approved. The existing directory view must remain unchanged. No deployment, grants or production schema changes are authorized.

**Operational effect:**
- Review-only SQL design + consumer audit + regression plan authorised.
- Explicit column allowlist (no `SELECT *`, no implicit JOIN exposure).
- Four-state image progression preserved in the view predicate.
- Email, phone, personal identifiers excluded unless separately approved.
- `business_directory_v` unchanged; no deployment, no grants.

---

## I-D4 · Orphan investigation

**Owner clarification (verbatim):**
> Approve Phase 1 metadata-only investigation of the 913 objects. Cross-reference existing metadata and identifiers using read-only queries only where access is already authorized. No downloads, content inspection, migration, deletion, re-keying, tagging, reference changes or storage-policy changes. G14 remains explicitly NOT APPROVED. Report findings neutrally without proposing an assumed disposition.

**Operational effect:**
- Phase 1 metadata-only investigation authorised.
- Cross-reference only against tables where access is already authorised.
- Findings reported neutrally; no disposition proposed.
- G14 (sample downloads) explicitly NOT approved.

---

## Global safeguards (owner-authored, verbatim)

> - No production migration, schema change, database write, view deployment, RLS change or storage change.
> - Do not enable NEX_EMAIL_BACKFILL_ENABLED or activate/inject the real fetcher.
> - Do not insert business_media records or change source_registry.can_display.
> - Preserve all unrelated working-tree changes and existing holds.
> - Do not commit the resolution record as owner-signed until this response is explicitly confirmed as the owner's final sign-off.
> - Each follow-up deliverable must state what it does and does not authorize.

**Guard-rail state verified at RECORDED time (2026-10-27):**

| Guard | Live state |
|---|---|
| Migration 202 columns | not present |
| `NEX_EMAIL_BACKFILL_ENABLED` | unset |
| `source_registry.can_display` for 6 image-capable sources | all `false` |
| `nex.business_media` rows | 0 |
| `nex.business_claim` rows | 0 |
| `nex-media/imported/*` orphans | 913 untouched |
| Dirty tree | 163 modified + 258 untracked, preserved |

---

## Deliverable set authorised by this response

Seven follow-up deliverables, each prepared as doctrine or analysis only. Each carries an explicit **"approval does NOT authorise implementation"** clause.

| # | Deliverable | Covers | File |
|---|---|---|---|
| 1 | Jurisdiction fact-based assessment | E-D1 | `nex-jurisdiction-fact-assessment-draft-2026-10-27.md` |
| 2 | Source allowlist structure | E-D2 | `nex-source-allowlist-structure-draft-2026-10-27.md` |
| 3 | Five-state email confirmation design + sealed-label mapping | E-D3 | `nex-email-five-state-model-draft-2026-10-27.md` |
| 4 | PII-safe logging artefacts (5 sub-items) | E-D4 | `nex-pii-safe-logging-artefacts-draft-2026-10-27.md` |
| 5 | Image evidence gate + licence catalogue + rights model | I-D1 + I-D2 | `nex-image-evidence-and-licence-draft-2026-10-27.md` |
| 6 | Directory media view design + consumer audit + regression plan | I-D3 | `nex-directory-media-view-design-draft-2026-10-27.md` |
| 7 | Orphan investigation Phase 1 report | I-D4 | `nex-nex-media-orphan-phase1-report-2026-10-27.md` |

---

## Sign-off block (PENDING EXPLICIT OWNER CONFIRMATION)

| Resolution | Owner | Date | Explicit confirmation received |
|---|---|---|---|
| E-D1 | Philip | _pending_ | ☐ |
| E-D2 | Philip | _pending_ | ☐ |
| E-D3 | Philip | _pending_ | ☐ |
| E-D4 | Philip | _pending_ | ☐ |
| I-D1 | Philip | _pending_ | ☐ |
| I-D2 | Philip | _pending_ | ☐ |
| I-D3 | Philip | _pending_ | ☐ |
| I-D4 | Philip | _pending_ | ☐ |

**This block fills in only on an explicit "I confirm this is final sign-off" message from the owner.** Until then, the policy direction is recorded but not final.

---

## What this document, recorded as-is, DOES and DOES NOT

### DOES
- Captures the owner's 2026-10-27 clarifications verbatim.
- Authorises preparation of the seven follow-up doctrine/analysis deliverables listed above.
- Authorises read-only investigation of the 913 orphan objects (metadata only).
- Authorises read-only operational fact-gathering for the jurisdiction assessment.
- Seals the no-email-values-in-logs policy direction (artefacts prepared as separate deliverables).

### DOES NOT
- Apply migration 202.
- Enable `NEX_EMAIL_BACKFILL_ENABLED`.
- Inject or activate the real fetcher.
- Alter production schema, views, RLS, storage, or media records.
- Touch the 913 orphan objects beyond metadata reads.
- Deploy the proposed sibling view.
- Insert any `business_media` row.
- Flip any `source_registry.can_display` value.
- Infer any legal conclusion.
- Count as owner-signed final sign-off.
