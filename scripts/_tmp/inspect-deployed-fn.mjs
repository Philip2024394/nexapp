// Print deployed function source + nex_peer_message column types.
import { spawnSync } from "node:child_process";
import { Client } from "pg";
const u = spawnSync("node", ["scripts/_tmp/pooler-url.mjs"], { encoding: "utf8" });
const url = u.stdout.trim();
const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const col = await c.query(`SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='nex_peer_message' AND column_name IN ('send_intent_id','sender_account_id','body','attachment_meta') ORDER BY column_name`);
console.log("nex_peer_message columns:");
for (const r of col.rows) console.log(`  ${r.column_name} · ${r.data_type} (${r.udt_name})`);
const src = await c.query(`SELECT pg_get_functiondef(p.oid) AS src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='nex_create_cart_order_tx'`);
const text = src.rows[0].src;
// Print the INSERT INTO nex_peer_message block
const idx = text.indexOf("nex_peer_message");
console.log("\n=== deployed body · peer_message insert block ===");
console.log(text.slice(idx, idx + 600));
await c.end();
