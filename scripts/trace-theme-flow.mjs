#!/usr/bin/env node
// scripts/trace-theme-flow.mjs
//
// Trace theme counts through every boundary · 2026-10-11 investigation.

import { LIVE_WORLD_IDS, LIVE_WORLD_PACKAGES } from "../src/app/nex-native/chat-standard/_live-worlds.ts";
import {
  liveWorldAsBrowserRow,
  listLiveWorldsAsBrowserRows,
} from "../src/app/nex-native/chat-themes-library/_live-worlds-adapter.ts";
import { inferCategoryIdFromSignals } from "../src/lib/nex-native/theme-category/keyword-resolver.ts";

console.log("== 1. LIVE_WORLD_IDS registered in _live-worlds.ts ==");
console.log(`count: ${LIVE_WORLD_IDS.length}`);
console.log(`ids:   ${LIVE_WORLD_IDS.join(" · ")}`);

console.log("\n== 2. listLiveWorldsAsBrowserRows() output ==");
const rows = listLiveWorldsAsBrowserRows();
console.log(`count: ${rows.length}`);
for (const r of rows) {
  console.log(
    `  ${r.id.padEnd(18)} name="${r.name.padEnd(22)}" cat=${r.category_id.padEnd(14)} palette=${r.palette ? "✓" : "MISSING"} ambient=${r.ambient_families ? r.ambient_families.length : "null"}`,
  );
}

console.log("\n== 3. Each theme's keyword-resolver output (vs declared categoryId) ==");
for (const id of LIVE_WORLD_IDS) {
  const pkg = LIVE_WORLD_PACKAGES[id];
  const inferred = inferCategoryIdFromSignals({
    id: pkg.identity.id,
    name: pkg.identity.name,
    tagline: pkg.identity.tagline,
    conceptOneLine: pkg.identity.conceptOneLine,
  });
  const declared = pkg.identity.categoryId ?? "(none)";
  const match = inferred === declared || inferred === null;
  console.log(
    `  ${id.padEnd(18)} declared=${declared.padEnd(14)} inferred=${(inferred ?? "null").padEnd(14)} ${match ? "ok" : "⚠ MISMATCH"}`,
  );
}

console.log("\n== 4. Rows grouped by category_id ==");
const byCategory = {};
for (const r of rows) {
  (byCategory[r.category_id] = byCategory[r.category_id] || []).push(r.id);
}
for (const [cat, ids] of Object.entries(byCategory)) {
  console.log(`  ${cat.padEnd(14)} (${ids.length}): ${ids.join(", ")}`);
}

console.log(`\n== 5. Any BrowserThemeRow with null palette OR missing required field? ==`);
let drops = 0;
for (const r of rows) {
  const problems = [];
  if (!r.palette) problems.push("no palette");
  if (!r.palette?.primary) problems.push("no palette.primary");
  if (!r.palette?.deep) problems.push("no palette.deep");
  if (!r.category_id) problems.push("no category_id");
  if (!r.accent_hex) problems.push("no accent_hex");
  if (problems.length) {
    console.log(`  ⚠ ${r.id}: ${problems.join(" · ")}`);
    drops++;
  }
}
console.log(`drops=${drops}`);
