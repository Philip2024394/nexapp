# NEX First-Contact · Read-Only Discovery · 2026-10-14

Status: READ-ONLY INSPECTION ONLY. No files modified. No DB queries.
No tests executed. No commits. No pushes. Awaiting owner review before
Phase 2 implementation begins.

Repository: `C:/Users/Victus/nexapp` (verified · `Philip2024394/nexapp.git` · branch `main`).

Owner decision carried into this report:
> Decision: Option C, the combined first-contact experience, is the
> approved product direction. Implementation is NOT yet authorised.

---

## Executive summary

The approved Option-C experience is architecturally reachable with
small, bounded changes. All of the primitives it needs already exist
(ChatIdentityHeader, ChatComposerPill, NEX1 chat destination, NEX
Community, public profile at `/u/{handle}`, canonical handle→account
resolver). HOWEVER, three material gaps or conflicts must be resolved
by the owner before any build pass is authorised. The most important
is a mismatch between the home first-visit invitation gate and the
production signup welcome path: a fresh signup already has one peer
conversation (NEX1) by the time it reaches `/home`, so the sealed
`conversationCount === 0` predicate silently HIDES the invitation
tile for every brand-new user. Fixing this is a product decision, not
a quick patch — see §8 Conflict Analysis.

---

## 1 · Area 1 · `welcome-delivery.ts` and its callers

File: `src/lib/nex-native/first-conversation/welcome-delivery.ts` (187 lines)

### What `welcome-delivery.ts` is

- Bridge 99 · Stage 10 delivery adapter.
- Exported function: `deliverNex1WelcomeToAccount(input): DeliverWelcomeResult`
  (lines 77–118).
- Flow (lines 83–106):
  1. `accountService.getAccountById(account_id)` · fails loudly if missing.
  2. `getOrCreatePeerConversation(NEX_OFFICIAL_ACCOUNT_ID, account_id)`
     (line 91) · **does create a `nex_peer_conversation` row** if one
     is not already present.
  3. `renderNex1WelcomeBody({ first_name: account.display_name })`
     (line 97) · shared helper · identical to Bridge 62 output.
  4. `sendPeerMessage({ conversation_id, sender_account_id: NEX_OFFICIAL_ACCOUNT_ID, body, send_intent_id: outbox_id })`
     (lines 100–105).
- Exactly-once semantics via UNIQUE constraint
  `uq_nex_peer_message_send_intent` (migration 102 Part C) · catches
  duplicate-key error and reports `effect: 'already_delivered'`.
- Doctrinal boundaries listed at lines 40–45 (no account creation / no
  session / no fingerprint).

### Callers of `deliverNex1WelcomeToAccount` and `runWelcomeOutboxOnce`

Grep across the full repo:
- `src/lib/nex-native/first-conversation/__tests__/welcome-delivery.test.ts`
- `src/lib/nex-native/first-conversation/__tests__/section-13-remaining-acceptance.test.ts`
- `src/lib/nex-native/first-conversation/welcome-delivery.ts` (self)
- `src/lib/nex-native/first-conversation/welcome-outbox-worker.ts`
- `src/lib/nex-native/first-conversation/__tests__/welcome-outbox-worker.test.ts`
- `src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts`
  (grep hit · worth verifying whether this invokes the worker or only
  references its contract · see §9 unknowns)

**Material finding**: `runWelcomeOutboxOnce` is NOT invoked from any
`src/app/api/**` route, cron handler, or server-startup bootstrap in
this repo. The Bridge 99 outbox is BUILT but DORMANT — no production
path drives it. All welcome delivery in production flows through the
inline Bridge 62 code path (§2), not through the outbox worker.

### The actual production welcome path · Bridge 62 inline

File: `src/app/nex-native/_actions.ts`

- Lines 150–156: `accountService.createAccount({ supabase_user_id, display_name, phone_country_code, phone_national_number })`.
- Lines 169–209: Bridge 62 inline welcome. Explicit comment at line 169:
  > "Bridge 62 · welcome message from NEX1 · sealed 2026-09-29.
  >  Fires once per account · new signups land on /chat with NEX1
  >  already sitting in their friends list AND a real message waiting."
- Line 181: `peerConversationService.getOrCreatePeerConversation(NEX_OFFICIAL_ACCOUNT_ID, acc.id)`.
- Lines 190–201: dynamic-imports `renderNex1WelcomeBody` and calls
  `peerMessageService.sendPeerMessage({ conversation_id: conv.id, sender_account_id: NEX_OFFICIAL_ACCOUNT_ID, body, ... })`.
- Lines 203–207: any failure is best-effort — the welcome message is
  swallowed and signup still succeeds. There is NO retry queue in the
  inline path, no `nex_welcome_outbox` row, no later worker sweep.

### Confirmed signup-to-first-conversation lifecycle (production)

1. `createNexAccountAction` form posts to Server Action in `_actions.ts`.
2. `supabase.auth.signUp(...)` creates the auth user.
3. `accountService.createAccount(...)` inserts a `nex_account` row.
4. Inside the SAME action, Bridge 62 inline:
   - inserts the `nex_peer_conversation` row for (NEX1, new account),
   - inserts one `nex_peer_message` row (NEX1 → user) with the shared
     welcome body.
5. Signup redirects to `/nex-native/create-account/pick-theme`
   (`_actions.ts:242`).
6. After the pick-theme flow completes it redirects to
   `/nex-native/create-account/welcome` (sealed Bridge 42
   add-to-home-screen surface).
7. On subsequent sign-ins, the sealed root `/nex-native/page.tsx`
   routes signed-in users to `/nex-native/home`.

### Implications for the home first-visit gate

Because step 4 creates a `nex_peer_conversation` row for every new
account, by the time the user reaches `/nex-native/home` for the
first time, `peerConversationService.listPeerConversationsForAccount(session.account.id)`
returns a one-element array (NEX1 ↔ user). Therefore
`conversationCount === 1`, therefore `shouldShowFirstVisitInvitation(1)`
returns `false`, therefore the sealed `FirstVisitInvitation` tile does
**not** render for the user it was designed for.

See §8 for conflict analysis and resolution options.

---

## 2 · Area 2 · `nex-official.ts` and sealed NEX1 destination

File: `src/lib/nex-native/nex-official.ts` (42 lines)

Exports:
- `NEX_OFFICIAL_ACCOUNT_ID: NexUuid = "00000000-0000-0000-0000-000000000001"`
  (line 24) · seeded by migration 084 · never allocated to a real user.
- `NEX_OFFICIAL_HANDLE = "nex-00001"` (line 28) · below the sequential
  10000-counter boundary · never collides.
- `NEX_OFFICIAL_DISPLAY_NAME = "NEX"` (line 31).
- `NEX_OFFICIAL_CHAT_HREF = "/nex-native/chat/peer/${NEX_OFFICIAL_ACCOUNT_ID}"`
  (line 35–36) · canonical destination for "Chat with NEX".
- `isNexOfficialAccount(id): boolean` guard (lines 39–41).

**Verified NEX1 destination**: the sealed `/nex-native/chat/peer/[accountId]`
page handles the NEX1 conversation. Confirmed import at
`src/app/nex-native/chat/peer/[accountId]/page.tsx:79` ·
`isNexOfficialAccount` is already in use inside the peer-chat page
(suggesting the sealed page already has NEX1-specific branches).

**Shared welcome body** at `src/lib/nex-native/nex-official-welcome.ts`
(40 lines). Pure function `renderNex1WelcomeBody({ first_name })`.
Verbatim Bridge 62 output pinned by regression tests
`src/lib/nex-native/__tests__/nex-official-welcome.test.ts`.

**Rule**: `NEX_OFFICIAL_CHAT_HREF` is the ONLY authorised NEX1
destination. Option C must link here · never fabricate a new
`/chat/nex` or `/chat/official` route.

---

## 3 · Area 3 · `/nex-native/share` surface

Files:
- `src/app/nex-native/share/page.tsx` (317 lines)
- `src/app/nex-native/share/_share-picker.tsx` (277 lines)

### What `/share` is

Bridge 17 / 17f · PRODUCT SHARING ONLY. The URL contract is
`/nex-native/share?product={productId}&back={returnHref}`. Flow:

- Sign-in gated (lines 61–67): guests → `/nex-native/sign-in?next=…`.
- Resolves product via `productService.getProductById(productId)`
  (line 69); 404 on missing.
- Fetches viewer's accepted friends via
  `friendService.listFriends(session.account.id)` (line 79).
- Renders one row per friend with a pre-bound Server Action
  `shareProductToContactAction.bind(null, account.id)` (line 244).
- Submitting a row drops the product into that peer's chat as a
  Bridge 11 product card (attachment_type='product'; snapshot in
  attachment_meta).
- Client editor (`_share-picker.tsx`) handles the user's note +
  emoji shortcuts (`EMOJI_SHORTCUTS` at line 31).

### What `/share` is NOT

- NOT an identity/handle share surface.
- NOT reusable for "share my NEX ID with a friend" — the entire form
  binds to a specific product-id and routes to peer chat with a
  product card payload. Reusing it for identity sharing would be
  behavioural overload with no overlap in inputs or server actions.
- No OS Share Sheet usage · no `navigator.share()` · no
  `navigator.clipboard` affordance.

### Rule for Option C

Build a NEW identity-share affordance (small inline component · uses
`navigator.share()` with clipboard fallback) and leave `/share` alone.
Do NOT bend Bridge 17's product-share contract to carry a handle.

---

## 4 · Area 4 · `/nex-native/u/[handle]` public profile

File: `src/app/nex-native/u/[handle]/page.tsx` (631 lines)

### Route pattern + canonical URL

- Route: `/nex-native/u/{handle}` where `{handle}` is URL-encoded.
- Also accepts the digits-only shortcut: `/u/36474` → `nex-36474`
  (line 62).
- Example canonical URL: `/nex-native/u/nex-00123`.
- Normaliser (lines 60–62):
  ```ts
  const handle = decodeURIComponent(rawHandle).trim().toLowerCase();
  const normalised = handle.startsWith("nex-") ? handle : `nex-${handle}`;
  ```

### Discoverability gate · Phase 3A migration 134

File references: `nex-supabase/migrations/134_nex_account_profile_discoverable.sql`
exists on disk.

- Loads `profile = await accountProfileService.getProfileByAccountId(account.id).catch(() => null)` (line 70).
- `isDiscoverable = profile?.is_discoverable === true` (line 80).
- `if (!isDiscoverable && !isSelf) notFound()` (lines 81–83).
- Owner can preview their own even when !discoverable
  (`isSelf` branch).
- Owner-only `?preview=public` dress-rehearsal mode (lines 91,
  144–147, 216–265).

### Default state of `is_discoverable` for a new account

File: `src/lib/nex-native/account-profile-service.ts`
- Line 189: `is_discoverable: input.is_discoverable ?? false` on
  profile create.
- Line 224: `if ("is_discoverable" in patch) update.is_discoverable = !!patch.is_discoverable` on update.

**Material finding**: a brand-new account has
`is_discoverable: false` by default. If Option C shows the user
their canonical profile URL and encourages them to share it, the
first recipient will see `notFound()` unless the owner first flips
the toggle at `/nex-native/settings/profile?tab=personal`
(referenced inside the owner-preview banner at
`u/[handle]/page.tsx:200`).

### Public fields shown

- display_name (hero)
- handle (`nex-NNNNN`)
- avatar_url (or initials)
- profession
- location_label
- headline
- bio
- skills (array of strings)
- Verified-Personal pill (requires `avatar_face_verified && daily_activity`)
- Owned businesses (via `businessService.listBusinessesByOwner`)
- Joined date

Private fields explicitly NOT shown (footer at lines 616–629):
chat / phone / email / private settings / vault.

### Rule for Option C

Can share `/nex-native/u/{handle}` as the canonical "about me" URL.
The share affordance must either:
- (a) Prompt the user to flip `is_discoverable: true` first, or
- (b) Share only the handle string `nex-NNNNN` (not the `/u/` URL),
  or
- (c) Share BOTH, with explicit copy explaining that friends who
  tap the URL won't see the profile until the owner enables
  discoverability.

Owner decision required · see §9 Unknowns.

---

## 5 · Area 5 · Handle lookup + peer-chat flow

File: `src/lib/nex-native/account-service.ts`

### Canonical handle resolver

- `getAccountByNexHandle(handle: string): Promise<NexAccountRow | null>`
  (lines 34–47).
- Validates format at line 37: `/^nex-[0-9]{5,}$/`.
- Returns null on malformed input · never throws.
- Reads from `nex_account.nex_handle` via admin client.

**Rule**: this is the ONE resolver. Any handle→account lookup in
first-contact MUST use `getAccountByNexHandle`. Do not invent a
parallel lookup or infer UUIDs from handles client-side.

### Peer-chat destination

Route: `/nex-native/chat/peer/[accountId]`
- `page.tsx` is the sealed PortraitBloom surface for friend↔friend
  chat (file header at lines 1–15).
- `getOrCreatePeerConversation` creates the thread on first visit
  (`peer-conversation-service.ts:79–105` · idempotent · canonical
  (a, b) ordering enforced DB-side).
- RLS migration 047 enforces participant-only reads.
- Takes accountId as the path param, not handle. So if Option C
  wants "type a handle, start a chat", the flow is:
  1. Normalise + validate handle app-side (same regex as `/u/`).
  2. `accountService.getAccountByNexHandle(handle)` → account row.
  3. Guard: forbid self-chat (`acc.id === session.account.id`).
  4. Redirect to `/nex-native/chat/peer/{acc.id}`.

### Access checks visible from this inspection

The peer-chat page is signed-in gated via session resolution and
RLS enforces participant membership. The current `/share` page's
code at line 83 explicitly filters out `session.account.id` and
`business.owner_account_id` from the friend list — the same
self-chat guard applies. There is NO friend-edge requirement for
NEX1 specifically (the `NEX_OFFICIAL_CHAT_HREF` comment at
`nex-official.ts:16–17` confirms "it doesn't require a friend
edge · peer chat's getOrCreatePeerConversation is idempotent on
the (viewer, NEX) canonical pair").

For a brand-new user typing another user's handle, the current
primitives do NOT appear to require friend-edge acceptance before
opening a chat (same as NEX1 flow). The RLS migration 047 may still
gate reads of each OTHER'S messages differently · follow-up
inspection may be warranted if Option C surfaces a "chat anyone by
handle" affordance.

### Rule for Option C

If the composer accepts "type handle, press send", resolve server-
side via `getAccountByNexHandle` and route via
`/nex-native/chat/peer/{resolvedId}`. Reject malformed input ·
reject self-chat · null account → render an honest "That handle
doesn't exist on NEX" state.

---

## 6 · Area 6 · First-visit surfaces, invitation, chat landing, sealed primitives

### Current first-visit surfaces

Directory: `src/app/nex-native/chat/first-visit/`
- `page.tsx` (497 lines) · owner-authored welcome landing with 3
  landscape cards + sealed ChatIdentityHeader + FirstVisitComposerStub.
- `_composer-stub.tsx` · wraps `<ChatComposerPill />`; on send,
  pushes `/nex-native/chat?draft=<trimmed-slice-200>`; placeholder
  `"Start chatting · press send"` (just updated).
- `shop/page.tsx` · honest Phase-2 shop preview · no commerce
  affordance.
- `personalize/page.tsx` · honest "coming soon" · no upload /
  generate / save affordance.
- `__tests__/first-visit.test.ts` · 57 tests pinning structure,
  honesty, redesign assertions.

Entry wiring:
- `page.tsx:117–120` · guests bounced to `/nex-native/welcome`
  (first-visit is signed-in only).
- Home tile at `home/_first-visit-invitation.tsx` gated behind
  `shouldShowFirstVisitInvitation(conversationCount)`.

### Home first-visit invitation

File: `src/app/nex-native/home/_first-visit-invitation.tsx` (228 lines)

- Exports:
  - `FIRST_VISIT_DESTINATION = "/nex-native/chat/first-visit"` (line 31).
  - `shouldShowFirstVisitInvitation(count): boolean` (lines 47–56).
    Returns true ONLY when count is a finite non-negative integer
    equal to 0.
  - `<FirstVisitInvitation />` tile (lines 72–212).
- Integration in `home/page.tsx:130–144`:
  - 4th entry in the `Promise.all` tuple:
    `peerConversationService.listPeerConversationsForAccount(session.account.id).then(rows => rows.length).catch(() => null)`.
  - Rendered under `{showFirstVisitInvitation && <FirstVisitInvitation accent={themeAccent} />}`.
- Tests pin the integration shape at
  `home/__tests__/first-visit-invitation.test.ts` (30 tests).

### Sealed Chat Master Layout primitives

File: `src/lib/nex-native/chat-chrome/chat-identity-header.tsx` (lines 1–80 inspected)

- Client component (`"use client"`).
- Props: `avatarUrl`, `displayName`, `subtitle` (ReactNode), `presenceKind`,
  `heartbeatColor`, `isOfficial` (adds NEX cyan verified pill),
  `rightReserveWidth`, `onPress`, `avatarHref`, `avatarDecoration`.
- Owns: avatar (56px heartbeat), name (26px white + shadow),
  subtitle (13px neutral grey), optional NEX pill.
- Does NOT own: outer `<header>` wrapper, safe-area padding, right-
  side action cluster.

File: `src/lib/nex-native/chat-chrome/chat-composer-pill.tsx` (lines 1–80 inspected)

- Client component (`"use client"`).
- Required props: `value`, `onChange`, `onSend`, `placeholder`.
- Optional: `accentHex`, `composerBg`, `sendButtonImageUrl`,
  `sending`, `disabled`, `armed`, `maxLength`, `onPlusAction`,
  `onEmoji`, `prefixSlot`, `suffixSlot`, `headerSlot`, `errorText`,
  `textareaRef`.
- Owns: container · + button · textarea · emoji button · send button ·
  accent rim · glow · maxLength · Enter-to-send keyboard.
- Leaves to callers via slots: paperclip attach · pending-emoji chips ·
  reply-to header · attachment preview · form wrapping · encryption.

### Smallest Option-C integration point

A new sibling route at `src/app/nex-native/chat/first-contact/page.tsx`
would be the minimum-footprint integration · parallel to
`/chat/first-visit`, same sealed-primitive composition, no changes
to the sealed `/chat/peer/[accountId]` page or its chrome. Each
Option-C card (NEX1, Community, identity-share) is a short-list of
Link + Server-Action primitives, zero bespoke chat chrome.

Alternative: fold Option-C INTO `/chat/first-visit` (expand the page
from 3 cards to 4 cards + identity banner). Lower route count, but
mixes "theme-destination tour" with "identity + first-contact" into
one surface. See §9 unknowns.

---

## 7 · Area 7 · Existing tests and reports

### First-visit vitest suite

File: `src/app/nex-native/chat/first-visit/__tests__/first-visit.test.ts`
- 57 tests across 5 `describe` blocks:
  1. `first-visit page · structure` (lines 89–196)
  2. `shop preview · structure and honesty` (lines 198–283)
  3. `personalize preview · structure and honesty` (lines 285–363)
  4. `first-visit chain · cross-page invariants` (lines 365–416)
  5. `first-visit page · redesign · sealed Chat Master Layout footer` (lines 418–475)
  6. `first-visit page · redesign · 3 landscape cards` (lines 476+)

Key invariants to preserve under Option C:
- Pages mount `<ChatIdentityHeader />`.
- First-visit page redirects guests to `/welcome`.
- `three destination keys ("themes" | "shop" | "personalize")`
  are declared (line 102). Adding a 4th or extending the first-visit
  page itself would require updating this test's enumeration.
- Pages touch no commerce/payment UI copy (line 151 · line 333).
- Pages touch no face-cover/biometric/custom-upload UI copy
  (line 161 · line 316).
- Pages write no DB mutations (line 171 · line 274 · line 343).
- Pages touch no tier-gate / product-service / account-service
  (line 366).
- Pages touch no Vault / migration 197 / Stage 1.1 modules (line 386).
- Pages are `force-dynamic` + `nodejs` runtime (lines 190, 404).
- Composer stub never sends a message · routes to `/nex-native/chat`
  (line 440).
- Composer stub does NOT reference commerce flags or sealed services
  (line 455).

### Home invitation vitest suite

File: `src/app/nex-native/home/__tests__/first-visit-invitation.test.ts`
- 30 tests across pure-predicate + source-shape + component-safety.
- Pins `FIRST_VISIT_DESTINATION === "/nex-native/chat/first-visit"`
  at line 108 · changing this path would require a tested migration.
- Pins the Promise.all tuple shape at line 127 · adding or removing
  entries requires updating this guard.

### Playwright E2E

Files:
- `tests/e2e/mobile-public-surfaces.spec.ts` · 8 tests · PASSING.
  Covers: welcome / sign-in / create-account renders · first-visit
  routes redirect unauth to /welcome · tap-target floor.
- `tests/e2e/mobile-authenticated-journey.spec.ts` · 9 tests ·
  awaiting owner-generated `tests/e2e/.auth/state.json`. Step 8
  (send first message) is `test.skip(true, ...)` with explicit
  reason (no safe test peer).

Both specs use `devices["Pixel 7"]` at 412×915 against Chromium.
`npx playwright install webkit` is a dependency install that was
deliberately NOT done (owner-sealed boundary).

### Doctrine reports already written

- `docs/doctrine/nex-free-chat-theme-first-visit-implementation-2026-10-14.md`
- `docs/doctrine/nex-first-visit-entry-wireup-2026-10-14.md`
- `docs/doctrine/nex-mobile-e2e-first-visit-verification-2026-10-14.md`
- `docs/doctrine/nex-mobile-e2e-authenticated-first-user-journey-2026-10-14.md`

No prior `nex-first-contact-*` report exists in `docs/doctrine/`.

---

## 8 · Conflict analysis · home invitation vs welcome delivery

### The conflict

Both of these facts are true in production today:

1. Every new signup triggers Bridge 62 inline welcome delivery
   (`_actions.ts:169–209`) which creates a `nex_peer_conversation`
   between NEX1 and the new account.
2. `home/_first-visit-invitation.tsx:47–56` only shows the invitation
   when `conversationCount === 0`, computed from
   `listPeerConversationsForAccount(session.account.id).length`
   (`home/page.tsx:139–142`).

Therefore every freshly-created account that reaches `/home` has
`conversationCount === 1` (the NEX1 conversation seeded by its own
signup), and the sealed `FirstVisitInvitation` tile is HIDDEN on
exactly the users it was built for.

The sealed Playwright step at
`tests/e2e/mobile-authenticated-journey.spec.ts:88` already contains
this annotation:
> "Invitation not visible on home · account has ≥ 1 peer conversation.
>  Steps 4-7 are skipped."

That annotation is the test suite acknowledging the mismatch rather
than solving it.

### Resolution options (owner decides)

**Option 8A · Change the predicate**: instead of "zero peer
conversations", gate on "zero peer conversations OTHER THAN NEX1".
Requires importing `NEX_OFFICIAL_ACCOUNT_ID` and filtering the row
list before counting. Deterministic, cheap, honest.

**Option 8B · Change the signal**: use a persistent "first-visit
tour taken" flag on `nex_account` (new column, migration-gated) and
hide the tile once the user has visited `/chat/first-visit` at
least once. Richer, but adds schema and a cookie-or-column write.

**Option 8C · Move the entry point**: deliver the first-contact
experience inline on `/home` instead of behind a tile — e.g. render
the identity-share card + NEX1 card + Community card unconditionally
when `conversationCount === 1 && the only conversation is NEX1`.
No invitation to tap · it IS the first-view.

**Option 8D · Change the destination**: make `/chat/first-visit`
the signed-in landing (sealed root at `src/app/nex-native/page.tsx:22–25`
would need to change · HIGH RISK · breaks the sealed root routing
rule). Not recommended.

Recommended: **8A** combined with a small Option-C route at
`/nex-native/chat/first-contact` is the lowest-blast-radius path.
8C has strong product merit if the owner wants the first-contact
experience to be the signed-in landing for new users.

### Side-effect to anticipate

If 8A is chosen, the home invitation becomes visible for every new
user. The home page already loads the handle at `home/page.tsx:195`
(`const handle = session.account.nex_handle ?? null`) but currently
RENDERS it nowhere (grep for `{handle}` in home/page.tsx returns
no matches). Making the handle visible on home is a complementary
change — not required for Option C to work, but it would improve
discovery.

---

## 9 · Explicit unknowns · owner decisions required

Numbered so owner can respond concisely.

**U1 · Where does first-contact live?**
- Option A · new route `/nex-native/chat/first-contact` (sibling
  of `/chat/first-visit`, cleaner separation, two tiles on home).
- Option B · fold into `/chat/first-visit` as a 4th card + identity
  banner above the three cards (one route, mixes concerns).
- Option C · render first-contact INLINE on `/home` for new users
  (no invitation tile; it IS the first-view). Requires predicate
  update per §8 Option 8C.

**U2 · Resolve the invitation ↔ welcome conflict (§8).**
Pick one of 8A / 8B / 8C. 8D is not recommended.

**U3 · Default discoverability on signup.**
Currently `is_discoverable: false`. If the identity-share card
encourages friends to visit `/u/{handle}`, visitors will see 404
until the owner opts in. Options:
- (a) Keep `false` · identity-share card copy explains the toggle
  + deep-links to `/settings/profile?tab=personal` with a one-tap
  "Make my profile shareable" affordance.
- (b) Set `is_discoverable: true` by default on signup (schema +
  signup flow change). Changes default public-footprint behaviour.
- (c) Share only the handle string `nex-NNNNN` (not the `/u/` URL)
  — recipient must then paste it into their own NEX to find the
  user. Lower public-footprint, higher friction.

**U4 · Handle visibility on signed-in home.**
Owner-approved subtitle "nex-00123" instead of "Welcome, firstName"
on `/home` and/or `/chat/first-contact`? Both? Neither?

**U5 · Composer-send behaviour on `/chat/first-contact`.**
If the user types a handle (`nex-NNNNN`) and presses send, resolve
via `getAccountByNexHandle` and redirect to
`/chat/peer/{resolvedId}`? Or always forward to `/chat` landing
with `?draft=...` (the current `/chat/first-visit` composer-stub
behaviour)?

**U6 · Share mechanism.**
- (a) Single native-share button using `navigator.share()` with
  clipboard fallback (recommended · reuses OS share sheet including
  WhatsApp / SMS / mail).
- (b) Separate per-platform buttons (WhatsApp deep-link + SMS
  deep-link + mailto) with explicit control.

**U7 · Share payload shape.**
- (a) Just the handle `nex-00123`.
- (b) Just a canonical URL `/nex-native/u/nex-00123` (requires U3
  decision because recipient will 404 if !discoverable).
- (c) Composed message e.g. `"I'm on NEX · nex-00123 · https://…/u/nex-00123"`.
- Owner authorises wording and whether the message is editable.

**U8 · The guest-chat `_actions.ts` grep hit.**
`src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts` is in
the grep match for `welcome-delivery|welcome-outbox-worker`. This
discovery pass did NOT open that file. Follow-up read-only
inspection recommended before any Option-C code change touches
first-conversation code paths — it may already consume the Bridge 99
worker in a context this report did not surface.

**U9 · Public-profile share URL hostname.**
Share links encoded as absolute URLs need a hostname. The report
inspected code only · no `.env.local` reads. Owner authorises the
public hostname before any production share string is composed.
`navigator.share({ url })` can also accept a path-relative URL on
some browsers but reliability varies — a decision is required.

---

## 10 · Smallest proposed implementation scope for Option C

NOT YET AUTHORISED. Captured here so owner can scope the eventual
build pass against this inspection's findings.

Scope assuming U1=A, U2=8A, U3=(a), U4=yes-on-first-contact,
U5=resolve-and-redirect, U6=(a) native-share, U7=(c)
handle+url+editable:

1. New route `src/app/nex-native/chat/first-contact/page.tsx`
   - Signed-in only · guest → `/welcome`.
   - Sealed `<ChatIdentityHeader />` top with subtitle = handle.
   - Identity card: nex-handle display + "Share my NEX ·" button
     wired to a tiny client component that invokes
     `navigator.share({ title, text, url })` with
     `navigator.clipboard.writeText(payload)` fallback.
   - NEX1 card → `NEX_OFFICIAL_CHAT_HREF`.
   - NEX Community card → `/nex-native/community`.
   - Sealed `<ChatComposerPill />` footer.
   - Composer onSend: parse value; if it matches `^nex-[0-9]{5,}$`
     call Server Action that invokes
     `accountService.getAccountByNexHandle` and redirects to
     `/chat/peer/{id}` on success · otherwise redirect to
     `/chat?draft=<text>`.
2. Modify `shouldShowFirstVisitInvitation` to also ignore the NEX1
   conversation when counting (predicate update per §8 Option 8A).
   Update unit tests to pin the new rule.
3. Add a second home invitation tile (or compose two tiles) for
   first-contact · same component shape as the existing
   first-visit tile · gated on the same predicate.
4. New vitest suite
   `src/app/nex-native/chat/first-contact/__tests__/first-contact.test.ts`
   mirroring the first-visit suite's structural + honesty invariants.
5. Playwright coverage in the sealed `mobile-authenticated-journey.spec.ts`
   when the owner-generated storage state lands.

No DB migration, no new Supabase table, no sealed-service change,
no commerce dependency, no feature-flag toggle. All work lives
inside `src/app/nex-native/chat/first-contact/` + two targeted
edits in `_first-visit-invitation.tsx` and `home/page.tsx`.

---

## 11 · Compliance checklist for this discovery pass

- [x] Repository root + remote verified before every read.
- [x] No source edits.
- [x] No migrations applied.
- [x] No DB queries run.
- [x] No environment or dependency changes.
- [x] No server restarts.
- [x] No deployment or push.
- [x] `.env.local` was not read.
- [x] `welcome-delivery.ts` not changed.
- [x] NEX1 routing not changed.
- [x] Community routes not changed.
- [x] Authentication not changed.
- [x] Account identity not changed.
- [x] Peer-chat services not changed.
- [x] Existing first-visit invitation not changed.
- [x] No welcome-delivery assumption · the inline Bridge 62 path
      was verified at `_actions.ts:169–209`.
- [x] No public-profile URL invention · all URL shapes quoted from
      the sealed `/u/[handle]` page source.
- [x] Report filed at
      `docs/doctrine/nex-first-contact-read-only-discovery-2026-10-14.md`.

Awaiting owner review on §9 unknowns U1–U9 before Phase 2
implementation is authorised.
