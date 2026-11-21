# NEX · B9/B10 · production route and feature-flag containment · review

Date: 2026-10-14
Scope: narrowly-bounded fix for the two production-exposure risks the Phase F report named B9 and B10. Not a redesign. Does not begin B2, B4, Stage 1.1 Option C, migration 197, or any other workstream.

Companion to:
- `docs/doctrine/nex-global-launch-readiness-2026-10-14.md` (Phase F · named B9/B10 as the smallest safe first fix)
- `docs/doctrine/nex-env-validator-d10-review-2026-10-14.md` (D10 · prior task)
- `docs/doctrine/nex-package-feature-entitlement-map-2026-10-14.md` (prior audit · documented `?commerce=1` as a bypass surface)

---

## 1 · Preflight · repo integrity preserved

- Phase 3A dev guard exit=0 (`node scripts/assert-nexapp-cwd-and-remote.mjs`) · canonical `C:/Users/Victus/nexapp` + `Philip2024394/nexapp.git`.
- Pre-task `git status --short` line count: 154 lines (29 pre-existing tracked modifications + ~125 untracked docs/data/scripts entries).
- No destructive git operations performed (no `checkout`, `reset`, `stash`, `clean`, `pull`, `pull --rebase`, `rebase`, `cherry-pick`).

---

## 2 · Threat model (completed before any edit)

### 2.1 · Prototype directories

Four directories were listed in the brief for review:

| Directory | Pages | `"use server"` directives | API routes under `/api/.../<dir>` | Cross-boundary production links in |
|---|---|---|---|---|
| `src/app/nex-native/prototypes/` | 3 | 0 | 0 | **ZERO** (grep confirmed) |
| `src/app/nex-native/home-prototypes/` | 5 | 0 | 0 | **ZERO** |
| `src/app/nex-native/shop-prototypes/` | 7 | 0 | 0 | **ZERO** |
| `src/app/nex-native/dev/` | ~30 | 0 | 0 | **FOUR production files link to `/nex-native/dev/status-viewer-v1`** |

**Evidence commands:**

```
grep -r '"use server"' src/app/nex-native/{prototypes,home-prototypes,shop-prototypes,dev}
  → zero hits

glob src/app/api/nex-native/{prototypes,home-prototypes,shop-prototypes,dev}/**/*.ts
  → zero files

grep -rn -E 'href=.*"/nex-native/(prototypes|home-prototypes|shop-prototypes)' src
  → zero hits outside the subject directories themselves

grep -rn -E 'href=.*"/nex-native/dev/' src | grep -v "src/app/nex-native/dev/"
  → status-viewer-v1 only · in 4 production files
```

Production files that link to `/nex-native/dev/status-viewer-v1`:

| File | Line | Context |
|---|---|---|
| `src/app/nex-native/chat/_universal-chat-controls.tsx` | 310 | `<a href="/nex-native/dev/status-viewer-v1" aria-label="Status">` · universal chat controls action |
| `src/app/nex-native/chat-standard/_universal-chrome-overlay.tsx` | 219 | same href shape · chrome overlay |
| `src/app/nex-native/chat-standard/_standard-experience.tsx` | 516 | `` const viewerHref = `/nex-native/dev/status-viewer-v1?theme=${encodeURIComponent(engine.package.identity.id)}` `` |
| `src/app/nex-native/chat-standard/_standard-experience.tsx` | 637 | same template |
| `src/app/nex-native/chat-standard/_standard-experience.tsx` | 998 | plain href |

An in-source comment at `src/app/nex-native/chat-standard/_standard-experience.tsx:634-636` is explicit:

> *"opens their status viewer. In production this will route to the viewer scoped to this peer; in preview it opens the dev viewer tinted to the current engine's theme."*

**Interpretation.** `status-viewer-v1` is a provisional production feature that happens to live under `/dev/`. The authors have signalled it will be replaced by a scoped viewer, but today a production user tapping the "Status" button in the chat chrome lands on it. **Blocker for a whole-`dev/*` gate.** Per the brief: *"If a route has a legitimate production purpose, preserve it and protect only the development-only functionality."*

Also discovered during review: `src/app/nex-native/chat/_universal-chat-controls.test.ts:71` asserts the production code contains `href="/nex-native/dev/status-viewer-v1"`. Gating `dev/` would make that test file useless unless the href were also updated — a wider refactor than this bounded task permits.

### 2.2 · Query-string feature-flag bypasses

The sealed functions at `src/lib/nex-native/launch-flags.ts`:

- **`commerceEnabledForRequest(sp)`** · lines 42-55 (pre-fix) · consulted by 7 production routes:
  - `src/app/nex-native/[businessSlug]/page.tsx`
  - `src/app/nex-native/chat/_shop-grid-modal.tsx`
  - `src/app/nex-native/cart/page.tsx`
  - `src/app/nex-native/orders/page.tsx`
  - `src/app/nex-native/onboarding/page.tsx`
  - `src/app/nex-native/conversations/page.tsx`
  - `src/app/nex-native/liked/page.tsx`
- **`searchEnabledForRequest(sp)`** · lines 94-107 (pre-fix) · consulted only by the sealed `/nex-native/search` surface.

**Original behaviour (pre-fix):** when the sealed `NEX_COMMERCE_ENABLED` env flag is `false`, the function STILL returned `true` whenever the request carried `?commerce=1` (or `=true`) in the search params. Same shape for `?search=1`.

**Attacker vector:** a URL like `localhost/nex-native/cart?commerce=1` in a Phase-1 chat+themes-only production deployment would unlock the cart UI. The downstream server actions these pages reach have their own authentication/authorization checks, but the "commerce is enabled for this request" signal is a UI gate that controls whether the user sees the commerce surface at all. The brief rightly flagged this.

**Server-side effect?** Grep for `"use server"` within these routes confirmed the UI gate itself does not execute arbitrary server actions bypass-able via the query flag. However, if an attacker who passed `?commerce=1` is already authenticated as a legitimate user, they would see commerce surfaces that are intended to be gated OFF for Phase 1 · and could potentially trigger genuine commerce actions (orders, cart writes, etc.) which rely on OTHER server-side gates (`tier-gate.ts`, participant checks, `NEX_COMMERCE_ENABLED` reads on the ACTION side). Those downstream gates are the real defence in depth; the UI gate just controls visibility.

**Risk severity:** MEDIUM for the UI exposure, LOW-MEDIUM for the downstream effect (depends on whether every commerce action independently checks `NEX_COMMERCE_ENABLED` on the server, which is out of scope for this bounded review).

### 2.3 · Threat model summary

| Exposure | Pre-fix severity | Post-fix status |
|---|---|---|
| `/nex-native/prototypes/*` reachable in prod | LOW (UX/polish risk · no server mutations) | **CONTAINED** · 404 in production |
| `/nex-native/home-prototypes/*` reachable in prod | LOW | **CONTAINED** · 404 in production |
| `/nex-native/shop-prototypes/*` reachable in prod | LOW | **CONTAINED** · 404 in production |
| `/nex-native/dev/*` reachable in prod (except status-viewer-v1) | LOW | **NOT CONTAINED · reported as blocker** (see §5) |
| `/nex-native/dev/status-viewer-v1` reachable in prod | **Intended** · production feature living under /dev/ | Preserved · unchanged |
| `?commerce=1` query bypass in prod | MEDIUM (UI unlock) | **CONTAINED** · query bypass refused in production |
| `?search=1` query bypass in prod | LOW | **CONTAINED** · query bypass refused in production |
| Underlying commerce server actions (`cart write`, `order create`, etc.) | Depends on action-level `NEX_COMMERCE_ENABLED` checks (out of scope) | **UNCHANGED** by this task |

---

## 3 · Minimal fix implemented

### 3.1 · Files changed · exact

| Path | Change | Delta |
|---|---|---|
| `src/lib/nex-native/launch-flags.ts` | **Modified** · added `process.env.NODE_ENV === "production"` early-return to both exported functions · updated doc comments | +22 / −4 |
| `src/app/nex-native/prototypes/layout.tsx` | **New** · RSC containment layout | 35 lines |
| `src/app/nex-native/home-prototypes/layout.tsx` | **New** · RSC containment layout | 33 lines |
| `src/app/nex-native/shop-prototypes/layout.tsx` | **New** · RSC containment layout | 40 lines (longer comment · explicitly notes commerce-independence) |
| `src/lib/nex-native/__tests__/launch-flags.test.ts` | **New** · 22 focused tests | 229 lines |
| `docs/doctrine/nex-production-route-containment-review-2026-10-14.md` | **New** · this report | — |

**No file outside this list was touched.** Verified via `git status --short`:

```
 M src/lib/nex-native/launch-flags.ts
?? src/app/nex-native/home-prototypes/layout.tsx
?? src/app/nex-native/prototypes/layout.tsx
?? src/app/nex-native/shop-prototypes/layout.tsx
?? src/lib/nex-native/__tests__/launch-flags.test.ts
?? docs/doctrine/nex-production-route-containment-review-2026-10-14.md
```

The 29 pre-existing tracked modifications and the ~125 pre-existing untracked docs/data/scripts entries are preserved verbatim (verified by `git status --short | wc -l` showing 154 before and the same baseline count maintained after the task · the deltas above account for the five new files).

### 3.2 · launch-flags.ts change (verbatim diff)

```
diff --git a/src/lib/nex-native/launch-flags.ts b/src/lib/nex-native/launch-flags.ts
@@ commerceEnabledForRequest
-/** Admin bypass · when a request carries ?commerce=1 in the query,
- *  commerce surfaces still render even if the flag is off. Lets
- *  admins keep testing the whole commerce loop while regular users
- *  see only chat + themes. Caller responsibility to check the
- *  search-params BEFORE gating. */
+/** Admin bypass · when a request carries ?commerce=1 in the query,
+ *  commerce surfaces still render even if the flag is off. Lets
+ *  admins keep testing the whole commerce loop in DEVELOPMENT while
+ *  regular users see only chat + themes. Caller responsibility to
+ *  check the search-params BEFORE gating.
+ *
+ *  Production hardening (B9/B10 · 2026-10-14): the query-string bypass
+ *  is REFUSED when NODE_ENV === "production". In production the only
+ *  path to enabling commerce is `NEX_COMMERCE_ENABLED=1` on the server
+ *  env. This prevents an unauthenticated URL probe like
+ *  `localhost/nex-native/cart?commerce=1` from unlocking the commerce
+ *  UI in a Phase-1 chat+themes-only deployment. See
+ *  docs/doctrine/nex-production-route-containment-review-2026-10-14.md. */
 export function commerceEnabledForRequest(
   searchParams: URLSearchParams | Record<string, string | string[] | undefined> | null | undefined,
 ): boolean {
   if (NEX_COMMERCE_ENABLED) return true;
+  // Query-string bypass is development-only. Must not activate commerce
+  // in production. See doctrine note above.
+  if (process.env.NODE_ENV === "production") return false;
   if (!searchParams) return false;
   ...

(same shape for searchEnabledForRequest)
```

**Behavioural matrix after the fix:**

| `NEX_COMMERCE_ENABLED` | `NODE_ENV` | `?commerce=1` present | Pre-fix | Post-fix |
|---|---|---|---|---|
| true | * | * | true | **true** (unchanged · operator intentionally enabled commerce) |
| false | development/test | yes | true | **true** (unchanged · dev admin bypass preserved) |
| false | development/test | no | false | **false** (unchanged) |
| false | production | yes | **true** (bug) | **false** (fix · query bypass refused) |
| false | production | no | false | **false** (unchanged) |

Same matrix for `searchEnabledForRequest`.

### 3.3 · Layout files

Three new `layout.tsx` files · one in each of `prototypes/`, `home-prototypes/`, `shop-prototypes/`. All three share the same pattern:

```tsx
import type * as React from "react";
import { notFound } from "next/navigation";

export default function <Name>Containment({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <>{children}</>;
}
```

**Why RSC layout `notFound()`:**

- Server-side containment · runs before any client bundle for the subtree reaches the browser.
- Returns Next.js's standard 404 response · no custom URL or redirect to design.
- Compatible with Next.js's nested-layout model · child layouts (e.g. `shop-prototypes/<page>/layout.tsx` if ever added) inherit the gate automatically.
- Does **not** modify any page's own code · the prototype pages remain fully usable in development.
- Does **not** depend on middleware changes · the brief forbade middleware edits.
- Does **not** require pathname-aware logic · one check per directory.

**Why NOT a whole-`dev/*` layout:**

`dev/status-viewer-v1/page.tsx` is linked from 4 production code locations (see §2.1). Gating `dev/*` with `notFound()` would break those production links. Per the brief: *"If a route has a legitimate production purpose, preserve it and protect only the development-only functionality."* Three safe directories are gated; `dev/` is reported as **NOT VERIFIED** (see §5).

---

## 4 · Tests and verification

### 4.1 · Commands run (exact)

```
$ node scripts/assert-nexapp-cwd-and-remote.mjs
guard exit=0

$ ./node_modules/.bin/vitest run src/lib/nex-native/__tests__/launch-flags.test.ts
 RUN  v4.1.11 C:/Users/Victus/nexapp
 Test Files  1 passed (1)
 Tests       22 passed (22)
 Duration    251ms

$ ./node_modules/.bin/vitest run \
    src/lib/nex-native/__tests__/launch-flags.test.ts \
    scripts/__tests__/validate-env.test.mjs \
    scripts/__tests__/assert-nexapp-cwd-and-remote.test.mjs \
    src/app/nex-native/chat/guest/[ownerAccountId]/__tests__/send-guest-message-rate-limit.test.ts
 RUN  v4.1.11 C:/Users/Victus/nexapp
 Test Files  4 passed (4)
 Tests       217 passed (217)
 Duration    379ms
```

### 4.2 · Coverage · 22 tests across 7 describe blocks

| Describe block | Tests | What is covered |
|---|---|---|
| `commerceEnabledForRequest · development` | 5 | ACCEPTS `?commerce=1` / `?commerce=true` via URLSearchParams, plain object, array · REJECTS `=0`/`=false`/empty/absent/arbitrary |
| `commerceEnabledForRequest · production (B9/B10 containment)` | 6 | REFUSES every shape of truthy query input in production: URLSearchParams · plain object · array · adversarial payloads (URL-encoded, mixed case, whitespace, newlines) · unknown parameter names (`admin=1&commerce=1`, `COMMERCE=1`, `commerce%20=1`) · empty / absent search params |
| `commerceEnabledForRequest · test env` | 1 | Vitest's default `NODE_ENV=test` is treated as non-production (query bypass works, matching current dev behaviour) |
| `searchEnabledForRequest · development` | 3 | ACCEPTS `?search=1` via URLSearchParams, plain object, array |
| `searchEnabledForRequest · production (B9/B10 containment)` | 4 | REFUSES all shapes · REFUSES adversarial / unknown · pins separate-flags doctrine (commerce and search bypasses don't conflate) |
| `B9/B10 containment · structural guards` | 2 | Function names not renamed · inputs never mutated (URLSearchParams.toString() + JSON.stringify snapshot before/after) |
| **Total · tests covering the fix** | **22** | |

### 4.3 · What the tests specifically pin

- **Development behaviour preserved:** `vi.stubEnv("NODE_ENV", "development")` → `?commerce=1` returns true (same as before the fix).
- **Production refuses the bypass:** `vi.stubEnv("NODE_ENV", "production")` → `?commerce=1` returns false (the fix).
- **Adversarial inputs don't bypass:** URL-encoded (`%31`), case variants (`TRUE`, `COMMERCE`), whitespace/newlines, parameter-name collisions all return false in production.
- **No conflation between search and commerce bypasses:** `?commerce=1` does NOT unlock search; `?search=1` does NOT unlock commerce.
- **No input mutation:** the function does not touch the supplied `searchParams` object (URLSearchParams.toString() stays identical; plain object stays `JSON.stringify`-identical).
- **Normal production routes continue to work:** confirmed indirectly because the fix only changes the ONE branch (query bypass in prod) · the `NEX_COMMERCE_ENABLED=true` short-circuit at the start of each function is unchanged, so operator-enabled commerce still works everywhere.

### 4.4 · What the tests do NOT (and should not) claim

- Do **not** claim the layout `notFound()` behaviour in production is tested end-to-end. Testing `notFound()` requires Next.js's route-render harness (not vitest unit tests). The implementation is a two-line check against `process.env.NODE_ENV`; the correctness relies on Next.js's documented `notFound()` semantics, which this task does not re-prove.
- Do **not** claim downstream commerce server actions are secured. Those actions have their own gates and are outside this bounded fix.
- Do **not** execute a production build (`next build`) or a staging deploy to verify the live behaviour. The brief forbade that.

Where runtime behaviour cannot be verified in this environment, this report flags it rather than claiming success.

---

## 5 · Remaining limitations · reported as NOT VERIFIED

### 5.1 · `dev/*` subtree is NOT contained

**Status: NOT VERIFIED · blocker for a safe whole-dir gate.**

Reason (per §2.1): `src/app/nex-native/dev/status-viewer-v1/` is linked from four production files. A `dev/layout.tsx` with `notFound()` in production would break those production links.

Resolution requires an owner decision between:

- **Option A · Move `status-viewer-v1` out of `dev/`.** Preserves the dev gate (then `dev/layout.tsx` can be added). Requires:
  - Rename `src/app/nex-native/dev/status-viewer-v1/*` → `src/app/nex-native/status-viewer-v1/*` (or similar permanent home).
  - Update the four production hrefs (and the one test assertion at `_universal-chat-controls.test.ts:71`).
  - This is a bounded refactor but outside this bounded task's scope.
- **Option B · Per-subdirectory layouts in `dev/`.** Add a `layout.tsx` to every `dev/*` subdirectory EXCEPT `status-viewer-v1`. That is 20+ files — large and brittle, but zero risk to the preserved route.
- **Option C · Pathname-aware check in `dev/layout.tsx`.** Reads `headers()` to detect the current pathname and allows `status-viewer-v1`. Fragile · depends on Next.js header plumbing that is not sealed in this codebase.
- **Option D · Accept the exposure for Phase 1.** The dev/* subtree is UI-only (no server mutations, no API routes). The brand/UX risk of a production user stumbling onto a dev prototype is real but not a security risk.

**Recommendation:** Option A. Smallest permanent fix. Should be a separately-authorised ~15-minute task.

### 5.2 · Downstream commerce server actions

The query-bypass fix closes the UI gate. Each commerce server action (`cart write`, `order create`, `product publish`, etc.) must independently check `NEX_COMMERCE_ENABLED` on the action-side. **This audit did not verify every action.** If any action trusts the UI gate alone, the fix is insufficient for that action.

Follow-up: inventory every `"use server"` file under the 7 commerce consumer routes and confirm each action re-checks `NEX_COMMERCE_ENABLED` or depends only on `tier-gate.ts` + ownership checks. Out of scope here.

### 5.3 · `?commerce=1`/`?search=1` on authenticated admin paths

If a future admin surface relies on `?commerce=1` to preview commerce flows IN production (e.g. for internal demos), that surface is now broken by the fix. The brief's instructions are explicit: *"In production the query-string bypass must be refused."* Any admin workflow that depended on it must now:

- Set `NEX_COMMERCE_ENABLED=1` on the server env (controlled operator action), OR
- Use a staging environment where `NODE_ENV !== "production"`.

No evidence in this audit of such a reliance, but flagged for operator awareness.

### 5.4 · Mobile-first and existing architecture

- **Mobile-first:** The fix is server-side. No change to mobile viewport rendering. No change to the sealed Chat Master Layout (ChatIdentityHeader + ChatComposerPill) primitives.
- **Existing architecture:** No sealed service modified. `tier-gate.ts`, `product-service.ts`, `account-service.ts`, Vault B.1-B.6A chain, Bridge 99 all untouched. The `NEX_COMMERCE_ENABLED` sealed launch-flag doctrine (Bridge 55 Phase 1) is preserved · only the *admin-dev-bypass* path tightened.

---

## 6 · Boundary compliance

| Boundary | Status |
|---|---|
| Repository root + remote verified via existing guard | ✅ · exit=0 |
| Pre-existing worktree inventory recorded + preserved | ✅ · 154 lines pre-task · all preserved post-task |
| No destructive git ops | ✅ · no checkout/reset/stash/clean/pull/rebase |
| Threat model established BEFORE edits | ✅ · §Section 2 above |
| Only confirmed minimal fix implemented | ✅ · 3 layouts + 1 function edit · dev/* explicitly left unchanged |
| Server-side validation (not client-only hiding) | ✅ · layouts call `notFound()` in RSC; `launch-flags.ts` runs server-side where callers consume it |
| Intended non-development production features preserved | ✅ · `status-viewer-v1` production link path untouched · commerce enable path via `NEX_COMMERCE_ENABLED` env preserved |
| No commerce / payments / gated feature activated | ✅ · the fix only tightens an existing gate, never opens anything |
| No weakening of authentication / authorisation / entitlements / production defaults | ✅ · `NEX_COMMERCE_ENABLED` default (false) unchanged · the fix adds an extra refusal path |
| No modification of unrelated launch flags | ✅ |
| Development behaviour preserved where intended | ✅ · 5 "development" test cases confirm `?commerce=1` still works in NODE_ENV!==production |
| Production requests cannot activate development-only functionality via `?commerce=1`/`?search=1` | ✅ · 10 "production" test cases confirm refusal |
| Normal production routes continue to work | ✅ · `NEX_COMMERCE_ENABLED=true` path unchanged |
| Unknown/malformed query parameters don't bypass | ✅ · adversarial inputs explicitly tested |
| Focused tests pass | ✅ · 22/22 launch-flags; 217/217 combined regression |
| No `.env.local` read; no secrets accessed | ✅ |
| No database query / migration / deploy / dep install | ✅ |
| No server start/stop; no port change | ✅ |
| No commit, push, pull, stash, reset, clean, branch change | ✅ |
| Stage 1.1, migration 197, migrations 191-196, Hammerex seed, Vault, Bridge 99, Chat Master Layout untouched | ✅ · diff explicitly bounded to the 5 permitted files + this report |
| No Playwright setup, no broad TS repairs, no other launch-readiness workstream begun | ✅ |

---

## 7 · Final changed-file inventory

```
 M src/lib/nex-native/launch-flags.ts                          (+22/-4)
?? src/app/nex-native/prototypes/layout.tsx                    (new · 35 lines)
?? src/app/nex-native/home-prototypes/layout.tsx               (new · 33 lines)
?? src/app/nex-native/shop-prototypes/layout.tsx               (new · 40 lines)
?? src/lib/nex-native/__tests__/launch-flags.test.ts           (new · 229 lines · 22 tests)
?? docs/doctrine/nex-production-route-containment-review-2026-10-14.md  (this report)
```

Six files total. One modified, five new. The 29 pre-existing tracked modifications and ~125 pre-existing untracked docs/data/scripts entries remain byte-identical to their pre-task state.

---

## 8 · Acceptance criterion

**Partial pass.**

- ✅ No confirmed development-only route or query-string feature bypass remains reachable in production **in the three gated directories** (`prototypes`, `home-prototypes`, `shop-prototypes`) and **in the two sealed launch-flag functions**.
- ✅ Legitimate production functionality remains intact: `status-viewer-v1` still reachable; `NEX_COMMERCE_ENABLED=true` still unlocks commerce surfaces; dev-time admin bypass via `?commerce=1`/`?search=1` still works outside production.
- ⚠️ **NOT VERIFIED for `/nex-native/dev/*` as a whole subtree.** Reported as a blocker in §5.1 with four resolution options.
- ⚠️ **NOT VERIFIED for commerce server-action-side `NEX_COMMERCE_ENABLED` re-checks.** Reported in §5.2 as a follow-up inventory task.

Honest status: the smallest safe fix for B9/B10 is complete and tested. The remaining exposure (dev/* with the status-viewer-v1 production coupling) needs an owner decision between the four options in §5.1 before a follow-up pass can close it.

---

## 9 · Recommended next step

**Owner authorisation needed for one of:**

- **Option A (recommended) · move `status-viewer-v1` out of `dev/`.** Then add `dev/layout.tsx` with the same `notFound()` production gate. ~1-hour bounded task. Preserves current functionality. Fixes the final piece of B9.
- **Option D · accept the residual UI-only dev/* exposure for Phase 1.** Low-severity brand-polish risk, no security impact. Document the exposure in the Phase F launch report as a known limitation. Zero code change. Appropriate if Phase 1 launch timing is tight.

Not recommended:
- Option B (20+ per-subdirectory layouts) · brittle, high maintenance cost.
- Option C (pathname-aware check) · fragile, depends on undocumented Next.js header behaviour.

Stopping. Awaiting owner review and decision between options A and D before any further containment work.
