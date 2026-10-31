# NEX · Country Programme · Decision Reconciliation Ledger · 2026-10-31

**Status**: pre-revision ledger. Owner-mandated step before any edit to the plan.
**Rule**: this doc records the exact question each `RV-A*` item posed and the current status. The owner has answered RV-A3, RV-A5, RV-A8. The other six remain OPEN. **No defaults are being invented** for the open items.

Source: owner's "NEX COUNTRY PROGRAMME — OWNER DECISIONS AFTER REVIEW 6307458" instruction.

---

## 1 · Full RV-A ledger

### RV-A1 · Preview DB isolation

**Exact question posed by review `6307458` §8**: *"Area 1 Preview DB isolation · verdict FAIL + recommended `G-PREVIEW-ISOLATION` gate · approve / defer"*

**Owner decision**: *Not explicitly answered as RV-A1, but the "OTHER REQUIRED CORRECTIONS" list in the instruction says corrections 1-7 are required. Correction #1 is "G-PREVIEW-ISOLATION with measurable acceptance tests". Treat RV-A1 as implicitly approved via the corrections list.*

**Status**: **APPROVED (via corrections list)** · implement `G-PREVIEW-ISOLATION` with measurable acceptance tests in the plan.

---

### RV-A2 · SET LOCAL · error + rollback tests

**Exact question posed**: *"Area 2 SET LOCAL · PARTIAL PASS · recommended error-path + explicit ROLLBACK tests · approve / modify"*

**Owner decision**: Correction #2 in "OTHER REQUIRED CORRECTIONS" is *"SET LOCAL connection-pooling tests covering errors, explicit ROLLBACK and connection reuse"* — required.

**Status**: **APPROVED (via corrections list)** · add error-path + explicit-ROLLBACK + connection-reuse tests to §4.5 and to the shadow-test matrix.

---

### RV-A3 · Migration 245 recovery design

**Exact question posed**: *"Area 3 Migration 245 · FAIL · recommended pre-245 strict-deny swap + 245b template · critical · approve / propose alternative"*

**Owner decision (verbatim from instruction)**:
> *"REJECT the current rollback design if it restores USING(true). Redesign the recovery architecture. Investigate: A known restrictive pre-245 policy state · A forward-fix recovery migration · Tested recovery on a production-like database · Fail-closed behaviour without unexpectedly locking out existing Indonesian users · Recovery evidence proving no wider access is granted · Do not assume a strict-deny policy swap is safe. Demonstrate compatibility with both deployments before proposing it. Migration 245 remains BLOCKED until the owner approves the revised design and evidence."*

**Status**: **CURRENT DESIGN REJECTED · REDESIGN REQUIRED · 245 remains BLOCKED**.

**Explicit constraints for the redesign**:
- No `USING(true)` restoration.
- Must NOT assume strict-deny swap is safe.
- Must demonstrate compatibility with BOTH deployments before proposing.
- Must include a forward-fix recovery migration.
- Must prove recovery on a production-like database.
- Must prove recovery grants no wider access than intended.

The redesign proposal is produced as part of this round. **Owner approval of the redesign is a separate decision**, not granted by this instruction.

---

### RV-A4 · Storage isolation acceptance tests + signed-URL policy

**Exact question posed**: *"Area 4 Storage · PARTIAL PASS · recommended inline acceptance tests + old-URL policy · approve / defer"*

**Owner decision**: Corrections #4 and #5 in "OTHER REQUIRED CORRECTIONS" are *"Storage cross-country denial acceptance tests"* and *"Explicit old signed-URL handling and revocation/expiry policy"* — both required.

**Status**: **APPROVED (via corrections list)** · add inline acceptance tests + define old-signed-URL policy explicitly.

---

### RV-A5 · Indonesia dark-mode window

**Exact question posed**: *"Area 5 Indonesia protection · FAIL · recommended stage reorder OR hot-patch OR delay-245 · critical · pick Option A/B/C or alternative"*

**Owner decision (verbatim)**:
> *"APPROVED: Option C. Delay Migration 245 until BOTH Ireland and Indonesia are ready to operate using the deployment-based identity resolver and verified country-context middleware. Ireland may proceed through isolated development and preview stages, subject to preview database isolation. Do not apply Migration 245 while the existing Indonesia deployment lacks the required country-context mechanism. Do not hot-patch the existing Indonesia production deployment merely to accelerate Ireland. Before any production cutover, prove that existing Indonesian users, accounts, sessions, WebAuthn credentials, businesses, content and storage remain accessible."*

**Status**: **DECIDED · OPTION C APPROVED**.

**Hard rules established by this decision**:
- Migration 245 is NOT APPLIED while the current pre-two-apps Indonesia deployment is live.
- No hot-patch to the existing Indonesia deployment.
- Both Ireland AND Indonesia must be on the new deployment-based identity resolver before 245 is applied.
- Indonesia continuity must be PROVEN (sign-in · WebAuthn · businesses · content · storage) before any production cutover.

---

### RV-A6 · HQ "bypass vs isolation" clarification

**Exact question posed**: *"Check 2.5 HQ 'bypass' ambiguity · clarify HQ is DESIGN-bypass (approve) OR require per-country HQ gating · pick"*

Addressed by RV-A8 below. The owner's answer in the instruction is explicit: *"controlled global moderation is allowed, uncontrolled global data access is not"*.

**Status**: **RESOLVED (incorporated into RV-A8)**.

---

### RV-A7 · Rollback-permissive-restore (tied to RV-A3)

**Exact question posed**: *"Check 2.6 rollback-permissive-restore · FAIL on current plan · tie to RV-A3 fix · tie-to-A3 / modify"*

Explicitly tied to RV-A3 above.

**Status**: **RESOLVED by RV-A3 decision** · redesign required · 245 BLOCKED until redesign approved.

---

### RV-A8 · HQ privileged moderation vs ordinary admin

**Exact question posed**: *"Review's HQ bypass vs owner safeguard · clarify design-bypass with audit vs per-country HQ gating · pick"*

**Owner decision (verbatim)**:
> *"Controlled global moderation is permitted in principle. Unrestricted global data access by ordinary HQ users is not. Design: Explicit privileged moderation permissions · Server-side authorisation · Narrowly scoped operations · Country and resource scope · Mandatory audit records · Reason for access/action · No general service-role credential exposure to browser clients · Separation between normal HQ administration and privileged cross-country moderation."*

**Status**: **DECIDED · CONTROLLED GLOBAL MODERATION APPROVED IN PRINCIPLE · DESIGN WORK REQUIRED**.

**Hard rules established**:
- Ordinary HQ admin ≠ privileged cross-country moderation.
- Every privileged action: scoped, logged, reason recorded, country tagged, resource identified.
- Service-role credential never in browser clients.
- Server-side-only invocation.
- Audit records are mandatory, not optional.

---

### RV-A9 · U-4 preview DB target becomes early-blocking

**Exact question posed**: *"U-4 should become blocking for preview, not downstream · move it earlier in the gate matrix · approve / defer"*

**Owner decision**: Implied by RV-A1 approval via the corrections list — G-PREVIEW-ISOLATION needs a measurable test, which in turn forces U-4 (preview DB target) to be answered before that gate can be measured. Not explicitly answered as RV-A9.

**Status**: **IMPLICITLY APPROVED via RV-A1** · U-4 becomes early-blocking. U-4 itself remains an open owner decision (sandbox project vs other mechanism) but it must be answered before `G-PREVIEW-ISOLATION` is accepted.

---

## 2 · Status summary

| RV | Status | Blocks |
|---|---|---|
| RV-A1 | Approved via corrections list | Add G-PREVIEW-ISOLATION gate |
| RV-A2 | Approved via corrections list | Extend §4.5 + shadow-test matrix |
| RV-A3 | **Current design REJECTED · redesign required** | Migration 245 remains BLOCKED |
| RV-A4 | Approved via corrections list | Add storage acceptance tests + signed-URL policy |
| RV-A5 | **DECIDED · Option C approved** | Reorder stages · delay 245 |
| RV-A6 | Resolved via RV-A8 | — |
| RV-A7 | Resolved by RV-A3 | — |
| RV-A8 | **DECIDED · design controlled moderation** | Rewrite §8 HQ section |
| RV-A9 | Implicitly approved via RV-A1 | U-4 (preview DB target) must be answered before G-PREVIEW-ISOLATION |

### Owner decisions that are now hard rules

1. (RV-A5) Migration 245 does NOT apply while the current pre-two-apps Indonesia deployment lacks SET LOCAL middleware.
2. (RV-A5) NO hot-patch to the existing Indonesia deployment.
3. (RV-A5) Both deployments must be on the new resolver + middleware BEFORE 245.
4. (RV-A5) Indonesia continuity proven before any production cutover.
5. (RV-A3) No `USING(true)` restoration anywhere in rollback path.
6. (RV-A3) Strict-deny swap NOT assumed safe · must prove compatibility.
7. (RV-A3) Forward-fix recovery migration required.
8. (RV-A3) Tested recovery evidence required.
9. (RV-A8) HQ ordinary admin ≠ privileged moderation.
10. (RV-A8) Every privileged HQ action: scoped, logged, reason recorded, country tagged.
11. (RV-A8) Service-role never in browser clients.
12. (Corrections list) G-PREVIEW-ISOLATION with measurable test.
13. (Corrections list) SET LOCAL error-path + ROLLBACK + reuse tests.
14. (Corrections list) Stage-level Indonesia protection tests.
15. (Corrections list) Storage cross-country denial tests.
16. (Corrections list) Old-signed-URL policy explicit.

### Still OPEN · U-decisions

All nine U-1..U-9 from the plan's §14.1 remain open. The RV decisions do not resolve them.

| # | U-decision | Still open? | Now blocking what |
|---|---|---|---|
| U-1 | Ireland domain | open | G-IE-PROD |
| U-2 | HQ domain + IP allowlist | open | G-HQ-GATE |
| U-3 | Current Indonesia production domain | open | G-ID-PROJECT + Indonesia continuity proof |
| U-4 | Preview DB target (sandbox project vs other) | open | **G-PREVIEW-ISOLATION (now early-blocking)** |
| U-5 | Legal review schedule per country | open | G-IE-PROD, G-ID-PROJECT |
| U-6 | Payment adapter per country | open | Soft-blocks Ireland launch |
| U-7 | Audit log migration timing | open | now TIGHTENED: HQ moderation audit required BEFORE any HQ cross-country action lands |
| U-8 | Preview WebAuthn registration policy | open | G-IE-PREVIEW |
| U-9 | Supabase tier verification (PITR + pool size) | open | G-245-SHADOW |

---

## 3 · G-RESOLVER state

**G-RESOLVER remains BLOCKED** pending:
- Revised plan incorporating RV-A3, RV-A5, RV-A8 + the 7 corrections.
- Owner approval of the revised plan.
- Then separate owner approval of G-RESOLVER itself.

Nothing starts implementation.

---

*Ledger 2026-10-31 · owner-mandated pre-edit step · no plan edits performed in this ledger · no implementation.*
