# NEX · 8-Workstream Phased Build Plan
### 2026-11-09 · owner Master Engineer directive · orders the remaining 8 workstreams by dependency

**Status:** Phased build-plan doctrine. Produces the ordering, entry gates, exit criteria, and action assignments that let each workstream proceed without waiting for others that don't actually block it. Respects every sealed invariant (I-1..I-6 · Constitution §4+5 · Supabase seal · device-only directive · Phase 7 deferred).

**Author:** Claude Opus 4.7 · owner-directed phasing.

**Companion artefacts produced same turn:**
- `docs/doctrine/nex-solicitor-briefing-pack-2026-11-09.md` (Build Phase A engineering deliverable)
- `docs/doctrine/nex-independent-audit-scope-of-work-2026-11-09.md` (Build Phase F engineering deliverable)

**Related:**
- Consolidated roadmap · prior session
- Phase 2 Rev 2 doctrine · sealed
- T&C draft · 2026-11-09
- Privacy Policy draft · 2026-11-09
- D-5 TURN comparison · 2026-11-09
- F-3 Ireland-preview preflight · 2026-11-09

---

## 0 · Reading guide

NEX has existing "Phase N" labels with specific sealed meanings (Phase 1 = security remediation · Phase 2 = device-only private chat · Phase 7 = business storage). **This doctrine uses "Build Phase A..H" labels to avoid collision.** The mapping is in §2.

Each Build Phase has four lanes:
- **Owner actions** · things only the owner can do (facts · authorisations · engagement decisions)
- **Counsel actions** · things only a qualified solicitor can do (legal memo · policy review · DPAs)
- **Engineer actions (Claude)** · things Claude can do within sealed gates (preparation · briefings · runbooks · code when authorised)
- **Auditor actions** · things only an independent privacy auditor can do (State C verification)

A Build Phase closes when **all four lanes' exit criteria are satisfied**. A phase cannot be skipped. Phases can run **in parallel where no cross-dependency exists** · explicit parallelism is called out per phase.

---

## 1 · One-page dependency graph

```
                            Build Phase A
                      (Legal foundation · §3)
                                 |
                                 |   +-- parallel-safe --+
                                 |                       |
                                 v                       v
                          Build Phase B           Build Phase C
                      (D-4 + D-5 sealing)     (F-3 production deploy)
                            (§4)                      (§5)
                                 |
                                 v
                          Build Phase D
                     (Phase 2 private chat
                      implementation · §6)
                                 |
                                 v
                          Build Phase E
                     (Phases 3-6 remediation
                      per consolidated roadmap · §7)
                                 |
                                 v
                          Build Phase F
                     (Independent privacy audit · §8)
                                 |
                                 +-- parallel-safe --+
                                 |                   |
                                 v                   v
                          Build Phase G       Build Phase H
                       (Business storage ·  (Public launch · §10)
                        Phase 7 if authorised
                        · §9)
```

**Critical path:** A → B → D → E → F → H (public launch).
**Parallel-safe lanes:**
- C (F-3 deploy) can run alongside B or any later phase
- G (business storage) can run alongside H preparation once F is complete · but Phase 7 was owner-sealed "not before Phase 2 resolves" so cannot start before D

---

## 2 · The eight workstreams · phase assignment

| # | Workstream (owner's list) | Build Phase | Why this phase |
|---|---|---|---|
| 1 | Six legal entity facts | **A** | Required foundation for any legal document to be published |
| 2 | T&C + Privacy Policy legal review | **A** | Blocks T&C + Privacy Policy publication · same phase as (1) |
| 3 | D-4 export period | **B** | Needs L-1..L-6 legal memo from Phase A to inform retention decision |
| 4 | D-5 TURN provider | **B** | Needs evidence-gap closure · parallel with D-4 |
| 5 | F-3 production deployment | **C** | Independent of A/B · needs only owner constitution §4 message |
| 6 | Phase 2 private chat implementation | **D** | Needs D-4 + D-5 sealed · Phase A legal memo · explicit authorisation |
| 7 | Phases 3-6 downstream remediation | **E** | Needs Phase 2 verified · from consolidated roadmap |
| 8 | Business storage (Phase 7) + public launch | **G** + **H** | Business storage is owner-sealed-not-before-Phase-2 · Public launch needs F |

Additional implied phase: **F · Independent privacy audit** — required to make the State C claim per sealed invariant I-6. Cannot be collapsed into E because an auditor must be external to the engineering team.

---

## 3 · Build Phase A · Legal foundation

### A.0 · Goal
Six owner facts captured + qualified solicitor engaged + L-1..L-6 legal memo complete + T&C + Privacy Policy review-cycle complete.

### A.1 · Entry gates
- T&C draft produced · ✅ 2026-11-09
- Privacy Policy draft produced · ✅ 2026-11-09
- Solicitor briefing pack produced · ✅ 2026-11-09 (companion to this doctrine)

### A.2 · Owner actions
| # | Action | Blocks |
|---|---|---|
| A-O-1 | Supply six facts: legal entity name · country of incorporation · registered address · company number · VAT/tax ID · canonical support email | A-O-2 · A-C-1 |
| A-O-2 | Designate qualified solicitor licensed in applicable jurisdictions (Ireland · EU · UK · Indonesia · Worldwide markets) | A-C-1 |
| A-O-3 | Engage solicitor on fixed-scope retainer covering T&C + Privacy Policy + L-1..L-6 memo | A-C-1 |
| A-O-4 | Decide minimum age (Section 10 of Privacy Policy draft) with solicitor input | Privacy Policy publication |

### A.3 · Counsel actions
| # | Action | Scope |
|---|---|---|
| A-C-1 | Review T&C draft · identify enforceability issues · consumer-protection compliance · jurisdiction clauses · dispute resolution · liability limits | T&C doctrine |
| A-C-2 | Review Privacy Policy draft · GDPR · UK GDPR · UU PDP · ePrivacy · CCPA/CPRA · DSA · DAC7 · P2B · retention · breach notification | Privacy Policy doctrine |
| A-C-3 | Produce L-1..L-6 legal memo on retention obligations across EU/UK/Indonesia/applicable markets · informs D-4 export window | New memo |
| A-C-4 | Produce DPA templates for service providers (Supabase · Vercel · Stripe · TURN provider · Sentry) | New memo |
| A-C-5 | Confirm Standard Contractual Clauses applicable to EU→US + EU→Indonesia transfers | Privacy Policy §6 |

### A.4 · Engineer actions (within gates · can be done now)
| # | Action | Status |
|---|---|---|
| A-E-1 | Produce T&C draft | ✅ 2026-11-09 |
| A-E-2 | Produce Privacy Policy draft | ✅ 2026-11-09 |
| A-E-3 | Produce solicitor briefing pack · single handoff document consolidating NEX architecture · sealed invariants · T&C scope · Privacy Policy scope · L-1..L-6 question list · processor relationships | ✅ 2026-11-09 (companion) |
| A-E-4 | After solicitor returns review: implement counsel's redlines in T&C + Privacy Policy source documents | Pending A-C-1 + A-C-2 |
| A-E-5 | Verify Privacy Policy claims match actual implementation (audit matrix) | Pending Phase 2 verified for most claims |

### A.5 · Exit criteria
- All six owner facts captured and inserted into T&C + Privacy Policy
- Solicitor has produced reviewed T&C + Privacy Policy finalised texts
- L-1..L-6 memo delivered and signed by solicitor
- Minimum age sealed by owner
- DPA templates obtained for all processors

### A.6 · Estimated duration
- Owner-side: 1-2 weeks to engage solicitor
- Counsel review: 4-8 weeks depending on scope
- Total Phase A: **5-10 weeks** (owner-side driven)

---

## 4 · Build Phase B · D-4 + D-5 sealing

### B.0 · Goal
Export-window length sealed (D-4) + TURN provider sealed (D-5).

### B.1 · Entry gates
- Phase A L-1..L-6 memo delivered (for D-4 retention informed decision)
- D-5 evidence-gap closure (6 items identified in prior TURN comparison)

### B.2 · Owner actions
| # | Action | Blocks |
|---|---|---|
| B-O-1 | Review L-1..L-6 memo · seal D-4 export-window length | D |
| B-O-2 | Authorise third-party engagement for D-5 evidence-gap closure (e.g. request Cloudflare Realtime SOC 2 under NDA · obtain DPA · verify POP coverage · request penetration-test summary) | B-E-1 |
| B-O-3 | After evidence closure · seal D-5 TURN provider | D |

### B.3 · Counsel actions
| # | Action | Scope |
|---|---|---|
| B-C-1 | Legal review of chosen TURN provider's DPA + SCCs | D-5 sealing |
| B-C-2 | Legal review of export-period design (D-4) against UU PDP + GDPR Article 20 portability | D-4 sealing |

### B.4 · Engineer actions
| # | Action | Status |
|---|---|---|
| B-E-1 | After owner B-O-2 authorises engagement · execute the 6-point evidence-gap closure per D-5 comparison doctrine · produce final evidence memo | Pending B-O-2 |
| B-E-2 | Produce D-4 owner decision briefing with retention periods per jurisdiction + proposed export-window options · ready for owner to seal post-memo | Can be produced after A-C-3 |
| B-E-3 | Update Phase 2 Rev 2 doctrine with chosen D-4 + D-5 values | Pending B-O-1 + B-O-3 |

### B.5 · Exit criteria
- D-4 export window sealed with explicit length (likely 30/60/90 days pending memo)
- D-5 TURN provider sealed with explicit vendor + contract-review evidence
- Phase 2 Rev 2 doctrine updated to reflect sealed values

### B.6 · Estimated duration
- Evidence closure: 2-3 weeks (vendor-response dependent)
- Legal review of DPA: 1-2 weeks
- Total Phase B: **3-5 weeks** · can run in parallel with final weeks of Phase A

---

## 5 · Build Phase C · F-3 production deployment (parallel-safe)

### C.0 · Goal
F-3 buyer-checkout price-trust fix deployed to Worldwide production.

### C.1 · Entry gates
- F-3 Ireland-preview preflight produced · ✅ 2026-11-09
- Vercel env-var preconditions verified by owner (preview project)
- Sandbox fixtures seeded if needed for Option C verification

### C.2 · Owner actions
| # | Action | Blocks |
|---|---|---|
| C-O-1 | Choose deploy option: A (full merge) · B (cherry-pick) · C (preview-first) | C-E-1 |
| C-O-2 | For Option C: verify preview-project env vars · seed fixtures if needed | C-E-1 |
| C-O-3 | Issue constitution §4-compliant authorisation naming repo · branch · commit · scope | C-E-1 |

### C.3 · Counsel actions
- None required for this phase

### C.4 · Engineer actions
| # | Action | Status |
|---|---|---|
| C-E-1 | On owner authorisation · execute chosen deploy option · report AFTER-state evidence | Pending C-O-3 |
| C-E-2 | If Option C · run 21 attack-path verification against preview URL · report results | Pending C-E-1 |
| C-E-3 | If Option C verification passes · produce Option A authorisation shape for subsequent full deploy | Pending C-E-2 |

### C.5 · Exit criteria
- F-3 code live on Worldwide production
- Attack-path tests confirmed green against production
- Phase 1 F-3 doctrine marked complete

### C.6 · Estimated duration
- Owner decision + authorisation: hours to days
- Option C deploy + verify: 1-2 hours
- Total Phase C: **1 week** · entirely parallel-safe

---

## 6 · Build Phase D · Phase 2 private chat implementation (12-16 weeks)

### D.0 · Goal
Device-only private chat architecture implemented in sandbox · verified against I-1..I-6 invariants · ready for independent audit.

### D.1 · Entry gates
- Build Phase A complete (legal memo · T&C + Privacy Policy reviewed)
- Build Phase B complete (D-4 + D-5 sealed)
- Explicit owner message: "begin Phase 2 implementation"

### D.2 · Owner actions
| # | Action | Blocks |
|---|---|---|
| D-O-1 | Explicit "begin Phase 2 implementation" message · constitution §4-compliant | D-E-1 |
| D-O-2 | Per-sprint authorisation gates (16 sprints · each explicit) | D-E-sprints |
| D-O-3 | Per-migration authorisation gates for every sandbox DB change | D-E-migrations |

### D.3 · Counsel actions
| # | Action | Scope |
|---|---|---|
| D-C-1 | Review historical deletion plan before S3+ sweep phases (I-4 safeguard) | D-E-sweep |
| D-C-2 | Confirm data-subject rights (GDPR Article 15/17/20) remain honoured under device-only model | D-E-architecture |

### D.4 · Engineer actions (16-sprint runbook · pending D-O-1)

Sprint plan (each sprint = ~1 week of sandbox engineering):

| Sprint | Scope | Verification |
|---|---|---|
| 1 | Device-registration + key-exchange primitives · `nex_device` table + public-key handoff | Unit tests · V-F2-T1 |
| 2 | Signalling envelope + TURN relay integration (D-5 provider) · 60-120s TTL · zero retention | Pcap verification V-NET-1 |
| 3 | WebRTC data-channel establishment · peer-to-peer happy path · offline-fallback honest status | Integration tests |
| 4 | Private message send path · plaintext NEVER leaves device · encrypted packet relay-only | V-NET-2 pcap · V-STORE-1 DB check |
| 5 | Private message receive path · decrypt device-local · deliver to IndexedDB · never server-persist | V-STORE-2 DB check |
| 6 | Attachment transmission · peer-to-peer data-channel · no server upload | V-STORE-3 bucket check |
| 7 | Business chat full-E2E · reuse peer-chat primitives · retire plaintext path | Integration tests |
| 8 | NEX Official + HQ Direct Channel on E2E identity model · no plaintext exception | V-SIG-1 |
| 9 | Device-local history + user-controlled export/backup | V-STORE-1 |
| 10 | Push notification redesign · content-free wake-up · no sensitive preview | V-F1-T5 |
| 11 | Historical sweep S0 · inventory · migration 300 (new schema prep) | V-DELETION-1 preview |
| 12 | Historical sweep S1-S2 · retire chat attachment bucket + migrate business assets · per I-4 phased gate | V-DELETION-1 |
| 13 | Historical sweep S3 · drop `nex_peer_message.body` · `nex_peer_message.ciphertext` · `nex_message.body` · per I-4 phased gate | V-DELETION-1 |
| 14 | Historical sweep S4-S5 · rollback checks · I-5 enforcement · V-SIG-1 full matrix | V-SIG-1 full |
| 15 | Historical sweep S6 · final deletion verification · V-LOG-1 end-to-end | V-LOG-1 |
| 16 | Phase 2 verification matrix full green · readiness for Phase F audit | All V-* green |

### D.5 · Exit criteria
- All 6 invariants I-1..I-6 verified in sandbox
- V-NET-1 · V-NET-2 · V-STORE-1 · V-STORE-2 · V-STORE-3 · V-LOG-1 · V-SIG-1 · V-TURN-1 · V-DELETION-1 all green
- §21 per-surface launch gates all PASS in sandbox
- Phase 2 Rev 2 doctrine checkmarks complete

### D.6 · Estimated duration
**12-16 weeks sandbox engineering** · as sealed in Phase 2 Rev 2 doctrine. Sprint 1-10 build the new architecture · Sprint 11-16 execute the historical sweep.

---

## 7 · Build Phase E · Phases 3-6 downstream remediation

### E.0 · Goal
Consolidated roadmap Phases 3-6 complete (billing/checkout/rate-limit/peer-message/theme-UI/order-separation/HTTP tests/Playwright journeys/performance/mobile/a11y).

### E.1 · Entry gates
- Build Phase D complete (Phase 2 verified in sandbox)
- Explicit owner message: "begin Phase 3 downstream remediation"

### E.2 · Owner actions
| # | Action | Blocks |
|---|---|---|
| E-O-1 | Per-priority authorisation per 12-step remediation order | E-E-sprints |
| E-O-2 | Stripe production readiness · webhook secret · platform approval | E-E-stripe |

### E.3 · Engineer actions
Per consolidated roadmap 12-step order:
1. Chat privacy P0 (merged into Phase D)
2. Billing-table RLS before mig 258 apply · ✅ mig 312 applied 2026-11-09
3. Buyer checkout server-side price validation · ✅ F-3 fixed · pending Phase C deploy
4. Peer-message RLS mig 218
5. Rate-limit mig 290 · ✅ applied 2026-11-09
6. Theme + buyer UI wiring
7. Path A order separation
8. HTTP route tests
9. 10 Playwright journeys
10. Performance + mobile + a11y
11. Legal + Stripe readiness
12. Full re-audit

### E.4 · Exit criteria
- All 12 remediation priorities closed
- Sandbox Playwright matrix 10/10 passing
- Lighthouse scores above owner-sealed thresholds
- Stripe live-mode webhook verified

### E.5 · Estimated duration
**6-10 weeks sandbox engineering**

---

## 8 · Build Phase F · Independent privacy audit

### F.0 · Goal
Independent third-party privacy auditor verifies State C across every applicable surface per sealed invariant I-6.

### F.1 · Entry gates
- Build Phase D complete (Phase 2 verified)
- Build Phase E complete (downstream remediation complete)
- Independent audit scope-of-work produced · ✅ 2026-11-09 (companion to this doctrine)

### F.2 · Owner actions
| # | Action | Blocks |
|---|---|---|
| F-O-1 | Designate independent privacy auditor (independent of NEX engineering team · reputable firm or consultant) | F-A-1 |
| F-O-2 | Engage auditor on fixed-scope contract covering the SoW | F-A-1 |
| F-O-3 | Provide auditor with evidence access per SoW scope (network capture facility · DB read-only access · log retention · code repo read access · processor DPA bundle) | F-A-1 |

### F.3 · Counsel actions
| # | Action | Scope |
|---|---|---|
| F-C-1 | Review auditor SoW + independence declarations | F-A-1 |
| F-C-2 | Legal review of auditor's final report before public claims | Public launch gate |

### F.4 · Engineer actions
| # | Action | Status |
|---|---|---|
| F-E-1 | Produce audit scope-of-work doctrine | ✅ 2026-11-09 (companion) |
| F-E-2 | Prepare audit evidence package (V-NET-1/2 pcap · V-STORE-1/2/3 DB dumps · V-LOG-1 logs · V-SIG-1 matrix · V-TURN-1 provider evidence · V-DELETION-1 sweep logs) for auditor | Pending D + E complete |
| F-E-3 | Respond to auditor findings · implement fixes · re-verify | Pending auditor report |

### F.5 · Auditor actions
| # | Action | Scope |
|---|---|---|
| F-A-1 | Execute audit per SoW · verify every §19 evidence point · verify §21 per-surface launch gates · verify §16 three-state framework claim | Full scope |
| F-A-2 | Produce signed audit report with explicit State C claim (or State B/A with remediation list) | Report |
| F-A-3 | Confirm any remediations closed before re-verifying | Re-audit |

### F.6 · Exit criteria
- Auditor report signed · State C confirmed across every §21 surface
- All findings closed
- Independence declaration on file

### F.7 · Estimated duration
- Auditor engagement: 2-4 weeks
- Audit execution: 4-8 weeks
- Remediation (if any): 2-6 weeks
- Total Phase F: **8-18 weeks**

---

## 9 · Build Phase G · Business storage (Phase 7) · if authorised

### G.0 · Goal
Conditional: if owner lifts the "not before Phase 2 resolves" seal · design and build business-asset storage for public business videos / products / menus / etc. (distinct from private chat).

### G.1 · Entry gates
- Build Phase D complete (owner-sealed prerequisite)
- Explicit owner message: "begin Phase 7 business storage"

### G.2 · Owner actions
- G-O-1 · Explicit "begin Phase 7" message
- G-O-2 · Business-storage scope definition (public assets only · not chat)

### G.3 · Engineer actions
- G-E-1 · Design sealed bucket `nex-business-public-assets` schema + lifecycle policies
- G-E-2 · CDN layer design (if required for performance)
- G-E-3 · Transcoding pipeline design (if video support needed)
- G-E-4 · Cost forecast at 50k/100k user scale

### G.4 · Exit criteria
- Business-asset storage live and verified
- Cost monitored against forecast

### G.5 · Estimated duration
**4-8 weeks sandbox engineering** · parallel-safe with Phase H

---

## 10 · Build Phase H · Public launch

### H.0 · Goal
Make the sealed launch claim · open NEX to the public across Ireland · Indonesia · Worldwide.

### H.1 · Entry gates
- Build Phase A complete · T&C + Privacy Policy published with final texts
- Build Phase B complete · D-4 + D-5 sealed
- Build Phase C complete · F-3 live in production
- Build Phase D complete · Phase 2 architecture verified in sandbox and promoted to production per sealed launch-gate matrix
- Build Phase E complete · downstream remediation verified in production
- Build Phase F complete · independent auditor report signed · State C confirmed

### H.2 · Owner actions
- H-O-1 · Review audit report + sign off on launch
- H-O-2 · Issue the launch · Marketing · announcement timing
- H-O-3 · Monitor post-launch incident surface for first 90 days
- H-O-4 · Explicit constitution §4-compliant authorisation for every production migration · every Vercel deploy · every Stripe live-mode step on the critical path to launch

### H.3 · Counsel actions
- H-C-1 · Final review of public launch marketing against T&C + Privacy Policy
- H-C-2 · Confirm all regulatory registrations complete (Kominfo if applicable · Irish Revenue · HMRC · etc.)

### H.4 · Engineer actions
- H-E-1 · Production migration apply (promotion from sandbox) per I-4 phased gates
- H-E-2 · Production deploy of Phase 2 architecture
- H-E-3 · Incident-response readiness · HQ Alerts realtime + polling verified
- H-E-4 · Monitoring dashboards verified · error budget defined

### H.5 · Auditor actions
- H-A-1 · Post-launch spot verification at 30/60/90 days to confirm no regression

### H.6 · Exit criteria
- NEX publicly available
- No P0 incidents in 90-day post-launch window
- Sealed launch claim honoured in practice

### H.7 · Estimated duration
- Launch itself: a day
- 90-day stabilisation: 3 months

---

## 11 · Total critical-path timeline estimate

| Phase | Weeks | Cumulative weeks |
|---|---|---|
| A · Legal foundation | 5-10 | 5-10 |
| B · D-4 + D-5 sealing | 3-5 (parallel with A end) | 8-13 (max) |
| D · Phase 2 implementation | 12-16 | 20-29 |
| E · Phases 3-6 remediation | 6-10 (can partially parallel D) | 26-39 |
| F · Independent audit | 8-18 | 34-57 |
| H · Public launch | 1 (launch) + 12 (stabilisation) | 35-70 |

**Parallel-safe:**
- C (F-3 deploy) · anytime
- G (business storage) · after D only if authorised

**Net critical-path estimate: 35-70 weeks (roughly 8-18 months) from 2026-11-09 to public launch.**

This is an engineering + legal + audit estimate · not a commitment. Owner decides pace via per-phase authorisation gates.

---

## 12 · What this document authorises

Zero authorisations. This is a planning doctrine.

- No production actions
- No code changes
- No migrations
- No deploys
- No engagements (legal · audit · TURN provider)
- No public claims

Every Build Phase entry requires its own explicit owner authorisation per constitution §4 + §5.

---

## 13 · What this document does NOT do

- Does NOT replace Phase 2 Rev 2 doctrine (that doctrine remains the Phase 2 architecture specification · this plan phases its implementation)
- Does NOT replace the consolidated roadmap (that doctrine remains the Phases 3-6 technical spec · this plan phases its implementation)
- Does NOT replace the T&C or Privacy Policy drafts (those remain the legal source texts · this plan phases their review-and-publish cycle)
- Does NOT make legal decisions
- Does NOT select the TURN provider
- Does NOT authorise the independent auditor engagement

---

## 14 · What is produced right now in this build-plan session

### Engineer deliverables (within gates · delivered 2026-11-09)

1. **This phased-build-plan doctrine** · `docs/doctrine/nex-eight-workstream-phased-build-plan-2026-11-09.md`
2. **Solicitor briefing pack** · `docs/doctrine/nex-solicitor-briefing-pack-2026-11-09.md` · Build Phase A handoff · counsel can start Phase A review from a complete package
3. **Independent audit scope-of-work** · `docs/doctrine/nex-independent-audit-scope-of-work-2026-11-09.md` · Build Phase F handoff · auditor can be engaged from a complete scope

### Deliverables ready from prior sessions

4. T&C draft · `docs/doctrine/nex-terms-and-conditions-draft-2026-11-09.md`
5. Privacy Policy draft · `docs/doctrine/nex-privacy-policy-draft-2026-11-09.md`
6. D-5 TURN comparison · `docs/doctrine/nex-d5-turn-provider-comparison-2026-11-09.md`
7. F-3 Ireland-preview preflight · `docs/doctrine/nex-f3-ireland-preview-deploy-preflight-2026-11-09.md`
8. Phase 2 Rev 2 doctrine · `docs/doctrine/nex-chat-device-only-remediation-plan-2026-11-09.md`
9. Consolidated roadmap · prior session

### Deliverables deferred (require Phase A or Phase B close first)

- D-4 owner decision briefing · cannot be produced until A-C-3 L-1..L-6 memo delivered
- Phase 2 sprint-by-sprint detailed engineering runbook · cannot be fully produced until D-5 TURN provider sealed (affects Sprint 2 architecture)
- Phase 7 business storage design · deferred per owner seal

---

**End of 8-workstream phased build plan.**

The plan orders the remaining 8 workstreams by dependency · identifies which lanes (owner · counsel · engineer · auditor) own each action · and makes explicit what can be built now (produced this turn) versus what requires owner/counsel action to unblock.

Awaiting owner direction on Build Phase A (engage solicitor + supply six facts) and Build Phase C (F-3 deploy option selection) as the two phases that can start immediately with owner action only.
