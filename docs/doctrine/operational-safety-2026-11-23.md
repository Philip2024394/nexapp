# Operational safety — nexapp

**Sealed:** 2026-11-23
**Scope:** `C:/Users/Victus/nexapp` · branch `release-audit-v1-2026-11-14`
**Owner:** Philip · `asknexapp@gmail.com`
**Author:** session 2026-11-23 operational-safety bundle
**Related doctrine:**
`docs/doctrine/perf-regression-enforcement-2026-11-23.md`,
`docs/doctrine/backup-restore-readiness-2026-11-08.md`

---

## What this doctrine establishes

A written, testable response path for three incident classes nexapp is
most likely to hit:

1. A bad Worker deployment on
   `nexapp-preview.nex-sandbox.workers.dev`.
2. A bad Supabase migration against sandbox
   (`kdstoyyeygcopkogqsyv`) or production
   (`ijvqdvsvwtwxzcqmoqit`, the sole database of record per CLAUDE.md
   §8).
3. A leaked credential.

The doctrine is NOT a shortcut around CLAUDE.md §3–§5. Every runbook
step that would change repository state, deployment state, database
state, or credential state requires a fresh **owner-named**
authorization — including mid-incident. There is no "emergency
exception." That rule is restated inside every runbook and every
script.

---

## Deliverables

### 1 · Runbook library

Under `docs/runbooks/`:

| File | Covers | When it applies |
|---|---|---|
| `README.md` | Severity definitions · escalation · "Never do during an incident" list | Always — read first at incident start |
| `worker-rollback.md` | Rolling back `nexapp-preview` to a known-good commit | SEV-1 / SEV-2 when a Worker deploy serves a bad build |
| `db-restore.md` | Supabase point-in-time or daily-backup restore for sandbox or prod | SEV-1 (prod) or SEV-2 (sandbox) when a migration had a bad outcome |
| `secret-leak-response.md` | Rotate at provider → update Workers/env → do NOT force-push → optional history rewrite | SEV-1 when a key has (or may have) left the private boundary |

Severity model (restated here for cross-reference):

- **SEV-1** — live user harm now. Immediate response. Email the owner.
- **SEV-2** — reproducible defect on a specific surface. Same-session.
- **SEV-3** — cosmetic or self-recovering. Next planned cycle.

Escalation path is single-owner by design (CLAUDE.md §8 single-owner
model). No on-call rotation. No team lead. No secondary.

### 2 · Rollback helper — `scripts/rollback-worker.mjs`

A READ-ONLY intent logger. The script:

- Validates `--worker`, `--to-sha`, and `--reason` arguments.
- Prints the exact Cloudflare dashboard URL to click.
- Prints reference `curl` commands for the Cloudflare API that are
  **commented out** and will not run.
- With `--confirm`, appends a single intent line to
  `docs/engineering/rollback-log.md` (creating the file with a
  header on first run).
- Without `--confirm`, prints the plan and exits without writing.

It does not — and cannot, in the current configuration — perform a
rollback via the Cloudflare API. See the next section.

### 3 · Audit log builder — `scripts/audit-log-build.mjs`

Regenerates `docs/engineering/audit-log.md` from:

- `git log --format=... --all`
- `.git/HEAD` + current branch / HEAD / remotes / status
- `git reflog` scanned for force-push and destructive-reset markers
- `docs/engineering/session-handoff.md` (latest `##` section)
- `docs/engineering/rollback-log.md` (if present)
- `docs/engineering/safe-rm-log.md` (if present)

Honesty rules it enforces:

- A missing source is labeled `[missing]` in the Source summary, not
  silently skipped.
- An inaccessible reflog is reported, not hidden.
- The output file is regenerated every run — hand-edits to
  `audit-log.md` are discarded (the authoritative source of each
  section is cited in that section).
- Exit code is 0 for missing sources (expected during bootstrap). Only
  a write failure to `audit-log.md` is a non-zero exit.

---

## The missing piece — Cloudflare `workers_scripts:write` scope

True automated rollback via the Cloudflare API requires an API token
with the scopes `workers_scripts:read` (list deployments) and
`workers_scripts:write` (change traffic routing). CLAUDE.md §10.1.2
documents the read-side gap; the write-side gap is equally present
under the current OAuth token.

This doctrine does NOT paper over that gap. `scripts/rollback-worker.mjs`
is intentionally a logger — it prints what a scoped-token script
would do and lets the owner run that script, with a fresh
authorization, when (if) a scoped token is minted.

Minting such a token is itself an owner action — not a session task —
because it changes account-level permissions. If the owner decides to
mint one:

- The token's name should encode its purpose (e.g.
  `nexapp-rollback-only-2026-11-xx`).
- The token's scope should be the minimum required
  (`workers_scripts:read`, `workers_scripts:write` on account
  resources limited to the Workers in scope).
- The token should NOT be stored in the repo; it belongs in Cloudflare
  Workers Secrets (for CI use) or the owner's local 1Password-
  equivalent (for CLI use).
- Adding token-based automation to `scripts/rollback-worker.mjs`
  requires a fresh owner-named authorization and a regression test.

---

## Hard rule — automation does not bypass authorization

Even if the full token chain existed and `scripts/rollback-worker.mjs`
could execute rollbacks directly:

> Every rollback / restore action requires a fresh **named**
> authorization from the owner, specifying the surface (preview /
> prod / sandbox) and the target (SHA / timestamp).
> This script is a helper, not a shortcut around CLAUDE.md §5.

This applies to:

- Worker rollbacks via dashboard or future API.
- Supabase restores — in-place or to a new project.
- Credential rotations at the Cloudflare / `.env.local` layer (the
  provider-side rotation itself is pre-authorized under
  `docs/runbooks/secret-leak-response.md` because it does not touch
  repo or deployment state; everything downstream of the provider is
  owner-named).
- Any migration file commit, revert, or apply.
- Any history rewrite.

Session agents that encounter an incident and feel pressure to "just
fix it" should treat that pressure as a signal to STOP and ask — the
asymmetry between "took too long to ask" (minutes) and "destroyed an
audit trail" (unbounded) is what Constitution §3 was written to
enforce.

---

## Reporting contract

After any runbook is executed:

1. `docs/engineering/session-handoff.md` gets a new section with the
   full timeline, the owner authorization quoted verbatim, and the
   evidence captured (HTTP headers, dashboard screenshots refs, schema
   diffs, etc.).
2. If an HQ incident row exists, state transitions DETECTED →
   RECOVERY_ATTEMPTED via session agent. The owner moves
   RECOVERY_ATTEMPTED → VERIFIED_RESOLVED separately (per the
   2026-11-08 Remediation Phase 1 severity split).
3. `scripts/audit-log-build.mjs` is re-run so the unified
   `docs/engineering/audit-log.md` reflects the new state.
4. If a credential rotation occurred, no key values are written to any
   doc. The exposure window and the rotation timestamp are the fields
   that matter.

Completed actions, proposed actions, and unverified assumptions must
be clearly distinguished per CLAUDE.md §7.

---

## What is NOT in scope of this doctrine

- A production Worker runbook — there is no production Worker at seal
  time. When one exists, this doctrine will be forked.
- Database admin-grant restoration — grants are a separate
  authorization class (see `docs/runbooks/README.md`).
- Legal / regulatory disclosure processes after a secret leak — owner
  decision, not a runbook step.
- Automated test coverage of these runbooks — the runbooks are
  human-executed. The two scripts do have failure-safe defaults
  (READ-ONLY by default · exit 0 for missing sources) that are the
  closest analogue to test coverage.
- Any change to `package.json` — this doctrine ships without adding
  scripts to `package.json`. Operators invoke the scripts directly via
  `node scripts/<name>.mjs`.

---

## Index of this doctrine's files

- `docs/runbooks/README.md`
- `docs/runbooks/worker-rollback.md`
- `docs/runbooks/db-restore.md`
- `docs/runbooks/secret-leak-response.md`
- `scripts/rollback-worker.mjs`
- `scripts/audit-log-build.mjs`
- `docs/doctrine/operational-safety-2026-11-23.md` (this file)

No existing files were edited. No commits were made. No deployment
state changed. No DB state changed.
