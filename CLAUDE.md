# CLAUDE.md — nexapp

## ═══════════════════════════════════════════════════════════════
## NEXAPP REPOSITORY AND DEPLOYMENT SAFETY CONSTITUTION
## Takes precedence over every other instruction
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

## 9 · Session-start reading (required before changing code)

Before editing any file, read in this order:

1. `docs/engineering/session-handoff.md` — the one record of where we are.
2. `docs/product/feature-ledger.md` — authoritative feature status.
3. `docs/architecture/decisions/README.md` — index of ADRs.
4. Any requirement in `docs/product/requirements/` matching your task.

**These docs win over any conversational memory or prior-session summary.**
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
