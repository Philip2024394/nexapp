# Rule-9 cycle report · Rev 3 guest-shop-enquiry · sixth-pass · phone-frame-anchored (clarifying fifth-pass)

**Date:** 2026-11-28 (sixth-pass, same-day as `358d4beb`)
**Branch:** `release-audit-v1-2026-11-14` on `Philip2024394/nexapp`
**Parent HEAD at start:** `358d4beb` (session handoff after fifth-pass seal `980cba3f`)
**Operating authority:** 2026-11-27 standing source-control policy.
**Approval gates honoured:** no prod DB, no mig apply, no live Stripe/PayPal, no production deploy, no `main` push, no force-push, no history rewrite, no routing refactor (owner's standing verdict respected), **no change to the sealed `.nex-native-frame` CSS**.

---

## Owner correction (verbatim)

> "I SAID MOBILE PHONE SCREEN INSIDE PHONE NOT FULL DESKTOP SCREEN"

The fifth-pass implementation set `width:100vw · height:100dvh` on the popup wrapper AND kept `createPortal(..., document.body)`. On desktop this escaped the sealed `.nex-native-frame` phone chrome and filled the entire browser viewport. The directive is: fill the phone screen (288×624 desktop frame · full viewport on real phones <500px), not the desktop.

---

## Rule-8 status

| # | Delta | Status | Evidence |
|---|---|---|---|
| 1 | Popup fills phone screen on desktop · not desktop viewport | **VERIFIED** | Vitest `"renders as a phone-frame-anchored full page · no backdrop · no card frame · no portal"` asserts `position:fixed; inset:0`, absent `width`/`height` inline styles, and `document.body.firstElementChild !== root` (no portal). All existing addenda B/C/D invariants preserved — combined focused run 149 passed. |

No **FAILED**. No **SKIPPED**.

---

## §1 BUILT

- `src/components/nex-native/business-chat/GuestShopEnquiryPopup.tsx` (MODIFIED)
  - Removed `import { createPortal } from "react-dom"`.
  - Removed the `createPortal(..., document.body)` wrapper · component now returns JSX directly (renders in-place inside its React parent, which lives inside `.nex-native-frame`).
  - Dropped `width:"100vw"` and `height:"100dvh"` from the outer `[data-nex-guest-shop-enquiry-popup]` wrapper. Sizing now comes from the frame via `position:fixed; inset:0` resolving against the frame's `transform: translateZ(0)` containing block (sealed 2026-10-26 · `nex-native.css:226-266`).
  - `mounted` gate simplified from `!mounted || typeof document === "undefined"` → `!mounted` (no more `document` guard · no more portal).
  - All other Addenda B/C/D invariants untouched: honesty copy, phone+country row + prefix match, red-glow invalid fields, "Select" sentinel, no card chrome.
- `src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx` (MODIFIED)
  - Rewrote the fifth-pass full-page test → sixth-pass version: asserts `position:"fixed"` + `inset:"0px"` + absent `width` + absent `height` + the no-portal invariant via `document.body.firstElementChild !== root`.
- `docs/engineering/guest-shop-enquiry-design-2026-11-28.md` (MODIFIED · Addendum E appended · E-1 through E-4).

## §2 WIRED

- No new wiring. The popup is now a DOM descendant of `.nex-native-frame` because `_shop-chat-fab.tsx` mounts it inside the shop page tree and we no longer portal out. The sealed `transform: translateZ(0)` on the frame does the containing-block work.
- Dismiss paths preserved: Escape key + "Not now" button. No backdrop-click path (no backdrop).

## §3 VERIFIED

- Popup suite: `npx vitest run src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx` → **24 passed** (same count; one test rewritten, not added).
- Combined focused suite: same 7 files as fifth-pass → **149 passed / 0 failed / 0 skipped**.
- `npx tsc --noEmit | grep -E "(GuestShopEnquiryPopup|guest-shop-enquiry-popup)"` → **zero lines**.

## §4 FAILED

None.

## §5 SKIPPED

None.

## §6 NOT EXECUTED

- **Real-device desktop browser confirmation** that the popup visually fills the phone frame and not the viewport. jsdom cannot test actual CSS containing-block resolution against the frame's `transform: translateZ(0)` — that's a layout-engine behaviour. The test pins the **inputs** (position+inset+no-width+no-height+no-portal) and the sealed CSS pins the **resolution**, but a real browser screenshot would close the loop. Deferred to the same future Playwright cycle as the C/D visual snapshots.
- **No route-level promotion.** Standing verdict respected.

## §7 CUSTOMER JOURNEYS COMPLETED

- **Shop FAB · anon visitor enquiry → account seed.** End-to-end preserved. New in this cycle: on desktop, tapping the FAB now opens the Send-message view inside the 288×624 phone frame — not spanning the whole desktop screen. On real phones (<500px) the frame is already full-bleed so behaviour is identical to the fifth-pass intent. Addenda B + C + D invariants (Path A auto-create, honesty copy, phone+country row + prefix match, red-glow, "Select" sentinel, no card chrome) preserved verbatim.

No other journey touched.

## §8 LAUNCH BLOCKERS REMOVED

- Desktop regression from fifth-pass: popup escaped the phone frame → **fixed**. The sealed mobile-first visual contract (every `/nex-native/*` surface lives inside the 288×624 frame on desktop) is now honoured by the Send-message view too.

## §9 REMAINING BLOCKERS

Unchanged from `358d4beb`: migration 372 not applied, `NEX_SHOP_ENQUIRY_HMAC_KEY` not provisioned, `DEFAULT_ADAPTER` still `ConsoleAdapter`, real-device Playwright full-viewport + glow snapshot not authored, live `auth.admin.createUser` not exercised against Supabase sandbox.

## §10 NEXT CONCRETE ENGINEERING ACTION

Commit + push under 2026-11-27 standing policy. Then the next milestone (owner-recommended) remains real-sandbox verification of Path A against `kdstoyyeygcopkogqsyv` (NOT prod `ijvqdvsvwtwxzcqmoqit`) per fifth-pass cycle report §10.

---

## Files changed

```
 M docs/engineering/guest-shop-enquiry-design-2026-11-28.md  (+ Addendum E)
 M src/components/nex-native/business-chat/GuestShopEnquiryPopup.tsx  (drop createPortal · drop width/height viewport pins · mounted gate simplified)
 M src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx  (rewrite fifth-pass full-page test as sixth-pass phone-frame-anchored test · +no-portal invariant)
```

## Tests executed (exact commands)

```
npx vitest run src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx
→ 24 passed / 0 failed / 0 skipped

npx vitest run src/lib/nex-native/__tests__/iso-to-dial-code.test.ts src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx src/lib/nex-native/__tests__/shop-enquiry-validation.test.ts src/lib/nex-native/__tests__/shop-enquiry-provision-account.test.ts src/lib/nex-native/__tests__/shop-enquiry-privacy-contract.test.ts src/lib/nex-native/__tests__/shop-enquiry-mock-adapter.test.ts src/lib/nex-native/__tests__/country-catalogue.test.ts
→ 149 passed / 0 failed / 0 skipped

npx tsc --noEmit | grep -E "(GuestShopEnquiryPopup|guest-shop-enquiry-popup)"
→ 0 lines
```

## Measurable comparison with the previous cycle (HEAD `358d4beb`, fifth-pass seal `980cba3f`)

| Metric | Fifth-pass (`980cba3f`) | This cycle |
|---|---:|---:|
| Popup vitest count | 24 | 24 (one rewritten) |
| `createPortal` to `document.body` | present | removed |
| Outer wrapper width inline style | `"100vw"` | `""` (frame-anchored) |
| Outer wrapper height inline style | `"100dvh"` | `""` (frame-anchored) |
| Popup DOM parent on desktop | `<body>` (escapes frame) | inside `.nex-native-frame` |
| Visual size on desktop | ≈browser viewport (wrong) | ≈288×624 phone frame (correct) |
| Visual size on <500px real phone | full viewport | full viewport (identical) |
| Sealed `.nex-native-frame` CSS touched | no | no |
| Server validator changes | 0 | 0 |
| New routes created | 0 | 0 |
| Doctrines amended | 0 | 0 |
