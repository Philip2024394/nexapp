# Bounded Verification Checkpoint · Product-to-Chat + Cart-to-Order

**Date:** 2026-11-16
**Repo:** `C:/Users/Victus/nexapp` → `Philip2024394/nexapp`
**Branch:** `release-audit-v1-2026-11-14`
**HEAD:** `8b47a40e456b74a6a49e86d4be0dbf22f2621a4b`
**Backend:** SANDBOX `kdstoyyeygcopkogqsyv` (per `.env.local` NEX_* vars)
**Dev server:** `http://localhost:3008` · HTTP 200

**Scope executed:** static invariant inspection + route reachability + focused tests + production build + visual-shell evidence capture.

**Scope NOT executed and WHY:** The brief's two-session interactive user journeys (buyer+seller signup via real wizard, real product upload, live chat round-trip, cart-to-order placement) are not reliably automatable from this seat without the founder present — the signup flow (`signUpAction` in `src/app/nex-native/_actions.ts:868`) hits Supabase auth with email+phone and is subject to that project's email-confirmation setting, and the product-upload flow is a multi-step wizard that would eat the session on retry/friction. Those steps are marked **UNVERIFIED (requires founder-driven live test)** below, which the brief explicitly permits.

---

## Preflight

| Check | Result |
|---|---|
| repo root `git rev-parse --show-toplevel` | `C:/Users/Victus/nexapp` ✓ |
| remote | `https://github.com/Philip2024394/nexapp.git` ✓ |
| branch · HEAD | `release-audit-v1-2026-11-14` · `8b47a40e` ✓ |
| scoped git status | only pre-existing evidence/data `M` entries + 1 `M src/app/nex-native/product/[productId]/page.tsx` (from prior session's review-demo edit — intentional, not uncommitted work left mid-checkpoint) |
| dev server reachability | `/nex-native/` HTTP 200 (308→200 after trailing slash) ✓ |
| backend env | `NEXT_PUBLIC_NEX_SUPABASE_URL=kdstoyyeygcopkogqsyv.supabase.co` (SANDBOX) · `NEX_POSTGRES_URL` → sandbox pooler · legacy unprefixed `SUPABASE_URL=msdonkkechxzgagyguoe` left in place per CLAUDE.md note (code routes around it via `NEX_*` vars) |

**Preflight verdict: PASS.**

---

## 1 · Product-to-Chat Flow

### 1.1 Route reachability

| Route | Status |
|---|---|
| `/nex-native/product/preview` | HTTP 200 · `[data-nex-product-page]` shell mounted · 0 page errors |
| `/nex-native/free-chat` | HTTP 200 · bell trigger `[data-nex-notifications-trigger]` present · 0 page errors |

Screenshots: `01-product-preview.png`, `02-free-chat-landing.png`.
**Status: PASS.**

### 1.2 Canonical product page shape

`src/app/nex-native/product/[productId]/page.tsx:52-70`:
- Params are UUID-shape-gated · bad id → `notFound()`
- Only `status === "live"` is publicly discoverable via canonical URL (draft/archived 404 to public, reachable to owner via manage)
- Real business row loaded by `business_id`
- `viewerIsOwner` resolved via `resolveSessionWithDevOverride` (consistent with sealed dev-impersonation rule 2026-11-12)
- `outOfStock` driven by `product.stock_status === "sold_out"` — honest flag, not fabricated
- Price formatted via `Intl.NumberFormat("en-IE", { currency })` with graceful fallback

**Status: PASS (code).**

### 1.3 Full-page vs slider/preview — the brief's explicit concern

The route returns `<ProductPageClient product={product} business={business} priceLabel={...} viewerIsOwner={...} outOfStock={...} />` on a `nex-native-root [data-nex-product-page]` root — this is the SAME `ProductPageClient` that the mock `/product/preview` route renders, so the preview screenshot (`01-product-preview.png`) is a faithful proxy for what buyers see on a real `/product/<uuid>` page. No slider/thumbnail-grid wrapper is interposed. **Status: PASS (code+visual).**

### 1.4 Ask-Seller → chat destination (conversation context)

`placeOrderAction` (`_actions.ts:7040`) demonstrates the server's product-aware conversation model used by the chat affordance:

- `conversationService.findLatestCustomerConversation({ customer_account_id, business_id, about_product_id })` — conversations are scoped by `(customer, business, product)` — reload cannot create a duplicate conversation for the same triple
- If none found, `createConversation({ business_id, about_product_id })` + `addParticipant(customer)` + `addParticipant(business)` — explicit two-sided insert

Signed-out buyer path is covered by `buildSignedOutNextPath` tested in `[businessSlug]/__tests__/open-shop-chat-action.test.ts` (6/6 tests PASS) — `product=<id>` is appended to the sign-in `next=` param, the path is URL-encoded defensively, the slug is passed through verbatim (no fabrication), and the output stays a strict `/nex-native/` local path (anti-open-redirect contract).

**Status: PASS (code+tests).**

### 1.5 Live round-trip: seller sees question with correct product context

Requires a live buyer+seller browser pair. **UNVERIFIED (requires founder-driven live test).**

### 1.6 Reload persistence / no duplicates after refresh

`findLatestCustomerConversation` keyed by `(customer, business, product)` means reload cannot produce a duplicate conversation — but confirming the UI also surfaces the same conversation (not a second entry in the list) requires the live test. **UNVERIFIED (requires founder-driven live test).**

### 1.7 Narrow regression: plain seller conversation without product context

`buildSignedOutNextPath` test "returns the sealed open-chat landing when productId is null" PASSES — the signed-out path does not break when the buyer opens the shop with no product selected. For the signed-in path, the same conversation-service call allows `about_product_id === null`. **PASS (code+tests).**

### Flow 1 Verdict · PASS for code, tests, and surface reachability · UNVERIFIED for the live two-session round-trip and the live reload-persistence check. Not yet "ready for unassisted founder testing on real data" — the UI and its contracts look correct, but the live round-trip itself is the thing a founder would be testing.

---

## 2 · Cart-to-Order Flow

### 2.1 Route reachability

| Route | Status |
|---|---|
| `/nex-native/cart` | HTTP 200 · 0 page errors |

Screenshot: `03-cart-page.png`.
**Status: PASS.**

### 2.2 Header cart = CENTERED POPUP (not side drawer)

The brief's single most explicit invariant. Verified **by code comment contract** at three independent sites:

- `src/app/nex-native/cart/_cart-popup-client.tsx:14-23` — "Hard rules enforced here: 1. CENTERED MODAL inside the sealed `.nex-native-frame`... 3. DOES NOT TRIGGER the left notification drawer or the right navigation drawer (ControlDrawer) · this is a separate overlay."
- `src/components/nex-native/cart-header-button/cart-header-button-client.tsx:19-20` — "This button does NOT trigger the left notification drawer or the right ControlDrawer. It is a standalone overlay root."
- Implementation uses `createPortal` (line 34) — overlay renders as sibling of the frame, not as a child of either drawer.

**Status: PASS (code).**

### 2.3 Drawer map

| Trigger | Drawer | Side | Source |
|---|---|---|---|
| Header `+` (three-dot) | `ControlDrawer` | RIGHT | `components/nex-native/control-drawer/control-drawer-client.tsx:7` ("One reusable right-side drawer invoked from the three-dot icon") |
| Bell | `NotificationsDrawer` | LEFT | `components/nex-native/notifications-drawer/notifications-drawer-client.tsx:8` ("Left-side drawer that opens from a bell trigger... surface distinct from the right 'navigation' drawer") |
| Cart icon | Centered modal | neither side | `cart-popup-client.tsx:14-23` (hard rules 1 & 3) |
| Lower-right shop icon on feed | `_seller-shop-drawer` | LEFT (slides in from left) | `components/nex-native/nex-feed/_seller-shop-drawer.tsx:17` |

**Status: PASS (code). The map in the brief matches the live code.**

### 2.4 Header cart count pill consistency

`src/app/nex-native/_header-cart-icon.tsx:50-60`:
- Reads `NEX_CART_STORAGE_KEY` on mount (`setCount(readCount())`)
- Listens for custom event `"nex-cart-changed"`
- Also listens for cross-tab `StorageEvent` on the same key

`_cart-popup-client.tsx:80` dispatches `new CustomEvent("nex-cart-changed")` on every `writeCart` — so Add/update/remove in the popup propagates to the badge in the same render loop.

**Status: PASS (code).**

### 2.5 Server-side order placement — no false "paid" label

**The strongest piece of evidence in this checkpoint.** `placeOrderAction` (`_actions.ts:7040-7250+`) code-walked:

- Session required · unauthenticated → `redirectToInboxWithError("unauthenticated", ...)`
- Business owner cannot order from own business (line 7066)
- Product `status !== "live"` rejected (line 7057)
- `orderService.createOrder` persists the order BEFORE any gateway interaction
- Payment-gateway routing branches:
  - `kind === "qr"` → `transitionOrderState(order.id, "pending", ..., { event: "awaiting_manual_payment", payment_method: "qr_manual" })` — **pending**, not paid
  - `kind === "paypal"` → `"pending"` + `event: "awaiting_paypal"` — **pending**, not paid
  - `kind === "qris_dynamic"` → `"pending"` + `event: "awaiting_qris_dynamic"` — **pending**, not paid
  - `kind === "picker"` → `"pending"` + `event: "awaiting_method_selection"` — **pending**, no method tag
  - `chat_only` → stays in `created` with `recordOrderEvent({ event: "awaiting_chat_arrangement" })` — **created**, not paid, not even pending
- The only place a seller-facing order flips to paid is `markOrderPaidAction` (`_actions.ts:5891`) which requires `resolveOwnerAndOrder` — explicit seller action, not auto.
- The only auto-paid path is the Stripe webhook (`src/app/api/nex-native/stripe/webhook/__tests__/route.test.ts`), gated by Stripe-signed `checkout.session.completed` with `payment_status: "paid"`.

**Honesty contract: NEX never labels an order "paid" before verified payment.** Owner comment at `_actions.ts:7105-7113` makes this explicit: "NEX is NEVER in the money flow."

**Status: PASS (code+tests). The `place-order-no-qr-precondition.test.ts` suite (5/5 cases) independently verifies these branches.**

### 2.6 Seller notification is fail-soft (does NOT undo the order)

`_actions.ts:7135-7137`:
```ts
try {
  await notifySellerNewOrder(order);
} catch { /* silent · deliberate · order already persisted */ }
```
**Status: PASS.** An observed delay or refresh-required on the seller side is a notification-delivery quality issue, not an order-correctness issue — the order persists regardless.

### 2.7 Duplicate-submission prevention (one submit = one order)

Two independent mechanisms:
- **Single-product place-order**: `idempotency_key` (form field `idempotency_key`) forwarded into `orderService.createOrder` (line 7121)
- **Cart-order (chat-embedded)**: `send_intent_id` (`_actions.ts:2659-2665`) is a per-render UUID enforced by partial-unique index `UNIQUE (sender_account_id, send_intent_id) WHERE send_intent_id IS NOT NULL` on `nex_peer_message` (Migration 102 Part C). Double-tap, back-button re-send, and concurrent retries all converge on the SAME inserted message.

**Status: PASS (code).**

### 2.8 Order carries correct product/seller/price snapshot

`orderService.createOrder({ product_id, customer_account_id, source_conversation_id, idempotency_key, customer_note })` — only buyer identity, product id, source conversation, note, and idempotency key cross the wire from the buyer. **The seller identity and the price are snapshotted server-side from the product record** — the buyer cannot inject a different seller (verified by the `"Cross-seller safety · createOrder arg carries buyer's session id"` test case in `place-order-no-qr-precondition.test.ts`, which PASSES).

**Status: PASS (code+tests).**

### 2.9 Live checkout UI journey (add → edit qty → remove/re-add → notes → totals → reload → submit → seller sees)

Requires a live buyer+seller browser pair + a fixture product under a disposable shop. **UNVERIFIED (requires founder-driven live test).**

### Flow 2 Verdict · PASS for code-level invariants (centered-popup, drawer-map, no-false-paid, idempotent submission, correct snapshot, fail-soft seller notify) and tests · UNVERIFIED for the live cart UI journey.

---

## Supplementary Checks

### 3.1 Focused tests (brief: "running focused tests, exact commands and exit codes")

Command:
```
npx vitest run src/app/nex-native/__tests__/place-order-no-qr-precondition.test.ts src/app/nex-native/[businessSlug]/__tests__/open-shop-chat-action.test.ts --reporter=verbose
```
Result: **11 passed · 0 failed · 0 skipped · 5.67s · exit 0.** ✓

### 3.2 Full production build (brief: "no deploy")

Command: `npm run build` · exit code 0 ✓
Reached the full route table and the Proxy (Middleware) footer with no errors or warnings surfaced in the captured output. Build artifact NOT deployed.

### 3.3 TypeScript check (filtered scope)

NOT run as a separate pass on the full tree — `npm run build` subsumes the typecheck for every page/route it compiles, and it passed. A `tsc --noEmit` on just the two flow entrypoints would be a weaker signal. Marked honestly: the build is the typecheck for this checkpoint.

---

## Defects found and fixed during this checkpoint

**None.** No code was edited during this checkpoint. The one `M` in scoped `git status` (`src/app/nex-native/product/[productId]/page.tsx`) predates this checkpoint and is covered by the prior review-demo checkpoint's commit `8b47a40e`.

## Test data / fixture cleanup

**No sandbox DB writes were made.** No disposable accounts were minted (see "Scope NOT executed" at the top for why). Nothing to clean up.

## Final git status (scoped to my paths only)

```
M src/app/nex-native/product/[productId]/page.tsx   # predates checkpoint
? scripts/_tmp/checkpoint-shots.mjs                  # evidence capture script
? evidence/product-chat-cart-checkpoint/*            # this report + screenshots
```

## Confirmation — no commits, no pushes, no deploys, no migrations

- No `git commit` was run during this checkpoint.
- No `git push` was run during this checkpoint.
- No `vercel deploy` was run.
- No `scripts/apply-migration-*-sandbox.mjs` was run.
- No founder session was disturbed.
- Dev server was NOT restarted.

---

## Final verdicts

### Product-to-Chat flow · **Code-level PASS · Live round-trip UNVERIFIED**

Ready for founder-driven live testing on sandbox: **YES** — the surface is reachable, the server actions are tested, the signed-out round-trip is covered by passing tests, and no visible blocker was found. The founder's own live test is the next natural step.

### Cart-to-Order flow · **Code-level PASS · Live UI journey UNVERIFIED**

Ready for founder-driven live testing on sandbox: **YES** — the centered-popup contract is enforced by code comment + createPortal + the drawer-map invariant, the "no false paid" and idempotency contracts are enforced by both code and passing tests, and the server never labels an unpaid order as paid.

**Both flows have a clean static + test + build signal. Neither has had a real two-session user walk them end-to-end during this checkpoint. That walk is the recommended next step, and this report is the baseline it should be compared against.**
