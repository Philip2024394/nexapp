# NEX Phase 6 · Launch Approval Gate · Final Review Checklist
### 2026-11-09

**Author:** Claude Opus 4.7 · operating under owner's "continue until all are fully built working" directive · documentation-only research deliverable.
**Scope:** cross-phase final-review checklist. Confirms every prior phase has reached its exit criteria before owner publishes the launch-principle statement.
**Status:** Research deliverable (the checklist itself). **The review is executed once by the owner after Phases 1-5 complete. This document is the checklist, not the review.**

**Related doctrines:**
- `docs/doctrine/nex-chat-device-only-remediation-plan-2026-11-09.md` Rev 2
- `docs/doctrine/nex-chat-historical-data-inventory-2026-11-09.md`
- `docs/doctrine/phase-1-production-security-plan-2026-11-09.md`
- `docs/doctrine/phase-3-customer-journey-matrix-2026-11-09.md`
- `docs/doctrine/phase-4-performance-baseline-plan-2026-11-09.md`
- `docs/doctrine/phase-5-independent-audit-scope-2026-11-09.md`

---

## 0 · The question Phase 6 answers

**Can the launch principle be published publicly?**

> *"NEX does not keep a copy of your private conversations. Your conversations belong to you and remain on your devices."*

The answer is YES only if **every** item in this checklist has a dated sign-off. Any item in failed or incomplete state ⇒ answer is NO.

Per sealed invariant **I-6**, the claim is atomic across every applicable surface. Partial compliance is not partial launch; it is no launch.

---

## 1 · Pre-conditions checklist

### 1.1 Phase 1 · Production security

| Check | Evidence required | Status |
|---|---|---|
| F-1 · Mig 312 applied to production · RLS enforced on 3 billing tables | V-F1-T6 passed on production | ⏸ G2 pending |
| F-2 · Mig 290 applied to production · rate-limit active | V-F2-T1..T5 passed on production | ⏸ G3 pending |
| F-3 · Buyer checkout price-trust code deployed | V-F3-T2 on production Stripe test mode | ⏸ G4 pending |
| No Phase 1 regression | Full billing test suite green on production baseline | ⏸ gate dependent |

### 1.2 Phase 2 · Device-only chat architecture

| Check | Evidence required | Status |
|---|---|---|
| All 8 Interp-1 rules observed by implementation | Rev 2 §1 compliance audit | ⏸ Phase 2 B pending |
| All 6 absolute invariants (I-1..I-6) enforceable | Code review + migration-tool CHECK verification | ⏸ Phase 2 B pending |
| Four sealed directions implemented | Business-assets migrated · NEX Assistant deferred · content tables dropped · chat excluded from early launch | ⏸ Phase 2 B pending |
| Public bucket `nex-peer-chat-attachments` retired | V-STORE-2 confirms zero new chat-prefix writes | ⏸ Phase 2 B + S-phases pending |
| Historical sweep complete (S0-S6) | V-DELETION-1 zero-rows + zero-objects | ⏸ owner per-phase authorisation pending |
| Per-surface launch gates all passed | §21.1-21.6 checklists all green | ⏸ Phase 2 B pending |
| mig 295 NOT applied to production | Inventory confirms absence | ✅ Confirmed per 2026-11-09 inventory |
| mig 218 either skipped or applied | Owner decision + evidence | ⏸ owner decision pending |

### 1.3 Phase 3 · Customer journeys

| Check | Evidence required | Status |
|---|---|---|
| 10 journeys (A-J) authored + green | Playwright suite passing in CI | ⏸ Phase 3 B pending |
| Attack-path assertions pass | F-3 price-trust + RLS + cross-business + status gates | ⏸ Phase 3 B pending |
| Journey E Path A order creation verified | `nex_order` + `nex_order_item` correct | ⏸ Phase 3 B pending |
| Journey I entitlement transitions correct | Stripe webhook → `nex_billing_adverse_event` → entitlement | ⏸ Phase 3 B pending |
| Journey J HQ privacy preserved | V-STORE-1 confirms no HQ message body persisted | ⏸ Phase 3 B pending |

### 1.4 Phase 4 · Performance · mobile · load

| Check | Evidence required | Status |
|---|---|---|
| Web-vitals targets met p75 field | Dashboard shows p75 LCP < 2.5s · INP < 200ms · CLS < 0.1 | ⏸ Phase 4 B pending |
| Lighthouse mobile ≥ 85 · desktop ≥ 95 | Lighthouse CI report | ⏸ Phase 4 B pending |
| NEX-specific targets met | WebRTC handshake p75 · attachment transfer · SSR times | ⏸ Phase 4 B pending |
| 115-route viewport sweep | Baseline captured · no regression | ⏸ Phase 4 B pending |
| Country-aware sweep (Ireland/Indonesia/Worldwide) | No country-content leakage | ⏸ Phase 4 B pending |
| k6 load scenarios L-1..L-6 | All pass criteria met · staging environment | ⏸ Phase 4 B pending |
| Mobile device matrix | iOS 16+ · Android 11+ · Lighthouse low-end | ⏸ Phase 4 B pending |
| A11y audit | WCAG 2.1 AA passed across launch surface | ⏸ Phase 4 B pending |
| Battery soak test | < 2%/hour at rest | ⏸ Phase 4 B pending |

### 1.5 Phase 5 · Independent privacy audit

| Check | Evidence required | Status |
|---|---|---|
| Auditor selected + SOW signed | Owner records | ⏸ Phase 5 pending |
| V-NET-1/2 · signed report | Auditor artefact | ⏸ Phase 5 pending |
| V-STORE-1/2/3 · signed report | Auditor artefact | ⏸ Phase 5 pending |
| V-LOG-1 · signed report | Auditor artefact | ⏸ Phase 5 pending |
| V-SIG-1 · signed report | Auditor artefact | ⏸ Phase 5 pending |
| V-TURN-1 · signed report | Auditor + contract review | ⏸ Phase 5 pending |
| V-DELETION-1 · signed report | Auditor post-sweep | ⏸ Phase 5 pending |
| Executive summary · pass or conditional-pass | Auditor overall recommendation | ⏸ Phase 5 pending |
| Any flagged item remediated + re-audited | Delta report | ⏸ Phase 5 pending |

### 1.6 Non-phase · legal + business compliance

| Check | Evidence required | Status |
|---|---|---|
| L-1 · GDPR disclosure requirements met | Legal memo | ⏸ Owner-designated advisor |
| L-2 · Regional retention regulations | Legal memo | ⏸ Owner-designated advisor |
| L-3 · No active legal holds blocking | Legal check | ⏸ Owner-designated advisor |
| L-4 · Marketing-compliance review of launch-principle statement | Advertising-standards review | ⏸ Owner-designated advisor |
| L-5 · TURN provider DPA | Contract review | ⏸ Pending D-5 provider selection |
| L-6 · Historical export endpoint DSR-compliance | GDPR Art 12 identity verification | ⏸ Owner-designated advisor |
| Stripe platform approval · live-mode Connect | Stripe-side acceptance | ⏸ Separate owner workstream |
| Terms of Service + Privacy Policy updated to match device-only architecture | Published policy pages | ⏸ Owner + legal |
| 6 owner facts (legal entity · country · address · company number · VAT · support email) supplied | Operator-side form | ⏸ Owner |

### 1.7 Operational readiness

| Check | Evidence required | Status |
|---|---|---|
| Production monitoring + alerting wired for Phase 2 new surfaces | HQ Alerts + health dashboards | ⏸ Phase 2 B dependent |
| Incident-response playbook updated for Interp-1 architecture | Runbook | ⏸ Operational workstream |
| TURN provider capacity contracted for expected traffic | Provider confirmation | ⏸ D-5 dependent |
| Stripe live-mode webhook secret configured on production | Secret present + Stripe-side acknowledged | ⏸ Separate owner gate |
| Vercel production environment configured for Phase 2 | Env vars + deployment settings | ⏸ Phase 2 B dependent |
| Rollback procedure dry-run executed | Rollback drill artefact | ⏸ Phase 2 B dependent |

---

## 2 · The sign-off meeting

### 2.1 Required attendees

- Owner (final decision maker)
- Implementation lead (reports status per phase)
- Independent auditor (presents Phase 5 artefacts · can attend remotely)
- Legal advisor (confirms L-1..L-6)
- Operations lead (confirms §1.7)

### 2.2 Agenda (sealed · ~90 min)

1. 5 min · Opening · owner reviews this checklist
2. 10 min · Phase 1 status walkthrough
3. 20 min · Phase 2 status walkthrough + per-surface §21 gates
4. 10 min · Phase 3 + Phase 4 status
5. 15 min · Phase 5 auditor presentation
6. 10 min · Legal + operational readiness
7. 10 min · Owner decision + sealing
8. 10 min · Launch-principle publication plan if GO

### 2.3 Decision gate

Owner decision options:
- **GO** · all items green · launch principle may be published · set public launch date
- **CONDITIONAL GO** · 1-2 non-critical items amber · publish with scoped caveat · remediate parallel
- **NO-GO · defer** · critical items red · set re-review date · continue remediation
- **NO-GO · abort** · systemic issues · trigger scope rethink

### 2.4 Sealing

If GO: owner publishes the launch-principle statement on NEX marketing surfaces. Simultaneously:
- Terms of Service + Privacy Policy go live with the device-only wording
- `/nex-native/*` surfaces may surface the principle in app UX (e.g. welcome screen chip, settings page copy)
- Press / investor communications may use the principle

Memory-seal the launch-approved state: `project_nex_launch_approved_YYYY_MM_DD.md`.

---

## 3 · Rollback plan

If a critical issue emerges within 30 days of public launch that contradicts the launch principle (e.g. a server-side chat content leak is discovered), the rollback is:

1. **Within 60 minutes** · put a banner on NEX surfaces stating "privacy issue under investigation" (honest communication over silence)
2. **Within 24 hours** · retract the launch-principle statement from marketing + policy pages
3. **Within 72 hours** · full post-mortem + remediation plan published to users
4. **Within 7 days** · remediated architecture or additional audit sign-off

Per I-5 · a rollback must NEVER restore server-side private content storage. The rollback is in marketing language + retraction, not in reinstating a non-compliant architecture.

---

## 4 · What this document does + does NOT do

### Does
- Catalogue every exit-criterion item across Phases 1-5 + legal + operational
- Define the sign-off meeting structure
- Define the decision gate options
- Define the public-retraction rollback if post-launch issue

### Does NOT
- Perform the review (that happens once · when Phases 1-5 complete)
- Authorise publication of the launch principle (that requires every item green + owner signature)
- Guarantee a GO decision (that depends on the evidence actually meeting the criteria)
- Commit NEX to any specific launch date (that's owner's call)

---

**End of Phase 6 research deliverable.**
