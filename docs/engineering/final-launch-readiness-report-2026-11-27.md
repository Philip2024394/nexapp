# NEX Final Launch-Readiness Report · 2026-11-27

Authored under NEX Master Engineering Directive (CLAUDE.md Rule 9). Uses
only **verified evidence** per Rule 8 taxonomy. **"Launch-ready" is NOT
claimed** — material gates remain open (listed in §13 and §15).

Sources of truth consulted:
- `docs/engineering/NEX-DELIVERY-LEDGER.md` (L-001 … L-051 active table)
- `docs/engineering/navigation-inventory.md` (Axis A slices + HQ Axis A)
- `docs/engineering/post-regression-failure-register-2026-11-26.md`
- `docs/engineering/single-app-country-model-reconciliation-2026-11-26.md`
- `docs/engineering/mig-207-257-reconciliation-2026-11-26.md`
- `docs/engineering/l-006-welcome-redirect-chain-diagnosis-2026-11-27.md`
- `docs/engineering/hq-finding-f3-journey-map-missing-admin-gate-2026-11-27.md`
- `nex-supabase/migrations/368_nex_account_region_pref.sql` (drafted, NOT applied)
- `tests/e2e/_runs/20261126T-*.log` + `20261127T-*.log`

HEAD unchanged in this cycle. Zero commits · zero pushes · zero
migrations applied · zero credentials activated. Rule 7 boundaries
preserved.

---

## 1 · BUILT

Implementation exists on disk (Rule 8 definition).

| Ref | Artefact | Where |
|---|---|---|
| L-001 | Permanent rulebook + startup enforcement | `CLAUDE.md` · `NEX-DELIVERY-RULES.md` · `.claude/settings.json` · this ledger |
| L-003 | `pg.Pool` `connectionTimeoutMillis: 2_000` | `src/lib/nex-native/local-directory-service.ts` |
| L-008 | HMAC-signed `nex_account_active_seen` + Route Handler | `src/app/api/nex-native/welcome/mark-seen/route.ts` · `src/lib/nex-native/onboarding/account-active-seen.ts` · `_welcome-shell.tsx` · `_mark-seen-pinger.tsx` |
| L-011 | Chat Themes three-category hub + category libraries | `src/app/nex-native/chat-themes-library/{page,plain,small,full-image}` |
| L-013 | Pooler `NEX_POSTGRES_URL` repoint | `.env.local:155-161` |
| L-025 | `pwa-install-cadence` iPhone hydration gate | `tests/e2e/pwa-install-cadence.spec.ts:46-71` |
| L-027 | Live-Commerce project block removed | `playwright.config.ts:182-203` |
| L-036 | `ClientDateTime` hydration wrapper | `src/app/nex-native/manage/orders/[orderId]/_client.tsx` |
| L-042 | `ClientRelTime` orders-list wrapper | `src/app/nex-native/manage/orders/_client.tsx:65-84` |
| L-043 | `ClientMessageTime` wrapper + `formatBubblePrice` `en-US` pin | `src/app/nex-native/chat/_portrait-bloom-shell.tsx` |
| L-044 | Six pillar-tsc defects fixed in-place | `_log-call-action.ts` (NEW) · `_full-library-client.tsx` · `_product-detail-sheet.tsx` · `manage/categories/_actions.ts` · `manage/products/[productId]/page.tsx` · `manage/shop/themes/_actions.ts` · `vault/home/chats/*` |
| L-051 | `cf-ipcountry` region echo on 200 responses | `src/app/api/nex-native/billing/checkout/shop/route.ts:215-227` |
| 2026-11-27 | Migration 368 draft `nex_account.region_pref` + rollback | `nex-supabase/migrations/368_nex_account_region_pref.sql` · `368_…_rollback.sql` |
| 2026-11-27 | NAV-04/05 column-gated spec | `tests/e2e/nav-single-app-04-05-region-pref-and-cross-country-rls.spec.ts` |

## 2 · WIRED

Connected to real dependencies and reachable from product code.

- L-008 welcome mark-seen · Route Handler reachable at `/api/nex-native/welcome/mark-seen` · `WelcomeShell` passes endpoint from account-active page.
- L-011 Chat Themes · hub replaces old redirect · three library routes share `FullLibraryClient` with pure-TS category classifier.
- L-013 directory · `fetchCanonicalRows` connects to sandbox pooler (`SELECT 1` ~1.0 s).
- L-029/L-030/L-031/L-033/L-035/L-037 Shop journeys · harness-seeded merchant + business + product/menu/order rows exercise the real server actions and sealed selectors.
- L-032 identity chrome · `_world-stylesheet.tsx:410-417` emits `data-nex-world-root` / `data-nex-identity`.
- L-047/L-049/L-051 country-resolver · pricing SSR + `/api/nex-native/billing/checkout/shop` observe `resolveViewerRegion` under real headers.
- L-043 chat portrait-bloom fixture helpers (`seedChatPeer`, `createTestConversation`, `createTestMessage`) added to `tests/e2e/_fixtures/sandbox-test-harness.ts` · CASCADE on `nex_account` delete per migs 047/093.

## 3 · VERIFIED

Real test evidence proves intended behaviour (Rule 8). Evidence log filenames preserved.

### 3.1 · Chat pillar
- **L-007** PWA + SOS hydration · 39 passed / 12 skipped / 0 failed (`20261126T054000-L007-pwa-install-hydration-v5.log`).
- **L-015** peer composer renders · 3 passed (`20261126T-chat-send-composer-fixture-v2.log`).
- **L-043** portrait-bloom hydration under `en-GB` + `Asia/Jakarta` · 2 passed / 45.0 s / EXIT=0 (`20261127T-L043-portrait-bloom-run1.log`). Three contracts all green on first attempt.
- **L-048** fresh-buyer Ask-Seller send (device-key seed required) · 2 passed / 49.5 s (`20261126T-chat-fresh-buyer-fix-attempt-1.log`).

### 3.2 · Shop pillar
- **L-029** publish → storefront + status gate + ownership gate · 4 passed / 56.2 s.
- **L-030** full merchant onboarding form → DB → product → storefront · 2 passed / 1.1 m.
- **L-031** archive change → DB flip → public hide · 2 passed / 51.5 s.
- **L-033** `/manage/orders` renders with ownership isolation · 2 passed / 1.0 m.
- **L-034** 227-category Zod spec payload helper · 4 passed / 12.7 s.
- **L-035** product-spec editor ownership redirect · 2 passed / 1.2 m.
- **L-037** menu-item silent ownership redirect · 2 passed / 1.2 m.
- **L-038/L-039/L-040** accommodation-room + product-edit two-hop + product-interest ownership gates (per ledger entries).
- **L-017** buyer checkout landing + add-to-cart affordance · 2 passed / 27.3 s.
- **L-016** signed-out buy auth-gate banner · 2 passed / 7.9 s.
- **L-018** signed-out purchase resume (5 contracts) · 5 passed / 49.6 s.
- **L-022** 5 adversarial next-preservation + cart-dedup · 6 passed / 1 honest skip / 1.1 m.
- **L-023** direct shop + product reachability · 7 passed / 30.6 s.

### 3.3 · Chat Themes pillar
- **L-011** three-category hub · 6/6 passed (`journey-chat-themes-three-category-hub.spec.ts` · 36.3 s).
- Chat-theme apply-free + region-unsupported-waitlist re-pointed to `/full-image` · pass / honest skip.

### 3.4 · Account / sign-in / welcome
- **L-008** 5 welcome one-time gate tests (A–E) · 5 passed / 1.3 m.
- **L-020** 4 ordinary sign-in next-preservation + default landing · 4 passed / 37.8 s.
- **L-021** signup form wiring + mode round-trip · 3 passed / 25.3 s.
- **L-003** `/directory` 20 s timeout resolved · 5/5 PASS directory test 4.6 s.

### 3.5 · Navigation (Axis A — role × session × drawer)
- **L-041** signed-in merchant × IE · 17/17 · 3.8 m + 3.6 m (two consecutive stable runs).
- **L-045** guest × IE · 16/16 · 23.7 s.
- **L-046** signed-in-buyer (no shop) × IE · 17/17 · 3.4 m · zero residuals.

### 3.6 · Navigation (Axis B — single-app country selection)
- **L-047** NAV-SINGLE-APP-07 role × country currency label · 3 passed / 27.5 s.
- **L-049** NAV-SINGLE-APP-02 edge-geo tier via `cf-ipcountry` · 5 passed / 11.5 s.
- **L-050** NAV-SINGLE-APP-03 Accept-Language tier (unit) · 21 passed / 223 ms (vitest).
- **L-051** NAV-SINGLE-APP-06 checkout endpoint region resolution · 5 passed / 54.7 s.

### 3.7 · Identity chrome
- **L-032** identity-chrome regression · 3 passed / 12.9 s · 52/52 vitest unit tests PASS · explicit anti-`indonesia` assertion holds.

### 3.8 · Perf regression
- **§10.1.1** backdrop preload mobile skip + Supabase preconnect · fail-then-pass across repeated samples.
- **§10.1.2** `/api/nex-native/version` opt-in deployment-chain probe (SKIP when env unset — honest).

### 3.9 · Full regression
- **L-012** full `playwright test` executed under preserved-log envelope · 179 passed · 50 skipped · 15 did not run · 62 failed · EXIT=1 · 27.7 m. All 62 fails map to pre-existing ledger entries (55 × L-009 live-commerce retired bucket; 5 × L-006 BLOCKED-AT-APPROVAL; 1 × L-024 describe-skipped; 1 × L-025 isolated-pass flake).

## 4 · FAILED

Tests/implementations that did not work.

- **L-009** · 54 live-commerce failures in `mobile-chromium-pixel7-live-public`. Classified not-a-pillar per Rule 4. Project block removed (L-027) · spec files remain on disk pending a separate owner-approved deletion.
- **L-048 first run** · FAILED-then-FIXED. Root-cause `no_self_devices` → device-key seeded in spec · re-run PASS.
- **L-044 pre-fix tsc baseline** · 1877 errors on HEAD. Pillar-impacting 6 fixed in this cycle; non-pillar residue remains (see §14).

## 5 · SKIPPED

Deliberately not executed, with reason.

- **L-024** `mobile-authenticated-journey.spec.ts` · describe-skipped as STALE-AGAINST-SEALED-RETIREMENT (`/home` permanently redirected; `/chat/first-visit*` deleted). Will be retired or rewritten under L-006 batch.
- **NAV-04/05 spec** (`nav-single-app-04-05-region-pref-and-cross-country-rls.spec.ts`) · `hasRegionPrefColumn()` gate returns `false` on sandbox HEAD → both tests `test.skip` until migration 368 is approved and applied.
- **NAV-05 anon-probe leg** · explicit `test.skip` in-spec · pending `APPROVE NAV-05 ANON-PROBE HARNESS EXTENSION`.
- **L-006 mobile-public-surfaces** · 5 failures held at approval — spec itself still runs under full regression but asserts stale routes. Diagnosis complete (see §13).

## 6 · NOT EXECUTED

- Full fresh regression under current HEAD (last preserved full run is L-012 2026-11-26). Not re-run this cycle — no engineering change since L-012 would alter pillar-bucket outcomes, and the owner directive prohibited re-running VERIFIED journeys without a regression reason.
- Production smoke on any surface (prod is sealed per Rule 7).
- Any migration apply (prod or sandbox — all sandbox migrations require named approval per Rule 7; mig 286 and mig 368 remain unapplied).
- Live-mode Stripe/PayPal · L-004 BLOCKED-PENDING-CONFIG.
- Browser cross-country RLS leg of NAV-05 · needs anon-probe helper that has not been authored.

## 7 · NAVIGATION

**Axis A** (role × session × drawer) — 3 of 4 roles VERIFIED in IE country context.

| Role | Status | Evidence |
|---|---|---|
| Guest | VERIFIED | L-045 · 16/16 |
| Signed-in buyer (no shop) | VERIFIED | L-046 · 17/17 |
| Signed-in merchant (shop owner) | VERIFIED | L-041 · 17/17 stable across two runs |
| HQ admin | PARTIAL | Inventory authored this cycle (`navigation-inventory.md` HQ Axis A section). No per-row browser evidence yet. F3 security finding opened — journey-map page has NO admin gate. |

**Axis B** (in-app country selection) — 4 of 7 VERIFIED.

| ID | Target | Status |
|---|---|---|
| NAV-SINGLE-APP-01 | Country selection on business-details | BLOCKED on mig-286 sandbox apply (`APPROVE MIG 286 SANDBOX APPLY`) |
| NAV-SINGLE-APP-02 | IP-pickup via `cf-ipcountry` | VERIFIED (L-049) |
| NAV-SINGLE-APP-03 | Accept-Language fallback | VERIFIED-unit (L-050) |
| NAV-SINGLE-APP-04 | Country change via `region_pref` | BLOCKED on mig-368 (drafted this cycle) |
| NAV-SINGLE-APP-05 | Cross-country RLS isolation | BLOCKED on mig-368 + NAV-05 anon-probe helper |
| NAV-SINGLE-APP-06 | Checkout region correctness | VERIFIED (L-051) |
| NAV-SINGLE-APP-07 | Role × country currency label | VERIFIED (L-047) |

Side drawer / navigation audit treated as a **live quality gate**, not a one-shot inventory. 18 drawer rows catalogued under IE identity. HQ overlay section added this cycle to `navigation-inventory.md`. Three BROKEN rows identified in prior cycles were repaired (F2 pending) or retired (live-commerce).

## 8 · CUSTOMER JOURNEYS

End-to-end (BUILT → WIRED → VERIFIED per Rule 8).

- Guest lands on `/` splash → signed-out destination resolver (sealed G-2) → `/sign-in` or `/free-chat?show-themes=1`.
- Signed-in buyer lands on `/contacts` after sign-in · drawer rows resolve correctly.
- Shop-less merchant navigates to `/manage` → dispatcher sends to `/setup/business-details` → fills four gated fields → saves → re-enters setup → `/review`.
- Merchant publishes product → public storefront `/<slug>` renders business + live product · draft products hidden · cross-merchant isolation enforced (L-029).
- Merchant archives product via UI → DB flips `live→archived` → public storefront hides the product (L-031).
- Buyer views live product · Add-to-cart writes `nex_cart_v1` · refresh persists cart · duplicate-tap idempotent (L-018 / L-022).
- Signed-out buyer taps Buy → sealed 2026-11-21 auth-gate banner · `?next=` preserved · post-auth returns to product (L-016 / L-018).
- Buyer + merchant Ask-Seller chat (fresh account) round-trip with device-key published ahead of Send (L-048).
- Merchant views `/manage/orders` · list + product-name-joined row renders · cross-merchant isolation enforced (L-033).
- Ownership asymmetries per surface kept distinct and tested (orders `notFound()` · products `redirect(?e=spec_forbidden)` · menu `silent redirect`) — L-035/L-037/L-038/L-039/L-040.

**Journeys NOT end-to-end VERIFIED yet:**
- Full-form product spec-editor UI drive (30+ fields) — payload helper VERIFIED (L-034) but no UI spec authored.
- T8 full merchant order UI loop (buyer-creates → merchant-receives → status transitions → buyer-notified) — harness level PASS; full UI loop remains PARTIAL.
- Positive-path Stripe + PayPal — BLOCKED-PENDING-CONFIG (L-004).
- NAV-05 cross-country anon-probe RLS leg — pending harness extension.

## 9 · SECURITY

Status of the sealed invariants.

- RLS, ownership gates, auth gates, device-based E2E encryption · **preserved** across every VERIFIED journey this cycle.
- Welcome mark-seen gate upgraded to HMAC-SHA256 envelope + 401/503 fail-closed (L-008) — JS cookie-forgery blocked.
- Identity-chrome regression (L-032) asserts no reintroduction of sealed-off `indonesia` identity at DOM level.
- Chat peer-conversation RLS unchanged. L-043 fixture rides pre-mig-093 plaintext mode only (same path the shell already tolerates for legacy rows).
- L-051 live-mode safety guard: any `cs_live_` substring in checkout response forces FAIL (never silent pass).
- **Open finding F3 — HQ journey-map missing admin gate** · `src/app/nex-native/hq/journey-map/page.tsx` has no `resolveSessionWithDevOverride` + `requireHqAdmin` + `notFound()` chain. Header comment lines 20-22 FALSELY claims the gate is upstream. Zero middleware HQ gate exists. Any desktop viewer at ≥ 900 px can read HQ journey-map strategic content (no PII leakage). Severity Medium (reputational/strategic disclosure). Proposed 6-line patch prepared · not applied per Rule 12 (security changes reserved for owner). Approval phrases: `APPROVE F3 PATCH APPLY` / `APPROVE F3 BATCH INTO HQ GATE SWEEP` / `APPROVE F3 ACCEPT AS-IS`.

## 10 · DATABASE / MIGRATIONS

- **Sandbox** ref `kdstoyyeygcopkogqsyv` · pooler region `aws-1-eu-west-3`.
- **Production** ref `ijvqdvsvwtwxzcqmoqit` · sealed. No prod DB access in this cycle.
- **Mig 207/257 reconciliation** · L-005 · doc `mig-207-257-reconciliation-2026-11-26.md` (656 lines / 39 sections) · BLOCKED-AT-APPROVAL. Mig 207 schema state FULLY present (only history row missing); mig 257 partial — `shop_tier` + `business_trial_status` + 1 index applied; `shop_period_end`, `shop_status`, `shop_past_due_at`, `vault_tier`, `vault_period_end`, `vault_status`, `vault_past_due_at` MISSING. Approval phrases: `APPROVE OPTION A FILE REVIEW` / `APPROVE OPTION B` / `APPROVE OPTION C` / `HOLD`.
- **Mig 286** `nex_business.operating_country_code` · authored, NOT applied to sandbox · blocks NAV-SINGLE-APP-01. Approval phrase: `APPROVE MIG 286 SANDBOX APPLY`.
- **Mig 354-365** buyer-side transactional cart-order path · authored, NOT applied. Blocks positive-path `journey-buyer-checkout.spec.ts:123,133`. Approval phrase: `APPROVE MIG 354-365 SANDBOX APPLY`.
- **Mig 367** reserved for `nex_order.shop_status` per `APPROVE L-005 OPTION A`.
- **Mig 368** `nex_account.region_pref` · **drafted this cycle** · both forward (`368_nex_account_region_pref.sql`) and rollback (`…_rollback.sql`). Additive nullable text column with no CHECK constraint (resolver `normaliseToCheckoutRegion` tolerates any input). NULL default preserves current behaviour. NOT APPLIED. Approval phrase: `APPROVE NEX_ACCOUNT REGION_PREF MIGRATION SANDBOX`.
- Canonical directory connectivity VERIFIED via pooler (L-013): `nex.business_canonical` schema reachable (0 sandbox rows), `public.nex_business` 32 live rows.

## 11 · PAYMENTS

- **L-004 Stripe + PayPal positive-path** · BLOCKED-PENDING-CONFIG. Owner must populate `.env.local` with `STRIPE_WEBHOOK_SECRET` + four `PAYPAL_*` vars. Checklist at `t10-payment-credentials-unblock-2026-11-26.md`. Approval phrase: `APPROVE T10 SANDBOX CREDENTIALS`.
- **T10 harness** · 5/5 PASS in 25.7 s · webhook signature verification + invalid-sig rejection + idempotency + merchant-owned destination all confirmed in code paths that run.
- **L-051** checkout endpoint region resolution · 5 passed (test-mode Stripe only reaches the Session-creation branch for IE where the price ID is set; GB/US/ID short-circuit on 422 `missing_price_id` before Stripe is contacted). Live-mode safety guard asserts no `cs_live_` substring ever appears.
- **No live charges** have been attempted. No PayPal activation. No production Stripe keys configured.

## 12 · PERFORMANCE

- Backdrop preload (§10.1.1) · 2.1 MB mobile skip proven fail-then-pass · `media="(min-width: 500px)"` + `fetchPriority="low"` landed · 600 KB budget enforced in regression spec.
- Supabase preconnect + DNS-prefetch landed (§10.1.1).
- Dev-mode HMR state identified as source of L-025 (iphone-emulated) + L-028 (welcome mark-seen) flakes · both PASS in isolation · no product-code change needed.
- **CI enforcement** · perf-regression workflow runs on PR + push · **NOT yet required via branch-protection ruleset** on `Philip2024394/nexapp` (see CLAUDE.md §10.3). Owner must add the ruleset to make the rule fully enforced.

## 13 · LAUNCH READINESS (status · not a claim)

**"Launch-ready" phrase BANNED** per strict-completion standard until a real customer can sign up · chat · find shop · contact seller · place order · complete merchant-owned payment with correct security/nav/notifications.

**What the VERIFIED set proves TODAY:**
- Three-pillar baseline journeys execute end-to-end on sandbox with real DB writes and real browser assertions for: sign-up form wiring, sign-in next-preservation, directory render, three-category theme hub, merchant onboarding form → DB → storefront, product publish/archive, order list with ownership isolation, Ask-Seller fresh-buyer round-trip.
- Country resolver works at the pricing-SSR layer (edge-geo) and the checkout API layer (both tiers).
- Nav Axis A: guest/buyer/merchant drawer rows do the right thing under IE identity.

**What is NOT YET VERIFIED (prevents launch):**
1. Full-form product edit UI drive (not just archive) — L-030 / L-034 are prerequisites but no UI spec.
2. Full T8 buyer-creates-order → merchant-manages-order round-trip in one UI journey.
3. Positive-path Stripe + PayPal — BLOCKED-PENDING-CONFIG.
4. Cross-country RLS leg of NAV-05.
5. NAV-SINGLE-APP-01 country selection on business-details (blocks ID merchant signup).
6. Mig 207/257 reconciliation owner call.
7. HQ gate on `/journey-map` (F3).
8. L-006 welcome / `/create-account` emitter batch — 16 emitters produce 404 clicks in production until F2 lands.
9. Full regression re-run under a cycle that has engineering change (L-012 is the preserved baseline; next engineering change triggers a fresh full run).
10. Branch-protection ruleset activation for perf-regression CI (required by CLAUDE.md §10.3 before perf rule is fully enforced).

## 14 · REMAINING

### 14.1 · Independent (no owner approval needed)
- None currently progressable without crossing an approval gate or re-running already-verified journeys. Every remaining task either (a) requires a named approval phrase (migrations, credentials, commits/pushes, security patch), (b) depends on a BLOCKED predecessor, or (c) is deliberately deferred under Rule 3.

### 14.2 · Blocked on owner decision
| Task | Approval phrase | Blocker |
|---|---|---|
| L-004 T10 positive-path | `APPROVE T10 SANDBOX CREDENTIALS` | Env var population |
| L-005 mig 207/257 | `APPROVE OPTION A FILE REVIEW` / `OPTION B` / `OPTION C` / `HOLD` | DB-admin decision |
| L-006 welcome F2 batch | `APPROVE L-006 OPTION A · REINSTATE /create-account` / `OPTION B · REWIRE 16 EMITTERS` / `OPTION C · SPEC-ONLY MIGRATION` | Product-UX decision |
| NAV-SINGLE-APP-01 (mig 286) | `APPROVE MIG 286 SANDBOX APPLY` | Sandbox mig apply |
| NAV-SINGLE-APP-04/05 (mig 368) | `APPROVE NEX_ACCOUNT REGION_PREF MIGRATION SANDBOX` | Sandbox mig apply |
| NAV-05 anon-probe helper | `APPROVE NAV-05 ANON-PROBE HARNESS EXTENSION` | Harness extension approval |
| T2.5 buyer checkout mig 354-365 | `APPROVE MIG 354-365 SANDBOX APPLY` | Sandbox mig apply |
| F3 HQ journey-map gate | `APPROVE F3 PATCH APPLY` / `BATCH INTO HQ GATE SWEEP` / `ACCEPT AS-IS` | Security patch |
| Commit 2026-11-26 continuation set | `APPROVE L-044 COMMIT` / `APPROVE L-044 COMMIT AND PUSH` | Rule 7 commit boundary |
| Perf-regression branch-protection ruleset | (owner GitHub-settings action) | CLAUDE.md §10.3 |

### 14.3 · Non-pillar debt (non-blocking)
- 1381 non-pillar tsc errors (`src/lib/nex/` legacy audience model · chat-standard Motion/Particle token drift · scripts/_tmp noise · test fixtures with imports to non-existent modules · doctrine draft worker types · Supabase generated types). Per CLAUDE.md "clean up incrementally, not in one pass" and L-044 import-graph analysis: zero active pillar journey imports the 196 + 26 dead-code files. Future optional work: scoped tsconfig excludes.

## 15 · BLOCKED

Specifically what is preventing progress on each P0/P1 item.

- **Prod deploy** — Rule 7 absolute boundary. No prod DB access · no prod migration · no prod deploy · no commit · no push · no live Stripe/PayPal activation without explicit owner approval naming the exact scope.
- **Mig apply (sandbox)** — Rule 7 requires named approval for sandbox migrations (mig 207/257 · 286 · 354-365 · 368 · 367 all held).
- **L-006 F2 batch** — owner-batch decision on welcome page restoration vs 16-emitter rewrite.
- **F3 HQ patch** — Rule 12 reserves security decisions for the owner.
- **Full regression next run** — gated on next engineering change landing (no VERIFIED journey should be re-run without a regression reason per the owner directive).
- **Commit/push** — 9dfa90b4 is the last authorised commit. The L-044 follow-on sweep and all 2026-11-27 drafts (mig 368, NAV-04/05 spec, L-006 diagnosis doc, F3 finding doc, HQ inventory addition, this report) await a fresh explicit owner authorisation.

## 16 · NEXT CONCRETE ENGINEERING ACTION

**Primary** — wait for owner approval on one of the named phrases in §14.2. On receipt, execute scoped work exactly matching the phrase and nothing beyond it.

**Independent fallbacks** (if no approval arrives) are intentionally empty this cycle. All remaining authorised work either depends on a BLOCKED predecessor, has already been VERIFIED, or would duplicate a documented artefact.

Specifically:
1. **If `APPROVE NEX_ACCOUNT REGION_PREF MIGRATION SANDBOX` arrives** → apply mig 368 on sandbox; drop the column gate from the NAV-04/05 spec; run `nav-single-app-04-05-region-pref-and-cross-country-rls.spec.ts` to verify NAV-04 identity-preservation leg and NAV-05 structural ownership proof leg; keep NAV-05 anon-probe leg skipped (its own approval); update ledger entry #125 to VERIFIED on the two unblocked legs.
2. **If `APPROVE MIG 286 SANDBOX APPLY` arrives** → apply mig 286 on sandbox; re-run the deferred NAV-SINGLE-APP-01 spec at `tests/e2e/journey-country-selection-business-details.spec.ts`; mark L-NAV-01 VERIFIED.
3. **If `APPROVE L-006 OPTION A/B/C` arrives** → execute the exact scope of the chosen option per `l006-f2-approval-request-2026-11-26.md`; re-run `mobile-public-surfaces.spec.ts`; confirm the 5 failures close.
4. **If `APPROVE F3 PATCH APPLY` arrives** → apply the 6-line patch at `src/app/nex-native/hq/journey-map/page.tsx` exactly as drafted in §4 of the F3 finding; author a short HQ admin-gate regression spec; confirm non-admin → 404.

Any of these completions triggers a fresh full regression (CI + local), fresh handoff update, and a corresponding ledger row promotion with evidence log preserved under `tests/e2e/_runs/`.

---

## End-of-cycle delivery summary (per owner directive 2026-11-27)

### Tasks completed this cycle

1. **Reconciled 60-task list against authoritative ledger.** Delivery ledger (`NEX-DELIVERY-LEDGER.md`) is the single source of truth; the prior session task-tool list #64–#79 is already reconciled in the ledger's reconciliation table. No task reopened that was legitimately closed.
2. **Mobile-public-surfaces L-006 diagnosis complete.** `docs/engineering/l-006-welcome-redirect-chain-diagnosis-2026-11-27.md` authored: 5 failures classified as stale-spec (G-2 refactor retired routes without migrating spec) plus 1 hidden real defect (16 code sites still emit `/nex-native/create-account` → 404 in production). Three owner-decision approval phrases drafted. No approval-gated F2 code change made.
3. **NAV-04/05 migration preparation complete.** Migration 368 drafted both forward and rollback. Additive nullable text column, no CHECK constraint (resolver tolerates any input), NULL default preserves current behaviour. Reserved 367 for L-005 shop_status per existing approval phrase. Nothing applied.
4. **NAV-04/05 spec drafted.** `tests/e2e/nav-single-app-04-05-region-pref-and-cross-country-rls.spec.ts` authored with `hasRegionPrefColumn()` gate (test.skip until mig 368 applied). NAV-04 identity-preservation assertions complete. NAV-05 structural ownership-isolation proof complete; cross-country anon-probe RLS leg marked `test.skip` pending separate harness-extension approval. Spec NOT registered in `playwright.config.ts` testMatch (deferred until migration approved).
5. **HQ Axis A navigation inventory slice appended.** 18-row HQ nav table + orphan-route table + dev-preview note + F3 finding + summary counts written to `docs/engineering/navigation-inventory.md` before the "Change log" section.
6. **Finding F3 security document authored.** `docs/engineering/hq-finding-f3-journey-map-missing-admin-gate-2026-11-27.md`. HQ journey-map page confirmed to have zero structural auth gate (3 grep matches all string-literal content; middleware zero HQ-gate matches). Proposed 6-line patch drafted. Three approval phrases named. Not applied per Rule 12.
7. **Final 16-section launch-readiness report delivered** (this document) using only verified evidence. "Launch-ready" NOT claimed. 10 outstanding gates listed in §13. Blockers consolidated in §15.

### Next unfinished authorised task

**Await explicit owner approval naming one of the ten phrases in §14.2.** All independent authorised work is complete this cycle. Resuming without an approval phrase would re-run VERIFIED journeys (prohibited by the owner directive) or cross an approval boundary (prohibited by Rule 7).

Boundaries preserved end-to-end: HEAD unchanged · 0 commits · 0 pushes · 0 migrations applied · 0 credentials activated · 0 production touched · 0 sealed invariants weakened.
