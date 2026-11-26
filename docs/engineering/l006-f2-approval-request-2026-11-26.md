# L-006 · F2 approval request · 2026-11-26

**Purpose.** Resolve the 5 `mobile-public-surfaces.spec.ts` failures per L-006 by surfacing the exact change set that crosses the §3 F2 hold in the 2026-11-25 strict-completion directive. Written for owner decision only; not for silent execution.

**Boundary.** This is **not** an attempt to work around Rule 7. Nothing in this document gets applied until the owner replies with one of the authorisation phrases at the bottom.

---

## Evidence summary

- 8 live callers still reference `/nex-native/welcome` as a destination (`src/app/nex-native/directory/_landing-directory-view.tsx:366`, `src/app/nex-native/directory/landing/page.tsx:188`, `src/app/nex-native/chat-themes-library/_marketplace-side-drawer.tsx:67`, `src/app/nex-native/manage/shop/start/page.tsx:537`, `src/app/nex-native/settings/page.tsx:473`, `src/app/nex-native/settings/profile/edit/_actions.ts:191`, `src/app/nex-native/welcome/shop-offer/page.tsx:162`, `src/lib/nex-native/routing/route-registry.ts:282`).
- `src/app/nex-native/welcome/page.tsx` was deleted 2026-11-06 (commit `d8f16c32`). Those callers currently land on the Next.js framework 404.
- `/nex-native/create-account` runtime emitters have **already been migrated** to `/sign-in` in the F2 work completed in prior cycles (12 files carry `Cycle-14 F2` comments; only a single test now mentions the retired path in a negative-assertion: `src/lib/nex-native/intelligence/__tests__/product-knowledge.test.ts:71`).
- `/nex-native/chat/first-visit*` was sealed-deleted 2026-11-06 (commit `28f79500`, owner directive "fully deleted from repo and nex app for ever").
- `tests/e2e/mobile-public-surfaces.spec.ts` still contains:
  1. Line 38-56 · asserts `/nex-native/welcome` returns 200 (**fails · 404**).
  2. Line 58-69 · asserts a `/nex-native/create-account` CTA on `/welcome` (**fails · page missing + link retired**).
  3. Line 87-97 · asserts `/nex-native/create-account` returns 200 (**fails · route retired**).
  4. Line 103-132 · three tests asserting `/nex-native/chat/first-visit*` redirect to `/welcome` (**fails · routes deleted**).
  5. Line 139-153 · asserts a `/create-account` CTA has a 24 px+ tap target (**fails · same cause as 2**).

Cannot resolve without crossing the F2 hold on `/welcome/page.tsx` restoration **AND** the test-spec update for the retired first-visit + create-account routes.

---

## Change set requiring approval

### Change 1 — Restore `src/app/nex-native/welcome/page.tsx`

Minimal honest reconstruction. Server Component, unauthenticated. Two CTAs that match the current auth entry contract (both non-404):

- Primary · **"Create free account"** → `/nex-native/sign-in?mode=signup`
- Secondary · **"Sign in"** → `/nex-native/sign-in`

Rendered inside the existing `src/app/nex-native/_welcome-shell`-adjacent layout (same visual family as `/welcome/account-active`, `/welcome/shop-active`, `/welcome/shop-offer`). Not a copy of the pre-2026-11-06 welcome.

The alternative — repoint the 8 live callers at `/sign-in` directly — crosses more surfaces and loses the branded first-time landing. Owner may choose that path if preferred (see Option B below).

### Change 2 — `tests/e2e/mobile-public-surfaces.spec.ts` migration

Two options; owner picks:

**Option A (migrate + prune, default proposal).** Keep the two welcome tests (now passing against the restored page), migrate the CTA locators, DELETE the four tests whose target routes no longer exist.

- Line 65 · `a[href*="/nex-native/create-account"]` → `a[href*="/nex-native/sign-in?mode=signup"]`
- Line 144 · same migration
- Line 87-97 · DELETE (`/create-account` sealed-retired)
- Line 103-132 · DELETE three first-visit tests (routes sealed-deleted 2026-11-06)

Result: 4 passing tests (welcome 200, welcome CTAs, sign-in 200, welcome tap target); 4 removed with clear commit message citing the two owner-sealed deletion decisions.

**Option B (hold-and-fail).** Reject the welcome restoration. Mark all 5 failing tests `test.fixme` with the sealed-deletion citations; the suite stays red-free but the first-user journey remains a 404 for anyone following the 8 live callers above.

### Change 3 — `src/lib/nex-native/routing/route-registry.ts` consistency

Line 282 declares `redirectsFrom: ["/nex-native/welcome"]` on the `shell_welcome` entry whose `filePath` points at the deleted `src/app/nex-native/welcome/page.tsx`. If Change 1 is approved, this entry becomes accurate again (no edit needed). If Option B is chosen, the entry should be updated to point at `/sign-in` or marked retired to prevent sitemap/registry drift.

---

## Impact if nothing is done

- `/nex-native/welcome` continues to return the framework 404 for the 8 live callers (home-icon flow, OAuth defaults, logout sweep, shop-offer continuation, profile-edit redirect). This is observable user-facing breakage that the mobile-public regression correctly catches.
- L-006 stays BLOCKED-AT-APPROVAL. L-012 full regression cannot reach 0-failures while mobile-public is red.
- Rule 10 (one source of truth): the ledger entry and the route registry continue to disagree.

---

## Requested owner authorisation phrases

Pick exactly one; silence means no action:

- **`APPROVE L-006 OPTION A`** — restore `/welcome/page.tsx` with the two CTAs above + migrate the test spec per Option A. Nothing else touched in-scope.
- **`APPROVE L-006 OPTION B`** — do **not** restore the page; accept the 5 failures as `test.fixme` and update the route registry accordingly. User-facing 404s on the 8 callers remain open; must be tracked as a separate deliverable.
- **`APPROVE L-006 OPTION A WITH ALTERNATE CTAs`** — approve Option A but overwrite the primary/secondary CTA hrefs or labels. Specify replacements in-line.
- **`HOLD L-006`** — no action; stays BLOCKED-AT-APPROVAL in the ledger; adjacent engineering continues.

No default and no retry. If the response is ambiguous I will re-ask rather than infer.

---

## Scope guarantees

- No other files edited.
- No commit, no push.
- No production migration or deployment.
- No change to the signed one-time-gate (L-008 VERIFIED stays untouched).
- No change to the install state machine or Emergency Help validator (L-007 VERIFIED stays untouched).
- No change to any `/sign-in` logic; the restored welcome only *links* to `/sign-in` and `/sign-in?mode=signup`.

---

**Prepared** 2026-11-26 · follows CLAUDE.md Rule 3 (identify blocker + present approval request) + Rule 12 (owner makes product/approval decisions).
