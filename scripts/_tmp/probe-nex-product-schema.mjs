import pkg from "pg";
import { readFileSync } from "node:fs";
const { Client } = pkg;
const m = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m);
const url = m[1].trim();
if (!url.includes("kdstoyyeygcopkogqsyv")) throw new Error("not sandbox");
const c = new Client({ connectionString: url });
await c.connect();
try {
  const r1 = await c.query(
    "SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='nex_product' ORDER BY ordinal_position",
  );
  console.log("nex_product columns:");
  for (const r of r1.rows) {
    console.log(`  ${r.column_name} (nullable=${r.is_nullable}, default=${r.column_default ?? "—"})`);
  }
} finally {
  await c.end();
}
