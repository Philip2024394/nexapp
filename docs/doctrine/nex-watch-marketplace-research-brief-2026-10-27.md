# NEX Watch Marketplace · World-Class Research Brief · 2026-10-27

> Candidate A prep · founder-authorised 2026-10-27 · Research-only · Classification per Protocol §6: **researched** (not approved, not implemented, not tested).
>
> Produced by 1 read-only general-purpose research subagent. External sources cited at prior-knowledge level (training cutoff 2026-01). Internal NEX code verified at commit `609a3dd` or later.

## 0 · What is already built in NEX (verified from code, 2026-10-27)

Verified by reading the repo (`C:/Users/Victus/nexapp`):

- Doctrine: `docs/doctrine/nex-shop-watches-upload-draft-2026-10-26.md` (DRAFT, §8h sibling-table approach, 3-tier progressive form, 2-word custom brand cap, world-standard spec expansion).
- Catalogue: `src/lib/nex-native/watch-catalog/watch-brands.ts` (~100 curated brands across luxury-swiss, luxury-german, japanese, independent, microbrand, smartwatch, fashion, pro-dive, vintage-heritage, american, regional-asia) + `watch-vocabularies.ts` (18 enum vocabularies: watch types, movements, materials, bezels, dials, hands, water resistance, authenticity, seller types, packaging, pricing modes, shipping scopes).
- Service: `src/lib/nex-native/watches/watch-listing-service.ts` (server-only; FAIL-CLOSED writes, FAIL-OPEN reads; `createWatchListing`, `grantWatchListingEntitlement` idempotent via `internal_event_id`, `softRemoveWatchListing`, `getPublicWatchListingById`, `listPublicDirectoryTiles`, `searchPublicWatchListings`).
- Money doctrine: `watch-listing-money.ts` — launch fee `WATCH_LISTING_ENTITLEMENT_PENCE = 3_000_000` (Rp 30,000) for 30 days, IDR ×100 "sen" convention.
- Payment hardening: `watch-payment-webhook.ts` + `-service.ts` (signature verification + idempotent grant).
- Image allowlist: `watch-image-origin.ts`. Rate-limit: `watch-listing-rate-limit-config.ts` + `-service.ts` (DB-backed, account-scoped). Retention: `watch-retention-service.ts` (90-day sweep per S6).
- Dev-mock production guard: `watch-listing-dev-mock-guard.ts`.
- Migrations 227–230 (authored, NOT applied to prod): `nex_watch_listing` table, `nex_watch_listing_entitlement` ledger, `watch_listing_directory_v` view (price-filtered), `search_tsv` + GIN index. Migration 231 (deletion audit) and 232 (rate limit) also present. All comments stress "AUTHORED · NOT YET APPLIED TO ANY DATABASE · ijvqdvsvwtwxzcqmoqit".
- UI (shipped, routes exist): `/manage/watches/new` (3-tier progressive upload), `/watches` (public index + client search), `/watches/[listingId]` (detail with "Message seller" CTA deep-linking to peer chat, honest "Listed until" chip, honest "NEX does not intermediate" copy).
- Related doctrine: `nex-directory-tile-uniqueness-g3-amendment-2026-10-26.md`, `nex-commerce-live-relationship-plan-2026-10-24.md §2.4a`, `nex-vault-entitlements-policy-sheet-2026-10-20.md`, `nex-live-eligibility-contract-2026-10-27.md`.
- Safe-trade: `src/app/nex-native/safe-trade/page.tsx` — editorial public page. Explains 5 buyer-safe payment paths; NEX never touches funds.

Everything beyond this section is from-prior-knowledge (training cutoff January 2026) unless stated otherwise.

---

## 1 · The user problem (buyer and seller)

**Buyers of watches** are not uniform. In roughly declining dollar density:
1. **Luxury collectors** (Rolex / Patek / AP / Lange). Want provenance, service history, box-and-papers, authenticated serial, inspection before releasing funds. Allergic to counterfeits and partial sets.
2. **Enthusiasts** (Omega, Tudor, Grand Seiko, Longines, independents, microbrands). Want transparent condition, accurate reference numbers, decent macro photos, honest condition grading, seller reputation.
3. **Everyday buyers** (Seiko, Citizen, Casio, Alexandre Christie, fashion brands, smartwatches). Want current pricing, availability, warranty status, simple delivery.
4. **Investors / flippers** adjacent to 1–2. Want market-value visibility to decide entry price.

Universal trust questions: *is this watch what the seller says it is*, *is the price fair*, *will I receive it*, *what recourse do I have if something is wrong*.

**Sellers**:
1. **Authorised dealers / brands.** SKU inventory, retail controls.
2. **Independent retailers / pawn / grey-market dealers.** Shop surface, bulk listings, pricing modes.
3. **Private sellers** (one piece, moving a collection). A listing without a shop, a credible channel to buyers, a safe payment mechanism.

Both sides share one truth NEX's doctrine already honours: *the biggest trust failure a watch marketplace can make is to pretend to be a payment processor when it isn't*. Chrono24 learnt this via "Trusted Checkout". NEX pre-committed to the opposite route: never handle payments; make the deferred rail (chat + SafeTrade) the primary path. **That is a feature, not a limitation — if executed with care.**

---

## 2 · Market landscape

### 2a · Chrono24
- **Core proposition**: global default for pre-owned and new luxury watches. Scale + specialised trust mechanisms.
- **Trust mechanisms**: dealer verification tiers ("Trusted Seller", "Trusted Checkout"), buyer protection, reference pages with aggregated data, optional authentication service that physically inspects the watch at a Chrono24 hub.
- **Payment handling**: escrow-style buyer protection — Chrono24 holds funds, releases after delivery/inspection. **NEX explicitly declines this pattern.**
- **Discovery UX**: reference-number-first catalogue, saved searches, filters on brand/ref/movement/year/condition/box/price.
- **What NEX can learn without copying**: reference-anchored discovery, "trust tier" badge concept, structured dealer vs private-seller labelling, pattern of a *separate inspection service* attached to a listing. SafeTrade is NEX's cognate — buyer-paid, 20%, third-party. NEX must NOT replicate "Chrono24 holds the funds".

### 2b · WatchCharts
- **Core proposition**: watch *data* — pricing index, reference wiki, historical sold prices. Moat is market-value transparency.
- **Payment handling**: not primarily a transactional surface.
- **What NEX can learn without copying**: references matter more than listings — buyers want to understand *this reference* before considering *this listing*. **But NEX must NOT invent market-value data**. Unless NEX has a real data source (purchased feed, aggregator licence, or honest "ask the seller" placeholder), NEX cannot show indicative prices without violating the sealed no-fabrication rule.

### 2c · Hodinkee Shop
- **Core proposition**: editorial curation. Each listing with storytelling, archival imagery, expert framing. Low volume, high trust.
- **Payment handling**: standard e-commerce.
- **What NEX can learn without copying**: *presentation quality matters at the top of the market*. For NEX, this translates to a video-first listing format (`WatchOverlayCaption` already exists), honest macro photography requirements, seller-authored provenance notes (`provenance_note` column exists).

### 2d · eBay watches
- **Core proposition**: scale. Casio F91W to Patek 5711. "Authenticity Guarantee" program for high-value items.
- **Payment handling**: eBay-managed payments.
- **What NEX can learn without copying**: *categories must be opinionated, not sprawling*. NEX's 9 `WATCH_TYPES` + brand picker + movement reveal are already better than eBay's generic tree. NEX must NOT adopt platform-managed payments.

### 2e · Watch Box / Bezel / Watchfinder (certified pre-owned)
- **Core proposition**: in-house dealer certifies, services, warranties, sells.
- **Payment handling**: direct e-commerce.
- **What NEX can learn without copying**: *certified pre-owned is a product line, not a marketplace feature*. NEX is a marketplace, not a dealer. The marketplace analogue is "verified dealer" + "verified listing" tier badges + SafeTrade third-party inspection. NEX must NOT build an in-house service centre.

### 2f · Grailed (adjacent peer-to-peer fashion)
- **Core proposition**: peer-to-peer with offers/negotiation, user profiles, platform-managed payments + light buyer protection.
- **What NEX can learn without copying**: *user identity + seller profile is a trust asset*. NEX already has NEX-handle identity + account-scoped signals. The offer/negotiation flow is NOT applicable because NEX does not intermediate payment — negotiation happens in chat.

---

## 3 · Patterns that ARE applicable to NEX

1. **Reference-anchored product identity.** · Chrono24, WatchCharts · the `reference_number` field already exists on `nex_watch_listing`; indexed via `idx_nex_watch_listing_brand_model` and weighted 'B' in the tsvector. · *Adaptation*: when present, surface in listing header (already done in `[listingId]/page.tsx` as "Ref · {reference_number}"). Future: cluster listings by reference in search results.

2. **Dealer-vs-private seller labelling.** · Chrono24 · the `seller_type` enum (`brand` / `authorised-dealer` / `independent-retailer` / `private-seller`) is already in `watch-vocabularies.ts`. · *Adaptation*: show a one-glance badge on the listing hero + directory tile. Keep the taxonomy tight — do NOT invent "diamond" tiers until there is a verification process behind them (sealed Package-Contract DRAFT §P1 "verified badge DEFER" rule applies).

3. **Honest box-and-papers disclosure.** · All competitors · the `packaging_items` text[] already enumerates `box / papers / warranty-card / receipt / service-card / manual / spare-link / charger / extra-strap / none`. · *Adaptation*: render as chip cluster, not comma list. Explicit "No papers" is honest and preferable to omission.

4. **Condition-grading vocabulary.** · All competitors · the `condition` enum (`new / unworn / pre-owned / refurbished / for-parts / on-request`) matches market convention. · *Adaptation*: require a plain-English condition note alongside the enum for anything but `new`. The existing `description` field is sufficient; the UI should prompt for condition specifics in Level 1 for non-`new` listings.

5. **Third-party inspection attached to a listing.** · Chrono24 authentication service, eBay Authenticity Guarantee · NEX has **SafeTrade** as the canonical primitive. SafeTrade is NEX-doctrine compliant because the buyer pays SafeTrade directly (20%), NEX never touches funds. · *Adaptation*: add a prominent "Request SafeTrade inspection" affordance on each watch listing (routes to `/nex-native/safe-trade`). This becomes a trust lever specifically for luxury/pre-owned listings. The listing stays listed; SafeTrade is a buyer-side option, not a seller-side gate.

6. **Video-first listing.** · Hodinkee, newer Chrono24 dealer listings, Grailed · NEX already has `WatchOverlayCaption` + 9:16 video pattern + `buyNowPriceIdr` seeded on Hendra entries. · *Adaptation*: encourage (not require) a 10–20 second video for each listing. Make the gallery secondary to the video when both exist.

7. **Entitlement-expiry transparency.** · Honest adaptation of auction-end timers. NEX already surfaces `entitlement_expires_at` as "Listed until". · *Adaptation*: once close to expiry (≤ 3 days), surface a renewal CTA for the owner in `/manage/watches/mine`. Public viewers should NOT see this urgency framing.

8. **Chat-as-the-rail with safe-trade copy embedded.** · Grailed uses in-platform messaging, Chrono24 "contact seller" flow · NEX ships this today — "Message seller" CTA → `/nex-native/chat/peer/{ownerAccountId}?pending_watch={listingId}`. · *Adaptation*: the chat side needs an opening "pending_watch" context card referencing the listing by brand/model/photo so neither party has to re-link. (Verify this is wired or scoped — Candidate A implementation gate.)

9. **Entitlement stacking.** · Grailed listing renewals, Chrono24 ad windows · the service layer already stacks windows (`GREATEST(now(), prior entitlement_expires_at)`). · *Adaptation*: no change needed. Keep the behaviour honest and documented.

10. **Idempotent payment webhook (listing fee only).** · All e-commerce platforms · already implemented via `internal_event_id` UNIQUE + `(provider, payment_reference)` partial UNIQUE. · *Adaptation*: keep real payment-provider wiring (xendit/midtrans) deferred until an owner-authorised payment-provider decision; `provider='manual'` is honest at launch.

---

## 4 · Patterns that are NOT applicable to NEX (explicit)

1. **Platform-held escrow / Trusted Checkout / Managed Payments.** · *Prevented by*: sealed `doctrine_nex_never_handles_payments_2026_09_28` + payment-doctrine amendment 2026-10-26 §2.4 clause 3. · *NEX instead*: chat + SafeTrade + 5 buyer-safe payment paths on `/safe-trade`.

2. **In-house authentication / certified pre-owned program.** · *Prevented by*: NEX is a marketplace, not a dealer. · *NEX instead*: SafeTrade; "Authenticity · seller-asserted" transparency; verified-dealer badge **only when** a real verification process exists.

3. **Fabricated market-value / "fair-value" estimates.** · *Prevented by*: sealed no-fabrication rule + absence of a real pricing data source. · *NEX instead*: show seller's price only; show reference_number so buyer can look it up externally.

4. **In-app offers / negotiation flows.** · *Prevented by*: NEX does not intermediate price. · *NEX instead*: offers happen in chat as free-form conversation.

5. **International shipping calculator.** · *Prevented by*: NEX never touches funds, never arranges logistics, multi-currency is sealed-deferred. · *NEX instead*: `shipping_scope` enum (local / domestic / export / pickup-only) is a disclosure.

6. **Dispute arbitration / platform refunds.** · *Prevented by*: NEX never holds funds; nothing to arbitrate. · *NEX instead*: Community Notice doctrine handles abuse; payment disputes between buyer, seller, and payment path's own protection.

7. **Multi-currency pricing on a listing.** · *Prevented by*: sealed money doctrine (IDR, ×100 sen). FX service deferred. · *NEX instead*: `currency` column exists but IDR enforced at launch.

8. **Auction with proxy bidding / time extensions.** · *Prevented by*: `pricing_mode='auction'` is in the enum but no auction engine exists. · *NEX instead*: honour `auction` as a *label* only, with chat-based bidding. **May need to be deferred from launch copy** to avoid an unimplemented-claim issue (same pattern as "cancel any time" and "verified badge" in Package Contract DRAFT P1–P3).

9. **Watch-reference wiki pages / editorial content pages.** · *Not applicable at launch*: Hodinkee's moat is a decade of editorial work. · *NEX instead*: sellers tell the story in `description` and `provenance_note`.

10. **Pre-filled authenticity "Verified by NEX".** · *Prevented by*: no NEX verification process. · *NEX instead*: display `authenticity` as *seller-asserted*; SafeTrade is the independent verification path.

---

## 5 · NEX-specific moats

1. **NEX-handle identity + persistent chat.** Buyer and seller already have accounts, personas, chat rail. No "message a stranger via a form" friction.

2. **SafeTrade primitive.** Documented, positioned as the trust mechanism without NEX holding funds. For watches, SafeTrade is a near-perfect fit — luxury watch buyers already pay for third-party authentication.

3. **Sealed Universal Image Doctrine.** Seller-uploaded photos tagged as `OWNER_IMAGE` with origin allowlist already enforced via `watch-image-origin.ts`. No category-level stock-photo bleed.

4. **G3 directory-tile uniqueness amendment.** A paid-individual watch listing gets its own tile — same real estate as a shop. For private-seller trust, equal-tile treatment is a buyer trust signal.

5. **Honest entitlement window.** "Listed until {date}" is public on the listing. Transparency about recency is a trust lever for buyers worried about stale listings.

6. **Sealed universal keypad.** Every field uses the sealed NEX keypad. Consistent entry experience without OS keyboard switch.

7. **Shopless individual sellers (§8h sibling-table).** Private sellers can list without owning a shop. Direct advantage over Watchfinder/Bezel/Watch Box (dealer-only).

8. **Live-commerce integration.** `WatchOverlayCaption` + Live broadcast provides a video-first product discovery format. Chrono24 doesn't have a native live-video channel.

9. **Honest "NEX does not intermediate" copy.** Already shipped on the listing page. Most marketplaces can't make this statement without rewriting their terms.

---

## 6 · Minimum viable watch marketplace (Phase 1)

**Mandatory fields at publish** (Level-1 Essential tier):
- `brand`, `model_name`, `watch_type`, `movement`, `condition`, `price_pence` + `pricing_mode`, `cover_image_url`, `description`

**Required trust signals at launch**:
- `authenticity` disclosed as seller claim (not "Verified by NEX").
- `seller_type` disclosed.
- `packaging_items` disclosed.
- `shipping_scope` disclosed.
- SafeTrade CTA visible on every listing.
- Honest "Listed until {date}" chip.
- Honest "NEX does not intermediate payment" copy.

**Supported payment paths**: COD, bank transfer, QRIS, in-person, SafeTrade. NEX writes zero code to process money.

**Discovery patterns at launch**:
- Public `/watches` index with real tsvector + GIN search.
- Public listing detail.
- Directory tile projection via `watch_listing_directory_v` (price-filtered; chat-mode listings excluded).
- "My listings" surface for owners (verify shipped — see §9 Q3).

**Launch readiness checklist**:
- Migrations 227–230 (+231, +232) applied to `ijvqdvsvwtwxzcqmoqit` under explicit owner approval.
- DEV_PAYMENT mock guard verified disabled in production env.
- Payment-provider decision for `provider` field (manual at launch is honest).
- Admin-facing manual-reference workflow for `provider='manual'` (per Package Contract DRAFT D1 Option B).
- Verify every piece of public copy satisfies the sealed Service Principle DRAFT.

---

## 7 · Design patterns we should NOT invent (deferred)

| Pattern | Why deferred |
|---|---|
| Multi-currency pricing | Sealed money doctrine. FX service unscheduled. Would create an unimplemented-claim. |
| International shipping calculator | NEX does not arrange logistics. |
| In-house certified-pre-owned program | NEX is a marketplace, not a dealer. |
| Dispute arbitration | NEX never holds funds; nothing to arbitrate. |
| In-app structured offers | NEX does not intermediate price; chat is the surface. |
| Verified-authenticity badge issued by NEX | No verification process. Package Contract DRAFT P1 "verified badge DEFER" applies. |
| Auction mechanics | `pricing_mode='auction'` is a label, not an engine. Not advertising "auction" at launch recommended. |
| Reference wiki / editorial pages | Decade of editorial work. Out of Phase 1. |
| Fair-value / market-value estimates | No licensed data source. |
| Platform-wide seller reputation score | Would require algorithm + dispute input + governance. |
| Favorite / wishlist persistence | "Deferred by design" per listing-page comment. |

---

## 8 · Three viable implementation approaches

### Approach A · "Verify + Ship" (minimal)
- **Scope**: apply migrations 227–230 + 231 + 232. Verify every shipped surface against production RLS. Add "My Listings" owner surface if not yet shipped (§9 Q3). Verify `pending_watch` chat context card renders. Ship SafeTrade CTA on each listing hero. Audit launch copy against Service Principle DRAFT. No new features.
- **Timeline**: 1–2 weeks + owner-approved offline windows.
- **Risk profile**: lowest.
- **Trade-off**: honest, shippable, modest.

### Approach B · "Verify + Lean on Live-commerce" (RECOMMENDED)
- **Scope**: everything in A, PLUS wire listings to Live-commerce overlay (`WatchOverlayCaption`) via explicit opt-in in the upload flow. Add a "Share to chat" affordance for sellers to push listing cards into any peer or group chat. Verify directory-tile projection on landing feed. Add a lightweight SafeTrade "Request inspection" button that opens a prefilled chat with SafeTrade.
- **Timeline**: 2–4 weeks.
- **Risk profile**: medium.
- **Trade-off**: lands with a visible NEX differentiator (video-first) + visible trust lever (SafeTrade button).

### Approach C · "Verify + Add trust layer" (ambitious)
- **Scope**: everything in B, PLUS a lightweight seller-reputation surface, "verified-dealer" badge issued by a *real* owner-signed verification workflow, admin "manual payment-reference confirmation" UI.
- **Timeline**: 4–8 weeks.
- **Risk profile**: higher. Reputation surface risks fabrication; verified-dealer workflow needs operational process.
- **Trade-off**: closest to a world-class marketplace at launch, but adds operational commitments NEX may not want to run yet.

**Recommendation: Approach B.** Respects sealed scope, leans on existing moats, avoids unimplemented-claim risks.

---

## 9 · Open questions for the founder

**Q1 · Payment-provider decision for the listing fee.** The code supports `manual / xendit / midtrans / other`. Launch default is `manual`.
- *Options*: (a) stay `manual`, build admin confirmation UI; (b) wire xendit; (c) wire midtrans; (d) defer launch.
- *Recommendation*: launch with `manual` + admin UI.

**Q2 · Should `pricing_mode='auction'` be visible to sellers at launch?** The enum exists; the engine does not.
- *Options*: (a) hide at launch; (b) show with "Chat-based auction — bids happen in chat"; (c) build the auction engine.
- *Recommendation*: (a) — hide until an auction doctrine is authored.

**Q3 · Is the "My Listings" owner surface shipped?** Service layer has `listMyWatchListings`, but a dedicated owner-facing route was not verified in this inspection pass.
- *Options*: (a) ship `/manage/watches` or `/manage/watches/mine` as Phase 1; (b) defer.
- *Recommendation*: (a) — table-stakes for a marketplace.

**Q4 · SafeTrade contact flow for watches.** Today `/safe-trade` is an editorial explainer.
- *Options*: (a) "Request SafeTrade inspection" button on each listing → prefilled chat to a SafeTrade NEX account; (b) form on SafeTrade page; (c) link only.
- *Recommendation*: (a) — chat intent, no form, no transactional UI. Verify there is a real SafeTrade recipient account first.

**Q5 · Marketing copy on `/watches` public index.** The current index is functional; it lacks a one-screen trust story.
- *Options*: (a) add short editorial header matched to SafeTrade; (b) leave as pure index; (c) copy from SafeTrade verbatim.
- *Recommendation*: (a) — brief header matched to Service Principle DRAFT language.

---

## 10 · Research sources + knowledge cutoff

**External sources (prior knowledge, cutoff 2026-01)**: Chrono24, WatchCharts, Hodinkee Shop, eBay watches, Watch Box / Bezel / Watchfinder, Grailed. Product knowledge not independently re-verified in this pass.

**NEX-internal sources (verified)**: doctrine files + service layer + migrations + UI routes as cited in §0.

**What was NOT independently verified**: competitor fee structures / specific stats, `pending_watch` chat context card rendering end-to-end, dedicated "My Listings" owner-facing route shipped status, SafeTrade real recipient account existence, migrations 231–232 service-layer wiring end-to-end, `_watches-browser.tsx` search behaviour.

**Knowledge cutoff disclosure**: Opus 4.7 training cutoff is 2026-01. Any marketplace change after that date — new Chrono24 features, new eBay authenticity thresholds, new Indonesia marketplace-facilitation regulatory frameworks — not reflected here and should be re-checked before locking any public copy.

---

*End of brief. Research-only. No code was changed. No files were created apart from this doctrine document. Repository state is unchanged.*
