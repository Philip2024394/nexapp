# NEX Shop Entitlement Contract — DRAFT

**Status:** DRAFT — AWAITING OWNER SIGN-OFF 2026-11-06
**Author:** Claude (compiled from sealed memory + on-disk doctrine + phase-v P1–P24 commit history)
**Branch:** `phase-x/scope-reduction-chat-themes-shop-vault-2026-11-06`
**Date:** 2026-11-06
**Blocks:** Any Stripe code touching the repo for Shop membership · any Phase 2 flow work on `/nex-native/shop/*` · any public Shop package copy
**Supersedes:** nothing (first Shop-specific entitlement contract; references Package Contract DRAFT 2026-10-20 and Vault Entitlements Policy LOCKED 2026-10-20)

> **What this draft IS:** a proposal defining exactly what the Shop monthly membership unlocks, how post-payment behaves, and what happens on trial / cancel / grace, so the owner can sign off BEFORE Phase 2 flow work or Stripe code ships.
>
> **What this draft is NOT:** a lock. Nothing in this file authorises a migration, a Stripe integration, a schema write, a flow change, or any customer-facing claim. Every § header carries the DRAFT marker so the owner can accept, amend, or reject row-by-row.

---

## Governing doctrine this contract honours

1. **NEX Stripe entitlement-contract-first rule (owner-sealed 2026-11-05):** "Stripe (or any payment gateway) must NOT be built ahead of clearly defined entitlements and post-payment behaviour." This file IS the gate that rule names.
2. **Package Contract DRAFT 2026-10-20 operating rule:** "Sell clear benefits. Enforce entitlements on the server. Verify the customer experience. Never promise a feature simply because it appears in a design or database."
3. **NEX never handles payments doctrine (preserved):** NEX membership payments are NEX's business; shop-to-buyer product payments belong entirely to the seller. Phase V P10 made the boundary STRUCTURAL via `nex-membership-billing-service.ts` + `payment-connection-service.ts` physical module split. This contract scopes NEX membership billing ONLY — it does NOT cover buyer→seller product payments.
4. **Vault Entitlements Policy LOCKED 2026-10-20:** the eight B-row decisions bind Shop because Vault is bundled with Shop membership under the new scope. Any Vault copy or enforcement carried by Shop MUST honour the locked B1–B8 and the four verification prerequisites.
5. **"Same story" principle (sealed 2026-10-21):** welcome card + pricing page + signup flow + billing MUST tell the same story. Three unlocks (price approved · trial auto-fires or discloses · retire welcome-trial guards together) apply before "7 days free, then [price]" may ship anywhere.
6. **Social Commerce D1–D4 (sealed 2026-11-01):** Stripe Checkout per-transaction + ledger-only · Package Contract DRAFT resolution first · shop entity = `nex_business` + theme + cover (no `nex_shop_template` table) · legal review separate workstream.
7. **Daily Discovery doctrine (sealed 2026-11-05):** direction approved, Phase B migration NOT authorised. Shop membership listing in this contract treats Daily Discovery as a FUTURE entitlement subject to that phase's separate authorisation.

---

## § A · Product one-liner · DRAFT

**Shop membership is a recurring monthly (or annual) NEX subscription that unlocks one seller's public shop surface on NEX — their own business page, theme + cover, products, directory listing, cross-shop discovery exposure, and a bundled Vault for business files — with buyer money flowing directly to the seller's own payment provider at 0% commission to NEX.**

(One sentence, as requested. Captures: recurring · one seller · public shop · bundled Vault · 0% commission on buyer money. Everything else in this contract is detail.)

---

## § B · Price proposal · DRAFT — must be validated with real customers before hard-coding

### B-1 · Reference price anchor (per launch pricing memory 2026-10-20)

**USD anchor (DRAFT):** US$9.99/month OR US$99/year (~17% annual saving).

Annual is prepaid once, prominently recommended with the saving disclosed honestly. Monthly is the comparison. Single Shop tier at launch — the sealed rule "launch with ONE Business package" is preserved.

### B-2 · Twelve regional reference prices (DRAFT · from launch pricing 2026-10-20)

| Market | Monthly | Annual | Annual saving |
|---|---|---|---|
| United States | $9.99 | $99 | 17% |
| Eurozone | €9.99 | €99 | 17% |
| United Kingdom | £8.99 | £89 | 17% |
| Australia | A$14.99 | A$149 | 17% |
| Canada | C$13.99 | C$139 | 17% |
| Singapore | S$12.90 | S$129 | 17% |
| Malaysia | RM29.90 | RM299 | 17% |
| Indonesia | Rp49,000 | Rp490,000 | 17% |
| India | ₹199 | ₹1,990 | 17% |
| Philippines | ₱299 | ₱2,990 | 17% |
| Thailand | ฿199 | ฿1,990 | 17% |
| Japan | ¥980 | ¥9,800 | 17% |

**DRAFT — must be validated with real customers before hard-coding into any payment-provider integration.** Per the sealed "prices are a PROPOSAL" rule and per the Package Contract DRAFT operating principle. The customer-visible price is the AMOUNT PAID — NEX net revenue is after payment-provider fees + VAT/GST + refunds + currency conversion + infrastructure + Vault storage. Margins must be calculated separately before launch.

### B-3 · Country / IP detection at create-account (DRAFT requirement)

Country / market detection is required at create-account so the user sees local-currency pricing from the first touch:

- Capture user's country via Vercel/Cloudflare geo header + Accept-Language hint + explicit user confirmation.
- Persist as `nex_account.country_iso2` (sealed as S2 slice · migration not yet authorised).
- Display prices in user's local currency with final price + applicable taxes BEFORE purchase.
- User may override detected country at purchase time (storefront rule).

### B-4 · Note on sub-launch bespoke / custom

Bespoke themes remain **separately priced per project** (Rp 1,000,000 reference), unchanged by this contract. This contract covers ONLY the monthly Shop membership. Chat Themes one-time purchases (US$3.99 reference, 12 regional prices) are a separate product line governed by launch pricing 2026-10-20.

---

## § C · Entitlements unlocked · DRAFT

Numbered list. Each item: one-line description + server-side authority marker. Enforcement gaps flagged for Phase 2 work.

### C-1 · Shop surface itself
**What:** Ability to create, name, and publish a `nex_business` row with products, served at `/nex-native/{slug}`.
**Authority:** `nex_business` (sealed table) + `updateBusinessDisplayNameAction` (phase-v P1 · `1becac5`) + public page `[businessSlug]/page.tsx`.
**Status:** IMPLEMENTED (phase-v P1).
**Gate needed:** MISSING — no column currently restricts publication to paid members. Phase 2 must add membership check.

### C-2 · Shop theme + cover customisation
**What:** Select one of 11 sealed cover-layout templates + apply chat theme accent to shop page. Live mini-phone preview in picker.
**Authority:** `nex_business_theme` (migration 195) + `nex_business_theme_cover_override` (migration 212) + `updateBusinessCoverLayoutAction` + `MiniPhoneFrame` preview (phase-v P2 · `9f670f2`, P7 · `11715f4`, P8 · `e99ed2e`).
**Status:** IMPLEMENTED (phase-v P2, P7, P8). All 11 templates currently free; premium/paid-tier gating is deferred per Package Contract DRAFT D1.
**Gate needed:** MISSING — Phase 2 must decide whether all 11 templates ship free with Shop membership (likely) or whether premium templates are separate upgrades (unlikely — one Shop tier at launch).

### C-3 · Shop URL + share chip
**What:** Public `/nex-native/{slug}` URL; one-tap share chip on seller's own shop AND on public shop view. Clipboard fallback. Live state (Share / Copied / Copy failed).
**Authority:** `_floating-share-chip.tsx` (phase-v P12 · `e351a16`), `/manage/shop` share button (phase-v P5 · `948f5de`), `/{slug}/{productId}` product share (phase-v P11 · `909832a`).
**Status:** IMPLEMENTED (phase-v P5, P11, P12).
**Gate needed:** URL already public to everyone; rename never touches the slug (P1). No membership gate required on share itself — it's a passive capability.

### C-4 · Avatar shop badge on profile
**What:** Clickable circular Shop button at bottom-right of avatars (36% diameter, cyan rim, shopfront glyph), rendered on contact rows + on `/profile/[handle]` 128×128 hero. Routes to seller's `/nex-native/{slug}`.
**Authority:** `AvatarShopBadge.tsx` (phase-v P15 · `e175453`, P18 · `b5220fd`).
**Status:** IMPLEMENTED (phase-v P15, P18). Renders only when owner has a published shop with resolvable `shopHref`.
**Gate needed:** Membership-aware `hasShop` resolution — Phase 2 must ensure a lapsed member's avatar does NOT render the badge (currently the badge keys off presence of a published `nex_business` row, not off membership status).

### C-5 · Cross-shop product discovery feed
**What:** Product-first discovery surface at `/nex-native/directory/new` listing recent live products across all shops (inner-join `nex_business` for slug + display_name). 48-item default limit. Fail-soft read.
**Authority:** `product-service.ts :: listRecentLiveProducts()` + `directory/new/page.tsx` (phase-v P13 · `dd5a5a5`) + "What's new on NEX" entry point from sealed directory landing (P14 · `0b3fd5b`).
**Status:** IMPLEMENTED (phase-v P13, P14) for the FEED itself. Current ordering is `created_at DESC` not `discovered_at` — must switch per sealed Daily Discovery doctrine 2026-11-05 (direction approved, migration NOT authorised).
**Gate needed:** MISSING — Phase 2 must ensure only paid-member shops surface products in this feed. Currently keys off `status='live'` alone.

### C-6 · Social preview metadata for shop + product pages
**What:** Per-page `generateMetadata()` on shop + product URLs producing proper Open Graph + Twitter preview cards when pasted into WhatsApp / Instagram / Facebook / X / Discord. Fallback order shop_cover_image_url → logo_url → chat_theme.hero_image_url → sealed banner. Robots noindex when slug unknown.
**Authority:** `[businessSlug]/page.tsx` + `[productId]/page.tsx` generateMetadata (phase-v P22 · `efdfdee`).
**Status:** IMPLEMENTED (phase-v P22).
**Gate needed:** Currently keys off slug resolution; a lapsed member's cached social share should degrade honestly. Phase 2 should confirm noindex behaviour for membership-lapsed slugs matches policy in § E below.

### C-7 · Directory listing
**What:** Shop appears in `/nex-native/directory` (the sealed canonical NEX Directory — business-first discovery). Twelve directory slots per Business account + featured placement per `thumbnail-entitlement.ts:173` (verified by Pricing Baseline audit 2026-10-20).
**Authority:** `src/lib/nex-native/directory/thumbnail-entitlement.ts` (tier-gated at `:172-173`).
**Status:** IMPLEMENTED (pre-phase-v). Already tier-gated server-side per Pricing Baseline audit.
**Gate needed:** CONFIRM Phase 2 — verify tier-gating ties to Shop membership state once Shop membership schema exists (§ G).

### C-8 · Daily Discovery product-of-day entry
**What:** One new product per shop per UTC day may enter NEX-wide discovery (NEX Live + `/directory/new` + search) via `nex_product.discovered_at`. Shop catalogue remains unlimited; discovery is the controlled window into it.
**Authority:** Sealed direction only. Migration (new `discovered_at` column + SECURITY DEFINER RPC + idempotency table) is NOT YET AUTHORISED — awaits phase-u merge per Daily Discovery doctrine 2026-11-05.
**Status:** UNIMPLEMENTED — needs Phase 2+ work and separate authorisation per sealed doctrine.
**Gate needed:** Entire feature pending. Shop membership contract CAN reserve this as an entitlement (owner decision), but may not advertise it to customers until the Phase B migration is applied and verified.

### C-9 · Vault bundled with Shop membership
**What:** 5 GB total storage (B1) · 50 MB per file = 50,000,000 bytes decimal (B2) · retain while subscription + account active (B3) · 30-day read-only grace on lapse (B4) · 7-day trial + 30-day read-only/download grace per Vault B5 · trial ≠ Business separation (B8).
**Authority:** Vault Entitlements Policy LOCKED 2026-10-20 (eight B-row decisions). No W1–W12 work scheduled — all enforcement gaps enumerated in § H.
**Status:** POLICY LOCKED · ENFORCEMENT NOT IMPLEMENTED. The broken `vault_tier` scaffolding at `vault-service.ts:9-35` references a column that no migration defines. Must either add the column (W3) or delete the scaffolding before any claim.
**Gate needed:** W1 (storage-cap enforcement), W2 (per-file size enforcement at upload boundary), W3 (`vault_tier` column + rewire), W4 (grace-period scheduler with six-pre-condition fail-safe deletion gate), W5 (download-everything ZIP endpoint — does NOT exist today), W7 (fix misleading intro copy "100% PRIVATE" / "Always Available"), W10 (technically-honest audit log), W12 (verify sealed Phase A.6 legacy-migration runner). **Every one of these is a HARD prerequisite before Shop membership may advertise Vault beyond the sealed §D default position of OMISSION.**

### C-10 · Package Contract DRAFT claims — current enforcement status

These were on `/packages` as of 2026-10-20 pricing baseline audit. Each is either defer-and-remove or build-to-enforce before Shop membership may list it.

| Claim | Current state (per Pricing Baseline 2026-10-20) | Status for this contract |
|---|---|---|
| **Verified business badge** | Advertised on `/packages:482-486` + `/settings/tier:482`. No `is_verified` / `verified_at` column. No badge-render component. No tier gate. | **UNIMPLEMENTED** — Package Contract DRAFT P1 defers. Shop contract MAY NOT list this entitlement until schema + enforcement + display exist. |
| **20 boosted messages per month** | Advertised on `/packages:506-509`. No `boosted_message` table, no quota counter, no enforcement code. | **UNIMPLEMENTED** — Package Contract DRAFT P2 defers. Shop contract MAY NOT list this entitlement until quota system exists. |
| **Cancel any time** | Advertised on `/settings/tier:486`. Admin-only cancel path via `adminSetAccountTierAction`. No customer-facing cancel UI. | **UNIMPLEMENTED (customer-facing)** — Package Contract DRAFT P3 defers until cancel process + state machine + email notifications exist. § F below proposes the customer-facing design, but it is a Phase 2 build item. |
| **CSV export** | Session-only · NOT tier-gated per Pricing Baseline audit. | **AMBIGUOUS** — either gate it in code AND advertise, or neither. Owner decides. Recommend defer. |
| **International visibility** | Tier-gated at `thumbnail-entitlement.ts:172-173`. | **IMPLEMENTED** — safe to list as Shop entitlement once membership state wires to the tier check. |

### C-11 · Business theme choice + shareable bio link

Existing Business entitlements that already carry server-side authority:

- Business theme choice or approved custom theme (per Package Contract DRAFT D1 scope).
- Shareable NEX bio link (`/nex-native/bio/[nex_handle]`).
- Customer chat and supported business features.

**Status:** IMPLEMENTED (pre-phase-v). Safe to list.

---

## § D · Post-payment behaviour · DRAFT

Describes what happens on the FIRST successful Stripe Checkout session for a new Shop membership. Repeat/renewal events (monthly rebill, annual rebill) are mechanically simpler and share the same idempotency + webhook contract.

### D-1 · What record gets written

**Proposal (DRAFT — schema not yet applied):** two write locations, both idempotent.

1. `nex_account.shop_subscription_id text NULL` — Stripe `cus_...` / `sub_...` identifier for the subscriber account (exact shape TBD). Written on first successful checkout.
2. `nex_business.membership_active boolean DEFAULT false` + `nex_business.membership_period_end timestamptz NULL` + `nex_business.vault_tier text NULL CHECK (vault_tier IN ('none','shop'))` — status on the specific shop entity. Written synchronously from the Stripe webhook handler.

**No new `nex_shop_template` table** (sealed Social Commerce D3). Shop entity remains `nex_business` + theme + cover.

**Ledger line** (per Social Commerce D1): `nex_ledger_entry` + `nex_ledger_line` capture the economic event. No `nex_wallet` / `nex_balance` / stored-value table.

**Scaffold to verify (Phase 2):** phase-v P4 (`8c38b9a`) and P9 (`5957a1b`) and P10 (`45691d1`) already distinguish NEX membership billing from seller-owned shop-payment connections. Phase 2 must grep those commits for any partial membership-record scaffold and reconcile with this contract.

### D-2 · What the user sees next

**Proposal (DRAFT):** redirect to `/nex-native/manage/shop` with a success banner, NOT to a generic `/packages/success`. Rationale: the membership exists to activate THIS seller's shop, so dropping them into the shop-manage surface honours the mental model.

If the user has not yet filled shop name / theme / cover / first product, the manage surface already carries the setup prompts (phase-v P2, P7, P8).

Alternative: `/nex-native/shop/setup` as a first-run wizard. Owner chooses — see § I.

### D-3 · When entitlements activate

- **Synchronous activation on Stripe webhook** — `checkout.session.completed` + `customer.subscription.created` / `.updated` events write `membership_active=true` and `membership_period_end=<period end timestamp>` within one DB transaction.
- **Idempotent** — a Stripe idempotency key + a `nex_stripe_event_id` unique constraint on the ledger line prevents duplicate activation on webhook retry.
- **Retry policy** — Stripe retries failed webhooks per their standard schedule. NEX webhook handler MUST be safe to retry: all writes in a single transaction, failures logged to `nex_webhook_event_log` (new table TBD in § G), no side-effects outside the transaction.
- **Entitlement reads** — all § C enforcement points read `nex_business.membership_active AND (membership_period_end IS NULL OR membership_period_end > now())`. A single helper (`src/lib/nex-native/shop-entitlement.ts` — proposed, not yet created) returns a typed `ShopEntitlement` object so callers never reconstruct the logic.

---

## § E · Trial + grace · DRAFT

### E-1 · Trial design (DRAFT · mirrors Vault B5)

- **Length:** 7 days.
- **One trial per NEX account** (not per `nex_business` — an account with multiple shops uses the trial once).
- **Scope:** full Shop membership, including bundled Vault (because Vault IS the point of Shop membership).
- **Activation:** mandatory acknowledgement checkbox before trial starts, matching Vault B5 F4 requirement: *"I understand my Vault files will be deleted on [day-37 date] if I don't subscribe."*
- **Auto-fire vs disclose:** per sealed "three unlocks" principle 2026-10-21, until the trial actually auto-fires on business signup, the welcome card MUST either (a) disclose exactly where the trial starts, or (b) offer "See all plans →" and `/packages` instead. "7 days free" copy is forbidden on welcome until the trial wires.

### E-2 · Grace design (DRAFT)

**On subscription lapse (missed renewal OR explicit cancel reaching period end):**

- **Days 0–30:** `vault_access='read_only'` AND `membership_active=false` AND shop remains publicly visible for buyers (see E-3 for exact meaning).
- **Day 30:** final state transition per E-4.
- **"Cancel any time"** (Package Contract DRAFT P3 claim): grace begins when the user cancels, running to period-end. This matches Stripe's "cancel at period end" standard. Immediate-cancel-with-refund is NOT proposed — per standard SaaS pattern, the user keeps paid access until period-end.

### E-3 · What "read-only grace" means for Shop (DRAFT · explicit)

**Shop surface behaviour during grace:**

- Shop IS visible to buyers at `/nex-native/{slug}`. Rationale: a lapsed member's buyers should still be able to find them and reach them; abruptly hiding a shop punishes buyers for the seller's lapse.
- Existing products stay live (`status='live'`). Customers can still view them.
- NEW product creation: BLOCKED. Attempting to upload returns 402 Payment Required with a renew prompt.
- Shop editing (name, theme, cover, logo): BLOCKED. Changes require active membership.
- Daily Discovery entries (per C-8): BLOCKED. No new `discovered_at` writes during grace. Existing discovery entries age out naturally.
- Cross-shop discovery feed (C-5): BLOCKED. Seller's products stop appearing in `/directory/new` on day 0 of grace.
- Avatar shop badge (C-4): HIDDEN on day 0 — the lapsed state is NOT a "has a shop" state for discovery purposes.
- Directory listing (C-7): HIDDEN on day 0 — same rationale as C-5.

**Vault surface behaviour during grace:** per Vault B4 — `vault_access='read_only'` at day 0, download-everything endpoint reachable (NOTE: W5 must exist before any destructive expiry — endpoint does NOT exist today), day 20 reminder, day 30 deletion GATED by six-pre-condition fail-safe deletion gate.

### E-4 · What happens AFTER grace expires (day 30 · DRAFT)

**Shop:**

- `membership_active` stays `false`. Shop hidden from `/directory` and `/directory/new`.
- Public `/nex-native/{slug}` URL: proposal is to render a "This shop is no longer active" page with a `Contact seller directly` CTA (NEX chat) rather than 404 — preserves social-media-shared shop links that already exist in the wild.
- `nex_business` row RETAINED (data preservation); products `status` flipped to `'archived'` (reversible if the owner resubscribes).

**Vault:**

- Vault B4 day-30 deletion scheduled, GATED by the six-pre-condition fail-safe deletion gate from Vault B4. Day 30 deletion CANNOT run until W4 + W5 + W9 + W10 + W12 all exist AND tested. Until those exist, no customer's Vault files are destroyed on membership lapse — files remain in storage, access is simply revoked.

**Account:**

- NEX account itself is UNAFFECTED. Chat Themes owned, friends, chat history remain. This matches Vault B4 day-30 explicit rule.

---

## § F · Cancel / downgrade / restore · DRAFT

### F-1 · Cancel

**Recommendation:** **cancel at period end + immediate-flag-stop-renewal** (Stripe standard).

- On customer self-cancel, Stripe `cancel_at_period_end=true` is set.
- `nex_business.membership_period_end` retains its existing value — user keeps paid access until that date.
- On period end, grace flow from § E-2 begins.
- Customer receives email: *"Your Shop membership will end on [date]. Your Vault files are safe for 30 days after that — [Renew] [Download everything]."*
- `nex_business.membership_cancel_requested_at timestamptz NULL` added (§ G) so the state is inspectable in UI banners.
- Immediate-cancel-with-prorated-refund is NOT proposed at launch; owner may add later.
- **Advertisement rule:** "Cancel any time" copy stays BLOCKED (per Package Contract DRAFT P3) until this flow exists with customer-facing cancel UI, state machine, and email notifications verified end-to-end.

### F-2 · Downgrade

**NOT APPLICABLE** — only one Shop tier at launch (sealed "launch with ONE Business package" rule). This row remains for symmetry.

### F-3 · Restore (resume subscription within grace)

- User clicks `[Renew]` on banner / email during days 0–30 grace.
- Stripe checkout opens → resubscribe → webhook writes `membership_active=true` + new `membership_period_end`.
- `vault_access` flips back to full on next unlock.
- No new shop setup required — all data preserved.
- Products previously set to `'live'` stay `'live'`; nothing had been archived yet (archive happens only at day 30).

### F-4 · Permanent closure (never resubscribed · day 30+)

- Data retention policy: `nex_business` row RETAINED but `membership_active=false` indefinitely. Products `status='archived'`. Vault data destroyed at day 30 per Vault B4 (subject to fail-safe gate).
- GDPR / DAC7 / DSA intersection: per sealed Social Commerce D4, legal review is a SEPARATE workstream that blocks PUBLIC Ireland launch, not dev. This contract defines the proposed retention; actual production release gated on counsel sign-off covering:
  - DAC7 (platform reporting of seller tax info)
  - DSA (Digital Services Act takedown + transparency)
  - PSD2 (payment services — scope of NEX's handling)
  - Irish consumer protection + distance-selling disclosure
  - GDPR (data-deletion right vs retention obligation under tax law)
- Account-level deletion (user hard-deletes NEX account): existing `ON DELETE CASCADE` on vault tables (migration 141) handles vault rows; storage-bucket cleanup gap documented in Vault W9.

---

## § G · Schema requirements · DRAFT (LIST ONLY — NOT AUTHORISED FOR WRITE)

Each row below is the proposed schema addition to enforce § C–§ F. No migration is authorised by this contract. Owner must separately approve a numbered migration (next sequential after phase-u migration 281 per the task brief; latest on phase-x worktree is 256, so phase-u merge is a prerequisite).

| Table | Column / change | Purpose |
|---|---|---|
| `nex_account` | `shop_subscription_id text NULL` | Stripe customer/subscription identifier for this account. |
| `nex_account` | `country_iso2 text NULL CHECK (country_iso2 ~ '^[A-Z]{2}$')` | Country persistence at account creation. Per sealed S2 slice (migration 213 proposed, NOT yet applied). § B-3 depends on this. |
| `nex_account` | `vault_tier text NULL CHECK (vault_tier IN ('none','shop'))` | **FIXES SEALED PRICING BASELINE GAP** — Vault code at `vault-service.ts:9-35` references this column but no migration defines it. W3 in Vault LOCKED. Must be either added OR the broken scaffolding deleted. |
| `nex_business` | `membership_active boolean NOT NULL DEFAULT false` | Primary entitlement gate for Shop surface. All § C reads check this. |
| `nex_business` | `membership_period_end timestamptz NULL` | When the current paid period ends. Grace flow § E-2 keys off this + current time. |
| `nex_business` | `membership_cancel_requested_at timestamptz NULL` | Set when customer requests cancel (F-1). Powers in-app "your membership ends on [date]" banners. |
| `nex_business` | `membership_trial_used_at timestamptz NULL` | One trial per account rule (E-1). Aligns with existing `themes_trial_used_at` pattern — do not invent a parallel trial framework. |
| `nex_product` | `discovered_at timestamptz NULL` + partial UNIQUE index on `(business_id, ((discovered_at AT TIME ZONE 'UTC')::date))` WHERE `discovered_at IS NOT NULL` | Daily Discovery per sealed doctrine 2026-11-05. Column immutable after publication. Shop-level limit (owner_account_id enforcement). |
| `nex_product` | On archive: `status='archived'` retains `discovered_at` | Prevents archive-and-recreate bypass per Daily Discovery rule 4. |
| NEW `nex_webhook_event_log` | `event_id text PRIMARY KEY, event_type text, received_at timestamptz, processed_at timestamptz NULL, error text NULL, payload_hash text` | Idempotent Stripe webhook consumption. D-3 reliability. |
| NEW `nex_ledger_entry` + `nex_ledger_line` | Per sealed Social Commerce D1 ledger-only pattern. Schema TBD in a separate ledger-design DRAFT. | Record economic event of each Shop membership charge. NO `nex_wallet` / `nex_balance` / stored-value table. |
| NEW SECURITY DEFINER RPC | `nex_shop_publish_as_daily_discovery()` — template is sealed `nex_music_publish_as_active_slot` migration 236 | Daily Discovery publication (per sealed doctrine 2026-11-05 rule 6). Pins search_path, verifies actor + ownership, scoped EXECUTE. |
| NEW `nex_shop_publish_idempotency` | Analogous to `nex_music_publish_idempotency` migration 236:196-208 | Repeated discovery-publish requests with same key return original outcome, never create a second publication (per sealed doctrine rule 8). |

**Cross-reference (Pricing Baseline sealed 2026-10-20):** the Vault code references `account.vault_tier` but no migration defines it. This is BROKEN SCAFFOLDING. Adding `vault_tier` here is the Vault W3 fix. Must either be applied via the new migration OR the broken reference deleted — the Shop contract decides the former because Vault is now bundled with Shop.

---

## § H · Enforcement checklist · DRAFT · must pass BEFORE any Phase 2 Stripe wiring

Owner ticks each box before Phase 2 Stripe work may start. These are not optional. Each tick must link to one of the four evidence forms from Vault LOCKED 2026-10-20 § E (policy decision · passing test · verified control · accepted residual risk).

- [ ] **B1 · Price validated with real customers** — the twelve regional reference prices in § B remain a PROPOSAL until the owner records validation (customer-discovery interviews, survey, pilot) OR explicitly accepts the proposal as the launch anchor. Per launch pricing 2026-10-20 rule: "Do NOT hard-code them into a live payment provider until the owner explicitly authorises launch with validated prices."
- [ ] **B2 · All § C entitlements have server-side authority** — each entitlement C-1 through C-11 either has an "IMPLEMENTED" row with cited file OR is marked UNIMPLEMENTED and either removed from this contract or scheduled for Phase 2 with evidence.
- [ ] **B3 · Schema in § G applied via a new migration** — owner-approved migration numbered AFTER phase-u migration 281 (phase-u merge is a prerequisite). Migration includes `nex_account.country_iso2`, `nex_account.shop_subscription_id`, `nex_account.vault_tier`, the four `nex_business` membership columns, `nex_product.discovered_at`, `nex_webhook_event_log`, and the discovery RPC + idempotency table. NOT AUTHORISED by this contract — separate per-slice authorisation required.
- [ ] **B4 · Trial auto-fire or disclosure wiring agreed** — per sealed 2026-10-21 three-unlocks rule: either the 7-day trial auto-fires on business signup OR the welcome card discloses exactly where the trial starts. Current state: `startThemesTrial` is one-shot, signup deliberately leaves it UNTOUCHED. Advertising "7 days free" without one of these two options is misrepresentation.
- [ ] **B5 · Welcome card copy aligned to final price + trial semantics** — same-story principle. Welcome card + `/packages` + signup flow + billing emails MUST all say the same thing. Welcome-trial-copy guards (G-D4-1 / G-D4-3 / G-D4-4) + welcome-honesty G4 commerce-phrase guards are retired in the SAME commit that ships the approved copy, not before.
- [ ] **B6 · Vault B6 "omit encryption copy" respected** — per Vault LOCKED B6, all public-facing Shop package copy OMITS encryption / security claims until Vault W12 + W10 + verification evidence land. Default § D of Vault policy: Business card lists identity / customer chat / products / business presence — Vault silent until work-items ship.
- [ ] **B7 · Vault W1–W12 gaps affecting Shop-bundled Vault identified and scheduled** — the Shop contract bundles Vault; a bundled promise that fails on the Vault side is still a Shop lie. Minimum set of W-items that MUST close before Shop advertises Vault bundled:
  - [ ] W1 · server-side storage-cap enforcement (5 GB per shop account)
  - [ ] W2 · server-side per-file-size enforcement (50 MB = 50,000,000 bytes decimal · same literal in UI + API + accounting + tests)
  - [ ] W3 · `vault_tier` column migration (SATISFIED by § G above IF owner approves that migration)
  - [ ] W4 · grace-period scheduler with six-pre-condition fail-safe deletion gate (download succeeded · no legacy rows · bucket cleanup verified · W10 audit write succeeded · day-0+day-20 notifications delivered · no active ops ticket)
  - [ ] W5 · download-everything ZIP endpoint (DOES NOT EXIST TODAY — hard release blocker)
  - [ ] W7 · fix misleading in-product copy on `vault/intro/page.tsx` ("100% PRIVATE" / "Always Available") — NOT contingent on B6; already misleading today
  - [ ] W10 · technically-honest audit log with documented scope limitation (application-layer only; direct DB / Supabase SQL editor OUT OF SCOPE)
  - [ ] W12 · verify sealed Phase A.6 client-side legacy-migration runner line-by-line (migration states · failure handling · retry · partial-migration safety · observability)
- [ ] **B8 · Package Contract DRAFT P1 / P2 / P3 claims resolved** — before Shop membership may list "verified badge" / "20 boosted messages" / "cancel any time", each must EITHER have server-side enforcement built (P1 schema + badge render + tier gate · P2 quota schema + counter + reset rules · P3 customer-facing cancel UI + state machine + emails) OR be explicitly removed from Shop copy. Per Social Commerce D2: "Package Contract DRAFT must be resolved BEFORE Shop Starter/Pro ship."
- [ ] **B9 · Legal review scoped (not completed)** — per Social Commerce D4, DAC7 / DSA / PSD2 / Irish consumer protection / GDPR review is a SEPARATE workstream blocking PUBLIC Ireland launch, not dev. Phase 2 Stripe wiring may proceed in sandbox / preview; public release requires counsel sign-off as a downstream gate. This checkbox confirms the scope is identified and responsibility assigned, not that review is done.
- [ ] **B10 · Daily Discovery Phase B migration separately authorised** — if C-8 is kept as a Shop entitlement, the Daily Discovery Phase B migration per sealed doctrine 2026-11-05 must be separately authorised AND applied AND verified before Shop membership copy may claim "your product reaches NEX-wide discovery daily."

---

## § I · Open questions for owner · DRAFT

Six questions this contract cannot resolve from existing sealed doctrine. Keep short per task constraint.

1. **Annual pricing scope:** does annual tier use all twelve regional proposed prices at launch, or do we launch with USD + GBP + IDR + EUR only (the "core four" markets where NEX has clearest signal) and extend later? The launch pricing memory lists twelve; launching twelve simultaneously multiplies the validation burden by 3×.
2. **Shop-starter-free-tier question:** is there a free Shop tier at all, or is Shop pay-only (membership-or-nothing)? If pay-only (recommended under new scope reduction), what does an unauthenticated visitor see on `/nex-native/shop/create`? Proposal: a wall with pricing preview + "Start 7-day free trial" CTA. Confirm.
3. **Trial activation point:** does the 7-day trial auto-fire on first successful business signup (owner must honour sealed 2026-10-18 "startThemesTrial deliberately untouched at signup" OR consciously retire it), OR does it require an explicit user action ("Start trial" button on the welcome card or `/packages`)? The three-unlocks rule applies either way, but which path Phase 2 builds determines copy.
4. **Permanent-closure shop URL behaviour:** on day-30+ permanent-closure, should `/nex-native/{slug}` render (a) "This shop is no longer active" page with contact CTA (proposal in § E-4), (b) hard 404, or (c) redirect to a `/directory` search for similar businesses? Choice affects SEO + buyer experience of stale social-media shares.
5. **Daily Discovery as explicit Shop entitlement:** is C-8 a listed benefit of Shop membership (recommended — it IS the main NEX-side discovery lever) or is it kept quiet until the Phase B migration applies? Listing it as a benefit before migration is forbidden; the question is whether to reserve it in the contract OR defer entirely.
6. **"NEX membership vs shop payment boundary" copy on the public packages page:** phase-v P10 made the boundary STRUCTURAL in code. Does the public Shop membership card SAY the 0%-commission promise ("NEX takes 0% commission on your sales · ever") or stay silent until buyer→seller cart checkout exists? The promise is honest today (nothing is taken because nothing flows through NEX), but mentioning commission on a page where no buyer→seller product payment yet exists can confuse the mental model.

---

## § J · Open doctrine conflicts · DRAFT

Sealed doctrine this contract touches, with reconciliation notes.

### J-1 · Package Contract DRAFT 2026-10-20

**State:** DRAFT. Nine decisions recorded, not locked.
**Overlap:** D6 "Vault — defer public promotion" vs this contract's § C-9 "Vault bundled with Shop membership". The Package Contract DRAFT says omit Vault from the Business card entirely until W-items ship. This Shop contract HONOURS that by requiring B6 + B7 (§ H) before any Vault-bundled claim ships on public Shop copy, but internally RESERVES Vault as the bundled entitlement so the Shop contract knows what it's selling.
**Proposed reconciliation:** owner either promotes Package Contract DRAFT to LOCKED (D1–D6 + P1–P3 resolved), or accepts that this Shop contract supersedes D6 with the same end state (Vault omitted from public copy until Vault W-items ship). Recommend the former — lock the Package Contract DRAFT in the same review cycle.

### J-2 · Vault Entitlements Policy LOCKED 2026-10-20

**State:** LOCKED (eight B-rows) + four verification prerequisites + W1–W12 unscheduled.
**Overlap:** § C-9 + § E Vault behaviour + § H W-item checklist all cite the locked policy. No conflict — this contract is a DOWNSTREAM consumer.
**Proposed reconciliation:** none required. Shop contract honours lock verbatim.

### J-3 · Service Principle DRAFT 2026-10-20 (referenced in Package Contract DRAFT § 5)

**State:** DRAFT (sealed holds enumerated in NEX Complete Wiring Programme 2026-10-27).
**Overlap:** unknown — this contract does not propose anything that would violate a sealed service principle. Flag for owner review.
**Proposed reconciliation:** owner confirms Service Principle DRAFT does not constrain Shop membership specifically; if it does, surface the specific constraint.

### J-4 · Theme Commerce DRAFT (referenced in sealed holds 2026-10-27)

**State:** DRAFT. Governs Chat Themes one-time purchases separately.
**Overlap:** none — Chat Themes are a separate product line (US$3.99 one-time per theme). Shop contract explicitly does NOT bundle theme purchases. Theme choice within Shop membership is "pick from available themes" per Package Contract DRAFT D1, NOT "buy new themes."
**Proposed reconciliation:** keep separate. Shop contract and Theme Commerce DRAFT govern different products.

### J-5 · NEX never handles payments doctrine (preserved)

**State:** SEALED. Phase-v P10 made it STRUCTURAL via module split.
**Overlap:** this contract ONLY covers NEX membership billing (seller-side subscription). Buyer→seller product payments remain outside scope — they flow directly to the seller's own payment provider at 0% commission to NEX. No conflict.
**Proposed reconciliation:** none required. Explicitly scoped out in § A: "with buyer money flowing directly to the seller's own payment provider at 0% commission to NEX."

### J-6 · Daily Discovery doctrine SEALED 2026-11-05

**State:** direction approved · Phase B migration NOT authorised.
**Overlap:** § C-8 claims Daily Discovery as a Shop entitlement. Doing so advertises a feature whose migration is NOT yet authorised.
**Proposed reconciliation:** owner either (a) authorises Phase B migration separately before any Shop copy lists C-8, or (b) marks C-8 as "reserved, not yet advertised" in the Shop contract and deletes it from any public Shop copy until Phase B lands. See § I question 5.

### J-7 · Social Commerce D1–D4 SEALED 2026-11-01

**State:** SEALED (four decisions).
**Overlap:** D2 "Package Contract DRAFT must resolve BEFORE Shop Starter/Pro ship" is directly load-bearing. Under the NEW scope (single Shop tier, not Starter/Pro), the intent survives: advertise Shop membership only with entitlements that have server-side enforcement. This contract's § H checklist IS the D2 resolution gate.
**Proposed reconciliation:** owner confirms that single-tier Shop membership under scope-reduction satisfies D2 (the intent was "don't advertise unimplemented entitlements"; under single tier the same rule applies).

### J-8 · Pricing baseline 2026-10-20 ("entitlement-contract-first discipline")

**State:** OWNER RULE ("next step is entitlement contract, not code changes or pricing-page redesign").
**Overlap:** THIS CONTRACT IS THE DELIVERABLE that rule names. No conflict.
**Proposed reconciliation:** none required. Submission of this DRAFT for owner sign-off closes the rule's "next step" requirement for Shop specifically.

### J-9 · Welcome card "same story" principle SEALED 2026-10-21

**State:** SEALED. Three unlocks before Business card may show "7 days free, then [price]".
**Overlap:** § B + § E-1 both touch pricing + trial copy. § H checkboxes B4 + B5 enforce the three-unlocks rule.
**Proposed reconciliation:** none required. This contract REINFORCES the principle rather than conflicting with it.

---

## What this DRAFT does NOT do

- Does **not** apply any migration. § G is a LIST, not a write.
- Does **not** schedule Phase 2 Stripe wiring. § H is the gate that must open first.
- Does **not** modify any file under `src/app/nex-native/packages/`, `src/app/nex-native/manage/shop/`, `src/app/nex-native/shop/`, or any Vault surface.
- Does **not** retire any sealed guard, welcome-trial-copy test, or welcome-honesty test.
- Does **not** change existing Rp 99,000/month on `/packages` or the 7-tier IDR ladder at `/settings/tier` — both remain as-is until a separately authorised copy-change pass.
- Does **not** lock any decision. Promotion from DRAFT → LOCKED requires a separately signed owner authorisation (parallel to how the Vault policy was locked on 2026-10-20).
- Does **not** alter the Phase A1 release hold, the Vault Entitlements Policy LOCK, or any of the other sealed holds enumerated in the NEX Complete Wiring Programme 2026-10-27.
- Does **not** authorise the Daily Discovery Phase B migration (per sealed doctrine 2026-11-05 — separate authorisation required).
- Does **not** satisfy the Social Commerce D4 legal review workstream — that remains a separate workstream blocking public Ireland launch.

---

## Approval checkpoint

Owner reviews section-by-section. For each §, the owner may:

- Accept as-is.
- Amend specific rows with owner-authored text.
- Reject and request Claude re-draft with new direction.
- Promote the DRAFT to LOCKED (parallel to the Vault policy lock on 2026-10-20) under a separately signed authorisation message.

No downstream Phase 2 Stripe wiring, no migration application, no public Shop copy change may proceed until the owner explicitly signs off this contract.
