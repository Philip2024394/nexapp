#!/usr/bin/env node
// scripts/start-with-identity.mjs
//
// Same shape as dev-with-identity.mjs but runs `next start` (production
// mode) so it does not conflict with an existing `next dev` session on
// the same project directory. Needed because Next.js 16 enforces a
// one-dev-server-per-dir lock.
//
// Usage: node scripts/start-with-identity.mjs <identity> <port>

import { spawn } from "node:child_process";

const [, , identity, port] = process.argv;
if (!identity || !port) {
  process.stderr.write("Usage: start-with-identity.mjs <ireland|indonesia|hq> <port>\n");
  process.exit(2);
}

const country = { ireland: "IE", indonesia: "ID", hq: "" }[identity];
if (country === undefined) {
  process.stderr.write(`Unknown identity: ${identity}\n`);
  process.exit(2);
}

process.stdout.write(
  `Starting ${identity}${country ? `/${country}` : ""} on port ${port} (next start · production mode)...\n`,
);

const env = {
  ...process.env,
  NEX_APP_IDENTITY: identity,
  ...(country ? { NEX_APP_COUNTRY: country } : {}),
};

const isWin = process.platform === "win32";
const child = spawn(isWin ? "npx.cmd" : "npx", ["next", "start", "-p", String(port)], {
  env,
  stdio: "inherit",
  shell: isWin,
});

child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
