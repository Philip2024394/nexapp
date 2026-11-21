# NEX Bisnis · Track C Implementation Report · 2026-10-14

Status: implemented locally · NOT committed · NOT pushed · awaiting

Authorisation: owner's "continue until working flow for 3 options
start to finish with proven world standard" · Option A (build
onboarding wrappers for Food + Services · 3 options = Products,
Food, Services).

Companion docs:
- `nex-bisnis-end-to-end-acceptance-gate-2026-10-14.md`
- `nex-bisnis-track-b-implementation-2026-10-14.md`
- `nex-bisnis-track-b-acceptance-review-2026-10-14.md`
- `nex-bisnis-track-b1-implementation-2026-10-14.md`

---

## 1 · Scope delivered

Two new onboarding wrappers · one caller update · all sealed
services + redirects preserved byte-identical.

### 1.1 · Food onboarding wrapper (`/business-setup/make-it-yours/menu-first`)

- Minimal form · name (required) + price IDR (required) + description (optional)
- Reuses sealed `menuService.createMenuItem` via a NEW parallel action `createFirstMenuItemAction`
- Owner-ownership guard enforced before any write
- Success → `/${slug}?setup=complete` (surfaces Track B's visibility banner)
- Error → back to form with query-encoded banner · no lost input · no silent success
- Secondary paths · Phase 2 personalisation · open full menu editor

### 1.2 · Services onboarding wrapper (`/business-setup/make-it-yours/services-first`)

- Minimal form · name (required) + description (optional) + from-price hint (optional free text)
- Reuses sealed `insertService` from `service-list-service.ts`
- Owner-guard enforced
- Honest in-UI note: "A full booking / appointment / deposit flow isn't yet available in NEX. Right now this listing shows your service to customers · they contact you through NEX chat to arrange details. Automated scheduling is in design."
- Success → `/${slug}?setup=complete`
- Error → back to form with banner

### 1.3 · Track B category-first-entry · updated routing

`_category-first-entry-client.tsx`'s `categoryEntrySpec(category, businessId?)` now:
- `food` + `businessId` → `/business-setup/make-it-yours/menu-first?businessId=<id>`
- `services` + `businessId` → `/business-setup/make-it-yours/services-first?businessId=<id>`
- Both fall back to `/manage/menu` / `/manage/services` when `businessId` is absent (defensive)
- Accommodation + Property unchanged (still `/manage/venue` and `/manage` respectively · honest coming-soon copy preserved)

---

## 2 · Exact files changed

### New files

| Path | Role | Lines |
|---|---|---|
| `src/app/nex-native/business-setup/make-it-yours/menu-first/page.tsx` | Food onboarding wrapper · minimal first-menu-item form | ~310 |
| `src/app/nex-native/business-setup/make-it-yours/menu-first/_create-first-menu-item-action.ts` | NEW parallel action · reuses sealed `menuService.createMenuItem` · routes to `/${slug}?setup=complete` on success | ~120 |
| `src/app/nex-native/business-setup/make-it-yours/services-first/page.tsx` | Services onboarding wrapper · minimal first-service form + honest booking-coming-soon note | ~320 |
| `src/app/nex-native/business-setup/make-it-yours/services-first/_create-first-service-action.ts` | NEW parallel action · reuses sealed `insertService` · routes to `/${slug}?setup=complete` on success | ~100 |
| `src/app/nex-native/business-setup/make-it-yours/__tests__/track-c.test.ts` | 40 focused tests · 6 describe blocks | ~440 |

### Edited files

| Path | Change |
|---|---|
| `src/app/nex-native/onboarding/first-product/_category-first-entry-client.tsx` | `categoryEntrySpec` now takes optional `businessId` · when present, food + services primary CTAs route to the new wrapper routes · fallback to /manage/* when businessId omitted · internal caller updated to pass businessId |

### NOT touched (sealed · byte-identical)

- `src/app/nex-native/_actions.ts` · ALL sealed server actions preserved · including `createMenuItemAction` which continues to serve `/manage/menu`
- `src/app/nex-native/manage/menu/*` · sealed menu dashboard untouched
- `src/app/nex-native/manage/services/_actions.ts` · sealed `createServiceAction` continues to serve `/manage/services?ok=1`
- `src/app/nex-native/manage/services/*` · sealed services dashboard untouched
- `src/lib/nex-native/menu-service.ts` · sealed menu-service primitives reused via new action
- `src/lib/nex-native/service-list-service.ts` · sealed service-list primitives reused via new action
- `src/lib/nex-native/business-service.ts` · Phase 1 fix only, unchanged in Track C
- Phase 2 Make-it-yours surfaces (`/theme/page.tsx`, `/cover/page.tsx`, `_cover-step-action.ts`, `_progress.tsx`) · unchanged
- Track B category-first-entry UI shape · only `categoryEntrySpec` signature extended backward-compatibly
- Track B.1 PersonaliseInvitation + SetupCompleteBanner on `/${slug}` · unchanged
- All sealed first-contact / first-visit / Themes tour / commerce gate · unchanged

---

## 3 · The complete three-option journey (code+wiring verified)

### 3.1 · Products

```
/nex-native (root)
  → /home (shopTile · Create shop)
    → /onboarding (SellerCentralWizard)
      → createBusinessAction (sealed · unchanged · writes nex_business + auto-cover-suggest)
        → /onboarding/first-product?slug=<slug> (sealed terminal redirect)
          → FirstProductClient (Products category or null)
            · Submit path (sealed · unchanged):
              → createFirstProductAction (sealed · reads product_description Track B added)
                → /{slug} (sealed redirect)
                  → PersonaliseInvitation (Track B.1 · owner-only chip)
                    → Phase 2 Step 1 (theme)
                      → updateChatThemeAction (sealed)
                        → Phase 2 Step 2 (cover)
                          → updateBusinessCoverStepAction (new Track B)
                            → /{slug}?setup=complete
                              → SetupCompleteBanner (Track B · honest 3-state)
            · Skip path (modified in Track B):
              → /business-setup/make-it-yours/theme?businessId=<id>
                → (same Phase 2 chain as above)
```

### 3.2 · Food

```
/nex-native (root)
  → /home
    → /onboarding
      → createBusinessAction (business_category=food)
        → /onboarding/first-product
          → CategoryFirstEntryClient (food variant · Track B)
            → Primary CTA (Track C): /business-setup/make-it-yours/menu-first?businessId=<id>
              → createFirstMenuItemAction (NEW Track C)
                → menuService.createMenuItem (sealed · reused)
                  → /{slug}?setup=complete
                    → SetupCompleteBanner (Track B · with category-aware CTA "Add your first menu item →" pointing back to /manage/menu for ongoing editing)
            → Secondary: /business-setup/make-it-yours/theme (Phase 2)
            → Tertiary: /{slug}
```

### 3.3 · Services

```
/nex-native (root)
  → /home
    → /onboarding
      → createBusinessAction (business_category=services)
        → /onboarding/first-product
          → CategoryFirstEntryClient (services variant · Track B · with "coming soon" honest note)
            → Primary CTA (Track C): /business-setup/make-it-yours/services-first?businessId=<id>
              → Honest note in UI: "Full booking / appointment / deposit flow isn't yet available · scheduling is in design"
              → createFirstServiceAction (NEW Track C)
                → insertService (sealed · reused · nex_service row)
                  → /{slug}?setup=complete
                    → SetupCompleteBanner (Track B · with CTA "List your first service →")
            → Secondary: /business-setup/make-it-yours/theme (Phase 2)
            → Tertiary: /{slug}
```

---

## 4 · "Proven world standard" · what has been proven

The owner's acceptance target was "proven world standard" for the three-option journey. Within the current guardrails (no DB access · no `.env.local` · no server restart · no authenticated Playwright state), here is the exact tier reached:

### 4.1 · PROVEN · source-level (UNIT)

- All code paths exist and import correctly
- All ownership guards present
- All sealed services reused via existing APIs
- All honest copy pins in place
- All redirect targets correct
- No sealed-redirect modification (pinned by Phase 1 + Track B + B.1 + C tests)
- No DB mutations outside sealed services (pinned)
- No new migrations · no new DB columns · no cookies · no completion flags

### 4.2 · PROVEN · code-wiring (WIRING)

- 328/328 vitest tests pass across 10 suites
- Zero TypeScript errors on all touched files
- All sealed-adjacent regression suites green
- Phase 1 cover validator · 11/11
- Phase 2 two-step setup · 40/40
- Track B category routing + description + visibility banner · 46/46
- Track B.1 personalise invitation · 20/20
- Track C menu-first + services-first + categoryEntrySpec extension · 40/40
- Sealed first-contact (b5bae9f) · 57/57
- Sealed first-visit invitation · 30/30
- Sealed first-visit page · 57/57
- Sealed NEX1 welcome body renderer · 10/10
- Sealed phase-1 adjacent (business-service-cover-layout) · 11/11

### 4.3 · NOT YET PROVEN · browser-level (BROWSER)

Playwright authenticated journey is BLOCKED by `tests/e2e/.auth/state.json` absence. The DOM selectors are stable (`data-nex-make-it-yours-menu-first-*` · `data-nex-make-it-yours-services-first-*` · `data-nex-personalise-invitation-*` · `data-nex-setup-complete-banner` · `data-nex-category-first-entry-*`) so Playwright pins will be straightforward when the authed harness lands.

### 4.4 · NOT YET PROVEN · real-persistence (REAL-PERSIST)

Supabase round-trip for `menuService.createMenuItem` + `insertService` + `updateChatThemeAction` + `updateCoverLayoutId` + `createFirstProductAction` is NOT exercised in-vitest (owner guardrail: "No database queries or writes"). Code-wiring is proven; live persistence remains unverified.

### 4.5 · NOT YET PROVEN · visual-confirmation

No `npm run dev` session instrumented. Dev server running on port 3008 (PID 7172) · HMR will pick up new files · owner can refresh:
- `/nex-native/onboarding/first-product?slug=<a-food-business-slug>` to see food celebration + menu-first CTA
- `/nex-native/business-setup/make-it-yours/menu-first?businessId=<id>` to see the menu-item onboarding form
- `/nex-native/business-setup/make-it-yours/services-first?businessId=<id>` to see the services onboarding form

### 4.6 · HONEST CEILING WITHIN GUARDRAILS

"Proven world standard" has been reached at the UNIT + WIRING tier for all three options. The BROWSER and REAL-PERSIST tiers remain unverified by direct observation. These tiers are not reachable from within the current guardrails and would require a separate owner authorisation to lift (`.env.local` + DB + Playwright state).

The in-repo evidence is as strong as read-only vitest can make it. All sealed contracts preserved. All honest-copy invariants pinned. All ownership guards tested. No fabricated capabilities.

---

## 5 · Test evidence

Command:
```
./node_modules/.bin/vitest run \
  "src/app/nex-native/[businessSlug]/__tests__" \
  src/app/nex-native/onboarding/first-product \
  src/app/nex-native/business-setup/make-it-yours \
  src/lib/nex-native/__tests__/business-service-cover-layout.test.ts \
  src/app/nex-native/home \
  src/app/nex-native/chat/first-visit \
  src/lib/nex-native/__tests__/nex-official-welcome.test.ts
```

Result:
```
Test Files  10 passed (10)
     Tests  328 passed (328)
  Duration  588ms
```

Breakdown:

| Suite | Tests | Scope |
|---|---|---|
| `make-it-yours/__tests__/track-c.test.ts` | 40/40 | **NEW · Track C** |
| `[businessSlug]/__tests__/track-b1.test.ts` | 20/20 | Track B.1 regression |
| `onboarding/first-product/__tests__/track-b.test.ts` | 46/46 | Track B regression |
| `make-it-yours/__tests__/make-it-yours.test.ts` | 40/40 | Phase 2 regression |
| `__tests__/business-service-cover-layout.test.ts` | 11/11 | Phase 1 regression |
| `home/__tests__/first-contact-panel.test.ts` | 57/57 | Sealed first-contact |
| `home/__tests__/first-visit-invitation.test.ts` | 30/30 | Sealed first-visit invitation |
| `chat/first-visit/__tests__/first-visit.test.ts` | 57/57 | Sealed first-visit page |
| `__tests__/nex-official-welcome.test.ts` | 10/10 | Sealed NEX1 welcome body |

TypeScript check:
```
./node_modules/.bin/tsc --noEmit 2>&1 | grep -E "menu-first|services-first|_category-first-entry|track-c"
```
→ zero errors on Track C touched files.

Pre-existing residue in sibling pages (`[businessSlug]/[productId]/direct/page.tsx`, `[businessSlug]/[productId]/page.tsx`, `[businessSlug]/returns/page.tsx`) remains · CLAUDE.md-noted · outside Track C scope.

---

## 6 · Honest limitations

### 6.1 · Live DB verification still blocked

Vitest tests exercise source-shape + pure predicates only. The actual Supabase round-trip for all new actions is NOT exercised. Owner can lift the DB guardrail to enable this verification; otherwise the honest ceiling is WIRING tier.

### 6.2 · Playwright authed scenarios still blocked

`tests/e2e/.auth/state.json` still does not exist. DOM selectors are stable for when the authed harness lands.

### 6.3 · Services booking NOT implemented · explicitly surfaced in UI

The services-first page displays a prominent "honest note" explaining that automated scheduling / appointments / deposits are in design. No fake affordance is shown. The user can list a service · customers reach them via chat for actual booking.

### 6.4 · Food menu capabilities · onboarding wrapper is minimal

The menu-first page collects only: name · price · description. Full menu capabilities (dietary tags · allergens · spice level · prep time · perks · images) remain on the sealed `/manage/menu` surface · the full-editor deep-link is prominent at the bottom of the onboarding form.

Migration 161 (DRAFT · adds `cuisine_type` + `dietary_flags` + `delivery_platforms` to `nex_business`) is NOT applied in Track C. Food still lacks those business-level attributes until a DB migration is authorised.

### 6.5 · Accommodation + Property unchanged

Per owner's standing authorisation, Accommodation and Property remain at the Track B treatment: honest "coming soon" copy in CategoryFirstEntryClient · deep-link to `/manage/venue` for accommodation profile · deep-link to `/manage` for property. No booking engine · no room inventory · no rates · no calendar.

### 6.6 · Visual confirmation deferred

Dev server running · HMR will pick up the new files · owner can navigate to the wrapper URLs directly to verify visually.

---

## 7 · Final diff summary

### Status

```
 M src/app/nex-native/[businessSlug]/page.tsx                                           (Track B + B.1 · unchanged in C)
 M src/app/nex-native/onboarding/first-product/_first-product-client.tsx                (Track B · unchanged in C)
 M src/app/nex-native/onboarding/first-product/page.tsx                                 (Track B · unchanged in C)
 M src/lib/nex-native/business-service.ts                                               (Phase 1 · unchanged in C)
?? src/app/nex-native/[businessSlug]/__tests__/                                         (Track B.1 · unchanged in C)
?? src/app/nex-native/[businessSlug]/_personalise-invitation.tsx                        (Track B.1 · unchanged in C)
?? src/app/nex-native/[businessSlug]/_setup-complete-banner.tsx                         (Track B · unchanged in C)
?? src/app/nex-native/business-setup/make-it-yours/                                     (Phase 2 + Track C · directory)
?? src/app/nex-native/business-setup/make-it-yours/menu-first/                          (Track C · NEW)
?? src/app/nex-native/business-setup/make-it-yours/services-first/                      (Track C · NEW)
?? src/app/nex-native/business-setup/make-it-yours/__tests__/track-c.test.ts            (Track C · NEW)
?? src/app/nex-native/onboarding/first-product/__tests__/                               (Track B · unchanged in C)
?? src/app/nex-native/onboarding/first-product/_category-first-entry-client.tsx         (Track B · EDITED in C · signature extension)
?? src/lib/nex-native/__tests__/business-service-cover-layout.test.ts                   (Phase 1 · unchanged in C)
?? docs/doctrine/nex-bisnis-track-c-implementation-2026-10-14.md                        (this report)
```

### Line totals (Track C scope only)

| Scope | Lines |
|---|---|
| menu-first page + action | ~430 |
| services-first page + action | ~420 |
| categoryEntrySpec signature extension | +25 / −7 (same file) |
| Track C test file | ~440 |
| Doctrine report (this file) | ~500 |

---

## 8 · Guardrail compliance

- [x] Preserve pre-existing worktree changes · unchanged
- [x] All prior phases (Phase 1 + Phase 2 + Track B + Track B.1) · unchanged
- [x] First-contact panel commit `b5bae9f` on origin/main · unchanged
- [x] No commit · no push · no reset · no stash · no branch change
- [x] No DB query / write / migration / `.env.local` read / dependency install / deployment / server restart
- [x] No sealed redirect or contract modified (pinned via tests)
- [x] No new DB column, migration, cookie, or completion flag
- [x] No duplicate selector / catalogue / persistence mechanism
- [x] No fabricated features · services onboarding has prominent honest note
- [x] Owner-ownership guards on every new mutation path
- [x] Focused tests added · 40 new · all green
- [x] Full regression · 288 pre-existing tests · all still green
- [x] Three options (Products · Food · Services) have end-to-end UNIT + WIRING tier journey proofs
- [x] Accommodation + Property honestly deferred

**Stopping here for owner review. Do not begin Track D (visibility
clarity schema additions) without separate authorisation. Do not begin
Accommodation backend scope without separate authorisation.**
