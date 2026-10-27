// src/app/nex-native/onboarding/shop-theme/page.tsx
//
// NEX Onboarding · Shop Theme Selection · ABANDONED-FEATURE REDIRECT.
// --------------------------------------------------------------------------
// Original 2026-10-18 draft of this page referenced an undefined
// `SHOP_THEMES` constant alongside undeclared `NEX`, `NexPageHeader`,
// `redirect`, and `resolveNexAppSessionOrGuest` symbols. The feature
// (post-signup Step 2 "pick your shop cover theme") was authored but
// never completed · 11 TypeScript errors + runtime 500 on hit.
//
// Upstream flows (`chat-themes-library/_theme-activation-wrapper.tsx`
// line 29 + 62 · `_theme-activation-sequence.tsx` line 39) ROUTER-PUSH
// to this path at the end of chat-theme activation. Leaving the page
// broken means a user who successfully picks a chat theme crashes
// before reaching home.
//
// Repair 2026-10-27 (mandate "Close the Gaps, Wire Everything, Finish
// the Build" · autonomous honest-state restoration): the surface now
// forwards to `/nex-native/home` so the chat-theme-activation flow
// completes end-to-end rather than crashing. This matches the previous
// post-`selectShopThemeAction` destination at `onboarding/_actions.ts`
// line 25 · the net user journey is: pick chat theme → arrive at home.
// The intermediate "pick shop cover theme" step is deliberately
// deferred.
//
// Reactivation path if the founder authorises Shop Theme Step 2:
//   1. Define `SHOP_THEMES` (likely sourced from the sealed 10 cover
//      layouts at `cover-themes-library/`).
//   2. Decide the UX (cards vs. carousel · one-off vs. editable later).
//   3. Restore a real UI here that writes `nex_business.cover_layout_id`
//      via the existing `selectShopThemeAction` server action.
// Until then, do not reintroduce `SHOP_THEMES` references · the
// constant has no source of truth.

import { redirect } from "next/navigation";

export default function ShopThemePage(): never {
  redirect("/nex-native/home");
}
