# T-10 Payment Webhook Positive-Path · Unblock Checklist

**Sealed**: 2026-11-26 · **Status**: BLOCKED-PENDING-CONFIG · **Owner**: Philip

This document records the exact configuration owner must apply before
the two T-10 positive-path Playwright specs can run honestly. Every
other slice of T-10 (method guard, invalid-sig rejection, opaque
failure surface, no-body-trusted-state-change, idempotency of event
IDs) is already VERIFIED in the 2026-11-26 baseline — see
`tests/e2e/journey-stripe-webhook-t10.spec.ts` and
`tests/e2e/journey-paypal-webhook-t10.spec.ts`.

## 1 · Why the positive-path cannot be faked

Per owner directive 2026-11-25 strict-completion rule 5:

> "T10 = Stripe + PayPal SEPARATE · no real charges · webhook sig
>  verification + invalid-sig rejection + idempotency + merchant-owned
>  destination + generic lock-screen · **simulated DB event ≠ real
>  provider proof**."

Simulating state transitions via direct DB writes would VIOLATE the
rule. The only honest positive-path requires the live webhook handler
at `src/app/api/nex-native/stripe/webhook/route.ts` (and PayPal) to
run its real signature verification against a signature computed with
a secret the handler can read.

## 2 · Current config state (verified 2026-11-26 01:40 SEAST)

| Variable | State in `.env.local` | Length |
|---|---|---|
| `STRIPE_WEBHOOK_SECRET` | PRESENT but EMPTY | 0 |
| `STRIPE_SECRET_KEY` | PRESENT | 107 |
| `STRIPE_PUBLISHABLE_KEY` | MISSING | — |
| `PAYPAL_CLIENT_ID` | MISSING | — |
| `PAYPAL_CLIENT_SECRET` | MISSING | — |
| `PAYPAL_WEBHOOK_ID` | MISSING | — |
| `PAYPAL_API_BASE` | MISSING | — |

## 3 · Stripe unblock · exact steps

**Scope**: test-mode signing secret only. NO live keys. NO real charges.
The Stripe spec builds a synthetic `checkout.session.completed` event
against a fixture order; the sealed webhook handler verifies the
HMAC-SHA256 signature computed with the test-mode secret.

1. Owner opens the Stripe test-mode dashboard
   (https://dashboard.stripe.com/test/webhooks).
2. Create a webhook endpoint OR use Stripe CLI listener:
   - **Option A · Stripe CLI** (recommended, no real endpoint
     required): run
     `stripe listen --forward-to localhost:3008/api/nex-native/stripe/webhook`.
     The CLI prints `Ready! Your webhook signing secret is whsec_...`.
     Copy the `whsec_...` value.
   - **Option B · Dashboard endpoint**: create a test webhook pointing
     at a public tunnel (e.g. a one-shot ngrok URL). Copy the signing
     secret shown in the endpoint detail page (not the API key).
3. Write the secret to `.env.local`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_<copied_value>
   ```
4. Restart the dev server (`npm run dev` on `:3008`) so the route
   picks up the new secret.
5. Run:
   ```
   npx playwright test tests/e2e/journey-stripe-webhook-t10.spec.ts \
     --project=stage-a-pixel7 --reporter=list
   ```
6. The positive-path test at
   `journey-stripe-webhook-t10.spec.ts:246` will detect the secret is
   configured (the probe no longer returns 500 `config_error`) and
   execute the full positive-path + idempotency replay against a
   fixture order.

**Sealed hard-stop**: the spec at line 280-288 still skips with
`BLOCKED-PENDING-CONFIG` if the test process itself can't read
`STRIPE_WEBHOOK_SECRET`. If the Playwright invocation is launched
from a different shell than the one that set the variable, export it
inline or use the Playwright config's `use.env` hook.

## 4 · PayPal unblock · exact steps

**Scope**: sandbox credentials only. NO live PayPal account. NO real
payment.

The PayPal webhook handler at `src/app/api/nex-native/paypal/webhook/route.ts`
calls `/v1/notifications/verify-webhook-signature` against PayPal's
real API — so the full positive-path requires:

1. PayPal sandbox account at
   https://developer.paypal.com/dashboard/applications/sandbox.
2. Create (or reuse) a sandbox REST API app. Record `Client ID` and
   `Secret`.
3. Under Webhooks, create a sandbox webhook subscribed to at least
   `PAYMENT.CAPTURE.COMPLETED`. Point the URL at a public tunnel or
   the dev server endpoint. Record the `Webhook ID` (not the URL).
4. Write all four values to `.env.local`:
   ```
   PAYPAL_CLIENT_ID=<sandbox_client_id>
   PAYPAL_CLIENT_SECRET=<sandbox_client_secret>
   PAYPAL_WEBHOOK_ID=<sandbox_webhook_id>
   PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
   ```
5. Restart the dev server.
6. The config-branch assertion at
   `journey-paypal-webhook-t10.spec.ts:89` currently expects 503
   `credentials_missing`. Once creds are configured this test will
   instead receive 400 `signature_invalid` on probe B (forged sig),
   which the spec already accepts per the inline comment.
7. The positive-path at `journey-paypal-webhook-t10.spec.ts:201`
   remains BLOCKED-PENDING-INTEGRATION even with creds set. PayPal
   signs each event with per-event RSA certs issued by PayPal
   infrastructure — the only way to drive a positive-path is to
   receive an actual sandbox webhook delivery from PayPal (not a
   synthetic one). Resolution options:
   - Author `tests/e2e/integration/paypal-sandbox-replay.spec.ts`
     that captures a real sandbox delivery payload + headers from a
     test transaction, stores them as a fixture, and replays the
     exact bytes against the local endpoint. The verify endpoint
     will accept the replay because it re-fetches certs from
     PayPal, not from the request.
   - Or run the dev server through a PayPal-reachable tunnel and
     fire a sandbox test event from the PayPal dashboard's "Send
     Webhook Event" trigger. Observe the live flow.

## 5 · What the tests ALREADY prove (current green baseline)

- Stripe route rejects GET (405 with `Allow: POST`).
- Stripe route rejects unsigned + bad-sig POSTs with indistinguishable
  opaque failure surface; no state change; no `stripe.*` event row.
- PayPal route returns 503 `credentials_missing` sealed shape when no
  creds are present; no state change; no `paypal.*` event row.
- Merchant-owned destination guard already enforced by the webhook
  handlers (they load `nex_business.stripe_account_id` /
  `nex_business.paypal_merchant_id` before accepting the event).

## 6 · What changes once creds arrive

Positive-path coverage adds:
- Valid-signature event transitions `nex_order.state`
  `created → pending → paid` (Stripe).
- Idempotency: replaying the same `stripe_event_id` second time
  returns 200 but leaves state unchanged — proven by `nex_order_event`
  metadata deduplication at the sealed `alreadyProcessed(id)` check.
- Payee cross-check: PayPal event whose `payee.merchant_id` does not
  match `nex_business.paypal_merchant_id` is rejected before any
  state change.

## 7 · Hard boundaries respected

- No live-mode Stripe keys.
- No live PayPal account.
- No real customer payment captured.
- No migration applied.
- No prod DB touched (sealed by `assertSandboxRef()` in every spec).
- No commit/push performed by this doc.

## 8 · Follow-up tasks

- Task #76 · stays `pending` until owner provides the four PayPal
  sandbox values + non-empty `STRIPE_WEBHOOK_SECRET`. When the specs
  flip from SKIP to PASS, mark #76 complete and update
  `docs/product/launch-evidence-ledger.md` row for Payments.
- Task #67 · T10 scaffold · already completed.
