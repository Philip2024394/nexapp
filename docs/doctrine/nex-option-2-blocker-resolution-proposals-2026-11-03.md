# NEX Option 2 · Blocker Resolution Proposals · 2026-11-03

**Status:** DRAFT · proposed technical solutions · NOT AUTHORISED FOR IMPLEMENTATION.
**Scope:** Step 1 of the owner-authorised two-step design exercise. Addresses the six BLOCKER clusters identified in `nex-option-2-architecture-challenge-2026-11-03.md`. Companion document: `nex-option-2-owner-decision-register-2026-11-03.md`.

## Preservation of locked principles

Every proposal below preserves all seven locked principles:

1. Device-local history remains canonical.
2. NEX remains a temporary encrypted relay.
3. All intended recipient devices ACK before normal group deletion.
4. Missing keys trigger quarantine, not automatic deletion.
5. Quarantine retention remains owner-approval-only.
6. No permanent server-side chat history.
7. No automatic fallback to plaintext.

No proposal weakens these. Where tension exists, it is identified explicitly rather than resolved by softening a principle.

---

## BLOCKER 1 · Cryptographic protocol

### Design proposal · dual-key device identity + per-message content key + ephemeral X25519 wrap

#### Keys held by each device

Each registered device holds **two independent long-term key pairs**, both generated client-side at device-registration time via libsodium.js (WASM-backed) or WebCrypto:

| Pair | Algorithm | Private key location | Role |
|---|---|---|---|
| Identity | Ed25519 | IndexedDB (`nex-native-crypto`, non-exportable per browser capability) | Signs challenges, QR link-tokens, device-key certificates, (optionally) messages |
| Encryption | X25519 | IndexedDB (same store) | Target of asymmetric key-wrap operations from senders |

Rationale for separation (vs single key): same key used for both signing and ECDH is a well-documented anti-pattern. Separate keys allow independent rotation and clearer semantic boundaries. The X25519 encryption key may be rotated without breaking identity continuity.

#### Device-key certificate

At registration, the client signs a certificate binding its encryption key to its identity:

```
cert_bytes = device_id || encryption_pub || created_at
encryption_cert = Ed25519-sign(cert_bytes, identity_priv)
```

The server stores all four (identity_pub, encryption_pub, created_at, encryption_cert) in `nex_account_device_key`. Peers fetching the row can verify locally that encryption_pub was authorised by identity_pub. This is the primitive that lets peers detect substitution by the server even if they haven't completed full safety-number verification.

**Schema delta (design-only · requires migration later):**
- `identity_public_key text NOT NULL` · 32-byte Ed25519 pub, base64
- `encryption_public_key text NOT NULL` · 32-byte X25519 pub, base64
- `encryption_cert text NOT NULL` · 64-byte Ed25519 signature, base64
- `created_at timestamptz NOT NULL`

Replaces the current single `public_key` column.

#### Per-message encryption

For each outbound message:

1. **Generate content key.** `K_msg ← libsodium.randombytes_buf(32)` · fresh 32-byte CSPRNG value, never reused.
2. **Generate body nonce.** `body_nonce ← libsodium.randombytes_buf(24)` · fresh per encryption, never reused with same key.
3. **Build plaintext envelope.** Before encryption, the plaintext body is wrapped in an envelope:
   ```
   envelope = {
     message_id: UUID,              -- client-generated, embedded for replay protection
     sender_account_id: UUID,
     sender_device_id: text,
     sender_identity_pub_fp: text,  -- 8-byte truncated SHA-256 fingerprint
     body: text,
     attachment_ref: UUID | null,
     sent_at_client: timestamptz,
   }
   envelope_bytes = CBOR.encode(envelope)
   ```
   The `message_id` and `sender_identity_pub_fp` inside the envelope let the recipient dedup and authenticate the sender without trusting the server-visible row metadata.
4. **Encrypt body.** `ciphertext_body = libsodium.crypto_secretbox_easy(envelope_bytes, body_nonce, K_msg)`.
5. **Fan-out · wrap K_msg for each recipient device.** For each recipient device D (fetched from `nex_account_device_key` filtered to non-revoked, keyed by `(recipient_account_id, device_id)`):
   - Generate ephemeral X25519 keypair: `(ephem_priv_D, ephem_pub_D) = libsodium.crypto_box_keypair()`.
   - Generate wrap nonce: `wrap_nonce_D ← libsodium.randombytes_buf(24)`.
   - Wrap K_msg: `wrapped_K_msg_D = libsodium.crypto_box_easy(K_msg, wrap_nonce_D, D.encryption_pub, ephem_priv_D)`.
   - Immediately zero ephem_priv_D in client memory.
   - Store in device D's row: `(ciphertext_body, body_nonce, wrapped_K_msg_D, wrap_nonce_D, ephem_pub_D)`.
6. **(Optional) Sender signature.** Sender signs the server-visible metadata as a sender-authenticity anchor:
   ```
   sig_payload = sha256(ciphertext_body || attachment_ref || sent_at)
   sender_sig = Ed25519-sign(sig_payload, sender_identity_priv)
   ```
   Stored on each fan-out row. Recipients verify against sender's identity_pub (which they fetch using the sender_identity_pub_fp inside the envelope · chicken-and-egg solved by cross-referencing).

**⚠ RETRACTED 2026-11-03.** The following paragraph overstated the security benefit. The ephemeral-X25519 deletion does NOT provide meaningful forward secrecy because the recipient's long-term `encryption_priv` is a sufficient decryption authority on its own path. See `nex-option-2-decision-register-reconciliation-2026-11-03.md` §2 for the full re-analysis and corrected statement, and `nex-option-2-founder-decisions-consolidated-2026-11-03.md` for the founder's direction (D20 · adopt a proven forward-secret protocol such as Double Ratchet in the initial design, do not launch with the static-wrap design, no proprietary cryptographic invention). Retained below only for traceability.

~~Note on ephemeral keys: because `ephem_priv_D` is deleted immediately after wrap, retroactive compromise of the sender's long-term keys does NOT allow re-derivation of K_msg from `(wrapped_K_msg_D, ephem_pub_D)`. This gives **one-sided forward secrecy on the sender side**. The recipient side has no FS until Double Ratchet lands (deferred).~~

#### Per-attachment encryption

Identical pattern with a separate `K_att`:

1. `K_att ← libsodium.randombytes_buf(32)` · fresh per attachment.
2. `att_nonce ← libsodium.randombytes_buf(24)`.
3. `ciphertext_att = libsodium.crypto_secretbox_easy(binary, att_nonce, K_att)`.
4. Upload ciphertext_att to Supabase Storage (private bucket, service-role gated).
5. For each recipient device D, wrap K_att using the same `crypto_box_easy` pattern. The wrapped K_att is stored INSIDE the message envelope (encrypted with K_msg), not as a separate server field. This keeps the attachment key confidential to recipient devices even if the ciphertext_body is somehow leaked without K_msg.

#### Reception

Recipient device D:

1. Fetches its `nex_peer_message` row.
2. Reads `(ciphertext_body, body_nonce, wrapped_K_msg_D, wrap_nonce_D, ephem_pub_D, sender_sig)`.
3. Unwraps: `K_msg = libsodium.crypto_box_open_easy(wrapped_K_msg_D, wrap_nonce_D, ephem_pub_D, D.encryption_priv)`.
4. Decrypts body: `envelope_bytes = libsodium.crypto_secretbox_open_easy(ciphertext_body, body_nonce, K_msg)`.
5. Parses `envelope`.
6. **Replay check.** Looks up `envelope.message_id` in local IndexedDB `messages` store. If present → silently drop (replay attempt).
7. **Sender identity check.** Fetches sender's device-key row (keyed by `envelope.sender_account_id` + `envelope.sender_device_id`), verifies `sender_identity_pub_fp` matches, verifies `sender_sig` against sender's identity_pub.
8. **Trust-state evaluation.** Compares sender's identity_pub against local `trusted_contacts` record (see BLOCKER 3). If this is first contact → UNVERIFIED. If identity_pub matches a known VERIFIED device → VERIFIED. If identity_pub differs from a previously-seen device_id → CHANGED. If a brand-new device_id for a known contact → NEW DEVICE.
9. Writes plaintext to IndexedDB `messages` store (keyed by `envelope.message_id`).
10. ACKs via `UPDATE nex_peer_message SET delivered_at = COALESCE(delivered_at, now()) WHERE id = <row_id>`.

#### Key rotation

**Encryption-key rotation (routine):**
- Device generates new X25519 keypair.
- Signs new encryption_pub using existing identity_priv → new encryption_cert.
- Updates its row in `nex_account_device_key` (via authenticated endpoint).
- Peers continue to trust the device (same identity_pub); the trust-state does NOT change to CHANGED because CHANGED is defined against identity_pub, not encryption_pub.

**Identity-key rotation:** NOT supported in this iteration. A device wanting to replace its identity_priv must register as a new device. Rationale: identity is the trust anchor; rotating it invalidates all previously-established verification. If identity rotation becomes required, it is a separate design.

#### Compromised-key recovery

**Encryption-key compromise:**
- User triggers encryption-key rotation (above).
- Past messages encrypted to the compromised encryption_pub remain decryptable by the attacker (no forward secrecy on recipient side).
- Future messages encrypted to the new encryption_pub are safe.

**Identity-key compromise:**
- User revokes the device entirely (`revoked_at = now()`).
- Attacker can no longer sign new QR link-tokens, challenges, or messages as that device.
- Past messages signed by the compromised identity_priv remain cryptographically valid but are known to be unreliable; peers who see CHANGED trust-state on this device must re-verify.
- User registers a replacement device · peers see NEW DEVICE.

**Full session compromise:** handled under BLOCKER 2 (PoP + confirmation + audit).

#### Device revocation

Already specified in draft §4. Preserved. The addition under this proposal: revocation also invalidates any cached trusted-state at peers once they fetch the updated device-key list.

#### Replay protection

The server CAN replay stored ciphertext rows. Recipient-side defence:
- `envelope.message_id` is embedded INSIDE the ciphertext (sender-chosen UUID).
- Recipient device's IndexedDB `messages` store is keyed by `message_id`.
- A duplicate `message_id` on fetch = silent drop.

The server CANNOT forge a new `message_id` because that requires knowledge of `K_msg`, which the server does not possess.

#### Forward secrecy and post-compromise security

> **⚠ SUPERSEDED 2026-11-03.** The "PARTIAL · sender-side forward secrecy" characterisation below was retracted. The ephemeral-X25519 deletion provides no meaningful forward-secrecy guarantee because the recipient's long-term private key is a sufficient decryption authority. **Corrected statement:** this static-wrap design provides NO forward secrecy and NO post-compromise security. Compromise of a recipient device's long-term `encryption_priv` at any future time allows decryption of ALL past messages ever encrypted to that key. True forward secrecy requires a key-ratcheting construction (e.g., Double Ratchet). The founder's direction (D20 in `nex-option-2-founder-decisions-consolidated-2026-11-03.md`) is to adopt a proven forward-secret protocol in the initial design and NOT launch with the static-wrap design shown in this blocker proposal. See `nex-option-2-decision-register-reconciliation-2026-11-03.md` §2 for the full re-analysis. Retained below only for traceability.

~~**Forward secrecy:** PARTIAL.~~
- ~~Sender-side: `ephem_priv_D` is deleted after wrap, so retroactive compromise of sender's long-term keys does NOT allow decryption of past wrapped K_msg values from stored `(ephem_pub_D, wrapped_K_msg_D)`.~~
- Recipient-side: NO forward secrecy. Compromise of recipient's `encryption_priv` allows decryption of all past messages wrapped to that key.

**Post-compromise security:** NONE. Once a device's identity_priv or encryption_priv is compromised, the attacker reads everything sent to that device until revocation.

**Full forward secrecy + post-compromise security** requires Double Ratchet (Signal-style). ~~Explicitly deferred to a future stage.~~ **Founder has approved including it in the initial design · see D20.** The privacy-policy copy under BLOCKER 6 must state the current limitation until the ratchet lands.

#### Multi-device implications

- Each device holds its OWN identity + encryption pair. No shared key material between devices in the same account.
- An account's "identity" is the SET of its device identities. Verifying one device verifies that device only; peers see NEW DEVICE when a second device joins.
- Account-level identity rotation = independent re-key of every device. Not supported in this iteration.

#### Mobile performance and browser compatibility

- libsodium.js runs on WASM in modern browsers (Chrome, Safari, Firefox, Edge · all current versions).
- Ed25519 sign/verify ≈ 2000 ops/sec on mid-range mobile (ARM Cortex-A55 class).
- X25519 ECDH ≈ 5000 ops/sec on same hardware.
- `crypto_secretbox_easy` ≈ 100 MB/sec on same hardware.
- All crypto runs in a dedicated Web Worker to keep the main thread free.
- Fan-out cost per message: N × (one Ed25519 sign + one X25519 ephemeral keygen + one `crypto_box_easy` wrap) ≈ N × 1 ms for small N. For N=3 devices: ~3 ms. Acceptable.

#### Established vs required cryptographic properties

| Property | Status under this proposal |
|---|---|
| Confidentiality against server | ESTABLISHED by crypto_box recipient-public-key wrap |
| Message integrity | ESTABLISHED by crypto_secretbox MAC |
| Sender authentication (cryptographic) | ESTABLISHED by Ed25519 sender signature (if included) + wrap-algorithm properties |
| Replay protection | ESTABLISHED by sender-chosen message_id embedded in envelope |
| Partial forward secrecy (sender-side) | ESTABLISHED by ephemeral X25519 at wrap |
| Full forward secrecy | NOT ESTABLISHED · requires Double Ratchet (deferred) |
| Post-compromise security | NOT ESTABLISHED · requires Double Ratchet (deferred) |
| Device-identity authenticity at registration | REQUIRES BLOCKER 2 proof-of-possession |
| Device-identity authenticity on QR link | REQUIRES BLOCKER 3 QR flow |

### Failure cases and unresolved questions

- **Private-key extraction from IndexedDB.** Browsers do not provide hardware-backed private key storage for arbitrary applications. A browser extension or malicious injected script can read IndexedDB. Mitigation: WebAuthn-backed key wrap is a future consideration; not in this iteration.
- **CBOR library choice.** `envelope_bytes` encoding needs a stable, well-reviewed CBOR implementation. If none is suitable, substitute canonicalised JSON with explicit field ordering.
- **sender_sig cost.** Signing every message adds work on sender's side. Owner may decide to make sender_sig optional (then envelope.sender_identity_pub_fp is still used to help recipient-side trust evaluation but authenticity rests on the wrap primitives alone).
- **Open sub-decision for the owner:** include sender_sig per message (recommended) OR omit it to save CPU.

### Required follow-on specifications before implementation

1. Full byte-level wire format for `envelope`, `cert_bytes`, `sig_payload` with canonicalisation rules.
2. Error codes for all unwrap/decrypt/signature-verify failures.
3. Behaviour on malformed envelope (silently drop vs error log).
4. Device-key rotation server endpoint design.

---

## BLOCKER 2 · Device registration proof-of-possession

### Design proposal · challenge-response + primary-device confirmation + audit

#### Registration flow for the FIRST-EVER device on an account

Scenario: user has just completed account signup. No existing devices.

1. Client generates identity + encryption keypairs locally.
2. Client signs encryption_pub with identity_priv → `encryption_cert`.
3. Client POSTs `/device-registration/initiate` with authenticated session + `{device_id, identity_pub, encryption_pub, encryption_cert, created_at}`.
4. Server validates session, verifies `encryption_cert` against identity_pub, inserts PENDING row with 60-second expiry.
5. Server returns `{registration_token, challenge: 32-byte random}`.
6. Client computes `challenge_sig = Ed25519-sign(challenge || device_id || account_id, identity_priv)`.
7. Client POSTs `/device-registration/complete` with `{registration_token, challenge_sig}`.
8. Server verifies `challenge_sig` against identity_pub. If valid: flips PENDING → ACTIVE in `nex_account_device_key`. Emits `nex_action_log` entry `kind='device_registered'` with `is_first_device=true`.
9. Server sends email notification (if email on file): "A device was registered on your account at {time} from {approx location}. If this wasn't you, contact support."

For the FIRST-EVER device, there is no existing device to confirm. This is unavoidable; the first device is the trust bootstrap. Mitigations are limited to session authentication strength + email notification.

#### Registration flow for SUBSEQUENT devices

Scenario: account has 1+ active devices. User wants to add another.

Two paths:

**Path A · QR linking (recommended; see BLOCKER 3).** The new device joins via out-of-band physical confirmation on an existing device.

**Path B · Challenge-response + primary-device confirmation (if QR is unavailable, e.g., user has lost scanning capability).**

1. Steps 1-5 identical to first-device flow.
2. Server does NOT flip PENDING → ACTIVE on completion. Instead, server:
   - Emits a push notification to all currently-active devices on the account: "A new device is trying to register. Open the app to approve or deny."
   - Keeps the PENDING row for 10 minutes.
   - Returns `{registration_token, confirmation_pending: true}` to the new device, which displays "Waiting for approval from your other device(s)".
3. User opens an existing active device, sees the pending registration, taps "Approve" or "Deny".
4. **If Approve:** the existing device signs `{approve, pending_registration_id, pending_identity_pub}` with its own identity_priv → `approval_sig`. POSTs to `/device-registration/confirm`.
5. Server verifies `approval_sig` against the approving device's identity_pub. Flips PENDING → ACTIVE. Emits `nex_action_log` entry `kind='device_registration_confirmed'` with `approver_device_id`.
6. **If Deny:** approving device POSTs to `/device-registration/deny`. Server DELETEs the PENDING row. Emits `nex_action_log` entry `kind='device_registration_denied'`.
7. **If no response within 10 minutes:** server DELETEs the PENDING row. New device sees "Timed out, please try again from your other device."

#### Honest limit · fully-compromised session

An attacker with the user's authenticated session CAN:

- POST `/device-registration/initiate` with their own keypair.
- Successfully complete `/device-registration/complete` with their own `challenge_sig` (they hold the matching identity_priv because they generated it).

PoP alone proves "client controls the key being registered" · it does NOT prove "the client controls the account owner's intent".

**Mitigations under this proposal:**

1. **Primary-device confirmation blocks silent registration** when the account already has an active device. The attacker's registration lands in PENDING and the real user sees it on their legitimate device within 10 minutes. User denies. Attacker gets nothing.
2. **Email + push notification per registration** so even if the user misses the in-app prompt, they are notified out-of-band.
3. **Audit log entry** `kind='device_registered'` surfaces in the user's security settings page. User can revoke any device they don't recognise.
4. **Rate limiting on registration endpoints** (3 attempts per hour per account) blunts automated attacks.

For the FIRST-EVER device, these mitigations don't apply · the first device IS the trust bootstrap. The owner must accept this as the one unavoidable TOFU moment per account.

#### When the original device is unavailable (account recovery)

Scenario: user has lost all previously-active devices. No existing device can sign a confirmation. User wants to add a new device.

Options:

**Option X · No account recovery (strict).**
- User cannot add a new device.
- Must create a new account.
- Preserves cryptographic trust but destroys continuity.

**Option Y · Soft recovery via identity provider.**
- User authenticates via NEX's sealed face-sign-in (WebAuthn 2026-10-23) + email.
- A "recovery device" is registered WITHOUT a confirmation from a prior device.
- Server marks the device with `recovery_registered = true` and `trust_bootstrap_broken_at = now()`.
- **All peers** who have ever chatted with this account see a CHANGED trust-state on this account's device list from this moment forward.
- Peers must re-verify (safety numbers) before VERIFIED can be re-established.
- The user's own IndexedDB on the new device is EMPTY. No historical plaintext.
- An ongoing audit event is created, visible in both the user's and (via server-side notification) peers' trust histories.
- Maximum friction UI: multi-step consent screen explaining that peers will have to re-verify, that history is gone.

**Recommendation:** offer Option Y with the maximum-friction UI. Document that Option Y breaks the trust chain for all peer relationships and that past messages remain unreadable without an exported bundle. Owner decides.

#### Audit events

New `nex_action_log` kinds (not drafted here · requires separate authorisation):

- `device_registered` · fired on PENDING→ACTIVE transition. Fields: device_id, is_first_device, approver_device_id (null for first), source_ip, user_agent.
- `device_registration_denied` · fired on deny. Fields: device_id, denier_device_id.
- `device_registration_timeout` · fired on 10-minute PENDING expiry.
- `device_revoked` · fired on revocation. Fields: device_id, revoker_device_id (self or other), reason.
- `device_recovery_registered` · fired on Option Y path. Fields: device_id, recovery_method.

All events visible to the user in a Security tab.

### Failure cases and unresolved questions

- **Primary-device-approval push notification delivery.** If the user's existing device is offline, approval cannot happen. 10-minute timeout then applies. User retries later or uses Option Y. Not a security hole; a UX cost.
- **Clock-skew in challenge TTL.** 60-second challenge TTL assumes approximately synchronised clocks between client and server. Expected skew < 10s under NTP. If larger skew observed in telemetry, revisit TTL.
- **Email delivery for registration notification.** Depends on email infrastructure. Email is NOT part of cryptographic authentication; it's an awareness signal.
- **No defence against SIM swap + reset-email-via-SIM.** If the attacker controls the user's email, they can trigger Option Y recovery. This is out of scope for Option 2 architecture · it's an account-system concern that would need a separate design.

### Required follow-on specifications before implementation

1. Full `/device-registration/*` endpoint design with request/response schemas.
2. Push-notification payload format for approval prompt.
3. In-app "pending registrations" screen design.
4. Session-authentication strength requirements for Option Y.
5. Rate-limit policies.

---

## BLOCKER 3 · QR linking and trust bootstrap

### Design proposal · identity-signed QR + visual-match short code + four-state trust integration

#### Which device generates the QR

The **currently-active, user-authenticated primary device** generates the QR. "Primary" is any active device the user chooses to initiate linking from · the role is not persistent, it is per-ceremony.

#### QR payload

```
qr_payload = {
  v: 1,                              -- version
  account_id: UUID,
  link_token: 32-byte random,
  issued_at: timestamptz,
  primary_device_id: text,
  primary_identity_pub: 32-byte Ed25519 pub (base64),
  signature: Ed25519-sign(
    v || account_id || link_token || issued_at || primary_device_id || primary_identity_pub,
    primary_identity_priv
  )
}
```

Encoded as a compact binary (or base64 if QR size permits) and rendered as a QR with error-correction level M. Expires 60 seconds after `issued_at`.

#### How the QR is authenticated

The secondary device, after scanning, verifies `signature` against `primary_identity_pub`. This is TOFU for the primary-secondary pair at the moment of first scan: the secondary has no prior knowledge of `primary_identity_pub`, so it trusts the signature IFF the user confirms the visual-match short code (next step). The visual-match step is what prevents a MITM scenario where an attacker presents their own QR on a lookalike screen.

#### Secondary submits + server records pending link

1. Secondary scans + verifies signature.
2. Secondary POSTs `/device-link/initiate` with:
   ```
   {
     qr_payload (full, so server can also verify),
     secondary_device_id,
     secondary_identity_pub,
     secondary_encryption_pub,
     secondary_encryption_cert
   }
   ```
3. Server verifies:
   - `qr_payload.signature` against `qr_payload.primary_identity_pub`.
   - `issued_at` is within last 60 seconds.
   - `link_token` has not been consumed before (dedup table).
   - `qr_payload.primary_identity_pub` matches the registered primary device.
   - `secondary_encryption_cert` is a valid Ed25519 signature of secondary_encryption_pub by secondary_identity_pub.
4. Server inserts PENDING_LINK row with 2-minute expiry. Returns `{link_pending_id, short_code}`.
5. Short code: `truncate(SHA-256(link_token || secondary_identity_pub || primary_identity_pub), 6 decimal digits)`.

#### Visual-match confirmation

Both primary and secondary devices display the same 6-digit short code. The primary derives it independently from the three inputs; the server never computes it. If an attacker substitutes `secondary_identity_pub` on the wire, the primary's derived short code will not match the secondary's displayed short code · user sees mismatch and aborts.

User-facing UI on both:
> "Compare these numbers on both devices:
> **4 1 7 — 2 8 9**
> If they match, tap Confirm. If they don't match, tap Reject · someone may be intercepting the link."

#### Primary confirms

On user tap:
1. Primary signs `{confirm, link_pending_id, secondary_device_id, secondary_identity_pub, secondary_encryption_pub, confirmed_at}` with `primary_identity_priv` → `primary_confirm_sig`.
2. POSTs `/device-link/confirm` with `{link_pending_id, primary_confirm_sig}`.
3. Server verifies `primary_confirm_sig` against primary_identity_pub.
4. Server activates the secondary device in `nex_account_device_key`:
   - Inserts row with full certificate chain + `linked_by_device_id = primary_device_id` + `linked_at = now()`.
   - Emits `nex_action_log kind='device_registration_confirmed'` with linking context.
5. Secondary device polls the server, receives activation, enters main app.

If user taps Reject on either device:
- POSTs `/device-link/deny`.
- Server DELETEs PENDING_LINK row + emits `nex_action_log kind='device_link_denied'`.
- Secondary device shows "Linking cancelled."

#### Expiry and replay protection

- QR itself: 60-second expiry visually enforced by primary device (shows countdown).
- `link_token`: single-use, server-side dedup table marks consumed on `/device-link/initiate`.
- `issued_at` compared to server clock; rejected if drift > 60 seconds.
- A replayed QR after the window simply fails signature-plus-time check.

#### New-device trust state (preserving four states)

The four trust states (`UNVERIFIED` / `VERIFIED` / `NEW DEVICE` / `CHANGED`) are **peer-perspective**. Linking a device changes trust state for TWO distinct audiences:

**Account owner's own perspective:**
- The newly-linked secondary is `VERIFIED-SELF` (a marker separate from peer-side VERIFIED, meaning "I confirmed this device via QR + visual match on my primary device"). This marker is stored only in the owner's own device.

**Peer perspective (every other user who has chatted with this account):**
- Each peer sees the secondary device appear in the owner's device list for the first time.
- Peer-side trust state transitions to **NEW DEVICE** (blue in-chat notice: "{Owner} has a new device · likely a new phone or laptop. Verify safety numbers before sending sensitive content.").
- Peer-side VERIFIED badge on the owner's chat header disappears until peer taps Verify after safety-number comparison.

The peer's state does NOT transition to CHANGED, because CHANGED means "a device_id we've seen before now presents a different public key" (device-key substitution signal). A brand-new device_id is distinct.

**Preserved:** a new device never silently inherits peer-side verification. The owner's own confirmation of their own secondary is independent of peer-side verification.

#### Preventing server-side substitution

The server could try to substitute `secondary_identity_pub` or `secondary_encryption_pub` in flight. The visual-match short code depends on both pubs plus the link_token · if the server substitutes, the primary's displayed short code (computed from the TRUE values the server has told it about) and the secondary's displayed short code (computed from its OWN values) will differ. User sees mismatch, aborts.

The primary's final `primary_confirm_sig` covers the secondary's pubs cryptographically. If the server substitutes between the confirm POST and the final activation, the signature does not verify.

The one scenario where this fails: both primary and secondary are controlled by the attacker. In that case, the attacker already has everything; the architecture cannot help.

#### Revocation after suspicious linking

User sees a device in Security settings they don't recognise:
1. Tap Revoke.
2. Device UPDATEs `revoked_at = now()` in `nex_account_device_key`.
3. All subsequent fan-outs skip this device.
4. Peers see CHANGED trust state (because the device's visible-to-peers presence just vanished · effectively a device-list change).

#### Honest limits

- A user who doesn't actually compare the short-code visually can be fooled. The architecture provides the mechanism; it cannot force attention.
- A device compromised BEFORE QR generation (primary already compromised) means the entire ceremony is attacker-controlled.

### Failure cases and unresolved questions

- **Camera unavailability for QR scan.** Fallback is manual link-code entry (6-digit code typed by hand). Design not drafted here.
- **Multiple pending links.** Server rejects concurrent `/device-link/initiate` for the same account to prevent racing attacks.
- **"Linked_by" chain honesty.** If primary is later revoked, the secondary's `linked_by_device_id` becomes a dangling pointer. Historical fact · preserved for audit · doesn't affect runtime behaviour.

### Required follow-on specifications before implementation

1. Full QR encoding format + size budget.
2. Fallback manual-code UI design.
3. Short-code presentation format (digit grouping, high-contrast rendering).
4. Push-notification format for primary when a secondary attempts to link.

---

## BLOCKER 4 · Storage HTTP 403 handling

### Design proposal · default-pause with narrow object-specific window

#### Classification rule

**Default assumption: a 403 from Supabase Storage is global (bucket policy, service-role credential failure, RLS misconfiguration).** Treat as PAUSE + PAGE unless strong evidence points to object-specific cause.

#### Revised error-class mapping (replaces §12 of the draft)

| HTTP status / event | Classification | Action |
|---|---|---|
| 200 / 204 | Success | `purged_at = now()` |
| 404 | Success (idempotent) | `purged_at = now()` |
| 408 | Transient (timeout) | `attempt_count++`, exp backoff |
| 429 | Transient (rate limit) | `attempt_count++`, exp backoff, respect `Retry-After` header |
| 500 / 502 / 503 / 504 | Transient (server) | `attempt_count++`, exp backoff |
| Network timeout / TCP reset | Transient (network) | `attempt_count++`, exp backoff |
| TLS handshake failure | Transient (network) | `attempt_count++`, exp backoff |
| 400 | Object-specific (malformed key) | After 1 attempt, `dead_lettered_at = now()` + alert |
| 401 | **Global auth failure** | **WORKER PAUSE + PAGE OPS** |
| 403 | **Global permission failure (default)** | See 403 sub-flow below |
| 409 / 413 / 422 | Object-specific (anomaly) | `attempt_count++`, dead-letter after 3 attempts |
| 5xx not listed above | Transient | `attempt_count++`, exp backoff |
| Any response the client cannot parse | PAUSE | **WORKER PAUSE + PAGE OPS** |

#### 403 sub-flow

Worker maintains an in-memory sliding window of recent 403 occurrences:

- `recent_403_window_start`
- `recent_403_count` (within the window, 60 seconds wide)
- `recent_403_object_keys` (set of distinct storage_object_keys that produced a 403 in the window)

On receiving a 403:

1. If `now() - recent_403_window_start > 60s`, reset the window.
2. Increment `recent_403_count`.
3. Add this row's `storage_object_key` to `recent_403_object_keys`.
4. Evaluate circuit:
   - If `recent_403_count >= 3` AND `|recent_403_object_keys| >= 2` (3+ distinct 403s on 2+ distinct keys within 60s) → **WORKER PAUSE + PAGE OPS**. Preserve queue state. Do NOT dead-letter any row.
   - Else → increment attempt_count for THIS row with exp backoff. On this row's 3rd total 403 across its lifetime → `dead_lettered_at = now()` + alert (treating as a stable object-specific 403, which is extraordinarily rare in Supabase Storage).

Rationale: a genuine object-specific 403 is almost impossible under Supabase's bucket-level ACL model. Requiring BOTH count-threshold AND distinct-key-threshold distinguishes:
- One object repeatedly 403ing (rare but possible if that object has unusual metadata · dead-letter after many retries)
- Three objects 403ing (strongly suggests global cause · pause and page)

#### PAUSE state

Worker state table:
```
nex_worker_state (
  worker_name text PK,
  state text CHECK (state IN ('running', 'paused')),
  paused_at timestamptz,
  paused_reason text,
  paused_by text          -- auto-trigger or operator
)
```

On circuit trip:
1. UPDATE `nex_worker_state` SET `state = 'paused'`, `paused_at = now()`, `paused_reason = 'storage_403_circuit'`, `paused_by = 'auto'`.
2. Emit high-priority alert via Gate 1 notification route.
3. Worker's next tick checks state before any work; if paused, logs and sleeps until operator intervenes.

Operator resumes:
1. Operator verifies root cause (bucket policy, credentials, RLS).
2. Operator UPDATEs `nex_worker_state` SET `state = 'running'`, `paused_at = NULL`, `paused_reason = NULL`.
3. Worker resumes on next tick.

#### Expired credentials

Supabase service-role tokens do not expire by default, but a credential rotation during operations could invalidate the token. Appears as 401 → PAUSE + PAGE (not 403). Operator rotates credentials + resumes.

#### Storage outage

5xx or network errors → transient classification → exp backoff. Worker continues. If outage persists beyond backoff cap (24h), dead-letter triggers; the global circuit does not trip because 5xx isn't included in the 403 counter.

#### Classification impossibility fallback

Any response the HTTP client cannot parse (malformed JSON, truncated response, unknown status code) → PAUSE + PAGE. Safe default per the challenge instruction.

#### Required supporting infrastructure

- `nex_worker_state` table (schema above · design-only, migration later).
- Alerting pipeline (Gate 1 responsibility).
- Operator runbook for 403 circuit trips.

### Failure cases and unresolved questions

- **Thundering herd on resume.** After a long pause, resuming the worker may process a very large queue backlog. Suggest resume with rate-limited startup (process at 10% capacity for first 10 minutes, scale up).
- **Fast-flapping bucket policy.** If the bucket policy flaps between valid and invalid repeatedly, the worker may pause-resume-pause. Threshold logic could add hysteresis. Not drafted here.
- **Operator fatigue.** Pause-and-page is high-touch. If 403 circuit trips are frequent (shouldn't be), ops burden grows. Need a monthly review of circuit-trip count.

### Required follow-on specifications before implementation

1. `nex_worker_state` table + API for operator resume.
2. Alert payload format for Gate 1.
3. Operator runbook template.

---

## BLOCKER 5 · Legacy transition windows framework

### Design proposal · phased transition with hard cutover

**No specific dates proposed in this document.** Values marked `(owner)` require explicit owner decision at B1 authorisation. Values marked `(legal)` additionally require qualified legal review.

#### Phase definitions

| Phase | Name | Duration | Begins | Ends |
|---|---|---|---|---|
| A | Pre-notification | `N_A` days (owner · propose ≥30) | B1 authorisation | T_freeze |
| B | Dual-write | `N_B` days (owner · propose 30-60, must overlap with A) | B1 authorisation | T_freeze |
| C | Freeze | instantaneous | T_freeze | T_freeze |
| D | Legacy read-only | `N_D` days (owner + legal · propose ≥90) | T_freeze | T_export_close |
| E | Export closed | instantaneous | T_export_close | T_export_close |
| F | Final purge | ≤7 days (operational window) | T_export_close | T_purge_complete |
| G | Verification | ≤7 days | T_purge_complete | T_verified |

#### Transition flows

**Phase A (Pre-notification):**
- Users notified in-app + email starting T_freeze − N_A days.
- Repeated reminders at T_freeze − 14, T_freeze − 7, T_freeze − 1.
- Export endpoint OPEN for pre-emptive use.

**Phase B (Dual-write):**
- Runs concurrently with phase A.
- Every new message is written both to `body` (plaintext) AND to the encrypted path (ciphertext + wrapped_key_wrapped + nonce).
- Clients prefer encrypted path on read; fall back to `body` if encrypted fields are null.
- Rollback capability: at any moment during B, the owner can revert the deployment config to stop writing encrypted fields and continue with plaintext only.

**Phase C (Freeze instant · T_freeze):**
- At the exact timestamp, a feature flag flips: `allow_plaintext_write = false`.
- Server-side INSERTs with non-null `body` fail validation. Writes are encrypted-path only from this moment.
- Legacy `body`-populated rows are not touched; they remain readable.
- An inflight-write race window of ≤1 second is tolerated; writes crossing the flip get a 503 and client retries using the encrypted path.
- Rollback after T_freeze requires a separately-authorised deployment and is NOT a routine action.

**Phase D (Legacy read-only · T_freeze to T_export_close):**
- Legacy `body`-populated rows remain readable by their intended recipients.
- Public-bucket attachment URLs remain accessible.
- `/export-chat-history` endpoint remains open.
- No new plaintext rows created.
- GDPR SAR requests served from legacy `body` where applicable.

**Phase E (Export closed · T_export_close):**
- `/export-chat-history` returns 410 Gone.
- Export bundles already generated remain downloadable for 7 more days (grace), then signed URLs expire.
- Pending GDPR SAR requests at this instant are escalated to manual legal processing.

**Phase F (Final purge · T_export_close to T_purge_complete):**
- Operator triggers (requires separate authorisation):
  - DROP COLUMN `nex_peer_message.body`.
  - DELETE all objects from public bucket.
  - DROP indexes on former `body` column.
- Phase F operations are IRREVOCABLE.

**Phase G (Verification · T_purge_complete to T_verified):**
- Automated audit: assert no column named `body` remains on `nex_peer_message`; assert public bucket is empty; assert no application code path still references plaintext `body` field.
- Verification report filed to owner.
- After owner acceptance of the verification report, phase G closes and Option 2 is live.

#### Hard cutover enforcement

- T_freeze is set as an absolute timestamp when B1 is authorised. **The timestamp is binding.**
- If, as T_freeze approaches, the system is not ready (e.g., clients lag behind the dual-write path, operational Gate 1 not met), the owner has two choices:
  - **Delay T_freeze** · but each delay requires explicit re-authorisation. The dual-write cost compounds.
  - **Rollback the whole B1** · revert the dual-write deployment, keep legacy plaintext as sole write path, resume design work. B1 can be re-authorised later with a new T_freeze.
- The default on inability-to-freeze is **rollback**, not **extend indefinitely**. This prevents the dual-storage state from becoming permanent.

#### Values requiring owner approval

| ID | Value | Scope |
|---|---|---|
| V1 | `N_A` · pre-notification duration | ≥30 days to allow user response time |
| V2 | `T_freeze` · absolute freeze timestamp | Owner's business judgment |
| V3 | `N_B` · dual-write duration | Must overlap A fully; 30-60 days typical |
| V4 | `N_D` · legacy read-only duration | ≥90 days to accommodate GDPR SAR + retries + buffer |
| V5 | `T_export_close` | V2 + V4 |
| V6 | `T_purge_complete` | V5 + 7 days maximum |
| V7 | Rollback vs delay default on readiness failure | Propose rollback |

#### Values requiring legal review

| ID | Value | Legal concern |
|---|---|---|
| L1 | Minimum `N_D` under GDPR Art 12 (SAR deadline) | GDPR requires 30-day response; export window must cover this + buffer |
| L2 | Users-who-don't-return policy | Data-minimisation principle vs continuity of service |
| L3 | Interaction with pending GDPR SAR at T_freeze | Must honour outstanding requests |
| L4 | Jurisdictional differences | NEX operates in multiple jurisdictions (Ireland, Indonesia, others per sealed scope) |
| L5 | Email content for notification | Must be accurate and comply with jurisdiction-specific requirements |
| L6 | Consent model (opt-in / informed non-objection / fresh ToS) | GDPR Art 7 interpretation |

#### Preserved principle

After phase G, NEX holds no plaintext message history and no public attachment objects. The "no permanent server-held message history or attachments" principle is met.

### Failure cases and unresolved questions

- **Clients that don't update to encrypted-path readers before T_freeze.** Those users see empty inboxes after T_freeze if they haven't exported. The pre-notification cadence (phases A, A-14, A-7, A-1) must emphasise "update your app" and "export now".
- **Partial write at T_freeze.** A client whose INSERT lands at the flip instant. Mitigation: server returns 503 for 1 second around the flip to force client retry on encrypted-path.
- **Rollback after T_freeze.** Not routine. Requires separate authorisation + re-engagement of plaintext writers.

### Required follow-on specifications before implementation

1. Server-side feature-flag design for `allow_plaintext_write`.
2. Export-bundle format (JSON schema + attachment zip layout).
3. In-app notification UI copy (requires BLOCKER 6 output).
4. GDPR SAR handoff workflow at T_export_close.

---

## BLOCKER 6 · User notification and consent framework

**This section proposes a FRAMEWORK, not finalised copy. All user-facing text requires owner + legal sign-off.**

### Framework structure

Three communications tracks running in parallel through phases A-F:

1. **In-app notifications** · banners, modals, inline messages inside the NEX app.
2. **Email notifications** · to the email on file for the account (if present and consent exists).
3. **Settings-page explainer** · a durable, long-form page the user can open at any time.

### Communication cadence

| When | Channel | Purpose |
|---|---|---|
| T_freeze − N_A | In-app banner on app open + email | Initial notification |
| T_freeze − 14 | In-app banner + email | Reminder with export emphasis |
| T_freeze − 7 | In-app full-screen modal + email | Final reminder; last-chance export emphasis |
| T_freeze − 1 | In-app push notification (if device supports) | Imminent-change alert |
| T_freeze | In-app success modal | "Your chats are now end-to-end encrypted." |
| T_freeze + 7 | In-app banner (for users who haven't exported) | Reminder: legacy still available for N_D − 7 days |
| T_export_close − 14 | In-app banner + email | Export window closing soon |
| T_export_close − 7 | In-app modal + email | Final final export reminder |
| T_export_close | In-app success modal | Export window closed |
| T_purge_complete | In-app banner | Legacy history has been removed |

### Content outline (owner + legal customise)

**What's happening:**
> NEX is becoming end-to-end encrypted. From {T_freeze}, only your devices will be able to read your messages. NEX will no longer be able to see the content of your chats.

**What NEX stores today:**
> Right now, NEX servers hold your message history in a readable form. Any attachments you've sent are stored in a bucket that anyone with the link can access. This is why we're changing.

**What NEX will stop storing:**
> After {T_freeze}, your messages are encrypted on your device before they leave. The server only sees a scrambled version. Your attachments will be stored encrypted. NEX cannot read either.

**Your historical messages:**
> Everything you've sent or received before {T_freeze} is still available until {T_export_close}. After {T_export_close}, legacy chats will be removed from our servers. If you want to keep them, export now.

**Device loss:**
> Because NEX cannot read your messages, we also cannot back them up. If you lose all your devices without exporting, your history is gone. You may add a second device as a backup via the Linking screen.

**Users who don't return:**
> If you don't open NEX before {T_export_close}, your legacy messages will be removed on {T_purge_complete} regardless. We cannot preserve them for you without breaking the encryption promise.

**Privacy rights:**
> You can request a copy of your data (GDPR Subject Access Request) or request deletion of your account via Settings → Privacy at any time. During the transition, these requests are prioritised.

### Consent model

**GDPR Art 7 analysis (NON-LEGAL summary · requires qualified legal review):**

NEX is reducing the data it processes (plaintext → ciphertext). Under GDPR Art 5(1)(c) data-minimisation this is a positive change. However:

- Art 7 requires consent to be freely given, specific, informed, unambiguous.
- Processing CHANGE may fall under existing lawful bases (Art 6(1)(b) contract performance, Art 6(1)(f) legitimate interests) rather than requiring fresh consent.
- Transparency obligation (Art 12-14) does require clear information to the data subject regardless of lawful basis.

Three consent-model options for the owner (**legal review required** before any choice is public):

| Option | Description | Trade-off |
|---|---|---|
| **(a) Explicit opt-in** | Users must click "I understand" before T_freeze. Users who don't by T_freeze get a modal demanding action at next login. | Highest legal defensibility · worst UX · may cause active users to be "locked out" temporarily. |
| **(b) Informed non-objection** | Users notified via all channels. Silence = continuation. Users may opt out by exporting + deleting their account. | Balanced · relies on legal interpretation that the change is a minimisation not requiring fresh consent. Most jurisdictions likely accept this. |
| **(c) Fresh ToS acceptance** | NEX's Terms of Service are updated. Users must accept updated ToS at next login after T_freeze − N_A. Non-acceptance after T_freeze = login blocked until acceptance. | Legal clarity · moderate UX friction · ToS-change churn. |

**Recommendation:** present (b) to the owner as the default pending legal review. If legal counsel insists on firmer consent, fall back to (c). (a) is the strictest and most expensive.

### Users who do not return

Three options for the owner (**legal review required**):

| Option | Description | Trade-off |
|---|---|---|
| **(aa) Purge regardless** | At T_purge_complete, legacy plaintext for all users is removed. Users who never logged in lose history silently. | Consistent with "no permanent storage" principle · silent data loss for inactive users · defensible under data-minimisation. |
| **(bb) Preserve plaintext for inactive accounts** | Keep plaintext indefinitely for users who haven't logged in during D. | Violates principle 6 (no permanent server-side chat history) · creates a tiered privacy regime. |
| **(cc) Delete inactive accounts entirely** | At T_purge_complete, accounts with no login in a defined window (e.g., 1 year) are deleted entirely. User's identity + data removed. | Aligned with GDPR data-minimisation + storage-limitation (Art 5(1)(e)) · destroys user's identity · requires separate account-deletion engineering. |

**Recommendation:** (aa) as default · with explicit notification cadence making it clear to users what will happen. (cc) may be adopted as a longer-term policy in a separate stage, not necessarily tied to T_purge_complete.

### Export mechanism

- Async: user requests → server generates bundle → email with signed download URL (24h validity · may be re-requested if expired).
- Bundle format: `.zip` containing:
  - `messages.json` · array of `{conversation_id, counterparty_display_name_at_time, sent_at, direction, body, attachment_filename}` entries.
  - `attachments/` · directory of attachment files, decrypted into their original binary form.
  - `README.txt` · export version, generated timestamp, note that this is a one-time snapshot not kept in sync.
- Users may request multiple exports.
- SLA: bundles generated within 48h of request. If generation fails, bundle automatically re-queued up to 3 times; after that, operator intervention + user notification.

### Legal decisions requiring qualified review

| ID | Decision |
|---|---|
| L1 | Consent model (a / b / c) |
| L2 | Users-who-don't-return policy (aa / bb / cc) |
| L3 | Jurisdiction-specific requirements for NEX's operational regions |
| L4 | Retention of export logs (how long does NEX keep the record "user X requested export at T"?) |
| L5 | Export bundle itself: is it a controller export (NEX processing) or a user-held copy exempt from NEX obligations once delivered? |
| L6 | Interaction with pending GDPR SAR at T_export_close |
| L7 | Minimum notification cadence under jurisdictional data-protection laws |
| L8 | Email content exact wording |
| L9 | Whether the privacy policy must be re-accepted (ties to L1) |
| L10 | Audit log of consent / non-objection actions · retention and purpose |

**Do not invent consent, claim legal compliance, or assume silence means consent.** All user-facing text requires owner + legal sign-off before publication.

### Failure cases and unresolved questions

- **Email delivery failure.** Email is non-authoritative. In-app notification is primary; email is supplementary. Users without a valid email on file still get in-app notifications.
- **Dormant users with expired email boxes.** Fall through to users-who-don't-return policy.
- **GDPR SAR filed during export window.** Honor via normal SAR process · don't rely on `/export-chat-history` to automatically satisfy SAR (export is a convenience; SAR is a legal obligation).
- **Multi-language.** All copy must be available in NEX's supported languages. Translation + legal review per language.

### Required follow-on specifications before implementation

1. Final user-facing copy per language.
2. Export bundle byte-level format.
3. SAR workflow handoff.
4. Jurisdiction-specific legal review completed.
5. Email delivery infrastructure (if not already present).

---

## Summary

All six BLOCKER clusters have a technically coherent proposed resolution. No blocker remains unresolved at the design level. However, every proposal depends on **owner decisions** (see companion document `nex-option-2-owner-decision-register-2026-11-03.md`) and in several cases on **qualified legal and cryptographic specialist review**.

### Preserved principles · verification

| # | Principle | Preserved? | Note |
|---|---|---|---|
| 1 | Device-local history canonical | YES | Reinforced by replay-protection message_id in envelope |
| 2 | NEX = temporary encrypted relay | YES | Encryption throughout; ciphertext only on server |
| 3 | All-devices ACK before group deletion | YES | Unchanged |
| 4 | Missing keys → quarantine | YES | Unchanged |
| 5 | Quarantine retention owner-approval-only | YES | Unchanged |
| 6 | No permanent server-side chat history | YES | Phase G verification confirms |
| 7 | No automatic plaintext fallback | YES | Freeze instant removes write path; rollback is manual |

No proposal weakens any principle. Tensions were identified honestly (e.g., ephemeral-key one-sided forward secrecy, legacy transition rollback semantics) rather than resolved by softening.

### Decisions requiring specialist review

**Qualified cryptographic review (independent):**
- Full protocol correctness check against standard Dolev-Yao adversary model.
- Side-channel analysis of libsodium.js WASM path on target browsers.
- Review of CBOR encoding canonicalisation for envelope bytes.
- Review of sender_sig necessity / cost / threat-model implications.

**Qualified legal review:**
- All items in BLOCKER 5 §Legal and BLOCKER 6 §Legal above.

### Confirmation

No implementation performed. No code modified. No SQL executed. No database or infrastructure touched. No migrations drafted or applied. No commit, push, or deployment. One new file created: this document.

Companion document (produced in the same authorisation): `docs/doctrine/nex-option-2-owner-decision-register-2026-11-03.md`.

Stopping. Awaiting owner review and explicit decisions on the register before any further action.
