# NEX Private Groups · Protocol Design + Threat Model · DRAFT · 2026-10-23

**Status** · DRAFT · owner-recorded · READ-ONLY REVIEW ARTEFACT · NO implementation authorised · NO migration SQL authorised · NO code authorised.
**Parent contract** · `docs/doctrine/nex-private-groups-contract-draft-2026-10-23.md` (rev 3).
**Owner authorisation scope** · 2026-10-23 · "a revised, read-only protocol design and threat-model review only — not migration SQL, application code or database changes".
**Review posture** · provisional direction only · everything in this document is subject to (a) owner approval of each section · (b) resolution of the three engineering gates in parent contract §5.7 · (c) completion of an independent cryptographic review per parent contract §5.9.

**NO security guarantees in this document should be treated as made until the final implementation has been built and independently reviewed.** The construction below is a design proposal · its correctness has not been verified · its implementation has not begun.

---

## 0 · What this document is / isn't

**Is**
- A read-only text artefact describing a proposed sender-key construction for NEX Tier-1 private groups.
- A documented threat model with explicit in-scope / out-of-scope boundaries.
- A specification of the three engineering gates from parent-contract §5.7 (multiple senders/devices · atomic membership changes · protocol + attachment detail).
- A deferred discussion of MLS migration viability.
- A list of required inputs for the independent cryptographic review.

**Is not**
- Code.
- A migration SQL draft.
- A commitment to the specific protocol described (owner may reject or revise).
- A security attestation (no implementation exists yet).
- A guarantee that this construction will pass the independent cryptographic review.

---

## 1 · Protocol construction (sender keys · owner-provisional)

### 1.1 Overview

Each sending device in a group holds its OWN sender key (a symmetric AES-256-GCM key). A message is encrypted ONCE under the sender device's current sender key. The sender key is distributed OUT-OF-BAND to each recipient device via `nacl.box` envelopes (same primitive used by current peer-chat · tweetnacl 1.0.3 · Curve25519 ECDH + XSalsa20-Poly1305).

This design deliberately follows the Signal Protocol Group / Sender Keys pattern (as deployed by WhatsApp Groups and Signal Groups) rather than inventing new cryptography. It is NOT a full Signal Protocol implementation and is not claimed to be.

### 1.2 Key material taxonomy

| Element | Type | Lifetime | Storage |
|---|---|---|---|
| **Device identity keypair** | Curve25519 (private + public) | Device-lifetime | Private: client IndexedDB only · Public: `nex_account_device_key.public_key` (existing · migration 092) |
| **Sender key** | AES-256-GCM symmetric secret (32 bytes random) | Rotated on membership change OR every 30 days | Private: in-memory + encrypted-at-rest on client · Public: never exists (symmetric) |
| **Sender key ID** | UUID | Per sender-key version | Server + all client caches |
| **Sender key version** | Monotonic integer | Incremented on every rotation | Server-persisted + client-tracked max-seen-per-sender |
| **Sender key distribution envelope** | `nacl.box` ciphertext | Until consumed OR 30-day expiry | Server table (proposed name only: `nex_group_sender_key_envelope`) |
| **Message nonce** | 12-byte random | Per message | Prepended to ciphertext · never reused |
| **Per-attachment content key** | AES-256-GCM symmetric secret (32 bytes random) | Per attachment · one-shot | Encrypted-wrapped under current sender key · stored next to the message row |

**Explicit rejection**: shared group keys (one key for all senders in a group) are REJECTED by parent-contract §5.7 Gate 1. Each sending device MUST have independent sender-key state.

### 1.3 Message envelope (on-the-wire + at-rest shape)

The group message record carries:

- `group_id` · UUID
- `sender_account_id` · UUID
- `sender_device_id` · text (existing `nex_account_device_key.device_id`)
- `sender_key_id` · UUID (identifies which sender-key version was used)
- `sender_key_version` · integer (monotonic per sender-device per group)
- `message_sequence` · integer (monotonic per sender-device per group · across rotations · DO NOT reset)
- `nonce` · 12 bytes (base64url text column)
- `ciphertext` · bytea (AES-256-GCM output · includes 16-byte GCM tag)
- `associated_data` · bytea (= concatenation of group_id || sender_account_id || sender_device_id || sender_key_id || sender_key_version || message_sequence · bound into AES-GCM AAD to prevent header tampering)
- `created_at` · timestamptz (server-assigned on insert)

**Server never stores plaintext body.** The parent contract §4 Decision 2 settled a new `nex_group_message` table isolated from `nex_peer_message` · encryption columns go on the new table only.

### 1.4 Sender-key distribution envelope

When a sender initialises a new sender key (first use OR after rotation), the client:
1. Generates a fresh 32-byte AES-256-GCM key locally.
2. For each OTHER active member's EACH active device, produces an envelope:
   - Payload: `{group_id, sender_account_id, sender_device_id, sender_key_id, sender_key_version, sender_key_material}`
   - Encrypted via `nacl.box(payload, nonce, sender_device_privkey, recipient_device_pubkey)` · authenticated encryption with sender identity.
3. Server stores envelopes in a proposed `nex_group_sender_key_envelope` table (shape: `(id, group_id, sender_device_id, recipient_device_id, sender_key_version, nonce, ciphertext, created_at, consumed_at)`).
4. Recipient devices fetch unconsumed envelopes on sync, decrypt, verify sender's device public key against `nex_account_device_key.public_key`, store the sender key locally, mark envelope consumed server-side.

**Authenticated by**: the sender's device Curve25519 private key signs implicitly via `nacl.box`'s authenticated encryption · receiver verifies by looking up the sender's device public key in `nex_account_device_key`.

**Rejection paths** (receiver): envelope fails `nacl.box.open` · sender device public key is not current OR not a group member · sender_key_version is less than or equal to max-seen for this (group, sender_device) · nonce format invalid.

### 1.5 Encryption + decryption flow

**Encrypt (sender)**:
1. Fetch or create current sender key for this (group, device).
2. Generate 12-byte random nonce (`crypto.getRandomValues`).
3. Compute AAD = concat(group_id || sender_account_id || sender_device_id || sender_key_id || sender_key_version || message_sequence).
4. Ciphertext = AES-256-GCM.encrypt(plaintext, sender_key, nonce, AAD).
5. message_sequence +=1 (monotonic per (group, sender_device) · persisted locally and on-insert to server).
6. INSERT row with all envelope fields.

**Decrypt (recipient)**:
1. SELECT message row (RLS verifies recipient is a current member of the group).
2. Look up locally stored sender key by (group_id, sender_device_id, sender_key_version).
3. If not present · fetch distribution envelopes · decrypt the matching envelope · install sender key locally.
4. If STILL not present · reject (message encrypted under a key the recipient has no claim to · typical when recipient joined AFTER the sender_key_version was active, enforcing from-join history).
5. Recompute AAD · AES-256-GCM.decrypt(ciphertext, sender_key, nonce, AAD) · tag verification = authenticity.
6. Replay guard · check (group_id, sender_device_id, sender_key_version, message_sequence) is greater than max-seen window per that sender-device.
7. Return plaintext to UI.

### 1.6 Attachment encryption

Per parent-contract §4 Decision 7 (image · video · file · audio only · 1 per message):

1. Client generates 32-byte random AES-256-GCM content key.
2. Client encrypts attachment bytes with content key + random nonce.
3. Client encrypts (wraps) the content key under the current sender key: `AES-256-GCM(content_key, sender_key, wrap_nonce)`.
4. Client uploads encrypted attachment to the new `nex-group-attachments` private bucket (signed-URL write).
5. Client posts the group message with attachment metadata: `wrapped_content_key`, `wrap_nonce`, `attachment_object_path`, `attachment_type` (restricted enum: image · video · file · audio), `attachment_size_bytes`.
6. Recipients: fetch encrypted attachment via signed URL · unwrap content key under their sender key · decrypt.

**Bucket config**: private · signed URL reads (not public URLs) · owner directive 2026-10-23. EXIF/GPS stripped SERVER-SIDE before storage · server MAY need to see raw bytes to strip EXIF · this is a known tradeoff and the honest statement in §5.8 covers it.

**Alternative** (if the owner wants fully E2E attachments without server EXIF strip): client-side EXIF strip BEFORE encryption · then server never sees plaintext bytes. Stronger. Requires client reliability. Owner to decide.

---

## 2 · State machines

### 2.1 Membership state machine

| State | Entered via | Exits via |
|---|---|---|
| **pending_invite** | Owner/admin sends invite | Accept (→ `active`) · Decline / let-expire / cancel (→ terminal) |
| **active** | Accept of pending_invite | Leave (self) · Remove (admin) · Group archive · Group delete |
| **left** | Self-leave while active | (terminal · can be re-invited to re-enter via pending_invite) |
| **removed** | Admin remove while active | (terminal · same re-invite rule) |
| **archived** | Group transitions to archived | (terminal · all members' active becomes archived) |

Transitions MUST be atomic with their key-material consequences (see 3.1 and 3.2 below).

### 2.2 Key-rotation state machine (per sender-device per group)

| State | Entered via | Exits via |
|---|---|---|
| **current** | New sender key generated | Rotation triggered |
| **rotating** | Rotation initiated · new key generated but not fully distributed | All members' devices acknowledge receipt (→ `rotated`) · timeout (→ `rotated_force` · see §4.3) |
| **rotated** | New key version active · old key retained client-side for decrypting old messages | Next rotation |

Rotation triggers:
- Member added · the inviting sender's key is NOT rotated (new member just gets the current key via distribution envelope · from-join history enforced because they only get the CURRENT key · they cannot decrypt messages from pre-join versions)
- Member removed · the sender key of EVERY currently-active sender in the group is rotated · remaining members get the new key via distribution envelopes · removed member's device gets no new envelope
- 30-day periodic · each active sender's key auto-rotates (safety net · limits exposure of a leaked single-version key)

### 2.3 Offline-device state machine

| State | Signal | Behaviour |
|---|---|---|
| **online** | Fresh WebSocket + recent `last_seen_at` | Receives distribution envelopes + messages immediately |
| **offline** | No connection but `last_seen_at < 30d` | On next connect: fetches unconsumed envelopes + missed messages |
| **catching_up** | Online but behind by >100 messages OR >1 rotation | Shows catch-up spinner · processes queue · reconciles max-seen state |
| **stale** | `last_seen_at > 30d` | Re-fetch all active sender keys from active senders (new distribution envelope cycle) · old sender keys may have been purged · some messages may become unreadable (acceptable loss per §4.4) |

---

## 3 · Membership-change atomicity (parent §5.7 Gate 2)

The owner directive requires that a PostgreSQL advisory lock on `(group_id)` alone is INSUFFICIENT. The transaction must coordinate four things atomically.

### 3.1 Add-member transaction

Within a single DB transaction holding `pg_advisory_xact_lock(hashtextextended(group_id, 0))`:

1. Verify the acting account is `owner` or `admin` of `group_id`.
2. Verify the group has fewer than 100 current `active` members (parent §4 Decision 1 cap).
3. Verify no pending unique-pending constraint violation (parent §3.2 one-pending-invite rule).
4. If adding directly (not via invite accept): INSERT `nex_group_member` row with `role='member'` · state=`active`.
5. If accepting an invite: UPDATE `nex_group_invite` row to `accepted` · INSERT `nex_group_member` row.
6. Fetch all currently-active senders' current sender keys for this group (sender_device_id + sender_key_id + sender_key_version).
7. For each active sender · for each new member's active device · the SENDER's client must subsequently generate a distribution envelope. **The envelope creation is CLIENT-SIDE and asynchronous**: the server does not hold sender-key plaintext.
8. Server-side, the transaction completes atomically for the membership insert. The envelope-creation step is scheduled: a `nex_group_sender_key_envelope_task` row is created for each `(active_sender_device, new_member_device)` pair · active sender's client fetches tasks and produces envelopes.

**Key honesty**: the new member cannot post or receive messages until at least one active sender has produced + delivered an envelope for their devices. UI must show a "joining group…" state. This is a necessary consequence of client-held keys.

### 3.2 Remove-member transaction

Within the same advisory-lock + transaction scope:

1. Verify acting account is `owner` or `admin`.
2. Verify target is an `active` member.
3. UPDATE `nex_group_member` to state=`removed`, `removed_at=now()`, `removed_by=acting_account`.
4. Insert `nex_group_moderation_action` audit log row (parent §3.6).
5. For each currently-active sender in the group · mark their current sender key as `rotation_required=true`.
6. Senders' clients detect this on next sync and generate NEW sender keys + distribute to remaining members (not to the removed member).

**Message-acceptance policy during rotation**: a message encrypted under a `rotation_required=true` sender-key version is still accepted (sender may not have rotated yet) · but a message authored by the REMOVED member is REJECTED by server-side check (the server knows who is active) regardless of what key material claims. This matters because a removed member's device still has plaintext of its own private key and could technically craft a signed envelope · the server-side membership check is the authoritative gate.

### 3.3 Send-during-membership-change race

Scenario: User A is sending a message. Simultaneously, admin removes User B from the group.

- Transaction orders:
  - A's INSERT acquires row-level locks on `nex_group_member` for membership verification (RLS evaluation).
  - Admin's UPDATE acquires the advisory lock + row-level lock on B's membership row.
- Outcome: either A's message commits first (B still sees it before the removal takes effect from B's device) OR admin's removal commits first (A's message is rejected because the RLS membership-count check now excludes B, which doesn't affect A, so A's message still succeeds · the KEY POINT is B does not receive the message).

**Specific test required** (parent §5.7 Gate 2): a send from A to a group containing B that is accepted into the DB at the exact moment B is being removed MUST not be delivered to B's devices. The delivery mechanism (realtime subscription) must re-check membership at the moment of fetch, not just at the moment of insert.

### 3.4 Admission control pattern (parent §6.1 options)

Of the three options previously proposed (advisory lock · serializable transaction · unique-slot index):

**Recommendation**: **advisory lock inside a transaction**, PLUS a unique membership partial index on `(group_id, account_id) WHERE state = 'active'` as a database-level safety net.

Rationale:
- Advisory lock serialises membership-affecting operations per group · simple to reason about.
- The unique partial index catches the pathological case of a bug that forgets to take the lock · database refuses the duplicate insert.
- Serializable transaction alone would require retry logic in every caller · more complex and no stronger than advisory lock + unique index.
- Pure unique-slot (1..100 slot_number) is strongest invariant but adds a conceptual slot-id that leaks through the API and complicates leaves/rejoins.

---

## 4 · Threat model

### 4.1 In scope · what the construction defends against

| Threat | Defence |
|---|---|
| **Honest-but-curious server** (reads DB tables but doesn't inject records) | Sender key is never on server · ciphertext + envelopes are opaque · plaintext never derivable. |
| **Server-stored ciphertext leaked** (DB backup escapes) | Ciphertext without the sender keys is useless · sender keys are on client devices only. |
| **Removed member reads NEW messages** | Rotation on remove · new sender key is not in removed member's device envelope stream · removed member cannot derive post-removal plaintext. **Does not revoke what they already decrypted.** |
| **Network attacker (passive MITM)** | TLS transport protects envelope + ciphertext · tweetnacl's authenticated encryption makes modification detectable regardless. |
| **Replay of old messages** | AAD binds `message_sequence` into AES-GCM · receiver tracks max-seen per (group, sender_device, sender_key_version) · reject duplicates. |
| **Server-forged sender key** (server inserts fake distribution envelope) | Envelope is `nacl.box` encrypted · authentication tag binds sender's device Curve25519 private key · receiver verifies against `nex_account_device_key.public_key` · forged envelopes fail verification. |
| **Key-version rollback** (server tries to make receiver use old sender key) | Monotonic `sender_key_version` · receiver stores max-seen · reject envelopes with equal-or-lower version. |
| **Removed member impersonation** (server tries to pass messages from a removed member as still-active) | Server-side membership check at message delivery · removed member cannot be a `sender_account_id` on a new row (RLS insert policy denies). |

### 4.2 Out of scope · what the construction does NOT defend against

| Threat | Honest acknowledgement |
|---|---|
| **Device-local plaintext extraction** | Once a member decrypts a message, they have the plaintext locally. Removal cannot un-decrypt. Screenshots, screen recording, copy-paste, OS-level backups all fall here. **The user-facing statement in parent §5.8 says this explicitly.** |
| **Device compromise (malware)** | A compromised device can leak the sender keys it holds · ALL messages encrypted under those keys become readable to the attacker · includes historical messages the device retained. Sender-key rotation on next cycle limits ongoing exposure. **No post-compromise security guarantee is made.** |
| **Compromised Curve25519 device private key** | Attacker can decrypt any sender-key distribution envelopes sent to that device. Mitigation: owner directive to lose device = lose history (phased recovery · parent §5.4) · a device-portability recovery path (Vault-style envelope) is a separate future design. |
| **Metadata leakage** | Server sees: group_id · sender_account_id · sender_device_id · message timing · member list · envelope delivery times · ciphertext sizes. These are NOT encrypted. Timing-correlation attacks + membership-pattern inference remain possible. **No anonymity property is claimed.** |
| **Compromised NEX service infrastructure** | A malicious NEX operator could DOS the service, delete messages, swap recipients in envelopes · the construction detects the swap (via nacl.box authentication) but the attacker-operator can still cause denial of delivery. Not a confidentiality break but a trust-in-platform concern. |
| **Lost device without recovery** | Encrypted history on the lost device is lost. Not recoverable from server. Explicitly acknowledged in parent §5.8. |
| **Metadata about rotation** | Server knows WHEN keys were rotated and WHO rotated them · this reveals membership-change timing even if the key material itself is private. |

### 4.3 Specific rotation-timeout handling (parent §5.7 Gate 1 · stale keys)

If a sender rotates their key but the distribution envelope for recipient device R hasn't been fetched for 7 days:
- Messages from this sender to R are undeliverable (R has no key for the current version).
- UI shows "Pending" / "Awaiting decryption" state on R's side.
- At 30 days, the envelope expires server-side · R is treated as `stale` · needs to request a fresh distribution from the sender (sender's client re-produces the envelope on next sync).
- During the 30-day window the ciphertext is retained on R's inbox for eventual decryption.

### 4.4 Specific loss windows

- Device wipe + no device-portability recovery · ALL message history on that device · unrecoverable.
- 30-day stale device · possibly some message history encrypted under rotated-away sender keys that the sender did not re-produce distribution envelopes for.
- Group archived + 90 days · members with local keys still read history · group chrome marks "archived · read-only".
- Group deleted + 30-day soft-delete · ciphertext purged · even members with keys can no longer fetch messages from server.

---

## 5 · Retention × encryption interaction (parent §7.1)

Parent contract proposed 30-day soft-delete for deleted groups. The crypto layer must address:

### 5.1 What happens to ciphertext on soft-delete

- `nex_group_message` rows marked `deleted_at` · soft-deleted · still queryable by law-enforcement reviewer with service-role access to encrypted bytes (**service cannot decrypt them** · still cryptographically opaque).
- `nex_group_sender_key_envelope` rows marked `deleted_at` · same posture.
- Members who have the sender key LOCALLY can still decrypt messages during the 30-day window (if their client fetches them) · after 30 days, server purges, no further fetches possible.
- A member who deletes the app during the 30-day window: their local keys go too · no cross-device recovery → encrypted history is lost even if restored.

### 5.2 Deleted group · member access path

- Members cannot post · group transitions to `deleted` state · members' UI shows "Group deleted".
- Members' local caches retain whatever ciphertext + keys they had before deletion · they can still READ locally.
- Server stops serving new ciphertext fetches to any member (RLS enforced on `deleted_at IS NULL`).
- After 30 days · server purges · locally-cached state is all that remains.

### 5.3 Reviewer / law-enforcement access

- Service-role can read `nex_group_message.ciphertext` + `nex_group_sender_key_envelope.ciphertext` during the 30-day window.
- Service CANNOT decrypt either without a member's device private key (which is never on the server).
- Reviewer response to a legal request: "We can produce ciphertext + metadata · we cannot produce plaintext · we do not hold decryption keys."

### 5.4 Moderation records retention

Parent contract §3.6 recorded that admin-delete audit log (`nex_group_moderation_action`) is reviewer-only. Retention for that log is NOT 30 days · it is a separate retention policy to be decided. Proposed default: **5 years** for moderation records (consistent with typical business-record retention) · owner to confirm or revise. Admin-identity in audit log is NEVER user-facing even after the 30-day group retention window closes.

---

## 6 · MLS migration path

Parent contract §5.7 Gate 3 requires addressing: can this sender-key design migrate to MLS later?

### 6.1 Answer · yes, with caveats

- Both protocols are per-group · one group's state can be migrated independently.
- Sender keys and MLS epoch keys serve the same functional role (symmetric key under which a message is encrypted) · the migration is a protocol swap · not a schema deletion.
- Messages encrypted under sender keys stay encrypted under sender keys · they are not re-encrypted · readability is preserved for members who retain the keys locally.
- New messages after the switch are encrypted under MLS epoch keys · members must process a joining MLS Welcome message to catch up.

### 6.2 Blocking constraints to MLS migration

| Constraint | How this design addresses it |
|---|---|
| **MLS requires per-user Credential Packages** | Would require a new credential system in NEX · not part of this contract · documented as a MLS-time-only concern. Sender-key design is independent of credentials and does not foreclose MLS from adding them later. |
| **MLS requires a maintained library (openmls or similar)** | Not in NEX today · a library-selection authorisation is required separately. |
| **MLS requires persistent group-state storage** | NEX would add a `nex_group_mls_state` table at MLS-time · sender-key design does not use this table so no conflict. |
| **MLS has a 1-sender-at-a-time commit model (Delivery Service pattern)** | NEX would add a commit-ordering service at MLS-time · sender-key design can coexist by versioning: sender-key groups vs MLS groups discriminated by a `protocol_version` column. |

### 6.3 Non-blocking (easy) parts of the migration

- The `nex_group_conversation` table shape (parent §2 gaps) doesn't need to change · just gains a `protocol_version` column.
- The membership + invite tables are protocol-agnostic.
- The moderation action tables are protocol-agnostic.
- Attachment handling (encrypt-content-key-under-current-key) applies to both.

### 6.4 Verdict (non-authoritative)

The sender-key construction described in this document does NOT foreclose MLS migration. It is designed to coexist via a `protocol_version` discriminator. Migration cost is primarily (a) adding the MLS library + its state machine · (b) per-group ceremony to establish initial MLS group state · (c) running both protocols in parallel during transition. None of these are made HARDER by the sender-key design.

**This is not a commitment to MLS migration · it is confirmation that the sender-key choice does not block one.**

---

## 7 · Independent cryptographic review requirements

Parent contract §5.9 requires an independent cryptographic review. This section specifies what the review must cover.

### 7.1 Scope

- **Construction correctness** · AAD binding, nonce safety, key version monotonicity, replay window.
- **Rotation flow safety** · race conditions during rotation, stale-key handling, membership change × rotation interaction.
- **Distribution envelope authenticity** · `nacl.box` sender identity verification · prevention of server-forged envelopes · prevention of version rollback.
- **Attachment encryption** · wrapping scheme · bucket-side exposure (if any) · EXIF-strip-before-encryption vs server-side strip trade-off.
- **State machines** · completeness · unreachable states · race conditions.
- **MLS migration path** · confirm the design does not foreclose MLS.
- **Threat-model coverage** · gaps in in-scope list · unacknowledged out-of-scope items.
- **No custom cryptography** · all primitives used are standard (tweetnacl + Web Crypto AES-GCM) · no new constructions.

### 7.2 Required deliverables from the reviewer

- Written sign-off OR a list of required changes.
- A public summary suitable for inclusion in NEX legal / compliance records (ensures NEX can demonstrate "we had this reviewed").
- Specific findings documented against each threat in §4.
- Confirmation that user-facing security statement (parent §5.8) matches the actual guarantees.

### 7.3 Who performs the review

**Not decided here.** Owner decides separately. Candidates to consider (document only · not authorised):
- Independent cryptographer (academic or industry)
- Firm specialising in secure messaging review (Trail of Bits, NCC Group, Doyensec, etc.)
- IETF MLS-adjacent reviewer (if MLS migration is on the roadmap)

Owner authorisation required for the specific choice.

---

## 8 · Security acceptance tests (gating production ship)

The following test categories MUST pass before production deploy. Each category requires explicit pass criteria.

| Category | Minimum tests | Pass criterion |
|---|---|---|
| **Encryption correctness** | Tamper-detection (modify ciphertext → decrypt fails) · modify AAD field → decrypt fails · wrong-key decrypt fails · correct-key decrypt succeeds | 100% pass across 10,000 generated test vectors |
| **Replay protection** | Replay of accepted message → rejected · out-of-order delivery within window → accepted · beyond-window → rejected | 100% pass · receiver window size documented |
| **Membership races** | Concurrent send + remove · concurrent add + rotation · dual admin removes · owner-leaves + transfer collision | No deadlock · no cap exceedance · no stale-key message delivered to removed member |
| **Rotation flow** | Rotation on remove · 30-day periodic rotation · post-rotation decryption of old messages still works · pre-rotation keys do NOT decrypt post-rotation messages | 100% pass |
| **Offline / catch-up** | Device offline 7d → catch-up decrypts correctly · device offline 30d+ → stale posture activates · envelope expiry handling | Documented · deterministic |
| **Attachment** | Encrypt + decrypt roundtrip · tamper detection on attachment bytes · wrong sender-key fails unwrap · bucket signed-URL expiry respected | 100% pass |
| **From-join history** | New member CANNOT decrypt messages from before their join · verified cryptographically (not just UI-filtered) | 100% pass |
| **Independent review items** | All findings from §7 reviewed · changes integrated · reviewer sign-off | Reviewer explicit sign-off |

---

## 9 · What this review does NOT yet resolve

Items that must be settled before the migration SQL draft:

1. **Reviewer selection** (§7.3) · owner picks a specific cryptographer or firm.
2. **EXIF-strip location** (§1.6) · server-side (requires server to see raw bytes before encryption) · OR client-side (stronger · requires client reliability).
3. **Rotation timeout for stale envelopes** (§4.3) · proposed 30 days · owner to confirm.
4. **Moderation record retention** (§5.4) · proposed 5 years · owner to confirm.
5. **Advisory-lock scope key** · `pg_advisory_xact_lock(hashtextextended(group_id, 0))` · validate the hash function choice (currently proposed) does not collide badly at scale.
6. **Service-task table shape for envelope-production tasks** (§3.1 step 8) · a new mini-table OR a column on membership.
7. **"Protocol version" discriminator** (§6.3) · if we want to leave MLS migration open, we add `nex_group_conversation.protocol_version` from day one · confirm with owner.
8. **Device identity key rotation** · currently NEX has no in-place rotation (§Audit result 2) · if a device key is compromised, user must create a new device · groups need a path to redistribute sender keys to the new device · worth documenting as a known UX concern.

---

## 10 · What this review BLOCKS (confirmation)

**Everything** on the implementation side. Specifically:
- No `nex_group_message` table SQL may be drafted.
- No `nex_group_sender_key_envelope` table SQL may be drafted.
- No `nex-group-attachments` bucket may be created.
- No encryption-service file may be written.
- No RLS policies may be drafted.
- No client-side cryptographic code may be written.

Only ALLOWED next: owner review of this document · the three engineering gates (parent §5.7) feedback · the four open items from §9 above · the authorised selection of an independent cryptographic reviewer per §7.3 · a FOLLOW-UP revision of this document integrating the reviewer's findings.

Only AFTER the reviewer's sign-off is integrated can the migration SQL draft be authorised (phase step 10 of parent §10).

---

## 11 · Pause point

This document is the end of my current authorised work. I will not:
- Edit this document further without an owner directive.
- Begin a migration SQL draft.
- Modify any application code.
- Create any new tables, buckets, or storage objects.
- Reach out to any external cryptographic reviewer.

Standing by for owner feedback on the eight unresolved items in §9 and acceptance (or revision requests) on §1-§8.
