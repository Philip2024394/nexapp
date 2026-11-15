// Probe Rosa's current state in sandbox · read-only.
import pkg from "pg";
import { readFileSync } from "node:fs";
const { Client } = pkg;
const m = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m);
const url = m[1].trim();
if (!url.includes("kdstoyyeygcopkogqsyv")) {
  throw new Error("refuses · not sandbox");
}
const c = new Client({ connectionString: url });
await c.connect();
try {
  const r1 = await c.query(
    "SELECT id, nex_handle, display_name, shop_tier FROM nex_account WHERE nex_handle='nex-99903'",
  );
  console.log("ROSA account:", JSON.stringify(r1.rows, null, 2));
  const rosaId = r1.rows[0]?.id;
  if (!rosaId) throw new Error("Rosa not found");
  const r2 = await c.query(
    "SELECT id, owner_account_id, display_name, slug, shop_intro_message, business_category, description, logo_url, address FROM nex_business WHERE owner_account_id=$1",
    [rosaId],
  );
  console.log("ROSA business:", JSON.stringify(r2.rows, null, 2));
  const r3 = await c.query(
    "SELECT id, name, status, department_id, category_id, created_at FROM nex_product WHERE business_id IN (SELECT id FROM nex_business WHERE owner_account_id=$1) ORDER BY created_at DESC",
    [rosaId],
  );
  console.log("ROSA products total:", r3.rows.length);
  console.log(JSON.stringify(r3.rows.slice(0, 10), null, 2));
  const r4 = await c.query(
    "SELECT account_id, created_at FROM nex_vault_setup WHERE account_id=$1",
    [rosaId],
  );
  console.log("ROSA vault_setup:", JSON.stringify(r4.rows, null, 2));
} finally {
  await c.end();
}
