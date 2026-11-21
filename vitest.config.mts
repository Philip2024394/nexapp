// vitest.config.ts
//
// Minimal vitest config · mirrors the `@/*` → `./src/*` path alias
// that lives in tsconfig.json so vitest can resolve imports written
// in the same style as production code.
//
// Added 2026-10-11 · unblocks the Theme Category + Theme Library test
// suites that transitively import `_live-worlds-adapter.ts` (which
// uses `@/lib/nex-native/theme-category/registry`). The CLAUDE.md
// note "do not fix in bulk, address when touching the files" is
// honored · this is the single alias wiring, no runtime behaviour
// changes.

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  test: {
    // Load .env.local into process.env BEFORE any test module resolves.
    // Needed because some library modules throw at import time if their
    // required Supabase env vars are missing (e.g., supabase-admin.ts).
    // Added 2026-11-11 for the unified visual library Phase 3 tests.
    setupFiles: [
      fileURLToPath(new URL("./scripts/vitest-stubs/env-loader.ts", import.meta.url)),
    ],
    // 2026-11-20 · scope-correct exclude list so vitest does NOT sweep up
    // tests meant for other runners:
    //   · tests/**           → Playwright E2E specs (own runners via playwright.*.config.ts)
    //   · scripts/_tmp/**    → ad-hoc Playwright/pg probe scripts (not vitest)
    //   · tmp-lane-g/**      → Lane G offline batch (node:test harness, not vitest)
    //   · **/*.test.mjs      → node:test harness scripts (shebang + process.exit)
    //   · src/**/tests/**/*.mjs
    //                       → sibling node:test harness scripts under lib trees
    // Default vitest include ("**/*.{test,spec}.?(c|m)[jt]s?(x)") previously
    // hoovered ~216 files meant for other runners. This exclude keeps
    // vitest's scope to true unit tests (src/**/*.test.ts, __tests__/).
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "tests/**",
      "scripts/_tmp/**",
      "tmp-lane-g/**",
      "**/*.test.mjs",
      "**/*.spec.mjs",
      "src/**/tests/**/*.mjs",
      // 2026-11-21 · DEAD subtree per #61 reachability classification +
      // owner path (a) directive. Neither tree is reachable from any
      // nexapp shipped route (src/app/nex-native/**) or lib surface used
      // by live code. Tests remain on disk for future revival; vitest
      // just stops counting them as a failing engineering signal.
      //
      // Reversal: delete these two lines. No test file edited to earn
      // the skip. This mirrors the 2026-11-19 D:/trades BANNED rule's
      // spirit (keep separate product lineages honest) · nex-agent /
      // nex-agent-runtime are historical NEX-Native runtime experiments
      // that did not make the nexapp carve-out.
      "src/lib/nex-agent-runtime/**",
      "src/lib/nex-agent/**",
      // 2026-11-21 · DEAD subtree per Scope Reduction 2026-11-06.
      // merchant-assistant surface removed; zero live-route imports of
      // either components/nex-app/merchant-assistant/* or
      // lib/nex/merchant-assistant/*. The 3 tests here were imports-
      // only reachable code paths · all dead.
      "src/lib/nex/merchant-assistant/**",
      // 2026-11-21 · DEAD per Scope Reduction 2026-11-06. Trade Centre
      // is REMOVED (nex-shop-entitlement-contract-LOCKED-2026-11-06).
      // indexForSearch.ts reads from banned `hammerex_trade_off_listings`
      // (fork hygiene flags legacy hammerex_* tables that don't exist
      // in NEX Supabase) and `centroidOf`/`haversineKm` from the
      // missing UK postcode dataset. Zero live-route imports of
      // centre-publishing from src/app/**. The sibling imageMatcher.
      // test.ts passes (14/14) so we exclude the single dead test
      // file rather than the whole subtree.
      "src/lib/nex/centre-publishing/indexForSearch.test.ts",
      // 2026-11-21 · DEAD per Scope Reduction 2026-11-06. staircase
      // is REMOVED. business-context/seed.ts imports from
      // `@/lib/app-builder/examples/staircase-company-completed` which
      // was never ported (src/lib/app-builder/ directory does not exist
      // in this fork). Zero live-route imports of business-context
      // from src/app/**.
      "src/lib/nex/business-context/**",
    ],
  },
  resolve: {
    alias: {
      "@": srcDir,
      "@/": `${srcDir}${path.sep}`,
      // Stub Next.js `server-only` sentinel so modules annotated with
      // it can be unit tested. Node runtime does not need the client-
      // component guard.
      "server-only": fileURLToPath(
        new URL("./scripts/vitest-stubs/server-only.ts", import.meta.url),
      ),
    },
  },
});
