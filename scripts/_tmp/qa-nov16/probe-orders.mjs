import pkg from "pg";
import { readFileSync } from "node:fs";
const { Client } = pkg;
const dbUrl = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1];
const c = new Client({ connectionString: dbUrl });
await c.connect();
try {
  const { rows } = await c.query(
    `SELECT o.id, o.state, o.customer_account_id, o.business_id, a.display_name
       FROM nex_order o
       LEFT JOIN nex_account a ON a.id = o.customer_account_id
       WHERE o.customer_account_id NOT IN (
         '11111111-1111-4111-8111-111111111111',
         '11111111-1111-4111-8111-111111111113'
       )
       ORDER BY o.created_at DESC LIMIT 10`,
  );
  console.log(JSON.stringify(rows, null, 2));
} finally { await c.end(); }
