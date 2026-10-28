# NEX Create · Card A · Go Live Flow · SEALED 2026-10-28

**Status**: Flow sealed by founder 2026-10-28 · implementation gated on §4 decision below · no code · no migrations · no commits.

## 1 · Flow (sealed)

```
Card A on /nex-native/create
   │
   ▼
┌─ First-time ever user ─────────────────────────────┐
│                                                    │
│  ① /nex-native/live-commerce/welcome               │
│     • Sealed RULES list + agreement checkbox       │
│     • "Let's Go LIVE!" CTA                         │
│     • On agree + tap: markLiveWelcomeAccepted()    │
│       persists acceptance per-account              │
│     • router.push("/live-commerce/go-live")        │
│                                                    │
│  ② /nex-native/live-commerce/go-live               │
│     • Page mounts · server checks persistent flag  │
│     • Flag absent → render go-live + splash overlay│
│     • NexLiveFirstVisitSplash · visibleMs = 3000   │
│     • Auto-dismiss after 3s (or tap)               │
│     • On dismiss: server action marks flag SEEN    │
│                                                    │
│  ③ Control panel visible underneath                │
│     • Camera + presence + featured products +      │
│       Start Live                                   │
└────────────────────────────────────────────────────┘

┌─ Returning user (already accepted T&C) ────────────┐
│                                                    │
│  Card A → direct push → /go-live                   │
│     • Welcome is SKIPPED (acceptance is sticky)    │
│     • Splash does NOT fire (flag present)          │
│     • Control panel loads immediately              │
└────────────────────────────────────────────────────┘
```

## 2 · What already exists (verified by read)

| Primitive | File | State |
|---|---|---|
| Welcome page + T&C UI | `src/app/nex-native/live-commerce/welcome/_welcome-client.tsx` | ✅ Sealed · agreement checkbox + CTA + `markLiveWelcomeAccepted` persistence |
| Welcome acceptance persistence | `src/lib/nex-native/live-broadcast/live-welcome-acceptance.ts` | ✅ Exists |
| 3-second splash component | `src/components/nex-native/live-commerce/NexLiveFirstVisitSplash.tsx` | ✅ Exists · `visibleMs = 3000` default · auto-dismiss · sealed sessionStorage-sticky gate |
| Go-Live control panel | `src/app/nex-native/live-commerce/go-live/_go-live-client.tsx` | ✅ Sealed |
| Current welcome → go-live wiring | welcome `_welcome-client.tsx:79-82` | ✅ `router.push("/live-commerce/go-live")` on accept |
| Card A → welcome wiring | `src/app/nex-native/create/page.tsx` | ✅ `<Link href="/nex-native/live-commerce/welcome">` |

## 3 · What's missing (needs implementation)

| Missing | Why | Needs |
|---|---|---|
| **Persistent "has seen Go Live splash" flag per account** | Owner-sealed: splash fires once per account, not once per browser session · current component gates by sessionStorage (resets on new tab) | §4 decision below |
| **Splash mount on /go-live** | Component exists but isn't rendered inside the go-live page · only on the preview `/first-visit` route | Edit go-live page/client to read flag + conditionally render splash + mark-seen on dismiss |
| **Mark-seen server action** | Server-authoritative so new devices/tabs don't repeat | New action (if DB-backed) OR client localStorage write (if device-local) |

## 4 · Owner-sealed override 2026-10-28 (same day · clarification)

Original interpretation (now RETIRED): first-time ever per account · persistent gate (localStorage or DB).

**Owner clarified**: *"this is the live splash page they always see before enter into live page for streaming."*

Sealed: **splash fires on every `/go-live` mount** · no gate at all.

Implication:
- Zero persistent state needed
- Zero DB migration
- Zero localStorage
- Just mount `<NexLiveFirstVisitSplash onDismiss={noop} />` inside `_go-live-client.tsx` at the top level
- Every time any user lands on /go-live, splash fires for 3s, auto-dismisses, control panel visible

This is simpler than both prior options A and B. Only risk: repeated splash on fast re-entries · acceptable because the sealed welcome-acceptance already gates welcome (returning users skip welcome but still see splash every time, matching the owner-sealed "always see" semantic).

## 5 · Dependencies on existing sealed invariants

- **Sealed Live-eligibility contract (R9)**: welcome page already enforces this · go-live page already gates on tier/eligibility · splash does NOT override eligibility · if the user is shop-locked, the splash shouldn't fire (owner-decidable · recommend: splash fires AFTER eligibility passes, not before)
- **Sealed welcome RULES + checkbox + CTA copy** · do not change · owner-authored copy
- **Sealed `markLiveWelcomeAccepted` persistence** · do not change · continues to make welcome a one-time surface
- **Sealed `NexLiveFirstVisitSplash` 3000ms + auto-dismiss + tap-dismiss** · do not change · just rewire the gate

## 6 · Nothing changed by this doc

- Zero code · zero migrations · zero commits
- Current flow unchanged: Card A → Welcome → Go-Live (no splash)
- `_welcome-client.tsx` · untouched
- `_go-live-client.tsx` · untouched
- `NexLiveFirstVisitSplash.tsx` · untouched

**Awaiting founder pick between Option A (DB migration) OR Option B (localStorage) before any implementation.**

## 7 · If founder picks Option B, scope is tiny:

1. `NexLiveFirstVisitSplash.tsx` · swap `sessionStorage` → `localStorage` · same key or new one (`nex-live-splash-seen` perm vs `nex-live-splash-seen-session` old)
2. `/go-live/_go-live-client.tsx` · mount `<NexLiveFirstVisitSplash onDismiss={() => {}} />` as a top-level sibling · splash self-manages its gate
3. Zero DB, zero migration, zero new routes, zero new tests beyond a smoke check

Can ship within the sealed Phase 5 governance as a scoped single-commit change pending separate implementation authorization.

## 8 · If founder picks Option A, scope needs a migration gate first:

1. Draft migration doctrine for `nex_account_profile.live_welcome_splash_seen_at`
2. Owner authorizes migration separately
3. Apply migration to prod Supabase (sealed `ijvqdvsvwtwxzcqmoqit` guard)
4. Build server action to mark the flag
5. Edit `/go-live/page.tsx` to SSR-read the flag
6. Edit `_go-live-client.tsx` to mount splash conditionally
7. Verification: Playwright at 390×844 · splash fires exactly once · subsequent visits bypass

Multi-step · 2-3 approval gates · more effort for proper correctness.
