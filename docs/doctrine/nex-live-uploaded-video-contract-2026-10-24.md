# NEX Live · Uploaded Video Contract · 2026-10-24

**Status: CODE SCAFFOLD SHIPPED · DB NOT APPLIED · NO BYTES UPLOADED.**
**Owner answered 2026-10-24 "Not now · wait for isolated sandbox" on
the DB target question. This document holds the pending-upload file
reference + the apply plan until a sandbox is provisioned.**

---

## 1 · What's new

A **new content type on the NEX Live discovery feed**: owner-uploaded
videos. These are distinct from Live sessions:

| Dimension | Live session | Uploaded video |
|---|---|---|
| Transport | WebRTC real-time | Stored file in Supabase storage |
| Table | `nex_live_session` | `nex_uploaded_video` (Migration 223) |
| Feed section | "Who's live now" (red LIVE pill) | "Recorded videos" (grey RECORDED chip) |
| Lifecycle | Open → ended within hours | Draft → public → optionally removed |
| Chat/comments | Live Realtime channel | Not implemented · future scope |
| Rights check | Broadcaster owns their stream | Required `rights_declaration` at publish |

**The feed never conflates them**: the red LIVE pill is reserved for
`nex_live_session` only; recorded videos carry a grey RECORDED chip.

---

## 2 · Files awaiting upload (Indonesia market · country_of_origin = "ID")

### Video 1

| Field | Value |
|---|---|
| Path on owner's disk | `C:/Users/Victus/Downloads/snaptik_7689160014333807879_v3.mp4` |
| Size | 8,141,145 bytes (~7.76 MiB) |
| Modified | Oct 24, 2026 16:13 local |
| Rights declaration | `owner_content` |
| Country of origin | `ID` (Indonesia) |
| Topic tags (proposed · pending Phase A taxonomy decision) | TBD at upload |
| Target bucket | `nex-live-uploaded` |
| Target object path | `owner/first-live/snaptik_7689160014333807879_v3.mp4` |
| Target DB row | `nex_uploaded_video` with `source='owner_upload'`, `rights_declaration='owner_content'`, `country_of_origin='ID'`, `visibility='public'` |

### Video 2

| Field | Value |
|---|---|
| Path on owner's disk | `C:/Users/Victus/Downloads/snaptik_7692805970472209671_v3.mp4` |
| Size | 9,718,290 bytes (~9.27 MiB) |
| Modified | Oct 24, 2026 16:15 local |
| Rights declaration | `owner_content` |
| Country of origin | `ID` (Indonesia) |
| Topic tags | TBD at upload |
| Target bucket | `nex-live-uploaded` |
| Target object path | `owner/first-live/snaptik_7692805970472209671_v3.mp4` |
| Target DB row | `nex_uploaded_video` with `source='owner_upload'`, `rights_declaration='owner_content'`, `country_of_origin='ID'`, `visibility='public'` |

**Combined size**: ~17.03 MiB. **No bytes have been read.** Only
`fs.statSync` metadata was inspected. Both files stay on the owner's
disk until the sandbox apply window.

---

## 3 · Scaffolding shipped this pass

### Code
- `nex-supabase/migrations/223_nex_uploaded_video.sql` — DRAFT · unapplied. Table + indexes + RLS (public SELECT on published; owner SELECT on own; owner INSERT/UPDATE; no DELETE for authenticated).
- `src/lib/nex-native/live-broadcast/uploaded-video-service.ts` — service module. `publishUploadedVideo` (fail-closed), `listPublishedUploadedVideos` (fail-open), `getUploadedVideoById` (fail-open), `softRemoveUploadedVideo`.
- `src/app/nex-native/live-commerce/feed/page.tsx` — new `RecordedVideosSection` renders published videos in a separate section below Live sessions. Chip colour grey, label "Recorded", never "LIVE".
- `src/lib/nex-native/live-broadcast/__tests__/uploaded-video-service.test.ts` — **13 tests passing**: rights-declaration enforcement, title length check, caption trim+cap, whitespace→null, fail-closed on PG error, fail-open on reads, limit-clamp, soft-remove, Migration 223 source-shape invariants.

### What was NOT touched
- No Supabase connection attempted.
- No Supabase storage bucket created.
- No bytes transferred.
- No `/nex-native/videos/[id]` viewer page (deferred · the feed card
  links to it but the page itself is a follow-up slice).

---

## 4 · Apply plan for the authorised sandbox window

### Step 1 · Create the storage bucket (dashboard / CLI)
```bash
# Via Supabase CLI pointed at the sandbox project:
supabase storage create nex-live-uploaded --public
```
Or in the dashboard: Storage → New bucket → name `nex-live-uploaded` → public read enabled.

### Step 2 · Apply Migration 223
```bash
psql "$SANDBOX_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f nex-supabase/migrations/223_nex_uploaded_video.sql
```

### Step 3 · Upload the file (owner-authorised)
Operator uses the Supabase CLI or dashboard to upload
`C:/Users/Victus/Downloads/snaptik_7689160014333807879_v3.mp4` to
`nex-live-uploaded/owner/first-live/snaptik_7689160014333807879_v3.mp4`.

### Step 4 · Insert the DB row
Via the service module from a signed-in owner-authorised context
(server action or REPL):
```ts
await publishUploadedVideo({
  ownerAccountId: "<owner-account-id>",
  businessId: null, // or the owner's business id
  title: "First NEX Live",
  caption: null, // optional
  storageObjectPath: "owner/first-live/snaptik_7689160014333807879_v3.mp4",
  byteSize: 8141145,
  mimeType: "video/mp4",
  rightsDeclaration: "owner_content",
  visibility: "public",
});
```

### Step 5 · Verify the feed renders
Visit `/nex-native/live-commerce/feed`. The "Recorded videos" section
appears below "Who's live now" with the owner's video as the first
card, grey RECORDED chip.

### Rollback
```sql
BEGIN;
  DROP TABLE IF EXISTS nex_uploaded_video CASCADE;
  DELETE FROM nex_migration_history WHERE version = '223';
COMMIT;
```
Then empty + delete the `nex-live-uploaded` bucket from the dashboard.

---

## 5 · Why the feed shows uploaded video distinctly from Live

The sealed doctrine ("Keep active broadcasts distinguishable from
recordings, banners and promotional content. Never label non-live
content as currently Live.") maps directly to:

- `nex_uploaded_video` rows carry no `status='open'` / `last_heartbeat_at`.
- The feed card for an uploaded video uses `data-nex-recorded-video-chip` with text "Recorded" (grey) · NEVER `data-nex-live-heartbeat` or the red LIVE pill.
- The border + background chrome is the neutral panel style, not the red/orange gradient reserved for Live.

A regression test could lock this: no component with
`data-nex-recorded-video-chip` ever renders the string "LIVE" (red).
Documented here · test to add after sandbox apply + published video.

---

## 6 · Explicit non-claims

- This document does NOT claim Migration 223 is applied.
- This document does NOT claim the storage bucket exists.
- This document does NOT claim any bytes have been uploaded.
- The owner's file remains at
  `C:/Users/Victus/Downloads/snaptik_7689160014333807879_v3.mp4`
  until the authorised sandbox apply window.
- The `/nex-native/videos/[id]` viewer page referenced in the feed
  card's `watchHref` does NOT exist yet. Tapping the card after
  sandbox apply will 404 until that slice ships. Documented as a
  known follow-up.
- Uploaded video playback has NO comments overlay / Like / Share
  footer. Those are Live-only chrome. If owner wants comments on
  recorded videos, that is a separate feature contract.
