# X-Rated Tool Belts · Owner-Quoted Chat Checkout · Build Plan
## 2026-11-28 · gap analysis + implementation sequencing · author Claude

Owner directive (summary): replace automatic Wise checkout for X-Rated with
chat-based ordering. Customer checkout emits a structured ORDER REQUEST into
the existing X-Rated NEX Chat conversation. Owner manually calculates
delivery, composes a quotation, customer accepts/declines, bank transfer to
owner-configured multi-currency Wise destinations, customer uploads receipt,
owner verifies manually, then processes/dispatches/adds tracking. No
automatic fulfilment. No payment before accept. Thirteen status states.
Multi-currency Wise destinations owner-managed. Receipts never auto-mark
paid. Private storage. Preserve E2E encryption. Inspect before build. Reuse.

This doc is the inspection + gap-analysis product. **No code is changed and
no migration is drafted yet.** Owner approval is requested at the end for
the specific migration + commit scope.

---

## 1 · What already exists (inspection summary)

### 1.1 · Chat + encrypted messaging
- `nex_conversation` + `nex_conversation_participant` (migration 004)
  provide the business↔customer thread used by every shop.
- `nex_message` carries E2E encryption columns (`ciphertext bytea`,
  `nonce bytea`, `sender_public_key`, `sender_device_id`,
  `recipient_device_id`, `message_group_id`, `delivery_status`) added in
  migration 345. Content is never readable server-side.
- `nex_peer_message` (separate peer-chat table) carries the
  `attachment_type` CHECK extended multiple times; current enum after
  migration 355 (`order_reference` added) is:
  `image · video · audio · product · menu_item · cart_order ·
  product_share · sticker · link_preview · document · call_invite ·
  order_reference`.
- Private bucket `nex-peer-chat-ciphertext` with signed-URL
  participation check already used for attachments.

### 1.2 · Shop → chat handoff (Bridge 22 · 2026-09-28)
- `cart_order` attachment type already exists. Shape of
  `attachment_meta.cart`:
  - `shop_id`, `shop_slug`, `shop_display_name`
  - `items: [{kind, id, name, price_pence, currency, quantity,
    variants, note, image_url}]`
  - `buyer_notes`, `subtotal_pence`, `currency`, `item_count`
- `sendCartOrderAction` server action at
  `src/app/nex-native/_actions.ts:3133`:
  - session + idempotency (`send_intent_id` UUID shape)
  - fail-closed server-side price re-fetch per line
  - cross-shop ownership rejection
  - strict typed delivery-quote validation (free / estimate / unknown)
  - R4 export multi-unit refusal
  - neutral buyer-facing errors; diagnostics server-side only

### 1.3 · Orders + state machine
- `nex_order` created in migration 005 · state machine trigger in
  migration 007 · six states: `created · pending · paid · completed ·
  cancelled · refunded` · transitions enforced server-side.
- `nex_order` has `delivery_address`, `delivery_quote`,
  `subtotal_pence`, `payment_method_hint`, `payment_confirmed_at`
  (migration 355 Phase A). Writers are Phase B (not yet switched).
- `nex_order_event` append-only audit log.
- Merchant orders list at `src/app/nex-native/manage/orders/page.tsx`
  (uses `orderService.searchOrders`, reuses sealed RLS).
- Merchant order detail at
  `src/app/nex-native/manage/orders/[orderId]/_client.tsx` (867 lines,
  not yet inspected in detail — reused as drawer host).
- Notification service at
  `src/lib/nex-native/manage-orders/order-notification-service.ts`:
  lock-screen push carries only generic sentence (never order id,
  amount, party, items, address).

### 1.4 · Wholesale precedent
- `src/lib/nex-native/wholesale/`: `actions.ts`, `quote-service.ts`,
  `approval-service.ts`, `payment-gate.test.ts`,
  `initiate-order.test.ts`, `approval-service.test.ts`. This is the
  closest existing pattern for owner-quoted ordering (merchant
  prepares a quote → customer accepts → payment gated on acceptance).
  **Reuse likely: quote lifecycle naming, approval service shape,
  payment gate pattern.**

### 1.5 · X-Rated identity
- Resolved via slug `x-rated-tool-belts` through `getBusinessBySlug`.
- No hard-coded UUID anywhere. Per-shop behaviour must be toggled by
  a `nex_business` column (or an entitlement row), not a slug match in
  code.

---

## 2 · Gap analysis against directive (9 sections)

| §   | Directive requirement                                                                  | Covered by existing | Gap                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| §1  | Customer checkout opens NEX Chat, emits structured ORDER REQUEST                       | ~60% (Bridge 22 `cart_order`) | **A.** per-shop `chat_quote_only` flag to divert X-Rated checkout away from Wise and into the chat-only path. **B.** possibly rename `cart_order` → `order_request` OR add a `mode: 'request'` field inside `attachment_meta.cart` to disambiguate from legacy auto-fulfilment carts. |
| §1  | Preserve basket + order across returns                                                 | partial             | existing `nex_cart` (migration 078) + localStorage mirror cover this; verify survives sign-out + re-entry.                              |
| §1  | Any quantities including wholesale                                                     | partial             | Bridge 22 cart_order caps per line at 999. Wholesale actions.ts handles bulk. Decision: let the chat path accept same cap, defer true wholesale to `wholesale/`. |
| §2  | Owner inbox with manual delivery calculation fields                                    | partial             | merchant order detail exists; fields for weight/dims/courier/method/tracking don't. **C.** extend `nex_order` with nullable `merchant_delivery_calc` JSONB (weight_kg, length_cm, width_cm, height_cm, courier, method, tracking_code, notes). |
| §3  | Quotation composer                                                                     | gap                 | **D.** `nex_order_quote` table (order_id FK, confirmed_products_total_pence, delivery_cost_pence, additional_charges jsonb, final_total_pence, currency, expected_dispatch_at, version, status, created_at, created_by_account_id). OR simpler: `attachment_type='order_quote'` emitted into the chat, latest version wins. |
| §4  | Customer accept / decline / question                                                   | gap                 | **E.** customer-side quotation UI inside chat; accept/decline server action; revised quotation produces new quote version requiring new acceptance. |
| §5  | Multi-currency Wise destinations owner-configured                                      | gap                 | **F.** `nex_business_wise_account` table (business_id, currency, holder_name, bank_name, iban_or_account, bic_swift, routing_number, reference, is_active, created_at, updated_at). Owner-only CRUD via server action; never stores Wise login secrets; verify no client exposure of inactive rows. |
| §5  | Customer uploads bank transfer receipt via order conversation                          | partial             | reuse `nex-peer-chat-ciphertext` bucket. **G.** add `payment_proof` attachment_type; store in bucket with existing signed-URL participation check. |
| §5  | Receipt NEVER auto-marks paid                                                          | reinforced          | owner-only manual verification action required.                                                                                           |
| §6  | 13-state status machine                                                                | partial             | **H.** extending `nex_order.state` CHECK from 6 → 13 breaks the sealed migration 007 trigger. Preferred: **keep `nex_order.state` as-is (coarse billing-safe states), track fine states in `nex_order_event.kind`** (append-only; already designed for this). Map coarse ↔ fine: `order_request_received/awaiting_delivery_quotation/quotation_sent/awaiting_customer_acceptance/quotation_accepted/awaiting_payment` ⇒ `created`; `payment_proof_received/payment_verified` ⇒ `pending→paid` (pending while unverified, paid only on manual verify); `processing/dispatched/tracking_information_added` ⇒ `paid`; `delivered` ⇒ `completed`; `declined_or_cancelled` ⇒ `cancelled`. |
| §7  | Merchant controls: review/edit/revise, courier, messages, confirm payment, update status, tracking, cancel-with-reason | partial | **I.** merchant quote composer UI on `/manage/orders/[orderId]`; actions for revise/accept-payment/cancel-with-reason; tracking already supported in migration 032. |
| §8  | Security: X-Rated-only, no fund-holding, no stored Wise secrets, private receipts, dedup, server-side price validation, E2E preserved | mostly in place    | per-shop gate via **A.** flag; E2E preserved because quote + receipts ride the encrypted chat; server-side price validation already enforced in `sendCartOrderAction`; dedup via existing `send_intent_id` UUID + a new `nex_order.idempotency_key` for the quote path. |
| §9  | Inspect first, reuse, test 11 scenarios, sandbox data only, commit to dev branch        | this doc            | inspection done; 11-scenario journey matrix defined in §4; standing 2026-11-27 policy authorises dev-branch commit+push once plan approved; sandbox-only; **no prod**, **no live-payment**, **no mig apply without named phrase**. |

---

## 3 · Proposed build (three implementation cycles)

### Cycle 1 · schema + structured chat message + checkout handoff
Schema (one migration, sandbox-apply gated):

- `nex_business.checkout_mode` TEXT NOT NULL DEFAULT `'auto'` CHECK `('auto','chat_quote_only')`.
- extend `attachment_type` CHECK to add `order_request`, `order_quote`, `payment_proof` (keep `cart_order` + `order_reference` for continuity).
- `nex_business_wise_account` table (fields in gap row §5).
- `nex_order.merchant_delivery_calc` JSONB (nullable).
- `nex_order_event.kind` CHECK extended to add the 13 fine-grained kinds (migration documents the fine↔coarse mapping).

Code:
- flip `sendCartOrderAction` so when target business `checkout_mode === 'chat_quote_only'`, it emits an `order_request` attachment into the existing conversation (never calls the auto-fulfilment path).
- insert a row into `nex_order` with `state='created'` + fine event `order_request_received`.
- preserve existing cart server-side price re-fetch, ownership rejection, idempotency.

Tests:
- unit: attachment emission for `chat_quote_only` ≠ `auto`.
- unit: `nex_order_event.kind` CHECK accepts new kinds.
- unit: Wise account CRUD owner-gated (seller-only; buyer fetch of inactive rows returns nothing).

### Cycle 2 · merchant quote composer + customer accept/decline
Code:
- extend `/manage/orders/[orderId]` with merchant quote composer form:
  - confirmed products total (pre-filled from order subtotal)
  - delivery method (free-text) · delivery cost · additional charges rows (label + amount) · final total (computed + editable) · currency · expected dispatch date
- server action `sendOrderQuote` emits `order_quote` attachment into the chat and records a `nex_order_event` of kind `quotation_sent`.
- customer chat renders `order_quote` bubble with Accept / Decline / Ask Question buttons:
  - Accept → server action records `quotation_accepted` event; sets order ready for payment (coarse state stays `created`; fine state advances).
  - Decline → `declined_or_cancelled`; order transitions to `cancelled`.
  - Ask Question → normal encrypted chat message, no state change.
- revised quote emits a new `order_quote` version; acceptance resets.

### Cycle 3 · payment proof + manual verification + dispatch
Code:
- customer payment-proof uploader inside the chat conversation (writes to `nex-peer-chat-ciphertext` bucket, emits `payment_proof` attachment). Records `payment_proof_received` event. Coarse state advances `created → pending`.
- merchant payment-verification action (owner-only): records `payment_verified`; coarse state advances `pending → paid`.
- merchant dispatch panel wires existing `dispatch-service.ts` + `032_nex_order_tracking.sql`. Records `processing`, `dispatched`, `tracking_information_added`.
- customer `delivered` confirmation action (or merchant-side). Coarse state advances `paid → completed`.
- cancel-with-reason: owner only, allowed at any pre-paid stage.

Notifications:
- extend `order-notification-service` kinds with: `order_request_received`, `order_quote_sent`, `order_quote_accepted`, `order_payment_proof_received`, `order_payment_verified`, `order_dispatched`, `order_tracking_added`.
- lock-screen wording stays generic per sealed privacy contract.

---

## 4 · Journey verification matrix (directive §9 → 11 scenarios)

| #   | Scenario                                       | Entry                     | Expected outcome                                                   |
| --- | ---------------------------------------------- | ------------------------- | ------------------------------------------------------------------ |
| 1   | Single set order                               | buyer adds 1 set to cart | ORDER REQUEST in chat; order row created; merchant inbox shows it |
| 2   | Multiple same product                          | buyer adds qty 5         | subtotal correct; items array single line with qty=5               |
| 3   | Individual products                            | buyer adds 3 different items | items array length 3 with distinct ids                         |
| 4   | Mixed items                                    | mix of product + menu_item | both kinds survive validation                                    |
| 5   | Large bulk order                               | buyer adds qty 50        | not clipped; wholesale threshold respected                         |
| 6   | Owner sends quote                              | merchant composer        | `order_quote` attachment in chat; fine event recorded              |
| 7   | Owner revises quote                            | 2nd quote same order     | both versions in chat; acceptance resets                           |
| 8   | Customer declines                              | buyer taps Decline       | coarse state cancelled; event `declined_or_cancelled`              |
| 9   | Customer uploads bank receipt                  | buyer uploads JPG        | stored in `nex-peer-chat-ciphertext`; `payment_proof` event       |
| 10  | Owner verifies payment                         | owner-only action        | `payment_verified`; coarse state pending → paid                   |
| 11  | Owner marks dispatched + tracking              | dispatch panel           | `dispatched` + `tracking_information_added` events; tracking code visible to buyer |

Each scenario produces: (1) screenshots (sandbox), (2) `nex_order` row state, (3) `nex_order_event` trail, (4) notification kind fired (non-sensitive payload verified).

---

## 5 · Boundaries preserved

- Production Supabase (`ijvqdvsvwtwxzcqmoqit`) sealed — **no prod access**.
- No live Stripe / PayPal activation.
- No main / release-branch push; dev-branch only per 2026-11-27 standing policy.
- No prod migration apply.
- Sandbox migration apply requires named approval phrase (per Rule 7). Proposed phrase for approval: **"APPROVE X-RATED CHAT CHECKOUT SANDBOX APPLY 2026-11-28"**.
- No Wise login/API secrets stored (only receiving-account display fields).
- Private storage retained for receipts; no public URL path.
- No bypass of RLS / E2E / auth / account isolation / payment protections.
- Other merchants untouched — the `checkout_mode='auto'` default preserves current behaviour.

---

## 6 · Approval requests

Owner, please approve or amend any of the following before Cycle 1 begins:

1. **Migration scope above** (single file: new column `checkout_mode`, extended `attachment_type` CHECK, new table `nex_business_wise_account`, new JSONB column `nex_order.merchant_delivery_calc`, extended `nex_order_event.kind` CHECK). Say: **APPROVE X-RATED CHAT CHECKOUT MIGRATION PLAN** to proceed to draft (still not apply).
2. **Fine-state strategy**: track 13 directive states in `nex_order_event.kind`, keep 6 billing-safe coarse states in `nex_order.state`. Alternative: extend coarse states — more invasive, touches sealed migration 007 trigger. Confirm choice.
3. **Attachment naming**: new `order_request` separate from legacy `cart_order`, OR reuse `cart_order` with a `mode` flag inside `attachment_meta.cart`. Confirm.
4. **Sandbox apply phrase** (§5): confirm or reword.
5. **Commit scope per cycle** (standing 2026-11-27 policy covers dev-branch commit+push once approved — no per-cycle re-approval of source control needed beyond cycle-end report).

Nothing in the gap/plan touches live customers, live payments, main branch, prod DB, or stored secrets. On approval of items 1-4 above, Cycle 1 begins.
