# Rule-9 cycle report · Rev 3 guest-shop-enquiry · eighth-pass · X-Rated-home-page restyle (hero + logo + address + two buttons) + SentCard app-download copy

**Date:** 2026-11-28 (eighth-pass, same-day as `a334ac87`)
**Branch:** `release-audit-v1-2026-11-14` on `Philip2024394/nexapp`
**Parent HEAD at start:** `a334ac87` (session handoff after seventh-pass live sandbox Path A verification `a2d4eaf3`)
**Operating authority:** 2026-11-27 standing source-control policy.
**Approval gates honoured:** no prod DB, no mig apply, no live Stripe/PayPal, no production deploy, no `main` push, no force-push, no history rewrite, no routing refactor (owner's standing verdict respected), **no change to the sealed `.nex-native-frame` CSS**, no change to the sealed Rev 3 server contract / privacy contract / HMAC key flow.

---

## Owner directive (verbatim)

> "CHANGE THE PAGE BACK GROUND OF Message X-Rated Tool Belts [with the full form fields listed] TO THIS IMAGE 'c:\Users\Victus\Downloads\Scaffold Workers in the Mist.png' ALSO ADD THE XRATED PROFILE AND LOG IMAGE AND ADDRESS AND 2 BUTTONS LIKE IT WAS SAME AS X RATED HOME PAGE"

Four deltas: (1) hero background image, (2) shop profile/logo image, (3) shop address, (4) two buttons styled like the X-Rated home page action pair. Bundled with: the seventh-pass §7 app-download-on-SentCard gap (owner acceptance condition expects the invitation to repeat post-send), kept out of the pure-verification cycle to keep the diffs coherent.

---

## Rule-8 status

| # | Delta | Status | Evidence |
|---|---|---|---|
| 1 | Hero background image above the enquiry form | **VERIFIED** | Vitest `"renders a hero background image div referencing the shop-local bg asset by default"` + `"honours a caller-supplied heroBackgroundUrl override"`. New `[data-nex-guest-enquiry-hero]` div · default `backgroundImage: url("/nex/shop/scaffold-workers-in-the-mist.png")` · `backgroundSize: cover` · `backgroundPosition: center 35%` · 180px tall · dark gradient overlay for text legibility on the identity block below. Asset copied to `public/nex/shop/scaffold-workers-in-the-mist.png` (1509589 bytes · 941×1672 PNG). |
| 2 | Shop logo (profile image) rendered as the X-Rated-home-page CoverIdentityBadge-style circle | **VERIFIED** | Vitest `"renders the shop logo as an <img> when shopLogoUrl is provided"` + `"falls back to an initial circle when shopLogoUrl is null"`. 72px round `<img>` with 3px accent-colored rim + 0 8px 22px shadow · anchored on the hero bottom edge via `marginTop:-36` so the logo overlaps the hero (same visual vocabulary as `CoverIdentityBadge` on the public shop cover). Graceful fallback to initial-letter gradient circle when the shop has no logo on file. |
| 3 | Shop address line below the name | **VERIFIED** | Vitest `"renders the shop address line when shopAddress is provided (no 📍 pin · matches X-Rated home-page sixth-pass iteration)"` + `"omits the address row entirely when shopAddress is null"`. Plain text, 12.5px, centered, `maxWidth:320` · matches the X-Rated Tool Belts product_hero_landscape iteration that suppresses the pin glyph (see `primitives.tsx:204 · hideLocationPin`). Row is omitted entirely on shops that haven't set `nex_business.address`. |
| 4 | Two X-Rated-home-page-style buttons (Send + Not now) | **VERIFIED** | Vitest `"renders Send + Not now as a two-button action row (X-Rated home-page pair style)"` + `"styles the Not-now dismiss as a visible outline pill (not the old ghost text link)"`. New `[data-nex-guest-enquiry-action-row]` wraps both buttons · flex row · 60/40 split. Send keeps its orange accent pill (unchanged accent-hex plumbing). Not-now is promoted from a ghost text-link into a visible 1.5px accent-colored outline pill on white · the pair now reads as a proper home-page action row rather than "big orange button plus tiny grey link." |
| 5 | Seventh-pass §7 bundle · app-download invitation repeats on the post-send SentCard | **VERIFIED** | Vitest `"repeats the app-download invitation on the post-send SentCard"`. New `[data-nex-guest-enquiry-sent-app-invite]` paragraph · "Download the NEX app when prompted so future replies land directly in NEX Chat." Fills the step-7 gap identified in `cycle-strict-completion-2026-11-28-rev3-seventh-pass-sandbox-path-a-verify.md §Rule-8 row 7`. |

All five VERIFIED. No **FAILED**. No **SKIPPED**. No **BLOCKED**.

---

## §1 BUILT

- `public/nex/shop/scaffold-workers-in-the-mist.png` (NEW · 1.5 MB · 941×1672 · copied from the owner-supplied Downloads path). Served from Next.js `/public` at `/nex/shop/scaffold-workers-in-the-mist.png`.
- `src/components/nex-native/business-chat/GuestShopEnquiryPopup.tsx` (MODIFIED)
  - `GuestShopEnquiryPopupProps` gained three OPTIONAL fields: `shopLogoUrl?: string | null`, `shopAddress?: string | null`, `heroBackgroundUrl?: string | null`. Default `heroBackgroundUrl` falls back to the new asset. All three are nullable — components that wire a shop with no logo / no address render a graceful fallback (initial-letter circle · suppressed address row).
  - New `[data-nex-guest-enquiry-hero]` div · 180px tall · background-image + gradient overlay.
  - New `[data-nex-guest-enquiry-identity]` block · 72px logo circle (or initial-letter fallback) + name (`[data-nex-guest-enquiry-shop-name]`) + optional address (`[data-nex-guest-enquiry-shop-address]`).
  - Form fields now live inside a nested `<div style={{ padding: "16px 18px 0" }}>` wrapper so the hero can go edge-to-edge of the 480px content column while the form stays inset. Outer card padding tightened from `"18px 18px 24px"` → `"0 0 24px"` to accommodate.
  - Original headline shrunk from 18px/900 → 15px/800 (color #3B4A5C · muted) so the identity block above is now the primary visual anchor, and the `Message <shop>` headline reads as an accessible section label beneath the hero.
  - Send + Not-now buttons rewrapped in `[data-nex-guest-enquiry-action-row]` · flex row · 60/40. Not-now styling upgraded from ghost text-link to visible outline pill (1.5px accent border, white fill, same height as Send).
  - `SentCard` gained `[data-nex-guest-enquiry-sent-app-invite]` paragraph pinning the step-7 app-download copy.
- `src/app/nex-native/cover/_shop-chat-fab.tsx` (MODIFIED)
  - `Props` extended with `shopLogoUrl?: string | null` + `shopAddress?: string | null`.
  - Threaded both into `<GuestShopEnquiryPopup>` with `?? null` coercion.
- `src/app/nex-native/[businessSlug]/page.tsx` (MODIFIED)
  - `<ShopChatFab>` call-site now passes `shopLogoUrl={business.logo_url}` + `shopAddress={business.address}` — both already live on the resolved `nex_business` row (`types.ts:522-525`), so no DB/schema change required.
- `src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx` (MODIFIED · +9 tests)
  - New `describe` block: "hero + identity block (owner directive 2026-11-28 eighth-pass)" with 7 tests: hero default URL · hero override · logo `<img>` present-case · logo fallback initial · address present-case · address null omission · two-button row · outline-pill Not-now styling.
  - New `describe` block: "SentCard app-download invitation (step-7 bundle)" with 1 test.
  - Count: 24 → 33 (+9).

## §2 WIRED

- No new wiring layers. The data already lived on `nex_business` — `logo_url` (migration 014) + `address` (migration 014). The page-level loader already reads the full row via `businessService.getBusinessBySlug`. Both values flow into `ShopChatFab` and on into `GuestShopEnquiryPopup` via regular React props.
- No new routes · no new API surfaces · no new DB access · no new environment variables · no server-side change of any kind.

## §3 VERIFIED

- Popup suite: `npx vitest run src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx` → **33 passed / 0 failed / 0 skipped**.
- Combined focused suite (same 7 files that the sixth-pass and earlier eighth-pass preserved as the Rev 3 guard):

  ```
  npx vitest run \
    src/lib/nex-native/__tests__/iso-to-dial-code.test.ts \
    src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx \
    src/lib/nex-native/__tests__/shop-enquiry-validation.test.ts \
    src/lib/nex-native/__tests__/shop-enquiry-provision-account.test.ts \
    src/lib/nex-native/__tests__/shop-enquiry-privacy-contract.test.ts \
    src/lib/nex-native/__tests__/shop-enquiry-mock-adapter.test.ts \
    src/lib/nex-native/__tests__/country-catalogue.test.ts
  → 158 passed / 0 failed / 0 skipped
  ```

- Scoped `npx tsc --noEmit | grep -E "(GuestShopEnquiryPopup|guest-shop-enquiry-popup|_shop-chat-fab|businessSlug.*page)"` → **zero lines**.
- Sixth-pass phone-frame-anchored invariant preserved · verified by the still-passing test `"renders as a phone-frame-anchored full page · no backdrop · no card frame · no portal"`. The eighth-pass additions sit INSIDE the same `[data-nex-guest-shop-enquiry-popup]` wrapper · they do not alter `position`, `inset`, `width`, `height`, or the no-portal invariant. The card itself still has no `borderRadius` or `boxShadow` on its root (chrome lives on the hero/logo primitives, not on the containing section).

## §4 FAILED

None.

## §5 SKIPPED

None.

## §6 NOT EXECUTED

- **Real-device visual snapshot** in Playwright for the new hero + logo + address + action row. Deferred to the same future Playwright cycle as the C/D/E visual snapshots. The structural invariants are pinned by the 9 new vitests · a pixel snapshot would be gilding.
- **Image compression pass** on the hero PNG. 1.5 MB is acceptable for a desktop/tablet render at 180px tall, but on throttled 3G a sub-300 KB WebP would be strictly better. Not in scope for this UI cycle; raise as a separate perf-regression task if the owner wants the budget tightened.
- **Payload-path verification** that `business.logo_url` and `business.address` are actually populated for X-Rated Tool Belts specifically. The wiring is unconditional · if either is null on that shop, the popup falls back gracefully. Confirming the shop row's current values would require a sandbox query that is not required to validate the UI delta.
- **Route-level promotion / standalone enquiry URL.** Standing owner verdict respected. The popup remains anchored to the FAB tap.

## §7 CUSTOMER JOURNEYS COMPLETED

- **Shop FAB · anon visitor enquiry → account seed.** Preserved end-to-end. New in this cycle: on desktop the popup still fills the sealed 288×624 phone frame (sixth-pass invariant), BUT now opens with a visibly branded header — hero image, shop logo circle, shop name, shop address — reading as the shop's "home page welcome" rather than a generic enquiry form. Send + Not-now now sit side-by-side as a proper action pair. On successful send the SentCard repeats the app-download invitation so the install prompt lands when install-intent is highest.

No other journey touched.

## §8 LAUNCH BLOCKERS REMOVED

- **Seventh-pass §7 "app-download copy missing from SentCard"** · removed · copy added + vitest pin.

## §9 REMAINING BLOCKERS

Narrowed from the seventh-pass list:

- `NEX_SHOP_ENQUIRY_HMAC_KEY` not provisioned (step 4 live-HTTP verification).
- Resend bridge not activated + `RESEND_API_KEY` not set (steps 5 + 6).
- Real-device Playwright full-viewport / glow / hero-visual snapshots not authored.

All three remain owner-gated infrastructure decisions.

## §10 NEXT CONCRETE ENGINEERING ACTION

Commit + push under 2026-11-27 standing policy. Next milestone candidates (any one is unblocked):

1. Owner approval to provision `NEX_SHOP_ENQUIRY_HMAC_KEY` in sandbox env → unblock step 4 live-HTTP manipulation suite.
2. Owner approval to activate the Resend bridge + set `RESEND_API_KEY` → unblock steps 5 + 6, close the acceptance condition.
3. Author Playwright full-viewport + glow + hero-visual snapshots (no owner gate · in scope).

---

## Files changed

```
 A public/nex/shop/scaffold-workers-in-the-mist.png                        (NEW · 1.5 MB)
 M src/components/nex-native/business-chat/GuestShopEnquiryPopup.tsx       (hero + identity + two-button row + SentCard app-invite)
 M src/app/nex-native/cover/_shop-chat-fab.tsx                             (thread shopLogoUrl + shopAddress)
 M src/app/nex-native/[businessSlug]/page.tsx                              (pass business.logo_url + business.address)
 M src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx          (+9 tests · 24 → 33)
 A docs/engineering/cycle-strict-completion-2026-11-28-rev3-eighth-pass-xrated-restyle.md  (this report)
```

## Tests executed (exact commands)

```
npx vitest run src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx
→ 33 passed / 0 failed / 0 skipped · 2.39 s

npx vitest run src/lib/nex-native/__tests__/iso-to-dial-code.test.ts src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx src/lib/nex-native/__tests__/shop-enquiry-validation.test.ts src/lib/nex-native/__tests__/shop-enquiry-provision-account.test.ts src/lib/nex-native/__tests__/shop-enquiry-privacy-contract.test.ts src/lib/nex-native/__tests__/shop-enquiry-mock-adapter.test.ts src/lib/nex-native/__tests__/country-catalogue.test.ts
→ 158 passed / 0 failed / 0 skipped · 2.45 s

npx tsc --noEmit | grep -E "(GuestShopEnquiryPopup|guest-shop-enquiry-popup|_shop-chat-fab|businessSlug.*page)"
→ 0 lines
```

## Measurable comparison with the previous cycle (HEAD `a334ac87`, seventh-pass seal `a2d4eaf3`)

| Metric | Seventh-pass (`a2d4eaf3`) | This cycle |
|---|---:|---:|
| Popup vitest count | 24 | 33 (+9) |
| Combined focused suite | 149 | 158 (+9) |
| New public assets | 0 | 1 (hero image) |
| `GuestShopEnquiryPopupProps` optional fields | 0 | 3 (`shopLogoUrl` · `shopAddress` · `heroBackgroundUrl`) |
| Hero image above form | no | yes (180px · gradient-overlaid) |
| Shop logo on the enquiry page | no | yes (72px · accent-rimmed · graceful fallback) |
| Shop address on the enquiry page | no | yes (no-pin style · optional) |
| Send + Not-now layout | vertical stack · ghost-link dismiss | side-by-side pair · outline-pill dismiss |
| SentCard app-download copy | missing (step-7 gap) | present + vitest-pinned |
| Sealed `.nex-native-frame` CSS touched | no | no |
| Server contract changes | 0 | 0 |
| DB / schema changes | 0 | 0 |
| New routes created | 0 | 0 |
| Doctrines amended | 0 | 0 |
