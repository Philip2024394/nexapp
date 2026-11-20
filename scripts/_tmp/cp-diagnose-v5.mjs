#!/usr/bin/env node
// v5 diagnostic: did the buyer's current IDB device-id (7e82fa02...) appear
// as recipient in the actual send? And does the ciphertext row carry the
// correct sender_device/recipient_device pair?

import { readFileSync } from "node:fs";
import pg from "pg";

function env(f, n) {
  const r = readFileSync(f, "utf8");
  const m = r.match(new RegExp(`^${n}=['"]?([^'"\\n]*)['"]?$`, "m"));
  return m ? m[1].trim() : null;
}

const DB_URL = env(".env.local", "DATABASE_URL");
if (!DB_URL.includes("kdstoyyeygcopkogqsyv")) throw new Error("REFUSE: not sandbox");
const BUYER_ID = env(".env.playwright.vault-ck5", "PLAYWRIGHT_CK5_B_ACCOUNT_ID");
const SELLER_ID = env(".env.playwright.vault-ck5", "PLAYWRIGHT_CK5_A_ACCOUNT_ID");
const CONV_ID = "6ad024dd-473e-4415-9ef2-8b714b0c3990";
const BUYER_DEV = "7e82fa02-840a-4c9c-bfc5-95f3d6f52d63";
const SELLER_DEV = "9dabfbfe-fd93-4b38-ae9d-2fd6c4dc26a2";

const db = new pg.Client({ connectionString: DB_URL });
await db.connect();

// Find the latest message_group_id
const latest = await db.query(
  `SELECT message_group_id, min(created_at) AS t, count(*)::int AS n
     FROM nex_message
    WHERE conversation_id = $1
    GROUP BY message_group_id
    ORDER BY t DESC
    LIMIT 3`,
  [CONV_ID],
);
console.log("latest groups:");
latest.rows.forEach((r) => console.log(" ", r.t, r.message_group_id, `n=${r.n}`));
const gid = latest.rows[0]?.message_group_id;
if (!gid) {
  await db.end();
  process.exit(0);
}

const rows = await db.query(
  `SELECT sender_account_id, sender_device_id, recipient_device_id, created_at,
          octet_length(ciphertext)::int AS ct_bytes
     FROM nex_message
    WHERE conversation_id = $1 AND message_group_id = $2
    ORDER BY created_at ASC`,
  [CONV_ID, gid],
);
console.log(`\ngroup ${gid}: ${rows.rows.length} rows`);
const senderDevs = [...new Set(rows.rows.map((r) => r.sender_device_id))];
const recipientDevs = rows.rows.map((r) => r.recipient_device_id);
console.log("sender_device(s):", senderDevs);
console.log("recipient targets include v5 buyer dev?", recipientDevs.includes(BUYER_DEV));
console.log("recipient targets include v5 seller dev?", recipientDevs.includes(SELLER_DEV));

// Check if buyer's current device-key row exists on server and when it was created
const devRow = await db.query(
  `SELECT device_id, account_id, created_at, last_seen_at, octet_length(public_key)::int AS pk_bytes
     FROM nex_account_device_key
    WHERE device_id IN ($1,$2)`,
  [BUYER_DEV, SELLER_DEV],
);
console.log("\ndevice-key rows for v5 devices:");
devRow.rows.forEach((r) => console.log(" ", r.device_id, "acct=", r.account_id.slice(0, 8), "created=", r.created_at, "pk_bytes=", r.pk_bytes));

// Was buyer's v5 device registered BEFORE the send?
const firstRowAt = rows.rows[0].created_at;
const buyerDevReg = devRow.rows.find((r) => r.device_id === BUYER_DEV);
if (buyerDevReg) {
  const regBefore = new Date(buyerDevReg.created_at).getTime() < new Date(firstRowAt).getTime();
  console.log(`\nbuyer v5 device registered BEFORE send? ${regBefore}`);
  console.log(`  dev.created_at: ${buyerDevReg.created_at}`);
  console.log(`  send.created_at: ${firstRowAt}`);
}

await db.end();
