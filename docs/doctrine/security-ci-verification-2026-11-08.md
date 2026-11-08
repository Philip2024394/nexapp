# NEX Security CI Verification · 2026-11-08

Workflow under review · `.github/workflows/security-ci.yml` (shipped
in commit `341c64d`, confirmed in-tree at HEAD `451f780b`).

Repository · `C:/Users/Victus/nexapp` · branch
`nex-ireland-build-2026-11-06`.

---

## 1 · Workflow trigger analysis

From `.github/workflows/security-ci.yml:25-41`:

```yaml
on:
  push:
    branches:
      - main
      - 'nex-ireland-build-*'
      - 'phase-*/*'
  pull_request:
    branches:
      - main
      - 'nex-ireland-build-*'
  workflow_dispatch:
    inputs:
      audit_fail:
        description: "Fail on npm audit moderate+ findings"
        required: false
        default: "false"
        type: string
```

Pattern match against the current branch `nex-ireland-build-2026-11-06`:
- `main` · no match
- `nex-ireland-build-*` · MATCHES (glob covers suffix `2026-11-06`)
- `phase-*/*` · no match

**Trigger status · the workflow DOES fire on push to this branch.**
Both `push` and `pull_request` triggers are covered.

`workflow_dispatch` is also available for manual runs with the
`audit_fail` toggle · useful for a one-off hardened audit check.

### Jobs enumerated
1. `secret-scan` · runs `node scripts/security-ci/secret-scan.mjs`.
   No `npm ci` step · the scan script is pure Node, zero deps. This
   is intentional · the scan runs on every push without the lockfile-
   install overhead.
2. `dependency-audit` · `npm ci` then `npm audit --omit=dev
   --audit-level=moderate --json`. Captures exit code; only fails
   when `audit_fail=true` is passed via `workflow_dispatch`. Default
   behaviour is to log and exit 0.
3. `typecheck` · `npm ci` then `npx tsc --noEmit` against the whole
   repo.
4. `security-programme-tests` · `npm ci` then `npx vitest run` with
   an explicit allow-list of 22 test paths (Security + Recovery +
   Attachment + HQ + Health + Incident + Security-monitor + Recovery
   test files, plus associated server-action tests).

`permissions:` is scoped to `contents: read` only · no write, no
packages. Correct hardening posture.

---

## 2 · Run history

**`gh` CLI state on this host:** installed (`C:/Program Files/
GitHub CLI/gh`) but NOT authenticated. `gh auth status` returns
"You are not logged into any GitHub hosts. To log in, run: gh auth
login".

**Owner action required to populate this section:**
```powershell
gh auth login        # one-time, device-flow or token
gh run list --branch nex-ireland-build-2026-11-06 `
            --workflow security-ci.yml --limit 10
```

Without the owner running `gh auth login` (or providing a
`GH_TOKEN` env var for this session), this agent cannot enumerate
remote run history. The §3 default-expectation analysis below
substitutes until that is done.

---

## 3 · Expected first-run outcomes per job

This is the honest expectation when the workflow fires on this
branch for the first time, based on the state of the tree at HEAD
`451f780b`:

| Job | Expected outcome | Evidence |
|---|---|---|
| `secret-scan` | **PASS** | Ran `node scripts/security-ci/secret-scan.mjs` locally during this audit · output `scanned 4736 files · OK · no suspicious patterns found` · exit 0. |
| `dependency-audit` | **PASS (non-fatal)** | Script prints advisory summary via Node `JSON.parse`. The step does NOT fail unless `workflow_dispatch` is invoked with `audit_fail=true`. On push, it will log findings (if any) and exit 0. |
| `typecheck` | **FAIL (known pre-existing)** | TS errors are documented across previous sessions · `CLAUDE.md` acknowledges "~14 known broken imports from missing deps · do not fix in bulk". The job will fail the build on `npx tsc --noEmit`. This is the expected honest behaviour · the step exists to ensure no NEW type regressions ship, not to assert the whole tree is clean. |
| `security-programme-tests` | **PASS** | All 478 Security Programme tests are reported to pass locally. `npm ci` on GitHub runners will install the exact package-lock, so parity with local is expected. |

### Known pre-existing failures to triage

**`typecheck` job is expected to fail on this and every push.** The
codebase has documented TS2307 clusters pointing at legacy modules
(`nex-cap/*`, `nex-intelligence/*`, `apps/materials/*`,
`hammerex_*`, etc.) that are in the `src/lib/nex/` legacy residue
tree. CLAUDE.md describes these as "candidate for move-out, not
type-fix."

**Options the owner can choose from:**

1. **Leave as-is · honesty mode.** `typecheck` reliably fails in
   CI until the legacy residue is resolved. The signal value is
   zero. The visibility cost is "red check on every PR". Not
   recommended for a shipping product because red CI loses
   meaning quickly.
2. **Scope typecheck to NEX-native only.** Replace `npx tsc
   --noEmit` with `npx tsc --noEmit -p tsconfig.nex-native.json`
   after adding a project-reference config that excludes the
   legacy trees (`src/lib/nex/`, `src/lib/llm/`, legacy monorepo
   products). Keeps the signal useful without blocking on known
   residue.
3. **Move typecheck to `continue-on-error: true`.** The job runs
   and reports but never fails the workflow. Simple one-line
   change. Honest about the failing state without making green
   CI impossible.

**Recommendation** · option 2 or 3 pending owner call. Both require
a workflow edit · NOT authorised to land in this session.

### Other considerations

- **`npm ci` performance** · the lockfile is large. Expect cold
  cache runs ~60-120s on GitHub free-tier runners · warm cache
  ~20s. The workflow correctly sets `cache: 'npm'` on the
  setup-node step so warm runs should be fast.
- **No concurrency config.** Two pushes in quick succession on
  the same branch will spawn two parallel workflow runs. Not
  harmful · all jobs are idempotent · but doubles billable
  minutes. Adding `concurrency: { group: ${{ github.ref }},
  cancel-in-progress: true }` to the top of the workflow is a
  one-line optimisation. Not authorised to land here.
- **No `fetch-depth`** on `actions/checkout`. Default is depth=1
  which is fine for secret-scan but if a future enhancement
  wants to compare against the base branch (e.g. `git diff
  origin/main...HEAD`) the depth will need to be 0 or the
  specific ancestor.

---

## 4 · Honest claims about workflow readiness

The workflow file is correctly scoped and trigger-wired for this
branch. On the next push to `nex-ireland-build-2026-11-06`, the
expected pattern is:

- `secret-scan` · green
- `dependency-audit` · green (advisory logged but not failed)
- `typecheck` · red (pre-existing)
- `security-programme-tests` · green

A single green-overall run is NOT achievable from HEAD `451f780b`
without a change to the typecheck posture (option 2 or 3 above,
owner decision).

---

## 5 · Required (non-destructive) changes to document

Not landed by this audit · documented for owner authorisation:

1. **Typecheck scoping or soft-fail** · see §3 options.
2. **Add concurrency group to cancel stale runs.**
3. **Expose `gh` auth status check** in a bootstrap doc so future
   audits can read run history without re-asking.
4. **Weekly `workflow_dispatch` schedule** with `audit_fail=true`
   on a cron-driven run · gives npm audit teeth once a week
   without blocking day-to-day PRs.

---

## 6 · Owner actions to complete this verification

1. `gh auth login` on this host (or export `GH_TOKEN`) to let
   future audits enumerate run history.
2. Push the current branch tip (`451f780b`) to GitHub if not
   already pushed · the workflow has not run if nothing has
   been pushed to a matching branch pattern. (Safety
   Constitution §4 · push is a separate authorisation from this
   audit.)
3. Decide the typecheck posture · option 1, 2, or 3 from §3.
4. After the first run lands, revisit this doc with
   `gh run list --branch nex-ireland-build-2026-11-06` output
   and fill in §2 with actual timings + pass/fail per job.

---

## 7 · Verdict

- Workflow file · **CORRECT and READY** for this branch.
- Secret-scan locally clean at 4736 files.
- Security Programme tests expected to pass.
- Typecheck expected to fail until legacy residue is scoped out.
- Dependency audit non-fatal by default · needs owner decision on
  whether to make it fatal.
- Owner must complete `gh auth login` (one-time) for future audits
  to enumerate run history.

No workflow edits made. No commits. No pushes.
