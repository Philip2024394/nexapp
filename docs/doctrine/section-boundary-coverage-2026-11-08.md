# SectionBoundary coverage audit · 2026-11-08

Read-only verification for NEX Security & Recovery Final Verification Phase.
Branch: `nex-ireland-build-2026-11-06` · HEAD: `451f780`.

## Summary

- Primitive location: `src/components/nex-native/section-boundary/SectionBoundary.tsx`
- Companion endpoint: `src/app/api/nex-native/incident/section-error/route.ts`
- Boundary is **production-ready** but is **NOT mounted in ANY live route**
  under `src/app/nex-native/*`.
- Only two non-production references to the symbol exist:
  - `src/components/nex-native/section-boundary/__tests__/section-boundary.test.ts`
  - `src/app/api/nex-native/incident/section-error/route.ts` (type-import only,
    not a mount)
- There are also **no `error.tsx` route-level boundaries** under
  `src/app/nex-native/*`, so a client-side render failure in any section
  currently escalates to the Next.js top-level built-in overlay.

A sibling family of narrower renderer-boundaries lives at
`src/components/nex-native/surface-health/*` (`ChatCoreBoundary`,
`VisualThemeBoundary`, `OptionalVisualModuleBoundary`). These are
RENDERER-level boundaries and only one call-site exists:
`src/components/nex-native/HauntedHotelDeck.tsx`. They are not a substitute
for SectionBoundary.

## Routes audited

| Section | Live route(s) | SectionBoundary mounted? |
|---|---|---|
| Chat · peer | `src/app/nex-native/chat/page.tsx`, `src/app/nex-native/chat/peer/[accountId]/page.tsx`, `src/app/nex-native/chat/peer/[accountId]/forward/[messageId]/page.tsx`, `src/app/nex-native/chat/guest/[ownerAccountId]/page.tsx` | No |
| Chat · free-chat | `src/app/nex-native/free-chat/page.tsx`, `src/app/nex-native/free-chat/call/page.tsx`, `src/app/nex-native/free-chat/bubble-customize/page.tsx` | No |
| Chat · themes | `src/app/nex-native/chat-themes-library/page.tsx`, `src/app/nex-native/chat-themes-library/all/page.tsx` | No |
| Chat · group | `src/app/nex-native/group-chat/*` | No |
| Chat · contacts/friends | `src/app/nex-native/contacts/*`, `src/app/nex-native/friends/*` | No |
| Shops · manage | 14× under `src/app/nex-native/manage/shop/*` (`page.tsx`, `start/`, `backgrounds/`, `themes/`, `setup/{identity,contact,location,category,request-category,hours,story,policies,finish,...}/page.tsx`) | No |
| Shops · public page | `src/app/nex-native/u/[handle]/page.tsx` (the `[businessSlug]` route currently resolves via `u/[handle]`; see Gap S-1) | No |
| Shops · dedicated storefront | `src/app/nex-native/store/page.tsx` | No |
| Feed | Not a standalone route (reads of `nex_live_post` happen inside `src/app/nex-native/_actions.ts`; live-feed material surfaces inside `chat/peer/[accountId]/page.tsx`, `free-chat/page.tsx`, `directory/*`, `community/notices/[id]/page.tsx`, `profile/[handle]/page.tsx`). | No (no standalone page.tsx) |
| Live | `src/app/nex-native/live-commerce/studio/page.tsx`, `src/app/nex-native/live-commerce/guidelines/page.tsx` | No |
| Directory | `src/app/nex-native/directory/page.tsx`, `src/app/nex-native/directory/landing/page.tsx`, `src/app/nex-native/directory/[id]/page.tsx` | No |
| Food (menu) | `src/app/nex-native/manage/menu/page.tsx`, `src/app/nex-native/manage/menu/[itemId]/page.tsx` | No |
| Fashion (products) | `src/app/nex-native/manage/products/page.tsx`, `src/app/nex-native/manage/products/[productId]/page.tsx`, `.../edit/page.tsx`, `.../interest/page.tsx` | No |
| Accommodation | `src/app/nex-native/manage/accommodation/[roomId]/page.tsx` | No |
| Property | No distinct route today (business-type property reuses the Shops manage tree; no `property/*` subtree). | N/A (no routes) |
| HQ | 16× under `src/app/nex-native/hq/*` (`page.tsx`, `pages/`, `harvest/`, `chat-themes/`, `communities/{,[zoneId]}/`, `members/{,[accountId]/message/,shops,chats,vault}/`, `security-audit/{,retention,deletion-recovery}/`, `security-recovery/{,[incidentId]}/`) | No |
| Settings | 19× under `src/app/nex-native/settings/*` | No |

### Scope values defined in `IncidentScope` but with no page.tsx

`feed`, `property`, `food`, `fashion`, `accommodation` are declared in the
`IncidentScope` type at `src/lib/nex-native/incident/incident-service.ts:57-72`
but either lack a dedicated route tree (`feed`, `property`) or live inside
other routes (`food` under `/manage/menu/*`, `fashion` under
`/manage/products/*`, `accommodation` under `/manage/accommodation/*`).

## Boundary coverage matrix

| IncidentScope | Routes exist? | Boundary mounted? | Gap |
|---|---|---|---|
| chat | yes | no | G-CHAT |
| shops | yes | no | G-SHOPS |
| feed | no standalone route | n/a | none (scope reserved) |
| live | yes | no | G-LIVE |
| directory | yes | no | G-DIR |
| food | via `/manage/menu/*` | no | G-FOOD |
| fashion | via `/manage/products/*` | no | G-FASHION |
| accommodation | via `/manage/accommodation/*` | no | G-ACC |
| property | no dedicated route | n/a | none |
| hq | yes | no | G-HQ |
| infra / auth / storage / db / cron | infrastructural — not surfaces | n/a | out-of-scope by design |

Total gaps that correspond to real live surfaces: **8**
(chat, shops, live, directory, food, fashion, accommodation, hq).
`settings/*` is not an incident scope but is a user-facing section — see
Recommendation R-SETTINGS below.

## Gaps identified

### G-CHAT · chat section is unprotected (peer + free-chat + themes)

- Scope: `"chat"` in `IncidentScope`.
- Pages affected: every page under `src/app/nex-native/chat/`,
  `src/app/nex-native/free-chat/`, `src/app/nex-native/chat-themes-library/`,
  `src/app/nex-native/group-chat/`, `src/app/nex-native/contacts/`,
  `src/app/nex-native/friends/`.
- Narrower `ChatCoreBoundary` from `surface-health` exists but is NOT mounted
  in any chat page (only `HauntedHotelDeck.tsx` uses that family).
- Consequence: a render fault inside chat propagates upward to the
  framework-level error overlay, blocking the whole shell.

### G-SHOPS · shop management + public shop are unprotected

- Scope: `"shops"`.
- Pages affected: 14 `manage/shop/*` pages + `u/[handle]/page.tsx` +
  `store/page.tsx`.
- Of the entire Shops tree there is no boundary at ANY level, including the
  cart (`src/app/nex-native/cart/*`) and orders (`src/app/nex-native/orders/*`)
  — a render crash in cart would wipe the shell.

### G-LIVE · live-commerce studio is unprotected

- Scope: `"live"`.
- Pages affected: `live-commerce/studio/page.tsx`,
  `live-commerce/studio/_studio-client.tsx`, `live-commerce/guidelines/page.tsx`.
- Studio is a long-lived WebRTC surface; a render regression here is the
  highest-impact one in the app.

### G-DIR · directory surfaces are unprotected

- Scope: `"directory"`.
- Pages affected: `directory/page.tsx`, `directory/landing/page.tsx`,
  `directory/[id]/page.tsx`.

### G-FOOD · menu management is unprotected

- Scope: `"food"`.
- Pages affected: `manage/menu/page.tsx`, `manage/menu/[itemId]/page.tsx`.

### G-FASHION · product management is unprotected

- Scope: `"fashion"` (per the IncidentScope mapping — all merchant product
  management falls under this scope).
- Pages affected: `manage/products/page.tsx`,
  `manage/products/[productId]/page.tsx`, `.../edit/page.tsx`,
  `.../interest/page.tsx`.

### G-ACC · accommodation room management is unprotected

- Scope: `"accommodation"`.
- Pages affected: `manage/accommodation/[roomId]/page.tsx`.

### G-HQ · entire HQ surface is unprotected

- Scope: `"hq"`.
- Pages affected: 16 pages under `hq/*`.
- Critical sub-areas: `hq/security-audit/*`, `hq/security-recovery/*`,
  `hq/pages/*` (the HQ Pages dashboard · deletes authored content), and
  `hq/members/[accountId]/message/*` (HQ direct-message surface).
- A render crash in a destructive HQ screen could leave an operator uncertain
  whether their action committed.

### G-COMMUNITY · community surfaces are unscoped

- `src/app/nex-native/community/*` exists but has no matching `IncidentScope`.
  If a boundary is mounted here it needs either a new scope added to
  `IncidentScope` + `LEGAL_SECTIONS` in
  `src/app/api/nex-native/incident/section-error/route.ts:48-64` or should be
  tagged under `"chat"` (owner call).

### Not a gap · boundary scaffolding completeness

- The companion endpoint already accepts every scope in `IncidentScope` and
  silently drops anything else (`LEGAL_SECTIONS` set at
  `src/app/api/nex-native/incident/section-error/route.ts:48-64`), so adding
  the wrapper at the page level is safe to ship incrementally.

## Recommended wrapping order

Priority rationale: the order follows user-visible blast radius × destructive
weight. A crash in a destructive operator surface (HQ) or a long-lived
real-time surface (Live) is worse than a crash on a settings screen.

1. **HQ** (G-HQ). Operator surfaces touching destructive actions:
   `hq/pages/page.tsx`, `hq/security-audit/deletion-recovery/page.tsx`,
   `hq/security-recovery/[incidentId]/page.tsx`,
   `hq/members/[accountId]/message/page.tsx`. Wrap each `page.tsx` body in
   `<SectionBoundary section="hq">`.
2. **Chat · peer** (G-CHAT · peer). `chat/peer/[accountId]/page.tsx` is the
   highest-traffic authenticated screen. Wrap with
   `<SectionBoundary section="chat">`.
3. **Live · studio** (G-LIVE). `live-commerce/studio/page.tsx` is the
   highest-impact WebRTC surface. Wrap with
   `<SectionBoundary section="live">`.
4. **Shops · public + cart** (G-SHOPS · consumer). `u/[handle]/page.tsx`,
   `store/page.tsx`, `cart/*`, `orders/*`. Wrap with
   `<SectionBoundary section="shops">`.
5. **Shops · manage** (G-SHOPS · seller). Wrap `manage/shop/page.tsx` and
   each sub-step.
6. **Chat · free-chat + themes** (G-CHAT · rest).
7. **Directory** (G-DIR). `directory/page.tsx`, `directory/landing/page.tsx`,
   `directory/[id]/page.tsx`.
8. **Food** (G-FOOD). `manage/menu/page.tsx`,
   `manage/menu/[itemId]/page.tsx`.
9. **Fashion** (G-FASHION). `manage/products/*/page.tsx`.
10. **Accommodation** (G-ACC). `manage/accommodation/[roomId]/page.tsx`.

### Settings · recommendation R-SETTINGS

Settings has 19 pages and currently has no IncidentScope value. Two options:

- Option A: add `"settings"` to `IncidentScope` (edit
  `src/lib/nex-native/incident/incident-service.ts:57-72`, add to
  `LEGAL_SECTIONS` at
  `src/app/api/nex-native/incident/section-error/route.ts:48-64`, add label in
  `src/components/nex-native/section-boundary/SectionBoundary.tsx` switch at
  `:172-204`). Requires a one-line migration note so the HQ dashboard surfaces
  the new scope.
- Option B: tag settings pages under `"auth"` since many settings surfaces
  (password change, session revoke, delete account) are auth-adjacent. This
  matches the existing scope vocabulary but reads as awkward for things like
  `settings/chat-font/page.tsx`.

Owner call required before any boundary is mounted on settings.

### Community · recommendation R-COMMUNITY

`src/app/nex-native/community/*` has no matching scope. Same options as
Settings: either add `"community"` scope or route under `"chat"`. Owner call.

## Implementation checklist (per page, when authorised)

Each page gets a three-line edit:

```tsx
import { SectionBoundary } from "@/components/nex-native/section-boundary/SectionBoundary";
// ...
return (
  <SectionBoundary section="chat">
    { /* existing page body */ }
  </SectionBoundary>
);
```

Notes for the implementer:

- The component is a class with `"use client"` at line 1. It MUST be mounted
  from a client boundary or wrapped by a thin client component — a Next 15
  server component cannot render a class component directly.
- Do NOT pass a stack trace to the boundary. The boundary is the thing that
  guarantees no stack trace crosses the wire — the caller never needs to
  forward anything.
- The `fallback` prop is optional. The default fallback at
  `SectionBoundary.tsx:105-170` is country-neutral and meets the sealed
  non-technical copy contract.
- `onError` is advisory only — any exception it throws is swallowed by
  design (`:76-80`).

## Non-goals

- This audit does NOT prescribe mounting; the owner has not authorised any
  wrap. The document is evidence for the next authorisation decision.
- This audit does NOT recommend changing the fallback card copy or layout.
- This audit does NOT recommend adding per-page `error.tsx` files — the
  owner's doctrine positions `SectionBoundary` as the section-level mechanism.

## Evidence of read-only verification

Grep used: `SectionBoundary` across `src/` → 2 matches, both the component's
own test file and the companion API route. Zero mount sites exist under
`src/app/nex-native/*`. Zero `error.tsx` files exist under
`src/app/nex-native/*`.
