# NEX Delivery Rules

**Sealed** 2026-11-26 by owner directive "NEX MASTER ENGINEERING DIRECTIVE · MANDATORY RULEBOOK · NO MORE DEVELOPMENT LOOPS · LAUNCH DELIVERY MODE". Companion to `CLAUDE.md` at the repo root. Read both before every task.

---

## 1 · Operating mode

**LAUNCH DELIVERY.** Every cycle must produce at least one measurable engineering outcome: defect fixed · feature completed · journey connected end-to-end · integration completed · failed test resolved · security issue corrected · navigation route verified · launch blocker removed · previously unverified journey proven in-browser.

Documentation only counts when the cycle is a named approval or review checkpoint. Reports, audits, plans and new task lists are not delivery.

## 2 · Mandatory startup procedure

At the start of EVERY new command, task, conversation or resumed work session:

1. Read `CLAUDE.md`.
2. Read `docs/engineering/NEX-DELIVERY-RULES.md` (this file).
3. Read `docs/engineering/NEX-DELIVERY-LEDGER.md` — the single active delivery ledger.
4. Read the latest `docs/engineering/cycle-strict-completion-*.md`.
5. `git rev-parse --show-toplevel && git remote -v && git status --short`.
6. Identify the highest-priority unfinished authorised ledger entry.
7. Confirm approval boundaries (§6) before acting.

If any mandatory file cannot be accessed, STOP feature work and report the access problem.

## 3 · Status taxonomy (use these exactly)

| Status | Meaning |
|---|---|
| **BUILT** | Implementation exists in the tree. |
| **WIRED** | Connected to real dependencies (DB, routes, services, env). |
| **VERIFIED** | Actual test evidence proves the intended behaviour. |
| **BLOCKED** | Specific dependency or owner decision prevents progress. Name it. |
| **FAILED** | Test or implementation did not work. |
| **SKIPPED** | Deliberately not executed, with reason. |
| **NOT EXECUTED** | Not attempted. |

Prohibited: VERIFIED without observable test evidence · COMPLETE while a journey is broken · LAUNCH-READY while material gates are open · classifying unknowns as environment issues without proof.

## 4 · Failure classification (every triage uses these)

| Class | Meaning |
|---|---|
| **APPLICATION DEFECT** | Product code does not meet the specified behaviour. |
| **TEST DEFECT** | Test code is wrong (bad selector, race, incorrect assumption). |
| **FIXTURE / SETUP DEFECT** | Seed data or storage state is missing or wrong. |
| **ENVIRONMENT / INFRASTRUCTURE** | Network, dev server, DB pooler, provider API. Must be reproducible evidence, not a guess. |
| **UNKNOWN** | Investigation not complete. Explicit — never silently absorbed into another class. |

Do not classify failures as "pre-existing" to sidestep triage. Every failure gets its own class above, regardless of whether a prior baseline saw it.

## 5 · Testing sequence

1. Record the relevant baseline (counts, exit code, duration).
2. Implement the authorised change.
3. Run focused tests that answer the immediate question.
4. Fix failures caused by the change.
5. Run adjacent customer-journey tests.
6. Full regression at release checkpoints only.
7. Record the exact evidence: command, duration, PASS/FAIL/SKIP/DID NOT RUN counts, exit code, project coverage.

Prohibitions:

- Silent retry of failures counted as passes.
- Calling a suite green while failures/skips/unexecuted remain.
- Confusing exit code with test results. An exit 0 with reported failures is a reporting discrepancy, not a pass.
- Re-running the full suite when a focused test answers the question.
- Capturing the run without redirecting stdout/stderr to a preserved file AND capturing `echo $?` immediately.

**Required run envelope** for every Playwright run that produces decisions:

```
LOG="tests/e2e/_runs/$(date -u +%Y%m%dT%H%M%SZ)-<label>.log"
npx playwright test [args] 2>&1 | tee "$LOG"; echo "EXIT=${PIPESTATUS[0]}" | tee -a "$LOG"
```

`${PIPESTATUS[0]}` captures Playwright's own exit code even through the `tee`. Any run reported without the log path + EXIT line is treated as unverifiable.

## 6 · Approval boundaries (absolute)

Require explicit owner approval before crossing:

- Production Supabase (`ijvqdvsvwtwxzcqmoqit`) — any access or modification.
- Production migration application.
- Production deployment.
- Commits.
- Pushes.
- Live Stripe or PayPal activation.
- Any weakening of auth, RLS, encryption, account isolation, payment protections, privacy controls.

Permission to inspect ≠ permission to apply. Permission to test a payment integration ≠ permission to charge real customers. Permission for a prior task does not extend to a new one.

Sandbox engineering against `kdstoyyeygcopkogqsyv` and local-only edits may proceed within standing approvals.

## 7 · Cycle report format

Mandatory sections:

1. **BUILT** — what was authored.
2. **WIRED** — what was connected.
3. **VERIFIED** — what was proven, with command + evidence.
4. **FAILED** — classified per §4.
5. **SKIPPED** — with named reason.
6. **NOT EXECUTED** — with named reason.
7. **CUSTOMER JOURNEYS COMPLETED** — end-to-end.
8. **LAUNCH BLOCKERS REMOVED**.
9. **REMAINING BLOCKERS**.
10. **NEXT CONCRETE ENGINEERING ACTION**.

Plus:

- Exact files changed.
- Exact tests executed with log paths.
- Measurable comparison to previous cycle.
- If no engineering progress, explain exactly why.

## 8 · Ledger discipline

`docs/engineering/NEX-DELIVERY-LEDGER.md` is the single active engineering ledger. Entry fields:

- Unique ID.
- Clear outcome.
- Priority (P0 launch-critical · P1 required-for-launch · P2 near-launch · P3 nice-to-have).
- Owner-approval requirement (yes/no, scope).
- Current status (§3 taxonomy).
- Exact blocker.
- Next concrete action.
- Verification evidence.
- Date last progressed.

No duplicates. No doc-only completions. Conflicts between ledger, feature-ledger, nav inventory and launch report must be resolved — not left standing.

## 9 · Enforcement status

Claude Code supports repository hooks via `.claude/settings.json`. Two hook events are used to reinforce the mandatory startup procedure:

- **`SessionStart`** — prints a reminder to read `CLAUDE.md` + `NEX-DELIVERY-RULES.md` + `NEX-DELIVERY-LEDGER.md` when Claude Code starts a session in this repo.
- **`UserPromptSubmit`** — prints the same reminder on each user prompt in long sessions where the system reminder may rotate out.

See `.claude/settings.json` for the exact hook configuration.

**Honest limitation disclosure:**

- Claude Code hooks inject text into the model's context. They can REMIND the model of the rules. They **cannot technically prevent** a model from acting against instructions — that remains an inference-time obligation.
- Hooks only fire when Claude Code is the runtime. Other Claude surfaces (claude.ai web, API direct) will not execute these hooks.
- If Claude Code version does not support the configured hook events, the SessionStart message will not appear and the fallback is a visible first-line reminder inserted into `CLAUDE.md` itself (the "MANDATORY READ ORDER BEFORE EVERY TASK" block at the very top of that file).
- No branch protection or CI gate currently enforces that `CLAUDE.md`/this file are read by human contributors. The repository-level ruleset referenced in `CLAUDE.md § 10.3` for perf-regression is the only existing CI enforcement, and it covers perf only.

Do not claim "hook-enforced rulebook reads" beyond what the actual mechanism supports.

## 10 · Prohibited patterns

- Re-auditing a feature without changing its status.
- Reopening the same investigation without a new finding.
- Creating a task when an existing task describes the same defect.
- Asking the owner to choose between engineering actions you have authority to decide.
- Stopping after discovery when authorised to fix.
- Marking a doc complete while the underlying journey is broken.
- Treating test infrastructure as a substitute for working product functionality.
- Writing another full report when implementation could have been performed.
- Running the full suite without `tee` + `${PIPESTATUS[0]}` capture.
- Classifying failures as "pre-existing" or "environment" without evidence.
