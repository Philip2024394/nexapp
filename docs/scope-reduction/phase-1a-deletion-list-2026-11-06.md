# Phase 1a · Reviewed Deletion List (2026-11-06)

**Status: AWAITING OWNER SIGN-OFF**
**Scope: Chat + Themes + Shop + Vault retention. Remove Live, Music, Community Notice, Trade Centre, Staircase, nex-feed, Dev-live diagnostics.**
**Branch: `phase-x/scope-reduction-chat-themes-shop-vault-2026-11-06`**
**Base: phase-v tip (inherits P1-P24 shop setup work)**

Read-only phase. No `git rm`, no edits to app code. This file is the single artefact produced by Phase 1a.

---

## 0 · Owner decisions already locked (2026-11-06)

1. **nex-feed (`/nex-native/nex-feed/[videoId]` + its component imports) → DELETE ENTIRELY.** Shop product videos are handled by shop surfaces inherited from phase-v P1-P24.
2. **Trade Centre + Staircase → DELETE from nexapp** (they live in the trades repo).
3. **Daily Discovery:** KEEP the Shop product-of-day feature (`nex_product.discovered_at`, partial UNIQUE index, SECURITY DEFINER publish RPC). REMOVE music/live pool composition + scatter rules from feed composer.
4. **Dev live diagnostic tools (`/dev/live-*`, 8 files) → DELETE.**

---

## 1 · Final deletion list (per surface)

### 1.1 Live Commerce (route pages, API routes, components, lib)

Route pages (all files recursively):
- [ ] `src/app/nex-native/live-commerce/page.tsx`
- [ ] `src/app/nex-native/live-commerce/_invite-target-action.ts`
- [ ] `src/app/nex-native/live-commerce/[sessionId]/` (dir, incl. `_viewer-client.tsx`)
- [ ] `src/app/nex-native/live-commerce/discover/`
- [ ] `src/app/nex-native/live-commerce/enter-broadcast-room/` (incl. `_go-live-client.tsx`)
- [ ] `src/app/nex-native/live-commerce/feed/`
- [ ] `src/app/nex-native/live-commerce/go-live/`
- [ ] `src/app/nex-native/live-commerce/guidelines/`
- [ ] `src/app/nex-native/live-commerce/jail-preview/` (incl. `_preview-client.tsx`)
- [ ] `src/app/nex-native/live-commerce/library/`
- [ ] `src/app/nex-native/live-commerce/live-finished-preview/`
- [ ] `src/app/nex-native/live-commerce/studio/`
- [ ] `src/app/nex-native/live-commerce/welcome/`
- [ ] `src/app/nex-native/manage/live/` (entire dir)

API routes:
- [ ] `src/app/api/nex-native/manage/live-token-create/route.ts`
- [ ] `src/app/api/nex-native/manage/live-session-end/route.ts`
- [ ] (any `src/app/api/nex-native/live-commerce-invite-target/` — Phase 0 listed, now absent → confirm no residue)

Components (entire `src/components/nex-native/live-commerce/` dir, 24 files):
- [ ] `_live-feed-preferences.tsx`
- [ ] `BroadcasterLibrarySheet.tsx`
- [ ] `BuyNowButton.tsx`
- [ ] `CategoryGridSheet.tsx`
- [ ] `HendraMessageInbox.tsx`
- [ ] `JailOverlay.tsx`
- [ ] `JailPickerSheet.tsx`
- [ ] `LiveCommentsOverlay.tsx`
- [ ] `LiveHeartbeatRing.tsx`
- [ ] `LiveProductIndicator.tsx`
- [ ] `LiveSideDrawer.tsx`
- [ ] `LiveSignalBadge.tsx`
- [ ] `LiveViewerFooter.tsx`
- [ ] `MessagePanel.tsx`
- [ ] `MusicFeedCard.tsx`
- [ ] `NexLiveFirstVisitSplash.tsx`
- [ ] `ProductOverlayCard.tsx`
- [ ] `ShopLiveStrip.tsx`
- [ ] `VideoCommentsOverlay.tsx`
- [ ] `VideoLikeButton.tsx`
- [ ] `VideoShareSheet.tsx`
- [ ] `ViewerMenuSheet.tsx`
- [ ] `WatchOverlayCaption.tsx` → **flagged**: used by `src/app/nex-native/manage/watches/new/_upload-client.tsx`. Decide: port watch overlay out of live-commerce dir OR remove watch upload. See Remaining-Owner-Decisions Q1.
- [ ] `__tests__/` subdirectory

Library (`src/lib/nex-native/live-broadcast/`, 23 TS files + `__tests__`):
- [ ] `broadcast-engine.ts`, `broadcast-peer.ts`, `category-chain.ts`, `dev-video-manifest.ts`, `directory-live-state.ts`, `featured-product-channel.ts`, `feed-ranking-service.ts`, `invite-target.ts`, `jail-channel.ts`, `jail-list-service.ts`, `live-comments-channel.ts`, `live-eligibility.ts`, `live-session-service.ts`, `live-welcome-acceptance.ts`, `market-cta-resolver.ts`, `participation-engagement-service.ts`, `participation-ledger-service.ts`, `shop-contacts-dedup.ts` → **flagged**: used by `manage/shop-contacts`? Verify — likely KEEP + move to shared lib. See Q2.
- [ ] `stale-session-policy.ts`, `types.ts`, `uploaded-video-service.ts` → **flagged**: feeds the shop/business product video surface. Keep + extract (see Q3).
- [ ] `use-live-clock-tick.ts`, `viewer-client.ts`, `__tests__/`

Library (`src/lib/nex-native/live-feed/`, 4 TS files + `__tests__`):
- [ ] `feed-categories.ts`, `feed-preferences-cookie.ts`, `feed-preferences-filter.ts`, `feed-shuffle.ts`, `__tests__/feed-preferences.test.ts`, `__tests__/feed-shuffle.test.ts`

### 1.2 Music

Route pages:
- [ ] `src/app/nex-native/music/page.tsx`
- [ ] `src/app/nex-native/create/upload-music/` (entire dir: `_actions.ts`, `_upload-client.tsx`, `page.tsx`, `preview/[trackId]/page.tsx`, `preview/[trackId]/_preview-client.tsx`)

API routes:
- [ ] `src/app/api/nex-native/music/upload/route.ts`
- [ ] `src/app/api/nex-native/music/stream/route.ts`
- [ ] (Phase 0 mentioned `music/track-list` + `music/active-tracks` — the current tree only has `stream` + `upload`. Remove whatever exists.)

Components (entire `src/components/nex-native/music/` dir):
- [ ] `_account-music-preloader.tsx`, `DevViewerBadge.tsx`, `MusicActionsStack.tsx`, `MusicDescriptionAffordance.tsx`, `MusicLibraryCard.tsx`, `MusicLibraryOverlay.tsx`, `MusicPlayerDock.tsx`, `MusicPostShell.tsx`, `music-post-shell-helpers.ts`, `MusicWaveform.tsx`, `NexMusicPlayerOverlay.tsx`, `RightsAckModal.tsx`

Library (entire `src/lib/nex-native/music/` dir):
- [ ] `account-music-preload.ts`, `active-music-feed-reader.ts`, `active-slot-repository.ts`, `live-audio-mixer.ts`, `music-duration-probe.ts`, `music-rate-limit.ts`, `music-repository.ts`, `music-upload-validation.ts`, `music-url-validators.ts`, `owner-my-music-target.ts`, `rights-ack.ts`, `types.ts`, `storage-adapter/` (whole subtree), `__tests__/`

### 1.3 Community Notice

Route pages (entire `src/app/nex-native/community/` dir):
- [ ] `_actions.ts`, `_guest-default-zone.ts`, `_palette.ts`, `page.tsx`
- [ ] `chat/`, `compose/`, `feed/`, `lost-found/`, `notices/`, `select/`, `settings/`

API routes (entire `src/app/api/nex-native/community/` dir):
- [ ] `lost-found/` (route + children), `membership/route.ts`, `notices/` (route + children), `zones/route.ts`, `zones/suggest/route.ts`
- [ ] `src/app/api/nex-native/manage/community-discovery/route.ts`
- [ ] `src/app/nex-native/manage/community-discovery/` (route page)

Contacts cards (community-coupled):
- [ ] `src/app/nex-native/contacts/_community-notice-card.tsx`
- [ ] `src/app/nex-native/contacts/_community-card.tsx`

Library (entire `src/lib/nex-native/community/` dir):
- [ ] `business-discovery-service.ts`, `lost-found-service.ts`, `membership-service.ts`, `notice-service.ts`, `photo-upload-service.ts`, `rate-limit.ts`, `types.ts`, `zone-service.ts`, `__tests__/`

### 1.4 nex-feed (both route tree and route lib)

- [ ] `src/app/nex-native/nex-feed/page.tsx`
- [ ] `src/app/nex-native/nex-feed/[videoId]/page.tsx`
- [ ] `src/app/nex-native/nex-feed/[videoId]/_video-viewer-client.tsx`
- [ ] `src/app/nex-native/nex-feed/[videoId]/_music-viewer-client.tsx`
- [ ] `src/lib/nex-native/nex-feed/nex-feed-entries.ts` (composer that joins videos + music)
- [ ] `src/lib/nex-native/nex-feed/ireland-feed-reader.ts` (country-feed reader that uses music types)
- [ ] `src/lib/nex-native/nex-feed/country-feed-mode.ts` → **flagged**: tiny pure cookie reader. Could KEEP + repoint from a future Shop surface. Default: DELETE with feed; re-introduce from shop side if needed. See Q4.
- [ ] `src/components/nex-native/nex-feed/_seller-shop-drawer.tsx` → **flagged**: only consumed by nex-feed page. Delete with surface. If shop drawer pattern is reused anywhere else — currently zero other imports.
- [ ] `src/components/nex-native/nex-feed/_world-globe-spin.tsx`
- [ ] `src/components/nex-native/nex-feed/CountryFeedSwitcher.tsx`
- [ ] `src/components/nex-native/nex-feed/FeedModeEntryOverlay.tsx`

### 1.5 Dev prototypes (Live + Music diagnostic harnesses)

- [ ] `src/app/nex-native/dev/live-chip-ttl-harness/` (entire dir, page.tsx + `_actions.ts` if present)
- [ ] `src/app/nex-native/dev/live-persona/[handle]/page.tsx` (+ any siblings)
- [ ] `src/app/nex-native/dev/live-seller/` (entire)
- [ ] `src/app/nex-native/dev/live-viewer/` (entire)
- [ ] `src/app/nex-native/dev/_dev-live-phone-frame.tsx`
- [ ] `src/app/nex-native/dev/message-panel-fixture/page.tsx` (imports `MessagePanel` from live-commerce)
- [ ] (watches-upload-preview reads `WatchOverlayCaption` from live-commerce; relates to Q1)

### 1.6 Trade Centre (nexapp fork — moves to trades app)

- [ ] `src/lib/nex/centre/` entire dir (`_mock.ts`, `_sections_mock.ts`, `_types.ts`)
- [ ] `src/lib/nex/centre-publishing/` entire dir (18 files): `categories.ts`, `collectorNotifications.ts`, `directorySeedLoader.ts`, `directorySeedsDb.ts`, `imageMatcher.ts`, `imageMatcher.test.ts`, `index.ts`, `indexForSearch.ts`, `indexForSearch.test.ts`, `mockFeed.ts`, `paidMemberEntitlements.ts`, `preloadCache.ts`, `publishToFeed.ts`, `refacingMembership.ts`, `stairpartsPool.test.ts`, `tradeCategoryRegistry.ts`, `types.ts`
- [ ] `src/components/nex-app/centre/` entire dir: `CountryPicker.tsx`, `DiagramCard.tsx`, `interstitials.ts`, `MerchantProfileSheet.tsx`, `NexBottomSheet.tsx`, `NexCentreFilterSheet.tsx`, `NexCentreLiveFeed.tsx`, `NexCentreShell.tsx`, `NexPinterestFeed.tsx`, `ProductDetailsSheet.tsx`, `SupplierCard.tsx`, `SupplierSheet.tsx`, `WhatsAppProtectionModal.tsx`
- [ ] `src/components/nex-app/shell/CentreFeedPreloader.tsx` (preloader for centre feed)
- [ ] `src/components/nex-app/refacing/TradeProfileSheet.tsx` (consumes `CentreFeedItem` + `REFACING_CAPABILITY_LABELS`)
- [ ] `src/lib/nex/collection/urlQueueProcessor.ts` → **flagged**: entire web-scraping harvester queue depends on `centre-publishing/directorySeedLoader` + `centre-publishing/tradeCategoryRegistry` + `centre-publishing/directorySeedsDb`. Harvester also uses `RefacingCapabilityKey` via `candidateExtractor.ts`. See Q5.
- [ ] `src/lib/nex/collection/candidateExtractor.ts` → **flagged**: uses `RefacingCapabilityKey`. If harvester stays, must rewire to a nexapp-native capability enum. See Q5.

### 1.7 Staircase

- [ ] `src/lib/nex/staircase/` (entire dir)
- [ ] `src/lib/nex/staircase-advisor/` (entire dir)
- [ ] `src/lib/nex/staircase-bridge.ts`
- [ ] `src/lib/nex/staircase-components/` (entire dir)
- [ ] `src/lib/nex/staircase-geometry/` (entire dir)
- [ ] `src/lib/nex/refacing/` (entire dir — staircase sibling)
- [ ] `src/lib/nex/brain/agents/staircase.ts` (imports `StaircaseDesignState`)
- [ ] `src/lib/nex/est/trades/staircase.ts` (imports `StaircaseDesignState`)
- [ ] `src/lib/nex/tools/handlers/staircase-design.ts`
- [ ] `src/lib/nex/authoring/health.ts` → **flagged**: imports `getTruthIndex` + `getSemanticIndexStats` from `staircase-advisor`. See Q6.
- [ ] `src/lib/nex/authoring/coverage.ts` → **flagged**: imports `getTruthIndex, IndexedSnippet` from `staircase-advisor`. See Q6.

### 1.8 Non-shop Daily Discovery (scope-trim, not whole-file delete)

Only the music/live composition in `nex-feed-entries.ts` goes away (whole file deletes with nex-feed §1.4). No separate action.

**KEEP** (Daily Discovery Shop):
- `nex_product.discovered_at` column (not yet merged; lands with phase-v P-D)
- partial UNIQUE index `(business_id, ((discovered_at AT TIME ZONE 'UTC')::date))`
- SECURITY DEFINER publish RPC pattern
These do not exist on phase-x base — they land in phase-v or later. Nothing to delete here.

---

## 2 · Migrations (grouped by surface)

Applied-to-prod evidence basis:
- `docs/doctrine/nex-live-sandbox-pre-apply-report-2026-10-24.md` line 3: **"PRE-APPLY REPORT · NO MIGRATIONS APPLIED"**
- `docs/doctrine/nex-live-migrations-apply-procedure-2026-10-24.md` line 3: **"PROCEDURE AUTHORED · NOT APPLIED · NOT PRODUCTION-APPROVED."**
- `docs/doctrine/nex-music-production-apply-order-playbook-2026-10-31.md` + MEMORY index entry: **"Phase C 2026-10-31: migrations 235/236/240/241 APPLIED to sealed Supabase ijvqdvsvwtwxzcqmoqit"**
- Community migs 146–152 + 197: no explicit DRAFT header; MEMORY footnote says "Likely applied to prod early 2026" — treat as **unverified** until owner confirms.
- Migrations 244–256 country/global-feed infra: every file carries **"STATUS: DRAFT · NOT YET APPLIED TO ANY DATABASE"** in header.

### 2.1 Live Commerce migrations (confirmed NOT applied)

| # | File | Purpose | Applied |
|---|---|---|---|
| 029 | `029_nex_live_post.sql` | `nex_live_post` core table (RLS) | **unverified** (early mig · pre-Phase-C) |
| 218 | `218_nex_rls_harden_peer_message_and_live_post.sql` | RLS hardening for peer_message + live_post | unverified |
| 219 | `219_nex_live_session_and_featured_product.sql` | `nex_live_session` + `nex_live_featured_product` | **not applied** (per live-sandbox report) |
| 221 | `221_nex_uploaded_video_is_ai_generated.sql` | `is_ai_generated` flag on uploaded video (live-coupled) | not applied |
| 222 | `222_nex_live_engagement.sql` | live viewer engagement counter | not applied |
| 226 | `226_nex_live_participation.sql` | participation ledger | not applied |
| 233 | `233_nex_live_post_directory_v.sql` | directory view for live posts | not applied |
| 234 | `234_nex_live_jail.sql` | `nex_live_jail` table | not applied |

### 2.2 Music migrations (CONFIRMED applied to prod 2026-10-31)

| # | File | Purpose | Applied |
|---|---|---|---|
| 235 | `235_nex_music_track.sql` | `nex_music_track` table | **confirmed applied** (MEMORY Phase C 2026-10-31) |
| 236 | `236_nex_music_active_slot_and_idempotency.sql` | `nex_creator_active_music` + `nex_music_publish_idempotency` + publish RPC | **confirmed applied** |
| 240 | `240_nex_account_music_rights_ack.sql` | per-account music rights ack | **confirmed applied** |
| 241 | `241_nex_music_media_bucket.sql` | storage bucket `nex-music-media` | **confirmed applied** (bucket live in Supabase) |

**Implication:** reversal plan must archive data + drop tables/bucket. Not written in Phase 1a — belongs to Phase 1c.

### 2.3 Community migrations (unverified — treat as applied)

| # | File | Purpose | Applied |
|---|---|---|---|
| 146 | `146_nex_community_watch_core.sql` | `nex_community_zone` + `nex_community_notice` + FK chain | **unverified** (likely applied early 2026) |
| 147 | `147_nex_community_zone_seed_id_yogyakarta.sql` | Yogyakarta zone seed | unverified |
| 148 | `148_nex_community_phase2a_card_primitives.sql` | `nex_community_card` + child tables | unverified |
| 149 | `149_nex_community_phase2a_notification_prefs.sql` | per-zone notification prefs | unverified |
| 150 | `150_nex_community_phase2a_lost_found.sql` | lost-found card specialisation | unverified |
| 151 | `151_nex_community_photo_bucket.sql` | `nex-community-photo` storage bucket | unverified |
| 152 | `152_nex_community_phase2b_business_welcome.sql` | welcome gate + `nex_business.community_discovery_zone_id` FK | unverified |
| 197 | `197_nex_community_rate_limit_peer_message_guest.sql` | adds `peer_message_guest` to rate-limit CHECK | unverified |

### 2.4 Migrations 244–256 classification (G/F)

All carry `STATUS: DRAFT · NOT YET APPLIED`. Classification:

| # | File | One-line purpose | Decision |
|---|---|---|---|
| 243 | `243_nex_world_state.SUPERSEDED.sql` | Superseded world-state scaffold | **KEEP as historical artefact** (SUPERSEDED file naming) |
| 244 | `244_nex_country_column.sql` (REISSUED) | Adds `country` column to 4 anchor tables: nex_business, nex_community_zone, nex_live_session, nex_report | **NEEDS-OWNER** — references removed tables (`nex_community_zone`, `nex_live_session`). Needs amendment to exclude them OR entire mig held until global-feed reboot. |
| 244 | `244_nex_country_column.rollback.sql` | Rollback helper | **NEEDS-OWNER** (paired with 244) |
| 244 | `244_nex_country_column.SUPERSEDED-REISSUED.sql` | Prior 37-table draft | KEEP as historical |
| 245 | `245_nex_country_rls.sql` (REISSUED) | 7-gate RLS install across nex_business/music_track/uploaded_video/live_session/live_post/community_notice/community_card/product | **NEEDS-OWNER** — predicates reference removed tables |
| 245 | `245_nex_country_rls.SUPERSEDED-REISSUED.sql` | Prior shape | KEEP as historical |
| 246 | `246_nex_country_backfill.sql` | Backfill `country='ID'` on 4 anchor tables | **NEEDS-OWNER** (references removed) |
| 247 | `247_nex_visibility_column.sql` | content_visibility enum + visibility col on 8 tables | **NEEDS-OWNER** (references removed) |
| 248 | `248_nex_storage_country_prefix.sql` | storage.objects RLS country prefix | KEEP (business + product scope) |
| 249 | `249_nex_moderation_status.sql` | moderation_status col on 8 tables | **NEEDS-OWNER** (references removed) |
| 251 | `251_nex_age_gate.sql` | content_age_rating col on 8 tables + account DOB | **NEEDS-OWNER** (references removed) |
| 252 | `252_nex_country_registry.sql` | nex_country_registry supported-countries table | KEEP |
| 253 | `253_nex_country_placement.sql` | nex_country_placement per-content per-country placement | KEEP (independent of removed tables — content_type is a text enum, not FK) |
| 254 | `254_nex_hq_action_log.sql` | nex_hq_action_log append-only audit | KEEP |
| 255 | `255_nex_hq_role_country_moderator.sql` | widens hq_role CHECK for `country_moderator:ISO` | KEEP |
| 256 | `256_nex_visibility_amendment.sql` | supersedes 247 for music_track + uploaded_video collision | **NEEDS-OWNER** (addresses removed tables) |

**Recommendation for 244, 245, 246, 247, 249, 251, 256:** hold these as DRAFT; do not apply; re-author post-removal when owner re-scopes the country/visibility infra against the remaining 3–5 anchor tables (nex_business, nex_product, nex_uploaded_video if kept, nex_report).

### 2.5 `999_WIP_add_canonical_business_id_to_nex_business.sql`

Not related to removed surfaces. KEEP.

---

## 3 · Rewire targets (file:line → import → action)

### 3.1 Chat guest actions (A — RESOLVED: inline)

- `src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts:12` `import { recordIfAllowed } from "@/lib/nex-native/community/rate-limit";` → **inline**: port `recordIfAllowed` logic into `src/lib/nex-native/chat/chat-rate-limit.ts` (new tiny module). Keep the same `nex_community_rate_limit` table (owned by chat going forward, rename in a later migration).
- `src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts:13` `import { NexCommunityRateLimitError } from "@/lib/nex-native/community/types";` → **inline**: define `NexChatRateLimitError` in `chat-rate-limit.ts`.
- `src/app/nex-native/chat/guest/[ownerAccountId]/__tests__/send-guest-message-rate-limit.test.ts:86,207,213` → update import strings to new chat module.

### 3.2 Profile page (music preloader)

- `src/app/nex-native/profile/[handle]/page.tsx:76` `import { AccountMusicPreloader } from "@/components/nex-native/music/_account-music-preloader";` → **delete-call**: remove the preloader JSX + the dynamic import at line 370–372 + `musicPreloadPromise` + `musicPreload` prop pipeline to child.
- `src/app/nex-native/profile/[handle]/page.tsx:372` dynamic `await import("@/lib/nex-native/music/account-music-preload")` → **delete-call** (block disappears with preloader).
- `src/app/nex-native/profile/[handle]/page.tsx:611–615` `topTrackHref`/`topCoverUrl`/`topBackgroundUrl`/`topAudioUrl`/`libraryCoverUrls` props → **delete-call**; child component signature trimmed in same edit.

### 3.3 Create page (music link + go-live link)

- `src/app/nex-native/create/page.tsx:78` Go-Live card href `/nex-native/live-commerce/library` → **replace-with-shop-equivalent OR mark Coming soon**: route is removed; either flip card to disabled/"Coming soon" or point to a replacement Shop surface. Owner decides (Q7).
- `src/app/nex-native/create/page.tsx:83` Music card href `/nex-native/create/upload-music` → **delete**: remove Music card from `CARDS` array (layout drops from 5→4 cards; grid comment at line 23 updates).

### 3.4 Business pages (live-session service + stale-session policy)

- `src/app/nex-native/[businessSlug]/[productId]/page.tsx:32-33` imports `live-session-service` + `evaluateLiveness` from `stale-session-policy` → **stub-return-noop**: inline a `const liveness = { isLive: false, startedAt: null }` sentinel; remove Live-strip JSX.
- `src/app/nex-native/[businessSlug]/[productId]/page.tsx:34-35` imports `LiveHeartbeatRing` + `LiveProductIndicator` → **delete-call**: remove JSX + import.
- `src/app/nex-native/[businessSlug]/page.tsx:36-37` same imports → same treatment.
- `src/app/nex-native/[businessSlug]/page.tsx:38` `import { ShopLiveStrip }` → **delete-call**: remove `<ShopLiveStrip />` render.

### 3.5 Directory cards (live indicator)

- `src/components/nex-native/directory/listing-card.tsx:70` `import { LiveProductIndicator }` → **delete-call**: remove indicator JSX + import.
- `src/app/nex-native/directory/_directory-card.tsx:65` `import { LiveProductIndicator }` → **delete-call**.

### 3.6 Manage watches upload

- `src/app/nex-native/manage/watches/new/_upload-client.tsx:23` imports `WatchOverlayCaption` from `@/components/nex-native/live-commerce/WatchOverlayCaption` → **replace-with-shop-equivalent**: move `WatchOverlayCaption.tsx` to `src/components/nex-native/watches/` (or inline into the upload client). Watch surface (migs 227–232) is KEPT.

### 3.7 Contacts list (community notice/card)

- `src/app/nex-native/contacts/_contacts-list.tsx:21` `import { CommunityNoticeCard } from "./_community-notice-card";` → **delete-call**: remove import + the `<CommunityNoticeCard />` render (line ~391).
- Any usage of `_community-card.tsx` inside `_contacts-list.tsx` — audit same file; remove.

### 3.8 Shop contacts dedup (live-broadcast lib)

- `src/lib/nex-native/manage/shop-contacts/...` (if present) importing `@/lib/nex-native/live-broadcast/shop-contacts-dedup` → **replace-with-shop-equivalent**: move `shop-contacts-dedup.ts` out of `live-broadcast` into `src/lib/nex-native/shop-contacts/`. Confirm no other live-broadcast cross-coupling before extracting.

### 3.9 Uploaded video service (business/product video surface)

- Any shop/product/business surface importing `@/lib/nex-native/live-broadcast/uploaded-video-service` → **replace-with-shop-equivalent**: move `uploaded-video-service.ts` + `dev-video-manifest.ts` + `stale-session-policy.ts` + `types.ts` to `src/lib/nex-native/product-video/` (new home). Mig 223 (`nex_uploaded_video`) is KEPT.
- Followup grep required in Phase 1c for all callers of `uploaded-video-service` outside the live-broadcast tree.

### 3.10 Creator badges (music coupling)

- `src/lib/nex-native/creator/creator-badges.ts:9-27` scope says "music only today"; imports `getOwnerTrackCount` from `../music/music-repository` at line 27 → **delete-call or stub-return-noop**: either (a) delete `creator-badges.ts` entirely if no KEPT surface consumes it, OR (b) keep the file but return empty badges array. Caller is `src/app/nex-native/profile/[handle]/page.tsx:344`. See Q8.

### 3.11 Centre/refacing cross-coupling

- `src/components/nex-app/shell/CentreFeedPreloader.tsx:17-18` → **delete** (whole file with centre deletion); audit whether any shell layout mounts this preloader.
- `src/components/nex-app/refacing/TradeProfileSheet.tsx:21-22` imports `CentreFeedItem` + `REFACING_CAPABILITY_LABELS` → **delete** (whole refacing component tree goes).
- `src/lib/nex/collection/urlQueueProcessor.ts:33-38` → **delete OR deep-refactor** (Q5).
- `src/lib/nex/collection/candidateExtractor.ts` (uses `RefacingCapabilityKey`) → **delete OR deep-refactor** (Q5).

### 3.12 Authoring health + coverage (staircase-advisor)

- `src/lib/nex/authoring/health.ts:10-11` imports from `@/lib/nex/staircase-advisor/*` → **stub-return-noop**: return `{ truthIndex: null, semanticStats: null }` or delete the health probes.
- `src/lib/nex/authoring/coverage.ts:8` imports from `@/lib/nex/staircase-advisor/*` → same treatment.

### 3.13 Brain/est/tools/staircase

- `src/lib/nex/brain/agents/staircase.ts:41` → delete file (whole staircase agent goes).
- `src/lib/nex/est/trades/staircase.ts:36` → delete file.
- `src/lib/nex/tools/handlers/staircase-design.ts:32` → delete file.
- Any agent registry/handler-map referencing the above → **delete-call** entry in the registry.

### 3.14 nex-feed internal cross-references (all deleted together)

All of `src/components/nex-native/nex-feed/*.tsx`, `src/lib/nex-native/nex-feed/*.ts`, `src/app/nex-native/nex-feed/**` delete together. No external KEPT surface imports from `nex-feed/*` based on the sweep.

### 3.15 Live-commerce components still consumed by music/create/watches/dev

See §1.1 `WatchOverlayCaption.tsx` flag. See §3.6. See Q1.

### 3.16 Internal music ↔ live-commerce coupling (both deleted together)

- `src/components/nex-native/music/MusicPostShell.tsx:32` → `SatelliteIconWithPing` from `live-commerce/LiveSignalBadge` — both files deleted, no action.
- `src/components/nex-native/live-commerce/MusicFeedCard.tsx:33` → `MusicFeedEntry` from `music/active-music-feed-reader` — both deleted.

---

## 4 · Doctrine files to retire/archive

Move or delete the following from `docs/doctrine/` (owner picks disposition; recommend `docs/doctrine/_retired/` subfolder rather than hard delete):

### Live (14)
- [ ] `nex-card-a-go-live-flow-sealed-2026-10-28.md`
- [ ] `nex-commerce-live-relationship-plan-2026-10-24.md`
- [ ] `nex-harvest-to-directory-live-update-trace-2026-10-27.md`
- [ ] `nex-live-catalogue-implementation-plan-2026-10-28.md`
- [ ] `nex-live-data-path-verification-2026-10-24.md`
- [ ] `nex-live-deferred-features-2026-10-24.md`
- [ ] `nex-live-eligibility-contract-2026-10-27.md`
- [ ] `nex-live-feed-ranking-brainstorm-2026-10-24.md`
- [ ] `nex-live-interaction-feature-contract-2026-10-24.md`
- [ ] `nex-live-migrations-apply-procedure-2026-10-24.md`
- [ ] `nex-live-sandbox-pre-apply-report-2026-10-24.md`
- [ ] `nex-live-uploaded-video-contract-2026-10-24.md` → **flagged**: contract may still speak to the KEPT uploaded-video/product-video pipeline. Review before retiring.
- [ ] `nex-live-video-streaming-roadmap-2026-10-27.md`
- [ ] `nex-manage-live-token-audit-2026-10-28.md`

### Music (8)
- [ ] `nex-main-feed-public-music-listening-design-2026-10-30.md`
- [ ] `nex-music-directory-architecture-draft-2026-10-30.md`
- [ ] `nex-music-directory-phase-1-build-plan-draft-2026-10-30.md`
- [ ] `nex-music-orphan-storage-cleanup-DRAFT-2026-10-31.md`
- [ ] `nex-music-production-apply-order-playbook-2026-10-31.md`
- [ ] `nex-music-publishing-integration-readiness-audit-2026-10-30.md`
- [ ] `nex-music-publishing-to-live-feed-design-contract-DRAFT-2026-10-30.md`
- [ ] `nex-music-upload-contract-DRAFT-2026-10-29.md`

### Community
- No `docs/doctrine/*community*` files found in current tree beyond the memory entry. If any surface later in `docs/` references community-notice doctrine, archive together.

### Daily Discovery (music/live composition only — Shop variant KEPT)
- Any `docs/doctrine/*daily-discovery*` music/feed-composition file: archive. (None matched in current `docs/doctrine/` listing.)

---

## 5 · Scripts

- [ ] `scripts/smoke-music-publish.mts` — DELETE (music smoke test)
- Phase 0 referenced `scripts/live-broadcast-sandbox-apply.sh` and `scripts/music-publish-idempotency-backfill.sh` — neither found in current `scripts/` listing. No action needed unless re-discovered.

---

## 6 · Resolved ambiguities (A–I)

- **A. Guest chat rate-limit.** RESOLVED → **inline**. Port `recordIfAllowed` into a new `src/lib/nex-native/chat/chat-rate-limit.ts` keyed on `nex_community_rate_limit` (rename table in a later migration). Evidence: `_actions.ts` and `rate-limit.ts` reviewed; no community-domain logic intrinsic to the rate limit — pure (account_id, action, window, count) upsert.
- **B. Schema FKs from KEPT tables to REMOVED tables.** RESOLVED → NONE found. Evidence: all `REFERENCES nex_community_*` / `nex_live_*` / `nex_music_*` are internal to removed-surface migrations (146/148/150/152/219/236). Exception: mig 152 adds `nex_business.community_discovery_zone_id` FK — that column is on a KEPT table but FK target is removed. **Flag:** the `ALTER TABLE nex_business ADD COLUMN community_discovery_zone_id uuid REFERENCES nex_community_zone` must be reversed (DROP COLUMN) as part of the community-removal reversal migration.
- **C. Starter Pack residue on phase-x.** RESOLVED → NONE found. `grep -i "starter_pack|starterPack|StarterPack"` returned zero hits across `src/`. phase-u preservation branch holds all starter-pack work.
- **D. RefacingCapabilityKey usage.** RESOLVED → bleeds into `src/lib/nex/collection/candidateExtractor.ts` outside the centre-publishing tree. `candidateExtractor.ts` is the HTML scraper that classifies harvested sites by capability. See Q5.
- **E. nex-intelligence gateway.** RESOLVED → **KEEP**. File header confirms it is the generic Chat↔Intelligence bridge (Bridge 91), with no staircase coupling. Grep `(staircase|RefacingCapability)` against `src/lib/nex-native/intelligence/` returned zero hits.
- **F. Migrations 244–256.** RESOLVED — see §2.4 table. Six are **NEEDS-OWNER** because they ADD COLUMN or INSTALL RLS on removed tables (nex_community_zone, nex_community_notice, nex_community_card, nex_live_session, nex_live_post, nex_music_track). Six+ are KEEP (country registry, placement, hq log, hq-role widen, storage-prefix, superseded artefacts).
- **G. Phase 0 migration list completeness.** RESOLVED → list is complete for Live/Music/Community. Globs against the migration directory returned exactly the files Phase 0 enumerated.
- **H. Applied-to-prod status.** RESOLVED → Live: **NOT applied** (confirmed via `nex-live-sandbox-pre-apply-report-2026-10-24.md`). Music: **applied 2026-10-31** (confirmed via MEMORY.md Phase C 2026-10-31 + `nex-music-production-apply-order-playbook-2026-10-31.md`). Community: **unverified** (no DRAFT header on migs 146–152/197, memory says "likely applied early 2026") — treat as applied for safety.
- **I. Full rewire sweep.** RESOLVED — see §3. Beyond Phase 0's 14 targets, exhaustive grep revealed the following additional rewire surfaces: profile-page music preloader (§3.2), create-page Music + Go-Live cards (§3.3), two business pages + two directory cards (§3.4, §3.5), manage/watches watch-overlay (§3.6), creator-badges music coupling (§3.10), shop-contacts-dedup living under live-broadcast (§3.8), uploaded-video-service living under live-broadcast (§3.9), authoring/health + authoring/coverage staircase-advisor coupling (§3.12), brain/est/tools staircase handlers (§3.13), collection/urlQueueProcessor + collection/candidateExtractor RefacingCapability coupling (§3.11, Q5). **New total rewire targets: ~22 files** (vs Phase 0's 14).

---

## 7 · Owner decisions (RESOLVED 2026-11-06 in-session)

### SCOPE CORRECTION · 2026-11-06 after Batch 4 landed

Owner reversed Community Notice removal mid-flight: **"we hold onto community notice"**. Batch 5 (Community deletion commit `4096601`) was reverted at `624c85f`. Community Notice is now KEPT — all 37 files + 2 rewires restored.

**Effect on this doc:**
- § 1.3 (Community Notice file list) — RETAINED, do not delete any of those files
- § 3.1 (chat guest rate-limit) — The Batch 1 inline to `lib/nex-native/chat/chat-rate-limit.ts` is left in place (chat is now architecturally independent of community/rate-limit, which is a KEEP architectural improvement regardless)
- § 3.7 (contacts list Community notice/card) — RETAINED, contacts list continues to render `_community-notice-card.tsx` + `_community-card.tsx`
- § 2.3 (Community migrations 146–152/197) — NOT SCHEDULED for reversal. Batch 10 scope reduced accordingly.
- § 4 Community (doctrine) — RETAINED, not archived
- Batch 5 effectively CANCELLED; subsequent batch numbering unchanged for traceability (there is no new Batch 5).

**Scope now:** Chat + Chat Themes + Shop (bundles Vault) + **Community Notice** + Directory. Removed: Live, Music, nex-feed, Starter Pack, Power Tokens, Sponsorship, Trade Centre, staircase, non-shop Daily Discovery, Dev-live diagnostics.

---

All Q1–Q8 resolved. Phase 1c may proceed per §8 batch plan (skipping cancelled Batch 5).

- **Q1 WatchOverlayCaption** → **MOVE** (default accepted). Batch 1 relocates it to `components/nex-native/watches/`.
- **Q2 shop-contacts-dedup** → **MOVE** (default accepted). Batch 1 relocates it to `lib/nex-native/shop-contacts/dedup.ts`.
- **Q3 uploaded-video-service + dev-video-manifest + stale-session-policy + types.ts** → **MOVE** (default accepted). Batch 1 relocates all four to `lib/nex-native/product-video/`.
- **Q4 country-feed-mode.ts** → **DELETE with nex-feed** (Batch 2) (default accepted). Shop country-switcher rebuilt fresh if/when needed.
- **Q5 Harvester (urlQueueProcessor + candidateExtractor)** → **DELETE entire** (default accepted). Batch 7 removes alongside Trade Centre. Directory canonical rows already in Supabase from earlier harvests; new business intake post-launch via create-shop flow (phase-v P1).
- **Q6 authoring health + coverage** → **STUB returning empty state** (default accepted). Batch 8 replaces with empty-state returns. API shape preserved for future knowledge-base plumbing.
- **Q7 create-page Go-Live card** → **REMOVE** (default accepted). Batch 4 removes the card. Layout drops to 4 cards.
- **Q8 creator-badges.ts** → **KEEP STUBBED** (default accepted). Batch 3 replaces body with empty badges array; CreatorBadgeStrip on profile continues to render (empty).

---

### Original 7 · Remaining owner decisions (now historical)

- **Q1. `WatchOverlayCaption.tsx`** lives under `src/components/nex-native/live-commerce/` but is consumed by the KEPT `manage/watches/new` upload surface. Decision: (a) move the file to `components/nex-native/watches/`, OR (b) remove the watches upload feature. Default proposed: (a).
- **Q2. `shop-contacts-dedup.ts`** lives under `src/lib/nex-native/live-broadcast/`. If any shop-contacts surface consumes it, move to `src/lib/nex-native/shop-contacts/`. Needs one more grep in Phase 1c against `shop-contacts/`. Default proposed: move.
- **Q3. `uploaded-video-service.ts` + `dev-video-manifest.ts` + `stale-session-policy.ts` + `types.ts`** from live-broadcast. Mig 223 (`nex_uploaded_video`) is kept for product videos. Confirm these four files are moved to a new `src/lib/nex-native/product-video/` home. Default proposed: move.
- **Q4. `country-feed-mode.ts`** cookie reader. Currently only consumed by nex-feed. Default: DELETE with feed; re-introduce if a Shop country-switcher is built.
- **Q5. Harvester (`collection/urlQueueProcessor.ts` + `collection/candidateExtractor.ts`).** Both couple to centre-publishing + RefacingCapability. Options: (a) delete entire harvester along with centre (clean removal; losing the web-scraping path); (b) rewire to a nexapp-native capability enum defined under `src/lib/nex-native/directory/`. Harvester is the non-trivial piece feeding `nex_business_canonical`. Default proposed: (a) delete — the harvester output is captured in the preserved directory canonical layer; new intake can be rebuilt post-launch.
- **Q6. Authoring `health.ts` + `coverage.ts`.** Both consume staircase-advisor indexes. Decision: stub returning empty state, OR delete authoring health/coverage endpoints entirely. Default proposed: stub (keeps API shape for future knowledge-base plumbing; remove post-launch if unused).
- **Q7. Create-page Go-Live card.** Route removed. Owner-authored copy for the card currently reads "Stream now" → `/nex-native/live-commerce/library`. Decision: (a) remove the card (layout drops to 4 cards); (b) swap target to a future "sell on NEX" upsell. Default proposed: (a) remove — matches scope-reduction intent.
- **Q8. `creator-badges.ts`.** Consumed by profile page. Currently music-only. Decision: (a) delete the file (and strip CreatorBadgeStrip from profile); (b) keep file returning empty badges array (future-proof hook). Default proposed: (b) keep stubbed — minimises profile-page diff.

Everything else was resolvable from code.

---

## 8 · Deletion batch plan (Phase 1c)

Each batch = one commit. Ordered to minimise cross-batch churn (dependency arrows drawn below).

1. **Batch 1 — Pre-move extract (NO deletions yet).** Move/rename before deleting to keep KEPT surfaces compiling:
   - Move `components/nex-native/live-commerce/WatchOverlayCaption.tsx` → `components/nex-native/watches/WatchOverlayCaption.tsx` (Q1).
   - Move `lib/nex-native/live-broadcast/shop-contacts-dedup.ts` → `lib/nex-native/shop-contacts/dedup.ts` (Q2).
   - Move `lib/nex-native/live-broadcast/{uploaded-video-service,dev-video-manifest,stale-session-policy,types}.ts` → `lib/nex-native/product-video/` (Q3). Update the 4 import sites in `[businessSlug]/page.tsx`, `[businessSlug]/[productId]/page.tsx`.
   - Inline guest-chat rate-limit (A) to `lib/nex-native/chat/chat-rate-limit.ts`.
   - Verify typecheck + tests after Batch 1.

2. **Batch 2 — Delete nex-feed surface** (imports from Live + Music, so deleted first before them).
   - All files under `src/app/nex-native/nex-feed/**`, `src/lib/nex-native/nex-feed/**`, `src/components/nex-native/nex-feed/**`.
   - Verify typecheck.

3. **Batch 3 — Delete Music surface.**
   - `src/app/nex-native/music/`, `src/app/nex-native/create/upload-music/`, `src/app/api/nex-native/music/`, `src/components/nex-native/music/`, `src/lib/nex-native/music/`, `scripts/smoke-music-publish.mts`.
   - Rewire: profile page (§3.2), create page Music card (§3.3), creator-badges music (§3.10).
   - Verify typecheck.

4. **Batch 4 — Delete Live Commerce surface.**
   - `src/app/nex-native/live-commerce/`, `src/app/nex-native/manage/live/`, `src/app/api/nex-native/manage/live-*`, `src/components/nex-native/live-commerce/` (except moved WatchOverlayCaption), `src/lib/nex-native/live-broadcast/` (except moved product-video + shop-contacts-dedup files), `src/lib/nex-native/live-feed/`.
   - Rewire: business pages (§3.4), directory cards (§3.5), create-page Go-Live card (§3.3/Q7), contacts list (§3.7).
   - Verify typecheck.

5. **Batch 5 — Delete Community surface.**
   - `src/app/nex-native/community/`, `src/app/api/nex-native/community/`, `src/app/api/nex-native/manage/community-discovery/`, `src/app/nex-native/manage/community-discovery/`, `src/app/nex-native/contacts/_community-{notice-card,card}.tsx`, `src/lib/nex-native/community/`.
   - Rewire: contacts list (§3.7).
   - Verify typecheck.

6. **Batch 6 — Delete Dev live diagnostics.**
   - `dev/live-chip-ttl-harness/`, `dev/live-persona/`, `dev/live-seller/`, `dev/live-viewer/`, `dev/_dev-live-phone-frame.tsx`, `dev/message-panel-fixture/`, `dev/watches-upload-preview/` (if present).

7. **Batch 7 — Delete Trade Centre.**
   - `src/lib/nex/centre/`, `src/lib/nex/centre-publishing/`, `src/components/nex-app/centre/`, `src/components/nex-app/shell/CentreFeedPreloader.tsx`, `src/components/nex-app/refacing/TradeProfileSheet.tsx`, (whole `src/components/nex-app/refacing/` dir if empty).
   - Rewire: Q5 decision — delete `src/lib/nex/collection/urlQueueProcessor.ts` + `candidateExtractor.ts` (default) OR refactor.

8. **Batch 8 — Delete Staircase.**
   - `src/lib/nex/staircase*/`, `src/lib/nex/refacing/`, `src/lib/nex/brain/agents/staircase.ts`, `src/lib/nex/est/trades/staircase.ts`, `src/lib/nex/tools/handlers/staircase-design.ts`.
   - Rewire: authoring/health + authoring/coverage (§3.12 / Q6).

9. **Batch 9 — Doctrine archive.**
   - Move 22 live + music doctrine files to `docs/doctrine/_retired/`. Zero code impact.

10. **Batch 10 — Migration reversal + DRAFT prune.** (Separate owner-authorisation gate per repo CLAUDE.md §5; do not apply in one go.)
    - Drop `community_discovery_zone_id` FK from `nex_business` (reversal of 152).
    - Archive + drop `nex_music_*` tables + bucket (reversal of 235/236/240/241).
    - Archive + drop `nex_community_*` tables + bucket (reversal of 146–152/197) IF applied.
    - Hold migs 244/245/246/247/249/251/256 as DRAFT; re-author post-removal.
    - KEEP migs 243 (SUPERSEDED), 248, 252, 253, 254, 255, 999_WIP.

---

## 9 · Final summary

| Metric | Count |
|---|---|
| Total app-code files flagged for deletion | ~240 (Live ~93, Music ~36, Community ~37, Dev-live 8, Trade Centre ~30, Staircase ~34, nex-feed 10) |
| Total migrations flagged | 20 (8 live, 4 music, 8 community) + 6 DRAFT migs (244–256) requiring re-authoring |
| Total migrations confirmed applied to prod | 4 (music: 235, 236, 240, 241) |
| Total rewire operations | 22 files touched across ~15 KEPT surfaces |
| Doctrine files to archive | 22 |
| Scripts to delete | 1 (smoke-music-publish.mts) |
| Batch count (Phase 1c) | 10 commits |
| Remaining owner decisions | 8 (Q1–Q8) |

End of Phase 1a reviewed deletion list. Awaiting owner sign-off before Phase 1c executes any deletion.
