# NEX Status · Implementation Plan · DRAFT 2026-10-22

**Status:** 📝 PLAN ONLY · owner-recorded 2026-10-22 · NOT IMPLEMENTED
**Precedes:** schema migration · storage buckets · server actions · UI surfaces · audience enforcement
**Builds on:** owner directive 2026-10-22 (locked product decisions for NEX Status, 5 sections)
**No code lands from this plan alone.** Each phase requires separate explicit authorisation.

---

## 1 · Executive summary

NEX Status is a full-screen media-first channel for owners (personal or business) to post an image or short video with text/emoji overlays, visible for 24 hours, that converts attention into chats and orders. The product decisions are locked in the owner directive 2026-10-22. This plan maps those decisions against the current codebase, identifies what we reuse, what we build, and what order to ship.

**Verdict on reusability** (from 3 parallel audits 2026-10-22):

- The **Intro Video editor** (`settings/intro-video/_intro-video-client.tsx`) ships production-ready with exactly the overlay primitives Status needs: 5 fonts · 4 size steps · hero/center/footer positions · hex color · align · highlight toggle · per-character segments · shared emoji+sticker picker. We lift the `TitleOverlay` component + fonts config directly.
- The **existing status viewer prototype** at `/dev/status-viewer-v1/_client.tsx` is mock-data only but has the right shell: full-screen gestures, chapter progress, theme-aware typography. We lift the viewer shell + rewire data.
- The **upload infrastructure** (Supabase buckets, server actions, EXIF strip + webp encode) is production-ready at `owner-upload-service.ts`. We extend, not rebuild.
- The **pg_cron pattern** exists for 7-day encrypted message purge. We extend to a 24-hour status expiry sweep.

**Verdict on gaps:**

- No `nex_status` table today · must create.
- No 24-hour expiry pattern · must build (existing TTL patterns are 7 days / 168 hours · never 24h).
- No multi-select contact picker · must build (no existing component).
- No audience-aware attachment type for status replies · must add.
- No cascade cleanup on record deletion · common gotcha across existing media (attachment_url points to orphaned objects) · must solve for status explicitly or storage bloats.

---

## 2 · Component reuse table

| Existing primitive | File path | Status usage | Change needed |
|---|---|---|---|
| `TitleOverlay` positioned-text renderer | `src/app/nex-native/settings/intro-video/_intro-video-client.tsx:2753` | Overlay rendering on Status media (same hero/center/footer anchors) | Lift to shared location · `src/lib/nex-native/overlay/title-overlay.tsx` |
| `_overlay-fonts.ts` (fonts + sizes config) | `src/app/nex-native/settings/intro-video/_overlay-fonts.ts` | Status editor font picker | Move to `src/lib/nex-native/overlay/fonts.ts` · shared constants |
| `StandardEmojiStickerPicker` | shared from chat composer | Emoji insertion in status overlay | Reuse as-is |
| `TitleSegment[]` + `segmentsToAttrs()` | intro-video-client.tsx | Per-character styling (nice-to-have for v1 · defer if scope tight) | Reuse as-is |
| `uploadPeerAttachmentAction` pattern | `src/app/nex-native/_actions.ts:1019` | Reference pattern for new `uploadStatusMediaAction` | Clone + adapt for status bucket |
| EXIF strip + webp encode | `src/lib/nex-native/business-media/owner-upload-service.ts:performOwnerUpload` | Image processing before Supabase storage write | Reuse the sharp pipeline |
| `pg_cron` scheduled purge | `nex-supabase/migrations/097_pg_cron_schedule.sql` | 24h expiry sweep · `nex_purge_expired_statuses_hourly` | Clone the pattern · swap interval and target |
| `relationshipService.isThemeMutuallyVisibleSafe` | `src/lib/nex-native/relationship-service.ts` | Reference pattern for audience gates | Clone shape · new predicate for status visibility |
| `getOrCreatePeerConversation` | `src/lib/nex-native/peer-conversation-service.ts` | Chat flow when a viewer replies to a status | Reuse as-is · pass new `attachment_type='status_reply'` |
| `/dev/status-viewer-v1/_client.tsx` shell | prototype only | Full-screen gestures · chapter progress bars · phone frame · theme typography | Lift the UI shell · rewire data layer to real services |

---

## 3 · New code required

### 3.1 · Data model

**Schema (one new migration · unauthorised):**

```sql
-- nex_status · one row per status post
CREATE TABLE nex_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,

  -- Media
  kind text NOT NULL CHECK (kind IN ('image','video')),
  media_url text NOT NULL,
  media_storage_key text NOT NULL,         -- for cleanup on expiry
  media_width_px int,
  media_height_px int,
  media_duration_ms int,                   -- null for images
  media_size_bytes int,

  -- Lifecycle
  posted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,         -- posted_at + interval '24 hours'
  retired_at timestamptz,                  -- NULL = active · set when owner deletes
  retired_reason text CHECK (retired_reason IN ('owner_deleted','expired','abuse_takedown')),

  -- Audience (owner directive · locked)
  audience_kind text NOT NULL CHECK (audience_kind IN ('all_contacts','selected_contacts','public_directory')),
  selected_contact_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
                                             -- used only when audience_kind='selected_contacts'
                                             -- stored as array · lookup via @> operator in RLS

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT expiry_is_24h CHECK (expires_at = posted_at + interval '24 hours'),
  CONSTRAINT retired_has_reason CHECK (
    (retired_at IS NULL AND retired_reason IS NULL) OR
    (retired_at IS NOT NULL AND retired_reason IS NOT NULL)
  )
);

CREATE INDEX idx_nex_status_account_active
  ON nex_status (account_id, posted_at DESC)
  WHERE retired_at IS NULL AND expires_at > now();

CREATE INDEX idx_nex_status_expiry
  ON nex_status (expires_at)
  WHERE retired_at IS NULL;

-- nex_status_overlay · N rows per status (locked at 3 max per owner directive)
CREATE TABLE nex_status_overlay (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES nex_status(id) ON DELETE CASCADE,

  layer_index int NOT NULL CHECK (layer_index BETWEEN 0 AND 2),  -- 0, 1, 2 only
  text_content text NOT NULL CHECK (char_length(text_content) <= 140),

  font_id text NOT NULL,                   -- 'sans' | 'serif' | 'display' | 'handwriting'
  color_hex text NOT NULL CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  weight text NOT NULL DEFAULT 'regular' CHECK (weight IN ('regular','bold')),
  size_id text NOT NULL CHECK (size_id IN ('s','m','l')),

  position text NOT NULL CHECK (position IN ('top','middle','bottom')),
  align text NOT NULL CHECK (align IN ('left','center','right')),

  background_treatment text NOT NULL CHECK (background_treatment IN ('none','scrim','solid')),
  shadow boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (status_id, layer_index)
);

-- nex_status_view · audit trail · one row per viewer × status · pre-aggregated for analytics
CREATE TABLE nex_status_view (
  status_id uuid NOT NULL REFERENCES nex_status(id) ON DELETE CASCADE,
  viewer_account_id uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE,
  first_viewed_at timestamptz NOT NULL DEFAULT now(),
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  reply_sent boolean NOT NULL DEFAULT false,
  PRIMARY KEY (status_id, viewer_account_id)
);

CREATE INDEX idx_nex_status_view_status ON nex_status_view (status_id);
```

### 3.2 · Server actions (new file: `src/app/nex-native/status/_actions.ts`)

Required server actions, each session-gated via `resolveNexAppSessionFromContext`:

1. `uploadStatusMediaAction(formData)` · owner uploads image/video · EXIF-strip + webp-encode via `sharp` (reuse owner-upload-service pipeline) · writes to new bucket `nex-status-media` · returns `{ storage_key, media_url, width, height, duration_ms, size_bytes }`
2. `createStatusAction(formData)` · consumes the upload result + audience selection + overlays JSON · inserts `nex_status` + `nex_status_overlay[]` in a transaction · validates overlay count ≤ 3 · redirects to viewer
3. `deleteStatusAction(statusId)` · marks `retired_at = now()`, `retired_reason = 'owner_deleted'` · best-effort storage.remove · if remove fails, status still disappears from UI (hidden by `retired_at IS NULL` index predicate) · cleanup sweep catches orphan
4. `recordStatusViewAction(statusId)` · UPSERT `nex_status_view` · first_viewed_at coalesce · last_viewed_at = now()
5. `replyToStatusAction(statusId, bodyText)` · opens or reuses peer conversation · sends message with `attachment_type='status_reply'` + `attachment_meta: { status_id, status_snapshot: { media_url, overlays, posted_at } }` · snapshot frozen at send time so reply preserves context even after expiry · marks `reply_sent=true` on view row

### 3.3 · Audience enforcement service (new file: `src/lib/nex-native/status-service.ts`)

**Critical doctrine (per owner directive · section 2): audience is enforced on the server, not in the UI.**

Core service functions:

- `listVisibleStatusesForViewer(viewerAccountId)` · returns active statuses from accounts the viewer can see:
  1. Statuses from accepted friends where `audience_kind = 'all_contacts'`
  2. Statuses from accepted friends where `audience_kind = 'selected_contacts' AND viewerAccountId = ANY(selected_contact_ids)`
  3. Statuses from any account where `audience_kind = 'public_directory'`
  4. Statuses from the viewer themselves (owner always sees own status)
  5. Excludes: `retired_at IS NOT NULL`, `expires_at <= now()`, authors who have blocked viewer, authors whom viewer has blocked
- `canViewerSeeStatus(viewerAccountId, statusId)` · single-record check · same rules · used by server actions that take a statusId
- `listOwnStatuses(accountId)` · returns ALL rows (active + retired, for owner's own history view)

Fail-closed on friendship resolution (service error → no visibility) · fail-closed on audience field (unknown value → hidden).

### 3.4 · Expiry + cleanup sweep (new migration + pg_cron entry)

```sql
-- Function · marks expired statuses + schedules storage removal
CREATE FUNCTION nex_sweep_expired_statuses() RETURNS int AS $$
DECLARE
  swept int := 0;
BEGIN
  WITH expired AS (
    UPDATE nex_status
       SET retired_at = now(),
           retired_reason = 'expired'
     WHERE retired_at IS NULL
       AND expires_at <= now()
    RETURNING id, media_storage_key
  )
  INSERT INTO nex_status_cleanup_queue (status_id, storage_key, queued_at)
    SELECT id, media_storage_key, now() FROM expired;
  GET DIAGNOSTICS swept = ROW_COUNT;
  RETURN swept;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Queue table · storage objects pending deletion · processed by Vercel cron OR pg_cron
CREATE TABLE nex_status_cleanup_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL,
  storage_key text NOT NULL,
  queued_at timestamptz NOT NULL,
  processed_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  last_error text
);

-- pg_cron · every 15 minutes (24h / 96 slices · ensures expiry < 15min after real expiry)
SELECT cron.schedule(
  'nex_sweep_expired_statuses_quarterly',
  '*/15 * * * *',
  $$ SELECT nex_sweep_expired_statuses() $$
);
```

**Explicit two-stage retirement:**
- Stage 1 (fast · DB-only): `retired_at` set · status hidden from all queries immediately · storage still exists
- Stage 2 (async · best-effort): worker reads `nex_status_cleanup_queue` + calls `supabase.storage.from('nex-status-media').remove(key)` · on success marks `processed_at` · on failure increments `attempts` and keeps trying (with backoff · max 5 attempts · then flag for manual review)

This solves the sealed gotcha: deletions never leave orphan storage objects silently. Audit says existing media patterns (gallery, peer attachments) suffer from this; status is the first to fix it.

### 3.5 · UI surfaces (new routes + components)

| Route / Component | Purpose |
|---|---|
| `/nex-native/status/create` | Full-screen capture + editor · photo/video picker · overlay editor reusing shared primitives · audience picker · publish button |
| `/nex-native/status/[statusId]` | Viewer · full-screen · chapter progress for owner's active statuses · tap advances · swipe exits · reply field inline |
| `/nex-native/status` | Owner's status list · active + expired (last 30 days) · "+ New status" button |
| `src/components/nex-native/status/overlay-editor-client.tsx` | Shared editor pane (reuses `TitleOverlay` + fonts config) |
| `src/components/nex-native/status/audience-picker-client.tsx` | **NEW** · multi-select contact picker (missing in codebase) + public/all-contacts quick picks |

---

## 4 · Audience enforcement model · the critical bit

Audience is the single most important server concern. Three rules sealed:

1. **Every status read goes through `listVisibleStatusesForViewer` or `canViewerSeeStatus`.** No direct SELECT on `nex_status` from any route or component. Enforced by review + a lint rule we'll add.
2. **`audience_kind = 'public_directory'` is OPT-IN per status, never per account.** Owner directive 2026-10-22 section 2 · a status intended for selected contacts must NEVER accidentally be exposed in directory search.
3. **Selected contacts are stored as uuid[] on the status row itself**, not inherited from any account-wide "close friends" list. This prevents retro-leakage if the account's contact list changes · the audience is frozen at post-time.

Honest limits:
- Blocked accounts (via `nex_friend_edge.status='blocked'`) are excluded for both directions · author never sees viewer's statuses either · symmetric gate.
- `profile_visibility='private'` (per migration 200 if applied) overrides status audience · a private account's statuses are never shown publicly even if `audience_kind='public_directory'`. Belt + braces.
- Public-directory statuses need no viewer auth · public routes query by `audience_kind='public_directory' AND retired_at IS NULL AND expires_at > now()` directly. These are the ONLY statuses rendered on anonymous surfaces.

---

## 5 · Honest limits (declared upfront)

1. **No "delete on phone = status gone".** The web app cannot pin a live reference to a device photo. We store an uploaded copy. Owner must delete the status in-app to retire it. Future native app can bridge this if it ships.
2. **Public-directory statuses are visible to non-signed-in visitors.** This is a feature (acquisition reach) but owners must understand it before opting in. The audience picker displays an explicit "Visible to anyone who browses NEX · including people who haven't signed up" confirmation when `public_directory` is selected.
3. **Video length cap: 15 seconds, 10 MB.** Beyond this and we need chunked upload + background transcoding infrastructure we don't have today. 15s matches Instagram Reels story-style posts.
4. **Image size cap: 5 MB raw input · webp-encoded output.** Matches existing `performOwnerUpload` pipeline.
5. **Expiry precision: ±15 minutes.** The sweep runs quarterly (every 15 min). A status expiring at 14:00 may still appear until 14:15 if the sweep hasn't run. For stricter precision we'd need either `where expires_at > now()` predicate on every read (adds load) OR 1-minute cron (adds cron storm). 15 minutes feels right.
6. **Reply attachment snapshot is frozen.** If a viewer replies at 13:00 and the status expires at 14:00, the reply still shows the original media URL in the chat log. If storage is cleaned up by the sweep, the reply thumbnail breaks. **Fix:** reply snapshot copies the media_url + overlays into `attachment_meta` as data; storage cleanup is independent. **Honest cost:** doubles storage usage for status media that gets replied to (we hold two references). Acceptable trade-off.
7. **No analytics in v1.** Views are counted (`nex_status_view` upserts) but no owner-side analytics UI yet. Comes in v2 per owner directive.
8. **No product/shop CTAs in v1.** Overlay editor stores plain text + emoji only. Interactive CTAs (tap-to-chat chip, product chip) are v2 per owner directive · the schema accommodates them (overlay row can grow a `tap_action` column) but we don't ship them yet.

---

## 6 · Phased build sequence (unauthorised · each phase needs separate sign-off)

### Phase 1 · Foundation (biggest · needs DB migration)
- Migration: `nex_status` + `nex_status_overlay` + `nex_status_view` + `nex_status_cleanup_queue` + pg_cron
- Supabase storage bucket: `nex-status-media`
- `status-service.ts` with audience enforcement
- Scope: 1 migration · 1 service · 1 storage bucket config
- Risk: medium · needs schema apply authorisation per Safety Constitution §5

### Phase 2 · Capture + editor
- `/status/create` route
- Camera / photo picker integration
- Shared overlay editor (lifts intro-video primitives to `src/lib/nex-native/overlay/`)
- Up to 3 overlays per status
- Server action: `uploadStatusMediaAction`
- Scope: ~3 new files · 1 refactor (lift overlay components to shared lib)
- Risk: low (reusing proven editor code)

### Phase 3 · Audience picker
- Multi-select contact picker component (**new primitive · doesn't exist today**)
- Three quick picks: All contacts · Selected · Public directory
- Explicit confirmation modal when "Public directory" selected
- Scope: 1 new component · 1 modal
- Risk: low · UI-only

### Phase 4 · Viewer + replies
- `/status/[statusId]` route · lifts the `/dev/status-viewer-v1` shell but swaps mock data for real service calls
- Full-screen gestures (tap advance · swipe exit · hold pause)
- Reply field (inline composer at bottom)
- Server actions: `recordStatusViewAction` + `replyToStatusAction`
- Chat message rendering · new `attachment_type='status_reply'` + snapshot rendering
- Scope: ~4 new files + 1 chat renderer edit
- Risk: medium · touches peer chat message rendering

### Phase 5 · Owner list + delete
- `/status` route for owner's history
- Delete button → `deleteStatusAction`
- "Reposted expired status" quick action (duplicates an expired status's media + overlays into a new 24h window)
- Scope: 1 route · 1 component · 1 server action
- Risk: low

### Phase 6 · Entry points
- Side drawer entry: "My Status" row in Your Business group · routes to `/status`
- Chat header entry: tap owner's portrait in chat → view their active status · reusing existing live-status chip
- Shop template top-right chip: show owner has active status (link-only, no autoplay)
- Scope: 3 small UI edits
- Risk: low

### Phase 7 · Analytics (v2)
- Owner-only view count rail on each status
- Tap-rate when CTAs ship (v2 blocker)

### Phase 8 · CTA overlays (v2)
- Overlay row gains `tap_action` column
- Options: open_chat · open_product · open_shop
- Compose into overlay editor as "+ Tap action" button
- Blocked on Phase 7 (needs analytics to measure)

---

## 7 · Known-missing primitives flagged for separate scoping

These are gaps the audit uncovered that affect Status but aren't Status-exclusive. Each needs separate owner authorisation if we want it to ship with Status v1:

1. **Multi-select contact picker component** · no such component exists today · Phase 3 needs it · ~1 day of UI work · could become a shared primitive useful beyond Status (future group messages, shared albums, etc.)
2. **Cascade cleanup for existing orphaned media** · existing gallery + peer attachment paths don't clean up storage on delete · Status will not inherit this bug (phase 1 solves it for status · others stay broken) · separate migration if we want to retrofit everywhere
3. **Migration 200 (profile_visibility / who_can_message) application status** · referenced but not confirmed applied · if Status audience relies on `profile_visibility='private'` as a hard override, we need to confirm 200 is live before Status Phase 1 depends on it
4. **Chat message renderer for `attachment_type='status_reply'`** · needs new render path in the peer message component · Phase 4 scope

---

## 8 · Explicit non-goals for v1

- Multi-day pin / "Our hours" static status (deferred to v2)
- Status chapters that persist beyond 24h (deferred)
- Cross-account "mentions" in status (deferred · can be added by Phase 8's CTA overlay type)
- Native photo-library sync (requires native app · not ship-blocked here)
- Soundtrack from theme (deferred · nice-to-have)
- Reactions beyond emoji + "reply with status context"
- Theme-tracked status (status background music = theme audio · deferred)

---

## 9 · Pre-build gates (what the owner must confirm)

Before Phase 1 begins:

1. **Doctrine approval** · this document moves from DRAFT → APPROVED with owner signature + date
2. **Schema review** · owner reviews the SQL in §3.1 line-by-line (particularly `audience_kind` enum values + the three CHECK constraints) and confirms OK
3. **Bucket authorisation** · creating `nex-status-media` Supabase bucket is a prod operation per Safety Constitution §5 · needs explicit authorisation
4. **pg_cron scheduling** · the `*/15 * * * *` cron entry adds load · owner confirms Supabase pg_cron is enabled on `ijvqdvsvwtwxzcqmoqit` project and quarter-hour frequency is OK
5. **Migration 200 status** · confirm `profile_visibility` + `who_can_message` are applied, else adjust the audience service to not rely on them
6. **Private contact picker scope** · confirm we can build a multi-select picker now (adds ~1 day to Phase 3) or defer to a later phase

### Open sub-decisions deliberately preserved for owner

- **Q1 · Video max length and size** · 15s / 10MB proposed · owner confirms or adjusts
- **Q2 · Audience default** · the owner directive mentions default is unset ("choose each time"). Should the audience picker remember the LAST choice for one-tap post, or require explicit pick every post?
- **Q3 · Public directory visibility · opt-in level** · per status (today's proposal) or per account toggle (less friction but less control)?
- **Q4 · Reply gate** · can anyone who sees a public_directory status reply, or do we require them to be a NEX account first?
- **Q5 · Owner self-view counts in analytics?** · my recommendation: no (prevents inflated numbers)
- **Q6 · Deletion grace period** · when owner taps Delete, is retirement instant or do we offer a 10-second undo?
- **Q7 · Pin or sticky statuses** (v2) · explicit non-goal for v1 confirmed?

---

## 10 · Honest ask of the owner

The locked product decisions in owner directive 2026-10-22 are good. They match what a world-class status feature needs. This plan ships them in 6 phases over roughly ~2 weeks of focused build time, with Phase 1 (migration + service + bucket + pg_cron) as the biggest single-authorisation gate.

**Nothing moves until the owner marks this doctrine APPROVED.** Once approved, Phase 1 is the next authorisation request. The audience-enforcement doctrine (section 4) is the single most important safeguard; it cannot be weakened without the entire feature's privacy promise breaking.

---

## 11 · Doctrine seal

**Status:** DRAFT · owner-recorded 2026-10-22.
**Authorisation required for:** Phase 1 (schema + service + bucket + cron), Phase 2 (editor + upload), Phase 3 (audience picker), Phase 4 (viewer + replies), Phase 5 (owner list + delete), Phase 6 (entry points), Phase 7 (analytics v2), Phase 8 (CTA overlays v2).

**No code changes land from this plan alone.** Each phase requires separate explicit authorisation referencing this document.

**Doctrine signatures of record:**
- Reuse of Intro Video overlay primitives (SEALED · lifting pattern)
- Data model shape (SEALED · migration unauthorised)
- Audience enforcement on server (SEALED · critical safety rule)
- Two-stage retirement (DB mark + async storage sweep) (SEALED)
- 24h expiry precision ±15 min via pg_cron quarterly sweep (SEALED)
- No CTAs in v1 · schema accommodates them for v2 (SEALED)
- No native photo-library sync in v1 (SEALED · honest limit)
- All v1 non-goals listed in §8 (SEALED)
