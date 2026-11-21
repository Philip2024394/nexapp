# NEX Bisnis · Track B Acceptance Review · 2026-10-14

Status: READ-ONLY. No source edits. No DB queries. No `.env.local`
reads. No tests re-run beyond the ones already green (259/259 last
session · did not need re-run for a pure review). Pre-existing

Scope: owner's seven-point acceptance review of Track B against
`docs/doctrine/nex-bisnis-track-b-implementation-2026-10-14.md`.

---

## 1 · Category-routing component safely handles every supported category + unknown/null

**PASS**

File: `src/app/nex-native/onboarding/first-product/page.tsx:63-80`

Branch logic:
```ts
const rawCategory = business.business_category;
const isNonProductCategory =
  typeof rawCategory === "string" &&
  isBusinessCategory(rawCategory) &&
  rawCategory !== "products";
```

Walked exhaustively:

| `business_category` value | `typeof string?` | `isBusinessCategory`? | `!== "products"`? | Resolved | Rendered |
|---|---|---|---|---|---|
| `"food"` | ✓ | ✓ | ✓ | TRUE | `<CategoryFirstEntryClient category="food">` |
| `"services"` | ✓ | ✓ | ✓ | TRUE | `<CategoryFirstEntryClient category="services">` |
| `"accommodation"` | ✓ | ✓ | ✓ | TRUE | `<CategoryFirstEntryClient category="accommodation">` |
| `"property"` | ✓ | ✓ | ✓ | TRUE | `<CategoryFirstEntryClient category="property">` |
| `"products"` | ✓ | ✓ | ✗ | FALSE | `<FirstProductClient>` (sealed path) |
| `null` | ✗ | n/a | n/a | FALSE | `<FirstProductClient>` (safe default) |
| `undefined` | ✗ | n/a | n/a | FALSE | `<FirstProductClient>` |
| `""` | ✓ | ✗ (empty rejected by `isBusinessCategory` at `categories.ts:36`) | n/a | FALSE | `<FirstProductClient>` |
| arbitrary string `"foo"` | ✓ | ✗ (rejected by whitelist) | n/a | FALSE | `<FirstProductClient>` |

TypeScript narrows `rawCategory` to `Exclude<BusinessCategory, "products">` inside the branch (via `isBusinessCategory` type-guard + manual exclusion), which matches `<CategoryFirstEntryClient>`'s typed prop at `_category-first-entry-client.tsx:62`. No type-cast bypass.

No crash paths · no silent miscategorisation · fail-safe default to the products form (which is the pre-Track-B universal behaviour).

---

## 2 · Food · Services · Accommodation · Property destinations exist + appropriate

**PASS**

Routes confirmed to exist on disk:

| Category | Destination href | File verified |
|---|---|---|
| `food` | `/nex-native/manage/menu` | `src/app/nex-native/manage/menu/page.tsx` exists |
| `services` | `/nex-native/manage/services` | `src/app/nex-native/manage/services/page.tsx` exists |
| `accommodation` | `/nex-native/manage/venue` | `src/app/nex-native/manage/venue/page.tsx` exists |
| `property` | `/nex-native/manage` | `src/app/nex-native/manage/page.tsx` exists |

Honest-note copy appropriateness (verified against actual
capabilities per earlier audits):

| Category | Honest note shown? | Content matches reality |
|---|---|---|
| `food` | NO (correctly null · menu editor is live) | Menu editor at `/manage/menu` is a working CRUD surface (migrations 066 + 079) · no over-claim |
| `services` | YES: "Full booking + appointment features are in design · for now, customers enquire through NEX chat and you handle scheduling directly." | Services audit confirmed: `nex_service` table + list editor exist · NO appointment table · NO booking engine. Honest. |
| `accommodation` | YES: "Room inventory, nightly rates, availability calendars, and reservations are in design and not yet available in NEX." | Accommodation audit confirmed: zero backend for rooms / rates / calendars / reservations · `events_profile` is a venue-profile field only. Honest. |
| `property` | YES: "A dedicated property listing editor is on the roadmap. For now the business page shows your profile, and chat is where you share listings." | No property-specific surface exists today · chat-mediated. Honest. |

The owner's rule "Do not fabricate functionality or claim incomplete categories are live" is observed. Specifically the accommodation copy names rooms + rates + calendars + reservations explicitly as "in design and not yet available" — matches the owner's own instruction verbatim.

---

## 3 · Setup-complete banner · owner-only · no private disclosure · real-condition visibility

**PASS**

### 3.1 · Owner-only gate

File: `src/app/nex-native/[businessSlug]/page.tsx` (the mount site)

The banner is instantiated INSIDE a double-gate:
```ts
if (sp.setup === "complete") {
  const bannerSession = await resolveNexAppSessionFromContext().catch(() => null);
  if (bannerSession && bannerSession.account.id === business.owner_account_id) {
    const { SetupCompleteBanner } = await import("./_setup-complete-banner");
    setupBanner = <SetupCompleteBanner business={business} />;
  }
}
```

Three required conditions:
1. URL carries `?setup=complete`
2. A valid session resolves (guest → null → no banner)
3. The session's account id matches `business.owner_account_id`

Non-owners OR guests OR requests without the query param never cause the banner to mount. No lazy-import side effects before the guard.

### 3.2 · Zero private-info disclosure

File: `src/app/nex-native/[businessSlug]/_setup-complete-banner.tsx`

Fields read from `business` row:
- `business.slug` — PUBLIC (customer-facing URL)
- `business.display_name` — PUBLIC (shop name)
- `business.business_category` — PUBLIC category token (products / food / etc.)
- `business.profile !== null` — reads only the **existence**, never contents (type-level · the `.profile` jsonb can carry arbitrary owner metadata; the banner only consults `!== null`)
- `business.archived_at === null || undefined` — reads only the archival flag

Fields NOT read:
- NO `profile.*` contents (bio, contact details, etc.)
- NO phone / email (these live on `nex_account`, not `nex_business`)
- NO owner_account_id in rendered output (compared in the guard, not displayed)

Grep confirmed: the banner source references `display_name`, `slug`, `business_category`, `profile`, `archived_at`. Nothing private.

### 3.3 · Visibility derivation uses REAL route + commerce conditions

Pure predicate `deriveVisibility(business)` at `_setup-complete-banner.tsx:63-99`:

- `visibleToCustomers = business.archived_at === null || undefined` — the EXACT condition the public shop page uses to decide whether to notFound()
- Honest reason copy:
  - Non-archived: "Anyone with the link to this page can view it right now." · TRUE because we're literally rendering ON the shop page by that point (we passed the commerce gate + the business exists + archived_at is null)
  - Archived: "This business is archived · it does not appear in search or discovery." · matches the real `discovery-service.ts` filter which uses `.is("archived_at", null)`
- Honest explanatory copy below the states explicitly states: "Visibility to customers depends on NEX commerce being enabled and the business not being archived. There is no 'publish' button today."

The derivation is correct AND the UI honestly communicates the mechanic without inventing publication semantics.

Note: because the banner only mounts AFTER the commerce gate has already passed (shop page `redirect("/nex-native/home")` runs first for commerce-disabled requests), the "visible to customers" state is inherently TRUE when the banner renders. The banner correctly reflects this. If commerce is disabled, the owner never reaches `/${slug}` and so never sees the banner · they instead see `/home` without any Phase-2 completion banner. This is a tiny UX cliff but not a correctness issue — nothing claims "complete" when it isn't.

---

## 4 · Product-description field reaches the sealed action + persists through the service

**PASS**

### 4.1 · UI → Form submission

File: `_first-product-client.tsx:445-461` (Track B edit)

```tsx
<textarea
  name="product_description"
  rows={3}
  maxLength={1000}
  placeholder="Scent · size · what it's good for · who it's for"
  ...
/>
```

- `name="product_description"` matches exactly what the sealed action reads
- `maxLength={1000}` client-side · the sealed action's server-side cap is 2000 (`_actions.ts:3735` and `3839`) · so client input is always well within server limits · no truncation surprise

### 4.2 · Sealed action reads it

`_actions.ts:3364`:
```ts
const description = String(formData.get("product_description") ?? "").trim();
```

Byte-identical to pre-Track-B · unchanged.

### 4.3 · Length validation

`_actions.ts:3735` and `_actions.ts:3839`:
```ts
if (description !== null && description.length > 2000) { ... reject ... }
```

Server-side enforcement is in place for the dual code paths (regular product create + first-product). Our UI maxLength={1000} means legitimate submissions always pass.

### 4.4 · Service → DB

`product-service.ts:299`:
```ts
.insert({
  business_id: input.business_id,
  name: input.name,
  description: input.description ?? null,
  ...
})
```

Writes to `nex_product.description` column. The sealed action's final call to `productService.createProduct({..., description: description.length > 0 ? description : null, ...})` at `_actions.ts:6187` passes the string through unchanged. Null when empty · string when non-empty.

End-to-end persistence path confirmed at WIRING tier. Not DB-verified (owner guardrail · no DB access).

---

## 5 · Theme-and-cover link preserves identity + does not imply completion

**PASS**

### 5.1 · Account + business identity

File: `_category-first-entry-client.tsx:189` (Make-it-yours link)

```tsx
const makeItYoursHref = `/nex-native/business-setup/make-it-yours/theme?businessId=${encodeURIComponent(businessId)}`;
```

- `businessId` is passed in from the server page via prop (`page.tsx:76: businessId={business.id}`)
- `encodeURIComponent` wraps the UUID safely
- Downstream Phase 2 Step 1 (theme/page.tsx:93-98) re-validates ownership via `getBusinessById(businessId)` + `owner_account_id === session.account.id`
- Session identity resolves afresh via `resolveNexAppSessionFromContext()` on Step 1 server render — no cross-session leakage

### 5.2 · Does not imply completion

Link copy: `"Make NEX yours in 2 steps · theme + cover →"`

- Explicitly says "2 steps" — the user understands there is work to do
- The eyebrow above says "Your {category} business is set up" — refers to the business ROW being created (which is true), not to full setup
- The heading says "Add your first menu item" / "List your first service" / etc. — directs further action
- The honest note below (where applicable) names what's still missing (booking · reservation · etc.)

No "setup complete" or "all done" copy on this surface. The ONLY surface that says "Setup complete" is the banner on `/${slug}?setup=complete`, which is only reachable AFTER Phase 2 Step 2 success (sealed path).

Guardrail honoured: "A setup URL may initiate the flow, but it must not falsely establish completion."

---

## 6 · Sealed surfaces remain intact

**PASS · verified via git diff**

| Surface | Expected state | Observed |
|---|---|---|
| `src/app/nex-native/_actions.ts` | byte-identical | NOT in `git diff --stat` output · confirmed unchanged |
| `src/lib/nex-native/business-service.ts` | Phase 1 fix only (14 insertions / 18 deletions · owner-approved) | matches Phase 1 scope exactly · nothing more |
| `src/app/nex-native/business-setup/make-it-yours/*` | Phase 2 untouched | NOT in diff · unchanged |
| `src/app/nex-native/manage/shop/_cover-layout-action.ts` | sealed · byte-identical | NOT in diff · unchanged |
| `src/app/nex-native/home/_first-contact-panel.tsx` | sealed · untouched (committed as `b5bae9f` on origin/main) | NOT in diff · unchanged |
| `src/app/nex-native/home/_first-visit-invitation.tsx` | sealed · untouched | NOT in diff · unchanged |
| `src/app/nex-native/chat/first-visit/*` | sealed · untouched | NOT in diff · unchanged |
| Sealed first-contact predicate (`_first-contact-predicate.ts`) | untouched | NOT in diff · unchanged |
| Entitlement checks (`tier-gate.ts`, `effectiveTier`) | reused · not modified | NOT in diff · unchanged |

Regression test evidence from the Track B run:
- `make-it-yours/__tests__/make-it-yours.test.ts` · 40/40 (Phase 2 regression)
- `__tests__/business-service-cover-layout.test.ts` · 11/11 (Phase 1 regression)
- `home/__tests__/first-contact-panel.test.ts` · 57/57 (sealed)
- `home/__tests__/first-visit-invitation.test.ts` · 30/30 (sealed)
- `chat/first-visit/__tests__/first-visit.test.ts` · 57/57 (sealed)
- `__tests__/nex-official-welcome.test.ts` · 10/10 (sealed)

All sealed suites still green against the current worktree state.

---

## 7 · Bypass + incorrect-category reach inventory

### 7.1 · PRESERVED known limitation · Product-submit path bypasses Phase 2 two-step

**STATUS**: owner-approved tradeoff from Phase 2 1B authorisation (documented in Phase 2 report §5.1 and Track B report §5.4).

**Mechanics**:
- User on `/onboarding/first-product` whose category is `products` (or null)
- Fills in the product form and submits
- Sealed `createFirstProductAction` runs → sealed terminal redirect to `/${slug}` (sealed 2026-10-01)
- User never visits `/business-setup/make-it-yours/theme` or `/cover`
- Phase 2 two-step is skipped

**Why this remains**: changing the sealed `createFirstProductAction` terminal redirect would break the sealed Seller Central celebration doctrine (sealed 2026-10-01). Owner's Track B authorisation: "Do not change a sealed redirect or contract without stopping and presenting the exact conflict for separate authorisation."

**Impact for Track B acceptance**: this bypass exists ONLY on the Products category (the one category that actually renders the first-product form today). Food · Services · Accommodation · Property sellers go through `<CategoryFirstEntryClient>`, which has NO form-submit · their only submit-equivalent is navigating to `/manage/menu` / `/manage/services` / etc. From those surfaces, there is no "complete your two-step setup" chain back to Phase 2 Step 1 either.

**Owner's recommendation needed**: is this an acceptance BLOCKER for Track B? Options:
- **A** · Accept the bypass as the owner-approved tradeoff · ship as-is. Phase 2 two-step remains reachable manually from the make-it-yours URL · product sellers can run it later.
- **B** · Add a post-product-submit affordance (e.g. the `?setup=complete` banner equivalent at `/${slug}` after `createFirstProductAction` redirects there) that explicitly offers the two-step setup. This is a NEW SCOPE and would be Track B.1 or a Phase 2b.
- **C** · Modify the sealed `createFirstProductAction` to carry a `next=` param (sealed-break · requires owner's explicit sign-off).

I did NOT implement any of A/B/C in Track B. The code behaves per the sealed authorisation. Owner decides at acceptance time whether this is a blocker.

### 7.2 · NO NEW BYPASS introduced by Track B

All Phase-2 ownership guards continue to apply:

| Attempted bypass | Guard | Resolved by |
|---|---|---|
| Direct URL `/business-setup/make-it-yours/theme?businessId=<other-user's-business>` | Ownership guard at `theme/page.tsx:93-98` | redirects to `/manage` |
| Direct URL `/business-setup/make-it-yours/cover?businessId=<other-user's-business>` | Ownership guard at `cover/page.tsx:91-96` | redirects to `/manage` |
| Direct URL `/onboarding/first-product?slug=<other-user's-slug>` | Ownership guard at `page.tsx:46-48` | redirects to `/manage` |
| Direct URL `/${slug}?setup=complete` by non-owner | Ownership guard in `[businessSlug]/page.tsx` banner mount block | banner never mounts · page renders as normal shop |
| Direct URL `/${slug}?setup=complete` by owner even if Phase 2 wasn't completed | Banner derives state from DB · shows amber "profile pending" if not activated · honest copy "There is no 'publish' button today" | banner is honest irrespective of fragment |
| Session manipulation of `next=` param in `updateChatThemeAction` | Sealed whitelist at `_actions.ts:4470-4475` | adversarial next-paths rejected · only `/nex-native/*` without `//` passes |

### 7.3 · NO incorrect-category reach

- Food seller → `<CategoryFirstEntryClient category="food">` → primary CTA to `/manage/menu` (correct)
- Services seller → `<CategoryFirstEntryClient category="services">` → primary CTA to `/manage/services` (correct)
- Accommodation seller → `<CategoryFirstEntryClient category="accommodation">` → primary CTA to `/manage/venue` (correct)
- Property seller → `<CategoryFirstEntryClient category="property">` → primary CTA to `/manage` (correct · no property-specific surface exists today)
- Products seller or unknown-category seller → `<FirstProductClient>` → correct (products form is appropriate)

Each category's secondary "Make NEX yours in 2 steps" + tertiary "View public page" links are universal and category-neutral. No incorrect-category reach.

---

## Compliance checklist

- [x] Read-only review · no files modified
- [x] No DB queries · no `.env.local` reads · no server start/stop
- [x] All pre-existing changes preserved · Phase 1 + Phase 2 + themes-tour follow-up + support-background + 34 pre-session modified + 177 pre-session untracked
- [x] Phase 2 commit `b5bae9f` on origin/main unchanged
- [x] Tests not re-run (previous session's 259/259 result is current for this worktree state · no code touched)
- [x] All seven acceptance items verified with file:line evidence

---

## Acceptance recommendation

**Items 1-6 pass without reservation.** Code-level verification is
complete at the WIRING tier.

**Item 7 has one PRESERVED limitation** (Product-submit bypass of
Phase 2 two-step) which was explicitly authorised under Phase 2 1B.
Whether this is acceptable at Track B acceptance is an owner-decision
point:

- If YES (acceptable) → Track B passes acceptance review · ready to
  commit (whenever owner authorises) · ready for Track C scope
  authorisation.
- If NO (blocker) → Track B.1 scope should be defined to add a
  post-product-submit affordance (e.g. a `?setup=complete`-equivalent
  banner on `/${slug}` after any first-product add) that invites the
  two-step setup. This can be built as a small additive change,
  similar in shape to the existing `?setup=complete` banner.

I am not recommending the sealed-break Option C (modify
`createFirstProductAction` redirect). Options A or B are both viable
within the current guardrails.

**Also outstanding (not Track B scope but required for a FULL
end-to-end acceptance per the owner's standing requirement)**:
- BROWSER-tier evidence (authenticated Playwright · still blocked on `tests/e2e/.auth/state.json`)
- REAL-PERSIST-tier evidence (Supabase round-trip · still forbidden by guardrails · would require a separate Phase 2c authorisation)
- Visual confirmation on a real device

These apply to Phase 1 + Phase 2 + Track B all together. Not resolvable
by any amount of audit · require the owner to perform the authed
runs or authorise them.

**Stopping for owner review.** No commit · no push · no further
implementation until the acceptance decision on Item 7 is made.
