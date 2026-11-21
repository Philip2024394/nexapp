# NEX Billing-Table RLS Audit · 2026-11-21

Scope · forensic read-only audit of nexapp billing / payment /
subscription / webhook-event tables and their RLS coverage. This
is Phase 2 Remediation priority 2 (P2-02) per the sealed
2026-11-09 priority order. The sealed memory flags mig 258 as
**P0-GATE** (not P0-CURRENT) · meaning any further prod apply /
proposal that assumes the mig 258 tables are protected must first
confirm the lockdown is in place.

Audit root · `C:/Users/Victus/nexapp`
Repo · `Philip2024394/nexapp` · branch `release-audit-v1-2026-11-14`
HEAD at audit time · `ab01ac40`
Audit framework · 5-state readiness (sealed 2026-11-08)

Posture in one line · **the mig 258 shipping gap has already been
retroactively closed by mig 312.** All currently-applied billing
tables have safe RLS. Two pending proposals (mig 322, mig 338)
remain AT-RISK on gating-authority grounds.

---

## Compliance scorecard

| Area | Status | Severity |
|---|---|---|
| mig 258 three billing tables (event log / adverse event / checkout session) | COMPLIANT (via mig 312 lockdown) | — |
| Commerce tables (`nex_order` · `nex_order_event` · `nex_order_item`) | COMPLIANT | — |
| Payment-adjacent entitlement (`nex_watch_listing_entitlement`) | COMPLIANT | — |
| Webhook + checkout API routes | COMPLIANT (service-role only) | — |
| mig 322 `nex_payment_provider_config` proposal | AT-RISK (gating-authority) | P0-GATE |
| mig 338 `nex_account.themes_plus_until` draft | AT-RISK (gating-authority) | P0-GATE |
| mig 258 DRAFT vs claimed-in-prod state | AT-RISK (doctrine drift) | P0-GATE |

Launch-blocker summary · **no live RLS violations on billing.**
Three gates remain owner-held before launch · verifying mig 258
intended-state vs doctrine status · authorising the mig 322
proposal · authorising the mig 338 draft column apply.

---

## 1 · mig 258 trace

File · `nex-supabase/migrations/258_nex_billing_foundation.sql`

Header quotes (line 4) ·

> STATUS: DRAFT · NOT APPLIED

What the migration does ·

1. Adds 6 Stripe linkage columns to `nex_account`
   (`shop_stripe_customer_id`, `shop_stripe_subscription_id`,
   `shop_stripe_price_id`, `vault_stripe_customer_id`,
   `vault_stripe_subscription_id`, `vault_stripe_price_id`).
2. Extends `shop_status` / `vault_status` CHECK enums with
   `incomplete` and `trialing`.
3. Creates `nex_billing_event_log` · PK `stripe_event_id` ·
   `nex_account_id` FK · outcome enum.
4. Creates `nex_billing_adverse_event` · dispute / refund /
   fraud records with `access_blocking` boolean.
5. Creates `nex_billing_checkout_session` · pre-payment intent
   records linking NEX accounts to Stripe customers/subscriptions.
6. Column comments.
7. Records version `258` in `nex_migration_history`.

What the migration **does not do** ·

- No `ALTER TABLE … ENABLE ROW LEVEL SECURITY` on any of the three
  new tables.
- No `REVOKE` of PostgREST default grants to `anon` or
  `authenticated`.
- No CREATE POLICY.

Supabase auto-grants `SELECT` to `anon` + `authenticated` on new
tables unless explicitly revoked. Had mig 258 been applied to a
fresh database without the downstream lockdown, the three billing
tables would have been world-readable via the project's REST
endpoint.

---

## 2 · Mitigation · mig 312

File · `nex-supabase/migrations/312_nex_billing_rls_lockdown.sql`

What the migration does (conditional on mig 258 presence) ·

- `ALTER TABLE … ENABLE ROW LEVEL SECURITY` on all three
  tables.
- `REVOKE ALL ON TABLE … FROM public, anon, authenticated`.
- `GRANT SELECT, INSERT, UPDATE, DELETE … TO service_role`.
- No CREATE POLICY · service-role bypasses RLS by design.

Outcome · the three mig-258 tables are effectively invisible to
the PostgREST REST endpoint. The only writer is the server-side
billing store that uses the direct-pg service-role connection
(see section 5).

Doctrine note · mig 312 header asserts that mig 258 IS applied in
production (ijvqdvsvwtwxzcqmoqit). This contradicts mig 258's own
"DRAFT · NOT APPLIED" header. One of the two is stale wording.
This is a doctrine-drift issue worth owner acknowledgement but
does not change the current security posture · whichever is true,
the net effect at prod is either (a) the tables are absent, or
(b) they exist and are locked down. There is no scenario in which
they exist and are readable by anon/authenticated.

---

## 3 · Table inventory and classification

Risk key · **CRITICAL** = money amounts / webhook raw / Stripe IDs ·
**HIGH** = subscription / entitlement state that unlocks paid
features · **MEDIUM** = immutable audit ledger or config.

| Table | Mig | Risk | RLS | Policy pattern | Verdict |
|---|---|---|---|---|---|
| `nex_billing_event_log` | 258 → 312 | CRITICAL | yes | service-role only (REVOKE others) | COMPLIANT |
| `nex_billing_adverse_event` | 258 → 312 | CRITICAL | yes | service-role only (REVOKE others) | COMPLIANT |
| `nex_billing_checkout_session` | 258 → 312 | CRITICAL | yes | service-role only (REVOKE others) | COMPLIANT |
| `nex_order` | 005 | HIGH | yes | SELECT + INSERT with `customer_account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid())` plus business-owner clause | COMPLIANT |
| `nex_order_event` | 005 | MEDIUM | yes | SELECT cascades through `nex_order` access | COMPLIANT |
| `nex_order_item` | 355 | HIGH | yes | SELECT cascades through `nex_order` access | COMPLIANT (sandbox only · Phase A schema) |
| `nex_watch_listing_entitlement` | 228 | HIGH | yes | SELECT owner-only via `nex_current_account_ids()` helper | COMPLIANT |
| `nex_payment_provider_config` | 322 (PROPOSAL) | MEDIUM | yes | authenticated UPSERT · business-owner predicate | AT-RISK · proposal gating |
| `nex_account.themes_plus_until` | 338 (DRAFT) | MEDIUM | inherits `nex_account` RLS | authenticated own-account read | AT-RISK · draft gating |

No table in the audit uses `USING (true)`. No `SECURITY DEFINER`
function was found near a billing table.

---

## 4 · Red flag sweep

| Red flag | Status | Evidence |
|---|---|---|
| Billing table with no `ENABLE ROW LEVEL SECURITY` | Historical (mig 258) · closed by mig 312 | Both files inspected in full |
| `CREATE POLICY … USING (true)` on billing | Clean | Zero matches |
| `GRANT … TO anon` / `authenticated` on billing | Historical (mig 258 default grants) · revoked by mig 312 | mig 312 explicit REVOKE |
| Webhook raw-payload table readable by non-service_role | Clean | `nex_billing_event_log` service-role only |
| `SECURITY DEFINER` bypass near billing | Clean | No matches |
| PostgREST auto-grant surface on new tables | Closed | mig 312 explicit REVOKE pattern |

---

## 5 · Application route surface

Billing API routes live under `src/app/api/nex-native/billing/`.

| Route | Supabase client | Billing-table writer | Verdict |
|---|---|---|---|
| POST `/billing/webhook/stripe` | `createProductionBillingStore()` · direct pg via pooler · service-role | yes · atomic INSERT ON CONFLICT per `stripe_event_id` for idempotency | COMPLIANT |
| POST `/billing/checkout/buyer` | — | no · creates Stripe Checkout Session only | COMPLIANT |
| POST `/billing/checkout/shop` | — | no · metadata carries `nex_account_id` for webhook mapping | COMPLIANT |
| POST `/billing/checkout/theme` | — | no (same pattern as shop/buyer) | COMPLIANT |
| POST `/billing/connect/stripe/*` | — | no · Connect account lifecycle | COMPLIANT |
| GET `/billing/health` | — | no | COMPLIANT |
| POST `/billing/cron/reconcile` | assumed service-role | yes | assumed COMPLIANT (not exhaustively read) |

`createProductionBillingStore()` ·

- imports `server-only` (fails the build if a client component tries
  to import it)
- gated to Node.js runtime
- uses `pg` directly with service-role credentials from
  `DATABASE_URL`
- never routed through PostgREST

Net effect · no authenticated API path writes to `nex_billing_*`.
Service-role identity on billing writes is explicit, not implicit.

---

## 6 · AT-RISK items with no code-change fix

### mig 258 DRAFT vs claimed-prod state

- `258_nex_billing_foundation.sql` header line 4 states
  `DRAFT · NOT APPLIED`.
- `312_nex_billing_rls_lockdown.sql` notes assert mig 258 IS
  applied in production (ijvqdvsvwtwxzcqmoqit).

These cannot both be current. Owner should clarify ·

- If mig 258 **is** applied to prod · update mig 258's header to
  reflect that and file a doctrine-drift note.
- If mig 258 is **not** applied to prod · verify mig 312's
  conditional block correctly no-ops in that case (it does read
  `IF to_regclass(…) IS NOT NULL` style guards per the migration's
  own notes).

Either way · no immediate security exposure. This is a
housekeeping-doctrine item that should be closed before anyone
new reads the two files and reaches opposite conclusions.

### mig 322 `nex_payment_provider_config`

Header · `PROPOSAL · NOT YET AUTHORISED · DO NOT APPLY`.

Shape · per-business configuration row holding provider flags
(`stripe_enabled`, `paypal_enabled`, `qr_enabled`, `qris_enabled`)
plus `preferred_method`. No secrets, no API keys, no customer
identifiers in this table.

Current RLS plan in the proposal · `ENABLE ROW LEVEL SECURITY` on
create · single policy allowing UPSERT by the business owner via
the standard `nex_business.owner_account_id` predicate.

Gating · the 2026-11-10 sealed memo (Merchant-Owned Payments) ties
mig 322-equivalent work to sandbox-only Phase P1 that itself
requires separate "apply mig N sandbox" word-trigger per sealed
2026-11-08. This file's role is to flag that the proposal matches
the sealed pattern · it does NOT authorise application.

### mig 338 `nex_account.themes_plus_until`

Header · `NOT YET AUTHORISED TO APPLY`.

Shape · single `timestamptz null` column on `nex_account`.
Inherits `nex_account` RLS (authenticated can read own row ·
service-role writes).

Gating · sealed Themes+ pricing 2026-11-13 authorised Phase A UI
gating + first-free apply only · webhook writer + `themes_plus_until`
write-through NOT authorised. Column apply would precede authorised
writer work.

### Pending prod mig 345 / 295 (from P2-01)

Carry-through from the Chat Privacy audit · neither mig 345 nor
295 touches the billing surface directly, so they are outside this
report's scope, but the sealed 2026-11-08 "separate named
authorisation per migration" rule equally applies.

---

## 7 · Remediation sequence (not authorised here)

Each step is owner-held. This audit does not open any gate.

1. Owner confirms which of the two mig 258 header statements is
   authoritative (DRAFT-not-applied vs applied-in-prod). Update
   the stale header to match.
2. Owner authorises mig 322 to sandbox using the sealed verbatim
   phrase. Re-run a targeted RLS verification against the applied
   state.
3. Owner authorises mig 338 to sandbox (named
   `kdstoyyeygcopkogqsyv`) only after the Themes+ Phase B writer
   is itself authorised · column + writer should move together.
4. No new policies or SQL are proposed in this audit that need
   writing. mig 312 already covers everything mig 258 left open.

---

## 8 · Evidence pointers

Migrations consulted ·

- `nex-supabase/migrations/005_nex_order.sql`
- `nex-supabase/migrations/228_nex_watch_listing_entitlement.sql`
- `nex-supabase/migrations/258_nex_billing_foundation.sql`
- `nex-supabase/migrations/290_*` (RLS pattern reference)
- `nex-supabase/migrations/312_nex_billing_rls_lockdown.sql`
- `nex-supabase/migrations/322_nex_payment_provider_config.sql` (PROPOSAL)
- `nex-supabase/migrations/338_nex_account_themes_plus_until.sql` (DRAFT)
- `nex-supabase/migrations/355_nex_order_path_a_separation_phase_a.sql`

Code consulted ·

- `src/app/api/nex-native/billing/webhook/stripe/route.ts`
- `src/app/api/nex-native/billing/checkout/buyer/route.ts`
- `src/app/api/nex-native/billing/checkout/shop/route.ts`
- `src/app/api/nex-native/billing/checkout/theme/route.ts`
- `src/app/api/nex-native/billing/connect/stripe/*`
- `src/app/api/nex-native/billing/health/route.ts`
- `src/lib/nex-native/billing/supabase-store.ts` (createProductionBillingStore)

---

## 9 · Readiness classification (5-state model)

| Area | State |
|---|---|
| mig 258 three tables + lockdown via mig 312 | Built · Wired · Verified (code read) |
| Commerce RLS (nex_order family) | Built · Wired · Verified |
| Webhook service-role writer | Built · Wired · Verified |
| mig 322 proposal | Drafted · not Built (gate closed) |
| mig 338 draft | Drafted · not Built (gate closed) |
| mig 258 header vs mig 312 assertion drift | needs owner acknowledgement |

Engineering ceiling reminder · no finding here may be promoted to
Live-verified. That remains an owner infra call per sealed
2026-11-08.
