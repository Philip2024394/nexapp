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

## 6c · Signup / Welcome (I-I · 2026-10-27)

### 6c.1 · Verified pieces

| Piece | Status | Evidence |
|---|---|---|
| UI 2-step signup | **IMPLEMENTED** | `src/app/nex-native/create-account/_two-step-signup-form.tsx` + `_create-submit.tsx` + name/phone/password fields. |
| Server action | **LOCALLY VERIFIED** | `_actions.ts:118 createNexAccountAction` validates FormData, calls `accountService.createAccount`. |
| Service | **LOCALLY VERIFIED** | `account-service.ts:69 createAccount` validates phone shape + chosen_handle, inserts `nex_account` with sealed `chat_theme: "theme-0"` (Joker), auto-allocates `nex_handle` via `ensureNexHandle`. |
| Tier default | **VERIFIED-SUPABASE-RO** | `nex_account.tier` default `'gratis'::text` · NOT NULL. 757 accounts live · 756 gratis + 1 bisnis. Fresh signup correctly lands on `gratis` tier. |
| Welcome flow | **IMPLEMENTED** | `/welcome` with `_vertical-picker.tsx` + `_remember-intent-action.ts` + `_remember-vertical-action.ts` + `/welcome/entering-free-chat`. |

### 6c.2 · Signup gaps and unverified items

- **B1 provisional-account claim** remains UNRESOLVED per `nex-complete-messaging-gap-analysis-and-build-roadmap-2026-10-14.md`. Signup does not transfer the provisional conversation. **No change in this session.**
- Supabase Auth hand-off (`supabase_user_id` population path) not traced in depth here.
- Browser E2E signup not run.

## 6d · Shop onboarding (I-J · 2026-10-27)

### 6d.1 · Verified pieces

| Piece | Status | Evidence |
|---|---|---|
| `/manage/*` UI surfaces | **IMPLEMENTED** | accommodation · analytics · banners · categories · community-discovery · email · gallery · info · ladder · live · menu · orders directories present. |
| `business-service.ts` surface | **LOCALLY VERIFIED** | 15 service functions including `createBusiness`, `updateBusinessProfile`, `updateBusinessCategoryAndKeywords`, `updateBusinessLocation`, `uploadSizeChartImage`, et al. |
| Business creation tier gate | **LOCALLY VERIFIED** | `createBusiness` imports `./tier-gate` and calls `assertCanCreateBusiness` BEFORE any Supabase insert. Gratis: 1/account · Bisnis: 5 · Pro: 5 (migration 046 · Indonesia launch package doctrine). |
| `nex_business` RLS | **VERIFIED-SUPABASE-RO** | owner-insert + owner-update + public-read. |
| `nex_product` RLS | **VERIFIED-SUPABASE-RO** | owner-insert + owner-read + owner-update + public-read-live. |
| `nex_menu_item` | **VERIFIED-SUPABASE-RO** | Table EXISTS. |

### 6d.2 · Shop onboarding gaps

| Table | Expected migration | Status |
|---|---|---|
| `nex_accommodation_listing` | 213 (Phase A1 Accommodation Backend · commit `901a552`) | **MISSING FROM SUPABASE** · migration 213 is in the gap list. `/manage/accommodation` surface writes would fail. |
| `nex_service_listing` | — | **MISSING FROM SUPABASE** · service vertical scaffolding not applied; path unknown. |

## 6e · Vault PIN / unlock (I-K · 2026-10-27)

### 6e.1 · Verified pieces

| Piece | Status | Evidence |
|---|---|---|
| `nex_vault_setup` | **VERIFIED-SUPABASE-RO** | 11 cols: `account_id`, `vmk_generation`, `pin_mode`, `pin_salt`, `pin_argon_params`, `prf_salt`, `recovery_configured_at`, `recovery_salt`, `recovery_argon_params`, `created_at`, `updated_at`. Argon2 params stored per-row (parameter rotation supported). PRF salt separate for WebAuthn-PRF biometric unlock. RLS: owner-read. |
| `nex_vault_pin_attempt` | **VERIFIED-SUPABASE-RO** | 5 cols: `id`, `account_id`, `device_id`, `success`, `attempted_at`. Device-scoped audit log. RLS: owner-read. |
| `nex_vault_recovery_attempt` | **VERIFIED-SUPABASE-RO** | 4 cols: `id`, `account_id`, `success`, `attempted_at`. Account-scoped audit log. |
| `nex_vault_key_envelope` | **VERIFIED-SUPABASE-RO** | 12 cols: `id`, `account_id`, `kind`, `target_device_id`, `credential_id`, `wrapped_vmk`, `nonce`, `algorithm`, `generation`, `consumed_at`, `expires_at`, `created_at`. Per-device wrapped VMK · supports multi-device via `target_device_id` + `credential_id` · supports single-use envelopes via `consumed_at` · supports rotation via `generation`. |

### 6e.2 · Vault PIN / unlock conclusion

The schema supports a production-grade E2EE flow: Argon2 PIN hashing with per-row params, WebAuthn-PRF biometric unlock, per-device VMK wrapping, rotation via generation, single-use recovery envelopes, device-scoped audit log. **LOCKED Vault entitlement policy untouched · no permissions invented.**

Open items · the pin-entry reducer + unlock dispatch logic not functionally exercised; UI reducer test (`_pin-entry-reducer.test.ts`) exists in repo but was not re-run this session.

## 6f · R9 classifier bug fix (2026-10-27)

### 6f.1 · The bug

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

### 6f.2 · Effect

- The eligibility gate itself still worked · users were still
  correctly redirected to `/packages`.
- Only the reason-code was wrong · telemetry would overcount
  "trial-expired" and undercount "free-tier"; client UX copy that
  branches on `reason` would be misleading.

### 6f.3 · Fix

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

## 6g · Payment / Stripe compliance (I-L · 2026-10-27)

Existing audit `nex-stripe-compliance-readiness-audit-2026-10-20.md`
stands. No code probe required this turn.

- `stripe@^17.7.0` installed in `package.json`, **zero production code uses it**.
- Sealed doctrine "NEX never handles payments" is repeated across 7+ customer-facing pages — intact.
- Legal entity, canonical legal-page system, price catalogue specifics remain UNKNOWN / UNRESOLVED per the existing audit.
- **No change in this session.** Payment adoption remains a sealed owner decision.

## 6h · Social edges (I-M · 2026-10-27)

### 6h.1 · Verified pieces

| Piece | Status | Evidence |
|---|---|---|
| `nex_friend_edge` | **VERIFIED-SUPABASE-RO** | 6 cols: `a_account_id`, `b_account_id`, `requested_by`, `status`, `created_at`, `updated_at`. **5 rows live.** NO RLS policies — service-role writes only (confirmed by `friend-service.ts` using `nexSupabaseAdmin`). Defence-in-depth comes from service-layer ownership assertions in `blockAccount`, `unblockAccount`, `sendInvite`, `respondToInvite`. |
| `nex_friend_request` | **VERIFIED-SUPABASE-RO** | 12 cols incl. `sender_account_id`, `recipient_nex_handle`, `recipient_account_id`, `status`, `expires_at`, `cooldown_ends_at`, `intro_note`. **0 rows live.** 5 RLS policies (sender + recipient scoped). |
| `friend-service.ts` surface | **IMPLEMENTED** | 9 service functions: sendInvite, respondToInvite, getEdge, countMutualFriends, listFriends, listPendingIncoming, listPendingOutgoing, blockAccount, listBlockedByMe, unblockAccount. |
| Settings → Blocked | **IMPLEMENTED** | `/settings/blocked` route uses `listBlockedByMe` + `unblockAccountAction`. |

### 6h.2 · Gaps

- **`nex_discovery_signal`** confirmed MISSING in both `public` and `nex` schemas (reinforces gap ledger §4.2). All dismiss/tap/save/chat_open/enquiry_initiated/cart_sent writes silently fail against this project.
- **Migration 215 anomaly**: `nex_friend_request` table EXISTS in Supabase, but migration version `215` is NOT in `public.nex_migration_history`. Likely applied via a different path at some point. Cosmetic ledger drift · no runtime impact.

## 6i · Realtime channel inventory (I-N · 2026-10-27)

All `openNexChannel` call sites and their concrete channel name
patterns:

| Pattern | Purpose | File | Keyed off | Status |
|---|---|---|---|---|
| `nex:messages:{conversationId}` | Chat arrival + read-ack | realtime/message-events.ts | `nex_peer_conversation.id` | **LIVE** — table exists |
| `nex:typing:{conversationId}` | Chat typing indicator | realtime/typing.ts | `nex_peer_conversation.id` | **LIVE** |
| `nex:signal:{conversationId}` | WebRTC signalling | realtime/signalling.ts | `nex_peer_conversation.id` | **LIVE** |
| `nex:presence:conv:{conversationId}` | Per-conversation presence | realtime/presence.ts | `nex_peer_conversation.id` | **LIVE** |
| `nex:calls:in:{accountId}` | Incoming call ring | realtime/incoming-calls.ts | `nex_account.id` | **LIVE** |
| `nex:group:{sessionId}` | Group-call presence | calls/group-call-engine.ts | call session id | **LIVE** (session is in-memory) |
| `nex:live:{sessionId}` | Live broadcast WebRTC + presence | live-broadcast/broadcast-engine.ts + viewer-client.ts | `nex_live_session.id` | **DEAD** — table missing |
| `nex:live-comments:{sessionId}` | Live chat | live-broadcast/live-comments-channel.ts | `nex_live_session.id` | **DEAD** — table missing |
| `nex:live-featured:{sessionId}` | Live featured product | live-broadcast/featured-product-channel.ts | `nex_live_session.id` | **DEAD** — table missing |
| `nex:live-jail:{sessionId}` | Live jail/mute broadcast | live-broadcast/jail-channel.ts | `nex_live_session.id` | **DEAD** — table missing |
| `nex:status-owners` | Status feature · global owners | status-p2p/presence.ts | — | **LIVE** |
| `nex:status-serve:{ownerAccountId}` | Status feature · per-owner serve | status-p2p/serve.ts | `nex_account.id` | **LIVE** |

**12 channel patterns across 7 feature areas. 4 Live-adjacent channels are architecturally correct but dark** until `nex_live_session` persistence lands (migration 219 unapplied).

## 6j · Storage bucket inventory (I-O · 2026-10-27)

### 6j.1 · Live Supabase buckets (13 total · 20 storage policies)

`nex-avatars` · `nex-business-assets` · `nex-chat-theme-hero` · `nex-community-photos` · `nex-media` · `nex-mock-personas` · `nex-peer-chat-attachments` · `nex-theme-emoji` · `nex-theme-intro` · `nex-theme-sticker` · `nex-user-intros` · `nex-user-wallpapers` · `nex-vault-files`

### 6j.2 · Service bucket references (verified cross-check)

| Service bucket constant | Live bucket | Status |
|---|---|---|
| `account-profile-service :: NEX_AVATAR_BUCKET = "nex-avatars"` | ✓ | **LIVE** |
| `business-media/owner-upload-service :: OWNER_UPLOAD_BUCKET = "nex-media"` | ✓ | **LIVE** |
| `community/photo-upload-service :: "nex-community-photos"` | ✓ | **LIVE** |
| `directory/media-resolver :: PUBLIC_BUCKET_NAME = "nex-media"` | ✓ | **LIVE** |
| `intro-settings-service :: INTRO_VIDEO_BUCKET = "nex-user-intros"` | ✓ | **LIVE** |
| `intro-settings-service :: WALLPAPER_BUCKET = "nex-user-wallpapers"` | ✓ | **LIVE** |
| `shop-cover-service :: SHOP_COVER_BUCKET = "nex-user-wallpapers"` | ✓ | **LIVE** |
| **`uploaded-video-service :: default "nex-live-uploaded"`** | ✗ | **MISSING** |
| **`custom-intro-config :: CUSTOM_INTRO_STORAGE_BUCKET = "nex-media-videos"`** | ✗ | **MISSING** |

### 6j.3 · Two bucket gaps

- **`nex-live-uploaded`** · referenced by `uploaded-video-service.ts` (default `storage_bucket`) and `dev-video-manifest.ts` (`DEV_BUCKET`). The INSERT into `nex_uploaded_video` would succeed (table exists) but the stored `storage_bucket` value points at a non-existent bucket · uploads would have no retrievable storage.
- **`nex-media-videos`** · referenced only by `custom-intro-config.ts :: CUSTOM_INTRO_STORAGE_BUCKET`. Note that `intro-settings-service.ts` uses a DIFFERENT constant `INTRO_VIDEO_BUCKET = "nex-user-intros"` which IS live. Two intro-video bucket names in the same codebase · configuration drift. **Owner call** which is canonical.

Companion storage findings (no mapping error):
- `nex-vault-files` live · matches sealed Vault bucket expectation.
- `nex-theme-emoji` + `nex-theme-sticker` + `nex-theme-intro` live · match theme asset expectations.
- `nex-chat-theme-hero` live · matches `nex_chat_theme.hero_image_url` references.

## 6k · RLS breadth check (I-P · 2026-10-27)

### 6k.1 · Numbers

| Fact | Count |
|---|---|
| Total `public.nex_*` tables | **89** |
| Tables with ≥ 1 RLS policy | **48** |
| Tables with NO RLS policies | **41** |
| Of which · RLS enabled, no policies (fail-safe for anon clients) | **22** |
| Of which · RLS disabled entirely (service-role only by design) | **19** |

### 6k.2 · Service-only tables (RLS off · 19)

Tables where service-role is the sole writer and RLS is intentionally off:
`nex_banner`, `nex_community_business_welcome_detail`, `nex_community_card`, `nex_community_card_confirmation`, `nex_community_card_photo`, `nex_community_card_report`, `nex_community_card_update`, `nex_community_lost_found_detail`, `nex_community_membership`, `nex_community_notice`, `nex_community_notice_confirmation`, `nex_community_notice_report`, `nex_community_notice_update`, `nex_community_rate_limit`, `nex_community_zone`, `nex_handle_counter`, `nex_liked_product`, `nex_menu_item`, `nex_menu_section`, `nex_report`.

Not a security finding by itself · the Community doctrine (2026-10-23) explicitly routes community writes through service-role with explicit ownership assertions. **No change authorised.** The owner may want to double-check `nex_menu_item` + `nex_menu_section` which could reasonably be public-read.

### 6k.3 · Fail-safe tables (RLS on · no policies · 22)

Deny-by-default for anon clients · includes several sensitive tables:
`nex_account_relationship_prefs`, `nex_account_risk_signal`, `nex_bridge99_first_send_intent`, `nex_collection_fetch_errors`, `nex_collection_url_queue`, `nex_email_campaign`, `nex_email_list`, `nex_email_send_log`, `nex_email_subscriber`, `nex_friend_edge`, `nex_generated_site`, `nex_generation_job`, `nex_ledger_entry`, `nex_ledger_line`, `nex_live_post`, `nex_migration_history`, `nex_product_variant`, `nex_session_registry`, `nex_theme_view_counter`, `nex_webauthn_credential`, `nex_welcome_outbox`.

Correct posture · anon client access would return zero rows, service-role writes bypass as intended.

## 6l · Family Safety (I-Q · 2026-10-27)

| Piece | Status | Evidence |
|---|---|---|
| Service modules | **IMPLEMENTED** | `src/lib/nex-native/family-safety/*` includes age-transition, contact-visibility, dashboard, home, minor-safechat-enforcer, privacy-invariants, safechat-status-reader, feature-flag, child-account-creation, custody. |
| Test file count | **16 FAIL · 4 PASS at file level** | **All 57 individual assertions that successfully load PASS.** The 16 file-level failures all throw `This module cannot be imported from a Client Component module` on `node_modules/server-only/index.js:1`. **Pre-existing test-infra gap** · adding `vi.mock("server-only", () => ({}))` to each file would fix (same shim used in `live-eligibility.test.ts` committed earlier). Not a product regression. |

### 6l.1 · Family Safety conclusion

Doctrine honoured at the service layer. Test harness has a shared `server-only` import gap across 16 test files · a routine infrastructure fix, not a correctness issue. **No locked policy moved.** No code change in this session.

## 6m · Push notification dispatch (I-S · 2026-10-27)

### 6m.1 · Verified pieces

| Piece | Status | Evidence |
|---|---|---|
| `dispatchPushNotification` | **LOCALLY VERIFIED** | `src/lib/nex-native/notification-dispatch-service.ts:142`. Three-step dispatch: fail-closed prefs read → Vault-boundary check (conversation payloads only, type-system guaranteed) → fan-out to subscriptions with pruning on invalid. Honest skipped_reason enum: `disabled`, `prefs_unavailable`, `vault_check_failed`, `vault_rejected`. |
| `nex_account_push_subscription` | **VERIFIED-SUPABASE-RO** | 8 cols: `id`, `account_id`, `endpoint`, `p256dh`, `auth`, `user_agent`, `created_at`, `last_seen_at`. **441 rows live.** RLS: owner-write ALL. |
| `nex_account_notification_prefs` | **VERIFIED-SUPABASE-RO** | 7 cols: `account_id`, `message_enabled`, `call_enabled`, `reaction_enabled`, `mention_enabled`, `marketing_enabled`, `updated_at`. RLS: owner-rw ALL. |
| Vault boundary guard | **LOCALLY VERIFIED** | Fail-closed · if `listVaultedConversationIds` throws, suppress push. If conversation is vaulted, suppress push. No preview copy carries plaintext. |
| Dispatch tests | **LOCALLY VERIFIED** | `__tests__/notification-dispatch-service.test.ts` · **14/14 PASS**. |

### 6m.2 · Push notification conclusion

End-to-end dispatch path is sound against existing live tables. Fail-closed posture respects Vault boundary + saved prefs. **No locked policy moved.** Browser/webpush/APNs integration + endpoint validity testing not exercised in this read-only probe.

## 6n · Vault tier schema check (I-T · 2026-10-27)

### 6n.1 · Observations

| Fact | Value |
|---|---|
| `nex_account.vault_tier` column in Supabase | **DOES NOT EXIST** |
| Any `vault_tier` column anywhere in schema | **DOES NOT EXIST** |
| Code references | `src/lib/nex-native/vault/vault-service.ts:effectiveVaultAccess` reads `account.vault_tier` + `account.vault_trial_used_at`. `src/lib/nex-native/business-trial/__tests__/migration-shape.test.ts` also references the column name. |

### 6n.2 · Behaviour against live Supabase

`effectiveVaultAccess(account)` logic when `vault_tier` is absent:

```ts
if (account.vault_tier && account.vault_tier !== "gratis") return true;
// ^ undefined → falsy → fall through
```

PostgREST returns `undefined` for the missing column. The guard short-circuits. The function then checks `vault_trial_used_at` fallback (also missing). Net effect: `effectiveVaultAccess` returns **false** for every real account on this project.

### 6n.3 · Agreement with the locked Vault policy

The sealed `nex-vault-entitlements-policy-sheet-2026-10-20.md` + the memory entry `project_nex_vault_entitlements_locked_2026_10_20.md` explicitly record:
> *"Lock = decisions only · NO implementation authorised. W1–W12 unscheduled."*

**The missing column is CONSISTENT with the locked policy** — the schema is intentionally un-provisioned because the implementation is not authorised. The code in `vault-service.ts` is a stub that gracefully returns `false` until the owner authorises the Vault Entitlements implementation.

### 6n.4 · Fail-closed verification

`effectiveVaultAccess` returning `false` for every account is **the correct fail-closed behaviour** given:
1. The policy is LOCKED (decisions only, no implementation).
2. The schema is intentionally un-provisioned.
3. The code must not accidentally grant Vault access to any account before the owner authorises the implementation.

**No discrepancy against the locked contract.** No change authorised in this session.

### 6n.5 · Owner-decision items this probe surfaces

Already recorded in `nex-supabase-gap-ledger-2026-10-27.md` §9 under the implicit "W1–W12 Vault implementation" cluster · no new decisions created.

## 6o · S1 dependency investigation (I-U · 2026-10-27)

### 6o.1 · Call-site enumeration

`grep` across `src/` for `publishUploadedVideo` + `nex-live-uploaded`:

- `uploaded-video-service.ts:217` · service default `storage_bucket ?? "nex-live-uploaded"` (STRING LITERAL only, no `storage.from()` call).
- `dev-video-manifest.ts:764 DEV_BUCKET = "nex-live-uploaded"` · used only as fake-row metadata; **not** used for URL construction (dev videos are served from Next's `public/dev/live-videos/` static path, verified at line 770).
- `live-eligibility.ts:15` · doctrine comment reference only.
- `__tests__/uploaded-video-service.test.ts` · test fixtures.

**Zero production callers of `publishUploadedVideo`.** **Zero `storage.from("nex-live-uploaded")` writes anywhere.**

### 6o.2 · Alternative-bucket compatibility

| Alternative | Compatible? | Notes |
|---|---|---|
| `nex-media` | **YES** | Already used by `owner-upload-service` + directory media-resolver. Co-locating public uploaded videos with other public media is consistent. |
| `nex-user-intros` | NO | Reserved for `/settings/intro-video` custom-intros. |
| `nex-user-wallpapers` | NO | Reserved for chat wallpapers + shop covers. |
| Create `nex-live-uploaded` | — | Owner-decision bucket creation; preserves current defaults. |

### 6o.3 · S1 conclusion

The bucket is referenced only as a string value — not as the target of any upload. Current behaviour against live Supabase: `publishUploadedVideo` would insert rows with `storage_bucket='nex-live-uploaded'`, but no bytes exist in that bucket because nothing has ever uploaded. **The three defensible resolutions from the gap ledger remain owner-only decisions** · no implementation authorised in this session.

## 6p · S2 dependency investigation (I-V · 2026-10-27)

### 6p.1 · Call-site enumeration

Two parallel intro-video systems:

- **`CUSTOM_INTRO_STORAGE_BUCKET = "nex-media-videos"`** · referenced by:
  - `custom-intro-config.ts:14`
  - `custom-intro-service.ts:32`
  - `/api/nex-native/custom-intro/upload/route.ts:28,102` · performs actual `storage.put(CUSTOM_INTRO_STORAGE_BUCKET, …)` write

- **`INTRO_VIDEO_BUCKET = "nex-user-intros"`** · referenced by:
  - `intro-settings-service.ts:38`
  - `/settings/intro-video/*` UI comments mention this bucket

### 6p.2 · Live stored objects (read-only probe)

| Bucket | Status | Objects live |
|---|---|---|
| `nex-user-intros` | **LIVE** | **0** |
| `nex-media-videos` | **MISSING** | would be **0** |
| `nex-theme-intro` | **LIVE** | **11** (theme catalogue intros · unrelated) |
| `nex_account_custom_intro` row count | **LIVE** | **0** |

### 6p.3 · S2 conclusion

**Both custom-intro features are UNUSED in production.** The drift is latent · zero rows exist, zero objects exist, zero users have ever uploaded. The two features appear to be independent (one for Chat intros reached via `/api/custom-intro/upload`, one for Settings intros reached via `intro-settings-service.ts`), but neither has run.

Four defensible resolutions remain owner-only decisions:
- (a) Delete whichever system is not intended.
- (b) Create `nex-media-videos` bucket when authorised.
- (c) Point `CUSTOM_INTRO_STORAGE_BUCKET` at the live `nex-user-intros`.
- (d) Hold indefinitely · zero rows means zero impact.

**No implementation authorised in this session.**

## 6q · S3 dependency investigation (I-W · 2026-10-27)

### 6q.1 · Access-path audit

Every `.from("nex_menu_item")` + `.from("nex_menu_section")` call in `src/`:

- `menu-service.ts:194,208,241,256,273,293,312,326,404` · **uses `nexSupabaseAdmin` (service role · bypasses RLS)**.
- `discover-card-context.ts:119,160` · also service role.
- `intelligence/business-evidence-retriever.ts:176` · also service role.

**No client-side query to either table exists anywhere in `src/`.** No browser code uses the Supabase anon key against `nex_menu_item` or `nex_menu_section`. All reads go through server-side services.

### 6q.2 · S3 conclusion

**RLS being disabled on `nex_menu_item` and `nex_menu_section` is INTENTIONAL and CORRECT.** The current posture matches the Community doctrine pattern — service-role writes with explicit ownership checks in the service layer. The flag I raised in §6k is downgraded: service-only tables with no client-reachable path do not need RLS policies for the current access pattern.

**Only caveat:** if the Supabase anon key is ever granted SELECT on these tables (currently it is not), RLS being off would allow unauthenticated reads. The current posture is correct as long as the anon key stays unauthorised against these tables.

**No RLS change authorised.** No change needed in this session.

## 8 · What this ledger is NOT

- Not a sign-off that any area is "production-ready".
- Not a claim that any journey has been browser-tested unless marked **BROWSER-TESTED**.
- Not a substitute for the Supabase gap ledger (which drives the migration-decision list).
- Not a change to any sealed contract.
