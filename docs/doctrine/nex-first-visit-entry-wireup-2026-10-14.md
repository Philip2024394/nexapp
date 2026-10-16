# NEX · first-visit experience entry wire-up · Option 1 · review

Date: 2026-10-14
Scope: connect the existing three-destination first-visit theme experience to the real user journey by rendering a conditional invitation tile on `/nex-native/home` for signed-in accounts with zero peer conversations.

Companions:
- `docs/doctrine/nex-free-chat-theme-first-visit-implementation-2026-10-14.md` (built the three destinations · the §Section 7-8 gap this task closes)
- `docs/doctrine/nex-package-feature-entitlement-map-2026-10-14.md` (confirmed Vault is not tier-gated; the first-visit tour correctly stays commerce-free)
- `docs/doctrine/nex-production-route-containment-review-2026-10-14.md` (B9/B10 initial pass · this is the opt-in follow-up)

---

## 1 · Final changed-file inventory

| Path | Change | Delta |
|---|---|---|
| `src/app/nex-native/home/page.tsx` | **Modified** · 4-import block + 1 Promise.all entry + 1 derived flag + 1 conditional render | **+26 / −1** |
| `src/app/nex-native/home/_first-visit-invitation.tsx` | **New** · 212 lines · pure predicate `shouldShowFirstVisitInvitation()` + RSC component `<FirstVisitInvitation />` + exported `FIRST_VISIT_DESTINATION` constant | new |
| `src/app/nex-native/home/__tests__/first-visit-invitation.test.ts` | **New** · 232 lines · 30 focused tests covering the predicate, the home integration, and the component structure | new |
| `docs/doctrine/nex-first-visit-entry-wireup-2026-10-14.md` | **New** · this review | new |

**No other file touched.** The 29 pre-existing tracked modifications + ~130 untracked docs/data/scripts preserved verbatim. Pre-task worktree size was 162 lines; post-task adds exactly three new entries (one modified, two new files).

---

## 2 · The actual entry point

### 2.1 · Where the invitation lives

A new RSC component `<FirstVisitInvitation />` renders inline on `/nex-native/home`, positioned **immediately after the three round nav tiles (Chat · Calls · Contacts) and immediately before the sealed Business NEX activation banner.**

```
┌────────────────────────────┐
│ NEX wordmark · 56px gradient│  (hero · untouched)
│ "Welcome home, <name>"      │
│ nex-handle                  │
├────────────────────────────┤
│ ⟳ Chat  📞 Calls  👥 Contacts│  (3 round quick-actions · untouched)
├────────────────────────────┤
│ ╔══════════════════════╗   │  ← NEW · first-visit invitation
│ ║ FIRST LOOK · 3 DESTS ║   │     (only when conversationCount === 0)
│ ║ Make NEX yours  • • •║   │
│ ║ Quick tour: themes…  ║   │
│ ║ TAKE THE TOUR    → →  ║   │
│ ╚══════════════════════╝   │
├────────────────────────────┤
│ Business NEX activation…    │  (sealed banner · untouched · still gated
│                             │   on `!businessNexActivated`)
├────────────────────────────┤
│ Theme × layout carousel     │  (sealed · untouched)
│ (5 slides)                  │
└────────────────────────────┘
```

Both the first-visit invitation and the existing Business NEX activation banner are *gentle invitations, never nags* (matching the sealed doctrine comment at `home/page.tsx:432`). A truly-new user who hasn't started chatting AND hasn't activated Business NEX will see both; starting a conversation naturally dismisses the first-visit invitation; activating business naturally dismisses the business banner. No persistent dismissal state introduced.

### 2.2 · Destination

Tapping the invitation navigates to `/nex-native/chat/first-visit` (the three-destination landing built in the previous bounded task). Its three cards — Chat Themes (live), Chat Themes Shop (honest Phase 2 preview), Personalized Themes (honest "coming soon") — all remain intact. **No file in `/nex-native/chat/first-visit/*` was touched by this task.**

---

## 3 · The conversation-count source · reliability contract

### 3.1 · Where the count comes from

`src/lib/nex-native/peer-conversation-service.ts:110-125` exports:

```ts
export async function listPeerConversationsForAccount(
  accountId: NexUuid,
): Promise<NexPeerConversationRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_peer_conversation")
    .select("*")
    .or(`participant_a_id.eq.${accountId},participant_b_id.eq.${accountId}`)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(
      `peer-conversation-service.listPeerConversationsForAccount: ${error.message}`,
    );
  }
  return (data as NexPeerConversationRow[]) ?? [];
}
```

Phase 2 feature-preservation audit established this file is byte-identical to the sealed D:/trades version. The function **either resolves to a row array OR throws**. There is no "loading" return state in the service — the server-side `await` means the home RSC either gets the final value or the thrown error.

### 3.2 · How home consumes it

Four parallel loads inside `Promise.all` (home/page.tsx:125-137):

```ts
const [profile, ownedBusinesses, themes, conversationCount] = await Promise.all([
  accountProfileService.getProfileByAccountId(session.account.id).catch(() => null),
  businessService.listBusinessesByOwner(session.account.id).catch(() => []),
  chatThemeService.listActiveThemes().catch(() => []),
  // First-visit invitation gate (B9/B10 follow-up · 2026-10-14):
  // RESOLVES ONLY when the peer-conversation query completes server-
  // side. A rejected promise maps to `null` which the predicate
  // treats as "unknown · don't invite". A resolved empty list maps
  // to 0 which is the sole case that shows the invitation.
  peerConversationService
    .listPeerConversationsForAccount(session.account.id)
    .then((rows): number | null => rows.length)
    .catch((): number | null => null),
]);
const showFirstVisitInvitation = shouldShowFirstVisitInvitation(conversationCount);
```

Then at render time:

```tsx
{showFirstVisitInvitation && (
  <FirstVisitInvitation accent={themeAccent} />
)}
```

### 3.3 · The predicate's truth table

| `conversationCount` input | `shouldShowFirstVisitInvitation` output | Reason |
|---|---|---|
| `0` (reliable zero) | **true** | Only truthy case · zero conversations loaded reliably |
| `1`, `2`, `5`, `100`, `MAX_SAFE_INTEGER` | false | Account already has conversations |
| `null` | false | Query errored or not yet resolved · fail-safe |
| `undefined` | false | Same as null |
| `-1`, `-100` | false | Impossible value · defensive |
| `NaN`, `Infinity`, `-Infinity` | false | Non-finite · defensive |
| `0.5`, `1.5` | false | Non-integer · defensive |
| string `"0"`, `{}`, `[]`, booleans | false | Type-system escape hatch · defensive |

All 10 of these cases are exercised in the tests (§Section 5).

### 3.4 · Why this is reliable (not just "empty array = new user")

The brief warned: *"Do not assume an empty client array means a user has never chatted."* That warning concerns client components where a hook may transiently return `[]` while a request is in flight. **The home page is a server component**: `await listPeerConversationsForAccount(id)` resolves to the DB's actual answer. There is no "in flight" state. If the query cannot complete (network, Supabase outage, auth boundary), the service throws, our `.catch` maps to `null`, and the predicate returns `false` — the invitation is hidden rather than wrongly shown.

The handling matrix:

| Server-side DB state | Service return | Promise state | `conversationCount` | Invitation renders? |
|---|---|---|---|---|
| 0 rows match | `[]` | resolved | `0` | **YES** |
| N≥1 rows match | `[row, ...]` | resolved | `N` | NO |
| Supabase error | — | rejected (thrown) | `null` | NO (fail-safe) |
| Server crash before await | — | — | — | 500 (page doesn't render at all) |
| Session unresolved | — | — | — | caller already redirected to `/sign-in` |

---

## 4 · Loading / error handling

### 4.1 · "Loading" is server-side implicit

RSC pages don't render until all `await`s complete. There is no observable loading state for a browser · the HTML either arrives with the invitation present or with it absent. The brief's requirement — "Do not display the invitation while conversations are loading" — is satisfied by Next's rendering model: the component is never emitted during the async wait.

### 4.2 · "Error" is fail-safe absent

If `listPeerConversationsForAccount` throws, the inline `.catch((): number | null => null)` turns the rejection into `null`, which `shouldShowFirstVisitInvitation(null)` returns `false` for. The invitation is omitted entirely. The rest of the home page (hero, nav tiles, business banner, carousel) renders normally with no new error surface.

### 4.3 · Why not a specific error UI

The brief said: "Do not display the invitation while loading or when loading fails." It did NOT say "render a 'can't check right now' message." Omitting the invitation entirely is the most honest fail-safe · the user sees their normal home, and the invitation reappears automatically on the next successful page load.

---

## 5 · Tests · exact commands and results

### 5.1 · Focused suite · 30 tests

```
$ ./node_modules/.bin/vitest run src/app/nex-native/home/__tests__/first-visit-invitation.test.ts
RUN  v4.1.11 C:/Users/Victus/nexapp
 Test Files  1 passed (1)
 Tests       30 passed (30)
 Duration    392ms
```

Three describe blocks:

| Block | Tests | What it exercises |
|---|---|---|
| `shouldShowFirstVisitInvitation · pure predicate` | 10 | Positive case (count=0 → true), 1+ counts → false, null/undefined → false, negatives → false, NaN/Infinity → false, non-integers → false, non-number types → false, destination constant |
| `home/page.tsx · integration with the first-visit invitation` | 12 | peer-conversation-service imported, local component+predicate imported, `.listPeerConversationsForAccount` added to Promise.all, destructures 4-tuple with `conversationCount`, `.catch` maps to `null`, flag derived via shared predicate, JSX guards the component with `showFirstVisitInvitation`, exactly ONE `<FirstVisitInvitation>` render site, `accent={themeAccent}` prop passed, NO redirect introduced, NO cookie/insert/update/upsert/rpc, sign-in redirect preserved, runtime/dynamic preserved |
| `_first-visit-invitation.tsx · structure` | 8 | Links to canonical destination, server-only (no "use client"), aria-label present, data attribute for e2e selectors, no onClick/onSubmit/cookies/forms, no sealed-service import (tier-gate / product-service / account-service / launch-flags / recordIfAllowed / vault-), accent prop with cyan default, mobile-safe (overflow:hidden + minWidth:0) |

### 5.2 · Combined regression

```
$ ./node_modules/.bin/vitest run \
    src/app/nex-native/home/__tests__/first-visit-invitation.test.ts \
    src/app/nex-native/chat/first-visit/__tests__/first-visit.test.ts \
    src/lib/nex-native/__tests__/launch-flags.test.ts \
    scripts/__tests__/validate-env.test.mjs \
    scripts/__tests__/assert-nexapp-cwd-and-remote.test.mjs
RUN  v4.1.11 C:/Users/Victus/nexapp
 Test Files  5 passed (5)
 Tests       267 passed (267)
 Duration    434ms
```

30 new + 41 first-visit pages + 22 launch-flags B9/B10 + 62 D10 validator + 112 Phase 3A guard = 267 total.

### 5.3 · Test coverage against the brief's 7 acceptance criteria

| # | Brief criterion | Test coverage |
|---|---|---|
| 1 | A reliably loaded account with zero conversations sees the invitation | `shouldShowFirstVisitInvitation(0) === true` + source-shape proving `showFirstVisitInvitation` derived from this |
| 2 | An account with one or more conversations does not see it | `shouldShowFirstVisitInvitation(1) === false` + 4 more positive-integer cases |
| 3 | Loading and error states do not incorrectly classify an account as new | `null`, `undefined`, `NaN`, non-numeric types all return false · integration test confirms `.catch((): number \| null => null)` is wired |
| 4 | Selecting the invitation opens /nex-native/chat/first-visit | `FIRST_VISIT_DESTINATION === "/nex-native/chat/first-visit"` + `href={FIRST_VISIT_DESTINATION}` on the `<Link>` |
| 5 | Existing home and conversation functionality remains intact | Zero file modified in `/chat/*`, `/conversations/*`, `/calls/*`, `/contacts/*`; the home modification is strictly additive (one import block, one Promise.all slot, one derived flag, one conditional node) |
| 6 | No automatic redirect occurs | `expect(HOME_SRC).not.toMatch(/redirect\(["']\/nex-native\/chat\/first-visit/)` enforced by test; the only `redirect(...)` call in home remains the sealed sign-in bounce |
| 7 | No conversation, account, theme or other user data is modified | Four separate assertions against `.insert`, `.update`, `.upsert`, `.rpc`, and `cookies().set(` |

### 5.4 · What the tests do NOT (and should not) claim

- Do NOT prove mobile viewport renders match any specific Figma. No Playwright run.
- Do NOT prove the actual Supabase query behaviour against a live database. The service-level test lives in `peer-conversation-service.ts` which Phase 2 confirmed byte-identical to D:/trades.
- Do NOT prove the invitation visually integrates with the exact home layout on every device. Source-shape assertions check overflow handling and minWidth; a Playwright viewport test is a Phase F B2 open item.

---

## 6 · Preserved · not touched

### 6.1 · Sealed surfaces untouched

| Surface | Status |
|---|---|
| Chat Master Layout primitives (`chat-chrome/*`) | ✅ untouched |
| Bridge 99 first-conversation chain | ✅ untouched |
| Vault B.1-B.6A chain | ✅ untouched |
| `tier-gate.ts` | ✅ untouched |
| `product-service.ts` | ✅ untouched |
| `account-service.ts` | ✅ untouched |
| `peer-conversation-service.ts` (sealed, byte-identical to D:/trades) | ✅ untouched (consumed only via public export) |
| `launch-flags.ts` | ✅ untouched |
| Migrations 191-196, 197 | ✅ untouched |
| Hammerex seed | ✅ untouched |
| Three first-visit pages built in previous task | ✅ untouched |

### 6.2 · User state untouched

- No DB write · `.insert` / `.update` / `.upsert` / `.rpc` absent from the diff
- No cookie set · `cookies().set(...)` absent
- No `localStorage` usage · absent
- No `nex_account` column added · no migration
- No change to signup redirects or middleware
- No change to the account identity model

### 6.3 · Existing user journey preserved

- Users with ≥1 conversation see the home page exactly as before (new conditional returns false)
- Guest / signed-out visitors still get redirected to `/sign-in` (unchanged line in home/page.tsx)
- The existing Business NEX activation banner, carousel, nav tiles, hero, and theme preloads all render in their original order and shape · one extra opt-in node slots in between the nav tiles row and the activation banner, nothing else moves

---

## 7 · Remaining limitations

| # | Limitation | Severity | Follow-up |
|---|---|---|---|
| L1 | Visitors who signed up weeks ago and never started a conversation also see the invitation. The predicate correctly identifies them as "zero conversations" but they're not strictly "new users" | Low · same visual treatment · users who want to skip can tap "Continue to NEX Chat" on the destination page | A `nex_account.first_visit_seen_at` column would let us distinguish "truly new" from "never-chatted-returner" if the owner wants that precision later. Deferred per the brief's "do not add migration" rule. |
| L2 | A user who dismisses the first-visit destination without starting a chat will see the invitation again on next home load | Low · gentle invitation per sealed doctrine · not a nag | Could add a dismissal cookie in a sealed follow-up; this task was explicit about not adding new state. |
| L3 | Mobile viewport Playwright coverage absent | Medium · same as Phase F B2 open item | Separate workstream |
| L4 | If Supabase latency on `peer_conversation` is high, home page TTFB increases by the slower of the four parallel queries. Realistically bounded by Supabase SLA | Low · the `Promise.all` already runs 3 other queries · adding a 4th parallel is minimal | Monitor if observed |
| L5 | Returning users who already have 1 conversation but accidentally deleted it would see the invitation again on next visit. Nex does not currently support conversation deletion at the user layer, so this edge case is theoretical | Low | — |

---

## 8 · Boundary compliance

| Boundary | Status |
|---|---|
| Repository root + remote verified via Phase 3A dev guard | ✅ (`guard=0`) |
| Pre-task worktree inventory recorded + preserved | ✅ · 162 lines pre; same 162 lines + 3 new entries post |
| No sealed Chat Master Layout, Bridge 99, Vault, tier-gate, product-service, account-service modification | ✅ (verified by grep in tests) |
| No migration 191-197 touched | ✅ |
| No Hammerex seed touched | ✅ |
| No commerce / payment / entitlement change | ✅ |
| No `.env.local` read | ✅ |
| No database access, no production service call, no deploy | ✅ |
| No dependency installed, no server start/stop | ✅ |
| No commit, push, pull, reset, clean, stash, branch change | ✅ |
| No D:/trades touch | ✅ |
| No other launch-readiness workstream begun | ✅ |
| First-visit three pages untouched | ✅ (verified by `git diff --stat src/app/nex-native/chat/first-visit/`) |
| Zero automatic redirect introduced | ✅ (test enforces) |
| Zero new persistent state (no cookie, no column, no localStorage) | ✅ (test enforces) |
| Returning users unaffected | ✅ (predicate returns false for count≥1) |
| Guests / provisional sessions unaffected | ✅ (sealed sign-in redirect preserved) |

---

## 9 · Definition-of-done check

> *"Eligible users can discover the three theme destinations from their normal NEX home screen, existing users are not interrupted, and no migration or new persistence mechanism is required."*

- ✅ **Eligible users** (reliably-resolved zero-conversation accounts) see a prominent "Make NEX yours" tile between the nav row and the business banner
- ✅ **From their normal NEX home screen** — same route, same layout, additive change
- ✅ **Existing users are not interrupted** — one or more conversations → predicate returns false → invitation absent from the DOM
- ✅ **No migration** · zero schema change
- ✅ **No new persistence mechanism** · no cookie, no column, no localStorage

Full pass on the definition of done.

### Recommended next step

If the owner wants to tighten the "eligibility" signal from "zero conversations" to "truly first visit," the honest next move is:

1. Add `nex_account.first_visit_seen_at TIMESTAMPTZ NULL` (one additive column migration)
2. Set it when the user first navigates to `/chat/first-visit` or clicks the invitation (one server action)
3. Change the predicate's gate to `conversationCount === 0 && firstVisitSeenAt === null`

That's a separately-authorised workstream · not actioned here. The current Option 1 implementation is complete and shippable.

Stopping. Awaiting owner review of the home-page diff + the 30-test focused suite + the 267-test combined regression.
