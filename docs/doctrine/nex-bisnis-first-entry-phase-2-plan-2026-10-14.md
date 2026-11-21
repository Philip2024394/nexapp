# NEX Bisnis First-Entry · Phase 2 Pre-Coding Behavioural Spec · 2026-10-14

Status: PRE-CODING DOC per owner's explicit Phase 2 prerequisite
("Before coding, document exactly how refreshes, back navigation,
failed saves, and returning users will behave using existing
persisted state"). No code written yet. No files modified yet.

Authorisation: `1B + 2C` resume Phase 2.

Companion documents:
- `docs/doctrine/nex-bisnis-first-entry-audit-2026-10-14.md`
- `docs/doctrine/nex-bisnis-first-entry-phase-2-implementation-2026-10-14.md` (will be written after the build pass)

---

## 1 · Entry mechanism (Gap 1 · 1B)

**Only hook that preserves ALL seals**: modify the "Skip for now" link
in `src/app/nex-native/onboarding/first-product/_first-product-client.tsx`
at line 1041.

The sealed server actions remain BYTE-IDENTICAL:
- `createBusinessAction` (`_actions.ts:2980+`) · sealed terminal
  redirect to `/onboarding/first-product?slug=<slug>` preserved.
- `createFirstProductAction` (`_actions.ts:3340+`) · sealed terminal
  redirect to `/nex-native/${slug}` preserved.

Only one JSX attribute changes: the href on the "Skip for now · add
later from /manage/products" link. Current:
```tsx
href={`/nex-native/${slug}`}
```
Becomes:
```tsx
href={`/nex-native/business-setup/make-it-yours/theme?businessId=${businessId}`}
```

The `businessId` must be passed from the server component
(`page.tsx:52-62`) into `<FirstProductClient>` as a new prop. The
server already resolves `business` from `getBusinessBySlug` at line
41-46, so `business.id` is available.

### Known limitation · surfaced explicitly

**Product-submit path is NOT chained**. Users who successfully add a
first product follow `createFirstProductAction`'s sealed terminal
redirect to `/nex-native/${slug}` and bypass the two-step entirely.

Reason: modifying `createFirstProductAction`'s redirect would break
the 2026-10-01 Seller Central seal — forbidden by owner's "Preserve
the existing 'Your shop is live' celebration and first-product
behaviour" directive.

Mitigation available (not applied in this phase · owner may authorise
later): add a secondary "Finish setup →" link on the shop slug page
for freshly-created businesses that haven't completed the two-step.
That is a separate Phase 2b scope.

### Documented honest consequence

Only skip-path users enter the two-step automatically. Product-add
users must navigate manually to `/business-setup/make-it-yours/theme`
to run the setup later (the surface is a settings-style page open to
any owner). This is a conscious tradeoff: full sequence universality
vs. preserving sealed Seller Central doctrine. The owner's
authorisation prioritised seal preservation.

---

## 2 · URL-signal model (Gap 2 · 2C)

Entry URLs:
- Step 1 · `/nex-native/business-setup/make-it-yours/theme?businessId=<uuid>`
- Step 2 · `/nex-native/business-setup/make-it-yours/cover?businessId=<uuid>`

The `businessId` is a required query parameter on BOTH pages. It is
NOT persisted as a completion marker · it only carries the business
context across the two steps.

### Why no completion derivation

- `nex_business.cover_layout_id` is auto-populated by
  `createBusinessAction` via `suggestCoverLayoutId(category)` ·
  `IS NULL` is NOT a reliable "needs setup" signal (`_actions.ts:3225-3243`).
- `nex_account.chat_theme` defaults to `"theme-0"` on account creation
  (`account-service.ts:91`) · `=== "theme-0"` cannot distinguish "never
  picked" from "picked default deliberately."
- Owner's rule: no new column, migration, cookie, or completion flag.

Therefore: the pages are **honest settings surfaces**. They are open
to any authenticated owner of a valid business. They always pre-select
the currently-persisted value. The URL-signal only triggers the
first-time ENTRY from the celebration; it never claims completion.

---

## 3 · Behavioural spec · all required cases

### 3.1 · Refresh behaviour

| On | Action | Result |
|---|---|---|
| Step 1 refresh | Server re-reads `session.account.chat_theme` | Picker re-renders with current value pre-selected · if user had just saved via a prior submit, the new value is now the current. |
| Step 2 refresh | Server re-reads `nex_business.cover_layout_id` for the given `businessId` | Picker re-renders with current cover pre-selected · same honest-settings pattern. |
| Step 1 refresh with missing/invalid `businessId` | Server redirects to `/manage` | No crash. Owner-guard runs via `businessService.getBusinessById(businessId)` + `owner_account_id === session.account.id` check. |
| Step 2 refresh with missing/invalid `businessId` | Same as Step 1 refresh with invalid businessId | Owner-guard identical. |

### 3.2 · Back navigation

| From | Back goes to | Mechanism |
|---|---|---|
| Step 1 | Shop slug `/nex-native/${slug}` | Explicit "Back" link styled below the progress bar. Not browser-history dependent. |
| Step 2 | Step 1 (preserves selection) | Explicit "← Step 1" link that re-routes to `/business-setup/make-it-yours/theme?businessId=<id>`. On re-arrival, Step 1 pre-selects the newly-saved theme (the user already saved it to proceed). |
| Browser Back from Step 1 | First-product celebration (if that's where they came from) · otherwise prior page | Standard browser history. |
| Browser Back from Step 2 | Step 1 (via sealed `updateChatThemeAction`'s `next=` honored redirect) | Standard browser history. User's state is persisted (theme was saved), so re-rendering Step 1 shows the same selection. |

### 3.3 · Failed saves

**Step 1 (chat theme) · failure routes**:

The sealed `updateChatThemeAction` has pre-existing error-redirect
behaviour that this phase cannot modify without a sealed break:
- Invalid theme → `/chat-themes-library?e=invalid_theme&m=...`
- Premium-gate failure → `/chat-themes-library?e=premium_required&m=...`
- DB failure on `accountService.updateChatTheme` → `/chat-themes-library?e=theme_update_failed&m=...`

**Mitigation**: Step 1 must server-render ONLY entitled themes as
selectable. Locked (premium) themes shown with a "LOCKED" chip and NO
submit affordance. This prevents the premium-gate error from
triggering at all — a non-entitled user physically cannot pick a
locked theme. If someone POSTs a locked theme id directly (adversarial),
the sealed action's premium gate catches it and redirects to the
library · we accept that off-happy-path redirect.

**Step 2 (cover) · failure routes**:

NEW action `updateBusinessCoverStepAction` (parallel to the sealed
`updateBusinessCoverLayoutAction`):
- Invalid layoutId → redirect to `/business-setup/make-it-yours/cover?businessId=<id>&e=cover_invalid&m=<msg>`
- Owner-guard failure → redirect to `/manage`
- DB failure → redirect to `/business-setup/make-it-yours/cover?businessId=<id>&e=cover_failed&m=<msg>`

Step 2 server component reads `e` + `m` query params and renders a
visible error banner above the picker. User's prior selection is
restored (Step 2 re-reads `cover_layout_id` which is still the
previous value if the save failed · the retry preserves their current
state).

### 3.4 · Returning-user behaviour

| User state | What they see |
|---|---|
| Returning owner lands on `/manage` after prior day | Unaffected · no forced redirect · `/manage` renders normally. |
| Returning owner lands on `/${slug}` | Unaffected · public shop page renders normally. |
| Returning owner clicks a shortcut to `/business-setup/make-it-yours/theme` | Sees the picker with their current theme pre-selected · can change or close. Honest settings surface. |
| Returning owner clicks a shortcut to `/business-setup/make-it-yours/cover` | Sees the picker with their current cover pre-selected (likely the auto-suggested one from creation OR their later pick) · can change or close. |
| Returning owner finishes first-product-add on a different business | Sealed path · goes to `/${slug}` · bypasses two-step entirely. See §1 limitation. |
| Returning owner finishes first-product-SKIP on a different business | Chains into Step 1 · same as a fresh user. The two-step is reachable on every skip event, not just the "first time ever." That is appropriate: skipping suggests the user wants to engage with onboarding more, not less. |

### 3.5 · Account/business identity continuity

- Step 1: `session.account.id` resolves from `resolveNexAppSessionFromContext()`.
  `businessId` from URL query is validated via
  `businessService.getBusinessById(businessId)` + ownership check
  (`business.owner_account_id === session.account.id`). Non-owner →
  redirect to `/manage`.
- Step 1 → Step 2: `updateChatThemeAction` honors `next` with the
  Step 2 URL carrying the SAME `businessId`. The sealed `next=`
  whitelist (`startsWith("/nex-native/") && !includes("//")`) allows
  our target.
- Step 2: `session.account.id` + `businessId` validated the same way.
- Step 2 save action: `updateBusinessCoverStepAction` receives
  `businessId` as its first arg (bound in the form `action`
  attribute), re-validates ownership, then calls
  `businessService.updateCoverLayoutId(businessId, layoutId)`.

### 3.6 · Entitlement preservation

- Chat theme premium gate: enforced server-side by sealed
  `updateChatThemeAction` lines 4441-4453. Reused unchanged.
- Step 1 UI additionally lock-indicates premium themes based on
  `accountService.effectiveTier(viewer)` — pre-check prevents the
  user from submitting a theme they can't own. Same strategy as
  `/create-account/pick-theme` and `/chat-themes-library`.
- Cover layout: no premium-gate on covers today. All 10 cover IDs
  equally available to any business owner.

---

## 4 · File inventory

### 4.1 · New files

| Path | Role |
|---|---|
| `src/app/nex-native/business-setup/make-it-yours/_progress.tsx` | Shared "(1 of 2) · (2 of 2)" progress indicator + back-link primitive. Server-render-safe. |
| `src/app/nex-native/business-setup/make-it-yours/theme/page.tsx` | Step 1 RSC. Session + business-ownership guards. Reads live theme catalogue. Renders picker with lock-indicators. Form posts to sealed `updateChatThemeAction`. |
| `src/app/nex-native/business-setup/make-it-yours/cover/page.tsx` | Step 2 RSC. Session + business-ownership guards. Reads 10 cover IDs. Renders tile grid with current selection pre-selected. Form posts to new cover-step action. |
| `src/app/nex-native/business-setup/make-it-yours/_cover-step-action.ts` | NEW `"use server"` module. Exports `updateBusinessCoverStepAction(businessId, formData)` that re-validates ownership, saves via `updateCoverLayoutId` (Phase-1-fixed), redirects to a destination determined by owner (default: shop slug) or back to Step 2 on failure. Parallel to sealed `updateBusinessCoverLayoutAction` whose `/manage/shop` redirect doesn't match our flow. |
| `src/app/nex-native/business-setup/make-it-yours/__tests__/*.test.ts` | Focused tests · navigation, account/business identity, success/failure persistence, retry, refresh/recovery, returning-user shape. |

### 4.2 · Edited files

| Path | Change |
|---|---|
| `src/app/nex-native/onboarding/first-product/page.tsx` | Pass `businessId={business.id}` prop to `<FirstProductClient>`. |
| `src/app/nex-native/onboarding/first-product/_first-product-client.tsx` | Add `businessId: string` to `Props`. Change the single "Skip for now" link's `href` from `/nex-native/${slug}` to `/nex-native/business-setup/make-it-yours/theme?businessId=${businessId}`. Preserve the surrounding copy ("Skip for now · add later from /manage/products" becomes `Make NEX yours →` or similar · owner can tune copy). |

### 4.3 · NOT touched (sealed · preserved)

- `src/app/nex-native/_actions.ts` · `createBusinessAction` · `createFirstProductAction` · `updateChatThemeAction` (reused as-is, not modified).
- `src/app/nex-native/manage/shop/_cover-layout-action.ts` · `updateBusinessCoverLayoutAction` sealed redirect preserved.
- `src/lib/nex-native/business-service.ts` · already Phase-1-fixed, no further change.
- `src/lib/nex-native/account-service.ts` · untouched.
- `src/lib/nex-native/chat-theme-service.ts` · reused as read-only.
- `src/app/nex-native/cover/layout-ids.ts` · reused as read-only.
- All other sealed routes, predicates, and services.

---

## 5 · Testing plan

Focused vitest coverage (source-shape + pure-function · no DB · no
mocks of sealed services · no live Supabase).

### 5.1 · Progress primitive

- Renders "(1 of 2)" with step=1 · "(2 of 2)" with step=2
- Back link href matches the step contract (step 1 → shop slug, step 2 → step 1)
- Mobile-first style attributes (min tap-target · overflow-safe)

### 5.2 · Step 1 (theme) source shape

- Imports `resolveNexAppSessionFromContext` · `businessService.getBusinessById` · `chatThemeService.listActiveThemes` · `accountService.effectiveTier` · `isLiveWorldId` (for live-world detection) · the sealed `updateChatThemeAction`
- Form `action` attribute references the sealed `updateChatThemeAction`
- Hidden input `next` composes `/nex-native/business-setup/make-it-yours/cover?businessId=<id>`
- Premium themes rendered with locked affordance when viewer is non-premium
- No DB `.insert()` / `.update()` / `.rpc()` in the page source
- Session guard (`if (!session) redirect("/sign-in")`)
- Business-ownership guard (`business.owner_account_id === session.account.id` else redirect `/manage`)

### 5.3 · Step 2 (cover) source shape

- Imports `COVER_LAYOUT_IDS` + `COVER_LAYOUT_LABELS` from the canonical module
- All 10 layouts rendered
- Form posts to `updateBusinessCoverStepAction` bound with `businessId`
- Current `cover_layout_id` pre-selected
- Error banner surfaces `e` + `m` query params
- Session + ownership guards same as Step 1

### 5.4 · Cover-step action

- Validates layoutId via `isValidCoverLayoutId` (reused · same canonical source as Phase 1)
- Owner-guard enforced
- Call to `businessService.updateCoverLayoutId(businessId, layoutId)`
- On success: redirect to `/nex-native/${business.slug}`
- On failure: redirect to Step 2 with query-encoded error
- No `.insert()` / `.update()` outside the sealed service helper

### 5.5 · First-product client change

- `_first-product-client.tsx` carries exactly ONE skip-link href change
- `page.tsx` passes `businessId={business.id}` through
- Sealed server actions (`createFirstProductAction` et al.) imported references unchanged

### 5.6 · Regression sweep (sealed suites)

- `home/__tests__/first-contact-panel.test.ts`
- `home/__tests__/first-visit-invitation.test.ts`
- `chat/first-visit/__tests__/first-visit.test.ts`
- `__tests__/nex-official-welcome.test.ts`
- `__tests__/business-service-cover-layout.test.ts` (Phase 1 · must still pass)

### 5.7 · What tests do NOT cover

- Live Supabase round-trip for `updateChatTheme` or `updateCoverLayoutId`
  (requires DB access · explicitly forbidden by Phase 2 guardrails)
- Full Playwright authed journey end-to-end (requires owner storage
  state · still blocked)
- Visual regression / mobile viewport screenshot

---

## 6 · Guardrail compliance checklist (pre-code)

- [x] 1B · chain via `/onboarding/first-product` celebration · no sealed server-action modification
- [x] 2C · URL-signal entry only · no new column, migration, cookie, or completion flag
- [x] Preserve `createBusinessAction` sealed terminal redirect
- [x] Preserve `createFirstProductAction` sealed terminal redirect
- [x] Preserve `updateChatThemeAction` sealed behaviour · reuse via `next=` param
- [x] Preserve `updateBusinessCoverLayoutAction` sealed redirect by introducing a NEW parallel action
- [x] Reuse canonical cover IDs from `cover/layout-ids.ts` · no duplicate list
- [x] Reuse chat-theme catalogue via `chatThemeService.listActiveThemes()` · no duplicate catalogue
- [x] Preserve `is_discoverable: false` default · no profile-field writes
- [x] Preserve `shouldShowFirstVisitInvitation` + `shouldShowFirstContact` predicates · untouched
- [x] Preserve pre-existing worktree changes (first-contact / support-background / themes-tour follow-up / Phase 1)
- [x] Known limitation explicitly surfaced: product-submit path bypasses two-step (sealed `createFirstProductAction` redirect preserved)
- [x] Known limitation explicitly surfaced: Step 1 failure redirects to chat-themes-library (sealed `updateChatThemeAction` behaviour) · pre-filter mitigates

---

## 7 · Build sequence

1. Write pre-coding doc (THIS FILE).
2. Build `_progress.tsx` primitive.
3. Build Step 1 (`theme/page.tsx`) with reused sealed action.
4. Build cover-step action (`_cover-step-action.ts`).
5. Build Step 2 (`cover/page.tsx`) with the new action.
6. Edit `_first-product-client.tsx` + its server page to chain the skip link.
7. Write focused test file(s).
8. Run focused + regression vitest.
9. Typecheck touched files.
10. Write implementation report at
    `docs/doctrine/nex-bisnis-first-entry-phase-2-implementation-2026-10-14.md`.
11. Stop for owner review.

Owner review gates for Phase 2 (per the Phase 2 authorisation):
- Diff review on all touched files
- Verify persistence paths (chat theme + cover) match the design
- Verify safe recovery · retry without losing selection · no duplicate business
- Verify returning-user bypass behaviour
- No Phase 3 begins without a separate authorisation
