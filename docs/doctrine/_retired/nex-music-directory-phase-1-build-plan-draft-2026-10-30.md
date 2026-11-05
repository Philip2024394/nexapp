# NEX Music Directory · Phase 1 Build Plan

> **DRAFT — FOR OWNER REVIEW — NOT AUTHORISED FOR IMPLEMENTATION**
>
> This is a build plan, not a code change. Nothing in this document is
> approved to build. Every migration shape, server-action signature,
> route, and UI component listed here requires separate explicit owner
> authorisation before any code is written.

**Author:** Master AI Engineer (Claude), on behalf of Philip O'Farrell (owner).
**Date:** 2026-10-30.
**Parent doctrine:**
`docs/doctrine/nex-music-directory-architecture-draft-2026-10-30.md`
(owner-accepted architectural direction 2026-10-30, §1.4).
**Companion doctrines (binding):**
- Portrait-First Screen and Media Constitution (concurrent, same file)
- Active-Slot Rotation Rule (concurrent, same file)
- `docs/doctrine/nex-music-upload-contract-DRAFT-2026-10-29.md`

---

## 1. Status and purpose

### 1.1 Status

This document is a **Phase 1 build plan draft**. It converts the
Phase 1 scope sketched at §10.1 of the parent architecture doctrine
into a concrete, implementation-ready plan **for review**. No build
is authorised by its existence.

### 1.2 Purpose

Define the exact shape of what Phase 1 of the Music Directory ships:

- Which migrations get drafted.
- Which server actions get written.
- Which routes get mounted.
- Which UI components get built.
- Which tests are mandatory.
- Which acceptance criteria must pass before Phase 1 is called done.
- Which items explicitly do NOT ship in Phase 1.

### 1.3 What Phase 1 ships

The owner-accepted scope at parent §10.1, restated as discrete
deliverables:

1. **Playlists** — creator-ordered reference lists of tracks.
   Private/public visibility (§12.1).
2. **Directory search** — Postgres full-text + trigram over
   `nex_music_track` title, artist, description, and uploader
   identity. Chronological trending surfaces (24h, 7d).
3. **Attribution + public-playlist context rendering** on every
   discovery result row, per sealed §2.3 and §2.7.
4. **Rights-eligibility filter** — only the four permitted
   `rights_declaration` values surface in the directory (§8.2).
5. **Takedown workflow states + server actions** per sealed §8.4,
   reusing Community Notice infrastructure where possible.

### 1.4 What Phase 1 explicitly does NOT ship

Everything in parent §10.2 onward (Phase 2–5) and specifically:

- `nex_music_track_save` (reference-based saves) — Phase 2.
- `nex_music_play` (per-event play ingestion) — Phase 2.
- Faceted upload metadata (genre, mood, instrument, language) —
  Phase 3.
- Collaborative filtering / personalised mixes / related tracks —
  Phase 4.
- Follow-triggered notifications / collaborative playlists /
  monetisation — Phase 5.
- Rotation rule implementation (migration + scheduled job + station
  toggle UI) — separate authorisation per the sealed Active-Slot
  Rotation Rule amendment.
- `nex_account_music_rights_ack` (rights-acknowledgement gate on
  publish) — a separate authorisation per the earlier readiness
  audit, now resolved to a future migration number ≥ next-free
  (see §3 Dependencies).

---

## 2. Scope boundary (strict)

- No change to the sealed `nex_music_upload-contract-DRAFT-2026-10-29`
  shape.
- No change to the sealed Portrait-First Constitution.
- No code implementation performed by this plan.
- No migration drafted or applied by this plan — the plan **specifies**
  the migrations; the owner **separately authorises** the drafting of
  each migration file.
- No change to the Follow commit chain. No renumbering.
- No modification of existing music/live-feed primitives except
  additive columns on `nex_music_track` for the search index.

---

## 3. Dependencies

### 3.1 Hard dependencies (must exist before Phase 1 code starts)

| Dependency | Current state | Phase 1 requirement |
|---|---|---|
| Migration 235 `nex_music_track` | Drafted on disk, application status not established | **Applied** to the target DB (sealed Supabase project `ijvqdvsvwtwxzcqmoqit`) before Phase 1 server actions can read tracks |
| Migration 236 `nex_music_active_slot_and_idempotency` | Drafted, not applied | **Applied** to the target DB before trending surfaces can read active slots |
| `nex_account` identity anchor (migration 001) | Applied in production | ✓ no action needed |
| Supabase service-role connection (via pooler) | Working for existing music/follow code | ✓ no action needed |
| Portrait-First Constitution | Owner-decided 2026-10-30 | ✓ binding on Phase 1 UI |
| Active-Slot Rotation Rule | Owner-decided 2026-10-30 | **Rotation is Phase 1-adjacent · the rotation implementation itself is NOT in Phase 1 but Phase 1 trending copy must honour the sealed "no fair-ranking copy" rule** |

### 3.2 Migration-number sequencing (resolved 2026-10-30)

Per the resolution recorded in parent §11.4, migration 237 is
permanently assigned to Follow (`nex_follow_graph`). The future
`nex_account_music_rights_ack` migration (deferred per the
music-publishing readiness audit) will take whatever number is
next-free at the time its build is authorised.

Phase 1 proposes **three new migration numbers**, chosen to minimise
collision risk. Final numbers are confirmed at the time each
migration is drafted:

- **239** · `nex_music_playlist` (one table, PK + CHECK constraints, RLS)
- **240** · `nex_music_playlist_track` (membership + ordering)
- **241** · `nex_music_track_search_index` (additive columns on
  `nex_music_track`: `search_tsv`, `description`, maintenance trigger,
  GIN index)

If the owner authorises `nex_account_music_rights_ack` before any
of 239–241 is applied, that migration takes 239 and Phase 1 shifts
to 240/241/242. This is a build-time check, not a doctrine amendment.

### 3.3 Soft dependencies

- Supabase project `ijvqdvsvwtwxzcqmoqit` must have `nex_account` and
  `nex_account_profile` seeded with real production rows (the dev-mock
  personas from `seed-dev-mock-accounts.mjs` are sufficient for
  testing but not production).
- The sealed takedown workflow states (§8.4 of parent doctrine) must
  share infrastructure with Community Notice. If that infrastructure
  does not yet exist, Phase 1 may ship a minimal music-only takedown
  queue · the sharing is an optimisation, not a precondition.

---

## 4. Migration specifications (shape proposals · not drafted)

### 4.1 Migration 239 · `nex_music_playlist`

```
CREATE TABLE nex_music_playlist (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account_id   uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  name               text NOT NULL,
  slug               text NOT NULL,
  visibility         text NOT NULL CHECK (visibility IN ('private','public')),
  cover_image_url    text,
  description        text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_account_id, slug)
);

CREATE INDEX idx_nex_music_playlist_owner_vis
  ON nex_music_playlist (owner_account_id, visibility);

CREATE INDEX idx_nex_music_playlist_public_updated
  ON nex_music_playlist (updated_at DESC)
  WHERE visibility = 'public';

ALTER TABLE nex_music_playlist ENABLE ROW LEVEL SECURITY;

-- SELECT · owners see all their own; everyone sees public.
-- INSERT · only self.
-- UPDATE · only owner.
-- DELETE · only owner.
```

### 4.2 Migration 240 · `nex_music_playlist_track`

```
CREATE TABLE nex_music_playlist_track (
  playlist_id   uuid NOT NULL REFERENCES nex_music_playlist(id) ON DELETE CASCADE,
  track_id      uuid NOT NULL REFERENCES nex_music_track(id) ON DELETE CASCADE,
  position      integer NOT NULL CHECK (position >= 0),
  added_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (playlist_id, track_id)
);

CREATE INDEX idx_nex_music_playlist_track_by_playlist
  ON nex_music_playlist_track (playlist_id, position);

CREATE INDEX idx_nex_music_playlist_track_by_track
  ON nex_music_playlist_track (track_id);

-- RLS: inherits playlist visibility semantics via server-side joins.
-- Direct table-level RLS allows reads only when the parent playlist is
-- public OR owned by auth.uid().
```

**Open verification item B-1** · The sealed sibling-feed arrow-cycle
reads `nex_music_track` directly. Phase 1 must verify that adding
`nex_music_playlist_track` does not change arrow-cycle behaviour on
the music viewer.

### 4.3 Migration 241 · `nex_music_track` search index

```
ALTER TABLE nex_music_track
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS search_tsv tsvector;

CREATE INDEX IF NOT EXISTS idx_nex_music_track_search_tsv
  ON nex_music_track USING GIN (search_tsv);

CREATE INDEX IF NOT EXISTS idx_nex_music_track_title_trgm
  ON nex_music_track USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_nex_music_track_artist_trgm
  ON nex_music_track USING GIN (artist gin_trgm_ops);

-- Requires `pg_trgm` extension. If not already installed, migration
-- 241 should include `CREATE EXTENSION IF NOT EXISTS pg_trgm;`.

CREATE OR REPLACE FUNCTION nex_music_track_search_tsv_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')),       'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.artist, '')),      'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_nex_music_track_search_tsv
  BEFORE INSERT OR UPDATE OF title, artist, description
  ON nex_music_track
  FOR EACH ROW EXECUTE FUNCTION nex_music_track_search_tsv_update();

-- Backfill existing rows:
UPDATE nex_music_track SET title = title;
```

**Open verification item V-TRK-1 (from parent §13.2) must be resolved
before this migration is drafted.** The exact current column set of
`nex_music_track` determines whether `description` already exists or
needs adding.

**Honest capacity note:** No benchmark data exists yet for this
Postgres FTS + trigram approach at scale. The sealed parent §6.2
forbids capacity claims without evidence. Benchmarking is V-SRCH-1
and must complete before Phase 1 is lock-sealed for scale claims.

### 4.4 Migrations NOT required by Phase 1

- No new table for saves (Phase 2).
- No play-event table (Phase 2).
- No faceted metadata columns (Phase 3).
- No rotation state (Rotation Rule amendment, separate).

---

## 5. Server-action specifications (signatures · not implemented)

All actions use the sealed `nex_music_result` discriminated-union
pattern used by existing music/follow server actions
(`{ ok: true, data } | { ok: false, code, message }`).

### 5.1 Playlist CRUD

```
createPlaylistAction(input: {
  name: string;
  visibility: 'private' | 'public';
  slug?: string;        // optional · derive from name if omitted
  coverImageUrl?: string;
  description?: string;
}): NexMusicResult<{ playlistId: string }>

renamePlaylistAction(input: {
  playlistId: string;
  name: string;
}): NexMusicResult<void>

setPlaylistVisibilityAction(input: {
  playlistId: string;
  visibility: 'private' | 'public';
}): NexMusicResult<void>

deletePlaylistAction(input: {
  playlistId: string;
}): NexMusicResult<void>
  // CASCADEs via FK · membership rows drop · tracks UNAFFECTED
```

### 5.2 Playlist membership

```
addTrackToPlaylistAction(input: {
  playlistId: string;
  trackId: string;
  position?: number;    // default: end of list
}): NexMusicResult<void>

removeTrackFromPlaylistAction(input: {
  playlistId: string;
  trackId: string;
}): NexMusicResult<void>
  // Does NOT delete the track from the owner's library

reorderPlaylistTracksAction(input: {
  playlistId: string;
  orderedTrackIds: string[];
}): NexMusicResult<void>
```

### 5.3 Directory search

```
searchDirectoryAction(input: {
  q: string;             // free-text query
  sort?: 'relevance' | 'newest';   // default: relevance
  limit?: number;        // default: 20, max 50
  cursor?: string;       // opaque pagination cursor
}): NexMusicResult<{
  results: DirectoryResultRow[];
  nextCursor: string | null;
}>

type DirectoryResultRow = {
  trackId: string;
  title: string;
  artist: string;
  coverSignedUrl: string | null;
  ownerAccountId: string;
  ownerDisplayName: string;
  ownerNexHandle: string | null;
  ownerAvatarUrl: string | null;
  rightsDeclaration: 'owner_content' | 'licensed' | 'public_domain' | 'royalty_free_attribution';
  publicPlaylistContext: {
    playlistId: string;
    playlistName: string;
    playlistSlug: string;
  } | null;
}
```

Server-side filters applied to every search call:
- `visibility = 'shared_live'` (not `private`, not `removed`)
- `rights_declaration IN ('owner_content', 'licensed', 'public_domain', 'royalty_free_attribution')`

### 5.4 Trending

```
getTrendingAction(input: {
  window: '24h' | '7d' | 'new';
  limit?: number;        // default: 20, max 50
}): NexMusicResult<{ results: DirectoryResultRow[] }>
```

- `24h` and `7d` rank by rolling play count on `nex_music_track.view_count`
  with a time filter.
- `new` ranks by publication timestamp descending (per V-TREND-1 in
  parent §13.2 — the exact timestamp axis is still open; the plan
  assumes `created_at` as a fallback).
- Trending excludes guest plays per parent §12.4 (not enforceable
  until Phase 2 play-event ingestion exists · Phase 1 "trending"
  uses existing counters as-is, with the honest caveat).

### 5.5 Takedown workflow (minimal · reuses Community Notice where possible)

```
reportTrackAction(input: {
  trackId: string;
  reasonCategory: 'copyright' | 'inappropriate' | 'spam' | 'other';
  explanation?: string;
}): NexMusicResult<{ reportId: string }>

reviewReportAction(input: {
  reportId: string;
  outcome: 'dismiss' | 'restrict' | 'remove';
  reviewerAccountId: string;    // Must be a NEX reviewer
}): NexMusicResult<void>

restoreTrackAction(input: {
  trackId: string;
  reviewerAccountId: string;
}): NexMusicResult<void>
```

**Open design item:** Report + review state tables. Either
`nex_music_track_report` (dedicated) or share with
`nex_community_notice_report` (if that primitive exists and matches).
Build-plan decision.

### 5.6 Server actions explicitly NOT in Phase 1

- `saveTrackAction` / `unsaveTrackAction` — Phase 2.
- `logPlayAction` — Phase 2.
- `listTracksByFacetAction` — Phase 3.
- `relatedTracksAction` — Phase 4.
- `rotateActiveSlotAction` / `setStationAction` — Rotation Rule
  implementation (separate authorisation).

---

## 6. Routes

| Route | SSR / Client | Purpose |
|---|---|---|
| `/nex-native/music/directory` | SSR | Directory search landing · search bar + trending surfaces |
| `/nex-native/music/directory?q=` | SSR | Search results page |
| `/nex-native/music/trending` | SSR | 24h / 7d / new trending surfaces (navigation chips) |
| `/nex-native/music/playlist/[playlistId]` | SSR | Public playlist page · track list with attribution |
| `/nex-native/music/playlist/new` | Client (owner-authenticated) | Create playlist UI |
| `/nex-native/music/playlist/[playlistId]/edit` | Client (owner-authenticated) | Rename · reorder · delete |
| `/nex-native/music/[ownerHandle]/playlists` | SSR | Public playlists owned by a specific creator |
| `/nex-native/music/report/[trackId]` | Client (any-authenticated) | File a report form |

All routes honour the sealed Portrait-First Constitution. No
rotation-based URL state (rotation is a per-creator primitive, not a
URL-visible state).

---

## 7. UI components

### 7.1 New components (proposed)

| Component | Location | Responsibility |
|---|---|---|
| `DirectorySearchBar` | `src/components/nex-native/music/directory/DirectorySearchBar.tsx` | Debounced trigram autocomplete · routes to `/music/directory?q=` |
| `DirectoryResultRow` | `src/components/nex-native/music/directory/DirectoryResultRow.tsx` | One row · attribution-first (title · uploader badge · public-playlist context · play affordance) |
| `TrendingWindowChips` | `src/components/nex-native/music/directory/TrendingWindowChips.tsx` | 24h / 7d / new navigation chips |
| `PlaylistTrackList` | `src/components/nex-native/music/playlist/PlaylistTrackList.tsx` | Ordered track list with drag-reorder in edit mode |
| `PlaylistCreateSheet` | `src/components/nex-native/music/playlist/PlaylistCreateSheet.tsx` | Modal · name + visibility toggle + optional cover |
| `PlaylistVisibilityToggle` | `src/components/nex-native/music/playlist/PlaylistVisibilityToggle.tsx` | Simple two-state switch (private/public) |
| `TrackReportSheet` | `src/components/nex-native/music/report/TrackReportSheet.tsx` | Reason category + optional explanation + submit |
| `AttributionBadge` | `src/components/nex-native/music/attribution/AttributionBadge.tsx` | Reusable uploader-identity chip (avatar + handle + display name · one-tap to profile) |

### 7.2 Modifications to existing components

| Component | Change |
|---|---|
| `_music-viewer-client.tsx` | Add "In @owner's playlist X →" context strip beneath the identity header when the current track is a member of a public playlist. Server resolves the best-single-fit playlist per sealed §2.7 and passes it as a prop. |
| `MusicPostShell.tsx` | No change required. The identity header already carries uploader attribution. The new playlist-context strip mounts separately. |

### 7.3 Design-token discipline

Every new component imports from `src/lib/nex-native/design-tokens`
(sealed design-token rule 2026-10-17). No per-component font-stack
or badge-size redeclarations.

---

## 8. Tests

### 8.1 Mandatory unit tests

| Test file | Coverage |
|---|---|
| `src/lib/nex-native/music/directory/__tests__/directory-repository.test.ts` | Query shape · rights-eligibility filter · visibility filter · trending window math |
| `src/lib/nex-native/music/playlist/__tests__/playlist-repository.test.ts` | CRUD · ordering · CASCADE semantics · UNIQUE slug per owner |
| `src/lib/nex-native/music/directory/__tests__/directory-actions.test.ts` | Error-code matrix · guest-vs-authenticated · rate limits (reuse existing music rate-limit pattern) |
| `src/lib/nex-native/music/playlist/__tests__/playlist-actions.test.ts` | Ownership checks · visibility enforcement · CASCADE on delete · track-does-not-exist handling |
| `src/components/nex-native/music/directory/__tests__/DirectorySearchBar.test.tsx` | Shape + debounce · following sealed vitest convention (no jsdom · pure render) |
| `src/components/nex-native/music/directory/__tests__/DirectoryResultRow.test.tsx` | Prop shape · attribution rendering · public-playlist-context conditional |

### 8.2 Integration tests (env-gated, like `follow-concurrency.test.ts`)

`__tests__/music-directory-integration.test.ts` runs against a
disposable Postgres when `NEX_MUSIC_TEST_DATABASE_URL` is set to a
non-production URL (same safety-flag pattern as the Follow
disposable mode).

Covered scenarios:
- INSERT playlist · add tracks · reorder · delete-cascades-only-membership.
- Private playlist invisible to non-owner queries.
- Public playlist visible via directory search.
- Rights-ineligible track excluded from directory search.
- Removed-visibility track excluded from directory search.

### 8.3 E2E (Playwright · dev server)

Mirror the sealed `playwright.nex-feed-gate1-acceptance.config.ts`
pattern. One acceptance spec per route (§6). One visual-regression
spec confirming the Portrait-First Constitution renders every new
route inside the sealed portrait frame.

---

## 9. Acceptance criteria

Phase 1 is DONE when:

1. All three migrations (239–241 or their build-time-resolved numbers)
   are drafted, reviewed, and applied to the sealed Supabase project
   `ijvqdvsvwtwxzcqmoqit` via separately-authorised apply windows.
2. All server actions in §5 are implemented and have passing unit
   tests covering the sealed error-code matrix.
3. All routes in §6 are mounted and render inside the sealed
   Portrait-First Constitution frame.
4. All UI components in §7 are implemented and pass their vitest
   shape tests.
5. Integration test suite (§8.2) runs green against a disposable DB.
6. E2E suite (§8.3) runs green against the local dev server.
7. V-TRK-1, V-SRCH-1, V-TREND-1 (parent §13.2) have been answered;
   their answers are reflected in the shipped migrations and
   trending logic.
8. User-facing trending copy does NOT imply fair-ranking (per sealed
   Rotation Rule interaction note).
9. Takedown workflow (§5.5) is wired and has at least one
   end-to-end test (report → review → restrict → restore).
10. A separate owner-authored commit lifts the "Implementation is not
    authorised" status on parent §10.1 to "Shipped 2026-XX-XX".

---

## 10. Interaction with existing surfaces

### 10.1 Music feed viewer (`/nex-native/nex-feed/[videoId]`)

Phase 1 adds the "In @owner's playlist X →" context strip (§7.2).
No change to the swipe-feed pool, siblings, or active-slot logic.
Rotation Rule is a separate amendment and does NOT ship in Phase 1.

### 10.2 Music upload surface (`/nex-native/create/upload-music`)

Phase 1 does NOT change the sealed upload contract. The description
column added in migration 241 is populated via a new optional
textarea in the upload form, which is a separate build-plan amendment
to the upload contract.

### 10.3 Live-feed broadcast (`/nex-native/live-commerce/...`)

Zero coupling. Live is a separate primitive. The sealed R9 live
eligibility contract (2026-10-27) is unaffected.

### 10.4 Follow (shipped FE at commit b6db755 and earlier)

Phase 1 directory results render the uploader attribution badge, and
the FollowButton primitive (shipped) mounts on that badge for
non-owner viewers. No new Follow code is required by Phase 1.

### 10.5 Community Notice (sealed 2026-10-23)

Takedown workflow (§5.5) attempts to reuse Community Notice
infrastructure. If sharing is not feasible, Phase 1 ships a
music-only report queue · tracked as an open build-plan decision.

---

## 11. Open items + verification gates

### 11.1 From parent §13.2 (all still open)

| Code | Resolution before Phase 1 is lock-sealed |
|---|---|
| V-TRK-1 | Confirm current column set of `nex_music_track` |
| V-SRCH-1 | Benchmark Postgres FTS + trigram at representative row volumes |
| V-TREND-1 | Confirm authoritative "newest" timestamp axis |
| V-PRIV-1 | Confirm listener-data retention posture (**not** required for Phase 1 since Phase 1 does not ingest per-event plays) |
| V-RIGHTS-1 | Confirm whether licence-evidence columns already exist on `nex_music_track` |
| V-STORAGE-1 | Confirm Phase 1 position on dev-filesystem vs. Supabase Storage for media |

### 11.2 New open items introduced by this build plan

| Code | Item |
|---|---|
| B-1 | Verify adding `nex_music_playlist_track` does not change the music viewer's arrow-cycle behaviour |
| B-2 | Decide if `nex_music_track_report` is a dedicated table or shares with Community Notice |
| B-3 | Decide the best-single-fit public-playlist heuristic (per parent §13.1) |
| B-4 | Decide `description` column max length (if any) · 2000 chars default is a build-plan recommendation, not a sealed decision |
| B-5 | Decide if the search `simple` tsvector config is right · default-English `english` config may rank differently; parent doctrine makes no claim; benchmark both |

---

## 12. Implementation gates

Each stage below is its own authorisation moment. Do not treat the
acceptance of this build plan as authorisation for any of them.

1. **Migration drafting authorisation** — owner authorises drafting
   of migrations 239, 240, 241 (or their build-time-resolved
   numbers) as separate SQL files.
2. **Disposable DB apply authorisation** — owner provides a
   disposable DATABASE_URL · migrations apply · V-SRCH-1 benchmark
   runs against the disposable DB.
3. **Production DB apply authorisation** — owner explicitly
   authorises CLAUDE.md §5 production apply window for the sealed
   Supabase project.
4. **Server-action implementation authorisation** — owner authorises
   writing code for the actions in §5.
5. **UI implementation authorisation** — owner authorises writing
   code for the components in §7.
6. **E2E suite authorisation** — owner authorises writing + running
   the Playwright specs in §8.3.
7. **Acceptance sign-off** — owner reviews every §9 criterion against
   evidence and marks Phase 1 shipped.

**No stage above is authorised by the acceptance of this build plan.**

---

## 13. Decisions locked for this draft

This build plan locks nothing on its own. The sealed parent-doctrine
locks (§12.1–§12.7, Portrait-First Constitution, Active-Slot Rotation
Rule) remain in force unchanged. Items listed in §11 are explicitly
open and require answers before Phase 1 can be lock-sealed.

---

## 14. Deferred items (Phase 2+)

Full list in parent §10.2–§10.5. Reproduced here for ease of
cross-reference:

- Phase 2 · saves + listening history + per-event analytics
- Phase 3 · faceted metadata + faceted search
- Phase 4 · personalised discovery (collaborative filtering, Daily
  Mix, related tracks, explainability affordance)
- Phase 5 · notifications, collaborative playlists, monetisation

---

**End of document.**

> **DRAFT — FOR OWNER REVIEW — NOT AUTHORISED FOR IMPLEMENTATION**
