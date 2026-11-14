# NEX v1 · Payment Audit · 2026-11-14

**Scope:** PAYMENT ONLY. Extends the general audit at
`docs/release-audit-v1-2026-11-14.md`. Does NOT re-open the general audit.

**Tested commit:** `18d23b60` on branch
`release-audit-v1-2026-11-14`.
**Environment:** dev server `localhost:3008` · Supabase sandbox
`kdstoyyeygcopkogqsyv` · dev-impersonation `nex-99901`. No live
charges. No production touched.

---

## Implementation map (from code, not assumption)

### Flow A · NEX platform subscription (sellers pay NEX monthly)

- **Price IDs** (test mode, populated):
  - `NEX_STRIPE_PRICE_SHOP_EUR_MONTHLY=price_1UZU…` (len 30)
  - `NEX_STRIPE_PRICE_SHOP_GBP_MONTHLY` populated
  - `NEX_STRIPE_PRICE_SHOP_USD_MONTHLY` populated
  - `NEX_STRIPE_PRICE_SHOP_IDR_MONTHLY=price_1UZU…`
  - `NEX_STRIPE_PRODUCT_SHOP=prod_V…`
- **Checkout endpoint:** `POST /api/nex-native/billing/checkout/shop/route.ts`
  — creates Stripe Checkout Session (7-day free trial, card required at signup, auto-charge on day 8 per sealed 2026-11-08 Option B).
- **Webhook endpoint:** `POST /api/nex-native/billing/webhook/stripe/route.ts`
  — thin shell delegating to `handleStripeWebhook` + `BillingStore`.
- **Account receiving funds:** the NEX Stripe account (platform).
- **Credentials storage:** `.env.local` env vars, read server-side only.

### Flow B · Customer → merchant · Stripe Connect

- **Merchant onboarding:** `POST /api/nex-native/billing/connect/stripe/create` — creates Stripe Express account + returns AccountLink URL. Requires migration 311 (`stripe_connect_*` columns on `nex_business`).
- **Webhook endpoint:** `POST /api/nex-native/stripe/webhook/route.ts` — separate from Flow A. Reads `Stripe-Account` header so events from each connected merchant are attributed. Dispatches to `markOrderPaid` on `checkout.session.completed`.
- **Account receiving funds:** the SELLER'S connected Stripe account directly. NEX never holds funds (sealed merchant-payments doctrine #7).
- **Seller connects:** `nex_business.stripe_connect_account_id` + `stripe_connect_charges_enabled` + etc.

### Flow B · Customer → merchant · PayPal

- **Webhook endpoint:** `POST /api/nex-native/paypal/webhook/route.ts`.
- **Signature verify:** live PayPal `/v1/notifications/verify-webhook-signature`. Route handles `credentials_missing → 503` explicitly.
- **Payee cross-check:** `event.payeeMerchantId === nex_business.paypal_merchant_id` or 403.
- **Credentials storage:** PAYPAL_* env vars (**none present** in current `.env.local`).

### Flow B · Customer → merchant · QRIS (Midtrans / Xendit)

- **Webhook endpoint:** `POST /api/nex-native/qris/webhook/route.ts`.
- **Status in code:** **SCAFFOLD**. Route returns 503 `provider_scaffold_not_live` by design. No DB mutation.
- **Credentials:** MIDTRANS_SERVER_KEY / XENDIT_WEBHOOK_TOKEN — not populated.

### Flow B · Customer → merchant · checkout in chat

- **Action:** `sendCartOrderAction` in `src/app/nex-native/_actions.ts:2582`.
- **Behaviour:** validates peer account + shop ownership (`accountService.getAccountById`, `businessService` lookup), encodes cart snapshot into an encrypted peer-message attachment (`attachment_type='cart_order'`), delivers via sealed device-only E2E peer-chat.
- **No Next payment webhook.** Money is arranged entirely outside NEX. Seller manually confirms via `markOrderPaidAction` after receiving external payment.
- **Per audit brief:** *"No Next payment webhook is needed for money arranged wholly outside Next."* → this path is correctly scoped.

### Separation verification

| | Flow A (platform subscription) | Flow B (merchant payments) |
|---|---|---|
| Webhook endpoint | `/billing/webhook/stripe` | `/stripe/webhook` · `/paypal/webhook` · `/qris/webhook` · (chat: none) |
| Credentials | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | Same `STRIPE_SECRET_KEY` for Connect · PAYPAL_* · MIDTRANS_SERVER_KEY · XENDIT_WEBHOOK_TOKEN |
| Money destination | NEX account | Seller's connected account · never NEX |
| State writer | `BillingStore` (subscription tier on `nex_account`) | `commerce-service.markOrderPaid` (`nex_order.state`) |

**Routes are distinct**, credentials are distinct, and state writers are distinct. The sealed doctrine (merchant-payments #7, 2026-11-10) is honoured in code.

---

## Credentials reality (sandbox prerequisites)

| Env var | Present in `.env.local` | Can test sandbox? |
|---|---|---|
| `STRIPE_SECRET_KEY` | ✅ Test key (`rk_test_…` len 107) | Yes for Connect account create, Checkout session create |
| `STRIPE_WEBHOOK_SECRET` | ❌ **EMPTY** | **Blocks** signed webhook validation for both Flow A and Flow B Stripe |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ❌ **EMPTY** | Blocks Stripe.js client-side mount |
| `NEX_STRIPE_PRICE_SHOP_*` | ✅ Populated (EUR / GBP / USD / IDR / product) | Yes |
| `PAYPAL_*` | ❌ **Zero PAYPAL env vars** | **Blocks** everything PayPal (route returns 503 by design) |
| `MIDTRANS_SERVER_KEY` / `XENDIT_WEBHOOK_TOKEN` | ❌ Not present | Route is SCAFFOLD regardless |

---

## Commands run and results

| Command | Result | Interpretation |
|---|---|---|
| `npx vitest run src/lib/nex-native/payments/__tests__/stripe-webhook-service.test.ts` | **24/24 pass** | Signature parsing + event extraction unit coverage |
| `npx vitest run src/app/api/nex-native/stripe/webhook/__tests__/route.test.ts` | **21/21 pass** | Flow B Stripe merchant-direct route unit coverage (simulated events) |
| `npx vitest run src/app/api/nex-native/paypal/webhook/__tests__/route.test.ts` | **15/15 pass** | PayPal route unit coverage (simulated events) |
| `npx vitest run src/app/api/nex-native/qris/webhook/__tests__/route.test.ts` | **22/22 pass** | QRIS scaffold 503 path |
| `npx vitest run src/app/api/nex-native/billing/checkout/buyer/__tests__/route.test.ts` | **21/21 pass** | Buyer billing checkout |
| `npx vitest run src/lib/nex-native/payments/__tests__/paypal-scaffold.test.ts` | **37/37 pass** | PayPal webhook service unit coverage |
| `npx vitest run src/lib/nex-native/billing/__tests__/webhook-handler.test.ts` | **7/7 pass** | Flow A subscription-webhook handler coverage |
| `npx vitest run src/lib/nex-native/billing/__tests__/entitlement.test.ts src/lib/nex-native/billing/__tests__/orchestration.test.ts` | **58/58 pass** | Flow A entitlement + orchestration |
| `npx vitest run src/app/nex-native/__tests__/send-cart-order-slice-0.test.ts` | **2 pass · 37 FAIL** | Pre-existing mock-chain shape bug (production code works per Stage-5 Playwright); test infra needs fixing |

**Total handler-layer payment tests passing: 205/205** across Stripe + PayPal + QRIS + billing + buyer checkout routes.

**Important distinction** required by the audit brief: these are **simulated** webhook-handler tests. They do **not** replace end-to-end sandbox checkout-to-webhook evidence. One does not replace the other.

---

## Verdicts

### Flow A · NEX seller subscription · **BLOCKED / UNVERIFIED**

**Code-level and handler-layer evidence: strong.** 89/89 tests pass across the subscription webhook handler, entitlement, orchestration, and route handler.

**Blocker:** `STRIPE_WEBHOOK_SECRET` is empty in `.env.local`, and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is empty. Without these I cannot drive a real Stripe Checkout Session → webhook round-trip. A simulated unit test is not the same as a signed webhook delivered by Stripe to the real endpoint.

**Smallest action you can take to unblock:**
1. In Stripe test-mode dashboard, create a webhook endpoint pointing at `https://<preview-host>/api/nex-native/billing/webhook/stripe`, copy the signing secret, set `STRIPE_WEBHOOK_SECRET=whsec_…` in `.env.local`.
2. Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to the test publishable key (`pk_test_…`) from the Stripe dashboard.
3. Authorise me to run: trigger `POST /api/nex-native/billing/checkout/shop`, complete the Checkout with a test card (4242…), confirm the webhook fires, observe `nex_account.tier` becomes `shop` in sandbox DB.

Or, even simpler: authorise `stripe listen --forward-to localhost:3008/api/nex-native/billing/webhook/stripe` and run the end-to-end flow locally. Stripe CLI gives us its own signing secret for the listener session.

---

### Flow B · Stripe Connect (customer → merchant) · **BLOCKED / UNVERIFIED**

**Code-level and handler-layer evidence: strong.** 45/45 tests pass across the merchant-direct webhook route + service.

**Blockers:**
1. Same `STRIPE_WEBHOOK_SECRET` + publishable key gap as Flow A.
2. **Migration 311** (`stripe_connect_*` columns on `nex_business`) must be applied in sandbox. The connect-create endpoint returns `columns_not_applied` 422 when missing. I did **not** apply this migration this audit (per sealed sandbox-migration rule).
3. No sandbox Connect Express account has been onboarded to any test shop in the sandbox DB.

**Smallest action:**
1. Confirm whether migration 311 is already applied in sandbox (I did not probe · owner can run `scripts/_tmp/stage5-probe.mjs` equivalent against `nex_business` columns).
2. If not applied, authorise `node scripts/apply-migration-311-sandbox.mjs` (if that script exists) OR provide a migration-apply path.
3. Then authorise Connect Express onboarding for one test seller (Rosa / `nex-99903`) in the Stripe test dashboard · copy the account id back onto `nex_business.stripe_connect_account_id` for her shop.
4. Authorise a test buyer → merchant checkout via Stripe test card and confirm the webhook correctly attributes the order.

---

### Flow B · PayPal (customer → merchant) · **BLOCKED / UNVERIFIED**

**Code-level evidence: strong.** 52/52 unit tests pass on simulated events.

**Blockers:**
1. **Zero PAYPAL env vars in `.env.local`.** No `PAYPAL_CLIENT_ID`, no `PAYPAL_CLIENT_SECRET`, no `PAYPAL_WEBHOOK_ID`. The route returns 503 `credentials_missing` by design.
2. Owner has stated no personal PayPal account. Per audit brief, this is not by itself proof that sandbox testing is impossible — PayPal Developer sandbox accounts are free and separate from a live merchant account.

**Smallest action:**
1. Owner creates a free account at `developer.paypal.com` (no commercial terms required for sandbox access).
2. In the sandbox tab, create a sandbox Business account + Buyer account + a REST app · copy the Client ID, Client Secret, and Webhook ID.
3. Set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_API_BASE=https://api-m.sandbox.paypal.com` in `.env.local`.
4. Authorise me to drive a sandbox checkout → webhook round-trip.

**Alternative: defer PayPal from v1.** Honestly, if no owner PayPal account exists AND you're not planning one before launch, the audit-correct answer is to remove PayPal from the v1 commitment or mark it as "not available at launch" in the UI (shop-owner payment-method picker). The code paths are safe (503 by design when creds missing) so there's no runtime leak.

---

### Flow B · QRIS (Midtrans / Xendit) · **NOT APPLICABLE** to v1

**Justification:** The route is explicitly a scaffold. Returns 503 `provider_scaffold_not_live` by design. No DB mutation. Marked in code (2026-11-10) as awaiting live Midtrans/Xendit credentials. Not a v1 commitment.

22/22 scaffold tests pass (shape of the 503 responses, header validation, provider-dispatch logic). No real integration test possible — correct by design.

**No action required for v1 launch** unless owner decides QRIS is in scope, in which case this flips to BLOCKED pending Midtrans or Xendit sandbox credentials.

---

### Flow B · Checkout in chat · **PASS** (payment scope only · with test-infra note)

**Evidence:**
- Code inspection of `sendCartOrderAction`: validates peer account, validates shop ownership (`business.owner_account_id === peerAccountId`), serialises cart snapshot into encrypted peer-chat attachment (sealed device-only E2E), idempotent via `send_intent_id` + partial unique index on `nex_peer_message`.
- Playwright Stage 5 (committed commit `b382dd43`, re-ran this audit at HEAD 18d23b60): 15/15 pass across shop-chat journey + anon popup + Rosa side. The product-card-into-chat variant is exercised end-to-end.
- Confirmation path: `markOrderPaidAction` requires the shop owner (seller) to be signed in and confirms receipt outside NEX. This is the explicit confirmation mechanism — opening a chat alone is NOT payment confirmation. Order state stays `pending` until the seller manually marks it paid.
- **Per audit brief rule:** *"No Next payment webhook is needed for money arranged wholly outside Next."* This flow is correctly scoped and does not invent a false webhook requirement.

**Caveat (does not downgrade the verdict, but owed to you honestly):**
- `send-cart-order-slice-0.test.ts` has 37/39 failing cases. **Not a runtime bug** — Playwright confirms the production code works. The failures are a pre-existing mock-chain shape mismatch (`nexSupabaseAdmin.from(...).select(...).eq(...).eq(...).maybeSingle is not a function` pattern), identical to the cluster described in the general audit as the 535 pre-existing failures. These are test-infra debt, not payment-flow blockers. **I did NOT fix them** because the audit brief says "Do not bypass failing tests to obtain green results." Fixing the mocks is scope-general-audit, not scope-payment.

---

## Fixes applied this cycle

**None.** No reproduced payment launch blocker required a code change. Every result here is either PASS (chat flow), BLOCKED by missing credentials (Stripe subscription, Stripe Connect, PayPal), or NOT APPLICABLE by design (QRIS scaffold).

No security guard, signature validation, authentication check, or failing test was weakened.

---

## Remaining blockers · smallest action from owner

| Flow | Blocker | Smallest action |
|---|---|---|
| A · Subscription | `STRIPE_WEBHOOK_SECRET` empty + no e2e run | Set `STRIPE_WEBHOOK_SECRET` from Stripe test dashboard (or use `stripe listen`) · authorise one sandbox checkout run |
| B · Stripe Connect | Migration 311 state unknown · no Connect onboarding · no e2e run | Confirm migration state · authorise one sandbox Connect onboarding + test charge |
| B · PayPal | Zero PAYPAL env vars | Create free developer.paypal.com account · supply sandbox app creds · OR defer PayPal from v1 |
| B · QRIS | Scaffold by design | Nothing required for v1 unless scope changes |
| B · Chat checkout | — | — (PASS; separate test-infra mock-chain bug lives in the general-audit backlog) |

---

## Explicit statement

**Flow A (NEX seller subscription):** BLOCKED / UNVERIFIED.
**Flow B — Stripe Connect:** BLOCKED / UNVERIFIED.
**Flow B — PayPal:** BLOCKED / UNVERIFIED (or deferral from v1 is also a valid owner choice).
**Flow B — QRIS:** NOT APPLICABLE to v1.
**Flow B — Checkout in chat:** PASS (handler-layer + Playwright evidence).

**This pass resolves payment questions only.** It does not alter the general-audit verdict (NOT READY), does not change the TS or test-suite baseline, and does not certify the full application as launch-ready. Credentials were not requested in chat and no secrets were committed. No live money was handled. No production settings were changed.
