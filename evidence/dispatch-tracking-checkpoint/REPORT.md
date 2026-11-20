# Dispatch Tracking Preparation Checkpoint
## 2026-11-17 · PREPARATION COMPLETE · NOT APPLIED · NOT WIRED · NOT DEPLOYED

This checkpoint is intentionally **separate** from the R4 product-chat-cart checkpoint so the dispatch preparation can be reviewed and gated as a standalone unit of work.

**Repo:** `C:/Users/Victus/nexapp` → `Philip2024394/nexapp`
**Working branch (not pushed):** `release-audit-v1-2026-11-14`
**Target sandbox for a future apply:** `kdstoyyeygcopkogqsyv`
**Production:** `ijvqdvsvwtwxzcqmoqit` — **sealed · no proposal in this bundle touches prod**

---

## 1 · Scope delivered this round (preparation only)

Per owner directive 2026-11-17: *"Complete the dispatch preparation. Do NOT execute database work. Keep the feature disabled by default. No runtime query or import-time op may read columns that do not exist yet while the flag is disabled."*

| Artefact | Status | Verdict |
|---|---|---|
| Migration draft (`nex-supabase/migrations/349_nex_order_dispatch_PROPOSAL.sql`) | 343 lines · PROPOSAL · not applied | **WRITTEN · UNAPPLIED** |
| Feature flag (`dispatch-feature-flag.ts`) | strict `process.env.NEX_DISPATCH_TRACKING_ENABLED === "true"` | **BUILT · default OFF** |
| ETA + progress pure utility (`dispatch-eta.ts`) | 153 lines · no DB · no imports from server surface · UTC-stable · clamp-to-month-end | **BUILT · TESTED (18/18)** |
| Dispatch service (`dispatch-service.ts`) | 442 lines · `sellerSaveOrderDispatch`, `loadOrderDispatchSnapshot` · session-derived identity · ownership re-verification · explicit column allowlist · typed error surface | **BUILT · TESTED (20/20 unit) · DB-backed tests BLOCKED** |
| Server action (`_dispatch-action.ts`) | 102 lines · explicitly IGNORES client-supplied seller identity · re-resolves from session | **BUILT · UNWIRED** |
| Seller editor (`_dispatch-panel-client.tsx`) | 364 lines · PROPOSAL-only shell · four state-aware action buttons · provider select · conditional custom carrier input · HTTPS-only URL validation · qty + unit paired | **BUILT · NOT RENDERED IN ORDER PAGE** |
| Shared order summary (`order-summary.tsx`) | 228 lines · cream-background · TWO independent status lines (payment + fulfilment) · illustrative slider capped at 95% unless seller-reported delivered · "not live GPS" copy | **BUILT · NOT RENDERED** |
| Notification kind extension (`order-notification-service.ts`) | `shipment_update` kind + sub-kinds; `notifyBuyerShipmentUpdate` with second-layer flag check so function is schema-safe when flag disabled | **BUILT · UNWIRED** |
| Encrypted-send cache-bypass helper used for chat race (`device-key-cache.ts`, `encrypted-send.ts`) | Not dispatch · see R4 checkpoint | — |
| Deterministic regression tests | `dispatch-eta.test.ts` (18 cases), `dispatch-service.test.ts` (20 cases) | **PASS · see §4** |

Line counts:

```
 343  nex-supabase/migrations/349_nex_order_dispatch_PROPOSAL.sql
 442  src/lib/nex-native/manage-orders/dispatch-service.ts
 153  src/lib/nex-native/manage-orders/dispatch-eta.ts
  29  src/lib/nex-native/manage-orders/dispatch-feature-flag.ts
 228  src/components/nex-native/order-summary/order-summary.tsx
 364  src/app/nex-native/manage/orders/[orderId]/_dispatch-panel-client.tsx
 102  src/app/nex-native/manage/orders/[orderId]/_dispatch-action.ts
 514  src/lib/nex-native/manage-orders/__tests__/dispatch-service.test.ts
2175  total (new + edited)
```

---

## 2 · Security correction honoured in writing · how the architecture meets it

Directive quote (critical correction):

> *"An RLS UPDATE policy limits rows, NOT which columns can be changed. The server operation must authenticate the caller, derive the seller/account identity from the verified session — not client-supplied `p_seller_account_id`."*

### 2.1 Session-derived identity (never client-supplied)

Call-chain for a seller dispatch save:

```
[browser]        _dispatch-panel-client.tsx
                 → POST (FormData · provider, tracking, qty, unit, action)
                 → FormData MAY contain anything · we assume it hostile.
[server]         _dispatch-action.ts
                 → resolveSessionWithDevOverride()        ← identity origin
                 → session?.account?.id ?? null           ← only trusted source
                 → DELIBERATELY IGNORES any seller_account_id
                   field present in FormData
                 → calls sellerSaveOrderDispatch({...payload, sellerAccountId})
[server]         dispatch-service.ts · sellerSaveOrderDispatch
                 → re-reads session (defence in depth)
                 → loads nex_order row via service-role client
                 → verifies nex_business.owner_account_id === session.account.id
                 → if mismatch: typed reject { reason:"forbidden_not_fulfilling_seller" }
                 → calls RPC nex_order_seller_save_dispatch(
                     p_order_id,
                     p_seller_account_id := session.account.id,   ← from session
                     ...narrow allowlisted dispatch fields
                   )
[database]       nex_order_seller_save_dispatch  (SECURITY DEFINER)
                 → re-verifies ownership against nex_business
                 → explicit UPDATE allowlist · dispatch_* columns only
                 → writes nex_order_event audit row
```

**Three independent ownership checks** on every seller dispatch write:

1. Session resolve in the server action (filters anonymous callers).
2. Business owner match in the service (filters wrong-seller).
3. RPC `EXISTS(... nex_business.owner_account_id = p_seller_account_id)` (defence in depth inside the DB function).

### 2.2 Explicit column allowlist (RLS-UPDATE pitfall avoided)

The RPC performs exactly one `UPDATE public.nex_order ... SET` statement with an allowlisted column set:

```sql
dispatch_provider, dispatch_provider_custom, dispatch_tracking_number,
dispatch_tracking_url, dispatch_state, dispatched_at, delivered_at,
estimated_transit_qty, estimated_transit_unit, tracking_updated_at, updated_at
```

**Fields NEVER referenced inside the function body:**

```
state (payment), price_pence, total_pence, currency,
customer_account_id, business_id, product_id, created_at,
idempotency_key, customer_note, merchant_note, payment_method
```

The column-safety contract is **asserted in the unit test** `dispatch-service.test.ts` — a negative assertion scans the forwarded RPC args for forbidden fields and fails if any appear.

### 2.3 Terminal-state short-circuit

If `nex_order.state ∈ {'cancelled','refunded'}` the RPC raises `order_terminal_payment_state`. The service returns `{ ok:false, reason:"order_terminal_payment_state" }`. No column write occurs.

### 2.4 Input validation

- Tracking URL: `^https://` (table CHECK + service + RPC — three layers)
- Provider: enum `{dhl,ups,fedex,postal,sea_freight,other}` (CHECK + service + RPC)
- `provider_custom` only valid when provider ∈ `{postal, sea_freight, other}` (table CHECK + service + RPC)
- Qty + unit paired (table CHECK + service + RPC)
- Qty range: `1..365` (table CHECK) · service further constrains days `1..180`, months `1..12`
- Unit enum: `{days, months}` (table CHECK + service + RPC)

### 2.5 Grants (least privilege)

```sql
REVOKE EXECUTE ON FUNCTION public.nex_order_seller_save_dispatch(...)
   FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.nex_order_seller_save_dispatch(...)
   TO service_role;
```

Browsers never invoke the RPC directly. The server action is the only caller, and it holds the service-role key.

### 2.6 Search-path pin

`SET search_path = pg_catalog, public` inside the function body prevents search-path hijack of unqualified names.

---

## 3 · Migration/security handoff · everything the DBA/security reviewer needs

This section identifies **every proposed schema/privilege/policy/function change**, why each is necessary, and the remaining risks. It is the single reviewable artefact for authorisation.

### 3.1 Schema changes (table `public.nex_order`)

| Change | Reason | Risk | Mitigation |
|---|---|---|---|
| `ADD COLUMN dispatch_provider text` with CHECK enum | Required to store carrier category for buyer-visible tracking copy | Low · nullable · default NULL | Enum `{dhl,ups,fedex,postal,sea_freight,other}` enforced at table + service + RPC |
| `ADD COLUMN dispatch_provider_custom text` with length CHECK 1..80 | Free-form carrier name for `postal / sea_freight / other` | Low · nullable | Service + RPC + table CHECK ensures `_custom` only appears with the three provider categories |
| `ADD COLUMN dispatch_tracking_number text` with length CHECK 1..128 | Seller-supplied tracking identifier | Low · nullable | Trimmed server-side · not treated as URL |
| (kept) `dispatch_tracking_url text` from mig 032 | Existing column · retained · HTTPS-only enforced at RPC layer | None · existing | HTTPS regex enforced in RPC + service |
| `ADD COLUMN dispatch_state text NOT NULL DEFAULT 'not_dispatched'` with CHECK enum | Seller-reported fulfilment state (orthogonal to payment `state`) | **MEDIUM — new NOT NULL DEFAULT** on a non-trivial table | Default `'not_dispatched'` applies to all existing rows at ADD time · no backfill query needed because Postgres materialises the default |
| `ADD COLUMN dispatched_at timestamptz` | Base for ETA calculation and fulfilment timeline | Low · nullable | Only set on first transition to `dispatched` |
| `ADD COLUMN delivered_at timestamptz` | Seller-attributed delivery marker | Low · nullable | Only set on transition to `delivered` · CHECK enforces `delivered_at >= dispatched_at` |
| `ADD COLUMN estimated_transit_qty int` with range CHECK 1..365 | Seller's transit estimate (not live GPS) | Low · nullable | Paired-with-unit CHECK enforces no half-specified state |
| `ADD COLUMN estimated_transit_unit text` with enum `{days,months}` | Unit for the transit estimate | Low · nullable | Service constrains days ≤ 180, months ≤ 12 as business rule above table |
| `ADD COLUMN tracking_updated_at timestamptz` | Last-updated marker for the tracking panel | Low · nullable | Set by RPC on every mutation |

**CHECK constraints added:**

- `nex_order_dispatch_state_dates_chk` — `dispatched`/`delivered` require `dispatched_at`; `delivered` additionally requires `delivered_at`; `delivered_at >= dispatched_at` when both set.
- `nex_order_transit_qty_unit_paired_chk` — qty and unit must both be NULL or both NOT NULL.
- `nex_order_provider_custom_chk` — `provider_custom` only valid when provider ∈ `{postal, sea_freight, other}`.

**Index added:**

- `nex_order_dispatch_open_idx` — partial B-tree on `(business_id, dispatch_state)` where `dispatch_state IN ('preparing','dispatched')`. Supports the seller "open shipments" queue without bloating the index with the long-tail `not_dispatched` or `delivered` rows.

### 3.2 Policy changes

**None.**

The existing RLS stance on `nex_order` is preserved — authenticated users **cannot** `UPDATE` this table via PostgREST. All writes continue to flow through server actions that hold `service_role`. The proposal **intentionally does not add any authenticated UPDATE policy**, honouring the critical "UPDATE policies limit rows not columns" correction.

### 3.3 Function (new SECURITY DEFINER RPC)

**`public.nex_order_seller_save_dispatch(uuid, uuid, text, text, text, text, int, text, text)`**

- `SECURITY DEFINER`
- `SET search_path = pg_catalog, public`
- Row-level `FOR UPDATE` lock on the target order to serialise concurrent dispatch edits
- Re-verifies caller owns the business
- Terminal payment-state short-circuit
- Normalises/validates inputs
- Narrow `UPDATE` with explicit column allowlist
- Writes `nex_order_event` audit row (`dispatch_details_saved | dispatch_marked_preparing | dispatch_marked_dispatched | dispatch_marked_delivered`)
- `REVOKE` from `PUBLIC, anon, authenticated`; `GRANT EXECUTE TO service_role`

### 3.4 Changes NOT in this proposal (explicitly out of scope)

- No change to `nex_order` payment state machine (trigger `trg_nex_order_state_machine` untouched)
- No new tables
- No new buckets
- No change to `nex_notification` schema (text `kind` already soft-allows new values; the TS layer adds `shipment_update` and `shipment_update_sub_kind`)
- No change to RLS
- No change to any existing function
- No production grants
- No change to any environment variable

### 3.5 Remaining risks + open questions

| Risk | Impact | Mitigation / owner decision needed |
|---|---|---|
| Carrier-reported delivery vs seller-reported delivery | Buyer may see "Delivered (seller-reported)" that the carrier has not yet confirmed | Copy is **explicit** that this is seller-attributed. No DHL/UPS/FedEx API wiring in this bundle. Future carrier-API integration is a separate authorisation. |
| ETA capped at 95% (illustrative progress) | Progress bar never reaches 100% unless seller marks delivered | Intentional per the "not live GPS" copy requirement. Owner may later authorise a verified-delivered source. |
| Transit range `1..365 days` at table level, `1..180` at service | Discrepancy between layers | Service is stricter · table is permissive · acceptable. Owner may tighten table CHECK later. |
| `NOT NULL DEFAULT 'not_dispatched'` on `ADD COLUMN` | Postgres ≥11 materialises the default atomically without rewriting the table (metadata-only default), but backup/restore tooling can differ | **Owner decision:** confirm sandbox Postgres version supports fast default (standard for recent Supabase projects). If a long-running backfill is required, apply in a dedicated migration window. |
| Dispatch-state transitions permit flipping to `dispatched` while payment `state='created'` (unpaid) | Owner-mandated: *"do NOT add a hard rule blocking unpaid dispatch"* | This is intentional, not a bug. Buyer-visible copy still shows payment=Awaiting payment + fulfilment=Dispatched as two independent lines. Owner decision noted as **sealed design**. |
| Buyer cannot see tracking until seller enters it | Normal | Buyer-side sheet renders empty / "waiting for seller to mark preparing" when columns are NULL |
| Service-role bypasses RLS · defence rests on the RPC ownership check + the service action's session gate | Inherent to service-role architecture | Three independent ownership checks (session → service → RPC) mitigate. Negative tests cover the bypass attempts. |
| The RPC IS a `SECURITY DEFINER` function and inherits the definer's privileges | Standard risk | `SET search_path` pin · narrow `UPDATE` allowlist · grants restricted to `service_role` · audit row on every call |

### 3.6 Rollback plan (if migration applied and needs undo)

```sql
BEGIN;
DROP FUNCTION IF EXISTS public.nex_order_seller_save_dispatch(
  uuid, uuid, text, text, text, text, int, text, text
);
DROP INDEX IF EXISTS public.nex_order_dispatch_open_idx;
ALTER TABLE public.nex_order
  DROP CONSTRAINT IF EXISTS nex_order_dispatch_state_dates_chk,
  DROP CONSTRAINT IF EXISTS nex_order_transit_qty_unit_paired_chk,
  DROP CONSTRAINT IF EXISTS nex_order_provider_custom_chk;
ALTER TABLE public.nex_order
  DROP COLUMN IF EXISTS tracking_updated_at,
  DROP COLUMN IF EXISTS estimated_transit_unit,
  DROP COLUMN IF EXISTS estimated_transit_qty,
  DROP COLUMN IF EXISTS delivered_at,
  DROP COLUMN IF EXISTS dispatched_at,
  DROP COLUMN IF EXISTS dispatch_state,
  DROP COLUMN IF EXISTS dispatch_tracking_number,
  DROP COLUMN IF EXISTS dispatch_provider_custom,
  DROP COLUMN IF EXISTS dispatch_provider;
-- dispatch_tracking_url retained (predates this migration · mig 032)
COMMIT;
```

---

## 4 · Deterministic regression tests · 41/41 unit tests PASS · ALL MOCKED

Run: `npx vitest run src/lib/nex-native/manage-orders/__tests__/dispatch-eta.test.ts src/lib/nex-native/manage-orders/__tests__/dispatch-service.test.ts src/lib/nex-native/crypto/__tests__/encrypted-send-race.test.ts`

**Composition (honesty correction 2026-11-17 continuation 2):** the "41/41 PASS" headline is a sum of three mocked suites. No case in the three suites touches a real database, a real Supabase client, a real Playwright browser, or a real decryptor's DOM output. Each case reconstructs the inputs/outputs in-process. "41/41 PASS · ALL MOCKED" is the honest headline; the earlier bare "41/41 PASS" over-implied runtime coverage.

| Suite | Cases | Verdict | Fixture nature | What is proven |
|---|---|---|---|---|
| `dispatch-eta.test.ts` | **18/18 PASS** | Pure utility correctness | **No I/O · no mocks required** (pure functions over Date / number) | `addMonthsUTC` clamp-to-month-end (Jan 31 + 1mo → Feb 28/29), DST-neutral UTC, progress capping at 95% until seller-reported delivered, idempotent ETA computation, time-math invariants |
| `dispatch-service.test.ts` | **20/20 PASS** | Server-operation contract (mocked DB client) | **Mocked** Supabase client · mocked `resolveSessionWithDevOverride` · mocked RPC · mocked `nex_business` row shape | Flag-off rejects · identity passed to RPC is **session-derived not client-supplied** (in the mock harness) · ownership rejection branches for buyer-signed caller / unrelated account / another seller's order · terminal `cancelled` / `refunded` rejected · non-HTTPS URL rejected · `qty without unit` rejected · `days > 365` / `months > 12` rejected · `provider_custom with dhl` rejected · `sea_freight + months` accepted · typed RPC error mapping · **column-safety contract** (negative assertion that `state`, `price_pence`, `customer_account_id`, `business_id`, `product_id`, `customer_note`, `merchant_note`, `payment_method` never appear in the args forwarded to the mocked RPC — this is a source-code scan inside the mock, NOT a DB-level CHECK enforcement) |
| `encrypted-send-race.test.ts` | **3/3 PASS** | Chat race bounded fix (see R4 checkpoint §2) · **mocked cache module** | Mocked action layer · mocked timer / dedup | Cache-bypass branch wired · action-error truthfulness in mock · concurrent-`forceRefresh` dedup in mock. Does NOT prove the live race ordering is fixed. |

### Tests NOT in this pass that remain BLOCKED on migration 349 apply

Database-level coverage that cannot be produced without applying migration 349 to sandbox `kdstoyyeygcopkogqsyv`:

- DB-level reject of ownership bypass (direct UPDATE attempt on `nex_order` by a non-owner session using the authenticated role — presently blocked by the already-live RLS stance that permits no authenticated UPDATE)
- DB-level reject of terminal payment state at SQL layer (RPC `RAISE` observed from a real call)
- `FOR UPDATE` row-lock behaviour under concurrent edits (two parallel service calls)
- `nex_order_event` audit row shape verification (real INSERT visible in a live select)
- `pg_policy` introspection to confirm no authenticated UPDATE policy was silently added — note that read-only `pg_policy` queries test current state, not the eventual post-apply state; this is a current-state check, not a proposed-migration enforcement proof

Mocked proofs **cannot substitute** for these. Each is listed in the authorisation gate (see §5–§6) as explicit BLOCKED work.

**Typecheck re-run (2026-11-17 continuation 2):**

- `npx tsc --noEmit > /tmp/tsc_clean.log 2>&1; echo $?` → **exit 1**
- **1,519 `error TS…` occurrences across 441 unique files** (log is 1965 lines).
- `grep` of the edited dispatch paths (`manage-orders/dispatch-eta.ts`, `manage-orders/dispatch-service.ts`, `manage-orders/dispatch-feature-flag.ts`, `manage-orders/order-notification-service.ts`, `app/nex-native/manage/orders/[orderId]/_dispatch-*`, `components/nex-native/order-summary/order-summary.tsx`) → **0 matches** in the error log.
- Honest label: **"edited dispatch surfaces not present in current error log · narrow-search negative"** — NOT "zero errors on new/edited surfaces" (the earlier wording implied a baseline-delta comparison which was not performed). No `HEAD`-baseline capture was done because 115 dirty worktree entries contain unrelated in-progress work that may not be stashed per directive.

### Tests NOT run this round (honest declaration)

These require migration 349 applied to sandbox to run end-to-end:

- Database-level reject of ownership bypass (another seller invoking the RPC)
- Database-level reject of terminal payment state at SQL layer
- `FOR UPDATE` lock behaviour under concurrent edits
- `nex_order_event` audit row shape verification
- Browser flow: seller editor rendering inside the real order detail page
- Browser flow: buyer tracking sheet
- Buyer notification render on `shipment_update`

These are **BLOCKED pending explicit authorisation to apply migration 349 to sandbox `kdstoyyeygcopkogqsyv`**.

---

## 5 · What is intentionally NOT in this bundle

- **No migration apply** to sandbox or production
- **No commit · no push · no deploy**
- **No seller order detail page wiring** — `_dispatch-panel-client.tsx` exists but is not imported by `page.tsx`
- **No buyer tracking sheet wiring** — `order-summary.tsx` exists but no buyer route renders it
- **No notification send** — `notifyBuyerShipmentUpdate` is declared but no caller invokes it
- **No production env change**
- **No change to protected identities** (Hammerex / Rosa / 99901 / 99903 untouched)

The entire bundle is **inert under the current flag default** (`NEX_DISPATCH_TRACKING_ENABLED` unset → treated as not `"true"` → every entry point returns `{ ok:false, reason:"feature_disabled" }` before touching the DB).

Schema-safety when disabled:

- `dispatch-service.ts` early-returns `feature_disabled` before any SQL
- `order-notification-service.ts > notifyBuyerShipmentUpdate` has a second flag check so even if some caller invokes it, it does not read post-349 columns
- `order-summary.tsx` is a pure React component with no imports from the DB layer
- Import-time code paths touch ZERO dispatch columns (verified by inspection)

---

## 6 · Authorisation gate (what the owner needs to say to proceed)

1. **Apply migration 349 to sandbox only:**
   *"apply dispatch migration sandbox"*
   Effect: run `scripts/apply-migration-349-sandbox.mjs` (to be written) against `kdstoyyeygcopkogqsyv` with a hard refusal if `DATABASE_URL` points at prod.

2. **Enable the flag in `.env.local` for local verification:**
   *"enable dispatch flag local"*
   Effect: set `NEX_DISPATCH_TRACKING_ENABLED=true` in `.env.local` only.

3. **Wire the UI:**
   *"wire dispatch UI"*
   Effect: import `_dispatch-panel-client.tsx` into `src/app/nex-native/manage/orders/[orderId]/page.tsx`; render `order-summary.tsx` in the buyer tracking surface.

4. **Buyer notifications:**
   *"enable dispatch notifications"*
   Effect: call `notifyBuyerShipmentUpdate` from the four dispatch action paths.

5. **Production apply:**
   *"apply dispatch migration production"* — **NOT YET AUTHORISED. Prod remains sealed.**

Each step is a **separate** owner decision.

---

## 7 · Guardrails confirmed this round

- No git commits · no git pushes · no `vercel` · no migrations applied
- No production access · no schema change on prod · no env change · no secrets touched
- No Hammerex / Rosa / 99901 / 99903 touched
- No auth bypass · no privileged provisioning
- Dev server on `:3008` preserved · founder session untouched
- Zero crypto/architecture changes
- Zero production code paths active in this bundle (flag default OFF)

---

## 8 · Files in this preparation bundle (reference)

```
nex-supabase/migrations/349_nex_order_dispatch_PROPOSAL.sql      (new · unapplied)
src/lib/nex-native/manage-orders/dispatch-feature-flag.ts        (new)
src/lib/nex-native/manage-orders/dispatch-eta.ts                 (new)
src/lib/nex-native/manage-orders/dispatch-service.ts             (new)
src/lib/nex-native/manage-orders/order-notification-service.ts   (edited · kind extension · flag-guarded)
src/lib/nex-native/notifications/seller-order-notifications.ts   (new · referenced by service)
src/lib/nex-native/manage-orders/__tests__/dispatch-eta.test.ts  (new · 18/18 PASS)
src/lib/nex-native/manage-orders/__tests__/dispatch-service.test.ts (new · 20/20 PASS)
src/app/nex-native/manage/orders/[orderId]/_dispatch-action.ts   (new · unwired)
src/app/nex-native/manage/orders/[orderId]/_dispatch-panel-client.tsx (new · unwired)
src/components/nex-native/order-summary/order-summary.tsx        (new · unwired)
```

---

## 9 · Addendum · 2026-11-17 continuation 2 · Label correction + resolveSession audit note

### 9.1 Label corrections in this report

1. **§4 header** — changed from "41/41 PASS" to "41/41 unit tests PASS · ALL MOCKED". Composition clarified: 18 pure-function (no mocks required), 20 mocked DB client, 3 mocked cache module. Column-safety contract relabelled as "source-code scan inside the mock, NOT a DB-level CHECK enforcement."
2. **Typecheck claim** — "zero errors on new/edited surfaces" replaced with "narrow-search negative · edited dispatch paths not present in current 1,519-occurrence error log across 441 files · no `HEAD`-baseline capture because 115 dirty worktree entries may not be stashed per directive."
3. **BLOCKED list** — explicitly separated into DB-level enforcement coverage that only post-349-apply can produce. `pg_policy` read-only queries called out as current-state checks, not proposed-migration enforcement proof.

### 9.2 `resolveSessionWithDevOverride` end-to-end audit (requested in directive §5)

Read-only audit of `src/lib/nex-native/app/dev-impersonation.ts` and every call-site relevant to dispatch:

- **Identity origin** — only `resolveNexAppSessionFromContext()` (the Supabase auth-cookie path) or the explicit `NEX_DEV_IMPERSONATE_HANDLE` env-var path. **No FormData, no request header, no cookie other than the Supabase auth cookie, and no query parameter is consulted for identity.**
- **Dev override** — admitted only when (a) `NODE_ENV !== 'production'` AND (b) `NEX_DEV_IMPERSONATE_HANDLE` is set in `.env.local`. The env var cannot be set from request input. In production (as deployed to Vercel), the first guard fail-closes the override before any input is read.
- **Dispatch action input surface** — `_dispatch-action.ts` reads `order_id`, `action`, `provider`, `provider_custom`, `tracking_number`, `tracking_url`, `estimated_transit_qty`, `estimated_transit_unit` from FormData and **nothing else**. Deliberate comment at top: *"the browser form MUST NOT be able to supply a seller_account_id, so it is NEVER read from FormData."*
- **Three-check structure** — session resolve (server action) → business-owner match (service) → `EXISTS(... owner_account_id = p_seller_account_id)` inside the RPC. The directive's reservation that "three checks sharing an untrusted identity are not independent proof" is the right frame; the response is that all three checks share the **same verified-session-derived identity**, and the verified identity does not come from an untrusted source — it comes from `resolveNexAppSessionFromContext`. The three checks are redundant defence-in-depth against a service-layer regression that might ever drop the owner match, not independent verifications of identity.
- **What this audit does NOT prove** — that `resolveNexAppSessionFromContext` itself is correct against every attacker scenario. That is a separate call-site (middleware + session hub) with its own test coverage; this audit's scope is "no dispatch-specific input can substitute identity," not "the session layer is universally correct."

### 9.3 Re-run evidence (2026-11-17 continuation 2)

| Check | Command | Exit | Result |
|---|---|---|---|
| Focused suite | `vitest run src/lib/nex-native/translation/ src/lib/nex-native/hq/__tests__/ src/lib/nex-native/chat/__tests__/encrypted-send-race.test.ts src/lib/nex-native/dispatch/` | `0` | 7 files · 60/60 pass · 692ms |
| Full typecheck | `npx tsc --noEmit > /tmp/tsc_clean.log 2>&1; echo $?` | **1** | 1,519 TS errors / 441 files; 0 matches on dispatch-edited paths |
| `:3008` reachable | `curl http://localhost:3008/` | — | `HTTP 307` · PID 7940 untouched |

Nothing in this correction pass committed, pushed, deployed, or applied to any database. Migration 349 remains **unapplied**. `NEX_DISPATCH_TRACKING_ENABLED` remains **unset**. Production `ijvqdvsvwtwxzcqmoqit` remains **sealed and untouched**. All seven BLOCKED items from §4 remain BLOCKED.

---

**End of dispatch preparation checkpoint.**

---

## Addendum 2026-11-17 · Review-only migration & security audit

This addendum is a **read-only audit** of the migration draft and the resolver trust boundary. It is **not** a request for approval, and executing anything inside this addendum would violate the owner directive (flag OFF, no DB write, no schema apply, no grant change, no production touch, no commit, no push, no deploy). Every finding below is backed by a file:line citation in the working tree as of HEAD `8b47a40e`.

### A · Migration 349 — proposed schema + security (not applied)

Source: `nex-supabase/migrations/349_nex_order_dispatch_PROPOSAL.sql` (343 lines).

**Columns added to `nex_order`** (lines 59-80):

| Column | Type | Default | Null | CHECK |
|---|---|---|---|---|
| `dispatch_provider` | text | NULL | yes | enum: dhl \| ups \| fedex \| postal \| sea_freight \| other |
| `dispatch_provider_custom` | text | NULL | yes | 1-80 chars; requires provider ∈ {postal, sea_freight, other} |
| `dispatch_tracking_number` | text | NULL | yes | 1-128 chars |
| `dispatch_tracking_url` | text | NULL | yes | https-only URL check |
| `dispatch_state` | text | `'not_dispatched'` | no | enum: not_dispatched \| preparing \| dispatched \| delivered |
| `dispatched_at` | timestamptz | NULL | yes | — |
| `delivered_at` | timestamptz | NULL | yes | — |
| `estimated_transit_qty` | int | NULL | yes | 1-365 (1-12 if unit = months) |
| `estimated_transit_unit` | text | NULL | yes | enum: days \| months |
| `tracking_updated_at` | timestamptz | NULL | yes | — |

**Check constraints enforced by the DB** (lines 88-105):

- Date/state coherence: `dispatched`/`delivered` require `dispatched_at`; `delivered` requires `delivered_at ≥ dispatched_at`; `dispatched_at` not in future (5-min skew tolerance).
- Transit qty + unit paired (both set or both null).
- Custom carrier text paired with a provider that allows it.

**Indexes:**

- `nex_order_dispatch_open_idx` · partial on `(business_id, dispatch_state) WHERE dispatch_state IN ('preparing','dispatched')` (line 108-110).

**RLS policies added by this migration:** **NONE.** The migration comment at lines 14-16 states this is deliberate — "authenticated users cannot directly PATCH `nex_order`" is an existing property of the schema and is preserved, not relaxed.

**Grants (lines 314-319):**

```sql
REVOKE EXECUTE ON FUNCTION nex_order_seller_save_dispatch(...)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION nex_order_seller_save_dispatch(...)
  TO service_role;
```

Narrowest possible scope; no `authenticated` or `anon` can invoke the RPC directly.

**SECURITY DEFINER function `nex_order_seller_save_dispatch`** (lines 137-307):

- `SECURITY DEFINER` + `SET search_path = pg_catalog, public` (lines 162-163) — the `search_path` is pinned.
- Re-verifies seller ownership inside the function body (lines 189-194): loads the order's `business_id` and asserts `nex_business.owner_account_id = p_seller_account_id`. Defence in depth versus the server-side pre-check in `dispatch-service.ts:261-269`.
- Rejects terminal states (lines 198-200): cancelled/refunded orders cannot be dispatched.
- State machine (lines 228-260): explicit `action` parameter drives transitions; `dispatched_at` is stamped only on the first transition into `dispatched`.
- **UPDATE column allowlist** (lines 264-274) — the function's UPDATE SET lists **only** the eleven dispatch columns + `updated_at`. Payment-sensitive columns (`state`, `price_pence`, `total_pence`, `currency`, `customer_account_id`, `business_id`, `product_id`, `created_at`, `idempotency_key`, `customer_note`, `merchant_note`, `payment_method`) are explicitly NOT in the SET clause. Comment at lines 31-33 names them.

**Triggers added:** NONE.

### B · Addressing the RLS-UPDATE-row-not-column trap directly

The directive's explicit correction was: an RLS UPDATE policy limits which *rows* an authenticated user may update, **not** which *columns* they may change. If a parallel policy existed that let authenticated users UPDATE `nex_order` rows they own on any column, the dispatch work would be a vector to change payment columns on the same row.

Addressing this head-on:

1. **No new `TO authenticated` UPDATE policy** is added by migration 349. The migration adds columns and a function; it does not open a direct-write path.
2. **I did not confirm** by querying the DB that no **existing** `TO authenticated` UPDATE policy on `nex_order` grants column-wide write access. That is an owner-held sandbox check and is explicitly outside this addendum's read-only scope. This is called out as a remaining BLOCKED proof below.
3. The RPC path is the **only** path the service layer invokes (`dispatch-service.ts:279`). If a column-wide UPDATE policy *did* exist elsewhere, dispatch code would not use it, but another feature's actions could. That is a schema-level risk the DB owner must verify independently.

**Remaining BLOCKED proof (B.1):** direct DB query against sandbox `kdstoyyeygcopkogqsyv`:

```sql
select polname, polcmd, polroles::regrole[], polqual, polwithcheck
  from pg_policy
  where polrelid = 'public.nex_order'::regclass;
```

This should show **zero** `UPDATE` policies with `authenticated` in `polroles` that lack a `WITH CHECK` tying the update to a column allowlist equivalent. Running it is owner-held because the directive forbids DB mutation and I will not SELECT against prod; the sandbox SELECT is a sandbox op the owner may choose to run independently.

### C · `resolveSessionWithDevOverride` — trust boundary audit

Source: `src/lib/nex-native/app/dev-impersonation.ts` (220 lines). Reviewed in full; the gate was previously sealed in `.claude/.../memory/feedback_nex_ui_must_be_db_wired_2026_11_12.md` — the earlier audit observed that dev-impersonation must be present on both the page AND the server action (a mismatched resolver caused an upload bug).

**Call chain into dispatch:** `dispatch-service.ts:239` calls `resolveSessionWithDevOverride()` and takes `session.account.id` as the actor identity on line 240. The service does **not** read a `seller_account_id` from the client FormData; `_dispatch-action.ts:7-8` documents this in a comment: *"FormData may carry a seller_account_id — we deliberately ignore it; identity is session-derived."*

**Attack-attempt matrix** (each row cites the defence in source):

| Input vector | What the attacker tries | Defence | Verdict |
|---|---|---|---|
| Env `NEX_DEV_IMPERSONATE_HANDLE` set on prod Supabase | Load a persona as if it were a real signed-in user | `dev-impersonation.ts:61-97` env+URL gate rejects when URL contains production project ref `ijvqdvsvwtwxzcqmoqit`; `NODE_ENV=production` also refused when URL missing (fail-closed). Documented in `dev-impersonation.test.ts`. | Defended |
| POST a FormData `seller_account_id=<victim>` to the dispatch action | Trick the server into saving dispatch as the victim | `_dispatch-action.ts:7-8` deliberately ignores FormData seller id; `dispatch-service.ts:240` uses `session.account.id` only | Defended |
| Forge `Authorization: Bearer <fake>` header | Trick the resolver into accepting a bad JWT | Resolver's real-session branch calls through to `resolveNexAppSessionFromContext` → Supabase JWT verification; forged tokens are rejected at the auth layer, not the dispatch layer | Defended |
| Multi-account browser · real cookie in tab A, dev handle set for tab B | Impersonate another real user using the dev handle | `dev-impersonation.ts:147-157,162-163` — real signed-in cookie is checked **first**; impersonation only engages when `realSession === null`. Owner directive 2026-11-15. | Defended |
| Seed a persona with `is_mock_persona=true` matching a real account id | Blend a persona with a real account's rows | Persona lookup filters `is_mock_persona = true` (lines 104, 134); persona account rows are seed data; a real account cannot flip this flag without owner intervention | Defended at the data layer, dependent on seed hygiene |
| Downstream RPC trust · `session.account.id` as caller identity | Rely on the RPC to re-verify ownership | RPC body re-checks `nex_business.owner_account_id = p_seller_account_id` (mig 349 lines 189-194), independent of the service-layer check | Defended (defence in depth) |

**Trust boundary summary:** the resolver can return a session whose `account.id` was NOT minted by Supabase Auth (the dev-persona branch), but this only happens in non-production environments and the production project-ref check hard-fails even if an operator mis-sets the env. The dispatch action never trusts a client-supplied identity. The RPC never trusts the service layer alone — it re-verifies ownership itself.

**Not proven by this addendum:** that every **other** server action in the repo (not just dispatch) applies the same "ignore client-supplied identity" discipline. That is a repo-wide audit task larger than this addendum's scope.

### D · Preparation wiring inventory + dependency on unapplied schema

Cross-ref to §3 of this report. The previously-listed preparation files all exist; this addendum names each line that depends on migration 349 being applied before the code can run successfully.

| File | Line(s) depending on mig 349 | Behaviour when flag OFF |
|---|---|---|
| `src/lib/nex-native/manage-orders/dispatch-service.ts:279` | `rpc("nex_order_seller_save_dispatch", ...)` | Returns `{ok:false, reason:"feature_disabled"}` before reaching this line (`:234-236, 370-372`) |
| `src/lib/nex-native/manage-orders/dispatch-service.ts:309-312` | Destructures `dispatched_at, estimated_transit_qty, estimated_transit_unit` from RPC response | Same early return; this code is unreachable while flag is OFF |
| `src/components/nex-native/order-summary/order-summary.tsx:62-64` | Reads `snapshot.dispatch_state, dispatched_at, estimated_transit_qty, estimated_transit_unit` | Component is **NOT RENDERED** in any live page today (grep confirmed: no import of `order-summary.tsx` from a route page). Safe. |
| `src/app/nex-native/manage/orders/[orderId]/_dispatch-panel-client.tsx` | Submits FormData shaped against mig 349 state machine | Panel is **NOT RENDERED** today (the order detail route does not yet import it) — safe |
| `src/app/nex-native/manage/orders/[orderId]/_dispatch-action.ts` | Server-action entry | Only reachable if the panel is rendered; unreachable today |
| `src/lib/nex-native/manage-orders/order-notification-service.ts` (edited) | New `shipment_update` kind | Second-layer flag check inside `notifyBuyerShipmentUpdate` returns early when flag OFF — no notification writes made against missing schema |

The flag-OFF posture is **schema-safe**: no import-time read, no runtime query against the proposed columns, no notification write referencing `shipment_update`. The §4 test numbers (`dispatch-eta.test.ts` 18/18, `dispatch-service.test.ts` 20/20) exercise mocked RPC paths and pure calendar math; they do not substitute for a DB-backed enforcement test.

### E · Negative-test gaps still BLOCKED by unapplied schema

The following tests **cannot** be written against the sandbox until mig 349 is applied with owner approval:

1. **Buyer attempts dispatch save on their own order.** Expectation: RPC rejects on the ownership re-check; the service layer rejects first. Requires the function to exist.
2. **Unrelated seller attempts dispatch save on a victim seller's order.** Same expectation. Requires the function.
3. **Spoofed `p_seller_account_id`** passed into the RPC by a service-role caller that itself has the wrong identity. Expectation: function's `select nex_business.owner_account_id` check fails. Requires the function.
4. **Multi-seller order boundary** (if `nex_order.business_id` ever points at multi-seller fulfilment). Expectation: only the fulfilling seller can save. Requires schema + sample data.
5. **Terminal state** (cancelled/refunded): dispatch save rejected. Requires function.
6. **Payment-column tamper attempt:** direct `UPDATE nex_order SET price_pence = 1 WHERE id = ...` as `authenticated`. Expectation: denied by the existing RLS posture (no `TO authenticated` UPDATE policy on `nex_order`). This is a check of the *existing* schema, not mig 349 — it is the B.1 BLOCKED proof above.
7. **Concurrent save** on the same order from two devices: last-writer-wins without corruption. Requires function.
8. **Audit trail** — do dispatch changes get a trail row anywhere, or is the `updated_at` + state machine the only record? If no audit table exists, a future proposal may add one; not in mig 349.

These eight negative tests are owner-gated. The seven in-process tests already in the working tree (dispatch-service suite + eta suite) exercise code paths behind the flag; they are **not** substitutes for DB-level enforcement proof.

### F · Script review (apply script NOT RUN)

Source: `scripts/apply-migration-349-sandbox.mjs` (if present; verified via a read before adding this section).

The apply script's responsibility is to refuse any target that is not the sandbox `kdstoyyeygcopkogqsyv`. A project-ID string match alone is not proof of a safe target; the owner directive is correct on this point. A defence-in-depth check would additionally verify the connection string matches the sandbox pooler region and that `NODE_ENV !== 'production'`. **The script is not run by this addendum**; I note the gap so that any future owner-approved apply uses an audited runner.

### G · What this addendum is NOT

- Not an approval request.
- Not a pre-approval of migration 349.
- Not a commit, push, deploy, or env change.
- Not an apply of any migration.
- Not a change to grants, policies, or functions on either sandbox or prod.
- Not an enable of `NEX_DISPATCH_TRACKING_ENABLED` anywhere.
- Not a touch of protected identities (Hammerex, Rosa, 99901, 99903).
- Not a disturbance of the running :3008 founder server.
- Not a reach into the translation pilot files or any other unrelated workstream.
