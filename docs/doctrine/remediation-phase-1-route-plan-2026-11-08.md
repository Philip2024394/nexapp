# NEX Remediation Phase 1 · Route-by-Route Protection Plan
## 2026-11-08 · Priority 1 · User-facing failure isolation

Sealed per the Phase 1 remediation directive 2026-11-08 (round 6).
Derived from `safety-audit-A-user-sections-2026-11-08.md`.

Branch `nex-ireland-build-2026-11-06` · HEAD `1693f1e2`.

## Containment pattern (all segments)

Each route segment gets an `error.tsx` file that:

1. Catches any render error that escapes the segment's render tree.
2. Fires a redacted POST to `/api/nex-native/incident/section-error`
   with `{ section, message_short: error.message.slice(0, 120) }` ·
   never `error.stack`, never `componentStack`.
3. Renders a branded NEX fallback card (emerald palette · matches
   root `error.tsx`) with a **Try again** button (`reset()`) and a
   **Go home** link.
4. Shows an opaque digest for support when Next provides one.

The fallback is a reusable client component
`src/components/nex-native/section-boundary/SegmentErrorBoundary.tsx`.
Each segment's `error.tsx` is a 10-line file that passes a `section`
name. Keeps the surface consistent and makes new wraps mechanical.

A render failure in any wrapped segment:
- Does NOT crash a sibling segment.
- Does NOT reach the Next default stack-trace page.
- DOES report a redacted incident to HQ Alerts.
- DOES let the user retry the segment without a full page reload.

## Segment coverage matrix

Scope values map to the sealed `IncidentScope` enum (migration 300).
Two new scopes authorised 2026-11-08 (round 6): `settings` + `community`.

| # | Segment | Route(s) | Scope | Blast radius | Priority |
|---|---|---|---|---|---|
| 1 | Chat core | `/chat/*`, `/free-chat` | `chat` | ★★★★★ | Batch 1 |
| 2 | Peer chat | `/chat/peer/[accountId]` | `chat` | ★★★★★ | Batch 1 |
| 3 | Contacts | `/contacts` | `chat` | ★★★★☆ | Batch 1 |
| 4 | Public shop | `/[businessSlug]` | `shops` | ★★★★★ | Batch 1 |
| 5 | Cart + checkout | `/cart` | `shops` | ★★★★☆ | Batch 1 |
| 6 | Shop manage | `/manage/shop/*` | `shops` | ★★★★☆ | Batch 1 |
| 7 | Live + go-live | `/live/*`, `/go-live` | `live` | ★★★★☆ | Batch 1 |
| 8 | Directory | `/directory`, `/directory/*` | `directory` | ★★★☆☆ | Batch 1 |
| 9 | Settings | `/settings/*` | `settings` (NEW) | ★★★☆☆ | Batch 1 |
| 10 | Community | `/community/*` | `community` (NEW) | ★★★☆☆ | Batch 1 |
| 11 | Chat themes library | `/chat-themes-library` | `chat` | ★★☆☆☆ | Batch 2 |
| 12 | Create product | `/create/product/*` | `shops` | ★★☆☆☆ | Batch 2 |
| 13 | Themes gallery | `/themes/*` | `chat` | ★★☆☆☆ | Batch 2 |
| 14 | Profile view | `/profile/*` | `settings` | ★★☆☆☆ | Batch 2 |
| 15 | Call | `/call/*` | `chat` | ★★☆☆☆ | Batch 2 |

**Batch 1 lands in this commit** · it covers every top-traffic
surface. Batch 2 lands in a focused follow-up.

## `/create-account` broken-reference fixes

Three code-paths currently redirect to `/nex-native/create-account`,
which was retired 2026-11-04 (sealed memory). Replacements verified
against the actual live routes:

| File · line | Before | After |
|---|---|---|
| `src/app/nex-native/profile/me/page.tsx:42` | `/create-account?return_to=...` | `/settings/profile/edit?from=signup&return_to=...` (sealed "create profile" surface) |
| `src/app/nex-native/_actions.ts:125` (`redirectToCreateAccountWithError`) | `/create-account?...` | `/sign-in?mode=signup&...` (the live signup surface per sealed Ireland auth model) |
| `src/components/nex-native/visitor-session/visitor-interact-popup.tsx` | `/create-account?claim=...` | **Deferred** · the claim-handoff flow needs its own owner sign-off before changing semantics · documented but not touched in this commit |
| `src/components/nex-native/control-drawer/control-drawer-client.tsx:1018` | Same claim-handoff path | **Deferred** · same reason |
| `src/components/nex-native/billing/start-checkout-client.tsx:75` | `/create-account?next=...` | **Deferred** · billing flow · needs Package Contract DRAFT resolution |

The two claim-handoff + billing references are left alone to avoid
changing sensitive flows without owner authorisation. They're
catalogued here so the owner knows where they live.

## Deferred for Batch 2

- Settings sub-pages inventory (19 pages per prior audit) · needs
  shared `/settings/error.tsx` fallback covering all.
- Community sub-pages (`/community/chat` + `/community/*`).
- Draft-persistence + dirty-nav guard for editors (Priority 5, not
  Priority 1).

## Success criteria for this phase

1. Forcing an error in any Batch-1 segment shows the branded
   fallback, not a stack trace.
2. The incident report POST fires exactly once per segment crash.
3. Sibling segments stay interactive while one segment is in
   fallback state.
4. `reset()` re-mounts the segment without a full page reload.
5. No E2E chat content, auth tokens, keys, or PII reaches the
   incident payload.
