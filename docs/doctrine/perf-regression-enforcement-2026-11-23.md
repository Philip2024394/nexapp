# Perf regression enforcement · remaining branch-protection step

Owner-sealed 2026-11-23. Companion to CLAUDE.md §10.

## What is already in place

- `.github/workflows/perf-regression.yml` runs the Playwright
  perf-regression suite on every PR to `main` and
  `release-audit-v1-2026-11-14`, and on every push to the release
  branch. Production Next.js build, chromium only, asset-budget +
  preconnect + deployment-chain checks.
- `playwright.perf-regression.config.ts` drives the suite against a
  real `next build && next start` on port 3009 so the tests run on
  production output, not dev-mode HMR.
- `tests/e2e/perf-regression-asset-budgets.spec.ts` covers the
  backdrop + preconnect fixes.
- `tests/e2e/perf-regression-deployment-chain.spec.ts` covers the
  commit-sha chain (opt-in via `PREVIEW_URL` + `EXPECTED_COMMIT_SHA`).
- `src/app/api/nex-native/version/route.ts` exposes the build-time
  commit SHA + `x-nex-commit-sha` response header.

## What is still blocking enforcement

Branch protection is **not** configured on `Philip2024394/nexapp`.
The workflow runs and reports failures, but it does not block
merging a PR that regresses the fixes until the owner creates a
repository ruleset that marks the check as required.

## Exact check names to require

Add these to the branch-protection ruleset for the protected
branches (`main` and `release-audit-v1-2026-11-14`):

| Workflow | Job | Check display name |
|---|---|---|
| Perf regression (`.github/workflows/perf-regression.yml`) | `perf-asset-budgets` | `Playwright perf asset budgets` |
| Security CI (`.github/workflows/security-ci.yml`) | `typecheck` | `TypeScript` |
| Security CI (`.github/workflows/security-ci.yml`) | `secret-scan` | `Secret scan` |

(The Security CI checks are listed for completeness · the perf
contract covers the regression suite specifically.)

## Dashboard steps (owner action)

1. Open `https://github.com/Philip2024394/nexapp/settings/rules`.
2. **New branch ruleset** → name "Perf + security required checks".
3. Targets: `main` and `release-audit-v1-2026-11-14`.
4. Enable "Require status checks to pass":
   - Add `Playwright perf asset budgets`.
   - Add `TypeScript`.
   - Add `Secret scan`.
   - Enable "Require branches to be up to date before merging".
5. Save.
6. Open a test PR with a known regression (e.g. revert the
   `media="(min-width: 500px)"` attribute on the backdrop preload)
   and confirm the merge button is blocked. Close the PR without
   merging.

## Why this doc exists

Because the workflow file alone is not enforcement. Without the
ruleset the perf regression test is a nicety, not a guardrail. This
doc exists so later sessions know enforcement is pending and do
not close the §10 contract while the gap is open.

## When the ruleset is active

Once the owner confirms the ruleset is applied and a test PR is
blocked by it, update the "Enforcement status" paragraph in
`CLAUDE.md §10.3` to reflect that branch protection is active and
link the ruleset URL.
