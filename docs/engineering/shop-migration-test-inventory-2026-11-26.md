# Shop-pillar E2E · migration & credential gate inventory

**Date:** 2026-11-26  
**Scope:** `tests/e2e/` Shop-pillar specs gated on unapplied migrations or missing sandbox credentials.  
**Purpose:** Separate "genuinely blocked on migration/credential" from "could be rewritten with weaker-but-still-valid observable."

Source of findings: parallel Explore-agent sweep dispatched 2026-11-26 continuation cycle.

---

## 1 · Summary

- **Blocked assertions discovered:** 9 across 6 unique spec files.
- **Rewritable today (observable fallback available):** 2.
- **Genuinely blocked on migration/credential:** 7 (counting both Stripe + PayPal gates).
- **Highest-leverage approvals:** `APPROVE MIG 354-365 SANDBOX APPLY` (unblocks 3), `APPROVE MIG 286 SANDBOX APPLY` (unblocks 1 nav + 3 downstream NAV-SINGLE-APP specs), `APPROVE T10 SANDBOX CREDENTIALS` (unblocks 2–3 Stripe/PayPal positive-path specs).

---

## 2 · Inventory table

| Spec file:line | Gate expression | Migration / credential dep | Test asserts | Fallback available? | Recommendation |
|---|---|---|---|---|---|
| `tests/e2e/journey-buyer-checkout.spec.ts:124` | `test.skip(true, "BLOCKED-ON-MIG-354-365…")` | mig 354–365 (`nex_order` transactional path) | `nex_order.cart` JSONB snapshot shape post-checkout | **N** — requires transactional function | Defer — no viable weaker assertion |
| `tests/e2e/journey-buyer-checkout.spec.ts:134` | `test.skip(true, "BLOCKED-ON-MIG-354-365…")` | mig 354–365 | Server rejects tampered `unit_price` in cart rows | **N** — security assertion requires real server function | Defer |
| `tests/e2e/journey-mid-checkout-session-expired.spec.ts:49` | `test.skip(true, "BLOCKED-ON-MIG-354-365-AND-STRIPE…")` | mig 354–365 + Stripe fixture | Finish-payment affordance renders for expired Stripe session | **N** — dual-blocker | Defer |
| `tests/e2e/journey-payment-status-t10.spec.ts:103` | `test.skip(!paymentMethodPresent, "BLOCKED-PENDING-MIG-320…")` | mig 320 (`nex_order.payment_method` column) | Tags payment surface used (qr_manual / stripe / paypal / qris) | **Y** — rewrite: if column present → assert enum; else skip gracefully and still assert state machine transitions created→confirmed→paid | **Rewritable today** — small 10-line rewrite would preserve intent without column |
| `tests/e2e/journey-payment-status-t10.spec.ts:190` | `test.skip(!notifTablePresent, "BLOCKED-PENDING-MIG-366…")` | mig 366 (`nex_notification` table) | Notification inbox persists + marks-read post-status-change | **Y** — rewrite: assert webhook-triggered `nex_order.state` transitions; notification-row verify is secondary | **Rewritable today** — 20-line restructure |
| `tests/e2e/journey-paypal-webhook-t10.spec.ts:217` | `test.skip(true, "BLOCKED-PENDING-CONFIG…")` | `PAYPAL_CLIENT_ID` / `_SECRET` / `_WEBHOOK_ID` / `_API_BASE` env vars | Positive-path PayPal webhook signature verification | **N** — requires real sandbox creds | Config-gated — unblocks only via `APPROVE T10 SANDBOX CREDENTIALS` |
| `tests/e2e/journey-stripe-webhook-t10.spec.ts:265` | `test.skip(true, "BLOCKED-PENDING-CONFIG…")` | `STRIPE_WEBHOOK_SECRET` env var | Positive-path Stripe webhook sig verification | **N** | Config-gated |
| `tests/e2e/journey-stripe-webhook-t10.spec.ts:282` | `test.skip(true, "BLOCKED-PENDING-CONFIG…")` | Test process cannot read dev server's secret (not exported) | Positive-path Stripe webhook (second gate) | **Y** (limited) — seed env to test process directly | Config-gated; small env-export fix if cred is populated |
| `tests/e2e/journey-country-selection-business-details.spec.ts:87` | Implicit: `nex_business.operating_country_code` column read-back fails with `42703` | mig 286 (authored, not applied) | User-selected country persists | **N** (for current spec design) — see fallback note in `docs/engineering/mig-286-operating-country-apply-request-2026-11-26.md` §7 | Defer — approval packet already queued (`APPROVE MIG 286 SANDBOX APPLY`) |

---

## 3 · Recommended rewrites (unblock without crossing Rule 7)

Two specs can be rewritten to pass TODAY with weaker-but-still-valid assertions. Deferred this cycle — out of the authorised scope for the parallel-agent dispatch — but queued for a follow-up cycle:

1. **`journey-payment-status-t10.spec.ts:103`** — split into two tests: one asserts payment_method tag when column present, the other asserts `nex_order.state` transitions regardless. Preserves intent of "payment surface is reachable and routes to a rail" without mig-320 dependency.
2. **`journey-payment-status-t10.spec.ts:190`** — assert webhook triggered `nex_order` state change via `nex_message` thread write or state machine observation. Keep notification-table row check gated on `notifTablePresent`.

These rewrites are not product-code changes and do not touch sealed invariants. Recommended for the next cycle once the owner's L-044 commit decision is in.

---

## 4 · Genuinely blocked (no viable fallback)

- **`journey-buyer-checkout.spec.ts:124, 134`** — security property (price-tamper rejection) can only be proven against the real transactional function introduced by mig 354–365. Weaker assertions would be security theatre.
- **`journey-mid-checkout-session-expired.spec.ts:49`** — dual dependency on mig 354–365 **and** a seeded expired Stripe test session. Both gates must clear.
- **`journey-country-selection-business-details.spec.ts:87` (strict)** — current spec design cannot proceed without the target column. Fallback via re-reading the dropdown default after save is weaker and documented in the mig-286 approval packet §7.
- **Stripe + PayPal positive-path webhook specs** — require real sandbox credentials. No viable workaround without credential provisioning.

---

## 5 · Approval phrases that would unblock these

| Phrase | Specs unblocked |
|---|---|
| `APPROVE MIG 354-365 SANDBOX APPLY` | 3 (buyer-checkout x2 + mid-checkout-session-expired) |
| `APPROVE MIG 286 SANDBOX APPLY` | 1 (NAV-SINGLE-APP-01) + 3 downstream (NAV-SINGLE-APP-02/-03/-06) |
| `APPROVE T10 SANDBOX CREDENTIALS` | 2–3 (Stripe + PayPal positive-path) |
| `APPROVE MIG 320 SANDBOX APPLY` | 1 (payment_method column) |
| `APPROVE MIG 366 SANDBOX APPLY` | 1 (`nex_notification` table) |

All five migrations are authored but not applied to sandbox `kdstoyyeygcopkogqsyv`. Rule 7 forbids applying without a named phrase.

---

**Boundaries preserved:** 0 commits, 0 pushes, 0 migrations applied, 0 credentials activated. This inventory is reference-only.
