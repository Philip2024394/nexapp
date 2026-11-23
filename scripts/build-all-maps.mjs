#!/usr/bin/env node
// Sealed 2026-11-23 · nexapp blueprint map orchestrator
// Runs all 5 generators sequentially. Exits non-zero on any failure.

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GENERATORS = [
  "build-route-map.mjs",
  "build-library-map.mjs",
  "build-env-registry.mjs",
  "build-schema-snapshot.mjs",
  "build-dependency-graph.mjs",
];

const OUTPUTS = [
  path.resolve(__dirname, "..", "docs", "map", "routes.md"),
  path.resolve(__dirname, "..", "docs", "map", "libraries.md"),
  path.resolve(__dirname, "..", "docs", "map", "env.md"),
  path.resolve(__dirname, "..", "docs", "map", "schema-snapshot.md"),
  path.resolve(__dirname, "..", "docs", "map", "dependency-graph.md"),
];

function runOne(script) {
  return new Promise((resolve, reject) => {
    const full = path.join(__dirname, script);
    const start = Date.now();
    const child = spawn(process.execPath, [full], { stdio: "inherit" });
    child.on("exit", (code) => {
      const ms = Date.now() - start;
      if (code === 0) resolve({ script, ms });
      else reject(new Error(`${script} exited with code ${code} after ${ms}ms`));
    });
    child.on("error", (err) => reject(err));
  });
}

async function countLines(file) {
  try {
    const t = await fs.readFile(file, "utf8");
    return t.split(/\r?\n/).length;
  } catch {
    return 0;
  }
}

async function main() {
  const overallStart = Date.now();
  /** @type {Array<{script:string,ms:number}>} */
  const results = [];
  for (const g of GENERATORS) {
    console.log(`\n--- running ${g} ---`);
    const res = await runOne(g);
    results.push(res);
    console.log(`--- done ${g} in ${res.ms}ms ---`);
  }

  console.log("\n=== Summary ===");
  for (const r of results) console.log(`  ${r.script.padEnd(32)} ${r.ms}ms`);
  console.log(`  total                             ${Date.now() - overallStart}ms`);

  console.log("\n=== Output line counts ===");
  for (const out of OUTPUTS) {
    const lines = await countLines(out);
    const rel = path.relative(path.resolve(__dirname, ".."), out).replaceAll("\\", "/");
    console.log(`  ${rel.padEnd(38)} ${lines} lines`);
  }
}

main().catch((err) => {
  console.error("\nbuild-all-maps FAILED:", err.message || err);
  process.exit(1);
});
