# NEX v1 · Deployment Prerequisites + Rollback Runbook

**Status:** DRAFT · documented procedure only · tested recovery NOT verified.
**Authored:** 2026-11-14 · release-engineer pass.
**Scope:** platform prerequisites to stand v1 up and roll it back. Does
NOT authorise any deployment, migration apply, bucket change, or push.

This runbook exists to make a rollback *possible* when needed. A file
existing is not the same as a recovery path being tested — explicit
UNKNOWN flags below mark the items that still need owner verification
before launch.

---

## § 1 · Repository identity (verified in this pass)

| Fact | Value | Evidence |
|---|---|---|
| Local root | `C:/Users/Victus/nexapp` | `pwd` / `.git/config` |
| Remote | `Philip2024394/nexapp` | per `CLAUDE.md` §1 |
| Current audit branch | `release-audit-v1-2026-11-14` | `git rev-parse --abbrev-ref HEAD` |
| HEAD at authoring | `14d7be1d` | `git rev-parse HEAD` |
| Intended production branch | `main` (per `CLAUDE.md` §1) | NOT verified against live Vercel |

**UNKNOWN · Vercel project linkage.** `CLAUDE.md` says the intended
production branch is `main`, but the actual Vercel project pointing at
`Philip2024394/nexapp` has not been verified this pass. `docs/doctrine/
founder-go-live-checklist-2026-11-10.md` §1.4 asks the founder to
decide and set `NEX_APP_PUBLIC_URL`. No deployment has been performed.

**UNKNOWN · quarantine-note contradiction.** The repo root contains
`_THIS_IS_NOT_THE_APP.md` (dated 2026-10-09) which points at
supersedes that notice for ongoing work. All recent commits (Stages
1-10, both audits) happened in this repo. Flagged so the next operator
doesn't follow the stale quarantine note.

---

## § 2 · Supabase (verified)

| Fact | Value |
|---|---|
| Production project ref | `ijvqdvsvwtwxzcqmoqit` (sealed) |
| Sandbox project ref | `kdstoyyeygcopkogqsyv` |
| Dev `.env.local` points at | Sandbox |
| Prod env | UNKNOWN — founder-controlled, not inspected this pass |

Sealed rule (owner, 2026-11-10): **do not apply migrations 315, 316,
317 to production.** Keep production `ijvqdvsvwtwxzcqmoqit` sealed and
unchanged until a fresh explicit authorisation naming production by
ref is given.

### Schema compatibility — migrations status in sandbox

- `001` … `345` applied (sandbox).
- `336_nex_business_paypal_partner_columns_PROPOSAL.sql` — **PROPOSAL
  only · NOT applied**. Blocks Flow B PayPal.
- All `P-RLS-*_PROPOSAL.sql` files — proposals, not applied.
- Deprecated/removed shims have rollback files colocated.

### Backup / restore prerequisite

**UNKNOWN.** Supabase PITR is a founder-controlled setting. The Point-
In-Time-Recovery window is defined by the Supabase project plan. No
documented restore test has been performed on `ijvqdvsvwtwxzcqmoqit`.

**Founder action before launch:** confirm the PITR window on the prod
project and run at least one restore-into-staging drill before cutover.
This runbook cannot verify that from here.

---

## § 3 · Environment variables (names only, no values)

### § 3.1 Mandatory in production

| Name | Purpose | Build-time blocker if missing |
|---|---|---|
| `NEXT_PUBLIC_NEX_SUPABASE_URL` | Supabase REST URL | Yes |
| `NEX_SUPABASE_SERVICE_ROLE_KEY` | Service-role key (server-only) | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key | Yes |
| `NEX_PUBLIC_SITE_URL_IE` | Ireland origin URL | **YES — reproduced build failure 2026-11-14 when missing in production NODE_ENV** |
| `NEX_PUBLIC_SITE_URL_ID` | Indonesia origin URL | Expected same behaviour (not probed) |
| `NEX_PUBLIC_SITE_URL_WW` | Worldwide origin URL | Expected same behaviour (not probed) |
| `NEX_APP_PUBLIC_URL` | Canonical app URL (webhook target) | Required by Stripe webhook registrar script |
| `STRIPE_SECRET_KEY` | Flow A + B Stripe auth | Yes for billing routes |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client Stripe.js | Yes for client checkout |
| `STRIPE_WEBHOOK_SECRET` | Flow A subscription webhook signature | Yes (silently accepts bad events otherwise) |
| `NEX_STRIPE_CONNECT_WEBHOOK_SECRET` | Flow B merchant-direct webhook signature | Yes for Connect |
| `NEX_STRIPE_PRICE_SHOP_EUR_MONTHLY` | Flow A EUR price ID | Yes |
| `NEX_STRIPE_PRICE_SHOP_GBP_MONTHLY` | Flow A GBP price ID | Yes |
| `NEX_STRIPE_PRICE_SHOP_USD_MONTHLY` | Flow A USD price ID | Yes |
| `NEX_STRIPE_PRICE_SHOP_IDR_MONTHLY` | Flow A IDR price ID | Yes |
| `NEX_STRIPE_PRODUCT_SHOP` | Flow A product ID | Yes |

### § 3.2 Conditional

| Name | When required |
|---|---|
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `PAYPAL_WEBHOOK_ID` / `PAYPAL_API_BASE` | Only if Flow B PayPal is NOT deferred. Route returns 503 `credentials_missing` by design when absent. |
| `MIDTRANS_SERVER_KEY` / `XENDIT_WEBHOOK_TOKEN` | Only if QRIS is added to v1 scope. Currently out of v1. |
| `NEX_DEV_IMPERSONATE_HANDLE` | **NEVER in production.** Guard refuses when `NEX_SUPABASE_URL` matches `ijvqdvsvwtwxzcqmoqit`. |

### § 3.3 Secrets handling

- Never commit secret values.
- Store in Vercel's project env scope at launch, not in the repo.
- Rotation: for Stripe, keys can be rotated in the Stripe dashboard;
  after rotation update Vercel env and redeploy. Webhook signing secret
  requires registering a new endpoint, not just rotating the key.

---

## § 4 · Build and start

### § 4.1 Build (Vercel production or local)

```
npm ci
npm run build           # next build (Turbopack)
```

Expected: `Creating an optimized production build` → compiled → `Collecting page data` → `Collecting build traces` → success.

Reproduced failure (2026-11-14 local): without `NEX_PUBLIC_SITE_URL_IE`
the build hard-fails during "Collecting page data" at
`src/lib/nex-native/seo/site-url-resolver.ts:154`. **This is not
caught by `ignoreBuildErrors: true`** — the throw is at
module-eval time during page-data collection, not a TypeScript error.

Reproduced warning: `src/lib/nex/idempotency/store.ts:53` uses dynamic
filesystem access which causes Turbopack to trace the whole project.
Not fatal but inflates deploy bundle size. Non-blocking P2 cleanup.

### § 4.2 Start

```
npm run start           # next start -p 3008
```

On Vercel, `npm run start` is replaced by the platform's own server
runtime. Confirm the Vercel project's "Install command" / "Build
command" / "Output directory" match the defaults for Next.js 16.

---

## § 5 · Health checks (code paths that exist)

| Check | Route or command |
|---|---|
| App shell loads | `GET /` and `GET /nex-native/` return 200 |
| Public shop route | `GET /nex-native/<existing-slug>` → 200 |
| Supabase reachable | `GET /api/nex-native/health` (verify route exists before relying on it) |
| Stripe Flow A | `POST /api/nex-native/billing/checkout/shop` returns a `cs_*` URL |
| Stripe Flow B Connect | `POST /api/nex-native/billing/connect/stripe/create` returns `accountLinkUrl` |
| Push subscribe hub | `/nex-native/_push-subscribe-hub.tsx` renders without console errors |
| HQ incident dashboard | `/nex-native/hq/incidents` loads for an admin account |

**Not tested in this pass:** every health route beyond their presence.

---

## § 6 · Safe rollback triggers

Any one of these should trigger consideration of rollback:

1. **Checkout mint failures >5% within 10 minutes** on Flow A or Flow B.
   Signal: Stripe dashboard "Payments" tab shows failed intents or
   Checkout sessions.
2. **Webhook signature failures >0** on signed endpoints. Signal:
   `nex_incident` rows with `source='stripe-webhook'` + 400/401 status.
3. **500-rate on public shop surface** climbs above baseline for more
   than 5 minutes.
4. **Any report of a public URL leaking a private peer-chat attachment.**
   This is the P0 chat-privacy rule (sealed 2026-11-09).
5. **Any admin account cannot sign in**, including Face sign-in failing
   platform-wide (not single-device).
6. **PITR window exceeded without a confirmed snapshot** (prerequisite
   drift).

### § 6.1 Decision rule

- Roll back **only** when the issue is caused by the latest deploy and
  cannot be mitigated by env-var or feature-flag change.
- For data-corruption issues: STOP writes first, THEN roll back app, THEN
  restore data. Do not roll back app while writes are still ongoing.

---

## § 7 · Rollback procedure (documented, not tested)

### § 7.1 Application code

1. Identify the last known-good commit on `main` prior to the current
   production deploy (Vercel keeps immutable deploys; promote an older
   deploy via Vercel dashboard → Deployments → `…` → Promote to
   Production).
2. If a Vercel promotion is not possible: locally run `git revert
   <offending-commit>` on `main`, push, and let Vercel auto-deploy.
3. Confirm the app shell + health checks return 200.
4. Verify Stripe webhook endpoint URL is still correct (unchanged by
   promotion; may need re-registration if URL changed).

### § 7.2 Database

1. Identify whether the offending migration is one of the recent ones
   (check `nex-supabase/migrations/` for `_rollback.sql` siblings).
2. Apply the rollback SQL **ONLY** after owner-explicit authorisation
   naming the specific migration by number.
3. Verify the tables are back to their expected shape.
4. If rollback SQL is missing, do NOT attempt an ad-hoc DROP/ALTER —
   use Supabase PITR to restore from a point before the migration.

### § 7.3 Storage buckets

1. Bucket schema changes (RLS policies, bucket creation) have
   rollback SQL in the migrations folder (e.g. `295_*rollback.sql`).
2. Bucket **contents** are not rolled back by app rollback — files
   uploaded in the bad window remain.
3. If a privacy breach is suspected: revoke any signed URLs first,
   then investigate, then decide on content retention / deletion.

### § 7.4 Stripe-side

Stripe does not roll back. If a checkout path was misconfigured:

1. Pause the affected webhook endpoint (do not delete — history
   matters for forensics).
2. Reconcile any mis-charged sessions manually via the Stripe
   dashboard.
3. Re-enable the endpoint after code rollback.

**Never retroactively "mark paid" or "mark subscribed" accounts from a
script without owner-explicit authorisation naming the accounts.**

---

## § 8 · What this document does NOT do

- Does not authorise any deployment.
- Does not list secret values.
- Does not prove that any step in § 7 works — none have been exercised.
- Does not identify the Vercel project linkage (owner must verify).
- Does not cover QRIS (out of v1) or PayPal when deferred.

Tested recovery is a founder-operational task that follows this
documentation. A documented runbook ≠ a tested runbook.

---

## § 9 · Related doctrine (read before launch)

- `docs/doctrine/founder-go-live-checklist-2026-11-10.md` — the
  authoritative founder action list.
- `docs/release-audit-v1-2026-11-14.md` — general v1 audit verdict
  (NOT READY).
- `docs/release-audit-v1-payments-2026-11-14.md` — payment audit + the
  2026-11-14 verification-pass addendum.
- `docs/doctrine/chat-decisions-locked-2026-11-10.md` — device-only E2E
  invariants.
- `CLAUDE.md` §1-7 — repository safety constitution.
