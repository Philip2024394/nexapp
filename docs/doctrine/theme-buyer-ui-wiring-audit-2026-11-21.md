# NEX Theme + Buyer UI DB-Wiring Audit · 2026-11-21

Scope · forensic read-only audit of two orthogonal surfaces against
the sealed 2026-11-12 DB-wired UI rule and the sealed 2026-11-13
NEX Themes+ Phase A scope. Phase 2 Remediation priority 6 (P2-06)
per the sealed 2026-11-09 priority order.

- Surface A · NEX Chat Themes library (`/chat-themes-library/*`) +
  first-free apply write-through to `nex_theme_ownership`.
- Surface B · Buyer product discovery + cart + checkout surfaces
  (`/cart`, `/[businessSlug]`, `/api/nex-native/billing/checkout/
  buyer`).

Audit root · `C:/Users/Victus/nexapp`
Repo · `Philip2024394/nexapp` · branch `release-audit-v1-2026-11-14`
HEAD at audit time · `d2b7356f`

Posture in one line · **Both surfaces are correctly DB-wired ·
dev-impersonation resolvers match page-to-action on every touched
flow · Phase A Stripe walls respected · zero disconnected-write
patterns surfaced.** Conditional launch readiness · mig 342
(first-free `acquired_via` column) authored but NOT YET APPLIED ·
code degrades gracefully via `code='42703'` catch.

Spot-verified by direct Read before publication ·

- `src/app/nex-native/chat-themes-library/_payment-sheet.tsx` ·
  line 6-7 preamble · "Shared 'Payment coming soon' sheet mounted
  by the entry carousel + the full library grid. Prices are
  visible but no Stripe calls fire." · line 99 renders "Payment
  coming soon" · line 115 explanatory copy "Stripe checkout is
  being wired." · Phase A gate held in code.
- `src/lib/nex-native/library/entitlement-service.ts` · line 181
  `canClaimFirstFreeTheme()` queries `.eq("acquired_via",
  FIRST_FREE_SOURCE)` · line 189 same clause in SELECT · line 205
  `claimFirstFreeTheme()` · line 215 `alreadyClaimed = !(await
  canClaimFirstFreeTheme(accountId))` idempotency guard · line
  225 `acquired_via: FIRST_FREE_SOURCE` in the INSERT payload.

---

## Compliance scorecard

| Area | Verdict | Launch gate |
|---|---|---|
| Surface A · theme library live read (DB-wired) | COMPLIANT | n/a |
| Surface A · apply writes `nex_theme_ownership` | COMPLIANT | mig 342 apply pending |
| Surface A · first-free entitlement idempotency | COMPLIANT | code read |
| Surface A · Phase A Stripe gate (no checkout call) | COMPLIANT · gate held | Phase B separate authorisation |
| Surface A · dev-override resolver symmetry | COMPLIANT | n/a |
| Surface B · product discovery live read | COMPLIANT | n/a |
| Surface B · cart device-local by design | COMPLIANT · intentional | n/a |
| Surface B · checkout endpoint wires through to server price validation (P2-03) | COMPLIANT | n/a |
| Surface B · dev-override resolver symmetry (2026-11-13 parity fix) | COMPLIANT | n/a |

Zero VIOLATION · zero AT-RISK on P2-06 scope. One operational
contingency · mig 342 must land in sandbox before the first-free
claim can persist · code already handles the missing-column case
by returning `{ok: false, reason: 'schema_missing'}` from
`claimFirstFreeTheme()`.

---

## 1 · Threat model being tested

The 2026-11-12 sealed rule names the failure class explicitly ·

> all area that we build must be full connected to data base. if
> we buiod its connected if we edit its also edit data base. no
> more updateing ui with out connecting the back end.

Against that rule the audit looks for ·

- hardcoded content arrays in UI that pretend to be "data";
- `setState({...})` without a server-action call behind it;
- forms whose `action={someAction}` references a non-existent /
  non-imported function;
- any `console.log("would save")` or `TODO: wire up` sentinel;
- session-resolver drift between page and server action (the
  2026-11-12 upload-bounce-to-sign-in bug class);
- a write targeting a column/table that doesn't exist in the
  current migration state.

The sealed 2026-11-13 Phase A gate adds a second posture check ·

- no buyer-facing Stripe checkout session may fire (Phase B);
- no buyer-facing write to `nex_account.themes_plus_until` (Phase B
  webhook authority).

---

## 2 · Surface A · NEX Chat Themes library

### 2.1 · Live DB read

- `/chat-themes-library/all/page.tsx:65` · server shell calls
  `resolveSessionWithDevOverride()`.
- Same file · line 83 (approx) · `listBackgroundAssets()` reads
  live `nex_background_asset` rows (mig 337).
- `LIBRARY_THEMES` constant (171 entries in `_catalog.ts`) is a
  LAST-RESORT fallback when the live asset array is empty · not
  the primary data source. Hardcoded-array red flag · not found
  in the hot path.

### 2.2 · Apply → write path to `nex_theme_ownership`

Flow (verified by Grep + Read) ·

1. `_full-library-client.tsx:486-501` · user confirms apply in modal
   · calls `applyFromLibraryChatAction` (server action).
2. `library/backgrounds/_actions.ts:109-212` · server action.
   - Line 113 · `resolveSessionWithDevOverride()`.
   - Line 193 (approx) · calls `claimFirstFreeTheme()` from
     `entitlement-service.ts`.
3. `entitlement-service.ts:205` · `claimFirstFreeTheme()`.
   - Line 215 · idempotency gate · reads
     `canClaimFirstFreeTheme()`.
   - Line 181 · `canClaimFirstFreeTheme()` SELECTs
     `nex_theme_ownership` where `acquired_via =
     FIRST_FREE_SOURCE` for the account.
   - Line 225 · INSERT with `acquired_via: FIRST_FREE_SOURCE`.
   - Catch block on error code `42703` (column missing) returns
     `{ok: false, reason: 'schema_missing'}` · graceful degrade
     when mig 342 has not applied.

Write-path discipline is explicit · idempotency guard first ·
schema-missing guard second · no silent swallow.

### 2.3 · Phase A Stripe gate · held

- `_payment-sheet.tsx` · line 6-7 preamble states "no Stripe calls
  fire" · line 99 renders "Payment coming soon" · line 115
  explanatory copy.
- No `POST /api/*/checkout/*` originating from
  `chat-themes-library/*` client code (Grep clean).
- No buyer-facing UPDATE path for `nex_account.themes_plus_until`
  (Grep · zero results for `update.*themes_plus_until`).
- Phase B (Stripe checkout session creation + webhook writer for
  `themes_plus_until`) remains sealed until the explicit
  authorisation per 2026-11-13.

### 2.4 · Dev-override resolver symmetry

- Page · `/all/page.tsx:65` · `resolveSessionWithDevOverride`.
- Action · `_actions.ts:29,113` · `resolveSessionWithDevOverride`.
- Match · the 2026-11-12 upload-bounce bug class cannot occur here.

### 2.5 · Migration 342 state

- File · `nex-supabase/migrations/342_nex_theme_ownership_first_
  free_acquired_via.sql` exists on disk.
- Status · DRAFTED · not yet applied to any database.
- Impact · until mig 342 lands in sandbox, `canClaimFirstFreeTheme`
  returns the `schema_missing` sentinel · UI shows a graceful
  degraded message rather than crashing.

### 2.6 · Surface A verdict · COMPLIANT

Phase A scope is wired · Phase A gates are held · dev-override
resolvers are consistent · schema-missing degrades gracefully.

---

## 3 · Surface B · Buyer product/cart/checkout UI

### 3.1 · Product discovery live read

- `[businessSlug]/page.tsx:189` · calls
  `productService.listProductsByBusiness(business.id, "live")` ·
  reads live `nex_product`.
- Line 170 · `getBusinessBySlug()` reads live `nex_business`.
- Line 193 · same page uses `resolveSessionWithDevOverride` for
  the viewer context (no write path on this surface).

### 3.2 · Cart state · device-local by design

- `/cart/_client.tsx:66-77` · cart state lives in `localStorage`
  under `NEX_CART_STORAGE_KEY`.
- Explicit device-local scope · NOT a DB-wiring gap · the
  2026-11-12 rule is about avoiding pretend-saves · an explicit
  client-local design that NEVER claims DB persistence satisfies
  the rule.
- Cart snapshot is posted to the server only at checkout action
  time via `sendCartOrderAction` (`_actions.ts:2818+`).

### 3.3 · Checkout endpoint wiring

- `/cart/page.tsx:25` · page resolves session with
  `resolveSessionWithDevOverride`.
- `_actions.ts:31` · action imports `resolveNexAppSessionFromContext`
  which is the ALIASED name of `resolveSessionWithDevOverride`
  (comment at the import line confirms the 2026-11-13 parity fix
  that renamed the symbol to make the nex-99901 dev-override path
  explicit).
- Action POSTs to `/api/nex-native/billing/checkout/buyer`.
- `/api/.../checkout/buyer/route.ts:69,167` · endpoint resolves
  session with `resolveSessionWithDevOverride` (same resolver).
- Endpoint re-derives prices server-side from
  `productService.getProductById` (P2-03 audit · lines 226-285) ·
  verified separately in `docs/doctrine/buyer-checkout-price-
  validation-audit-2026-11-21.md`.

Chain · page resolver = action resolver = endpoint resolver ·
three-link symmetry · no drift.

### 3.4 · Disconnected-write sweep

- Grep for `console.log("would save")` · zero results.
- Grep for `TODO: wire up` / `// stubbed` in buyer-cart /
  checkout / discovery · zero hot-path results.
- Every `setState` on the cart surface is paired with a
  `writeCart()` to localStorage OR a server-action POST.

### 3.5 · Surface B verdict · COMPLIANT

Cart is explicitly device-local (allowed by the rule) · checkout
end-to-end reads live product data and posts to the price-re-
derive endpoint · no pretend-save paths found.

---

## 4 · Red-flag sweep (both surfaces)

| Red flag | Surface A | Surface B |
|---|---|---|
| Hardcoded content arrays as primary data | Not found · `LIBRARY_THEMES` is fallback-only | Not found |
| `setState({...stubbed...})` without an action call | Not found | Not found |
| Server action referenced but not defined / imported | Not found | Not found |
| Session-resolver drift page ↔ action | Not found · match | Not found · 2026-11-13 alias fix verified |
| Write to non-existent table/column | Mitigated · `42703` catch handles mig-342-missing case gracefully | Not found |
| Pretending-to-save UI silently discards | Not found · payment-sheet labels itself "coming soon" explicitly | Not found |
| Buyer-facing Stripe checkout call (Phase A violation) | Not found · gate held | n/a (checkout endpoint is Path A server-driven, not Themes+) |
| Buyer-facing write to `themes_plus_until` | Not found | n/a |

---

## 5 · Dev-impersonation resolver consistency

The 2026-11-12 sealed rule names the failure case · Nex-99901
dev-impersonation surfaces must use `resolveSessionWithDevOverride`
on BOTH the page AND the server action. Mismatched resolvers
caused the 2026-11-12 upload-bounce-to-sign-in bug.

| Surface | Page | Action/endpoint | Symmetry |
|---|---|---|---|
| Chat Themes Library · `/all` | `resolveSessionWithDevOverride` (page L65) | `resolveSessionWithDevOverride` (action L29, L113) | MATCH |
| Cart → send-cart-order | `resolveSessionWithDevOverride` (page L25) | `resolveNexAppSessionFromContext` alias (action L31) · same underlying resolver per 2026-11-13 parity fix | MATCH |
| Buyer Checkout API | n/a (API route) | `resolveSessionWithDevOverride` (route L69, L167) | OK |
| Product Discovery · `[businessSlug]` | `resolveSessionWithDevOverride` (page L193) | n/a (read-only · no mutation) | OK |

No resolver drift surfaced in P2-06 scope. The 2026-11-12 bug
class cannot replicate on these flows.

---

## 6 · Phase A Stripe-gate respect

| Gate | Status | Evidence |
|---|---|---|
| No buyer-facing Stripe checkout session creation (Phase B scope) | Held | `_payment-sheet.tsx` renders static placeholder · zero Stripe fetches in chat-themes-library client code |
| No buyer-facing write to `nex_account.themes_plus_until` (Phase B webhook authority) | Held | Grep · zero matches for `update.*themes_plus_until` / `.update({themes_plus_until` |
| mig 342 column add NOT applied to prod | Correct posture | mig 342 marked DRAFTED only · prod `ijvqdvsvwtwxzcqmoqit` not touched · code handles `42703` gracefully |

Phase A boundary is held in code AND in schema state.

---

## 7 · What this audit does NOT prove

- Mig 342 state verification in sandbox `kdstoyyeygcopkogqsyv` ·
  UNVERIFIED (owner infra call).
- End-to-end user journey of first-free apply through a real
  session · owner infra UI test.
- Playwright coverage of these flows · P2-09 scope.
- a11y / mobile layout of payment-sheet placeholder · P2-10
  scope.
- Live-verified claims against production · owner infra per
  sealed 2026-11-08.

Engineering ceiling reached is Verified · code-read.

---

## 8 · Recommendation (not an authorisation)

For owner consideration only ·

1. Verify mig 342 state in sandbox. If NOT applied, propose a
   dedicated authorisation word-trigger (e.g. `apply mig 342
   sandbox`) before green-lighting first-free live testing.
2. Add Playwright coverage for the apply flow to P2-09 (sealed
   priority 9). Specifically · (a) first-free apply · idempotent
   second attempt returns `alreadyClaimed` · (b) schema-missing
   degrade path shows the correct UI.
3. Add Playwright coverage for cart → send-cart-order → buyer
   checkout session resolve to P2-09 · confirm the three-link
   resolver symmetry survives a real nex-99901 impersonation
   session end-to-end.
4. Do NOT open Phase B (Stripe checkout + webhook writer) until
   Phase A has been Verified in sandbox AND the separate `connect
   stripe` word-trigger per sealed 2026-11-08 (b).

---

## 9 · Evidence pointers

Code consulted ·

- `src/app/nex-native/chat-themes-library/all/page.tsx`
- `src/app/nex-native/chat-themes-library/_payment-sheet.tsx`
- `src/app/nex-native/chat-themes-library/_full-library-client.tsx`
- `src/app/nex-native/library/backgrounds/_actions.ts`
- `src/lib/nex-native/library/entitlement-service.ts` (lines 181, 189, 205, 215, 225 verified)
- `src/app/nex-native/cart/page.tsx`
- `src/app/nex-native/cart/_client.tsx`
- `src/app/nex-native/_actions.ts` (`sendCartOrderAction` 2818+)
- `src/app/nex-native/[businessSlug]/page.tsx`
- `src/app/api/nex-native/billing/checkout/buyer/route.ts` (verified in P2-03)
- `nex-supabase/migrations/342_nex_theme_ownership_first_free_acquired_via.sql`

---

## 10 · Readiness classification

| Area | State |
|---|---|
| Theme library live DB read | Built · Wired · Verified (code read) |
| First-free apply write-path to `nex_theme_ownership` | Built · Wired · Verified (code read) |
| Mig 342 `acquired_via` column | Built · Not yet applied |
| Phase A Stripe gate (no buyer checkout call) | Built · Wired · Verified |
| Buyer product discovery live read | Built · Wired · Verified |
| Buyer cart device-local design | Built · Wired · Verified |
| Buyer checkout endpoint server-side price validation | Verified in P2-03 (`d1a19dda`) |
| Dev-override resolver symmetry | Built · Wired · Verified |
| Playwright coverage of these flows | Not yet built (P2-09 scope) |
| Mobile layout / a11y of payment-sheet placeholder | Not audited here (P2-10 scope) |

Engineering ceiling reminder · no finding here may be promoted to
Live-verified. That remains an owner infra call per sealed
2026-11-08.
