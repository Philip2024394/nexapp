# PITR rehearsal plan · sandbox-only restore drill

**Author:** Stream C · 2026-11-16
**Scope:** Document-only. Procedure for the owner to execute. No prod touch.
**Related:** `docs/doctrine/backup-restore-readiness-2026-11-08.md` (if exists)

---

## Purpose

PITR (Point-in-Time Recovery) is Supabase's continuous backup
feature on paid tiers. The sealed world-class safety programme
(2026-11-08) requires a documented, rehearsed restore procedure
before v1 ship.

This document is the **sandbox-only** rehearsal plan. It MUST be
executed against the sandbox project `kdstoyyeygcopkogqsyv` and
MUST NOT touch production `ijvqdvsvwtwxzcqmoqit`.

A successful sandbox rehearsal is a precondition for trusting PITR
as a prod disaster-recovery lever. The rehearsal validates:

1. Supabase support's PITR UI works and the owner can reach it.
2. The restore completes within an acceptable window (document
   actual time to restore).
3. The restored state is queryable and schema matches the
   pre-event snapshot.
4. Downstream app code (nexapp) can connect to the restored DB
   without additional env changes.

---

## Preconditions

- Owner has admin on the sandbox Supabase project.
- Sandbox is currently HEALTHY (migrations 290-348 applied per
  prior stream work · verify at start).
- The sandbox is NOT currently serving any live traffic that
  cannot tolerate a short unavailable window.
- Dev `.env.local` currently points at the sandbox (per sealed
  2026-11-10 memo b). Owner can tolerate the local dev-server
  being offline for 30-60 minutes during the drill.
- PITR is enabled on the sandbox tier (verify in Supabase
  dashboard first — free tier does NOT have PITR, requires Pro+).

---

## Rehearsal procedure

### Step 0 · Baseline (BEFORE doing anything)

Capture the pre-rehearsal state so the post-restore comparison is
meaningful.

```sql
-- Run against sandbox kdstoyyeygcopkogqsyv (dashboard SQL editor):

-- Row counts for key tables:
SELECT 'nex_account'          AS tbl, count(*) FROM public.nex_account
UNION ALL
SELECT 'nex_business'          , count(*) FROM public.nex_business
UNION ALL
SELECT 'nex_peer_message'      , count(*) FROM public.nex_peer_message
UNION ALL
SELECT 'nex_peer_conversation' , count(*) FROM public.nex_peer_conversation
UNION ALL
SELECT 'nex_order'             , count(*) FROM public.nex_order
UNION ALL
SELECT 'nex_product'           , count(*) FROM public.nex_product;

-- Latest-applied migration marker (whatever your migration-ledger
-- table is — verify the actual name in nex-supabase/):
SELECT max(migration_number) FROM nex._migration_ledger;

-- Current server time (used as the PITR target later):
SELECT now() AS pre_drill_marker;
```

Save the output to `evidence/stream-c/pitr-rehearsal-baseline.txt`.

### Step 1 · Make a visible, reversible change

Insert a sentinel row that will be unambiguously identifiable
post-restore.

```sql
-- Still against sandbox:
INSERT INTO public.nex_account (
  id, nex_handle, display_name, created_at
) VALUES (
  gen_random_uuid(),
  'nex-pitr-sentinel-' || extract(epoch from now())::bigint,
  'PITR Drill Sentinel',
  now()
);

-- Record the sentinel handle:
SELECT nex_handle, created_at
FROM public.nex_account
WHERE nex_handle LIKE 'nex-pitr-sentinel-%'
ORDER BY created_at DESC
LIMIT 1;
```

Save the handle to the baseline file.

Record the EXACT timestamp of the INSERT. Convert to UTC. This is
the PITR target: we want to restore to a moment SHORTLY BEFORE this
insert, so the restored DB should NOT have the sentinel row.

### Step 2 · Initiate PITR restore in Supabase

1. Supabase dashboard → Project Settings → Database → Backups.
2. Locate "Point-in-Time Recovery".
3. Click "Restore" (or equivalent for the current Supabase UI
   version).
4. Pick a timestamp approximately 2 MINUTES BEFORE the Step 1
   timestamp. Pad for ingestion lag.
5. Confirm restore target is the SANDBOX project only.

Supabase typically performs PITR in one of two ways depending on
tier:

- **In-place restore (same project ref):** destructive overwrite ·
  nexapp code doesn't need env changes. This is what we want for
  the drill.
- **Side-car restore (new project ref):** creates a new project ·
  requires temporary `NEX_SUPABASE_URL` change · more complex.
  Note which path Supabase uses.

Record:

- Restore start time (UTC).
- Restore completion time (UTC).
- Supabase-provided restore UI text (screenshot).

### Step 3 · Verify restored state

```sql
-- Sentinel row MUST NOT exist (the restore target was before the insert):
SELECT count(*)
FROM public.nex_account
WHERE nex_handle LIKE 'nex-pitr-sentinel-%';
-- Expected: 0

-- Row counts should match baseline (within a small delta for any
-- other activity between baseline and sentinel insert):
SELECT 'nex_account' AS tbl, count(*) FROM public.nex_account
UNION ALL
SELECT 'nex_business', count(*) FROM public.nex_business;

-- Migration ledger should match baseline:
SELECT max(migration_number) FROM nex._migration_ledger;

-- Schema should match (sample):
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'nex_account'
ORDER BY ordinal_position;
```

If any assertion fails, STOP and investigate. Do NOT retry in a
rush — PITR drills exist to catch surprises.

### Step 4 · Confirm app connectivity

1. Local dev: `npm run dev` on port 3008.
2. Browse /nex-native — splash, redirect, no 500.
3. Try a trivial authenticated flow: sign in with a known test
   account (or Nex-99901 dev impersonation path).
4. Check Vercel runtime logs (sandbox-pointed preview if owner has
   one, or local console) for any connection errors.

Expected: app functions identically to pre-drill (minus the
sentinel row).

### Step 5 · Document the drill

Create `evidence/stream-c/pitr-rehearsal-<YYYY-MM-DD>.md` with:

```
# PITR Rehearsal · <date>

**Supabase project:** kdstoyyeygcopkogqsyv (SANDBOX)
**Target timestamp:** <UTC timestamp picked in Step 2>
**Restore mode:** in-place / side-car (circle one)
**Restore start:** <UTC>
**Restore end:**   <UTC>
**Duration:**      <minutes>

## Baseline counts
<paste Step 0 output>

## Sentinel
<handle inserted, timestamp>

## Post-restore counts
<paste Step 3 output>

## Assertions
- [ ] Sentinel absent
- [ ] Row counts match baseline
- [ ] Migration ledger unchanged
- [ ] Schema shape unchanged
- [ ] App connects and responds

## Issues observed
<any unexpected behaviour>

## Recommendations
<for next drill or for prod>
```

Commit the drill doc to the repo under evidence/.

---

## Frequency

- **First rehearsal:** before v1 ship. Mandatory.
- **Subsequent:** quarterly, OR after any migration batch that
  changes RLS / grants / schema shape materially.

---

## Red flags · STOP conditions

- PITR UI not visible in Supabase dashboard (tier mismatch).
- Restore times out or errors out.
- Post-restore schema differs from pre-restore.
- Post-restore app connection fails with new auth error (JWT
  signing keys should roll with the DB on restore — verify).

Report each with evidence. Do NOT retry the drill repeatedly to
"make it work" — root-cause the issue first.

---

## Prod implications

A successful sandbox rehearsal DOES NOT authorise a prod PITR
restore. Prod PITR is a sealed destructive operation. The sealed
production rule (CLAUDE.md §5) applies: no prod DB write without
explicit owner authorisation naming the production ref
`ijvqdvsvwtwxzcqmoqit`.

What the sandbox rehearsal buys the team:

1. Confidence the Supabase UI works for the owner.
2. Known restore-duration figure for the prod SLA / RTO.
3. A known-good procedure document ready to execute against prod
   under separate authorisation when (not if) it is ever needed.

---

## What this document does NOT do

- Does not execute any restore.
- Does not touch production.
- Does not create backups outside Supabase's own PITR.
- Does not authorise any Vercel deploy or env change.
- Owner executes the drill when scheduled.
