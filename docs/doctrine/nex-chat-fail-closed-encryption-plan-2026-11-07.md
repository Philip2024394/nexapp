# NEX Chat · fail-closed encryption · design + local test plan

**Owner-authorised investigation** · 2026-11-07
**Status**: DESIGN + LOCAL TEST PLAN · no production migrations · no bulk encryption · no destructive changes
**Core principle**: encryption failure must never silently become an unencrypted upload.

## The current gap (recap from forensic doc)

`src/app/nex-native/chat/peer/[accountId]/_media-capture.tsx` line 54:
```
Silent fallback to the plaintext action on any failure
```

Current attachment flow:
```
┌─────────┐    ┌───────────────┐    ┌──────────────┐
│ compose │ →  │ attempt E2E   │ →  │ upload       │
│ send    │    │ encrypt       │    │              │
└─────────┘    └───────────────┘    └──────────────┘
                     │ fail
                     ▼
               ┌───────────────────┐
               │ SILENT fallback   │ ← this is the problem
               │ plaintext upload  │
               │ via legacy action │
               └───────────────────┘
```

Plus: documents ALWAYS take the plaintext path (Stage A2 deferred).
Plus: Vault migration (A.6) only runs when the user opens Vault.
Plus: service-role has implicit read access to the bucket.

## Target behaviour (owner-stated)

- Encryption completes BEFORE upload.
- If encryption fails, the attachment is **not** uploaded unencrypted.
- No alternative route may silently fall back to plaintext.
- Recipients can decrypt using their authorised device keys.
- Existing plaintext attachments are preserved and treated carefully.

## Phased plan

### Phase 1 · Fail-closed the sender path (code only, no bucket change)

**Scope**: remove the silent plaintext fallback in `_media-capture.tsx`.

**Behaviour change**:
- If encryption succeeds → upload ciphertext (existing happy path).
- If encryption fails → surface a UI error with 3 choices:
  - "Retry encryption" (try again, maybe recipient's key has landed)
  - "Send as unencrypted standard message" (explicit · logged · recipient sees warning in bubble)
  - "Cancel"
- **Never** fallback silently.

**Files touched** (all owner-authorised 2026-11-07 Priority 5):
- `src/app/nex-native/chat/peer/[accountId]/_media-capture.tsx` — remove silent fallback, surface explicit UI prompt.
- `src/app/nex-native/chat/peer/[accountId]/_e2e-composer-intercept.tsx` — already has the right pattern for text messages (already warns before sending); the attachment path should reuse this.
- `src/lib/nex-native/peer-message-service.ts` — add a `sendPeerAttachment({ mustEncrypt: true })` mode that throws instead of falling back.

**Coverage**:
- Sender happy path (both devices keyed)
- Sender · recipient key missing (warn, don't silent-send)
- Sender · own device key missing (warn, don't silent-send)
- Upload fails mid-encrypt (user retries, no plaintext leak)

**What this phase does NOT do**:
- Does not re-encrypt existing plaintext rows in `nex_peer_message`.
- Does not re-encrypt existing plaintext blobs in `nex-peer-chat-attachments`.
- Does not add recipient content-key fan-out for attachments (that's Phase 2).

### Phase 2 · Recipient content-key fan-out for attachments

**Problem**: currently the encrypted-attachment path (`/api/nex-native/attachment/encrypted`) uploads ciphertext but there is no mechanism to wrap the content key for the recipient's device public key. Receivers can download ciphertext but can't decrypt.

**Design**: Mirror the text-message pattern in `src/lib/nex-native/crypto/`.

**New fields on `nex_peer_message` row (for attachments)**:
- `attachment_content_key_wrapped` · nacl.box(contentKey, recipientDevicePubKey, senderDevicePrivKey, nonce)
- `attachment_wrap_nonce`
- `attachment_sender_device_pub` · for verification + rotation support

**Migration**: deferred; prepared locally in `nex-supabase/migrations/NNN_nex_peer_message_attachment_wrap.sql` + rollback. NOT APPLIED.

**Files** (all deferred for owner approval):
- `src/lib/nex-native/crypto/attachment-envelope.ts` — add fan-out helper
- `src/app/api/nex-native/attachment/encrypted/route.ts` — accept wrapped keys
- `src/app/nex-native/chat/peer/[accountId]/_e2e-decryptor.tsx` — read wrapped key, decrypt
- Migration for the 3 new columns

### Phase 3 · Document encryption (closes forensic gap #1)

**Problem**: `_media-capture.tsx:37-39` deliberately skips encryption for documents.

**Design**: extend the existing image encrypt path to cover documents. The encryption primitive is bytes-in-bytes-out · indifferent to content type. The deferral was a product-decision, not a crypto limitation.

**Files** (deferred):
- `src/app/nex-native/chat/peer/[accountId]/_media-capture.tsx` — remove document branch.
- Verify PDF/DOC/CSV preview still works on recipient side using decrypted bytes.

### Phase 4 · Isolate existing plaintext attachments

**Goal**: identify and separate legacy plaintext blobs without destroying any. Do NOT delete. Do NOT bulk-encrypt until owner approves per-user migration UX.

**Design**:
- Add `nex_peer_message.ciphertext_state ENUM('plaintext_legacy', 'ciphertext', 'migrated')` column.
- Backfill job marks every existing row as `plaintext_legacy` (unless `encrypted=true` already).
- No deletion. No bulk re-encryption. Rows stay readable to the sender/recipient via the existing plaintext read path.
- UI shows a small chip on legacy attachments: "Sent before encryption was available."

**Safe migration path** (per-user, opt-in, deferred):
- When a user signs in post-upgrade, offer: "Encrypt your old chat attachments on this device · estimated X MB · may take a few minutes."
- If accepted: decrypt-on-device + re-upload encrypted version + flip `ciphertext_state='migrated'`.
- If declined: legacy rows stay plaintext.
- User can trigger this later from Settings → Privacy.

**What this phase does NOT do**:
- Does not bulk-encrypt without consent.
- Does not delete legacy blobs.
- Does not block users who skip the migration.

### Phase 5 · Independent crypto audit

Required before any customer-facing "end-to-end encrypted" claim goes on the marketing site. Separate vendor procurement.

## Local test plan (no production, no bulk encryption)

### Phase 1 test matrix (sender fail-closed)

All tests run against a local dev session · no production data touched.

| # | Scenario | Setup | Assert |
|---|---|---|---|
| T1 | Happy path image | Sender + recipient both have `device_key` | Attachment uploaded via encrypted route · `nex_peer_message.encrypted=true` · no row in legacy plaintext path |
| T2 | Recipient no key | Sender has key; recipient's row in `device_key` is empty | Composer shows explicit prompt · no upload happens · user must choose retry/send-plaintext/cancel |
| T3 | Sender no key | Sender's `device_key` row is empty | Composer shows explicit prompt · no upload happens |
| T4 | Encrypt throws | `encryptFileBytes` mocked to throw | Composer surfaces error · no upload · no silent fallback |
| T5 | Upload fails after encrypt | Supabase storage mocked to 500 | Error shown · user can retry · no plaintext leak |
| T6 | User explicitly chooses plaintext | T2 or T3 setup · user clicks "Send as standard" | Message sends plaintext · bubble shows "⚠ standard message" badge · logged in `nex_peer_message.plaintext_explicitly_chosen=true` |
| T7 | Document file | File MIME is `application/pdf` | For Phase 1: still takes current plaintext path (Phase 3 fixes this) · for Phase 3: same as T1 but PDF |
| T8 | Offline then online | Offline when encrypt attempted | Reconnection resumes · encrypts on first online attempt · no retroactive plaintext path |
| T9 | Multiple devices (same recipient) | Recipient has 2 `device_key` rows | Content key wrapped for BOTH devices · each can decrypt (Phase 2) |
| T10 | Failed key exchange | Simulate key rotation mid-send | Composer retries with fresh key · no plaintext fallback |

### Instrumentation needed BEFORE running tests

- Add `plaintext_explicitly_chosen` column (migration, deferred).
- Add telemetry event `chat.attachment.encrypt_failed` so we can observe the rate in staging.
- Expose a dev-mode toggle to simulate recipient-key-missing without actually deleting their row.

### What this test plan does NOT do

- Does not push any production data.
- Does not bulk-encrypt existing attachments.
- Does not modify production bucket contents.
- Does not test against real user accounts.

## Preservation + safety rules

- **No deletion** of existing plaintext attachments at any phase.
- **No bulk re-encryption** without per-user consent.
- **No migration applied** to production without rehearsal receipt.
- **Rollback path** for every migration file:
  - Phase 2 rollback: drop the 3 new columns (safe · they're additive)
  - Phase 4 rollback: drop `ciphertext_state` column (safe · additive)
- **Feature flags** gate Phase 1 fail-closed behaviour: owner can toggle back to silent fallback in emergency (but default is OFF after owner approves).

## Owner decisions required before implementation

- [ ] Approve Phase 1 fail-closed sender path (code change in `_media-capture.tsx`)
- [ ] Approve Phase 1 explicit-plaintext UI copy (owner chooses tone)
- [ ] Approve Phase 2 schema migration for attachment content-key wrap
- [ ] Approve Phase 3 document encryption scope
- [ ] Approve Phase 4 legacy-plaintext isolation schema
- [ ] Approve per-user migration UX wording
- [ ] Approve external cryptographic audit procurement

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Users annoyed by new "cannot encrypt" prompts | Phase 1 adds "Send as standard" opt-in · they're not blocked, just informed |
| Legacy plaintext migration data loss | No deletion · no bulk op · per-user opt-in only |
| Stripe-style launch deadline pressure | Phase 1 (fail-closed sender) is the minimum shippable · everything else is post-launch |
| Audit findings land late | Phase 5 is parallel work · marketing copy stays walked-back until it clears |

## Next-action ladder

1. **Owner approves Phase 1 scope** → I implement the fail-closed sender path + tests T1-T8.
2. **Owner approves Phase 2 migration** → I prepare the schema migration + rollback.
3. **Phase 3, 4 land in sequence** → each gated on owner approval.
4. **Phase 5 vendor procurement** → owner handles.

Nothing in this plan ships without an explicit "approve Phase N" from the owner.
