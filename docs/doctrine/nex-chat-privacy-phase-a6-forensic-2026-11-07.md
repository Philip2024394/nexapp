# NEX Chat privacy · Phase A.6 forensic audit + remediation design

**Owner-authorised investigation** · 2026-11-07
**Status**: AUDIT COMPLETE · remediation is DESIGN ONLY · no production changes
**Intended architecture** (per owner directive): device-stored, end-to-end encrypted, NEX never retains chat content or attachments

## Executive summary

**The intended architecture is sound. The implementation has 7 gaps that make "100% PRIVATE / end-to-end encrypted" claims premature.** Customer-facing copy asserting absolute privacy should be reviewed until the gaps close.

The system is in a hybrid state:
- **Encrypted path EXISTS and WORKS** when both parties have active device keys
- **Plaintext path EXISTS as silent fallback** when either party lacks a device key, or when upload fails, or for legacy rows, or for attachments of type 'document', or for Vault-persistence copies

## Audit evidence · what the code actually does

### Attachment upload paths (two exist)

| Path | Where | Encryption | At-rest state | Status |
|---|---|---|---|---|
| Plaintext (v1 / legacy) | `peer-message-service.ts:454-467` via plaintext action | None | Plaintext in `nex-peer-chat-attachments` (public read bucket) | Default when E2E fails |
| Encrypted (Bridge 81) | `/api/nex-native/attachment/encrypted/route.ts:34` via `encryptFileBytes` | AES-256-GCM client-side | Ciphertext in `enc/{sender_id}/` prefix | Only when both parties have `device_key` |

### Message body states (also two)

| Row state | `encrypted` column | `body` column | Where readable |
|---|---|---|---|
| Legacy plaintext | `false` | Plain text | Server-side (service role + any `.select("body")`) |
| Encrypted (migration 093) | `true` | Sentinel `'(encrypted)'` | Only on device with corresponding device_key |

Trigger for encrypted path: BOTH parties have active `device_key` rows. Either missing → silent fallback to plaintext (`_media-capture.tsx:54`: "Silent fallback to the plaintext action on any failure").

### Phase A.6 status

- **Code exists**: `src/lib/nex-native/vault/client/legacy-migration.ts`
- **Runner exists**: `src/app/nex-native/vault/home/_migration-runner-client.tsx`
- **Trigger**: Only on Vault unlock (user-triggered)
- **Scope**: Encrypts Vault-persisted chat attachments that were copied in plaintext during move-to-Vault
- **Problem**: If user never reopens Vault, files sit plaintext indefinitely in `nex-vault-files` bucket

### Vault-persistence copies

`vault-persistence-service.ts:47-48` documents the trade-off explicitly:
> "Phase A delivers client-side encryption" but "NOT in scope for Phase A.1 · encrypting the Vault copy [deferred to later phases]"

And at lines 1-20:
> "HONEST BOUNDARY (D2 · still in effect): this file deals with PRIVATE access-controlled storage, NOT end-to-end encrypted storage. The server CAN read object bytes at this stage."

Vault-copied attachments land in `nex-vault-files` with `migrationState: "legacy"` · plaintext at rest · wait for A.6 runner.

### Server-side access (confirmed)

`nexSupabaseAdmin` (service role) has implicit full access to:
- `nex-peer-chat-attachments` (public read anyway)
- `nex-vault-files` (private, but service role bypasses RLS)
- `nex_peer_message` table (any `.select("body")` returns plaintext for legacy rows)

Specifically found:
- `peer-message-service.ts:626-630` · selects `body` for edit-window check · plaintext for legacy rows
- `/api/nex-native/peer-message/since/route.ts` · likely returns body to client

### Customer-facing claims identified

Grep findings suggest the following files make or risk making encryption claims:
- `src/app/nex-native/_actions.ts` · privacy references
- `src/app/nex-native/vault/intro/page.tsx` · "100% PRIVATE" (per earlier audit)
- Vault doorway marketing copy

## The 7 remediation gaps

Listed in order of risk severity:

### 1 · Documents always use plaintext path (deferred to Stage A2)
`_media-capture.tsx:37-39` · when attachment type is `document`, encryption is bypassed · deferred. Every PDF, every DOC, every CSV sent via NEX chat is in plaintext at rest.

**Fix scope**: implement encrypted-document path (parallel to encrypted-image path already in Bridge 81). No new infra needed.

### 2 · Silent plaintext fallback leaves user unaware
When encryption path fails (missing device key, upload error, any exception), code silently falls back to plaintext without informing the user.

**Fix scope**: surface a UI warning ("attachment sent unencrypted · recipient device doesn't support encryption yet") · OR block the send entirely · owner decides UX.

### 3 · Vault copies sit plaintext indefinitely
Chat attachments moved to Vault land plaintext in `nex-vault-files`. Phase A.6 runner encrypts them but ONLY on next Vault unlock by the user. Users who forget their Vault leave attachments plaintext for months/years.

**Fix scope**: run A.6 as a background job (scheduled cron) · OR encrypt during the move-to-Vault copy itself (vault-persistence-service.ts refactor).

### 4 · Attachment content keys have no device fan-out
Encrypted attachment bytes sit in R2/Supabase under `attachment_url`. The content key that decrypts them is held by the sender ONLY. Recipients can download the ciphertext but have no wrapped key to decrypt with (unless the sender fanned it out, which audit indicates is not wired for attachments).

**Fix scope**: implement per-recipient content-key wrap (nacl.box to recipient device public key) · store wrapped keys alongside attachment URL in message row.

### 5 · Service role bypass on sensitive buckets
Supabase service role has implicit access to `nex-peer-chat-attachments` and `nex-vault-files`. Even if content were encrypted end-to-end, a compromised service-role key would reveal everything.

**Fix scope**: Supabase RLS policies that restrict service-role on sensitive buckets to specific operations (upload-only, metadata-only, not read). Acknowledged this reduces debugging ability.

### 6 · Server-side selects on `body` column return plaintext for legacy rows
Edit-window check reads plaintext body server-side for messages where `encrypted=false`. This is operational data (timestamps) but body comes along for the ride.

**Fix scope**: narrow the select to only timestamps + metadata · never select `body` in server-side paths unless the row is confirmed encrypted (and then the body is just the sentinel string).

### 7 · No server-side verification that recipient's device_key is current
If recipient's device key has been compromised or rotated, legacy messages that were encrypted with the old key become undecryptable. There's no re-encryption flow.

**Fix scope**: key rotation UX + re-wrap flow for undelivered messages. Deeper work, probably Stage B.

## What the owner should hold until closed

Marketing + customer-facing copy that currently asserts or implies:
- "100% PRIVATE"
- "end-to-end encrypted"
- "NEX never sees your content"
- "fully encrypted"

Should be walked back to honest alternatives like:
- "Chat with encryption when both devices support it"
- "Privacy-first by design · ongoing security improvements"
- "Working toward fully end-to-end encryption · see our privacy status page"

This is not a hypothetical concern — `vault-persistence-service.ts:1-20` explicitly documents "HONEST BOUNDARY: NOT end-to-end encrypted storage." That internal honesty should be reflected in external copy until fixed.

## Remediation design (owner approval required before implementation)

No code is being written for remediation in this session · this is design-only.

### Short-term (weeks 1-4) · unblock honest marketing

1. **Audit + replace customer-facing encryption claims** (1-2 days)
   - Grep every "100% PRIVATE / end-to-end / encrypted" claim
   - Replace with precise copy reflecting actual state
   - Cross-check with legal if any has been in advertising

2. **Surface the plaintext-fallback in UX** (2-3 days)
   - When the encrypted path fails and plaintext is used, show the user a warning
   - Owner chooses: warn + continue, OR block the send

3. **Implement encrypted-document path** (1 week)
   - Parallel to existing encrypted-image path
   - Closes gap #1 · the single biggest attack surface

### Medium-term (weeks 5-12) · close the plaintext-at-rest gaps

4. **Background A.6 runner** (1-2 weeks)
   - Cron job that walks `nex_vault_file` for `migrationState='legacy'` rows
   - Encrypts each one · updates `migrationState='encrypted'`
   - Closes gap #3

5. **Attachment content-key fan-out to recipient devices** (2-3 weeks)
   - Reuses existing device-key pattern from message body encryption
   - Closes gap #4

6. **Narrow server-side body selects** (1 week)
   - Audit every `.select(` including "body" on nex_peer_message
   - Replace with metadata-only selects where possible
   - Closes gap #6

### Long-term (post-launch) · independent audit

7. **Cryptographic audit by external firm**
   - Required before any "end-to-end encrypted" claim can go on the website
   - Covers key generation, storage, fan-out, rotation
   - Produces attestation document

## What this design does NOT do

- Modify production code
- Change encryption algorithms
- Add new cryptographic primitives
- Alter the sealed Chat architecture

## Owner decision needed

- [ ] Approve short-term honest-marketing phase (weeks 1-4)
- [ ] Approve medium-term gap-closing phase (weeks 5-12)
- [ ] Approve budget for external cryptographic audit
- [ ] Walk back customer-facing encryption claims immediately (independent of above)
