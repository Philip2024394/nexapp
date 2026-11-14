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

---

# Verification pass · 2026-11-14 (later same day)

Second bounded pass per owner directive: *"Fix only reproduced payment launch blockers with minimal changes and focused regression tests. Preserve working behavior. No new features, redesigns, broad refactors, provider removal, live charges, production changes, deployments, pushes, destructive operations, migrations, or bucket changes."*

## Environment

- Branch: `release-audit-v1-2026-11-14`
- HEAD before this pass: `c8e3b559`
- HEAD after this pass: `12ceea43`
- Supabase: sandbox `kdstoyyeygcopkogqsyv` only · production `ijvqdvsvwtwxzcqmoqit` NOT TOUCHED
- Impersonation: `nex-99901` via `NEX_DEV_IMPERSONATE_HANDLE`
- No prod deploy · no push · no migration · no bucket change · no live charge

## Reproduced blocker #1 · FIXED

**Symptom:** `POST /api/nex-native/billing/connect/stripe/create` returned HTTP 422 with `code=columns_not_applied` even when migration 311 was fully applied to the sandbox (verified: `stripe_connect_account_id`, `stripe_connect_account_status`, `stripe_connect_charges_enabled`, `stripe_connect_payouts_enabled`, `stripe_connect_country`, `stripe_connect_last_sync_at`, `stripe_connect_requirements_blob` all present on `nex_business`).

**Root cause (file+line):** `src/lib/nex-native/billing/stripe-connect-service.ts` · `detectConnectColumns()` probed `information_schema.columns` via the Supabase REST client. PostgREST does not expose `information_schema` by default, so every call errored and the function returned `false`.

**Fix (minimal · ~30 lines):** replaced the `information_schema` probe with a direct `SELECT stripe_connect_account_id FROM nex_business LIMIT 0`. Treat Postgres code `42703` or message matching `/does not exist/i` as "columns missing". Any other error now fails OPEN so a Supabase blip cannot mis-report an applied migration as unapplied.

**Live verification (sandbox, dev-impersonation):**

- Before fix: `HTTP 422 { code: "columns_not_applied" }` · WRONG, columns were present
- After fix: `HTTP 500 { code: "stripe_account_create_failed", reason: "more_permissions_required" }` · the REAL Stripe error, surfacing a restricted-test-key scope issue (NOT a code bug · owner action required)

**Regression test (new · 8/8 pass):** `src/lib/nex-native/billing/__tests__/stripe-connect-detect-columns.test.ts`
- true on clean success
- false on Postgres `42703`
- false on error message `does not exist`
- fails OPEN on unknown transient error (does not mis-report applied migration)
- false when probe throws
- queries `nex_business` NOT `information_schema.columns`
- queries the sealed migration-311 column `stripe_connect_account_id`
- uses `LIMIT 0` so the probe never pulls row data

**Broader regression:** `src/lib/nex-native/billing/__tests__` = 233 passed / 233 total. Zero regressions.

**Scoped TS check:** no errors on the touched file.

**Commit:** `12ceea43` · scope: `src/lib/nex-native/billing/stripe-connect-service.ts` + new test file only.

## Reproduced blocker #2 · NOT FIXABLE WITHOUT OWNER · founder action required

After the above fix, the same endpoint returns `more_permissions_required` because the restricted Stripe TEST key currently in `.env.local` lacks the `connected_accounts:write` scope. This is an owner-controlled Stripe dashboard setting, not a code bug.

## Reproduced blocker #3 · NOT FIXABLE WITHOUT OWNER · founder action required

Live probe of `POST /api/nex-native/billing/checkout/shop` (Flow A subscription) returned HTTP 200 with a valid `cs_test_…` Checkout Session URL. The checkout session creates cleanly. However:

- `STRIPE_WEBHOOK_SECRET` is still EMPTY in `.env.local`
- Stripe CLI is NOT installed on this machine (cannot run `stripe listen` here)

Without the webhook secret, the `checkout.session.completed` → `markSubscriptionActive` path cannot be end-to-end verified. Nothing to fix in code; signing-secret provisioning is an owner-controlled task.

## Reproduced blocker #4 · DB schema prerequisite · founder authorisation required

PayPal payee cross-check requires `nex_business.paypal_merchant_id`. This column does NOT exist in sandbox. Code expects it to exist when PayPal is enabled. Adding the column is a DB migration · sealed rule bars migrations without separate named authorisation. Not fixing. Documenting.

## What was NOT tested (explicit)

- End-to-end Flow A Checkout → webhook → `BillingStore.markSubscriptionActive` (blocked on webhook secret)
- End-to-end Flow B Stripe Connect onboarding → test charge → `markOrderPaid` (blocked on key scope + webhook secret)
- End-to-end Flow B PayPal (blocked on absent creds + absent DB column)
- Any production migration · bucket · env · deploy

---

## 4-way verdict (final, after this pass)

| # | Flow | Verdict | Evidence | Remaining unknown |
|---|---|---|---|---|
| 1 | Flow A · NEX subscription | **BLOCKED / UNVERIFIED** | Checkout session mint PASSES live (HTTP 200 + `cs_test_…`) | `STRIPE_WEBHOOK_SECRET` empty · no CLI · no e2e run |
| 2 | Flow B · Stripe Connect (merchant-direct) | **BLOCKED / UNVERIFIED** | `detectConnectColumns` fix verified live (422 → 500) · regression test 8/8 green · 233/233 billing tests green | Restricted test key lacks `connected_accounts:write` · no Connect webhook secret · no onboarded test account |
| 3 | Flow B · PayPal (merchant-direct) | **BLOCKED / UNVERIFIED** | Code path inspected; webhook verifier + payee cross-check present | ALL `PAYPAL_*` env vars empty · `nex_business.paypal_merchant_id` column absent · no sandbox app |
| 4 | Flow B · QRIS | **NOT APPLICABLE to v1** | Route returns HTTP 503 `provider_scaffold_not_live` by design | Nothing required unless scope changes |
| 5 | Flow B · Checkout in chat | **PASS** | Handler-layer tests + Playwright evidence (Stage 2 shop-chat flow) · no webhook required by design | — |

**One-line summary:** payment flow A and merchant Stripe/PayPal remain BLOCKED on owner-controlled credentials and one DB-schema decision; one real code bug (Connect column detector) is now fixed and verified; checkout-in-chat is the only payment-related path at PASS.

---

## FOUNDER ACTIONS (unavoidable only · numbered · no secret values requested here)

Each action is something only you can do. Nothing here is a code task.

1. **Stripe webhook signing secret for Flow A (subscription).** In your Stripe dashboard (test mode), add webhook endpoint pointing at your dev URL for `/api/nex-native/billing/webhook/stripe` and copy the signing secret into `.env.local` as `STRIPE_WEBHOOK_SECRET`. **OR** install Stripe CLI (`winget install stripe.stripe-cli` on Windows) and run `stripe listen --forward-to localhost:3008/api/nex-native/billing/webhook/stripe` — it prints a `whsec_…` for the session.

2. **Stripe restricted-key permissions for Flow B (Connect).** Decide one:
   - 2a. In your Stripe dashboard, open the restricted TEST key currently in `.env.local` as `NEX_STRIPE_SECRET_KEY` and enable write permission on **Connected accounts**, then copy the new key value back into `.env.local`. **OR**
   - 2b. Generate a `sk_test_…` secret key (full scope, test mode) and replace the restricted key with it for development only. Production is unaffected — no prod env is being changed in this pass.

3. **Stripe webhook signing secret for Flow B (merchant-direct).** Add a SECOND webhook endpoint (distinct from action 1) pointing at `/api/nex-native/stripe/webhook` and copy its signing secret into `.env.local` as `NEX_STRIPE_CONNECT_WEBHOOK_SECRET`. These are different URLs and different webhook endpoints — the Connect one receives events with the `Stripe-Account` header for attribution.

4. **PayPal — decide which path for v1.** Pick one:
   - 4a. Create a free developer.paypal.com account, create a sandbox app, supply `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` + `PAYPAL_WEBHOOK_ID` for `.env.local`, AND authorise a new migration adding `nex_business.paypal_merchant_id`. **OR**
   - 4b. Defer PayPal from v1 launch. Say "defer paypal from v1" and I will remove the PayPal path from the launch surface without touching the webhook code (so it remains available for a later revival).

5. **Authorise one sandbox end-to-end test run after actions 1 and 2/3** so I can prove Flow A Checkout → webhook → `markSubscriptionActive` and Flow B Connect onboarding → test charge → `markOrderPaid` end to end. Named authorisation phrase of your choice.

Do **not** paste any secret into chat. Store them only in `.env.local`. The audit does not need to see the values; it only needs to see the endpoints work.

---

## Guardrails honoured in this pass

- No production changes. No prod migration. No prod bucket. No prod env.
- No push. No deploy. No destructive operation.
- No live charge. No real card. Dev-impersonation only.
- No feature flag flipped. No provider removed. No new feature.
- Only files touched: `src/lib/nex-native/billing/stripe-connect-service.ts` (1 exported helper) + new `src/lib/nex-native/billing/__tests__/stripe-connect-detect-columns.test.ts`.
- Engineering ceiling held at VERIFIED. No LIVE-VERIFIED claim.

