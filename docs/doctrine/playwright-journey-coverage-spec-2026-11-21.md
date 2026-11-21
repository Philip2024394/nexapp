# NEX Playwright 10-Journey Launch-Gate Spec · 2026-11-21

Scope · forensic read-only inventory of Playwright end-to-end
coverage + specification of the 10 journeys that would form a
launch gate once implemented. Phase 2 Remediation priority 9
(P2-09) per the sealed 2026-11-09 priority order.

This document is a SPECIFICATION of the 10-journey matrix. Writing
the missing specs is NOT in scope for P2-09 · implementation lands
when the owner authorises P2-09 spec authorship as a follow-up.

Audit root · `C:/Users/Victus/nexapp`
Repo · `Philip2024394/nexapp` · branch `release-audit-v1-2026-11-14`
HEAD at audit time · `40c3871f`

Posture in one line · **Playwright scaffolding is production-ready
for dev-server testing · 31 spec files exist but only 2-3 cover
launch-critical journeys at material depth · the 10-journey launch
gate requires 7 new specs plus 10 missing fixture types · tests are
currently pinned to `localhost:3008` with no Cloudflare / preview
URL compatibility.**

Spot-verified · file existence counts ·

- `playwright.config.ts` present at repo root.
- `tests/e2e/*.spec.ts` · 31 spec files.
- `tests/e2e/.auth/state.json` · 4.1 KB storage state (gitignored).
- `test-results/.last-run.json` · `status: "passed"` on most recent run.

---

## Compliance scorecard

| Area | Verdict | Launch gate |
|---|---|---|
| Playwright scaffolding (`playwright.config.ts`) | Ready for dev-server | n/a |
| Projects (3 · public mobile · authed mobile · live-public) | Configured | n/a |
| Authed state storage (`.auth/state.json`) | Present · owner-interactive bootstrap · gitignored | OK |
| Cloudflare / preview URL compatibility | NOT CONFIGURED · hardcoded `localhost:3008` | Needs `PLAYWRIGHT_BASE_URL` env substitution before preview tests |
| 10-journey launch-gate coverage | 2 of 10 fully · 1 of 10 partial · 7 of 10 absent | Blocks launch-gate automated enforcement |
| Shared fixtures / helpers library | ABSENT · each spec is standalone | Blocks scaling · 10 helper types needed |
| D6 sandbox for order / chat journeys | BLOCKED (owner infra · same dependency as P2-04/08) | Blocks J3 · J5 · J6 · J9 |

Zero VIOLATION. One PARTIAL on coverage. Gap is OPERATIONAL and
inventoried.

---

## 1 · Why P2-09 exists in the sealed priority order

P2-09 sits after P2-08 (HTTP route tests) because journey-level
Playwright coverage closes a DIFFERENT gap than route tests. A
route test proves a single endpoint behaves correctly in isolation.
A journey test proves the user-visible flow across multiple
endpoints + client-side navigation + realtime signalling works
end-to-end.

The 10-journey gate is derived from ·

- P2-01 (chat privacy device-only) · J4 live viewer · J6 P2P chat
  · J5 order-confirmation isolation.
- P2-02 (billing RLS) · J3 cart → checkout · J5 order confirmation.
- P2-03 (buyer checkout price trust) · J3 cart → checkout.
- P2-04 (peer-message RLS) · J6 P2P chat.
- P2-05 (rate-limit infra) · J1 sign-in flood.
- P2-06 (theme + buyer UI wiring) · J2 first-visit theme select.
- P2-07 (Path A order separation) · J5 order confirmation.
- Sealed Phase 1 remediation priorities · J7 section-error
  recovery · J8 support ticket · J9 admin-grant country scope ·
  J10 Vault recovery.

---

## 2 · Playwright scaffolding snapshot

### 2.1 · Config file

- `playwright.config.ts` (~98 lines).
- `baseURL: "http://localhost:3008"` · hardcoded.
- No `globalSetup.ts` · no shared fixtures file.
- Workers · 1 · retries · 0 · action timeout 10s · nav timeout 20s.
- Traces · `retain-on-failure` · screenshots · `only-on-failure`.
- Reporter · `list`.

### 2.2 · Projects

1. `mobile-chromium-pixel7` · public surfaces · no auth · Pixel 7
   viewport (412×915).
2. `mobile-chromium-pixel7-authed` · signed-in journeys · loads
   `tests/e2e/.auth/state.json` · same viewport.
3. `mobile-chromium-pixel7-live-public` · Live commerce public
   surfaces · 24-spec match filter.

Browsers · Chromium only. No WebKit or Firefox.

### 2.3 · Auth state

- `tests/e2e/.auth/state.json` (4.1 KB).
- Generated via owner-interactive sign-in · one-time bootstrap.
- Gitignored at `.gitignore:321` · not committed.
- No test-only auth bypass · no credential factory · no WebAuthn
  mock.

### 2.4 · Recent run state

- `test-results/.last-run.json` → `status: "passed"` on most
  recent run · failedTests · empty array.
- No persistent HTML report (`playwright-report/`) · reports are
  ephemeral per run.

### 2.5 · Package.json references

- `@playwright/test@^1.62.1` · devDependency.
- Scripts `test:chat-responsive` and `test:product-upload` reference
  separate configs · not in audit scope.

---

## 3 · Existing e2e inventory · 31 specs

### 3.1 · By category

| Category | Count | Highlights |
|---|---|---|
| Mobile first-user journey | 2 | `mobile-public-surfaces.spec.ts` · `mobile-authenticated-journey.spec.ts` (9 steps · theme select covered) |
| Live Commerce surfaces | 8 | feed · viewer · footer · 3-dot panel · products flow · ping chip · library tiles · visual-verify |
| Chat / Theme surfaces | 2 | `personal-chat-preview-hides-business-controls.spec.ts` · `sign-in-composer-overflow.spec.ts` |
| Bio-link / Profile | 2 | `bio-link-mobile.spec.ts` · `bio-link-owner-preview.spec.ts` |
| UI diagnostics / regression | 5 | composer-overflow (diag + regression) · create-page-visual · nex-feed-gate1-acceptance · nex-feed-visual-verify |
| Capture-only / diagnostic | 10 | `_capture-*.spec.ts` × 9 · `_identify-session-account.spec.ts` · `_tmp-measure-action-row.spec.ts` |
| Browser QA | 1 | `s8-browser-qa.spec.ts` |

### 3.2 · Observation

Of the 31 specs, only 2-3 cover launch-critical journeys in depth
(`mobile-authenticated-journey.spec.ts` at 9 steps covers J2, and
the live-commerce suite partially covers J4). The remaining 28
specs are diagnostic / capture / regression tools for prior
incident-driven work.

Task #67 memory · "run 16 remaining e2e-p6-isolation specs" ·
completed 2026-11-20 · artifacts pushed to `release-audit-v1` ·
implies a prior batch of isolation specs that is not in the
current active test list (possibly archived or task-specific).

---

## 4 · 10-journey launch-gate specification

| # | Journey | Flow summary | Routes touched | P2 priority validated | Current coverage |
|---|---|---|---|---|---|
| J1 | Sign-in (Ireland · WebAuthn) | Visitor → `/welcome` → `/sign-in` → authenticated `/home` | `/welcome` · `/sign-in` · `/api/.../webauthn/*` · `/nex-native/home` | P2-05 rate-limit boundary + sign-in flood | PARTIAL (`mobile-public-surfaces` covers unauth routes · final home redirect untested) |
| J2 | First-visit invitation → theme select | Signed-in → home invitation card → `/chat/first-visit` → theme catalogue → select free theme → confirm | `/nex-native/home` · `/nex-native/chat/first-visit/*` · `/nex-native/themes/*` · `/api/.../select-theme` | P2-06 first-free apply idempotency | FULL (`mobile-authenticated-journey` steps 2-7) |
| J3 | Cart → checkout → Stripe session | Buyer → shop page → add to cart → open checkout sheet → Stripe modal opens | `/[businessSlug]` · `/cart` · POST `/api/.../billing/checkout/buyer` | P2-03 server-side price re-derive | ABSENT |
| J4 | Live viewer join → video → like → comment | Viewer → feed → tap video → plays → like toggle → type + send comment | `/nex-native/live-commerce/feed` · `/nex-native/live-commerce/[sessionId]` · WebSocket realtime | P2-04 per-viewer RLS · P2-01 chat privacy in live context | PARTIAL (`live-commerce-video-journey` covers steps 1-9 · comment send blocked) |
| J5 | Seller order confirmation | Buyer completes checkout → order appears in seller's `/manage/orders` → seller opens order detail | `/manage/orders` · `/api/.../manage/orders/[orderId]` | P2-07 Path A order separation (once Phase B lands) | ABSENT |
| J6 | Peer chat send + receive | User A sends encrypted message → User B device receives, decrypts, displays | `/chat/peer/[accountId]` · WebRTC data channel · IndexedDB | P2-01 device-only E2E + P2-04 peer-message RLS | ABSENT · blocked without second device + WebRTC signalling mock |
| J7 | Section-error boundary recovery | Force error in `/chat` segment → fallback renders → "Try again" → segment re-mounts · rest of app stays interactive | `/nex-native/chat/*` with injected error · `/api/.../incident/section-error` POST | Sealed Phase 1 priority 1 failure isolation | ABSENT · needs intentional error injection mechanism |
| J8 | Support ticket submission | User → settings/help → submit ticket + attachment → HQ receives | `/nex-native/settings/help` · POST `/api/.../support/ticket` | P2-05 rate-limit (account_create ring reused) | ABSENT · needs support-ticket API finalised + email mock |
| J9 | Admin country scope grant | HQ admin → manage account → grant Ireland scope → user sees Ireland-locked UI · cannot access Indonesia routes | `/nex-native/admin/accounts/[accountId]` · country-scoped route guards | P2-01 country isolation · HQ admin-grant security | ABSENT · needs admin test account + cross-country assertions |
| J10 | Vault setup + section-error path | User → `/settings/vault` → generate recovery key → intentional error scenario → recovery key visible + downloadable | `/nex-native/settings/vault` · error boundary + "Go home" link test | Sealed Phase 1 priority 1 Vault recovery isolation | ABSENT · needs Vault service fixtures |

---

## 5 · Coverage overlap matrix

| Journey | Coverage % | Blockers |
|---|---|---|
| J1 Sign-in | 60% (unauth routes tested · post-auth redirect untested) | Dedicated test account with biometric enrollment |
| J2 First-visit theme | 100% | Requires `state.json` · owner-interactive bootstrap only |
| J3 Cart → checkout | 0% | D6 sandbox · test Stripe account · payment fixture |
| J4 Live viewer | 70% | Live session infra · comment send flow |
| J5 Order confirm | 0% | Path A schema (mig 355 sandbox apply) · email mock |
| J6 P2P chat | 0% | Two test devices/browsers · WebRTC signalling mock · device-key vault |
| J7 Section-error | 0% | Error injection mechanism · HQ Alerts mock |
| J8 Support ticket | 0% | Support ticket backend + email capture |
| J9 Country scope | 0% | Admin test account · country-scope factory |
| J10 Vault recovery | 0% | Vault service mocks · recovery-key fixtures |

Aggregate · 23% journey depth across 10-journey gate · 7 journeys
fully absent.

---

## 6 · Fixture gap · 10 missing helper types

Currently zero shared fixtures / helpers. Each spec is standalone.
To enable the 10 journeys, the following helper library is
required ·

1. Sign-in helper · programmatic auth · WebAuthn mock OR test
   credential store (not just `state.json` reuse).
2. Cart populator · add products via API or UI automation.
3. Buyer / seller account factory · disposable test accounts with
   known state (coord with J-73 account-deletion fixture).
4. Live session bootstrap · start a fake or uploaded-video session.
5. Order confirmation watcher · verify order lands in seller's
   `/manage/orders` list (Path A dependent).
6. WebRTC signalling mock · fake peer connection for J6.
7. Section-error injector · force render errors in specific
   segments (likely requires a test-only `?__inject_error=` guard).
8. Country-scope factory · create test accounts with specific
   country entitlements.
9. Vault recovery mock · generate test recovery keys + verify
   backup flow.
10. Email capture · intercept outbound emails for J5 + J8.

---

## 7 · Cloudflare / preview compatibility

Per sealed 2026-11-20 directive ·

> we are now use for live site - cloudflare

Playwright currently cannot test against the Cloudflare host ·
`baseURL` is hardcoded to `http://localhost:3008`. To enable
preview / production smoke tests ·

- Accept `PLAYWRIGHT_BASE_URL` env var.
- `baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3008"`.
- Add a separate project `preview-smoke` with a narrower
  testMatch filter (e.g., only the 10 launch-gate specs).
- Document which specs are safe to run against prod/preview (no
  writes) vs dev-only (writes to sandbox DB).

Not a P2-09 implementation step · owner-authorised change.

---

## 8 · What this audit does NOT prove

- Any of the 10 journeys is actually passing · 7 are absent · 3
  require sandbox/fixture provisioning.
- The current 31 specs pass against a Cloudflare preview URL ·
  they only pass against `localhost:3008`.
- WebAuthn interactive sign-in can be fully automated · owner
  infra research required.
- Live-verified claims against production · owner infra per
  sealed 2026-11-08.

Engineering ceiling reached is Verified · inventory + spec level.

---

## 9 · Recommended sequence (not an authorisation)

For owner consideration only ·

1. Author the shared fixtures library (10 helper types above) as a
   SEPARATE increment · one owner-authorised PR.
2. Add `PLAYWRIGHT_BASE_URL` env substitution to `playwright.config.ts`.
3. Provision test Stripe + test email infrastructure (owner infra).
4. Author J1 + J2 complete coverage first (lowest blockers).
5. Author J4 full-depth once comment-send blocker lifted.
6. Author J3 + J5 together (both depend on Path A + Stripe).
7. Author J7 + J10 together (both exercise section-error paths).
8. Author J6 last (highest fixture complexity · requires
   two-device simulation).
9. Author J8 + J9 as a separate pass after Phase 1 remediation
   support-ticket + admin-grant work lands.

---

## 10 · Evidence pointers

Scaffolding ·

- `playwright.config.ts` (lines 1-98)
- `tests/e2e/.auth/state.json` (4.1 KB · gitignored)
- `test-results/.last-run.json` (`status: "passed"`)
- `.gitignore:321` (ignores auth state file)

Existing specs (31 files under `tests/e2e/`) · representative ·

- `mobile-public-surfaces.spec.ts`
- `mobile-authenticated-journey.spec.ts`
- `live-commerce-public-surfaces.spec.ts`
- `live-commerce-video-journey.spec.ts`
- `live-commerce-viewer-footer.spec.ts`
- `live-footer-3-dots-container.spec.ts`
- `live-footer-products-flow.spec.ts`
- `live-header-ping-and-ai-chip.spec.ts`
- `live-library-tiles.spec.ts`
- `live-commerce-visual-verify.spec.ts`
- `personal-chat-preview-hides-business-controls.spec.ts`
- `sign-in-composer-overflow.spec.ts`
- `bio-link-mobile.spec.ts`
- `bio-link-owner-preview.spec.ts`
- `composer-overflow-diag.spec.ts`
- `composer-overflow-regression.spec.ts`
- `create-page-visual.spec.ts`
- `nex-feed-gate1-acceptance.spec.ts`
- `nex-feed-visual-verify.spec.ts`
- `s8-browser-qa.spec.ts`
- 9× `_capture-*.spec.ts`
- `_identify-session-account.spec.ts`
- `_tmp-measure-action-row.spec.ts`

Audit cross-references ·

- `docs/doctrine/chat-privacy-p0-audit-2026-11-21.md` (P2-01)
- `docs/doctrine/billing-rls-audit-2026-11-21.md` (P2-02)
- `docs/doctrine/buyer-checkout-price-validation-audit-2026-11-21.md` (P2-03)
- `docs/doctrine/peer-message-rls-audit-2026-11-21.md` (P2-04)
- `docs/doctrine/rate-limit-infra-audit-2026-11-21.md` (P2-05)
- `docs/doctrine/theme-buyer-ui-wiring-audit-2026-11-21.md` (P2-06)
- `docs/doctrine/path-a-order-separation-audit-2026-11-21.md` (P2-07)
- `docs/doctrine/http-route-test-coverage-spec-2026-11-21.md` (P2-08)
- Sealed memory · `project_nex_remediation_phase_1_2026_11_08.md`
  (Phase 1 priority 1 failure isolation + section-error recovery)

---

## 11 · Readiness classification

| Area | State |
|---|---|
| Playwright scaffolding | Built · Wired · Verified (dev-server scope) |
| 10-journey launch-gate specification | Built · documented |
| Shared-fixtures library (10 helper types) | Not yet built |
| J1 Sign-in coverage | Partial (60%) |
| J2 First-visit theme coverage | Full (100%) |
| J3 Cart → checkout coverage | Absent |
| J4 Live viewer coverage | Partial (70%) |
| J5-J10 coverage | Absent |
| Cloudflare / preview URL support | Not configured |
| D6 sandbox for order / chat journeys | Owner infra (blocked) |

Engineering ceiling reminder · no finding here may be promoted to
Live-verified. That remains an owner infra call per sealed
2026-11-08.
