# NEX World-Class Mobile Experience — Engineering Standard

**Status:** SEALED (standard)
**Issued:** 2026-10-30 by Philip (owner)
**Scope:** All NEX surfaces (`src/app/nex-native/`, `src/components/nex-native/`, `src/lib/nex-native/`). Applies to every feature from this date forward.
**Classification:** Load-bearing engineering doctrine. Future performance / UX / navigation / media work must observe this standard. Overrides any screen-by-screen "make this bit faster" instinct.

---

## 1 · Governing principle

Establish a consistent, world-class mobile experience across the NEX application — not just the Music Library or preview player. NEX must feel fast, responsive, reliable, polished, and natural on mobile devices, including slower networks and lower-powered hardware.

Follow the existing NEX Constitution, Record Constitution, Feature Filter, established architecture, and all current authorization boundaries. Preserve existing work. Do not redesign the product or simplify existing features without authorization.

---

## 2 · The five standards (always on)

**S1 · Fast first impression.** Load the visible screen and its primary content first. Defer below-the-fold images and nonessential work. Use skeletons or meaningful loading states rather than blank areas or frozen buttons.

**S2 · Mobile-first interaction.** Buttons must respond immediately with visible feedback, prevent accidental double submissions, and have comfortable touch targets. Swipes, back navigation, overlays, and audio controls must behave predictably.

**S3 · Respect the user's connection.** Prioritize the next likely action when useful, but avoid preloading large media on data-saving or slow connections. Cancel stale work when users navigate away.

**S4 · Reliability before cleverness.** Preserve permissions, entitlements, data integrity, playback cleanup, accessibility, and existing routes. Fast navigation is not an improvement if it causes stale counters, duplicate actions, broken browser history, or overlapping audio.

**S5 · Measure on real devices.** Test representative Android and iOS devices, desktop, and constrained networks. Measure actual load and interaction times instead of promising a particular millisecond improvement based only on code inspection.

---

## 3 · Three-phase rollout contract

**Phase A — read-only application-wide audit.** No code changes. Inventory the actual repository's existing patterns and problems across:

1. **Loading performance** — initial screen priority, image sizing/decoding/priority/lazy, route transitions, data fetching, repeated requests, skeletons/loading/empty/error states, unnecessary rendering.
2. **Buttons + touch interactions** — immediate pressed/loading feedback, duplicate submissions, touch targets + spacing, disabled/error/success feedback, keyboard/screen-reader/focus/a11y, no silent-no-op buttons.
3. **Mobile navigation** — browser Back/Forward, drawer/modal/overlay/fullscreen transitions, scroll + in-progress preservation, swipe vs button/scroll/media conflicts, cleanup on screen change.
4. **Images + media** — Universal Image Display Integrity doctrine (2026-10-30) compliance, visible-content prioritisation without eagerly loading everything, overlapping-audio / stale-callback / orphan-media prevention, publication-visibility + ownership + rights respected.
5. **Network + device constraints** — Save-Data + slow-connection respected, stale-request cancellation, no big-media preload against user's likely next action, usable failure + retry.
6. **Application reliability** — auth / entitlements / authorization / data-integrity never weakened for speed, existing route contracts + behavior preserved, no private-data cache leaks or stale account display, no unnecessary dependencies or duplicated infrastructure.

**Phase B — produce a prioritised implementation plan.** Classify findings:

- **P0 Critical** — broken interactions, security / privacy risk, data loss, inaccessible core journeys.
- **P1 Essential** — visible loading delays, unreliable buttons, navigation defects, serious mobile usability problems.
- **P2 Optimisation** — safe image prioritisation, selective preloading, reduced redundant work, measured rendering improvements.
- **P3 Architectural** — client-side navigation changes, shared performance infrastructure, API / DB / route-contract changes.

Each finding must report: exact file/component, observed behaviour, evidence, proposed change, regression risk, dependencies, verification method. Identify shared components and patterns that could solve repeated problems without creating a new framework unnecessarily.

**Phase C — controlled implementation.** Do not automatically modify the entire app. After the audit, recommend the smallest high-value implementation batch. Wait for owner approval before starting that batch. When authorised:

- Work only within the approved scope.
- Preserve pre-existing uncommitted changes.
- Do not apply migrations, change schemas, modify production account data, push, deploy, or expand into held phases unless separately authorised.
- Do not alter unrelated features while making performance improvements.
- Report exactly what changed, what was tested, what was not tested, and remaining risks.

---

## 4 · Current music-player state (reference, not final)

**Tier 1 + Tier 2 implemented 2026-10-30** per build report in prior chat (placeholder colour → NEX chat free `#020914`; priority hints; sibling cover + background preload; Save-Data / 2G gate; router.prefetch for prev/next routes). **Treat as implemented per report, not proof of end-to-end performance.** Verification requirements before claiming "world-class":

- First visible library tiles load promptly on real mobile.
- Hero images have sensible priority (not de-prioritised).
- Remaining images are not unnecessarily eager-loaded.
- Preloads use valid, authorised URLs; no duplicate / excessive requests.
- Save-Data + slow-network behaviour works as intended.
- Prev/next route prefetching is useful and doesn't create significant unnecessary traffic.
- All injected preload links clean up correctly on unmount.

Do not claim measured performance improvements until measured.

---

## 5 · Tier 3 decisions (principles sealed, implementation NOT yet approved)

Design principles authorised:

1. **Back / Forward** — Approve principle, with safeguard: preserve originating Feed / Library context. Track navigation must not trap users in an endless history cycle. Distinguish intentional track selection from automatic track continuation; document the resulting history behaviour before coding.
2. **Like / play state API** — Approve investigating and using an API if needed. First check existing endpoints, authorization, and data access; do not create a duplicate API unnecessarily. Enforce server-side authorization. Return only information the current viewer is permitted to access.
3. **Autoplay** — Approve for an active listening session, including track-to-track continuation. Do not unexpectedly autoplay on a fresh visit or override browser restrictions and user preferences.

**Blocked:** Do not implement Tier 3 until the owner explicitly approves its implementation plan (post-audit, post focused read-only nav/playback review).

Do not promise sub-100ms navigation. A client-side swap reduces server-navigation overhead but data fetching, image decoding, and audio startup still take time.

---

## 6 · Required verification (evidence not assumptions)

Where applicable, test:

- Realistic mobile viewport sizes.
- Android and iOS browser behaviour where available.
- Slow-network and data-saving conditions.
- Repeated taps and rapid navigation.
- Browser Back/Forward and return to the originating screen.
- Loading failures and retry behaviour.
- Audio continuation, interruption, and cleanup.
- Existing authentication and entitlement boundaries.

Report automated checks separately from real-device and end-to-end tests. Do not infer that a page returning HTTP 200 proves its interactions work.

---

## 7 · Open gates (always re-check before invoking the standard)

- All existing sealed holds remain in force (Vault LOCKED · Package DRAFT · Service Principle DRAFT · Theme Commerce DRAFT · Pricing baseline · Phase A1 Accommodation · 3 unimplemented claims · migrations 145 / 202 / 235 · 660 unapproved images · email backfill · orphan storage · Live R9 DRAFT · Community Notice security copy · pending-invite privacy · keypad universal · chat master layout · design tokens · NEX never handles payments · A-strict scope · Main Feed slot primitive DRAFT · D1 public listening DRAFT).
- Deployment is a separate gate.
- Target repo = `C:/Users/Victus/nexapp` (confirmed 2026-10-27, re-confirmed 2026-10-30).
- The Main Feed Constitution + Creator Libraries doctrine (2026-10-30) + Universal Image Display Integrity doctrine (2026-10-30) co-govern anything the standard touches.

---

## 8 · How this document is used

- Every new feature / performance change / mobile UX change must cite the relevant standard (S1-S5) in its proposal.
- Phase B plans must classify every finding P0 / P1 / P2 / P3.
- Phase C implementations require explicit owner approval per batch.
- Memory index entry at `MEMORY.md` links back here.
- This document is read into every NEX engineering decision from 2026-10-30 forward.
