#!/usr/bin/env node
// scripts/hq-service-role-guard.mjs
//
// Owner-authorised 2026-10-31 (round 9 · build directive · implements
// the HQ safety guard from Rev A plan §8.5-8.8 + the independent review
// finding HQ-F2).
//
// Rule: `nexSupabaseAdmin` (the service-role Supabase client) MUST NOT
// be imported from ordinary HQ code paths. Only the privileged
// cross-country moderation path is permitted to escalate.
//
// Permitted paths (service-role imports allowed):
//   - src/app/nex-native/hq/moderation/**
//   - src/lib/nex-native/hq-moderation/**        (not yet created)
//   - src/lib/nex-native/supabase-admin.ts        (the export site itself)
//   - test files
//   - and everywhere OUTSIDE src/app/nex-native/hq/* that currently uses
//     it (this guard only polices HQ pages; the rest of the app already
//     has its own patterns).
//
// Forbidden paths (service-role imports banned):
//   - src/app/nex-native/hq/**                    (ordinary HQ admin UI)
//   - EXCEPT src/app/nex-native/hq/moderation/**
//
// Fails fast (exit code 1) with a clear report when a violation is found.
// Runs locally via `node scripts/hq-service-role-guard.mjs` and is
// invoked from `npm run guard:hq-service-role`.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const HQ_DIR = join("src", "app", "nex-native", "hq");
const MODERATION_PREFIX = join(HQ_DIR, "moderation") + sep;

// Owner-authorised 2026-10-31 (round 9 · build directive).
// SEALED LEGACY ALLOW-LIST: the HQ Worlds admin surface was built
// against service-role before the RV-A8 privileged-moderation design
// was authored. It is classified as "ordinary HQ admin" per Rev A §8.3
// but still uses `nexSupabaseAdmin` for reads of `nex_world_state`
// (singleton table without RLS) and preview-cookie writes. The RV-A8
// migration (nex_world_state RLS + authenticated-admin SELECT policy)
// will remove this exemption. Tracked as TD-HQ-WORLDS.
const LEGACY_ALLOWED = new Set([
  join(HQ_DIR, "worlds", "page.tsx"),
  join(HQ_DIR, "worlds", "_actions.ts"),
]);

const IMPORT_RX = /from\s+["']@\/lib\/nex-native\/supabase-admin["']/;
const INLINE_RX = /\bnexSupabaseAdmin\b/;

/** @type {string[]} */
const violations = [];

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    const full = join(dir, name);
    let s;
    try { s = statSync(full); } catch { continue; }
    if (s.isDirectory()) { walk(full); continue; }
    if (!/\.(ts|tsx|mts|cts)$/i.test(name)) continue;
    if (/__tests__/.test(full)) continue;
    const rel = relative(ROOT, full);
    if (rel.startsWith(MODERATION_PREFIX)) continue; // allow-list
    if (LEGACY_ALLOWED.has(rel)) continue; // sealed legacy allow-list · see top-of-file
    let text;
    try { text = readFileSync(full, "utf8"); } catch { continue; }
    if (IMPORT_RX.test(text) || INLINE_RX.test(text)) {
      violations.push(rel);
    }
  }
}

walk(join(ROOT, HQ_DIR));

if (violations.length > 0) {
  process.stderr.write(
    `\nHQ service-role guard · FAIL · ${violations.length} violation(s):\n`,
  );
  for (const v of violations) process.stderr.write(`  - ${v}\n`);
  process.stderr.write(
    `\n  Rule: nexSupabaseAdmin may not be imported from HQ pages outside\n  src/app/nex-native/hq/moderation/*. See Rev A plan §8.5-8.8.\n`,
  );
  process.exit(1);
}

process.stdout.write("HQ service-role guard · PASS (0 ordinary HQ files import nexSupabaseAdmin)\n");
process.exit(0);
