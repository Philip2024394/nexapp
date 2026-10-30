# NEX Follow · Architecture + Implementation Specification · DRAFT

**Status:** DRAFT — architecture + specification only · **NO IMPLEMENTATION AUTHORISED.**
**Issued:** 2026-10-30
**Scope:** The single Follow system for the entire NEX ecosystem — music, Live, Directory, Socials, Business.

Cross-references:
- Main Feed Constitution — `nex-main-feed-constitution-decisions-2026-10-30.md`
- Live R9 Eligibility Contract — `nex-live-eligibility-contract-2026-10-27.md`
- Music Publishing Design Locks — `nex-music-publishing-to-live-feed-design-contract-DRAFT-2026-10-30.md`
- Socials sealed doctrine — invite flow + pending-identity privacy
- Sealed Supabase project ref — `ijvqdvsvwtwxzcqmoqit` (CLAUDE.md §8)

---

## 1 · Framing + non-goals

### 1.1 · Why one Follow system
Owner directive 2026-10-30 (verbatim):

> I would not limit Follow to music creators. … This creates something valuable: an audience and discovery network that connects NEX Feed, NEX Live, NEX Music and NEX Directory. … Build one Follow system for the entire NEX ecosystem. Build it once, properly, and let every NEX experience use it.

Every surface that currently renders a Follow affordance (today: `MusicActionsStack`; future: Live viewer, profile page, Directory listing, Business page) MUST read from and write to the **same** underlying follow graph. No per-surface duplication.

### 1.2 · Sealed experience (Dewi → Hendra)
1. Dewi discovers Hendra in her feed (music, Live, or Directory).
2. Dewi taps **Follow** · button flips to **Following** · the relationship is persisted.
3. Hendra receives an in-app notification: *"Dewi started following you."*
4. When Hendra publishes a new track / goes Live / updates his business, Dewi is told via her notification feed (and/or push, when that layer exists), and/or sees his content ranked higher in her main feed.
5. Both profiles reflect accurate follower / following counts and lists, subject to privacy settings.

### 1.3 · Explicit non-goals (this doc)
- No implementation. No SQL applied. No actions written. No UI wired.
- No decision on which NEX surfaces ship Follow in Stage 1 (owner picks per the gates below).
- No notification channel decision (push vs email vs in-app) locked in — only architecture.
- No feed-ranking weight numbers locked in — only the integration points.

---

## 2 · Stage breakdown (per owner directive 2026-10-30)

| Stage | Scope | Status |
|---|---|---|
| **1 · Essential** | Persistence · counters · lists · idempotent follow/unfollow · self-follow prevention · block integration | Specified below (§3–§7). Implementation gated. |
| **2 · Essential next** | Notifications (in-app · optional push/email) · creator-activity fan-out · recipient preferences | Specified below (§8). Implementation gated. |
| **3 · Growth** | Follow-based feed ranking · mutual-follower surfaces · recommendations · creator analytics | Specified below (§9). Implementation gated. |

Shipping Stage 2 before Stage 1 is a non-starter. Shipping Stage 3 before Stage 2 ships without the signal that justifies the ranking. Order is sealed.

---

## 3 · Canonical storage + data ownership

### 3.1 · The follow graph
Single table in the sealed Supabase project (`ijvqdvsvwtwxzcqmoqit`):

```
nex_follow
  follower_id   uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE
  followee_id   uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE
  created_at    timestamptz NOT NULL DEFAULT now()
  source        text        -- 'music' | 'live' | 'profile' | 'directory' | 'socials' | 'business'
  PRIMARY KEY (follower_id, followee_id)
  CHECK (follower_id <> followee_id)
```

Rationale:
- **One table, not per surface** — one source of truth; surfaces attribute discovery via `source` without fragmenting the graph.
- **Composite PK on (follower, followee)** — idempotency enforced at the storage layer. A second follow attempt is a no-op upsert, never a duplicate row.
- **`CHECK (follower <> followee)`** — no self-follow possible at the DB layer, defence in depth above the server-action guard.
- **`ON DELETE CASCADE`** — account deletion removes all its follow rows (both directions).
- **`source`** — optional analytics channel. NOT used for retrieval (we don't query "all follows via music"); only for product observability.

### 3.2 · Account-level counters
Denormalized on `nex_account`:

```
nex_account additions
  followers_count  integer NOT NULL DEFAULT 0
  following_count  integer NOT NULL DEFAULT 0
```

Updated via Postgres triggers on `nex_follow` INSERT/DELETE. Hybrid with a periodic reconciliation job (§6.2) to catch drift.

### 3.3 · Private / approval accounts (optional, Stage 1 or deferred)
```
nex_account additions
  account_privacy  text NOT NULL DEFAULT 'public'   -- 'public' | 'approve' | 'private'

nex_follow additions
  approved_at      timestamptz NULL
```

- `public` → follow succeeds immediately, `approved_at = now()` on insert.
- `approve` → follow succeeds with `approved_at = NULL`; followee sees it as a pending request in their inbox and can accept/reject.
- `private` → follow blocked unless already-mutual, discovery hidden.

Open-decision (owner): ship account_privacy in Stage 1 or defer to Stage 2+? See §10 D1.

### 3.4 · Block list (foundational, not optional)
```
nex_block
  blocker_id   uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE
  blocked_id   uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE
  created_at   timestamptz NOT NULL DEFAULT now()
  PRIMARY KEY (blocker_id, blocked_id)
  CHECK (blocker_id <> blocked_id)
```

Follow trigger OR server-action layer MUST check both directions of the block table before allowing follow. Blocking also deletes any existing follow row in either direction.

### 3.5 · RLS policies (summary — specified in migration file at implementation gate)
- `nex_follow INSERT` — allowed only when `auth.uid() = follower_id` AND no reverse block exists.
- `nex_follow DELETE` — allowed when `auth.uid() = follower_id` (unfollow) OR `auth.uid() = followee_id` (remove-follower).
- `nex_follow SELECT` — public by default (follow graph is a public social signal), BUT list surfaces (§5) gate on followee's `followers_list_visibility`.
- `nex_block` — `auth.uid() = blocker_id` for all operations. Block list is private.

---

## 4 · Follow / unfollow lifecycle

### 4.1 · States + transitions
```
not-following  —(followAction)→  following
following      —(unfollowAction)→  not-following

For `approve` accounts:
not-following  —(followAction)→  pending  —(approveFollowAction)→  following
pending        —(rejectFollowAction)→  not-following
pending        —(unfollowAction)→  not-following  (cancel request)

For blocked relationships:
followAction returns `blocked`; no row written.
blockAction on existing follow → row deleted → counters decremented → state → not-following.
```

### 4.2 · Server actions (contract only, no implementation)
All return `NexFollowResult<T>` — the sealed result discriminator pattern used across NEX actions:

| Action | Input | Output | Side effects |
|---|---|---|---|
| `followAction` | `{followeeId, source}` | `{ok: true, state: 'following' \| 'pending'}` | Insert row · bump counters · enqueue 'follow' notification · (if public) bump followee's `followers_count` |
| `unfollowAction` | `{followeeId}` | `{ok: true, state: 'not-following'}` | Delete row · decrement counters · suppress pending notification if not yet delivered |
| `isFollowingAction` | `{followeeId}` | `{ok: true, state: 'not-following' \| 'pending' \| 'following'}` | None — pure read |
| `approveFollowAction` | `{followerId}` | `{ok: true}` | Set `approved_at = now()` · enqueue 'follow-approved' notification to the follower |
| `rejectFollowAction` | `{followerId}` | `{ok: true}` | Delete the pending row · no notification (silent rejection) |
| `blockAction` | `{blockedId}` | `{ok: true}` | Insert block · delete any follow rows in either direction · decrement counters · no notification to the blocked party |
| `unblockAction` | `{blockedId}` | `{ok: true}` | Delete block row · follow relationships NOT auto-restored |

Error codes shared across actions: `not-signed-in` · `invalid-input` · `self-follow` · `blocked` · `not-found` · `rate-limited` · `internal`.

### 4.3 · Idempotency guarantees
- **PK violation on INSERT = success** — the action catches `23505` (unique_violation) and returns `{ok: true, state: 'following'}`. Second tap is a no-op.
- **DELETE on missing row = success** — unfollow of a non-follow returns `{ok: true, state: 'not-following'}` without error.
- **Concurrent follows coalesce** at the PK level · counter trigger uses `INSERT … ON CONFLICT DO NOTHING RETURNING xmax = 0` to count only the FIRST winner · prevents double-counting.

### 4.4 · Self-follow prevention
Two layers:
1. **Action layer** — rejects `followeeId === session.account.id` with `self-follow` error code before DB write.
2. **DB layer** — `CHECK (follower_id <> followee_id)` prevents the row even if the action is bypassed.

---

## 5 · Follower / following lists

### 5.1 · Paginated reads
```
listFollowersAction({accountId, cursor, limit})
listFollowingAction({accountId, cursor, limit})
```

- Order: `created_at DESC` — most recent follows first.
- Cursor: opaque base64 of `(created_at, follower_id)` tuple — stable pagination even with concurrent inserts.
- Limit: default 50, max 200.

### 5.2 · Visibility gating
```
nex_account additions
  followers_list_visibility   text NOT NULL DEFAULT 'public'  -- 'public' | 'mutuals' | 'private'
  following_list_visibility   text NOT NULL DEFAULT 'public'  -- same
```

- `public` → anyone can list.
- `mutuals` → only mutual followers can list.
- `private` → only the account owner can list their own.

Blocker's rows are invisible to the blocked party in all cases.

Open decision (owner): default to `public`, `mutuals`, or `private`? See §10 D2.

### 5.3 · Counter display privacy
```
nex_account additions
  follower_count_hidden   boolean NOT NULL DEFAULT false
```

When `true`, the public profile shows "Followers" with no number. (Owner can still see their own count in their settings.) Useful for creators who don't want count-shaming.

---

## 6 · Counter accuracy

### 6.1 · Trigger-based updates (primary)
Postgres triggers on `nex_follow`:
- `AFTER INSERT` → `UPDATE nex_account SET followers_count = followers_count + 1 WHERE id = NEW.followee_id`; same for `following_count` on the follower side.
- `AFTER DELETE` → mirror decrement.
- Trigger body runs within the same transaction as the insert/delete, so counter is consistent with the follow state at commit.

### 6.2 · Reconciliation job (safety net)
A background worker (weekly) runs:
```sql
UPDATE nex_account a
SET followers_count = (SELECT COUNT(*) FROM nex_follow WHERE followee_id = a.id),
    following_count = (SELECT COUNT(*) FROM nex_follow WHERE follower_id = a.id)
WHERE id IN (
  -- accounts whose cached count differs from the computed count
  SELECT id FROM nex_account WHERE ...
);
```

Catches drift from trigger failures, direct SQL hacks, or restore-from-backup edge cases. Weekly cadence is a proposal — may need tighter during early rollout.

### 6.3 · Why not read-time COUNT()?
Rejected because:
- Profile page displays count on every render — COUNT on a 10M-row join is expensive.
- Trigger overhead is O(1) per follow/unfollow · one UPDATE on an indexed row.
- Reconciliation job catches drift reliably.

---

## 7 · Privacy, blocking, abuse prevention

### 7.1 · Blocks (foundational)
Covered in §3.4. Enforcement at follow-action AND at content-read actions (blocked parties see each other as if they didn't exist in the feed, lists, search).

### 7.2 · Rate limiting
Per-account enforcement at the action layer:
- Follow churn: max **N follows per 60 seconds**, max **M unfollows-of-the-same-person per 24h** (anti-follow-unfollow-spam).
- Mass follow detection: >50 follows in <5 minutes → flag account for review (not auto-block, but surface in moderation queue).

Numbers are placeholders. Owner-decided per §10 D3.

### 7.3 · Follow-approve audit
Pending follow requests expire after N days if not approved. Open-decision §10 D4 — expire or persist forever?

### 7.4 · Account deletion
`ON DELETE CASCADE` on `nex_follow` wipes all rows for the deleted account. Counters on other accounts decrement via the DELETE trigger. Clean.

### 7.5 · Social-graph export (GDPR)
User must be able to export their own follower + following list. API: `exportFollowGraphAction({accountId})` — returns CSV/JSON of accountIds + handles + display names + timestamps. Gated by `auth.uid() === accountId`.

---

## 8 · Notification architecture (Stage 2)

### 8.1 · In-app notification store (foundational)
```
nex_notification
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  recipient_id  uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE
  kind          text NOT NULL   -- see §8.2
  payload       jsonb NOT NULL
  created_at    timestamptz NOT NULL DEFAULT now()
  read_at       timestamptz NULL
  dedup_key     text NOT NULL
  UNIQUE (recipient_id, dedup_key)
```

- `dedup_key` prevents the same event firing twice (e.g., follow-tapped-twice-concurrently → one notification only).
- `read_at` enables unread badge on the notification bell.
- Index on `(recipient_id, created_at DESC)` for the notification feed.

### 8.2 · Notification kinds (follow-related subset)
| Kind | Trigger | Payload |
|---|---|---|
| `follow` | Dewi follows Hendra | `{follower_id: dewi, source: 'music'}` |
| `follow-approved` | Hendra approves Dewi's pending request | `{followee_id: hendra}` |
| `content-posted-by-followed-music` | Hendra publishes a music track → fan-out to every follower | `{poster_id, track_id, title}` |
| `content-posted-by-followed-video` | Hendra uploads a video → fan-out | `{poster_id, video_id}` |
| `live-started-by-followed` | Hendra goes Live → fan-out | `{poster_id, session_id}` |
| `business-update-by-followed` | Hendra updates his business profile / posts an update | `{business_id, update_type}` |

Each kind maps to a server-side event + a fan-out worker.

### 8.3 · Fan-out worker
When a creator publishes:
1. Server action completes the publish (track insert, video insert, Live start, etc.).
2. In the same transaction OR via a durable queue, enqueue a fan-out job: `{event_kind, poster_id, content_ref}`.
3. Worker picks up job, runs `SELECT follower_id FROM nex_follow WHERE followee_id = poster_id AND approved_at IS NOT NULL`.
4. For each follower, insert into `nex_notification` (idempotent via `dedup_key = sha256(kind || poster_id || content_ref)`).
5. Deliver via chosen channel(s) per §8.4.

Scalability: a 10,000-follower fan-out is 10,000 INSERTs. Batched 500-at-a-time. Done asynchronously, under 60 s for typical creator sizes.

Rate limiting on creator side: max 10 fan-out events per creator per hour (anti-spam). Owner-decided §10 D5.

### 8.4 · Delivery channels
Three channels, each independently gated by the recipient's prefs:

**A. In-app notification feed** — foundational. Always on. Powers the unread-bell + "Notifications" screen. Implementation: just the `nex_notification` table + a listing API.

**B. Push notification** — requires:
- Device token registry (`nex_device_token(account_id, token, platform, created_at)`)
- Platform integration: FCM (Android), APNS (iOS), Web Push (browsers)
- Delivery worker that reads from `nex_notification` and dispatches

Push is DEFERRED to a later gate — owner-decided §10 D6 (which platforms, which service, when).

**C. Email digest** — requires:
- Postmark (or similar) integration
- Hourly or daily digest batching
- Opt-in by default OFF (anti-spam)

Email is DEFERRED to a later gate — owner-decided §10 D7.

### 8.5 · Recipient preferences

Two tiers of preferences · global defaults + per-creator overrides. The owner directive 2026-10-30 ("Dewi should be able to follow Hendra but mute his ordinary publishing notifications while still receiving LIVE alerts") requires per-creator-per-kind granularity, which the per-creator table below provides.

**Global defaults (one row per account):**
```
nex_notification_prefs
  account_id              uuid PRIMARY KEY REFERENCES nex_account(id) ON DELETE CASCADE
  in_app_follow           boolean NOT NULL DEFAULT true   -- "X started following you"
  in_app_followed_posts   boolean NOT NULL DEFAULT true   -- generic new-post from followed
  in_app_followed_live    boolean NOT NULL DEFAULT true   -- creator-went-LIVE from followed
  push_enabled            boolean NOT NULL DEFAULT false
  email_digest_enabled    boolean NOT NULL DEFAULT false
```

**Per-creator overrides (one row per (viewer, creator) pair, written only when the viewer customises):**
```
nex_creator_notification_prefs
  account_id   uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE   -- viewer
  creator_id   uuid NOT NULL REFERENCES nex_account(id) ON DELETE CASCADE   -- followed creator
  mute_posts   boolean NOT NULL DEFAULT false
  mute_live    boolean NOT NULL DEFAULT false
  updated_at   timestamptz NOT NULL DEFAULT now()
  PRIMARY KEY (account_id, creator_id)
```

Fan-out worker evaluates in order: global defaults → per-creator overrides → final decision. Absent per-creator row = no override = global default applies.

**Owner-authorised 2026-10-30 example — "mute Hendra's posts, keep his LIVE alerts":**

```
Dewi follows Hendra.
Dewi opens Hendra's profile → notification settings → toggles:
  · "Posts" OFF
  · "LIVE" ON (unchanged from default)

Writes to nex_creator_notification_prefs:
  (account_id=Dewi, creator_id=Hendra, mute_posts=TRUE, mute_live=FALSE)

Fan-out behaviour from this point:
  · Hendra publishes a music track → fan-out worker checks Dewi's prefs
    → mute_posts=TRUE → notification suppressed · no in-app row written,
       no push, no email.
  · Hendra goes LIVE → fan-out worker checks Dewi's prefs
    → mute_live=FALSE → notification delivered as `live-started-by-followed`
       → §15 Live Alert banner surfaces for Dewi.

This decoupling is foundational — a follow relationship is not a single
all-or-nothing notification firehose. Viewers curate what matters per
creator per kind.
```

The follow relationship itself is untouched by this preference (Dewi is still a follower, still counted in Hendra's `followers_count`, still visible in his followers list subject to §5.2 privacy). Only the notification delivery changes.

### 8.6 · Creator preferences
```
nex_account additions
  notify_followers_on_publish   boolean NOT NULL DEFAULT true
```

Hendra can toggle "notify my followers when I publish" OFF (defaults ON). Opt-OUT model — creators generally want their followers notified; power users may want quiet mode for drafts/beta content.

---

## 9 · Feed integration (Stage 3)

### 9.1 · Follow signal in the main feed
`listNexFeedEntries` (current interleave reader) extended:
- Accept `viewerAccountId` input.
- For each candidate entry, compute `is_followed = EXISTS (SELECT 1 FROM nex_follow WHERE follower_id = viewer AND followee_id = entry.owner_account_id AND approved_at IS NOT NULL)`.
- Boost `is_followed` entries in the ordering: proposal `boost_factor = 1.5` on an existing engagement-weighted score, OR interleave 1-followed-entry-per-3-non-followed if no score exists.

Numbers are placeholders. Must be measured + tuned post-launch. Owner-decided §10 D8.

### 9.2 · Dedicated "Following" feed (optional, Stage 3)
New route `/nex-native/nex-feed/following` — chronological feed of ONLY posts from followed creators. No interleave.

Decision point: ship Following tab or just the signal boost? See §10 D9.

### 9.3 · Mutual-follower surfaces (Stage 3)
On any profile page: "You both follow Alice, Bob, Carol". Query:
```sql
SELECT a.*
FROM nex_follow f1
JOIN nex_follow f2 ON f1.followee_id = f2.followee_id
JOIN nex_account a ON a.id = f1.followee_id
WHERE f1.follower_id = <viewer>
  AND f2.follower_id = <profile_owner>
LIMIT 3;
```

Cached per `(viewer, profile_owner)` tuple.

### 9.4 · Follow recommendations (Stage 3)
"You might like" surfacing. Algorithms (proposal order):
1. **Friends-of-friends** — accounts followed by people you follow, not already followed by you.
2. **Co-engagement** — accounts liked/shared by people with similar engagement patterns.
3. **Topic affinity** — if NEX gains topic tags, recommend topic matches.

Pure proposal. Tunable + revisit after Stage 1+2 data arrives.

---

## 10 · Open decisions (owner-only, gating implementation)

| ID | Decision | Default proposal | Status |
|---|---|---|---|
| D1 | Ship `account_privacy = 'approve' \| 'private'` in Stage 1 or defer? | Default `public` ships Stage 1; approve/private shipped Stage 2 | **DECIDED · §16** |
| D2 | Default `followers_list_visibility` | `public` | **DECIDED · §16** |
| D3 | Rate-limit numbers (follows/60s, unfollow-churn/24h, mass-follow threshold) | 20/60s · 3/24h · 50/5min flag | **DECIDED · §16** |
| D4 | Pending-follow-request expiry | 14 days | **DECIDED · §16** |
| D5 | Creator fan-out rate limit | 10 events/hour | **DECIDED · §16** |
| D6 | Push notification channel (FCM/APNS/Web Push, which service) | Deferred to Stage 2 gate | **DECIDED · §16** |
| D7 | Email digest channel (Postmark or similar, hourly or daily) | Deferred to Stage 2 gate | **DECIDED · §16** |
| D8 | Feed boost weight for followed-creator content | `1.5×` on engagement score | **DECIDED · §16** |
| D9 | Separate `/nex-feed/following` tab vs ranking signal only | Signal only in Stage 3 initial, tab deferred | **DECIDED · §16** |
| D10 | Delete-cascade on account removal — preserve audit trail of past follows? | CASCADE (clean + GDPR-friendly) | **DECIDED · §16** |
| D11 | Follow source attribution — persist `source` column or drop? | Persist (analytics value, zero query cost) | **DECIDED · §16** |
| D12 | Which NEX surfaces ship Follow in Stage 1? | Music + Live + Profile; Directory + Business deferred to Stage 2 | **DECIDED · §16** |
| D13 | **Business follow identity** — does a NEX business inherit the owner's follow graph, or does each business get its own independent follow identity? | **Each NEX business has its own independent follow identity.** Personal and business followers remain separate · following Hendra personally does NOT automatically follow Hendra-the-Coffee-Shop · unfollowing one does NOT affect the other. Implementation: businesses that need a follow identity are represented in `nex_follow.followee_id` by the business's own `nex_account.id` (either because the business itself is already represented as an account row, or by introducing a dedicated identity resolution later). Avoids the ambiguity of "unfollowing Hendra also unfollows his shop" and preserves clean semantics across personal vs commercial relationships. | **DECIDED · §16** |

---

## 11 · Tests + migration requirements

### 11.1 · Required migrations (sealed-authorisation-gated)
| Migration | Purpose | Gate |
|---|---|---|
| `nex_follow` table + PK + CHECK + FKs + RLS | Stage 1 persistence | Owner seal + offline window |
| `nex_account` + columns `followers_count` / `following_count` / `account_privacy` / `followers_list_visibility` / `following_list_visibility` / `follower_count_hidden` | Stage 1 counters + privacy | Owner seal (adds columns · no data migration risk) |
| Triggers on `nex_follow` for counter maintenance | Stage 1 atomic counters | Owner seal |
| `nex_block` table + RLS | Stage 1 foundational | Owner seal |
| `nex_notification` table + indexes + unique on (recipient, dedup_key) | Stage 2 | Owner seal |
| `nex_notification_prefs` table | Stage 2 | Owner seal |
| `nex_device_token` table (if push ships) | Stage 2+ | Owner seal + channel decision §10 D6 |

All migrations drafted first, applied only after owner authorises the specific offline window.

### 11.2 · Required tests (gated before each stage ships)

**Stage 1:**
- Follow idempotency (double-tap → one row, one counter increment)
- No self-follow (CHECK + action guard both tested)
- Unfollow correctness (row deleted, counter decrements, no orphan state)
- Concurrent follow race (10 parallel followActions on same pair → final state = 1 row + 1 counter)
- Concurrent follow/unfollow interleave (follow then unfollow then follow in rapid succession → consistent final state)
- Block → prevents follow (both directions)
- Block → auto-removes existing follow (both directions)
- Pending-request lifecycle (follow private account → pending → approve/reject each verified)
- Pagination cursor stability (new follow during pagination → doesn't duplicate or skip rows)
- Counter reconciliation job (simulated drift → job restores accurate counts)
- Rate limit enforcement (N+1 follows in 60s → rejected)

**Stage 2:**
- Follow fires `follow` notification (in-app row exists; dedup_key correct)
- Unfollow suppresses pending notification (if delivered already, stays delivered; if queued, dropped)
- Fan-out on music publish → every follower receives `content-posted-by-followed-music` notification
- Fan-out respects muted_creator_ids
- Fan-out respects `notify_followers_on_publish = false` creator preference
- Push delivery (when channel is sealed) — tested end-to-end with a real device
- Email digest batching (when channel is sealed)

**Stage 3:**
- Followed-creator entries rank higher in `listNexFeedEntries` (measured on real data)
- Mutual-follower surface returns correct intersections, respects privacy, respects blocks
- Recommendations don't surface already-followed, muted, or blocked accounts

### 11.3 · Observability
Required metrics (SLOs tracked from Stage 1):
- Follow action P95 latency
- Fan-out job queue depth + consumer rate
- Notification delivery success rate per channel
- Counter drift incidents detected by reconciliation job (should trend to zero)

---

## 12 · Surface integration points (one Follow, many surfaces)

| Surface | Follow affordance | Followed data read |
|---|---|---|
| Music feed slide | `MusicActionsStack` Follow icon (non-owner view only) | Boosts followed creators' music in feed |
| Live viewer | `LiveViewerFooter` Follow icon | Boosts followed creators' live sessions |
| Profile page `/nex-native/profile/[handle]` | Primary Follow / Following button | Powers followers/following counts, lists, mutuals |
| Directory listing | "Follow this business" (if business maps to a `nex_account`) | Boosts followed businesses in directory results |
| Socials | Follow suggestions in invite flow (optional, Stage 3) | Suggests users who follow mutuals |
| Business page | "Follow this business" primary CTA | Powers business audience + updates notifications |

Every surface MUST import from a single `src/lib/nex-native/follow/*` module. No duplicated server-action implementations.

Component contract (sealed at implementation gate):
```
followAction({ followeeId: NexUuid; source: NexFollowSource }): Promise<NexFollowResult>
unfollowAction({ followeeId: NexUuid }): Promise<NexFollowResult>
isFollowingAction({ followeeId: NexUuid }): Promise<NexFollowStateResult>
listFollowersAction({ accountId, cursor?, limit? }): Promise<NexFollowListResult>
listFollowingAction({ accountId, cursor?, limit? }): Promise<NexFollowListResult>
```

---

## 13 · Explicit non-actions (as of this doctrine's writing)

- **No application code modified.**
- **No SQL migration file drafted or applied.** Table list in §11.1 is specification only.
- **No notification system scaffolded.**
- **No existing hold overridden.** Vault LOCKED, Live R9 contract DRAFT, Music Publishing Locks SEALED, Main Feed Constitution DRAFT, Chat Master Layout SEALED — all preserved.
- **No surface's current Follow stub replaced.** `MusicActionsStack.onFollow` remains session-only until Stage 1 is sealed + implemented.
- **No commit, no push, no deploy.**

---

## 14 · Review protocol

This doctrine is reviewable at any time. Any change to the architecture, the stage breakdown, the pending decisions in §10, or the test requirements in §11 is made by appending to or replacing this document and dating the change. Doctrine supersedes conversation. Conversation does not supersede doctrine.

If any later request asks for Follow implementation incompatible with this doctrine, that request must either be read as a doctrine amendment (explicit) or declined pending clarification.

All 18 architectural decisions (D1–D13 + D15-1 through D15-5) were resolved and recorded in **§16 · Owner-Signed Decisions — 2026-10-30**. The architecture is sealed.

The next authorisation gate — before any code — is for the owner to:
1. Review the Stage 1 implementation plan (not yet drafted · to be prepared on separate request).
2. Review the Stage 1 migration bundle SQL (not yet drafted).
3. Review backup + rollback arrangements for the production Supabase project.
4. Authorise the Stage 1 execution + offline window.

Only then does implementation begin. §16 does NOT grant implementation authorisation.

---

## 15 · NEX LIVE Alert UI Specification

Owner directive 2026-10-30 — *"make the LIVE alert feel like a genuine invitation to enter another person's world. It should be noticeable and exciting, but never obstruct Dewi's current activity."* This section specifies the floating banner surfaced when a followed creator starts a live broadcast. Architecture only · no implementation authorised.

### 15.1 · Scope + relationship to notifications

The LIVE Alert banner is a **UI surface** that renders when the recipient has an unread, unexpired `live-started-by-followed` notification (per §8.2). The notification itself is created by the fan-out worker when a followed creator begins a broadcast. The banner is one of multiple destinations that same notification may surface in (the others being: the in-app notification bell list, future push, future email digest).

The banner is NOT a separate notification kind — it is a rendering of the existing kind, chosen for its urgency relative to the recipient's current activity.

### 15.2 · Trigger conditions

The banner surfaces when ALL of the following are true:
- Recipient has an unread `live-started-by-followed` notification.
- The referenced live session is still active (server confirms `session.ended_at IS NULL`).
- The recipient has NOT dismissed this specific session's banner in the current session.
- The recipient's `in_app_followed_live` preference is TRUE (§8.5 global default).
- The recipient's per-creator override `mute_live` for this creator is FALSE (§8.5 per-creator).
- The recipient is not currently inside that same live session (would be redundant).
- The recipient has not blocked the creator (and the creator has not blocked the recipient).

If any condition flips while the banner is visible, the banner MUST disappear immediately (e.g., Hendra ends his live → banner removed from Dewi's screen within one subscription tick).

### 15.3 · Visual anatomy

The banner is a horizontal pill-shaped floating card. Design intent: premium, inviting, confident — "come into my world" not "notification alert."

```
┌──────────────────────────────────────────────────────────┐
│  [●] [Hendra avatar]   Hendra is LIVE now           ○ ✕  │
│                        Live Music · Join the broadcast   │
└──────────────────────────────────────────────────────────┘
     ↑  ↑               ↑                                ↑
     │  │               │                               Dismiss
     │  │               Title area · bold line + sub-line
     │  Creator avatar · circular · 44 × 44 · thin rim
     Animated LIVE pulse (red dot · 1200 ms heartbeat)
                                                       ↑
                                              Round VIEW button
                                              (circular, cyan or theme
                                              accent, 44 × 44, chevron
                                              or play-glyph)
```

Required visual elements (left → right):
1. **Animated LIVE pulse indicator** — small red dot with 1200ms heartbeat (same tempo as the sealed NEX presence rim pulse — doctrine `feedback_nex_avatar_presence_rim_not_dot` applies: NO corner dots on avatars, but the LIVE pulse here is a status glyph *beside* the avatar, not on it).
2. **Creator avatar** — the actual `nex_account_profile.avatar_url`. Circular, 44 × 44, thin 1.5px white rim. Fallback: initial-letter puck (sealed convention) when the URL is null.
3. **Line 1** — `{display_name} is LIVE now` — 14px, weight 800, white.
4. **Line 2** — `{category or title} · Join the broadcast` — 11px, weight 500, dim. Category is the broadcast's declared category (e.g. "Live Music", "Food", "Fashion") when the live session carries one; otherwise just "Join the broadcast".
5. **Round VIEW button** — circular, 44 × 44, filled with the viewer's active theme accent (default NEX cyan `#00AFFF`). Contains a chevron-right or play-triangle glyph. The button IS the primary CTA — oversized relative to text weight so it reads as "the way in".
6. **Dismiss control (✕)** — small, top-right of the banner. 24 × 24 tap target. Transparent background, white glyph at 60% opacity so it doesn't compete with View.

### 15.4 · Positioning + layering

- **Position**: `fixed`, anchored to the bottom of the viewport, ABOVE the NEX footer / primary navigation.
  - On surfaces with the sealed bottom nav: banner sits at `bottom: calc(nav-height + safe-area-inset-bottom + 10px)`.
  - On full-bleed surfaces without the bottom nav (feed music slide, live viewer, etc.): banner sits at `bottom: calc(safe-area-inset-bottom + 10px)`.
- **Width**: `calc(100% - 24px)` with `max-width: 440px`, centered horizontally.
- **z-index**: must sit ABOVE the NEX footer and ABOVE in-page floating UI (actions stacks, up-next banners, description panels) but BELOW full-screen modals (library overlay, message panel, keypad). Proposed value: `60` (above shell chrome z=20–28, below modal chrome z=100+).
- **Enter animation**: slide-up from below the fold + fade-in · 240ms · `cubic-bezier(0.22, 1, 0.36, 1)`.
- **Exit animation**: fade + slide-down · 180ms · ease-in.

**Explicit non-obstruction rules:**
- Banner MUST NOT cover the primary content area (video, music player, chat composer).
- Banner MUST NOT replace or hide the sealed NEX footer / bottom nav — it sits above it, both visible.
- When the viewer is already inside a live session: banner is suppressed (per §15.2 trigger).
- When a sealed full-screen overlay opens (MusicLibraryOverlay, MessagePanel, sheet dialogs): banner remains behind the overlay (z-stack ordering) — it does not fight for attention.

### 15.5 · Theme compatibility

The banner uses the sealed NEX design tokens so it adapts to the active app theme:
- Font: `NEX_FONT_SANS` (sealed design-token rule 2026-10-17).
- Avatar rim + text colour: inherits from `theme.ink` / `theme.inkDim` so a theme with cyan-blue palette and a theme with warm-amber palette both read correctly.
- View button fill: `theme.accent` (fallback `#00AFFF`).
- Banner background: `rgba(2, 9, 20, 0.82)` + `backdrop-filter: blur(14px) saturate(140%)` — a dark glass that holds its own against any wallpaper the active theme paints behind it.

The banner MUST NOT ship with hard-coded theme colours that defy the sealed design-token rule. If a theme switch happens while the banner is visible, the banner re-paints with the new theme on the next render (no cached stale colours).

### 15.6 · Session-ID preservation + destination

The notification payload (`§8.2 live-started-by-followed`) carries:
```
{
  recipient_id,
  kind: 'live-started-by-followed',
  payload: {
    poster_id,
    session_id,         ← specific live-session UUID
    broadcast_title,    ← optional
    broadcast_category, ← optional (e.g., 'music', 'food', 'fashion')
  },
  dedup_key: sha256(kind + poster_id + session_id)
}
```

The VIEW button MUST navigate to the exact session's URL:
```
/nex-native/live-commerce/{session_id}
```

NOT to:
- The creator's generic profile.
- The creator's main feed slide.
- A list page.
- A re-rendered feed.

The dedup_key includes `session_id`, so a creator who ends and restarts a broadcast generates a DIFFERENT notification + a fresh banner (not a resurrection of the dismissed previous one).

### 15.7 · Dismiss semantics

- **User taps ✕** → banner animates out · a `dismissed_session_ids: Set<string>` is tracked in the recipient's client state for the session. That specific session's banner does NOT reappear in the same browser session.
- **User taps VIEW** → navigate to the live session URL · banner removed · in-app notification marked `read_at = now()` server-side.
- **Session ends (server event)** → fan-out emits a `live-ended-by-followed` or similar signal (NEW event kind, specified below) · all clients subscribed to the recipient's notification stream remove the banner for that session.
- **Dismissed banners for ENDED sessions** are not retained — the client's `dismissed_session_ids` can purge sessions it knows ended.
- **Across browser sessions / app relaunch**: a dismissed banner stays dismissed if the server-side notification is marked `read_at` (opt-in behaviour on dismiss — see §15.10 open items). Otherwise it may reappear next launch. Owner-decided per §15.11 D15-1.

### 15.8 · Multiple simultaneous live creators

When ≥ 2 followed creators are live at the same time, the banner surface MUST handle the queue without stacking multiple full banners over each other (would violate the non-obstruction rule).

**Design: single-banner-with-queue-indicator.**
```
┌──────────────────────────────────────────────────────────┐
│  [●] [Hendra]   Hendra is LIVE now              ○  ‹2› ✕ │
│                 Live Music · Join the broadcast          │
└──────────────────────────────────────────────────────────┘
                                                   ↑
                                              Queue chip · "‹2›"
                                              Tap → opens a bottom
                                              sheet listing ALL live
                                              followed creators, each
                                              with the same banner
                                              layout for selection.
```

- Only ONE banner renders in the floating slot at any time.
- The banner shows the MOST RECENT live-start first.
- A small circular chip to the left of ✕ shows the count of OTHER live creators (`‹2›` means 2 others besides the current one).
- Tapping the chip opens a bottom-sheet modal (`LiveCreatorsSheet`) listing every currently-live followed creator. Each row uses the same visual layout as the banner. Tapping a row = navigate to that creator's live session.
- Dismissing the main banner (✕) advances to the next in the queue (the queue chip's count decrements). If dismiss empties the queue, the banner surface disappears entirely.

### 15.9 · Lifecycle events (server-side)

The LIVE Alert lifecycle requires THREE server-side events, generated by the sealed live-session subsystem (`src/lib/nex-native/live-broadcast/*`):

| Event | When | Notification kind emitted |
|---|---|---|
| `live.started` | A creator's live session transitions to active (sealed `startLiveSessionAction` in the existing R9 Eligibility Contract) | `live-started-by-followed` fan-out to all followers |
| `live.ended` | A creator's live session ends (manual end, timeout, heartbeat death) | `live-ended-by-followed` fan-out (same follower list) OR a cheaper subscription signal that clients clear the banner for session_id. Owner-decided §15.11 D15-2 |
| `live.heartbeat-stale` | Session's `last_heartbeat_at` ages past the sealed threshold | Server marks session ended, same cleanup as `live.ended` |

The notification architecture (§8) MUST subscribe to these events. The LIVE Alert UI MUST subscribe to the clear-signal so the banner disappears without the viewer needing to dismiss manually.

### 15.10 · Honest terminology distinction (owner directive 2026-10-30)

> *"A creator going live automatically generates a LIVE NOW notification. Do not falsely describe this as a personal invitation. Use 'Hendra has invited you to join' only when Hendra actually sends Dewi a direct invitation."*

The LIVE Alert banner MUST use:
- `{Name} is LIVE now` — automatic fan-out alert · default.
- `{Name} invited you to join` — ONLY when the server records a direct invite (sealed Live invite flow via `createFriendRequestAction` or an equivalent live-session-specific invite). This string MUST NOT appear on an automatic fan-out banner.

The data layer MUST distinguish the two paths. The banner UI selects copy based on a `source: 'fanout' | 'direct-invite'` discriminator in the notification payload.

### 15.11 · Open decisions (owner-only, LIVE Alert sub-set)

| ID | Decision | Default proposal | Status |
|---|---|---|---|
| D15-1 | On dismiss (✕), does the server-side notification get marked `read_at` so the banner stays dismissed across app relaunches? | YES — dismiss = acknowledged · stays dismissed across devices/sessions until the session ends or a new session starts. | **DECIDED · §16** |
| D15-2 | On session-end, emit a per-follower `live-ended-by-followed` notification row, OR a lightweight realtime signal that only clears the banner without creating a notification row? | Realtime signal only (no notification row — "X ended their broadcast" is noise). | **DECIDED · §16** |
| D15-3 | Maximum simultaneously-live followed creators to surface in the queue sheet before pagination | 20 | **DECIDED · §16** |
| D15-4 | Banner auto-expire if NOT dismissed and the live session is still active, after how long? | Never auto-expire while live is active · only session-end dismisses it. | **DECIDED · §16** |
| D15-5 | When the recipient is actively engaged (typing in chat composer, in call, keypad open), should the banner suppress itself temporarily? | YES · suppress during active composer/call/keypad · re-surface when the user exits those surfaces. | **DECIDED · §16** |

### 15.12 · Component contract (sealed at implementation gate)

```
<LiveAlertBanner>
  // Subscribes to the viewer's live-alert stream (notifications +
  // real-time session-end signals). Mounts globally once (likely in
  // the sealed root layout or a dedicated provider), NOT per-page.
  // Renders null when there is no eligible banner to show.
</LiveAlertBanner>

<LiveCreatorsSheet>
  // Bottom sheet listing all currently-live followed creators.
  // Opened by tapping the queue chip in LiveAlertBanner.
  // Each row navigates to the specific live session URL.
</LiveCreatorsSheet>
```

Mount point: a global root (sealed `app/nex-native/layout.tsx` or a dedicated `LiveAlertProvider` under it) so the banner is available on every NEX surface. No per-page re-wiring.

### 15.13 · Explicit non-actions

- No LiveAlertBanner component built.
- No LiveCreatorsSheet component built.
- No subscription to live-session events wired.
- No notification payload shape changed beyond the specification above.
- No modification to the sealed Live Eligibility Contract (R9) · the LIVE Alert consumes its events, it does not alter its gates.
- No code shipped. This section is pure specification.

---

## 16 · Owner-Signed Decisions — 2026-10-30

**Status:** OWNER AUTHORISATION RECORDED · architectural decisions sealed · implementation NOT yet authorised.
**Date:** 30 October 2026
**Scope:** All 18 architectural decisions (D1–D13 primary + D15-1 through D15-5 LIVE Alert sub-set).

### 16.1 · Scope of this authorisation

This section records the owner's consolidated decision set for the NEX Follow architecture. It **does NOT**:

- Authorise production deployment.
- Authorise database migration execution.
- Alter any existing sealed decision (Vault LOCKED · Live R9 contract DRAFT · Music Publishing Locks SEALED · Main Feed Constitution DRAFT · Chat Master Layout SEALED · all preserved).
- Bypass any other NEX authorisation gate (CLAUDE.md §4–§7).
- Permit application code, migrations, or storage changes based on this signoff alone.

It **does**:

- Fix the architecture against which the Stage 1 implementation plan will be drafted.
- Lock the decisions below as the single source of truth for subsequent review.
- Record the rationale so future reviewers see what was approved and why.

### 16.2 · Decision table — all 18, as signed

| ID | Decision | Owner authorisation (2026-10-30) |
|---|---|---|
| **D1** | Approve-mode / private accounts in Stage 1? | **Public accounts in Stage 1.** Approval/private account functionality deferred to a separately authorised stage. |
| **D2** | Default `followers_list_visibility` | **Public by default**, with an opt-in hide option available to the account owner. |
| **D3** | Rate-limit numbers | **20 follows per 60 seconds.** · **50 follows per 5 minutes → abuse flag for investigation.** · **3 unfollows per 24 hours → suspicious-churn monitoring, NOT automatic blocking.** The 3/24h signal must surface in moderation observability without rejecting the user's action. |
| **D4** | Pending-follow-request expiry | **14 days**, applied only when approval mode (D1 Stage 2+) is introduced. |
| **D5** | Creator fan-out rate limit | **Maximum 10 publishing-notification fan-out events per hour per creator.** This caps notification fan-out only · the creator remains free to publish without restriction. |
| **D6** | Push notification provider | **Deferred to its own authorisation gate.** No provider choice (FCM / APNS / Web Push) made here. |
| **D7** | Email provider + digest cadence | **Deferred to its own authorisation gate.** No provider or cadence choice made here. |
| **D8** | Feed boost weight for followed-creator content | **No fixed boost assigned.** Engagement data must be collected and measured before any ranking weight is adopted. |
| **D9** | Separate `/nex-feed/following` tab vs ranking signal only | **Ranking signal only initially.** Dedicated Following tab deferred. |
| **D10** | Delete-cascade on account removal | **CASCADE hard-delete** of follow relationships on account deletion, subject to applicable legal retention requirements for other records. |
| **D11** | `source` column on `nex_follow` | **Keep.** Source attribution retained for discovery-path analytics. |
| **D12** | Stage 1 surfaces | **Music + Live + Profile.** Directory and Business deferred to a later authorised stage. |
| **D13** | Business follow identity | **Separate.** Every NEX business has an independent follow identity. Personal and business follow relationships remain separate. Following Hendra personally does NOT auto-follow his business; unfollowing one does NOT affect the other. |
| **D15-1** | Dismiss persistence | **YES.** Dismissing a LIVE alert marks the corresponding notification as acknowledged/read. Dismissal persists across reloads and devices for that specific live session. A new live session (new `session_id`) generates a new alert. |
| **D15-2** | End-signal design | **Realtime live-ended signal only.** Do NOT create a per-follower `live-ended-by-followed` notification row. |
| **D15-3** | Queue cap | **20 simultaneously-live followed creators** shown in the queue sheet, with pagination or further-results affordance beyond. |
| **D15-4** | Auto-expire while active | **Never auto-expire while a valid live session remains active.** This acceptance is conditioned on the hardening requirements in §16.3 below (heartbeat, stale-session detection, cleanup, reconnection recovery) — never-expiring must not mean a broken banner lingers forever. |
| **D15-5** | Active-composer suppression | **YES.** Suppress the LIVE banner while the recipient is actively typing in a chat composer, in a call, or using the keypad. Resurface when the conflicting activity ends, provided the live session is still active AND the alert has not been dismissed. |

### 16.3 · D15-4 refinement — hardening requirements (owner-added)

Owner-authorised 2026-10-30. "Never expire while active" is conditioned on the following guarantees. Any Stage 1/2 implementation plan touching the LIVE Alert surface MUST specify how each is met:

1. **Valid active session** — banner only renders when `nex_live_session.ended_at IS NULL`. A row with `ended_at` set MUST never surface a banner.
2. **Server-side heartbeat monitoring** — the sealed Live R9 contract's `last_heartbeat_at` field is the authority. A session whose heartbeat has aged past the sealed threshold is treated as ended.
3. **Stale-session detection** — a background worker (or on-read health check) MUST transition heartbeat-stale sessions to `ended_at = now()`. The LIVE Alert MUST subscribe to that transition.
4. **Automatic removal on end** — when a session ends (manual, heartbeat timeout, or server-side kill), all clients subscribed to the recipient's notification stream MUST clear the banner for that `session_id` within one subscription tick. §15.9 server-side event design governs the signal.
5. **Reconnection recovery** — when the recipient's device reconnects after being offline, the client MUST reconcile its banner state with the server: any session that ended during the offline window is cleared; any still-active session that qualifies may re-surface. No stale cached banners after reconnection.

These are enforcement conditions on the D15-4 default. The Stage 2 implementation plan must demonstrate each.

### 16.4 · Rationale notes (owner-provided)

- **D1 Public Stage 1** — avoid complicating the first release.
- **D2 Public with hide-option** — supports creator discovery while respecting privacy.
- **D3 Churn as signal, not block** — detect abuse without unnecessarily blocking legitimate users. Explicit distinction between enforcement (reject-the-action) and observability (flag-for-review).
- **D4 14 days** — sensible expiry if approval mode arrives.
- **D5 10 fan-outs/hour** — prevents creator notification spam, without restricting publishing itself.
- **D6 / D7 defer** — each is a separate authorisation gate.
- **D8 No fixed boost** — measure actual engagement before introducing ranking weights.
- **D9 Signal only initially** — dedicated Following tab can come later once data justifies.
- **D10 CASCADE** — avoid retaining identifiable follow relationships after deletion, subject to legal.
- **D11 Keep source** — useful attribution for understanding where discovery happens.
- **D12 Music + Live + Profile** — focused initial rollout; other surfaces follow once proven.
- **D13 Separate business identity** — personal account and its business must have independent followers; preserves clean semantics as NEX becomes a connected ecosystem rather than eight disconnected apps.
- **D15-1 Persistent dismissal** — Dewi shouldn't be repeatedly interrupted by the same live session.
- **D15-2 Realtime signal only** — no unnecessary notification saying a broadcast has ended.
- **D15-3 20 then pagination** — good balance between visibility and usability.
- **D15-4 Never expire while active** — don't close the invitation while Hendra is still broadcasting · with §16.3 hardening requirements as non-negotiable preconditions.
- **D15-5 Suppress during active activity** — respect Dewi's current interaction.

### 16.5 · Architectural principles preserved

The owner-stated three-layer separation is preserved in the sealed architecture:

- **One follow relationship.** `nex_follow(follower_id, followee_id)` with primary-key idempotency (§3.1). Dewi follows Hendra once, not per surface.
- **Independent notification preferences per kind per creator.** Global defaults (`nex_notification_prefs`) + per-creator overrides (`nex_creator_notification_prefs`) delivered via the fan-out worker (§8.5). A viewer can mute one creator's posts while retaining their LIVE alerts.
- **Separate business follow identity.** D13 above · personal and business audience graphs remain independent.

### 16.6 · Stage 1 scope (as sealed by D12)

| Surface | Follow affordance in Stage 1 | Reads from `nex_follow` in Stage 1 |
|---|---|---|
| Music feed slide | ✅ | ✅ (followers count on creator profile · boost signal deferred to Stage 3) |
| Live viewer | ✅ | ✅ |
| Profile page `/nex-native/profile/[handle]` | ✅ (primary CTA) | ✅ (followers/following counts + lists subject to D2 privacy) |
| Directory listing | ❌ Stage 2+ | ❌ Stage 2+ |
| Business page | ❌ Stage 2+ (separate business identity per D13) | ❌ Stage 2+ |
| Socials | Stage 3 (follow suggestions in invite flow) | Stage 3 |

### 16.7 · Outstanding dependencies before Stage 1 implementation

To be delivered on a **separate authorised request** before any Stage 1 build:

1. **Stage 1 implementation plan** — concrete file-level change list for the 3 surfaces (Music + Live + Profile), tests to add, acceptance criteria.
2. **Stage 1 migration bundle (SQL draft)** — `nex_follow` · `nex_block` · `nex_account` column additions (counters + visibility + privacy flags) · triggers · RLS policies. Reviewed line-by-line before any `psql -f` is run against production.
3. **Backup + rollback arrangements** — Supabase snapshot before migration · explicit rollback SQL · dry-run against a staging schema.
4. **Observability plan** — the SLOs listed in §11.3 (follow P95 latency, fan-out queue depth, counter drift) must have dashboards/alerts specified before Stage 1 code lands.
5. **D15-4 hardening demonstration** — before Stage 2 LIVE Alert implementation, concrete design for the five §16.3 guarantees (heartbeat monitoring design · stale-session worker · reconciliation on reconnect).

Nothing in §16 permits any of the above to be built without its own owner authorisation.

### 16.8 · Explicit non-actions as of §16 recording

- **No application code modified** in this amendment.
- **No database migration drafted or applied.**
- **No storage files created.**
- **No sealed decision altered.**
- **No implementation permission granted.** §16 fixes the architecture · it does NOT authorise Stage 1 execution.
- Decision table status columns (§10, §15.11) flipped from `Pending` → `DECIDED · §16` — this is a status mark pointing at the authorisation record, not a build trigger.
- §14 updated to reflect that the architectural decision gate is now closed and the Stage 1 implementation gate is the next required authorisation.

### 16.9 · Freeze + amendment protocol

This section is **frozen** against drive-by edits. Any change to a D1–D13 or D15-1 to D15-5 decision after 2026-10-30 is a doctrine amendment requiring:

1. A new dated subsection (e.g. §16.10, §16.11) recording the amendment reason + the owner's explicit re-authorisation.
2. The original §16.2 row preserved verbatim with a footnote referencing the amendment.
3. The amendment must be signed off in the same consolidated format used here.

Silent drift from §16 is prohibited.

---

**End of §16 · Owner-Signed Decisions.** Architecture sealed. Awaiting separate Stage 1 implementation authorisation.

