# NEX Stripe Webhook Setup · Owner Instructions · 2026-11-09

**Audience:** owner Philip. Nobody else should run these steps.
**Scope:** generate `STRIPE_WEBHOOK_SECRET` (test mode) and configure
the local dev server to verify Stripe webhook signatures end-to-end.
**Not covered here:** live-mode webhook configuration · Vercel env
vars · production deployment. All three are separate authorisations.

## Why this exists

The NEX subscription webhook + the new Stripe Connect `account.updated`
webhook both call `stripe.webhooks.constructEvent()` which requires
`STRIPE_WEBHOOK_SECRET` to be set. Without it the route returns
`500 config_error` (fail-closed · correct). The secret is NEVER
printed by Claude · NEVER committed to Git · NEVER placed in source
code. You generate it · you paste it into `.env.local` · that's it.

## Two options · pick one

### Option A · Stripe test-mode dashboard webhook (for dev AND staging testing)

Use this when you want persistent test-mode delivery that survives
dev-server restarts and doesn't need the Stripe CLI running.

1. Sign in to **https://dashboard.stripe.com/test/webhooks** (ensure
   the toggle at top-left is on **"Test mode"**, not Live).
2. Click **"Add endpoint"**.
3. In **Endpoint URL** enter the public URL your dev server reaches.
   If you're developing locally:
   - Expose localhost with a tunnel (ngrok / cloudflared / etc.) OR
   - Use a deployed preview URL (Vercel preview)
   The endpoint path is always: `/api/nex-native/billing/webhook/stripe`
4. In **Events to send** select at minimum:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `charge.refunded`
   - `charge.dispute.created`
   - `charge.dispute.closed`
   - `account.updated` ← Connect accounts
5. After creating · Stripe shows a **Signing secret** starting
   `whsec_...`. Click **Reveal** and copy ONCE.
6. In the NEX repo root · open `.env.local` · find the line
   `STRIPE_WEBHOOK_SECRET=` · paste the whsec_... value AFTER the `=`.
   Example shape (do NOT use this value · generate your own):
   `STRIPE_WEBHOOK_SECRET=whsec_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
7. Restart the dev server · `npm run dev` picks up env changes at
   boot only.
8. In the Stripe dashboard webhook page · click **"Send test webhook"**
   with event type `checkout.session.completed`. Your NEX route should
   return 200.

### Option B · Stripe CLI (for pure-local testing without a tunnel)

Use this when you want transient test-mode delivery that only runs
during a CLI session.

1. Install the Stripe CLI · `https://stripe.com/docs/stripe-cli` ·
   on Windows: `scoop install stripe` or `choco install stripe-cli`.
2. Authenticate · `stripe login`. Follow the browser prompt.
3. Start forwarding:
   ```
   stripe listen --forward-to localhost:3009/api/nex-native/billing/webhook/stripe
   ```
4. The CLI prints a line like:
   `> Ready! Your webhook signing secret is whsec_...`
5. Copy that whsec_... value. In `.env.local` set
   `STRIPE_WEBHOOK_SECRET=whsec_...` AFTER the `=`.
6. Restart the dev server.
7. Leave the CLI running while you test · it forwards every test-mode
   event Stripe produces to your local endpoint.
8. Trigger a test event:
   ```
   stripe trigger checkout.session.completed
   ```

## After configuring · run the lifecycle test

The NEX repo has a prepared test harness at
`scripts/test-stripe-webhook-trial-lifecycle.mjs`. It constructs
synthetic Stripe events, signs them with your STRIPE_WEBHOOK_SECRET,
POSTs them to the local webhook endpoint, and asserts 200 responses +
honest handling of invalid signatures + duplicate deliveries.

Run after the secret is set + dev server restarted:
```
node scripts/test-stripe-webhook-trial-lifecycle.mjs
```

Expected output · "DONE · lifecycle webhook flow behaves correctly"
with checkmarks for scenarios A (checkout.session.completed) · B
(subscription trialing) · C (invoice.payment_succeeded) · F (duplicate
replay) · G (invalid signature rejected).

If any scenario fails · DO NOT claim the subscription lifecycle works.
The test is fail-closed by design.

## Safety rules · non-negotiable

1. The secret is high-value. If you paste it into Slack / chat / an
   email · rotate it immediately via the dashboard "Roll secret" button.
2. NEVER commit `.env.local` to Git. The repo's `.gitignore` already
   excludes `.env*` · verify with `git status` after setting · the
   file should not appear.
3. Test-mode secrets are isolated from live-mode secrets. Setting a
   test secret cannot affect real payments.
4. Live-mode webhook configuration is a SEPARATE step and requires
   SEPARATE owner authorisation. Do not configure live-mode webhooks
   just because test mode worked.
5. Rotate the test secret if you suspect exposure. The dashboard
   lets you roll it without downtime (keep the old secret active for
   24h while you update env + restart).

## What Claude will NOT do

- Generate the signing secret
- Print the secret in any report or commit message
- Place the secret in source code (except `.env.local` which is
  gitignored, and even that only when you paste it)
- Configure the Stripe dashboard webhook (you do this in your own
  Stripe account UI)
- Modify live-mode Stripe settings without separate authorisation

## What Claude WILL do when you confirm the secret is set

- Run the lifecycle test harness · report pass/fail per scenario
- Verify the webhook route actually handles signed test events
- Report any missed event-type cases in the processor

**Trigger word for post-setup verification:** reply with
`"webhook secret set"` and I will run the harness and report the
outcome. The secret value stays with you · I never need to see it.
