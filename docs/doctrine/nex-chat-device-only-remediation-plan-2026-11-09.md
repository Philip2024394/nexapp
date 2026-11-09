# NEX Chat · Device-Only E2E Remediation Plan · CORRECTED
### Phase 2 Priority 1 · Pure Peer-to-Peer Architecture · 2026-11-09

**Author:** Claude Opus 4.7 · operating under owner-authorised Phase 2
Priority 1 documentation-only envelope.
**Status:** CORRECTED doctrine · supersedes the prior version of this
file that proposed server-side ciphertext storage. **INVESTIGATION
AND SCOPING OUTPUT · NO CODE, DATABASE, BUCKET, COMMIT, PUSH, OR
DEPLOYMENT CHANGES AUTHORISED.**
**Controlling architecture:** Interpretation 1 · pure peer-to-peer ·
sealed 2026-11-09. **Interpretation 2 (Signal-style transient queue)
is explicitly rejected and must not be reintroduced through any
implementation shortcut.**
**Prior version:** The earlier draft of this file described a fan-out
of ciphertext rows into `nex_peer_message` as "compliant." That
description was wrong and is superseded. Ciphertext persisted
server-side is non-compliant with the sealed directive.

---

## 0 · Why this doctrine was corrected

The previous draft of this file treated encryption-at-rest as equivalent
to device-only storage. It is not. The sealed directive is:

> *"NEX must not retain private message bodies, whether plaintext or
> ciphertext. No server-side message archive, temporary encrypted stash,
> offline delivery queue, or store-and-forward mechanism."*

This supersedes the prior "fan-out encrypted rows" model that this
file previously described as the compliant E2E foundation. The
ciphertext fan-out path is not forward-compatible with the directive
and the services that implement it must be removed or repurposed as
part of Priority 1 implementation.

---

## 1 · Controlling architecture · 8 sealed rules (Interpretation 1)

The eight rules below are hard constraints. Every design proposal in
this document, and every future piece of Priority 1 implementation,
must satisfy all eight. Any apparent exception requires a separate
explicit owner decision.

| # | Rule |
|---|---|
| **1** | NEX must not retain private message bodies, plaintext or ciphertext. |
| **2** | No server-side message archive, temporary encrypted stash, offline delivery queue, or store-and-forward mechanism. |
| **3** | Private messages deliver directly between online devices. A live TURN relay may forward encrypted packets only while the connection is active. The relay must NOT queue, persist, log, or retain message content. |
| **4** | If recipient is offline OR a live device-to-device connection cannot be established, delivery FAILS. Sender receives honest delivery status and may retry when both devices are online. |
| **5** | No server-side message-history synchronisation, recovery archive, or server-mediated multi-device history. |
| **6** | Message history lives on the user's own device. Device loss may mean loss of locally held messages. Document this honestly. |
| **7** | Push notifications must NOT contain private message bodies or sensitive previews. |
| **8** | Do not weaken this architecture to preserve familiar messaging behaviour. |

Scope: these rules apply to **all** of NEX Chat, business chat, NEX
Official, HQ Direct Channel, attachments, Vault (where it touches chat),
and commerce-related chat content.

---

## 2 · Severity classification

Unchanged from prior draft · retained for cross-reference.

| Label | Meaning |
|---|---|
| **P0-CURRENT** | Live code or applied schema currently violates the directive. Must be corrected before any public launch. |
| **P0-GATE** | Would violate the directive only under a specific action (e.g. apply mig X). The action stays gated. |
| **P1-CURRENT / P1-GATE** | Same distinction, one tier lower. |
| **P2 / P3** | Hardening and mitigations, not individually launch-blocking. |

---

## 3 · Target data-flow architecture

### 3.1 Logical model

```
   SENDER DEVICE                                          RECIPIENT DEVICE
   ─────────────                                          ────────────────
   plaintext msg
       │
       ▼
   encrypt (nacl.box · per-recipient-device key)          device key (idb)
       │                                                        ▲
       │  ╔═══════════════════════════════════════════╗         │
       │  ║ 1. Signaling · SDP offer via NEX server   ║         │
       │  ║    (ephemeral · no content)               ║         │
       │  ╚═══════════════════════════════════════════╝         │
       │                                                         │
       │  ╔═══════════════════════════════════════════╗         │
       │  ║ 2. WebRTC data channel establishes        ║         │
       │  ║    directly OR via TURN relay (live only) ║         │
       │  ╚═══════════════════════════════════════════╝         │
       │                                                         │
       └──▶ ciphertext packet(s) ─────────────────────────────▶ decrypt
                                                                  │
   NEX server sees:                                                ▼
   · Who signalled to whom + when (connection metadata)       plaintext msg
   · Timing of ACK (connection state)                              │
   · Zero message content                                          ▼
   · Zero ciphertext at rest                                 local device store
                                                             (SQLite / IndexedDB · user-backed-up)
```

### 3.2 Required components (new builds · substantial)

| Component | Role | Build status |
|---|---|---|
| WebRTC signaling service | Exchange SDP offers/answers + ICE candidates between online devices · no message content · ephemeral | **NOT BUILT** |
| Presence service | Which devices are online right now · lightweight · needed to decide whether to attempt delivery | **NOT BUILT** (partial device-presence signals exist but not production-ready) |
| TURN relay infrastructure | Live packet forwarding when direct NAT traversal fails · zero persistence / logs / queues | **NOT BUILT** · owner decision required on self-hosted (coturn) vs managed (Cloudflare / Twilio / Metered) |
| Device-pairing + multi-device sync | How a user's own N devices discover each other and establish per-pair keys | Device keys exist (`device-key.ts`) · pairing UX NOT BUILT |
| Local-device message store | Encrypted SQLite / IndexedDB on each device · the ONLY place private messages live | **NOT BUILT** |
| User-controlled backup | Optional · user's choice of iOS/Android native backup OR encrypted cloud backup owned by user | **NOT BUILT** |
| Push notification service (body-free) | "You have a new NEX message" · no preview content | Partial · sealed `notification-dispatch-service.ts` must be audited for preview leakage |
| Delivery status tracker | Sent / delivered-to-device / failed · lives on sender's own device, possibly reflected in ephemeral server state | **NOT BUILT** |
| Business multi-device model | Businesses need multiple device-keys (shop owner + staff) · at-least-one-online semantics | **NOT BUILT** |

### 3.3 Existing crypto components that stay (with scope adjustments)

| Component | File | Role under Interp 1 |
|---|---|---|
| Device key management | `src/lib/nex-native/crypto/device-key.ts` | Reused · each device holds its own long-lived Curve25519 keypair |
| Shared secret derivation | `src/lib/nex-native/crypto/shared-secret.ts` | Reused · derives per-pair secret for encrypt/decrypt |
| `nacl.secretbox` / `nacl.box` | tweetnacl | Reused for message + attachment encryption |
| Attachment envelope crypto | `src/lib/nex-native/crypto/attachment-envelope.ts` | **Repurposed** · the wrapped-content-key envelope still works for attachments, but the attachment ciphertext travels via data channel, NOT via a storage bucket |

### 3.4 Existing components that **MUST BE REMOVED OR REBUILT**

| Component | File | Why |
|---|---|---|
| `sendEncryptedPeerMessages()` fan-out writer | `src/lib/nex-native/peer-message-service.ts:967-1039` | Writes ciphertext to `nex_peer_message` · violates rule #1. Must be replaced by a device-to-device delivery function with no DB insert of content. |
| `sendPeerMessage()` plaintext path | `src/lib/nex-native/peer-message-service.ts:399-555` | Writes plaintext body · violates rule #1. All 17 callers must switch to the new device-to-device path. |
| `conversationService.postMessage()` business-chat writer | `src/lib/nex-native/conversation-service.ts:89-105` | Writes plaintext `nex_message.body` · violates rule #1. Entire business-chat model must be redesigned as device-to-device. |
| `/api/.../peer-message/encrypted` POST route | `src/app/api/nex-native/peer-message/encrypted/route.ts` | Accepts ciphertext for DB persistence · violates rule #1. Replaced by a signaling endpoint that exchanges SDPs, no content. |
| `/api/.../peer-message/since` GET route | `src/app/api/nex-native/peer-message/since/route.ts` | Reads server-persisted messages · the data being read must not exist. Route retired. |
| `/api/.../attachment/encrypted` POST route | `src/app/api/nex-native/attachment/encrypted/route.ts` | Writes attachment ciphertext to Supabase bucket · violates rules #1 and #2. Must be removed; attachments travel via data channel. |
| `/api/.../attachment/encrypted/signed` GET route | `src/app/api/nex-native/attachment/encrypted/signed/route.ts` | Mints signed URLs for persisted ciphertext · the data being signed must not exist. Route retired. |
| `uploadPeerAttachment()` + public bucket upload | `src/lib/nex-native/peer-message-service.ts:1125-1210` | Writes plaintext attachments to public bucket · violates rules #1 and #2. Removed. |
| `nex-peer-chat-attachments` bucket | mig 055 | Retired for chat use (business-public asset uploads migrate to a new dedicated bucket · see §7). |
| `nex-peer-chat-ciphertext` bucket (mig 295 target) | Not yet provisioned | **Do not provision.** The private-ciphertext-bucket architecture was the Interp-3 model and is forbidden. Mig 295 is now obsolete and should not be applied. |
| `nex_peer_message` content columns | mig 047 + mig 093 | `body`, `encrypted`, `ciphertext`, `nonce`, `sender_public_key`, `sender_device_id`, `recipient_device_id`, `message_group_id`, `attachment_url`, `attachment_type`, `attachment_meta` — all removed. Only metadata survives (conversation existence, participant roster, maybe lightweight presence). |
| `nex_message.body` column | mig 004 (approx) | Removed. Business-chat content must not persist. |
| `markPeerMessageDelivered` persistence | `peer-message-service.ts:1057-1080` | Delivery status is sender-device-local, not a server-persisted column. |
| `listPeerMessages` / `countTotalUnreadPeerMessages` / `markPeerMessagesRead` | `peer-message-service.ts` | All read server-persisted content. Retired. Unread-count and read-receipt semantics must move to device-local state. |
| `editPeerMessage` · `deletePeerMessageForEveryone` · `toggleMessageReaction` | `peer-message-service.ts` | All mutate server-persisted content. Retired · edits/deletions/reactions become device-local operations propagated via data channel. |
| Vault preservation of chat attachment URLs | `src/lib/nex-native/vault-persistence-service.ts` | Must not reference server-side chat attachment storage. Vault's chat-preservation semantics are redesigned (see §4.6). |

---

## 4 · Per-surface compliance plan

### 4.1 Peer chat (user ↔ user)

- **Transport:** WebRTC data channel between sender's device and each of recipient's online devices. Direct connect preferred · TURN fallback allowed only for live packet forwarding.
- **Encryption:** Existing `nacl.box` per-pair derivation stays.
- **Delivery states:** `attempting` → `sent` (packets dispatched) → `delivered` (recipient device ACKed over the channel) OR `failed` (no recipient device online / connection could not be established / timeout). Sender sees real state; no "false delivered."
- **Offline recipient:** Sender sees honest "unable to deliver · recipient not online · try again later." No queue.
- **Multi-device recipient:** Each of recipient's online devices receives its own encrypted copy via its own WebRTC connection. Devices offline at send time never see the message.
- **History:** Lives in sender's local store + each recipient device's local store. Not on NEX servers.
- **Server metadata retained:** Conversation existence (`nex_peer_conversation` participant pair), timestamp of last signaling activity (for presence heuristics only, not content). Everything else goes.

### 4.2 Business chat (customer ↔ business · full E2E from scratch)

- **Business account device keys:** Business owner's device acts as a "business device." Businesses with multiple staff can register multiple business devices per shop.
- **Customer-side:** No different from peer chat · customer's device establishes WebRTC to the online business device(s).
- **At-least-one-business-device-online semantics:** If zero business devices are online, the customer sees "the business is currently offline · try again later." No message queue. No fake "message sent."
- **No NEX Assistant plaintext path:** The NEX Assistant reply system currently runs server-side (`intelligence/nex-intelligence-gateway.ts` → `postMessage`). Under rule #1, the Assistant cannot persist plaintext replies to `nex_message`. Options:
  - (a) NEX Assistant runs as its own device-key identity, replies via WebRTC to the customer's device the same way any other sender does. Requires an "always-on assistant device" infrastructure.
  - (b) NEX Assistant is retired from the business-chat surface. Businesses respond manually. Customers see honest "waiting for business to respond."
  - (c) Assistant replies are reclassified as a non-private helper surface distinct from chat. Requires separate owner decision and does not fit rule #8.
- **Decision for Priority 1:** Build business chat without Assistant replies in v1. The Assistant path is a separate design question that doesn't block this remediation.

### 4.3 NEX Official (system → user)

- **Identity:** NEX Official has its own device key(s) registered against a sentinel account.
- **Welcome delivery:** When user establishes their first device key, NEX Official server-side logic observes the device-key establishment event and triggers a WebRTC delivery from the NEX Official sentinel device to the new user's device. No DB-persisted welcome message.
- **If no NEX Official device is online:** Delivery defers until one is. This is why NEX Official needs at least one always-on device (operationally: a persistent NEX-run client-like process · or acceptance that welcome messages are best-effort).
- **No plaintext exception:** Rule #1 applies to NEX Official identically.

### 4.4 HQ Direct Channel (HQ staff → user)

- **Identity:** Each HQ staff member authenticates and their own device key sends the message. Not a sentinel.
- **Delivery:** WebRTC from HQ staff device to recipient user's online device. Same rules as peer chat.
- **If user is offline:** HQ staff sees "user offline · retry later." No queued HQ message. HQ cannot silently reach an absent user.
- **No compliance exemption:** Rule #1 applies. HQ gets no special persistent access to private conversations.
- **Retired:** `nex_hq_direct_send` RPC (writes server-persisted plaintext). `nex_hq_direct_channel_upsert` can stay as a tracker of HQ-user correspondence existence (no content).

### 4.5 Attachments (image · video · audio · document)

- **Transport:** Attachment ciphertext bytes travel via the same WebRTC data channel as the message body. For large files, chunked over the channel. The attachment envelope wrapping scheme (`attachment-envelope.ts`) still works · but the envelope's `storage_url` field is removed and ciphertext is carried inline.
- **No Supabase bucket** for private attachments. `nex-peer-chat-attachments` retired for chat. `nex-peer-chat-ciphertext` (mig 295 target) never provisioned.
- **Size cap:** The existing 25 MB per-attachment cap stays. WebRTC data channels handle 25 MB with chunking; performance needs sandbox verification.
- **Resume:** Mid-transfer connection loss means the attachment transfer must restart from zero on next connection. No server-side chunk persistence.

### 4.6 Vault (sealed decision #6 · Vault stays as separate product · no chat backdoor)

- **Vault must not become a server-side copy of private chat content.**
- Vault's existing role as a user-paid encrypted storage product for files the user explicitly chooses to upload stays.
- Vault's historical role as a "preserve this chat conversation" surface is incompatible with Interp 1 and must be retired or redesigned.
- **Redesigned "chat archive" surface (Vault-adjacent):** If users want to keep a long-term record of a chat conversation, that record lives on their own device and they can export/back-up to their own storage of choice. NEX does not host it.
- Vault-as-separate-product scope is outside Priority 1 · tracked as a parallel workstream.

### 4.7 Commercial orders (Path A · sealed decision #8 · no stash)

- Orders live in `nex_order` + `nex_order_item` (per sealed Path A plan).
- Both buyer and seller can read the order record via their own authenticated session (RLS enforced).
- Chat may transport (device-to-device, ciphertext) an opaque `order_handle: { order_id }` reference inside the ciphertext body. Both parties click the handle to open the authoritative order page server-side.
- **No cart data, address, phone, price, or item list travels through a message payload.** Even the ciphertext body should carry only the order UUID.
- Order status updates (paid · fulfilled · cancelled) are status transitions on the order record, not chat messages. The chat surface can optionally subscribe to the order's status via a server-pushed presence-style signal (no content).

### 4.8 Push notifications (rule #7)

- Server-side push payload is content-free: `{ type: "new_message", conversation_id, timestamp }` only.
- No sender display name. No preview. No attachment type disclosure.
- When the recipient device wakes, it processes the WebRTC signaling and receives the actual (encrypted) message in-session.
- **Current `dispatchPushNotification` call path must be audited** for leakage. The sealed call in `/api/.../peer-message/encrypted/route.ts:132-180` currently includes a localised preview string (`"sent you a photo"`, `"sent you a message"` etc.) which is not plaintext content but still discloses the sender's display name and the attachment kind. Under rule #7, even that must be stripped.

### 4.9 Delivery states (rule #4 honesty)

| State | Shown to sender | Server knows |
|---|---|---|
| `pending` | "Sending…" | Sender device attempting signaling |
| `attempting` | "Sending…" | Signaling in progress; server routes SDPs only |
| `sent` | "Sent" (one tick) | Packets dispatched into channel |
| `delivered` | "Delivered" (two ticks) | Recipient device ACKed over channel (ACK is itself a data-channel frame; server doesn't need to know) |
| `failed` | "Failed · recipient offline · try again" | Server knows the signaling attempt failed. No queue. |
| `read` | "Read" (blue ticks) · optional | Device-to-device signal; server does not know and does not persist |

Never show "delivered" when only "sent" is true. Never show "sent" when only "pending" is true.

---

## 5 · Historical plaintext · inventory + secure-delete framework (decision #7)

### 5.1 In-scope data

| Target | Location | Expected volume |
|---|---|---|
| Plaintext `nex_peer_message.body` on rows with `encrypted=false` | Supabase · production + sandbox | Unknown · needs count |
| Plaintext `nex_message.body` | Supabase · production + sandbox | Unknown · needs count |
| Plaintext `nex_peer_message.attachment_meta` (commerce snapshots) | Supabase · production + sandbox | Unknown · needs count |
| Ciphertext columns on `nex_peer_message` (ciphertext, nonce, sender_public_key, etc.) | Supabase · production + sandbox | Unknown · needs count |
| Objects in `nex-peer-chat-attachments` public bucket under chat prefix | Supabase Storage · production + sandbox | Unknown · needs listing |
| Vault chat-preservation references | Supabase · production + sandbox | Unknown · needs count |

### 5.2 Inventory step (read-only · pre-deletion)

A separate authorised read-only inventory task should produce:
- Count of rows per target
- Earliest / latest `sent_at` dates
- Account-id distribution (how many users affected)
- Attachment object count + total bytes
- Legal retention review (per Ireland + Indonesia + Worldwide jurisdictions · GDPR right to erasure favours deletion but check if any ongoing legal hold applies)

### 5.3 Deletion plan (requires separate authorisation)

Proposed phased approach for owner authorisation:
- **Phase S1 · Communicate** · users are informed before the cutover window (via existing chat surface or email) that NEX is upgrading to device-only chat and that historical server-side messages will be permanently removed. Users who want a personal archive are given a self-service export window.
- **Phase S2 · Freeze writes** · after cutover, no new rows land in the affected tables/buckets.
- **Phase S3 · Export window** · 30-day window during which users can download their historical content via a self-service export endpoint (built for this purpose only · expires after the window).
- **Phase S4 · Secure-delete** · service-role sweep nulls `body` / `attachment_meta` / ciphertext columns on affected rows; `DELETE` from bucket; verify via post-sweep audit scan.
- **Phase S5 · Audit record** · a record is kept **only** of the sweep itself (timestamp, row count, object count) — not of the deleted content.

### 5.4 Compatibility with rule #1

The deletion plan itself does not violate rule #1 — it's the *removal* of previously-stored content. During the export window, the content is briefly exposed via authenticated download (not via the chat surface, and not persisted anywhere new). This is a defensible trade-off since the data was created before the directive and the user has a right to their own data before it is deleted. If owner wants stricter handling (immediate delete, no export window), state that and I will revise.

---

## 6 · Bucket split (decision #1 · sealed)

### 6.1 Target state

| Bucket | Purpose | Public? | Keeps writing after cutover? |
|---|---|---|---|
| **`nex-business-public-assets`** (NEW · to be provisioned) | Business logos · venue photos · shop imagery · all genuinely public business-owned assets | `public: true` | **YES** · this is the target for `uploadOnboardingLogo`, `uploadVenuePhoto`, shop-setup imagery |
| `nex-peer-chat-attachments` (legacy) | Historical plaintext chat attachments ONLY · no new writes | `public: true` (unchanged for now · see §5 secure-delete plan which removes the objects) | **NO** · cutover retires chat writes |
| `nex-peer-chat-ciphertext` (mig 295 target) | Was intended for Interp-3 encrypted-archive attachments | — | **NEVER PROVISIONED** · mig 295 marked obsolete under Interp 1 |

### 6.2 Code changes required for the split

| File:line | Current | After |
|---|---|---|
| `src/lib/nex-native/business-service.ts:1310` | `nexSupabaseAdmin.storage.from("nex-peer-chat-attachments")` | `nexSupabaseAdmin.storage.from("nex-business-public-assets")` · same object layout prefix |
| `src/lib/nex-native/business-service.ts:1361` | same | same |
| `src/app/nex-native/manage/shop/setup/_actions.ts` | writes to `nex-peer-chat-attachments` | writes to `nex-business-public-assets` |
| Existing public URLs in `nex_business`, `nex_product`, etc. pointing at the old bucket | Reachable | Remain reachable while objects exist in the old bucket. Secure-delete plan (§5) deletes them; those URLs then break. **Owner must authorise either (a) copy-over to new bucket then delete from old, or (b) accept the URL breakage as part of the chat-content secure-delete, or (c) treat business-public assets as needing a separate migration.** |

### 6.3 Required decision

**Does the historical secure-delete sweep also delete the legitimate business assets that currently sit in the chat bucket (venue photos, business logos)?** They were written to that bucket because of the bucket-tenancy mistake, but they are themselves legitimate business-public content. Three sub-options:

- **(i)** Copy business assets to the new bucket before sweep · rewrite the public URLs on `nex_business` / `nex_product` to point at the new bucket · then delete the old bucket's chat objects. Business-asset URLs stay live.
- **(ii)** Tolerate URL breakage for the historical business assets · uploaded fresh to new bucket on next business edit · older assets show as broken images until re-uploaded. Simpler, user-visible breakage.
- **(iii)** Keep the old bucket alive indefinitely for business assets · only sweep the chat-prefix objects · defer the split to a separate workstream. Sidesteps the question.

Not resolved · owner choice.

---

## 7 · Migration dependencies · corrected

### 7.1 Migrations that must be marked for removal or retirement

| # | File | State | Fate under Interp 1 |
|---|---|---|---|
| 047 | `047_nex_peer_chat.sql` (applied) | Applied · defines `nex_peer_message` with content columns | **Schema overhaul required** · content columns dropped · see §8 |
| 055 | `055_nex_peer_chat_attachments_bucket.sql` (applied) | Creates public bucket | **Deprecated for chat use** · bucket kept alive only for the secure-delete window; retired afterward |
| 059, 067, 077, 088, 119, 125, 259, 306, 309 | commerce attachment_type additions + document + call_invite + check-restore | Applied | **Retired** · `attachment_type` column itself is removed. These migrations stay in history but the column they modify is dropped. |
| 093 | encrypted columns on `nex_peer_message` | Applied | **Retired** · all encrypted-* columns dropped. |
| 094 | encrypted-message delivery helper | Applied | **Retired** · helpers no longer needed. |
| 125 | peer_message link_preview columns | Applied | **Retired** · link previews become device-local render. |
| 199 | read_receipts_enabled pref | Applied | Stays · pref is user-side; read-receipt mechanics move device-side. |
| 218 | peer-message RLS harden + immutability trigger | Authored, not applied | **Obsolete** · the columns the trigger protects are being removed. Mig 218 should NOT be applied. |
| 283 · 284 | disappearing messages (disappearing_at + purge job) | Authored · applied state unknown | **Retired** · disappearing_at applies to server-stored rows; under Interp 1 the rows don't exist. Device-local messages handle their own expiry. |
| 295 | private ciphertext bucket RLS | Authored, not applied | **Obsolete** · Interp-3 target. Do NOT apply. |
| 306 · 309 | attachment_type CHECK fixes | Applied (sandbox) | Moot once `attachment_type` column is dropped. |

### 7.2 New migrations required (authored during implementation phase · owner-approved)

| ID | Purpose | Prereqs |
|---|---|---|
| **N1 · Content-column drop** | Remove `body`, `encrypted`, `ciphertext`, `nonce`, `sender_public_key`, `sender_device_id`, `recipient_device_id`, `message_group_id`, `attachment_url`, `attachment_type`, `attachment_meta`, `reply_to_id` (reply mechanics move device-side), `read_at`, `edit_history`, `disappearing_at` from `nex_peer_message`. Similar drop on `nex_message`. | Paired with code cutover · staged (shadow new tables first, cut over, drop old columns) |
| **N2 · Signaling table** | Ephemeral table holding WebRTC signaling payloads with aggressive TTL (e.g. 60s). Content never persists past the signaling exchange. | None |
| **N3 · Presence table** | `nex_device_presence(device_id, account_id, last_seen_at, connection_hint)` · last-seen updates on heartbeat · no message content | None |
| **N4 · Business device registration** | Extends device-key infrastructure to accept business-owned device keys per `nex_business` · multi-device per business | 093-equivalent or newer |
| **N5 · Public business-assets bucket** | New `nex-business-public-assets` bucket · public: true · image MIMEs only | None |
| **N6 · Historical sweep audit table** | Records `(sweep_id, started_at, finished_at, rows_affected, bytes_removed)` only · never records content | None (housekeeping) |
| **N7 · Vault chat-preservation deprecation** | If Vault had a chat-preservation surface, retire it. Depends on Vault redesign scope. | Vault redesign workstream |

### 7.3 Migration dependency graph · corrected

```
         (previously: 216 → 217 → 218 for RLS harden → SHELVED)

CORRECTED SEQUENCE
─────────────────
N5 (public business-assets bucket)
  ├─▶ bucket-switch code rewrites in business-service + shop-setup

N2, N3, N4 (signaling + presence + business device-key)
  ├─▶ WebRTC infrastructure + presence service + business multi-device UX

N1 (content-column drop · staged)
  ├─▶ Phase 1: deploy new columns + shadow write (no ciphertext write)
  ├─▶ Phase 2: cutover all read paths to device-local
  ├─▶ Phase 3: freeze writes to old columns
  ├─▶ Phase 4: historical secure-delete sweep (§5)
  └─▶ Phase 5: drop old columns

N7 (Vault chat-preservation deprecation)
  └─▶ parallel to Vault-redesign workstream (outside Priority 1)

N6 (sweep audit)
  └─▶ paired with sweep execution
```

---

## 8 · Schema changes (illustrative · not SQL to apply)

### 8.1 `nex_peer_message` after Interp 1

```
nex_peer_message
  id                        uuid PK
  conversation_id           uuid FK → nex_peer_conversation
  sender_account_id         uuid FK → nex_account
  sent_at                   timestamptz           -- metadata only
  -- NO body
  -- NO encrypted/ciphertext/nonce/public_key/device_id/recipient_device_id/message_group_id
  -- NO attachment_url/attachment_type/attachment_meta
  -- NO reply_to_id (reply mechanics device-local)
  -- NO read_at (receipts device-local)
  -- NO disappearing_at (expiry device-local)
  -- NO reactions/reactions_order (reactions device-local, propagated via data channel)
  -- NO edit_history
```

Practical question: **does `nex_peer_message` need to exist at all?** If
the only columns are id + conversation_id + sender_account_id + sent_at,
the row is a trivial "event occurred" marker. Two options:

- **(x)** Keep it as a lightweight event marker (useful for conversation-order and "last activity" purposes).
- **(y)** Drop the table entirely; replace with a `last_message_at` column on `nex_peer_conversation`.

Option (y) is simpler and more honest to rule #1 (nothing message-shaped persists). Option (x) is a small concession for sort order. Not resolved · owner choice.

### 8.2 `nex_message` after Interp 1 (business chat)

Same analysis. Likely drop the table and replace with a `last_message_at` on `nex_conversation`.

### 8.3 New tables

```
nex_device_presence
  device_id                uuid PK
  account_id               uuid FK
  last_seen_at             timestamptz
  connection_hint          jsonb        -- optional NAT/ICE hint for faster rendezvous (no content)

nex_signaling_envelope
  id                       uuid PK
  from_device_id           uuid
  to_device_id             uuid
  payload                  jsonb        -- SDP / ICE candidate · ephemeral
  created_at               timestamptz
  consumed_at              timestamptz
  expires_at               timestamptz  -- auto-delete, aggressive TTL (60-120s)

  -- Storage policy: delete-on-consume; cron prunes any orphans.

nex_order (sealed Path A · unchanged)
nex_order_item (sealed Path A · unchanged)

nex_historical_sweep_audit
  sweep_id                 uuid PK
  table_name               text
  rows_affected            bigint
  bytes_removed            bigint
  started_at               timestamptz
  finished_at              timestamptz
  -- NO content fields; audit records the sweep, not what was swept
```

### 8.4 Business device-key extension

```
nex_device_key (existing · extended)
  -- existing columns
  owning_entity_type       text   CHECK IN ('account', 'business')  -- NEW
  owning_business_id       uuid FK → nex_business   -- NEW · nullable
  -- Enforces either account_id OR business_id, not both
```

---

## 9 · Product capabilities that become unavailable (rule #8 honesty)

The sealed trade-off is that privacy is worth more than these capabilities. Every item below must be honestly disclosed in the onboarding/help/marketing. They are **not bugs**; they are the direct consequence of the sealed architecture.

| # | Capability | Status under Interp 1 |
|---|---|---|
| 1 | Offline-recipient message delivery | **UNAVAILABLE** · sender sees "recipient offline · try again" |
| 2 | Multi-device message sync for a recipient (e.g. phone + desktop both get the same message if only one was online) | **UNAVAILABLE** · only online devices receive |
| 3 | Server-side message history recovery after device loss | **UNAVAILABLE** · user-controlled local backup only |
| 4 | Server-side chat search | **UNAVAILABLE** · search is device-local |
| 5 | Server-side moderation of message content (e.g. automated abuse detection) | **UNAVAILABLE** · moderation must be either device-local (report-triggered) or client-side opt-in |
| 6 | Push notification previews (sender name + first-line text) | **UNAVAILABLE** · content-free notifications only |
| 7 | NEX Assistant automated replies in business chat | **DEFERRED** · cannot operate without plaintext access or a device-key identity · separate owner decision |
| 8 | Cold-visitor rendering of `/shop` or `/menu` from a chat snapshot | **UNAVAILABLE** · chat does not carry snapshot data |
| 9 | HQ "delivering an important notice to an offline user" | **UNAVAILABLE** · HQ sees "user offline · retry" |
| 10 | NEX Official welcome arriving before user opens NEX on a device | **UNAVAILABLE** · defers until first device registration |
| 11 | Preserving a conversation as a Vault-stored archive | **UNAVAILABLE** at the server level · device-local export only |
| 12 | Resuming an interrupted attachment transfer from the server | **UNAVAILABLE** · transfers restart from zero on reconnection |
| 13 | Historical unread-count reconciliation after device re-install | **UNAVAILABLE** · device-local state is the only state |
| 14 | SafeChat server-side classifier on message content | **UNAVAILABLE** · classifier runs device-side if at all |
| 15 | Analytics on message content (sentiment · volume per topic · etc.) | **UNAVAILABLE** · conversation metadata only (counts, timing) |

These 15 items should be surfaced to the product/marketing/legal functions before the launch principle is adopted publicly.

---

## 10 · Revised implementation sequence (sandbox-only · staged)

Not authorised for implementation · listed to show the shape of the work.

| Phase | Work | Rough effort |
|---|---|---|
| **P2.1** | Build WebRTC signaling service (N2 migration + endpoint + client helper) | 2 weeks |
| **P2.2** | Build presence service (N3 migration + heartbeat + online/offline detection) | 1 week |
| **P2.3** | Build local-device message store (SQLite / IndexedDB · per-platform client lib) | 3 weeks |
| **P2.4** | TURN relay infrastructure decision + provisioning (self-hosted vs managed) | 1 week |
| **P2.5** | Rewrite peer-chat UI around device-to-device delivery + honest delivery states | 2 weeks |
| **P2.6** | Business device-key registration (N4) + business-device multi-device UX | 2 weeks |
| **P2.7** | Rewrite business chat around device-to-device · retire `nex_message` writes | 2 weeks |
| **P2.8** | Rewrite NEX Official + HQ Direct Channel around device-to-device delivery | 1-2 weeks |
| **P2.9** | Attachment transport via data channel (large-file chunking + resumption policy) | 1-2 weeks |
| **P2.10** | Public-business-assets bucket (N5) + code cutover for logos/venues | 3-4 days |
| **P2.11** | Push notification content strip (audit + rewrite dispatch service) | 3-4 days |
| **P2.12** | Historical inventory read-only task (§5.2) | 2-3 days |
| **P2.13** | Historical secure-delete execution (phased S1-S5) | 2 weeks (incl. 30-day user export window during which time code is paused on this lane) |
| **P2.14** | Vault chat-preservation deprecation (parallel) | 1 week |
| **P2.15** | Test authoring (unit + Playwright + security + privacy audit) | 3 weeks |
| **P2.16** | Documentation + onboarding + marketing copy aligned with §9 | 1-2 weeks |

**Aggregate estimate: 14-20 weeks of sandbox work** before Priority 1 can be independently verified against all eight rules. This is a major architectural rebuild, not a defect-fix sprint.

Priorities 2-12 in the sealed phase list are separate scope.

---

## 11 · Verification matrix (significantly expanded)

Not authorised to run yet · listed so the owner can review what "compliant" means at verification time.

| # | Test | Where | Severity |
|---|---|---|---|
| 1 | Send peer message to online recipient device · DB shows no new row with body/ciphertext content | Playwright + DB scan | **MANDATORY** |
| 2 | Send peer message to offline recipient · sender sees "offline" · zero DB rows added · no signaling envelope lingers past TTL | Playwright + DB + signaling-table scan | **MANDATORY** |
| 3 | Send with direct NAT traversal available · TURN not used · verify TURN logs show zero bytes | Network trace + TURN server audit | **MANDATORY** |
| 4 | Send through TURN relay (NAT blocked) · TURN logs show zero persisted bytes · packet retention proved zero via automated audit | TURN audit + sandbox script | **MANDATORY** |
| 5 | Attachment transfer (25 MB image) via data channel · no Supabase bucket object created · recipient sees decrypted file | Playwright + DB + bucket listing | **MANDATORY** |
| 6 | Attachment transfer connection interrupts mid-transfer · reconnection restarts from zero · no server-side chunk resumption | Playwright with network throttling | **MANDATORY** |
| 7 | Multi-device recipient · only online device receives · offline device never receives | Playwright multi-device | **MANDATORY** |
| 8 | Push notification payload audit · zero preview content · zero sender display name · zero attachment-kind disclosure | Push dispatch audit + manual inspection | **MANDATORY** |
| 9 | Business chat · customer sends with business owner device online · delivers | Playwright | **MANDATORY** |
| 10 | Business chat · customer sends with business owner device offline · fails honestly | Playwright | **MANDATORY** |
| 11 | NEX Official welcome · triggered on device-key registration · delivers via WebRTC · no DB message row created | Playwright + DB | **MANDATORY** |
| 12 | HQ Direct Channel · HQ staff sends · if user offline, HQ sees failure · no persisted HQ row | Playwright + DB | **MANDATORY** |
| 13 | Path A order · buyer submits · order lives in `nex_order` · chat carries only `order_handle` ciphertext · address not in any chat storage | Playwright + DB scan | **MANDATORY** |
| 14 | Historical sweep complete · service-role scan of `nex_peer_message` + `nex_message` + old bucket returns zero content | DB scan + bucket listing | **MANDATORY** |
| 15 | Signaling-table TTL working · no envelope persists past expiry | DB scan | **MANDATORY** |
| 16 | Presence table updates on heartbeat · last_seen drives online/offline decision correctly | DB + Playwright | **MANDATORY** |
| 17 | Device-key loss simulation · user re-installs on same device · no server-side history restored · onboarding explains this honestly | Playwright | **MANDATORY** |
| 18 | Delivery-state honesty · each state transition independently verified | Playwright per state | **MANDATORY** |
| 19 | Vault no-chat-backdoor · Vault cannot be used to save a chat message server-side · UI + API both refuse | Playwright + API test | **MANDATORY** |
| 20 | Server-logs audit · after a full chat session, server access logs contain zero message content, zero ciphertext, zero attachment bytes | Log review | **MANDATORY** |

A **privacy-compliance audit** (independent reviewer · owner-selected)
should sign off on every row above before any public launch claims the
launch principle.

---

## 12 · BUILT / WIRED / VERIFIED / REMAINING / BLOCKED (current state)

### BUILT (compliant foundation under Interp 1)
- Device-key management (`src/lib/nex-native/crypto/device-key.ts`)
- Shared-secret derivation (`src/lib/nex-native/crypto/shared-secret.ts`)
- Attachment envelope crypto (`src/lib/nex-native/crypto/attachment-envelope.ts`) · *keeps the key-wrapping logic; the storage-URL field is removed*
- Device-to-device key establishment (sealed as mig 093)
- Sealed Path A doctrine for commercial orders

### WIRED (but non-compliant and must be rewritten)
- `sendEncryptedPeerMessages` fan-out writer · writes ciphertext server-side (rule #1 violation)
- `/api/.../peer-message/encrypted` POST route · persists ciphertext (rule #1)
- `/api/.../peer-message/since` GET route · reads persisted content (rule #1)
- `/api/.../attachment/encrypted` POST route · writes attachment ciphertext to bucket (rules #1 and #2)
- `/api/.../attachment/encrypted/signed` route · signs URLs for persisted ciphertext (rule #1)
- `uploadPeerAttachment` · writes attachments to public bucket (rules #1, #2)
- `sendPeerMessage` plaintext writer · writes `body` (rule #1)
- `conversationService.postMessage` business-chat writer · writes `body` (rule #1)
- HQ Direct Channel `nex_hq_direct_send` RPC · writes content (rule #1)
- `dispatchPushNotification` call path with preview content (rule #7)

### VERIFIED (compliant surfaces under Interp 1)
- None yet. Every current chat path requires rework. The read-only
  investigation identified compliant primitives (crypto library), but
  no end-to-end flow is currently Interp-1-compliant.

### REMAINING (required to reach Priority 1 "verified")
- WebRTC signaling service (new)
- Presence service (new)
- TURN relay infrastructure (new · provisioning decision required)
- Local-device message store (new · per client platform)
- Business device-key extension (new)
- Business multi-device UX (new)
- Rewrite every call site currently writing to `nex_peer_message` / `nex_message`
- Rewrite UI around honest delivery states
- Push notification preview strip
- Public-business-assets bucket creation + code cutover
- Historical secure-delete end-to-end execution
- Vault chat-preservation retirement
- All 20 verification tests
- Independent privacy-compliance audit
- User-facing documentation / onboarding / marketing aligned with §9 trade-offs

### BLOCKED (need owner input before implementation)
- Decision §6.3 · fate of historical business-public assets in the chat bucket (copy-over · tolerate URL breakage · defer)
- Decision §4.2 · NEX Assistant in business chat · (defer · retire · redesign with always-on device-key)
- Decision §8.1 / §8.2 · `nex_peer_message` and `nex_message` tables · keep as event markers OR drop entirely in favour of `last_message_at`
- Decision §5.4 · historical export window length (30 days default · owner can set 0 for immediate delete)
- Decision §3.2 · TURN relay choice (self-hosted coturn vs managed Cloudflare / Twilio / Metered)
- Decision whether Priority 1 implementation proceeds pre-launch (adds 14-20 weeks) OR becomes v1.1 (public launch happens on current architecture with a disclosed privacy limitation and the migration ships post-launch)

---

## 13 · Launch-principle statement verification

Launch principle:
> *"NEX does not keep a copy of your private conversations. Your conversations belong to you and remain on your devices."*

This statement is **truthful only after**:
- All WIRED non-compliant routes retired or rewritten
- All REMAINING components built and verified
- All historical content securely deleted
- Independent privacy-compliance audit signed off
- Marketing / help / onboarding aligned with §9 trade-offs

Using the launch principle before this verification completes would be a
false marketing claim. The principle must stay internal-only until
verification is complete.

---

## 14 · Decision register · owner confirmation 2026-11-09

The owner reviewed revision 2 and provided final direction on the six
Priority-1-scope decisions. Four are now **sealed** as architectural
directions. Two remain **conditional proposals** pending their own
prerequisite work. None of the four sealed directions authorises
implementation · they set the design target · implementation remains
separately gated.

### 14.1 SEALED architectural directions (4 of 6)

| # | Decision | Sealed direction | Status |
|---|---|---|---|
| 1 | Historical business assets co-located in chat bucket | **Migrate** legitimate business assets to `nex-business-public-assets` · verify every reference + access path · THEN retire old bucket (retirement itself requires separate authorisation under invariant I-4 · §14.3) · no private chat attachments may remain publicly accessible | **SEALED · 2026-11-09** |
| 2 | NEX Assistant in business chat | **Defer** automated business-chat replies · no plaintext exception · no privacy-boundary weakening · revisit only with a design that preserves the privacy boundary | **SEALED · 2026-11-09** |
| 3 | `nex_peer_message` / `nex_message` tables | **Remove content-storage functionality** · retain minimal event markers ONLY where a demonstrated requirement justifies them · otherwise drop the tables entirely · no body / ciphertext / attachment content / sensitive structured metadata · smallest schema possible | **SEALED · 2026-11-09** |
| 6 | Launch sequencing | **Priority 1 must pass before NEX Chat is publicly launched** · if the wider NEX launch proceeds earlier, private chat remains unavailable until all its §21 launch gates pass · do NOT launch existing server-persisted chat under the new privacy promise | **SEALED · 2026-11-09** |

### 14.2 CONDITIONAL proposals · NOT sealed

| # | Decision | Status | Prerequisite before sealing |
|---|---|---|---|
| 4 | Historical export window length | **90-day PROPOSAL only · NOT sealed** | §17.1 aggregate inventory + §17.2 legal / retention review must complete first · owner may adjust the length after reviewing the memo |
| 5 | TURN relay provider | **Deferred · NOT sealed** | Documented provider comparison (zero-persistence · logging controls · data-processing terms · regional availability · security · independent privacy evidence) must be produced + owner-reviewed first |

### 14.3 Absolute process invariants (sealed 2026-11-09)

In addition to the eight Interp 1 architecture rules (§1), the owner
sealed six absolute invariants at revision-2 confirmation. These
cannot be overridden by implementation convenience, launch pressure,
or service-recovery requirements. I-1 / I-2 / I-3 reinforce existing
§1 rules as process invariants (no exception path at the process
level, not just at the architecture level); I-4 / I-5 / I-6 are new
process safeguards introduced at revision-2 confirmation.

| # | Invariant | Scope |
|---|---|---|
| **I-1** | **No private message content** (bodies, ciphertext, attachment bytes, sensitive structured metadata) **retained by NEX servers.** | Reinforces §1 rule #1 as a process invariant · no exception path, no feature flag, no "temporary" deviation |
| **I-2** | **No offline-delivery message queue, transient encrypted stash, or store-and-forward mechanism.** | Reinforces §1 rule #2 as a process invariant |
| **I-3** | **No plaintext exception for business chat, NEX Official, or HQ Direct Channel.** | Formal callout against surface-level exemption · any proposed exemption must raise a separate owner decision · never ship implicitly |
| **I-4** | **No historical deletion executes without separate explicit owner authorisation.** | Applies to §17.3 phases S3 onwards · each phase gates on its own authorisation · inventory + legal review alone do NOT authorise deletion |
| **I-5** | **No rollback restores private message content.** | Rollbacks can revert schema or feature flags, but never re-expose plaintext or ciphertext message storage, even to recover service quickly · §20 rollback-script CHECK enforces this at migration-tool level |
| **I-6** | **No public device-only-privacy claim until State C (§16) is independently verified across every applicable surface in §21.** | The launch principle cannot be published early even if most surfaces are state-C and only one is state-B · the claim is atomic across surfaces |

### 14.4 Three safeguards from revision-2 owner review (now formal doctrine components)

1. **Historical data is a separate risk.** The new architecture does
   not automatically erase old plaintext messages, metadata, or
   publicly accessible attachments. Inventory, retention / legal
   assessment, and an explicitly authorised deletion or migration
   plan are required. Handled in §17.

2. **Signaling is not message storage, but it still needs protection.**
   SDP and ICE data can expose network information. Define exactly
   what is collected, how long it exists, who can access it, and what
   is excluded from logs. TTL alone is not proof of deletion. Handled
   in §18.

3. **The §11 verification tests need independent evidence.** DB scans,
   TURN configuration, server logs, and Playwright tests should be
   supplemented by review of actual network traffic and storage
   behaviour. A passing UI test cannot prove that message content
   never reaches a server. Handled in §19.

### 14.5 The qualifying note on the 90-day window

Owner-exact qualification (revision 1 review · 2026-11-09):
> *"The 90-day export period is a proposal, not a settled retention
> policy. It needs to be checked against applicable legal obligations
> and the actual historical data inventory before it is sealed."*

Reaffirmed at revision-2 confirmation:
> *"Historical export: retain 90 days as a proposal only. Do not seal
> the retention period until the §17 inventory and legal/retention
> review are complete."*

§17's historical-data inventory + legal review is therefore a hard
prerequisite to sealing decision #4.

### 14.6 Launch-sequencing elaboration (per owner · revision-2 confirmation)

Owner-exact sequencing (sealed as decision #6 above):
> *"I would not launch NEX Chat with the old server-storage
> architecture and promise that the new architecture will arrive in
> v1.1. That creates a mismatch between the privacy promise and the
> actual product."*

> *"If the wider NEX launch cannot wait 14–20 weeks, launch the other
> ready experiences without private chat, and introduce chat only
> after verification. Do not let the launch date weaken the privacy
> architecture."*

This locks the trade-off as: public launch may proceed earlier only
if NEX Chat is excluded from the launch surface. The alternative
"launch with chat under the old architecture and promise v1.1" is
forbidden.

---

## 15 · Scope of what this doctrine does and does not do

### This doctrine DOES
- Supersede the prior incorrect Priority 1 doctrine on the single critical point (ciphertext-on-server is not compliant)
- Describe the target Interp 1 architecture concretely
- Enumerate every code and schema change required
- List the capabilities that disappear under Interp 1
- Propose an implementation sequence
- List the verification matrix for compliance claims (§11), plus independent-evidence supplement (§19)
- Document the six owner-recommended decisions arising from the correction (§14) · they remain recommendations awaiting final confirmation

### This doctrine DOES NOT
- Authorise any code change
- Authorise any migration creation or application
- Authorise any Supabase configuration change (no bucket creation · no RLS policy change · no bucket deletion)
- Authorise any commit · push · deployment
- Permit the launch principle to be stated publicly
- Describe NEX as compliant with the device-only directive
- Seal the six owner-recommended decisions (they remain recommendations awaiting final confirmation)
- Approve or select a TURN relay provider
- Approve any historical-data deletion
- Approve a specific export-window length

---

## 16 · Three-state honesty framework for compliance claims (new · owner-required)

Compliance claims must distinguish three distinct states. Never conflate
them. Never advance state A as evidence of state B. Never advance state
B as evidence of state C.

| State | Meaning | Internal claim allowed | Public claim allowed |
|---|---|---|---|
| **A · Feature disabled** | Writes have stopped. Previously-written data still exists. New messages / attachments no longer land in non-compliant storage. | "New writes blocked" | NO privacy claim yet |
| **B · Data deleted** | Historical data has been deleted. The deletion operation ran against the previously-stored data. | "Deletion executed · [date]" | NO privacy claim yet |
| **C · Deletion independently verified** | An independent reviewer (§19) has confirmed via direct inspection (DB · bucket · logs · network traffic) that the deletion is complete and the compliant architecture holds under live conditions. | "Deletion verified · [auditor] · [date]" | Launch principle may be stated |

The launch principle *"NEX does not keep a copy of your private
conversations. Your conversations belong to you and remain on your
devices."* requires **state C** across every surface in §21.

Any public statement made before state C is false marketing.

---

## 17 · Historical-data inventory + separate remediation authorisation (new · owner-required)

The architecture correction removes server-side storage going forward.
It does NOT remove historical data. That removal is a separate workstream
requiring its own owner authorisation and its own evidence trail.

### 17.1 Required inventory (read-only · pre-deletion · requires owner authorisation to begin)

An inventory task shall produce a report with:

| Target | What to count | Method |
|---|---|---|
| Plaintext `nex_peer_message.body` on `encrypted=false` rows | Row count · earliest/latest `sent_at` · distribution across accounts · distinct conversation count | Service-role DB scan · aggregates only · no body content exported from the production environment |
| Plaintext `nex_message.body` | Same | Same |
| Plaintext `nex_peer_message.attachment_meta` carrying commerce snapshots (cart · product · menu_item · product_share · document filename) | Row count + distinct `attachment_type` distribution · total JSONB bytes | Same |
| Ciphertext columns (`ciphertext` · `nonce` · etc.) on `nex_peer_message` | Row count | Same |
| Public bucket objects under chat prefix | Object count · total bytes · oldest / newest · size distribution | Supabase Storage list · no file downloads |
| Vault records referencing chat attachments | Row count | Service-role DB scan |

The inventory produces only **aggregate** data. Individual message
bodies, attachment bytes, or user-identifiable content are not exported
to any intermediate location during inventory.

### 17.2 Legal + retention review (required · may block deletion)

Before any deletion executes, review must confirm:

- Whether any affected account is subject to a legal hold, subpoena, or
  regulatory retention requirement in Ireland, Indonesia, or any
  Worldwide jurisdiction NEX serves.
- Whether any affected conversation is subject to an open user-support
  escalation that requires content preservation.
- Whether the data involves minors (which may trigger specific
  retention / reporting duties).
- Whether the deletion itself needs to be disclosed to users as a change
  in processing under GDPR Art 13/14 or equivalent.

Output: a legal-review memo signed by whichever advisor the owner
designates. The 90-day export window length is **conditional** on this
memo.

### 17.3 Deletion plan (phased · each phase requires separate owner authorisation)

| Phase | Name | What happens | Authorisation |
|---|---|---|---|
| **S0** | Inventory | §17.1 scan | Separate owner trigger |
| **S1** | Legal / retention review | §17.2 memo | Separate owner trigger |
| **S2** | User communication | Users informed of upcoming change + export availability | Separate owner trigger · comms copy owner-approved |
| **S3** | Export window (90 days **PROPOSED only · not sealed** · final length pending §17.1 inventory + §17.2 legal review per decision #4) | Self-service export endpoint + audited access · export route does NOT persist anywhere new | Separate owner trigger · endpoint owner-approved · final window length confirmed before S3 begins |
| **S4** | Freeze writes | New-write code already cut over before this phase · S4 verifies freeze | Automatic (verification only) |
| **S5** | Secure-delete | Service-role sweep nulls / deletes historical content · bucket objects removed · deletion audit written (N6 migration) | Separate owner trigger · deletion script owner-reviewed line-by-line |
| **S6** | Independent verification | Auditor confirms state C (§16) | Separate owner trigger · auditor owner-selected |

### 17.4 The never-restore constraint

No step in the deletion plan may re-stage, mirror, snapshot, or back up
the data being deleted into any new server-side store. The export
endpoint in S3 transmits user data directly to the authenticated user's
device over an authenticated session — it does not create a new NEX-held
copy. Rollback (§20) must never re-create persisted private-message
storage.

### 17.5 Explicit separation from §21 launch gates

Historical data present on disk does not block the Interp 1 architecture
being live for new sends, but it DOES block state C (§16) and therefore
blocks public launch-principle claims. "Feature disabled" (state A) and
"historical content removed" (state B) must both be true before state C
can be pursued.

---

## 18 · Signaling-data privacy inventory (new · owner-required)

Rule #3 permits ephemeral signaling for connection establishment. The
owner correctly noted that SDP and ICE data still expose network
information. This section defines the exact scope of what signaling
sees and how it is contained.

### 18.1 What SDP + ICE expose

| Field | Content | Privacy risk |
|---|---|---|
| ICE host candidates | Local private IP addresses on the user's device (e.g. 192.168.x.x) · interface names | Device fingerprinting · network-topology inference |
| ICE server-reflexive candidates | Public IP of the user's NAT, as seen from a STUN server | Geolocation · ISP identification |
| ICE relay candidates | TURN relay's IP (NEX's own infra) | Minor · points at NEX |
| `ice-ufrag` / `ice-pwd` | ICE session credentials | Session-replay if leaked |
| DTLS fingerprints | Device certificate fingerprint | Device fingerprinting |
| SDP media descriptions | Codec parameters · media types (`m=application` for data channel) | Low risk |
| SDP origin (`o=`) line | Session ID · session version | Session-correlation |

### 18.2 Mitigations required for the signaling layer

| Mitigation | How |
|---|---|
| mDNS ICE candidates | Modern browsers default to `.local` mDNS obfuscation for host candidates. Verify this behaviour is preserved by the client library choice · do NOT disable `RTCPeerConnection`'s default behaviour via config |
| Signaling table TTL | `nex_signaling_envelope` rows auto-expire within 60–120 seconds of creation. Consumed-on-ACK pattern deletes immediately on consumption |
| Server log scrubbing | HTTP access logs must NOT log request body contents for the signaling endpoint. Confirmed via log config inspection and V-LOG-1 (§19) |
| No long-term signaling archive | No table · bucket · or external log sink receives SDP/ICE content outside the ephemeral `nex_signaling_envelope` row |
| Access controls | Only the targeted recipient device may SELECT a signaling envelope addressed to it. RLS enforced via device-key authentication. No HQ / admin / moderation read path |
| Cron-prune verification | A scheduled job prunes expired envelopes. V-SIG-1 (§19) confirms zero rows past TTL exist under load |
| Metadata separation | Signaling table never carries message content · conversation preview · attachment metadata — only SDP/ICE and routing addressing |
| TURN credential scope | TURN credentials are per-session · short-TTL · non-reusable. Credentials themselves do not disclose user identity |

### 18.3 What the signaling layer may still retain (acceptable)

- Fact that user A attempted to signal user B at time T (routing metadata)
- Duration of the signaling exchange (for observability)
- Outcome: successful connection vs failure (for operator diagnostics)

These are connection-metadata signals that any messaging operator has.
They do not include content and do not contradict rule #3.

### 18.4 What the signaling layer may NOT retain (forbidden)

- SDP media descriptions beyond TTL
- Full ICE candidate lists beyond TTL
- DTLS fingerprints in any persistent store
- Any mapping of signaling to the subsequent data-channel contents
- Any content-derived field (preview · sender-name · attachment kind)

### 18.5 TTL alone is not proof of deletion

Per owner review: "TTL alone is not proof of deletion." The §11 test
15 (signaling TTL working) is supplemented by V-SIG-1 (§19) under
independent review. The TTL cron job must emit the deletion audit to
`nex_historical_sweep_audit` so an independent auditor can inspect the
prune record without reading SDP/ICE content.

---

## 19 · Independent verification requirements (new · owner-required)

The §11 verification matrix tests the application layer. The owner
correctly required supplementing it with independent network and
storage verification. UI tests passing is insufficient proof of
compliance.

### 19.1 Independent verification scope

| ID | Verification | Method | Who performs |
|---|---|---|---|
| **V-NET-1** | Network traffic review | Packet capture (pcap) at NEX server ingress + egress during live test sessions · inspect for message body bytes or attachment ciphertext bytes on inbound server interfaces · expected: zero | Independent reviewer · auditor or engineer outside the implementing team |
| **V-NET-2** | TURN relay traffic review | Packet capture at TURN server · inspect for packet retention between connection teardown and next session · expected: zero bytes retained | Same |
| **V-STORE-1** | Supabase DB scan under load | Service-role scan of `nex_peer_message`, `nex_message`, and any message-adjacent table during live test sessions · inspect for any row carrying message content · expected: zero | Independent reviewer |
| **V-STORE-2** | Bucket scan under load | List all Supabase Storage buckets · inspect for any object created in chat-related paths during test sessions · expected: zero (except in sanctioned legacy sweep window) | Independent reviewer |
| **V-STORE-3** | External storage audit | Confirm no third-party service (Cloudflare · AWS · etc.) caches or persists chat content on NEX's behalf · inspect CDN config · reverse-proxy config · log-sink config | Independent reviewer |
| **V-LOG-1** | Server log audit | Inspect server logs for any entry containing message content · attachment bytes · SDP/ICE content · ciphertext · expected: zero | Independent reviewer |
| **V-SIG-1** | Signaling retention audit | Query `nex_signaling_envelope` at several points under live load · verify no row exists past its TTL · verify cron-prune is active | Independent reviewer |
| **V-TURN-1** | TURN provider terms audit | Review contract + data-processing agreement with TURN provider · confirm zero packet persistence · confirm no provider-side logging of SDP/ICE | Legal + privacy officer |
| **V-DELETION-1** | Historical-sweep verification | Post-S5 (§17.3) scan confirms zero rows / objects from pre-cutover era remain | Independent reviewer |

### 19.2 Reviewer independence

The reviewer must NOT be:
- The engineer(s) implementing the architecture
- A direct report of the implementing team
- An employee of the TURN provider chosen in decision #5

Acceptable reviewers: outside auditor (e.g. Trail of Bits · Cure53 ·
NCC Group · comparable), owner-selected security consultant, or an
internal team segregated from chat implementation.

### 19.3 Evidence artifact

Each verification produces a dated signed artifact:
- Method used
- Test environment (sandbox or production · ideally both)
- Result (pass / fail · with evidence attachment)
- Residual risk notes
- Reviewer identity and date

These artifacts together constitute the state-C evidence (§16) that
unlocks public launch-principle claims.

### 19.4 What UI tests cannot do

The §11 Playwright tests exercise the UI and verify observable DB
state. They cannot prove:
- That no plaintext traffic transits a NEX server-controlled interface
- That TURN relay operator-side storage is zero (this requires the
  V-TURN-1 contract audit, not a test)
- That no CDN or log-sink is caching content invisibly
- That the deletion of historical data is complete at the object/row
  level without an independent scan

V-NET-1 · V-NET-2 · V-STORE-1/2/3 · V-LOG-1 · V-TURN-1 · V-DELETION-1
are therefore not duplicates of §11 tests · they are the independent
layer that permits state C.

---

## 20 · Migration + rollback plan (new · owner-required)

Every schema change in §7 ships with a rollback. The rollback itself
must honour the never-restore constraint from §17.4.

### 20.1 Rollback principle

A rollback MAY:
- Restore a dropped column IF AND ONLY IF the column is a non-content
  column (e.g. an index · a constraint · a non-sensitive metadata field)
- Restore a non-chat bucket · a non-chat table · a non-chat policy
- Re-enable a previously disabled feature flag

A rollback MAY NOT:
- Re-create a `body` or `ciphertext` column on `nex_peer_message` or `nex_message`
- Re-provision a private-ciphertext bucket
- Restore historical plaintext or ciphertext from any backup
- Re-enable any code path that writes message content to a persistent store
- Reverse a historical-data secure-delete (§17.3 S5)

### 20.2 Per-migration rollback plan (summary)

| New migration (§7.2) | Rollback purpose | Rollback allowed? |
|---|---|---|
| N1 · Content-column drop (staged) | Reverts a stage if cutover fails · but final drop is one-way | Allowed per-stage during cutover · the final drop is permanent |
| N2 · Signaling table | Drop table | Allowed |
| N3 · Presence table | Drop table | Allowed |
| N4 · Business device registration | Revert column additions on `nex_device_key` | Allowed |
| N5 · Public business-assets bucket | Retire new bucket · revert code to old bucket writes (temporary) | Allowed as a safety net · permanent reversion means the bucket split failed and must be redone, not that private chat storage returns |
| N6 · Historical sweep audit table | Drop table | Allowed |
| N7 · Vault chat-preservation deprecation | Revert feature disable | Allowed only if the Vault-restored path still complies with rule #1 (no server-side chat content storage via Vault) |

### 20.3 Rollback drill

Before any production application of these migrations (outside current
authorisation · tracked here), a sandbox rollback drill must:
- Apply each migration
- Immediately test the rollback
- Confirm the rollback does not re-expose private message content
- Confirm the rollback does not cause data loss outside the intended scope
- Record the drill as evidence

### 20.4 The never-restore constraint in rollback failure modes

If a rollback is attempted and it would re-expose private chat content
(e.g. because an operator attempts to revert the N1 content-column
drop), the migration tooling must refuse. The rollback script itself
embeds a CHECK that refuses to execute if the reverting action would
re-create a persisted chat-content column or bucket. This is a
defence-in-depth measure against operator error.

---

## 21 · Explicit launch gates per surface (new · owner-required)

Each surface in scope for rule #3 has its own launch gate. Public launch
may not proceed for a given surface until all of that surface's gates
are closed (i.e. "passed").

### 21.1 Peer chat (user ↔ user)

| Gate | Passed when |
|---|---|
| Content writes eliminated | `nex_peer_message` content columns dropped · service-role scan confirms zero content rows (state B) |
| Delivery honest | §11 tests 1, 2, 7 pass · delivery states (§4.9) implemented as specified |
| Signaling scoped | §18 mitigations in place · V-SIG-1 passes |
| Attachment compliance | §11 tests 5, 6 pass · V-STORE-1/2 confirm zero bucket objects for chat during test |
| Network-traffic verified | V-NET-1 passes |
| Historical swept | §17 phases S0-S6 complete · V-DELETION-1 passes |
| Independent sign-off | §19 reviewer-signed artifacts filed for this surface |

### 21.2 Business chat (customer ↔ business)

| Gate | Passed when |
|---|---|
| Content writes eliminated | `nex_message.body` dropped · service-role scan confirms zero content rows |
| Business multi-device live | N4 applied · business-device UX functional · at-least-one-device-online semantics tested |
| Delivery honest | §11 tests 9, 10 pass |
| No Assistant plaintext path | Decision #2 sealed (defer) · no server-side Assistant message path exists |
| Historical swept | Shared with peer chat (§17 covers both) |
| Independent sign-off | §19 reviewer-signed artifact filed |

### 21.3 NEX Official

| Gate | Passed when |
|---|---|
| Sentinel device-key infrastructure live | NEX Official account has registered device keys · always-on device operates (decision #3's "defer delivery until device registration" is the fallback path) |
| Welcome flow delivers device-to-device | §11 test 11 passes |
| No persistent welcome row | DB scan confirms zero NEX Official content rows persisted |
| Independent sign-off | §19 artifact filed |

### 21.4 HQ Direct Channel

| Gate | Passed when |
|---|---|
| HQ staff authenticated with own device keys | Device-key registration per HQ staff account · no sentinel shortcut |
| HQ sees honest "user offline" response | §11 test 12 passes |
| No persistent HQ-message row | `nex_hq_direct_send` RPC retired · DB scan confirms zero HQ content rows persisted |
| HQ-user tracker non-content | `nex_hq_direct_channel` tracker exists only as metadata (existence of correspondence · no content) |
| Independent sign-off | §19 artifact filed |

### 21.5 Attachments

| Gate | Passed when |
|---|---|
| Transport over data channel | §11 tests 5, 6 pass |
| No Supabase bucket writes for private chat | `nex-peer-chat-attachments` writes retired for chat · V-STORE-2 passes |
| mig 295 obsolete | Confirmed not applied anywhere · `nex-peer-chat-ciphertext` bucket not provisioned |
| Historical attachment sweep | §17 S5 covers bucket objects · V-DELETION-1 passes for buckets |
| Independent sign-off | §19 artifact filed |

### 21.6 Vault (relative to Priority 1 only)

| Gate | Passed when |
|---|---|
| No chat-attachment persistence via Vault | Vault code audited · no path writes chat ciphertext or plaintext to Vault storage |
| Vault chat-preservation surface retired | N7 applied · UI path removed · user data migrated to device-local export if any |
| Vault-as-separate-product scope | Tracked as a parallel workstream (not gated by Priority 1) |
| Independent sign-off | §19 artifact filed for the "Vault does not back-door private chat content" claim |

### 21.7 Overall launch-principle statement (§13)

May only be made publicly when **every** surface above has all its gates
passed and state C (§16) is reached for every surface.

---

## 22 · Where this doctrine lives

- Repository: `C:/Users/Victus/nexapp` (ratified canonical · 2026-11-09)
- Branch: `nex-ireland-build-2026-11-06`
- File path: `docs/doctrine/nex-chat-device-only-remediation-plan-2026-11-09.md`
- Supersedes: revision 1 at the same path (which both described Interp 3 incorrectly in its earliest form, and in revision-1 lacked the three safeguards the owner required at review)
- Revision history:
  - Revision 0 (pre-correction): described Interp 3 "encrypted archive on server" as the compliant E2E foundation · SUPERSEDED by owner Correction A
  - Revision 1 (post-correction): rewrote around Interp 1 pure peer-to-peer · surfaced 5 new open decisions · owner review asked for 3 safeguards
  - **Revision 2 (this file)**: integrated safeguards (§16 three-state framework · §17 historical-data remediation · §18 signaling privacy · §19 independent verification · §20 rollback never-restore · §21 per-surface launch gates) · six recommended decisions documented in §14 pending final owner confirmation
- Related doctrines:
  - `docs/doctrine/nex-chat-order-data-separation-proposal-2026-11-08.md` (sealed Path A plan · referenced in §4.7)
  - Memory: `project_nex_chat_device_only_e2e_sealed_2026_11_09.md` (sealed directive)
  - Memory: `project_nex_priority_1_architecture_correction_sealed_2026_11_09.md` (architecture correction + Interp 1 seal)
  - Memory: `project_nex_phase_2_remediation_priorities_sealed_2026_11_09.md` (12-step sequencing)

---

**End of corrected Priority 1 doctrine · revision 2 (owner-confirmed 2026-11-09).**

Nothing in this document authorises code changes, migration application,
Supabase configuration changes, commits, pushes, or deployments. All
such actions require separate explicit owner authorisation per the
sealed Phase 2 operating envelope.

Decision-register state as of revision-2 owner confirmation:
- **Decisions 1, 2, 3, 6: SEALED architectural directions** (§14.1).
- **Decisions 4, 5: CONDITIONAL proposals · NOT sealed** (§14.2). The
  90-day export window remains a proposal pending §17.1 inventory +
  §17.2 legal review. TURN provider selection remains deferred pending
  documented provider comparison + independent privacy evidence.
- **Six absolute invariants sealed** (§14.3) · I-1 / I-2 / I-3
  reinforce existing §1 rules · I-4 / I-5 / I-6 are new process
  safeguards (no historical deletion without separate authorisation ·
  no rollback restores private content · no public privacy claim
  until State C independently verified across every applicable
  surface).

Sealing the four architectural directions does NOT authorise Priority 1
implementation. Priority 1 code work remains gated on a separate
explicit owner authorisation message. The launch principle remains
internal-only until state C (§16) is reached across every surface
in §21.
