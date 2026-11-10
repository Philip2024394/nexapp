# NEX founder go-live checklist · 2026-11-10

**Purpose.** Every manual action the founder must perform to move NEX from "Verified in sandbox" to "Live on production." Each item is a single concrete action with its unblock condition.

**Reading order.** Do them top to bottom. Items in each section are ordered by dependency.

---

## § 1 · Stripe · platform + subscriptions

Current state · account `acct_1USdj0LnJbFGZqNa` (IE · display name "NexChat") · secret key authenticates · 4 Shop price IDs exist · Connect enabled · **0 webhook endpoints** · `charges_enabled=false` · `payouts_enabled=false` · `details_submitted=false`.

### 1.1 · Complete Stripe account onboarding

- [ ] Open Stripe dashboard → **Settings → Business settings → Business details**
- [ ] Fill in the NEX legal entity name, business type, website, support email
- [ ] Add banking details (Ireland IBAN · owner's business account)
- [ ] Upload ID + proof of address for the verified representative
- [ ] Submit for review (Stripe typically approves within 24h)
- **Unblock:** `charges_enabled=true` + `payouts_enabled=true` when probed via `node scripts/_tmp/probe-stripe-access.mjs`

### 1.2 · Confirm API key mode

- [ ] Open **Developers → API keys**
- [ ] Check the current key starts with `sk_live_` (live mode) or `sk_test_` (test mode)
- [ ] The current key starts with neither — confirm it's a **restricted key** (`rk_live_*` / `rk_test_*`) and its scopes include: Charges · Checkout Sessions · Accounts · Webhook endpoints · Prices · Subscriptions · Invoices
- [ ] If scopes are insufficient, either (a) regenerate with full scopes, or (b) replace with a standard secret key
- **Unblock:** key starts with a recognised prefix; probe script prints "LIVE" or "TEST", not "UNKNOWN"

### 1.3 · Confirm Shop pricing

Stripe currently has these 4 prices for `prod_VafP4vUVIx8UBH` (NEX Shop):
- EUR €4.99/mo (`price_1UZU55LnJbFGZqNagjZAVtb0`)
- GBP £4.99/mo (`price_1UZU55LnJbFGZqNaJLu5oyEh`)
- USD $4.99/mo (`price_1UZU56LnJbFGZqNarG4WYQXU`)
- IDR Rp 89,000/mo (`price_1UZU56LnJbFGZqNaIQs8EN2C`)

Your sealed memory 2026-11-08 said **USD $9.99/mo** — there's a discrepancy.
- [ ] Decide: keep $4.99 (and update the sealed memory) **or** create new $9.99 prices + archive the $4.99 prices + update `NEX_STRIPE_PRICE_SHOP_USD_MONTHLY` env var
- **Unblock:** the intended pricing is the one in Stripe AND the one in `NEX_STRIPE_PRICE_SHOP_*_MONTHLY` env vars match

### 1.4 · Register webhook endpoints

- [ ] Decide the public URL NEX will run at (e.g. `https://nex.app`, or your Vercel preview URL)
- [ ] Set `NEX_APP_PUBLIC_URL=https://<that URL>` in `.env.local`
- [ ] Run: `node scripts/stripe-register-webhooks.mjs`
- [ ] Copy the printed signing secret into `.env.local` as `STRIPE_WEBHOOK_SECRET=whsec_...`
- [ ] If the script prints "already registered", reveal the secret manually: Stripe dashboard → **Developers → Webhooks → <endpoint> → Signing secret → Click to reveal**
- **Unblock:** `STRIPE_WEBHOOK_SECRET` set in `.env.local`

### 1.5 · Set publishable key

- [ ] Stripe dashboard → **Developers → API keys** → **Publishable key** (starts with `pk_live_` or `pk_test_`)
- [ ] Set in `.env.local`:
  ```
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_<live|test>_...
  ```
- **Unblock:** present and matches the mode of `STRIPE_SECRET_KEY`

### 1.6 · Smoke test Stripe Connect Express onboarding

- [ ] Run: `node scripts/stripe-connect-smoke-test.mjs`
- [ ] Click the printed AccountLink URL in a browser
- [ ] Complete the seller onboarding form (test identity acceptable in test mode; real identity if live)
- [ ] Observe the polling output confirm `details_submitted=true` + `charges_enabled=true`
- [ ] Review the final-state JSON in `scripts/_tmp/stripe-connect-smoke-result-*.json`
- [ ] If running in live mode, delete the test account manually from the Stripe dashboard afterwards
- **Unblock:** smoke test succeeds end-to-end; safety matrix row 10 (Stripe Checkout) moves from **B** to **V** sandbox

---

## § 2 · PayPal Orders v2 (future · currently blocked)

Scope · full `paypal-checkout-service.ts` + webhook route exist as scaffolds; no credentials wired.

- [ ] Create PayPal sandbox app at <https://developer.paypal.com/dashboard/applications/sandbox>
- [ ] Record `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET`
- [ ] Register webhook at PayPal dashboard pointing at `${NEX_APP_PUBLIC_URL}/api/nex-native/paypal/webhook`
- [ ] Subscribe to events: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `CHECKOUT.ORDER.APPROVED`, `CHECKOUT.ORDER.VOIDED`
- [ ] Record the webhook ID
- [ ] Set in `.env.local`:
  ```
  PAYPAL_CLIENT_ID=...
  PAYPAL_CLIENT_SECRET=...
  PAYPAL_WEBHOOK_ID=...
  PAYPAL_ENV=sandbox      # or 'live' once production
  ```
- [ ] Repeat for live-mode PayPal when going live
- **Unblock:** safety matrix row 11 moves from **B** to **V**

---

## § 3 · QRIS dynamic (Indonesia · future · currently blocked)

Scope · `qris-dynamic-service.ts` + webhook route exist; no provider chosen.

- [ ] Choose provider: **Midtrans** or **Xendit**
- [ ] Create sandbox account at the chosen provider
- [ ] Record server-key + webhook signature key
- [ ] Register webhook pointing at `${NEX_APP_PUBLIC_URL}/api/nex-native/qris/webhook`
- [ ] Set in `.env.local`:
  ```
  QRIS_PROVIDER=midtrans      # or 'xendit'
  QRIS_SERVER_KEY=...
  QRIS_WEBHOOK_SIGNATURE_KEY=...
  ```
- **Unblock:** safety matrix row 12 moves from **B** to **V**

---

## § 4 · Supabase · production backend

Current state · sandbox `kdstoyyeygcopkogqsyv` has every cycle-8-9 migration applied. Production `ijvqdvsvwtwxzcqmoqit` is untouched since cycle 7.

### 4.1 · Per-batch production apply (sequential, one owner phrase per batch)

For each batch in order, issue the exact authorisation phrase, wait for me to apply + verify + report, then issue the next:

- [ ] `AUTHORISE PRODUCTION BATCH A1 · PROJECT ijvqdvsvwtwxzcqmoqit · APPLY 290 313 291 330`
- [ ] `AUTHORISE PRODUCTION BATCH A2 · PROJECT ijvqdvsvwtwxzcqmoqit · APPLY 292 294 293 295 331 · CREATE CIPHERTEXT BUCKET`
- [ ] `AUTHORISE PRODUCTION BATCH B · PROJECT ijvqdvsvwtwxzcqmoqit · APPLY 323 324 325 326 327 332`
- [ ] `AUTHORISE PRODUCTION BATCH C · PROJECT ijvqdvsvwtwxzcqmoqit · APPLY 27 P-RLS PROPOSALS`
- [ ] `AUTHORISE PRODUCTION BATCH D · PROJECT ijvqdvsvwtwxzcqmoqit · APPLY 319 320 321 322 333 · CREATE MERCHANT-QR BUCKET`
- [ ] `AUTHORISE PRODUCTION BATCH E · PROJECT ijvqdvsvwtwxzcqmoqit · APPLY HQ ADMIN OVERLAY`
- [ ] `AUTHORISE PRODUCTION BATCH F · PROJECT ijvqdvsvwtwxzcqmoqit · APPLY 328 (NOT VALID)`

### 4.2 · Batch G · after 14-day burn-in

- [ ] Starting 2026-11-24, confirm sandbox `nex_chat_encryption_adoption_v` shows ≥95% encrypted + zero plaintext writes in the 14-day window
- [ ] `AUTHORISE SANDBOX BATCH G · APPLY 329 (VALIDATE)`
- [ ] After 7 more days (2026-12-01), repeat on production
- [ ] `AUTHORISE PRODUCTION BATCH G · PROJECT ijvqdvsvwtwxzcqmoqit · APPLY 329 (VALIDATE)`
- **Unblock:** chat plaintext CHECK fully validated in prod; safety matrix row 5 reaches L

### 4.3 · Prod env vars

- [ ] Set in **Vercel** (not `.env.local`): `NEXT_PUBLIC_NEX_SUPABASE_URL=https://ijvqdvsvwtwxzcqmoqit.supabase.co`
- [ ] Set in Vercel: `NEX_SUPABASE_SERVICE_ROLE_KEY=<prod service-role key>` (encrypted secret)
- [ ] Set in Vercel: `NEX_APP_IDENTITY=ireland` (or hq / worldwide per deployment)
- [ ] Set in Vercel: `NEX_APP_COUNTRY=IE` (or matching country code)
- [ ] Set in Vercel: `NEX_APP_PUBLIC_URL=https://<your prod domain>`
- [ ] All Stripe env vars from §1 above, prod mode
- **Unblock:** `npm run build` succeeds in a Vercel preview

---

## § 5 · Deployment · Vercel

- [ ] Confirm Vercel project is linked to `Philip2024394/nexapp` on branch `main` (per CLAUDE.md §5)
- [ ] After each production migration batch, trigger a Vercel deploy
- [ ] After each deploy, run a smoke test of the affected flow
- [ ] Only authorise `git push` to GitHub via explicit per-task phrase (CLAUDE.md §4)
- **Unblock:** production deployment succeeds + smoke tests green

---

## § 6 · Final independent evidence (sealed 2026-11-09 Priority 1)

Before publishing the launch principle *"NEX does not keep a copy of your private conversations"*, all seven evidence artefacts must be gathered. **These cannot be re-derived from engineering tests.**

- [ ] **V-NET-1** · packet capture of chat send → confirm no plaintext bytes leave the device
- [ ] **V-NET-2** · packet capture of chat receive → confirm no plaintext bytes enter from server
- [ ] **V-STORE-1** · dump of `nex_peer_message` table on prod · confirm `body` column empty/null for encrypted rows
- [ ] **V-STORE-2** · list contents of `nex-peer-chat-ciphertext` bucket · confirm no legacy plaintext objects
- [ ] **V-STORE-3** · dump of attachment_meta JSONB → confirm no plaintext snapshots
- [ ] **V-LOG-1** · scan Supabase logs for plaintext leakage → zero matches
- [ ] **V-SIG-1** · signing-key management attestation (where is the device-key signing root; who can access it)
- [ ] **V-TURN-1** · if TURN provider used, documented comparison of options before selection
- [ ] **V-DELETION-1** · prove account-deletion workflow pseudonymises all audit traces + removes device-keys
- **Unblock:** every box checked with linked artefact in `docs/evidence/`

---

## § 7 · Pre-existing gaps to address before launch (G-01..G-11 from safety matrix)

- [ ] G-06 · Vault test suite has 9 failing structural files · needs a dedicated vault-restoration cycle
- [ ] G-07 · 1550 typecheck errors · address when touching each file
- [ ] G-08 · Migration version collisions (187, 224, 320) · forward-renumber planned as mig 334+
- [ ] G-09 · Full Playwright journey suite not re-run since cycle 7 · re-run and attach artefacts
- [ ] G-10 · Next build export requires `NEX_APP_COUNTRY` env · document in CI
- [ ] G-11 · Independent evidence requirements (§6 above)

---

## § 8 · Launch day sequence (once everything above is checked)

1. Review this checklist end-to-end · every box checked · evidence gathered
2. Run final full vitest + Next build in each identity (ireland / hq / worldwide)
3. Run full Playwright journey suite
4. Fill in a safety matrix revision (`world-class-safety-matrix-2026-11-20.md`) with L column populated
5. Owner countersigns the L promotions in writing
6. Issue `git push ui-drawer-cleanup-plus-loading-2026-11-09 to origin · final launch tip`
7. Trigger Vercel production deploy
8. 24h monitoring window · zero regressions observed
9. Publish the sealed launch principle publicly

---

## Not in this checklist (intentionally)

- Audit documents for owner review (sealed "no more audits" directive 2026-11-10)
- Any destructive git operation
- Any production apply without the exact per-batch phrase
- Any live transaction without founder present

## Links

- Safety matrix: `docs/doctrine/world-class-safety-matrix-2026-11-10.md`
- Sandbox batch plan: `docs/doctrine/sandbox-activation-batch-plan-2026-11-10.md`
- Sealed chat decisions: `docs/doctrine/chat-decisions-locked-2026-11-10.md`
- Stripe probe: `scripts/_tmp/probe-stripe-access.mjs`
- Connect smoke test: `scripts/stripe-connect-smoke-test.mjs`
- Webhook register: `scripts/stripe-register-webhooks.mjs`
