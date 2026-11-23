# Runbook — Worker rollback

**Sealed:** 2026-11-23
**Surface:** `nexapp-preview.nex-sandbox.workers.dev` (preview) · same
procedure applies to future production Worker when it exists.
**Trigger severity:** typically SEV-1 or SEV-2 — see
[`README.md`](./README.md).

---

## Precondition — owner authorization

Before any step below, the owner must have issued a named
authorization of the form:

> "roll back preview to `<7-char-sha>`"

for whatever target SHA has been identified. No step in this runbook
is pre-authorized. If the owner has not named the target SHA, STOP and
ask. CLAUDE.md §4–§5 and the "Never do during an incident" list in
`README.md` are still in force.

---

## Step 1 · Identify the currently deployed commit

The Worker exposes a version endpoint (sealed 2026-11-23, blueprint
entry §10.1.2 in CLAUDE.md).

```bash
curl -sI https://nexapp-preview.nex-sandbox.workers.dev/api/nex-native/version | grep -i "x-nex-commit-sha"
```

Or for the full body:

```bash
curl -s https://nexapp-preview.nex-sandbox.workers.dev/api/nex-native/version
```

Record the returned SHA. This is the "FROM" of the rollback. Paste it
into the incident note.

If the endpoint 404s or is unreachable, the Worker is more deeply
broken than a bad build — escalate to SEV-1, email the owner, and do
not attempt rollback yet.

---

## Step 2 · Identify the desired rollback target commit

The target must be a SHA that was previously deployed successfully.
Candidates:

- The commit immediately before the suspect commit (check
  `git log --oneline release-audit-v1-2026-11-14` for recent commits).
- The last "known good" entry in
  `docs/engineering/session-handoff.md`.
- The last activating commit noted in the memory index for push-to-deploy
  (e.g. `ddaf110f` was the push-to-deploy activating commit sealed
  2026-11-23).

Verify the SHA exists:

```bash
git cat-file -e <target-sha>^{commit} && echo OK
```

The target SHA must appear in the owner's named authorization. If the
authorization named a different SHA than what your investigation
surfaced, STOP and ask — do not substitute your preferred SHA.

---

## Step 3 · Execute the rollback via Cloudflare dashboard

This is the primary path. The Cloudflare API path is NOT available in
this project because the Wrangler OAuth token in use lacks
`workers_scripts:write` scope (noted in CLAUDE.md §10.1.2 for the
read-side `workers_scripts:read` gap; the write scope is equally
missing).

1. Open `https://dash.cloudflare.com/`.
2. Navigate: **Workers & Pages** → **nexapp-preview**.
3. Open the **Deployments** tab.
4. Find the deployment row whose commit SHA matches Step 2's target.
5. Click the row's overflow menu, then **Rollback to this version**.
6. Confirm the dialog.

Cloudflare's UI performs the rollback as an atomic re-point of the
preview route to the selected deployment's bundle.

---

## Step 4 · Verify the rollback landed

Re-run the version endpoint curl from Step 1:

```bash
curl -sI https://nexapp-preview.nex-sandbox.workers.dev/api/nex-native/version | grep -i "x-nex-commit-sha"
```

The `x-nex-commit-sha` header MUST now equal the Step 2 target SHA.

- If it does: rollback is verified at the HTTP layer. Continue to
  Step 5.
- If it does NOT: do not retry blindly. Capture the response, check the
  Cloudflare dashboard for a build error on the rollback itself, and
  email the owner with the mismatch before any further action.

Also spot-check at least one user-visible route (the homepage and the
specific surface that triggered the incident) in a browser to confirm
behavior matches the target SHA's expected state.

---

## Step 5 · Post-incident note

Update `docs/engineering/session-handoff.md` with a new section:

- Date/time of the rollback (UTC).
- FROM-SHA (Step 1), TO-SHA (Step 2).
- Named authorization quoted verbatim from the owner's message.
- Evidence: the pre- and post-rollback `x-nex-commit-sha` header
  values.
- Follow-up: the incident that triggered the rollback should have an
  HQ incident row; move it from DETECTED to RECOVERY_ATTEMPTED (the
  owner moves it to VERIFIED_RESOLVED separately).
- Remaining blockers: what still needs to happen (bug fix,
  reverification, ruleset update, etc.).

Also append an entry to `docs/engineering/rollback-log.md` using
`scripts/rollback-worker.mjs` with the `--confirm` flag omitted —
the script writes the log line idempotently and does NOT perform any
Cloudflare action.

---

## Alternate path — scripted intent logger

`scripts/rollback-worker.mjs` is a READ-ONLY helper. It:

- Prints the exact dashboard URL to click.
- Prints the exact `curl` commands that WOULD execute the rollback if a
  Cloudflare API token with `workers_scripts:write` scope existed.
- Appends an intent record to `docs/engineering/rollback-log.md`.

It does NOT call the Cloudflare API. It never has. The missing
`workers_scripts:write` scope on the current OAuth token is an owner-
level gap and is not papered over by this script.

Usage (requires owner-named authorization even to log intent):

```bash
node scripts/rollback-worker.mjs \
  --worker nexapp-preview \
  --to-sha <7-char-sha> \
  --reason "SEV-1 · payment intent misroute from <bad-sha>" \
  --confirm
```

Without `--confirm` the script prints the plan and exits without
writing to the log.

---

## Known trap — Workers Builds connected-branch mismatch

Per `docs/doctrine/perf-regression-enforcement-2026-11-23.md`, the
Cloudflare Workers Builds "connected branch" setting on
`nexapp-preview` can diverge from the repository state. Symptoms:

- A push to `release-audit-v1-2026-11-14` lands in GitHub but does NOT
  trigger a Worker build.
- A rollback via dashboard may appear to succeed but the next CI run
  deploys something the owner did not intend because Workers Builds is
  still wired to the wrong branch.

Before trusting that a rollback is "complete," verify in the Cloudflare
dashboard that **Workers & Pages → nexapp-preview → Settings → Builds →
Branch** matches `release-audit-v1-2026-11-14`. If it does not, the
rollback is inadvertent and incomplete — flag to the owner.

---

## Explicitly NOT in scope for this runbook

- Production Worker rollback (no production Worker exists at seal time;
  when it does, this runbook will be forked and the new copy must
  carry its own owner-named authorization).
- DNS changes.
- Secret rotation (see `secret-leak-response.md`).
- Database rollback (see `db-restore.md`).
- Any `git` operation against the repository — a Worker rollback is
  a deployment event, not a repository rewrite. The repository
  continues to carry the bad commit; a separate revert commit, under a
  separate named authorization, is the way to clean the repo state.
