# NEX Follow · Stage 1 · Implementation Preparation · DRAFT

**Status:** DRAFT — preparation only · **NO IMPLEMENTATION AUTHORISED · NO MIGRATION APPLIED · NO CODE WRITTEN.**
**Date:** 30 October 2026
**Scope:** The five Stage 1 deliverables required by `nex-follow-architecture-draft-2026-10-30.md` §16.7, prepared under the architecture sealed in §16.
**Boundary:** This document specifies *how* Stage 1 would be built if authorised. It does not build it, run SQL against any database, or alter any sealed decision.

Cross-references:
- Architecture + owner decisions · `nex-follow-architecture-draft-2026-10-30.md` (sealed §16)
- Live R9 Eligibility Contract · `nex-live-eligibility-contract-2026-10-27.md`
- Stale-session policy · `src/lib/nex-native/live-broadcast/stale-session-policy.ts`
- Sealed Supabase project ref · `ijvqdvsvwtwxzcqmoqit`

---

## 0 · Pre-work · conflict verification against sealed state

Before any implementation plan is actionable, Stage 1 must demonstrate that it does NOT cross any sealed line. Verification pass against the memory bank + current repo state:

| Sealed hold | Interaction with Stage 1 Follow | Verdict |
|---|---|---|
| Vault LOCKED (2026-10-20) | No shared schema, no column overlap, no entitlement intersection. Follow has nothing to do with Vault storage. | ✅ No conflict |
| Live R9 Eligibility Contract (DRAFT 2026-10-27) | Stage 1 Follow reads live-session IDs via already-public `nex_live_session`. Does NOT modify R9 gates, broadcaster eligibility, viewer caps, or publish paths. The LIVE Alert in Stage 2 CONSUMES Live events; Stage 1 doesn't surface the alert. | ✅ No conflict (Stage 1) · deferred verification in Stage 2 |
| Music Publishing Design Locks (SEALED 2026-10-30) | Migration 236 (nex_music_active_slot) is drafted but NOT applied. Migration 237 (ack table) not drafted. Follow Stage 1 picks migration numbers 237+ which would re-collide — Stage 1 must either renumber or wait for 236/237 apply decision. Flagged below (§6.1). | ⚠️ Numbering collision · resolution required before SQL draft is finalised |
| Main Feed Constitution (DRAFT 2026-10-30) | Stage 1 does NOT touch feed ranking. Stage 3 would (D8 open-ended / no boost chosen). No overlap. | ✅ No conflict |
| Chat Master Layout (SEALED 2026-10-14) | Follow has no composer/header interaction. | ✅ No conflict |
| Universal Image Doctrine (2026-10-30) | Avatars rendered by Follow surfaces reuse the sealed signed-URL + Class-A classification already in use. No new image sites. | ✅ No conflict |
| Design-token rule (SEALED 2026-10-17) | FollowButton MUST use `NEX_FONT_SANS` + sealed ping-badge dimensions. Specified in Deliverable 1. | ✅ No conflict (enforced in spec) |
| NEX avatar presence RIM rule (SEALED 2026-10-29) | Follow surfaces displaying avatars continue using RIM-based presence, never corner dots. | ✅ No conflict |
| Pending-invite privacy (SEALED 2026-10-23) | Follow is a public social signal (per D2 default). Pending-INVITE privacy is separate (Socials invite flow). Follow row visibility gated by D2. | ✅ No conflict |
| Business Centre not in nexapp (2026-10-28) | D13 separate business follow identity. Stage 1 excludes business per D12. | ✅ No conflict |
| D12 scope (Music + Live + Profile) | Directory + Business surfaces explicitly NOT in Stage 1. Stage 1 touches only these three. | ✅ Confirmed |
| D13 separate business identity | Stage 1 does not create a business follow identity (deferred with Business surface). | ✅ Confirmed |

**Sealed-state verdict:** Stage 1 can proceed without altering any sealed decision IF the migration numbering collision with Music Publishing 236/237 is resolved (see §6.1).

---

## 1 · Deliverable 1 · Detailed implementation plan

### 1.1 · New files to create

```
src/lib/nex-native/follow/
├── types.ts                           // NexFollow* types + result discriminator
├── follow-repository.ts               // DB layer (nexSupabaseAdmin wrappers)
├── follow-actions.ts                  // Server actions (10 total)
├── follow-rate-limit.ts               // Rate limiter + churn signal
├── follow-session.ts                  // viewer-session resolution (reuses resolveSessionWithDevOverride)
└── __tests__/
    ├── follow-repository.test.ts
    ├── follow-actions.test.ts
    ├── follow-rate-limit.test.ts
    └── follow-concurrency.test.ts     // race/idempotency

src/components/nex-native/follow/
├── FollowButton.tsx                   // Shared primitive used by Music + Live + Profile
├── FollowersCountChip.tsx             // Small count display (optional in Stage 1)
└── __tests__/
    └── FollowButton.test.tsx
```

**No new storage files outside Supabase.** All persistence lives in the sealed Supabase project (`ijvqdvsvwtwxzcqmoqit`). No dev-FS JSON store for Follow — the architecture spec §16.1 explicitly rules out ad-hoc storage.

### 1.2 · Types (`follow/types.ts`)

```ts
export type NexFollowSource =
  | "music" | "live" | "profile" | "directory"
  | "socials" | "business";

export type NexFollowState = "not-following" | "pending" | "following";

export interface NexFollowRow {
  readonly follower_id: string;
  readonly followee_id: string;
  readonly created_at: string;
  readonly source: NexFollowSource | null;
  readonly approved_at: string | null;        // D1 Stage 2+ (reserved column)
}

export interface NexBlockRow {
  readonly blocker_id: string;
  readonly blocked_id: string;
  readonly created_at: string;
}

export type NexFollowErrorCode =
  | "not-signed-in"
  | "invalid-input"
  | "self-follow"
  | "blocked"
  | "not-found"
  | "rate-limited"
  | "churn-flagged"                           // D3 suspicious-churn signal (soft)
  | "internal";

export type NexFollowResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly code: NexFollowErrorCode; readonly message: string };
```

### 1.3 · Server actions (`follow/follow-actions.ts`)

10 actions. Each follows the sealed action pattern (resolve session · validate · rate-limit · repository call · return result). Stage 1 ships 6; the remaining 4 are DEFERRED to Stage 2 (approve/reject + export + lists return reduced forms in Stage 1).

**Stage 1 — SHIP:**

| Action | Input | Output | Notes |
|---|---|---|---|
| `followAction` | `{followeeId, source}` | `{state: 'following'}` (public per D1) | Idempotent via PK · emits event for Stage 2 fan-out |
| `unfollowAction` | `{followeeId}` | `{state: 'not-following'}` | DELETE idempotent |
| `isFollowingAction` | `{followeeId}` | `{state: 'not-following' \| 'following'}` | Read-only · no side effects |
| `blockAction` | `{blockedId}` | `{ok: true}` | Also deletes any follow row in either direction |
| `unblockAction` | `{blockedId}` | `{ok: true}` | Does NOT restore prior follow rows |
| `listFollowersAction` | `{accountId, cursor?, limit?}` | `{items, nextCursor?}` | Public per D2 default · hidden if account.followers_list_visibility='private' |
| `listFollowingAction` | `{accountId, cursor?, limit?}` | `{items, nextCursor?}` | Same gates |

**Stage 2 — DEFERRED (schema reserved · action not shipped):**

| Action | Reason deferred |
|---|---|
| `approveFollowAction` | D1 Stage 2+ (approve mode) |
| `rejectFollowAction` | D1 Stage 2+ |
| `exportFollowGraphAction` | GDPR export · Stage 2 priority |
| `recomputeCountersAction` | Observability tool · Stage 2 |

Each action returns `NexFollowResult<T>`. Error codes are enumerated in §1.2. No fallback or silent failure — every unexpected error returns `{ok: false, code: 'internal', message: '...'}` with the real message visible server-side only.

### 1.4 · Repository functions (`follow/follow-repository.ts`)

Thin wrappers over `nexSupabaseAdmin` queries. One function per read/write operation. All functions `"server-only"`.

```
async function insertFollow({followerId, followeeId, source}): Promise<NexFollowRow | null>
  // Upsert via INSERT … ON CONFLICT DO NOTHING RETURNING * · returns row if NEW, null if existed
async function deleteFollow({followerId, followeeId}): Promise<boolean>
  // DELETE … RETURNING * · returns true if deleted, false if didn't exist
async function getFollowState({followerId, followeeId}): Promise<NexFollowState>
async function listFollowers({accountId, cursor, limit}): Promise<{rows, nextCursor}>
async function listFollowing({accountId, cursor, limit}): Promise<{rows, nextCursor}>
async function insertBlock({blockerId, blockedId}): Promise<boolean>
  // Also deletes follow rows in both directions in same transaction
async function deleteBlock({blockerId, blockedId}): Promise<boolean>
async function isBlocked({a, b}): Promise<boolean>   // either direction
```

### 1.5 · Rate limiting (`follow/follow-rate-limit.ts`)

Per D3 authorisation:

- **20 follows per 60 seconds per account** → `rate-limited` error, hard block.
- **50 follows per 5 minutes** → abuse flag (does NOT block action; logs to observability).
- **3 unfollows per 24 hours** → suspicious-churn signal (does NOT block action; logs for moderation review).

Implementation note: an in-memory LRU per Node instance works for Stage 1 dev; production needs a distributed store (Redis/Supabase RPC with timestamp window). The decision between in-memory vs distributed is deferred to the implementation review — flagged in §9.

### 1.6 · `FollowButton` component contract

Shared primitive. All three Stage 1 surfaces import this exact component — no per-surface duplication.

```ts
export interface FollowButtonProps {
  readonly followeeId: string;
  readonly source: NexFollowSource;
  readonly initialState?: NexFollowState;    // SSR-provided for first paint
  readonly size?: "sm" | "md" | "lg";
  readonly label?: {
    readonly follow?: string;
    readonly following?: string;
  };
  readonly onStateChange?: (state: NexFollowState) => void;
  readonly disabled?: boolean;
  readonly isSelfAccount?: boolean;          // hides button if true
}
```

Behavior:
- Not-following → shows `Follow` (filled cyan or theme accent).
- Following → shows `Following` (outlined). Tap → confirm-sheet or immediate unfollow (owner-decided in Stage 1 review).
- Self-view (`isSelfAccount === true`) → button hidden entirely (no self-follow).
- Pending (D1 Stage 2+) → shows `Requested` (disabled visual, tap = cancel request).

### 1.7 · Surface integration (file-level change list)

**A. Music surface — `src/app/nex-native/nex-feed/[videoId]/_music-viewer-client.tsx`**
- Remove: the current session-only `MusicActionsStack.onFollow` stub (follow state is now source-of-truth, not local state).
- Add: pass `followeeId={props.entry.ownerAccountId}` + `source="music"` to the actions stack.
- MusicActionsStack internal: replace the local `followed` state with `useFollowState(followeeId)` hook that calls `isFollowingAction` on mount + subscribes to local updates.
- Add: on tap, call `followAction` / `unfollowAction` + optimistic update + rollback on error.

**B. Live surface — `src/app/nex-native/live-commerce/[sessionId]/_viewer-client.tsx` + `LiveViewerFooter.tsx`**
- Audit current Follow affordance (if any — may be inside `LiveViewerFooter`'s 3-dot menu or absent).
- Add primary Follow CTA using the shared `FollowButton` primitive.
- Pass `followeeId={session.broadcaster_account_id}` + `source="live"`.

**C. Profile surface — `src/app/nex-native/profile/[handle]/page.tsx`**
- Server-render initial Follow state (so first paint is correct, not a stale "Follow" that flips on hydration).
- Mount `FollowButton` as primary CTA in the identity header.
- Below the button: `followersCount · followingCount` chip row (counts from the newly-added `nex_account.followers_count` / `.following_count` columns).
- Below counts: `listFollowersAction` lazy-loaded (optional in Stage 1 — can be deferred to Stage 2 if scope is tight).

**No other surfaces touched in Stage 1.** Directory, Business, Socials follow surfaces are per D12 deferred.

### 1.8 · Order of implementation

Strict order so partial progress leaves no broken state:

1. Draft + review all three migrations (§2) · no execution.
2. Create `src/lib/nex-native/follow/` module with types + repository + rate-limit (no server actions yet).
3. Repository tests (unit) · all green against a staging schema (or local DB).
4. Server actions implemented · action tests green.
5. Shared `FollowButton` component + its unit tests.
6. Wire into Music surface first (lowest-risk; already has a stub to replace).
7. Wire into Profile surface.
8. Wire into Live surface last (sealed R9 contract adjacency = highest care).
9. End-to-end tests across all three surfaces.
10. Observability dashboards (§4.3) populated + alerts armed.
11. Owner sign-off on acceptance criteria (§4.5) → execution authorisation requested separately.

Each step is independently reviewable. Steps 1 and 10 require explicit owner authorisation to proceed (migration apply + alert activation).

---

## 2 · Deliverable 2 · Migration SQL bundle (DRAFT · not applied)

### 2.1 · Three migrations

| # | File | Purpose | Risk |
|---|---|---|---|
| M-A | `237_nex_follow_graph.sql` (or next available · see §6.1) | `nex_follow` table + PK + CHECK + indexes + RLS | Low · new table |
| M-B | `238_nex_block.sql` | `nex_block` table + RLS | Low · new table |
| M-C | `239_nex_account_follow_counters.sql` | Add 5 columns to `nex_account` + 2 triggers + reconciliation function | Medium · ALTER on hot table, needs migration review |

All three are reversible via the rollback SQL in Deliverable 3.

### 2.2 · M-A · `nex_follow` draft

```sql
-- Migration 237 · nex_follow (DRAFT · 2026-10-30 · NOT APPLIED)
-- Owner-authorised 2026-10-30 per nex-follow-architecture-draft §16.
--
-- Doctrine (§16 D11): source column kept for discovery-path attribution.
-- Doctrine (§16 D1): no account_privacy column yet · approve-mode deferred.
-- Doctrine (§16 D10): CASCADE on account deletion.

BEGIN;

CREATE TABLE IF NOT EXISTS public.nex_follow (
  follower_id   uuid        NOT NULL REFERENCES public.nex_account(id) ON DELETE CASCADE,
  followee_id   uuid        NOT NULL REFERENCES public.nex_account(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  source        text        NULL,

  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id),
  CHECK (source IS NULL OR source IN ('music','live','profile','directory','socials','business'))
);

-- Reverse-direction lookup · "who follows me"
CREATE INDEX IF NOT EXISTS idx_nex_follow_by_followee
  ON public.nex_follow (followee_id, created_at DESC);

-- Forward-direction lookup · "who do I follow"
CREATE INDEX IF NOT EXISTS idx_nex_follow_by_follower
  ON public.nex_follow (follower_id, created_at DESC);

-- RLS · follow rows are a public social signal (D2 default public).
-- Private-visibility gating is enforced at the ACTION layer by
-- checking account.followers_list_visibility · not here.
ALTER TABLE public.nex_follow ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone authenticated can read any follow row. Action layer
-- filters results per account privacy.
CREATE POLICY nex_follow_select_all
  ON public.nex_follow
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: only the follower can create their own follow row. Block
-- check enforced at action layer (RLS cannot easily subquery nex_block
-- on INSERT with reasonable performance).
CREATE POLICY nex_follow_insert_own
  ON public.nex_follow
  FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = (SELECT auth.uid()));

-- DELETE: follower (unfollow) OR followee (remove-follower).
CREATE POLICY nex_follow_delete_participants
  ON public.nex_follow
  FOR DELETE
  TO authenticated
  USING (
    follower_id = (SELECT auth.uid())
    OR followee_id = (SELECT auth.uid())
  );

COMMIT;
```

### 2.3 · M-B · `nex_block` draft

```sql
-- Migration 238 · nex_block (DRAFT · 2026-10-30 · NOT APPLIED)
-- Owner-authorised 2026-10-30 per §16.

BEGIN;

CREATE TABLE IF NOT EXISTS public.nex_block (
  blocker_id   uuid        NOT NULL REFERENCES public.nex_account(id) ON DELETE CASCADE,
  blocked_id   uuid        NOT NULL REFERENCES public.nex_account(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

-- Hot-path · the follow action checks both directions on every follow
-- attempt.
CREATE INDEX IF NOT EXISTS idx_nex_block_by_blocked
  ON public.nex_block (blocked_id, blocker_id);

ALTER TABLE public.nex_block ENABLE ROW LEVEL SECURITY;

-- Block list is private · only the blocker can read their own rows.
CREATE POLICY nex_block_select_own
  ON public.nex_block
  FOR SELECT
  TO authenticated
  USING (blocker_id = (SELECT auth.uid()));

CREATE POLICY nex_block_insert_own
  ON public.nex_block
  FOR INSERT
  TO authenticated
  WITH CHECK (blocker_id = (SELECT auth.uid()));

CREATE POLICY nex_block_delete_own
  ON public.nex_block
  FOR DELETE
  TO authenticated
  USING (blocker_id = (SELECT auth.uid()));

COMMIT;
```

### 2.4 · M-C · `nex_account` counters + visibility + triggers

```sql
-- Migration 239 · nex_account follow counters + visibility (DRAFT · NOT APPLIED)
-- Owner-authorised 2026-10-30 per §16.
--
-- Adds five columns to the sealed `nex_account` table and the two
-- triggers that keep counters atomic with follow row writes.

BEGIN;

ALTER TABLE public.nex_account
  ADD COLUMN IF NOT EXISTS followers_count            integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count            integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS followers_list_visibility  text    NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS following_list_visibility  text    NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS follower_count_hidden      boolean NOT NULL DEFAULT false;

ALTER TABLE public.nex_account
  ADD CONSTRAINT IF NOT EXISTS nex_account_followers_visibility_chk
    CHECK (followers_list_visibility IN ('public','mutuals','private')),
  ADD CONSTRAINT IF NOT EXISTS nex_account_following_visibility_chk
    CHECK (following_list_visibility IN ('public','mutuals','private'));

-- Counter maintenance triggers · fire inside the same transaction as
-- the follow row insert/delete so counters are always consistent at
-- commit.

CREATE OR REPLACE FUNCTION public.nex_follow_counters_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.nex_account SET followers_count = followers_count + 1 WHERE id = NEW.followee_id;
  UPDATE public.nex_account SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.nex_follow_counters_on_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.nex_account SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.followee_id;
  UPDATE public.nex_account SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS nex_follow_counters_insert_trg ON public.nex_follow;
CREATE TRIGGER nex_follow_counters_insert_trg
  AFTER INSERT ON public.nex_follow
  FOR EACH ROW EXECUTE FUNCTION public.nex_follow_counters_on_insert();

DROP TRIGGER IF EXISTS nex_follow_counters_delete_trg ON public.nex_follow;
CREATE TRIGGER nex_follow_counters_delete_trg
  AFTER DELETE ON public.nex_follow
  FOR EACH ROW EXECUTE FUNCTION public.nex_follow_counters_on_delete();

-- Reconciliation RPC · owner-callable function to recompute counters
-- for drift catches. Idempotent · safe to re-run.
CREATE OR REPLACE FUNCTION public.nex_follow_recompute_counters(target_account uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF target_account IS NULL THEN
    UPDATE public.nex_account a
    SET followers_count = COALESCE((SELECT COUNT(*) FROM public.nex_follow WHERE followee_id = a.id), 0),
        following_count = COALESCE((SELECT COUNT(*) FROM public.nex_follow WHERE follower_id = a.id), 0);
  ELSE
    UPDATE public.nex_account a
    SET followers_count = COALESCE((SELECT COUNT(*) FROM public.nex_follow WHERE followee_id = a.id), 0),
        following_count = COALESCE((SELECT COUNT(*) FROM public.nex_follow WHERE follower_id = a.id), 0)
    WHERE a.id = target_account;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.nex_follow_recompute_counters(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.nex_follow_recompute_counters(uuid) TO service_role;

COMMIT;
```

**Non-trivial callouts:**
- `ADD CONSTRAINT IF NOT EXISTS` is PostgreSQL 15+ syntax; verify Supabase project version in review (fallback: `DO $$ BEGIN … EXCEPTION WHEN duplicate_object THEN NULL; END $$;`).
- Triggers use `GREATEST(x-1, 0)` to prevent negative counters even if a stray DELETE fires on a race-dropped row.
- Reconciliation RPC is `SECURITY DEFINER` + `GRANT TO service_role` only — never callable from client.

### 2.5 · Migration bundle checksum + non-applied status

All three migrations have the DRAFT header. The file comment includes:
```
-- NOT APPLIED. Awaiting owner authorisation per Follow Stage 1 implementation gate.
-- Reference: docs/doctrine/nex-follow-stage-1-implementation-plan-draft-2026-10-30.md §2
```

Draft files written to `nex-supabase/migrations/` with the DRAFT header do NOT trigger migration tooling until the DRAFT marker is removed, matching the Migration 235 convention.

---

## 3 · Deliverable 3 · Backup and rollback procedure

### 3.1 · Pre-migration backup (mandatory, in this order)

1. **Supabase project snapshot** — via Supabase dashboard · Project Settings · Database · Backups · "Create new backup". Verify snapshot timestamp + size. Record snapshot ID.
2. **Logical dump of affected tables** — `pg_dump --schema=public --table=nex_account -t ... > nex_account_pre_follow.sql`. Store on secure local disk + encrypted off-site mirror.
3. **Row counts recorded** — `SELECT COUNT(*) FROM nex_account;` saved to a plaintext log file alongside the dump. Post-migration count must match (migration doesn't delete or insert rows into `nex_account`).

### 3.2 · Dry-run against staging schema

Before any apply to the sealed Supabase project:

1. Create a disposable schema: `CREATE SCHEMA nex_follow_dryrun;`
2. Clone `nex_account` into it: `CREATE TABLE nex_follow_dryrun.nex_account AS TABLE public.nex_account;`
3. Rewrite each migration to reference `nex_follow_dryrun.*` instead of `public.*`.
4. Apply all three in order against the dry-run schema.
5. Run the test queries in §3.5 against the dry-run schema.
6. Only if all tests pass: proceed to real apply.
7. Drop the dry-run schema after: `DROP SCHEMA nex_follow_dryrun CASCADE;`

### 3.3 · Apply order + offline window

Owner-authorised offline window required (per §16.1). Proposed length: 15 minutes · ample headroom for a sub-minute migration + rollback-if-needed.

```
1 · Announce maintenance window + flip app read-only flag (if available).
2 · Snapshot (§3.1).
3 · Apply M-A (nex_follow table).
4 · Apply M-B (nex_block table).
5 · Apply M-C (nex_account columns + triggers).
6 · Run validation queries (§3.5).
7 · If any validation fails → execute rollback (§3.4) · investigate · reschedule.
8 · If all pass → remove maintenance flag.
9 · Observe metrics for 30 min (§4.3).
```

### 3.4 · Rollback SQL (one per migration)

```sql
-- Rollback 239
BEGIN;
DROP TRIGGER IF EXISTS nex_follow_counters_insert_trg ON public.nex_follow;
DROP TRIGGER IF EXISTS nex_follow_counters_delete_trg ON public.nex_follow;
DROP FUNCTION IF EXISTS public.nex_follow_counters_on_insert();
DROP FUNCTION IF EXISTS public.nex_follow_counters_on_delete();
DROP FUNCTION IF EXISTS public.nex_follow_recompute_counters(uuid);
ALTER TABLE public.nex_account
  DROP CONSTRAINT IF EXISTS nex_account_followers_visibility_chk,
  DROP CONSTRAINT IF EXISTS nex_account_following_visibility_chk;
ALTER TABLE public.nex_account
  DROP COLUMN IF EXISTS followers_count,
  DROP COLUMN IF EXISTS following_count,
  DROP COLUMN IF EXISTS followers_list_visibility,
  DROP COLUMN IF EXISTS following_list_visibility,
  DROP COLUMN IF EXISTS follower_count_hidden;
COMMIT;

-- Rollback 238
BEGIN;
DROP TABLE IF EXISTS public.nex_block CASCADE;
COMMIT;

-- Rollback 237
BEGIN;
DROP TABLE IF EXISTS public.nex_follow CASCADE;
COMMIT;
```

Rollback order is reverse of apply (239 → 238 → 237) so FK dependencies resolve cleanly. CASCADE on DROP TABLE removes dependent indexes + policies in one statement.

### 3.5 · Post-apply validation queries

Run all five queries in the staging schema (and again in production immediately after apply). Each must return the expected result.

```sql
-- V1: tables exist
SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='nex_follow') AS t1,
       EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='nex_block')  AS t2;
-- Expect: (true, true)

-- V2: columns on nex_account
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='nex_account'
  AND column_name IN ('followers_count','following_count','followers_list_visibility','following_list_visibility','follower_count_hidden')
ORDER BY column_name;
-- Expect: 5 rows

-- V3: triggers armed
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_schema='public' AND event_object_table='nex_follow'
ORDER BY trigger_name;
-- Expect: 2 rows (nex_follow_counters_delete_trg, nex_follow_counters_insert_trg)

-- V4: self-follow rejected (should raise)
BEGIN;
  INSERT INTO public.nex_follow (follower_id, followee_id)
    VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
  -- Expect: ERROR check constraint "nex_follow_check" violated
ROLLBACK;

-- V5: counter increments on insert
BEGIN;
  INSERT INTO public.nex_follow (follower_id, followee_id, source) VALUES (<test_a>, <test_b>, 'profile');
  SELECT followers_count FROM public.nex_account WHERE id = <test_b>;
  -- Expect: 1 (or prior+1 if the test accounts already have follows)
  DELETE FROM public.nex_follow WHERE follower_id = <test_a> AND followee_id = <test_b>;
  SELECT followers_count FROM public.nex_account WHERE id = <test_b>;
  -- Expect: 0 (or prior)
ROLLBACK;
```

Validation query owner-chosen test account IDs (ideally the mock personas — Dewi + Hendra). Rollback transactions ensure validation leaves no trace.

### 3.6 · Recovery runbook (if apply partially fails)

Example scenario: M-A succeeds, M-B succeeds, M-C fails mid-trigger-create.

1. Verify state: `\d+ nex_account` — are new columns present? Are triggers attached?
2. If columns added but triggers missing: run only the trigger section of M-C manually (re-execute from `CREATE OR REPLACE FUNCTION` to end).
3. If columns missing: run full M-C rollback → execute M-C fresh.
4. If both tables absent: no state to clean up, just re-execute M-A → M-B → M-C.

Any partial-failure recovery MUST be verified with the full V1–V5 query set before the maintenance window closes.

---

## 4 · Deliverable 4 · Observability + testing plan

### 4.1 · Metrics (SLOs)

| Metric | Target | Source | Alert threshold |
|---|---|---|---|
| `followAction` P95 latency | < 150 ms | Server-action timing wrapper (new, lib layer) | > 500 ms sustained 5 min |
| `followAction` error rate (excl. `rate-limited` + `self-follow`) | < 0.5% | Same | > 2% over 5 min |
| `nex_follow` row growth per hour | observe only in Stage 1 | DB query | — |
| Counter drift incidents (reconciliation RPC diffs) | 0 | Weekly reconciliation run output | Any drift > 0 → alert |
| `blockAction` latency | < 200 ms | Server-action wrapper | > 1 s sustained |
| Rate-limit hits per hour | observe only | Logs | — (data gathering for D3 tuning) |
| Churn-flag emissions per day | observe only | Logs | — (moderation observability baseline) |

### 4.2 · Dashboards

One Grafana (or Supabase-native) dashboard with four panels:
1. Follow action volume (per minute, split by action name).
2. Follow action latency P50 / P95 / P99.
3. Rate limit + churn flag counts per hour.
4. Counter drift (manual query output, daily).

Dashboard URL recorded in operational runbook before Stage 1 activation.

### 4.3 · Required tests (per step in §1.8)

**Repository layer (`__tests__/follow-repository.test.ts`):**
- insert → duplicate insert → no error, no duplicate row
- insert → delete → re-insert → counts correct
- insert with self → PK constraint violation surfaces as expected error
- listFollowers paginates correctly with cursor
- block → attempt to follow → repository rejects (via FK + action layer gate)

**Action layer (`__tests__/follow-actions.test.ts`):**
- Unauthenticated → `not-signed-in`
- Self-follow → `self-follow`
- Follow when blocked by target → `blocked`
- Follow non-existent followee → `not-found`
- Follow idempotency (call twice) → both return `{ok: true, state: 'following'}`
- Unfollow non-existent → returns `{ok: true, state: 'not-following'}` (idempotent)
- Rate limit: 21 follows in 60s → 21st returns `rate-limited`
- Churn signal: 4 unfollows of same target in 24h → 4th returns `{ok: true}` + logs churn-flagged
- Block → verify follow row (if any) auto-deleted

**Concurrency (`__tests__/follow-concurrency.test.ts`):**
- 10 parallel `followAction` on same pair → final state: 1 row, counter = prior + 1
- 10 parallel `followAction` + 10 parallel `unfollowAction` interleaved → final state deterministic (either following or not-following), counter accurate
- Trigger race: insert + concurrent select → counter visible atomic

**Component (`FollowButton.test.tsx`):**
- Default state renders correctly from `initialState`
- Tap → optimistic update → settled state matches server response
- Tap during server round-trip → disabled (no double-fire)
- Error from server → UI rolls back + error toast surfaces
- Self-view (`isSelfAccount=true`) → button not rendered

**E2E (Playwright, if infra permits):**
- Dewi loads Hendra's music slide → sees Follow button → taps → Following
- Reload page → Following state persists (confirms DB write)
- Dewi loads Hendra's profile → counter shows 1 → Dewi unfollows → counter shows 0

### 4.4 · Acceptance criteria per surface

**Music surface:**
- Following state persists across page reload.
- Counter visible to Hendra on his own profile reflects Dewi correctly.
- Tap latency measured < 300 ms end-to-end on real device.
- No console errors.

**Profile surface:**
- Server-side initial state is correct (no "Follow → flip to Following" flash on hydration).
- Counter chip shows accurate counts.
- Follower list lazy-loads correctly.

**Live surface:**
- Tap during live broadcast works without affecting video playback.
- Follow state carries across post-live viewing (follow doesn't vanish when live ends).

**Cross-surface:**
- Dewi follows Hendra from Music → opens Profile → sees Following state → unfollows → Music shows Not Following.
- Blocking test: Dewi blocks Hendra → attempts to follow → gets `blocked` error.

### 4.5 · Owner sign-off checklist (end of Stage 1)

Before Stage 1 is declared complete:
- [ ] All tests green across repository, actions, concurrency, component, E2E.
- [ ] Dashboard shows normal baseline for 48 hours of real usage.
- [ ] Zero counter drift in the first weekly reconciliation.
- [ ] No `internal` error code logged for `followAction` or `unfollowAction` during observation period.
- [ ] Rate-limit numbers (D3) validated against actual usage patterns · tuning proposal submitted if needed.

---

## 5 · Deliverable 5 · LIVE heartbeat + stale-session hardening design (prep for Stage 2)

Per §16.3, D15-4 "never auto-expire while active" is conditioned on five guarantees. This is DESIGN only — code lands in Stage 2.

### 5.1 · Guarantee 1 · Valid active session

**Already in place.** Sealed `nex_live_session.ended_at` nullable column + sealed `evaluateLiveness(session, nowMs)` pure helper (`src/lib/nex-native/live-broadcast/stale-session-policy.ts`).

The LIVE Alert banner SELECT path MUST include:
```ts
if (session.ended_at !== null) return null; // no banner
const verdict = evaluateLiveness(session, Date.now());
if (!verdict.isLive) return null; // no banner
// render banner
```

No new code — reuses the sealed primitive.

### 5.2 · Guarantee 2 · Server-side heartbeat monitoring

**Already in place.** `nex_live_session.last_heartbeat_at` sealed column + broadcaster client sends heartbeat every `HEARTBEAT_INTERVAL_MS = 15000` ms (sealed constant).

The LIVE Alert fan-out query filters on heartbeat recency:
```sql
SELECT session_id, broadcaster_id, started_at, last_heartbeat_at
FROM nex_live_session
WHERE ended_at IS NULL
  AND (last_heartbeat_at > now() - interval '90 seconds'
       OR (last_heartbeat_at IS NULL AND started_at > now() - interval '30 seconds'));
```

(90s = `STALENESS_WINDOW_MS` sealed · 30s = `STARTUP_GRACE_MS` sealed.)

### 5.3 · Guarantee 3 · Stale-session detection

**Partially in place · needs scheduling.** `evaluateLiveness` is a pure helper · it ANSWERS whether a session is stale, but does NOT WRITE `ended_at` on stale rows.

**New requirement:** a background worker (edge function / cron job / scheduled Postgres function) that runs every 60 seconds and does:
```sql
UPDATE nex_live_session
SET ended_at = COALESCE(last_heartbeat_at, started_at),
    end_reason = 'heartbeat-timeout'
WHERE ended_at IS NULL
  AND (
    (last_heartbeat_at IS NOT NULL AND last_heartbeat_at < now() - interval '90 seconds')
    OR (last_heartbeat_at IS NULL AND started_at < now() - interval '30 seconds')
  )
RETURNING id, broadcaster_id;
```

Returned rows then trigger the clear-signal fan-out (§5.4). Owner decision pending in Stage 2 planning: Supabase scheduled function vs external cron. Flagged in §9.

### 5.4 · Guarantee 4 · Automatic removal on end

When any of these fires:
- Broadcaster calls `endLiveSessionAction` (sealed).
- Heartbeat-timeout worker (§5.3) marks a session ended.
- Server-side kill (admin action, future).

→ Emit a lightweight realtime signal (per D15-2) · recipients clear banner for that `session_id`.

**Implementation path (Stage 2):**
- Supabase Realtime subscription on `nex_live_session` row updates (filter: `ended_at` transitioned from NULL to non-NULL).
- Client `useLiveAlertStream` hook subscribes · removes any banner whose `session_id` matches.
- Dedup via realtime message ID (prevents double-dispatch on reconnect).

No per-follower notification row is written (D15-2).

### 5.5 · Guarantee 5 · Reconnection recovery

When a client reconnects after offline (page reload, tab wake, lock-screen return):
1. Client fetches CURRENT state of its unread live-start notifications via `listUnreadLiveAlertsAction`.
2. Server returns only alerts whose session is CURRENTLY live (per §5.2 filter).
3. Client clears local state for any session not in that list.
4. Client renders banners for any alerts still live.

Guarantee: no "ghost banner" after offline > N minutes. Max staleness = polling interval of the realtime subscription OR the explicit reconnect fetch.

### 5.6 · Dependencies on sealed state (DO NOT BREAK)

Stage 2 LIVE Alert work MUST NOT:
- Modify `evaluateLiveness` signature or constants (sealed · pure helper).
- Change the `HEARTBEAT_INTERVAL_MS` / `STALENESS_WINDOW_MS` / `STARTUP_GRACE_MS` numbers.
- Alter the R9 Eligibility Contract broadcaster gates.
- Add viewer-side writes to `nex_live_session`.

If any of the above becomes necessary, it's a new sealed decision, not Stage 2 scope.

---

## 6 · Known conflicts + resolution requirements

### 6.1 · Migration number collision (BLOCKER)

Current state of `nex-supabase/migrations/`:
- `235_nex_music_track.sql` — DRAFT, not applied, held pending Music Publishing provider decision + Gate 3.
- `236_nex_music_active_slot_and_idempotency.sql` — DRAFT, not applied, held pending the same gate.
- `237+` — unused.

Stage 1 Follow proposes `237 / 238 / 239`.

**Owner decision required BEFORE SQL draft is finalised:**
- Option A — Reserve 237/238/239 for Follow; renumber Music migrations if they ever apply after Follow.
- Option B — Reserve 240/241/242 for Follow; leaves Music 237 gap for the authored but unapplied 236's eventual companion.
- Option C — Apply Music 235+236 first (requires separate owner authorisation), then Follow at 237.

My proposal: **Option B** (Follow uses 240/241/242). Clean skip over the Music held range. Zero coupling between the two held tracks.

### 6.2 · `nex_follow.source` CHECK list

The CHECK constraint lists six source values: `music, live, profile, directory, socials, business`. D12 confirms Stage 1 ships `music`, `live`, `profile` only. Allowing `directory`, `socials`, `business` in the CHECK before those surfaces exist is harmless (nothing writes them yet) and avoids a schema change later. Flag if the owner prefers the stricter approach of adding values only when the surfaces ship — reasoned either way.

### 6.3 · Business follow identity (D13) · deferred complexity

Stage 1 does NOT ship Business follow. But the schema MUST not preclude D13.

Current `nex_follow.followee_id` references `nex_account(id)`. For Business to have its own follow identity when it ships (Stage 2+), Business must either:
- Have a `nex_account` row of its own (business-type account), OR
- Introduce a separate `nex_followee_target` layer that abstracts over `nex_account` + `nex_business`.

Decision deferred to Business-surface implementation gate. Stage 1 schema is forward-compatible with either path.

### 6.4 · `account_privacy` column DEFERRED but reserved

Stage 1 does NOT add `account_privacy` column (D1 Stage 2+). But the ACTION layer MUST write `followAction` as if `account_privacy='public'` for every account — correct for Stage 1 and forward-compatible with Stage 2's addition of the column.

---

## 7 · Dependency graph

```
         ┌──────────────────────────────────┐
         │ Owner authorises Stage 1 exec    │
         │ (per §16.7 outstanding deps)     │
         └────────────┬─────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
   [Migration bundle]      [Code preparation]
   ▪ Snapshot              ▪ Create follow/ module
   ▪ Dry-run               ▪ Repository
   ▪ Apply 237/240         ▪ Actions
   ▪ Apply 238/241         ▪ Rate limiter
   ▪ Apply 239/242         ▪ Tests (unit)
   ▪ Validate V1-V5        │
          │                ▼
          │          [FollowButton component]
          │                │
          └───────┬────────┘
                  ▼
         [Wire Music surface]
                  │
                  ▼
         [Wire Profile surface]
                  │
                  ▼
         [Wire Live surface]
                  │
                  ▼
         [E2E tests · observability]
                  │
                  ▼
         [Owner sign-off checklist §4.5]
                  │
                  ▼
         [Stage 1 complete · Stage 2 gate opens]
```

Any arrow violation (e.g. wiring Music before migration applied) is a bug · tests catch via unavailable table.

---

## 8 · Open items that require owner input BEFORE Stage 1 execution

| # | Item | Why |
|---|---|---|
| O-1 | Resolve migration number collision (§6.1) · pick Option A/B/C | Blocks SQL draft finalisation |
| O-2 | Rate limiter storage — in-memory LRU vs distributed (Redis/Supabase RPC) (§1.5) | Multi-instance correctness · dev may differ from prod |
| O-3 | Follow tap in `Following` state — immediate unfollow or confirmation sheet (§1.6) | UX decision |
| O-4 | `nex_follow.source` CHECK list — strict (3 current surfaces) vs permissive (6 future-ready) (§6.2) | Schema evolution path |
| O-5 | Offline window length + target date (§3.3) | Operational schedule |
| O-6 | Weekly reconciliation RPC trigger — manual, scheduled, or on-demand only (§4.3) | Observability cadence |
| O-7 | Dashboard provider — Grafana, Supabase native, or other (§4.2) | Tooling choice |
| O-8 | Server-action timing wrapper — new library primitive or inline (§4.1) | Observability infra decision · may precede Stage 1 |
| O-9 | Follower list on Profile — Stage 1 or defer to Stage 2 (§1.7 C) | Scope control |

---

## 9 · Explicit non-actions as of this preparation document

- **No application code written.** No TypeScript file created or modified.
- **No SQL file written to `nex-supabase/migrations/`.** The migration SQL in §2 is specification text within this `.md` doctrine · nothing is in the migrations directory.
- **No database connection opened, no query executed** against any Supabase project.
- **No test file created.**
- **No component built.**
- **No sealed decision altered.** All §16 decisions remain as recorded.
- **No implementation permission granted.** This document fixes the HOW; owner must separately authorise execution per §16.7.
- **No external service onboarded.** No push provider, email provider, dashboard account, or monitoring tool configured.

---

## 10 · Review protocol + what happens next

This document is reviewable by the owner at any time. Changes to any of the five deliverables, the conflict verification (§0), or the open items (§8) are made by appending to or replacing this document and dating the change.

The next owner action is to review this document and either:
- Resolve the nine O-items (§8), then issue Stage 1 execution authorisation, OR
- Flag revisions required · update the document · re-review.

Stage 1 execution authorisation when it arrives MUST specify:
- Resolved values for all nine O-items.
- Approved offline window date + length.
- Explicit permission to write the SQL files + code files per §1 and §2.
- Explicit permission to apply the migration bundle per §3.
- Explicit permission to activate alerts per §4.

Nothing in this document pre-authorises any of the above.

---

**End of Stage 1 preparation.** Awaiting owner review + outstanding-item resolution + explicit execution authorisation.

---

## 11 · Architecture correction · 2026-10-30 (owner-review response)

**Status:** CORRECTION applied in response to owner review 2026-10-30. The original §0–§10 was written on an unverified assumption that Supabase was the Follow persistence target. This section records the verification evidence, corrects affected items, and classifies every Supabase-adjacent assumption as either (A) verified existing NEX convention, (B) possible option requiring owner approval, or (C) incorrect assumption to be removed.

**Nothing in §0–§10 was deleted** — all original text is preserved as the historical record. Where this §11 contradicts §0–§10, §11 is authoritative.

### 11.1 · Persistence architecture — verified

**Three distinct persistence surfaces exist in NEX's actual repository state:**

| Surface | Location | What it holds | Status |
|---|---|---|---|
| **Standalone NEX Supabase** · `ijvqdvsvwtwxzcqmoqit` | migrations live at `nex-supabase/migrations/` (232 files, highest number 236) | `nex_account` · `nex_business` · `nex_product` · chat · music · live · social-adjacent primitives (`nex_friend_edge`, `nex_friend_request`) · themes · ledger | Sole DB of record for consumer tables per sealed CLAUDE.md §8 (2026-10-12) |
| **Local nex_dev Postgres** · `localhost:5433` | Referenced by `src/lib/nex/db/` + `NEX_POSTGRES_URL` env var | Directory canonical layer (`nex.business_canonical` etc.) · brain/memory tables · business-trial service | Dev/local only. CLAUDE.md explicitly flags that this is "DEVELOPMENT ONLY · must never be assumed to replicate automatically". |


**Evidence of the standalone-repo scoping:**
- `C:/Users/Victus/nexapp/deploy/` directory **does not exist** (verified · `[ -d deploy ] && echo exists || echo absent` → absent).
- `CLAUDE.md` lists allowed trees: `src/app/nex-native/` · `src/app/api/nex-native/` · `src/lib/nex-native/` · `src/lib/nex/` · `src/lib/llm/` · `src/middleware.ts` · `nex-supabase/migrations/`. No `deploy/`.
- `src/lib/nex-native/supabase-admin.ts` header (sealed 2026-09-24): *"NEX-native services require the authoritative NEX Supabase project · not the legacy thenetworkers substrate."*
- `src/lib/nex-native/cross-db-reconciler/` exists as a module — proving NEX has an established pattern for cross-DB reconciliation where it is needed, but ALSO proving that cross-DB complexity is non-trivial and avoided where not required.

### 11.2 · Follow persistence target — verified

**Follow belongs in the standalone NEX Supabase project (`ijvqdvsvwtwxzcqmoqit`), in the `nex-supabase/migrations/` track.** Rationale:

1. **Identity authority.** `nex_account` is defined in `nex-supabase/migrations/001_nex_migration_history_and_account.sql` and is the sealed identity anchor per Identity Doctrine. Follow references `nex_account.id` as both follower and followee. Cross-DB FKs are not supported by Postgres · Follow must live where the identity rows live.
2. **Sealed constitution.** CLAUDE.md §8 (2026-10-12) explicitly names Supabase as *"the sole database of record for the live NEX application · consumer tables (nex_account, nex_business, nex_product, auth, storage, chat, themes)…"* Follow is a consumer table.
3. **Existing precedent.** The friend-graph primitive — `nex_friend_edge` (migration 025) + `nex_friend_edge_blocked` (034) + `nex_friend_request` (215) + `nex_friend_request_intro_note` (220) — already lives in `nex-supabase/migrations/`. Follow follows the same social-graph pattern and belongs on the same track.
4. **No cross-DB dependency created.** All three Stage 1 surfaces (Music / Live / Profile · per D12) operate on `nex_account.id` which is in Supabase. The entire Follow graph stays in one database. **No cross-DB foreign keys, no identity duplication.**

### 11.3 · Relationship to existing `nex_friend_edge` — distinct, non-overlapping

`nex_friend_edge` is a sealed **mutual-friendship** primitive:
- Canonical-pair design (lex-sorted `a_account_id < b_account_id` enforced by CHECK · one row per pair).
- State machine: pending → accepted / declined (requires explicit acceptance).
- Deletion is "unfriend" · symmetric.

`nex_follow` as specified is a **one-way audience-building** primitive:
- Explicit `follower_id` + `followee_id` with FK to each · no lex ordering.
- No acceptance step (per D1 Stage 1 default: public accounts) · follow is immediate.
- Deletion is "unfollow" · asymmetric.

These are **two different relationship types** modelling two different product concepts. Follow is NOT an extension of friend_edge · the two tables coexist. This is consistent with existing NEX architecture that keeps distinct relationship types in distinct tables.

### 11.4 · Migration numbering — verified correction

**Original §6.1 proposed Option B · "Follow uses 240/241/242, skipping over 237-239 as a Music gap". This proposal was based on faulty memory.**

Verified against the actual filesystem (`ls nex-supabase/migrations/ | sort | tail`):

| # | File | Status |
|---|---|---|
| 234 | `234_nex_live_jail.sql` | Applied (per b2b7296 commit log) |
| 235 | `235_nex_music_track.sql` | DRAFT · NOT APPLIED (sealed hold) |
| 236 | `236_nex_music_active_slot_and_idempotency.sql` | DRAFT · NOT APPLIED (sealed hold) |
| 237 | *(unused)* | **AVAILABLE** |
| 238 | *(unused)* | **AVAILABLE** |
| 239 | *(unused)* | **AVAILABLE** |
| 240+ | *(unused)* | available |
| 999 | `999_WIP_add_canonical_business_id_to_nex_business.sql` | WIP placeholder · unrelated |

**Corrected numbering for the Follow Stage 1 bundle:**
- **M-A** · `237_nex_follow_graph.sql`
- **M-B** · `238_nex_block.sql`
- **M-C** · `239_nex_account_follow_counters.sql`

**No collision with 235 / 236.** Those two Music migrations are DRAFTs that have never been applied; they do not occupy an "applied" slot. Follow at 237/238/239 is sequentially next. If Music 235+236 are ever authorised to apply, they slot in correctly BEFORE Follow (lower numbers apply first per migration tooling convention).

**The Option B "skip to 240/241/242" from §6.1 is withdrawn.** Numbering is 237/238/239, matching the verified authoritative migration ledger.

Open item **O-1 is RESOLVED** by this correction.

### 11.5 · Supabase-assumption re-audit · A/B/C classification

Per the owner's instruction, every Supabase-adjacent assumption in §0–§10 is reviewed and classified:

| Assumption (section where it appears) | Verification | Classification |
|---|---|---|
| Supabase migrations are the Follow persistence track (§1, §2) | Verified: `nex-supabase/migrations/` is the sealed migration track per CLAUDE.md fork-boundary + §8 constitution. 232 existing files prove the pattern. | **A · verified NEX convention** |
| Supabase RLS policies for `nex_follow` + `nex_block` (§2.2, §2.3) | Verified: every existing migration uses RLS. `025_nex_friend_edge.sql` + `034_nex_friend_edge_blocked.sql` prove the pattern for social-graph tables specifically. | **A · verified NEX convention** |
| Supabase RPC function `nex_follow_recompute_counters` (§2.4) | Verified: `SECURITY DEFINER` RPC with `GRANT TO service_role` is a sealed pattern (e.g., jail detection RPC). | **A · verified NEX convention** |
| Supabase triggers for counter maintenance (§2.4) | Verified: trigger-maintained denormalized counters are a sealed pattern across existing tables. | **A · verified NEX convention** |
| Supabase project snapshot via dashboard (§3.1) | Verified: Supabase dashboard backups are the sealed operational path for this project per CLAUDE.md §8. | **A · verified NEX convention** |
| `pg_dump` logical dumps (§3.1) | Standard Postgres tooling · not specific to Supabase. | **A · verified NEX convention** |
| Supabase service_role writes (§2 RLS policies, §1.4 repository layer) | Verified: `src/lib/nex-native/supabase-admin.ts` uses the service-role key and is the sealed path for server-side writes. | **A · verified NEX convention** |
| **Supabase Realtime subscription for live-ended signal (§5.4)** | **NOT verified.** No existing NEX surface uses Supabase Realtime in the inspected code (`src/lib/nex-native/live-broadcast/*` uses polling + REST, no Realtime channel subscriptions found). | **B · possible option requiring owner approval** |
| **Supabase scheduled functions / cron (§5.3)** | **NOT verified in the current codebase.** CLAUDE.md's memory bank also notes "Postmark cron re-classified (Vercel not deployed · not active production problem · shelve as future-deployment decision)" — scheduled jobs in NEX history have had deployment uncertainty. The §5.3 heartbeat worker scheduling needs its own gate. | **B · possible option requiring owner approval** |
| Dashboard provider — Grafana vs Supabase native vs other (§4.2) | Already flagged as open item O-7. Not an assumption · explicitly deferred. | — (open item, correctly classified) |
| In-memory LRU vs distributed rate-limiter store (§1.5) | Already flagged as open item O-2. Not an assumption · explicitly deferred. | — (open item, correctly classified) |

**No "C · incorrect assumption to be removed" entries after this audit.** The only shifts are two items reclassified from implicit-A to explicit-B (Realtime + scheduled functions), which deserve their own owner-review before being adopted.

### 11.6 · Identity-resolution design

Follow operates entirely on `nex_account.id` (UUID). No cross-DB resolution needed in Stage 1:

- Follower identity = `session.account.id` (resolved via `resolveSessionWithDevOverride()` which returns a `nex_account` row from Supabase).
- Followee identity = `nex_account.id` lookup via the existing `nexSupabaseAdmin` client.
- The entire relationship + both ends sit in the same database. No RPC bridge, no replication layer, no eventual-consistency window.

**Stage 2 (D13 Business identity):** when Business ships Follow, business entities must be resolvable to a `nex_account.id` OR a new abstraction layer must be introduced. This is a Stage 2 decision — flagged in §6.3 of this doc. For Stage 1 scope (Music / Live / Profile per D12), only personal `nex_account` identities are involved. **No cross-DB design is needed for Stage 1.**

### 11.7 · Updated LIVE heartbeat design (§5) with B-classified items

Items in §5 that touched reclassified-B territory need explicit owner-review before Stage 2 implementation. Updating:

- **§5.3 (stale-session detection worker):** the proposed options were "Supabase scheduled function vs external cron". Both are **B · possible options requiring owner approval**. The underlying need (periodic sweep for heartbeat-timeout rows) is architecturally sound · the CHOICE of scheduling mechanism is owner-gated. No change to the §5.3 pseudo-SQL · just the scheduling mechanism is deferred to its own authorisation.
- **§5.4 (automatic removal on end):** the proposed path was "Supabase Realtime subscription". This is **B · possible option requiring owner approval**. Alternative paths exist that don't require Realtime: (a) short-interval client polling of the viewer's live-alert list, (b) a server-sent-events (SSE) stream, (c) a websocket layer that NEX would need to introduce. The DECISION between these is deferred to Stage 2 authorisation.

**Neither reclassification blocks Stage 1.** Stage 1 ships Follow persistence + counters + lists · it does NOT ship the LIVE Alert UI. The B items only need resolution before Stage 2 begins.

### 11.8 · Stage 1 design re-check against real NEX architecture

Reviewed each Stage 1 proposal against the verified facts:

- **Six source files + two components (§1.1):** All within the fork-boundary allowed trees (`src/lib/nex-native/follow/` + `src/components/nex-native/follow/`). ✅ Compatible.
- **Server actions (§1.3):** Use `resolveSessionWithDevOverride` + `nexSupabaseAdmin` · match existing action pattern (e.g., `toggleMusicTrackLikeAction`). ✅ Compatible.
- **Counters (§2.4):** Trigger-maintained denormalized columns on `nex_account` · same pattern as other sealed primitives. ✅ Compatible.
- **Block integration (§2.3):** `nex_block` table with RLS · precedent in `nex_friend_edge_blocked` (migration 034). ✅ Compatible.
- **Three surfaces (§1.7):** Music + Live + Profile per D12 · all three live in `src/app/nex-native/` · fork-boundary compliant. ✅ Compatible.
- **No scope expansion:** Still Stage 1 only. Stage 2 notifications and Stage 3 feed ranking remain deferred per §16 ordering. ✅ Compatible.
- **D1–D13 + D15-1 to D15-5 preserved:** None touched by this correction. ✅ Compatible.

### 11.9 · Remaining architecture blockers (none)

After this correction:
- **O-1 (migration numbering)** → **RESOLVED** per §11.4.
- **O-2 through O-9** → unchanged, still owner-pending.
- **Two new items raised** by the Realtime + scheduled-function reclassification; both are Stage 2 concerns, not Stage 1 blockers.

New Stage 2 items (not blockers for Stage 1):

| # | Item | Scope |
|---|---|---|
| O-10 | Scheduling mechanism for the heartbeat-timeout stale-session worker (Supabase scheduled function vs external cron vs on-read lazy sweep) | Stage 2 LIVE Alert |
| O-11 | Real-time delivery channel for live-ended signal (Supabase Realtime vs SSE vs client polling) | Stage 2 LIVE Alert |

### 11.10 · Files changed by this amendment

| File | Change |
|---|---|
| `docs/doctrine/nex-follow-stage-1-implementation-plan-draft-2026-10-30.md` | Added §11 (this section). No prior sections deleted or modified · §0–§10 preserved as the historical record · §11 is authoritative where it contradicts §0–§10. |

**No other files changed.** Verified:
- No new source file (`.ts` / `.tsx` / `.js`).
- No new SQL file in `nex-supabase/migrations/`.
- No code modified in `src/`.
- No database connection opened.
- No SQL executed.

### 11.11 · Summary report (owner-requested)

**1 · Verified Follow persistence target:** standalone NEX Supabase project `ijvqdvsvwtwxzcqmoqit`, in the `nex-supabase/migrations/` track. Verified against CLAUDE.md fork-boundary + §8 Supabase constitution + the authoritative `nex_account` definition at migration 001 + the existing social-graph precedent at migrations 025 / 034 / 215 / 220.

**2 · Identity-resolution design:** both follower and followee resolve to `nex_account.id` (UUID) via the sealed `src/lib/nex-native/supabase-admin.ts` client. Entire Stage 1 Follow graph sits in one database · no cross-DB resolution needed.

**3 · Authoritative migration track + verified numbering:** `nex-supabase/migrations/`, next available numbers **237 / 238 / 239** (verified against `ls | sort | tail` and the existing 235/236 DRAFT-not-applied status). My earlier Option B (240/241/242) was based on faulty memory and is withdrawn.

**4 · Every Supabase assumption + disposition:** 9 assumptions in §0–§10 classified as **A · verified existing NEX convention**; 2 assumptions reclassified as **B · possible options requiring owner approval** (Supabase Realtime + Supabase scheduled functions); 0 assumptions classified **C · incorrect**. See §11.5 for the row-by-row table.

**5 · Remaining architecture blockers:** none for Stage 1. Two Stage-2-only items raised (O-10 scheduling · O-11 real-time delivery) — these do not gate Stage 1 execution.

**6 · Exact files changed:** one file · this doctrine. §11 appended. §0–§10 preserved verbatim. No source, SQL, DB, or configuration changes.

### 11.12 · What this correction does NOT grant

- **No implementation authorisation.** §11 is a correction + verification pass, not an execution gate.
- **No permission to write source files, migration SQL, or run SQL against any database.**
- **No alteration of any §16 decision.** All 18 remain as signed.
- **No alteration of any sealed hold** (Vault / Live R9 / Music Publishing / Chat Master / etc.).

The next required owner action is still to resolve the open items (O-2 through O-9, with O-1 now closed by §11.4), then separately authorise Stage 1 execution per §16.7 and §10 of this doc.

---

**End of §11 · Architecture correction.** Awaiting owner review of the correction + resolution of remaining O-items + explicit Stage 1 execution authorisation.

---

## 12 · Final decision resolution · 2026-10-30 (open-items pass)

**Status:** RESOLUTION applied in response to owner directive 2026-10-30. Open items O-2 through O-9 resolved against actual repository evidence. O-10 and O-11 recorded as explicitly deferred Stage 2 decisions. One quality-check finding (Q-A · block mechanism reuse) raised.

**Nothing in §0–§11 was deleted.** Where this §12 contradicts an earlier section, §12 is authoritative.

### 12.1 · Resolution evidence table

| Item | Recommended resolution | Evidence (repo path or convention) | Owner approval required | Stage 1 blocker |
|---|---|---|---|---|
| **O-2** · Rate limiter storage | **In-memory per-process LRU for Stage 1.** DB-backed production path deferred to its own Stage-2+ authorisation. | Sealed precedent: `src/lib/nex-native/music/music-rate-limit.ts` + `src/lib/nex-native/business-trial/rate-limit.ts` both use in-memory with HONEST non-production limitations documented in-header. The DB-backed production pattern exists at `src/lib/nex-native/watch-listing-rate-limit-service.ts` (referenced by `music-rate-limit.ts` as the "DRAFT §2.2 production path"). | NO | NO |
| **O-3** · Follow / unfollow tap UX | **Immediate optimistic toggle. No confirmation sheet.** On tap-when-Following, unfollow fires immediately · UI reverts if the server rejects. | Sealed like/unlike pattern at `src/components/nex-native/music/MusicActionsStack.tsx:93-100` (`handleLike` is optimistic, no confirmation). No "ConfirmUnfriend" or similar pattern exists in the codebase (verified via grep). Industry standard; NEX convention matches. | NO | NO |
| **O-4** · `nex_follow.source` CHECK list | **Strict list — Stage 1 ships `('music','live','profile')` only.** Extend via a follow-up migration when Stage 2 surfaces (directory/socials/business) ship. Use a named constraint (`nex_follow_source_known`) for easy ALTER. | Sealed enum-evolution precedent: `template_name IN ('modern-minimal')` → extended via migration to `('modern-minimal', 'warm-artisan')`. `nex_friend_edge.status` extended from 3 values → 4 via migration 034. The named-constraint pattern is used throughout (`CONSTRAINT nex_X_status_known CHECK (...)`). | NO | NO |
| **O-5** · Offline window length + date | **No user-facing maintenance window needed.** All three migrations are additive · no destructive ALTER · `ADD COLUMN ... DEFAULT ...` is metadata-only on PostgreSQL 11+ (no row rewrite) · triggers only fire on NEW `nex_follow` writes. Operational wall-clock budget: ~15 min for apply + verification. **Owner picks WHEN to run.** | Precedent in commit `b2b7296` ("Jail Phase B · migration 234 applied") and `4bfe68d` ("migrations · Group A applied to prod"): both applied without a declared maintenance window · per-migration transaction + table/view existence verification · zero downtime language in commit messages. | **YES — WHEN only** (operational scheduling; owner picks the time) | NO |
| **O-6** · Reconciliation RPC cadence | **Manual-trigger only in Stage 1.** The `nex_follow_recompute_counters(uuid)` RPC is `SECURITY DEFINER` · `GRANT TO service_role` · callable from Supabase SQL editor by the owner when drift inspection is needed. Scheduled trigger via Vercel cron deferred to Stage 2 (keeps Stage 1 scope + `vercel.json` untouched). | Vercel cron pattern exists in the repo at `src/app/api/nex-native/harvest/tick/route.ts` (CRON_SECRET-protected GET). Can be adopted in Stage 2 without architectural change. Stage 1 starts with zero follow rows · drift cannot accumulate during initial rollout. | NO | NO |
| **O-7** · Dashboard / observability provider | **Reuse the sealed `src/lib/nex/observability/` module.** No new provider onboarded. Counters via `incr()` from `counters.ts` · structured logs via `logger("nex-native.follow")` from `logger.ts`. If NEX later adopts an external dashboard, the sealed observability layer is already the integration point. | Existing module: `src/lib/nex/observability/{counters.ts, logger.ts, alert-rules.ts, correlation.ts, redact.ts, retry-buffer.ts, signals.ts, alert-evaluator.ts}`. Already consumed by `src/lib/nex/alerts/dispatch.ts` + `src/lib/nex-native/surface-health-service.ts` + `src/lib/nex-native/theme-kill-switch.ts`. | NO | NO |
| **O-8** · Server-action timing wrapper | **Use the sealed `logger()` factory inline.** No new wrapper primitive. Each action imports `const log = logger("nex-native.follow");` and emits `log.info({ action, latencyMs, outcome, viewerId })` at the end. Counter increments via `incr("nex_follow_action_ok")` / `incr("nex_follow_rate_limited")` etc. (new counter names added to `counters.ts`'s union). | Sealed convention: `src/lib/nex-native/surface-health-service.ts` and `theme-kill-switch.ts` use `logger("<dotted-name>")`. No shared `withTiming` wrapper exists · timing is inline where needed (`stress.ts` is honest that query-level latency is NOT instrumented today). | NO | NO |
| **O-9** · Follower list on Profile — Stage 1 or Stage 2 | **Count ships Stage 1. List deferred to Stage 2.** The two-number count (`followers_count`, `following_count`) is a trivial read of the new `nex_account` columns · ships with the primary profile Follow CTA. The scrollable followers/following LIST (new sheet component · pagination · D2 privacy UX · mutual-follower cross-reference) is deferred to Stage 2 so Stage 1 scope stays tight. | Profile page is already 928 lines with 6 sealed sections (`CoverPhoto / IdentityHero / InterestsPills / MutualFriends / ActionButtons / SafeTradeCard`). Adding a sheet component is slice-sized work. Precedent for deferred-list patterns elsewhere in NEX. | NO | NO |

### 12.2 · Quality-check finding · Q-A · block mechanism reuse (CORRECTION to §2.3)

**Discovered during the final quality check.** Repository evidence shows NEX already has a sealed block primitive: `nex_friend_edge.status='blocked'` (migration `034_nex_friend_edge_blocked.sql`). Semantics (verbatim from the migration):

> * status='blocked' + requested_by=X means X blocked the other party.
> * A blocked row survives across friend-remove: the canonical pair stays occupied so re-invite from either side is rejected.
> * Only the blocker (requested_by) can unblock (removes the row).

**Industry standard + user intuition:** blocking a user means blocking ALL interactions (friend request, follow, DM, mentions, etc.) — not per-feature partial blocks.

**My earlier §2.3 M-B migration proposal (standalone `nex_block` table) created a parallel block list, which fragments the user's block semantics.** This is incorrect for Stage 1.

**Correction:** **Follow Stage 1 reuses the sealed `nex_friend_edge` block primitive for enforcement.** The follow action's block check becomes:

```sql
-- Canonical pair resolution + bilateral block check
SELECT 1 FROM nex_friend_edge
WHERE a_account_id = LEAST($follower, $followee)
  AND b_account_id = GREATEST($follower, $followee)
  AND status = 'blocked';
-- Any match → reject follow (either party has blocked the other)
```

**Migration bundle shrinks from 3 → 2.** M-B (`238_nex_block.sql`) is **withdrawn**. Final Stage 1 bundle:
- **237_nex_follow_graph.sql** (unchanged)
- **238_nex_account_follow_counters.sql** (was 239; renumbered to fill the gap)

The follow action gains a block-check query against `nex_friend_edge`. The `blockAction` / `unblockAction` server actions proposed in §1.3 are **withdrawn from Stage 1** · users already have a sealed block mechanism via the friends surface. Follow does NOT ship its own duplicate block UI.

Owner approval for Q-A: **NO** · reuses sealed convention · corrects a specification error.

### 12.3 · Deferred Stage 2 items (recorded, not acted on)

Per owner directive, O-10 and O-11 are explicitly deferred to Stage 2. Neither blocks Stage 1.

| # | Item | Scope | Status |
|---|---|---|---|
| **O-10** | Scheduling mechanism for the heartbeat-timeout stale-session worker (Supabase scheduled function vs external cron vs on-read lazy sweep). Vercel cron pattern (`src/app/api/nex-native/harvest/tick/route.ts`) is available as one option. | Stage 2 LIVE Alert | DEFERRED |
| **O-11** | Real-time delivery channel for live-ended signal (Supabase Realtime vs SSE vs client polling). No existing NEX surface uses Realtime (verified §11.5). Owner approval required before any choice. | Stage 2 LIVE Alert | DEFERRED |

### 12.4 · Final quality-check pass against all sealed state

| Check | Result |
|---|---|
| Signed architecture decisions D1–D13 preserved | ✅ No touch |
| Signed decisions D15-1 to D15-5 preserved | ✅ No touch |
| §11 storage/migration verification respected | ✅ Supabase + 237/238 (now shortened from 237/238/239 by Q-A reuse) |
| Existing friend-graph (`nex_friend_edge` + `_blocked` + `_request`) | ✅ Follow DISTINCT (one-way vs mutual) · block REUSED (Q-A) · request not involved |
| Existing block mechanism (`nex_friend_edge.status='blocked'`) | ✅ **Reused** per Q-A · no parallel table |
| Existing privacy mechanisms (profile visibility · pending-invite privacy) | ✅ No conflict · D2 `followers_list_visibility` added as new column, independent of existing profile visibility |
| Live R9 contract | ✅ Stage 1 does not touch R9 · Stage 2 LIVE Alert consumes R9 events only |
| Music Publishing migration holds (235 + 236 DRAFT · NOT APPLIED) | ✅ Follow uses 237/238 · lower numbers (235/236) remain available for Music whenever authorised |
| Vault LOCKED | ✅ No intersection |
| Chat Master Layout SEALED | ✅ No intersection |
| Universal Image Doctrine | ✅ Follow reuses existing avatar signing paths |
| Design-token rule (sealed 2026-10-17) | ✅ FollowButton specified to use `NEX_FONT_SANS` · sealed accent token |
| NEX avatar presence RIM rule | ✅ Follow surfaces reuse existing avatar rendering |
| Current working-tree changes (65 modified `src/` files from pre-existing music/feed/description session) | ✅ No overlap · pre-existing work does not touch `nex_account`, `nex_friend_edge`, follow-adjacent tables, or any file in the Stage 1 scope |
| No background process modifying the repo during this doctrine amendment | ✅ Dev server (PID 25200 on port 3008) is read-only against `src/` · writes only to `.next/` cache · verified via `find src/ -newer <doctrine-file>` returning zero results |

**No genuine conflicts found.** One scope correction landed (Q-A · block reuse).

### 12.5 · Final Stage 1 implementation scope (post-resolution)

**Migrations (DRAFT · NOT applied · live only as specification text in §2 of this doc + §12.2 correction):**

| File | Purpose | Verified number |
|---|---|---|
| `nex-supabase/migrations/237_nex_follow_graph.sql` | `nex_follow` table + PK + CHECK + source enum (`'music','live','profile'`) + indexes + RLS policies | 237 |
| `nex-supabase/migrations/238_nex_account_follow_counters.sql` | 5-column additions to `nex_account` + 2 triggers + `nex_follow_recompute_counters` RPC | 238 |
| ~~`nex-supabase/migrations/239_nex_block.sql`~~ | **WITHDRAWN per Q-A · reuse sealed `nex_friend_edge` block** | — |

**Source files (to create during Stage 1 execution · zero created in this preparation phase):**

```
src/lib/nex-native/follow/
├── types.ts                           // NexFollowRow + NexFollowSource ('music'|'live'|'profile') + NexFollowState + NexFollowResult<T> discriminator
├── follow-repository.ts               // DB layer: insertFollow / deleteFollow / getFollowState / listFollowers / listFollowing / isBlocked (reads nex_friend_edge)
├── follow-actions.ts                  // 5 Stage 1 server actions (follow/unfollow/isFollowing/listFollowers/listFollowing) · uses nexSupabaseAdmin
├── follow-rate-limit.ts               // In-memory LRU per O-2 · matches sealed music-rate-limit.ts pattern
├── follow-observability.ts            // Thin wrapper · imports logger() + incr() from sealed observability module per O-7/O-8
└── __tests__/
    ├── follow-repository.test.ts
    ├── follow-actions.test.ts
    ├── follow-rate-limit.test.ts
    └── follow-concurrency.test.ts

src/components/nex-native/follow/
├── FollowButton.tsx                   // Shared primitive · immediate optimistic toggle per O-3 · uses NEX_FONT_SANS + sealed accent token
├── FollowersCountChip.tsx             // Two-number count display per O-9 · reads nex_account.{followers_count,following_count}
└── __tests__/
    └── FollowButton.test.tsx

src/lib/nex/observability/counters.ts  // ADD counter names only · no new file · per O-7/O-8:
  //   nex_follow_action_ok
  //   nex_follow_action_rate_limited
  //   nex_follow_action_blocked
  //   nex_follow_action_self_follow
  //   nex_follow_action_internal_error
  //   nex_follow_churn_flagged
  //   nex_follow_counter_drift
```

**Action layer deltas (per O-3 UX + per Q-A block reuse):**

| Action | Shipped Stage 1 | Notes |
|---|---|---|
| `followAction({followeeId, source})` | ✅ | Returns `{state:'following'}` · idempotent via PK · optimistic UI on client |
| `unfollowAction({followeeId})` | ✅ | Immediate (no confirmation sheet per O-3) |
| `isFollowingAction({followeeId})` | ✅ | Read-only |
| `listFollowersAction({accountId,cursor?,limit?})` | ✅ (API shipped) | Count visible on Profile · scrollable LIST deferred Stage 2 per O-9 |
| `listFollowingAction({accountId,cursor?,limit?})` | ✅ (API shipped) | Same |
| ~~`blockAction` / `unblockAction`~~ | **WITHDRAWN** | Per Q-A · reuse sealed `nex_friend_edge` block mechanism · no duplicate action |
| `approveFollowAction` / `rejectFollowAction` | Deferred Stage 2 | D1 approve-mode deferred |
| `exportFollowGraphAction` | Deferred Stage 2 | GDPR export · low urgency |
| `recomputeCountersAction` | Not shipped as action | SQL-callable only per O-6 |

**Surfaces wired (per D12):**
- Music feed slide — replace stub `onFollow` in `MusicActionsStack` with real action
- Live viewer — add `FollowButton` next to broadcaster chip
- Profile page — primary CTA + `FollowersCountChip`

**Three surfaces · nothing else · per sealed D12.**

### 12.6 · Remaining owner-only decisions after this pass

| # | Decision | Scope |
|---|---|---|
| **E-1** | Operational wall-clock time to run the migration apply + code deploy. Owner picks a low-traffic window. No user-facing maintenance required (per O-5). | Stage 1 execution scheduling |
| **E-2** | Explicit Stage 1 execution authorisation naming (a) commit of this doctrine · (b) agreement with Q-A block reuse · (c) acceptance of all O-2 through O-9 resolutions. | Stage 1 execution gate |

**That is the entire remaining owner surface for Stage 1.** All O-items were resolvable from repository evidence except E-1 (scheduling) and E-2 (final gate).

### 12.7 · Explicit non-actions as of §12 recording

- **Zero source files** created or modified. No `.ts` / `.tsx` / `.js` file touched this round.
- **Zero SQL files** created in `nex-supabase/migrations/`. The 237/238 drafts remain specification text in §2 + §12.2 of this `.md` only.
- **Zero DB connections** opened.
- **Zero `vercel.json` edits.**
- **Zero `package.json` edits** (no new dependencies).
- **No external provider onboarded** (dashboard, push, email, etc.).
- **No sealed decision altered.** §16 of the architecture doc remains the sole authority on D1–D13 + D15-1 to D15-5.
- **No background shell is modifying the repo** · dev server at PID 25200 writes only to `.next/` cache · verified `find src/ -newer <doctrine-file>` returns zero results. Dev server state is safe for Stage 1 execution when authorised.

### 12.8 · Freeze + review protocol for §12

§12 is **frozen** against drive-by edits. Any change to a resolution in §12.1, to the Q-A correction in §12.2, to the deferred items in §12.3, or to the final scope in §12.5, is a doctrine amendment requiring:
1. A new dated subsection (e.g. §12.9, §12.10) recording the amendment reason + the owner's re-authorisation.
2. The original resolution preserved verbatim with a footnote referencing the amendment.

Silent drift from §12 is prohibited.

### 12.9 · Files changed by this amendment

- `docs/doctrine/nex-follow-stage-1-implementation-plan-draft-2026-10-30.md` — appended §12 (this section). §0–§11 preserved verbatim. §12 is authoritative where it supersedes earlier sections (notably: migration bundle 237/238, not 237/238/239; block reuse via `nex_friend_edge`, no standalone `nex_block` table).

**No other files changed.** Verified via `git status` scope + file-mtime audit.

---

**End of §12 · Final decision resolution.** Awaiting owner's E-1 (apply time) + E-2 (Stage 1 execution authorisation).

---

## 13 · Final pre-execution consistency check · 2026-10-30

**Status:** FINAL consistency check applied in response to owner directive 2026-10-30. Addresses six items raised in review of §12. Supersedes earlier text where contradicted.

**No research re-done.** Only consistency corrections based on the already-verified facts in §11 + §12.

### 13.1 · O-9 consistency — list actions deferred too (CORRECTION)

**Owner finding is correct.** §12.5 shipped `listFollowersAction` + `listFollowingAction` while deferring the scrollable list UI. That builds server-side functionality with no Stage 1 consumer.

**Audit of Stage 1 Follow consumers:**

| Potential Stage 1 consumer | Needs listFollowers/Following? |
|---|---|
| `FollowersCountChip` on Profile | NO · reads `nex_account.followers_count` / `.following_count` columns directly via SSR data fetch |
| `FollowButton` on Music / Live / Profile | NO · calls `followAction` / `unfollowAction` / `isFollowingAction` only |
| Server-render initial Follow state on Profile | NO · uses `isFollowingAction` only (single-pair lookup) |
| Mutual-follower surface | Stage 3 only (per §9.3 of this doc) |
| Follow suggestions in Socials | Stage 3 only |
| Admin / observability tooling | NOT in Stage 1 scope · SQL-direct reads sufficient for debugging |

**Confirmed: no Stage 1 consumer for `listFollowersAction` / `listFollowingAction`.**

**Correction:** both actions **withdrawn from Stage 1**. Deferred to Stage 2 (when the scrollable list UI ships). Stage 1 server-action surface shrinks from 5 → **3**:

| Shipped Stage 1 | Deferred Stage 2+ |
|---|---|
| `followAction` | `listFollowersAction` (deferred with list UI) |
| `unfollowAction` | `listFollowingAction` (deferred with list UI) |
| `isFollowingAction` | `approveFollowAction` / `rejectFollowAction` (D1 approve-mode) |
|  | `exportFollowGraphAction` (GDPR, low urgency) |
|  | `recomputeCountersAction` (SQL-only in Stage 1) |

The `follow-repository.ts` module may still expose `listFollowers` / `listFollowing` helpers if trivial · they are callable from the Stage 2 action layer when authorised. But the ACTIONS do not ship Stage 1.

### 13.2 · Block integration — exact semantics + both-direction tests

**Verified sealed semantics** (from `nex-supabase/migrations/025_nex_friend_edge.sql` + `034_nex_friend_edge_blocked.sql`):

- **Canonical pair:** `a_account_id < b_account_id` (lex-sorted UUIDs). Enforced by `CONSTRAINT nex_friend_edge_canonical CHECK (a_account_id < b_account_id)`.
- **One row per pair:** `PRIMARY KEY (a_account_id, b_account_id)`.
- **Block initiator:** `requested_by` column names the account that blocked the other.
- **Block is bilateral at pair level:** any row with `status='blocked'` for the canonical pair blocks ALL interaction between the two accounts (friend request, re-invite, and — per Q-A reuse — follow).
- **Block survives friend-remove:** blocked row persists so re-invite is rejected.
- **Only blocker can unblock:** DELETE is restricted to `requested_by`.

**Follow block-check query (exact SQL · evaluated per followAction call):**

```sql
SELECT 1
FROM nex_friend_edge
WHERE a_account_id = LEAST($follower, $followee)
  AND b_account_id = GREATEST($follower, $followee)
  AND status = 'blocked'
LIMIT 1;
```

- Single primary-key lookup. O(1).
- Does NOT inspect `requested_by` — the direction of the block is irrelevant for follow enforcement. If a block row exists for the pair, follow is rejected regardless of who initiated.
- Returns 1 row (any row) → followAction returns `{ok: false, code: 'blocked'}`.
- Returns 0 rows → follow permitted (subject to other gates).

**Required tests (both directions · all four permutations):**

| Test ID | Setup | Follow attempt | Expected result |
|---|---|---|---|
| B-1 | Dewi has blocked Hendra (`requested_by = Dewi`) | `followAction` called by Dewi targeting Hendra | `{ok: false, code: 'blocked'}` |
| B-2 | Dewi has blocked Hendra (`requested_by = Dewi`) | `followAction` called by Hendra targeting Dewi | `{ok: false, code: 'blocked'}` |
| B-3 | Hendra has blocked Dewi (`requested_by = Hendra`) | `followAction` called by Dewi targeting Hendra | `{ok: false, code: 'blocked'}` |
| B-4 | Hendra has blocked Dewi (`requested_by = Hendra`) | `followAction` called by Hendra targeting Dewi | `{ok: false, code: 'blocked'}` |
| B-5 | No block row for pair | `followAction` called by Dewi targeting Hendra | `{ok: true, state: 'following'}` |
| B-6 | Both parties have `status='accepted'` friend row | `followAction` called by Dewi targeting Hendra | `{ok: true, state: 'following'}` (follow is independent of friendship state) |

**All four block permutations (B-1 through B-4) MUST return `blocked`** regardless of (a) which party is the follower, (b) which party initiated the block. This is enforced by the canonical-pair query above.

**Known Stage 1 limitation (documented honestly):** if a `nex_follow` row ALREADY exists when a block is subsequently created, the pre-existing follow row survives. The follow row does NOT auto-delete on block creation because that would require modifying the sealed `nex_friend_edge` block flow (owner approval required). **Stage 2 addition proposal (not shipped Stage 1):** add a trigger on `nex_friend_edge` INSERT that deletes matching `nex_follow` rows in both directions when `status='blocked'`. For Stage 1, the limitation is: new follows are blocked correctly · pre-existing follows persist · operational cleanup via a one-off SQL for owner.

**Follow does NOT modify `nex_friend_edge` in any way.** Stage 1 only READS the block table.

### 13.3 · Counter integrity — concrete tests + expected results

Per the owner directive: "A correct Follow relationship with an incorrect follower count is not an acceptable result."

**Required tests (`__tests__/follow-concurrency.test.ts` + `__tests__/follow-repository.test.ts`):**

| Test ID | Scenario | Expected result |
|---|---|---|
| **C-1 · Atomicity** | Inside one transaction: INSERT nex_follow (A→B), then SELECT followers_count FROM nex_account WHERE id = B | `followers_count = prior + 1` within the same tx · trigger fires AFTER INSERT, in-transaction |
| **C-2 · Rollback atomicity** | BEGIN; INSERT nex_follow (A→B); ROLLBACK; SELECT followers_count FROM nex_account WHERE id = B | `followers_count = prior` · trigger side-effects also rolled back |
| **C-3 · Concurrent follow (same pair)** | 10 parallel calls to `followAction({A → B})` from 10 threads | Final state: 1 nex_follow row · B.followers_count = prior + 1 · A.following_count = prior + 1 · 9 of the 10 calls receive `{ok: true}` via ON CONFLICT no-op path · trigger fires exactly once |
| **C-4 · Concurrent follow + unfollow (interleaved)** | 10 parallel `followAction` + 10 parallel `unfollowAction` on same pair, interleaved randomly | Final state is deterministic: either row exists or doesn't · counters match (if row exists → +1 vs prior · if not → 0 vs prior) · never double-counted, never negative |
| **C-5 · Account deletion CASCADE** | DELETE FROM nex_account WHERE id = A (where A has 5 followers + follows 3 others) | All 8 nex_follow rows involving A deleted via CASCADE · counters on affected OTHER accounts decrement by exactly 1 each · A's own row gone |
| **C-6 · Duplicate protection** | Two sequential calls to `followAction({A → B})` from the same session | First call: `{ok: true, state: 'following'}`, counter +1 · Second call: `{ok: true, state: 'following'}` (ON CONFLICT no-op), counter unchanged |
| **C-7 · Counter floor** | Manually `DELETE FROM nex_follow WHERE follower_id = A AND followee_id = B` (direct SQL, bypassing action) · then another DELETE of the same (no-op) | Counter decrements by 1 on the first DELETE · second DELETE triggers the AFTER DELETE but affects 0 rows · counter unchanged · `GREATEST(x - 1, 0)` in the trigger prevents negative values even if a stray trigger fires |
| **C-8 · Manual reconciliation** | Simulate drift: `UPDATE nex_account SET followers_count = 999 WHERE id = B` (artificially wrong) · then `SELECT nex_follow_recompute_counters(B)` | Counter restored to the actual COUNT(*) of nex_follow rows where followee_id = B · reconciliation is idempotent (re-run yields same result) |
| **C-9 · Cross-account reconciliation** | `SELECT nex_follow_recompute_counters(NULL)` with simulated drift on 3 accounts | All accounts' counters restored · idempotent · completes in bounded time |

**Acceptance criterion:** all nine tests MUST pass before Stage 1 declares the counters correct. Any failure blocks the owner sign-off checklist (§4.5).

### 13.4 · Rate-limit documentation — honest limits (CORRECTION)

Explicit documentation requirement for `follow-rate-limit.ts` header and the Stage 1 execution notes:

```
// src/lib/nex-native/follow/follow-rate-limit.ts
//
// HONEST LIMITATIONS (per Stage 1 preparation §13.4):
//
//   1. PER-PROCESS ONLY. The limiter state lives in an in-memory Map
//      inside this Node process. A multi-worker deployment (e.g., two
//      Vercel instances handling the same account's requests) will NOT
//      share limiter state. Effective per-account limit under N workers
//      = N × the configured per-process limit.
//
//   2. RESETS ON RESTART. The Map is process-local. Any Node restart
//      (deployment, OOM kill, crash recovery) zeros every bucket.
//
//   3. NOT A GLOBAL ABUSE-PREVENTION GUARANTEE. This limiter is a
//      PER-PROCESS SAFETY BRAKE that catches obvious client-side loops
//      and well-behaved abuse. A determined attacker who can hit
//      multiple instances OR time their requests across restarts can
//      exceed the stated rate.
//
//   4. PRODUCTION-GRADE ENFORCEMENT is DEFERRED to Stage 2 via a
//      DB-backed `nex_follow_rate_limit` table following the sealed
//      `watch-listing-rate-limit-service.ts` pattern. Stage 2 approval
//      required.
//
// Any claim that this limiter "enforces" the D3 numbers across the
// system is incorrect. The numbers (20 follows / 60 s, etc.) are
// per-process soft caps, not global guarantees.
```

**No code change · this is the specification text to include when the file is created at Stage 1 execution.** The rate-limit numbers from D3 remain unchanged · only their characterisation is corrected to match reality.

### 13.5 · Migration + deployment order — exact sequence

Based on commit `b2b7296` (jail migration 234) + `4bfe68d` (migrations Group A) deployment conventions · adapted for the Stage 1 bundle.

**Pre-deployment (preparation window · no production impact):**
1. Author `nex-supabase/migrations/237_nex_follow_graph.sql` (file created from §2.2 spec text).
2. Author `nex-supabase/migrations/238_nex_account_follow_counters.sql` (file created from §2.4 spec text, renumbered 239 → 238 per §12.5).
3. Author `scripts/apply-migration-237.mjs` following the sealed pattern (per-migration transaction + table existence verification).
4. Author `scripts/apply-migration-238.mjs` following the sealed pattern.
5. Author source files per §12.5 scope (minus the 2 withdrawn list actions per §13.1).
6. Run full unit + integration test suite locally against a disposable schema (§3.2 dry-run).
7. Commit all of the above in ONE commit titled `follow Stage 1 · scope + migrations + source · ready for apply authorisation`.
8. Report commit SHA + diff summary to owner.

**Owner issues E-2 (execution authorisation) naming the commit SHA.**

**Deployment window (owner-chosen time per E-1 · ~15 min operational budget):**
1. Snapshot Supabase project (§3.1 Pre-migration backup, order: dashboard snapshot → `pg_dump` logical dump → row counts).
2. Run `node scripts/apply-migration-237.mjs` → verify V1 (table exists) + V3 (indexes exist) immediately.
3. If 237 verification fails → execute rollback-237 (§3.4) · abort window · investigate · reschedule.
4. Run `node scripts/apply-migration-238.mjs` → verify V2 (columns on nex_account) + V3 (triggers armed) immediately.
5. If 238 verification fails → execute rollback-238 (§3.4) · optionally rollback-237 · abort window.
6. Run V4 (self-follow rejected) and V5 (counter increments) · both must pass.
7. If all V1-V5 pass → proceed to code deploy.
8. Deploy source code (standard NEX deployment · Vercel push or equivalent).
9. Smoke test: follow Dewi → Hendra via the UI · verify count = 1 · unfollow · verify count = 0.
10. If smoke test passes → window closes.
11. Monitor dashboard for 30 min (per §4.3).

**Rollback precondition:** rollback is executable at any step 2-10 if validation fails. Steps 1 (snapshot) is a no-op · steps 2-8 have rollback-SQL in §3.4 (reverse order: 238 then 237) · step 9 smoke test failure means code deploy issue (rollback via source redeploy, not migration rollback).

**Dependency: 237 MUST be applied before 238.** Reason: 238 creates triggers on `nex_follow` which doesn't exist until 237 is applied. The sealed `apply-migration-NNN.mjs` convention enforces monotonic ordering by filename.

**No separate deployment of migrations and code.** Both go in the same window because the new source code assumes the new tables exist. Attempting to deploy code before migration = runtime errors on follow actions. Attempting to deploy migrations without code = no behavioural change, safe to defer code deploy.

### 13.6 · Final authoritative scope (post-consistency-check)

**MIGRATIONS (2 total · DRAFT · not applied):**
```
nex-supabase/migrations/237_nex_follow_graph.sql
nex-supabase/migrations/238_nex_account_follow_counters.sql
```

**APPLY SCRIPTS (2 total):**
```
scripts/apply-migration-237.mjs
scripts/apply-migration-238.mjs
```

**SOURCE FILES to create (12 files total):**
```
src/lib/nex-native/follow/types.ts
src/lib/nex-native/follow/follow-repository.ts
src/lib/nex-native/follow/follow-actions.ts
src/lib/nex-native/follow/follow-rate-limit.ts
src/lib/nex-native/follow/follow-observability.ts
src/lib/nex-native/follow/__tests__/follow-repository.test.ts
src/lib/nex-native/follow/__tests__/follow-actions.test.ts
src/lib/nex-native/follow/__tests__/follow-rate-limit.test.ts
src/lib/nex-native/follow/__tests__/follow-concurrency.test.ts
src/components/nex-native/follow/FollowButton.tsx
src/components/nex-native/follow/FollowersCountChip.tsx
src/components/nex-native/follow/__tests__/FollowButton.test.tsx
```

**SOURCE FILES to modify (4 files):**
```
src/lib/nex/observability/counters.ts        // add 7 counter names to the sealed union
src/app/nex-native/nex-feed/[videoId]/_music-viewer-client.tsx  // wire FollowButton to MusicActionsStack
src/app/nex-native/live-commerce/[sessionId]/_viewer-client.tsx // wire FollowButton on live viewer (location TBD during build)
src/app/nex-native/profile/[handle]/page.tsx // wire primary FollowButton CTA + FollowersCountChip
```

**SERVER ACTIONS shipped Stage 1 (3 total):**
```
followAction({followeeId, source})           → {state:'following'}
unfollowAction({followeeId})                 → {state:'not-following'}
isFollowingAction({followeeId})              → {state:'not-following'|'following'}
```

**WITHDRAWN from Stage 1** (per §13.1 + §12.2):
```
listFollowersAction          → Stage 2 (list UI ships then)
listFollowingAction          → Stage 2 (list UI ships then)
blockAction / unblockAction  → Reuse sealed nex_friend_edge block (Q-A)
```

**DEFERRED to Stage 2+:**
```
approveFollowAction / rejectFollowAction      → D1 approve-mode deferred
exportFollowGraphAction                       → GDPR export (low urgency)
recomputeCountersAction                       → SQL-only in Stage 1 per O-6
Stage 2 trigger: auto-delete follow on block  → §13.2 "known Stage 1 limitation"
```

**COMPONENTS shipped Stage 1 (2 total):**
```
<FollowButton>              → tap toggles immediately (no confirmation sheet per O-3)
<FollowersCountChip>        → reads nex_account.followers_count / following_count (direct SSR fetch, no server-action call)
```

**TESTS (minimum required for Stage 1 sign-off per §4.3 + §13.2 + §13.3):**
- Repository: insert/delete idempotency · pagination (if listFollowers helper included) · self-follow rejected · block-check both directions.
- Actions: all 7 error codes · idempotency · rate-limit (per-process acceptance test) · block (B-1 through B-6 per §13.2).
- Concurrency: C-1 through C-9 (§13.3) — all 9 must pass.
- Component: FollowButton render + optimistic update + rollback on server error + self-view hidden.
- E2E (optional, pending Playwright infra decision): Dewi → Hendra follow → persist across reload → unfollow → counter decrements.

**ACCEPTANCE CRITERIA for Stage 1 completion (per §4.5 + updated below):**
- [ ] All C-1 to C-9 counter integrity tests pass.
- [ ] All B-1 to B-6 block integration tests pass.
- [ ] Rate-limiter unit tests confirm per-process behaviour + honest documentation present in file header.
- [ ] Three surfaces (Music / Live / Profile) show live Follow state across page reloads.
- [ ] Observability counters increment correctly on action calls (verified by test).
- [ ] Zero `internal` error code logged for `followAction` or `unfollowAction` during 48h observation.
- [ ] No counter drift detected by manual reconciliation RPC after 7 days of real usage.
- [ ] Smoke test (Dewi follows Hendra → count = 1 → unfollow → count = 0) passes in production.

### 13.7 · Freeze + non-actions

**§13 is frozen.** Any change requires a new dated subsection + owner re-authorisation (same protocol as §12.8 and §16.9).

**Non-actions this round:**
- Zero source files created or modified.
- Zero SQL files created in `nex-supabase/migrations/` or `scripts/`.
- Zero DB connections.
- Zero sealed decisions altered (D1–D13 + D15-1 to D15-5 untouched · Q-A correction from §12.2 preserved · Follow does not modify `nex_friend_edge`).
- No background shell writing to `src/` (dev server at PID 25200 writes only to `.next/`).

### 13.8 · Remaining owner surface

**E-1** — Operational wall-clock time to run the migration + code deploy. Low-traffic window of owner's choice. No user-facing maintenance.

**E-2** — Explicit Stage 1 execution authorisation naming:
- Commit SHA of the Stage 1 commit (produced after owner authorises Pre-deployment steps 1-8 per §13.5).
- Acceptance of the §12.2 Q-A block-reuse correction.
- Acceptance of §13.1 list-actions deferral.
- Acceptance of §13.2 block-check tests (B-1 to B-6).
- Acceptance of §13.3 counter integrity tests (C-1 to C-9).
- Acceptance of §13.4 rate-limit honest documentation.
- Acceptance of §13.5 migration + deployment order.
- Acceptance of §13.6 final scope.

**Nothing else is owner-pending.** Repository evidence resolved every architecture, convention, and sequencing question. The next phase after E-1 + E-2 is Pre-deployment preparation (§13.5 steps 1-8) → owner review of commit SHA → owner's final E-2 signoff → deployment window execution.

### 13.9 · Files changed by this amendment

- `docs/doctrine/nex-follow-stage-1-implementation-plan-draft-2026-10-30.md` — appended §13 (this section). §0–§12 preserved verbatim. §13 is authoritative where contradicted.

**No other files changed.** Confirmed via scope-limited `git status` + `find src/ nex-supabase/ scripts/ -newer <doctrine-file>` returning zero results.

---

**End of §13 · Final pre-execution consistency check.** This is the last preparation gate. Awaiting owner's E-1 + E-2.
