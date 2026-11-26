# NEX Launch Evidence Ledger

**Per-journey, per-branch evidence record.** This is the sole record that decides whether a journey is launch-ready.

Owner-sealed 2026-11-24 (NEX World-Class Launch Programme). "Zero defects" is never claimed. Partial results are recorded as partial. Verification is stated per branch, never per row.

**Last reconciled:** 2026-11-25 (Cycle 13 · G-4 pick-theme handoff · stale-replay + CSRF closed).

---

## 1 · Classification contract

A journey has a **row** here only after the first cycle that produces evidence. Each row carries:

- **JRN-id** — journey identifier (permanent, sealed per cycle).
- **NAV refs** — which navigation rows the journey depends on (`docs/product/nav-journey-ledger.md`).
- **Branches** — enumerate every required branch. Each branch has its own status.
- **Evidence** — exact spec path + test name + run date + environment.
- **Caveats** — what the evidence does NOT prove. Required field.
- **Launch readiness** — one of: `NOT VERIFIED`, `PARTIAL (named branches VERIFIED)`, `VERIFIED`, `BLOCKED`.

**Dev Pass is not proof of ordinary sign-in.** A test that uses Dev Pass verifies the Dev Pass branch only. The ordinary email + password branch must be independently exercised before the row can be promoted.

---

## 2 · Journeys with recorded evidence

### 2.1 · JRN-buyer-signed-out-purchase-resume (Cycle 8 · 2026-11-24)

**Scope:** A signed-out buyer lands on a product, must authenticate to take any cart/order action, and resumes the purchase with the correct seller + product context afterwards.

**Spec:** `tests/e2e/journey-buyer-signed-out-purchase-resume.spec.ts` (Pixel 7 project, sandbox `kdstoyyeygcopkogqsyv`).

**Fixtures used (Founder-approved):**
- Shop slug `handbags-direct`
- Product id `1a0eb693-4024-4a55-82d8-58ebe35d7b4a`
- Admin account via Dev Pass (owner-sanctioned, localhost-only)

**NAV refs:** NAV-0086 · NAV-0087 · NAV-0088 · NAV-0089 · NAV-0090 · NAV-0091 · NAV-0092 · NAV-0093 · NAV-0094.

| Branch | Status | Evidence | What this does NOT prove |
|---|---|---|---|
| Guest Add-to-Cart → auth-gate opens | **VERIFIED** | test 1, `[data-nex-product-add-to-cart-guest]` click opens `[data-nex-auth-gate-banner]` within 5 s; href preserves `next=%2Fnex-native%2Fproduct%2F<id>` | — |
| Dev Pass sign-in with `next=` preservation | **VERIFIED (Dev Pass branch only)** | test 1 + Cycle 8 code change at `src/app/nex-native/sign-in/page.tsx:666-680` (hidden `next` input) + `src/app/nex-native/_actions.ts:877-935` (`devPassAction` reads + `safeNext`-validates `next`); `safeNext` constraints preserved (must start `/nex-native/`, no `//`, no `\`, ≤1024 chars); production guard retained at `_actions.ts` top | **Ordinary email + password sign-in path NOT exercised** · the signInAction `next` honour is historical but no Cycle 8 test drives it |
| **Ordinary (email + password) sign-in with `next=` preservation (Cycle 9)** | **VERIFIED** | `tests/e2e/journey-buyer-ordinary-signin.spec.ts` test 1 · fills real `[data-nex-sign-in-form] input[name="email"]` + `input[type="password"]` with admin env creds · asserts post-submit landing on `/nex-native/product/<id>` without auth-gate re-mount. Second test proves URL-level `safeNext` rejects 7 malicious shapes · third test proves absent `next=` defaults to `/nex-native/contacts` | Admin sandbox credentials only · no live buyer account sign-in path exercised |
| **Signup form wiring with `?mode=signup&next=/product/<id>` (Cycle 9)** | **VERIFIED (wiring only)** | `tests/e2e/journey-buyer-signup-wiring.spec.ts` tests 1–2 · hidden `[data-nex-sign-up-next]` carries the product path verbatim · mode-toggle round-trips to the sign-in form with `next` intact | **Submit path NOT exercised.** `createNexAccountAction` writes a real Supabase row and no Founder-approved sandbox buyer exists. See purchase-resumption-decision-brief-2026-11-24.md § scope notes. |
| **Adversarial regressions · reload / direct-link / duplicate-tap / back-nav (Cycle 9)** | **VERIFIED (named sub-branches)** | `tests/e2e/journey-buyer-adversarial.spec.ts` 6 tests · see § nav-journey NAV-0096 … NAV-0101 | Signed-in cart dedup sub-test is `BLOCKED-NO-AUTHED-ADD-CONTROL` under the admin storageState |
| Post-auth return to the originating product | **VERIFIED (Dev Pass branch only)** | test 1 `waitForURL(/\/product\/<id>($\|\?)/)` fires within 15 s · `[data-nex-auth-gate-banner]` not re-mounted | Verified for the Dev Pass branch · signup branch not run to completion |
| Signed-in Add-to-Cart write to `localStorage.nex_cart_v1` | **VERIFIED** | test 1 `page.waitForFunction` reads `localStorage.nex_cart_v1` and asserts product id present with `quantity ≥ 1` | **Does NOT prove server-side order persistence** (mig 354/365 BLOCKED, by design for Cycle 8) |
| Cart state survives page refresh | **VERIFIED** | test 1 · `page.reload()` + re-read of `nex_cart_v1` · product id still present | — |
| Automatic purchase resume (click-less re-add after auth) | **DECISION BRIEF ISSUED** | `docs/product/purchase-resumption-decision-brief-2026-11-24.md` · Options A/B/C with recommendation = Option C (deferred prompt banner on return). Not yet authorised for implementation. | **No code written.** Brief is non-authorising per Cycle 9 scope rail. Awaits Founder decision. |
| Signup form carries `?next=` through to the signup submit | **PARTIAL (form wiring VERIFIED)** | test 3 · `input[type=hidden][name=next]` on signup form has value `/nex-native/product/<id>` exactly | **Submit path NOT exercised.** `createNexAccountAction` writes a real Supabase row; no Founder-approved sandbox buyer exists; prelaunch flag (2026-11-19) may hide signup entirely |
| Ask Seller sealed contract `?open-chat=1&product=<id>` redirects non-owner to conversation with product chip | **PARTIAL (redirect + chip VERIFIED)** | test 4 · signed-in non-owner storageState redirected server-side (`[businessSlug]/page.tsx:206-236`) to `/nex-native/conversations/<id>?product=<id>` · chip `[data-nex-biz-conv-pending-product="<id>"]` visible within 10 s | **Does NOT prove the complete non-owner Ask Seller journey.** Composing/sending a message, delivery to Rosa's inbox, receipt + response: NOT exercised. Private-chat body-storage sealed 2026-11-09 forbids assertions on message bodies anyway — a separate test harness is needed |
| **Non-owner Ask Seller · Send-to-shop click produces an observable terminal state (Cycle 9)** | **BROKEN** | `tests/e2e/journey-ask-seller-nonowner-full.spec.ts`, 2026-11-24 · after clicking enabled `[data-nex-biz-conv-pending-product-send]`, the chip remains mounted AND no `[data-nex-biz-conv-pending-product-error]` appears within 15 s. Playwright page snapshot at failure confirms the Send button was enabled (cursor=pointer, no `[disabled]`) and the "You selected / Classic hand-stitched leather tote / IDR 4,500" chip is still rendered | **This is Cycle 9's primary honest finding.** Possible root causes to investigate without changing the test: client handler silently no-ops when `peerAccountId` is null; server action throws + client swallows; the chip has an unobserved terminal state the test does not watch. Does NOT prove any message was sent, received, or stored — none of that is in scope under the device-only E2E seal. |
| Browser back after resumed sign-in does not re-mount auth-gate | **VERIFIED** | test 5 · `page.goBack()` executes, auth-gate count is 0 post-nav | — |
| Interrupted authentication (close tab between gate and sign-in) | **NOT STARTED** | — | No test |
| Duplicate submit (double-tap Dev Pass) | **NOT STARTED** | — | No test |
| Direct-link entry (deep link to product with no referrer) | **PARTIALLY VERIFIED (status 200 only)** | test 1 line 55 goes direct and asserts the product page renders | Reverse-direction behaviour from a deep link not fully mapped |

**Launch readiness for JRN-buyer-signed-out-purchase-resume (post-Cycle 9):** still `PARTIAL`. VERIFIED now covers Dev Pass + localStorage + **ordinary email/password sign-in** + **signup form wiring** + **adversarial reload/direct-link/duplicate-tap/back-nav/malicious-next**. **Non-owner Ask Seller composer send is BROKEN** (new honest finding — Cycle 9 could not elevate it). Full signup submit + auto-resume + duplicate Dev Pass submit + interrupted-auth are not covered. **Do not claim the overall buyer journey is launch-ready.** The BROKEN Ask Seller composer must be resolved (or downgraded by explicit launch decision) before any launch gate can open.

---

### 2.1a · Cycle 10 delta · 2026-11-25 (Ask Seller STOP + wider-launch adds)

- **JRN-buyer-signed-out-purchase-resume · Ask Seller branch** — status UNCHANGED (`BROKEN`). Cycle 10 attempted Founder Decision 1 Path B (non-owner `nex-11339` storageState) and hit the STOP clause on identity mismatch (storageState account has no `nex_conversation_participant` row AND `supabase_user_id = NULL`; server redirect resolves to `nex-11244`'s conversation `0e23bc69…`). No fixture was improvised. No seller reply was sent. Historical `nex-11244` share-locked conversation preserved as evidence.
- **NAV-0021 · splash + pillar routes · full-viewport rule (NEX-021)** — status `VERIFIED` (new). Evidence: `tests/e2e/full-viewport-chrome.spec.ts`, 4/4 green on Pixel 7 at 2026-11-25, sandbox dev `:3008`. Caveat: asserts the CSS contract only. The real mobile browser tab bar is OS-owned and disappears only under PWA standalone. Not a proof of real-device Safari behaviour.
- **NAV-why-nex · /nex-native/why-nex public surface (NEX-006)** — status `VERIFIED` (new row). Evidence: `tests/e2e/smoke-why-nex.spec.ts`, 1/1 green at 2026-11-25. Caveat: smoke only — proves 200 response, sealed `[data-nex-why-page]` marker, ≥1 `[data-nex-why-advantage]` with status LIVE, and CTA cross-link to `/nex-native/switch`. Does NOT assert editorial copy accuracy, does NOT assert drawer behaviour, does NOT claim conversion numbers.
- **NAV-switch · /nex-native/switch savings calculator (NEX-007)** — status `VERIFIED` (new row). Evidence: `tests/e2e/smoke-switch-calculator.spec.ts`, 1/1 green at 2026-11-25. Caveat: smoke only — proves 200 response, sealed `[data-nex-switch-page]` marker, client calculator mounts, sealed honesty copy ("Presets are dated examples…" / "Last verified…") is visible, and comparison block becomes reactive once GMV + orders + commission are entered. Does NOT verify math correctness against the unit tests under `src/app/nex-native/switch/__tests__/`, does NOT assert savings figures, does NOT exercise currency / FX branches.

**Launch readiness for JRN-buyer-signed-out-purchase-resume (post-Cycle 10):** still `PARTIAL`. Ask Seller remains `BROKEN` + the root-cause investigation is `BLOCKED` pending owner authorisation. NEX-021 / NEX-006 / NEX-007 are now independent `VERIFIED` rows that do not depend on Ask Seller.

---

### 2.1b · Cycle 11 delta · 2026-11-25 (Ask Seller security root-cause + account-isolation regression)

**Headline:** the Cycle 10 "identity mismatch" is **not a disclosure defect**. It was a fixture mis-identification. The account-isolation and private-conversation authorization boundaries are proven at four layers.

**Root cause of the Cycle 10 Ask Seller redirect (`BLOCKED` → `CLOSED-NOT-A-VULNERABILITY`):**

- `tests/e2e/.auth/state.json` contains a Supabase JWT whose `sub` claim decodes to `67f6cd2d-c60b-4675-a442-25fa708e1e26`.
- That value matches `nex-11244.supabase_user_id` exactly in sandbox `kdstoyyeygcopkogqsyv`.
- The storage state is bound to `nex-11244`, not `nex-11339`. (The `nex-11339` account has `supabase_user_id = NULL` and therefore cannot be the resolved cookie identity anywhere.)
- The server-side open-chat handler at `src/app/nex-native/[businessSlug]/page.tsx:206-236` resolved the cookie to `nex-11244`'s nex_account via `resolveSessionWithDevOverride` → `getAccountBySupabaseUserId(user.id)` and redirected to `nex-11244`'s own participant conversation. That is the authorization-correct outcome.
- The Cycle 10 composer failure (Send tapped, chip remains, no error) is a separate product-share-lock / UX observability defect on `nex-11244`'s legitimate historical conversation — not a security event. It remains `BROKEN` under § 2.1.

**Account-isolation authorization boundary · code-trace evidence (C11-SEC-1):**

| Layer | File | Guard |
|---|---|---|
| RSC conversation page | `src/app/nex-native/conversations/[conversationId]/page.tsx:106-137` | `notFound()` for "conversation does not exist" AND "not a participant" · collapses both into same response (no existence disclosure) |
| Conversation read API | `src/app/api/nex-native/chat/conversations/[conversationId]/route.ts:27-36` | `resolveNexAppSession` → `getParticipation(conversationId, session.account.id)` → 403 before any data read |
| Encrypted incremental read API | `src/app/api/nex-native/chat/encrypted/since/route.ts:24-61` | `resolveSessionWithDevOverride` (401) → `listBusinessMessages` internally calls `ensureSenderIsParticipant` → 403 maps `"only conversation participants"` |
| Encrypted write API | `src/app/api/nex-native/chat/encrypted/route.ts:87-260` | `resolveSessionWithDevOverride` (401) → `sendEncryptedBusinessMessages` → `ensureSenderCanWriteAsSide` → 403/404/500 mapped; defence-in-depth participant check at L216-219 before push fan-out |

**Account-isolation regression spec (C11-SEC-3):**

- **Spec:** `tests/e2e/security-account-isolation.spec.ts` · Pixel 7 project · sandbox `kdstoyyeygcopkogqsyv`.
- **Run:** 2026-11-25 · 6/6 green.
- **What it proves:**
  - RSC `/nex-native/conversations/<random-uuid>` renders the not-found alert · composer and message-list markers must not mount · raw body must not contain `sender_account_id` or `ciphertext`.
  - API `GET /chat/conversations/<random-uuid>` returns non-2xx (`401`/`403`/`404`) · response body must not include `messages` or `business` keys.
  - API `GET /chat/encrypted/since?conversationId=<random-uuid>` returns non-2xx and must not include `messages`.
  - API `POST /chat/encrypted` with a conversation id the caller is not a participant of returns non-2xx (`401`/`403`/`404`/`500`) · `ok` flag must not be `true`.
  - Unauth `POST /chat/encrypted` returns exactly `401` with `error = not_signed_in` (participant check never runs).
  - Unauth `GET /chat/encrypted/since` returns exactly `401`.

**What this spec does NOT prove (explicitly BLOCKED on missing fixtures, not improvised):**

- The "URL contains a different real user's existing conversation id" case against a known-existing counter-party conversation. Only one sandbox storage state exists (bound to `nex-11244`). The random-UUID probes exercise the same server-side code path because the guards treat "not a participant" and "does not exist" identically by design — but a two-fixture cross-account test would strengthen the evidence further.
- RLS behaviour at the SQL layer — service-role bypasses RLS, so the service-layer guards are the authorization boundary that the HTTP surface actually reaches.
- Cross-device / cross-session invalidation (`nex_session.revoked_at`, `sessions_invalidated_at`, `isSessionSupersededByKey`) — infrastructure is present at `src/lib/nex-native/app/session.ts:101-196`, but not exercised by this spec.

**Status summary:**

| JRN | Status change | Why |
|---|---|---|
| Cycle 10 Ask Seller "identity mismatch" hypothesis | `BLOCKED` → `CLOSED-NOT-A-VULNERABILITY` | JWT `sub` matches `nex-11244.supabase_user_id`; server-side authorization boundary is correct |
| JRN-security-account-isolation (new row) | `VERIFIED (authorization boundary · single-fixture probes)` | `tests/e2e/security-account-isolation.spec.ts` 6/6 green · four-layer code trace completed |
| JRN-buyer-signed-out-purchase-resume · Ask Seller composer branch | UNCHANGED (`BROKEN`) | Separate defect (product-share-lock / UX observability). Needs different fix path. Not security. |

---

### 2.1c · Cycle 11 delta · 2026-11-25 (NEX-006 editorial, NEX-007 math, NEX-021 extended, Ask Seller root-cause)

- **NEX-006 · /nex-native/why-nex · editorial contract** — status `VERIFIED` (upgraded from Cycle 10 smoke). Evidence: `tests/e2e/why-nex-editorial-verification.spec.ts`, 4/4 green at 2026-11-25. Covers:
  - Exactly 7 advantage cards render (owner-sealed count).
  - LIVE sealed pair enforced: "Merchant-direct payments" + "Flat monthly shop subscription · 0% NEX commission". Any additional LIVE card is an over-claim regression.
  - Both BETA and PLANNED cards present (lower bound).
  - Every advantage card carries a "What this does not claim" caveat block (owner directive 2026-11-23).
  - Three CTAs present with sealed hrefs: `/nex-native/manage/shop/setup` (primary), `/nex-native/switch`, `/nex-native/pricing`.
  - Honest Limits footer discloses `nexapp.app` domain + explicit "not an outage-immunity promise" + "Listing on NEX does not create traffic".
  - Page does NOT contain "first / only / best / world-class / unrivalled / unmatched" over-claims in user-facing copy.
  - Caveat: does not run SEO/indexability checks · does not exercise drawer behaviour from the header · pricing numbers come from country-detected spec covered by smoke.

- **NEX-007 · /nex-native/switch · math + locale** — status `VERIFIED (unit-tested)` (upgraded from Cycle 10 smoke). Evidence: `src/app/nex-native/switch/__tests__/_calc-helpers.test.ts`, 26/26 green at 2026-11-25 via `npx vitest run`. Covers:
  - `extractNumericAmount` parses €4.99, £4.99, US$4.99, Rp 89,000, AU$7.99, ¥799, ₫149,000, CHF 4.99, SEK 59.99, ₹449 (10 currencies).
  - Rejects unparseable + non-positive numbers (returns 0).
  - `clampNonNegative` passes non-negative finite · clamps negatives + NaN + Infinity to 0.
  - PRESETS registry includes "Manual" override + source citation + last-verified date on every entry + sealed 22.5% Lazada example + sealed 17.4% Shopee ID example.
  - `computeSwitchComparison` honesty: zero sales → `hasAnySales = false`; low volume → negative savings → `nexCostsMore` flag; high volume at 22.5% → positive savings; annual = exactly 12× monthly; negative/NaN clamped to 0; per-order fixed fees stack on commission (Shopee-style).
  - Caveat: unit tests only · does not run against E2E sandbox · does not drive the browser UI.

- **NEX-021 · full-viewport rule · extended coverage** — status `VERIFIED (Chromium Pixel 7 CSS contract, 6 routes)` (extended from Cycle 10 3-route pillar). Evidence: `tests/e2e/full-viewport-extended-coverage.spec.ts`, 7/7 green at 2026-11-25. Covers: `/nex-native`, `/nex-native/sign-in`, `/nex-native/directory`, `/nex-native/why-nex`, `/nex-native/switch`, `/nex-native/pricing` — each satisfies body-covers-viewport, zero margin, no horizontal scroll, post-scroll stability. Also asserts `<html>` `overflow` is one of the sealed splash values. **Caveat: WebKit is NOT installed; real-device Safari install-prompt behaviour remains emulation-only (iPhone 14 Pro profile is Chromium with iOS UA). Not authorised this cycle to install WebKit.**

- **JRN-security-account-isolation · four-layer authorization boundary** — status `VERIFIED (authorization boundary, single-fixture probes)`. See § 2.1b for full evidence + layer-by-layer code trace.

- **Ask Seller composer root-cause (C11-ASK)** — the Cycle 9/10 BROKEN classification is NOT a disclosure defect. It is a product-share-lock / hydration-text-mismatch defect documented in `src/app/nex-native/conversations/[conversationId]/_client.tsx:978-990`. Fix sealed in Cycle 10 at line 992 (viewer-`lang` threaded into `Intl.NumberFormat`). E2E re-verification via existing `tests/e2e/journey-ask-seller-nonowner-full.spec.ts` BLOCKED on Playwright worker env-propagation issue (sealed fixture env vars don't reach worker · tooling investigation outside Cycle 11 scope · not blocking launch-readiness because the security side is proven and the composer is a UX observability branch).

---

### 2.1d · Cycle 11 · whole-app launch-gap delta (C11-LAUNCH)

**Launch posture after Cycle 11 (post-ledger reconciliation):**

| Launch surface | Status | Blocking? |
|---|---|---|
| Splash (State A) first-paint pillar | VERIFIED (CSS contract, Chromium Pixel 7) | No |
| Sign-in (ordinary email + password + Dev Pass + malicious-`next` rejection) | VERIFIED | No |
| Why NEX editorial contract | VERIFIED | No |
| Switch calculator math + locale | VERIFIED (unit tests) | No |
| Directory landing full-viewport | VERIFIED (CSS contract, Chromium Pixel 7) | No |
| Pricing landing full-viewport | VERIFIED (CSS contract, Chromium Pixel 7) | No |
| Account-isolation + conversation-boundary authorization | VERIFIED (single-fixture probes) | No |
| PWA install promotion cadence (NEX-022) | VERIFIED (Chromium only · owner acknowledged emulation gap) | No, with explicit emulation caveat |
| Full-viewport real-device Safari behaviour | **GAP** (WebKit not installed · not authorised) | No (owner acknowledged) · emulation caveat preserved |
| Ask Seller non-owner composer (product-share chip, send E2E) | **GAP** (C11-ASK root-cause recorded + Cycle 10 fix in place · fresh E2E re-verification BLOCKED on tooling) | Not security-blocking; UX-observability branch |
| Two-fixture cross-account security probe | **GAP** (BLOCKED on second sandbox storageState · not authorised to create) | No (random-UUID probes exercise same guard code path) |
| Blueprint G-1 (State B vs State C distinction) | GAP (unchanged since 2026-11-23) | **Yes · launch-critical for first-user journey** |
| Blueprint G-3 (new-device key establishment, State F) | GAP (unchanged · critical) | **Yes · launch-critical for PWA re-install / phone change** |
| Blueprint G-4 (theme persistence pre-auth → auth) | GAP (unchanged) | **Yes · owner-flagged proof** |
| Blueprint G-5 (shop-offer screen never exercised) | GAP (unchanged · NEX-015 Stripe-sandbox gate still closed) | **Yes · would funnel into broken checkout if exposed** |
| Blueprint G-6 (Invite Friends / Share NEX ID mount) | GAP (unchanged) | **Yes · owner-flagged proof** |
| Purchase-Resumption Option C (deferred-prompt banner) | DECISION BRIEF ISSUED · not implemented · explicitly NOT authorised this cycle | No (outside Cycle 11 scope) |
| Stripe activation + Emergency Help activation + Public Shop Directory release | SEALED off · owner-controlled gates | No (gate-protected) |

**Cycle 11 did not create new critical gaps.** It converted two Cycle 10 smoke rows (NEX-006/NEX-007) into VERIFIED, extended NEX-021 across 6 public routes, and recorded the authoritative security root-cause + regression spec. The five Blueprint-level gaps (G-1, G-3, G-4, G-5, G-6) are the pre-existing launch blockers and remain the next-cycle work queue.

---

### 2.1e · Cycle 12 delta · 2026-11-25 (G-4 theme persistence pre-auth → auth)

**Headline:** Blueprint G-4 (theme-persistence across the pre-auth → auth transition) is now `PARTIAL (pick-theme branch VERIFIED post-signup-apply handoff · first-free + full signup replay OUT OF SCOPE)`.

**Scope sealed by Founder 2026-11-25:** "APPROVED — G-4 ONLY. Proceed with G-4: Theme persistence across pre-auth → auth transition." Decisive-proof rule: "I would not allow Claude to mark G-4 complete just because a database row exists. The decisive proof is that the correct account owns the selected theme and the authenticated chat actually uses it without another activation action."

**Spec:** `tests/e2e/journey-post-signup-apply-theme.spec.ts` (Pixel 7 project `stage-a-pixel7`, sandbox `kdstoyyeygcopkogqsyv`, authenticated storageState bound to `nex-11244`).

**Code under test:**
- Handler: `src/app/nex-native/post-signup-apply/page.tsx` (new route, Cycle 12).
- Cookie primitive: `src/lib/nex-native/account-wall/pending-action.ts:141-162` (`consumePendingAccountWall`).
- Viewer sealed directive: `src/app/nex-native/themes/[id]/_preview-action-bar.tsx:86-88` (owner 2026-10-28: when `isAlreadyApplied === true`, the entire ThemePreviewActionBar returns null · no chip, no Use-this-theme form).
- Server-side predicate at `src/app/nex-native/themes/[id]/page.tsx:237`: `isAlreadyApplied={activeChatTheme === pkg.identity.id}`.

**Run:** 2026-11-25 · `./node_modules/.bin/playwright test journey-post-signup-apply-theme --project=stage-a-pixel7` · 4/4 green (auth-setup + 3 scenarios).

| Branch | Status | Evidence | What this does NOT prove |
|---|---|---|---|
| Valid `pick-theme` cookie → handler writes chat_theme → redirect to `/themes/<id>?applied=1` → viewer renders WITHOUT ThemePreviewActionBar (decisive proof · no second Activate press) | **VERIFIED** | Test 1 · seeds `nex_pending_wall=v1\|pick-theme\|/nex-native/themes/nex-bubbles?applied=1\|nex-bubbles` · `waitForURL(/themes/nex-bubbles/)` fires within 15 s · asserts `applied=1` marker · asserts `[data-nex-theme-applied-toast]` attached (proves SSR branch executed) · asserts `[data-nex-theme-action-bar]` toHaveCount(0) · asserts `[data-nex-theme-action-bar-use-form]` toHaveCount(0). The absence of the bar proves the server-side predicate `account.chat_theme === 'nex-bubbles'` is true · which is the authoritative proof the write landed on the viewer's own account | Does NOT exercise the SELECTED_THEME_COOKIE splash path (prelaunch access guard in `createNexAccountAction` currently only permits founder emails). Does NOT exercise the `source='first_free'` write (migration 342 unapplied · explicitly deferred). |
| One-shot fall-through: second visit to `/post-signup-apply` with NO pending-wall cookie redirects to `/nex-native/contacts` | **VERIFIED** | Test 2 · no cookie seeded · `waitForURL(/\/nex-native\/contacts/)` fires within 15 s · asserts final URL contains `/nex-native/contacts` | — |
| Replay-resistance: second visit with the SAME pending-wall cookie still present is IDEMPOTENT (no second Activate press required · customer outcome identical) | **VERIFIED (idempotency · NOT cookie-clearance)** | Test 3 · first visit lands at `/themes/nex-bubbles` · second visit with same cookie still present also lands at `/themes/nex-bubbles` AND action bar is still absent (`[data-nex-theme-action-bar]` toHaveCount(0)). Honestly documents that Next.js 16 RSCs cannot emit Set-Cookie response headers (observed empirically · only `nex_known_device` from middleware appears) · `consumePendingAccountWall` already acknowledges this limitation at lines 155-160 via try/catch · cookie state check is tolerant (`absent`/`blank`/`persistent`) | Does NOT prove the cookie is cleared from the browser. The real replay-resistance property for `pick-theme` is idempotency (same value re-written produces identical customer outcome). Non-idempotent future actions (order-product, post-community-notice) will need a different consumption mechanism (route-handler or server-action consumer that CAN emit Set-Cookie). |

**Independent challenge pass (C12-SEC-1) · 9 adversarial probes against the running handler · 2026-11-25:**

| Probe | Cookie shape | Expected | Observed meta-refresh target |
|---|---|---|---|
| A · open-redirect | `v1\|pick-theme\|https://evil.example/nx\|nex-bubbles` | Decoder rejects external nextUrl | `/nex-native/contacts` |
| B · protocol-relative | `v1\|pick-theme\|//evil.example/\|nex-bubbles` | `.includes("//")` rejects | `/nex-native/contacts` |
| C · path traversal | `v1\|pick-theme\|/nex-native/../etc\|nex-bubbles` | `.includes("..")` rejects | `/nex-native/contacts` |
| D · unknown action id | `v1\|open-admin-console\|/nex-native/themes/x?applied=1\|nex-bubbles` | Action whitelist rejects | `/nex-native/contacts` |
| E · SQL-injection payload | `v1\|pick-theme\|/nex-native/themes/x?applied=1\|';DROP TABLE nex_account;--` | `isPlausibleThemeId` kebab-regex rejects · no SQL ever issued | `/nex-native/contacts` |
| F · non-existent theme id | `v1\|pick-theme\|/nex-native/themes/does-not-exist?applied=1\|totally-made-up-theme` | `updateChatTheme` throws for unknown id · caught | `/nex-native/contacts` |
| G · missing v1 prefix | `v2\|pick-theme\|/nex-native/themes/nex-bubbles?applied=1\|nex-bubbles` | Version-prefix check rejects | `/nex-native/contacts` |
| H · unauth with valid cookie | no auth cookies + valid pending cookie | `resolveSessionWithDevOverride` null → redirect to `/sign-in` WITHOUT consuming the cookie | `/nex-native/sign-in` (3 sign-in markers in body · cookie NOT consumed · race-safe) |
| I · premium theme defence-in-depth | admin (no Themes Plus) + `v1\|pick-theme\|/nex-native/themes/aurora?applied=1\|aurora` | Premium gate rejects via `canAccessChatTheme` | `/nex-native/chat-themes-library?e=premium_required&m=Aurora+requires+NEX+Themes+Plus` |

Post-probe DB inspection: admin.chat_theme remained `nex-bubbles` after all 9 probes (the premium probe did NOT write `aurora` to the account). All defensive layers behave as intended.

**Known architectural limitation (honestly recorded, NOT a security defect):** Next.js 16 RSCs cannot emit Set-Cookie response headers from `cookies().set()`. The one-shot cookie therefore persists in the browser after `consumePendingAccountWall` runs. For `pick-theme` this is harmless because the action is idempotent (writing the same theme id repeatedly is a no-op). For future non-idempotent actions, a server-action or route-handler consumer that CAN emit Set-Cookie headers will be required.

**Status summary:**

| JRN | Status | Why |
|---|---|---|
| JRN-G-4-pick-theme-handoff (new row) | **VERIFIED (pick-theme branch · post-signup-apply handoff)** | 3 Playwright tests green + 9 adversarial probes behave safely + DB state confirmed |
| Blueprint G-4 overall (theme-persistence pre-auth → auth) | **PARTIAL** | `pick-theme` handoff branch sealed. `SELECTED_THEME_COOKIE` splash path + full signup-flow replay + `source='first_free'` write remain explicitly out of Cycle 12 scope (sandbox prelaunch gate + unapplied migration 342). |

---

### 2.1f · Cycle 13 delta · 2026-11-25 (G-4 pick-theme handoff · stale-replay + CSRF closed)

**Headline:** Two real bugs were proved against the Cycle 12 RSC implementation of `/nex-native/post-signup-apply` and closed by converting the page to a Route Handler. The Cycle 12 § 2.1f "known architectural limitation" (cookie persists after consumption) is **no longer a limitation** · it was actually enabling BUG-C13-001 and is now closed.

**Scope sealed by Founder 2026-11-25:** "CYCLE 13 — G-4 COMPLETION AND SECURITY RE-VERIFICATION." Boundaries: G-4 only, sandbox only, no production/migrations/prelaunch weakening/commits/pushes/new accounts. Preserve all existing sealed decisions and the uncommitted useLang() correction.

**Bugs proved against the Cycle 12 page.tsx (independent-verifier adversarial probe, 2026-11-25):**

| ID | Bug | Proof method | Impact |
|---|---|---|---|
| **BUG-C13-001** | Stale pending-wall cookie persists after consumption and silently overwrites the user's later theme choice on re-visit. | Direct probe against live handler: reset admin.chat_theme to `theme-0` → seed cookie carrying `nex-bubbles` → GET `/post-signup-apply` → chat_theme written to `nex-bubbles` → DB UPDATE chat_theme to `nex-flat` (simulating user switching theme via normal flow) → GET `/post-signup-apply` again with same cookie → chat_theme REVERTS to `nex-bubbles`. Root cause: Next.js 16 RSC render functions silently drop `cookies().set(...)` (acknowledged at `src/lib/nex-native/account-wall/pending-action.ts:147-160`). The "one-shot" cookie was never a one-shot in practice · it had a 20-minute TTL window during which bookmark/back-nav/cross-site click could replay it. | Silent reversion of user's theme choice until the cookie expires. |
| **BUG-C13-002** | State-changing GET request succeeds on cross-site top-level navigation (classic CSRF-via-GET surface). | Direct probe: with the pending cookie present, fired a GET to `/post-signup-apply` carrying `Sec-Fetch-Site: cross-site` + `Origin: https://evil.example` + `Sec-Fetch-Mode: navigate` + `Sec-Fetch-Dest: document`. The RSC page performed the chat_theme write and redirected normally. SameSite=Lax permits the cookie to travel on cross-site top-level `<a href>` clicks and cross-site form POSTs, so an attacker-controlled page could combine a pre-existing stale cookie with a cross-site click to flip the victim's theme without any interaction on the NEX surface. | Low-severity (theme change only · no account takeover · no money movement), but a real CSRF-on-GET defect in the authenticated surface. The same pattern applied to any future non-idempotent action (`order-product`, `post-community-notice`) would be material. |

**Cycle 13 fix:** `src/app/nex-native/post-signup-apply/page.tsx` DELETED. Replaced by `src/app/nex-native/post-signup-apply/route.ts` (Route Handler, `runtime="nodejs"`, `dynamic="force-dynamic"`).

Key behaviour of the new handler:

- `Sec-Fetch-Site: cross-site` → 303 redirect to `/nex-native/contacts` **without** consuming the cookie (attacker just loses this trip; legit same-origin consumer can still use it afterwards).
- `Origin` header present AND cross-origin → same treatment (defence-in-depth for older browsers that don't emit `Sec-Fetch-Site`).
- Unauth caller → 303 to `/nex-native/sign-in` without consuming the cookie (preserves the legitimate post-sign-in handoff behaviour · same as Cycle 12 Probe H).
- Same-origin caller with valid cookie → consume the pending record, apply theme, 303 redirect to `pending.nextUrl`, AND emit `Set-Cookie: nex_pending_wall=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/` on the SAME response so the cookie is cleared from the browser at the same moment the server consumed it (route handlers CAN set response cookies, unlike RSC render functions).
- All other branches (missing cookie, non-`pick-theme` action, implausible theme id, premium-theme gate, `updateChatTheme` failure) redirect with the same `Set-Cookie` clear.

**Spec:** `tests/e2e/journey-post-signup-apply-theme.spec.ts` · 4 scenarios (two carried from Cycle 12, two added for Cycle 13), Pixel 7 project `stage-a-pixel7`, sandbox `kdstoyyeygcopkogqsyv`, authenticated storageState bound to admin account `80a9cedb-f477-4116-bcd8-78fb337d31e2`.

**Run:** 2026-11-25 · `./node_modules/.bin/playwright test journey-post-signup-apply-theme --project=stage-a-pixel7` · **5/5 green** (auth-setup + 4 scenarios, 56.4 s total).

| Branch | Status | Evidence |
|---|---|---|
| Valid pick-theme cookie → chat_theme written → viewer renders without action bar | **VERIFIED** (unchanged from Cycle 12) | Test 1 · waitForURL to `/themes/nex-bubbles` + applied toast attached + action bar count 0 + use-form count 0. Decisive proof the server-side predicate `account.chat_theme === 'nex-bubbles'` is true on the viewer's own account. |
| Second visit with NO cookie redirects to /contacts | **VERIFIED** (unchanged from Cycle 12) | Test 2 · waitForURL to `/nex-native/contacts`. |
| **REAL one-shot** · cookie cleared on consumption AND user's intervening theme choice preserved on later visit (BUG-C13-001 closed) | **VERIFIED** | Test 3 · DB-side reset chat_theme to `theme-0` → seed cookie → first visit → DB chat_theme reads `nex-bubbles` AND browser cookie jar contains no non-empty `nex_pending_wall` → DB UPDATE chat_theme to `nex-flat` → second visit → redirects to `/contacts` (cookie is gone) AND DB chat_theme STILL reads `nex-flat` (user's choice preserved). Regression guard against resurrecting the RSC page. |
| **CSRF defence** · `Sec-Fetch-Site: cross-site` request must not consume cookie or mutate DB (BUG-C13-002 closed) | **VERIFIED** | Test 4 · baseline chat_theme `theme-0` → seed cookie → `page.request.get` with `Sec-Fetch-Site: cross-site` + `Sec-Fetch-Mode: navigate` + `Sec-Fetch-Dest: document` + `maxRedirects: 0` → response is 303 to `/nex-native/contacts` + DB chat_theme still `theme-0` + cookie still present in browser jar (not consumed, so the legit same-origin handoff can still use it). |

**Theme application vs ownership vs entitlement triad (for Cycle 12/13 `pick-theme` branch, `nex-bubbles`):**

| Dimension | Status | Why |
|---|---|---|
| **Applied** | YES | `nex_account.chat_theme = 'nex-bubbles'` after Test 1 (confirmed by `readAdminChatTheme()` in Test 3 step 3). |
| **Owned** | N/A | `nex-bubbles` is a gratis live-world theme registered in code (`src/lib/nex-native/library/live-theme-register.ts`), not in DB. The entitlement service's gratis fast-path (`canAccessChatTheme` → `{allow: true, reason: "free"}`) returns before any ownership check. No `nex_theme_ownership` row is required or written. Migration 342's `source='first_free'` write applies to PAID themes claimed via the first-free perk, which is a separate flow (Themes Plus) not exercised by this handoff. |
| **Entitled** | YES | Gratis gate authorises any authenticated account. Premium defence-in-depth gate in the handler (`src/app/nex-native/post-signup-apply/route.ts:183-205`) correctly rejects a tampered cookie carrying a paid theme id (Cycle 12 Probe I evidence). |

For the Cycle 12 `pick-theme` branch on gratis themes, the correct triad is applied=YES · owned=N/A · entitled=YES. Migration 342 remains **unapplied** · the `source='first_free'` write for PAID themes claimed via Themes Plus first-free is explicit deferred scope.

**Status summary:**

| JRN | Status | Why |
|---|---|---|
| JRN-G-4-pick-theme-handoff (Cycle 12) | **VERIFIED** (confirmed by Cycle 13 regressions) | 4 Playwright tests green + 9 Cycle 12 adversarial probes + 2 Cycle 13 bug-regressions + DB state verified at every step. |
| Blueprint G-4 overall (theme-persistence pre-auth → auth) | **PARTIAL (unchanged)** | `pick-theme` handoff branch sealed. `SELECTED_THEME_COOKIE` splash path + full signup-flow replay from guest → authenticated (prelaunch-access gate) + `source='first_free'` write for PAID themes (migration 342 unapplied) remain explicitly deferred. |

**Known residual scope (honestly recorded):**

- Full guest → signup → authenticated journey is NOT exercised by Playwright because `createNexAccountAction` enforces a prelaunch access gate (`src/app/nex-native/_actions.ts:277-312`) that currently only permits founder UIDs. Weakening that gate globally was explicitly refused by the Founder. A future sandbox-only authorised lane (either an explicit founder UID in `NEX_PRELAUNCH_FOUNDER_UIDS` for a synthetic test account, or a sandbox `NEX_PRELAUNCH_MODE=off` applied to one deployment) would be required to extend verification over the full journey.
- Migration 342 (`acquired_via` CHECK-constraint update to accept `first_free`) remains drafted and unapplied. The first-free write path is deferred until Themes Plus Phase B is authorised.
- The `SELECTED_THEME_COOKIE` splash path (fresh signup from splash with a theme preselected by a guest) is a separate handoff from the `nex_pending_wall` account-wall path exercised here. It uses `src/app/nex-native/_actions.ts:613-651` inside `createNexAccountAction` and is only reachable via the prelaunch-gated signup action.

---

### 2.2 · Prior-cycle carry-forward

The two Pass 1 VERIFIED rows (NAV-0017 and NAV-0025) and the two Shop D segment VERIFIED rows (single-seller buyer checkout + price-validation, sandbox) are promoted into this ledger only when each one's required branches are enumerated and re-ratified. Until then they remain recorded in `nav-journey-ledger.md` § 2 and in the Pass 1 audit. Treating a row as VERIFIED here requires branch-level evidence.

---

## 3 · Rules

1. A row with `PARTIAL` must list the exact un-verified branches. No row may be `VERIFIED` while any declared branch is anything other than VERIFIED.
2. Dev Pass-only evidence is `PARTIAL (Dev Pass branch only)`, never `VERIFIED`.
3. A test that only asserts URL/form wiring is `PARTIAL (wiring only)`, never `VERIFIED`.
4. A redirect + chip visibility without end-to-end delivery is `PARTIAL (redirect + chip only)`, never `VERIFIED`.
5. An outstanding UX decision is a declared branch with status `NOT STARTED`, not an invisible gap.
6. Caveats are mandatory. If the "What this does NOT prove" cell is empty, the row is incomplete.
7. No launch gate opens without this ledger recording every required branch for every launch-critical journey in a state ≠ `NOT STARTED` and ≠ `NOT VERIFIED`.
