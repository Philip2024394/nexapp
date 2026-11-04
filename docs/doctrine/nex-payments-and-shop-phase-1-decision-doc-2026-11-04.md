# NEX Payments + Shop · Phase 1 Decision Doc

> **STATUS: HOLD · 2026-11-04**
> This doc is the accepted specification baseline. **No implementation permitted** until §G.1 (legal entity + VAT) is resolved and the §G.8 Stripe written confirmations are obtained. All ten §I decisions remain open. Companion prep docs:
> - `nex-g1-legal-entity-vat-questionnaire-2026-11-04.md`
> - `nex-g8-stripe-platform-confirmations-request-2026-11-04.md`

**Status:** Specification only · zero code · zero migrations · zero accounts opened
**Owner directive:** 2026-11-04 · "revise the Phase 1 decision document to include the actual NEX Shop Owner Dashboard, shop templates, product management and buyer checkout experience before authorising SQL or code"
**Honoured sealed doctrine:** NEX never handles payments (funds for creators/shops flow direct to connected Stripe accounts) · 0% commission on Creator earnings · Ireland-only initial rollout · existing 11 sealed cover layouts preserved · existing creator-badges resolver preserved

---

## 0 · What's confirmed · what's open · what's revised in this version

### Confirmed product direction (owner · 2026-11-04)
- One NEX login for Creators and shop owners (no per-shop credentials)
- Self-service shop creation and template selection
- Stripe for NEX's own membership + theme revenue
- Stripe Connect for Creator and shop payments
- No NEX wallet, no NEX-operated escrow
- 0% Creator commission
- Ireland-only initial rollout
- **Provider rule (owner-sealed 2026-11-04 later-same-day):** **NEX itself (the founder-operated platform) uses Stripe only. Users have a choice of Stripe or PayPal (or both) for receiving their money.** This is a hard split:
  - NEX's own revenue (Creator subscription €4.99/mo + €49/yr, theme purchases €3.99) is Stripe-only, through NEX's own Stripe platform account
  - Users' receiving accounts (fan support, sponsorship, shop sales) can be Stripe OR PayPal at the user's discretion, through their own connected accounts
  - PayPal is never positioned as a NEX-side provider. PayPal appears in the UI ONLY on `/settings/payments` as an option for the user to receive money through
  - Any future NEX-side revenue stream defaults to Stripe-only unless explicitly re-opened for owner review

### Still to resolve before build (ten items, reduced from prior list)
1. §F.3 · Shop goods transaction fee: 0% or small flat/percentage
2. §A.4 · Annual Creator membership at launch (€49/yr) alongside monthly
3. §A.5 · PayPal in v1 or deferred
4. §A.6 · Business sponsorship: include in Phase 1D or separate phase
5. §G.1 · Legal trading entity + VAT registration status
6. §B.3 · Trial period for Creator subscription
7. §F.6 · Dispute reserve policy for new shop sellers
8. §F.5 · Shop owner KYC threshold (upfront vs Stripe default)
9. §D.4 · Multi-shop policy (one account → one shop vs many)
10. §E.6 · Guest checkout vs account-required

### Revised from prior version (first audit · 2026-11-04 initial)
- **§A.2 · Charge-model choice: direct charges throughout** (prior version used destination charges · corrected per owner note on dispute liability)
- **§B · Shop Owner Dashboard spec added** (prior version was payment-only)
- **§C · Shop templates section added** (references existing 11 sealed cover layouts · no new templates)
- **§D · Product management spec added**
- **§E · Buyer checkout experience spec added**
- **§F · Order management + dispute handling added**
- **§G · Legal/regulatory section expanded**
- **No "escrow" or "guaranteed buyer protection" claims anywhere** · the mechanism is standard card chargeback + PSP dispute processes · described accurately

### Revised from first audit (second audit · 2026-11-04 later-same-day)
- **§A.2 liability wording tightened**: removed universal claims that direct charges fully isolate NEX from dispute liability. Added explicit "subject to Stripe's platform account type + loss-liability configuration + Connect Platform Agreement terms" qualifier wherever charge-model liability is discussed.
- **§A.2a added**: new subsection "What direct charges do NOT automatically guarantee" — lists negative-balance recovery, platform-level contractual obligations, and account-closure edge cases that still touch NEX regardless of the charge model.
- **§F.4 dispute handling qualified**: removed "all financial consequences land on the connected account, not NEX" absolute claim. Replaced with the default + exception set (Stripe's negative-balance recovery can escalate to the platform).
- **§F.7 refund flow technical detail corrected**: refunds on behalf of a connected account use the platform API key + `Stripe-Account` header, NOT OAuth tokens (OAuth tokens belong to the Standard account connection pattern, not Express).
- **§G.8 added**: new "Stripe Connect platform agreement pre-flight" — checklist of items NEX must confirm with Stripe IN WRITING before go-live (account type selection, loss-liability model, negative-balance recovery mechanics, platform's own responsibilities under the Connect agreement).

### Revised from second audit (third audit · 2026-11-04 later-same-day)
- **§0 Confirmed product direction · Provider rule added**: explicit one-line invariant that NEX itself uses Stripe only, while users have a choice of Stripe or PayPal for receiving their money. Was embedded in architecture tables (§A.1 flows A+B = NEX's Stripe account; §A.1 flows C+D = connected Stripe or PayPal) · now stated as a hard rule at the top of the doc for clarity.

---

## Part A · Payment architecture (revised)

### A.1 · Four payment flows, mapped

| # | Flow | Who pays | Who receives | Stripe mode | Who is merchant of record |
|---|---|---|---|---|---|
| A | Creator subscription (€4.99/mo or €49/yr) | NEX user | NEX's Stripe account | Billing (standard) | **NEX** |
| B | Theme purchase (€3.99 one-off) | NEX user | NEX's Stripe account | Checkout (standard) | **NEX** |
| C | Creator fan support / sponsor | Fan / sponsor | Creator's connected account | **Direct charge** (Payment Link on connected account) | **Creator** |
| D | Shop goods checkout | Buyer | Shop owner's connected account | **Direct charge** | **Shop owner** |

Two different Stripe account relationships in use:
- **NEX platform account** (one Stripe account registered under the NEX Ireland legal entity) · merchant of record for flows A + B
- **Connected accounts** (one Stripe Connect Express account per Creator / Shop) · merchant of record for flows C + D

### A.2 · Direct vs destination vs separate charges — comparison and recommendation

The three Stripe Connect charge types differ meaningfully in who is on the hook when something goes wrong.

| Dimension | Direct charges | Destination charges | Separate charges + transfers |
|---|---|---|---|
| Merchant of record (card statement descriptor) | Connected account | Platform (NEX) | Platform (NEX) |
| Stripe fees paid by | Connected account | Platform (default · can be reassigned) | Platform |
| **First-order chargeback liability** (before negative-balance escalation) | **Connected account** [1] | Platform (NEX) | Platform (NEX) |
| Who files dispute evidence | Connected account (platform can act via `Stripe-Account` header) | Platform (NEX) on seller's behalf | Platform (NEX) |
| Refund initiation | Platform can call Stripe API with `Stripe-Account` header on behalf of connected account (debited from connected account balance) | Platform | Platform |
| Platform fee mechanism | `application_fee_amount` | `application_fee_amount` | Explicit transfer amount |
| Funds flow | Buyer → Connected acct directly · platform gets fee transferred | Buyer → Platform acct → immediate transfer to connected acct | Buyer → Platform acct · platform holds · platform transfers later |
| Compliance posture | Lightest default · but see [1] | Heavy · NEX is a marketplace with dispute liability | Heaviest · NEX custodies buyer money briefly |
| Alignment with "NEX never handles payments" | **Strongest** (subject to [1]) | Medium · money transits platform account instantaneously but chargeback hits platform | Weakest |

[1] **First-order liability is the connected account. Final liability is subject to Stripe's platform account type (Express / Custom / Standard), the Connect Platform Agreement NEX signs, and the loss-liability model configured on NEX's platform. See §A.2a for the edge cases that still touch NEX regardless of charge model.**

**Recommendation: direct charges are the preferred DESIGN CANDIDATE for shop goods and creator payments (flows C + D), subject to Stripe confirming the IE platform's Connect Platform Agreement, account type, and loss-liability configuration before go-live.** (See §G.8 for the pre-flight checklist.)

Default behaviour under direct charges:
1. The chargeback debits the connected account's balance first; dispute fees are charged to the connected account.
2. Funds settle to the seller's bank per the seller's own Stripe payout schedule. NEX never holds buyer money as part of the normal charge path.
3. Platform fee (if any) is taken via `application_fee_amount` on the same charge — one-call-one-settlement.
4. If the connected account has sufficient balance when a dispute debits, the loss is contained to that account.

**Where that default can still touch NEX — and must be verified with Stripe in writing:**
- **Negative-balance recovery.** If a disputed charge debits a connected account to a negative balance, Stripe attempts recovery against the connected account's future revenue. If that revenue does not materialise (seller abandons the account, closes it, or has no further sales), Stripe's standard Connect Platform Agreement makes the PLATFORM responsible for the remaining negative balance. §G.8 lists this as a required written confirmation.
- **Account-type-dependent obligations.** Express and Custom connected accounts may carry different liability apportionment than Standard accounts; NEX must select the account type with full awareness of the loss-liability rules that attach to it.
- **Mass-dispute scenarios.** A pattern of disputes against one connected account can trigger Stripe to require platform intervention. This is not automatic liability but it is operational time + potential reserve requirements the platform must honour.

**Trade-offs honestly stated:**
- The buyer's card statement will show the shop owner's business name as merchant descriptor, not "NEX". Buyers who don't recognise the shop name may initiate chargebacks out of confusion. Mitigation: shop onboarding UI stresses "your shop name will appear on your customers' card statements — make it recognisable".
- NEX processes refunds on behalf of a shop owner by calling the Stripe API with `Stripe-Account: acct_xxx` header on the platform secret key (NOT OAuth — that's the Standard-account pattern). The refund is debited from the connected account's balance. If the connected account has insufficient balance the refund attempt fails until the balance covers it (or negative-balance recovery kicks in · see §G.8).
- Dispute evidence submission: for direct charges, Stripe expects the merchant of record (connected account) to respond. NEX builds a UI that collects evidence and forwards it to Stripe using the `Stripe-Account` header on the platform API — same UX as if the shop owner acted directly in their Stripe Dashboard, but surfaced inside NEX.

### §A.2a · What direct charges do NOT automatically guarantee

This is explicit so later surprises don't blindside the doctrine:

1. **Direct charges do NOT guarantee NEX has zero platform-level dispute liability.** Stripe's Connect Platform Agreement makes the platform responsible for negative balances Stripe cannot recover from the connected account. The LIKELIHOOD of NEX being out-of-pocket is low under direct charges + healthy connected accounts; it is NOT zero.
2. **Direct charges do NOT exempt the platform from Stripe's own fees and recovery obligations.** Stripe may require the platform to hold reserves, modify payout schedules, or settle shortfalls per the Platform Agreement.
3. **Direct charges do NOT mean the platform is invisible to the dispute process.** Stripe may notify the platform of disputes, require platform-level responses in some scenarios, and audit platform-level fraud controls.
4. **Direct charges do NOT shield NEX from marketplace-operator legal obligations.** DAC7 reporting, DSA notice-and-action, consumer protection law — all apply to NEX regardless of which charge model Stripe uses on the money leg.

**Pre-launch, NEX must obtain written confirmation from Stripe of:**
- Platform account type decision (Express recommended; Custom possible; Standard separate consideration)
- The loss-liability apportionment NEX is agreeing to
- The specific scenarios in which Stripe will debit NEX's platform account
- Any reserve requirements Stripe will set on the platform

Checklist in §G.8.

**Rejected models and why:**
- **Destination charges**: oversimplified in my prior version. These make NEX the merchant of record despite the money flowing through. If a buyer disputes, the chargeback hits NEX's Stripe account; Stripe will reverse the transfer from the connected account to make NEX whole, but if the connected account is empty or closed, NEX eats the loss. Also means NEX appears on the card statement, which is not what we want for a facilitator model.
- **Separate charges and transfers**: worst option. NEX holds funds between charge and transfer, directly contradicts the sealed "NEX never handles payments" doctrine.

### A.3 · No escrow, no "guaranteed buyer protection" claims

**We will not describe NEX as providing escrow or guaranteed buyer protection in any user-facing copy.**

Buyer protections available on NEX transactions are:
1. Standard card-network chargeback rights (Visa/Mastercard/Amex) — 60-120 days depending on card network and dispute type
2. Stripe's documented dispute response process (we surface this, not invent it)
3. Shop owner's own returns/refunds policy (shop-owner-authored, not NEX-guaranteed)

Future escrow-style flows (e.g. accommodation pre-payment held until check-in) are OUT OF SCOPE for Phase 1 and would require either Stripe's `separate_charges_and_transfers` with a documented hold period or a Mangopay-style regulated marketplace integration. Either requires a separate decision doc.

### A.4 · Annual subscription (DECISION 2)

Monthly €4.99 is confirmed. Open: whether €49/year ships alongside monthly from day one.

| Launch pattern | Trade-off |
|---|---|
| Monthly only at launch | Faster to build (one price, one webhook path) · harder churn at month-end decisions · lower annual GMV |
| Monthly + yearly at launch | Two prices · users self-select commitment · ~17% yearly discount drives acquisition · simpler VAT reporting (12 vs 1 annual invoice per subscriber) |
| Monthly first, add yearly later | Loses yearly cohort who want to commit · simpler v1 |

**Recommendation: ship both from day one.** Yearly shows commitment, reduces churn churn, and the Stripe Billing integration naturally supports multiple prices on the same product.

### A.5 · PayPal inclusion (DECISION 3)

| Option | When | Trade-off |
|---|---|---|
| Stripe only at launch | Phase 1 | One PSP, one webhook, one onboarding flow, faster |
| Stripe + PayPal at launch | Phase 1 | Higher conversion on shop goods (PayPal buyers are a real segment) · double onboarding UX · double webhook infrastructure |
| Stripe first, PayPal in Phase 1.5 | ~6-8 weeks later | Cleaner Phase 1 · PayPal added once Stripe is stable |

**Recommendation: Stripe only at launch; PayPal added as Phase 1.5 after Stripe is live.** The prior version proposed both at once; on reflection, parallel integrations compound risk without proportional reward.

### A.6 · Business sponsorship inclusion (DECISION 4)

Sponsorship (3-day to 30-day fixed-price slots on Creator pages, €5-€35, direct to Creator) is a separate payment product from fan support. Options:

| Option | Trade-off |
|---|---|
| Include in Phase 1D alongside shop checkout | Full creator commercialisation visible day one · adds a `nex_sponsorship_booking` table + conflict-resolution logic |
| Defer to Phase 2 | Phase 1 ships faster · creators have fan support but no sponsor channel initially |

**Recommendation: defer to Phase 2.** Sponsorship has booking-conflict resolution complexity that deserves its own spec; fan support covers the primary commercialisation story for launch.

---

## Part B · NEX Creator membership (confirmed)

### B.1 · Pricing

| Product | Price | Billing | Who receives |
|---|---|---|---|
| Creator membership · monthly | €4.99 | Recurring, cancel any time | NEX Stripe account |
| Creator membership · annual | €49 | One-off, 12-month entitlement | NEX Stripe account |
| Chat theme (any eligible theme) | €3.99 | One-off | NEX Stripe account |

**Sealed: NEX takes 0% commission on all money that flows to Creators** (fan support, future sponsorship). The membership fee is the entire NEX revenue line from a Creator account.

### B.2 · What an active membership unlocks

Settings-page gating only renders these when `nex_stripe_subscription.status IN ('active','trialing')` AND `cancel_at_period_end=false OR now() < current_period_end`:

- Creator profile page (`/creator/[handle]`) is PUBLIC
- Stripe Payment Link generation for fan support
- Shop features for Creator accounts (if Creator also sells goods, uses the same shop infrastructure in Part C-E)
- Creator badge display on contacts + community surfaces (badge calculation already live in sealed `creator-badges.ts`)
- Future: sponsor-slot booking page
- Future: content reuse permissions (Phase 3)

### B.3 · Trial period (DECISION 6)

Options:
- No trial — €4.99 from day one
- 7-day free trial (requires card on file, auto-converts)
- 14-day free trial
- 1-month free trial

**Recommendation: 7-day free trial, card on file.** Standard SaaS conversion pattern · filters out tyre-kickers · creators who cross the 7-day mark typically renew.

### B.4 · Membership lifecycle

| Event | System response |
|---|---|
| User completes Stripe Checkout for monthly plan | Webhook `checkout.session.completed` → INSERT `nex_stripe_subscription` row status=`active` · Creator UI unlocks |
| Monthly renewal succeeds | Webhook `invoice.paid` → UPDATE `current_period_end` |
| Monthly renewal fails | Webhook `invoice.payment_failed` → status=`past_due` · 7-day grace with retry · UI shows "Your membership will lapse on {date}" |
| User cancels | Webhook `customer.subscription.updated` with `cancel_at_period_end=true` · UI shows "Your membership ends on {date}" · features remain active until that date |
| Period ends after cancel | Webhook `customer.subscription.deleted` → status=`canceled` · UI locks Creator surfaces |
| Yearly plan completes | Entitlement persists for 12 months from `current_period_start` |
| User upgrades monthly → yearly mid-period | Stripe pro-rates automatically · entitlement continuous |

### B.5 · Already-paid sponsorship after membership expiry

Per owner directive 2026-11-04: *"Any already-paid sponsorship should remain visible for its agreed term."*

When a creator's membership lapses:
- Existing sponsor slots stay visible until their own `expires_at`
- NO new sponsor bookings accepted
- Creator's fan support button stays visible if their connected Stripe account is still active (fan-support money goes direct to them, not gated by NEX membership)
- Creator profile page shifts to a "membership lapsed" view (basic contact · no new slot bookings)

This means sponsor-slot lifecycle is INDEPENDENT of membership lifecycle · see §F.9.

---

## Part C · Shop templates

### C.1 · Existing sealed infrastructure (11 cover layouts)

Reference: `src/app/nex-native/cover/layout-ids.ts` (sealed 2026-09-30 + accommodation 2026-10-20)

| # | id | label | Vertical fit |
|---|---|---|---|
| 1 | `cafe` | Café | Food & hospitality |
| 2 | `cafe_landscape` | Café · Landscape | Food (wider hero) |
| 3 | `cafe_round` | Café · Round Products | Food (round product grid) |
| 4 | `product` | Product Seller | Goods |
| 5 | `product_landscape` | Product Seller · Landscape | Goods (wider hero) |
| 6 | `product_round` | Product Seller · Round Products | Goods (round product grid) |
| 7 | `product_landscape_round` | Product Seller · Landscape · Round | Goods (wide + round) |
| 8 | `personal_brand` | Personal Brand | Personal/service |
| 9 | `personal_brand_landscape` | Personal Brand · Landscape | Personal/service (wide) |
| 10 | `personal_brand_round` | Personal Brand · Round Products | Personal/service (round) |
| 11 | `accommodation` | Accommodation | Homestay / villa / hotel |

**Status:** all 11 live and in production via `src/app/nex-native/cover/layouts.tsx`.

**NO NEW TEMPLATES in Phase 1.** Spec reuses the 11 sealed layouts as the shop template catalogue.

### C.2 · Template chooser experience

Already-existing: `/nex-native/cover-themes-library` + `/nex-native/onboarding/shop-theme`.

What the spec needs to confirm (not build):
- Template chooser reached from: initial shop creation flow AND from the Shop Owner Dashboard's "Change template" action
- Preview shows a mini phone frame with sample data (`_mini-phone-frame.tsx` already exists)
- Selection sets `nex_business.cover_layout_id` (existing column · migration 100)
- Changing template does NOT lose product data · products stay attached to `nex_business`

**No additional templates built in Phase 1.** If a shop owner wants a layout we don't have, they pick the closest match · a future founder-approved template expansion is a separate decision.

### C.3 · Branding fields per shop

| Field | Storage | Current column | New? |
|---|---|---|---|
| Shop name | `nex_business.name` | ✓ | — |
| Logo | `nex_business.logo_url` or similar | needs confirmation | likely exists |
| Cover banner image | `nex_business.cover_image_url` | needs confirmation | likely exists |
| Brand colour accent | `nex_business.accent_colour` | needs confirmation | may be new |
| Tagline / short description | `nex_business.tagline` or `description` | needs confirmation | likely exists |
| Profession/vertical | `nex_business.profession_id` + `vertical_id` | ✓ (migrations 113-115) | — |
| Template (cover layout) | `nex_business.cover_layout_id` | ✓ (migration 100) | — |
| Public slug | `nex_business.slug` | ✓ (via `/[businessSlug]` routing) | — |

Before implementation, I'll produce a short "existing columns inventory + proposed additions" sub-spec. Zero new columns unless strictly necessary.

---

## Part D · Product management

### D.1 · Existing infrastructure

Confirmed existing (from prior investigation):
- `nex_product` table (referenced by `creator-badges.ts` through `nex_business.owner_account_id`)
- `nex_business` as the owner relationship
- Various routes under `/nex-native/[businessSlug]/` for public rendering
- Various admin routes under `/nex-native/manage/` (existing shop management surfaces)

Not yet confirmed (needs schema inventory before build):
- Product status enum (active / draft / removed / out_of_stock)
- Stock-level tracking
- Product variants (size / colour / etc.)
- Photo storage pattern (bucket + path shape)

### D.2 · Required admin operations

Shop owner should be able to:
- **List** all products for a shop · filter by status · search
- **Create** a product: title, description, price, currency, photos (1-N), category, stock
- **Edit** any field on an existing product
- **Archive / remove** a product (soft-delete via status, not hard DELETE · preserves order history integrity)
- **Reorder** products (display order on the shop page)
- **Duplicate** a product (common seller workflow)

### D.3 · Photo handling

- Supabase Storage bucket `nex-product-photos` or similar · needs inventory check
- Per product: 1-8 photos, first is primary
- Upload UI: drag-drop or file picker · mobile camera support
- Mime validation at upload layer (jpeg/png/webp · size cap 5 MB each)
- Server-side scan for NSFW if 251 content-age-rating lands later (deferred · out of scope Phase 1)

### D.4 · Multi-shop policy (DECISION 9)

Question: can one NEX account own multiple shops?

| Option | Trade-off |
|---|---|
| One account → one shop | Simpler UI (no shop-switcher) · constrains serious sellers · forces multi-account workaround |
| One account → many shops | More flexible · needs shop-switcher in dashboard · clearer ownership for group sellers |

**Recommendation: one account → many shops** (N:M via `nex_business.owner_account_id` which is already how the schema works). The dashboard surfaces a shop-switcher if `COUNT(*) > 1` for the current account. Avoids forcing power-users into multi-account workarounds.

### D.5 · Product-level price vs currency

Each product carries its own price + currency. Ireland launch defaults to EUR. Owner directive 2026-11-04 preserves the "do not infer behaviour" principle · shop owner explicitly sets currency per product (or shop-wide default that products inherit). Currency conversion for cross-border buyers NOT in Phase 1 · buyers see the shop's listed currency and their card is charged by Stripe with their issuer applying FX.

---

## Part E · Shop Owner Dashboard

### E.1 · Information architecture

Primary route: `/nex-native/manage/shop` (existing; spec confirms its full shape)

```
Dashboard home
├── Overview (sales this week · recent orders · unread enquiries)
├── Shop
│   ├── Appearance (template · branding · cover · logo)
│   ├── About (name · tagline · description · contact info)
│   ├── Shipping & returns (policies · delivery options)
│   └── Opening hours (if applicable per template)
├── Products
│   ├── All products (list · filter · search · reorder)
│   ├── Add product
│   └── Categories (optional grouping)
├── Orders
│   ├── All orders (status filter · search by buyer/order id)
│   ├── Needs action (pending shipment · open disputes)
│   └── Order detail (status transitions · buyer messaging · refunds)
├── Enquiries
│   └── Chat with customer (reuses existing peer chat)
├── Payments
│   ├── Stripe connection status
│   ├── Payout schedule + history
│   ├── Refunds + disputes
│   └── (future) PayPal connection
└── Settings
    ├── Shop visibility (published · unpublished)
    ├── Delete / archive shop
    └── (if multi-shop) switch shop
```

### E.2 · Overview tile layout

Dashboard home shows 4-6 tiles above the fold:
- **Sales this week** · value + sparkline
- **Orders needing action** · count + direct link to list
- **Unread customer enquiries** · count + direct link
- **Stripe status** · green/yellow/red indicator with prompts for missing KYC steps
- **Products published** · count + link to add
- **Shop visitors this week** (if analytics are wired · else omit)

### E.3 · Access control

- Dashboard reads `session.account.id = nex_business.owner_account_id` to grant access
- No "staff" or "collaborator" accounts in Phase 1 (one-account-per-shop-owner · multi-user access deferred)
- A shop in `visibility='unpublished'` state renders a "Coming soon" placeholder publicly but is fully editable by the owner

### E.4 · Shop switcher (if multi-shop lands per D.4)

Top-left of the dashboard, drop-down with shop name + logo thumbnail. Persists selection in a session cookie. Omit entirely if only one shop.

### E.5 · Guest preview

Owner can click "View as customer" from the dashboard to see the published shop exactly as a visitor sees it. Opens `/{businessSlug}` in the customer context (no admin chrome).

### E.6 · Guest buyer checkout (DECISION 10)

Question: must a buyer have a NEX account to check out, or is guest checkout allowed?

| Option | Trade-off |
|---|---|
| NEX account required | Buyer identity known · dispute management easier · fewer conversions (friction at checkout) |
| Guest checkout allowed (email only) | Higher conversion · buyer identity is just an email until they return · harder to link follow-ups |
| Hybrid: guest checkout with "create account" prompt after purchase | Best of both · common ecommerce pattern |

**Recommendation: hybrid.** Checkout requires only email + delivery address + card. Post-purchase screen prompts "Create your NEX account with this email to track your order" (one-tap signup).

---

## Part F · Order management + dispute handling

### F.1 · Order status state machine

```
draft
  └─► pending_payment (customer clicked checkout, awaiting PSP confirmation)
        ├─► paid (webhook confirmed)
        │     ├─► fulfilling (owner confirms packaging / preparation)
        │     ├─► shipped (owner marks shipped · optional tracking number)
        │     ├─► delivered (owner confirms OR webhook from shipping provider)
        │     ├─► refunded (owner initiates refund)
        │     └─► disputed (webhook from Stripe dispute)
        └─► canceled (timeout or customer cancellation before payment)
```

Each transition writes an `nex_shop_order_event` audit row (append-only) · field + old + new + who + when + note.

### F.2 · Who transitions each state

| Transition | Actor | Trigger |
|---|---|---|
| draft → pending_payment | Buyer | Clicks "Pay" |
| pending_payment → paid | System | Webhook `payment_intent.succeeded` (direct charge on connected acct) |
| pending_payment → canceled | System or Buyer | Timeout (30 min) OR explicit cancel |
| paid → fulfilling | Shop owner | Marks "preparing" in dashboard |
| fulfilling → shipped | Shop owner | Marks "shipped" + optional tracking |
| shipped → delivered | Shop owner | Marks "delivered" OR shipping carrier webhook (future) |
| any paid-state → refunded | Shop owner | Clicks "Refund" in dashboard (NEX calls Stripe refund API with connected acct's OAuth token) |
| any paid-state → disputed | System | Webhook `charge.dispute.created` |

### F.3 · NEX transaction fee on shop goods (DECISION 1)

Three realistic options:

| Option | Mechanism | Trade-off |
|---|---|---|
| **0%** | No `application_fee_amount` on direct charges | Matches 0% Creator positioning · simplest story · no NEX shop revenue (NEX earns only from subscriptions + themes · a thin business) |
| **Flat % (1-3%)** | `application_fee_amount = total × 0.02` | Covers platform cost · small-order margin hit for sellers · compounds on top of Stripe's 2.9% + 30c |
| **Flat fee per sale (e.g. €0.50)** | `application_fee_amount = 50` | Fixed economics · zero drag on large orders · small drag on small ones |

**Recommendation: 0%** — same positioning as Creator. NEX revenue comes from the membership + themes. Shop takes the whole sale (minus Stripe's own fees to the connected account). This maximises seller retention and avoids the "NEX is taking a cut" friction. Reconsider if shop adoption outgrows subscription revenue.

### F.4 · Dispute handling under direct charges

When a buyer disputes a charge (chargeback):
1. Stripe webhook `charge.dispute.created` fires on the Connect webhook feed (one webhook endpoint receives events for every connected account)
2. `nex_shop_order.status` → `disputed`
3. Shop owner notified in the dashboard · see "Respond to dispute" CTA
4. NEX provides an evidence-collection UI (reuses order detail · attach shipping label, buyer chat transcript, proof of delivery)
5. On submit, NEX calls `stripe.disputes.update(dispute_id, { evidence: ... })` using the platform secret key with `Stripe-Account: acct_xxx` header so Stripe credits the submission to the connected account
6. Stripe adjudicates · either side wins · webhook `charge.dispute.closed` updates the order
7. If seller wins: funds released back to connected account
8. If buyer wins: refund processed + dispute fee (€15 typical) debited from connected account

**Default financial path:** under direct charges, the first-order debit for the disputed amount and the dispute fee lands on the connected account's balance.

**Qualifiers that MUST be read alongside the default path:**
- If the connected account's balance cannot cover the debit, Stripe applies negative-balance recovery against future revenue on that account. If the account has no future revenue, Stripe's Connect Platform Agreement makes the PLATFORM responsible for the shortfall — this is a real scenario NEX must plan for (reserve policy §F.6 is a mitigation · see §G.8 for the pre-flight confirmation).
- NEX is the operator of the Stripe Connect platform. Stripe may require the platform to act in a dispute (e.g. fraud controls, seller suspension) even when the financial debit is the connected account's — "financial responsibility" and "operational responsibility" are not the same question.
- Mass-dispute patterns trigger Stripe to re-evaluate the platform's reserve and payout schedule, which can affect NEX's platform account even when individual disputes are seller-account debits.

**NEX's affordances in the dispute UI are "facilitate the connected account's response", not "act on behalf of NEX as a party to the dispute".** Every evidence API call carries `Stripe-Account: acct_xxx` and is attributed to the connected account, not to NEX. NEX's own involvement is operational (surfacing, forwarding) rather than financial — but the §G.8 pre-flight confirms the exact edges of that line in writing.

### F.5 · KYC threshold for new shop owners (DECISION 8)

| Option | Mechanism |
|---|---|
| Upfront full KYC | Shop owner must complete all Stripe KYC before publishing · higher friction · zero-surprise onboarding |
| Stripe default (light-touch then prompt at threshold) | Owner can list and sell until ~€2,500 lifetime GMV · prompted for docs at that point · better conversion · risk: a fraud seller could cash out below threshold |

**Recommendation: upfront full KYC.** For a launching marketplace, trust is more valuable than onboarding speed. We're not in a position to absorb seller-fraud losses even once. Stripe handles the KYC UI; we just set the configuration.

### F.6 · Dispute reserve for new sellers (DECISION 7)

Option: hold X% of payouts for N days on sellers under €Y lifetime GMV.

| Policy | Trade-off |
|---|---|
| No reserve | Sellers paid out on standard Stripe schedule (2 days for IE) · fastest cash flow for sellers · zero protection buffer for disputes |
| 5% for 60 days under €2,000 lifetime | Sensible safety margin · 60 days > most dispute window · negligible drag |
| 10% for 90 days under €5,000 | More conservative · sellers may complain about cash flow |

**Recommendation: 5% for 60 days under €2,000 lifetime GMV.** Reduces fraud exposure in the fragile early-seller window. Enabled via Stripe Connect's `settlement_schedule.delay_days`.

### F.7 · Refund flow

#### F.7.1 · Design rule (invariant · owner-sealed 2026-11-04)

> **NEX never funds a refund from NEX's own balance. If a refund cannot be debited from the connected account, the refund must fail safely and surface to the shop owner for explicit resolution. NEX must never silently fall back to NEX funds, automatic platform coverage, or any other NEX-custodied mechanism.**

This is a design-rule INVARIANT, not a user-facing promise about buyer outcomes. It governs implementation behaviour. Every refund code path must satisfy it.

**Explicitly prohibited behaviours under this rule:**
- Automatic use of `application_fee_amount` reversal to backfill a refund that the connected account cannot cover.
- Silent bookkeeping that debits NEX's platform account to make a refund succeed.
- Using a different charge type (destination, separate charges + transfers) in the background to route NEX funds.
- Hiding the "insufficient balance" error from the shop owner behind a generic "refund processing" state.
- Admin or any UI affordance that triggers a NEX-funded refund without an explicit authorisation flow + audit record (see F.7.5 exception path).

**Explicitly required behaviours under this rule:**
- The refund API call MUST use the platform secret key + `Stripe-Account: acct_xxx` header so the debit lands on the connected account.
- If the Stripe API returns an error OR insufficient-balance condition, NEX MUST surface it to the shop owner without obfuscation.
- The order MUST remain in a visible, audited "refund_failed_insufficient_balance" state until the shop owner acts.
- Any proposal to route a refund through NEX funds MUST pass through the exception workflow (F.7.5) with named admin authorisation + audit log entry · never via code branches that auto-fire.

#### F.7.2 · Happy path

1. Shop owner opens order detail · clicks "Issue refund"
2. Modal: full or partial refund · reason (dropdown: duplicate, requested, product issue, other) · optional note
3. NEX server action calls `stripe.refunds.create({ charge: ch_xxx, amount: ... })` using the PLATFORM secret key with header `Stripe-Account: acct_xxx` so Stripe debits the connected account's balance
4. Stripe responds 200 · webhook `charge.refunded` confirms
5. `nex_shop_order.status` → `refunded` (full) or `partially_refunded` (partial)
6. Buyer notified via email + in-app message

#### F.7.3 · Fail-safe path (connected account cannot cover the refund)

1. Shop owner triggers refund as above
2. NEX server action calls `stripe.refunds.create` with `Stripe-Account` header
3. Stripe returns an error or indicates the debit cannot proceed (empty balance, account restricted, etc.)
4. NEX MUST:
   - Catch the Stripe error server-side · do not throw it as an unhandled exception
   - Transition `nex_shop_order.status` → `refund_failed_insufficient_balance` (or similar explicit state · to be finalised in schema spec)
   - Write a `nex_shop_order_event` audit row capturing the Stripe error code + message + attempted amount + timestamp
   - Return a clear, human-readable error to the shop owner UI: "Refund could not be debited from your Stripe balance. Add funds to your Stripe account, resolve the restriction with Stripe directly, or retry when revenue arrives. NEX does not and will not pay refunds from NEX funds on your behalf."
   - Notify the buyer with an honest status: "Your refund is pending with the seller. The seller has been informed and will complete it when their account can process the debit."
5. NEX MUST NOT:
   - Automatically retry with a different charge model or fund source
   - Silently update the order to `refunded` while the debit has not landed
   - Debit NEX's platform account to make the buyer whole in the shop owner's name
6. The order remains in the failed-refund state until:
   - The shop owner retries successfully (happy path resumes), OR
   - The shop owner marks the order resolved via out-of-platform settlement (new audit record, no NEX fund flow), OR
   - An F.7.5 exception is explicitly approved by named admin authorisation

#### F.7.4 · Who can initiate a refund

- The shop owner, from the NEX Shop Dashboard (F.7.2 happy path)
- The shop owner, directly from their Stripe Dashboard (bypasses NEX · webhook still updates `nex_shop_order.status` so NEX stays in sync)
- NEX admin, ONLY via the F.7.5 exception path · never as routine admin power

#### F.7.5 · Exception path (NEX-funded resolution · only with named authorisation)

Scenario: a shop owner has abandoned their Stripe account, the connected account cannot cover a legitimate refund, and NEX elects to make the buyer whole for reputation / trust / regulatory reasons.

- This is NEVER automatic. NEX funding a buyer refund is an EXPRESS POLICY DECISION, not a fallback.
- Requires: named admin authorisation with reason + amount + buyer identity + audit log entry
- Requires: separate commercial decision whether to pursue recovery against the connected account (civil action, collection, ongoing seller suspension)
- The exception workflow MUST live behind a distinct UI path, NEVER behind the same button as the normal refund
- Stripe mechanics: if NEX decides to fund, it does so by refunding from the NEX platform account using a completely separate charge/transfer (never dressing up a direct-charge refund as an automatic fallback)
- This path is documented but UNBUILT until explicitly authorised. §G.8 pre-flight confirmation does not approve building it.

#### F.7.6 · Doctrine summary

The refund design rule (F.7.1) is a hard invariant. The happy path (F.7.2) is the default. The fail-safe path (F.7.3) is required for every implementation. The exception path (F.7.5) is documented but unbuilt. **Any code that does not demonstrably obey F.7.1 does not ship.**

### F.8 · Buyer-initiated cancellation (pre-payment)

Buyer can cancel at any time while `status='pending_payment'`. Simply closes the checkout. 30-minute timeout auto-cancels orphaned pending-payment rows (cron or on-read sweep).

### F.9 · Sponsor-slot lifecycle (sponsor booking deferred to Phase 2)

Context for Phase 2: sponsor slots on Creator profiles are bookings owned by the SPONSOR (business), not the creator. A sponsor slot has its own `nex_sponsorship_booking` row with its own `expires_at`. Creator membership lapse does NOT cancel already-paid slots. Mechanics to be fully specified in a dedicated Phase 2 doc.

---

## Part G · Legal, regulatory, operational

### G.1 · Legal trading entity + VAT (DECISION 5 · blocking)

**Blocks ALL Phase 1 work.** NEX cannot open a Stripe account, PayPal account, or charge VAT without a known trading entity.

Required answers:
- Which legal entity (NEX Limited? NEX Ireland Ltd? Sole trader?) holds the NEX Stripe account
- VAT registration status · Irish VAT number if any
- VAT MOSS registration for cross-EU sales (required if selling to non-IE EU customers)
- Registered office + billing contact for Stripe KYC

Until this is confirmed the architecture is approvable but no Stripe account can be opened.

### G.2 · DAC7 reporting

If NEX intermediates ≥30 sales OR ≥€2,000/year per EU seller, NEX must report to Revenue annually.
- Platform operator identification · registration with Revenue
- Annual report with per-seller totals
- Seller tax identity collection (TIN) · must be surfaced in seller onboarding

Not optional. Infrastructure needed before first year of operation but not blocking Phase 1 build.

### G.3 · Consumer Rights Directive (14-day cooling-off)

Shop checkout UI must surface the 14-day right-of-withdrawal for distance B2C sales. Shop owners' returns policy must acknowledge this. Not a PSP concern but a UI compliance item.

### G.4 · DSA (Digital Services Act)

NEX becomes a "hosting service" under DSA because it hosts seller content + user-to-user transactions. Required:
- Documented notice-and-action procedure
- Transparent terms of service
- Annual transparency report (for very-large-platforms thresholds · not yet applicable to NEX but infrastructure must exist)

### G.5 · GDPR

- Buyer data processor: Stripe/PayPal (DPA required)
- Buyer data controller: NEX (privacy notice updates)
- Data minimisation: don't collect what we don't need · delivery address + email are minimum viable
- Right to erasure: order records retained for legal reasons (tax · dispute window) but personal data can be anonymised after that

### G.6 · PCI DSS

- NEX never touches raw card data
- Stripe Elements / PayPal SDK used for all card entry · tokens only come back to NEX servers
- No "save card" on NEX servers · all stored payment methods live in Stripe Customer records

### G.7 · PSD2 / SCA

- Enabled by default on Stripe and PayPal in EEA
- NEX must NOT disable 3DS or SCA · it's required for compliance
- Users will occasionally be challenged on checkout · standard flow

### G.8 · Stripe Connect Platform Agreement pre-flight (new · from second audit)

**Before NEX accepts the first real payment as a Stripe Connect platform, the following items MUST be confirmed with Stripe in writing** (support ticket, account manager email, or signed addendum). None of these are optional · each one shapes NEX's true liability posture under the Connect model.

| # | Item to confirm in writing | Why |
|---|---|---|
| 1 | Platform account type chosen for NEX (**Express recommended** for Phase 1) | Different account types carry different liability apportionment · Stripe's Connect Platform Agreement is read against this choice |
| 2 | Loss-liability model that applies to NEX's Express connected accounts | Default is platform-covers-unrecoverable-negative-balances · Stripe may offer custom terms; either way NEX needs to KNOW |
| 3 | Specific scenarios in which Stripe will debit NEX's platform account | Chargeback shortfalls, mass-fraud recovery, Stripe fee recovery, ACH return recovery · NEX cannot design the reserve policy (§F.6) without this list |
| 4 | Reserve requirements Stripe imposes on NEX's platform account | Stripe commonly requires new Connect platforms to hold a % reserve on their own platform account · size + release schedule must be known |
| 5 | Payout-schedule controls Stripe gives NEX for connected accounts | NEX's dispute-reserve policy (§F.6 · 5% for 60 days under €2,000 lifetime) depends on Stripe allowing NEX to set `settlement_schedule.delay_days` per account |
| 6 | Platform's obligations under Stripe's Services Agreement + Connect Platform Agreement | Required disclosures, fraud monitoring duties, KYC refresh obligations, DAC7/DSA data sharing · all platform-level responsibilities |
| 7 | Dispute-handling escalation path — when Stripe may require platform intervention | Not every dispute is a pure seller matter · NEX should know the escalation triggers |
| 8 | Capability requirements for Express accounts in Ireland (card_payments, transfers) + any Ireland-specific KYC enhancements | Shop owner onboarding UX depends on this |
| 9 | Chargeback fee amount in EUR + who pays it | Documentation sometimes varies by region · NEX must display the correct figure to sellers |
| 10 | Stripe's policy on connected-account closure mid-dispute | If a seller closes their Stripe account during an open dispute, who absorbs the loss |

**Deliverable:** a short "NEX Stripe Connect Platform Agreement summary" document, co-signed or at least acknowledged by Stripe's account management, kept in `docs/doctrine/`. Build does not start until this exists.

**Owner note 2026-11-04 incorporated verbatim:** *"But who ultimately bears an unrecoverable negative balance depends on the Connect account configuration and loss-liability settings. Express and Custom accounts can also carry platform-level contractual responsibilities."* — this doc now explicitly names that nuance in every place where charge-model liability is discussed.

### G.9 · Operational

- Stripe dashboard access for NEX ops · 2FA required · audit log
- Webhook secret rotation policy · every 90 days recommended
- Incident response: dedicated channel for payment-related alerts (test failed, webhook down, dispute spike)
- Platform-account health monitoring · negative balance alerts, reserve-threshold alerts, mass-dispute alerts

---

## Part H · Proposed phased build (unchanged structure, refined scope)

Each phase stops for owner approval before the next starts. Nothing applies without named authorisation.

### Phase 1A · NEX-side payments (foundation) — 2-3 weeks of work
- **Prerequisites blocked on §G.1** (legal entity named)
- Author migrations: `nex_stripe_subscription`, `nex_payment_event` (DRAFT only)
- Build `src/lib/nex-native/payments/stripe-platform-client.ts` (NEX account SDK wrapper)
- Build `/api/stripe/webhook` endpoint for NEX platform events
- Build subscription Checkout flow for Creator membership (monthly + yearly per §A.4)
- Build theme-purchase Checkout flow (replaces the "payment provider NOT WIRED" state in existing migration 193)
- Trial period (per §B.3 decision)
- Membership states + lifecycle (per §B.4)
- Admin dashboard: subscription list view (read-only)

### Phase 1B · Connected accounts (Creator fan support) — 2 weeks
- Author migration: `nex_payment_provider_account` (DRAFT)
- Build `/api/stripe/connect/webhook` for connected account events
- Build `/nex-native/settings/payments` UI with Stripe Connect Express onboarding
- Stripe Payment Link generation per creator (replaces the existing `external_links` placeholder)
- Capability polling + status display
- Fan-support UI uses Payment Link directly (no NEX custody)

### Phase 1C · Shop checkout core — 3 weeks
- Author migration: `nex_shop_order` (DRAFT)
- Inventory existing `nex_business` + `nex_product` columns · propose any additions (DRAFT)
- Shop Owner Dashboard IA per §E (existing `/manage/shop` extended, not replaced)
- Products: list, add, edit, archive · photo upload pipeline
- Buyer checkout page with Stripe (direct charge per §A.2)
- Order list + detail for shop owner
- Order status transitions per §F.1-F.2
- Refund flow per §F.7

### Phase 1D · Dispute + buyer protection UX — 1 week
- Dispute webhook handling per §F.4
- Evidence collection UI
- Reserve policy configuration per §F.6
- Buyer-side order tracking page
- Email notifications for key events

### Phase 1.5 · PayPal (optional) — 2 weeks
- Deferred per §A.5 recommendation
- Add PayPal Commerce Platform onboarding
- Add PayPal as second checkout button
- Webhook handler
- Order status wiring for PayPal flow

### Phase 2 · Business sponsorship — separate doc
- See §A.6 · fully specified in its own decision doc after Phase 1 core is live

---

## Part I · Open decisions summary (for owner reply)

Please answer the 10 open decisions numbered throughout the doc. For convenience:

1. **§F.3** · NEX transaction fee on shop goods: **0% / flat % / flat € / tiered**
2. **§A.4** · Annual membership at launch: **monthly only / monthly + yearly / monthly first then yearly**
3. **§A.5** · PayPal at launch: **Stripe only / Stripe + PayPal / defer PayPal**
4. **§A.6** · Sponsorship phase: **Phase 1D / Phase 2**
5. **§G.1** · Legal entity + VAT: **named entity + VAT status** (BLOCKS all Phase 1 work)
6. **§B.3** · Creator subscription trial: **none / 7 / 14 / 30 days**
7. **§F.6** · Dispute reserve: **none / 5% for 60 days / 10% for 90 days**
8. **§F.5** · KYC threshold: **upfront full / Stripe default light-touch**
9. **§D.4** · Multi-shop: **one shop per account / many shops per account**
10. **§E.6** · Guest buyer checkout: **account required / guest allowed / hybrid**

My recommendations (summarised):
1. 0% — matches Creator positioning
2. Monthly + yearly from day one
3. Stripe only at launch; PayPal as Phase 1.5
4. Phase 2 (separate doc)
5. **BLOCKS build** — owner answer required
6. 7-day free trial
7. 5% for 60 days under €2,000 lifetime GMV
8. Upfront full KYC (trust > speed at launch)
9. Many shops per account
10. Hybrid (guest with post-purchase signup prompt)

---

## Part J · What I will NOT do until explicit named authorisation

- Apply any migration (277/278/279/280/281 or any future number)
- Open a Stripe account (owner does this · needs §G.1 resolution)
- Open a PayPal account (owner does this when §A.5 confirms inclusion)
- Register as a Stripe Connect platform (owner does this · needs §G.1)
- Write any code (services, routes, webhook handlers)
- Push to GitHub or deploy to Vercel
- Modify production DB credentials or env vars
- Touch `scripts/_tmp/` or Bridges 76 / 77 / 78 / 88
- Modify the sealed `creator-badges.ts` resolver or any existing Creator doctrine artefact
- Add new cover-layout templates (the 11 sealed layouts are the complete catalogue)

---

## Part K · Required next action from owner

Please reply with any mix of the following:

1. "Decisions on §I.1–§I.10 (list your choices)"
2. "Approve architecture · author Phase 1A DRAFT migrations for review"
3. "Revise section X before I approve"
4. "Hold here — still working through the legal entity decision"
5. "Reorder phases: build [X] before [Y]"

Next step after a decision batch lands:
- If §G.1 is resolved AND §I.1-I.10 are answered → I'll author Phase 1A DRAFT migration SQL (subscription ledger + event ledger) for your sign-off, matching the discipline we've been running on.
- If §G.1 is not yet resolved → the architecture approval still progresses the spec but no Stripe/PayPal account can be opened. Everything else can still be prepared.

---

**Doc location:** `docs/doctrine/nex-payments-and-shop-phase-1-decision-doc-2026-11-04.md` · persisted for future reference.

**Supersedes:** the inline-only prior version from the previous conversation turn.

**Preserves:** all sealed doctrine · existing creator-badges resolver · existing 11 cover layouts · existing nex_theme_purchase + nex_theme_ownership chain · the sealed "NEX never handles payments" invariant (now implemented via direct charges rather than destination charges).
