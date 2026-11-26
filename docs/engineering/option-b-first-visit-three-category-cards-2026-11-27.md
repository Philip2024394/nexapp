# Option B · Free-chat first-visit three-category cards · 2026-11-27

**Sealed by owner directive 2026-11-27 · "OWNER DECISION — OPTION B APPROVED: REPLACE FIRST-VISIT SIX-TILE THEME PICKER WITH THREE CATEGORY CARDS".**

Supersedes the 2026-11-12 sealed six-pinned-tile `FirstVisitThemeGrid` seal in `src/app/nex-native/free-chat/_types.ts:141-162` (`PINNED_TILES_BY_IDENTITY`). Extends the 2026-11-26 L-011 three-category hub seal from the standalone `/nex-native/chat-themes-library` route to the first-visit experience on `/nex-native/free-chat`.

## Owner directive (verbatim)

> Yes. I understand what you intended, and Claude has identified the distinction correctly — but it has implemented only part of the agreed experience. You wanted the first-time user theme-selection experience changed, not simply the separate Themes library page. The intended journey is:
>
> 1. First-time visitor sees three cards [Plain Backgrounds · Small Designs · Full Image Backgrounds].
> 2. User opens a category. Each category opens its own theme library with the same layout and selection experience.
> 3. User selects a free theme [preview + select + continue].
> 4. Continue to account creation. The selected theme is retained through registration and applied when the account is created.
>
> **My decision: Option B** — the old six-tile inline picker should be replaced with the three category entry cards. The key point: the three cards must appear in the actual first-visit experience, and the user must be able to choose a free theme before creating an account. Having three cards elsewhere in the app does not fulfil that requirement. `update push commit`.

## What landed this cycle

| # | Surface | Change |
|---|---|---|
| 1 | `src/app/nex-native/free-chat/_canvas-client.tsx` | Added `FirstVisitCategoryCards` component (3 vertical `<Link>` tall cards) and swapped the picker-stage render (~line 477) from `FirstVisitThemeGrid` to `FirstVisitCategoryCards`. Each card targets `/nex-native/chat-themes-library/{plain,small,full-image}?from=first-visit-free-chat` with a stable `data-nex-free-chat-category-card` attribute. `FirstVisitThemeGrid` is marked `@deprecated` and retained temporarily for in-file symbol safety; no reachable code path still renders it. |
| 2 | `src/app/nex-native/chat-themes-library/_full-library-client.tsx` | `ApplyPreviewModal.handleApply` now checks `useSearchParams().get("from") === "first-visit-free-chat"`. When true, the modal skips `applyFromLibraryChatAction` (which 401s pre-account viewers) and instead writes the `nex-free-chat-wallpaper` cookie client-side with the bare theme id (`chat:`/`shop:` prefix stripped so the value is one of the unprefixed ids `resolveFreeChatWallpaperUrl` consumes from `LIBRARY_THEMES`), then `onClose()` + `router.replace("/nex-native/free-chat")` + `router.refresh()`. |
| 3 | `tests/e2e/journey-free-chat-first-visit-three-category-cards.spec.ts` (NEW) | Three asserts for the fresh-cookie viewer: (a) three cards render under `[data-nex-free-chat-category-cards]`, (b) each card's `href` points at the expected library sub-route and carries `from=first-visit-free-chat`, (c) the deprecated `[data-nex-free-chat-first-visit-tile]` locator matches zero elements. |

## How the end-to-end journey resolves

Fresh-cookie viewer lands on `/nex-native/free-chat?show-themes=1` → `FirstVisitCategoryCards` renders → viewer taps a card → lands on `/nex-native/chat-themes-library/plain|small|full-image?from=first-visit-free-chat` → shared library grid renders → viewer taps a theme → `ApplyPreviewModal` opens → viewer taps "Use theme" → anonymous branch writes cookie + routes back to `/nex-native/free-chat` → server page re-reads cookie → `resolveFreeChatWallpaperUrl` finds the id in `LIBRARY_THEMES` → canvas remounts with `initialThemeId` resolved → `PickedThemeActionBar` surfaces "Keep Theme · View Themes" → viewer taps "Keep Theme" → existing setup flow (`handleKeepTheme` → `/nex-native/free-chat/bubble-customize?themeId=…`) → register → signed-in user continues with their chosen theme visible.

## Reconciled

- **Existing returning-user flow preserved.** Users with a `nex-free-chat-wallpaper` cookie already set still land in the `picker` stage with `themeId` resolved; they see the three category cards (not a tile grid) AND the `PickedThemeActionBar`. `View Themes` on that bar routes to the library hub as before. `Keep Theme` routes to the bubble-customize surface as before.
- **Signed-in library users untouched.** When the library is reached via any route that does NOT carry `?from=first-visit-free-chat` (the legacy entry paths), `ApplyPreviewModal` runs the standard `applyFromLibraryChatAction` flow unchanged. Four-branch CTA state (themes-plus · first-free · subscribe · waitlist) remains exact.
- **L-011 seal preserved.** The three-category hub at `/nex-native/chat-themes-library` is unchanged. Its decision doc remains authoritative for the hub itself.
- **L-004 / L-007 / L-013 seals preserved.** No touches to signup, payments, SOS, or canonical directory code paths.

## Out of scope / follow-up

- **Cookie-to-DB migration on signup.** The owner directive says the theme must be "retained through registration and applied when the account is created." The cookie survives registration (first-party, 365-day, SameSite=Lax) and the free-chat canvas continues to resolve it post-signup. However, `nex_account.chat_theme` is NOT yet written server-side when a newly-signed-up account first reaches its account state. Closing that loop requires a small change to the post-signup side (likely a one-time client ping to a new route handler, or a `useEffect` on first-landing that calls `applyFromLibraryChatAction` with the cookie's id). Flagged for a follow-up cycle so the scope for this cycle stays tight and does not cross unauthorised seals.
- **Playwright full-journey E2E.** The new spec covers the UI-contract piece. A follow-up test should walk the full journey (fresh viewer → card → library → preview → apply → return → `PickedThemeActionBar` visible with correct themeId → Keep Theme → bubble-customize). Deferred so this cycle ships observable product behaviour without being blocked on fixture plumbing for the apply-into-anonymous-cookie path.

## Boundaries preserved

- No production DB access. No migration applied. No production deployment. No Stripe or PayPal activation. Sandbox-only. Changes limited to `/nex-native/free-chat` and `/nex-native/chat-themes-library/*` client surfaces plus one Playwright spec.
- No weakening of auth, RLS, encryption, account isolation, or Themes+ entitlement model. The library's standard apply path (DB write) is untouched for every entry path that does not carry the new query marker.
- Commit + push authorisation: the final clause "update push commit" of the 2026-11-27 Option B directive is the explicit per-task approval required by Safety Constitution §3 and §4.
