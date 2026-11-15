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
    "SELECT id, display_name, shop_intro_message FROM nex_business WHERE owner_account_id=(SELECT id FROM nex_account WHERE nex_handle='nex-99903')",
  );
  console.log("Rosa biz:", JSON.stringify(r1.rows, null, 2));
} finally {
  await c.end();
}
