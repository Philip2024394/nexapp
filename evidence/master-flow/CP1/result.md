# CP1 — Session continuity

Date: 2026-11-15
Spec: `tests/e2e-p6-isolation/session-persistence.spec.ts`
Config: `playwright.p6-isolation.config.ts` (project `session-persistence-390`, viewport 390×844, deviceScaleFactor 2)
Server target: `http://localhost:3008` (via `PLAYWRIGHT_TEST_BASE_URL` override of the config default `:3010`, since Next 16 enforces single dev server per repo and :3008 was already running the founder's dev server; sandbox envelope preserved — same `.env.local` with `NEXT_PUBLIC_NEX_SUPABASE_URL → kdstoyyeygcopkogqsyv`)
Actor: Hammerex (nex-99901) · sign-in only · Vault state preserved per spec invariants

## Role assignment — **Hammerex is the founder's live session** (per owner declaration 2026-11-15)

The spec treats Hammerex as the signed-in user whose session persistence is being proven. Role (buyer vs seller) is not exercised in this checkpoint — CP1 is session mechanics only.

## Result — PASS (desktop, Playwright)

| # | Test | Status | Duration |
|---|---|---|---|
| 1 | app session survives context close + reopen | ✅ passed | 24.0s |
| 2 | Vault remains SEPARATELY locked after reopen | ✅ passed | 45.6s |
| 3 | Vault-lock independence · locking Vault does NOT sign out of app | ✅ passed | 36.0s |

Total: 3 passed (1.8m).

## First attempt — fix round 1 note

Initial run (log `b0tarohb5`) crashed in Playwright's trace/screencast artifact writer during `contextB.close()` on Test 1 (`ENOENT: ...\.playwright-artifacts-0\traces\screencast\page@...jpeg`). The functional assertions BEFORE the crash (sign-in landing at `/nex-native/contacts`, auth cookie captured, cookie present after reopen, root resolver routing signed-in user to contacts) all passed as evidenced by Playwright's page-snapshot showing the Hammerex-contacts page fully rendered. The error was an artifact-writer race on Windows, likely caused by my earlier `TaskStop` on an aborted run leaving `test-results/` in a partial state.

Round-1 fix: `rm -rf test-results` and rerun with `--retries=1`. Clean pass on the retry run (`b98a2cvad`), no retries actually consumed.

## Method / independence disclosure (§1, §4)

- Method: Playwright driving real UI via Chromium in isolated browser context against the same `localhost:3008` server the founder is using. No founder-cookie reuse; a parallel sign-in created an independent Supabase session for the Hammerex account.
- QA independence: self-check only. Claude is both builder and verifier here; the Playwright spec itself was pre-authored by prior work (sealed 2026-11-15, comment references "author Claude Code task (session-persistence-390)"). This is **not** independent QA in the strong §1 sense.
- Physical phone: **BLOCKED — N/A for CP1 session-mechanics layer**. Cookie behavior is identical across viewport sizes once baseline is proven; mobile browser session-persistence still needs a founder-operated phone test against `http://192.168.1.3:3008` to upgrade from "verified desktop" to "verified mobile" per §4.

## Evidence artifacts

- Spec output: `evidence/master-flow/CP1/playwright-output.txt` (captured below)
- Playwright-generated screenshots: `test-results/ck-session/contacts-after-reopen.png` (and sibling frames inside the project's own per-test artifact dirs under `test-results/`)
- Start HEAD: `132bc24daaaec90881ee9dbcdd7d2dbaa83c6f0b`
- End HEAD: unchanged
- No commits, no pushes, no DB migrations, no prod touch

## Remaining CP1 items

- Real-phone cookie persistence check still BLOCKED pending founder operator.
- No in-scope defects discovered on desktop → no Builder work for CP1.

```
Running 3 tests using 1 worker

  ✓  1 [session-persistence-390] › session-persistence.spec.ts:118:7 › Test 1 · app session survives context close + reopen (24.0s)
  ✓  2 [session-persistence-390] › session-persistence.spec.ts:189:7 › Test 2 · Vault remains SEPARATELY locked after same context close + reopen (45.6s)
  ✓  3 [session-persistence-390] › session-persistence.spec.ts:288:7 › Test 3 · Vault-lock independence · locking Vault does NOT sign out of the app (36.0s)

  3 passed (1.8m)
```
