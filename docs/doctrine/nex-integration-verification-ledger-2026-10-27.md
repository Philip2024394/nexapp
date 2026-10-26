# NEX · Integration Verification Ledger

> **Status · FOUNDER REVIEW · 2026-10-27 · live register, append-only**
>
> Records what has been **actually verified** per NEX product area,
> at what level, with pointers to the evidence (tests, Supabase
> probes, commit hashes). Companion to `nex-supabase-gap-ledger-
> 2026-10-27.md` which records what is **missing / unapplied**.
>
> Status labels follow the sealed grid (not interchangeable):
> **IMPLEMENTED** · **LOCALLY VERIFIED** · **VERIFIED-SUPABASE-RO**
> · **BROWSER-TESTED** · **PRODUCTION-DEPLOYED**.
>
> No claim here promotes a feature past the level it was verified at.

## 1 · Chat

### 1.1 · Verified pieces (2026-10-27)

| Piece | Status | Evidence |
|---|---|---|
| UI compose + send | **IMPLEMENTED** | `src/app/nex-native/chat/peer/[accountId]/page.tsx` + `_composer.tsx` form posts to `sendPeerMessageOrShareProductAction`. |
| Server action | **LOCALLY VERIFIED** | `_actions.ts:702 sendPeerMessageAction` resolves session, enforces self-chat guard, calls `getOrCreatePeerConversationAsSender` with `recipient_contacts_only` fail-closed, then `peerMessageService.sendPeerMessage`. Idempotent via `send_intent_id`. |
| Service layer | **LOCALLY VERIFIED** | `src/lib/nex-native/peer-message-service.ts :: sendPeerMessage` validates body + attachments, confirms participant membership, handles reply-target consistency, inserts into `nex_peer_message`. Unique-violation path returns the existing row (sealed Bridge 99 idempotency). |
| Realtime arrival signal | **IMPLEMENTED** | `emitMessageArrival` fire-and-forget after insert. |
| Push notification fan-out | **IMPLEMENTED** | `dispatchPushNotification` fire-and-forget; respects Vault boundary + saved category prefs per sealed 2026-10-15 doctrine. |
| **DB schema (Supabase)** | **VERIFIED-SUPABASE-RO** | `nex_peer_message` 28 cols incl. `send_intent_id`, `encrypted`, `ciphertext`, `nonce`, `delivered_at`, `read_at`, `message_group_id`, `attachment_url/type/meta`, `reactions`, `link_*`. RLS policies: INSERT + SELECT + UPDATE (read). `nex_peer_conversation` 6 cols incl. `participant_a_id`, `participant_b_id`, `last_message_at`, `origin_cover_business_id`. RLS policies: INSERT + SELECT + UPDATE. |
| Existing coverage | **LOCALLY VERIFIED** | `src/app/nex-native/__tests__/send-cart-order-slice-0.test.ts` · **39/39 PASS** exercising the full send-chain through `sendPeerMessage`. |

### 1.2 · Chat receive side · verified (2026-10-27)

| Piece | Status | Evidence |
|---|---|---|
| Server-side arrival nudge | **LOCALLY VERIFIED** | `src/lib/nex-native/realtime/message-arrival.ts` fire-and-forget Supabase Realtime HTTP broadcast on `nex:messages:{conversationId}` channel, event `arrival`. Doctrine: nudge-not-message, payload never exposes plaintext/ciphertext. |
| Client-side subscription | **LOCALLY VERIFIED** | `src/app/nex-native/chat/peer/[accountId]/_message-events-client.tsx` subscribes to `nex:messages:{conversationId}`. On `arrival` → `router.refresh()` → SSR re-render → Bridge 76 MutationObserver decryptor swaps ciphertext for plaintext. |
| Reconciliation | **LOCALLY VERIFIED** | Triggers on mount · visibilitychange visible · realtime (re)subscribe. No setInterval polling. |
| R1 arrival contract | **LOCALLY VERIFIED** | `src/lib/nex-native/__tests__/r1-live-messaging.test.ts` · **29/29 PASS**. |

### 1.3 · Chat gaps and unverified items

- **No service-level unit test** for `sendPeerMessage` directly. Covered indirectly by the cart-order integration test. Dedicated test would increase regression safety but is additive, not corrective.
- **Attachment storage** not inspected. `attachment_url` is accepted but the storage bucket + signed-URL path were not read-only verified.
- **Push notification dispatch** success is not browser-verified. Fire-and-forget design means a dispatch failure cannot flip a successful send.
- **E2E browser test** not run. No message sent through a real browser against the live Supabase in this session.
- **Pre-conversation claim (B1)** remains UNRESOLVED per `nex-complete-messaging-gap-analysis-and-build-roadmap-2026-10-14.md` — provisional user's conversation is not transferred to the claimed account on signup.
- **Missing world-class features** (edit, forward, in-conversation search, mute/archive/pin, group text chat, shared-media gallery, disappearing messages) remain unbuilt. **These are new features, not integration gaps.**

### 1.3 · Chat conclusion

The repository-level Chat send chain is **wired end-to-end against existing live Supabase tables** and backed by passing tests. Chat is the healthiest area probed this session. **No Chat migration gap blocks the send→receive chain.**

## 2 · Directory

### 2.1 · Verified pieces (2026-10-27)

| Piece | Status | Evidence |
|---|---|---|
| UI landing page | **IMPLEMENTED** | `src/app/nex-native/directory/landing/page.tsx` calls `getLandingFeed({…})`. |
| Service orchestration | **LOCALLY VERIFIED** | `src/lib/nex-native/directory/landing-feed-service.ts :: getLandingFeed` merges FOUR parallel sources, deterministically shuffles with mulberry+seed PRNG, honest-empty when no eligible rows. |
| `nex_business` (Shop pool) | **VERIFIED-SUPABASE-RO** | 170 rows live. 70 columns. Read via Supabase service role. |
| `nex.business_canonical` (harvester pool) | **VERIFIED-SUPABASE-RO** | **87,013 rows** live in Supabase. |
| Fail-open paid-listing adapters | **LOCALLY VERIFIED** | `eligible-paid-listing-service.ts` wraps the two views in try/catch so missing views short-circuit to `[]` gracefully. |

### 2.2 · Directory gap · critical read-path divergence

**App code reads canonical from `NEX_POSTGRES_URL` (localhost:5433), NOT from Supabase.** This is documented in `local-directory-service.ts:10-15` and `CLAUDE.md §8`:

> `NEX_POSTGRES_URL` currently points at `localhost:5433` (local `nex_dev`). The directory read path uses this env var. Switching nexapp to read from Supabase requires either (a) applying the directory canonical migrations to Supabase and setting `NEX_POSTGRES_URL` to the Supabase pooler, or (b) changing the `@/lib/nex/db` layer to use the Supabase REST client.

Observed effect:
- The 87,013 canonical rows in **Supabase** are NOT touched by the app in production.
- The app only sees canonical if a local `nex_dev` Postgres is running on the user's machine (dev-mode only).
- A production viewer on Vercel sees Directory assembled from `nex_business` (170 rows) + canonical pool `[]` + paid-listing pools `[]` → directory is mostly Shop cards only until this is fixed.

### 2.3 · Directory gap · paid-listing views missing from Supabase

| View | Migration | Status |
|---|---|---|
| `public.watch_listing_directory_v` | 229 | **DOES NOT EXIST** in Supabase |
| `public.nex_live_post_directory_v` | 233 | **DOES NOT EXIST** in Supabase |

The paid-listing readers in `eligible-paid-listing-service.ts` fail-open — Directory degrades gracefully to no paid listings. **Paid individual listings (watches, Live posts) do not appear in the Directory today.**

### 2.4a · Directory detail page (2026-10-27)

| Piece | Status | Evidence |
|---|---|---|
| `/directory/[id]` server component | **IMPLEMENTED** | `src/app/nex-native/directory/[id]/page.tsx` reads `getCanonicalBusinessById(id)` from the sealed `directory-service.ts`. |
| `getCanonicalBusinessById` query | **LOCALLY VERIFIED** | Reads from `nex.business_directory_v` (sealed publication view) + `nex.business_evidence` presence check. UUID-shape guard on bad id → 404. |
| `nex.business_directory_v` live row count | **VERIFIED-SUPABASE-RO** | **40,541 rows** published in Supabase. **40,703 evidence rows** backing. |
| Read-path divergence (SAME as §2.2) | **BLOCKED** | `withClient()` uses `NEX_POSTGRES_URL` (localhost:5433), not Supabase. The 40,541 published rows in Supabase are unreachable from production code until the env-var decision is resolved. |

### 2.4b · Directory conclusion

Repository wiring is correct. The Directory service **assembles exactly what the sealed G3 contract specifies**. The gap is at the **operational / migration layer**:

- Canonical reads need either (a) migration of `NEX_POSTGRES_URL` to Supabase pooler, or (b) a Supabase REST client path · owner decision.
- Paid-listing views need migrations 229 + 233 applied · owner decision gate per `nex-supabase-gap-ledger-2026-10-27.md` §9.

**No code change in this session fixes this.** Both resolutions cross the sealed migration-approval gate. The gaps are recorded here for your decision.

## 3 · Vault

### 3.1 · Verified pieces (2026-10-27)

| Piece | Status | Evidence |
|---|---|---|
| Service layer | **IMPLEMENTED** | `src/lib/nex-native/vault-entry-service.ts` + `vault-file-service.ts` + `vault-persistence-service.ts`. 14 service functions covering list, move, remove, and file read. Participant-asserting writes before any insert. |
| `nex_vault_entry` | **VERIFIED-SUPABASE-RO** | 5 cols: `id`, `account_id`, `entry_kind`, `ref_id`, `moved_at`. RLS own-only INSERT + SELECT + DELETE. |
| `nex_vault_file` | **VERIFIED-SUPABASE-RO** | 19 cols incl. `wrapped_content_key`, `content_nonce`, `encryption_algorithm`, `rotation_generation`, `bucket_path`, `legacy_bytes_path`, `migration_state`. RLS own-only INSERT + SELECT + UPDATE + DELETE. |
| Full Vault family | **VERIFIED-SUPABASE-RO** | 8 tables live: `nex_vault_entry`, `nex_vault_file`, `nex_vault_conversation_envelope`, `nex_vault_key_envelope`, `nex_vault_pin_attempt`, `nex_vault_recovery_attempt`, `nex_vault_setup`, `nex_vault_file_migration_attempt`. |

### 3.2 · Vault conclusion

Vault schema is **complete, RLS-protected per-viewer only, and matches
the sealed service-layer contract**. **No locked policy was changed.** The LOCKED Vault Entitlements Policy (2026-10-20) is untouched by this probe. Vault reads and writes trace end-to-end against existing live tables.

Open items · encryption flows (key-envelope rotation, PIN recovery, cross-tab lock) not functionally exercised in this read-only pass; byte-level file retrieval not verified; storage bucket not inspected.

## 4 · Themes

### 4.1 · Verified pieces (2026-10-27)

| Piece | Status | Evidence |
|---|---|---|
| `nex_chat_theme` | **VERIFIED-SUPABASE-RO** | 18 cols: `id`, `name`, `tagline`, `accent_hex`, `tier`, `category`, `hero_image_url`, `is_active`, `sort_order`, `bubble_rim_hex`, `composer_rim_hex`, `wallpaper_config`, `layout_style`, `intro_video_url`, `intro_duration_ms`, `intro_poster_url`. Public SELECT RLS. |
| `nex_theme_emoji`, `nex_theme_sticker` | **VERIFIED-SUPABASE-RO** | Both tables present for per-theme emoji/sticker packs. |
| `nex_theme_intro_seen` | **VERIFIED-SUPABASE-RO** | Per-user intro-seen tracker. |
| `nex_theme_view_counter` | **VERIFIED-SUPABASE-RO** | Theme view analytics table. |
| Account entitlement cols | **VERIFIED-SUPABASE-RO** | `nex_account` carries `tier`, `bisnis_expires_at`, `themes_trial_used_at`, `themes_trial_package_id`, `chat_theme` (active-theme id). |
| Purchase/entitlement rows | **MISSING** | No `nex_%purchase%` or `nex_%entitlement%` tables found. Matches the Theme Commerce Purchase Journey DRAFT 2026-10-20 state — purchase flow is DRAFT, not implemented. |

### 4.2 · Themes conclusion

Theme catalogue + per-theme assets + per-account entitlement hints
are **live in Supabase**. Theme selection + the LOCKED Theme Commerce
Purchase Journey DRAFT boundary is untouched. The absence of a
purchase/entitlement table matches the DRAFT state · the draft is NOT
yet authorised for a Stage 5 receipt / purchase surface build.

## 5 · Intro

### 5.1 · Verified pieces (2026-10-27)

| Piece | Status | Evidence |
|---|---|---|
| `nex_account_custom_intro` | **VERIFIED-SUPABASE-RO** | 11 cols incl. `entitlement_at`, `entitlement_source`, `video_url`, `video_duration_ms`, `video_width`, `video_height`, `video_size_bytes`, `uploaded_at`, `enabled`, `updated_at`. RLS: owner-only SELECT + UPDATE. |
| UI surface | **IMPLEMENTED** | `src/app/nex-native/settings/intro-video/page.tsx` + `_intro-video-client.tsx` + `live/_live-client.tsx`. |

### 5.2 · Intro conclusion

Custom-intro persistence is live. Entitlement is explicit on the row
(`entitlement_at` + `entitlement_source`). RLS blocks cross-account
read/write. **The approved intro flow matches the recorded schema.**

Open items · intro upload storage bucket not inspected; the "live"
intro-recording surface not E2E-tested.

## 6b · R9 classifier bug fix (2026-10-27)

### 6b.1 · The bug

Read-only Supabase inspection on 2026-10-27 revealed that
`nex_account.business_trial_status` **does not currently exist** in the
sealed project (`ijvqdvsvwtwxzcqmoqit`). PostgREST returns `undefined`
for this field on every real account row.

The pre-fix classifier in `live-eligibility.ts` used:

```ts
if (
  account.business_trial_status !== null &&
  account.business_trial_status !== "active"
) {
  return { ok: false, reason: "trial-expired" };
}
```

Because `undefined !== null` is `true` AND `undefined !== "active"`
is `true`, **every ineligible real account was tagged
`trial-expired`** instead of the honest `free-tier`.

### 6b.2 · Effect

- The eligibility gate itself still worked · users were still
  correctly redirected to `/packages`.
- Only the reason-code was wrong · telemetry would overcount
  "trial-expired" and undercount "free-tier"; client UX copy that
  branches on `reason` would be misleading.

### 6b.3 · Fix

Commit `68ac4a2` guards both `null` AND `undefined` as "never had a
trial" before interpreting any value as expired. Documented inline so
the next reader understands the explicit `undefined` guard is
load-bearing against the live schema.

Verification · 8/8 vitest green, includes a new regression case that
deletes the field from the fixture to simulate the live PostgREST
shape.

## 6 · Shop

### 6.1 · Verified pieces (2026-10-27)

| Piece | Status | Evidence |
|---|---|---|
| `nex_business` + `nex_product` existence | **VERIFIED-SUPABASE-RO** | Both tables confirmed present in Supabase. |
| Watch listing marketplace | **IMPLEMENTED** · **NOT verified against Supabase** | Task log #65–#77 shows migrations 227–230 applied to local `nex_dev` only. `nex_watch_listing` + `nex_watch_listing_entitlement` are **MISSING** from Supabase per gap ledger §4.2. End-to-end non-functional against this project. |
| Watch service surface | **LOCALLY VERIFIED** | `src/lib/nex-native/watches/watch-listing-service.ts` exports 8 functions (createWatchListing · grantWatchListingEntitlement · softRemoveWatchListing · getWatchListingById · getPublicWatchListingById · listMyWatchListings · listPublicDirectoryTiles · searchPublicWatchListings). Companion rate-limit + payment-webhook + retention + dev-mock-guard modules present. **8/8 service test PASS**. |
| Watch actions surface | **IMPLEMENTED** | 5 server actions (createWatchListingAction · grantWatchListingEntitlementMockAction · softRemoveWatchListingAction · searchWatchListingsAction · listMyWatchListingsAction). |
| Watch UI surfaces | **IMPLEMENTED** | `/manage/watches/new` (upload form) · `/nex-native/watches` (search) · `/nex-native/watches/[listingId]` (detail). |

## 7 · NEX Live

### 7.1 · Verified pieces (2026-10-27)

| Piece | Status | Evidence |
|---|---|---|
| R9 Live-Eligibility authority + 7 unit tests | **LOCALLY VERIFIED** | `22b960d` · 7/7 vitest green. |
| R9-5 server-shell redirect `/go-live` | **LOCALLY VERIFIED** | `a470180` · scoped typecheck clean. |
| R9-6 action-layer gate | **LOCALLY VERIFIED** | `eb20e73` · surgical hunk via `git apply --cached`. |
| R9-7 service-layer gate (`publishUploadedVideo`) | **LOCALLY VERIFIED** | `6758104` · no production caller yet, prophylactic. |
| D-C category-prefs filter | **LOCALLY VERIFIED** | `a3babfd` + `1a4d5c5` · 10/10 vitest green. |
| `nex_uploaded_video` schema | **VERIFIED-SUPABASE-RO** | Table EXISTS; migration 223 is applied. |
| `nex_live_session` persistence | **BLOCKED** | Table MISSING per gap ledger · migration 219 not applied · R9 gate works but surface it protects does not persist. |
| R9-6 honest banner + R9-8 `liveLocked` prop | **IMPLEMENTED, NOT COMMITTED** | Dirty tree hunks pending isolation + commit. |

### 7.2 · Live conclusion

R9 enforcement is live at THREE layers. **The gate is correct. The surface it protects is non-functional against this Supabase until migration 219 is applied** (owner decision gate per `nex-supabase-gap-ledger-2026-10-27.md` §9.1).

## 8 · What this ledger is NOT

- Not a sign-off that any area is "production-ready".
- Not a claim that any journey has been browser-tested unless marked **BROWSER-TESTED**.
- Not a substitute for the Supabase gap ledger (which drives the migration-decision list).
- Not a change to any sealed contract.
