# NEX · Country Isolation · Review Round 2 · 2026-10-31

**Scope**: single reconciled technical report answering the seven items in `NEX — OWNER REVIEW ROUND: RLS MATRIX AND EIGHT-MIGRATION PLAN` (2026-10-31). Dense SQL + policies + tests · no broad summaries · no silent additions.
**Hard boundary**: no migration applied · no push · no deployment · no destructive database change · no Chat Themes change · no sealed design-token change · no country application implementation. All ten (now eleven after this commit) commits remain local.

Companion artefacts:
- `nex-supabase/migrations/244_nex_country_column.sql` (REISSUED DRAFT)
- `nex-supabase/migrations/244_nex_country_column.rollback.sql` (NEW · guarded rollback, two phases)
- `nex-country-isolation-review-package-2026-10-31.md` (round-1 package)
- `nex-rls-policy-matrix-2026-10-31.md` (seven-gate matrix)
- `nex-99-table-classification-2026-10-31.md`
- `nex-mixed-tables-resolution-2026-10-31.md`
- `nex-migrations-244-to-248-individually-2026-10-31.md`

---

## 1 · Reconciled Git report

Captured once, authoritatively.

| Fact | Value |
|---|---|
| Repository root | `C:/Users/Victus/nexapp` |
| Remote origin fetch | `https://github.com/Philip2024394/nexapp.git` |
| Remote origin push | `https://github.com/Philip2024394/nexapp.git` |
| Current branch | `main` |
| HEAD commit | `9e9ecb50fce9fba10698f3800009d43e07c87536` |
| origin/main commit | `1ab3e0b3831de85e95440a06b0ec32f1e2ae448a` |
| Commits ahead of origin/main at report time | **10** |
| Working tree | **clean** (`nothing to commit, working tree clean` prior to this commit) |
| Staging area | empty prior to this commit |
| Background shell processes | **none** (`jobs` returned empty; no `run_in_background` tool call is active) |

### 1.1 · Complete list of local commits (origin/main..HEAD · oldest first)

```
1a1e552  NEX World Engine · Stage 1 + 4 · engine foundation + HQ integration
4016c64  NEX World Engine · Stage 5A/B/C/D · CSS-var foundation + representative wiring
d53b5dc  NEX World Engine · fix · gate check branched on wrong value
e0838dc  NEX World Engine · HQ Worlds · left-dock panel + phone-frame preview
6aec165  NEX architecture · two-apps model · review document (DRAFT · awaiting owner)
1c071f7  NEX two-apps · D-3 + D-5 + D-7 · supersede 243 · HQ desktop-only · country isolation plan
6cfd996  NEX doctrine · global content + country discovery · owner-authored directive 2026-10-31
d9c4531  NEX doctrine · CI-1..CI-8 conditions satisfied · 99-table classification · 5 mixed-tables resolution · 5 migrations individual · TD workstream
a5556ab  NEX doctrine · owner 4-safeguards amendment · RLS policy matrix · 6 scenarios
9e9ecb5  NEX doctrine · country isolation review package · Migration 244 REISSUED (4-anchor DRAFT)
```

### 1.2 · Files changed per commit

```
1a1e552
  nex-supabase/migrations/206_nex_account_hq_role.sql
  nex-supabase/migrations/243_nex_world_state.sql
  src/app/nex-native/hq/worlds/_actions.ts
  src/app/nex-native/hq/worlds/_worlds-client.tsx
  src/app/nex-native/hq/worlds/page.tsx
  src/lib/nex-worlds/world-cookie.ts
  src/lib/nex-worlds/world-registry.ts
  src/lib/nex-worlds/world-resolver.ts
  src/lib/nex-worlds/world-types.ts

4016c64
  src/app/nex-native/_world-stylesheet.tsx
  src/app/nex-native/creator/page.tsx
  src/app/nex-native/layout.tsx
  src/app/nex-native/profile/[handle]/_identity-hero.tsx
  src/app/nex-native/sign-in/page.tsx
  src/lib/nex-worlds/world-palette-css.ts

d53b5dc
  src/app/nex-native/hq/worlds/_actions.ts
  src/app/nex-native/hq/worlds/page.tsx

e0838dc
  src/app/nex-native/hq/harvest/page.tsx
  src/app/nex-native/hq/layout.tsx
  src/app/nex-native/hq/worlds/_worlds-client.tsx

6aec165
  docs/doctrine/nex-two-apps-architecture-review-2026-10-31.md

1c071f7
  docs/doctrine/nex-country-isolation-plan-2026-10-31.md
  nex-supabase/migrations/243_nex_world_state.SUPERSEDED.sql    (rename of 243_nex_world_state.sql)
  nex-supabase/migrations/244_nex_country_column.sql
  nex-supabase/migrations/245_nex_country_rls.sql
  src/app/nex-native/hq/worlds/_worlds-client.tsx
  src/app/nex-native/hq/worlds/page.tsx

6cfd996
  docs/doctrine/nex-country-isolation-plan-2026-10-31.md
  docs/doctrine/nex-global-content-and-country-discovery-2026-10-31.md
  docs/doctrine/nex-global-content-system-audit-2026-10-31.md

d9c4531
  docs/doctrine/nex-99-table-classification-2026-10-31.md
  docs/doctrine/nex-country-isolation-plan-2026-10-31.md
  docs/doctrine/nex-migrations-244-to-248-individually-2026-10-31.md
  docs/doctrine/nex-mixed-tables-resolution-2026-10-31.md
  docs/doctrine/nex-technical-debt-workstream-2026-10-31.md

a5556ab
  docs/doctrine/nex-99-table-classification-2026-10-31.md
  docs/doctrine/nex-global-content-and-country-discovery-2026-10-31.md
  docs/doctrine/nex-rls-policy-matrix-2026-10-31.md

9e9ecb5
  docs/doctrine/nex-country-isolation-review-package-2026-10-31.md
  nex-supabase/migrations/244_nex_country_column.SUPERSEDED-REISSUED.sql    (preserved as history)
  nex-supabase/migrations/244_nex_country_column.sql                        (reissued at 4-anchor scope)
```

### 1.3 · Reconciliation of prior report inconsistency

Prior report text contained the phrases "nine commits ahead" and "ten commits ahead" referring to **different points in time** (before vs after the commit being described). This was ambiguous and the owner flagged it correctly. From here on, every count statement will cite the specific commit it is "as of".

- As of `a5556ab`: **9** commits ahead of origin/main.
- As of `9e9ecb5` (current HEAD at the time this report was authored): **10** commits ahead.
- As of this commit (will be assigned on commit): **11** commits ahead.

Nothing has been amended, reset, squashed, or pushed. The ten commits visible via `git log origin/main..HEAD` are byte-identical to the ones at the time of the prior reports.

---

## 2 · Migration 244 · guarded rollback (companion file)

Owner's correct observation: dropping the four `country` columns is only trivial while every row still has `country IS NULL`. Once Migration 246 backfills, a plain `DROP COLUMN` destroys the country assignments.

### 2.1 · Companion file created this commit

`nex-supabase/migrations/244_nex_country_column.rollback.sql` · a NEW file alongside the migration · not an apply · two phases guarded by both:
- An explicit custom-setting literal that must be set via `SET LOCAL` before the DO block runs, AND
- A row-level data check that refuses the drop if any row still has a non-NULL country.

### 2.2 · Phase 1 · READ-ONLY check (always safe)

```sql
BEGIN;
SELECT 'nex_business' AS t,
       count(*) AS total,
       count(*) FILTER (WHERE country IS NULL)        AS null_country,
       count(*) FILTER (WHERE country IS NOT NULL)    AS populated_country,
       array_agg(DISTINCT country) FILTER (WHERE country IS NOT NULL) AS country_values
  FROM public.nex_business
UNION ALL  -- repeat for nex_community_zone, nex_live_session, nex_report
;
ROLLBACK;  -- read-only, never commit
```

### 2.3 · Phase 2A · DESTRUCTIVE rollback (refused when data exists)

Requires BOTH:
- `SET LOCAL app.allow_244_destructive_rollback = 'yes-i-have-no-data';`
- Zero non-NULL country values across all four anchors.

If either guard fails, the DO block raises `EXCEPTION 'Migration 244 destructive rollback REFUSED'` and the transaction aborts. Safe by default · you cannot accidentally drop populated columns.

### 2.4 · Phase 2B · DATA-PRESERVING rollback (snapshot first)

Requires BOTH:
- `SET LOCAL app.allow_244_preserving_rollback = 'yes-snapshot-first';`
- Owner authorisation naming the file.

Creates a `public.nex_country_rollback_244` snapshot table (service_role-only · RLS-locked) populated with `(anchor_table, row_id, country)` tuples before dropping the columns. The snapshot is the recovery route · a re-apply of 244 can restore country values via an UPDATE from the snapshot.

### 2.5 · Owner authorisation gate

Draft presence of this file is NOT authorisation to run. The authorisation signal is BOTH:
- Owner explicitly names `244_nex_country_column.rollback.sql` in writing, AND
- The operator sets the appropriate `app.allow_244_*` custom setting via SQL immediately before the DO block.

Without both, every rollback path is refused by the DO block.

---

## 3 · Migration 250 · correction · blocking already exists

### 3.1 · Finding

My RLS matrix doc (`nex-rls-policy-matrix-2026-10-31.md`) proposed Migration 250 to create a new `nex_account_block` table. **This was wrong.** The sealed primitive already exists:

- Migration **025** created `nex_friend_edge` with status enum `pending | accepted | declined`.
- Migration **034** (Wave B Slice 9d) extended the status enum to include `'blocked'`, with `requested_by` naming the blocker. One row per canonical pair `(a_account_id < b_account_id)`.
- Migration **237** line 19 verbatim: *"Block enforcement reuses the sealed `nex_friend_edge.status='blocked'` primitive per §12 Q-A — no parallel block table created here."*

Creating a parallel `nex_account_block` table would violate sealed doctrine. **Migration 250 is withdrawn from the proposal.** G-blocking is enforced against the existing `nex_friend_edge` table.

### 3.2 · The canonical blocking model

```sql
-- Shape (as applied by migrations 025 + 034)
nex_friend_edge (
  a_account_id   uuid NOT NULL,  -- a < b (canonical pair)
  b_account_id   uuid NOT NULL,
  requested_by   uuid NOT NULL,  -- names the blocker when status='blocked'
  status         text NOT NULL,  -- 'pending'|'accepted'|'declined'|'blocked'
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (a_account_id, b_account_id),
  CHECK (a_account_id < b_account_id),
  CHECK (status IN ('pending','accepted','declined','blocked'))
);
```

### 3.3 · Why this satisfies the owner's cross-country constraint

Owner: *"Blocking must work across Ireland and Indonesia. It should not depend on the country of the person who created the block."*

- `nex_friend_edge` is classified **G** (GLOBAL · see 99-table review §1). It carries no country column.
- A block row exists once per pair of accounts regardless of either party's country.
- If an Ireland account blocks an Indonesia account, the same row denies interaction in both deployment directions.
- The G-blocking RLS clause (see §4 below) references this table and never references `nex.app_country`. So block checks are country-agnostic by construction.

### 3.4 · The G-blocking RLS predicate (country-agnostic)

For a SELECT policy on any content/profile table where `author_account_id` is the author and `auth.uid()` is the viewer:

```sql
-- G-blocking: deny if a block edge exists between viewer and author (either direction)
AND NOT EXISTS (
  SELECT 1 FROM public.nex_friend_edge fe
  WHERE fe.status = 'blocked'
    AND (
      (fe.a_account_id = LEAST(auth.uid(), author_account_id)
       AND fe.b_account_id = GREATEST(auth.uid(), author_account_id))
    )
)
```

The `LEAST`/`GREATEST` folds (viewer, author) → canonical pair (a < b), matching the PK. One index lookup. No country column in this predicate.

### 3.5 · Side effects of a block (what the gate denies)

| Surface | Behaviour under block |
|---|---|
| Worldwide content discovery | Blocked author's content invisible to blocker (and vice-versa if the policy applies symmetrically — recommended) |
| Profile visibility | Blocked user's profile returns 404 to blocker · same table of `nex_account_profile` with G-blocking gate on the SELECT policy |
| Messaging + invitations | Insert into `nex_message`, `nex_peer_message`, `nex_friend_request`, `nex_bridge99_first_send_intent` denied by WITH CHECK that joins to `nex_friend_edge` where status='blocked' |
| Live interactions | `nex_live_participation` INSERT denied for blocker↔broadcaster pair; viewer cannot join a stream of a user who has blocked them (and the broadcaster's business is not visible under SELECT) |
| Business + creator interactions | Business viewer is the blocker → business invisible via business.owner_account_id check in SELECT · business viewer is blocked by owner → same |
| Existing relationships + follows | A `blocked` row supersedes any `accepted` row (the status enum is single-valued per pair · if a blocked row exists, by construction no accepted row does; existing accepted follows via `nex_follow_graph` must be filtered out at read time by the G-blocking join on the follower graph) |

### 3.6 · Private block list

Users must not read other users' block lists. The RLS SELECT policy on `nex_friend_edge` restricts rows where `status='blocked'` to:
- The blocker (`requested_by = auth.uid()`), or
- The blocked party (so the UI can show "you were blocked by X" if we expose it — currently we don't; see §3.7).

Service role bypasses for HQ moderation.

```sql
ALTER TABLE public.nex_friend_edge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_friend_edge FORCE ROW LEVEL SECURITY;

-- (existing policies for pending/accepted/declined remain; this one is additive for 'blocked')
CREATE POLICY nex_friend_edge_blocked_select_restricted ON public.nex_friend_edge
  FOR SELECT TO authenticated
  USING (
    status <> 'blocked'
    OR auth.uid() = a_account_id
    OR auth.uid() = b_account_id
  );
```

Without membership in the pair, the row is invisible.

### 3.7 · Opaque reveal · "blocked by X" is NOT exposed

Decision: when `status='blocked'` and `auth.uid() = other_party_id` (the blocked one), the UI MUST NOT display "X has blocked you". It behaves as if the blocker simply does not exist: profile 404, messages fail with generic "cannot send", feed hides the author. The row is visible to the blocked party at the DB layer only to let server-side RPCs (`rpc_can_i_message(x)`) answer `false`, not to render UI copy.

This matches sealed doctrine for `pending-invite privacy` (feedback memory 2026-10-23 · *"if the other user does not want connect it's good they know their name not displaying"*).

### 3.8 · Cross-country test matrix

Positive = block takes effect; negative = block does not escape its scope.

| # | Setup | Expected result |
|---|---|---|
| T-B-1 | A (IE) blocks B (ID) | On IE deployment: A sees no B content, cannot message B. On ID deployment: B cannot message A, cannot see A's content. **No country column referenced by any check.** |
| T-B-2 | A (ID) blocks B (ID) · same-country block | On ID deployment: A sees no B, B cannot message A. Standard behaviour, no cross-country concern. |
| T-B-3 | A (IE) blocks B (ID), B's post is `visibility='WORLDWIDE'` | A's SELECT on `nex_business`/`nex_product`/`nex_music_track` with B as author DENIES (G-blocking fires BEFORE visibility branch resolves). Worldwide visibility does NOT override block. |
| T-B-4 | A (IE) blocks B (ID), third party C (IE) sees both | C sees A and B independently; the (A,B) block does not affect C's visibility of either. |
| T-B-5 | A (IE) blocks B (ID), then A moves to ID deployment (changes `primary_country` or is impersonated for test) | Block still applies. No country column was used in the predicate. |
| T-B-6 | A (IE) tries to read B's block list where A is not a party | SELECT returns 0 rows for `status='blocked'` rows that A is not in · policy denies. |
| T-B-7 | A (IE) tries to INSERT a block row for pair (B, C) they're not part of | WITH CHECK on `nex_friend_edge` INSERT requires `requested_by = auth.uid()` AND `requested_by IN (a_account_id, b_account_id)` (existing constraint `nex_friend_edge_requested_by_is_participant`). Insert fails. |
| T-B-8 | HQ moderator (service_role) reviewing a report involving blocked pairs | service_role bypasses RLS · HQ sees everything · OK. |

### 3.9 · Note on `nex_follow_graph` and existing follows

An accepted follow (via `nex_follow_graph`) that pre-dates a block must be filtered out by G-blocking at read time. Example: A follows B's channel · later A blocks B · A should no longer see B's content in A's feed.

Current `nex_follow_graph` RLS from migration 237 does NOT include a blocking join. Adding one is a schema-free policy change · lands as part of Migration 245 (RLS install), not a separate migration. SQL sketch in §4.G-blocking below.

### 3.10 · Net effect on the migration count

- Migration **250 withdrawn**. G-blocking enforced against the existing `nex_friend_edge` with `status='blocked'`.
- The eight-migration proposal becomes **seven** at most: 244, 246, 247, 249, 251, 245, 248.
- If the owner also approves folding `moderation_status` (249) into 247 and age-gate columns (251) into 246, it becomes **five**: 244, 246, 247, 245, 248.
- §6 below audits both the 7-migration and 5-migration shapes.

---

## 4 · Seven-gate RLS enforcement · DB vs server split

For every gate: exact rule · DB or server · tables and fields · failure behaviour · positive + negative tests. A gate is DB-enforced only if PostgreSQL can evaluate the predicate against table state in RLS. Everything else is server-enforced and the policy must not claim to enforce it.

### G1 · PUBLISHED (DB-enforced)

**Rule**: a content row is visible only if the author published it (not a draft, not deleted).

**Enforcement**: DB · column on each content table.

| Table | Published predicate |
|---|---|
| `nex_business` | `status = 'active'` (existing enum; verify at policy install) |
| `nex_product` | `published_at IS NOT NULL AND deleted_at IS NULL` |
| `nex_music_track` | `is_published = true` (existing boolean) |
| `nex_uploaded_video` | `is_published = true` |
| `nex_live_session` | `ended_at IS NULL AND started_at IS NOT NULL` (currently broadcasting; past streams gated differently) |
| `nex_live_post` | `visibility <> 'PRIVATE' AND deleted_at IS NULL` |
| `nex_community_notice` | `deleted_at IS NULL AND moderation_status <> 'taken_down'` |
| `nex_community_card` | `deleted_at IS NULL AND moderation_status <> 'taken_down'` |

**Failure behaviour**: SELECT returns 0 rows · author's own draft is visible via a separate "my drafts" policy branch (`WHERE author_account_id = auth.uid()`).

**Tests**:
- T-G1-pos · a published business returns rows for other users.
- T-G1-neg · a draft (`status='draft'`) business is invisible to other users; visible to its own owner only.

### G2 · MODERATION (DB-enforced · requires new column)

**Rule**: content is visible only if `moderation_status IN ('ok','holdback-review')` — not `'taken_down'`. Pending content is visible to the author and HQ only.

**Enforcement**: DB · requires NEW enum type + column added to the 8 visibility-receiving tables.

```sql
CREATE TYPE public.content_moderation_status AS ENUM (
  'ok',             -- cleared or default
  'pending',        -- awaiting first-pass review
  'holdback',       -- temporarily hidden pending review
  'taken_down'      -- removed by HQ moderation
);

ALTER TABLE public.nex_business       ADD COLUMN moderation_status public.content_moderation_status NOT NULL DEFAULT 'ok';
ALTER TABLE public.nex_product        ADD COLUMN moderation_status public.content_moderation_status NOT NULL DEFAULT 'ok';
ALTER TABLE public.nex_music_track    ADD COLUMN moderation_status public.content_moderation_status NOT NULL DEFAULT 'ok';
ALTER TABLE public.nex_uploaded_video ADD COLUMN moderation_status public.content_moderation_status NOT NULL DEFAULT 'ok';
ALTER TABLE public.nex_live_session   ADD COLUMN moderation_status public.content_moderation_status NOT NULL DEFAULT 'ok';
ALTER TABLE public.nex_live_post      ADD COLUMN moderation_status public.content_moderation_status NOT NULL DEFAULT 'ok';
ALTER TABLE public.nex_community_notice ADD COLUMN moderation_status public.content_moderation_status NOT NULL DEFAULT 'ok';
ALTER TABLE public.nex_community_card ADD COLUMN moderation_status public.content_moderation_status NOT NULL DEFAULT 'ok';
```

**Policy clause**:
```sql
AND (moderation_status = 'ok' OR author_account_id = auth.uid())
```

**Failure behaviour**: author sees own content regardless · everyone else sees only `moderation_status='ok'`.

**Tests**:
- T-G2-pos · `moderation_status='ok'` content is visible per other gates.
- T-G2-neg · `moderation_status='taken_down'` content is invisible to all except service_role (HQ).
- T-G2-pos2 · author with `moderation_status='pending'` on their own row still sees it.
- T-G2-neg2 · a third-party viewer does not see a `pending` row.

### G3 · PRIVACY (DB-enforced for row-visibility · server-enforced for operational logging)

**Rule**: a profile/business/content author's declared privacy preference (`profile_visibility` enum: `public|members|private`) gates whether the content is readable.

**Enforcement**: DB · column already exists on `nex_account_profile.profile_visibility` and should exist on `nex_business.visibility_mode` (verify at policy install).

**Policy clause** (profile example):
```sql
AND (
  EXISTS (
    SELECT 1 FROM public.nex_account_profile p
     WHERE p.account_id = profile.account_id
       AND p.profile_visibility = 'public'
  )
  OR auth.uid() = profile.account_id
  OR (
    EXISTS (
      SELECT 1 FROM public.nex_account_profile p
       WHERE p.account_id = profile.account_id
         AND p.profile_visibility = 'members'
    )
    AND auth.uid() IS NOT NULL
  )
)
```

**Failure behaviour**: private profile returns 0 rows to non-owner · members-only profile returns 0 to anonymous.

**Tests**:
- T-G3-pos · public profile visible to any authenticated viewer.
- T-G3-neg · private profile invisible to non-owner.
- T-G3-pos2 · owner sees own private profile.
- T-G3-neg2 · anonymous (unauthenticated) sees members-only as empty.

### G4 · BLOCKING (DB-enforced via `nex_friend_edge`)

**Rule**: if a block row exists between viewer and author (either direction), content is invisible.

**Enforcement**: DB · join to the sealed `nex_friend_edge` primitive (per §3 above). **No country column used.**

**Policy clause**:
```sql
AND NOT EXISTS (
  SELECT 1 FROM public.nex_friend_edge fe
  WHERE fe.status = 'blocked'
    AND fe.a_account_id = LEAST(auth.uid(), author_account_id)
    AND fe.b_account_id = GREATEST(auth.uid(), author_account_id)
)
```

**Failure behaviour**: zero rows between blocked parties.

**Tests**: see §3.8 (T-B-1..T-B-8).

### G5 · AGE (SPLIT · DB evaluates coarse gate · server evaluates fine gate)

**Rule**: adult content is visible only to viewers whose `date_of_birth` indicates they are at or above the content's `age_rating` minimum.

**Enforcement**: SPLIT.

**DB-enforced portion**:
- A new column `age_rating public.content_age_rating NOT NULL DEFAULT 'general'` on the 8 visibility-receiving tables. Enum: `'general'|'teen'|'adult'`.
- A new nullable column `date_of_birth date NULL` on `nex_account` (added by Migration 246's account enrichment per the folding option in §6).
- Coarse policy clause (viewer must have a DOB and be old enough for the content):

```sql
AND (
  age_rating = 'general'
  OR (
    age_rating = 'teen' AND EXISTS (
      SELECT 1 FROM public.nex_account a
       WHERE a.id = auth.uid()
         AND a.date_of_birth IS NOT NULL
         AND age(a.date_of_birth) >= interval '13 years'
    )
  )
  OR (
    age_rating = 'adult' AND EXISTS (
      SELECT 1 FROM public.nex_account a
       WHERE a.id = auth.uid()
         AND a.date_of_birth IS NOT NULL
         AND age(a.date_of_birth) >= interval '18 years'
    )
  )
)
```

**Server-enforced portion**:
- Local age-of-majority differs per jurisdiction (18 vs 21 for some content types in some countries). The server reads the viewer's `nex.app_country`, applies a `jurisdictionAgeMinimum(country, age_rating)` function, and may deny even when the DB coarse gate passes.
- Age-verification trust level (`age_verified_at timestamptz NULL` on `nex_account`): the server can require an explicit verification event before showing `age_rating='adult'` content, independently of the DOB value.

**Failure behaviour**: DB coarse gate denies if DOB is NULL or below the minimum. Server fine gate denies on top for jurisdictional overrides.

**Tests**:
- T-G5-pos · 25-year-old viewer sees `age_rating='adult'` content (passes DB) → server lets through if jurisdiction allows.
- T-G5-neg · viewer with DOB NULL sees no `age_rating='adult'` content (DB denies).
- T-G5-neg2 · viewer in a jurisdiction where adult content is prohibited sees nothing even when DB would allow (server denies).

### G6 · CONTENT SCOPE / VISIBILITY (DB-enforced)

**Rule**: content visibility enum branches determine who can read.

**Enforcement**: DB · the enum branches evaluate directly.

```sql
AND (
  visibility = 'WORLDWIDE'
  OR (visibility = 'COUNTRY' AND country = current_setting('nex.app_country', true))
  OR (visibility = 'SELECTED_COUNTRIES' AND current_setting('nex.app_country', true) = ANY (selected_countries))
  OR (visibility = 'PRIVATE'   AND author_account_id = auth.uid())
  OR (visibility = 'FRIENDS'   AND EXISTS (
        SELECT 1 FROM public.nex_friend_edge fe
         WHERE fe.status = 'accepted'
           AND fe.a_account_id = LEAST(auth.uid(), author_account_id)
           AND fe.b_account_id = GREATEST(auth.uid(), author_account_id)
      ))
  OR (visibility = 'FOLLOWERS' AND EXISTS (
        SELECT 1 FROM public.nex_follow_graph fg
         WHERE fg.follower_id = auth.uid()
           AND fg.followee_id = author_account_id
      ))
)
```

**Failure behaviour**: zero rows when none of the branches match.

**Tests**:
- T-G6-pos-wide · `visibility='WORLDWIDE'` returns to any country.
- T-G6-neg-country · `visibility='COUNTRY'` country='ID' invisible to `nex.app_country='IE'`.
- T-G6-pos-selected · `visibility='SELECTED_COUNTRIES'` with `['IE','ID']` visible to both.
- T-G6-neg-selected · same with `['ID']` invisible to `IE`.
- T-G6-pos-friends · `visibility='FRIENDS'` visible when `nex_friend_edge.status='accepted'`.
- T-G6-neg-friends · same invisible to non-friend.
- T-G6-pos-followers · `visibility='FOLLOWERS'` visible to follower.
- T-G6-neg-followers · same invisible to non-follower.
- T-G6-pos-private · `visibility='PRIVATE'` visible only to author.

### G7 · RELATIONSHIP (DB-enforced · reuses G4 + G6-friends/followers)

**Rule**: compound constraint — some content requires a "non-blocked and mutual-friend" relationship rather than just friend OR not-blocked.

**Enforcement**: DB · composition of G4 and G6's friends/followers branches. Not an independent gate; appears in the policy as the AND of both.

**Failure behaviour**: zero rows if either sub-check fails.

**Tests**: covered by G4 + G6 test matrices in combination.

### 4.X · DB vs server split summary

| Gate | DB-enforced | Server-enforced | New schema needed |
|---|---|---|---|
| G1 · Published | ✅ full | — | columns exist today, verify at install |
| G2 · Moderation | ✅ coarse | HQ workflow (updates `moderation_status`) | ⚠️ new enum + column on 8 tables |
| G3 · Privacy | ✅ full | audit logging | — |
| G4 · Blocking | ✅ full | — | — (uses sealed `nex_friend_edge`) |
| G5 · Age | ✅ coarse (DOB ≥ threshold) | fine (jurisdictional override, verification trust) | ⚠️ `date_of_birth` + `age_verified_at` on `nex_account`; `age_rating` on 8 tables |
| G6 · Content scope | ✅ full | — | ⚠️ `visibility` enum + column on 8 tables |
| G7 · Relationship | ✅ full (reuses G4+G6) | — | — |

### 4.Y · "What the policy does NOT claim to enforce"

The following are enforced in trusted server code only; the RLS policy does NOT reference them:

- **Jurisdictional overrides for G5** (country-specific age-of-majority) · server computes.
- **Rate limits** · server-side middleware.
- **Report-filing jurisdiction lookup** (G-blocking does not police the report itself; `nex_report.country` is set by the server action at insert time per §2.4 of the review package).
- **Signup geo-detection** (CI-11 · suggestion only, the user confirms; server computes the suggestion, DB only stores the confirmed value).
- **Order destination verification** · server computes before create; see §5.

The policy fail-closes on absence of required columns (NULL `moderation_status`, NULL `date_of_birth`) rather than silently allowing. Where a value is NULL, the gate denies.

---

## 5 · Three product fields · exact definitions + four worked examples + checkout logic

Owner directive: name the three fields and show that they behave independently; show checkout independently verifies destination and seller eligibility.

### 5.1 · The three fields on `nex_product`

Added by Migration 247.

| Column | Type | Default | Meaning |
|---|---|---|---|
| **`discovery_visibility`** | `content_visibility` enum | `'COUNTRY'` | Who can SEE the product listing. Six scopes: `PRIVATE`, `FRIENDS`, `FOLLOWERS`, `COUNTRY`, `SELECTED_COUNTRIES`, `WORLDWIDE`. Governs read-side RLS (G6). |
| **`international_sales_enabled`** | `boolean` | `false` | Does the seller currently accept orders from buyers in other countries? Does NOT affect listing visibility. Governs checkout-side gate only. |
| **`allowed_delivery_destinations`** | `text[]` (ISO 3166-1 alpha-2) | `ARRAY[]::text[]` | Explicit list of countries where the seller will ship. Empty array = seller's own country only. Governs checkout-side gate. |

A fourth implied field, `selected_countries text[] NULL`, is required when `discovery_visibility = 'SELECTED_COUNTRIES'` (otherwise NULL · validated by a trigger). It is a visibility companion, not a sales field.

### 5.2 · Independence of the fields

| Combination | Legal? | Interpretation |
|---|---|---|
| `discovery_visibility='COUNTRY'` + `international_sales_enabled=false` | ✅ | Classic local-only product. Only visible to same-country viewers (G6). Only sellable to same-country buyers (checkout). |
| `discovery_visibility='WORLDWIDE'` + `international_sales_enabled=false` | ✅ | **Shop-window-only**: internationally visible for discovery, but not purchasable from abroad. "Look, don't ship." Useful for brand/portfolio. |
| `discovery_visibility='WORLDWIDE'` + `international_sales_enabled=true` + `allowed_delivery_destinations=['IE','ID']` | ✅ | Visible everywhere; shippable only to IE and ID. Buyer in a third country sees the listing but checkout denies. |
| `discovery_visibility='SELECTED_COUNTRIES'` + `selected_countries=['IE']` + `international_sales_enabled=true` + `allowed_delivery_destinations=['IE']` | ✅ | Private discovery (only IE sees), only IE buyers can purchase. "IE-only product." |
| `discovery_visibility='COUNTRY'` + `international_sales_enabled=true` + `allowed_delivery_destinations=['ID','MY']` | ⚠️ Legal but incoherent | Only ID sees the listing (COUNTRY=seller's country); yet seller claims to ship to MY. MY buyers can't see or buy. Discoverability bottleneck · OK as a policy, inefficient as a product. Checkout denies MY-buyer attempts because the row is invisible to them anyway. |
| `discovery_visibility='PRIVATE'` + `international_sales_enabled=true` | ✅ | Author-only visibility (effectively archived); international flag is set but inert. Legal · nothing to buy from the outside. |

The fields are **independent** · the policy MUST NOT short-circuit from one to another. Specifically:
- A `WORLDWIDE` discovery does NOT imply `international_sales_enabled=true`. This is the exact owner safeguard: *"A worldwide post does not mean worldwide sales."*
- An `international_sales_enabled=true` with empty `allowed_delivery_destinations` means **no destinations** (empty-array interpretation), not **all destinations**. This is a deliberate fail-closed default.

### 5.3 · Four owner-requested scenarios

| # | Scenario | `discovery_visibility` | `international_sales_enabled` | `allowed_delivery_destinations` |
|---|---|---|---|---|
| **E1** | Country-only discovery AND local sales | `'COUNTRY'` | `false` | `[]` |
| **E2** | Worldwide discovery AND local-only sales | `'WORLDWIDE'` | `false` | `[]` |
| **E3** | Worldwide discovery AND international sales (unrestricted shipping) | `'WORLDWIDE'` | `true` | `['IE','ID']` (or more; empty = none, so a non-empty list is required when the flag is true) |
| **E4** | Selected-country discovery AND destination-restricted sales | `'SELECTED_COUNTRIES'` + `selected_countries=['IE','ID']` | `true` | `['IE']` only |

### 5.4 · Checkout independence · server-side verification

Checkout performs TWO separate verifications, in this order:

1. **Visibility check** (redundant with RLS but defence-in-depth): verify the buyer could legitimately SEE the product given their `nex.app_country`. Prevents a server-held product reference from being purchased by someone who shouldn't have found it.
2. **Delivery check**: verify the buyer's declared delivery country is in `allowed_delivery_destinations` AND `international_sales_enabled=true` (unless the buyer's delivery country equals the seller's country, in which case the international flag is skipped).

```typescript
// src/lib/nex-native/commerce/checkout-gate.ts  (DRAFT · not implemented in this review)
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/nex/db-types";

type NexProduct = Database["public"]["Tables"]["nex_product"]["Row"];

export type CheckoutDenial =
  | { ok: false; reason: "product-not-visible" }
  | { ok: false; reason: "international-sales-disabled" }
  | { ok: false; reason: "destination-not-allowed"; destination: string }
  | { ok: false; reason: "destination-missing" };

export type CheckoutAllow = { ok: true; product: NexProduct };

export async function verifyCheckoutEligibility(args: {
  supabase: SupabaseClient<Database>;
  productId: string;
  buyerCountry: string;         // ISO alpha-2
  deliveryDestination: string;  // ISO alpha-2 (where to ship)
  sellerCountry: string;        // ISO alpha-2 (from product.business.country)
}): Promise<CheckoutAllow | CheckoutDenial> {
  const { supabase, productId, buyerCountry, deliveryDestination, sellerCountry } = args;

  // Step 1 · visibility defence-in-depth
  // (RLS also enforces this; this is a secondary check so a server-held
  //  reference cannot bypass by re-fetching with service_role naively)
  const { data: product } = await supabase
    .from("nex_product")
    .select("id, business_id, discovery_visibility, international_sales_enabled, allowed_delivery_destinations, selected_countries")
    .eq("id", productId)
    .maybeSingle();

  if (!product) {
    return { ok: false, reason: "product-not-visible" };
  }

  // Step 2 · destination verification (independent of visibility)
  if (!deliveryDestination) {
    return { ok: false, reason: "destination-missing" };
  }

  const sameCountry = deliveryDestination === sellerCountry;

  if (!sameCountry) {
    if (!product.international_sales_enabled) {
      return { ok: false, reason: "international-sales-disabled" };
    }
    const allowed = product.allowed_delivery_destinations ?? [];
    if (!allowed.includes(deliveryDestination)) {
      return { ok: false, reason: "destination-not-allowed", destination: deliveryDestination };
    }
  }

  return { ok: true, product: product as NexProduct };
}
```

Two independent checks. Each can fail independently. Visibility cannot imply shipping. Shipping cannot imply visibility.

### 5.5 · Scenario walkthrough against the checkout gate

| # | Buyer country | Delivery destination | Seller country | Product E1 (COUNTRY/false/[]) | Product E2 (WORLDWIDE/false/[]) | Product E3 (WORLDWIDE/true/[IE,ID]) | Product E4 (SELECTED [IE,ID]/true/[IE]) |
|---|---|---|---|---|---|---|---|
| 1 | `IE` | `IE` | `ID` | invisible | visible, denied: intl-off | visible, allowed | allowed (IE) |
| 2 | `IE` | `IE` | `IE` | visible | visible, same-country | visible, same-country | allowed |
| 3 | `IE` | `ID` | `ID` | invisible | invisible (buyer IE sees but can't checkout to ID — wait: buyer is IE, product is ID WORLDWIDE discovery → VISIBLE; delivery to ID; same-country-as-seller=ID; intl flag false → denied: intl-off) | visible, delivery ID allowed | visible to IE buyer, delivery ID not in `[IE]` → denied: destination-not-allowed |
| 4 | `US` | `US` | `ID` | invisible | visible (WORLDWIDE), denied: intl-off | visible, delivery US not in `[IE,ID]` → denied: destination-not-allowed | invisible (US not in SELECTED [IE,ID]) |
| 5 | `US` | `IE` | `ID` | invisible | invisible (sees product but delivery to IE: seller=ID, flag=false → denied: intl-off) | visible, delivery IE in `[IE,ID]` → allowed | invisible (US buyer, SELECTED=[IE,ID] doesn't include US) |

Row 3 for E2 illustrates the key property: a buyer in Ireland can SEE an Indonesian seller's worldwide product and still have checkout denied, because `international_sales_enabled=false`. "Shop window only."

Row 4 for E3 illustrates destination restriction: a US buyer sees the product but checkout denies because US is not in `allowed_delivery_destinations`.

---

## 6 · Eight-migration dependency audit

Owner directive: for each migration · exact dependency · objects affected · SQL draft status · backfill · RLS/storage · rollback safety · verification tests. Explain WHY each precedes the next. Do not silently add further migrations.

### 6.1 · Reconciled migration count

Per §3 above, Migration 250 is **withdrawn** (blocking already exists via sealed `nex_friend_edge`). This takes the count from 8 → 7.

The owner may further authorise folding to 5 (fold 249 moderation_status into 247; fold 251 age-gate into 246) · see §6.3 for both shapes.

### 6.2 · 7-migration shape (post-correction, no folding)

Apply order: **244 → 246 → 247 → 249 → 251 → 245 → 248**.

| Mig | Purpose | Depends on | Objects affected | SQL draft status | Backfill | RLS/storage | Rollback safety | Verification tests |
|---|---|---|---|---|---|---|---|---|
| **244** | Country column (nullable) on 4 anchor tables | none | `nex_business`, `nex_community_zone`, `nex_live_session`, `nex_report` (ADD COLUMN country text NULL) | ✅ reissued DRAFT on disk at `244_nex_country_column.sql` + guarded rollback at `244_nex_country_column.rollback.sql` | none in this migration | none | ✅ Phase 1 read-only check + Phase 2A refuses if data present + Phase 2B preserves to snapshot table before drop | Column exists + nullable + 100% NULL post-apply + ledger row (SQL in migration file) |
| **246** | Country backfill + account enrichment (`nex_account.primary_country`) | 244 | `nex_business`, `nex_community_zone`, `nex_live_session`, `nex_report` (UPDATE SET country='ID') + `nex_account` (ADD primary_country text NULL + backfill 'ID') | DRAFT in `nex-migrations-244-to-248-individually-2026-10-31.md` · not yet an SQL file | UPDATE WHERE country IS NULL across 4 anchors; UPDATE on `nex_account.primary_country` | none | ✅ Non-destructive · setting country='ID' from NULL is reversible by `UPDATE SET country=NULL WHERE country='ID'`; previous-state auditable from the pre-backfill query | Pre-backfill: `count(country IS NULL)` matches total; post-backfill: `count(country IS NULL)=0`; HQ audit of distribution |
| **247** | Visibility enum + column on 8 content tables + product triple + `selected_countries` array + CHECK triggers | 244 (semantic · country concept) | `CREATE TYPE content_visibility`; `ALTER TABLE … ADD COLUMN visibility …` on 8 tables; `ADD COLUMN selected_countries text[]`; `nex_product.ADD COLUMN discovery_visibility`+`international_sales_enabled`+`allowed_delivery_destinations`; CHECK trigger for `selected_countries ↔ visibility='SELECTED_COUNTRIES'` | DRAFT in individually doc | default `'COUNTRY'` on business/live_session/live_post/notice/card; default `'PRIVATE'` on music_track/uploaded_video; default `'COUNTRY'` on product.discovery_visibility | none in this migration | ✅ Enum drop requires no column uses it first; non-destructive via DROP COLUMN IF EXISTS + DROP TYPE IF EXISTS; existing rows default to least-exposure | type exists; columns exist with defaults; existing rows show visibility='COUNTRY' or 'PRIVATE' |
| **249** | Moderation status enum + column on 8 content tables | 247 (same 8 tables; semantic alignment) | `CREATE TYPE content_moderation_status`; `ALTER TABLE … ADD COLUMN moderation_status …` on 8 tables | NOT YET DRAFTED (proposed by §4 G2 above) | default `'ok'` | none in this migration | ✅ DROP COLUMN IF EXISTS + DROP TYPE IF EXISTS · non-destructive except for any manually-set `moderation_status` values which should be snapshotted (same pattern as 244 rollback) | type exists; columns exist with defaults; existing rows show moderation_status='ok' |
| **251** | Age-gate columns · `age_rating` on 8 content tables + `date_of_birth` + `age_verified_at` on `nex_account` | 246 (account enrichment baseline) + 247 (content tables already have visibility) | `CREATE TYPE content_age_rating`; `ALTER TABLE … ADD COLUMN age_rating …` on 8 tables; `ALTER TABLE public.nex_account ADD COLUMN date_of_birth date NULL`, `ADD COLUMN age_verified_at timestamptz NULL` | NOT YET DRAFTED (proposed by §4 G5 above) | default `'general'` for `age_rating`; NULL for `date_of_birth` and `age_verified_at` | none in this migration | ✅ non-destructive; nullable new columns can be dropped if no values set | type exists; columns exist with defaults; existing content shows age_rating='general' |
| **245** | Country-aware + visibility-OR-country RLS; blocking join via `nex_friend_edge`; moderation + age coarse gates; replaces `USING(true)` on `nex_business`; strict country-locked INSERT/UPDATE/DELETE | 244 (column) + 246 (backfill) + 247 (visibility) + 249 (moderation) + 251 (age) | 4 anchor tables + ~32 CO-I tables (SELECT/INSERT/UPDATE/DELETE policies) | DRAFT exists on disk at `245_nex_country_rls.sql` · needs rewrite under visibility-OR-country semantics plus five gates (G1,G2,G4,G5,G6; G3 and G7 compose from existing columns) | none | ✅ **The RLS change itself** · behaviour change · everything prior is additive | ⚠️ **High-impact** · policies cannot "roll back cleanly" if production has started relying on them; rollback = `DROP POLICY` returns to prior permissive state which may be worse than the policy; **do not treat 245 as reversible under load**; apply during announced maintenance window and verify with a shadow deployment first | Policy count per table; cross-country isolation smoke tests (IE sees no ID COUNTRY content; sees ID WORLDWIDE content); fail-closed with empty `nex.app_country`; connection-pool leakage test; blocking test cases from §3.8 |
| **248** | Storage prefixes on `nex-business-assets` bucket + path rename of existing objects + storage.objects RLS | 244 + 246 (country must be set so paths can be renamed) + 247 (visibility used by storage policy for `WORLDWIDE` branch) + 245 (application-side RLS is live, so storage mirrors it) | `storage.objects` policies; file-path rename pipeline for existing `nex-business-assets` entries; update of `nex_business.qr_code_image_url`, `.logo_url` where embedded | DRAFT in individually doc + extended policy sketch in §5 of this report | path-rename `{businessId}/*` → `{IE|ID}/{businessId}/*` based on `nex_business.country` | storage policies install | ⚠️ High-impact · path renames are observable to CDN caches and in-flight signed URLs; rollback requires reverse-rename pipeline; same maintenance-window practice as 245 | 0 objects at root (all prefixed); 2 policies exist; signed-URL smoke test; cache-invalidation plan verified |

### 6.3 · Alternative 5-migration shape (if folding is authorised)

Apply order: **244 → 246 → 247 → 245 → 248**.

| Mig | Purpose | Depends on | Objects affected |
|---|---|---|---|
| 244 | Country column (unchanged) | none | 4 anchor tables |
| 246 | Country backfill + `primary_country` + `date_of_birth` + `age_verified_at` on `nex_account` | 244 | 4 anchors + `nex_account` |
| 247 | Visibility enum/column + product triple + moderation enum/column + age_rating enum/column (all three content enums land here) | 244 | 8 content tables + product-specific triple |
| 245 | RLS (unchanged) | 244 + 246 + 247 | ~36 tables |
| 248 | Storage (unchanged) | 244 + 246 + 247 + 245 | storage.objects |

### 6.4 · Why each migration must precede the next

#### 244 → 246
Cannot `UPDATE SET country='ID'` a column that doesn't exist.

#### 246 → 245
A country-aware RLS applied before backfill is complete makes every `country IS NULL` row invisible to EVERY reader including its own owner, since `NULL = 'ID'` evaluates to NULL (unknown) and RLS treats this as "deny". Platform goes dark on apply. Order is non-negotiable.

#### 247 → 245
The RLS predicate references the `visibility` column and the `content_visibility` enum. Policy install fails if the column doesn't exist.

#### 249 → 245 (or absorbed by 247 → 245)
The RLS predicate references `moderation_status` and the `content_moderation_status` enum. Policy install fails if the column doesn't exist.

#### 251 → 245 (or absorbed by 246/247 → 245)
The RLS predicate references `age_rating` on 8 tables and `date_of_birth` on `nex_account`. Policy install fails if either is missing.

#### 245 → 248
Storage policies on `nex-business-assets` reference `nex_business.visibility='WORLDWIDE'` for the public-read branch and `nex_business.country` for the prefix. The application-side RLS must be live before storage mirrors it; otherwise storage denies more than application does, and users see broken assets.

### 6.5 · Rule: "do not silently add further migrations"

- Migration 250 is **withdrawn** (not silently; §3 explains).
- Migrations 249 and 251 are **PROPOSED** by this review in §4 G2 and G5 — not silent additions. Owner may approve as separate migrations OR authorise folding into 247/246 to drop back to 5 migrations.
- No further migrations are proposed. If a further prerequisite emerges during drafting, this file will be amended with the finding BEFORE any work proceeds.

---

## 7 · Owner approval gates matrix

Approval of a draft never authorises its application. Approval of one application never authorises another. The gates stay separate.

| Gate | Scope | Approval granted to date | Approval still required |
|---|---|---|---|
| **A · Classification** | 99-table review in `nex-country-isolation-review-package-2026-10-31.md` + 8-table visibility list in `nex-99-table-classification-2026-10-31.md` | Working baseline accepted · subject to final technical review | Final sign-off (V-1) |
| **B · RLS policy design** | Seven-gate matrix in `nex-rls-policy-matrix-2026-10-31.md` + DB/server split in §4 of this file | — | Independent approval |
| **C · Migration draft 244** | `244_nex_country_column.sql` (4-anchor) + guarded rollback | DRAFT prepared · not approved | Draft approval |
| **C · Migration draft 246** | Country backfill + account enrichment | PROPOSAL only | Draft creation first, then draft approval |
| **C · Migration draft 247** | Visibility enum/column + product triple (+ possibly moderation + age_rating if folded) | PROPOSAL only | Draft creation first, then draft approval |
| **C · Migration draft 249** | Moderation enum/column | PROPOSAL only (may be folded) | Fold-vs-separate decision; draft creation; draft approval |
| **C · Migration draft 251** | Age-gate columns | PROPOSAL only (may be folded) | Fold-vs-separate decision; draft creation; draft approval |
| **C · Migration draft 245** | RLS install | DRAFT exists on disk at `245_nex_country_rls.sql` (pre-reconciliation shape) · needs rewrite | Rewrite + draft approval |
| **C · Migration draft 248** | Storage prefixes + path rename | PROPOSAL only | Draft creation first, then draft approval |
| **D · Each migration application** | Running the SQL against the sealed Supabase project | None | Separate per-migration apply authorisation that names the file |
| **E · Git push** | Pushing 10 local commits (11 after this one) to `origin/main` on `Philip2024394/nexapp` | None | Separate push authorisation (per CLAUDE.md §4) |
| **F · Deployment** | Vercel production deployment | None | Separate deployment authorisation (per CLAUDE.md §5) |

Owner may approve gates individually. Example: owner may approve Gate A + Gate C-244 + Gate C-246 without approving anything else; drafts can be prepared on disk under Gate C without Gate D firing.

---

## 8 · Hard boundaries · honoured this round

| Boundary | State at commit time |
|---|---|
| No production migration application | ✅ Nothing applied; 244's guarded rollback is a companion file, not an apply |
| No push | ✅ All commits local (11 after this one) |
| No deployment | ✅ |
| No destructive database change | ✅ |
| No Chat Themes change (CI-7) | ✅ |
| No sealed design-token change | ✅ |
| No HQ auth gate change | ✅ |
| No country application implementation | ✅ |
| Technical debt untouched (TD-1..TD-4) | ✅ Parallel workstream intact |

---

## 9 · Items for owner response (round-2)

| # | Item | Returns needed |
|---|---|---|
| W-1 | Reconciled git report in §1 is correct and the inconsistency is dissolved | ack / correct |
| W-2 | Migration 244 guarded rollback in `244_nex_country_column.rollback.sql` + §2 of this report | approve / request-change |
| W-3 | Migration 250 withdrawal (blocking uses sealed `nex_friend_edge`) + G-blocking SQL in §3 + cross-country tests T-B-1..T-B-8 | approve / instruct to create parallel block table instead |
| W-4 | Seven-gate DB/server split in §4 + what the policy does NOT claim to enforce | approve / rewrite |
| W-5 | Three product fields exact definitions + E1-E4 scenarios + checkout gate code sketch in §5 | approve / modify |
| W-6 | 7-migration audit in §6.2 (with 249 and 251 as separate migrations) **OR** 5-migration audit in §6.3 (with folding into 246 and 247) | pick 7 or 5 |
| W-7 | Approval gates matrix in §7 (keeps A/B/C/D/E/F separate) | approve / modify |
| W-8 | Pre-req gaps (moderation_status column + age-gate columns) are correctly scoped to 249/251 or absorbed into 247/246 | approve folding / require separate migrations / defer |
| W-9 | No further migrations proposed; if any emerge the owner is told BEFORE work proceeds | ack |

---

*Round-2 technical report 2026-10-31. One doc. Real SQL + policies + tests. No further migrations silently added. No push. No apply. No deployment. Awaiting W-1..W-9.*
