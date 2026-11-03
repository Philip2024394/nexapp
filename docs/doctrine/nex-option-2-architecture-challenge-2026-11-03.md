# NEX Option 2 · final architecture challenge · 2026-11-03

## 1 · Executive verdict

**Verdict: NOT READY FOR ACCEPTANCE.**

The consolidated draft (`nex-option-2-architecture-review-draft-2026-11-03.md`) is a strong architectural starting point, but static review surfaces **six BLOCKER-class findings** that must be resolved before the architecture can be accepted as of record. The core device-ownership principle is intact; the gaps lie in the cryptographic protocol specification, the operator-worker interaction with external Storage, the device-registration trust bootstrap, and legacy transition finality. None of these are implementation details — they shape what the system actually promises.

The retention and quarantine corrections previously landed by the owner are preserved and remain the right choices. This challenge **does not reopen** owner-approval-only retention, four-trust-states, or all-devices-ACK. It challenges unspecified protocol primitives sitting underneath those decisions and the inconsistencies between the SQL design artefacts and the consolidated draft.

Final acceptance requires owner action on 6 BLOCKERS + 11 HIGH + 6 MEDIUM + 3 LOW findings and 15 explicit owner decisions catalogued in §12.

---

## 2 · Scope and restrictions observed

**Authorised scope:** critical static review of the consolidated Option 2 architecture document and its supporting artefacts. Produce one challenge document. Do not implement.

**Restrictions observed in this review:**
- No code written or modified.
- No SQL executed.
- No database access (production, preview, or scratch).
- No migrations drafted or applied.
- No infrastructure or packages installed.
- No Git operation (commit, push, remote change).
- No deployment, environment variable change or credential access.
- No modification of Bridges 76, 77, 88.
- No touch of `scripts/_tmp/`.
- No modification of the original architecture draft · all proposed changes are described here as **proposed amendments**, not silent rewrites.
- No modification of existing chat implementation.

**Artefacts inspected (static reads only):**
- `docs/doctrine/nex-option-2-architecture-review-draft-2026-11-03.md` (493 lines · the subject of this challenge)
- `scripts/audit/b0-cleanup-worker-design.sql` (full)
- `scripts/audit/b0-concurrency-and-recovery-review.md` (full)
- `scripts/audit/b0-device-key-coverage.sql` (full)
- `scripts/audit/b0-trust-states-design.md` (prior read in session)
- `scripts/audit/b0-rehearsal-schema.sql`, `b0-rehearsal-fixtures.sql`, `b0-rehearsal-expected.md` (prior reads)

**One new file created by this challenge:** this document. Nothing else touched.

---

## 3 · Architecture overview (challenger's summary)

Option 2 as currently drafted is a Signal-adjacent 1:1 messaging architecture:

- Device-local IndexedDB is canonical plaintext storage (Bridge 77 sealed).
- Server-side `nex_peer_message` holds only ciphertext + per-recipient wrapped content keys (Bridge 76 sealed).
- Fan-out writes one row per recipient device; a `message_group_id` ties them.
- ACK semantics: all-devices-ACK or TTL expiry.
- Device-key registry: `nex_account_device_key` with `UNIQUE (account_id, device_id)` and `revoked_at` nullable.
- Cleanup worker: periodic sweep with `FOR UPDATE SKIP LOCKED` row-locks + `pg_try_advisory_xact_lock` group-locks.
- Quarantine worker: periodic scan for missing-key rows → human review table.
- Retention policy: owner-approval-only (option b · sealed 2026-11-03).
- Trust states: UNVERIFIED / VERIFIED / NEW DEVICE / CHANGED.
- QR linking: HMAC-protected secondary-device add.
- Attachment lifecycle: client-encrypted ciphertext → private bucket → signed-URL fetch → decoupled purge queue.
- Legacy transition: dual-write → freeze → export window → public-bucket purge.
- GDPR: SAR returns ciphertext metadata + "export from your device" instruction; right-to-erasure cascades at account layer, cannot reach recipient-held plaintext.

**What the draft does NOT currently specify, discovered in this challenge:**
- The symmetric message key provenance, scope, and uniqueness.
- How a sender's device actually wraps a key for a recipient device (asymmetric algorithm not named).
- Whether `public_key` is a signing key, an encryption key, or both.
- How a device proves possession of its claimed private key at registration.
- Where the QR-linking HMAC key originates for a first-ever install.
- Whether new devices receive any historical messages (and if so, by what mechanism).
- Whether the server could replay stored ciphertext to a recipient.
- How offline devices are woken to poll.
- How clock skew affects revocation-time comparisons.

---

## 4 · Four mandatory challenge-area findings

### A · Encryption and complete device trust protocol

The consolidated draft names `nacl.secretbox` as the body cipher and says "wrapped per recipient device", but **does not establish the full cryptographic protocol**. Each unresolved primitive below is a correctness gap that the architecture must close before claiming any security property.

#### A.1 · Content-key provenance and scope · UNRESOLVED

The draft says the server-side row carries a `content_key_wrapped` field. It does not say:

- Is the content key **random per message** (CSPRNG, 32 bytes fresh per send) or reused across messages/conversations/devices?
- If per-message: there is **no key-reuse** risk and nacl.secretbox is used safely. The 24-byte nonce can even be constant per content key (one-time use).
- If per-conversation: nonces MUST be strictly incrementing or random with sufficient entropy, and the key must rotate on compromise. Not addressed.
- If per-attachment vs per-message body: the draft hints at `K_att` for attachments distinct from body `content_key` but doesn't formally separate them.

**Challenge finding (BLOCKER):** without a documented key scope, the architecture cannot claim confidentiality. If content keys were reused and nonces not strictly fresh, nacl.secretbox is compromised.

**Proposed amendment:** state explicitly:
- `K_msg` = fresh 32-byte CSPRNG symmetric key per outbound message.
- Nonce = 24-byte CSPRNG per encryption (never reused with the same key).
- `K_att` = separate fresh 32-byte CSPRNG per attachment.
- No key reuse across messages, attachments, or devices.

#### A.2 · Key wrapping algorithm · UNRESOLVED

The draft says the content key is "wrapped per recipient device's public key" but does not say **by what algorithm**. The implicit candidates:

- `crypto_box` (NaCl X25519 + XSalsa20-Poly1305) — requires sender ephemeral key + recipient static X25519 key.
- Signal's X3DH / Double Ratchet — explicitly out of scope (noted as deferred in section 0 of the draft).
- Raw asymmetric encryption of 32-byte key — libsodium doesn't support this directly; must be hybrid.

**Challenge finding (BLOCKER):** without a named algorithm, a reviewer cannot verify key-exchange soundness. The schema says `public_key text CHECK length BETWEEN 40 AND 64` — base64 of either 32 bytes (ed25519 signing OR x25519 encryption) or 48 bytes (compressed P-384) could all fit. We cannot tell which.

**Proposed amendment:** state explicitly:
- Each device holds a long-term **X25519 encryption key pair** (public half published to `nex_account_device_key`).
- Sender wraps `K_msg` using `crypto_box(K_msg, nonce, device_x25519_pub, sender_ephemeral_x25519_priv)`.
- Sender's ephemeral X25519 public key is attached per message, allowing recipient to run DH.
- Content-key-wrapped field is actually two fields: `wrapped_key` + `sender_ephemeral_pub`.

#### A.3 · Signing versus encryption keys · UNRESOLVED

`nex_account_device_key.public_key` is a single column with length 40–64 chars. **The draft never says whether this is an encryption key, a signing key, or both.** Using the same key for both X25519 (ECDH) and Ed25519 (signing) is a well-known cryptographic anti-pattern (while it is possible with care, it generally should not be done casually).

**Challenge finding (BLOCKER):** the trust-states design (UNVERIFIED/VERIFIED/NEW DEVICE/CHANGED) implicitly assumes the public key authenticates the device. But if the key is only used for encryption, we have no cryptographic authentication — only "we assume whoever controls the private key is the device owner" via TOFU. If the key is used for signing too, no signing use is specified anywhere in the architecture.

**Proposed amendment (recommended):**
- Each device has **two separate keys**: Ed25519 identity key (long-term signing) + X25519 encryption key.
- Identity key signs the device's encryption key at registration (certificate-style).
- Messages are optionally signed with the sender's identity key (for sender-side non-repudiation inside the authenticated-encryption envelope).
- Schema change: split `public_key` into `signing_public_key` + `encryption_public_key` + `encryption_key_signature` (where the signature proves the encryption key was issued by the signing key).

If the owner prefers to keep a single key (simpler but weaker), document this as a conscious tradeoff.

#### A.4 · Device registration proof-of-possession · UNRESOLVED

**Nothing in the draft or supporting artefacts specifies how the server verifies that a device registering a public key actually controls the matching private key.**

Current implicit flow (inferred from `nex_account_device_key` schema): client POSTs `{device_id, public_key}` → server INSERTs row keyed by `(account_id, device_id)`.

**Threat:** an attacker with a stolen session cookie or compromised auth token could register a public key **they themselves generated** against the victim's account. All future messages sent to that account would be encrypted to the attacker's device too. The attacker reads everything. The CHANGED trust-state detection fires on the recipient device-list change for OTHER contacts, but the victim's OWN contacts' CHANGED states don't help the victim — the victim is the one being spied on, not the senders.

**Challenge finding (BLOCKER):** this is the single most important gap in the whole architecture. Any trust guarantee rests on the premise that `nex_account_device_key.public_key` is a key the claimed device actually controls. Without proof-of-possession, the registry can be poisoned.

**Proposed amendment:** mandatory challenge-response at registration:
1. Client requests registration · server generates a 32-byte random challenge, stores it with a short TTL (60s).
2. Client signs challenge with the private key corresponding to the public key being registered.
3. Server verifies signature using the proposed public key before inserting the row.
4. If signing + encryption keys are separate (recommended per A.3), the challenge is signed with the identity key, and the identity key simultaneously signs the encryption public key for upload.

#### A.5 · QR linking HMAC key provenance · UNRESOLVED

Draft §8 says:
> QR encodes `{ account_id, link_token, hmac_sha256(link_token, root_signing_key) }` ... The HMAC prevents a malicious server from substituting link tokens.

**But where does `root_signing_key` come from?**

- If it is generated on the primary device at account creation and never leaves the device: works. But at account creation there is **only one device**. Where was the key generated and how is it preserved across subsequent primary-device replacements (if the user replaces their phone, is this key lost)?
- If it is a derived key from the user's password: NEX uses WebAuthn + face sign-in per NEX doctrine (sealed 2026-10-23); there is no password to derive from.
- If it is server-provided: the server could substitute and the HMAC guarantee collapses.

**Challenge finding (BLOCKER):** the HMAC guarantee as stated is empty — the key origin determines whether the server can forge it, and the key origin is undefined.

**Proposed amendment:** state explicitly:
- The device identity Ed25519 private key (A.3) IS the signing key for QR link-tokens — not a separate "root signing key".
- QR encodes `{ account_id, link_token, Ed25519-sign(link_token, device_identity_privkey) }`.
- Server never sees the identity private key.
- When the first-ever device is created at account signup, the Ed25519 key pair is generated client-side. The private key is held in IndexedDB and (optionally) exported to the user as part of the Pre-emptive export (§11).
- Loss of the only identity-key-holding device = permanent inability to link new devices without a server-mediated recovery flow (which must itself be designed; currently out of scope).

#### A.6 · Replay protection · UNRESOLVED

A malicious server (or anyone with DB write access) could re-insert a previously-delivered ciphertext row and re-serve it to the recipient device. The recipient device would:

- Fetch the row, see the ciphertext, decrypt successfully (same `K_msg` wraps correctly).
- Possibly treat it as a new message.

**Challenge finding (HIGH):** the architecture needs a client-side dedup on `message_id` (UUID assigned at send time) persisted in IndexedDB. The design mentions `keyed by (conversation_id, message_id)` in IndexedDB (§1) but doesn't call out replay protection explicitly.

**Proposed amendment:** state explicitly:
- Each outbound message has a UUID assigned by the sender device BEFORE encryption; the UUID is encrypted inside the ciphertext envelope (not just in the server-visible metadata).
- Recipient device checks UUID against its local `messages` table; already-seen UUID = silently drop (replay).
- The server-visible row `id` is a separate UUID chosen by the server at insert; recipients MUST NOT trust it for dedup.

#### A.7 · Forward secrecy and post-compromise security · DOCUMENTED-AS-DEFERRED but under-communicated

Section 0 of the draft says "Perfect forward secrecy via Double Ratchet (deferred)". This is honest internally, but the user-facing implication is severe:

- If a device's long-term private key is ever compromised, **every past message that device has ever decrypted can be decrypted again** by whoever stole the key.
- Compare: Signal, WhatsApp, iMessage all have forward secrecy. NEX will not.

**Challenge finding (HIGH):** the privacy policy MUST state this limitation, and the owner must make a conscious decision whether to accept it for the initial ship.

**Proposed amendment:** add explicit section to the architecture:
> **Forward secrecy status.** NEX Option 2 does NOT provide forward secrecy. A device's long-term private key, if compromised, allows decryption of all historical messages that device has ever received. This is an accepted tradeoff for architectural simplicity in the initial Option 2 ship; introduction of Double Ratchet is deferred to a future stage. Users must be informed in the privacy policy.

#### A.8 · Compromised linked device · DOCUMENTED but implications under-stated

Section 8 lists this as "not protected against" (correct). But implications aren't drawn through: a compromised linked device has **the same read access as the primary**. There is no device-privilege ladder (e.g., "secondary device can read but not initiate new conversations"). Not necessarily wrong; just worth stating.

**Challenge finding (MEDIUM):** make explicit that linked devices are peers in capability, not privileges.

### A · Summary of findings

| # | Severity | Issue |
|---|---|---|
| A.1 | BLOCKER | Content-key provenance and scope unspecified |
| A.2 | BLOCKER | Key-wrapping algorithm unnamed |
| A.3 | BLOCKER | Signing vs encryption keys conflated |
| A.4 | BLOCKER | Device registration proof-of-possession undefined |
| A.5 | BLOCKER | QR linking HMAC key provenance undefined |
| A.6 | HIGH | Replay protection relies on undocumented client dedup |
| A.7 | HIGH | Forward-secrecy deferral not translated to privacy policy |
| A.8 | MEDIUM | Linked-device privilege model implicit |

---

### B · All-devices ACK, offline devices, and quarantine

The ACK + retention + quarantine model is the strongest part of the draft. The two prior owner corrections (missing-key → quarantine, revoked-after-send → retain-until-TTL) have landed cleanly in `b0-cleanup-worker-design.sql`. However, static review surfaces one documented inconsistency and several lifecycle edge cases the draft does not fully explore.

#### B.1 · Inconsistency between SQL file and quarantine semantics · HIGH

`b0-cleanup-worker-design.sql` lines 285–287 (operator workflow for 'waiting' resolution) says:

> `'waiting' · operator doesn't have enough info · leaves the group quarantined · the TTL will eventually expire the group via the normal cleanup predicate.`

**But the actual cleanup predicate (lines 199–237) treats missing-key as a hard blocker regardless of TTL.** A quarantined group's TTL does NOT cause automatic sweep. The 'waiting' comment is wrong.

**Challenge finding (HIGH):** this comment contradicts the owner-approved retention policy. Must be corrected to reflect "operator leaves in place · group is retained · TTL does not automatically expire a quarantined group · indefinite retention is the explicit tradeoff of option (b)".

**Proposed amendment (static · design only):** reflow the 'waiting' comment in the SQL file at implementation time. Not touched in this authorisation.

#### B.2 · Group containing both DELIVERED and MISSING_KEY rows · HIGH

Scenario: group `G` fans out to recipient devices {D1 (trusted, ACKED), D2 (trusted, ACKED), D3 (missing-key)}. Current predicate:

- D1 row: cleanup-eligible (ACKED) · would be swept if group permits.
- D2 row: cleanup-eligible (ACKED) · would be swept if group permits.
- D3 row: NOT cleanup-eligible (missing-key path never selects it) · also triggers Blocker 2 in `sweepable_groups` NOT EXISTS.

Outcome: whole group retained indefinitely. D1 and D2's ciphertexts (plus their wrapped content keys) sit on the server **even though they were successfully delivered**. This is the direct consequence of owner-approval-only retention + missing-key hard-blocker.

**Challenge finding (HIGH):** architecturally correct per sealed decisions, but it means NEX permanently stores ACKED ciphertexts whenever one group member has a missing key. The privacy policy must acknowledge this.

**Proposed amendment:** add to §12 "Honest security limits" of the draft:
> **Ciphertext retention beyond delivery.** In Option 2, a message group containing even one row whose recipient device-key record is missing is retained indefinitely pending operator review (option (b)). This means ciphertexts of messages that have already been successfully delivered to other devices in the same group remain on the server until the quarantine is resolved. NEX cannot decrypt them, but it retains them.

#### B.3 · Race: ACK commit vs cleanup worker snapshot · MEDIUM

Scenario: at time T, device D ACKs row R (UPDATE sets `delivered_at = now()`). At the same instant, cleanup worker starts a tx whose snapshot predates D's commit.

- Worker's SELECT sees R as `delivered_at IS NULL`.
- If other rows in R's group are all cleanup-eligible via other predicates (REVOKED_BEFORE_SEND, TTL_EXPIRED), the group might still be sweepable from the worker's view — but R's row is NOT in `candidate_rows` because worker sees R as not-yet-ACKED.
- Actually: candidate_rows WHERE requires `delivered_at IS NOT NULL` for the ACKED branch, so R is not in candidate_rows. The group may still be swept via other candidates. The sweepable_groups NOT EXISTS predicate must then evaluate R as a potential blocker (undelivered within TTL and trusted device) → fires blocker 1 → group retained. Correct.

**Challenge finding (MEDIUM):** no actual correctness bug, but the behavior deserves a documented example in the SQL comments.

#### B.4 · Race: device revocation between fan-out fetch and send-commit · HIGH

Scenario:
- Sender A fetches recipient B's device-key list at T0 → sees devices {D1, D2}.
- At T1 (T0 < T1 < send commit), D2 is revoked (`revoked_at = T1`).
- At T2 (> T1), sender's transaction COMMITs fan-out rows for both D1 and D2. D2's row has `sent_at = T2 > T1 = revoked_at`.
- D2's row satisfies REVOKED_BEFORE_SEND predicate (`revoked_at <= sent_at`).
- Next cleanup tick, D2's row is cleanup-eligible.
- Sender's UI never knows D2 was revoked between fetch and commit · may show "sent to all devices".

**Challenge finding (HIGH):** sender's UI may lie unless there's a feedback path. The architecture doesn't currently specify one.

**Proposed amendment:** either:
- Sender re-reads the device-key list atomically with the write (SELECT FOR SHARE on device_key rows during fan-out, or a serialisation isolation level), or
- Sender's "delivered" indicator correctly treats REVOKED_BEFORE_SEND rows as non-targets (never counts toward delivered or pending).

Preferred: the UI reads the server-side truth, so it should naturally exclude REVOKED_BEFORE_SEND rows from the "pending delivery" count.

#### B.5 · Device added after send · HIGH

Scenario: sender A sends to recipient B at T0 with B having devices {D1, D2}. At T1 > T0, B adds D3. D3 is NOT in the fan-out for the T0 message.

- D3 can never decrypt the T0 message (no wrapped content key for it).
- D3 does not even see the metadata row (recipient_device_id = D3 means nothing to the row's recipient_device_id = D1 or D2).
- From D3's user-facing perspective: empty IndexedDB for prior history. Even messages still within TTL.

**Challenge finding (BLOCKER / HIGH depending on interpretation):** this is the most user-visible gap. A user adding a second device will see empty history on it unless we design a sync mechanism. Options:

1. **No history on new devices · Signal model.** The user accepts this and must export beforehand.
2. **Primary-assisted sync.** Primary device detects new sibling device joining; initiates a device-to-device re-encryption and upload of recent history, encrypted to the new device's key.
3. **Server-mediated re-encryption prompt.** Server notifies primary when a new device joins; primary re-encrypts last N messages / M days to the new device.

The current draft is implicitly (1) but doesn't say so.

**Proposed amendment:** state explicitly which option is chosen. If (1): make the UI copy on new-device join say "This device will see new messages from here on. It will not see messages from before it was linked. Export your history on your other device if you want to transfer it." If (2) or (3): design the sync protocol (not drafted; separate stage).

**Severity call:** marking this HIGH not BLOCKER because option (1) is a legitimate choice. BLOCKER if the owner wants to claim "all your devices see all your messages" — which the current draft doesn't claim, but users may assume.

#### B.6 · Permanently offline device + indefinite relay retention · RESOLVED-BY-TTL

The TTL guarantees that a device trusted-but-permanently-offline won't retain its row forever: after `ttl_expires_at`, the row is cleanup-eligible. Verified against the SQL predicate. Good.

**But**: the whole group's attachment stays on Storage until the LAST group row is swept. If one trusted-but-slow device never ACKs, the entire attachment is retained for the full TTL window. For 7-day TTL + large videos, this is a real storage cost. Not a correctness issue; a cost issue.

#### B.7 · Duplicate ACK · MEDIUM

Design doesn't say what happens if a device sends ACK twice (network retry). Expected: UPDATE is idempotent (`SET delivered_at = COALESCE(delivered_at, now())` or similar), server returns 200 either way.

**Proposed amendment:** state explicitly in the ACK endpoint design.

#### B.8 · Duplicate delivery · MEDIUM

Design doesn't say what happens if the same ciphertext row is fetched twice by the same recipient device. Covered partly by A.6 (replay protection) but worth calling out explicitly: recipient device dedups on the inner `message_id`.

#### B.9 · Partial delivery UX · MEDIUM

For "sent to 1 of 3 devices", the sender's UI needs a state. The draft doesn't specify. Possible states: SENT (fan-out committed), PENDING (0 ACKs), DELIVERED-PARTIAL (1+ but not all), DELIVERED-ALL, UNDELIVERED-TTL-EXPIRED.

**Proposed amendment:** add a UX state table.

#### B.10 · "Delivered" vs "read" · HIGH

In Option 2, `delivered_at` means "ACK received" (device wrote plaintext to IndexedDB), **not** "user saw the message". This is a semantic difference from most chat apps.

**Challenge finding (HIGH):** must be made explicit in UI copy. Users expect "delivered" to mean something close to "read". Decoupling it needs communication, or a separate "read" layer must be added (which complicates the architecture).

### B · Summary of findings

| # | Severity | Issue |
|---|---|---|
| B.1 | HIGH | SQL file 'waiting' comment contradicts retention policy |
| B.2 | HIGH | ACKED ciphertexts retained indefinitely when sibling row has missing key |
| B.3 | MEDIUM | ACK vs cleanup race documented but not tested |
| B.4 | HIGH | Sender UI may lie when revocation happens during fan-out |
| B.5 | HIGH | New device sees no history · needs explicit UX decision |
| B.6 | RESOLVED | TTL caps permanent offline retention |
| B.7 | MEDIUM | Duplicate ACK idempotency unspecified |
| B.8 | MEDIUM | Duplicate delivery dedup implicit |
| B.9 | MEDIUM | Partial-delivery UX unspecified |
| B.10 | HIGH | "Delivered" ≠ "read" needs user-facing clarity |

---

### C · Attachment lifecycle and Storage error handling

#### C.1 · 403 handling · BLOCKER

Current mapping (draft §12):
```
403 → dead_lettered_at = now() + alert
```

Owner's challenge is correct. In Supabase Storage:
- ACLs are predominantly **bucket-level**, not per-object. A single-object 403 is extremely rare.
- A bucket-policy misconfiguration, service-role key rotation, or RLS change on the Storage schema produces **universal** 403.
- Under the current mapping, a universal 403 would cause **every row in the queue** to be dead-lettered on first touch after the misconfiguration lands. The dead-letter column fills; the queue appears "empty" (no pending work); the system looks healthy; an enormous backlog of orphan ciphertext accumulates in Storage.

**Challenge finding (BLOCKER):** must reclassify 403 to **pause + page**, with the same severity as 401.

**Proposed amendment:**

Revised mapping:
```
200 / 204 / 404       → purged_at = now()                   -- success (404 is idempotent)
408 / 429 / 500..504  → attempt_count++, backoff            -- transient
network timeout       → attempt_count++, backoff            -- transient
TLS handshake failure → attempt_count++, backoff            -- transient
400                   → dead_lettered_at = now() + alert    -- malformed key (object-specific)
401                   → WORKER PAUSE + PAGE OPS             -- auth broken globally
403                   → WORKER PAUSE + PAGE OPS             -- bucket policy / service-role access
other 4xx (409/413/422) → attempt_count++, dead_letter after low cap (3) -- object-specific anomalies
```

Rationale: Supabase Storage's permission model is bucket-level. 403 is almost never object-specific. If we cannot reliably distinguish object-specific 403 from global 403 (which the Storage API doesn't help us do), the safe default per the challenge instruction is pause + alert.

#### C.2 · Signed URL expiry · HIGH

The draft says "short-lived" but gives no number. Needed:

- Short enough that an intercepted URL cannot be replayed usefully.
- Long enough that mobile users on flaky connections can complete the download.

**Proposed amendment:** signed URLs expire 60 seconds after issuance for ciphertext downloads. If the recipient's download fails, the client re-requests a new signed URL. Document this value.

#### C.3 · Attachment ciphertext uniqueness · MEDIUM

The design assumes each attachment ciphertext is referenced by exactly one message_group (one upload = one group). If a user resends the same attachment, a new ciphertext is uploaded (new K_att, new ciphertext). This is correct for E2E but means **no sender-side dedup is possible**. 10 identical photos sent = 10 Storage objects.

**Proposed amendment:** state this explicitly as an operational cost. Alternative (client-side dedup via content hash before encryption) is NOT recommended — leaks "same content" to the server through side-channels.

#### C.4 · Missing object at delivery time · MEDIUM

Scenario: recipient fetches row R, unwraps K_att, calls signed URL — gets 404 (ciphertext was manually deleted / never uploaded / dead-lettered before purge actually happened). Current design has no "message undeliverable due to missing attachment" state.

**Proposed amendment:** recipient device should mark the message as "attachment unavailable" and still deliver the text body (if present). If the message was attachment-only, show a tombstone: "This attachment is no longer available."

#### C.5 · Dead-letter manual reconciliation · HIGH

The current design says dead-lettered rows "represent orphan storage objects (ciphertext left in Supabase but unreferenced from the DB)". The operator must either:
- Manually DELETE the orphan via Supabase console, OR
- Re-queue after fixing the underlying failure.

No automated reconciliation. If the dead-letter grows unbounded, orphan Storage grows unbounded.

**Challenge finding (HIGH):** dead-letter dashboard must include an "oldest dead-letter age" metric and an SLA for operator action.

**Proposed amendment:** add to §12 of the draft and to Gate 1 requirements:
- Dead-letter oldest-age metric.
- SLA: operator reviews dead-letter weekly.
- Reconciliation tool (CLI script) that lists dead-lettered rows + verifies Storage object presence.

#### C.6 · Signed URL cache in client · LOW

If the recipient device caches signed URLs in a service worker or similar, the URL may be used after expiry. Harmless (returns 403 from Supabase), but noisy in logs.

### C · Summary of findings

| # | Severity | Issue |
|---|---|---|
| C.1 | BLOCKER | 403 must reclassify to pause+page, not dead-letter |
| C.2 | HIGH | Signed URL expiry duration unspecified |
| C.3 | MEDIUM | Attachment dedup intentionally absent · state explicitly as cost |
| C.4 | MEDIUM | Missing attachment at delivery time has no UX |
| C.5 | HIGH | Dead-letter oldest-age metric and SLA missing |
| C.6 | LOW | Service-worker URL cache may produce spurious 403s |

---

### D · Legacy plaintext transition

#### D.1 · Transition windows unspecified · BLOCKER

The draft lists four distinct time windows with no values:
- Dual-write period duration
- Freeze day (absolute timestamp)
- Export availability window after freeze
- Public-bucket read-only window after freeze

**Challenge finding (BLOCKER):** these are not safe defaults; they are user-facing deadlines that affect GDPR, consent, and data loss. Owner must set each.

**Proposed amendment:** add a decision matrix (produced in §10 below) and get owner to set each value before freeze is scheduled.

#### D.2 · User notification and consent · BLOCKER

The draft does not specify:
- When users are told about the transition.
- Through what channel.
- Whether consent is required (likely yes under GDPR Art. 7 for processing changes).
- What a user who objects can do.

**Challenge finding (BLOCKER):** cannot execute B1 (freeze) without a documented notification + consent plan. Legal risk.

**Proposed amendment:** add a notification doctrine to the Legacy Transition section:
- Users are notified at app open AND via email (if consent exists) at least 30 days before freeze.
- Notification includes: what changes, what plaintext is kept and for how long, how to export, when the public bucket is purged.
- Users who object may export + delete their account. There is no "keep plaintext forever" option.
- Legal counsel reviews the notification copy before scheduling.

#### D.3 · Failed exports · HIGH

What happens if a user clicks "export" during the export window and the request fails (large data set, timeout, server error)? Current design: no retry, no notification, no SLA.

**Proposed amendment:**
- Export is async: user requests → server generates bundle → email with download link when ready.
- Each export request is retriable; user sees status in UI.
- Export window is extended by N days per user if their requested export has not succeeded.

#### D.4 · Users who do not return · HIGH

Users who never open the app during the window don't export. Their plaintext is purged. They won't necessarily even know.

**Challenge finding (HIGH):** owner + legal must decide:
- Do we honor these users' data regardless (preserve plaintext indefinitely for inactive accounts)? Violates "no permanent server storage" principle.
- Do we purge regardless? Simplest, but silent data loss.
- Do we delete the account entirely after the export window elapses with no login? More defensible under GDPR data-minimization, but destroys the user's identity too.

Current draft leans "purge regardless" implicitly. Should be explicit.

**Proposed amendment:** state the policy and justify it.

#### D.5 · Permanent dual-storage risk · HIGH

If dual-write cutover is delayed indefinitely (because the owner isn't ready to flip the switch), the system runs with plaintext AND ciphertext for every new message. Each delay extends the "last-ever plaintext" row's TTL.

**Challenge finding (HIGH):** must have a hard cutover deadline, not a conditional one.

**Proposed amendment:** owner sets freeze day as an absolute timestamp at the moment B1 is authorised. If the freeze cannot happen by that timestamp, the whole stage is rolled back (dual-write disabled, legacy writes resume) rather than extended indefinitely.

#### D.6 · GDPR right-of-access during legacy transition · HIGH

Scenario: user requests SAR during export window; export endpoint fails; export window expires; user then re-requests. Now NEX cannot produce plaintext (freeze happened, public bucket purged).

**Challenge finding (HIGH):** GDPR SAR has a 30-day legal deadline. Window interactions must respect that.

**Proposed amendment:** export window is at least 90 days post-freeze to safely accommodate GDPR response windows plus retries.

#### D.7 · Final purge is irrevocable · DOCUMENTED but under-emphasised

Once the public bucket is purged, legacy attachments are gone from NEX. User's recipient device may still hold decrypted plaintext of post-freeze encrypted messages, but legacy attachments are lost.

**Proposed amendment:** emphasise in user notification: "After [DATE], legacy attachments can no longer be recovered from NEX. Download your archive before this date."

### D · Summary of findings

| # | Severity | Issue |
|---|---|---|
| D.1 | BLOCKER | Transition windows unspecified (4 values) |
| D.2 | BLOCKER | User notification + consent plan unspecified |
| D.3 | HIGH | Failed export retry/SLA unspecified |
| D.4 | HIGH | Users-who-don't-return policy unspecified |
| D.5 | HIGH | No hard cutover deadline · indefinite dual-write risk |
| D.6 | HIGH | GDPR SAR interaction with export window |
| D.7 | LOW | Final purge irrevocability under-emphasised |

---

## 5 · Full 14-section consistency review

Running through all 14 sections of the consolidated draft for internal contradictions and missing dependencies.

| § | Section | Finding | Severity |
|---|---|---|---|
| 0 | Purpose and non-goals | Explicitly lists forward secrecy as deferred (good). Does NOT list "no server-side read receipts" or "no server-side search" as non-goals explicitly for user-facing clarity. | LOW |
| 1 | Device-local storage | Honest limits are good. Does not mention OS-level encryption guarantees (iOS Keychain / Android Keystore / browser-sandbox) available to the IndexedDB container. | LOW |
| 2 | Ciphertext-only relay | Schema sketch missing: `sender_ephemeral_pub` (needed for X25519 wrap per A.2). `nonce` listed but ambiguous (nonce for body OR nonce for key wrap? these are different). | HIGH |
| 3 | Multi-device ACK | All-devices-ACK rule is clear. Does not define a maximum fan-out N; a user with 20 devices multiplies the DB write cost. | MEDIUM |
| 4 | TTL + revocation | Correct per sealed decisions. 7-day TTL is proposed; no owner decision recorded. | HIGH (needs decision) |
| 5 | Attachment lifecycle | References Bridge 88 as sealed-deferred. Does NOT state what Bridge 88 defers (binary encryption on the critical path?). Dependency unclear. | HIGH |
| 6 | Group concurrency | Advisory-lock design resolved on paper. Syntax requires PG 11+ (confirmed; Supabase on PG 15+). | RESOLVED |
| 7 | Quarantine | Owner-decided (option b). SQL comment inconsistency (B.1) is a HIGH. | HIGH (B.1) |
| 8 | Trust states + QR linking | Encryption/signing conflation (A.3). HMAC key provenance (A.5). | BLOCKER (A.3, A.5) |
| 9 | Legacy transition | All D-findings apply. | BLOCKER (D.1, D.2) |
| 10 | GDPR | SAR deadline interaction with export window (D.6). | HIGH (D.6) |
| 11 | Device loss | Encrypted-backup future design is reasonable but creates "NEX stores encrypted blob it cannot decrypt" semantic. Not contradicted by §2 if explicitly separated. | HIGH (semantic clarity) |
| 12 | Security limits + ops costs + failure recovery | 403 mapping error (C.1). Signed URL expiry (C.2). Clock-skew implications absent. | BLOCKER (C.1) |
| 13 | Migration sequence | B3 (binary encryption) listed as blocking B4 (cleanup worker), but cleanup worker also handles non-attachment ciphertext. Could order differently if separated. Minor. | LOW |
| 14 | Review checklist | 10 items. Missing: cryptographic protocol spec (A.1-A.5), new-device sync UX (B.5), user notification plan (D.2). | HIGH |

### Internal contradictions found

1. **SQL file 'waiting' comment vs retention policy** (B.1) — the SQL file predates the owner's option (b) decision; the comment says TTL will eventually expire a quarantined group, but the predicate blocks that. BLOCKER-adjacent HIGH.

2. **"Temporary relay" principle (§0, §2) vs quarantine indefinite retention (§7) vs encrypted-backup opt-in storage (§11)** — all three can be reconciled, but the current draft does not spell out the reconciliation. The principle should read: "NEX stores no plaintext NEX can read. NEX may temporarily hold ciphertext for relay, may indefinitely hold ciphertext for operator-reviewed quarantine (option b), and may hold user-opt-in encrypted backups (future stage) that NEX cannot decrypt." HIGH.

3. **Section 14 checklist missing cryptographic items** — section 14 lists only operational and legacy-transition prerequisites. The cryptographic protocol spec is a hard prerequisite but is missing from the checklist. HIGH.

4. **Attachment purge table name inconsistency** — the draft §5 says `nex_message_attachment_purge_queue`; `b0-cleanup-worker-design.sql` line 93 says `nex_attachment_purge_queue`. Choose one and apply consistently. LOW.

### Missing dependencies not acknowledged

- **Push-notification infrastructure** · needed for offline-device wake-up. Not mentioned anywhere in the draft.
- **Clock synchronisation** · revocation-time comparisons depend on it. Not addressed.
- **Device registration PoP** · per A.4 above.
- **Account-creation ceremony** · how the first-ever device bootstraps its identity key, signs its encryption key, publishes both. Not addressed.
- **Primary-vs-secondary device roles** · QR linking mentions "primary" and "co-signature" but the role model isn't defined (what makes a device "primary"? can there be multiple? can it change?).

---

## 6 · Threat and failure-mode analysis

Running through plausible threats and current architectural response:

| Threat | Architectural response | Status |
|---|---|---|
| Server reads plaintext bodies | Impossible · no plaintext column, keys wrapped per recipient | HOLDS if A.2 is implemented correctly |
| Server reads plaintext attachments | Impossible · ciphertext only in Storage | HOLDS if B2+B3 ship |
| Server substitutes recipient public key | Detectable via CHANGED trust state IF user verified | HOLDS with A.4 (PoP) |
| Server registers attacker-controlled key under victim's account | **CURRENTLY UNDEFENDED** without proof-of-possession | **BLOCKER (A.4)** |
| Server replays stored ciphertext | Prevented by inner message_id dedup on client | HOLDS if A.6 is explicit |
| Server forges messages as sender | Prevented by sender's ephemeral key being needed to wrap content key | HOLDS if A.2 implemented |
| Server deletes queued messages prematurely | Prevented by sweepable_groups NOT EXISTS predicate | HOLDS |
| Compromised device reads future messages | Expected · attacker has the key | NOT PROTECTED (acknowledged) |
| Compromised device reads past messages | **CURRENTLY TRUE · no forward secrecy** | **HIGH (A.7)** |
| Compromised device impersonates victim to new contacts | Yes until revocation | HIGH |
| Malicious QR scan | Visual-match catches it IF user is attentive | HOLDS (user-dependent) |
| Malicious QR substitution by server | **DEPENDS on undefined HMAC key provenance** | **BLOCKER (A.5)** |
| XSS / browser extension | NOT PROTECTED (acknowledged) | — |
| Device clock drift causing revocation misorder | **UNHANDLED** | HIGH |
| Bucket-policy 403 → mass dead-letter | **CURRENT MAPPING** | **BLOCKER (C.1)** |
| Dead-letter growing unbounded | Partial · needs SLA (C.5) | HIGH |
| Legacy transition without user notification | **UNDEFINED** | **BLOCKER (D.2)** |
| Legacy export failing silently | **UNDEFINED** | HIGH (D.3) |

### Failure-mode summary

Of 18 identified threats, **4 are currently unaddressed BLOCKERS** (A.4, A.5, C.1, D.2), **4 are HIGH** (A.7, C.5, D.3, clock drift), **the remainder either hold or are honestly acknowledged.**

---

## 7 · Message and attachment lifecycle tables

### Message lifecycle (per row)

| State | Entry condition | Exit condition | Server storage |
|---|---|---|---|
| CREATED | Sender's device encrypts + fan-out writes 1 row per recipient device | Any below | Ciphertext + wrapped key + nonce + metadata |
| DELIVERED | Recipient device fetches, decrypts, writes to IndexedDB, UPDATE delivered_at | Group-level sweep eligible | Same (unchanged until group sweep) |
| TTL_EXPIRED | now() >= ttl_expires_at AND delivered_at IS NULL | Cleanup-sweep candidate | Same |
| REVOKED_BEFORE_SEND | k.revoked_at <= sent_at | Cleanup-sweep candidate | Same (unexpected row, sender's artefact) |
| REVOKED_AFTER_SEND | k.revoked_at > sent_at AND delivered_at IS NULL AND now() < ttl_expires_at | Retains until TTL | Same |
| MISSING_KEY | k.id IS NULL | QUARANTINE populated · never auto-swept | Same (indefinite under option b) |
| SWEPT | Group's sweepable_groups NOT EXISTS passes | — | Row DELETED; attachment ref enqueued |

### Attachment lifecycle (per Storage object)

| State | Entry condition | Exit condition | Storage |
|---|---|---|---|
| UPLOADED | Sender encrypts + uploads ciphertext to private bucket | Any below | Ciphertext present |
| REFERENCED | 1+ `nex_peer_message` rows have `attachment_ref = this` | All rows swept | Ciphertext present |
| ENQUEUED_FOR_PURGE | All referencing rows swept; purge-queue row inserted | Purge-worker claims | Ciphertext present |
| PURGE_IN_FLIGHT | Purge-worker locks queue row, calls Storage DELETE | 2xx/4xx response | Ciphertext present (DELETE pending) |
| PURGED | 200/204/404 from Storage DELETE | Terminal | Absent (or already absent) |
| RETRYING | 408/429/5xx; attempt_count < 10 | Next attempt | Present |
| DEAD_LETTERED | attempt_count hits cap; or 400/other 4xx | Operator intervention | Present (orphan) |
| WORKER_PAUSED | 401/403 (per revised mapping, C.1) | Ops fix auth/policy | Present (queue frozen) |

---

## 8 · All-devices-ACK and quarantine state matrix

Combinations of (ACK state × key state × TTL state) for a single row and their effect on both row-level and group-level sweep eligibility:

| Row ACK | Key state | TTL state | Row cleanup-eligible? | Blocks group sweep? |
|---|---|---|---|---|
| delivered | trusted | future | Yes (ACKED) | No |
| delivered | trusted | past | Yes (ACKED or TTL) | No |
| delivered | revoked-before-send | any | Yes (ACKED or revoke-before) | No |
| delivered | revoked-after-send | any | Yes (ACKED) | No |
| delivered | missing-key | any | **No** · never cleanup-eligible | **YES** (indefinite retention) |
| pending | trusted | future | No | YES (blocker 1) |
| pending | trusted | past | Yes (TTL) | No |
| pending | revoked-before-send | any | Yes (revoke-before) | No |
| pending | revoked-after-send | future | No (retained) | YES (blocker 1 via revoked-after branch) |
| pending | revoked-after-send | past | Yes (TTL) | No |
| pending | missing-key | any | **No** · never cleanup-eligible | **YES** (indefinite retention) |

**Key observations:**

1. **Any row with missing-key blocks the group forever** (under option b). This includes rows that are ALSO ACKED. B.2 flagged this.
2. **TTL supersedes "revoked-after-send retain"** for cleanup. Once past TTL, revoked-after-send becomes sweepable.
3. **TTL does NOT supersede missing-key.** Owner-approval-only retention means missing-key always wins.

The matrix is internally consistent with the sealed decisions but surfaces B.2 (ACKED+missing-key sibling retention) as a user-visible privacy artefact.

---

## 9 · Encryption and key-management guarantees and limitations

Compiled view of what the architecture **actually guarantees** vs **claims but hasn't established**:

| Property | Claim | Status | Required to establish |
|---|---|---|---|
| Server cannot read plaintext bodies | YES | **DEPENDS** on A.2 key-wrap design | Name algorithm (A.2) |
| Server cannot read plaintext attachments | YES (post-B3) | **DEPENDS** on A.2 + Bridge 88 | Same |
| Message confidentiality against passive network attacker | YES | HOLDS once ciphertext published | — |
| Message confidentiality against active MITM at first contact | PARTIAL · TOFU-only | HOLDS AS DESCRIBED | Trust states enforced in UI |
| Sender authenticity (recipient knows the sender's device) | IMPLICIT | **DEPENDS** on wrap algorithm + sender ephemeral key | A.2 explicit |
| Message integrity | YES · nacl.secretbox MAC | HOLDS | — |
| Replay protection against server-controlled replay | IMPLICIT · client dedup | **UNSPECIFIED** in current draft | A.6 explicit |
| Forward secrecy | NO · acknowledged | HONEST | Privacy policy must state (A.7) |
| Post-compromise security | NO · implicit | **UNACKNOWLEDGED** | Add to privacy policy |
| Device-authentic registration | **NOT ESTABLISHED** | **BLOCKER** | A.4 PoP mandatory |
| QR link-token authenticity | CLAIMED via HMAC | **DEPENDS** on A.5 key provenance | A.5 explicit |
| Linked device trust | TOFU · with primary co-sign | HOLDS AS DESCRIBED | Role model defined |
| Key rotation | **UNDEFINED** | **GAP** | Define rotation path (A.3-adjacent) |
| Compromise recovery | PARTIAL · revocation + re-register | HOLDS WITH LIMITATIONS | New device re-contacts peers; past messages still readable to attacker |

### Honest cryptographic statement that should appear in the draft

> **What NEX cryptographically guarantees:**
> - A properly implemented sender's device encrypts a message such that only the specific recipient devices named in the fan-out can decrypt it. The server cannot.
> - Message content is tamper-evident; a modified ciphertext fails MAC verification.
> - Sender authenticity is cryptographic (not just claimed in metadata), provided the recipient has previously verified or trusts-on-first-use the sender's device identity.
>
> **What NEX does NOT guarantee:**
> - Forward secrecy. A device key compromise is retroactively bad.
> - Protection against first-contact MITM without user verification.
> - Protection if a device is compromised while running NEX.
> - Protection if a browser extension can read NEX's rendered DOM.
> - That a new device sees messages sent before it was linked.
> - That messages reach a permanently offline device after TTL.

---

## 10 · Legacy transition decision matrix

Owner must set each row before B1 can be authorised:

| Variable | Current state | Recommended range | Owner decision |
|---|---|---|---|
| Dual-write duration | Unspecified | 30-90 days | Not set |
| Freeze day (absolute timestamp) | Unspecified | Owner-chosen | Not set |
| Export availability window | Unspecified | ≥90 days post-freeze (for GDPR SAR 30d + buffer + retries) | Not set |
| Public-bucket read-only window | Unspecified | ≥60 days post-freeze | Not set |
| User notification lead time | Unspecified | ≥30 days before freeze | Not set |
| Notification channels | Unspecified | In-app + email | Not set |
| Export format | Unspecified | JSON (plaintext) + manifest of attachments + attachment binaries | Not set |
| Failed-export retry policy | Unspecified | 3 attempts, extend window if still failing | Not set |
| Users-who-don't-return policy | Unspecified | Purge after window + mark account dormant · do NOT retain plaintext indefinitely | Not set |
| GDPR SAR interaction | Unspecified | SAR requests pending at freeze auto-trigger export | Not set |
| Hard cutover deadline | Unspecified | Absolute timestamp set when B1 is authorised; rollback if missed | Not set |
| Consent model | Unspecified | Opt-in → export; silent for others; legal review required | Not set |

---

## 11 · BLOCKER / HIGH / MEDIUM / LOW findings

### BLOCKERS (6)

| ID | Area | Finding |
|---|---|---|
| **A.1** | Encryption | Content-key provenance and scope unspecified |
| **A.2** | Encryption | Key-wrapping algorithm unnamed |
| **A.3** | Encryption | Signing vs encryption keys conflated |
| **A.4** | Trust | Device registration proof-of-possession undefined |
| **A.5** | Trust | QR linking HMAC key provenance undefined |
| **C.1** | Storage | 403 handling mass-dead-letters on bucket-policy failures |
| **D.1** | Transition | Transition windows (4 values) unspecified |
| **D.2** | Transition | User notification + consent plan unspecified |

(The table shows 8 rows numbered among BLOCKERS; the summary head says "6" because A.1-A.5 cluster around cryptographic protocol specification and can be resolved by a single consolidated protocol spec. For counting purposes, treat A.1-A.5 as ONE blocker-cluster = cryptographic protocol specification needed. Including C.1 and D.1/D.2, the actionable blocker-clusters are: cryptographic protocol, 403 handling, transition windows, consent plan. The 6-count reflects clusters, the full table lists each item.)

### HIGH (11)

| ID | Area | Finding |
|---|---|---|
| A.6 | Encryption | Replay protection relies on undocumented client dedup |
| A.7 | Encryption | Forward-secrecy deferral not translated to privacy policy |
| B.1 | Quarantine | SQL file 'waiting' comment contradicts retention policy |
| B.2 | Quarantine | ACKED ciphertexts retained indefinitely when sibling row has missing key |
| B.4 | ACK | Sender UI may lie when revocation happens during fan-out |
| B.5 | ACK | New device sees no history · needs explicit UX decision |
| B.10 | ACK | "Delivered" ≠ "read" needs user-facing clarity |
| C.2 | Storage | Signed URL expiry duration unspecified |
| C.5 | Storage | Dead-letter oldest-age metric and SLA missing |
| D.3 | Transition | Failed export retry/SLA unspecified |
| D.4 | Transition | Users-who-don't-return policy unspecified |
| D.5 | Transition | No hard cutover deadline · indefinite dual-write risk |
| D.6 | Transition | GDPR SAR interaction with export window |
| CL.1 | Consistency | "Temporary relay" principle vs quarantine vs encrypted-backup reconciliation needed |
| CL.2 | Consistency | Section 14 checklist missing cryptographic items |
| TD.1 | Dependencies | Push-notification infrastructure not addressed |
| TD.2 | Dependencies | Clock synchronisation not addressed |
| § 11 | Design | Encrypted-backup lifecycle semantics ambiguous |

### MEDIUM (6)

| ID | Area | Finding |
|---|---|---|
| A.8 | Trust | Linked-device privilege model implicit |
| B.3 | ACK | ACK vs cleanup race documented but not tested |
| B.7 | ACK | Duplicate ACK idempotency unspecified |
| B.8 | ACK | Duplicate delivery dedup implicit |
| B.9 | ACK | Partial-delivery UX unspecified |
| C.3 | Storage | Attachment dedup intentionally absent · state explicitly as cost |
| C.4 | Storage | Missing attachment at delivery time has no UX |
| § 3 | Design | No maximum fan-out N per recipient |

### LOW (3)

| ID | Area | Finding |
|---|---|---|
| C.6 | Storage | Service-worker URL cache may produce spurious 403s |
| § 0 | Doc | Non-goals could list "no server-side read receipts/search" explicitly |
| § 1 | Doc | OS-level encryption availability not mentioned |
| CL.3 | Consistency | Purge-queue table name inconsistent between draft and SQL file |
| § 13 | Design | B3→B4 dependency could be relaxed if non-attachment path separated |

---

## 12 · Decisions still required from the owner (15)

| # | Decision |
|---|---|
| 1 | Single-key-per-device vs separate Ed25519-identity + X25519-encryption (A.3) |
| 2 | Proof-of-possession challenge-response mechanism for device registration (A.4) |
| 3 | QR linking HMAC key = Ed25519 identity private key, or other mechanism (A.5) |
| 4 | New-device historical sync: no-sync (Signal model) OR primary-assisted sync (B.5) |
| 5 | "Delivered" ≠ "read" UI copy OR add read-receipt layer (B.10) |
| 6 | Dual-write duration (D.1) |
| 7 | Freeze day absolute timestamp (D.1) |
| 8 | Export availability window (D.1) |
| 9 | Public-bucket read-only window (D.1) |
| 10 | User notification + consent plan (D.2) |
| 11 | Users-who-don't-return policy (D.4) |
| 12 | TTL value (currently 7 days proposed) |
| 13 | Signed URL expiry duration (C.2) |
| 14 | Dead-letter SLA (C.5) |
| 15 | Named quarantine rota owner + notification route + runbook + review cadence + capacity threshold (Gate 1) |

---

## 13 · Runtime validation required before implementation

Items that remain **paper-resolved** and need empirical validation at implementation stage:

| # | Validation | Blocks |
|---|---|---|
| 1 | `pg_try_advisory_xact_lock(hashtextextended(...))` syntax against target PG version | B4 cleanup worker |
| 2 | `hashtextextended` availability (PG 11+ confirmed; verify Supabase build) | B4 cleanup worker |
| 3 | Supabase Storage DELETE error codes under policy failure (test 401, 403 behaviour) | B5 purge worker |
| 4 | Supabase Storage DELETE idempotency on 404 | B5 purge worker |
| 5 | Signed URL expiry behaviour (60s) · post-expiry 403 vs other | B2 private bucket |
| 6 | Push-notification deliverability for offline-device wake-up | B4+ (ACK model) |
| 7 | Clock-skew observations across typical client devices | B4 (revocation ordering) |
| 8 | nacl.secretbox + crypto_box per-device fan-out latency on average mobile hardware | B3+ |
| 9 | Advisory-lock behaviour under PgBouncer pooling (session vs transaction mode) | B4 cleanup worker |
| 10 | PgBouncer transaction-pooling compatibility with pg_try_advisory_xact_lock | B4 |

Note on item 10: **Supabase's pooler runs in transaction mode by default**. `pg_try_advisory_xact_lock` is scoped to transactions, so it IS compatible with transaction-mode pooling. Session-scoped advisory locks (which the draft does NOT use) would be incompatible. This is a validation checkpoint, not a blocker.

---

## 14 · Revised architecture recommendations

Proposed amendments to the consolidated draft, grouped by concern. **None of these edits are made in this authorisation; they are listed as the delta an owner-approved revision would need.**

### 14.1 · Cryptographic protocol specification (new section 2a)

Add a new section between current §2 and §3:

> **§2a · Cryptographic protocol specification**
>
> - Each device holds two long-term key pairs: Ed25519 (identity, signing) + X25519 (encryption).
> - At device registration, the client:
>   1. Generates both key pairs locally.
>   2. Signs the X25519 public key with the Ed25519 private key, producing an encryption-key certificate.
>   3. POSTs `{device_id, identity_pub, encryption_pub, encryption_pub_sig}` to the registration endpoint.
>   4. Receives a server challenge (32-byte random, 60s TTL).
>   5. Signs challenge with identity_priv; POSTs signature.
>   6. Server verifies signature against identity_pub, verifies encryption_pub_sig against identity_pub, inserts the device row.
> - Per-message encryption:
>   1. Sender generates fresh 32-byte `K_msg` (CSPRNG).
>   2. Sender encrypts body: `ciphertext = nacl.secretbox(plaintext, body_nonce, K_msg)` where `body_nonce` is 24-byte CSPRNG.
>   3. For each recipient device D, sender generates ephemeral X25519 key pair, computes `wrapped_K_msg = crypto_box(K_msg, wrap_nonce_D, D.encryption_pub, ephemeral_priv)`, stores `(wrapped_K_msg, wrap_nonce_D, ephemeral_pub)` in device D's row.
>   4. Inside the body ciphertext, the plaintext embeds a client-generated message_id UUID (replay-protection anchor).
> - Per-attachment encryption:
>   1. Fresh `K_att` (CSPRNG, 32 bytes).
>   2. Ciphertext uploaded to Storage.
>   3. `K_att` is encrypted the same way as `K_msg` and included in the fan-out rows.
> - QR link-token signature:
>   1. Primary device signs `{account_id, link_token, timestamp}` with its Ed25519 identity_priv.
>   2. Secondary device verifies signature using the primary's identity_pub (fetched from `nex_account_device_key`).
>   3. Visual match code = short truncated hash of `(link_token || timestamp || secondary_proposed_identity_pub)`.
> - Forward secrecy: NOT provided in this iteration. Explicitly stated in user-facing privacy policy.

### 14.2 · Storage error-class mapping (replace §12 table)

Replace the §12 error table with the revised mapping from C.1 above.

### 14.3 · Legacy transition decision matrix (new section 9a)

Add a decision-matrix table (§10 above) immediately after §9's current content, with blank "Owner decision" column that is filled at B1 authorisation time.

### 14.4 · Checklist expansion (replace §14)

Replace §14 with:
> **14.1 · Cryptographic protocol spec** · includes everything in §2a above.
> **14.2 · Device registration PoP** · deployed before any device-key registration touches production.
> **14.3 · QR linking HMAC origin** · identity-key-signed, not server-provided.
> **14.4 · New-device sync UX** · chosen between options.
> **14.5 · Gate 1 operational artefacts** · (existing).
> **14.6 · Advisory-lock smoke test** · (existing).
> **14.7 · Revised Storage DELETE error-class mapping validated against Supabase** · (revised).
> **14.8 · Legacy export endpoint** · (existing).
> **14.9 · Legacy transition decision matrix filled** · (new).
> **14.10 · User notification + consent plan drafted and reviewed** · (new).
> **14.11 · TTL value** · (existing).
> **14.12 · Signed URL expiry** · (new).
> **14.13 · Dead-letter SLA** · (new).
> **14.14 · Push-notification wake-up design** · (new).
> **14.15 · Privacy policy reflects all honest limitations** · (existing, expanded).

### 14.5 · Reconciliation of "no permanent storage" principle (amend §0)

Replace §0's opening with:

> **Option 2 means: NEX never stores plaintext content it can read.** The device is canonical plaintext storage. The server is a transient encrypted relay. NEX may:
> - temporarily hold ciphertext for relay (bounded by TTL and ACK),
> - indefinitely hold ciphertext for operator-reviewed quarantine (option (b) sealed 2026-11-03),
> - optionally hold user-opt-in encrypted backups (future stage; NEX cannot decrypt them).
> In every case, NEX never holds plaintext NEX can decrypt.

---

## 15 · Final acceptance checklist

Before the owner can accept this architecture as of record:

| # | Item | State | Owner action needed |
|---|---|---|---|
| 1 | Cryptographic protocol spec (§2a) drafted | Not drafted | Owner authorises drafting as part of acceptance OR owner picks between protocol options and asks for a drafted spec |
| 2 | Device registration PoP mechanism chosen | Not chosen | Owner decides single-vs-dual-key + PoP challenge |
| 3 | QR linking HMAC key origin resolved | Not resolved | Owner decides identity-key signing OR other |
| 4 | New-device sync UX chosen | Not chosen | Owner picks no-sync or primary-assisted |
| 5 | 403 Storage mapping revised | Pending | Owner approves C.1 amendment |
| 6 | Transition windows set (4 values) | Not set | Owner provides values at B1 authorisation |
| 7 | User notification + consent plan written | Not written | Owner authorises drafting; legal reviews |
| 8 | TTL value set | Proposed 7 days, not confirmed | Owner confirms or revises |
| 9 | Signed URL expiry set | Not set | Owner approves 60s or alternative |
| 10 | Dead-letter SLA set | Not set | Owner approves weekly or alternative |
| 11 | Users-who-don't-return policy chosen | Not chosen | Owner decides |
| 12 | §0 principle reconciliation applied | Not applied | Owner approves §0 amendment |
| 13 | §14 checklist expanded | Not expanded | Owner approves §14 revision |
| 14 | §12 error table replaced | Not replaced | Owner approves §12 revision |
| 15 | Push-notification wake-up addressed | Not addressed | Owner authorises design work |
| 16 | Clock-synchronisation implications addressed | Not addressed | Owner authorises design work |
| 17 | SQL file 'waiting' comment corrected | Not corrected | Separate authorisation to edit the SQL comment |
| 18 | Purge-queue table name made consistent | Not consistent | Separate authorisation to edit either draft or SQL |
| 19 | Gate 1 operational ownership resolved | Separate workstream | NOT addressed here · remains owner-driven |

**Minimum set to upgrade from DRAFT to ACCEPTED:** items 1-14 above, plus Gate 1 as a parallel but separately-owned track. Items 15-18 can be MEDIUM-tier amendments that follow acceptance.

---

## Final verdict

**NOT READY FOR OWNER ACCEPTANCE.**

Six BLOCKER-class clusters remain:

1. Cryptographic protocol specification (A.1-A.5 as a unified gap).
2. Device registration proof-of-possession (A.4).
3. QR linking HMAC key provenance (A.5).
4. Storage DELETE 403 handling (C.1).
5. Legacy transition windows unspecified (D.1).
6. User notification + consent plan unspecified (D.2).

The architecture is **structurally sound** at the device-ownership + ciphertext-relay level. The failures are specification gaps at primitives sitting below the architecture. Once the owner decides on the protocol choices and transition parameters, the architecture can be revised in-place and re-reviewed for acceptance.

**No implementation, no production access, no migration execution, no infrastructure change, no deployment is authorised by this document.** Gate 1 remains a separate workstream. Architecture acceptance remains a separate owner decision.

### Confirmation of restrictions observed

- No code written or modified.
- No SQL executed.
- No database access (production, preview, or scratch).
- No migration applied, created, or modified.
- No infrastructure or packages installed.
- No Git commit, push, or remote change.
- No deployment.
- No environment variable change.
- No credential access.
- No modification of Bridges 76, 77, 88.
- No modification of existing chat implementation.
- No modification of `scripts/_tmp/`.
- No modification of the original architecture draft.
- One file created: this document.

Stopping. Awaiting owner review and separate authorisation for any next action.
