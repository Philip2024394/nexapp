# NEX Option 2 · Owner Decision Register · 2026-11-03

**Status:** DRAFT register of owner decisions required before Option 2 Architecture Review v2 can be produced.
**Scope:** Step 2 of the owner-authorised two-step design exercise. Companion to `nex-option-2-blocker-resolution-proposals-2026-11-03.md`.

**None of the recommendations in this document are approvals.** Recommendations are Claude's proposed defaults based on the architecture challenge findings and the blocker-resolution proposals. Owner must explicitly decide each one.

---

## Register at a glance

- **Total decisions in this register:** 19 (D1-D19). Correction 2026-11-03 · the earlier "15" figure was carried over from the challenge document and became stale as four decisions were added (D2, D4, D12, D19) and the notification+consent item was split into two (D16 + D17); see `nex-option-2-decision-register-reconciliation-2026-11-03.md` §1 for the full mapping.
- **D20 · Forward secrecy / Double Ratchet** was identified later as a separate security decision and lives in the reconciliation document §2.9 and the founder consolidation (`nex-option-2-founder-decisions-consolidated-2026-11-03.md`). Current total across the Option 2 decision set is 20.
- **Security:** 7 in this register (D1-D7) · 8 counting D20.
- **Operational:** 5 (D8-D12).
- **Legal / Privacy:** 7 (D13-D19).
- **Items counted in multiple categories due to crossover:** 4 (D7, D8, D9, D15).

The categories are advisory; where a decision has implications across categories, this is called out in the "Category" column.

---

## Security decisions (7)

### D1 · Key architecture

| Field | Value |
|---|---|
| **ID** | D1 |
| **Decision** | Device key architecture: dual-key (Ed25519 identity + X25519 encryption) with separate roles · OR · single key for both signing and encryption |
| **Category** | SECURITY |
| **Recommended option** | **Dual-key.** Separate Ed25519 identity (long-term signing) + X25519 encryption (ECDH target). Rotate encryption key independently without breaking peer-side identity trust. |
| **Alternatives** | Single key used for both roles (simpler storage, well-documented cryptographic anti-pattern) |
| **Consequence** | Dual-key: schema delta required (three columns: identity_pub, encryption_pub, encryption_cert replacing single public_key). All existing device-key rows need re-registration or data migration. Single-key: smaller schema, but we cannot later credibly claim best-practice crypto; identity rotation becomes conflated with encryption rotation. |
| **Blocks until decided** | BLOCKER 1 completion · all protocol work · schema design |
| **Depends on** | None |
| **Owner approval required** | YES |

### D2 · Content-key provenance

| Field | Value |
|---|---|
| **ID** | D2 |
| **Decision** | Content key `K_msg` generation + scope + nonce |
| **Category** | SECURITY |
| **Recommended option** | **Fresh 32-byte CSPRNG key per message**, fresh 24-byte CSPRNG nonce per encryption, never reused. `K_att` separate from `K_msg`, fresh per attachment. |
| **Alternatives** | Per-conversation key (requires rotation + ratchet to be safe · adds complexity) · reused key across close-in-time messages (DANGER · nacl.secretbox nonce-reuse breaks confidentiality) |
| **Consequence** | Per-message adds negligible CSPRNG cost · provides strong confidentiality without needing a ratchet. Any other choice requires explicit justification + additional protocol mechanisms. |
| **Blocks until decided** | BLOCKER 1 completion · implementation of per-message encryption |
| **Depends on** | D1 (dual-key architecture naturally pairs with per-message content key) |
| **Owner approval required** | YES |

### D3 · Device registration proof-of-possession mechanism

| Field | Value |
|---|---|
| **ID** | D3 |
| **Decision** | Mechanism for a registering device to prove it controls the claimed private key |
| **Category** | SECURITY |
| **Recommended option** | **Challenge-response:** server issues 32-byte random challenge with 60-second TTL; client signs with identity_priv; server verifies against identity_pub before activating the device-key row. Plus **primary-device confirmation** for all non-first-device registrations. Plus **email + push notification + audit log**. |
| **Alternatives** | Trust the authenticated session alone (REJECTED · a compromised session can register arbitrary keys) · require signed TLS client certificates (infrastructure overhead) · WebAuthn-backed challenge (future-ready but adds complexity now) |
| **Consequence** | Mitigates session-compromise-based silent device registration for subsequent devices. First device remains an unavoidable TOFU moment. Does not fully protect fully-compromised accounts (acknowledged honest limit). |
| **Blocks until decided** | BLOCKER 2 completion · registration endpoint design |
| **Depends on** | D1 (identity key is signer of challenge response) |
| **Owner approval required** | YES |

### D4 · Account recovery when all devices unavailable

> **⚠ SUPERSEDED 2026-11-03.** The "Option Y" recommendation shown in the table below was retracted by `nex-option-2-decision-register-reconciliation-2026-11-03.md` §3. Email-anchored recovery on an E2EE messenger collapses to effectively email-only because WebAuthn credentials are device-bound; a user who has lost all devices has also lost the second factor. Four alternative recovery models (α · strict no-recovery · β · pre-provisioned recovery mnemonic · γ · peer co-signed recovery · δ · hardened email+friction) were proposed in the reconciliation. The founder has since approved in `nex-option-2-founder-decisions-consolidated-2026-11-03.md`: no email-only identity restoration · no server-held private keys · preference for a user-controlled pre-provisioned recovery credential, subject to qualified cryptographic review. The historical table below is retained only for traceability; it is not the current direction.

| Field | Value |
|---|---|
| **ID** | D4 |
| **Decision** | What happens when a user has lost all previously-active devices and wants to add a new one |
| **Category** | SECURITY (also UX) |
| **Recommended option** | ~~**Option Y · soft recovery via identity provider**, with maximum friction. User authenticates via sealed face sign-in + email; new "recovery device" is activated WITHOUT prior-device confirmation; all peers see CHANGED trust-state and must re-verify. No historical plaintext is recovered.~~ **RETRACTED · see superseded note above.** |
| **Alternatives** | **Option X · strict no-recovery** · user must create a new account · preserves cryptographic trust · destroys continuity. **Option Z · encrypted-backup-based recovery** · requires encrypted backup feature from §11 to ship first. (Later analysis added Options α, β, γ, δ · see reconciliation §3.) |
| **Consequence** | ~~Option Y breaks the trust chain for all peer relationships of the recovered account. Peers must re-verify. The user's own IndexedDB starts empty on the new device. If encrypted backups eventually ship, Option Z can replace Option Y for users who had opted into backups.~~ **RETRACTED.** |
| **Blocks until decided** | BLOCKER 2 completion · recovery endpoint design |
| **Depends on** | D1, D3 · sealed face sign-in doctrine 2026-10-23 (verifies feasibility) |
| **Owner approval required** | YES |

### D5 · QR linking signature authority

| Field | Value |
|---|---|
| **ID** | D5 |
| **Decision** | What key signs QR link-tokens and link-confirmations |
| **Category** | SECURITY |
| **Recommended option** | **Primary device's Ed25519 identity private key.** Server never sees the identity_priv. QR payload includes primary_identity_pub so the scanning device can verify. Final confirmation is also signed by primary's identity_priv. |
| **Alternatives** | **Server-provided HMAC key** (REJECTED · server could forge) · **shared account-level signing key** (REJECTED · requires server-mediated distribution, same forgeability issue) · **passphrase-derived key** (REJECTED · NEX uses WebAuthn/face sign-in, no password) |
| **Consequence** | QR linking has genuine cryptographic authenticity. A server-side substitution attack fails because the server lacks the identity_priv. The visual-match short code provides an additional out-of-band check that catches server-side payload substitution before confirmation. |
| **Blocks until decided** | BLOCKER 3 completion · QR UX and linking endpoints |
| **Depends on** | D1 (dual-key architecture needed for identity_priv to exist) |
| **Owner approval required** | YES |

### D6 · New-device historical sync policy

| Field | Value |
|---|---|
| **ID** | D6 |
| **Decision** | Does a newly-linked secondary device receive the account's historical messages? |
| **Category** | SECURITY (also UX) |
| **Recommended option** | **No automatic sync (Signal model).** The secondary device starts with an empty IndexedDB. New messages from link time forward are visible on it. The user is clearly told this at link time: "This device will see new messages from here on. It will not see messages from before it was linked." |
| **Alternatives** | **Primary-assisted sync** · primary device re-encrypts recent history to the new device's encryption_pub + uploads · increases complexity; may re-leak content to a compromised new device · requires explicit scope boundary (last N days? last M messages?). **Server-mediated sync** · impossible under Option 2 (server cannot decrypt). |
| **Consequence** | Signal-model is the simpler, more conservative choice. Users with multi-device needs must either link devices up-front OR export + re-import on new devices. Primary-assisted sync could be added as a future stage without breaking the current architecture. |
| **Blocks until decided** | BLOCKER 3 completion · linking UX copy |
| **Depends on** | D5 |
| **Owner approval required** | YES |

### D7 · "Delivered" semantics and read-receipt layer

| Field | Value |
|---|---|
| **ID** | D7 |
| **Decision** | How to communicate the difference between "server has ACK from recipient device" and "user has read the message" |
| **Category** | SECURITY (crypto implications) + OPERATIONAL (UX) |
| **Recommended option** | **UI copy change only · no new read-receipt layer.** The sender's indicator reads "Delivered" and tooltips/help explain it means "arrived at all recipient devices" rather than "read". No separate read-receipt event is sent (which would be a new ciphertext type and additional cost). |
| **Alternatives** | **Add read-receipt layer** · recipient device sends an encrypted "read" event back to the sender when the user actively opens the message · doubles the metadata volume · requires separate ciphertext type · creates privacy signalling (user may not want sender to know they've read). |
| **Consequence** | UI-only approach is cheap and consistent with Option 2's minimalism. Read receipts can be added as a future opt-in feature without architectural disruption. |
| **Blocks until decided** | BLOCKER 1 completion is not blocked · but UI copy work during Option 2 ship is blocked |
| **Depends on** | None |
| **Owner approval required** | YES |

---

## Operational decisions (5)

### D8 · TTL value for undelivered messages

| Field | Value |
|---|---|
| **ID** | D8 |
| **Decision** | How many days before an undelivered message row expires |
| **Category** | OPERATIONAL (storage + relay semantics) + SECURITY (bounds relay retention) |
| **Recommended option** | **7 days (per current draft proposal).** Balances delivery to intermittent devices against bounded relay retention. |
| **Alternatives** | Shorter (3 days) · reduces storage, raises risk of lost messages for infrequent users · Longer (30 days) · higher cost, longer attack surface for compromised keys |
| **Consequence** | 7 days means a device offline for a week loses that week's messages. Users with multi-device setups accept this. Shorter would hurt UX; longer would increase storage cost and the window during which a compromised key still decrypts in-flight messages. |
| **Blocks until decided** | B5 implementation · migration drafting cannot pick a value |
| **Depends on** | None |
| **Owner approval required** | YES |

### D9 · Signed URL expiry duration

| Field | Value |
|---|---|
| **ID** | D9 |
| **Decision** | How long an attachment-download signed URL remains valid |
| **Category** | OPERATIONAL + SECURITY |
| **Recommended option** | **60 seconds.** Short enough that an intercepted URL cannot usefully be replayed. Long enough that a mobile client on a flaky connection can complete the download; if it fails, the client re-requests a fresh signed URL. |
| **Alternatives** | 10 seconds · too tight for mobile · 300 seconds · unnecessarily broad |
| **Consequence** | 60s balances security and UX. Client logic must handle URL-expired case by re-requesting (not an error state). |
| **Blocks until decided** | B2 implementation · bucket signing endpoint |
| **Depends on** | None |
| **Owner approval required** | YES |

### D10 · Dead-letter SLA for attachment purge queue

| Field | Value |
|---|---|
| **ID** | D10 |
| **Decision** | How often operator reviews dead-letter rows + what the escalation threshold is |
| **Category** | OPERATIONAL |
| **Recommended option** | **Weekly review** with escalation if `dead_lettered_at` oldest row is more than 14 days old OR dead-letter count exceeds 50. Operator either manually reconciles orphan Storage objects or re-queues after fixing underlying cause. |
| **Alternatives** | Monthly · lets orphans grow longer · Daily · over-indexes an edge case |
| **Consequence** | Weekly review catches issues before orphan Storage accumulates meaningfully. 14-day/50-row thresholds are starting points · adjust based on actual signal. |
| **Blocks until decided** | B5 implementation · operator runbook |
| **Depends on** | D15 (Gate 1 operational ownership) |
| **Owner approval required** | YES |

### D11 · Gate 1 operational ownership

| Field | Value |
|---|---|
| **ID** | D11 |
| **Decision** | Named quarantine rota owner + notification route + runbook + review cadence + capacity threshold |
| **Category** | OPERATIONAL |
| **Recommended option** | **No recommendation on specific person.** The decision is organisational. Claude cannot invent an owner, notification channel, or runbook. Recommended thresholds: review cadence daily, capacity threshold "quarantine backlog > 100 unreviewed OR oldest > 72h" paging. |
| **Alternatives** | — |
| **Consequence** | Without Gate 1, no stage from B4 onwards can be authorised. This is a hard blocker on the whole implementation sequence, not just the architecture. |
| **Blocks until decided** | B4 and all later stages |
| **Depends on** | None (independent organisational decision) |
| **Owner approval required** | YES |

### D12 · 403 circuit-trip thresholds

| Field | Value |
|---|---|
| **ID** | D12 |
| **Decision** | Thresholds for pausing the attachment-purge worker on 403 responses |
| **Category** | OPERATIONAL + SECURITY (bounds dead-lettering risk) |
| **Recommended option** | **3 distinct-key 403s within 60 seconds trigger WORKER PAUSE + PAGE OPS.** A single row's 403 counter dead-letters only after 3 total 403s against the same row across its lifetime. |
| **Alternatives** | More aggressive (1 403 pauses) · may trigger on genuine object-anomaly · Less aggressive (10 403s / 5 minutes) · lets a global failure dead-letter dozens of rows before detection |
| **Consequence** | 3-in-60s with distinct-key requirement is a well-calibrated circuit under Supabase's bucket-level ACL model. Thresholds may need tuning based on observed behaviour. |
| **Blocks until decided** | B5 implementation · purge-worker design |
| **Depends on** | D11 (operator must receive the page) |
| **Owner approval required** | YES |

---

## Legal / Privacy decisions (7)

### D13 · Dual-write duration (N_B)

| Field | Value |
|---|---|
| **ID** | D13 |
| **Decision** | How many days dual-write runs between B1 authorisation and T_freeze |
| **Category** | LEGAL/PRIVACY + OPERATIONAL |
| **Recommended option** | **30-60 days.** Enough time for all currently-active users to be exposed to the encrypted path, verify encrypted reads work, and export if desired. |
| **Alternatives** | 14 days · too tight for infrequent users to log in during the window · 90+ days · unnecessary cost, extends dual-storage period |
| **Consequence** | Longer dual-write = more storage cost + longer plaintext-on-server surface. Shorter = more users miss the transition and lose history. |
| **Blocks until decided** | B1 authorisation |
| **Depends on** | D14 (determines T_freeze - N_B start) |
| **Owner approval required** | YES |

### D14 · T_freeze (absolute freeze timestamp)

| Field | Value |
|---|---|
| **ID** | D14 |
| **Decision** | The absolute instant at which plaintext-write stops |
| **Category** | LEGAL/PRIVACY |
| **Recommended option** | **No specific date recommended.** The owner selects based on business readiness. However: freeze must come at least 30 days (D16) after the first user notification, and the dual-write infrastructure must have been live for the full N_B period (D13). |
| **Alternatives** | — |
| **Consequence** | Setting T_freeze defines all other transition timestamps relative to it. T_freeze MUST be an absolute timestamp, not a conditional one, so dual-write cannot run indefinitely. |
| **Blocks until decided** | B1 authorisation · all transition work |
| **Depends on** | D13, D16 (notification lead time) |
| **Owner approval required** | YES |

### D15 · Export window length (N_D)

| Field | Value |
|---|---|
| **ID** | D15 |
| **Decision** | How many days after T_freeze the legacy export endpoint remains open |
| **Category** | LEGAL/PRIVACY (GDPR interaction) + OPERATIONAL |
| **Recommended option** | **≥90 days.** Covers GDPR Art 12 statutory 30-day SAR response window + buffer for retries + buffer for users with infrequent app usage patterns. |
| **Alternatives** | 30 days · insufficient for GDPR response guarantee · 180 days · overshoots meaningfully |
| **Consequence** | Export window below 90 days creates GDPR risk if a SAR is filed mid-window. Above 90 days extends plaintext-reachable period. Owner may extend based on legal advice. |
| **Blocks until decided** | B1 authorisation · export endpoint deployment |
| **Depends on** | D14 (T_freeze) · legal review |
| **Owner approval required** | YES · **AND legal review required** |

### D16 · User notification lead time (N_A)

| Field | Value |
|---|---|
| **ID** | D16 |
| **Decision** | How many days before T_freeze the first user notification is sent |
| **Category** | LEGAL/PRIVACY |
| **Recommended option** | **≥30 days.** Allows all active users at least one app-open and one weekly cycle. Reminders at T_freeze - 14, T_freeze - 7, T_freeze - 1. |
| **Alternatives** | 7 days · insufficient for monthly-active users · 60+ days · may dilute message urgency |
| **Consequence** | Users who don't open the app during this window may miss notification; this is addressed under D18 (users-who-don't-return). |
| **Blocks until decided** | B1 authorisation · notification campaign setup |
| **Depends on** | D14 |
| **Owner approval required** | YES |

### D17 · Consent model

| Field | Value |
|---|---|
| **ID** | D17 |
| **Decision** | How user consent for the processing change is captured |
| **Category** | LEGAL/PRIVACY |
| **Recommended option** | **Option (b) · informed non-objection.** Users notified via all channels; silence = continuation; users may opt out by exporting + deleting their account. **Requires legal review before publication.** |
| **Alternatives** | **(a) Explicit opt-in** · users must click "I understand" before T_freeze · highest defensibility, worst UX · **(c) Fresh ToS acceptance** · users must accept updated ToS at next login · moderate friction |
| **Consequence** | (b) relies on GDPR interpretation that reducing processed data (plaintext → ciphertext) does not require fresh consent under Art 7 and that transparency obligations under Art 12-14 are met by the notification cadence (D16). Legal review may conclude (c) is safer; (a) is almost certainly unnecessary unless the law of a specific jurisdiction demands it. |
| **Blocks until decided** | B1 authorisation · consent-flow design (if any) |
| **Depends on** | D16 |
| **Owner approval required** | YES · **AND legal review required** |

### D18 · Users-who-do-not-return policy

| Field | Value |
|---|---|
| **ID** | D18 |
| **Decision** | What happens to legacy data of users who never log in during the export window |
| **Category** | LEGAL/PRIVACY |
| **Recommended option** | **Option (aa) · purge regardless.** Legacy plaintext is removed at T_purge_complete for all users, including those who never returned. Consistent with principle 6 (no permanent server-side chat history). |
| **Alternatives** | **(bb) Preserve plaintext for inactive accounts** · violates principle 6 · **(cc) Delete inactive accounts entirely** · aligned with GDPR data-minimisation but destroys identity; may be adopted as a separate longer-term policy |
| **Consequence** | (aa) means some users lose history without knowing. Notification cadence (D16) is the only guard. Documented transparently in notifications and privacy policy. |
| **Blocks until decided** | B1 authorisation · final purge policy |
| **Depends on** | D16, D17 |
| **Owner approval required** | YES · **AND legal review required** |

### D19 · GDPR SAR interaction at T_export_close

| Field | Value |
|---|---|
| **ID** | D19 |
| **Decision** | How pending GDPR Subject Access Requests at T_export_close are honoured |
| **Category** | LEGAL/PRIVACY |
| **Recommended option** | **Honour via normal SAR process · not via `/export-chat-history`.** Pending SAR requests at T_export_close are escalated to manual legal processing; the user receives the data they're legally entitled to, including any legacy plaintext that's still in the system between T_export_close and T_purge_complete. |
| **Alternatives** | Treat `/export-chat-history` as the full SAR mechanism (REJECTED · export is a convenience, SAR is a legal obligation and may need to cover more than chat body) |
| **Consequence** | Manual process requires operator capacity. If SAR volume at close is high, operator throughput becomes the limit. Historical records of SAR fulfilment are themselves subject to retention policy (part of L4 from BLOCKER 6 legal review). |
| **Blocks until decided** | B1 authorisation + SAR handoff design |
| **Depends on** | D15, D17 |
| **Owner approval required** | YES · **AND legal review required** |

---

## Decisions that span multiple categories

Decisions D7, D8, D9, and D15 appear in multiple categories due to their crossover nature. The register places each decision in its primary category and marks the crossover in the Category column. No duplication.

---

## Dependencies between decisions

Visualised:

```
D1 (dual-key) ──→ D2 (per-message key)
   │
   ├──→ D3 (PoP mechanism)
   │       │
   │       └──→ D4 (account recovery)
   │
   └──→ D5 (QR linking authority)
           │
           └──→ D6 (new-device sync)

D7 (delivered ≠ read) ─── independent

D8 (TTL) ─── independent (bounded by principle 2)
D9 (signed URL expiry) ─── independent

D11 (Gate 1) ──→ D10 (dead-letter SLA)
              └──→ D12 (403 thresholds)

D14 (T_freeze) ──→ D13 (dual-write duration)
              ├──→ D15 (export window)
              └──→ D16 (notification lead time)

D16 ──→ D17 (consent model)
    └──→ D18 (users-who-don't-return)

D15 ──→ D19 (GDPR SAR interaction)
D17 ──→ D18
```

### Suggested decision order (owner-driven)

1. **D1 (key architecture)** → unblocks D2, D3, D4, D5, D6.
2. **D2** → follows D1 naturally.
3. **D3** → unblocks D4.
4. **D4** → ties to D3.
5. **D5** → unblocks D6.
6. **D6** → ties to D5.
7. **D7** → independent; decide any time.
8. **D8, D9** → independent; decide any time.
9. **D11 (Gate 1)** → organisational; parallel-track; owner-driven; may be slow.
10. **D10, D12** → wait on D11.
11. **D14 (T_freeze)** → unblocks all transition decisions.
12. **D13, D15, D16** → fall out of D14.
13. **D17** → requires legal review.
14. **D18** → ties to D17.
15. **D19** → requires legal review.

Owner's stated preference (per prior turn): **resolve cryptographic protocol and device trust first.** That maps to D1 → D2 → D3 → D4 → D5 → D6 before anything else. This register preserves that ordering as the recommended path.

---

## Decisions requiring specialist review

| Decision | Review required |
|---|---|
| D1 | Qualified cryptographic review once drafted protocol is complete |
| D2 | Qualified cryptographic review (correctness + replay protection) |
| D3 | Qualified cryptographic review (session-compromise + PoP interaction) |
| D4 | Qualified cryptographic + legal review (identity-provider interaction, trust chain breakage disclosure) |
| D5 | Qualified cryptographic review (QR + identity-key signing authority) |
| D15 | Qualified legal review (GDPR SAR window) |
| D17 | Qualified legal review (GDPR Art 7 consent interpretation; jurisdiction-specific) |
| D18 | Qualified legal review (data-minimisation + storage-limitation balance) |
| D19 | Qualified legal review (SAR fulfilment obligations) |

Items marked for cryptographic review should be verified against a Dolev-Yao adversary model and standard best-practices (e.g., Signal Technical Documentation, Noise Protocol Framework specifications).

Items marked for legal review should be examined under GDPR (as a baseline) plus any jurisdiction-specific regulations in NEX's operational regions (Ireland, Indonesia, others per sealed scope).

---

## What cannot proceed until each decision is made

| Decision | Blocks |
|---|---|
| D1 | All cryptographic protocol work · schema design for `nex_account_device_key` revision |
| D2 | Per-message encryption implementation |
| D3 | Registration endpoint design · device-key provisioning |
| D4 | Account-recovery endpoint design · peer re-verification signalling |
| D5 | QR linking endpoints · QR UI |
| D6 | Linking UX copy |
| D7 | UI copy work (minor); no architectural dependency |
| D8 | B5 cleanup worker TTL enforcement |
| D9 | B2 private-bucket signing endpoint |
| D10 | B5 dead-letter dashboard + runbook |
| D11 | **B4 and all subsequent stages** |
| D12 | B5 purge-worker 403 circuit |
| D13 | B1 authorisation · dual-write operational setup |
| D14 | B1 authorisation · all transition timings |
| D15 | B1 authorisation · export endpoint deployment · legal readiness |
| D16 | Notification campaign setup |
| D17 | Consent-flow design · legal readiness |
| D18 | Final purge policy · privacy policy copy |
| D19 | SAR handoff workflow |

---

## Confirmation

No implementation performed. No code modified. No SQL executed. No database or infrastructure touched. No migrations drafted or applied. No commit, push, or deployment. One new file created: this document.

Companion document (produced in the same authorisation): `docs/doctrine/nex-option-2-blocker-resolution-proposals-2026-11-03.md`.

**Stopping. Awaiting owner review and explicit decisions on this register before any further action. Recommendations in this document are NOT approvals; the owner must explicitly decide each entry.**
