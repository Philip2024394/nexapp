import pkg from "pg";
import { readFileSync } from "node:fs";
const { Client } = pkg;
const dbUrl = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1];
const c = new Client({ connectionString: dbUrl });
await c.connect();
try {
  const { rows } = await c.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
       WHERE conrelid = 'nex_peer_message'::regclass
         AND contype = 'c'
         AND conname LIKE '%attachment_type%'`,
  );
  console.log(JSON.stringify(rows, null, 2));
} finally { await c.end(); }
