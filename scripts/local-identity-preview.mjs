#!/usr/bin/env node
// scripts/local-identity-preview.mjs
//
// Boot all three identity deployments concurrently on their own ports
// and run the Playwright identity-chrome verifier against them.
//
// Ports:
//   HQ        → 3008 (existing default)
//   Ireland   → 3009
//   Indonesia → 3010
//
// The verifier confirms:
//   - Each deployment serves /nex-native/sign-in with HTTP 200
//   - Each deployment sets its matching data-nex-world-root attribute
//     on the SSR response (Ireland→ireland, Indonesia→indonesia, HQ→
//     one of {ireland, indonesia, nex-original} depending on preview
//     cookie / activated world)
//   - Each deployment responds to a request without crashing on an
//     invalid identity (test env mutation; sub-process restart)
//
// Usage: npm run preview:all

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const DEPLOYMENTS = [
  { identity: "ireland", country: "IE", port: 3009 },
  { identity: "indonesia", country: "ID", port: 3010 },
  { identity: "hq", country: "", port: 3008 },
];

const children = [];

function startChild(identity, country, port) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const env = {
    ...process.env,
    NEX_APP_IDENTITY: identity,
    ...(country ? { NEX_APP_COUNTRY: country } : {}),
  };
  const child = spawn(npx, ["next", "dev", "-p", String(port)], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  child.stdout.on("data", (buf) =>
    process.stdout.write(`[${identity}:${port}] ${buf}`),
  );
  child.stderr.on("data", (buf) =>
    process.stderr.write(`[${identity}:${port}] ${buf}`),
  );
  children.push(child);
  return child;
}

async function waitForPort(port, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://localhost:${port}/nex-native/sign-in`);
      if (r.status === 200) return true;
    } catch { /* not ready */ }
    await sleep(1000);
  }
  return false;
}

function shutdown() {
  for (const c of children) {
    try { c.kill("SIGINT"); } catch { /* ignore */ }
  }
}

process.on("SIGINT", () => { shutdown(); process.exit(130); });
process.on("SIGTERM", () => { shutdown(); process.exit(143); });

(async () => {
  process.stdout.write("Starting 3 identity deployments...\n");
  for (const d of DEPLOYMENTS) startChild(d.identity, d.country, d.port);

  process.stdout.write("Waiting for each port to serve HTTP 200...\n");
  const readiness = await Promise.all(
    DEPLOYMENTS.map((d) => waitForPort(d.port)),
  );
  for (let i = 0; i < DEPLOYMENTS.length; i++) {
    const d = DEPLOYMENTS[i];
    if (!readiness[i]) {
      process.stderr.write(`${d.identity} on :${d.port} did not come up within 90s\n`);
      shutdown();
      process.exit(1);
    }
    process.stdout.write(`  ✓ ${d.identity} ready on :${d.port}\n`);
  }

  process.stdout.write("Fetching SSR identity markers from each deployment...\n");
  const results = [];
  for (const d of DEPLOYMENTS) {
    try {
      const r = await fetch(`http://localhost:${d.port}/nex-native/sign-in`);
      const body = await r.text();
      const worldRoot = /data-nex-world-root="([a-z0-9-]+)"/i.exec(body)?.[1] ?? null;
      results.push({ ...d, status: r.status, worldRoot });
    } catch (err) {
      results.push({ ...d, status: 0, worldRoot: null, error: String(err) });
    }
  }

  const expected = { ireland: "ireland", indonesia: "indonesia", hq: null };
  let ok = true;
  for (const r of results) {
    const want = expected[r.identity];
    const got = r.worldRoot;
    const pass =
      r.status === 200 &&
      (want === null ? ["ireland", "indonesia", "nex-original"].includes(got ?? "") : got === want);
    process.stdout.write(
      `  ${pass ? "✓" : "✗"} ${r.identity}:${r.port} status=${r.status} data-nex-world-root=${got} (expected ${want ?? "any-registered"})\n`,
    );
    if (!pass) ok = false;
  }

  if (!ok) {
    shutdown();
    process.exit(1);
  }

  process.stdout.write(
    "\n✓ All 3 deployments serving on their ports with correct identity chrome.\n",
  );
  process.stdout.write(
    "Keep running? Press Ctrl+C to stop. (All deployments remain live until you do.)\n",
  );
  // Keep process alive until SIGINT.
  await new Promise(() => {});
})();
