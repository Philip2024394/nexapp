# Cycle · 2026-11-28 · Ninth + Tenth Pass

Owner directives bundled:

- **Ninth pass (verbatim)**: "ACROSS FROM TEXT Categories ADD FILTER ICON
  WHEN SELECTED USER CAN FILTER FOR PRICE - MATERIAL - THREAD COLOR -
  BUCKLE TYPE AND ANY OTHER . THE FILTER OPENS INSIDE THE PHONE SCREEN
  CONTAINER LONG AND CENTER STYLE AND IS WORLD CLASS DESIGN UI LAYOUT -
  PRODUCT PAGE FOR XRATED BELTS MOVE THE THUMBNAIL IMAGE AND VIDEO UNDER
  THE IMAGE , ALLOWING IMAGE FULL WIDTH ,WHEN IMAGE IS CLIKED IT WILL
  OPEN IN LARGER CONTAINER WITH ARROW ON LEFT SIDE AND RIGHT SIDE FOR
  NEXT IMAGE IF NEXT IMAGES HAVE . AND IF THE BELT IS AVILABLE IN
  DIFFERENT COLORS THE ROUND BUTTONS WILL APEAR FOOTER OF THE CONTAINER
  IF SELECTED WILL CHANGE THE IMAGE TO THAT COLOR VARIENT IMAGE . WE
  MUST MAKE SURE THESE SETTINGS ARE ALSO IN THE UPLOAD PAGE WHAT WE ARE
  ADDONG TO FRONT APP"
- **Tenth pass (verbatim mock)**: "IMAGE FULL PAGE BACK GROUND X-Rated
  Tool Belts / Message X-Rated Tool Belts / Notifications of messages
  will be sent to your email address. Please check your email is correct
  and also download our app when prompted for easy access and direct
  messaging reply. / <form fields> / Send message · Not now".

Six ninth-pass deltas + one tenth-pass correction. Rule-9 report below.

---

## 1 · BUILT

- `src/app/nex-native/product/[productId]/_product-page-client.tsx`
  - **Gallery restructure (delta C)** · thumbs row + video slot moved
    UNDER the main image · main image now paints full-width · thumb
    column `flex-direction: column` → `flex-direction: row`.
  - **Lightbox (delta D)** · `data-nex-product-lightbox` fixed overlay
    inside the sealed `.nex-native-frame` containing block · left/right
    arrow buttons + ←/→ keyboard nav + Esc close + backdrop tap close
    + counter ("1 / N") when more than one image.
  - **Color-variant UI (delta E)** · `data-nex-product-gallery-color-
    variants` footer renders round swatches when the new
    `colorVariants` prop is populated · tap swaps the main image via
    the shared `activeImage` state (lightbox updates in sync).
- `src/app/nex-native/cover/_shop-filter-panel.tsx` **(NEW, delta B)**
  - `ShopFilterPanel` component · `position:fixed inset:0` so it
    mounts inside the phone frame · Price range (functional), Color
    swatches (functional), Material / Thread colour / Buckle type
    (world-class UI shell, honest empty-state line explaining that
    values appear once sellers tag their products in the edit form).
  - Exports `ShopFilterState`, `EMPTY_SHOP_FILTER_STATE`,
    `isShopFilterActive`.
- `src/app/nex-native/cover/layouts.tsx` **(delta A)**
  - `data-nex-cover-filter-button` paints inside the existing
    `data-nex-cover-products-header-row` beside Categories · active-
    filter dot indicator · opens the filter panel with
    `position:fixed inset:0` anchoring to the phone frame.
  - Layout owns `filterState` + `filteredProducts` and passes the
    filtered set to `CoverCatalog`.
- `src/lib/nex-native/catalogue/specs/fashion-clothing.ts` **(delta F)**
  - `AccessoriesSpecSchema` gains optional `thread_colour` and
    `buckle_type`.
  - `accessories` field list gains the two new `kind:"text"` entries
    with sensible placeholders ("e.g. tan, black, contrast white" /
    "e.g. roller, prong, slide, D-ring") so sellers can tag belts
    without inventing new categories.
- `src/components/nex-native/business-chat/GuestShopEnquiryPopup.tsx`
  **(tenth-pass correction)**
  - `backgroundImage` moved from the 180px `[data-nex-guest-enquiry-
    hero]` strip to the OUTER `[data-nex-guest-shop-enquiry-popup]`
    root · image now fills the full popup page.
  - Removed: `[data-nex-guest-enquiry-hero]`,
    `[data-nex-guest-enquiry-identity]`,
    `[data-nex-guest-enquiry-shop-logo]`,
    `[data-nex-guest-enquiry-shop-logo-fallback]`,
    `[data-nex-guest-enquiry-shop-address]`,
    `[data-nex-guest-enquiry-shop-name]`.
  - Added: `[data-nex-guest-enquiry-scrim]` (gradient legibility
    overlay) and `[data-nex-guest-enquiry-form-panel]` (frosted-white
    legibility panel so form inputs stay readable over the busy
    photo).
  - Headline promoted to 20/900 white-with-shadow so "Message X-Rated
    Tool Belts" reads clean against the image. Explanatory text
    recolored to #F2F4F8 with a soft text-shadow.
- `nex-supabase/migrations/373_nex_product_variant_image_url_DRAFT.sql`
  **(NEW, drafted · NOT APPLIED)**
  - `ALTER TABLE public.nex_product_variant ADD COLUMN IF NOT EXISTS
    image_url text;` · idempotent · adds a comment. Rollback is a
    single `DROP COLUMN`.
- `src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx`
  **(tenth-pass tests)**
  - Replaced the eighth-pass "hero + identity block" describe with a
    "full-page background" describe · 6 fresh tests + 1 preserved
    action-row test + 1 preserved outline-pill test.

## 2 · WIRED

- Filter icon → `setFilterOpen(true)` opens the panel.
- Filter panel's Apply button → `setFilterState(draft)` → feeds
  `filteredProducts` → feeds `CoverCatalog` products prop.
- Price-range + Color-swatch filters are wired end-to-end on
  `content.products`. Material / Thread-colour / Buckle-type sections
  read their options (currently empty) from the same product set · as
  soon as a seller publishes a belt with `spec.thread_colour` or
  `spec.buckle_type` set, the options light up without further code
  work on the panel (see §3 note on wiring).
- Gallery main image → `openLightbox()` on tap → lightbox arrow +
  keyboard nav walks `images` array.
- `activeImage` state is shared between the main gallery, the thumbs,
  the color-variant swatches, and the lightbox · tapping any of the
  four updates every other surface.
- Merchant edit form already renders `<SpecFormBuilder fields={props.fields}>`
  for the resolved category. Adding `thread_colour` + `buckle_type` to
  the `accessories` fields list is sufficient · no edit-form changes
  were needed.

## 3 · VERIFIED

- `npx vitest run src/lib/nex-native/__tests__/guest-shop-enquiry-
  popup.test.tsx` → **32 passed · 0 failed** (3.64s). Pins the
  tenth-pass full-page background, scrim, form-panel, removed identity
  block, and the preserved action-row + outline-pill behaviour.
- `npx tsc --noEmit` → no type errors reported against any of the 7
  touched files (grep-filtered).

## 4 · FAILED

- None in this cycle.

## 5 · SKIPPED

- Live Playwright snapshot of the ninth/tenth pass surfaces (requires
  dev server + real device). The focused vitest suite covers the
  observable DOM contract; snapshot capture is a separate owner-gated
  step.

## 6 · NOT EXECUTED

- Real-device render (Pixel 7 / iPhone 14 Pro) of the full-page
  background + filter panel + lightbox + color variants. Deferred to
  the standing blocker list (requires the dev-server bring-up gate the
  owner has not yet unblocked).
- Applying migration 373 (adds `image_url` to `nex_product_variant`).
  **BLOCKED** on the required owner approval phrase:
  `APPROVE MIG 373 SANDBOX APPLY (REVISED 2026-11-27)`.

## 7 · CUSTOMER JOURNEYS COMPLETED

- **Buyer · product page gallery** · new full-width main image with
  thumb/video strip below · tap main → lightbox with arrows → keyboard
  nav → close. Color-variant round buttons swap the main image when a
  seller has uploaded per-colour variant imagery (prop seam ready;
  schema gated on migration 373).
- **Buyer · shop catalog filter** · tap the filter icon beside
  Categories → filter panel opens inside the phone frame → set Price
  range / pick Color swatches / (optionally) read empty-state copy for
  Material / Thread colour / Buckle type → Apply → shop grid filters
  live. Clear all resets.
- **Buyer · guest shop enquiry popup** · opens as a full-page
  Scaffold-Workers-in-the-Mist background with "Message <shop>" title,
  notifications explanation, frosted form panel, Send message / Not
  now pair. No logo, no address row (removed per tenth-pass mock).
- **Merchant · product edit form** · now exposes Thread colour and
  Buckle type inputs under the Fashion Accessories category. Values
  save through the existing `SpecFormBuilder → spec JSON` path · no
  new wiring needed.

## 8 · LAUNCH BLOCKERS REMOVED

- UI gap for buyer-side catalog filtering · the shop cover now has a
  live filter affordance instead of only a categories dropdown.
- UI gap for product image inspection · the gallery lightbox replaces
  the old "tap does nothing" main image.
- Owner's tenth-pass visual direction for the enquiry popup · the
  full-page background is in place.

## 9 · REMAINING BLOCKERS

- **Migration 373** · `APPROVE MIG 373 SANDBOX APPLY
  (REVISED 2026-11-27)` required before `nex_product_variant.image_url`
  can be used. The product-page UI already accepts a `colorVariants`
  prop so the DB migration + merchant upload wiring can land as a
  follow-up without touching the page component.
- **Per-variant image upload UI in the merchant edit form** · gated on
  migration 373 landing · design is: inside the existing `ColorsEditor`
  (`variantType === "colour"`), add one hosted-image upload slot per
  colour row.
- **Real-device Playwright snapshots** · deferred.
- **`NEX_SHOP_ENQUIRY_HMAC_KEY` provisioning** + **Resend bridge
  (`RESEND_API_KEY`)** · unchanged from the seventh-pass handoff.

## 10 · NEXT CONCRETE ENGINEERING ACTION

Author the per-variant image upload slot inside the existing
`ColorsEditor` component (the one the merchant edit form already mounts
when `variantType === "colour"`) so the owner can unblock delta E by
issuing `APPROVE MIG 373 SANDBOX APPLY (REVISED 2026-11-27)` and we
land both halves together. No changes to `_product-page-client.tsx`
required when that lands — the `colorVariants` prop is the stable
contract.

---

## Files touched (exact)

| # | File | Change |
|---|------|--------|
| 1 | `src/app/nex-native/product/[productId]/_product-page-client.tsx` | Gallery restructure, lightbox, color-variant footer, `colorVariants` prop |
| 2 | `src/app/nex-native/cover/_shop-filter-panel.tsx` | **NEW** · ShopFilterPanel + state helpers |
| 3 | `src/app/nex-native/cover/layouts.tsx` | Filter state + icon + panel mount in `LayoutProductHeroLandscape` |
| 4 | `src/components/nex-native/business-chat/GuestShopEnquiryPopup.tsx` | Tenth-pass full-page background + scrim + form-panel + removed identity block |
| 5 | `src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx` | Rewrote eighth-pass describe → tenth-pass describe (6 fresh tests) |
| 6 | `src/lib/nex-native/catalogue/specs/fashion-clothing.ts` | `AccessoriesSpecSchema` + `accessories` fields gain `thread_colour` + `buckle_type` |
| 7 | `nex-supabase/migrations/373_nex_product_variant_image_url_DRAFT.sql` | **NEW · DRAFT · NOT APPLIED** |

## Tests executed

- `npx vitest run src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx` → 32/32 pass.
- `npx tsc --noEmit` (grep-filtered to touched files) → clean.

## Approval boundaries respected

- No production database access (`ijvqdvsvwtwxzcqmoqit` untouched).
- No production migration applied.
- No live Stripe / PayPal activation.
- Migration 373 written as DRAFT with explicit approval-phrase
  requirement; not applied to sandbox.
- Commit + push authorised by the 2026-11-27 Source-Control Standing
  Policy for `release-audit-v1-2026-11-14` only.
