import pkg from "pg";
import { readFileSync } from "node:fs";
const { Client } = pkg;
const dbUrl = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1];
const c = new Client({ connectionString: dbUrl });
await c.connect();
try {
  const a = await c.query(`SELECT count(*)::int AS n FROM nex_order`);
  console.log("total nex_order:", a.rows[0].n);
  const b = await c.query(`SELECT id, state, customer_account_id FROM nex_order ORDER BY created_at DESC LIMIT 5`);
  console.log(JSON.stringify(b.rows, null, 2));
} finally { await c.end(); }
