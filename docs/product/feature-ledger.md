# NEX Feature Ledger

**Authoritative, evidence-based status of every NEX feature.**

Written to answer: *What does NEX do, where is it implemented, what was
actually tested, what is live in production, and what remains?* — without
relying on anyone's conversational memory.

> **Rules that bind this ledger:**
> - A commit proves a code change, not a deployment.
> - A deployment proves a release occurred, not that a feature works.
> - Unknown is **NOT VERIFIED**, not absent and not passed.
> - A memory entry is not proof of anything. The ledger entry below is.
> - If the evidence is "I read the file in this session," say so — do
>   not inflate to "VERIFIED".

**Last reconciled:** 2026-11-23 (session `a463e5fa`, branch
`release-audit-v1-2026-11-14`, HEAD `daf3068a`).

**How to read states:**

| State | Meaning |
|---|---|
| NOT STARTED | No code exists under the expected entry points. |
| IMPLEMENTING | Code exists, but required acceptance criteria not yet met. |
| CODE PRESENT (NOT VERIFIED) | Files exist, no test evidence recorded this cycle. |
| VERIFIED (sandbox) | Acceptance criteria passed on named commit in sandbox `kdstoyyeygcopkogqsyv`. Dated. |
| RELEASED | Verified AND deployed with authorised approval, and post-deploy health checked. |
| BLOCKED | Named blocker preventing progress — logged with ID. |

---

## Index

| ID | Feature | State | Spec | ADR | Next action |
|---|---|---|---|---|---|
| [NEX-001](#nex-001--merchant-data-export) | Merchant / account data export | BLOCKED (B1-B5 unresolved) | §19 Privacy Policy | [ADR-0001](#adr-index) | Owner picks path (a/b/c) |
| [NEX-002](#nex-002--product-import) | Product import flow (CSV/JSON) | NOT STARTED | TBD | — | Draft requirement NEX-002.md |
| [NEX-003](#nex-003--account-appeals) | Account appeals + reviewer workflow | **CONFIRMED NOT STARTED** (agent a28179d: no route, no table, no migration) | TBD | — | Owner supplies migration phrase |
| [NEX-004](#nex-004--device-local-outbox) | Device-local outgoing message queue | **IMPLEMENTED (code present, not verified this session)** · `src/lib/nex-native/location/outbox.ts` + welcome-outbox-worker + mig 103 | TBD | depends on ADR-0002 | Reconcile: is this doctrine-compliant? |
| [NEX-005](#nex-005--p2p-fallback) | P2P fallback (feasibility) | **PARTIAL — non-messaging only** · status-p2p + call layer use RTCDataChannel, NOT in peer-message paths | TBD | TBD | Feasibility report (reuse primitives) |
| [NEX-006](#nex-006--why-nex-page) | Why NEX page (public) | CODE PRESENT (NOT VERIFIED) | TBD | — | Playwright smoke in sandbox |
| [NEX-007](#nex-007--switch-savings-calculator) | Switch savings calculator (public) | CODE PRESENT (NOT VERIFIED) | TBD | — | Playwright smoke in sandbox |
| [NEX-008](#nex-008--product-sharing-to-checkout) | Product-sharing-to-checkout journey | **CODE PRESENT** · mig 077/078/354/365 · 3 test files · last mig 365 Nov 21 | release-audit-v1 §Flows verified | — | Resolve buyer-checkout scope (Nov-14 audit said OOS) |
| [NEX-009](#nex-009--chat-teams) | Chat Teams (staff-side shop inbox) | **PARTIAL** · inbox page exists at `src/app/nex-native/manage/shop/inbox/page.tsx` · multi-member response-on-behalf NOT built | TBD | — | Draft NEX-009 requirement |
| [NEX-010](#nex-010--shop-templates) | Shop templates + customisation | **CODE PRESENT** · 11 templates in `cover/layout-ids.ts` · 4-step wizard (collapsed from 8 per Nov-12) | TBD | — | Smoke test template render |
| [NEX-011](#nex-011--flippable-chat-cards) | Flippable chat cards | **PARTIAL** · one instance only (`_report-flip-card.tsx` in profile Safe Trade sheet) · no generic flippable product cards in chat | TBD | — | Clarify scope: generic chat cards or Safe Trade only? |
| [NEX-012](#nex-012--chat-translation) | Automatic translation (chat) | **FOUNDER-ONLY PILOT (sealed 2026-11-17)** · `_translation-layer.tsx` + bubble control + 1 test file | TBD | — | Do NOT publicise as live |
| [NEX-013](#nex-013--vault-preservation) | Vault preservation | **IMPLEMENTED (code present)** · 20+ test files · release-audit-v1 §Flows notes unlock UNVERIFIED on 2026-11-14 | TBD | — | Rerun vault unlock smoke |
| [NEX-014](#nex-014--side-drawer-why-nex-link) | Side-drawer Why NEX link | NOT STARTED | — | — | Add link near YOUR NEX section |
| [NEX-015](#nex-015--monthly-shop-billing) | Monthly shop billing (Stripe) | **CODE PRESENT** · price-registry + checkout + webhook · release-audit P1-B still says payment path NEVER EXERCISED in audit | release-audit-v1 §P1-B | — | Owner authorises Stripe sandbox exercise |
| [NEX-016](#nex-016--merchant-direct-payments) | Merchant-direct payments (seller-owned Stripe) | **CODE PRESENT** · mig 311 `stripe_connect_account_id` · stripe-connect-service · connect/create/status/disconnect routes · 0% app fee | sealed 2026-11-10 memory | — | Confirm mig 311 applied state in sandbox |
| [NEX-017](#nex-017--device-only-e2e-chat) | Device-only E2E chat | **CODE PRESENT · SCHEMA-CORRECTION DEBT** · `nex_peer_message.body` column STILL EXISTS with sentinel check constraint (doctrine said "strip plaintext mode"). Purge job mig 097 present. | sealed 2026-11-09 doctrine | depends on doctrine | File ADR-0002 schema reconciliation |
| [NEX-018](#nex-018--hq-incidentalerts-system) | HQ incident/alerts system | **CODE PRESENT · MIGRATIONS NOT APPLIED TO PROD** · mig 300 "AUTHORED NOT APPLIED to production" · mig 304 "APPLIED TO SANDBOX ONLY" | TBD | — | Verify sandbox DB state |
| [NEX-019](#nex-019--support-tickets) | Support tickets | **CONFIRMED NOT APPLIED** · mig 315/316/317 all say "AUTHORED FOR REVIEW ONLY · NOT APPLIED". Code exists under `/nex-native/support/` + `/hq/support-tickets/` | TBD | — | Verify sandbox DB state |
| [NEX-020](#nex-020--emergency-help) | Emergency help | **CODE PRESENT · MIGRATIONS NOT APPLIED** · mig 224/225 "AUTHORED FOR REVIEW ONLY · NOT YET APPLIED" · code at `/nex-native/emergency-help/` + contacts + incident-service | sealed 2026-11-09 memory | — | Verify sandbox DB state |
| [NEX-021](#nex-021--full-viewport-rule-no-mobile-browser-chrome) | Full-viewport rule / no mobile browser chrome | **RULE SEALED · NOT VERIFIED** · splash is reference impl; other pages unaudited; no Playwright test yet | Blueprint § 11A (2026-11-24) | — | Write `full-viewport-chrome.spec.ts`; audit every nex-native route |
| [NEX-022](#nex-022--pwa-install-promotion-engagement-gated) | PWA install promotion (engagement-gated, Option A) | **RULE SEALED · NOT STARTED** · no card/modal, no beforeinstallprompt capture, no side-drawer row, manifest state unaudited | Blueprint § 11B (2026-11-24) | — | Audit manifest + existing install code; design card; wire platform-aware behaviour |
| [NEX-023](#nex-023--location-permission-timing-feature-gated) | Location permission timing (feature-gated) | **RULE SEALED · NOT VERIFIED** · no explanation card, no SOS-time explicit gate audited, no retry/settings UI | Blueprint § 11B (2026-11-24) | — | Audit current geolocation call-sites in SOS and elsewhere; add explanation card before browser prompt |

---

## Feature detail

### NEX-001 · Merchant data export

**User problem**: Sellers must be able to export their shop products, account
data, and reachable contacts to move elsewhere. Required by Privacy Policy §19.

**Scope (owner-approved per ADR-0001):**
- Include: NEX account row + conversation metadata + Vault file LIST (metadata only).
- Exclude: Vault message bodies, Vault file contents, encrypted peer-message
  ciphertext bodies, any other user's data.
- 30-day cooldown per account, 7-day signed-URL expiry.

**Spec**: Privacy Policy §19, `src/app/nex-native/about/privacy/page.tsx:626-649`.

**ADR**: [ADR-0001](../architecture/data-export-phase-2.md) — DECISION-READY,
implementation NOT YET AUTHORISED.

**Code entry points**: none yet. Expected:
- `src/app/api/nex-native/account/export/request/route.ts` (NOT PRESENT)
- `src/app/api/nex-native/account/export/status/route.ts` (NOT PRESENT)
- `nex-supabase/migrations/202_nex_data_export_request.sql` (NOT DRAFTED)

**State**: BLOCKED.

**Unresolved blockers (from ADR-0001):**
- B1: Delivery mechanism (in-app push vs Resend vs new provider) — owner call.
- B2: Background-job model (pg_cron vs Vercel Cron vs new worker) — owner call.
- B3: Vault bodies inclusion default (never vs opt-in step-up PIN).
- B4: Export retention cap / max file size.
- B5: Legal review of Privacy Policy §19 phrasing.

**Next action**: Owner picks path (a) [recommended, zero new infra], (b)
alternative infra, or (c) defer with NEX1 support fallback.

**Related memory**: `project_nex_competitive_wedges_2026_11_23.md` cites this
as unshipped competitive wedge P2. Memory ≠ evidence.

---

### NEX-002 · Product import

**User problem**: Sellers migrating from Shopee/Lazada/WooCommerce want to
bring their products across. CSV or JSON upload with preview, mapping, dedup.

**Scope**: sandbox-only draft. Public claim is "Realistic migration from
Shopee/Lazada" — honest about what carries vs what doesn't (per
docs/doctrine/competitor-portability-map-2026-11-23.md).

**Spec**: not yet drafted → `docs/product/requirements/NEX-002-product-import.md`.

**Code entry points**: none yet.

**State**: NOT STARTED.

**Next action**: draft requirement; honor the portability map's honest
constraints (followers/chats don't carry — only products + metadata).

---

### NEX-003 · Account appeals

**User problem**: User gets suspended or a product gets taken down. They need
a submit-appeal form with a reviewer queue on the admin side.

**Spec**: not yet drafted → `docs/product/requirements/NEX-003-appeals.md`.

**Code entry points**:
- `src/app/nex-native/account/appeal/` (NOT PRESENT — glob confirmed empty 2026-11-23)
- Reviewer queue surface under `/nex-native/hq/` (NOT PRESENT)
- `nex-supabase/migrations/*account_appeal*` (NOT PRESENT)

**State**: NOT STARTED. BLOCKED on **authorisation phrase**.

**Hard rule**: per `project_nex_remediation_phase_1_2026_11_08.md` migrations
need named approval. Do not guess phrase. Owner must supply exact wording
before any migration file is authored.

**Honesty gate**: do NOT publish a human-response SLA until reviewer staffing
is confirmed (directive §9).

**Next action**: owner supplies exact migration-authorisation phrase OR
authorises code-only skeleton that queues appeals but has no reviewer surface.

---

### NEX-004 · Device-local outbox

**User problem**: User types a message offline; it should queue on device
and send when connectivity returns — without the server ever holding plaintext
or being able to read the queued message.

**Spec**: not yet drafted. Must respect doctrine
`project_nex_chat_device_only_e2e_sealed_2026_11_09.md` and the ciphertext-at-
rest nuance (server stores opaque ciphertext for ≤7 days post-delivery).

**State**: NOT VERIFIED (inventory agent a2aad0a running).

**Next action**: wait for agent evidence; update this entry with file:line
findings.

---

### NEX-005 · P2P fallback

**User problem**: If the NEX server is down, can two online users still reach
each other peer-to-peer? Owner wants a **feasibility report**, not an
implementation.

**Spec**: TBD. Should produce `docs/architecture/decisions/0002-p2p-fallback-feasibility.md`.

**Scope limit**: feasibility only. Do NOT silently build P2P messaging.

**State**: NOT STARTED.

**Next action**: feasibility report after NEX-004 inventory lands (reuse call
layer's WebRTC primitives where sensible).

---

### NEX-006 · Why NEX page

**User problem**: Public visitors need a single page that honestly compares
NEX's four ownership claims (money, audience, messages, right-to-leave) to
competitor baggage.

**Spec**: TBD.

**Code entry points**:
- `src/app/nex-native/why-nex/page.tsx` — **present (new 2026-11-23, this session)**
- Uses LIVE / BETA / PLANNED status labels for 7 claims.

**State**: CODE PRESENT (NOT VERIFIED).

**Evidence this cycle**:
- Typecheck: ZERO errors from this file (`npx tsc --noEmit` filtered).
- Browser smoke: NOT RUN.
- Playwright: NOT RUN.

**Next action**: Playwright smoke test in sandbox before claiming VERIFIED.

**Honesty check**: labels LIVE/BETA/PLANNED per directive §9 — do not
advertise "universal migration, universal delivery, outage immunity".

---

### NEX-007 · Switch savings calculator

**User problem**: Prospective seller wants to compare their actual Shopee/
Lazada/TikTok Shop take-rate against the flat NEX monthly subscription.

**Spec**: TBD.

**Code entry points**:
- `src/app/nex-native/switch/page.tsx` — server shell, **present (new 2026-11-23)**
- `src/app/nex-native/switch/_switch-calculator-client.tsx` — **present (new 2026-11-23)**

**State**: CODE PRESENT (NOT VERIFIED).

**Acceptance criteria met this session**:
- Manual input accepted for commission %, fixed per-order fee, GMV, orders, NEX monthly.
- Presets are user-selectable with dated citations; "22.5% / 17.4%" explicitly
  labelled dated examples not universal truth.
- Zero-sales input: shows "No sales entered yet — nothing to compare."
- Negative savings: shows "NEX costs more at this volume" with explanation.
- Monthly × 12 labelled "Projected annual savings" with disclaimer.
- Platform-only caveat footer (processor fees / promotion / logistics not auto-replaced).
- `data-nex-switch-page` + `data-nex-switch-detected-country` attrs present.

**Evidence this cycle**:
- Typecheck: ZERO errors from these two files.
- Browser smoke: NOT RUN.

**Next action**: Playwright smoke + currency-isolation unit test.

---

### NEX-008 · Product-sharing to checkout

**State**: NOT VERIFIED. Inventory agent a46f3d7 running.

Partial existing evidence per `docs/release-audit-v1-2026-11-14.md` §Flows verified:
Product detail sheet, More Details → Shop Chat with product chip, encrypted
product-card send, cross-shop product isolation — all VERIFIED (sandbox) on
commit `b382dd43` (2026-11-14). Buyer-side checkout: OUT OF SCOPE on that audit.

**Next action**: await inventory, then reconcile buyer-side checkout vs the
Nov-14 "deliberately not implemented · OUT OF SCOPE" line.

---

### NEX-009 · Chat Teams

**State**: NOT VERIFIED. Inventory agent a46f3d7 running.

---

### NEX-010 · Shop templates

**State**: NOT VERIFIED. Inventory agent a46f3d7 running.
SHOP_FEATURES in `src/app/nex-native/pricing/_pricing-data.ts` advertises
"11 shop templates" — must verify in `src/app/nex-native/manage/shop/themes/`
before publishing.

---

### NEX-011 · Flippable chat cards

**State**: NOT VERIFIED. Inventory agent a46f3d7 running.

---

### NEX-012 · Chat translation

**State**: NOT VERIFIED. Inventory agent a46f3d7 running.

Partial evidence: `src/app/nex-native/chat/peer/[accountId]/__tests__/translation-layer.test.tsx`
exists per earlier typecheck output (1 pre-existing error), suggesting some
implementation present. Verify before publishing any translation claim.

---

### NEX-013 · Vault preservation

**State**: NOT VERIFIED. Inventory agent a2aad0a running.

Partial evidence from release-audit-v1: Vault unlock flow UNVERIFIED this cycle.

---

### NEX-014 · Side-drawer Why NEX link

**User problem**: Why NEX page is unreachable from the main side drawer.

**Code entry points**:
- `src/components/nex-native/control-drawer/control-drawer-client.tsx:282` (`YOUR_NEX_ROWS`)
- `src/components/nex-native/control-drawer/control-drawer-client.tsx:450` (`PREFERENCES_ROWS`)
- Regression test: `__tests__/control-drawer-client.test.tsx:278-298`

**State**: **BLOCKED**.

**Why blocked**: Both row arrays are sealed by regression test. Test
comments cite explicit owner-dated directives (2026-11-04 trim · 2026-11-11
Cycle 36 · 2026-11-13 chat-appearance fold · 2026-11-18 buying-guides
insert). A new row cannot be added without breaking the test, and the
test comment says only "a new directive" permits a change.

**Owner decision needed (pick one)**:
- **(a)** Append `{ key: "why-nex", href: "/nex-native/why-nex" }` to
  `PREFERENCES_ROWS` after `nex-1`. Updates the sealed test with a new
  dated directive comment.
- **(b)** Append it to `YOUR_NEX_ROWS` after `discovery`. Same test update.
- **(c)** Add a new drawer section titled `ABOUT NEX` above `NEX SUPPORT`
  with `why-nex` as its only row. Minimises churn to existing sealed lists.
- **(d)** Don't add it to the drawer at all. The Why NEX page is linked
  from `/nex-native/switch` via the "← Why NEX?" back-chip. Leave as-is.

**Next action**: owner picks a/b/c/d. Until then: do not edit drawer rows.

---

### NEX-015 · Monthly shop billing (Stripe)

**User problem**: £4.99 / $4.99 / €4.99 / Rp 89,000 monthly subscription via Stripe.

**Spec**: `src/app/nex-native/pricing/_pricing-data.ts` is authoritative for
display. `src/lib/nex-native/billing/price-registry.ts` holds env-var mapping.

**Code entry points**:
- Pricing display: `src/app/nex-native/pricing/`
- Stripe checkout session: `src/app/api/nex-native/stripe/` (NOT READ this session)
- Stripe webhook: `src/app/api/stripe/webhook` (per release-audit)

**State**: NOT VERIFIED. Per release-audit P1-B: "payment sandbox paths never
exercised" as of 2026-11-14. Status unchanged this session.

**Next action**: exercise Stripe sandbox (owner-authorisation gate). Record
evidence at `docs/releases/stripe-sandbox-<date>.md`.

---

### NEX-016 · Merchant-direct payments

**Scope**: seller receives payment on their own Stripe account (not NEX
escrow). Sealed 2026-11-10 (memory).

**State**: NOT VERIFIED. Inventory agent a2aad0a running.

---

### NEX-017 · Device-only E2E chat

**Scope**: sealed 2026-11-09 doctrine; nuanced 2026-11-23. Server stores
opaque ciphertext for ≤7 days after `delivered_at`; Bridge 78 purge job drops
it. Server never has plaintext.

**Public copy**: must use **"NEX never stores plaintext of your private
chats. Encrypted ciphertext is briefly retained for sync, then purged within
a week of delivery."** The stronger "no server copy ever" claim is FALSE.

**State**: NOT VERIFIED. Inventory agent a2aad0a running (confirming write
path + purge job presence in sandbox migration state).

---

### NEX-018 · HQ incident/alerts system

**State**: NOT VERIFIED. Inventory agent a28179d running.

---

### NEX-019 · Support tickets

**Scope**: sandbox-only per sealed 2026-11-10 (owner refused prod apply).

**State**: NOT VERIFIED (correction 2026-11-23: migration 315 header says
"AUTHORED FOR REVIEW ONLY · NOT APPLIED TO ANY DATABASE"). The prior claim
that 315/316/317 were sandbox-applied is NOT supported by evidence; verify
`select to_regclass('nex.support_ticket')` on `kdstoyyeygcopkogqsyv` before
assuming tables exist.

**Prod seal**: owner-sealed refusal 2026-11-10. Do NOT apply to prod
`ijvqdvsvwtwxzcqmoqit` without a fresh word-trigger naming the prod ref.

---

### NEX-020 · Emergency help

**State**: NOT VERIFIED. Inventory agent a28179d running.

Memory notes personal-contacts-only + pure device-local location sealed
2026-11-09; no group fan-out; no server-side coordinates.

---

### NEX-021 · Full-viewport rule / no mobile browser chrome

**User problem**: nexapp must feel like the splash screen — one undivided,
full-bleed canvas. The Android/iPhone browser URL/search bar must not
steal vertical pixels or break the branded first impression.

**Owner words (2026-11-24, verbatim)**: *"all pages on nexapp must open
full height of screen and width like splash screen does . we never want
on andriod or iphone header search bar showing"*.

**Spec**: Blueprint § 11A (full-viewport rule, sealed 2026-11-24).

**Reference implementation**:
- `src/app/nex-native/page.tsx` (splash branch, auto-divert and SOS decision)
- `src/app/nex-native/_splash-decision-screen.tsx` (SOS decision)

Both use `<main style={{position:"fixed", inset:0, margin:0, padding:0,
overflow:"hidden"}}>` and sit under the root viewport meta
(`src/app/nex-native/layout.tsx:104-110`: `viewportFit:"cover"` +
`themeColor:"#020914"`).

**Required pattern on every nexapp page**: outermost element fixed/absolute
at inset 0, or sized with `100dvh`/`100svh`. Never bare `100vh`. Scroll
lives in inner containers, never on `<body>`.

**Zero-chrome caveat**: in a regular Safari/Chrome tab the URL bar is
OS-owned; no CSS removes it. True zero-chrome steady state needs PWA
standalone (home-screen install). Awaiting owner clarification on
whether to force an install prompt before relying on PWA-only behaviour.

**State**: **RULE SEALED · NOT VERIFIED**. The rule is captured in the
blueprint and here. No automated test exists yet. No comprehensive audit
of existing `src/app/nex-native/**` pages has been run.

**Required tests (NOT YET WRITTEN)**:
- `tests/e2e/full-viewport-chrome.spec.ts` · Pixel 7 + iPhone 14 Pro
  viewports · for every public nexapp route: `<main>` `boundingBox`
  matches viewport exactly · no bar appears after `scrollBy(0,1)` +
  `scrollTo(0,0)` · opt-in standalone-mode variant via Chromium `--app=`

**Next action**: audit existing pages for compliance (list which pages
pass the pattern today, which don't); write the Playwright spec;
decide PWA-standalone question with owner.

**Non-negotiables** (from blueprint § 11A):
- No scrollable `<body>` sized to document height
- No `position: static` outermost element
- No bare `100vh`
- Do not remove `viewportFit:"cover"` or `themeColor` from
  `src/app/nex-native/layout.tsx`

---

### NEX-022 · PWA install promotion (engagement-gated)

**User problem**: NEX must feel like an installable mobile app — the
installed PWA is the only way to get a true zero-chrome experience
on iOS/Android. But forcing install on first visit annoys users and
risks drop-off before they understand the benefit.

**Owner decision (2026-11-24)**: **Option A** — polished install
promotion, introduced ONLY after the user has reached Contacts and
completed one meaningful interaction (add contact OR send first
message). Never force; always dismissible; permanent side-drawer row
for later install.

**Spec**: Blueprint § 11B (sealed 2026-11-24). Full directive in
sealed memory `project_nexapp_pwa_install_and_location_timing_sealed_2026_11_24.md`.

**Required behaviour**:
- Register → reach Contacts → first meaningful interaction →
  show card
- Dismiss → remember + cooldown before next offer
- Android: capture `beforeinstallprompt`, trigger native prompt only
  on user press, handle `userChoice`, listen for `appinstalled`
- iOS Safari: instructional UI (Share → Add to Home Screen → Add)
- Desktop: platform-appropriate install action
- Already-installed detection: `window.matchMedia('(display-mode:
  standalone)')` + `navigator.standalone` (iOS) — hide offer

**State**: **RULE SEALED · NOT STARTED**.
- No manifest state verified this cycle
- No `beforeinstallprompt` capture code audited
- No install-promotion card component exists (unverified)
- No side-drawer "Install NEX" row (see § 6.3 blueprint — currently
  missing)

**Required tests** (NOT YET WRITTEN, per directive § 9):
- H · Android installable browser · offer at approved engagement
  point, native prompt follows user press
- I · iPhone Safari · correct instructions
- J · Already-installed PWA · no promotion
- K · Dismissed · cooldown respected
- L · Side drawer "Install NEX" reachable where applicable

**Boundaries**: sandbox-only · no commit/push/merge/deploy ·
inspect first.

**Next action**: audit current manifest + install code + drawer; then
design the card component and the engagement-detection hook.

---

### NEX-023 · Location permission timing (feature-gated)

**User problem**: W3C and Chrome both guide against requesting
location on page load. Prompting on first visit scares users and
burns the trust budget. NEX must only ask when a feature genuinely
needs location, after a clear explanation.

**Owner decision (2026-11-24)**: Location permission is ALWAYS
feature-gated. Never on first load / splash / theme / post-register /
every open. Always via explanation card → user action → browser
prompt.

**Spec**: Blueprint § 11B.1 (sealed 2026-11-24). Full directive in
sealed memory `project_nexapp_pwa_install_and_location_timing_sealed_2026_11_24.md`.

**Required behaviour (SOS path)**:
- During SOS setup, show explanation card BEFORE browser prompt
  (suggested wording in blueprint)
- Buttons: Allow Location Access · Not Now
- Browser prompt only after user presses Allow
- Denial: continue with rest of SOS setup, explain limitation,
  provide retry/settings instructions, never pretend location works
- Activation: obtain fresh fix where possible; if none, distinguish
  last-known from current; never invent coordinates

**Related sealed decisions**: 2026-11-09 Emergency Help
(personal-contacts-only, pure device-local location, no server-side
coordinate persistence) — **UNCHANGED**.

**State**: **RULE SEALED · NOT VERIFIED**.
- Existing geolocation call-sites not audited this cycle
- No explanation-card component exists (unverified)
- No retry/settings UI for denied permission (unverified)

**Required tests** (per directive § 9):
- A · First-time visitor · no unexpected location prompt
- B · New account · no auto-request after registration
- C · SOS setup · explanation appears BEFORE browser prompt
- D · Allowed · correct flow
- E · Denied · safe fallback + retry
- F · Activated · approved emergency flow
- G · Returning user · no repeated prompt without feature-specific
  reason

**Boundaries**: sandbox-only · no persistent server-side location ·
no live Emergency Help activation · no commit/push.

**Next action**: audit every `navigator.geolocation.*` call-site and
every reference to lat/lng columns; design the explanation card;
integrate at SOS setup entry.

---

## ADR index

| ID | Title | Status | File |
|---|---|---|---|
| ADR-0001 | Data export architecture | DECISION-READY, implementation NOT AUTHORISED | [data-export-phase-2.md](../architecture/data-export-phase-2.md) |
| ADR-0002 | (reserved) Device-local outbox + ciphertext-at-rest reconciliation | TBD | pending |
| ADR-0003 | (reserved) P2P fallback feasibility | TBD | pending |

---

## Reconciliation log

- **2026-11-23 (this cycle)**: Created the ledger; populated with the 20
  scoped features from the owner's 2026-11-23 "NEX engineering master prompt"
  directive. Honest NOT VERIFIED for everything not personally proved this
  session. Three inventory agents dispatched to establish per-feature evidence
  on code existence; results update feature entries NEX-004 through NEX-020.
- **2026-11-24**: Added **NEX-021 · Full-viewport rule / no mobile browser
  chrome** per owner directive 2026-11-24 (*"all pages on nexapp must open
  full height of screen and width like splash screen does"*). Rule captured
  in Blueprint § 11A. Splash is the reference implementation; no automated
  verification exists yet. No existing-page audit performed in this cycle —
  only the splash is proven to follow the pattern.
- **2026-11-24**: Added **NEX-022 · PWA install promotion
  (engagement-gated)** + **NEX-023 · Location permission timing
  (feature-gated)** per owner Option A directive 2026-11-24. Rules
  captured in Blueprint § 11B. Install promotion introduced only after
  register → Contacts → first meaningful interaction; platform-aware
  (Android `beforeinstallprompt`, iOS Safari instructions, desktop).
  Location permission always feature-gated via explanation card →
  user action → browser prompt; never on first load. Preserves
  2026-11-09 Emergency Help seal (personal-contacts-only, device-local,
  no server coords). Sandbox-only. Inspect first; implementation NOT
  yet started this cycle.

---

## How to add an entry

1. Author `docs/product/requirements/NEX-NNN-feature-name.md` (user problem,
   scope, acceptance criteria, exclusions).
2. Add an index row above and a detail section here.
3. If the feature involves a consequential architectural choice, add
   `docs/architecture/decisions/NNNN-topic.md`.
4. Update `docs/engineering/session-handoff.md` so the next session sees the
   new work.
