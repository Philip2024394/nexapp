# Runbook — Supabase database restore

**Sealed:** 2026-11-23
**Surfaces:**
- Sandbox: `kdstoyyeygcopkogqsyv`
- Prod:    `ijvqdvsvwtwxzcqmoqit` (sole database of record per CLAUDE.md §8)

**Trigger severity:** sandbox issue is usually SEV-2 · prod issue is
SEV-1 unless proven otherwise.

---

## Precondition — owner authorization

The owner must have issued a named authorization of the form:

> "restore `<project-ref>` from `<timestamp>`"

where `<project-ref>` is literally `kdstoyyeygcopkogqsyv` or
`ijvqdvsvwtwxzcqmoqit` and `<timestamp>` is an explicit UTC time at
least 5 minutes before the bad migration ran (see Step 3).

If the restore is to be **in place** (overwrites current state), a
**second named authorization** is required specifically naming
"in-place restore." The default and safer path is restore-to-new-project.

No step below is pre-authorized. CLAUDE.md §5 and the "Never do during
an incident" list are in force.

---

## Step 1 · Verify the project ref before touching anything

Never run restore operations against a project ref that has not been
explicitly named in the authorization. The convention used by
`scripts/apply-migration-290-production.mjs` and sibling scripts is:

```javascript
const ref = /* parsed from NEX_SUPABASE_URL */;
if (ref !== "ijvqdvsvwtwxzcqmoqit") {
  console.error(`STOP · unexpected ref ${ref} · this script targets production ijvqdvsvwtwxzcqmoqit only`);
  process.exit(1);
}
```

Before opening the Supabase dashboard, confirm by reading
`.env.local` and stating out loud: "I am about to operate on
`<project-ref>` which matches the owner's authorization quoting
`<project-ref>`." If these do not match, STOP.

Common mistake to avoid: the Supabase dashboard switches projects via
the top-left project picker — it is easy to click the wrong one.
Always re-check the URL bar (the project ref appears in it) after
navigating to Backups.

---

## Step 2 · Open the Supabase backups UI

1. Go to `https://supabase.com/dashboard/project/<project-ref>/database/backups`.
2. If Point-in-Time Recovery (PITR) is enabled on the project, use the
   PITR picker to choose an exact timestamp.
3. If PITR is NOT enabled, only the daily backup snapshots are
   available. Pick the latest snapshot that is still before the bad
   event.

At seal time:

- Sandbox (`kdstoyyeygcopkogqsyv`) — PITR status: unknown · confirm at
  incident time, do not assume.
- Prod (`ijvqdvsvwtwxzcqmoqit`) — PITR status: unknown · confirm at
  incident time.

If PITR is not enabled and the daily backup is older than 24 hours,
flag to the owner that restore granularity is coarse — the owner may
choose a different recovery strategy (manual data fix, forward-only
migration, etc.).

---

## Step 3 · Pick a timestamp at least 5 minutes before the bad migration

The 5-minute floor exists because:

- Supabase backup timestamps are approximate to the second but transit
  through multiple systems — a timestamp "exactly before" the bad
  migration can race.
- Migration scripts in this repo print their start time but the actual
  DB effect lags by seconds.
- An in-flight long transaction at the chosen timestamp can produce a
  surprising restored state.

The target timestamp must appear in the owner's authorization. If the
owner named a timestamp less than 5 minutes before the bad migration,
ask them to confirm with the 5-minute floor explained.

Cross-check the migration's start time by:

```bash
git log -1 --format="%ai" <migration-commit-sha>
```

and by reading any log the migration script printed.

---

## Step 4 · Restore to a new project (default · safer)

Supabase's **Restore to a new project** option creates a clean target
and leaves the current project untouched. Steps:

1. In the Backups UI, click **Restore**.
2. Choose **Restore to new project**.
3. Pick a project name like `<original>-restore-<yyyy-mm-dd>` (e.g.
   `ijvqdvsvwtwxzcqmoqit-restore-2026-11-23`).
4. Wait for the restore to complete. Supabase emails
   `asknexapp@gmail.com` when ready.
5. Record the new project's ref — it will be different from the
   original.

After the new project is ready:

- Do NOT point the application env vars at it. CLAUDE.md §8 seals
  `ijvqdvsvwtwxzcqmoqit` as the sole project of record. Using a
  restore project as the live backend is a separate owner-named
  decision, not implied by this runbook.
- Use the new project as a diff target to extract specific rows /
  tables / schema the owner authorizes importing back.

### Alternate — in-place restore (destructive)

ONLY if the owner has issued the **second** named authorization
explicitly saying "in-place restore `<project-ref>` from `<timestamp>`":

1. In the Backups UI, click **Restore**.
2. Choose **Restore in place** (or wording equivalent — Supabase's UI
   wording evolves).
3. Confirm the dialog.
4. The project is briefly unavailable; the application will error
   during restore.

This path is destructive because any writes between the restore
timestamp and "now" are lost. Never default to this path.

---

## Step 5 · Re-verify schema against snapshot

After the restore completes (either path), regenerate the schema
snapshot and diff against `docs/map/schema-snapshot.md`:

```bash
# Regenerate (adjust path if the generator script name is different —
# check scripts/ for the current snapshot script before running).
node scripts/<schema-snapshot-script>.mjs > /tmp/schema-after-restore.md
diff docs/map/schema-snapshot.md /tmp/schema-after-restore.md
```

Interpret the diff:

- Lines present in the committed snapshot but missing in the restored
  state = tables/columns that will be absent from the app's view
  until a forward-fix migration runs (with owner authorization).
- Lines in the restored state but missing from the committed snapshot
  = old schema shape that has since been migrated away from — expected
  if the bad migration was additive.

Attach the diff to the incident note. Do NOT silently commit a new
snapshot — the owner approves whether the restored state or the
original snapshot is "correct."

---

## Step 6 · Feature-ledger + session-handoff update

1. Update `docs/engineering/session-handoff.md` with:
   - The bad migration file (full path), its commit SHA, and the
     observed bad outcome.
   - The timestamp the restore reverted to.
   - Which path was used (new-project vs in-place).
   - Both owner authorizations (the first and, if applicable, the
     second for in-place) quoted verbatim.
   - The schema diff summary from Step 5.
2. Update `docs/product/feature-ledger.md` for any feature whose status
   is affected (CODE PRESENT (NOT VERIFIED) is the default after a
   restore; never downgrade VERIFIED → unknown, downgrade to NOT
   VERIFIED with evidence).
3. If an HQ incident row exists, move DETECTED → RECOVERY_ATTEMPTED.
   VERIFIED_RESOLVED is an owner move.

---

## Rolling back the migration **file** in the repo

**Never delete the migration file from the repo.** The file is the
audit trail — removing it makes future incident forensics harder and
can hide the fact that a bad migration ever shipped.

Instead, with a separate owner-named authorization, add a follow-up:

```
nex-supabase/migrations/NNN_revert_<original-migration-name>.sql
```

The revert migration:

- Has its own commit, its own authorization, its own apply script
  (`scripts/apply-migration-NNN-sandbox.mjs` and, only with a separate
  prod authorization, `scripts/apply-migration-NNN-production.mjs`).
- References the original by number and SHA in a top-of-file comment.
- Is forward-only — it does not pretend the bad migration never
  happened; it undoes the bad effects explicitly.

A restore (Step 4) is independent of the revert migration (this
section). Depending on how far back the restore reached, the revert
migration may be unnecessary. Decide with the owner.

---

## Explicitly NOT in scope for this runbook

- Application code rollback (see `worker-rollback.md`).
- Cross-project data migration (sandbox → prod or vice versa) — that is
  its own named authorization class.
- Edits to RLS policies as part of recovery — any RLS change is its
  own migration under its own authorization.
- Admin grant restoration — grants are a separate authorization class
  (see "Never do during an incident" in `README.md`).
