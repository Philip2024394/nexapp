# NEX payment-gateway ownership & completion matrix · 2026-11-10

**Purpose.** Final payment architecture. Each payment journey mapped to one authoritative gateway. Honest BUILT/WIRED/TESTED/VERIFIED/REMAINING/BLOCKED per journey.

**Supersedes.** Any prior assumption that Stripe Connect routes buyer→shop payments. Today's sealed rules (2026-11-10) override the 2026-11-09 Round 31a Stripe-Connect-for-sellers direction where they conflict.

---

## Authoritative gateway ownership

| Payment purpose | Gateway |
|---|---|
| NEX member subscriptions (Shop package, etc.) | **Stripe** |
| NEX membership renewal + cancellation | **Stripe** |
| NEX member wallet top-up (pending approved design) | **Stripe** |
| Shop-owner commerce (seller receiving customer payments) | **PayPal** |
| Customer purchases from shops | **PayPal** |
| Founder-only Stripe account onboarding, PayPal account creation, pricing decisions | **Founder** |

**Hard rules.**
- PayPal MUST NOT appear in NEX member subscription flows.
- Stripe MUST NOT be the shop checkout option for buyer→seller payments.
- NEX never holds merchant funds · every method is merchant-direct.
- Founder tasks are credentials + business decisions · not unfinished engineering.

---

## Journey matrix

Legend: **B** Built · **W** Wired · **T** Tested · **V** Verified (sandbox) · **R** Remaining · **BL** Blocked

### J1 · Member registration + paid membership (Stripe)

| Field | Value |
|---|---|
| Gateway | Stripe |
| Route | `src/app/api/nex-native/billing/checkout/route.ts` |
| Service | `src/lib/nex-native/billing/checkout-session.ts` · `price-registry.ts` |
| DB tables (code) | `nex_billing_subscription`, `nex_billing_invoice`, `nex_entitlement` (via `billing/supabase-store.ts`) |
| DB tables (sandbox) | **NOT APPLIED** · mig 258 `nex_billing_foundation` was authored but not applied · only 311 + 312 present |
| Webhook | `src/app/api/nex-native/billing/webhook/stripe/route.ts` |
| Tests | `billing/__tests__/entitlement.test.ts` · `orchestration.test.ts` · `webhook-handler.test.ts` (pass) |
| State | **B · code built**; **W partial · tables not in sandbox DB**; **R · apply mig 258 to sandbox**; **BL · prod + Stripe webhook secret + Stripe account onboarding** |
| Gaps | mig 258 must apply to sandbox before the billing-store writes succeed · founder must complete Stripe account onboarding · webhook endpoint registered with signing secret |

### J2 · Membership renewal + cancellation (Stripe)

| Field | Value |
|---|---|
| Gateway | Stripe |
| Route | Webhook-driven · `invoice.payment_succeeded` → renewal; portal-driven cancellation |
| Service | `src/lib/nex-native/billing/cancellation.ts` · `enforcement.ts` · `webhook-processor.ts` |
| DB tables | same as J1 |
| Webhook | `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted` via `/api/nex-native/billing/webhook/stripe` |
| Tests | `webhook-handler.test.ts` (pass) · `shop-tier-enforcement.test.ts` (pass) |
| State | **B · code built**; **W partial · DB tables missing from sandbox**; **R · mig 258 apply + Stripe Customer Portal config**; **BL · webhook secret + Stripe dashboard portal URL** |
| Gaps | Stripe Customer Portal setup in founder dashboard · `return_url` wired to `${NEX_APP_PUBLIC_URL}/manage/shop/payments` |

### J3 · Member wallet top-up (Stripe · approved design pending)

| Field | Value |
|---|---|
| Gateway | Stripe |
| Route | **NOT BUILT** |
| Service | **NOT BUILT** |
| DB tables | **NOT DESIGNED** (no `nex_wallet*` schema exists in sandbox or migrations) |
| Webhook | `payment_intent.succeeded` would be the trigger · route not built |
| Tests | n/a |
| State | **R · entire feature · approved design document required first per sealed 2026-11-05 "entitlement-contract-first" rule** |
| Gaps | Owner must approve wallet feature design (entitlements · min/max top-up · refund policy · currency handling) before I write code. Sealed Stripe "entitlement-contract-first" rule explicitly blocks code-first on new payment surfaces. |

### J4 · Shop-owner PayPal onboarding (PayPal)

| Field | Value |
|---|---|
| Gateway | PayPal |
| Route | **NOT BUILT** (no `/api/nex-native/paypal/connect/*` routes exist · only `paypal/webhook/route.ts`) |
| Service | `src/lib/nex-native/payments/paypal-checkout-service.ts` (buyer checkout only · no seller onboarding) |
| DB tables (needed) | `nex_business.paypal_merchant_id`, `paypal_merchant_scope`, `paypal_onboarded_at` columns on `nex_business` · **NOT YET ADDED** |
| Webhook | partial · `src/lib/nex-native/payments/paypal-webhook-service.ts` exists, signature-verify tested |
| Tests | `paypal-scaffold.test.ts` (pass) · `paypal-webhook-service.test.ts` (pass) |
| State | **B scaffold-only**; **R · PayPal Partner Referrals onboarding flow needs to be built**; **BL · PayPal Partner account + API creds** |
| Gaps | **Engineering remaining** (not a founder task): build the PayPal Partner Referrals onboarding redirect flow + persist merchant ID. **Founder**: create PayPal business + Partner Portal account, provide `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` + `PAYPAL_PARTNER_ID` |

### J5 · Customer shop checkout (PayPal)

| Field | Value |
|---|---|
| Gateway | PayPal |
| Route | **NOT BUILT** · `/nex-native/orders/[id]/pay/paypal` route exists only in resolver string table, actual page missing. QR fallback via `/nex-native/orders/[id]/pay` is built. |
| Service | `paypal-checkout-service.ts` (create order via PayPal Orders v2 API) |
| DB tables | `nex_order` (sandbox ✓), `nex_order_event` (sandbox ✓), `nex_order.payment_method` (sandbox ✓ via mig 334) |
| Webhook | `src/app/api/nex-native/paypal/webhook/route.ts` built + signature verify |
| Tests | `paypal-scaffold.test.ts` + `paypal-webhook-service.test.ts` (pass) · no end-to-end test |
| State | **B scaffold**; **R · buyer /pay/paypal page + PayPal Orders v2 create-order wire-up**; **BL · credentials + end-to-end test** |
| Gaps | Engineering to finish buyer surface + create-order API call. QR manual-pay is the ONLY live-ready shop checkout today. |

### J6 · Shop checkout confirmation + PayPal webhook

| Field | Value |
|---|---|
| Gateway | PayPal |
| Webhook route | `src/app/api/nex-native/paypal/webhook/route.ts` |
| Service | `paypal-webhook-service.ts` with signature verification |
| Events subscribed | `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `CHECKOUT.ORDER.APPROVED`, `CHECKOUT.ORDER.VOIDED` (designed · not subscribed at PayPal yet) |
| DB mutation | marks `nex_order` status to `paid` / `payment_failed`, writes `nex_order_event` row |
| Tests | `paypal-webhook-service.test.ts` (pass) |
| State | **B scaffold + T**; **R · wire webhook route to order-status-mutation service, write end-to-end test**; **BL · PayPal webhook ID + signing material + `NEX_APP_PUBLIC_URL`** |
| Gaps | Engineering: complete the webhook → order-mutation handoff. Founder: register webhook URL at PayPal dashboard + paste webhook ID. |

### J7 · Stripe checkout + webhook (member subscription)

| Field | Value |
|---|---|
| Gateway | Stripe |
| Buyer-checkout route | `src/app/api/nex-native/billing/checkout/route.ts` (member subscription checkout) · NOT `src/app/api/nex-native/stripe/webhook` (that's a legacy buyer-order route) |
| Service | `billing/checkout-session.ts` (creates Stripe Checkout Session for subscription) |
| Webhook route | `src/app/api/nex-native/billing/webhook/stripe/route.ts` |
| Events subscribed | `customer.subscription.*`, `invoice.payment_*`, `checkout.session.completed` |
| Signature verify | `stripe-webhook-service.ts` with sealed 5-min tolerance · 75/75 payment webhook tests pass |
| State | **B + T**; **V partial (signature code)**; **R · register webhook at Stripe dashboard + paste signing secret**; **BL · Stripe account onboarding + `STRIPE_WEBHOOK_SECRET` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` + `NEX_APP_PUBLIC_URL`** |
| Gaps | Script `scripts/stripe-register-webhooks.mjs` ready · runs when `NEX_APP_PUBLIC_URL` set. |

### J8 · Refunds · cancellations · failed payments

| Journey | Path | State |
|---|---|---|
| Stripe subscription refund | Stripe dashboard → webhook `charge.refunded` → `billing/webhook-processor.ts` → entitlement downgrade | **W · T**; BL on webhook secret |
| Stripe subscription cancellation | Customer Portal → webhook `customer.subscription.deleted` → `billing/cancellation.ts` | **B · T**; R Customer Portal URL |
| Stripe failed payment | webhook `invoice.payment_failed` → billing flags subscription `past_due` | **B · T**; R |
| PayPal refund | PayPal dashboard → webhook `PAYMENT.CAPTURE.REFUNDED` → `nex_order` status `refunded` | **R engineering**; webhook event not yet subscribed in service |
| PayPal denial | `PAYMENT.CAPTURE.DENIED` → `nex_order` status `payment_failed` | **B scaffold**; R |
| QR manual failure | manual seller confirmation flow (mig 319-322, 333) | **V sandbox** |

### J9 · Payment records · receipts · notifications

| Field | Value |
|---|---|
| Order records | `nex_order` + `nex_order_event` (sandbox ✓) |
| Subscription records | `nex_billing_*` tables (NOT APPLIED to sandbox yet) |
| Receipts | Stripe hosted invoices (built-in); PayPal receipt emails (built-in) |
| In-app notifications | `src/lib/nex-native/notifications/*` adapter (push + Resend email) |
| Cron reconciliation | `billing/reconciliation.ts` + `/api/nex-native/billing/cron/route.ts` |
| Tests | Notification + reconciliation tests exist (cycle 6 suite · pass) |
| State | **B · T**; **R · mig 258 apply + prod cron scheduling** |
| Gaps | Reconciliation cron must be scheduled on Vercel · founder task |

---

## Current-state VIOLATIONS of new authoritative rules

**V-1 · `method-resolver-service.ts` lists Stripe as a buyer-checkout destination.**
- File: `src/lib/nex-native/payments/method-resolver-service.ts` lines 23-28, 42, 65, 126-128
- Effect: if a seller has Stripe Connect active (`chargesEnabled=true`), the buyer is routed to a Stripe shop checkout page.
- New rule 3 states PayPal must not appear in member flows AND rules 1+2 together mean Stripe must not be a shop checkout.
- **Fix (engineering)**: remove `"stripe"` from `PaymentMethodKey` + `CheckoutDestinationKind` + `getSellerActiveMethods().stripe` + `resolveCheckoutDestination()`. Replace the Stripe Connect read with a no-op constant `false`.

**V-2 · `stripe-connect-service.ts` is still wired for merchant-direct seller charges.**
- File: `src/lib/nex-native/billing/stripe-connect-service.ts`
- Was built for 2026-11-09 Round 31a "merchant-direct Stripe for shops"
- Today's rule redirects shop payments to PayPal · Stripe Connect for shops is out of scope
- **Fix (engineering)**: do NOT delete the code yet (it's referenced from settings pages). Mark the surface as disabled in UI · add banner "Shop payments move through PayPal from 2026-11-10". Keep the DB columns for future reversibility.

**V-3 · Mig 311 (Stripe Connect schema) was applied to sandbox 2026-11-09.**
- Columns on `nex_business`: `stripe_connect_account_id`, `stripe_connect_charges_enabled`, `stripe_connect_payouts_enabled`
- Under new rule: these columns represent a payment path NEX no longer offers.
- **Fix**: leave the columns in place (no destructive op). Stop reading them for shop-checkout decisions (handled by V-1 fix). Document that they're legacy.

**V-4 · `stripe-checkout-service.ts` in `payments/` folder is ambiguous.**
- File: `src/lib/nex-native/payments/stripe-checkout-service.ts`
- Different from `billing/checkout-session.ts` which handles member subscriptions.
- The `payments/` version was built for buyer→shop Stripe. Under new rules it has no purpose.
- **Fix**: deprecate (keep file but mark exports as deprecated, add header "DEPRECATED 2026-11-10 · member subscription uses billing/checkout-session.ts · shop checkout uses PayPal").

**V-5 · `/api/nex-native/stripe/webhook/route.ts` currently handles buyer order events**
- Events: `checkout.session.completed`, `charge.refunded`
- New rules route shop payment events to PayPal · this Stripe route becomes orphaned.
- **Fix**: keep the route for now · redirect unexpected events to a 410 Gone with a note. Member-subscription events go to the different `/api/nex-native/billing/webhook/stripe/` route.

---

## FOUNDER TASKS (credentials · dashboard · business decisions only)

**F-1 · Complete Stripe account onboarding.** Dashboard → Business details → bank + ID. Until then `charges_enabled=false`. _Pure founder task._

**F-2 · Confirm Stripe API key mode.** The current key prefix is unrecognised. Check that it's a restricted key with correct scopes, or regenerate a standard `sk_live_` / `sk_test_` key. _Pure founder task._

**F-3 · Confirm Shop subscription price.** Stripe has USD $4.99. Sealed memory says $9.99. Pick one in writing. _Business decision._

**F-4 · Set env vars in `.env.local` after you decide the public URL.**
```
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
NEX_APP_PUBLIC_URL=https://...
```
_Pure founder task._

**F-5 · Create PayPal Partner account.** <https://www.paypal.com/partnerprogram/>. Required so NEX can act as the Partner that onboards shop-owners under Partner Referrals. _Pure founder task._

**F-6 · Register PayPal webhook.** Dashboard → Webhooks → add `${NEX_APP_PUBLIC_URL}/api/nex-native/paypal/webhook` → subscribe 4 events → copy webhook ID. _Pure founder task._

**F-7 · Approve the wallet top-up design document.** Entitlements · min/max top-up · refund policy · currency handling · surface routes. Required before I write any wallet code (sealed entitlement-contract-first rule). _Pure business decision + design approval._

**F-8 · Decide QRIS fate.** QRIS code exists for Indonesian dynamic QR. New rules don't mention QRIS. Options: (a) keep as supplementary buyer-to-shop option alongside PayPal, (b) remove entirely. _Business decision._

**F-9 · Issue production migration apply phrases** (per founder checklist §4.1). _Pure founder authorisation._

---

## ENGINEERING REMAINING (not founder tasks · I can do these autonomously)

**E-1 · Remove Stripe from the shop-checkout resolver** (V-1 fix).
**E-2 · Mark `stripe-connect-service.ts` legacy with disabled-UI banner** (V-2 fix).
**E-3 · Deprecate `payments/stripe-checkout-service.ts`** (V-4 fix) · member subscription uses `billing/checkout-session.ts`.
**E-4 · Build PayPal Partner Referrals onboarding flow** · `/api/nex-native/paypal/connect/*` routes + `nex_business` schema columns (new migration 336).
**E-5 · Build buyer `/pay/paypal` page** + PayPal Orders v2 create-order service wire-up.
**E-6 · Wire PayPal webhook → order-mutation service** + add `PAYMENT.CAPTURE.REFUNDED` handler.
**E-7 · Apply mig 258 (billing foundation) to sandbox** · `AUTHORISE SANDBOX APPLY 258` would unblock J1/J2/J9 DB side.
**E-8 · Update `safety matrix` row 10 (Stripe Checkout)** · split into J1 (member subs · Stripe) + J5 (shop · PayPal); refresh state values.
**E-9 · Remove Stripe as a buyer method in `/pay` picker UI** (part of V-1 fix).
**E-10 · Add a /manage/shop/payments banner** explaining that shop payments route through PayPal (V-2 fix).

---

## What I'm doing next (autonomous, safe, local-only commits)

Based on the instruction "Commit safe local engineering improvements and report exact Git status" and the sealed "no push without separate authorisation":

1. Execute E-1 (remove Stripe from shop checkout resolver).
2. Execute E-3 (deprecate orphan Stripe service).
3. Draft mig 336 for PayPal Partner columns on `nex_business` (do NOT apply without `AUTHORISE SANDBOX APPLY 336`).
4. Local commit per change · no push · report commit range + dirty-tree status + remaining engineering list.
