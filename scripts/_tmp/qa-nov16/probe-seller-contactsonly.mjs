import pkg from "pg";
import { readFileSync } from "node:fs";
const { Client } = pkg;
const dbUrl = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1];
const c = new Client({ connectionString: dbUrl });
await c.connect();
try {
  const { rows } = await c.query(
    `SELECT id, nex_handle, who_can_message, display_name
       FROM nex_account
       WHERE id IN ('d977070d-6210-4cd5-a731-f4892dc7047f',
                    'd1f9bfd1-e83b-4627-bf15-e0eae4d41bba')`,
  );
  console.log("accounts:", JSON.stringify(rows, null, 2));

  // Latest peer messages from buyer across any product
  const { rows: msgs } = await c.query(
    `SELECT id, body, attachment_meta->'product'->>'product_id' AS pid,
            sent_at
       FROM nex_peer_message
       WHERE sender_account_id = 'd977070d-6210-4cd5-a731-f4892dc7047f'
       ORDER BY sent_at DESC
       LIMIT 5`,
  );
  console.log("recent CK5-B messages:", JSON.stringify(msgs, null, 2));
} finally { await c.end(); }
