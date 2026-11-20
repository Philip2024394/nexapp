#!/usr/bin/env node
// Deeper diagnosis: is sender_device in recipient list for self-copy?
// What are all buyer's device IDs (full count)?

import { readFileSync } from "node:fs";
import pg from "pg";

function env(f, n) {
  const r = readFileSync(f, "utf8");
  const m = r.match(new RegExp(`^${n}=['"]?([^'"\\n]*)['"]?$`, "m"));
  return m ? m[1].trim() : null;
}

const DB_URL = env(".env.local", "DATABASE_URL");
const SELLER_ID = env(".env.playwright.vault-ck5", "PLAYWRIGHT_CK5_A_ACCOUNT_ID");
const BUYER_ID = env(".env.playwright.vault-ck5", "PLAYWRIGHT_CK5_B_ACCOUNT_ID");
const CONV_ID = "6ad024dd-473e-4415-9ef2-8b714b0c3990";
const GROUP = "002a700c-6013-4102-9c54-c9cc2775a6e6";

const db = new pg.Client({ connectionString: DB_URL });
await db.connect();

const rows = await db.query(
  `SELECT sender_device_id, recipient_device_id
     FROM nex_message
    WHERE conversation_id = $1 AND message_group_id = $2`,
  [CONV_ID, GROUP],
);
const senderDev = rows.rows[0].sender_device_id;
const recipients = rows.rows.map((r) => r.recipient_device_id);
console.log("sender_device_id:", senderDev);
console.log("sender_device_in_recipients?", recipients.includes(senderDev));
console.log("");

const buyerAll = await db.query(
  `SELECT count(*)::int AS n FROM nex_account_device_key WHERE account_id = $1`,
  [BUYER_ID],
);
const sellerAll = await db.query(
  `SELECT count(*)::int AS n FROM nex_account_device_key WHERE account_id = $1`,
  [SELLER_ID],
);
console.log(`buyer total devices: ${buyerAll.rows[0].n}`);
console.log(`seller total devices: ${sellerAll.rows[0].n}`);
console.log(`send fan-out: ${rows.rows.length} rows · expected = buyer_devices + seller_devices`);

// For each recipient_device_id, is it in buyer or seller device_key table?
const recipientInBuyer = await db.query(
  `SELECT count(*)::int AS n FROM nex_account_device_key
    WHERE account_id = $1 AND device_id = ANY($2::text[])`,
  [BUYER_ID, recipients],
);
const recipientInSeller = await db.query(
  `SELECT count(*)::int AS n FROM nex_account_device_key
    WHERE account_id = $1 AND device_id = ANY($2::text[])`,
  [SELLER_ID, recipients],
);
console.log(`recipients that match buyer devices: ${recipientInBuyer.rows[0].n}`);
console.log(`recipients that match seller devices: ${recipientInSeller.rows[0].n}`);

// Was the sender_device_id (buyer's send-time device) registered BEFORE
// the message was sent? (last_seen vs min created_at for group)
const timing = await db.query(
  `SELECT device_id, last_seen_at, created_at FROM nex_account_device_key
    WHERE account_id = $1 AND device_id = $2`,
  [BUYER_ID, senderDev],
);
console.log("\nsender-device record:");
console.log(timing.rows[0]);

await db.end();
