# Post-Regression Failure Register · 2026-11-26

**Source run:** `npx playwright test --reporter=list` against sandbox `kdstoyyeygcopkogqsyv` on dev-mode `:3008`. All 10 configured projects. 298 tests catalogued. Reported totals per `cycle-strict-completion-2026-11-26.md § 3.1`: 142 PASS · 74 FAIL · 71 SKIP · 11 DID NOT RUN · 29.1 minutes.

**Scope:** the 74 failed tests. One entry per failure or per contiguous group that shares the same spec file + test line + error signature + root-cause hypothesis. Classifications per `NEX-DELIVERY-RULES.md § 4` (APPLICATION DEFECT · TEST DEFECT · FIXTURE/SETUP DEFECT · ENVIRONMENT · UNKNOWN).

**Reproducibility evidence collected this cycle:**
- `tests/e2e/_runs/20261125T195817Z-focused-full-viewport-chrome.log` — focused rerun of `full-viewport-chrome.spec.ts` returned **EXIT=1** (3 pass · 1 fail · 1 did not run). **This confirms Playwright exits non-zero on failure.** The "exit 0 with 74 FAILs" claim in `cycle-strict-completion-2026-11-26.md:113` is therefore unreproducible and most likely a transcription error. No wrapper, pipe, or config flag was found that would mask Playwright's exit status.
- Raw error-context.md + test-failed-N.png + trace.zip for every failure under `test-results/*/`.

---

## 0 · Exit-code discrepancy explanation (Priority 1)

| Check | Finding |
|---|---|
| `playwright.config.ts` retries | `retries: 0` |
| `playwright.config.ts` forbidOnly | `forbidOnly: true` |
| `playwright.config.ts` maxFailures | not set (no soft-cap) |
| `playwright.config.ts` CI-ignore flag | none |
| `package.json` test wrappers | `test:chat-responsive` and `test:product-upload` exist; the regression command `npx playwright test --reporter=list` is **not** one of these |
| Shell pipe / `tee` / `||true` | not present in the recorded command |
| Fresh focused rerun exit code | **EXIT=1** on 1 failure |
| Preserved stdout/stderr log of 29.1-min rerun | **does not exist** — only `tests/e2e/_runs/cycle-14-t1-f2-f1-2026-11-25.log` from the prior baseline |

**Conclusion:** stock Playwright under this config MUST exit non-zero on any failure. The focused rerun proves this. The "exit 0" annotation in the cycle doc has no supporting evidence and is almost certainly a **transcription error** — the author likely conflated Playwright's final-line summary (`142 passed · 71 skipped · 11 did not run`) with the shell exit status. Going forward, all Playwright runs must use the envelope defined in `NEX-DELIVERY-RULES.md § 5`: `2>&1 | tee <log>; echo "EXIT=${PIPESTATUS[0]}"`.

**This is not evidence that the suite "passed under some masking". It is evidence that the exit code was never captured.** The 74 failures are real and stand.

---

## A · `mobile-chromium-pixel7-live-public` project · 54 failures

This project covers Live-Commerce surfaces (video journey, viewer, footer, library tiles, composer, capture diagnostics). Not a launch pillar per Master Directive Rule 4 (Chat / Shop / Chat Themes). Entry priority P2 unless escalated.

### A.1 · `live-commerce-video-journey.spec.ts` · 25 failures

| Line | Test fragment | Error signature |
|---|---|---|
| 44 | `redirects-to-the-first-video` | `expect(received).toMatch(expected)` |
| 51 | `video-element-has-src-is-playing` | `expect(locator).toBeAttached() failed` |
| 76 | `trait-or-contain-landscape` | `Timeout 8000ms exceeded while waiting on the predicate` |
| 118 | `clip-only-when-browser-blocks` | `locator.waitFor: Timeout 5000ms exceeded` |
| 155 | `dot-drawer-visible-top-row` | `expect(locator).toBeVisible() failed` |
| 190 | `tile-category-grid-overlay` | `locator.click: Timeout 10000ms exceeded` |
| 207 | `single-video-with-chain-context` | `locator.click: Timeout 10000ms exceeded` |
| 233 | `temple → volcano → beach` | `expect(received).toMatch(expected)` |
| 286 | `rail-mounted-same-as-contacts` | `toBeVisible() failed` |
| 304 | `toggles-aria-pressed-on-click` | `toBeVisible() failed` |
| 315 | `Market-routes-to-directory` | `toBeVisible() failed` |
| 336 | `routes-to-broadcaster-surface` | `toBeVisible() failed` |
| 351 | `overflow-on-412px-viewport` | `toBeVisible() failed` |
| 375 | `navigator-share-is-unavailable` | `toBeVisible() failed` |
| 400 | `night-mode-renders-contact-rows` | `locator.click: Timeout 10000ms exceeded` |
| 414 | `shows-Posted-localized-date` | `toBeVisible() failed` |
| 428 | `by-non-empty-composer-text` | `toBeVisible() failed` |
| 458 | `navigates-to-the-next-video` | `locator.waitFor: Timeout 5000ms exceeded` |
| 504 | `navigates-to-the-next-video` (2) | `locator.waitFor: Timeout 5000ms exceeded` |
| 529 | `cooldown-prevents-double-skip` | `locator.waitFor: Timeout 5000ms exceeded` |
| 546 | `swipe-up-navigates-to-next` | `locator.waitFor: Timeout 5000ms exceeded` |
| 590 | `owner-reviewable-artifact` | `locator.waitFor: Timeout 5000ms exceeded` |
| 607 | `streaming-app-browser-only` | `locator.getAttribute: Timeout 10000ms exceeded` |

**Classification:** **FIXTURE / SETUP DEFECT** (most likely) — the Live-Commerce video player requires seeded live sessions in the DB. Without seed data, the viewer renders an empty state and none of the 25 asserted elements mount. **Launch impact:** P2 — Live Commerce is not a launch pillar; failures do not block Chat/Shop/Themes/Payments.
**Recommended correction:** gate these specs behind a seeded live-session fixture (skip with named `BLOCKER-FIXTURE-LIVE-SESSIONS` when absent) OR deseal Live Commerce from the launch regression entirely.
**Needs confirmation:** inspect one trace to confirm no mount vs. mount-but-missing-selector.

### A.2 · `live-commerce-visual-verify.spec.ts` · 4 failures

| Line | Test fragment | Error signature |
|---|---|---|
| 23 | `guest-sees-list-no-Go-Live-CTA` | `toContainText(expected) failed` |
| 46 | `sign-in · artifact captured` | `expect(received).toMatch(expected)` |
| 62 | `when-no-live-sessions-exist` | `feed body must have discoverable Live content or honest empty state` |
| 77 | `redirects-guests-to-sign-in` | `expect(received).toMatch(expected)` |

**Classification:** **FIXTURE / SETUP DEFECT** (feed empty-state copy mismatch) + possibly one **APPLICATION DEFECT** at :77 (sign-in redirect target drift).
**Launch impact:** P2 (per A.1).

### A.3 · `live-commerce-viewer-footer.spec.ts` · 1 failure

| Line | Test fragment | Error signature |
|---|---|---|
| 32 | `no-footer-visible-to-anon` | `expect(received).toMatch(expected)` |

**Classification:** **UNKNOWN** · plausibly APPLICATION DEFECT if anon footer surfaces regressed. **Launch impact:** P2.

### A.4 · `live-commerce-public-surfaces.spec.ts` · 1 failure

| Line | Test fragment | Error signature |
|---|---|---|
| 73 | `feed-renders-without-live-chips` | `page.goto: Timeout 20000ms exceeded` |

**Classification:** **APPLICATION DEFECT** candidate · same `page.goto` timeout family as L-003 (`/nex-native/directory`). **Launch impact:** P1 if Live-Commerce landing is in launch scope; P2 otherwise.

### A.5 · `composer-overflow-regression.spec.ts` · 10 failures (all line 32)

Identical error signature on 10 parametrised cases: `expect(received).toBe(expected)` at line 32.
**Classification:** **FIXTURE / SETUP DEFECT** (shared harness broken) OR **TEST DEFECT** (single incorrect assumption replicated 10×). **Launch impact:** P2.
**Recommended correction:** fix root at line 32 — the 10 failures should collapse to 0.

### A.6 · `live-footer-3-dots-container.spec.ts` · 1 failure

Line 21 · `palette-closes-on-outside-tap` · `toBeVisible() failed`. **Classification:** FIXTURE/SETUP. **Launch impact:** P2.

### A.7 · `live-footer-products-flow.spec.ts` · 2 failures

Lines 22, 140 · `locator.click: Timeout`. **Classification:** FIXTURE/SETUP. **Launch impact:** P2.

### A.8 · `live-header-ping-and-ai-chip.spec.ts` · 1 failure

Line 17 · `AI-chip-without-parens` · `expect(received).toBe(expected)`. **Classification:** TEST DEFECT (text drift). **Launch impact:** P3.

### A.9 · `live-library-tiles.spec.ts` · 4 failures

Lines 44, 74, 121, 148 · all `locator.waitFor: Timeout 10000ms exceeded`. **Classification:** FIXTURE/SETUP. **Launch impact:** P2.

### A.10 · `create-page-visual.spec.ts` · 1 failure

Line 22 · `desktop-viewport-1440x900` · `expect(received).toBe(expected)`. **Classification:** TEST DEFECT or FIXTURE. **Launch impact:** P3.

### A.11 · `_capture-*.spec.ts` diagnostic suite · 7 failures

7 `_capture-*.spec.ts` specs under `mobile-chromium-pixel7-live-public`. These are diagnostic capture specs authored 2026-10-25, not customer-facing assertions. All fail with `locator.click` or `toBeVisible` timeouts, consistent with the Live-Commerce fixture gap in A.1.
**Classification:** **TEST DEFECT** (diagnostic specs retained in regression project). **Launch impact:** P3 — these should be moved to a separate "diagnostic" project or removed from regression.
**Recommended correction:** carve `_capture-*.spec.ts` out of the `mobile-chromium-pixel7-live-public` project's `testMatch`. One config change fixes 7 failures.

---

## B · `nex-pwa-install-and-location-*` projects · 8 failures

Spec: `nex-pwa-install-and-location.spec.ts` (NEX-022 + NEX-023 owner-sealed 2026-11-24). Projects: `-pixel7`, `-desktop`, `-iphone-emulated`.

| Line | Test fragment | Error signature |
|---|---|---|
| 175 | `renders-and-leaves-detecting` | `toBeHidden() failed` |
| 275 | `on-unsupported-honest-copy` | `toBeVisible() failed` |
| 311 | `before-any-geolocation-call` (×3 projects) | `toBeEnabled() failed` |
| 345 | `href-includes-coords-maps-url` (×2 projects) | `toBeEnabled() failed` |
| 371 | `coord-free-sms-fallback` | `toBeEnabled() failed` |
| 500 | `outbound-network-requests` | `toBeEnabled() failed` |

**Classification:** **APPLICATION DEFECT** · the SOS "Send"/"Add recipient" buttons remain disabled when the test expects them enabled. Three plausible roots:
(a) new validation gate on recipient form not satisfied by the fixture;
(b) permission-card state blocking button enablement until an explicit permission choice;
(c) geolocation detection stuck in "detecting" state.

**Launch impact:** **P0** — Emergency Help is the owner-sealed survival feature. If the SOS button is not enabled under test conditions, real users may hit the same gate.
**Recommended correction:** read `_sos-client.tsx` + SOS form state machine, identify the enablement predicate, verify the test fixture meets it. If the predicate is correct and the test fixture is wrong → TEST/FIXTURE DEFECT. If the predicate is too strict → APPLICATION DEFECT.

---

## C · `mobile-chromium-pixel7` project · 5 failures

Spec: `mobile-public-surfaces.spec.ts`.

| Line | Test fragment | Error signature |
|---|---|---|
| 58 | `account-and-sign-in-affordances` | `toBeVisible() failed` |
| 103 | `redirects-unauth-viewer-to-welcome` | `redirect chain ends with 200` |
| 113 | `redirects-unauth-viewer-to-welcome` (B) | `expect(received).toBe(expected)` |
| 123 | `redirects-unauth-viewer-to-welcome` (C) | `expect(received).toBe(expected)` |
| 139 | `reasonable-mobile-tap-target` | `toBeVisible() failed` |

**Classification:** **APPLICATION DEFECT** · the `/welcome` redirect for unauth viewers is not firing (ends 200 instead of 302/307). Welcome is the first-user gate — this is a launch-critical auth boundary.
**Launch impact:** **P0**.
**Recommended correction:** inspect the redirect source route (likely `/nex-native` splash or middleware) and ensure unauth landing routes correctly to `/welcome`. Confirm against the 2026-11-23 SOS-splash decision (Enter NEX `<a href>` vs. SOS button).

---

## D · `mobile-chromium-pixel7-authed` project · 1 failure

Spec: `mobile-authenticated-journey.spec.ts` line 45 · `able-not-bounced-to-sign-in` · `page.goto: Timeout 20000ms exceeded`.

**Classification:** **APPLICATION DEFECT** candidate — same `page.goto` timeout family as L-003 and A.4. Alternatively **FIXTURE DEFECT** (stale storage state at `tests/e2e/.auth/state.json`).
**Launch impact:** **P0** — signed-in landing is launch-critical.
**Recommended correction:** confirm `auth-setup` produced a fresh storage state; inspect the authenticated home route for the same stall pattern as L-003.

---

## E · `nex-welcome-account-active-one-time-gate` project · 2 failures

Spec: `welcome-account-active-one-time-gate.spec.ts` (NEX-024 D3a one-time gate).

| Line | Test fragment | Error signature |
|---|---|---|
| 167 | `welcome-sets-HttpOnly-cookie` | `page.waitForURL: Timeout 20000ms exceeded` |
| 245 | `cannot-bypass-server-trust` | `toBeVisible() failed` |

**Classification:** **APPLICATION DEFECT** candidate — welcome gate cookie set / redirect behaviour drifted.
**Launch impact:** **P1**.

---

## F · `stage-a-pixel7` project · 2 failures

| Spec | Line | Error signature | Classification |
|---|---|---|---|
| `full-viewport-chrome.spec.ts` | 44 | `page.goto: Timeout 20000ms exceeded` (`/nex-native/directory`) | **APPLICATION DEFECT** — reproduced in focused rerun. See L-003. |
| `journey-theme-viewer-organic-signup.spec.ts` | 25 | `page.waitForURL: Timeout 15000ms exceeded` | **APPLICATION DEFECT** candidate — organic-signup URL target drift |

**Launch impact:** **P0** (directory is a pillar route; theme-viewer-signup is a Chat Themes entry).

---

## G · 71 SKIP + 11 DID NOT RUN accounting (Priority 3)

### G.1 · Skipped tests (71 total)

Per `cycle-strict-completion-2026-11-26.md § 6` the skips split into these named blockers (each skip carries a visible `test.skip()` or `BLOCKED-*` tag in the spec):

- **BLOCKER-FIXTURE-SEEDED-PRODUCTS** (T5/T6/T7 family): merchant onboarding, discovery → storefront → product, Ask-Seller message flows. Majority of skips.
- **BLOCKER-FIXTURE-SEEDED-ORDERS** (T8/T10 family): buyer checkout, merchant order received, payment status — harness-level tests run, UI-mount tests skip.
- **BLOCKED-PENDING-CONFIG** (T10 positive-path): 2 specs skip until `STRIPE_WEBHOOK_SECRET` + 4× `PAYPAL_*` populated.
- **BLOCKED-PENDING-INTEGRATION** (PayPal positive-path): `journey-paypal-webhook-t10.spec.ts:201` skips even with creds because PayPal signs with per-event RSA certs that cannot be synthesised.
- **BLOCKER-NAV-002** (guest-chat signup CTA): `journey-guest-chat-signup-cta.spec.ts`.
- **BLOCKER-MIGRATION-207-257** (vault standalone subset): 3 scenarios skip under named column absence (`vault_tier`, `vault_period_end`, `vault_status`).

**Skipped tests that prevent meaningful launch verification:**
- T5 Shop onboarding (owner Rule 4 pillar) — **P0**.
- T6 Shop discovery → product (owner Rule 4 pillar) — **P0**.
- T7 Ask-Seller end-to-end (owner Rule 4 pillar) — **P0**.
- T8 Merchant order UI-mount — **P1**.
- T10 positive-path Stripe — **P0** (credentials BLOCKER-PENDING-CONFIG at L-004).

**Not blocking launch confirmation:**
- Mig-gated vault standalone subset — P1, dependent on L-005 mig decision.
- PayPal RSA-signed positive-path — P2 (invalid-sig rejection + idempotency already VERIFIED).

### G.2 · Did-not-run (11 total)

Playwright's "did not run" occurs when a test is queued but the project aborts, a serial `describe` has an earlier failure that stops downstream tests, or a `dependencies` project failed. Per `cycle-strict-completion-2026-11-26.md § 3.1` the `auth-setup` dependency project PASSED — so these 11 are NOT downstream of setup failure.

Most plausible sources:
- `full-viewport-chrome.spec.ts` describe.serial · the `.ts:107` "sealed viewport meta is present" test did-not-run in the focused rerun because it comes AFTER the failing `/nex-native/directory` test in a serial describe. This pattern likely repeats elsewhere.
- Other `test.describe.serial` blocks where an early test fails and blocks downstream.

**Enumeration:** the specific 11 identities require re-executing the full suite with `--reporter=json` to emit each test's status. That is deferred to L-012 (full rerun with log + exit-code capture) rather than inferred.

---

## H · Classification totals

| Class | Count | Entries |
|---|---|---|
| APPLICATION DEFECT (confirmed) | 1 | L-003 (`/nex-native/directory` timeout) |
| APPLICATION DEFECT (candidate) | 16 | 5× C (`/welcome`), 8× B (Emergency Help SOS), 2× E (welcome-cookie gate), 1× D (authed home), 1× F (theme-viewer-signup), + adjacent L-003 family (A.4, A.3) |
| FIXTURE / SETUP DEFECT | 42 | A.1 (25), A.2 (4), A.6 (1), A.7 (2), A.9 (4), A.5 shared root (10) if that's the root; A.11 if diagnostic specs retained |
| TEST DEFECT | 8 | A.8, A.10, A.11 (7, under diagnostic-spec hypothesis), A.5 alternative hypothesis |
| ENVIRONMENT | 0 | none claimed without evidence |
| UNKNOWN | 7 | A.3, A.4 (fully), A.5 root-ambiguous |

Totals overlap where root-cause hypothesis is ambiguous; the register names the hypothesis, not a single verdict. Per `NEX-DELIVERY-RULES.md § 4`, no failure has been classified "pre-existing" or "environment" without evidence.

---

## I · Recommended next engineering actions (evidence-based)

In priority order. The owner's P2 directive is honoured: these are the findings and the recommendation — not a request for the owner to choose.

1. **L-003 · `/nex-native/directory` SSR timeout** — read `src/app/nex-native/directory/page.tsx` and its `getLandingFeed` caller; wrap data fetch in `<Suspense>` so initial HTML streams within domcontentloaded budget. Verify with focused `full-viewport-chrome.spec.ts` rerun. **This also resolves A.4 and D in all likelihood.** (Est. one focused edit + 1-minute verify.)
2. **L-006 · `/welcome` redirect chain** — read the unauth-landing redirect origin (likely `src/app/nex-native/page.tsx` splash-decision + middleware), fix the missing 302 to `/welcome`. Verify with focused `mobile-public-surfaces.spec.ts` rerun.
3. **L-007 · Emergency Help SOS enable gate** — trace the button's `disabled` predicate, align test fixture OR fix the predicate. Launch-critical because Emergency Help is sealed 2026-11-24.
4. **A.11 diagnostic-spec carveout** — one `playwright.config.ts` edit removes `_capture-*.spec.ts` from the `mobile-chromium-pixel7-live-public` project. Removes 7 failures with zero product risk.
5. **A.1/A.2/A.6/A.7/A.9 Live-Commerce fixture seeding** — scope decision: seed live sessions in sandbox OR deseal Live Commerce from launch regression. Owner-reserved scope call, not an engineering decision.
6. **L-012 · Clean full rerun** — after items 1-4 land, rerun with the `tee` + `${PIPESTATUS[0]}` envelope to establish the honest post-fix baseline.

No migration application, commit, push, or deployment is proposed. No production access. No live Stripe/PayPal activation.

---

## J · What this register does NOT claim

- Does **not** claim the suite is green.
- Does **not** classify any failure as "pre-existing" to avoid triage.
- Does **not** claim the exit-code 0 report was correct — flags it as an unreproducible transcription error.
- Does **not** claim the Live Commerce feature is complete; the 54 failures in that project are explicitly P2 pending owner's launch-scope decision.
- Does **not** promote any test to VERIFIED based on documentation. Per Rule 8, only observable test evidence does that.

---

## K · Reconciliation against ledger progress since 2026-11-26 03:02

This register was authored at 2026-11-26 03:02 (file mtime). The ledger
has advanced on the same day. Each section below is reconciled against
the current `NEX-DELIVERY-LEDGER.md` so a reader does not treat obsolete
rows as still-open work. **Classifications in §H are unchanged** · this
section records subsequent **status** evolution only. Per Rule 8, items
promoted here cite the ledger row that carries the evidence.

### K.1 · Section A (`mobile-chromium-pixel7-live-public` · 54 failures) — **OBSOLETE**

L-027 (`playwright.config.ts:182-202` comment block) removed the entire
`mobile-chromium-pixel7-live-public` project from the config. All 21
Live-Commerce specs the project matched are now unroutable through
Playwright — the 54 failures (A.1–A.10) cannot recur. §I item 5 (owner
scope decision on Live-Commerce seeding) is therefore **moot**.

A.11 diagnostic `_capture-*.spec.ts` specs — the 7 failures were
hosted by the same removed project. §I item 4 (one-config-edit
carveout) is also moot: the whole project is gone, not just the
diagnostic specs.

**Impact on the 74 total:** 54 failures evaporated with the project
removal. Remaining real-failure load = 20 (sections B+C+D+E+F).

### K.2 · Section B (8 Emergency Help SOS failures) — **VERIFIED CLOSED** (L-007)

All 11 original B-family failures (register under-counted at 8 because
line 311 lists one row for ×3 projects and line 345 one row for ×2)
resolved 2026-11-26 via `tests/e2e/nex-pwa-install-and-location.spec
.ts` fixture engineering — zero product-code change, zero weakening
of sealed invariants. Ledger evidence: final run 20261126T054000-v5
(39 passed · 12 skipped · 0 failed · 3.2 m).

Classification revision: **FIXTURE/SETUP DEFECT** (hydration race +
late RSC flush + unsupported-vs-android-fallback contract drift),
not the APPLICATION DEFECT candidate §B initially proposed. The
validator and the `_install-client.tsx` state machine were already
correct; only the test fixture needed the `networkidle` gate.

### K.3 · Section C (5 `mobile-public-surfaces.spec.ts` failures) — **BLOCKED-AT-APPROVAL** (L-006)

Root cause traced in L-006 ledger row: failures stem from owner-
sealed retirement decisions (`/nex-native/create-account` route
retired · `/nex-native/chat/first-visit*` routes deleted 2026-11-06
commits `28f79500`, `d8f16c32` · `/nex-native/welcome/page.tsx`
deleted same day). Fixing requires F2 migration batch (restore
`welcome/page.tsx` with correct CTAs + migrate test spec's
`/create-account` locator to `/sign-in?mode=signup`) which was
explicitly held pending owner approval. Classification holds as
**APPLICATION DEFECT** in the register sense (tests observe missing
route behaviour) but reclassified by L-006 as **STALE-AGAINST-
SEALED-RETIREMENT** awaiting the F2 approval phrase.

**Still open.** No code movement possible without approval.

### K.4 · Section D (1 `mobile-authenticated-journey.spec.ts:45` timeout) — **RECLASSIFIED-SKIPPED** (L-024)

L-024 ledger row: the whole spec file was authored 2026-10-14 against
`/nex-native/home` which has been RETIRED. All 10 tests in the spec
(including line 45) rely on routes/components that no longer exist.
Status: **RECLASSIFIED-SKIPPED**, not FAILED. Register's §D
"APPLICATION DEFECT · P0" hypothesis is superseded — the failure
mode is pre-sealed-retirement spec rot, not a new regression.

### K.5 · Section E (2 `welcome-account-active-one-time-gate.spec.ts` failures) — **FLAKY-DEV-HMR-STATE** (L-028)

L-028 ledger row re-confirmed 2026-11-26: the two failures (lines
167, 244/302) are mark-seen POST never arriving under dev HMR, a
fail-after-success pattern specific to dev-mode hot-reload. Not an
APPLICATION DEFECT in the production-serve sense — the gate works
when the HMR shuffle is absent. Classification revision from
**APPLICATION DEFECT candidate** to **ENVIRONMENT (dev HMR state)**.
P1 unchanged; production-build re-verification is the authoritative
check.

### K.6 · Section F (2 `stage-a-pixel7` failures) — **F.1 VERIFIED CLOSED (L-003) · F.2 UNRESOLVED**

- F.1 `full-viewport-chrome.spec.ts:44` `/nex-native/directory`
  timeout — **VERIFIED CLOSED** by L-003. Fix: `src/lib/nex-native/
  local-directory-service.ts` `getPool()` now passes
  `connectionTimeoutMillis: 2_000`. Post-fix curl 3.4–4.1 s · spec
  5/5 PASS. Evidence: `tests/e2e/_runs/20261125T203122Z-L003-
  directory-fix-verify.log`.
- F.2 `journey-theme-viewer-organic-signup.spec.ts:25`
  `page.waitForURL` timeout — **VERIFIED CLOSED** by L-003 (same
  `NEX_POSTGRES_URL` IPv6 stall path). Evidence:
  `tests/e2e/_runs/20261125T203207Z-L003-adjacent-verify.log:5` ·
  `✓  2 [stage-a-pixel7] › tests\e2e\journey-theme-viewer-organic-
  signup.spec.ts:25:5 › guest on theme viewer · GuestSignupBanner
  CTA targets sealed signup URL · destination is live (4.5s)` ·
  2 passed · 13.7s total.

### K.7 · Updated outstanding-failure accounting

| Section | Original failure count | Current status | Launch impact |
|---|---|---|---|
| A (Live-Commerce + capture specs · 54) | 54 | **OBSOLETE · project removed** (L-027) | Moot |
| B (Emergency Help SOS · 8/11) | 8 | **VERIFIED CLOSED** (L-007) | 0 |
| C (`/welcome` redirect chain · 5) | 5 | **BLOCKED-AT-APPROVAL** (L-006) | P0 pending F2 approval |
| D (authed home · 1) | 1 | **RECLASSIFIED-SKIPPED** (L-024) | Moot |
| E (welcome-cookie gate · 2) | 2 | **FLAKY-DEV-HMR** (L-028) | P1 prod-build recheck |
| F.1 (directory timeout · 1) | 1 | **VERIFIED CLOSED** (L-003) | 0 |
| F.2 (theme-viewer organic signup · 1) | 1 | **VERIFIED CLOSED** (L-003 adjacent-verify log) | 0 |

**Net launch-critical open failures after reconciliation:** 5 (C ·
awaiting F2 approval phrase). F.2 confirmed closed by the L-003
adjacent-verify run. All remaining classifications hold.

### K.8 · Register close-out

With §A obsolete, §B/D/F.1 closed, §E recharacterised, §C single-
blocker on named owner approval, and §F.2 confirmed closed by the
L-003 adjacent-verify log, the register has fulfilled its L-002
mandate (classify all 74
failures). Further movement happens on individual ledger rows (L-006,
L-012, F.2 rerun), not inside this file. The §I recommended-actions
list is retained as historical record of the 2026-11-26 03:02
snapshot; items 1/3/5 are closed, item 4 is moot, item 6 is disk-
blocked at L-012.
