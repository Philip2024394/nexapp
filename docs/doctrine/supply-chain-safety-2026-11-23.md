# Supply-chain safety · nexapp

**Sealed:** 2026-11-23
**Owner:** Philip (`Philip2024394/nexapp`)
**Scope:** `C:/Users/Victus/nexapp` only. Branch `release-audit-v1-2026-11-14`
(and `main` once promoted).

## Why

The NEX competitive wedges (MEMORY `project_nex_competitive_wedges_2026_11_23`)
commit NEX to WhatsApp-tier parity on trust and transparency. Supply-chain
hygiene is table stakes for that: a single malicious transitive dep or an
un-audited major bump can invalidate every other privacy and ownership
claim we make. This doctrine adds four CI gates and two paper trails so the
chain of custody from `package.json` → committed code → signed tag →
released artifact is verifiable, not asserted.

These safeguards live alongside `CLAUDE.md`:

- **§3 / §4** — no commit without authorisation, no push without
  separate owner approval.
- **§5** — deploy is a further separate gate.
- **§10** — perf fixes aren't complete without CI enforcement; this
  doctrine extends the same posture to dependencies.

## What each file does

### `.github/dependabot.yml`
Weekly scans of npm + GitHub Actions ecosystems. Minor/patch bumps are
grouped per ecosystem to reduce PR noise; majors are one-PR-each so
breaking changes get reviewed in isolation. Max 5 open PRs per ecosystem.
Every PR is labeled `dependencies` + `supply-chain-safety` and assigns
`Philip2024394` as reviewer. Commit-message prefixes are `chore(deps):`
and `chore(ci-deps):` respectively.

### `.github/workflows/codeql.yml`
GitHub CodeQL static analysis for `javascript-typescript` on:
- every push to `main` + `release-audit-v1-2026-11-14`
- every PR targeting those branches
- a weekly cron (`0 6 * * 1`)

Uses the `security-and-quality` query pack. Uploads SARIF to the
Security tab. Permissions pinned to least-privilege
(`security-events: write`, `contents: read`, `actions: read`).
Timeout 20 minutes. Pinned to `github/codeql-action/init@v3` +
`.../analyze@v3`.

### `.github/workflows/lockfile-integrity.yml`
Fires only on PRs that touch `package.json` or `package-lock.json`.
Runs:

1. `npm ci --ignore-scripts` — proves the lockfile matches `package.json`
   AND the install is reproducible. `--ignore-scripts` deliberately
   disables install-time scripts so a compromised dep can't execute
   code in CI.
2. `npm audit --audit-level=high --omit=dev` — fails the job on any high
   or critical CVE in production dependencies.
3. `npm audit signatures` — best-effort signature verification. Logged
   as a warning if issues are reported, but not fatal (support varies
   by npm version).

Node version is read from `.nvmrc` if present, else Node 20. Timeout
10 minutes.

### `.github/workflows/sbom.yml`
Runs on push to `main` + `release-audit-v1-2026-11-14` and on manual
dispatch. Uses `anchore/sbom-action@v0` to emit a CycloneDX JSON SBOM,
uploads it as an artifact named `nexapp-sbom-${github.sha}` with 90-day
retention, and — if the triggering ref is a tag — attaches the SBOM to
the GitHub release via `softprops/action-gh-release@v2`. Timeout 10
minutes.

### `CHANGELOG.md`
Keep-a-Changelog 1.1.0 format. One `[Unreleased]` section at the top,
dated release sections below. Pre-1.0 versioning policy: release tags
are `nexapp-vYYYYMMDD-N` where N auto-increments per day.

### `scripts/release-tag.mjs`
Owner-gated local helper that:

- validates branch (`release-audit-v1-2026-11-14` by default, `main`
  with `--prod`),
- validates a clean working tree,
- validates the remote is `Philip2024394/nexapp`,
- picks the next `nexapp-vYYYYMMDD-N` for today,
- promotes `CHANGELOG.md`'s `[Unreleased]` into a dated release section,
- creates an **annotated** tag locally,
- **does NOT push**. It prints the exact `git push origin <tag>` command
  for the operator to run under separate owner authorisation.

### `.github/PULL_REQUEST_TEMPLATE.md`
Mandatory checklist: Summary · Linked issue · Changes · Regression
tests · Blueprint maps regenerated · Migration state (sandbox/prod,
ref-check) · Security review · Reviewer checklist.

## How to respond to a Dependabot CVE alert

1. **Read the alert in context.** Open the Dependabot PR. Confirm which
   package, which version range, which transitive path. Check the
   CodeQL and lockfile-integrity CI runs on that PR.
2. **Classify.** Is the vulnerable code path reachable from nexapp? A
   high CVE in a dev-only dep is lower priority than a medium CVE in a
   runtime-reachable path.
3. **Patch.** Prefer the Dependabot-proposed bump. If it's a major, read
   the upstream changelog and plan a separate PR.
4. **Verify.** Run the full test suite locally. For runtime-reachable
   fixes, add or update a regression test per `CLAUDE.md §10.2` before
   merging.
5. **Record.** Add an entry under `[Unreleased]` → `### Security` in
   `CHANGELOG.md`. Reference the CVE ID and the PR number.
6. **Merge.** Owner-approved merge only. Push to the current working
   branch per `CLAUDE.md §4`. Do NOT fast-forward to `main` unless the
   release checklist (below) is being run end-to-end.

## How to read the SBOM output

1. Navigate to the Actions tab, pick the most recent `SBOM` run on the
   branch of interest.
2. Download the `nexapp-sbom-<sha>` artifact. It's a CycloneDX JSON
   file.
3. Open it with any CycloneDX viewer (e.g. `dependency-track`,
   `cyclonedx-cli`, or a simple `jq '.components[] | {name,version,purl}'`).
4. For post-incident triage: diff two SBOMs to see exactly which
   components changed between two commits.
5. For a tagged release, the same SBOM is attached to the GitHub
   release page (see `sbom.yml`'s release-attach step).

## When to cut a release tag

Cut a tag when:

- A set of changes has reached a "shippable to preview or production"
  milestone (regardless of whether it's actually been shipped).
- The `[Unreleased]` section in `CHANGELOG.md` has concrete, user-
  observable entries.
- All required CI checks are green on the HEAD commit.
- No open P0 regressions exist on the branch.

Do NOT cut a tag:

- Mid-refactor with WIP commits.
- When the working tree is dirty.
- To "pre-reserve" a date.

## Release sequence (owner-controlled)

The push remains the gate. The full sequence:

1. **Local**: add entries to `CHANGELOG.md` `[Unreleased]`.
2. **Local**: commit the CHANGELOG edit (owner-approved commit per
   `CLAUDE.md §3`).
3. **Local**: run
   ```
   node scripts/release-tag.mjs --confirm --reason "<short reason>"
   ```
   (add `--prod` only when tagging on `main`).
   The script promotes `[Unreleased]` to a dated section, creates the
   annotated tag locally, and prints the push command. It does NOT
   push.
4. **Local**: commit the CHANGELOG promotion diff (separate commit,
   owner-approved).
5. **Owner approval**: operator confirms the destination repo, branch,
   and commit range match authorisation.
6. **Push commits**: `git push origin <branch>` (owner-approved).
7. **Push tag**: `git push origin <tag>` (separately owner-approved per
   `CLAUDE.md §4`).
8. **CI**: SBOM workflow fires on the tagged push; artifact attaches to
   the GitHub release.
9. **Deploy**: separate gate per `CLAUDE.md §5`. Not automated by this
   doctrine.

Every step is logged in `docs/engineering/session-handoff.md` per
`CLAUDE.md §9`.

## Non-negotiables

- **Never** edit `package.json` to silence a Dependabot PR.
- **Never** remove `--ignore-scripts` from the lockfile workflow.
- **Never** change `codeql.yml` to `continue-on-error` on the analyze step.
- **Never** push a tag directly without the two-step owner approval.
- **Never** attach an SBOM from a different commit to a release.
