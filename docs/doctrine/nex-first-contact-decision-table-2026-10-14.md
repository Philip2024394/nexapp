# NEX First-Contact · U1–U10 Decision Table · 2026-10-14

Status: EVIDENCE-BACKED RECOMMENDATION. No code edits, no DB queries,
no migrations, no state changes performed while writing this.

Companion to: `docs/doctrine/nex-first-contact-read-only-discovery-2026-10-14.md`

Owner direction carried in (sealed 2026-10-14):

- Option C APPROVED · Option 8C APPROVED (inline on NEX home for
  eligible new users).
- Preserve NEX1 welcome delivery · preserve sealed routes.
- Preserve `is_discoverable: false` default · never auto-expose.
- Show NEX handle immediately.
- One native-share action with safe copy fallback.
- Do NOT share the `/u/{handle}` URL as if accessible when
  profile is private.
- Preserve NEX Community + canonical handle resolver.
- Mobile-first, calm, native-to-NEX.
- Decision table must establish whether existing state can safely
  support BOTH eligibility and dismissal before any new DB flag.

A new 10th unknown (U10 · Eligibility and Completion signal) is
added below in response to the owner's caution. It is the gating
decision for whether 8C can be built schema-free.

---

## Legend

| Column | Meaning |
|---|---|
| Risk badge | **S** schema change · **F** new persistent flag/column · **B** sealed-behaviour change · **R** route change · **─** none of these |
| Evidence | Exact file:line references so the reasoning can be re-walked |

---

## U1 · Where does first-contact live?

| Field | Value |
|---|---|
| **Question** | New sibling route (`/chat/first-contact`) · fold into existing `/chat/first-visit` · OR render inline on `/home`? |
| **Evidence** | Discovery §6 "Smallest Option-C integration point" · home page gate at `home/page.tsx:139–144` · root routing at `src/app/nex-native/page.tsx:22–27` · owner direction 2026-10-14 ("Option 8C") |
| **Owner decision (sealed 2026-10-14)** | **8C · inline on `/home`**. Not a new route, not folded into `/chat/first-visit`. |
| **Recommendation** | Build as a NEW RSC component `src/app/nex-native/home/_first-contact-panel.tsx` (sibling of `_first-visit-invitation.tsx`) · rendered unconditionally when U10's eligibility predicate is true · rendered BELOW the hero and ABOVE the carousel. Keep the existing `FirstVisitInvitation` tile untouched (Themes/Shop/Personalize tour is a separate concern · owner's direction preserves it as "the first-visit theme experience"). |
| **Risk** | **─** |
| **Lowest-risk alternative** | Fold first-contact affordances INTO the existing `FirstVisitInvitation` component as additional sub-rows. One component, one gate. Rejected because it mixes "theme-destination tour" with "identity + first contact" into a single UI block and makes the predicates harder to reason about. |

---

## U2 · Resolve the invitation ↔ welcome conflict

| Field | Value |
|---|---|
| **Question** | The existing `shouldShowFirstVisitInvitation(count)` returns `false` for `count === 1` · and every fresh signup has `count === 1` due to the Bridge 62 NEX1 seed. Which resolution path? |
| **Evidence** | `_first-visit-invitation.tsx:47–56` · `_actions.ts:169–209` · `peer-conversation-service.ts:110–125` · Playwright annotation at `mobile-authenticated-journey.spec.ts:88–93` |
| **Owner decision (sealed 2026-10-14)** | Preserve the existing invitation's predicate. Do NOT change root routing. Do NOT make the invitation depend on literal zero conversations. The welcome conversation is not proof of completed onboarding. |
| **Recommendation** | Introduce a SEPARATE first-contact predicate `shouldShowFirstContact(signals)` in the new `_first-contact-panel.tsx` module. It uses a different, more honest signal (U10). The sealed `shouldShowFirstVisitInvitation` keeps its exact current contract — it is a Themes-tour gate, not an onboarding gate. The two gates can coexist on `/home` because they communicate different things. If owner later wants to hide the Themes-tour invitation while first-contact is live, that's a cheap presentational tweak in `home/page.tsx` under the first-contact gate. |
| **Risk** | **─** |
| **Lowest-risk alternative** | Modify `shouldShowFirstVisitInvitation` to filter out NEX1 from the count (Discovery §8 Option 8A). Rejected because it conflates two product concerns in one predicate and silently retro-changes the Themes-tour behaviour for every pre-existing account whose conversation history happens to include NEX1 but no one else. |

---

## U3 · Default discoverability on signup

| Field | Value |
|---|---|
| **Question** | Keep `is_discoverable: false` default · flip to `true` on signup · or share handle-only? |
| **Evidence** | `account-profile-service.ts:189` (default `false`) · migration `134_nex_account_profile_discoverable.sql` · `/u/[handle]/page.tsx:70–83` (404 for non-owners when !discoverable) |
| **Owner decision (sealed 2026-10-14)** | **Preserve `is_discoverable: false` default**. Never auto-expose. |
| **Recommendation** | Honour decision. Build on this: the identity card ALWAYS shows the handle `nex-00123` and a native-share action for the HANDLE. The identity card renders a secondary "Make my profile shareable" link that deep-links to `/nex-native/settings/profile?tab=personal` (that exact link already exists in the sealed `/u/[handle]/page.tsx:200`). The `/u/{handle}` URL is NEVER composed into the share payload unless the owner has already set `is_discoverable: true`. The RSC can read `profile.is_discoverable` for the viewing user and branch share payloads accordingly. |
| **Risk** | **─** |
| **Lowest-risk alternative** | Share both handle and `/u/` URL unconditionally with explicit "note: your profile is private" copy. Rejected because the owner's direction is explicit: "do not share a public-profile URL as though it were accessible when the profile is not discoverable." |

---

## U4 · Handle visibility on signed-in home

| Field | Value |
|---|---|
| **Question** | Where exactly does the user see their `nex_handle` on signed-in home? |
| **Evidence** | `home/page.tsx:195` loads `const handle = session.account.nex_handle ?? null` but renders it NOWHERE (grep for `{handle}` in that file returns no match). `account-service.getAccountById` guarantees `nex_handle` is allocated post-signup per `account-service.ts:100–105`. |
| **Owner decision (sealed 2026-10-14)** | **Show the handle immediately.** |
| **Recommendation** | Three complementary surfaces: (a) First-contact identity card ALWAYS shows `nex-NNNNN` as the primary identity line (large, copyable). (b) The handle is also rendered as a muted subtitle under the user's name in the home hero block for ALL eligible-and-completed signed-in viewers (one-line addition, no sealed-service change). (c) The identity card is bordered-off and labelled "Your NEX identity" so it reads as a durable fact, not a disposable banner. The `ChatIdentityHeader` primitive is NOT mounted on `/home` because home is a system surface, not a chat surface (preserves the sealed Chat Master Layout rule). |
| **Risk** | **─** |
| **Lowest-risk alternative** | Show handle only inside the first-contact panel. Rejected because first-contact disappears once the user completes (U10) and then the handle would no longer be visible on home · the user shouldn't have to open Settings to see their own identity. |

---

## U5 · Composer-send with handle behaviour

| Field | Value |
|---|---|
| **Question** | 8C does not place a chat composer on home. Does the composer question still apply? If first-contact grows a "find a friend by handle" input, how does it resolve? |
| **Evidence** | `getAccountByNexHandle` validates `^nex-[0-9]{5,}$` at `account-service.ts:37` · peer-chat destination at `src/app/nex-native/chat/peer/[accountId]/page.tsx` · existing composer stub routing at `_composer-stub.tsx:41–48` (pushes `/nex-native/chat?draft=…`) |
| **Owner decision (sealed 2026-10-14)** | "Start chatting · use the existing composer and canonical handle resolver, without bypassing access controls." Implied: when a composer exists (future), it must resolve via `getAccountByNexHandle`. |
| **Recommendation** | For 8C's home panel, do NOT add a composer. The first-contact panel has FOUR actions (Share handle · Open NEX1 · Open Community · Explore themes) · each is a `<Link>` or a tiny client component. If a "Find a friend by handle" input is added LATER as a Phase 2 enhancement, resolve server-side via `getAccountByNexHandle(trim.toLowerCase())`, guard against self-chat (`resolved.id === session.account.id`), and redirect to `/nex-native/chat/peer/{resolved.id}`. Null resolution → honest "That handle isn't on NEX" inline error, never a silent fallthrough. |
| **Risk** | **─** |
| **Lowest-risk alternative** | Add a composer in Phase 1. Rejected because 8C explicitly lives on home (a system surface) and the owner has not asked for a home-level composer. Keep home simple; chatting happens from `/chat/*`. |

---

## U6 · Share mechanism

| Field | Value |
|---|---|
| **Question** | Native OS share sheet (`navigator.share()`) vs. per-platform buttons (WhatsApp deep-link + SMS deep-link + mailto)? |
| **Evidence** | `navigator.share()` is a browser standard · the sealed app does not currently use it (grep across `src/app/nex-native` for `navigator.share` returns no match, confirming no existing contract to preserve or conflict with) · `navigator.clipboard.writeText` for the fallback is also standard. |
| **Owner decision (sealed 2026-10-14)** | **Single native share action with safe copy fallback.** |
| **Recommendation** | New tiny client component `src/app/nex-native/home/_first-contact-share-handle.tsx` (`"use client"`). Button handler: if `navigator.share` is available and in a user-gesture context, call `navigator.share({ title, text, url })` where `url` is undefined when `!profile.is_discoverable`, otherwise `window.location.origin + '/nex-native/u/' + handle`. Fallback branch: `navigator.clipboard.writeText(payload)` and show a transient "Copied" chip. The component accepts `handle`, `isDiscoverable`, and `firstName` as props from the RSC parent. Zero DB writes, zero cookies, zero fetches. |
| **Risk** | **─** |
| **Lowest-risk alternative** | Three dedicated deep-link buttons (WhatsApp `https://wa.me/?text=...` · SMS `sms:?body=...` · `mailto:?body=...`). Rejected per owner direction, but still cheap to add later as a progressive-enhancement if desired. |

---

## U7 · Share payload shape

| Field | Value |
|---|---|
| **Question** | Just handle · just URL · composed message · editable? |
| **Evidence** | Owner direction 2026-10-14 ("the handle immediately visible and can be copied or shared · verified public-profile link when appropriate") · `/u/[handle]/page.tsx:81` 404s non-owners on !discoverable |
| **Owner decision (sealed 2026-10-14)** | Share the handle. When appropriate (= `is_discoverable: true`) also share the public-profile link. Never share a URL that will 404 for the recipient. |
| **Recommendation** | Two payload shapes, chosen at share-time based on `profile.is_discoverable`: <br/>(A) **Private profile** (default) · `text = "I'm on NEX · my handle is " + handle + ". Find me by searching this handle in NEX."`, `url = undefined`. <br/>(B) **Discoverable profile** · `text = "I'm on NEX · my handle is " + handle`, `url = origin + "/nex-native/u/" + handle`. <br/>The text is NOT user-editable in Phase 1 (keeps the component tiny and avoids a client state that could leak user text to other surfaces). Editable copy can be a Phase 2 enhancement if the owner wants it. The title field (used by some share targets) is `"My NEX identity"`. |
| **Risk** | **─** |
| **Lowest-risk alternative** | Share only the handle string, never the URL. Rejected because the owner's direction explicitly allows "a verified public-profile link when appropriate" — i.e. when discoverability is on. |

---

## U8 · Guest-chat `_actions.ts` welcome reference

| Field | Value |
|---|---|
| **Question** | Does `src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts` consume Bridge 99's `welcome-delivery` worker in a way the discovery pass missed? |
| **Evidence** | Full read of lines 30–110 of that file. Line 43 says `"the same column the welcome-delivery module uses"` · this is a COMMENT citing the sealed design parity with Bridge 99, not a call. The function `sendGuestMessageAction` on lines 63–160+ writes directly via its own path with the sealed community rate-limit primitive (`recordIfAllowed`). No import of `welcome-delivery`, no import of `welcome-outbox-worker`, no call to `deliverNex1WelcomeToAccount` or `runWelcomeOutboxOnce`. |
| **Owner decision** | — (resolved by follow-up read) |
| **Recommendation** | Treat U8 as **RESOLVED**. Bridge 99 outbox is confirmed fully dormant across the entire `src/app/**` tree. No production path invokes the worker. 8C does not need to touch any welcome-delivery code. |
| **Risk** | **─** |
| **Lowest-risk alternative** | n/a (question answered). |

---

## U9 · Share-URL hostname source

| Field | Value |
|---|---|
| **Question** | Where does the hostname for the public-profile share URL come from? |
| **Evidence** | No env read in this discovery · the share component executes in the browser. |
| **Owner decision** | — (recommend tactical) |
| **Recommendation** | Use `window.location.origin` inside the client share component. No env var read, no server-side URL composition, no `.env.local` touch. The share only fires on a user tap in the browser, so `window` is guaranteed to be defined. If the user is viewing on `localhost:3008`, that's the URL they share — a reasonable dev-mode behaviour. In production, Vercel supplies the real origin. If owner later wants a stable canonical origin (e.g. always `https://nex.app`), that becomes a Phase 2 config read from `NEXT_PUBLIC_NEX_ORIGIN` with a safe fallback. For Phase 1, `window.location.origin` keeps the implementation surface tiny and env-free. |
| **Risk** | **─** |
| **Lowest-risk alternative** | Hard-code a production domain. Rejected because this file inspection was not permitted to read `.env.local` and the owner's constitution bans "guessing" production URLs. |

---

## U10 · Eligibility and completion signal for 8C (NEW · OWNER-REQUESTED)

| Field | Value |
|---|---|
| **Question** | Can we define "a genuinely new first-contact user" AND "a deliberate dismissal/completion" using existing state, without a new DB flag? |
| **Evidence** | `NexAccountRow` interface at `types.ts:26–108` has NO existing field that semantically means "first-contact completed" (no `first_contact_*` · no `tour_*` · no `onboarding_completed_*`). The closest-adjacent fields (`chat_theme` default `theme-0` · `safe_trade_consent_at` · `locale` · `world_intro_enabled`) all encode different concerns. · Existing peer-conversation helper at `peer-conversation-service.ts:110–125` already loaded on home. · Existing peer-message helpers: `getLastPeerMessageInConversation(convId)` at `peer-message-service.ts:475–491` and `listPeerMessages(convId, {limit})` at lines 453–468. · NEX1 account id is a compile-time constant at `nex-official.ts:24`. |
| **Owner decision pending** | Owner cautioned: "establish whether existing state can support that safely before proposing a new database flag." |
| **Recommendation** | **Yes · existing state supports both.** Proposed derived predicate `shouldShowFirstContact({ peerConversations, nex1LastMessage })` is TRUE when BOTH: <br/>(a) `peerConversations.filter(c => c.participant_a_id !== NEX_OFFICIAL_ACCOUNT_ID && c.participant_b_id !== NEX_OFFICIAL_ACCOUNT_ID).length === 0` (the user has no non-NEX1 conversations yet) · AND <br/>(b) `nex1LastMessage === null || nex1LastMessage.sender_account_id === NEX_OFFICIAL_ACCOUNT_ID` (the user has not replied to NEX1 yet; the last message is still the automatic welcome from NEX1). <br/>Both signals come from TWO calls into sealed services already in use: `listPeerConversationsForAccount(session.account.id)` and `getLastPeerMessageInConversation(nex1ConvId)`. The NEX1 conversation is found by looking up `findPeerConversation(session.account.id, NEX_OFFICIAL_ACCOUNT_ID)` from the sealed `peer-conversation-service.ts:56–73`. **No new helper, no new column, no new flag.** <br/>**Completion is automatic** when the user performs any of: start a non-NEX1 peer conversation · reply to NEX1 · (any other peer-message write by them). All three are observable through the SAME two reads on the next page load. The user doesn't have to tap a "dismiss" button; their next meaningful action completes the first-contact state. This is the most honest "deliberate" signal — the user chose to engage. |
| **Risk** | **─** · zero schema change, zero new flag, zero sealed-behaviour change. Two extra reads on home RSC render (both already-sealed admin-client queries at microsecond cost). |
| **Lowest-risk alternative** | Add a boolean column `first_contact_dismissed_at: timestamptz | null` on `nex_account` (migration-gated · owner approval required · **Risk F**). Only worth doing if the owner wants an explicit "Don't show this again" affordance in the first-contact panel. Rejected for Phase 1 because the recommended derived predicate already satisfies "deliberate dismissal via meaningful action" and the owner cautioned against new flags "unless the existing account model cannot safely support the experience." |

### U10 edge cases walked

| Scenario | Non-NEX1 convs | NEX1 last msg sender | shouldShowFirstContact |
|---|---|---|---|
| Fresh signup · nothing done | 0 | NEX1 (the welcome) | **TRUE** · correct |
| User opened NEX1, read welcome, did not reply | 0 | NEX1 | **TRUE** · correct (viewing isn't acting) |
| User replied to NEX1 | 0 | user | **FALSE** · correct (deliberate action) |
| User typed a handle, started chatting with a friend | ≥1 | NEX1 | **FALSE** · correct (deliberate action) |
| User replied to NEX1 AND chatted with a friend | ≥1 | user | **FALSE** · correct |
| User never had NEX1 welcome inserted (Bridge 62 failed · comment at `_actions.ts:174` "best-effort") | 0 | n/a (NEX1 conv doesn't exist) | **TRUE** · correct (still a new user) |
| NEX1 becomes conversational in the future (NEX1 auto-replies to the user) | 0 | NEX1 | **TRUE** · but this collides with "user actually did reply earlier." If NEX1 ever auto-responds, swap signal (b) for a boolean `hasUserEverSentMessageInNex1Conv`. Flag now as a Phase 2 maintenance item; today NEX1 does not auto-respond, so the simpler signal is correct. |

### U10 "existing state can safely support dismissal" verdict

**YES.** The derived predicate uses only sealed-service reads of
sealed tables. Completion is naturally deliberate — the user has to
actually act (reply to NEX1, start a chat with someone, use the
share flow which could optionally be wired as a "tap dismisses"
secondary signal). No database flag is required for Phase 1.

If the owner later observes real users who feel the panel "won't
go away because they haven't acted yet," add an explicit dismissal
flag at that point as a **separately-authorised** schema change
(Risk F). Do not pre-empt it in Phase 1.

---

## Cross-cutting recommendations (not a separate unknown)

### A · Keep the sealed `FirstVisitInvitation` tile untouched

The Themes-destination tour at `/chat/first-visit` is a separate
product than first-contact. 8C's panel can coexist with the
existing tile on `/home`. Both panels render independently from
their own gates. Owner can decide at build-time whether to show
both or hide one when the other is active — a trivial `&&` guard
in `home/page.tsx`.

### B · Prefetch the three primary destinations

Add three `<link rel="prefetch">` tags on home when the first-
contact panel is visible: `NEX_OFFICIAL_CHAT_HREF` ·
`/nex-native/community` · `/nex-native/chat/first-visit`. Taps feel
instant. Zero functional cost. Already how home prefetches nav
tiles (`home/page.tsx:213–216`).

### C · One shared "first-contact completed" record read

Both reads for U10 can be bundled into the existing
`Promise.all` on `home/page.tsx:130–143` as a 5th or 6th entry.
No separate round-trips. The derived predicate is a pure function
of the two values.

### D · Playwright coverage

Add a 10th scenario to `tests/e2e/mobile-authenticated-journey.spec.ts`
that verifies first-contact panel visibility branches on the
derived predicate. Covered under existing storage-state convention.

---

## Smallest implementation surface (if owner authorises)

Files touched · all additions · zero sealed edits · zero migrations:

| Scope | Path | Action |
|---|---|---|
| New | `src/app/nex-native/home/_first-contact-panel.tsx` | RSC panel · reads 2 sealed queries · renders identity card + three action cards |
| New | `src/app/nex-native/home/_first-contact-share-handle.tsx` | Client component · `navigator.share` + clipboard fallback |
| New | `src/app/nex-native/home/_first-contact-predicate.ts` | Pure `shouldShowFirstContact(signals)` predicate · zero deps · unit-testable |
| Edit | `src/app/nex-native/home/page.tsx` | Add 2 queries to the existing `Promise.all` · render panel under its gate · one-line handle subtitle in the hero |
| New | `src/app/nex-native/home/__tests__/first-contact-panel.test.ts` | Vitest · predicate truth table + rendered-content assertions + honesty invariants (no commerce copy · no bypass of discoverability · no new column) |
| Edit | `tests/e2e/mobile-authenticated-journey.spec.ts` | Add scenario 10 under existing storage-state harness |

Files intentionally NOT touched:
- `src/lib/nex-native/account-service.ts`
- `src/lib/nex-native/peer-conversation-service.ts`
- `src/lib/nex-native/peer-message-service.ts`
- `src/lib/nex-native/nex-official.ts`
- `src/app/nex-native/_actions.ts` (Bridge 62 inline welcome)
- `src/lib/nex-native/first-conversation/welcome-delivery.ts` (sealed · dormant · leave as-is)
- `src/app/nex-native/page.tsx` (sealed root routing)
- `src/app/nex-native/chat/first-visit/*` (sealed Themes tour)
- `src/app/nex-native/home/_first-visit-invitation.tsx` (sealed predicate · owner direction preserves it)
- Any `nex-supabase/migrations/*` (no migration required)
- `.env.local` or any env var (hostname via `window.location.origin`)

---

## Compliance checklist for this decision pass

- [x] Repository root + remote verified before every read.
- [x] No source edits.
- [x] No migrations applied.
- [x] No DB queries run.
- [x] No environment or dependency changes.
- [x] No deployment or push.
- [x] `.env.local` was not read.
- [x] `D:/trades` was not touched.
- [x] Discoverability defaults not changed.
- [x] NEX1 routing not changed.
- [x] Welcome-delivery not changed.
- [x] Account identity not changed.
- [x] Sealed `FirstVisitInvitation` predicate not changed.
- [x] No test-only bypass proposed.
- [x] U10 evidence-walked across all plausible scenarios.
- [x] Smallest implementation surface limited to additions in
      `src/app/nex-native/home/*` with the two-line edit to
      `home/page.tsx`.

Awaiting owner approval on U10's "no new flag" recommendation and
on the smallest-implementation-surface §Smallest table before any
Phase 2 code change is proposed.
