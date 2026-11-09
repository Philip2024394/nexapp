# NEX Phase 4 · Performance · Mobile · Load Baseline Plan
### 2026-11-09

**Author:** Claude Opus 4.7 · operating under owner's "continue until all are fully built working" directive · interpreted as documentation-only research deliverable for Phase 4.
**Scope:** published performance targets, measurement methodology, instrumentation plan, viewport sweep scope, load scenarios, regression gate.
**Status:** Research/plan deliverable (documentation-only). **No instrumentation added · no measurements taken · no load tests run.** Phase 4 implementation requires:
- Phase 2 (device-only chat) verified
- Phase 3 (customer journeys) verified
- Owner authorisation to begin Phase 4 implementation

**Related doctrines:**
- `docs/doctrine/nex-chat-device-only-remediation-plan-2026-11-09.md` (Rev 2)
- `docs/doctrine/phase-3-customer-journey-matrix-2026-11-09.md`

---

## 0 · Phase lifecycle position

```
A. RESEARCH / PLAN · YOU ARE HERE
   ↓
B. OWNER AUTHORISES IMPLEMENTATION ("begin Phase 4 implementation")
   ↓  requires: Phase 2 + Phase 3 verified
C. BUILD (instrumentation · fixture · k6 scripts · Lighthouse CI · viewport sweep)
   ↓
D. VERIFY (baseline measured · targets published · regression gate wired into CI)
   ↓
E. INDEPENDENT SIGN-OFF (owner reviews performance report)
   ↓
F. PHASE COMPLETE · regression gate protects launch state
```

Phase 4 depends on Phases 2 + 3 verified because:
- Measuring performance of a pre-Interp-1 architecture gives you numbers for an architecture that is being retired.
- Load tests on current chat storage would exercise code paths that are going away.
- Playwright journeys from Phase 3 provide the realistic traffic shapes Phase 4 measures against.

---

## 1 · Published performance targets

### 1.1 Web vitals (field targets · match Google's "Good" bucket)

| Metric | Target (Good) | Measured in | Why this target |
|---|---:|---|---|
| **LCP** · Largest Contentful Paint | < 2.5s | Lab + field | Standard web-vitals good threshold |
| **INP** · Interaction to Next Paint | < 200ms | Lab + field | Replaces FID in 2024 web vitals · 200ms = "Good" |
| **CLS** · Cumulative Layout Shift | < 0.1 | Lab + field | Standard |
| **FCP** · First Contentful Paint | < 1.8s | Lab | Standard |
| **TBT** · Total Blocking Time | < 200ms | Lab | Standard Lighthouse |
| **TTFB** · Time to First Byte | < 800ms | Lab | Standard |

### 1.2 Lighthouse category scores (lab)

| Category | Mobile target | Desktop target |
|---|---:|---:|
| Performance | ≥ 85 | ≥ 95 |
| Accessibility | ≥ 95 | ≥ 95 |
| Best Practices | ≥ 95 | ≥ 95 |
| SEO | ≥ 90 | ≥ 90 |

### 1.3 NEX-specific targets

| Capability | Target | Notes |
|---|---|---|
| Peer-chat WebRTC handshake | < 2s p75 from `send tap` to `delivered` state, direct connect | Sub-condition of Phase 2 verified · uses TURN only on NAT-blocked fixture |
| TURN-relay handshake | < 4s p75 (fallback path) | Blocked on D-5 TURN provider |
| Attachment transfer (1 MB image) | < 4s p75 over typical mobile connection | WebRTC data channel chunking |
| Shop page SSR | < 300ms server-side render | Public page · critical for SEO |
| Directory listing | < 500ms p50 for first 20 rows | Search-driven discovery |
| Signin flow | < 1.5s p50 to reach `/free-chat` after submit | Includes WebAuthn where applicable |
| Order list page | < 400ms p50 | Buyer or seller order list |
| Side-menu open | < 100ms animation start | UX responsiveness |

### 1.4 Data + battery targets (mobile-specific)

| Metric | Target | Why |
|---|---:|---|
| Idle WebRTC presence data usage | < 500 KB/hour at rest | Battery-respectful always-connected posture |
| Idle battery drain | < 2% / hour (modern Android/iOS) | Usable as an always-open app |
| Cold startup data | < 500 KB total for first paint | First-visit conversion-friendly |
| Attachment download max | 25 MB (sealed cap) | Same as upload cap |

---

## 2 · Measurement methodology

### 2.1 Lab · Lighthouse CI

- Run Lighthouse against sandbox dev server (http://localhost:3008)
- 3 runs per page · median reported · reduces variance
- Chromium headless · Moto G4 throttling for mobile · no throttling for desktop
- Trigger: nightly on `main` + PR gate on perf-critical paths
- Artefact: HTML + JSON reports · 30-day retention

### 2.2 Field · web-vitals library

- Inject `web-vitals` library in production
- Forward metrics to NEX analytics (`nex_web_vital_event` table · to be created)
- Dashboard: p50 / p75 / p95 per metric per route per country per device-type
- Alert if any metric's p75 crosses "Needs Improvement" threshold for 24h

### 2.3 Viewport sweep · visual regression

- 115 routes (per inventory) × 2 viewports (390×844 mobile · 1440×900 desktop)
- Playwright + pixel-diff tool (e.g. `playwright-pixel-diff` or `pixelmatch`)
- Baseline captured once post-Phase-2 ship
- Diff threshold: 0.5% pixel-change tolerance · investigate any route exceeding
- Nightly run against main
- Artefact: baseline + diff PNGs

### 2.4 Load · k6 scenarios

See §4 for scenario-by-scenario detail. Load runs on a staging environment mirroring production (NOT production itself per constitution).

### 2.5 Battery + data usage

- Manual measurement with Android Developer Options (battery stats · data usage) + iOS equivalent
- 4-hour soak test · idle app with 1 peer-chat open · active WebRTC presence
- Capture measurement report · compare against targets
- No automated battery tooling (vendor platforms don't expose stable programmatic APIs)

---

## 3 · Viewport sweep scope · 115 routes

Per the 2026-11-09 inventory, 115 user-facing routes live under `/nex-native/*`. The sweep covers every route in authenticated + unauthenticated context where applicable.

### 3.1 Route categories

| Category | Count (approx) | Sweep scope |
|---|---:|---|
| Marketing / public (home, directory, {businessSlug}, pricing, about) | ~15 | Both viewports · anonymous + signed-in |
| Auth (create-account, sign-in, settings/security/*) | ~12 | Both viewports · anonymous only |
| Chat surfaces (free-chat, chat/peer/[accountId], chat/guest/[ownerAccountId]) | ~10 | Both viewports · signed-in · Phase 2 architecture active |
| Shop setup (/manage/shop/*, /manage/products/*, /manage/menu/*) | ~20 | Both viewports · signed-in business owner |
| Orders surface (/orders/*, /manage/orders/*) | ~8 | Both viewports · signed-in buyer + seller |
| Vault (/vault/*) | ~10 | Both viewports · signed-in with vault |
| Settings (/settings/*) | ~15 | Both viewports · signed-in |
| Chat themes library + preview | ~5 | Both viewports · signed-in |
| Community notice board | ~5 | Both viewports · signed-in |
| HQ admin (desktop only ≥900px) | ~10 | Desktop only · HQ-authenticated |
| Misc (/about, /help, /legal/*) | ~5 | Both viewports · anonymous |

### 3.2 Phone-frame rule compliance

Per sealed memory: every `/nex-native/*` route renders inside `.nex-native-stage > .nex-native-frame` (360×780 centered on desktop ≥500px, full-bleed <500px). The sweep **verifies this rule** by:
- Checking frame container exists on every route
- Checking background backdrop renders at desktop sizes (per `--nex-world-desktop-backdrop` sealed CSS var)
- Flagging any route that nukes `html, body { background }` (sealed CSS-override rule)

HQ routes are the explicit exception · desktop-only ≥900px · no phone frame.

### 3.3 Country-aware content

Sweep runs 3× per route for country-aware surfaces:
- Ireland identity (default EUR + Ireland backdrop)
- Indonesia identity (IDR + Indonesia backdrop)
- Worldwide identity (fallback)

Flag any route that leaks country-specific content incorrectly.

---

## 4 · Load scenarios (k6)

### 4.1 Scenarios

| # | Name | Shape | Pass criteria |
|---|---|---|---|
| L-1 | Steady-state baseline | 100 concurrent users · mixed read/write · 15 min | p95 latency < 500ms · error rate < 0.1% |
| L-2 | Spike · 10x | 100 → 1,000 users in 60s · hold 5 min · ramp down | p95 < 2s during spike · recovery to baseline within 2 min · error rate < 2% during spike |
| L-3 | Sustained · 500 users | 500 users · 30 min | p95 < 800ms sustained · error rate < 0.5% · no memory leak |
| L-4 | WebRTC presence scale | 1,000 WebRTC connections idle · 30 min | Signaling throughput sustained · TURN capacity OK (D-5 dependent) · presence heartbeat latency < 10s |
| L-5 | Checkout burst | 50 concurrent checkouts · 2 min | All succeed · Stripe rate-limit not hit · no race condition on `nex_billing_checkout_session` |
| L-6 | Rate-limit saturation | Hit `/password/change` 100× in 60s from one account | Rate-limiter kicks in · 429 responses · no DB crash (Phase 1 G3 depends) |

### 4.2 Dataset size for load scenarios

- 1,000 accounts
- 500 businesses
- 10,000 products
- 500 live WebRTC sessions

### 4.3 Target environment

**Staging** (dedicated · separate Supabase project · separate Vercel project). NOT production. NOT sandbox (small per inventory). A new `kstagingXYZ` project is the natural target · separate owner authorisation to provision.

---

## 5 · Mobile deep dive

### 5.1 Device matrix

| Platform | Device class | Test strategy |
|---|---|---|
| iOS 16+ | iPhone 13 / 14 (mid-tier) | BrowserStack or physical device |
| Android 11+ | Pixel 5a / Samsung A52 (mid-tier) | BrowserStack or physical device |
| Low-end mobile | Moto G4 Lighthouse profile | Lab lighthouse |

### 5.2 Mobile-specific checks

- Touch-target size (sealed Chat 9001 pill ≥ 44px tap target per sealed memory)
- iOS WebRTC + WebAuthn behaviour
- Android WebRTC background limits (battery saver mode)
- iOS 16 Face ID + WebAuthn integration flow
- Android Chrome autofill behaviour on signup form
- Network transition (WiFi → cellular → offline) · WebRTC reconnection

### 5.3 Dark mode + OS-level theme

- NEX has its own theming (sealed) · must not be overridden by OS prefers-color-scheme
- Verify consistency

---

## 6 · Accessibility audit (a11y)

### 6.1 Scope

Every launch-surface route (per §3) runs through:
- `axe-core` automated audit
- Lighthouse Accessibility category
- Manual keyboard navigation (every interactive element)
- Screen-reader walk-through (NVDA on Windows · VoiceOver on Mac for sealed Ireland default + Indonesia expansion)

### 6.2 Minimum compliance

- WCAG 2.1 Level AA
- Section 508 (US · federal clients future-proofing)

### 6.3 Known gaps (from Phase 1 Baseline)

| Area | Status | Phase 4 addresses |
|---|---|---|
| Loading state announcements | Partial (some `role=status`) | Full audit · consistent pattern |
| Focus management on route change | Not consistently preserved | Add focus-trap + skip-link where missing |
| Form error announcements | Partial | Consistent `aria-live=assertive` for submit errors |
| Colour contrast | Mostly passing | Audit theme colours (sealed palette) in dark backdrops |
| Keyboard access to chat composer | Not fully verified | Full keyboard walkthrough |
| Image alt text | Partial | Audit every image surface |

---

## 7 · Regression gate (CI integration)

### 7.1 PR gate

- Run Lighthouse CI on 5 critical routes (home · directory · shop setup step 1 · peer chat · orders list)
- Compare against baseline · fail if any critical metric regresses > 10%
- Soft-fail on non-critical routes

### 7.2 Nightly gate

- Full 115-route viewport sweep
- Full accessibility audit
- Steady-state L-1 load scenario against staging
- Any regression → Slack or email alert to owner

### 7.3 Pre-launch gate (manual)

- Full load matrix (L-1 through L-6)
- Full accessibility audit
- Mobile device matrix (iOS + Android)
- Battery soak test
- Independent review of performance report (Phase 5 integration)

---

## 8 · Instrumentation to build

### 8.1 Code changes needed

| Component | Location |
|---|---|
| `web-vitals` injection | Client bootstrap · reports to `/api/analytics/web-vitals` |
| `/api/analytics/web-vitals` endpoint | New · receives + persists aggregate metrics |
| `nex_web_vital_event` table | New migration · aggregate-only · no user identifiers |
| Lighthouse CI config | `.lighthouserc.js` · new file |
| Playwright viewport sweep | `tests/visual/sweep.spec.ts` · new |
| k6 scenarios | `tests/load/*.js` · new |
| Dashboard | HQ dashboard or Grafana against web-vitals table |

### 8.2 Data respect

- Web-vitals events never include personal identifiers
- Route templates logged, not full URLs (e.g. `/nex-native/[businessSlug]` not the specific slug)
- Aggregated by country + device-type only, never by account
- Per I-6 · performance data is operational metadata, not private content

---

## 9 · What this document does + does NOT do

### Does
- Publish concrete performance targets
- Define measurement methodology
- Scope the 115-route viewport sweep
- Define load scenarios
- Define mobile + a11y matrices
- Define the regression gate

### Does NOT
- Author any instrumentation code
- Run any load test
- Create any fixture
- Provision staging environment
- Authorise Phase 4 implementation (requires Phase 2 + 3 verified)
- Claim any performance measurement is current (no measurement has been taken)

---

**End of Phase 4 research deliverable.**
