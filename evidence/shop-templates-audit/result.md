# Shop Templates · Read-Only Audit · 2026-11-16

**Scope**  40 minute READ-ONLY audit of the NEX shop template system in
`C:/Users/Victus/nexapp` (NEXAPP, not Trades). No code changes, no DB
writes, no commits, no pushes, no deploys. No disposable signup, no
seeding, no founder-server touches. Founder-sealed accounts (Hammerex,
Rosa, 99901) not opened.

**Repo state at audit end**
- HEAD: `132bc24daaaec90881ee9dbcdd7d2dbaa83c6f0b` (unchanged from start)
- Branch: `release-audit-v1-2026-11-14`
- Nothing new written outside `evidence/shop-templates-audit/`

**Method**  Code inspection first. The in-app preview surface at
`/nex-native/cover/preview/[layoutId]` was inspected by reading the
page source only; no browser was driven, so screenshots are UNVERIFIED
in this pass (the server was intentionally left alone).

---

## 1 · Template inventory

The shop template system is **ONE engine with 11 layout variants** over
a shared set of primitives, not 11 separate template systems.

**Source of truth for the id list**
`src/app/nex-native/cover/layout-ids.ts` — exported `COVER_LAYOUT_IDS`.
Note: the file comment still says "10 layouts live"; the 11th
(`accommodation`) was added on 2026-10-20 and the comment is stale.

**Shared pieces every layout uses** (`src/app/nex-native/cover/` +
`src/lib/nex-native/...`):

- `CoverThemeSkin` — paints accent, wallpaper, bubble rim, composer rim
- `CoverIdentityBadge` — round portrait, ping ring, online dot, country flag
- `CoverSectionHeading` — eyebrow + title + optional right slot
- `CoverCatalog` — product grid (variants: default, `round`, `landscape`)
- `CoverIdentityRail` — handle, location, socials strip
- `WhoWeAreCollapsible` — About card
- `PersonalBrandTabs` — 4-tab block (Products / Images / Sizes / Ordering)
- `BurgerMenu` — top-right menu with Visit us / Shipping & Returns /
  Services / About us / Share
- `ShopChatFab` — bottom-right floating peer-chat entry point
- `ProductDetailSheet` — opens on `?product=<id>`
- `PhoneFrame` — 360×780 phone shell on desktop, full-bleed on mobile

**All 11 layouts live in one file**: `src/app/nex-native/cover/layouts.tsx`
(2 765 lines). Dispatcher: `src/app/nex-native/cover/layout-switch.tsx`.

### 11-layout table

| id | Label | Family | Variant axis | Status | Notes |
|---|---|---|---|---|---|
| `cafe` | Café | Cafe | portrait grid | SHIP | sealed |
| `cafe_landscape` | Café · Landscape | Cafe | landscape rows | SHIP | sealed |
| `cafe_round` | Café · Round Products | Cafe | round tiles | SHIP | sealed |
| `product` | Product Seller | Product | portrait grid | SHIP | compact identity + Dispatch Times block |
| `product_landscape` | Product Seller · Landscape | Product | landscape rows | SHIP | sealed |
| `product_round` | Product Seller · Round Products | Product | round tiles | SHIP | sealed |
| `product_landscape_round` | Product Seller · Landscape · Round | Product | round tiles | **DUPLICATE** | 1-line body: `return <LayoutProductRound …/>`; `layouts.tsx:408`. Alias, not a distinct template |
| `personal_brand` | Personal Brand | Personal Brand | portrait grid + 4 tabs | SHIP | sealed |
| `personal_brand_landscape` | Personal Brand · Landscape | Personal Brand | landscape rows | SHIP | sealed |
| `personal_brand_round` | Personal Brand · Round Products | Personal Brand | round tiles | SHIP | sealed |
| `accommodation` | Accommodation | Accommodation | portrait suites | SHIP | "Rooms & Suites" heading, amenities, check-in/out. Missing from `COVER_LAYOUT_DONE` in `cover/preview/page.tsx:70` — cosmetic (the green-tick set), not a render bug |

### Founder-held templates (confirmed intact)

Seven unfinished templates were retired on 2026-09-30 (restaurant,
tradesperson, salon, creator, fashion, street_food, premium_business)
per the comment in `layout-ids.ts`. They are NOT referenced anywhere in
the current id list. Not touched by this audit.

### Broken / duplicate / renamed findings

- **DUPLICATE**: `LayoutProductLandscapeRound` is a 1-line alias of
  `LayoutProductRound` (`src/app/nex-native/cover/layouts.tsx:408`). The
  gallery blurb in `cover/preview/page.tsx:55` says "cloned from Product
  Landscape · round product cards" but the body renders the Portrait
  Round layout, not the Landscape variant. Either the alias is wrong or
  the label is wrong. Non-blocking (both are shippable layouts), but
  the "Landscape · Round" name is misleading today.
- **STALE COMMENT**: `layout-ids.ts:17` says "10 layouts live"; the
  array has 11 entries.
- **MISSED GREEN-TICK**: `cover/preview/page.tsx:70` `COVER_LAYOUT_DONE`
  omits `accommodation`. Cosmetic in the internal gallery only.
- **STALE DOC**: `cover/preview/page.tsx:3` says "10 sealed cover
  templates".

No orphaned layouts, no dead switch arms, no missing components were
found. The switch at `layout-switch.tsx` lists all 11 ids and all map
to real exports.

---

## 2 · One shared category and upload backend

**Category model (SHARED, single source of truth)**
- `src/lib/nex-native/business/categories.ts` — 5-value frozen list:
  `food`, `accommodation`, `property`, `products`, `services`
  (Rev 6 FROZEN · 2026-10-02).
- Subtypes: `src/lib/nex-native/business/subtypes.ts`.
- The setup wizard category step imports from these modules
  (`manage/shop/setup/category/_client.tsx` uses `BUSINESS_CATEGORIES`
  and `CATEGORIES_WITHOUT_OTHER_SUBTYPE`).
- Doctrine quote (from `categories.ts`): *"Categories exist as a
  RECOMMENDATION context, never as a permission boundary."*

**Template × category coupling**
- The admin template picker at `/manage/shop/themes` does NOT filter
  templates by category. Any of the 11 layouts can be chosen on any
  business row (`themes/page.tsx` just hands `COVER_LAYOUT_IDS` to the
  client). Accommodation layout is available but not auto-selected
  when the business category is `accommodation` — soft-coupling only.

**Upload backends (consistent, one bucket per intent)**

| Upload path | Service | Supabase bucket | Column written |
|---|---|---|---|
| Shop cover (custom image) | `uploadShopCoverImage` in `src/lib/nex-native/shop-cover-service.ts` | `nex-user-wallpapers` | `nex_business.shop_cover_image_url` |
| Shop background preset | `applyShopPresetBackgroundAction` (writes the preset URL that lives under `/nex-brand/shop-themes/*.png` in `public/`) | public asset (no bucket upload) | `nex_business.shop_cover_image_url` + paired tint |
| Product image | `uploadProductImage` in `src/lib/nex-native/product-service.ts` | `nex-business-assets` | product image URL |
| Business logo / gallery | `business-service.ts`, `gallery-image-service.ts` | `nex-business-assets` | `nex_business.logo_url` + gallery rows |
| Chat theme hero | `chat-theme-service.ts` | `nex-chat-theme-hero` | `nex_chat_theme.hero_image_url` |

**Verdict**  Categories are unified. Uploads are consistent per-intent
but **split across three buckets** (`nex-user-wallpapers`,
`nex-business-assets`, `nex-chat-theme-hero`). This is intentional
isolation (user wallpapers ≠ business assets ≠ chat theme assets) and
is called out in each service's file header. No unification needed.

---

## 3 · Hamburger menu and owner pages

**Where it mounts** — `src/app/nex-native/[businessSlug]/page.tsx:514`
(single mount, outside `CoverThemeSkin`, so every template inherits it
without layout code touching it).

**File** — `src/app/nex-native/cover/_burger-menu.tsx` (1 446 lines).

**Dropdown rows** (owner-sealed 2026-11-06):

1. 📍 **Visit us** → slide-up sheet with address, hours, Google Maps
   embed/placeholder, "Get directions" CTA
2. 📦 **Shipping & Returns** → slide-up sheet with Dispatch / Delivery /
   Returns sections (replaces the old Dispatch-only row)
3. 🛒 **Services** → slide-up sheet with Retail / Wholesale / Custom
   Made toggles (replaces Wholesale-only)
4. ℹ️ **About us** → slide-up sheet for templates that don't have an
   inline About block
5. 🔗 **Share shop** → native share sheet with clipboard fallback

**Data source** — reads real business fields from `ShopCoverContent`
(threaded in from `[businessSlug]/page.tsx` via `getShopCoverContent`),
not mocks: `address`, `publicPhone`, `publicEmail`, `slug`,
`hoursByDay`, `socials`. Falls back per-field to template mock so the
sheet still "reads finished" when a field is blank.

**Retired on 2026-11-13**
- `HeaderCartIcon` removed from the burger header (owner directive
  2026-11-12).
- `CoverComposer` retired from every layout — `ShopChatFab` is the sole
  shop-to-customer contact point now.
- `ShopSideChatDrawer` unmounted (was a duplicate chat entry point).

**Owner view vs customer view**  The burger menu is **identical** for
both audiences. Owner-only affordances live elsewhere:
- Preview ribbon at the top of `/nex-native/<slug>?preview=1` when the
  signed-in viewer is the shop owner (`[businessSlug]/page.tsx:463`).
- Owner empty-products prompt renders only when
  `viewerAccountId === business.owner_account_id && products.length === 0`
  (`[businessSlug]/page.tsx:544`).
- The admin surface `/nex-native/manage/shop/themes` is the owner's
  template picker.

**Owner pages reachable from the burger** — none directly. The burger
is a customer-facing menu. Owner pages are reached from `/manage/shop`
(the manage hub), not from the public shop surface.

---

## 4 · Backgrounds

**Shop backgrounds** and **chat themes** have **separate catalogues**
and **separate storage**. They share a visual language but not data.

### Chat themes
- Table: `nex_chat_theme` (bucket: `nex-chat-theme-hero`)
- Column: `hero_image_url` is the chat wallpaper
- Library UI: `src/app/nex-native/chat-themes-library/*`
  (`_catalog.ts`, `_full-library-client.tsx`, etc.)
- Each theme is a DB row with accent, bubble rim, composer rim,
  wallpaper config

### Shop backgrounds
- No `nex_shop_background` table. Presets are **hard-coded** in
  `src/app/nex-native/manage/shop/backgrounds/_client.tsx` starting
  line 130 as `const PRESETS: ReadonlyArray<ShopBackgroundPreset>`
- Preset image assets live under
  `public/nex-brand/shop-themes/*.png` (served as public static files)
- Server allowlist of valid URLs lives in `manage/shop/themes/_actions.ts`
  (`PRESET_BACKGROUND_META`). Unknown URLs are rejected server-side.
- Custom shop background upload bucket:
  `nex-user-wallpapers` (`shop-cover-service.ts:29`)
- Column: `nex_business.shop_cover_image_url` (writes both for presets
  and custom uploads)
- Paired accent: `nex_business.shop_cover_tint_hex` (presets write a
  paired tint from `PRESET_BACKGROUND_META`)

### Render precedence (sealed, in `[businessSlug]/page.tsx`)

- **wallpaper**: `shop_cover_image_url → theme.hero_image_url → gradient fallback`
- **accent**: `shop_cover_tint_hex → theme.accent_hex`

### Categories on the shop-backgrounds grid

12 categories: All / Retail / Online / Electronics / Fashion / Tools /
Sports / Food / Travel / Sale / Delivery / Showcase (hard-coded in
`_client.tsx:59`). These categories are for the **gallery filter**
only and are independent of the 5-category business taxonomy.

**Verdict**  Chat themes and shop backgrounds are intentionally
separate systems. Both share the **phone-framed emerald/gold visual
language** (file header comment says so) but not data. The only
coupling is render-time precedence where the shop background overrides
the chat theme's hero image when set.

---

## 5 · Mobile and shop-to-chat

**PhoneFrame mount** — `[businessSlug]/page.tsx:457`. Wraps
`CoverThemeSkin + CoverLayoutSwitch + BurgerMenu + ShopChatFab +
ProductDetailSheet + OwnerEmptyPrompt` as siblings of the preview
ribbon. 360×780 on desktop ≥ 500px; full-bleed on narrower viewports.
Same pattern as `/chat-themes-library`, `/free-chat`, `/contacts`, etc.
(sealed phone-frame doctrine).

**Product-to-chat entry points** (confirmed present in every template):

- `ProductDetailSheet` is mounted at the **page level**
  (`[businessSlug]/page.tsx:556`), not inside any layout. This means
  all 11 layouts inherit the sheet — tapping a product card from any
  template opens the same sheet.
- `?product=<id>` on the URL opens the sheet.
- From the sheet: **Buy now · chat** routes the buyer into
  `/nex-native/chat/peer/<ownerHandle>` with cart metadata (sealed
  2026-11-06).
- **Add to cart** writes `NEX_CART_STORAGE_KEY` using the sealed
  `NexCartItem` shape.
- Unauthenticated viewers get the in-sheet registration popup
  (Stage 4 · 2026-11-14) instead of a hard redirect.

- `ShopChatFab` is mounted at page level (`[businessSlug]/page.tsx:527`).
  Owner-sealed 2026-11-13: single floating bottom-right button;
  tapping routes signed-in visitors directly to peer chat with the
  shop owner; signed-out visitors see the registration popup that
  returns to `/nex-native/<slug>?open-chat=1` after sign-in.

- `CoverCatalog` product cards (shared primitive used by all layouts)
  already carry the tap handler that pushes `?product=<id>` into the
  URL, which is what opens `ProductDetailSheet` above.

**Verdict**  Every one of the 11 templates has **two live
product-to-chat paths** (card tap → sheet → "Buy now · chat", and the
`ShopChatFab` floating button). Both are mounted at the page level and
are not dependent on individual layout code. UNVERIFIED by live
browser screenshot this pass.

---

## 6 · Publishing and visibility

**Business row visibility**
- `nex_business` row has no `is_published` / `is_live` /
  `shop_status` / `visibility` column (grep for those names returned
  nothing). The shop is reachable at `/nex-native/<slug>` whenever a
  matching slug exists and is returned by `getBusinessBySlug`.
- Owner-ownership is enforced via `owner_account_id` on `nex_business`
  (used by `manage/orders/[orderId]/page.tsx` for the detail guard).

**Product visibility** (status column, enum)
- Type: `type NexProductStatus = "draft" | "live" | "archived"`
  (`src/lib/nex-native/types.ts:794`).
- Public shop reads only `status = 'live'` products:
  `listProductsByBusiness(business.id, "live")` in
  `product-service.ts:435`.
- Owner is the one who flips `draft → live → archived` through the
  product editor (not audited this pass — out of scope).

**Preview mode**
- Owner self-view: `/nex-native/<slug>?preview=1` with the owner's
  session renders a gold ribbon pinned to the top ("Preview · you are
  viewing this shop as a visitor") and a "Back to Manage" link
  (`[businessSlug]/page.tsx:463`).
- Non-owners who hit `?preview=1` get a no-op (the ribbon gate forces
  `isPreviewMode = false`).

**Verdict**  There is no "shop-level publish toggle" today. A shop is
"live" when (a) the business row exists with a slug, and (b) at least
one product with `status = 'live'` exists (or the owner accepts the
empty-state prompt). Product-level status (`draft` / `live` /
`archived`) is the only gating primitive.

---

## Recommendations (OPTIONAL, ranked by impact)

Every item below is optional, non-blocking, and does not require any
platform rebuild. Order is impact-first.

1. **Resolve the `product_landscape_round` ambiguity** — either rename
   the id to `product_round_alias` and drop the duplicate layout
   function, OR make it a real Landscape+Round hybrid. Today it is a
   1-line alias whose label and gallery blurb disagree with its body
   (`layouts.tsx:408`, `cover/preview/page.tsx:55`). Owner choice;
   either direction is a tiny change.
2. **Fix the stale "10 layouts" comments** — update
   `cover/layout-ids.ts:17` and `cover/preview/page.tsx:3` to say 11.
   Add `accommodation` to the `COVER_LAYOUT_DONE` set in
   `cover/preview/page.tsx:70` so it gets the green tick in the
   internal gallery. Cosmetic, zero runtime effect.
3. **Soft-couple template to business category** — when the business
   category is `accommodation`, suggest the Accommodation layout
   first in the template picker (not force; the frozen doctrine says
   "categories are recommendation, never permission"). Small nudge,
   larger payoff when a hospitality owner lands on the picker and
   doesn't scroll past the 10 product/cafe tiles.
4. **Move the shop-backgrounds PRESETS array into a server module**
   — today the catalogue lives inside `_client.tsx` (1 600+ lines) and
   is duplicated by the server allowlist in `themes/_actions.ts`
   (`PRESET_BACKGROUND_META`). One source would remove the drift
   risk. Pure refactor, no behaviour change.
5. **Add a lightweight shop-ready indicator** (owner view only) —
   compute a derived "ready to share" state from live-product count +
   logo + cover + category and surface it on `/manage/shop`. No new
   DB column needed. Helps owners decide when to send their slug.

---

## Outstanding at the 40-minute boundary

- **UNVERIFIED (safe)**: no live-browser screenshots this pass — the
  founder's dev server was intentionally not driven. The preview
  route exists at `/nex-native/cover/preview/[layoutId]` and renders
  each layout under a theme query. If the next bounded block is
  authorised, this is the clean way to capture one PNG per layout
  without touching data.
- Not started: per-layout pixel comparison, product-sheet open from
  each template, ShopChatFab interaction, mobile viewport capture.

**Nothing in this report requires action.** All findings are
observations; recommendations are optional.
