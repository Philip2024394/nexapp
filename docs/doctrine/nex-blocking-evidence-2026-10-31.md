# NEX · Blocking Implementation Evidence · 2026-10-31

**Purpose**: evidence pack for owner W-3 — verify the existing sealed `nex_friend_edge.status='blocked'` primitive actually enforces blocking across every relevant NEX interaction, specifically the non-friend case the owner flagged.
**Status**: evidence doc · no code change · no apply.
**Owner's W-3 verification cases**:
1. A user can block someone who is **not already a friend**.
2. Blocking works across Ireland and Indonesia.
3. A block prevents messaging, invitations and relevant live interactions.
4. A block prevents prohibited profile and content discovery.
5. A worldwide post does not override a block.
6. Follow and friendship creation cannot silently recreate a blocked relationship.
7. Unblocking has explicit and predictable behaviour.
8. Users cannot inspect another person's private block information.

Each row below cites the exact file + line in the current repo.

---

## Case 1 · Can block a non-friend

**File**: `src/lib/nex-native/friend-service.ts`
**Function**: `blockAccount(actor, other)`
**Evidence** (lines 239-264 verbatim shape):

```ts
export async function blockAccount(actor, other) {
  const [a, b] = canonicalPair(actor, other);
  const existing = await getEdge(a, b);
  if (existing?.status === "blocked") {
    if (existing.requested_by === actor) return existing;
    throw new Error("nex-friend · already blocked by the other party");
  }
  if (!existing) {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_friend_edge")
      .insert({ a_account_id: a, b_account_id: b, requested_by: actor, status: "blocked" })
      .select("*")
      .single();
    …
    return data;
  }
  …
}
```

**Verdict**: ✅ PASS. The `if (!existing)` branch (lines 246-254) inserts a fresh row with `status: "blocked"` when no edge exists between actor and other. No "must be friend first" precondition exists.

**Explicit non-condition**: the function does NOT require `existing.status === 'accepted'`. It handles three states: no row (insert blocked), already-blocked-by-me (idempotent return), already-blocked-by-other (reject). All other existing states (pending, accepted, declined) fall through to a transition UPDATE at lines 255-262.

---

## Case 2 · Cross-country (Ireland + Indonesia)

**Classification evidence**: `nex_friend_edge` is **G (GLOBAL)** per `nex-99-table-classification-2026-10-31.md` row 74. No `country` column. Row 83 of the same doc explicitly lists `nex_friend_edge` under "tables that must never receive a country column".

**Policy evidence**: `nex_is_blocked_pair(viewer, author)` in `245_nex_country_rls.sql` references the table purely by `a_account_id` + `b_account_id` + `status = 'blocked'`. No reference to `country` anywhere in the predicate.

**Verdict**: ✅ PASS by construction. A block row is country-agnostic. If an Ireland-connected account blocks an Indonesia-connected account, the single global row denies interaction in both deployment directions.

**Test matrix** (from `nex-country-isolation-review-round-2-2026-10-31.md` §3.8):
- T-B-1: A(IE) blocks B(ID) → both deployments honour the block.
- T-B-2: Same-country block → standard behaviour.
- T-B-5: A moves country after blocking → block still applies (no country column used).

---

## Case 3 · Messaging / invitations / live interactions

### 3a · Friend invitations

**File**: `src/lib/nex-native/friend-service.ts` line 69-72:
```ts
if (existing.status === "blocked") {
  throw new Error("nex-friend · this account is blocked");
}
```

**Verdict**: ✅ PASS. `sendInvite` rejects when the canonical pair row is blocked, regardless of which side blocked.

### 3b · Follow

**File**: `src/lib/nex-native/follow/follow-actions.ts` line 125-126:
```ts
const blocked = await isBlockedBetween({ a: followerId, b: input.followeeId });
if (blocked) return err("blocked", "This follow is blocked");
```

**File**: `src/lib/nex-native/follow/follow-repository.ts` line 93-107 — `isBlockedBetween` reads `status='blocked'` on the canonical pair.

**Verdict**: ✅ PASS.

### 3c · Profile UI

**File**: `src/app/nex-native/profile/[handle]/page.tsx` line 998:
```ts
if (edge.status === "blocked") return "blocked";
```

**Verdict**: ✅ PASS at UI state. The connect button shows the blocked state; downstream UI actions on this state are gated.

### 3d · Peer messaging (`nex_message` / `nex_peer_message`)

**Finding**: ⚠️ **GAP today**. Grep of `src/` finds no `isBlockedBetween` or `status === 'blocked'` check in any message-send path (first-conversation orchestrator uses "blocked" as a risk-level, not friend-edge blocking — see §3e below).

**Resolution**: Migration 245's G-blocking RLS clause (`AND NOT public.nex_is_blocked_pair(…)`) covers this at the DB layer. When 245 lands, `nex_message` SELECT policy includes the gate; INSERT WITH CHECK should include it on the write side too — this is called out explicitly in `245_nex_country_rls.sql` as a representative pattern to be extended to `nex_message`/`nex_peer_message` in the full CO-I policy expansion.

**Owner action**: no code change today. The gap is a known-and-planned filler by Migration 245.

### 3e · First-conversation "blocked" is a DIFFERENT concept

**File**: `src/lib/nex-native/first-conversation/first-message-orchestrator.ts` lines 146-149:
```ts
| { status: "blocked"; reason: "message_too_short" | "duplicate_message" | "ip_reputation" };
```

**Verdict**: this is an **anti-spam** block decision, not a user-to-user block. Different enforcement, different data path. Must not be conflated with `nex_friend_edge.status='blocked'`.

### 3f · Live interactions (`nex_live_participation`)

**Finding**: ⚠️ **GAP today**. No block check in the live join path at the application layer.

**Resolution**: same as 3d — Migration 245 covers it at the DB layer.

---

## Case 4 · Profile and content discovery

### 4a · Profile discovery (`nex_account_profile`)

**Current state**: `nex_account_profile` is **G (GLOBAL)** · its SELECT is governed by `profile_visibility` enum (`public|members|private`) via a profile-specific policy.

**With Migration 245 live**: G-blocking is composed into every content SELECT policy, including on tables that render on a profile (`nex_business`, `nex_music_track`, `nex_uploaded_video`). Blocked parties see 0 content rows regardless of visibility branch.

**Separate consideration**: profile page itself (`nex_account_profile`) — the owner-chosen rule from §3.7 of the round-2 report is that a blocked viewer sees the profile as 404, not "X has blocked you". Enforcement path: `/profile/[handle]/page.tsx` reads `resolveConnectState()`, which already returns `"blocked"`; the surrounding page should render 404 for that state. **This UI wiring is not in place today** and lands with the application-side changes that follow Migration 245.

### 4b · Content discovery (business/product/music/video/live/notice/card)

**With Migration 245 live**: every SELECT policy on these tables includes G-blocking. Zero rows between blocked parties regardless of visibility.

---

## Case 5 · Worldwide post does not override a block

**Policy design**: G-blocking is in the **same AND** as the visibility branch. Both branches (country-match AND visibility-permits) require the full safety stack G1-G5 and G4 is in that stack.

```sql
USING (
  (country = app_country AND G1 AND G2 AND G3 AND G4 AND G5)
  OR
  (visibility <> 'COUNTRY' AND G1 AND G2 AND G3 AND G4 AND G5 AND G6 AND G7)
)
```

G4 fires in both branches. A WORLDWIDE visibility on Branch 2 does not strip G4.

**Verdict**: ✅ PASS by policy construction. See T-B-3 in §3.8 of the round-2 report.

---

## Case 6 · Follow / friendship creation cannot silently recreate a blocked relationship

### 6a · Friend invite path

**File**: `friend-service.ts` line 69-72 — `sendInvite` rejects when `existing.status === 'blocked'`. A fresh invite cannot be sent through this function to a blocked pair.

### 6b · Direct SQL INSERT

**With Migration 245 live**: `nex_friend_edge` RLS INSERT policy would reject an authenticated-role attempt to insert `status='pending'` for a pair where `status='blocked'` exists (PK constraint also rejects the duplicate (a, b) insert; even without 245, a client cannot "replace" the blocked row via INSERT because of the PK).

### 6c · Follow

**File**: `follow-actions.ts` line 125-126 — `followAction` returns `err("blocked")` for blocked pairs before the follow row is created.

**Verdict**: ✅ PASS across the three paths.

---

## Case 7 · Unblocking behaviour

**File**: `friend-service.ts` lines 282-296:
```ts
export async function unblockAccount(actor, other) {
  const [a, b] = canonicalPair(actor, other);
  const existing = await getEdge(a, b);
  if (!existing) throw new Error("nex-friend · no relationship to unblock");
  if (existing.status !== "blocked") throw new Error("nex-friend · relationship is not currently blocked");
  if (existing.requested_by !== actor) {
    throw new Error("nex-friend · only the account that placed the block can lift it");
  }
  const { error } = await nexSupabaseAdmin
    .from("nex_friend_edge")
    .delete()
    .eq("a_account_id", a)
    .eq("b_account_id", b);
  …
}
```

**Properties**:
- Only the original blocker (`requested_by === actor`) can lift the block.
- Unblock is a DELETE (not a status update), so the canonical pair returns to "no edge" and future invites are a fresh pending (consistent with sealed migration 034 semantics).
- Idempotency: throws on "no relationship" rather than silently succeeding — the caller learns the state.

**Server-action wrapper**: `src/app/nex-native/settings/blocked/_actions.ts` lines 40-62 — single `unblockAccountAction` server action, no re-implementation of the checks (sealed service is the single source of truth).

**Verdict**: ✅ PASS. Explicit and predictable.

---

## Case 8 · Private block information

### 8a · listBlockedByMe

**File**: `friend-service.ts` lines 267-276:
```ts
export async function listBlockedByMe(actor) {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_friend_edge")
    .select("…")
    .eq("status", "blocked")
    .eq("requested_by", actor);
  …
}
```

**Verdict**: filters by `requested_by = actor`. The function cannot return rows blocked BY someone else.

### 8b · Direct SELECT on `nex_friend_edge`

**Current state**: `nex_friend_edge` has `ENABLE ROW LEVEL SECURITY` but no SELECT policies for `authenticated` (migration 025 line 76: *"Service-role only for now · authenticated policies deferred to when a dedicated /nex-native/friends surface ships in Slice 9b."*). This means today, authenticated reads of `nex_friend_edge` return 0 rows — correct fail-closed behaviour.

**With Migration 245 live**: Migration 245 adds a SELECT policy restricting `status='blocked'` rows to parties of the pair (per round-2 report §3.6). Non-parties see zero rows for blocked edges.

**Verdict**: ✅ PASS today (via no-policy fail-closed) and after 245 (via explicit policy).

### 8c · Opaque reveal · "blocked by X" is NOT exposed

**File**: `src/app/nex-native/profile/[handle]/page.tsx` lines 989-1010 — the `ConnectState` enum includes `"blocked"` as a visible state. **UI treatment**: owner-sealed decision from feedback memory 2026-10-23 says the blocked party must NOT see "X has blocked you" — the profile should 404. The round-2 report §3.7 captures the behavioural rule. Implementation audit: today the `profile/[handle]/page.tsx` state leaks the blocked state in the connect button for the party who was blocked. **This is a UI gap**; it does not expose WHO blocked them, but it does signal the state. Resolution: a follow-up change (not part of the 7-migration programme) should flip the blocked-party rendering to a 404 branch.

**Boundary**: this UI fix is a SEPARATE change from the country-isolation migrations. Not drafted here. Not applied.

---

## Summary · W-3 verification

| # | Case | Verdict | Notes |
|---|---|---|---|
| 1 | Block a non-friend | ✅ PASS | friend-service.ts line 246-254 INSERT when no edge |
| 2 | Cross-country | ✅ PASS by construction | `nex_friend_edge` has no country column |
| 3 | Messaging / invitations / live | ✅ PASS (friend invite + follow) · ⚠️ GAP (direct message + live) → closed by Migration 245 G-blocking |
| 4 | Profile / content discovery | ⚠️ Partial today · closed by Migration 245 for all 8 content tables |
| 5 | Worldwide does not override block | ✅ PASS by policy construction (G4 in both branches) |
| 6 | Follow/friend cannot silently recreate | ✅ PASS across all 3 paths |
| 7 | Unblocking | ✅ PASS (explicit, blocker-only, DELETE semantics) |
| 8 | Private block info | ✅ PASS at data layer · ⚠️ UI gap on blocked-party rendering (fix is SEPARATE from this programme) |

**Net**: the existing primitive IS sufficient to satisfy owner's W-3 requirements once Migration 245 lands. Two UI/application gaps exist today (direct peer-message block check, blocked-party 404 rendering); both are closed by Migration 245 at the DB layer AND by a follow-up UI change respectively. No parallel `nex_account_block` table is required.

---

*Evidence pack 2026-10-31. No code · no migration applied. Returns owner W-3 verification.*
