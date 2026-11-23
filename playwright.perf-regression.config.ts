// playwright.perf-regression.config.ts
//
// Perf regression guardrail · owner-sealed 2026-11-23 (CLAUDE.md §10).
// -----------------------------------------------------------------------------
// Runs the asset-budget + preconnect checks (and optional deployment-
// chain smoke) against a REAL production Next.js build so the tests
// reflect what the live Worker will serve · not dev-mode HMR output.
//
// webServer runs `npm run build && npm run start` on port 3009 so this
// suite never contends with the owner's `npm run dev` on 3008.
//
// Tests under `./tests/e2e/perf-regression-*.spec.ts` only.

import { defineConfig, devices } from "@playwright/test";

const PORT = 3009;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /perf-regression-.*\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-perf" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 60_000,
    ignoreHTTPSErrors: true,
  },
  // One project only · each spec creates viewport-specific contexts
  // internally (see tests/e2e/perf-regression-asset-budgets.spec.ts),
  // so a per-device project would just double-run every test.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/nex-native`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000, // 5 min — production build + start
    stdout: "pipe",
    stderr: "pipe",
  },
});
