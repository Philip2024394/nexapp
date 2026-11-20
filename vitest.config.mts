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
