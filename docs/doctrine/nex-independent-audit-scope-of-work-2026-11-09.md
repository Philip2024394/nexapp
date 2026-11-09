# NEX · Independent Privacy Audit · Scope of Work
### 2026-11-09 · Build Phase F handoff · for the independent third-party auditor

**Purpose:** Single-document scope-of-work (SoW) so an independent privacy auditor can execute the verification required to make the sealed State C claim (sealed invariant I-6) across NEX's device-only private chat architecture.

**Audience:** The independent third-party privacy auditor engaged by NEX (expected to be a reputable privacy-engineering consultancy or specialist firm · independent of NEX's engineering team).

**Author:** Claude Opus 4.7 · prepared at owner direction as pre-engagement SoW · not legal advice · not an audit report.

**Not a letter of engagement:** Scope, fees, timeline, and retainer are between NEX and the auditor.

---

## 1 · The claim being audited

NEX's launch principle, sealed by the owner, is:

> *"NEX does not keep a copy of your private conversations. Your conversations belong to you and remain on your devices."*

NEX will NOT make this claim publicly until an independent audit verifies it across every applicable surface atomically (sealed invariant I-6).

The auditor's job is to produce a signed, written determination of:
1. Whether the claim is true across every applicable surface
2. If not, what specifically is false and what remediation is required

---

## 2 · The three-state framework

NEX distinguishes:

| State | Meaning |
|---|---|
| **A** · Feature disabled | A code path exists to receive/store private content but is disabled · data may still be present |
| **B** · Data deleted | The underlying data has been removed · but the removal has not been independently verified · operational errors or rollbacks may have restored copies |
| **C** · Deletion independently verified | An independent auditor has confirmed no copy exists and no mechanism can restore one |

The auditor's job is specifically to verify **State C** · not State A · not State B.

---

## 3 · The six sealed invariants being audited

| # | Invariant | How to audit |
|---|---|---|
| I-1 | No private message content (bodies / ciphertext / attachment bytes / sensitive structured metadata) retained by NEX servers | DB inspection · storage bucket inspection · log inspection · network capture |
| I-2 | No offline-delivery queue · no transient encrypted stash · no store-and-forward | Code inspection · DB inspection · traffic capture · chaos tests |
| I-3 | No plaintext exception for business chat / NEX Official / HQ Direct Channel | Code inspection · DB inspection · targeted traffic tests against each surface |
| I-4 | No historical deletion without separate explicit owner authorisation | Audit log inspection · deletion-authorisation documentation inspection |
| I-5 | No rollback restores private message content | Backup inspection · restore-rehearsal · migration-rollback script inspection |
| I-6 | No public device-only-privacy claim until State C independently verified across every applicable surface atomically | This SoW itself · the audit output is the evidence |

---

## 4 · Applicable surfaces (per Phase 2 Rev 2 §21)

The audit covers these NEX surfaces atomically · failing any one surface fails the launch gate:

| Surface | Description |
|---|---|
| S-1 · NEX Chat (peer-to-peer private) | Primary device-only private chat · `/free-chat` |
| S-2 · Business Chat (user ↔ seller) | Shop-contact private chat · same device-only architecture |
| S-3 · NEX Official (system → user private) | System announcements delivered as private chat · recipient-device-encrypted |
| S-4 · HQ Direct Channel | Admin-to-user private channel · recipient-device-encrypted |
| S-5 · Attachments (images · video · voice · documents) | Peer-to-peer data-channel · not server-stored |
| S-6 · Voice/video calls | WebRTC media · TURN relay transit-only · no recording |
| S-7 · Push notifications | Content-free wake-up only |
| S-8 · Device-local history + export | On-device IndexedDB · user-controlled export |

---

## 5 · Evidence points the auditor must verify (V-* matrix from Phase 2 Rev 2 §19)

### V-NET-1 · Network capture · signalling envelope zero-retention

**Scope:** Verify that NEX's WebSocket signalling for connection establishment carries only ephemeral envelopes that are purged within 60-120 seconds.

**Evidence method:**
- Live pcap captures (both server-side TAP and client-side instrumentation) of 50+ signalling-only sessions
- DB inspection showing no persistent signalling record beyond the ephemeral TTL
- Code inspection of the signalling service for retention logic

**Pass criteria:** No signalling-envelope record exists in any NEX datastore more than 120 seconds after the connection terminates OR fails.

### V-NET-2 · Network capture · peer-to-peer data-channel direct path

**Scope:** Verify that private messages travel peer-to-peer over the WebRTC data channel without NEX servers seeing the plaintext or ciphertext.

**Evidence method:**
- Server-side TAP pcaps showing only STUN/TURN handshake traffic and no message payload
- Client-side instrumentation confirming message bytes went directly to peer
- Verification that TURN relay (when used for NAT-fallback) carries encrypted media/data only · not inspected/logged by NEX

**Pass criteria:** NEX servers never see plaintext OR ciphertext message bodies. TURN relay carries encrypted bytes only and the provider's zero-retention claim is independently verified (see V-TURN-1).

### V-STORE-1 · DB inspection · no body / no ciphertext

**Scope:** Verify that no NEX database table contains message-body or ciphertext columns in active use.

**Evidence method:**
- Full schema dump · auditor inspects for any column named like `body` · `ciphertext` · `content` · `encrypted` in message-related tables
- Query evidence showing all historical body/ciphertext columns (if any legacy remnants) are removed or null across all rows
- Review of migration history to confirm schema is at State C post-sweep

**Pass criteria:** Zero rows contain plaintext or ciphertext message bodies. Columns are either absent or confirmed-empty.

### V-STORE-2 · DB inspection · no sensitive attachment metadata

**Scope:** Verify that no NEX database table contains sensitive message-attachment metadata (e.g. product names, cart contents, personal data snapshots) beyond minimal routing.

**Evidence method:**
- Schema inspection of `nex_peer_message` · `nex_message` · any related tables
- Sample row inspection confirming only minimal routing metadata (participant IDs · timestamps · opaque attachment IDs)

**Pass criteria:** No sensitive content in attachment_meta columns.

### V-STORE-3 · Storage bucket inspection · no private attachments

**Scope:** Verify that no Supabase Storage bucket contains private chat attachments.

**Evidence method:**
- Bucket enumeration · list all buckets in sealed Supabase project
- Policy inspection confirming no bucket is a "chat attachment" destination
- Object sample inspection confirming no bucket contains files tied to chat-attachment UUIDs
- Historical sweep audit log showing public chat-attachment bucket was retired

**Pass criteria:** No private chat attachments in any bucket. Business-public assets bucket exists for public business content only · confirmed separate.

### V-LOG-1 · Log inspection · no sensitive leakage

**Scope:** Verify that no NEX application log, error log, or audit log contains message bodies, ciphertext, or sensitive user content.

**Evidence method:**
- Log-pipeline inspection · trace from app → Vercel logs → external sinks (Sentry if used)
- Sample log analysis across a representative 30-day window
- Code inspection of logging statements and PII-scrubbers
- Error-handling code inspection

**Pass criteria:** No log line contains message body, ciphertext, attachment payload, cart content, order contents, or similar.

### V-SIG-1 · Signalling matrix · identity encryption all surfaces

**Scope:** Verify that every surface (S-1..S-8) uses recipient-device-encrypted delivery. No plaintext exception exists for any surface.

**Evidence method:**
- Code inspection per surface
- Traffic test per surface (send a message through S-1..S-4 · confirm ciphertext not plaintext on wire)
- DB inspection confirming no plaintext record per surface

**Pass criteria:** Each surface sends and receives only encrypted content. Zero plaintext exceptions.

### V-TURN-1 · TURN provider zero-persistence evidence

**Scope:** Verify that the sealed TURN relay provider (D-5 pending seal · candidate Cloudflare Realtime) does not persist, log, or retain encrypted media/data packets.

**Evidence method:**
- Provider DPA review
- Provider logging-configuration confirmation (zero-retention setting enabled)
- Provider SOC 2 + ISO 27001 evidence review
- Provider penetration-test summary review
- Credential-model review · per-session short-TTL credentials · non-reusable
- If possible: independent traffic test confirming no visible persistence

**Pass criteria:** Provider's zero-retention claim is independently verified via contract + documentation + at least one external audit certification.

### V-DELETION-1 · Historical sweep verification

**Scope:** Verify that the historical secure-deletion sweep (S0..S6 phases) removed all pre-device-only private message content and that backups do not preserve a copy.

**Evidence method:**
- Sweep audit log review · each phase's execution record
- Per-phase I-4 authorisation documentation review
- Backup inspection · confirm backups from before/during sweep are either deleted or purged of swept content
- Restore-rehearsal in a sandbox · confirm restore cannot resurrect swept content
- Cross-reference legal memo (L-1..L-6 · Phase A deliverable) confirming retained categories are not private chat content

**Pass criteria:** All pre-device-only private chat content is verified gone AND no backup can restore it. Legal-retention carve-outs (tax/commercial-records) are confirmed to not include private chat bodies.

---

## 6 · Specific access the auditor needs

Owner must provide the auditor with:

| Access | Purpose |
|---|---|
| Read-only Supabase project access (sealed `ijvqdvsvwtwxzcqmoqit`) · DB + storage + logs | V-STORE-1/2/3 · V-LOG-1 |
| Read-only Vercel project access · logs · env-var listings (secret values redacted) | V-LOG-1 · env config review |
| Read-only GitHub repository access (feature-branch + main) | V-NET-1/2 · V-STORE-* · V-SIG-1 code inspection |
| Network capture facility · ability to run server-side TAP or request pcap bundles | V-NET-1 · V-NET-2 |
| Historical sweep execution logs (S0..S6) | V-DELETION-1 |
| Backup inventory + restore-rehearsal sandbox | V-DELETION-1 |
| Processor DPA bundle (Supabase · Vercel · Stripe · TURN provider · Sentry) | V-TURN-1 · processor review |
| Legal memo L-1..L-6 (Phase A) | V-DELETION-1 legal-retention review |
| Access to 2-3 NEX engineers for Q&A | Audit methodology |

---

## 7 · What is out of audit scope

- NEX Shop feature functional testing
- Buyer-seller payment flow security (separate audit scope)
- Marketing claim review (that is counsel's role)
- Performance / load testing
- Accessibility audit
- Business-storage bucket audit (deferred per Phase 7 seal · if business storage launches, it gets its own audit)
- Public business content (not private)

---

## 8 · Audit methodology

The auditor should:
1. Review this SoW and confirm scope
2. Review the Phase 2 Rev 2 doctrine as the engineering specification
3. Review the Privacy Policy draft (post-Phase A review) as the public commitment
4. Execute the V-* matrix per Section 5
5. Document any gaps or State B/A conditions found
6. Issue findings to NEX engineering for remediation
7. Re-verify after remediation
8. Issue signed final report

---

## 9 · Deliverables expected from the auditor

| Deliverable | Format |
|---|---|
| Methodology plan | Written document · owner review before execution |
| Findings report | Written document · per V-* evidence point · pass/fail + evidence |
| Remediation items | If State B/A conditions found · prioritised list for NEX engineering |
| Signed final report | After remediation closed · explicit State C confirmation (or State B/A conclusion) |
| Independence declaration | Statement that auditor has no commercial or personal interest in NEX beyond the audit retainer |

---

## 10 · Conflicts of interest

The auditor must declare and avoid:
- Prior engagement with NEX engineering team members
- Financial interest in NEX
- Equity holdings in Supabase · Vercel · Stripe · the chosen TURN provider
- Current competing engagement with a NEX competitor

---

## 11 · Timeline expectation

- Engagement signed: Week 0
- Methodology plan: Weeks 1-2
- Evidence collection: Weeks 2-6
- Findings report: Week 7
- Remediation (NEX engineering): Weeks 7-12 (variable)
- Re-verification: Weeks 12-14
- Signed final report: Week 14-18

Phase F budget in the 8-workstream plan is 8-18 weeks.

---

## 12 · Reporting line

Auditor reports to the NEX owner directly · NOT to NEX engineering. Engineering receives findings and performs remediation but does not control the audit.

---

## 13 · What this SoW does + does NOT do

### Does
- Define the audit scope precisely
- Enumerate every V-* evidence point the auditor must verify
- Specify the access the owner must provide
- Set the deliverable format expectations

### Does NOT
- Engage any auditor (owner-side action)
- Authorise any production data access
- Replace the auditor's methodology (auditor's professional judgement)
- Guarantee a State C conclusion (the audit is the verification · not the prediction)

---

## 14 · Phase F entry gates (reminder from 8-workstream plan)

Build Phase F cannot start until:
- Phase D complete (Phase 2 architecture verified in sandbox)
- Phase E complete (downstream remediation verified)

Until then, this SoW sits as a ready-to-use handoff.

---

**End of independent privacy audit scope-of-work.**

Ready for owner transmission to designated auditor when Phase F entry gates are satisfied.
