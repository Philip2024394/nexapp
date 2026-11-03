// scripts/apply-migration-272.mjs
// Applies 272 (97 gratis chat-theme rows) to ijvqdvsvwtwxzcqmoqit.
// Strips the DRAFT apply-guard before executing · sealed convention.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

function stripDraftGuard(sql, v) {
  const re = new RegExp(
    `-- Apply guard\\s*\\nDO \\$\\$ BEGIN\\s*\\n\\s*RAISE EXCEPTION 'Migration ${v} is DRAFT[^']*';\\s*\\nEND \\$\\$;`,
    "m",
  );
  return sql.replace(re, `-- (DRAFT guard stripped · ${v})`);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
console.log("CONNECTED to ijvqdvsvwtwxzcqmoqit");
try {
  const sqlRaw = readFileSync(
    resolve("nex-supabase/migrations/272_nex_chat_theme_seed_o_wallpapers.sql"),
    "utf8",
  );
  await client.query(stripDraftGuard(sqlRaw, "272"));
  console.log("OK 272");

  const r = await client.query(
    "SELECT count(*)::int AS c FROM nex_chat_theme WHERE id LIKE 'theme-o%'",
  );
  console.log(`theme-o* row count: ${r.rows[0].c}`);

  const sample = await client.query(
    "SELECT id, name, hero_image_url FROM nex_chat_theme WHERE id IN ('theme-o1','theme-o50','theme-o97') ORDER BY sort_order",
  );
  console.log("sample rows:");
  sample.rows.forEach((row) =>
    console.log(`  ${row.id} · ${row.name} · ${row.hero_image_url.slice(0, 90)}…`),
  );
} finally {
  await client.end();
}
