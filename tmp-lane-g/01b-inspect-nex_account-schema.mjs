import { readFileSync } from "node:fs";
import { Client } from "pg";
const envRaw = readFileSync("C:/Users/Victus/nexapp/.env.local", "utf8");
function envValue(name) {
  const m = envRaw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v || null;
}
const dbUrl = envValue("SANDBOX_DATABASE_URL");
if (!dbUrl?.includes("kdstoyyeygcopkogqsyv")) throw new Error("STOP ref");
const c = new Client({ connectionString: dbUrl });
await c.connect();
const cols = await c.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='nex_account' ORDER BY ordinal_position`);
console.table(cols.rows);
await c.end();
