# NEX · Device-Only Storage Verification · 50,000 Free Users
### 2026-11-09 · Audit-only · no code changes

**Author:** Claude Opus 4.7 · operating under owner-authorised read-only audit scope.
**Scope:** verify whether NEX can support 50,000 free accounts without accumulating NEX-controlled storage costs for private chat content, conversation history, or private attachments. **Zero production changes. Zero code changes. Zero migrations. Zero deletions.**
**Method:** comprehensive repository inspection + Supabase schema + bucket + Realtime + background-job survey + grep sweeps · evidence-based findings only.
**Related sealed doctrines:**
- `project_nex_chat_device_only_e2e_sealed_2026_11_09.md` (sealed directive)
- `docs/doctrine/nex-chat-device-only-remediation-plan-2026-11-09.md` (Rev 2 · owner-confirmed)
- `docs/doctrine/nex-chat-historical-data-inventory-2026-11-09.md` (aggregate inventory · prod + sandbox)

---

## 0 · The headline verdict

**NEX in its current state CANNOT support 50,000 free users without accumulating NEX-controlled storage of private chat content.**

Every message sent on the current production architecture writes a row into a NEX-controlled Supabase table. Every attachment uploaded by a chat path lands in a NEX-controlled Supabase Storage bucket. The device-only architecture that is sealed as the Phase 2 target has NOT been built yet. Phase 2 remains a 12-16-week engineering programme.

If 50,000 free users signed up today and used chat normally, NEX-side storage would grow proportional to message volume × average body size + attachment bytes. The sealed privacy promise cannot be truthfully made on the current architecture.

---

## 1 · Required architecture (from owner's scope + Rev 2 doctrine)

The nine must-not rules for device-only storage compliance:

1. Private chat history stored **on the user's own device**
2. Private message content **end-to-end encrypted**
3. Private attachments **on the user's own device**
4. NEX **must not retain private message bodies · plaintext OR ciphertext**
5. NEX **must not store private attachments** in Supabase Storage or any server-side bucket
6. NEX **must not operate server-side offline message queues · temporary encrypted stashes · store-and-forward**
7. NEX **must not create server-side conversation backups or synchronisation copies**
8. Encryption keys **remain under the users' device control**
9. Offline recipient → delivery FAILS · sender gets honest status · **no server retention**

WebRTC signalling may transit connection-establishment info (SDP · ICE). TURN may relay encrypted packets DURING an active connection. Neither may persist content.

---

## 2 · Comprehensive inspection findings

### 2.1 Chat message storage · Supabase tables

| Table | Written by | Stores private content? | Row growth with 50k users? |
|---|---|---|---|
| `nex_peer_message` | `sendPeerMessage()` + `sendEncryptedPeerMessages()` + direct inserts (guest chat · calls · HQ) | **YES** · `body` column holds plaintext when `encrypted=false` · `ciphertext` + `nonce` + `sender_public_key` + `recipient_device_id` + `message_group_id` hold encrypted content when `encrypted=true` | **YES · 1 row per sent message per recipient device** |
| `nex_message` | `conversationService.postMessage()` from chat/message route · visitor-first-message route · 3 `_actions.ts` call sites · NEX Assistant gateway | **YES · plaintext `body` column · NO E2E path exists** | **YES · 1 row per business-chat message** |
| `nex_peer_message.attachment_meta` (JSONB) | Commerce send paths (product · menu_item · cart_order · product_share) + document chip · HQ direct marker | **YES · plaintext structured snapshots** carrying prices · phones · shipping addresses (cart_order), product details · discount grants | **YES · 1 JSONB blob per commerce-tagged message** |
| `nex_peer_conversation` | `getOrCreatePeerConversation()` | Participant pair + `last_message_at` metadata only · not content · **COMPLIANT in isolation** | Yes · 1 row per unique participant pair · not content-sized |
| `nex_conversation` | Business-chat equivalent | Business ID + optional product ID + timestamps only · **COMPLIANT in isolation** | Yes · 1 row per unique customer-business pair · not content-sized |
| `nex_conversation_participant` | `addParticipant()` | Role + last_read_at · **COMPLIANT in isolation** | Linear with participant count |
| `nex_vault_conversation_envelope` (mig 143) | Vault flow (vault key wrapping) | Encrypted key envelope · not message content · **COMPLIANT** per sealed mig 143 doctrine | Zero at launch · grows if Vault adoption + chat-preservation feature is used |
| `nex_vault_file` (mig 141) | Vault file preservation | File metadata + bucket paths + optional source_message_id | **ZERO rows on production per 2026-11-09 inventory** · no chat attachment currently referenced |

**Severity today:** `nex_peer_message.body` + `nex_peer_message.ciphertext` + `nex_message.body` ALL violate rule #4 as-architected. `attachment_meta` violates rule #4 for commerce types.

### 2.2 Attachment storage · Supabase Storage buckets

| Bucket | Public? | Chat-related? | Current usage | 50k-user implication |
|---|---|---|---|---|
| `nex-peer-chat-attachments` (mig 055) | **public: true** | **YES** · created explicitly for chat | 26 objects on production (17 `enc/` chat ciphertext + 9 business-logo) | **Every chat image/video/audio upload lands here** · linear bytes growth with user activity |
| `nex-peer-chat-ciphertext` (mig 295 target) | would be private | Would be chat-only | **NOT PROVISIONED** · mig 295 was the Interp-3 target · forbidden under Interp 1 | Would have grown with Bridge 81 encrypted attachments if provisioned |
| `nex-business-public-assets` | planned (mig 313+ future) | No · business logos only | Not provisioned | N/A for private chat |
| `nex-theme-*` (sticker · emoji · hero) | public: true (theme assets) | No · theme catalog | — | N/A |
| `nex-media-chat-themes` + `nex-music-media` + venue + others | varied | No | — | N/A |
| `nex-vault-files` | private · owner-scoped | Vault files only | — | Vault scope · not launch chat scope |

**Severity today:** rule #5 violated by every active image/video/audio chat attachment upload path.

### 2.3 Chat APIs + server actions that write private content

Enumerated from grep + prior inventory + Phase 2 doctrine:

| Endpoint / Action | Writes private content? | Classification |
|---|---|---|
| `/api/nex-native/chat/message` POST | YES · plaintext body to `nex_message` | Rule #4 violated |
| `/api/nex-native/chat/visitor-first-message` POST | YES · plaintext body | Rule #4 violated |
| `/api/nex-native/chat/visitor-session` POST | Visitor-session metadata · no body | Low concern |
| `/api/nex-native/chat/nex-reply` | NEX Assistant plaintext reply persisted | Rule #4 violated |
| `/api/nex-native/peer-message/encrypted` POST | Ciphertext fan-out rows to `nex_peer_message` | Rule #4 violated (ciphertext IS content under directive) |
| `/api/nex-native/peer-message/since` GET | Reads server-persisted content | Implies content exists server-side · rule #4 corollary |
| `/api/nex-native/attachment/encrypted` POST | Attachment ciphertext to private bucket (when provisioned) OR public bucket fallback | Rule #5 violated |
| `/api/nex-native/attachment/encrypted/signed` GET | Signed URL for ciphertext in bucket | Implies bucket contains content · rule #5 corollary |
| `/api/nex-native/chat/guest/[ownerAccountId]` server action | Direct `INSERT INTO nex_peer_message` with plaintext `body` + `encrypted:false` | Rule #4 violated |
| `src/app/nex-native/_actions.ts` (16 call sites) | Mix of `sendPeerMessage` (plaintext) and `conversationService.postMessage` + stickers / product share / menu item / cart order / call invite | Rules #4 + #5 violated depending on path |
| `src/lib/nex-native/share-service.ts` | 2 `sendPeerMessage` call sites · product share | Rules #4 + #5 violated |
| `src/lib/nex-native/calls/invite-service.ts` | Direct insert of call-invite row | Rule #4 violated for invite body |
| `src/lib/nex-native/hq-direct-channel/hq-direct-service.ts` | `nex_hq_direct_send` SECURITY DEFINER RPC writes plaintext | Rule #4 violated |
| `src/lib/nex-native/first-conversation/welcome-delivery.ts` | NEX Official welcome via `sendPeerMessage` | Rule #4 violated |

### 2.4 Background jobs · cron · queues

Vercel cron config (`vercel.json`):

```
/api/nex-native/harvest/tick              · hourly (0 * * * *)     · directory harvest · NO chat content
/api/nex-native/billing/cron/reconcile    · every 15m              · billing reconciliation · NO chat content
/api/nex-native/cron/security-audit-reconcile · every 10m          · security audit · NO chat content
```

**No cron writes chat content.** Three cron paths exist · none process private messages or attachments. ✓ compliant.

Separately:
- `disappearing-messages-service.ts` + mig 283 + mig 284 · "purge expired peer messages" · this is a DATA-DELETION path (not content-write). Design intent · retire old plaintext/ciphertext rows. But it presumes the rows EXIST in the first place · which is itself non-compliant. Under Interp 1 target state, this entire mechanism becomes obsolete.

### 2.5 Supabase Realtime subscriptions

Realtime is used for:
- **Voice/video call signalling** (`src/lib/nex-native/realtime/signalling.ts` + `channel.ts`) · ephemeral pub-sub for SDP/ICE/ring/bye signals · scoped `nex:signal:{conversationId}` · **does NOT persist content** · ✓ compliant with rule #6/#9
- **Live broadcast** (`live-broadcast/*`) · pub-sub for live-stream presence, comments, featured products · not private chat · out of scope
- **Group-call engine** (`calls/group-call-engine.ts`) · WebRTC coordination · ephemeral
- **Status presence** (`status-p2p/presence.ts`) · presence beacons · no content
- **HQ Alerts auto-refresh** (`hq/alerts/_auto-refresh-client.tsx`) · operational monitoring
- **Message arrival nudge** (used by `/api/.../peer-message/encrypted`) · emits a "new message in conversation X" event · `data` payload carries conversation_id + timestamp only · no body content · ✓ compliant AT THE REALTIME LAYER (but the content it nudges attention to is still in the DB · rule #4 handled separately)

**No Realtime channel persists private chat content.** Realtime is a pub-sub broker · all compliance risk is on the downstream DB write.

### 2.6 Logs · analytics · error reporting

Audited `console.error` / `console.log` / `console.warn` call sites around chat routes:
- `/api/.../chat/message/route.ts` lines 48, 116, 144 · log error `.message` string only · NOT message body content · ✓ compliant
- `security-audit-service.ts` · has explicit sanitiser (`sanitiseMetadata`) that excludes message content · ✓ compliant
- `safechat/_hook.ts` · SafeChat Phase 1 classifier · explicitly *simulated detection* · errors swallowed · no body persisted beyond the server-side row the chat path already writes (so this one's compliance risk is in the main chat write path, not here)

**No analytics / error / log path leaks private message content.** ✓ compliant.

### 2.7 Browser-side storage (IndexedDB · localStorage · Cache Storage)

Grep found 10 files using IndexedDB-style storage (chat shell · composer · cart · backgrounds). This is where device-only history SHOULD live. Current state: partially used for UI state + cart drafts · not yet the authoritative message store.

**Browser-side storage is where COMPLIANCE lives under Interp 1.** The lift is to make it the exclusive persistent store for message history + decrypted attachments.

### 2.8 WebRTC + TURN

- **Signalling** · Supabase Realtime (ephemeral · SDP/ICE only · no content persisted)
- **TURN** · not yet provisioned (D-5 deferred per Rev 2 doctrine)

When TURN IS provisioned, the owner-sealed requirement is zero packet persistence + zero SDP/ICE logging on the provider side. Rev 2 §18 + §19 cover this (V-TURN-1 audit). Today · TURN is not live · zero attack surface. Future · provider contract + §18 mitigations must hold.

### 2.9 Vault

Per 2026-11-09 inventory:
- `nex_vault_file` · **0 rows on production** · Vault has never persisted a chat attachment
- `nex_vault_conversation_envelope` · 3 rows on production (crypto key envelopes, not content)
- `nex_vault_key_envelope` · 8 rows (user device-key wrapping)
- `nex_vault_setup` + `nex_vault_pin_attempt` · setup state

**Vault is not currently a back-door for private chat content.** The Phase 2 Rev 2 doctrine seals that Vault must not become one.

### 2.10 Supabase schema migrations that create content-storage columns

| Migration | What it adds | Compliance status under Interp 1 |
|---|---|---|
| 047 | `nex_peer_message` with `body` | ❌ `body` column must be removed under Interp 1 |
| 055 | Public chat attachment bucket | ❌ bucket becomes chat-forbidden |
| 059 · 067 · 077 · 088 | commerce `attachment_type` additions | ❌ structured plaintext snapshots |
| 093 | encrypted columns (ciphertext/nonce/etc.) | ❌ ciphertext is still forbidden server-side content |
| 125 | peer_message link_preview columns | ❌ |
| 199 | chat privacy prefs | ✓ metadata only |
| 259 | attachment_type adds `document` | ❌ filename is sensitive |
| 279 | peer_message edit (history/edited_at) | ❌ edit history is content |
| 282 · 283 · 284 | disappearing messages mechanism | ❌ presumes server-stored rows |
| 295 (not applied) | private ciphertext bucket · Interp-3 target | ❌ **obsolete under Interp 1 · must not apply** |
| 298 | peer_chat envelope overlay | ❌ |

---

## 3 · The five audit questions

### Question 1 · Does creating 50,000 free accounts create any server-side storage of private chat content?

**Direct answer: YES · as implemented today.**

Signup itself is content-neutral (creates `nex_account` row · no private chat content). But the moment any of those 50,000 users SEND a chat message, each send writes a row to `nex_peer_message` (plaintext OR ciphertext) or `nex_message` (plaintext). Additionally:

- NEX Official sends an automated welcome message to every new user · writes 1 row per signup to `nex_peer_message`
- `welcome-delivery.ts:100` triggers on the welcome outbox worker · writes plaintext body

**Minimum server-side writes per new user on the current architecture:** at least 1 row in `nex_peer_message` for the NEX Official welcome. For 50,000 accounts: **50,000+ welcome message rows** containing plaintext body content. Plus any first-user activity.

### Question 2 · Can any API or background process persist private message content?

**Direct answer: YES · multiple paths today.**

Paths enumerated in §2.3 above · 14 endpoints / server actions / services write private message content to a NEX-controlled database. No background cron writes chat content, but the live user-facing paths do. Also:
- `nex_hq_direct_send` SECURITY DEFINER RPC (HQ Direct Channel) writes plaintext bodies
- `welcome-outbox-worker.ts` (first-conversation welcome · on signup) writes via `sendPeerMessage`
- `intelligence/nex-intelligence-gateway.ts` NEX Assistant reply queue writes to `nex_message.body`

### Question 3 · Can encrypted message ciphertext be stored in a database, bucket, queue, or cache?

**Direct answer: YES · in two places today.**

1. **Database** · `nex_peer_message.ciphertext` + `nonce` columns (mig 093) · rows written by `sendEncryptedPeerMessages()` fan-out path · 7 such rows live on production today per 2026-11-09 inventory
2. **Bucket** · `nex-peer-chat-attachments` public bucket holds Bridge-81-era `enc/` prefix attachment ciphertext (17 objects on production today)

Both forms of ciphertext are forbidden under Interp 1 rule #4 (encryption at rest ≠ device-only). The inventory shows these ciphertext objects + rows exist today on the authorised production project and would continue to accumulate as free users use chat.

### Question 4 · Can private attachments reach Supabase Storage or another NEX-controlled storage provider?

**Direct answer: YES · in the current architecture every attachment upload writes to Supabase Storage.**

Call sites that write chat attachments to Supabase Storage (NEX-controlled):
- `peer-message-service.uploadPeerAttachment()` → `nex-peer-chat-attachments` public bucket (plaintext) · 25 MB cap
- `encrypted-attachment-upload.ts` + `/api/.../attachment/encrypted` → was the `nex-peer-chat-ciphertext` private bucket (Interp-3 model) · falls back to public bucket if the private bucket isn't provisioned (or 503s per the sealed fail-closed · but either way the upload path exists)

Additionally · the `attachment_url` column on `nex_peer_message` is a direct pointer to the bucket · the URL would be public-readable on the current public bucket.

### Question 5 · Can offline delivery create any form of server-side retention?

**Direct answer: YES · the current architecture IS offline-delivery-enabled by storing messages.**

Today when sender → recipient is offline:
- `nex_peer_message` row is still written (the recipient will see it on next connect because they read from the DB)
- No separate "offline queue" exists · but the DB table IS the de facto offline retention store
- Rule #6 (no store-and-forward) is violated by the fact that persisted messages ARE retained until the recipient's next fetch

The Rev 2 sealed architecture requires: offline recipient → delivery FAILS with honest status · no DB row written. Current implementation writes a row regardless.

### Supplementary question · Can 50,000 users use NEX without NEX-side storage growing?

**Direct answer: NO on the current architecture.**

Linear storage growth per user under current implementation:

| Surface | Rough growth per 50k users (order-of-magnitude) |
|---|---|
| `nex_peer_message` rows (1-row minimum for welcome · 10-100 rows/user/day for active users) | 50k - 5M+ rows · each with body (avg 100-500 bytes) |
| `nex_message` rows (business-chat · if active) | 10k+ rows · each with plaintext body |
| Attachments in `nex-peer-chat-attachments` bucket | Depends on image/video usage · potentially MB-to-GB per user |
| `attachment_meta` JSONB (commerce types) | Low volume · bytes-sized |
| `nex_peer_conversation` rows | ~50k (1 per unique pair) · metadata only · not content |

**Projected worst-case NEX-controlled storage at 50k free users on current architecture:** low-to-mid gigabytes per month depending on activity. The exact figure depends on message volume + attachment usage, but the answer to "does storage grow" is unambiguously YES.

---

## 4 · Where the current architecture would support 50k users WITHOUT private-content storage growth

**Only if Phase 2 Rev 2 is implemented first.** The sealed target is:

| Surface | Rev-2 compliant behaviour | Server-side storage per message? |
|---|---|---|
| Peer chat | WebRTC data channel between online devices · live TURN relay (no persistence) · no DB body/ciphertext column | **Zero** |
| Business chat | Business device-keys + WebRTC (same model) | **Zero** |
| Attachments | Chunked ciphertext over WebRTC data channel | **Zero** |
| NEX Official welcome | Delivered via WebRTC when first device registers · "defer-until-device" model | **Zero** |
| HQ Direct Channel | HQ staff device-keys + WebRTC | **Zero** |
| Offline recipient | Delivery fails with honest status | **Zero · no row written** |
| Signalling | Ephemeral `nex_signaling_envelope` with aggressive TTL (60-120s) · consumed-on-ACK | **Transient metadata only** |
| Presence | `nex_device_presence` heartbeat state | **Metadata only · no content** |

Under this target architecture: 50,000 users can send unlimited messages and attachments **with zero NEX-controlled growth of private content**. NEX storage cost per free user converges to: one metadata row for the user account + presence heartbeats · bounded · cents per account per year.

**But this architecture is NOT built yet.** 12-16 weeks of engineering remain (per Rev 2 §10) · plus D-1..D-6 architectural decisions · legal review · TURN provider selection.

---

## 5 · What would be needed to safely support 50,000 free users

In priority order:

1. **Phase 2 implementation complete** (Rev 2 §10 · 12-16 weeks)
2. **Historical secure-delete** (Rev 2 §17 · 6 phases S0-S6) · removes the 40+891+7 rows + 17 bucket objects of pre-cutover content currently on production
3. **Independent audit** (Phase 5) · confirms State C across every surface
4. **D-1..D-6 architectural decisions** · particularly D-5 TURN provider (zero-persistence contract)
5. **Legal review** (L-1..L-6) · GDPR · retention · DSR · DPA
6. **Launch-gate review** (Phase 6)

Only after all of these can NEX truthfully claim its launch principle: *"NEX does not keep a copy of your private conversations. Your conversations belong to you and remain on your devices."*

Before then: free-tier launch would simultaneously (a) accumulate NEX-controlled storage and (b) permit the launch principle to become a false marketing claim · both of which contradict the sealed operating envelope.

---

## 6 · What compliance looks like with evidence

Adapted from Rev 2 §19 (independent verification):

| Verification | Evidence that proves compliance |
|---|---|
| **V-NET-1** · network traffic review | pcap at NEX ingress during 50k-user load · zero body bytes · zero ciphertext bytes · all content transits via WebRTC data channel direct or TURN relay |
| **V-NET-2** · TURN relay audit | TURN provider contract excludes packet persistence + SDP/ICE logging · packet counters show zero bytes retained between sessions |
| **V-STORE-1** · DB scan under load | `SELECT COUNT(*) FROM nex_peer_message WHERE body IS NOT NULL OR ciphertext IS NOT NULL` returns **zero** · also for `nex_message.body` |
| **V-STORE-2** · bucket scan | `nex-peer-chat-attachments` and `nex-peer-chat-ciphertext` either (a) have zero chat-prefix objects or (b) do not exist |
| **V-STORE-3** · external storage audit | No CDN · reverse-proxy · log-sink caches chat content |
| **V-LOG-1** · server-log audit | Zero body / ciphertext / SDP / ICE in server logs |
| **V-SIG-1** · signalling retention | `nex_signaling_envelope` rows age-out within TTL · no rows past expiry |
| **V-DELETION-1** · historical sweep | Zero pre-cutover rows / objects remain after S5 sweep |

Until these V- checks pass under 50k-user load, the 50k-free-user storage claim remains unproven.

---

## 7 · Audit verdict · one-line answers

| Question | Answer |
|---|---|
| **Q1** Does creating 50k free accounts create server-side storage of private chat content? | **YES, today** · signup welcome messages write plaintext rows · chat activity writes rows · attachments land in Supabase Storage |
| **Q2** Can any API or background process persist private message content? | **YES, today** · 14 endpoints/services write private content · cron is clean but live paths are not |
| **Q3** Can encrypted message ciphertext be stored in a DB/bucket/queue/cache? | **YES, today** · `nex_peer_message.ciphertext` column (7 rows on prod) + `enc/` bucket prefix (17 objects on prod) |
| **Q4** Can private attachments reach Supabase Storage or another NEX-controlled provider? | **YES, today** · every attachment upload path writes to `nex-peer-chat-attachments` |
| **Q5** Can offline delivery create any form of server-side retention? | **YES, today** · persisted DB row IS the offline-retention mechanism · no separate queue but the effect is equivalent |
| **Can NEX support 50k free users without accumulating NEX-controlled private storage?** | **NO · not until Phase 2 Rev 2 is implemented + Phase 5 audit signs off** |

---

## 8 · What this audit does + does NOT do

### Does
- Report findings from read-only inspection of the repository + Supabase + Realtime + cron + logs + browser-side storage + WebRTC/TURN scope
- Enumerate every surface that currently stores private content
- Project storage growth for 50k free users on current architecture
- Define the compliance criteria + verification evidence required
- Honestly state: current architecture is NOT compliant; Phase 2 is required

### Does NOT
- Change any code
- Apply any migration
- Delete any data
- Modify any production state
- Approve any deployment or launch
- Permit public use of the launch-principle statement
- Replace the independent privacy audit required by I-6

---

**End of 50k-user device-only storage verification audit.**

NEX today cannot support 50,000 free users without accumulating NEX-controlled storage of private chat content. The sealed Phase 2 architecture is required before this claim can be honestly made. Phase 2 remains a 12-16-week engineering programme gated on D-1..D-6 owner decisions + legal review + TURN provider selection.
