# NEX HTTP Route Test Coverage Inventory + Gap Spec · 2026-11-21

Scope · forensic read-only inventory of route-level automated test
coverage under `src/app/api/nex-native/` + a gap specification that
would promote P2-01..P2-07 "Verified via code read" findings to
"Verified via automated enforcement." Phase 2 Remediation priority
8 (P2-08) per the sealed 2026-11-09 priority order.

This document is a SPECIFICATION of what tests are needed. Writing
the tests is NOT in scope for P2-08 · implementation lands when
the owner authorises P2-08 test authorship as a follow-up pass.

Audit root · `C:/Users/Victus/nexapp`
Repo · `Philip2024394/nexapp` · branch `release-audit-v1-2026-11-14`
HEAD at audit time · `bd5d7de7`

Posture in one line · **121 route files · 19 route test files · ~15%
route-level coverage · vitest scaffolding is ready · five
specific test-authorship increments would close the P2-03/04/05/06/07
automated-enforcement gap.**

Spot-verified by direct Read before publication ·

- Route file count · `find src/app/api/nex-native -name route.ts |
  wc -l` → `121`.
- Route test count · `find src/app/api/nex-native -path "*__tests__*"
  -name "*.test.ts" | wc -l` → `19`.
- `vitest.config.mts` exists at repo root.

---

## Compliance scorecard

| Area | Verdict | Launch gate |
|---|---|---|
| Vitest scaffolding + path aliasing | Ready (`vitest.config.mts`) | n/a |
| Route-level test coverage (121 routes · 19 tested) | ~15% · PARTIAL | n/a |
| Baseline vitest state (task #58 in progress) | 231 known failures tracked · owner acceptance pending | Blocks the "green baseline" claim |
| Real-DB RLS test matrix (`g1-rls-harden-217-218.test.ts`) | 20 source-shape PASS · 36 real-DB `it.skip` pending D6 sandbox | Blocks P2-04 automated promotion |
| P2-03 four tamper-rejection tests | 2 of 4 present (404 missing · cross-business mismatch) · 2 to author (fare recompute · discount ignored) | Spec only |
| P2-04 non-participant RLS matrix | Partial (batch route covers happy path + sender mismatch) · full matrix skipped | Needs D6 unblock |
| P2-05 four rate-limit tamper paths | Service-layer tests PASS · route-level breach tests absent | Spec only |
| P2-06 three UI invariants (idempotency · schema_missing · resolver symmetry) | Route `/api/.../select-theme` has zero tests · entitlement-service.ts has partial coverage | Spec only |
| P2-07 analytics continuity test design | NOT DOCUMENTED · sealed decision #6 gate for Phase B → C | Design required before Phase B authorisation |

Zero new VIOLATION. One PARTIAL on coverage. The gap is OPERATIONAL
· authoring tests is explicit future work, not a defect in existing
code.

---

## 1 · Why P2-08 exists in the sealed priority order

Sealed 2026-11-09 priority 8 places automated route tests AFTER
P2-01..P2-07 for a reason · these tests exist to promote
code-read findings to Verified-via-automated-enforcement findings.
The audits in P2-01..P2-07 identified five classes of gap that
tests can close ·

1. P2-03 · trust-the-client price tampering · four specific
   tamper paths named in the P2-03 doc.
2. P2-04 · cross-participant RLS bypass · 36 real-DB scenarios
   already authored as `it.skip` waiting on D6 sandbox provisioning.
3. P2-05 · rate-limit breach + 429 + jsonb-metadata-allow-list ·
   four specific tamper paths named in the P2-05 doc.
4. P2-06 · theme-apply idempotency + schema_missing degrade +
   dev-override resolver symmetry · three UI invariants.
5. P2-07 · analytics continuity between legacy `attachment_meta.cart`
   and new `nex_order_item` · design-only at this stage.

Each test authorship pass is a separate increment · P2-08 is the
inventory + specification · not the authorship itself.

---

## 2 · Test scaffolding snapshot

### 2.1 · Vitest configuration

- `vitest.config.mts` present at repo root.
- `@/` path alias mirrors `tsconfig.json`.
- Setup files · `scripts/vitest-stubs/env-loader.ts` (pre-loads
  `.env.local` so modules that throw at import time have the vars
  they need) · `scripts/vitest-stubs/server-only.ts` (alias stub
  so `server-only`-marked code executes under the Node vitest
  runner).
- Scoped exclusion list suppresses 11 removed-feature trees
  (`nex-agent-runtime` · `merchant-assistant` · `trade-centre` ·
  `live-commerce` + 7 more) per the sealed 2026-11-06 scope
  reduction.
- vitest v4.1.11.

### 2.2 · Baseline state

Task #58 context · 231 test failures on a baseline run · 97.6%
pass rate across 19,453 tests. Baseline failures cluster into ·

- mock-chain shape mismatches in migration-era tests (~40);
- real-DB connection failures on jobs/terminal-transition (~60 ·
  requires a reachable Postgres · currently unresolved);
- excluded dead-code trees working as designed (~11 patterns);
- missing data-corpus fixtures for programmer-* / city-registry
  (~6 files).

None of these failures were introduced by the P2-01..P2-07 audit
work · all are pre-existing debt tracked under task #58. Owner
acceptance of the baseline-as-nonblocking OR closure of the 231
failures is a prerequisite for signing off P2-08 as Verified.

### 2.3 · Mock infrastructure maturity

- `vi.hoisted()` + `vi.mock()` factory pattern · established in
  18 route test suites.
- Stripe constructor mock (`vi.mock("stripe")`) · used in buyer
  checkout test.
- Supabase admin mock (`.from().select().eq().eq()` chains) · used
  in several routes.
- Request builder helpers (`buildReq`, `req` factories) · pattern
  established.
- Dev-impersonation session mocks (`resolveSessionMock`) ·
  established.
- GAP · no mock-fetch wrapper · external REST calls (Stripe REST,
  PayPal REST, QRIS) are mocked at the SDK level only · no HMAC
  signature verification is exercised in the three webhook tests.

---

## 3 · Route coverage matrix (summary)

### 3.1 · Tested (18 route trees · 19 test files)

- `attachment/encrypted` · `attachment/encrypted/signed` ·
  `attachment/standard`
- `auth/webauthn` (assert-routes + enroll-routes, two test files)
- `billing/checkout/buyer`
- `chat/encrypted` (dispatch-wiring)
- `cron/security-audit-reconcile`
- `harvest/tick`
- `hq/direct-message`
- `paypal/webhook`
- `peer-message/encrypted/batch`
- `peer-message/encrypted` (dispatch-wiring)
- `qris/webhook`
- `security/account/delete`
- `security/password/change`
- `stripe/webhook`
- `surface-health`
- `unread-count`

### 3.2 · Untested (103 route trees)

Partial inventory ·

- Billing · `billing/cancel/shop` · `billing/checkout` (base,
  pack, shop, theme variants) · `billing/connect/stripe/*` ·
  `billing/cron/reconcile` · `billing/health` ·
  `billing/sell-listing-charge` · `billing/webhook/stripe` ·
  8 untested.
- Chat/peer-messaging · `chat/conversations` · `chat/message` ·
  `chat/nex-reply` · `chat/encrypted/since` ·
  `chat/visitor-first-message` · `chat/visitor-session` ·
  `peer-message/delivered` · `peer-message/device-keys/*` ·
  `peer-message/encrypted` (base + since) · 8 untested.
- Security · `security/credentials/*` (rename · revoke) ·
  `security/sessions/*` (revoke · revoke-all · trust) · 5 untested.
- Vault · entire 28-route subsystem · 0 tested.
- Community · `community/lost-found/*` · `community/membership` ·
  `community/notices/*` · `community/zones/*` · 8 untested.
- Trial · `trial/*` (opt-out-conversion · resume-conversion-interest
  · start · status) · 4 untested.
- Miscellaneous · `select-theme` · `slug-availability` ·
  `prelaunch/notify` · `push/subscribe` · `incident/section-error`
  · `engine/health` · `generation-jobs/[jobId]` · `first-message`
  · `watches/*` · various.

Overall · 103 of 121 routes lack any direct test file. Not every
untested route is high-risk · Vault is high-risk; `watches/*` and
`music/*` are low-traffic admin paths. The gap spec below targets
the specific audit-linked routes first.

---

## 4 · Gap-closing test spec per audit priority

### 4.1 · P2-03 · buyer checkout (2 cases present · 2 to add)

Existing · `src/app/api/nex-native/billing/checkout/buyer/__tests__/
route.test.ts` (349 lines · 23 cases) covers ·

- (a) non-existent `productId` → 404 · line 203-212.
- (b) cross-business `productId` → `product_business_mismatch` 400
  · line 214-231.
- 9 shape-validation + 11 server-resolve cases.

To add ·

- (c) Server-resolve asserts the Stripe session is built from
  `product.price_pence`, not a hypothetical client-supplied
  `amountMinor` (the current body shape doesn't carry
  `amountMinor` · the test asserts the ABSENCE of any flow where
  it could be read).
- (d) Idempotency fingerprint test · assert that two requests with
  the SAME `(businessId, [{productId, quantity}])` produce the same
  fingerprint AND that a tampered `successUrl` does NOT cause
  fingerprint drift (server ignores client-side session binding
  intent).

The P2-03 doc also named a (c') fare-recompute 1-pence rejection
and a (d') discount-ignored case for the `sendCartOrderAction`
path · those are action tests, not route tests · they live in
the test file beside `_actions.ts`.

### 4.2 · P2-04 · peer-message RLS (36 real-DB cases skipped)

Existing · `nex-supabase/migrations/__tests__/g1-rls-harden-217-218
.test.ts` (377 lines · 20 source-shape PASS · 36 real-DB tests
`it.skip`).

To promote ·

- Provision a D6 sandbox Supabase (owner infra · not Claude).
- Configure env vars `NEX_RLS_TEST_SUPABASE_URL` +
  `NEX_RLS_TEST_SERVICE_ROLE_KEY`.
- Un-skip the 36 tests · they cover ·
  - T1-T3 · anon / authenticated SELECT identity isolation.
  - T4-T9 · participant vs non-participant INSERT / UPDATE / DELETE.
  - T10-T14 · service-role bypass · provisional guest ·
    identity-domain mismatch regression.
  - T15-T24 · `nex_live_post` policy matrix (anon / owner /
    tier-gated).
  - T25-T34 · immutability trigger · 17 immutable + 6 mutable
    columns.
  - T35-T36 · role qualifier + Realtime.

Plus route-level additions (test file to create under
`src/app/api/nex-native/peer-message/encrypted/batch/__tests__/`) ·

- Authenticated non-participant SELECT returns the batch endpoint
  equivalent of 403.
- Authenticated participant UPDATE `read_at` allowed.
- Authenticated non-participant UPDATE `read_at` denied.
- Trigger blocks immutable column mutation on UPDATE.

### 4.3 · P2-05 · rate-limit (4 paths)

Existing · `src/lib/nex-native/__tests__/security-rate-limit.test.ts`
(3 service-layer tests · PASS) + vault PIN rate-limit tests + follow
rate-limit tests. Zero route-level breach assertions.

To add ·

- `/auth/webauthn/assert-finish` · flood N > max-per-window →
  assert 429 with `Retry-After` header.
- `/hq/direct-message` · flood · assert 429 (not partial send).
- `/security/sessions/revoke` · assert fail-open posture (DB
  outage still allows single-session revoke · deliberate per
  sealed 2026-11-08 security-rate-limit.ts lines 119-121).
- Metadata jsonb allow-list negative test · write a
  `nex_security_audit_log` row with an unknown metadata key via
  the audit writer · assert the writer REJECTS (sealed doctrine
  is application-level enforcement · needs a writer-side test
  per P2-05 doc).

### 4.4 · P2-06 · theme UI (3 invariants)

Existing · no `src/app/api/nex-native/select-theme/__tests__`
directory.

To add (new `route.test.ts`) ·

- First-free apply idempotency · POST twice for the same
  `themeId` → both 200 · response `{chosen}` identical · no
  double-write to `nex_theme_ownership`.
- Schema-missing degrade · simulate `nex_theme_ownership` missing
  the `acquired_via` column (error code `42703`) → endpoint
  returns `{ok: false, reason: 'schema_missing'}` · UI degrades
  gracefully · no 500.
- Dev-override resolver symmetry · toggle session between
  nex-99901 and nex-99903 impersonations · assert the right
  account's ownership row is written (not a leak into another
  account).

### 4.5 · P2-07 · analytics continuity design (NOT code)

Deliverable · a design doc (not tests) that specifies the Phase B
→ C cutover gate. Recommended structure (owner consideration
only) ·

- Parallel-window aggregate · for a defined time window post Phase
  B apply · count `nex_peer_message` rows where
  `attachment_meta->cart->>shop_id = <business_id>` AND count
  `nex_order_item` rows joined to `nex_order` where
  `nex_order.business_id = <business_id>`.
- Assert (a) ≤ (b) + tolerance (the dual-write means new counts
  match or exceed legacy).
- Monitor the delta across N windows · gate Phase B → C on
  stability.
- Output · a signed-off `docs/doctrine/analytics-continuity-
  phase-b-to-c-design-<date>.md` · reviewed by owner before Phase
  B authorisation word-trigger.

Owner authorisation for Phase C is sealed · the continuity test
design is the measurement preconditioning for that authorisation.

---

## 5 · Infrastructure readiness assessment

| Component | State |
|---|---|
| Vitest runner + path aliasing | READY |
| `.env.local` loading at test time | READY |
| Mock patterns (vi.hoisted + vi.mock factory) | READY · 18 route suites |
| Stripe constructor mock | READY · used in buyer checkout |
| Supabase admin `.from().select().eq()` chain mocks | READY · used in several routes |
| Request builder helpers | READY (ad-hoc per suite) |
| Dev-impersonation session mocks | READY |
| Real-DB test sandbox (D6) | BLOCKED · owner infra provisioning required for the 36 RLS real-DB tests |
| Mock-fetch for external REST (Stripe/PayPal/QRIS beyond SDK) | NOT WIRED · HMAC signature verification is NOT exercised in the three webhook tests · a mock-fetch wrapper would close this |
| Multi-business test fixture (different seller accounts for cross-business tamper tests) | NOT WIRED |
| Vault subsystem test fixtures (28 routes · 0 tested) | NOT WIRED |

---

## 6 · Prerequisites + recommended sequence (not an authorisation)

For owner consideration only ·

1. Close task #58 · owner accepts the 231 pre-existing vitest
   failures as nonblocking baseline OR authorises a fix pass.
2. Provision D6 sandbox · configure env vars · un-skip the 36
   real-DB RLS tests · the 36 scenarios promote P2-04 to Verified
   via automated enforcement.
3. Author P2-03 (c) + (d) idempotency fingerprint tests in the
   existing buyer-checkout suite (small increment).
4. Author `select-theme/__tests__/route.test.ts` with the three
   P2-06 invariants.
5. Author P2-05 four route-level breach tests · including the
   metadata-allow-list negative test at the audit-writer boundary.
6. Author the P2-07 analytics continuity design doc.
7. Wire a mock-fetch shim and add HMAC signature verification
   assertions to the three webhook route tests.
8. Expand the Vault test coverage incrementally (28-route subsystem
   · separate priority · not a P2-08 blocker).

Each item is a discrete authorisation. Claude does not author
tests without a specific test-authorship word-trigger.

---

## 7 · What this audit does NOT prove

- A green baseline on the current test suite · 231 failures stand
  unverified against the five-state model (task #58).
- That the D6 sandbox provisioning is feasible without additional
  infra cost · owner infra call.
- That authoring the 10-ish test increments described above is
  trivial · each has edge cases around mocking seams.
- Live-verified claims against production · owner infra per
  sealed 2026-11-08.

Engineering ceiling reached is Verified · inventory + spec level.

---

## 8 · Evidence pointers

Code + docs consulted ·

- `vitest.config.mts`
- `scripts/vitest-stubs/env-loader.ts`
- `scripts/vitest-stubs/server-only.ts`
- `src/app/api/nex-native/billing/checkout/buyer/__tests__/route.test.ts`
- `src/app/api/nex-native/peer-message/encrypted/batch/__tests__/route.test.ts`
- `src/lib/nex-native/__tests__/security-rate-limit.test.ts`
- `src/lib/nex-native/follow/__tests__/follow-rate-limit.test.ts`
- `nex-supabase/migrations/__tests__/g1-rls-harden-217-218.test.ts`
- `docs/doctrine/buyer-checkout-price-validation-audit-2026-11-21.md` (P2-03 four tamper paths)
- `docs/doctrine/peer-message-rls-audit-2026-11-21.md` (P2-04 36-case matrix)
- `docs/doctrine/rate-limit-infra-audit-2026-11-21.md` (P2-05 four tamper paths)
- `docs/doctrine/theme-buyer-ui-wiring-audit-2026-11-21.md` (P2-06 three invariants)
- `docs/doctrine/path-a-order-separation-audit-2026-11-21.md` (P2-07 analytics continuity gate)
- Task #58 status (vitest baseline remediation)
- `docs/release-audit-v1-2026-11-14.md` (P1-A baseline failure flag)

---

## 9 · Readiness classification

| Area | State |
|---|---|
| Route-level test coverage inventory | Built · 15% quantified |
| Gap spec per P2-01..P2-07 audit priority | Built · documented |
| Vitest scaffolding readiness | Verified (code read + file existence) |
| D6 sandbox to unblock 36 RLS tests | Not yet provisioned (owner infra) |
| P2-03 (c)+(d) tests authored | Not yet authored |
| P2-05 four route-level rate-limit tests | Not yet authored |
| P2-06 three UI-invariant tests | Not yet authored |
| P2-07 analytics continuity design doc | Not yet authored |
| Mock-fetch + HMAC signature test wiring | Not yet wired |
| Vault 28-route coverage pass | Deferred (separate priority) |
| Task #58 baseline resolution | In progress |

Engineering ceiling reminder · no finding here may be promoted to
Live-verified. That remains an owner infra call per sealed
2026-11-08.
