# nexapp

Standalone NEX app repo.

## Layout

- `src/app/nex-native/` — user-facing routes
- `src/app/api/nex-native/` — API routes
- `src/lib/nex-native/` — library layer (vault, socials, directory, etc.)
- `src/lib/nex/` — shared infrastructure (db, i18n, observability)
- `src/lib/llm/` — LLM client wrappers
- `nex-supabase/migrations/` — Supabase schema migrations
- `src/middleware.ts` — edge middleware (CID + auth-session refresh)

## Dev

```
npm install
npm run dev        # http://localhost:3008
npm run build
npm run test       # vitest
npm run typecheck  # tsc --noEmit
```

## Supabase

Production project ref: `ijvqdvsvwtwxzcqmoqit`

Migrations live under `nex-supabase/migrations/`. Apply via Supabase CLI
against the project directly — do not re-apply migrations that are
already in production.

## Known debt

- `src/lib/nex/` retains legacy identifier bleed-through (`homeowner`/
  `merchant` audience types baked into shared types like `NexSurface`;
  some `.from("hammerex_*")` Supabase table reads that will fail against
  the live project). Clean up incrementally.
- Some tests under `src/lib/nex/__tests__/` import paths that are not
  present (e.g., `@/lib/crm/`, `@/lib/products/`, `@/components/`). The
  affected tests will not run until deps are added or tests trimmed.
- `src/app/nex-native/affiliate/am-5-preview/_fixtures.ts` references a
  legacy mock seller (`HAMMEREX_TOOLS`) — purely a fixture name.
- `src/app/nex-native/layout.tsx` reads `NEXT_PUBLIC_XRATED_VAPID_PUBLIC_KEY`;
  rename to `NEXT_PUBLIC_NEX_VAPID_PUBLIC_KEY` after confirming no
  deployed env relies on the old name.

Remote: `https://github.com/Philip2024394/nexapp.git`
