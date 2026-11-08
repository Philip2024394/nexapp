# NEX Safety Audit · Part A · User-facing sections

Read-only audit for the NEX World-Class Safety Programme sealed
2026-11-08 (round 4).

## Branch · HEAD · scope statement

- Branch: `nex-ireland-build-2026-11-06`
- HEAD: `fd615fe` ("HQ Members · Free/Paid tabs + package + shop URL ·
  Alerts page · hide-crashes")
- Repo root: `C:/Users/Victus/nexapp`
- Scope: every user-facing `/nex-native/*` route tree, measured at the
  `page.tsx` level, against the four pillars (failure isolation ·
  zero blank-screen · user-work protection · recovery coverage).
- Method: direct inspection of route files, `IncidentScope` vocabulary
  at `src/lib/nex-native/incident/incident-service.ts:57-72`, every
  `error.tsx`/`loading.tsx`/`layout.tsx` under `src/app/nex-native/*`,
  and every `withRetry` call-site under `src/`.
- No files were modified · no dev server was started · no migrations
  were touched · no production bucket was created.

New since prior audit `docs/doctrine/section-boundary-coverage-2026-11-08.md`:

- `src/app/nex-native/error.tsx` (root error boundary) · added at
  commit `fd615fe`.
- `src/app/nex-native/hq/layout.tsx:128` wraps the HQ subtree in
  `<SectionBoundary section="hq">` · added at commit `aaea913`.

Nothing else in that chain has changed. All other sections remain
unprotected by SectionBoundary.

## Section matrix

Legend: ✓ present · ✗ missing · n/a route does not exist.

| Route | `loading.tsx`? | `error.tsx`? | SectionBoundary wrap? | Suspense boundaries? | Data-loss hazard? | Known bug / blank-screen risk |
|---|---|---|---|---|---|---|
| `/nex-native/chat` | ✓ `chat/loading.tsx` | ✗ | ✗ | not inspected | NO (no editor on this surface) | None local; renders chat inbox |
| `/nex-native/chat/peer/[accountId]` | ✓ `chat/peer/[accountId]/loading.tsx:10` | ✗ | ✗ | not inspected | **LOW** · draft persisted to `localStorage` at `_composer.tsx:241-273`; idempotent send via `send_intent_id` (`peer-message-service.ts:376-383`) | Composer has draft + idempotency; no navigation guard beyond draft restore |
| `/nex-native/chat/peer/[accountId]/forward/[messageId]` | inherit | ✗ | ✗ | not inspected | low | inherits chat loading skel |
| `/nex-native/chat/guest/[ownerAccountId]` | inherit | ✗ | ✗ | not inspected | low | inherits chat loading skel |
| `/nex-native/free-chat` | ✗ | ✗ | ✗ | not inspected | **UNKNOWN** · pages large, no composer-draft pattern found by grep | No instant paint between tap and SSR |
| `/nex-native/free-chat/call` | ✗ | ✗ | ✗ | not inspected | n/a | long-lived WebRTC; crash risk high |
| `/nex-native/free-chat/bubble-customize` | ✗ | ✗ | ✗ | n/a | editor — **no dirty/unsaved guard found** | lost state on nav |
| `/nex-native/chat-themes-library` | ✓ `chat-themes-library/loading.tsx` | ✗ | ✗ | n/a | NO | prefetched via `cover-themes-library/_prefetch-cover-themes` |
| `/nex-native/chat-themes-library/all` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/contacts` | ✗ | ✗ | ✗ | n/a | NO | no instant paint |
| `/nex-native/friends` | ✗ | ✗ | ✗ | n/a | NO | no instant paint |
| `/nex-native/group-chat/[groupId]` | ✗ | ✗ | ✗ | n/a | **UNKNOWN** composer not inspected | no instant paint |
| `/nex-native/directory` | ✓ `directory/loading.tsx` | ✗ | ✗ | n/a | NO | instant skel paints |
| `/nex-native/directory/landing` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/directory/[id]` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/u/[handle]` | ✗ | ✗ | ✗ | n/a | NO | blank-paint risk between tap and SSR |
| `/nex-native/[businessSlug]` | ✗ | ✗ | ✗ | n/a | NO | same blank-paint risk |
| `/nex-native/store` | ✗ | ✗ | ✗ | n/a | NO | same blank-paint risk |
| `/nex-native/manage/shop` | ✗ | ✗ | ✗ | n/a | NO on landing | no instant paint |
| `/nex-native/manage/shop/setup` | ✗ | ✗ | ✗ | n/a | editor — **no draft/dirty guard** | lost field state on crash |
| `/nex-native/manage/shop/setup/identity` | ✗ | ✗ | ✗ | n/a | editor — **no draft/dirty guard** · server pre-fills from existing row (`page.tsx:29-30`) but unsaved local edits vanish | lost field state on crash |
| `/nex-native/manage/shop/setup/contact` | ✗ | ✗ | ✗ | n/a | editor — **no draft/dirty guard** | lost field state on crash |
| `/nex-native/manage/shop/setup/location` | ✗ | ✗ | ✗ | n/a | editor — **no draft/dirty guard** | lost field state on crash |
| `/nex-native/manage/shop/setup/category` | ✗ | ✗ | ✗ | n/a | editor — **no draft/dirty guard** | lost field state on crash |
| `/nex-native/manage/shop/setup/request-category` | ✗ | ✗ | ✗ | n/a | editor — **no draft/dirty guard** | lost field state on crash |
| `/nex-native/manage/shop/setup/hours` | ✗ | ✗ | ✗ | n/a | editor — **no draft/dirty guard** | lost field state on crash |
| `/nex-native/manage/shop/setup/story` | ✗ | ✗ | ✗ | n/a | editor — **no draft/dirty guard** | lost field state on crash |
| `/nex-native/manage/shop/setup/policies` | ✗ | ✗ | ✗ | n/a | editor — **no draft/dirty guard** | lost field state on crash |
| `/nex-native/manage/shop/setup/finish` | ✗ | ✗ | ✗ | n/a | NO | hand-off surface |
| `/nex-native/manage/shop/start` | ✗ | ✗ | ✗ | n/a | NO | land/start surface |
| `/nex-native/manage/shop/themes` | ✗ | ✗ | ✗ | n/a | NO | palette picker |
| `/nex-native/manage/shop/backgrounds` | ✗ | ✗ | ✗ | n/a | **LOW** · writes to `localStorage` (only file under manage/shop with client storage) | palette picker |
| `/nex-native/manage/menu` | ✗ | ✗ | ✗ | n/a | **UNKNOWN** · editor surface | no instant paint |
| `/nex-native/manage/menu/[itemId]` | ✗ | ✗ | ✗ | n/a | editor — **no draft/dirty guard** | lost field state on crash |
| `/nex-native/manage/products` | ✗ | ✗ | ✗ | n/a | **UNKNOWN** · editor list | no instant paint |
| `/nex-native/manage/products/[productId]` | ✗ | ✗ | ✗ | n/a | editor — **no draft/dirty guard** | lost field state on crash |
| `/nex-native/manage/products/[productId]/edit` | ✗ | ✗ | ✗ | n/a | editor — **no draft/dirty guard** | lost field state on crash |
| `/nex-native/manage/products/[productId]/interest` | ✗ | ✗ | ✗ | n/a | NO (read-only) | no instant paint |
| `/nex-native/manage/accommodation/[roomId]` | ✗ | ✗ | ✗ | n/a | editor — **no draft/dirty guard** | lost field state on crash |
| `/nex-native/create/product/category` | ✗ | ✗ | ✗ | n/a | **no draft/dirty guard** | lost field state on crash |
| `/nex-native/cart` | ✗ | ✗ | ✗ | n/a | **MITIGATED** · `sendIntentId` idempotency token minted per open (`_checkout-sheet.tsx:122-130`) | no instant paint |
| `/nex-native/orders` | ✗ | ✗ | ✗ | n/a | NO (read-only) | no instant paint |
| `/nex-native/orders/[orderId]` | ✗ | ✗ | ✗ | n/a | NO (read-only) | no instant paint |
| `/nex-native/product/[productId]` | ✗ | ✗ | ✗ | n/a | NO | no instant paint |
| `/nex-native/live-commerce/studio` | ✗ | ✗ | ✗ | n/a | **HIGH** · long-lived WebRTC · studio-client uncovered | no instant paint; crash collapses shell |
| `/nex-native/live-commerce/guidelines` | ✗ | ✗ | ✗ | n/a | NO | static |
| `/nex-native/profile/me` | ✗ | ✗ | ✗ | n/a | **BROKEN REDIRECT** · redirects to `/nex-native/create-account?return_to=…` which does not exist as a page (`profile/me/page.tsx:42`) | after sign-out, fires root `error.tsx` or 404 |
| `/nex-native/profile/[handle]` | ✗ | ✗ | ✗ | n/a | NO on view; `_actions.ts` writes avatar + cover | no instant paint |
| `/nex-native/profile/theme/[themeId]` | ✗ | ✗ | ✗ | n/a | NO | no instant paint |
| `/nex-native/settings` | ✓ `settings/loading.tsx` | ✗ | ✗ | n/a | NO | instant skel |
| `/nex-native/settings/profile` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/settings/profile/edit` | inherit | ✗ | ✗ | n/a | editor — **no draft/dirty guard**; avatar upload via `_avatar-actions.ts` (no idempotency key) | lost field state on crash |
| `/nex-native/settings/payments` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/settings/privacy` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/settings/security` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/settings/security/password` | inherit | ✗ | ✗ | n/a | **LOW** · password form; no dirty guard | lost field state on crash |
| `/nex-native/settings/security/activity` | inherit | ✗ | ✗ | n/a | NO | read-only |
| `/nex-native/settings/blocked` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/settings/help` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/settings/language` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/settings/tier` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/settings/see-my-theme` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/settings/disappearing-messages` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/settings/chat-protection` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/settings/chat-font` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/settings/chat-background-sync` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/settings/chat-settings` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/sign-in` | ✓ `sign-in/loading.tsx` | ✗ | ✗ | n/a | **LOW** · password/face form; no dirty guard | instant skel |
| `/nex-native/home` | ✓ `home/loading.tsx` | ✗ | ✗ | n/a | NO | instant skel |
| `/nex-native/vault` | ✓ `vault/loading.tsx` | ✗ | ✗ | n/a | NO on entry | instant skel |
| `/nex-native/vault/home` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/vault/home/chats` | inherit | ✗ | ✗ | n/a | **LOW** composer idempotency not inspected | inherits |
| `/nex-native/vault/home/chats/[conversationId]` | inherit | ✗ | ✗ | n/a | **MITIGATED** · `idempoten` present at `_vault-chat-client.tsx` (grep hit) | inherits |
| `/nex-native/vault/home/archived` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/vault/home/plans` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/vault/home/videos` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/vault/intro` | inherit | ✗ | ✗ | n/a | NO | inherits |
| `/nex-native/call/dial` | ✗ | ✗ | ✗ | n/a | NO | no instant paint |
| `/nex-native/call/preview` | ✗ | ✗ | ✗ | n/a | NO | no instant paint |
| `/nex-native/call/voice-preview` | ✗ | ✗ | ✗ | n/a | NO | no instant paint |
| `/nex-native/call-centre` | ✗ | ✗ | ✗ | n/a | NO | no instant paint |
| `/nex-native/community/notices/[id]` | ✗ | ✗ | ✗ | n/a | **UNKNOWN** · may include a flag/report form | no instant paint |
| `/nex-native/community/select` | ✗ | ✗ | ✗ | n/a | NO | no instant paint |
| `/nex-native/search` | ✓ `search/loading.tsx` | ✗ | ✗ | n/a | NO | instant skel |
| `/nex-native/share` | ✗ | ✗ | ✗ | n/a | NO | no instant paint |
| `/nex-native/support` | ✗ | ✗ | ✗ | n/a | **LOW** · support contact form (not inspected) | no instant paint |
| `/nex-native/help` | ✗ | ✗ | ✗ | n/a | NO | no instant paint |
| `/nex-native/terms` | ✗ | ✗ | ✗ | n/a | NO | static |
| `/nex-native/privacy` | ✗ | ✗ | ✗ | n/a | NO | static |
| `/nex-native/pricing` | ✗ | ✗ | ✗ | n/a | NO | no instant paint |
| `/nex-native/ireland-entry` | ✗ | ✗ | ✗ | n/a | NO | server-rendered landing; lightweight |
| `/nex-native/cover` | ✗ | ✗ | ✗ | n/a | NO | no instant paint |
| `/nex-native/cover/preview` | ✗ | ✗ | ✗ | n/a | NO | no instant paint |
| `/nex-native/cover/preview/[layoutId]` | ✗ | ✗ | ✗ | n/a | NO | no instant paint |
| `/nex-native/cover-themes-library` | ✗ | ✗ | ✗ | n/a | NO | prefetched |
| `/nex-native/themes/[id]` | ✗ | ✗ | ✗ | n/a | NO | no instant paint |
| `/nex-native/themes/[id]/motion` | ✗ | ✗ | ✗ | n/a | NO | no instant paint |
| `/nex-native/unsubscribe/[token]` | ✗ | ✗ | ✗ | n/a | NO | one-shot |
| `/nex-native/hq/*` (16 pages) | ✗ | ✗ | ✓ **via `hq/layout.tsx:128`** | n/a | varies; HQ pages are operator surfaces | protected by SectionBoundary; mobile-locked |

### Routes that render without any `loading.tsx` upstream in the chain

The root layout `src/app/nex-native/layout.tsx` has NO `loading.tsx`
sibling, so any route that is not explicitly covered by a per-section
loading file and does not stream Suspense content will show blank
pixels for the duration of the SSR round-trip. The sections with their
own file today are:

- `chat` · `chat/peer/[accountId]` · `chat-themes-library` · `directory`
  · `home` · `search` · `settings` · `sign-in` · `vault`.

Every other route tree (free-chat, contacts, friends, group-chat,
manage, cart, orders, product, live-commerce, profile, call, community,
help, share, support, terms, privacy, pricing, ireland-entry, cover,
cover-themes-library, themes, unsubscribe, u, store, `[businessSlug]`,
create) blanks the viewport during SSR.

## SectionBoundary live-route wrap status

Only the HQ subtree is wrapped (`src/app/nex-native/hq/layout.tsx:128`,
`<SectionBoundary section="hq">`). Everything else is still
unprotected. Per-scope breakdown of UNPROTECTED routes with the
`IncidentScope` value each one should take:

| Scope | Unprotected routes (count · examples) | Mount site |
|---|---|---|
| `chat` | 10 — `chat/page.tsx`, `chat/peer/[accountId]/page.tsx`, `chat/peer/[accountId]/forward/[messageId]/page.tsx`, `chat/guest/[ownerAccountId]/page.tsx`, `free-chat/page.tsx`, `free-chat/call/page.tsx`, `free-chat/bubble-customize/page.tsx`, `chat-themes-library/page.tsx`, `chat-themes-library/all/page.tsx`, `group-chat/[groupId]/page.tsx` | per-page wrap or new `src/app/nex-native/chat/layout.tsx` + siblings |
| `chat` (contact rosters) | 2 — `contacts/page.tsx`, `friends/page.tsx` | same |
| `shops` | 17 — `manage/shop/page.tsx`, `manage/shop/start/page.tsx`, `manage/shop/themes/page.tsx`, `manage/shop/backgrounds/page.tsx`, `manage/shop/setup/*` (10), `store/page.tsx`, `u/[handle]/page.tsx`, `[businessSlug]/page.tsx` | new `src/app/nex-native/manage/shop/layout.tsx` + `src/app/nex-native/store/layout.tsx` |
| `shops` (consumer cart) | 3 — `cart/page.tsx`, `orders/page.tsx`, `orders/[orderId]/page.tsx` | new `src/app/nex-native/cart/layout.tsx` + `orders/layout.tsx` |
| `shops` (product detail) | 1 — `product/[productId]/page.tsx` | new `src/app/nex-native/product/layout.tsx` |
| `directory` | 3 — `directory/page.tsx`, `directory/landing/page.tsx`, `directory/[id]/page.tsx` | new `src/app/nex-native/directory/layout.tsx` |
| `live` | 2 — `live-commerce/studio/page.tsx`, `live-commerce/guidelines/page.tsx` | new `src/app/nex-native/live-commerce/layout.tsx` |
| `food` | 2 — `manage/menu/page.tsx`, `manage/menu/[itemId]/page.tsx` | new `src/app/nex-native/manage/menu/layout.tsx` |
| `fashion` | 4 — `manage/products/page.tsx`, `manage/products/[productId]/page.tsx`, `manage/products/[productId]/edit/page.tsx`, `manage/products/[productId]/interest/page.tsx` | new `src/app/nex-native/manage/products/layout.tsx` |
| `accommodation` | 1 — `manage/accommodation/[roomId]/page.tsx` | new `src/app/nex-native/manage/accommodation/layout.tsx` |
| `auth` | 1 — `sign-in/page.tsx` | per-page wrap |
| `auth` (session-dependent redirect) | 1 — `profile/me/page.tsx` (fires redirect to missing `/create-account`) | needs destination fix FIRST |
| `storage` | implicit under shops/chat via avatar + composer attachments; no dedicated route | n/a |
| `hq` | 0 (already protected) | `hq/layout.tsx:128` ✓ |

Scopes that do not correspond to a page under `/nex-native/*`:
`feed`, `property`, `infra`, `db`, `cron`.

Settings has no `IncidentScope` value in `incident-service.ts:57-72`.
Community has no scope. Owner call pending (`section-boundary-coverage-2026-11-08.md`
Recommendations R-SETTINGS and R-COMMUNITY).

### Non-Boundary siblings

`src/components/nex-native/surface-health/{ChatCoreBoundary,
VisualThemeBoundary, OptionalVisualModuleBoundary}.tsx` are renderer-
level boundaries, NOT section boundaries. Only one caller exists
(`src/components/nex-native/HauntedHotelDeck.tsx`). They do not
substitute for `SectionBoundary` and should not be re-purposed for it.

## `error.tsx` coverage per layout

| `layout.tsx` | `error.tsx` sibling? | Needed? |
|---|---|---|
| `src/app/nex-native/layout.tsx` | ✓ `src/app/nex-native/error.tsx` | Already present (commit `fd615fe`) |
| `src/app/nex-native/admin/layout.tsx` | ✗ | **YES** · admin workspace should fall back to its own card, not the consumer root `/nex-native` fallback (which links "Go home" to `/nex-native` and dumps the admin out of workspace) |
| `src/app/nex-native/hq/layout.tsx` | ✗ (uses `SectionBoundary` instead at `:128`) | Covered by `SectionBoundary section="hq"` · no `error.tsx` needed |
| `src/app/nex-native/prototypes/layout.tsx` | ✗ | **MAYBE** · prototypes tree is not user-facing by doctrine; owner call |
| `src/app/nex-native/vault/layout.tsx` | ✗ | **YES** · Vault is a security surface (PIN + encrypted content); a root-level `error.tsx` that surfaces the "Go home" link outside of Vault could leave an operator uncertain about lock state. Even a thin Vault-specific `error.tsx` that calls `reset()` without leaving the vault URL is preferable to the consumer root |

There are NO intermediate `error.tsx` files under `chat/`, `free-chat/`,
`manage/`, `cart/`, `orders/`, `live-commerce/`, `directory/`,
`profile/`, `settings/`, `sign-in/`, `community/`, `home/`, `vault/`,
`store/`, `u/`, `[businessSlug]/`, `product/`, `call/`, `call-centre/`,
`search/`, `create/`, `cover*`, `themes/`, `pricing/`, `ireland-entry/`,
`unsubscribe/`, `share/`, `support/`, `help/`, `terms/`, `privacy/`.

Priority candidates (sections where a section-scoped fallback is more
helpful than the root):

1. `src/app/nex-native/vault/error.tsx` · security surface, must stay
   inside vault URL space on crash.
2. `src/app/nex-native/admin/error.tsx` · admin workspace, must not
   drop the operator back to `/nex-native`.
3. `src/app/nex-native/manage/error.tsx` · seller editors, must offer
   "retry" without navigating off the setup flow mid-entry.

The root `error.tsx` at `src/app/nex-native/error.tsx:35-139` already
redacts (`error.message` and `error.stack` are NEVER rendered · only
`error.digest` appears in a muted strip at `:125-136`). That contract
holds for every current section; the per-section files above would add
navigation-stability and scope accuracy, not additional redaction.

## `loading.tsx` coverage per section

| Section | `loading.tsx`? | Blank-screen risk on nav |
|---|---|---|
| Chat hub (`/chat`) | ✓ `chat/loading.tsx:1-10` | Low |
| Peer chat (`/chat/peer/[accountId]`) | ✓ `chat/peer/[accountId]/loading.tsx:10-44` · dedicated emerald + gold pulse | Low |
| Free-chat (`/free-chat`) | ✗ | **BLANK** during SSR |
| Free-chat / call | ✗ | **BLANK** during SSR |
| Free-chat / bubble-customize | ✗ | **BLANK** during SSR |
| Chat themes library | ✓ `chat-themes-library/loading.tsx` | Low |
| Contacts / Friends / Group-chat | ✗ | **BLANK** during SSR |
| Directory | ✓ `directory/loading.tsx:14-18` (covers landing + `[id]`) | Low |
| Manage shop (all 14 pages) | ✗ | **BLANK** during SSR |
| Cart / Orders | ✗ | **BLANK** during SSR |
| Product detail | ✗ | **BLANK** during SSR |
| `u/[handle]` / `[businessSlug]` / `store` | ✗ | **BLANK** during SSR |
| Live-commerce | ✗ | **BLANK** during SSR |
| Manage menu / products / accommodation | ✗ | **BLANK** during SSR |
| Profile (`/profile/me`, `/profile/[handle]`) | ✗ | **BLANK** during SSR |
| Settings | ✓ `settings/loading.tsx` (root) | Low |
| Sign-in | ✓ `sign-in/loading.tsx:6-8` | Low |
| Home | ✓ `home/loading.tsx` | Low |
| Vault | ✓ `vault/loading.tsx` | Low |
| Search | ✓ `search/loading.tsx` | Low |
| Call / Call-centre | ✗ | **BLANK** during SSR |
| Community | ✗ | **BLANK** during SSR |
| HQ | ✗ (HQ is mobile-locked at `hq/layout.tsx:49-56`) | Low (desktop pre-paints chrome before content) |
| Pricing / Privacy / Terms / Help / Support / Share | ✗ | **BLANK** during SSR |
| Cover* / Themes* / Unsubscribe | ✗ | **BLANK** during SSR |

16 of the 25 user-facing section roots lack a `loading.tsx`. Several
of these are the slowest routes (manage/shop/setup/* preloads an
existing business row before paint).

## Data-loss hazards per form

| Surface | Idempotency key? | Draft persistence? | Navigation guard? | "Unsent" indicator? | Verdict |
|---|---|---|---|---|---|
| Peer chat composer (`chat/peer/[accountId]/_composer.tsx`) | ✓ `send_intent_id` via server action (`peer-message-service.ts:376-383`, UNIQUE at migration 102 Part C) | ✓ `localStorage[draftKey]` at `_composer.tsx:241-273` | ✗ no `beforeunload` or `useRouter` guard | ✗ (not inspected) | **MITIGATED** for send; draft covers crash-restart |
| Cart checkout (`cart/_checkout-sheet.tsx`) | ✓ `sendIntentId` minted per-open at `:122-130`, UUID v4 | ✗ buyer name / phone / address / notes held only in `React.useState` (`:112-117`); re-opening sheet does not restore | ✗ no guard | ✗ | **PARTIAL** · double-tap safe, but a crash mid-entry loses the buyer form |
| Shop setup · identity (`manage/shop/setup/identity/_client.tsx`) | server pre-fills from existing row (`page.tsx:29-30`); no client-minted idempotency | ✗ no local draft (grep across `manage/shop/*` found none) | ✗ | ✗ | **GAP** |
| Shop setup · contact / location / category / hours / story / policies | same | ✗ | ✗ | ✗ | **GAP** across all 7 sub-steps |
| Profile edit (`settings/profile/edit/_profile-edit-form-client.tsx`) | ✗ (grep for `idempoten` found none) | ✗ no local draft | ✗ | ✗ | **GAP** |
| Avatar upload (`settings/profile/edit/_avatar-actions.ts`) | ✗ (no idempotency, resumable, or chunked; grep returned none) | n/a (file upload) | n/a | ✗ no in-flight indicator inspected | **GAP** · upload crash re-uploads full blob |
| Product create (`create/product/category/page.tsx`) | ✗ | ✗ | ✗ | ✗ | **GAP** |
| Menu item edit (`manage/menu/[itemId]/page.tsx`) | ✗ (not inspected in detail) | ✗ | ✗ | ✗ | **GAP** |
| Product edit (`manage/products/[productId]/edit/page.tsx`) | ✗ (not inspected in detail) | ✗ | ✗ | ✗ | **GAP** |
| Accommodation edit (`manage/accommodation/[roomId]/page.tsx`) | ✗ | ✗ | ✗ | ✗ | **GAP** |
| Vault chat composer (`vault/home/chats/[conversationId]/_vault-chat-client.tsx`) | ✓ `idempoten` present (grep hit) · not deep-inspected here | not inspected | not inspected | not inspected | **MITIGATED** (verify in a Vault-specific audit) |
| Sign-in / password form (`sign-in/_password-input.tsx`) | n/a (auth action) | ✗ | ✗ | ✗ | Low · field is tiny · still a GAP if user fat-fingers refresh |

E2E posture preserved: the peer-chat composer draft lives in
`localStorage` only (`_composer.tsx:241`); it is never sent to the
server and never logged. This audit does NOT propose moving draft
content server-side.

## Non-idempotent retry violations (should be empty)

**Verdict: zero violations in production code.** The only production
call-site of `withRetry` is at
`src/app/api/nex-native/auth/webauthn/assert-finish/route.ts:222-244`,
and it wraps the `auth.admin.getUserById` READ. The accompanying
comment at `:212-220` explicitly states the subsequent
`auth.admin.generateLink` and `ssr.auth.verifyOtp` mutations are
deliberately NOT wrapped because they are non-idempotent writes.

Full inventory of `withRetry` call-sites:

- `src/app/api/nex-native/auth/webauthn/assert-finish/route.ts:222` ·
  wraps READ (`auth.admin.getUserById`) with `idempotent: true` · OK.
- `src/lib/nex-native/recovery/__tests__/retry.test.ts` · test file.
- `src/lib/nex-native/recovery/__tests__/recovery-wires.test.ts` · test.
- `src/lib/nex-native/recovery/__tests__/recovery-scenarios.test.ts` · test.
- `src/lib/nex-native/recovery/__tests__/fault-injection.ts` · test fixture.
- `src/lib/nex-native/recovery/retry.ts` · the primitive itself.
- `src/app/api/nex-native/cron/security-audit-reconcile/route.ts` ·
  grep hit was on documentation/imports, not a call-site (confirmed:
  no `withRetry(` match in that file).

No payment, no account creation, no account deletion, no message send,
no rate-limit counter, no order creation is currently wrapped in
`withRetry`. The sealed non-idempotent-never-retry rule holds.

## Top 10 fixes to land next (ranked by blast radius)

1. **Wrap `/live-commerce/studio` with `<SectionBoundary section="live">`.**
   Long-lived WebRTC surface. A render regression here currently
   collapses the entire shell. Minimal risk · class boundary in a
   client wrapper around `StudioClient` at
   `src/app/nex-native/live-commerce/studio/page.tsx:26-28`.
2. **Fix the broken `profile/me` redirect to the missing
   `/create-account` route.** `src/app/nex-native/profile/me/page.tsx:42`
   sends unauthenticated users to `/nex-native/create-account?
   return_to=/nex-native/profile/me`, and that route has no `page.tsx`
   under `src/app/nex-native/*`. Also audit the 3 other call-sites
   (`_actions.ts:125`, `:545`, `:6934`). Either create the route or
   redirect to `/nex-native/sign-in?next=/nex-native/profile/me`.
3. **Wrap `/chat/peer/[accountId]` with `<SectionBoundary section="chat">`.**
   Highest-traffic authenticated screen. Draft + idempotency are
   present but a render crash still blanks the shell. Mount as a thin
   client wrapper around the existing SSR shell.
4. **Add `vault/error.tsx`.** Vault is a security surface; a root
   `error.tsx` "Go home" link navigates out of the locked space.
   Vault-specific error renders should stay inside `/nex-native/vault`.
5. **Add `admin/error.tsx`.** Same reason: the consumer root
   `error.tsx` (`src/app/nex-native/error.tsx:106-122`) links back to
   `/nex-native`, which dumps an admin out of their workspace.
6. **Add `loading.tsx` to `manage/shop/`, `manage/products/`,
   `manage/menu/`, `manage/accommodation/`.** Four files; eliminates
   the blank-paint window on seller-editor taps (slowest routes in
   the app).
7. **Wrap `/cart` + `/orders` with `<SectionBoundary section="shops">`
   AND persist the checkout form.** Checkout has idempotency
   (`_checkout-sheet.tsx:122`) but no draft persistence, so a reload
   loses buyer name / phone / address / notes. `localStorage` under a
   per-cart key, cleared on `onClose` + successful submit, mirrors the
   peer-composer pattern at `_composer.tsx:241-273`.
8. **Wrap the shop setup flow with `<SectionBoundary section="shops">`
   AND add a per-step `localStorage` draft.** 7 editor pages lose
   field state on any client crash today. Draft pattern identical to
   peer composer.
9. **Wrap `/directory` with `<SectionBoundary section="directory">`
   and `/live-commerce/guidelines` with `<SectionBoundary section="live">`.**
   Low blast radius individually, but completes the Live + Directory
   scopes.
10. **Decide R-SETTINGS + R-COMMUNITY.** Add a `settings` scope (or
    alias to `auth`) to `IncidentScope` at
    `src/lib/nex-native/incident/incident-service.ts:57-72` + extend
    `LEGAL_SECTIONS` at
    `src/app/api/nex-native/incident/section-error/route.ts:48-64` +
    the switch in `SectionBoundary.tsx:172-204`. Same for `community`.
    Only then wrap those sub-trees.

### Out of scope for this audit

- No wrap edit was applied anywhere. This document is evidence for
  the next authorisation decision.
- No `error.tsx` or `loading.tsx` file was added. All proposed files
  are RECOMMENDATIONS pending owner authorisation.
- Composer E2E posture was preserved. The audit only reads call-sites;
  no content was logged, forwarded, or inspected beyond file metadata.
- Vault chat composer deep-inspection deferred · a Vault-specific
  idempotency + envelope audit is a separate task.
- `beforeunload` guards were NOT proposed on draft-capable surfaces
  because they fight PWA install flows + iOS Safari swipe-back; the
  draft-persistence pattern is the correct safety net.
