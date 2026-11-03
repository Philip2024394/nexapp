// scripts/check-page-level-backdrop-overrides.mjs
//
// READ-ONLY · greps for per-page html/body background overrides inside
// src/app/nex-native/**/page.tsx. These fight the sealed global desktop
// backdrop set at nex-native.css:156 + _world-stylesheet.tsx. Flags
// each occurrence for review; non-zero exit if any found so a CI gate
// can block drift.
// See docs/doctrine/nex-breakpoints-and-backdrops-2026-11-03.md
// Owner-sealed 2026-11-03.

import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src/app/nex-native";

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (full.endsWith(".tsx") || full.endsWith(".ts")) yield full;
  }
}

// Regex · catches: html, body { background: ... } · also variants with
// just body or just html. Permits whitespace + `!important`.
const RE = /(html\s*,\s*body|body\s*,\s*html|^\s*body|^\s*html)\s*\{\s*background\s*[:]/gm;

let errors = 0;
let seen = 0;

for (const file of walk(ROOT)) {
  const src = readFileSync(file, "utf8");
  if (!/<style/.test(src)) continue; // only files that embed a style block
  seen++;
  const matches = Array.from(src.matchAll(RE));
  if (matches.length === 0) continue;
  console.warn(`FLAG · ${file} overrides html/body background:`);
  for (const m of matches) {
    const idx = m.index ?? 0;
    const line = src.slice(0, idx).split("\n").length;
    const snippet = src.slice(idx, idx + 100).replace(/\s+/g, " ");
    console.warn(`  :${line}  ${snippet}…`);
  }
  errors++;
}

console.log(`\n${seen} files inspected · ${errors} with page-level body overrides`);
if (errors > 0) {
  console.log(
    "\nSee docs/doctrine/nex-breakpoints-and-backdrops-2026-11-03.md for the correct pattern (override main[data-*], not body).",
  );
  process.exit(1);
}
