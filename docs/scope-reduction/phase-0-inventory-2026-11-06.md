# Phase 0 Scope Reduction Inventory (2026-11-06)

**Status**: READ-ONLY DISCOVERY SCAN COMPLETE  
**Scope**: NEX app removal of Live, Music, Community, Trade Centre, and Staircase surfaces  
**Owner Decision Needed**: See Section 6  

---

## Section 1 — Inventory of files to remove, grouped by surface

### 1.1 Live Commerce (93 files total)

#### Pages & Routes
- src/app/nex-native/live-commerce/ (22 files)
  - page.tsx, _create-live-session-action.ts, _video-viewer-client.tsx, _music-viewer-client.tsx
  - go-live/ (page, actions)
  - live-finished-preview/ (page, actions)

#### API Routes
- src/app/api/nex-native/live-commerce-invite-target/route.ts
- src/app/api/nex-native/manage/live-token-create/route.ts
- src/app/api/nex-native/manage/live-session-end/route.ts

#### Components (25 files)
- src/components/nex-native/live-commerce/ - LiveViewerFooter, BroadcasterLibrarySheet, MessagePanel, LiveSideDrawer, VideoShareSheet, CategoryGridSheet, HendraMessageInbox, VideoCommentsOverlay, LiveSignalBadge, LiveProductIndicator, and 15+ supporting components

#### Libraries (46 files)
- src/lib/nex-native/live-broadcast/ (40 files) - broadcast-engine.ts, session-service.ts, viewer-analytics.ts, product-showcase.ts, live-message-handler.ts
- src/lib/nex-native/live-feed/ (6 files) - active-live-feed-reader.ts, live-feed-scatter.ts, types.ts

#### Migrations (8 files)
- 
ex-supabase/migrations/029_nex_live_post.sql
- 
ex-supabase/migrations/219_nex_live_session_and_featured_product.sql
- 
ex-supabase/migrations/222_nex_live_engagement.sql
- 
ex-supabase/migrations/226_nex_live_participation.sql
- 
ex-supabase/migrations/233_nex_live_post_directory_v.sql
- 
ex-supabase/migrations/234_nex_live_jail.sql
- 
ex-supabase/migrations/218_nex_rls_harden_peer_message_and_live_post.sql
- 
ex-supabase/migrations/221_nex_uploaded_video_is_ai_generated.sql

#### Doctrine (14 files)
- nex-live-eligibility-contract-2026-10-27.md
- nex-live-catalogue-implementation-plan-2026-10-28.md
- nex-live-deferred-features-2026-10-24.md
- nex-live-data-path-verification-2026-10-24.md
- nex-live-feed-ranking-brainstorm-2026-10-24.md
- nex-live-interaction-feature-contract-2026-10-24.md
- nex-live-migrations-apply-procedure-2026-10-24.md
- nex-live-sandbox-pre-apply-report-2026-10-24.md
- nex-live-uploaded-video-contract-2026-10-24.md
- nex-live-video-streaming-roadmap-2026-10-27.md
- nex-card-a-go-live-flow-sealed-2026-10-28.md (SEALED)
- nex-commerce-live-relationship-plan-2026-10-24.md
- nex-manage-live-token-audit-2026-10-28.md
- nex-harvest-to-directory-live-update-trace-2026-10-27.md

#### Scripts
- scripts/live-broadcast-sandbox-apply.sh

---

### 1.2 Music (36 files total)

#### Pages & Routes
- src/app/nex-native/music/ (1 file)
- src/app/nex-native/create/upload-music/ (all upload flow files)

#### API Routes (2 files)
- src/app/api/nex-native/music/track-list/route.ts
- src/app/api/nex-native/music/active-tracks/route.ts

#### Components (12 files)
- src/components/nex-native/music/ - NexMusicPlayerOverlay, MusicActionsStack, MusicLibraryOverlay, DevViewerBadge, MusicDescriptionAffordance, MusicPostShell, MusicLiveCelebration, music-post-shell-helpers.ts

#### Libraries (18 files)
- src/lib/nex-native/music/ - music-repository.ts, music-upload-validation.ts, music-rate-limit.ts, active-slot-repository.ts, owner-my-music-target.ts, music-url-validators.ts, types.ts, active-music-feed-reader.ts, storage-adapter/

#### Migrations (4 files)
- 
ex-supabase/migrations/235_nex_music_track.sql
- 
ex-supabase/migrations/236_nex_music_active_slot_and_idempotency.sql
- 
ex-supabase/migrations/240_nex_account_music_rights_ack.sql
- 
ex-supabase/migrations/241_nex_music_media_bucket.sql

#### Doctrine (9 files)
- nex-main-feed-public-music-listening-design-2026-10-30.md
- nex-music-directory-architecture-draft-2026-10-30.md
- nex-music-directory-phase-1-build-plan-draft-2026-10-30.md
- nex-music-orphan-storage-cleanup-DRAFT-2026-10-31.md
- nex-music-production-apply-order-playbook-2026-10-31.md
- nex-music-publishing-integration-readiness-audit-2026-10-30.md
- nex-music-publishing-to-live-feed-design-contract-DRAFT-2026-10-30.md
- nex-music-upload-contract-DRAFT-2026-10-29.md

#### Scripts
- scripts/music-publish-idempotency-backfill.sh

---

### 1.3 Community Notice (37 files total)

#### Pages & Routes
- src/app/nex-native/community/ (15 files) - all community surface pages

#### API Routes (13 files)
- src/app/api/nex-native/community/ (9 files)
- src/app/api/nex-native/manage/community-discovery/route.ts

#### Components
- src/app/nex-native/contacts/_community-notice-card.tsx
- src/app/nex-native/contacts/_community-card.tsx

#### Libraries (9 files)
- src/lib/nex-native/community/ - membership-service.ts, notice-service.ts, zone-service.ts, lost-found-service.ts, photo-upload-service.ts, business-discovery-service.ts, rate-limit.ts, types.ts

#### Migrations (8 files)
- 
ex-supabase/migrations/146_nex_community_watch_core.sql
- 
ex-supabase/migrations/147_nex_community_zone_seed_id_yogyakarta.sql
- 
ex-supabase/migrations/148_nex_community_phase2a_card_primitives.sql
- 
ex-supabase/migrations/149_nex_community_phase2a_notification_prefs.sql
- 
ex-supabase/migrations/150_nex_community_phase2a_lost_found.sql
- 
ex-supabase/migrations/151_nex_community_photo_bucket.sql
- 
ex-supabase/migrations/152_nex_community_phase2b_business_welcome.sql
- 
ex-supabase/migrations/197_nex_community_rate_limit_peer_message_guest.sql

---

### 1.4 Dev Prototypes (Live) (8 files)

- src/app/nex-native/dev/live-chip-ttl-harness/page.tsx
- src/app/nex-native/dev/live-persona/page.tsx
- src/app/nex-native/dev/live-seller/page.tsx
- src/app/nex-native/dev/live-viewer/page.tsx
- Supporting _actions.ts and test files (4 files)

---

### 1.5 Trade Centre / Staircase (64 files total)

- src/lib/nex/centre/ (3 files)
- src/lib/nex/centre-publishing/ (17 files) - directorySeedLoader.ts with RefacingCapabilityKey
- src/components/nex-app/centre/ (13 files)
- src/lib/nex/staircase*/ (31 files distributed) - staircase, staircase-bridge, staircase-advisor, staircase-geometry, staircase-components, and brain/agent/knowledge references

**Note**: No explicit migrations for Trade Centre in nex-supabase (trades logic in parallel repo).

---

### 1.6 Starter Pack

**Status**: Already preserved on phase-u branch; no code found on phase-x base. No action needed on phase-x.

---

### 1.7 Power Tokens & Sponsorship

**Status**: Future concepts with no code found yet.

---

## Section 2 — Shared infrastructure touched by removed surfaces

### 2.1 Middleware & Auth
- Potential live-session or music-upload checks in src/middleware.ts

### 2.2 Server Actions
- Root app actions in src/app/nex-native/_actions.ts may contain live/music post actions
- Music upload actions linked to feed viewer in src/app/nex-native/nex-feed/[videoId]/_actions.ts

### 2.3 Storage Buckets (Supabase)
- 
ex_music_media bucket (mig 241) — orphaned when music removed
- 
ex_community_photo bucket (mig 151) — orphaned when community removed
- Live video storage implied by mig 221 — orphaned when live removed

### 2.4 RLS Policies
- 
ex_live_post RLS policy (migs 29, 218) — orphaned
- 
ex_community_notice RLS policies (migs 146+) — orphaned
- Music publish idempotency RLS on 
ex_music_publish_idempotency (mig 236) — orphaned

### 2.5 Environment Variables
- LIVE_SESSION_MAX_VIEWERS, MUSIC_UPLOAD_QUOTA_MB, MUSIC_ACTIVE_SLOT_LIMIT, COMMUNITY_ZONE_SEED_* potentially in .env or next.config.mjs

### 2.6 Nav/Menu Config
- Check src/app/nex-native/_shell.tsx for live, music, community nav entries

### 2.7 Type Definitions
- src/lib/nex-native/community/types.ts - NexCommunityRateLimitError (used by chat)
- src/lib/nex-native/music/types.ts - NexMusicTrackRow (imported by 14+ files)
- src/lib/nex-native/live-broadcast/types.ts - Live session types

---

## Section 3 — Imports from KEPT surfaces into REMOVED surfaces (rewire targets)

### Rewire Target 1: Chat → Community Rate-Limit
**File**: src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts
**Lines**: ~20-21 import recordIfAllowed, NexCommunityRateLimitError from community
**Decision**: Inline rate-limit, stub, or disable guest message limits?

### Rewire Target 2: nex-feed → Music & Live (CRITICAL)
**File**: src/app/nex-native/nex-feed/[videoId]/page.tsx
**Issue**: 10+ imports from music lib, music types
**Decision**: Delete nex-feed or retarget to shop-only?

### Rewire Target 3: Music Preview → Live Components
**File**: src/app/nex-native/create/upload-music/preview/[trackId]/_preview-client.tsx
**Issue**: LiveSideDrawer, HendraMessageInbox, VideoShareSheet, goLive flow
**Decision**: Delete "go live from music" feature or replace with shop upsell?

### Rewire Target 4: Contacts → Community Cards
**File**: src/app/nex-native/contacts/_contacts-list.tsx
**Issue**: Imports CommunityNoticeCard
**Decision**: Remove community notice from contacts

### Rewire Target 5: nex-feed Video Viewer → Live Components (CRITICAL)
**File**: src/app/nex-native/nex-feed/[videoId]/_video-viewer-client.tsx
**Issue**: 10+ imports from live-commerce components
**Decision**: Delete or refactor?

**Summary**: 14 files in KEPT surfaces import from REMOVED surfaces. 2 critical (nex-feed).

---

## Section 4 — Sealed holds that removal would retire

### 4.1 Live Broadcast (R9 DRAFT)
**Document**: docs/doctrine/nex-card-a-go-live-flow-sealed-2026-10-28.md
**State**: DRAFT (not applied to prod)
**Implication**: No reversal migration needed; tables orphaned but not actively used

### 4.2 Music Publishing (M-2..M-6, Applied 2026-10-31)
**Migrations 235, 236, 240, 241**: Already APPLIED TO PROD on ijvqdvsvwtwxzcqmoqit
**Implication**: Stranded data in nex_music_track, nex_creator_active_music, nex_music_publish_idempotency tables

### 4.3 Community Notice
**Migrations 146–197**: Likely applied to prod early 2026
**Implication**: Stranded data in nex_community_notice, nex_community_card, nex_community_zone tables

### 4.4 Starter Pack (Phase-U B3b)
**Status**: On phase-u branch, not on phase-x

---

## Section 5 — Database migrations applied-to-prod that would be stranded

### Applied Music Migrations (2026-10-31)
- 235: nex_music_track table
- 236: nex_creator_active_music, nex_music_publish_idempotency
- 240: nex_account_music_rights_ack
- 241: nex_music_media bucket

### Applied Community Migrations (Early 2026)
- 146: nex_community_notice core tables
- 147: Community zones (Yogyakarta seed)
- 148: Card primitives
- 149: Notification prefs
- 150: Lost & Found (nex_community_card)
- 151: Photo bucket
- 152: Business welcome
- 197: Guest message rate-limit

### Applied Live Migrations (Status TBD)
- 029: nex_live_post
- 219: nex_live_session, nex_live_featured_product
- 222: nex_live_engagement
- 226: nex_live_participation
- 233: Live post directory view
- 234: nex_live_jail

### Reversal Plan Needed
Owner must decide in Phase 1c:
1. Archive data to JSON export
2. Write rollback migrations (~257–260)
3. Delete Supabase storage buckets (nex_music_media, nex_community_photo)

---

## Section 6 — Ambiguities / owner decisions needed

1. **nex-feed surface**: Is /nex-native/nex-feed/ deleted or retargeted to shop-only?

2. **Guest chat rate-limiting**: Should guest messages have rate limits post-community removal?

3. **Daily Discovery scatter**: Is shop-only product-of-day feature separate from music/live scatter logic?

4. **Directory schema joins**: Do schema joins like 
ex_business JOIN nex_live_session exist? Scan required.

5. **Dev diagnostic tools** (src/app/nex-native/dev/live-*): Are these actively used or can they be deleted?

6. **Starter Pack residue**: Verify phase-u still holds work and no code has been ported back.

7. **Staircase/Centre tradeability**: Is Trade Centre:
   - A) Live working code synced from trades-monorepo (requires coordination)?
   - B) Isolated prototypes (safe to delete)?

8. **RefacingCapabilityKey usage**: Only centre-publishing and staircase use it. Safe to remove with Trade Centre.

9. **nex-intelligence gateway** (src/lib/nex-native/intelligence/nex-intelligence-gateway.ts): Is this staircase AI agent reference or general LLM gateway?

10. **Migrations 244–256 scope**: Are these (country, visibility, age-gate, moderation) music-specific or music-agnostic? Most appear KEPT. Verify.

---

## Section 7 — Size estimate

| Surface | Files | Approx Lines | Status |
|---------|-------|--------------|--------|
| Live Commerce | 93 | ~12,000 | Pages + components + lib + API + migs + doctrine |
| Music | 36 | ~4,500 | Pages + upload + components + lib + migs |
| Community | 37 | ~5,200 | Pages + API + components + lib + migs |
| Dev (live) | 8 | ~800 | Diagnostic harnesses |
| Trade Centre / Staircase | 64 | ~8,000 | Centre + staircase lib + components |
| Doctrine (removed) | 23 | ~15,000 | Planning docs |
| Migrations (removed) | 20 | ~3,000 | SQL DDL/RLS |
| API Routes | 15 | ~2,000 | Endpoints |
| Scripts | 2 | ~500 | Utilities |
| **TOTAL** | **276** | **~50,000** | ~1–2% of codebase |

---

## Summary

- **238 application code files** across 5 surfaces
- **20 database migrations** (4 applied to prod)
- **14 rewire targets** found; 2 critical
- **10 ambiguities** requiring owner decision
- **0 Starter Pack, Power Tokens, Sponsorship code** on phase-x (as expected)

**Next**: Owner reviews Section 6 ambiguities. Phase 1a produces final deletion checklist.