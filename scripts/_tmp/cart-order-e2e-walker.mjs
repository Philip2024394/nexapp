// scripts/_tmp/cart-order-e2e-walker.mjs
//
// End-to-end cart→order walker for sandbox kdstoyyeygcopkogqsyv.
// Proves nex_create_cart_order_tx writes atomically to three tables:
//   (1) nex_peer_message · (2) nex_order · (3) nex_order_event
// Uses service_role path (NULL auth.uid + role=service_role) to simulate
// the server-flag code-path NEX_CART_ORDER_TX=1 would hit, isolated here.
// Prod ijvqdvsvwtwxzcqmoqit SEALED · sandbox only.

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

const SANDBOX = "kdstoyyeygcopkogqsyv";
const PROD = "ijvqdvsvwtwxzcqmoqit";

const urlProc = spawnSync("node", ["scripts/_tmp/pooler-url.mjs"], { encoding: "utf8" });
if (urlProc.status !== 0) { console.error("pooler-url failed"); process.exit(2); }
const url = urlProc.stdout.trim();
if (!url.includes(SANDBOX) || url.includes(PROD)) { console.error("bad ref"); process.exit(3); }

const RUN_TAG = `cart-e2e-${Date.now()}`;
const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
console.log(`CONNECTED · sandbox ${SANDBOX}`);

const steps = [];
function step(name, ok, detail) {
  steps.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} · ${name} · ${detail}`);
}

const accts = await c.query(`SELECT a.id, a.supabase_user_id, a.nex_handle
  FROM nex_account a WHERE a.nex_handle IN ('nex-99901','nex-99903') ORDER BY nex_handle`);
const hamrex = accts.rows.find(r => r.nex_handle === "nex-99901");
const rosa = accts.rows.find(r => r.nex_handle === "nex-99903");
console.log(`fixtures · hamrex=${hamrex.id.slice(0,8)} rosa=${rosa.id.slice(0,8)}`);

const conv = await c.query(`SELECT id FROM nex_peer_conversation
  WHERE (participant_a_id=$1 AND participant_b_id=$2) OR (participant_a_id=$2 AND participant_b_id=$1) LIMIT 1`,
  [hamrex.id, rosa.id]);
const convId = conv.rows[0].id;

const prod = await c.query(`SELECT p.id, p.business_id, p.price_pence, p.currency
  FROM nex_product p JOIN nex_business b ON b.id = p.business_id
  WHERE b.owner_account_id = $1 LIMIT 1`, [rosa.id]);
const product = prod.rows[0];
console.log(`conv=${convId.slice(0,8)} product=${product.id.slice(0,8)}`);

async function callRpcServiceRole(params) {
  const trx = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await trx.connect();
  try {
    await trx.query("BEGIN");
    await trx.query(`SET LOCAL ROLE service_role`);
    const r = await trx.query(`SELECT * FROM nex_create_cart_order_tx($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, params);
    await trx.query("COMMIT");
    return { ok: true, rows: r.rows };
  } catch (e) {
    try { await trx.query("ROLLBACK"); } catch {}
    return { ok: false, code: e.code, message: e.message };
  } finally {
    try { await trx.end(); } catch {}
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Step 1 · Fresh cart→order, unique send_intent + idempotency key.
// Expect: RPC returns (out_message_id, out_order_id, NULL skipped).
// Then verify rows in nex_peer_message, nex_order, nex_order_event.
// ──────────────────────────────────────────────────────────────────────────
const sendIntent1 = randomUUID();
const orderId1 = randomUUID();
const idem1 = `${RUN_TAG}-fresh`;
const body1 = `[${RUN_TAG}] cart msg 1`;
const meta1 = { source: "cart-e2e-walker", run: RUN_TAG };

const r1 = await callRpcServiceRole([
  hamrex.supabase_user_id, hamrex.id, convId, body1, meta1,
  sendIntent1, orderId1, product.id, idem1, "note-1"
]);
if (!r1.ok) {
  step("S1 · fresh rpc call", false, `RPC fail code=${r1.code} msg=${r1.message}`);
} else {
  const row = r1.rows[0];
  step("S1 · fresh rpc call", row.out_order_id === orderId1 && row.out_skipped === null,
    `msg=${row.out_message_id.slice(0,8)} order=${row.out_order_id.slice(0,8)} skipped=${row.out_skipped}`);

  // Verify nex_peer_message
  const m = await c.query(`SELECT id, conversation_id, sender_account_id, body, send_intent_id, attachment_meta
    FROM nex_peer_message WHERE id = $1`, [row.out_message_id]);
  step("S1a · nex_peer_message row", m.rows.length === 1 && m.rows[0].conversation_id === convId
    && m.rows[0].sender_account_id === hamrex.id && m.rows[0].send_intent_id === sendIntent1,
    `rows=${m.rows.length} send_intent=${m.rows[0]?.send_intent_id?.slice(0,8)} body=${m.rows[0]?.body}`);

  // Verify nex_order
  const o = await c.query(`SELECT id, customer_account_id, business_id, product_id, state,
    price_pence, currency, idempotency_key, customer_note FROM nex_order WHERE id = $1`, [row.out_order_id]);
  step("S1b · nex_order row", o.rows.length === 1 && o.rows[0].customer_account_id === hamrex.id
    && o.rows[0].business_id === product.business_id && o.rows[0].product_id === product.id
    && o.rows[0].state === "created" && o.rows[0].idempotency_key === idem1,
    `rows=${o.rows.length} state=${o.rows[0]?.state} price=${o.rows[0]?.price_pence} cur=${o.rows[0]?.currency}`);

  // Verify nex_order_event
  const e = await c.query(`SELECT id, order_id, event, actor_account_id, metadata
    FROM nex_order_event WHERE order_id = $1`, [row.out_order_id]);
  step("S1c · nex_order_event row", e.rows.length === 1 && e.rows[0].event === "created"
    && e.rows[0].actor_account_id === hamrex.id && e.rows[0].metadata?.product_id === product.id,
    `rows=${e.rows.length} event=${e.rows[0]?.event} meta.product=${e.rows[0]?.metadata?.product_id?.slice(0,8)}`);
}

// ──────────────────────────────────────────────────────────────────────────
// Step 2 · Replay same idempotency_key with fresh send_intent.
// Expect: order_dedup_hit, same order_id, no new order/event row.
// ──────────────────────────────────────────────────────────────────────────
const sendIntent2 = randomUUID();
const orderId2unused = randomUUID();
const r2 = await callRpcServiceRole([
  hamrex.supabase_user_id, hamrex.id, convId, `${body1} replay`, meta1,
  sendIntent2, orderId2unused, product.id, idem1, "note-1"
]);
if (!r2.ok) {
  step("S2 · replay idempotency", false, `RPC fail ${r2.code} ${r2.message}`);
} else {
  const row = r2.rows[0];
  step("S2 · replay idempotency", row.out_skipped === "order_dedup_hit" && row.out_order_id === orderId1,
    `skipped=${row.out_skipped} order=${row.out_order_id.slice(0,8)} (expected ${orderId1.slice(0,8)})`);
  const count = await c.query(`SELECT count(*)::int AS n FROM nex_order WHERE idempotency_key = $1`, [idem1]);
  step("S2a · single order row preserved", count.rows[0].n === 1, `n=${count.rows[0].n}`);
}

// ──────────────────────────────────────────────────────────────────────────
// Step 3 · Null product → message written, order skipped=no_product_item.
// Proves message-only flow (no_product_item path).
// ──────────────────────────────────────────────────────────────────────────
const sendIntent3 = randomUUID();
const r3 = await callRpcServiceRole([
  hamrex.supabase_user_id, hamrex.id, convId, `${RUN_TAG} msg-only`, meta1,
  sendIntent3, randomUUID(), null, null, null
]);
if (!r3.ok) {
  step("S3 · null-product msg-only", false, `RPC fail ${r3.code} ${r3.message}`);
} else {
  const row = r3.rows[0];
  step("S3 · null-product msg-only", row.out_order_id === null && row.out_skipped === "no_product_item",
    `msg=${row.out_message_id?.slice(0,8)} order=${row.out_order_id} skipped=${row.out_skipped}`);
  const m = await c.query(`SELECT id FROM nex_peer_message WHERE send_intent_id = $1`, [sendIntent3]);
  step("S3a · message row written", m.rows.length === 1, `rows=${m.rows.length}`);
}

// ──────────────────────────────────────────────────────────────────────────
// Step 4 · Replay same send_intent (ON CONFLICT partial unique index path).
// Expect: RPC resolves dedup via SELECT fallback, returns existing message id.
// This is the 42P10 code path mig 365 fixed.
// ──────────────────────────────────────────────────────────────────────────
const idem4 = `${RUN_TAG}-si-replay`;
const r4 = await callRpcServiceRole([
  hamrex.supabase_user_id, hamrex.id, convId, `${body1} si-replay`, meta1,
  sendIntent1, randomUUID(), product.id, idem4, "note-4"
]);
if (!r4.ok) {
  step("S4 · send_intent replay (42P10 path)", false, `RPC fail ${r4.code} ${r4.message}`);
} else {
  const row = r4.rows[0];
  // Message reused (same send_intent); order is new (fresh idem key).
  const m = await c.query(`SELECT id FROM nex_peer_message WHERE send_intent_id = $1`, [sendIntent1]);
  step("S4 · send_intent replay (42P10 path)", m.rows.length === 1 && row.out_message_id === m.rows[0].id,
    `msg_count=${m.rows.length} reused=${row.out_message_id === m.rows[0].id}`);
}

// ──────────────────────────────────────────────────────────────────────────
// Cleanup · delete only rows created by this run.
// ──────────────────────────────────────────────────────────────────────────
const cleanupOrders = await c.query(`SELECT id FROM nex_order WHERE idempotency_key LIKE $1`, [`${RUN_TAG}%`]);
for (const o of cleanupOrders.rows) {
  await c.query(`DELETE FROM nex_order_event WHERE order_id = $1`, [o.id]);
  await c.query(`DELETE FROM nex_order WHERE id = $1`, [o.id]);
}
const cleanupMsgs = await c.query(`DELETE FROM nex_peer_message
  WHERE sender_account_id = $1 AND attachment_meta->>'run' = $2 RETURNING id`, [hamrex.id, RUN_TAG]);
console.log(`CLEANUP · orders=${cleanupOrders.rows.length} messages=${cleanupMsgs.rows.length}`);

const passed = steps.filter(s => s.ok).length;
console.log(`\nSUMMARY · ${passed}/${steps.length} passed`);
await c.end();
process.exit(passed === steps.length ? 0 : 1);
