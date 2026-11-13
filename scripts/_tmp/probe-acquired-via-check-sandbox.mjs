// Dump the CHECK constraint on nex_theme_ownership.acquired_via.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
const url = raw.match(/^SANDBOX_DATABASE_URL=(.*)$/m)[1].replace(/^['"]|['"]$/g, "");
const c = new Client({ connectionString: url });
await c.connect();
const r = await c.query(
  `SELECT conname, pg_get_constraintdef(oid) AS def
     FROM pg_constraint
    WHERE conrelid = 'nex_theme_ownership'::regclass
    ORDER BY conname`,
);
for (const row of r.rows) console.log(`${row.conname}: ${row.def}`);
await c.end();
