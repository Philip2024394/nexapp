# Stripe env-var setup for NEX Ireland billing

Owner-authored 2026-11-05 iter 29 · Ship B3 · correction to earlier guidance.

## What to paste into `.env.local`

### Stripe API keys (test mode until live auth)

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Stripe price IDs

The sealed billing registry (`src/lib/nex-native/billing/price-registry.ts`) reads
these exact env var names. Two product tiers today — one-time Starter Pack
(€5) is deferred to Ship B3b.

**Worldwide (default · also used by HQ dev):**

```
# NEX Shop monthly subscription €19.99/mo with 7-day trial
STRIPE_PRICE_SHOP_STANDARD=price_...

# NEX Shop yearly subscription €99/yr (also 7-day trial · same Stripe
# product · different recurring interval)
STRIPE_PRICE_SHOP_UNLIMITED=price_...
```

**Ireland-specific override (optional · for VAT-inclusive EU pricing if
you set it separately in Stripe):**

```
STRIPE_PRICE_SHOP_STANDARD_IE=price_...
STRIPE_PRICE_SHOP_UNLIMITED_IE=price_...
```

**Starter Pack (€5 one-time, +10 products, 60-day window · Ship B3b):**

```
STRIPE_PRICE_STARTER_PACK=price_...
# Optional Ireland override · VAT-inclusive
STRIPE_PRICE_STARTER_PACK_IE=price_...
```

Create this in Stripe as a **one-time** price (not recurring) on a
Product named "NEX Starter Pack". Price: €5.00. Currency: EUR.

When `NEX_APP_IDENTITY=ireland`, the registry prefers the `_IE` suffix
and falls back to the unsuffixed names.

## Why these names

- `STRIPE_PRICE_SHOP_STANDARD` is the sealed env-var name for the paid
  shop tier. "standard" is the tier identifier inside the registry · the
  display label on `/packages` is "NEX Shop · €19.99/mo".
- `STRIPE_PRICE_SHOP_UNLIMITED` is the sealed env-var name for the
  higher shop tier. For Ireland it carries the **yearly** price
  (€99/yr) today.
- Do NOT use the names `NEX_STRIPE_PRICE_SHOP_MONTHLY` /
  `_SHOP_YEARLY` I suggested in the prior commit summary — they were
  wrong. The sealed system needs the names above.

## Register the webhook endpoint in Stripe

Dashboard → Developers → Webhooks → Add endpoint.

- **URL:** `https://<your-prod-host>/api/nex-native/billing/webhook/stripe`
- **Events to listen for:**
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- Copy the "Signing secret" from the newly-created endpoint into
  `STRIPE_WEBHOOK_SECRET` in `.env.local`.

For local dev, use the Stripe CLI to forward events:
```
stripe listen --forward-to localhost:3009/api/nex-native/billing/webhook/stripe
```
The CLI prints a `whsec_...` secret · paste it as `STRIPE_WEBHOOK_SECRET`.

## Verify the config resolves

Once env vars are pasted, the sealed health endpoint confirms:
```
curl -s http://localhost:3009/api/nex-native/billing/health | head
```
(Health route exists at `src/app/api/nex-native/billing/health/route.ts`.)

## What's NOT fully wired yet

- **Webhook starter-pack grant** · B3b ships the checkout endpoint ·
  the webhook extension that stamps `starter_pack_quota_remaining
  = 10` on `checkout.session.completed` is a follow-up when
  migration 281 is applied.
- Migration 281 (`starter_pack_quota_remaining` + expiry columns on
  `nex_account`) is a DRAFT · needs owner authorisation per CLAUDE.md
  §5 before application against Supabase `ijvqdvsvwtwxzcqmoqit`.
- Per-country VAT via Stripe Tax · enable in the Stripe dashboard
  under Tax settings when going live.

## Reminder · sealed doctrine

NEX never charges commission on shop goods. The only revenue in this
system is:
- Shop subscription (standard/unlimited)
- Starter Pack top-up (B3b)
- Vault storage subscription (future)

Buyer↔seller payments for actual goods flow outside NEX, direct
between the two parties.
