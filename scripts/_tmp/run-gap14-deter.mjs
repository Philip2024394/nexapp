#!/usr/bin/env node
// Temporary wrapper to run the GAP14-DETER test group with the correct
// dev-server base URL. The default :3010 port in
// playwright.p6-isolation.config.ts is the sealed two-context driver
// that runs WITHOUT dev-impersonation · this test group uses the
// standard nexapp dev server (:3008). Delete this file after the
// #14 run · it is intentionally scripts/_tmp scoped.

import { spawn } from "node:child_process";

process.env.PLAYWRIGHT_TEST_BASE_URL = "http://localhost:3008";

const grepArg = process.argv[2] ?? "GAP14-DETER";
// Escape double-quotes inside the regex so cmd/bash gets the full pattern.
const escapedGrep = grepArg.replace(/"/g, '\\"');
const cmdline =
  `npx playwright test ` +
  `-c playwright.p6-isolation.config.ts ` +
  `--project order-visibility-390 ` +
  `--trace off --reporter line ` +
  `-g "${escapedGrep}"`;

const proc = spawn(cmdline, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});
proc.on("exit", (code) => process.exit(code ?? 0));
