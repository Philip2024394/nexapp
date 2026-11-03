# NEX Option 2 · Complete architecture review · DRAFT

**Status:** DRAFT · owner-authorised 2026-11-03 for consolidated-review production only.
**Implementation status:** FROZEN · no production access · no migrations applied · no code changed. Gate 1 (operational ownership) is a separate workstream and is NOT addressed here.
**Supersedes / consolidates:** `b0-cleanup-worker-design.sql`, `b0-concurrency-and-recovery-review.md`, `b0-trust-states-design.md`, `b0-device-key-coverage.sql`, `b0-rehearsal-*`. Those remain the source for implementation-stage details; this is the single architectural lens.

## 0 · Purpose and non-goals

Option 2 means: **NEX never stores a user's chat content it can decrypt.** The device is canonical. The server is a transient encrypted relay. All plaintext access terminates at a user-controlled device holding the private key.

**Non-goals (explicit, out of scope for this review):**
- Group chat (NEX is 1:1 under Option 2).
- Server-mediated search of message content.
- Message history available to a brand-new device without an owner-provided backup.
- Hardware-security-module-backed private keys (browser-based ed25519/x25519 only in this iteration).
- Perfect forward secrecy via Double Ratchet (deferred · nacl.secretbox per-message is the current baseline).
- Metadata minimization beyond stage B9.
- Any claim that NEX can read, moderate, or recover an undelivered message's plaintext.

---

## 1 · Device-local canonical message storage

### Design

Each device maintains an IndexedDB store `nex-native-chat` with full plaintext history for its account:

- `conversations` · one row per peer `(account_id, display_name, last_message_at)`
- `messages` · plaintext body + attachment refs + timestamps · keyed by `(conversation_id, message_id)`
- `trusted_contacts` · trust-state record per peer (see §8)
- `pending_sends` · outbound messages queued while offline

The device holds the only full-fidelity, decrypted copy. The server never sees plaintext body.

### Honest limitations

- Browser IndexedDB is not encrypted at rest by default. A user with device access reads plaintext.
- Private browsing modes may clear IndexedDB on tab close · users must be told this before relying on the device.
- Storage pressure (quota eviction) can delete the plaintext cache without warning. Users must export if they care about history.
- An untrusted browser extension can read anything the page renders. Not solvable by NEX.

### Required supporting migration

Already covered by Bridge 77 (IndexedDB plaintext cache · sealed). No new DB migration required for this layer.

---

## 2 · Ciphertext-only temporary relay

### Design

Server-side `nex_peer_message` holds **only** encrypted payloads:

```
nex_peer_message (
  id, conversation_id, sender_account_id, recipient_device_id,
  message_group_id,              -- same across all fan-out rows for one send
  ciphertext bytea NOT NULL,     -- nacl.secretbox output
  content_key_wrapped bytea NOT NULL,  -- wrapped per recipient device
  nonce bytea NOT NULL,
  sent_at, ttl_expires_at, delivered_at,
  attachment_ref uuid NULL,      -- see §5
  …
)
```

No `body` column. No plaintext path. The service-role key cannot read user content because the content key is wrapped to each recipient device's public key · the server has no private key to unwrap.

### What this costs us

- NEX cannot moderate chat content. Abuse response is limited to metadata-based signals (velocity, device-ID reputation) and user-reports (which cite plaintext the reporter already holds).
- NEX cannot restore an in-flight message if a device loses state before ACK.
- NEX cannot serve a traditional "read receipts across devices" feature without broader design work.

### Required supporting migration

B1 · plaintext freeze (drops `body` column after dual-write period) · UNAUTHORISED.

---

## 3 · Multi-device delivery and ACK

### Design

**One row per recipient device.** When Alice sends to Bob and Bob has three devices (phone / tablet / laptop), the sender's device:

1. Fetches Bob's device key list (filtered to non-revoked).
2. For each of Bob's N devices, wraps the content key to that device's public key.
3. Writes N rows into `nex_peer_message` sharing a `message_group_id`.

**ACK rule: all-devices-ACK, not first-ACK.** A device marks its row `delivered_at = now()` only when its local client has written the plaintext to its own IndexedDB and committed. The sender's "delivered" indicator does not light up until **every** non-revoked recipient device has ACKed, OR TTL has expired.

### Why not first-ACK

If one of Bob's devices is a laptop that's been closed for a week, first-ACK (from phone) tells Alice "delivered" and the server would be free to purge. The laptop then opens, polls, and finds nothing. Message lost. All-devices-ACK trades a weaker "delivered" semantic (eventual within TTL) for not silently losing messages to offline devices.

### Interaction with revocation

A device revoked **after** send-time retains its row until TTL (we can't tell whether the device successfully pulled the ciphertext between send and revocation · see §4). A device revoked **before** send-time means the sender never fan-out-wrote to it in the first place.

### Required supporting migration

Already covered by migration 092 (device_key composite UNIQUE) + 047 (peer messages). B4 · ACK sweep enforces all-devices-ACK semantic at cleanup time. UNAUTHORISED.

---

## 4 · TTL and revocation behaviour

### TTL

Every row has `ttl_expires_at = sent_at + 7 days` (proposed · value not final). After TTL:

- Row is cleanup-eligible regardless of ACK state (undelivered messages are lost · this is the time boundary we promised).
- The sender's UI shows an "undelivered" indicator for any device that never ACKed before TTL.
- Attachment reference is enqueued for purge.

### Revocation semantics

`nex_account_device_key.revoked_at` is the only authority:

| Case | Predicate | Treatment |
|---|---|---|
| REVOKED_BEFORE_SEND | `k.revoked_at <= m.sent_at` | Sender-side artefact · the sender should never have fan-out-written here · cleanup-eligible immediately. |
| REVOKED_AFTER_SEND | `k.revoked_at > m.sent_at` | Device existed at send-time · may have fetched ciphertext in the window · retain until TTL. |
| NEVER_REVOKED | `k.revoked_at IS NULL` | Standard delivery path. |
| MISSING_KEY | `k.id IS NULL` | Quarantine · never automatic cleanup · see §7. |

### Required supporting migration

B5 · TTL enforcement + cleanup worker · design in `b0-cleanup-worker-design.sql`. UNAUTHORISED.

---

## 5 · Attachment upload, delivery and deletion

### Design (upload)

Attachments are **separated** from the message row:

1. Sender's device encrypts the binary with a per-attachment symmetric key `K_att`.
2. Device uploads ciphertext to Supabase Storage (private bucket, service-role gated).
3. Server returns `attachment_ref` uuid.
4. For each recipient device, the sender wraps `K_att` to that device's public key and includes it in that device's `nex_peer_message` row (`content_key_wrapped` field extended · design detail in Bridge 88 sealed-deferred).

### Design (delivery)

Recipient device:
1. Fetches its `nex_peer_message` row · unwraps `K_att`.
2. Uses signed URL (short-lived) to download ciphertext.
3. Decrypts locally with `K_att`.
4. Decrypted plaintext stays in device IndexedDB · never re-uploaded.

### Design (deletion)

Attachment lifecycle is **decoupled** from the message row lifecycle:

- The attachment ciphertext in Storage is purged only when **all** message rows referencing it are cleanup-swept.
- The cleanup worker's `attachment_enqueue` CTE writes to `nex_message_attachment_purge_queue` (dedup via `UNIQUE (storage_bucket, storage_object_key)` + `ON CONFLICT DO NOTHING`).
- The purge worker runs independently, retries with exponential backoff, dead-letters after bounded attempts. See §12 for the Storage DELETE error-class mapping.

### Legacy public-bucket transition

Pre-Option-2 attachments live in a public bucket readable without auth. Policy:

- **Freeze day** · no new uploads to public bucket. All new attachments go to private bucket + encrypted path.
- **Read-only window** · existing public URLs remain readable for N days (owner-decided value · not set).
- **Hard cutoff** · public bucket objects purged. Any client reference becomes 404.

This window is non-negotiable because clients that still cache old-format URLs need time to re-fetch via the encrypted path. The owner must set N.

### Required supporting migrations

- B2 · private bucket + signed URL path · UNAUTHORISED.
- B3 · binary attachment encryption (Bridge 88) · UNAUTHORISED.
- B7 · public-bucket purge · UNAUTHORISED.
- 259 · document-attachment MIME extension · DRAFT UNAPPLIED.

---

## 6 · Group-level concurrency

### Design

Two layers protect the cleanup pipeline:

**Layer 1 · group claim** · transaction-scoped advisory lock keyed by `message_group_id`:

```sql
-- Resolved form (concern 1 of recovery review):
pg_try_advisory_xact_lock(
  hashtextextended(message_group_id::text, 42)   -- 42 = namespace salt for cleanup-worker
)
```

- `hashtextextended(text, int8) → int8` is PG 11+ · safe for Supabase (PG 15/16).
- Namespace salt `42` isolates these locks from other advisory-lock callers (e.g., quota reservation, which should use a different salt).
- `pg_try_advisory_xact_lock(int8)` returns `bool` · the single-arg form matches `hashtextextended` output directly.
- Lock auto-releases on COMMIT/ROLLBACK · no stale-recovery sweep needed.
- Collision risk: 2^64 keyspace · negligible for realistic concurrent group counts.

**Layer 2 · row lock** · `FOR UPDATE SKIP LOCKED` on candidate rows (unchanged from `b0-cleanup-worker-design.sql`). Row locks remain the correctness anchor if a worker crashes before releasing an advisory lock (which cannot happen in-transaction, but is listed for completeness).

### Validation requirement before implementation

Smoke test asserting:
1. `pg_try_advisory_xact_lock(hashtextextended(…))` returns `true` on first attempt, `false` on a concurrent second attempt in a separate session for the same group.
2. Lock releases on both COMMIT and ROLLBACK.
3. Two workers with disjoint groups do not block each other.

### Shardability caveat

Advisory locks are database-local. If the worker is ever sharded across clusters, this layer must be replaced with a claim-table or external coordinator. Must be revisited before any multi-cluster deployment.

---

## 7 · Quarantine and owner-approved resolution

### Design

- `nex_message_group_quarantine (message_group_id PK, first_flagged_at, reviewed_at, resolution, resolution_actor_account_id, resolution_reason, reason, rows_count, missing_device_ids)` — schema NOT drafted here; owned by implementation-stage.
- Quarantine worker scans for groups with any `k.id IS NULL` row, upserts (never overwrites a reviewed row).
- Cleanup worker's `sweepable_groups` NOT EXISTS predicate treats missing-key as a hard blocker regardless of TTL · quarantined groups are NOT force-swept by time.

### Retention policy · OWNER-DECIDED 2026-11-03

**Option (b) · owner-approval-only.** No time-based force-purge. Every deletion of a past-TTL quarantined group requires explicit operator action.

### Resolution choices

| Choice | Effect |
|---|---|
| `registered` | Operator confirms key registry was repaired · cleanup worker picks up group next tick normally. |
| `purged` | Operator confirms device is unrecoverable · runs separate authorised SQL to synthesise revocation at `sent_at` (effect: rows flip from MISSING_KEY to REVOKED_BEFORE_SEND and become cleanup-eligible). |
| `waiting` | Operator leaves in place · no change · group remains until next review. |

### Operational requirements (Gate 1 · separate workstream)

- Dashboard · queue depth, oldest age, per-reason breakdown.
- Alerts · WARN 24h · PAGE 72h · CRITICAL 7d.
- Named owner + notification route + runbook.
- Regular review cadence (value not set).
- Storage capacity threshold (value not set).
- `nex_action_log` entry per resolution with `kind='quarantine_resolution'`.

**None of the above is authorised for implementation here.** Gate 1 unlocks it.

---

## 8 · Four device trust states and QR linking

### Trust states (sealed design · `b0-trust-states-design.md`)

| State | Trigger | UI | Send blocked? |
|---|---|---|---|
| UNVERIFIED | First contact · server keys accepted without out-of-band verification | ⓘ info line on profile | No |
| VERIFIED | User tapped Verify after reading matching safety numbers | ✓ next to display name | No |
| NEW DEVICE | New `device_id` for an existing contact | Blue in-chat notice | No · lower priority than CHANGED |
| CHANGED | Known `device_id` presenting a different public key | Amber in-chat warning | No (owner may tighten later) |

Verification state is **per device**, not per account. A new device never inherits verification from an existing one. VERIFIED badge disappears when any device joins or changes.

### QR linking (secondary device)

Design (NOT YET IMPLEMENTED · requires stage B6):

1. Primary device displays a QR encoding `{ account_id, link_token, hmac_sha256(link_token, root_signing_key) }`.
2. Secondary device scans · validates HMAC · initiates registration against `nex_account_device_key` with primary device's co-signature.
3. Primary device confirms the pairing on its own screen (visual match between a short code shown on both).
4. Secondary device's public key is registered + marked `verified_by_primary = true`.

The HMAC prevents a malicious server from substituting link tokens. The visual-match step prevents a QR replay attack from working silently.

### What this does not protect against

- A compromised primary device at the moment of linking (nothing can save that).
- A user who scans a QR shown to them by a bad actor and confirms the match without actually comparing codes.
- Server-side TOFU on first contact (we cannot retroactively verify the first keys we received were legitimate · verification is required to raise the bar).

---

## 9 · Legacy plaintext transition and export

### Dual-write period

Between B0 and B1 the system runs in **dual-write mode**:
- `nex_peer_message.body` (plaintext · legacy column) continues to be populated.
- `ciphertext` + `content_key_wrapped` + `nonce` (encrypted path) are also populated.
- Clients prefer encrypted path on read, fall back to `body` if encrypted fields are null.

### Freeze cutover (B1)

At freeze day:
- Dual-write STOPS. Only encrypted path is populated for new messages.
- Legacy `body`-only rows remain readable for a defined window (owner-set value, not set).
- Clients MUST tolerate "no plaintext body" from here on.

### Legacy export (user-facing)

Every user must be able to export their legacy plaintext (last-chance archive) before the public-bucket purge:
- `/export-chat-history` endpoint returns the user's full plaintext body as JSON + an inventory of their attachments.
- Available for the duration of the read-only window.
- After public-bucket purge, legacy body column is dropped. No further plaintext from NEX.

### Required supporting migration

- B1 · plaintext freeze · UNAUTHORISED.
- B7 · public-bucket purge · UNAUTHORISED.

---

## 10 · GDPR requests and deletion

### Right of access (SAR)

NEX can return, under Option 2:
- Account metadata (display name, settings, join date).
- Device registry (device IDs, public keys, timestamps · NOT private keys · we never have them).
- Message metadata (sender, recipient device IDs, group IDs, timestamps, TTL, ACK state).
- Encrypted bodies as ciphertext blobs (useless without the user's own private key).
- Attachment inventory (storage keys, sizes) + signed URLs to ciphertext (useless without the content key).

NEX **cannot** return plaintext bodies for a SAR because it does not hold them. The response explicitly states this and directs the user to their own device's export path (§9).

### Right to erasure

Account deletion workflow (B8):
1. Cancel all pending outbound messages (DELETE rows where sender = this account).
2. Revoke all device keys (set `revoked_at = now()`).
3. Enqueue attachment purges for all attachments uploaded by this account.
4. Quarantine any orphan rows that would otherwise be left (via `missing_device_ids` populated at cascade time).
5. Soft-delete the account row for 30-day grace (user can reverse).
6. Hard-delete after grace: cascade through conversations, delete participant row, nullify historical references.

**Limitation that must be documented in the privacy policy:** NEX cannot delete plaintext bodies that already landed on a recipient's device. That plaintext is under the recipient's control, not NEX's. Right-to-erasure cannot reach it.

### Required supporting migration

- B8 · account deletion cascade · UNAUTHORISED.

---

## 11 · Device loss and optional encrypted backup

### Default behaviour · no backup

If a user loses all their devices and has not exported, their chat history is gone. We don't keep a copy that could decrypt. This is honest and must be user-facing.

Options for the user to self-protect:
- Pre-emptive export (JSON of plaintext + attachment inventory) · unencrypted bundle · user responsibility to store safely.
- Linked second device (§8) · the simplest "backup" is a device the user controls.

### Optional encrypted backup (deferred · stage TBD)

**NOT in scope for initial Option 2 ship.** Proposed future design:

- User chooses a passphrase (ideally derived via a slow KDF · Argon2id with high cost parameters).
- Device encrypts the full IndexedDB plaintext bundle with the derived key · uploads to Supabase Storage as an opaque blob.
- On new-device recovery: user enters passphrase · device downloads blob · decrypts · populates IndexedDB.
- Blob never leaves encrypted form. Server cannot decrypt (no passphrase).

Risks the design must address before shipping:
- Passphrase loss is permanent data loss. Must be user-facing.
- Server storage of long-lived encrypted blobs is a confidentiality downgrade if KDF parameters are weak · must use strong parameters and refresh periodically.
- Encrypted-backup lifecycle (how long we hold a backup for an inactive account) is a policy question.

**No implementation authorised. Flagged for future owner decision.**

---

## 12 · Security limitations, operational costs, failure recovery

### Honest security limits

| Threat | NEX protection |
|---|---|
| Server-side plaintext read | Prevented (no key material on server) |
| MITM at first contact | TOFU + user-driven verification · raises bar, not impossible |
| Compromised server mid-session | Detectable via CHANGED trust state if verified; silent if unverified |
| Browser extension / XSS | Not solvable by NEX · outside design surface |
| Compromised device | Not solvable by NEX · attacker has the plaintext |
| Weak user passphrase (future backup) | Mitigated by KDF strength · not eliminated |
| QR link replay against unattentive user | Mitigated by visual-match confirmation · depends on user |

### Operational costs

Approximate per-message cost assuming median 2 recipient devices:
- 2 rows in `nex_peer_message` instead of 1 · 2× fan-out table growth.
- 2 wrapped content keys ≈ 48 bytes each · negligible.
- 2 Storage objects for binary attachments only if attachment is per-recipient (NOT our design · attachment ciphertext is one object, content key is wrapped per device).
- Advisory lock + cleanup worker overhead · one additional transaction per cleanup tick · bounded.

### Failure recovery

| Failure | Recovery |
|---|---|
| Device offline past TTL | Message lost · sender UI shows "undelivered" indicator · no automatic retry (unlike iMessage) |
| Supabase Storage DELETE 5xx | Exponential backoff · dead-letter after 10 attempts |
| Supabase Storage DELETE 404 | Treated as success (idempotent) |
| Supabase Storage DELETE 401 | WORKER PAUSED + PAGE OPS (auth broken · do not dead-letter whole queue) |
| Supabase Storage DELETE 400/403 | Dead-letter + alert (bucket policy or malformed key) |
| Network timeout / connection refused | Retriable |
| Cleanup worker crash mid-tx | Row locks + advisory lock auto-release · next tick retries |
| Quarantine worker crash | Idempotent (ON CONFLICT WHERE reviewed_at IS NULL) · next tick re-populates |
| Attachment-purge worker crash | Row stays unlocked after crash · next worker picks up |
| Device loses IndexedDB (quota eviction / private browsing) | History lost unless user exported or has linked secondary device |

### Storage DELETE error-class mapping (resolved · concern 2)

```
200 / 204 / 404       → purged_at = now()                   -- success (404 is idempotent)
408 / 429 / 500..504  → attempt_count++, backoff            -- transient
network timeout       → attempt_count++, backoff            -- transient
TLS handshake failure → attempt_count++, backoff            -- transient
400                   → dead_lettered_at = now() + alert    -- malformed key
403                   → dead_lettered_at = now() + alert    -- bucket policy
401                   → WORKER PAUSE + PAGE OPS             -- auth broken globally
```

Backoff: `min(60s * 2^attempt_count, 24h)` capped at 10 attempts before dead-letter.

---

## 13 · Migration sequence and implementation dependencies

### Ordered sequence (none authorised)

| Stage | Content | Depends on | Blocks |
|---|---|---|---|
| B0-A | Static audit (artefact only) | — | B0-B |
| B0-B | Coverage SQL (artefact only · unexecuted) | B0-A | B0-C |
| B0-C | Rehearsal on isolated PG | isolated PG available | B0-D |
| B0-D | Production coverage execution | B0-C passes + owner authorises | B1 |
| B1 | Plaintext freeze (drop `body` dependence · dual-write stops) | B0-D clean · legacy export built | B2, B7 |
| B2 | Private bucket + signed-URL path | B1 | B3 |
| B3 | Binary attachment encryption (Bridge 88) | B2 | B4 |
| B4 | ACK sweep + cleanup worker + advisory lock | B3 · operational Gate 1 for quarantine | B5 |
| B5 | TTL enforcement + attachment purge queue + purge worker | B4 | B6, B7 |
| B6 | QR linking · trust-state wiring | B4 · B5 | — |
| B7 | Legacy public-bucket purge | B5 · legacy export window elapsed | — |
| B8 | GDPR right-to-erasure cascade | B5 · B7 | — |
| B9 | Metadata minimization | B8 | — |

### Acceptance tests per stage (sketch · each stage must land its own test spec before authorisation)

- B0-B · 9 integer + 1 timestamp return matches `b0-rehearsal-expected.md`.
- B0-C · rehearsal on isolated PG produces the expected row.
- B1 · no new row has non-null `body` after freeze instant · reads prefer encrypted path · legacy export endpoint returns per-user plaintext.
- B2 · public bucket writes blocked · private bucket writes accepted with signed URL path.
- B3 · attachment-ciphertext round-trips through encrypt → upload → signed-URL fetch → decrypt without plaintext ever touching server logs.
- B4 · all-devices-ACK rule enforced · advisory-lock smoke test (concurrent attempt returns false) · missing-key row blocks group sweep.
- B5 · attachment purge queue dedups on `UNIQUE` · exponential backoff fires · dead-letter after 10 attempts · 401 pauses worker (does not dead-letter).
- B6 · HMAC-protected QR flow rejects substituted link tokens · trust state transitions through all four states correctly.
- B7 · public bucket objects return 404 after cutoff · no legacy export call succeeds past the window.
- B8 · right-to-erasure cascade stops in-flight sends · revokes keys · enqueues purges · soft-deletes account · hard-deletes after grace.
- B9 · metadata minimization leaves only what the fan-out algorithm needs for correctness.

### Dependencies on external artefacts

- `nex_message_group_quarantine` schema · drafted at B4 time, not here.
- `nex_message_attachment_purge_queue` schema · drafted at B5 time, not here.
- `nex_action_log` `quarantine_resolution` kind · drafted at B4 time, not here.
- Advisory-lock namespace registry · ad-hoc list maintained as salts are allocated (`42` for cleanup worker; others TBD).

---

## 14 · Review checklist for a future implementation go-ahead

The following must land before any stage from B1 onwards can be authorised:

1. **Gate 1 operational artefacts** · named owner, notification route, runbook, cadence, capacity threshold.
2. **Advisory-lock smoke test** · empirically validated against the target PG version.
3. **Storage DELETE error-class mapping** · empirically validated against Supabase Storage (resolved on paper, needs runtime confirmation).
4. **Legacy export endpoint** · built, tested, documented · public before freeze day.
5. **Public-bucket read-only window value** · owner-decided (days).
6. **TTL value** · owner-decided (currently proposed 7 days).
7. **Quarantine review cadence** · owner-decided.
8. **Storage capacity threshold** · owner-decided.
9. **Dual-write cutover plan** · exact clock time, rollback plan if freeze fails.
10. **Privacy policy and user-facing copy** · reflects §9, §10, §11 limitations before shipping.

Items 1-10 are hard preconditions. No stage proceeds while any item is outstanding.

---

## Status

- Design review complete.
- Implementation frozen.
- No production access taken, no migrations applied, no code changed.
- Advisory-lock design and Storage DELETE error mapping resolved on paper · runtime validation deferred to implementation stage.
- Operational ownership (Gate 1) remains separate workstream · unresolved.

Awaiting owner's decision on whether this consolidated document is accepted as the Option 2 architecture of record, and whether Gate 1 proceeds in parallel or sequentially before any implementation stage is authorised.
