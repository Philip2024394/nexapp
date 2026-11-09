# NEX · 100,000-User Capacity · Device-Only Free Personal + Paid Business Storage Doctrine
### 2026-11-09 · Read-only audit + implementation plan

**Author:** Claude Opus 4.7 · operating under owner-authorised autonomous read-only audit + planning scope.
**Scope:** Verify whether NEX can support 100,000 free personal accounts without accumulating NEX-controlled private-content storage · model the paid-business-storage architecture · model public video storage + delivery · model monthly cost at 100k scale · surface violations · produce ordered implementation plan.
**Constraints:** NO production changes · NO code changes · NO migrations applied · NO deployments · NO historical deletion · NO billing-config changes. Read-only audit.
**Related sealed doctrines:**
- `project_nex_chat_device_only_e2e_sealed_2026_11_09.md` (device-only directive · 8 rules)
- `docs/doctrine/nex-chat-device-only-remediation-plan-2026-11-09.md` (Rev 2 · 6 invariants I-1..I-6 · 4 sealed decisions)
- `docs/doctrine/nex-chat-historical-data-inventory-2026-11-09.md` (prod state 2026-11-09)
- `docs/doctrine/device-only-50k-user-storage-verification-2026-11-09.md` (prior 50k audit)
- `docs/doctrine/phase-1-completion-report-2026-11-09.md` (G2 + G3 + mig 313 live on prod)
- `project_nex_scope_reduction_sealed_2026_11_06.md` (launch surface)

**Headline verdict:** NEX today cannot support 100,000 free personal users without accumulating NEX-controlled storage of private chat content. The sealed Phase 2 architecture must be implemented first. The paid-business-storage architecture is partially designed (mig 308 authored + R33 pack checkout live) but NOT YET APPLIED to any environment. The public video architecture is partially designed (mig 223 + mig 241 music-media bucket live) but incomplete (no CDN · no transcoding · no bandwidth delivery infrastructure).

---

## 1 · CURRENT ARCHITECTURE

### 1.1 What actually happens today when a user sends a private message

| Step | Action | NEX-controlled storage touched? |
|---|---|---|
| 1 | User taps send in `/chat/peer/[accountId]` | None (client-side) |
| 2 | Server action → `peer-message-service.sendPeerMessage()` (plaintext path) OR `crypto/encrypted-send.ts` → `/api/.../peer-message/encrypted` (ciphertext fan-out) | Server-side code runs |
| 3 | `sendPeerMessage()` writes to `nex_peer_message`: body (plaintext if encrypted=false) or `ciphertext` + `nonce` + metadata (if encrypted=true) | **YES · Supabase DB row written** |
| 4 | If attachment, `uploadPeerAttachment()` uploads to `nex-peer-chat-attachments` public bucket | **YES · Supabase Storage object written** |
| 5 | `touchPeerConversation()` updates `nex_peer_conversation.last_message_at` metadata | YES but metadata-only |
| 6 | SafeChat Phase 1 non-blocking hook logs (plaintext path only · Bridge 76 encrypted path explicitly skipped) | NEX-controlled table write |
| 7 | Realtime arrival nudge via `nex:peer:{conversationId}` channel | None (ephemeral pub-sub) |
| 8 | Push notification dispatch to recipient device | None (push payload is content-free per sealed rule but current code includes a localised preview string "sent you a photo" etc. · this is a residual leak per Rev 2 §4.8) |

### 1.2 What actually happens when a user uploads a chat attachment

- Client encodes the file (bytes)
- Plaintext path (`uploadPeerAttachment`): writes directly to `nex-peer-chat-attachments` public bucket (25 MB cap)
- Ciphertext path (`encrypted-attachment-upload.ts`): encrypts client-side then POSTs to `/api/.../attachment/encrypted` which writes to the `nex-peer-chat-ciphertext` private bucket (fail-closes with 503 if bucket not provisioned per Rev 2 verified evidence)
- Public URL or private signed URL returned → stored in `attachment_url` column of the message row

### 1.3 Buckets currently provisioned on production (per 2026-11-09 inventory + migration inspection)

| Bucket | Mig | Public? | Current use | Chat-content risk? |
|---|---:|---|---|---|
| `nex-peer-chat-attachments` | 055 | **true** | 26 objects on prod (17 enc/ chat-ciphertext + 9 business-logo) | **YES · live chat upload target** |
| `nex-peer-chat-ciphertext` | 295 draft | — | **Not provisioned** (sealed as obsolete under Interp 1) | Would be if provisioned · DO NOT provision |
| `nex-chat-theme-hero` | 049 | public | Theme catalogue | No |
| `nex_business_qr_code` | 110 | — | Business QR images | No · public business asset |
| `nex-gallery-image` | 111 | — | Gallery | No · business asset |
| `nex-theme-emoji` | 116 | public | Theme emoji | No |
| `nex-theme-sticker` | 118 | public | Theme stickers | No |
| `nex-vault-files` | 129 | private | Vault files | Vault-only · 0 chat refs on prod per inventory |
| `nex-community-photo` | 151 | varies | Community notices | No |
| `nex-user-intros` | 210 | — | Profile intro videos | No · public |
| `nex-live-uploaded` | 223 draft | — | **Not provisioned** · public video future | Future · not live |
| `nex-music-media` | 241 | public | Music tracks (`shared_live` publication) | No · public business content |

### 1.4 NEX-controlled database tables that could carry private content

Per prior inventory + Rev 2 Phase 2 Master Build Spec:

| Table | Mig | Private-content-carrying column(s) | Prod state |
|---|---:|---|---|
| `nex_peer_message` | 047 | `body`, `ciphertext`, `nonce`, `sender_public_key`, `sender_device_id`, `recipient_device_id`, `message_group_id`, `attachment_url`, `attachment_type`, `attachment_meta`, `link_url`+4 link_* columns, `edit_history` (mig 279) | **ACTIVE · 47 rows on production · 40 plaintext bodies + 7 ciphertext** |
| `nex_message` | business chat | `body` (plaintext · NO E2E path) | **ACTIVE · 891 rows on production · all plaintext** |
| `nex_peer_message.attachment_meta` (JSONB) | 059/067/077/088/119/125/259 | Commerce snapshots (price · phone · shipping address) for product/menu_item/cart_order/product_share | **ACTIVE · 1 row on production · 364 bytes of plaintext product snapshot** |
| `nex_hq_direct_channel` | 301 | Tracker (metadata only) | OK for metadata · but RPC `nex_hq_direct_send` writes body to `nex_peer_message` (see above) |
| `nex_vault_conversation_envelope` | 143 | Encrypted key envelope only (not message content) | 3 rows on prod · compliant posture |
| `nex_vault_file` | 141 | File metadata + bucket paths | **0 rows on prod** · Vault has never back-doored chat |

### 1.5 Business storage metering (NOT YET APPLIED)

Mig 308 adds the following to `nex_business` (owner-authorised 2026-11-08 round 29 · **not applied to any environment**):

- `storage_bytes_used bigint NOT NULL DEFAULT 0` · running total of stored business bytes
- `bandwidth_bytes_month bigint NOT NULL DEFAULT 0` · egress this month
- `storage_pack_bytes bigint NOT NULL DEFAULT 0` · additional from active packs
- `bandwidth_pack_bytes bigint NOT NULL DEFAULT 0` · additional from active bandwidth packs
- `bandwidth_period_start timestamptz` · rolling window
- SECURITY DEFINER RPCs: `nex_shop_increment_storage_bytes`, `nex_shop_increment_bandwidth_bytes`

This is the infrastructure the paid-business-storage model would use · it exists on disk but is NOT APPLIED. No business is currently metered.

### 1.6 Paid pack subscriptions (R33 checkout endpoints live)

| Endpoint | State |
|---|---|
| `/api/nex-native/billing/checkout/pack` (storage pack recurring subscription) | Code live on origin · deployed · test-mode Stripe |
| `/api/nex-native/billing/checkout/theme` (chat theme one-time) | Code live on origin |
| `/api/nex-native/billing/checkout/buyer` (buyer→seller destination charge · G4 fix sandbox-ready) | F-3 pending prod deploy |

Current storage pack pricing (per `regional-pricing.ts` lines 148-183):

| Pack | Ireland EUR | UK GBP | US USD | Indonesia IDR |
|---|---:|---:|---:|---|
| +5 GB storage | 1.80/mo | 1.50/mo | 2.00/mo | deferred |
| +10 GB storage | 3.59/mo | 3.00/mo | 4.00/mo | deferred |
| +25 GB storage | 8.97/mo | 7.49/mo | 10.00/mo | deferred |

Bandwidth packs similarly sealed (+30/100/300 GB tiers).

### 1.7 Public video state

- `nex_music_media` bucket live (mig 241 · music tracks published via `nex_music_track.visibility='shared_live'`)
- `nex_uploaded_video` table + `nex-live-uploaded` bucket: **NOT YET APPLIED** (mig 223 draft)
- No CDN edge config observed · all media served direct from Supabase Storage
- No transcoding service observed · uploads are byte-identical
- No bandwidth-scaled plan · pricing exists (`BANDWIDTH_PACKS` in regional-pricing.ts) but not metered

---

## 2 · FREE PERSONAL ACCOUNTS · Is private data genuinely device-only today?

**No · not today. Phase 2 required.**

### 2.1 Direct failures of the 10 device-only requirements

| Requirement | Compliance today | Evidence |
|---|---|---|
| Private chat history on user's device | ❌ | 40 plaintext peer rows + 891 plaintext business rows on prod `nex_peer_message` + `nex_message` |
| Private messages E2E encrypted | **Partial** · Bridge 76/81 crypto exists but plaintext fallback live when no device keys registered | `encrypted-send.ts:66-79` fallback paths to `sendPeerMessage` plaintext |
| Private attachments on user's device | ❌ | Chat attachments upload to `nex-peer-chat-attachments` public bucket OR private ciphertext bucket (both NEX-controlled) |
| Encryption keys under user device control | **Partial** · `device-key.ts` stores in IndexedDB BUT ciphertext is persisted server-side (incompatible with sealed Interp-1 doctrine) |
| No server-side body/ciphertext | ❌ | Both columns active on prod |
| No chat attachments in Supabase | ❌ | 17 `enc/` objects on prod public bucket |
| No offline queue / stash / store-and-forward | ❌ | Persisted DB rows ARE the de facto offline-delivery mechanism |
| No conversation backups or history sync | ❌ | `/api/.../peer-message/since` reads server-persisted content |
| No message content in logs/analytics/push | **Partial** · logs are clean (`error.message` only), analytics audited clean, BUT push dispatch includes localised preview string (`sent you a photo`) · Rev 2 §4.8 flagged this |
| Offline recipient fails honestly | ❌ | Currently succeeds (writes row) |

### 2.2 Minimum guaranteed NEX storage growth per new free personal account on current architecture

Every signup triggers:
- 1 row in `nex_account` (metadata only · essential · unavoidable)
- 1 row in `nex_peer_message` for NEX Official welcome (plaintext body · `welcome-delivery.ts:100`)
- Potentially 1 row in `nex_peer_conversation` (metadata only · essential · unavoidable)

So at 100,000 free personal accounts just from signup: **at least 100,000 plaintext-body rows on `nex_peer_message`.**

After signup · each active user writes rows for every message sent.

### 2.3 Browser-side storage used today (positive findings)

Grep for `IndexedDB` / `idb` / `localStorage` surfaces 10 files currently using browser-side persistence:
- `chat/_portrait-bloom-shell.tsx` (UI state)
- `chat/peer/[accountId]/page.tsx` + `_composer.tsx`
- `manage/shop/backgrounds/_client.tsx`
- `cart/_client.tsx` (cart drafts)
- Others for UI state

**Browser storage IS used for UI state + cart drafts today but is NOT YET the authoritative message store.** Under Phase 2 Interp-1 target it becomes the exclusive message store.

### 2.4 Device loss / browser-data-cleared consequences under Phase 2 target

Must be documented honestly per sealed rule #8:

| Event | Consequence |
|---|---|
| User clears browser data | All local messages lost · no server recovery |
| User reinstalls on same device | Same |
| User gets new phone | New device → new device key → old messages inaccessible unless user explicitly backed up (user-controlled · not NEX-controlled) |
| User logs out + logs in on same device | Depends on local-store retention policy · design choice |
| Device key loss | User must re-enrol a new device key · new outgoing messages work · old inbound ciphertext (if any post-cutover) unreadable |

---

## 3 · PAID BUSINESS STORAGE · How business-owned assets are stored and charged

### 3.1 Current state

- **Infrastructure authored · not applied:** Mig 308 (business storage + bandwidth metering columns + SECURITY DEFINER RPCs) sits on disk for every environment · NOT APPLIED
- **Checkout path live:** `/api/.../billing/checkout/pack` creates recurring Stripe Checkout Sessions for storage packs · R33 commit `6617a793`
- **UI wiring:** `_pack-upgrade-button.tsx` wires the Upgrade button to the pack endpoint · R33b commit
- **Entitlement reader:** `shop-entitlements.ts` reads `nex_business.storage_bytes_used` + `storage_pack_bytes` (which don't yet exist in schema)
- **Metering service:** `metering-service.ts` references the RPCs that mig 308 would create

### 3.2 Business-owned asset categories

| Category | Current bucket | Current enforcement |
|---|---|---|
| Business logo | `nex-peer-chat-attachments` (public · mixed with chat · to migrate to `nex-business-public-assets` per Rev 2 decision #1) | None server-side |
| Business QR code | `nex_business_qr_code` (mig 110) | RLS/grants not inspected in this audit |
| Venue photos | `nex-peer-chat-attachments` (public) | Mixed tenancy today |
| Product images | `nex-gallery-image` (mig 111) | Per-business grants |
| Published music | `nex-music-media` (mig 241 live) | Public bucket · creator rate-limit |
| Uploaded videos | `nex-live-uploaded` (mig 223 NOT APPLIED) | Not live yet |
| Chat Theme assets | Dedicated theme buckets · NEX-published | Catalog · not user content |

### 3.3 Current cost-attribution gaps

No business is currently paying for the storage they use. Business logos + venue photos + product images + music tracks all consume Supabase storage on NEX's bill without any `storage_bytes_used` counter being incremented (because mig 308 isn't applied). Pack subscriptions can be purchased (Stripe sessions work) but no `storage_pack_bytes` is counted against usage.

**At 100,000 free users of which (say) 5% open shops = 5,000 businesses:**
- No metering → no overage enforcement → unbounded usage per business
- Low-usage businesses: ~100 MB avg (logo + a handful of product images) = 500 GB total
- Active businesses: might hit 1-5 GB each × 1,000 businesses = 1-5 TB
- Music-publishing businesses: 10-50 MB per track × dozens of tracks = larger

Currently this all sits on NEX's Supabase bill with no revenue attribution.

### 3.4 Public business asset isolation (per business)

- `nex_business.id` is the owner key
- Current buckets have mixed-tenancy problems (venue photos + chat attachments in same bucket)
- Rev 2 sealed decision #1: migrate business assets to `nex-business-public-assets` (planned · not provisioned)
- RLS on `nex_business` table ensures per-business ownership
- Storage object naming convention uses `business-logo/{businessId}/...` prefix pattern

### 3.5 Billing lifecycle for a paid pack

Design (per existing sealed entitlement rule in `billing/entitlement.ts`):

| State | Behaviour |
|---|---|
| `active` | Storage limit = base shop tier + sum of active packs |
| `past_due` | 7-day grace · access continues |
| `grace` (owner-defined) | Read-only mode (future design) |
| `cancelled` | Current period keeps access · ends at period boundary |
| `expired` | Downgrade to free-tier limit · overage policy applies |
| `incomplete` | Access denied until payment confirmed |

**Overage behaviour is NOT YET DEFINED.** Existing code reads limits but has no clear response when `storage_bytes_used > storage_limit`. Options:
- (a) Soft overage · continue accepting uploads · bill overages at end of month
- (b) Hard overage · block new uploads · existing content remains accessible
- (c) Grace period · 14-day warning before block

Owner decision required · not sealed.

### 3.6 Free personal account using business storage as workaround

Risk: free personal user creates a business just to get storage.

Current defences:
- Business creation requires the 7-step shop setup flow + business device-key registration
- Shop tier is tied to paid subscription (shop_tier CHECK)
- `uploadPeerAttachment` (chat path) writes to the chat bucket · not the business asset bucket · doesn't hit business metering

Residual risk:
- A user could sign up a shell business · get the free Shop tier starter · upload product images to `nex-gallery-image` as business content
- Mitigations: Shop tier starter is paid (sealed Scope Reduction 2026-11-06 · €4.99/mo for Shop)
- Free-tier storage allowance (if any) · needs owner definition

---

## 4 · PRIVATE BUSINESS CHAT · Proof that business subscriptions do not override chat privacy

### 4.1 The rule

Business subscription grants: paid storage for business-owned published content.

Business subscription does NOT grant: server-side storage of private business conversations.

Per sealed Rev 2 decision #5 and invariant I-3: "No plaintext exception for business chat."

### 4.2 Current violation state

Today, **business chat is 100% plaintext server-stored** via `nex_message.body` (891 rows on prod). This is the biggest device-only violation by row count on the entire platform. It is independent of whether the business has paid for storage · plaintext is written regardless.

Phase 2 Rev 2 §4.2 defines the fix: full E2E from scratch for business chat · no plaintext exception. Business accounts register device keys (shop owner + optional staff) · customer→business messages deliver via WebRTC data channel · no server body.

### 4.3 Required separation (future)

| Category | Where it lives |
|---|---|
| Business-published public content (logos, products, menus, catalogues, videos) | Supabase Storage · `nex-business-public-assets` + `nex-music-media` + `nex-live-uploaded` · counted against paid storage pack |
| Business chat message body | **DEVICE ONLY** · never NEX-persisted · regardless of paid storage |
| Business chat attachments | **DEVICE ONLY** · chunked via WebRTC data channel · never NEX-persisted |
| Business metadata (opening hours · address · phone · prices) | `nex_business` + `nex_product` + `nex_menu_item` tables · public business info |
| Business orders (Path A) | `nex_order` + `nex_order_item` (server-stored · but orders are commercial records not chat · Rev 2 §4.7 sealed Path A) |

Rev 2 §21.2 defines the business-chat per-surface launch gate: content writes eliminated · business multi-device live · delivery honest · no Assistant plaintext path · historical swept · independent sign-off.

### 4.4 Vault must not be a back door

Rev 2 decision #6 sealed. `nex_vault_file` has 0 rows on production (verified 2026-11-09 inventory). No vault path currently preserves chat body or attachment server-side. Phase 2 preserves this · Vault retirement of chat-preservation surface is tracked as N7.

---

## 5 · PUBLIC VIDEO · Storage and delivery architecture

### 5.1 Current state

| Component | State | Compliance posture |
|---|---|---|
| Music tracks | Mig 241 applied · `nex-music-media` bucket live · public URLs | Public business content · compliant |
| Uploaded videos | Mig 223 **NOT APPLIED** · `nex_uploaded_video` table absent · `nex-live-uploaded` bucket not provisioned | Infrastructure authored · not live |
| Live broadcast real-time | WebRTC + Supabase Realtime (ephemeral) · `broadcast-engine.ts` · scoped to active sessions | Real-time only · no persistence (compatible with device-only private requirement) |
| CDN edge | **NOT configured** · Supabase Storage serves direct · no Cloudflare/Fastly edge | High egress cost potential |
| Transcoding | **No transcoding service observed** · uploads are byte-identical · browser-side compression only (`encrypted-attachment-upload.ts` R14 Stage 6 image compression at max 1600px) | No multi-bitrate video · no HLS |
| Bandwidth metering | `bandwidth_bytes_month` column in mig 308 (**not applied**) · `BANDWIDTH_PACKS` pricing sealed but not enforced | Future |

### 5.2 Public video delivery requirements (per owner's §4)

| Requirement | Design |
|---|---|
| Video storage | `nex-live-uploaded` bucket (mig 223) · per-business prefix · counted against `storage_pack_bytes` |
| Bandwidth + streaming | Not designed · HLS adaptive bitrate + CDN edge required for sane bandwidth cost |
| Transcoding | Not designed · likely external service (Mux · Cloudflare Stream · AWS MediaConvert) |
| CDN | Not designed · likely Cloudflare or Fastly with Supabase origin |
| Retention + deletion | Soft-delete only per mig 223 · hard-delete requires service-role · 30/90-day owner-set retention policy TBD |
| Quotas + overage | Mig 308 columns · not applied · overage policy TBD (§3.5 above) |

### 5.3 Separation from private video calls

Rev 2 §4.1 + §4.5 seal: video **calls** happen via WebRTC between devices (real-time · no persistence). Video **attachments** in private chat travel via WebRTC data channel (also no persistence). **Only public business-published videos are persistent NEX storage** · and only under a paid plan.

The code structure respects this today:
- Voice/video call signalling uses `realtime/signalling.ts` (ephemeral Realtime channels)
- `broadcast-engine.ts` uses Realtime for live-stream coordination (no persistence of stream bytes)
- `encrypted-attachment-upload.ts` was designed for Rev-2-superseded persistent ciphertext storage · now subject to Phase 2 retirement

### 5.4 Public video launch cost (estimate)

If 5% of 5,000 businesses publish videos (250 video-publishing businesses), each uploading 10 videos/month at 50 MB = 125 GB storage/mo per business cohort = **1.5 TB cumulative at year end**.

Bandwidth: if each video gets 100 views/month at 10 MB served (compressed) = 1 GB bandwidth per video × 250 businesses × 10 videos = 2.5 TB bandwidth/month.

Supabase Storage egress at ~$0.09/GB = **$225/month in bandwidth** before CDN · CDN would cut this to ~$50-100/month.

Storage at ~$0.021/GB-month = **$30/month in storage** growing linearly.

These are chargeable to the paid business plans via bandwidth packs.

---

## 6 · 100,000-USER CAPACITY · Expected infrastructure requirements

### 6.1 Account/auth scale

- `nex_account` rows: 100,000 (each ~500 bytes) = **50 MB**
- `nex_device_key` rows: 1-3 per user = 100k-300k rows · each ~300 bytes = **30-90 MB**
- Supabase Auth user rows: 100,000 · managed by Supabase
- WebAuthn credential rows: 0-N per user

**Total account scale: ~200 MB of essential metadata.** This is NEX-controlled but tiny.

### 6.2 Current architecture (NON-COMPLIANT · would scale badly)

At 100,000 free users on the CURRENT architecture:

| Surface | Growth per 100k users (est.) | Monthly storage cost (Supabase pricing) |
|---|---|---:|
| `nex_peer_message` welcome rows + active chat | 100k minimum + 10 msg/active-user/day × avg 300 bytes × 30% active × 30 days = **27 GB after 1 month** | $0.57/mo (negligible) |
| `nex_peer_message` growth over 1 year of active chat | ~300 GB/year | $6/mo at steady state · but PRIVACY VIOLATION |
| `nex_message` business chat | Lower volume · maybe 50 GB/yr | $1/mo · but PRIVACY VIOLATION |
| `nex-peer-chat-attachments` bucket (chat media) | 30% active users × 5 attachments/month × 2 MB avg = 300 GB/mo | $6.30/mo growth · PRIVACY VIOLATION |
| **Problem is NOT cost · problem is PRIVACY VIOLATION** · the sealed launch principle is unpublishable in this state | | |

### 6.3 Target architecture (Phase 2 Rev 2 compliant)

At 100,000 free users on the TARGET architecture:

| Surface | Growth per 100k users | Monthly cost |
|---|---|---:|
| `nex_account` + `nex_device_key` + auth | ~200 MB total · flat with user count | $0.01/mo |
| `nex_peer_conversation` + `nex_conversation` metadata | ~1-5 MB · metadata only · not content | <$0.01/mo |
| `nex_signaling_envelope` (ephemeral TTL 60-120s) | Transient rows · cron-pruned · steady ~100 KB on average | <$0.01/mo |
| `nex_device_presence` heartbeat state | 100k rows · bounded | ~1 MB · <$0.01/mo |
| Vault files (user-elected · paid) | Only if user purchases Vault | Charged to user's subscription |
| **Total per-user NEX storage cost at 100k users: pennies per month per 1,000 users** | | |

### 6.4 TURN relay capacity at 100k scale

Assumption: 30% daily active users send messages, each session averages 3 active conversations, 20% of connections need TURN fallback (NAT-blocked). Peak concurrent WebRTC: ~1,000 active connections.

| Provider | Capacity | Monthly cost (estimate) |
|---|---|---:|
| Self-hosted coturn | 1 server (4 vCPU · 8 GB RAM · 1 Gbps) handles ~500 concurrent | $50-100/mo per server · 2 servers for redundancy = $100-200/mo |
| Cloudflare TURN (managed) | $0.05/GB egress + presence fee | ~$30-150/mo at 100k users · scales linearly |
| Twilio Network Traversal Service | $0.40/GB · expensive at scale | ~$500-1,000/mo at 100k users |
| Metered.ca | $0.25/GB · mid-tier | ~$100-400/mo at 100k users |

**Owner-side D-5 decision required** before selecting.

### 6.5 Signalling + presence + realtime capacity

Supabase Realtime pricing (Pro tier currently used):
- 500 concurrent connections included in Pro
- Each additional 1,000 concurrent = $10/mo
- 100k free users at 30% daily active (30k) × 20% simultaneously online (6k) = **6,000 concurrent subscriptions**

**Estimated Supabase Realtime cost at 100k users: ~$60-80/mo.**

Plus `nex_signaling_envelope` DB writes (ephemeral · cron-pruned) add minor Supabase DB cost.

### 6.6 Push notification capacity

Content-free push notifications at scale:
- Firebase Cloud Messaging: free tier generous
- Apple Push Notification Service: free
- Web Push (VAPID): free
- NEX-side push dispatch service: minor Vercel invocation cost

**Push cost at 100k users: ~$0-10/mo.**

### 6.7 Vercel serverless capacity

NEX runs on Vercel · invocations + bandwidth billed per use:
- 100k users × 30% DAU × 50 requests/day = 1.5M invocations/day = 45M/month
- Vercel Pro: 1M included · additional at $0.65 per million = ~$30/mo invocation cost
- Bandwidth: ~100 GB/month · included in Pro tier

**Estimated Vercel cost at 100k free users: $50-150/mo total.**

### 6.8 Capacity summary

**At 100,000 free personal users on the Phase 2 Rev 2 compliant architecture:**

| Component | Monthly NEX cost |
|---|---:|
| Supabase storage (metadata only · <1 GB) | <$0.10 |
| Supabase DB CPU/memory (Pro tier) | $25/mo base |
| Supabase Realtime (6k concurrent subscriptions) | $60-80 |
| Supabase Auth (100k users · Pro tier) | included |
| Vercel (invocations + bandwidth) | $50-150 |
| TURN relay (provider TBD · 20% fallback share) | $100-400 |
| Push notifications | $0-10 |
| CDN (if video enabled) | $50-100 |
| Monitoring / observability | $30-50 |
| **Total per-month estimate at 100k free users** | **$300-800/month** |

**Per-user cost at 100k free users: $0.003-0.008 per user per month.**

This is sustainable at scale with ZERO revenue from free users · because it does NOT grow with chat activity (device-only chat ≠ server storage).

---

## 7 · MONTHLY COST MODEL · Low / medium / high scenarios

### 7.1 Scenarios (each at 100k registered users baseline)

| Scenario | Daily active % | Avg messages/active user/day | Business-publishing share | Video-publishing share |
|---|---:|---:|---:|---:|
| **LOW** · early adoption | 10% | 5 | 3% | 0.5% |
| **MEDIUM** · growing community | 30% | 20 | 5% | 2% |
| **HIGH** · mature engagement | 50% | 50 | 10% | 5% |

### 7.2 Free-tier infrastructure cost (Phase 2 target architecture · device-only)

| Scenario | Per-user NEX cost | Total NEX cost per month |
|---|---:|---:|
| LOW | ~$0.003 | ~$300 |
| MEDIUM | ~$0.005 | ~$500 |
| HIGH | ~$0.008 | ~$800 |

**Cost scales with ACTIVITY (CPU/bandwidth) · not with STORAGE** · which is the critical property for the business model.

### 7.3 Paid business cost + revenue

| Scenario | Paid businesses | Avg monthly revenue/business | Total gross revenue | NEX cost | Net |
|---|---:|---:|---:|---:|---:|
| LOW · 3,000 paid shops × €4.99/mo | 3,000 | €4.99 | €14,970 | ~$500 free infra + ~$500 business storage/bandwidth | **~€14,000 gross margin** |
| MEDIUM · 5,000 paid shops + 2,000 upgrade packs | 5,000+2,000 | €4.99+€3.59 avg | €32,130 | ~$1,000 free + ~$2,000 business infra | **~€29,000** |
| HIGH · 10,000 paid shops + 4,000 packs + 1,000 bandwidth packs | 10,000+5,000 | €4.99+€4+€6 | €89,900 | ~$2,000 free + ~$8,000 business infra | **~€80,000** |

(Rough back-of-envelope. Precise modelling requires owner-provided business-side assumptions.)

### 7.4 Main cost drivers

1. **TURN relay traffic** · scales with concurrent voice/video calls · can dominate at high scale → D-5 provider choice is a material financial decision
2. **Vercel invocations** · scales with user activity · optimisable via edge caching
3. **Public video bandwidth** (if offered) · dominates when video adoption is high · requires CDN

### 7.5 What costs ZERO at scale (under Phase 2 target)

- Private message storage · **Zero** · messages never persist
- Private attachment storage · **Zero** · never land on Supabase
- Private chat history sync · **Zero** · no sync surface exists
- Message search · **Zero** · search is device-local

This is the structural reason the model is sustainable.

---

## 8 · NON-COMPLIANT FEATURES · existing violations

Consolidating from prior audits + this inspection:

### 8.1 Critical violations (would scale badly + break launch principle)

| # | Feature | Violation |
|---|---|---|
| V-1 | `sendPeerMessage()` writes plaintext body | Phase 2 F-1 · rule #4 |
| V-2 | `sendEncryptedPeerMessages()` writes ciphertext to DB | Phase 2 F-1 · rule #4 |
| V-3 | `conversationService.postMessage()` writes plaintext body to `nex_message` | Phase 2 F-2 · rule #4 |
| V-4 | `uploadPeerAttachment()` writes to public bucket | Phase 2 F-1 · rule #5 |
| V-5 | `/api/.../attachment/encrypted` writes ciphertext to bucket | Phase 2 F-1 · rule #5 (even private bucket is forbidden) |
| V-6 | NEX Official welcome persists via `sendPeerMessage` | Phase 2 F-3 · rule #4 |
| V-7 | HQ Direct Channel `nex_hq_direct_send` writes plaintext | Phase 2 F-4 · rule #4 |
| V-8 | `attachment_meta` carries commerce snapshots (cart address, product price, grant pct) | Phase 2 F-5 · rule #5 metadata snapshot |
| V-9 | `/api/.../peer-message/since` reads persisted content (presumes it exists) | Rule #7 corollary |
| V-10 | Push dispatch includes localised preview string | Rule #7 |
| V-11 | `encrypted-send.ts` falls back to plaintext path when no device keys | Rule #4 |
| V-12 | `nex-peer-chat-attachments` bucket is public | Rule #5 |
| V-13 | Business chat has no E2E path | I-3 |

### 8.2 Pre-existing architectural gaps

| # | Feature | Status |
|---|---|---|
| V-14 | Mig 308 business storage metering not applied anywhere | No business metering → no usage enforcement |
| V-15 | Mig 223 `nex_uploaded_video` table + bucket not applied | No public video surface live yet |
| V-16 | `nex-business-public-assets` bucket not provisioned (Rev 2 decision #1) | Business logos share public bucket with chat today |
| V-17 | No CDN · Supabase Storage direct egress | High bandwidth cost at video scale |
| V-18 | No transcoding service · video uploaded byte-identical | No multi-bitrate · high storage + bandwidth for same user experience |
| V-19 | No bandwidth metering enforced (schema exists per mig 308 draft · code exists per metering-service.ts · not yet applied) | Business plans can't police bandwidth |

### 8.3 Positive findings (already compliant)

- Signalling: Supabase Realtime pub-sub · ephemeral · zero content persistence
- Server logs: audited clean · no body/ciphertext content
- Vault: 0 chat-attachment references on production · never back-doored
- Browser IndexedDB: used for UI state (future authoritative store)
- Rate-limit infrastructure: mig 290 + mig 313 live on production (G3 complete)
- Billing-RLS lockdown: mig 312 live on production (G2 complete)
- No cron writes chat content (3 Vercel crons · all clean)
- No analytics/error path leaks content

---

## 9 · IMPLEMENTATION PLAN · ordered work, dependencies, approvals

### 9.1 Overall sequencing

Builds on existing Phases 1-6 + adds business-storage + public-video workstreams.

```
PHASE 1  · Production security + billing [G2 ✓ · G3 ✓ · G4 pending]
PHASE 2  · Device-only chat architecture [blocked on D-1..D-6 + legal + TURN]
     ├── 2a. WebRTC signalling + presence + TURN
     ├── 2b. Local-device message store
     ├── 2c. Business multi-device + business chat E2E
     ├── 2d. NEX Official + HQ identity under device-only
     ├── 2e. Attachment transport via data channel
     ├── 2f. Historical sweep (S0-S6 · owner-authorised per phase)
     ├── 2g. Vault chat-preservation retirement
     └── 2h. Push notification content-strip

PHASE 7 · Paid business storage (new · parallel-enables with Phase 2)
     ├── 7a. Apply mig 308 to sandbox (storage/bandwidth metering columns)
     ├── 7b. Audit metering-service wiring against mig 308 schema
     ├── 7c. Provision `nex-business-public-assets` bucket (sealed Rev 2 #1)
     ├── 7d. Migrate 9 business-logo objects from chat bucket to new bucket
     ├── 7e. Rewrite business-logo + venue-photo upload paths
     ├── 7f. Wire pack purchase → `storage_pack_bytes` increment via Stripe webhook
     ├── 7g. Overage policy: owner decision (soft/hard/grace)
     ├── 7h. Usage dashboard in `/manage` surface
     ├── 7i. V-B tests · per-business isolation · overage enforcement
     └── 7j. Apply mig 308 to production (owner-gated G5)

PHASE 8 · Public video (new · parallel-enables with Phase 7)
     ├── 8a. Apply mig 223 (nex_uploaded_video) to sandbox
     ├── 8b. Provision `nex-live-uploaded` bucket
     ├── 8c. CDN provider decision + contract
     ├── 8d. Transcoding provider decision (Mux/Cloudflare Stream/self-hosted ffmpeg)
     ├── 8e. HLS/DASH multi-bitrate pipeline
     ├── 8f. Bandwidth metering (`bandwidth_bytes_month` from mig 308)
     ├── 8g. Pack purchase → `bandwidth_pack_bytes` increment
     ├── 8h. Retention policy: owner decision
     ├── 8i. V-V tests · playback · bandwidth metering · retention
     └── 8j. Apply mig 223 to production (owner-gated)

PHASE 3  · Playwright journeys [blocked on Phase 2 verified]
PHASE 4  · Performance + mobile + load [blocked on Phase 2 + 3 verified]
PHASE 5  · Independent privacy audit [blocked on Phase 2 verified + S5 sweep]
PHASE 6  · Launch approval gate [blocked on Phases 1-5 + 7 + 8 complete]
```

### 9.2 Effort estimate (incremental over prior plan)

| Phase | Effort |
|---|---|
| Phase 2 · device-only chat | 12-16 weeks (per Rev 2 §10) |
| Phase 7 · paid business storage · mig 308 apply + wiring + overage policy + UI | ~3 weeks |
| Phase 8 · public video · CDN + transcoding + HLS + retention + metering | ~6-8 weeks |
| Phases 3-6 · (unchanged from prior plan · depend on Phase 2) | 10-12 weeks aggregate |

**Total programme: 20-30 weeks** depending on parallelism.

### 9.3 Owner decisions required

In addition to the sealed Rev 2 D-1..D-6 + L-1..L-6:

- **D-7** · Storage overage policy · soft/hard/grace
- **D-8** · Bandwidth overage policy · soft/hard/grace
- **D-9** · CDN provider (Cloudflare / Fastly / Bunny · owner-selected)
- **D-10** · Video transcoding provider (Mux / Cloudflare Stream / self-hosted)
- **D-11** · Public video retention policy (indefinite · 90-day · 1-year since last view)
- **D-12** · Free-personal-account business-creation anti-abuse policy

---

## 10 · VERIFICATION EVIDENCE · tests + independent evidence

### 10.1 Private content never enters persistent NEX storage (device-only compliance)

Rev 2 §19 defines V-NET-1/V-NET-2/V-STORE-1/V-STORE-2/V-STORE-3/V-LOG-1/V-SIG-1/V-TURN-1/V-DELETION-1. All 9 must pass post-Phase 2 implementation.

Supplementary tests at 100k scale:

| Test | Method |
|---|---|
| V-100k-1 · Load-test sign-up 100k accounts · scan DB for private content | Automated script · insert accounts via Supabase Auth API · after test, SQL scan: `SELECT COUNT(*) FROM nex_peer_message WHERE body IS NOT NULL OR ciphertext IS NOT NULL` returns **0** |
| V-100k-2 · Simulate 30k daily-active chat · measure NEX storage delta | Load generator · 20 messages/user/day · 1-day run · measure `pg_database_size()` delta attributable to chat tables · expected delta **zero bytes of body/ciphertext** |
| V-100k-3 · Simulate 300 attachment sends/day · scan buckets | Bucket listing shows 0 new chat-prefix objects created during test |
| V-100k-4 · Signalling table TTL under load | Cron-prune active · zero expired rows · observed under sustained 6k concurrent WebRTC |
| V-100k-5 · Independent packet capture at TURN | Provider-side evidence of zero packet retention |

### 10.2 Business storage correctly isolated + paid

| Test | Method |
|---|---|
| V-B-1 · Business A cannot read Business B bucket objects | Service-role SELECT against `storage.objects` with `owner` filter · RLS test |
| V-B-2 · Business A cannot increment Business B's `storage_bytes_used` | SECURITY DEFINER RPC parameter validation (per mig 308 RPC `p_business_id` required) |
| V-B-3 · Storage cap enforced at upload | Upload above limit returns 413/422 · not silently stored |
| V-B-4 · Pack purchase increments `storage_pack_bytes` | Stripe webhook test with CLI `stripe trigger invoice.payment_succeeded` with metadata.nex_role='storage_pack' |
| V-B-5 · Expired subscription downgrades limit | Advance Stripe test clock · subscription status → `cancelled` · usage > new cap → overage behaviour per D-7 |
| V-B-6 · Free user cannot use business storage endpoint | Non-business account POST to business-asset upload returns 403 |

### 10.3 100k-user capacity + cost test plan

| Test | Method |
|---|---|
| V-C-1 · Signup 100k accounts over 24h | Load generator against staging · verify no DB table unexpectedly grows faster than linear |
| V-C-2 · 30k simultaneous WebRTC connections | k6 + headless browsers · TURN relay provider load test |
| V-C-3 · Supabase connection pool exhaustion | Measure max concurrent DB connections · verify Pool mode sufficient |
| V-C-4 · CDN cache hit rate for public business assets | Simulate 10k views/hour · measure origin requests vs cache hits |
| V-C-5 · Public video playback at 1,000 concurrent | HLS adaptive bitrate · bandwidth metering accurate · overage triggers correctly |
| V-C-6 · Cost realisation vs model | Compare actual Supabase/Vercel/TURN bills to §7.2 estimates after 1-month test run |

---

## 11 · BLOCKED ITEMS · owner approvals / legal reviews / provider decisions

### 11.1 Device-only chat path (Phase 2)

- D-1..D-6 architectural decisions (sealed as pending)
- L-1..L-6 legal review (pending advisor designation)
- D-5 TURN provider comparison + selection
- Historical sweep S0-S6 per-phase authorisation (I-4)
- Explicit "begin Phase 2 implementation" authorisation

### 11.2 Paid business storage (Phase 7)

- D-7 storage overage policy (soft / hard / grace)
- D-12 free-personal-account anti-abuse policy
- `apply mig 308 sandbox` authorisation
- `provision nex-business-public-assets bucket` authorisation
- `apply mig 308 production` authorisation (G5)

### 11.3 Public video (Phase 8)

- D-8 bandwidth overage policy
- D-9 CDN provider decision
- D-10 video transcoding provider decision
- D-11 public video retention policy
- `apply mig 223 sandbox` authorisation
- `provision nex-live-uploaded bucket` authorisation

### 11.4 Billing platform readiness (owner-side)

- 6 owner facts: legal entity · country · address · company number · VAT · support email
- Stripe platform approval for live-mode Connect
- STRIPE_WEBHOOK_SECRET production env configuration

### 11.5 Legal gates

- GDPR retention policy for free-personal device-only (minimal server-side data)
- Business storage GDPR obligations (data controller/processor roles)
- Public video content-rights declarations (per mig 223 doctrine · `owner_content` / `licensed` / `public_domain`)
- DMCA takedown procedure for public videos
- Minor-protection policies (if under-18 users allowed)
- DSR (data subject request) process documented

---

## 12 · LAUNCH STATUS

### 12.1 What is ready today

| Capability | Production state |
|---|---|
| Account + auth (signup · signin · WebAuthn) | Live · functional |
| Billing table RLS lockdown (G2) | Live · verified (mig 312 · 2026-11-09) |
| Distributed rate-limit (9 actions · G3 + G3 follow-up) | Live · verified (mig 290 + 313 · 2026-11-09) |
| Stripe test-mode checkout endpoints (Shop · pack · theme · buyer) | Live code · test-mode Stripe |
| Stripe Connect onboarding (R31) | Live code · test-mode |
| Shop setup flow · product management · directory | Live |
| Music publishing (`nex-music-media` bucket) | Live · public content · compliant |
| Realtime signalling for voice/video calls | Live · ephemeral · compliant |
| Vault key-envelope infrastructure | Live · 3 rows · no chat back-door |
| Loading + error boundary UX (R32) | Live · 19 segments |

### 12.2 What is NOT ready for launch

| Capability | Gap |
|---|---|
| Device-only private chat | Phase 2 required · 12-16 weeks · D-1..D-6 pending |
| Business chat E2E | Phase 2 required · no E2E path exists today |
| Paid business storage metering | Mig 308 not applied anywhere · no business metered today |
| Public video storage + delivery | Mig 223 not applied · no CDN · no transcoding |
| Historical plaintext/ciphertext secure-delete | Phase 2 §17 · S0-S6 owner-authorised sequence |
| Independent privacy audit | Phase 5 · requires Phase 2 verified + auditor selection + budget |
| Launch principle publication | Forbidden until State C (§16) across every surface · I-6 |
| Legal entity + 6 owner facts | Owner-side task |
| Stripe live-mode activation | Owner-side task |
| STRIPE_WEBHOOK_SECRET production config | Owner-side task |

### 12.3 Headline launch status

**NOT READY FOR PUBLIC LAUNCH AT 100,000 USERS.**

### 12.4 What a safe-to-launch state looks like

The sealed six-invariant · four-sealed-decision · ten-rule architecture (Rev 2) must be fully implemented, independently audited, and verified across every applicable surface. The paid-business-storage path must be metering-live and billing-attributed. Public video (if launched) must have CDN + transcoding + bandwidth metering + retention policy + content-rights enforcement.

Then and only then can NEX truthfully claim:

- *"NEX does not keep a copy of your private conversations. Your conversations belong to you and remain on your devices."*
- *"Businesses pay for the storage and delivery of the content they publish."*
- *"NEX never quietly moves private personal content onto its servers."*

### 12.5 The critical business insight

**At 100,000 free personal users on the Phase 2 target architecture, NEX infrastructure cost grows LINEARLY WITH ACTIVITY, not LINEARLY WITH USER-GENERATED CONTENT.** This is the structural advantage of the device-only model:

- Every message sent: zero NEX storage cost per message
- Every attachment shared: zero NEX storage cost per attachment
- Every chat history: zero NEX storage cost per user
- NEX cost per 100k free users: $300-800/month · scales with activity · bounded
- Revenue comes from: paid Shop subscriptions + storage packs + bandwidth packs + chat themes + buyer→seller 0%-fee transaction flow

**At 100,000 free personal users on the current architecture, NEX infrastructure cost grows LINEARLY WITH MESSAGE AND ATTACHMENT VOLUME** · unbounded · no per-user revenue model can offset it at scale. This is why Phase 2 is a commercial requirement · not an optional privacy feature.

---

## 13 · What this document does + does NOT do

### Does
- Report findings from read-only inspection of the full scope in the owner's mandate
- Separate free-personal · paid-business · private-business-chat · public-video architectures
- Model 100k-user capacity + cost under current and target architectures
- Surface 19 non-compliant features with evidence
- Produce ordered implementation plan covering Phases 1-8 (including new Phase 7 business storage + Phase 8 public video)
- List 12 owner decisions + 6 legal gates + 3 billing-platform-readiness items blocking launch

### Does NOT
- Change any code
- Apply any migration (308 · 223 · others)
- Provision any bucket (`nex-business-public-assets` · `nex-live-uploaded`)
- Delete any historical content
- Deploy anything
- Alter billing configuration
- Select a CDN · transcoding · or TURN provider
- Approve the launch principle for publication
- Replace the independent privacy audit required by I-6

---

**End of 100,000-user device-only + paid-business-storage audit + implementation plan.**

Phase 2 remains the direct path to free-personal device-only compliance at any scale. Phase 7 (paid business storage) + Phase 8 (public video) are the direct paths to the sustainable commercial model: free users don't cost NEX in storage · businesses pay for the storage and bandwidth they consume · private conversations stay private regardless of payment status.
