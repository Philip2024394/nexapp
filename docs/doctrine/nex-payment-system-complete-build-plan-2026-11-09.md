# NEX · Complete Payment System Build Plan · 2026-11-09 (Round 31)

**Status:** owner-authorised scope · supersedes Round 30's "no Stripe
Connect" exclusion. Implementation proceeds in bounded verifiable
slices. Each slice reports BUILT / WIRED / VERIFIED / REMAINING /
BLOCKED independently. No commit · no push · no production.

## Two independent payment systems

NEX operates two PARALLEL Stripe integrations that must never be mixed:

### System A · NEX's own Stripe account
Collects NEX revenue:
- Shop subscriptions (€4.99 · £4.99 · $4.99 · Rp 89,000 per month)
- Chat Theme one-time purchases (€3.49 · £2.99 · $3.99 · Rp 29,000)
- Storage upgrade packs (+5 · +10 · +25 GB monthly)
- Future · bandwidth upgrade packs

Credentials: `STRIPE_SECRET_KEY` (rk_test_ in sandbox · live-key owner
authorisation gated). Stripe account owned by NEX legal entity.

### System B · seller Stripe Connect
Each seller individually connects their OWN Stripe account to receive
customer payments. NEX acts as a platform operator under Stripe
Connect Express. Buyer's card is charged to seller's connected account
directly. NEX takes **0% application fee**.

Credentials: Stripe Connect Platform settings (requires Stripe
platform approval for live mode). Each seller has their own
`nex_business.stripe_connect_account_id`.

**Isolation invariant · NEX code MUST NOT:**
- Use NEX's secret key to make charges against seller accounts (would
  pull funds into NEX's account)
- Use seller's `stripe_connect_account_id` as if it were NEX's own
  customer or subscription ID
- Store seller card details, security codes, or any payment credentials
- Transfer money between seller and NEX ledgers

## Scope · 12 numbered deliverables

### Deliverable 1 · Seller Connect schema (SLICE R31a · this round)
- Migration file: `nex_business.stripe_connect_account_id` + status cols
- RLS: service-role only on new cols
- Written, NOT applied to sandbox (owner review first)

### Deliverable 2 · Seller Connect onboarding API routes (SLICE R31a)
- `POST /api/nex-native/billing/connect/stripe/create` — creates
  Express account for the seller · generates AccountLink · returns URL
- `GET /api/nex-native/billing/connect/stripe/status` — reads current
  Stripe account state · reports capabilities + requirements
- `POST /api/nex-native/billing/connect/stripe/refresh` — generates
  fresh AccountLink if the previous one expired

### Deliverable 3 · Seller Connect webhook handling (SLICE R31a)
- Extend DRAFT webhook processor for `account.updated` event
- Update DB columns on account status changes (charges_enabled ·
  payouts_enabled · requirements.currently_due)

### Deliverable 4 · Seller Connect UI (SLICE R31a)
- Replace `/settings/payments` "coming-soon" placeholder with real
  Connect button
- Wire POST → create route → redirect to Stripe hosted onboarding
- Display status + outstanding requirements on return

### Deliverable 5 · Buyer→seller checkout via connected account (R31b · next round)
- POST `/api/nex-native/billing/checkout/buyer` — creates Stripe
  Checkout Session with `payment_intent_data.transfer_data.destination`
  pointing at seller's `stripe_connect_account_id`
- 0% application fee (sealed commission rule)
- Idempotency key per cart to prevent double-charge
- Order state transition on success/failure

### Deliverable 6 · Buyer-payment webhook handling (R31b)
- `payment_intent.succeeded` · `payment_intent.payment_failed` ·
  `charge.refunded` · `charge.dispute.created` · `charge.dispute.closed`
- Routes refunds/disputes to the correct seller account (NOT NEX)
- NEX side: records order state only · never touches seller funds

### Deliverable 7 · Stripe Connect disconnect flow (R31c)
- `POST /api/nex-native/billing/connect/stripe/disconnect`
- Marks `stripe_connect_account_id = null` (preserves account on
  Stripe side for seller's own records · NEX just forgets the link)
- UI confirmation + consequences disclosure

### Deliverable 8 · NEX subscription end-to-end verification (R31d)
- Set STRIPE_WEBHOOK_SECRET (test mode)
- Apply migration 310 to sandbox (needs owner trigger)
- Run existing test harness (already written at
  `scripts/test-stripe-webhook-trial-lifecycle.mjs`)
- Verify 7-day trial → paid conversion → cancel · all state transitions

### Deliverable 9 · NEX Chat Theme purchase flow (R31e)
- Separate Stripe Checkout for theme one-time purchases
- Entitlement write to `nex_theme_purchase` + `nex_theme_ownership`
- UI wire-up from `/chat-themes-library`

### Deliverable 10 · NEX storage/bandwidth pack purchases (R31f)
- Mirror the Shop subscription pattern for recurring add-ons
- Wire Upgrade buttons on `/settings/storage`
- Metering + enforcement (already written round 29; awaits migration 308 apply)

### Deliverable 11 · Public legal pages (R31g · blocked on owner facts)
- Seller Terms · Buyer Terms · Payment Terms · Refund Policy · Shipping ·
  Contact · Subscription Terms · Acceptable Use
- Draft text ready to populate · placeholders flagged for 6 missing
  owner facts
- Non-publication until (a) facts supplied (b) legal review

### Deliverable 12 · Live-readiness verification (R31h · final gate)
- Stripe Connect Platform approval (needs NEX legal entity submitted)
- Live API credentials in production env (owner infra action)
- Webhook endpoint registered in Stripe dashboard for live mode
- Real end-to-end payment · $1 test with real card
- Audit log of every deliverable · claims matched to evidence

## Owner facts still required (NOT inventable)

Six items block Deliverables 11-12:

1. NEX legal entity name
2. Country of incorporation
3. Registered office address
4. Company registration number
5. VAT / tax ID
6. Canonical support email (pick ONE of the 3 currently inconsistent)

Deliverables 1-10 proceed without these. Deliverable 11 (legal pages)
drafts text with placeholders. Deliverable 12 cannot complete without
these facts submitted to Stripe for platform approval.

## Reporting discipline

Each slice produces a 5-heading report:
- **BUILT** — code written
- **WIRED** — integrated end-to-end
- **VERIFIED** — tested with evidence
- **REMAINING** — scope still open
- **BLOCKED** — owner facts or external approvals pending

Any claim of "fully active" or "live-ready" requires evidence in
VERIFIED. No claim without evidence.

## Commit / push policy

Round 31 work accumulates uncommitted until explicit owner `"commit"`
trigger. Push separately via `"push"`. Nothing moves to GitHub without
both.
