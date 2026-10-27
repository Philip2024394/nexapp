# NEX First-Round Owner Decision Sheet · 2026-10-27

> **Purpose.** Extract the SMALLEST set of first decisions from the two committed drafts (`nex-harvester-email-qualification-2026-10-16.md` §§10-18 and `nex-image-governance-draft-2026-10-27.md`) so the owner can advance email + image work in one review sitting without walking through all 40 checklist items.
>
> **Approving an item on this sheet does NOT:**
>   - apply any migration
>   - change any env var
>   - enable collection
>   - trigger harvesting
>   - modify any production data
>   - create, migrate, or delete any storage object
>
> Each approval is a **policy decision only**. Technical activation is a separate authorisation (per Gate G-A/B/C/D in the email doctrine §17).
>
> **Status: DRAFT for owner review.**

---

## Email · four first-round decisions

### E-D1 · Jurisdiction (ROOT · unblocks everything else)

- **Doctrine ref**: `nex-harvester-email-qualification-2026-10-16.md` §11.D1
- **Question**: Which jurisdiction(s) govern NEX's processing of business email addresses?
- **Why this is first**: Lawful basis (E-D2 dependency), opt-out SLA (14.D2), retention windows (13.D1), and right-to-erasure operator (13.D4) all follow from the jurisdiction answer. No downstream email decision is answerable until this lands.
- **This is NOT a pick-one menu.** The answer depends on NEX's actual operations: HQ location, server region, user population, business population, controller/processor designations. The owner should ground this answer in the real operating facts, not in whichever framework is most permissive.
- **Choices (owner states the actual facts)**:
  - (a) Indonesia only · UU 27/2022 PDP applies
  - (b) EU/UK users or data subjects present · GDPR applies to that subset
  - (c) US users or recipients present · CAN-SPAM / state laws apply to that subset
  - (d) multiple apply simultaneously · owner specifies which law governs which processing activity
- **Dependencies after this lands**: E-D2 lawful basis · 11.D3 (LIA + Article 14 authorship if GDPR LI) · 13.D4 right-to-erasure operator + SLA · 14.D2 opt-out SLA

---

### E-D2 · Permitted sources (OSM email + business website walk)

- **Doctrine ref**: `nex-harvester-email-qualification-2026-10-16.md` §10.D1, §10.D2, §10.D3
- **Question**: Are the two currently-coded email sources permitted at all?
- **Three independent sub-questions**:
  - **E-D2a · OSM contact tags (10.D1)**: Is `osm_overpass` `email` / `contact:email` tag content in-scope for NEX?
    - Choices: YES / NO / QUALIFIED-ONLY (persist for internal reachability scoring, never public display, never marketing)
    - Consequence of YES: ~1,000 pending drops per cron tick stop being lost after Gate G-A clears (actual count not yet measured; sealed estimate is "<10% of OSM listings").
    - Consequence of NO: the counter stays visible but is permanent evidence of refusal, not loss; migration 202 still needed for the backfill orchestrator but with narrower scope.
  - **E-D2b · business_website walk (10.D2)**: Is walking the business's own apex website to find a contact email in-scope?
    - Choices: YES / NO / QUALIFIED-ONLY
    - Consequence of YES: the walker becomes the primary volume source, requires E-D2c + rate-limit review.
    - Consequence of NO: the orchestrator remains dormant permanently; email coverage caps at whatever OSM provides.
  - **E-D2c · robots.txt (10.D3)**: Will NEX respect the destination site's `robots.txt`?
    - Choices: YES (recommended) / NO
    - Consequence of YES: adds a compliance layer the current code does not enforce; needs small code change at Gate G-C.
- **Dependencies after this lands**: 11.D2 lawful basis per source · retention windows per source · Gate G-A (migration 202) scope.

---

### E-D3 · VALIDATED threshold as "confirmed email"

- **Doctrine ref**: `nex-harvester-email-qualification-2026-10-16.md` §12.D1
- **Question**: Is the sealed three-layer VALIDATED contract (format gate + authoritative-source attribution + DNS MX record) sufficient as NEX's "confirmed business email" threshold?
- **What VALIDATED proves**: email is syntactically valid · its domain equals or is a strict subdomain of the business's published `website_apex` · the domain is configured to receive mail (≥1 MX record).
- **What VALIDATED does NOT prove**: a specific mailbox exists · a message would be accepted · the business owner controls that mailbox.
- **Choices**:
  - (a) **YES · adopt VALIDATED as the "confirmed" threshold** as currently sealed.
  - (b) **NO · require additional evidence** before marking an email "confirmed." Owner specifies what: double-opt-in (requires sending an email — Phase 2 scope), owner claim verification (ties to `business_claim` flow, 0 live rows), third-party deliverability signal, etc.
- **Why this is first**: Every downstream use (display, outreach, counting) depends on what "confirmed" means. If the owner wants a stricter bar, that must be set before migration 202 so the schema reflects it.
- **Dependencies after this lands**: 16.D1 display rule (QUALIFIED + OWNER_CLAIMED gate copy) · HQ dashboard count semantics.

---

### E-D4 · PII-safe logging rule sealed as policy

- **Doctrine ref**: `nex-harvester-email-qualification-2026-10-16.md` §15.D1
- **Question**: Seal the rule "email VALUES must never appear in logs, structured warn events, telemetry, dashboards (except as counters), or any artefact developers can read without an authorised data-access ticket"?
- **Why this is first**: This is a defensive seal that applies whether or not emails are ever collected. The current code already honours it (committed in A/B/C batches 0718dd3 · cb3d689 · a33a2fa) · owner sealing it as policy prevents regression.
- **Current enforcement already in place**:
  - `canonical-writer.ts:224` structured warn omits email VALUE
  - `email-backfill-orchestrator.ts:449` structured warn omits email VALUE
  - `email-extractor.ts` context_snippet is in-process only
- **Known gap**: pg query logging is NOT disabled on the production harvest DB · if enabled, `UPDATE … SET email=$2` would log the value.
- **Choices**:
  - (a) **YES · seal the rule + flip the pg-query-logging disable (15.D4) at the same time** (recommended)
  - (b) **YES · seal the rule, defer the pg-query-logging decision**
  - (c) **NO · owner specifies a different standard**
- **Dependencies after this lands**: 15.D2 access control matrix · 15.D3 admin reviewer logging mechanism · staging + production pg config review.

---

## Image · four first-round decisions

### I-D1 · owner_upload display permission (baseline authorised source)

- **Doctrine ref**: `nex-image-governance-draft-2026-10-27.md` §2 (G1)
- **Question**: Does `source_registry.source_id='owner_upload'` get `can_display=true` as the baseline authorised image source?
- **Why owner_upload first**: Clearest consent case · the business owner personally uploaded their own photo of their own business after passing the sealed claim-verify flow at `owner-upload-service.ts`. No scraping, no third-party licence question.
- **Current state**: `can_display=false` live. The sealed owner-upload service writes `approved=false` by default; even an admin-approved image cannot display because the source itself is `can_display=false`.
- **Choices**:
  - (a) **YES · approve `can_display=true` for owner_upload** · unblocks the owner-upload path (still gated by admin review per row)
  - (b) **NO · keep `can_display=false`** · owner-upload path remains fully blocked
  - (c) **YES but with additional preconditions** · owner specifies (e.g. only after a documented licence catalog is populated)
- **Approval of (a) does NOT automatically**: flip the DB row · create any `business_media` row · author the licence text (that's I-D2) · modify the directory view (that's I-D3).
- **Dependencies after this lands**: I-D2 licence + attribution text (hard prerequisite before any INSERT) · I-D3 view projection decision · G7 legacy source audit stays separate.

---

### I-D2 · owner_upload licence_id + attribution_template

- **Doctrine ref**: `nex-image-governance-draft-2026-10-27.md` §2 (G2)
- **Question**: What is the sealed licence identifier for owner-uploaded photos, and what attribution text displays alongside them?
- **Current state**: `source_registry.licence_id = NULL` on all 10 rows (there appears to be no populated licence catalog). `attribution_template = NULL` on 7 of 10 rows including owner_upload.
- **Three sub-questions**:
  - **I-D2a**: Does NEX need a formal licence catalog table (e.g. `nex.licence_registry`) before any `business_media` INSERT, or is a per-source text licence_id string (e.g. `owner_upload_consent_v1`) acceptable?
  - **I-D2b**: What exact attribution text displays with an owner-uploaded photo? DRAFT candidate: `"Photo by business owner · verified"`. Owner approves/rewrites.
  - **I-D2c**: Must the owner-uploader see + accept the licence terms at upload time? YES is the safe default; the current `owner-upload-service.ts` does not enforce this.
- **Why this is a first decision**: Without licence_id, `business_media` INSERTs are either blocked at a CHECK constraint (if sealed) or create unenforceable rows.
- **Approval of this does NOT automatically**: insert into `source_registry` · modify `business_media` schema · trigger any UI change.
- **Dependencies after this lands**: Gate G-10 real-persister authorisation.

---

### I-D3 · directory_with_media sibling view · review-only

- **Doctrine ref**: `nex-image-governance-draft-2026-10-27.md` §3 (G11)
- **Question**: Authorise Claude to draft (**not deploy**) a `business_directory_with_media_v` sibling view definition for owner review, specifying how `business_media` LEFT JOINs would surface approved images while preserving `business_directory_v`'s existing contract?
- **Why a sibling view, not an edit**: `business_directory_v` is sealed and consumed by the directory read path. Changing its projection is a load-bearing change. A sibling view lets owner compare before any production replacement.
- **Choices**:
  - (a) **YES · author the sibling view SQL + an audit of consumers · bring it back for review before any deploy**
  - (b) **NO · defer view design until later blockers clear**
- **Approval of (a) does NOT**: deploy the view · modify `business_directory_v` · change any read path · touch the DB.
- **The output of (a)**: a markdown doctrine section with the proposed SQL, an audit of what currently reads `business_directory_v`, and a review checklist for the owner.
- **Dependencies after this lands**: G12 placeholder rule (no-image → category-neutral placeholder) must be settled before any directory UI change.

---

### I-D4 · READ-ONLY investigation of the 913 orphan `nex-media/imported/*` objects

- **Doctrine ref**: `nex-image-governance-draft-2026-10-27.md` §4 (G13 + G14)
- **Question**: Authorise two investigation phases, both read-only, no object downloads or modifications?
- **Phase 1 · G13 · schema reads only**: `SELECT bucket_id, name, metadata, path_tokens, created_at, owner_id FROM storage.objects WHERE bucket_id='nex-media'` + cross-reference `<9-char-id>` prefix against `nex_account.handle` / `nex_chat_theme.theme_id` / other short-ID tables. Pure read against `storage.objects` metadata. Zero risk.
- **Phase 2 · G14 · sample downloads**: Download 3-5 image bytes from different `<9-char-id>` directories to visually confirm they are not business photography. Small risk · requires owner awareness that the content type is being inspected.
- **Choices**:
  - (a) **YES to G13 only · schema reads** (recommended first step)
  - (b) **YES to G13 + G14 · schema reads AND sample downloads**
  - (c) **NO · defer investigation**
- **Approval does NOT**: migrate any object · delete any object · re-key any object · reference any object from `business_media` · classify any object as business photography.
- **Expected outcome**: a short investigation report proposing (but not executing) a classification + a G15 recommendation for the policy on the orphan set (leave / move / purge — all deferred decisions).

---

## What this sheet does NOT cover (still deferred)

| Deferred | Where to find it when owner is ready |
|---|---|
| 11.D3 Legitimate Interests Assessment authorship (if GDPR LI chosen) | §11.D3 |
| 12.D2 Extraction method per attempt (column add) | §12.D2 |
| 12.D3 FOUND without apex policy | §12.D3 |
| 13.D1-D4 Retention + suppression | §13.D1-D4 |
| 14.D1-D4 Opt-out channels + SLA | §14.D1-D4 |
| 15.D2-D4 Access control matrix + admin reviewer + pg logging | §15.D2-D4 |
| 16.D1-D5 Display + search + export rules | §16.D1-D5 |
| 17.D1 Gate chain confirmation | §17.D1 |
| G3-G8 Image governance for scraped / wikimedia / wikidata / user_upload / legacy sources | Image doctrine §2 |
| G9-G10 Authorise real enrichment persister build | Image doctrine §3 |
| G12 Placeholder rule for no-image tiles | Image doctrine §3 |
| G15 Post-investigation policy for orphan objects | Image doctrine §4 |

These unblock on second and third rounds, not now.

---

## Expected sequence after first-round approvals

If the owner approves E-D1-4 + I-D1-4 as stated, the next SAFE work is:

1. **Second-round decision sheet** · covering retention/opt-out/display rules (13-16) now that jurisdiction + VALIDATED threshold + permitted sources are settled.
2. **Owner-upload licence + attribution authoring** (I-D2 output) · doctrine-only.
3. **Sibling view design review** (I-D3 output) · doctrine-only, no deploy.
4. **Phase-1 orphan investigation** (I-D4 output) · read-only report.

**Nothing in that list applies a migration, flips an env var, inserts into `business_media`, or activates a fetcher.** All four Gates G-A through G-D remain untouched.

---

## Sign-off block

| Decision | Owner choice | Date | Notes |
|---|---|---|---|
| E-D1 · Jurisdiction | | | |
| E-D2a · OSM email in-scope | | | |
| E-D2b · business_website walk in-scope | | | |
| E-D2c · robots.txt respected | | | |
| E-D3 · VALIDATED as "confirmed" | | | |
| E-D4 · PII-safe logging sealed | | | |
| I-D1 · owner_upload can_display | | | |
| I-D2 · owner_upload licence + attribution | | | |
| I-D3 · sibling view design review | | | |
| I-D4 · orphan investigation phase(s) | | | |

Until these sign-offs land, the current working set stays frozen: migration 202 unapplied, `NEX_EMAIL_BACKFILL_ENABLED` unset, `DORMANT_FETCHER` default, `source_registry.can_display=false` on all image-capable sources, 913 orphan objects untouched.
