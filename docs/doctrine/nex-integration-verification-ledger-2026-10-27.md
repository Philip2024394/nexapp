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

### 1.2 · Chat gaps and unverified items

- **No service-level unit test** for `sendPeerMessage` directly. Covered indirectly by the cart-order integration test. Dedicated test would increase regression safety but is additive, not corrective.
- **Receive path realtime subscription** not re-verified in this session. The arrival-emit side is implemented; the subscribe side (viewer page listening for inbound messages) is not probed here.
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

### 2.4 · Directory conclusion

Repository wiring is correct. The Directory service **assembles exactly what the sealed G3 contract specifies**. The gap is at the **operational / migration layer**:

- Canonical reads need either (a) migration of `NEX_POSTGRES_URL` to Supabase pooler, or (b) a Supabase REST client path · owner decision.
- Paid-listing views need migrations 229 + 233 applied · owner decision gate per `nex-supabase-gap-ledger-2026-10-27.md` §9.

**No code change in this session fixes this.** Both resolutions cross the sealed migration-approval gate. The gaps are recorded here for your decision.

## 3 · Vault

*(not probed this session · sealed LOCKED policy stands)*

## 4 · Themes

*(not probed this session · DRAFT contracts stand)*

## 5 · Intro

*(not probed this session)*

## 6 · Shop

### 6.1 · Verified pieces (2026-10-27)

| Piece | Status | Evidence |
|---|---|---|
| `nex_business` + `nex_product` existence | **VERIFIED-SUPABASE-RO** | Both tables confirmed present in Supabase. |
| Watch listing marketplace | **IMPLEMENTED** · **NOT verified against Supabase** | Task log #65–#77 shows migrations 227–230 applied to local `nex_dev` only. `nex_watch_listing` + `nex_watch_listing_entitlement` are **MISSING** from Supabase per gap ledger §4.2. End-to-end non-functional against this project. |

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
