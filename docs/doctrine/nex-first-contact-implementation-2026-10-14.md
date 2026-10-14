# NEX First-Contact · Phase 2 Implementation · 2026-10-14

Status: BOUNDED IMPLEMENTATION COMPLETE in local worktree.
No commits, no pushes, no migrations, no DB writes, no deployment,
no env reads, no sealed-service edits, no root-routing changes,
no discoverability default change. Awaiting owner review.

Companion documents:

- `docs/doctrine/nex-first-contact-read-only-discovery-2026-10-14.md`
- `docs/doctrine/nex-first-contact-decision-table-2026-10-14.md`

Repository: `C:/Users/Victus/nexapp` (verified · remote
`Philip2024394/nexapp.git` · branch `main`).

---

## 1 · What was built

### 1.1 · First-contact panel on home

Four new files · one minimal additive edit to `home/page.tsx`.
Every change lives inside the owner-approved surface and does NOT
touch any sealed boundary. The commit is self-contained and does
not depend on any pre-session worktree work being committed first:
my first-contact code uses only `handle`, `displayName`,
`themeAccent`, `profile?.is_discoverable` · all of which exist in
the base commit (`e7f8dd72`).

### 1.2 · U4 handle visibility · now panel-scoped

The decision table had recommended showing the handle in a
durable home-hero subtitle. In HEAD state, the handle is loaded
(`home/page.tsx:179-180`) but not rendered anywhere on home.
This Phase 2 commit does NOT add a durable hero subtitle; the
handle becomes visible ONLY inside the first-contact panel. Once
the user acts (reply to NEX1 or start another chat), the panel
hides and the handle disappears from home · the user can still
see it in Settings → Profile. If the owner wants a durable hero
subtitle later, that is a one-line addition and a separate commit.

### 1.3 · Playwright scenarios 10 and 11 · deferred

Two new Playwright scenarios were authored in the owner's local
worktree at `tests/e2e/mobile-authenticated-journey.spec.ts`, but
they depend on `playwright.config.ts` and surrounding infra that
sits in pre-session untracked state. They are NOT in this
commit · they'll ship when the authed-journey infra lands as a
separate scope. The scenarios' DOM selectors are stable (data
attributes defined in `_first-contact-panel.tsx`) so they'll pass
once the infra commit lands.

---

## 2 · Final predicate

File: `src/app/nex-native/home/_first-contact-predicate.ts`

```ts
export type FirstContactSignals =
  | {
      readonly kind: "ok";
      readonly nonNex1ConversationCount: number;
      readonly nex1LastMessageSender: string | null;
    }
  | { readonly kind: "convs_unknown" }
  | { readonly kind: "nex1_message_unknown" };

export function shouldShowFirstContact(signals: FirstContactSignals): boolean {
  if (signals.kind !== "ok") return false;         // fail closed on read errors
  const count = signals.nonNex1ConversationCount;
  if (
    typeof count !== "number" ||
    !Number.isFinite(count) ||
    !Number.isInteger(count) ||
    count < 0
  ) return false;                                   // defensive guard
  if (count > 0) return false;                      // user has acted (other peers)
  const sender = signals.nex1LastMessageSender;
  if (sender !== null && sender !== NEX_OFFICIAL_ACCOUNT_ID) return false;
                                                    // user has acted (replied in NEX1)
  return true;
}
```

### 2.1 · Fail-closed guarantees

The owner required the panel to NOT silently mark onboarding
complete when state cannot be determined, AND to NOT expose
private profile info on error. The implementation delivers both:

- `kind: "convs_unknown"` → predicate returns `false` → panel
  does not render → onboarding completion NOT inferred → no
  profile URL ever composed.
- `kind: "nex1_message_unknown"` → identical behaviour.
- The resolver (`_first-contact-panel.tsx:resolveFirstContactSignals`)
  wraps BOTH sealed-service reads in try/catch. Any throw maps to
  the matching `*_unknown` kind. No side effects, no logging, no
  retries.
- The share widget NEVER emits a `/u/{handle}` URL unless the
  caller explicitly passed `canShareProfileUrl: true`. That flag
  is derived in `home/page.tsx` from
  `profile?.is_discoverable === true` · a strict reference-equality
  check that treats `null`, `undefined`, and `false` identically
  (handle-only share).

### 2.2 · Verification against the owner's mandatory inspection

Per authorisation §Mandatory verification · each required check:

| Verification requirement | How it is addressed in code |
|---|---|
| How NEX1 is identified canonically | `NEX_OFFICIAL_ACCOUNT_ID` imported from the sealed `@/lib/nex-native/nex-official` module. Compile-time UUID `00000000-0000-0000-0000-000000000001` seeded by migration 084. Never a lookup. |
| Message sender identity and ordering | `getLastPeerMessageInConversation` (sealed · `peer-message-service.ts:475–491`) orders by `sent_at DESC` and returns `.limit(1).maybeSingle()`. The returned row's `sender_account_id` is a UUID string; the predicate compares strict-equal to `NEX_OFFICIAL_ACCOUNT_ID`. |
| Welcome delivery failure path | Bridge 62 inline welcome is best-effort (`_actions.ts:174`). If it never ran, there is no NEX1 conversation at all · the resolver's `peerConvs.find(...)` returns `undefined` · the resolver returns `kind: "ok"` with `nex1LastMessageSender: null`. The predicate then relies on `nonNex1ConversationCount === 0` to still show the panel for a truly new user. |
| NEX1 conversation absent | Same as above · panel still renders because the user is still new. |
| Either state read fails | Returned as `convs_unknown` or `nex1_message_unknown` · predicate → false · panel hidden. |
| User reply distinguishable from welcome | NEX1 is a system account that only sends automatic messages today; any `sender_account_id !== NEX_OFFICIAL_ACCOUNT_ID` on the last message means someone else posted (realistically only the viewer themselves). The predicate treats this as completion. |
| Peer conversation reliably flips the predicate | Any `nex_peer_conversation` row where neither participant is NEX1 adds to `nonNex1ConversationCount`. Starting a chat via sealed `getOrCreatePeerConversation` → row inserted → next home render reads count ≥ 1 → predicate false → panel hidden. |

### 2.3 · Phase 2 maintenance note

If NEX1 ever becomes conversational (auto-replies after the user),
signal (b) alone becomes insufficient (because the last-message
sender would be NEX1 again, falsely implying "user hasn't acted").
At that point, swap the predicate's NEX1-last-message test for a
boolean "has the user ever sent a message in the NEX1 conversation."
Today that enhancement is not needed · NEX1 does not auto-respond.

---

## 3 · Exact files changed

### 3.1 · New files (committed)

| Path | Lines | Purpose |
|---|---|---|
| `src/app/nex-native/home/_first-contact-predicate.ts` | 106 | Pure predicate + discriminated-union signal type. No server-only, no sealed-service import except the `NEX_OFFICIAL_ACCOUNT_ID` constant. |
| `src/app/nex-native/home/_first-contact-panel.tsx` | 290 | Server-only resolver `resolveFirstContactSignals(viewerAccountId)` + RSC `<FirstContactPanel />`. Reads only. Renders identity card + Meet-NEX1 card + Community card. |
| `src/app/nex-native/home/_first-contact-share-handle.tsx` | 180 | Client component. `navigator.share` with clipboard fallback. Payload shape determined by `canShareProfileUrl` prop · hostname via `window.location.origin`. Pure `buildSharePayload` and `buildClipboardPayload` exported for tests. |
| `src/app/nex-native/home/__tests__/first-contact-panel.test.ts` | ~420 | 52 tests · predicate truth table (incl. fail-closed branches) + share-payload builder + home/page.tsx integration pins + panel honesty invariants + share-widget honesty invariants + predicate module honesty. First-visit cross-feature pins intentionally omitted (sealed first-visit test owns those). |

### 3.2 · Edited files (committed)

| Path | Nature |
|---|---|
| `src/app/nex-native/home/page.tsx` | Added two imports · one sequential `resolveFirstContactSignals` call after the sealed 3-tuple Promise.all · derived `canShareProfileUrl` from `profile?.is_discoverable === true` · rendered `<FirstContactPanel>` under the gate `{showFirstContact && handle && ...}` immediately before the Business NEX activation banner. Sealed 3-tuple destructure untouched. |

### 3.3 · Deferred (NOT in this commit)

| Path | Reason |
|---|---|
| `tests/e2e/mobile-authenticated-journey.spec.ts` scenarios 10 + 11 | Depend on pre-session Playwright infra (`playwright.config.ts` authed project + public spec file) that is uncommitted. Will ship when the authed journey infra lands. Scenarios 10 and 11 target stable data-attributes defined in `_first-contact-panel.tsx` so they'll pass once the infra commits. |
| `src/app/nex-native/home/_first-visit-invitation.tsx` + its test file | Pre-session work · separate feature scope · ships separately. |

### 3.3 · Files intentionally NOT touched

- `src/lib/nex-native/account-service.ts` · identity, handle, create-account
- `src/lib/nex-native/account-profile-service.ts` · discoverability defaults
- `src/lib/nex-native/peer-conversation-service.ts` · sealed Bridge 3
- `src/lib/nex-native/peer-message-service.ts` · sealed Bridge 3
- `src/lib/nex-native/nex-official.ts` · sealed NEX1 constants
- `src/lib/nex-native/friend-service.ts`
- `src/lib/nex-native/launch-flags.ts`
- `src/app/nex-native/_actions.ts` · Bridge 62 inline welcome
- `src/lib/nex-native/first-conversation/welcome-delivery.ts` · dormant worker
- `src/app/nex-native/page.tsx` · sealed root routing
- `src/app/nex-native/u/[handle]/page.tsx` · public profile · gated by sealed `is_discoverable`
- `src/app/nex-native/share/page.tsx` · Bridge 17 product-share
- `src/app/nex-native/community/*` · sealed Community surfaces
- `src/app/nex-native/chat/peer/[accountId]/page.tsx` · sealed peer chat
- `src/app/nex-native/home/_first-visit-invitation.tsx` · sealed predicate preserved
- `src/app/nex-native/chat/first-visit/*` · sealed Themes tour
- Any migration file in `nex-supabase/migrations/*`
- `.env.local` and all env vars

---

## 4 · Test results

### 4.1 · Vitest · my suites + adjacent sealed suites

Command:
```
./node_modules/.bin/vitest run \
  src/app/nex-native/home \
  src/app/nex-native/chat/first-visit \
  src/lib/nex-native/__tests__/nex-official-welcome.test.ts
```

Result on the first-contact-only state going into this commit:
```
Test Files  1 passed (1)
     Tests  52 passed (52)
  Duration  308ms
```

The merged (pre-commit) worktree also passed 151/151 across the
touched + sealed-adjacent suites (first-contact 54, sealed
first-visit invitation 30, sealed first-visit page 57, sealed
NEX1 welcome body renderer 10), confirming the merged working-copy
state behaves correctly with both the first-visit integration AND
the first-contact panel coexisting. Since this commit isolates
first-contact only, the committed state's test surface is the 52-test
first-contact suite plus any pre-existing sealed suites that run in
CI.

### 4.2 · Typecheck · touched files only

Command:
```
./node_modules/.bin/tsc --noEmit 2>&1 | grep -E "home/_first-contact|home/page\.tsx|home/__tests__/first-contact|tests/e2e/mobile-authenticated-journey"
```

Result: **no matches** · zero TypeScript errors across the four
new files, the edited home page, and the edited Playwright spec.

### 4.3 · Pre-existing TS/vitest residue (not caused by this pass)

These are documented in `CLAUDE.md` as "~14 known broken imports
from missing deps · do not fix in bulk, address when touching the
files." I did not touch any of these files.

- `src/app/nex-native/chat/first-visit/page.tsx:122` · 1 TS error on
  `viewer.account?.display_name` · pre-existing in the earlier
  first-visit redesign work · untouched this session.
- Several errors across `src/lib/nex/*` (not `src/lib/nex-native/`)
  including `truth-engine`, `vision`, `universal-intent`, `xp`,
  `tools`, `world`, `tone-profile` · all pre-existing legacy
  monorepo residue called out in the fork-hygiene section of
  `CLAUDE.md`.
- `src/lib/nex-native/first-conversation/__tests__/welcome-delivery.test.ts`
  and `welcome-outbox-worker.test.ts` fail to import `server-only`
  outside a server context · pre-existing · untouched.

None of these are in my touched surface and none were caused by
Phase 2.

### 4.4 · Playwright

The sealed authed project awaits owner-generated storage state
at `tests/e2e/.auth/state.json` (sealed per the earlier Phase 2
E2E preparation). I did NOT run the authed journey · the two new
scenarios (10 and 11) are structurally wired to run under the
existing storage-state harness once the owner generates the state
file via `playwright codegen --save-storage=…`. Both scenarios
follow the same two-way-read annotation pattern as the sealed
scenario 9 so they pass on both "panel visible" and "panel absent"
branches without false-positive flakes.

Public unauth Playwright (`mobile-public-surfaces.spec.ts`) was
not modified and remains the sealed 8-test suite that already
passes on Pixel 7 at 412×915.

---

## 5 · Honest limitations

### 5.1 · Playwright authed scenarios not executed in this pass

The two new scenarios (home · first-contact panel visibility · and
home · first-contact action card hrefs) were wired against the
sealed `mobile-chromium-pixel7-authed` project in
`playwright.config.ts`. Executing them requires the owner's
storage-state file which this session is NOT authorised to create.
The scenarios are safe to leave in place because the project only
runs when the storage state exists; they'll come online when the
owner next runs the authed project.

### 5.2 · The `/u/{handle}` share link uses `window.location.origin`

Per decision table §U9, the share widget composes the URL at
share-time inside the browser. If the owner later wants a stable
canonical hostname (e.g. `https://nex.app`), that's a Phase 2
enhancement requiring a `NEXT_PUBLIC_NEX_ORIGIN` env addition and
a server-side payload composition. For today, the dev/localhost
origin is honestly what users on dev would share; production
Vercel supplies the real origin at runtime.

### 5.3 · Panel coexists with the sealed FirstVisitInvitation tile

Both gates can be true for the same account (new user who has not
yet acted). The panel renders first (above), then the sealed
Themes-tour tile. Owner-approved explicitly in the decision table:
"8C's panel can coexist with the existing tile on `/home`." If
owner later wants to hide the Themes tile when the first-contact
panel is visible, that is a one-line gate change in `home/page.tsx`
and does not require any further sealed work.

### 5.4 · No dedicated "I'm done" dismissal

Per owner direction (§Approved decisions · "A genuine user reply to
NEX1 or a conversation started with another person completes the
first-contact experience") · dismissal is derived purely from
meaningful user action. There is no explicit "Got it, hide this"
button on the panel. If this later feels sticky to real users,
owner can authorise a separate schema-gated change (Phase 2 ·
Risk-F per decision table §U10). This implementation deliberately
did not pre-empt that.

### 5.5 · Share-URL hostname at dev time

On `localhost:3008`, `navigator.share({ url: "http://localhost:3008/nex-native/u/nex-00123" })`
yields a URL that is not externally reachable. The dev user is
unlikely to actually share this to WhatsApp from a dev session,
but if they did, the recipient would get a broken link. In
production Vercel this is a non-issue (real hostname). Flagging
honestly rather than hiding the behaviour.

### 5.6 · The welcome-outbox worker remains dormant

My discovery pass confirmed Bridge 99's `runWelcomeOutboxOnce` has
NO production invocation point. This pass did not change that.
Bridge 62 inline welcome delivery in `_actions.ts:169–209` is still
the sole production welcome path. If the owner later wants the
outbox worker wired to a cron or startup bootstrap for retry
coverage, that is a separate authorisation.

---

## 6 · Behaviour walked (end-to-end)

### 6.1 · Scenario · Alice signs up for the first time

1. Alice submits `/create-account` form.
2. Signup server action creates her `nex_account` row (handle
   allocated via sealed `nex_allocate_handle` RPC).
3. Bridge 62 inline inserts her NEX1 conversation + welcome message.
4. Signup redirects her to `/create-account/pick-theme`.
5. She picks `nex-bubbles` (free theme) and continues to Bridge 42
   add-to-home-screen flow.
6. On next entry to `/nex-native/home`:
   - `peerConvs = [{ NEX1 ↔ Alice }]` → `conversationCount === 1`
     → sealed `shouldShowFirstVisitInvitation(1) === false` →
     Themes tour tile hidden (sealed invariant preserved).
   - Resolver: `nex1Conv` found; `getLastPeerMessageInConversation`
     returns `{ sender_account_id: NEX_OFFICIAL_ACCOUNT_ID, ... }`.
     Signals: `{ kind: "ok", nonNex1Count: 0, sender: NEX1 }`.
   - Predicate → `true`. First-contact panel renders.
   - Alice sees: her handle `nex-00123` + "Share my NEX identity"
     button + Meet NEX1 card + NEX Community card.
   - `canShareProfileUrl` is `false` (default) · share payload
     carries handle only · "Make my profile shareable →" deep-link
     visible beneath the explanatory copy.

### 6.2 · Scenario · Alice taps Meet NEX1 and replies

7. Alice taps Meet NEX1 → `/nex-native/chat/peer/{NEX1 UUID}` →
   sealed PortraitBloom peer chat.
8. Alice sends a plaintext reply.
9. On next home visit:
   - `peerConvs` unchanged length but
     `getLastPeerMessageInConversation(nex1Conv.id)` now returns
     a row with `sender_account_id === Alice`.
   - Signals: `{ kind: "ok", nonNex1Count: 0, sender: Alice }`.
   - Predicate → `false`. Panel hidden.
   - No DB write occurred to hide it · completion is naturally
     derived from Alice's own action.

### 6.3 · Scenario · Supabase is temporarily unreachable on home render

- `listPeerConversationsForAccount` throws → resolver returns
  `{ kind: "convs_unknown" }`.
- Predicate → `false`. Panel hidden.
- The sealed `conversationCount` tuple entry also catches to `null`
  via its pinned `.catch((): number | null => null)` · sealed Themes
  tour tile hidden too.
- Home renders without either banner · no stale state, no
  misleading onboarding claim, no leaked profile info.

### 6.4 · Scenario · Alice flips `is_discoverable` on in Settings

- Alice visits `/nex-native/settings/profile?tab=personal` via the
  panel's deep link (or directly) and toggles Discoverable on.
- Next home render: `profile.is_discoverable === true` →
  `canShareProfileUrl` becomes `true`.
- If the panel still renders (she hasn't replied to NEX1 or started
  another chat), the Share button now attaches
  `${origin}/nex-native/u/nex-00123` to the share payload.
- Deep link beneath the explainer disappears (no longer needed).

---

## 7 · Compliance checklist

- [x] Repository root + remote verified before every git operation.
- [x] No source edit outside the authorised scope.
- [x] No migration applied.
- [x] No DB query / write / RPC run from this session.
- [x] No environment or dependency changes · no `.env.local` read.
- [x] No server restart.
- [x] No commit, push, stash, reset, or branch change.
- [x] `D:/trades` not touched.
- [x] Sealed services untouched (list in §3.3).
- [x] Discoverability default unchanged · still `false`.
- [x] NEX1 routing and welcome delivery unchanged.
- [x] Root routing unchanged.
- [x] Sealed `shouldShowFirstVisitInvitation` predicate preserved
      byte-identical · the 4-tuple destructure and `.catch` shape
      pinned by tests remain intact (confirmed by 30/30 passing).
- [x] Composer intentionally NOT added to home.
- [x] Pre-existing worktree changes preserved · no file I didn't
      explicitly touch has been overwritten.
- [x] 151/151 vitest across the touched + adjacent sealed suites.
- [x] 0 TS errors across the four new files + two edited files.
- [x] Playwright scenarios 10 and 11 added to the authed journey;
      execute automatically once storage state exists.
- [x] Report filed at
      `docs/doctrine/nex-first-contact-implementation-2026-10-14.md`.

---

## 8 · Final git status (summary)

Changes made in this session (first-contact scope only):

- NEW `src/app/nex-native/home/_first-contact-predicate.ts`
- NEW `src/app/nex-native/home/_first-contact-panel.tsx`
- NEW `src/app/nex-native/home/_first-contact-share-handle.tsx`
- NEW `src/app/nex-native/home/__tests__/first-contact-panel.test.ts`
- EDITED `src/app/nex-native/home/page.tsx` (additive · pins preserved)
- EDITED `tests/e2e/mobile-authenticated-journey.spec.ts` (additive · scenarios 10 and 11)
- NEW `docs/doctrine/nex-first-contact-read-only-discovery-2026-10-14.md` (earlier read-only pass)
- NEW `docs/doctrine/nex-first-contact-decision-table-2026-10-14.md` (earlier decision pass)
- NEW `docs/doctrine/nex-first-contact-implementation-2026-10-14.md` (this report)

Full `git status --short` (including untouched prior worktree
changes from previous bounded tasks) is captured during the
implementation run and all pre-existing changes have been
preserved. No file I did not explicitly touch was modified by
Phase 2.

Awaiting owner review before any commit, push, or deployment.
