# NEX Option 2 · Decision Register Reconciliation + Security Check · 2026-11-03

**Status:** DRAFT · design-only follow-up to Steps 1 and 2.
**Authorisation scope:** Reconcile the decision count discrepancy and critically re-examine three security claims that may have been overstated or under-specified in the two prior documents.
**Companion documents (not modified by this review):**
- `nex-option-2-blocker-resolution-proposals-2026-11-03.md`
- `nex-option-2-owner-decision-register-2026-11-03.md`

**Restrictions observed:** No implementation. No code modified. No SQL executed. No database access. No migrations. No infrastructure or production. No commit, push, or deployment. No modification of the two existing documents. No owner decisions made. One new file created: this document.

---

## 1 · Decision count reconciliation

### 1.1 · The discrepancy

The register's header says "Total decisions: 15". Its body contains decision IDs **D1 through D19 inclusive**. The owner is correct: these numbers do not reconcile. The "15" figure was carried over from the challenge document (§12) without updating when new decisions were added during register production.

### 1.2 · Mapping from challenge-document decisions to register IDs

The challenge document §12 listed 15 numbered decisions. Here is the precise mapping:

| Challenge § item | Register ID | Status |
|---|---|---|
| 1. Single-key vs dual-key | **D1** | 1 → 1 |
| 2. Proof-of-possession mechanism | **D3** | 1 → 1 |
| 3. QR linking HMAC key origin | **D5** | 1 → 1 |
| 4. New-device historical sync | **D6** | 1 → 1 |
| 5. "Delivered" ≠ "read" | **D7** | 1 → 1 |
| 6. Dual-write duration | **D13** | 1 → 1 |
| 7. Freeze day (T_freeze) | **D14** | 1 → 1 |
| 8. Export availability window | **D15** | 1 → 1 |
| 9. Public-bucket read-only window | **merged into D15** | 1 → 0 (merged) |
| 10. User notification + consent | **split into D16 + D17** | 1 → 2 (split) |
| 11. Users-who-don't-return policy | **D18** | 1 → 1 |
| 12. TTL value | **D8** | 1 → 1 |
| 13. Signed URL expiry | **D9** | 1 → 1 |
| 14. Dead-letter SLA | **D10** | 1 → 1 |
| 15. Gate 1 (owner + route + runbook + cadence + capacity) | **D11** | 1 → 1 |

### 1.3 · Decisions added by the register that were NOT in the original 15

| New ID | Decision | Source | Rationale |
|---|---|---|---|
| **D2** | Content-key provenance (fresh-per-message CSPRNG, nonce discipline, K_att separation) | BLOCKER 1 analysis | Original challenge named "cryptographic protocol" at a high level but did not isolate content-key policy as a separately-decidable item. The register made it explicit because content-key choice drives nonce-reuse safety independently of the dual-key architecture (D1). |
| **D4** | Account recovery when all devices unavailable | BLOCKER 2 analysis | Original challenge named "proof-of-possession" but did not treat the "all devices lost" edge case. The register exposed it. (See §3 below for critical re-examination.) |
| **D12** | 403 circuit-trip thresholds | BLOCKER 4 analysis | Original challenge named "403 handling" at a high level but did not isolate the threshold tuning as a separately-decidable item. |
| **D19** | GDPR SAR interaction at T_export_close | BLOCKER 5/6 analysis | Mentioned narratively in the challenge but not pulled out as a standalone decision. |

### 1.4 · Mathematics

- Original 15 challenge topics.
- `−1` for the public-bucket/export merger (§1.2 row 9).
- `+1` for the notification+consent split (§1.2 row 10).
- `+4` for the four register-added items (§1.3).
- **Total: 15 − 1 + 1 + 4 = 19.**

The 19 figure is accurate. The 15 figure at the top of the register is stale and must be corrected.

### 1.5 · Are any decisions duplicates or overlapping?

Walking the full register for duplicates / overlaps:

| Pair | Overlap? |
|---|---|
| D1 (dual-key) and D2 (content-key provenance) | **Related but distinct.** D1 is about long-term device keys. D2 is about per-message symmetric keys. Separate decisions. |
| D1 and D5 (QR authority) | **D5 depends on D1** but is a separate decision about which key signs link-tokens. Not a duplicate. |
| D3 (PoP) and D4 (account recovery) | **Different scopes.** D3 is normal-case registration. D4 is the all-devices-lost edge. Not a duplicate but see §3 below. |
| D13 (dual-write duration), D14 (T_freeze), D15 (export window), D16 (notification lead time) | **All transition timings.** They are related but each is a distinct value. Not duplicates. |
| D17 (consent model) and D18 (users-who-don't-return) | **Related but distinct.** D17 is about active users; D18 is about inactive users. |
| D15 (export window) alone | **Open question raised by this review:** should legacy read-only period and public-bucket read-only period really be the same value? The merger in §1.2 row 9 is a design judgement, not a necessity. The owner may choose to separate them. |

### 1.6 · Recommended register structure

**Recommendation: keep 19 decisions. Fix the "15" number in the header.**

Rationale:
- Each of the 19 represents a genuinely separate choice.
- Merging any pair would hide a decision rather than resolve it.
- The owner should know they are approving 19 items, not 15.

**Additional recommendation: owner may choose to split D15 into D15a (export window) + D15b (public-bucket read-only window) if operational reality calls for different values.** The current register merges them for simplicity but this is reversible without architectural impact.

**Clean counts after fix:**

| Category | Count |
|---|---|
| Security | 7 (D1, D2, D3, D4, D5, D6, D7) |
| Operational | 5 (D8, D9, D10, D11, D12) |
| Legal / Privacy | 7 (D13, D14, D15, D16, D17, D18, D19) |
| **Total unique IDs** | **19** |

Zero crossover-only decisions; four decisions have crossover notes (D7, D8, D9, D15) because they have implications in multiple categories, but each is counted once in its primary category.

**Proposed amendment to the register (not applied in this document):** change the "Total decisions: 15" header to "Total decisions: 19" with the breakdown above. No other register content requires changing for the count issue alone.

---

## 2 · Forward secrecy · critical re-examination

### 2.1 · What I claimed in BLOCKER 1

In `nex-option-2-blocker-resolution-proposals-2026-11-03.md` under BLOCKER 1, I wrote:

> Note on ephemeral keys: because `ephem_priv_D` is deleted immediately after wrap, retroactive compromise of the sender's long-term keys does NOT allow re-derivation of K_msg from `(wrapped_K_msg_D, ephem_pub_D)`. This gives **one-sided forward secrecy on the sender side**. The recipient side has no FS until Double Ratchet lands (deferred).

**This claim overstates the security guarantee.** On close examination, the "one-sided forward secrecy" is not providing meaningful forward secrecy of ANY kind. The following re-analysis supersedes that paragraph.

### 2.2 · How the wrap actually works

```
wrapped_K_msg = libsodium.crypto_box_easy(K_msg, wrap_nonce, recipient_encryption_pub, sender_ephemeral_priv)
```

This computes:
```
shared_secret = X25519(sender_ephemeral_priv, recipient_encryption_pub)
                       which is equal to
                X25519(sender_ephemeral_pub,  recipient_encryption_priv)
```

Then uses `shared_secret` as the symmetric key for XSalsa20-Poly1305 to encrypt `K_msg`.

The server stores: `(wrapped_K_msg, wrap_nonce, sender_ephemeral_pub)` plus the normal `recipient_encryption_pub` is public anyway (in `nex_account_device_key`).

### 2.3 · Scenario A · recipient's long-term encryption_priv is compromised later

Attacker at time T has: `recipient_encryption_priv` + access to stored server rows.

Attacker performs:
```
shared_secret = X25519(sender_ephemeral_pub, recipient_encryption_priv)
K_msg = XSalsa20-Poly1305-decrypt(wrapped_K_msg, wrap_nonce, shared_secret)
plaintext = secretbox-open(ciphertext_body, body_nonce, K_msg)
```

**Result:** attacker decrypts every message ever encrypted to `recipient_encryption_pub` and whose server-side ciphertext is still available or was intercepted/exfiltrated earlier. **ALL past messages decryptable. NO forward secrecy against recipient-key compromise.**

### 2.4 · Scenario B · sender's device is compromised later

Attacker at time T has: sender's `identity_priv` + sender's `encryption_priv` + any data stored on sender's device.

Sender's device stores plaintext in IndexedDB (device-local history, Bridge 77 sealed). Attacker reads plaintext directly from IndexedDB without any crypto work. The ephemeral keys the sender used for past messages were deleted; the attacker cannot recover them.

For messages the sender sent that are NO LONGER in sender's IndexedDB (purged by quota eviction or similar):
- Server-side storage contains ciphertext encrypted to the RECIPIENT's `encryption_pub`.
- Sender's `encryption_priv` does NOT help decrypt this (it's not the ECDH counterpart).
- Sender's `identity_priv` does NOT help decrypt either (it only signs).
- Attacker gains the ability to IMPERSONATE the sender for future messages until revocation.

**Result:** sender compromise lets the attacker read what's still in sender's IndexedDB, impersonate for future, but cannot decrypt stored server-side ciphertext of past messages beyond what sender's own device already decrypted.

### 2.5 · Scenario C · ephemeral key deletion · what does it actually buy?

The ephemeral private is used ONCE at wrap time and deleted. The only way an attacker could ever need `sender_ephemeral_priv` for decryption is if the attacker had `sender_ephemeral_pub` + `wrapped_K_msg` but NOT `recipient_encryption_priv`. But the attacker **ALWAYS** has an alternative path: compromise `recipient_encryption_priv` and run the DH from the recipient side.

So deleting `sender_ephemeral_priv` prevents a redundant path, not a unique one. The guarantee it provides against sender-side compromise is **vacuous**: the attacker who has sender's state can read plaintext from sender's IndexedDB directly; they don't need to re-derive K_msg from the ephemeral key.

**Conclusion: the current protocol provides NO meaningful forward secrecy. The "one-sided forward secrecy on sender side" claim is misleading and must be retracted.**

### 2.6 · Corrected statement

Replace the paragraph in BLOCKER 1 (§2.1 above) with:

> **Forward secrecy status.** The current protocol does NOT provide forward secrecy. If a recipient device's long-term `encryption_priv` is compromised at any future time, every past message ever encrypted to that key can be decrypted by the attacker, assuming the attacker has retained or can obtain the server-side ciphertext. Deletion of the sender's ephemeral X25519 private after wrap does NOT provide a forward-secrecy guarantee, because the recipient's long-term private key is a sufficient decryption authority on its own.
>
> Post-compromise security is also NOT provided. Once a device's `encryption_priv` is compromised, the attacker reads everything sent to that key until the user revokes the device.
>
> True forward secrecy requires a key-ratcheting construction (e.g., Double Ratchet as in Signal) where per-message keys are derived from a chain that advances with each exchange and keys are deleted after use.

### 2.7 · Should Double Ratchet be included now vs deferred?

**Trade-off analysis.**

**Including Double Ratchet now:**

Pros:
- Genuine forward secrecy + post-compromise security.
- Parity with industry-standard E2EE messengers (Signal, WhatsApp, iMessage).
- A compromise event is bounded in time, not retroactive.
- Avoids the architectural lie of "end-to-end encrypted" without FS.

Cons:
- Significant protocol complexity.
- Client-side state management for ratchet chains per peer-device pair.
- Out-of-order message handling (ratchet skip-keys).
- Pre-key infrastructure (one-time pre-keys per device · server-mediated distribution with careful trust-boundary handling).
- Testing surface grows substantially.
- Multi-device semantics are not "free" with Double Ratchet · we still fan out one row per recipient device, each with its own ratchet.
- Development cost · estimated multi-week dedicated protocol engineering + external cryptographic review.

**Deferring Double Ratchet:**

Pros:
- Simpler initial ship.
- Can be added as Option 2.1 later if the protocol is designed with the future in mind (ciphertext envelope has version field, wrap format can be extended).

Cons:
- The initial ship is "encrypted but NOT forward-secret". Marketing-level E2EE claims become more fragile; the privacy policy must explicitly disclose the absence.
- Users who face long-horizon key-compromise threats (nation-state, large-scale exfiltration) get no protection.
- Switching to Double Ratchet later requires either a cutover (break history) or a complex dual-mode transition.

### 2.8 · Honest recommendation on Double Ratchet

**Recommendation: this is an owner decision. I cannot make it.**

Factors the owner should weigh:
- NEX's user base threat model. If users include people who face sustained adversaries (journalists, dissidents, political targets), FS is non-negotiable. If users are mostly consumers, deferral is defensible if transparently disclosed.
- Development runway. Double Ratchet adds significant engineering + review cost.
- Marketing position. "End-to-end encrypted" without FS is legally defensible but reputationally fragile if a knowledgeable critic surfaces the gap.

**Proposed amendment to BLOCKER 1:** replace the forward-secrecy paragraph with the corrected text in §2.6 above. Add a NEW owner decision to the register:

### 2.9 · New decision proposed · D20 · Forward secrecy / Double Ratchet

| Field | Value |
|---|---|
| **ID** | **D20** (new, previously undetected) |
| **Decision** | Include Double Ratchet now vs defer to future stage |
| **Category** | SECURITY |
| **Recommended option** | **No neutral default.** Owner-decision based on threat model + runway. |
| **Alternatives** | Include now (full FS + PCS; high cost) · Defer (ship without FS; explicitly disclose in privacy policy; design envelope with future-extension headroom) |
| **Consequence** | Including now: 2-3 months additional protocol engineering + review before any ship; delays all stages. Deferring: ship on current protocol timeline; privacy policy must honestly disclose "end-to-end encrypted but not forward-secret"; later migration requires dual-mode handling. |
| **Blocks until decided** | All further Option 2 work. This is the most foundational security decision outstanding. |
| **Depends on** | None |
| **Owner approval required** | YES · **AND qualified cryptographic review required to validate choice of ratchet variant** |

**The register count rises to 20 if D20 is accepted as a distinct decision.** Currently D20 is implicit in D1 ("key architecture") but D1 as written assumes nacl.secretbox per-message without ratcheting. If the owner chooses Double Ratchet, D1 itself must be revised.

---

## 3 · Account recovery · critical re-examination

### 3.1 · What I claimed in BLOCKER 2

The register's D4 recommended **Option Y · soft recovery via identity provider**, framed as:

> User authenticates via NEX's sealed face sign-in (WebAuthn 2026-10-23) + email. A "recovery device" is registered WITHOUT a confirmation from a prior device.

**This is insufficient. The following threat analysis shows why.**

### 3.2 · Threat scenarios

**Threat A · Compromised email account**

- Attacker controls the email address on the NEX account (via phishing, credential stuffing, provider compromise, SIM swap on the email provider's SMS 2FA, etc.).
- Attacker visits NEX, initiates "lost all devices" flow.
- Flow requires: email verification + face sign-in via WebAuthn.
- **Critical observation:** WebAuthn credentials are **device-bound**. If the user has lost all their devices, their WebAuthn credentials are also gone. The sealed face sign-in flow (2026-10-23) cannot authenticate the legitimate user who has lost everything.
- Therefore, the "face sign-in" factor must either be omitted from the recovery path OR replaced with something else · which weakens the authentication to EMAIL ONLY.
- Email-only means: attacker who controls email takes over the NEX account.

**Threat B · Stolen authenticated session**

- Attacker has a current valid session cookie (XSS, token theft from a stolen laptop, etc.).
- Attacker triggers "lost all devices" from within the session.
- If recovery requires only the session + email confirmation, and the attacker also controls the email: trivial.
- Even if the attacker does NOT control the email: a 72-hour-delay model gives the attacker time to intercept the cancellation email (phishing the user into clicking the wrong link).

**Threat C · SIM swap**

- Attacker SIM-swaps the victim's phone number.
- If NEX's recovery or any email-recovery flow uses SMS 2FA, attacker intercepts.
- Transitively, SIM swap → email takeover → NEX takeover.
- NEX cannot defend against SIM swap directly; it inherits the vulnerability from the email provider.

**Threat D · Attacker registers a new device**

- Via Option Y: email + session (potentially both compromised) → recovery device activated → attacker now controls the NEX identity.
- Via normal PoP (with existing devices): primary-device confirmation blocks → attacker rejected.
- **Option Y is therefore the attack vector; normal registration is protected.**

**Threat E · Legitimate owner loses every device**

- Legitimate use case the recovery flow is built for.
- Without pre-provisioning something at signup, there is no cryptographic authority to prove ownership.
- Email + face-sign-in-via-WebAuthn (impossible if devices lost) collapses to email alone.
- **No current mechanism distinguishes legitimate recovery from Threat A.**

**Threat F · Peer re-verification failures**

- After Option Y, every peer should see a trust-state transition.
- Current proposal said peers see CHANGED. On re-examination: CHANGED means "same device_id, different public key". A recovery device is a NEW device_id (never seen before). So peers would see **NEW DEVICE**, not CHANGED.
- NEW DEVICE's UI treatment is a blue in-chat notice (lower urgency than CHANGED's amber warning).
- Many users will not re-verify. They will continue chatting at **UNVERIFIED** trust state with the attacker.
- The attacker's successful takeover is quietly tolerable to most peers.

### 3.3 · Honest verdict on Option Y

**Option Y as proposed is insufficient.** Email compromise + possible session compromise + the WebAuthn dependency failing (because devices are lost) means recovery collapses to effectively email-only. Email-only is not a strong enough authority to transfer identity ownership on an E2EE messenger.

### 3.4 · Alternative recovery models

Four options the owner should consider; **none is obviously correct · the choice reflects a trade-off between usability and security**:

#### Option α · No recovery (strict Signal model)

- Lost all devices without exporting = lost account.
- User creates a new account.
- Peers manually re-add the new account (new account_id, new identity).
- No recovery flow exists.

Properties:
- Maximum security: identity cannot be stolen without compromising the user's own device.
- Minimum usability: identity-level data loss is unforgiving.

#### Option β · Pre-provisioned recovery mnemonic

- At signup, NEX shows the user a 24-word BIP39-style mnemonic derived from the account's root recovery secret.
- User writes it down (NEX insists on confirmation that they have recorded it).
- The mnemonic deterministically derives a recovery-signing key independent of any device.
- To recover: user enters mnemonic → derives recovery-signing key → signs a device-registration ceremony for a new device.
- Peer trust: new device appears as NEW DEVICE but can produce a signed "recovery event" attestation that peers' clients recognise.

Properties:
- Security: an attacker who doesn't have the mnemonic cannot recover.
- Usability: user responsibility to safeguard the mnemonic (paper, password manager, bank safe · industry-standard for cryptocurrency wallets).
- Tradeoff: if the user loses the mnemonic AND all devices, no recovery.
- **This is Signal-equivalent** when combined with Signal's "linked device" model.

#### Option γ · Peer co-signed recovery

- At signup (or any time later), user designates N trusted peers (e.g., 3-5).
- To recover, K of N peers (e.g., 2 of 3) must co-sign a recovery event from their own devices.
- Attack requires compromising K peer accounts simultaneously.
- No long-lived secret for the user to manage.

Properties:
- Security: resistance scales with K; multi-peer compromise is unlikely for most users.
- Usability: requires peers to be reachable at recovery time; may fail if peers are also offline.
- Social cost: user must choose trusted peers; relationship implications.
- Novel in production; most E2EE messengers don't offer this.

#### Option δ · Email + significant friction (current Option Y, hardened)

- Email verification plus:
  - 72-hour delay with daily email notifications containing a CANCEL link.
  - Cancellation can be triggered by: any email in the account's email history, any peer tapping "This looks wrong" on their trust-state notification, operator review on flag.
  - Mandatory peer notification via special-category trust-state ("RECOVERY") rather than NEW DEVICE.
  - Visible interstitial on peers' chats for 30 days post-recovery.
  - For 7 days post-activation, the recovery device cannot see unencrypted historical data (not that there is any under Option 2, but belt-and-braces).

Properties:
- Security: significantly better than un-hardened Option Y; still relies on email as the anchor.
- Usability: 72-hour wait is a non-trivial inconvenience for a legitimate user.
- Transparency: multiple notification channels; harder to perform silently.
- Still vulnerable to: patient attacker + email takeover + user not responding to cancellation emails + peers not noticing the trust-state notice.

### 3.5 · Recommendation for D4

**Proposed amendment to the register:** replace D4's current recommendation ("Option Y · soft recovery via identity provider") with:

> **No neutral default.** This decision has no safe default that preserves both usability and security. The owner must explicitly choose among α, β, γ, δ above, understanding each option's attack surface.
>
> **Claude's analytical recommendation (not an owner approval):**
> - For security maximalism: **Option β · pre-provisioned recovery mnemonic.** Industry-proven in cryptocurrency wallets. Puts the recovery authority in the user's physical custody, outside anything an attacker can reach via email or session compromise.
> - If pre-provisioning UX is unacceptable: **Option γ (peer co-sign)** is the next-safest, but UX is novel.
> - **Not recommended**: Option δ. Email-anchored recovery on an E2EE messenger inherits the weakness of the email provider's authentication, which is often weaker than NEX's own authentication (SMS 2FA, security questions, etc.).

**Qualified cryptographic review is required for whichever option the owner chooses**, specifically to validate the recovery-attestation scheme that peers' clients will trust.

---

## 4 · Transition rollback · critical examination

### 4.1 · Reversibility of each phase

Walking the seven phases from BLOCKER 5:

| Phase | Name | Reversible? | How to reverse |
|---|---|---|---|
| A | Pre-notification | **Fully reversible** | Stop sending notifications; nothing has been changed in production state. |
| B | Dual-write | **Fully reversible** | Flip the dual-write feature flag off; continue writing plaintext only. No data destroyed. |
| C | Freeze instant | **Fully reversible** | Flip the plaintext-write feature flag back on; resume dual-write; retract the freeze notification to users. |
| D | Legacy read-only | **Fully reversible** | Re-enable plaintext-write (reverting to Phase B state); re-notify users. |
| E | Export closed | **Fully reversible** | Re-open the export endpoint; extend the window. No data destroyed. |
| **F** | **Final purge** | **IRREVERSIBLE at the first destructive operation** | — |
| G | Verification | — (post-irreversibility) | — |

### 4.2 · The exact irreversible point

Phase F consists of two destructive operations:

- **F1** · `DELETE` all objects from the public bucket.
- **F2** · `DROP COLUMN nex_peer_message.body` (plus associated indexes).

Each operation is irreversible per-object once committed. The **exact irreversible point** is the first destructive commit · either the first Storage DELETE or the first DROP COLUMN, whichever runs first.

If the operator runs them sequentially:
- First F1 (Storage DELETEs): once an object is gone, it is gone. Each DELETE is instantaneous and irreversible.
- Then F2 (DROP COLUMN): the column is dropped; data is unrecoverable (unless a prior backup exists, which under principle 6 would itself violate "no permanent server-side chat history").

The reconciliation between F1-first vs F2-first is a design micro-choice. **Recommendation: F1 before F2.** Rationale: if F2 (column drop) runs first and then F1 (Storage DELETE) fails or is interrupted, you have attachments orphaned on Storage with no DB reference to clean them up safely. F1-first means an F2 failure leaves rows with usable `body` text (temporarily readable) but no attachments · a less-bad half-state.

### 4.3 · The hard-authorise gate

**Proposed amendment to BLOCKER 5.** Phase F must not begin on a schedule. It must begin on explicit owner authorisation that confirms, at the moment of authorisation:

1. Phase E (export close) is complete; export endpoint returns 410 Gone.
2. All in-flight export generations have terminated (success OR definitive failure logged).
3. The GDPR SAR queue is empty, or any remaining items have been escalated to manual legal processing with their own data path independent of `body` column.
4. The user notification cadence has completed; T_purge_complete has been publicly announced.
5. The operator team has been notified and is actively monitoring.
6. A dry-run against a staging mirror has produced the expected post-purge state (no `body` column, no public bucket objects referenced by any remaining row).

Only when all six are confirmed does the owner authorise Phase F to begin. The authorisation is a specific instruction naming "F1" and "F2" explicitly · generic approvals are not sufficient.

### 4.4 · What happens if exports fail during Phase F

The export endpoint is closed at T_export_close (Phase E), BEFORE Phase F begins. So no new export requests can arrive during F.

**But** export BUNDLES already generated by T_export_close may still have active signed download URLs (the 7-day grace mentioned in BLOCKER 5). Those bundles were generated BEFORE Phase F · they live in Storage as separate objects or packaged downloads · they are NOT affected by F1 (which targets the public ATTACHMENT bucket) or F2 (which targets the `body` column).

**However**: if an in-flight bundle generation was NOT complete at T_export_close and the operator pre-F step 2 above (all in-flight export generations terminated) was not actually enforced strictly, there is a risk that Phase F destroys the source data for a user's unfinished bundle.

**Hard rule: Phase F cannot begin while any in-flight export generation is still running.** This is the operational safeguard. The owner's F-authorisation must certify this.

### 4.5 · What happens for users who do not return

Users who never log in during Phases A–E:
- Never see in-app notifications.
- Receive email notifications if an email is on file (but may not read them).
- Have not exported.
- Their legacy plaintext is purged in Phase F.
- Governed by D18 (users-who-don't-return policy).

If D18 is set to option (aa) **purge regardless**: their history is lost silently. This is the current recommended default.

If D18 is set to option (bb) **preserve plaintext**: this violates principle 6 and must be rejected.

If D18 is set to option (cc) **delete inactive accounts entirely**: at Phase F, instead of purging history only, the entire account row is deleted. The user who later tries to log in finds their account does not exist. This is cleaner under GDPR data-minimisation but requires separate account-deletion engineering, which is NOT in Phase F's current scope. If the owner picks (cc), Phase F must be expanded to include account deletion for defined-inactive accounts.

### 4.6 · Proposed amendment to BLOCKER 5

Add a new sub-section after Phase F:

> **Phase F · explicit irreversibility declaration.**
>
> Phases A through E are reversible without data loss. Phase F is the irreversible point. Before Phase F begins, the owner must issue a specific authorisation instruction naming F1 (Storage DELETE) and F2 (DROP COLUMN) as the specific destructive operations to be performed. The authorisation must confirm all six pre-F conditions in §4.3 above.
>
> Phase F executes F1 before F2. A failure during F1 leaves the system in a partial state where some attachments are gone but the `body` column is intact; the operator may pause F, assess, and either resume F1 or revert the dependent application code to read from `body` only (temporary · requires a new owner decision to re-run F).
>
> After F2 commits, the system has reached the end state. No subsequent action can restore the purged data.

---

## 5 · Summary of findings

### 5.1 · Decision count

- Correct total: **19 decisions** currently in the register.
- With the forward-secrecy decision added (§2.9), total becomes **20**.
- The register's header "15" is stale and must be corrected.
- All original challenge-document items are accounted for; 4 items were added during register production (D2, D4, D12, D19); 1 was split (D16+D17 from a single notification+consent item); 1 was merged (public-bucket + export windows into D15).
- Recommendation: owner may choose to split D15 into D15a and D15b if desired · no architectural impact.

### 5.2 · Forward secrecy

- The "one-sided forward secrecy on sender side" claim in BLOCKER 1 is **retracted**.
- The current protocol provides NO meaningful forward secrecy.
- Compromise of a recipient's long-term `encryption_priv` at any future time allows decryption of ALL past messages encrypted to that key.
- Deletion of sender's ephemeral X25519 private after wrap is a protocol-hygiene habit that does NOT provide a forward-secrecy guarantee.
- Double Ratchet (or equivalent key-chain construction) is required for genuine forward secrecy + post-compromise security.
- A new decision point (D20) is identified: include Double Ratchet now vs defer. **No neutral default; owner must decide.**
- Required: qualified cryptographic review of whichever option is chosen.

### 5.3 · Account recovery

- Option Y (email + face-sign-in-via-WebAuthn) as proposed is **insufficient** · WebAuthn is device-bound and cannot authenticate a user who has lost all devices, collapsing recovery to email-only.
- Email-only recovery inherits the authentication weakness of email providers (SIM swap, phishing, credential stuffing).
- Four alternative recovery models (α · strict no-recovery; β · pre-provisioned mnemonic; γ · peer co-sign; δ · email + significant friction) are presented.
- Claude's analytical recommendation (not an owner approval): β or γ for security; δ not recommended on an E2EE messenger.
- D4 in the register should be reworded: no neutral default; owner picks among α/β/γ/δ.
- Required: qualified cryptographic review for the recovery-attestation protocol under whichever option is chosen.

### 5.4 · Transition rollback

- Phases A–E are **fully reversible** without data loss.
- Phase F is **irreversible at its first destructive commit** (either F1 Storage DELETE or F2 DROP COLUMN, whichever runs first).
- Recommended ordering: F1 before F2 (less-bad half-state on partial failure).
- Phase F must not begin on a schedule; it begins on explicit owner authorisation certifying six pre-F conditions.
- Phases A–E can retract notifications and reverse all state changes.
- No invented deadlines or consent assumptions; actual values remain owner decisions (D13-D19).

### 5.5 · Recommended amendments (NOT APPLIED by this document)

| # | Document | Amendment |
|---|---|---|
| 1 | Owner Decision Register (D1-D19) | Correct header count from "15" to "19"; optional split of D15 into D15a + D15b |
| 2 | Owner Decision Register | Add D20 · Forward secrecy / Double Ratchet (SECURITY) |
| 3 | Blocker Resolution Proposals BLOCKER 1 | Retract "one-sided forward secrecy" paragraph; replace with the corrected statement in §2.6 above |
| 4 | Owner Decision Register D4 | Reword to "No neutral default; owner picks among α/β/γ/δ"; attach four recovery options to the entry |
| 5 | Blocker Resolution Proposals BLOCKER 2 | Replace Option Y recommendation with the four-option analysis in §3.4 above |
| 6 | Blocker Resolution Proposals BLOCKER 5 | Add explicit irreversibility declaration from §4.6 above |

**None of these amendments are applied in this document.** They are listed as the delta the owner would authorise in a follow-up design pass before Architecture Review v2 is produced.

### 5.6 · Decisions requiring qualified cryptographic review

Confirmed items (expanded from prior listings):

- Full protocol correctness check (Dolev-Yao adversary) · D1, D2, D3
- Double Ratchet variant selection if D20 picks "include now" · D20
- Recovery-attestation protocol for peers' clients · D4
- QR link-token signature verification + visual-match short-code derivation · D5
- Replay-protection message_id-in-envelope correctness · D1/D2 interaction
- libsodium.js WASM path side-channel analysis on target browsers · D1

### 5.7 · Decisions requiring qualified legal review

Unchanged from the prior register:

- D15 (export window length)
- D17 (consent model)
- D18 (users-who-don't-return policy)
- D19 (GDPR SAR interaction at T_export_close)

Legal review scope: GDPR as baseline, plus jurisdiction-specific regulations in NEX's operational regions.

---

## 6 · Confirmation of restrictions observed

- No implementation performed.
- No code written or modified.
- No SQL executed.
- No database access (production, preview, or scratch).
- No migrations drafted or applied.
- No infrastructure or packages installed.
- No Git commit, push, or remote change.
- No deployment.
- No environment variable or credential change.
- No modification of Bridges 76, 77, 88.
- No modification of `scripts/_tmp/`.
- No modification of the two existing documents (register + proposals).
- No owner decisions made.
- One new file created: this document.

Stopping. Awaiting owner review of findings before any further action.
