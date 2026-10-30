# NEX Music — Upload + Live Delivery Contract (DRAFT)

**Status**: DRAFT. Captures owner-recommended defaults, resource-economics guardrails, proposed architecture, and file-by-file implementation sequence. No code, no migrations, no DB state has been changed by this document. Awaiting owner approval before any Step-2 code work begins and before any migration is applied.

**Scope**: end-to-end — Hendra uploads MP3 via Create → persists in NEX's chosen storage provider → selects track during NEX Live → player overlay renders over her broadcast → *for uploaded audio only*, music audio reaches a second viewer alongside her microphone audio.

**Visual acceptance reference**: owner-supplied `music player.png` (translucent glass, cyan/blue luminous outlines, album art left, title + artist, animated waveform, scrub bar with elapsed/total, prev/play/pause/next, volume, Spotify + YouTube source buttons, minimise + close controls).

**Authorship ladder**:
1. Audit returned 2026-10-29 (14-section report, read-only).
2. Owner authorised progression toward implementation with per-step review gate; migration-apply remains a separate gate.
3. Build-health precondition — pre-existing JSX parse errors in `src/app/nex-native/live-commerce/[sessionId]/_viewer-client.tsx:949-969` — resolved 2026-10-29 by wrapping the comment + `<JailOverlay/>` in a React Fragment.
4. DRAFT contract v1 (2026-10-29) captured Step 1.
5. DRAFT contract v2 (2026-10-29) — owner's Gate 1 review requested seven amendments covering resource economics, free-tier boundary, local-vs-published state separation, provider neutrality, Live-delivery test discipline, migration-safety, and workflow preservation.
6. **DRAFT contract v3 (2026-10-29)** — this revision. Owner requested one further clarification before Gate 1 approval: an explicit Media-category scope distinguishing (A) a central NEX-curated library, (B) user-uploaded music, (C) photo and video posts (own contract, out of scope here), and (D) Live broadcast media. The clarification lands in §2 as "Media-category scope" with the load-bearing rule *"a central curated library reduces duplication but does not eliminate storage, request or bandwidth costs."* Gate 1 remains unapproved pending owner review of this revised DRAFT.

---

## 1 · Owner-recommended product defaults

Nine defaults, recorded verbatim from the authorising instruction. Unless explicitly flagged below as a code-level conflict with sealed NEX doctrine, these govern implementation.

| # | Decision | Default | Status |
|---|---|---|---|
| D1 | Cover image | Optional. Default cover rendered when absent. | DRAFT |
| D2 | Track source | One primary source per track: uploaded MP3, Spotify URL, or YouTube URL. Mutually exclusive at the row level. | DRAFT |
| D3 | Library | Saved collection of tracks owned by the broadcaster. Queue selected tracks for Next/Previous during a Live session. | DRAFT |
| D4 | Spotify | Validate URL. Open the official source unless a compliant embed is verified. Do NOT download or rehost audio. | DRAFT |
| D5 | YouTube | Validate URL. Use the official player or open the source. Do NOT extract audio. | DRAFT |
| D6 | Visibility | Private library by default. A selected track can be heard during an authorised Live broadcast. | DRAFT |
| D7 | Free accounts | Music upload available with explicit server-enforced quotas. **Bounded, not unlimited.** No new paid entitlement introduced in this scope. | DRAFT |
| D8 | Deletion | User can delete a saved track. System has a documented cleanup path for the stored media object. | DRAFT |
| D9 | Rights | Uploader must confirm rights before upload. Follows the `rights_declaration` enum pattern already used for `nex_uploaded_video`. | DRAFT |

No conflict with sealed NEX doctrine detected in a read-only review of CLAUDE.md, memory, or `docs/doctrine/`. If a conflict surfaces during Step 2 code, implementation stops and the doctrine is amended before proceeding.

---

## 2 · Resource economics and account-protection contract

Owner directive 2026-10-29: *"NEX must protect itself from uncontrolled media-storage and delivery costs, particularly for free accounts."* This section is the governance envelope. All numbers below are **DRAFT PROPOSALS**. Each remains unapproved until it has been justified against (a) measured provider capacity, (b) a cost model NEX actually sustains, and (c) owner approval. No number in this section may be publicly promised, printed in UI, or hard-coded into customer-facing copy before justification.

### Media-category scope

Four distinct media categories, each with its own economics path. This DRAFT governs the music portions. The others are referenced only to the extent needed to prevent accidental scope creep across contracts. Categories must not be bundled under one quota, one bucket, or one adapter without separate explicit owner authorisation.

| # | Category | What it is | Who writes bytes | Economics model | Governed where |
|---|---|---|---|---|---|
| **A** | **NEX-curated music library** | Small centrally-managed collection of appropriately licensed short clips. Operator uploads once; users select by reference. | NEX operator | **Store-once / reference-many.** The track row stores a curated reference, not a per-user object. Zero per-user storage cost for the clip bytes. **Request operations + egress bytes still accrue per playback** and count against §2.3 aggregate budgets. | This DRAFT seals the scope boundary only. The curated library's own schema, licensing contract, ingest pipeline, and operator-admin surface are **separate, unapproved** scopes. |
| **B** | **User-uploaded music** | Hendra uploads her own MP3 / M4A. | End user | Per-account byte quota + per-account track count + per-account rate controls + aggregate soft ceilings (§2.1 · §2.2 · §2.3). | This DRAFT (full §2 — §13). |
| **C** | **Photo and video posts** | Photos / videos attached to posts (Create cards B / C / D on `/create`, currently placeholder-only). Also any short-clip-per-post feature if authorised later. | End user | **Separate contract — out of scope here.** Each surface needs its own doctrine covering per-file size cap, per-post count cap, aggregate storage ceiling, egress ceiling, retention, and deletion. If a photo post later references a Category A curated clip, the per-user storage cost for the clip bytes is still zero but each view counts against the aggregate egress budget. | Future doctrine. Not approved by this DRAFT. |
| **D** | **Live broadcast media** | WebRTC mesh audio/video reaching viewers in real time (mic + mixed music track, broadcaster video). | Transient — not persisted. | **Viewer-delivery is bandwidth, not storage.** Each live viewer receives a separate mesh track; audio bytes travel broadcaster → viewer per session and count against §2.3 aggregate egress for the music portion. Sealed broadcast cap `MAX_VIEWERS = 10` bounds per-session fan-out. Nothing from this stream is persisted beyond the ephemeral mesh. | §2.3 egress soft ceiling + §11 audio graph + sealed Live-eligibility contract (`docs/doctrine/nex-live-eligibility-contract-2026-10-27.md`). |

**Load-bearing rule**: *"A central curated library reduces duplication but does not eliminate storage, request or bandwidth costs."* Category A stores clip bytes once per curated track, not once per user who plays it. Every playback still consumes:

- Request operations — one per signed-URL mint + one per bucket GET per playback / seek event.
- Egress bytes — the clip bytes travel from the storage provider to the user's device (or to the broadcaster's device for mixing during Live, see §11).
- CDN cache fills — if a CDN is in front of storage, each cold edge still pulls from origin.

**Category boundaries sealed by this clarification**:

1. User-uploaded music (B) MUST NOT be auto-promoted into the curated library (A). Promotion requires an explicit operator curation + licensing step as part of A's own (separate) scope.
2. Curated-library tracks (A) have no per-user ownership and cannot be deleted by a user. Operator-only. Deletion triggers a reference-integrity sweep against any row that selected the clip.
3. The curated library's **licensing posture** is a separate authorisation gate. Approving Gate 1 of this DRAFT does **not** approve the acquisition, licensing, import, or storage of any curated clip.
4. Photo/video post media (C) is **out of scope**. This clarification only confirms that any future photo-post curated-clip feature inherits A's shared-reference semantics and respects §2.3 aggregate budgets.
5. The adapter in §5.1 remains provider-neutral. Categories A and B use the same adapter interface with different key conventions; the higher-level service decides which bucket, retention policy, and licensing posture applies.
6. Live broadcast media (D) is bandwidth, not storage. The music mixer in §11 consumes egress for category A playback (if a curated clip is selected) or category B playback (uploaded music), and counts against the same §2.3 aggregate egress soft ceiling.

**What this clarification does NOT do** (owner-authored boundaries, verbatim):

- Does **not** introduce a new paid entitlement.
- Does **not** change any existing entitlement.
- Does **not** choose a provider.
- Does **not** import music, curate any clip, or create any curated-library asset.
- Does **not** implement any of the above features.

### 2.1 Per-account bounds (application-level, server-enforced)

| Bound | DRAFT proposal | Justification required |
|---|---|---|
| Maximum individual uploaded file size | 20 MB | Must verify this fits a 10-minute 192-kbps MP3 + buffer; must verify provider accepts single-request upload of this size |
| Total stored-media allowance per account | 500 MB | Must be sized against the aggregate provider budget in §2.3; may need to shrink substantially |
| Maximum track count per account | 100 tracks | Enforced via DB aggregate COUNT |
| Maximum track duration | 10 minutes | Via `music-metadata` extraction server-side |
| Cover-image size cap | 2 MB (JPEG / WebP / PNG) | Mirrors existing `owner-upload-service.ts:49` size constant pattern |
| Cover-image dimensions | 2000 × 2000 px max, 400 × 400 min | Mirrors existing image owner-upload policy |

Values stored on `nex_account` or a related `nex_music_account_quota` row so an operator can lift or tighten a specific account without a schema change.

### 2.2 Rate controls — uploads, playback, delivery

| Control | DRAFT proposal | Enforcement |
|---|---|---|
| Uploads per account per hour | 10 | DB-backed per-account bucket (reuse pattern from `watch-listing-rate-limit-service.ts`) |
| Uploads per account per day | 50 | Same table, longer window |
| Uploads per account per 30 days | 500 | Same table, 30-day window |
| Delete-now (bypass soft-delete) per hour | 5 | Prevents churn-based abuse of hard-delete |
| Live playback — concurrent music streams per broadcaster | 1 | Only one track active in the mixer at a time (serial queue) |
| Egress rate per account (future) | DEFERRED | Requires provider-side signed-URL throttle or an edge-worker gate; not in scope v1 |

### 2.3 Aggregate provider budgets — application-level ceilings

NEX cannot assume a provider's free allowance is a cost cap. The ceilings below are **application-level circuit breakers** that pause or degrade a service before the provider surprises us with an invoice.

| Metric | DRAFT application-level ceiling | Provider counterpart | Honest limitation |
|---|---|---|---|
| Aggregate music-bucket storage across all accounts | 5 GB (v1 soft ceiling) | Supabase free-tier project storage (claimed 1 GB in owner message; **unverified against today's actual Supabase pricing page**) | If a hard provider cap exists, honour it as the hard limit; else `5 GB` acts as the app-level soft cap and we refuse new uploads at the gate |
| Monthly music-bucket egress across all accounts | 2 GB (v1 soft ceiling) | Supabase free-tier egress (claimed 5 GB in owner message; **unverified**) | If exceeded, degrade: fall back to local-only playback for the broadcaster; viewers receive mic-only; music overlay surfaces an honest notice |
| Daily upload volume (bytes) across all accounts | 500 MB (v1 soft ceiling) | — (no explicit provider daily ceiling on free tier that I can confirm read-only) | Soft-brake upload acceptance when within 10 % of ceiling |
| Monthly request operations (bucket PUT / GET) across all accounts | TBD | Supabase free-tier operation count — must verify | Verification task before Gate 2 |

These are **application-level safeguards**, not provider-enforced hard spending caps. On a free Supabase project, provider-side hard limits are limited to those the free tier technically refuses (storage overflow may fail inserts, egress overflow may rate-limit downloads). On a paid Supabase project, those limits do not translate to a dollar cap by default. **NEX does not have, and cannot promise, a hard dollar spending cap from Supabase alone.** Any such cap must be implemented as an application-level circuit breaker reading provider usage via Supabase's management API or a billing-alert integration.

### 2.4 Concurrency-safe reservations

A naive quota check (`SELECT sum(bytes) FROM tracks WHERE owner = X; if sum + new ≤ cap then INSERT`) races: two concurrent uploads can each pass the SELECT and jointly exceed the cap.

**Required pattern** (not implemented yet; design-only):

1. On upload intent, server inserts a `nex_music_upload_reservation(owner, requested_bytes, expires_at)` row inside a transaction that also computes the current `COALESCE(SUM(byte_size) FILTER (visibility <> 'removed'), 0) + SUM(reservation.requested_bytes) FROM reservations WHERE owner = X AND expires_at > now()` and rejects if the sum exceeds the cap. The transaction uses `SELECT ... FOR UPDATE` on an account-scoped row to serialise concurrent intents.
2. On upload success, the reservation row is deleted and a real `nex_music_track` row is written.
3. On upload failure or timeout (default 5 min), the reservation expires and is cleaned by a sweep job.
4. The bucket write uses the reservation id as the object path prefix so an orphan sweep can match orphan storage objects to expired reservations.

Alternative pattern: a `nex_music_account_bytes_used` counter row updated inside the same transaction via `UPDATE ... SET bytes_used = bytes_used + ? WHERE bytes_used + ? ≤ cap`, with a CHECK rejecting negatives. Simpler, no reservation table, but harder to tie orphan storage back to the failed intent.

**Decision gate**: pattern selection is part of the migration 235 review (Gate 2).

### 2.5 Monitoring, alerts, failure behaviour

| Signal | How we observe | What we do | Honest limitation |
|---|---|---|---|
| Account approaching per-account quota (≥ 80 %) | Server-side read on upload | UI warns the owner at 80 %, rejects at 100 % with a readable error code | Reliable; application-enforced |
| Aggregate storage approaching §2.3 soft ceiling (≥ 80 %) | Periodic cron / scheduled function reading `pg_relation_size` or Supabase management API | Operator alert; new uploads soft-brake above 90 %; refuse above 100 % | Requires a management-API token with limited scope; token itself must be kept server-only |
| Monthly egress approaching soft ceiling | Supabase management API (billing endpoint) | Degrade live mixer to mic-only when > 90 % monthly ceiling | **Requires verification** that the Supabase management API exposes this metric at the required granularity |
| Provider rate-limit error on bucket op | Try/catch at service boundary | Backoff + user-facing error; log for alert | Application-enforced |
| Provider outright 5xx error on bucket op | Try/catch at service boundary | Fail honestly; UI shows "music temporarily unavailable" | Application-enforced |

**Spending caps are not alerts.** Provider budget alerts (e.g. a dashboard notification) are informational. The §2.3 soft ceilings above become hard caps only because the NEX server application refuses to accept new work past them. If the operator ignores the alert, the next invoice may still be larger — because any egress Supabase has already served before the soft ceiling triggered is already billable. There is no provider-side knob available on current Supabase plans that stops traffic at a specified dollar amount.

### 2.6 Behaviour on free-allowance / provider-quota exhaustion

| State | Behaviour |
|---|---|
| Account at per-account cap | Upload rejected with `storage-quota-exceeded`; owner may delete tracks to free space |
| Aggregate soft ceiling ≥ 90 % | New uploads soft-brake with a visible banner "NEX Music is at capacity — try again shortly" |
| Aggregate soft ceiling ≥ 100 % | All new uploads refused; existing playback continues; broadcaster can still start Live without music |
| Monthly egress ≥ 100 % of soft ceiling | Live music mixer disabled across the application; broadcaster sees "music disabled for the rest of this cycle · ends in N days"; mic-only broadcasts continue |
| Provider project paused (Supabase free-tier inactivity) | **Honest failure** — the music library UI shows "music storage is temporarily unavailable"; no new uploads; existing published tracks may fail to play |
| Provider project disabled or deleted | Doomsday scenario — library UI shows "music storage not configured" and the Music card in Create reverts to its disabled Coming-soon state |

### 2.7 Behaviour on paid-entitlement expiry / cancellation

NEX today has `tier=gratis | bisnis | pro` and the `business_trial_status` flag. **No existing tier includes a music-storage entitlement.** This scope does **not** introduce one.

The contract must still define what would happen if, in a future scope, music storage were tiered:

| Scenario | Behaviour |
|---|---|
| Account was on a music-paying tier and the entitlement expires | Grace window (DRAFT: 30 days) during which existing uploads remain readable and playable but new uploads are refused. After grace, playback stops; soft-delete all over-free-cap tracks after a documented notice window |
| Account was on a trial that converts to free | Same as above; the hard cap tightens to free numbers at trial end |
| Account cancels explicitly | Same grace path, but shorter (DRAFT: 7 days) because the owner opted out intentionally |
| Provider-side action (chargeback, fraud) | Operator discretion; no automatic deletion without a paper trail |

**None of these flows are implemented in this scope.** They are scaffolding only — a reminder that the entitlement contract and the music contract must be re-reconciled before any paid music tier ships.

### 2.8 Provider-migration path (storage-adapter model)

| Requirement | Mechanism |
|---|---|
| NEX music metadata lives in PostgreSQL | `nex_music_track` row stores `media_url` as an **opaque storage reference**, not a provider-specific URL. The adapter translates reference → signed URL. |
| Storage bytes live in an object store | A thin TypeScript adapter interface — `MusicMediaStorage` — exposes `putObject`, `getSignedReadUrl`, `deleteObject`, `objectExists`, `copyObject`. Supabase, R2, S3, or local disk implement this interface. |
| Provider is swappable without library-model change | Only the adapter module changes. The row model, RLS, services, UI, mixer are provider-agnostic. |
| Migration between providers | A one-shot `scripts/music/migrate-storage-provider.mjs` would (a) list all `nex_music_track` rows, (b) `copyObject` from the old adapter to the new adapter, (c) rewrite `media_url` to the new reference, (d) delete from the old adapter after a verification window. **Not written in this scope.** |
| Signed-URL semantics | The adapter must support short-lived signed URLs (< 1 hour). Any provider that does not support signed URLs cannot be selected without re-opening the visibility/RLS contract. |

**Any provider decision is a separate authorisation.** This DRAFT does not approve Supabase, R2, S3, or any other provider as the production store. §6 details the open question.

### 2.9 Explicit "all values are DRAFT PROPOSALS" clause

Every number in §2.1 through §2.4 is a **DRAFT proposal**, not a verified safe value. Before approval of Gate 2 (migration SQL review), each must be justified against:

1. Measured provider capacity for the chosen provider.
2. A written cost model showing worst-case monthly spend at the proposed numbers across a plausible account population.
3. Owner acceptance of the resulting spend envelope.

Numbers may shrink, grow, or be re-shaped (e.g. per-track cap replacing per-account cap). This DRAFT reserves the right to any of those changes without being treated as a scope expansion.

The §2 Media-category scope above (Categories A/B/C/D) is also provisional. Category A's store-once model is a cost-shape *intent*, not a confirmed cost reduction: realised savings depend on (a) how many users select the same curated clip, (b) whether a CDN sits in front of storage and how its cache hit rate behaves, and (c) the licensing posture of each clip. The curated-library economics will be re-justified in A's own doctrine before any curated clip is imported.

---

## 3 · Free-tier and membership-entitlement boundary

### 3.1 Free is bounded, not unlimited

Free users receive the §2.1 per-account bounds and the §2.2 rate controls as a hard application-enforced ceiling. The ceiling is not advertised as a feature; it is a safety guardrail. UI copy for free users must honestly state limits where relevant (e.g. "You've used 420 MB of your 500 MB storage" at warning threshold).

### 3.2 No new paid entitlement introduced

This scope does **not** add a paid music tier. It does **not** modify the sealed R9 live-eligibility contract. It does **not** modify Shop membership or Vault entitlements.

If, in a future scope, a music-paying tier is added:
- It requires its own entitlement contract (mirror of `docs/doctrine/nex-vault-entitlements-policy-sheet-2026-10-20.md`).
- The existing paid tiers (`bisnis`, `pro`) do **not** automatically include an elevated music allowance.
- `hasShopAccess` is NOT the gate for music upload — a separate gate (currently: free is sufficient) applies.
- Any customer-facing promise of a music allowance tied to a paid tier requires owner approval of the entitlement contract first.

### 3.3 Published copy restraint

Until the §2 numbers are justified, no public UI, pricing page, marketing material, email, help-centre doc, or in-app tooltip may state a specific storage allowance, upload size, or track count. Internal error messages (e.g. "storage-quota-exceeded, used 500 MB, limit 500 MB") may surface the number for the owner of the account only.

---

## 4 · Local draft / uploaded / cached / published — four distinct states

A clear separation prevents confusion between "it's on my phone" and "NEX has saved it for me".

| State | Where | Lifetime | NEX cost | What the user sees |
|---|---|---|---|---|
| **Local unpublished (draft)** | On the device, in-browser (File input selection), unsent | Until the tab closes, the user navigates away, or the device clears memory | Zero (never left the device) | A compose-form with a selected file; no NEX record exists |
| **Uploaded to NEX (private library)** | On the chosen storage provider, under NEX's ownership; metadata row exists in `nex_music_track` with `visibility='private'` | Until the owner deletes OR the retention sweep hard-deletes a soft-removed row | Full storage cost + egress-on-fetch cost | Appears in the owner's Music Library |
| **Cached on device** (browser cache / Service Worker) | On the device, local cache | Until the browser evicts (unpredictable) OR the user clears site data | Zero NEX cost (bytes already egressed; may reduce future egress on re-play) | Transparent to the user; playback feels snappy |
| **Published (shared during Live)** | Metadata row flipped to `visibility='shared_live'`; still owner-only readable; **temporarily audible** to Live viewers via the mixer — but only during an active broadcast | Row persists; "shared" state is session-scoped, not a permanent publication | Same storage cost; **egress during Live is per-viewer** (mesh broadcasts to each viewer separately) | A badge "available during Live" in the library; viewers never see a direct library listing |

### 4.1 Local drafts are NOT backups

If Hendra selects an MP3 in the upload form but closes the tab before clicking Submit, **the file is lost from NEX's perspective**. The user's own file-system copy is unchanged, but NEX has no record. This must be honest in the UI — no "we saved your draft" copy for the file-input step.

Resumable multi-chunk uploads are **not** in scope v1; a dropped connection mid-upload means the user retries the full upload. See §13.1 failure handling.

### 4.2 Behaviour on upload failure

| Failure | User-visible outcome | Server-visible outcome |
|---|---|---|
| Network drop before upload begins | "Upload failed — try again"; original file still on device | No row, no bucket object |
| Network drop mid-upload | "Upload interrupted — try again"; original file still on device | Reservation row expires; orphan storage object (if any) swept within 24 h |
| Signature-check fail at server | "File does not look like an MP3 or M4A"; original file still on device | No row created; any uploaded bytes deleted inline |
| Quota-exceeded fail at server | "You've reached your storage limit — delete a track to continue"; original file still on device | No row created; no bytes stored |

### 4.3 Behaviour on app removal / device change / cache clear

| Event | What survives |
|---|---|
| User uninstalls / clears PWA | Nothing local survives; NEX library is unchanged (data lives on the provider + Postgres) |
| User signs in on a new device | NEX library accessible with the same credentials; no local cache yet; first playback re-fetches |
| User clears browser site data | Same as new device |
| User deletes the only copy on their own device (not NEX's copy) | Nothing changes in NEX; their local original is just gone |

### 4.4 "Published" ≠ permanent publication

"Shared during Live" is a session-scoped audibility grant. There is no permanent public NEX music feed in this scope. Viewers do not get a direct URL. There is no re-sharing, re-posting, or embedding. If a viewer records the Live, that is outside NEX's control — same as any live-stream.

---

## 5 · Storage provider contract — adapter-first, provider-neutral

### 5.1 Adapter interface

```ts
// Design-only sketch, not final signature.
export interface MusicMediaStorage {
  putObject(args: {
    objectKey: string;       // caller-chosen path, e.g. "owner/<uuid>/<track>/<reservation>.mp3"
    contentType: string;     // "audio/mpeg" | "audio/mp4" | "image/webp" | "image/jpeg" | "image/png"
    bytes: Buffer | Uint8Array;
    byteLength: number;
    ownerAccountId: string;  // for provider-side tagging / audit
  }): Promise<{ reference: string }>;  // opaque reference stored in `media_url`

  getSignedReadUrl(args: {
    reference: string;
    expiresInSeconds: number;  // ≤ 3600
    ownerAccountId: string;    // used for provider-side access logging
  }): Promise<{ signedUrl: string; expiresAt: Date }>;

  deleteObject(args: { reference: string }): Promise<{ deleted: boolean }>;

  objectExists(args: { reference: string }): Promise<{ exists: boolean; byteLength?: number }>;

  copyObject(args: { fromReference: string; toReference: string }): Promise<{ reference: string }>;
}
```

The adapter is the only module that knows about Supabase bucket paths, R2 bucket names, S3 keys, or anything provider-specific. Services, actions, UI, and the mixer consume only the opaque `reference` + signed URLs.

### 5.2 Candidate providers — honest profile

Each candidate's profile below is a **starting hypothesis** that must be verified against today's provider documentation before adoption. Any specific number quoted here is sourced from the owner's own description in the Gate-1 review message and has **not been independently verified against the live provider pricing page**.

| Provider | Owner-provided description | Verification required before adoption |
|---|---|---|
| Supabase Storage (same project as `ijvqdvsvwtwxzcqmoqit`) | 1 GB file storage, 5 GB egress, 5 GB cached egress on free tier; free projects can pause after one week of inactivity | Confirm current free-tier numbers; verify project-pause policy; verify management-API endpoints for usage metrics; verify signed-URL semantics; verify RLS policy templates for a private bucket; verify behaviour at quota exhaustion |
| Cloudflare R2 | 10 GB-month storage, 1M Class-A ops, 10M Class-B ops; no direct R2 egress charges; account setup required | Verify current free-tier limits; verify API shape; verify signed-URL support; verify egress-not-charged policy still applies; verify at-rest encryption; verify multi-region behaviour |
| Other (S3, GCS, Backblaze B2) | Not evaluated | Would require full RFC-style evaluation before adoption |

### 5.3 Default DRAFT selection: *none approved*

This DRAFT does **not** select a provider. It requires that whichever provider is selected satisfy §2.3 soft-ceiling observability, §2.4 concurrency-safe reservation support, §2.8 provider-migration-path adapter contract, and §4.4 signed-URL support.

If, after verification, Supabase Storage is chosen as v1 provider, the practical argument is that NEX already uses Supabase for Postgres, auth, Realtime, and existing image/video buckets — one less moving part. If, during Step 2 implementation, Supabase proves insufficient, the adapter model lets R2 or another provider slot in without changing the music-library ownership + metadata model.

### 5.4 No new provider integration is authorised

No bucket is created. No Supabase management API token is minted. No R2 account is linked. No S3 credentials are introduced to the project. This DRAFT describes the model only; implementation of any adapter beyond Supabase requires separate authorisation.

### 5.5 Hard-cap honesty

NEX cannot promise a provider-enforced hard dollar cap on any of the above providers at the free tier. All effective caps are **application-level circuit breakers** per §2.3. If a provider later offers a true hard spending cap (e.g. a Cloudflare account-level cap, a Supabase plan with a billing-stop), NEX can wire it in — but it is a future scope.

---

## 6 · Source types + validation

Three mutually-exclusive source types per `nex_music_track` row:

### 6.1 `uploaded_audio`

| Rule | Value |
|---|---|
| Allowed MIME types | `audio/mpeg`, `audio/mp4` (M4A). Second format included because iOS Safari records to and plays `audio/mp4` natively. |
| Allowed file extensions | `.mp3`, `.m4a` (validated against MIME, not trusted alone). |
| Server-side signature verification | ID3v2 header probe for MP3; `ftyp` box probe for M4A. Library: `file-type` (reads magic bytes). |
| Maximum file size per upload | Governed by §2.1. |
| Maximum duration | Governed by §2.1. |
| Metadata extraction library | `music-metadata` (reads ID3v2.3/v2.4, APE, Vorbis, MP4 atoms) — populates title, artist, duration_ms, bitrate; owner can override on form. |
| Storage bytes | In a private bucket under the adapter chosen in §5. Owner-signed read via adapter's `getSignedReadUrl`. |
| `media_url` field | Opaque `reference` string returned by adapter's `putObject`. Not a signed URL. Not provider-specific at the row level. |

### 6.2 `spotify_url`

| Rule | Value |
|---|---|
| Allowed URL hosts | `open.spotify.com`, `spotify.com`. |
| Allowed URL paths | `/track/<id>`, `/album/<id>/track/<id>`. |
| Validation | `URL` parser + host allowlist (pattern mirrors `watch-image-origin.ts:67-123`) + path regex. |
| Playback | v1: **link-out only.** `window.open(url, "_blank", "noopener")`. The in-app controls are DISABLED for Spotify sources with an honest status caption *"Opens in Spotify · viewers hear mic only"*. See §9. |
| NEX stores | URL only in `nex_music_track.source_url`. No bytes. |

### 6.3 `youtube_url`

| Rule | Value |
|---|---|
| Allowed URL hosts | `www.youtube.com`, `youtube.com`, `youtu.be`, `m.youtube.com`. |
| Allowed URL paths | `/watch?v=<id>`, `/v/<id>`, `/<id>` (youtu.be short), `/shorts/<id>`. |
| Validation | URL parse + host allowlist + path regex + 11-char video-id shape. |
| Playback | v1: **link-out only.** Honest status caption *"Opens in YouTube · viewers hear mic only"*. See §9. |
| NEX stores | URL only in `nex_music_track.source_url`. No bytes. No `yt-dlp`. No proxying. |

---

## 7 · Rights declaration

Mandatory enum on upload. Mirrors `nex_uploaded_video.rights_declaration`.

| Value | Meaning |
|---|---|
| `owner_content` | Uploader created the audio themselves. |
| `licensed` | Uploader holds a licence (names the licence in a `rights_notes` TEXT column). |
| `public_domain` | Audio is in the public domain. |

- Only `owner_content | licensed | public_domain` are accepted. `null` is rejected.
- Rights declaration is stored on the track row and is immutable after creation (future edit flow requires explicit re-declaration).
- No DMCA takedown flow is in scope here; a separate doctrine entry will author one when needed.
- The upload form displays a checkbox: *"I confirm I have the rights to use this audio on NEX."* — form cannot submit without it.
- The owner's rights declaration DOES NOT transfer any rights to NEX; NEX is a hosting intermediary.

---

## 8 · Ownership + visibility

| Column | Role |
|---|---|
| `owner_account_id uuid` | FK to `nex_account(id)`. Mandatory. The only account authorised to read/modify. |
| `business_id uuid NULL` | FK to `nex_business(id)`. Optional. When attached, the track inherits business-level audit; when NULL, personal library. |
| `visibility` enum | `private` (default) \| `shared_live` (eligible for playback during the owner's Live broadcasts) \| `removed` (soft-deleted). |

RLS policy template (mirrors `nex_uploaded_video` from migration 223):

- `authenticated` SELECT: `owner_account_id = (SELECT auth.uid())`.
- No INSERT/UPDATE/DELETE policy for `authenticated` — writes flow via server actions running under service role.
- `anon`: no access.

Playback during Live: the server renders the player with a short-lived signed URL for the audio object fetched via the §5 adapter. Viewers in the mesh receive the mixed audio stream (see §11), not a direct storage URL.

---

## 9 · Track metadata + deletion

### 9.1 Row shape (proposed `nex_music_track`)

```sql
id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid()
owner_account_id     uuid         NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE
business_id          uuid         NULL REFERENCES nex_business(id) ON DELETE SET NULL
source_type          text         NOT NULL CHECK (source_type IN ('uploaded_audio','spotify_url','youtube_url'))
title                text         NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200)
artist               text         NULL CHECK (artist IS NULL OR length(trim(artist)) BETWEEN 1 AND 200)
album                text         NULL CHECK (album IS NULL OR length(trim(album)) BETWEEN 1 AND 200)
duration_ms          integer      NULL CHECK (duration_ms IS NULL OR duration_ms BETWEEN 1 AND 36000000)
media_url            text         NULL  -- opaque adapter reference for uploaded_audio
source_url           text         NULL  -- external URL for spotify_url/youtube_url
cover_image_url      text         NULL  -- adapter reference OR external allowlisted URL
byte_size            bigint       NULL CHECK (byte_size IS NULL OR byte_size BETWEEN 1 AND 52428800)
mime_type            text         NULL CHECK (mime_type IS NULL OR mime_type IN ('audio/mpeg','audio/mp4'))
bitrate_kbps         integer      NULL
rights_declaration   text         NOT NULL CHECK (rights_declaration IN ('owner_content','licensed','public_domain'))
rights_notes         text         NULL
visibility           text         NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','shared_live','removed'))
created_at           timestamptz  NOT NULL DEFAULT now()
updated_at           timestamptz  NOT NULL DEFAULT now()
removed_at           timestamptz  NULL

-- Mutual-exclusion check: exactly one of media_url / source_url
CHECK (
  (source_type = 'uploaded_audio' AND media_url IS NOT NULL AND source_url IS NULL)
  OR (source_type IN ('spotify_url','youtube_url') AND source_url IS NOT NULL AND media_url IS NULL)
)
```

Supporting tables:

- `nex_music_upload_reservation(owner_account_id, requested_bytes, created_at, expires_at)` — supports the §2.4 concurrency-safe reservation pattern.
- `nex_music_account_quota(owner_account_id, max_bytes, max_tracks, max_uploads_per_hour, …)` — optional per-account override.
- `nex_music_rate_limit` — reused from `nex_watch_listing_rate_limit` pattern.

Indexes:

- `(owner_account_id, visibility, created_at DESC)` — library listing hot path.
- Partial index on `visibility = 'shared_live'` for Live-session track-picker.

### 9.2 Deletion

- **Soft delete** (default UX): `visibility = 'removed'`, `removed_at = now()`. Row persists for 30 days.
- **Hard delete** after retention window: a daily sweep (reuse `watch-retention-service.ts:1-100` pattern) deletes storage objects via the §5 adapter and the row.
- **Explicit "delete now" option**: bypasses the 30-day soft-delete window and runs the storage-object delete immediately. Rate-limited to prevent abuse (see §2.2).
- Deletion is reflected across Live-session queues (track removed from the picker on next session; if the broadcaster is actively playing a deleted track, playback continues until end of track, then no re-queue).
- Orphan sweep: a separate job removes bucket objects whose matching row is absent or expired, to protect against failed-mid-upload leftovers.

---

## 10 · Player + Live integration

### 10.1 Player component — target location

`src/components/nex-native/music/NexMusicPlayerOverlay.tsx` — NEW. In the sealed `nex-native` tree, NOT ported from `src/components/nex-app/live/MediaPlayer.tsx` (which is legacy, outside the fork boundary). The legacy player may be read for reference during build but is NOT imported.

### 10.2 Player composition — reusing audited primitives

| Overlay region | Primitive to reuse | Evidence |
|---|---|---|
| Full-bleed chrome | Pattern from `JailOverlay` (`src/components/nex-native/live-commerce/JailOverlay.tsx:41-89`) | audit §8 |
| Scrub bar + seek | `LiveViewerFooter` video-progress-bar (`src/components/nex-native/live-commerce/LiveViewerFooter.tsx:127-174`) — draggable white dot, `onSeek(percent)` | audit §8 |
| Cover-art card | `ProductOverlayCard` (`src/components/nex-native/live-commerce/ProductOverlayCard.tsx:22-80`) — 1:1 glass thumbnail with cyan rim | audit §8 |
| Track info caption | `WatchOverlayCaption` (`src/components/nex-native/live-commerce/WatchOverlayCaption.tsx:1-100`) — glass + hairline dividers | audit §8 |
| Typography + colour | `src/lib/nex-native/design-tokens.ts:60-174` — sealed font stack + typography roles + ping-badge size | audit §8 |

Visual acceptance reference: owner-supplied `music player.png`. Palette: translucent glass base, cyan/blue luminous outlines, glow, polished controls. No new colour tokens introduced; use `cyan` / `blue` values already present in `ProductOverlayCard`'s rim and `WatchOverlayCaption`'s divider.

### 10.3 Overlay insertion point in the Live surface

**File**: `src/app/nex-native/live-commerce/enter-broadcast-room/_go-live-client.tsx`

**Insertion rules** (verified via audit):

1. Mount the overlay **inside** the sealed main container, **above** the existing viewer-footer-pill (`_go-live-client.tsx:1319`), and **above** the existing live-state identity caption from Options C/D.
2. **Must not** sit over the Stop Live button (`_go-live-client.tsx:1280-1311`, zIndex 25) — overlay zIndex must be below 25 OR must be dismissible before Stop Live is engaged.
3. **Must not** permanently occlude the text-input composer area at the bottom (viewer-footer-pill zone, 14-58 px from safe-area bottom).
4. **Must not** mount during `showEndedRecap` — the Live Finished recap owns that frame.

**Open / minimise / close behaviour**:

- **Open**: a new "Music" button in the owner right-rail (same style as the Jail button at `_go-live-client.tsx:1086-1137`). Tap opens the overlay in full state.
- **Minimise**: a dock chip (small pill, ~40 × 40 px, cover-art thumbnail + progress fringe) pinned to the right rail. Tap re-opens the full overlay.
- **Close**: fully unmounts the overlay AND stops music playback. Does NOT stop the Live session.
- When the Live session ends (`endBroadcast()`), the overlay closes automatically and the audio graph is torn down.

### 10.4 Owner-rail button

Add a 6th rail button `label="Music"` with a glyph (♪ or an svg music-note). Opens overlay. Visible only during `state === "live"`.

---

## 11 · Delivery of audio to Live viewers — the critical path

**Problem**: today, `broadcast-engine.ts:140-220` captures ONE `MediaStream` from `navigator.mediaDevices.getUserMedia({audio:true, video:{facingMode:"user"}})`. The audio track is the microphone. Viewers receive this track via WebRTC mesh (`broadcast-peer.ts:216`). If music plays via a plain `<audio>` element on Hendra's device, Hendra hears it locally but **viewers do not** — the WebRTC audio track is mic-only.

**Solution**: WebAudio API mixing. Mix microphone audio + music audio into a synthetic `MediaStream` that is swapped into the WebRTC PeerConnection's audio track.

### 11.1 Audio graph

```
                                   ┌─── Volume Gain (user slider) ───┐
                                   │                                 │
                           ┌───────┴──────┐                          ▼
microphone (getUserMedia) ─► MediaStreamSource ─► Mic Gain (always 1.0 — do not duck mic) ─┐
                                                                                           ▼
                                                                                     Mixer ──► MediaStreamDestination ──► outgoing WebRTC audio track
music file (<audio> element) ─► MediaElementSource ─► Music Gain (user slider) ────────────┘
```

### 11.2 Required primitives

- `AudioContext` (one per Live session, created lazily on first play).
- `MediaStreamAudioSourceNode` from the mic track.
- `MediaElementAudioSourceNode` from an `<audio>` element loaded with the signed adapter URL.
- `GainNode` × 2 (mic gain, music gain) — mic defaults to 1.0, music defaults to 0.8.
- `MediaStreamAudioDestinationNode` — produces the mixed `MediaStream`.
- `RTCRtpSender.replaceTrack(newAudioTrack)` — swap the outgoing audio track in-place. Does NOT renegotiate.

### 11.3 Lifecycle rules

1. **On session start**: AudioContext is NOT created. Mic track from `getUserMedia` is sent directly (today's path).
2. **On first track selection**: AudioContext is created, mic is re-routed through the mixer, music track added, mixed stream replaces the outgoing audio sender via `replaceTrack`. Latency target < 50 ms.
3. **On pause**: music gain → 0. Mic unaffected. No `replaceTrack` call.
4. **On track change / next / previous**: audio element `src` changes, no graph rewire.
5. **On overlay close**: music gain → 0, music element paused + source disconnected. Mixer stays running until session end to avoid renegotiation thrash.
6. **On session end**: full teardown. Close AudioContext. Close `<audio>` element. Null the `media.srcObject`. Signed adapter URL expires naturally.

### 11.4 Browser compatibility notes

- Safari requires `AudioContext` creation inside a user-gesture callback. The "Open music overlay" tap satisfies this.
- Firefox: `MediaStreamAudioDestinationNode` is standard; works.
- Chrome / Edge / Chromium derivatives: supported.
- iOS Safari webview: supported but any autoplay must follow a user gesture.

### 11.5 What is NOT in scope

- No audio ducking.
- No DSP / EQ / compressor / limiter.
- No crossfade between tracks.
- No sidechain. No sync-to-beat.
- Visualiser other than the owner's spec'd waveform.

### 11.6 Honest limitation: Spotify / YouTube can NOT be mixed to viewers

Spotify and YouTube cannot be mixed into the WebRTC audio stream. Reasons: (a) DRM on licensed content, (b) cross-origin iframe isolation prevents `MediaElementAudioSourceNode` from a provider-controlled iframe. **Any attempt to extract audio from a Spotify/YouTube embed into our MediaStream would violate provider terms and is explicitly out of scope.**

**v1 behaviour** when the active track is Spotify or YouTube:
- Hendra's device plays the music locally (link-out opens the official source).
- Viewers hear **mic only**.
- The overlay displays an explicit status: *"Playing in Spotify · viewers hear mic only"* (or *"… in YouTube …"*).
- The in-app controls (scrub, volume, prev/next) are DISABLED or carry a provider-specific override indicating they do not affect what viewers hear.

### 11.7 Verification requirements (acceptance tests)

Specified in §13.4. These are **hard acceptance criteria** before any claim of "music works for viewers" can be made.

---

## 12 · Provider-specific URL behaviour

### 12.1 Spotify

- Validation: regex + host allowlist (§6.2).
- v1 behaviour: tap "Play" → opens Spotify in a new tab via `window.open(url, "_blank", "noopener")`. The in-app player controls are disabled for Spotify sources with the §11.6 status caption.
- Future v2 behaviour (**separate authorisation**): Spotify iframe embed via `https://open.spotify.com/embed/track/<id>`. Requires Spotify Developer agreement. In-app Play / Pause can control the embed via `postMessage` — scrub bar cannot (API does not expose seek). Volume cannot (API does not expose it either).
- No credentials. No OAuth. No `/me/player` API calls.

### 12.2 YouTube

- Validation: regex + host allowlist + 11-char ID (§6.3).
- v1 behaviour: tap "Play" → opens YouTube in a new tab. In-app controls disabled with the §11.6 status caption.
- Future v2 behaviour (**separate authorisation**): YouTube IFrame Player API. Can control play / pause / seek / volume via `postMessage` provided the video's embed flag allows it. Must honour `onError` → fall back to link-out.
- No API key for Data API. No `yt-dlp`.

### 12.3 Design acceptance

The owner's `music player.png` includes Spotify and YouTube source buttons. In v1:
- Visually mirror the design.
- When the active track is Spotify/YouTube: the main play button is replaced with an "Open in Spotify" / "Open in YouTube" label, mix controls disabled, honest status caption rendered.
- When the active track is `uploaded_audio`: the source buttons are inert indicators showing this track is from NEX's own storage; the full control strip is active and reflects real playback state.

### 12.4 No simulated controls

Do not render a decorative play / pause / scrub for a Spotify or YouTube track. Any control that appears must do what it claims. If it cannot do what it claims (because the provider does not expose it), it must be visibly disabled with an explanation.

---

## 13 · Failure handling, cleanup, tests

### 13.1 Upload failures

| Failure | Response |
|---|---|
| Bad MIME | 415 `{code:"unsupported-media-type"}` |
| Oversize | 413 `{code:"too-large", limitBytes}` |
| Bad signature | 422 `{code:"signature-mismatch"}` |
| Over per-account quota (bytes) | 429 `{code:"storage-quota-exceeded", usedBytes, limitBytes}` |
| Over per-account track count | 429 `{code:"track-count-exceeded"}` |
| Over aggregate soft ceiling (§2.3) | 503 `{code:"service-at-capacity"}` + retry-after hint |
| Rate-limited | 429 `{code:"rate-limited", retryAfterSeconds}` |
| Rights not declared | 400 `{code:"rights-required"}` |
| Partial / dropped upload | Resumable uploads NOT in scope v1 — client retries full upload; reservation expires |
| Metadata extraction failure | Upload succeeds; title defaults to filename; owner can edit |

### 13.2 Storage orphans

- Upload success is a two-phase operation (reservation + bucket write + row insert). Any failure between phases can leave an orphan storage object.
- Mitigation: upload uses the reservation id as the object key prefix. A nightly sweep enumerates bucket objects, matches each to a reservation / track row, and deletes those whose matching row is absent or whose reservation has expired for > 24 h.
- Metrics: the sweep emits counts of orphans found + deleted to the operator alert channel defined in §2.5.

### 13.3 Playback failures during Live

- Signed-URL expiry mid-track: pre-fetch replacement URL at 50 % progress mark.
- Mix-stream `replaceTrack` throws: fall back to mic-only, surface a toast in the overlay *"Music temporarily unavailable to viewers"*. Live session continues.
- `AudioContext` fails to initialise: show mic-only mode + disabled "Share with viewers" indicator; local playback still works.
- Network loss on broadcaster side: WebRTC handles the mic track; music element may stall → auto-pause.

### 13.4 Required Live-delivery acceptance tests (Amendment 5)

These are **hard pre-conditions** before any claim of functional music-to-viewer broadcast. Each must be executed against a two-device setup with Hendra on device A broadcasting and a viewer on device B joining. All tests pass or the feature is not shipped.

| # | Test | Pass criteria |
|---|---|---|
| T1 | Hendra starts Live; viewer joins; Hendra speaks | Viewer hears Hendra's mic |
| T2 | Hendra opens music overlay, selects an `uploaded_audio` track, plays | Viewer hears music + Hendra's mic simultaneously; both audible |
| T3 | Hendra pauses | Music silent on viewer; Hendra's mic persists audible |
| T4 | Hendra resumes | Music audible again on viewer; mic persists |
| T5 | Hendra changes track (next) | Audio transitions without crackle; mic persists; no renegotiation observable |
| T6 | Hendra closes overlay | Music silent on viewer; Hendra's mic persists; AudioContext teardown confirmed via DevTools (no live `MediaElementSourceNode`) |
| T7 | Hendra selects a Spotify URL track and taps Play | Overlay opens Spotify in a new tab; viewer hears **mic only**; overlay clearly displays "Playing in Spotify · viewers hear mic only"; in-app play/scrub/volume are DISABLED |
| T8 | Same as T7 for YouTube | Same honest UX; viewer hears mic only |
| T9 | Mid-track network blip (temporarily disable Wi-Fi then re-enable) | Music gracefully pauses or stalls; mic recovers via normal WebRTC behaviour; overlay surfaces an honest state |
| T10 | Hendra ends Live mid-track | All audio stops cleanly; AudioContext closed; no console errors from unclosed sources |
| T11 | Delete the track Hendra is currently playing (from another tab, same account) | Current playback finishes; the track no longer appears in picker on next session; no bucket orphan |
| T12 | Narrow screen (≤ 360 px) | Overlay layout holds; Stop Live button remains tap-reachable; viewer-footer-pill remains visible |

Any test failure blocks §16 Step-5 completion. Failure is reported honestly, not papered over.

### 13.5 Other test matrix (Amendment 5 + original §10.4)

| # | Test | Pass criteria |
|---|---|---|
| U1 | Upload a valid MP3 | Row persists in library; cover default applied if none provided |
| U2 | Upload a `.exe` renamed to `.mp3` | Rejected at signature check with code |
| U3 | Upload without a rights declaration | Rejected with `rights-required` |
| U4 | Upload past per-account byte quota | Rejected with `storage-quota-exceeded` + used/limit numbers |
| U5 | 11th upload in an hour | Rejected with `rate-limited` + retry-after |
| U6 | Concurrent uploads near the cap (parallel browser tabs) | At most the aggregate cap of bytes end up on-disk; no race-condition over-fill |
| U7 | Over-cap cover-image size | Rejected cleanly without affecting a successful audio upload |
| U8 | Spotify URL happy path | Accepted; stored; appears in library |
| U9 | Spotify URL wrong host (`spotify.evil.com`) | Rejected at validator |
| U10 | YouTube URL wrong path (`/channel/<id>`) | Rejected at validator |
| U11 | YouTube ID with 10 or 12 chars | Rejected at validator |
| U12 | Reload persistence | Library + player state survive a page reload for an `uploaded_audio` track |
| U13 | Delete track via soft-delete | Row flagged removed; disappears from library immediately; storage object still present until retention window ends |
| U14 | Explicit "delete now" | Row + storage object both gone within one minute |
| U15 | Cross-account read attempt | Account B cannot read account A's tracks (RLS test) |
| U16 | Open / minimise / re-open / close overlay cycle | State preserved across minimise ↔ open; close releases resources |
| U17 | Error-state copy | Each 4xx / 5xx produces a human-readable, non-code-leaking banner |

---

## 14 · File-by-file implementation sequence

Each row is one atomic unit of work. Owner reviews and may approve/defer per row. No row is executed before the preceding row's review returns a green.

### Step 2 — Library + upload

**S2.1 Doctrine + migration SQL (authored, NOT applied)**

- `docs/doctrine/nex-music-upload-contract-DRAFT-2026-10-29.md` — this file.
- `nex-supabase/migrations/235_nex_music_track.sql` — table + reservation + rate-limit + quota tables + indexes + RLS per §9.1.
- `nex-supabase/migrations/236_nex_music_track_storage_policies.sql` — storage-side policies for whichever adapter is selected in §5.3 **before** this migration is written. If Supabase is selected, the migration authors the bucket + policies as SQL (`storage.buckets` + `storage.policies`). If R2 or another non-Postgres-managed store is selected, migration 236 becomes a no-op or documents that storage is configured out-of-band.

**Migration review scope (Amendment 6)** — before migration apply, the owner's SQL review must explicitly cover:

- **Ownership**: `owner_account_id` not nullable; FK + ON DELETE CASCADE semantics.
- **RLS**: owner-only SELECT; no authenticated INSERT/UPDATE/DELETE; service-role-only writes; anon locked out.
- **Object-path isolation**: bucket keys include the owner account id so a brute-force path guess cannot collide across accounts.
- **Quota accounting**: §2.4 concurrency-safe reservation implementation reviewed.
- **Orphan cleanup**: §13.2 sweep job's row-matching rules reviewed.
- **Deletion retention**: §9.2 30-day soft-delete window + hard-delete rules reviewed.
- **Rollback**: each migration includes a DOWN section (where possible) or a documented rollback procedure. Preserve existing migrations 001-234. Do **not** modify migration 207 or any Vault-domain migration.
- **No pre-existing migration touched**: strict additive-only.

**Review gate**: owner reads SQL + runs this checklist. Approval required before any migration is applied anywhere.

**S2.2 Types + service layer**

- `src/lib/nex-native/types.ts` — add `NexMusicTrackRow`, `NexMusicSourceType`, `NexMusicVisibility`, `NexMusicMimeType`.
- `src/lib/nex-native/music/music-track-service.ts` — CRUD.
- `src/lib/nex-native/music/music-upload-validation.ts` — MIME + signature + size + filename sanitisation.
- `src/lib/nex-native/music/music-url-validators.ts` — Spotify + YouTube URL parsers.
- `src/lib/nex-native/music/music-rate-limit.ts` — DB-backed per-account bucket.
- `src/lib/nex-native/music/music-quota-service.ts` — §2.4 reservation + usage aggregate.
- `src/lib/nex-native/music/storage-adapter/supabase-adapter.ts` — Supabase-specific adapter if selected.
- `src/lib/nex-native/music/storage-adapter/types.ts` — the §5.1 `MusicMediaStorage` interface.
- `src/lib/nex-native/music/storage-adapter/index.ts` — adapter selection by env var.

**S2.3 Server action + API route**

- `src/app/api/nex-native/music/upload/route.ts` — multipart POST, service-role adapter write.
- `src/app/nex-native/create/upload-music/_actions.ts` — `createMusicTrackAction`, `addExternalMusicTrackAction`, `deleteMusicTrackAction`.

**S2.4 Upload journey UI**

- `src/app/nex-native/create/page.tsx` — flip Music card `href` from `null` to `/nex-native/create/upload-music`. Remove `aria-disabled` and the Coming-soon chip ONLY on the Music tile.
- `src/app/nex-native/create/upload-music/page.tsx` — server shell.
- `src/app/nex-native/create/upload-music/_upload-client.tsx` — three-tab UI (Upload MP3 / Spotify URL / YouTube URL) + cover slot + title/artist + rights-declaration radio + submit.
- `src/components/nex-native/music/MusicLibraryList.tsx` — library listing component.
- `src/app/nex-native/music/page.tsx` — library index.

**Review gate**: owner tests upload end-to-end in dev with Hendra. Approval required before S3.

### Step 3 — Player + Live wiring

**S3.1 Player overlay**

- `src/components/nex-native/music/NexMusicPlayerOverlay.tsx` — visual implementation of `music player.png` with reused primitives per §10.2.
- `src/components/nex-native/music/MusicWaveform.tsx` — animated SVG waveform driven by WebAudio `AnalyserNode`.
- `src/components/nex-native/music/MusicPlayerDock.tsx` — minimised chip.

**S3.2 Audio mixer**

- `src/lib/nex-native/music/live-audio-mixer.ts` — §11.1 graph. Exports `createLiveAudioMixer`, `attachMusicElement`, `setMusicGain`, `setMicGain`, `getOutputStream`, `destroy`.

**S3.3 Live-surface integration**

- `src/app/nex-native/live-commerce/enter-broadcast-room/_go-live-client.tsx` — mount `NexMusicPlayerOverlay` conditionally during `state === "live"` and not `showEndedRecap`; add owner-rail Music button; wire overlay-close to mixer teardown.
- `src/lib/nex-native/live-broadcast/broadcast-engine.ts` — expose a `replaceAudioTrack(newTrack)` method that forwards to all `RTCRtpSender`s. Preserve existing contract.

**Review gate**: owner tests two-device playback (§13.4 T1-T12). Approval required before S4.

### Step 4 — Spotify + YouTube

**S4.1 URL entry + persistence** — already landed in S2.4.

**S4.2 Player handling**

- `NexMusicPlayerOverlay.tsx` extension: when `source_type !== 'uploaded_audio'`, render the alternate "Open in …" primary action; disable mix controls; show §11.6 honest status.
- No embed yet. v2 embed requires separate authorisation (Spotify Developer agreement, YouTube IFrame API acknowledgement).

### Step 5 — Verification

Executed per §13.4 + §13.5 matrix. Blocks any commit / push / deploy until green.

### Cross-cutting

- `tsconfig.json`, `package.json`: add `music-metadata` + `file-type` dependencies. Review gate for the lockfile change.
- No change to `.env.local`.
- No change to the sealed `enter-broadcast-room/page.tsx` identity-forwarding (Options C/D) beyond what §10.3 integration requires.

---

## 15 · Open conflicts, risks, provider gates

### Known risks

1. **STUN-only ICE** — pre-existing. Mixed-NAT real-device tests may fail viewer connectivity. Not caused by music work. Does not block S2/S3 code but blocks §13.4 verification across different networks; same-LAN testing recommended first.
2. **Supabase free-tier numbers unverified** — all tier figures in §5.2 came from the owner's own Gate-1 message describing community knowledge; this document has not independently queried the live Supabase pricing page or project dashboard. Verification is a Gate-2 precondition.
3. **No hard dollar cap at any current provider** — see §2.5. Soft ceilings only.
4. **`AudioContext` browser-gesture requirement on Safari** — must initialise inside the user-tap handler for the Music button.
5. **Spotify / YouTube policy** — DO NOT ship embed scaffolding without explicit product/legal sign-off. v1 is link-out only.
6. **Legacy `MediaPlayer`** at `src/components/nex-app/live/` — outside fork boundary. **Not imported**. If owner wants it ported, that is a separate scope.
7. **Pre-existing unrelated TS errors** in `scripts/nex-themes/__tests__/gates.test.ts`, `src/app/api/nex-native/vault/**`, `src/app/nex-generated/tiny-calculator/*.test.tsx` — owner has explicitly deferred these.

### Provider gates (require separate explicit approval)

- Supabase project storage quota verification before S2.1 migration apply.
- Supabase management-API token minting (if used for §2.5 observability) — scope restricted.
- Cloudflare R2 account linkage (if ever selected).
- Any S3-compatible provider onboarding.
- Spotify Developer agreement + API client id (future v2 embed).
- YouTube Data / IFrame Player API acknowledgement (future v2 embed).

### Design acceptance

- `music player.png` is the visual reference. Deviations only when a sealed design-token or primitive forces one (e.g. the sealed `NEX.red` cannot be swapped). Owner must sign off on the first rendered build.

---

## 16 · Authorisation gates (ordered)

1. **Owner approval of this DRAFT doc** — required before any S2 code starts. Not yet approved.
2. **Provider selection + verification** — Supabase free-tier numbers verified against the live pricing page; selected provider satisfies §2.3 observability + §2.4 reservation + §5.1 adapter + §4.4 signed-URL. Required before S2.1 migration SQL is finalised.
3. **Owner approval of migration 235 / 236 SQL** — using the Amendment-6 review checklist. Required before migration is applied to any local or production Supabase project.
4. **Owner approval of S2 upload journey** — tested in dev with Hendra. Required before S3 player wiring.
5. **Owner approval of S3 player + mixer** — tested with §13.4 T1-T12. Required before S4 Spotify / YouTube.
6. **Owner approval of S5 verification report** — required before any commit, push, or deploy.

**Separate gates not covered by this DRAFT** (approving Gate 1 does **not** approve any of the below):

- **NEX-curated music library (Category A)** — schema, licensing posture, operator ingest pipeline, operator-admin surface, deletion / reference-integrity sweep. Requires its own doctrine and its own full gate sequence before any curated clip is acquired or imported.
- **Photo-post + video-post media (Category C)** — storage, delivery, retention, deletion. Requires its own doctrine.
- **Short-clip-per-post feature** (if authorised later for Category C surfaces) — explicit cross-reference to Category A's shared-clip economics required before any UI appears.
- **Provider onboarding** beyond Supabase (R2, S3, etc.) — separate account linkage, credentials, and verification per provider.
- **Spotify Developer agreement + API client id** (v2 embed) — separate legal / product gate.
- **YouTube Data / IFrame Player API acknowledgement** (v2 embed) — separate legal / product gate.

No gate is skipped. Each gate's green remains valid only until the covered scope changes.

---

## 17 · Status at time of writing

- Step 0 (TS repair at `_viewer-client.tsx:949-969`) — **DONE 2026-10-29**. Fragment wrapper added. Dev server returns 200 across probed routes.
- Step 1 v1 (initial DRAFT) — **DONE 2026-10-29**.
- Step 1 v2 (first amendment pass — seven items) — **DONE 2026-10-29**.
- Step 1 v3 (this clarification pass — Media-category scope for Categories A / B / C / D) — **DONE 2026-10-29**.
- Gate 1 — **NOT APPROVED**. Awaiting owner review of this revised DRAFT.
- Step 2 — **NOT STARTED**.
- Step 3 — **NOT STARTED**.
- Step 4 — **NOT STARTED**.
- Step 5 — **NOT STARTED**.

### Preserved context

- Earlier identity-forwarding edits (Options C + D) in `enter-broadcast-room/page.tsx` + `_go-live-client.tsx` remain uncommitted and unchanged.
- The build-health repair in `[sessionId]/_viewer-client.tsx` remains uncommitted and unchanged.
- `.env.local` unchanged since `NEX_DEV_IMPERSONATE_HANDLE=nex-50014`.
- No migrations applied. No DB rows changed. No bucket writes. No commits. No pushes. No deploys.
- No application code was changed in this amendment pass.
- Pre-existing unrelated TS errors remain preserved per the owner's deferral.
