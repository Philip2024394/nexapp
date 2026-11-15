# Launch Payments · Founder Prerequisites · 2026-11-16

Status: DRAFT register · no owner authorisation required to READ this
list · each line item requires a separate owner-named authorisation
before any engineering action is taken against production.

Scope: the exact human actions the founder needs to complete BEFORE
NEX can honestly turn on each paid-provider path. Engineering can
build scaffolding + fail-soft resolvers without any of these — but
flipping a provider to "visible to buyers" requires every gate for
that provider to be green.

Doctrine anchors:
- Sealed 2026-11-10 (revised) · shop payments route through PayPal +
  manual QR + dynamic QRIS · Stripe is reserved for NEX subscriptions.
- Sealed 2026-11-05 · entitlement-contract-first rule · Stripe (or any
  gateway) must NOT be built ahead of clearly defined entitlements +
  post-payment behaviour.
- Sealed 2026-11-16 (Stream E) · `getSellerActiveMethods` returns
  `false` for each paid provider until EVERY gate below is green.

---

## Current observed environment · 2026-11-16

Branch: `release-audit-v1-2026-11-14` · HEAD `07f16abc`
Sandbox DB: `kdstoyyeygcopkogqsyv` · Prod DB: `ijvqdvsvwtwxzcqmoqit` (SEALED)

Env-var presence (names only · values redacted · verified by filename+key-only grep):

| Variable | Status |
|---|---|
| `STRIPE_SECRET_KEY` | SET (platform subscription path · test mode assumed) |
| `STRIPE_WEBHOOK_SECRET` | **EMPTY** · webhook endpoint returns 500 `config_error` until set |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | **EMPTY** · client-side Stripe.js can't mount |
| `NEX_STRIPE_PRICE_SHOP_EUR_MONTHLY` | SET |
| `NEX_STRIPE_PRICE_SHOP_GBP_MONTHLY` | SET |
| `NEX_STRIPE_PRICE_SHOP_USD_MONTHLY` | SET |
| `NEX_STRIPE_PRICE_SHOP_IDR_MONTHLY` | SET |
| `PAYPAL_CLIENT_ID` | not present in `.env.local` |
| `PAYPAL_CLIENT_SECRET` | not present in `.env.local` |
| `PAYPAL_WEBHOOK_ID` | not present in `.env.local` |
| `MIDTRANS_SERVER_KEY` | not present in `.env.local` |
| `XENDIT_WEBHOOK_TOKEN` | not present in `.env.local` |
| `XENDIT_SECRET_KEY` | not present in `.env.local` |
| `RESEND_API_KEY` | **EMPTY** · I12 audit claim confirmed (key present in file, value blank) |

Schema state:

| Migration | Applied to sandbox | Applied to prod | Blocker for |
|---|---|---|---|
| `336_nex_business_paypal_partner_columns_PROPOSAL.sql` | NO | NO (sealed) | PayPal shop checkout |

---

## 1 · Stripe · platform subscription

Platform-side is MOSTLY provisioned. Below is the gap between where
we are and where we need to be to accept real NEX Shop subscriptions.

### Current state
- Account onboarding: partially complete (STRIPE_SECRET_KEY set).
- Mode: test-vs-live not confirmed by this agent · founder to verify.
- Webhook endpoint: NOT registered in Stripe dashboard (local secret
  empty).
- Webhook handler file: `src/app/api/nex-native/stripe/webhook/route.ts`
  returns 500 `config_error` while `STRIPE_WEBHOOK_SECRET` is empty.

### Required state (for launch)
- Stripe account fully verified for the trading entity (business name,
  tax ID, bank account for payouts).
- Live-mode keys populated OR the launch is explicitly test-mode-only.
- Webhook endpoint registered at `https://<prod-host>/api/nex-native/stripe/webhook`
  with these event types enabled at minimum:
  - `checkout.session.completed`
  - `charge.refunded`
  - (future) `customer.subscription.created` / `.updated` / `.deleted`
  - (future) `invoice.paid` / `invoice.payment_failed`
- `STRIPE_WEBHOOK_SECRET` from that endpoint set in Vercel env +
  `.env.local` for local dev.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` set.

### Owner UI click-path
1. Sign in at `https://dashboard.stripe.com` (switch to Live mode if
   production).
2. Developers → API keys → reveal Secret key + Publishable key.
3. Developers → Webhooks → Add endpoint → paste the prod URL → select
   the events listed above → Create endpoint.
4. Copy the Signing secret (starts `whsec_`) into Vercel project →
   Settings → Environment Variables → add `STRIPE_WEBHOOK_SECRET` for
   Production + Preview.
5. Mirror in `.env.local` for local dev.
6. For test cards for CI, use Stripe-supplied `4242 4242 4242 4242`
   (success) + `4000 0000 0000 0002` (card declined).

### Validation command
```
curl -X POST https://<prod-host>/api/nex-native/stripe/webhook \
  -H "stripe-signature: t=dummy,v1=dummy"
# Expected: HTTP 400 "invalid signature" (not 500 "config_error")
```

---

## 2 · PayPal · merchant-direct shop checkout

### Current state
- Code path: `src/lib/nex-native/payments/paypal-checkout-service.ts`
  + webhook `src/app/api/nex-native/paypal/webhook/route.ts`.
- `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` + `PAYPAL_WEBHOOK_ID` NOT
  set → webhook returns 503 `credentials_missing`.
- Migration 336 (`nex_business.paypal_merchant_id` + 5 siblings +
  partial index) NOT applied → the resolver's PayPal probe
  short-circuits on `credentials_missing` before touching the DB, so
  no column error is thrown — but the feature stays off.

### Required state (for launch)
- PayPal Partner Referrals onboarding completed for NEX as Partner
  (Business Developer Portal → Apps → Create Partner app).
- Live + sandbox Partner apps both created (sandbox for staging,
  live for production).
- `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` set in Vercel +
  `.env.local` (sandbox for sandbox env, live for prod env).
- `PAYPAL_WEBHOOK_ID` set (register webhook, capture the webhook id
  from PayPal's dashboard).
- Webhook endpoint registered at
  `https://<prod-host>/api/nex-native/paypal/webhook` with these event
  types enabled:
  - `CHECKOUT.ORDER.APPROVED`
  - `PAYMENT.CAPTURE.COMPLETED`
  - `PAYMENT.CAPTURE.REFUNDED`
  - `PAYMENT.CAPTURE.DENIED`
  - `MERCHANT.ONBOARDING.COMPLETED` (for seller Partner Referrals)
  - `MERCHANT.PARTNER-CONSENT.REVOKED` (for seller offboarding)
- Migration 336 applied to sandbox (via
  `scripts/apply-migration-336-sandbox.mjs` or equivalent · requires
  owner authorisation naming migration + target DB).
- Migration 336 applied to prod (SEPARATE authorisation naming
  `ijvqdvsvwtwxzcqmoqit`).

### Owner UI click-path
1. Sign in at `https://developer.paypal.com`.
2. Dashboard → Apps & Credentials → confirm Live + Sandbox Partner
   apps exist (create if not). Note each app's Client ID + Secret.
3. For each app: Webhooks tab → Add Webhook → paste the appropriate
   URL → select the events above → Save → copy the Webhook ID.
4. Set the three env vars (`PAYPAL_CLIENT_ID`,
   `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`) in Vercel + local for
   each environment.
5. Apply migration 336 via the sandbox-first script, verify the
   columns + partial index are present, then (separate authorisation)
   apply to production.

### Validation command
```
# After creds + webhook id set:
curl -X POST https://<prod-host>/api/nex-native/paypal/webhook \
  -H "paypal-auth-algo: SHA256withRSA" \
  -H "paypal-cert-url: https://api-m.paypal.com/..." \
  -H "paypal-transmission-id: test" \
  -H "paypal-transmission-sig: dummy" \
  -H "paypal-transmission-time: 2026-11-16T00:00:00Z" \
  -d '{"id":"EV-test","event_type":"CHECKOUT.ORDER.APPROVED"}'
# Expected: HTTP 400 "invalid_signature" (not 503 "credentials_missing")

# After mig 336 applied, SQL check:
SELECT column_name FROM information_schema.columns
WHERE table_name='nex_business' AND column_name LIKE 'paypal_%'
ORDER BY column_name;
# Expected 6 rows: paypal_charges_enabled, paypal_last_webhook_at,
# paypal_merchant_id, paypal_onboarded_at, paypal_partner_merchant_id,
# paypal_payouts_enabled
```

---

## 3 · QRIS · dynamic payment (Indonesia)

### Current state
- Provider: NOT selected · code supports BOTH Midtrans AND Xendit via
  the `X-Nex-Qris-Provider` request header.
- Webhook `src/app/api/nex-native/qris/webhook/route.ts` returns
  503 `provider_scaffold_not_live` even when the signature verifies
  cleanly. This is intentional · no DB mutations happen in scaffold.
- NO per-business QRIS-enabled column exists on `nex_business`.
  Resolver's QRIS probe returns `seller_not_enabled` once provider
  creds are set (currently it returns `provider_pending`).

### Required state (for launch)
- Owner chooses ONE of Midtrans or Xendit (or decides to support both).
  Factors: pricing, sub-merchant onboarding flow, Indonesia regulatory
  familiarity, dashboard quality.
- Platform credentials provisioned for the chosen provider:
  - Midtrans: `MIDTRANS_SERVER_KEY`
  - Xendit: `XENDIT_WEBHOOK_TOKEN` + `XENDIT_SECRET_KEY`
- Webhook endpoint registered with the provider pointing at
  `https://<prod-host>/api/nex-native/qris/webhook` with the
  mandatory `X-Nex-Qris-Provider: midtrans|xendit` header.
- Per-business QRIS-enabled column proposal drafted (NEW migration
  separate from 336 · not yet authored) adding
  `nex_business.qris_enabled boolean DEFAULT false NOT NULL` + the
  seller's sub-merchant identifier column.
- Scaffold 503 lifted ONLY after a Phase-5-like seller-settlement UX
  is wired (owner-authorised separately).

### Owner UI click-path (illustrative · Midtrans variant)
1. Sign up at `https://midtrans.com` for a Business account.
2. Complete KYC + tax + bank-account onboarding.
3. Dashboard → Settings → Access Keys → copy the Server Key.
4. Dashboard → Settings → Configuration → Notification URL → set to
   `https://<prod-host>/api/nex-native/qris/webhook` → Save.
5. Add a static header requirement on their side (if supported) or
   configure NEX to recognise Midtrans requests by payload shape (we
   require the `X-Nex-Qris-Provider` header; if Midtrans can't add
   custom headers we accept Midtrans-shape detection as a fallback,
   owner call).
6. Set `MIDTRANS_SERVER_KEY` in Vercel + local (production env only
   if live keys, otherwise sandbox-only).

### Validation command
```
# After creds set:
curl -X POST https://<prod-host>/api/nex-native/qris/webhook \
  -H "x-nex-qris-provider: midtrans" \
  -d '{"order_id":"test","status_code":"200","gross_amount":"1000.00","signature_key":"bad"}'
# Expected: HTTP 400 "invalid signature" (not 503 "credentials_missing")
```

---

## 4 · Supabase SMTP · transactional email delivery

### Current state (I12 audit reconciliation)
- `RESEND_API_KEY` present in `.env.local` but **empty** (confirmed by
  key-only grep; value never printed). This matches audit finding I12.
- Supabase Auth `email_confirmation_required` path at
  `src/app/nex-native/_actions.ts:507` relies on Supabase's own
  configured email provider (NOT the `RESEND_API_KEY` env var · that
  key powers `trade/*` email sending which is out of nexapp scope).
- Current Supabase email provider: default built-in SMTP (rate limit
  3 emails/hour per IP · insufficient for launch).
- Signup + password-reset QUOTA was reported exhausted today (dev
  observation) — reinforces the need for custom SMTP.

### Required state (for launch)
- Supabase project → Authentication → Email Templates verified +
  branded with NEX wording (not default Supabase copy).
- Supabase project → Authentication → SMTP Settings → configured to
  use Resend (or SendGrid, or AWS SES — owner choice).
- If Resend: Resend domain verified (DKIM + SPF DNS records live on
  the NEX apex domain), API key created with `email:send` scope,
  `From` address verified.
- `RESEND_API_KEY` in `.env.local` is OUT OF SCOPE for Supabase SMTP
  · that's a NEX trade-email key. If the owner wants to reuse the
  same Resend account for Supabase SMTP, they paste the SMTP
  credentials directly into Supabase (host `smtp.resend.com`, port
  `465`, username `resend`, password = API key).

### Owner UI click-path
1. Sign in at `https://resend.com` (or create account).
2. Domains → Add Domain → enter NEX apex → add the 3 DNS records to
   Cloudflare/registrar → wait for all three to show "Verified".
3. API Keys → Create API Key → scope `email:send` → copy.
4. (Separate) Sign in at `https://supabase.com/dashboard` → select
   project `ijvqdvsvwtwxzcqmoqit` (for prod) or
   `kdstoyyeygcopkogqsyv` (for sandbox) → Authentication → SMTP
   Settings.
5. Enable "Custom SMTP" → Host `smtp.resend.com` · Port `465` ·
   Username `resend` · Password `<the Resend API key>` · Sender email
   `<verified From address>` → Save.
6. Authentication → Email Templates → review each (Confirm signup,
   Invite user, Magic Link, Recovery) → replace default copy with
   NEX wording. Keep the `{{ .ConfirmationURL }}` tokens intact.

### Validation command
```
# From the dashboard: Authentication → Users → three-dot menu on a
# test row → "Send magic link" → verify the email lands in the test
# inbox from the custom From address within <30 seconds.
#
# For nexapp local dev: submit the sign-in page's signup form with a
# disposable email and check the test inbox. BLOCKED today by per-IP
# NEX throttle + Supabase hourly limit.
```

---

## Summary matrix · gate status 2026-11-16

| Gate | Observed | Required | Blocker |
|---|---|---|---|
| Stripe subs secret | SET | SET | — |
| Stripe webhook secret | EMPTY | SET | founder action 1 |
| Stripe publishable | EMPTY | SET | founder action 1 |
| PayPal creds | UNSET | SET | founder action 2 |
| PayPal webhook id | UNSET | SET | founder action 2 |
| Mig 336 (sandbox) | NOT APPLIED | APPLIED | founder authorisation |
| Mig 336 (prod) | NOT APPLIED | APPLIED | separate authorisation |
| Midtrans/Xendit creds | UNSET | one SET | founder action 3 |
| Supabase custom SMTP | default | custom | founder action 4 |
| Supabase email templates | default | NEX-branded | founder action 4 |
| Resend domain verified | unknown | verified | founder action 4 |

Until EVERY row for a given provider is green, the resolver's probe
returns the honest `*_pending` / `*_missing` reason, and
`getSellerActiveMethods` keeps that provider hidden from buyers.
This is deliberate: a discoverable-but-broken provider is worse than
one that simply isn't shown yet.
