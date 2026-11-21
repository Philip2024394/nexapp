# NEX · free-chat theme first-visit implementation · review

Date: 2026-10-14
Scope: a mobile-first, chat-chrome first-visit landing with three honest theme destinations. No sealed surface modified · no commerce bypass · no fake payment · no face-cover invented · no sealed service touched. One report file. Four new source files + one new test file.

Companions:
- `docs/doctrine/nex-package-feature-entitlement-map-2026-10-14.md` (§Section 10 answered the ten executive questions this feature respects)
- `docs/doctrine/nex-production-route-containment-review-2026-10-14.md` (B9/B10 · the three prototype dirs now 404 in production)
- `docs/doctrine/nex-global-launch-readiness-2026-10-14.md` (Phase F · payment not implemented, commerce gated OFF)
- Chat Master Layout seal (MEMORY · 2026-10-14) · ChatIdentityHeader + ChatComposerPill as master primitives

---

## 1 · Files changed · exact scope

| Path | Status | Size |
|---|---|---|
| `src/app/nex-native/chat/first-visit/page.tsx` | **New** | 334 lines · the three-destination landing |
| `src/app/nex-native/chat/first-visit/shop/page.tsx` | **New** | 221 lines · honest "Shop opening Phase 2" browse-only preview |
| `src/app/nex-native/chat/first-visit/personalize/page.tsx` | **New** | 283 lines · honest "Personalization coming soon" preview |
| `src/app/nex-native/chat/first-visit/__tests__/first-visit.test.ts` | **New** | 350 lines · 41 focused tests |
| `docs/doctrine/nex-free-chat-theme-first-visit-implementation-2026-10-14.md` | **New** · this report | — |

**Zero existing file modified.** `git status --short` confirms no `M` entry for any pre-existing path within scope. The 29 pre-existing tracked modifications + ~130 untracked docs/data/scripts entries all preserved verbatim.

**No sealed surface touched:**
- `src/lib/nex-native/chat-chrome/*` (Chat Master Layout primitives) — untouched; imported only
- `src/lib/nex-native/tier-gate.ts` — untouched
- `src/lib/nex-native/product-service.ts` — untouched
- `src/lib/nex-native/account-service.ts` — untouched
- `src/lib/nex-native/launch-flags.ts` — untouched (prior B9/B10 pass still holds)
- Vault B.1-B.6A chain — untouched
- Bridge 99 `first-conversation/*` — untouched
- Migrations 191-196, 197 — untouched
- `tsconfig.json`, `package.json`, `vercel.json`, `next.config.mjs`, `.env.example` — untouched

---

## 2 · The production entry route (as modified)

**No existing entry route was modified by this task.** The new first-visit experience lives at a dedicated path:

- `/nex-native/chat/first-visit` — the three-destination landing
- `/nex-native/chat/first-visit/shop` — honest Shop preview
- `/nex-native/chat/first-visit/personalize` — honest Personalization preview

**Entry wire-up is a documented gap** (see §Section 7). Reaching the first-visit landing today requires direct navigation (URL, deep-link). A follow-up task should connect either (a) the post-signup redirect, or (b) a conditional link from `/home` for zero-conversation accounts. Both options were considered; neither is in scope for this bounded first pass.

---

## 3 · The three destinations and their exact behaviour

### 3.1 · Card 1 · "Chat Themes" · **PROVEN LIVE**

- **Href:** `/nex-native/chat-themes-library`
- **Status chip rendered:** `Live · Available now` (green).
- **Entitlement check:** none (confirms the package-feature audit: theme selection is NOT tier-gated).
- **Server-side effects on this card tap:** none. Clicking is navigation only; selection happens inside the library.

### 3.2 · Card 2 · "Chat Themes Shop" · **NOT WIRED FOR PURCHASE** · opens an honest browse-only preview

- **Href:** `/nex-native/chat/first-visit/shop`
- **Behaviour:** opens a new preview page at `src/app/nex-native/chat/first-visit/shop/page.tsx` that:
  - reads the live `nex_chat_theme` catalogue via `listActiveThemes()` and renders each theme as a browse tile
  - shows a prominent "Shop opening Phase 2" explainer at the top (orange theme badge)
  - renders tile name + tagline + accent swatch + tier label (Standard / Premium) · **no price, no buy button, no "unlock" CTA**
  - tolerates catalogue failure by falling through to a "Catalogue not available right now" state (no fabricated rows)
  - offers three navigation links: back to first-visit, open live library, continue to chat
- **Status chip rendered on the first-visit page:** `Phase 2 · Browse · purchases open Phase 2` (orange).
- **Commerce safety:** does NOT import `launch-flags.ts`. Does NOT consult `commerceEnabledForRequest`. Does NOT instantiate Stripe. Does NOT render a `$`, `IDR`, `£`, or any currency symbol as literal UI text (verified by test). Does NOT render "Buy", "Unlock", or "Add to cart" button text (verified).
- **Server-side effects:** read-only (`listActiveThemes()` catalogue read). No DB write, no cookie set, no state mutation.

### 3.3 · Card 3 · "Personalized Themes" · **NOT IMPLEMENTED** · opens an honest "preview the idea" page

- **Href:** `/nex-native/chat/first-visit/personalize`
- **Behaviour:** opens a new preview page at `src/app/nex-native/chat/first-visit/personalize/page.tsx` that:
  - renders an explicit "Personalization is on the way" explainer (violet theme badge)
  - picks up to three themes from the live catalogue whose accent hues are maximally distinct (via a pure `pickDistinctAtmospheric` helper that converts hex → HSL hue and selects evenly-spaced indices)
  - renders those three as small atmosphere tiles · each shows name + accent radial gradient preview · **no form input, no file upload, no save button, no generate button**
  - renders an explicit "What's not here yet" honesty block below the preview strip, naming the specific unavailable capabilities (upload, save, generate from photo)
  - offers three navigation links: back to first-visit, open live library, continue to chat
- **Status chip rendered on the first-visit page:** `Soon · Preview the idea · personalization coming` (cyan).
- **Honesty guarantees:**
  - no mention of "face-cover", "face cover", "facecover", "biometric", "beauty filter", "scan your face" anywhere in rendered content (verified by test)
  - no mention of "upload your theme", "upload your custom theme", "save your theme", "save your custom", "generate your theme" (verified)
  - no `<input type="file">` or Upload/Save/Generate button
- **Server-side effects:** read-only. No DB write, no cookie set.

### 3.4 · Status taxonomy

The three cards each render a distinct status chip:

| Card | Status enum | Chip label | Chip colour |
|---|---|---|---|
| Chat Themes | `"live"` | `Live` | green `#16D66B` |
| Chat Themes Shop | `"coming-phase-2"` | `Phase 2` | orange `#FF7200` |
| Personalized Themes | `"coming-soon"` | `Soon` | cyan `#00AFFF` |

The chip + descriptive status text under each card means a user cannot mistake Shop or Personalize for a live feature.

---

## 4 · First-visit vs returning-user behaviour

### 4.1 · What this task implements

- Any signed-in NEX user who navigates to `/nex-native/chat/first-visit` sees the three destinations.
- Guest users (no NEX session) redirect to `/nex-native/welcome` — the sealed guest-side first-open experience.
- The page is `force-dynamic` + `runtime="nodejs"` because `resolveNexAppSessionOrGuest()` requires server-side cookies/headers context.

### 4.2 · What this task does NOT implement

- **No automatic entry wire-up.** New users do not land here automatically after signup. This is a documented gap · see §Section 7.
- **No "first-visit-dismissed" cookie.** The page does not set state. Returning users can navigate to it as many times as they want and nothing persists. This matches the brief's "do not rely exclusively on local storage for an account-level decision" rule — rather than invent a weak signal, we leave the auto-redirect question for a sealed follow-up with proper state.

### 4.3 · Returning users

Returning users are unaffected. Nothing in this task modifies:
- `/nex-native/chat/page.tsx` (the normal chat landing)
- `/nex-native/home/page.tsx`
- `/nex-native/welcome/page.tsx`
- `/nex-native/post-signup-apply/page.tsx`
- `/nex-native/sign-in/*`
- `/nex-native/create-account/*`

A returning user who signed up weeks ago and never saw this first-visit page will not be routed through it. Their existing landing behaviour is preserved.

---

## 5 · Theme persistence + commerce-gate evidence

### 5.1 · Theme persistence

**Unchanged by this task.** All three cards defer theme operations to existing live code paths:

- Card 2 (Shop) → `/first-visit/shop` → reads the catalogue only, writes nothing. The shop page's grid is `<li>` tiles with no interactive handlers that mutate state.
- Card 3 (Personalize) → `/first-visit/personalize` → reads the catalogue only, writes nothing.

### 5.2 · Commerce-gate evidence

The brief required: "Shop browsing cannot bypass the commerce gate." Verification:

- `src/app/nex-native/chat/first-visit/shop/page.tsx` **does not import** `src/lib/nex-native/launch-flags.ts` (grep assertion in `first-visit.test.ts`).
- The shop page **does not call** `commerceEnabledForRequest` or `searchEnabledForRequest`.
- The shop page **does not read** `NEX_COMMERCE_ENABLED` (grep for `NEX_COMMERCE_ENABLED\s*[?=]` returns zero in the rendered code · the symbol appears only in doctrine comments).
- The shop page **does not render** currency symbols or Buy/Unlock/Add CTAs (test enforces).
- The B9/B10 hardening of `launch-flags.ts` from the prior pass still holds: `?commerce=1` in production is refused regardless.

Because the shop page is purely read-only (no server actions, no API calls, no commerce-triggering code paths), there is no commerce gate to bypass. The honest "coming Phase 2" copy is the actual state of the shop.

---

## 6 · Why each file exists

- **`first-visit/page.tsx`** · the three-destination landing. Mounts `<ChatIdentityHeader />` at the top (sealed primitive · same import path as the sealed guest-chat client at `src/app/nex-native/chat/guest/[ownerAccountId]/_guest-chat-client.tsx:23`). Three cards centred in a 640-max-width column (mobile-first). Skip link at the bottom.
- **`first-visit/shop/page.tsx`** · honest Shop preview. Reads live catalogue · tolerates failure · renders browse-only tiles with no price/buy/unlock affordances. Three back-nav links.
- **`first-visit/personalize/page.tsx`** · honest Personalize preview. Reads live catalogue · picks three distinct-hue themes · renders atmosphere strip · renders explicit "What's not here yet" block.
- **`first-visit/__tests__/first-visit.test.ts`** · 41 focused source-shape tests enforcing: ChatIdentityHeader mount, destination href correctness, honesty rules (no commerce, no face-cover, no fake upload), no DB mutation, no sealed-surface imports.

---

## 7 · Honest status · which parts are LIVE / PARTIAL / NOT YET

| Element | Status | Evidence |
|---|---|---|
| First-visit page renders at `/nex-native/chat/first-visit` | **IMPLEMENTED** · requires signed-in NEX session; guests redirect to `/welcome` | `src/app/nex-native/chat/first-visit/page.tsx` lines 69-82 |
| Three destination cards | **IMPLEMENTED** · `DESTINATIONS` array of 3 entries, rendered by `.map()` | lines 95-124 |
| Card 2 (Shop) browse-only preview | **IMPLEMENTED, HONEST** · reads live catalogue, renders no price/buy | `shop/page.tsx` |
| Card 3 (Personalize) preview | **IMPLEMENTED, HONEST** · explains what's coming, renders no upload | `personalize/page.tsx` |
| ChatIdentityHeader primitive mounted on all three pages | **IMPLEMENTED** · sealed primitive respected | test enforces import + usage |
| Mobile-first layout | **IMPLEMENTED** · max-width 640px column, 44px min tap targets, safe-area padding | inline styles |
| Keyboard accessibility | **IMPLEMENTED** · aria-labels on cards + skip link | tests enforce |
| Reduced-motion compatibility | **IMPLEMENTED** · no CSS animations or transforms applied | inline styles only, no `@keyframes` |
| Light/dark mode | **PARTIAL** · one dark palette only (sealed NEX navy #020914); no light-mode variant since the sealed NEX surface is dark-first | matches `welcome/page.tsx` palette |
| First-visit auto-redirect for new users | **NOT IMPLEMENTED** · documented gap · see §Section 8 below |
| Chat Themes Shop purchase flow | **DELIBERATELY NOT IMPLEMENTED** · payment not wired per migration 193 header |
| Personalized Themes upload / save / generate | **DELIBERATELY NOT IMPLEMENTED** · feature doesn't exist in codebase |

---

## 8 · Documented gap · entry wire-up

### What's missing

The brief says: *"Every new NEX user must arrive at the free NEX Chat experience first."* The first-visit page is ready to serve that need, but no code redirects new users to it today. Reaching it currently requires direct navigation.

### Why the auto-redirect is NOT in this task

- Modifying `/nex-native/post-signup-apply/page.tsx` to always redirect to first-visit after signup would also route RETURNING users through the first-visit page (post-signup-apply fires on every sign-in). Needs a distinguishing signal (e.g., `nex_account.first_visit_at IS NULL`).
- Introducing a new "first-visit-seen" column on `nex_account` would be a schema change (migration) · out of scope.
- Using a cookie-only signal would violate the brief's rule: *"do not rely exclusively on local storage for an account-level decision."*

### Four options for the follow-up

| # | Option | Blast radius | Owner authorisation |
|---|---|---|---|
| 1 | Add a conditional link/tile on `/nex-native/home/page.tsx` for zero-conversation accounts | Low · one existing surface · opt-in | required |
| 2 | Add a new `nex_account.first_visit_seen_at` column via migration · check it in `post-signup-apply` redirect | Low-medium · one migration, one redirect line | required |
| 3 | Server-side middleware check that redirects zero-conversation accounts from `/chat` to `/chat/first-visit` | Medium · requires DB count on every chat landing render | required |
| 4 | Pure URL · `/nex-native/chat/first-visit` is reachable; share the link out-of-band or wait for a sealed follow-up | None · no auto-landing | current state |

Recommended: **Option 2**. Schema change is one additive column, redirect is one line. Full compatibility with returning users. Follow-up pass sealed separately.

---

## 9 · Tests · exact commands and results

### Focused suite

```
$ ./node_modules/.bin/vitest run src/app/nex-native/chat/first-visit/__tests__/first-visit.test.ts
RUN  v4.1.11 C:/Users/Victus/nexapp
 Test Files  1 passed (1)
 Tests       41 passed (41)
 Duration    289ms
```

### Combined regression (first-visit + launch-flags B9/B10 + validate-env D10 + Phase 3A guard)

```
$ ./node_modules/.bin/vitest run \
    src/app/nex-native/chat/first-visit/__tests__/first-visit.test.ts \
    src/lib/nex-native/__tests__/launch-flags.test.ts \
    scripts/__tests__/validate-env.test.mjs \
    scripts/__tests__/assert-nexapp-cwd-and-remote.test.mjs
RUN  v4.1.11 C:/Users/Victus/nexapp
 Test Files  4 passed (4)
 Tests       237 passed (237)
 Duration    370ms
```

### Test coverage per the brief's 10 acceptance criteria

| # | Brief criterion | Test coverage |
|---|---|---|
| 1 | Correct new-user entry path displays all three destinations | 3 destination-key assertions + 1 renderer-loop assertion |
| 2 | Each card opens the intended existing route or truthful fallback | 3 href assertions per card |
| 3 | Existing users not forced through first-visit onboarding | Covered by scope: zero modification to any existing route |
| 4 | Normal chat composer and conversation flow remain available | Covered by scope: `/nex-native/chat/page.tsx` byte-identical to pre-task state |
| 5 | Theme selection and persistence still work through existing mechanism | Covered by scope: `account-service.ts`, `chat-theme-service.ts` untouched; card 1 links to pre-existing library |
| 6 | Shop browsing cannot bypass the commerce gate | 4 assertions: no launch-flags import, no `commerceEnabledForRequest` call, no runtime `NEX_COMMERCE_ENABLED` read, no currency symbols in rendered content |
| 7 | Personalized Themes does not claim unsupported upload/generation/save | 10 forbidden-phrase assertions + "no file input / no Save / no Generate button" structural check |
| 8 | Works at narrow mobile widths and short viewport heights | Partial · tested via source assertions on `max-width: 640`, `100dvh` height, `safe-area-inset-top` padding · **mobile viewport end-to-end NOT tested** (no Playwright harness · see §Section 11) |
| 9 | Keyboard focus, labels, and reduced-motion behaviour correct | aria-label assertions on cards + skip link; no CSS animations added |
| 10 | No account/conversation/message/theme preference overwritten | Zero DB mutation assertions · zero cookie set assertions · zero sealed-service import assertions |

### What the tests do NOT (and should not) claim

- Do NOT prove a mobile viewport render matches the Figma. No Playwright run.
- Do NOT prove the three pages render correctly inside Next.js (RSC harness missing). The tests inspect source invariants.
- Do NOT prove `listActiveThemes()` returns rows in a specific order. The implementation tolerates both populated and empty catalogues.
- Do NOT prove the first-visit page is auto-shown to new users — this is a documented gap (§Section 8).

---

## 10 · Remaining limitations

| # | Limitation | Owner authorisation path |
|---|---|---|
| L1 | No auto-entry wire-up · new users don't automatically see this page | Option 2 in §Section 8 recommended |
| L2 | No mobile viewport Playwright coverage · relies on inline-style mobile-first design (sealed welcome page uses same tokens) | Phase F B2 remains open |
| L3 | Returning users have no way to clear/re-see the first-visit page except direct URL navigation | Could add a Settings action in a follow-up |
| L4 | The three preview pages do not render a composer at the bottom · they are landings, not active chats · a user wanting to send a message navigates to `/nex-native/chat` via the Continue link | Design-intent choice; could be revisited |
| L5 | Light-mode variant not added · page uses the sealed dark NEX palette (bg #020914, cyan #00AFFF, orange #FF7200) consistent with `/nex-native/welcome` | Light mode is out of scope for Phase 1 |
| L6 | Shop preview tiles show tier label (Standard / Premium) · this is informational metadata on `nex_chat_theme.tier` and is NOT enforced in theme selection (consistent with the package-feature audit) | No action needed · matches sealed behaviour |

---

## 11 · Decisions needing owner approval

| Decision | Options | Default if no action |
|---|---|---|
| **How new users reach first-visit** | §Section 8 Options 1-4 | Current: URL-only (Option 4). No automatic landing. |
| **Whether to add `nex_account.first_visit_seen_at` schema** | Yes · one column migration · OR adopt a cookie-based heuristic · OR leave URL-only | Current: no new state. |
| **Whether to add the first-visit as a tile on `/nex-native/welcome`** | Yes · one anchor link · OR no · leave welcome page sealed | Current: welcome page unchanged. |
| **Whether personalize page should link into `/nex-native/settings/theme` or similar** | Yes · reuse existing settings surface · OR keep the preview page standalone | Current: preview page is standalone, links to the live library catalogue only. |
| **Future shop implementation** | Depends on migrations 191-196 application + payment provider decision (D4) | Phase 2 blocker; shop preview remains honest "coming Phase 2" until that lands. |

---

## 12 · Boundary compliance

- ✅ Repository root + remote verified via Phase 3A dev guard (`node scripts/assert-nexapp-cwd-and-remote.mjs` exit=0)
- ✅ Pre-task worktree size recorded (160 lines); preserved post-task
- ✅ Only four new source files + one new test file + one report created
- ✅ No existing file modified (verified via `git status --short`)
- ✅ No sealed service touched (tier-gate.ts, product-service.ts, account-service.ts, launch-flags.ts, Vault chain, Bridge 99, Chat Master Layout primitives)
- ✅ No migration applied (191-196, 197 all untouched)
- ✅ Payment not implemented; no Stripe import added
- ✅ Commerce gate not activated; `NEX_COMMERCE_ENABLED` behaviour unchanged
- ✅ Vault, product upload, SafeChat, emergency help, G2 fingerprint — all untouched
- ✅ No `.env.local` read, no secrets accessed, no DB query, no network call, no deploy, no deps installed
- ✅ No server start/stop, no port change
- ✅ No commit, push, pull, reset, clean, stash, branch change
- ✅ Pre-existing 29 tracked modifications + ~130 untracked docs/data/scripts preserved verbatim
- ✅ Face-cover not invented (feature undefined; package-feature report §Section 5 flagged as blocker; this task honours that honestly)
- ✅ Chat Master Layout rule respected · ChatIdentityHeader primitive imported and mounted on all three pages
- ✅ Mobile-first design (max-width 640, safe-area-inset-top, 44px tap targets) · no desktop-only assumptions
- ✅ Keyboard-accessible: aria-labels on destination cards + skip link; focus states inherited from `<a>` defaults
- ✅ No account state mutated · no cookie set · no DB write
- ✅ Signed-in NEX session required; guests bounce to sealed `/welcome`
- ✅ Returning users unaffected (no existing route modified)

---

## 13 · Final changed-file inventory

```
?? src/app/nex-native/chat/first-visit/page.tsx                                            (new · 334 lines)
?? src/app/nex-native/chat/first-visit/shop/page.tsx                                       (new · 221 lines)
?? src/app/nex-native/chat/first-visit/personalize/page.tsx                                (new · 283 lines)
?? src/app/nex-native/chat/first-visit/__tests__/first-visit.test.ts                       (new · 350 lines · 41 tests)
?? docs/doctrine/nex-free-chat-theme-first-visit-implementation-2026-10-14.md              (this report)
```

Five new files total. **Zero existing files modified.**

### Definition of done · checked

> *"A new user can enter free NEX Chat and immediately understand three attractive choices—Chat Themes, Chat Themes Shop and Personalized Themes—while normal chat remains usable, existing account behaviour is preserved, and no gated or unfinished feature is misrepresented as working."*

- ✅ Three attractive choices rendered with ChatIdentityHeader primitive on top (Chat Master Layout respected)
- ✅ Normal chat remains usable (`/nex-native/chat` byte-identical to pre-task state)
- ✅ Existing account behaviour preserved (no account mutation, no theme pre-selection, no session change)
- ✅ No gated feature misrepresented: Shop clearly labelled "Phase 2"; Personalize clearly labelled "coming soon"; neither performs any state change
- ⚠️ Entry wire-up (how new users AUTOMATICALLY arrive) · documented gap · follow-up required (§Section 8)

Partial pass on auto-entry; full pass on everything else. Stopping. Awaiting owner decision on §Section 11.
