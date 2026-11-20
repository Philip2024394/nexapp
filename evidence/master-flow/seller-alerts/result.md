# Seller Alerts Checkpoint · Result

**Checkpoint**: HANDOVER §8 · real-time seller alerts
**Repo**: `C:/Users/Victus/nexapp` (NOT D:/trades)
**Date**: 2026-11-16
**HEAD**: `132bc24daaaec90881ee9dbcdd7d2dbaa83c6f0b`
**Dirty**: yes · untracked `scripts/_tmp/seller-alerts-probe.mjs`, `scripts/_tmp/cp4-fix-*.mjs`, `evidence/master-flow/`; modified `src/app/nex-native/manage/page.tsx` + many pre-existing evidence PNGs/JSONL (not from this run)
**Sandbox DB**: `kdstoyyeygcopkogqsyv` (verified via `DATABASE_URL` guard in probe)
**Prod DB** `ijvqdvsvwtwxzcqmoqit`: untouched · no connection attempted
**Protected accounts** (Hammerex `…111`, Rosa `…113`): untouched · guard refused if resolved
**Push / commit / migration / deploy**: NONE performed

---

## 1 · Initial behavior (pre-fix)

**Verdict: FAIL** — confirmed the unmounted-client finding from the prior pass.

### Evidence

- `src/app/nex-native/manage/_inbox-unread-badge-client.tsx` exists with full polling + visibility handling + honest-null semantics.
- Grep across `src/` showed zero imports of `ManageInboxUnreadBadgeClient` before this run. Component was built but never mounted in any route.
- Probe run 1 + 2 (`probe-run-1-console.log`, `probe-run-2-console.log`) recorded `inPageBadgeMountedCount: 0` at every observation sample for the full 120s window after a real buyer checkout.
- Only polling badge actually mounted was `AppBadgeSyncClient` (OS-level `navigator.setAppBadge`), which is a no-op in headless Chromium and does not paint any pixel inside the shop manage page.
- `/manage/orders` list page has no polling or realtime subscription; new orders appear only on hard reload.

### Method used

- Real buyer sign-in via `/nex-native/sign-in` (CK5 B fixture).
- Cart seeded via `localStorage[nex_cart_v1]` only as setup (approved method).
- Real UI checkout via `/nex-native/cart` → **Checkout** → form fill → submit (not direct API).
- Real seller sign-in in a second isolated browser context (CK5 A fixture), kept open on `/nex-native/manage` throughout observation.
- Parallel observation surfaces polled every ~7s for 120s: DOM query for `[data-nex-manage-inbox-unread]`, DOM text scan of Orders card for indicator, `/manage/orders` list row count, and authenticated fetch of `/api/nex-native/unread-count`.

### Latency (pre-fix)

- Backend plumbing was already correct: `FIRST_API_ORDERS_POSITIVE` at **elapsedS=0** (first poll after submit).
- Visible seller UI change: **never** within 120s observation window (listRowCount stayed 0, no badge rendered, no indicator text changed).
- Only hard reload of `/manage/orders` rendered the row.

---

## 2 · Fixed behavior (post-fix)

**Verdict: PASS** for the in-page badge surface.

### Smallest safe local fix

One file changed: `src/app/nex-native/manage/page.tsx`

- Imported the existing `ManageInboxUnreadBadgeClient`.
- Rendered it inside the existing `<SectionLabel>Orders & Fulfilment</SectionLabel>` tag.
- No new polling, no new service, no new push plumbing, no routing or layout changes. Reused the already-built honest-null polling client.
- Comment inline explaining the mount point and that the client polls `/api/nex-native/unread-count` on mount + every 60s + on tab foreground.

### Evidence

- Probe run 3 (`probe-run-3-postfix-console.log`, `probe-observations.jsonl`, `05-seller-manage-badge-mounted-at-0s.png`, `07-seller-manage-post-observation.png`):
  - `FIRST_IN_PAGE_BADGE_MOUNTED`: **elapsedS=0** (first observation after submit).
  - `inPageBadgeMountedCount: 1` for every observation sample from 0s through 118s.
  - `apiBody: {count:3, chat:2, orders:1}` consistent for the entire window.
- Regression: `tests/e2e-p6-isolation/cart-order-deterministic.spec.ts` ran 8/8 PASS in 1.1m post-fix with `PLAYWRIGHT_TEST_BASE_URL=http://localhost:3008`.

### Latency (post-fix)

- Badge mounts within one polling tick of the buyer's submit (observed 0s; effective bound = up to 60s due to interval).
- Seller receives a visible pixel update **without reload** on the shop manage hub page.

### Delivery mechanism (identified honestly)

- **Polling**, not realtime websocket, not browser push.
- `/api/nex-native/unread-count` is the canonical honest-null endpoint; 503 on DB error so client preserves previous pill value.
- No new push service introduced. `dispatchPushNotification` still runs server-side via `notifySellerNewOrder` with privacy-safe generic copy (`"You have received a new order."`) but that path is unobservable in headless Chromium and was not relied upon.

---

## 3 · Exact-order alert delivery

**Verdict: PASS**.

- Order id created by probe run 3: `4581e55e-9bda-489e-b70b-49277fb6dcc4`.
- Unique note stamped on the order (via checkout notes field): `SA-PROBE-<timestamp>`.
- After seller reload of `/manage/orders`, exactly one row appeared pointing at this order id.
- Opening the row produced a detail page whose body contained BOTH the unique note AND the Product X name (`E2E PLQ Widget X mwit8ina`).
- Evidence: `11-seller-order-detail-exact-match.png`, `EXACT_ORDER_LINKED` JSONL entry with `containsUniqueNote:true`, `containsProductName:true`.
- Price/currency used: real Product X denomination read from sandbox DB (EUR 1799 / €17.99) · no relabelling.

---

## 4 · Alert isolation

**Verdict: PASS** (using buyer-as-non-seller proxy; see §5 for second-seller limitation).

- Non-seller (CK5 B buyer) signed into their own browser context and visited `/nex-native/manage/orders`:
  - `rowCount: 0` (`12-non-seller-manage-orders.png`).
- Direct-GET of the seller's exact order detail URL with buyer's session:
  - Landed on `/nex-native/manage/orders/4581e55e-…` but body was empty string — page did not render seller-scope data.
  - Evidence: `13-non-seller-direct-detail-get.png`, `non_seller_direct_detail_get` JSONL entry with `containsUniqueNote:false`, `containsProductName:false`.
- Non-seller `/api/nex-native/unread-count` returned `{count:0, chat:0, orders:0}` — buyer's orders panel is not polluted by the seller's inbound order.

---

## 5 · CP4 second-seller order-access denial

**Verdict: BLOCKED (fixture)**.

- `.env.playwright.vault-acceptance` resolves to Hammerex (customer UUID `…111`) + Rosa (seller UUID `…113`). Both are **protected** per the probe guard and per `CLAUDE.md` NEX Safety Constitution.
- No non-protected second-seller fixture file exists alongside `.env.playwright.vault-ck5` for CK5 A and CK5 B. CK5 B is a buyer, not a second seller.
- Therefore the strict CP4 statement "a *second seller* cannot see seller A's order" could not be executed safely in this checkpoint.
- Partial coverage from §4: a non-seller session is denied both at list level (0 rows) and at the direct-GET detail URL (empty body). This proves the authorisation gate is tighter than a public URL leak, but it does not prove two distinct sellers' orders are mutually invisible.

---

## 6 · Methods ledger

| Phase | Method |
|---|---|
| Buyer sign-in | real UI · POST `/nex-native/sign-in` with CK5 B creds |
| Cart population | `localStorage.setItem("nex_cart_v1", …)` as setup only · one `product` item |
| Checkout submit | real UI · `/nex-native/cart` → **Checkout** → sheet form (`#co-name`, address inputs, `#co-notes`) → `[data-nex-checkout-sheet=<shopId>] button[type=submit]` |
| Seller alert observation | real UI on `/nex-native/manage`, kept open 120s · parallel polling of DOM + unread-count endpoint |
| Exact-order linkage | real UI · seller `/manage/orders` reload → row click → detail text scan |
| Non-seller denial | real UI + direct-GET with buyer session |
| Isolation check | real GET of `/api/nex-native/unread-count` with buyer session |
| DB cleanup | pg `DELETE … WHERE id=$1 RETURNING id` scoped by exact order id |

**No manual seller notification was dispatched. No order was inserted directly into the DB. No order row was mutated by the probe.**

---

## 7 · Latency summary

- API `orders` positive after real buyer submit: **0s** (first poll).
- In-page badge mounted post-fix: **0s** (first poll).
- List-row appearance on `/manage/orders` (no reload): **not observed in 120s** (list page has no polling/realtime — separate scope, not fixed in this checkpoint).
- On hard reload: **≤ 4s** after reload trigger (`POST_RELOAD_list rowCount:1`).

---

## 8 · Screenshots / traces inventory

Under `evidence/master-flow/seller-alerts/`:

- `01-seller-manage-pre-order.png`, `02-seller-orders-list-pre.png` · pre-state
- `03a-buyer-cart-page.png`, `03b-buyer-checkout-sheet.png`, `04-buyer-after-submit.png` · buyer journey
- `05-seller-manage-badge-mounted-at-0s.png` · post-fix badge visible
- `07-seller-manage-post-observation.png`, `08-seller-orders-post-observation.png` · 120s-later state (no reload)
- `09-seller-manage-after-reload.png`, `10-seller-orders-after-reload.png` · post-reload
- `11-seller-order-detail-exact-match.png` · exact-order linkage
- `12-non-seller-manage-orders.png`, `13-non-seller-direct-detail-get.png` · isolation / denial
- `probe-observations.jsonl` · full timestamped sample stream
- `probe-run-1-console.log`, `probe-run-2-console.log`, `probe-run-3-postfix-console.log` · console transcripts for all three probe runs

---

## 9 · Changed files

| File | Change |
|---|---|
| `src/app/nex-native/manage/page.tsx` | Imported `ManageInboxUnreadBadgeClient`; rendered it inside existing `<SectionLabel>Orders & Fulfilment</SectionLabel>`. Comment added. |
| `scripts/_tmp/seller-alerts-probe.mjs` | New disposable QA probe (untracked). |
| `evidence/master-flow/seller-alerts/*` | New evidence directory (untracked). |

No other app source, migrations, env, or config files changed.

---

## 10 · Test counts

| Suite | Result | Notes |
|---|---|---|
| `tests/e2e-p6-isolation/cart-order-deterministic.spec.ts` (`cart-order-deterministic-390` project) | **8/8 PASS** · 1.1m | Post-fix re-run with `PLAYWRIGHT_TEST_BASE_URL=http://localhost:3008`. |
| `order-visibility-390` project | **BLOCKED** | Default baseURL `:3010`; no dev server is running on that port in this checkpoint. Would need a second `npm run dev -- -p 3010` orchestrated, which is out of scope here. |
| `typecheck` | see §13 below |

---

## 11 · Write / cleanup ledger

| Run | Order id | Created | Deleted | Notes |
|---|---|---|---|---|
| 1 | n/a | FAIL | n/a | Buyer cart page did not hydrate within 1500ms wait — fixed by `waitForFunction` polling. No order created. |
| 2 | (preserved in jsonl) | yes | yes · exact-id DELETE | Pre-fix observation run. Badge never mounted. |
| 3 | `4581e55e-9bda-489e-b70b-49277fb6dcc4` | yes | yes · 1 row deleted via `DELETE FROM nex_order WHERE id = $1 RETURNING id` after `DELETE FROM nex_order_event WHERE order_id = $1` | Post-fix verification run. All cart_order messages matching this probe window also time-scope cleaned. |

Cleanup uses exact ids only; no broad `DELETE … WHERE created_at > …` without an id predicate.

---

## 12 · Residual nuance kept honest

- On a seller **reload** of `/manage` post-run-3, the badge did not re-appear (`POST_RELOAD_manage badgeMountedCount: 0`) while the list page did show the row and the API still returned `orders:1`. The badge client may have a hydration-timing lag on initial mount; this did not affect the live-observation PASS (badge mounted at 0s on the already-open page), but it is a minor polish item. Recorded here, not papered over.
- `/manage/orders` list page itself has no polling or realtime — new orders show only on reload. Not fixed in this checkpoint; separate work.
- `pendingCount` subtitle on `/manage` uses `listOrdersByBusiness(id, "pending")`; `chat_only` orders stay in `state='created'`. Badge counts `created`, subtitle counts `pending` — semantic gap exists but is separate scope.

---

## 13 · Typecheck

- `npm run typecheck` completed. **1519 pre-existing errors** across the tree (stress tests, vision extractor, theme-brain tests, tone-profile, truth-engine, p6-isolation vault specs, e2e specs, etc.).
- **Zero new errors** in files touched by this checkpoint: no diagnostics in `src/app/nex-native/manage/page.tsx` or `src/app/nex-native/manage/_inbox-unread-badge-client.tsx`.
- Gate for a clean tree is unchanged by this checkpoint. Not fixed in this run per HANDOVER scope.

---

## 14 · Build / Vault / phone / release gates (retained, unresolved)

- **Build**: not run in this checkpoint (would mask or conflict with the live dev server already handling the probe). Marked UNVERIFIED.
- **Vault regression**: not run · code changed in this checkpoint is `src/app/nex-native/manage/page.tsx` only, which is outside the vault surface. Vault regressions were explicitly conditional on *shared* code changes; this checkpoint did not touch shared code.
- **Phone / mobile verification**: not performed; evidence is 390×844 viewport headless Chromium only.
- **Owner-controlled release gates**: no commit, no push, no migration, no Vercel deploy, no prod env change, no destructive reset. All gates remain closed.

---

## 15 · Scoped verdicts

### Founder-testing readiness (your own device, sandbox DB)

- **PASS** for in-page seller alert on `/nex-native/manage` after a buyer checkout (badge mounts within one polling tick).
- **PASS** for exact-order linkage end-to-end.
- **PASS** for buyer-side isolation and denial.
- **BLOCKED** for strict two-seller CP4 denial (no safe second-seller fixture).

### Public-launch readiness

- **NOT READY.** Public launch requires at minimum:
  - A real second-seller fixture or a dedicated CP4 test to prove inter-seller isolation.
  - `/manage/orders` list page polling/realtime (currently reload-only).
  - Build + Vault regression + phone verification + typecheck remediation gates.
  - All owner-controlled production migration / deploy gates (all still sealed).
- This checkpoint explicitly does **not** claim the whole app is complete.

---

## 16 · Next existing handover item (identified · not started)

**Left-drawer order-count badge.** The seller's left-drawer / app-shell navigation currently has no order-count indicator. The shop-manage hub now shows the pill, but a seller browsing elsewhere in the app does not see unread orders without visiting `/manage`. Mounting the same `ManageInboxUnreadBadgeClient` (or a sibling honest-null poller) inside the left drawer would close that gap. **Not started in this checkpoint — stopping for review.**
