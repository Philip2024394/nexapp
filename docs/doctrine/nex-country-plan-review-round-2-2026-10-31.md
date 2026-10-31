# NEX · Country Programme Plan · Owner Review Round 2 · 2026-10-31

**Status**: READ-ONLY review of `docs/doctrine/nex-country-application-programme-plan-2026-10-31.md` (commit `7c2c7cb`). No edits to the plan. No implementation. No code. No migration apply. No push.
**Reviewer's self-boundary**: I am reviewing a document I authored. Where I find weaknesses, I will mark FAIL honestly rather than defending the choices I made in the draft.

---

## 1 · PASS / FAIL · the five critical areas

### Area 1 · Preview deployment DB isolation · verdict **FAIL**

**Owner's requirement**: *"Preview deployment database isolation and prevention of accidental production writes."*

**Where the plan addresses it**:
- §10.2 (Preview deployment protection): acknowledges that previews write to the SAME shared Supabase if no sandbox is adopted.
- §14.1 U-4: records "Preview-deployment DB target: shared Supabase OR a dedicated sandbox Supabase project" as an open owner decision.
- §14.2 R-7: lists "Preview deployments write to production Supabase" as high-likelihood, medium-impact.

**Why FAIL**: the plan **flags the risk** but does NOT define a measurable acceptance test. Specifically missing:
- A hard rule: "no preview deployment reaches production Supabase."
- A test: "verify a PR preview environment's `NEX_SUPABASE_SERVICE_ROLE_KEY` points to a sandbox project, not `ijvqdvsvwtwxzcqmoqit`."
- An enforcement mechanism: a build-time or startup assertion that refuses to boot a preview against the production DB URL.

**Current state of the plan**: owner "picks before promoting any PR workflow." That's an authorisation gate, not an isolation guarantee.

**Recommended correction** (not implemented): add a §10.2b "Preview-DB hard rule" with a measurable acceptance test, named in §12 as a gate (e.g. `G-PREVIEW-ISOLATION`) that must pass before any preview deployment is used.

---

### Area 2 · SET LOCAL country context under connection pooling · verdict **PARTIAL PASS**

**Owner's requirement**: *"SET LOCAL country context under connection pooling, including errors, rollback and connection reuse."*

**Where the plan addresses it**:
- §4.5 (Connection-pool safety · the `SET LOCAL` discipline): names PgBouncer session mode, states that `SET LOCAL` is transaction-scoped, defines a positive test (two parallel requests, no leak) and a negative test (missing SET LOCAL → fail-closed).
- §4.3 item 5: weekly CI leakage test against staging snapshot.
- §14.2 R-3: critical-impact entry for connection-pool leakage.

**Why only PARTIAL PASS**:
- ✅ **Connection reuse**: covered.
- ✅ **Fail-closed on missing SET LOCAL**: covered.
- ❌ **Error-path behaviour**: the plan does NOT specify what happens when a server action throws AFTER `SET LOCAL` but BEFORE commit. (Postgres clears `SET LOCAL` on both COMMIT and ROLLBACK, so the behaviour is safe — but the plan does not state this and does not require a test.)
- ❌ **Explicit ROLLBACK path**: no test case for a transaction that is explicitly ROLLBACKed by application code and then the connection reused.
- ❌ **Pre-middleware era**: no test for what happens on the OLD Indonesia deployment during Stage I-10 (see architectural contradiction §3.1 below).

**Recommended correction** (not implemented): extend §4.5 with:
- An explicit property: "`SET LOCAL` is cleared on both COMMIT and ROLLBACK (Postgres semantics)."
- Four test cases: (a) happy path, (b) action throws before commit, (c) explicit ROLLBACK then reuse, (d) connection returned to pool after error.

---

### Area 3 · Migration 245 shadow testing + fail-closed + tested recovery · verdict **FAIL**

**Owner's requirement**: *"Migration 245 shadow testing, fail-closed behaviour and tested recovery."*

**Where the plan addresses it**:
- §6 Stage I-9: shadow-test protocol — Supabase branch from snapshot, 7-gate matrix, rollback tested in branch, pass/fail report.
- §11.2: fuller protocol — "A 100%-pass shadow report is a HARD prerequisite to I-10 approval."
- §11.1 I-10: "DROP POLICY returns to USING(true) permissive · WORSE than before · forward-fix preferred · ⚠️ FORWARD-ONLY in practice."
- G-245-SHADOW and G-245-APPLY as separate gates in §12.1.

**Why FAIL**:
- ✅ Shadow test is well-defined.
- ⚠️ **Fail-closed is implied but not an explicit pass criterion**: the shadow-test description says "7-gate matrix" but does not inline the specific fail-closed assertions (e.g. "with `nex.app_country` empty, SELECT on nex_business returns 0 rows", "with service_role, SELECT returns full rows", "an authenticated connection with no app_country set is denied").
- ❌ **"Tested recovery" is openly admitted to be impossible**: §11.1 says rollback restores permissive policies, which is WORSE than before. The plan recommends "forward-fix (245b)" but no such migration is drafted and no recovery procedure is tested in the shadow. This directly contradicts the owner's requirement.

**This is a direct failure of the owner's requirement #5 under "Also check": "Rollback procedures do not restore permissive security policies."** The plan openly admits the Migration 245 rollback DOES restore permissive policies.

**Recommended correction** (not implemented):
- Add a Stage I-9b: before applying Migration 245 to the shadow branch, DROP the current `USING(true)` permissive policy on `nex_business` and replace with a strict "deny all except service_role" policy. Then Migration 245's rollback target becomes "deny all" rather than permissive.
- Draft `245b_nex_rls_forward_fix_template.sql` as a shell file so a real recovery procedure exists even if its specific content is only authored on incident.
- Add fail-closed assertions as explicit lines in the shadow-test matrix:
  - Empty `nex.app_country` → 0 rows on every CO/CO-I table.
  - Missing `nex.app_country` setting → 0 rows.
  - `service_role` connection → bypasses, full rows (control case).

---

### Area 4 · Storage isolation (cross-country denial · signed URLs · existing objects) · verdict **PARTIAL PASS**

**Owner's requirement**: *"Storage isolation, existing object paths, signed URLs and cross-country denial."*

**Where the plan addresses it**:
- §4.6: shared storage bucket caveat (bucket is project-level, not country-level).
- §6 Stage I-11 (Migration 248): external path-rename script, verification "0 objects at root prefix", signed URL rotation plan runs, CDN cache invalidated.
- §14.2 R-5: partial-state rename risk.

**Why only PARTIAL PASS**:
- ✅ **Existing object paths**: path-rename script + idempotent re-run + 0-at-root verification.
- ✅ **Cross-country denial at the policy layer**: Migration 248's SQL file (not the plan) contains the policy; the plan references it.
- ❌ **Cross-country denial acceptance test is NOT in the plan**: the plan does not say "as part of Stage I-11 acceptance, verify that from the Ireland deployment, an attempt to download `/nex-business-assets/ID/<businessId>/x.png` where the business is COUNTRY-visibility returns 404."
- ❌ **Signed URLs minted BEFORE Migration 248**: the plan mentions "signed URL rotation plan runs" but does NOT define the plan. Specifically: a signed URL minted at T-1 is bound to a Supabase token and a specific object path. After rename, the object path no longer exists at the old location. Existing signed URLs for `/nex-business-assets/{businessId}/x.png` become 404. The plan does not state whether this is accepted (users with cached signed URLs see broken images for up to the URL's expiration window) or whether a dual-serve window is required.
- ❌ **Signed URLs minted AFTER Migration 248 but requested cross-country**: no explicit test.

**Recommended correction** (not implemented): add Stage I-11b "Storage isolation acceptance":
- Test cross-country GET denial (specific object paths + specific countries).
- Test old-signed-URL behaviour across the migration boundary.
- Test new-signed-URL cross-country rejection.
- Define the dual-serve window policy (if any) explicitly.

---

### Area 5 · Protection of existing Indonesian users during Ireland-first rollout · verdict **FAIL**

**Owner's requirement**: *"Protection of existing Indonesian users, sessions, WebAuthn credentials, content and business records throughout Ireland-first rollout."*

**Where the plan addresses it**:
- §5.4: user identity portability under two apps.
- §7 Stage ID-3: session + WebAuthn migration plan (but this is in the Indonesia-second phase, AFTER Ireland is live).
- §6 Stage I-5 Migration 246: backfill `country='ID'` for existing rows (correct, non-destructive).

**Why FAIL — multiple distinct issues**:

#### 5.1 · The Ireland-first dark-mode risk (CRITICAL)

Between Stage **I-10** (Migration 245 production apply) and Stage **ID-4** (Indonesia DNS cutover to the new `nex-indonesia` Vercel project), **Indonesia users are hitting the OLD pre-two-apps deployment**. That deployment does NOT set `nex.app_country` (because the middleware is in the new codebase, which has not deployed to Indonesia yet).

Migration 245's RLS predicates all begin with `public.nex_current_app_country() IS NOT NULL AND ...`. If `nex.app_country` is NULL (because the OLD deployment doesn't set it), every USING clause evaluates to false. **Indonesia users see zero rows. Platform goes dark for Indonesia between I-10 and ID-4.**

This is a direct consequence of the stage ordering in §6 and §7. It is an **architectural contradiction** between "Ireland first" and "shared Supabase + enforced RLS." I did not catch this when writing the plan.

#### 5.2 · No explicit protection acceptance test

The plan does not include a stage-level acceptance test like:
- "After Migration 245 is live, Indonesia user Sari Dewi can still sign in via the current Indonesia deployment."
- "Her existing WebAuthn credential still verifies."
- "Her business page still renders to her and to Indonesia-deployment visitors."
- "Her Chat Themes still render."
- "Her music library still plays."

These are implied by the design (country='ID' + Indonesia deployment setting `nex.app_country='ID'`) but **the Indonesia deployment doesn't set `nex.app_country` until stage ID-2+**.

#### 5.3 · Business record protection is partially covered

Migration 246 (backfill) correctly stamps every existing row as `country='ID'`. The plan is correct about this. But the plan does not test that stamped rows are STILL READABLE by the Indonesia user before and after Migration 245. See 5.1.

**Recommended corrections** (not implemented):

**Option A** · Reorder stages so Indonesia cuts over to the new deployment BEFORE Migration 245 is applied:
```
I-4 (244) → I-5 (246) → I-6 (247) → I-7 (249) → I-8 (251)
→ ID-1 ID-2 ID-3 ID-4 (Indonesia cutover to middleware-aware deployment)
→ I-9 I-10 (Migration 245 shadow + apply)
→ I-11 (248 storage) → I-12 I-13 (Ireland production)
```
Both countries are on middleware-aware deployments before the RLS pinch point lands.

**Option B** · Hot-patch the OLD Indonesia deployment with the SET LOCAL middleware before Migration 245 lands:
- Deploy a single commit to the current Indonesia production deployment that adds `SET LOCAL nex.app_country = 'ID'` on every DB-backed request.
- Verify in that deployment that existing journeys still work.
- THEN apply Migration 245.

**Option C** · Delay Migration 245 until BOTH Ireland and Indonesia are on new deployments (push the pinch point to the last stage). In this case Ireland launches without full RLS and depends only on application-layer country enforcement — weaker, not recommended.

**Owner must pick one. The plan as written is unsafe for Indonesian users at Stage I-10.**

---

## 2 · Verification of the seven additional checks

| # | Owner check | Verdict | Where / why |
|---|---|---|---|
| 2.1 | All 18 approval gates are independent and enforceable | ✅ PASS | §12.1 enumerates G-RESOLVER, G-IE-PROJECT, G-IE-PREVIEW, G-244, G-246, G-247, G-249, G-251, G-245-SHADOW, G-245-APPLY, G-248, G-IE-PROD, G-ID-PROJECT, G-ID-PREVIEW, G-ID-CUTOVER, G-HQ-GATE, G-30-DAY, G-DECOMM. Each gate requires written approval; "No stage proceeds without its gate. Nothing is auto-promoted. Nothing is batched." |
| 2.2 | No gate implicitly authorises a later migration or deployment | ✅ PASS | §12.1 wording explicit; each row is a separate written-approval requirement |
| 2.3 | Each migration has a separate owner approval | ✅ PASS | G-244, G-246, G-247, G-249, G-251, G-245-APPLY, G-248 are seven distinct gates |
| 2.4 | No global Activate action can change all NEX users | ✅ PASS | §8.3: "Cannot change the global identity (there is no global identity · each app resolves its own at runtime)." §15 non-goals: "Activating the Worlds-page 'Activate' red buttons on anyone's device." |
| 2.5 | HQ cannot bypass country isolation | ⚠️ **PARTIAL / DESIGN CHOICE** | §8.3: HQ **can** read across countries via service_role (gated by `requireHqAdmin`). This is a DESIGN CHOICE for cross-country moderation, not an accidental bypass. If the owner means "no accidental bypass", PASS. If the owner means "HQ should also be country-locked", FAIL — but that would break HQ's core purpose. **Owner clarification requested.** |
| 2.6 | Rollback procedures do not restore permissive security policies | ❌ **FAIL** | §11.1 I-10 verbatim: "DROP POLICY returns to USING(true) permissive · WORSE than before." This is honest documentation of a real design flaw. See Area 3 above for the recommended correction. |
| 2.7 | All unresolved U-1 to U-9 decisions remain clearly identified | ✅ PASS | §14.1 enumerates all nine, each with a blocking gate column |

---

## 3 · Architectural contradictions in the plan

### 3.1 · Indonesia dark-mode window (Area 5.1 above) · CRITICAL

Stage I-10 applies Migration 245 to the shared Supabase while Indonesia users still hit the pre-two-apps deployment that does not set `nex.app_country`. The RLS fails-closed → Indonesia sees zero rows. **The current plan ordering breaks Indonesia at Stage I-10.** Recommended corrections in Area 5 above (Option A, B, or C).

### 3.2 · Migration 245 rollback vs owner safeguard (Area 3 above) · HIGH

Owner requires rollback procedures NOT to restore permissive security. The plan openly admits Migration 245's rollback DOES restore permissive security (`USING(true)`). Fix: pre-245 state becomes "deny all for authenticated" so the rollback target is strict, not permissive.

### 3.3 · HQ service_role bypass vs "HQ cannot bypass country isolation" (Area 2.5 above) · AMBIGUOUS

Owner's check #5 (seven additional checks) reads "HQ cannot bypass country isolation." The plan's design has HQ bypassing RLS via service_role (so HQ can see across countries for moderation). This is either:
- (a) a design choice the owner approves of (HQ should see across countries), or
- (b) a safety concern the owner wants fixed (HQ should be gated per-country too).

**I cannot resolve this contradiction without owner input.** The plan should state the design choice explicitly and ask the owner to confirm.

### 3.4 · Preview-deployment DB target is open AND preview protection is a gate (Area 1 above) · MEDIUM

U-4 (preview DB target) is open AND there is no `G-PREVIEW-ISOLATION` gate. Previews could technically happen before U-4 is decided. Fix: add the gate, make U-4 blocking on preview deployment work.

### 3.5 · Shadow-test rollback claim (Stage I-9) · MINOR

Stage I-9 says "Rollback tested in the branch (apply then DROP POLICY · the policies disappear · behaviour returns to pre-245)." This claim is TRUE but misleading: behaviour returning to pre-245 means returning to `USING(true)` permissive, which is the problem flagged in 3.2. The shadow test doesn't test a SAFE recovery; it tests the UNSAFE recovery. Fix: shadow test the strict-deny-pre-state swap AND the forward-fix flow.

---

## 4 · Recommended corrections (NOT implemented)

Summary of corrections surfaced above, in priority order:

| Priority | Correction | Section(s) affected |
|---|---|---|
| **P0 CRITICAL** | Resolve the Indonesia dark-mode window (reorder stages OR hot-patch OLD Indonesia deployment OR delay 245) | §6 I-10, §7 ID-1..ID-4 |
| **P0 CRITICAL** | Change Migration 245 rollback target from USING(true) permissive to strict-deny · require pre-245 policy swap · optionally draft 245b forward-fix template | §6 I-9, I-10, §11.1, §11.2 |
| **P1 HIGH** | Add `G-PREVIEW-ISOLATION` gate · require measurable test: previews use sandbox Supabase OR hard-fail boot | §10.2, §12.1 |
| **P1 HIGH** | Resolve "HQ bypass vs isolation" ambiguity: explicitly document HQ as a DESIGN bypass with audit-log requirement, OR require per-country HQ gating | §8.3 |
| **P2 MEDIUM** | Extend `SET LOCAL` safety discipline with explicit error-path + rollback tests | §4.5 |
| **P2 MEDIUM** | Add stage-level protection tests for existing Indonesian users (sign-in, WebAuthn, business, Chat Themes, music) | §6, §7 |
| **P2 MEDIUM** | Add storage isolation acceptance tests inline (not just referenced from Migration 248's SQL) · old + new signed URL behaviour | §6 I-11 |

---

## 5 · U-1 through U-9 · still open

| # | Decision | Blocking | Currently |
|---|---|---|---|
| U-1 | Ireland domain | G-IE-PROD | OPEN |
| U-2 | HQ domain + IP allowlist | G-HQ-GATE | OPEN |
| U-3 | Current Indonesia domain | G-ID-PROJECT | OPEN |
| U-4 | Preview DB target | G-IE-PREVIEW | OPEN (should block earlier · see §4 above) |
| U-5 | Legal review schedule | G-IE-PROD, G-ID-PROJECT | OPEN |
| U-6 | Payment adapter per country | Soft-blocks Ireland launch | OPEN |
| U-7 | Audit log migration timing | G-HQ-GATE deferral | OPEN |
| U-8 | Preview WebAuthn registration policy | G-IE-PREVIEW | OPEN |
| U-9 | Supabase tier verification (PITR + pool size) | G-245-SHADOW | OPEN |

All nine remain clearly identified. ✅

---

## 6 · Overall review verdict

- 5 critical areas: **1 PASS, 2 PARTIAL PASS, 2 FAIL**.
- 7 additional checks: **5 PASS, 1 PARTIAL / clarification requested, 1 FAIL (rollback-permissive-restore)**.
- 2 critical architectural contradictions (Indonesia dark-mode, 245 rollback).
- 7 recommended corrections across P0, P1, P2.
- 9 unresolved owner decisions.

**Plan status**: architectural direction is sound. Three unresolved issues (Indonesia dark-mode, 245 rollback, HQ bypass clarification) BLOCK G-RESOLVER authorisation. Preview isolation (P1) should be resolved before Ireland reaches preview deployment stage.

**Reviewer's self-assessment**: I missed the Indonesia dark-mode window when writing the plan. That is a direct failure of the "existing Indonesian users must not be disrupted" requirement. The 245 rollback issue I flagged honestly in the plan but did not resolve. These two together are enough to say the plan needs a revision before implementation begins.

---

## 7 · Boundaries honoured by this review

| Boundary | State |
|---|---|
| No code change | ✅ Review-only doc |
| No SQL executed | ✅ |
| No migration applied | ✅ 7 drafts still guarded |
| No Vercel change | ✅ |
| No push | ✅ Local commits only |
| No deployment | ✅ |
| No activation | ✅ |
| No edits to the plan under review | ✅ `7c2c7cb` plan is byte-identical post-review |

---

## 8 · Owner acceptance targets for THIS review

Return approve / modify / defer for each:

| # | Item | Return |
|---|---|---|
| RV-A1 | Area 1 Preview DB isolation · verdict FAIL + recommended `G-PREVIEW-ISOLATION` gate | approve / defer |
| RV-A2 | Area 2 SET LOCAL · PARTIAL PASS · recommended error-path + explicit ROLLBACK tests | approve / modify |
| RV-A3 | Area 3 Migration 245 · FAIL · recommended pre-245 strict-deny swap + 245b template | **critical · approve / propose alternative** |
| RV-A4 | Area 4 Storage · PARTIAL PASS · recommended inline acceptance tests + old-URL policy | approve / defer |
| RV-A5 | Area 5 Indonesia protection · FAIL · recommended stage reorder OR hot-patch OR delay-245 | **critical · pick Option A/B/C or alternative** |
| RV-A6 | Check 2.5 HQ "bypass" ambiguity · clarify HQ is DESIGN-bypass (approve) OR require per-country HQ gating | pick |
| RV-A7 | Check 2.6 rollback-permissive-restore · FAIL on current plan · tie to RV-A3 fix | tie-to-A3 / modify |
| RV-A8 | Recommended corrections P0/P1/P2 are the right priority order | approve / resequence |
| RV-A9 | U-4 should become blocking for preview, not downstream · move it earlier in the gate matrix | approve / defer |

**Nothing in the plan has changed as a result of this review. The 733-line plan at `7c2c7cb` is byte-identical. Any revisions require separate owner approval before I touch the plan file.**

---

*Review 2026-10-31 · Round 2 · no edits to the plan under review · awaiting owner RV-A1..RV-A9.*
