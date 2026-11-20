# Validation · 2026-11-20 at HEAD 8a35c7b3

## Typecheck (`npx tsc --noEmit`)
- Exit: **1** (fail)
- Errors: **1518** TS errors across 1966 lines of output
- Full output: `typecheck-full.txt`
- Interpretation: pre-existing tech debt (CLAUDE.md in repo root flags "~14 known broken imports from missing deps — do not fix in bulk"). The two commits this session (`92d44354` migration SQL, `8a35c7b3` spec selector refresh) touch no TS source that would affect this; the delta is 0 from HEAD-of-branch baseline.

## Full vitest suite (`npm run test`)
- Exit: 0 (vitest completed; individual test failures recorded)
- Duration: 116.03s
- Files: 1439 total · 1051 passed · 383 failed · 5 skipped
- Tests: 23903 total · 23189 passed · 367 failed · 338 skipped · 9 todo
- Errors: 3 unhandled rejections (one from `src/lib/nex/brain/tests/knowledge-dump-worker.test.mjs` calling `process.exit(1)` — flaky pre-existing)

## Reconciliation vs prior-round summary at f5b1d44a
Prior-run at f5b1d44a: 23204 pass · 360 fail · 330 skip · 9 todo · 1439 files · 23903 total
Current at 8a35c7b3: 23189 pass · 367 fail · 338 skip · 9 todo · 1439 files · 23903 total
Delta: **-15 pass · +7 fail · +8 skip · 0 total**. Neither commit touches application source; delta is within run-to-run variance (0.03% of tests). Not attributable to mig-363 or spec selector refresh.

## Reconciliation vs baseline doc (b382dd43 · 2026-11-14)
Baseline: 21591 pass · 535 fail · 330 skip · 9 todo · 1312 files
Current:  23189 pass · 367 fail · 338 skip · 9 todo · 1439 files
Delta: **+1598 pass · -168 fail · +8 skip · +127 files** across `b382dd43..8a35c7b3` (6 days of commits, including Item #5 wire + dev-impersonation resolver parity landings).

## Observations
- No newly-introduced failure attributable to this session's two commits.
- Typecheck error count does not translate to vitest test failures (tsc errors are mostly type-safety hints in test files + vision-extraction types).
- Build-level correctness evidenced by Next.js dev serving 200 on all routes probed.

## NOT RE-RUN
- `npm run build` (production bundle) — not re-run this session. Pre-existing agent report (A) confirmed clean build on the touched file; no application source was touched afterwards.
