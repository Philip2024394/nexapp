# NEX Bisnis First-Entry · Phase 2 Implementation Report · 2026-10-14

Status: implemented locally · NOT committed · NOT pushed · awaiting
owner review. Pre-existing worktree preserved. `D:/trades` untouched.

Authorisation: owner-approved **1B + 2C**.

Companion docs:
- `docs/doctrine/nex-bisnis-first-entry-audit-2026-10-14.md`
- `docs/doctrine/nex-bisnis-first-entry-phase-2-plan-2026-10-14.md`

## 1 · Exact files changed

### New files

| Path | Role | Lines |
|---|---|---|
| `src/app/nex-native/business-setup/make-it-yours/_progress.tsx` | Shared `(1 of 2)` / `(2 of 2)` indicator + back-link primitive. Server-render-safe · no `"use client"`. | 128 |
| `src/app/nex-native/business-setup/make-it-yours/theme/page.tsx` | Step 1 RSC · session + business-ownership guards · premium-aware theme picker · form posts to sealed `updateChatThemeAction` with `next=` to Step 2. | 320 |
| `src/app/nex-native/business-setup/make-it-yours/cover/page.tsx` | Step 2 RSC · 10-tile grid using canonical `COVER_LAYOUT_IDS` + `COVER_LAYOUT_LABELS` · each tile with "Preview" (new tab to sealed `/cover/preview/[layoutId]`) + "Choose". | 340 |
| `src/app/nex-native/business-setup/make-it-yours/_cover-step-action.ts` | `"use server"` action parallel to the sealed `/manage/shop/_cover-layout-action.ts`. Owner-guards · validates via canonical `isValidCoverLayoutId` · writes via Phase-1-fixed `businessService.updateCoverLayoutId`. Success → `/nex-native/${slug}?setup=complete` · failure → Step 2 with error query. | 94 |
| `src/app/nex-native/business-setup/make-it-yours/__tests__/make-it-yours.test.ts` | Focused source-shape + pure-function coverage · 40 tests. | 410 |
| `docs/doctrine/nex-bisnis-first-entry-phase-2-plan-2026-10-14.md` | Pre-coding behavioural spec (refresh / back-nav / failed-save / returning-user). | 310 |

### Edited files (minimal · additive)

| Path | Change |
|---|---|
| `src/app/nex-native/onboarding/first-product/page.tsx` | +1 line · pass `businessId={business.id}` prop to `<FirstProductClient>`. |
| `src/app/nex-native/onboarding/first-product/_first-product-client.tsx` | +12 / −2 · add `businessId: string` to `Props` + destructure · change the single "Skip for now" link's `href` from `/nex-native/${slug}` to `/nex-native/business-setup/make-it-yours/theme?businessId=${businessId}` + a data-attribute test selector. Form `action={createFirstProductAction}` byte-identical. |

### NOT touched (sealed · preserved)

- `src/app/nex-native/_actions.ts` · `createBusinessAction` terminal redirect byte-identical · `createFirstProductAction` byte-identical · `updateChatThemeAction` reused as-is (consumed via its sealed `next=` param contract).
- `src/app/nex-native/manage/shop/_cover-layout-action.ts` · sealed `updateBusinessCoverLayoutAction` byte-identical (still redirects to `/manage/shop?ok=cover_layout`). The test file explicitly pins this to catch future drift.
- `src/lib/nex-native/business-service.ts` · unchanged in Phase 2 (Phase 1 fix remains the Phase 1 scope).
- `src/lib/nex-native/account-service.ts` · untouched.
- `src/lib/nex-native/chat-theme-service.ts` · reused as read-only.
- `src/app/nex-native/cover/layout-ids.ts` · reused as read-only.
- `src/app/nex-native/home/*` · first-contact · first-visit · untouched.
- All other sealed routes, predicates, services, and migrations.

## 2 · Flow (final, as built)

```
   ┌─────────────────────────────────────┐
   │ User selects Bisnis (home)          │
   │  shopTile → /onboarding             │
   └────────────────┬────────────────────┘
                    ▼
   ┌─────────────────────────────────────┐
   │ Business created · sealed           │
   │  createBusinessAction (unchanged)   │
   │  → auto-suggests cover_layout_id    │
   │  → redirects to /onboarding/first-  │
   │     product?slug=<slug>             │
   └────────────────┬────────────────────┘
                    ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ /onboarding/first-product celebration (sealed · unchanged)  │
   │                                                              │
   │  Add product → createFirstProductAction (sealed · unchanged)│
   │                → redirects to /nex-native/${slug}            │
   │                → bypasses two-step (owner-approved limitation)│
   │                                                              │
   │  Skip for now · make it yours in 2 steps → (modified Link)  │
   │                → /business-setup/make-it-yours/theme?businessId=X│
   └────────────────┬────────────────────────────────────────────┘
                    ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │ Step 1 · /business-setup/make-it-yours/theme?businessId=X         │
   │  · session + ownership guard                                       │
   │  · lists live catalogue · premium themes locked for non-entitled   │
   │  · form posts to sealed updateChatThemeAction                      │
   │  · hidden next=/business-setup/make-it-yours/cover?businessId=X    │
   │  · sealed action writes nex_account.chat_theme + redirects via next│
   └────────────────┬──────────────────────────────────────────────────┘
                    ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │ Step 2 · /business-setup/make-it-yours/cover?businessId=X         │
   │  · session + ownership guard                                       │
   │  · 10 canonical COVER_LAYOUT_IDS tiles · current pre-selected     │
   │  · each tile has Preview (new tab · sealed /cover/preview/...)    │
   │  · submit → new updateBusinessCoverStepAction (bound with businessId)│
   │  · action writes via Phase-1-fixed businessService.updateCoverLayoutId│
   └────────────────┬──────────────────────────────────────────────────┘
                    ▼
   ┌─────────────────────────────────────┐
   │ /nex-native/${business.slug}?setup=complete │
   │  · shop public page · sealed        │
   └─────────────────────────────────────┘
```

## 3 · Verification against the owner's "specifically verify three things"

### 3.1 · Real persistence (not just a successful-looking preview)

- **Chat theme**: form `action={updateChatThemeAction}` references the sealed server action by direct import. That action writes `nex_account.chat_theme` via `accountService.updateChatTheme(session.account.id, theme)` — this is the SAME path the sealed `/create-account/pick-theme` and `/chat-themes-library` surfaces use. No duplication.
  - Validation: proven at `make-it-yours.test.ts > theme/page.tsx · Step 1 structure > form posts to the sealed updateChatThemeAction with hidden next=cover`.
  - Catch: in-vitest tests do NOT exercise the live Supabase round-trip. Verified at the code-wiring level only.
- **Cover layout**: new action `updateBusinessCoverStepAction` validates the layoutId via canonical `isValidCoverLayoutId` then calls `businessService.updateCoverLayoutId(businessId, layoutId)` — the Phase-1-fixed primitive. No duplication.
  - Validation: proven at `make-it-yours.test.ts > _cover-step-action.ts · structure > uses the Phase-1-fixed business-service primitive`.
  - Catch: same · wiring-level verification only.

### 3.2 · Safe recovery · retry without losing selection or creating duplicate business

- **Business creation never happens inside Phase 2**. `createBusinessAction` is sealed and runs BEFORE the two-step. Step 1 and Step 2 only operate on an EXISTING `businessId` that is validated server-side via `businessService.getBusinessById(businessId)` + ownership check.
- **Step 1 failure path** (sealed `updateChatThemeAction` behaviour): on an invalid-theme or premium-gate failure, the sealed action redirects to `/chat-themes-library?e=...&m=...`. User's selection is NOT returned to Step 1 (sealed behaviour).
  - Mitigation applied: Step 1 server-renders premium themes with a visible "LOCKED" chip and a `<Link>` to `/settings/tier` INSTEAD of a submit button. A non-entitled user physically cannot submit a premium theme. The sealed-action premium gate is a backstop for adversarial POSTs.
  - Known residual limitation: if a DB blip occurs during `accountService.updateChatTheme` itself, the sealed-action redirect to `/chat-themes-library?e=theme_update_failed` loses the user's Step 1 context. This is documented in the plan doc as a non-blocking tradeoff.
- **Step 2 failure path**: new `updateBusinessCoverStepAction` on validation failure OR DB failure redirects BACK to Step 2 with `?e=cover_invalid|cover_failed&m=<msg>&businessId=<id>`. User's cover selection in the picker re-reads the current `cover_layout_id` from DB (still the previous value if save failed) — picker shows the state as it actually is, no fake "saved" state. User can pick again.
  - Validation: proven at `make-it-yours.test.ts > _cover-step-action.ts · structure > invalid layoutId redirects back to Step 2 with error` + `DB failure redirects back to Step 2 with error`.
- **Browser refresh at any step**: server-side re-reads `session.account.chat_theme` (Step 1) and `business.cover_layout_id` (Step 2) → picker re-renders with current pre-selected. No fake state.
- **Browser back from Step 2 to Step 1**: Step 1's explicit back-link (not browser history) targets Step 1; browser-history back to Step 1 shows the picker with the newly-saved theme pre-selected. User can change it again.
- **Returning user who left mid-flow**: Step 2 is a settings-style page. If they return manually to `/business-setup/make-it-yours/cover?businessId=X`, they see the picker with current cover pre-selected. Nothing claims completion.

### 3.3 · Correct first-time behaviour · returning-user bypass · no sealed-predicate change

- **Returning business owners landing on `/manage`, `/${slug}`, home, or anywhere else**: unaffected. No forced redirect. The two-step is reachable ONLY via the modified Skip-link on `/onboarding/first-product` (owner-approved 1B) OR by manual navigation (honest settings surface).
- **Sealed `shouldShowFirstVisitInvitation` predicate** at `src/app/nex-native/home/_first-visit-invitation.tsx:47-56`: byte-identical. Not referenced by Phase 2 code.
- **Sealed `shouldShowFirstContact` predicate** at `src/app/nex-native/home/_first-contact-predicate.ts`: byte-identical. Not referenced by Phase 2 code.
- **Separate free-chat Themes tour** at `/nex-native/chat/first-visit/*`: byte-identical. Not referenced by Phase 2 code.
- **Sealed first-contact panel** at `src/app/nex-native/home/_first-contact-panel.tsx` (committed as `b5bae9f` on `origin/main`): untouched by Phase 2.

## 4 · Test evidence

Command:
```
./node_modules/.bin/vitest run \
  src/app/nex-native/business-setup/make-it-yours \
  src/lib/nex-native/__tests__/business-service-cover-layout.test.ts \
  src/app/nex-native/home \
  src/app/nex-native/chat/first-visit \
  src/lib/nex-native/__tests__/nex-official-welcome.test.ts
```

Result:
```
Test Files  6 passed (6)
     Tests  216 passed (216)
  Duration  445ms
```

Breakdown:

- `business-setup/make-it-yours/__tests__/make-it-yours.test.ts` · **40/40 pass** · the new Phase 2 coverage. Covers:
  - Progress primitive structure
  - Step 1 session + ownership guards · sealed action reuse · premium gate · entitlement derivation · back-nav target · error banner · no DB mutation
  - Step 2 session + ownership guards · canonical COVER_LAYOUT_IDS import · all 10 layouts rendered · bound action (not sealed one) · preview in new tab · error banner · no DB mutation · no biometric/face/avatar claims in rendered copy
  - Cover-step action · canonical validator · Phase-1-fixed primitive · owner-guard · session guard · retry preserves place · success routes to shop slug · no sealed-service bypass
  - First-product chain · businessId prop · Skip-link now points at Step 1 · sealed `createFirstProductAction` form-action preserved
  - Sealed `/manage/shop` cover-action untouched (byte-identical)
- `__tests__/business-service-cover-layout.test.ts` · 11/11 (Phase 1 regression · still green)
- `home/__tests__/first-contact-panel.test.ts` · 57/57 (sealed · untouched)
- `home/__tests__/first-visit-invitation.test.ts` · 30/30 (sealed · untouched)
- `chat/first-visit/__tests__/first-visit.test.ts` · 57/57 (sealed · untouched)
- `__tests__/nex-official-welcome.test.ts` · 10/10 (sealed · untouched)

TypeScript check on Phase 2 touched files:
```
./node_modules/.bin/tsc --noEmit 2>&1 | grep -E "make-it-yours|onboarding/first-product"
```
→ no matches · zero errors across the four new source files + two edited files.

## 5 · Honest limitations (surfaced for owner review)

### 5.1 · Product-submit path bypasses the two-step

The sealed `createFirstProductAction` terminal redirect (sealed
2026-10-01) was NOT modified. Users who submit a first product follow
its sealed redirect to `/nex-native/${slug}` and bypass Step 1 and
Step 2 entirely. Only the Skip-link path chains into the two-step.

This was the owner-approved tradeoff of 1B over 1A. The two-step
pages remain reachable manually to all owners afterwards (honest
settings surface), so product-submit users can STILL run the setup
later — they just aren't guided through it automatically.

If owner wants universal coverage, two Phase 2b options:
- Modify `createFirstProductAction` terminal redirect (sealed break · explicit authorisation required).
- Add a "Make it yours →" banner on the shop slug page for freshly-created businesses (new scope).

### 5.2 · Step 1 failure redirects to the chat-themes-library (sealed)

The sealed `updateChatThemeAction`'s error-redirect behaviour sends
all failures to `/chat-themes-library?e=...&m=...`, not back to
Step 1. If the premium-gate backstop fires (adversarial POST) OR a
DB blip occurs, the user is bounced out of the two-step flow and
loses their place.

Mitigation applied: pre-filter the Step 1 picker to show premium
themes as LOCKED (no submit button), so legitimate users physically
cannot trigger the premium-gate failure.

Residual: a true DB write failure still bounces the user. The
alternative — modifying the sealed `updateChatThemeAction` redirect
to honor a "fail-next" param — is a sealed-surface change not
authorised in Phase 2. Acceptable Phase-2-today limitation.

### 5.3 · Returning-user guard is implicit, not enforced

Per the owner-approved 2C model, "returning user" is handled by the
fact that no OTHER surface forces users into the two-step. There is
no server-side "setup complete" flag · the pages are honest settings
surfaces open to any owner.

Consequence: a user can manually re-enter `/business-setup/make-it-yours/theme`
later and run through again. That's not a "repeat forced setup" · it's
just the settings surface at the same URL. Owner's spec explicitly
authorised this model (no new flag, no new column, no cookie).

### 5.4 · Live-DB verification not performed

In-vitest tests exercise source-shape + pure predicates. The actual
Supabase write path for both `updateChatTheme` and `updateCoverLayoutId`
is NOT exercised in this phase (owner guardrail: "No database
queries or writes"). Code-wiring is proven; live persistence is a
separate verification scope requiring either an owner-authored
Playwright authed journey OR a manual browser session.

### 5.5 · Visual confirmation not performed

No `npm run dev` session, no browser inspection. The dev server at
`localhost:3008` is running (`PID 7172` · HMR will pick up these new
files) but I did not instrument it. Owner can refresh
`/nex-native/business-setup/make-it-yours/theme?businessId=<any-business-id-they-own>`
to visually confirm.

### 5.6 · Playwright authed scenarios not added

Owner's spec permits them but they require `tests/e2e/.auth/state.json`
which does not exist. I did not attempt to create one. Scenarios can
be authored once the authed harness is in place; the DOM selectors
in the new files use stable `data-nex-make-it-yours-*` attributes so
Playwright pins will be straightforward.

## 6 · Final diff summary

### Status

```
 M src/app/nex-native/onboarding/first-product/_first-product-client.tsx
 M src/app/nex-native/onboarding/first-product/page.tsx
?? src/app/nex-native/business-setup/make-it-yours/
?? docs/doctrine/nex-bisnis-first-entry-phase-2-plan-2026-10-14.md
?? docs/doctrine/nex-bisnis-first-entry-phase-2-implementation-2026-10-14.md
```

### Line totals (new + edited · Phase 2 scope only)

| Scope | Lines |
|---|---|
| New source files (progress + Step 1 + Step 2 + cover-step action) | 882 |
| New test file | 410 |
| First-product edits (page + client) | +13 / −2 |
| New doctrine docs (plan + report) | ~700 |

## 7 · Guardrail compliance

- [x] Preserve pre-existing worktree changes · 34 pre-session modified files + 177 untracked files · unchanged.
- [x] Phase 1 (cover validator fix) remains local and uncommitted · unchanged.
- [x] First-contact panel commit `b5bae9f` on `origin/main` · unchanged.
- [x] No commit · no push · no reset · no stash · no branch change.
- [x] No DB query / write / migration / `.env.local` read / dependency install / deployment / server restart.
- [x] `D:/trades` not touched.
- [x] No sealed route or contract modified.
- [x] No new DB column, migration, cookie, or completion flag.
- [x] No duplicate theme catalogue · no duplicate cover-id list · no duplicate persistence service.
- [x] No fake "saved" state · all persistence goes through existing services.
- [x] Honest "coming soon" + honest limitations surfaced in-doc.
- [x] Returning-user bypass is implicit via honest-settings-surface model.
- [x] Pre-coding doc written before any code · owner's Phase 2 prerequisite satisfied.

**Stopping here for owner review. Do not begin Phase 3 (business
chat + four-option slider) without separate authorisation.**
