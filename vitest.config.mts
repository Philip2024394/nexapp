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
