# NEX · `nex-media` Orphan Objects · Phase 1 Metadata Report · 2026-10-27

> **Status: Phase 1 metadata-only investigation complete.** No downloads performed. No content inspected. No disposition proposed. Neutral finding record only.
>
> **Authority**: owner approval 2026-10-27 (I-D4 clarification). Phase 2 (`G14` sample downloads) remains explicitly **NOT APPROVED**.
>
> **This document DOES NOT authorise:** downloading, publishing, migrating, deleting, re-keying, tagging, bulk approval, reference changes to `business_media`, storage-policy changes, bucket-visibility changes, or disposition decisions.
>
> **This document DOES:** record what the schema-level metadata says about the 913 objects.

## 1 · Scope

- **Target**: `storage.objects` where `bucket_id='nex-media'` and `name LIKE 'imported/%'`.
- **Method**: SELECT queries against `storage.objects` metadata + cross-reference SELECT against four existing authorised tables (`nex_account`, `nex_chat_theme`, `nex_business`, `nex_account`.id variant). Zero object downloads. Zero content inspection.
- **Instrument**: direct `pg` client against the Supabase pooler (`aws-0-eu-west-1.pooler.supabase.com`), SSL enforced, read-only query shape.

## 2 · Findings · verified facts

### 2.1 · Volume

- Total objects: **913**
- Monthly distribution: **100% in 2026-09**
- Earliest `created_at`: `2026-09-01 22:14:05.674 UTC`
- Latest `created_at`: `2026-09-01 23:47:34.314 UTC`
- **Interval between first and last object: 1h 33m 29s**

### 2.2 · Directory structure

Three top-level `<9-char-id>` prefixes under `imported/` hold all 913 objects:

| Prefix | Object count | First upload | Last upload |
|---|---|---|---|
| `5vv5pw26q` | 618 | 2026-09-01 22:14:05 UTC | 2026-09-01 23:47:34 UTC |
| `9mrgsv2rp` | 282 | 2026-09-01 22:14:19 UTC | 2026-09-01 23:44:52 UTC |
| `nepgaxllc` | 13 | 2026-09-01 22:14:32 UTC | 2026-09-01 23:18:57 UTC |

Total: 618 + 282 + 13 = **913** (reconciles).

### 2.3 · MIME type distribution

| MIME | Count |
|---|---|
| `image/jpeg` | 728 |
| `image/png` | 185 |

Sum: 913. No other MIME types present.

### 2.4 · Size

- Minimum: 1,294 bytes
- Maximum: 1,086,904 bytes
- Mean: ~198,572 bytes
- **Total bytes stored**: ~181,295,891 bytes (~181 MB)

### 2.5 · Ownership attribution

Both ownership columns on `storage.objects` are NULL for every object:
- `owner_id`: NULL on all 913 objects
- `owner` (older column): NULL on all 913 objects

**Operational interpretation of this fact**: these objects were NOT uploaded via an authenticated Supabase user session (which would populate `owner_id`). They were uploaded via a path that bypasses user ownership attribution · a service-role key or a legacy script with no session context.

### 2.6 · Bucket configuration

- `storage.buckets.id`: `nex-media`
- `storage.buckets.name`: `nex-media`
- `storage.buckets.public`: **`true`**

**Operational interpretation of this fact**: anyone who knows (or can enumerate) an object URL can download the content without authentication. This is a bucket-level configuration, not a per-object property.

### 2.7 · Cross-reference findings

Each of the 3 directory prefixes was checked against 4 authorised tables (SELECT only, no row content disclosed; counts only):

| Prefix candidate against | Match count |
|---|---|
| `public.nex_account.nex_handle` | **0** |
| `public.nex_account.id` | **0** |
| `public.nex_chat_theme.id` | **0** |
| `public.nex_business.id` | **0** |

**No prefix matches any identifier in these four authorised tables.** The `<9-char-id>` convention does not correspond to any current NEX entity surface.

### 2.8 · Code references in the current codebase

A grep across `src/` for the strings `nex-media.*imported`, `imported/.*nex-media`, and `imported/` returns **zero matches**.

**Operational interpretation of this fact**: no code in the current `nexapp` codebase reads from, writes to, or references the `imported/` path convention. These objects have no identified current consumer in the live application.

## 3 · What these findings mean (observational only)

Stating only what is factually supported by the metadata:

- **These 913 objects were created in a single ~1.5-hour bulk operation on 2026-09-01**, not organic user uploads over time.
- **The uploader did not use a Supabase user session** (owner_id NULL on all rows).
- **The directory ID convention is not currently in use by any identified NEX entity table.**
- **No code in the current `nexapp` fork reads these paths.**
- **The bucket is publicly readable** (`storage.buckets.public = true`).

## 4 · What these findings do NOT mean

- The report does NOT conclude that the objects are not business photos. Content inspection would be required (Phase 2 · G14 · explicitly not approved).
- The report does NOT conclude that the objects have no legitimate purpose. They may originate from a feature outside the current fork's scope (per `CLAUDE.md`, this `nexapp` repo was forked from a multi-product monorepo on 2026-10-10, and features present in `D:/trades` may have left artefacts here).
- The report does NOT propose a disposition. No "leave / move / purge" recommendation is advanced.
- The report does NOT recommend changing the bucket's `public=true` configuration. That is a separate owner question outside Phase 1 scope.

## 5 · Unresolved questions

| # | Question | Why Phase 1 cannot answer |
|---|---|---|
| 1 | What application originally wrote to `imported/<9-char-id>/*` on 2026-09-01? | No code reference remains in this fork; the originating feature may live in `D:/trades` or an earlier commit history not inspected. |
| 2 | What do the `<9-char-id>` strings represent? (Chat theme asset bundle IDs? Legacy user folder keys? Random slugs?) | Format inspection alone cannot distinguish; no cross-reference found. |
| 3 | What is actually in the 913 files (business photos, AI art, user sketches, screenshots)? | Would require content inspection · G14 explicitly not approved. |
| 4 | Should the bucket's `public=true` setting be re-evaluated? | Out of Phase 1 scope. Separate owner question. |
| 5 | Was there an uploader identity captured outside `storage.objects`? (e.g. a sibling import log table) | Not surveyed in Phase 1. Could be a follow-up read if the owner wants. |

## 6 · Recommended next step boundary

**Phase 1 is complete.** No further action is authorised by this document.

Possible owner-decision paths from here (presented neutrally, not ranked):
- (a) Treat Phase 1 as sufficient; file the findings; defer any disposition indefinitely.
- (b) Approve a specific, narrowly-scoped Phase 1.5 read (e.g. look for a sibling import log table) to resolve question #5.
- (c) Approve G14 (sample content downloads) under a separate explicit authorisation.
- (d) Resolve the question through non-NEX channels (e.g. consult the owner's own records of what was uploaded on 2026-09-01).

**Preserved rules (unchanged):**
- No download, publish, migrate, delete, re-key, tag, reference-change, or storage-policy change.
- `storage.buckets.nex-media.public=true` remains as-is pending separate decision.
- The 913 orphan objects are untouched.
