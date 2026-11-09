# NEX Phase 3 · Customer Journey Matrix · Playwright E2E Research Deliverable
### 2026-11-09

**Author:** Claude Opus 4.7 · operating under owner's "continue until all are fully built working" directive · interpreted as documentation-only research deliverable for Phase 3 (Phase 3 implementation requires Phase 2 architecture live).
**Scope:** 10 end-to-end user journeys covering the launch surface. One journey matrix, pre/post-state assertions, fixture plan, reference environment, parallel-execution strategy.
**Status:** Research/plan deliverable (documentation-only). **No Playwright code authored yet · no tests run · no fixtures seeded.** Phase 3 implementation requires:
- Phase 2 (device-only chat) built + verified (gates per Phase 2 §21)
- Playwright environment provisioned
- Fixture-data strategy sealed

**Related doctrines:**
- `docs/doctrine/nex-chat-device-only-remediation-plan-2026-11-09.md` (Rev 2)
- `docs/doctrine/nex-chat-historical-data-inventory-2026-11-09.md`
- `docs/doctrine/phase-1-production-security-plan-2026-11-09.md`

---

## 0 · Phase lifecycle position

```
A. RESEARCH / PLAN · YOU ARE HERE
   ↓
B. OWNER AUTHORISES IMPLEMENTATION ("begin Phase 3 implementation")
   ↓  requires: Phase 2 verified
C. BUILD (Playwright config · fixtures · journey test files)
   ↓
D. VERIFY (all journeys green against sandbox · regression gate in CI)
   ↓
E. INDEPENDENT SIGN-OFF (owner reviews journey results per surface)
   ↓
F. PHASE COMPLETE · journeys protect regressions
```

Phase 3 is dependency-locked to Phase 2 verified state. The journey matrix below is the IMPLEMENTATION BLUEPRINT · authoring the Playwright test files can begin as soon as Phase 2 passes §21 gates.

---

## 1 · Why 10 journeys (not 50, not 3)

The sealed launch directive called for "10+ end-to-end user journeys." The 10 below cover every launch-critical surface in the Scope Reduction doctrine (Chat · Chat Themes · Shop · Community Notice · Directory · Vault). Each journey tests multiple screens, multiple API routes, and at least one monetary or security boundary. Three more are listed as **Candidate +11..+13** for post-launch expansion.

**Design rule:** every journey begins at a clean-state fixture and ends at an observable outcome that would fail obviously if the surface broke. No stub assertions. No "clicked the button and nothing threw" — every journey asserts a specific post-state.

---

## 2 · Reference environment

| Facet | Value |
|---|---|
| Playwright version | 1.49.x (or current LTS at authoring time) |
| Browsers tested | Chromium (baseline) · WebKit (iOS parity) · Firefox (desktop only) |
| Viewports | Mobile 390×844 (iPhone 14) · Desktop 1440×900 |
| Base URL | `http://localhost:3008` (sandbox dev server) |
| Database | Sandbox Supabase `kdstoyyeygcopkogqsyv` |
| Fixture reset | Truncate-+-reseed script before each journey (service-role) |
| Dev impersonation | `NEX_DEV_IMPERSONATE_HANDLE` env var for pre-sign-in state |
| Stripe mode | Test mode with Stripe CLI relay for webhooks |
| TURN mode | Local coturn or bypassed via client-mocking depending on journey |
| Parallelism | 4 workers · journeys split by fixture isolation (no shared DB rows) |
| Retry policy | 1 retry on network-only failures · 0 retries on assertion failures |
| Trace capture | On first retry · trace.zip uploaded to CI artefacts |

---

## 3 · The 10 journeys

### Journey A · New individual user signup → first chat

**Why:** proves the signup pipeline, device-key registration, first-conversation welcome, and the Phase 2 WebRTC send path end-to-end.

**Preconditions:**
- Clean DB (no account with the test email)
- NEX Official sentinel account has registered device keys (Phase 2 requirement)

**Steps:**
1. Visit `/nex-native/create-account` (anonymous)
2. Complete signup form with test email + chat name + country + phone
3. Land on `/nex-native/settings/profile/edit?from=signup` (sealed URL mapping)
4. Fill profile fields (country, interests, socials)
5. Save profile → redirects to `/nex-native/free-chat`
6. First-conversation welcome from NEX Official arrives via WebRTC within 30s (Phase 2 architecture · deferred until first device registration per decision #3)
7. Reply to welcome · reply delivers device-to-device
8. Observe the reply in the sender's local-device message store

**Assertions:**
- `nex_account` row created with correct `display_name`, `country`, `phone_hash`
- `nex_device_key` row created for the first device
- NO row in `nex_peer_message.body` (Phase 2 · content lives device-local)
- NEX Official welcome received and decrypted on client
- `nex_peer_conversation.last_activity_at` updated for the welcome thread
- Reply ACKed within 5s after send

**Blocking severity:** FAIL = launch-blocker (signup is the universal entrypoint)

---

### Journey B · Returning individual user · signin + chat resume

**Why:** proves sign-in restores device-key context, local-device message history is preserved, and WebRTC presence reconnects.

**Preconditions:**
- Journey A completed for a seed user "alice" within the last 24h
- Alice's device-local SQLite store has prior messages

**Steps:**
1. Visit `/nex-native/sign-in` (post-logout entry · sealed Ireland rule)
2. Sign in as alice (face sign-in OR email+password OR WebAuthn)
3. Land on `/nex-native/free-chat`
4. Observe prior conversation list with correct ordering by `last_activity_at`
5. Open the NEX Official conversation · prior welcome message visible from local store
6. Send a new message to a seed peer "bob" (bob is online in this fixture)
7. Message delivers via WebRTC · bob's device receives + ACKs
8. Alice sees "delivered" state
9. Attempt send to a seed peer "charlie" (charlie is OFFLINE in this fixture)
10. Alice sees "failed · recipient offline · try again" (honest delivery state per Phase 2 rule #4)
11. Signout + Signin again · prior history still visible from local store

**Assertions:**
- Prior conversation list has correct ordering (unchanged)
- Local-store message history preserved
- WebRTC delivered state correct for online recipient
- Explicit failure for offline recipient (zero DB rows written for the failed send)
- Signout + Signin preserves local store (does not server-sync history)

**Blocking severity:** FAIL = launch-blocker

---

### Journey C · New business owner setup (7-step shop)

**Why:** proves `/nex-native/manage/shop/setup` 7-step flow, draft persistence, country-aware pricing, business device-key registration.

**Preconditions:** Alice has signed up (Journey A). No business row for Alice yet.

**Steps:**
1. From `/nex-native/free-chat`, navigate to shop setup via side menu
2. Step 1 · Business basics (name, category, slug)
3. Step 2 · Location + country
4. Step 3 · Business photo upload (image goes to `nex-business-public-assets` · Phase 2 decision #1)
5. Step 4 · Opening hours + contact
6. Step 5 · Delivery scope + pickup options
7. Step 6 · Payment setup (Stripe Connect onboarding link via R31)
8. Step 7 · Review + publish
9. Business row published · Alice's device-key extended to `owning_entity_type='business'` (Phase 2 N4)
10. Navigate to `/nex-native/{slug}` · business page renders the uploaded photo + info
11. Country-aware pricing shows EUR for Ireland fixture, IDR for Indonesia fixture (parameterised)
12. Draft persistence test: close browser mid-step-3 · reopen · step-3 state preserved

**Assertions:**
- `nex_business` row has correct `display_name`, `slug`, `country`, `owner_account_id`
- Business photo URL in `nex-business-public-assets` (NOT in `nex-peer-chat-attachments`)
- `nex_device_key` has new row with `owning_entity_type='business'`
- `/nex-native/{slug}` renders publicly without authentication (SSR + crawlable)
- Stripe Connect account_id captured from onboarding callback
- Draft persistence survives tab-close

**Blocking severity:** FAIL = launch-blocker (business setup is the seller entrypoint)

---

### Journey D · Existing business owner edits product + inquiry chat

**Why:** proves product management, buyer discovery, peer-chat inquiry with product reference (Phase 2 attachment_meta shape · opaque product_handle), live product resolution.

**Preconditions:** Alice's business from Journey C has one `live` product.

**Steps:**
1. Alice signs in · goes to `/nex-native/manage/products`
2. Edits product name + price_pence · saves
3. Signs out
4. Buyer "bob" signs in (separate account)
5. Discovers Alice's product via `/nex-native/directory` or search
6. Opens the product page · observes updated name + price
7. Taps "Ask seller" · composer opens pre-populated with product reference
8. Sends inquiry · message delivers to Alice via WebRTC
9. `attachment_meta` on the message carries `{product_handle: {business_slug, product_id}}` ONLY (Phase 2 F-3 compliance · no price snapshot)
10. Alice (online fixture) receives · her chat UI fetches the live product via handle · renders card with current (edited) name + price
11. Alice replies · bob receives

**Assertions:**
- Product update persisted in `nex_product`
- Directory search returns the updated product
- Chat message `attachment_meta` carries NO price, name, image, or business data (only handle)
- Alice's render fetched live product via authenticated session (verify network trace)
- No `nex_peer_message.body` plaintext row created · ciphertext travelled device-to-device

**Blocking severity:** FAIL = launch-blocker (product discovery drives commerce)

---

### Journey E · Buyer checkout · full path to Stripe destination charge

**Why:** proves F-3 price-trust fix (Phase 1 G1) + Stripe Connect destination-charge flow + webhook deferral + Path A order creation.

**Preconditions:**
- Alice's business has Stripe Connect `charges_enabled=true`
- Alice has one product at €25.00 (`price_pence=2500`)
- Stripe CLI relay configured

**Steps:**
1. Bob signs in · adds product to cart · reaches `/nex-native/cart`
2. Taps checkout · POST `/api/.../billing/checkout/buyer` with `{productId, quantity: 1}`
3. **Verify** server-side price resolution: `unit_amount` in Stripe session = 2500 (not client-crafted)
4. Bob redirects to Stripe-hosted Checkout
5. Pays with Stripe test card `4242 4242 4242 4242`
6. Stripe fires `checkout.session.completed` + `payment_intent.succeeded` to webhook
7. Webhook processor (Del 6 · Phase 2) resolves `nex_item_product_ids` from metadata
8. Path A: creates `nex_order` + `nex_order_item` rows with server-verified prices (NOT Stripe line_items prices)
9. Bob redirects to `/nex-native/{alice-slug}?checkout=success`
10. Bob's order appears in `/nex-native/orders` · status "paid"
11. Alice's `/nex-native/manage/orders` shows the new order with buyer details
12. Chat message to Alice from bob contains ONLY `{order_handle: {order_id}}` reference
13. Alice opens the order from chat · renders the full order via her authenticated session

**Attack-path assertions (from Phase 1 G1 F-3):**
- Repeat with manually crafted request `{productId, quantity: 1, amountMinor: 1}` → 400 bad_request (new shape rejects)
- Repeat with `{productId: belongsToOtherBusiness}` in Alice's cart → 400 product_business_mismatch
- Repeat with a `draft` product → 409 product_not_purchaseable
- Repeat with `sold_out` stock → 409 product_sold_out

**Assertions:**
- Stripe session created with server-resolved `unit_amount=2500`
- `nex_order` row created with server-verified `total_pence=2500`
- `nex_order_item` row has `price_pence=2500` (per Path A · not from chat snapshot)
- Chat message between buyer + seller has `attachment_meta.order_handle.order_id` only
- No row in `nex_message.body` (business chat under Phase 2)

**Blocking severity:** FAIL = launch-blocker (every paid transaction depends on this path)

---

### Journey F · Seller fulfillment · mark order sent + buyer sees update

**Why:** proves order state transitions outside chat (Phase 2 sealed · chat does NOT carry order updates), order presence signals, buyer notification.

**Preconditions:** Journey E completed · one `paid` order.

**Steps:**
1. Alice signs in · goes to `/nex-native/manage/orders/{orderId}`
2. Marks "dispatched" + optional tracking note
3. `nex_order.status` transitions `paid` → `dispatched`
4. Order-update presence signal pushed to bob's device (content-free notification per Phase 2 rule #7)
5. Bob's app wakes · fetches live order via authenticated session · UI updates to "dispatched"
6. Alice later marks "delivered"
7. Same presence-signal pattern · bob's UI updates
8. Verify: NO chat message carries "order dispatched" body or details · chat is used ONLY for optional messages between buyer + seller

**Assertions:**
- `nex_order.status` transitions correctly
- No `nex_peer_message` row created for order status transitions
- Push notification payload is content-free (`{type: "order_update", order_id, timestamp}` only)
- Bob's UI reflects live order state (authenticated fetch, not stale snapshot)

**Blocking severity:** FAIL = launch-blocker (the order lifecycle must be independently observable without chat)

---

### Journey G · Chat theme purchase (Stripe one-time)

**Why:** proves Stripe one-time payment for Chat Themes (R33 theme endpoint · owner-sealed €3.99), entitlement write post-webhook, theme-ownership read.

**Preconditions:** Alice signed in · no theme ownership rows yet · one premium theme available.

**Steps:**
1. Visit `/nex-native/chat-themes-library`
2. Tap a premium theme · theme-purchase modal opens
3. POST `/api/.../billing/checkout/theme` with `{themeId, themeName}`
4. Server creates Stripe Checkout Session (mode=payment) · €3.99 EUR
5. Alice pays with test card
6. Stripe fires webhook · processor writes `nex_theme_ownership` row for Alice
7. Alice redirects to theme library · theme shows "owned"
8. Alice applies the theme to her chat with bob
9. Bob's chat with Alice renders the theme (theme is a visual asset for the conversation)

**Assertions:**
- Stripe session created with `unit_amount=399` (sealed price)
- `nex_theme_ownership` row persisted post-webhook
- Theme library UI reflects ownership
- Theme applied in chat UI

**Blocking severity:** FAIL = launch-blocker (chat themes are one of five launch surfaces)

---

### Journey H · Storage upgrade (Stripe recurring)

**Why:** proves recurring storage-pack subscription (R33b pack endpoint), entitlement + metering update, in-app pack upgrade button honest UX.

**Preconditions:** Alice signed in · business has `storage_bytes_used` tracked.

**Steps:**
1. Visit `/nex-native/settings/storage`
2. Observe current storage usage display
3. Tap "Upgrade" on `pack_5gb` card
4. POST `/api/.../billing/checkout/pack` with `{packKey: "pack_5gb"}`
5. Server creates recurring Stripe Checkout Session
6. Alice completes checkout with test card
7. Stripe webhook fires `invoice.payment_succeeded` + `customer.subscription.created`
8. Processor updates `nex_business.storage_pack_tier` (or equivalent entitlement row)
9. Alice's storage UI reflects new cap (+5 GB over base)
10. Verify billing lifecycle: upcoming renewal · trial-end-notification · cancel flow

**Attack-path assertions:**
- Retry POST with same `packKey` · idempotent (same session returned)
- Different account, same pack · separate session

**Assertions:**
- Stripe recurring subscription created with correct `price_id` per region
- `nex_business` storage entitlement updated
- Storage UI reflects new cap
- Cancel flow present + testable

**Blocking severity:** FAIL = launch-blocker (storage upgrade is the monetisation beyond base Shop subscription)

---

### Journey I · Failed subscription retry · past_due → recovery

**Why:** proves the entitlement engine correctly denies access during past_due + recovery, honest user communication, past_due → active transition on card retry success.

**Preconditions:** Alice has an active Shop subscription in Stripe test mode.

**Steps:**
1. Trigger `invoice.payment_failed` webhook (Stripe CLI `stripe trigger`)
2. Processor transitions `nex_account.shop_status` to `past_due`
3. Alice's app shows "payment issue · please update your card" (honest state)
4. Alice can still access Shop for 7-day grace window (per sealed entitlement rule)
5. After 7 days (or trigger `invoice.payment_failed` with retry exhausted) → `expired`
6. Shop access blocked with explicit "subscription expired" UX
7. Alice updates card · triggers `invoice.payment_succeeded` → back to `active`
8. Shop access restored

**Attack-path assertions:**
- Access-blocking adverse events (dispute · fraud) correctly enforced · verified via Phase 1 F-1 billing table (now RLS-protected after G2)
- Past-due state not readable via anon/authenticated PostgREST query (Phase 1 F-1 verification)

**Assertions:**
- `nex_billing_event_log` records every webhook event idempotently
- `nex_billing_adverse_event` created for the failed payment (if applicable per policy)
- Entitlement transitions follow the sealed rule
- User-facing state matches DB state
- `nex_billing_*` tables not readable by anon via PostgREST (Phase 1 F-1)

**Blocking severity:** FAIL = launch-blocker (subscription recovery is critical for revenue)

---

### Journey J · Admin HQ workflow · lock + communicate + unlock

**Why:** proves HQ admin tooling (admin-grant authorisation, HQ Direct Channel under Phase 2 full-E2E), audit trails, and non-exposure of HQ messages as plaintext.

**Preconditions:** HQ staff member "admin1" has an authenticated account + registered device key (Phase 2 N4).

**Steps:**
1. admin1 signs in · navigates to `/nex-native/hq` (HQ-admin-gated workspace · desktop-only ≥900px per sealed memory)
2. Admin searches for a user "troublemaker" who violated policy
3. Admin opens troublemaker's profile · initiates a direct-message channel (`nex_hq_direct_channel.upsert`)
4. Admin writes a warning message · submits
5. HQ message delivers via WebRTC from admin1's device to troublemaker's device (Phase 2 rule #3 · no server-stored content)
6. If troublemaker is offline, admin1 sees "user offline · try again" (honest UX per rule #4)
7. Admin applies a temporary lock to troublemaker · `nex_account.is_locked=true`
8. Troublemaker sees locked state on next action
9. Admin unlocks after acknowledgment

**Assertions:**
- HQ message NOT persisted as server-side plaintext or ciphertext
- `nex_hq_direct_channel` tracker row created (metadata only · no content)
- Lock + unlock audit trail in `nex_admin_grant_log` (or equivalent)
- Troublemaker's UI reflects lock state within 30s
- No HQ bypass of chat privacy architecture (per sealed decision #4)

**Blocking severity:** FAIL = launch-blocker (HQ moderation is required for operator duty of care)

---

### Candidate +11..+13 (post-launch · not required for launch but logical next additions)

| # | Journey | Scope |
|---|---|---|
| +11 | Account deletion | GDPR Art 17 flow · device-local data + server metadata cascade |
| +12 | Account export | GDPR Art 20 flow · export to user's device · no new server copies |
| +13 | Community notice board | Community Notice surface flow |

---

## 4 · Fixture plan

### 4.1 Seed accounts

Each test suite seeds a fixed set of accounts with deterministic UUIDs so journeys can reference each other without coupling:

| Role | Handle | UUID | Country | Device state |
|---|---|---|---|---|
| Individual · online | alice | `11111111-aaaa-4aaa-aaaa-111111111111` | Ireland | 1 device registered, online |
| Individual · online | bob | `22222222-bbbb-4bbb-bbbb-222222222222` | Ireland | 1 device registered, online |
| Individual · offline | charlie | `33333333-cccc-4ccc-cccc-333333333333` | Indonesia | 1 device registered, offline |
| Business owner | alice (same account · owns business) | same as above | Ireland | Business device-key added |
| Troublemaker | troublemaker | `44444444-dddd-4ddd-dddd-444444444444` | Worldwide | 1 device, online |
| HQ admin | admin1 | `55555555-eeee-4eee-eeee-555555555555` | Ireland | 1 device, online · admin role granted |
| NEX Official sentinel | nex-official | `11111111-aaaa-aaaa-aaaa-111111111111` (sealed) | — | 1 permanent device-key, always online |

### 4.2 Seed businesses

One business per owner · published state · one product at €25.00.

### 4.3 Reset strategy

- **Between suites:** full truncate + reseed (service-role · ~5s)
- **Between journeys in same suite:** targeted cleanup of mutation surfaces (new orders · new messages · new product edits) · faster
- **Local-device stores:** cleared via `localStorage.clear()` + IndexedDB wipe before each journey that exercises client state

### 4.4 Fixture file layout

```
tests/e2e/
  fixtures/
    seed-accounts.ts
    seed-businesses.ts
    seed-products.ts
    reset.ts
    stripe-mock.ts
    turn-mock.ts (local coturn or WebRTC bypass)
  journeys/
    a-new-individual-user.spec.ts
    b-returning-individual.spec.ts
    c-new-business-owner.spec.ts
    d-business-owner-edit-and-inquiry.spec.ts
    e-buyer-checkout-full.spec.ts
    f-seller-fulfillment.spec.ts
    g-chat-theme-purchase.spec.ts
    h-storage-upgrade.spec.ts
    i-failed-subscription-recovery.spec.ts
    j-admin-hq-workflow.spec.ts
  playwright.config.ts
```

---

## 5 · Parallel-execution strategy

### 5.1 Can parallelise

Journeys A, B, C, G, H can run in parallel (independent fixture state).

### 5.2 Cannot parallelise

- **D depends on C's output** (business + product). Chain D after C.
- **E depends on D's output** (product). Chain E after D.
- **F depends on E's output** (order). Chain F after E.
- **I requires dedicated Stripe test clock** (past_due simulation). Run serially.
- **J requires HQ fixture state stable throughout**. Run in own worker.

### 5.3 Worker assignment

| Worker | Journeys |
|---|---|
| W1 | A → B |
| W2 | C → D → E → F |
| W3 | G |
| W4 | H → I |
| W5 | J |

5-worker configuration · cold-start ~3 min · full suite ~12-15 min after Phase 2 build.

---

## 6 · CI integration

### 6.1 Trigger

- On every push to any branch
- On PR open against `main` or `nex-ireland-build-*`
- Nightly against `main`

### 6.2 Gate

- PR gate: all 10 journeys must pass on Chromium+Mobile · WebKit as advisory
- Nightly gate: all 10 + WebKit mandatory · surface any OS-level regression

### 6.3 Artefacts

- Playwright HTML report · trace.zip for every failure · video for failures only (no video for passes, saves bandwidth)
- Store 30 days

---

## 7 · What Phase 3 build WILL need

Blockers currently preventing Phase 3 B (implementation):

| Blocker | Resolution path |
|---|---|
| Phase 2 architecture not live | Phase 2 implementation + verification (12-16 weeks) |
| Local-device store not built | Phase 2 TO BUILD item · local SQLite/IndexedDB store |
| WebRTC signaling + presence not built | Phase 2 TO BUILD · N2/N3 migrations + endpoints |
| TURN relay not provisioned | Phase 2 D-5 owner decision + provider onboarding |
| Business device-key UX not built | Phase 2 N4 + UX work |
| Path A order separation not implemented | Phase 2 TO BUILD · depends on D-decisions |
| F-3 server-side price validation | ✅ Delivered in Phase 1 G1 (`5187185d`) |
| Billing RLS correctness | ⏸ Phase 1 G2 pending |
| Rate-limit infra | ⏸ Phase 1 G3 pending |

### Build order if Phase 2 lands

Once Phase 2 verified:
1. **Week 1** · Playwright config + fixture infrastructure
2. **Week 2** · Journeys A + B (foundation)
3. **Week 3** · Journeys C + D (business flows)
4. **Week 4** · Journeys E + F (commerce flows)
5. **Week 5** · Journeys G + H (monetisation flows)
6. **Week 6** · Journeys I + J (edge + admin)
7. **Week 7** · CI integration + stabilisation
8. **Week 8** · First full green run + handoff

**Rough effort: 6-8 weeks** after Phase 2 ships.

---

## 8 · What this document does + does NOT do

### Does
- Scope Phase 3 to 10 concrete journeys
- Define each journey's preconditions, steps, assertions, severity
- Define reference environment + parallel strategy + CI gate
- Enumerate Phase 2 dependencies that gate Phase 3 B
- Estimate 6-8 weeks after Phase 2

### Does NOT
- Author any Playwright code
- Create any fixture file
- Run any test
- Authorise Phase 3 implementation (requires Phase 2 verified)
- Claim any journey is currently tested

---

**End of Phase 3 research deliverable.**
