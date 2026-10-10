# nexapp

Standalone NEX app repo.

## What this is

A clean fork of the NEX surfaces from the multi-product monorepo at
`D:/trades`, extracted on 2026-10-10. Only NEX code lives here:

- `src/app/nex-native/` — NEX user-facing routes
- `src/app/api/nex-native/` — NEX API routes
- `src/lib/nex-native/` — NEX library layer (vault, socials, directory, etc.)
- `src/lib/nex/` — shared NEX infrastructure (db, i18n, observability, brain)
- `src/lib/llm/` — LLM client wrappers
- `nex-supabase/migrations/` — NEX Supabase schema migrations
- `src/middleware.ts` — edge middleware (CID + auth-session refresh)

Products that lived alongside NEX in the source monorepo (trade-off,
hammerex, xrated-trades, thenetworkers, van-wrap, apprenticeships,
homeowners, trade-center) were intentionally left behind. They remain
in `D:/trades` as the historical multi-product repo.

## Dev

```
npm install
npm run dev        # http://localhost:3008
npm run build
npm run test       # vitest
npm run typecheck  # tsc --noEmit
```

Port 3008 matches `D:/trades` for consistency.

## Supabase

Production project ref: `ijvqdvsvwtwxzcqmoqit`

Migrations live under `nex-supabase/migrations/`. Apply via Supabase CLI
against the project directly — do not re-apply migrations that are
already in production (consult `D:/trades` seal memories for what has
been applied).

## Known debt from the fork

The fork was created by file copy, not refactor. A few known issues to
clean up in follow-up work:

- `src/lib/nex/` retains legacy identifier bleed-through from the source
  monorepo (`homeowner`/`merchant` audience types baked into shared
  types like `NexSurface`; some `.from("hammerex_*")` Supabase table
  reads that will fail against the NEX project). These do not affect
  compilation but should be cleaned up incrementally.
- Some tests under `src/lib/nex/__tests__/` import paths that were not
  copied (e.g., `@/lib/crm/`, `@/lib/products/`, `@/components/`). The
  affected tests will not run until deps are brought over or tests
  trimmed.
- `src/app/nex-native/affiliate/am-5-preview/_fixtures.ts` references a
  legacy mock seller (`HAMMEREX_TOOLS`) — purely a fixture name.
- `src/app/nex-native/layout.tsx` reads `NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY`;
  rename to `NEXT_PUBLIC_NEX_VAPID_PUBLIC_KEY` after confirming no
  deployed env relies on the old name.

## Historical context

The folder at this path was previously a 23-file prototype scaffold
quarantined on 2026-10-09 (`_THIS_IS_NOT_THE_APP.md`). On 2026-10-10
the owner promoted it to be the real standalone NEX app repo. The
pre-promotion state is preserved on branch `pre-nex-fork-20261010-200712`
and in a stash entry of the same name.

Remote: `https://github.com/Philip2024394/nexapp.git`
