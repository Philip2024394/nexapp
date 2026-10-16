# Image Approval Rules

Founder-sealed · 2026-10-13 · with migration 189 (`nex.business_media_review`).

## Principle

Finding an image is NOT the same as having permission to display it.

Harvest agents and legacy-reconciliation scripts can **discover** candidate images continuously. The directory read path **displays** only images that have passed both:

1. **Admin approval** · `nex.business_media.approved = true`
2. **Source governance** · `nex.source_registry.can_display = true` on the source

Both gates must be satisfied. Either gate alone is insufficient. The resolver at `src/lib/nex-native/directory/media-resolver.ts` enforces this; the UI has no code path that can display an image without passing both.

## Current source governance (2026-10-13)

| source_id | can_display | can_redistribute | notes |
|---|---|---|---|
| `wikimedia_commons` | **false** | false | External · needs legal review before display |
| `business_website` | **false** | false | External · needs licence confirmation per business |
| `osm_overpass` | **false** | false | External · ODbL attribution; display governance pending |
| `wikidata` | **false** | false | External · multi-licence; display governance pending |
| `owner_upload` | **false** | false | Owner path should bypass this queue · flip to `true` after owner-upload UI is sealed |
| `user_upload` | **false** | false | Visitor-crowdsourced · requires moderation design |
| `nex_food_business_legacy` | true | false | Internal lineage marker only · not a direct source |
| `nex_accommodation_business_legacy` | true | false | Same |
| `nex_service_business_legacy` | true | false | Same |

**No external source currently permits display.** This is the deliberate governance state the founder sealed on 2026-10-13.

## Approval workflow

### 1 · Discovery

Any of:

- Harvest executor fetches an image URL (Wikimedia, business website, OSM `image` tag).
- Legacy reconciliation script matches a vertical-table `hero_image_url` to a `canonical_business_id`.
- Owner uploads an image through the sealed owner-upload path (**bypasses this queue** — enters `business_media` directly with `owner_approved = true`).

### 2 · Row in `nex.business_media_review`

The agent/script INSERTs a row:

- `candidate_canonical_business_id` · the business this image is for (NULL if ambiguous)
- `source_id` · FK to `nex.source_registry`
- `source_url` · the proposed URL
- `legacy_source_table` / `legacy_source_ref` / `legacy_hero_image_source` / `legacy_provenance` · if reconciled from legacy
- `match_confidence` + `match_method` + `match_evidence` · how the match was made
- `review_state = 'pending'` (default) OR `'quarantined'` if `match_confidence < 0.95` or multiple candidates

### 3 · Admin review

Admin opens `/nex-native/admin/image-review`. For each row:

- **Approve** · creates (or updates) a row in `nex.business_media` with `approved = true`, sets `review_state = 'approved'`, records `approved_media_id`.
- **Reject** · sets `review_state = 'rejected'`, records `review_notes`. No business_media row created.
- **Quarantine** · sets `review_state = 'quarantined'`. The row stays visible on a separate tab for re-review.
- **Merge** · if two reviews point to the same candidate+source, admin can merge; the duplicate becomes `review_state = 'merged'` without creating a second business_media row.

### 4 · Display

The resolver (`src/lib/nex-native/directory/media-resolver.ts`) returns a `DirectoryImage` only when:

```sql
business_media.approved = true
  AND source_registry.can_display = true
```

If `source_registry.can_display` later flips to `true` for an external source (future legal/governance decision), any pre-approved `business_media` rows become visible immediately — no code change needed.

If `source_registry.can_display` later flips to `false` (e.g. licence revoked), ALL images from that source stop displaying immediately — again, no code change needed. This is why the join lives in the resolver and not in the ingestion path.

## What never happens

- **No fabrication.** If a business has no approved image, the directory returns `primaryImage: null`. The UI renders an honest no-image state (category monogram glyph).
- **No display without approval.** Even if `business_media.approved = true`, if `source_registry.can_display = false`, the resolver returns null.
- **No display without a known source.** `source_id` is a NOT NULL FK; images without a known source cannot be stored at all.
- **No auto-approval of ambiguous matches.** `match_confidence < 0.95` or multiple candidates → `review_state = 'quarantined'`.
- **No overwrite of better verified images by weaker ones.** The unique index on `(canonical_business_id, media_kind, source_id)` prevents two rows for the same business+kind+source. When a stronger candidate arrives, the admin reviews and decides which to keep.

## Review-state values

| state | meaning | can_be_transitioned_to |
|---|---|---|
| `pending` | awaiting admin decision | approved · rejected · quarantined · merged |
| `approved` | admin approved; media row created | rejected (revoke · future wave) |
| `rejected` | admin rejected; no media row | pending (re-review) |
| `quarantined` | ambiguous · needs more evidence | pending · approved · rejected |
| `merged` | duplicate of another review · see approved_media_id | (terminal) |

The transition logic lives in the server action layer (`src/app/nex-native/admin/image-review/_actions.ts`). The DB does not enforce transitions beyond the CHECK on allowed values.

## Audit trail

Every state change updates `updated_at`. The reviewer identity is recorded in `reviewed_by`. The decision rationale (optional) is recorded in `review_notes`. The admin page displays these fields.

The underlying image on `business_media` carries its own `created_at` / `updated_at`. The join from the review table to the resulting media row is via `approved_media_id`.

## Non-goals (deferred to later waves)

- Automated re-check of broken images · the first-pass workflow is manual-first.
- Automated licence detection (OCR of Wikimedia metadata, etc.) · the first pass is human review.
- Owner challenge flow (owner rejects an admin-approved image) · future owner-portal work.
- Cross-business dedup (same photo linked to multiple businesses) · future wave.
