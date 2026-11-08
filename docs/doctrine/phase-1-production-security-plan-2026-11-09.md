# NEX Phase 1 · Production Security P0-CURRENT Remediation Plan
### 2026-11-09

**Author:** Claude Opus 4.7 · operating under owner-authorised Phase 1 research deliverable scope ("begin" response to Phase 1 research authorisation).
**Scope:** documentation-only research + build plan for Phase 1 production-security remediation. **No code · no DB · no migrations applied · no commits · no pushes · no deployments.**
**Authorisation that this document does NOT grant:** code changes, migration authoring, migration application, Supabase configuration change, production apply. Those remain gated on the owner's separate "begin Phase 1 implementation" message.
**Related doctrines:** Launch Readiness Baseline Report (sealed 2026-11-09), §17.1 inventory doctrine (sealed 2026-11-09), Phase 2 sealed remediation priorities (2026-11-09).

---

## 0 · Phase lifecycle position

This document is deliverable **A (Research/Plan)** for Phase 1 per the sealed lifecycle:

```
A. RESEARCH / PLAN · YOU ARE HERE
   ↓
B. OWNER AUTHORISES IMPLEMENTATION ("begin Phase 1 implementation")
   ↓
C. BUILD (sandbox-only · migrations with rollback · tests)
   ↓
D. VERIFY (DB scans + route tests + regression checks)
   ↓
E. INDEPENDENT SIGN-OFF (owner + external reviewer where privacy-sensitive)
   ↓
F. PHASE COMPLETE
```

Priority 1 (Phase 2 · chat device-only) and this phase (Phase 1 · production security) are **independent workstreams** · neither blocks the other · Phase 1 is shorter (1-2 weeks sandbox) and can run in parallel with Phase 2 planning.

---

## 1 · Executive summary

Three P0/P1 production exposures confirmed live on `ijvqdvsvwtwxzcqmoqit` by the inventory doctrine. Each has a bounded fix with a clear build spec and rollback plan.

| # | Fix | Severity | Scope | Effort |
|---|---|---|---|---|
| **F-1** | Billing tables RLS gap · mig 258 applied without RLS policies | **P0-CURRENT** | 1 new migration · explicit revoke/grant + enable RLS + zero-policy denial | 2 days sandbox + test |
| **F-2** | Rate-limit infrastructure · mig 290 not applied to production | **P1-CURRENT** | Apply existing mig 290 to production after sandbox verify | 1 day production apply |
| **F-3** | Buyer checkout price-trust vulnerability | **P1-CURRENT** | Code change in `/api/nex-native/billing/checkout/buyer/route.ts` · require `productId` per item · server-side price resolution | 2 days code + test |

**Not in Phase 1 scope** (deferred to Phase 2 or later):
- Public bucket `nex-peer-chat-attachments` split · Phase 2
- 91/105 API routes lacking rate limits · later security hardening
- CSRF tokens on API POST routes · later security hardening
- Stripe Connect requirement columns publicly readable · P2 later hardening
- Signed-URL enumeration · P3 later hardening
- Mig 258 `TRIALING_ACCESS_LEVEL` policy option A/B/C · owner decision pending · not a security defect, a business-rule decision

---

## 2 · Severity confirmation (evidence-based)

| Fix | Pre-inventory classification | Post-inventory evidence | Current classification |
|---|---|---|---|
| F-1 Billing RLS | P0-GATE "when applied" (Phase 1 Baseline report) | Mig 258 IS applied to production per inventory §3 | **P0-CURRENT** · elevated from GATE |
| F-2 Rate-limit | P1-CURRENT (Phase 1 Baseline) | Mig 290 NOT applied to production · routes depend on in-memory fallback · not distributed | **P1-CURRENT** · confirmed |
| F-3 Buyer price-trust | P1-CURRENT (my own R33 bug · Phase 1 Baseline) | Code still contains the pattern · line 214-221 of buyer route | **P1-CURRENT** · confirmed |

---

## 3 · Per-fix build specifications

### F-1 · Billing tables RLS gap (P0-CURRENT)

#### Current state (evidence)

Migration 258 (applied to production per inventory) creates three tables:
- `nex_billing_event_log` (PK stripe_event_id · PII: customer IDs, subscription IDs, invoice IDs, charge IDs, dispute IDs, refund IDs, periods, outcomes)
- `nex_billing_adverse_event` (per-account dispute / refund / fraud / admin records · open+historical)
- `nex_billing_checkout_session` (purchase-intent records · Stripe customer IDs · subscription IDs)

The migration declares the tables but defines **no RLS policies**. Supabase's default behaviour grants `anon` and `authenticated` roles access on new tables unless explicitly revoked. Mig 290 (authored later) learned this lesson and includes explicit REVOKE + RLS-enabled-zero-policies (lines 71-82). Mig 258 was authored earlier and does not.

**Production consequence:** any authenticated client issuing a Supabase REST / PostgREST request can read Stripe PII and dispute records. Live exposure.

#### Target state

Three tables return zero rows to anon + authenticated roles via PostgREST. Service-role path continues to work (NEX server reads/writes via service-role · bypasses RLS).

#### Build spec

Author one new migration: `nex-supabase/migrations/312_nex_billing_rls_lockdown.sql`

```sql
-- Pseudo-code · final SQL to be reviewed line-by-line before apply
BEGIN;

-- Verify prerequisites
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '258') THEN
    RAISE EXCEPTION 'Prerequisite migration 258 missing.';
  END IF;
  IF EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '312') THEN
    RAISE EXCEPTION 'Migration 312 already recorded.';
  END IF;
END $$;

-- Apply the mig-290 pattern to all three billing tables
ALTER TABLE nex_billing_event_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_billing_adverse_event   ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex_billing_checkout_session ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON nex_billing_event_log        FROM public, authenticated, anon;
REVOKE ALL ON nex_billing_adverse_event    FROM public, authenticated, anon;
REVOKE ALL ON nex_billing_checkout_session FROM public, authenticated, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON nex_billing_event_log        TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON nex_billing_adverse_event    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON nex_billing_checkout_session TO service_role;

-- Zero policies · default-deny for anon + authenticated via PostgREST
-- Service-role bypasses RLS at Supabase level

INSERT INTO nex_migration_history (version, applied_at, description, notes)
VALUES (
  '312',
  NOW(),
  'nex_billing tables RLS lockdown · explicit revoke + RLS enable + service-role-only grants',
  'Owner-authorised Phase 1. Corrects mig 258 omission: Supabase auto-grants anon+authenticated on new tables, and mig 258 did not revoke. Three tables: event_log, adverse_event, checkout_session. Mirrors mig 290 pattern (sealed 2026-11-08).'
);

COMMIT;
```

#### Rollback (per I-5 · must NOT re-expose content)

A rollback of F-1 does NOT restore private chat content (irrelevant to this fix). But it DOES potentially re-expose the billing tables. Rollback script therefore ships with a safety CHECK:

```sql
-- 312_nex_billing_rls_lockdown.rollback.sql
BEGIN;

-- Safety: this rollback is destructive to the privacy fix.
-- It is intended for immediate-post-apply verification failures only.
-- It must not run during a service-recovery scenario beyond the apply window.

ALTER TABLE nex_billing_event_log       DISABLE ROW LEVEL SECURITY;
ALTER TABLE nex_billing_adverse_event   DISABLE ROW LEVEL SECURITY;
ALTER TABLE nex_billing_checkout_session DISABLE ROW LEVEL SECURITY;

-- Note: we do NOT re-grant on anon/authenticated · Supabase defaults will
-- take effect but the owner should re-author grants explicitly if needed.
-- Leaving explicit re-grant out of the rollback is a defence-in-depth
-- posture: if a rollback is forced, the tables are not-readable rather
-- than world-readable.

DELETE FROM nex_migration_history WHERE version = '312';

COMMIT;
```

#### Dependencies

Mig 258 is the prerequisite (applied on production). No other prereqs.

#### Sandbox verification (post-build)

Mig 258 is NOT applied to sandbox (per inventory). To test F-1 in sandbox:
1. Apply mig 258 to sandbox (separate owner authorisation · creates the tables in sandbox for the first time).
2. Apply mig 312 to sandbox.
3. Verify: `SELECT * FROM nex_billing_event_log` via authenticated-role PostgREST returns zero rows (RLS enforced).
4. Verify: service-role select succeeds as before.
5. Verify: `nex_migration_history` records both 258 and 312.

Alternative (simpler): skip sandbox apply of 258 · author 312 with a conditional: if 258 isn't applied in the target env, 312 is a no-op (nothing to lock down). Then apply only in production where 258 lives.

**Recommended · conditional no-op** · avoids sandbox state divergence and avoids introducing 258 schema into a sandbox that doesn't need it. Build spec adjusted:

```sql
-- Conditional variant: only lock down if 258 is applied in target env
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM nex_migration_history WHERE version = '258') THEN
    RAISE NOTICE 'Mig 258 not applied in this env · 312 is a no-op here.';
    RETURN;
  END IF;
  -- ... RLS enable + revoke + grant body ...
END $$;
```

This lets 312 apply cleanly to both environments without state surgery.

#### Test plan

1. `V-F1-T1` · Authenticated-role PostgREST `GET /nex_billing_event_log` returns 0 rows (RLS enforced).
2. `V-F1-T2` · Anon-role PostgREST same call returns 0 rows.
3. `V-F1-T3` · Service-role pg client `SELECT COUNT(*) FROM nex_billing_event_log` returns actual count (service-role bypasses RLS · existing behaviour preserved).
4. `V-F1-T4` · Existing webhook processor code (which uses service-role) continues to insert/update event_log rows without error.
5. `V-F1-T5` · Rollback script applied · verify RLS disabled · verify ledger row removed · verify no re-grant to anon/authenticated (defence-in-depth per rollback script note).
6. `V-F1-T6` · Repeat T1-T4 on production AFTER separate production-apply authorisation.

#### Effort

2 days sandbox: 1 day author + unit-test + review · 1 day sandbox apply + verification. Production apply is a separate 1-day owner-controlled gate.

---

### F-2 · Rate-limit infrastructure (P1-CURRENT)

#### Current state (evidence)

Migration 290 creates `nex_security_rate_limit` table (owner-sealed 2026-11-08). Table is on **sandbox** per inventory. Table is **NOT** on production per inventory.

Code dependency: 34 files reference `recordIfAllowed` or `nex_security_rate_limit` (grep). Hot-path routes include:
- `/api/nex-native/chat/message/route.ts` (owner directive 2026-11-08 Item 4 · 60 msg/hour cap)
- `/api/nex-native/security/password/change/route.ts`
- `/api/nex-native/security/sessions/revoke/route.ts`
- `/api/nex-native/security/sessions/revoke-all/route.ts`
- `/api/nex-native/security/account/delete/route.ts`
- `/api/nex-native/auth/webauthn/assert-start,assert-finish,enroll-start,enroll-finish/route.ts`
- `/api/nex-native/hq/direct-message/route.ts`
- `/api/nex-native/chat/visitor-first-message/route.ts`
- `/api/nex-native/chat/visitor-session/route.ts`
- `/api/nex-native/incident/section-error/route.ts`

Fallback (per mig 290 header comment): process-local in-memory. Not distributed. Not cross-instance. On Vercel's serverless layer this means each cold-start container starts with an empty limiter · effectively no limit at scale.

#### Target state

Mig 290 applied to production. Rate-limit becomes a shared database counter across all serverless instances · the designed-for behaviour.

#### Build spec

No code change. No new migration. Apply existing mig 290 to production.

Script: `scripts/apply-migration-290-production.mjs` (new · follows the sandbox-script pattern but with PRODUCTION target + hard-safety on project ref)

```javascript
// Pseudo-code only · to be authored + reviewed line-by-line
import { Client } from "pg";
import { readFileSync } from "node:fs";

// Hard refuse if target ref is not production
// (copy ref-check pattern from existing sandbox scripts · reverse the check)
const databaseUrl = env("DATABASE_URL");  // production URL
const u = new URL(databaseUrl);
const ref = u.username.match(/\.([a-z0-9]{15,})/)?.[1] ?? null;
if (ref !== "ijvqdvsvwtwxzcqmoqit") { throw new Error("STOP · not production ref"); }

// Also require owner-trigger env var to prevent accidental re-runs
if (process.env.NEX_PRODUCTION_APPLY_CONFIRMED !== "YES-I-UNDERSTAND") {
  throw new Error("STOP · set NEX_PRODUCTION_APPLY_CONFIRMED=YES-I-UNDERSTAND to proceed");
}

const sql = readFileSync("nex-supabase/migrations/290_nex_security_rate_limit.sql", "utf8");
const c = new Client({ connectionString: databaseUrl });
await c.connect();
await c.query("BEGIN"); await c.query(sql); await c.query("COMMIT");

// Verify
const r = await c.query("SELECT version FROM nex_migration_history WHERE version='290'");
if (r.rows.length !== 1) throw new Error("Verify failed");

await c.end();
```

#### Rollback

Mig 290 ships with its own rollback file (`290_nex_security_rate_limit.rollback.sql`). The rollback is non-content (drops an empty table + its index). Safe to use.

Per I-5: this rollback does not touch private chat content. Allowed.

#### Dependencies

No prerequisite migrations beyond the baseline Supabase schema. Mig 290 is standalone.

#### Sandbox verification (already done)

Mig 290 is applied to sandbox (per inventory). Service-layer tests exist: `src/lib/nex-native/__tests__/security-rate-limit.test.ts` · `security-rate-limit-db-fallback.test.ts`. Rerun on sandbox to confirm current behaviour.

#### Production verification (post-apply)

1. `V-F2-T1` · After apply: `SELECT COUNT(*) FROM nex_security_rate_limit` returns 0 (empty table newly created).
2. `V-F2-T2` · Exercise one rate-limited route (e.g. password-change) with 11 rapid requests from same account · 10th or 11th returns 429 Too Many Requests with `Retry-After` header.
3. `V-F2-T3` · Repeat T2 from a second production-serverless instance (different user agent · different region) · confirm the counter is shared across instances (cross-instance enforcement working).
4. `V-F2-T4` · 30 minutes later · counter row's `window_started_at` has advanced · subsequent request succeeds (window reset working).
5. `V-F2-T5` · Rollback test: apply the rollback on sandbox · confirm fallback-to-in-memory behaviour still works (no runtime error).

#### Effort

0.5 day sandbox verification + 0.5 day production-apply window.

---

### F-3 · Buyer checkout price-trust vulnerability (P1-CURRENT)

#### Current state (evidence)

File `src/app/api/nex-native/billing/checkout/buyer/route.ts` · lines 69-103 define the request body:

```typescript
interface ParsedItem {
  readonly name: string;
  readonly amountMinor: number;   // ← client-supplied
  readonly currency: string;
  readonly quantity: number;
}
```

Line 87: `const amountMinor = typeof it.amountMinor === "number" ? Math.floor(it.amountMinor) : -1;`

Line 91: range validation `amountMinor < 0 || amountMinor > 100_000_000` (0 to 1,000,000 units in minor-currency form).

Lines 214-221: server passes client-supplied `amountMinor` directly to Stripe as `unit_amount`:

```typescript
const line_items = body.items.map((it) => ({
  price_data: {
    currency: it.currency,
    product_data: { name: it.name },
    unit_amount: it.amountMinor,        // ← untrusted · goes straight to Stripe
  },
  quantity: it.quantity,
}));
```

**Attack:** a malicious buyer crafts `{ businessId, items: [{ name: "Real Product", amountMinor: 1, currency: "eur", quantity: 1 }] }` and completes Stripe Checkout paying 1 cent instead of the real price. The seller's `nex_product` record is irrelevant to the server-side check · the server never fetches it.

This is my own R33 bug · acknowledged in Phase 1 Baseline (P1-2). Still live.

#### Target state

Server-side price resolution. Request body requires a `productId` per line item. Server fetches `nex_product.price_pence` + `nex_product.currency` and uses those authoritative values as `unit_amount` + `currency`. Client-supplied `amountMinor` is **discarded entirely**. Server also verifies the product belongs to the stated business. Mismatch → 400 fail-closed.

#### Build spec

Code change in `src/app/api/nex-native/billing/checkout/buyer/route.ts`:

**1 · Request body shape change (breaking)**

Replace:
```typescript
interface ParsedItem {
  readonly name: string;
  readonly amountMinor: number;    // REMOVE
  readonly currency: string;        // REMOVE (resolved server-side)
  readonly quantity: number;
}
```

With:
```typescript
interface ParsedItem {
  readonly productId: string;       // NEW · uuid of nex_product
  readonly quantity: number;
  // name, amountMinor, currency are ALL server-resolved
}
```

**2 · Parse validation**

Validate `productId` matches `UUID_SHAPE`. Reject if absent / malformed.

**3 · Server-side product resolution**

For each parsed item, fetch the product via `getProductById()` (`src/lib/nex-native/product-service.ts:425`):

```typescript
const resolvedItems = [];
for (const item of body.items) {
  const product = await productService.getProductById(item.productId);
  if (!product) {
    return NextResponse.json({ ok: false, code: "product_not_found", productId: item.productId }, { status: 404 });
  }
  if (product.business_id !== body.businessId) {
    return NextResponse.json({ ok: false, code: "product_business_mismatch" }, { status: 400 });
  }
  if (!ALLOWED_CURRENCIES.has(product.currency.toLowerCase())) {
    return NextResponse.json({ ok: false, code: "unsupported_currency", currency: product.currency }, { status: 422 });
  }
  if (product.price_pence < 0 || product.price_pence > 100_000_000) {
    return NextResponse.json({ ok: false, code: "product_price_out_of_range" }, { status: 422 });
  }
  // Also: verify product is published, not archived/deleted, in stock if applicable
  if (product.status && product.status !== "published") {
    return NextResponse.json({ ok: false, code: "product_not_purchaseable" }, { status: 409 });
  }
  resolvedItems.push({
    name: product.name,
    amountMinor: product.price_pence,
    currency: product.currency.toLowerCase(),
    quantity: item.quantity,
  });
}
```

**4 · Single-currency assertion**

After resolution, assert all resolved items share one currency. Reject multi-currency carts (same as current behaviour on line 97).

**5 · Build Stripe line_items from resolved values**

```typescript
const line_items = resolvedItems.map((it) => ({
  price_data: {
    currency: it.currency,
    product_data: { name: it.name },
    unit_amount: it.amountMinor,   // ← now server-resolved
  },
  quantity: it.quantity,
}));
```

**6 · Idempotency key update**

Current fingerprint uses the client-supplied items. Update to use the server-resolved items so a malicious client can't pre-create an idempotent session with a bad price before the fix is live:

```typescript
const idempotencyKey = `nex-buyer-${body.businessId}-${session.account.id}-${cartFingerprint(body.businessId, session.account.id, resolvedItems)}`;
```

**7 · Metadata extension (observability)**

Add `nex_item_product_ids` (comma-separated UUIDs) to `payment_intent_data.metadata` so the webhook (Deliverable 6 · not yet wired) can reconstruct the order with server-verified prices.

#### Caller-side change

Any UI code that posts to `/api/.../billing/checkout/buyer` must send `{ productId, quantity }` per line item instead of `{ name, amountMinor, currency, quantity }`. Current state: no UI button is wired yet (per Phase 1 Baseline §12 P1-5 · "theme + buyer checkout UI not wired"). This means the only impact of changing the request shape is:
- Any test fixtures (search needed)
- Any API docs (likely none exist)
- Future UI wiring (Phase 2 scope · will use new shape from day 1)

Minimal caller fallout.

#### Rollback

Pure code change · no DB rollback needed. Rollback is a git revert of the changed file. Rollback would **re-introduce the vulnerability**, so the rollback plan must explicitly refuse to be used in production:
- Rollback acceptable in the sandbox-build phase if the fix breaks something unexpectedly
- Rollback NOT acceptable in production unless the owner authorises re-exposure (I-5 analog: this is price-trust, not private content, but the same spirit applies)

#### Dependencies

Depends on: `product-service.getProductById()` (exists, line 425). No new migration needed.

#### Test plan

1. `V-F3-T1` · Request with `amountMinor=1` for a 10,000-penny product → 400 (shape invalid per new schema · no `amountMinor` field).
2. `V-F3-T2` · Request with legitimate `productId` + `quantity=1` → server fetches product · creates Checkout session with server-resolved price (verify in Stripe test mode).
3. `V-F3-T3` · Request with `productId` of product owned by different business → 400 `product_business_mismatch`.
4. `V-F3-T4` · Request with non-existent `productId` → 404 `product_not_found`.
5. `V-F3-T5` · Request with 50 line items for different products · one owned by wrong business → 400, no Checkout session created.
6. `V-F3-T6` · Idempotent re-submit same cart · same Checkout session returned (unchanged behaviour).
7. `V-F3-T7` · Attempt to tamper with idempotency key by including a third item in resolved cart → different fingerprint → different session (works as intended).
8. `V-F3-T8` · Confirm metadata includes `nex_item_product_ids` for webhook reconstruction.

#### Effort

1 day code + unit tests (Jest/Vitest mocking `getProductById`) + 1 day integration test with Stripe test mode.

---

## 4 · Combined migration + rollback dependency graph

```
PHASE 1 EXECUTION (sandbox-first)

  Step 1 · F-3 code change (no migration)
            ↓
          Unit tests + integration test with Stripe test mode
            ↓
          Commit to feature branch (separate push authorisation)
            ↓
  Step 2 · Author mig 312 (billing RLS lockdown with conditional no-op)
            ↓
          Apply mig 312 to sandbox · verify RLS enforced
            ↓
  Step 3 · Apply mig 290 to sandbox (already applied · verify only)
            ↓
          Service-layer regression tests pass

  OWNER GATE · separate authorisation required BEFORE any of:

  Step 4 · Apply mig 290 to production
            ↓
          V-F2-T1..T4 verification
            ↓
  Step 5 · Apply mig 312 to production (conditional no-op runs the lockdown
           because 258 is applied there)
            ↓
          V-F1-T1..T4 verification
            ↓
  Step 6 · Deploy F-3 code change to production
            ↓
          V-F3-T1..T8 verification in production Stripe test mode
            ↓
          Enable live-mode Stripe route (separate owner gate)
```

### Rollback positions

| Step | Rollback script | Re-exposes content? | Acceptable? |
|---|---|---|---|
| F-3 code | `git revert` | Re-exposes price-trust bug | Sandbox-only · NOT prod |
| Mig 312 | `312...rollback.sql` | Re-exposes billing PII | Sandbox-only · prod rollback requires owner re-auth |
| Mig 290 | `290...rollback.sql` | None (empty table drop) | Safe either env |

---

## 5 · Scope boundary: what Phase 1 does + does NOT touch

### IN SCOPE (Phase 1)
- F-1 billing tables RLS
- F-2 rate-limit infra
- F-3 buyer checkout price-trust

### OUT OF SCOPE (listed so you can confirm)
- Public bucket split (Phase 2 · chat scope)
- Device-only chat architecture (Phase 2)
- Mig 218 peer-RLS harden · obsolete under Interp 1 per Revision 2 doctrine
- Mig 295 private ciphertext bucket · obsolete under Interp 1
- 91 unrate-limited API routes (addressed incrementally in later security hardening · not launch-blocking at Phase 1 level)
- CSRF protection on API POST routes (same)
- Stripe Connect requirement columns publicly readable (P2 · defer)
- Mig 258 `TRIALING_ACCESS_LEVEL` option A/B/C owner decision (separate business-rule decision, not security defect)
- Legal/retention review for Phase 2 historical sweep (separate workstream)

---

## 6 · Verification requirements (post-build)

### Sandbox verification (before owner authorises production apply)

- All tests in §3 F-1 / F-2 / F-3 pass
- No regression on existing billing / chat / security flows
- Rate-limit cross-instance behaviour verified in sandbox under simulated multi-instance load
- `npm run test` passes with added test files
- `npm run typecheck` passes

### Production verification (after owner authorises production apply · per-fix)

Per-fix verification scripts run against production:
- V-F1-T6 (RLS enforced on production billing tables)
- V-F2-T1..T4 (rate-limit infrastructure active on production)
- V-F3-T2 (buyer checkout accepts productId · uses server price)

### Independent-evidence check

Phase 1 doesn't require a V- tier independent evidence per Revision 2 §19 (those are Phase 2/chat-privacy-centric). But: an owner-selected reviewer should sign off on the production verification artifacts before Phase 1 is marked "verified."

---

## 7 · Owner gates in Phase 1

Phase 1 execution has **four** owner authorisation gates (not one):

| Gate | Description | What it authorises |
|---|---|---|
| **G0 · Research** | "begin" message after this plan is published | **ALREADY GRANTED** · this document |
| **G1 · Build** | "begin Phase 1 implementation" | Authorises authoring + sandbox apply of F-1 / F-2 / F-3 code + migrations |
| **G2 · Production apply · F-1** | "apply mig 312 production" | Authorises production apply of billing RLS lockdown |
| **G3 · Production apply · F-2** | "apply mig 290 production" | Authorises production apply of rate-limit table |
| **G4 · Production deploy · F-3** | "deploy F-3 code production" | Authorises production deploy of buyer-checkout code fix |

Each gate is independent. The owner may authorise any subset (e.g. sandbox-build only · defer all production applies).

---

## 8 · Effort estimate

| Fix | Build (sandbox) | Owner review | Production apply |
|---|---|---|---|
| F-1 | 2 days | 0.5 day | 0.5 day |
| F-2 | 0.5 day verify | 0.5 day | 0.5 day |
| F-3 | 2 days | 1 day | 0.5 day (after Stripe test-mode validation) |
| **Totals** | **4.5 days** | **2 days** | **1.5 days** |

**Phase 1 total: ~1-2 weeks calendar** depending on owner review cadence.

---

## 9 · Commit + push posture (per Build-Commit-Push doctrine)

Phase 1 implementation (when authorised at G1) produces:
- 1 code file change (`buyer/route.ts`)
- 1 new migration file (`312_nex_billing_rls_lockdown.sql`)
- 1 new migration rollback file (`312_nex_billing_rls_lockdown.rollback.sql`)
- 1 new apply script (`scripts/apply-migration-312-sandbox.mjs`) + production counterpart on G2
- 1 new apply script (`scripts/apply-migration-290-production.mjs`) on G3
- New test files for F-3 request-shape validation

Per the Build-Commit-Push doctrine, each step BUILD → AUDIT → COMMIT → PUSH → VERIFY → REPORT. **The push step at each stage remains a separate owner authorisation.** G1 authorises the build + commit; a separate "push G1 work to origin" message authorises the git push.

---

## 10 · Risks + blockers

| Risk | Mitigation |
|---|---|
| F-1 RLS enable breaks a service-role code path that was implicitly relying on no RLS (unlikely since service-role bypasses RLS) | Sandbox verification T4 explicitly tests the service-role path |
| F-2 production apply reveals a stricter-than-expected rate limit on a hot route | Document per-route limits in test · owner can tune before apply |
| F-3 breaks a test fixture that hard-codes the old `amountMinor` shape | Grep sweep before commit · update all fixtures in the same PR |
| F-3 blocks a UI wire-up that assumed old shape | No UI is wired yet per Phase 1 Baseline P1-5 · zero UI fallout |
| Production webhook processor expects event_log rows to be readable by anon/authenticated (unlikely but worth verifying) | V-F1-T4 explicitly tests service-role write preserves |
| Mig 312 fails to apply because 258 isn't applied in a target env | Conditional no-op in §3 F-1 build spec handles this |

---

## 11 · What this document does + does NOT do

### Does
- Scope Phase 1 to three evidence-confirmed fixes
- Provide a per-fix build spec with rollback plan per I-5
- Define the four owner gates (G1-G4 beyond this G0 research gate)
- Provide a test matrix per fix
- Estimate 1-2 week calendar effort

### Does NOT
- Authorise any code change · any migration authoring · any migration application
- Authorise any Supabase configuration change
- Authorise any commit · push · deployment
- Scope Phase 2 chat work (separate workstream)
- Resolve mig 258 TRIALING_ACCESS_LEVEL decision (separate business-rule decision)
- Resolve public bucket split (Phase 2)

---

## 12 · Next owner message

If approved · "**begin Phase 1 implementation**" · and Claude proceeds with:
1. Author F-3 code change + unit tests
2. Author mig 312 + rollback + apply script
3. Author production-apply script for mig 290
4. Run sandbox verification on all three
5. Return a completion report requesting G2 / G3 / G4 one at a time

If more review is needed first · any question / change request on this plan · I revise and return a v2.

---

**End of Phase 1 Research/Plan.**

No code · no DB · no migrations applied · no commits · no pushes · no deployments. Documentation only.
