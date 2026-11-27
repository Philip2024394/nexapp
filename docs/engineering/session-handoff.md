# Session Handoff

**One record. The next session reads this first.**

Keep this file short. It answers: Where are we? What is safe to do next?
What requires the owner before continuing?

---

## Current state · 2026-11-27 (L-053 · migration 369 corrections + app-side sync + free-chat themes UI refresh · HEAD advanced to `<pending commit>`)

**Delta from the NEX-024 cycle 2 block below.** Owner directives:
(a) comprehensive migration 369 review — 6 numbered sections flagged (RLS identity model, rollback data-loss disclosure, sync monotonicity, shop identity canonicality, migration conventions, continuation to implementation);
(b) UI change spec on `/nex-native/free-chat?show-themes=1` (orange ping rim, Ne-black-x-orange "Make Nex Yours" header, gear-icon button, gray-on-cream guest subtitle, gray-infill category cards). Standing-policy commit+push authority in force for `release-audit-v1-2026-11-14` (sealed 2026-11-27). CLAUDE.md Rule 7 clauses on prod, `main`, migration-apply, live Stripe/PayPal preserved.

**Deltas:**

- **Migration 369 rewritten (cycle 2).** `nex-supabase/migrations/369_nex_account_shop_install_prefs.sql` RLS switched from the wrong `auth.uid() = account_id` pattern to the sealed `account_id IN (SELECT nex_current_account_ids())` helper (migration 010:48-55) — same pattern as `nex_business` / `nex_order`. `shop_slug` CHECK is now the byte-for-byte same regex as `nex_business.slug` (`'^[a-z0-9]([-a-z0-9]{0,62}[a-z0-9])?)`, 1..64 bytes). **Adjacent finding (NOT touched)**: migration 366 (`nex_notification`, line 140) carries the same `auth.uid() = account_id` bug — flagged in the forward header for a separate owner-approved review. Rollback `369_..._rollback.sql` rewritten with a `DATA-DESTRUCTIVE ROLLBACK · READ BEFORE RUNNING` banner, the three user-visible consequences enumerated, `pg_dump --data-only` pre-rollback backup procedure, and `psql --single-transaction` recovery procedure. Migration file DRAFTED; **NOT APPLIED** — sandbox-apply requires the dedicated phrase `APPROVE NEX_ACCOUNT SHOP_INSTALL_PREFS MIGRATION SANDBOX (REVISED 2026-11-27)`.
- **App-side sync BUILT + WIRED.** `src/lib/nex-native/shop-install/sync-shop-install-prefs.ts` (NEW) is a `"use server"` module exposing the pure `mergeShopInstallRecords` merge rule (MAX dismissals · earliest first_dismiss_at · OR suppressed · OR installed · invariant repair when dismissals≥1 and both sides null) plus `syncShopInstallPrefs` / `syncShopInstallPrefsBatch` server actions. The sync action detects `42P01` / `PGRST205` and returns `{ok:true, merged:client, applied:false}` so the code ships before the migration lands without errors. `src/components/nex-native/shop-install/use-shop-install-flow.ts` was appended with `useSignedInShopInstallSync` hook + `readLocalRecordForSlug` + `writeMergedToLocal` (additive — guest path through `useShopInstallFlow` / `useShopInstallDismissal` untouched).
- **Unit tests VERIFIED.** `src/lib/nex-native/__tests__/sync-shop-install-prefs.test.ts` (NEW · 11 vitest cases · all PASS) exhaustively exercises the merge rule: no server row · higher dismissals both directions · first_dismiss_at earliest-wins · null-side uses non-null · OR semantics for suppressed/installed · monotonicity/idempotence · invariant repair · dismissals=0 forces null.
- **RLS integration spec NOT EXECUTED.** `tests/e2e/nex-account-shop-install-prefs-rls.spec.ts` (NEW) covers positive own-read + negative cross-account read/insert/update/delete + preserved server rows + teardown. Skip-gated via `hasInstallPrefsTable()` querying `information_schema.tables`. Promotes to VERIFIED only when migration lands under the dedicated approval phrase.
- **UI refresh VERIFIED (visually).** `src/app/nex-native/free-chat/page.tsx` + `_canvas-client.tsx` + `public/nex-brand/glossy-gear-question-mark.png` landed per owner spec — orange ping (`#F97316`) + gray-on-cream guest subtitle (`#6B7280`) + "Make <span color:#000>Ne</span>x Yours" (20px, Ne black + x orange) + "First Theme Free" sub-line + 34×34 gear-icon button + gray-infill category cards (`#F3F4F6` infill, `#E5E7EB` border, `#F97316` 16px bold title).

**Files changed this cycle (standing-policy commit candidates):**

- `nex-supabase/migrations/369_nex_account_shop_install_prefs.sql` (NEW)
- `nex-supabase/migrations/369_nex_account_shop_install_prefs_rollback.sql` (NEW)
- `src/lib/nex-native/shop-install/sync-shop-install-prefs.ts` (NEW)
- `src/lib/nex-native/__tests__/sync-shop-install-prefs.test.ts` (NEW)
- `tests/e2e/nex-account-shop-install-prefs-rls.spec.ts` (NEW · skip-gated · NOT EXECUTED)
- `src/components/nex-native/shop-install/use-shop-install-flow.ts` (MODIFIED · additive hook)
- `src/app/nex-native/free-chat/page.tsx` (MODIFIED · orange ping + gray subtitle)
- `src/app/nex-native/free-chat/_canvas-client.tsx` (MODIFIED · header/cards/gear)
- `public/nex-brand/glossy-gear-question-mark.png` (NEW · brand asset)
- `docs/engineering/NEX-DELIVERY-LEDGER.md` (L-053 row)
- `docs/engineering/session-handoff.md` (this block)

**Rule 7 posture:** No commit yet. No push yet. No migration applied. No production touched. No credential activated. No sealed invariant broken. Prior HEAD from the NEX-024 cycle-2 block remains `e0bd3c3e`; this block will be committed under the sealed 2026-11-27 standing source-control policy on `release-audit-v1-2026-11-14`.

**Next safe action (no approval needed · continue inside Rule 7):**

- Commit L-053 artefacts and push to `Philip2024394/nexapp` on `release-audit-v1-2026-11-14`.
- Continue the finish-the-application queue (Chat/Shop/Themes integration · merchant onboarding → orders → notifications · chat privacy / emergency / device-storage · nav+country identity with browser evidence).

**Next action requiring owner authorisation (ONE phrase at a time):**

- `APPROVE NEX_ACCOUNT SHOP_INSTALL_PREFS MIGRATION SANDBOX (REVISED 2026-11-27)` — lets the integration RLS spec actually execute end-to-end against sandbox `kdstoyyeygcopkogqsyv`. Blocks the NOT-EXECUTED → VERIFIED transition for the RLS isolation contract.
- All other named phrases unchanged — see `docs/engineering/consolidated-approval-queue-2026-11-27.md`.

---

## Current state · 2026-11-27 (NEX-024 cycle 2 · branded shop install VERIFIED · HEAD advanced to `<pending commit>`)

**Delta from addendum 8.** Owner directive: *"next concrete engineering action"* against the NEX-024 feature. Standing-policy commit+push authority still in force for `release-audit-v1-2026-11-14` (sealed 2026-11-27). CLAUDE.md Rule 7 clauses on prod / main / migration / live Stripe preserved.

**Deltas:**

- **NEX-024 branded shop install flipped from BUILT · WIRED · NOT VERIFIED → BUILT · WIRED · VERIFIED.** Previous cycle shipped the four components + per-shop manifest route + storefront mount (commit `e0bd3c3e`) but left the Playwright spec `test.fixme`-gated on `BRANDED_INSTALL_FIXTURE_SLUG`. This cycle rewrote `tests/e2e/branded-shop-install.spec.ts` to self-seed a sandbox `nex_business` via `createTestAccount` + `createTestBusiness` in `beforeAll`, tear down in `afterAll`, and assert zero residuals. Spec no longer depends on any env var. Registered in `playwright.config.ts` `mobile-chromium-pixel7` project (public-surface, no auth-setup dep).
- **Run3 evidence `tests/e2e/_runs/20261127T084620Z-NEX-024-branded-install-run3.log`** · **12 passed · 1 skipped · 47.8 s · EXIT=0.** G10 (`display-mode:standalone`) explicitly `test.skip` with reason — Playwright can't emulate standalone PWA mode without a real installed shortcut; the `isStandalone` branch is unit-level and transitively validated by G09.
- **One fix-then-pass** preserved as audit trail: run2 surfaced a TEST DEFECT in G01 (`button.textContent()` concatenated the avatar initial glyph, so `startsWith("Download ")` saw e.g. `"EDownload …"`). Corrected by asserting against the sealed `aria-label="Download {name} to your phone"` at `BrandedInstallButton:169` — the component's accessibility contract and the canonical "Download <name>" source of truth. Zero product-code change. Run1 (auth-setup project) failed on missing `NEX_ADMIN_EMAILS` / `NEX_ADMIN_DEV_PASSWORD` env vars — FIXTURE/SETUP DEFECT corrected by relocating the spec from `stage-a-pixel7` (auth-dep) to `mobile-chromium-pixel7` (public-surface, no auth needed).
- **Sandbox cleanliness confirmed**: `assertNoResidualFixtures(handles)` did not throw in `afterAll`. Ephemeral `e2e-fixture-branded-install-<suffix>` row created and deleted within the single run.
- **Real iOS Safari NOT verified** — WebKit not installed; G11 Chromium-sniffs the iOS UA. Called out explicitly in the spec docstring.

**Files changed this cycle (standing-policy commit candidates):**
- `tests/e2e/branded-shop-install.spec.ts` — rewritten to self-seed + register the 13 cases
- `playwright.config.ts:80` — `mobile-chromium-pixel7` testMatch extended with `branded-shop-install\.spec\.ts`
- `docs/product/feature-ledger.md` — NEX-024 row + detail section + reconciliation-log entry flipped to VERIFIED
- `docs/engineering/NEX-DELIVERY-LEDGER.md` — NEX-024 cycle-2 decisions-log entry
- `docs/engineering/session-handoff.md` — this block
- `tests/e2e/_runs/20261127T084424Z-NEX-024-branded-install.log` — run1 (routing failure, preserved)
- `tests/e2e/_runs/20261127T084522Z-NEX-024-branded-install-run2.log` — run2 (test-defect fix-then-pass)
- `tests/e2e/_runs/20261127T084620Z-NEX-024-branded-install-run3.log` — run3 (12 passed · 1 skipped · EXIT=0)

**Rule 7 posture:** Prior HEAD `e0bd3c3e` (NEX-024 cycle-1 commit). Pending new standing-policy commit for this cycle's artefacts (sandbox-only · dev branch). No push to `main`. No production touched. No migration applied. No credential activated. No sealed invariants broken.

**Next safe action (no approval needed · continue inside Rule 7):**

- Draft the `nex_account_shop_install_prefs` migration file for signed-in dismissal reconciliation (applying to sandbox requires a dedicated named approval phrase).
- Extend nav inventory for drawer-rows reachable without migration dependency.
- Author additional perf-regression specs under the §10 DoD.

**Next action requiring owner authorisation (ONE phrase at a time):** unchanged — see `docs/engineering/consolidated-approval-queue-2026-11-27.md`.

---

## Current state · 2026-11-27 (continuation cycle addendum 8 · sign-in public-surface regression PROMOTED + VERIFIED)

**Delta from addendum 7.** Continuation of 2026-11-27 directive *"continue with next"*. No new owner authorisation. Rule 7 preserved: no commit · no push · no migration applied · no credential activated · no production touched. HEAD remains `9dfa90b4`.

**Deltas:**

- **Sign-in public-surface regression PROMOTED to durable spec + VERIFIED.** Addendum 6 recorded a throwaway diagnostic (`tests/e2e/probe-signin-crash.spec.ts` + `tests/e2e/probe.playwright.config.ts`) that proved the cream fallback appears only on genuine error states. The investigation is closed. Rather than delete the signal, it is promoted into `tests/e2e/regression-sign-in-public-branches.spec.ts` under the public `mobile-chromium-pixel7` project (no auth dependency). The spec covers 6 URL branches — `/nex-native/sign-in`, `?mode=signup`, 3 OAuth error-copy variants (`oauth_unavailable` / `oauth_cancelled` / `oauth_exchange_failed`), and `?next=/nex-native/profile` — and asserts on each: HTTP status > 0, `[data-nex-segment-error='auth']` NOT visible, and `page.on('pageerror')` list is empty at the end of the test window. Evidence: `tests/e2e/_runs/20261127T-regression-sign-in-public-branches-run2.log` · **6/6 passed · 41.1 s · EXIT=0**. The initial run against `stage-a-pixel7` failed on the `auth-setup` dependency (`locator('[data-nex-dev-pass-form]') ... 13 × resolved to 0 elements`); the regression was moved to the public project where this surface is genuinely tested as unauthenticated. The two probe files were removed to prevent a stale duplicate.
- **playwright.config.ts:80** testMatch for `mobile-chromium-pixel7` extended with `regression-sign-in-public-branches\.spec\.ts`. No change to any product code. The stage-a-pixel7 project was not modified — its auth-dependency chain is preserved intact.
- **Shared SegmentErrorBoundary contract remains anchored** at `src/components/nex-native/section-boundary/__tests__/SegmentErrorBoundary.test.tsx`. The new regression is a browser-level signal that complements (does not duplicate) the vitest contract at `src/app/nex-native/sign-in/__tests__/error-fallback-contract.test.tsx` from addendum 7.

**Rule 7 posture:** No commit executed. No push executed. No migration applied. No credential activated. No production touched. HEAD remains `9dfa90b4`. All sealed invariants preserved.

**Next safe action (no approval needed · continue inside Rule 7):**

- Chat/Shop/Themes regression slices as catalogued in addendum 6 (harness capability already supports plaintext peer-chat seeding).
- Nav inventory extension for drawer-rows reachable without migration dependency.
- Author additional perf-regression specs under the §10 DoD.

**Next action requiring owner authorisation (ONE phrase at a time):** unchanged — see `docs/engineering/consolidated-approval-queue-2026-11-27.md`.

---

## Current state · 2026-11-27 (continuation cycle addendum 7 · sign-in cream fallback contract VERIFIED + L-006 fresh baseline captured)

**Delta from addendum 6.** Owner directive 2026-11-27 (late cycle): *"Continue NEX engineering. Do not wait for migration 286 approval or further layout instructions. Pick up the next genuinely unblocked launch-critical work: (1) advance L-006 to the extent that does not require a founder decision; (2) continue closing navigation browser-verification gaps; (3) preserve verified work; (4) continue with independent launch-critical fixes."* Rule 7 preserved: no commit · no push · no migration applied · no credential activated · no production touched. HEAD remains `9dfa90b4`.

**Deltas:**

- **L-006 fresh baseline captured** against unchanged HEAD per correction plan § 4.1. Ran `npx playwright test tests/e2e/mobile-public-surfaces.spec.ts --reporter=line` → **3 passed · 5 failed · EXIT=1 · 27.8 s**. Failure fingerprint matches the preserved 2026-11-26 baseline exactly (lines 58 · 103 · 113 · 123 · 139). Hazard has not drifted since diagnosis. Evidence: `tests/e2e/_runs/20261127T-L006-fresh-baseline.log`. The 5 failures remain BLOCKED-AT-APPROVAL on L-006 Options A/B/C (owner URL-surface decision). Picking A/B/C requires founder authorisation per correction plan § 6 — not attempted this cycle.
- **Sign-in cream error fallback contract VERIFIED (new).** Previous cycle report noted "Try again + Go home buttons on cream fallback · NOT VERIFIED (requires synthetic crash to exercise)". Closed as a focused unit regression via vitest/jsdom at `src/app/nex-native/sign-in/__tests__/error-fallback-contract.test.tsx` · **9 tests · all passed · 102 ms tests / 5.09 s total · EXIT=0**. Contracts proven (observable DOM + wired callbacks): (1) `role="alert"` + `data-nex-segment-error="auth"` + `aria-live="polite"` shell; (2) sealed copy "Sign in couldn't load right now." + "other surfaces are unaffected" rendered; raw `error.message` NEVER leaked into DOM (leak canary assertion); (3) Try again rendered as a real `<button type="button">` + Go home rendered as `<a href="/nex-native">`; (4) clicking Try again invokes the Next.js `reset` callback exactly once; (5) `Reference · <digest>` line renders inside `<code>` when `error.digest` is set and is entirely absent when not; (6) mount emits exactly one POST to `/api/nex-native/incident/section-error` with `section:"auth"`, `keepalive:true`, `cache:"no-store"`, and `message_short` clipped to the 120-char cap; (7) `\n` / `\t` in the message are flattened by the `clipMessage()` `/\s+/` replace before POST; (8) rejected incident POST does not throw and the alert DOM remains mounted. Evidence: `tests/e2e/_runs/20261127T-L006-signin-fallback-contract-run1.log`.
- **Shared SegmentErrorBoundary already tested** at `src/components/nex-native/section-boundary/__tests__/SegmentErrorBoundary.test.tsx`. Not a gap. The new sign-in test is self-contained per the 2026-11-27 directive (cream fallback is a palette-matched replacement for the sign-in segment only · dark-emerald shared boundary preserved for ~15 other segments).
- **L-006 Options A/B/C / mig 286 / F3 / T10 / mig 206 / region_pref migration remain BLOCKED-AT-APPROVAL** · catalogue unchanged from `docs/engineering/consolidated-approval-queue-2026-11-27.md`. No approval phrase issued or acted on this cycle. Mig 286 revised SQL (2026-11-27 DO $$ guard correction) still awaits the exact phrase `APPROVE MIG 286 SANDBOX APPLY (REVISED 2026-11-27)`.

**Rule 7 posture:** No commit executed. No push executed. No migration applied. No credential activated. No production touched. HEAD remains `9dfa90b4`. All sealed invariants preserved.

**Next safe action (no approval needed · continue inside Rule 7):**

- Chat/Shop/Themes regression slices as catalogued in addendum 6 (do not require new fixture roles beyond existing harness capability).
- Nav inventory extension for drawer-rows reachable without migration dependency.
- Author additional perf-regression specs under the §10 DoD.

**Next action requiring owner authorisation (ONE phrase at a time):** unchanged from addendum 6 — see `docs/engineering/consolidated-approval-queue-2026-11-27.md`. The 2026-11-27 revised mig 286 SQL is held pending `APPROVE MIG 286 SANDBOX APPLY (REVISED 2026-11-27)`.

---

## Current state · 2026-11-27 (continuation cycle addendum 6 · reconciliation · F3 safe-prep + L-006 correction plan + consolidated approval queue)

**Delta from addendum 5.** Owner directive 2026-11-27 (7-point): mark the final 16-section launch report complete in the 60-task tracker; record mig 368, NAV-04/05, L-006 diagnosis and F3 accurately as drafted or diagnosed (NOT implemented or verified); prioritise F3 safe preparation; prepare the complete L-006 correction + verification plan; check for any independent authorised work; keep all ten approval gates in one consolidated queue; do not reopen VERIFIED tasks without evidence; deliver fixes where authorised. Launch readiness remains NOT READY.

**Deltas:**

- **Task #71 (Final 16-section launch-readiness report) → completed** in the task tool. The report at `docs/engineering/final-launch-readiness-report-2026-11-27.md` is written. Overall launch readiness unchanged: NOT READY (launch-ready phrase BANNED per sealed 2026-11-25 directive).
- **F3 safe-prep authored** at `docs/engineering/f3-hq-journey-map-gate-safe-prep-2026-11-27.md`. Packages the exact 3-import + 6-guard-line patch for `src/app/nex-native/hq/journey-map/page.tsx`, the 4-line header-comment replacement, the regression spec text for `tests/e2e/regression-hq-journey-map-admin-gate.spec.ts` (held — not written), the testMatch alternation fragment for `playwright.config.ts:157`, baseline + fix-verify log names, and the sole approval phrase `APPROVE F3 PATCH APPLY`. Patch is defensive-only (adds a lock) and strictly less risky than a loosening change; Rule 12 still reserves the decision to the owner.
- **L-006 correction plan authored** at `docs/engineering/l-006-correction-and-verification-plan-2026-11-27.md`. Preserves the "16 emitters" headline figure from the prior diagnosis. Classifies those 16 references as **7 user-reachable live emitters** (component CTAs/banners/drawer in `CreateAccountPrompt`, `LockedSettingsButton`, `visitor-interact-popup`, `control-drawer-client`, `start-checkout-client`, `_guest-chat-client`, `_guest-signup-banner`) vs **9 comment/history lines across 5 files** (header comments and action-registry history in `src/app/page.tsx`, `src/app/nex-native/page.tsx`, `_actions.ts`, `_install-home-slider-dismiss-action.ts`, `sign-in/page.tsx`). Three apply-branches detailed (Option A shim · Option B rewire 7 emitters · Option C shim + child-route retention) with exact spec-rewrite table against the 8 assertions in `tests/e2e/mobile-public-surfaces.spec.ts` and the 5-step verification plan. No prior-diagnosis re-audit.
- **Consolidated approval queue authored** at `docs/engineering/consolidated-approval-queue-2026-11-27.md`. 15 rows across 10 distinct approval classes (F3 · L-006 · MIG 286 · MIG 368 · MIG 206 · MIG 354-365 · L-005 · T10 · L-044 commit · L-044 push). Supersedes scattered approval-phrase references in prior addenda and `remaining-work-register-2026-11-26.md` §D. Rule: no end-of-cycle report re-enumerates phrases — reference this file by path.
- **Ledger decisions-log entry added** (dated 2026-11-27) recording the three new docs, the correction scope, and the explicit "no VERIFIED task reopened · no new approval phrase introduced" bounds. **L-006 row updated** to point at the new correction plan without regenerating the diagnosis.
- **Status accurately recorded**: mig 368 DRAFTED (not applied) · NAV-SINGLE-APP-04/05 spec DRAFTED and `test.skip`-gated on `hasRegionPrefColumn()` · F3 DIAGNOSED + PREP COMPLETE (not applied) · L-006 BLOCKED-AT-APPROVAL with correction plan ready · launch readiness NOT READY.

**Rule 7 posture:** No commit executed. No push executed. No migration applied. No credential activated. No production touched. HEAD remains `9dfa90b4`. All sealed invariants preserved.

**Next safe action (no approval needed · continue inside Rule 7):**

- Author remaining Chat-pillar, Shop-pillar, or Themes-pillar regression slices that do not require new fixture roles beyond harness capability.
- Extend nav inventory for any drawer-row that becomes reachable without migration dependency.
- Author additional perf-regression specs under the §10 DoD without touching protected branches.

**Next action requiring owner authorisation (ONE phrase at a time):** see `docs/engineering/consolidated-approval-queue-2026-11-27.md` — 15 rows across 10 classes. Highest-priority rows: `APPROVE F3 PATCH APPLY` (security defect prep complete) · `APPROVE L-006 OPTION A` (customer-journey correction plan complete) · `APPROVE MIG 286 SANDBOX APPLY` (NAV-SINGLE-APP-01 and 3 downstream specs) · `APPROVE NEX_ACCOUNT REGION_PREF MIGRATION SANDBOX` (NAV-SINGLE-APP-04/05).

---

## Current state · 2026-11-27 (continuation cycle addendum 5 · L-043 VERIFIED · harness extended)

**Delta from addendum 4.** Owner directive: *"Proceed with L-043 now. Extend the sandbox test harness with the missing seedChatPeer, createTestConversation and createTestMessage helpers. Preserve the existing chat encryption, device-key privacy, RLS, ownership and storage requirements."* Delivered under existing Rule-7 authority.

**Deltas:**

- **L-043 · Chat-pillar hydration regression VERIFIED on first run.** Evidence: `tests/e2e/_runs/20261127T-L043-portrait-bloom-run1.log` · **2 passed · 45.0 s · 34.1 s inside the regression · EXIT=0**. All three contracts PASS under `locale:"en-GB"` + `timezoneId:"Asia/Jakarta"` against a Node host with distinct locale/tz: SSR figure-space placeholder + `Rp 1,000,000` + no `17:00`; post-hydration bubble swap to `17:00` with `Rp 1,000,000` preserved; zero React hydration warnings. The 9dfa90b4 fix (formatBubblePrice `"en-US"` pin + `<ClientMessageTime>` wrapper) survives real-browser hydration end-to-end.
- **Harness extended within authority**: `tests/e2e/_fixtures/sandbox-test-harness.ts` gained `ChatPeerHandle` + `createTestConversation` + `createTestMessage` + `seedChatPeer`. All writes via service-role admin, assertSandboxRef-guarded. Plaintext mode only (encrypted=false · all crypto cols NULL · mig 093 shape CHECK satisfied). UUID canonical ordering honours mig 047 `participant_a_id < participant_b_id`. Product bubble projected on `attachment_meta.product` (shell meta-detects per peer/page.tsx:1004-1016 — mig 306 CHECK forbids `'product'` on `attachment_type`). Peer-chat tables CASCADE on `nex_account` delete (mig 047:50, 047:75-76) so no new teardown path needed.
- **Spec corrected to production attribute names**: `[data-nex-portrait-bloom-shell]` → `[data-nex-message-scroll]`, `data-nex-message-id` → `data-nex-msg-id`. Zero product-code change in the shell — test contract adapts to observable DOM, not vice versa. `FIXTURE_HELPER_AVAILABLE=true`, placeholder throw-stub + dead `supabaseAdmin` import pin removed.
- **playwright.config.ts:157** testMatch regex extended with `regression-l043-chat-portrait-bloom-hydration\.spec\.ts`.

**Rule 7 posture:** No commit executed. No push executed. No migration applied. No credential activated. No production touched. HEAD remains `9dfa90b4`. All sealed invariants preserved (device-only chat storage · E2E encryption path · RLS policies · ownership gates · storage bucket rules).

**Next safe action (no approval needed · continue inside Rule 7):**

- Audit remaining Chat-pillar regression candidates discovered during L-043 (none surfaced in this pass — the 9dfa90b4 L-043 fix was the targeted hazard).
- NAV-SINGLE-APP-04/05 remain BLOCKED on an un-authored `nex_account.region_pref` migration (distinct approval class from mig-286).
- NAV-SINGLE-APP-01 remains BLOCKED on mig-286 sandbox apply.
- HQ Axis A desktop slice remains BLOCKED on mig 206.

---

## Current state · 2026-11-27 (continuation cycle addendum 4 · NAV-SINGLE-APP-06 VERIFIED · L-051 opened + closed)

**Delta from addendum 3.** Owner master directive 2026-11-26 explicitly named NAV-SINGLE-APP-06 as a cycle target to be completed under existing authority ("complete all code, region mapping, validation, error handling and test preparation that does not require live payment credentials"). This tick delivered it under Rule 7.

**Deltas:**

- **L-051 · NAV-SINGLE-APP-06 (checkout-region correctness) VERIFIED**. Authored `tests/e2e/journey-single-app-06-checkout-region.spec.ts` (5 tests: GB/US/ID via `cf-ipcountry` + IE control via `en-IE` Accept-Language). Each test mints a fresh fixture account, signs in, then POSTs `/api/nex-native/billing/checkout/shop` with the header injected at context + request level. The route's `resolveRegion` delegates to the sealed `resolveViewerRegion` 5-tier chain. The spec asserts the response body echoes the resolved region — on 422 (`missing_price_id` for GB/US/ID price IDs unset) OR on 200 (test-mode session created for IE where EUR price ID is set). Live-mode safety guard present: any `cs_live_` substring in a 200 URL FAILs the test (never silent SKIP). Strict teardown + `assertNoResidualFixtures`. Evidence: `tests/e2e/_runs/20261127T-NAV-SINGLE-APP-06-run3.log` · **5 passed · 0 failed · 54.7 s · EXIT=0**. Prior run1/run2 preserved as fix-then-pass audit trail.
- **Narrow additive route change**: `src/app/api/nex-native/billing/checkout/shop/route.ts:215-227` now echoes `region` in the 200 response body (was only present on 422). Comment added explaining the observability purpose. Zero change to 401/422/500 shapes, no new dependency, no behaviour change beyond body-shape additive field, idempotency-key scheme preserved.
- **playwright.config.ts:157** testMatch regex extended with `journey-single-app-06-checkout-region\.spec\.ts`.
- **L-044 commit scope doc updated** (`docs/engineering/l044-commit-scope-2026-11-26.md`): source files 8 → 9 (route.ts added), E2E specs 10 → 11, evidence logs 22 → 25 (3 new NAV-06 logs), 2 supplementary logs (`20261126T-HQ-IE-slice-first-run.log` + `20261126T-NAV-SINGLE-APP-02-flaky-check-run2.log`) formally reconciled into L-044 scope per owner master directive §2.

**Rule 7 posture:** No commit executed. No push executed. No migration applied. No credential activated. No production touched. HEAD remains `9dfa90b4`.

**Next safe action (no approval needed · continue inside Rule 7):**

- NAV-SINGLE-APP-04/05 remain BLOCKED on an un-authored `nex_account.region_pref` migration — distinct approval class from mig-286.
- L-043 chat portrait-bloom hydration regression · spec exists and is `test.skip`-gated on the missing `seedChatPeer` fixture helper · extending the harness (`createTestConversation` + `createTestMessage` + `seedChatPeer`) is a dedicated cycle (involves understanding ~15 chat-related migrations + the 4000-line chat shell).
- HQ Axis A desktop drawer-row slice remains BLOCKED on mig 206.
- NAV-SINGLE-APP-01 remains BLOCKED on mig 286.
- Stable continuation targets inside authority: pillar coverage sweeps (Chat/Shop/Themes end-to-end journeys that don't require credentials), Nav matrix slices that don't require fresh fixture roles beyond harness capability, additional perf regression tests, non-pillar-tsc polish (dead-code tsconfig exclude).

**Next action requiring owner authorisation (ONE phrase at a time):** unchanged from addendum 3 — approval queue is the 10-row consolidated list in `docs/engineering/remaining-work-register-2026-11-26.md` Section D. Highest-priority rows remain `APPROVE MIG 286 SANDBOX APPLY` · `APPROVE MIG 206 SANDBOX APPLY` · `APPROVE L-044 COMMIT` or `APPROVE L-044 COMMIT AND PUSH` (now covering the new L-051 artefacts too).

---

## Current state · 2026-11-26 (continuation cycle addendum 3 · NAV-SINGLE-APP-02 + -03 VERIFIED)

**Delta from addendum 2.** Owner directive 2026-11-26 "keep to strick rules while pushing all passed sand box tested and proven — … do not stop until all confirmed" listed six remaining items. Five rows require owner action (approval phrases). One row (NAV-SINGLE-APP-02) was marked "Claude can build and test without new approval". That row + the adjacent NAV-SINGLE-APP-03 were executed this tick. HQ-role Axis A slice remains BLOCKED because `journey-drawer-rows-hq-ie.spec.ts` needs mig 206 applied (same approval-gate class as mig 286).

**Deltas:**

- **L-049 · NAV-SINGLE-APP-02 (IP-pickup via `cf-ipcountry`) VERIFIED**. Authored `tests/e2e/journey-single-app-02-ip-pickup.spec.ts` (4 tests · GB → `£`, US → `US$`, ID → `Rp`, no-header control → `€`). Each case opens a guest context with `storageState: undefined` + `extraHTTPHeaders: { "cf-ipcountry": <ISO> }`. Observable: `/nex-native/pricing` `[data-nex-pricing-detected-country=<ISO>]` + `[data-nex-pricing-shop-price]`. Evidence `tests/e2e/_runs/20261126T-NAV-SINGLE-APP-02-run1.log` · **5 passed · 0 failed · 11.5 s · EXIT=0**. Registered in `playwright.config.ts:157` testMatch regex.
- **L-050 · NAV-SINGLE-APP-03 (Accept-Language fallback) VERIFIED (unit)**. The Accept-Language tier is already covered by `src/lib/nex-native/commercial/__tests__/region-resolver.test.ts:115-124` (test "2 · Accept-Language wins when no account pref") + 20 adjacent cases. Ran vitest fresh: **21 passed · 0 failed · 223 ms · EXIT=0**. Honest classification: unit evidence is sufficient because `resolveViewerRegion` is a pure function with injected header accessor; browser-level E2E was NOT authored because the only consuming product route (`/api/nex-native/billing/checkout/shop`) creates Stripe test-mode side-effects on each call (held pending owner approval of T10 credentials row).
- **Sibling-spec regression check**: ran `journey-ask-seller-nonowner-full.spec.ts` to confirm the L-048 buyer-device-key change didn't ripple. 2 pass + 1 skip · 40.7s · EXIT=0.
- **HQ-role Axis A slice BLOCKED-confirmed**: `tests/e2e/journey-drawer-rows-hq-ie.spec.ts` exists as `describe.skip` because (a) mig 206 (`nex_account.hq_role` column) NOT APPLIED to sandbox, (b) harness lacks `createTestHqAdmin` helper. Owner-table row "mig 206 sandbox apply" was not provided — same approval-gate class as mig 286. Correctly held.
- Commit-scope doc updated: specs 9 → 10, evidence logs 19 → 22, four new bullets in the commit-message section.

## Current state · 2026-11-26 (continuation cycle addendum 2 · post-compaction · L-048 diagnosed and VERIFIED)

**Where we are (delta from the architecture-correction block below).** Post-compaction continuation of the 2026-11-26 continuation cycle executed two Chat fresh-buyer runs: first run FAILED, root cause diagnosed, candidate fix applied, second run **PASSED 2/2 · EXIT=0 · 49.5s**. L-048 promoted from FAILED/BLOCKED to **VERIFIED**. Nine commit-scope specs now all PASS or honest-SKIP — 0 open failed/gated specs.

**Deltas:**

- L-047 (NAV-SINGLE-APP-07) **VERIFIED** · `tests/e2e/_runs/20261126T-NAV-SINGLE-APP-07-run1.log` · 3 pass · 27.5s. Two authoring fixes landed: (a) networkidle → domcontentloaded; (b) removed obsolete `[data-nex-pricing-chat-card]` selector — `src/app/nex-native/pricing/page.tsx:165-168` comment confirms ChatFreeCard retired from render per 2026-11-09 owner directive (function definition remains but not mounted).
- L-048 **VERIFIED (after 1 FAILED → 1 PASS)**. First run `20261126T-chat-fresh-buyer-ask-seller-first-run.log` failed with `error-surfaced` + route-segment error boundary. Root cause: `sendEncryptedBusinessMessage` returned `no_self_devices` because the freshly-minted buyer had no `nex_account_device_key` row at Send time (browser auto-publish-on-mount hadn't landed). Fix: add `await seedDeviceKeyForFixtureAccount(buyer);` after `handles.push(buyer);` — same security justification as the pre-existing merchant seed (private half never leaves test-process memory; device-based E2E encryption invariant unchanged for real users). Spec un-gated. Re-run `20261126T-chat-fresh-buyer-fix-attempt-1.log` **2 passed · 0 failed · 49.5 s · EXIT=0**. Route-segment error boundary confirmed as downstream symptom of the client error state, not an independent second failure.
- `docs/engineering/l044-commit-scope-2026-11-26.md` updated: Chat fresh-buyer spec moved to VERIFIED; evidence-log count 18 → 19 (both FAILED and PASS logs kept to preserve fix-then-pass history); E2E specs header updated to "all 9 VERIFIED"; commit-message L-048 bullet updated to describe the fix + PASS outcome.

**Rule 7 posture:** No commit executed. No push executed. Awaiting owner authorisation phrase (the prior "push and commit all proven files that have passed sandbox" directive predates this continuation cycle — Safety Constitution §4 requires per-push explicit approval naming repo + branch + reviewed commit). HEAD remains `9dfa90b4`.

**Next safe action (no approval needed · continue working inside Rule 7):**

- Author NAV-SINGLE-APP-02 (IP-pickup via `cf-ipcountry` / Vercel header on create-account) — unblocked.
- OR Author NAV-SINGLE-APP-03 (Accept-Language fallback) — unblocked.
- OR Author HQ-role Axis A drawer-row slice (desktop fixture profile) — unblocked.

**Next action requiring owner authorisation (ONE phrase at a time):**

- `COMMIT AND PUSH L-044 CYCLE SCOPE TO Philip2024394/nexapp release-audit-v1-2026-11-14` → executes the preflight + the staged commit defined in `docs/engineering/l044-commit-scope-2026-11-26.md` (10 source/config files · 9 specs · 18 evidence logs · 11 docs). Preflight stops immediately on any unexpected value.
- `APPROVE MIG 286 SANDBOX APPLY` → unblocks NAV-SINGLE-APP-01 + 3 downstream specs.
- `APPROVE OPTION A FILE REVIEW` / `APPROVE OPTION B` / `APPROVE OPTION C` / `HOLD` → L-005 migration 207/257 reconciliation.
- `APPROVE OPTION A` / `APPROVE OPTION A (alternate CTAs)` / `APPROVE OPTION B` / `HOLD` → L-006 F2 batch (welcome restore + /create-account migration).
- `APPROVE T10 SANDBOX CREDENTIALS` → L-004 Stripe + PayPal positive-path.

---

## Current state · 2026-11-26 (architecture correction · single-app country-selection model · nav matrix model corrected)

**Where we are.** Owner directive 2026-11-26 "ARCHITECTURE CORRECTION — NEX IS ONE APP WITH COUNTRY SELECTION" authoritatively corrected the remaining-work programme. NEX is ONE application with country selection inside it (IP-pickup + Accept-Language + explicit selection in business-details). IE / ID / WW are NOT separate app deployments.

**What was done this cycle (documentation-only · no code change · HEAD unchanged · Rule 7 preserved):**

1. **Architecture reconciliation document authored** at `docs/engineering/single-app-country-model-reconciliation-2026-11-26.md`. Nine sections. Records: (a) the correction, (b) the two architectural layers that co-exist in source (`resolve-app-identity.ts` deployment-env safety fence vs `region-resolver.ts` A10 in-app country selection with 5-tier resolution supporting IE·GB·US·ID), (c) reclassified evidence for L-041/L-045/L-046, (d) corrected two-axis matrix replacing the obsolete 216-cell model, (e) accurate current coverage (Axis A · Role × session × drawer nav: 3 of 4 roles VERIFIED in IE country context; Axis B · Country-selection journeys: 0 of 7 VERIFIED), (f) retired ID-as-separate-deployment workstream, (g) NAV-SINGLE-APP-01 through -07 queued, (h) documents updated as a result, (i) next concrete action.

2. **Ledger updates landed**: L-045 + L-046 rows reclassified in place (role × session evidence in IE country context, not country-deployment cells); new Decisions-log entry at top describing the architecture correction.

3. **Remaining-work register updated**: L-010 row rewritten with the two-axis model and the NAV-SINGLE-APP-01…-07 queue; §B §4 updated to reflect corrected coverage phrasing; obsolete "3-of-12 cells" claim removed.

**Current coverage (honest):**

- **Axis A** (role × session × drawer navigation): 3 of 4 roles VERIFIED in IE country context. Merchant (L-041 · 17 rows). Guest (L-045 · 16 rows). Buyer (L-046 · 17 rows). HQ role uncovered — desktop-only, needs separate fixture profile.
- **Axis B** (country-selection / IP-pickup / country-change / cross-country isolation / checkout-region correctness): **0 of 7 journeys VERIFIED**. UI exists at `src/app/nex-native/manage/shop/setup/business-details/_client.tsx` with 5-tier default resolution. `resolveViewerRegion` is pure and testable. No E2E assertions yet.

**NAV-SINGLE-APP queue (replaces obsolete ID-as-separate-deployment tasks):**

- **NAV-SINGLE-APP-01** · Country selection in business-details form (no approval blocker — authorable now)
- **NAV-SINGLE-APP-02** · IP-pickup via `cf-ipcountry` / Vercel header on create-account (no approval blocker)
- **NAV-SINGLE-APP-03** · Accept-Language fallback (no approval blocker)
- **NAV-SINGLE-APP-04** · Country change does not create a separate account (BLOCKED on `nex_account.region_pref` column migration · owner approval needed)
- **NAV-SINGLE-APP-05** · Cross-country RLS isolation (same blocker as -04)
- **NAV-SINGLE-APP-06** · Checkout region correctness for IE·GB·US·ID (no approval blocker — unit + integration)
- **NAV-SINGLE-APP-07** · Role × country sample (merchant × {IE, ID} currency label) (no approval blocker)

**Boundaries preserved**: HEAD still `9dfa90b4` · 0 commits · 0 pushes · 0 migrations applied · 0 credentials activated · no CLAUDE.md edit (Rule 11 seal-level change requires separate owner authorisation; practical reading recorded in §2.3 of the reconciliation doc). Sandbox-only test authoring continues under existing approvals.

**Owner approvals still outstanding**: `APPROVE L-005 OPTION A` · `APPROVE L-006 OPTION A` · `APPROVE L-044 COMMIT` / `APPROVE L-044 COMMIT AND PUSH` · `APPROVE MIG 354-365 SANDBOX APPLY` · `APPROVE T10 SANDBOX CREDENTIALS` · **NEW 2026-11-26 continuation** `APPROVE MIG 286 SANDBOX APPLY` — packet at `docs/engineering/mig-286-operating-country-apply-request-2026-11-26.md` · unblocks NAV-SINGLE-APP-01/-02/-03/-06. Country-change testing (NAV-SINGLE-APP-04/-05) separately needs `APPROVE NEX_ACCOUNT REGION_PREF MIGRATION SANDBOX` once that migration draft is authored.

**New finding this cycle (2026-11-26 continuation)**: NAV-SINGLE-APP-01 spec authored at `tests/e2e/journey-country-selection-business-details.spec.ts` (282 lines, typecheck clean), with owner-scoped `nex_business` sweep in the `finally{}` block (L-030 pattern). Sandbox DB read-back surfaced `code 42703 · column nex_business.operating_country_code does not exist`. Migration `nex-supabase/migrations/286_nex_business_operating_country.sql` is AUTHORED but NOT APPLIED — the migration file itself declares this status at lines 5-7. Business-details form UI + server action already write `operating_country_code`; the write silently fails in sandbox because the column is absent. Real launch gap, not a test or code defect. Spec status: BLOCKED pending `APPROVE MIG 286 SANDBOX APPLY`.

**Next concrete action**:
- If owner approves MIG 286: apply to sandbox, re-run NAV-SINGLE-APP-01, then proceed to NAV-SINGLE-APP-02 (IP-pickup via `cf-ipcountry`) since the persistence path is proven.
- If owner holds: rewrite NAV-SINGLE-APP-01 to assert country persistence via the weaker observable (re-open business-details as the same merchant, read `<select id="shop-country">` default), then move to NAV-SINGLE-APP-02 (IP-pickup is observable without the column).
- Either way, HQ-role Axis A slice remains an authorable parallel task (no approval gate).

---

## Prior state · 2026-11-26 (continuation · 4 parallel agents · L-042 VERIFIED · Guest+Buyer IE slices VERIFIED · nav matrix 3-of-12 — model since corrected)

**Where we are.** Owner directive "CONTINUE EXECUTION AFTER L-041" dispatched four independent agents. All four returned productive, boundaries-respecting work. Delta vs previous block:

1. **L-042 VERIFIED (real root cause: case-mismatch, NOT fixture-session).** Agent 1 (Task #112) diagnostic instrumentation **REFUTED** both earlier hypotheses. Hypothesis (a) fixture-session account.id mismatch: DB query confirmed persisted order under fixture account.id — resolver was correct. Hypothesis (b) `page.request.get` redirect: `ssrResp.url` resolved to orders-list route directly with 200 — no redirect occurred. **Actual cause**: row component (`_client.tsx:332`) emits `#{order.id.slice(0, 8).toUpperCase()}` (e.g. `#11EFE99B`); spec computed lowercase `shortId = order.orderId.slice(0, 8)` (e.g. `11efe99b`) and used case-sensitive `indexOf('#11efe99b')` → `-1`. Fix: `tests/e2e/regression-l042-orders-list-hydration.spec.ts` lines 252-264 (case normalisation on both sides) + lines 266-284 (SSR window widened 800 → 1600 chars). **Result: 2 passed · EXIT=0 across two consecutive runs** · evidence `20261126T220851Z-L042-task112-fixed2.log`, `20261126T220951Z-L042-task112-verify.log`. L-042 Contracts A+B+C all pass. Product `ClientRelTime` wrapper at `_client.tsx:65-84` was already correct and unchanged — fix was spec-side only.

2. **L-045 Guest × IE slice VERIFIED (new).** Agent 2 authored `tests/e2e/journey-drawer-rows-guest-ie.spec.ts` (303 lines, `storageState: undefined`, 16 rows classified REDIRECT-TO-SIGNIN (10) or PUBLIC-RENDER (6)). **16 passed / 23.7s / EXIT=0** · evidence `20261126T220451Z-guest-ie-slice.log`. `playwright.config.ts:157` testMatch extended.

3. **L-046 Buyer × IE slice VERIFIED (new).** Agent 3 authored `tests/e2e/journey-drawer-rows-buyer-ie.spec.ts` (342 lines, `createTestAccount` only — no business, `signInAsFixtureInBrowser`, `teardownAll` + `assertNoResidualFixtures` with strict `expect(total).toBe(0)`). 16 rows with `expectedBuyerBehaviour` classification (PUBLIC-RENDER / OWNER-GATE-TO-SETUP / AUTH-ONLY-RENDER / OWNER-GATE-TO-PLACEHOLDER / CREATE-GATE-TO-SETUP). **17 passed / 3.4m / EXIT=0 · zero residuals** · evidence `20261126T220357Z-buyer-ie-slice.log`.

4. **Approval-gated prep doc landed.** Agent 4 authored `docs/engineering/approval-gated-prep-2026-11-26-continuation.md` (762 lines) with five exact approval phrases needed before gated work can proceed:
   - `APPROVE L-005 OPTION A` — order-status enum + `nex_order.shop_status` (migration **367**, not 260 — collision; prior packet had wrong number)
   - `APPROVE L-006 OPTION A` — Chat theme storage policy
   - `APPROVE L-044 COMMIT` or `APPROVE L-044 COMMIT AND PUSH` — commit/push the **9+6** file set (drift from prior packet's 7+2); **no `[founder]` tag** required
   - `APPROVE MIG 354-365 SANDBOX APPLY` — apply pending migrations to sandbox `kdstoyyeygcopkogqsyv`
   - `APPROVE T10 SANDBOX CREDENTIALS` — Stripe + PayPal test-mode (env var corrected to `PAYPAL_API_BASE`)
   
   **New cross-dependency identified**: T10 Stripe positive-path depends on L-005 (writes `nex_order.shop_status` which L-005 adds). PayPal positive-path stays `BLOCKED-PENDING-INTEGRATION`.

**Nav matrix delta**: 1-of-12 slices VERIFIED → **3-of-12 slices VERIFIED** (all three Ireland-identity slices complete: merchant·guest·buyer). 9 slices remain: IE/ID/WW × guest/buyer/merchant minus the 3 IE rows, plus HQ desktop variants.

**Files changed this cycle (all uncommitted, Rule 7 preserved):**
- `tests/e2e/regression-l042-orders-list-hydration.spec.ts` — case normalisation + window widened (L-042 fix)
- `tests/e2e/journey-drawer-rows-guest-ie.spec.ts` — NEW · 303 lines
- `tests/e2e/journey-drawer-rows-buyer-ie.spec.ts` — NEW · 342 lines
- `playwright.config.ts` — testMatch regex extended (registered by Agent 2 + Agent 3)
- `docs/engineering/approval-gated-prep-2026-11-26-continuation.md` — NEW · 762 lines
- `docs/engineering/NEX-DELIVERY-LEDGER.md` — L-042 row updated to VERIFIED + L-045/L-046 rows added + new decisions-log entry at top
- `docs/engineering/session-handoff.md` — this block
- Evidence logs under `tests/e2e/_runs/`: `20261126T215931Z-L042-task112-baseline.log`, `20261126T220851Z-L042-task112-fixed2.log`, `20261126T220951Z-L042-task112-verify.log`, `20261126T220451Z-guest-ie-slice.log`, `20261126T220357Z-buyer-ie-slice.log`

**Boundaries preserved all cycle**: HEAD still `9dfa90b4` · 0 commits · 0 pushes · 0 migrations applied · 0 credentials activated · no sealed-invariant breaks.

**Next concrete actions (authorised, next cycle):**
- Author `journey-drawer-rows-signed-in-merchant-id.spec.ts` (merchant × ID slice)
- Author `journey-drawer-rows-guest-id.spec.ts` (guest × ID slice)
- Author `journey-drawer-rows-buyer-id.spec.ts` (buyer × ID slice with teardown)
- Pick first independent Chat pillar verification slice (device-only storage integrity OR send/receive E2E on authed test accounts)

**Still gated on owner word** (no change): L-005 · L-006 · L-044 commit/push · mig 354-365 apply · T10 credentials.

---

## Prior state · 2026-11-26 (continuation · L-041 VERIFIED (17/17) · drawer docs-drift FIXED · L-042 Contract A reclassified — superseded above)

**Where we are.** Continuation of Execution-Control cycle. Three deliverables, all within authority:

1. **L-041 drawer-rows signed-in-merchant × IE slice → VERIFIED (17/17).** Applied the spec-timing fix the prior cycle had identified but not yet landed. Added `await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined)` between Contract B and Contract C at `tests/e2e/journey-drawer-rows-signed-in-merchant-ie.spec.ts:260-262`. Next.js 16 streams NEXT_REDIRECT over RSC; `waitUntil: "domcontentloaded"` samples the empty streaming fallback BEFORE the client-side router completes the redirect; `networkidle` waits for the chain to settle. Re-ran twice for stability: Run 1 `17 passed (3.8m)` EXIT=0; Run 2 `17 passed (3.6m)` EXIT=0 saved to `tests/e2e/_runs/20261126T-L041-merchant-ie-verified.log`. All 16 signed-in shop-owner × IE drawer destinations now confirmed live and non-empty (create/product/category · contacts · profile/me · settings/profile/edit · manage · manage/shop/faq · settings/chat-settings · settings/payments · manage/orders · manage/wholesale · store · install · settings · nex-generated/buying-guides · nex-1 · chat-themes-library). Nav matrix delta: 1-of-12 (role × country) slice PARTIAL → VERIFIED.

2. **Drawer-client docs-drift comment FIXED.** `src/components/nex-native/control-drawer/control-drawer-client.tsx:268-271` previously carried a stale 2026-11-09 note claiming `/create/product` had no page.tsx. The page was authored 2026-11-15 as the proper merchant 0/1/2+ business dispatcher. Replaced with an accurate 2026-11-26 note covering (a) original 2026-11-09 directive, (b) 2026-11-15 restoration, (c) why the drawer destination stays pinned at `/create/product/category` (single-hop to the sealed first step), (d) the L-041 verification evidence log. Comment-only edit · zero behaviour change · zero sealed-invariant touch.

3. **L-042 Contract A reclassified: test-infrastructure/fixture-session defect, NOT a product defect.** The product fix (`ClientRelTime` wrapper at `src/app/nex-native/manage/orders/_client.tsx:77-83`) is sealed in place and unchanged. The regression spec's Contract A failure (`rowAnchorIdx = -1`) is upstream of hydration: either (a) fixture-session account.id ≠ `merchant.nexAccountId` (task #72 territory — resolver at `session.ts:196-208` looks up `nex_account` by `supabase_user_id` and auto-creates if absent; a stale row or race would cause `listBusinessesByOwner(session.account.id)` to return `[]` and the page to render the "No shop found" placeholder with no `#shortId` row), or (b) `page.request.get` is following a redirect to `/sign-in?next=...`. Both are test-harness defects, not hydration regressions. L-042 product fix status remains **SEALED**; regression spec Contract A gates on a diagnostic that distinguishes (a) from (b) before Contracts B+C can reach.

**Files changed this continuation (all uncommitted, Rule 7 preserved):**
- `tests/e2e/journey-drawer-rows-signed-in-merchant-ie.spec.ts` — `networkidle` wait between Contract B and Contract C (L-041 timing fix)
- `src/components/nex-native/control-drawer/control-drawer-client.tsx` — stale 2026-11-09 comment replaced with accurate 2026-11-26 note (comment-only · zero behaviour)
- `docs/engineering/NEX-DELIVERY-LEDGER.md` — new top decisions-log entry recording this cycle
- `docs/engineering/session-handoff.md` — this block
- `tests/e2e/_runs/20261126T-L041-merchant-ie-verified.log` — new evidence log (17/17 passed)

**Still outstanding from prior Execution-Control cycle (unchanged this pass):**
- L-042 fixture-visibility (test-infra, not product — reopening task #72 would be the correct next step)
- Guest×IE and buyer×IE drawer-row slices (Agent A recommendation · fixture-free · within authority · clear next cycle)
- `.env.example` Part 5.1 drift (5 env vars documentation-truth gap)
- Four owner-gated decisions (L-005 · L-006 · mig 354-365 · L-044 commit) per `docs/engineering/owner-decision-packet-2026-11-26.md`
- T10 credentials (5 env vars from owner)

**What this continuation did NOT do:**
- Any commit/push (Rule 7; no fresh authorisation)
- Any migration apply (Rule 7; mig 354-365 awaits owner word)
- Any credential activation (Rule 7; T10 awaits owner word)
- Edit `.env.example` (documentation-truth fix · potentially affects onboarding scripts)
- Switch drawer destination from `/create/product/category` → `/create/product` (nav-row target change could affect other specs; recorded as low-risk polish for a future cycle)

**Register snapshot** at `docs/engineering/remaining-work-register-2026-11-26.md` (prior cycle) — Section A 16-row table + Section B 13-point totals. Still valid; L-042 row updates needed to reflect that spec DID run (not blocked) and the failure is fixture-visibility not hydration.

**All ledger VERIFIED rows preserved; only non-VERIFIED items re-reconciled.**

**Key reconciliations this cycle:**

- **L-044 non-pillar residue CONFIRMED NON-BLOCKING** via import-graph analysis: `src/lib/nex-agent/code-engine/*` (196 errors · zero imports from any `src/app/*` route) + `components/nex-app/centre/SupplierCard.tsx` (26 errors · zero imports from `src/app/*`) proven DEAD. Legacy `src/lib/nex/` (673 errors) matches CLAUDE.md "clean up incrementally" note. 1381 errors do not block any pillar customer journey.
- **Disk partial reclaim**: deleted 12 stale Playwright `cdp-profile-*` dirs in `/c/tmp/` (537 MB). Disk 1.3 GB → 1.8 GB free. Still thin for full Playwright regression; `.next/dev` (2.6 GB) held by live dev server on :3008 — reclaim remains owner host-action per L-041.
- **Remaining launch gates mapped** (register §8): 5 P0 blockers — all are owner-action-required (credentials, decisions, host actions, commit approval), not undone engineering.

**Launch-readiness verdict (register §13): NEX is NOT yet a release candidate but is launch-adjacent.** A single authorised sequence (commit L-044 → reclaim host disk → populate T10 credentials → decide F2 and migration options → run four blocked specs) brings NEX to a full release-candidate state.

**Fastest convergence path owner can authorise**:
1. Stop :3008 + delete `.next/dev` → unlocks L-041 (16 drawer rows) + L-042 (orders list hydration regression) + L-043 (Chat hydration regression)
2. Populate `.env.local` with T10 credentials (5 env vars named in register) → unlocks L-004
3. Decide F2 batch → unlocks L-006 (5 failures) + L-024 (10 skipped tests)
4. Approve L-044 fix-sweep commit → consolidates pillar type-safety work
5. Decide mig 207/257 and mig 354-365 → unlocks L-005 + 2 Shop-pillar skip specs

**Files changed this cycle (uncommitted, strictly documentation):**
- `docs/engineering/NEX-DELIVERY-LEDGER.md` (new decisions-log entry at top: L-044 non-pillar residue reconciliation)
- `docs/engineering/remaining-work-register-2026-11-26.md` (NEW · the register itself)
- `docs/engineering/session-handoff.md` (this block)

**Boundaries honoured per directive §10**: no prod DB · no prod migration · no prod deploy · no auth/RLS/encryption weakening · no live payment activation · no commit/push (Rule 7 preserved) · no reopening of VERIFIED ledger rows. `src/*` tree untouched this cycle — register plus prior-cycle L-044 fix-sweep both sit on working tree awaiting owner commit word.

**Operation receipt (Safety Constitution §7)**: Repository root `C:/Users/Victus/nexapp`. Remote `https://github.com/Philip2024394/nexapp.git`. Branch `release-audit-v1-2026-11-14`. HEAD UNCHANGED at `9dfa90b4`. No push. No deploy. Working-tree delta cumulative since `9dfa90b4`: 10 modified source/doc files + several untracked doc artefacts + 1 new evidence log + prior L-044 fix-sweep still uncommitted. This cycle's own delta: 2 code/spec edits + 2 doc edits + 1 evidence log.

---

## Previous state · 2026-11-26 (L-044 pillar-defect fix-sweep · scoped-tsc green · awaits commit approval)

**Where we are.** The six pre-existing pillar-impacting `tsc --noEmit` errors enumerated under L-044 (Agent-F audit 2026-11-26) are RESOLVED on the working tree. Targeted re-run `npx tsc --noEmit 2>&1 | grep -E "(_log-call-action|_full-library-client|_product-detail-sheet|manage/shop/themes/_actions|manage/products/\[productId\]/page|vault/home/chats)"` returns ZERO lines. Full-project count dropped from 1877 → 1381 (surplus beyond the six fixes reflects background cleanup absorbed into `9dfa90b4`); remainder is non-pillar legacy residue (CLAUDE.md § "Legacy residue in `src/lib/nex/`").

**Files changed this cycle (uncommitted):**

- `src/app/nex-native/calls/_log-call-action.ts` (NEW · thin Server Action over `logCallEvent`, soft-fail on unauth)
- `src/app/nex-native/chat-themes-library/_full-library-client.tsx` (`viewerEarnedBadges` → `viewerEarnedCreatorBadges={…earned}`)
- `src/app/nex-native/cover/_product-detail-sheet.tsx` (`added_at: Date.now()` on `NexCartItem`)
- `src/app/nex-native/manage/categories/_actions.ts` (`Promise<never>` → `Promise<void>` return-type widen on `assignProductToSectionAction`)
- `src/app/nex-native/manage/products/[productId]/page.tsx` (bind arg order fixed: `(businessId, productId)`)
- `src/app/nex-native/manage/shop/themes/_actions.ts` (upload path → object-input + `publicUrl` · clear path → try/catch wrapper for `Promise<void>` helper)
- `src/app/nex-native/vault/home/chats/[conversationId]/_vault-chat-client.tsx` (narrow `attachmentLabelFor` call to exclude `"document"` kind — file input doesn't accept documents)
- `src/app/nex-native/vault/home/chats/page.tsx` (`"theme_sticker"` → `"sticker"` matching `NexPeerAttachmentKind` · remove dead `"link_preview"` branch with non-existent `link_title`/`link_source_domain` fields)
- `docs/engineering/NEX-DELIVERY-LEDGER.md` (L-044 row status updated · new decisions-log entry)
- `docs/engineering/session-handoff.md` (this block)

**What is still open (ordered).**

1. **Commit + push L-044 fix-sweep** — requires fresh explicit owner approval per Rule 7 (previous 2026-11-26 commit-push authorisation was scoped to the `9dfa90b4` cycle).
2. **L-043 browser regression** — spec deferred until chat-peer fixture seed harness lands.
3. **L-036/L-042 Contract C re-verification** — after dev-server cycle (flaky under long-running HMR).
4. **Non-pillar tsc residue** (1381 errors) — `src/lib/nex/` legacy audience model, chat-standard theme-engine token drift, scripts/_tmp noise, test fixtures with stale imports, doctrine draft worker types. None block pillar journeys.
5. Owner-gated (unchanged): L-004 payment credentials · L-005 mig 207/257 · L-006 F2 `/welcome` + `/create-account` batch · prod deploy / DB / live Stripe/PayPal.

**Safe next engineering steps within existing authority.**

1. Continue burning down pillar defects from the ledger's next-highest-priority unfinished rows per Rule 1 (scoped to code edits + tsc verification · no browser runs until host disk reclaimed).
2. Author follow-on scoped tsconfig to exclude the identified legacy-residue paths from the project-level baseline, so a future "all green" baseline is reachable without rewriting 1381 lines of legacy code (owner-decision whether to pursue).

**Operation receipt (Safety Constitution §7).** Repository root `C:/Users/Victus/nexapp`. Remote `https://github.com/Philip2024394/nexapp.git`. Branch `release-audit-v1-2026-11-14`. HEAD UNCHANGED at `9dfa90b4` — this fix-sweep has NOT been committed or pushed. No deploy triggered.

---

## Previous state · 2026-11-26 (parallel-agent cycle committed + pushed · `9dfa90b4` landed on `release-audit-v1-2026-11-14`)

**Where we are.** First commit under the 2026-11-26 owner "commit + push authorised" directive is on `origin/release-audit-v1-2026-11-14`. HEAD = `9dfa90b4`. Preview-deploy chain fires automatically: push → `.github/workflows/cloudflare-deploy.yml` → wrangler deploy --env preview → `nexapp-preview.nex-sandbox.workers.dev`. Production Workers env NOT configured — no prod deploy risk.

**What landed in this commit.**

- L-036 hydration fix (`/manage/orders/[orderId]` `ClientDateTime`) + fail-then-pass regression spec.
- L-042 pattern-hunt extension (`/manage/orders` list `ClientRelTime`) + regression spec.
- L-043 Chat-pillar hydration fix in `_portrait-bloom-shell.tsx` (`formatBubblePrice` locale pin + new `ClientMessageTime` wrapper).
- L-044 project-level typecheck baseline captured (**1877 `tsc --noEmit` errors**, EXIT=1). Corrects the earlier false "exit 0" background-job report. Six pillar-impacting defects enumerated, ~1850 non-pillar legacy residue. Remediation plan recorded.
- Rulebook sealed: `CLAUDE.md` (12 Rules + Safety Constitution), `NEX-DELIVERY-RULES.md`, `.claude/settings.json` hooks.
- `tests/e2e/_fixtures/{sandbox-test-harness,spec-payload-helper}.ts` + `_runs/` evidence envelope.
- `.gitignore` hardened to permanently exclude `_g4-auth-cookie.txt` (contained a real Supabase sandbox session JWT — never landed in git).
- Scope: 183 files · 45 231 insertions · 1 663 deletions.

**What is still open (ordered).**

1. **L-043 browser regression** — spec authoring deferred to same fixture-seed phase as L-041/L-042 (chat-peer mounts require seeded account + peer + message fixtures). No sealed invariant touched; verified behaviour matches L-036 pattern already proven.
2. **L-044 fix-sweep** — six pillar-impacting tsc errors (peer-call `_log-call-action` missing module · shop theme actions `publicUrl` contract · product-edit action signature · cart `added_at` · vault attachment-kind · themes drawer `viewerEarnedBadges`). Within existing authority per Rule 7; next engineering action.
3. **L-036/L-042 Contract C re-verification** — two harness-timeout fails in last run classified as L-025/L-028 FLAKY-DEV-HMR-STATE pattern (sign-in flake under long-running dev server), not product defect. Re-run after dev-server cycle.
4. Owner-gated (unchanged): **L-004** payment-provider credentials · **L-005** mig 207/257 decision · **L-006** F2 `/welcome` + `/create-account` batch · production deploy / prod DB / live Stripe/PayPal.

**Safe next engineering steps within existing authority.**

1. Execute L-044 fix-sweep — six enumerated pillar defects, no sealed-invariant risk.
2. Re-verify L-036 Contract C + L-042 Contract A after dev-server cycle.
3. Continue parallel Chat/Shop/Themes defect burn-down via the ledger's highest-priority unfinished rows per Rule 1.

**Operation receipt (Safety Constitution §7).** Repository root `C:/Users/Victus/nexapp`. Remote `https://github.com/Philip2024394/nexapp.git`. Branch `release-audit-v1-2026-11-14`. HEAD `9dfa90b4`. Push occurred — remote reports `10ca82cc..9dfa90b4 release-audit-v1-2026-11-14 -> release-audit-v1-2026-11-14`. Pre-push hook PASS. Preview deploy will be validated on the next cycle via `/api/nex-native/version` + `x-nex-commit-sha` header. No prod verification applicable.

---

## Previous state · 2026-11-26 (continuation · L-043 Chat-pillar hydration pattern-hunt landed · BUILT · typecheck clean · verify blocked on host disk)

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
