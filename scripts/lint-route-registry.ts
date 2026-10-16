// scripts/lint-route-registry.ts
//
// Walks src/app/**/page.tsx and compares against ROUTE_REGISTRY.
// Reports a GAP COUNT · exits non-zero only if duplicate registrations
// exist. Missing-page entries are reported but do NOT fail the build
// (debt-tracker mode · the gap must shrink over time).
//
// Usage:
//   npx tsx scripts/lint-route-registry.ts
//
// Future tightening: once the gap reaches zero, flip EXIT_ON_GAP = true
// to make CI block any new page.tsx that lacks a RouteEntry.

import { readdir, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import {
  ROUTE_REGISTRY,
  getRegisteredFilePaths,
} from "../src/lib/nex-native/routing/route-registry";

const REPO_ROOT = resolve(__dirname, "..");
const APP_DIR = join(REPO_ROOT, "src", "app");
const EXIT_ON_GAP = false; // flip to true once gap === 0 for the first time.

async function walk(dir: string, acc: string[] = []): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const s = await stat(full);
    if (s.isDirectory()) {
      await walk(full, acc);
    } else if (name === "page.tsx" || name === "page.ts") {
      acc.push(full);
    }
  }
  return acc;
}

async function main(): Promise<void> {
  const pages = await walk(APP_DIR);
  const relPaths = pages
    .map((p) => relative(REPO_ROOT, p).split(sep).join("/"))
    .sort();

  const registered = getRegisteredFilePaths();
  const unregistered = relPaths.filter((p) => !registered.has(p));
  // Only ACTIVE registry entries must have a real file on disk.
  // Planned/deprecated entries are allowed to reference non-existent paths.
  const activeFilePaths = new Set(
    ROUTE_REGISTRY.filter((r) => r.lifecycle === "active").map((r) => r.filePath),
  );
  const extraRegistered = Array.from(activeFilePaths).filter(
    (p) => !relPaths.includes(p),
  );

  // ─── duplicate registrations ──────────────────────────────────────
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const r of ROUTE_REGISTRY) {
    if (seen.has(r.filePath)) dupes.push(r.filePath);
    seen.add(r.filePath);
  }

  console.log("\n=== NEX route-registry lint ===");
  console.log(`page.tsx files on disk:  ${relPaths.length}`);
  console.log(`routes registered:       ${registered.size}`);
  console.log(`coverage:                ${(
    (registered.size / Math.max(1, relPaths.length)) *
    100
  ).toFixed(1)}%`);

  if (dupes.length > 0) {
    console.error("\nERR DUPLICATE registrations in ROUTE_REGISTRY (hard error):");
    for (const d of dupes) console.error(`  ${d}`);
  }

  if (extraRegistered.length > 0) {
    console.warn(
      "\nWARN Registry references file paths that do not exist on disk:",
    );
    for (const e of extraRegistered) console.warn(`  ${e}`);
  }

  if (unregistered.length > 0) {
    console.log(
      `\nWARN Pages NOT yet in ROUTE_REGISTRY (debt counter: ${unregistered.length}):`,
    );
    for (const u of unregistered.slice(0, 25)) console.log(`  ${u}`);
    if (unregistered.length > 25) {
      console.log(`  ... (+${unregistered.length - 25} more)`);
    }
  }

  console.log("\n=== result ===");
  if (dupes.length > 0 || extraRegistered.length > 0) {
    console.error("FAIL · duplicates or broken references · fix before commit.");
    process.exit(1);
  }
  if (unregistered.length > 0 && EXIT_ON_GAP) {
    console.error(
      `FAIL · EXIT_ON_GAP=true · ${unregistered.length} pages missing registry entries.`,
    );
    process.exit(1);
  }
  console.log(
    `PASS · 0 duplicates · ${unregistered.length} pages pending registration.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("UNHANDLED · " + e.message);
  process.exit(1);
});
