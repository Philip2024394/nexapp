# Rule-9 cycle report · Rev 3 guest-shop-enquiry · fifth-pass · "Select" sentinel + full-page view

**Date:** 2026-11-28 (fifth-pass, same-day as Addendum C seal `70770ce2`)
**Branch:** `release-audit-v1-2026-11-14` on `Philip2024394/nexapp`
**Parent HEAD at start:** `70770ce2` (session handoff after Addendum C phone+country prefix match)
**Operating authority:** 2026-11-27 standing source-control policy.
**Approval gates honoured:** no prod DB, no mig apply, no live Stripe/PayPal, no production deploy, no `main` push, no force-push, no history rewrite, no routing refactor (owner verdict "do not start another architecture debate").

---

## Owner directive (verbatim)

> "CHANGE SECT YOUR COUNTRY TO sELECT - SEND MESSAGE CONTAINER SHOULD BE PAGE NO CONTAINER"

Two discrete deltas: (a) country-dropdown sentinel text shortened to a single word; (b) the Send-message view is the full page, not a container overlaying the shop page.

---

## Rule-8 status by delta

| # | Delta | Status | Evidence |
|---|---|---|---|
| 1 | Country sentinel "Select your country…" → "Select" | **VERIFIED** | Vitest "renders the short 'Select' sentinel for the country dropdown" asserts exact text + explicitly rejects the old wording. |
| 2 | Popup is the page · no backdrop · no card frame | **VERIFIED** | Vitest "renders as a full page · no backdrop · no card frame" asserts `[data-nex-guest-enquiry-backdrop]` is absent, outer width/height are `100vw`/`100dvh`, inner section has no `borderRadius` + no `boxShadow`. |

No **FAILED**. No **SKIPPED**.

---

## §1 BUILT

- `src/components/nex-native/business-chat/GuestShopEnquiryPopup.tsx` (MODIFIED)
  - Country `<option value="">` text: `"Select your country…"` → `"Select"`.
  - Outer `[data-nex-guest-shop-enquiry-popup]` wrapper now fills the viewport: `width:100vw`, `height:100dvh`, `background:#FFFFFF`, `overflowY:auto`, `WebkitOverflowScrolling:touch`. Removed the dark `rgba(0,0,0,0.65)` backdrop + blur element entirely.
  - Inner `[data-nex-guest-enquiry-card]` section keeps a reading column (`maxWidth:480; margin:0 auto; padding:18px 18px 24px`) but drops card chrome: no `borderRadius`, no `boxShadow`, no `maxHeight`.
- `src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx` (MODIFIED · +2 tests · sentinel comment updated).
- `docs/engineering/guest-shop-enquiry-design-2026-11-28.md` (MODIFIED · Addendum D appended · D-1 through D-4).

## §2 WIRED

- No new wiring. Visual-mode-only change bound to existing `data-nex-guest-shop-enquiry-popup` + `data-nex-guest-enquiry-card` attributes.
- Dismiss paths preserved: Escape key + "Not now" button both still call `onDismiss`. Backdrop click path is removed because there is no backdrop any more · this is intentional per the directive.

## §3 VERIFIED

- Popup suite: `npx vitest run src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx` → **24 passed** (22 pre-cycle + 2 new).
- Combined focused suite: `npx vitest run src/lib/nex-native/__tests__/iso-to-dial-code.test.ts src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx src/lib/nex-native/__tests__/shop-enquiry-validation.test.ts src/lib/nex-native/__tests__/shop-enquiry-provision-account.test.ts src/lib/nex-native/__tests__/shop-enquiry-privacy-contract.test.ts src/lib/nex-native/__tests__/shop-enquiry-mock-adapter.test.ts src/lib/nex-native/__tests__/country-catalogue.test.ts` → **149 passed / 0 failed / 0 skipped** (was 147 · +2 new popup tests).
- `npx tsc --noEmit | grep -E "(iso-to-dial-code|GuestShopEnquiryPopup|guest-shop-enquiry-popup)"` → **zero lines**.

## §4 FAILED

None.

## §5 SKIPPED

None.

## §6 NOT EXECUTED

- **Real-device browser verification of the full-page viewport.** jsdom asserts the inline `width:100vw` + `height:100dvh` and the absence of the backdrop element; it does not confirm the dynamic viewport behaves correctly under a real iOS keyboard or Android chrome retraction. Playwright with a mobile-viewport snap would add that evidence · deferred to a later cycle, same bundle as the already-deferred Addendum C red-glow visual snapshot.
- **No route-level promotion** to a dedicated `/nex-native/shop/[slug]/enquiry` URL. Owner's standing verdict rules out an architecture debate in this cycle · the popup still mounts via `createPortal(..., document.body)` and the shop FAB is still its trigger. It is navigationally a modal view but visually a full page.

## §7 CUSTOMER JOURNEYS COMPLETED

- **Shop FAB · anon visitor enquiry → account seed.** End-to-end preserved. New in this cycle: when the visitor taps the FAB, the Send-message view fills the entire screen in white, no shop page visible behind, no card framing around the form. The country dropdown now says "Select" as a short sentinel, matching the narrow 40% column introduced in Addendum C. Addenda B + C invariants (Path A auto-create, honesty copy, mobile fit, phone↔country prefix match, red-glow invalid fields) preserved verbatim.

No other journey touched.

## §8 LAUNCH BLOCKERS REMOVED

- Visual "popup floating on top of shop page" friction removed · the Send-message surface now claims the whole viewport, so it reads as a destination screen, not an interstitial.
- Truncation risk on narrow phones for the country sentinel removed · "Select" fits inside the 40%-width column at every viewport tested.

## §9 REMAINING BLOCKERS

Unchanged from `70770ce2`: migration 372 not applied, `NEX_SHOP_ENQUIRY_HMAC_KEY` not provisioned, `DEFAULT_ADAPTER` still `ConsoleAdapter`, real-device Playwright full-viewport + glow snapshot not authored, live `auth.admin.createUser` not exercised against Supabase sandbox.

## §10 NEXT CONCRETE ENGINEERING ACTION

Commit + push under 2026-11-27 standing policy. Then the next milestone (owner-recommended in the fifth-pass message) is **real-sandbox verification of Path A**: using `kdstoyyeygcopkogqsyv` (NOT prod `ijvqdvsvwtwxzcqmoqit`), exercise `provisionShopEnquiryAccount` end-to-end: (i) brand-new email creates an unverified `auth.users` row + a linked `nex_account` row, (ii) a repeated submit by an existing `auth` user returns `pre_existing_auth_user` without a duplicate row, (iii) the enquiry row still lands with no linkage back to the account, (iv) a sign-in email delivers and the user can claim the account. Everything else on the shop-enquiry front remains behind named approvals.

---

## Files changed

```
 M docs/engineering/guest-shop-enquiry-design-2026-11-28.md  (+ Addendum D)
 M src/components/nex-native/business-chat/GuestShopEnquiryPopup.tsx  (sentinel shortened · backdrop removed · card chrome removed · outer wrapper fills viewport)
 M src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx  (+2 tests · one comment refresh)
```

## Tests executed (exact commands)

```
npx vitest run src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx
→ 24 passed / 0 failed / 0 skipped

npx vitest run src/lib/nex-native/__tests__/iso-to-dial-code.test.ts src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx src/lib/nex-native/__tests__/shop-enquiry-validation.test.ts src/lib/nex-native/__tests__/shop-enquiry-provision-account.test.ts src/lib/nex-native/__tests__/shop-enquiry-privacy-contract.test.ts src/lib/nex-native/__tests__/shop-enquiry-mock-adapter.test.ts src/lib/nex-native/__tests__/country-catalogue.test.ts
→ 149 passed / 0 failed / 0 skipped

npx tsc --noEmit | grep -E "(iso-to-dial-code|GuestShopEnquiryPopup|guest-shop-enquiry-popup)"
→ 0 lines
```

## Measurable comparison with the previous cycle (HEAD `70770ce2`, Addendum C seal `aa96f021`)

| Metric | Addendum C (`aa96f021`) | This cycle |
|---|---:|---:|
| Popup vitest count | 22 | 24 (+2) |
| Backdrop element in DOM | present (`rgba(0,0,0,0.65)` + blur) | removed |
| Outer wrapper sizing | 16px padding grid-centred card | `100vw × 100dvh` fills viewport |
| Card chrome | `borderRadius:18`, `boxShadow:0 24px 60px…`, `maxHeight:92dvh` | none · reading column only |
| Country sentinel text | "Select your country…" | "Select" |
| Server validator changes | 0 | 0 |
| New routes created | 0 | 0 |
| Doctrines amended | 0 | 0 |
| Standing architecture | preserved | preserved (owner verdict respected) |
