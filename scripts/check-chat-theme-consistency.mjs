// scripts/check-chat-theme-consistency.mjs
//
// READ-ONLY · detects drift between the 5 chat-theme registration
// surfaces (see docs/doctrine/nex-chat-theme-registration-2026-11-03.md).
// Non-zero exit if drift found. Owner-sealed 2026-11-03.

import { readFileSync } from "node:fs";
import pg from "pg";

function readEnv(k) {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === k) return m[2];
  }
  return null;
}

const url = readEnv("DATABASE_URL");
if (!url?.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("ERR: wrong project");
  process.exit(3);
}

// 1 · Pull theme IDs from each surface
const client = new pg.Client({ connectionString: url });
await client.connect();
const dbRes = await client.query(
  "SELECT id, name, hero_image_url, is_active FROM nex_chat_theme ORDER BY id",
);
await client.end();
const dbIds = new Set(dbRes.rows.map((r) => r.id));
const dbInactive = new Set(
  dbRes.rows.filter((r) => !r.is_active).map((r) => r.id),
);

const catalog = readFileSync(
  "src/app/nex-native/chat-themes-library/_catalog.ts",
  "utf8",
);
const catalogIds = new Set(
  Array.from(catalog.matchAll(/id:\s*['"]([a-z0-9_-]+)['"]/g)).map((m) => m[1]),
);

const popular = readFileSync(
  "src/app/nex-native/chat-themes-library/_featured-picks.ts",
  "utf8",
);
const popularIds = new Set(
  Array.from(popular.matchAll(/['"]([a-z0-9_-]+)['"](?=,|\s*,|\s*\])/g))
    .map((m) => m[1])
    .filter((x) => x.length > 1 && x !== "food" && x !== "accommodation" && x !== "property" && x !== "products" && x !== "services" ? true : /^(nex-|theme-|library-|coffee|waterworld|food)/.test(x)),
);
// Narrower pattern · pick up only known theme-id shapes
const popularIdsNarrow = new Set(
  Array.from(popular.matchAll(/['"]([a-z][a-z0-9_-]{2,30})['"]/g))
    .map((m) => m[1])
    .filter((x) =>
      /^(nex-|theme-|library-|coffee$|waterworld$|food$|joker$|neon$|aurora$)/.test(x),
    ),
);

const liveWorlds = readFileSync(
  "src/app/nex-native/chat-standard/_live-worlds.ts",
  "utf8",
);
const liveWorldIds = new Set(
  Array.from(liveWorlds.matchAll(/id:\s*['"]([a-z0-9_-]+)['"]/g))
    .map((m) => m[1])
    .filter((x) => x !== "live-worlds"),
);

const sealed = readFileSync(
  "src/app/nex-native/chat-themes-library/_sealed-free-themes.ts",
  "utf8",
);
const sealedIds = new Set(
  Array.from(sealed.matchAll(/['"]([a-z0-9_-]+)['"]/g))
    .map((m) => m[1])
    .filter((x) => /^(default|theme-|nex-)/.test(x)),
);

// 2 · Report drift
let errors = 0;
console.log("─── CHAT THEME CONSISTENCY ───");
console.log(`DB rows:         ${dbIds.size}`);
console.log(`_catalog.ts:     ${catalogIds.size}`);
console.log(`POPULAR_THEME_IDS: ${popularIdsNarrow.size}`);
console.log(`LIVE_WORLD_PACKAGES: ${liveWorldIds.size}`);
console.log(`Free-forever allowlist: ${sealedIds.size}`);
console.log("");

// a · catalog entries that have NO matching DB row AND no live-world package
//     (such entries can display in /all but will not actually APPLY · the
//      service layer can't resolve the id)
for (const id of catalogIds) {
  if (!dbIds.has(id) && !liveWorldIds.has(id)) {
    console.error(`DRIFT · catalog id '${id}' has no DB row and no live-world package`);
    errors++;
  }
}

// b · popular IDs that reference nothing
for (const id of popularIdsNarrow) {
  if (!dbIds.has(id) && !liveWorldIds.has(id) && !catalogIds.has(id)) {
    console.error(`DRIFT · popular id '${id}' references nothing (not in DB · not in live-worlds · not in catalog)`);
    errors++;
  }
}

// c · DB rows marked is_active=false still referenced by catalog
for (const id of catalogIds) {
  if (dbInactive.has(id)) {
    console.error(`DRIFT · catalog references '${id}' but DB row is_active=false`);
    errors++;
  }
}

if (errors === 0) {
  console.log("✓ No drift detected.");
} else {
  console.log(`\n${errors} drift(s) detected.`);
  process.exit(1);
}
