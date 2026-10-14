# NEX Bisnis First-Entry Flow · Read-Only Audit · 2026-10-14

Status: READ-ONLY DISCOVERY · no source edits · no DB queries · no
`.env.local` access · no deployment · no commit · no push. Pre-existing
worktree preserved. Awaiting owner approval on §D before any build pass.

Repository: `C:/Users/Victus/nexapp` (verified · remote
`Philip2024394/nexapp.git` · branch `main`).

Executing on top of baseline `b5bae9f` (first-contact panel · already
on `origin/main`) + themes-tour follow-up in local worktree (not yet
committed).

---

## Audit A · Bisnis entry flow

### A1 · Where the Bisnis card lives

File: `src/app/nex-native/home/page.tsx:72-94` · `shopTile()` helper.

The card is rendered as one of the three round quick-actions beneath
the hero. Copy and destination depend on `hasBusiness`:

- `hasBusiness === false` → emoji `🛍`, label **"Create shop"**, href
  `/nex-native/onboarding`.
- `hasBusiness === true` → emoji `🛍`, label **"My shop"**, href
  `/nex-native/manage`.
- (For non-reseller profile kinds, different labels apply: "My work"
  for `professional`, "My journey" for `student/seeking_work/exploring`,
  "My reselling" for `reseller`. None of these are the Bisnis path.)

`hasBusiness` is derived from `ownedBusinesses.length > 0` where
`ownedBusinesses = await businessService.listBusinessesByOwner(session.account.id)`
at `home/page.tsx:162`.

### A2 · Current destination behaviour

**First-time** (`/nex-native/onboarding`):
- 4-step wizard: slug → logo → lane/category/subcategory →
  review/launch.
- Final step calls `createBusinessAction`.
- NO theme selection. NO cover selection. NO slider. User exits with
  default `chat_theme = "theme-0"` and `cover_layout_id = NULL`.

**Returning** (`/nex-native/manage`):
- Shop manager dashboard. Not scoped in this audit beyond confirming
  that it is NOT a "first-entry slider" surface.

**Separate · business-setup wizard** at `/nex-native/business-setup`:
- 6-step classification wizard (step 0 welcome → step 5 overview).
- Rev 6 FROZEN 2026-10-02. Also NO theme/cover selection.
- Gate: `nex_business.profile != null` distinguishes activated
  businesses (jump to step 5) from new/shell businesses (step 0).

### A3 · First-entry vs returning distinction

The ONLY existing distinction is `nex_business.profile IS NULL` vs
`NOT NULL` (migration 014 adds the profile column; see
`business-setup/page.tsx:10-14`).

There is NO cookie, column, or query-param that semantically means
"this user is on their very first Bisnis entry" (vs "returning for the
second time but still unactivated"). The predicate "fresh user" is
derived from account/business state, not an explicit flag.

Home-page uses the same signal at `home/page.tsx:167-169`:
```ts
const businessNexActivated = ownedBusinesses.some(
  (b) => (b as unknown as { profile?: unknown }).profile != null,
);
```
and renders the "Business NEX activation banner" only when
`!businessNexActivated`.

### A4 · Existing two-step flow

**NOT IMPLEMENTED.** No surface in the codebase guides a Bisnis user
through chat-theme choice → cover-layout choice as a sequential
two-step UX. The closest existing precedents are:

- `/nex-native/create-account/pick-theme/page.tsx` · 2-free-theme
  picker · but it is SIGNUP-only (post-signup redirect, not a Bisnis
  entry).
- `/nex-native/chat-themes-library/page.tsx` · browse-only catalogue
  (featured hero + popular strip + category grid). Not a wizard.
- `/nex-native/cover/preview/[layoutId]/page.tsx` · single-layout
  preview surface. Not a selector.

### A5 · Business-options slider

**NOT FOUND.** Grep across `src/app/nex-native/` for "business-options",
"business_slider", "options-slider", "action-slider", "quick-start",
"starter-actions" returns zero matches. The only slider-shaped UIs are:

- `_shop-slider.tsx` · horizontal product carousel inside peer chat
  (customer-facing).
- `_theme-cover-carousel.tsx` · home-page theme × cover showcase.
- `/chat/first-visit/page.tsx:220-237` · three landscape cards
  (sealed · for Chat Themes / Shop / Personalize destinations).

None of these is a "What would you like to do?" chooser for a new
business owner.

---

## Audit B · Both theme systems

### B1 · Chat theme (account-wide)

| Property | Value |
|---|---|
| Table | `nex_chat_theme` (migration 048) |
| Account column | `nex_account.chat_theme text` (migration 021 · default `"theme-0"`) |
| Catalogue count | 41+ themes · live-world themes code-registered (`nex-bubbles`, `nex-flat`, `waterworld`, `coffee`, etc.) + DB-registered |
| Service | `src/lib/nex-native/chat-theme-service.ts` |
| Update function | `src/lib/nex-native/account-service.ts:125-176` · `updateChatTheme(accountId, themeId \| null)` |
| Server action | `updateChatThemeAction` referenced in `_actions.ts` |
| Primary selection UX | `/nex-native/chat-themes-library/page.tsx` (library landing) + `/nex-native/create-account/pick-theme/page.tsx` (signup picker) |
| Persistence scope | **Per-account**. Independent of any business. |

### B2 · Chat theme availability model

Three tier values on `nex_chat_theme.tier`:

| Tier | Access |
|---|---|
| `gratis` | Always free. Live-world themes are always `gratis` (see `chat-theme-service.ts:183-227`). |
| `bisnis` | Locked for free accounts. Unlocked when `effectiveTier(account)` is `bisnis` or `pro`, OR account is within an active 7-day themes trial. |
| `pro` | Deferred phase 2 (owner's doctrine). |

Gating logic: `chat-themes-library/_phone-tile.tsx:60-71` returns
`"locked" | "trial" | "premium" | "active" | null` per tile. Trial
state computed in `_load-library-data.ts:79` as
`canUsePremium = currentTier === "bisnis" || currentTier === "pro"`.

Preview surface: tiles show rendered mock-chat composition with the
theme's palette/wallpaper applied. No "my-chat-with-this-theme"
preview that uses the viewer's actual chat; the sealed theme viewer
at `src/app/nex-native/themes/[id]/page.tsx` provides a static tour.

### B3 · Cover layout catalogue · 10 sealed IDs

File: `src/app/nex-native/cover/layout-ids.ts:18-29`.

```
1. cafe
2. cafe_landscape
3. cafe_round
4. product
5. product_landscape
6. product_round
7. product_landscape_round
8. personal_brand
9. personal_brand_landscape
10. personal_brand_round
```

**Sealed Bridge 98 · 2026-09-30 · "ONE NEX IDENTITY" doctrine.** Seven
earlier templates (restaurant · tradesperson · salon · creator ·
fashion · street_food · premium_business) were REMOVED on 2026-09-30
and will return (or not) as founder-approved layouts only.

### B4 · Cover layout persistence

| Property | Value |
|---|---|
| Column | `nex_business.cover_layout_id text` (migration 100 · nullable) |
| Doctrine | Bridge 98 · 2026-09-30 |
| Update function | `src/lib/nex-native/business-service.ts:410-443` · `updateCoverLayoutId(businessId, layoutId \| null)` |
| Preview | `/nex-native/cover/preview/[layoutId]/page.tsx` |
| Persistence scope | **Per-business**. Multiple businesses owned by the same account can carry different covers. |
| NULL default | Fallback to the legacy shared layout (backwards compatible). |

### B5 · Chat and Cover independence

**YES · independent today.**

- Chat theme writes `nex_account.chat_theme` · changing it never
  touches any `nex_business` row.
- Cover layout writes `nex_business.cover_layout_id` · changing it
  never touches `nex_account`.
- The home carousel at `home/page.tsx:171-184` paints every cover
  layout IN THE VIEWER'S chat theme, so the TWO choices compose
  visually, but they persist on separate rows and separate columns.

### B6 · Verified non-biometric

The 10 cover IDs are LAYOUT patterns · hero/landscape/round variants
of three business personas (cafe · product · personal_brand). The
word "face-cover" in old doctrine was legacy naming only · nothing
in the current implementation reads a face, requests camera, or does
any biometric detection. Confirmed by reading `layout-ids.ts` and
`cover/preview/[layoutId]/page.tsx` end-to-end.

### B7 · ⚠ Code-data mismatch · BLOCKER for a two-step flow

**File**: `src/lib/nex-native/business-service.ts:410-443`.

The `updateCoverLayoutId` server-side validator carries a hardcoded
VALID list that still contains the OLD cover IDs (`restaurant` ·
`salon` · `creator` etc. — removed by Bridge 98 on 2026-09-30).

Impact: any attempt to persist a current sealed-10 cover ID
(e.g. `cafe_landscape`) through this function would be REJECTED by
the validator before it reaches the database. Owner's proposed Step 2
("choose your business cover") cannot save the user's choice until
this validator is reconciled with `layout-ids.ts`.

**Severity**: BLOCKER for the Bisnis two-step flow. One-line fix
(or import the sealed list from `layout-ids.ts`). Must land before
or alongside the two-step build.

---

## Audit C · Four business options

### C1 · Current business chat / dashboard surfaces

| Surface | Route | Role |
|---|---|---|
| Business classification wizard | `/nex-native/business-setup` | Rev 6 FROZEN · 6-step classification + profile metadata |
| Legacy onboarding | `/nex-native/onboarding` | 4-step slug/logo/lane/review wizard (parallel surface) |
| Shop manager | `/nex-native/manage` | Returning-user dashboard |
| Business public page | `/nex-native/[slug]` | Customer-facing · cover-layout rendered here |
| Peer chat (business ↔ customer) | `/nex-native/chat/peer/[accountId]` | Where the shop slider lives for customers |

There is NO "business chat" surface distinct from these. The term
"business chat" in the owner's proposal maps most naturally to the
Manage dashboard · or alternatively, a NEW surface that this build
would create. See §D for the recommendation.

### C2 · Category truth table

Owner proposes four categories. Current reality is **five** · all
exist in the type system at `src/lib/nex-native/business/categories.ts`.

| Owner intent | Current label | Source | Routing | Status |
|---|---|---|---|---|
| Sell products | `"Products"` | `business/categories.ts:23` | wizard · subtypes retail/manufacturer/wholesale/local_artisan/exporter/motorbike_shop | **WORKING** · `/manage/products` fully wired · end-to-end product + order flow |
| Sell food | `"Food & Dining"` | `business/categories.ts:20` | wizard · subtypes restaurant/cafe/bakery/food_maker/catering/drinks/food_delivery | **PARTIAL** · `/manage/menu` renders but no food-specific fields (allergens, dietary, cuisine tags) · order flow shares the product cart (no "no onions"-style notes) |
| Offer services | `"Services"` | `business/categories.ts:24` | wizard · subtypes beauty/health_wellness/home_services/professional/trade_construction/automotive/events/creative | **NOT WIRED** · types exist (`CtaIntent` includes `book`/`appointment`/`enquire` at `types.ts:192-198`) · no booking engine · no enquiry form · no service listing detail page |
| Offer accommodation | `"Accommodation"` | `business/categories.ts:21` | wizard · subtypes hotel/villa/guesthouse/homestay/resort/short_rental | **NOT WIRED** · venue profile fields exist (`events_profile`) · no room/unit inventory · no nightly-rate pricing · no check-in/check-out calendar · no booking engine |
| (not proposed) | `"Property"` | `business/categories.ts` | wizard · for_sale/for_rent/developer/agent | discovered during audit · NOT in owner's four · scope decision needed |

### C3 · Products vs Food · distinct or shared?

**DISTINCT destinations today.** `BUSINESS_CATEGORIES` enumerates
them as separate entries, Step 1 of the wizard renders them as
separate chips, Step 2 branches to category-specific subtypes, and
`BUSINESS_SUBTYPE_CATEGORY` at `subtypes.ts:80-117` guarantees they
never conflate. Food has `/manage/menu` as a distinct management
surface; Products has `/manage/products`.

### C4 · Does the "slider" exist today?

**NO.** The business-setup wizard renders categories as a VERTICAL
STACK of chips, not a slider. There is no horizontal multi-option
chooser, no "What would you like to do?" starter prompt, and no
category-specific first-action surface. Every category lands the
user in the same raw `/manage` dashboard with no guidance.

### C5 · First-action usefulness per category

| Category | Would be useful on first entry? | Reason |
|---|---|---|
| Sell products | ✓ YES | `/manage/products` "Add product" is a complete MVP flow (name/price/image/description/SKU/tags/variants/gallery). A new owner can usefully add their first product immediately. |
| Sell food | ⚠ PARTIAL | `/manage/menu` renders · can add menu items · but food-specific attributes are missing. Still useful for cafe/restaurant owner to see their first menu item. |
| Offer services | ✗ NO | No service-listing form. No booking creation UI. No enquiry inbox. A card promising "offer services" today would route to an empty surface. |
| Offer accommodation | ✗ NO | No room inventory. No nightly-rate pricing. No calendar. No booking engine. A card promising "offer accommodation" today would route to an empty surface. |

### C6 · Payment collection

`accepted_payment_methods` field exists on business profile
(`types.ts:479`). No online-payment flow is wired. All orders are
"COD" or pickup. Explicit note at `types.ts:132` flags payment
infra as planned-not-implemented.

---

## Audit D · Recommended implementation sequence

The owner's proposed experience has three composable pieces. Each
has a different build-cost profile. I recommend sequencing by what's
ready, flagging what honestly cannot be shipped yet.

### D1 · Prerequisite · one-line fix (BLOCKER)

**Fix**: `business-service.ts:410-443` · reconcile the hardcoded
VALID list in `updateCoverLayoutId` with the sealed 10 IDs in
`cover/layout-ids.ts`. Either:
- (a) Import `KNOWN_COVER_LAYOUT_IDS` from `cover/layout-ids.ts` and
  validate against that, OR
- (b) Replace the hardcoded array with the current 10 strings.

Without this fix, Step 2 of the proposed flow can render the picker
but cannot save the user's choice.

**Severity**: BLOCKER. **Scope**: tiny (~5 lines). **Risk**: low ·
the sealed 10 are already compile-time constants.

Recommendation: fix this FIRST as a separate authorised commit so
it lands independently and benefits any other caller of
`updateCoverLayoutId`.

### D2 · Step 1 + Step 2 · the two-step onboarding

**Architecture that works today**:

- Both themes CAN be chosen on behalf of a specific business + account
  after `createBusinessAction` succeeds · at that point we have the
  `businessId` and the sealed `account.id`, so both `nex_account.chat_theme`
  and `nex_business.cover_layout_id` can be written atomically from
  the user's selections.

**Smallest honest surface**:

New route `src/app/nex-native/business-setup/make-it-yours/` (two
pages or one page with a step param):

- Step 1 · `/business-setup/make-it-yours/theme` · reuse the
  `pick-theme` card primitives from `create-account/pick-theme/page.tsx`.
  Show the 2 free NEX themes plus a "Browse all themes →" link to the
  sealed library. Writes to `nex_account.chat_theme` via sealed
  `updateChatThemeAction`. Progress indicator: `(1 of 2)`.
- Step 2 · `/business-setup/make-it-yours/cover` · reuse the sealed
  `cover/preview/[layoutId]` surface, iterate over the 10 IDs,
  show a horizontally-scrollable or stacked preview. Writes to
  `nex_business.cover_layout_id` via (post-D1-fix)
  `updateCoverLayoutId`. Progress indicator: `(2 of 2)`.

**Entry trigger** · after `createBusinessAction` succeeds, redirect
to `/business-setup/make-it-yours/theme`. On Step 2 "Continue",
redirect to the business chat (see §D3).

**Returning-user guard** · if the user navigates back to the entry
after both choices are persisted, skip directly to the business chat.
Guard predicate (derivable from existing state, no new flag):
`!!session.account.chat_theme && !!business.cover_layout_id` ·
treat as "both choices made" and skip the wizard. True first entry
= user still has `chat_theme = "theme-0"` AND `cover_layout_id = NULL`.

**No new schema. No new flag. No cookie.** Preserves U10 doctrine.

### D3 · Business-options slider · HONEST subset

The owner's four options have asymmetric readiness. Shipping all
four as if they work would violate the owner's rule that an
experience must not claim unimplemented features are available.

**Recommended Phase 1 slider · two honest options**:

- **Sell products** → `/nex-native/manage/products/new` (add first product)
- **Sell food** → `/nex-native/manage/menu/new` (add first menu item)

Both route to EXISTING working surfaces. User can take a meaningful
first action.

**Phase 1 slider cards for the other two** · honest "Preview /
Coming soon":
- **Offer services** → inline modal or informational card: "Service
  booking + enquiry flow is in design." No destination.
- **Offer accommodation** → same shape: "Accommodation booking is
  in design." No destination.

OR · defer their appearance in the slider until the backend builds
exist. The owner's choice.

**Slider open-on-entry mechanic**:
- When arriving from Step 2 "Continue" with `?first=1`, the slider
  opens automatically.
- Otherwise · opens closed · user taps a "Starter actions" chip to
  expand.
- No persistent "first entry" flag required · `?first=1` is a
  one-shot URL param consumed on the first render.

**Labels** · adopt owner's wording:
- `"Sell products"` (currently `"Products"`)
- `"Sell food"` (currently `"Food & Dining"`)
- `"Offer services"` (currently `"Services"`)
- `"Offer accommodation"` (currently `"Accommodation"`)

Label changes land in `business/categories.ts` as a tiny patch that
touches the display strings only · the token keys (`products`,
`food`, `services`, `accommodation`) and all routing stay untouched.

### D4 · "Business chat" surface definition

The owner's phrase "take the user directly into their business chat"
is semantically ambiguous today. Three candidate interpretations:

1. **Manage dashboard** · `/nex-native/manage` · the actual
   business-management surface.
2. **A chat-themed interior view of the shop** · would be a new
   surface composing the owner's chat theme + their cover layout +
   action cards (slider).
3. **Peer chat (business owner ↔ customers)** · `/chat/peer/*` ·
   this is customer-facing · not a dashboard.

Interpretation 2 is closest to the proposal's spirit (and would
compose the two choices from steps 1 and 2 into a visible interior
look) but is a NEW surface. Interpretation 1 is the smallest reuse.

**Owner decision required** before we can wire the slider's host.
Recommendation: start with interpretation 1 (land slider on
`/manage`), and treat interpretation 2 as a Phase 2 enhancement.

### D5 · Honest limitations and gaps for owner review

| Gap | Impact | Scope to resolve |
|---|---|---|
| `updateCoverLayoutId` validator mismatch | BLOCKER · Step 2 cannot save | §D1 fix · 5-line patch |
| No service listing + booking engine | "Offer services" card cannot route to a working flow | Backend build · migrations + booking service · multi-week scope |
| No accommodation inventory + rate engine | "Offer accommodation" card cannot route to a working flow | Backend build · room inventory + nightly rates + check-in calendar · multi-week scope |
| Food lacks allergen/dietary/cuisine fields | Food owner's menu is thin | Schema addition + UI · medium scope |
| No "business chat" composable interior view | §D4 interpretation 2 would require a new RSC surface | New-surface scope · owner decides go/no-go |
| No reliable server-side "first Bisnis entry" signal besides derivation | §D3 slider's open-on-entry gate uses `?first=1` URL param only · if the user refreshes before taking an action, the slider closes | Acceptable for Phase 1 · later enhancement could add `nex_business.first_entry_consumed_at` (new column · owner would need to authorise) |

### D6 · Smallest coherent implementation sequence

Build order the owner can authorise piece by piece:

1. **Prereq commit** · fix `updateCoverLayoutId` validator (§D1).
2. **Label commit** · update display strings in `business/categories.ts`
   to `Sell products / Sell food / Offer services / Offer accommodation`.
   Routing untouched · one-file patch.
3. **Two-step onboarding commit** · new `/business-setup/make-it-yours/*`
   routes · Steps 1 + 2 · redirect from `createBusinessAction`.
   Reuses sealed primitives · no new DB.
4. **Slider commit · Phase 1 honest subset** · ship with two working
   options (products + food) and defer the other two OR surface them
   as "coming soon" per owner's call. `?first=1` URL param drives
   open-on-entry.
5. **Deferred · Phase 2** · services booking engine + accommodation
   inventory + composable business-chat interior view · each a
   separate owner-authorised scope.

Each step is independently small, independently tested, independently
revertible, and keeps the sealed first-contact + first-visit stack
untouched.

---

## Compliance checklist

- [x] Repository root + remote verified before every read.
- [x] No source edits.
- [x] No migrations applied.
- [x] No DB query / write / RPC.
- [x] No env read.
- [x] `D:/trades` not touched.
- [x] Pre-existing worktree state preserved · 34 modified + 177
      untracked files unchanged by this audit.
- [x] No commit · no push · no stash · no reset · no branch change.
- [x] Sealed services untouched.
- [x] Sealed `shouldShowFirstVisitInvitation` and
      `shouldShowFirstContact` predicates untouched.
- [x] Discoverability default unchanged.
- [x] NEX1 routing + welcome delivery unchanged.
- [x] All four audits (A · B · C · D) delivered with file:line
      evidence.
- [x] Report filed at
      `docs/doctrine/nex-bisnis-first-entry-audit-2026-10-14.md`.

Awaiting owner decisions:
1. §D1 BLOCKER fix · authorise?
2. §D2 two-step onboarding architecture · correct host route?
3. §D3 slider · ship with 2 or 4 options (2 working + 2 "coming
   soon") · which?
4. §D4 "business chat" definition · interpretation 1 (`/manage`) or
   interpretation 2 (new interior view)?
5. §D5 label updates · adopt owner's "Sell / Offer" wording in
   `business/categories.ts`?
6. §D5 "Property" fifth category · scope decision · keep as-is in
   wizard, suppress from slider, or re-evaluate?
