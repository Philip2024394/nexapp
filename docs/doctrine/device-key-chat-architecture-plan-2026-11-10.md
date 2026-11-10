# NEX device-key chat architecture — staged plan
## 2026-11-10 · doctrine draft for owner review

**Status.** Draft. No code, no DB change, no bucket creation, no prod
touch is authorised by this document. The goal is to surface the full
staged plan so the owner can seal / amend / reject each stage
independently.

**Scope.** Device-key end-to-end private peer chat on nexapp
(`C:/Users/Victus/nexapp`). Does not alter the sealed doctrine
positions on commercial chat / order separation / NEX Official / HQ
direct — those keep their own sealed contracts. This plan covers how
private peer-chat ciphertext is produced, delivered, decrypted,
retained, and safely retired on the already-authored device-key
foundation (migrations 092 · 093 · 094 · 295 · 298).

**Sealed invariants recapped verbatim (owner-sealed 2026-11-09).**

- **I-1 · no server retention of plaintext.** The server must not
  retain plaintext message bodies of private peer chat at any point.
- **I-2 · no queue / stash / store-and-forward.** There is no
  server-side queue holding undelivered plaintext OR ciphertext
  beyond the delivered artifact rows themselves.
- **I-3 · no plaintext exception.** There is no "business chat" /
  "NEX Official" / "HQ chat" exception that puts plaintext of a
  private peer conversation on the server.
- **I-4 · no historical deletion without separate authorisation.**
  Legacy plaintext rows are not scrubbed by NEX without an explicit
  owner-sealed deletion authorisation.
- **I-5 · no rollback restores private content.** Rollback scripts
  must not re-materialise plaintext that an earlier step eliminated.
- **I-6 · no public privacy claim until State C independently
  verified across every applicable surface atomically.** Engineering
  ceiling = Verified. Live-verified is an owner infra call.

---

## 1. Current state inventory

### 1.1 What exists today

**Migrations (applied in sandbox unless noted).**

- `092_nex_account_device_key.sql` · per-device Curve25519 public
  keys · one row per (account_id, device_id) · public key readable
  by any authenticated user, writable by owner only · RLS sealed.
- `093_nex_peer_message_encrypted.sql` · dual-mode extension to
  `nex_peer_message`: adds `encrypted`, `ciphertext`, `nonce`,
  `sender_public_key`, `sender_device_id`, `recipient_device_id`,
  `message_group_id`, `delivered_at`. Shape check enforces either
  pure-plaintext (`encrypted=false`, all ciphertext columns NULL) or
  pure-ciphertext (`encrypted=true`, all ciphertext columns NOT
  NULL). Body column relaxed to accept the sentinel `(encrypted)`.
- `094_nex_purge_delivered_encrypted.sql` · SECURITY DEFINER function
  `nex_purge_delivered_encrypted_messages(retain_days int default 7)`
  that drops `encrypted=true AND delivered_at IS NOT NULL` rows
  older than the retention window. Never touches `encrypted=false`
  rows. Floor of 1 day protects against misconfigured cron.
- `295_nex_peer_chat_ciphertext_bucket.sql` · **authored · NOT yet
  applied.** Adds `storage.objects` RLS for a private bucket
  `nex-peer-chat-ciphertext` (service_role full access · anon and
  authenticated explicitly denied via restrictive policy). The
  bucket itself must be created out-of-band via the Supabase Storage
  API before the migration is applied (migrations cannot create
  buckets). Public bucket `nex-peer-chat-attachments` from migration
  055 stays untouched for historical compatibility.
- `298_nex_peer_chat_envelope_overlay.sql` · envelope overlay
  support (ancillary — does not change the three fundamental
  columns).

**Client crypto (TypeScript · `src/lib/nex-native/crypto/`).**

- `device-key.ts` · `ensureDeviceKey()` idempotently reads or
  generates a Curve25519 keypair in IndexedDB. Device id is a stable
  per-browser UUID. `forgetDeviceKey()` wipes.
- `device-key-cache.ts` · 60-second in-memory cache around
  `listAccountDeviceKeysAction` to avoid re-fetching the peer device
  list on every send.
- `shared-secret.ts` · `getSharedSecret()` precomputes an X25519
  shared secret per (peerAccountId, peerDeviceId) and caches in
  module memory. `generateNonce()`, `sealWithSharedSecret()`, and
  `openWithSharedSecret()` are thin wrappers over `nacl.box.after /
  open.after`.
- `encrypted-send.ts` · `sendEncryptedPeerMessage()` fetches peer +
  self devices, ensures the local keypair, builds one row per peer
  device + one row per self device (for self-echo), encrypts each
  with its own shared secret and fresh 24-byte nonce, and POSTs the
  batch to `/api/nex-native/peer-message/encrypted` with a single
  `message_group_id`. Falls back cleanly when either side has zero
  devices registered.
- `encrypted-receive.ts` · `decryptEncryptedRows()` filters to rows
  addressed to the local `deviceId`, derives the shared secret with
  the sender's recorded public key, decrypts, and returns
  plaintext. Tamper / wrong-device / decode errors are surfaced
  explicitly.
- `attachment-envelope.ts` · envelope encryption for personal media
  attachments (image/video/audio). Random 32-byte content key +
  24-byte nonce encrypts file bytes once (nacl.secretbox). Content
  key is then wrapped per recipient device via `nacl.box.after` with
  that device's shared secret. Full envelope stored in
  `attachment_meta.envelope` on every fan-out row.
- `encrypted-attachment-upload.ts` · encrypts file bytes in-browser
  and POSTs ciphertext to `/api/nex-native/attachment/encrypted`.
  Optional client-side image downscale to ≤1600 px longest edge
  for the "standard" quality tier.
- `message-store.ts` · per-device IndexedDB cache of decrypted
  message rows. Separate from the device-key store so a "forget
  history" affordance does not wipe keys.

**Server routes.**

- `/api/nex-native/peer-message/encrypted/route.ts` · validates
  caller session, per-row shape, fan-out ≤32, hands the bundle to
  `sendEncryptedPeerMessages()` for a single atomic insert. Never
  reads plaintext. Emits one realtime arrival event + one push
  notification (generic preview strings only, localised in the
  recipient's saved locale).
- `/api/nex-native/peer-message/delivered/route.ts` · the
  decrypt-ack POST that flips `delivered_at` so the Bridge 78 purge
  function can eventually remove the ciphertext.
- `/api/nex-native/peer-message/since/route.ts` · incremental fetch
  endpoint for the client decryptor.
- `/api/nex-native/attachment/encrypted/route.ts` · ciphertext
  upload · writes to the private bucket via `nexSupabaseAdmin` when
  `ensurePrivateBucketReady()` returns true, 503s otherwise (NEVER
  silently falls back to the public bucket).
- `/api/nex-native/attachment/encrypted/signed/route.ts` ·
  short-lived signed-URL mint for the recipient to fetch the
  ciphertext object.

### 1.2 What is missing

- **Fully device-only path.** The new-send code path transparently
  falls back to plaintext send when either side has zero devices
  registered. That is the correct defensive behaviour today but it
  means the system has not yet been flipped to "ciphertext-only · no
  plaintext fallback" for Priority 1 launch gates. Decision pending
  on the owner-sealed trigger for the flip.
- **Offline delivery clarity.** The dual-mode table is currently the
  delivery mechanism for offline recipients (ciphertext row sits in
  the recipient-device-id query until the device polls). No
  explicit retention cap is set for undelivered rows. Owner-decision
  needed.
- **Attachment ciphertext.** Private bucket + migration 295 exist in
  source only. The bucket is not provisioned. Legacy
  `nex-peer-chat-attachments` is public (migration 055). New
  attachments must land in the private bucket exclusively; old
  attachments remain accessible for history decryption but are not
  backfilled.
- **Lost-device recovery.** No server-side recovery is provided or
  planned. This is intentional per I-1 but is not yet documented in
  user-facing copy. Stage 2.6 drafts the wording.
- **Key rotation.** The current schema treats each (account_id,
  device_id) as immutable public key. Rotation = new device row.
  A `rotated_from_id` column has not been added; no doctrine yet on
  whether rotation should be surfaced to the recipient.
- **Device removal.** There is no soft-retire vs hard-revoke
  distinction yet. Deleting a device key row today is destructive
  and prevents decryption of history addressed to that key.
- **Legacy plaintext transition.** `encrypted=false` rows exist and
  the freeze trigger is not yet enforced at DB level.

### 1.3 Repository + credentials context

Canonical repo for this doctrine: `C:/Users/Victus/nexapp`
(GitHub `Philip2024394/nexapp`). The Supabase project is
`ijvqdvsvwtwxzcqmoqit` in production; sandbox work uses
`kdstoyyeygcopkogqsyv` per the owner-sealed sandbox envelope. No
migration in this plan is authorised for production apply by this
document.

---

## 2. Key lifecycle (staged)

Each stage lists the migration touch, the code boundary, and the
owner decision gate.

### 2.1 Device registration

**Already implemented · migration 092 · `device-key.ts`.**

- First time the user opens any chat surface on a browser,
  `ensureDeviceKey()` reads IndexedDB.
- If no record exists, `nacl.box.keyPair()` produces a fresh
  Curve25519 keypair in-browser.
- A fresh UUID is minted as the `device_id` and stored in the same
  IndexedDB record as the secret key.
- The public key + device_id is uploaded via the existing device-key
  server action.
- The secret key never leaves the browser.

**No new migration.** No new code boundary. This stage is in place.

### 2.2 Device identifier

**Already implemented.** `device_id` is stored in IndexedDB alongside
the keypair. Opaque to the server. Scope: per (browser profile,
origin). Clearing IndexedDB or using a different profile creates a
new device.

**Gap documented.** There is no cross-browser "same device"
heuristic by design — two browsers on the same physical machine are
two devices.

### 2.3 Multi-device handling

**Already implemented · schema + client fan-out.**

- Schema: `nex_account_device_key` is `UNIQUE (account_id,
  device_id)` and indexed by `(account_id, last_seen_at DESC)`.
- Server-side list: `listAccountDeviceKeysAction` returns all device
  rows for an account to any authenticated caller (needed so a
  stranger can encrypt to a not-yet-friend recipient).
- Client fan-out: `sendEncryptedPeerMessage` loops every target
  device (peer devices + self devices) and inserts one
  `nex_peer_message` row per device, all sharing
  `message_group_id`.

**Owner-decision reinforcement needed.** Should `last_seen_at` be
used to filter stale devices server-side at fan-out time? Current
behaviour: encrypt to every registered device, let stale rows fail
to decrypt silently. Deferred to Stage 2.5.

### 2.4 Key rotation

**Not yet implemented. Owner decision open.**

**Proposal (not authorised).**

- A device "rotates" by generating a new keypair in the same
  IndexedDB record and uploading a new row with a new `device_id`.
  The old row is marked for soft-retire (Stage 2.5).
- Senders consult the device list on each send; because
  `device-key-cache.ts` has a 60-second TTL, recipients see the new
  key within 60 seconds of the first sender-side fetch after
  rotation.
- Recipients do NOT re-encrypt historical rows. Historical rows
  stay addressed to the old (`device_id`, public key); the retiring
  device keeps the old secret until it genuinely leaves.

**Migration needed · `nex_account_device_key.rotated_from_id uuid null`.**

- Null when the device registered fresh.
- Set to the previous device's id when rotation produced this row.
- Index optional; no RLS change; backfill all existing rows to null.

**Alternative (Stage 2.4b) deferred to owner.** Add a `revoked_at`
column so the recipient UI can surface "a device of this user was
retired." This is cosmetic and depends on the owner's privacy
preference — rotation visibility can leak device-count info.

### 2.5 Device removal

**Not yet implemented. Owner decision open.**

**Proposal (not authorised).** Introduce two paths:

- **Soft-retire.** Set `retired_at timestamptz` on the device row.
  Senders stop encrypting new sends to this device. The device's
  secret key remains in IndexedDB and can still decrypt historical
  rows it received before retirement.
- **Hard-revoke.** `retired_at` + `revoked_at` + row kept only for
  audit integrity (recipient history metadata). On hard-revoke, the
  owning account issues a signed statement that the private key is
  destroyed / lost and no future sends should address it. Clients
  SHOULD delete the local IndexedDB record on hard-revoke.

**Migration needed · `nex_account_device_key.retired_at timestamptz
null`, `revoked_at timestamptz null`, partial index `(account_id)
WHERE retired_at IS NULL` for fan-out lookup speed.**

**Owner-decision gate.** Should `retired_at IS NOT NULL` filter be
applied at the `listAccountDeviceKeysAction` layer (server-side
hiding of retired devices from stranger-callers) or only at the
sender-side fan-out loop? Server-side filtering leaks less; both
are safe.

### 2.6 Lost-device recovery

**Explicit position — document only · no code change.**

**Statement to display to users.**

> If you lose this device or clear browser data, messages
> previously sent only to this device cannot be recovered. NEX does
> not keep a copy of your private messages on our servers. We also
> cannot restore your encryption key. Make sure you can sign in on a
> second device to keep access to any future messages.

**Technical rationale.**

- Secret keys live in IndexedDB on exactly the device that
  generated them.
- Historical ciphertext rows addressed to a lost device are not
  decryptable by any key the user still holds (see I-1, I-5).
- Server cannot help because it never saw plaintext and never held
  the recipient's secret key.

**Tradeoff acknowledged.** Users who sign in on exactly one device
and then lose that device lose their private message history. This
is the direct cost of the sealed "device-only" doctrine and must be
in launch copy before any public claim.

---

## 3. Multi-device send fan-out

Already partially shipped. This section enumerates the full
invariants the plan commits to preserving.

### 3.1 `message_group_id`

- Generated by the sending client as `crypto.randomUUID()`.
- Written to every row in a single send (peer devices + self
  devices).
- NEVER reused.
- UI deduplicates sender-side bubbles by grouping on
  `message_group_id` so the sender does not see N copies of their
  own outbox entry.

### 3.2 Per-row nonce

- Each row carries its own `nonce` column (24 bytes,
  `nacl.box.nonceLength`).
- Nonce is uniformly random per row, generated via `nacl.randomBytes`.
- MUST NOT be reused across rows of the same group (reuse breaks
  confidentiality when combined with the same (sender, recipient)
  shared secret).

### 3.3 Server never sees plaintext

- `/api/nex-native/peer-message/encrypted/route.ts` receives base64
  ciphertext + base64 nonce + public key metadata only.
- Server-side validation is shape-only (field types, fan-out
  cardinality cap of 32, base64 decode success).
- Realtime nudge and push notification carry generic preview strings
  from an i18n table, never plaintext, never ciphertext.

### 3.4 `delivered_at` semantics

- Null at insert.
- Flipped by the recipient device via
  `/api/nex-native/peer-message/delivered/route.ts` after the
  ciphertext is decrypted successfully on the device (post Poly1305
  tag verification).
- Fires only for rows where `recipient_device_id` matches the
  local `deviceId` — other devices' rows are not touched by this
  client.
- Once every device's row has `delivered_at IS NOT NULL` and the
  retention window elapses, the Bridge 78 purge drops the
  ciphertext. If a device never comes online, that device's row
  persists; see Section 5 for the retention cap decision.

### 3.5 Atomicity

The server-side `sendEncryptedPeerMessages()` inserts all N rows in
a single transaction. If any row fails the shape check, the whole
batch rolls back. There is no partial fan-out state visible to
peers.

---

## 4. Attachment encryption

### 4.1 Client-side encryption

- Algorithm: `nacl.secretbox` (XSalsa20-Poly1305). Already
  implemented in `attachment-envelope.ts`. This is symmetric
  authenticated encryption with a 16-byte Poly1305 tag; any
  tamper fails open with `null` from `nacl.secretbox.open`.
- Content key: 32 random bytes per attachment, generated in
  `encryptFileBytes()`.
- Content nonce: 24 random bytes per attachment.
- Encryption runs on the raw file bytes before upload. The server
  receives ciphertext bytes as `application/octet-stream`.

### 4.2 Upload target

- New uploads: private bucket `nex-peer-chat-ciphertext`
  (migration 295 RLS, bucket creation separate). Written by
  `nexSupabaseAdmin` service role; anon + authenticated roles are
  denied by restrictive policy.
- `/api/nex-native/attachment/encrypted/route.ts` already refuses
  to fall back to the public bucket. On `ensurePrivateBucketReady()`
  returning false, it responds 503 with `Retry-After: 60`.
- Legacy bucket `nex-peer-chat-attachments` (public, migration 055)
  is **not deprecated by this plan.** Old envelopes with
  `storage_url` continue to resolve against it for history-decryption
  purposes. New envelopes carry `storage_path` only, resolved via a
  signed URL from the private bucket.

### 4.3 Per-device content-key wrap

- The content key is wrapped per target device via
  `nacl.box.after(contentKey, wrapNonce, sharedSecret)` where
  `sharedSecret` is the per-(sender, recipient-device) X25519 secret.
- One wrap per target device (every peer device + every self
  device). Each wrap has its own 24-byte `wrap_nonce`.
- The wrapped keys ship inside the envelope on
  `attachment_meta.envelope.wrapped_keys[]`, one entry per
  `device_id`.

### 4.4 Signed-URL mint

- Recipient device requests
  `/api/nex-native/attachment/encrypted/signed` for a given
  `storage_path`.
- Server verifies the caller is a participant in the conversation
  that references this attachment and mints a Supabase signed URL
  with a short TTL (owner-decision gate: current implementation
  must be reviewed; 120-second TTL suggested as cap).
- The signed URL is single-use in practice because the client
  decrypts immediately on fetch; the TTL exists to prevent URL
  leakage in logs from becoming a long-lived access handle.

### 4.5 Legacy public bucket

- Explicit non-goal: do not migrate old public attachments into the
  private bucket. The historical plaintext-adjacent model is
  grandfathered. New-send flow is the only ingress authorised to
  write the private bucket.
- Future "privacy sweep" to delete old public attachments is
  gated by I-4 and requires separate owner authorisation.

---

## 5. Offline delivery

### 5.1 Invariant restated

Per I-2, there is NO server-side queue, stash, or store-and-forward
layer beyond the fan-out rows themselves. Fan-out rows are not a
"queue" in the sense I-2 forbids — they are the delivered artifact,
written atomically with the send. The queue I-2 forbids is a
secondary encrypted-blob staging area keyed to "undelivered-yet,"
with retry semantics, redelivery, or cross-session persistence
beyond what `nex_peer_message` already provides.

### 5.2 Offline recipient flow

1. Alice sends. Fan-out writes N rows: 1 per Bob device + 1 per
   Alice device. Bob's phone is offline.
2. Alice's own self-echo row decrypts immediately; her UI shows
   the message.
3. Bob's row for the offline phone sits in `nex_peer_message` with
   `encrypted=true` and `delivered_at IS NULL`.
4. When Bob opens NEX on that phone, the decryptor requests rows
   since the last known cursor via `/peer-message/since`,
   decrypts, writes to IndexedDB, and POSTs `delivered_at` to
   `/peer-message/delivered`.
5. Once the retention window elapses after `delivered_at` is set,
   the Bridge 78 purge removes the ciphertext row. Bob's device
   keeps the plaintext in IndexedDB (message-store.ts) if he
   chose to retain history on that device.

### 5.3 Retention cap — owner decision needed

- Current function: `nex_purge_delivered_encrypted_messages(7)` only
  touches rows WHERE `delivered_at IS NOT NULL`. **It never deletes
  undelivered rows.**
- A rule is needed for the ceiling on `delivered_at IS NULL` row
  age. Three options for the owner:

  - **Option A · indefinite.** No cap. If a recipient device never
    comes online, the ciphertext row sits forever. Risk: storage
    cost grows linearly with lost devices. Benefit: no message is
    silently discarded.
  - **Option B · hard cap · N days.** After N days undelivered,
    purge the row. Consequence: a recipient who takes >N days to
    open NEX on that device loses the message. Suggested N = 30.
  - **Option C · two-stage.** Soft-signal to sender after N days
    ("your message was not delivered to all devices · 1 of 2
    devices has not synced") and hard-purge at M days (M > N).
    Suggested N = 7, M = 30.

- No option is authorised by this document. Owner must pick one
  before any migration numbered in Section 10 for this behaviour
  is applied.

### 5.4 Non-queue clarification

The server-side infrastructure does NOT:

- re-send ciphertext rows on retry policies;
- hold a separate "undelivered pile";
- maintain delivery-retry metadata beyond the single
  `delivered_at` timestamp;
- buffer push notifications or store notification bodies.

The server-side infrastructure DOES:

- let the recipient device poll `/peer-message/since` for rows
  addressed to its `recipient_device_id`;
- emit one realtime arrival event per send (the client decides
  whether to react);
- emit one push notification per send with a generic preview.

---

## 6. Legacy plaintext transition

### 6.1 Freeze

**Trigger (owner decision needed).** Flip a feature flag
`NEX_PRIVATE_CHAT_CIPHERTEXT_ONLY` that:

- forces `sendEncryptedPeerMessage` on all private chats where both
  sides have ≥1 device key;
- refuses to send if either side has zero device keys (currently
  this falls back to plaintext);
- the refusal triggers a user-facing prompt: "Please open NEX on
  the other device to continue."

No DB migration required for the freeze itself — it is a code
boundary. A follow-up DB CHECK constraint can be added after a
burn-in period to reject future `encrypted=false` inserts.

### 6.2 Catalog

**Per-account read-only inventory.**

- A SECURITY DEFINER function
  `nex_legacy_plaintext_count(account uuid) returns int` that
  counts `nex_peer_message` rows where the caller is a participant
  and `encrypted=false`.
- Exposed via a dedicated server action, not via general RLS, so
  the count is accurate without widening read access.
- The UI surfaces the count on the user's settings page:
  "You have 4,218 older messages that are not yet secured on this
  device. Secure past chats →".

### 6.3 User-driven re-encrypt

**Client-side operation, strictly opt-in.**

1. User taps "Secure past chats on this device."
2. The client reads the user's own plaintext rows participant-by-
   participant via a paginated endpoint.
3. For each plaintext row, the client re-encrypts the body for
   every current device (sender's own self-echo + peer's devices)
   and writes new `encrypted=true` rows via a dedicated bulk
   endpoint.
4. The old `encrypted=false` row is marked `superseded_by_id uuid`
   pointing to the new ciphertext group id (NOT the individual
   fan-out rows, to keep the pointer stable).
5. NEX never deletes the old row in this flow. I-4 is honoured.

**Owner-decision gate.** Bulk encryption of history multiplies
storage by N-devices per row. For an account with N=3 and 10,000
legacy rows, that is 30,000 new ciphertext rows. The staged plan
assumes the owner wants this operation gated behind an explicit
button, not run automatically on login. This matches sealed I-4
and I-5.

### 6.4 Retention

- After `superseded_by_id` is set and the ciphertext group is
  decrypted on at least one recipient device, the user may
  **manually** request deletion of the old plaintext row.
- Deletion is scoped to the account that authored the message (RLS
  enforces: the sender account_id must match `auth.uid()` to
  delete).
- NEX itself does NOT sweep legacy plaintext rows. Honouring I-4
  verbatim.

---

## 7. Verification tests (automated · local-only)

All tests live under `__tests__/` colocated with the crypto modules
and the API routes. All run via `npm run test` (vitest).

### 7.1 Cryptographic correctness

- **Known-vector test.** Encode a fixed plaintext with fixed
  keypair + nonce; assert ciphertext bytes match a hardcoded
  reference vector. Guards against an upstream tweetnacl regression.
- **Round-trip test.** Random plaintext (≥10 cases) through
  `sealWithSharedSecret` + `openWithSharedSecret` returns the
  original bytes.
- **Tamper rejection.** Flip any one byte of ciphertext; assert
  `openWithSharedSecret` returns `null` (Poly1305 tag fails).
- **Nonce uniqueness test.** Generate 10,000 nonces; assert no
  collisions.

### 7.2 RLS tests

- **Device-scope isolation.** Create accounts A + B, device rows
  A-d1, B-d1, B-d2. Insert fan-out rows from A → B-d1 + B-d2 + A-d1.
  Sign in as B with d1's session; assert reading the row addressed
  to B-d2 is forbidden by RLS (zero rows visible for the wrong
  `recipient_device_id`). Separate test asserts B CAN see the row
  addressed to B-d1.
- **Legacy coexistence.** Same conversation holds one
  `encrypted=false` row and three `encrypted=true` rows. B's device
  sees the plaintext row via the legacy RLS path AND the single
  ciphertext row addressed to it, never the other two.
- **Public-key readability.** Verify any authenticated account can
  SELECT from `nex_account_device_key` (needed for fan-out). Verify
  only the owner account can INSERT/UPDATE.

### 7.3 Multi-device send

- **Fan-out cardinality.** A has 2 devices, B has 3 devices. A send
  produces exactly 5 rows (3 for B + 2 for A for self-echo),
  all sharing `message_group_id`.
- **One unique nonce per row.** Collect every row's nonce and
  assert pairwise distinct.
- **Per-device decrypt.** Each of B's 3 devices decrypts its own
  row successfully; attempts to decrypt a sibling row with the
  wrong secret return `null` (covered by 7.1 tamper + 7.2 RLS).

### 7.4 Failure-path tests

- **Device-key lookup fails.** Simulate `listAccountDeviceKeysAction`
  returning an empty list. Assert `sendEncryptedPeerMessage`
  returns `{ok: false, error: "no_peer_devices"}` without any
  server call.
- **Network interrupt mid-send.** Mock a 500 on the encrypted
  endpoint; assert the client returns `{ok: false, error: "http_failed"}`
  and no partial DB state is written (verified via a follow-up
  SELECT that returns zero rows for the group id).
- **Attachment wrap failure.** Corrupt a target device's public key
  byte; assert the wrap step fails loudly BEFORE upload is attempted
  so no orphan ciphertext object is written.
- **Decrypt-on-receive failure.** Insert a row with a tampered
  nonce; assert the client decrypts to the `tamper` error branch
  and does NOT mark `delivered_at`.

### 7.5 Legacy co-existence

- A conversation with mixed `encrypted=false` and `encrypted=true`
  rows hydrates in chronological order on the client.
- The purge function run against this conversation touches only
  the ciphertext rows whose `delivered_at` is older than the
  retention window.

---

## 8. Rollback and recovery (I-5)

Every migration in this programme must ship with a sibling
`.rollback.sql`. Migrations 092 / 093 / 094 / 295 already follow
this convention. New migrations in Section 10 MUST too.

### 8.1 Rollback consequences — what gets lost

- **Migration 092 rollback.** Drops `nex_account_device_key`.
  Every device's public key record disappears. All future sends
  revert to legacy plaintext path until re-applied. Private keys
  in IndexedDB are not affected; they become orphaned but
  unusable. **No private content is restored** — I-5 satisfied.
- **Migration 093 rollback.** Drops the ciphertext columns from
  `nex_peer_message`. Any ciphertext rows already in the table
  become malformed under the old schema. The rollback script MUST
  delete `encrypted=true` rows before dropping columns (not copy
  them anywhere). **No private content is restored** — I-5
  satisfied.
- **Migration 094 rollback.** Drops the purge function. Benign.
- **Migration 295 rollback.** Drops the three storage.objects
  policies. The bucket remains private because its `public: false`
  flag is not controlled by this migration.
- **Future migrations in Section 10 rollback.** Each must
  explicitly state what disappears. The rule: a rollback NEVER
  re-materialises plaintext that an earlier applied step
  eliminated. If a rollback would need to restore plaintext to be
  "complete," the step is NOT a valid rollback — the previous
  step must be redesigned to avoid a plaintext dependency.

### 8.2 Mid-programme rollback

If the owner halts mid-programme at stage k:

- Stages ≤ k remain applied.
- Stages > k never applied.
- No data-restoration is attempted. Users with partially-rotated
  device lists see slightly inconsistent "which devices are
  current" UI until the programme resumes or rolls back fully.

---

## 9. Launch gate checklist (I-6)

Per I-6, no public privacy claim is made until State C is
independently verified across every applicable surface atomically.
This section lists what State C requires for the device-key chat
programme specifically.

### 9.1 Atomicity

- `sendEncryptedPeerMessages()` must insert N rows in a single
  transaction. Verified by a test that forces a shape-check
  failure on row N and asserts rows 1..N-1 were rolled back.
- Attachment ciphertext upload + fan-out row insert are NOT
  atomic across the two systems (storage + DB). The plan
  acknowledges a narrow window where upload succeeds but the DB
  insert fails. Mitigation: a nightly orphan-object sweep scoped
  to ciphertext objects with no referencing row older than 24
  hours. **Owner decision needed on the sweep frequency.**

### 9.2 Deletion atomicity

- A seller-retire-conversation action (or any "delete
  conversation") must atomically remove:

  - every `nex_peer_message` row in the conversation;
  - every ciphertext storage object referenced by those rows'
    envelopes;
  - any IndexedDB entries on the local device (client-side
    sibling cleanup).

- If any of the three cannot complete, the user MUST see the
  partial-state honestly (no "all clean" claim). Message must
  state which layer failed and what remains.

### 9.3 Audit trail

- Server-visible for private peer chat:

  - participant IDs
  - conversation ID
  - message ID + group ID
  - `created_at`, `delivered_at` timestamps
  - ciphertext length (byte count)
  - `encrypted` flag (true/false)

- NOT server-visible / never stored:

  - plaintext body
  - decryption keys
  - decrypted attachment bytes
  - push notification bodies containing message content

- No admin interface exposes an authenticated plaintext-recovery
  pathway, consistent with I-1 and I-3.

### 9.4 Launch copy must land before claim

- The lost-device recovery wording (§2.6) must appear in onboarding
  for every applicable surface.
- "NEX does not keep a copy of your private conversations" claim
  is NOT publishable until every surface above meets State C and
  the independent evidence listed in sealed memory V-NET-1/2,
  V-STORE-1/2/3, V-LOG-1, V-SIG-1, V-TURN-1, V-DELETION-1 is
  produced.

---

## 10. Staged migration numbers (authored · NOT yet applied)

Numbering starts at **323** because the latest populated migration
in `nex-supabase/migrations/` is 322 (`322_nex_payment_provider_config_PROPOSAL.sql`).
The 318 number range includes documentation siblings. If the owner
authorises numbers later in sequence, renumber consistently.

Nothing here is authorised for application. All are drafts for
owner review. Sandbox application is also NOT authorised without a
separate word-trigger ("apply 323 sandbox", etc.).

### 10.1 Migration 323 · `nex_account_device_key_rotation`

- **Scope.** Add `rotated_from_id uuid null` to
  `nex_account_device_key`. Optional `revoked_at timestamptz null`
  if §2.4b accepted.
- **Dependencies.** 092 applied.
- **Rollback.** Drop the columns. Benign. No plaintext at risk.

### 10.2 Migration 324 · `nex_account_device_key_retirement`

- **Scope.** Add `retired_at timestamptz null` to
  `nex_account_device_key`. Add partial index
  `(account_id) WHERE retired_at IS NULL`.
- **Dependencies.** 092 applied.
- **Rollback.** Drop the column + index. Benign.

### 10.3 Migration 325 · `nex_peer_message_legacy_pointer`

- **Scope.** Add `superseded_by_id uuid null` to
  `nex_peer_message`. Partial index
  `(superseded_by_id) WHERE superseded_by_id IS NOT NULL`.
- **Dependencies.** 093 applied.
- **Rollback.** Drop the column + index. Does NOT restore any
  plaintext; satisfies I-5.

### 10.4 Migration 326 · `nex_peer_message_ciphertext_only_check`

- **Scope.** Deferred CHECK constraint on `nex_peer_message`
  rejecting new inserts with `encrypted=false` when both sender and
  recipient have ≥1 non-retired device key row, enforced via a
  trigger (because CHECK cannot reference other tables). Existing
  rows are grandfathered.
- **Dependencies.** 093 applied · 324 applied.
- **Rollback.** Drop the trigger. Legacy inserts become possible
  again. No plaintext restoration implied.
- **Decision gate.** Only apply after the client-side freeze
  (§6.1) has burned in for an owner-defined period.

### 10.5 Migration 327 · `nex_peer_message_undelivered_retention`

- **Scope.** Extend
  `nex_purge_delivered_encrypted_messages(retain_days int)` to a
  second function
  `nex_purge_undelivered_encrypted_messages(retain_days int)` that
  deletes `encrypted=true AND delivered_at IS NULL` rows older than
  the retention cap chosen in §5.3. Retention default documented in
  the migration comment; chosen value lives in a config table,
  NOT hardcoded.
- **Dependencies.** 094 applied · §5.3 owner decision made.
- **Rollback.** Drop the new function. Pending ciphertext rows
  persist. No plaintext implications.

### 10.6 Optional migration 328 · `nex_peer_chat_ciphertext_object_lifecycle`

- **Scope.** Nightly maintenance function
  `nex_sweep_orphan_ciphertext_objects()` that reconciles storage
  objects in `nex-peer-chat-ciphertext` against
  `attachment_meta -> 'envelope' ->> 'storage_path'`. Deletes
  objects older than 24h with no referencing row. Protects against
  the upload-succeeds / DB-insert-fails window from §9.1.
- **Dependencies.** 295 applied · bucket provisioned.
- **Rollback.** Drop the function. Orphan objects linger. No
  plaintext implications.

---

## 11. What this plan does NOT authorise

**Nothing.**

- No DB migration apply (sandbox or production).
- No bucket creation.
- No RLS change.
- No `.env` change.
- No code merge to main.
- No push to GitHub.
- No Vercel deploy.
- No production Supabase operation of any kind.
- No public privacy claim (see I-6).
- No deletion of legacy plaintext rows.
- No forced device-key rotation for any user.

This document is a doctrine draft for owner review. Each stage,
each migration number, each §5.3 retention option, each §9.1 sweep
cadence, and each §6.1 flip trigger requires a separate explicit
owner word-trigger before implementation or application. The
Constitution at `C:/Users/Victus/nexapp/CLAUDE.md` §4 and §5 apply
in full: a request to design, draft, or scope does not authorise a
push or deploy.
