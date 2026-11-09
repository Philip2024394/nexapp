# NEX · Public Launch Readiness Checklist
### 2026-11-09 · Build Phase H go/no-go gate

**Status:** Comprehensive readiness checklist. Each row must be PASS before public launch. Partial-pass rows block launch until closed.

**Author:** Claude Opus 4.7

**Relationship to other doctrines:**
- 8-workstream phased build plan · this is Phase H's go/no-go
- Each preceding Build Phase A..F contributes rows to this checklist
- Independent audit (Phase F) is a prerequisite checklist item · not a replacement for this checklist

---

## 0 · Launch definition

"Launch" means:
- NEX publicly available at `nex.<domain>` and any regional subdomains
- Public marketing campaign begins
- Shop signup accepts real revenue
- NEX makes the public claim: *"NEX does not keep a copy of your private conversations. Your conversations belong to you and remain on your devices."*

**Launch is irreversible in that users will begin to use NEX in production immediately.** Reverting post-launch means rolling back a public commitment. Therefore this checklist must be comprehensive.

---

## 1 · Section A · Legal readiness

| # | Item | Pass criteria | Owner |
|---|---|---|---|
| A-1 | Legal entity registered | Entity exists in country of incorporation · evidence filed | Owner |
| A-2 | Six owner facts captured | Name · country · address · company number · VAT · support email | Owner |
| A-3 | Solicitor retainer complete | Signed engagement letter · fee paid | Owner |
| A-4 | T&C reviewed + finalised | Solicitor-redlined version · signed off | Owner + Counsel |
| A-5 | Privacy Policy reviewed + finalised | Solicitor-redlined version · signed off | Owner + Counsel |
| A-6 | L-1..L-6 memo delivered + signed | Retention · DSR · deletion · export · T&C · privacy memo | Counsel |
| A-7 | DPIA complete (if required) | Article 35 DPIA for device-only architecture | Counsel |
| A-8 | DPA templates obtained for all processors | Supabase · Vercel · Stripe · TURN · Sentry (if used) · APNS · FCM | Counsel + Engineer |
| A-9 | Kominfo registration (Indonesia) if required | Registration certificate | Counsel + Owner |
| A-10 | DAC7 seller-reporting capability (if NEX qualifies) | Infrastructure to report seller data to Irish Revenue | Engineer |
| A-11 | Consumer-protection compliance review | Right of withdrawal · prominent disclosures · unfair terms | Counsel |
| A-12 | Stripe platform agreement live-mode approved | Stripe approval letter | Owner |
| A-13 | Terms of Service click-wrap verified enforceable | Counsel confirmation | Counsel |
| A-14 | Minimum age policy sealed | Age per jurisdiction · age-gate at signup | Owner + Counsel |
| A-15 | Breach notification procedure documented + tested | Incident → supervisory authority within 72h | Engineer + Counsel |

---

## 2 · Section B · D-4 + D-5 sealing

| # | Item | Pass criteria | Owner |
|---|---|---|---|
| B-1 | D-4 export window length sealed | Length confirmed with legal basis | Owner (post memo) |
| B-2 | D-5 TURN provider sealed | Provider · contract · zero-persistence verified | Owner |
| B-3 | TURN provider DPA signed | Signed DPA + SCCs | Owner + Counsel |
| B-4 | TURN provider SOC 2 / ISO 27001 evidence obtained | Current attestation | Engineer |
| B-5 | TURN credential model verified | Per-session · short-TTL · non-reusable | Engineer |

---

## 3 · Section C · F-3 production deployment

| # | Item | Pass criteria | Owner |
|---|---|---|---|
| C-1 | F-3 code deployed to Worldwide production | Vercel production shows F-3 commit | Owner (auth) · Engineer (exec) |
| C-2 | F-3 attack-path tests green against production | 21 scenarios pass in production (sanitised attack-path verification) | Engineer |
| C-3 | Stripe test-mode → live-mode transition verified | Live-mode webhook signed · verified | Owner · Engineer |
| C-4 | STRIPE_WEBHOOK_SECRET configured in production | Vercel env var set | Owner |
| C-5 | Buyer checkout observed across 50+ real transactions | Monitoring · no F-3 anomalies | Engineer post-canary |

---

## 4 · Section D · Phase 2 device-only architecture verified

| # | Item | Pass criteria | Owner |
|---|---|---|---|
| D-1 | Phase 2 Sprint 1-16 complete in sandbox | Branch at Sprint 16 head · tests green | Engineer |
| D-2 | V-NET-1 · signalling envelope zero-retention verified | pcap evidence | Engineer |
| D-3 | V-NET-2 · peer-to-peer data channel zero-plaintext verified | pcap evidence | Engineer |
| D-4 | V-STORE-1 · no body/ciphertext in schema | Schema inspection | Engineer |
| D-5 | V-STORE-2 · no sensitive attachment_meta | Schema + sample inspection | Engineer |
| D-6 | V-STORE-3 · no private attachment bucket | Bucket enumeration | Engineer |
| D-7 | V-LOG-1 · no sensitive log leakage | Log-sample analysis · 30-day window | Engineer |
| D-8 | V-SIG-1 · all four surfaces encrypted (peer · business · NEX Official · HQ) | Per-surface traffic test | Engineer |
| D-9 | V-TURN-1 · TURN provider zero-persistence verified | Provider evidence bundle | Engineer |
| D-10 | V-DELETION-1 · historical sweep S0-S6 complete + signed | Per-phase sign-offs | Owner · Engineer |
| D-11 | Phase 2 code promoted to production after sandbox green | Production migration + Vercel deploy per I-4 phased gates | Owner · Engineer |
| D-12 | Push notification redesign live · content-free | Payload inspection | Engineer |

---

## 5 · Section E · Phases 3-6 downstream remediation

| # | Item | Pass criteria | Owner |
|---|---|---|---|
| E-1 | Billing-table RLS (mig 312) in production | Applied 2026-11-09 · ✅ | Engineer |
| E-2 | F-3 price validation in production | See Section C | Engineer |
| E-3 | Peer-message RLS (mig 218) in production | Applied | Owner · Engineer |
| E-4 | Rate-limit (mig 290 + 313) in production | Applied 2026-11-09 · ✅ | Engineer |
| E-5 | Theme + buyer UI wiring complete | QA signoff | Engineer |
| E-6 | Path A order separation complete | Four-phase migration complete | Owner · Engineer |
| E-7 | HTTP route tests passing | CI green | Engineer |
| E-8 | 10 Playwright journeys passing | J-1..J-10 green | Engineer |
| E-9 | Performance baselines met | Lighthouse · CWV · per Phase E matrix | Engineer |
| E-10 | Mobile matrix passing | 4 device profiles | Engineer |
| E-11 | Accessibility WCAG 2.2 AA conformance | Automated + manual audit | Engineer |
| E-12 | Load test at 50k concurrent passing | k6 report | Engineer |

---

## 6 · Section F · Independent audit

| # | Item | Pass criteria | Owner |
|---|---|---|---|
| F-1 | Independent auditor designated | Owner-selected · independence declaration | Owner |
| F-2 | Audit SoW signed | Both parties signed | Owner + Auditor |
| F-3 | Audit executed per SoW | Methodology plan completed · evidence collected | Auditor |
| F-4 | Audit findings closed | Any remediation items executed + re-verified | Engineer · Auditor |
| F-5 | Signed State C report delivered | Written · signed · State C explicit | Auditor |
| F-6 | Counsel legal review of audit report | Counsel sign-off that claim is supportable | Counsel |

---

## 7 · Section G · Operational readiness

| # | Item | Pass criteria | Owner |
|---|---|---|---|
| G-1 | HQ Alerts realtime + polling verified | Deliberate signal → alert fires within SLO | Engineer |
| G-2 | On-call rotation defined (owner or team) | Documented · tested | Owner |
| G-3 | 15 failure-injection scenarios tested | Per incident-response runbook §6 | Engineer |
| G-4 | Rollback playbook rehearsed | Dry-run rollback of a non-critical change in production | Engineer |
| G-5 | Observability stack live | Logs · metrics · health probes | Engineer |
| G-6 | Error budgets defined + instrumented | Per surface SLOs | Engineer |
| G-7 | Public status page live | status.nex.<domain> operational | Engineer |
| G-8 | Backup verification | Daily backup succeeds · restore rehearsed | Engineer |
| G-9 | Incident escalation paths documented | P0-CURRENT path from signal → owner within 5min | Owner |
| G-10 | Post-mortem template adopted | Blameless post-mortem process defined | Engineer |

---

## 8 · Section H · Financial + payments

| # | Item | Pass criteria | Owner |
|---|---|---|---|
| H-1 | Stripe Connect live-mode approved for platform | Stripe approval letter | Owner |
| H-2 | Live Stripe keys configured in production | Vercel env vars | Owner |
| H-3 | 0% application fee verified in live mode | Test transaction evidence | Engineer |
| H-4 | Stripe webhook signed verification live | Signed verification · tested | Engineer |
| H-5 | Trial-start → day-8 charge verified end-to-end | Test subscription cycle | Engineer |
| H-6 | 1-click cancel verified | Test cancellation | Engineer |
| H-7 | 4 trial-honesty guardrails verified | Pre-trial disclosure · day-5 reminder · 1-click cancel · trial-end access | Engineer |
| H-8 | Refund + dispute flow tested | Test dispute cycle | Engineer |
| H-9 | VAT + tax handling verified per jurisdiction | Correct VAT applied · correct reporting | Owner · Engineer |
| H-10 | Payout cycle to sellers verified | Test payout to seller Connect account | Engineer |

---

## 9 · Section I · Marketing + communications

| # | Item | Pass criteria | Owner |
|---|---|---|---|
| I-1 | Launch marketing copy legal-reviewed | Counsel-reviewed messaging | Counsel |
| I-2 | Sealed launch claim present in marketing | *"NEX does not keep a copy of your private conversations. Your conversations belong to you and remain on your devices."* · counsel-approved wording | Counsel · Owner |
| I-3 | Claim supported by audit report | F-5 evidence available on request | Auditor |
| I-4 | Pricing clearly disclosed | $9.99/mo · currency-localised · trial terms explicit | Counsel · Owner |
| I-5 | Contact + support email live | Monitored inbox | Owner |
| I-6 | Press + external communication alignment | Consistent messaging | Owner |

---

## 10 · Section J · Post-launch monitoring commitment (next 90 days)

| # | Item | Pass criteria | Owner |
|---|---|---|---|
| J-1 | Daily incident review for first 30 days | Documented | Owner |
| J-2 | Weekly incident review days 31-90 | Documented | Owner |
| J-3 | 30-day post-launch audit spot check | Independent auditor verifies no regression | Auditor |
| J-4 | 60-day spot check | Same | Auditor |
| J-5 | 90-day spot check + full re-verification | Full V-* matrix re-run | Auditor |
| J-6 | Monthly cost monitoring vs $137/mo baseline | Forecast adherence | Owner |
| J-7 | User-reported privacy concern process live | Dedicated intake channel | Engineer |

---

## 11 · Blocking rules

### 11.1 · Any P0-CURRENT item blocks launch

If any item above shows P0-CURRENT red · launch cannot proceed. Must fix first. No exceptions.

### 11.2 · The sealed launch claim gate (I-6)

The public claim *"NEX does not keep a copy of your private conversations..."* cannot be made until ALL of:
- Section A complete (counsel sign-off)
- Section D complete (Phase 2 verified)
- Section F complete (independent audit · signed State C)

**All three sections must sign off atomically** (sealed invariant I-6).

### 11.3 · Partial launch is not permitted

NEX cannot launch "chat today · rest later" unless each surface has its own complete readiness subsection AND the sealed claim is scoped only to the launched surface. The default assumption is all-or-nothing launch.

### 11.4 · Rolling-launch option (owner decision)

If owner chooses a rolling launch (Ireland first · then Indonesia · then Worldwide):
- Each regional launch gets its own checklist pass
- Shared infrastructure (Supabase · Stripe · Phase 2 architecture) passes once
- Country-specific items (Kominfo for Indonesia · Irish Revenue for Ireland) per region

---

## 12 · Launch day runbook

### 12.1 · T-7 days
- Full checklist review · all red items closed
- Marketing content locked
- On-call rotation confirmed
- Rollback rehearsal
- Status page live (not public yet)

### 12.2 · T-24 hours
- Final smoke test · 10 Playwright journeys green
- Final health-probe verification
- Final checklist re-read · owner sign-off
- Incident response team briefed

### 12.3 · T-0 launch
- DNS / Vercel alias cutover
- Status page public
- Marketing go
- Monitoring intensive (24h window)

### 12.4 · T+24h
- Incident review
- Metric review vs projections
- Any regressions triaged

### 12.5 · T+7d
- 7-day review
- Error budget consumed · known issues · user feedback
- Adjust post-launch priorities

### 12.6 · T+30d
- Full post-launch audit (first auditor spot check)

---

## 13 · What this checklist does + does NOT do

### Does
- Define every gate before public launch
- Enumerate owner · counsel · engineer · auditor responsibilities
- Specify blocking rules for I-6 atomicity

### Does NOT
- Launch anything (requires owner final sign-off)
- Replace counsel judgement
- Replace auditor independence
- Guarantee success (reduces risk · not probability)

---

## 14 · Current state (as of 2026-11-09)

Rows currently PASS:
- E-1 (billing RLS applied)
- E-4 (rate-limit applied)

Rows currently drafted/prepared but pending execution:
- A-4 · A-5 (T&C + Privacy Policy drafted · not reviewed)
- Section D-* (runbook ready · Phase 2 not started)
- Section F-* (SoW ready · auditor not engaged)

Rows pending owner action:
- All of Section A (except drafts)
- B-1 · B-2 (D-4 + D-5 sealing)
- C-1..C-5 (F-3 production deploy)
- F-1..F-6 (audit engagement + execution)
- H-1..H-10 (Stripe live-mode + financial readiness)

**Current launch readiness: approximately 5% of rows passing.** Expected trajectory per 8-workstream phased build plan critical path (35-70 weeks).

---

**End of public launch readiness checklist.**

Comprehensive go/no-go gate for Build Phase H. Awaiting Phase A..F completion to populate pass states.
