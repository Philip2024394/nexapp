import pkg from "pg";
import { readFileSync } from "node:fs";
const { Client } = pkg;
const dbUrl = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1];
const c = new Client({ connectionString: dbUrl });
await c.connect();
try {
  const { rows } = await c.query(
    `SELECT id, sender_account_id, body, attachment_meta->'product'->>'product_id' AS pid, sent_at
       FROM nex_peer_message
       WHERE sent_at > now() - interval '30 minutes'
       ORDER BY sent_at DESC
       LIMIT 20`,
  );
  console.log(JSON.stringify(rows, null, 2));
} finally { await c.end(); }
