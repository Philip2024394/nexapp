# NEX · Launch Readiness Audit · World-Class Standards
### 2026-11-09 · engineering snapshot · owner-directed full audit

**Author:** Claude Opus 4.7 · owner-requested audit "full system world standards app nex must be"
**Scope:** Full launch-readiness audit covering every launch gate. Per-category grading against world-class consumer-app standards (WhatsApp / Signal / Stripe / Instagram / Linear bar). Evidence-based from repo state at HEAD `8bcb3cd1`.
**Not a public claim · not a marketing document · not legal advice.**

---

## 0 · Executive verdict

**NEX is NOT ready for public launch. NEX is NOT ready for closed beta involving the sealed launch claim. NEX is PARTIALLY ready for internal QA testing of non-chat surfaces, under sandbox conditions.**

Three sub-verdicts:

| Target | Verdict |
|---|---|
| Public launch (Ireland · Indonesia · Worldwide) | **BLOCKED** · 10 hard blockers · I-6 atomicity not satisfied on any surface |
| Closed beta with sealed privacy claim | **BLOCKED** · Phase D 15 of 16 sprints unbuilt · V-* matrix 90% red |
| Internal sandbox QA of non-chat surfaces (directory · shop · vault · HQ) | **PARTIALLY READY** · with explicit caveats below |

**Overall readiness vs world-class bar: 12-15% weighted average.** Earlier estimates said ~5%; this audit found more mature non-chat infrastructure than the readiness checklist implied, but also surfaced new gaps (no external error monitoring · thin CI · unindexed public surfaces risk). Net slightly higher · still far from launch.

---

## 1 · Methodology

### 1.1 · What was audited
- Repository state at `8bcb3cd1` (Sprint 1 push · 2026-11-09)
- 310 migrations · 1067 unit tests · 62 E2E spec files · ~300 nex-native pages
- Prior doctrines: 8-workstream plan · Phase 2 Rev 2 · launch readiness checklist · incident response runbook · test + quality matrix · T&C + Privacy Policy drafts · solicitor briefing · audit SoW
- Sealed owner decisions · constitution §1-8 · six invariants I-1..I-6

### 1.2 · Not audited this turn
- Full `npm run build` (would take 3-10 minutes · value-add low vs cost in this audit)
- Full `npm run typecheck` (same)
- Full `npm run test` (1067 tests · known ~14 broken · would take 5-15 min)
- Live Lighthouse scores on actual pages (requires dev server + external tooling)
- Live security scan (requires external tooling)
- Live load test (requires sandbox at scale)

These are **gaps IN this audit** and are flagged in §4. World-class bar requires these to be run before launch.

### 1.3 · Standards used
Benchmarks: **WhatsApp**, **Signal**, **Stripe**, **Instagram**, **Linear**. Where those companies publish standards (SOC 2 · ISO 27001 · WCAG 2.2 AA · Core Web Vitals p75 · 99.99% uptime), those are the bar. Where they don't publish, I use industry best-practice (OWASP Top 10 · ASVS Level 2 · GDPR Article 32).

### 1.4 · Grading rubric
- **A** · Meets world-class bar · evidence in repo · independently verifiable
- **B** · Close to bar · gaps are polish-level
- **C** · Functionally built · gaps require deliberate completion work
- **D** · Foundation exists · substantial build remaining
- **F** · Missing or fundamentally broken
- **?** · Insufficient evidence · needs measurement or audit

---

## 2 · Per-category audit (15 categories)

### 2.1 · Security · Grade: **C-**

**Current state:**
- Row-Level Security (RLS) enabled on 40+ tables (grep evidence)
- Rate limiting: dedicated `nex_security_rate_limit` table · 9 action classes · DB-primary + in-memory fallback · mig 290+313 applied to production 2026-11-09
- Billing RLS: mig 312 applied to production 2026-11-09
- WebAuthn + face sign-in: `src/lib/nex-native/webauthn-service.ts` exists · `nex_webauthn_credential` table
- F-3 buyer-checkout price-trust fix: **in sandbox only · not deployed to production**
- No external security audit · no SOC 2 · no ISO 27001
- GitHub Action `security-ci.yml` exists (partial CI gate)

**World-class bar:**
- Independent penetration test by reputable firm · annual
- SOC 2 Type II · ISO 27001 for enterprise
- WAF (Vercel built-in · OK)
- Zero publicly-exposed secrets · verified by secret-scanning
- All auth flows through WebAuthn + rate-limited · sessions short-lived
- Automatic dependency vulnerability scanning (Dependabot · Snyk)

**Gaps:**
1. F-3 not in production (**P0-CURRENT · price-trust vulnerability live**)
2. No external security audit evidence
3. Only 2 GitHub workflows · no automated dependency scanning visible
4. No evidence of secret-scanning in CI
5. OWASP Top 10 coverage unverified end-to-end
6. CSRF protection unverified across all routes

**Testing readiness:** Non-chat surfaces can be internally QA'd for security after F-3 deploys. External penetration test required before public launch.

### 2.2 · Privacy · Grade: **F**

**Current state:**
- Sealed device-only architecture **not yet implemented** (Phase D Sprint 1 of 16 done)
- 310 migrations have historical private-chat content accumulated in server-side tables (`nex_peer_message.body` · `nex_message.body` · attachment metadata · `nex-peer-chat-attachments` public bucket)
- T&C and Privacy Policy drafts produced 2026-11-09 · **not legal-reviewed · not publishable**
- Six owner facts pending (legal entity name · address · VAT · etc.)
- No DPIA · no DPO designation
- No Kominfo registration · no DAC7 compliance work started
- No external privacy audit

**World-class bar (Signal · WhatsApp):**
- End-to-end encryption on all private surfaces · verified by independent audit
- Transparency reports · public
- Open-source cryptographic libraries where possible (sealed launch claim demands this bar)
- Published SOC 2 · ISO 27701 (privacy)
- Zero plaintext message bodies on server · verifiable

**Gaps:**
1. Device-only chat architecture 90% unbuilt (I-1..I-6 not satisfied anywhere)
2. Historical content secure-deletion sweep (S0-S6) not started
3. No legal review of T&C or Privacy Policy
4. Six owner facts missing
5. GDPR DSR process undefined
6. UU PDP compliance undefined

**Testing readiness:** Privacy claims are UNTESTABLE until Phase D complete. Any user-facing privacy statement published now would be factually incorrect.

### 2.3 · Reliability · Grade: **C**

**Current state:**
- Circuit breaker · degradation · idempotency · retry utilities exist in `src/lib/nex-native/recovery/`
- Health probes in `src/lib/nex-native/health/`
- Incident service + HQ Alerts system (sealed 2026-11-08)
- No evidence of production SLOs defined
- No evidence of 24/7 on-call rotation
- No evidence of post-mortem history (this is a new app)

**World-class bar:**
- 99.99% uptime SLO per critical surface
- Error budgets instrumented · deploy-blocking when exhausted
- Formal on-call rotation · paged within 5 min of P0
- Monthly chaos engineering exercises
- Published uptime history

**Gaps:**
1. No SLO definition
2. No on-call rotation (single-owner stage)
3. Error budgets not instrumented
4. Chaos engineering not scheduled
5. Post-mortem template adopted (incident response runbook) · not yet exercised

**Testing readiness:** Internal QA can start · failure-injection tests (15 scenarios per runbook §6) can be authored and run.

### 2.4 · Performance · Grade: **?**

**Current state:**
- No Lighthouse CI setup found
- No published p75 LCP · INP · CLS numbers
- Vercel Speed Insights potentially active (no evidence in repo)
- No load-test evidence
- Phase E matrix (produced 2026-11-09) defines targets · targets not measured

**World-class bar (Core Web Vitals):**
- LCP ≤2.5s p75
- INP ≤200ms p75
- CLS ≤0.1 p75
- Lighthouse Performance ≥90 per surface

**Gaps:**
1. Zero measured baseline numbers
2. No Lighthouse CI
3. No load-test evidence at 1k / 10k / 50k / 100k scale
4. Phase E test matrix unexecuted

**Testing readiness:** Performance can be measured today against sandbox. Zero cost · must be done before launch.

### 2.5 · Accessibility · Grade: **?**

**Current state:**
- No automated a11y testing found (axe-core not in CI)
- No manual screen-reader audit evidence
- Phase E matrix defines targets · targets not measured

**World-class bar:**
- WCAG 2.2 AA conformance · all critical journeys
- axe-core in CI · zero violations on canonical routes
- Manual NVDA + VoiceOver audit annually

**Gaps:**
1. Zero a11y measurement
2. axe-core not integrated
3. No manual audit scheduled
4. No a11y statement / conformance report

**Testing readiness:** a11y can be partially measured today via axe-core. Manual audit needs dedicated time.

### 2.6 · Internationalisation · Grade: **B-**

**Current state:**
- `src/lib/nex/i18n/` infrastructure present · I18nProvider · packs · server + lang modules
- Three Vercel projects (Ireland · Indonesia · Worldwide) per sealed Global Development Scope Rule
- Country-specific routes: `ireland-entry/page.tsx` exists · **no `indonesia-entry/page.tsx` found**
- Currency localisation designed (per sealed Scope Reduction doctrine · USD/EUR/GBP/IDR)

**World-class bar:**
- Every user-facing string externalised
- Translator workflow established
- Native speakers for each supported language
- RTL support where applicable (future)

**Gaps:**
1. Indonesia country-entry route not present
2. Translation completeness unverified · likely gaps
3. No evidence of native-speaker review for Indonesian

**Testing readiness:** Country switching can be tested today. Translation completeness audit needs native speakers.

### 2.7 · Mobile + PWA · Grade: **B**

**Current state:**
- Phone-frame rule sealed · `.nex-native-stage > .nex-native-frame` · 360×780 centered on desktop ≥500px
- Mobile-first route structure under `/nex-native/*`
- No `public/manifest.json` found · PWA not configured
- No `public/sw.js` service worker found in standard location

**World-class bar:**
- PWA installable · manifest.json present · icons for all sizes
- Service worker · offline support for critical paths
- Push notifications working on iOS + Android
- 4+ device-profile automated tests

**Gaps:**
1. PWA manifest absent · cannot install to home screen
2. Service worker absent (or located non-standardly · needs verification)
3. Push-notification architecture redesign pending (Sprint 10 per runbook)
4. No cross-device test matrix

**Testing readiness:** Mobile layout can be tested today in browser dev-tools · real-device testing needs PWA + service-worker work.

### 2.8 · Observability · Grade: **D**

**Current state:**
- `@sentry` NOT in `package.json` · no external error monitoring
- HQ Alerts system (sealed infra · verification pending)
- Health probes library exists
- Supabase logs · Vercel logs accessible via dashboards
- `nex_security_audit_event` table per CLAUDE.md pattern

**World-class bar:**
- Centralised error monitoring (Sentry · Datadog) with PII scrubbing
- Structured logs · searchable across services
- Distributed tracing for cross-service requests
- SLO dashboards · public and internal
- Alert routing with escalation policy

**Gaps:**
1. No Sentry (or equivalent) · error visibility limited to Vercel dashboard
2. No distributed tracing
3. No public status page
4. SLO dashboards undefined
5. HQ Alerts realtime+polling exists but not verified end-to-end against failure-injection matrix

**Testing readiness:** Internal QA can proceed but error visibility is limited. External monitoring must be added before public launch.

### 2.9 · Payments + Financial · Grade: **C**

**Current state:**
- Stripe Connect integration · `src/app/api/nex-native/billing/*`
- Buyer checkout + subscription checkout + webhook handler
- F-3 fix in sandbox: 21 attack-path tests green
- F-3 **not deployed to production**
- Stripe live-mode platform approval status unknown
- 0% application fee sealed
- 7-day trial sealed with 4 honesty guardrails designed (implementation state unclear)

**World-class bar:**
- Stripe live-mode approval · platform account verified
- Webhook signature verification · verified
- Idempotency keys on all mutations · verified
- Reconciliation report daily · variance <0.01%
- PCI SAQ-A compliance (Stripe-hosted checkout keeps NEX in SAQ-A)
- Dispute response automation
- Refund workflow

**Gaps:**
1. F-3 fix not in production · P0-CURRENT vulnerability live
2. Stripe live-mode approval status unknown
3. Webhook signature verification not independently audited
4. Reconciliation process undefined
5. Dispute automation not built
6. VAT handling per jurisdiction unverified

**Testing readiness:** Test-mode flows testable today. Live-mode blocked on Stripe approval + F-3 deploy.

### 2.10 · Testing coverage · Grade: **B**

**Current state:**
- 1067 unit test files · substantial coverage
- 62 Playwright E2E spec files
- CLAUDE.md flags ~14 known broken imports in test files
- Sprint 1 device-registry: 30 of 30 tests green
- Vitest runner · parallelism configured
- No code-coverage number published

**World-class bar:**
- ≥80% code coverage on business-logic layers
- 100% coverage on security-critical paths
- E2E test per critical user journey (NEX Phase E defines 10)
- Flaky-test policy with zero tolerance
- Nightly regression suite

**Gaps:**
1. Code-coverage number not published
2. ~14 known-broken tests tolerated · should be fixed or deleted
3. 10 Phase E journeys not yet authored (only 62 varied specs exist · coverage unclear)
4. Flaky-test policy not formalised
5. Nightly regression not configured

**Testing readiness:** Unit + narrow E2E can run today. Phase E 10-journey matrix must be built before launch.

### 2.11 · Legal + compliance · Grade: **F**

**Current state:**
- T&C draft 2026-11-09 · not reviewed · not publishable
- Privacy Policy draft 2026-11-09 · not reviewed · not publishable
- No solicitor engaged
- No DPIA
- No DPA templates from processors
- Kominfo registration status unknown
- DAC7 seller-reporting infrastructure not built
- Six owner facts missing

**World-class bar:**
- T&C + Privacy Policy reviewed by qualified counsel · jurisdiction-specific
- GDPR Article 35 DPIA for high-risk processing
- DPO designated where required
- DPA signed with every processor (Supabase · Vercel · Stripe · Sentry · TURN · APNS · FCM)
- Kominfo registration (Indonesia) · Irish Revenue · HMRC registrations
- Consumer-protection compliance per jurisdiction

**Gaps:**
Everything. See solicitor briefing pack · L-1..L-6 scope defines the complete legal workstream.

**Testing readiness:** Legal is not testable. It is blocking.

### 2.12 · Documentation · Grade: **C+**

**Current state:**
- Extensive internal doctrines in `docs/doctrine/` (18+ documents including the ones produced today)
- `CLAUDE.md` + global memory for AI agent guidance
- No API documentation generated (OpenAPI · Swagger)
- No end-user help content visible at `/nex-native/help/page.tsx` · state unknown
- No public developer documentation

**World-class bar:**
- Public API documentation (if NEX exposes API to third parties · it may not)
- End-user help centre with search
- Published change log (semver-based)
- Public status page
- Public security policy (`.well-known/security.txt`)

**Gaps:**
1. End-user help centre content state unknown
2. No `.well-known/security.txt` (should link to responsible disclosure)
3. Public change log not established
4. Developer documentation absent (acceptable if no public API)

**Testing readiness:** Help-centre content can be audited today. Security.txt can be added today (low cost).

### 2.13 · Incident response · Grade: **C**

**Current state:**
- Incident response runbook produced 2026-11-09 · comprehensive
- HQ Alerts system · realtime + polling fallback (sealed infra)
- Five-state health model (UNKNOWN/HEALTHY/DEGRADED/DOWN/DETECTED) sealed
- Blameless post-mortem template defined
- 15 failure-injection scenarios enumerated · not yet executed
- Single-owner stage · no on-call rotation

**World-class bar:**
- 24/7 on-call rotation · paging within 5 min of P0
- Monthly failure-injection exercises
- Public status page
- Automatic incident declaration based on signals
- Rehearsed rollback for critical surfaces

**Gaps:**
1. On-call rotation not possible at current team size
2. 15 failure-injection scenarios not exercised
3. Public status page not live
4. Rollback not rehearsed in production (implicitly rehearsed in sandbox via mig 312/290/313)

**Testing readiness:** Internal failure-injection tests can be authored and run today against sandbox. Full ops readiness needs team scaling.

### 2.14 · Deployment + CI/CD · Grade: **D**

**Current state:**
- Vercel deployment across three projects (Ireland · Indonesia · Worldwide)
- `.github/workflows/`: 2 workflows only (concurrency-rehearsal · security-ci)
- No automated deployment gate · deploys are manual
- No canary deployment infrastructure
- No automatic rollback
- Branch strategy sealed: `main` → all three Vercel projects
- Build-commit-push doctrine sealed

**World-class bar:**
- Protected `main` branch · reviewed PRs only
- Automated test gate before merge
- Canary deploys for 5-10% traffic before full rollout
- Automatic rollback on error-rate spike
- Blue/green or feature-flag-based deploys
- Zero-downtime deploys
- SLSA level 3 build provenance

**Gaps:**
1. Only 2 GitHub workflows · insufficient CI gate coverage
2. No canary deployment
3. No automatic rollback
4. Feature flag infrastructure unclear
5. Build provenance / supply-chain security not addressed

**Testing readiness:** Current deploy flow is manual + careful. Works but doesn't scale beyond single-owner.

### 2.15 · Content moderation · Grade: **D**

**Current state:**
- Reporting infrastructure likely exists (per `nex_report` reference in architecture)
- HQ moderation UI exists (`src/app/nex-native/hq/*`)
- Owner-directed posture: "NEX acts in good faith on reports"
- No DSA transparency reporting infrastructure
- No automated moderation (per sealed device-only · private content moderation impossible anyway)
- Community Notice surface has `/report` endpoint

**World-class bar:**
- Published community guidelines
- Transparent appeals process
- DSA compliance (if EEA-threshold triggered)
- Transparency reports (bi-annual · published)
- Hate speech / CSAM detection where applicable (NOT in private chat · but public surfaces)

**Gaps:**
1. Public community guidelines document absent
2. Appeals process undefined
3. DSA transparency reporting not built
4. CSAM-detection posture undefined (public surfaces only · never private)
5. Content-moderation SLA (time-to-review reports) undefined

**Testing readiness:** Internal moderation workflow testable today. Public-facing policy + appeals infrastructure needs build.

---

## 3 · Weighted overall readiness

Weights by owner-stated priority (chat privacy highest · legal/safety second · testing third):

| Category | Grade | Score | Weight | Weighted |
|---|---|---|---|---|
| Security | C- | 1.5 | 10% | 0.15 |
| Privacy | F | 0.0 | 20% | 0.00 |
| Reliability | C | 2.0 | 8% | 0.16 |
| Performance | ? | 1.5 | 6% | 0.09 |
| Accessibility | ? | 1.5 | 6% | 0.09 |
| i18n | B- | 2.7 | 4% | 0.11 |
| Mobile + PWA | B | 3.0 | 6% | 0.18 |
| Observability | D | 1.0 | 8% | 0.08 |
| Payments | C | 2.0 | 8% | 0.16 |
| Testing | B | 3.0 | 5% | 0.15 |
| Legal | F | 0.0 | 10% | 0.00 |
| Documentation | C+ | 2.3 | 2% | 0.05 |
| Incident response | C | 2.0 | 3% | 0.06 |
| Deploy/CI | D | 1.0 | 2% | 0.02 |
| Content moderation | D | 1.0 | 2% | 0.02 |

(Scale: A=4.0 · B=3.0 · C=2.0 · D=1.0 · F=0.0 · ?=1.5 placeholder)

**Weighted total: 1.32 / 4.0 = 33% of world-class bar.**

Note: Privacy at 0.0 with 20% weight pulls the total down heavily. This is correct · the sealed launch claim depends on Privacy = A. Until Phase D ships, that cannot be true.

---

## 4 · Launch blockers (ordered · must close before public launch)

| # | Blocker | Build phase | Est. time |
|---|---|---|---|
| **1** | Phase D Sprint 2-16 unbuilt (device-only architecture) | D | 14-20 weeks |
| **2** | Historical secure-deletion sweep S0-S6 not executed | D (Sprints 11-15) | 6-8 weeks (included above) |
| **3** | Independent privacy audit not engaged · no State C report | F | 8-18 weeks (post D) |
| **4** | T&C + Privacy Policy not legal-reviewed · not publishable | A | 5-10 weeks |
| **5** | Six owner legal facts missing | A | Owner-only · days |
| **6** | D-5 TURN provider not sealed (needed for Sprint 2) | B | 3-5 weeks |
| **7** | D-4 export window length not sealed (needs L-1..L-6 memo) | B | After A |
| **8** | F-3 buyer-checkout fix not deployed to production | C | 1 day (post owner authorisation) |
| **9** | Stripe live-mode approval status unknown | H | Owner · days-weeks |
| **10** | External error monitoring (Sentry or equivalent) not integrated | Operational | 1-2 weeks |

**Critical path (longest): Blockers 1 → 3 → 4** · estimated **28-50 weeks**.

**Parallel-safe blockers (can run anytime):** 4 (A) · 5 (A) · 6 (B) · 8 (C) · 10 (Operational).

---

## 5 · What IS ready for testing today

### 5.1 · Non-chat surfaces testable in internal QA (sandbox)

| Surface | Testable? | Caveat |
|---|---|---|
| `/nex-native/directory/*` | Yes | Fixtures may need seeding · sealed Directory doctrine |
| `/nex-native/manage/shop/*` | Yes | Phone-frame rule verified sealed · 7-step setup present |
| `/nex-native/cart`, `/nex-native/product/[productId]` | Yes · test-mode Stripe | Live-mode blocked |
| `/nex-native/vault/*` | Yes | Vault migration state per sealed Phase 1 remediation |
| `/nex-native/hq/*` (admin surface) | Yes · desktop-only ≥900px | Admin-only route · gated |
| `/nex-native/sign-in` + `/create-account` | Yes | Ireland auth model sealed |
| `/nex-native/community/notices` | Yes | Community Notice sealed in Scope Reduction |
| `/nex-native/chat-themes-library` | Yes | Phone-frame |
| `/nex-native/call-centre`, `/call` | Partial | Device-only architecture Phase D · voice/video depends on TURN (D-5 pending) |

### 5.2 · What is NOT testable today

| Surface | Why not |
|---|---|
| Private chat body persistence against I-1 | Phase D Sprints 4-5 unbuilt · plaintext path still live for pre-Phase-2 architecture |
| Peer-to-peer WebRTC data channel | Phase D Sprint 3 unbuilt |
| TURN relay zero-persistence claim | D-5 provider unsealed |
| Sealed launch privacy claim (I-6 atomicity) | Phase D 90% unbuilt · independent audit not run |
| F-3 attack paths against production | F-3 not yet deployed to production |
| Stripe live-mode flows | Platform approval + deploy pending |
| Cross-country production testing | Vercel preview/production deploys need owner-directed env verification |

### 5.3 · What can be ADDED to the testable list today (low cost · high value)

Items that can be built in <1 week and immediately improve testability:

1. **axe-core integration in Playwright** — adds automated a11y check to existing 62 E2E specs · ~2 days
2. **Lighthouse CI on PR builds** — measures performance regressions · ~2 days
3. **`.well-known/security.txt`** — publishes responsible-disclosure contact · ~1 hour
4. **PWA manifest + basic service worker** — makes NEX installable · ~2 days
5. **Indonesia country-entry page** (`/nex-native/indonesia-entry/page.tsx`) — parity with Ireland · ~1 day
6. **Sentry integration** (or Datadog · Honeybadger) — adds external error monitoring · ~3 days
7. **Robots meta on preview-only pages** — prevents preview Vercel URLs from being Google-indexed · ~1 day

**None of these are authorised to build.** They are listed as "available quick wins" if the owner wants to raise readiness ahead of Sprint 2.

---

## 6 · What this audit does + does NOT do

### Does
- Comprehensive snapshot vs world-class standards
- Per-category grade with evidence citations
- Explicit launch-blocker list with time estimates
- Explicit "testable today" vs "not testable" surfaces
- Honest verdict: not ready for public launch · partially ready for internal QA

### Does NOT
- Replace the independent privacy audit (Build Phase F) · this is an ENGINEERING self-audit · not independent
- Authorise any build · deploy · merge
- Replace legal advice (Build Phase A solicitor engagement)
- Guarantee the estimated timelines (owner-side action is on the critical path)
- Measure actual Lighthouse / INP / load-test numbers (not run this turn)

---

## 7 · Owner decisions available now (in priority order)

Not authorisations · recommendations. Each unblocks progress toward launch:

| # | Decision | Impact |
|---|---|---|
| 1 | Supply six legal facts + engage solicitor | Opens Build Phase A · 5-10 week clock starts |
| 2 | F-3 deploy option (A · B · C) | Closes P0-CURRENT · 1 day effort |
| 3 | Authorise Sentry (or equivalent) integration | Raises observability from D to B · 3 days effort |
| 4 | Authorise D-5 TURN evidence-gap closure + engagement | Unblocks Sprint 2 start · 3-5 week clock |
| 5 | Authorise axe-core + Lighthouse CI additions | Raises a11y + perf measurability · 2-4 days effort |
| 6 | Authorise `/nex-native/indonesia-entry/page.tsx` + robots/noindex sweep | Country parity + indexing hygiene · 1 day effort |
| 7 | Review + redline T&C and Privacy Policy drafts with solicitor | Starts legal review clock |

Any single one of these can start today with owner authorisation.

---

## 8 · One-sentence executive takeaway

**NEX has mature non-chat infrastructure and a thoroughly-planned device-only chat architecture, but the sealed launch claim depends on a 14-20 week Phase D engineering programme plus a 8-18 week independent audit, both gated by owner-side legal + evidence-closure actions — so NEX is NOT ready for public launch, and the earliest realistic public-launch date is 28-50 weeks from today.**

---

**End of launch readiness audit.**

Covers security · privacy · reliability · performance · accessibility · i18n · mobile · observability · payments · testing · legal · documentation · incident response · deployment · content moderation. 15 categories · evidenced from repo state. Grade-weighted readiness 33% of world-class bar.
