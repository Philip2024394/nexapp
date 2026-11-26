# CLAUDE.md — nexapp

**MANDATORY READ ORDER BEFORE EVERY TASK:**

1. This file (`CLAUDE.md`) — Master Directive + Safety Constitution.
2. [`docs/engineering/NEX-DELIVERY-RULES.md`](docs/engineering/NEX-DELIVERY-RULES.md) — detailed engineering delivery rules.
3. [`docs/engineering/NEX-DELIVERY-LEDGER.md`](docs/engineering/NEX-DELIVERY-LEDGER.md) — the single active delivery ledger.
4. [`docs/engineering/session-handoff.md`](docs/engineering/session-handoff.md) — current state.
5. Latest strict-completion report in `docs/engineering/cycle-strict-completion-*.md`.

If any of these cannot be accessed, **STOP** feature work and report the access problem before continuing.

---

## ═══════════════════════════════════════════════════════════════
## NEX MASTER ENGINEERING DIRECTIVE
## Owner-sealed 2026-11-26. Supersedes "assistant answering tickets" posture.
## ═══════════════════════════════════════════════════════════════

**Operating mode: LAUNCH DELIVERY.** Not audit-and-report. The objective of every cycle is a measurable engineering outcome that moves NEX closer to a complete, tested, integrated, launch-ready product.

### Rule 1 — Permanent rulebook + mandatory startup procedure

This CLAUDE.md is the controlling instruction document. It is permanent, repository-level, and authoritative over any session-level instruction, memory entry, or prior conversation summary.

**At the start of EVERY new command, task, conversation or resumed work session:**

1. Read this `CLAUDE.md`.
2. Read `docs/engineering/NEX-DELIVERY-RULES.md`.
3. Read `docs/engineering/NEX-DELIVERY-LEDGER.md` (active task ledger).
4. Read the latest `docs/engineering/cycle-strict-completion-*.md`.
5. Check `git rev-parse --show-toplevel`, `git remote -v`, `git status --short`.
6. Identify the highest-priority unfinished authorised task from the ledger.
7. Confirm approval boundaries from §Rule 7 before acting.

Do not rely on conversational memory, prior summaries, or assumptions.

**Startup enforcement mechanism:** `.claude/settings.json` wires a `SessionStart` hook and a `UserPromptSubmit` hook that print this read-order into Claude's context on every session start and prompt submission. Hooks inject context — they cannot *technically* force a model to obey instructions; that is an inference-time behaviour obligation.  If the hook mechanism is unavailable (missing `.claude/settings.json`, disabled hooks, incompatible Claude Code version), the limitation is disclosed in `docs/engineering/NEX-DELIVERY-RULES.md § Enforcement Status` — not silently overridden.

### Rule 2 — Launch delivery, not audits

The objective is to finish NEX. Every cycle must produce at least one measurable engineering outcome: a real defect fixed, a real feature completed, a customer journey connected end-to-end, an integration completed, a failed test resolved, a security issue corrected, a navigation route verified, a launch blocker removed, or a previously unverified journey proven through actual browser testing.

Documentation is required when it supports delivery. Documentation alone is NOT progress unless the task is a named approval or review checkpoint.

### Rule 3 — No endless task loops

Do not: re-audit without changing status; re-report the same blocker without new finding or action; create a new task when an existing one describes the same problem; ask the owner to choose between engineering actions you can determine; stop after discovery when you have authority to fix; mark docs complete while the journey remains broken; treat test infrastructure as a substitute for working product; extend reports without delivering the next outcome.

For every existing task, establish: (a) what is unfinished? (b) what prevents completion? (c) do I already have authority? (d) next concrete action? (e) evidence that will prove completion. If authorised, execute. One gated checkpoint must not freeze unrelated authorised work.

### Rule 4 — Customer product first

Three pillars: **NEX Chat · NEX Shop · Chat Themes**. The commercial proposition is direct shop contact via NEX Chat. Prioritise complete customer journeys, not isolated components.

- **Chat** — account creation, sign-in, contact discovery, conversation creation, send/receive encrypted messages, attachments, notifications, settings, themes. Preserve device-based message/attachment storage and end-to-end encryption.
- **Shop** — business onboarding, shop creation, product creation, publishing, storefront display, discovery, product viewing, enquiry, chat handoff, order placement, merchant order management.
- **Chat Themes** — first selection screen simplified to three categories (Plain Backgrounds · Small Designs · Full Image Backgrounds) each opening its own image library using existing full-background layout. Bubble-colour selection page remains separate.
- **Payments** — merchant-owned destinations, authorised methods, order status handling, webhook validation, idempotency. NEX must not hold merchant funds or falsely claim verification.

### Rule 5 — Work end-to-end

Inspect the full affected journey and adjacent dependencies. Do not stop at the first file. Complete all necessary layers: UI, routing, auth, authorisation, DB integration, Supabase integration, storage rules, API actions, state persistence, notifications, error handling, mobile, desktop, country/deployment identity, automated tests.

No mockups, placeholders, or fake success states where real implementation is required. A feature is not complete because its screen renders — only when the intended real user journey works.

### Rule 6 — Testing drives delivery, does not paralyse it

Sequence: baseline → implement → focused tests → fix failures → adjacent journey tests → broader regression at checkpoints → record exact evidence.

Classify every failure: confirmed application defect · test defect · fixture/setup defect · environment/infrastructure · unknown.

Do not silently retry failures as passes. Do not call a suite green while failures/skips/unexecuted remain. Do not confuse an exit code with test results. Do not re-run the whole suite when a focused test answers the immediate question. Full regression at release checkpoints only.

### Rule 7 — Owner approval boundaries are absolute

**In force (require explicit owner approval to cross):**

- Production Supabase (`ijvqdvsvwtwxzcqmoqit`) sealed — no prod DB access or modification.
- No production migration application.
- No production deployment.
- **No commits.**
- **No pushes.**
- No live Stripe or PayPal activation.

Sandbox engineering (`kdstoyyeygcopkogqsyv`) may proceed within existing approvals.

Do not weaken authentication, RLS, encryption, account isolation, payment protections or privacy controls to make tests pass. Permission to inspect ≠ permission to apply. Permission to test a payment integration ≠ permission to charge real customers.

### Rule 8 — No false completion

Status taxonomy — use exactly these:

- **BUILT** — implementation exists.
- **WIRED** — connected to real dependencies.
- **VERIFIED** — actual test evidence proves intended behaviour.
- **BLOCKED** — specific dependency or owner decision prevents progress.
- **FAILED** — test or implementation did not work.
- **SKIPPED** — deliberately not executed, with reason.
- **NOT EXECUTED** — not attempted.

Do not use VERIFIED when only code inspection occurred. Do not use COMPLETE when a journey is broken. Do not use LAUNCH-READY while material launch gates are open. Do not convert unknown failures into environment issues without evidence.

### Rule 9 — Every cycle must deliver

At start: read rulebook → read ledger → identify highest-priority unfinished authorised work → identify expected concrete result.

During: execute → fix related defects within authority → avoid unrelated investigations → update durable records only when status changes.

End-of-cycle report (mandatory sections):

1. BUILT · 2. WIRED · 3. VERIFIED · 4. FAILED · 5. SKIPPED · 6. NOT EXECUTED · 7. CUSTOMER JOURNEYS COMPLETED · 8. LAUNCH BLOCKERS REMOVED · 9. REMAINING BLOCKERS · 10. NEXT CONCRETE ENGINEERING ACTION.

Plus: exact files changed, exact tests executed, measurable comparison with previous cycle. If no engineering progress, explain exactly why. Do not make a long report the main deliverable when implementation could have been completed.

### Rule 10 — One source of truth

`docs/engineering/NEX-DELIVERY-LEDGER.md` is the single active engineering task ledger. Every task: unique ID, clear outcome, priority, owner-approval requirement, current status (from Rule 8 taxonomy), exact blocker, next action, verification evidence, date last progressed.

No duplicate tasks for the same defect. No completion based on documentation alone. Resolve inconsistencies between ledger, feature-ledger, nav inventory, and launch report.

### Rule 11 — Protect the architecture

Preserve: one shared codebase · shared Supabase architecture · Ireland/Indonesia/HQ deployment identities · `NEX_APP_IDENTITY` and `NEX_APP_COUNTRY` · no global DB singleton switching · HQ desktop-only controls outside the phone interface · Ireland improvements update Worldwide by default unless restricted · prevent obsolete country routes from returning.

Do not make broad architectural changes to solve narrow UI problems.

### Rule 12 — No more waiting for the owner to manage engineering

The owner makes product, commercial, financial, security and production decisions. The owner does not: organise routine development, pick between known defects, re-request obvious actions, supervise ordinary integration, chase test evidence, re-explain the architecture, re-approve already-authorised tasks.

Escalate genuine product/financial/security/production decisions only.

---

## ═══════════════════════════════════════════════════════════════
## NEXAPP REPOSITORY AND DEPLOYMENT SAFETY CONSTITUTION
## Pre-existing seals. Preserved in force.
## ═══════════════════════════════════════════════════════════════

### 1 · Authoritative repository identity

The nexapp repository is:

- **GitHub**: `Philip2024394/nexapp`
- **Local root**: `C:/Users/Victus/nexapp`
- **Intended production branch**: `main`, subject to confirmation against the live deployment configuration.

These values are *expected* configuration, not permission to assume the live configuration matches them. Verify before every Git operation that can change repository state.

### 2 · Mandatory preflight

Before staging, committing, pushing, merging, rebasing, or deploying:

1. Print and verify `git rev-parse --show-toplevel`.
2. Print and verify `git remote -v`.
3. Print the current branch, HEAD commit, upstream and `git status --short`.
4. Confirm the intended destination repository and branch against the task authorisation.
5. Check whether unrelated staged, unstaged or untracked work exists.
6. Inspect the exact proposed file and commit scope.

If repository identity is unexpected, ambiguous, or cannot be verified, **STOP**. Do not attempt to fix the problem by changing remotes or switching repositories.

### 3 · Local changes and commits

- Local edits and tests are allowed within the authorised project scope.
- Create commits only when authorised for that task.
- Stage explicit file paths, not `git add .` or `git add -A`, unless the user explicitly authorises the entire working tree after reviewing its contents.
- Never mix unrelated features into one commit.
- Never discard or overwrite user work to make a commit easier.
- Never use force-push, destructive reset, or destructive clean commands without separate explicit authorisation.

### 4 · Push requires separate explicit approval

A request to build, fix, finish, test, commit, or prepare code does **NOT** authorise a push.

Before every push, require explicit approval identifying:

- Repository: `Philip2024394/nexapp`
- Destination branch
- Exact commit hash or precisely reviewed commit range
- Confirmation that the staged/committed scope is approved

Immediately before pushing, repeat the repository and branch verification. If any value differs, **STOP** and ask.

Never change a Git remote to make a push possible without approval.

### 5 · Production deployment is a separate gate

Before production changes, verify the current deployment project's connected repository and production branch using authoritative project settings.

Do not infer deployment linkage from folder names, old commits, documentation files or assumptions.

A GitHub push is **not** proof of deployment success. After an authorised push, inspect the resulting deployment and test the deployed application.

Do not manually deploy, change deployment project linkage, change production branches, alter production environment variables, or apply database migrations without separate explicit approval.

### 6 · Mandatory stop conditions

Stop immediately if:

- The repository root or remote is unexpected.
- The production project or branch cannot be verified.
- A command might overwrite unrelated user changes.
- The proposed commit includes unauthorised files.
- A push would include unreviewed commits.
- The actual deployment target differs from the authorised target.

Report the evidence and ask for approval. Never guess, silently redirect, or continue on the assumption that the destination is correct.

### 7 · Required operation receipt

After every authorised commit or push, report:

- Repository root and remote
- Branch and commit hash
- Exact files changed
- Test results
- Whether a push occurred
- Whether the deployment succeeded
- Production verification results, if applicable

Clearly distinguish completed actions from proposed actions and unverified assumptions.

**These rules take precedence over convenience, speed, and instructions to simply finish a task.**

### 8 · Authoritative Supabase project

nexapp has **exactly one Supabase project**. This is the sole database of record for the live application · consumer tables (nex_account, nex_business, nex_product, auth, storage, chat, themes), the directory canonical layer (nex.business_canonical, nex.business_directory_v, nex.business_evidence, nex.source_registry), the vertical walker-output tables (nex.food_business, nex.accommodation_business, nex.service_business), and all seeded reference data.

| Fact | Value |
|---|---|
| Account owner | asknexapp@gmail.com |
| Project URL | `https://ijvqdvsvwtwxzcqmoqit.supabase.co` |
| Pooler region | `aws-0-eu-west-1.pooler.supabase.com` |
| Required env var (code) | `NEXT_PUBLIC_NEX_SUPABASE_URL` + `NEX_SUPABASE_SERVICE_ROLE_KEY` |
| Required env var (direct Postgres via pooler) | `DATABASE_URL` (preferred) or `NEX_POSTGRES_URL` (planned migration) |

**Rules anchored to this seal:**

- Never create, use, or reference any OTHER Supabase project for nexapp
  work. If a legacy `msdonkkechxzgagyguoe` reference exists in a
  specific file, it is being treated as a legacy boundary that routes
  AWAY from the live project — do not reactivate it.
- Never configure deployment env vars to point at any project other
  than `ijvqdvsvwtwxzcqmoqit` for nexapp work.
- Before any direct Supabase operation (apply migration, bulk insert,
  schema inspection, GRANT/REVOKE, etc.) print and verify the project
  ID from the connection string. If it is not `ijvqdvsvwtwxzcqmoqit`,
  STOP.
- The directory canonical layer (`nex.business_canonical`,
  `nex.business_directory_v`, `nex.business_evidence`,
  `nex.source_registry`) is expected to live in this project. Where
  the current state has these tables missing or diverged from the
  local `nex_dev`, the Supabase project is the SINGLE source of truth
  going forward · the migration + backfill plan must bring Supabase
  up to date, not create a parallel DB.
- Any application code reading canonical directory data MUST connect
  to this Supabase project (via pooler or REST). Writes to any other
  Postgres (e.g. a local `nex_dev` for development) are DEVELOPMENT
  ONLY and must never be assumed to replicate automatically.

## ═══════════════════════════════════════════════════════════════
## End Safety Constitution
## ═══════════════════════════════════════════════════════════════

## 10 · Non-negotiable Definition of Done for perf fixes

Owner-sealed 2026-11-23. Applies to any change touching loading,
navigation, caching, message rendering, hydration, asset payloads,
or related infrastructure.

**No perf fix is complete until ALL FOUR are in place:**

1. **Verified improvement** — a measurement under stated conditions
   (production build, specified network/CPU profile, repeated samples,
   median AND tail reported). A single curl, a single dev-mode run,
   or an eyeballed "feels faster" does not count.
2. **Regression test** — automated test that reproduces the original
   failure mode against observable behavior (network requests, DOM,
   timing budgets), not a hard-coded filename grep. The test must
   fail if the fix is reverted.
3. **Required CI enforcement** — the test runs on every PR to
   protected branches as a required status check that blocks
   merging. A workflow file alone is not enough. If branch-protection
   enforcement is blocked by access, the fix is INCOMPLETE and the
   blocker must be reported, not papered over.
4. **Updated project record** — blueprint entry (below) captures the
   original problem, affected files, test name, budget, and how to
   re-run.

If any of the four is missing, the fix is incomplete. A local passing
test, a written reminder, or an un-enforced workflow is not enough.
Budget relaxation or test removal requires explicit owner approval
with a documented reason. Never silently waive this rule.

### 10.1 · Verified loading-fix blueprint

Sessions touching perf must preserve these guarantees. Each entry is:

**Original problem** · **Files** · **Test** · **Budget** · **Run command**

#### 10.1.1 · Backdrop preload mobile skip + Supabase preconnect
- **Original problem:** `src/app/nex-native/layout.tsx` unconditionally
  preloaded a 2.1 MB country-specific backdrop PNG on every route,
  including mobile viewports where the CSS backdrop rule is
  `@media (min-width: 500px)` gated and the image is never painted.
  No preconnect for Supabase, so every signed-in route paid a cold-
  TLS round-trip before the first auth / data query.
- **Files:** `src/app/nex-native/layout.tsx` (preload + preconnect
  block ~lines 240-290).
- **Test:** `tests/e2e/perf-regression-asset-budgets.spec.ts` ·
  three assertions: (a) no unconditional image preload ≥ 600 KB on
  desktop, (b) no large image preload is active for a Pixel 7
  viewport, (c) Supabase origin has a preconnect/dns-prefetch hint
  when `NEXT_PUBLIC_NEX_SUPABASE_URL` is set.
- **Budget:** `PRELOAD_IMAGE_BUDGET_BYTES = 600 * 1024` (600 KB).
  Any single image preload above the budget must carry a
  `media="(min-width: Npx)"` attribute or the test fails.
- **Run command:**
  `npx playwright test --config=playwright.perf-regression.config.ts`
- **CI enforcement:** `.github/workflows/perf-regression.yml` runs on
  every PR to `main` and `release-audit-v1-2026-11-14`.

#### 10.1.2 · Deployment chain verification endpoint
- **Original problem:** no way to confirm which commit the live
  Worker was actually serving. Wrangler OAuth lacked
  `workers_scripts:read` scope so `wrangler versions list` failed;
  the dashboard was the only source of truth and it is manual.
- **Files:** `src/app/api/nex-native/version/route.ts`
- **Test:** `tests/e2e/perf-regression-deployment-chain.spec.ts` ·
  opt-in via `PREVIEW_URL` + `EXPECTED_COMMIT_SHA` env vars. When
  unset, the test is skipped (visible in the report) rather than
  silently passing.
- **Budget:** N/A · exact match against expected commit SHA.
- **Run command:**
  `PREVIEW_URL=https://nexapp-preview.nex-sandbox.workers.dev EXPECTED_COMMIT_SHA=$(git rev-parse HEAD) npx playwright test --config=playwright.perf-regression.config.ts --grep "deployment chain"`

### 10.2 · Adding new perf fixes

When you fix a loading issue, before closing the task:

1. Add a `perf-regression-*.spec.ts` that reproduces the original
   failure mode. The test must cover observable behavior · network
   requests, DOM contents, timing budgets · not source-code greps.
2. Wire it into `playwright.perf-regression.config.ts` (the
   `testMatch` already covers `perf-regression-*.spec.ts`).
3. Verify the test fails against the un-fixed code (prove fail-then-pass).
4. Add a new entry to §10.1 with the same five-field shape.
5. Confirm the GitHub check is enforced on the protected branch
   (branch-protection rulesets · see §10.3). If enforcement is not
   active, the task is BLOCKED, not complete.

### 10.3 · Enforcement status

As of 2026-11-23 branch protection rulesets are NOT configured on
`Philip2024394/nexapp`. The perf-regression workflow runs on every PR
and push, but its result does not block merges until the owner adds
a repository ruleset that requires the "Playwright perf asset
budgets" check. Adding that ruleset is the remaining step to make
this rule fully enforced · see `docs/doctrine/perf-regression-
enforcement-2026-11-23.md` for the exact check names to require.

## 9 · Session-start reading (required before changing code)

See the "MANDATORY READ ORDER BEFORE EVERY TASK" block at the very top of this file. This section is preserved for historical reference but is superseded by Rule 1 of the Master Directive above.

Legacy order (pre-2026-11-26):

1. `docs/product/nex-blueprint.md` — complete NEX app structure.
2. `docs/engineering/session-handoff.md` — the one record of where we are.
3. `docs/product/feature-ledger.md` — authoritative feature status.
4. `docs/architecture/decisions/README.md` — index of ADRs.
5. Any requirement in `docs/product/requirements/` matching your task.

**These docs win over any conversational memory or prior-session summary.**

**Delta-only rule.** If the blueprint says a journey is MAPPED or a decision is SEALED, do not re-audit it. If a feature is NOT VERIFIED in `feature-ledger.md`, that is the only work queue. Sub-agents spawned from any session must be briefed with the relevant blueprint sections and instructed: "delta only · do not re-inspect VERIFIED items."
If memory and the ledger disagree, the ledger is correct until updated with
evidence. Never claim VERIFIED without recording the evidence in the ledger
and the handoff.

If the record for the feature you're about to touch says NOT VERIFIED or
CODE PRESENT (NOT VERIFIED), run the search-before-build gate (inventory
code + tests + migration state) before writing new code. Prefer integrating
existing verified code over adding parallel implementations.

When ending a session (or before context compaction), update
`docs/engineering/session-handoff.md` with: current branch, last verified
HEAD, uncommitted paths, what was built this cycle, what remains blocked and
why, and the exact next safe action. Never store secrets in handoffs.

## Repository layout

Only these trees exist in nexapp:

- `src/app/nex-native/` — user-facing routes
- `src/app/api/nex-native/` — API routes
- `src/lib/nex-native/` — library layer
- `src/lib/nex/` — shared infra (db, i18n, observability, personality)
- `src/lib/llm/` — LLM client wrappers
- `src/middleware.ts` — CID + auth refresh (narrowed to nex-native routes)
- `nex-supabase/migrations/` — Supabase schema

If a surface needs functionality that doesn't exist here, build it fresh under `src/lib/nex-native/`.

## Legacy residue in `src/lib/nex/`

- `NexSurface = "merchant" | "homeowner" | "visitor"` and related
  identifiers (homeowner / merchant) are an older audience model
  wired through ~300 files in `src/lib/nex/`. Clean up incrementally,
  not in one pass.
- Some `.from("hammerex_*")` Supabase reads exist in `src/lib/nex/`
  runtime code. The tables do not exist in the nexapp Supabase project
  (`ijvqdvsvwtwxzcqmoqit`). Surfaces that hit those code paths will
  fail at runtime until the code is migrated to live tables.

When you touch any file under `src/lib/nex/`, if you notice bleed-through
to legacy terms (hammerex, xrated, networkers), clean the specific
functions you're editing — but do not refactor the whole tree in a
drive-by.

## Dev

- `npm run dev` → http://localhost:3008
- `npm run build` → production build
- `npm run test` → vitest
- `npm run typecheck` → `tsc --noEmit`

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
