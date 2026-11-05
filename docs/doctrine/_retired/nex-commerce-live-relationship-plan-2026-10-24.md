# NEX Commerce + Live — Relationship Plan
## PROPOSED · IMPLEMENTATION NOT AUTHORISED

**Date:** 2026-10-24
**Owner directive:** record the strategic vision, verified architecture audit, Live surface requirements, phased plan, risk register and owner decisions as a durable document before any implementation begins.
**Status:** PROPOSED. Documentation is authorised; implementation is not. Approval to document the plan is not approval to build it.
**Scope boundary:** this document is a plan. It does not change application code, schemas, data, or production configuration. No commits, pushes or deployments follow from writing it.

---

## 0 · Revision history

| Date | Change | Status |
|---|---|---|
| 2026-10-24 | Initial draft. Captured strategic vision, audit findings (three parallel read-only audits), Live surface requirements (central feed, profile heartbeat, product-level Live indicator, one authoritative Live system), privacy and interest-event model, auction direction with legal gates, phased plan, risk register and owner decisions Q1–Q7. | PROPOSED |
| 2026-10-24 | Documentation-only revision — owner-authorised following read-only completeness review. Closed four gaps: added §5.0 (free-vs-business tier distinction — any NEX user may broadcast Live; product-featured Live commerce requires a Business account with a Shop); expanded §5.1 (mixed swipeable discovery feed covering Live broadcasts + uploaded videos + community posts, with explicit content-type markers; upload-surface integration and community-posts integration both marked TBD); added security-copy prohibition in §5.1 for locally filtered content (never expose "2km", "radius", "near you", "auto-assigned" in user-facing copy; use general area names; carried from sealed NEX Community Notice doctrine 2026-10-23); and this entry. No change to audit evidence (§2), reuse-vs-build matrix (§3), customer / seller journeys (§4), §5.2–§5.4, customer interaction during Live (§6), privacy and interest-event model (§7), auction architecture (§8), phased plan (§9), risk register (§10) or owner decisions Q1–Q7 (§11). Status remains PROPOSED · IMPLEMENTATION NOT AUTHORISED. | PROPOSED |

Future decisions must be appended here as separate rows (do not rewrite prior rows). Each change should carry: date, change summary, resulting status.

---

## 1 · Strategic vision and owner direction

**Core principle.** Every meaningful customer interaction can become a persistent, useful relationship between the customer and the seller inside NEX.

**Three connected surfaces, one relationship.**
1. **Shop** — the seller's permanent home for products, services or other offerings.
2. **Live** — the real-time surface where customers discover, watch, ask questions and interact with featured products or local events.
3. **NEX chat** — the persistent relationship where customers and sellers continue conversations and handle purchase enquiries.

**The connected customer flow.**

```
Discover  →  Watch  →  Interact  →  View product  →  Buy or bid  →  Continue in NEX chat
```

**Non-negotiable boundaries (carried from sealed doctrine, not re-opened by this plan):**
- Commerce is chat-native. NEX does not process payments. Any payment-flow proposal here is a direction, not an authorisation.
- The three surfaces must reflect the **same** authoritative Live-session and featured-product state. One system, not three.
- Anonymous ≠ named. Anonymous browsing never silently becomes a seller-visible lead.
- Marketing opt-in is separate from enquiry visibility. `nex_account_notification_prefs.marketing_enabled` defaults FALSE and remains so.

**Explicitly out of this plan's authorisation:**
- Changes to NEX payment doctrine.
- Changes to Theme Engine, Vault policy, Socials, Directory Spine, Universal Image Doctrine or Menu-first (Bridge 22) surfaces.
- Changes to any file under `src/lib/nex/` legacy residue.
- RLS behaviour or migration policy for any table.
- Live stream retention, comments retention or voucher mechanics beyond design proposal.

---

## 2 · Verified current-state audit findings

Facts in this section are evidence from three parallel read-only repo audits (2026-10-24). Each row carries its evidence trail. Proposals are deferred to §3 onwards.

### 2.1 · Commerce foundation (audit 1)

| Area | Classification | Evidence |
|---|---|---|
| Product list routes | **A** · implemented | `src/app/nex-native/[businessSlug]/page.tsx:94-250`; `src/app/nex-native/product/[productId]/page.tsx:1-168`; served via `productService.listProductsByBusiness` and `productService.getProductById`; `status='live'` enforced at route level |
| Product detail | **A** · implemented | `src/app/nex-native/[businessSlug]/[productId]/page.tsx:50-535`; renders price, stock badge, variants, seller identity, Safe Trade indicator; "Order Now" and "Chat Now" wire `sendProductInquiryAction` |
| Product management (create / edit / stock toggle) | **A** · implemented | `src/app/nex-native/manage/products/_actions.ts:36-88`; ownership check (seller account owns business owns product) at `_actions.ts:63-70`; writes to `nex_product.stock_status` via `productService.updateProductStockStatus` |
| Shop / seller pages | **A** · implemented | `src/app/nex-native/[businessSlug]/page.tsx`; Menu-first branch (Bridge 22) intact at line 64-67; owner-only banners conditionally rendered 134-150 |
| Add-to-cart | **B** · partial | Client: `_add-to-cart-button.tsx:44-159` writes localStorage key `nex-cart`. Server: `nex_cart` table (Migration 078) with owner-only RLS. Cart send: `sendCartOrderAction` (`src/app/nex-native/_actions.ts:2127-2785`) creates `attachment_type='cart_order'` message. Hybrid persistence — localStorage-first, synced to server, not server-first |
| Cart-to-chat handoff | **A** · implemented | `sendCartOrderAction` validates ownership (peer, shop, every product line's `business_id`), fetches prices fresh from DB (client never trusted), creates `NexPeerCartOrderSnapshot`, dispatches via `sendPeerMessage` with `attachment_type='cart_order'` |
| `send_intent_id` idempotency (cart) | **A** · implemented | `nex_peer_message.send_intent_id` column (Migration 102 Part C); `UNIQUE(sender_account_id, send_intent_id) WHERE send_intent_id IS NOT NULL`; `pg_advisory_xact_lock` serialisation via `nex_bridge99_first_send_intent` (Migration 105); device-scoping (Migration 106). Cart action validates UUID shape (`_actions.ts:2146-2152`); duplicate retry returns existing row (`peer-message-service.ts:437-465`) |
| `send_intent_id` idempotency (product/menu inquiry) | **gap** | `sendProductInquiryAction` and `sendMenuItemInquiryAction` do NOT pass `send_intent_id` to `sendPeerMessage`. Documented in-repo test note: "flagged for a future hardening slice". Double-tap can create duplicate messages |
| Conversation reuse | **A** · implemented | `nex_peer_conversation` has `UNIQUE(participant_a_id, participant_b_id)` with canonical ordering via `orderPair()` (`peer-conversation-service.ts:34-36`). `getOrCreatePeerConversation` is race-safe. `who_can_message` gate fires on new conversations only (`peer-conversation-service.ts:142-172`) |
| Product status / availability | **A** · informational | `nex_product.stock_status` enum (`in_stock|low_stock|made_to_order|sold_out`) with CHECK constraint (Migration 023 line 41-44); per-variant override (Migration 075). Status is informational — no cart-time rejection, per doctrine (commerce completes in chat) |
| **Interested-customer / leads view** | **D** · absent | **No surface anywhere.** Inquiries live only as `nex_peer_message` rows with `attachment_type ∈ {product, menu_item, cart_order}`. No table indexed by product for "who enquired about X"; no seller dashboard |

### 2.2 · Chat + conversation + Live pilot (audit 2)

| Area | Classification | Evidence |
|---|---|---|
| Peer conversation dedup | **A** · implemented | Pair-only (not pair+product). Two product taps reuse same thread |
| Product-attached message snapshot | **A** · implemented | `NexPeerProductSnapshot` (`peer-message-service.ts:200-212`) captures `product_id`, `business_id`, `business_slug`, `name`, `price_pence`, `currency`, `image_url`, `short_description` frozen at send-time |
| `?pending_product=` flow | **A** · implemented | URL built at `cover/primitives.tsx:692`; server resolves at `chat/peer/[accountId]/page.tsx:393-433`; composer mounts chip at `_composer.tsx:100-116,640-756`; hidden form field dispatches via `sendPeerMessageOrShareProductAction` |
| Chat attachment types (9) | **A** · implemented | `image`, `video`, `audio`, `product`, `menu_item`, `cart_order`, `product_share`, `sticker`, `theme-emoji`. Enum in `peer-message-service.ts:124-139`; renderer dispatch at `_portrait-bloom-shell.tsx:109-119` |
| Live Commerce broadcaster | **B** · partial | WebRTC mesh works via `broadcast-engine.ts`; 10-viewer cap; Supabase Realtime presence channel `nex:live:{sessionId}`. **Featured-product catalog is `CRISPY_CHICKEN_MOCK` hardcoded** (`_go-live-client.tsx:30`); real `nex_product` wiring is explicit future work in the file comments |
| Live Commerce viewer | **A** · implemented | `/nex-native/live-commerce/[sessionId]/_viewer-client.tsx`; signed-in gated; late-joiner featured-product sync via Realtime presence meta |
| Pinned-product featured channel | **A** · implemented (transport) | `featured-product-channel.ts:134-200+`. **Zero DB storage.** State held in broadcaster's client memory; propagated via Supabase Realtime broadcast channel `nex:live-featured:{sessionId}`; late-joiners reconstruct from broadcaster's presence row |
| **`live_product_enquiry` attachment** | **C** · UI-only | Viewer passes `?pending_product=X&live_session_id=Y` (`_viewer-client.tsx:118-121`). Composer renders "📺 From Live" badge (`_composer.tsx:709`) and includes hidden `live_session_id` form field. **`shareProductToContactAction` (`_actions.ts:3160+`) does NOT read or persist `live_session_id`.** The context is dropped at the server boundary |
| **Live comments stream** | **D** · absent | No composer, no message list, no reactions, no Realtime data-channel for comments on either broadcaster or viewer surface |
| **Replay / VOD** | **D** · absent | No `replay`, `vod`, `recording`, `playback` strings in codebase. Ended session transitions to `state='ended'` with no persistence or VOD surface |

### 2.3 · Schema, events, auth, Safe Trade (audit 3)

| Area | Classification | Evidence |
|---|---|---|
| Business / seller schema | **A** · implemented | `nex_business` (Migration 002); `verified_at` admin-set TIMESTAMPTZ (Migration 083); `safe_trade_activated` boolean (Migration 073). RLS: public-read, owner-only update |
| Product schema | **A** · implemented | `nex_product` (Migration 003) + `nex_product_variant` (Migration 035) + `spec` JSONB (Migration 075). RLS: public-read-live-only; owner-read-all, owner-write |
| Cart schema | **A** · implemented | `nex_cart` (Migration 078): one row per account, `items` JSONB, `delivery_address` JSONB, owner-only RLS, auto-touch trigger |
| Conversation + message schema | **A** · implemented | Dual pair: `nex_conversation`+`nex_message` (business-scoped, Migration 004) and `nex_peer_conversation`+`nex_peer_message` (peer-to-peer, Migration 047). Peer messages have E2E encryption columns (Migration 093); `message_group_id` for fan-out |
| `send_intent_id` multi-layer idempotency | **A** · implemented | Migration 102 Part C (UNIQUE partial index) + Migration 105 (`nex_bridge99_first_send_intent` + `pg_advisory_xact_lock`) + Migration 106 (device-scoping) |
| **`nex_peer_message` RLS defect** | **FLAGGED SECURITY RISK** | RLS policies compare `nex_account.id` against `auth.uid()` — different UUIDs by construction, policies never fire. Current enforcement is **service-layer-only** via `peer-message-service.ts` participant check (`:324-331, :579-585`). The B99+rls-harden migration is deferred. |
| **Live Commerce schema** | **B** · phase 1 only | `nex_live_post` (Migration 029) — business-anchored announcements, no geo (deferred to phase 2), RLS enabled but no policies defined. **No `nex_live_session`, no `nex_live_viewer`, no `nex_live_featured_product`, no presence table.** |
| Analytics / events | **B** · marketing-layer only | `nex.discovery_signal` (Migration 208): `signal_type ∈ {view, tap, chat_open, save, dismiss}`, `metadata` JSONB ≤ 2048 bytes, RLS enabled, service-role-only INSERT, user-owned SELECT/DELETE. **Explicitly scoped as marketing-layer; must NOT join Intelligence or Directory canonical queries.** No `nex_event`, no `nex_product_impression`, no `nex_enquiry_event`, no session_metric table, no 3rd-party instrumentation |
| Notification infrastructure | **A** · Web Push only | `nex_account_push_subscription` (Migration 098) + `nex_account_notification_prefs` (Migration 198) with `marketing_enabled` NOT NULL DEFAULT FALSE. Dispatch service fails CLOSED on preference-read failure. **No email, SMS, or in-app badge table.** |
| Auth boundaries | **A** · implemented (with caveat) | `resolveNexAppSessionFromContext()` in `src/lib/nex-native/app/session.ts:80-120`; `middleware.ts` narrowed to NEX routes. RLS enabled on commerce tables; peer-message defect noted above |
| **Safe Trade** | **B** · journalled consent, not a technical primitive | `nex_account.safe_trade_consent_at` + `safe_trade_consent_version` (Migration 069); `nex_business.safe_trade_activated` boolean (Migration 073). Drives UI copy ("Priya has safe trade activated") and legal journal. **No escrow, no dispute resolution, no payment gate, no order block on inactive seller.** |
| **Auction / bid schema** | **D** · absent | No table, no column, no code. Greenfield |
| **Customer-interest / lead schema** | **C** · reconstruction-only | `nex_liked_product` (Migration 074) — buyer-hearted products, UNIQUE pair. `nex.discovery_signal` — marketing signals. **No `nex_enquiry_log`, no `nex_lead`, no `nex_prospect`, no `nex_interested_customer`.** |

### 2.4a · Amendment · 2026-10-26 · owner-signed · payment-doctrine clarification

**Clause being clarified.** See §2.4 clause 3 below (line 169 of this
document, preserved verbatim):

> **NEX never handles payments** — sealed 2026-09-28 (Bridge 16b, 17d, 30).
> Any auction or Live-commerce surface design in this plan explicitly
> defers payment to chat.

**Scope of this amendment.** This amendment adds a clarified reading to
the sealed clause **without weakening it**. The sealed clause remains in
force in the body of §2.4 exactly as written and continues to govern
buyer-to-seller marketplace payments.

**Clarified reading (effective 2026-10-26, owner-signed).**

> **NEX does not intermediate or take commission on buyer-to-seller
> transactions.** NEX may collect its own published service fees from
> users (listing fees, subscription fees, verification fees, and similar
> openly-disclosed service charges) through an approved payment provider,
> without routing or intermediating marketplace transactions between
> buyers and sellers.

**What IS now permitted under this clarification.**

- NEX accepts payment from sellers for listing entitlements (e.g. the
  Rp 30,000 single-watch-listing entitlement).
- NEX accepts payment from users for its own subscription services
  (e.g. a future Bisnis plan or similar NEX-published subscription).
- NEX accepts payment for its own verification or trust services.

**What remains PROHIBITED under this clarification.**

- NEX does not route a buyer's payment to a seller.
- NEX does not take a commission on the sale price between buyer and seller.
- NEX does not hold funds in escrow between buyer and seller.
- NEX does not mediate disputes between buyer and seller as a payment party.
- Auction and Live-commerce surfaces continue to defer buyer-to-seller
  payment to chat, as the sealed clause requires.

**Downstream effects.**

- Migrations 193 (`nex_theme_purchase`) and 194 (`nex_theme_ownership`) ·
  previously flagged by `nex-overall-readiness-checklist` as blocked by
  the broad reading of the sealed phrase · may now be reviewed under the
  clarified rule. Reviewing and applying those migrations remains a
  separate owner authorisation; this amendment only unblocks the review.
- The proposed `nex_watch_listing` Rp 30,000 entitlement payment flow is
  permitted under this clarification. Implementation remains blocked on
  the per-phase authorisations stated in the NEX Watches v1 plan.
- Owner directive 2026-10-26 (NEX Watches v1): NEX takes 0% commission
  on buyer-to-seller sales remains in force.

**Changelog.**

- 2026-10-26 · amendment added · owner-signed
- 2026-09-28 · original sealing (Bridge 16b, 17d, 30) · preserved verbatim at line 169 of this document

---

### 2.4 · Fail-closed boundaries any new work must respect

1. **`nex_peer_message` RLS defect** — every new message-writing path must go through `peer-message-service.ts`; direct Supabase client calls are forbidden.
2. **`nex.discovery_signal` scope** — marketing-layer only. Must not join into Intelligence (truth) or Directory (publication) canonical queries.
3. **NEX never handles payments** — sealed 2026-09-28 (Bridge 16b, 17d, 30). Any auction or Live-commerce surface design in this plan explicitly defers payment to chat.

---

## 3 · Reuse-vs-build matrix

| Capability | Existing primitive(s) | Reuse / Build | Notes |
|---|---|---|---|
| Professional product page | `product/[productId]` + `[businessSlug]/[productId]` | **Reuse** | Already a tidy "Order / Chat Now" surface; polish only |
| Product → chat with product attached | `?pending_product=` + `shareProductToContactAction` + `NexPeerProductSnapshot` | **Reuse** | Snapshot survives product deletion |
| Conversation dedup per customer-seller pair | `UNIQUE(a,b)` on `nex_peer_conversation` | **Reuse** | Taps on same product reopen same thread |
| Interested-customer inbox | none | **Build** | Can hang off existing data for phase 1 (no new table) |
| Customer-interest events (view / tap / enquiry / cart / order) | `nex.discovery_signal` partial + `nex_liked_product` + conversation/message rows + `nex_order` | **Mostly reuse + narrow build** | Add `enquiry_initiated` + `cart_sent` signal types; expose merchant aggregation API |
| Product inquiry idempotency | missing on `sendProductInquiryAction` + `sendMenuItemInquiryAction` | **Narrow build** | Pass `send_intent_id` through both server actions |
| Live-session context on chat enquiry | `live_session_id` URL param + composer hidden field exist; server drops it | **Narrow build** | Patch `shareProductToContactAction` to persist `live_session_id` into `attachment_meta` |
| Server-authoritative auction state | none | **Build** | Greenfield tables + state machine + settlement job |
| Bid-event chat message | attachment-type union extensible | **Build on reuse** | New `auction_bid` + `auction_outcome` snapshot types |
| **Central Live feed** | none | **Build** | New surface; depends on Live-session persistence |
| **Live heartbeat on seller profile image** | none in DB; must reflect server state | **Build** | Requires authoritative "is seller live now" signal; new primitive |
| **Product-level Live indicator** | none; featured channel is Realtime-only in-memory | **Build** | Requires server-side featured-product state keyed to the live session |
| **One authoritative Live-session system** | partial (presence channel exists, DB absent) | **Build** | Add `nex_live_session` + `nex_live_featured_product` tables; everything else reads from these |
| Live comments stream | none | **Build** | Realtime channel + persistence model (owner-recommended persistent, see Q3) |
| Live replay / VOD | none | **Build (deferred)** | Separately scoped; not launch requirement |
| Seller dashboard: product → enquiries → conversions | none merchant-facing | **Build** | Reads from existing tables for phase 1 |
| Email / SMS notifications | none | **Build (deferred)** | Web Push works; email is phase 2 if needed |
| Safe Trade escrow / dispute | none (only consent journal + boolean) | **Build (deferred)** | Carries payment + legal risk; separate work |
| RLS hardening for `nex_peer_message` | B99+rls-harden deferred | **Build (tracked)** | Required for zero-trust production; see Risk Register §10 |

---

## 4 · Customer and seller journeys

### 4.1 · Minimum coherent journey, same backbone across categories

```
Discovery       Decision             Contact              Relationship
──────────      ──────────           ──────────           ──────────
Directory  →   Product detail   →   Chat with owner   →   Persistent thread
Shop            price · stock        product chip         snapshot
Live feed       Order / Chat         structured           persists product
                                     enquiry event        + session ref
```

### 4.2 · Category variants (surface differences, same backbone)

- **Physical products** — product page with price, stock, variants, Safe Trade indicator. Primary action: "Chat about this" (or "Add to cart" when cart flow applies). Chat opens peer thread with product chip.
- **Services** — same surface; variants carry `duration` + `service_location` (already in `nex_product.spec`). No cart. One-tap enquiry fires a `product` snapshot.
- **Food / menu-first businesses** — Bridge 22 doctrine; menu replaces product grid. `menu_item` snapshot is the chat primitive (spice level, dietary tags, perks chips in `NexPeerMenuItemSnapshot`).
- **Accommodation (Phase A1 only)** — rooms rendered when `business.subtype` allows. Phase A1 is "chat about this room" only. `product` snapshot type reused.
- **Live Commerce** — viewer taps pinned product → "Order now" → routes to peer chat with `?pending_product=&live_session_id=` → chat snapshot persists live-session context (see §5 and §6). Phase 1: product snapshot only. Phase 2: comments. Phase 3: replay.

### 4.3 · Seller journey

- Seller sees per-product interest aggregates (anonymous views, taps) and a named list of real actions (enquiries, saves, cart sends, bids, orders) at a new surface under `/manage`.
- All structured interactions arrive as chat messages or push notifications (per `nex_account_notification_prefs`), not as a feed to scrape.
- Seller continues the relationship inside NEX chat with full history and product attachment.

### 4.4 · Doctrine preserved

- NEX never handles payments (sealed). Any "buy" or "bid" in Live goes to chat for payment settlement.
- Safe Trade copy + consent + activation chip. Not misrepresented as escrow.
- Menu-first + Universal Image Doctrine + Theme Engine + Vault + Socials + Directory Spine untouched.

---

## 5 · Live surface requirements (owner-approved product direction, 2026-10-24)

### 5.0 · Who can broadcast — tier distinction (owner direction 2026-10-24)

**Any NEX user may broadcast Live.** Going Live is not gated to a business account. Free-tier broadcasters may start, run and end a session, and may appear in the discovery feed (§5.1 · A).

**Product-featured Live commerce requires a Business account with a Shop.** The following capabilities depend on the broadcaster owning a `nex_business` row and at least one `nex_product` row:

- Pinning a product to the live stream (§5.3 · C · product-level Live indicator)
- Driving the per-product Live indicator in the shop (§5.3 · C)
- Receiving structured product-enquiry chat messages originating from the Live surface (§6)
- The broadcaster's product picker and the featured-product channel

Free-tier broadcasters do **not** surface the product picker, the featured-product channel, or the shop-side Live indicator. The absence is deliberate: the UI must stay honest about which Live surfaces carry commerce controls and which do not.

**Design implication for §5.4 schema.** The proposed `nex_live_session.business_id` FK must be **nullable** so free-tier broadcasts can create sessions without a business row. `broadcaster_account_id` remains the primary identity key for every session. The proposed `nex_live_featured_product` table applies only to sessions where `business_id IS NOT NULL`. The §5.2 · B profile heartbeat still fires for free-tier Live sessions (the heartbeat marks "this NEX user is Live now" — it does not imply commerce).

The tier-gate check must route through the existing `nex_business` ownership resolution. It must not infer business status from any other primitive (follower count, directory presence, prior commerce activity, etc.).

### 5.1 · A · Central NEX Live feed

- NEX gets a central Live discovery feed that can surface:
  - Local events and community activity
  - Sellers who are broadcasting live
  - Live product demonstrations
  - Future live experiences as the platform develops
- Feed helps customers discover sellers they have never visited before.
- Must **complement** existing shop and profile, not replace them.
- Local discovery respects existing NEX location and community rules. **No silent assignment** of users to a community or location.
- Depends on authoritative Live-session persistence (see §5.4 · D).

**Mixed content composition (owner direction 2026-10-24).** The discovery feed is **one continuous, swipeable experience** containing three distinct content types. Each content type must be clearly distinguished in the UI so a viewer always knows what they are watching:

- **Live broadcasts** · currently-open sessions, backed by the proposed `nex_live_session` table (§5.4 · D). Must carry a visible Live pill and real-time viewer-count.
- **Uploaded videos** · recorded, non-live media. **The dedicated persistent-upload surface is TBD** — this plan does not assume one already exists. Whether this rides on the existing NEX Status primitive (currently 24-hour ephemeral, device-local IndexedDB per the 2026-10-22 Status implementation plan) or on a new persistent-video table is an open design decision for Phase 2 and must be resolved before implementation begins. Must carry a visible recorded-video marker (duration chip, "Recorded" label, or equivalent) so the viewer never mistakes it for Live.
- **Community posts** · integration with the existing sealed NEX Community Notice primitive (`src/app/nex-native/community/chat` and the Community Notice doctrine sealed 2026-10-23). **The integration shape is TBD** — this plan does not assume community posts are already feed-ready, and does not amend the Community Notice doctrine. Must carry a visible community-post marker.

Every entry in the feed must carry a content-type marker. The viewer must never mistake a recorded video for a Live stream, or a community post for a broadcast.

**Security-copy prohibition for locally filtered content (owner direction 2026-10-24).** Where the feed filters by proximity or community membership, user-facing copy must **not** expose the underlying location-selection mechanism. This is a load-bearing security clause carried from the sealed NEX Community Notice doctrine (2026-10-23). The reasoning is **reconnaissance risk** — explicit proximity vocabulary allows a bad actor to sock-puppet near a known target address and correlate posts about absences or travel.

- **Never** use in user-facing copy: `"2km"`, `"radius"`, `"near you"`, `"auto-assigned"`, `"within X km"`, numeric distance claims, or any phrase that reveals how the user was placed in or near a group.
- **Use** general area names only (e.g. `"Yogyakarta"`), and only when the area name itself is honest to the viewer's context.
- This clause reinforces existing NEX location + community doctrine; it does not replace it. Any Phase 2 UI copy for the Live feed, uploaded videos list, community posts list and all three filter chrome elements must pass this check before shipping.

### 5.2 · B · Live heartbeat on seller's profile image

- When a seller is actually live, their profile image displays a clear, polished animated Live heartbeat/ring.
- Appears consistently wherever the seller's profile identity is displayed in supported NEX surfaces (relevant shop, profile and discovery contexts).
- Disappears when the broadcast ends.
- Animation is a visual representation of server-authoritative state (see §5.D). The ring is driven by a signal; it does not become the signal.

### 5.3 · C · Live indicator on the product being demonstrated

- When the seller is live and a particular product is featured, show a small, clear Live indicator on that product in the seller's shop.
- Tapping it opens the active broadcast with the correct product featured.
- **Do not** mark every product as live just because the seller is broadcasting. Indicator corresponds to the actual featured product and the active session.
- Depends on authoritative featured-product persistence (see §5.D).

### 5.4 · D · One Live system, connected surfaces

- The Live feed, seller heartbeat, shop product indicators and viewer featured-product card must all reflect the **same** authoritative Live-session and featured-product state.
- Do not create separate, inconsistent Live systems for each surface.
- **The server must be the source of truth** for active sessions and featured products. An animation is only a visual representation of that state.

**Honest about current state.** The audit confirms:
- Live sessions and presence are **not persisted** in dedicated DB tables (only `nex_live_post` exists, which is a text announcement primitive).
- The broadcaster's product picker uses `CRISPY_CHICKEN_MOCK` hardcoded.
- The featured-product channel is Realtime-only; broadcaster state lives in client memory and propagates via Supabase Realtime; no DB persistence.

**Required architecture (proposed, not built).** To fulfil §5.A–C with one authoritative system:
- `nex_live_session` table: `id`, `business_id` (FK), `broadcaster_account_id` (FK), `started_at`, `ended_at` (nullable), `status` (open | ended), plus RLS: public-read-while-open; owner-write.
- `nex_live_featured_product` table: `session_id` (FK), `product_id` (FK nullable), `started_featuring_at`, `ended_featuring_at`; one active row per session at a time.
- Broadcaster start/end actions write to `nex_live_session`; "Feature a product" writes to `nex_live_featured_product`. Supabase Realtime remains the fast-path transport; the DB remains the authoritative state.
- Shop/profile surfaces read `is_live = EXISTS(SELECT 1 FROM nex_live_session WHERE business_id = ? AND status='open')` for the heartbeat.
- Product surfaces read `is_featured_live = EXISTS(SELECT 1 FROM nex_live_featured_product WHERE product_id = ? AND ended_featuring_at IS NULL)` for the per-product indicator.
- Live feed reads `nex_live_session` joined to `nex_business` and filtered by location + community rules.

**Dependencies:**
- Broadcaster product picker must be wired to real `nex_product` rows (not mock) before any product-level Live indicator can be honest.
- Live session persistence must land before the heartbeat or feed can honour "one system, one state."
- Location + community filtering must honour existing NEX rules (see Community Notice doctrine).

**Honest labelling.** The audit's "A" classifications on viewer and featured-channel transport remain accurate. The "B" classifications on broadcaster catalog wiring and the overall Live schema remain gaps. This plan does not claim either is already implemented.

---

## 6 · Customer interaction during Live

The customer should be able to:
1. Discover a broadcast in the Live feed or through a seller's profile/shop.
2. Watch the live video.
3. See the currently featured product.
4. Open the product details without losing the Live context unnecessarily.
5. Ask the seller a question through NEX chat with the correct product attached.
6. Add the product to the existing cart or use the existing purchase-enquiry flow where applicable.
7. Place a bid when the product has an active auction.
8. Return to the same seller conversation after the broadcast ends.

The seller should receive relevant, structured interaction updates through NEX chat, not depend on scrolling through video comments to discover potential customers.

**Current gap to close (audit evidence).** `shareProductToContactAction` ignores `live_session_id` on write. The URL and composer carry it; the server action drops it. The proposed plan includes patching `shareProductToContactAction` so a product enquiry originating in Live retains its session context in `attachment_meta`.

**Reuse preserved.** The product snapshot, `UNIQUE(a,b)` conversation reuse, and cart-to-chat architecture carry over without redesign.

---

## 7 · Customer-interest and privacy model

### 7.1 · Separation of anonymous aggregate vs named action

- **Anonymous aggregate** — product views and taps. Count-only. Never named. Never surface a specific account to a seller.
- **Named action** — the customer did something explicit:
  - Started an enquiry (`enquiry_initiated`)
  - Explicitly saved a product (`nex_liked_product`)
  - Submitted a bid (`bid_placed`)
  - Initiated a purchase (`order_initiated`)
  - Completed an order (`order_completed`)

Named actions **may** surface the customer's NEX identity to the seller. Aggregate signals never do.

### 7.2 · Event taxonomy (proposed)

| Event | Where it lives today | Proposed persistence | Seller visibility |
|---|---|---|---|
| `product_impression` | not logged | `nex.discovery_signal` with `signal_type='view'` + `metadata.product_id` | **Aggregate only** |
| `product_click` | not logged | `nex.discovery_signal` with `signal_type='tap'` + `metadata.product_id` | **Aggregate only** |
| `product_saved` | `nex_liked_product` | Reuse | Aggregate count + optional per-customer list behind privacy switch |
| `enquiry_initiated` | partial via `signal_type='chat_open'` | Normalise to `enquiry_initiated` + `conversation_id` + nullable `product_id` + nullable `live_session_id` | **Named** |
| `cart_sent` | `nex_peer_message` attachment=`cart_order` | Reuse message row; derive event | **Named** |
| `bid_placed` | not implemented | New `nex_auction_bid` + optional chat echo | **Named** |
| `order_initiated` | `nex_peer_message` attachment=`product`/`menu_item`/`cart_order` | Reuse | **Named** |
| `order_completed` | `nex_order` | Reuse | **Named** |

### 7.3 · Transparency copy (proposed, review before release)

Proposed microcopy at the enquiry entry point:

> **Starting a conversation about this item shares your NEX identity with the seller. Your private messages remain in your conversation.**

Review this wording against actual NEX identity and privacy behaviour before release. The sharing of NEX identity in an enquiry does not grant marketing permission.

### 7.4 · Marketing opt-in boundary

- `nex_account_notification_prefs.marketing_enabled` defaults FALSE (Migration 198, sealed consent doctrine).
- Enquiry visibility to the seller **does not** grant marketing permission.
- A separate opt-in surface is required before any marketing follow-up outside the direct enquiry conversation.

### 7.5 · Private conversation body is not analytics

- Seller sees "Jane enquired about Product X at 14:03" in the dashboard — not the message body.
- The body stays in the conversation. Any seller-facing analytics or export surfaces must honour this.

### 7.6 · Retention (proposed, subject to privacy / legal review)

- **Named interest events**: proposed default 180 days. Deletable on customer request. **This is a proposed design default, not a locked policy.** Privacy / legal review required.
- **Aggregate signals**: longer retention is acceptable only when genuinely anonymised and consistent with policy.
- Deletion must be a verified process, not a UI claim. See Risk Register §10.

### 7.7 · Access control

- All named-interest reads scoped by `business_id = session.business_id` for seller surfaces or `account_id = session.account_id` for customer surfaces.
- Reads must route through verified service-layer authorisation. Do not rely on the defective `nex_peer_message` RLS (see Risk Register §10 R1).

---

## 8 · Auction architecture and unresolved legal gates

**Plan the architecture. Do not implement until legal review clears it.**

### 8.1 · State machine (proposed)

```
         draft (seller editing)
            │ publish
            ▼
         scheduled (before start_at)
            │ start_at reached
            ▼
         open (accepting bids)
            │ end_at reached
            ▼
         closing (atomic settlement in progress)
            │
       ┌────┴────┐
       ▼         ▼
  closed_sold  closed_unsold
       │
       ▼
    settled (handoff to chat; purchase flow lives in conversation)

  cancelled (seller-initiated or policy violation — reachable from draft / scheduled / open)
```

### 8.2 · Tables (proposed shape)

```
nex_auction
  id, product_id (FK), seller_business_id (FK),
  starting_bid_pence, bid_increment_pence,
  reserve_price_pence (nullable), currency,
  start_at, end_at, status,
  highest_bid_id (FK nex_auction_bid, nullable),
  rules jsonb, created_at, updated_at

nex_auction_bid
  id, auction_id (FK), bidder_account_id (FK),
  amount_pence, placed_at, idempotency_key uuid,
  UNIQUE(auction_id, idempotency_key),
  index: (auction_id, placed_at DESC)

nex_auction_event
  id, auction_id (FK),
  event_type (opened | bid | outbid | closing | closed_sold | closed_unsold | cancelled),
  actor_account_id (FK nullable), payload jsonb, created_at
```

### 8.3 · Trust boundaries + atomicity (proposed)

- **Server time only.** `end_at` is single source of truth. Clients render a server-synced countdown; local clock is never trusted.
- **Bid validation** executes in a single transaction:
  1. `SELECT ... FOR UPDATE` on `nex_auction`
  2. Check `status = 'open'` and `end_at > NOW()`
  3. Check `amount ≥ current_highest + increment` and `amount ≥ reserve` (if set)
  4. INSERT `nex_auction_bid`
  5. UPDATE `nex_auction.highest_bid_id`
  6. INSERT `nex_auction_event` (bid)
  7. Commit
- **Idempotency.** Client supplies `idempotency_key` (UUID). UNIQUE constraint rejects duplicates; retried requests return the same `nex_auction_bid.id`. Pattern mirrors existing `send_intent_id` / `nex_bridge99_first_send_intent` design.
- **Settlement.** At `end_at`, a scheduled job (or lazy on-read trigger) transitions `open → closing → closed_sold | closed_unsold` atomically. Chat echo is dispatched **after** commit.
- **Late bids.** Rejected server-side with explicit `AUCTION_ENDED` code.
- **Outbid notifications.** Web Push via `nex_account_notification_prefs`. Email deferred.
- **Chat event.** `nex_peer_message` with new `attachment_type ∈ { auction_bid, auction_outcome }`. The chat is informational; it does not determine the winner.
- **Shill-bidding prevention.** Seller account blocked from bidding on own auction (`nex_business.owner_account_id` check). Throttle per-account bids per auction.
- **Dispute flow.** No auction-specific flow phase 1 (routes through chat). Flagged for Safe Trade phase 2.

### 8.4 · Unresolved legal gates (do not launch binding bidding without resolving)

- Real-money bidding is regulated (jurisdictional, consumer-protection, potentially overlapping with auction/lottery law).
- Required before binding-auction launch:
  - Jurisdictional legal review (per-market).
  - Applicable auction rules (reserve disclosure, bid retraction, winner obligation).
  - Payment doctrine clearance — NEX does not handle payments; auction outcome routes to chat for settlement.
- Non-binding "expression of interest" or "best offer" is a possible earlier pilot, clearly distinguished from a legally binding auction. Decision deferred.
- **This document records the architecture. It does not record legal approval.** Launch is dependency-gated.

---

## 9 · Phased plan and acceptance criteria

### Phase 1 · Foundation — inquiry idempotency, interest aggregation, privacy transparency, seller interested-customer view

Scope (bounded):
- Patch `send_intent_id` into `sendProductInquiryAction` + `sendMenuItemInquiryAction`.
- Patch `shareProductToContactAction` to persist `live_session_id` into `attachment_meta`.
- Add `enquiry_initiated` + `cart_sent` to `nex.discovery_signal` signal-type enum (one additive migration).
- Server-side aggregation reads for per-product and per-business interest summaries, reconstructing from existing primitives (`nex_peer_message`, `nex_liked_product`, `nex.discovery_signal`, `nex_order`). Owner-direction Q1 Option A for the first bounded phase.
- Seller surface at `/manage/products/[productId]/interest` (or equivalent) rendering: anonymous view/tap aggregates, named enquirers, named cart senders, named orders.
- Transparency copy on product detail (§7.3) via Safe Trade JIT pattern.
- Source-shape tests for the three patched server actions.

Dependencies: none beyond repo state.
Acceptance criteria:
- `npm run typecheck` clean (ignoring pre-existing legacy residue in `src/lib/nex/`).
- Double-tap on "Chat with owner" with network stalling creates one message row.
- Live-session chat sends persist `live_session_id` into `attachment_meta`.
- Interest surface renders view / tap / save / enquiry / cart / order values per product, honouring privacy boundaries (view / tap are counts only, never named).
- No regression in cart-send E2E or existing peer-chat tests.
- Transparency copy present at the enquiry entry point.

### Phase 2 · Live commerce foundation — persistent session, real catalog, central feed, heartbeat, product-level indicator

Scope:
- `nex_live_session` + `nex_live_featured_product` tables with RLS.
- Broadcaster writes session start / end + featured-product state to DB; Realtime remains fast-path transport.
- Broadcaster product picker reads real `nex_product` rows (replace `CRISPY_CHICKEN_MOCK`).
- Central Live feed surface reading `nex_live_session` filtered by location + community rules (honour existing NEX community doctrine).
- Live heartbeat animation on seller profile image driven by `is_live` derived from `nex_live_session`.
- Product-level Live indicator derived from `nex_live_featured_product`.
- Patch `shareProductToContactAction` audit gap (if not already in Phase 1).
- Live session context persists across broadcast → chat → post-broadcast conversation reopen.

Dependencies: Phase 1 complete; location + community rules confirmed with doctrine.
Acceptance criteria:
- Broadcaster on → every supported surface displays the heartbeat within one Realtime round-trip of DB commit.
- Broadcaster off → heartbeat disappears everywhere.
- Featured product set → only that product shows the Live indicator in the shop.
- Featured product cleared → indicator disappears.
- Live feed shows only sessions respecting the viewer's location + community eligibility.
- All four surfaces (feed, profile heartbeat, product indicator, viewer featured card) reflect the same session + featured-product state.

### Phase 3 · Live interaction — comments, moderation, product interactions

Scope:
- Live comments stream with persistence (owner-direction Q3 — persistent, session-linked).
- Moderation primitives: mute viewer, pin comment, keyword filter.
- Reactions.
- Separate live comments from private customer-seller conversation.
- Retention + deletion rules for live comments (subject to privacy review).

Dependencies: Phase 2 persistent session table.

### Phase 4 · Auction engine — standalone, legally gated

Scope:
- `nex_auction` + `nex_auction_bid` + `nex_auction_event` tables with RLS.
- Transactional bid handler + idempotency + settlement job.
- Auction product page UI + bid confirmation sheet.
- `auction_bid` + `auction_outcome` chat attachment types + renderers.

Dependencies: jurisdictional legal review complete; non-binding pilot scope decided OR binding-auction legal clearance; payment doctrine confirmed unchanged.

### Phase 5 · Seller intelligence — funnel + conversion

Scope:
- Funnel: impression → click → enquiry → cart → order with correct definitions.
- Conversion rate, response time, repeat-customer measures.
- Separate verified fact from estimate.
- Introduce `nex_interest_event` table only if Phase 1 Option A query performance proves inadequate (threshold TBD, see Q1).

### Separately scoped (not launch requirements)

- Replay / VOD (requires MediaRecorder + storage bucket decision)
- Voucher drops / LIVE-only price chips / flash deals
- SFU transport upgrade (if 10-viewer cap becomes binding)
- Email / SMS notifications
- Safe Trade escrow / dispute (requires payment integration + legal review)
- RLS hardening for `nex_peer_message` (B99+rls-harden) — tracked in Risk Register §10 R1

Scope reordering or splitting is permitted if the audit proves a dependency requires it. Any reordering must be recorded in Revision History §0 with a reason.

---

## 10 · Risk register and tracked security items

| # | Risk | Current enforcement | Required for production | Status |
|---|---|---|---|---|
| R1 | `nex_peer_message` RLS defect — policies compare `nex_account.id` to `auth.uid()` (different UUIDs); policies never fire | Service-layer participant check in `peer-message-service.ts:324-331, :579-585`. All new reads/writes MUST route through this service | Decision required: accept service-layer-only enforcement for pilot, or require B99+rls-harden migration before production release of affected functionality. New seller-interest reads and message-writing paths must use verified service-layer authorisation, never rely on the defective RLS. | **TRACKED** |
| R2 | `nex_live_post` RLS enabled with no policies defined (Migration 029) | Service-layer business-owner-write; public-read-all | Review before scaling Live surfaces beyond pilot | **TRACKED** |
| R3 | Live session persistence absent | Transport-only (Supabase Realtime); broadcaster memory | Phase 2 adds `nex_live_session` + `nex_live_featured_product` tables as authoritative source | **TRACKED** |
| R4 | Broadcaster product catalog is mock (`CRISPY_CHICKEN_MOCK`) | None | Phase 2 wires to real `nex_product` | **TRACKED** |
| R5 | `live_session_id` dropped at `shareProductToContactAction` | None | Phase 1 patches server action to persist into `attachment_meta` | **TRACKED** |
| R6 | Product-inquiry double-tap duplicates | None (no `send_intent_id`) | Phase 1 patches `sendProductInquiryAction` + `sendMenuItemInquiryAction` | **TRACKED** |
| R7 | Binding real-money auctions have unresolved legal exposure | None | Legal review per jurisdiction before launch; non-binding pilot optional in interim | **TRACKED** |
| R8 | Named interest events have no verified deletion process | Proposed 180-day retention default | Deletion process must be designed + verified before "deletable on customer request" is advertised | **TRACKED** |
| R9 | Marketing default FALSE is correct but easy to override by accident in new surfaces | Default enforced at DB level (`nex_account_notification_prefs.marketing_enabled`) | Any new follow-up or marketing surface must honour `marketing_enabled` and not treat enquiry visibility as marketing consent | **TRACKED** |
| R10 | Query performance of Phase 1 Option A (reconstruct from existing primitives) at scale | Not measured | Record threshold at which Phase 5 introduction of `nex_interest_event` table is justified | **TRACKED** |

---

## 11 · Owner decisions (recorded)

Each decision captures owner direction given 2026-10-24. Items marked **direction** are design directions for planning. Items marked **unresolved** are explicitly open; do not treat them as approved policy.

| ID | Topic | Direction (2026-10-24) | Status |
|---|---|---|---|
| **Q1** | Interest-event storage | **Direction**: Option A — reconstruct from existing primitives for the first bounded phase, provided access controls, query performance and event semantics are sound. Do NOT join `nex.discovery_signal` into Intelligence or Directory canonical queries. Record the threshold at which a dedicated event table (Option B — `nex_interest_event`) would be required. | Direction given; threshold to measure in Phase 1 |
| **Q2** | Retention of named interest events | **Direction**: 180 days as a proposed design default. Deletable on customer request. **Subject to privacy / legal review and a verified deletion process.** Aggregate data may have longer retention only when genuinely anonymised and consistent with policy. **Not a locked policy.** | **Unresolved** — privacy/legal review + deletion process verification required |
| **Q3** | Live comments persistence | **Direction**: Prefer a persistent, session-linked model consistent with NEX's durable-conversation principles, with appropriate moderation, privacy, retention and deletion rules. Ephemeral alternative only if audit establishes a compelling reason. Separate live comments from the private customer-seller conversation. | Direction given; moderation + retention + deletion policy design required before implementation |
| **Q4** | Auction legal scope | **Direction**: Plan the full auction architecture (§8). **Do not launch binding bidding** until relevant legal review and rules are approved. Non-binding expressions of interest / offers may be an earlier pilot, clearly distinguished from a legally binding auction. | **Unresolved** — jurisdictional legal review required |
| **Q5** | Product-inquiry idempotency | **Direction**: Include `send_intent_id` hardening in the proposed first foundation phase. Must prevent duplicate messages from repeated taps and network retries without changing existing conversation behaviour. | Direction given — bundled into Phase 1 |
| **Q6** | Peer-message RLS defect | **Direction**: Treat as a tracked security risk (Risk Register R1). New seller-interest reads and message-writing paths must use verified service-layer authorisation. Require a security decision and remediation / acceptance criteria before production release of affected functionality. **Do not silently waive the risk.** | **Unresolved** — security decision + remediation criteria required before production release |
| **Q7** | Transparency copy | **Draft copy**: "Starting a conversation about this item shares your NEX identity with the seller. Your private messages remain in your conversation." Review wording against actual NEX identity and privacy behaviour before release. Make clear that enquiry visibility does not automatically grant marketing permission. | Draft recorded; final wording subject to review |

---

## 12 · Boundaries and stop conditions

### 12.1 · Explicit no-build boundary

- This document authorises **documentation only**.
- No code changes.
- No new or modified migrations.
- No schema changes, no production data writes.
- No commits, pushes or deployments.
- No modifications to unrelated files.
- No cleanup of existing work.
- Pre-existing modifications and untracked files are preserved.

### 12.2 · After saving this document

- Report exact document path.
- Report document status (PROPOSED · IMPLEMENTATION NOT AUTHORISED).
- Report files changed (this file only).
- Stop. Do not begin Phase 1A or any other implementation until the owner separately authorises it.

### 12.3 · Facts vs proposals vs decisions

Facts (audit evidence) are captured in §2 with exact file paths and migration numbers.
Proposals (design directions) are captured in §3–§9 and clearly marked as such.
Decisions (owner directions) are captured in §11.
Unresolved items (legal, security, privacy) are explicitly flagged. They are not approved policy.

### 12.4 · Evidence integrity

Audit evidence paths and migration numbers in §2 are sourced from read-only repo audits performed 2026-10-24. Do not invent evidence. Future revisions must preserve prior facts unless the repo state proves them wrong, in which case the correction and reason are recorded in Revision History §0.

---

**End of document.**
