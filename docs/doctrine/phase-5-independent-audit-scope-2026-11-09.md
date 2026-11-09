# NEX Phase 5 · Independent Privacy Audit · Scope + Engagement Plan
### 2026-11-09

**Author:** Claude Opus 4.7 · operating under owner's "continue until all are fully built working" directive · documentation-only research deliverable.
**Scope:** auditor selection criteria, scope-of-engagement contract, evidence list the auditor will inspect, engagement model, cost/duration estimates.
**Status:** Research deliverable. **No auditor engaged · no contract signed · no evidence gathered.** Phase 5 implementation requires:
- Phase 2 (device-only chat) built + verified + state B reached across all surfaces
- Historical sweep (§17.3 S5) complete
- Owner-selected auditor
- Signed statement of work

**Related doctrines:**
- `docs/doctrine/nex-chat-device-only-remediation-plan-2026-11-09.md` Rev 2 §19
- `docs/doctrine/phase-3-customer-journey-matrix-2026-11-09.md`
- `docs/doctrine/phase-4-performance-baseline-plan-2026-11-09.md`

---

## 0 · Why Phase 5 exists

Sealed invariant **I-6** (2026-11-09): *"No public device-only-privacy claim until State C is independently verified across every applicable surface in §21."*

State C is reached only when an independent reviewer (not the implementing team · not a direct report) signs off that the deletion of historical content is complete AND the compliant architecture holds under live conditions.

Phase 5 produces the State-C evidence artefacts. Without Phase 5, the launch-principle statement (*"NEX does not keep a copy of your private conversations"*) is unpublishable.

---

## 1 · Auditor selection criteria

### 1.1 Must-have qualifications

- Independent third party · NOT NEX staff · NOT contractor engaged on Phase 2 implementation
- Documented track record in messaging-app privacy audits (Signal · Wire · Element · similar)
- Experience with WebRTC + E2E encryption review
- Supabase / PostgreSQL competence (RLS verification · bucket audit)
- Stripe / payment-system competence (billing-table + webhook integrity)
- Capable of signing a legally-binding statement attesting to findings
- GDPR + regional data-protection competence

### 1.2 Candidate firms (owner-selected · listed as directional only · not endorsements)

| Firm | Strengths |
|---|---|
| Trail of Bits | Cryptographic protocols · smart-contract + app audits · published WebRTC analyses |
| Cure53 | Browser-based crypto · messaging-app history (e.g. ProtonMail audit) |
| NCC Group | Large-scale system audits · GDPR competence · European presence |
| Quarkslab | Mobile + WebRTC protocol audits · EU-based |
| Independent security researcher | Lower cost · depends on individual track record |

### 1.3 Non-acceptable

- TURN provider or Supabase itself (conflict of interest · they're components under audit)
- Any firm with equity relationship to NEX
- Any firm NEX is otherwise contracted with (consulting · implementation)

---

## 2 · Scope of engagement (statement of work)

### 2.1 Primary deliverable

A dated, signed audit report attesting to **state C** across every applicable surface per §21 of the Rev 2 doctrine:

1. Peer chat
2. Business chat
3. NEX Official
4. HQ Direct Channel
5. Attachments
6. Vault (relative to Phase 2 chat scope)

### 2.2 Verification scope

The 9 V- checks from Rev 2 §19:

| ID | Verification | Audit activity |
|---|---|---|
| **V-NET-1** | Network traffic review | Auditor captures packets at NEX ingress + egress during live test journeys · inspects for message body bytes or attachment ciphertext · expected zero |
| **V-NET-2** | TURN relay traffic review | Auditor captures TURN traffic + inspects persistence between sessions · expected zero bytes retained |
| **V-STORE-1** | Supabase DB scan under load | Auditor runs service-role scan of `nex_peer_message`, `nex_message` + message-adjacent tables during live Playwright journey · inspects for any content row |
| **V-STORE-2** | Bucket scan under load | Auditor lists Supabase Storage buckets during live sessions · inspects for chat-prefix objects created during test |
| **V-STORE-3** | External storage audit | Auditor reviews CDN · reverse-proxy · log-sink configuration for any cache of chat content |
| **V-LOG-1** | Server log audit | Auditor inspects server access logs for message content · attachment bytes · SDP/ICE content · ciphertext · expected zero |
| **V-SIG-1** | Signaling retention audit | Auditor queries `nex_signaling_envelope` at several points under load · verifies TTL enforcement · verifies no signaling content persists past window |
| **V-TURN-1** | TURN provider terms audit | Auditor reviews DPA with chosen TURN provider · confirms zero packet persistence + zero SDP/ICE logging |
| **V-DELETION-1** | Historical sweep verification | Auditor confirms zero rows + objects from pre-cutover era remain · verifies sweep audit trail |

### 2.3 Deliverable artefacts

The auditor produces:

- **Signed report** · one per verification ID · dated · scope · method · result · residual risk notes
- **Executive summary** · pass / conditional-pass / fail per surface · overall recommendation
- **Technical appendix** · captured packets · DB scan output · log excerpts
- **Retention** · artefacts stored with NEX + auditor · 7 years (standard audit retention)

### 2.4 What the audit does NOT cover

- Pre-Phase-2 architecture (that's being retired · auditing it would be wasted effort)
- Phase 1 security fixes (those are code-level · covered by NEX's own test suite + the auditor's pass through them as part of V-STORE-1)
- Performance / UX (that's Phase 4)
- Code quality / maintainability (not launch-blocking)
- Mobile battery / data consumption (that's Phase 4)
- Legal compliance (that's a parallel legal review per L-1..L-6)

---

## 3 · Engagement model

### 3.1 Duration

Typical privacy audit of this scope: **3-6 weeks calendar · 2-4 weeks of auditor time**. Driven by:
- 1 week · scope review + kickoff
- 1-2 weeks · live testing + evidence gathering
- 1-2 weeks · report writing + review cycle
- 1 week · remediation of any flagged items + re-audit if needed

### 3.2 Cost estimate (owner-approved budget pending)

Independent audit at this scope typically **€25k–€60k EUR** (varies by firm + depth). Individual-researcher model could be €10k-€20k. Not NEX-side commitment · owner authorises before signing SOW.

### 3.3 Access the auditor needs

- Read-only Supabase service-role credentials to a dedicated audit project (NOT production direct · a cloned snapshot of production)
- NEX staging environment URL + sign-in credentials for test accounts
- Source-code access (read-only GitHub)
- TURN provider contract access for V-TURN-1
- Supabase + Vercel + CDN config access for V-STORE-3
- NEX contact for questions during audit (1 engineer, 2-4 hours/week)

### 3.4 What NEX supplies before kickoff

- Phase 2 verified in sandbox + staging
- Phase 3 journey suite running green
- Historical sweep (S5) complete · V-DELETION-1 self-verified before auditor arrives
- Rev 2 doctrine + inventory + per-phase deliverables (all committed per Phase 2 doctrine commit)
- TURN provider contract + DPA

---

## 4 · Timing within Phase 5

```
Phase 2 ships + V-STORE-1/2 self-verified
   ↓
Phase 3 journeys green
   ↓
Historical sweep S5 executed + V-DELETION-1 self-verified
   ↓
Owner selects auditor + signs SOW
   ↓
Auditor kickoff · week 1
   ↓
Live testing · weeks 2-3
   ↓
Report writing · weeks 4-5
   ↓
Remediation (if any) · week 6
   ↓
Signed artefacts delivered
   ↓
State C reached
   ↓
Phase 6 · Launch approval gate
```

---

## 5 · Blockers currently preventing Phase 5 B

| Blocker | Owner-side action |
|---|---|
| Phase 2 not shipped | 12-16 weeks engineering · requires D-1..D-6 + legal + TURN |
| Historical sweep not executed | I-4 requires separate per-phase owner authorisation |
| TURN provider not selected | D-5 pending · gates V-TURN-1 scope |
| Auditor not selected | Owner must choose from §1.2 (or other) |
| SOW not drafted | Typically auditor drafts · NEX reviews |
| Budget not approved | §3.2 pending owner decision |

---

## 6 · What this document does + does NOT do

### Does
- Define auditor qualifications
- List candidate firms (directional only)
- Define verification scope (V-1..V-9)
- Define deliverable artefacts
- Estimate duration + cost
- Identify blockers

### Does NOT
- Engage any auditor
- Draft any contract
- Pay any invoice
- Authorise Phase 5 B (requires Phase 2 verified + owner-selected auditor + signed SOW)
- Guarantee state C will be reached (that depends on implementation quality, not on this plan)

---

**End of Phase 5 research deliverable.**
