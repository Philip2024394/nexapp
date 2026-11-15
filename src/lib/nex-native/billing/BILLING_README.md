# NEX Billing · README

Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED to
production).

This document is the entry point for every NEX Billing surface. Read it
before touching any file in `src/lib/nex-native/billing/`,
`src/app/api/nex-native/billing/`, or `src/app/nex-native/billing/`.

---

## Scope

NEX Billing manages:

- **Shop subscriptions** · €19.99/mo Standard, €29.99/mo Unlimited
- **Vault subscriptions** · €9.99/mo for 5 GB base, 25/50/100 GB upgrades (prices TBD)
- **NEX Sell additional listings** · 3 free/month, then €1.30 per extra listing

NEX Billing does NOT handle buyer-seller payments for shop goods. That
is sealed doctrine: "NEX never handles payments" refers to goods settlement.
NEX handles only its own subscription revenue + the Sell listing fee.

Payment processor: **Stripe** (test-mode during development · production
not configured yet).

---

## File layout

```
src/lib/nex-native/billing/
├── types.ts                       · shared TS types (SubscriptionStatus, AccessLevel, etc.)
├── entitlement.ts                 · accessLevel() · pure decision tree
├── enforcement.ts                 · per-feature caps + decisions (Shop products, Vault file size, Vault quota, Sell listings)
├── price-registry.ts              · country-aware Stripe price-ID mapping (IE / ID / HQ worldwide)
├── store.ts                       · BillingStore interface (shared contract)
├── supabase-store.ts              · real pg-backed BillingStore adapter + withTransaction + withAccountLock
├── webhook-processor.ts           · atomic claim + 9 event-type dispatcher
├── webhook-handler.ts             · Stripe signature verify → delegate to processor → HTTP outcome
├── checkout-session.ts            · pure checkout-creation logic (store + Stripe interface injected)
├── cancellation.ts                · cancel-at-period-end logic + timeline helpers
├── reconciliation.ts              · pending-mapping cron handler + replay guard
├── sell-payment-intent.ts         · €1.30 Sell listing PaymentIntent service
├── sell-listing-count.ts          · DB count of listings-this-month for D4 atomic path
├── vault-quota.ts                 · atomic Vault quota reservation (D4 pattern)
├── MASTER_BUILD_CHECKLIST.md      · living progress tracker + verification tier matrix
├── ENFORCEMENT_COVERAGE_MAP.md    · what's wired vs what still has an open owner decision
├── F_SERIES_DESIGN.md             · design doc for atomic Vault quota wire-in (option A vs B)
├── BILLING_README.md              · this file
└── __tests__/
    ├── entitlement.test.ts
    ├── pre-integration-review.test.ts
    ├── orchestration.test.ts
    ├── in-memory-store.ts         · FakePool-backed BillingStore mock
    ├── supabase-store-sql.test.ts
    ├── sell-payment-intent.test.ts
    ├── webhook-handler.test.ts
    ├── vault-quota.test.ts
    └── price-registry-country.test.ts

src/app/api/nex-native/billing/
├── webhook/stripe/route.ts        · POST · Stripe webhook endpoint
├── checkout/route.ts              · POST · authenticated checkout session creation
├── sell-listing-charge/route.ts   · POST · Sell PaymentIntent charge
├── cron/reconcile/route.ts        · POST + GET · Vercel Cron reconciler
└── health/route.ts                · GET · bearer-gated health probe

src/app/nex-native/billing/
├── page.tsx                       · customer billing page (subscription state, controls)
├── _actions.ts                    · cancelProductSubscriptionAction + changeProductTierAction
└── _customer-controls.tsx         · client component · wires buttons to actions

src/app/nex-native/hq/billing/
├── page.tsx                       · HQ admin lookup page
├── _actions.ts                    · hqRevokeBillingAccessAction + hqClearBillingRevocationAction
└── _admin-override-panel.tsx      · client component · revoke + clear forms

src/app/nex-native/dev/billing-stripe-sandbox/
├── page.tsx                       · dev-only Stripe test-mode sandbox (404 in production)
└── _sandbox-actions.tsx           · client component · 4 checkout trigger buttons

nex-supabase/migrations/
├── 207_nex_onboarding_and_vault_trial.sql
├── 257_nex_account_independent_shop_vault_entitlements.sql
└── 258_nex_billing_foundation.sql

scripts/
├── apply-migration-207.mjs         · production applier (hostname-pinned)
├── apply-migration-207-scratch.mjs · localhost-only applier
├── apply-migration-257.mjs         · production applier
├── apply-migration-257-scratch.mjs · localhost-only applier
└── apply-migration-258-scratch.mjs · localhost-only applier
```

---

## Request flow · subscription purchase

```
Customer                NEX                       Stripe
   │                     │                           │
   │ POST /api/.../checkout {product, intendedTier, successUrl, cancelUrl}
   ├────────────────────►│                           │
   │                     │ resolve session           │
   │                     │ resolve price-ID from registry
   │                     │ check adverse-event block (E3)
   │                     │ INSERT nex_billing_checkout_session (pending)
   │                     │ ──────► stripe.checkout.sessions.create (idempotency_key)
   │                     │                           │
   │                     │ ◄──── {id, url}           │
   │                     │ UPDATE checkout row (stripe_checkout_session_id, status=awaiting_payment)
   │ ◄────────────────── {url}
   │                                                 │
   │ (redirect to Stripe)                            │
   │ ────────────── pay with test card 4242 ──────► │
   │                                                 │
   │                                                 │ fires webhook events ↓
   │                     │ POST /api/.../webhook/stripe
   │                     │ ◄───────────────────────  │
   │                     │ verify signature
   │                     │ claimEvent (ON CONFLICT DO NOTHING RETURNING)
   │                     │ dispatch by event.type:
   │                     │   checkout.session.completed → bind sub to account row
   │                     │   customer.subscription.created → status=incomplete, tier set
   │                     │   invoice.payment_succeeded → status=active, periodEnd set
   │                     │ finalizeEvent (outcome)
   │                     │ ──────► HTTP 200 ────────►│
   │                                                 │
   │ (customer redirected to success_url)            │
   │ GET /nex-native/billing                         │
   │ ────────────────────►│
   │                     │ readProductView(account, "shop") → sees status=active
   │ ◄──────────────── rendered page with active subscription
```

---

## Verification tier reminder

| Tier | Meaning |
|---|---|
| **implemented** | Code exists + TypeScript compiles |
| **locally tested** | Passes `[pure]` or `[in-memory]` tests · no DB, no Stripe |
| **Gate-1 verified** | `[postgres]` scratch rehearsal passes R-1..R-14 |
| **Gate-2 verified** | `[stripe]` test-mode walkthrough passes signature + full lifecycle |
| **production verified** | Deployed, observed working on real browser, hash recorded |

**No component may skip a tier.** 156 locally-passing tests do NOT equal
Gate-1 verification. Gate-1 passing does NOT equal Gate-2 verification.
Production is explicit owner authorisation only.

---

## Owner-recommended decisions (2026-11-02 · implementation guidance)

| Code | Rule |
|---|---|
| **D1** | Gratis = 10 active products · Standard = 50 · Unlimited = fair use. **Paid Shop entitlement supersedes the Gratis cap.** |
| **D2** | "10 video slots" on Standard = up to **10 active products each with an attached video**. Not a lifetime upload count. |
| **D4** | Per-account DB-row lock with transaction-level row locking. Quota check + reservation atomic. Applied consistently to Vault + Sell. |
| **D5** | Stripe-hosted Checkout for Sell €1.30 charges. **Listing stays pending until a verified webhook event confirms payment.** Never release on redirect alone. |
| **Country pricing** | Independent IE / ID / HQ registries parameterised by `NEX_APP_IDENTITY`. Do NOT invent or publish ID/HQ amounts. |

---

## Environment variables required

### For webhook endpoint

| Var | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Server-side Stripe SDK · `sk_test_…` during Gate 2, `sk_live_…` only after production authorisation |
| `STRIPE_WEBHOOK_SECRET` | HMAC verification secret from the Stripe dashboard · `whsec_…` |

### For checkout + subscription changes

Same `STRIPE_SECRET_KEY` as above.

### For price-registry resolution

**Canonical scheme (sealed 2026-11-08 Scope Reduction · Round 29h).** The
Shop subscription ships as ONE package — the 2-tier `STANDARD` /
`UNLIMITED` model is retired. Checkout at runtime reads the per-currency
price IDs via `/api/nex-native/billing/checkout/shop/route.ts`:

- `NEX_STRIPE_PRICE_SHOP_EUR_MONTHLY` (Ireland · €)
- `NEX_STRIPE_PRICE_SHOP_GBP_MONTHLY` (UK · £)
- `NEX_STRIPE_PRICE_SHOP_USD_MONTHLY` (Worldwide · $)
- `NEX_STRIPE_PRICE_SHOP_IDR_MONTHLY` (Indonesia · Rp)

Vault + legacy Shop tiers (kept ONLY so webhook reverse-lookup can
still resolve grandfathered subscriptions created before Scope
Reduction · NEW subscriptions use the canonical scheme above):

- `STRIPE_PRICE_SHOP_STANDARD` / `..._IE` / `..._ID` (grandfathered · do not use)
- `STRIPE_PRICE_SHOP_UNLIMITED` / `..._IE` / `..._ID` (grandfathered · do not use)
- `STRIPE_PRICE_VAULT_5GB` (plus 25GB / 50GB / 100GB) · per-identity suffixes supported

### For reconciliation cron

| Var | Purpose |
|---|---|
| `NEX_BILLING_CRON_SECRET` | Bearer token Vercel Cron must present |

### For health check

| Var | Purpose |
|---|---|
| `NEX_BILLING_HEALTH_SECRET` | Bearer token for `/api/.../billing/health` |

### For database

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Canonical Supabase pooler URL (project ref `ijvqdvsvwtwxzcqmoqit`) |
| `SCRATCH_DATABASE_URL` | **Gate 1 only** · localhost `nex_rehearsal_257` · never production |

---

## Gate progression

### Gate 1 · scratch Postgres rehearsal (owner responsibility to execute)

1. Create `D:\pg-scratch\` tablespace directory + grant NetworkService ACL
2. Set `SCRATCH_DATABASE_URL` in a PowerShell session
3. Launch Claude Code from that session
4. Say `proceed` · Claude runs:
   - `CREATE TABLESPACE` + `CREATE DATABASE nex_rehearsal_257`
   - Baseline bootstrap (migration history + synthetic bisnis accounts)
   - 207 → 257 → 258 via the scratch runners
   - R-1..R-14 verification suite
5. Report produced. Any failures block Gate 2.

### Gate 2 · Stripe test-mode walkthrough

1. Create Stripe test-mode account
2. Create test products + prices for Shop Standard, Shop Unlimited, Vault 5/25/50/100 GB
3. Add price IDs to `.env.local` (never commit)
4. Add webhook endpoint in Stripe dashboard pointing at `/api/nex-native/billing/webhook/stripe`
5. Capture `STRIPE_WEBHOOK_SECRET`
6. Visit `/nex-native/dev/billing-stripe-sandbox` locally and run through:
   - Shop Standard checkout → pay with 4242 4242 4242 4242 → see status=active
   - Vault 5GB checkout → same
   - Cancel a subscription · verify grace behavior
   - Trigger a refund in Stripe dashboard · verify webhook handles correctly
   - Trigger a chargeback (Stripe test-mode supports this) · verify access blocked
7. Report produced. Any failures block Gate 3.

### Gate 3 · real server-side enforcement (connect caps to real operations)

- Shop product cap wire-in (pending D1 confirmation)
- Vault quota wire-in (pending F-series decision · option A or B)
- Video slot cap wire-in (pending D2 implementation + schema linkage)

### Gate 4 · customer billing UI complete

- Billing page (`/nex-native/billing`) wired · DONE (drafted · needs Gate 1 to see real data)
- Shop template placement UI · **DESIGN SESSION NEEDED** · Claude will pause here
- Single product / single service page layout · **DESIGN SESSION NEEDED** · Claude will pause here

### Gate 5 · HQ admin surface

- Admin lookup page · DONE (drafted · needs Gate 1 to see real data)
- Admin override panel · DONE (drafted · needs Gate 1 to execute)

### Gate 6 · international support

- Ireland pricing · env var shape defined · amounts locked (€19.99 / €29.99 / €9.99 / €1.30)
- Indonesia pricing · env var shape defined · **amounts owner-owned, not yet set**
- Worldwide pricing · env var shape defined · **amounts owner-owned, not yet set**

### Gate 7 · end-to-end test suite

Four test categories labelled distinctly:
- `[pure]` · 36 passing
- `[in-memory]` · 120 passing (orchestration + adapter SQL shape + registry + handler)
- `[postgres]` · 0 (gated on Gate 1)
- `[stripe]` · 0 (gated on Gate 2)
- `[browser]` · 0 (gated on Gate 1 + rendering path)

### Gate 8 · production launch

Explicit owner authorisation only.

---

## Current test state

```
Test Files  9 passed (9)
     Tests  166 passed (166)
```

Breakdown:
- `entitlement.test.ts` · 23 pure
- `pre-integration-review.test.ts` · 27 pure+in-memory
- `orchestration.test.ts` · 35 in-memory
- `supabase-store-sql.test.ts` · 34 in-memory
- `sell-payment-intent.test.ts` · 10 in-memory
- `webhook-handler.test.ts` · 7 in-memory
- `vault-quota.test.ts` · 10 in-memory
- `price-registry-country.test.ts` · 19 pure
- (count may drift between reports · see `npx vitest run src/lib/nex-native/billing/`)

---

## How to run the sandbox locally

```powershell
# 1 · Set up a Stripe test-mode account at https://dashboard.stripe.com (test mode)
# 2 · Create test products + prices for each tier
# 3 · Add to .env.local (NEVER commit · gitignored):
#       STRIPE_SECRET_KEY=sk_test_...
#       STRIPE_WEBHOOK_SECRET=whsec_...
#       NEX_STRIPE_PRICE_SHOP_EUR_MONTHLY=price_...   # canonical
#       NEX_STRIPE_PRICE_SHOP_GBP_MONTHLY=price_...   # canonical
#       NEX_STRIPE_PRICE_SHOP_USD_MONTHLY=price_...   # canonical
#       NEX_STRIPE_PRICE_SHOP_IDR_MONTHLY=price_...   # canonical
#       STRIPE_PRICE_VAULT_5GB=price_...              # Vault tiers
# 4 · Run the local dev server
npm run dev
# 5 · Sign in to NEX locally
# 6 · Visit http://localhost:3008/nex-native/dev/billing-stripe-sandbox
# 7 · Click a Checkout button · follow the Stripe-hosted flow
# 8 · Use test card 4242 4242 4242 4242 · any future expiry · any CVC
```

---

## Known limitations · DO NOT ship without resolving

1. **F-series** · Vault quota is NOT yet enforced at the upload path. See `F_SERIES_DESIGN.md`.
2. **D1 wire-in** · Shop product cap is NOT yet connected to `createProduct`. Pending owner confirmation of the service-boundary approach.
3. **D2 schema** · Video slot cap requires `nex_product.has_video` linkage · schema follow-up required.
4. **214/257 collision** · `business_trial_status` added by both migrations. 214 must be amended with `IF NOT EXISTS` before any production apply.
5. **Trial access policy** · `TRIALING_ACCESS_LEVEL = "none"` is DRAFT. Owner must select A/B/C.
6. **Legal review** · DAC7/DSA/PSD2/consumer-protection/GDPR per Social Commerce D4 2026-11-01. Blocks public launch.
7. **UI design surfaces** · Shop template placement + single-product/service page layouts are not started. Owner wants to be involved · Claude pauses at those gates.

---

## Doctrine references

- Owner global rules: `C:/Users/Victus/.claude/CLAUDE.md`
- Project rules: `C:/Users/Victus/nexapp/CLAUDE.md` (Safety Constitution)
- Package Contract DRAFT 2026-10-20: `docs/doctrine/nex-package-contract-draft-2026-10-20.md`
- Vault entitlements policy B1-B8 2026-10-20: `docs/doctrine/nex-vault-entitlements-policy-sheet-2026-10-20.md`
- Service Principle DRAFT 2026-10-20: `docs/doctrine/nex-service-principle-draft-2026-10-20.md`
- Live Eligibility Contract 2026-10-27: `docs/doctrine/nex-live-eligibility-contract-2026-10-27.md`

---

## Sealed boundaries

Never without explicit owner authorisation:

- No commits · no pushes · no deployments
- No modification of migration 214
- No connection to canonical Supabase project outside the webhook / health / cron routes (and those only run server-side when env is configured)
- No live Stripe keys configured
- No change to `/packages`, `/welcome`, `/settings/tier`, Vault UI
- No change to `.env.local`
- No deletion of existing accounts, listings, or billing records
