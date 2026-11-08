# NEX · Chat/Order Data-Separation Proposal · 2026-11-08 (Round 30)

## ALL 6 DECISIONS SEALED BY OWNER · 2026-11-09

The six OWNER DECISION items raised by Section 6 of this proposal were
sealed by Philip on 2026-11-09. Authoritative record:
`C:\Users\Victus\.claude\projects\C--Users-Victus\memory\project_nex_chat_order_separation_sealed_2026_11_09.md`

Summary of sealed outcomes:

- **#1 Separation direction** · YES
- **#2 Schema path** · Path A (new `nex_order_item` child table +
  5 added columns on `nex_order`)
- **#3 Backwards compatibility** · four-phase staged migration · no
  destructive cutover
- **#4 `cart_order` deprecation** · remove only in Phase D after
  monitoring confirms zero legacy renderer hits
- **#5 Privacy Policy wording** · refined draft sealed below ·
  MUST NOT be published until implementation is verified to match
- **#6 Analytics continuity test** · required before Phase B→C
  cutover · fail-closed if KPIs differ

**Sealed Privacy Policy wording (DRAFT · non-publishable until verified):**

> NEX Chat is designed to keep private conversations and chat
> attachments on your device. NEX stores separate order records
> needed to support purchases, including delivery details and the
> payment method the buyer selected. NEX does not collect or store
> card numbers or payment credentials. Order records are not private
> chat messages.

**Status after sealing:** proposal is now DOCTRINE. Implementation
itself remains gated · five explicit owner word-triggers still
required (see the memory file above for the full trigger list).

---

**Original scope (as drafted 2026-11-08):** investigate separation of
encrypted chat content from structured order/payment metadata.
Produce a design + data-flow diagram + impact assessment. Do not
implement in Round 30. This scope is complete · the six decisions
closed Round 30c.

---

## 1 · The problem statement

The audit at 2026-11-08 confirmed:

> `nex_peer_message.attachment_meta.cart` stores the full cart snapshot
> (shop_id, items[], prices, quantities, buyer_notes, subtotal,
> delivery_address, delivery_quote) as **plaintext JSONB** on the server.
> This exists today because `seller-insight-service.ts:163-224` aggregates
> per-shop order volume by reading `attachment_meta->'cart'->>'shop_id'`.

That sits in direct tension with the sealed NEX Chat architecture:

- Private chat content is intended to be end-to-end encrypted.
- Attachments beyond operational metadata (presence, typing, read-receipts)
  should not sit on NEX servers in plaintext.
- "NEX never handles payments" is sealed doctrine.

But orders need to exist somewhere both parties can access:

- The buyer needs to see order history (`/nex-native/orders`).
- The seller needs a dashboard view for fulfilment.
- Analytics (volume, conversion) require aggregation that's hard to do
  on the client without each client holding every other party's data.

**The architecture can't be "all client, all encrypted" without giving up
the seller dashboard.** The honest resolution is to separate the two
concerns cleanly.

---

## 2 · Proposed separation

### 2A · Three distinct data concerns

| Concern | Storage | Encryption | Access |
|---|---|---|---|
| **Private chat content** (free-form text, voice notes, image attachments between buyer and seller) | Client device + E2E-encrypted envelope while in transit · server stores only ciphertext + opaque metadata | E2E, keys held per-device | Both parties only |
| **Structured order record** (items, prices, totals, delivery, status, timestamps) | Server-side in `nex_order` + `nex_order_event` tables (migrations 005/019/020/032 already exist) | Server-side at rest in Supabase (TLS in transit, provider-encrypted at rest; not E2E) | Buyer (own orders) + Seller (orders on their shop) + NEX admin (audit) via RLS |
| **Chat-side notification** (a message in the chat thread that says "Order placed · tap to view") | `nex_peer_message` row with a NEW attachment_type (e.g. `'order_reference'`) carrying ONLY the opaque order_id + localised display text ("Order placed") · no items, no prices, no addresses | E2E if the rest of the message pipeline is E2E; the order_id itself is a UUID with no payload value | Both parties only |

### 2B · What changes vs. today

**Today (sealed · broken against E2E intent):**

```
nex_peer_message
├── sender_account_id
├── conversation_id
├── body: "📦 Cart order"
├── attachment_type: 'cart_order'
├── attachment_url: deeplink
└── attachment_meta:
    └── cart:
        ├── shop_id
        ├── items: [{name, price_pence, qty, variants, ...}]
        ├── buyer_notes
        ├── subtotal_pence
        ├── delivery_address: {line1, city, postcode, phone, ...}
        └── delivery_quote: {method, cost, eta, ...}
```

All of this sits in plaintext JSONB on the server. Seller-insights reads
`attachment_meta->'cart'->>'shop_id'` directly.

**Proposed (post-separation):**

```
nex_order                                 nex_peer_message
├── id (uuid)                             ├── sender_account_id
├── buyer_account_id                      ├── conversation_id
├── seller_business_id                    ├── body: (E2E ciphertext ·
├── state (created/.../completed)         │         carries "Order placed"
├── created_at                            │         after decryption)
├── items (jsonb · structured)            ├── attachment_type:
├── subtotal_pence, currency              │   'order_reference'  ← NEW
├── delivery_address (jsonb)              └── attachment_meta:
├── delivery_quote (jsonb)                    ├── order_id: <uuid>
├── buyer_notes                                └── (nothing else)
├── payment_method_hint
└── payment_confirmed_at (nullable)

nex_order_event (append-only state transitions)
```

The chat message carries ONLY the opaque `order_id`. Items, prices,
addresses, notes all live in `nex_order`. Seller-insights reads
`nex_order.seller_business_id` directly — no attachment-meta scan.

### 2C · Why this is honest

- **Order data was never private chat.** Items, prices, delivery
  addresses are commerce metadata both parties voluntarily exchanged to
  transact. Storing them in a dedicated order table (with explicit RLS)
  reflects their actual nature.
- **Private chat stays private.** Anything the buyer writes in the chat
  thread remains E2E. The order record carries only the structured
  commerce payload the parties agreed to share.
- **The seller dashboard works.** `/manage/shop/orders` reads from
  `nex_order` as it already does for most order fields.
- **Analytics work.** Seller-insights aggregates over `nex_order` columns
  with a well-defined schema instead of pattern-matching JSONB blobs.
- **Legal / Privacy becomes articulable.** The Privacy Policy can state:
  *"NEX stores structured order metadata (items, prices, delivery
  addresses, notes) on our servers so sellers can fulfil orders. NEX
  does not store private chat content or attachments."* That is a
  clean, defensible statement; the current reality is not.

---

## 3 · Data flow diagram

### 3A · Current (pre-separation)

```
   Buyer taps "Checkout"
            │
            ▼
   sendCartOrderAction (_actions.ts:2880-2991)
            │
            │ assembles NexPeerCartOrderSnapshot
            │ (items, prices, address, notes)
            │
            ▼
   nex_peer_message insert
   attachment_type='cart_order'
   attachment_meta.cart = <full snapshot in plaintext>
            │
            ├────────────────────────────────┐
            ▼                                ▼
   Seller chat view                 seller-insight-service
   (renders OrderBubble)            (reads attachment_meta JSONB)
            │                                │
            ▼                                ▼
   Buyer chat view                  Seller analytics
   (renders OrderBubble)            (per-shop order counts)
```

Problem · the plaintext cart snapshot is the only source of truth; the
snapshot sits in the chat table; every analytics path touches
`attachment_meta` JSONB.

### 3B · Proposed (post-separation)

```
   Buyer taps "Checkout"
            │
            ▼
   sendCartOrderAction (renamed → createOrderFromCartAction)
            │
            ├─────────────────────┐
            ▼                     ▼
   INSERT nex_order        INSERT nex_peer_message
   (full structured        attachment_type='order_reference'
    order payload)         attachment_meta.order_id = <uuid>
            │              body/ciphertext: E2E-encrypted
            │              "Order placed · tap to view"
            │                     │
            ▼                     ▼
   nex_order_event:        Chat thread shows a
   state='created'         reference bubble that,
                           when tapped, opens
                           /orders/<order_id>
            │                     │
            ├──────────────────┐  │
            ▼                  ▼  ▼
   Seller /manage/      Buyer /orders   Chat renderer
   shop/orders          /<order_id>     (OrderReferenceBubble)
   (reads nex_order)    (reads          follows the order_id
                        nex_order)      pointer

   seller-insight-service
   (reads nex_order directly)
```

### 3C · Backwards compatibility during migration

Existing `cart_order` messages on production remain valid (production
still has the migration 077 enum per the audit; migration 306 only
narrowed sandbox which migration 309 restores). A migration can:

1. Read existing `cart_order` attachment_meta.cart rows
2. INSERT a corresponding `nex_order` row per snapshot
3. UPDATE the message's `attachment_type` to the new `order_reference`
   value and replace `attachment_meta` with `{order_id: <uuid>}`
4. Keep legacy renderer code path for any row that fails to migrate
   (defensive · surfaced via a dashboard counter)

This is a one-way migration · non-destructive · reversible in principle
via the old snapshot preserved in a backup table during migration.

---

## 4 · Table + column impact assessment

### 4A · Schema changes required

- `nex_peer_message.attachment_type` CHECK extended to include a new
  value `'order_reference'`. Follows the same pattern as mig 077
  (`cart_order`), 309 (restore). Requires a new migration (311+).
- No change to `nex_peer_message.attachment_meta` shape · it stays JSONB
  but the stored payload becomes `{"order_id": "<uuid>"}` for the new
  type (vs. the full cart snapshot today).
- Optional · a new column `nex_peer_message.order_id uuid REFERENCES
  nex_order(id)` to allow indexed joins. Nullable. Only populated on
  `attachment_type='order_reference'` rows.
- No change to `nex_order` or `nex_order_event` tables themselves · the
  existing shape already supports everything the current snapshot
  carries. Review required:
  - Does `nex_order.delivery_address` column exist today? Audit says
    delivery_address rides in the cart snapshot — may need a new column
    if not already in `nex_order`.
  - Confirm `nex_order.items jsonb` is sized for realistic carts.

### 4B · Code paths affected

Grep for `cart_order` returned (from audit):

- `_actions.ts:2521-2991` · `sendCartOrderAction` server action (rename +
  rewrite to populate `nex_order` first, then reference bubble)
- `_portrait-bloom-shell.tsx:1688-1694` · `MessageCartOrderCard`
  renderer (needs a new `MessageOrderReferenceCard` variant that fetches
  display data via the order_id pointer)
- `chat/peer/[accountId]/page.tsx:886` · branch on attachment_type
  (needs new branch for `order_reference`)
- `vault/home/chats/page.tsx:250` · `"🧾 Order"` label logic (needs to
  render both legacy and new types)
- `seller-insight-service.ts:163-224` · `.eq("attachment_type", "cart_order")`
  query (rewrite to query `nex_order` directly)
- `api/nex-native/peer-message/encrypted/route.ts:51` · allowed types
  list (add `order_reference`)
- `lib/nex-native/crypto/encrypted-send.ts:49` · same list
- `lib/nex-native/crypto/attachment-envelope.ts:9` · the module skips
  `cart_order` today because the snapshot is plaintext. Under the new
  scheme, `order_reference`'s meta payload is just a UUID — safe to
  encrypt the surrounding body, the `order_id` pointer stays in meta.

### 4C · Migration strategy for existing rows

- **Phase A** · ship the new `order_reference` type alongside legacy
  `cart_order` (no data touched). Both renderers coexist.
- **Phase B** · on first write, new carts write `order_reference` + a
  real `nex_order` row. Legacy cart_order rows continue to render via
  the old path.
- **Phase C** · one-off migration script that walks legacy `cart_order`
  rows, creates `nex_order` + `nex_order_event` records, rewrites the
  message, and nulls `attachment_meta.cart`.
- **Phase D** · after monitoring confirms zero legacy renderer hits,
  deprecate the `cart_order` type (new migration removing it from CHECK).

### 4D · Seller-insights continuity

`seller-insight-service.ts` currently aggregates by
`attachment_meta->'cart'->>'shop_id'`. Post-separation it reads
`nex_order.seller_business_id`. Columns needed:

- `nex_order.seller_business_id` — probably already exists; audit
  needed
- Index on `(seller_business_id, created_at)` — likely already exists;
  audit needed

Analytics output does not change. The seller dashboard renders the
same KPIs.

---

## 5 · What is NOT proposed

- **No change to the `nex_order` table itself** beyond potentially
  adding a `delivery_address` column if it isn't already there
- **No change to the chat encryption posture.** Chat text remains E2E.
  The encryption-skip for `cart_order` plaintext snapshots goes away
  with `cart_order` itself
- **No new buyer-facing or seller-facing UI** — same screens, same
  flows, same wording. The only surface change is on the message
  renderer (reference bubble instead of full-cart bubble; tapping it
  opens the order detail page as it already does)
- **No change to safe-trade consent gating, order status machine,
  delivery quote, or any seller policy wiring**
- **No change to buyer visibility of their own orders.** `/orders` and
  `/orders/[orderId]` continue to work as today
- **No introduction of a new payment flow.** This is purely about
  storage separation

---

## 6 · OWNER DECISION items raised by this proposal

1. **Approve the separation direction** (yes/no). If no, document the
   reason the current plaintext snapshot is acceptable (e.g. formal
   acknowledgement in the Privacy Policy that NEX stores cart snapshots)
2. **Confirm `nex_order` schema completeness** for everything the cart
   snapshot carries today (items, delivery_address, delivery_quote,
   buyer_notes, payment_method_hint). A read-only audit will confirm.
3. **Backwards-compat strategy** · Phase B→C timing (immediate cutover vs
   staged migration of legacy rows)
4. **Deprecation timeline** for the `cart_order` attachment_type (keep
   indefinitely vs. remove after Phase D)
5. **Privacy Policy wording** · the Privacy Policy needs an explicit
   statement about what NEX stores server-side (order records) vs what
   remains on-device (chat content). Owner provides the plain-language
   wording; legal review before public launch
6. **Analytics continuity test** · confirm seller-insights produces
   identical KPIs for a sample dataset under both the current and
   proposed schema before cutover

---

## 7 · Rough effort estimate (SUPPORTED, not binding)

- Phase A (add `order_reference` type · new renderer path · new server
  action variant): **3–4 days** · includes tests
- Phase B (switch writes to new path): **1 day**
- Phase C (one-off migration script for legacy rows + verification):
  **2–3 days**
- Phase D (deprecation migration · guarded by monitoring): **0.5 day**

**Total ~7–9 days** across Phases A–D once owner authorises Phase A.

---

## 8 · Recommendation

Approve the direction. Phase A is a bounded, low-risk refactor that
fixes a sealed-doctrine conflict without changing product behaviour or
breaking seller analytics. Phase C becomes safer each day because every
new order lands in the clean schema.

Owner input needed on items 1–6 above before Round 31 or later can be
scoped. This proposal itself does not authorise any code changes.
