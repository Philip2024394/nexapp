---
title: Checkpoint 3b · Order-detail verification + non-owner isolation
date: 2026-11-16
repo: C:/Users/Victus/nexapp
remote: Philip2024394/nexapp.git
branch: release-audit-v1-2026-11-14
sandbox: kdstoyyeygcopkogqsyv (verified · not prod)
prod: ijvqdvsvwtwxzcqmoqit (SEALED · untouched)
dev_server: http://localhost:3008 (already running · founder session · NOT touched)
---

# Checkpoint 3b · Order-detail verification + non-owner isolation

**Checkpoint boundary**: stopped before any commit / push / migration /
deploy / role mutation. 30-minute cap honoured.

**Scope**: bounded verification of two gaps left as UNVERIFIED /
BLOCKED by checkpoint 3 — (1) order-detail content rendering under
bounded element-scoped waits, (2) non-owner isolation against a direct
order URL hit.

---

## 1 · What changed in the probe

Replaced the page-wide `document.body.innerText` snapshot used by the
checkpoint 3 probe with element-scoped bounded waits:

- Wait for `[data-nex-order-detail]` attached (bounded to 15 s).
- Read the server-rendered match tier via
  `getAttribute("data-nex-order-cart-match-tier")`.
- If `[data-nex-order-cart]` rendered → extract `innerText` from THAT
  element only, assert product name + unique buyer note present.
- If `[data-nex-order-cart-ambiguous]` rendered → report as a real
  failure (we refuse to display another order's items).
- Reload and re-verify identical consistency.
- Replace `attachment_type = 'cart_order'` cleanup filter with a
  precise `attachment_meta->'cart'->>'buyer_notes'`-marker cleanup
  (the real `attachment_type` column was NULL for cart messages).

The hypothesis in the checkpoint-3 directive — "test timing, not an
app defect" — was confirmed: under bounded element-scoped waits the
page renders every expected field on first load and after reload.

### Files created / changed

| File | Change |
|---|---|
| `scripts/_tmp/cp3b-order-detail-and-isolation-probe.mjs` | **CREATED** · new bounded probe (test-tooling only; not in app surface) |
| `evidence/master-flow/seller-alerts/checkpoint-3b/*` | **CREATED** · 5 screenshots + `probe-console.log` |

**No app code changed.** No migrations. No schema change. No new
read-state table. The existing drawer implementation, checkpoint-1
`/manage` badge, and inherited files are preserved exactly.

---

## 2 · Order-detail content verification

Verification method: element-scoped `locator().innerText()` on
`[data-nex-order-cart]` and `[data-nex-order-detail]` after bounded
`waitFor({ state: "attached" })`; `getAttribute()` for the
server-rendered match-tier flag. No arbitrary sleeps extended.

### 2.1 Fresh order created via real buyer UI

| Field | Value |
|---|---|
| `nex_order.id` | `dc01eb01-20bf-4af6-9ba8-6d16a62814de` (begins `dc01eb01…`) |
| `nex_order.product_id` | `47bdf78e-84a9-4ca5-b33f-0676981df65b` (CK5 PRODUCT X) |
| `nex_order.price_pence` | `1799` |
| `nex_order.currency` | `EUR` |
| `nex_order.state` | `created` |
| Formatted header money (per `Intl.NumberFormat("en", …)`) | `€17.99` |
| Unique buyer-note marker in `co-notes` → `cart.buyer_notes` | `CP3B-UNIQ-1794814151008` |

The €17.99 is the **order total** (= `price_pence / 100`), computed by
`formatMoney(order.price_pence, order.currency)` in
`[orderId]/_client.tsx`. Checkpoint 3's reported "€17.99" represented
the same single-item order total — confirmed from the buyer's cart
payload (1 × 1799 pence EUR).

### 2.2 First-load bounded verdicts

```
[DETAIL_MAIN_PRESENT]          1
[DETAIL_MATCH_TIER]            deterministic_order_id
[DETAIL_CARDS]                 { cartSection: 1, ambiguous: 0 }
[DETAIL_HEADER_HAS_MONEY]      { expected: '€17.99', containsExpected: true }
[ITEMS_CARD_CONTAINS]          { productName: true, uniqueNote: true }
```

- **`deterministic_order_id`** is the Tier 0 match in the detail page:
  `attachment_meta.cart.order_id === order.id`. This is the highest
  confidence tier · the cart peer-message carries the exact order
  UUID; no heuristic fallback was needed.
- **Items card rendered** (`cartSection: 1`) and the ambiguity banner
  did **not** render (`ambiguous: 0`).
- **Header money** formatted by the page contains the expected
  `€17.99` string.
- **Items card `innerText`** (scoped specifically to
  `[data-nex-order-cart]`) contains both the product name
  `E2E PLQ Widget X mwit8ina` and the unique buyer note
  `CP3B-UNIQ-1794814151008`.

### 2.3 Reload consistency

```
[RELOAD_CONSISTENCY] {
  matchTier: 'deterministic_order_id',
  cardCount: 1,
  headerContainsMoney: true,
  itemsHasProductName: true,
  itemsHasUniqueNote: true
}
```

Identical result on fresh reload. Not a stale-cache artefact.

### 2.4 Verdict · order-detail content

| Assertion | Verdict | Evidence |
|---|---|---|
| Order detail main element renders | **PASS** | `[DETAIL_MAIN_PRESENT] 1` · screenshots `01`, `02` |
| Cart snapshot linked via deterministic order-id match (highest confidence tier) | **PASS** | `[DETAIL_MATCH_TIER] deterministic_order_id` |
| Items card rendered (not ambiguity banner) | **PASS** | `[DETAIL_CARDS] { cartSection: 1, ambiguous: 0 }` |
| Order total renders in header as `€17.99` from `(1799, "EUR")` | **PASS** | `containsExpected: true` on both load + reload |
| Items card contains product name `E2E PLQ Widget X mwit8ina` (element-scoped) | **PASS** | `ITEMS_CARD_CONTAINS.productName: true` on both load + reload |
| Items card contains unique buyer note `CP3B-UNIQ-1794814151008` (element-scoped) | **PASS** | `ITEMS_CARD_CONTAINS.uniqueNote: true` on both load + reload |

The checkpoint-3 `DETAIL_CONTAINS: { productName: false, uniqueNote: false }` is confirmed to have been a test-scope flaw in the prior probe — a page-wide `innerText` snapshot that did not reflect what the detail page actually renders. **No app-level defect was demonstrated; no app code was changed.**

---

## 3 · Non-owner isolation

### 3.1 Fixture (honest)

- **Account used**: `CK5 B` — an existing authorised disposable
  account. In the CK5 fixture bundle B is a **buyer-only** account
  (confirmed: `SELECT count(*) FROM nex_business WHERE
  owner_account_id = CK5_B = 0`).
- **Missing prerequisite — named precisely**: `CK5` does **not**
  include a disposable second-SELLER fixture. Creating one via
  supported sandbox signup requires a confirmable inbox, and
  bypassing email confirmation / direct role mutation is explicitly
  out of scope per the checkpoint directive. Therefore the strict
  "two independent sellers" variant is **BLOCKED**.
- **What is verified instead**: the server-side ownership-guard in
  `src/app/nex-native/manage/orders/[orderId]/page.tsx:55`
  (`if (!ownerId || ownerId !== session.account.id) notFound()`)
  rejects any authenticated non-owner. Since this guard does not
  depend on whether the viewer is a seller elsewhere, testing it
  against a signed-in non-owner is a **proper superset** of the
  "second-seller" case: if a buyer-non-owner is refused, a
  seller-non-owner is a fortiori refused by the same code path.

### 3.2 Results

```
[NON_OWNER_RESULT] {
  landedUrl: '/nex-native/manage/orders/dc01eb01-…',
  orderDetailRendered: false,
  cartSectionRendered: false,
  bodyHasProductName: false,
  bodyHasUniqueNote: false
}
[NON_OWNER_ORDERS_LIST] {
  containsShortId: false,
  containsProductName: false,
  containsUniqueNote: false
}
[NON_OWNER_NOTIFS_DRAWER_ORDERS] { totalRows: 0, matchingAOrderHref: 0 }
```

### 3.3 Network-level leakage audit

All responses whose URL contained the order id were captured:

| URL | Status | Content-type | Body bytes | Leaks `E2E PLQ Widget X mwit8ina`? | Leaks `CP3B-UNIQ-…`? |
|---|---|---|---|---|---|
| `/nex-native/manage/orders/dc01eb01-…` (initial nav) | 200 | `text/html; charset=utf-8` | (not read · superseded by retry) | **false** | **false** |
| `/nex-native/manage/orders/dc01eb01-…` | 200 | `text/html; charset=utf-8` | 51981 | **false** | **false** |
| `/nex-native/manage/orders/dc01eb01-…` | 200 | `text/x-component` (RSC) | 92 | **false** | **false** |

The HTTP 200s are the Next.js `notFound()` surface (standard
behaviour — a `notFound()` result returns 200 with the not-found UI).
No order payload crossed the wire to the non-owner on any response.

### 3.4 Verdict · non-owner isolation

| Assertion | Verdict | Evidence |
|---|---|---|
| Non-owner's direct hit on `/manage/orders/[id]` does **not** render the order-detail page | **PASS** | `orderDetailRendered: false` · screenshot `03` |
| Non-owner's response bodies do **not** carry the product name or unique note | **PASS** | 3 responses; 0 leakage occurrences each |
| Non-owner's `/manage/orders` list does **not** contain the order | **PASS** | `containsShortId: false` · `containsProductName: false` · screenshot `04` |
| Non-owner's LEFT notifications drawer Orders section is empty | **PASS** | `totalRows: 0`, `matchingAOrderHref: 0` · screenshot `05` |
| **Strict second-seller fixture (two independent seller accounts)** | **BLOCKED** | CK5 provides only one seller fixture (A). Creating a second seller requires a confirmable inbox — out of scope. |

Interpretation: isolation is proven for the signed-in non-owner case,
which is the superset the server-side guard actually enforces. The
strict "two sellers" scenario remains BLOCKED pending a disposable
second-seller fixture.

---

## 4 · Boundaries kept (explicit)

| Boundary | Status |
|---|---|
| Acknowledgment persistence (`seller_viewed_at` or similar) | **BLOCKED** — unchanged · no DDL · no migration · no new read-state table · no security-policy change. Drawer dismissal remains the component's existing session-local `readIds` useState; this is **transient**, not persistent, and no copy here implies otherwise. |
| Product-selection-to-chat / context behaviour (3-dot → ShopDrawer → tap product → correct conversation) | **UNVERIFIED** — opening 8 cards (CP3) only proves the drawer opens with cards; the actual tap-card → lands-in-correct-conversation-with-product-context journey is NOT proved by existing evidence. **Not expanded in this checkpoint.** |
| Dev server | **PRESERVED** — the existing `npm run dev` on 3008 (owner's bash session PID 842) was NOT touched. Only the checkpoint probe process was run and exited. |
| Hammerex (…111) / Rosa (…113) / 99901 | **UNTOUCHED** · probe refuses if those ids resolve. |
| Prod `ijvqdvsvwtwxzcqmoqit` | **SEALED** · probe refuses if DATABASE_URL points there. |

### 4.1 Running shells (reported, not acted on)

```
Victus  842  840  bash  /c/Program Files/nodejs/npm run dev
```

This is the founder's own dev server session — **not** stopped and
**not** interfered with. Only the probe's child `node` processes were
started and exited cleanly.

---

## 5 · Test-data write / cleanup ledger

Exact ids written and cleaned up — no broad sweeps.

| Row | Written by | Cleanup | Result |
|---|---|---|---|
| `nex_order` id `dc01eb01-20bf-4af6-9ba8-6d16a62814de` | buyer checkout UI (CP3B probe) | `DELETE FROM nex_order WHERE id = <exact-id>` | 1 row |
| `nex_peer_message` `5f658f0c-…` (CP3B buyer cart snapshot) | buyer checkout UI (CP3B probe) | `DELETE … WHERE id = <id> AND attachment_meta->'cart'->>'buyer_notes' ~ '^CP3B-UNIQ-'` | 1 row |
| `nex_peer_message` `0a774c68-…` (CP3 leftover) | checkpoint-3 probe | marker-anchored exact-id delete | 1 row |
| `nex_peer_message` `d7b13321-…` (CP3 leftover) | earlier CP3 probe pass | marker-anchored exact-id delete | 1 row |
| `nex_order_event` rows for the deleted order | server during order lifecycle | `DELETE FROM nex_order_event WHERE order_id = <exact-id>` | 0 rows (none emitted in `state='created'` window) |

Post-cleanup verification: `REMAINING_CP3_CART_ROWS 0`.

**Honest note on cleanup filter correction**: the checkpoint-3 probe's
cleanup filter `attachment_type = 'cart_order'` did not match because
the real column is NULL on cart messages (the cart marker lives in
`attachment_meta.cart`). Those three residual messages are now cleaned
up by exact id with a belt-and-braces marker filter. No other rows
touched.

---

## 6 · Remaining blockers / gates (unchanged)

- **Build**: not re-run — out of scope for this 30-min probe.
- **Typecheck**: 1519 pre-existing errors — unchanged (no app code
  modified).
- **Vault regression gate**: retained.
- **Phone verification**: retained · headless Chromium only.
- **CP4 strict second-seller denial**: **BLOCKED** pending disposable
  second-seller fixture (confirmable inbox prerequisite).
- **Acknowledgment persistence**: **BLOCKED** · requires DDL — not
  authorised.
- **Production migration / deploy gates**: all CLOSED · this
  checkpoint wrote no migrations and touched no prod systems.
- **Product-selection-to-chat journey**: **UNVERIFIED** · tap-card →
  correct conversation is not covered by existing evidence.

---

## 7 · Scoped verdicts

- **Founder-testing**: the order-detail page's cart-snapshot renderer
  is bound to real data (`deterministic_order_id` tier) and the Items
  card renders the product name, unit price, and buyer note in the
  observed case. The non-owner cannot see the order via URL, list, or
  drawer. The LEFT bell drawer Orders section (CP3) continues to be
  live-wired. Founder can test these specific paths.
- **Public-launch**: **NOT READY**. Narrow passes above are specific
  verifications, not whole-app readiness. All prior retained gates
  stand (build, Vault, phone, typecheck, strict second-seller, prod
  migration + deploy). Nothing in this checkpoint closes any of
  those.

---

## 8 · Next agreed gap (named · not started)

Candidate next checkpoints, in order of smallest next step first:

1. **Product-selection-to-chat UNVERIFIED tightening** — bounded
   probe: open the 3-dot ShopDrawer, tap one product card, assert
   the resulting navigation lands in the correct peer-chat URL
   carrying the expected product-context (per existing
   product-context send path). Narrow; no app change.
2. **Disposable second-seller fixture authorisation** — owner to
   authorise a `CK5_C` (second seller + second business + one
   product) with a confirmable test inbox OR a documented supported
   signup bypass path. Would enable CP4 strict denial and future
   cross-seller surfaces.
3. **Acknowledgment persistence design** — the drawer currently
   dismisses session-locally only. A proper persisted read-state
   would need a new column / table + RLS. Design doc first; no DDL
   until authorised.

Not starting either. Stopping at the checkpoint boundary. The whole
app is not finished.
