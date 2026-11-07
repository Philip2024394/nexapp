# NEX · Cloudflare media architecture · design document

**Owner-authorised investigation** · 2026-11-07
**Status**: DESIGN ONLY · no provisioning · no API keys · no paid services
**Constraint**: Supabase remains primary · Cloudflare is additive for Shop media only · Vault + Chat untouched

## Objective

Design an additive media layer for NEX Shop product media (the `nex-business-assets` Supabase bucket only) that:
- Reduces egress cost at scale (Cloudflare R2 has $0 egress vs Supabase $0.09/GB)
- Adds image resizing + format conversion (Cloudflare Images)
- Adds video transcoding + adaptive bitrate (Cloudflare Stream)
- Preserves ALL existing media
- Preserves ALL existing public URLs during migration (zero-break)
- Rollback-safe at every step

## Non-goals

- Replacing Supabase
- Touching `nex-vault-files` bucket
- Touching `nex-peer-chat-attachments` bucket
- Touching `nex-chat-theme-*` buckets
- Any paid provisioning (this doc is design only)

---

## Architecture

```
                   Shop media upload flow (new)
   ┌─────────────────────────────────────────────────────────┐
   │ Owner upload                                              │
   │   │                                                       │
   │   ▼                                                       │
   │ /api/nex-native/product/upload-image/route.ts            │
   │   (existing · unchanged for v1)                           │
   │   │                                                       │
   │   ▼                                                       │
   │ MediaWriter abstraction (new)                             │
   │   ├── phase 1: Supabase write (existing path · retained) │
   │   └── phase 2: R2 write (new · opt-in via feature flag)  │
   │       │                                                   │
   │       ▼                                                   │
   │ R2 bucket · nex-shop-media                                │
   │ path: products/{business_id}/{file_id}.{ext}              │
   └─────────────────────────────────────────────────────────┘

                   Shop media read flow (new)
   ┌─────────────────────────────────────────────────────────┐
   │ Consumer (customer / owner viewing product)              │
   │   │                                                       │
   │   ▼                                                       │
   │ nex_product.image_url (existing column, unchanged)       │
   │   │                                                       │
   │   ▼                                                       │
   │ URL resolver (new · thin wrapper)                         │
   │   ├── if URL starts with nex-business-assets.supabase... │
   │   │     → check feature flag per business                 │
   │   │     → if R2-flipped: rewrite to R2/CF-Images URL     │
   │   │     → if not: pass through unchanged                  │
   │   └── else pass through                                   │
   │                                                            │
   │ Image URL (via Cloudflare Images):                        │
   │   https://images.nex.app/<account>/<variant>/<file_id>   │
   │ Video URL (via Cloudflare Stream):                        │
   │   https://videodelivery.net/<video_uid>/manifest/video.m3u8│
   └─────────────────────────────────────────────────────────┘
```

---

## Phase sequence · 7 waves · rollback at every step

### Phase 0 · Preparation (local, no Cloudflare contact)

**Code only. No external services.**

Files to create:
- `src/lib/nex-native/storage/media-writer.ts` · abstraction over Supabase + future R2
- `src/lib/nex-native/storage/url-resolver.ts` · reads stored URL, returns CDN URL if feature-flipped
- `src/lib/nex-native/storage/r2-client.ts` · R2 SDK wrapper (not called until Phase 1)
- `src/lib/nex-native/storage/cf-images-client.ts` · Cloudflare Images SDK (stub until Phase 4)
- `src/lib/nex-native/storage/cf-stream-client.ts` · Cloudflare Stream SDK (stub until Phase 5)

**Env flags (not set yet):**
- `NEX_MEDIA_DUAL_WRITE_ENABLED=false`
- `NEX_MEDIA_R2_READS_ENABLED=false`
- `NEX_MEDIA_CF_IMAGES_ENABLED=false`
- `NEX_MEDIA_CF_STREAM_ENABLED=false`

Rollback: delete files, no runtime impact.

### Phase 1 · Cloudflare account + R2 bucket (REQUIRES OWNER)

**Blocked until owner approves:**
- Cloudflare Workers & R2 account
- API token with R2 read/write on bucket `nex-shop-media`
- R2 bucket created, CORS configured for NEX domains
- Env vars populated (CF_ACCOUNT_ID, CF_R2_ACCESS_KEY_ID, CF_R2_SECRET_ACCESS_KEY)

Test:
- Smoke test: upload a 1 MB test file via r2-client.ts
- Verify retrieve via R2 public URL
- Verify cost appears on CF dashboard

Rollback: revoke API token, bucket stays with test files (safe, empty cost)

### Phase 2 · Dual-write path (code only, flag-gated)

Update `upload-image/route.ts` + `upload-cover-video/route.ts`:
```ts
// pseudocode
const result = await uploadToSupabase(file); // always
if (process.env.NEX_MEDIA_DUAL_WRITE_ENABLED === 'true') {
  try {
    await r2Client.put(file, path);
  } catch (err) {
    // log but don't fail · Supabase write is still source of truth
    logger.warn('r2-dual-write-failed', { err, path });
  }
}
return result;
```

Enable `NEX_MEDIA_DUAL_WRITE_ENABLED=true` on staging first.
Monitor for 72 hours. Verify R2 bucket contents match Supabase growth.

Rollback: set flag to false. Supabase remains sole source of truth. R2 bucket keeps historical dual-writes harmlessly.

### Phase 3 · Backfill (background job, resumable)

Script: `scripts/r2-backfill-shop-media.ts`
- Lists all objects in Supabase `nex-business-assets`
- For each object:
  - If matching path exists in R2 → skip
  - Else fetch from Supabase → write to R2 → verify via HEAD request
- Writes progress to a local log file for resumability
- No deletion · read-only on Supabase side

Checksum verification: SHA-256 compare after copy. Failures logged, not retried in-script.

Rollback: kill the script. Partial copies are harmless. R2 bucket has subset of objects, Supabase unchanged.

### Phase 4 · Flip-read (per-business, gradual)

Add column (migration · BLOCKED until owner approves):
```sql
ALTER TABLE nex_business
  ADD COLUMN media_read_source TEXT NOT NULL DEFAULT 'supabase'
  CHECK (media_read_source IN ('supabase','r2'));
```

Logic in `url-resolver.ts`:
- Reads `business.media_read_source`
- If `supabase` → pass through
- If `r2` → rewrite URL from Supabase public path to R2 public path

Owner-triggered per-business migration:
1. Pick a pilot business
2. Verify backfill complete for that business's objects
3. Set `media_read_source='r2'` for that business
4. Monitor error rate for 24 hours
5. If clean: expand to next cohort of 10 businesses
6. Continue until all businesses migrated

Rollback: `UPDATE nex_business SET media_read_source='supabase' WHERE id = ...` · reads revert instantly.

### Phase 5 · Cloudflare Images for product grids

Phase 5a: provision CF Images (BLOCKED until owner approves)
Phase 5b: enable `NEX_MEDIA_CF_IMAGES_ENABLED=true`
Phase 5c: `url-resolver.ts` rewrites product grid thumbnails to:
```
https://images.nex.app/cdn-cgi/image/width=400,format=auto/{r2-url}
```

Benefits:
- Automatic WebP/AVIF per browser
- 400px thumbnails for grids · 1200px for product detail · 2000px for zoom
- One upload · many variants · zero NEX code for image manipulation

Rollback: set flag to false. Resolver returns raw R2 URL · still works.

### Phase 6 · Cloudflare Stream for video

Upload path change:
- Phase 1 video uploads go to Supabase (existing)
- Phase 2 video uploads dual-write to R2 (existing)
- Phase 6 video uploads go to Stream INSTEAD of R2 for new videos
- Stream returns `video_uid` which we store in `nex_product.spec.__cover_video.stream_uid`

Benefits:
- Automatic H.264 + H.265 + AV1 variants
- Adaptive bitrate streaming (HLS/DASH)
- Server-side duration + resolution check (solves the current duration-bypass vulnerability)
- CDN delivery included

Existing videos: stay on Supabase/R2 · played as-is · owner can trigger per-video re-upload to Stream when ready.

Rollback: new uploads go back to R2 · existing Stream-hosted videos keep playing · Stream subscription can be paused.

### Phase 7 · Cutover

Only after all 6 prior phases stable for 90 days:
- Supabase `nex-business-assets` set to read-only
- All new uploads write to R2 + Stream only (no more Supabase writes)
- Supabase bucket preserved as cold archive for 1 year
- After 1 year: owner-approved decision to delete Supabase bucket OR keep as backup

Rollback at this stage: set `NEX_MEDIA_DUAL_WRITE_ENABLED=true` again, resume dual-write to Supabase. Takes ~1 hour.

---

## Attribution per business (critical for commercial viability)

New columns (migration · BLOCKED until owner approves):
```sql
ALTER TABLE nex_business
  ADD COLUMN storage_bytes_used BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN bandwidth_bytes_month BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN bandwidth_period_start TIMESTAMP;
```

Daily aggregation job:
- Walk R2 for each business's prefix
- Sum bytes · update `storage_bytes_used`
- Query CF Analytics for last 24h egress per business prefix
- Increment `bandwidth_bytes_month`

Monthly reset:
- Cron on 1st of month at 00:00 UTC
- Set `bandwidth_bytes_month=0` for all businesses
- Set `bandwidth_period_start=now()`

Fair-use enforcement:
- At request time, middleware checks business's `bandwidth_bytes_month`
- At 100% of cap: no-op
- At 200% of cap: 429 with upgrade CTA
- At 300% of cap: disable public shop read until next period or upgrade

---

## Cost monitoring

Three independent signals:
1. **CF Dashboard** · daily spend per service · owner-visible
2. **CF Analytics API** · bandwidth per prefix · consumed by aggregation job
3. **NEX internal metric** · bytes written per upload route · verified against CF numbers monthly

Discrepancy alert: if CF-reported bytes > NEX-logged bytes by >20%, investigate for unauthorized access or leaked URL abuse.

---

## Anti-abuse controls (from Phase 0 onwards)

Not Cloudflare-specific but required before any public-facing R2 URL:

1. **Rate limit** on upload routes · per-session · 30 uploads/min max
2. **File hash dedup** · reject upload of identical SHA-256 already in bucket for same business
3. **MIME sniff on server** · don't trust client Content-Type · use `file-type` library
4. **URL signing for private content** · product images stay public · but drafts and work-in-progress use signed URLs

---

## What this document does NOT authorize

- Creating Cloudflare account
- Generating any API keys
- Creating R2 bucket on Cloudflare dashboard
- Enabling Images / Stream products
- Any paid usage

All of the above remain BLOCKED pending separate owner approval.

## Timeline if owner greenlights

| Phase | Duration | Owner input needed |
|---|---|---|
| 0 · code prep | 1 week | None |
| 1 · CF account + R2 bucket | 1 day | Account signup, API keys |
| 2 · dual-write staging | 1 week | Staging env approval |
| 3 · backfill | 2-3 weeks | Pick cohort size |
| 4 · flip-read | 2-3 weeks | Migration approval |
| 5 · Images | 1 week | CF Images activation |
| 6 · Stream | 1-2 weeks | CF Stream activation |
| 7 · cutover | After 90d stability | Final approval |

**Total**: 7-9 weeks start to cutover if owner approves Phase 1+ provisioning.
