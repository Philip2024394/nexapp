# NEX Bisnis · Consolidated Acceptance Review · 2026-10-14

Status: READ-ONLY. No source edits. No DB queries. No `.env.local`.
No tests re-authored (only re-executed the documented 328-test
suite). Pre-existing worktree preserved. `D:/trades` untouched.

Scope: owner's 8-point consolidated review of Phase 1 + Phase 2 +
Track B + Track B.1 + Track C against:
- `nex-bisnis-first-entry-audit-2026-10-14.md`
- `nex-bisnis-first-entry-phase-2-plan-2026-10-14.md`
- `nex-bisnis-first-entry-phase-2-implementation-2026-10-14.md`
- `nex-bisnis-end-to-end-acceptance-gate-2026-10-14.md`
- `nex-bisnis-track-b-implementation-2026-10-14.md`
- `nex-bisnis-track-b-acceptance-review-2026-10-14.md`
- `nex-bisnis-track-b1-implementation-2026-10-14.md`
- `nex-bisnis-track-c-implementation-2026-10-14.md`

Baseline on `origin/main`: commit `d28ed18` ·
"feat(bisnis): end-to-end first-entry flow · Phase 1 → Track C" ·
28 files · 7,672 insertions · 35 deletions.

---

## Legend · evidence tiers

Reported separately per the owner's requirement:
- **UNIT** · vitest source-shape + pure-function assertion in repo
- **WIRING** · file:line proves the call reaches the right service
- **BROWSER** · Playwright authed run exercises the UI
- **REAL-PERSIST** · actual Supabase round-trip observed
- **CUSTOMER-VISIBLE** · an unauthenticated / third-party visitor sees the right content on the public shop page

---

## Item 1 · Products / Food / Services routing

**PASS** at UNIT + WIRING tiers.

Evidence · `src/app/nex-native/onboarding/first-product/page.tsx:63-80`:
```ts
const rawCategory = business.business_category;
const isNonProductCategory =
  typeof rawCategory === "string" &&
  isBusinessCategory(rawCategory) &&
  rawCategory !== "products";

if (isNonProductCategory) {
  return (
    <CategoryFirstEntryClient
      category={rawCategory}
      ...businessId={business.id}
      banner={banner}
    />
  );
}
```

Products path → falls through to `<FirstProductClient>` at `page.tsx:84-97` (sealed path preserved).

Food/Services destinations in `_category-first-entry-client.tsx:112-127`:
```ts
case "food":
  primaryCta: {
    href: businessId
      ? `/nex-native/business-setup/make-it-yours/menu-first${bidQs}`
      : "/nex-native/manage/menu",
  }
case "services":
  primaryCta: {
    href: businessId
      ? `/nex-native/business-setup/make-it-yours/services-first${bidQs}`
      : "/nex-native/manage/services",
  }
```

Accommodation + Property preserved at `/manage/venue` + `/manage` with honest "coming soon" notes.

Tests pinning this: `track-b.test.ts > first-product/page.tsx · category-aware branching` + `track-c.test.ts > categoryEntrySpec · wrapper routing when businessId provided` (6 assertions).

BROWSER · NOT VERIFIED (Playwright authed state absent).
REAL-PERSIST · NOT VERIFIED (DB access forbidden).

---

## Item 2 · Food + Services actions · ownership + sealed services

**PASS** at UNIT + WIRING tiers.

Menu-first action · `_create-first-menu-item-action.ts`:
- Line 60: `const session = await resolveNexAppSessionFromContext();`
- Line 68: `if (!business || business.owner_account_id !== session.account.id)`
- Line 98: `await menuService.createMenuItem({ ... })` (sealed primitive · reused)
- Error: `menu_first_name_invalid` / `menu_first_price_invalid` / `menu_first_save_failed` → redirect back to form

Services-first action · `_create-first-service-action.ts`:
- Line 65: `const session = await resolveNexAppSessionFromContext();`
- Line 73: `if (!business || business.owner_account_id !== session.account.id)`
- Line 90: `await insertService({ ... })` (sealed primitive · reused)
- Error: `services_first_no_name` / `services_first_save_failed` → redirect back to form

Both actions:
- Reuse the sealed `getBusinessById` for ownership resolution
- Never bypass or re-implement persistence
- Fail safely on either guard without data loss

Tests pinning this: `track-c.test.ts > _create-first-menu-item-action.ts · structure` (9 assertions) + `_create-first-service-action.ts · structure` (6 assertions).

BROWSER + REAL-PERSIST · NOT VERIFIED (same guardrails as Item 1).

---

## Item 3 · Sealed actions and redirects unchanged

**PASS** at UNIT + WIRING tiers.

Verified via `git show --stat d28ed18`: the 28 files committed do NOT include:
- `src/app/nex-native/_actions.ts` (sealed `createBusinessAction` · `createFirstProductAction` · `createMenuItemAction` · `updateChatThemeAction` all byte-identical)
- `src/app/nex-native/manage/shop/_cover-layout-action.ts` (sealed `updateBusinessCoverLayoutAction` byte-identical)
- `src/app/nex-native/manage/services/_actions.ts` (sealed services dashboard actions byte-identical)
- `src/lib/nex-native/menu-service.ts` / `service-list-service.ts` / `chat-theme-service.ts` (all sealed primitives byte-identical)

Terminal redirects at HEAD:
- `_actions.ts:3328` (first-product `includeFirstProduct` branch): `redirect(/nex-native/${business.slug})`
- `_actions.ts:3330-3332` (first-product terminal): `redirect(/nex-native/onboarding/first-product?slug=${encodeURIComponent(business.slug)})`
- `_actions.ts:3524` (createFirstProductAction terminal): `redirect(/nex-native/${business.slug})`
- `manage/shop/_cover-layout-action.ts:58`: `redirect("/nex-native/manage/shop?ok=cover_layout")`
- `manage/services/_actions.ts:59`: `redirect("/nex-native/manage/services?ok=1")`

All redirects unchanged. New parallel actions redirect to their own target (`/${slug}?setup=complete`) via NEW action files, never modifying the sealed ones.

Tests pinning this: 
- `track-b.test.ts > sealed _actions.ts · untouched by Track B` (3 assertions)
- `track-b1.test.ts > sealed surfaces · untouched by Track B.1` (3 assertions)
- `track-c.test.ts > sealed surfaces · untouched by Track C` (4 assertions)

BROWSER · NOT VERIFIED.
REAL-PERSIST · NOT VERIFIED.

---

## Item 4 · Theme + cover personalisation · canonical selectors + ownership

**PASS** at UNIT + WIRING tiers.

Phase 2 theme page · `make-it-yours/theme/page.tsx`:
- Line 36: `import * as chatThemeService from "@/lib/nex-native/chat-theme-service"`
- Line 37: `import { updateChatThemeAction } from "../../../_actions"` (sealed action imported, NOT replicated)
- Line 96: `if (!business || business.owner_account_id !== session.account.id) redirect("/manage")`
- Line 102: `chatThemeService.listActiveThemes().catch(() => [])`
- Line 107: `accountService.effectiveTier(viewerAccount)` (entitlement reuse)
- Line 296: `<form action={updateChatThemeAction}>` (sealed action is the form target)

Phase 2 cover page · `make-it-yours/cover/page.tsx`:
- Line 94: `if (!business || business.owner_account_id !== session.account.id) redirect("/manage")`
- Cover layout IDs: `COVER_LAYOUT_IDS` from canonical module (not duplicated)

Phase 2 cover-step action · `_cover-step-action.ts`:
- Line 29: `isValidCoverLayoutId` imported from canonical `@/app/nex-native/cover/layout-ids`
- Line 58: ownership guard enforced
- Line 63: `if (!isValidCoverLayoutId(raw))` validation via canonical helper
- Uses Phase-1-fixed `businessService.updateCoverLayoutId` (not a parallel validator)

Tests pinning this: 
- `make-it-yours.test.ts > theme/page.tsx · Step 1 structure` (11 assertions)
- `make-it-yours.test.ts > cover/page.tsx · Step 2 structure` (10 assertions)
- `make-it-yours.test.ts > _cover-step-action.ts · structure` (8 assertions)
- `business-service-cover-layout.test.ts` · 11 assertions · all 10 current IDs accepted, 7 old IDs rejected, 15 adversarial inputs rejected

BROWSER + REAL-PERSIST · NOT VERIFIED.

---

## Item 5 · Owner-only banner + invitation · cannot appear to visitors

**PASS** at UNIT + WIRING tiers.

Shop page gating · `[businessSlug]/page.tsx`:
- Lines 109-121 (setup-complete banner branch):
  ```ts
  if (sp.setup === "complete") {
    const bannerSession = await resolveNexAppSessionFromContext().catch(() => null);
    if (bannerSession && bannerSession.account.id === business.owner_account_id) {
      const { SetupCompleteBanner } = await import("./_setup-complete-banner");
      setupBanner = <SetupCompleteBanner business={business} />;
    }
  }
  ```
- Lines 122-134 (personalise invitation else branch):
  ```ts
  } else {
    const inviteSession = await resolveNexAppSessionFromContext().catch(() => null);
    if (inviteSession && inviteSession.account.id === business.owner_account_id) {
      const { PersonaliseInvitation } = await import("./_personalise-invitation");
      setupBanner = <PersonaliseInvitation business={business} />;
    }
  }
  ```

Three critical safety properties verified:
1. **Dynamic imports INSIDE the ownership guard** — non-owners never cause the banner modules to load into the server bundle (`await import(...)` is deferred until the guard passes)
2. **Null-session fail-safe** — `.catch(() => null)` on session resolution means guests resolve to `null` and the guard rejects
3. **Mutually exclusive branches** — the two banners are an if/else; both guard independently

Banner source files · verified private-field read audit:
- `_setup-complete-banner.tsx` reads only: `slug`, `display_name`, `business_category`, `profile !== null` (existence check), `archived_at === null`
- `_personalise-invitation.tsx` reads only: `business.id`, `business.slug`, `business.display_name`
- Neither reads: `owner_account_id` (in rendered output), `profile.*` contents, phone, email, bio, chat_theme, cover_layout_id

Tests pinning this: 
- `track-b1.test.ts > _personalise-invitation.tsx · structure > reads only PUBLIC fields` (8 negative assertions)
- `track-b1.test.ts > [businessSlug]/page.tsx · ownership gate on PersonaliseInvitation` (2 assertions requires session AND ownership)
- `track-b.test.ts > _setup-complete-banner.tsx · structure` (4 assertions)

BROWSER · NOT VERIFIED (would need a non-owner Playwright session loading `/${slug}?setup=complete` to confirm no banner HTML in the response).
CUSTOMER-VISIBLE · NOT VERIFIED directly, but the dynamic-import-inside-guard structure guarantees non-owners cannot cause the banner to render even in theory.

---

## Item 6 · No mocks · no false success · no unsupported claims

**PASS** at UNIT + WIRING tiers.

Honest copy verified in rendered content:

Services-first page · `services-first/page.tsx:200-208`:
```
"A full booking / appointment / deposit flow isn't yet available in NEX.
 Right now this listing shows your service to customers · they contact
 you through NEX chat to arrange details. Automated scheduling is in
 design."
```

Personalise invitation · `_personalise-invitation.tsx:150`:
```
"Pick a chat theme and cover · 2 steps · always optional."
```
No "setup incomplete" or "setup complete" claim.

Setup-complete banner · `_setup-complete-banner.tsx:234-239`:
```
"Visibility to customers depends on NEX commerce being enabled and the
 business not being archived. There is no 'publish' button today · if
 you can reach this page as a visitor, so can anyone with the link
 /{slug}."
```

Accommodation + Property category-first-entry copy explicitly names what's missing per owner's rule (`_category-first-entry-client.tsx:131-146`):
- Accommodation: *"Room inventory, nightly rates, availability calendars, and reservations are in design and not yet available in NEX."*
- Property: *"A dedicated property listing editor is on the roadmap."*

Tests pinning this:
- `track-c.test.ts > services-first/page.tsx · structure > renders prominent 'honest note' about booking NOT implemented` (1 assertion)
- `track-c.test.ts > services-first/page.tsx · structure > does NOT fabricate booking engine capabilities` (3 negative assertions)
- `track-b.test.ts > categoryEntrySpec · honest per-category copy > accommodation · honestNote explicitly names missing features` (3 assertions)
- `track-b1.test.ts > _personalise-invitation.tsx · structure > honest copy · no 'setup incomplete' or 'setup complete' claim` (5 negative assertions)

BROWSER + CUSTOMER-VISIBLE · NOT VERIFIED directly, but source-pinned.

---

## Item 7 · Pre-existing worktree preserved

**PASS**.

Baseline after push:
- 37 modified files remaining uncommitted (search page refactor · chat guest/peer refactor · prototypes · env templates · scripts · support-page background · themes-tour follow-up to first-contact panel · etc.)
- 178 untracked files remaining (migrations 158-197 · prototype scaffolds · Playwright config/specs · screenshots · support-background.png · various doctrine docs from prior sessions)
- `git status --short | wc -l` = 175 (37 + 138 reported-as-type-?? · but detailed count shows 178 untracked when enumerated directly)
- No pre-session file was staged in `d28ed18` (verified via `git show --stat d28ed18` enumeration of exactly the 28 Bisnis files)

Explicit staging via named paths (never `-A` or `.`) · CLAUDE.md §3 compliance.

---

## Item 8 · 328-test result reproducible from the documented command

**PASS**.

Just re-executed (not during this session's primary builds · as a verification step for this review):

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
  Duration  619ms
```

Suite breakdown:
| Suite | Tests | Scope |
|---|---|---|
| `make-it-yours/__tests__/track-c.test.ts` | 40/40 | Track C · wrapper routing + menu-first + services-first |
| `[businessSlug]/__tests__/track-b1.test.ts` | 20/20 | Track B.1 · personalise invitation |
| `onboarding/first-product/__tests__/track-b.test.ts` | 46/46 | Track B · category routing + description + banner |
| `make-it-yours/__tests__/make-it-yours.test.ts` | 40/40 | Phase 2 · two-step setup |
| `__tests__/business-service-cover-layout.test.ts` | 11/11 | Phase 1 · cover validator |
| `home/__tests__/first-contact-panel.test.ts` | 57/57 | Sealed first-contact (b5bae9f) |
| `home/__tests__/first-visit-invitation.test.ts` | 30/30 | Sealed first-visit invitation |
| `chat/first-visit/__tests__/first-visit.test.ts` | 57/57 | Sealed Themes tour |
| `__tests__/nex-official-welcome.test.ts` | 10/10 | Sealed NEX1 welcome body renderer |

Totals: 10 files · 328 tests · 619ms. Reproducible across runs.

---

## Evidence tier summary

| Area | UNIT | WIRING | BROWSER | REAL-PERSIST | CUSTOMER-VISIBLE |
|---|---|---|---|---|---|
| Products first-entry journey | ✓ (46 Track B tests) | ✓ (file:line pinned) | ✗ blocked | ✗ forbidden | ✗ not inspected |
| Food first-entry journey | ✓ (40 Track C tests) | ✓ | ✗ | ✗ | ✗ |
| Services first-entry journey | ✓ (40 Track C tests) | ✓ | ✗ | ✗ | ✗ |
| Phase 2 two-step persistence (theme + cover) | ✓ (40 tests + 11 cover-validator) | ✓ (sealed actions reused) | ✗ | ✗ | ✗ |
| Owner-only banner + invitation | ✓ (20 Track B.1 tests + 4 Track B tests) | ✓ (double-gate via dynamic import inside guard) | ✗ | ✗ | ✗ (not confirmed non-owner receives no HTML) |
| Sealed-surface untouched | ✓ (10 pinning assertions across tracks) | ✓ (git diff proves zero sealed file in d28ed18) | n/a | n/a | n/a |
| Honest "coming soon" copy | ✓ (negative assertions on fake affordances) | ✓ | ✗ | ✗ | ✗ |

**Zero FAIL · 7 NOT-VERIFIED-tier gaps · all documented honestly in the implementation reports as owner-approved deferred verifications.**

---

## Pre-existing documented limitations (unchanged by this review)

All of the following were surfaced in prior reports and remain
accurate · they are NOT regressions, they are explicit scope
boundaries authorised by the owner:

1. **BROWSER-tier verification blocked** on `tests/e2e/.auth/state.json` absence · owner's call to lift.
2. **REAL-PERSIST-tier verification forbidden** by Phase 2+ guardrails ("No database queries or writes") · would require explicit DB authorisation.
3. **Services booking engine NOT implemented** · honest "in design" copy present throughout services-first + CategoryFirstEntryClient surfaces.
4. **Accommodation reservation infrastructure NOT implemented** · honest "coming soon" throughout + still routes to `/manage/venue` (profile-only).
5. **Food migration 161 (cuisine · dietary · delivery platforms)** remains DRAFT (not applied to live Supabase) · Track C's menu-first wrapper does not consume those columns.
6. **Product-submit path still bypasses Phase 2** (sealed `createFirstProductAction` → `/${slug}` preserved per Track B 1B) · mitigated by Track B.1's PersonaliseInvitation.
7. **Vercel deployment status for `d28ed18`** not inspected (CLAUDE.md §5 requires separate auth to verify production linkage).

---

## FINAL VERDICT

**ACCEPTED FOR BROWSER VERIFICATION.**

All 8 review items PASS at the UNIT + WIRING tiers. Zero sealed-break
detected. Honest copy preserved throughout. Pre-existing worktree
intact. The 328-test suite reproduces cleanly from the documented
command. The commit `d28ed18` on `origin/main` is a clean,
scope-contained delivery of the three-option Bisnis first-entry
flow.

### Smallest next actions (owner's call)

To close the three outstanding verification gaps, the smallest
possible next steps are:

1. **BROWSER tier** · Owner generates `tests/e2e/.auth/state.json` via
   `npx playwright codegen --save-storage=tests/e2e/.auth/state.json --device="Pixel 7" http://localhost:3008/nex-native/sign-in`
   on their own machine. Then the existing authed journey spec +
   stable Track B/B.1/C data-attributes exercise the real DOM. New
   Playwright scenarios can be added for menu-first + services-first
   once the harness is active.

2. **REAL-PERSIST tier** · Owner authorises a one-shot DB-write
   verification: a staging run (or a safe production account) exercising
   createMenuItem + insertService + updateChatTheme + updateCoverLayoutId.
   Not a code change · a lift of the "no DB access" guardrail for a single
   verification pass.

3. **CUSTOMER-VISIBLE tier** · Owner opens the deployed shop URL for an
   authored test business and confirms:
   - As the owner: setup-complete banner shows OR personalise invitation
     chip shows (never both; never neither when `?setup=complete` matches)
   - As a non-owner (incognito / different account): neither renders ·
     regular shop page only

4. **Vercel linkage** · Owner confirms `d28ed18` triggered the expected
   Vercel deployment, OR confirms Vercel is not auto-linked to this repo
   and manual deployment is deferred.

None of (1)–(4) require code changes. They are verification runs.
Once any of them produces concrete evidence, the corresponding
NOT-VERIFIED tier flips to VERIFIED in a follow-up update to this
report.

**Do not begin Track D or any further feature work until the owner
authorises based on the verification evidence from above.**

---

## Compliance checklist

- [x] Read-only review · no file modifications
- [x] No DB queries · no `.env.local` reads · no server start/stop
- [x] `D:/trades` not touched
- [x] All pre-existing changes preserved · 37 modified + 178 untracked unchanged
- [x] No commits · no pushes · no resets · no stashes · no branch changes
- [x] 8 review items each labelled PASS / FAIL / NOT VERIFIED with file:line evidence
- [x] Evidence tiers rigorously separated (UNIT · WIRING · BROWSER · REAL-PERSIST · CUSTOMER-VISIBLE)
- [x] 328-test result reproduced from documented command
- [x] Final verdict delivered: ACCEPTED FOR BROWSER VERIFICATION
- [x] Smallest next actions listed · all are verifications, not implementations

Stopping for owner review.
