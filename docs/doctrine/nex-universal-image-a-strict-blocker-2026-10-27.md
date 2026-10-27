# NEX Universal Image Doctrine · A-strict Implementation Blocker · 2026-10-27

> **Status: STOPPED per owner directive 2026-10-27.** No code change landed. All work reverted. All sealed guardrails intact.
>
> **Authority**: owner authorisation 2026-10-27 · "If A-strict cannot be implemented without expanding the authorised scope, stop and report the specific blocker."
>
> **Scope**: A-strict (sealed code-side `categoryFallbackLibrary.ts` only, Indonesia + food family, zero DB-library use).

## 1 · The blocker · in one line

**The sealed code-side library (`src/lib/nex/images/categoryFallbackLibrary.ts`) cannot load in the current fork because its underlying asset catalogue (`src/lib/nexapp/nexVisualAssets.ts`) is missing.**

## 2 · Measured verification

### 2.1 · The sealed library's required import

`src/lib/nex/images/categoryFallbackLibrary.ts:27`:
```ts
import { NEX_VISUAL_ASSETS } from "@/lib/nexapp/nexVisualAssets";
```

Every library entry (lines 59-64) calls `assetUrl("nva-*")` which reads from `NEX_VISUAL_ASSETS`. `UNIVERSAL_FALLBACK_URL` at line 49 does the same at module top level.

### 2.2 · File is missing in the current fork

Verified by filesystem checks:
- `test -f src/lib/nexapp/nexVisualAssets.ts` → missing
- `find src -path "*nexVisualAssets*"` → zero matches
- `grep -rln "export const NEX_VISUAL_ASSETS" src/` → zero matches
- All `nva-011` / `nva-019` / `nva-002` references in the current fork are ONLY in `categoryFallbackLibrary.ts` and in my (now-reverted) adapter · no definition anywhere

### 2.3 · The sealed test is already broken by the same cause

```bash
npx vitest run src/lib/nex/images/resolveDirectoryHero.test.ts
→ Error: Cannot find package '@/lib/nexapp/nexVisualAssets'
  at src/lib/nex/images/categoryFallbackLibrary.ts:27:1
```

The resolver cannot be imported. The sealed test has 0 tests passing in the current fork. This is a **pre-existing** state, not a regression I caused.

### 2.4 · Root cause (per `CLAUDE.md` nexapp fork boundary)

The current fork (2026-10-10 from `D:/trades`) explicitly left behind sibling products: *"Products that lived alongside NEX in the source monorepo (trade-off, hammerex, xrated-trades, thenetworkers, van-wrap, apprenticeships, homeowners, trade-center) were intentionally left behind."*

`src/lib/nexapp/nexVisualAssets.ts` (the 41-asset Philip-curated catalogue referenced in `categoryFallbackLibrary.ts:14-18`) was co-located with those sibling products in `D:/trades/src/lib/nexapp/` and was dropped by the fork extraction. The library header mentions it:
> `project_nex_universal_directory_image_doctrine_2026_08_22` (sealed · Philip-curated · *in D:/trades*)

The images themselves (the 41 transparent PNGs) do not exist in this repo's `public/` tree either.

## 3 · What this means for A-strict

A-strict depends on calling the sealed library. In the current fork:
- Importing the library throws at module-load time (missing `NEX_VISUAL_ASSETS` module).
- Even if the import could be resolved, `UNIVERSAL_FALLBACK_URL = assetUrl("nva-011")` would throw inside `assetUrl()` because the catalogue array is empty/undefined.
- Even if `assetUrl` short-circuited, the URL it returned would point at an image file that doesn't exist in this fork's `public/` directory.

**A-strict is not implementable without expanding scope** beyond what the owner authorised, because the "existing owner-authorised code-side category fallback" is not operationally present in this fork.

## 4 · What I will NOT do

- Create a stub `nexVisualAssets.ts` with invented image URLs. That would be fabrication (invents the Philip-curated catalogue), violating the sealed trust rule.
- Copy the catalogue from `D:/trades` without owner authorisation (crosses the fork boundary).
- Substitute DB-library URLs for the missing TS catalogue (A-wide, explicitly held).
- Call `categoryFallbackFor` with a hard-coded dummy URL (fabrication).
- Lower the trust rule to accept "any URL that renders" as the TS library's output.

## 5 · Changes reverted this turn

- Reverted · `src/lib/nex-native/local-directory-service.ts` (restored to HEAD · one-line `country` addition removed).
- Deleted · `src/lib/nex-native/directory/category-fallback-adapter.ts` (the A-strict helper I wrote before hitting the blocker).
- Deleted · `src/lib/nex-native/directory/__tests__/category-fallback-adapter.test.ts` (the regression tests).

Dirty-tree work in `landing-feed-service.ts` and `_landing-directory-view.tsx` **untouched** (preserved as before).

## 6 · Guard rails verified live post-revert

| Guard | State |
|---|---|
| Migration 202 columns | not present (0 email cols) |
| `nex.business_media` rows | 0 |
| `nex.business_image` approved rows | 0 (660 captured, all unapproved) |
| `NEX_EMAIL_BACKFILL_ENABLED` | unset |
| `source_registry.can_display` for 6 image-capable sources | all `false` |
| 913 `nex-media/imported/*` orphans | untouched |
| Letter-monogram remains the honest no-image fallback | unchanged |
| Nothing fabricated / nothing stock-as-business-photo | confirmed |

## 7 · Owner decision points newly surfaced

The A-strict blocker surfaces a decision the earlier reconciliation report did NOT make explicit:

### UID-B7 · Restore the NEX visual asset catalogue to this fork

The sealed Universal Image Doctrine (per Philip 2026-08-22 doctrine anchor) presumes `NEX_VISUAL_ASSETS` is available with 41 Philip-curated transparent PNG assets. In this fork it is not.

Options for the owner (none performed automatically):

- **UID-B7-OPT1** · **Port the file + its public/ assets from `D:/trades`.** Preserves the sealed doctrine 1:1. Requires owner confirmation that the catalogue lives at `D:/trades/src/lib/nexapp/nexVisualAssets.ts` + `/public/nex-visual-assets/*.png` (paths unverified from the current fork · owner-only check).
- **UID-B7-OPT2** · **Author a NEX-native replacement catalogue** · owner curates ~5 PNG assets covering just the food family for A-strict (`nva-011` grain bowl, `nva-019` grilled steak, `nva-002` cappuccino, `nva-016` ice cream, `nva-020` cheeseburger) plus a NEX-branded universal fallback. Satisfies the sealed scope without crossing the fork boundary.
- **UID-B7-OPT3** · **Hold A-strict indefinitely** · keep the letter-monogram placeholder on every Directory card. No image improvement until a different implementation path is authorised.

### UID-B8 · The sealed resolver's test is currently BROKEN in CI

Independent of the Directory wire-up, the fact that `resolveDirectoryHero.test.ts` cannot even import its subject means the sealed acceptance tests (Tests 1-7 of the Universal Image Doctrine) are **currently un-run** in this fork. If the test suite is expected to protect the sealed resolver, this is a trust gap. Owner may want this flagged for a separate fix regardless of the Directory wire-up decision.

## 8 · Companion documents

- `nex-universal-image-doctrine-reconciliation-2026-10-27.md` (the gap report that preceded this blocker · unchanged · commit `fff9e3a`)
- `src/lib/nex/images/categoryFallbackLibrary.ts` (sealed library · unchanged · its import is unresolved in this fork)
- `src/lib/nex/images/resolveDirectoryHero.ts` + `types.ts` + its test (sealed · unchanged)
- `CLAUDE.md` nexapp §"Fork boundary" + §"Fork hygiene" (explains why nexVisualAssets.ts was dropped)

## 9 · What this document does and does not

### DOES
- Record the specific blocker that stopped A-strict mid-implementation.
- Preserve every sealed guardrail unchanged.
- Flag UID-B7 (restore catalogue · 3 options) and UID-B8 (broken sealed test) as new owner decisions.
- Revert the three in-progress changes · adaptCanonical edit + the two new files · leaving the working tree exactly as it was before this task.

### DOES NOT
- Implement A-strict (blocked).
- Expand scope to A-wide (requires UID-B5 and the DB library authorisation).
- Approve any `business_image` row.
- Change migration 202, email backfill, source approvals, or any sealed guard.
- Modify Search, Explore, or any unrelated dirty-tree work.
- Deploy or push an image-render change.
