# NEX · `nex-media` Orphan Exposure Assessment · 2026-10-27

> **Status: READ-ONLY exposure assessment complete.**
>
> **Authority**: owner directive 2026-10-27 (Priority 1): assess exposure using existing metadata and storage configuration, report whether public access is intentional, report whether these objects should be assessed under a separate security review.
>
> **This document DOES NOT:**
> - Change bucket visibility, RLS, policies, grants, or any storage configuration.
> - Download any object.
> - Make any HTTP request to the bucket URL.
> - Link orphan objects to Directory listings.
> - Modify production in any way.
>
> **This document DOES:**
> - Report verified facts about `nex-media` access configuration.
> - Compare `nex-media` against all other NEX buckets.
> - State whether public access is intentional based on available evidence.
> - Recommend scope boundaries for a potential separate security review.

## 1 · Scope

- **Target**: `nex-media` bucket, 913 orphan objects under `imported/<9-char-id>/*`.
- **Method**: SELECT queries against `storage.buckets`, `storage.objects`, `pg_policy`, `information_schema.role_table_grants`, `pg_roles`. Zero HTTP requests to the bucket. Zero object content inspected.
- **Non-goal**: deciding whether to change the configuration. All findings are informational for owner decision.

## 2 · Verified facts about `nex-media`

### 2.1 · Bucket configuration

| Field | Value |
|---|---|
| `id` / `name` | `nex-media` |
| `public` | **`true`** |
| `owner` / `owner_id` | NULL |
| `created_at` | **`2026-09-01 22:04:37 UTC`** |
| `file_size_limit` | NULL (no cap) |
| `allowed_mime_types` | NULL (no restriction) |
| `versioning_status` | DISABLED |
| `lifecycle_configuration` | NULL |
| `type` | STANDARD |

### 2.2 · RLS posture on `storage.objects`

- Row-level security IS enabled on `storage.objects` (confirmed via `pg_class.relrowsecurity = true`).
- **Number of RLS policies on `storage.objects` that reference `nex-media`**: **0** (zero).
- **Number of RLS policies on `storage.objects` with NO bucket filter that would allow SELECT**: **0**.

**Operational interpretation**: with RLS enabled and no policy covering `nex-media`, the default-deny posture of PostgreSQL RLS means a direct SQL `SELECT ... FROM storage.objects WHERE bucket_id='nex-media'` run as the `anon` role returns **zero rows**.

### 2.3 · Supabase storage access path

Supabase's storage service serves objects through two distinct access paths, with different gates:

| Access path | Gate | nex-media result |
|---|---|---|
| **Direct public GET** · `/storage/v1/object/public/nex-media/<path>` | `storage.buckets.public = true` | **Succeeds without authentication** for any caller who knows the exact object path. |
| **Signed URL GET** · `/storage/v1/object/sign/nex-media/<path>` | Service role or policy-granted role | Only service_role can mint signed URLs. |
| **List API** · `/storage/v1/object/list/nex-media` | RLS SELECT policy on `storage.objects` | **Blocked for `anon`** because no RLS policy covers `nex-media`. |
| **Direct SQL via PostgREST** | RLS SELECT policy on `storage.objects` | **Blocked for `anon`** (same reason). |

**Combined posture**: anonymous callers CAN retrieve a specific object IF they know its exact URL. They CANNOT list/enumerate objects via the standard APIs. (See §4 on remaining enumeration vectors.)

## 3 · Comparative context · all 13 NEX buckets

| Bucket | public | RLS policies referencing | Object count | Created |
|---|---|---|---|---|
| nex-avatars | true | 0 | 0 | 2026-09-26 |
| nex-business-assets | true | 1 | 0 | 2026-09-30 |
| nex-chat-theme-hero | true | 1 | 8 | 2026-09-27 |
| nex-community-photos | true | 4 | 0 | 2026-10-11 |
| **nex-media** | **true** | **0** | **913** | **2026-09-01** |
| nex-mock-personas | true | 0 | 24 | 2026-10-25 |
| **nex-peer-chat-attachments** | **true** | **0** | **26** | **2026-09-27** |
| nex-theme-emoji | true | 1 | 52 | 2026-09-30 |
| nex-theme-intro | true | 0 | 11 | 2026-10-04 |
| nex-theme-sticker | true | 1 | 17 | 2026-10-01 |
| nex-user-intros | true | 4 | 0 | 2026-10-19 |
| nex-user-wallpapers | true | 4 | 0 | 2026-10-19 |
| nex-vault-files | **false** | 4 | 0 | 2026-10-03 |

### 3.1 · Anomalies observed

**Five public buckets have ZERO backing RLS policies:**

| Bucket | Objects | Note |
|---|---|---|
| **nex-media** | **913** | Subject of this assessment |
| **nex-peer-chat-attachments** | **26** | **CHAT ATTACHMENTS** · higher per-object sensitivity potential than orphan images · flagged below |
| nex-mock-personas | 24 | "mock-personas" naming suggests dev/testing content |
| nex-theme-intro | 11 | Theme assets |
| nex-avatars | 0 | Empty, inert |

Compared to buckets that DO have RLS policies, the "no-policy public" buckets rely entirely on `public: true` as their access gate · they have no secondary enforcement.

**Timeline**:
- `nex-media` is the OLDEST bucket by 25 days (2026-09-01 vs next earliest 2026-09-26).
- The current `nexapp` fork was created **2026-10-10** per `CLAUDE.md`.
- All 913 `nex-media` objects were uploaded 2026-09-01 22:14-23:47 UTC.
- All 913 objects pre-date the fork by ~5 weeks.

## 4 · Enumeration + exposure analysis

### 4.1 · Known-URL exposure

Any anonymous caller who possesses one of the 913 exact object URLs can download the content. Supabase's public GET path does not check authentication, referrer, or IP for public buckets.

**Vectors by which a URL could be known to a non-NEX party**:

| Vector | Likelihood |
|---|---|
| URL deliberately shared by an application surface | **Not currently happening** · zero code references to `imported/` in current fork |
| URL exposed via search-engine indexing (if the Supabase storage subdomain is crawled) | Possible · depends on `robots.txt` posture of `*.supabase.co`; owner must check |
| URL leaked via sibling features that formerly used these paths (pre-fork) | Possible if the pre-fork product rendered these URLs in HTML |
| URL discovered via side-channel (referer logs, screenshots of the pre-fork product) | Possible but out-of-NEX-scope |
| URL guessed via brute-force enumeration | **Very low** · 62^9 ≈ 13.5 trillion possible 9-char-id prefixes; filenames also required |

### 4.2 · Enumeration via API

- **Direct SQL via anon**: BLOCKED (RLS default-deny · no policy).
- **Supabase storage `/list/<bucket>` as anon**: BLOCKED (same reason).
- **Supabase storage `/list/<bucket>` as authenticated user**: BLOCKED unless an RLS SELECT policy allows it · no such policy exists.
- **Supabase storage `/list/<bucket>` as service_role**: ALLOWED (expected for operator access).

**Operational interpretation**: an attacker without the exact URL cannot efficiently discover orphan object paths via the standard APIs. **However, this assessment does NOT verify third-party indexing posture** (whether a search engine has crawled a Supabase-hosted URL that was once referenced in a pre-fork product). That is an **owner-only investigation** · requires reviewing historical pre-fork product code and any publicly-cached pages.

### 4.3 · Content sensitivity assessment

**Not performed.** Content inspection is explicitly G14 territory and was NOT APPROVED. The assessment below is based ONLY on metadata:

| Metadata signal | Observation | Interpretation (observational only) |
|---|---|---|
| MIME | 728 jpeg + 185 png | Image-only; no other media type |
| Size | 1.3 KB to 1.1 MB | Range consistent with user-uploaded images / AI-generated images |
| Filenames | `ChatGPT Image …`, `Untitled…`, etc. | Suggests AI-generated images and user sketches, NOT business photography |
| Uploader | `owner_id = NULL` on all 913 | Uploaded via service-role; not an authenticated user session |
| Timing | ALL 913 in a 1h33m window | Bulk operation, not organic growth |
| Origin | No code reference in current fork | Pre-fork feature; the originating application is not present in `nexapp` |

**None of these facts establish the content is sensitive or harmless.** They establish only that we cannot tell without inspecting content.

## 5 · Intentionality assessment

**Was public access to `nex-media` intentional?** Based on available evidence:

| Question | Verified answer |
|---|---|
| Was `nex-media` created with `public: true`? | Yes · the bucket row shows `public: true` and the bucket was created and populated within the same hour (22:04 bucket · 22:14 first upload). |
| Was a public-read RLS policy ever added? | No · zero policies reference `nex-media`. |
| Did a subsequent operator later tighten the bucket? | No evidence · `created_at = updated_at` on the bucket row (`2026-09-01 22:04:37` for both). |
| Does the current `nexapp` fork read or write these paths? | No · zero code references to `imported/` in `src/`. |
| Is there doctrine in the current fork justifying public access? | No · zero doctrine mentions `nex-media/imported/`. |

**Honest reading**: public access was configured at bucket-creation time (one setting choice). Whether that choice was deliberate for the pre-fork product (where the feature lived) is **unknown to the current fork**. The current fork inherited the configuration without reinforcing or revoking it.

**What this does NOT mean**: this is NOT a conclusion that public access is wrong, nor that it should be revoked. The owner holds the context about the pre-fork product's intent that would make that call.

## 6 · Recommendation on separate security review

**My recommendation**: **Yes, a separate security review is warranted**, with the following suggested scope. Scope decisions are the owner's; this is a proposal, not an authorisation.

### 6.1 · In-scope for the suggested security review

1. **`nex-media` configuration intent**: owner-level answer on whether the pre-fork product's public-image feature is being retired, migrated, or still active somewhere.
2. **The 5 "no RLS policy" public buckets as a set** (not just `nex-media`):
   - `nex-media` (913 orphans)
   - **`nex-peer-chat-attachments` (26 objects)** · chat attachments publicly readable without any policy gate is a **higher-sensitivity concern** than orphan images because chat content is user-authored and typically contextually private
   - `nex-mock-personas` (24 objects, naming suggests dev/testing but 24 live objects in production is worth confirming)
   - `nex-theme-intro` (11 objects, likely theme assets but same concern)
   - `nex-avatars` (empty · documentation-only review)
3. **Historical URL exposure**: whether any pre-fork product published Supabase storage URLs for these objects that may now be search-indexed or cached.
4. **Supabase storage logging posture**: are object GET requests logged? Is there a historical access record showing whether the 913 orphans have ever been downloaded by non-service-role callers?
5. **Lifecycle rules**: no lifecycle configuration on the bucket means objects persist indefinitely. Is this intentional for the content they hold?
6. **Vendor DPA posture for Supabase**: this is cross-cutting (per the jurisdiction fact assessment J-U10) but intersects with storage.

### 6.2 · Out-of-scope for the suggested security review (deferred separately)

- Content inspection of the 913 objects (G14 remains explicitly NOT APPROVED).
- Any migration, deletion, re-keying, or tagging of orphan objects.
- Any change to bucket `public` flag.
- Any addition of RLS policies.
- Any Directory listing linkage.

### 6.3 · Priority ordering (suggested)

1. **`nex-peer-chat-attachments`** · chat content exposure is higher-sensitivity than orphan images · 26 objects.
2. **`nex-media`** · 913 orphan objects · lower per-object sensitivity but larger volume.
3. **`nex-mock-personas` / `nex-theme-intro`** · lower sensitivity but same architectural gap.
4. **Historical URL indexing** · owner-only investigation.
5. **`nex-avatars`** · documentation only · bucket is empty.

## 7 · Preserved rules (confirmed unchanged by this assessment)

- `nex-media` bucket configuration: `public: true`, 0 RLS policies, 913 objects, UNCHANGED.
- All other bucket configurations: UNCHANGED.
- Zero objects downloaded by this assessment.
- Zero HTTP requests to the bucket URL.
- Zero RLS policies added, modified, or dropped.
- Zero grants modified.
- The 913 orphan objects remain untouched beyond metadata reads.
- No link exists between the orphan objects and any Directory listing.

## 8 · Open questions for the owner

- **S-Q1** Is the owner aware of a pre-fork product (or an upstream repository such as `D:/trades`) that used the `imported/<9-char-id>/*` path convention on 2026-09-01? If yes, this contextualises the uploads.
- **S-Q2** Does the owner have historical knowledge of the 3 directory IDs `5vv5pw26q`, `9mrgsv2rp`, `nepgaxllc`? (These are the only three distinct prefixes.)
- **S-Q3** Does the owner authorise a separate scoped security review covering the 5 "no-RLS-policy" public buckets, with the above priority order?
- **S-Q4** `nex-peer-chat-attachments` (26 objects) is the HIGHEST-sensitivity concern of the group. Does the owner want this specifically flagged for an immediate scoped review ahead of `nex-media`?
- **S-Q5** Should the Supabase storage logging / access-record review be conducted? (Requires owner to look at Supabase dashboard · Claude cannot access it.)
- **S-Q6** Does the current fork's business plan intend to retire or re-key the orphan objects, OR to leave them in place indefinitely?

## 9 · What this document, as recorded, does and does not

### DOES
- Record the verified facts about `nex-media` configuration, RLS posture, and comparative context across 13 buckets.
- State honestly that `nex-media` is one of 5 public buckets with no RLS policies.
- Flag `nex-peer-chat-attachments` as a higher-sensitivity concern of the same architectural pattern.
- Recommend a separate scoped security review.

### DOES NOT
- Change any bucket, policy, grant, or object.
- Download any object.
- Make any HTTP request to the Supabase storage URL.
- Resolve whether `public: true` is correct for `nex-media` (that is an owner decision).
- Link orphan objects to any Directory listing.
- Authorise content inspection (G14 remains NOT APPROVED).
- Begin remediation.
