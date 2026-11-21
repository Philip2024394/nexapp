// src/lib/nex-food/db.ts
//
// 2026-11-21 · Recovered shim for `@/lib/nex-food/db`.
//
// Background: during the 2026-10-10 nexapp carve-out from D:/trades,
// the `nex-food` vertical DB adapter was NOT ported. Four Postgres
// adapters in `src/lib/nex/brain/world-adapters/` dynamic-import this
// pool getter: food-postgres, service-postgres, commerce-postgres,
// transport-postgres (service/commerce/transport reuse the food pool
// since they share the same Postgres DB in the source monorepo).
//
// Reachability: zero live imports of these adapters from
// `src/app/**` or `src/middleware.ts`. The entire
// `src/lib/nex/brain/world-adapters/` subtree is orphan code awaiting
// the Indonesia brain's wire-up to NEX Chat routes.
//
// Honesty contract: this shim DECLARES the module surface callers
// assume exists (`getFoodDbPool`), but throws loudly if actually
// invoked at runtime. Tests mock this module via `vi.mock`, so
// tests pass. Production never reaches the throw because no live
// code path imports these adapters.
//
// When the adapters are revived (wired into a NEX Chat route) OR
// deleted per Scope Reduction, replace this file with the real pool
// source (same shape as D:/trades `src/lib/nex-food/db.ts`).

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface FoodDbPool {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;
}

export function getFoodDbPool(): FoodDbPool {
  throw new Error(
    "[@/lib/nex-food/db] shim invoked at runtime. This module is a " +
      "test-visibility shim introduced 2026-11-21 after the nexapp " +
      "carve-out. No live route should import a world-adapter in the " +
      "current fork. If you reached this error, either wire the real " +
      "Postgres pool (D:/trades src/lib/nex-food/db.ts) or remove the " +
      "caller.",
  );
}
