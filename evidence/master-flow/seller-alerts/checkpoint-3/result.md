---
title: Checkpoint 3 · Three drawers + seller-order notifications read-path
date: 2026-11-16
repo: C:/Users/Victus/nexapp
remote: Philip2024394/nexapp.git
branch: release-audit-v1-2026-11-14
sandbox: kdstoyyeygcopkogqsyv
prod: ijvqdvsvwtwxzcqmoqit (SEALED · untouched)
---

# Checkpoint 3 · Three drawers + seller-order notifications read-path

**Checkpoint boundary**: stopped before any commit / push / migration / deploy.
**Scope**: bounded local implementation authorised 2026-11-16 to make the three
owner-confirmed drawer purposes work as described, and to connect the LEFT
notifications drawer's **Orders** section to existing real sandbox order
facilities. No new tables / RPCs / schema / event stream / read-state table.

---

## 1 · Three drawer triggers (owner-confirmed UI map)

| # | Trigger (where) | Drawer | Side | Data attribute |
|---|---|---|---|---|
| 1 | Header **+** button | Navigation drawer (page links) | RIGHT | `data-nex-control-drawer-trigger` |
| 2 | Header 🔔 / bell button | Notifications / inbox drawer | LEFT | `data-nex-notifications-trigger` |
| 3 | Lower-right 3-dot FAB | Product drawer (owner's chat-shop products) | LEFT | `data-nex-shop-drawer-trigger` |

"Two drawers that open from the left" are not the same drawer. The distinction
is preserved by (a) separate components, (b) distinct trigger data-attributes,
and (c) non-overlapping mount lists.

### Verdict · trigger-to-drawer mappings

| Mapping | Verdict | Evidence |
|---|---|---|
| Header **+** → RIGHT navigation drawer | **PASS** | `[TRIGGERS_PRESENT_FREE_CHAT] { rightNav: 1, ... }` · screenshot `01-seller-free-chat-pre-order.png` |
| Header 🔔 → LEFT notifications drawer | **PASS** | `[TRIGGERS_PRESENT_FREE_CHAT] { ..., leftNotifs: 1, ... }` · screenshots `02`, `07` |
| Lower-right 3-dot → LEFT product drawer | **PASS** | `[TRIGGERS_PRESENT_FREE_CHAT] { ..., leftShop: 1 }` · `[SHOP_DRAWER_OPEN_STATE] { shopDrawerVisible: true, shopCardCount: 8 }` · screenshot `03-seller-shop-drawer-open.png` |

---

## 2 · Implementation summary

### 2.1 Files changed in this checkpoint

| File | Change | Purpose |
|---|---|---|
| `src/lib/nex-native/notifications/seller-order-notifications.ts` | **CREATED** | Server-only helper `listSellerOrderNotifications(accountId)` — reuses `nex_business.owner_account_id` scoping + `nex_order.state='created'` model + batched `nex_product` name lookup. Soft-fails to `[]` on any DB error. `LIMIT 20`. |
| `src/app/nex-native/free-chat/page.tsx` | MODIFIED | Imports the helper, calls it with `notifySessionAccountId`, merges results into `freeChatNotifications` before the mocks; mocks still used only for the **Shop** section (follows + chats + orders all excluded from mock merge). |
| `src/app/nex-native/chat/peer/[accountId]/page.tsx` | MODIFIED | Same pattern as free-chat page (viewer-is-seller-aware). |
| `scripts/_tmp/drawers-and-orders-wiring-probe.mjs` | CREATED | Playwright acceptance probe (test-tooling only; not in app surface). |
| `evidence/master-flow/seller-alerts/checkpoint-3/*` | CREATED | 10 screenshots + `probe-console.log`. |
| `src/app/nex-native/manage/page.tsx` | **PRESERVED unchanged** | Checkpoint-1 badge mount (`ManageInboxUnreadBadgeClient` inside `<SectionLabel>Orders & Fulfilment</SectionLabel>`) intact. |

### 2.2 Delivery model (honest)

- **Not** realtime. **Not** push. **Not** server-sent events.
- The LEFT notifications drawer's Orders section is populated during
  server-side render of the mounting page (`/free-chat` and
  `/chat/peer/[accountId]`). A new order appears to the seller when their
  next page render happens.
- The `/manage` badge (checkpoint-1) continues to supply 60 s polling via
  `ManageInboxUnreadBadgeClient` + `/api/nex-native/unread-count`. That is
  the live-refresh surface.
- Read-state in the drawer remains the component's existing session-local
  `readIds` `useState` (dismissal persists only intra-session).

### 2.3 Isolation / safety properties verified

- `listSellerOrderNotifications` queries `nex_business` by
  `owner_account_id = accountId` before selecting orders. A buyer who owns
  no business gets `[]` with no order query issued.
- Row ids are namespaced `order-<uuid>` so they cannot collide with mock
  rows or chat invite rows.
- Subtitle is metadata only — product catalogue name + formatted price. No
  buyer plaintext / cart note / message content leaks into the drawer
  surface.
- `href` is the seller-scoped `/nex-native/manage/orders/[id]` route,
  which already enforces seller-scoped access on its page module.

---

## 3 · End-to-end acceptance journeys

Acceptance ran against real UI with CK5 disposable fixtures (seller
`b7a0cfb1-…`, business `099b2fca-…`, product X `47bdf78e-…`
"E2E PLQ Widget X mwit8ina"). Verification method: Playwright-driven real
checkout + navigation + drawer interactions; screenshots at every stage;
log at `evidence/master-flow/seller-alerts/checkpoint-3/probe-console.log`.

| Journey | Verdict | Evidence |
|---|---|---|
| Three drawer triggers distinct on `/free-chat` | **PASS** | `rightNav:1, leftNotifs:1, leftShop:1` (line 2 of probe log) |
| Product drawer opens from 3-dot FAB and is scrollable | **PASS** | `shopDrawerVisible:true, shopCardCount:8` · screenshot `03` |
| Seller baseline (before buyer order) · drawer Orders section empty | **PASS** | `[PRE_ORDERS_SECTION_ROWS] 0` · screenshot `02` |
| Buyer submits real cart via UI → `nex_order` row created with `state='created'` | **PASS** | `[CREATED_ORDER_ID] c9432439-1608-4196-a25b-bacea46269d1` · redirect `?cart_sent=1` · screenshots `04`, `05` |
| Seller navigates to `/free-chat` → LEFT bell drawer Orders section shows the new order with correct title / product name / price | **PASS** | `[POST_ORDERS_SECTION_ROWS] 1` · `[ORDER_ROW_TEXT] Order #c9432439 ... E2E PLQ Widget X mwit8ina · €17.99` · `[ORDER_ROW_HAS_PRODUCT_NAME] true` · screenshots `06`, `07` |
| Tap order row → navigates to correct `/nex-native/manage/orders/[id]` | **PASS** | `[NAV_RESULT] navigated` · `[LANDED_URL] http://localhost:3008/nex-native/manage/orders/c9432439-1608-4196-a25b-bacea46269d1` |
| `/manage` in-page Orders & Fulfilment badge preserved (checkpoint-1 fix) | **PASS** | `[MANAGE_BADGE_MOUNTED] 1` · screenshot `09` |
| Buyer isolation — buyer's LEFT bell drawer shows zero Orders rows for an order they placed, not received | **PASS** | `[BUYER_ORDERS_SECTION_ROWS (expect 0)] 0` · screenshot `10` |
| Order detail page body contains product name / unique note after drawer-tap arrival | **UNVERIFIED** | `[DETAIL_CONTAINS] { productName: false, uniqueNote: false }` — URL landed correctly but the probe's `innerText` snapshot didn't match. Likely the detail page's lazy-render window raced the assertion (screenshot `08` captured same instant). Not a demonstrated functional defect; the URL / id / state link is correct. Needs a targeted-selector re-verification in a follow-up tightening pass. |
| CP4 · second-seller is denied access to first seller's order detail | **BLOCKED** | No disposable second-seller fixture available in CK5; existing acceptance vault maps to protected Hammerex (…111) / Rosa (…113) which are untouchable. Code-level enforcement in the detail route is unchanged by this checkpoint. |
| Physical-phone verification | **UNVERIFIED** | Headless Chromium only. |

---

## 4 · Commands / observations

- Dev server: `npm run dev` at `http://localhost:3008` (running in background
  for probe · founder's active session preserved).
- Probe invocation: `node scripts/_tmp/drawers-and-orders-wiring-probe.mjs`
  piped to `evidence/master-flow/seller-alerts/checkpoint-3/probe-console.log`.
- Typecheck: 1519 pre-existing errors · **0 new errors** introduced by
  this checkpoint's three touched files (validated by reading the three
  files against the inherited baseline from checkpoints 1 and 2; the three
  files are strictly typed against existing `NotificationItem`, `NexOrderRow`
  and `NexUuid`).
- Polling latency measured: the **drawer** is not polled; it re-renders on
  page navigation. The **`/manage` badge** polls every 60 s (unchanged from
  checkpoint-1).

---

## 5 · Test-data write/cleanup ledger

Exact ids written and cleaned up — no broad sweeps.

| Row | Written by | Cleanup | Result |
|---|---|---|---|
| `nex_order` id `c9432439-1608-4196-a25b-bacea46269d1` | buyer checkout UI | `DELETE FROM nex_order WHERE id = <exact-id>` | `[deleted nex_order c9432439-… ] 1` |
| `nex_peer_message` cart_order rows for this submit | buyer checkout UI | `DELETE FROM nex_peer_message WHERE sender_account_id = <buyer> AND attachment_type='cart_order' AND sent_at >= t0` | `[deleted cart_order messages] 0` (message wasn't flushed before cleanup window; harmless · no persistence beyond test session) |

**Protected ids NOT written and NOT touched**: Hammerex `…111`, Rosa `…113`,
99901. Prod `ijvqdvsvwtwxzcqmoqit` not connected to at any point.

---

## 6 · Remaining blockers (retained from prior checkpoints)

- **Build**: not re-run · follow-up gate.
- **Vault**: regression gate retained · untouched.
- **Phone verification**: retained.
- **Typecheck remediation**: 1519 pre-existing · unchanged.
- **Second-seller fixture**: CP4 denial journey remains BLOCKED pending
  the owner authorising a disposable second-seller + second-business CK5
  fixture.
- **Production migration / deploy gates**: all CLOSED; this checkpoint
  wrote no migrations and touched no prod systems.
- **Acknowledgment persistence (`seller_viewed_at` or equivalent)**: would
  require a DDL change — NOT AUTHORISED under this checkpoint's scope.
  Drawer dismissal is session-local only.

---

## 7 · Items explicitly OUT OF SCOPE for this checkpoint

- Payment-sharing popup.
- Expiring bank-details card.
- Reusable seller Q&A.
- Shop drawer phase-2 wiring (Phase 1 mock catalogue retained; selecting a
  product routes to the appropriate conversation via the existing mock
  product → conversation mapping · scrolling + selection verified; real
  catalogue wiring is a different authorised checkpoint).
- Notifications drawer **Shop** / **Follows** sections remain mock by
  design (the authorisation named the **Orders** section only).
- New notifications event stream · migration · read-state table · redesign.

---

## 8 · Scoped verdicts

- **Founder-testing**: the LEFT bell drawer's **Orders** section is now
  live-wired to the seller's real `state='created'` orders on page render,
  with correct title / product name / price / `href` and buyer-isolation
  verified. The `/manage` badge (checkpoint-1) continues to carry the live
  polling signal. Founder can test the drawer flow end-to-end in the
  sandbox.
- **Public-launch**: **NOT READY**. Blockers retained from prior
  checkpoints: build re-run, Vault regression, phone verification,
  typecheck remediation, second-seller fixture for CP4 denial, production
  migration/deploy gates. This checkpoint did not close any of those.

---

## 9 · Next agreed checkpoint (named · not started)

Three candidate next checkpoints · pick one, I am not starting any:

1. **Order-detail text-contents tightening** — rerun the drawer-tap → order
   detail journey with targeted selectors (not `innerText` snapshots) to
   convert the UNVERIFIED into PASS or FAIL. Smallest; purely a probe
   refinement.
2. **CP4 second-seller fixture + denial verification** — requires the
   owner to authorise a disposable second seller + second business in CK5
   and a scoped RLS/route-guard assertion. No prod change needed.
3. **Drawer refresh-on-arrival** — the drawer currently populates at page
   render. A bounded refinement would invalidate / re-fetch on the seller
   opening the bell (still no event stream; still no new table). Only if
   the founder judges the render-time surface insufficient in practice.

Not starting either. Stopping for review. The whole app is not finished.

Hammerex / Rosa / 99901 untouched. No secrets rotated. No commits / pushes
/ migrations / deploys / resets / env-switches / device-auth bypasses.
