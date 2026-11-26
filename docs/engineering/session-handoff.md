# Session Handoff

**One record. The next session reads this first.**

Keep this file short. It answers: Where are we? What is safe to do next?
What requires the owner before continuing?

---

## Current state · 2026-11-26 (continuation · L-043 Chat-pillar hydration pattern-hunt landed · BUILT · typecheck clean · verify blocked on host disk)

**Where we are.** Agent-A pattern-hunt from L-036/L-042 extended into the Chat pillar per Rule 4. Three edits applied to `src/app/nex-native/chat/_portrait-bloom-shell.tsx`:

1. `formatBubblePrice` at `:4375` — bare `majors.toLocaleString()` pinned to `"en-US"` (SSR/CSR locale divergence, affects 7 inline price-bubble call sites).
2. New `<ClientMessageTime iso={...} />` wrapper added right after `formatTime` — `useState<string>("\u2007\u2007\u2007\u2007\u2007")` (5 figure-spaces, same width as "HH:MM") seed + `useEffect` swap to `formatTime(iso)`. Addresses host-tz vs viewer-tz divergence that the existing `"en-US"` locale pin cannot fix.
3. Call-site swaps at `:1799` and `:2059` route message bubbles through `ClientMessageTime` instead of the render-time `formatTime(m.sent_at)`.

`npx tsc --noEmit` exit 0 (background job `bzpmo7won`).

**Pattern-hunt scope-seal.** Of 7 Agent-A findings in the bloom shell: 2 real hazards fixed (#4 bare toLocaleString, #5 timezone drift under pinned locale), 4 pinned-locale sites deferred as defensive polish (modern Node ICU low real risk: #1 themes en-IE, #2 themes launcher en-IE, #6 bloom-shell price-input id-ID, #7 guest-chat en-US), 1 Agent-A false positive ruled out (#3 Shop product detail — `export default async function Page` Server Component, SSR-baked string, zero mismatch surface — NOT touched).

**L-043 status:** BUILT · VERIFICATION BLOCKED (host disk 97 MB · reclaim crosses owner host-boundary per L-041). Regression spec deferred to same fixture-seed phase as L-041/L-042 (chat-peer mounts require seeded account + peer + message fixtures). No sealed invariant touched — device-only Chat storage + E2E encryption + bubble DOM contract all preserved; only SSR-first-paint content changed to match post-hydration output.

**Safe next engineering steps within existing authority:**
1. On host-disk reclaim (owner stops dev :3008 + deletes `.next/` ~ regenerable): run the joint L-041 + L-042 + L-043 verification pass.
2. Continue the autonomous Chat/Shop/Themes end-to-end work per owner directive — specifically the next unfinished authorised ledger row (per Rule 1 startup procedure).
3. L-012 clean full regression rerun on reclaimed disk.

**Owner-gated items (unchanged):** L-004 credentials · L-005 mig 207/257 decision · L-006 F2 batch · host-disk reclaim.

**Git state:** working-tree changes limited to `src/app/nex-native/chat/_portrait-bloom-shell.tsx` (L-043 edits) + `docs/engineering/NEX-DELIVERY-LEDGER.md` (L-043 row + decision log) + this handoff. No commits. No pushes. No migrations. No product-code changes outside the single file named above.

---

## Current state · 2026-11-26 (continuation · P-ledger-close · L-001 + L-002 + F.2 promoted · parallel pillar audits running)

**Where we are.** Two P0 ledger items closed this cycle: **L-001 (permanent rulebook + startup enforcement) VERIFIED** and **L-002 (post-regression failure register · 74 failures classified) VERIFIED**. Failure register reconciled against same-day ledger progress — §A (54 Live-Commerce) OBSOLETE after L-027 project removal · §B (8 SOS) CLOSED by L-007 · §C (5 /welcome) BLOCKED-AT-APPROVAL (L-006 F2) · §D (1 authed-home) RECLASSIFIED-SKIPPED (L-024) · §E (2 welcome-cookie) FLAKY-DEV-HMR (L-028 · needs prod-build recheck) · §F.1 (1 directory timeout) CLOSED by L-003 · §F.2 (1 theme-viewer organic-signup) promoted LIKELY-FIXED → **VERIFIED CLOSED** using `tests/e2e/_runs/20261125T203207Z-L003-adjacent-verify.log:5` (✓ 4.5s).

**Net launch-critical open failures:** 5 (all in §C · single-blocker on F2 approval phrase per `docs/engineering/l006-f2-approval-request-2026-11-26.md`).

**L-042 pattern-hunt scope-seal** (carried from prior session): merchant orders list hydration fix BUILT at `src/app/nex-native/manage/orders/_client.tsx:77-83` (`ClientRelTime` wrapper) + call-site swap at `:388`. Regression spec `tests/e2e/regression-l042-orders-list-hydration.spec.ts` wired into `playwright.config.ts:157`. VERIFICATION BLOCKED on host disk (currently 353 MB free on `C:` · up from 97 MB but still tight for new Playwright runs).

**Parallel agents launched this cycle (read-only pillar audits):**
- Agent A — **Pillar hydration pattern-hunt extension**: extend L-036/L-042 scan to Chat + Shop + Themes surfaces (not merchant orders). Reports real hazards + false positives. Scope excludes HQ and already-covered surfaces.
- Agent B — **Drawer-row code-level evidence audit**: map which cells of the 18×4×3 L-041 matrix can be answered by code reading alone vs require browser. Promotes L-041 toward CODE-INSPECTED-NOT-BROWSER-VERIFIED intermediate. (Report pending at handoff write.)

**Safe next engineering steps within existing authority:**
1. On host-disk reclaim (owner stops dev :3008 + deletes `.next/` ~ regenerable): run `npx playwright test --reporter=list tests/e2e/regression-l042-orders-list-hydration.spec.ts tests/e2e/journey-drawer-rows-signed-in-merchant-ie.spec.ts --project=stage-a-pixel7 2>&1 | tee tests/e2e/_runs/$(date +%Y%m%dT%H%M%SZ)-L041-L042-verify.log; echo "EXIT=${PIPESTATUS[0]}"`. This promotes L-042 BUILT → VERIFIED and L-041 PARTIAL → VERIFIED for the merchant-IE cell at least.
2. Act on Agent A / Agent B reports when they return — fix real hazards within authority (ClientDateTime wrapper pattern for hydration; code-inspected drawer cells that reveal dead routes can be either marked for F2-batch inclusion or fixed if not retirement-related).
3. L-012 clean full regression rerun on reclaimed disk.

**Owner-gated items (do not cross without named approval):**
- L-004 Stripe + PayPal credentials (T10 positive-path)
- L-005 mig 207/257 reconciliation decision (`APPROVE OPTION A FILE REVIEW` / `OPTION B` / `OPTION C` / `HOLD`)
- L-006 F2 `/create-account` emitter migration + `welcome/page.tsx` restore
- Host-disk reclaim (stop dev :3008, delete `.next/` ~ 2.8 GB)

**Git state at cycle end:** clean working-tree except for in-cycle doc edits:
- `docs/engineering/NEX-DELIVERY-LEDGER.md` (L-001 + L-002 rows + F.2 correction)
- `docs/engineering/post-regression-failure-register-2026-11-26.md` (added §K reconciliation)
- `docs/engineering/session-handoff.md` (this update)

No commits made. No pushes made. No migrations applied. No product-code changes.

---

## Current state · 2026-11-26 (continuation · BLOCKED-PENDING-SEED remediation cycle · +14 tests promoted)

**Where we are.** Nine spec files promoted from historical `BLOCKED-PENDING-SEED` skips to real browser-verified passes via the sandbox-test-harness pattern. Zero product-code weakening. Zero sealed-invariant break. Every fixture torn down with `assertNoResidualFixtures`.

**Promoted this cycle** (all VERIFIED in `NEX-DELIVERY-LEDGER.md`):
- L-015 `journey-chat-send-e2e` composer-renders · 3 passed
- L-016 `journey-signed-out-browse-buy-auth-gate` buy-gate · 2 passed
- L-017 `journey-buyer-checkout` direct product + add-to-cart · 2 passed
- L-018 `journey-buyer-signed-out-purchase-resume` full guest→Dev Pass→refresh · 5 passed (+ step-8 nav-resilient `waitForFunction` fix)
- L-019 `journey-mid-shop-setup-interrupt-resume` dispatcher · 3 passed
- L-020 `journey-buyer-ordinary-signin` next-preservation + malicious-next · 4 passed (+ `hydrateEnv()` for `.env.local` admin creds)
- L-021 `journey-buyer-signup-wiring` non-mutating wiring inspection · 3 passed
- L-022 `journey-buyer-adversarial` 5 adversarial regressions · 6 passed + 1 honest cart-dedup skip (inner-describe cookie re-seat + Cycle-7 settle)
- L-023 `nav-dead-link-crawl` direct shop + product reachability · 7 passed

**Remaining BLOCKED-PENDING-SEED skips are owner-gated, not fixture-gated.** Catalogued but not portable within current authority:
- `journey-mid-checkout-session-expired`, `journey-buyer-checkout` sibling tests — `BLOCKED-ON-MIG-354-365` (owner-approval migration gate)
- `journey-vault-standalone-access` — `BLOCKED-ON-MIG-207-257` (owner-approval, L-005 pending)
- `journey-stripe-webhook-t10`, `journey-paypal-webhook-t10`, `journey-payment-status-t10` — `BLOCKED-PENDING-CONFIG` (L-004 pending credentials + `mig 320/366`)
- `journey-first-user-A-to-contacts` outbound-message, `journey-chat-send-e2e` offline-outbox/retract/delete-for-me — `BLOCKED-PENDING-SECOND-TEST-ACCOUNT` send-flow (would be building, not porting; chat-send product path still broken per task #74 investigation)
- `journey-chat-theme-first-free-apply`, `journey-chat-theme-apply-free` — owner approval for DB-seeded theme fixture
- `journey-chat-attachment-legacy-public-envelope-resolve` — Stage A §3 owner-approved seeding
- `journey-directory-browse-and-filter` — sealed-deferred until Directory re-opens at 500-active-seller threshold
- `location-permission-explanation-card` — scope-skipped; Emergency Help not active launch feature
- `pwa-install-cadence` dismiss-cooldown — hard-coded skip; fixture needs register→contacts→interaction gate
- `bio-link-mobile` non-discoverable handle — needs seeded `nex_handle` + `is_discoverable=false` fixture; trade-off not pursued in cycle
- `diagnostic-ask-seller-send-handler` — intentionally diagnostic-only per its own header

**Safe next engineering steps within existing authority:**
1. Proceed to higher-priority ledger items — L-002 (failure-register classification), L-009 (live-commerce 54 failures triage), L-010 (per-combination nav evidence), L-012 (preserved full regression rerun).
2. For L-009: open `docs/engineering/post-regression-failure-register-2026-11-26.md` (if present) to classify live-commerce failures as fixture-missing vs feature-incomplete per Rule 8 taxonomy.

**Owner-gated items (do not cross without named approval):**
- L-004 Stripe + PayPal credentials
- L-005 mig 207/257 reconciliation decision
- L-006 F2 `/create-account` emitter migration + `welcome/page.tsx` restore

**Git state at cycle end:** clean working-tree except for in-cycle doc + test-file edits enumerated in ledger L-015 through L-023. No commits made. No pushes made. No migrations applied.

---

## Current state · 2026-11-25 (Cycle 14 continuation — T5-T10 FIXTURE HARNESS LANDED; T8 + T10 SPECS AUTHORED + PASSING)

### T5-T10 fixture-harness cycle (within existing authority · no commits yet)

- **Fixture harness built**:
  `tests/e2e/_fixtures/sandbox-test-harness.ts` +
  `tests/e2e/_fixtures/README.md` +
  `tests/e2e/fixture-harness-smoke.spec.ts`.
  - Sandbox-ref guard (hard-stops on prod ref or unknown ref).
  - Pooler URL preferred when username encodes sealed sandbox ref;
    falls back to `SANDBOX_DATABASE_URL`.
  - `createTestAccount` / `createTestBusiness` / `createTestProduct` /
    `createTestOrder` + `TestOrderHandle`.
  - `teardownAll` runs reverse-FK order (events → orders → products →
    businesses → accounts + auth.users).
  - `reclaimAbandonedTestRecords` cleans rows older than 1h with the
    `e2e-fixture-` marker.
  - `createTestProduct` supplies mig-239 fallback values
    `department_id='everything_else'` / `category_id='other'` to satisfy
    the sealed 30-dept CHECK constraint.
  - Smoke test PASS: round-trip create+teardown against sandbox.
- **T8 merchant-order spec** authored: `journey-merchant-order-t8.spec.ts`
  (previously NO SPEC) · 1 PASS. Covers nex_order persistence, event
  trail, business.owner_account_id ownership, service-role state
  transition `created → pending`, anon RLS leak probe.
- **T10 payment-status + notifications spec** authored:
  `journey-payment-status-t10.spec.ts` (previously NO SPEC) · 2 PASS.
  Covers `nex_order.payment_method` CHECK enforcement (mig 320), honest
  "NEX does not verify funds" claim via auditable 'paid' event (mig
  005), notification dedup via partial UNIQUE index (mig 366 · Postgres
  error code 23505), leak-safe title/subtitle payload.

### Unfiltered typecheck + lint (per reporting-correction)

- `npx tsc --noEmit` ran full project: 1397 errors across the pre-
  existing codebase. **Zero errors in files authored this cycle**
  (`sandbox-test-harness.ts`, `fixture-harness-smoke.spec.ts`,
  `journey-merchant-order-t8.spec.ts`, `journey-payment-status-t10.spec.ts`).
- Lint: **not configured in this repo** · no `.eslintrc`,
  no `eslint.config.*`, no `"lint"` npm script. Reported honestly
  rather than claiming a passing lint.

### T5-T7 reruns (skip reasons documented, not fixture-related)

- **T5 create-shop** (`journey-create-shop.spec.ts`): BLOCKED-PENDING-SEED
  comment in spec; harness unblocks the write but spec body still needs
  rewire to use it — out of simple "rerun" scope.
- **T6 directory** (`journey-directory-browse-and-filter.spec.ts`):
  sealed DEFERRED (directory hidden until 500-seller launch threshold).
- **T7 ask-seller** (`journey-ask-seller-nonowner-full.spec.ts`): skips
  without `NEX_E2E_SEED_SHOP_SLUG` + `NEX_E2E_SEED_PRODUCT_ID` env vars.

### Directory perf baseline (DELIVERED · no code changes applied)

- 3 dev samples: ~23s total body / 130ms TTFB / 380 KB body →
  effective 17 KB/s = stalled RSC stream, NOT bandwidth.
- Prod build: TTFB 30ms, body still ~22s → NOT dev overhead.
- Root cause: ~10 serial round-trips/request including a `pg.Pool`
  canonical read to eu-west-1 from Windows dev box;
  `dynamic = "force-dynamic"` pays full cost every request.
- **Cleanup owed**: prod server left running on :3011 (background
  `bwlo1ijai`), plus `.tmp-directory-response.html` and
  `.tmp-prod-server.log` — sandbox-denied agent cleanup.

### Durable in-repo audit records · 2026-11-25

- **Mig 207/257 inspection**: `docs/doctrine/mig-207-257-review-2026-11-25.md`
  (see §11 Addendum for the 2026-11-25 ground-truth evidence).
  Both migrations additive. **Ground-truth finding** (read-only sandbox
  probe via `scripts/_investigate/mig-207-ground-truth.mjs` +
  `migration-history-gap.mjs`):
  (a) all 3 mig 207 columns PRESENT on `nex_account`
  (`onboarding_step`, `shop_theme_id`, `vault_trial_used_at`) — 207
  was in fact applied despite missing its own history row;
  (b) mig 257 is **partially** applied — only 2 of 9 declared columns
  present (`shop_tier`, `shop_status`); the other 7 (`shop_period_end`,
  `shop_past_due_at`, `vault_*`, `business_trial_status`) are MISSING;
  (c) 152 migration files on disk have no corresponding
  `nex_migration_history` row — the recording gap is systemic, not
  isolated to 207;
  (d) 11 bisnis accounts all carry `bisnis_expires_at = NULL`, NOT the
  sentinel/dated values mig 257 Part 6 hard-asserts — so mig 257 cannot
  be re-run as-written without either amending the preconditions or
  owner-named correction of the underlying data. Correction plan is
  **Step A only** auto-safe (back-date the single 207 history row);
  Steps B-D require named owner approval.
- **PayPal integration audit**:
  `docs/doctrine/paypal-integration-audit-2026-11-25.md`. Architecture
  is merchant-direct and sealed; webhook verification is live-wire
  and fail-closed; idempotency is correct via `nex_order_event`
  metadata JSONB containment. **Five activation blockers**:
  (1) mig 336 PROPOSAL not applied · (2) no Partner Referrals
  onboarding flow · (3) no merchant-initiated refund UI/API · (4) no
  partial refund support · (5) no `PAYPAL_ENV=live` activation seal.

### Still pending · require owner approval, NOT executed

- **Migration 207/257 reconciliation** on sandbox ref `kdstoyyeygcopkogqsyv`
  — supersedes the earlier "apply 207/257" line. The ground-truth
  evidence (see Durable Audit Records above) shows 207 is already
  applied, 257 is 2-of-9 partial, 152 files have no history row, and
  the Part 6 bisnis expiry asserts no longer match the data.
  Reconciliation requires an owner-named plan: Step A = back-date the
  single 207 history row (auto-safe); Step B = decide whether to
  back-fill the 152 missing rows or reset the recorder; Step C =
  decide whether mig 257 is forward-ported with revised preconditions
  or the 7 missing columns are added via a fresh migration; Step D =
  reconcile 11 bisnis-tier expiry rows. Steps B-D all need the owner
  before any write.
- **PayPal audit activation** — 5 blockers captured in the durable
  audit (mig 336 apply · Partner Referrals onboarding · merchant
  refund path · partial refunds · `PAYPAL_ENV=live` seal).
- **Perf fix for /directory** — any change must carry a verified
  measurement + regression test + required CI check + blueprint entry
  per CLAUDE.md §10. Out of scope for a journey/fixture cycle.
- **Commits + pushes** — no code committed; next-cycle spec-author
  must either commit the harness + T8/T10 specs (with owner trigger)
  or the harness will not survive a session.

### T1 ratchet (preserved from earlier continuation)

- **BLOCKER-NAV-001 RESOLVED** within existing authority. `.env.local`'s
  `DATABASE_URL` is a pooler URL whose username encodes sandbox ref
  `postgres.kdstoyyeygcopkogqsyv`. Each affected spec now carries a
  `resolveSandboxDbUrl()` helper that validates username ref ==
  `SANDBOX_REF` before preferring pooler over the IPv6-only direct URL.
- **Vault spec**: 3 PASS + 3 SKIP (zero FAIL). `vault_tier` column
  absent in sandbox → per-scenario `test.skip(!hasColumn('vault_tier'))`
  gates for scenarios 1 (paid vault_tier), 4 (active trial · select
  errors when any column is missing), 6 (gratis sentinel).
- **Theme-signup specs**: both PASS (previously BLOCKED on IPv6).

### T5-T10 journey survey (within existing authority)

- **T5 create shop**: 1 PASS + 3 SKIP (test account already provisioned).
- **T6 discovery**: 1 PASS + 6 SKIP (empty catalogue).
  Also: `/nex-native/directory` ttfb 0.14s but total body 22.8s via curl.
  Perf concern, not a regression. Not fixed here (§10 gate).
- **T7 Ask-Seller**: 1 PASS + 2 SKIP (needs seeded product fixture).
- **T8 merchant order**: **NO SPEC EXISTS** — zero e2e coverage.
- **T9 checkout**: 2 PASS + 4 SKIP + 1 FAIL (fail is preamble goto to
  slow `/directory` route; URL-shape assertion never reached).
- **T10 payment status + notifications**: **NO SPEC EXISTS**.

Common gating factor T5-T10: sandbox has no seeded fixture data
(products, orders, checkout sessions, merchant accounts). Journeys
stay PARTIAL at journey level even where routes are MAPPED. T8+T10
require spec authoring + fixture seeding + (T10) webhook simulation.

### Historical state preserved below (superseded by sub-sections above)

## Current state · 2026-11-25 (Cycle 14 continuation — T1/T2/T3/T4 complete, T5-T10 BLOCKED on DB IPv6)

**Cycle-14 continuation outcome** (post IAV approval, pre commit/push authorisation):

- **T1 · Run F2 + F1 Playwright** — COMPLETE with mixed results.
  - PASS: `journey-visitor-claim-signup.spec.ts` × 2 (after polling-dispatch
    hydration-race fix).
  - SKIPPED with named blocker: `journey-guest-chat-signup-cta.spec.ts`
    (needs provisional-session fixture + seeded owner-account row;
    F2 fix evidenced at source `_guest-chat-client.tsx:114` + catalogue
    defence `product-knowledge.test.ts:74-85`).
  - BLOCKED on **BLOCKER-NAV-001** (IPv6-only sandbox direct DB):
    `journey-vault-standalone-access.spec.ts` × 6,
    `journey-full-guest-signup-pick-theme.spec.ts`,
    `journey-selected-theme-cookie-signup.spec.ts`. Specs reinforced
    with dynamic column probing to tolerate pre-mig-257 schema.

- **T2 · Navigation inventory** — COMPLETE. New durable artefact:
  `docs/engineering/navigation-inventory.md`. 18 drawer destinations +
  2 popup/CTA href shapes recorded. Status: 17 MAPPED, 2 VERIFIED (href
  shape), 0 BROKEN. BLOCKER-NAV-001/002 recorded.

- **T3 · IAV security evidence record** — COMPLETE. New durable artefact:
  `docs/doctrine/cycle-14-iav-security-evidence-2026-11-25.md`. Five
  targets: all SECURE, one LOW residual (T5 `mode`-param length cap).
  Prior NEEDS-INFO on live policy load CLOSED by G2 probes.

- **T4 · Baseline unit test failures** — COMPLETE. 21/21 passing.
  Root cause: 2026-11-08 catalogue rename retired `plan.bisnis`,
  `plan.themes_ringan`, `plan.buy_theme`, `plan.own_theme_request`,
  `plan.gratis` in favour of `plan.chat_free`, `plan.chat_themes`,
  `plan.nex_shop`. The lookup function `planEntryForSubscription` in
  `src/lib/nex-native/intelligence/product-knowledge.ts` still
  referenced the retired IDs → every paying-user LLM context lookup
  returned null since 2026-11-08 (real product defect, not test
  staleness). Fixed the lookup + updated 7 stale test assertions.

- **T5-T10 · Customer journeys** — BLOCKED on BLOCKER-NAV-001.
  Business onboarding → publish, discovery → storefront, Ask-Seller,
  merchant order management, buyer payment, notifications. Each
  requires either DB-write fixtures from node (BLOCKED on IPv6) or
  seeded multi-account state (BLOCKED on fixture harness). Reporting
  these as VERIFIED without exercising them would violate the
  Strict Completion Standard.

### Files changed this cycle (uncommitted, pending separate push approval per CLAUDE.md §4)

- `src/lib/nex-native/intelligence/product-knowledge.ts` · reconcile
  `planEntryForSubscription` to 2026-11-08 catalogue IDs.
- `src/lib/nex-native/intelligence/__tests__/product-knowledge.test.ts` ·
  update 7 stale assertions to current catalogue.
- `tests/e2e/journey-visitor-claim-signup.spec.ts` · polling-dispatch
  pattern for React hydration tolerance.
- `tests/e2e/journey-guest-chat-signup-cta.spec.ts` · convert to
  `test.skip` with detailed BLOCKER-NAV-002 annotation.
- `tests/e2e/journey-vault-standalone-access.spec.ts` · dynamic
  entitlement-column probing (pre-mig-257 compatibility).
- `docs/engineering/navigation-inventory.md` · NEW.
- `docs/doctrine/cycle-14-iav-security-evidence-2026-11-25.md` · NEW.
- `docs/engineering/session-handoff.md` · this delta.

### Next safe actions requiring owner approval

1. Resolve BLOCKER-NAV-001 (IPv4 add-on OR SANDBOX_POOLER_URL env var
   with verified sandbox-ref user). Unblocks 9 Playwright specs and
   enables T5-T10 journey verification.
2. Approve commit + push for files listed above per CLAUDE.md §4.
3. Approve provisional-session fixture harness to unblock T7
   (Ask-Seller) and reinstate `journey-guest-chat-signup-cta.spec.ts`.

---

## Previous state · 2026-11-25 (Cycle 11 in-flight — Ask Seller security root-cause CLOSED, account-isolation regression VERIFIED)

**Cycle 11 outcome (in-flight):** the Cycle 10 "identity mismatch" is **not a disclosure defect**. JWT `sub` evidence refutes the hypothesis · account-isolation authorization boundary is proven at four layers. Remaining Cycle 11 tasks (NEX-021 deepening, NEX-006/007 math/editorial, Ask Seller product-share-lock root-cause, whole-app launch gaps, Blueprint update) are PENDING.

- **CLOSED (not a vulnerability):** the Cycle 10 "`nex-11339` → `nex-11244`'s conversation" redirect.
  - `tests/e2e/.auth/state.json` JWT `sub` claim decodes to `67f6cd2d-c60b-4675-a442-25fa708e1e26`.
  - That value is `nex-11244.supabase_user_id` in sandbox `kdstoyyeygcopkogqsyv` (not `nex-11339`).
  - The server resolved the cookie to `nex-11244`'s account via `getAccountBySupabaseUserId` and redirected to `nex-11244`'s own participant conversation. Authorization-correct outcome.
  - The Cycle 10 "nex-11339" label was a fixture mis-identification (that account has `supabase_user_id = NULL` and cannot be the resolved cookie identity).

- **VERIFIED this cycle (sandbox, Pixel 7, dev `:3008`):**
  - **C11-SEC-1 · Code-trace completed** across `src/app/nex-native/[businessSlug]/page.tsx:206-236`, `src/app/nex-native/[businessSlug]/_open-shop-chat-action.ts`, `src/lib/nex-native/app/session.ts:101-196`, `src/lib/nex-native/app/dev-impersonation.ts:162-163`, `src/app/nex-native/conversations/[conversationId]/page.tsx:106-137`, `src/lib/nex-native/business-message-service.ts:110-280`, `src/app/api/nex-native/chat/encrypted/route.ts:87-260`, `src/app/api/nex-native/chat/encrypted/since/route.ts:24-61`, `src/app/api/nex-native/chat/conversations/[conversationId]/route.ts:27-36`. Four-layer defence confirmed.
  - **C11-SEC-3 · Account-isolation regression spec authored + 6/6 green** · `tests/e2e/security-account-isolation.spec.ts`. Covers: RSC non-participant collapses to not-found with zero conversation markup; all three chat APIs reject non-participant reads + writes with non-2xx; unauth write/read return `401` before any participant check runs.

- **DELIVERED this cycle:**
  - `tests/e2e/security-account-isolation.spec.ts` (NEW · 6 tests · wired into `stage-a-pixel7` testMatch).
  - `playwright.config.ts` · `stage-a-pixel7` testMatch extended with `security-account-isolation\.spec\.ts`.
  - `docs/product/launch-evidence-ledger.md` § 2.1b Cycle 11 delta (root-cause record + four-layer code trace + regression spec evidence + explicit BLOCKED-on-fixture carve-outs).

- **BLOCKED (explicitly on missing second fixture · NOT improvised):**
  - Cross-account probe against a KNOWN-existing counter-party conversation id. Random-UUID probes exercise the same guard code path (server collapses non-existent and not-a-participant identically by design), but a two-fixture test would strengthen the evidence further. Needs a Founder-approved second sandbox storageState.
  - The Ask Seller composer "Send tapped · chip remains · no error surfaced" defect from Cycle 9/10 is a product-share-lock / UX observability defect on `nex-11244`'s legitimate historical conversation. NOT security. Needs a separate fix path (read `src/app/nex-native/conversations/[conversationId]/_client.tsx:989-1028` + the product-share-lock server action under authorisation).

- **NOT STARTED this cycle (Cycle 11 remainder):**
  - C11-NEX-021 · deepen full-viewport coverage beyond CSS contract (real-device Safari is still emulation-only).
  - C11-NEX-006 · editorial copy accuracy + drawer behaviour verification.
  - C11-NEX-007 · math correctness against `src/app/nex-native/switch/__tests__/` unit tests + locale/FX branches.
  - C11-LAUNCH · identify next whole-app launch gaps from the Blueprint vs ledger delta.
  - C11-DOC · Blueprint + nav-journey ledger updates.

**Next.js 16.3.8 Turbopack overlay `AbortError: Transition was skipped` (observed this cycle · NOT a security event):** diagnosed as benign View Transitions API behaviour. Root cause: `src/app/nex-native/_navigation-transitions-client.tsx:260-268` only `.catch()`es `transition.finished`; the simultaneously-rejected `transition.ready` and `transition.updateCallbackDone` go unhandled and surface in the dev overlay. Fix (text-only recommendation, NOT applied this cycle): add `.catch(() => {})` handlers to all three promises on the returned transition object. Zero behavioural impact · dev-only overlay noise.

**Not authorised this cycle (unchanged):** production access, migrations, Stripe activation, Emergency Help activation, public Shop Directory release, commits/pushes/merges/deploys, sandbox buyer account creation, exposure of service-role secrets, rewrite of commit `10ca82cc`, Purchase-Resumption Option C implementation.

**Uncommitted state carried forward:** local `useLang()` changes remain uncommitted per owner instruction 2026-11-25. No touching commit `10ca82cc`.

**Next safe action (within Cycle 11 scope):**

- **1.** Re-classify the Ask Seller composer defect in `launch-evidence-ledger.md` § 2.1 from "possible disclosure" to "product-share-lock / UX observability defect on legitimate conversation" (already done in § 2.1b delta — propagate wording to § 2.1 row if needed).
- **2.** NEX-007 math verification · run existing unit tests under `src/app/nex-native/switch/__tests__/` via `npm run test -- switch` and record pass/fail counts + exact test files touched.
- **3.** NEX-006 editorial copy verification · spec deepening against the actual Why-NEX page content (not markers only).
- **4.** C11-LAUNCH gap identification from Blueprint `§ 14` vs ledger delta. Record findings, do not implement.

---

## Prior cycle · 2026-11-25 (Cycle 10 closure — Ask Seller fixture STOP, NEX-021/006/007 VERIFIED)

**Cycle 10 outcome:** Founder Decision 1 (Path B · Ask Seller using `nex-11339` storage) STOPPED on identity mismatch · Founder Decision 2 (NEX-021 · NEX-006 · NEX-007 wider-launch verification) DELIVERED and VERIFIED.

- **STOP · Ask Seller · Path B (Decision 1 verbatim stop-clause invoked):**
  - Current storageState account `nex-11339` (`2b8811b3-cf5e-415c-aa32-1d960197d654`, `supabase_user_id = NULL`) has NO row in `nex_conversation_participant`, yet the sealed `?open-chat=1&product=<id>` redirect resolves to `conversations/0e23bc69-2e0e-4504-8279-200d39449485`.
  - DB evidence (sandbox `kdstoyyeygcopkogqsyv`, read-only): conversation `0e23bc69…` has `nex_conversation_participant.account_id = 80a9cedb-f477-4116-bcd8-78fb337d31e2` (`nex-11244`, `supabase_user_id = 67f6cd2d-c60b-4675-a442-25fa708e1e26`) on `side='customer'`.
  - Duplicate-account hypothesis tested + REJECTED (22 rows / 22 distinct `supabase_user_id`).
  - Classification: **product-side server identity resolution bug OR storageState account never linked to a Supabase auth user** — not a fixture mis-pick. STOP invoked per Decision 1: "If the current account unexpectedly encounters a lock, identity mismatch, missing participant or ambiguous fixture, STOP and report the evidence. Do not improvise another fixture."
  - No seller reply was sent to `0e23bc69…`. No impersonation. No new accounts. The historical `nex-11244` share-locked conversation is preserved untouched.

- **VERIFIED this cycle (sandbox, Pixel 7, dev server `:3008`, HEAD uncommitted):**
  - **NEX-021 · full-viewport rule** · `tests/e2e/full-viewport-chrome.spec.ts` · 4/4 green (17.4 s) on `stage-a-pixel7 --no-deps`. Three pillar routes (`/nex-native`, `/nex-native/sign-in`, `/nex-native/directory`) all satisfy: body width ≥ innerW-1, body height ≥ innerH-1, zero body/html margin, no horizontal scroll. Sealed `viewport-fit=cover` + `theme-color #020914` meta present on splash.
  - **NEX-006 · Why NEX smoke** · `tests/e2e/smoke-why-nex.spec.ts` AUTHORED + green (1.8 s). Observable: `[data-nex-why-page]` root marker, ≥1 `[data-nex-why-advantage]`, ≥1 `[data-nex-why-status="LIVE"]`, sealed Switch-calculator CTA linking to `/nex-native/switch`.
  - **NEX-007 · Switch calculator smoke** · `tests/e2e/smoke-switch-calculator.spec.ts` AUTHORED + green (2.0 s). Observable: `[data-nex-switch-page]` root, `aria-label="Switch cost calculator"` section, sealed honesty copy (dated-examples / Last verified citation), reactive Comparison (nothing-to-compare copy disappears after entering GMV=1000 / orders=10 / commission=10%).

- **DELIVERED this cycle:**
  - `tests/e2e/smoke-why-nex.spec.ts` (NEW, 56 lines, wired into `stage-a-pixel7` testMatch).
  - `tests/e2e/smoke-switch-calculator.spec.ts` (NEW, 99 lines, wired into `stage-a-pixel7` testMatch).
  - `playwright.config.ts` · `stage-a-pixel7` testMatch extended with the two new smoke patterns.

- **BLOCKED (cannot be unblocked without owner action):**
  - Ask Seller clean non-owner end-to-end · needs either (a) an owner-approved linkage of `nex-11339` to a real Supabase auth user so sign-in resolves to that account, or (b) an authorised investigation of the server session resolver that redirected the `nex-11339` cookie-holder to `nex-11244`'s conversation. Code change not authorised in this cycle.
  - Deployment identity of `nexapp-preview.nex-sandbox.workers.dev` · remains unverifiable from outside (no `x-nex-commit-sha` header, no `/api/nex-native/version` response). Per Founder qualification 2026-11-25, this is **evidence of non-current build** but NOT by itself proof that every route/asset from the expected build is absent.

**Not authorised this cycle (unchanged):** production access, migrations, Stripe activation, Emergency Help activation, public Shop Directory release, commits/pushes/merges/deploys, sandbox buyer account creation, exposure of service-role secrets, rewrite of commit `10ca82cc`.

**Uncommitted state carried forward from prior cycle:** local `useLang()` changes remain uncommitted per owner instruction 2026-11-25. No touching commit `10ca82cc`.

**Next safe action (Cycle 11 candidate · AWAITING AUTHORISATION):**

- **Highest-value next task:** authorised investigation of the server session resolver that maps `nex-11339` cookie-holder to `0e23bc69…` (`nex-11244`'s conversation). Candidate root-cause branches: (a) `resolveNexAppSessionFromContext` falls back to env-impersonation when `supabase_user_id` is NULL, (b) the sealed `?open-chat=1` server-action keys on the first participant row for a business regardless of the current viewer, (c) the storageState account was never Supabase-auth-linked and the session cookie resolves via a legacy owner lookup. Read-only inspection first, no code edit without the fresh word.
- **Second:** NEX-022 real-device Safari install verification (currently emulation-only) — owner-sealed 2026-11-24 flagged the Chromium-with-iPhone-UA profile as NOT production Safari.
- **Third:** promote `purchase-resumption-decision-brief-2026-11-24.md` from DELIVERED to IMPLEMENTED per Founder decision on the brief.

---

## Prior cycle · 2026-11-24 (Cycle 9 closure — buyer authentication journeys completed, Ask Seller composer BROKEN)

**Cycle 9 outcome:** five workstreams executed. Ordinary sign-in + adversarial + signup wiring + purchase-resumption brief = **VERIFIED / DELIVERED**. Non-owner Ask Seller composer send = **BROKEN** (honest finding, not papered over).

- **VERIFIED this cycle (sandbox, Pixel 7, `kdstoyyeygcopkogqsyv`, HEAD `bdd2bf97`):**
  - **Ordinary (email+password) sign-in** with `next=/nex-native/product/<id>` → buyer lands on the product, no auth-gate re-mount. `tests/e2e/journey-buyer-ordinary-signin.spec.ts` test 1 (3 tests, all green).
  - **Malicious `?next=` URL-level rejection** across 10 shapes (`//evil`, `/\attacker`, `https://…`, `javascript:…`, `/nex-native//`, `/nex-native/\`, empty, whitespace, non-path, non-`/nex-native/`). Test 2 of ordinary-signin spec + test 1 of adversarial spec.
  - **Absent-`next` default** lands on `/nex-native/contacts`. Test 3 of ordinary-signin spec.
  - **Signup form wiring** `?mode=signup&next=/product/<id>` → hidden `[data-nex-sign-up-next]` carries product path verbatim; mode-toggle round-trips `next` to the sign-in form. `tests/e2e/journey-buyer-signup-wiring.spec.ts` (2 tests, green). Prelaunch flag is OFF on this run.
  - **Adversarial regressions**: reload on sign-in preserves hidden `next`; direct-link deep entry preserves `next` on the auth-gate CTA; duplicate guest Add-to-Cart taps keep a single auth-gate banner (idempotent); Back-nav after resumed sign-in does not re-mount the auth-gate. `tests/e2e/journey-buyer-adversarial.spec.ts` 5/6 tests green.
- **BROKEN this cycle (new honest finding):**
  - **Non-owner Ask Seller · Send-to-shop click** · `tests/e2e/journey-ask-seller-nonowner-full.spec.ts`. After clicking the enabled `[data-nex-biz-conv-pending-product-send]` button, the chip remains mounted AND no `[data-nex-biz-conv-pending-product-error]` is surfaced within 15 s. Playwright page snapshot at failure confirms Send button enabled (cursor=pointer, no `[disabled]`) and chip is still rendered. Could not be elevated past Cycle 8's PARTIAL classification; downgraded to BROKEN per the sealed enum. **Not swept into a skip.** Investigation of `src/app/nex-native/conversations/[conversationId]/_client.tsx:989-1028` handler + server-action wiring is the next action under this branch — not authorised for code change in this cycle.
- **BLOCKED this cycle:**
  - Signed-in cart dedup (NAV-0102): no `[data-nex-product-add-to-cart]` / `-authed` control appears under the admin storageState on this product. BLOCKED-NO-AUTHED-ADD-CONTROL. Needs a non-admin fixture to observe.
- **DELIVERED (document only, no implementation):**
  - `docs/product/purchase-resumption-decision-brief-2026-11-24.md` — Options A/B/C enumerated with trade-offs, Option C (deferred prompt on return) recommended with reasoning. No code written, no server surface added. Awaits Founder decision word to promote to IMPLEMENTED.

**Permanent ledgers updated this cycle:**

- `docs/product/nav-journey-ledger.md` § 3.2 (NAV-0096 … NAV-0103 + NAV-0088 ordinary-branch promotion). Coverage rate: 15/470 → ~24/506 ≈ 4.7 % (+1.5 pp).
- `docs/product/launch-evidence-ledger.md` § 2.1 (Cycle 9 rows appended with explicit "what this does NOT prove" cells).

**Specs added this cycle (wired into `playwright.config.ts` stage-a-pixel7):**

- `tests/e2e/journey-buyer-ordinary-signin.spec.ts`
- `tests/e2e/journey-buyer-signup-wiring.spec.ts`
- `tests/e2e/journey-buyer-adversarial.spec.ts`
- `tests/e2e/journey-ask-seller-nonowner-full.spec.ts` (CURRENTLY FAILS · honest BROKEN)

**Launch readiness for JRN-buyer-signed-out-purchase-resume:** still `PARTIAL`. Advanced from Cycle 8 by adding ordinary sign-in, malicious-next, adversarial regressions, signup wiring; regressed by downgrading Ask Seller composer to BROKEN. Overall journey is NOT launch-ready.

**Next safe action (Cycle 10 candidate · AWAITING AUTHORISATION):**

- **Highest-value next task:** resolve the BROKEN Ask Seller composer. Read `_client.tsx` send handler + server action, determine whether (a) `peerAccountId` is null for the admin viewer (requires a non-admin fixture to exercise), (b) server action throws and client swallows, (c) a feature flag gates the send surface. Report findings before any code edit.
- **Second:** implement or decline the Purchase-Resumption Option C per Founder decision on the brief.
- **Third:** promote the signup form row from PARTIAL (wiring only) to VERIFIED — requires an owner-approved sandbox buyer or an owner decision to accept wiring-only + email-confirmation evidence as sufficient for launch.
- **Fourth:** DEFERRED branches (interrupted-auth, double-tap Dev Pass) — may need action-handler instrumentation.

**Not authorised this cycle (unchanged):** production access, migrations 354/365, Stripe activation, Emergency Help activation, public Shop Directory release, commits/pushes/merges/deploys, sandbox buyer account creation.

---

## Prior cycle · 2026-11-24 (Cycle 8 closure — buyer purchase-intent preservation · retained for reference)

**Cycle 8 outcome:** Partial, honestly classified.

- **VERIFIED (sandbox, Pixel 7, `kdstoyyeygcopkogqsyv`):**
  - Signed-out Add-to-Cart → `NexAuthGate` banner opens with `next=/nex-native/product/<id>`.
  - Dev Pass sign-in preserves `next` and returns the buyer to the originating product.
  - Signed-in Add-to-Cart writes `localStorage.nex_cart_v1`; survives a page refresh.
  - Browser back after resumed sign-in does not re-mount the auth-gate.
  - `?open-chat=1&product=<id>` sealed contract: non-owner viewer server-redirected to `/conversations/<id>?product=<id>` with product chip visible.
  - Dev Pass `?next=` preservation fix: `src/app/nex-native/sign-in/page.tsx:666-680` (hidden input) + `src/app/nex-native/_actions.ts:877-935` (`devPassAction` reads + `safeNext`-validates `next`; production guard retained; defaults unchanged when `next` absent).
- **NOT VERIFIED (Founder-called-out):**
  - Ordinary (email+password) sign-in with `next=` preservation — no Cycle 8 test drives this branch; only Dev Pass was exercised.
  - Full signup → account creation → return-to-product — signup form carries `?next=` (URL/form wiring verified); submit path not exercised (no approved sandbox buyer; prelaunch flag may hide signup).
  - Automatic purchase resume — current behaviour requires the buyer to re-tap Add to Cart after sign-in. UX decision owed (see `nav-journey-ledger.md` § 5).
  - Full non-owner Ask Seller conversation (send, delivery, receive, reply) — only the redirect + chip are proven.
  - Interrupted authentication (close tab mid-flow), duplicate submit (double-tap Dev Pass), refresh *on* sign-in page.
- **BLOCKED (unchanged):** mig 354/365 cart→`nex_order` + price-tamper rejection stays BLOCKED per sealed Merchant-Owned Payments boundaries.

**Permanent ledgers updated this cycle:**

- `docs/product/nav-journey-ledger.md` (NEW, promoted from `docs/doctrine/nex-navigation-transition-audit-2026-11-24.md` Pass 1). Carries NAV-0086 … NAV-0094 with branch-level status.
- `docs/product/launch-evidence-ledger.md` (NEW). Records JRN-buyer-signed-out-purchase-resume with explicit "what this does NOT prove" cells per branch.
- `docs/product/nex-blueprint.md` § 9 — two new sealed rows (Dev Pass `?next=`; Buyer purchase-intent preservation · Dev Pass branch).

**Spec:** `tests/e2e/journey-buyer-signed-out-purchase-resume.spec.ts` · 4 journey tests + `auth-setup` dependency · 5/5 green in sandbox 2026-11-24.

**Next safe action (Cycle 9 brief · owner-refined 2026-11-24 · AWAITING AUTHORISATION TO EXECUTE):**

1. **Ordinary email+password sign-in** — drive the actual customer sign-in form (NOT the Dev Pass route) with an owner-sanctioned sandbox account. Assert `next=` preservation + return-to-product. Dev Pass verification does not satisfy this branch.
2. **Purchase-resumption UX** — present the three options (buyer re-taps · auto-resume · one-tap "Resume purchase" callout) in a short brief with evidence for a Founder recommendation. **Do NOT implement a permanent behaviour before the Founder decides.**
3. **Signup journey** — prepare the test harness and inspect the existing signup flow. **FIRST, check whether `isPrelaunchModeOn()` currently hides signup** — do not assume the signup journey is testable. **Do NOT create a sandbox buyer account without explicit, separate owner approval.** Until approved, the row stays BLOCKED, not silently passed.
4. **Full non-owner Ask Seller** — verify observable delivery states (UI transitions, message-sent indicators, chip persistence) under the sealed device-only E2E restriction. **Never inspect message bodies. Never introduce a server-side message-storage shortcut.** If delivery cannot be verified observably, the row stays BLOCKED, not silently passed.
5. **Adversarial regression pack** — interrupted auth (close tab mid-flow), duplicate submit (double-tap Dev Pass / sign-in), refresh-on-sign-in, direct-link reverse-direction.

**Cycle 9 completion rule (owner-sealed 2026-11-24):** the cycle is NOT complete merely because the five workstreams have been attempted. Each journey needs its own branch-level result + evidence in `docs/product/launch-evidence-ledger.md`. **Blocked tests remain blocked, not silently counted as passes.** Promotion to VERIFIED requires every declared branch of the row to carry evidence; otherwise the row stays PARTIAL or NOT VERIFIED.

**Coverage context (owner note):** post-Cycle 8 branch-level verification is ~15/470 ≈ 3.2 %. This does NOT mean only 3.2 % of the app works — it means documented branch-level verification coverage is low. Cycle 9 must steadily raise it, not short-circuit it.

**Not authorised this cycle (unchanged):** production access, migrations 354/365, Stripe activation, Emergency Help activation, public Shop Directory release, commits/pushes/merges/deploys, sandbox buyer account creation (requires separate named approval).

---

## Current state · 2026-11-23 (later — blueprint cycle)

**New this cycle:** `docs/product/nex-blueprint.md` created as the
MANDATORY first-read file (`CLAUDE.md §9` updated). Captures all six user
states, the theme-pricing rule (owner-sealed 2026-11-23), side-drawer
inventory (sealed by regression test), settings-pages inventory, 11
sealed decisions, and six known gaps (G-1 through G-6) each needing an
owner decision. Also this cycle: Phase 3 §6 defect fix — `plan_activation`
`expires_on` now rejects impossible calendar dates in addition to format
violations (`src/lib/nex-native/peer-message-service.ts:515-549`).

**Open owner decisions after this cycle (blueprint § 10 and § 11):**

- **G-1** State B (mid-onboarding) not distinguished from State C — add
  `onboarding_complete` column? (migration needed, owner phrase required)
- **G-2** ✅ FIXED 2026-11-23 · three-way splash branch driven by durable
  `nex_known_device=1` cookie (1 year, HttpOnly, SameSite=Lax). New helper
  `src/lib/nex-native/app/known-device-cookie.ts` + middleware sets cookie
  on every successful auth refresh + `page.tsx` reads it for the signed-out
  branch. 12/12 unit tests pass. Playwright journey NOT run — queued as
  Owner Proof #2.
- **G-3** State F (new device) key establishment — carries over to
  Phase 4 §3 encrypted-send verification (BLOCKED on commerce arch fork)
- **G-4** Theme persistence across pre-auth → auth transition — needs
  Playwright + targeted read of create-account server action
- **G-5** Shop offer screen (`/welcome/shop-offer/`) unverified; NEX-015
  checkout never exercised — don't place in flow until proven
- **G-6** Invite Friends / Share NEX ID discoverability — components
  exist, mounting unverified

**Phase 3 report (prior cycle):** delivered. Commerce migration
authorised but ARCHITECTURAL FORK still pending (options A/B/C) —
owner's 2026-11-23 reply recommended **A + C hybrid** (client-side crypto
for free-form messages, Path A separation for structured commerce
payloads with its own five word-triggers).

---

## Current state · 2026-11-23 (late)

**Repository:** `C:/Users/Victus/nexapp` (remote `Philip2024394/nexapp.git`)
**Branch:** `release-audit-v1-2026-11-14`
**Local HEAD:** `bdd2bf97` (tree-identical to `main`'s current `152a020d` merge commit)
**Remote `main`:** `152a020d` (release merged into main earlier today)
**Live production Worker:** `nexapp` · Version ID `cafdc8f3-66fb-4eaa-a138-c30970c70d60` · deployed 2026-11-23 via local `wrangler deploy`
**Live URL:** `https://nexcorner.com` ↔ Worker `nexapp.nex-sandbox.workers.dev` · 200 OK confirmed

## Incident + remediation 2026-11-23 (late)

**Problem:** push to `main` triggered Cloudflare's dashboard-connected Workers
Builds pipeline (separate from the in-repo GitHub Actions `cloudflare-deploy.yml`).
Build #b23b9c6f failed during `next build` page-data collection on
`/nex-native/[businessSlug]/opengraph-image` → `supabase-admin.ts` module-eval-time
validation threw because Workers Builds build-env had no `NEX_SUPABASE_URL` or
`NEX_SUPABASE_SERVICE_ROLE_KEY`.

**Root cause:** two parallel deployment systems were wired to the production
Worker. The intended pipeline (`.github/workflows/cloudflare-deploy.yml`) is
dispatch-only per §5; Workers Builds is auto-on-push and bypasses §5.

**Remediation path chosen (Track A, local build + deploy):**

1. Sourced the commented production Supabase values from `.env.local` lines
   124-126 (preserved from 2026-11-10 dev→sandbox swap) in a subshell.
2. Ran `npx opennextjs-cloudflare build` locally with those env vars + the
   production site URL / identity vars matching the workflow's production step.
   - Build exit code 0; `.open-next/worker.js` generated.
   - Windows Dev Mode symlink capability confirmed present (the NTFS blocker
     the workflow doc anticipates does not apply on this machine).
3. Ran `CLOUDFLARE_ACCOUNT_ID=a46ee668c0b1bc53b2de925e5b4bcd0a npx wrangler
   deploy --config wrangler.jsonc`.
   - 72 new assets uploaded (1618 cached), 36.5 MB total.
   - Worker Startup Time: 699 ms.
   - Current Version ID: `cafdc8f3-66fb-4eaa-a138-c30970c70d60`.

**Smoke-check results** (both `https://nexapp.nex-sandbox.workers.dev` and `https://nexcorner.com`):

| Endpoint | Expected | Actual |
|---|---|---|
| `/api/nex-native/version` | 200 JSON | ✅ 200 JSON |
| `/` → `/nex-native` redirect | 200 | ✅ 200 |
| `/nex-native/some-shop/opengraph-image` (previously failed) | 200 PNG | ✅ 200, `image/png`, 28201 bytes, valid PNG magic bytes |

**Known residual:** `/api/nex-native/version` returns `commit_sha: "unknown"`
because local build didn't inject `NEX_GIT_COMMIT_SHA`. This is documented
expected behavior in `src/app/api/nex-native/version/route.ts:12-15`. To fix
on the next deploy: pass `NEX_GIT_COMMIT_SHA=$(git rev-parse HEAD)` either
in `wrangler.jsonc` `vars:` or at deploy-time with
`wrangler deploy --var NEX_GIT_COMMIT_SHA:<sha>`.

## Open deployment-architecture question (owner decision needed)

The Cloudflare Workers Builds integration on the production Worker is still
connected to `main` and will **re-trigger on every push to main, auto-deploying
without approval** — violating CLAUDE.md §5. Options:

- **Preferred (Track A doctrine-aligned):** Disconnect Workers Builds at
  https://dash.cloudflare.com/a46ee668c0b1bc53b2de925e5b4bcd0a/workers/services/view/nexapp/production/settings
  → Build section → "Disconnect". Future production deploys via GitHub Actions
  `workflow_dispatch` (requires `NEX_PROD_SUPABASE_*` + `CLOUDFLARE_API_TOKEN`
  secrets, not yet set).
- **Alternative:** rely on this session's local-build-and-deploy pattern for
  every future production ship. Reproducible but manual — owner must run
  `npx wrangler deploy` locally each time, with env vars sourced from
  `.env.local` commented lines.

Until disconnected, pushing to `main` will trigger Workers Builds again,
which will fail again at the same opengraph route (nothing on the Cloudflare
side changed — only the live Worker code did).

**Commits this session** (all on `release-audit-v1-2026-11-14`, all pushed
to `origin` at 2026-11-23):

| SHA | Scope | Evidence |
|---|---|---|
| `6e8d1b5f` | docs: engineering workflow scaffold (feature-ledger + handoff + ADR index + CLAUDE §9) | files present |
| `43119e44` | feat(NEX-007): switch calculator · dated presets + honest savings math | **26/26 vitest pass** (`_calc-helpers.test.ts`); `tsc` clean on the 4 new files |
| `4a1d07a5` | feat(NEX-006): /nex-native/why-nex public page · 6 competitive wedges | `tsc` clean; **no browser smoke** |
| `de2426b0` | docs: competitor portability map · 11 competitors · 6 patterns | sourced to primary citations |
| `7a07de5b` | docs(handoff): record 4 commits landed this session | n/a |
| `26ae5675` | docs(handoff): record push to release branch | n/a |

**Working tree (intentionally untouched):**
- `M scripts/.phase12-audit-test/data/programmer-execution/command_audit.jsonl` (pre-existing · not mine)
- `?? docs/doctrine/cloudflare-cutover-drafts/06-OWNER-APPROVAL-CHECKLIST-2026-11-22.md` (prior session · out of this cycle's scope)

---

## What is "live" — honest status

| Layer | Status | Evidence |
|---|---|---|
| **GitHub** — code reached the remote | **LIVE** | `git ls-remote origin release-audit-v1-2026-11-14` → `26ae5675` matches local HEAD |
| **GitHub `main` branch** | **NOT UPDATED** | Still at `6df28ea1`. CLAUDE.md §4 requires separate explicit approval naming repo + branch + commit to push to `main`. |
| **Cloudflare preview Worker** | **NOT DEPLOYED** | `.github/workflows/cloudflare-deploy.yml` is `workflow_dispatch` only (manual). No run has been dispatched. |
| **Cloudflare production Worker** | **NOT DEPLOYED** | Same. Also needs separate `inputs.environment=production` and `NEX_PROD_SUPABASE_*` secrets. |
| **`nexcorner.com` DNS** | **UNKNOWN THIS SESSION** | Per 2026-11-21 memory: zone added to Cloudflare; DNS records not yet verified. Not re-verified this session. |

**Therefore:** the code change is on GitHub but **no customer-visible
surface changed today**. Saying "pushed live" to a customer would be
inaccurate until the Cloudflare workflow actually runs and
`nexcorner.com` serves the new build.

---

## Cloudflare deploy · what is actually gating "live"

The `.github/workflows/cloudflare-deploy.yml` file (authored prior session)
runs on `ubuntu-latest`, which **already bypasses** the Windows NTFS
symlink EPERM that blocks local `opennextjs-cloudflare build`. So the
blocker my previous handoff described (Windows symlink) is not the real
production gate — Linux CI handles that.

The real gate is 5 items the owner controls, not me:

1. **`CLOUDFLARE_API_TOKEN`** secret present on GitHub Actions. Per
   2026-11-21 memory the owner's `cfat_*` token was rejected — likely a
   Zero Trust Access credential, not an API token. Owner needs to mint an
   "Edit Cloudflare Workers" scoped token.
2. **`CLOUDFLARE_ACCOUNT_ID`** = `a46ee668c0b1bc53b2de925e5b4bcd0a`
   (recorded in the workflow comment).
3. **`NEX_SANDBOX_SUPABASE_URL` / `_ANON_KEY` / `_SERVICE_ROLE_KEY`** secrets
   for the preview environment.
4. **For production only:** `NEX_PROD_SUPABASE_URL` / `_ANON_KEY` /
   `_SERVICE_ROLE_KEY`.
5. **Owner clicks "Run workflow"** in GitHub Actions UI with
   `environment=preview` (or `production`, which per CLAUDE.md §5 is a
   separate explicit gate).

I cannot add secrets, cannot `workflow_dispatch` without GitHub auth
(`gh auth status` confirmed: not logged in this session), and the memory
entry sealing the Cloudflare stack (2026-11-21) says "prod deploy needs
named approval". So this remains **owner-only**.

---

## What was built this cycle

| Feature ID | Path | State | Tested? |
|---|---|---|---|
| NEX-006 | `src/app/nex-native/why-nex/page.tsx` | **CODE PRESENT (NOT VERIFIED)** | `tsc` clean; no browser smoke |
| NEX-007 | `src/app/nex-native/switch/*` | **VERIFIED (sandbox: pure-helpers unit tests)** | **26/26 vitest pass**; `tsc` clean; no browser smoke |
| (meta) | `docs/product/feature-ledger.md` | SCAFFOLD + populated per 20-feature sweep | n/a |
| (meta) | `docs/engineering/session-handoff.md` | this file | n/a |
| (meta) | `docs/architecture/decisions/README.md` | ADR index | n/a |

Note: VERIFIED applies to the **pure calculator helpers**, not to the
rendered page. End-to-end render + input + copy-button + currency
selector have **not** been exercised in a browser this cycle.

---

## Blocked, pending owner input

| Item | What is needed |
|---|---|
| **NEX-001 Merchant export** | Pick path (a) in-app push + pg_cron + Vault-bodies-excluded [ADR-0001 recommended] · (b) alternative infra · (c) defer with NEX1 support fallback. ADR exists; implementation not authorised. |
| **NEX-003 Account appeals** | Exact migration-authorisation phrase for `nex.account_appeal` sandbox migration. I will not guess. Reviewer-SLA copy must wait for staffing confirmation. |
| **NEX-014 side-drawer "Why NEX?" link** | Pick (a) append to `PREFERENCES_ROWS` · (b) append to `YOUR_NEX_ROWS` · (c) new `ABOUT NEX` section · (d) don't drawer-link (Switch back-chip already covers it). Regression test `control-drawer-client.test.tsx:278-298` seals row keys by owner-dated directive — the test must be re-sealed as part of the chosen option. |
| **NEX-015 Monthly shop billing** | Authorisation to exercise Stripe sandbox for subscribe / cancel / renewal / webhook signature / duplicate event (release-audit-v1 P1-B). |
| **Cloudflare preview deploy** | Owner: confirm/add the 5 secrets above and click "Run workflow" on `cloudflare-deploy.yml` with `environment=preview`. |
| **Cloudflare production deploy** | Separate gate per CLAUDE.md §5 after preview is green. |
| **`main` branch merge** | Separate gate per CLAUDE.md §4. Release branch is 6 commits ahead of `main`. |

---

## Next safe action (no approval needed)

1. **Author ADR-0002 schema-reconciliation note** — document that
   `nex_peer_message.body` still exists in schema (sentinel-constrained,
   not dropped) despite doctrine's "strip plaintext mode" rule. Propose a
   drop migration as a sandbox-authored draft only, flagged as needing
   the owner phrase. (See `docs/architecture/decisions/README.md` row
   ADR-0002.)

2. **Draft requirement stubs** for NEX-002 and NEX-009 at
   `docs/product/requirements/NEX-002-product-import.md` and
   `NEX-009-chat-teams.md` so future sessions know what acceptance
   criteria are agreed vs undefined.

3. **Author a browser-smoke checklist** for `/nex-native/switch` and
   `/nex-native/why-nex` so when the Cloudflare preview comes up the
   owner has a 60-second verification path.

---

## Blocked defects / debts surfaced this cycle

- **NEX-017 schema debt**: `nex_peer_message.body` column exists with a
  sentinel-based check constraint. Device-only E2E doctrine (sealed
  2026-11-09) says "strip plaintext mode". The column was constrained,
  not dropped. Schema-correction debt. File ADR-0002.

- **Migration application reality**: per inventory agent a28179d,
  migrations 206, 224-225, 300, 304, 313-317 all carry "AUTHORED FOR
  REVIEW ONLY · NOT APPLIED" headers. Memory entries claiming some are
  "applied to sandbox" are not substantiated by the migration file
  headers. Verify the live sandbox DB state with `SELECT to_regclass(...)`
  before any UI change assumes those tables exist.

- **Vitest baseline**: 535 pre-existing failures per release-audit-v1
  §P1-A. New tests I add must not raise that number. This cycle's 26
  new tests all pass, so the number did not change.

- **Prior handoff mis-attribution**: the previous version of this file
  said the Cloudflare live-deploy blocker was "Windows symlink EPERM on
  @opennextjs/cloudflare". That is accurate for **local** builds but
  not for the live-deploy gate — the GitHub Actions workflow runs on
  Linux where the symlink issue does not occur. Corrected above.

---

## Session-start reading order (next session)

1. This file.
2. `docs/product/feature-ledger.md`.
3. `docs/architecture/decisions/README.md`.
4. `docs/release-audit-v1-2026-11-14.md` (historic audit — do not duplicate).
5. CLAUDE.md §1-§9 (constitution + §9 session-start reading rule).

If any of those conflict with a memory entry, the docs win. Memory is a
convenience, not authoritative evidence.
