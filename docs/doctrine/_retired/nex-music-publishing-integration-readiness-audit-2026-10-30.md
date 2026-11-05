# NEX Music Publishing → Live Feed · Integration-Readiness Audit

**Status:** DRAFT · READ-ONLY AUDIT · owner-authorised 2026-10-30
**Scope:** six areas listed by the owner after the dev-FS build report.
**Non-scope:** no migration application, no deployment, no cleanup, no new feature work. Implementation and existing working-tree changes are preserved as-is.

This audit asks a single question for each area: **what would need to be true before this part of the music-publishing flow can be called integration-ready in production?** Findings are grouped by owner-listed area. Line references are to the current working tree.

---

## Area 1 · Authentication and rejection of development impersonation

**What exists today**

- `publishMusicAsActivePostAction` (`src/app/nex-native/create/upload-music/_actions.ts:226`) resolves identity via `resolveSessionWithDevOverride`.
- `resolveSessionWithDevOverride` (`src/lib/nex-native/app/dev-impersonation.ts:100`) returns a dev-impersonated persona session when `NEX_DEV_IMPERSONATE_HANDLE` is set **and** `NODE_ENV !== "production"`. When `NODE_ENV === "production"` the override is unconditionally disabled (`isDevImpersonationEnabled`, line 48). Dev-impersonation also NEVER mints a Supabase token; the real auth path is not touched.
- The dev-impersonation module header (lines 30-35) states a per-row audit trail is required BEFORE any persona-made write is enabled.
- The publish action documents the gap explicitly (lines 203-208): *"Not yet enforced at the server-action layer. Owner-pending decision tracked in the sealed memory. Current behaviour: dev impersonation CAN publish; the audit table referenced at `dev-impersonation.ts:32-35` is NOT yet built."*
- The client already maps the error code `dev-impersonation-publish-forbidden` to a user-visible message in `_preview-client.tsx:1563-1564`, but no server-side code path returns that code today.

**Honest limitations today**

1. The dev-FS flow is accepted end-to-end for a dev persona (Hendra under `NEX_DEV_IMPERSONATE_HANDLE=hendra`). This is the only path that currently makes publish-and-see work on a developer workstation.
2. In a *production* build (Vercel with `NODE_ENV=production`) the dev override returns `null` immediately. A real signed-in Supabase user is required. Supabase cookie-session validation is already enforced inside `resolveNexAppSessionFromContext`; no new primitive is required there.
3. In *staging-like* builds where `NODE_ENV` is not strictly `"production"` (local prod builds, Playwright runners, custom CI containers), the override is still active. The action does not yet distinguish "dev persona under impersonation" from "real signed-in user" at the publish surface.

**What needs to be true for integration-readiness**

- A server-action gate that rejects publish when the resolved session originated from `resolveSessionWithDevOverride` and NOT the real Supabase cookie path. The gate returns `dev-impersonation-publish-forbidden`.
- The audit table referenced by the dev-impersonation doctrine must either (a) exist and receive a row for every persona-driven write, or (b) all persona writes must be blocked at the gate.
- Confirm `NODE_ENV` is set to `production` on the Vercel production project (Constitution §5) so the override is dead code there regardless of the gate.
- Owner decision tracked as **D11-B** · currently unsealed; recommended default is Option A (hard-reject at the server action).

---

## Area 2 · Rights declaration and acknowledgement requirements

**What exists today**

- `rights_declaration` is a per-TRACK field collected at upload-time. The server action requires a value from the fixed set `owner_content | licensed | public_domain` (`_actions.ts:85-96`). The track row carries both `rights_declaration` and an optional `rights_notes` free-text field.
- Migration 236 **freezes** the then-current `rights_declaration` onto the active slot via the `rights_declaration_frozen` column (lines 353-359 of the migration). The feed-reader filters a slot out if the live track's rights_declaration no longer matches the frozen value (`active-music-feed-reader.ts:166-171`).
- The publish action does NOT enforce an acknowledgement step today (`_actions.ts:210-214`). The code comment is explicit: *"This action does NOT yet enforce the acknowledgement check. That check belongs to M-2 Part 2 (reads `nex_account_music_rights_ack`, Migration 237). Rights-ack enforcement is a separate owner authorisation."*
- The preview page's `goLive` handler (`_preview-client.tsx:209-215`) goes directly from the Live button to `publishMusicAsActivePostAction` without any interstitial.
- Migration 237 is NOT drafted. The sealed memory records E = Option E1-schema (separate migration, separate authorisation).

**Honest limitations today**

1. No ack is required to publish. A creator who skipped reading the per-field upload copy publishes without re-affirming.
2. There is no plain-English, non-legal explanation of what each declaration implies at publish time. The declaration value is set at upload and never surfaced to the creator again.
3. There is no record of "which terms version did this creator accept, when, and under what UI copy?" because the ack table does not exist.
4. The `rights-ack-required` error code is wired through the client human-error map but no server code emits it.

**What needs to be true for integration-readiness**

- Owner-authored rights-terms **text** (plain-English, versioned). Not yet drafted. This is owner-territory per the sealed memory and the Build Report.
- Migration 237 drafted + reviewed + applied (separate authorisation per sealed memory, locked decision E).
- Preview-page interstitial that: (a) shows the frozen rights declaration for the specific track, (b) presents the terms with a checkbox, (c) only calls `publishMusicAsActivePostAction` when the checkbox is set and the user confirms.
- Server-action rights-ack gate that reads from `nex_account_music_rights_ack` and rejects with `rights-ack-required` if no accepted-version row covers the current terms version.
- Decision on versioning cadence: when terms change, do existing active slots require a re-ack, or does the frozen value grandfather them until the next publish?

---

## Area 3 · Actual production database and migration prerequisites

**What exists today**

- Migration 236 is AUTHORED and present at `nex-supabase/migrations/236_nex_music_active_slot_and_idempotency.sql`. The header (lines 6-14) states explicitly: *"AUTHORED · NOT YET APPLIED TO ANY DATABASE."*
- Migration 236 has a documented prerequisite ordering:
  - Expected applied already: 001 (`nex_account`), 010 (RLS helpers), 217 (search_path hardening).
  - **Must land first:** 235 (`nex_music_track`) — defines the FK target referenced in Parts A and B, plus the `visibility` and `rights_declaration` CHECK constraints the publish function reads.
- Migration 235 is also present as an untracked file at `nex-supabase/migrations/235_nex_music_track.sql`. Its application state against the authoritative Supabase project `ijvqdvsvwtwxzcqmoqit` is NOT verified in this audit (read-only; no connection established).
- Migration 237 (`nex_account_music_rights_ack`) is explicitly NOT in scope of 236 (header lines 66-69). It is a separate owner authorisation.
- Migration 219 (`nex_live_session`) is NOT a strict dependency for 236. It IS a dependency for the feed-reader at the point of composing both live-sessions AND music entries.
- The migration deliberately does NOT include `ALTER FUNCTION ... OWNER TO postgres` (header lines 72-104). The function owner is implicitly the role executing `CREATE OR REPLACE FUNCTION`, and that role must have INSERT/UPDATE/SELECT on `nex_creator_active_music`, INSERT/SELECT/DELETE on `nex_music_publish_idempotency`, SELECT (FOR UPDATE) + UPDATE on `nex_music_track`, USAGE on public schema. The migration lists the three verification checks required BEFORE applying it.
- Rollback is destructive once any active-slot rows exist. The migration documents a mandatory `pg_dump` + staging restore rehearsal pre-rollback.
- The dedup table cleanup function (`nex_music_publish_idempotency_cleanup`) has no scheduler attached — owner decision H5 (recommended 15-minute cadence) is unsealed.

**Honest limitations today**

1. Even if 235 and 236 apply cleanly, the publish function's SQLSTATE class 45 codes must be mirrored exactly by the server-action translator. The dev-FS mirror implements the same discriminated-union codes, but the production class-45 → application-code mapping is not yet wired in `_actions.ts`.
2. The dev-FS mirror does not exercise `pg_advisory_xact_lock`, so lock-contention behaviour under concurrent publishes from the same creator is not covered by any test.
3. The feed-reader currently reads from the dev-FS tracks file (`active-music-feed-reader.ts:76-85`); switching to Supabase requires either (a) replacing the dev-FS backend with `nexSupabaseAdmin` queries behind the same `listActiveMusicSlots` interface, or (b) building a parallel reader selected by an env-flag — the storage adapter uses pattern (a) today.
4. The authoritative Supabase project is `ijvqdvsvwtwxzcqmoqit` (CLAUDE.md §8). Any application of 235/236/237 to any other project is a Constitution violation.

**What needs to be true for integration-readiness**

- Owner authorisation to apply 235 to Supabase (verify its application state first; it may already be applied — this audit did not verify).
- Owner authorisation to apply 236 to Supabase, with the three function-owner-privilege checks executed in advance.
- Separate owner authorisation to draft 237, review it, and apply it.
- Scheduled job for `nex_music_publish_idempotency_cleanup()` (owner decision H5).
- Server-action SQLSTATE translator that maps class 45 codes to the discriminated-union output. (The dev-FS mirror returns the same codes directly today; the Supabase path will need the translator.)
- Replace dev-FS backing in `active-slot-repository.ts` and `active-music-feed-reader.ts` with Supabase-backed queries — behind the same interfaces so no caller changes.

---

## Area 4 · Signed audio playback and storage authorization

**What exists today**

- `getMusicStorageAdapter()` at `src/lib/nex-native/music/storage-adapter/index.ts:14` ALWAYS returns the dev-filesystem adapter. The comment (lines 5-9) is explicit: *"For v1 the only wired adapter is the dev filesystem store · the production storage provider decision is deferred to Gate 3+."*
- The dev adapter mints signed URLs of shape `/api/nex-native/music/stream?ref=…&owner=…&exp=…&sig=…`. The matching route at `src/app/api/nex-native/music/stream/route.ts` is marked DEV-ONLY in its header (lines 10-12): *"Dev-only. Production will use provider-signed URLs that Supabase/R2/S3 handle directly · this route is not shipped into production."*
- The stream route verifies: (a) the HMAC in the `sig` param, (b) the session resolved by `resolveSessionWithDevOverride`, (c) that `session.account.id === owner` (line 41).
- The feed-reader mints signed URLs with `track.owner_account_id` as the owner argument and `expiresInSeconds: 60` (`active-music-feed-reader.ts:187-194`).

**Critical finding · the dev proxy cannot serve a creator's audio to any other viewer**

The dev adapter + stream route encodes the creator's account id in the signed URL and the route requires the caller's resolved session to equal that owner. In the current wiring, Hendra's audio URL can only be loaded by Hendra. The dev smoke test proved the HTML renders the Music section and the track title — it did **not** prove that any other signed-in viewer can actually load Hendra's audio bytes. Production must either (a) switch the storage adapter to Supabase Storage signed URLs (which validate the signature regardless of viewer identity), or (b) replace the route's owner-equality check with a feed-eligibility check that permits any authenticated viewer when the slot is active and the track is eligible.

**Other honest limitations today**

1. 60-second TTL. A card that remains on screen longer than 60 seconds mid-playback will have a dead URL on seek. No refresh logic exists.
2. The adapter interface (`storage-adapter/types.ts`) is already provider-neutral, so swapping to a Supabase-backed implementation is scoped to one file — but the switch has not been authored.
3. `background_image_url` and `cover_image_url` use the same signing mechanism. Covers and backgrounds in the feed also go through the dev-only proxy with the same per-viewer gating problem.
4. There is no CDN layer in front of the proxy. Even if the gating were correct for production, the proxy's `Cache-Control: private, no-store` would prevent edge caching, which is the opposite of what a public music feed needs.

**What needs to be true for integration-readiness**

- A production storage decision (Supabase Storage bucket vs R2 vs S3) with signed-read URLs that validate the signature without requiring caller == owner.
- A Supabase-storage adapter implementation behind the existing `MusicMediaStorage` interface.
- Signed-URL TTL ≥ expected max dwell time on a single card (e.g., 10 minutes) plus a client-side refresh mechanism, OR much longer TTLs if the storage provider enforces its own request-time ACL.
- CDN/edge-cache strategy for public covers and audio (`Cache-Control: public, max-age=…`) with cache-key stability across viewers.
- Explicit audit of which URL variants need `no-store` (dev proxy currently uses it blanket) versus which can be edge-cached.
- Server-rendered feed must choose provider-signed URLs when the Supabase adapter is active, and the dev-only `/api/.../music/stream` route must not be deployed to production (`middleware.ts` or a deployment-ignore config).

---

## Area 5 · Audio behavior when users swipe between music posts

**What exists today**

- `/live-commerce/feed` is a **vertical-scroll grid**, not a swipe-paginated carousel (`feed/page.tsx:357-391`; `display: grid, gap: 16`). "Swipe between posts" in the owner's question corresponds to a user scrolling the music section — there is no horizontal pager.
- Only the FIRST music card receives `isActive={idx === 0}` (`feed/page.tsx:386`). All subsequent music cards receive `isActive={false}`.
- `MusicFeedCard`'s effect (lines 95-111) auto-pauses whenever `isActive` is false, and auto-plays whenever `isActive` is true AND the network is not `saveData`/`2g`/`slow-2g`. It also pauses on `visibilitychange → hidden` (lines 115-126) and on unmount (effect cleanup).
- Card header comment (lines 12-18) describes a "shared coordinator" and a "one audio-source invariant". **No shared coordinator exists in code.** Each card's effect is self-contained. Only the parent-driven `isActive` flag enforces the "one at a time" rule, and only for the first card.

**Honest limitations today**

1. **No user-interaction-driven play.** If a viewer scrolls past the first music card to a second one, that second card does NOT start playing — it still has `isActive={false}` and the effect holds it paused. There is no tap-to-play handler. The viewer cannot actually listen to the second creator's music through the feed as currently implemented.
2. **No "which card is on screen" detection.** No `IntersectionObserver` wiring to re-elect the active card based on scroll position. The first-card autoplay semantics are a static landing-on-feed decision, not a swipe decision.
3. **No cross-card arbitration.** If two cards somehow both have `isActive={true}` (impossible under the current parent-rendered flag, but possible under any future variation), their audio elements would play simultaneously. The header comment's "shared coordinator" is aspirational, not implemented.
4. **Autoplay-on-landing may violate the sealed NEX World-Class Mobile Engineering Standard 2026-10-30** (Tier 3 principle: *"autoplay only for active session continuation"*). Landing cold on the feed and immediately starting Hendra's music without an explicit tap is NOT a continuation of an active session. Needs owner confirmation.
5. **No prefetch/warm-cache for upcoming cards.** The 60-second signed-URL TTL interacts badly with scroll-ahead patterns.
6. **Unmount cleanup pauses but does not null the src** (contrary to the file-header comment). Buffered bytes remain in memory until the audio element is garbage-collected. Minor leak on long sessions.

**What needs to be true for integration-readiness**

- A real audio coordinator: single `useRef` / context / module-level store that holds "which card is playing", and each card's play attempt first calls `coordinator.claim(cardId)` which pauses the previous holder.
- Scroll-driven active-card re-election via `IntersectionObserver`, with a hysteresis threshold so micro-scrolls don't thrash.
- Owner decision on autoplay-at-feed-landing. Default recommendation: NO autoplay; the first card renders paused with a visible play affordance. The W-C-M-E Standard tie-in supports this.
- A `tap-to-play` handler on every card that calls `coordinator.claim(cardId)` + `media.play()`.
- Signed-URL refresh when the TTL approaches expiry on an active card.
- Prefetch cover art and audio metadata for the next 1-2 cards (not the full audio bytes until the user interacts).

---

## Area 6 · Regression coverage for existing camera-based Go Live, Video, and Shop feed entries

**What exists today**

- Feed-page section order (`feed/page.tsx:252-429`):
  1. Header with context-aware Go Live CTA (unchanged · lines 263-334).
  2. **Live sessions** section OR `EmptyState` (unchanged · lines 336-351). Cards use `LiveProductIndicator` for the TTL-driven live pill.
  3. **Music on NEX** section (new, between Live and Recorded · lines 353-391). Only renders when `musicEntries.length > 0`.
  4. **Recorded videos** section (unchanged · function at line 432). Reads from dev-manifest or `listPublishedUploadedVideos`, filtered by viewer category prefs.
  5. **Community posts** TBD banner (unchanged · lines 402-427).
- `hydrateFeed` and `listActiveMusicFeedEntries` run in parallel (`Promise.all`, line 192). Both fail-open; a music error is caught in the Supabase account-lookup `try/catch` and returns an empty entry list.
- The Music section renders ZERO DOM when `musicEntries.length === 0` — no header, no empty-state, no space. Empty-state regression surface area: nil.
- The new feed-page import `listActiveMusicFeedEntries` + `MusicFeedCard` adds two names; neither shadows an existing identifier.
- The context-aware Go Live CTA logic (`viewerHasActiveBroadcast`) is untouched. The CTA still routes to `/nex-native/live-commerce/enter-broadcast-room`.
- Live-session cards still link to `/nex-native/live-commerce/${sessionId}` (line 591). The in-session Shop/Products overlay is reached from there and is not referenced from this file at all. No cross-wiring with the new music path.
- `MusicFeedCard` does NOT render any add-to-cart or product indicator. Shop journeys are architecturally separate from the music card.

**Honest limitations today**

1. The audit above is static code reading. No regression test was executed against the live-sessions path, the Shop journeys, or the recorded-videos path. The dev smoke script verified only the music path's HTML presence.
2. The music section inserts between Live and Recorded. Owner has not confirmed this ordering is desired — the sealed memory records the ordering as a landed implementation detail of M-3, but H1 (interleave policy) remains unsealed.
3. If the Music section renders a signed audio URL that fails to load (production proxy-mismatch per Area 4), the card still renders cover + title + owner — but the viewer sees a silent play icon with no feedback that the audio is broken. No visible error state is wired on the card.
4. No visual-regression test (screenshot or Playwright assertion) covers the four-way composition of the feed with a music card present. The dev smoke test's "HTML contains 'Music on NEX'" check is a presence probe, not a layout probe.

**What needs to be true for integration-readiness**

- Playwright or vitest coverage for:
  - Live-session card renders unchanged when music entries also exist.
  - Recorded-videos section renders unchanged when music entries also exist.
  - Empty music-section renders ZERO DOM.
  - Go Live CTA state (Return to Live vs Go Live vs guest) across all three combinations of (has-active-session, has-music, has-recorded).
- Owner confirmation of the music-between-live-and-recorded ordering (unseal H1 or seal a different one).
- Visual-error state on `MusicFeedCard` when audio fails to load (fallback cover + visible "audio unavailable" hint).
- Confirmation that the sealed Shop journey entry points (`live-commerce/[sessionId]/_viewer-client.tsx`) are unaffected — this audit confirms they are not referenced from the music path, but a live regression check against a seeded live-session + music + recorded-video combination has not been executed.

---

## Summary · what blocks release today

| # | Blocker | Owner / claude / joint |
|---|---|---|
| 1 | Dev-impersonation gate at the publish server action | joint · D11-B unseal → claude |
| 2 | Owner-authored rights-terms text | owner |
| 3 | Migration 237 drafted + reviewed + applied | owner authorises · claude drafts under separate scope |
| 4 | Migration 235 + 236 applied to Supabase `ijvqdvsvwtwxzcqmoqit` | owner authorises · joint apply |
| 5 | Server-action SQLSTATE translator (class 45 → discriminated-union codes) | claude under separate authorisation |
| 6 | Production storage adapter + Supabase-signed audio URLs | owner picks storage · claude implements |
| 7 | Replace dev-FS reader with Supabase reader | claude under separate authorisation |
| 8 | Audio coordinator + IntersectionObserver + tap-to-play on `MusicFeedCard` | claude under separate authorisation |
| 9 | Owner decision on autoplay-at-landing (W-C-M-E Standard tie-in) | owner |
| 10 | Regression suite covering Live + Music + Recorded combinations | claude under separate authorisation |
| 11 | `nex_music_publish_idempotency_cleanup()` scheduler (H5) | owner picks cadence · joint wire |
| 12 | Feed audio-error visible state on `MusicFeedCard` | claude under separate authorisation |

**Nothing in this audit modifies working-tree code.** Each row above is a separate authorisation gate.
