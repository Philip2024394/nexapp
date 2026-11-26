# NEX Consolidated Approval Queue · 2026-11-27

**Purpose:** respond to owner directive 2026-11-27 — *"Keep the ten approval gates in one consolidated queue. Do not repeatedly request the same approvals."*

**Scope:** single-file index of every outstanding approval phrase, the scope each phrase authorises, the evidence that justifies the ask, and the exact next action the phrase unlocks. Supersedes scattered references in prior session-handoff addenda, prep docs, and remaining-work register §D.

**Boundaries:** this document does NOT itself request any approval, cross any gate, or restate any already-authorised task. Rule 7 preserved. HEAD remains `9dfa90b4`.

**Source documents (authoritative — DO NOT regenerate):**
- `docs/engineering/approval-gated-prep-2026-11-26-continuation.md`
- `docs/engineering/l006-f2-approval-request-2026-11-26.md`
- `docs/engineering/l-006-correction-and-verification-plan-2026-11-27.md`
- `docs/engineering/mig-207-257-reconciliation-2026-11-26.md`
- `docs/engineering/t10-payment-credentials-unblock-2026-11-26.md`
- `docs/engineering/owner-decision-packet-2026-11-26.md`
- `docs/engineering/hq-finding-f3-journey-map-missing-admin-gate-2026-11-27.md`
- `docs/engineering/f3-hq-journey-map-gate-safe-prep-2026-11-27.md`
- `docs/engineering/remaining-work-register-2026-11-26.md` § D
- `CLAUDE.md` Rule 7 (approval boundaries)
- NEX delivery ledger (single source of truth for status)

---

## 1 · Queue

Ten rows. Listed in priority order: first, launch-critical defects whose fix is fully prepared; next, migrations that unblock queued verification work; last, commit/push and credential activation gates.

| # | ID | Scope | Status | Approval phrase | Evidence / plan | Unlocks |
|---|---|---|---|---|---|---|
| 1 | **F3** | Apply HQ journey-map admin gate (6-line defensive guard) + regression spec | DIAGNOSED · PREP COMPLETE | `APPROVE F3 PATCH APPLY` | `hq-finding-f3-journey-map-missing-admin-gate-2026-11-27.md` + `f3-hq-journey-map-gate-safe-prep-2026-11-27.md` | Admin-only gate restored on 18th HQ page · fix-then-pass regression log · ledger L-006-adjacent decisions-log entry |
| 2 | **F3·B** | Hold F3 until a dedicated audit sweeps all 18 HQ pages for gate parity | DIAGNOSED | `APPROVE F3 BATCH INTO HQ GATE SWEEP` | same | Sweep cycle (separate approval) |
| 3 | **F3·C** | Accept current permissive behaviour · correct the misleading header comment · log sealed decision | DIAGNOSED | `APPROVE F3 ACCEPT AS-IS` | same | Header comment correction + sealed decision log; no gate change |
| 4 | **L-006·A** | Reinstate `/nex-native/create-account` as a thin redirect shim → `/sign-in?mode=signup` + spec rewrites | BLOCKED-AT-APPROVAL | `APPROVE L-006 OPTION A` | `l006-f2-approval-request-2026-11-26.md` + `l-006-correction-and-verification-plan-2026-11-27.md` § 3.A | 8 mobile-public-surfaces assertions resolved · 7 user-reachable live emitters resolve via shim · 11 comment references untouched |
| 5 | **L-006·B** | Rewire the 7 user-reachable live emitters (§ 2.A of correction plan) to `/sign-in?mode=signup` · leave route retired · spec rewrites | BLOCKED-AT-APPROVAL | `APPROVE L-006 OPTION B` | same, § 3.B | Same as #4 plus focused regression spec for the signup query-param contract |
| 6 | **L-006·C** | Shim restore (same as #4) + preserve welcome child-route assertions (positive contract against `/welcome/account-active` + `/welcome/shop-active`) | BLOCKED-AT-APPROVAL | `APPROVE L-006 OPTION A WITH ALTERNATE CTAs` | same, § 3.C | Same as #4 plus child-route assertions |
| 7 | **MIG 286** | Sandbox apply of `286_nex_business_operating_country_code.sql` (drafted · not applied) | DRAFTED | `APPROVE MIG 286 SANDBOX APPLY` | `nex-supabase/migrations/286_nex_business_operating_country_code.sql` | NAV-SINGLE-APP-01 · 3 downstream specs un-gate from `test.skip` |
| 8 | **MIG 368** | Sandbox apply of `368_nex_account_region_pref.sql` (drafted · not applied) | DRAFTED | `APPROVE NEX_ACCOUNT REGION_PREF MIGRATION SANDBOX` | `nex-supabase/migrations/368_nex_account_region_pref.sql` + rollback · test gate at `tests/e2e/nav-single-app-04-05-region-pref-and-cross-country-rls.spec.ts:80-89` | NAV-SINGLE-APP-04/05 · specs un-skip via `hasRegionPrefColumn()` probe |
| 9 | **MIG 206** | Sandbox apply of `206_nex_account_hq_role.sql` (drafted) | DRAFTED | `APPROVE MIG 206 SANDBOX APPLY` | `nex-supabase/migrations/206_nex_account_hq_role.sql` + harness helper `createTestHqAdmin` plan | HQ-role Axis A desktop drawer-row slice |
| 10 | **MIG 354-365** | Sandbox apply of 12 subsequent drafted migrations | DRAFTED | `APPROVE MIG 354-365 SANDBOX APPLY` | `approval-gated-prep-2026-11-26-continuation.md` § 4 | Downstream feature-ledger items dependent on 354-365 schema |
| 11 | **L-005** | Option A · author mig 367 reconciliation delta (207/257 gap repair) · author-only, not apply | DRAFTED (plan) | `APPROVE L-005 OPTION A` | `mig-207-257-reconciliation-2026-11-26.md` · file-review branch | File-review of reconciliation delta; then separate `APPROVE MIG 367 SANDBOX APPLY` |
| 12 | **L-005·HOLD** | Defer migration 207/257 reconciliation to a later cycle | DRAFTED | `HOLD` (scoped to L-005 only) | same | No change this cycle |
| 13 | **L-004 / T10** | Owner populates `.env.local` with `STRIPE_WEBHOOK_SECRET` + 4× `PAYPAL_*` sandbox credentials | BLOCKED-PENDING-CONFIG | `APPROVE T10 SANDBOX CREDENTIALS` | `t10-payment-credentials-unblock-2026-11-26.md` | Stripe + PayPal positive-path T10 specs; no live charges |
| 14 | **L-044** | Commit the 2026-11-26 continuation sweep (10 source/config files · 11 specs · 25 evidence logs · docs) to `release-audit-v1-2026-11-14` · stage only | PREPARED | `APPROVE L-044 COMMIT` | `l044-commit-scope-2026-11-26.md` | Local commit created on the audit branch |
| 15 | **L-044·PUSH** | Commit as above + push to `Philip2024394/nexapp release-audit-v1-2026-11-14` per Safety Constitution §4 | PREPARED | `COMMIT AND PUSH L-044 CYCLE SCOPE TO Philip2024394/nexapp release-audit-v1-2026-11-14` | same | GitHub Actions `cloudflare-deploy.yml` → nexapp-preview worker |

Row count: 15 rows across **10 distinct approval classes** (F3 · L-006 · MIG 286 · MIG 368 · MIG 206 · MIG 354-365 · L-005 · T10 · L-044 commit · L-044 push). The 15 rows capture the mutually exclusive apply-branches under each class.

---

## 2 · What is NOT in this queue (deliberately)

- Any already-granted authority (sandbox engineering within `kdstoyyeygcopkogqsyv`, in-tree documentation writes, test authoring, test execution, local typecheck runs). These continue inside Rule 7 without new approval.
- Anything that touches production Supabase (`ijvqdvsvwtwxzcqmoqit`), live Stripe/PayPal, prod deployment, or arbitrary commits outside the L-044 scope. Those are out-of-scope defaults, not queued approvals.
- Credential rotation, DNS, Cloudflare Workers production environment, or Vercel removal — those move through their own sealed decision paths and are documented elsewhere (`project_nex_stack_sealed_2026_11_21`).

---

## 3 · Rule · do not re-request what is already queued

Per owner directive 2026-11-27 §6: "Keep the ten approval gates in one consolidated queue. Do not repeatedly request the same approvals."

- Each end-of-cycle report must reference this file by path rather than re-enumerating phrases in free-text.
- When an approval phrase is used, the matching row here moves to a dated-closed entry in the ledger decisions log and is removed from the queue.
- No new approval phrase may be added silently; a new row requires its own prep doc under `docs/engineering/` with the standard scope/evidence/next-action triad before it can appear here.
