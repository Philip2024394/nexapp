# CLAUDE.md — nexapp

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
