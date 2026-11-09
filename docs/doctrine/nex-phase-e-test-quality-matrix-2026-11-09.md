# NEX · Phase E · Test + Quality Matrix
### 2026-11-09 · Playwright journeys + performance + mobile + a11y baselines

**Status:** Engineering matrix · ready for Phase E execution. Produces the 10 Playwright journey specifications + performance baseline + mobile baseline + a11y baseline. Each test/journey can be authored today · test execution runs during Phase E (after Phase D complete).

**Author:** Claude Opus 4.7

**Related:**
- 8-workstream phased build plan · Build Phase E
- Consolidated roadmap · 12-step remediation order
- World-Class Safety Programme doctrine (sealed 2026-11-08)

---

## 0 · Scope

This matrix covers NEX's user-facing quality gates:
- **10 Playwright E2E journeys** (consolidated roadmap step 9)
- **Performance baselines** (Lighthouse + Core Web Vitals · roadmap step 10)
- **Mobile responsive** (roadmap step 10)
- **Accessibility** (WCAG 2.2 AA · roadmap step 10)
- **Load testing** (new addition for 100k-user forecast)

---

## 1 · 10 Playwright journeys

Each journey = one `*.spec.ts` file in `tests/e2e/journeys/`. Each has setup · action · assertion · teardown.

### J-1 · Create account + first chat

**File:** `tests/e2e/journeys/j1-create-account-first-chat.spec.ts`

**Steps:**
1. Visit `/nex-native/create-account`
2. Submit email + password
3. Verify email (sandbox: tap verification link from test mailbox)
4. Complete profile (chat name · country · phone · address · interests · socials)
5. Navigate to `/free-chat`
6. Start conversation with test counter-party
7. Send a message
8. Verify message delivered

**Assertions:**
- Account created in `nex_native_account` sandbox table
- Profile row exists
- Device registered in `nex_device` (post Phase 2)
- Chat message delivered (post Phase 2: peer-to-peer confirmation)
- No message body in server DB (post Phase 2)

### J-2 · Business signup + 7-day trial

**File:** `tests/e2e/journeys/j2-business-signup-trial.spec.ts`

**Steps:**
1. Start from signed-in personal account
2. Navigate to `/manage/shop`
3. Choose Shop package · Rp 89,000 or $9.99 (currency per country)
4. Enter payment method (Stripe test card `4242 4242 4242 4242`)
5. Confirm trial start
6. Verify trial active

**Assertions:**
- Stripe customer created in test mode
- Subscription in `trialing` status
- Day 8 auto-charge scheduled
- In-app shows "7 days remaining"
- Honesty guardrails present (pre-trial disclosure + day-5 reminder scheduled + 1-click cancel visible)

### J-3 · Shop setup 7-step

**File:** `tests/e2e/journeys/j3-shop-setup-7-step.spec.ts`

**Steps (all 7):**
1. Business info (name · category · country)
2. Address + contact
3. Logo + hero image upload
4. Business hours
5. Payment setup (Stripe Connect onboarding link · test mode)
6. First product + menu seed
7. Publish

**Assertions:**
- Draft persistence · navigate away mid-step · return · state preserved
- Dirty-nav warning if attempting to leave with unsaved changes
- Published business visible in `/directory/new`
- Stripe Connect `charges_enabled = true` in test mode

### J-4 · Product listing + browse

**File:** `tests/e2e/journeys/j4-product-browse.spec.ts`

**Steps:**
1. Seller navigates to Manage → Products → Add
2. Create product with price · description · image · stock
3. Publish product
4. Buyer navigates to shop · views product
5. Buyer adds to cart

**Assertions:**
- Product in `nex_product` sandbox
- Product visible on shop page
- Cart state preserved across page reload
- Price displayed matches server-side `price_pence`

### J-5 · Buyer checkout (F-3 attack paths)

**File:** `tests/e2e/journeys/j5-buyer-checkout.spec.ts`

**Steps:**
1. Add product to cart
2. Proceed to checkout
3. Complete Stripe test-mode payment

**F-3 specific assertions (critical):**
- Legacy `amountMinor` shape rejected (400)
- Draft product checkout rejected (409)
- Sold-out product rejected (409)
- Unsupported currency rejected (422)
- Cross-business product rejected (400)
- Stripe Checkout `unit_amount` matches server-side `price_pence` (not any client input)
- 0% application fee on Connect destination charge
- `nex_item_product_ids` metadata preserved for webhook reconstruction

### J-6 · Themes purchase + apply

**File:** `tests/e2e/journeys/j6-themes-purchase.spec.ts`

**Steps:**
1. Navigate to Chat Themes library
2. Preview a theme
3. Purchase ($3.99 one-time test mode)
4. Apply theme
5. Verify theme applied

**Assertions:**
- Stripe one-time charge in test mode
- Theme ownership in `nex_user_theme_ownership` (or equivalent)
- Theme visible in applied state
- Theme persists across sign-out / sign-in

### J-7 · Vault pin + biometric

**File:** `tests/e2e/journeys/j7-vault-pin-biometric.spec.ts`

**Steps:**
1. Navigate to Vault
2. Set 6-digit PIN
3. Access vault (enter PIN)
4. If biometric available in test env · register biometric
5. Access vault (biometric)
6. Store a vault item
7. Retrieve the vault item

**Assertions:**
- PIN stored as hash (not plaintext) in `nex_vault_auth`
- Vault item stored (device-local for Phase 2 era · or encrypted on server for pre-Phase-2 era)
- Vault not accessible without PIN/biometric

### J-8 · Report user · moderation flow

**File:** `tests/e2e/journeys/j8-report-moderation.spec.ts`

**Steps:**
1. User A reports User B
2. Report submitted with reason + evidence
3. Report appears in HQ moderation queue
4. HQ admin reviews · takes action (warn · suspend · terminate · no-action)
5. User B notified (or redacted per policy)

**Assertions:**
- Report row in `nex_report`
- HQ action log entry
- User B's account status updated (if action taken)
- Report's publicly-visible evidence accessible to HQ but not to User A/C

### J-9 · Account deletion

**File:** `tests/e2e/journeys/j9-account-deletion.spec.ts`

**Steps:**
1. Signed-in user navigates to Settings → Delete Account
2. Confirms deletion (double-confirm per constitution)
3. 30-day recovery window
4. Day 31: hard delete

**Assertions:**
- Account status `pending_deletion` immediately
- User cannot sign in during pending period (or sign-in restores account per policy)
- After 30 days (or test-env accelerated) · account status `deleted` · data anonymised per retention rules
- Legal-retention carve-outs preserved (orders · payments · security audit)
- Private chat content: already device-local post Phase 2 · nothing to delete server-side

### J-10 · Multi-country switch

**File:** `tests/e2e/journeys/j10-multi-country-switch.spec.ts`

**Steps:**
1. Switch country (Ireland → Indonesia → Worldwide)
2. Verify studio backdrop updates
3. Verify currency updates ($ → Rp → $)
4. Verify language if applicable
5. Return to chat · verify messages preserved

**Assertions:**
- `NEX_APP_IDENTITY` honoured per country
- Backdrop asset loaded per country
- Pricing display matches country currency
- No private-chat data leakage across country switch (chat is user-scoped · not country-scoped)

---

## 2 · Playwright config

### 2.1 · Browsers
- Chromium (primary)
- WebKit (Safari surface)
- Firefox (optional · post-launch)

### 2.2 · Viewports
- Mobile: 375×667 (iPhone SE baseline)
- Tablet: 768×1024
- Desktop: 1440×900 (plus 1920×1080 spot checks)

### 2.3 · Parallelism
- 4 workers in CI
- Isolated test accounts per worker (seeded in sandbox)

### 2.4 · Flaky-test policy
Flaky tests block merge until stabilised. Retry disabled in CI. If a journey is genuinely non-deterministic (e.g. Stripe webhook timing) · fix the race rather than retry.

---

## 3 · Performance baseline matrix

### 3.1 · Lighthouse targets

| Page | Perf | A11y | Best Practices | SEO |
|---|---|---|---|---|
| `/` (home) | ≥90 | ≥95 | ≥95 | ≥95 |
| `/free-chat` | ≥85 | ≥95 | ≥95 | n/a |
| `/directory/new` | ≥90 | ≥95 | ≥95 | ≥95 |
| `/manage/shop` | ≥85 | ≥95 | ≥95 | n/a |
| `/chat-themes-library` | ≥85 | ≥95 | ≥95 | ≥95 |
| `/nex-native/create-account` | ≥90 | ≥95 | ≥95 | ≥95 |
| `/nex-native/sign-in` | ≥90 | ≥95 | ≥95 | ≥95 |
| `/[businessSlug]` (seller page) | ≥85 | ≥95 | ≥95 | ≥90 |

### 3.2 · Core Web Vitals (field + lab)

| Metric | Threshold | Measured on |
|---|---|---|
| LCP (Largest Contentful Paint) | ≤2.5s | p75 mobile + p75 desktop |
| INP (Interaction to Next Paint) | ≤200ms | p75 mobile |
| CLS (Cumulative Layout Shift) | ≤0.1 | p75 |
| FCP (First Contentful Paint) | ≤1.8s | p75 mobile |
| TTFB (Time to First Byte) | ≤800ms | p75 |

### 3.3 · Measurement tools
- Lighthouse CI in CI (lab)
- Vercel Speed Insights (field)
- Chrome UX Report / CrUX (field · post-launch)

---

## 4 · Mobile matrix

### 4.1 · Devices tested

| Device | Resolution | Browser |
|---|---|---|
| iPhone SE (3rd gen) | 375×667 | Safari |
| iPhone 14 | 390×844 | Safari |
| Samsung Galaxy S23 | 360×780 | Chrome |
| Google Pixel 7 | 412×915 | Chrome |

### 4.2 · Mobile-specific checks
- Phone-frame rule (sealed · 360×780 center on desktop ≥500px) honoured on all `/nex-native/*`
- Touch targets ≥44×44px (iOS HIG) · ≥48×48px (Material Design)
- Scrollable regions · no layout break
- Virtual keyboard overlap · input remains visible
- Safe-area insets (notch · home indicator)

### 4.3 · Mobile-only test flags
Journeys J-1 through J-10 all run in mobile viewport · tagged `@mobile` for selective runs.

---

## 5 · Accessibility matrix

### 5.1 · WCAG 2.2 AA conformance targets

| Principle | Must pass |
|---|---|
| Perceivable | Colour contrast 4.5:1 text · 3:1 UI · alt text · captions where video |
| Operable | Keyboard navigation · no keyboard trap · skip-links · focus visible |
| Understandable | Form labels · error messages · language declared (`<html lang>`) |
| Robust | Valid HTML · ARIA correct usage · programmatic name/role/value |

### 5.2 · Tool chain

| Tool | Scope |
|---|---|
| axe-core via Playwright | Automated · per-journey |
| Lighthouse Accessibility | Per-page |
| Manual NVDA (Windows) | Critical journeys · pre-launch |
| Manual VoiceOver (macOS/iOS) | Critical journeys · pre-launch |
| TalkBack (Android) | Critical journeys · pre-launch |

### 5.3 · Critical journeys for manual a11y audit
- J-1 (Create account)
- J-3 (Shop setup)
- J-5 (Buyer checkout)
- J-9 (Account deletion)

### 5.4 · a11y bug triage
P0: blocking (can't complete task via keyboard/screen-reader) → fix before launch
P1: degraded (completable but non-standard) → fix in first 90 days
P2: polish → backlog

---

## 6 · Load testing

### 6.1 · Scenarios

| Scenario | Load | Target |
|---|---|---|
| Normal day | 1k concurrent sessions | p99 latency ≤500ms |
| Peak event | 10k concurrent sessions | p99 latency ≤1s |
| 100k scale sanity | 50k concurrent sessions | p99 latency ≤2s · no errors |
| Signalling storm | 10k concurrent WebRTC setups | Supabase Realtime handles |

### 6.2 · Tooling
- k6 or Artillery for HTTP load
- Custom WebRTC harness for signalling storm (10k devices establishing peer-to-peer simultaneously)

### 6.3 · Where tested
Sandbox project at scale (requires temporary upgrade to larger Supabase plan during load test · revert after).

### 6.4 · Specific paths tested
- `POST /api/nex-native/billing/checkout/buyer` (F-3 path · checkout at scale)
- `POST /api/nex-native/signalling/*` (signalling envelope creation at scale)
- Database read fan-out (directory browse · search · product list)

---

## 7 · Regression test suite

### 7.1 · Minimum CI gates on every PR

- Unit tests pass (Vitest)
- Type check passes (tsc --noEmit)
- Build passes (next build)
- E2E smoke subset passes (J-1 · J-5 · J-10 as smoke)
- Lighthouse CI on changed routes
- axe-core on changed routes

### 7.2 · Full suite on nightly

- All 10 Playwright journeys
- Full Lighthouse matrix
- Full a11y matrix
- Load test at normal-day scale

---

## 8 · What this matrix does + does NOT do

### Does
- Specify every journey · every assertion
- Specify performance · mobile · a11y baselines
- Specify load-test scenarios
- Ready for Phase E execution authorisation

### Does NOT
- Execute any test (requires Phase E authorisation)
- Create any test file in the `tests/` directory (target scope only)
- Modify any code
- Deploy anything

---

**End of Phase E test + quality matrix.**

Ready for Phase E authorisation to begin authoring + executing the test suite. Each journey spec + each Lighthouse check can be authored today · they run during Phase E after Phase D (device-only architecture) is complete, so the assertions can verify Phase 2 invariants.
