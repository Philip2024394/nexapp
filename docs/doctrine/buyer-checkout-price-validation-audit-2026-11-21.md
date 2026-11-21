# NEX Buyer-Checkout Server-Side Price Validation Audit · 2026-11-21

Scope · forensic read-only audit of every buyer checkout entry
point in nexapp against the trust-the-client threat model. This is
Phase 2 Remediation priority 3 (P2-03) per the sealed 2026-11-09
priority order. The concern · a buyer client crafts a request with
tampered price / fare / discount values · does any server code use
those numbers for a `nex_order` write, a Stripe Checkout Session
amount, or seller-earnings computation?

Audit root · `C:/Users/Victus/nexapp`
Repo · `Philip2024394/nexapp` · branch `release-audit-v1-2026-11-14`
HEAD at audit time · `c19fc8e0`

Posture in one line · **every buyer checkout path re-derives money
fields server-side.** Zero VIOLATION. Zero AT-RISK. Five entry
points audited.

Two of the agent's claims were spot-verified by direct Read before
publication ·

- `src/lib/nex-native/order-service.ts` lines 65-122 ·
  `createOrder()` calls `getProductById` on line 67, throws if
  missing, writes `price_pence: product.price_pence` on line 110.
  The anti-fabrication posture is explicit in the file preamble
  (lines 7, 61-62, 100-102).
- `src/app/api/nex-native/billing/checkout/buyer/route.ts` lines
  226-289, 326-339 · request `items` carry only `productId` and
  `quantity`. Server fetches each product, verifies ownership
  (`business_id` match line 233), rejects non-live products
  (line 239), rejects out-of-range price (line 268). Stripe
  `line_items` are built from `resolvedItems` only (line 327).
  Idempotency fingerprint uses server-resolved values so the
  client cannot pre-bind a tampered session (line 338-339).

---

## Compliance scorecard

| Entry point | Money-field verdict |
|---|---|
| `POST /api/nex-native/billing/checkout/buyer` | COMPLIANT (server re-derives) |
| `POST /api/nex-native/billing/checkout/shop` | COMPLIANT (price ID from env, not request) |
| `_actions.ts` · `sendCartOrderAction` | COMPLIANT (server re-derives · client price absent) |
| `_actions.ts` · `placeOrderAction` | COMPLIANT (server re-derives · client price absent) |
| `order-service.ts` · `createOrder` | COMPLIANT (price snapshotted from product record) |

No launch-blocker for P2-03. Code already enforces the prohibition.

---

## 1 · Threat model being tested

A malicious buyer client crafts an HTTP request that includes a
money-bearing field · `price_pence`, `unit_price_pence`,
`subtotal_pence`, `delivery_quote.fare_pence`, `direct_price.discount_pct`.
The server should either ·

- never read the field at all (shape-level rejection); or
- re-derive the authoritative value from the DB and overwrite /
  reject the request if the two disagree.

The failure mode we're looking for · a money field flows from
`request.body` to `nex_order.*` / Stripe Checkout Session `amount` /
`nex_order_item.unit_price_pence` / seller-earnings computation
without an intervening authoritative lookup.

---

## 2 · Entry point inventory

### 2.1 · `POST /api/nex-native/billing/checkout/buyer`

File · `src/app/api/nex-native/billing/checkout/buyer/route.ts`

Request shape · `{ businessId, items: [{ productId, quantity }], successUrl?, cancelUrl? }`.

The request **does not carry any money field**. `quantity` is
bounds-checked to `[1, 999]` on line 118. For each item ·

1. `productService.getProductById(item.productId)` · line 226
2. Reject if missing · line 227
3. Reject if `product.business_id !== body.businessId` · line 233
4. Reject if `product.status !== "live"` · line 239
5. Reject if `product.stock_status === "sold_out"` · line 250
6. Reject if currency not in `ALLOWED_CURRENCIES` · line 257
7. Reject if `product.price_pence` out of integer-range or above
   `MAX_UNIT_AMOUNT_MINOR` · line 268
8. Push `{ productId, name, amountMinor: product.price_pence,
   currency, quantity }` into `resolvedItems` · line 282

Stripe Checkout Session · `line_items` map is built from
`resolvedItems` on line 327. `unit_amount` is `product.price_pence`
from DB. Idempotency key fingerprint hashes server-resolved
values on line 339 so a client can't pre-bind a session with a
tampered price.

Verdict · COMPLIANT. No client money field exists.

### 2.2 · `POST /api/nex-native/billing/checkout/shop`

File · `src/app/api/nex-native/billing/checkout/shop/route.ts`

Request body · empty. Region is resolved from request headers.
The Stripe price id is looked up from an env var per region on
lines 57-72 (`NEX_STRIPE_PRICE_SHOP_<CCY>_MONTHLY`). `quantity: 1`
is hardcoded on line 175.

Verdict · COMPLIANT. No price surface is exposed to the client.

### 2.3 · `sendCartOrderAction()` in `_actions.ts`

File · `src/app/nex-native/_actions.ts` · lines ~2818–4016

Request shape · FormData with a `cart_payload` JSON. Items carry
`id` + `quantity` but **not a price**. The payload does carry a
client-claimed `delivery_quote.fare_pence` (lines 3015-3022) and
can carry `delivery_address`.

Price per item · fetched inside the action loop ·

- `productService.getProductById(id)` · line 3166
- `menuService.getMenuItemById(id)` · line 3231
- `price = product.price_pence` · line 3183
- `price = menuItem.price_pence` · line 3246

Subtotal · computed from server-resolved prices on line 3306 ·
`subtotal += price * quantity`. No client subtotal field read.

Delivery quote · the client-claimed fare is re-validated ·

- Rate-card bike fare path · server haversine on lines 3469-3474,
  `estimateBikeFare(authoritativeKm)` on line 3484, mismatch
  rejects the cart on line 3485.
- Per-ring local quote · `quoteLocalDelivery()` recomputed on
  line 3408, `isSubmittedLocalQuoteAuthentic()` guard on line 3442,
  mismatch rejects with "Delivery fare does not match this shop's
  rate card" on line 3454.
- `kind: "free"` / `kind: "unknown"` pass through but are metadata
  only · never used for pricing in the order row.

Discount · the client **does not** submit `discount_pct`. The
server calls `ladderSvc.resolveAppliedDiscountForBuyer(buyerAccountId,
shopId)` on line 3508 which refetches the ladder + buyer progress
rows and recomputes the applied percentage.

Snapshot written to `nex_peer_message.attachment_meta.cart` (lines
3560-3573) · all monetary fields are server-resolved. This is also
the Prohibition-5 violation flagged by the P2-01 audit · the
remediation path for that is Path A separation, not price-trust.

Order row written via `createOrder()` on lines 3859-3880 · the
action passes `product_id` only, not a price. The service snapshots
price from the product record.

Verdict · COMPLIANT on price trust. The separate Prohibition-5
concern about embedding PII in the snapshot is tracked in P2-01.

### 2.4 · `placeOrderAction()` in `_actions.ts`

File · `src/app/nex-native/_actions.ts` · lines ~7774-7920

Request · FormData with `product_id` and optional `customer_note`.
No price field present.

Flow · fetch product by id (line 7801) · require `live` status
(line 7805) · verify ownership via business lookup (line 7809) ·
delegate to `orderService.createOrder` (line 7865) passing only
`product_id`.

Verdict · COMPLIANT.

### 2.5 · `order-service.createOrder()` in `order-service.ts`

File · `src/lib/nex-native/order-service.ts` · lines 65-154
(spot-verified)

Flow ·

1. `getProductById(input.product_id)` · line 67
2. Throws with explicit anti-fabrication message if missing ·
   line 69-72
3. Idempotency dedup before INSERT · line 74-83
4. Normalise `customer_note` with hard cap at 500 chars · line 85-98
5. INSERT with `price_pence: product.price_pence` (line 110) and
   `currency: product.currency` (line 111) · never from input

Race safeguard · on `23505` unique-violation of `idempotency_key`
the service re-reads and returns the existing row (line 126-132).
No double-insert.

Verdict · COMPLIANT. File-level docstring states ·
> Anti-fabrication · price/currency SNAPSHOTTED at creation from
> real product record · never invented.

---

## 3 · Red-flag sweep · zero matches

| Red flag | Status |
|---|---|
| Money field read from request body and written to `nex_order.price_pence` without DB lookup | Not found |
| Money field read from request body and passed to Stripe `unit_amount` without server recompute | Not found |
| Client `delivery_quote.fare_pence` used in order without re-verification | Not found · guarded by two independent recompute paths |
| Client `discount_pct` applied without ladder recompute | Not found · client does not submit discount |
| Idempotency key built from client fingerprint (pre-bind risk) | Not found · fingerprint uses server-resolved values |
| `trust: "client"` sentinel or known-issue comment on a money field | Not found · comments document VALIDATED or IGNORED posture |
| Seller-earnings path reading client amount | Not found · earnings derive from webhook-confirmed paid amount in a later phase |

---

## 4 · Why this is the state it is in

The code shows an explicit anti-fabrication doctrine authored into
`order-service.ts` (file preamble on line 7). The checkout/buyer
route carries an inline comment "build Stripe line_items from
SERVER-RESOLVED values (never client)" on line 326. The cart-order
action's delivery recompute paths use plain-English reject
messages ("Delivery fare does not match this shop's rate card")
rather than silently accepting the client value.

This is intentional discipline, not accidental compliance.

---

## 5 · What this audit does NOT prove

The 5-state model requires each claim's state be read off actual
evidence ·

- Code path analysis · verified by read.
- Unit / integration tests for the trust-the-client threat ·
  **not** confirmed by this audit. If there is a test case where a
  forged `price_pence` is POSTed and must be rejected, it should
  live under a route test file that was not surveyed here.
- Live-verified (production e2e with a crafted tampered request) ·
  owner infra call per sealed 2026-11-08.

Recommendation · P2-08 (HTTP route tests · priority 8 in the
sealed order) should add explicit tests for the following ·

1. POST `/billing/checkout/buyer` with a non-existent `productId`
   → 404.
2. POST `/billing/checkout/buyer` with a `productId` from a
   different `businessId` than the request → 400
   `product_business_mismatch`.
3. `sendCartOrderAction` with a client `delivery_quote.fare_pence`
   that differs from the authoritative recompute by one pence →
   cart rejected.
4. `sendCartOrderAction` with a client payload asserting a lower
   `direct_price.discount_pct` than the ladder would return →
   discount ignored · ladder-recomputed value used.

These tests would convert the code-read verdict (Verified via
reading) into Verified via automated enforcement. That is a P2-08
deliverable, not a P2-03 blocker.

---

## 6 · Evidence pointers

Code consulted ·

- `src/app/api/nex-native/billing/checkout/buyer/route.ts`
- `src/app/api/nex-native/billing/checkout/shop/route.ts`
- `src/app/api/nex-native/billing/checkout/route.ts`
- `src/app/nex-native/_actions.ts` (lines 2818-4016, 7774-7920)
- `src/lib/nex-native/order-service.ts` (lines 65-154)
- `src/lib/nex-native/ladder-service.ts` (discount recompute surface)

---

## 7 · Readiness classification

| Area | State |
|---|---|
| Server re-derives money fields on every buyer checkout path | Built · Wired · Verified (code read) |
| Delivery quote re-validated server-side | Built · Wired · Verified |
| Discount recomputed server-side from ladder | Built · Wired · Verified |
| Automated tests for the trust-the-client threat | Not yet built (P2-08 scope) |
| Live-verified against an actual forged request | Not performed (owner infra call) |

Engineering ceiling reminder · no finding here may be promoted to
Live-verified. That remains an owner infra call per sealed
2026-11-08.
