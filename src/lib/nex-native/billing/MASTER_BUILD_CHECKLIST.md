# NEX Billing · Master-Build Checklist

Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT).
Updated by Claude with each component · one source of truth for progress.

## Verification taxonomy (owner-sealed · never skip a tier)

| Tier | Meaning |
|---|---|
| **implemented** | Code exists in-repo. TypeScript compiles. |
| **locally tested** | Covered by pure or in-memory tests · passes without DB or Stripe. |
| **Gate-1 verified** | Covered by `[postgres]` integration tests run against scratch rehearsal `nex_rehearsal_257` database. R-1..R-11 verifications pass. |
| **Gate-2 verified** | Covered by `[stripe]` integration tests against Stripe test-mode account · signature verification, webhook replay, refund, dispute, failed payment, PaymentIntent all exercised end-to-end. |
| **production verified** | Deployed to canonical Supabase + live Stripe · owner has observed working on real browser · deployment hash recorded. |

**Rule:** no component may skip a tier. Local-test pass does NOT imply
Gate-1 verified. Gate-1 pass does NOT imply Gate-2 verified. Production
verification is only after explicit owner authorisation.

## Owner-recommended decisions · 2026-11-02

Treat as implementation guidance (RECOMMENDED, not yet SEALED). Must be
preserved in-code when wiring · do not weaken or re-interpret:

- **D1** · Gratis users = 10 active products. Shop Standard = 50 active.
  Shop Unlimited = unlimited (fair use). Active paid Shop entitlement
  SUPERSEDES the Gratis cap · precedence is paid-first.
- **D2** · "10 video slots" on Shop Standard means **up to 10 active
  products may each have an attached video**. NOT a lifetime upload
  count. Requires product-video linkage (schema follow-up).
- **D4** · Per-account **DB-row** lock with transaction-level row
  locking. The quota check AND the reservation must happen inside the
  same transaction. Applied consistently to Vault quota reservations
  AND Sell listing reservations. Never rely on an unchecked
  application-level count.
- **D5** · Stripe-hosted Checkout for additional Sell listing charges
  unless a documented technical limitation prevents it. **Keep the
  listing pending until a verified successful payment webhook event
  confirms the charge.** Never release a listing based on a browser
  redirect alone.
- **Country pricing** · Independent Ireland / Indonesia / Worldwide
  pricing registries parameterised by `NEX_APP_IDENTITY`. Do NOT invent
  or publish Indonesia / Worldwide amounts. Existing IDR prices on
  `/settings/tier` remain intact.

## Legend

- ✅ **implemented** · code exists + TypeScript compiles
- 🟡 **locally tested** · passes without DB/Stripe
- 🧪 Gate-1 verification required (R-x pending scratch rehearsal)
- 🪝 Gate-2 verification required (Stripe test-mode pending)
- 🌐 Production verification required (deployment pending)
- ⬜ not started
- 🔒 blocked on owner decision or external gate
- Test categories · `[pure]` `[in-memory]` `[postgres]` `[stripe]` `[browser]`

---

## Gate 1 · Database Foundation

| Item | Status | File / artefact | Verification state |
|---|---|---|---|
| Migration 207 (onboarding + vault_trial) | ✅ drafted | `nex-supabase/migrations/207_*.sql` | 🟡 awaits scratch apply |
| Migration 257 (independent Shop + Vault entitlements) | ✅ drafted | `nex-supabase/migrations/257_*.sql` | 🟡 awaits scratch apply |
| Migration 258 (billing foundation · 6 cols + 3 tables + 4 partial unique indexes) | ✅ drafted | `nex-supabase/migrations/258_*.sql` | 🟡 awaits scratch apply · PL/pgSQL defects corrected |
| 214/257 `business_trial_status` collision | 🔒 open | documented in 257 notes | **BLOCKER** · 214 line 54 needs `ADD COLUMN IF NOT EXISTS` before 214 is scheduled |
| Scratch runner for 207 (localhost-only) | ✅ | `scripts/apply-migration-207-scratch.mjs` | — |
| Scratch runner for 257 (localhost-only) | ✅ | `scripts/apply-migration-257-scratch.mjs` | — |
| Scratch runner for 258 (localhost-only) | ✅ | `scripts/apply-migration-258-scratch.mjs` | — |
| Supabase BillingStore adapter | ✅ **implemented** | `src/lib/nex-native/billing/supabase-store.ts` | 🧪 **R-1..R-11 all pending Gate-1 scratch rehearsal · NOT verified** |
| `withTransaction` for atomic flows | ✅ **implemented** | same file · R-7 flagged | 🧪 **pending Gate-1 rollback test** |
| Scratch rehearsal **execute** | ⬜ | awaiting user to set `SCRATCH_DATABASE_URL` + create `D:\pg-scratch\` | — |

### Rehearsal verification matrix (to be executed at Gate 1)

| ID | Verifies |
|---|---|
| R-1 | Atomic `claimEvent` returns `{isClaimed:true}` once, `false` on duplicate |
| R-2 | Partial unique index on `nex_billing_adverse_event` blocks duplicate dispute/refund/origin-event/admin-action |
| R-3 | `clearAdverseEvent` only clears when `access_block_cleared_at IS NULL` |
| R-4 | `readProductView` joins account snapshot + adverse rows atomically |
| R-5 | `updateProductSubscription` writes ONLY per-product columns · no cross-product leakage |
| R-6 | `ON DELETE CASCADE` from `nex_account` removes checkout + adverse rows |
| R-7 | `withTransaction` rolls back ALL writes if any statement throws |
| R-8 | `insertCheckoutSession` unique-violation on `stripe_idempotency_key` surfaces distinctly |
| R-9 | `findPendingCheckoutMappingEvents` respects the partial index |
| R-10 | 257 Part 6 backfill updates both bisnis accounts to `shop_tier='unlimited'` |
| R-11 | `pg_advisory_xact_lock(258000001)` serialises concurrent attempts |

---

## Gate 2 · Stripe Integration (test-mode)

| Item | Status | File / artefact | Verification state |
|---|---|---|---|
| Price registry · env-var-backed · fail-closed | ✅ built | `price-registry.ts` | ✅ 7 pure tests pass |
| Webhook handler service · signature verify + outcome→HTTP mapping | ✅ built | `webhook-handler.ts` | 🟡 awaits Stripe test-mode |
| Webhook endpoint route (thin shell) | ✅ built | `src/app/api/nex-native/billing/webhook/stripe/route.ts` | 🟡 awaits test-mode webhook delivery |
| Checkout endpoint route (thin shell · session-auth · server-side price-ID) | ✅ built | `src/app/api/nex-native/billing/checkout/route.ts` | 🟡 awaits test-mode checkout |
| Core processor dispatcher (9 event types) | ✅ built | `webhook-processor.ts` | ✅ 49 in-memory tests pass |
| Checkout service (pure logic + Stripe interface) | ✅ built | `checkout-session.ts` | ✅ in-memory tests pass |
| Reconciliation handler + replay guard | ✅ built | `reconciliation.ts` | ✅ 4 pure tests pass |
| Cancellation module (independent Shop + Vault) | ✅ built | `cancellation.ts` | ✅ 9 in-memory tests pass |
| **Env vars required** for enablement | 🔒 | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | not configured yet |
| PaymentIntents path for Sell extra listings | ⬜ | separate endpoint planned | not started |
| Reconciliation cron (Vercel Cron / scheduled job) | ⬜ | handler ready · schedule TBD | not started |
| Stripe test-mode walkthrough (checkout → success → webhook → access granted) | ⬜ | — | awaits Stripe account configuration |

---

## Gate 3 · Server-side enforcement (connect helpers to real operations)

Reference audit: `src/lib/nex-native/billing/ENFORCEMENT_COVERAGE_MAP.md`.

| Operation | Current gate | Helper (built) | Wired? | Blocker |
|---|---|---|---|---|
| Shop product create | Gratis 10-cap only | `enforceShopProductLimit` | ⬜ | 🔒 D1 · Gratis-vs-Shop cap precedence rule |
| Shop video upload (slot) | Live eligibility only | `enforceVideoSlotLimit` | ⬜ | 🔒 D2 · "10 slots" semantics (products-with-video vs videos) |
| Shop video length | **none** | `enforceVideoLengthLimit` | ⬜ | ready to wire (no owner decision needed) |
| Vault file size | 100 MiB binary (wrong unit + wrong value) | `enforceVaultFileSize` | ⬜ | 🔒 D3 · confirm 50 MB decimal cap replaces 100 MiB binary |
| Vault total storage | **none** | `enforceVaultStorageQuota` | ⬜ | 🔒 D4 · per-account advisory-lock design |
| NEX Sell free listings | **none** | `enforceFreeListingAllowance` | ⬜ | 🔒 D4 (same) |
| NEX Sell extra €1.30 charge | **none** | `enforceAdditionalListingPayment` + future PaymentIntent | ⬜ | 🔒 D5 · PaymentIntent execution path |

### Owner-recommended decisions (2026-11-02 · implementation guidance)

- **D1** · ✅ owner-recommended · Paid Shop entitlement SUPERSEDES Gratis cap. Gratis=10 · Standard=50 · Unlimited=fair-use.
- **D2** · ✅ owner-recommended · 10 slots = **10 active products each with an attached video**. Requires product-video linkage (follow-up schema).
- **D3** · ⬜ · 50 MB decimal replaces 100 MiB binary · still awaiting user-visible rollout confirmation.
- **D4** · ✅ owner-recommended · **Per-account DB-row lock with transaction-level row locking**. Quota check + reservation must be atomic.
- **D5** · ✅ owner-recommended · Stripe-hosted Checkout for extra listing. **Listing pending until verified webhook confirms payment**.

---

## Gate 4 · Customer billing interface

| Item | Status | Notes |
|---|---|---|
| Package list page `/packages` | 🔒 sealed · do not alter until enforcement + pricing locked |
| "My subscriptions" page | ⬜ | reads via `readProductView` for shop + vault |
| Checkout entry (button → POST /api/.../checkout → redirect to Stripe) | ⬜ | thin UI calling the drafted endpoint |
| Package limits + usage display (products N/50, videos N/10, Vault x.x GB / 5 GB) | ⬜ | pure reads · no new DB |
| Payment status + renewal date | ⬜ | derived from snapshot |
| Cancellation UX (cancel at period end · with timeline from `computeCancellationTimeline`) | ⬜ | — |
| Upgrade UX (Shop Standard → Unlimited; Vault 5gb → 25gb etc.) | ⬜ | Stripe subscription update API · not drafted |
| Billing history / invoices | ⬜ | Stripe invoice list via API |
| Failed-payment banner · "Update payment method" link | ⬜ | — |
| Grace-period messaging | ⬜ | copy depends on access level |

---

## Gate 5 · NEX Admin billing surface

| Item | Status | Notes |
|---|---|---|
| Search account → view subscriptions | ⬜ | reads adapter |
| Event history view (nex_billing_event_log) | ⬜ | — |
| Payment failure review | ⬜ | queries past_due + grace views |
| Refund / dispute review | ⬜ | reads adverse-event table · includes two-axis display |
| Manual access override (`adminRevokeAccess` + `adminClearRevocation`) | ✅ handlers built | 🟡 admin UI not built |
| Audit trail (admin_action_id uniqueness) | ✅ enforced in schema + handler | — |
| Access control on admin surface | ⬜ | tied to existing `requireHqAdmin` seal |

---

## Gate 6 · International support

| Item | Status | Notes |
|---|---|---|
| Country-specific currency / price per `NEX_APP_IDENTITY` | ⬜ | pattern exists · pricing env vars needed per country |
| Ireland prices (€19.99 / €29.99 / €9.99 / €1.30) | 🟡 locked | not yet in env |
| Indonesia prices (Rp equivalents · TBD) | 🔒 | owner decision pending |
| Worldwide (fallback / future) | 🔒 | owner decision pending |
| No shared-component hardcoding | ✅ principle · to be enforced in UI tasks | — |

---

## Gate 7 · End-to-end testing

| Category | Current count | Status |
|---|---|---|
| **[pure]** | 36 | ✅ |
| **[in-memory]** | 49 | ✅ |
| **[postgres]** | 0 | ⬜ (gated on Gate 1 execute) |
| **[stripe]** | 0 | ⬜ (gated on Gate 2 test-mode) |
| **[browser / e2e]** | 0 | ⬜ (gated on Gates 4-5 UI) |
| **Total** | **85** | — |

### Scenarios to cover at each category

- `[postgres]` · atomic claim under concurrent duplicate deliveries · partial unique index enforcement · ON DELETE CASCADE · advisory lock serialisation · byte accounting (SUM query) · transaction rollback with no residue
- `[stripe]` · test-mode checkout happy path · signature verification · webhook replay (idempotency) · refund + dispute · failed-payment retry
- `[browser / e2e]` · click Checkout → Stripe test-mode success URL → see new tier · cancel subscription → access remains until period_end · grace-period banner surfaces · admin revoke blocks access immediately

---

## Gate 8 · Production launch (DO NOT TOUCH without explicit authorisation)

- 214/257 collision resolved
- All migrations rehearsed + authored into a sequenced apply plan
- Stripe account configured with real products + prices
- All env vars set on Vercel (production)
- Customer UI + Admin UI shipped
- Legal review complete (DAC7/DSA/PSD2/consumer-protection/GDPR per Social Commerce D4)
- Final owner authorisation received

---

## Hard rules preserved from doctrine

- NEX never handles payment settlement between buyer and seller · Stripe only · "NEX never handles payments" sealed
- Trial access policy `TRIALING_ACCESS_LEVEL = "none"` (DRAFT) · owner decision pending (A/B/C)
- Vault LOCKED 2026-10-20 · fail-safe deletion gate · W1-W12 unscheduled
- Service Principle DRAFT 2026-10-20 · "best effort" wording insufficient where harm from failure is non-recoverable
- `/packages` + `/welcome` SEALED · do NOT alter until pricing + enforcement complete
- Build-Commit-Push doctrine · nothing claimed complete until committed + pushed + verified
- Country content stays country-scoped via `NEX_APP_IDENTITY` · never code forks
