#!/usr/bin/env node
// scripts/dev-with-identity.mjs
//
// Boot `next dev` with a specific NEX_APP_IDENTITY + NEX_APP_COUNTRY
// set in the child process env. Cross-platform (works on Windows cmd
// without needing `cross-env`).
//
// Usage: node scripts/dev-with-identity.mjs <identity> <port>
// Example: node scripts/dev-with-identity.mjs ireland 3009

import { spawn } from "node:child_process";

const [, , identity, port] = process.argv;
if (!identity || !port) {
  process.stderr.write("Usage: dev-with-identity.mjs <ireland|indonesia|hq> <port>\n");
  process.exit(2);
}

const country = { ireland: "IE", indonesia: "ID", hq: "" }[identity];
if (country === undefined) {
  process.stderr.write(`Unknown identity: ${identity}\n`);
  process.exit(2);
}

process.stdout.write(
  `Starting ${identity}${country ? `/${country}` : ""} on port ${port}...\n`,
);

const env = {
  ...process.env,
  NEX_APP_IDENTITY: identity,
  ...(country ? { NEX_APP_COUNTRY: country } : {}),
};

// Windows needs shell:true to resolve .cmd shims; POSIX runs npx directly.
const isWin = process.platform === "win32";
const child = spawn(isWin ? "npx.cmd" : "npx", ["next", "dev", "-p", String(port)], {
  env,
  stdio: "inherit",
  shell: isWin,
});

child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
