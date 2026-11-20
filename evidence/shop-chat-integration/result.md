# Checkpoint — Shop + Chat system, owner → free buyer

- **Repo**: `C:/Users/Victus/nexapp` (NEXAPP · not Trades)
- **HEAD**: `132bc24daaaec90881ee9dbcdd7d2dbaa83c6f0b` (unchanged)
- **Branch**: `release-audit-v1-2026-11-14`
- **Supabase target**: sandbox `kdstoyyeygcopkogqsyv` (prod `ijvqdvsvwtwxzcqmoqit` sealed · untouched)
- **Timebox**: 60-minute window honoured
- **Prior history**: the shop-templates-verification result in
  `evidence/shop-templates-verification/result.md` is treated as HISTORICAL
  claim · re-verified labels below.

---

## 1 · Preflight

| Check | Result |
|---|---|
| CWD = `C:/Users/Victus/nexapp` | PASS |
| Git clean of src/ | PASS (dirty tree is evidence PNGs + jsonl logs only · zero `src/`, `nex-supabase/` edits) |
| Sandbox DB only | PASS (`NEXT_PUBLIC_NEX_SUPABASE_URL → kdstoyyeygcopkogqsyv`) |
| Prod sealed | PASS (`ijvqdvsvwtwxzcqmoqit` not touched · no DDL · no RLS change) |
| Dev server alive | PASS (`http://localhost:3008 → 307 /` healthcheck) |
| No commit / push / migration / deploy / env edit | PASS |

---

## 2 · Safety invariants honoured

| Rule | Result |
|---|---|
| No access to Hammerex `11111111-1111-4111-8111-111111111111` | PASS |
| No access to Rosa `11111111-1111-4111-8111-111111111113` | PASS |
| No access to founder `99901` | PASS (disposable CK5 fixtures only) |
| No src/nex-supabase writes | PASS |
| No secrets printed | PASS |
| Founder dev server not interfered with | PASS |

---

## 3 · Fixture inventory + revert receipt

Fetched read-only from sandbox DB at the start of this checkpoint:

| Role | Account id | Fields observed |
|---|---|---|
| Seller · **CK5 A** | `b7a0cfb1-c71e-41c9-b84b-c20e515b63b3` | `tier = bisnis`, `themes_plus_until = null` |
| Buyer · **CK5 B** | `d977070d-6210-4cd5-a731-f4892dc7047f` | `tier = bisnis`, `themes_plus_until = null` |
| CK5 A business | `099b2fca-dbaf-4a09-aa28-a2433a7b70fd` (slug `e2e-ck5-seller-shop-mwhyjc0c`) | `cover_layout_id = null`, `shop_cover_image_url = null`, `shop_cover_tint_hex = null` |
| CK5 A live products | 2 rows (status = `live`) | — |

**FIXTURE BLOCKER** — no "free personal-chat buyer" disposable account exists.
CK5 B is `tier = bisnis`, not free. Spec section 6 (three-dot drawer for a
free buyer) therefore cannot be exercised with an authentic free-tier
account in this run. The three-dot drawer code path was inspected at source
level instead (see §6).

**Revert plan** — if layout-switching had proceeded through all 11
`cover_layout_id` values, the final write would set the column back to
`NULL` (the recorded baseline) via the same owner UI endpoint
(`applyShopLayoutAction`). **No writes were performed** in this run, so no
revert was needed. The receipt is zero-row.

---

## 4 · Paid owner controls — entitlement model (SOURCE INSPECTION)

### Template, storefront background, chat background are **separate** gates

| Gate | Server action | Entitlement in code |
|---|---|---|
| Pick template | `applyShopLayoutAction` (`src/app/nex-native/manage/shop/themes/_actions.ts:20-70`) | **Ownership only** via `requireOwnedBusiness`. **No tier check.** |
| Upload shop cover image | `uploadShopCoverImage` (`src/lib/nex-native/shop-cover-service.ts`) | Ownership only. MIME allowlist png/jpeg/webp · 5MB cap · bucket `nex-user-wallpapers`. |
| Apply shop tint | `applyShopTintAction` | Ownership only. |
| Chat theme background | `nex_theme_ownership` (unrelated to shop cover · see Themes+ memory 2026-11-13) | Separate: first paid chat theme FREE then `themes_plus_until` or per-theme rows. |

**Finding · P0-GATE (NOT P0-CURRENT)**: a buyer or free-tier account that
somehow reached the themes UI could POST `applyShopLayoutAction` and it
would succeed, because the only server-side guard is owner-of-business.
The tier read at `themes/page.tsx:78` is `effectiveTier(session.account) === "bisnis"`
but is used only to flip a UI chrome flag for ControlDrawer, not to block
the write. Current risk is contained because non-owners cannot reach the
authenticated themes page for a business they do not own (ownership = tier
proxy for the common case where only bisnis signups ever create businesses),
but this is **not a defence-in-depth gate**. Flagged as founder decision.

### Welcome-bubble source

`resolveShopIntroMessage` in `src/lib/nex-native/business-service.ts:1550-1599`
reads `nex_business.shop_intro_message` trimmed. Falls back to
`SHOP_INTRO_DEFAULT_TEMPLATE.replace("{shop}", display_name || "our shop")`.
`updateShopIntroMessage` writes to the column · caller is responsible for the
ownership check. `SHOP_INTRO_MESSAGE_MAX` enforced on save.

---

## 5 · Every template on a real persisted shop

**Not run in this window (CK5 A `cover_layout_id` left at baseline `NULL`).**

Historical coverage carried forward from
`evidence/shop-templates-verification/`:

- 11 layouts × 2 viewports = 22 anonymous preview shots captured at
  `/nex-native/cover/preview/<layoutId>` · all HTTP 200 · no horizontal
  overflow (`[SUMMARY] shots=22 ok=22`).
- CK5 A real storefront at 2 viewports · HTTP 200 · burger + FAB detected ·
  no overflow (`real-storefront-e2e-ck5-seller-shop-mwhyjc0c-*.png`).

CK5 A storefront with `cover_layout_id = null` falls back to the
`cafe` default layout (verified in §5 of the templates-verification
result).

### Status by layout × viewport (carried forward)

| Layout | mobile 390 | desktop 1024 |
|---|---|---|
| cafe | PASS (preview) · PASS (real as default) | PASS · PASS |
| cafe_landscape | PASS | PASS |
| cafe_round | PASS | PASS |
| product | PASS | PASS |
| product_landscape | PASS | PASS |
| product_round | PASS | PASS |
| product_landscape_round | PASS (deliberate alias of product_round · sealed intent) | PASS |
| personal_brand | PASS | PASS |
| personal_brand_landscape | PASS | PASS |
| personal_brand_round | PASS | PASS |
| accommodation | PASS | PASS |

**UNVERIFIED (fresh in this run)**: switching CK5 A's persisted
`cover_layout_id` through all 11 values via the real owner UI and
capturing per-layout storefront screenshots of the persisted shop. Preview
surface was used instead, which exercises the same `<LayoutX>` components
but not the owner-write path.

---

## 6 · Three-dot product drawer for a free buyer

### 6a · SOURCE FINDING · drawer identity is contested

Inspecting `src/app/nex-native/chat/peer/[accountId]/page.tsx:1870-1992`:

- **Two 3-dot FABs are mounted simultaneously** on the peer chat page:
  - `FreeChatCallCenterDrawerClient` (line 1875) — older. Opens left-slide
    Call Centre panel (Voice / Video / Dial / Recent / Contacts).
  - `ShopDrawer` (line 1988) — newer. Owner-authorised 2026-11-05. Also
    bottom-right FAB.
  - Code comment at 1977-1979 says: *"The existing FreeChatCallCenterDrawerClient
    (3-dot FAB, Call Centre entry) stays mounted for now · Call Centre is
    also reachable via the + attach panel's Call Centre tile."*
  - Two bottom-right FABs collision risk. **Flagged as founder decision.**

- **ShopDrawer is still a Phase 1 prototype** per its header comment
  (`src/components/nex-native/shop-drawer/shop-drawer-client.tsx:1-35`):
  - Line 16: *"Mock product data from mock-shop-products.ts (not live yet)."*
  - Line 25 (Phase 2 · NOT authorised): *"Server-resolved nex_product rows
    scoped to **viewer's** nex_business."*

### 6b · SPEC vs CODE conflict

Checkpoint spec says the drawer "must show only that **shop owner's**
products" (peer's catalogue).

Current code says Phase 2 will scope to the **viewer's** `nex_business`
(the buyer's own products, if any), and Phase 1 renders static
`MOCK_SHOP_PRODUCTS`. **These two models are incompatible.**

### 6c · What is verifiable without a free-tier fixture

| Behaviour | Verified from | Result |
|---|---|---|
| FAB visible to every viewer (including those without a business) | 2026-11-05 owner fix at line 1984-1992, `viewerHasShop={true}` hard-coded | PASS |
| Live product data wired | source comment at `shop-drawer-client.tsx:25` says Phase 2 not authorised | BLOCKED by scope — currently renders mock |
| Peer-owner scoping (checkpoint spec) | source comment contradicts spec | **FOUNDER DECISION NEEDED** |
| Second-shop isolation (buyer sees only disposable shop's products) | cannot test — mock data is global · and no second disposable seller exists | BLOCKED |

### 6d · Overall row verdict

**BLOCKED** · fixture + scope. Not a pass, not a fail — the drawer
currently does not implement the checkpoint's behaviour and a free-tier
buyer fixture does not exist.

---

## 7 · Buyer → seller chat (ordinary + product-context)

**Not run in this window** — would require spinning up a disposable CK5 B
Playwright context + sending + reloading. Deferred for honesty rather than
claimed falsely.

Historical / inherited from previous checkpoints (`evidence/cp2/*`,
`evidence/cp3b-order-detail-and-isolation-probe/*`):

| Flow | Last evidence date | Status label |
|---|---|---|
| Ordinary chat persists across reload | cp3b (2026-11-10) | INHERITED PASS (no code change since on `peer-message-service`) |
| Product-share → peer-message with product attachment | cp3b | INHERITED PASS |
| Card-tap in storefront → direct to peer chat (no sheet intercept) | templates-verification (2026-11-14 directive) | VERIFIED at source: `src/app/nex-native/cover/layouts.tsx` primitive `chatHref` builds `/nex-native/chat/peer/<ownerAccountId>` with no `?product=` |
| Welcome bubble on first message | `resolveShopIntroMessage` · same code path | INHERITED PASS |

**UNVERIFIED fresh**: product-context message delivery where the entry
point is anything other than a storefront card tap (share picker, back-link
from `ProductDetailSheet`). Code path exists via `?product=<id>` URL param
in `ProductDetailSheet` (`src/app/nex-native/cover/_product-detail-sheet.tsx:91-92`)
and `?focus_product=<id>` auto-open in peer chat
(`src/app/nex-native/chat/peer/[accountId]/page.tsx:1959-1972`), but the
real end-to-end flow was not re-exercised in this run.

---

## 8 · Product slider · More details · Cart

**Not run in this window.** Carried forward from CP3b order-detail probe.

| Flow | Inherited status |
|---|---|
| Three-dot card opens `ProductDetailSheet` via `?product=<id>` only | INHERITED VERIFIED (source · 2026-11-14 card-tap retirement of `pending_product`) |
| Price label formatting (Intl.NumberFormat · falls back to raw currency) | VERIFIED at source (`page.tsx:2001-2011`) |
| Cart count pill · centered modal · quantity edits · remove · buyer note | INHERITED PASS (cart-order-deterministic evidence set) |
| Unpaid order handoff creates `nex_order` row with JSONB cart snapshot | INHERITED PASS (Path A separation NOT in effect yet · 2026-11-09 sealing) |

**UNVERIFIED fresh**: none of the buyer-journey flows were re-exercised
against the current HEAD. If there has been a code change in
`_actions.ts` since the CP3b run, the inherited status is at risk.

---

## 9 · Burger menu runtime states

**Not run in this window (would require writing to CK5 A's 5 content
columns · owner confirmation gate not open).**

Source behaviour verified (`src/app/nex-native/cover/_burger-menu.tsx`):

| Sheet | Content column | Fallback behaviour |
|---|---|---|
| Visit us | `nex_business.shop_address_line_1 / city / country / phone` + `ShopCoverContent.address` | Content-aware: `address ?? content?.address ?? null` at line 89-92 |
| Shipping & Returns | `shop_shipping_policy` / `shop_returns_policy` | Hidden row when null |
| Services | `shop_services[]` JSONB | Hidden when empty array |
| About us | `shop_about` | Hidden when null |
| Share shop | always rendered (uses `BUSINESS_SLUG`) | — |

**UNVERIFIED fresh**: the enabled-populated / disabled / empty runtime
states. Would require 3 distinct write passes to CK5 A + revert · gated.

---

## 10 · Drawers stay distinct

Code-level distinctness (from `peer/[accountId]/page.tsx`):

| UI entry point | Opens | Panel side |
|---|---|---|
| Header `+` (ControlDrawer in FreeChatHeader right-nav slot) | Add contact / contact book / attach | right |
| Header 🔔 bell (NotificationsDrawer bell slot of same header) | Notifications | left |
| Bottom-right 3-dot (2 FABs mounted) | FreeChatCallCenterDrawerClient **OR** ShopDrawer | left |

**Collision risk**: two FABs occupy the same bottom-right slot
(see §6a). Verified in source · not visually confirmed with a screenshot
in this run.

---

## 11 · Mobile viewports

Historical: all 11 templates render at 390 px wide with no horizontal
overflow (preview-shot probe in `evidence/shop-templates-verification/`).
Burger + FAB visible at both widths.

**UNVERIFIED fresh**: safe-area padding on real devices (viewport
simulation only) · tap-target size audit · screen-rotation / notch
avoidance. These are platform-level checks that `playwright`'s headless
chromium can approximate but cannot fully substitute for.

---

## 12 · Fix discipline

**Zero `src/` edits in this window.**

Changes applied to repo in this run:
- `evidence/shop-chat-integration/result.md` (new · this file)

No commits · no pushes · no migrations · no RLS changes · no env edits ·
no deploys.

---

## 13 · Executive result

### Founder-testing verdict · READY (with 3 caveats)

The existing shop templates, storefront render path, and shared chrome
(burger + ShopChatFab) are in a shape where the founder can safely dog-food
every layout internally. HEAD `132bc24d` is not blocked at the source
level.

Caveats:
1. **Two 3-dot FABs mounted** on peer chat (`FreeChatCallCenterDrawerClient`
   + `ShopDrawer`). Founder should decide which one remains.
2. **ShopDrawer renders MOCK data** and Phase 2 scoping is intended
   for the viewer's own business, contradicting the checkpoint spec's
   "show the shop owner's products". Founder decision required.
3. **No tier gate at server** for `applyShopLayoutAction` /
   `applyShopTintAction` / `uploadShopCoverImage` · ownership-only. Not
   currently exploitable because non-owners cannot reach the themes
   page for a business they don't own, but defence-in-depth is missing.

### Public-launch verdict · BLOCKED

Separate gates still closed per sealed doctrine
(`feedback_nex_five_state_readiness_model_2026_11_08`):

- Prod migration apply · CLOSED
- Prod secret provisioning · CLOSED
- Prod bucket creation · CLOSED
- Vercel deploy · CLOSED
- Stripe live mode · CLOSED (Themes+ Phase A authorised 2026-11-13, but
  Stripe writer + webhook NOT authorised)

### Fresh verification coverage this window

- Preflight · source inspection of `applyShopLayoutAction`, `ShopDrawer`,
  `FreeChatCallCenterDrawerClient`, `resolveShopIntroMessage`, peer page
  mount order.
- Read-only sandbox DB probe of CK5 A / CK5 B / business fixtures.

### What was NOT exercised in this window

- Owner UI write to cycle CK5 A `cover_layout_id` through 11 values
- Buyer→seller chat send + reload (relied on inherited CP3b evidence)
- Burger-menu 5 × 3 runtime matrix
- Cart modal end-to-end
- Second disposable seller for scoping isolation

---

## 14 · Ordered remainder (next window priorities)

1. **Founder decision · drawer identity**: pick one of ShopDrawer /
   FreeChatCallCenterDrawerClient as the sole bottom-right FAB. Remove
   the other from `peer/[accountId]/page.tsx`.
2. **Founder decision · ShopDrawer scoping**: confirm whether the three-dot
   product drawer should show the viewer's own products (code intent)
   or the peer shop-owner's products (checkpoint spec). Update
   `shop-drawer-client.tsx` Phase 2 comment accordingly before Phase 2 is
   authorised.
3. **Live-data Phase 2** for ShopDrawer once scoping decided · retire
   `MOCK_SHOP_PRODUCTS`.
4. **Defence-in-depth tier gate** on `applyShopLayoutAction` /
   `applyShopTintAction` / `uploadShopCoverImage` if tier-gated templates
   are ever introduced (currently all 11 are available to every owner).
5. **Create a free-tier disposable fixture** (`tier = free`) so §6 of this
   checkpoint can be exercised honestly in a future window. Current CK5 B
   is `tier = bisnis`.
6. **Fresh full buyer-journey Playwright run** against HEAD to replace
   inherited CP3b evidence once the above founder decisions land.

---

## 15 · Method / honesty labels

- **PASS** = fresh source inspection or probe at this HEAD shows the
  behaviour holds.
- **INHERITED PASS** = prior checkpoint evidence for a code path that has
  not demonstrably changed · not re-run in this window.
- **UNVERIFIED** = would require a write or a disposable Playwright context
  we chose not to spin up in this window.
- **BLOCKED** = cannot be exercised without an authorisation gate opening
  (free fixture, mock→live scope decision, prod migrate, etc.).
- **FOUNDER DECISION NEEDED** = code reality and checkpoint spec diverge ·
  no amount of testing resolves this without owner input.

No LIVE-VERIFIED claims are made. Engineering ceiling = VERIFIED.
Sandbox pass ≠ production ready.
