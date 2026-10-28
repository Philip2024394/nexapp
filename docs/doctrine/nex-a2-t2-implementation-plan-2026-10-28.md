# A2-T2 · Category Picker Rebuild · Implementation Plan · 2026-10-28

**Status**: DRAFT · awaiting founder approval · **no code will be written until approved**

**Scope**: rebuild `_category-picker.tsx` to carry all 30 departments + first-level categories, with search at top, subcategory expand-in-place, Watches as only Enabled leaf, 29 others as Pending-review with explicit Request-this-category CTA.

**Theme source**: `/manage/live` · see `nex-manage-live-token-audit-2026-10-28.md` (companion doc)

---

## 1 · Preservation checklist (sealed · must not change)

- ✅ Watches remains the sealed 1-of-1 pre-owned flow · no retrofit to multi-variant
- ✅ No DB migrations · no new tables · no touching `nex_product_variant` schema
- ✅ No new category duplicate · the shared TS catalogue is an **interim consolidation**, not a central DB-backed catalogue · doctrine language will make this explicit
- ✅ No changes to the Watches E2E flow · `_upload-client.tsx` fields, `createWatchListingAction`, `grantWatchListingEntitlementMockAction`, `/nex-native/watches/[listingId]` all untouched
- ✅ No changes to sealed primitives: `JokerKeypad` universal keypad rule · `NexInput` / `NexTextarea` · `NexNativeShell` · `SubmitButton`
- ✅ The 4 confirmed founder decisions (theme = /manage/live · Watches frozen · paths approved · B1 = Books/Office/Arts) honoured in copy and behaviour
- ✅ Research completion ≠ enablement · only Watches is Enabled · the other 29 depts render as Pending review regardless of Batch 1 research state
- ✅ Request-fast-track CTA never implies approval or publication · copy explicitly says "we'll review and get back to you"

## 2 · Files proposed for change

| File | Change class | Expected lines of diff |
|---|---|---|
| `src/app/nex-native/manage/watches/new/_category-picker.tsx` | Full rewrite (component kept, API preserved) | ~ -300 / +450 |
| `src/app/nex-native/manage/watches/new/_upload-client.tsx` | None required · consumer API unchanged | 0 |
| `src/app/nex-native/manage/watches/new/page.tsx` | None | 0 |
| `src/app/nex-native/manage/watches/new/_variant-image-row.tsx` | None | 0 |
| `src/lib/nex-native/catalogue/departments.ts` | **NEW** (interim shared TS module) · exports the 30-dept + first-level category tree + Watches `enabled` flag · documented as INTERIM not DB-backed | +~400 |
| `scripts/catalogue/validate-register.mjs` | None (keep as-is) | 0 |

**Total code added**: ~850 lines across 2 files. **No deletions outside the picker rewrite.**

## 3 · Explicit interaction states (owner approves state copy before build)

### State A · Enabled leaf (Watches only today)

**Visual**: emerald rail · `border-emerald-200 bg-emerald-50` tile · `text-neutral-900 font-semibold` label · `text-neutral-500 text-xs` subtitle
**Behaviour**: tap → category becomes the active selection for the upload form (same callback shape as today)
**Copy**: tile shows "Watches · Luxury, smart, fashion" · chip reads `Live` in emerald

### State B · Pending-review leaf (29 of 30 depts today)

**Visual**: neutral rail · `border-neutral-200 bg-white` tile · `text-neutral-700` label · `text-neutral-500 text-xs` subtitle
**Behaviour**: tap → does NOT select the category · opens an inline disclosure that explains status + offers Request-this-category CTA
**Copy on tile**: name + 1-line subtitle only · no "coming soon" or "almost ready" copy that implies imminence
**Copy on disclosure**:
> _This category is in review. We don't yet accept listings here. If you'd like NEX to prioritise it, tell us what you'd list and we'll come back to you._

**Request CTA (SubmitButton variant="secondary")**: `Request this category`
**On submit**: shows a success banner (`border-green-300 bg-green-50 text-green-900`) with copy `Thanks · your request is logged. We'll review and get back to you.` · Stage A files to a placeholder (console log + toast); no DB write.
**Important**: no publishing happens · no listing is created · no "pre-approval" chip appears.

### State C · First-level category expand-in-place

**Visual**: `<details>` disclosure · summary row is the department tile · open state reveals first-level category tiles beneath
**Behaviour**: native HTML `<details>/<summary>` · zero client JS · progressive enhancement matches `/manage/live` form convention
**Copy**: section eyebrow reads `department-name · tap to expand`

### State D · Search

**Visual**: `<input type="search">` at top of the picker · `min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm` matching the number-input shape at `/manage/live:198`
**Behaviour**: client-side filter · uses existing synonyms where known · matches on department name, category name, and subcategory name
**Copy**: placeholder `Search 30 departments · e.g. "watch", "phone", "sofa"`
**Important**: search results take visual priority over tiles when active · a found Watches match uses the enabled rail · a found Pending-review match still uses the neutral rail (match ≠ enablement)

### State E · Other / Request a different category

**Visual**: dashed amber rail · same shape as today · remains at the bottom of the list
**Behaviour**: identical to today's existing Request path · unchanged
**Copy**: unchanged

### State F · Keyboard / touch target compliance

- Every tile ≥ 44px tap height (matches `/manage/live` number input min-h-[44px])
- Search field ≥ 44px
- All focus states use the browser default outline · do not override

## 4 · Data source (interim)

### `src/lib/nex-native/catalogue/departments.ts` (NEW · interim)

```ts
// INTERIM shared category module · 2026-10-28
// -------------------------------------------------------------------
// Not a database-backed catalogue. Hardcoded from the owner-sealed
// 30-department taxonomy for A2-T2 use only. The eventual replacement
// is a Stage-B database-backed catalogue requiring its own doctrine
// + migration approval. Documented here so no reader mistakes this
// for the central source of truth.

export type Dept = { id: string; label: string; blurb: string; status: "enabled" | "pending_review"; categories: { id: string; label: string }[] };

export const DEPARTMENTS: readonly Dept[] = [
  { id: "jewellery_watches", label: "Jewellery & Watches",
    blurb: "Luxury, smart, fashion",
    status: "enabled",
    categories: [
      { id: "fine_jewellery", label: "Fine Jewellery" },
      { id: "fashion_jewellery", label: "Fashion Jewellery" },
      { id: "watches", label: "Watches" },
      { id: "jewellery_accessories", label: "Jewellery Accessories" },
      { id: "collectible_watches", label: "Collectible Watches" },
    ],
  },
  // ... 29 other depts, each with first-level categories only,
  //     status: "pending_review"
];
```

**Explicit limitations documented in the file header**:
- Not DB-backed
- Not deduped against `nex_business.business_category` (19-value CHECK, Migration 065)
- Owner has approved this as an interim consolidation only
- Replacement is Stage B scope requiring explicit founder sign-off

## 5 · What the picker will NOT do

- ❌ Create any `category_id` foreign key on `nex_watch_listing` or any other table
- ❌ Call any server action during the Pending-review request flow (file to console + toast only, until Stage B queue backend is authorised)
- ❌ Change the Watches tile's downstream behaviour (same `onChange` callback shape → same `_upload-client.tsx` wiring)
- ❌ Introduce a new DB table or migration
- ❌ Touch `/manage/live` · `/manage/products` · `/manage/shop` · `/manage/menu` · `/manage/services` · `/manage/accommodation`
- ❌ Change the Live-create → `/manage/watches/new` routing already in place
- ❌ Change the sealed universal keypad rule
- ❌ Add any Playwright test beyond what's needed to confirm the new picker renders · the existing test for Create tile → `/manage/watches/new` is already updated

## 6 · Dependencies on unresolved founder decisions

- 🔒 **13 Batch-1 blockers** (separate decision log) · none of them block A2-T2 because A2-T2 does not enable any Books/Office/Arts leaf for publication. The blockers resolve BEFORE those leaves move from Research complete → Enabled.
- 🔒 **Trolley duplicate** (`office.warehouse.trolleys` vs `office.material_handling.trolleys`) · same reasoning · does not block A2-T2
- 🔒 **Three UI micro-decisions in the token audit doc §11** (Enabled vs Pending-review mapping · search bar shape · subcategory disclosure primitive) · **these DO block A2-T2** · owner must confirm before I write code

## 7 · Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Theme-flip from dark-navy to light-neutral surprises the owner on preview | High | Low | Screenshot evidence + before/after side-by-side in the final verification report |
| 450-line hardcoded `departments.ts` becomes stale vs eventual DB catalogue | Medium | Low | Explicit "INTERIM" header + referenced by its honest name in doctrine |
| `<details>` native disclosure doesn't match the owner's expected animation | Medium | Low | Pure CSS fallback; no JS to review; owner can redirect to a scripted collapse if needed |
| Pending-review request path with no backend may feel incomplete | Low | Medium | Copy explicitly says "we'll review and get back to you" · toast confirms logging only |
| Hendra impersonation gate (just fixed) regressing | Low | High | Explicitly covered in test plan §9 |
| Keypad rule accidentally violated on search input | Low | High | Use `NexInput` for the search field (not raw `<input>`), per sealed universal keypad rule |

**Load-bearing**: the keypad rule risk. The audit shows `/manage/live` uses raw `<textarea>` / `<input>` because it is a merchant-admin surface that may legitimately pre-date the keypad seal. The owner's rule reads "every field that required text is active nex keypad." A2-T2's search bar MUST use `NexInput` even though the reference page doesn't · the seal supersedes the reference pattern.

## 8 · Test plan

Pre-change baseline capture:
- Playwright E2E `tests/e2e/live-library-tiles.spec.ts` passes (currently points at `/manage/watches/new` after Stage A3 wiring)
- `curl /nex-native/manage/watches/new` returns HTTP 200
- `curl /nex-native/dev/live-persona/hendra` returns HTTP 200
- No `[dev-impersonation] ... falling back to real session` warning in dev server log

Post-change verification:
- `npm run typecheck` filtered to touched files → zero new errors
- Playwright E2E `tests/e2e/live-library-tiles.spec.ts` passes (same spec, updated markers)
- `curl /nex-native/manage/watches/new` returns HTTP 200
- HTML markers present:
  - `data-nex-category-picker` on root
  - `data-nex-category-tile="jewellery_watches"` with `data-nex-category-tile-enabled="true"`
  - 29 other depts with `data-nex-category-tile-enabled="false"`
  - `data-nex-category-search` on the search input
  - `data-nex-category-other` on the Other tile
- Hendra end-to-end:
  - Open `/nex-native/dev/live-persona/hendra` → tap into any video → open library sheet → tap Create → lands on `/manage/watches/new` → sees the new picker → taps Watches → form proceeds unchanged
- Watches E2E regression:
  - Fill form (brand, model, movement, condition, price, description) → Save draft → `createWatchListingAction` returns ok → Publish → `grantWatchListingEntitlementMockAction` returns ok → router navigates to `/nex-native/watches/<id>`
- Pending-review regression:
  - Tap any non-Watches tile → disclosure opens → tap Request → toast appears → console log fires → no network call → no listing created

## 9 · Screenshot evidence plan

Four screenshots to attach to the final A2-T2 report:

1. **Before** · current dark-navy `_category-picker.tsx` on `/manage/watches/new`
2. **After · default** · new light-neutral picker with Watches tile selected (emerald rail)
3. **After · expanded dept** · a Pending-review dept opened via `<details>` showing first-level categories + Request CTA
4. **After · search active** · search field with "watch" typed showing filtered results including the Watches match

All screenshots at 390 × 844 phone frame (the sealed NEX viewport).

## 10 · Rollback plan

If A2-T2 regresses the Hendra flow or breaks Watches:
1. `git restore src/app/nex-native/manage/watches/new/_category-picker.tsx` → recovers the current dark-navy version
2. Delete `src/lib/nex-native/catalogue/departments.ts` → zero other consumers
3. Playwright spec was updated in Stage A3, not A2-T2 · no rollback needed there
4. Dev server HMR picks it up · no restart required

No DB rollback needed · no migrations in A2-T2.

## 11 · What founder must approve to unlock A2-T2 execution

1. **The three UI micro-decisions in token-audit §11** (Enabled vs Pending-review mapping · search bar shape · subcategory disclosure via `<details>`)
2. **The interim-TS-module naming** (`src/lib/nex-native/catalogue/departments.ts` · documented as INTERIM, not DB-backed)
3. **The Pending-review copy wording** (does not imply approval or publication)
4. **The light-neutral theme flip** (the picker visually changes from dark navy to `/manage/live`'s light palette)
5. **The keypad-rule treatment on the search field** (NexInput over raw input, overriding the reference pattern)

Say `approved · build A2-T2` after resolving the 5 items above, and I execute. Any of the 5 can be redirected individually without rewriting the plan.

---

_This plan was produced read-only. No files were edited. No code was written. The plan itself is the deliverable._
