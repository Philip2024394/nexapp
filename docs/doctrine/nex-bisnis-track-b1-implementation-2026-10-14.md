# NEX Bisnis · Track B.1 Implementation Report · 2026-10-14

Status: implemented locally · NOT committed · NOT pushed · awaiting

Authorisation: Track B.1 only · "Option B" from
`docs/doctrine/nex-bisnis-track-b-acceptance-review-2026-10-14.md` ·
owner's explicit instruction (2026-10-14).

Companion docs:
- `nex-bisnis-end-to-end-acceptance-gate-2026-10-14.md`
- `nex-bisnis-track-b-implementation-2026-10-14.md`
- `nex-bisnis-track-b-acceptance-review-2026-10-14.md`

---

## 1 · Scope delivered

Single additive change: owner-only "Personalise your business"
invitation on `/nex-native/${slug}` whenever an owner views their
own business page WITHOUT `?setup=complete`. Mutually exclusive with
the existing Track B setup-complete banner.

**Fills exactly the gap** the owner identified at Track B acceptance:

> "If a product seller adds their first product and goes straight to
> the business page without choosing their chat theme and cover, the
> journey is incomplete."

The sealed `createFirstProductAction` terminal redirect to
`/${slug}` is **preserved byte-identical**. The invitation lives
entirely on the destination page and is honest, owner-only, and
derivation-free.

---

## 2 · Exact files changed

### New files

| Path | Role | Lines |
|---|---|---|
| `src/app/nex-native/[businessSlug]/_personalise-invitation.tsx` | Server-render-safe owner-only invitation chip · reads only public business fields | ~160 |
| `src/app/nex-native/[businessSlug]/__tests__/track-b1.test.ts` | 20 focused source-shape tests · 4 describe blocks | ~250 |

### Edited files

| Path | Change |
|---|---|
| `src/app/nex-native/[businessSlug]/page.tsx` | +15 / −0 · extended the owner-only banner block · `?setup=complete` branch mounts `SetupCompleteBanner` (Track B · unchanged) · else branch mounts new `PersonaliseInvitation` when viewer is the owner · same `setupBanner` variable reused for the single injection point into both cover-A and legacy render paths |

### NOT touched (sealed · byte-identical)

- `src/app/nex-native/_actions.ts` · all sealed server actions preserved
- `src/app/nex-native/onboarding/first-product/*` · Track B edits preserved · no new changes
- `src/app/nex-native/business-setup/make-it-yours/*` · Phase 2 preserved
- `src/lib/nex-native/business-service.ts` · Phase 1 fix preserved
- `src/app/nex-native/[businessSlug]/_setup-complete-banner.tsx` · Track B preserved
- All sealed first-contact / first-visit / Themes tour surfaces
- Commerce gate · entitlement checks · tier-gate

---

## 3 · Behaviour · the three owner-visit states

| Visitor | URL | Banner shown |
|---|---|---|
| Signed-in owner | `/${slug}` (no params) | **Personalise invitation** (Track B.1 · new) |
| Signed-in owner | `/${slug}?setup=complete` | **SetupCompleteBanner** (Track B · unchanged) |
| Non-owner / guest | `/${slug}` (either URL variant) | **Nothing** · regular shop page renders · banner source files are not even imported (lazy dynamic imports inside the ownership guard) |

The invitation and the setup-complete banner are **mutually exclusive by URL state**. Both guard on `session.account.id === business.owner_account_id`. Neither leaks private information · both read only `business.id`, `business.slug`, `business.display_name` (all public shop-page fields).

---

## 4 · Verification against owner's Track B.1 conditions

### 4.1 · "Preserve the sealed createFirstProductAction redirect"

**PASS** · verified via test · `sealed createFirstProductAction terminal redirect to /{slug} preserved` matches:
```ts
redirect(`/nex-native/${business.slug}`...);
```
in the sealed action. No change.

### 4.2 · "Reuse the existing Phase 2 setup routes and ownership checks"

**PASS** · the CTA points at the existing route:
```
/nex-native/business-setup/make-it-yours/theme?businessId=<id>
```
This is the exact URL built by Track B's `_category-first-entry-client.tsx`. The downstream Phase 2 Step 1 server page re-validates ownership via `getBusinessById(businessId)` + `owner_account_id === session.account.id`. No new auth path.

### 4.3 · "Truthful · invites the owner to complete setup · must not claim setup is already complete"

**PASS** · the rendered copy is:
- Headline: "Personalise your business"
- Subline: "Pick a chat theme and cover · 2 steps · always optional."
- CTA: "Make NEX yours →"

Nowhere does it say "setup incomplete", "you haven't finished", "setup complete", or similar. Pin test `honest copy · no 'setup incomplete' or 'setup complete' claim` enforces this with explicit negative regex checks for each phrase, and a positive match on "always optional".

### 4.4 · "Do not infer completion from cover_layout_id IS NULL or chat_theme = 'theme-0'"

**PASS** · the invitation source NEVER reads `chat_theme` or `cover_layout_id`. Pinned by test:
```ts
expect(code).not.toMatch(/chat_theme/);
expect(code).not.toMatch(/cover_layout_id/);
```
The invitation renders unconditionally for owner-viewers of their own shop · pure opt-in affordance.

### 4.5 · "Do not add a database column, migration, cookie, or new completion flag"

**PASS**:
- Zero new tables / columns / migrations
- Zero new cookie reads or writes · pinned by `code.not.toMatch(/cookies\(\)/)`
- Zero new flags · no persistence of any kind
- Zero new DB mutations · pinned by `code.not.toMatch(/\.(insert|update|upsert|rpc)\(/)`
- No completion-state inference anywhere

### 4.6 · "Do not show the invitation to other users or expose private business information"

**PASS** · dual gate on the shop page:

```ts
} else {
  const inviteSession = await resolveNexAppSessionFromContext().catch(() => null);
  if (inviteSession && inviteSession.account.id === business.owner_account_id) {
    const { PersonaliseInvitation } = await import("./_personalise-invitation");
    setupBanner = <PersonaliseInvitation business={business} />;
  }
}
```

Non-owners OR guests OR requests inside the `?setup=complete` branch never reach the invitation mount. The `PersonaliseInvitation` module is DYNAMICALLY imported INSIDE the ownership guard · its code never ships in the HTML for non-owners.

Private-info audit: the component reads only `business.id`, `business.slug`, `business.display_name` (all customer-public). Pinned by test `reads only PUBLIC fields from the business row` with explicit negative checks for `business.profile.*`, `business.owner_account_id` (in rendered output), `business.phone`, `business.email`, `business.description`.

### 4.7 · "Preserve all existing modifications and untracked files"

**PASS** · verified via `git status --short` · 34 pre-session modified + 177 pre-session untracked files unchanged. Phase 1 + Phase 2 + Track B + support-background + themes-tour follow-up all intact.

### 4.8 · "Add focused tests for visibility, ownership, navigation, and regressions"

**PASS** · 20 new tests in `track-b1.test.ts` covering:
- Invitation structure (server-render-safe · exports · typed props)
- Phase 2 route reuse (businessId URL preserved)
- Data attributes for e2e selectors
- Public-field-only reads
- NO chat_theme / cover_layout_id derivation
- Honest copy (no "incomplete" or "complete" claim)
- Zero mutations / forms / cookies
- Mobile tap-target compliance
- Shop page mutual exclusivity (if/else branches on `?setup=complete`)
- Ownership gates on both banner mounts
- Preservation of sealed commerce gate order
- Preservation of Track B pin: `{setupBanner}` injected into both cover-A and legacy paths
- Sealed `createFirstProductAction` redirect preserved
- Sealed `createBusinessAction` redirect preserved
- Setup-complete banner source untouched

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
Test Files  9 passed (9)
     Tests  284 passed (284)
  Duration  562ms
```

Breakdown:

- `[businessSlug]/__tests__/track-b1.test.ts` · **20/20 pass** (new coverage)
- `onboarding/first-product/__tests__/track-b.test.ts` · 46/46 (Track B regression · still green)
- `business-setup/make-it-yours/__tests__/make-it-yours.test.ts` · 40/40 (Phase 2 regression · still green)
- `__tests__/business-service-cover-layout.test.ts` · 11/11 (Phase 1 regression · still green)
- `home/__tests__/first-contact-panel.test.ts` · 57/57 (sealed · untouched)
- `home/__tests__/first-visit-invitation.test.ts` · 30/30 (sealed · untouched)
- `chat/first-visit/__tests__/first-visit.test.ts` · 57/57 (sealed · untouched)
- `__tests__/nex-official-welcome.test.ts` · 10/10 (sealed · untouched)

TypeScript check on Track B.1 touched files:
```
./node_modules/.bin/tsc --noEmit 2>&1 | grep -E "_personalise-invitation|businessSlug/page\.tsx|track-b1"
```
→ zero errors.

The three pre-existing TS errors in sibling pages (`[businessSlug]/[productId]/direct/page.tsx`, `[businessSlug]/[productId]/page.tsx`, `[businessSlug]/returns/page.tsx`) remain · they are CLAUDE.md-noted known residue outside Track B.1 scope · unmodified.

---

## 6 · Honest limitations

### 6.1 · Live DB verification still not performed

Vitest tests exercise source-shape + pure predicates only (284 total). The actual Supabase round-trip for `createFirstProductAction` → `/${slug}` → invitation render chain is NOT exercised (owner guardrail · no DB access). Code-wiring is proven.

### 6.2 · Playwright authed scenarios NOT added

`tests/e2e/.auth/state.json` still does not exist. The DOM selectors (`data-nex-personalise-invitation`, `data-nex-personalise-invitation-cta`, etc.) are stable so pins will be straightforward when the authed harness lands.

### 6.3 · Invitation renders for EVERY owner visit

Because the owner's rule explicitly forbids inferring completion state from `chat_theme` or `cover_layout_id`, the invitation has no "already completed" branch · it renders every time an owner visits their own `/${slug}` without `?setup=complete`.

This is the honest-settings-surface model owner approved: "The invitation can remain an honest optional next step unless existing persisted state proves a stronger condition." For an owner who has already run Phase 2 and happily keeps using NEX, the invitation remains a small permanent chip at the top of their shop page offering the two-step as an opt-in. The copy explicitly says "always optional" so the owner can ignore it indefinitely without needing a dismiss affordance.

### 6.4 · Non-owner viewers do not see the invitation

By design. Customers who visit `/${slug}` see no banner at all · the regular shop page renders unchanged.

### 6.5 · The `?setup=complete` URL remains spoofable (unchanged from Track B)

An owner who manually appends `?setup=complete` sees the richer setup-complete banner (Track B behaviour). The banner is honest regardless of when it's viewed. Not a Track B.1 concern.

### 6.6 · Visual confirmation not performed

Dev server (PID 7172) running on 3008 · HMR picks up new files · owner can refresh `/${slug}` for a business they own (or `/${slug}?setup=complete` for the richer banner) to visually confirm. I did not instrument the dev server.

---

## 7 · Final diff summary

### Status

```
 M src/app/nex-native/[businessSlug]/page.tsx
 M src/app/nex-native/onboarding/first-product/_first-product-client.tsx    (Track B · unchanged in B.1)
 M src/app/nex-native/onboarding/first-product/page.tsx                       (Track B · unchanged in B.1)
?? src/app/nex-native/[businessSlug]/_personalise-invitation.tsx             (Track B.1 · NEW)
?? src/app/nex-native/[businessSlug]/_setup-complete-banner.tsx              (Track B · unchanged in B.1)
?? src/app/nex-native/[businessSlug]/__tests__/                              (Track B.1 · NEW directory)
?? src/app/nex-native/onboarding/first-product/__tests__/                    (Track B · unchanged in B.1)
?? src/app/nex-native/onboarding/first-product/_category-first-entry-client.tsx  (Track B · unchanged in B.1)
?? docs/doctrine/nex-bisnis-track-b1-implementation-2026-10-14.md            (this report)
```

### Line totals (Track B.1 scope only)

| Scope | Lines |
|---|---|
| New source file (PersonaliseInvitation) | ~160 |
| New test file | ~250 |
| Edits to `[businessSlug]/page.tsx` | +15 / −0 |
| New doctrine doc (this file) | ~300 |

---

## 8 · Guardrail compliance

- [x] Preserve pre-existing worktree changes · 34 pre-session modified + 177+ pre-session untracked · unchanged
- [x] Phase 1 cover-validator fix (local · uncommitted) · unchanged
- [x] Phase 2 two-step setup (local · uncommitted) · unchanged
- [x] Track B category-aware routing + description field + setup-complete banner (local · uncommitted) · unchanged
- [x] First-contact panel commit `b5bae9f` on `origin/main` · unchanged
- [x] No commit · no push · no reset · no stash · no branch change
- [x] No DB query / write / migration / `.env.local` read / dependency install / deployment / server restart
- [x] No sealed redirect or contract modified (verified via source-shape pins in track-b1.test.ts)
- [x] No new DB column, migration, cookie, or completion flag
- [x] No duplicate selector / catalogue / persistence mechanism
- [x] No completion-state inference from any DB field
- [x] Owner-only · non-owners never receive the banner HTML
- [x] Private-field read audit: only `business.id`, `business.slug`, `business.display_name` consumed
- [x] Focused tests added · 20 new · all green
- [x] Full regression · 264 pre-existing tests · all still green

**Stopping here for owner review. Do not begin Track C (category-specific
backends) or Track D (visibility clarity schema additions) without
separate authorisation.**
