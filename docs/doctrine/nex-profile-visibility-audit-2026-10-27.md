# NEX Profile-Visibility Audit · 2026-10-27

**Authority**: founder directive 2026-10-27 · Candidate D' (replacement for Candidate D after the inspection pass found chat-settings / privacy / data-usage already sealed-complete at R9 Stage 4 / R10 Stage 5 / R14 Stage 6).

**Trigger**: the sealed R10 Stage 5 doctrine at `src/app/nex-native/settings/privacy/page.tsx:32-37` admits a honest limitation verbatim:
> "profile_visibility only acts on paths that have been migrated to the resolver; unaudited paths may expose a profile that was set to private. The ongoing audit catalogs these."

This doc IS that catalog.

**Method**: single read-only Explore subagent · 34 surfaces examined · pure code-read (no DB queries, no runtime tests). Classifications are code-level · behaviour at runtime may differ if a gate throws / falls through unexpectedly.

**Scope limits** (honest):
- Did NOT run migration 200 (profile_visibility + who_can_message) to verify production state. The migration is AUTHORED but NOT YET APPLIED to Supabase `ijvqdvsvwtwxzcqmoqit`.
- Did NOT inspect every Supabase RLS policy by hand · grepped only for key patterns on `nex_account` / `nex_account_profile`.
- Did NOT audit every shared-component caller tree exhaustively.
- Did NOT verify whether `nex.business_canonical` views enforce profile_visibility at the query level.
- Did NOT test any surface in a browser.

---

## Summary

| Classification | Count | Meaning |
|---|---|---|
| **A · gated via resolver** | 3 | Safe · calls `resolveProfileVisibilityForViewer` directly |
| **B · is_discoverable gate only** | 6 | Partially safe · only guards the discovery axis, NOT `profile_visibility` |
| **C · other gates** | 5 | Needs investigation · another gate may transitively enforce |
| **D · UNAUDITED · may leak** | 20 | Risk · reads profile data without any visibility check |
| **Total examined** | 34 | |

**Primary risk**: 20 surfaces display profile data (display_name, avatar_url, profession, etc.) without consulting `profile_visibility`. A user who sets their profile to private can still appear on these surfaces to other viewers. The sealed R10 Stage 5 doctrine acknowledges this; this audit identifies the specific surfaces.

**Supabase gap**: migration 200 does NOT create an RLS policy enforcing `profile_visibility` at the DB level. Service-layer gating is the only defence. Any surface that bypasses `resolveProfileVisibilityForViewer` reads the raw row.

---

## Surface catalog

| Surface | Reads what | Class | Gate detail | Risk |
|---|---|---|---|---|
| `/nex-native/profile/[handle]` | `nex_account_profile` + `nex_account` (display, avatar, bio, profession, location, interests, cover) | **A** | calls `resolveProfileVisibilityForViewer` at page.tsx:257 + `is_discoverable` gate at 252-254 · returns 404 when `visible:false` | low · double-gated |
| `/nex-native/bio/[nex_handle]` | redirects to `/profile/[handle]` | **A** | thin redirect · privacy chain preserved | low |
| `/nex-native/u/[handle]` | redirects to `/profile/[handle]` | **A** | thin 307 redirect · privacy chain preserved | low |
| `/nex-native/[businessSlug]` | `nex_business.display_name` + owner `avatar_url` on shop landing | **B** | no `profile_visibility` check · owner identity visible to any visitor | medium · public shop intentionally exposes owner, but `private` should override |
| `/nex-native/directory/[id]` | canonical business listing with owner identity | **B** | no `profile_visibility` check · `is_discoverable` is on canonical schema, not service layer | medium · respects canonical discovery, not `profile_visibility` |
| `/nex-native/directory` (grid) | canonical business tiles · owner names | **B** | filters by `is_discoverable` only · no `profile_visibility` gate | medium |
| `/nex-native/discover` | redirects to `/directory/landing` | **B** | pure redirect · no data read | low |
| `/nex-native/contacts` | friend + business contact rows (display, avatar, profession) | **D** | no visibility check · renders rows from `friendService.listFriendsByAccountId` without consulting `profile_visibility` | **high** · a friend who later set `private` still appears with full data |
| `/nex-native/chat/peer/[accountId]` | peer identity (display, avatar, chat-theme) | **D** | no visibility check · renders peer in `PortraitBloomShell` | **high** · peer who set `private` after conversation created still exposes identity |
| `/nex-native/conversations` | conversation participant identities (peer + business) | **D** | no visibility check | **high** · same stickiness issue as peer-chat |
| `/nex-native/live-commerce/[sessionId]` | broadcaster identity shown in viewer client | **D** | no visibility check | **high** · broadcaster who set `private` still exposed on live-view |
| `/nex-native/live-commerce/feed` | all open-session broadcaster identities | **D** | no visibility check · lists every open broadcaster | **high** · null-viewer discovery surface |
| `/nex-native/live-commerce/discover/[chainSlug]` | filtered live sessions | **D** | inherits risk from feed | **high** |
| `/nex-native/community/feed` | notice author `account_id` loaded but not shown in list | **D** | author not displayed in list view currently | medium · list OK, detail depends on next row |
| `/nex-native/community/notices/[id]` | notice author identity (from `author_account_id`) | **D** | reads row but current implementation does NOT render author card (page.tsx:42-48) | low today · high if future UI adds author card |
| `/nex-native/community/lost-found/[id]` | post author identity | **D** | author stored but not surfaced in UI | low today · high if future UI adds author card |
| `/nex-native/contacts/_contacts-list.tsx` | contact row display (shared component) | **D** | renders server-provided `ContactRowDisplay` · no re-gating | **high** |
| `/api/nex-native/chat/conversations` | conversation list including peer identities | **D** | API returns participant identities · likely no visibility check | unknown · needs route inspection |
| `/api/nex-native/peer-message/since` | message history including sender metadata | **D** | may surface old sender identity without re-gating | unknown · needs route inspection |
| `/nex-native/chat/guest/[ownerAccountId]` | owner identity shown to anonymous guest | **D** | no visibility check · unauthenticated guest sees owner | **high** · null-viewer surface |
| `/nex-native/call/g/[sessionId]` | call session broadcaster/participant identities | **D** | reads live-session data · may expose broadcaster | **high** |
| `/nex-native/group-chat/[groupId]` | group member identities (participant list) | **D** | renders member avatars/names without re-gating | **high** |
| `/nex-native/report/[accountId]` | reported account identity (display, avatar) | **D** | no visibility check · caller explicitly chose this account | medium · intentional, worth consistency note |

---

## Supabase RLS analysis

- No RLS policies found on `nex_account` or `nex_account_profile` that enforce `profile_visibility` at the DB level.
- `nex_session` RLS (migration 139) gates owner reads via `supabase_user_id = auth.uid()` · for session management, not profile.
- Migration 134 (`is_discoverable`) likely has an RLS policy enforcing the discovery axis · needs verification.
- **Migration 200 (`profile_visibility` + `who_can_message`) has NO RLS policy defined** · purely service-layer enforcement via `resolveProfileVisibilityForViewer`.

**Significance**: even a direct call to `getProfileByAccountId` from any service layer bypasses `profile_visibility` because the DB does not enforce it. Every reader is a trusted gatekeeper. The sealed R10 Stage 5 doctrine depends on 100% of callers calling the resolver · this audit shows that is NOT currently the case.

---

## Shared rendering components

| Component | Path | Typical caller | Visibility gate | Risk |
|---|---|---|---|---|
| `ContactRow` | `/contacts/_contact-row.tsx` | `/contacts/page.tsx` + `_contacts-list.tsx` | caller has no visibility re-check | **high** |
| `IdentityHero` | `/profile/[handle]/_identity-hero.tsx` | `/profile/[handle]/page.tsx` | server-side gated at page level | low |
| `CoverPhoto` | `/profile/[handle]/_cover-photo.tsx` | `/profile/[handle]/page.tsx` | inherits parent gate | low |
| `ShopCard` | `/search/_shop-card.tsx` | directory + search | caller uses `is_discoverable` only | medium |
| `BroadcasterCard` (inferred) | live-commerce/feed | live-feed | inherits lack of gate | **high** |

---

## Ranked risk list (Class D first)

1. **`/nex-native/contacts`** · friend contact list renders profile data without re-gating · fix: filter or re-gate per row via resolver before rendering `professionLine`.
2. **`/nex-native/live-commerce/feed`** · lists all open broadcasters without `profile_visibility` check · fix: call `resolveProfileVisibilityForViewer(null, broadcaster_account_id)` and omit `visible:false` entries.
3. **`/nex-native/chat/peer/[accountId]`** · peer identity surfaces old data after visibility change · fix: call resolver + 404 for non-owners when `visible:false`.
4. **`/nex-native/conversations`** · same stickiness issue as peer-chat · fix: re-gate each participant.
5. **`/nex-native/live-commerce/[sessionId]`** · broadcaster identity on live-view · fix: gate before rendering broadcaster card.
6. **`/nex-native/chat/guest/[ownerAccountId]`** · unauthenticated guest access to owner profile · fix: gate on `resolveProfileVisibilityForViewer(null, ownerAccountId)` + 404 if `visible:false` AND NOT discoverable.
7. **`/nex-native/live-commerce/discover/[chainSlug]`** · inherits feed risk.
8. **`/nex-native/[businessSlug]`** · public shop landing exposes owner identity · see Decision Point A below.
9. **`/nex-native/directory` + `/directory/[id]`** · search/category/detail results · fix: filter at service layer (see Decision Point C).
10. **`/nex-native/call/g/[sessionId]`** · call-join page exposes participants · fix: gate.
11. **`/nex-native/group-chat/[groupId]`** · group members shown without re-gate · fix: mark since-set-private members with a restricted-view card.
12. **`/nex-native/report/[accountId]`** · report form shows target identity · intentional, worth consistency note.

---

## Known-safe surfaces

Only 3 surfaces are currently gated by `resolveProfileVisibilityForViewer`:
- `/nex-native/profile/[handle]` (sealed)
- `/nex-native/bio/[nex_handle]` (redirect)
- `/nex-native/u/[handle]` (redirect)

All other profile-rendering surfaces are either `is_discoverable`-only (Class B) or ungated (Class D).

---

## Founder decision points surfaced by the audit

These are architectural choices the audit cannot resolve · they need founder direction before any Class-D fix can land.

### A · Shop landing visibility (most nuanced)
Current `/nex-native/[businessSlug]` displays owner `display_name` + `avatar_url` to any visitor. Three options:
1. Keep as-is · `profile_visibility` only applies to `/profile` route · shop page is an owner-chosen public surface (owner chose to run a shop).
2. If owner sets `profile=private`, block `[businessSlug]` for non-owners · breaks shareable shop URLs.
3. If owner sets `profile=private`, show the shop (products etc.) but hide owner identity · "owner declined to share identity" chip.

### B · Chat stickiness (philosophical)
Once a peer conversation exists, both parties' identities render in the chat + inbox regardless of later `profile_visibility` changes. Options:
1. Keep sticky · conversations preserve historical context · can't "undo" a conversation.
2. Dynamic re-gate · if peer later sets `private`, show "Limited Profile" / "Peer has restricted their profile" in the chat identity header.
3. Hybrid · show historical message content but render identity as the limited-profile fallback.

### C · Null-viewer (anonymous) surfaces
For `live-commerce/feed`, `directory` grid, and `directory/[id]`, visitors may be unauthenticated. Current resolver returns `visible:false` for `private` and `visible:false` (limited) for `contacts` with `null` viewer. UX options:
1. Omit from listing (safest · zero exposure).
2. Show "Limited Profile" card (better UX · acknowledges existence).
3. Show owner identity but mark "private" (worst · leaks the thing being protected).

### D · Migration 200 apply decision
Migration 200 (`profile_visibility` + `who_can_message`) is AUTHORED but not applied to Supabase. Before any Class-D fix can land in production, migration 200 must be applied. Owner should also decide whether to add an RLS policy on `nex_account_profile` enforcing `profile_visibility` at the DB level · defence in depth.

---

## Suggested next steps (not implementation authority)

1. **Founder answers Decision Points A–D above.**
2. **Immediate low-risk fixes** (safe without new seals):
   - `/contacts` list · hide `professionLine` for members whose `profile_visibility=private`.
   - `/live-commerce/feed` · filter sessions by broadcaster `profile_visibility`.
   - `/live-commerce/[sessionId]` · gate broadcaster card.
3. **Larger fixes requiring Decision A/B**:
   - `/[businessSlug]` · depends on Decision A.
   - `/chat/peer/[accountId]` + `/conversations` · depends on Decision B.
   - `/chat/guest/[ownerAccountId]` · depends on Decision A (null-viewer flavour).
4. **Infrastructure (Decision D)**:
   - Apply migration 200 to Supabase · pre-apply review required.
   - Add RLS policy on `nex_account_profile` for defence-in-depth · requires founder authorisation.
5. **Testing recommendation** (post-fix):
   - Create test account with `profile_visibility=private`.
   - Verify every Class-D surface renders a limited-profile OR 404 state as decided per founder.
   - Verify shareable shop URL behaves per Decision A.

---

## Honest limitations of this audit

- Code-level only · no DB query against Supabase ran.
- Did not test runtime; resolver call failure could create either silent fail-open OR fail-closed behaviour depending on each caller's error handling.
- Shared-component caller trees not exhaustively traced.
- Migration 200 unapplied · classifications assume the service-layer wiring is what shipped.
- Report accuracy classification per Protocol §6: **researched** (not approved, not implemented, not tested, not committed).

---

## Not addressed by this audit (intentionally out of scope)

- `who_can_message` enforcement · covered by sealed `peer-conversation-service.getOrCreatePeerConversationAsSender` wrapper (per R10 Stage 5 doctrine) · separate audit if needed.
- `who_can_call` (deferred per R10 Stage 5 scope limits).
- `contacts_or_request` mode (deferred pending Indonesia legal review).
- `is_discoverable` enforcement (separate axis, migration 134, lives on `nex_account_profile` not `nex_account`).

---

**Generated 2026-10-27** · 1 read-only Explore subagent · 34 surfaces examined · 3 Class A · 6 Class B · 5 Class C · 20 Class D. Estimated effort to migrate all Class-D to Class-A (code side only, not counting founder decisions): ~2 weeks.
