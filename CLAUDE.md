# CLAUDE.md — nexapp

## ═══════════════════════════════════════════════════════════════
## NEX REPOSITORY AND DEPLOYMENT SAFETY CONSTITUTION
## Installed 2026-10-12 · Takes precedence over every other instruction
## ═══════════════════════════════════════════════════════════════

### 1 · Authoritative repository identity

The intended NEX application repository is:

- **GitHub**: `Philip2024394/nexapp`
- **Local root**: `C:/Users/Victus/nexapp`
- **Intended production branch**: `main`, subject to confirmation against the live Vercel configuration.

`Philip2024394/trades` is a separate repository. **Never treat it as the NEX deployment repository.**

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

Never push NEX application work to `trades.git`. Never change a Git remote to make a push possible without approval.

### 5 · Production deployment is a separate gate

Before production changes, verify the current Vercel project's connected repository and production branch using authoritative project settings.

Do not infer Vercel linkage from folder names, old commits, documentation files or assumptions.

A GitHub push is **not** proof of deployment success. After an authorised push, inspect the resulting deployment and test the deployed application.

Do not manually deploy, change Vercel project linkage, change production branches, alter production environment variables, or apply database migrations without separate explicit approval.

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
- Whether Vercel deployed
- Production verification results, if applicable

Clearly distinguish completed actions from proposed actions and unverified assumptions.

**These rules take precedence over convenience, speed, and instructions to simply finish a task.**

### 8 · Authoritative Supabase project (sealed 2026-10-12)

NEX nexapp has **exactly one Supabase project**. This is the sole
database of record for the live NEX application · consumer tables
(nex_account, nex_business, nex_product, auth, storage, chat, themes),
the directory canonical layer (nex.business_canonical, nex.business_
directory_v, nex.business_evidence, nex.source_registry), the vertical
walker-output tables (nex.food_business, nex.accommodation_business,
nex.service_business), and all seeded reference data.

| Fact | Value |
|---|---|
| Account owner | asknexapp@gmail.com |
| Project URL | `https://ijvqdvsvwtwxzcqmoqit.supabase.co` |
| Pooler region | `aws-0-eu-west-1.pooler.supabase.com` |
| Required env var (code) | `NEXT_PUBLIC_NEX_SUPABASE_URL` + `NEX_SUPABASE_SERVICE_ROLE_KEY` |
| Required env var (direct Postgres via pooler) | `DATABASE_URL` (preferred) or `NEX_POSTGRES_URL` (planned migration) |

**Rules anchored to this seal:**

- Never create, use, or reference any OTHER Supabase project for NEX
  work. If a legacy `msdonkkechxzgagyguoe` reference exists in a
  specific file, it is being treated as a legacy boundary that routes
  AWAY from the NEX project — do not reactivate it.
- Never configure Vercel's production env vars to point at any
  project other than `ijvqdvsvwtwxzcqmoqit` for NEX work.
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

**Current credentials state (2026-10-12)**:

- `.env.local` carries a working `DATABASE_URL` with pooler
  credentials for `ijvqdvsvwtwxzcqmoqit`.
- `.env.local` ALSO carries a stale `SUPABASE_URL` +
  `NEXT_PUBLIC_SUPABASE_URL` pointing at a non-existent
  `msdonkkechxzgagyguoe` project. These unprefixed env vars should be
  updated to the correct project but the code already routes around
  them via `NEXT_PUBLIC_NEX_SUPABASE_URL`. Fixing the stale vars is
  cosmetic cleanup, not an availability blocker.
- `NEX_POSTGRES_URL` currently points at `localhost:5433` (local
  `nex_dev`). The directory read path uses this env var. Switching
  nexapp to read from Supabase requires either (a) applying the
  directory canonical migrations to Supabase and setting
  `NEX_POSTGRES_URL` to the Supabase pooler, or (b) changing the
  `@/lib/nex/db` layer to use the Supabase REST client. See the
  Supabase migration plan when authored.

## ═══════════════════════════════════════════════════════════════
## End Safety Constitution
## ═══════════════════════════════════════════════════════════════

This IS the NEX app standalone repo (as of 2026-10-10).

The sealed multi-product monorepo remains at `D:/trades` as the
historical source of truth for Vault, Socials, Directory Spine, and
other NEX work preserved there. New NEX work from 2026-10-10 forward
happens in **this repo**.

## Fork boundary

Only these trees exist here:

- `src/app/nex-native/` — user-facing NEX routes
- `src/app/api/nex-native/` — NEX API routes
- `src/lib/nex-native/` — NEX library layer
- `src/lib/nex/` — shared NEX infra (db, i18n, observability, brain, personality)
- `src/lib/llm/` — LLM client wrappers
- `src/middleware.ts` — CID + auth refresh (narrowed to NEX routes only)
- `nex-supabase/migrations/` — NEX Supabase schema

Products that were in the source monorepo but NOT in this fork:
trade-off, hammerex, xrated-trades, thenetworkers, van-wrap,
apprenticeships, homeowners, trade-center. Do not try to pull them
back in — if a NEX surface needs functionality from one of those,
either (a) port the required pieces cleanly, or (b) build the
functionality fresh under `src/lib/nex-native/`.

## Cross-cutting rules

The owner's global rules live at `C:/Users/Victus/.claude/CLAUDE.md`.
That file is the source of truth for repo-identity rules — specifically:

- The user's canonical NEX repo mapping (`D:/trades` is still the
  historical sealed source; this new standalone repo is additive, not
  a replacement, until the owner explicitly deprecates `D:/trades`).
- Sealed commits and preservation checkpoints referenced in global
  memory point at `D:/trades` — treat them as historical. New seals
  from this repo onward should be anchored to **this** repo's commits.

## Fork hygiene

Known legacy residue in `src/lib/nex/`:

- `NexSurface = "merchant" | "homeowner" | "visitor"` and related
  identifiers (homeowner / merchant) are inherited from the source
  monorepo's audience model. In the current NEX world (Directory +
  Socials lenses), these may be semantically obsolete, but they are
  wired through ~300 files in `src/lib/nex/`. Clean up incrementally,
  not in one pass.
- Some `.from("hammerex_*")` Supabase reads exist in `src/lib/nex/`
  runtime code. The tables may not exist in the NEX Supabase project
  (`ijvqdvsvwtwxzcqmoqit`). Surfaces that hit those code paths will
  fail at runtime until migrated.

When you touch any file under `src/lib/nex/`, if you notice bleed-through
to legacy terms (hammerex, trade-off, xrated, networkers), clean the
specific functions you're editing — but do not refactor the whole tree
in a drive-by.

## Dev

- `npm run dev` → http://localhost:3008
- `npm run build` → production build
- `npm run test` → vitest (795 test files; ~14 known broken imports from
  missing deps — do not fix in bulk, address when touching the files)
- `npm run typecheck` → `tsc --noEmit`

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
