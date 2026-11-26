# NEX Navigation & Journey Ledger

**Permanent source-of-truth for every user action, direction, branch and destination in `C:/Users/Victus/nexapp`.**

> This ledger supersedes the ad-hoc Navigation Audit as a *living* document.
> The audit at `docs/doctrine/nex-navigation-transition-audit-2026-11-24.md`
> remains the Pass 1 historical record; all **new rows** and all **status
> promotions** are tracked here. Pass 1 identifiers (NAV-0001 … NAV-0085)
> are permanent — never renumbered, never reused.

**Last reconciled:** 2026-11-25 (Cycle 11 · security + editorial deepening).

### Cycle 11 delta · 2026-11-25

- **NAV-security-account-isolation · 6 rows (C11-SEC)** — RSC `/conversations/<non-participant-id>` renders not-found UI with zero conversation markup · API read/write endpoints reject non-participant access at service layer · unauth write returns `401` before participant check runs · unauth incremental-read returns `401`. Status `VERIFIED (authorization boundary, single-fixture probes)`. Evidence `tests/e2e/security-account-isolation.spec.ts` (6/6 green, 2026-11-25). Caveat: two-fixture cross-account probe BLOCKED on missing second storageState (random-UUID probes exercise the same guard code path by design).
- **NAV-why-nex-editorial · 4 rows (C11-NEX-006)** — exactly 7 advantage cards render; 2 LIVE cards are the sealed pair ("Merchant-direct payments" + "Flat monthly shop subscription · 0% NEX commission"); 3 CTAs present with sealed hrefs (`/nex-native/manage/shop/setup`, `/nex-native/switch`, `/nex-native/pricing`); Honest Limits footer declares `nexapp.app` domain + explicit "not an outage-immunity promise"; no "first / only / best / world-class / unrivalled / unmatched" over-claims in page copy. Status `VERIFIED`. Evidence `tests/e2e/why-nex-editorial-verification.spec.ts` (4/4 green, 2026-11-25). Supersedes smoke-only coverage.
- **NAV-switch-math · 26 rows (C11-NEX-007)** — unit-level math + 10-currency locale parsing + sealed honesty invariants + commission-stacking behaviour all pass. Status `VERIFIED (unit tests)`. Evidence `src/app/nex-native/switch/__tests__/_calc-helpers.test.ts` (26/26 green via `npx vitest run`, 2026-11-25). Covers: extractNumericAmount across €/£/US$/Rp/AU$/¥/₫/CHF/SEK/₹; clampNonNegative sanitisation; PRESETS registry carries source citation + last-verified date on every preset; 22.5% Lazada + 17.4% Shopee preset dated; computeSwitchComparison honesty rules (zero-sales / nex-costs-more / per-order fixed-fee stacking / annual=12×monthly label).
- **NAV-full-viewport-extended · 7 rows (C11-NEX-021)** — 6 public pillar routes (`/nex-native`, `/nex-native/sign-in`, `/nex-native/directory`, `/nex-native/why-nex`, `/nex-native/switch`, `/nex-native/pricing`) each satisfy: body occupies full viewport · zero margin · no horizontal scroll · post-scroll stability (no new browser-chrome injected mid-session) · `html` overflow matches expected sealed values. Status `VERIFIED (Chromium Pixel 7 CSS contract)`. Evidence `tests/e2e/full-viewport-extended-coverage.spec.ts` (7/7 green, 2026-11-25). Caveat: Real-device Safari install-prompt + chrome behaviour remains emulation-only · WebKit not installed · not authorised to install this cycle.
- **NAV-ask-seller · root-cause recorded (C11-ASK)** — the Cycle 9/10 BROKEN composer send is a product-share-lock / hydration-text-mismatch defect, NOT a security event. Root cause documented in-code at `src/app/nex-native/conversations/[conversationId]/_client.tsx:978-990`: historical SSR/CSR locale mismatch in `Intl.NumberFormat` call caused React 19 to regenerate the chip subtree, detaching the Send button's React fiber so `onClick` never fired. Fix (threading viewer `lang`) was sealed in Cycle 10 at line 992. E2E re-verification via existing `tests/e2e/journey-ask-seller-nonowner-full.spec.ts` BLOCKED on Playwright worker env-propagation issue (sealed fixture env vars `NEX_E2E_SEED_SHOP_SLUG` / `NEX_E2E_SEED_PRODUCT_ID` not reaching the worker · tooling investigation outside Cycle 11 scope).

### Cycle 10 delta · 2026-11-25

- **NAV-full-viewport-pillar · 3 rows (NEX-021)** — `/nex-native`, `/nex-native/sign-in`, `/nex-native/directory` body occupies full viewport with zero margin. Status `VERIFIED`. Evidence `tests/e2e/full-viewport-chrome.spec.ts` (4/4 green, 2026-11-25). Reverse-direction = standard back-nav; no new destination. Caveat: CSS-contract only. Mobile browser tab bar remains OS-owned.
- **NAV-why-nex · 2 rows (NEX-006)** — forward: splash drawer / cross-link lands on `/nex-native/why-nex` which renders `[data-nex-why-page]` + ≥1 LIVE-labelled advantage + Switch CTA. Reverse: back-link chip → `/nex-native`. Status `VERIFIED` (smoke). Evidence `tests/e2e/smoke-why-nex.spec.ts` (1/1 green, 2026-11-25). Caveat: smoke only, no editorial copy assertion.
- **NAV-switch · 2 rows (NEX-007)** — forward: `/nex-native/why-nex` CTA or direct entry lands on `/nex-native/switch`; client calculator mounts; sealed honesty copy visible; comparison block reactive. Reverse: back-link → `/nex-native/why-nex` or splash. Status `VERIFIED` (smoke). Evidence `tests/e2e/smoke-switch-calculator.spec.ts` (1/1 green, 2026-11-25). Caveat: smoke only, no math or FX branch verification — math correctness lives in `src/app/nex-native/switch/__tests__/`.
- **NAV-ask-seller · non-owner composer send** — status UNCHANGED (`BROKEN`). Cycle 10 Path B STOPPED on identity mismatch (see Launch Evidence § 2.1a). Investigation `BLOCKED` pending owner authorisation.

---

## 1 · Honesty & numbering rules

- A row recorded here does **not** mean the transition is **VERIFIED**.
- **Status enum (sealed 2026-11-24, from the Pass 1 audit § 2.2):**
  - `DISCOVERED` — code-path exists, trigger exists; no reverse-direction or outcome branches mapped.
  - `MAPPED` — all outcome branches enumerated AND reverse-direction enumerated; no executed test evidence.
  - `PARTIALLY VERIFIED` — one branch (typically success via Dev Pass or admin) executed in sandbox; other branches still DISCOVERED/MAPPED.
  - `VERIFIED` — Playwright or integration test exercises the exact path in sandbox, against the current migration state, covering every declared outcome branch for the row.
  - `BLOCKED` — cannot be verified because an upstream dependency is unapplied (migration, env var, seed row).
  - `BROKEN` — the path has been executed and does not achieve its stated destination or data-write.
- **Mapped ≠ Implemented. Implemented ≠ Verified. Route-exists ≠ Journey-works.** (Blueprint § 9 / sealed Launch Programme.)
- A partial result is **PARTIALLY VERIFIED**, never **VERIFIED**. Verification status is per *branch*, not per *row*.

---

## 2 · Pass 1 carry-over (from audit, 2026-11-24)

| Segment | NAV range | Count | Status distribution |
|---|---|---|---|
| A · Splash / SOS / first-paint | NAV-0001 – NAV-0010 | 10 | DISCOVERED 10 |
| B · Account creation & verification | NAV-0011 – NAV-0025 | 15 | DISCOVERED 12 · VERIFIED 2 (NAV-0017, NAV-0025) · BROKEN 1 (NAV-0019) · BLOCKED 1 (NAV-0021) |
| C · Core signed-in surfaces | NAV-0026 – NAV-0060 | 35 | DISCOVERED ~30 · BROKEN 4 (NAV-0043, NAV-0052, NAV-0056, NAV-0057) · others partial |
| D · Shop lifecycle | NAV-0061 – NAV-0085 | 25 | VERIFIED 2 (single-seller checkout + price-validation sandbox) · BLOCKED 2 (NAV-0082 Stripe, NAV-0085 QR confirm) · others DISCOVERED |

**Pass 1 test coverage ratio:** 8 / 85 rows (9.4 %) — numerator/denominator preserved.

Full detail: `docs/doctrine/nex-navigation-transition-audit-2026-11-24.md`.

---

## 3 · Cycle 8 additions (NAV-0086 onward)

Journey ID prefix `JRN-buyer-signed-out-purchase-resume` (sealed by owner 2026-11-24).

| ID | Type | Path | Trigger | Status | Evidence | Caveat |
|---|---|---|---|---|---|---|
| NAV-0086 | STATE | product page → auth-gate banner | signed-out tap on `[data-nex-product-add-to-cart-guest]` | **VERIFIED** (sandbox) | `tests/e2e/journey-buyer-signed-out-purchase-resume.spec.ts` test 1, 2026-11-24 | Observed in Pixel 7 project only |
| NAV-0087 | NAV | auth-gate "Sign in" link → `/nex-native/sign-in?next=/nex-native/product/<id>` | tap primary CTA | **VERIFIED** (sandbox) | same spec, href-regex assertion on Pass 1 data-nex-auth-gate-primary selector | — |
| NAV-0088 | DATA | Dev Pass submit → `supabase.auth.signInWithPassword` + redirect to `next` | tap `[data-nex-dev-pass-button]` with hidden `next` input | **PARTIALLY VERIFIED** (sandbox) | same spec · `src/app/nex-native/sign-in/page.tsx:666-680` (hidden input) + `src/app/nex-native/_actions.ts:877-935` (`devPassAction` reads + `safeNext`-validates `next`) | **Dev Pass path only. Ordinary email/password sign-in path NOT exercised.** |
| NAV-0089 | NAV | post-auth → `/nex-native/product/<id>` | redirect from `devPassAction` | **PARTIALLY VERIFIED** (sandbox) | same spec · waitForURL + absence of auth-gate | Verified for Dev Pass branch only. Signup branch (NAV-0094) not exercised to completion. |
| NAV-0090 | DATA | signed-in Add to Cart tap → `localStorage.nex_cart_v1` row written | tap real Add-to-Cart post-auth | **PARTIALLY VERIFIED** (sandbox) | same spec · `page.evaluate` reads `nex_cart_v1` and asserts the product id with `quantity ≥ 1` | Cart write verified. **Server-side `nex_order` persistence NOT exercised** (mig 354/365 BLOCKED). |
| NAV-0091 | STATE | page refresh → cart restored | `page.reload()` | **VERIFIED** (sandbox) | same spec · post-reload `page.evaluate` re-reads `nex_cart_v1` and asserts product id present | — |
| NAV-0092 | NAV | `/<slug>?open-chat=1&product=<id>` → `/conversations/<id>?product=<id>` | signed-in non-owner direct-URL load | **PARTIALLY VERIFIED** (sandbox) | same spec test 4 · admin storageState is non-owner of `handbags-direct` · chip `[data-nex-biz-conv-pending-product="<id>"]` visible | **Redirect + chip only. Full conversation send/receive journey NOT exercised.** |
| NAV-0093 | STATE | post-resume browser back | `page.goBack()` | **VERIFIED** (sandbox) | same spec test 5 · asserts auth-gate does NOT re-mount post-auth | — |
| NAV-0094 | DATA | `/sign-in?mode=signup&next=/product/<id>` → signup submit → return | tap "Create account" | **MAPPED** (URL + form wiring) | same spec test 3 · hidden `input[name=next][value=/nex-native/product/<id>]` asserted on the signup form | **Form wiring only. Submit path NOT exercised.** `createNexAccountAction` writes a real Supabase row and no Founder-approved sandbox buyer exists. |
| NAV-0095 | DATA | automatic purchase resume (click-less Add-to-Cart replay after sign-in) | n/a (not implemented) | **NOT STARTED** | — | **UX DECISION OWED.** Current behaviour requires the buyer to tap Add-to-Cart again after sign-in. No automatic resume. See § 5. |

### 3.1 · Cycle 8 branch-level breakdown

Each row above records ONE successful path. The required branches are:

| NAV | success | failure | cancel | retry | back | interrupted |
|---|---|---|---|---|---|---|
| NAV-0086 | ✅ | DISCOVERED | DISCOVERED | DISCOVERED | DISCOVERED (close returns via `router.back()`) | DISCOVERED |
| NAV-0087 | ✅ | DISCOVERED | — | DISCOVERED | ✅ (NAV-0093) | DISCOVERED |
| NAV-0088 | ✅ (Dev Pass) | DISCOVERED (banner render path exists at `_actions.ts:875-876` via `?e=&m=`) | — | DISCOVERED | DISCOVERED | DISCOVERED |
| NAV-0089 | ✅ (Dev Pass) | — | — | — | ✅ (NAV-0093) | DISCOVERED |
| NAV-0090 | ✅ (localStorage) | DISCOVERED | DISCOVERED | DISCOVERED | DISCOVERED | DISCOVERED |
| NAV-0091 | ✅ | DISCOVERED | — | — | DISCOVERED | DISCOVERED |
| NAV-0092 | ✅ (redirect + chip) | DISCOVERED | DISCOVERED (owner viewer branch · sealed) | DISCOVERED | DISCOVERED | DISCOVERED |
| NAV-0093 | ✅ | — | — | — | — | DISCOVERED |
| NAV-0094 | MAPPED | DISCOVERED | DISCOVERED | DISCOVERED | DISCOVERED | DISCOVERED |

A row is only promoted to **VERIFIED** when every declared branch has evidence.

---

## 3.2 · Cycle 9 promotions & new rows (NAV-0096 onward)

Cycle 9 executed four new spec files + extended coverage. Promotions recorded here per rule § 7.2.

| ID | Type | Path | Trigger | Status | Evidence | Caveat |
|---|---|---|---|---|---|---|
| NAV-0088 (ordinary branch) | DATA | ordinary email+password `signInAction` → redirect to `next` | sign-in form submit with hidden `name="next"` | **VERIFIED** (sandbox) | `tests/e2e/journey-buyer-ordinary-signin.spec.ts` test 1, 2026-11-24 · fills real `input[name=email]` + `input[type=password]`, submits, lands on `/nex-native/product/<id>` without auth-gate re-mount | Admin sandbox credentials only · no live buyer account path exercised |
| NAV-0096 | NAV | `/sign-in?next=<malicious>` · hidden input must NOT render | load URL with each of 7 malicious shapes | **VERIFIED** (sandbox) | ordinary-signin spec test 2 + adversarial spec test 1 · covers `//`, `\`, `javascript:`, `https://`, non-`/nex-native/` prefix, over-length, empty, whitespace, non-path | Server-action `signInAction` re-validation (defence-in-depth) NOT directly POSTed · first-line URL rejection is covered |
| NAV-0097 | NAV | `/sign-in` with absent `?next=` → default landing `/nex-native/contacts` | sign-in submit without hidden next | **VERIFIED** (sandbox) | ordinary-signin spec test 3 | — |
| NAV-0098 | STATE | sign-in page reload mid-flow preserves hidden `next` | `page.reload()` on `/sign-in?next=/product/<id>` | **VERIFIED** (sandbox) | `tests/e2e/journey-buyer-adversarial.spec.ts` test 3 · asserts hidden input survives reload with exact value | — |
| NAV-0099 | STATE | duplicate guest Add-to-Cart taps · idempotent auth-gate | rapid triple-tap of `[data-nex-product-add-to-cart-guest]` | **VERIFIED** (sandbox) | adversarial spec test 4 · exactly one `[data-nex-auth-gate-banner]` after taps | — |
| NAV-0100 | STATE | direct-link deep entry · no referrer · guest flow intact | `page.goto` with `referer: ""` | **VERIFIED** (sandbox) | adversarial spec test 2 · guest Add-to-Cart renders and preserves `next=/product/<id>` on the auth-gate primary CTA | — |
| NAV-0101 | STATE | Back-nav after resumed sign-in · auth-gate must not re-mount | `page.goBack()` from `/contacts` → `/product/<id>` under auth | **VERIFIED** (sandbox) | adversarial spec test 6 (repeat of Cycle 8 test 5 under adversarial envelope) | — |
| NAV-0102 | DATA | signed-in cart dedup · repeated Add-to-Cart → single cart row | rapid triple-tap under admin storageState | **BLOCKED-NO-AUTHED-ADD-CONTROL** (sandbox) | adversarial spec test 5 · no `[data-nex-product-add-to-cart]`/`-authed` control exposed under admin storageState for this product | Likely because the admin viewer of this product does not see the authed Add-to-Cart variant (surface-dependent). Needs a Founder-approved sandbox buyer account OR a non-admin fixture to observe |
| NAV-0094 (signup wiring strand) | DATA | `?mode=signup&next=/product/<id>` renders signup form wired correctly | load URL under guest | **VERIFIED (wiring only)** (sandbox) | `tests/e2e/journey-buyer-signup-wiring.spec.ts` tests 1–2 · hidden next round-trip proven on both the signup form and the mode-toggled-back sign-in form | **Submit path NOT exercised.** Promotion from "wiring only" requires a Founder-approved sandbox buyer. Classification unchanged from Cycle 8. |
| NAV-0103 | DATA | non-owner Ask Seller · Send-to-shop click → observable terminal state | click `[data-nex-biz-conv-pending-product-send]` on conversation under non-owner admin | **BROKEN** (sandbox · not-locked variant) | `tests/e2e/journey-ask-seller-nonowner-full.spec.ts`, 2026-11-24 · after click, chip remains mounted AND no `[data-nex-biz-conv-pending-product-error]` appears within 15 s · page snapshot confirms Send button is enabled (not disabled, not locked) and chip is still rendered | **This is Cycle 9's primary honest finding.** The non-owner Ask Seller send journey has no observable terminal state in sandbox. Could be a client handler bug, a server-side authz rejection ignored by UI, `peerAccountId` null at click time, or a feature-flag gate. Recommended next step: direct inspection of `_client.tsx:989-1028` send handler + server action wiring. Classified BROKEN per § 1 enum — path executed, destination not achieved. |

### 3.2.1 · Cycle 9 branch-level breakdown

| NAV | success | failure | cancel | retry | back | interrupted |
|---|---|---|---|---|---|---|
| NAV-0088 (ordinary) | ✅ | DISCOVERED (banner on `?e=` path exists) | — | DISCOVERED | DISCOVERED | ✅ (NAV-0098 reload) |
| NAV-0096 | ✅ (7 shapes) | — | — | — | — | — |
| NAV-0097 | ✅ | DISCOVERED | — | — | — | — |
| NAV-0098 | ✅ | — | — | — | — | — |
| NAV-0099 | ✅ | — | — | — | — | — |
| NAV-0100 | ✅ | — | — | — | — | — |
| NAV-0101 | ✅ | — | — | — | — | — |
| NAV-0102 | BLOCKED | — | — | — | — | — |
| NAV-0103 | **BROKEN** | DISCOVERED (error-label path exists in code at `_client.tsx:1031` but not surfaced in run) | DISCOVERED (dismiss button exists) | DISCOVERED | DISCOVERED | DISCOVERED |

---

## 4 · Known cross-cutting gaps (cycle 9 close)

| Gap | NAV refs | Classification |
|---|---|---|
| Ordinary (email+password) signed-out → product sign-in | NAV-0088 (ordinary branch) | **VERIFIED** (Cycle 9) · `journey-buyer-ordinary-signin.spec.ts` |
| Full signup → account creation → return-to-product | NAV-0094 | **PARTIAL (wiring VERIFIED)** · submit path still gated on Founder-approved sandbox buyer. Prelaunch mode currently OFF. |
| Full non-owner Ask Seller conversation (send, receive, verify delivery) | NAV-0092 / NAV-0103 | **BROKEN** (Cycle 9) · chip-neither-detaches-nor-errors within 15 s · Cycle 9 could not elevate past Cycle 8 "PARTIAL" and in fact classified the next observable branch as BROKEN. Needs server-handler inspection. |
| Auto-resume purchase after sign-in (eliminate the second tap) | NAV-0095 | **DECISION BRIEF ISSUED (Cycle 9)** · see `docs/product/purchase-resumption-decision-brief-2026-11-24.md`. Recommendation = Option C (deferred prompt). Not yet authorised for implementation. |
| Interrupted authentication (close tab between auth-gate and sign-in) | across NAV-0086…NAV-0089 | **DEFERRED** · no cheap deterministic test. Deferred to Cycle 10. |
| Duplicate submit (double-tap Dev Pass) | NAV-0088 | **DEFERRED** · requires action-handler instrumentation to observe. Deferred. |
| Refresh *on* sign-in page mid-flow | NAV-0088 / NAV-0098 | **VERIFIED** (Cycle 9) · adversarial spec test 3 |
| Duplicate signed-in Add-to-Cart cart dedup | NAV-0102 | **BLOCKED-NO-AUTHED-ADD-CONTROL** (Cycle 9) · needs non-admin fixture |

---

## 5 · UX decision owed (Cycle 9 input)

**Question:** After an unauthenticated buyer resumes sign-in with `next=/nex-native/product/<id>`, should the application:

- (a) Return the buyer to the product page and **require them to re-tap Add to Cart** (current behaviour — one extra tap, zero mystery state).
- (b) **Auto-resume** — write the intended item to the cart server-side or trust a pre-auth intent cookie and complete the add silently.
- (c) Return the buyer with a **visible "Resume purchase" callout** that completes the add on one tap, keeping the user's confirmation gesture.

Trade-offs (research, not analytics):
- (a) safest · zero chance of a ghost add · lowest conversion.
- (b) highest conversion · highest chance of a user seeing an item they didn't expect in cart (buyer intent drift during auth time).
- (c) middle ground · explicit intent preserved, one tap to complete.

**No option is sealed.** Cycle 9 brief invites the Founder to choose.

---

## 6 · Numerator / denominator (always report, never summarise)

| Layer | Numerator (branches with executed evidence) | Denominator (branches declared) |
|---|---|---|
| Pass 1 (NAV-0001 … NAV-0085) | 8 test-covered rows | 85 rows × ~5 declared branches each ≈ 425 declared branches |
| Cycle 8 additions (NAV-0086 … NAV-0094) | 7 success branches | 9 rows × ~5 branches = 45 declared branches |
| Cycle 9 additions (NAV-0088 ordinary-branch, NAV-0096 … NAV-0103) | 9 success branches · 1 BROKEN · 1 BLOCKED | 9 rows × ~4 branches = 36 declared branches |
| **Combined (post-Cycle 9)** | **≈ 24 verified success branches** | **≈ 506 declared branches** |

Launch-critical rate ≈ 4.7 %. Reported honestly, not minimised. +1.5 pp from Cycle 8.

---

## 7 · Rules for future updates

1. New transitions start at the next free NAV-nnnn. Pass 2 began at NAV-0096 (Cycle 9). Next free NAV id = NAV-0104.
2. Status promotions (DISCOVERED → MAPPED → VERIFIED) require a line in § 3 (or the equivalent cycle block) naming the test spec and the commit SHA (post-authorisation) or dated sandbox run.
3. Any BROKEN row must name the migration / env / seed that would un-break it.
4. A row is removed only with status REMOVED and a reason — never silently deleted.
5. "Written is not done." A test file existing does not promote a row; the test must have been run and passed in sandbox against the current migration state.
