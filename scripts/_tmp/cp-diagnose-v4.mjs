#!/usr/bin/env node
// Diagnose why journey v4 failed to decrypt even though devices registered.
// Query the actual rows that step 3 wrote.

import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

function env(f, n) {
  const r = readFileSync(f, "utf8");
  const m = r.match(new RegExp(`^${n}=['"]?([^'"\\n]*)['"]?$`, "m"));
  return m ? m[1].trim() : null;
}

const DB_URL = env(".env.local", "DATABASE_URL");
if (!DB_URL.includes("kdstoyyeygcopkogqsyv")) throw new Error("REFUSE");

const SELLER_ID = env(".env.playwright.vault-ck5", "PLAYWRIGHT_CK5_A_ACCOUNT_ID");
const BUYER_ID = env(".env.playwright.vault-ck5", "PLAYWRIGHT_CK5_B_ACCOUNT_ID");
const CONV_ID = "6ad024dd-473e-4415-9ef2-8b714b0c3990";

const db = new pg.Client({ connectionString: DB_URL });
await db.connect();

const latestGroup = await db.query(
  `SELECT message_group_id, count(*)::int AS n, min(created_at) AS first_at
     FROM nex_message
    WHERE conversation_id = $1
    GROUP BY message_group_id
    ORDER BY first_at DESC NULLS LAST
    LIMIT 2`,
  [CONV_ID],
);
console.log("groups:", latestGroup.rows);

const latestGid = latestGroup.rows[0]?.message_group_id;
if (!latestGid) {
  console.log("no group to inspect");
  await db.end();
  process.exit(0);
}

const rows = await db.query(
  `SELECT sender_account_id, sender_device_id, recipient_device_id,
          octet_length(ciphertext)::int AS ct_bytes, created_at
     FROM nex_message
    WHERE conversation_id = $1 AND message_group_id = $2
    ORDER BY created_at ASC`,
  [CONV_ID, latestGid],
);
console.log(`\nrows in latest group ${latestGid}: ${rows.rows.length}`);
const senders = Array.from(new Set(rows.rows.map((r) => r.sender_account_id)));
const senderDevs = Array.from(new Set(rows.rows.map((r) => r.sender_device_id)));
const recipientDevs = Array.from(new Set(rows.rows.map((r) => r.recipient_device_id)));
console.log("senders:", senders);
console.log("sender_devices:", senderDevs);
console.log("recipient_device count:", recipientDevs.length);

// Fetch latest device keys for both accounts, ordered by last_seen_at DESC.
const buyerDevs = await db.query(
  `SELECT device_id, last_seen_at
     FROM nex_account_device_key
    WHERE account_id = $1
    ORDER BY last_seen_at DESC
    LIMIT 10`,
  [BUYER_ID],
);
const sellerDevs = await db.query(
  `SELECT device_id, last_seen_at
     FROM nex_account_device_key
    WHERE account_id = $1
    ORDER BY last_seen_at DESC
    LIMIT 10`,
  [SELLER_ID],
);
console.log("\nbuyer recent devices:");
buyerDevs.rows.forEach((r) => console.log(" ", r.device_id, r.last_seen_at));
console.log("\nseller recent devices:");
sellerDevs.rows.forEach((r) => console.log(" ", r.device_id, r.last_seen_at));

// Cross-check: which recipient_device_ids in the group are present in buyer+seller device lists?
const buyerDevSet = new Set(buyerDevs.rows.map((r) => r.device_id));
const sellerDevSet = new Set(sellerDevs.rows.map((r) => r.device_id));
let targetedBuyer = 0;
let targetedSeller = 0;
let targetedOther = 0;
for (const rid of recipientDevs) {
  if (buyerDevSet.has(rid)) targetedBuyer++;
  else if (sellerDevSet.has(rid)) targetedSeller++;
  else targetedOther++;
}
console.log(`\nrecipients targeted: buyer=${targetedBuyer} seller=${targetedSeller} other=${targetedOther}`);

// Most recent buyer device + most recent seller device — do they appear as recipients in the latest group?
const latestBuyerDev = buyerDevs.rows[0]?.device_id;
const latestSellerDev = sellerDevs.rows[0]?.device_id;
console.log("latest buyer device in latest group?", recipientDevs.includes(latestBuyerDev));
console.log("latest seller device in latest group?", recipientDevs.includes(latestSellerDev));

await db.end();
