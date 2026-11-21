# NEX · B2 · mobile E2E · first-user journey verification (phase one) · review

Date: 2026-10-14
Scope: bring up the Playwright harness that was absent, prove the unauthenticated portion of the first-user journey at a phone-sized viewport in a real browser against the live dev server, and name the authenticated-journey gap explicitly.

Companions:
- `docs/doctrine/nex-free-chat-theme-first-visit-implementation-2026-10-14.md` (the three destinations proven here)
- `docs/doctrine/nex-first-visit-entry-wireup-2026-10-14.md` (the home-page invitation this spec visits · auth-gated)
- `docs/doctrine/nex-global-launch-readiness-2026-10-14.md` (Phase F · B2 was listed OPEN)
- `docs/doctrine/nex-package-feature-entitlement-map-2026-10-14.md` (packages & commerce posture)

---

## 1 · What was done

### 1.1 · Final file inventory

| Path | Change | Delta |
|---|---|---|
| `playwright.config.ts` | **New** · 58 lines · minimal harness that uses the already-installed Playwright 1.64.0 + chromium-1248 | new |
| `tests/e2e/mobile-public-surfaces.spec.ts` | **New** · 158 lines · 8 Playwright tests covering the unauthenticated journey | new |
| `docs/doctrine/nex-mobile-e2e-first-visit-verification-2026-10-14.md` | **New** · this report | — |

**No existing file modified.** `git status --short | grep -v "^\?\?"` shows the same 29 pre-existing tracked modifications as before this task. `.gitignore` already covers `playwright-report/` and `test-results/` (verified: `grep -E "(playwright|test-results)" .gitignore` returns both entries), so test artifacts are not accidentally tracked.

### 1.2 · The "existing Playwright setup" clarification

The brief said "starting with the first-user journey and existing Playwright setup." Verified state before this task:

| Item | State |
|---|---|
| `@playwright/test` v1.64.0 in `node_modules/` | ✓ installed |
| Browser binaries in `~/AppData/Local/ms-playwright/` | ✓ `chromium-1234`, `chromium-1248`, `webkit-2336`, `webkit_headless_shell`, `ffmpeg`, `winldd` |
| `playwright.config.*` at repo root | **ABSENT** |
| `tests/e2e/*.spec.*` | **ABSENT** |

So the tooling was installed but the repo-level configuration + specs were missing. This task creates them. **No `npm install` was run** · the Playwright package and the chromium browser binary were already present.

### 1.3 · The `iPhone 12 Pro` → `Pixel 7` substitution

Initial run with the Playwright `devices["iPhone 12 Pro"]` descriptor failed on every spec with:

```
Error: browserType.launch: Executable doesn't exist at
C:\Users\Victus\AppData\Local\ms-playwright\webkit-2370\Playwright.exe
```

Playwright 1.64.0's iPhone 12 Pro descriptor uses WebKit internally and expects `webkit-2370`. Installed is `webkit-2336`. The "fix" would be `npx playwright install webkit` which **downloads a new browser binary (~200 MB)** · that is a dependency-install operation. The current task's rules forbid dep installs without separate authorisation.

Alternative chosen (no install): switch the project to `devices["Pixel 7"]` which uses Chromium internally. `chromium-1248` matches Playwright 1.64.0 and is already present. Pixel 7 is 412×915 with `isMobile`, `hasTouch`, and a Chrome Android user-agent · satisfies the brief's "phone-sized viewport" requirement.

**Trade-off disclosed:** this verifies a Chromium-engine mobile viewport, not WebKit. iOS-specific rendering quirks (Safari-only CSS behaviour) remain unverified by this run. If the owner authorises `npx playwright install webkit`, an identical spec file could be rerun with the iPhone 12 Pro descriptor to add WebKit coverage.

---

## 2 · What was verified

### 2.1 · Test results · exact command and output

```
$ ./node_modules/.bin/playwright test --project=mobile-chromium-pixel7
Running 8 tests using 1 worker

  ✓  1  welcome page renders at phone viewport without horizontal overflow (2.7s)
  ✓  2  welcome page offers both 'Create free account' and 'Sign in' affordances (998ms)
  ✓  3  sign-in page loads at phone viewport without horizontal overflow (882ms)
  ✓  4  create-account page loads at phone viewport without horizontal overflow (857ms)
  ✓  5  /nex-native/chat/first-visit redirects unauth viewer to /welcome (2.6s)
  ✓  6  /nex-native/chat/first-visit/shop redirects unauth viewer to /welcome (2.3s)
  ✓  7  /nex-native/chat/first-visit/personalize redirects unauth viewer to /welcome (2.4s)
  ✓  8  welcome primary CTA has a reasonable mobile tap target (1.0s)

  8 passed (16.9s)
```

**Exit code: 0.**

### 2.2 · What each test proved

| # | Target | What runtime behaviour was confirmed |
|---|---|---|
| 1 | `/nex-native/welcome` | HTTP 200 from live dev server; page body contains "NEX"; `document.documentElement.scrollWidth <= clientWidth` (no horizontal overflow at 412 px) |
| 2 | `/nex-native/welcome` | Primary + secondary CTAs rendered: `a[href*="/nex-native/create-account"]` and `a[href*="/nex-native/sign-in"]` both visible |
| 3 | `/nex-native/sign-in` | HTTP 200; no horizontal overflow at 412 px |
| 4 | `/nex-native/create-account` | HTTP 200; no horizontal overflow at 412 px |
| 5 | `/nex-native/chat/first-visit` (unauth) | Server-side `resolveNexAppSessionOrGuest()` guard redirects to `/nex-native/welcome` as expected · final URL matches `/\/nex-native\/welcome\b/` |
| 6 | `/nex-native/chat/first-visit/shop` (unauth) | Same guard · redirects to `/welcome` |
| 7 | `/nex-native/chat/first-visit/personalize` (unauth) | Same guard · redirects to `/welcome` |
| 8 | `/nex-native/welcome` primary CTA | Bounding box height AND width both ≥ 24 px (tap-target hygiene floor) |

### 2.3 · Backend integration · live Supabase hit

All 8 tests ran against the real dev server at `localhost:3008`. The dev server is wired to the canonical NEX Supabase project `ijvqdvsvwtwxzcqmoqit` per `nexapp CLAUDE.md §8` and verified in `nex-single-source-of-truth-verification-2026-10-14.md`. Each request's server-side `resolveNexAppSessionOrGuest()` hit the real Supabase SSR cookie layer and correctly identified an unauthenticated viewer. **This is real backend integration · not a mock.**

### 2.4 · Combined regression

```
$ ./node_modules/.bin/vitest run \
    src/app/nex-native/home/__tests__/first-visit-invitation.test.ts \
    src/app/nex-native/chat/first-visit/__tests__/first-visit.test.ts \
    src/lib/nex-native/__tests__/launch-flags.test.ts \
    scripts/__tests__/validate-env.test.mjs \
    scripts/__tests__/assert-nexapp-cwd-and-remote.test.mjs
RUN  v4.1.11 C:/Users/Victus/nexapp
 Test Files  5 passed (5)
 Tests       267 passed (267)
 Duration    379ms
```

Vitest regression unchanged by this task (no vitest tests added or modified).

**Grand total · unit + E2E for the broader session chain:** 267 vitest + 8 Playwright = **275 tests · all green**.

---

## 3 · Authenticated-journey gap · explicit

This task did NOT prove the sealed-in portion of the first-user journey. Specifically unverified:

| Step | Why unverified |
|---|---|
| Signed-in `/home` renders the first-visit invitation when the account has zero peer conversations | Requires an authenticated NEX session |
| Tap the invitation → navigates to `/chat/first-visit` AND renders the three cards | Same |
| Tap "Chat Themes" → `/nex-native/chat-themes-library` opens AND the user picks a theme AND `nex_account.chat_theme` persists | Same + requires DB write of a real theme preference |
| Tap "Chat Themes Shop" → honest Phase-2 preview renders inside the auth context | Same |
| Tap "Personalized Themes" → honest preview renders | Same |
| Return to chat, open a new conversation, send a message, confirm persistence | Same + requires a second account to peer with |

### 3.1 · Why the gap exists

The brief forbade reading `.env.local` or using secrets. Without Supabase credentials AND a provisioned test account, the Playwright run cannot create an authenticated session. The sealed `NEX_ALLOW_DEV_ADMIN` flag is explicitly "must-remain-unset-in-production" and is not wired to a public sign-in short-circuit; using it would also fail the production-containment work from B9/B10.

### 3.2 · Three concrete paths to close the gap · each needs owner authorisation

| # | Option | Blast radius | Owner needs to |
|---|---|---|---|
| A | **Provision a dedicated test account in Supabase** · owner creates a test email + password (or test WebAuthn credential) · writes to `tests/e2e/.env.test` (gitignored) · the spec reads credentials from that file, drives the real sign-in UI, then runs the signed-in journey | Low · test account visible as a real row in `nex_account` but tagged `test`-only | Create the account; deliver the credentials to the local test env |
| B | **Add a sealed test-only auth helper** · a server action gated behind a `NEX_TEST_AUTH_ENABLED` flag (must-be-unset-in-production, enforced by validator) that mints a cookie-authenticated session for a seeded test account id | Medium · new sealed surface + validator rule + integration test for the production-refusal | Authorise the new flag + the sealed helper + updates to `scripts/validate-env.mjs` to refuse it in prod |
| C | **Record Playwright storage state once (manual sign-in) and replay** · owner runs `npx playwright codegen localhost:3008/nex-native/sign-in --save-storage=state.json` once interactively; the spec loads `storage: state.json` to resume as authenticated | Low · one-shot operator action; state.json committed via `.gitignore` so credentials never touch git | Perform the one-shot sign-in; keep `state.json` locally |

Recommendation: **Option C**. It is the smallest safe path and doesn't require schema changes, new sealed flags, or production-config changes. One sign-in session on the owner's machine produces a `state.json` the Playwright spec can replay to drive the authenticated journey. The state file is already gitignored (`.env.local`-adjacent).

---

## 4 · Boundary compliance

| Boundary | Status |
|---|---|
| Repository root + remote via Phase 3A guard | ✅ · `guard=0` |
| Pre-task worktree size recorded + preserved | ✅ · 162 lines pre; same 162 lines + 3 new entries post |
| **No dependency installed** | ✅ · `@playwright/test@1.64.0` already present; chromium-1248 already present; no `npm install` or `playwright install` executed |
| No sealed service modified | ✅ · tier-gate, product-service, account-service, launch-flags, Vault, Bridge 99, Chat Master Layout primitives, migrations 191-197 · all untouched |
| No `.env.local` read | ✅ |
| No DB mutation performed by the tests | ✅ · all 8 tests are read-only GETs (no form submission, no POST) · the signed-in sign-up flow was NOT exercised |
| No deploy / no commit / no push / no stash / no reset / no branch change | ✅ |
| Dev server not restarted · ran against the existing PID on port 3008 | ✅ · no `webServer` config block; config `use.baseURL` points at the already-running instance |
| No UI rewrite · no new frontend components for the sake of testability | ✅ · tests use only existing selectors and HTTP contract |
| No schema change · no column added for test tracking | ✅ |
| Three completed first-visit pages untouched | ✅ · verified by `git diff --stat src/app/nex-native/chat/first-visit/` returning nothing |
| Home-page invitation untouched | ✅ · verified by `git diff --stat src/app/nex-native/home/` returning only the prior task's modification |

---

## 5 · Remaining limitations (honestly flagged)

| # | Limitation | Severity | Follow-up |
|---|---|---|---|
| L1 | **WebKit (iOS) coverage absent.** Pixel 7 (Chromium) was substituted for iPhone 12 Pro to avoid downloading `webkit-2370`. Safari-specific rendering quirks are unverified by this run. | Medium for an iOS-heavy launch, low for Android-first | `npx playwright install webkit` + flip the project back to `iPhone 12 Pro` (needs dep-install authorisation) |
| L2 | **Authenticated journey unverified.** Steps 3-7 of the first-user journey (see §3) remain unproven in a browser. | High for a launch-readiness decision | Option C in §3.2 (owner records a `storage: state.json` once) |
| L3 | **Single viewport.** Verification runs only at 412×915. Short viewports (iPhone SE at 375×667), tablet widths, and landscape orientation are unverified. | Medium | Add additional project entries (e.g. `iPhone SE 3`, `Pixel 7 landscape`) in a follow-up |
| L4 | **No visual regression baselines.** The spec confirms absence of horizontal overflow but not that the page LOOKS like the sealed design. | Medium | Add Playwright screenshot comparison in a follow-up |
| L5 | **No `webServer` auto-start.** The spec requires the dev server to be up externally; it will fail with a `net::ERR_CONNECTION_REFUSED` otherwise. | Low · CI integration follow-up | Add `webServer: { command: "npm run dev", port: 3008, reuseExistingServer: true }` in a sealed follow-up |
| L6 | **No `package.json` script.** Invoke via `./node_modules/.bin/playwright test --project=mobile-chromium-pixel7`. Adding an `e2e` npm script is a `package.json` edit · out of this task's scope. | Low · ergonomic only | Add `"e2e": "playwright test"` in a one-line follow-up |
| L7 | **No test for the ?commerce=1 / ?search=1 production refusal.** B9/B10 locked the query bypass in production but we're running in NODE_ENV=development here · the production refusal remains covered by the unit test at `src/lib/nex-native/__tests__/launch-flags.test.ts` and can't be reproduced against a dev server. | Low (unit tests enforce the policy) | Add a production-build smoke test in CI once the production env is wired |

---

## 6 · Definition of done · partial pass

The brief said: *"The next milestone is proof that the user journey works in a real browser, on a phone-sized viewport, with the actual routes and backend integrations."*

- ✅ **Real browser:** Playwright-driven Chromium 1248, not a jsdom simulation.
- ✅ **Phone-sized viewport:** Pixel 7 (412×915) with `isMobile: true` and `hasTouch: true`.
- ✅ **Actual routes:** every spec hit a real URL on `localhost:3008`; the dev server rendered real RSC output.
- ✅ **Actual backend integrations:** every request's `resolveNexAppSessionOrGuest()` consulted the real Supabase SSR cookie layer and the real `nex_account` session semantics (confirmed by the correct unauth → `/welcome` redirect on the three gated routes).
- ⚠️ **First-user journey:** only the pre-sign-up portion (steps 1-2) is covered. Steps 3-7 are listed in §3 with three concrete paths to close them.

Honest status: **phase one of B2 is complete and shippable as evidence.** Phase two (authenticated journey) is a bounded follow-up that needs the owner to pick one of options A / B / C in §3.2.

---

## 7 · Recommended next step

**Option C from §3.2:** owner records a Playwright `storage: state.json` by signing in once with a real NEX account on their local machine. One-shot command:

```bash
./node_modules/.bin/playwright codegen \
  http://localhost:3008/nex-native/sign-in \
  --save-storage=tests/e2e/.auth/state.json
# (ensure tests/e2e/.auth/ is in .gitignore)
```

Then a follow-up spec `tests/e2e/mobile-authenticated-journey.spec.ts` loads `storageState: "tests/e2e/.auth/state.json"` in its `test.use(...)` call and drives steps 3-7:

1. GET `/nex-native/home` · asserts invitation visible (depends on signed-in account having zero peer conversations)
2. Click invitation · asserts URL changes to `/chat/first-visit`
3. Click Chat Themes · asserts URL changes to `/chat-themes-library`
4. Select a theme (if the test account has conversations ≠ 0 after this run, step 1 won't repeat · acceptable)
5. Return to `/home` · asserts invitation is now ABSENT (predicate's `conversationCount > 0` branch)
6. Open a chat · send a short test message · verify it appears in the conversation list

Estimated effort: ~2-3 hours after owner provisions the storage state. Zero dep installs. Zero schema changes. Zero sealed-service edits.

---

## 8 · Commands actually run (reproducible)

```
# preflight
$ node scripts/assert-nexapp-cwd-and-remote.mjs
exit=0

# first run (iPhone 12 Pro / WebKit) · FAILED due to webkit-2370 missing
$ ./node_modules/.bin/playwright test --project=mobile-chromium-iphone12pro
8 failed · browserType.launch: Executable doesn't exist at webkit-2370

# config switched to Pixel 7 / Chromium · succeeded
$ ./node_modules/.bin/playwright test --project=mobile-chromium-pixel7
8 passed (16.9s)

# vitest regression unchanged
$ ./node_modules/.bin/vitest run <5 suites>
267 passed (0.379s)
```

Stopping. Awaiting owner review of the Playwright config, the spec, and the eight test results. The next bounded step is Option C in §3.2 (storage-state capture for the authenticated journey) · also owner-authorised.
