# NEX Safe · Trust System Doctrine

Founder-authorised design · 2026-10-13. **Design document only — nothing is implemented.** This doctrine defines the shared trust engine, the three category adapters (Safe Trade / Safe Stay / Safe Service), the complaint lifecycle, data model concepts, UI states, and legal boundaries. All schema and functionality described here is **future work** unless explicitly marked as reusing an existing primitive.

---

## 1 · Principle

NEX Safe does not tell a customer whether a business is "safe." It presents what NEX has verified, what customers have independently reported, how the business responded, and what remains unknown. **Evidence-based, not opinion-based.**

Each trust dimension is reported on its own axis. No single aggregate safety score. Customers see the shape of the evidence, not a verdict.

## 2 · The three category adapters

One shared trust engine. Three category-specific presentations. The adapters differ in surface labels and the specific evidence they emphasise; the underlying data model, state machine, and governance are identical.

| Adapter | Scope | Evidence emphasis |
|---|---|---|
| **Safe Trade** | Products, manufacturers, wholesalers, suppliers | Supply capability (local / international), language support, product complaints, warranty record |
| **Safe Stay** | Hotels, guesthouses, villas, accommodation | Booking cancellation disputes, cleanliness/condition complaints, response to booking inquiries, documented resolutions |
| **Safe Service** | Tradespeople, technicians, contractors, services | Punctuality reports, workmanship/warranty disputes, response times, service completion evidence |

Adapter dispatch keys off `business_canonical.entity_type` (sealed 9-value enum from migration 167):

- `food`, `accommodation`, `service`, `vehicle_rental`, `marketplace_seller`, `transport_operator` → Trade/Stay/Service adapter per entity_type (future mapping table)
- `professional`, `transport_driver` → Safe Service adapter
- `place` → **no Safe panel** (places are not claimable businesses; nothing to adjudicate)

The founder's rule: adapters may evolve into additional categories later; the trust engine itself does not split.

## 3 · Trust dimensions (separate axes · no aggregate)

Each dimension is reported on its own, with evidence attached. Dimensions can be VERIFIED, PARTIAL, UNKNOWN, or UNAVAILABLE independently.

| Dimension | What it reports | Where the data comes from (proposed) |
|---|---|---|
| **Identity** | Legal identity verified · business documents checked · address checked · ownership confirmed · dates recorded | `nex.business_claim` (existing · state=VERIFIED) · future `nex.business_identity_evidence` (not yet built) |
| **Account / business history** | NEX account active since · verified business age where documented · ownership changes | `nex_account.created_at` (existing) · future `nex.business_history` table |
| **Activity** | Last listed update · last response · recent completions | Existing `business_canonical.updated_at` + conversation data |
| **Response performance** | Median reply time · percentage of enquiries answered · sample size | Measured from existing `nex_peer_message` / `nex.listing_message` tables (requires aggregation service, not built) |
| **Complaint record** | No qualifying complaints OR specific substantiated issue(s) with evidence | **New complaint tables (not built)** |
| **Unknown / unverified** | Explicit UNKNOWN state for every dimension the data cannot support | — |

**Reporting invariant:** every public claim carries its own verification date, source identifier, and (where applicable) sample size. Example:
- "Identity verified · 2026-09-14 · method: WhatsApp OTP"
- "Typical response time: 2h 14m · 42 conversations measured · last 90 days"
- "No qualifying complaints recorded · 0 reports in the available window"

NEVER:
- "Identity verified" without a date
- "Fast responder" without a measured median and sample size
- "No complaints" presented as "safe"

## 4 · The sealed states

### 4.1 · Dimension state (per axis)

| State | UI label (indicative) | Rule |
|---|---|---|
| VERIFIED | ✓ with date | Data exists AND passes verification AND is recent enough per freshness rule |
| PARTIAL | partial · with specifics | Some sub-items verified, others pending or unavailable |
| UNKNOWN | "Not verified" | No data OR data not refreshed within freshness window |
| UNAVAILABLE | "Unable to verify right now" | Transient failure (DB unreachable, service down, timeout) |

**UNAVAILABLE is a first-class state.** A failed data retrieval MUST NEVER present as VERIFIED or PARTIAL. The loading animation shows a spinner; a failed load shows UNAVAILABLE with "last successful check" timestamp if known.

### 4.2 · Complaint record state (whole-business)

| State | What customers see |
|---|---|
| `no_qualifying_complaints` | "No qualifying complaints recorded in NEX's available records." Honest-null — does NOT imply safety. |
| `report_received_private` | NOT displayed as a confirmed negative finding. Internally tracked. |
| `under_review` | Displayed publicly ONLY if necessary and fair; never names, never implies guilt |
| `substantiated` | Specific finding supported by evidence · owner response slot always present |
| `business_responded` | Owner's reply available alongside the finding |
| `resolved` | Corrective action or agreed resolution recorded · with date |
| `disputed_appealed` | Dispute clearly marked while reassessment is underway |

**Transition invariants:**
- `report_received_private` → `under_review` requires at least two reports deemed independent (per section 5)
- `under_review` → `substantiated` requires owner-response window elapsed AND evidence review AND admin decision recorded
- `substantiated` can transition to `disputed_appealed` on either party's request; both parties get appeal rights
- `resolved` records the outcome but does NOT erase the substantiated history — the public record preserves the chain

## 5 · Complaint lifecycle (proposed · all new infrastructure)

The founder's two-person rule is a floor, not an auto-trigger. The engine requires INDEPENDENT corroboration AND evidence AND owner response AND human review before anything becomes public.

### 5.1 · Submission (private)

Customer submits:
- What happened (free text, moderated for PII)
- Date of the incident
- The product / service / booking referenced (optional structured link to a `canonical_business_id` + `about_item_id`)
- Supporting evidence (uploads · future object store · not yet designed)

The complaint is **private** at this stage. Not surfaced on the business profile. Not visible to the business owner until (and unless) corroboration is reached.

Future table (proposed · not built):
```
nex.business_complaint:
  complaint_id         uuid PK
  canonical_business_id uuid FK → business_canonical
  about_item_id        uuid null (optional product/service pointer)
  complainant_id       text  (anon:uuid or nex_account.id · hashed when stored)
  incident_date        date
  body                 text
  evidence_ref         text null (object store key)
  state                text (private · under_review · substantiated · rejected · resolved · appealed)
  received_at          timestamptz
  review_window_ends_at timestamptz null (set when state=under_review)
```

### 5.2 · Independent corroboration

NEX checks whether at least TWO genuinely independent customers report the same specific issue about the same business.

**Independence tests (all must pass):**
- Different `complainant_id` fingerprints (cookie / account)
- Different IP addresses (coarse-grained country/city match tolerated; identical IP + identical UA fingerprint rejected)
- No shared transaction (if transactions are known, the complainants must have independent order history)
- No duplicate copy-paste content (text similarity above threshold triggers manual review)
- No "coordinated campaign" signals (burst of reports within short window from similar origins)

**Automatic triggers never substantiate alone.** The threshold moves a complaint from `private` to `under_review`. Human admin review substantiates.

Future table (proposed · not built):
```
nex.business_complaint_independence_check:
  check_id             uuid PK
  complaint_id         uuid FK
  signals              jsonb (fingerprint comparisons, IP distance, text similarity, order overlap)
  verdict              text (independent · duplicate · coordinated · needs_manual_review)
  checked_at           timestamptz
```

### 5.3 · Owner's right of reply (ARCHITECTURAL)

When a complaint reaches `under_review`:
1. NEX notifies the business privately via its verified contact channel (reusing existing `src/lib/nex/listing-chat/owner-invite.ts` style template)
2. The notification contains ISSUE CATEGORY + DATE, NOT the complainant's name or full message text
3. The owner has a response window (proposed: 7 days · configurable per country)
4. The owner may submit a written response + evidence (upload)
5. The owner's response is recorded in the review record

**Owner cannot erase a genuine complaint simply by disagreeing with it.** The complaint remains in the system; the owner's response accompanies the public finding if it is substantiated.

Future table (proposed · not built):
```
nex.business_complaint_response:
  response_id          uuid PK
  complaint_id         uuid FK (unique · one per complaint)
  submitted_by         text (business_claim.claimed_by_account_id)
  body                 text
  evidence_ref         text null
  submitted_at         timestamptz
```

### 5.4 · Evidence review (admin · human-in-the-loop)

An admin reviewer (same gate pattern as `/admin/image-review`):
- Reads the complaint, the independence-check verdict, the owner response, any evidence
- Checks transaction records where applicable
- Makes a decision: `substantiated`, `rejected`, `insufficient_evidence`, `resolved_with_business`

**Admin review is a hard architectural requirement.** No automatic substantiation. The founder's rule: humans adjudicate, with a documented decision chain.

Future table (proposed · not built):
```
nex.business_complaint_review_decision:
  decision_id          uuid PK
  complaint_id         uuid FK
  reviewer_account_id  text (nex_account.id)
  decision             text (substantiated · rejected · insufficient · resolved_with_business)
  rationale            text (required · min length enforced)
  decided_at           timestamptz
```

### 5.5 · Resolution + appeal

- The public profile may show the substantiated issue, the owner's response, the resolution (if any), and the date.
- Both the business AND the complainant may request a review of an incorrect decision.
- Appeals are reviewed by a different admin (two-eyes rule).
- Appeal outcomes update the record; the history is preserved (immutable audit log).

Future table (proposed · not built):
```
nex.business_complaint_appeal:
  appeal_id            uuid PK
  complaint_id         uuid FK
  requester_role       text (business_owner · complainant · third_party)
  requester_account_id text null (anon appeals allowed from complainants)
  reason               text
  reviewer_account_id  text null (set at decision time)
  outcome              text null (uphold · overturn · modify)
  requested_at         timestamptz
  decided_at           timestamptz null
```

## 6 · UI behaviour · per state

The founder's rule: never imply a check succeeded before data returns. Loading is a loading state. Failure is a failure state. VERIFIED is only shown with evidence.

| UI state | Visible | Shown when |
|---|---|---|
| LOADING | Spinner · neutral copy ("Checking NEX records…") | While a fetch is in flight |
| EMPTY | "This business has not been reviewed by NEX." · neutral | Business has no verification · no complaints · no measurable activity |
| VERIFIED | ✓ with date + method + sample size (where applicable) | Data exists AND passes the dimension's rule |
| PARTIAL | Mixed state with per-item ticks and gaps | Some sub-items verified · others pending/unknown |
| UNKNOWN | "Not verified" · explicit neutral absence | Data does not exist OR is stale |
| DISPUTED | Clear "under review · disputed" badge with timestamp | A substantiated finding is being re-reviewed |
| RESOLVED | Chronological record showing original issue + resolution date | Owner and complainant reached a documented outcome |
| UNAVAILABLE | "Unable to verify right now · last successful check at X" | Transient failure · includes last-good-timestamp if known |
| ERROR | Honest fallback: "NEX Safe is temporarily unavailable" | Hard failure · no last-good |

**Animation rule:** the "centre panel opens, items populate in sequence" animation does NOT pre-render green checks. Items begin in LOADING state and transition to their resolved state as data arrives. A failed fetch transitions to UNAVAILABLE, not to a green check.

## 7 · Evidence requirements for every public claim

The public panel enforces, at render time, that every claim carries its evidence breadcrumbs. If a breadcrumb is missing, the claim MUST NOT render.

| Claim | Required evidence (hard-coded at render) |
|---|---|
| "Business identity verified" | `verification_date` · `verification_method` (whatsapp / email / document) · `claim_state = VERIFIED` |
| "NEX account active since X" | `nex_account.created_at` resolvable AND the business's current claim links to that account |
| "Typical response time: X" | `median_ms` AND `sample_size >= MIN_SAMPLE` (proposed 10) AND `window_days` |
| "No qualifying complaints" | `complaint_count_in_window = 0` AND `window_days = X` (shown) — honest-null, NOT a safety claim |
| "Substantiated issue" | A `business_complaint_review_decision` row with `decision='substantiated'` AND an owner_response slot (populated OR explicitly recorded as not-submitted-within-window) |
| "Resolved" | A `resolution_notes` + `resolution_date` on the complaint |

**Insufficient complaint data vs. no complaints.** These are DIFFERENT and must be visually distinguished:
- "No qualifying complaints recorded (12-month window)" — complaint tracking is live for this business + no reports arrived
- "Complaint data not yet available for this business" — tracking not yet enabled OR business too new

## 8 · Privacy + legal boundaries

### 8.1 · Complainant privacy

- Complainant identity is NEVER shown on the public panel.
- The complainant's ID is hashed when stored (future: salted hash with per-business salt).
- Owner notifications contain CATEGORY + DATE, not identity.
- Admin reviewers see the identity for duplicate-detection purposes only; the admin UI logs every access.

### 8.2 · Restricted evidence access

Pattern reused from `source_registry.can_display` (sealed in Phase 1): a public summary of the finding is shown; the underlying evidence (uploads, admin rationale, independence-check scores) stays in restricted-access tables with RLS.

**Three visibility tiers:**
- **Public** · the substantiated finding + the owner response + resolution + date
- **Signed-in owner** · the same public view (owners get no privileged info about complainants)
- **Admin** · everything

### 8.3 · Country-specific legal review

Defamation and personal-data rules differ by country. The admin workflow MUST preserve a per-country decision audit trail before any country-wide rollout.

- `nex_account.locale` (sealed: 'id' | 'en') is the user's language preference
- `business_canonical.country` is the business's operating country (ISO 2-char)
- Future: `nex.country_legal_policy` table recording per-country rules for:
  - Minimum evidence standard before a finding can be "substantiated"
  - Minimum response-window length
  - Retention periods
  - Specific prohibited phrasings (defamation hazards)
  - Appeal rights

**No country rollout happens without a per-country legal review completed and logged.** This is architectural, not optional.

## 9 · Data-model concepts summary

Reusing (confirmed from previous audits):
- `nex.business_canonical` · identity spine
- `nex.business_claim` · verified ownership path
- `nex_account` · ownership identity
- `nex.source_registry` · governance pattern (reused for evidence visibility)
- `nex_peer_message` / `nex.listing_message` · response-time inputs
- `src/lib/nex/delivery/adapters/` · email delivery
- `src/lib/nex/listing-chat/owner-invite.ts` · template invocation pattern
- Dev-admin gate pattern (`/admin/tier`, `/admin/image-review`)
- `nex_dir_visitor` cookie · anonymous complainant fingerprint

Proposed (NEW · not built):
- `nex.business_complaint` + `business_complaint_independence_check` + `business_complaint_response` + `business_complaint_review_decision` + `business_complaint_appeal`
- `nex.business_identity_evidence` (if "legal identity checked" / "address checked" become distinct from the single `business_claim` row)
- `nex.business_response_metric` (materialised per-business response-time rollup; refreshed on cadence)
- `nex.country_legal_policy`
- Admin screens: `/admin/complaints`, `/admin/appeals`
- Server actions for admin decisions (same hardening rules as `image-approval-controls.md`)

## 10 · Access boundaries · what reads what

| Reader | Can read |
|---|---|
| Public (anonymous) | Business profile · verified identity (date only) · activity window · response metrics (if sample size suffices) · substantiated complaints with owner response and resolution · explicit UNKNOWN / UNAVAILABLE states |
| Signed-in NEX user | Same as public |
| Business owner (verified claim) | Same as public, plus: direct view of complaints concerning their own business (post-owner-notification stage) · ability to submit a response · ability to request an appeal |
| Complainant | Private view of their own submitted complaint · its state · the admin decision (when made) · appeal rights |
| Admin | Everything: evidence, independence scores, decision history, appeal history, complainant identity for dedup purposes, all audit log |

**The resolver pattern (from media-resolver.ts Phase 1) is the architectural precedent.** Public queries filter at the SQL level with explicit gates; private evidence lives behind RLS and never reaches the public query.

## 11 · Dependencies on other NEX work

| NEX Safe primitive | Depends on |
|---|---|
| "Business identity verified" with date | `nex.business_claim` — EXISTS |
| "NEX account active since X" | `nex_account.created_at` — EXISTS |
| "Typical response time X · Y conversations" | Reliable message tables (exists) + response-time aggregation service (NOT BUILT · depends on Phase 2 Mount) |
| Complaint record · ALL states | NEW tables + state machine (NOT BUILT) |
| Independent corroboration logic | NEW service (NOT BUILT) |
| Owner response slot | Reuses listing-chat invite template + NEW response-submission UI (NOT BUILT) |
| Admin review flow | NEW admin screen (uses existing dev-admin gate · pattern reusable) |
| Appeal workflow | NEW tables + admin screen (NOT BUILT) |
| Country legal flag | NEW table (NOT BUILT) |
| Three category adapters | Dispatch on existing `entity_type` enum — no new infrastructure |

**NEX Safe primitives that can be built WITHOUT Phase 1 or Phase 2:**
- Doctrine (this file) — DONE
- Dependency map (this file + the forthcoming audit)
- `nex.country_legal_policy` schema design
- Admin screen scaffold (read-only inspector, same pattern as image-review)
- The three category adapter presentation layer (uses only `entity_type`)

**NEX Safe primitives that DEPEND on Phase 2 (contact flow / listing-chat mount):**
- Response-time measurement (needs reliable conversation data at scale)
- Owner notification via the same channel the owner uses for customer inquiries

**NEX Safe primitives that are standalone (no Phase dependency):**
- Complaint submission + independence-check + review + appeal (own tables, own admin screen)
- These could be built in parallel with Phase 2

## 12 · Implementation sequencing (future · not authorised)

1. **Pre-work**: this doctrine (DONE) + the reuse audit (in flight)
2. **Admin inspector scaffold**: read-only `/admin/complaints` page (same gate pattern as `/admin/image-review`) · zero mutating actions
3. **Complaint tables + state machine** (migrations) · no public UI yet
4. **Independence-check logic + tests** · pure functions · unit tested exhaustively
5. **Admin decision server actions** · same hardening rules as `image-approval-controls.md`
6. **Owner notification + response workflow** (reuses email infra)
7. **Appeal workflow**
8. **Country legal policy table + per-country gate**
9. **Public panel UI** (last · only after everything above is verified)
10. **Pilot** · small group of listings · end-to-end verification before any wider rollout

**Each step is a separate authorisation.** No step jumps ahead.

## 13 · Non-goals (deferred or declined)

- **Aggregate safety score** · explicitly declined by founder
- **Star ratings or written reviews** · NEX Safe replaces this · evidence not opinion
- **Automated AI adjudication of complaints** · humans decide
- **Public shaming of businesses with no complaints** · empty state is "no qualifying complaints," never "untested therefore unsafe"
- **Cross-country complaint pooling without legal review** · complaints remain country-scoped until legal review per country completes

## 14 · Appendix · guard rails against regression

Future test invariants (to be authored when implementation lands):
- Public panel renders NO claim without the required evidence breadcrumbs
- LOADING cannot transition to VERIFIED without a successful data fetch
- UNAVAILABLE renders when the data fetch throws
- A complaint cannot transition to `substantiated` without a `business_complaint_review_decision` row
- A complaint cannot be `substantiated` while the owner-response window is still open
- Independence check verdict `coordinated` auto-blocks progression to `under_review`
- Country rollout flag MUST be true for the business's country before the panel renders complaint findings
- Complainant identity cannot leak through any public query (regression test greps the SQL for complainant_id in SELECT lists)
