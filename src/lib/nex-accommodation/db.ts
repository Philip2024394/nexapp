// src/lib/nex-accommodation/db.ts
//
// 2026-11-21 · Recovered shim for `@/lib/nex-accommodation/db`.
//
// Background: during the 2026-10-10 nexapp carve-out from D:/trades,
// the `nex-accommodation` vertical DB adapter was NOT ported. The
// accommodation-postgres adapter in
// `src/lib/nex/brain/world-adapters/accommodation-postgres.ts`
// dynamic-imports this pool getter.
//
// Reachability: zero live imports of accommodation-postgres from
// `src/app/**` or `src/middleware.ts`. The entire
// `src/lib/nex/brain/world-adapters/` subtree is orphan code awaiting
// the Indonesia brain's wire-up to NEX Chat routes.
//
// Honesty contract: this shim DECLARES the module surface callers
// assume exists (`getAccommodationDbPool`), but throws loudly if
// actually invoked at runtime. The accommodation adapter test mocks
// this module via `vi.mock`, so the test passes. Production never
// reaches the throw because no live code path imports the adapter.
//
// When the adapter is revived (wired into a NEX Chat route) OR
// deleted per Scope Reduction, replace this file with the real pool
// source (same shape as D:/trades `src/lib/nex-accommodation/db.ts`).

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface AccommodationDbPool {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;
}

export function getAccommodationDbPool(): AccommodationDbPool {
  throw new Error(
    "[@/lib/nex-accommodation/db] shim invoked at runtime. This " +
      "module is a test-visibility shim introduced 2026-11-21 after " +
      "the nexapp carve-out. No live route should import a world- " +
      "adapter in the current fork. If you reached this error, either " +
      "wire the real Postgres pool (D:/trades " +
      "src/lib/nex-accommodation/db.ts) or remove the caller.",
  );
}
