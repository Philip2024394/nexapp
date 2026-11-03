# NEX Option 2 · Founder Decisions · Consolidated · 2026-11-03

## A · Document authority and purpose

This document consolidates the founder's product and architecture direction for NEX Option 2 as recorded on 3 November 2026. It is the authoritative reference for founder-approved direction across all twenty decisions (D1-D20).

**What this document is:**
- A single-reference record of founder positions and their statuses.
- A reference for engineering, security review, legal review, and NEX leadership to work from.
- A snapshot of unresolved questions, conditions, and specialist-review requirements.

**What this document is NOT:**
- A technical implementation specification.
- An independent security assessment or cryptographic certification.
- A legal opinion.
- Launch acceptance.
- Permission to begin implementation, access production, or initiate external reviews.

**Source documents (read-only · unchanged by this consolidation):**
- `docs/doctrine/nex-option-2-blocker-resolution-proposals-2026-11-03.md`
- `docs/doctrine/nex-option-2-owner-decision-register-2026-11-03.md`
- `docs/doctrine/nex-option-2-decision-register-reconciliation-2026-11-03.md`

Where this consolidation differs in classification from the original register, the founder's statuses in Sections B and C of this document take precedence as the current direction. (Section E holds the ten launch-acceptance conditions, not statuses · earlier drafts of this document mislabeled the pointer.) Where protocol detail is referenced, this document does not add or alter technical specification; the three source documents remain authoritative for narrative and analysis.

---

## B · Status at a glance

| ID | Short description | Status |
|---|---|---|
| D1 | Separate identity/encryption keys, subject to vetted protocol | Approved direction |
| D2 | Unique message protection; key lifecycle governed by chosen protocol | Conditional |
| D3 | Challenge-response, trusted-device approval, audit and notification | Approved direction |
| D4 | No email-only identity recovery; prefer user-controlled pre-provisioned credential | Approved direction |
| D5 | Cryptographically authenticated QR linking | Approved direction |
| D6 | No automatic historical sync | Approved direction |
| D7 | Delivered is not read; no read receipt in initial release | Approved direction |
| D8 | Seven-day relay TTL | Provisional |
| D9 | Sixty-second signed URL | Provisional |
| D10 | Weekly review and immediate alerts for serious failures | Conditional |
| D11 | Named Gate 1 operational ownership | **Not approved** |
| D12 | Fail-safe 403 circuit: pause before dead-letter | Approved direction |
| D13 | No indefinite dual-write; defined purpose and explicit end date if any | Approved direction |
| D14 | Freeze is an absolute timestamp; no date chosen yet | Deferred |
| D15 | At least 90-day export window as planning value; legal review determines actual | Provisional |
| D16 | At least 30-day initial notification lead time as planning value; legal review determines actual | Approved direction |
| D17 | No assumed consent through silence; lawful basis determined by legal review | Approved direction |
| D18 | Eventual lawful purge; no silent deletion claims; no indefinite preservation | Conditional |
| D19 | Separate Subject Access Request process independent of convenience export | Approved direction |
| D20 | Include proven forward-secret protocol in initial design; no launch with current static-wrap design | Approved direction |

Status labels (vocabulary used throughout this document):

- **Approved direction** · founder has set product/architectural direction. Not implementation approval. Specialist review may still be required.
- **Provisional** · direction is a planning value. Needs real-world validation (operational data, legal review, specialist analysis) before it hardens.
- **Conditional** · approval depends on another decision being resolved first.
- **Deferred** · founder has not yet set the value.
- **Not approved** · explicit blocker. Must be resolved before dependent work can proceed.

---

## C · Full founder decision record

Each entry below contains: founder position · status · conditions and dependencies · unresolved questions · required specialist review · what must be proven before launch acceptance.

### C.1 · Security decisions

#### D1 · Key architecture

- **Founder position.** NEX separates cryptographic roles across keys: identity keys for authentication, encryption keys for secure sessions, short-lived session and message keys for message protection. Do not use one key for both signing and encryption. NEX will not independently invent a protocol by combining Ed25519, X25519 or other primitives without a complete, reviewed design.
- **Status.** Approved direction.
- **Conditions and dependencies.** Must be adopted together with D2 and D20 as one cryptographic protocol design. Independent cryptographic reviewer must approve the final choice of protocol and implementation.
- **Unresolved questions.** Which maintained, audited protocol implementation NEX will adopt. How existing device-key schema migrates to the new key architecture. Browser-side storage model for separate key types.
- **Required specialist review.** Qualified independent cryptographic review of the final protocol selection and composition.
- **Launch-acceptance proof.** Full protocol specification exists; reviewer has signed off; schema migration plan is tested; peer-side identity rotation semantics are documented.

#### D2 · Content-key provenance and message protection

- **Founder position.** Every message must have unique cryptographic protection. Nonces must never be reused with the same key. Attachments must have separate encryption and key-management rules. If NEX adopts Double Ratchet (see D20), message keys follow that protocol's ratchet construction rather than an unrelated random content-key system.
- **Status.** Conditional. Depends on D1 and D20 resolving together as one protocol design.
- **Conditions and dependencies.** Key lifecycle is governed by the selected established protocol; cannot be specified independently of D1 and D20.
- **Unresolved questions.** Exact key-derivation rules once protocol is chosen. Attachment envelope format. Replay-protection anchor location in the chosen envelope (metadata vs encrypted payload).
- **Required specialist review.** Cryptographic reviewer must approve the final key lifecycle, nonce discipline and replay protection together with D1 and D20.
- **Launch-acceptance proof.** Protocol specification documents message-key lifecycle; test vectors demonstrate no key or nonce reuse; attachment envelope approved by reviewer.

#### D3 · Device registration proof-of-possession

- **Founder position.** New device generates its own private keys locally. Server issues a fresh unpredictable challenge. New device proves possession of the corresponding private key. Existing trusted device separately authorises the registration. Registration produces an auditable event. User receives a security notification. Device revocation is immediately reflected in future delivery decisions. For first-device registration, the trust-on-first-use limitation is documented.
- **Status.** Approved direction.
- **Conditions and dependencies.** Must be assessed together with D4 and D5 as one device-identity and trust system. Signing a server challenge proves possession of a key but does not prove the account owner authorised the key; trusted-device approval is therefore essential.
- **Unresolved questions.** Push-notification infrastructure for the approval prompt. Timeout values for pending registrations. First-device registration audit trail format. Rate-limit policy for registration endpoints.
- **Required specialist review.** Cryptographic review of the challenge-response construction and its interaction with session compromise, as part of the integrated D3+D4+D5 review.
- **Launch-acceptance proof.** Registration endpoints exist with tested challenge-response flow; trusted-device approval UI is functional on multiple devices; audit events are observable; user notification is reliable; peer-side revocation propagation is tested.

#### D4 · Account recovery when all devices are lost

- **Founder position.** No email-only restoration of an existing cryptographic identity. No server-held private keys. No secret server recovery of historical plaintext. A user-controlled pre-provisioned recovery credential is the preferred future option. If no valid recovery credential exists, the user creates a new cryptographic identity and must re-verify with contacts. Peer-assisted recovery may be considered later but must never silently allow contacts to transfer another person's identity.
- **Status.** Approved direction.
- **Conditions and dependencies.** Pre-provisioned recovery credential (if adopted) must be generated and protected such that NEX cannot use it to decrypt users' conversations. Must be reviewed as part of the integrated D3+D4+D5 trust system.
- **Unresolved questions.** Whether to adopt pre-provisioned mnemonic, peer co-signed recovery, both, or neither in initial release. UX for recovery credential capture at signup. Format and derivation of the recovery credential.
- **Required specialist review.** Cryptographic + legal review of the chosen recovery model, specifically examining identity-provider interactions, trust-chain breakage disclosure to peers, and any legal obligations in NEX's operational jurisdictions.
- **Launch-acceptance proof.** Chosen recovery model is specified, reviewed, and tested; user-facing copy for recovery warnings is approved; peer-side trust-state transitions for recovery events are implemented and tested.

#### D5 · QR linking signature authority

- **Founder position.** The trusted device authorises the new device. QR payload is short-lived and single-use. Linking information is authenticated. Both devices display a matching verification value. New device proves possession of its private key. Final approval is signed by the trusted device. Replayed or expired linking requests are rejected. Users can inspect and revoke linked devices. A QR code containing a public key is not automatically trustworthy; the receiving device must already have a trustworthy way to authenticate the primary device's identity.
- **Status.** Approved direction.
- **Conditions and dependencies.** Signature authority depends on D1 (identity key existence). Must be reviewed as part of the integrated D3+D4+D5 trust system.
- **Unresolved questions.** QR encoding format and byte-size budget. Visual-match code presentation (digit grouping, accessibility, high-contrast rendering). Fallback for devices without camera (manual link-code). Multi-pending-link handling.
- **Required specialist review.** Cryptographic review of QR authenticity + visual-match derivation as part of the integrated D3+D4+D5 review.
- **Launch-acceptance proof.** QR linking flow is end-to-end tested; replayed/expired/substituted payloads are rejected in test; linked-device inventory and revocation UI is functional; peer-side NEW DEVICE trust-state transitions fire correctly.

#### D6 · New-device historical synchronisation

- **Founder position.** A newly linked device starts with an empty local history. It receives messages from the time it is linked onward. The user is told clearly: "This device will receive new messages from now on. It will not automatically receive your previous conversation history." A future user-controlled transfer feature may be considered, provided the original device encrypts the history directly for the new device and the user explicitly authorises the transfer.
- **Status.** Approved direction.
- **Conditions and dependencies.** Depends on D5 (linking mechanism). Future opt-in transfer is a separate feature with its own authorisation.
- **Unresolved questions.** None in initial release (no sync is the chosen default).
- **Required specialist review.** None in initial release. Future opt-in transfer feature would require its own review.
- **Launch-acceptance proof.** New-device UI copy is approved and displayed at link time; absence of automatic sync is confirmed in integration tests.

#### D7 · Delivered versus read semantics

- **Founder position.** Sender sees "Sent" (accepted by the sending system), "Delivered" (received by all intended recipient devices under the agreed delivery definition), and no "Read" status in the initial Option 2 design. No read-receipt event in initial release. Delivery ACK does not mean the person has read the message.
- **Status.** Approved direction.
- **Conditions and dependencies.** None.
- **Unresolved questions.** Future opt-in read-receipt feature is deferred to a later stage.
- **Required specialist review.** None.
- **Launch-acceptance proof.** UI copy and tooltips reflect the distinction; integration tests confirm no read-receipt event is emitted.

### C.2 · Operational decisions

#### D8 · TTL for undelivered messages

- **Founder position.** Seven days as the initial proposed delivery window. The relay must not become permanent message storage. Users must understand that devices offline beyond the agreed retention period may not receive older undelivered messages. TTL expiry must respect missing-key quarantine and owner-approved retention; seven days must never become a reason to silently delete an unresolved group.
- **Status.** Provisional. Must be validated with real delivery behaviour and operational monitoring before implementation approval.
- **Conditions and dependencies.** Interacts with D11 (Gate 1 operational monitoring) and quarantine retention policy (preserved from sealed earlier decisions).
- **Unresolved questions.** Whether 7 days survives real-world telemetry. Interaction with device-usage patterns across jurisdictions.
- **Required specialist review.** None cryptographic. Operational review once telemetry is available.
- **Launch-acceptance proof.** TTL enforcement observed in staging under realistic load; quarantine override of TTL confirmed; user-facing copy explaining the delivery window is approved.

#### D9 · Signed URL expiry

- **Founder position.** 60 seconds. Short-lived signed URLs, private storage, ciphertext-only attachment objects. Failed or expired downloads request a fresh authorised URL. URL must not become a permanent attachment-sharing mechanism.
- **Status.** Provisional. Must be validated against real mobile network behaviour, URL revocation limitations, and the chosen Storage provider.
- **Conditions and dependencies.** None internal. External dependency on Supabase Storage signed-URL behaviour.
- **Unresolved questions.** Whether 60 seconds survives mobile-network reality (slow uploads/downloads on constrained networks). Behaviour of signed URLs after their expiry (403 vs 404 at Storage layer).
- **Required specialist review.** None cryptographic. Operational review during integration.
- **Launch-acceptance proof.** Signed-URL generation + revocation observed; client re-request logic tested; failed-download recovery flow tested.

#### D10 · Dead-letter SLA

- **Founder position.** Weekly formal review with immediate alerts for serious failures. Every dead-letter row is observable. Each failure has a reason. Retrying is auditable. Storage orphans can be reconciled. Global authentication and permission failures trigger immediate investigation. Operators cannot silently delete unresolved quarantine records.
- **Status.** Conditional. Depends on D11 (Gate 1 operational ownership).
- **Conditions and dependencies.** No weekly review is meaningful without a named reviewer, a working dashboard, and a reliable alert route. All three are Gate 1 responsibilities.
- **Unresolved questions.** Final thresholds for escalation (the proposed 14-day/50-row figures are starting operational thresholds, not permanent rules).
- **Required specialist review.** None.
- **Launch-acceptance proof.** Gate 1 complete; dashboard operational; alert route tested with a deliberate induced failure; weekly-review runbook executed at least once.

#### D11 · Gate 1 operational ownership

- **Founder position.** No invention of an employee, team, PagerDuty account, Slack channel or email route. Owner-approval-only quarantine is meaningless if nobody is responsible for responding.
- **Status.** **Not approved — unresolved Gate 1 operational ownership.**
- **Conditions and dependencies.** None internal. Blocks every stage from B4 onwards (all cleanup, quarantine, purge, and attachment-worker activity).
- **Missing operational requirements (preserved from scope):**
  1. Named quarantine rota owner.
  2. Actual notification route and confirmed subscription.
  3. Tested operator runbook.
  4. Formal review cadence.
  5. Defined quarantine capacity threshold.
  6. Escalation and accountability arrangements.
- **Required specialist review.** None cryptographic. Operational and governance definition required.
- **Launch-acceptance proof.** All six items above exist, are tested, and have been validated by the founder.

#### D12 · HTTP 403 circuit thresholds

- **Founder position.** A 403 must not automatically dead-letter an attachment. Default behaviour: pause the affected worker when a global permission failure is suspected; preserve queued records; notify the responsible operator; investigate whether the failure is object-specific or bucket-wide; resume only after the underlying issue is understood. If classification is uncertain, pause rather than mass-dead-letter.
- **Status.** Approved direction. The proposed "3 distinct-key 403s within 60 seconds" may serve as an initial detection threshold only after testing.
- **Conditions and dependencies.** Depends on D11 (operator must receive the pause page). Depends on `nex_worker_state` table design (not drafted here).
- **Unresolved questions.** Final tuned threshold values. Hysteresis to prevent pause-resume-pause oscillation under flapping policies.
- **Required specialist review.** None.
- **Launch-acceptance proof.** Circuit tested against induced 403 scenarios (bucket-policy, service-role-rotation, single-object anomaly); pause-page delivery verified; operator resume procedure tested.

### C.3 · Legal / Privacy decisions

#### D13 · Dual-write duration

- **Founder position.** No indefinite dual-writing. NEX will not establish two permanent message-storage systems. Dual-write of 30-60 days of unnecessary plaintext duplication merely to make migration convenient is not approved. If temporary dual-writing is technically unavoidable, it must have an explicit end date, a defined purpose, and a documented deletion plan.
- **Status.** Approved direction.
- **Conditions and dependencies.** Any dual-write period must be tied to an absolute T_freeze (D14) and must have a documented purpose.
- **Unresolved questions.** Whether dual-write is technically necessary at all under the chosen protocol. If so, what duration is justified by the defined purpose.
- **Required specialist review.** None cryptographic. Engineering review of whether dual-write is required.
- **Launch-acceptance proof.** Either (a) no dual-write phase in the final plan, or (b) a documented purpose, duration, and deletion plan for any dual-write that is included.

#### D14 · Absolute plaintext freeze timestamp

- **Founder position.** The freeze is a specific absolute timestamp, not an indefinite conditional event. No date is chosen until: the encrypted path has passed acceptance tests; user communication is ready; export arrangements are working; legal review is complete; operational ownership is established; the rollback and irreversible-deletion boundaries are documented.
- **Status.** Deferred.
- **Conditions and dependencies.** Six prerequisites listed above. All must be satisfied before a date is set.
- **Unresolved questions.** Every prerequisite is currently unmet.
- **Required specialist review.** Legal review of chosen date against jurisdiction-specific notice obligations.
- **Launch-acceptance proof.** All six prerequisites met; date is set in writing by the founder; rollback vs irreversible-deletion boundary is explicitly documented in the operator runbook.

#### D15 · Legacy export window

- **Founder position.** At least 90 days as a planning value. Users should receive a meaningful opportunity to export their historical data. The export mechanism must be secure, understandable, and tested. 90 days is a planning proposal, not a GDPR statutory requirement. The legal reviewer must establish the actual requirements.
- **Status.** Provisional. Subject to legal review.
- **Conditions and dependencies.** Depends on D14 (T_freeze) and legal review.
- **Unresolved questions.** Jurisdiction-specific statutory minimum. Interaction with Subject Access Request obligations. Export format and attachment handling.
- **Required specialist review.** Qualified legal review of GDPR Art 12 interaction with the chosen window; jurisdiction-specific requirements in NEX's operational regions.
- **Launch-acceptance proof.** Window length approved in writing by legal reviewer; export endpoint deployed and tested; export bundle format approved; export log retention policy approved.

#### D16 · User notification lead time

- **Founder position.** At least 30 days as a planning minimum. Communicate through in-app notifications, email where available and lawful, a permanent settings/privacy explanation, and reminder notifications before the freeze. The notification must explain what changes, what users need to do, what happens to old messages, and what happens if they do nothing. 30 days is a proposed minimum, not a substitute for jurisdiction-specific legal advice.
- **Status.** Approved direction. Subject to legal review for jurisdiction-specific requirements.
- **Conditions and dependencies.** Depends on D14 (T_freeze).
- **Unresolved questions.** Multilingual notification requirements. Email-provider deliverability. Jurisdictional variations in notice obligations.
- **Required specialist review.** Qualified legal review of notification cadence and content per jurisdiction.
- **Launch-acceptance proof.** Notification campaign is set up; copy is approved per language; email delivery is tested; settings/privacy explainer page is published; reminder cadence runs correctly in staging.

#### D17 · Consent model

- **Founder position.** Silence is never assumed to be consent without legal review. NEX must establish the correct lawful basis for each relevant processing activity. A reduction in server-side data processing does not automatically mean that every related change is exempt from transparency, notice, or consent requirements. Legal reviewer determines whether existing bases remain valid, whether a privacy notice update is sufficient, whether fresh contractual acceptance is needed, or whether explicit opt-in is required for any optional feature.
- **Status.** Approved direction. Subject to legal review.
- **Conditions and dependencies.** Depends on D16 (notification lead time) and jurisdiction-specific legal advice.
- **Unresolved questions.** Final consent mechanism (informed non-objection, fresh ToS acceptance, explicit opt-in, or a hybrid). Audit-log retention for consent/non-objection actions.
- **Required specialist review.** Qualified legal review of GDPR Art 7 interpretation and jurisdiction-specific obligations.
- **Launch-acceptance proof.** Legal reviewer has approved the chosen mechanism in writing; consent-flow (if any) is implemented and tested; audit log of user actions is operational.

#### D18 · Users who do not return

- **Founder position.** Eventual lawful purge of legacy server-held history, subject to lawful notice, legal review, and any valid legal holds. NEX cannot retain permanent server-side history simply because a user has stopped using the platform. However, the user must be given appropriate opportunity to understand and export. For users who never return: do not silently pretend they exported; do not automatically delete their entire account merely because they did not return; do not preserve legacy plaintext indefinitely by default; apply the legally reviewed transition and deletion policy; maintain only records that are lawfully required, with appropriate access restrictions and retention limits.
- **Status.** Conditional. Depends on legal review (D17 and jurisdictional obligations).
- **Conditions and dependencies.** Depends on D15, D16, D17.
- **Unresolved questions.** Specific definition of "inactive". Interaction with legal holds. Retention policy for records required by law.
- **Required specialist review.** Qualified legal review of data-minimisation balance under GDPR Art 5(1)(e) and jurisdiction-specific regulations.
- **Launch-acceptance proof.** Legal reviewer has approved the policy in writing; final-purge procedure is documented; audit trail of per-user purge decisions is operational.

#### D19 · GDPR Subject Access Requests at export closure

- **Founder position.** A chat-history export is not necessarily a complete Subject Access Request. Pending SARs are identified before final purge; assigned to an accountable operator; processed within applicable legal deadlines; relevant data preserved only where legally justified; user receives an appropriate response; completion is auditable; any legally required retention is narrowly scoped and time-limited. The export-window closure is not permission to ignore outstanding legal requests.
- **Status.** Approved direction. Subject to legal review.
- **Conditions and dependencies.** Depends on D15 and D17.
- **Unresolved questions.** SAR fulfilment process definition. Operator capacity planning. Audit-log retention for SAR responses.
- **Required specialist review.** Qualified legal review of SAR fulfilment obligations per jurisdiction.
- **Launch-acceptance proof.** Separate SAR workflow is documented and tested; operator capacity assessed; audit trail is operational.

### C.4 · Additional security decision

#### D20 · Forward secrecy and Double Ratchet

- **Founder position.** Include a proven forward-secret messaging protocol in the initial Option 2 design. Do not launch with the current static-recipient-key wrapping design while claiming forward secrecy. Deleting the sender's ephemeral private key does not provide meaningful forward secrecy if the recipient's long-term private encryption key is compromised later. Adopt a mature, independently reviewed end-to-end encryption protocol that provides forward secrecy and post-compromise security. Use Double Ratchet or a reviewed equivalent for ongoing message-key evolution. Use an appropriate authenticated initial key agreement. Define multi-device session establishment and maintenance. Ensure device addition and revocation do not silently weaken existing sessions. Include replay protection and authenticated message identity. Test recovery and re-establishment after device compromise. Do not implement a home-built Double Ratchet merely because the algorithm is publicly described.
- **Status.** Approved direction. Qualified independent cryptographic review is mandatory before implementation approval.
- **Conditions and dependencies.** Must be assessed together with D1 and D2 as one cryptographic protocol design.
- **Unresolved questions.** Which specific protocol (Signal Protocol / libsignal / Noise-based alternative / other). Multi-device session semantics. Browser-side state management for ratchet chains. Pre-key infrastructure.
- **Required specialist review.** Qualified independent cryptographic review of the final protocol selection, implementation choice, and the entire D1+D2+D20 composition.
- **Launch-acceptance proof.** Protocol selected and specified; reviewer has signed off; implementation uses a maintained, audited library; end-to-end tests demonstrate forward secrecy properties against defined threat model; post-compromise security tested in staging.

---

## D · Two integrated decision clusters

### D.1 · Cryptographic protocol decision · D1 + D2 + D20

**Cluster rule.** D1, D2 and D20 are not three independent technical approvals. They are ONE cryptographic protocol decision. Independent cryptographic review must examine them together.

**Founder direction for the cluster:**

- Separate identity and encryption keys (D1).
- Unique message protection with no nonce or key reuse (D2).
- Key lifecycle governed by the chosen established protocol, not an ad-hoc random-key scheme (D2 + D20).
- Include a proven forward-secret protocol (such as Double Ratchet or a reviewed equivalent) in the initial design (D20).
- Do not launch using the existing static-wrap design (D20).
- No proprietary cryptographic invention (D1 + D20).
- No composition of individual primitives into a bespoke protocol without complete reviewed design (D1).

**What this document does NOT specify:**
- Algorithm choices beyond "identity key" / "encryption key" / "forward-secret protocol" category labels.
- Parameter values (key sizes, iteration counts, derivation inputs).
- Key-derivation rules.
- Packet / envelope formats.
- Protocol state machines.
- Byte-level encoding of any message, certificate, or handshake.
- Which specific library (libsignal, Noise-based, other) will be adopted.

**Why.** This document is a founder-direction record, not a protocol specification. Writing protocol details here would risk turning preliminary direction into apparent specification. The actual protocol is produced by qualified specialists working from the direction above and independently reviewed.

**Launch-acceptance proof for the cluster.** A complete protocol specification covering identity keys, encryption keys, session establishment, message-key evolution, device addition and revocation, replay protection, and recovery after compromise. Independent cryptographic review has signed off on the specification and the chosen implementation.

### D.2 · Device identity and trust decision · D3 + D4 + D5

**Cluster rule.** D3, D4 and D5 are not three independent trust mechanisms. They are ONE device-identity and trust system. Registration, recovery, and linking must be reviewed as a coherent whole.

**Founder direction for the cluster:**

- Device registration requires both challenge-response (proving control of the newly-registered private key) and approval from an existing trusted device (preventing a compromised session from silently registering an attacker-controlled device) (D3).
- No email-only transfer or recovery of cryptographic identity. No server-held private keys. No secret server recovery of historical plaintext (D4).
- Prefer a user-controlled pre-provisioned recovery credential, subject to specialist review. Peer-assisted recovery may be considered later but must not silently allow contacts to transfer another person's identity (D4).
- Device linking uses authenticated, short-lived QR linking signed by an existing trusted device, with cryptographic confirmation and visible verification value (D5).
- Registration, recovery, and linking must be assessed as one coherent trust model, not three isolated endpoints.

**What this document does NOT specify:**
- The underlying cryptographic protocol (that is in cluster D.1).
- Byte-level QR encoding.
- Specific recovery-credential format (mnemonic length, derivation function, encoding).
- Specific challenge-response wire format.
- Push-notification infrastructure.

**Why.** The trust system's security properties depend on the chosen cryptographic protocol. Specifying trust mechanics in isolation risks mismatch when the protocol is chosen. The complete trust system is specified by qualified specialists in integration with the D.1 protocol.

**Launch-acceptance proof for the cluster.** A documented device identity and recovery model that spans registration, recovery, and linking. Each component tested end-to-end. Peer-side trust-state transitions (UNVERIFIED / VERIFIED / NEW DEVICE / CHANGED) work consistently across all three entry points to the trust system. No single compromise (email, session, device) can silently take over an identity.

---

## E · Ten non-negotiable launch acceptance conditions

Before any Option 2 implementation is authorised:

1. **Complete cryptographic protocol specification.** D1 + D2 + D20 cluster has produced a full, review-ready specification.
2. **Independent cryptographic review.** Qualified external reviewer has examined the specification and the implementation together.
3. **Documented device identity and recovery model.** D3 + D4 + D5 cluster has produced an integrated specification covering registration, recovery, and linking.
4. **Tested multi-device registration and revocation.** End-to-end tests on real devices demonstrate correct behaviour for all four trust states.
5. **Tested message and attachment deletion lifecycle.** All-devices ACK, TTL, revoked-before-send, revoked-after-send, and missing-key quarantine behaviours all tested with real two-user and multi-device scenarios.
6. **Quarantine ownership and actual alert route.** D11 is resolved; a named owner exists, notifications land, the runbook has been exercised.
7. **Complete legacy transition and export plan.** D13-D19 are resolved; dates are set; the plan has been reviewed by legal counsel.
8. **Qualified legal review.** Consent model, SAR workflow, retention policy, and jurisdictional obligations have all been examined by qualified legal counsel.
9. **Acceptance-test plan covering real two-user and multi-device behaviour.** Not synthetic unit tests only; real humans on real devices across real networks.
10. **Clear disclosure of what NEX can and cannot see, recover, or retain.** User-facing copy, privacy policy, and support documentation accurately describe the architecture.

**None of these conditions is currently met.** This consolidation sets direction only.

---

## F · Overarching principles

These principles are preserved across every founder decision in this document. They are the invariants that no decision may violate.

1. **No permanent server-side message history.**
2. **No hidden plaintext access by NEX or anyone acting on behalf of NEX.**
3. **No automatic plaintext fallback** at the application or protocol level.
4. **Established, independently reviewed protocols only** · no proprietary cryptographic invention.
5. **Silence is not consent.**
6. **Email alone must never transfer cryptographic identity.**
7. **Launch with full forward secrecy**, not a promise to add it later.
8. **Device-local message history is canonical.** The server is not the source of truth for message content.
9. **NEX operates only a temporary encrypted relay.**
10. **All intended recipient devices must ACK** before normal message-group deletion.
11. **Missing keys trigger quarantine, not automatic deletion.**
12. **Quarantine retention requires owner approval**; no automatic time-based purge of quarantined groups.
13. **No automatic historical sync to a newly linked device.** New devices start empty; any future transfer feature is user-controlled and user-authorised.

If any proposed implementation detail appears to conflict with any principle above, the principle wins and the implementation detail must be revised.

---

## G · Gate 1 blockers and unresolved matters

### G.1 · D11 — Gate 1 operational ownership

**Status: NOT APPROVED — unresolved Gate 1 operational ownership.**

Gate 1 is not satisfied by this consolidation. The following operational requirements remain unmet:

1. **Named quarantine rota owner.** No person or team is designated.
2. **Actual notification route and confirmed subscription.** No PagerDuty service, Slack channel, email list, or equivalent is wired up with a confirmed receiver.
3. **Tested operator runbook.** No runbook exists; no exercise has been performed.
4. **Formal review cadence.** No cadence has been scheduled.
5. **Defined quarantine capacity threshold.** No numeric threshold has been set and no storage-growth monitoring exists.
6. **Escalation and accountability arrangements.** No escalation path is documented.

Until all six are resolved, no implementation stage from B4 onwards can be authorised. This blocker is organisational, not technical; Claude cannot invent an owner, infrastructure, or runbook.

### G.2 · Other unresolved matters

**Cryptographic (requires qualified cryptographic review before resolution):**
- Which specific established protocol will be adopted for the D1+D2+D20 cluster.
- Which specific implementation library will be used.
- Multi-device session semantics in the chosen protocol.
- Browser-side state management for the chosen protocol.
- Pre-key infrastructure requirements (if the chosen protocol uses pre-keys).
- Recovery-credential format and derivation (if D4 adopts a pre-provisioned mnemonic).

**Trust-system (requires integrated cryptographic review):**
- Final challenge-response wire format for D3.
- Account-recovery path when all devices are lost (specific mechanism within D4's approved direction).
- QR encoding format and visual-match presentation for D5.
- Push-notification wake-up infrastructure.

**Operational (requires founder decision + ops stakeholder sign-off):**
- D11 Gate 1 (above).
- Final TTL value (D8 provisional).
- Final signed-URL expiry (D9 provisional).
- Final dead-letter thresholds (D10 and D12 placeholders).
- Attachment-purge-queue schema (`nex_message_attachment_purge_queue`).
- Quarantine schema (`nex_message_group_quarantine`).
- Worker-state schema (`nex_worker_state`).
- Audit-log kinds for device-registration events and quarantine-resolution events.

**Legal / privacy (requires qualified legal review):**
- D14 freeze-day timestamp.
- D15 export-window final length.
- D16 notification cadence final definition.
- D17 consent model.
- D18 inactive-user policy.
- D19 SAR fulfilment workflow.
- Jurisdictional variations across NEX's operational regions.
- Retention of consent/non-objection audit log.
- Retention of SAR responses.

**Specification and documentation:**
- Protocol specification (produced by cluster D.1 work).
- Device identity and recovery model (produced by cluster D.2 work).
- Privacy policy update reflecting the twelve honest limitations across the architecture.
- Operator runbook for all workers.
- Acceptance-test plan.

---

## H · Approval boundary

**Founder-approved direction is NOT:**

- Cryptographic certification.
- Legal approval.
- Implementation approval.
- Launch acceptance.
- Permission to touch production, infrastructure, or any live system.

**What founder-approved direction IS:**

- A product direction setting the goals, principles, and constraints.
- A framework within which qualified specialists can produce the detailed specifications.
- A classifier that marks each decision as Approved direction / Provisional / Conditional / Deferred / Not approved.

**Critical integration rule.**

- **D1 + D2 + D20 require independent cryptographic review together.** None of them is independently implementable without the other two.
- **D3 + D4 + D5 require integrated review as one device identity and trust system.** None of them is independently implementable without the other two.

**No forward-secrecy claim may be made** until the actual selected protocol has been independently reviewed and the implementation has passed the required verification.

**No encrypted-messaging claim** may be made beyond what is actually implemented and reviewed at the time the claim is made.

**No "end-to-end encrypted" marketing language** may be used until the architecture has reached Launch acceptance per the ten conditions in Section E.

---

## Verification

- **Output file:** `docs/doctrine/nex-option-2-founder-decisions-consolidated-2026-11-03.md` (this document).
- **All D1-D20 appear in both Section B (status table) and Section C (full record).** Verified during authoring.
- **Two integrated clusters** (D1+D2+D20 and D3+D4+D5) are presented in Section D as integrated decisions, not as isolated items.
- **D11 recorded as Not approved.** Section G.1 preserves the six missing operational requirements prominently.
- **Ten launch-acceptance conditions** preserved in Section E.
- **Thirteen overarching principles** preserved in Section F.
- **Approval boundary** stated unmistakably in Section H.
- **Three source documents unchanged.** This authorisation did not touch them.
- **No code, SQL, database, infrastructure, migration, Git, commit, push, deploy, or environment-variable change occurred.**

Stopping. Awaiting the founder's next explicit authorisation. This document authorises nothing further on its own.
