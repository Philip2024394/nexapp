<!--
  docs/doctrine/file-protection-2026-11-23.md — nexapp file-protection doctrine
  Purpose: describe the file-level protection layer (git hooks, CODEOWNERS,
           snapshot + safe-rm scripts) so future contributors understand
           what every piece does, how to run it, and how to opt out
           in a genuine emergency.
  Sealed : 2026-11-23
-->

# nexapp file protection · sealed 2026-11-23

This doctrine implements the owner's standing rule:

> No file or branch is lost or changed without Philip's explicit command.

It is a layered defence: git hooks catch mistakes before they commit or
push, CODEOWNERS captures them at review time on GitHub, and the
snapshot + safe-rm scripts make destructive local operations recoverable.

## Components

### 1 · `.githooks/pre-commit`

Runs on every `git commit`. It blocks a commit when:

- Any staged path matches `CLAUDE.md` or `.githooks/*` **and** the
  commit message does not contain a `[founder]` tag. Scripted
  installers can bypass this gate by setting `GIT_HOOKS_FOUNDER_OK=1`.
- Any staged file exceeds 10 MB.
- Any staged file is a `.env`, `.env.local`, `*.pem`, or `*.key` that
  is not already ignored by `.gitignore`.
- The staged diff contains an obviously-secret pattern: AWS access
  keys (`AKIA...`), Stripe live keys (`sk_live_...`), GitHub personal
  tokens (`ghp_...`), OpenAI project keys (`sk-proj-...`), PEM
  `BEGIN <PRIVATE> KEY` headers, or a Supabase JWT whose payload
  decodes to `"role":"service_role"`.

Failure prints the offending file and the specific rule, then exits 1.

### 2 · `.githooks/pre-push`

Runs on every `git push`. It blocks a push when:

- The remote URL is not `https://github.com/Philip2024394/nexapp.git`
  or `git@github.com:Philip2024394/nexapp.git`.
- Any ref under push is `refs/heads/main` and
  `NEX_ALLOW_MAIN_PUSH=yes` is not set.
- A ref is being deleted (local SHA is all zeros) and
  `NEX_ALLOW_FORCE_PUSH=yes` is not set.
- A ref is a non-fast-forward (force) push and
  `NEX_ALLOW_FORCE_PUSH=yes` is not set.

On success it prints a one-line confirmation of the remote, URL, and
branch so the operator can visually verify destination.

### 3 · `.githooks/commit-msg`

Runs after you type a commit message. Rules:

- Subject must match the Conventional Commits prefix
  `feat|fix|chore|docs|refactor|test|perf|build|ci|style|revert`
  with an optional `(scope)` and optional `!`, followed by `: `.
- Subject length ≤ 100 characters.
- `feat`, `fix`, and `perf` commits must have a non-empty body
  (blank line + at least one content line explaining WHY).

### 4 · `scripts/install-githooks.mjs`

One-shot installer. It sets `git config core.hooksPath .githooks`,
`chmod +x`'s every file in the hooks directory (ignored on Windows
filesystems where chmod is a no-op), and verifies the config took.
Idempotent — safe to run repeatedly. The caller is expected to wire
this into `package.json` as `npm run install-githooks`.

### 5 · `CODEOWNERS`

Root-level CODEOWNERS file. Default owner `@Philip2024394`. Sensitive
paths are listed again explicitly (CLAUDE.md, `.githooks/`, `.github/`,
CODEOWNERS itself, migration scripts, installer, snapshot script,
cwd-and-remote assertion, `nex-supabase/migrations/`,
`src/middleware.ts`, and `src/app/api/nex-native/version/route.ts`).
Pair with a GitHub branch-protection ruleset that requires
`CODEOWNERS` review to make this binding at merge time.

### 6 · `scripts/snapshot-before-destructive.mjs`

Takes a tarball snapshot of the working tree plus a JSON sidecar
recording HEAD SHA, branch, remote, reason, label, and file count.
Writes to `D:/nex-backups/nexapp-pre-op-YYYYMMDD-HHMMSSmmm-<label>.tar`,
falling back to `~/.nex-backups/` if `D:/nex-backups/` is not writable.
Excludes `node_modules`, `.next`, `.git`, `playwright-report*`,
`data/.manifest-backups`, `data/.recovery-*`, and any top-level entry
in `.gitignore`. Prints the full snapshot path on success.

Usage:

```bash
node scripts/snapshot-before-destructive.mjs --label manual "about to test migration rollback"
```

### 7 · `scripts/safe-rm.mjs`

Guarded replacement for `rm -rf`. It snapshots first, logs every call
to `docs/engineering/safe-rm-log.md`, and only then performs the
deletion via Node's `rmSync`. It refuses to operate outside the repo
root. Top-level targets `.git`, `nex-supabase`, `src`, `scripts`, and
`CLAUDE.md` require `NEX_CONFIRM_DANGEROUS_RM=yes-<top-segment>`.

Usage:

```bash
node scripts/safe-rm.mjs "clearing stale test artifacts" tmp/junk
```

## Running the installer

```bash
npm run install-githooks     # wired by the caller after this doctrine lands
```

Or directly:

```bash
node scripts/install-githooks.mjs
```

Verify it took:

```bash
git config --get core.hooksPath   # expect: .githooks
```

## Emergency opt-outs (and when to use them)

Every opt-out below is an env var scoped to a single invocation. Prefer
exporting it for exactly one command (`VAR=value git push ...`) rather
than setting it in your shell permanently.

| Scope                              | Escape hatch                               | When it is appropriate                               |
|------------------------------------|--------------------------------------------|------------------------------------------------------|
| pre-commit protected-path tag      | `GIT_HOOKS_FOUNDER_OK=1`                   | Only for `install-githooks` or owner-authored chores |
| pre-push to `main`                 | `NEX_ALLOW_MAIN_PUSH=yes`                  | Only with explicit owner "push to main" approval     |
| pre-push force / delete            | `NEX_ALLOW_FORCE_PUSH=yes`                 | Only with explicit owner approval, with reason       |
| safe-rm on dangerous root `<seg>`  | `NEX_CONFIRM_DANGEROUS_RM=yes-<seg>`       | Only with explicit owner approval, with reason       |

If you reach for any of these without an owner instruction, STOP.

## Who can edit `.githooks/*` and `CODEOWNERS`

Only the founder. The pre-commit hook enforces this by requiring a
`[founder]` tag in the commit message when any `CLAUDE.md` or
`.githooks/*` path is touched. CODEOWNERS routes any PR that modifies
`/.githooks/` or `/CODEOWNERS` to `@Philip2024394` automatically, and
a branch-protection ruleset should require CODEOWNERS approval.

## Testing the hooks

After installing, prove each gate fires:

1. **Oversized file:**

   ```bash
   head -c $((15 * 1024 * 1024)) /dev/urandom > big.bin
   git add big.bin
   git commit -m "chore: test big file"   # expect BLOCKED
   rm big.bin
   ```

2. **Main push:**

   ```bash
   git push origin HEAD:main              # expect BLOCKED
   ```

3. **Non-conventional commit:**

   ```bash
   echo "// noop" >> src/README.ts
   git add src/README.ts
   git commit -m "updated stuff"          # expect BLOCKED (bad prefix)
   git restore --staged src/README.ts
   git checkout -- src/README.ts
   ```

4. **Secret in diff:**

   ```bash
   echo 'const k = "AKIA<SIXTEEN_UPPER_HEX>";' > /tmp/leak.ts
   git add /tmp/leak.ts
   git commit -m "feat: test"             # expect BLOCKED
   git restore --staged /tmp/leak.ts
   rm /tmp/leak.ts
   ```

5. **safe-rm refusal on dangerous root:**

   ```bash
   node scripts/safe-rm.mjs "testing" src   # expect BLOCKED
   ```

Record the output of each test in
`docs/engineering/session-handoff.md` so later sessions can prove the
protection layer is still live.
