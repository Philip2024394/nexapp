# NEX Music Directory · Architecture Doctrine

> **OWNER-ACCEPTED ARCHITECTURAL DIRECTION — 2026-10-30**
> **NOT AUTHORISED FOR IMPLEMENTATION**
>
> The seven decisions in §12 and the overall architectural direction
> described in this document are accepted by the owner as of 2026-10-30.
> No migrations, server actions, components, or routes described here
> are approved to build. Technical verification items in §13.2 remain
> open. Phase 1 requires separate explicit owner authorisation. See
> §1.4 for the dated acceptance entry.

**Author:** Master AI Engineer (Claude), on behalf of Philip O'Farrell (owner).
**Date:** 2026-10-30.
**Companion documents:**
`docs/doctrine/nex-music-upload-contract-DRAFT-2026-10-29.md`,
`docs/doctrine/nex-music-publishing-to-live-feed-design-contract-DRAFT-2026-10-30.md`,
`docs/doctrine/nex-music-publishing-integration-readiness-audit-2026-10-30.md`,
`docs/doctrine/nex-main-feed-public-music-listening-design-2026-10-30.md`.

---

## 1. Status and purpose

### 1.1 Status

This doctrine is an **owner-accepted architectural direction** as of
2026-10-30 (see §1.4 for the dated acceptance entry). It records:

- Owner decisions provided at drafting time (§12).
- Architectural principles to be preserved across all phases (§2).
- A phased build order (§10) with no implementation authorisation attached.
- Deferred decisions and implementation gates (§13).

It is not a build spec. It is not a database contract. It is a doctrine
proposal that must be converted into per-phase build plans, each
separately authorised.

### 1.2 Purpose

Define the architecture for a **global NEX Music directory** that
mirrors every user's publicly-visible music into a searchable discovery
surface while preserving creator attribution and the uploader's own
playlist context.

The directory is additive. It does not replace, consume, or restructure
any existing music table, upload surface, or live-feed primitive. Every
canonical track that already exists in `nex_music_track` continues to
belong to its original uploader; the directory is a projection, not a
new source of truth.

### 1.3 Scope boundaries

- **In scope:** canonical track discoverability, playlist structure,
  reference-based saves, directory search, trending surfaces, play-event
  measurement principles, rights declarations and takedown workflow,
  multi-artist credit shape.
- **Out of scope (deferred to separate doctrine):** Power Tokens,
  tipping, listener-to-creator payment rails, label licensing deals,
  commercial-mode pricing. See §13.

### 1.4 Owner decision record

| Date | Decision | Scope | Signatory |
|---|---|---|---|
| 2026-10-30 | Accept architectural direction | The seven decisions in §12 and the overall architectural direction described in this document. | Philip O'Farrell (owner) |

**Scope of acceptance (strict):**

- Acceptance applies to §12 decisions 12.1 through 12.7 and the
  architectural principles in §2.
- Acceptance **does not** authorise implementation. Phase 1 and every
  later phase remain gated by separate explicit owner authorisation
  (see §13.6).
- Acceptance **does not** verify technical proposals. The six open
  verification items (V-TRK-1 through V-STORAGE-1 in §13.2) remain
  open.
- Acceptance **does not** resolve the migration 237 numbering conflict
  (§11.4). That conflict must be resolved before migration sequencing
  or implementation.
- The Follow migration apply (migrations 237 + 238) remains paused
  and independent per §11.1.
- Music migrations 235 + 236 remain unapplied per §11.3.
- No migration renumbering, no code implementation, no migration
  drafting, no migration application, and no database access was
  performed as part of this acceptance.

**Architectural acceptance is not implementation authorisation.**
**Phase 1 requires a separate explicit owner authorisation.**

---

## 2. Core doctrine

The following principles are **load-bearing**. Any later phase that
appears to violate one of them must trigger a doctrine review before
proceeding.

### 2.1 Attribution is first-class

Every canonical track belongs to exactly one original NEX account. The
original uploader's identity (handle, display name, profile route) is
visible on **every** discovery surface that renders the track: search
results, trending lists, playlist membership listings, player chrome.

Attribution never degrades to a secondary chrome element. A listener who
discovers a track via the directory is at most one tap away from the
uploader's profile and one tap from any public playlist in which the
uploader placed the track.

### 2.2 Canonical ownership is immutable

Once a track row is created, its `owner_account_id` does not change.
Saves, playlist membership, re-shares, re-posts to the live feed, and
future multi-artist credits never reassign canonical ownership. The
original uploader remains the record owner for the lifetime of the row.

### 2.3 Discovery is attribution-preserving

The directory never flattens attribution. A search result row answers
three questions by design, in order of visual priority:

1. **What is this track?** (title, artist text, cover)
2. **Who posted it?** (NEX account display name + handle + avatar)
3. **In what public context did they place it?** (public playlist name,
   if any, with a tap-through)

### 2.4 Playlists reference tracks, they do not own them

A playlist is an **ordered reference list** of tracks. Deleting a
playlist deletes the list and its ordering metadata, nothing more. The
tracks the playlist referenced are unaffected and remain in their
owner's library.

Removing a single track from a playlist removes only the membership
row. The canonical track row and the uploader's library are unaffected.

### 2.5 Saves are references, never copies

A **save** records that account A has saved a track owned by account B.
It does not create a second track row, does not clone media, and does
not alter attribution. The saved track displays in account A's "saved
tracks" surface, and continues to display as owned by account B on every
discovery surface.

### 2.6 Private material stays private in public contexts

Private playlist names, their contents, and their covers must never
appear in directory search results, trending, related-track suggestions,
or any surface accessible without the playlist owner's authentication.
The visibility boundary is enforced at the server, not the client.

### 2.7 Public playlist context is best-single-fit

Where a track appears in multiple public playlists, discovery surfaces
one relevant public playlist context on the primary result row and
provides a route to a view of the uploader's other public playlists
containing the track. The selection heuristic is a Phase 1 open item
(§13.1). It must be deterministic and auditable; it is not an opaque
recommendation.

### 2.8 Phase 1 discovery is transparent

Phase 1 ranks results by full-text relevance and chronological trending.
There is no personalised recommendation layer, no collaborative
filtering, no opaque algorithm, no embedding-based "similar tracks."
Those surfaces are later phases, gated on real usage data, explicit
explainability (§7.4), and a visible "why am I seeing this?"
affordance.

### 2.9 Rights declarations are user claims

NEX records what the uploader asserts about the rights to the material.
NEX does not verify the legal validity of that assertion. The directory
is not a certification authority, a copyright adjudicator, or a licence
clearance service. The product surface must never imply otherwise. See
§8 for the full rights, evidence, and takedown framework.

### 2.10 Direct creator connection persists

Every surface that renders a track also renders a path to the uploader's
NEX chat and profile. The directory does not isolate listeners from
creators; it amplifies the connection the NEX social spine already
provides.

### 2.11 Analytics are not casual

Before any play-event collection is enabled, the valid-play definition,
deduplication rules, abuse controls, retention windows, and privacy
posture must be settled (§7). Listener-level identified tracking is
personal data; the default retention posture is bounded, not
indefinite.

### 2.12 Phase 1 is small on purpose

Phase 1 ships a working directory and playlists. It does not ship
recommendations, listening history, faceted upload metadata, or
monetisation. Expanding Phase 1 scope is a doctrine amendment, not an
engineering decision.

---

## Portrait-First Screen and Media Constitution

**(Core NEX Music product requirement · owner-decided and owner-accepted
2026-10-30, concurrent with the acceptance of this architectural
direction recorded in §1.4. Supplements §2 Core doctrine. Load-bearing
across all NEX Music surfaces, all device classes, and all phases of
the roadmap.)**

### Scope of this constitution

NEX Music is a mobile-first, portrait-screen-first product. Landscape
music video is not a supported publishing format in NEX Music. This
constitution establishes the product form; it does not establish
implementation. Implementation remains gated by separate explicit
owner authorisation.

### Owner-decided product requirements

The following are **owner decisions**, not technical proposals. They
are binding across every NEX Music surface, every phase of the
roadmap, and every device class on which NEX Music is rendered.

1. **Portrait viewport is the design axis.** NEX Music discovery and
   playback are designed first for the full available height and
   width of a portrait mobile screen. Not a desktop player shrunk
   down to mobile.
2. **Landscape music videos are not accepted for NEX Music
   publishing.** The upload path must reject them.
3. **Dimension validation is mandatory.** Music video uploads must be
   validated using actual media dimensions. Filename, file extension,
   MIME-type sniff, or user declaration alone are not sufficient.
4. **Cover-audio tracks remain supported.** A static artwork plus
   audio track is a first-class NEX Music publishing shape.
5. **Cover artwork is portrait-oriented.** Static-artwork surfaces
   must present the artwork within a portrait NEX Music surface.
6. **No rotation prompt.** Music video playback must remain within the
   portrait NEX native frame. Users must not need to rotate their
   phones to watch.
7. **All interaction fits the viewport.** Music controls, track
   information, creator attribution, playlist context, and gestures
   must fit naturally within the available portrait viewport.
8. **Desktop preserves the portrait frame.** On desktop, NEX Music
   must render inside a centred native-frame portrait experience.
   NEX Music is never converted into a landscape desktop player.

### Technical parameters still requiring specification

The following items are **not** owner-decided here. They are technical
parameters that must be specified before any Phase 1 or media work
touching this constitution is authorised. **This doctrine does not
invent values. It does not claim current implementation already
enforces them.**

- **Accepted aspect-ratio range.** The precise acceptable vertical
  aspect range (specific numeric bounds, portrait tolerance band for
  near-square content, treatment of common portrait ratios) is TBD
  and must be grounded in device-class evidence before being
  codified.
- **Minimum resolution.** TBD. Must be grounded in distribution-
  quality evidence appropriate to NEX Music discovery surfaces.
- **Maximum file size and maximum duration ceilings.** TBD. Must
  align with the sealed music upload contract.
- **Accepted container formats and codecs.** TBD.
- **Server-side validation implementation.** TBD. Must inspect actual
  media stream properties (ffprobe-equivalent probe or equivalent
  SDK call), not a client declaration.
- **Rejection UX copy and recovery path.** TBD. Rejection must be
  unambiguous ("landscape music videos are not accepted") and must
  describe acceptable alternatives rather than leave the uploader
  stuck.
- **Interaction with the sealed music upload contract.** The sealed
  upload contract (`nex-music-upload-contract-DRAFT-2026-10-29.md`)
  is the authority on the upload surface. Any amendment to that
  contract to encode portrait enforcement is a separate doctrine
  action and requires its own owner authorisation.

### Future implementation work (each requires separate authorisation)

Each of the following requires separate explicit owner authorisation
before any build begins. **None of the following is currently
implemented in a way that enforces this constitution. No claim is
made that current code already satisfies this constitution.**

- **Upload-contract amendment.** Extending the sealed music upload
  contract to include portrait aspect-ratio enforcement. A separate
  doctrine action.
- **Server-side dimension validation.** Code to probe uploaded media
  dimensions server-side and reject landscape content before
  publication.
- **Client-side pre-flight check.** Optional UX convenience to warn
  before the upload is attempted. Separate authorisation.
- **Rendering-layer enforcement across all surfaces.** The preview
  page, the music feed slide, the directory player, the library
  overlay, and any future NEX Music surface must each present within
  the portrait frame. Each surface's enforcement is its own build.
- **Desktop portrait-frame rendering.** The specific implementation
  (centred native-frame container, aspect-locked viewport, chrome
  treatment) is TBD.
- **Legacy data treatment.** Any pre-existing music tracks whose
  stored media is landscape must be addressed by a separate policy
  decision (reject on future play, grandfather, re-encode offer).
  This doctrine takes no position on legacy handling.

### Interaction with existing doctrine

- **Does not modify §12 locked decisions.** The seven owner decisions
  in §12 are unchanged. This constitution adds a product-form
  requirement alongside them, not inside them.
- **Does not modify §1.4 owner decision record.** The acceptance of
  the Music Directory architectural direction (2026-10-30) is
  unchanged. This portrait constitution is a concurrent owner-decided
  product requirement with its own acceptance statement below.
- **Does not modify §13.2 open verification items.** The six V-items
  (V-TRK-1 through V-STORAGE-1) remain unchanged. The technical
  parameters in this constitution are TBD items specific to the
  portrait requirement; they are listed above rather than duplicated
  into §13.2.
- **Supplements §2 Core doctrine.** This constitution reads as an
  additional load-bearing principle. Any later phase that proposes a
  landscape music publishing path, or any surface design that forces
  rotation or converts to a landscape player, triggers a doctrine
  review.
- **Does not modify any sealed upload contract and does not modify
  any code, migration, route, UI component, or test.** Only this
  document is edited by the addition of this constitution.

### Status of this constitution

**Owner-decided and owner-accepted 2026-10-30.** Concurrent with the
owner-accepted architectural direction recorded in §1.4. Binding
across all NEX Music surfaces and all future phases.

**Implementation is not authorised.** Every item listed under "Future
implementation work" above remains gated by separate explicit owner
authorisation per §13.6. Technical parameters remain TBD and must be
specified before any enforcement code is authorised.

---

## 3. Canonical track and creator ownership

### 3.1 Existing substrate

The canonical track row is `nex_music_track`. It already carries:

- `owner_account_id` — the original uploader (immutable per §2.2).
- `title`, `artist` — identity metadata.
- `rights_declaration` — enum. The four permitted values for directory
  publication are `owner_content`, `licensed`, `public_domain`,
  `royalty_free_attribution`. (Reproduced from the sealed upload
  contract; this doctrine does not amend it.)
- `visibility` — enum including `private`, `shared_live`, and the
  publication-eligible level. The current permitted-set and the state
  machine between levels are defined in the sealed music upload
  contract.
- Media references (cover, background, audio).
- Counters (`view_count`, `like_count`, `share_count`).
- Timestamps.

### 3.2 What this doctrine adds (proposed, not approved)

The following column additions on `nex_music_track` are **proposed**
for later phases, each requiring a separate migration and separate
authorisation:

| Addition | Phase | Purpose |
|---|---|---|
| `search_tsv` (tsvector) + maintenance trigger | Phase 1 | Postgres full-text search index over title + artist + description + uploader metadata |
| `description` or `description_rich` (text) | Phase 1 | Longer-form directory listing text, user-provided at upload |
| `genre` (text or enum) | Phase 3 | Faceted browse |
| `mood_tags` (text[]) | Phase 3 | Faceted browse |
| `instrument_tags` (text[]) | Phase 3 | Faceted browse |
| `language_code` (text) | Phase 3 | Faceted browse + locale filtering |
| `isrc` (text) | Phase 3+ | Optional industry identifier, user-asserted, not NEX-verified |

Open verification item (§13.2 V-TRK-1): confirm the exact current column
set of `nex_music_track` before any Phase 1 migration is drafted.

### 3.3 Deletion and lifecycle

Hard deletion of a canonical track:

- Removes all of the track's playlist memberships (`nex_music_playlist_track` rows pointing at it).
- Removes all save references pointing at it.
- Must preserve audit trails required by the takedown workflow (§8).
- Must not cascade into the uploader's account.

Soft removal (hidden from directory, retained in uploader's library)
is the preferred takedown mechanism (§8.4). Hard deletion is reserved
for owner-authored actions and for repeat-infringer policy outcomes.

---

## 4. Playlist architecture and privacy

### 4.1 Entity: `nex_music_playlist` (proposed)

| Column | Shape | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `owner_account_id` | uuid, FK → `nex_account(id)`, immutable | Playlist ownership stays with the creator (Phase 1; see §13.3 for the transfer deferral). |
| `name` | text | Human-visible title. |
| `slug` | text | URL-safe. UNIQUE (`owner_account_id`, `slug`). |
| `visibility` | enum: `private` \| `public` | Phase 1 only two values (owner decision). `followers_only` deferred (§13.4). |
| `cover_image_url` | text, nullable | Optional cover art. |
| `description` | text, nullable | Owner-authored description. |
| `created_at`, `updated_at` | timestamptz | Standard audit. |

### 4.2 Entity: `nex_music_playlist_track` (proposed)

| Column | Shape | Notes |
|---|---|---|
| `playlist_id` | uuid, FK → `nex_music_playlist(id)`, ON DELETE CASCADE | Deleting the playlist removes memberships, not tracks. |
| `track_id` | uuid, FK → `nex_music_track(id)`, ON DELETE CASCADE | A track hard-delete removes memberships; the uploader's library is a separate concern. |
| `position` | integer | Zero-indexed, dense ordering within the playlist. |
| `added_at` | timestamptz | When this track was added to this playlist. |
| | | PK (`playlist_id`, `track_id`) — a track appears at most once per playlist. |

### 4.3 Privacy enforcement

- Server-side policy filters every public query by
  `visibility = 'public'` for playlists.
- Private playlist membership is never joinable from a public query
  surface.
- A private playlist's name, cover, and description are never returned
  from unauthenticated or non-owner-authenticated requests, even by
  cross-table joins through track pages or save surfaces.
- RLS or equivalent server-side policy must verify ownership for every
  private-playlist read. Client-side filtering alone is not an
  acceptable implementation.

### 4.4 Cross-playlist appearance

- A single track may be a member of many public playlists owned by
  many different accounts.
- The directory does **not** aggregate "most-playlisted" statistics in
  Phase 1 (it is a potential discovery axis for Phase 3+, not now).
- Public playlist context displayed on a directory result row follows
  §2.7 (best-single-fit, deterministic heuristic to be defined in the
  Phase 1 build plan).

### 4.5 Playlist deletion semantics

- Deleting a playlist cascades to its membership rows only.
- The tracks the playlist referenced are not touched. They remain in
  their uploaders' libraries and in any other playlist that referenced
  them.
- There is no soft-delete for playlists in Phase 1. If soft-delete
  becomes a requirement (for example to support "undo delete"), it
  arrives as a separate authorised amendment.

### 4.6 Playlist transfer

Not supported in Phase 1. Playlist ownership remains with its original
creator for the lifetime of the row. See §13.3 for the deferral.

---

## Active-Slot Rotation Rule

**(Core NEX Music product requirement · owner-decided 2026-10-30 ·
supplements the owner-accepted architectural direction recorded in
§1.4. Governs how the single active slot per creator picks which
library track is live on the NEX feed. Load-bearing across all NEX
Music active-slot surfaces. Implementation remains unauthorised.)**

### Scope of this rule

Defines how the sealed `nex_music_active_slot` primitive (migration
236 drafted, currently unapplied) picks the creator's live track at
any moment. This rule adds a rotation-state concern that every later
build plan must specify. It does not modify the primitive's shape or
any other sealed section of this doctrine.

### Owner-decided rules

Simplified sealed wording owner-stated 2026-10-30 (replaces the
earlier three-rule phrasing drafted earlier the same day):

1. **24-hour loop.** Songs rotate from the creator's library to the
   NEX feed every 24 hours. Rotation cycles through the creator's
   library and loops back to the start when it reaches the end.

2. **Station mode (toggle on/off).** The creator may set one song
   as their **station**. Setting a station turns the 24-hour loop
   OFF; the station song stays live on the feed until the station
   is turned off. Toggle on or off at any time from the creator's
   library.

Natural consequence (not a third rule): a creator with exactly one
directory-eligible track effectively has that track live on the
feed by default — the rotation of one song is static. When they
add a second song, the 24-hour loop activates automatically.

### Owner-recommended defaults (build-plan may override without doctrine amendment)

- **Rotation order:** chronological, oldest → newest, loop.
  Transparent and deterministic.
- **Rotation moment:** local midnight in the creator's timezone.
  Matches "today's track" product expectation.
- **Private tracks:** excluded from the rotation pool. Only tracks
  with `visibility: shared_live` and a directory-eligible
  `rights_declaration` (see §8.2) enter the pool.
- **New uploads:** join the rotation pool from day one. There is **no
  fresh-window grace** in this version. (The earlier three-part rule
  stated 2026-10-30 earlier that day — which included a 72-hour fresh
  window for new uploads — was explicitly replaced by the simplified
  two-rule system above. If the fresh-window idea returns, it is a
  separate amendment.)
- **Track removal mid-rotation:** rotation advances to the next
  eligible track; the removed track is not re-exposed; the slot
  stays alive.
- **Station mode shape:** a boolean per creator (`station_on`) plus
  a `station_track_id` reference. Station ON requires the
  referenced track to be in the creator's own library and
  directory-eligible. The term "station" is the sealed owner
  wording; implementation column names may differ but the
  user-facing label stays "station".

### Trending math (sealed deferral)

Phase 1 trending (§6.5) keeps rolling 24-hour and 7-day play counts
unchanged. Rotation makes raw counts favour stationed tracks over
rotated ones (a stationed track is exposed 24 hours per day; a
rotated track is exposed roughly `24 h / library_size` per day).
**Exposure-normalised trending** (plays per exposure-hour or plays
per exposure event) requires an exposure-log primitive that does not
yet exist and is deferred to **Phase 2** alongside the per-event
analytics in §7.

Phase 1 trending user-facing copy must honestly reflect this
limitation. Labels like "most played this week" are permitted;
labels implying creator exposure is normalised ("fairly ranked",
"equal opportunity trending") are not permitted.

### Interaction with existing doctrine

- **Does not modify §4 playlist architecture.** Rotation applies to
  the per-creator active-slot primitive, not to playlists. Playlist
  content is unaffected by rotation.
- **Does not modify §2.7 public-playlist context.** The best-single-
  fit public-playlist signal is orthogonal to which track is live.
- **Does not modify the Portrait-First Screen and Media Constitution.**
  Portrait rules decide how a track renders; rotation decides which
  track is live.
- **Does not modify §12 locked decisions** or §1.4 owner decision
  record. This rule is an additional product-form amendment with its
  own owner-decided-2026-10-30 status.
- **Does not modify any sealed upload contract or any code.** Only
  this document is edited.

### Future implementation work (each requires separate authorisation)

- **Rotation-state primitive.** Column(s) on `nex_music_active_slot`
  or a companion table (`rotation_order_index`, `last_rotated_at`,
  `station_on`, `station_track_id`). Build-plan decision.
- **Scheduled rotation job.** Daily tick that advances rotating
  (non-stationed) active slots at the configured rotation moment.
  Build-plan + ops decision.
- **Station toggle UI.** Library-side control on the creator's own
  music surfaces (preview page, library overlay). Simple on/off
  switch per track; only one track may be stationed at a time.
  Portrait-First Constitution applies.
- **Exposure-log primitive.** For Phase 2 exposure-normalised
  trending. Separate authorisation.
- **Dev-filesystem adapter extension.** `.dev-music-data/
  active-slots.json` must carry rotation state fields; a dev
  rotation-tick script is needed to simulate the daily advance in
  local dev.

### Status of this rule

**Owner-decided 2026-10-30.** Supplements the owner-accepted
architectural direction in §1.4. **Implementation is not authorised.**
Every item under "Future implementation work" requires separate
explicit owner authorisation per §13.6.

---

## 5. Save / reference semantics

### 5.1 Entity: `nex_music_track_save` (proposed)

| Column | Shape | Notes |
|---|---|---|
| `saver_account_id` | uuid, FK → `nex_account(id)` | The account that saved the track. |
| `track_id` | uuid, FK → `nex_music_track(id)` | The original canonical track. |
| `saved_at` | timestamptz | When the save was recorded. |
| | | PK (`saver_account_id`, `track_id`) — a save is idempotent per listener per track. |

### 5.2 Invariant: save ≠ copy

A save records a bookmark relationship. It does not:

- Create a second track row.
- Duplicate media.
- Transfer or share ownership.
- Grant edit rights to the saver.
- Alter counters on the canonical track in any way that would obscure
  attribution.

### 5.3 Discovery semantics for saved tracks

- The saver's own "saved tracks" surface shows the canonical row with
  full original attribution (uploader avatar, handle, display name).
- If the uploader later takes the track private or removes it, the
  saver's surface honours that: the entry remains in the saver's save
  list for recovery/audit, but playback is gated on the canonical row's
  current visibility. The user experience must honestly reflect that
  the content is unavailable rather than silently appear playable.

### 5.4 Unsave

Unsaving removes the row from `nex_music_track_save`. It does not
affect the canonical track, its uploader, or any playlist.

### 5.5 Interaction with playlists

A saved track can be added to the saver's own playlists in the normal
way. This creates a `nex_music_playlist_track` row that references the
canonical track. The track remains owned by the original uploader; the
saver's playlist simply references it. No copy semantics are
introduced by the combination.

---

## 6. Directory search and discovery

### 6.1 Phase 1 technology (proposed, benchmark-gated)

- **Full-text search:** Postgres `tsvector` on `nex_music_track`,
  computed over `title`, `artist`, optional `description`, and
  denormalised uploader `display_name` + `nex_handle`.
- **Trigram index:** `pg_trgm` extension to support typo-tolerant
  prefix matching for the search bar's autocomplete behaviour.
- **Indexing strategy:** GIN on the tsvector; GIN(trigram) on title +
  artist + uploader handle for the autocomplete path.
- **Trending window:** chronological, rolling 24-hour and rolling
  7-day plays over a yet-to-be-defined valid-play definition (§7).

### 6.2 Capacity claim constraints

This doctrine makes **no promise** about the scale at which the
Phase 1 Postgres approach remains comfortable. Any capacity claim —
including rules of thumb like "fine to one million tracks" — requires
real benchmarks on representative hardware and representative data
distributions before publication.

Open verification item (§13.2 V-SRCH-1): produce benchmark data on
the sealed Supabase project configuration before Phase 1 is lock-sealed
for scale claims.

### 6.3 Query shape

Phase 1 search is a user-visible query over four axes:

1. Free-text query (full-text + trigram, scored).
2. Rights-eligibility filter (`rights_declaration ∈ {owner_content,
   licensed, public_domain, royalty_free_attribution}`) applied
   server-side; non-eligible tracks never surface, regardless of
   visibility.
3. Visibility filter (public only) applied server-side.
4. Optional sort: relevance (default) or newest.

Faceted filters (genre, mood, instrument, language) are Phase 3. They
are not available in Phase 1 search.

### 6.4 Result composition

A directory search row includes:

- Track cover (signed if private-bucket, otherwise the sealed signing
  path from the music upload contract).
- Track title + artist text.
- Uploader display name + handle + avatar (one tap to profile; see
  §2.10).
- Public playlist context (§2.7 best-single-fit), with a tap-through
  to the playlist page.
- A compact play affordance; playback is subject to the valid-play
  definition in §7.
- Rights declaration badge if the track is `licensed`, `public_domain`,
  or `royalty_free_attribution`. `owner_content` is the default and
  not badge-rendered.

### 6.5 Trending

Trending surfaces are chronological projections over play counts in a
rolling window:

- **24-hour trending:** tracks ranked by valid plays in the last
  24 hours, broken ties by newest.
- **7-day trending:** tracks ranked by valid plays in the last 7 days.
- **New releases:** tracks with `created_at` or publication timestamp
  within a defined recent window, newest first. The exact timestamp
  axis depends on the sealed music upload contract's publication
  model and is an open verification item (§13.2 V-TREND-1).

Guest plays are **excluded** from trending counts in Phase 1 (owner
decision §12.4). The trending algorithm must document, inside this
doctrine's successor build plan, the exact SQL that excludes
unauthenticated events.

### 6.6 Anomaly handling

Where a track experiences an abnormal spike in play events —
beyond thresholds yet to be defined — the trending surface is
authorised to **temporarily exclude** the track from trending pending
NEX review. A spike alone is not an infringement finding. A spike
alone is not grounds for deletion. See §7.5 for the full abuse model.

---

## 7. Playback measurement, privacy and abuse

### 7.1 Entity: `nex_music_play` (proposed, Phase 2)

| Column | Shape | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `listener_account_id` | uuid, FK → `nex_account(id)`, nullable | Null when the listener is a guest. |
| `track_id` | uuid, FK → `nex_music_track(id)` | |
| `started_at` | timestamptz | When playback began. |
| `heard_ms` | integer | Milliseconds of audio actually consumed (progress-counted, not elapsed wall-clock). |
| `source` | enum (`library`, `directory`, `playlist`, `live_feed`, `search`, `trending`) | Which surface originated the play. |
| `client_fingerprint_hash` | text, nullable | Opaque hash for guest-session deduplication; never reversible to a user identity. Retention bounded (§7.6). |
| `ip_class` | text, nullable | Coarse-grained bucket (e.g., ASN or country) for abuse detection; not full IP. Retention bounded. |

### 7.2 Valid-play definition

A play event is valid for trending purposes only if **all** of:

- The listener is a signed-in NEX account (owner decision §12.4;
  revisit after abuse controls are designed).
- `heard_ms ≥ a defined threshold` (precise threshold is an open
  Phase 2 item; industry baselines range from 30 seconds to 50% of
  track duration; the specific threshold must be documented in the
  Phase 2 build plan).
- No prior valid play by the same listener for the same track within
  a defined deduplication window.
- The play source is a user-initiated action, not an automated
  pre-fetch or background scrubber.

Invalid plays are still permitted to be recorded for abuse detection
and personal "recently played" surfaces, but they are explicitly
excluded from the trending aggregation.

### 7.3 Deduplication

Within a defined window (hourly, daily, or per-session — Phase 2
decision), a given listener-track pair counts for trending at most
once. The window prevents loop-based self-boosting and basic
automation.

### 7.4 Explainability (future phases)

When Phase 4 introduces personalisation (collaborative filtering,
Daily Mix, related-tracks), each surface must provide a visible
"why am I seeing this?" affordance that renders a plain-language
explanation. Opaque recommendations are not acceptable.

Phase 1 does not include personalisation (§2.8).

### 7.5 Abuse controls

- **Rate limiting:** per-listener and per-IP-class rate limits on
  play-event ingestion.
- **Pattern detection:** automated anomaly scoring on per-track
  play-rate derivatives. Scores above a defined threshold flip the
  track into a **trending-exclusion** state (§6.6). Exclusion is
  temporary and reviewable.
- **Review workflow:** flagged tracks route to a NEX review queue.
  Outcomes include: restore to trending (false alarm), extend
  exclusion (continued investigation), escalate to takedown workflow
  (§8).
- **No automatic deletion:** no abuse-detection outcome results in
  automatic hard deletion of a track or an account.
- **Transparency to the uploader:** uploaders are informed when their
  track is excluded from trending, with the reason category (not the
  detection signals themselves, to avoid teaching the system around
  it).

### 7.6 Privacy posture

- **Default retention of listener-identified play rows:** bounded,
  not indefinite. The exact retention window is a Phase 2 open item;
  it must be a specific number of days (or a documented policy), not
  a vague "we may keep it."
- **Guest play rows:** retained only long enough to serve the
  abuse-control window. No long-term guest listening profiles.
- **Aggregate (anonymised) play counts** on `nex_music_track`
  (`view_count` etc.) have no retention limit; they are aggregate,
  not personal data.
- **Listener export:** a user must be able to export and delete their
  own play history. The specific flow (self-service, delayed, support-
  gated) is Phase 2 open scope but the requirement is doctrinal.
- **No cross-site tracking inference** is derived from play data.

Open verification item (§13.2 V-PRIV-1): confirm NEX's general
retention and data-export posture before Phase 2 ingestion is
authorised.

### 7.7 Analytics are a Phase 2 feature

Phase 1 **does not** collect per-event play rows. Phase 1 trending is
derived from the sealed counters already maintained on
`nex_music_track` (play / view / like / share, subject to confirmation
in V-TRK-1), without an auxiliary event stream. The event stream
arrives in Phase 2, after the valid-play definition, deduplication
rules, abuse controls, and retention windows are all explicitly
owner-authorised.

---

## 8. Rights declarations, evidence and takedown

### 8.1 Declarations are user claims

NEX records what the uploader has asserted. NEX does not verify legal
title. The declaration is honest metadata about what the uploader
believes they have the right to do with the material. It is not a NEX
certification.

User-facing product surfaces must never render phrasing that implies
NEX has verified rights (phrases like "verified rights", "cleared for
NEX distribution", "legally licensed by NEX" are prohibited).

### 8.2 The four directory-eligible declarations

Only tracks whose `rights_declaration` is one of the following are
eligible for directory publication:

| Declaration | Meaning (user claim) |
|---|---|
| `owner_content` | Uploader claims to be the author/producer, or otherwise the primary rights holder. |
| `licensed` | Uploader claims to hold a licence that permits NEX distribution. Supporting evidence may be attached (§8.3). |
| `public_domain` | Uploader claims the work is in the public domain in a stated jurisdiction. |
| `royalty_free_attribution` | Uploader claims the work is distributed under a royalty-free or attribution-based licence (e.g., CC BY, library sources). |

### 8.3 Evidence capture for `licensed`

For `licensed` declarations, the following fields are **permitted**
(not required) at upload:

- `license_source_url` — a URL to the licence document.
- `license_type` — a short label (e.g., "CC BY 4.0", "exclusive sync",
  "catalogue sub-licence").
- `license_jurisdictions` — a short list of jurisdictions covered.

These fields are stored verbatim as the uploader's attestation. They
do not establish NEX verification. They exist to make takedown review
faster and to make honest uploaders easier to defend.

Open verification item (§13.2 V-RIGHTS-1): confirm whether evidence
fields already exist in `nex_music_track`, or require a Phase 1
migration addition.

### 8.4 Takedown workflow

The workflow is deliberately staged to match the sealed Community
Notice doctrine's "report → review → decision → restoration" model
where applicable. The following states and transitions are
authoritative for this doctrine; implementation specifics are a
Phase 1-adjacent build-plan item (potentially shared with Community
Notice infrastructure).

**States:**

1. `report_open` — a viewer flagged the track; NEX has not yet
   reviewed.
2. `visibility_restricted` — the track is temporarily hidden from the
   directory pending review. The uploader's own library is unchanged;
   the track remains playable to the uploader.
3. `confirmed_removed` — NEX review has concluded that the material
   must be removed from the directory. Hard deletion vs. soft removal
   (`visibility = 'removed'`) depends on jurisdiction and the specific
   rights decision; both outcomes are authorised; cascade semantics
   from §3.3 and §4.5 apply.
4. `report_dismissed` — NEX review has concluded no action is required.
   Visibility restored.
5. `restored` — a previously restricted or removed track has been
   explicitly reinstated (e.g., after a successful counter-notice or a
   licence attestation update).

**Reports and reviews:**

- Any signed-in viewer can file a report with a reason category and
  optional free-text explanation.
- Reports are reviewed by designated NEX reviewers.
- The uploader is informed when their track enters
  `visibility_restricted` and when the review concludes.
- Repeat-infringer policy, counter-notice flow, and jurisdictional
  compliance details are **out of scope** for this doctrine (they
  require legal input and are not an engineering decision).

**Transparency:**

- The track-detail page does not expose reporter identities.
- Review outcomes are logged in an audit table (not defined in this
  doctrine; shared infrastructure likely applies).

### 8.5 Takedown ≠ abuse exclusion

The trending-exclusion mechanism in §6.6 and §7.5 is operationally
distinct from the rights-takedown workflow in §8.4. A track can be
excluded from trending without being flagged for rights review, and
vice versa.

### 8.6 Non-goals

- NEX is **not** a copyright adjudicator.
- NEX **does not** make legal findings.
- NEX **does not** certify rights.
- The ContentID-equivalent (fingerprint matching against third-party
  registries) is **not in scope** for Phase 1. If it later becomes
  relevant, it is a separate doctrine.

---

## 9. Multi-artist credits

### 9.1 Deferral and scoping

Multi-artist credits are **not** a Phase 1 feature. They are a design
anchor documented here so that no earlier phase makes a decision that
blocks the eventual shape.

### 9.2 Future shape (proposed, not approved)

A separate `nex_music_track_credit` relationship, one-to-many against
`nex_music_track`, with columns such as:

| Column | Shape | Notes |
|---|---|---|
| `track_id` | uuid, FK → `nex_music_track(id)` | |
| `credited_account_id` | uuid, FK → `nex_account(id)`, nullable | NEX account of a collaborator. Null when the collaborator does not have a NEX account (external credit). |
| `credited_name` | text | Display text when `credited_account_id` is null, or an override when it is set. |
| `role` | enum (e.g., `feature`, `producer`, `writer`, `vocalist`, `remix`) | |
| `order` | integer | Credit list ordering. |

### 9.3 Invariant: credits never replace origin

`owner_account_id` on `nex_music_track` remains the **sole** record
owner. Credits annotate the track; they do not alter origin. Any UI
that renders collaborators must still render the original uploader
unambiguously.

### 9.4 Discovery implications (future)

In the future, a collaborator's profile may surface tracks on which
they are credited (not owned). That surface must honestly distinguish
"posted by this account" from "credited on this track"; conflating the
two would violate §2.3.

---

## 10. Phased roadmap

Each phase requires separate owner authorisation. Phases are
**sequential by default**; parallel execution requires explicit
scheduling in the respective build plans.

### 10.1 Phase 1 — Canonical playlists + directory search

- Playlist tables (`nex_music_playlist`, `nex_music_playlist_track`).
- Server actions for playlist CRUD, membership add/remove, reorder.
- Full-text search columns on `nex_music_track`.
- Directory search server action + routes.
- Trending surfaces (24h, 7d, new) read from existing counters
  (subject to V-TRK-1).
- Attribution + public-playlist-context rendering on every discovery
  result.
- Rights-eligibility filter server-side.
- Takedown workflow states and server actions (reuse Community Notice
  infrastructure where possible).

### 10.2 Phase 2 — Saves + listening history + per-event analytics

- `nex_music_track_save` table + server actions.
- `nex_music_play` table + ingestion endpoint.
- Valid-play definition, deduplication, abuse rate limits, anomaly
  detection, retention policies — all explicitly owner-authorised.
- "Recently played" and "saved" user surfaces.
- Listener data export + deletion self-service.

### 10.3 Phase 3 — Faceted metadata + faceted search

- Metadata columns on `nex_music_track`: genre, mood tags, instrument
  tags, language, optional ISRC.
- Faceted upload UI additions.
- Faceted directory search.
- Related-tracks surfaces built from facet overlap (not from
  embeddings).

### 10.4 Phase 4 — Personalised discovery

- Collaborative filtering (co-listening matrix).
- Related-tracks via facet-weighted similarity.
- "Daily Mix" or equivalent, generated nightly per listener.
- Explicit explainability affordance on every personalised surface
  (§7.4).

### 10.5 Phase 5 — Notifications, collaborative playlists, monetisation

- Follow-triggered new-track notifications (ties to the shipped Follow
  work; see §11.4).
- Collaborative playlists (multi-owner).
- Monetisation concepts: deferred to a **separate** doctrine. See §13.5.

---

## 11. Dependencies and migration-number caution

### 11.1 Preserve existing work

Nothing in this doctrine authorises any change to the existing
Follow migration numbers (237 Follow graph, 238 Follow counters) or
the Follow server actions. The Follow migration apply remains paused
and is tracked independently.

### 11.2 Preserve existing music publishing design

The sealed music upload contract
(`nex-music-upload-contract-DRAFT-2026-10-29.md`) and the
music-publishing-to-live-feed design contract
(`nex-music-publishing-to-live-feed-design-contract-DRAFT-2026-10-30.md`)
are the authoritative specifications for the upload path and the
publish-to-live-feed path. This doctrine does not amend them.

### 11.3 State of migrations 235, 236, 237

Using the exact distinctions requested by the owner:

| Migration | Current state |
|---|---|
| `235_nex_music_track.sql` | **Drafted** on disk. Application status is **not established** by this doctrine. The sealed music upload contract is the authority on its intended semantics. Do not assume applied. |
| `236_nex_music_active_slot_and_idempotency.sql` | **Drafted** on disk for the active music slot and publish idempotency primitive. **Not applied** per the readiness-audit documents. |
| `237_nex_follow_graph.sql` | **Drafted and committed locally** as the Follow graph migration (local commit `80a05c4` on `main`). **Not applied** to any Supabase project. |

Development-filesystem publishing (the dev-mode storage used by the
upload surface) is implemented in development. **It does not
constitute production-ready music storage.** No claim about Supabase
Storage, pooler connectivity, or production filesystem adapters is
established by this doctrine.

### 11.4 Migration-number conflict (237) · RESOLVED 2026-10-30

**Resolution.** Migration 237 is permanently assigned to Follow
(`nex_follow_graph`). The future `nex_account_music_rights_ack`
migration (deferred per the earlier music-publishing readiness
audit) will take whatever number is next-free at the time its build
is authorised. Phase 1 of this doctrine proposes numbers 239–241
for playlists + search; whichever migration is drafted and
authorised first takes 239, and so on in next-free order.

**Context (preserved for history).**

The earlier doctrine
`docs/doctrine/nex-music-publishing-integration-readiness-audit-2026-10-30.md`
reserved migration 237 for `nex_account_music_rights_ack`. The
local Follow commit chain used 237 for `nex_follow_graph.sql`. The
Follow commit chain was subsequently pushed to `origin/main` (as of
commit `b6db755`, 2026-10-30), making the Follow 237 assignment
part of public repository history.

**Why option 1 (renumber rights-ack) over option 2 (rebase Follow).**

Rebasing the Follow commit chain would require a force-push on
`origin/main` to rewrite public history. That is a destructive
operation per CLAUDE.md §3 and would invalidate any downstream
clones of the repository. Option 1 (renumber the as-yet-unauthored
rights-ack migration at build time) is non-destructive, requires
zero code change today, and simply records a numbering convention
going forward.

**Impact on other doctrines.**

- The music-publishing readiness audit's historical statement that
  "migration 237 = `nex_account_music_rights_ack`" is now a
  reservation that was superseded; it will be renumbered at build
  time when the rights-ack migration is authorised.
- The Phase 1 build plan
  (`nex-music-directory-phase-1-build-plan-draft-2026-10-30.md`)
  assumes numbers 239–241 for its three migrations and explicitly
  notes that actual numbers are confirmed at drafting time
  (§3.2 of that build plan).
- No existing SQL file is renamed.
- No existing commit is rewritten.
- No history on `origin/main` is modified.

### 11.5 Dev-filesystem versus Supabase

The current music path uses a development filesystem adapter. Any
Phase 1 build plan must explicitly specify, before authorisation,
whether:

- Phase 1 continues to use the dev filesystem adapter in development
  and defers Supabase Storage integration.
- Phase 1 includes a Supabase Storage integration migration.

This doctrine takes no position; it only records that the distinction
matters and the choice is a build-plan decision, not a doctrine one.

---

## 12. Decisions locked for this draft

The following were provided by the owner at drafting time. They are
locked for this draft; later amendments require separate decisions.

### 12.1 Playlist privacy — Phase 1

Only `private` and `public` are supported in Phase 1.
`followers_only` is deferred (§13.4).

### 12.2 Save semantics

A save is a reference to the original canonical track. A save never
creates a duplicate track, never clones media, and never transfers
ownership. See §5.

### 12.3 Licensed-track evidence

Require an explicit rights declaration and owner attestation. Allow
supporting evidence (licence URL and source) but do not imply that
attestation alone verifies legal rights. See §8.1 and §8.3.

### 12.4 Guest plays

Guest playback may be supported. Guest events must **not** count
toward Phase 1 trending. Guest plays are revisited after abuse
controls are designed (§7, §13).

### 12.5 Abnormal play spikes

Use automated anomaly detection and temporary exclusion from trending
pending review. A spike alone must not automatically establish
infringement or justify deleting a track. See §6.6 and §7.5.

### 12.6 Playlist transfer

Not supported in Phase 1. Playlist ownership remains with its original
creator. See §4.6 and §13.3.

### 12.7 Multi-artist credits

Support a future separate `track-credit` relationship.
`owner_account_id` on `nex_music_track` remains the immutable original
NEX uploader/record owner. Artist credits must not replace or obscure
that origin. See §9.

---

## 13. Deferred decisions and implementation gates

### 13.1 Deterministic "best-single-fit" public playlist heuristic (§2.7)

The exact deterministic rule for choosing one public playlist to render
alongside a track in a search result is deferred to the Phase 1 build
plan. The rule must be:

- Deterministic (no randomisation inside a given query).
- Auditable (owner can inspect why a particular playlist won).
- Preference-neutral at Phase 1 (does not reward "big" playlists; does
  not punish small creators).

### 13.2 Open verification items

| Code | Item |
|---|---|
| V-TRK-1 | Confirm current column set of `nex_music_track`, including whether `description`, `license_source_url`, `license_type`, `license_jurisdictions`, `view_count`, play counters, publication timestamp, and search-relevant text columns already exist. Before any Phase 1 migration is drafted. |
| V-SRCH-1 | Produce real benchmark data (query latency P50/P95, index size, write amplification) for the proposed Postgres full-text + trigram approach on representative row volumes and hardware. Before Phase 1 lock-seal. |
| V-TREND-1 | Confirm the authoritative timestamp axis for "newest" / "new releases" ordering: `created_at`, `published_at`, or the publish-to-live-feed timestamp. |
| V-PRIV-1 | Confirm NEX's general listener-data retention posture and self-service data-export availability. Before Phase 2 play-event ingestion is authorised. |
| V-RIGHTS-1 | Confirm whether `license_source_url` / `license_type` / `license_jurisdictions` columns already exist on `nex_music_track`, or whether Phase 1 requires their addition. |
| V-STORAGE-1 | Confirm the Phase 1 position on dev-filesystem vs. Supabase Storage for media (§11.5). |

### 13.3 Playlist transfer

Deferred. Any future "transfer my playlist to another account" feature
requires separate doctrine (ownership assignment, audit trail,
notification, dispute). Not Phase 1.

### 13.4 `followers_only` playlist visibility

Deferred. Ties to the Follow graph's visibility model (public, mutuals,
private) sealed on `nex_account` by migration 238. If adopted, must
align with that visibility vocabulary and be explicitly tested.

### 13.5 Monetisation surfaces

Power Tokens, tipping, listener-to-creator payment rails, label
licensing, and any other commercial surface are **explicitly out of
scope** for this doctrine. They require separate commercial, legal,
and entitlement decisions. Nothing in this doctrine authorises a UI,
server action, or data model related to money flows. User-facing
copy must never imply NEX processes a user's work payments or takes a
commission.

### 13.6 Implementation gates

Before any Phase 1 build begins, the owner must separately authorise:

- A per-phase build plan derived from this doctrine.
- The exact migrations the Phase 1 plan requires, drafted and reviewed.
- A migration-apply window on the sealed Supabase project
  `ijvqdvsvwtwxzcqmoqit`, consistent with CLAUDE.md §5.
- Resolution of the migration 237 numbering conflict (§11.4) if the
  Phase 1 plan ever touches it (it currently does not).

Before any Phase 2 build begins:

- V-PRIV-1 (listener data posture) must be answered.
- The valid-play definition, deduplication window, abuse controls, and
  retention policy must be explicitly owner-authorised in writing.

Before any Phase 4 build begins:

- The explainability affordance (§7.4) must be specified concretely.
- Opaque personalisation surfaces without explainability are not
  authorised.

---

## Appendix A · Glossary (binding terms)

| Term | Definition in this doctrine |
|---|---|
| Canonical track | A row in `nex_music_track`. One record per uploaded track. Immutable `owner_account_id`. |
| Uploader | The account referenced by `nex_music_track.owner_account_id`. |
| Library | The set of canonical tracks owned by a single uploader. Not a table — a projection. |
| Playlist | A row in the proposed `nex_music_playlist`. An ordered reference list. |
| Save | A row in the proposed `nex_music_track_save`. A reference bookmark, not a copy. |
| Directory | The global search surface over all directory-eligible tracks. A projection of `nex_music_track`, not a new source of truth. |
| Discovery | Any surface — search, trending, playlists — through which a listener finds a track. |
| Public playlist context | The best-single-fit public playlist in which an uploader placed a track, surfaced alongside the track on discovery results per §2.7. |
| Valid play | A play event meeting the §7.2 criteria, counted toward trending. |
| Rights declaration | The uploader's `nex_music_track.rights_declaration` assertion. A user claim, not a NEX certification (§2.9). |

---

## Appendix B · State-distinction vocabulary

The following distinctions are used in this doctrine with strict,
non-interchangeable meanings:

- **Drafted** — a file exists on disk and has been authored. No
  claim about correctness, review, application, or production state.
- **Implemented in development** — a code path exists and runs in the
  development environment. No claim about production-readiness,
  staging verification, or production stability.
- **Tested** — a formal test suite exercises the path and passes.
  Separate from staging or production.
- **Applied** — a migration has been successfully run against a
  specific target database. Must name the target.
- **Production-ready** — tested, applied to a production-mirror
  environment, free of known production-blocking issues, and
  authorised by the owner for production use.
- **Authorised** — the owner has explicitly approved the specific
  action, with the scope and target clearly identified.

---

**End of document.**

> **OWNER-ACCEPTED ARCHITECTURAL DIRECTION — 2026-10-30**
> **NOT AUTHORISED FOR IMPLEMENTATION**
