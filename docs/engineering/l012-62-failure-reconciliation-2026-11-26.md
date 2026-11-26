# L-012 · 62-Failure Reconciliation

**Produced**: 2026-11-26 continuation cycle · Agent C dispatch.
**Source log**: `tests/e2e/_runs/20261126T-L012-full-regression.log` · 179 passed · 50 skipped · 15 did not run · **62 failed** · EXIT=1 · 27.7 min.
**HEAD**: `9dfa90b4` (unchanged per CLAUDE.md Rule 7).
**Scope**: documentation-only reconciliation. No code change · no commit · no push.

---

## 1 · Summary

### 1.1 · Counts

| Dimension | Count |
|---|---|
| Total `✘` failures in log | **62** |
| Still relevant against current HEAD | **5** |
| Superseded by subsequent ledger work | **57** |
| APPLICATION DEFECT (confirmed) | **0** |
| APPLICATION DEFECT (candidate) | **5** (all L-006 · all BLOCKED-AT-APPROVAL) |
| TEST (stale-against-sealed-retirement) | **1** (L-024) |
| FIXTURE/SETUP (hydration race) | **1** (L-025) |
| ENVIRONMENT (retired-surface-not-removed-from-project) | **55** (L-027 bucket) |
| UNKNOWN | **0** |

### 1.2 · Rule 4 pillar impact (Chat · Shop · Chat Themes)

**Zero.** No failure touches a current launch pillar.

- L-006 (5 failures): mobile-public-surfaces redirect/CTA chain pointing at sealed-retired routes (`/nex-native/create-account`, `/nex-native/chat/first-visit*`). These are stale-against-sealed-retirement, **not** Chat/Shop/Themes defects. Fix lives inside the F2 approval batch.
- L-024 (1 failure): `mobile-authenticated-journey.spec.ts` sanity test against `/nex-native/home` (sealed 307 → `/contacts` since 2026-10-19). Now `describe.skip`'d.
- L-025 (1 failure): PWA install-cadence iphone-emulated, flaky under interleaved regression load. Patched with `networkidle` hardening.
- L-027 bucket (55 failures): Live Commerce surface — **owner-sealed deletion** (commit `2619f8ca`, 2026-11-06). Not a Rule 4 pillar. Playwright project block already removed from `playwright.config.ts` on this HEAD.

### 1.3 · Counts still-relevant-vs-superseded by ledger entry

| Ledger entry | Failures mapped | Current state | Still relevant in next regression? |
|---|---:|---|---|
| **L-006** BLOCKED-AT-APPROVAL | 5 | F2 batch awaiting owner approval phrase | **YES** · will re-fail until F2 approved |
| **L-024** RECLASSIFIED-SKIPPED | 1 | `describe.skip` applied at `mobile-authenticated-journey.spec.ts:77-86` | NO · next run reports SKIPPED |
| **L-025** VERIFIED | 1 | `networkidle` gate added at `pwa-install-cadence.spec.ts:46-71` | NO · post-fix run 5/5 PASS |
| **L-027** VERIFIED | 55 | `mobile-chromium-pixel7-live-public` project block removed from `playwright.config.ts:182-203` | NO · next run will not enumerate these tests at all |

### 1.4 · Expected next-regression delta

If a fresh full regression runs against HEAD `9dfa90b4` with no further changes, the expected tally is:

- Total tests: **234** (down from 306) · L-027 removed the 55-failure project + 17 orphan specs.
- Expected PASSES: approximately **179** (unchanged from L-012 baseline) + **1** (the L-025 fix) = **180**.
- Expected FAILURES: **5** (L-006 F2 batch · unchanged until owner approval).
- Expected SKIPS: **~62** (50 prior + 11 from L-024 describe-skip + miscellaneous).

**Zero unclassified failures.** All 62 `✘` lines trace to pre-existing ledger entries with named classification and disposition.

---

## 2 · Reconciliation table

62 rows · one per `✘` line in the log.

Columns:
- **#** · log row number (1-based position in the `✘` sequence)
- **Log line** · line number in `tests/e2e/_runs/20261126T-L012-full-regression.log`
- **File:test** · spec file + test title (abbreviated)
- **Class** · Rule 8 taxonomy classification
- **Ledger entry** · L-xxx in `docs/engineering/NEX-DELIVERY-LEDGER.md`
- **Still relevant?** · Will this fail in the next regression against HEAD `9dfa90b4`?
- **Next action** · What resolves it

| # | Log line | File:test | Class | Ledger entry | Still relevant? | Next action |
|---:|---:|---|---|---|---|---|
| 1 | 6 | `mobile-public-surfaces.spec.ts:58` welcome page offers both 'Create free account' and 'Sign in' affordances | APPLICATION DEFECT (candidate) | **L-006** BLOCKED-AT-APPROVAL | YES | Owner F2 approval phrase · restore welcome page.tsx with CTAs migrated to `/sign-in?mode=signup` |
| 2 | 9 | `mobile-public-surfaces.spec.ts:103` /chat/first-visit redirects unauth viewer to /welcome | APPLICATION DEFECT (candidate) | **L-006** | YES | Owner F2 approval · route sealed-deleted 2026-11-06 commit `28f79500` · test needs retire-or-rewrite decision |
| 3 | 10 | `mobile-public-surfaces.spec.ts:113` /chat/first-visit/shop redirects unauth viewer to /welcome | APPLICATION DEFECT (candidate) | **L-006** | YES | Same as #2 |
| 4 | 11 | `mobile-public-surfaces.spec.ts:123` /chat/first-visit/personalize redirects unauth viewer to /welcome | APPLICATION DEFECT (candidate) | **L-006** | YES | Same as #2 |
| 5 | 12 | `mobile-public-surfaces.spec.ts:139` welcome primary CTA has a reasonable mobile tap target | APPLICATION DEFECT (candidate) | **L-006** | YES | Same as #1 |
| 6 | 13 | `mobile-authenticated-journey.spec.ts:45` sanity · signed-in home is reachable | TEST (stale-against-sealed-retirement) | **L-024** RECLASSIFIED-SKIPPED | NO | `describe.skip(true, …)` applied at lines 77-86 · next run reports SKIPPED not FAILED |
| 7 | 80 | `pwa-install-cadence.spec.ts:47` /nex-native · install prompt banner MUST NOT render (iphone-emulated) | FIXTURE/SETUP (hydration race) | **L-025** VERIFIED | NO | `networkidle` gate added at lines 46-71 · isolation re-run 5/5 PASS |
| 8 | 92 | `_capture-comments-behind.spec.ts:4` panel paints above comments overlay | ENVIRONMENT (retired surface) | **L-027** VERIFIED | NO | Playwright project `mobile-chromium-pixel7-live-public` removed · test will not enumerate |
| 9 | 93 | `_capture-counts.spec.ts:4` counts on Like / Share / Save | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 10 | 94 | `_capture-dev-roles.spec.ts:7` dev role URLs | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 11 | 95 | `_capture-feed-prefs.spec.ts:4` Live Feed Preferences in 3-dot panel | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 12 | 96 | `_capture-heart-right.spec.ts:4` Like heart back on composer right | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 13 | 99 | `_capture-overlay-pref.spec.ts:4` Promotional overlays tri-state | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 14 | 100 | `_capture-products-flow.spec.ts:4` products flow walk | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 15 | 133 | `composer-overflow-regression.spec.ts:32` live-viewer-dev-video-3 · 320px | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 16 | 134 | `composer-overflow-regression.spec.ts:32` live-viewer-dev-video-3 · 360px | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 17 | 135 | `composer-overflow-regression.spec.ts:32` live-viewer-dev-video-3 · 375px | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 18 | 136 | `composer-overflow-regression.spec.ts:32` live-viewer-dev-video-3 · 390px | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 19 | 137 | `composer-overflow-regression.spec.ts:32` live-viewer-dev-video-3 · 412px | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 20 | 138 | `composer-overflow-regression.spec.ts:32` live-viewer-dev-video-1 · 320px | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 21 | 139 | `composer-overflow-regression.spec.ts:32` live-viewer-dev-video-1 · 360px | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 22 | 140 | `composer-overflow-regression.spec.ts:32` live-viewer-dev-video-1 · 375px | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 23 | 141 | `composer-overflow-regression.spec.ts:32` live-viewer-dev-video-1 · 390px | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 24 | 142 | `composer-overflow-regression.spec.ts:32` live-viewer-dev-video-1 · 412px | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 25 | 179 | `create-page-visual.spec.ts:22` /create at desktop viewport 1440x900 | ENVIRONMENT (retired surface) | **L-027** | NO | `/nex-native/create` has no `page.tsx` per L-027 analysis · spec enumerated under the removed project |
| 26 | 184 | `live-commerce-public-surfaces.spec.ts:73` directory landing · no live sessions · renders without live chips | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 27 | 185 | `live-commerce-video-journey.spec.ts:44` drawer landing redirects to the first video | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 28 | 186 | `live-commerce-video-journey.spec.ts:51` video element has src + is playing | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 29 | 187 | `live-commerce-video-journey.spec.ts:76` video fits full-bleed mobile viewport | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 30 | 188 | `live-commerce-video-journey.spec.ts:118` sound · unmuted autoplay / muted fallback | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 31 | 189 | `live-commerce-video-journey.spec.ts:155` header · Live {Country} title | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 32 | 190 | `live-commerce-video-journey.spec.ts:190` magnifying glass opens 12-tile grid | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 33 | 191 | `live-commerce-video-journey.spec.ts:207` category chain · Travel tile routes to temple | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 34 | 192 | `live-commerce-video-journey.spec.ts:233` category chain · swipe up advances temple → volcano | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 35 | 193 | `live-commerce-video-journey.spec.ts:286` 3-dot drawer trigger · ControlDrawer mounted | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 36 | 194 | `live-commerce-video-journey.spec.ts:304` Like button · toggles aria-pressed | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 37 | 195 | `live-commerce-video-journey.spec.ts:315` Big CTA · uploaded video with no business → View Market | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 38 | 196 | `live-commerce-video-journey.spec.ts:336` Go Live · anchor renders in footer | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 39 | 197 | `live-commerce-video-journey.spec.ts:351` footer actions · all 4 buttons visible | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 40 | 198 | `live-commerce-video-journey.spec.ts:375` Share · fallback popover opens | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 41 | 199 | `live-commerce-video-journey.spec.ts:400` Share · bottom sheet · NEX contact mode | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 42 | 200 | `live-commerce-video-journey.spec.ts:414` Posted date · 'Posted {localized date}' | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 43 | 201 | `live-commerce-video-journey.spec.ts:428` Send button · gated by non-empty composer | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 44 | 202 | `live-commerce-video-journey.spec.ts:458` swipe up (pointer drag) navigates to next video | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 45 | 203 | `live-commerce-video-journey.spec.ts:504` mouse drag up (desktop) navigates to next video | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 46 | 204 | `live-commerce-video-journey.spec.ts:529` mouse wheel down · navigates to next · cooldown | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 47 | 205 | `live-commerce-video-journey.spec.ts:546` keyboard ArrowDown mirrors swipe up | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 48 | 206 | `live-commerce-video-journey.spec.ts:590` full viewer screenshot · owner-reviewable artifact | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 49 | 207 | `live-commerce-video-journey.spec.ts:607` does NOT require a separate streaming app · browser-only | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 50 | 209 | `live-commerce-viewer-footer.spec.ts:32` guest viewer redirects to sign-in | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 51 | 211 | `live-commerce-visual-verify.spec.ts:23` feed renders at mobile · guest · no Go Live CTA | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 52 | 212 | `live-commerce-visual-verify.spec.ts:46` viewer page redirects guests to sign-in · artifact | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 53 | 213 | `live-commerce-visual-verify.spec.ts:62` feed empty-state honestly labelled | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 54 | 214 | `live-commerce-visual-verify.spec.ts:77` Shop Contacts page redirects guests to sign-in | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 55 | 217 | `live-footer-3-dots-container.spec.ts:21` Live viewer · 3-dot panel adopts Category-tile palette | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 56 | 218 | `live-footer-products-flow.spec.ts:22` Live viewer · broadcaster · 3-dot panel + products flow | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 57 | 219 | `live-footer-products-flow.spec.ts:140` Live viewer · non-broadcaster · no Products pill | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 58 | 220 | `live-header-ping-and-ai-chip.spec.ts:17` Live viewer header · white ping lines · red tower · AI chip | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 59 | 221 | `live-library-tiles.spec.ts:44` Live Library · 3-tile control panel · Go Live + Create + Studio | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 60 | 222 | `live-library-tiles.spec.ts:74` Live Library · Create tile routes to /nex-native/create | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 61 | 223 | `live-library-tiles.spec.ts:121` Live Library · Studio tile routes to /live-commerce/studio | ENVIRONMENT | **L-027** | NO | Same as #8 |
| 62 | 224 | `live-library-tiles.spec.ts:148` Live Library · Go Live tile routes to /live-commerce/welcome | ENVIRONMENT | **L-027** | NO | Same as #8 |

---

## 3 · Classifications per Rule 8

### 3.1 · APPLICATION DEFECT (candidate) · 5 failures (rows #1–#5)

All five are L-006 failures on `mobile-public-surfaces.spec.ts`. They are "candidate" not "confirmed" defects because:

- The tests themselves are stale against sealed-retirement decisions (`/create-account` route deleted · `welcome/page.tsx` deleted 2026-11-06 commit `d8f16c32` · `/chat/first-visit*` deleted 2026-11-06 commit `28f79500`).
- Whether the FIX is "restore welcome page + migrate test locator" (Option A in `l006-f2-approval-request-2026-11-26.md`) or "retire the tests" (Option B / Option HOLD) is an **owner product decision**, not a pure engineering defect.
- Until the owner selects an option from the formal approval request, these cannot be downgraded from "candidate" to "confirmed" with confidence.

Per Rule 7: the fix crosses an explicit approval boundary (restoring a sealed-retired page + migrating a sealed-retired route reference). Cannot be resolved in-session.

### 3.2 · TEST (stale-against-sealed-retirement) · 1 failure (row #6)

L-024 · `mobile-authenticated-journey.spec.ts` sanity test asserted `/nex-native/home` reachability; that route has been `permanentRedirect("/nex-native/contacts")` since 2026-10-19 (`src/app/nex-native/home/page.tsx:31-33`) with the welcome/first-visit scaffolding deleted 2026-11-06.

Honest classification per Rule 8: `SKIPPED` with the retirement commits cited — not `FAILED` (not a product defect) and not `DELETED` (inside the F2 batch awaiting owner word via L-006).

Already resolved: `tests/e2e/mobile-authenticated-journey.spec.ts:77-86` carries `test.describe.serial(...).skip(true, "STALE-AGAINST-SEALED-RETIREMENT · …")`. Next regression reports 11 SKIPPED rather than 10 FAILED + 1 passed.

### 3.3 · FIXTURE/SETUP (hydration race) · 1 failure (row #7)

L-025 · `pwa-install-cadence.spec.ts:47` iphone-emulated. The iOS `_install-home-slider-client` has not resolved its eligibility check before the `toBeHidden(…)` snapshot fires under interleaved-regression CPU load.

Already resolved by applying the sealed L-007 hydration-race hardening pattern: `networkidle` gate added at `pwa-install-cadence.spec.ts:46-71`. Isolation re-run confirmed 5/5 PASS. No product-code weakening — the enforcement WINDOW widens so any late banner would now be caught, not missed.

### 3.4 · ENVIRONMENT (retired-surface-not-removed-from-project) · 55 failures (rows #8–#62)

All 55 failures are in the `mobile-chromium-pixel7-live-public` Playwright project enumerating specs that target the Live Commerce surface. Commit `2619f8ca` (2026-11-06 · "Phase 1c Batch 4 · Delete Live Commerce surface · 89 files") deleted this surface per owner-sealed scope reduction.

Evidence of retirement: `/nex-native/live-commerce/feed` → 404 · `/nex-native/videos/dev-video-*` → 404 · live-commerce components in `src/components/nex-native/live-commerce/` are orphaned (no `src/app/*` route imports).

Already resolved on HEAD `9dfa90b4`: the `mobile-chromium-pixel7-live-public` project block has been removed from `playwright.config.ts:182-203` (verified by `grep -n mobile-chromium-pixel7-live-public playwright.config.ts` → 2 hits, both inside the L-027 rationale comment, zero in a `projects[]` entry). Next regression will not enumerate these 17 spec files at all under this project.

Note: the spec files themselves (`_capture-*.spec.ts`, `live-commerce-*.spec.ts`, `live-footer-*.spec.ts`, `live-header-*.spec.ts`, `live-library-*.spec.ts`, `composer-overflow-regression.spec.ts`, `create-page-visual.spec.ts`) remain on disk — their deletion is a separate owner-approved commit per L-027 disposition.

---

## 4 · Why zero APPLICATION DEFECT (confirmed) in this set

A failure gets "confirmed" classification only when:

1. The target surface is current (not sealed-retired).
2. The expected behaviour is established by owner seal or documented product requirement.
3. The observed behaviour deviates from the expected behaviour in a way that cannot be explained by test infrastructure.

For the 62 failures in L-012:

- **55 (rows #8–#62)**: target a sealed-DELETED surface. Fails condition 1 → ENVIRONMENT.
- **5 (rows #1–#5)**: target a sealed-RETIRED route the test author assumed still existed. Fails condition 1 in a different way (test assumption broken, not product defect). → APPLICATION DEFECT (candidate) because owner decision determines whether to re-instate the route or retire the test.
- **1 (row #6)**: same class as the 5 above but slightly more decidable because mig/restore options are documented → TEST (stale-against-sealed-retirement), SKIP applied.
- **1 (row #7)**: timing-dependent flake under load, fails condition 3 (test-infra timing explains the deviation) → FIXTURE/SETUP.

Zero failures in this set are defects in Chat, Shop, or Chat Themes surfaces as they exist on HEAD `9dfa90b4`.

---

## 5 · Audit trail

- Log read: `tests/e2e/_runs/20261126T-L012-full-regression.log` · 62 `✘` lines extracted via `grep -n "✘" …` returning 62 matches.
- Ledger read: `docs/engineering/NEX-DELIVERY-LEDGER.md` rows for L-006, L-007, L-024, L-025, L-027.
- L-027 remediation verified: `grep -n "mobile-chromium-pixel7-live-public" playwright.config.ts` → 2 matches, both in the rationale comment at `playwright.config.ts:182-185`.
- L-024 remediation verified: `grep -n "STALE-AGAINST-SEALED-RETIREMENT" tests/e2e/mobile-authenticated-journey.spec.ts` → match at line 80.
- L-025 remediation verified: `grep -n "L-025" tests/e2e/pwa-install-cadence.spec.ts` → match at line 53 (hardening comment) + `networkidle` call at line 68.
- L-006 open status verified: no change to `src/app/nex-native/welcome/page.tsx` since deletion commit `d8f16c32` (2026-11-06); formal approval request at `docs/engineering/l006-f2-approval-request-2026-11-26.md` remains unanswered.

---

## 6 · Scope boundaries honoured

- No code changed.
- No ledger entry modified.
- No migration applied.
- No commit. No push.
- HEAD remains `9dfa90b4`.
- Sandbox-only reconciliation.
- CLAUDE.md Rule 7 preserved in full.
