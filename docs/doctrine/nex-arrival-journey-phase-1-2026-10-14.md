# NEX Phase 1 · Arrival-Journey Doctrine

**Status:** Documents the verified state of the running app as of 2026-10-14.
**Scope:** First-time anonymous arrival · welcome surface · Bridge 99 provisional conversations · the sealed Phase 1 commerce launch gate · the rules that must not be weakened.
**This file is doctrine, not a plan.** It records what ships + what is sealed + what remains an open product decision. Treat every claim here as subject to re-verification against the running code before any change.

## 1. Verified ARRIVAL path (anonymous visitor)

- `GET /` → `redirect("/nex-native/home")` at `src/app/page.tsx`.
- `GET /nex-native/home` for an anon viewer → redirects to `/nex-native/sign-in`.
- `GET /nex-native` for an anon viewer → `redirect("/nex-native/welcome")` at `src/app/nex-native/page.tsx:24`.
- `GET /nex-native/welcome` → 200. Guest-only landing page.

The welcome landing exposes **three** tiles, all `publicStatus: "open"`:

| Tile | Destination | Guest-accessible today? |
|---|---|---|
| Themes | `/nex-native/chat-themes-library` | ✅ |
| Local businesses | `/nex-native/discover` | ✅ |
| Community | `/nex-native/community/feed` | ✅ |

Hero CTAs: **Create free account** → `/nex-native/create-account` · **Sign in** → `/nex-native/sign-in`.

Signed-in visitors are redirected UP to `/nex-native/home` by `src/app/nex-native/page.tsx:21–23` and `src/app/nex-native/welcome/page.tsx` so the welcome experience is guest-only.

## 2. Verified GUEST-CHAT capability (Bridge 99)

Bridge 99 "First Conversation Principle" (founder-sealed 2026-09-30) is **shipped** and powers the first-message-without-signup path:

- **Resolver:** `src/lib/nex-native/first-conversation/provisional-session.ts` returns one of `{ kind: 'authenticated' | 'provisional' | 'none' }`. The `provisional` kind is backed by a signed `nex_session` cookie whose server-side validity is checked against `nex_session_registry`.
- **Entry API:** `POST /api/nex-native/first-message` (`src/app/api/nex-native/first-message/route.ts`) thin-wraps the deterministic core at `first-message-http.ts`. On success it mints a provisional cookie, creates a provisional `nex_account`, opens the peer conversation, and enqueues a welcome message.
- **Entry UI:** `src/app/nex-native/cover/_composer/CoverComposer.tsx` + `useCoverSendMessage.ts`. Mounted inside the cover-layout switch (`src/app/nex-native/cover/layouts.tsx` lines 198, 304, 403, 573, 708).
- **Continuation surface:** `src/app/nex-native/chat/guest/[ownerAccountId]/page.tsx` + `_actions.ts`. Only accepts provisional sessions. Authenticated viewers bump UP to `/chat/peer/[accountId]`. Nothing-session viewers bounce to `/home`.
- **Abuse protection on first message:** `provisional-fingerprint.ts` + `risk-service.ts` + `risk-signals.ts` run inside the first-message orchestrator.
- **Account-link on signup:** documented in `/chat/guest/[ownerAccountId]/page.tsx:36` as "Phase C". The provisional account becomes the real account on signup.

## 3. Verified COMMERCE launch gate (sealed)

`src/lib/nex-native/launch-flags.ts` ships `NEX_COMMERCE_ENABLED` **defaulting false** (Bridge 55 · sealed 2026-09-29). Direct quote from the file header:

> "launch NEX as a chat + themes product first (WhatsApp / iMessage killer with beautiful themes and Bisnis monetization). All commerce features stay in the codebase but are HIDDEN behind this flag."

Consequence: `src/app/nex-native/[businessSlug]/page.tsx:81–83` redirects to `/home` unless `commerceEnabledForRequest(sp)` returns true. In practice an anonymous visitor cannot reach a business cover (and therefore cannot reach the Bridge 99 composer) from the welcome page today. Admin/dev reach: either `NEX_COMMERCE_ENABLED=1` in `.env.local` or `?commerce=1` on the URL.

## 4. Known gap on GUEST FOLLOW-UP messages

`src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts` ships `sendGuestMessageAction`. Observed behaviour:

- `MAX_GUEST_MESSAGE_LENGTH = 2000` (per-body limit).
- Checks the sending provisional account is still a participant on the conversation (belt-and-braces alongside the composite-key verification).
- **Does NOT** enforce a frequency rate limit on follow-up sends.
- **Does NOT** re-run `provisional-fingerprint`/`risk-service` on follow-up sends (those run only on the orchestrator's first-message path).
- Writes plaintext body with `encrypted=false` because guests have no device-key chain yet.

The existing community rate-limit primitive at `src/lib/nex-native/community/rate-limit.ts` (`recordIfAllowed` + `nex_community_rate_limit` table + `NEX_COMMUNITY_RATE_LIMITS` config) is a reusable rolling-window limiter and would be the natural home for a `peer_message_guest` action key.

## 5. Sealed rules this app MUST preserve

The following are load-bearing. A future contributor who touches the arrival-journey or any of its sibling surfaces must re-read this list first.

1. **No fake controls.** `src/app/nex-native/welcome/page.tsx` header is explicit: *"Does not show controls for features that do not work."* Tiles, buttons, and links on the welcome page must point at a guest-reachable NEX route that works today. Dead-end tiles, placeholder destinations, or "coming soon" chats are forbidden on this surface.
2. **No fake chat destination.** Do NOT invent a chatbot or sham reply so the welcome page can boast a chat composer. The only honest guest-chat path today is Bridge 99 → a real business cover → a real business owner, and that path is intentionally hidden behind the Phase 1 commerce gate until it is safe to expose at scale.
3. **No `Theme Shop` or dedicated `Premium Themes` route.** Those destinations do not exist. The premium-themes catalog section is surfaced *inside* the existing library via the sealed PREMIUM chip on `_phone-tile.tsx` and the honest premium banner on `/nex-native/themes/[id]`. Do not add a welcome tile titled "Theme Shop" or "Premium Themes" that points at a non-existent route.
4. **No direct theme purchase anywhere until the sealed theme-commerce stack lands.** Migrations 191–196 are drafts. The forbidden-phrase guard in `src/app/nex-native/welcome/__tests__/welcome-honesty.test.ts` and `src/app/nex-native/themes/[id]/__tests__/premium-banner-copy.test.ts` fails the build if any payment language slips through.
5. **No weakening of Bridge 99.** The sealed §7 identity resolver precedence (authenticated → provisional cookie → none) must not be inverted or shortcut. Specifically: `provisional-session.ts` MUST NOT import `risk-service.ts` and MUST NOT create accounts (that belongs to the orchestrator's Send transaction).
6. **No weakening of the Phase 1 commerce gate.** `NEX_COMMERCE_ENABLED` defaults to false by sealed founder decision. Flipping it is a product decision, not a UX convenience.
7. **No weakening of the account-identity contract.** `nex_account.id` is the identity anchor (`project_nex_identity_doctrine_phone_is_credential_not_identity_system_2026_09_23`). Provisional accounts are real `nex_account` rows marked provisional; downstream FKs still point at `nex_account.id`. The UI must never claim a guest conversation is already linked to a permanent NEX account before the Phase C account-link path runs.
8. **No service-role credentials in client code.** Every guest-chat write path uses `nexSupabaseAdmin` server-side. The service key must stay out of browser bundles.
9. **No uncontrolled welcome traffic directed at real business owners.** If the arrival-journey ever surfaces Bridge 99 directly from `/welcome`, the follow-up frequency limiter + fingerprint check on `sendGuestMessageAction` (section 4) must land first, AND the welcome destination must either be a NEX-Official account or a specific founder-authorised showcase business.

## 6. Verified capabilities vs. proposed future work

| | Verified today | Proposed · requires explicit authorisation |
|---|---|---|
| Arrival landing on `/nex-native/welcome` with three honest tiles | ✅ | — |
| Theme library + preview routes guest-accessible | ✅ | — |
| PREMIUM chip inside library tiles (`_phone-tile.tsx`) | ✅ (2026-10-14) | — |
| Honest premium banner on `/themes/[id]` for premium-category rows | ✅ (2026-10-14) | — |
| Bridge 99 provisional first conversations (cover-composer → first-message API → guest-chat) | ✅ | — |
| Welcome-page-origin arrival-to-chat | ❌ | NEX-Official chat destination (new backend) OR founder-authorised showcase-business tile |
| Guest follow-up frequency rate limiting | ❌ | Extend `community/rate-limit.ts` primitive with a `peer_message_guest` action key |
| Guest follow-up fingerprint/risk re-check | ❌ | Thread fingerprint check from orchestrator into `sendGuestMessageAction` |
| Direct theme purchase | ❌ | Theme-commerce stack (migrations 191–196 + Stage 3 services + payment provider + harness-verified schema) |
| Per-business theme override | ❌ | Requires migration 195 applied |
| Hammerex `origin='bespoke'` + €100 commission backfill | ❌ | Separate authorised historical script after migrations apply |

## 7. NEX-Official chat (future · unauthorised)

NEX-Official chat would let a visitor converse with NEX itself (not a human business owner), making the welcome page a legitimate arrival-to-chat destination without exposing real sellers to welcome traffic. Before any implementation, the following contract must be designed and reviewed:

- **Identity:** a sealed NEX-Official account (how it's created, whether it's seeded via migration or configured via env, whether it owns a nex_business row).
- **Deterministic replies:** the reply contract (fully deterministic server-rendered copy · no third-party model, no runtime inference, no fake streaming) and where the reply catalog lives.
- **Rate limiting:** per-provisional-session frequency limit on `sendGuestMessageAction` (new row in `NEX_COMMUNITY_RATE_LIMITS`) + a cap on how many messages a single provisional session can accrue before signup is required.
- **Abuse controls:** fingerprint check on every follow-up send, content moderation hook, blocklist for IP/fingerprint flood.
- **Provisional-session privacy:** the UI must say explicitly "this conversation is a draft until you create an account" (or similar honest copy); the account-link path must be well-documented from this surface.
- **Commerce-gate boundary:** NEX-Official must bypass the Bridge 55 commerce gate because it is NOT a shop; the gate was designed for seller shops and should not be relaxed in general.
- **Tests:** adversarial coverage for flood/replay/account-link race + a snapshot test for the deterministic reply catalog.

None of the above exists today. Do not treat the welcome page's current shape as a bug — treat it as the honest resting state of Phase 1 until this contract is designed, authorised, and shipped.

## 8. References

- `src/app/page.tsx`
- `src/app/nex-native/page.tsx`
- `src/app/nex-native/welcome/page.tsx`
- `src/app/nex-native/welcome/__tests__/welcome-honesty.test.ts`
- `src/app/nex-native/chat-themes-library/_phone-tile.tsx` (PREMIUM chip)
- `src/app/nex-native/themes/[id]/page.tsx` + `_premium-banner-copy.ts` (honest banner)
- `src/app/nex-native/cover/_composer/CoverComposer.tsx`
- `src/app/nex-native/cover/_composer/useCoverSendMessage.ts`
- `src/app/api/nex-native/first-message/route.ts`
- `src/app/nex-native/chat/guest/[ownerAccountId]/page.tsx`
- `src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts`
- `src/lib/nex-native/first-conversation/provisional-session.ts`
- `src/lib/nex-native/first-conversation/first-message-http.ts`
- `src/lib/nex-native/first-conversation/risk-service.ts`
- `src/lib/nex-native/first-conversation/risk-signals.ts`
- `src/lib/nex-native/launch-flags.ts` (Bridge 55 commerce gate)
- `src/lib/nex-native/community/rate-limit.ts` (reusable rolling-window primitive)
- `docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md` (sealed Bridge 99 doctrine)
