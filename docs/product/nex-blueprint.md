# NEX Blueprint

**⚠ MANDATORY FIRST READ.** Every session, every agent, every contributor
reads this file before any audit, inspection, or code change.

Rule: **Delta only.** If this blueprint says a journey is MAPPED or a
decision is SEALED, do not re-audit it. If a feature is NOT VERIFIED in
`feature-ledger.md`, that is the only work queue.

Session-start reading order (from `CLAUDE.md §9`):

1. **This file** (`docs/product/nex-blueprint.md`)
2. `docs/product/nav-journey-ledger.md` — permanent navigation + journey register (NAV-nnnn)
3. `docs/product/launch-evidence-ledger.md` — per-journey, per-branch evidence (JRN-*)
4. `docs/product/feature-ledger.md` — authoritative feature status
5. `docs/engineering/session-handoff.md` — where the last session ended
6. `docs/architecture/decisions/README.md` — sealed architecture decisions

If memory, chat recall, or a prior session summary disagrees with these
files, **these files win.**

---

## 1 · One-line summary

NEX is a single application (one codebase, one Supabase project, language
options not country apps) that combines private device-only E2E chat with
merchant-owned shops. A visitor can try chat free; a paid Shop subscription
unlocks selling.

**One Supabase project.** `ijvqdvsvwtwxzcqmoqit` is authoritative
(`CLAUDE.md §8`). Sandbox `kdstoyyeygcopkogqsyv` is for dev. No parallel DBs.

---

## 2 · The six user states

Every surface must handle these. The entry splash (`src/app/nex-native/page.tsx`)
routes based on state A vs {C,D,E,F}.

| State | Definition | Current entry resolution |
|---|---|---|
| **A** First-time visitor | No account, no session | Splash → `/nex-native/free-chat?show-themes=1` |
| **B** Mid-onboarding | Account created, flow incomplete | Not distinguished today — same as C (see Gap G-1) |
| **C** Signed-in returning | Valid session cookie | Splash → `/nex-native/contacts` |
| **D** Session expired | Cookie absent/expired, account exists | Same path as A today — redirects to theme picker (see Gap G-2) |
| **E** Signed-out returning | Explicitly signed out | Same as D |
| **F** New device | Account exists elsewhere, no local keys/session | Same as A today; device keys do not transfer (see Gap G-3) |

Server-side session is authoritative. **Never trust a client/localStorage
flag as proof of auth** (`CLAUDE.md §2` + Phase 1 doctrine).

---

## 3 · Target journey (owner-sealed, pending gap resolution)

### 3.1 First-time user (State A)

| Step | Current route | Status |
|---|---|---|
| Splash (5s branded) | `/nex-native` → `_splash-client.tsx` | MAPPED |
| Theme picker (pre-auth) | `/nex-native/free-chat?show-themes=1` | MAPPED — but see §4 theme-price rule |
| Preview + pick one free chat theme | Inside free-chat canvas | MAPPED |
| Create account | Likely `/nex-native/create` (NOT YET READ) | UNVERIFIED |
| Verification | Face/WebAuthn at `/sign-in` (Bridge 2b) | SEALED, not re-audited |
| Theme persists through signup | Must preserve across unauthenticated → authenticated transition | **UNVERIFIED — key risk** |
| Optional Shop offer | `/nex-native/welcome/shop-offer/` | EXISTS as a route folder, content UNVERIFIED |
| Skip → Contacts | `/nex-native/contacts` | MAPPED |

### 3.2 Returning PWA user (State C)

| Step | Current route | Status |
|---|---|---|
| Open from home screen | PWA icon → `/nex-native` | MAPPED |
| Server resolves session | `resolveSessionWithDevOverride` on page.tsx:52 | MAPPED |
| Splash (5s) → Contacts | `/nex-native/contacts` | MAPPED |
| **Must not** re-show welcome / theme picker | Verified by server-side branch on page.tsx:53 | MAPPED |

### 3.3 Signed-out returning (State D/E)

| Step | Current route | Status |
|---|---|---|
| Open app | `/nex-native` | MAPPED |
| Sign in / account recovery | `/nex-native/sign-in` | SEALED (Bridge 2b) |
| Restore | Supabase cookie refresh via middleware | MAPPED |
| Return to Contacts | `/nex-native/contacts` | MAPPED |

**Gap:** State D/E currently takes the SAME path as State A (both go to the
theme picker). A returning signed-out user should land on sign-in, not on
the theme picker, because they already have a theme. See Gap G-2.

---

## 4 · Theme pricing rule (owner-sealed 2026-11-23)

Two distinct products. Do not conflate.

### 4.1 Chat background themes

- **Pre-account view** (visitor browsing before signup): library shows
  **NO price**, badge="free" on every theme. First one is the signup gift.
- **Post-account view** (returning signed-in user): library shows
  **per-theme price**. Themes+ subscription unlocks all (€2.49/£1.99/$2.49/
  Rp 19,000/A$3.99 monthly per sealed 2026-11-13).
- **First-free rule**: the single theme chosen before signup becomes a
  permanent entitlement row (`nex_theme_ownership` with `source='first_free'`)
  on account creation. Never charge for it again.

### 4.2 Shop background themes

- **Always free** for any account with an active paid Shop subscription.
- **Freely swappable** — no cap, no cooldown.
- Unavailable to accounts without a paid Shop subscription.

### 4.3 Where this is implemented

- Library route: `/nex-native/chat-themes-library/` (37 files, well-developed)
- Pre-auth loader: `_load-library-data-guest.ts` (exists — guest path present)
- Post-auth loader: `_load-library-data.ts` (exists)
- Sealed free list: `_sealed-free-themes.ts`
- Entitlement row path: pending verification against `nex_theme_ownership`
  schema — see feature-ledger NEX-010

**Verification needed** before claiming this works: a Playwright test that
opens the library as guest (no prices, free badges) and then as signed-in
user (prices visible, owned theme marked owned).

---

## 5 · Shop subscription (owner-sealed)

- Price: **£4.99 / $4.99 / €4.99 / Rp 89,000 monthly** (NEX-015, from
  `_pricing-data.ts` + `price-registry.ts`)
- Trial: 7-day free with card on file, auto-charges day 8 unless cancelled
  (owner-sealed 2026-11-08). Four honesty guardrails mandatory: pre-trial
  disclosure before card entry, day-5 reminder email, 1-click in-app
  cancel, cancel-during-trial keeps access until day 7 end.
- **Checkout NEVER EXERCISED** per release-audit P1-B (NEX-015). Do NOT
  place the Shop offer in the first-time journey as a conversion step
  until the payment path is proven to work end-to-end in sandbox.

### 5.1 Create-a-Shop placement (owner directive 2026-11-23)

- Offered ONCE after account creation with a clear Skip option.
- Also permanently reachable from the side drawer — but drawer is sealed
  by test; see NEX-014.
- Skip must be fully functional — never required.

---

## 6 · Side drawer inventory (as-coded, 2026-11-23)

Sealed by `__tests__/control-drawer-client.test.tsx:278-298`. Any edit
requires an owner-dated directive AND the test must be updated to match.

### 6.1 `YOUR_NEX_ROWS` (control-drawer-client.tsx:282)

| Key | Label | Href | Status |
|---|---|---|---|
| `chats-contacts` | Chats and contacts | `/nex-native/contacts` | Top row (2026-11-12) |
| `profile` | My profile | `/nex-native/profile/me` | MAPPED |
| `edit-profile` | Edit Profile | `/nex-native/settings/profile/edit` | MAPPED |
| `manage-shop` | Shop Settings | `/nex-native/manage` | Gated server-side to shop owners |
| `shop-faq` | FAQ | `/nex-native/manage/shop/faq` | Gated server-side |
| `chat-settings` | Chat Settings | `/nex-native/settings/chat-settings` | Themes live inside here |
| `payment-providers` | Payment Providers | `/nex-native/settings/payments` | Stripe · PayPal · QR |
| `my-orders` | My Orders | `/nex-native/manage/orders` | Seller order dashboard |
| `wholesale` | Wholesale | `/nex-native/manage/wholesale` | Shop-sub gated |
| `nex-store` | 🛍 NEX Store | `/nex-native/store` | Owned extras |
| `discovery` | Discovery | `/nex-native/directory` | Business directory |

### 6.2 `PREFERENCES_ROWS` (control-drawer-client.tsx:450)

| Key | Label | Href | Status |
|---|---|---|---|
| `settings` | Settings | `/nex-native/settings` | 7-group hub |
| `buying-guides` | Buying Guides | `/nex-generated/buying-guides` | Independent product research |
| `nex-1` | NEX 1 | `/nex-native/nex-1` | Help + support chat |

### 6.3 Missing from drawer (owner-requested 2026-11-23)

- **Create a Shop** (new user who skipped the offer) — NEX-014 pattern,
  pick a/b/c/d. Not addable without owner directive.
- **Invite Friends** — where? `contacts/_invite-friends-card.tsx` exists,
  so this is a Contacts-page action, not a drawer row (matches owner's
  2026-11-23 preference). Verify the card is actually surfaced.
- **Share My NEX ID** — surface unclear. `/nex-native/share/page.tsx`
  exists. Verify it's reachable from `/nex-native/profile/me`.
- **Why NEX** — NEX-014 pending pick.

---

## 7 · Settings pages inventory (as-coded, 2026-11-23)

Settings hub: `/nex-native/settings/page.tsx` driven by `_sections.ts`.
Sub-pages present:

| Sub-route | Purpose |
|---|---|
| `blocked` | Blocked accounts |
| `chat-background-sync` | Cross-device theme sync |
| `chat-font` | Chat typography |
| `chat-protection` | Private-chat guardrails |
| `chat-settings` | Hub for chat prefs (themes live here) |
| `data-usage` | Data/storage prefs |
| `disappearing-messages` | TTL settings |
| `help` | Help routing |
| `language` | Language picker |
| `payments` | Payment provider connections |
| `privacy` | Privacy settings |
| `profile` | Profile viewer + `/edit` subroute |
| `security` | Face/WebAuthn, session |
| `see-my-theme` | Theme preview from other-user POV |
| `storage` | Storage prefs |
| `tier` | Subscription/tier status |

Every sub-route exists as a folder. Verification of each sub-page's
actual functionality is per-feature in the ledger — not re-audited here.

---

## 8 · Invite / NEX ID surfaces (as-coded, 2026-11-23)

Owner-requested two placements (2026-11-23):

| Placement | Current state | Notes |
|---|---|---|
| Contacts page Invite Friends action | `contacts/_invite-friends-card.tsx` EXISTS | Verify it renders and does something |
| Profile page Share My NEX ID | `/nex-native/share/page.tsx` + `_share-picker.tsx` EXIST | Verify it's linked from `/profile/me` |
| Add Contact / Enter NEX ID | `contacts/_create-group-*` + `_save-as-friend-action.ts` suggest contact-add exists | Unverified wiring |
| QR code | Unknown — glob needed if required |

---

## 9 · Sealed decisions (do not re-open)

Full detail in `~/.claude/projects/C--Users-Victus/memory/`. Summary:

| Decision | Date | Key constraint |
|---|---|---|
| Device-only E2E chat | 2026-11-09 | Server never has private plaintext. Ciphertext retained ≤7 days post-delivery, then purged. |
| Themes+ pricing | 2026-11-13 | €2.49/£1.99/$2.49/Rp 19,000/A$3.99 monthly. First paid theme free. No trial. |
| Shop trial | 2026-11-08 | 7-day free + card on file + auto-charge day 8. Four honesty guardrails. |
| Auth gate pattern | 2026-11-21 | `NexAuthGate` for page-level sign-in. Page-level, not click-time. |
| UI must be DB-wired | 2026-11-12 | No disconnected UI. Every save/toggle writes to Supabase. No TODO stubs. |
| Supabase project | 2026-11-09 | `ijvqdvsvwtwxzcqmoqit` is the only prod project. Never create a replacement. |
| Repo identity | 2026-11-19 | `C:/Users/Victus/nexapp` + `Philip2024394/nexapp.git`. Never `D:/trades`. |
| Cloudflare hosting | 2026-11-20 | Live site on Cloudflare Workers. `nexcorner.com`. |
| Push/deploy gating | 2026-11-12 | Every change commit+push; prod deploy needs separate word-trigger. |
| Merchant-owned payments | 2026-11-10 | Seller-direct Stripe. No destination charges. 0% app fee. |
| Chat/order separation (Path A) | 2026-11-09 | Six sealed decisions. Implementation needs five separate word-triggers. |
| Dev Pass `?next=` preservation | 2026-11-24 | `devPassAction` reads + `safeNext`-validates a hidden `next` input from the Dev Pass form. Production guard retained · redirect only follows a successful `supabase.auth.signInWithPassword`. Verified Cycle 8. |
| Buyer purchase-intent preservation (Dev Pass branch) | 2026-11-24 | A signed-out buyer hitting Add to Cart passes through `NexAuthGate` → sign-in?next=/product/<id> → the originating product. localStorage cart write survives refresh. Verified Cycle 8. **Ordinary password sign-in, full signup, Ask Seller conversation, and auto-resume are NOT part of this seal.** See `docs/product/launch-evidence-ledger.md` § 2.1. |

---

## 10 · Known gaps (prioritised for owner decision)

### G-1 · State B is not distinguished from State C

A user who created an account but hasn't completed onboarding
(e.g., no profile name) gets the same `/contacts` destination as a
fully-onboarded user. No resume-onboarding step.

**Impact:** medium — depends on how many onboarding fields are mandatory.

**Fix option:** server-side check in `page.tsx` for an `onboarding_complete`
boolean on `nex_account`. Needs owner approval before adding the column.

### G-2 · State D/E routed to theme picker instead of sign-in — ✅ FIXED 2026-11-23

**Was:** returning signed-out user pushed back through theme picker on
every PWA reopen.

**Fix:** three-way branch in `src/app/nex-native/page.tsx` driven by a
durable `nex_known_device=1` cookie (`src/lib/nex-native/app/known-device-cookie.ts`).
Middleware (`src/middleware.ts`) sets the cookie on every successful
`supabase.auth.getUser()` with 1-year TTL, HttpOnly, SameSite=Lax,
Secure in production. Cookie is **intentionally not cleared on sign-out**
so a signed-out returning user still lands on sign-in, not the theme
picker (owner's rule).

**Branches:**
- session → `/nex-native/contacts` (unchanged)
- no session + `nex_known_device=1` → `/nex-native/sign-in` (NEW · State D/E)
- no session + no cookie → `/nex-native/free-chat?show-themes=1` (State A)

**Tests:** 12/12 pass in `src/lib/nex-native/app/__tests__/known-device-cookie.test.ts`
(canonical value, TTL constant, rejection of all tampered inputs
including whitespace-padded values and SQL-injection-shaped strings).

**Status:** MAPPED. Playwright end-to-end (open PWA with no session +
cookie present → land on sign-in) still NOT RUN · add to the Owner Proof
#2 test in § 11.

### G-3 · State F (new device) key establishment

Existing user on a new device has no device private keys. Encrypted-chat
delivery to this device requires a key-wrapping/exchange protocol.
Pre-existing architecture exists in `src/lib/nex-native/crypto/` but not
re-verified this phase.

**Impact:** critical for PWA re-install / phone change scenarios.

**Fix option:** Phase 4 §3 encrypted-send verification covers this;
currently BLOCKED on the architectural fork for commerce migration.

### G-4 · Theme persistence across pre-auth → auth transition

Visitor picks theme → signs up → does the chosen theme attach to the
new account?

**Status (Cycle 13 · 2026-11-25):** **PARTIAL** — `pick-theme` handoff
branch VERIFIED with stale-replay and CSRF regressions closed. The route
is now `src/app/nex-native/post-signup-apply/route.ts` (Route Handler ·
supersedes Cycle 12 `page.tsx` which is deleted). The handler consumes
the one-shot HttpOnly `nex_pending_wall` cookie (set by the sealed
account-wall primitive immediately before signup completion), replays
`accountService.updateChatTheme` authoritatively against the authenticated
account, emits `Set-Cookie: nex_pending_wall=; Max-Age=0` on the SAME
response (making the one-shot a REAL one-shot · route handlers CAN emit
response cookies, unlike RSC render functions), and redirects via HTTP 303
to the theme viewer.

Evidence: `tests/e2e/journey-post-signup-apply-theme.spec.ts` · 5/5 green
on Pixel 7 sandbox at 2026-11-25 (auth-setup + 4 scenarios in 56.4 s):

1. Valid cookie → applied chip, action bar absent (decisive proof: owner
   directive 2026-10-28 · `_preview-action-bar.tsx:86-88` returns null
   when the server-side predicate `account.chat_theme === themeId` is
   true · the bar's absence proves the write landed on the authenticated
   viewer's own account · no second Activate press required).
2. No cookie → `/nex-native/contacts` fall-through.
3. REAL one-shot regression · after first consumption the pending cookie
   is cleared from the browser AND a user's intervening theme choice
   (simulated `writeAdminChatTheme('nex-flat')`) is NOT overwritten by a
   stale cookie on a later visit · closes BUG-C13-001.
4. CSRF regression · `Sec-Fetch-Site: cross-site` + cross-origin `Origin`
   are rejected with a 303 to `/contacts` WITHOUT consuming the cookie
   and WITHOUT mutating `chat_theme` · closes BUG-C13-002.

Nine Cycle 12 adversarial probes recorded under C12-SEC-1 all remain safe
(open-redirect rejected · premium-theme defence-in-depth rejects without
Themes Plus · SQL-injection payload cannot reach the DB · unauth caller
keeps the cookie for the legit post-sign-in handoff).

**Theme application vs ownership vs entitlement triad** (for the gratis
live-world theme `nex-bubbles` exercised here): **applied YES / owned N/A
/ entitled YES**. `nex-bubbles` is registered in code (live-world
register), not in DB, so the entitlement service's gratis fast-path
(`canAccessChatTheme` → `allow:true · reason:"free"`) returns before any
ownership check. No `nex_theme_ownership` row is required or written.
Migration 342 (`source='first_free'` write for PAID themes claimed via
Themes Plus first-free) remains explicit deferred scope.

**Out of scope for Cycle 12 (explicitly deferred):**
- The `SELECTED_THEME_COOKIE` splash path requires driving
  `createNexAccountAction` which is currently gated to founder emails
  by the prelaunch access guard.
- The `source='first_free'` write — migration 342 (adding `'first_free'`
  to the `acquired_via` CHECK list) is drafted but NOT applied to
  sandbox; forcing the insert would violate the check constraint.
- Signup-flow replay from the real account-wall "Create free account"
  button is blocked by the same prelaunch gate.

**Cycle 13 architectural correction:** The Cycle 12 "RSC cannot emit
Set-Cookie" limitation was NOT harmless · it was actively enabling
BUG-C13-001 (stale-cookie replay silently reverting the user's later
theme choice for the cookie's 20-minute TTL). The Cycle 13 fix converts
the endpoint from an RSC page to a Route Handler, which CAN emit
response cookies. The in-flight `cookies().set(...)` inside
`consumePendingAccountWall` remains best-effort (the try/catch at
`src/lib/nex-native/account-wall/pending-action.ts:147-160` documents
this); the real one-shot is now enforced by the handler's own
`Set-Cookie: nex_pending_wall=; Max-Age=0` on the redirect response.
Any future non-idempotent pending-wall action should follow the same
pattern.

**Impact:** critical — owner-flagged as one of four proof requirements.
Pick-theme sealed; three deferred branches remain gated on named
Founder authorisation (prelaunch access, migration 342 apply, Stripe
sandbox).

**Evidence:** `docs/product/launch-evidence-ledger.md` § 2.1e (Cycle 12 baseline) + § 2.1f (Cycle 13 bug closures).

### G-5 · Shop offer screen not proven to work

`/nex-native/welcome/shop-offer/` folder exists but content unverified.
Payment path (NEX-015) never exercised. Placing it in the first-time
journey today risks funneling users into a broken checkout.

**Impact:** high — would cause drop-off, opposite of owner intent.

**Fix option:** verify checkout in sandbox first (NEX-015 is gated on
owner authorisation for Stripe sandbox exercise). Until then, keep the
Skip button as the loud default.

### G-6 · Invite Friends / Share NEX ID discoverability

Components exist (`_invite-friends-card.tsx`, `/share/page.tsx`) but
whether they're actually mounted in the current Contacts/Profile pages
is unverified.

**Impact:** medium — owner-flagged as one of four proof requirements.

**Fix option:** targeted read of `contacts/page.tsx` and `profile/me/page.tsx`
to confirm mount + routing.

---

## 11 · The four owner proofs (2026-11-23)

For each proof: what we must show before claiming it works.

| Proof | How to prove it |
|---|---|
| **Theme persistence** | Playwright: guest picks theme → signs up → signed-in `/chat-themes-library` shows the picked theme as owned (`source='first_free'`) |
| **Correct landing page** | Playwright: returning signed-in PWA opens `/nex-native` → lands on `/contacts` without passing through welcome/theme-picker |
| **Shop conversion without pressure** | Playwright: new user reaches `/welcome/shop-offer/` → clicks Skip → arrives at `/contacts`; drawer has reachable Create-a-Shop entry |
| **Contact growth** | Playwright: new user on `/contacts` can tap Invite Friends; on `/profile/me` can tap Share NEX ID |

None of these are proven today. Each is a bounded, specific test.

---

## 11B · Permission timing & PWA install promotion (owner-sealed 2026-11-24 · Option A)

Owner approved **Option A** with timing rules following W3C/Chrome
guidance (ask on user action) + web.dev PWA install guidance (wait for
engagement). Full directive in sealed memory
`project_nexapp_pwa_install_and_location_timing_sealed_2026_11_24.md`;
feature-ledger NEX-022 (install promotion) + NEX-023 (location
permission timing) track delivery.

### 11B.1 Location permission — feature-gated

**Never request on:** first load · splash · theme selection ·
auto-after-registration · every return visit · passive page views.

**Always request via:**
1. User opens / activates a feature that genuinely needs location
2. NEX shows an explanation card tailored to that feature
3. User presses the explicit "Allow Location Access" (or feature-named)
   button → browser permission prompt fires
4. Denial: never block the surrounding setup · explain limitations ·
   never pretend location is working

**SOS-specific wording (suggested):** *"Allow NEX to access your
location so your designated emergency contacts can receive your last
known location if you activate SOS."* · Buttons: Allow Location
Access · Not Now.

**SOS activation handling:** obtain a fresh fix where possible; if
none, label as last-known-location, not current-location; never
invent coordinates. Keeps the 2026-11-09 Emergency Help seal
(personal-contacts-only, device-local only, no server coord storage).

### 11B.2 PWA install promotion — engagement-gated

**Never introduce on:** first load · during registration · during
theme selection · during Emergency Help setup · during first chat
composition · during an active SOS event · during payment / shop setup.

**Introduce after:** register → reach Contacts → one meaningful
interaction (add a contact OR send first message). If no meaningful
interaction during first visit, defer to a later visit.

**Format:** polished dismissible card or modal. Not a full-screen
unavoidable interrupt. Suggested wording: *"Get the full NEX
experience · Install NEX on your home screen for a cleaner, app-like
experience with quick access whenever you need it."* · Buttons:
Install NEX · Maybe Later.

**Side drawer:** permanent "Install NEX" row when install is
applicable (Android installable browser · iOS Safari · desktop with
install support). Hidden when already running standalone.

### 11B.3 Platform-specific install behaviour

| Platform | Mechanism |
|---|---|
| Android / Chromium | Capture `beforeinstallprompt`; **do NOT trigger native prompt until user press**; handle `userChoice`; listen for `appinstalled`; detect `display-mode: standalone` to hide offer after install |
| iOS / iPadOS Safari | No `beforeinstallprompt`; show instructional UI (Share → Add to Home Screen → Add); mention Open as Web App where supported; hide inside already-standalone |
| Desktop | Detect install capability; honest fallback where unavailable |
| Other browsers | Honest fallback · never show a button that can't perform its action |

### 11B.4 Frequency, cooldown, honesty

- No repeat within same session
- Remember dismissal across visits
- Reasonable cooldown before re-offering
- "Install NEX" always reachable from side drawer
- Never over another modal/workflow
- Never inside an already-installed standalone session

### 11B.5 Relationship to NEX-021 (full-viewport)

Install promotion is the mechanism that gives the user a true
zero-chrome experience on mobile — explain that benefit, do NOT claim
CSS can hide a browser tab's URL bar. Blueprint § 11A + hard-rule
#10 remain in force for the layout itself.

### 11B.6 Privacy & security guardrails

- Location permission is purpose-specific
- No background location collection
- No location history stored
- No persistent server-side coordinate storage (continues 2026-11-09
  Emergency Help seal)
- Location transmitted to contacts ONLY via approved Emergency Help flow
- Device-only chat encryption untouched (2026-11-09)
- Location permission ≠ notification permission (separate asks)
- Honour denial AND revocation

### 11B.7 Boundaries (sandbox-only until lifted)

- No production DB / migrations / location storage
- No live Emergency Help activation (`NEX_EMERGENCY_LIVE_MODE` OFF)
- No deployment / commit / push / merge
- Do not touch sealed Emergency Help decisions (2026-11-09)
- Inspect current implementation FIRST, then implement within approved scope

---

## 11A · Full-viewport rule (owner-sealed 2026-11-24)

Owner words, verbatim 2026-11-24: *"all pages on nexapp must open full
height of screen and width like splash screen does . we never want on
andriod or iphone header search bar showing"*.

**Scope:** every page under `src/app/nex-native/**`. The splash page
is the reference implementation (`src/app/nex-native/page.tsx` +
`_splash-decision-screen.tsx`).

**Required pattern** — top-most element on every route must occupy the
full viewport:

```tsx
<main style={{
  position: "fixed",   // or absolute inside a fixed parent
  inset: 0,
  margin: 0,
  padding: 0,
  overflow: "hidden",  // inner containers may scroll
}}>
```

**Height units:** use `100dvh` / `100svh` / `100lvh` or `position:fixed;
inset:0`. Never bare `100vh` — it strands content behind iOS browser
chrome.

**Root viewport meta already correct** (`src/app/nex-native/layout.tsx:104-110`):
`viewportFit: "cover"` and `themeColor: "#020914"`. **Do NOT remove either.**

**Zero-chrome steady state requires PWA standalone.** The URL/search
bar in a regular browser tab is OS-owned; no CSS can hide it. True
"no header bar on Android/iPhone" requires the app to be installed to
the home screen via the web manifest. Clarify with owner whether to
add an install prompt before relying on PWA-only behaviour.

**Verification (NOT YET WRITTEN):** `tests/e2e/full-viewport-chrome.spec.ts`
asserting, on Pixel 7 + iPhone 14 Pro viewports, that `<main>`
`boundingBox` matches the viewport exactly for every public route and
no bar appears after `scrollBy(0,1)` + `scrollTo(0,0)`. Ledger entry
**NEX-021** tracks this.

**Non-negotiables:**
- No new page may ship with a scrollable `<body>` sized to document height
- No new page may declare `position: static` on its outermost element
- Outer container is fixed/absolute at inset 0 OR uses `100dvh`+`100vw`
- Scroll lives in inner containers, not the document

---

## 12 · Before you edit — hard rules

1. **Read the three files at the top of this blueprint.** No exceptions.
2. **Check the ledger entry** for the feature you're touching. If VERIFIED,
   do not re-audit. If NOT VERIFIED and you're changing behavior, your
   change must come with a test that moves the state to VERIFIED.
3. **No new side drawer rows** without an owner-dated directive AND
   `control-drawer-client.test.tsx:278-298` update in the same commit.
4. **No new onboarding step** without an entry in this blueprint § 3.
5. **No change to a sealed decision** without a new ADR.
6. **No disconnected UI.** Every new save/toggle writes to Supabase
   (per 2026-11-12 seal).
7. **No plaintext path through private chat.** `PlaintextFrozenError`
   is fail-closed outside `NODE_ENV=test`.
8. **No commit, push, deploy, migration without named owner authorisation**
   (`CLAUDE.md §3-§5`).
9. **Sub-agents must be briefed with this file** — paste the relevant
   §s into the sub-agent prompt. Instruct: "delta only · do not
   re-inspect VERIFIED items."
10. **Full-viewport rule (2026-11-24).** Every new or edited
    `src/app/nex-native/**` page renders full-bleed (§ 11A). No bare
    `100vh`; no `position: static` outermost; no scrollable `<body>`.
    Reference impl: `page.tsx` + `_splash-decision-screen.tsx`.

---

## 13 · When to update this blueprint

- A journey step changes → update § 3.
- A side drawer row changes → update § 6 AND the regression test.
- A settings sub-page is added/removed → update § 7.
- A sealed decision is modified via ADR → update § 9.
- A gap in § 10 is closed → move it to § 3 or § 11 and mark MAPPED.
- A new owner proof is added to § 11 → list the exact test that proves it.

Keep this file under ~500 lines. Detail belongs in requirements docs
and ADRs. This blueprint is the index.
