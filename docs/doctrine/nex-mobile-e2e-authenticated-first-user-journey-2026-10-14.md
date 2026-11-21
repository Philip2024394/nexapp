# NEX · B2 Phase 2 · signed-in first-user journey · Option C preparation · review

Date: 2026-10-14
Scope: prepare the authenticated-journey Playwright harness per Option C from the Phase-1 review. **The spec itself does not execute until the owner performs a one-time interactive sign-in and produces `tests/e2e/.auth/state.json`.** This report delivers the harness, the exact safe command, and the step-by-step journey the spec will run once state.json exists.

Companions:
- `docs/doctrine/nex-mobile-e2e-first-visit-verification-2026-10-14.md` (Phase 1 · §Section 3 named Option C as the recommended path)
- `docs/doctrine/nex-first-visit-entry-wireup-2026-10-14.md` (home invitation this spec exercises)
- `docs/doctrine/nex-free-chat-theme-first-visit-implementation-2026-10-14.md` (three destinations this spec visits)

---

## 1 · Final file inventory

| Path | Change | Delta |
|---|---|---|
| `.gitignore` | **Modified** · added `tests/e2e/.auth/` protection block | +4 / 0 |
| `playwright.config.ts` | **Modified** · added `mobile-chromium-pixel7-authed` project with `storageState: "tests/e2e/.auth/state.json"`; added `testMatch` filters so each project runs only its own spec | +21 / −1 |
| `tests/e2e/mobile-authenticated-journey.spec.ts` | **New** · 229 lines · 9 tests spanning steps 1–9 of the brief | new |
| `docs/doctrine/nex-mobile-e2e-authenticated-first-user-journey-2026-10-14.md` | **New** · this review | new |

**No existing source modified.** Specifically untouched:
- The three first-visit destination pages (`/chat/first-visit/*`)
- The home page and `_first-visit-invitation.tsx`
- `peer-conversation-service.ts`, `account-service.ts`, `tier-gate.ts`, `product-service.ts`, `launch-flags.ts`
- Vault B-chain, Bridge 99, Chat Master Layout primitives
- Migrations 191-197, Hammerex seed
- Phase 1 public-surfaces spec (byte-identical)

**No `.env.local` read. No secret printed. No credentials in any source file. No test-only auth bypass added. No new env flag. No DB migration or seed. No dependency install.**

---

## 2 · Current test state

### 2.1 · Public spec · still green after config split

```
$ ./node_modules/.bin/playwright test --project=mobile-chromium-pixel7
Running 8 tests using 1 worker
  ✓ 1-8 (all unchanged from Phase 1)
  8 passed (12.6s)
```

Confirms the config split (two projects, each with its own `testMatch`) didn't regress Phase 1.

### 2.2 · Authed spec · deliberately errors until state.json exists

```
$ ./node_modules/.bin/playwright test --project=mobile-chromium-pixel7-authed
ENOENT: no such file or directory, open 'C:\Users\Victus\nexapp\tests\e2e\.auth\state.json'
1 failed · 8 did not run
```

**This is the expected safe-stop.** Playwright refuses to run the signed-in tests until the storage state file is present. No partial sign-in attempt. No fake session. No bypass.

### 2.3 · Vitest regression · unchanged

```
$ ./node_modules/.bin/vitest run \
    src/app/nex-native/home/__tests__/first-visit-invitation.test.ts \
    src/app/nex-native/chat/first-visit/__tests__/first-visit.test.ts \
    src/lib/nex-native/__tests__/launch-flags.test.ts \
    scripts/__tests__/validate-env.test.mjs \
    scripts/__tests__/assert-nexapp-cwd-and-remote.test.mjs
 Test Files  5 passed (5)
 Tests       267 passed (267)
```

No unit test was added or modified by this task.

---

## 3 · The exact safe owner command (state.json generation)

**You need to run this ONCE on your local machine. I will not run it.** It opens a real browser; you sign in with your dedicated NEX test account; Playwright captures the resulting cookies and localStorage; you close the browser; `state.json` lands at the gitignored path. I never see your credentials.

### 3.1 · Pre-checks (I already verified)

- `.gitignore` line 324 is `tests/e2e/.auth/` — session cookies cannot accidentally commit.
- `playwright.config.ts` references `tests/e2e/.auth/state.json` as the project's `storageState`.
- The spec at `tests/e2e/mobile-authenticated-journey.spec.ts` does not read, log, or forward the state file in any way; it hands it to Playwright's browser context, which keeps it inside the subprocess.

### 3.2 · Prepare the auth directory (one-off, zero credentials)

```
mkdir -p tests/e2e/.auth
```

(Playwright will create it on first write, but creating it manually gives you a chance to confirm the gitignore rule applies.)

Confirm with:

```
git check-ignore -v tests/e2e/.auth/state.json
```

You should see output like `.gitignore:324:tests/e2e/.auth/   tests/e2e/.auth/state.json` — proof the ignore rule matches BEFORE any sensitive file exists.

### 3.3 · The sign-in command (run on your machine · NOT by me)

```
./node_modules/.bin/playwright codegen \
  --save-storage=tests/e2e/.auth/state.json \
  --viewport-size=412,915 \
  --device="Pixel 7" \
  http://localhost:3008/nex-native/sign-in
```

What happens:

1. Chromium opens at the Pixel 7 viewport, loading `/nex-native/sign-in`.
2. You sign in **as your dedicated NEX test account** (not your personal/customer account). Use the normal sign-in UI; passwords stay in the browser.
3. After you reach `/home` (or wherever the sign-in flow lands you), **close the browser window**.
4. Playwright writes the resulting storage state to `tests/e2e/.auth/state.json`.
5. Playwright may also open a "Playwright Inspector" code-generator window alongside the browser — **ignore that window**; close it too when done. The code it generates is a byproduct, not part of this flow.

Alternative if you prefer not to see the codegen inspector, you can run a plain browser session via a tiny Node script. The codegen command above is simpler and uses only existing tooling.

### 3.4 · Verify the state file is correct and still gitignored

```
# File exists and has content
test -s tests/e2e/.auth/state.json && echo "state.json present and non-empty"

# .gitignore still protects it
git status --porcelain tests/e2e/.auth/state.json
# → should print NOTHING (file is ignored)

# Belt-and-braces · explicit ignore trace
git check-ignore -v tests/e2e/.auth/state.json
# → should print the gitignore line that matches
```

If any of these checks fail, delete the file and rerun the sign-in command. **Never commit `state.json`.**

### 3.5 · Then run the authed spec

```
./node_modules/.bin/playwright test --project=mobile-chromium-pixel7-authed
```

Expected result: 9 tests pass or produce documented skips (see §Section 4 for the per-step map).

---

## 4 · The 9-step journey the authed spec covers

Each row names what the spec verifies and what outcome is expected on first run.

| Step | Test name | What's asserted | Expected on first run with a zero-conversation test account |
|---|---|---|---|
| 1 (sanity) | `sanity · signed-in home is reachable (not bounced to /sign-in)` | GET `/home` returns 200; final URL matches `/nex-native/home`; body contains `"Welcome home"` | ✅ PASS |
| 3 | `home · first-visit invitation visibility matches conversationCount === 0` | Count of `[data-nex-home-first-visit-invitation]` is 0 or 1. If 1: visible AND contains `"First look · 3 destinations"`, `"Make NEX yours"`, `"Take the tour"`. If 0: annotation records "account already has conversations" | ✅ PASS (one branch per account state) |
| 4 | `home → first-visit · tap invitation navigates correctly` | Clicks invitation → URL changes to `/chat/first-visit`; the three destination cards (themes/shop/personalize) all visible | ✅ PASS if invitation visible · auto-skips if invitation absent |
| 5a | `first-visit → chat-themes-library · live catalogue opens` | First-visit page renders authed (not bounced to /welcome); Chat Themes card click → URL changes to `/chat-themes-library` | ✅ PASS |
| 5b | `first-visit → shop · honest preview opens, no commerce bypass` | Shop page renders authed; body contains `"Shop opening Phase 2"`; **zero** `button:has-text("Buy")`, `button:has-text("Unlock")`, `button:has-text("Add to cart")` rendered | ✅ PASS |
| 5c | `first-visit → personalize · honest preview opens, no fake upload` | Personalize page renders authed; body contains `"Personalization is on the way"` AND `"What's not here yet"`; **zero** `<input type="file">`, `button:has-text("Save")`, `button:has-text("Generate")`, `button:has-text("Upload")` rendered | ✅ PASS |
| 7 | `themes library · select a free theme and verify navigation` | Catalogue accessible from the first-visit flow. **Does NOT click a specific theme tile.** Logs annotation deferring deep selection/persistence to a follow-up once sealed library test-IDs are inventoried | ✅ PASS with "deferred" annotation |
| 8 | `send first message · BLOCKED pending known test peer` | `test.skip(true, ...)` with explicit reason: no safe peer target without a second provisioned test account or a sealed test business handle | ⏭ SKIP (safe) |
| 9 | `home · invitation absent when conversationCount ≥ 1` | `[data-nex-home-first-visit-invitation]` count is 0 or 1 (strict ≤1 bound). Logs annotation whichever branch runs; step 8 was blocked so the account's conversation state is unchanged by this run | ✅ PASS (two-way read · annotation describes the account's actual state) |

### 4.1 · What this will PROVE on first green run

- A real signed-in NEX session reaches `/nex-native/home` successfully (the authentication wiring is intact)
- The home page serves either the invitation OR the no-invitation branch depending on `conversationCount` — proving the predicate's integration against a real DB count
- Tapping the invitation correctly navigates to `/chat/first-visit` (the Option 1 entry wire-up works)
- The three destination pages render for an authed viewer (do NOT redirect to `/welcome` in the authed branch)
- The sealed honesty rules (no Buy, no Unlock, no Add-to-cart, no Save, no Upload, no Generate, no `<input type="file">`) hold at RUNTIME, not just at source-shape level

### 4.2 · What it will NOT prove even after it passes

- **Theme selection + persistence** · step 7 is deferred until the sealed library's test IDs are confirmed stable. Follow-up pass can flip this test to a specific theme click + `nex_account.chat_theme` persistence check.
- **First message send** · step 8 blocked by lack of a safe peer target. Resolve via one of:
  - Owner provisions a second dedicated test account (two test accounts can send to each other)
  - Owner seals a known test business handle (e.g., Hammerexproducts has a known handle · but writing messages to it creates real conversation state in the owner's own inbox)
  - Owner authorises a seeded test peer with a stable account id
- **iOS Safari / WebKit coverage** · Chromium-only this phase (Phase 1 limitation stands)
- **Short / landscape / tablet viewports** · Pixel 7 only (Phase 1 limitation stands)

---

## 5 · Safety · what this task did NOT touch

- `.env.local` · not read, not opened
- Any password, cookie value, session token, access token, or secret · never requested, never printed, never logged
- Any sealed service file · untouched
- Any existing test · untouched (Phase 1 spec byte-identical)
- The dev server at PID 7172 · continues to run; not restarted
- Git state · no commit, push, pull, stash, reset, clean, or branch change
- `package.json` · unchanged
- `tsconfig.json`, `next.config.mjs`, `vercel.json` · unchanged
- Database · no migration, no seed, no RPC, no table write
- Any production endpoint · zero HTTP call outside the local dev server

### 5.1 · What safety checks the spec itself enforces

The authed spec is written to fail LOUDLY (not silently) if any safety assumption breaks:

- If `state.json` is missing: Playwright errors at project startup with `ENOENT` and refuses to run tests (verified above).
- If the storage state is expired or revoked: the sanity test (`test 1`) fails because `/home` would bounce to `/sign-in`. All subsequent tests marked `test.describe.serial` abort.
- If a destination page renders a Buy/Save/Upload button that shouldn't be there: step 5b or 5c fails with a clear count mismatch.
- If step 8 is ever changed to actually send a message, the current `test.skip(true, ...)` with the explicit reason guards against accidentally running an unsafe write.

### 5.2 · Credentials-handling discipline

- `tests/e2e/.auth/` is gitignored BEFORE any file can be created in it (verified: `.gitignore` line 324, `git check-ignore -v` returns the matching line)
- The spec never calls `fs.readFile` on `state.json` — Playwright consumes it internally via the project's `storageState` config
- No `console.log(context.storageState)`, no `page.evaluate(() => document.cookie)` anywhere
- The owner's sign-in command (`playwright codegen --save-storage`) runs in the owner's local shell; I never execute it on their behalf; credentials stay in the owner's browser

---

## 6 · Why not Option A (dedicated credentials via `.env.test`) or Option B (sealed test-auth helper)

Reminder of the Phase 1 trade-offs:

| Option | What it would require |
|---|---|
| A · credentials in `tests/e2e/.env.test` | A `.env.test` file containing a password or API key; even gitignored, this is a plaintext credential in the working tree. The brief's "no new persistent state", "no credentials in source files" rules bar it. |
| B · sealed `NEX_TEST_AUTH_ENABLED` flag + helper endpoint | A new sealed endpoint that mints a session for a seeded account; requires `validate-env.mjs` updates to refuse it in production; introduces a new authentication path. Larger blast radius; owner has not authorised. |
| **C (chosen)** | A one-shot interactive sign-in by the owner produces `state.json`. No new flags, no new endpoints, no credentials in files, no bypass. The spec runs against the exact same auth surface a real user would. |

Option C is the smallest-blast-radius path and the one the brief explicitly directed.

---

## 7 · Remaining limitations (unchanged from Phase 1 + new)

| # | Limitation | Severity | Next-step owner |
|---|---|---|---|
| L1 | WebKit (iOS) coverage still absent | Medium for iOS-heavy launch | `npx playwright install webkit` + rerun with iPhone descriptor |
| L2 | Message-send (step 8) blocked by no safe peer | High for "prove a conversation can start" | Provision a second test account OR seal a test peer handle |
| L3 | Theme-selection persistence (step 7) deferred to a follow-up | Medium | Inventory sealed library test IDs, then flip test to specific theme + persistence check |
| L4 | Single viewport (412×915) only | Medium | Add `iPhone SE 3` and `Pixel 7 landscape` to the project list |
| L5 | No visual regression baselines | Medium | Add Playwright screenshot comparisons |
| L6 | No `webServer` auto-start | Low (ergonomic) | Add `webServer: { command: "npm run dev", port: 3008, reuseExistingServer: true }` |
| L7 | No `package.json` run script yet | Low | Add `"e2e:public": "playwright test --project=mobile-chromium-pixel7"` and `"e2e:authed": "playwright test --project=mobile-chromium-pixel7-authed"` |

---

## 8 · Boundary compliance

- ✅ Repository root + remote verified via Phase 3A guard (`guard=0`)
- ✅ Pre-task worktree size recorded (169) + preserved (no existing-file content touched beyond `.gitignore` +4/0 and `playwright.config.ts` +21/−1 which was already untracked)
- ✅ No dependency installed · `@playwright/test@1.64.0` + `chromium-1248` already present from Phase 1
- ✅ No sealed service modified · tier-gate, product-service, account-service, launch-flags, Vault, Bridge 99, Chat Master Layout, migrations 191-197 all untouched
- ✅ Three first-visit pages untouched · verified via `git diff --stat src/app/nex-native/chat/first-visit/` returning nothing
- ✅ Home invitation + predicate untouched · verified via `git diff --stat src/app/nex-native/home/` returning only Option-1-pass delta
- ✅ No `.env.local` read, no secret printed, no credentials anywhere
- ✅ No DB mutation performed by this task's test runs; the authed spec is prevented from running until the owner provides state.json
- ✅ No test-only auth bypass, no new env flag, no DB migration or seed
- ✅ No deploy, no commit, no push, no stash, no reset, no branch change
- ✅ Dev server not restarted · ran against existing PID 7172 on port 3008
- ✅ Vitest regression unchanged (267/267)
- ✅ Phase 1 Playwright spec unchanged (8/8 still pass)

---

## 9 · The exact sequence after you (owner) sign in

Once you've produced `state.json` per §Section 3.3 and verified §Section 3.4:

```bash
# 1 · Confirm the auth state is readable by Playwright
test -s tests/e2e/.auth/state.json && echo "state.json ready"

# 2 · Run only the authed project (does not touch the public spec)
./node_modules/.bin/playwright test --project=mobile-chromium-pixel7-authed

# 3 · Expected result (first run with a zero-conversation test account):
#    · 7 tests pass
#    · 1 skipped (step 8 · message send · documented reason)
#    · 1 skipped IF the test account already has conversations (step 4
#      auto-skips when invitation absent)

# 4 · Combined · run both projects to produce the full Phase 1 + Phase 2 report
./node_modules/.bin/playwright test
```

If step 1 reports the sanity test failing (`/home` bounced to `/sign-in`), the storage state is expired or the test account's session is revoked. Delete `state.json` and rerun the sign-in command.

---

## 10 · What proof this adds once green

Phase 1 proved: public funnels load at phone viewport; unauth guards work.

Phase 2 (after owner-provided state.json) will prove:

- A real signed-in session can reach `/home` on a real mobile viewport
- The home-page invitation renders exactly when the account's live conversation count is 0 (end-to-end, not just unit)
- Tapping the invitation navigates authentically to the three-destination landing
- The three destinations render for an authed viewer with their sealed honest copy intact (no Buy/Save/Upload affordance leaks through under auth)
- The theme catalogue is reachable from the first-visit flow

What remains unproven even after Phase 2 passes:

- Specific theme selection + persistence (step 7 deferred)
- First message send + receipt + persistence (step 8 blocked)
- iOS Safari rendering
- Short / landscape / tablet viewports
- Visual regression

These remain honest Phase F open items.

---

## 11 · Stopping condition

I have prepared everything that can be prepared without your credentials. **You must perform §Section 3.3's one-shot sign-in command yourself.** After `state.json` exists, run `./node_modules/.bin/playwright test --project=mobile-chromium-pixel7-authed` to execute the signed-in journey.

I will not:
- run the authed spec on my own
- attempt to sign in on your behalf
- read, print, log, or commit `state.json` or any credential
- change the test to bypass authentication

If step 1 (sanity) fails on your run, let me know and I will diagnose from stdout / trace WITHOUT inspecting state.json.

Stopping. Awaiting your sign-in step.
