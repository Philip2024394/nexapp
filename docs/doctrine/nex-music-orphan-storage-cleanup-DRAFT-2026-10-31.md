# NEX Music · Orphan Storage Reference Cleanup · DRAFT 2026-10-31

**Status**: DRAFT · no code changed · no migration applied.

**Scope**: resolves [audit finding #2 · 2026-10-31](../../src/lib/nex-native/music/music-repository.ts) — when `storage.putObject()` succeeds but the DB-row `insertMusicTrackWithQuota()` fails (quota race, atomic rollback, process crash between the two), the uploaded audio/image bytes are left orphaned in Supabase Storage with no DB row referencing them. Over time this bloats the storage bucket and costs money for files no customer can access.

## The problem · precisely

Upload flow (post-#9 patch):

```
1. Validate inputs (session, mime, size, signature, duration probe)
2. storage.putObject(audio)  ─────► stores bytes · returns `media_url`
3. storage.putObject(cover)  ─────► stores bytes · returns `cover_image_url`
4. storage.putObject(background) ─► stores bytes · returns `background_image_url`
5. insertMusicTrackWithQuota(row + quota)
   └── if throws → best-effort delete 2/3/4 in catch block (upload/route.ts:325)
```

**Failure classes**:

- **A · best-effort rollback succeeds**: Catch block deletes 2/3/4 cleanly. No orphan. ✓
- **B · best-effort rollback partially fails**: Catch deletes audio but delete-cover throws (network, provider 500, deleted bucket). audio-gone, cover-left-behind orphan. ✗
- **C · process crash between put and insert**: Serverless container dies after step 2 before step 5. No catch runs. All 3 objects orphaned. ✗
- **D · signed-URL probe fails mid-upload**: Lambda timeout at step 3. Partial orphans. ✗
- **E · DB connection flake at step 5**: Insert throws before/during write. Catch may or may not survive the same flake. ~✗

Today only class A is clean.

## Proposed solution · dead-letter + GC

Two moving parts:

### 1. `nex_music_orphan_candidate` table

```sql
CREATE TABLE public.nex_music_orphan_candidate (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reference      text        NOT NULL,       -- fs://... or sb://...
  owner_account_id uuid      NOT NULL,
  kind           text        NOT NULL CHECK (kind IN ('audio','cover','background')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  attempted_delete_at timestamptz NULL,
  deleted_at     timestamptz NULL,
  attempts       int         NOT NULL DEFAULT 0,
  last_error     text        NULL
);
CREATE INDEX idx_orphan_pending ON public.nex_music_orphan_candidate (created_at) WHERE deleted_at IS NULL;
```

Written at these moments:
- Upload-route catch block records every orphan reference (classes A/B/C handled uniformly — catch-all records, deletion runs best-effort inline, failures survive in the table).
- A periodic reconciler (Vercel Cron, Supabase pg_cron, or GitHub Actions schedule) sweeps rows older than N minutes, retries `storage.deleteObject()`, marks `deleted_at` on success.

### 2. Reconciler cadence

- **Frequency**: every 15 min (matches sealed memory recommendation for H5-style dedup cleanup · tunable post-M-1)
- **Batch size**: 50 rows / tick (bounds work per invocation)
- **Retry policy**: exponential by `attempts` column (1min, 2, 4, 8, 16, max 24h). After `attempts > 20` give up and mark `deleted_at = now()` + leave `last_error` populated for ops review.
- **Blast radius**: hard-filter on `kind IN ('audio','cover','background')` so a misrouted entry can never target non-music storage.

## Open decisions · needs owner input

| # | Decision | Options | Recommendation |
|---|---|---|---|
| O-1 | Should orphans be deleted immediately in the catch block + ALSO recorded, or recorded-only (reconciler deletes)? | A · both (double safety · double traffic in happy path) · B · record-only (reconciler is single path · bigger storage footprint until next tick) | **A** — matches current behaviour, record is defence-in-depth |
| O-2 | Where does the reconciler run? | A · Vercel Cron hitting a protected endpoint · B · Supabase `pg_cron` extension calling a SECURITY DEFINER function · C · external worker (GitHub Actions / Fly / Render) | **B** — least moving parts, keeps secret-free env |
| O-3 | Retention of `deleted_at` rows (audit trail)? | A · delete immediately · B · 30 days · C · forever | **B** · 30 days matches sealed H4 (operational log retention · 30-day recommendation) |
| O-4 | Should the reconciler also delete storage objects that have NO orphan-candidate row but ALSO no `nex_music_track.media_url` referencing them? (i.e. storage-vs-DB diff) | A · yes (full GC) · B · no (orphan-table-only) | **B** · a full GC is dangerous — a mid-upload race could delete a live file. Add a separate GC under its own authorisation when the system is stable. |
| O-5 | Scope creep · same pattern applicable to `nex_uploaded_video`, `nex_product_media`, `nex_business_media`. Build generic? | A · music-only now, generalise later · B · universal `nex_storage_orphan` table from day one | **A** — ship narrow, prove, generalise. The universal table is a seductive YAGNI. |

## Non-decisions · what this doc explicitly does NOT change

- Does NOT alter the sealed `nex_music_track` schema (Migration 235).
- Does NOT change the `MusicMediaStorage` interface or either adapter.
- Does NOT touch the sealed publish pipeline (Migration 236).
- Does NOT grant any additional service_role writes beyond what's already present.
- Does NOT propose a universal GC — strictly orphan-reference-driven.

## Dependency sequence

1. Owner authors O-1 through O-5 decisions.
2. Draft Migration 241 (table + index + policies + grants).
3. Draft reconciler function (SECURITY DEFINER if going with O-2 Option B).
4. Patch `upload/route.ts` catch block to record orphans before firing the best-effort delete.
5. Wire reconciler schedule (pg_cron or Vercel Cron per O-2).
6. V-item verification before enabling in prod (does the reconciler actually drop bytes · does retention honour O-3).

## Blockers

- O-2 selection drives migration 241's shape (SECURITY DEFINER function or not).
- H2 (production storage adapter) still unsealed · deletion semantics depend on which provider actually holds the bytes.
- Decision owner: Philip.

---

*File created DRAFT 2026-10-31. Promote to doctrine (strip DRAFT) only after owner locks O-1..O-5 and migration 241 is drafted.*
