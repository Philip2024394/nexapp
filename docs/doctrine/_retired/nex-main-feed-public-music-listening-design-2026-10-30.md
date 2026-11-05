# NEX Main Feed · Public Music Listening Primitive · Design 2026-10-30

**Status:** DRAFT · design for owner review · **NO IMPLEMENTATION AUTHORISED.**

Scope: operationalise owner decision **D1** from `nex-main-feed-constitution-decisions-2026-10-30.md` ("Approve the design of a secure public-listening model, but keep implementation gated until reviewed"). This document describes **what** a public-listening primitive would do and **how** it would preserve the existing security envelope. It does **not** author code, draft migrations, or alter any storage configuration. Dependencies on the unresolved storage-provider decision (D2 · Migration 235 unapplied) are called out explicitly.

Cross-references:
- Constitution + decisions: `nex-main-feed-constitution-decisions-2026-10-30.md`.
- Slot primitive design: `nex-main-feed-slot-primitive-design-2026-10-30.md`.
- Music Upload Contract DRAFT v3 (2026-10-29): `nex-music-upload-contract-DRAFT-2026-10-29.md`.
- Live Eligibility Contract: `nex-live-eligibility-contract-2026-10-27.md`.
- Vault Entitlements LOCKED (2026-10-20): `project_nex_vault_entitlements_locked_2026_10_20`.

---

## 1 · Problem statement (verified from code)

Four enforcement layers today prevent `viewer != owner` from obtaining a playable signed URL for a `nex_music_track`. All four are **by design** and reflect prior sealed doctrine ("private library by default", Music Upload Contract D6). All four would need coordinated relaxation to enable Main Feed music playback.

| Layer | Evidence | Current rule |
|---|---|---|
| Storage adapter contract | `src/lib/nex-native/storage-adapter/types.ts:26-30` | `SignedReadUrlArgs.ownerAccountId: string` is non-optional. Every call site binds signing to the owner identity. |
| Dev stream API route | `src/app/api/nex-native/music/stream/*/route.ts:40-43` | `if (!session \|\| session.account.id !== owner) return 403`. HMAC payload includes `owner` so a signature cannot be re-used by a different session. Headers set `Cache-Control: private, no-store`. |
| Server action | `src/app/nex-native/create/upload-music/_actions.ts:201-207` | `getMusicPlayUrlAction` rejects `track.owner_account_id !== session.account.id` with `forbidden`. |
| Preview page server component | `src/app/nex-native/create/upload-music/preview/[trackId]/page.tsx:41-43` | `notFound()` when `track.owner_account_id !== session.account.id`. The surface itself is owner-only. |

The track visibility enum (`src/lib/nex-native/music/types.ts:14`) is `'private' \| 'shared_live' \| 'removed'`. There is **no** durable public state. `shared_live` is transient during a broadcast and does not grant playback outside the Live viewer context.

Any Main Feed music cell requires either (a) relaxing the owner binding in a controlled way, or (b) replacing it with a different proof model that preserves the security envelope.

---

## 2 · Design goals

Operationalised directly from Rules 7, 8, 9 of the Main Feed Constitution and the Music Upload Contract D6/D8/D9:

- **G1 · Owner retains control.** Only tracks the owner has explicitly promoted to a public state are reachable publicly. No implicit upgrade.
- **G2 · No stolen URLs.** A signed URL for public listening must be short-lived, unforgeable, and not interchangeable with the owner-scoped URL used in the preview page.
- **G3 · Media isolation.** The public URL for the audio file does not leak storage internals, does not reveal the owner's account id in a URL-visible way, and cannot be used to enumerate other tracks.
- **G4 · Revocable.** Owner-initiated unpublish, delete, rights-revoke, or takedown must stop public playback within a bounded time window.
- **G5 · Rights discipline preserved.** The existing `rights_declaration` check at publish must gate transition into public state. Public playback should not expose a track whose rights declaration is incompatible with public distribution.
- **G6 · Does not change the owner-scoped path.** The existing owner-scoped signing path (preview page, author workflow) remains intact. Public listening is an **additional** path, not a replacement.
- **G7 · Compatible with the Supabase music-bucket phase hold.** The design must survive both the current dev-FS adapter and a future Supabase (or other) provider without a second redesign.

---

## 3 · Proposed primitive

### 3.1 · Public visibility state (not yet schema)

A new value in the `nex_music_track.visibility` enum, provisionally named `public`, with the following semantics:

- Entering `public` requires the sealed `rights_declaration` check from the Music Upload Contract (D9) and passes a new rights-vs-visibility compatibility gate (see §4.2).
- Leaving `public` is possible via `unpublish → private`, `remove → removed`, or `rights_revoke → restricted` (new value also provisional; see §4.3).
- `shared_live` is unchanged. It remains transient during an active broadcast and does **not** imply `public`.
- The enum is otherwise ordered as: `private · public · shared_live · restricted · removed` with transitions defined in §4.

**This section proposes shape, not SQL.** Migration 235 remains unapplied; it would need to be revised **before** a schema change is approved. See §7.

### 3.2 · Public-listening authorisation primitive

A new service-boundary function, provisionally named `resolvePublicMusicPlayUrl`, with the following contract:

```
resolvePublicMusicPlayUrl({
  trackId: string,
  viewerAccountId: string | null, // null = anonymous viewer
}): Promise<
  | { ok: true; playUrl: string; expiresAtMs: number }
  | { ok: false; reason: "not-public" | "rights-restricted"
       | "unavailable" | "rate-limited" }
>
```

Preconditions enforced server-side:

1. `track.visibility === "public"` **AND** `track.removed_at === null`.
2. `track.rights_declaration ∈ { "owner_content", "public_domain", "licensed" }` **AND** passes the compatibility gate in §4.2.
3. The viewer has not exceeded a documented per-viewer rate limit (see §5.3).
4. The track has not been flagged as `restricted` (see §4.3).

Return shape intentionally does **not** include `ownerAccountId`. The signed URL encodes `(reference, publicProof, expiresAtMs)` instead of `(reference, owner, expiresAtMs)` — see §3.3.

### 3.3 · Storage adapter extension (contract-level, not code)

The storage adapter currently has:

```
getSignedReadUrl({
  reference, ownerAccountId, expiresInSeconds
})
```

Proposal: add a **sibling** method, not a replacement:

```
getPublicSignedReadUrl({
  reference,
  publicProof: string,  // HMAC of (reference, "public", expiresAtMs)
                        // using a separate signing key
  expiresInSeconds: number,
})
```

Properties:
- **Separate signing key.** The public key is distinct from the owner-scoped key so a leak of one does not forge the other.
- **No owner identity in the signature.** The signed URL carries `"public"` as the identity-slot of the payload.
- **Dedicated verification path.** `verifyPublicSignedReadUrl(url)` is a new verifier that only accepts the `"public"` identity-slot and the public key.
- **Dev-FS adapter mirrors the production adapter.** Both must implement the sibling method identically so dev-time behaviour matches prod.
- **The existing `getSignedReadUrl` is untouched.** All current call sites continue to work with no change.

### 3.4 · Public stream route (contract-level, not code)

A new HTTP route at `/api/nex-native/music/public-stream/{trackId}` (name provisional) with the following contract:

- Reads the track row, enforces §3.2 preconditions.
- Returns a `getPublicSignedReadUrl` URL with `Cache-Control: public, max-age=<expiresInSeconds>, immutable` on the signed URL response **only** if the storage provider CDN safely accepts public cache.
- The route itself returns `Cache-Control: no-store` on the signing endpoint (so a new signature is minted each session).
- Does **not** require authentication. Anonymous viewers can play public music. (See §5 for abuse controls.)
- Does **not** accept the owner-scoped signature even if presented. Signature verification is isolated.

### 3.5 · What the owner-scoped path still does

Unchanged:
- `getSignedReadUrl({..., ownerAccountId})` continues to serve preview + author workflows.
- The dev stream route (`/api/nex-native/music/stream/...`) continues to require `viewer == owner`.
- `getMusicPlayUrlAction` continues to refuse non-owner viewers.
- The preview page continues to `notFound()` for non-owner viewers.

**Public listening does not grant the viewer any additional authority on the owner's workspace.** It only yields a playable audio URL for the one specific track in a public state.

### 3.6 · Playback URL resolution step

A viewer requests playback for a track. The server must decide, deterministically, which path to serve. This section pins the decision so the two paths cannot be confused and so public playback can never bypass the owner/private boundary.

#### 3.6.1 · Resolution matrix

Given:
- `track.visibility ∈ { 'private', 'shared_live', 'public', 'restricted', 'removed' }` (see §4.3 for `restricted` state; see §4.1 for the `public` state introduced by this design).
- `viewer` = the resolved session account (or `null` for anonymous).

| viewer vs track | `visibility` state | Resolution |
|---|---|---|
| `viewer.id === track.owner_account_id` | `private` | Owner-scoped URL · preview / author workflow only. **Public URL path MUST refuse this request.** |
| `viewer.id === track.owner_account_id` | `public` | Owner-scoped URL. The owner viewing their own public track uses the author path, not the public path. **No public URL is minted for this viewer.** |
| `viewer.id === track.owner_account_id` | `shared_live` | Owner-scoped URL (within an active broadcast context per Music Upload Contract). |
| `viewer.id === track.owner_account_id` | `restricted` | Owner-scoped URL for the owner-side management view (D10 pending). Public URL path refuses. |
| `viewer.id === track.owner_account_id` | `removed` | 404 / `notFound()`. Owner-side `/manage/content` may show the tombstone separately. |
| `viewer.id !== track.owner_account_id` (incl. anonymous) | `private` | **Deny.** No URL minted on any path. |
| `viewer.id !== track.owner_account_id` | `shared_live` | Deny unless inside an authorised live-viewer context (governed by the Live doctrine, not this design). |
| `viewer.id !== track.owner_account_id` | `public` | **Public URL** via `resolvePublicMusicPlayUrl` (§3.2). Owner-scoped path refuses. |
| `viewer.id !== track.owner_account_id` | `restricted` | Deny. No URL minted on any path. |
| `viewer.id !== track.owner_account_id` | `removed` | 404. |

#### 3.6.2 · Load-bearing invariants

- **No path crosses the boundary.** The owner-scoped signing path and the public-listening signing path are enforced server-side using **separate signing keys** (see §3.3). A viewer who should receive the public path cannot be served the owner-scoped URL, and a viewer who should receive the owner-scoped path cannot be served the public URL. The resolution step in §3.6.1 is enforced at the service boundary.
- **The owner viewing their own public track does NOT receive the public URL.** This is a deliberate choice: the owner's authority flows through the author/preview path with its own guarantees (private cache, author-only edit actions). Minting a public URL for the owner would weaken the audit story ("who played this public URL?") by mixing owner playback with anonymous playback. The owner's playback is attributed on the owner-scoped path.
- **Anonymous viewer never receives an owner-scoped URL.** Enforced by the owner-scoped verifier rejecting the "public" identity-slot and vice versa (§3.3, §5.2).
- **The resolution step runs server-side only.** No client-side logic may select between the two paths based on claimed identity. The server reads session + track state and returns at most one URL (or a deny).
- **Public URLs do not grant authority to call any owner-scoped action.** They only grant playback. All owner-scoped actions (update metadata, change visibility, delete) continue to require the owner-scoped session.

#### 3.6.3 · Edge: viewer identity changes mid-session

If a viewer upgrades from anonymous to signed-in during a session (or vice versa), the next playback request re-runs §3.6.1 and may receive a different URL for the same track. Previously-issued URLs continue to work until their expiry on their own signing path. There is no attempt to "upgrade" a public URL to an owner-scoped one on identity change.

#### 3.6.4 · Edge: owner viewing another creator's public content

Standard non-owner case. Owner's authority on their own tracks does not transfer. They receive the public URL for someone else's public track, same as any non-owner.

---

## 4 · Lifecycle rules (public visibility)

### 4.1 · Transition table

Shape only. Not SQL. Not an enum constraint check. Reviewed before any schema is drafted.

| From | To | Trigger | Observable effect |
|---|---|---|---|
| `private` | `public` | Owner "Publish" with rights check passing | Track becomes feed-eligible; new signed URLs can be issued. |
| `public` | `private` | Owner "Unpublish" | Public URL issuance stops. Existing short-lived signed URLs continue to work until expiry (see §5.1). |
| `public` | `removed` | Owner "Delete" | Issuance stops. Row marked `removed_at = now()`. Media retention follows the Music Upload Contract D8. |
| `public` | `restricted` | NEX takedown or rights-revoke event | Issuance stops immediately. Row visible to owner only. Existing signatures invalidated (see §5.1). |
| `restricted` | `private` | NEX takedown lifted + owner action | Owner re-enters private draft. Does not auto-publish. |
| `shared_live` | `public` | NOT ALLOWED | Must transition `shared_live → private → public`. Prevents a transient Live-only state from accidentally sealing public. |
| `shared_live` | anything | Live session ends | Follows the existing Music Upload Contract. Not affected by this design. |

### 4.2 · Rights-vs-visibility compatibility gate

New precondition at the `→ public` transition. Rights declaration enum values from `rights_declaration` (sealed in the Music Upload Contract):

| `rights_declaration` | Allowed to enter `public` |
|---|---|
| `owner_content` | Yes |
| `public_domain` | Yes |
| `licensed` | **Pending owner decision** — needs an explicit sub-rule on which licence terms are compatible with NEX public distribution. Do not auto-approve. |
| Any other / unknown | No |

The `licensed` case is a **pending clarification**. This design does not resolve it. A separate owner decision is required.

### 4.3 · Restricted state

New provisional enum value `restricted` separates "owner-paused" (private) from "rights-blocked" (restricted). Important because:
- A `restricted` track must not be auto-promoted to the active Main Feed slot even if slot auto-promotion rules change later.
- A `restricted` track must not appear in the creator's public library.
- Owner retains visibility into their own `restricted` tracks via the owner-side `/manage/content` surface (D10 scope-pending).

If the owner prefers to keep the enum smaller, an alternative is a separate boolean `rights_restricted` column alongside the enum. Choice is deferred.

---

## 5 · Security + abuse prevention

### 5.1 · URL expiry + revocation window

#### 5.1.1 · Owner-proposed invalidation policy (pending confirmation — CD D1e)

Owner directive 2026-10-30 **proposes immediate invalidation** of previously-issued public URLs when a track transitions out of the `public` state via any of:

- `unpublish` (owner-initiated → `private`)
- `delete` (owner-initiated → `removed`)
- `restrict` (owner-initiated → `restricted`)
- `rights_revoke` (NEX takedown or rights-revoke event → `restricted`)

This policy is recorded in CD §5 as owner decision **D1e** with class **"Owner-proposed policy, confirmation required."** This design does **not** treat the proposal as doctrine until explicit confirmation. This design does **not** authorise implementation of any specific invalidation mechanism; it describes the mechanism alternatives below so the owner can confirm the policy and separately authorise a mechanism.

**What the design can achieve now, vs. what it cannot:**

- **Can:** bound the public URL exposure window via **short-lived signatures** (60 s default; see §5.1.3). A URL minted at time T stops verifying at T + 60 s regardless of any subsequent state change.
- **Cannot (without additional infrastructure):** guarantee that a URL minted at time T stops verifying before T + 60 s on an owner action that fires at any time within the signature's valid window. "Immediate invalidation" is only achievable by one of the three mechanisms in §5.1.2, each with its own propagation story and infrastructure cost.

**The design must not describe short-lived expiry as "immediate invalidation."** A 60 s expiry is a bounded exposure window of up to 60 s, not immediacy. This is called out explicitly here because the owner's proposed policy (immediate) differs from what short-lived expiry alone delivers.

#### 5.1.2 · Mechanism alternatives for owner review (none authorised)

Three mechanisms could implement the owner-proposed immediate invalidation. Each has distinct infrastructure, operational, and failure-mode properties. **No mechanism is authorised by this document.** Owner review required before any build.

- **Mechanism A · Signing-key rotation.** Rotate the public signing key on each invalidation event. The verifier accepts only signatures bound to the currently-active key (see §5.2 revised). Old signatures fail verification immediately after the key store rotates.
  - **Pros:** cheap at verification time (verifier only looks up one active key). Clean story.
  - **Cons:** rotates the key for **all** public tracks on every single invalidation. Blast radius: one creator's takedown invalidates every in-flight URL across the whole platform. Operationally disruptive for a mature feed.
  - **Propagation:** depends on how key material is distributed (single-region store, multi-region replica, CDN edge, etc.). "Immediate" at the central store is NOT "immediate" at the edge. Propagation SLA must be defined before claiming immediacy.
  - **Unresolved operational dependencies:** key storage, rotation trigger wiring, propagation SLA, failover during rotation. These are engineering requirements, not owner decisions. See CD §5.1.
- **Mechanism B · Per-track signing-key / salt.** Each track has its own signing key or salt included in the HMAC payload. Invalidation rotates **only that track's** key or salt. Verification looks up the per-track key during signature validation.
  - **Pros:** blast radius is one track. Operationally quieter. Supports granular revocation (unpublish a single track without affecting others).
  - **Cons:** verifier must perform an extra key lookup per signature verification (small cost; practical with caching). Keys must be stored per track with low-latency access.
  - **Propagation:** depends on key-cache invalidation. Multi-region deployments require careful cache-busting.
- **Mechanism C · Revocation deny-list at the stream route.** Signatures remain valid cryptographically, but the stream route checks a per-track deny-list on every request and refuses if the track is listed. Deny-list is populated on invalidation events; entries age out after the longest possible signature expiry.
  - **Pros:** no key material to rotate. Simple to reason about.
  - **Cons:** requires a low-latency deny-list store (Redis-like or Postgres with aggressive index). Adds a read per playback request. Must handle deny-list unavailability (fail-closed = deny playback; fail-open = security hole).
  - **Propagation:** deny-list write must propagate to all stream route instances before immediacy can be claimed.

**Hybrid mechanisms** (e.g., per-track key rotation + deny-list for defense-in-depth) are also possible. All require explicit design review and owner authorisation.

#### 5.1.3 · What this design COMMITS to today (independent of mechanism choice)

- **Default expiry:** 60 s per signed URL. Short enough that a leaked URL loses value quickly; long enough to handle buffering + reconnection. This bound applies regardless of which mechanism in §5.1.2 is ultimately chosen.
- **Maximum expiry:** `expiresInSeconds > 300` is forbidden on the public path without a separate owner decision. Caps the worst-case post-revocation exposure window at 5 minutes.
- **No long-lived URLs** on the public path.
- **The design does not assert immediate invalidation** on any revocation path until (a) owner confirms D1e, and (b) a specific mechanism from §5.1.2 is authorised, and (c) its propagation SLA is specified.

#### 5.1.4 · Interim honest statement for public-facing copy

Until D1e is confirmed and a mechanism is authorised, any user-facing copy about "unpublishing stops public playback" must be worded to reflect the bounded expiry window — not the aspirational immediacy — unless a mechanism in §5.1.2 is implemented and its propagation SLA guarantees ≤ some human-perceptible immediate threshold (e.g., ≤ 2 s end-to-end).

### 5.2 · HMAC + key management

#### 5.2.1 · Keys and payload

- Public and owner-scoped signing keys are separate, high-entropy, server-side only.
- Signing uses HMAC-SHA256 over `(reference, "public", expiresAtMs, trackId, keyId)` — including `trackId` prevents URL swapping between tracks; including `keyId` makes the key-version binding explicit (see §5.2.2).
- Both verifiers (`verifyFsSignedReadUrl` and the new `verifyPublicSignedReadUrl`) must perform constant-time comparison and reject signatures with mismatched identity-slot.

#### 5.2.2 · Key-version binding (explicit)

**Load-bearing invariant for any invalidation-via-rotation mechanism** (see §5.1.2 Mechanism A or B):

- Each signature embeds a `keyId` field that names the signing key used to produce it.
- The verifier looks up the key material by `keyId`.
- Rotation introduces a new `keyId` and marks the previous `keyId` as inactive.
- The verifier **refuses** signatures bound to any `keyId` not currently active. Old signatures fail verification immediately after the key store observes the inactive-mark.
- There is no "accept any key that was ever valid" verifier mode. There is no key-ring with multiple active keys for the same identity-slot at the same time (except during a controlled, bounded rotation window — see §5.2.3).
- Per-track key variants (Mechanism B) use `keyId` scoped to the track; rotating one track's `keyId` does not affect any other track's signatures.

#### 5.2.3 · Rotation window + propagation (unresolved)

- Rotation is not instantaneous at the operational level. There is a window during which some verifier instances observe the new active `keyId` and others still observe the previous one.
- The propagation SLA (upper bound on this window) is a required ops parameter before any claim of "immediate" invalidation can be made. **Currently unresolved — flagged as an engineering requirement in CD §5.1.**
- During the window, a signature produced with the old key before rotation may still verify on instances that have not yet observed the inactive-mark. This is why §5.1 does **not** describe rotation alone as "immediate" without a propagation SLA.
- Rotation procedure, key storage topology, and failover behaviour during rotation are ops doctrine (future). Not scoped here.

### 5.3 · Rate limiting

The public stream route is unauthenticated for anonymous viewers. Rate limits must be designed with that in mind.

- **Per-IP rate limit:** proposed 60 signed URL mints per IP per 10-minute window. Return `rate-limited` beyond that.
- **Per-track rate limit:** proposed cap on signed URL mints per track per minute to blunt scrape-and-rehost attempts. Specific numbers deferred to the implementation gate.
- **Per-session rate limit (for authenticated viewers):** optional, lighter cap than per-IP. Preserves the diversity principle (Rule 5).

Rate limits are enforced server-side, not inferred from client state. A client that cannot mint a URL cannot play.

### 5.4 · Scraping and rehosting

- Public URLs expire within 60 s. A scraped URL cannot be reposted as a durable link.
- No URL-visible owner identity. A scraper cannot aggregate `ownerAccountId` by harvesting URLs.
- A `User-Agent` + referrer policy may be considered as a secondary signal, but is **not** a security control. Primary defence is expiry + rate limit.
- Range requests on the signed URL must be supported for seek/scrub. The signing contract must not be invalidated by range request behaviour.
- Audio watermarking is **out of scope** for v1. If introduced later, it is a separate design.

### 5.5 · Data minimisation in the public response

- Response does not include `owner_account_id`.
- Response does not include `created_at` or `updated_at` with sub-day precision.
- Response does **not** include storage internals: no bucket name, no object key, no path.
- Returned fields are strictly: `id`, `title`, `artist`, `cover_image_url` (also a public signed URL), `background_image_url` (also a public signed URL), `duration_ms`, `rights_declaration`, `view_count`, `like_count`, `share_count`.
- `view_count` increment logic for public plays is a separate decision; see §5.6.

### 5.6 · View counting under public playback

Preserving Rule 10 ("value, not volume"): public playback should increment `view_count` under a **deduplication rule** (per IP + 10-minute window at minimum). Volume-based incrementing is explicitly forbidden by Rule 10. Exact rule is deferred to a separate design.

### 5.7 · Audit, GDPR, takedown, and log retention

#### 5.7.1 · Rights-revocation audit record (required)

Every rights-revocation event — whether owner-initiated restriction, NEX takedown, or external rights-holder complaint — **must** emit a durable audit record. This is a doctrine requirement independent of the chosen invalidation mechanism (§5.1.2).

Required fields:

- `event_id` — unique id for the audit event.
- `event_timestamp` — UTC when the event was committed.
- `trigger` — one of: `owner_unpublish`, `owner_delete`, `owner_restrict`, `nex_takedown`, `rights_holder_complaint`, `legal_order`. Trigger values may be extended by owner decision.
- `actor_id` — the account id that initiated (null for `rights_holder_complaint` and `legal_order` where no NEX account acted directly).
- `actor_role` — one of: `owner`, `nex_ops`, `nex_legal`, `system` (for automated enforcement). Used by access controls.
- `content_primitive_type` — `music_track` / `uploaded_video` / `product_video`.
- `content_primitive_id` — the id of the affected row.
- `creator_account_id` — the content primitive's owner (for cross-reference, not viewer attribution).
- `prior_state` — the content primitive's state before the event (e.g., `public`, `shared_live`).
- `new_state` — the content primitive's state after (e.g., `restricted`, `removed`).
- `slot_cleared` — boolean. True if an active slot was cleared as a direct effect of this event. The slot primitive emits a separate `slot.clear` event (see SP §9) referencing this `event_id`.
- `slot_was_active` — boolean. True if the primitive was the active slot entry at the time of the event. False means the primitive was `demoted` historical state and no slot write occurred (see SP §6.4.1).
- `reason_code` — short enum (e.g., `copyright`, `tos_violation`, `owner_request`, `legal_order`).
- `reason_reference` — optional free-text reference (DMCA ticket, legal order id, internal case id). Must not include PII beyond what the legal process requires.
- `invalidation_mechanism_applied` — one of `expiry_only` (no mechanism beyond §5.1.3 bounded expiry), `key_rotation`, `per_track_key_rotation`, `deny_list`, `pending` (if the mechanism is scheduled but has not yet propagated). Captures what actually happened, not the aspiration.
- `invalidation_propagation_observed_at` — timestamp when the chosen mechanism's propagation completed, if applicable (nullable).

#### 5.7.2 · Access controls

- Audit records are visible to **NEX ops** (full) and **NEX legal** (full).
- The affected **creator** can see audit records against their own content primitives, with `reason_reference` sanitised to a short reason summary. Legal references and internal case ids are not surfaced to creators by default.
- Audit records are **not** surfaced to anonymous viewers, feed viewers, or any public API.
- Export of audit records (CSV, backup, data-portability request) follows a separate access-controlled flow; not scoped here.

#### 5.7.3 · Data minimisation and GDPR

- Logs of public stream mints must be minimised. If retained, they must not expose anonymous viewer identities beyond what is strictly required for abuse detection.
- Audit records (§5.7.1) do **not** retain viewer identity for the public playback of a restricted item. Viewer-side playback logs retain less than audit records; audit records capture the enforcement action, not consumption.
- Takedown must purge the content primitive's media files (per the content-primitive retention doctrine, e.g., Music Upload Contract D8), the slot primitive row's `item_ref` continues to point at the tombstoned/restricted primitive (SP §6.2), and audit records are retained independently of media purge.
- Audit record retention is a separate ops parameter (minimum proposed: 7 years for `nex_takedown` / `legal_order` events; shorter for owner-initiated events, TBD). **Owner decision deferred** — flagged as engineering/legal requirement in CD §5.1.

#### 5.7.4 · Audit on demoted historical rows (per SP §6.4.1)

When a rights-revocation fires on a content primitive that is currently in `demoted` slot state (not the active slot entry):

- The audit record is still emitted with `slot_was_active = false` and `slot_cleared = false`.
- The slot primitive does not perform a slot write (there is no active slot to clear).
- The content primitive still transitions to `restricted`.
- The reader filter (SP §6.1.1 and SP §7.5) excludes the restricted primitive from any public query.

The audit record is the sole system-of-record for "a takedown happened against this demoted content." Without it, there would be no durable trace of enforcement actions against historical content.

---

## 6 · Compatibility with other sealed doctrine

| Sealed doctrine | Interaction |
|---|---|
| Vault LOCKED (2026-10-20) | **No interaction.** Vault is a separate storage domain for the owner's private content. Public music does not use Vault. |
| Live R9 Eligibility Contract (2026-10-27) | Public broadcasting of Live sessions is a Shop membership feature. Public music **playback** on the Main Feed is a different capability. Whether entering `public` music state should also require Shop membership is a **pending owner decision** — not resolved by this design. |
| Music Upload Contract DRAFT v3 (2026-10-29) | §2 (Media-category scope) is honoured. Public listening is a new mode of (B) user-uploaded music. §2's load-bearing rule ("a central curated library reduces duplication but does not eliminate storage, request or bandwidth costs") applies — public playback likely increases bandwidth and must be modelled in the resource-economics plan before build. |
| MAX_VIEWERS = 10 (sealed) | Not affected. The viewer cap applies to live WebRTC fan-out, not to recorded media playback. |
| Live Uploaded Video Contract (2026-10-24) | Pattern-compatible. Recorded video already supports public playback via `visibility='public'`. Public music follows the same pattern. |
| Migrations 229 / 233 (authored, not applied) | Not affected. |

---

## 7 · Dependencies and blockers

### 7.1 · D2 · Music storage provider decision

- The current music adapter is dev-FS only (`src/lib/nex-native/storage-adapter/index.ts:14-16`).
- Migration 235 remains **AUTHORED but NOT APPLIED**.
- A production public-listening path requires both the chosen storage provider AND the chosen CDN/caching strategy.
- Public playback bandwidth cost **must** be sized against the chosen provider before build. The dev-FS adapter is unsuitable for production public playback.

### 7.2 · Migration 235 revision

The current Migration 235 draft does not include a `public` visibility value or a `restricted` state. Enabling this design requires:

- Revising Migration 235 to include the new enum values (or using a follow-on migration), including the ordering rule and transition constraints at the DB level (CHECK constraints or an application-level invariant).
- **This revision is explicitly NOT done by this document.** Owner decision + schema review required.

### 7.3 · Public signing key provisioning

- The new signing key must exist before any public stream route operates.
- Key provisioning + rotation procedures are ops doctrine (future).
- No key is being generated by this document.

### 7.4 · Rate-limit infrastructure

- Per-IP rate limiting at the public stream route requires either (a) a shared rate-limit store (e.g., Postgres with a time-window index, or Redis) or (b) an edge-layer rate-limit configured in the deploy platform.
- Choice is deferred to the implementation gate. Design must survive either choice.

### 7.5 · Observability

- Minted-URL rate per track, per IP, per account, over time windows.
- Takedown effectiveness (time from `restricted` transition to last successful public playback).
- Error rate on `verifyPublicSignedReadUrl`.
- These metrics are **not** engagement scores and must be stripped of per-viewer identity.

### 7.6 · Interaction with D1 "licensed rights" sub-case

Open: whether a track with `rights_declaration='licensed'` should automatically be allowed to enter `public`, or require a secondary attestation. Deferred.

---

## 8 · Test strategy (for the eventual build gate)

### 8.1 · Unit — authorisation

- `resolvePublicMusicPlayUrl` returns `not-public` for `private`, `shared_live`, `removed`, `restricted`.
- Returns `rights-restricted` for incompatible rights declarations.
- Returns `rate-limited` beyond per-IP / per-track thresholds.
- Returns `ok` only when all preconditions pass.

### 8.2 · Unit — signing + verification

- Public signature does **not** verify under the owner-scoped verifier.
- Owner-scoped signature does **not** verify under the public verifier.
- Signature is `trackId`-bound: swapping `trackId` in the URL invalidates the signature.
- Expiry is enforced strictly on the server. Clock-skew tolerance ≤ 2 s.

### 8.3 · Integration — route behaviour

- Anonymous viewer can fetch a public track's play URL for a `public` track.
- Anonymous viewer cannot fetch for a `private`, `shared_live`, `removed`, or `restricted` track.
- Authenticated non-owner viewer gets same result as anonymous for all states.
- Owner viewer continues to use the owner-scoped path and receives an owner-scoped URL (not the public one). Owner-scoped URLs do not appear on the public feed.

### 8.4 · Integration — lifecycle

- Transition `private → public` is observable within one request. Minted URL expires at or before contract limit.
- Transition `public → private` stops **new** mints. Existing short-lived URLs continue until expiry.
- Transition `public → restricted` rotates the public signing key (or equivalent) and invalidates all prior URLs.
- Transition `public → removed` behaves as `public → restricted` for the public listener; owner-side the row is marked removed.

### 8.5 · Property / fuzz

- Random URL perturbation never yields a valid signature.
- Malformed `expiresAtMs` is rejected.
- `trackId` not matching the track in URL is rejected.
- Verifier is constant-time (statistical test, not a precise bound).

### 8.6 · Load / abuse

- Per-IP + per-track rate limits enforced under sustained concurrent requests.
- Scraper simulation: 1,000 synthetic requests mint ≤ 60 valid URLs under the stated per-IP cap.
- Takedown fast-path propagates within a bounded time (TBD · ops decision).

### 8.7 · Not in test scope for v1

- Audio watermarking.
- DRM / HLS encryption. (If future HLS pipeline arrives — referenced in `nex-live-video-streaming-roadmap-2026-10-27.md` — a separate security review covers it.)

---

## 9 · Open questions requiring owner decision before build

All owner-decision items raised by this document are mirrored in the authoritative pending-clarifications table in **CD §5**. Rows below cross-reference the CD ids.

1. **D1a** · `licensed` rights sub-rule — which licence terms are automatically compatible with NEX public distribution; which require a secondary attestation.
2. **D1b** · Shop-membership gate on entering music `public` state — parallel to Live R9, or available at all tiers.
3. **D1c** · View-count rule under public playback — the exact deduplication window and attribution strategy consistent with Rule 10.
4. **D1d** · Does `public` require a separate confirmation UX ("Publish publicly") distinct from "Save to library"? Honest consent for a public act.
5. **D1e** · Public URL invalidation policy on unpublish, delete, restrict, rights-revoke — owner **proposes immediate invalidation**; confirmation required; implementation of any specific mechanism (§5.1.2) remains unauthorised.
6. **D2** · Storage provider decision — still blocking.

**Engineering requirements** that are the architect's responsibility to specify (not owner decisions, listed in CD §5.1):

- Rate-limit numeric parameters (per-IP, per-track, per-account caps).
- Key-rotation propagation SLA.
- Public signing key provisioning and rotation ops procedure.
- Audit record retention windows for non-legal events.

These must be addressed before an implementation gate opens.

---

## 10 · Explicit non-actions

- **No application code changed.**
- **No migration drafted or applied.** Migration 235 remains unapplied. No Migration 236 proposed by this document.
- **No storage adapter code modified.**
- **No signing key generated.**
- **No configuration or environment variable changed.**
- **No commit, no push, no deploy.**
- **No existing sealed hold overridden.**

This document is a design proposal for owner review. It carries no implementation authority. A separate explicit "approve public music listening build phase" instruction is required before any code or migration work begins.
