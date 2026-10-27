# NEX · Five-State Email Confirmation Model · DRAFT · 2026-10-27

> **Status: proposed model for owner review · NOT implemented behaviour.**
>
> **Authority**: owner approval 2026-10-27 (E-D3 clarification): "Approve the five-state design as a proposed model for owner review, not as implemented behavior. The first four states may be assessed without sending email where the evidence supports them. The confirmation mechanism remains unresolved until the jurisdiction assessment and confirmation requirements are reviewed. Do not send email, contact businesses, or implement the model under this approval. Prepare a mapping from the sealed labels to the proposed model without changing the sealed doctrine."
>
> **This document DOES NOT:**
> - Modify the sealed state machine in `nex-harvester-email-qualification-2026-10-16.md` §§1-9.
> - Change `email_status` or `qualification_status` schema values.
> - Enable sending email or contacting any business.
> - Implement the five-state model in code.
>
> **This document DOES:**
> - Define the five proposed states and the evidence record for each.
> - Map the sealed labels (`FOUND`/`VALIDATED`/`INVALID` + `PENDING`/`QUALIFIED`/`UNQUALIFIED`/`DISQUALIFIED`) to the proposed model.
> - Flag the confirmation mechanism as unresolved pending jurisdiction + counsel.

## 1 · The five states

An email candidate progresses through five distinct states. Each state has a precise evidence requirement; absence of evidence prevents promotion. States are additive · reaching state N implies the row satisfied states 1 through N-1.

### State 1 · DISCOVERED

**Meaning**: an email-shaped string was observed in a source NEX is authorised to read.

**Evidence required**:
- Source identifier (`osm_overpass` / `business_website` / …)
- Observation URL or source element reference
- Observation timestamp
- Extraction method (if applicable: JSON-LD / mailto / obfuscated / plain / tag)

**Not required**: syntax validity, deliverability, business association, or confirmation.

**Why this state exists**: an "I saw a string" event is distinct from "the string is well-formed." Separating them means we can log a discovery event even for strings that later fail syntax.

### State 2 · SYNTAX_VALID

**Meaning**: the discovered string passes the sealed format regex (migration 202 CHECK constraint).

**Evidence required**:
- Everything from State 1
- Format pass boolean = true
- Normalised form of the string (lowercased, trimmed)

**Transition rule**: State 1 → State 2 is deterministic. Fails → terminal state `SYNTAX_INVALID` (does NOT persist beyond the discovery log).

**Why this state exists**: distinguishes "valid email shape" from "deliverable email." A `.foo@bar.co` passes format regex but may fail deliverability.

### State 3 · DELIVERABLE

**Meaning**: the normalised string's domain is DNS-configured to receive mail.

**Evidence required**:
- Everything from State 2
- DNS MX lookup result (success + record count ≥ 1, OR documented failure code)
- Lookup timestamp (DNS records change; this bounds staleness)

**Transition rule**: State 2 → State 3 requires `dns.resolveMx(domain)` returning ≥ 1 MX record. Failure modes:
- NXDOMAIN / ENOTFOUND → **permanent** fail (domain does not exist)
- SERVFAIL / ETIMEDOUT → **transient** fail (retry after cooldown)
- No MX records → **persistent-non-deliverable** fail (domain exists, mail disabled)

**Important**: DELIVERABLE proves the DOMAIN is configured to receive mail. It does NOT prove the mailbox exists, accepts messages, or is actively monitored.

### State 4 · BUSINESS_ASSOCIATED

**Meaning**: the normalised domain is authoritatively tied to the specific canonical business the row represents.

**Evidence required**:
- Everything from State 3
- Canonical business's published `website_apex` at observation time
- Comparison outcome (equal / strict subdomain / third-party)

**Transition rule**: email domain must equal the apex OR be a strict dot-bounded subdomain. Already sealed in `email-validation.ts` `isAuthoritativeSource`. Dot-boundary rules out look-alike domains (`acme-fake.co` is NOT a subdomain of `acme.co`).

**Fails to**: `State 4 Failed · third_party_source` (e.g. `info@gmail.com` on `acme.co`) OR `State 4 Failed · missing_apex_host` (business has no `website_apex`).

**Important**: BUSINESS_ASSOCIATED proves domain-level association, not that the specific uploader controls the mailbox. A reception desk mailbox at a shared office building would pass this layer.

### State 5 · CONFIRMED

**Meaning**: an affirmative signal confirms the business consents to NEX's use of the address for the stated purpose.

**Evidence required**:
- Everything from State 4
- A confirmation signal **of a type the jurisdiction + lawful basis require**
- Confirmation timestamp
- Confirmation evidence reference (uploaded consent, verification token, owner-claim link, …)

**Transition rule**: **UNRESOLVED** — the mechanism depends on E-D1 jurisdiction + counsel conclusion.

### 1.1 · Confirmation mechanism · UNRESOLVED (owner + counsel)

Candidate mechanisms (presented as options for counsel review, NOT as choices):

| Candidate | What it is | Typical regimes where applicable |
|---|---|---|
| **Double opt-in email** | NEX sends a token to the address; receiver clicks to confirm | GDPR consent, CASL express consent |
| **Owner-claim flow completion** | A verified business_claim where the owner explicitly links the email to the business | GDPR Art 6(1)(b) contract preparation; owner-direct consent |
| **Published contact-at-source + opt-out window** | Discovery + published mechanism to say "do not contact me" + wait N days with no opt-out | GDPR Art 6(1)(f) legitimate interest with Art 21 right to object; CAN-SPAM for US B2B |
| **Formal written consent** | Signed consent record filed in NEX | Highest-friction, strongest basis |
| **Transactional-only use** | NEX never confirms for marketing use; email only used for a specific transaction (e.g. directory-inclusion notice) | Lower-friction but narrower purpose scope |

**Blocked until**: E-D1 jurisdiction assessment lands + counsel issues (a) lawful basis per source per jurisdiction, (b) confirmation-mechanism requirements per lawful basis.

**Prohibited action**: Claude may NOT send a confirmation email, contact a business, or wire a confirmation mechanism under this document's approval. This is explicitly out of scope per owner clarification.

## 2 · Transition diagram

```
          +-------------+
          |  (not yet)  |
          +------+------+
                 | observation event
                 v
          +-------------+
          | 1. DISCOVERED |
          +------+------+
                 | format regex
      +----------+----------+
      v                     v
+-------------+     +-----------------+
| 2. SYNTAX_  |     | TERMINAL ·      |
|    VALID    |     | SYNTAX_INVALID  |
+------+------+     +-----------------+
       | DNS MX
   +---+---+---+---------+
   v       v   v         v
+--------+ +-------+ +----------+
| 3.     | | perm. | | transient|
| DELIV- | | fail  | | fail     |
| ERABLE | | (nxd) | | (retry)  |
+---+----+ +-------+ +----------+
    | domain = apex OR subdomain
+---+-+-+--------+
v     v v        v
+------+ +----+ +--------+
| 4.   | | 3rd| | missing|
| BIZ_ | | pty| | apex   |
| ASS. | +----+ +--------+
+--+---+
   | confirmation signal · OWNER+COUNSEL defined mechanism
   |
   | (BLOCKED pending jurisdiction + counsel)
   |
   v
+--------------+
| 5. CONFIRMED |
+--------------+
```

## 3 · Mapping from sealed labels

The sealed doctrine (`nex-harvester-email-qualification-2026-10-16.md` §§1-9) uses two label sets:

- `email_status`: `FOUND` / `VALIDATED` / `INVALID`
- `qualification_status`: `PENDING` / `QUALIFIED` / `UNQUALIFIED` / `DISQUALIFIED`

The sealed labels are preserved. The five-state model is an overlay that maps as follows:

### 3.1 · `email_status` mapping

| Sealed label | Proposed state | Notes |
|---|---|---|
| `INVALID` | Terminal `SYNTAX_INVALID` | No persistence beyond discovery log |
| `FOUND` (observation only) | State 1 DISCOVERED | Row observed but not verified beyond that |
| `FOUND` (format gate passed) | State 2 SYNTAX_VALID | The row's existence in schema implies format passed |
| `FOUND` (format + MX passed but third-party or missing apex) | State 3 DELIVERABLE (not State 4) | reason: `third_party_source` or `missing_apex_host` |
| `VALIDATED` | State 4 BUSINESS_ASSOCIATED | The sealed VALIDATED contract == the five-state model's State 4. **Important: VALIDATED is NOT CONFIRMED.** |

### 3.2 · `qualification_status` mapping

| Sealed label | Proposed state semantics | Notes |
|---|---|---|
| `PENDING` | Row has an observation but has not advanced to State 5 | Covers DISCOVERED, SYNTAX_VALID, DELIVERABLE, BUSINESS_ASSOCIATED (reachable but not confirmed) |
| `QUALIFIED` | **PENDING ALIGNMENT.** Sealed doctrine says `QUALIFIED` is reached when `VALIDATED` (State 4). Proposed model says State 4 is NOT confirmation. **Owner decision Q1 below.** |
| `UNQUALIFIED` | Terminal non-deliverable OR non-business-associated OR invalid | Retryable after cooldown |
| `DISQUALIFIED` | Admin lock | Preserved as sealed |

### 3.3 · The sealed-vs-proposed divergence (owner Q1)

**The ONLY semantic divergence**: in the sealed doctrine, reaching `email_status='VALIDATED'` promotes `qualification_status` to `'QUALIFIED'`. In the proposed five-state model, `VALIDATED` (= State 4 BUSINESS_ASSOCIATED) is NOT yet CONFIRMED — a fifth state is needed.

The owner directed: "Reject `VALIDATED` alone as sufficient proof of a confirmed business email."

**Three alignment options** (owner picks one; mechanism not implemented either way):

- **Option A · Rename the sealed `QUALIFIED` → `BUSINESS_ASSOCIATED`.** Introduce a new `CONFIRMED` label as the terminal good state. Requires a schema change (new enum value) when migration 202 is applied. Sealed doctrine text updated minimally.
- **Option B · Keep sealed `QUALIFIED` but redefine its semantic**: QUALIFIED means State 4 reached, not "safe for marketing use." Add a separate `confirmation_status` column with values `NONE / CONFIRMED / OPTED_OUT`. Preserves sealed labels unchanged; adds a new column.
- **Option C · Document the five-state model as an application-layer overlay only.** Sealed labels remain the schema. Application code computes the proposed state from the sealed labels + an auxiliary table (e.g. `nex.email_confirmation`). Schema minimally touched; application takes on the semantic separation.

**Each option has downstream migration-202 implications** that the owner should weigh when authorising Gate G-A.

## 4 · First four states are assessable without sending email

Per owner clarification: "The first four states may be assessed without sending email where the evidence supports them."

Evidence sources per state (all pre-existing in the sealed harvest pipeline):

| State | Evidence source | Already in code |
|---|---|---|
| 1 DISCOVERED | OSM tag parse + six-method HTML extractor | Yes (`osm-email-extract.ts`, `email-extractor.ts`) |
| 2 SYNTAX_VALID | Format regex sealed in `email-validation.ts` + migration 202 CHECK | Partial (migration 202 unapplied; regex sealed) |
| 3 DELIVERABLE | `dns.resolveMx(domain)` sealed in `email-validation.ts` + NXDOMAIN discrimination (batch C-1 at `a33a2fa`) | Yes |
| 4 BUSINESS_ASSOCIATED | `isAuthoritativeSource` sealed in `email-validation.ts` | Yes |

**No email is sent in computing states 1-4.** State 5 is the only state requiring outreach.

## 5 · Prohibited actions under this draft

- No code implementation.
- No email send.
- No business contact.
- No schema change.
- No sealed doctrine edit.
- No pre-selection of confirmation mechanism before E-D1 + counsel.
- No Gate G-A unblock.

## 6 · Open questions requiring owner answer

- **Q1** Alignment option A, B, or C from §3.3?
- **Q2** For State 1 DISCOVERED retention: is the discovery log kept separately from the canonical row (so SYNTAX_INVALID still has a record), or is it a one-row-per-canonical model with the terminal failure logged inline?
- **Q3** For State 3 DELIVERABLE: when NXDOMAIN is observed, should the row be marked **permanently** non-deliverable (terminal UNQUALIFIED, no cooldown retry), or kept on the 7-day cooldown? The batch C-1 fix distinguished NXDOMAIN at reason level without changing retry behaviour; this question asks whether to CHANGE retry behaviour post-M202.
- **Q4** For State 4 BUSINESS_ASSOCIATED when a business has no `website_apex`: owner's earlier card had this as `12.D3 FOUND without apex: keep or discard`. The proposed model treats this as State 3 reached but State 4 Failed. Owner confirms?
- **Q5** For State 5 CONFIRMED: besides the five candidate mechanisms in §1.1, are there owner-known mechanisms not listed?

## 7 · Companion documents

- `nex-harvester-email-qualification-2026-10-16.md` §§1-9 (sealed state machine) + §§10-18 (DRAFT)
- `nex-jurisdiction-fact-assessment-draft-2026-10-27.md` (gates State 5 resolution)
- `nex-source-allowlist-structure-draft-2026-10-27.md` (purpose_scope per source gates State 5 mechanism)

## 8 · What this document, as recorded, does and does not

### DOES
- Define the proposed five states and the evidence record per state.
- Map sealed labels to the proposed model.
- Flag the three alignment options for owner decision Q1.
- Preserve the sealed doctrine unchanged.

### DOES NOT
- Edit the sealed doctrine.
- Change any schema or env.
- Send email, contact businesses, or wire a confirmation mechanism.
- Pre-select a confirmation mechanism before E-D1 + counsel conclude.
- Unblock Gate G-A.
