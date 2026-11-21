# NEX Bisnis · End-to-End First-User Acceptance Gate · 2026-10-14

Status: READ-ONLY AUDIT. No source edits. No DB queries. No `.env.local`
reads. Pre-existing worktree preserved (34 modified · 177 untracked ·
Phase 1 + Phase 2 + support-background + themes-tour follow-up all

Scope: owner's acceptance gate — "I must be able to start from the
first NEX URL, follow the intended journey as a new user, and finish
with a real, correctly configured business presence."

Companion docs:
- `nex-bisnis-first-entry-audit-2026-10-14.md`
- `nex-bisnis-first-entry-phase-2-plan-2026-10-14.md`
- `nex-bisnis-first-entry-phase-2-implementation-2026-10-14.md`

---

## 1 · Headline verdict

**Phase 2 is correctly wired at the code level for the chat-theme +
cover-layout two-step. The end-to-end acceptance target is NOT met.**

The system can take a brand-new user from `/nex-native/welcome` →
business creation → first-product celebration → chat-theme pick →
cover pick → shop slug · but the "appropriate business destination"
at the end of that chain is `/${slug}` which displays products only.
Users whose chosen category is Food, Services, or Accommodation
arrive at a product-shaped surface that does not fit their business.

The journey IS continuous and the sealed persistence paths DO save
state correctly at the code-wiring tier. The gaps are elsewhere: in
WHAT the user can upload once they arrive, HOW customers see the
result, and WHICH category-specific editor they ought to be taken
to instead of (or in addition to) the generic product form.

---

## 2 · The 8-step acceptance journey · evidence per step

### Legend · evidence tiers

- **UNIT** · vitest source-shape assertion exists in repo
- **WIRING** · file:line proves the call reaches the right service
- **BROWSER** · Playwright authed run would exercise this (blocked today · no `tests/e2e/.auth/state.json`)
- **REAL-PERSIST** · actual Supabase round-trip observed · N/A everywhere in this audit (guardrails forbid)

### Step 1 · Enter NEX

| Field | Value |
|---|---|
| Entry URL | `/nex-native` (sealed root) |
| Routing | Signed-in → `/home` · signed-out → `/welcome` |
| Code | `src/app/nex-native/page.tsx:22-27` (sealed) |
| Account identity | `resolveNexAppSessionFromContext()` resolves `session.account` server-side |
| Status | **IMPLEMENTED** · evidence: UNIT + WIRING |
| Gap | None |

### Step 2 · Select Bisnis

| Field | Value |
|---|---|
| Entry URL | `/nex-native/home` |
| Trigger | `shopTile()` at `home/page.tsx:72-94` returns href based on `hasBusiness` (from `listBusinessesByOwner`) |
| For new user | `/nex-native/onboarding` |
| For returning user | `/nex-native/manage` |
| Status | **IMPLEMENTED** · evidence: UNIT + WIRING |
| Gap | Non-reseller kinds (`professional`, `student`, `seeking_work`, `exploring`) route to `/settings/profile` not Bisnis · acceptable but owner-decision whether to surface Bisnis for them |

### Step 3 · Create business through existing flow

| Field | Value |
|---|---|
| Entry URL | `/nex-native/onboarding` |
| Route | `src/app/nex-native/onboarding/page.tsx` + `SellerCentralWizard` client (slug → logo → lane → review) |
| Action | `createBusinessAction` at `_actions.ts:2980-3333` |
| Writes | `nex_business` row (owner_account_id, display_name, slug) + auto-suggested `cover_layout_id` (`_actions.ts:3225-3243`) + optional logo + optional reseller_enabled |
| Terminal redirect | `/nex-native/onboarding/first-product?slug=<slug>` (sealed 2026-10-01) |
| Guards | **One-business-per-account** at `_actions.ts:3142-3147` · redirects returning users FORWARD to existing shop |
| Status | **IMPLEMENTED** · evidence: WIRING only |
| Gap · race condition | Two concurrent tab submits could race the guard · Supabase UNIQUE on `(owner_account_id)` is the authoritative backstop · UNVERIFIED here (no DB access permitted) |
| Gap · auto-cover-suggest | `cover_layout_id` is populated immediately · the owner's Phase 2 Step 2 overwrites this consciously · ok |

### Step 4 · Choose + save chat theme

| Field | Value |
|---|---|
| Entry URL | `/nex-native/business-setup/make-it-yours/theme?businessId=<uuid>` |
| Trigger | Skip link on `/onboarding/first-product` (Phase 2 edit · just built) |
| Route | `src/app/nex-native/business-setup/make-it-yours/theme/page.tsx` (new) |
| Guards | session + ownership (`business.owner_account_id === session.account.id`) |
| Pre-fill | `session.account.chat_theme` |
| Save path | Sealed `updateChatThemeAction` with `next=/business-setup/make-it-yours/cover?businessId=<uuid>` |
| Persistence | `accountService.updateChatTheme(session.account.id, theme)` writes `nex_account.chat_theme` (`account-service.ts`) |
| Entitlement | Dual-gate: server pre-filter + sealed action enforcement at `_actions.ts:4441-4453` |
| Status | **IMPLEMENTED** · evidence: UNIT (make-it-yours test file) + WIRING |
| Gap | **Product-submit path bypasses this step entirely** (sealed `createFirstProductAction` redirect sends user to `/${slug}` without visiting Step 4). Only Skip-path users are chained. |
| Gap | On save failure, sealed action redirects to `/chat-themes-library?e=...&m=...` not back to Step 4 (user's place in the two-step is lost). Pre-filter mitigates legitimate paths; a true DB blip still bounces. |

### Step 5 · Choose + save business cover

| Field | Value |
|---|---|
| Entry URL | `/nex-native/business-setup/make-it-yours/cover?businessId=<uuid>` |
| Route | `src/app/nex-native/business-setup/make-it-yours/cover/page.tsx` (new) |
| Guards | session + ownership |
| Pre-fill | `business.cover_layout_id` (likely non-null due to auto-suggest) |
| Save path | New `updateBusinessCoverStepAction` (`_cover-step-action.ts`) · owner-guard · canonical `isValidCoverLayoutId` · Phase-1-fixed `businessService.updateCoverLayoutId` |
| Terminal redirect on success | `/nex-native/${business.slug}?setup=complete` |
| Terminal redirect on failure | Back to Step 5 with `?e=...&m=...` (retry preserves place) |
| Status | **IMPLEMENTED** · evidence: UNIT + WIRING |
| Gap | 10 cover tiles have thin preview (small gradient hint) · "Preview full" opens the sealed `/cover/preview/[layoutId]` in a new tab · acceptable but not ideal mobile UX |
| Gap | Phase-1 fix is still LOCAL · if any other code path tries to save a cover (e.g. the sealed `/manage/shop` action), it already works. The two-step action uses the Phase-1-fixed primitive directly · fine. |

### Step 6 · Select the intended business category + enter its correct working experience

**This step is where the acceptance target materially breaks today.**

| Field | Value |
|---|---|
| Where category is picked | `/business-setup` wizard (6 steps) · `BUSINESS_CATEGORIES` at `src/lib/nex-native/business/categories.ts` · 5 categories (products / food · dining · services · accommodation · property) + 30 subtypes |
| How the picked category persists | `nex_business.profile` jsonb column (migration 126) stores `{ primary: { category, subtype }, secondary: [...] }` |
| Current post-category-pick destination | Universal `/onboarding/first-product` regardless of category |
| What first-product renders | A PRODUCT form only (name, price, image, variants, gallery · 4 image slots + sizes + colors) |
| What's missing for Food | No "add first menu item" branch · seller must manually navigate to `/manage/menu` after setup · no onboarding handoff |
| What's missing for Services | No "add first service" branch · seller must manually navigate to `/manage/services` · no onboarding handoff |
| What's missing for Accommodation | No "add first room / rate / stay" branch at all · the surface simply does not exist · `/manage/venue` is a profile editor, not an accommodation editor |
| Status | **PARTIAL · dangerous mismatch for Food / Services / Accommodation sellers** |
| Evidence | WIRING confirms the universal funnel: `_actions.ts:3330-3332` redirects every created business to `/onboarding/first-product?slug=` · no category branch |

### Step 7 · Upload the appropriate information using the category's actual fields

#### Products (owner-approved baseline · the only fully implemented category)

| Field | Value |
|---|---|
| Surface | `/onboarding/first-product` + `/manage/products` + `/manage/products/[productId]` |
| Fields in first-product form | name · price (currency-aware · stored as `price_pence`) · primary image + 3 gallery slots · variants (size templates + colour palette) |
| Fields NOT in first-product form (per owner's spec) | **description** (action accepts it from FormData but the UI has no input · `_actions.ts:3364`) · SKU · tags · inventory (`stock_status`) · all deferred to edit page |
| Persistence | `product-service.createProduct` → `nex_product` with `business_id` FK and RLS owner-write + public-read-live gate · migration 003 |
| Entitlement cap | 10 live/draft products on `gratis` · `assertCanCreateProduct(business_id)` at `product-service.ts:293` · throws `NexTierLimitError("product_cap_gratis")` · caught by action and redirects with banner |
| Status | **FULLY WORKING end-to-end at code level** · evidence: UNIT + WIRING |
| Gap | Owner's "SKU · tags · inventory · description" fields not fully exposed in first-product UI · each requires a trip to the edit page |

#### Food (menu editor exists · booking flow does not)

| Field | Value |
|---|---|
| Surface | `/manage/menu` (section + item CRUD) |
| Data | `nex_menu_section` + `nex_menu_item` (migration 066 + 079) · rich metadata: dietary_tags · allergens · spice_level · is_available · is_featured · preparation_time · portion_note · perks |
| Food-specific columns coming | Migration 161 (DRAFT · NOT YET APPLIED to live Supabase) adds `cuisine_type` · `dietary_flags` · `delivery_platforms` to `nex_business` |
| Fields missing | Modifiers / extras (toppings · side choices) · time-window availability (breakfast / lunch / dinner) · pre-order scheduling · allergen certification upload |
| Order flow | Reuses product cart via chat grid · no food-specific order model · fulfilment is chat-mediated |
| Status | **PARTIAL · menu editor works · order flow is generic + chat-mediated** · evidence: UNIT + WIRING + BROWSER (manage/menu renders) |
| Gap | New food seller is not routed from `/onboarding/first-product` to `/manage/menu` · they land on a product form that doesn't fit |

#### Services (list editor exists · booking engine does not)

| Field | Value |
|---|---|
| Surface | `/manage/services` (list CRUD) |
| Data | `nex_service` (migration 112) · columns: `business_id` · `name` (1-80) · `description` (0-300) · `from_price` (freeform text 0-40) · `sort_order` · sealed 2026-09-30 |
| Fields missing | Appointment / booking table · availability / calendar · booking creation form · enquiry inbox · appointment state machine · deposit / payment · numeric pricing (only freeform hint) |
| Enquiry flow | Generic peer chat only · no appointment table · no state machine |
| Public display | `ServiceList` block on cover templates 04/05/09 (migration 112 comment) · renders service rows |
| Status | **UI-ONLY STUB · listing works · booking absent** · evidence: UNIT + WIRING |
| Gap | Capability `appointments` is listed in `capabilities.ts:212+` as "recommended" but has no backing table / UI · the recommendation is aspirational |

#### Accommodation (profile fields exist · reservation system does not)

| Field | Value |
|---|---|
| Surface | `/manage/venue` (events profile + venue gallery editor only) |
| Data | `nex_business.events_profile` jsonb (hosts_parties · seat_capacity · outside_catering · live_music · private_party · sound_system · other_event_info) + `nex_business.venue_gallery` (up to 6 photo URLs) |
| Fields missing | No `nex_room` · no `nex_rate` · no `nex_availability_calendar` · no `nex_reservation` · no check-in / check-out fields · no nightly rate · no room inventory · no reservation state machine |
| Capability `room_booking` | Listed as "recommended" at `capabilities.ts:151-175` but **not implemented** |
| Capability `availability_calendar` | Listed as "recommended" but no table or UI |
| Public display | Shop page `/${slug}` renders the events_profile as an About panel · menu items load for venue categories (!) · a "hotel" category seller currently gets a menu-oriented chat view · wrong |
| Status | **TYPES-ONLY · profile fields exist · reservation infrastructure absent** · evidence: UNIT + WIRING only |
| Gap · critical | Owner's description: "Do not describe a venue profile as a complete accommodation-booking system if room inventory, rates, calendars, or reservations are missing." · confirmed: the system has NONE of these |

### Step 8 · Reach the correct business destination + verify saved information + what makes it live

| Field | Value |
|---|---|
| Terminal destination from Phase 2 | `/nex-native/${business.slug}?setup=complete` |
| What `/${slug}` renders | Hero (logo · display_name · description · market_reach bullets) · activity badge · product grid filtered `status='live'` · contact + socials · chat button |
| Products category | ✓ shop grid shows user's live products |
| Food category | Menu rendering is handled via a different vertical gate · see `cover-content-loader.ts` + `isVenueCategory` · partial · menu items DO load if the business is in `NEX_VENUE_CATEGORIES` |
| Services category | `ServiceList` block renders ONLY on cover templates 04 / 05 / 09 · if the seller picked a cover that doesn't include ServiceList, services aren't visible on the shop |
| Accommodation category | Shop page renders · events_profile shown as About panel · NO rooms · NO rates · NO calendar · NO reservation CTA |
| What makes it "live" | THREE independent states · see §4 below |

---

## 3 · The three states · "saved" vs "owner-ready" vs "visible to customers"

Confirmed by the visibility audit · they are NOT a pipeline and NOT
auto-synced:

| State | DB condition | Current behaviour |
|---|---|---|
| **Saved** | `nex_business` row exists | Owner can edit via `/manage` + `/business-setup`. `listBusinessesByOwner()` returns the row. |
| **Owner-ready** | `profile IS NOT NULL` on the business row | Home-page activation banner disappears. Capability + content overrides become editable. **Does NOT affect customer visibility.** |
| **Visible to customers** | `NEX_COMMERCE_ENABLED=1` **AND** `archived_at IS NULL` **AND** shop page requested by slug | Public shop renders · search returns the row. Does NOT check `profile` · a never-activated business IS visible if commerce is on. |

**Key honest findings** (from the visibility audit):

- The public shop page `/${slug}` has NO `profile IS NOT NULL` check. A business created but never passed through the activation wizard IS visible to customers when commerce is enabled.
- Search / directory filters only on `archived_at IS NULL` · no `profile` filter · no `verified_at` filter.
- `verified_at` is admin-only · surfaces ONLY in `/chat` Business tab · NOT on the public shop page. No visual verification indicator for customers today.
- No approval queue · no moderation gate · no "pending review" state.
- `?commerce=1` URL bypass is REFUSED in production (`launch-flags.ts:56` returns false if `NODE_ENV === "production"`).

**Honest answer to "what makes my business live?"**:

> If `NEX_COMMERCE_ENABLED=1` on the Vercel deployment AND your business row is not archived, customers can visit `yourSlug.nex` and see your shop (which may be empty if you haven't added products / menu items / services). Verification is admin-only and only shows in internal chat, not publicly. There is no approval queue, no publication button, no "go live" toggle. Commerce enabling is a founder/ops decision, not an owner decision.

---

## 4 · Bypass paths · dead ends · duplicate-creation risks · wrong-destination · misleading success

### Bypass paths (all CLOSED by ownership guards)

- Direct URL `/business-setup/make-it-yours/theme?businessId=<other-account>` → ownership guard redirects to `/manage` (`theme/page.tsx:93-98`)
- Direct URL `/business-setup/make-it-yours/cover?businessId=<other-account>` → ownership guard same path
- `?next=` manipulation in `updateChatThemeAction` → whitelisted at `_actions.ts:4470-4475` (`startsWith("/nex-native/") && !includes("//")`)
- No obvious open-redirect, session-hijack, or privilege-escalation surface in Phase 2 additions

### Dead ends

- `/business-setup` entered directly by a signed-in user with NO business row: wizard mounts at step 0 (welcome). On save, `saveBusinessActivationAction` creates a shell row on-demand (`_actions.ts:3142-3147`). Not a dead end · intentional.
- Phase 2 theme page with empty catalogue: falls through to "Continue to Step 2 →" link. Not a dead end.
- Phase 2 cover page with missing `businessId`: redirect to `/manage`. Not a dead end.

### Duplicate-creation risks

- **One-business-per-account** guard at `_actions.ts:3142-3147` is a read-then-insert pattern. Two concurrent tabs could race:
  1. Both query `listBusinessesByOwner(session.account.id)` → both see `length === 0`
  2. Both call `businessService.createBusiness(...)` → the second one SHOULD hit a Supabase UNIQUE constraint (if one exists on `owner_account_id`)
  3. The second attempt catches the duplicate-key error and redirects with `?e=slug_taken|business_create_failed` message
- **Verification status**: the actual DB constraint existence is NOT verified in this audit (no DB access permitted). The code's catch at `_actions.ts:3244-3251` is a graceful fallback regardless.

### Incorrect category destination (CRITICAL)

- `createBusinessAction` terminal redirect sends EVERY new business to `/onboarding/first-product` regardless of category.
- `/onboarding/first-product` is a PRODUCT form with product-specific fields (name, price, variants, gallery).
- Food sellers who complete it either:
  - Submit a dummy "product" (polluting their `nex_product` table), OR
  - Skip (triggering Phase 2's Step 1 chain · but still never seeing `/manage/menu`)
- Services sellers: same misfit. The form writes to `nex_product`, not `nex_service`.
- Accommodation sellers: catastrophic misfit. There is no `nex_room` or `nex_rate` to write to anyway. The product form is irrelevant to them.

### Missing upload capability

- Products first-product form: **description** field missing from UI despite the action accepting `product_description` in FormData.
- Products edit page: SKU, tags, gallery updates exist as service functions but not fully surfaced via dedicated forms (variant creation + spec edit exist · other field edits require spec-editor).
- Food: modifiers / extras / time-window availability / pre-order scheduling absent.
- Services: numeric pricing, deposits, availability slots absent.
- Accommodation: ALL category-specific uploads absent (rooms · rates · calendar · reservations · check-in · check-out).

### Misleading success states

- Phase 2 Step 2 success → `/${slug}?setup=complete` · the URL claims setup is "complete" but the page may be empty (no products / menu items / services) and gives no explicit "verify what customers see" affordance. The user has no clear "I'm done · my customers can see this" confirmation beyond the URL fragment.
- "Your shop is live" celebration page (`/onboarding/first-product`) presents the shop as "live" even though `NEX_COMMERCE_ENABLED` on the deployed Vercel instance may be `0` · in that case, the shop ISN'T actually visible to customers.
- Food/Services/Accommodation businesses that reach `/${slug}?setup=complete` arrive at a page that doesn't display their category-specific content (menu is partial · services are cover-template-gated · rooms don't exist at all). No warning · no "add your first menu item" nudge · no "coming soon · your accommodation booking engine is in design" copy.

---

## 5 · Evidence tier summary · what is proven vs what remains unverified

| Area | UNIT | WIRING | BROWSER | REAL-PERSIST |
|---|---|---|---|---|
| Phase 2 route structure | ✓ (40 tests) | ✓ | ✗ (blocked) | ✗ (forbidden) |
| Phase 2 persistence call chain | ✓ | ✓ | ✗ | ✗ |
| Phase 1 cover-validator fix | ✓ (11 tests) | ✓ | ✗ | ✗ |
| Sealed `updateChatThemeAction` behaviour | ✓ (via unchanged sealed suites) | ✓ | ✗ | ✗ |
| First-product → Make-it-yours Skip chain | ✓ (make-it-yours test file) | ✓ | ✗ | ✗ |
| Business creation → first-product chain | ✗ | ✓ | ✗ | ✗ |
| Product creation + display | ✓ (sealed suites · migration 003 RLS text) | ✓ | ✗ | ✗ |
| Menu item creation + display | ✗ (not tested in Phase 2 scope) | ✓ (migrations 066 + 079 · service-layer code) | ✗ | ✗ |
| Service list creation + display | ✗ | ✓ (migration 112 · service-list-service.ts) | ✗ | ✗ |
| Accommodation (rooms · rates · calendar · reservations) | — | — | — | — |
| Shop page visibility gates (commerce flag · archived_at) | ✓ (launch-flags) | ✓ | ✗ | ✗ |
| Verified badge admin-only + chat-only | ✓ (migration 083 text) | ✓ | ✗ | ✗ |
| Admin / moderation queue | **CODE ABSENCE** · no such tables / services exist | | | |
| Order creation gating | ✓ (order-service.ts text) | ✓ (no business-state gate) | ✗ | ✗ |

**No step in the end-to-end journey has BROWSER-tier or
REAL-PERSIST-tier evidence.** This is a direct consequence of
Phase 2 guardrails forbidding DB operations, Playwright authed
runs, server restarts, and `.env.local` access.

---

## 6 · Proposed implementation sequence · smallest safe changes

Owner's spec: "Clearly separate the two-step setup from the subsequent
business-category and upload work."

### Track A · Two-step setup (Phase 2 · ALREADY BUILT · code-wiring verified)

| Status | Scope |
|---|---|
| ✓ Local worktree | Phase 1 cover-validator fix + Phase 2 two-step setup already landed · 155+40+... = 216/216 tests pass · pre-existing worktree preserved |
| Pending | Browser-level verification + real-persist verification (requires owner-authored Playwright authed state OR a manual browser session) |
| Pending | Owner review + commit authorisation |

### Track B · Category-aware post-creation routing (NOT YET BUILT · requires owner authorisation)

The acceptance gate's primary unresolved concern. Smallest changes:

**B.1 · Category-aware first-step destination · ~1 file edit**
- Modify ONLY the "Skip for now" link copy and target in
  `_first-product-client.tsx:1049-1060` to carry the category.
- OR: pass `category` from the server page (which already reads the
  business) into the client and route accordingly.
- Honest routing (initial · simplest):
  - Products subtype → chain to Phase 2 Step 1 (current behaviour) · acceptable
  - Food subtype → chain to a NEW surface `/business-setup/make-it-yours/menu-first` that reuses `/manage/menu` primitives wrapped in a 2-step progress indicator OR deep-links to `/manage/menu` with an onboarding banner
  - Services subtype → similar deep-link to `/manage/services` with onboarding banner
  - Accommodation subtype → honest "Coming soon · booking features are in design · meanwhile set up your venue profile" page that deep-links to `/manage/venue`
- Preserves ALL seals · reuses sealed services · no new tables · no migrations

**B.2 · "What customers see" preview affordance on the final step · 1 file edit**
- Modify the Phase 2 Step 2 success redirect to `/${slug}?setup=complete`
  (already does) · add a server-side banner on `/${slug}` when
  `?setup=complete` is present that reads:
  - "Here's what customers see. Edit anything on `/manage`."
  - Explicit "Add your first product / menu item / service" affordance targeted at the user's category
- Preserves sealed shop-page rendering · just a conditional banner

**B.3 · First-product form field completeness · 1 file edit**
- Add the `description` field to `_first-product-client.tsx` (the action already accepts it from FormData).
- Does NOT modify any sealed server action.
- Minor but closes a Phase-2-anticipated gap flagged by the Products audit.

### Track C · Category-specific upload workflows (DEFERRED · requires separate authorisation)

Owner's spec: "Expand food, services, and accommodation only as their
underlying functionality becomes real."

| Category | Smallest honest work |
|---|---|
| Products | **Already production-ready**. No work here. |
| Food | Add `/business-setup/make-it-yours/menu-first/page.tsx` that reuses `menu-service.ts` primitives · initial menu-item quick-add. **Migration 161 (DRAFT) must be applied first OR we proceed without those columns.** |
| Services | Add `/business-setup/make-it-yours/services-first/page.tsx` that reuses `service-list-service.ts` · list-only · no booking engine yet. Honest "booking engine coming soon" copy. **No new migrations required** (uses sealed `nex_service`). |
| Accommodation | **Owner's authorisation required for the backend scope** before any UI. Need: `nex_room` + `nex_rate` + `nex_availability_calendar` + `nex_reservation` tables + state machine + booking service module. Multi-week work. Alternative: honest "accommodation booking is in design" page that still saves `events_profile` through `/manage/venue`. |

### Track D · Visibility clarity (DEFERRED · product-decision needed)

Owner's spec: "Establish exactly what makes the business live, what
customers can access, and whether any separate verification or
publication requirements remain."

The audit answers these. The product-decisions needed:
- Does the owner want a user-visible "publish" or "go live" toggle,
  OR does the current implicit model (saved = live if commerce enabled)
  stay? Changing this requires schema additions (`published_at`,
  `visibility_state`, or similar) · owner would need to authorise.
- Does the public shop page need a visible verified-badge indicator?
- Does `/${slug}?setup=complete` need an owner-facing "preview as
  customer" banner to clarify what others see? (See B.2.)

### Suggested sequence to resume

1. Owner reviews this acceptance-gate audit.
2. Owner either APPROVES Phase 2 commit-and-push (which lands code-wired theme + cover setup for the Products category) OR requests additional changes before commit.
3. Owner authorises **Track B** (category-aware routing + preview banner + first-product description field) as Phase 2b or Phase 3a · smallest category-correctness fix.
4. Owner authorises **Track C** category-specific backends one category at a time, in a separate scope per category (food · then services · then accommodation).
5. Owner decides on **Track D** visibility clarity · separate scope · may require schema additions and would need explicit migration authorisation.

Each track is independently commit-able, independently reversible,
and preserves sealed services.

---

## 7 · Explicit gaps rolled up for owner review

| # | Gap | Severity | Where surfaced |
|---|---|---|---|
| 1 | Product-submit path bypasses Phase 2 two-step entirely | MEDIUM | sealed `createFirstProductAction` redirect preserved per 1B authorisation · documented in Phase 2 report §5.1 |
| 2 | Step 1 save failure redirects to `/chat-themes-library` (sealed) · user loses place | LOW | Phase 2 report §5.2 · pre-filter mitigates |
| 3 | Universal post-creation funnel to `/onboarding/first-product` regardless of category | HIGH | §2 Step 6 · §4 "Incorrect category destination" · Food / Services / Accommodation sellers get the wrong form |
| 4 | First-product form missing `description` field in UI | LOW | §4 "Missing upload capability" · action already supports it |
| 5 | Accommodation has NO booking engine · `nex_room` · `nex_rate` · `nex_calendar` · `nex_reservation` all absent | HIGH | §2 Step 6 + §4 · types-only today |
| 6 | Services has NO booking engine · `nex_appointment` table absent · chat is the only enquiry channel | MEDIUM | §2 Step 6 + §4 · list editor exists |
| 7 | Food missing modifiers / time-window / pre-order · migration 161 (cuisine · dietary · delivery platforms) is DRAFT not yet applied | MEDIUM | §2 Step 6 · menu editor otherwise rich |
| 8 | "Live" visibility is a function of `NEX_COMMERCE_ENABLED` + `archived_at IS NULL` · no user-facing "publish" semantics | MEDIUM | §3 three-states audit · owner may want explicit publish |
| 9 | No "preview as customer" affordance at Phase 2 completion | LOW | §4 "Misleading success states" · B.2 fix proposed |
| 10 | Shop page renders for `profile IS NULL` businesses when commerce is on | LOW | §3 · acceptable per sealed migration-126 doctrine but owner may want to re-confirm |
| 11 | Verified badge invisible to customers (chat-only · admin-only) | LOW | §3 · owner may want public badge later |
| 12 | No admin / moderation queue | INFO | §3 · code absence · owner may need to decide at scale |
| 13 | Phase 2 BROWSER + REAL-PERSIST evidence missing | HIGH-for-acceptance | §5 · owner-side Playwright state generation + a manual browser session would close this |
| 14 | Duplicate-business-creation race condition (one-business-per-account guard) · unverified against actual DB UNIQUE constraint | LOW | §4 "Duplicate-creation risks" |

---

## 8 · Compliance checklist

- [x] Read-only audit · no source edits
- [x] No migrations applied
- [x] No DB queries / writes / RPCs
- [x] No `.env.local` reads
- [x] No dependency installs · no deployment · no server restart
- [x] Pre-existing worktree preserved · Phase 1 + Phase 2 + support-background + themes-tour follow-up all intact · uncommitted
- [x] No commit · no push · no reset · no stash · no branch change
- [x] All claims cited with file:line evidence
- [x] Evidence tiers rigorously separated (UNIT · WIRING · BROWSER · REAL-PERSIST)
- [x] Four parallel sub-audits (entry · products · food/services/accommodation · visibility) consolidated into one report
- [x] Explicit "not implemented" labels where applicable · no fabrication
- [x] Smallest-safe implementation sequence proposed with 4 tracks

Stopping for owner review. No implementation begins without separate
owner authorisation of the specific track(s) to proceed.
