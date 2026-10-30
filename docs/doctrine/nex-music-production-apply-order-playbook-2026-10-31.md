# NEX Music · Production Apply-Order Playbook · 2026-10-31

**Status**: DRAFT · no migration applied.

**Owner authorisation required for EACH numbered step below.** This playbook codifies the ONE correct order to turn the music system from "dev-FS scaffold" into "production-wired with real Supabase Storage". Deviations risk partial states that are hard to roll back once customer uploads exist.

Reads once · gets applied once per environment · do not improvise.

---

## Pre-flight · verify today's state (read-only · no mutation)

```sql
SELECT version
  FROM public.nex_migration_history
 WHERE version IN ('235','236','240','241')
 ORDER BY version;
-- Expected on 2026-10-31: zero rows.
```

```sql
SELECT id, public, file_size_limit
  FROM storage.buckets
 WHERE id = 'nex-music-media';
-- Expected on 2026-10-31: zero rows.
```

If any row returns, STOP. State is already partial — reconcile before proceeding.

---

## Gate 0 · Sealed-item locks required BEFORE any step runs

| ID | What | Where |
|---|---|---|
| H2 | Lock "production storage adapter = Supabase Storage" | sealed memory `project_nex_music_publishing_locks_sealed_2026_10_30.md` |
| G / D11-7 | Author real rights-ack terms text (not placeholder) | update `src/lib/nex-native/music/rights-ack.ts` CURRENT_TERMS_VERSION + RIGHTS_TERMS_PLACEHOLDER |
| B | Lock dev-impersonation publish policy (recommended reject) | sealed memory |

The code is review-ready in all three cases; the LOCK is the owner-only act.

---

## Step 1 · Apply Migration 235 (`nex_music_track`)

**File**: `nex-supabase/migrations/235_nex_music_track.sql`
**Status**: AUTHORED 2026-10-29 · not applied.
**Dependency**: `nex_account` already exists (yes, applied).
**Side effect**: Creates the canonical `nex_music_track` table. Does NOT touch storage, functions, or policies beyond standard RLS defaults.

### Pre-flight

```sql
SELECT 1 FROM information_schema.tables
 WHERE table_schema='public' AND table_name='nex_music_track';
-- Expect: zero rows.
```

### Apply

(Via `psql $DATABASE_URL -f nex-supabase/migrations/235_nex_music_track.sql`.)

### Verify

```sql
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='nex_music_track'
 ORDER BY ordinal_position;
-- Expect: ~24 columns matching the migration.

SELECT version FROM nex_migration_history WHERE version = '235';
-- Expect: one row.
```

### Rollback (if verification fails)

Documented in the migration's trailing `-- Rollback (manual)` block. Destructive once rows exist. **Only safe to roll back if `SELECT count(*) FROM nex_music_track = 0`.**

### Owner authorisation gate before Step 2

> "Step 1 verified. Apply Migration 236."

---

## Step 2 · Apply Migration 236 (`nex_creator_active_music` + idempotency + publish functions)

**File**: `nex-supabase/migrations/236_nex_music_active_slot_and_idempotency.sql`
**Status**: AUTHORED 2026-10-30 · not applied.
**Dependency**: Step 1.
**Encodes**: sealed locks A/C/D/E/F/R7-2 verbatim.

### Pre-flight

```sql
-- Must not already exist
SELECT 1 FROM information_schema.tables
 WHERE table_schema='public'
   AND table_name IN ('nex_creator_active_music','nex_music_publish_idempotency');

-- Required predecessor
SELECT version FROM nex_migration_history WHERE version = '235';
```

### Apply

```
psql $DATABASE_URL -f nex-supabase/migrations/236_nex_music_active_slot_and_idempotency.sql
```

### Verify

```sql
-- Two tables created
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public'
   AND table_name IN ('nex_creator_active_music','nex_music_publish_idempotency')
 ORDER BY table_name;
-- Expect: both rows.

-- Two SECURITY DEFINER functions
SELECT proname, prosecdef, proconfig
  FROM pg_proc
 WHERE proname IN ('nex_music_publish_as_active_slot',
                   'nex_music_publish_idempotency_cleanup');
-- Expect: both prosecdef=true, proconfig contains "search_path=public, pg_temp".

-- Explicit GRANT EXECUTE TO service_role (R7-2 lock)
SELECT p.proname, r.rolname, has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_execute
  FROM pg_proc p
  CROSS JOIN pg_roles r
 WHERE p.proname IN ('nex_music_publish_as_active_slot',
                     'nex_music_publish_idempotency_cleanup')
   AND r.rolname IN ('anon','authenticated','service_role');
-- Expect: service_role=true, anon/authenticated=false.

-- Option X · service_role REVOKEd from direct table writes
SELECT has_table_privilege('service_role', 'public.nex_creator_active_music', 'INSERT') AS can_insert,
       has_table_privilege('service_role', 'public.nex_creator_active_music', 'UPDATE') AS can_update,
       has_table_privilege('service_role', 'public.nex_creator_active_music', 'DELETE') AS can_delete;
-- Expect: all false (writes flow via SECURITY DEFINER funcs only).
```

### Rollback

Trailing block in the migration. Destructive once any publish happens.

### Owner authorisation gate before Step 3

> "Step 2 verified. Apply Migration 240."

---

## Step 3 · Apply Migration 240 (`nex_account_music_rights_ack`)

**File**: `nex-supabase/migrations/240_nex_account_music_rights_ack.sql`
**Status**: AUTHORED 2026-10-31 · not applied.
**Dependency**: Step 1 (references `nex_account`).
**Encodes**: sealed E1 (composite PK, no IP field).

### Pre-flight

```sql
SELECT 1 FROM information_schema.tables
 WHERE table_schema='public' AND table_name='nex_account_music_rights_ack';
-- Expect: zero rows.
```

### Apply

```
psql $DATABASE_URL -f nex-supabase/migrations/240_nex_account_music_rights_ack.sql
```

### Verify

```sql
-- Table + composite PK
SELECT c.column_name, c.data_type
  FROM information_schema.columns c
 WHERE c.table_schema='public' AND c.table_name='nex_account_music_rights_ack'
 ORDER BY ordinal_position;
-- Expect: account_id, terms_version, acknowledged_at.

-- RLS enabled
SELECT relname, relrowsecurity
  FROM pg_class WHERE relname='nex_account_music_rights_ack';
-- Expect: relrowsecurity=true.

-- Policies
SELECT polname, polcmd
  FROM pg_policy
 WHERE polrelid='public.nex_account_music_rights_ack'::regclass;
-- Expect: SELECT + INSERT policies, no UPDATE or DELETE.
```

### Owner authorisation gate before Step 4

> "Step 3 verified. H2 is sealed as Supabase Storage. Apply Migration 241."

---

## Step 4 · Apply Migration 241 (`nex-music-media` storage bucket + RLS)

**File**: `nex-supabase/migrations/241_nex_music_media_bucket.sql`
**Status**: AUTHORED 2026-10-31 · not applied.
**Dependency**: H2 sealed (sealed memory updated); Step 1 (RLS references `nex_account`).
**Encodes**: private bucket + owner-only SELECT RLS + service-role-only writes.

### Pre-flight

```sql
SELECT 1 FROM storage.buckets WHERE id = 'nex-music-media';
-- Expect: zero rows.
```

### Apply

```
psql $DATABASE_URL -f nex-supabase/migrations/241_nex_music_media_bucket.sql
```

### Verify

```sql
SELECT id, public, file_size_limit, allowed_mime_types
  FROM storage.buckets WHERE id = 'nex-music-media';
-- Expect: public=false, 20971520 bytes, 5 MIMEs.

SELECT polname, polcmd
  FROM pg_policy
 WHERE polrelid='storage.objects'::regclass
   AND polname='nex_music_media_select_own';
-- Expect: one row, polcmd=r (SELECT).
```

Then exercise the adapter end-to-end from a staging host (not production):

1. Set `NEX_MUSIC_STORAGE=supabase` on the staging env.
2. Upload a track via `/nex-native/create/upload-music` while signed-in as a mock persona.
3. Confirm `nex_music_track` row exists with `media_url` of shape `sb://{account_id}/audio-...`.
4. Confirm storage.objects row exists under `nex-music-media/{account_id}/audio-...`.
5. Confirm the preview page plays the audio via the signed-URL route.
6. Confirm a second account signed-in cannot `SELECT` the first account's storage.objects rows (RLS).

If any step fails, STOP + diagnose. Do NOT promote `NEX_MUSIC_STORAGE=supabase` to production.

### Owner authorisation gate before Step 5

> "Step 4 verified in staging. Promote `NEX_MUSIC_STORAGE=supabase` to Vercel production."

---

## Step 5 · Promote to Vercel production

### Pre-flight

- Vercel project pointing at `Philip2024394/nexapp` main branch (confirm via Vercel console, not inference).
- Current production env for `NEX_MUSIC_STORAGE` is unset or `dev-fs` (uploads currently throw loudly per `storage-adapter/index.ts` guard — this is intentional).
- All of Steps 1–4 verified against the sealed Supabase project `ijvqdvsvwtwxzcqmoqit`.
- G/D11-7 terms text authored and `CURRENT_TERMS_VERSION` updated in `src/lib/nex-native/music/rights-ack.ts`.

### Apply

Set Vercel env var:

```
NEX_MUSIC_STORAGE=supabase
```

Trigger a redeploy. On first customer upload, verify:
- No 500 from `getMusicStorageAdapter` throw.
- `sb://` references appear in the DB row.
- Signed URLs resolve.

### Rollback (fast)

Set `NEX_MUSIC_STORAGE=dev-fs` and redeploy — the adapter factory will THROW on prod with a clear message. Customers see an error page. Then investigate.

Rollback does NOT undo already-uploaded storage objects or `nex_music_track` rows — those stay. Customers can access existing tracks via signed URLs minted next time Supabase Storage is re-enabled. **This is a feature, not a bug** — the dead-letter path (audit #2) is designed around this.

### Owner authorisation gate before enabling publishing

Publishing (Live Feed) is a SEPARATE gate — Migration 236's `nex_music_publish_as_active_slot` function + the M-2 server action + sealed H1/H3/H4/H5 locks. This playbook ends at "customer can upload + play their own library". Publishing is Phase C.

---

## Rollback drill (owner-only · not an automated action)

Full rollback (nuclear option) in reverse order:

1. Unset `NEX_MUSIC_STORAGE` in Vercel.
2. Apply the rollback block of Migration 241 (drops bucket + policy).
3. Apply the rollback block of Migration 240 (drops rights-ack table).
4. Apply the rollback block of Migration 236 (drops both tables + functions + grants).
5. Apply the rollback block of Migration 235 (drops `nex_music_track`).

Steps 2–5 are destructive once customer uploads exist. The V8 verification (sealed memory 2026-10-30 · pg_dump + staging restore rehearsal for 219 + 235) covers this scenario and MUST be performed before executing in production.

---

## What this playbook does NOT cover

- Publishing to Live Feed (Phase C · M-2 through M-6).
- The orphan reconciler (sealed decisions O-1..O-5 · see `nex-music-orphan-storage-cleanup-DRAFT-2026-10-31.md`).
- Takedown workflow (sealed H3 · unsealed).
- Operational log retention (sealed H4 · unsealed).
- Rate-limit / abuse protection beyond the existing quota.
- Cross-account playlist / sharing semantics.
- Monetisation hooks (sealed · "NEX never handles payments").

Each is a separate authorised programme.

---

*Playbook created 2026-10-31. Promote to final doctrine (strip DRAFT) only after Step 4 is verified against staging.*
