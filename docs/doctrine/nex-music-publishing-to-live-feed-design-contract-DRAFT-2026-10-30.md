# NEX Recorded-Music Publishing to Live Feed · Design Contract

**Status:** DRAFT · design direction only · no implementation authorised
**Issued:** 2026-10-30 by Philip (owner)
**Scope:** The music preview page's **Live** button → publishes the previewed recorded music as the creator's **active Music slot** in the shared NEX Live Feed. Camera-based broadcasting at `/nex-native/live-commerce/enter-broadcast-room` remains a **separate, unchanged** feature.
**Parent standards:**
- `docs/doctrine/nex-world-class-mobile-engineering-standard-2026-10-30.md`
- `docs/doctrine/nex-universal-image-display-integrity-2026-10-30.md`
- Sealed Live R9 Eligibility Contract 2026-10-27
- Sealed Main Feed Constitution 2026-10-30
- Sealed D1 public-listening (DRAFT, not authorised)

**Current wiring (fact):** `_preview-client.tsx:193-201` already navigates `router.push("/nex-native/live-commerce/feed")`. The feed cannot render music today because the feed reader (`feed/page.tsx:105-107`) only queries `nex_live_session`. This document specifies the primitives, authorization, and plan needed to close that gap.

---

## 1 · Active Music-slot semantics and atomic replacement

### 1.1 Primitive (D1 preferred, Option B)

A new table `nex_creator_active_music` with:

| Column | Type | Constraint | Role |
|---|---|---|---|
| `owner_account_id` | `uuid` | PRIMARY KEY, FK → `nex_account(id)` ON DELETE CASCADE | one row per creator; uniqueness by construction |
| `track_id` | `uuid` | NOT NULL, FK → `nex_music_track(id)` ON DELETE SET NULL | the currently active track; nulls when track is removed |
| `published_at` | `timestamptz` | NOT NULL DEFAULT `now()` | when this slot was last written |
| `published_as_mode` | `text` | NOT NULL, CHECK IN (`cover_audio`, `music_video`) | playback kind: still-image+audio OR music-video+audio |
| `rights_declaration_frozen` | `text` | NOT NULL, CHECK IN (`owner_content`, `licensed`, `public_domain`) | snapshot of rights at publish-time; immutable within this row |
| `unpublished_at` | `timestamptz` | NULL | soft-unpublish timestamp; non-null rows are not read |

**Why Option B:** uniqueness is a table property (owner_account_id is PK), not a partial index on `nex_music_track`. Replace semantics become `UPDATE … SET track_id = $new WHERE owner_account_id = $self`. Concurrent publish-attempts collide on the PK, not on an index. Cleaner than Option A, atomic by construction.

### 1.2 Required semantics (owner-sealed)

1. **Exactly one active Music post per creator.** PK on `owner_account_id` enforces this.
2. **Replace never deletes.** The `nex_music_track` row and all media objects remain untouched. The library listing continues to show the previous song. Only the pointer in `nex_creator_active_music` changes.
3. **Independence from Video / Shop slots.** This table is specific to music; a future Video slot primitive is a parallel table (`nex_creator_active_video`); Shop uses `nex_business` as today. Nothing in this design mutates those tables.
4. **Atomic publish.** Server action wraps the entire publish in a single transaction: validate → upsert `nex_creator_active_music(owner_account_id, track_id, …)` → set `nex_music_track.visibility = 'shared_live'` if not already → commit. Any failure rolls back the whole thing; no partial state.
5. **Concurrent publishes resolve to one winner.** Because the PK is `owner_account_id`, two simultaneous publishes become one UPDATE and one INSERT-conflict-DO-UPDATE; the later `published_at` wins. No duplicate active rows possible.
6. **Unpublish leaves the slot empty.** When owner explicitly unpublishes (or removes the track, or revokes rights), the row's `unpublished_at` is set and feed readers skip it. The library row remains. **No automatic resurfacing** of an older track — the slot stays empty until the owner publishes again.
7. **Track-removal cascade.** If `nex_music_track.visibility = 'removed'` or the row is deleted, the FK `ON DELETE SET NULL` nulls the pointer and feed readers treat it as empty.
8. **Rights snapshot.** `rights_declaration_frozen` is a snapshot at publish time. Changing the track's `rights_declaration` later does NOT retroactively alter published-slot rights; a re-publish is required.

### 1.3 Out of scope

- Multi-slot per creator (e.g. "Top 3 songs"). Out of scope.
- Scheduled publishing (publish at future time). Out of scope.
- Social re-posting / amplification. Out of scope.

---

## 2 · Public listening and publication authorization (D2)

### 2.1 Library-visibility vs active-publication distinction

- **Library visibility** (`nex_music_track.visibility`): `private` | `shared_live` | `removed`. This is a creator-local flag for which tracks appear in that creator's own library UI, which tracks sync to connected devices, etc. **`shared_live` by itself does NOT make a track playable to non-owners.**
- **Active publication** (`nex_creator_active_music.track_id`): the single track currently on the shared feed. **This is the ONLY mechanism that makes a track playable to non-owner viewers.**

A track can be `shared_live` in the library and NOT be the active post → not playable to non-owners.
A track must be both (a) referenced by `nex_creator_active_music` AND (b) its track row have `visibility != 'removed'` AND (c) the slot row's `unpublished_at` IS NULL to be publicly playable.

### 2.2 Who can play an active published track

- **Any authenticated NEX account.** The feed is logged-in-only (consistent with `feed/page.tsx` today, which `resolveNexAppSessionFromContext`).
- **Anonymous viewers** are read-only on the feed metadata (consistent with the existing RLS for `nex_live_session`); audio access requires authentication so we can throttle, log, and revoke per-viewer.
- **Not public internet (no auth):** audio URLs are not reachable without a valid NEX session. This is the exact scope the sealed D1 doctrine authored, now bounded to active-slot tracks only.

### 2.3 How private and unpublished tracks remain inaccessible

Three independent gates — all three must pass before an audio URL is minted:

1. **Reader gate** — any music feed query is a JOIN of `nex_creator_active_music` × `nex_music_track`, filtered on `nex_creator_active_music.unpublished_at IS NULL` AND `nex_music_track.visibility != 'removed'`. A `private` library track is **never** reachable because no `nex_creator_active_music` row references it until the owner explicitly publishes.
2. **Signing gate** — the storage adapter learns a new mode: `getPublishedActiveMusicSignedReadUrl({ activeSlotId, viewerAccountId })`. It verifies the slot row exists + is live + has a valid track + the viewer is authenticated. It mints a 60-second signed URL for the audio reference only, scoped to that viewer's session. Private tracks have no slot row and therefore no code path can mint a URL for them.
3. **RLS gate** — RLS on `nex_creator_active_music` allows SELECT for any authenticated user, UPDATE / INSERT only when `owner_account_id = auth.uid()`. RLS on `nex_music_track` remains owner-only; feed reads go through the server-only service that `SELECT`s the specific columns needed (title, artist, cover_image_url, media_url) via `service_role` only after confirming the slot exists.

### 2.4 Signed-URL discipline

- **TTL:** 60 seconds. Short enough that leaked URLs expire before useful re-sharing, long enough for a single-track play.
- **Viewer identity bound:** signed-URL request requires `viewerAccountId`. The storage adapter logs the viewer binding on each mint for audit.
- **Cover + background image URLs:** separate signed URLs with the same 60s TTL. Rendered via `<NexImage>` once the Phase C-1 wrapper lands.
- **Audio URL:** never returned to the client unless the slot is active and valid. The feed server component mints at render time; the client never calls the signing API directly.
- **No long-lived caching headers:** `Cache-Control: private, max-age=0, no-store` on the audio response so viewer-A's signed URL isn't shared with viewer-B via a shared cache.

### 2.5 How removed / revoked publication / revoked rights are blocked

- **Owner unpublish** → sets `unpublished_at = now()` on the slot row. Reader filters it out. No audio URL minted.
- **Track removed** (`nex_music_track.visibility = 'removed'`) → FK + reader filter + signing gate all independently reject.
- **Track deleted** → FK `ON DELETE SET NULL` leaves slot with `track_id = NULL`; reader filters it out.
- **Rights revoked** → owner changes `nex_music_track.rights_declaration` to a value incompatible with the slot's `rights_declaration_frozen`. Reader surfaces a mismatch; signing gate refuses to mint. (Owner alerted via a dashboard notice; no automatic re-publish.)
- **Admin takedown** → service_role sets `nex_music_track.visibility = 'removed'`. Slot row preserved for audit; feed does not render.

### 2.6 How owner authorization is enforced on publish / unpublish

- All writes to `nex_creator_active_music` go through server actions that call `resolveSessionWithDevOverride()`.
- `owner_account_id` in the write MUST equal `session.account.id`. Any mismatch returns `{ ok: false, code: "not-authorized" }`.
- No service_role writes to this table except for the audit cleanup path.
- Rate-limit the publish action: minimum 10 seconds between publishes per owner, to prevent accidental double-tap or spam.

### 2.7 How feed data avoids exposing private track metadata or media URLs

- The `MusicFeedEntry` type (public interface shipped to the client) contains ONLY: `activeSlotId`, `ownerAccountId`, `ownerDisplayName`, `ownerAvatarUrl`, `title`, `artist`, `coverSignedUrl` (60s), `backgroundSignedUrl` (60s, optional), `audioSignedUrl` (60s), `publishedAtMs`, `likeCount`, `shareCount`.
- Fields NOT exposed: internal track UUID, library visibility, raw storage reference (`fs://…`), rights_declaration, byte_size, mime_type, source_type, created_at, updated_at, removed_at, business_id (unless owner opts in future).
- The feed server component is the only code path that joins these tables. No RLS policy exposes `nex_music_track` to anon.

### 2.8 How rights_declaration is used — and what it does NOT prove

- `rights_declaration` is **owner self-attestation**, not NEX validation. We trust-but-record.
- Published slots freeze the declared value in `rights_declaration_frozen` so a later change doesn't rewrite history.
- Publishing requires `rights_declaration IN ('owner_content', 'licensed', 'public_domain')`. Rejecting on any other value is a server-side invariant.
- This does **not** constitute copyright clearance, mechanical licensing, PRO reporting, or ISRC registration. Those remain owner responsibility. NEX surfaces a short "You confirm you have the right to publish this track" acknowledgement on first publish per account (one-time dialog, acceptance stored on `nex_account`).

---

## 3 · Feed reader and music-card architecture

### 3.1 Reader

- New file: `src/lib/nex-native/music/active-music-feed-reader.ts`.
- One exported server function: `listActiveMusicFeedEntries({ limit, nowMs, viewerAccountId })`.
- Reads `nex_creator_active_music` × `nex_music_track` × `nex_account` × (optional) `nex_business` for the display-name hydration.
- Filters: `unpublished_at IS NULL` AND `track_id IS NOT NULL` AND `visibility != 'removed'`.
- Returns `readonly MusicFeedEntry[]` with signed URLs already minted.
- Fail-open: a single mint failure skips that entry; the feed still renders the rest.

### 3.2 Feed composition

- `feed/page.tsx` composes three readers today (live sessions, uploaded videos, music to be added):
  - `listOpenSessionsPublic` → live broadcasts (existing).
  - `listPublishedUploadedVideos` → portrait seller videos (existing).
  - `listActiveMusicFeedEntries` → new, this contract.
- Interleaving order is a **separate owner decision** — not in this contract. Default pending that decision: show live broadcasts first (they decay), then music, then uploaded videos.

### 3.3 Music feed card

- New component: `src/components/nex-native/live-commerce/MusicFeedCard.tsx`.
- Two render modes based on `published_as_mode`:
  - **`cover_audio`:** full-bleed cover image + `<audio>` element + title/artist overlay + action stack (like / share / message / view library).
  - **`music_video`:** `<video>` element with the attached music-video and its audio track; same overlay.
- Universal Image Display Integrity doctrine 2026-10-30 governs the cover; the music-background exception §3.1a applies if a background image is attached (consistent with the music preview page).
- Owner identity on the card: the creator's `ownerDisplayName` + `ownerAvatarUrl` + sealed presence rim (`feedback_nex_avatar_presence_rim_not_dot.md`) — never a bottom-right dot.

### 3.4 Discovery into the creator's library

- Tapping the cover opens the existing `MusicLibraryOverlay` (sealed 2026-10-30), with the active track pre-selected.
- Playback continues; the overlay does not stop the feed card's audio.
- Overlay footer composer (close/share/message) remains intact.

---

## 4 · Preview-page Live-button behavior and honest error states

### 4.1 Flow

1. User taps **Live** on the preview page.
2. Button flips to pending state ("Publishing…"), `disabled`, `cursor: wait`.
3. Client calls new server action `publishMusicAsActivePostAction({ trackId })`.
4. Action validates — in order, failing fast:
   a. Session resolves (`resolveSessionWithDevOverride`).
   b. Track row exists.
   c. `track.owner_account_id === session.account.id`.
   d. `track.visibility !== 'removed'`.
   e. `track.rights_declaration IN ('owner_content', 'licensed', 'public_domain')`.
   f. Account has accepted the rights acknowledgement once (`nex_account.music_publishing_acknowledged_at` IS NOT NULL) — if not, action returns a specific code that triggers an acknowledgement modal on the client.
   g. If a music video is attached, the video reference resolves.
   h. Rate-limit: no publish from this owner within the last 10 seconds.
5. Action opens a transaction:
   - `UPSERT nex_creator_active_music … ON CONFLICT (owner_account_id) DO UPDATE`.
   - `UPDATE nex_music_track SET visibility = 'shared_live' WHERE id = $trackId AND owner_account_id = $self AND visibility = 'private'`.
   - COMMIT.
6. Return `{ ok: true, data: { activeSlotId, trackId } }`.

### 4.2 Honest error states on the button

The button never falsely claims success. On `!ok`, each code maps to visible copy:

| Code | Visible message |
|---|---|
| `not-signed-in` | "Sign in to publish" (opens sign-in) |
| `not-authorized` | "You don't own this track" |
| `track-removed` | "This track was removed — can't publish" |
| `rights-invalid` | "This track isn't marked publishable" |
| `rights-ack-required` | opens the one-time acknowledgement modal |
| `rate-limited` | "Please wait a moment before publishing again" |
| `conflict` | "Another publish is in flight — please try again" |
| `storage-unreachable` | "Couldn't reach storage — please try again" |
| other | "Couldn't publish — tap to retry" |

### 4.3 Success feedback

- Button flips to "✓ Published" for 1200 ms, then `router.push("/nex-native/live-commerce/feed?highlight=<activeSlotId>")`.
- On the feed, the viewer-side card is briefly tagged (e.g. subtle cyan glow for 2 seconds) to confirm the newly-published post is visible.

### 4.4 No camera, no WebRTC

The flow never touches:
- `enter-broadcast-room/_go-live-client.tsx`
- `broadcast-engine.ts`
- `startLiveSessionAction`
- Microphone / camera `getUserMedia`
- `nex_live_session` table

All of those remain the broadcast-room flow, untouched by this feature.

---

## 5 · Audio coordination, swipe priority, playback cleanup

### 5.1 Single-audio invariant

- Only ONE audio source plays at a time across the entire feed.
- A React context `MusicFeedAudioCoordinator` manages the active `<audio>` ref. When a new card becomes current, the coordinator pauses the outgoing card's audio before starting the new one.

### 5.2 Swipe priority

- A user swipe-to-next ALWAYS wins against auto-advance. If audio-ended fires at the same moment as a swipe gesture is in progress (pointer down + horizontal delta > 20px), the swipe destination wins; auto-advance is suppressed via a `navigationCommittedRef`-style guard (pattern already used by `_preview-client.tsx:652-661`).

### 5.3 Cleanup

- Leaving the feed (route change, back-button, overlay close) unmounts the audio coordinator, which pauses and nulls the active audio ref. No orphaned playback.
- Visibility change (`document.visibilitychange → hidden`): pause audio to respect iOS/Android audio-session rules; do not resume automatically on return.
- Interruption (`audio` element `error` event, network drop): pause, show inline retry on the card.

### 5.4 Save-Data honouring

- Reads `navigator.connection.saveData` and `effectiveType`.
- On `saveData === true` or `effectiveType ∈ { "2g", "slow-2g" }`: card renders cover + tap-to-play; no autoplay, no preload (`preload="none"`).
- On fast networks: current card `preload="auto"`; neighbours `preload="metadata"` max.

---

## 6 · Migration prerequisites, deployment order, rollback, holds

### 6.1 Migration inventory (unchanged by this contract)

| Migration | Status | Purpose | Required for this feature? |
|---|---|---|---|
| 219 | AUTHORED, NOT APPLIED | `nex_live_session` + `nex_live_featured_product` | **Yes, pre-existing** — the feed page already queries `nex_live_session`; music-publishing does not make this worse, but the feed cannot render in production until applied |
| 235 | AUTHORED, NOT APPLIED | `nex_music_track` | **Yes** — production has no music table today |
| 236 (hypothetical) | NOT DRAFTED | `nex_creator_active_music` | **Yes, new** — needed for Option B primitive |

### 6.2 Dependency order (if authorised separately in future)

Strict order to avoid broken intermediate state:

1. **Migration 219** applied first. Independent of music; required for feed page to run at all. (This is a pre-existing blocker, not caused by this contract.)
2. **Migration 235** applied second. Introduces `nex_music_track`.
3. **Migration 236** (new, to be drafted upon approval) applied third. Depends on 235 for the FK.
4. **Backfill** (optional): if existing dev-FS tracks need to be lifted to production, a separate seed script. Dev-FS data is NOT production-ready and must not be used as proof.
5. **Service deploy** gated on all three migrations being live. Deploy of music-feed reader without the active-slot table would 500 at render.

### 6.3 Rollback considerations

- Each migration must ship with an inverse `DOWN` block (235 already has one per its file comment).
- `nex_creator_active_music` is a pointer table — rolling back DROPs the pointer; the underlying `nex_music_track` rows and media are preserved. Safe.
- Rolling back 235 destroys all music track rows → data loss. Not safe unless preceded by export.
- Rolling back 219 destroys live-session rows → acceptable only if no sessions in flight.
- Rollback order: reverse of apply order (236 → 235 → 219).

### 6.4 Existing holds preserved

All sealed holds remain in force:

- Vault LOCKED · Package DRAFT · Service Principle DRAFT · Theme Commerce DRAFT · Pricing baseline · Phase A1 Accommodation · 3 unimplemented claims · Live R9 DRAFT · Community Notice security copy · pending-invite privacy · keypad universal · chat master layout · design tokens · NEX never handles payments · A-strict scope · Main Feed slot primitive DRAFT · D1 public listening DRAFT · Universal Image Display Integrity 2026-10-30 · Phase A1 · Watch listing E2E.
- This contract **narrows D1** from "all shared_live tracks public" to "only `nex_creator_active_music`-pointed tracks publicly playable to authenticated viewers." Owner approval required to lift the narrower D1.
- This contract **does NOT lift** the Main Feed slot primitive DRAFT — this is a parallel music-slot primitive, not the general Main Feed primitive.
- Migration 219 pre-existing blocker is **not resolved** by this contract and remains a separate decision.

### 6.5 Deployment safety

- Target repo: `C:/Users/Victus/nexapp` (confirmed).
- No commit, push, deploy under this contract.
- No production data change.
- No service account credential change.
- Vercel production-branch review before any schema-dependent change.

---

## 7 · Acceptance tests

### 7.1 Active-slot replacement

- **AT-1.1:** Hendra publishes Track A. Expect: `nex_creator_active_music` row exists for Hendra with `track_id = A`; `nex_music_track(A).visibility = 'shared_live'`. Feed shows A.
- **AT-1.2:** Hendra publishes Track B (while A is active). Expect: slot row updates to `track_id = B`; Track A row untouched; library still contains A. Feed shows B, not A.
- **AT-1.3:** Hendra unpublishes B. Expect: slot row's `unpublished_at` set; feed does not show any music card for Hendra; both A and B remain in library.
- **AT-1.4:** Concurrent publish of X and Y from two tabs. Expect: exactly one row with the later-committed `published_at`; the other publish returns `conflict`.

### 7.2 Library preservation

- **AT-2.1:** After AT-1.2, the library overlay for Hendra still lists both A and B.
- **AT-2.2:** After AT-1.3, library still contains A and B. Visibility of A and B is NOT altered by the unpublish.
- **AT-2.3:** Deleting Track A entirely via owner-visible action removes it from the library; if A was the active post, the slot's `track_id` becomes NULL and the feed stops showing a music card for Hendra. B is unaffected.

### 7.3 Access control

- **AT-3.1:** Non-owner viewer calls the feed → sees Hendra's active music card; `audioSignedUrl` plays. Expiry 60s respected.
- **AT-3.2:** Non-owner viewer attempts to construct a signed URL for a private Hendra track (one marked `visibility='private'`, not published) via any client path → rejected. No URL minted.
- **AT-3.3:** Anonymous (no session) viewer loads feed → sees Hendra's card metadata (title / artist / cover) but no audio URL. Play attempt opens sign-in.
- **AT-3.4:** Hendra revokes rights (changes `rights_declaration` on an active track) → the active post is auto-hidden on next feed render; no audio URL minted.
- **AT-3.5:** Admin takedown (`visibility='removed'` via service_role) → slot preserved for audit; feed does not render it.

### 7.4 Separation from WebRTC broadcasting

- **AT-4.1:** During the publish flow, no call to `getUserMedia` is made.
- **AT-4.2:** `nex_live_session` is never written by `publishMusicAsActivePostAction`.
- **AT-4.3:** `/nex-native/live-commerce/enter-broadcast-room` still loads and functions identically; Hendra can start a WebRTC broadcast separately from her active music post. Both can coexist on the feed.
- **AT-4.4:** `broadcast-engine.ts` is not imported by any new music-publishing code.

### 7.5 Playback coordination

- **AT-5.1:** Only one audio element has non-paused state at a time, across all mounted feed cards.
- **AT-5.2:** User swipes to next card while audio is playing → previous audio pauses within 100 ms, next audio starts (if autoplay allowed).
- **AT-5.3:** User presses browser back → audio stops on route change.
- **AT-5.4:** OS visibility change (`document.visibilityState === 'hidden'`) → audio pauses.
- **AT-5.5:** On Save-Data networks, no autoplay; tap-to-play works; neighbour preloads suppressed.

### 7.6 Honest error surface

- **AT-6.1:** Publish while offline → button shows "Couldn't reach storage" or equivalent; no false "✓ Published".
- **AT-6.2:** Publish without rights acknowledgement → modal fires; publishing does not proceed until acknowledged.
- **AT-6.3:** Publish of a `rights_declaration = NULL`-equivalent (hypothetical) → rejected with `rights-invalid`.
- **AT-6.4:** Rapid double-tap on Live → `busyRef` guard permits one publish; the other is a no-op.

---

## 8 · What this contract does NOT authorise

- Drafting Migration 236.
- Applying Migration 219 or 235.
- Any code change — including the `publishMusicAsActivePostAction` server action, the `active-music-feed-reader` service, the `MusicFeedCard`, or changes to `goLive`.
- Lifting any sealed hold beyond the narrowed D1 scope described above.
- Making all `shared_live` library tracks publicly playable.
- Modifying `nex_live_session`, the broadcast flow, or the Live R9 eligibility contract.
- Mobile app shell / native wrapper changes.
- Push notifications, email, or any outbound messaging as part of publish.

Implementation requires **separate explicit owner approval** per phase (M-1 primitive, M-2 server action, M-3 feed reader, M-4 feed card, M-5 preview-page rewire, M-6 tests + verification).

---

## 9 · Honest limitations of this contract

- Based on code inspection only. Not benchmarked on real devices.
- Rate-limit value (10 seconds) is a reasonable default, not benchmarked.
- Audio-coordination patterns reference the existing `_preview-client.tsx` navigation-guard idiom but have NOT been validated for all mobile audio-session interruption cases.
- RLS policies for `nex_creator_active_music` are specified at a semantic level; the exact SQL text is TBD at migration-draft time.
- Feed interleaving order is deliberately deferred to a separate owner decision.
- D2 as approved here NARROWS the broader sealed D1 doctrine but DOES NOT lift it in general. Any future "listen to any shared_live track" feature remains blocked by the broader D1 DRAFT.
- No pre-existing public playback test harness exists; test tooling needs to be stood up during M-6.

---

## 10 · Decision gate

**Owner decides, per phase, with no implementation permitted until each phase is approved:**

- **Gate M-1 (approve primitive)** — authorise drafting of Migration 236 for `nex_creator_active_music`. **Still blocked at this phase; no draft until approved.**
- **Gate M-2 (approve server action)** — authorise implementation of `publishMusicAsActivePostAction` once M-1 schema is applied.
- **Gate M-3 (approve feed reader)** — authorise `active-music-feed-reader.ts` service.
- **Gate M-4 (approve feed card)** — authorise `MusicFeedCard.tsx` + coordinator.
- **Gate M-5 (approve preview-page rewire)** — authorise `goLive` rewrite.
- **Gate M-6 (approve tests + release)** — authorise acceptance test harness; release to production after Migration 219 + 235 + 236 applied and verified.

Stopping here. No further action authorised under this contract.
