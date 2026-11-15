#!/usr/bin/env node
// scripts/_tmp/run-session-persistence-spec.mjs
//
// Transient wrapper · loads .env.playwright.vault-acceptance into
// process env, then shells out to Playwright for the session-
// persistence project. Sandbox-only · allows overriding base URL via
// PLAYWRIGHT_TEST_BASE_URL (defaults to :3008 since the local dev
// server runs there with real-auth mode when the sealed
// NEX_DEV_IMPERSONATE_HANDLE line stays commented out in .env.local).

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const envFile = resolve(repoRoot, ".env.playwright.vault-acceptance");
const envRaw = readFileSync(envFile, "utf8");

const extra = {};
for (const line of envRaw.split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!m) continue;
  let [, k, v] = m;
  if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
    v = v.slice(1, -1);
  }
  extra[k] = v;
}

const env = {
  ...process.env,
  ...extra,
  PLAYWRIGHT_TEST_BASE_URL:
    process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3008",
  // Keep evidence screenshots out of the shared test-results dir to
  // avoid races with concurrent Playwright runs on other projects.
  SESSION_PERSISTENCE_SCREENSHOT_DIR:
    process.env.SESSION_PERSISTENCE_SCREENSHOT_DIR ??
    resolve(repoRoot, "tests", "e2e-screenshots", "session-persistence"),
};

const isWin = process.platform === "win32";
const child = spawn(
  isWin ? "npx.cmd" : "npx",
  [
    "playwright",
    "test",
    "--config=playwright.p6-isolation.config.ts",
    "--project=session-persistence-390",
    ...process.argv.slice(2),
  ],
  {
    env,
    stdio: "inherit",
    shell: isWin,
    cwd: repoRoot,
  },
);
child.on("exit", (code) => process.exit(code ?? 0));
