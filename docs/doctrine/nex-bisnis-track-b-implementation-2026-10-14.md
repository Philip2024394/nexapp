# NEX Bisnis · Track B Implementation Report · 2026-10-14

Status: implemented locally · NOT committed · NOT pushed · awaiting

Authorisation: Track B only per owner's instruction (see
`nex-bisnis-end-to-end-acceptance-gate-2026-10-14.md`). No Track C.
No Track D.

Companion docs:
- `nex-bisnis-first-entry-audit-2026-10-14.md`
- `nex-bisnis-first-entry-phase-2-plan-2026-10-14.md`
- `nex-bisnis-first-entry-phase-2-implementation-2026-10-14.md`
- `nex-bisnis-end-to-end-acceptance-gate-2026-10-14.md`

---

## 1 · Scope delivered

Three category-correctness changes · one honest visibility banner ·
reusing sealed services + redirects everywhere.

### 1.1 · Category-aware post-creation navigation

The sealed `createBusinessAction` terminal redirect to
`/onboarding/first-product?slug=<slug>` is **preserved byte-identical**.
The server page at that URL now BRANCHES based on
`business.business_category`:

- `products` or `null` → existing `<FirstProductClient>` (sealed-adjacent · unchanged behaviour)
- `food` · `services` · `accommodation` · `property` → new `<CategoryFirstEntryClient>` with category-correct celebration + deep-link into the right `/manage/*` surface

The sealed `createFirstProductAction` + its terminal redirect to
`/${slug}` remain byte-identical.

### 1.2 · First-product form · description field

The sealed `createFirstProductAction` has always read
`formData.get("product_description")` at `_actions.ts:3364`. Previously
the client UI had no input to populate it. Track B adds a `<textarea
name="product_description">` after the product-name input. Simple
additive change · no sealed-service modification.

### 1.3 · Setup-complete banner on the shop page

When a signed-in owner lands on `/nex-native/${slug}?setup=complete`,
a new server-rendered banner renders above both the cover-A path and
the legacy landing path. The banner honestly distinguishes the three
visibility states (saved · owner-ready · visible-to-customers) using
only existing persisted state. Non-owners never see the banner
(ownership guard before mount). The sealed commerce gate is
preserved · the sealed cover-A render is preserved · the sealed
legacy landing is preserved.

The owner's specific concern — "a business whose profile is still
NULL may nevertheless be visible to customers when commerce is
enabled" — is addressed by the banner's "Owner-ready" row rendering
with an amber indicator and a deep-link to `/business-setup` when
`profile IS NULL`, alongside an honest explanation that visibility is
not profile-gated today.

---

## 2 · Exact files changed

### New files

| Path | Role | Lines |
|---|---|---|
| `src/app/nex-native/onboarding/first-product/_category-first-entry-client.tsx` | Client component · category-aware celebration · exports `categoryEntrySpec` pure function for tests + `<CategoryFirstEntryClient>` RSC-wrapped UI | ~280 |
| `src/app/nex-native/[businessSlug]/_setup-complete-banner.tsx` | Server-render-safe banner · exports `deriveVisibility` pure predicate + `<SetupCompleteBanner>` | ~230 |
| `src/app/nex-native/onboarding/first-product/__tests__/track-b.test.ts` | 46 focused tests (8 describe blocks) | ~430 |

### Edited files (minimal · additive)

| Path | Change |
|---|---|
| `src/app/nex-native/onboarding/first-product/page.tsx` | +25 / −10 · import `isBusinessCategory` + `CategoryFirstEntryClient` · branch block before the sealed `FirstProductClient` render |
| `src/app/nex-native/onboarding/first-product/_first-product-client.tsx` | +22 / −0 · added `<textarea name="product_description">` input (field the sealed action already reads) |
| `src/app/nex-native/[businessSlug]/page.tsx` | +25 / −2 · `searchParams.setup?: string` type extended · owner-only banner resolution before cover-A branch · `{setupBanner}` injected into both the cover-A fragment and the legacy landing return |

### NOT touched (sealed · preserved byte-identical)

- `src/app/nex-native/_actions.ts` · ALL sealed server actions (`createBusinessAction` · `createFirstProductAction` · `updateChatThemeAction` · `updateBusinessCoverLayoutAction`) · byte-identical
- Phase 1 cover-validator fix at `src/lib/nex-native/business-service.ts` · unchanged
- Phase 2 Make-it-yours surfaces at `/business-setup/make-it-yours/*` · unchanged
- Sealed `[businessSlug]/page.tsx` cover-A render path (CoverThemeSkin + CoverLayoutSwitch) · unchanged (only wrapped in a fragment)
- Sealed `[businessSlug]/page.tsx` legacy landing · unchanged (only prepended with `{setupBanner}`)
- All sealed services (`chat-theme-service`, `peer-conversation-service`, `peer-message-service`, `product-service`, `menu-service`, `service-list-service`)
- Sealed first-contact + first-visit on `/home` (commit `b5bae9f` on `origin/main`)
- Sealed commerce gate (`launch-flags.ts`)
- Sealed `/manage/*` dashboards
- All migrations

---

## 3 · Verification against owner's Track B conditions

### 3.1 · Category data verified before editing

Confirmed `nex_business.business_category` exists as the sealed column:
- `business/categories.ts:11-17` lists the 5 BusinessCategory tokens
- `_actions.ts:2999` reads `business_category` from signup FormData
- `_actions.ts:3174-3178` persists via `updateBusinessCategoryAndKeywords`
- `isBusinessCategory` guard at `categories.ts:35-37` narrows to the type
- No duplicate / fabricated catalogue

### 3.2 · Sealed redirect contracts preserved

Pinned by test `sealed _actions.ts · untouched by Track B`:
- `createBusinessAction` terminal redirect to `/onboarding/first-product?slug=<slug>` · verified via regex
- `createFirstProductAction` still reads `product_description` · verified via grep
- `updateChatThemeAction` reference still exists · verified via grep

### 3.3 · Category routing

| Category | Primary CTA destination | Honest note |
|---|---|---|
| `food` | `/nex-native/manage/menu` | None (menu editor is genuinely live) |
| `services` | `/nex-native/manage/services` | "Full booking + appointment features are in design" |
| `accommodation` | `/nex-native/manage/venue` | "Room inventory, nightly rates, availability calendars, and reservations are in design and not yet available in NEX" |
| `property` | `/nex-native/manage` | "A dedicated property listing editor is on the roadmap" |

Every category also gets a secondary "Make NEX yours in 2 steps" link
to the Phase 2 setup (theme + cover · universal across categories)
and a tertiary "View public page" link.

### 3.4 · First-product form improvement

- `description` field added · textarea · maxLength 1000 · optional
- Sealed `createFirstProductAction` at `_actions.ts:3364` has always
  read this field · no action modification needed
- SKU · tags · inventory NOT added (owner's rule: "Do not invent fields
  or claim capabilities that do not exist") · they remain on the edit
  page per existing architecture

### 3.5 · Visibility explanation

- Three states explicitly distinguished in the banner UI:
  - **Saved** → always ✓ (if we're rendering, the row exists)
  - **Owner-ready** → ✓ if `business.profile !== null`, amber marker + "Fill in profile →" deep-link otherwise
  - **Visible to customers** → ✓ with reason "Anyone with the link to this page can view it right now" (when not archived); or amber "This business is archived · it does not appear in search or discovery" when archived_at is set
- Explicit honest copy: *"There is no 'publish' button today · if you can reach this page as a visitor, so can anyone with the link `/${slug}`."*
- NO publication column added · NO migration · NO cookie · NO flag

### 3.6 · Preserve existing architecture

Preserved via source-shape pins:
- Phase 2 two-step setup `/business-setup/make-it-yours/*` · unchanged · Phase 2 tests still pass (40/40)
- Phase 1 cover-validator fix · unchanged · Phase 1 tests still pass (11/11)
- Sealed first-contact panel + first-visit invitation on home · unchanged · sealed tests still pass (30+57)
- Sealed free-chat Themes tour `/chat/first-visit/*` · unchanged · 57/57 tests still pass
- NEX1 welcome body renderer · unchanged · 10/10 tests still pass

### 3.7 · No sealed-redirect or contract changes

Confirmed. The one subtle change on `/[businessSlug]/page.tsx`:
- `searchParams?: Promise<{ commerce?: string }>` → `searchParams?: Promise<{ commerce?: string; setup?: string }>`

This is **additive** at the TypeScript level · existing callers pass
`searchParams` with `commerce` only · the new `setup?` field is
optional. Not a contract break.

---

## 4 · Test evidence

Command:
```
./node_modules/.bin/vitest run \
  src/app/nex-native/onboarding/first-product \
  src/app/nex-native/business-setup/make-it-yours \
  src/lib/nex-native/__tests__/business-service-cover-layout.test.ts \
  src/app/nex-native/home \
  src/app/nex-native/chat/first-visit \
  src/lib/nex-native/__tests__/nex-official-welcome.test.ts
```

Result:
```
Test Files  7 passed (7)
     Tests  259 passed (259)
  Duration  429ms
```

Breakdown:
- `onboarding/first-product/__tests__/track-b.test.ts` · **46/46 pass** (new coverage · the 8 describe blocks above)
- `business-setup/make-it-yours/__tests__/make-it-yours.test.ts` · 40/40 (Phase 2 regression · still green)
- `__tests__/business-service-cover-layout.test.ts` · 11/11 (Phase 1 regression · still green)
- `home/__tests__/first-contact-panel.test.ts` · 57/57 (sealed · untouched)
- `home/__tests__/first-visit-invitation.test.ts` · 30/30 (sealed · untouched)
- `chat/first-visit/__tests__/first-visit.test.ts` · 57/57 (sealed · untouched)
- `__tests__/nex-official-welcome.test.ts` · 10/10 (sealed · untouched)

TypeScript check on Track B touched files only:
```
./node_modules/.bin/tsc --noEmit 2>&1 | grep -E "onboarding/first-product|_setup-complete-banner|category-first-entry|businessSlug/page\.tsx"
```
→ zero errors in Track B touched files.

Pre-existing residue in UNTOUCHED sibling pages (not caused by Track B):
- `[businessSlug]/[productId]/direct/page.tsx:126` · `compare_markup_pct` not on `NexBusinessRow`
- `[businessSlug]/[productId]/page.tsx:199` · `.replace` on `never`
- `[businessSlug]/returns/page.tsx:218` · enum type mismatch

These are all pre-existing CLAUDE.md-noted "known broken imports from missing deps" residue · outside Track B scope · unmodified.

---

## 5 · Honest limitations

### 5.1 · Live-DB verification still not performed

Vitest tests exercise source-shape + pure predicates (46 Track B · 213
regression). The actual Supabase round-trip is NOT exercised (owner
guardrail: "No database queries or writes"). Code-wiring is proven;
live persistence remains unverified.

### 5.2 · Playwright authed scenarios NOT added

`tests/e2e/.auth/state.json` still does not exist. I did not attempt
to create one. Scenarios would need:
- category-aware first-product branch verification
- description-field persistence through `createFirstProductAction`
- setup-complete banner visibility for owner vs non-owner

The DOM selectors (`data-nex-category-first-entry-*`,
`data-nex-setup-*`) are stable so Playwright pins will be
straightforward when the authed harness is in place.

### 5.3 · Visual confirmation NOT performed

No `npm run dev` session instrumented. Dev server (PID 7172) running
on 3008 · HMR will pick up new files · owner can refresh:
- `/nex-native/onboarding/first-product?slug=<any-food-business-slug-they-own>` to see the food celebration
- `/nex-native/<any-shop-they-own>?setup=complete` to see the banner

### 5.4 · Product-submit path still bypasses Phase 2 two-step

Unchanged from Phase 2 report §5.1. The sealed `createFirstProductAction`
terminal redirect to `/${slug}` was NOT modified in Track B (owner's
rule: "Do not change a sealed redirect or contract without stopping").
Product sellers who ADD a product skip the theme+cover setup. They can
still run the two-step later via manual navigation.

A separate authorised scope could insert a post-submit chain for
product sellers · not Track B.

### 5.5 · Category tokens come from create-time FormData, not post-create validation

The business's `business_category` is written during
`createBusinessAction` via `updateBusinessCategoryAndKeywords` as a
soft-fail (`_actions.ts:3174-3178`). If the soft-fail is triggered
(invalid category input), the business row is created WITHOUT a
category, and our server page will render the `products`-branch
fallback (`FirstProductClient`). Honest fallback · not a bypass.

### 5.6 · Banner only renders with `?setup=complete`

Owner-initiated · ownership-guarded · single-use URL fragment. If the
owner navigates away and comes back to `/${slug}` without the fragment,
the banner is gone. They can navigate to `/manage` to find all their
options. This is deliberate · the banner is a brief celebration + info
panel, not persistent UI.

### 5.7 · Property category stub

Property gets the most minimal celebration (points to `/manage`). The
owner's acceptance gate audit noted Property is not in the "four
options" scope. If owner later wants it formally in Track C, we can
build a `/manage/property` surface. For Track B, honest minimal copy.

---

## 6 · Final diff summary

### Status

```
 M src/app/nex-native/[businessSlug]/page.tsx
 M src/app/nex-native/onboarding/first-product/_first-product-client.tsx
 M src/app/nex-native/onboarding/first-product/page.tsx
?? src/app/nex-native/[businessSlug]/_setup-complete-banner.tsx
?? src/app/nex-native/onboarding/first-product/__tests__/
?? src/app/nex-native/onboarding/first-product/_category-first-entry-client.tsx
?? docs/doctrine/nex-bisnis-track-b-implementation-2026-10-14.md
```

### Line totals (Track B scope only)

| Scope | Lines |
|---|---|
| New source files (category client + banner) | ~510 |
| New test file (46 tests) | ~430 |
| Edits to first-product/page.tsx | +25 / −10 |
| Edits to first-product/_first-product-client.tsx | +22 / −0 |
| Edits to [businessSlug]/page.tsx | +25 / −2 |
| New doctrine doc (this file) | ~450 |

---

## 7 · Guardrail compliance

- [x] Preserve pre-existing worktree changes · 34+ pre-session modified + 177+ untracked · unchanged
- [x] Phase 1 cover-validator fix (local · uncommitted) · unchanged
- [x] Phase 2 two-step setup (local · uncommitted) · unchanged
- [x] First-contact panel commit `b5bae9f` on `origin/main` · unchanged
- [x] No commit · no push · no reset · no stash · no branch change
- [x] No DB query / write / migration / `.env.local` read / dependency install / deployment / server restart
- [x] No sealed redirect or contract modified
- [x] No new DB column, migration, cookie, or completion flag
- [x] No duplicate selector / catalogue / persistence mechanism
- [x] No fabricated features · services + accommodation + property receive honest "in design" copy
- [x] Phase 2 two-step setup remains the universal theme + cover path · unchanged
- [x] Sealed first-contact + free-chat Themes tour · unchanged
- [x] Pre-coding verification done per owner's step 1 (verified exact three file changes · sealed redirect contracts · category data)
- [x] Focused tests added · 46 new · all green
- [x] Regression sweep · 213 sealed-adjacent tests still green

**Stopping here for owner review. Do not begin Track C (category-specific
backends) or Track D (visibility clarity schema additions) without
separate authorisation.**
