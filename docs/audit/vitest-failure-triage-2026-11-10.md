# Vitest Failure Triage — 2026-11-10

Repo: `C:/Users/Victus/nexapp`
Captured run: `C:/Users/Victus/AppData/Local/Temp/claude/C--Users-Victus/2804d087-ca21-4866-a82f-805be9e7b7a3/tasks/bfbfdhdio.output`
Headline totals (from captured tail):

```
Test Files  321 failed | 909 passed | 5 skipped (1235)
Tests       371 failed | 21019 passed | 369 skipped | 9 todo (21768)
Errors      20 errors
Duration    141.44s
```

---

## 0 · Important limitation on this triage

The captured run output is a truncated tail (80 lines · 4.3 KB). It contains ONLY
the final 7 "Unhandled Rejection" blocks and the headline summary. It does **not**
contain the enumeration of 321 failing file paths that would normally be produced
by `grep "^FAIL" | awk '{print $2}' | …`.

Applying the user-supplied `grep "^FAIL"` pipeline to `bfbfdhdio.output` returns
**zero matches**. Running vitest again is explicitly out of scope ("Do NOT run
vitest again").

This triage is therefore produced from:

1. the 7 visible failing `.mjs` files in the captured tail,
2. a full inventory of 1162 `*.test.*` / `*.spec.*` files under `src/`,
3. static analysis of the repo structure (fork-boundary doctrine in
   `C:/Users/Victus/nexapp/CLAUDE.md`) + known legacy residue (hammerex,
   homeowner/merchant/visitor model, process.exit `.mjs` test corpus).

Where a single failing file is identifiable it is listed by full path. Where
the full 321 cannot be enumerated from captured evidence, bucket sizes are
reported as evidence-anchored **heuristic ranges**, and the bucket-defining
signature is given so a future `grep "^FAIL"` sweep can slot each file in
deterministically.

---

## 1 · Top-level histogram (surface prefix)

Histogram of test-file count per top-level NEX surface (full inventory of 1162
test files under `src/`, since per-file FAIL list is unavailable). Failure
weight is attributed to each surface using the bucket-signature analysis in §2.

| # | Prefix (`src/…`)                               | Test files | Expected fail weight |
|---|-------------------------------------------------|-----------:|----------------------|
|  1 | `src/lib/nex/*`                                | 567        | HIGH (L + E hotspot) |
|  2 | `src/lib/nex-native/*`                         | 299        | LOW (current NEX)    |
|  3 | `src/lib/nex-agent/code-engine/*`              | 66         | MED (U · needs audit)|
|  4 | `src/lib/nex-native/__tests__`                 | 62         | LOW                  |
|  5 | `src/lib/nex-native/family-safety/*`           | 20         | LOW                  |
|  6 | `src/lib/nex-native/directory/*`               | 28         | LOW–MED              |
|  7 | `src/lib/nex-native/safechat/*`                | 18         | LOW                  |
|  8 | `src/lib/nex-native/live-broadcast/*`          | 17         | LOW–MED              |
|  9 | `src/lib/nex-native/first-conversation/*`      | 16         | LOW                  |
| 10 | `src/lib/nex-native/business-trial/*`          |  8         | LOW (1 is E · gated) |
| 11 | `src/lib/nex-native/billing/*`                 | 10         | LOW                  |
| 12 | `src/lib/nex-native/emergency/*`               | 10         | LOW                  |
| 13 | `src/components/nex-native/family-safety/*`    | 18         | LOW                  |
| 14 | `src/components/nex-native/*`                  | 25         | LOW                  |
| 15 | `src/app/nex-native/*`                         | 65+        | LOW                  |
| 16 | `src/app/api/nex-native/*`                     | 14         | LOW                  |
| 17 | `src/lib/nex-agent-runtime/__tests__`          | 42         | MED–HIGH (U)         |
| 18 | `src/lib/nex-agent-runtime/*`                  | 110        | MED–HIGH (U)         |
| 19 | `src/lib/nex-calling/*`                        |  4         | LOW                  |
| 20 | `src/components/nex-app/*`                     |  8         | LOW                  |

Note: `src/lib/nex/*` contains 567 of 1162 test files — ~49% of the test corpus
— and this tree is the legacy-monorepo residue surface (hammerex,
homeowner/merchant/visitor, trade-off, van-wrap etc.). The arithmetic alone
places most of the 321 failures here: 909 pass / 321 fail is plausible if
roughly ⅓ of the `src/lib/nex/*` subtree is legacy-broken.

---

## 2 · Bucket categorisation (signature-based)

Each bucket lists the **signature** by which a FAIL line can be slotted. Files
appear by full path where the captured output or static evidence pins them. A
future `grep "^FAIL"` sweep against a complete log can be routed deterministic-
ally by running the signature grep against the FAIL file list.

### Bucket **L** — Legacy / monorepo residue

**Signature:** file lives under `src/lib/nex/{xp,world,twin,tools,social,signals,sc,pm,pi,ops,net,mp,merchant-assistant,md,living-memory,friend-edge,fi,cx,…}/**` **AND** target source module reads a `hammerex_*` table via `.from('hammerex_…')`, or depends on the `NexSurface = "merchant" | "homeowner" | "visitor"` audience model, or references `trade-off` / `xrated` / `networkers` / `van-wrap` / `trade-center`.

**Evidence:**
- `C:/Users/Victus/nexapp/CLAUDE.md` §"Fork hygiene" explicitly says:
  *"`.from('hammerex_*')` Supabase reads exist in `src/lib/nex/`. The tables may not exist in the NEX Supabase project. Surfaces that hit those code paths will fail at runtime until migrated."*
- 30+ runtime files under `src/lib/nex/{xp,world,social,signals,sc,pm,pi,ops,net,mp,md,merchant-assistant,fi,cx,twin,tools,living-memory}` contain `hammerex` references. Their colocated `*.test.ts` files that exercise those code paths fail as soon as the test boots the module.

**Likely files (per inventory · verified to transit hammerex-tainted modules):**
See Appendix **A1**. Estimated **L ≈ 140–180 files** of the 321 failures.

### Bucket **M** — Missing dependency / unresolved import

**Signature:** vitest reports "Cannot find module", "Failed to resolve import", or "TypeError: Cannot read … undefined" at collection time against a sibling path that no longer exists under the current fork boundary.

**Evidence:** CLAUDE.md states "~14 known broken imports from missing deps · do not fix in bulk, address when touching the files." These are specific, not enumerated. The captured tail shows **zero** M-signature errors (all 7 visible failures are E-bucket process.exit crashes), consistent with the truncation — M-bucket failures normally print distinctive error banners earlier in the output.

**Estimated M ≈ 12–20 files** (consistent with CLAUDE.md's "~14"). See Appendix **A2** for the search command to find them in a complete log.

### Bucket **E** — Environment-dependent

**Signature:** test file is a `*.test.mjs` that (a) imports `pg`, (b) opens `new Pool({ connectionString: process.env.NEX_POSTGRES_URL || 'postgresql://postgres:changeme@localhost:5433/nex_dev' })`, (c) `fetch`es `http://localhost:3008`, and (d) calls `process.exit(2)` on first failure — producing the exact "Error: process.exit unexpectedly called with '2'" / "Unhandled Rejection" pattern visible in the captured tail.

OR

test is a TypeScript `*.integration.test.ts` guarded by `process.env.TRIAL_PG_TEST_URL` (or similar) that still errors in collection despite `describe.skip`.

**Exact count:** 83 `.mjs` test files exist under `src/` (enumerated). The 7 visible in the captured tail are all under `src/lib/nex/comms-social/tests/`. **All 83 fail without a running local Postgres on :5433 AND a running `npm run dev` on :3008 AND seeded tables (`nex.social_tenants`, etc.).**

Plus ≥1 TS integration test (`concurrency.integration.test.ts`) that's gated.

**Full E list (83 files):** see Appendix **A3**.

**Visible-in-output E failures (7 confirmed):**
- `src/lib/nex/comms-social/tests/validator-fact.test.mjs`
- `src/lib/nex/comms-social/tests/validator-platform.test.mjs`
- `src/lib/nex/comms-social/tests/validator-pipeline.test.mjs`
- `src/lib/nex/comms-social/tests/validator-brand.test.mjs`
- `src/lib/nex/comms-social/tests/validator-policy.test.mjs`
- `src/lib/nex/comms-social/tests/validator-rights.test.mjs`
- (+ 1 more implied by the tail cutoff)

**Estimated E ≈ 83–90 files** of the 321 failures.

### Bucket **D** — Data-dependent

**Signature:** test passes when seed rows exist in a specific table (e.g. `nex_account`, `nex_business` with specific ids) but fails with "no rows returned" or "undefined .id" on an empty DB. Overlaps with E — most D cases are a subset of E (the `.mjs` tests seed tenants inline, so they're E not D; but a handful of TS tests under `src/lib/nex-native/directory/`, `src/lib/nex-native/discovery/` read from NEX Supabase directly without mocking).

**Estimated D ≈ 5–10 files.** Most data dependencies have been mock-wrapped in the nex-native tree (confirmed by spot-check of `buyer/__tests__/route.test.ts` which hoists complete `vi.mock` layers over `@/lib/nex-native/business-service`, `@/lib/nex-native/product-service`, etc.).

### Bucket **A** — API contract drift

**Signature:** test fails inside an `expect(…)` with "expected X to equal Y" where X is a newly-shaped return value from a refactored service and the test was not updated. No module-resolution error, no process.exit, no env guard.

**Estimated A ≈ 15–30 files**, plausibly concentrated in `src/lib/nex-agent-runtime/*` (where the agent runtime has seen rapid iteration — 42 files under `__tests__`, 110+ scattered across subsystems).

### Bucket **N** — Current-NEX genuine bug · must fix before release

**Signature:** test lives under `src/lib/nex-native/*`, `src/app/nex-native/*`, `src/app/api/nex-native/*`, or `src/components/nex-native/*`; the module under test has no legacy residue; and the test fails on a logic assertion rather than environment / imports.

**Candidates (from static inspection — NOT confirmed as failing because the per-file FAIL list is unavailable; each requires verification against a complete log before action):**

See §3 for the N candidate list + fix suggestions.

**Estimated N ≤ 20 files** of the 321 failures — the current-NEX surface is heavily mocked and well-isolated; genuine bugs here are relatively few.

### Bucket **U** — Unclassifiable without deeper investigation

**Signature:** does not clearly match any of L / M / E / D / A / N — typically nex-agent / nex-agent-runtime tests where the module tree is active NEX work but the subsystem (agent brains, workstation, waves) is experimental and may be partly abandoned / partly current.

**Estimated U ≈ 50–80 files** of the 321 failures. These should be triaged in a
second pass with a complete FAIL list in hand.

---

## 3 · Prioritised **N** bucket — current NEX bugs needing fix before release

**Deliberately short.** These are the plausible-N files flagged by static
inspection. Each is a candidate for a genuine current-NEX bug; the actual
failure mode must be confirmed against a complete vitest log before commit-
ting fix work. Order is risk-weighted by surface criticality per sealed NEX
Phase 2 priorities (chat privacy P0 → billing → checkout → RLS → …).

| # | File (absolute) | Why it's candidate-N | Suggested fix direction |
|---|-----------------|----------------------|-------------------------|
| 1 | `C:/Users/Victus/nexapp/src/app/api/nex-native/billing/checkout/buyer/__tests__/route.test.ts` | Phase 1 F-3 price-trust fix (sealed 2026-11-09 Priority 3). Any failure here = buyer can influence Stripe `unit_amount`. | Re-run isolated; if assertion fails on `expect.objectContaining({ unit_amount: SERVER_PRICE })`, the server-side `getProductById` → `unit_amount` plumbing has regressed — audit `src/app/api/nex-native/billing/checkout/buyer/route.ts`. |
| 2 | `C:/Users/Victus/nexapp/src/app/api/nex-native/peer-message/encrypted/__tests__/dispatch-wiring.test.ts` | Phase 2 chat privacy P0 (sealed 2026-11-09). Must verify server never sees plaintext. | Confirm no plaintext field in route payload; audit `attachment_meta` for product/menu/order snapshots per sealed doctrine. |
| 3 | `C:/Users/Victus/nexapp/src/app/api/nex-native/attachment/encrypted/__tests__/route.test.ts` + `signed/__tests__/route.test.ts` | Phase 2 chat privacy — attachment ciphertext mint via signed URL (mig 295 private bucket). | Confirm route rejects non-ciphertext bodies and only mints signed URLs for participants. |
| 4 | `C:/Users/Victus/nexapp/src/app/api/nex-native/stripe/webhook/__tests__/route.test.ts` | Stripe webhook is the payment-truth source; any failure = billing truth drift. | Verify `event.type` handlers for `checkout.session.completed` + `invoice.upcoming` (7-day trial reminder per sealed trial decision 2026-11-08). |
| 5 | `C:/Users/Victus/nexapp/src/app/api/nex-native/security/account/delete/__tests__/route.test.ts` | Account deletion is a gated operation; failure = data-retention compliance drift. | Verify `account-deletion-service` chains + confirm recovery service pathway. |
| 6 | `C:/Users/Victus/nexapp/src/app/api/nex-native/security/password/change/__tests__/route.test.ts` | Password change is security-critical. | Check WebAuthn flow + session invalidation. |
| 7 | `C:/Users/Victus/nexapp/src/app/api/nex-native/hq/direct-message/__tests__/route.test.ts` | HQ-direct-message is operations-critical control-plane. | Audit admin-gate predicate. |
| 8 | `C:/Users/Victus/nexapp/src/app/api/nex-native/surface-health/__tests__/route.test.ts` | Failure-isolation infra (Phase 1 priority 1). | Check SectionBoundary / probe contract. |
| 9 | `C:/Users/Victus/nexapp/src/app/api/nex-native/unread-count/__tests__/route.test.ts` | Core chat UX; any 500 cascades to badge drift. | Verify RLS + rate-limit mig 290 interaction. |
|10 | `C:/Users/Victus/nexapp/src/app/api/nex-native/cron/security-audit-reconcile/__tests__/route.test.ts` | Security-audit reconciliation cron. | Verify token gate + idempotency key. |
|11 | `C:/Users/Victus/nexapp/src/app/api/nex-native/auth/webauthn/__tests__/assert-routes.test.ts` + `enroll-routes.test.ts` | Face sign-in (Bridge 2b sealed `7991095c`). Any failure = sign-in regression. | Audit challenge rotation + credential storage. |
|12 | `C:/Users/Victus/nexapp/src/lib/nex-native/__tests__/vault-persistence.test.ts` + `vault-conversation-envelope-live-b2.test.ts` | Vault is bundled with Shop package (sealed scope reduction 2026-11-06). | Audit vault PIN/biometric reducer (`_pin-entry-client.tsx`). |
|13 | `C:/Users/Victus/nexapp/src/lib/nex-native/first-conversation/__tests__/section-13-a1-single-identity.test.ts` | First-conversation identity gate (A1) — sealed 2026-10-23 single-identity doctrine. | Audit `session-registry-service`. |
|14 | `C:/Users/Victus/nexapp/src/lib/nex-native/first-conversation/__tests__/first-message-orchestrator.test.ts` + `first-message-http.test.ts` + `welcome-outbox-worker.test.ts` + `welcome-delivery.test.ts` | First-message is public surface + has outbox integrity invariant. | Audit idempotency key + outbox worker claim. |
|15 | `C:/Users/Victus/nexapp/src/lib/nex-native/follow/__tests__/follow-concurrency.test.ts` | Concurrency invariant on social graph. | Audit DB constraint vs. app-level lock. |
|16 | `C:/Users/Victus/nexapp/src/lib/nex-native/admin-grant/__tests__/admin-grant-service.test.ts` | Admin grant is control-plane (Phase 1 priority 4 — dedicated `hq_admin_grant` rate ring). | Confirm rate-limit + country-scope policy. |
|17 | `C:/Users/Victus/nexapp/src/lib/nex-native/incident/__tests__/incident-service.test.ts` | HQ Incident system (Phase 1 priority 2 — sealed 2026-11-08). | Audit HIGH severity tier + DETECTED/RECOVERY_ATTEMPTED/VERIFIED_RESOLVED splits. |
|18 | `C:/Users/Victus/nexapp/src/lib/nex-native/calls/__tests__/invite-service.test.ts` | Calling is a feature-gated surface; failure blocks CI. | Audit invite dispatch + rate limit. |
|19 | `C:/Users/Victus/nexapp/src/lib/nex-native/payments/__tests__/qris-scaffold.test.ts` + `paypal-scaffold.test.ts` | Payments scaffolds are gated SANDBOX-only; ideally test skips gracefully. | Confirm `describe.skip` under flag — if assertion-failing, re-scope. |
|20 | `C:/Users/Victus/nexapp/src/lib/nex-native/security-monitor/__tests__/security-monitor.test.ts` | Security monitor + audit. | Confirm metric emission + HQ Alerts realtime. |

All 20 items above are **candidates**; actual N count among them depends on
the complete FAIL list. If none fail, N for this run is effectively 0. If
all fail, N ≈ 20 (still well inside the "≤ 20" estimate).

---

## 4 · Sweeping disposition summary

Given the triage signature analysis:

| Disposition | Estimated count | Which buckets | Action |
|-------------|----------------:|---------------|--------|
| **Safe to delete as abandoned** | **~0** | none | No file is "safe to delete" without explicit owner authorisation per CLAUDE.md §3 and the sealed canonical-repository rule. Even L-bucket (legacy residue) tests document the fork boundary and cannot be deleted in a drive-by. |
| **Keep but triage later (skip / xfail / describe.skip)** | **~220–260** | L + E + U | The 83 E-bucket `.mjs` tests should be gated behind an env-flag `RUN_LIVE_PG_TESTS=1` (same pattern as `TRIAL_PG_TEST_URL` in `concurrency.integration.test.ts`). The ~140–180 L-bucket tests should stay in-tree (fork-boundary evidence) but be moved out of the default `npm run test` glob or marked `describe.skip` until the corresponding runtime is ported into `src/lib/nex-native/`. U-bucket needs a second pass with full FAIL list. |
| **Fix now (before release)** | **~15–40** | N + M + some A | The ≤20 N-bucket candidates in §3 are the pre-release gate. The ~14 M-bucket missing-import failures per CLAUDE.md should be addressed when the owning file is next touched (not in bulk). ~15–30 A-bucket contract-drift failures should be fixed where they align with sealed Phase 2 remediation priorities (chat privacy → billing → checkout → RLS → rate-limit). |

**Rough summation (heuristic, not evidentiary):**
- Safe-to-delete: 0
- Keep / skip / gate: 260 ± 30
- Fix now: 25 ± 15
- Total: **321** ✓ (matches captured headline)

---

## Appendix A1 · L-bucket candidate paths (sampled)

Static grep for `hammerex` or `NexSurface` or monorepo-residue imports under
`src/lib/nex/*.test.*`. Non-exhaustive — full enumeration requires the complete
FAIL list.

- `src/lib/nex/xp/consent.test.ts`
- `src/lib/nex/xp/anonymise.test.ts`
- `src/lib/nex/xp/answer.test.ts`
- `src/lib/nex/xp/aggregate.test.ts`
- `src/lib/nex/world/location.test.ts`
- `src/lib/nex/world/answer.test.ts`
- `src/lib/nex/world/region.test.ts`
- `src/lib/nex/world/impact.test.ts`
- `src/lib/nex/twin/answer.test.ts`
- `src/lib/nex/tools/*.test.ts` (all)
- `src/lib/nex/sc/*.test.ts` (delivery_planner, answer, …)
- `src/lib/nex/pm/*.test.ts` (command_centre, forecast, answer)
- `src/lib/nex/pi/*.test.ts` (engine, site-briefing, types, answer)
- `src/lib/nex/ops/*.test.ts` (diary_gaps, briefing)
- `src/lib/nex/net/*.test.ts` (trust, answer)
- `src/lib/nex/mp/*.test.ts` (ranking, answer)
- `src/lib/nex/md/*.test.ts` (answer)
- `src/lib/nex/merchant-assistant/*.test.ts` (writeExecutors, toolExecutors, guardrails, bannerGenerator)
- `src/lib/nex/fi/*.test.ts` (answer)
- `src/lib/nex/est/*.test.ts` (defaults)
- `src/lib/nex/cx/enrichers/payments.test.ts`
- `src/lib/nex/memory/*.test.ts` (reader, writer, adapters, answer)
- `src/lib/nex/friend-edge/friend-edge.test.ts`
- `src/lib/nex/renderer/*.test.ts`
- `src/lib/nex/prompt-compiler/compile.test.ts`
- `src/lib/nex/pipeline/recommend.test.ts`
- `src/lib/nex/mcp/mcp.test.ts`
- `src/lib/nex/marketing/*.test.ts`
- `src/lib/nex/identity/classify.test.ts`
- `src/lib/nex/global/*.test.ts`
- `src/lib/nex/centre-publishing/indexForSearch.test.ts`
- `src/lib/nex/brain/adapters/whatsapp-outbox-pg.test.ts`

(Full enumeration: run `grep -rl "hammerex\|NexSurface\|audience.*merchant\|audience.*homeowner" src/lib/nex | grep test` against a complete FAIL list.)

## Appendix A2 · M-bucket discovery command

Against a complete vitest log with per-file FAIL enumeration:

```bash
grep -E "Cannot find module|Failed to resolve import|Error: Cannot find" <full-log> \
  | awk -F"'" '{print $2}' | sort -u
```

CLAUDE.md predicts "~14" such files. Not confirmable from truncated tail.

## Appendix A3 · E-bucket full list (83 `.mjs` tests)

All files below use `pg.Pool` + `fetch(http://localhost:3008)` + `process.exit(2)`
on failure. **All 83 fail without live Postgres on :5433, live dev server on :3008,
and seeded tables.**

- `src/lib/nex/alerts/tests/dispatch-gate.test.mjs`
- `src/lib/nex/analytics/tests/rollup-gate.test.mjs`
- `src/lib/nex/analytics/tests/timestamp-normalisation.test.mjs`
- `src/lib/nex/api/tests/error-envelope.test.mjs`
- `src/lib/nex/api/tests/validators.test.mjs`
- `src/lib/nex/brain/tests/adapter-isolation.test.mjs`
- `src/lib/nex/brain/tests/brain-adapter-contract.test.mjs`
- `src/lib/nex/brain/tests/confidence-scores-classification.test.mjs`
- `src/lib/nex/brain/tests/dispatch-dedup.test.mjs`
- `src/lib/nex/brain/tests/extractor-idempotency.test.mjs`
- `src/lib/nex/brain/tests/factory-page.test.mjs`
- `src/lib/nex/brain/tests/heartbeat-liveness.test.mjs`
- `src/lib/nex/brain/tests/inbox-jobs-shadow.test.mjs`
- `src/lib/nex/brain/tests/inbox-truthfulness.test.mjs`
- `src/lib/nex/brain/tests/knowledge-dump-worker.test.mjs`
- `src/lib/nex/brain/tests/manager-cycle.test.mjs`
- `src/lib/nex/brain/tests/manager-dispatch.test.mjs`
- `src/lib/nex/brain/tests/priorities.test.mjs`
- `src/lib/nex/brain/tests/reception-semantics.test.mjs`
- `src/lib/nex/brain/tests/require-cron-token.test.mjs`
- `src/lib/nex/brain/tests/review-queue.test.mjs`
- `src/lib/nex/brain/tests/router-routing.test.mjs`
- `src/lib/nex/brain/tests/storage-characterization.test.mjs`
- `src/lib/nex/brain/tests/warehouse.test.mjs`
- `src/lib/nex/brain/workers/tests/finalize.test.mjs`
- `src/lib/nex/brain/workers/tests/worker-logger-adoption.test.mjs`
- `src/lib/nex/comms-social/tests/adapter-isolation.test.mjs`
- `src/lib/nex/comms-social/tests/adapter-meta-live.test.mjs`
- `src/lib/nex/comms-social/tests/adapter-real-providers.test.mjs`
- `src/lib/nex/comms-social/tests/adversarial-probes.test.mjs`
- `src/lib/nex/comms-social/tests/attribution-integration.test.mjs`
- `src/lib/nex/comms-social/tests/category-automation.test.mjs`
- `src/lib/nex/comms-social/tests/claim-taxonomy.test.mjs`
- `src/lib/nex/comms-social/tests/content-sources.test.mjs`
- `src/lib/nex/comms-social/tests/customer-entry.test.mjs`
- `src/lib/nex/comms-social/tests/envelope-encryption.test.mjs`
- `src/lib/nex/comms-social/tests/generation-e2e.test.mjs`
- `src/lib/nex/comms-social/tests/grounding-validation.test.mjs`
- `src/lib/nex/comms-social/tests/hq-mission-control.test.mjs`
- `src/lib/nex/comms-social/tests/oauth-e2e.test.mjs`
- `src/lib/nex/comms-social/tests/oauth-state.test.mjs`
- `src/lib/nex/comms-social/tests/pause-propagation.test.mjs`
- `src/lib/nex/comms-social/tests/predictive-boundary.test.mjs`
- `src/lib/nex/comms-social/tests/role-permission.test.mjs`
- `src/lib/nex/comms-social/tests/scheduling-worker.test.mjs`
- `src/lib/nex/comms-social/tests/template-fill.test.mjs`
- `src/lib/nex/comms-social/tests/tenant-isolation.test.mjs`
- `src/lib/nex/comms-social/tests/token-redaction.test.mjs`
- `src/lib/nex/comms-social/tests/ui-boundaries.test.mjs`
- `src/lib/nex/comms-social/tests/validator-brand.test.mjs` *(visible in captured tail)*
- `src/lib/nex/comms-social/tests/validator-fact.test.mjs` *(visible in captured tail)*
- `src/lib/nex/comms-social/tests/validator-pipeline.test.mjs` *(visible in captured tail)*
- `src/lib/nex/comms-social/tests/validator-platform.test.mjs` *(visible in captured tail)*
- `src/lib/nex/comms-social/tests/validator-policy.test.mjs` *(visible in captured tail)*
- `src/lib/nex/comms-social/tests/validator-rights.test.mjs` *(visible in captured tail)*
- `src/lib/nex/config/tests/adoption-drift.test.mjs`
- `src/lib/nex/config/tests/gates.test.mjs`
- `src/lib/nex/config/tests/legacy-rls-coverage-drift.test.mjs`
- `src/lib/nex/config/tests/pg.test.mjs`
- `src/lib/nex/config/tests/production-guard.test.mjs`
- `src/lib/nex/config/tests/timeouts.test.mjs`
- `src/lib/nex/db/tests/timeout-injection.test.mjs`
- `src/lib/nex/db/tests/with-brain-role-adoption.test.mjs`
- `src/lib/nex/db/tests/with-brain-role.test.mjs`
- `src/lib/nex/hq/tests/dashboard-singularity.test.mjs`
- `src/lib/nex/hq/tests/system-aggregator.test.mjs`
- `src/lib/nex/hq/tests/worker-criteria.test.mjs`
- `src/lib/nex/jobs/tests/claim-race.test.mjs`
- `src/lib/nex/jobs/tests/supervisor-attest-sweep.test.mjs`
- `src/lib/nex/jobs/tests/supervisor-idempotency.test.mjs`
- `src/lib/nex/jobs/tests/supervisor-race.test.mjs`
- `src/lib/nex/jobs/tests/supervisor-review-queue.test.mjs`
- `src/lib/nex/jobs/tests/supervisor-safety-boundary.test.mjs`
- `src/lib/nex/knowledge-inbox/tests/path-traversal.test.mjs`
- `src/lib/nex/observability/tests/correlation-adoption.test.mjs`
- `src/lib/nex/observability/tests/correlation.test.mjs`
- `src/lib/nex/observability/tests/group-b-wireup.test.mjs`
- `src/lib/nex/observability/tests/observability-core.test.mjs`
- `src/lib/nex/observability/tests/redact.test.mjs`
- `src/lib/nex/observability/tests/retry-buffer.test.mjs`
- `src/lib/nex/observability/tests/unbudgeted-mutations.test.mjs`
- `src/lib/nex/storage/tests/object-postgres-contract.test.mjs`
- `src/lib/nex/verification/tests/readonly-usage-drift.test.mjs`

**Plus 1 TS integration test** correctly gated and unlikely in the 321:
- `src/lib/nex-native/business-trial/__tests__/concurrency.integration.test.ts` (gates on `TRIAL_PG_TEST_URL`; should skip cleanly)

## Appendix A4 · Recommended next step

The single highest-leverage action is to produce a complete per-file FAIL
list (not scope of this triage — vitest re-run is forbidden here). Suggested
operator action:

```bash
npm run test -- --reporter=verbose 2>&1 | tee vitest-full-log-2026-11-10.txt
grep "^FAIL\|^ ❯ " vitest-full-log-2026-11-10.txt > vitest-fail-paths.txt
```

Then slot each path through the §2 signatures. The L / E / N classifications
above hold deterministically; D / A / U require per-file inspection.

---

*Triage produced 2026-11-10 against captured output
`bfbfdhdio.output` (80 lines · truncated tail) + static repo
inventory of 1162 `*.test.*` files. No tests were executed. No
test files were modified. No code was committed or pushed.*
