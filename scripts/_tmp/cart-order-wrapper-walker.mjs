// scripts/_tmp/cart-order-wrapper-walker.mjs
//
// Server-action-layer walker for sandbox kdstoyyeygcopkogqsyv ONLY.
// Exercises the exact code path sendCartOrderAction takes when the
// NEX_CART_ORDER_TX=1 flag is ON: build a Supabase admin client,
// invoke createCartOrderTransactionalCandidate wrapper, verify the
// three DB tables + the attachment_meta payload the UI reads.
//
// Prerequisites verified:
//   · mig 365 applied · body md5 065e806e
//   · 9/9 security contract PASS
//   · 9/9 three-table E2E walker PASS
//   · NEX_CART_ORDER_TX=1 loaded ONLY in this process (export above)
//
// Does NOT modify committed .env or shared config.
// Production ijvqdvsvwtwxzcqmoqit SEALED · sandbox only.

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { Client } from "pg";
import { randomUUID, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createCartOrderTransactionalCandidate }
  from "../../src/lib/nex-native/calls/send-cart-order.transactional-candidate.ts";

const SANDBOX = "kdstoyyeygcopkogqsyv";
const PROD = "ijvqdvsvwtwxzcqmoqit";

function env(k) {
  const raw = readFileSync(".env.local", "utf8");
  const m = raw.match(new RegExp("^" + k + "=(.*)$", "m"));
  if (!m) return null;
  let x = m[1].trim();
  if ((x.startsWith('"') && x.endsWith('"')) || (x.startsWith("'") && x.endsWith("'"))) x = x.slice(1, -1);
  return x || null;
}

// Verify flag is set in THIS process only.
if (process.env.NEX_CART_ORDER_TX !== "1") {
  console.error("STOP · NEX_CART_ORDER_TX must be exported =1 in this process.");
  console.error("Run as: NEX_CART_ORDER_TX=1 node scripts/_tmp/cart-order-wrapper-walker.mjs");
  process.exit(1);
}
console.log("FLAG · NEX_CART_ORDER_TX=1 loaded in this process (committed .env unchanged)");

const supabaseUrl = env("NEXT_PUBLIC_NEX_SUPABASE_URL");
const serviceKey = env("NEX_SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceKey) { console.error("STOP · supabase env missing"); process.exit(1); }
if (!supabaseUrl.includes(SANDBOX) || supabaseUrl.includes(PROD)) {
  console.error("STOP · supabase URL ref mismatch"); process.exit(1);
}

// Build the admin client the same way src/lib/nex-native/supabase-admin.ts does.
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Pooler URL for row verification (same pattern as the three-table walker).
const urlProc = spawnSync("node", ["scripts/_tmp/pooler-url.mjs"], { encoding: "utf8" });
if (urlProc.status !== 0) { console.error("pooler-url failed"); process.exit(2); }
const dbUrl = urlProc.stdout.trim();
if (!dbUrl.includes(SANDBOX) || dbUrl.includes(PROD)) {
  console.error("STOP · pooler ref mismatch"); process.exit(1);
}
const pgc = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await pgc.connect();
console.log(`CONNECTED · sandbox ${SANDBOX} via supabase-js admin + pg`);

const steps = [];
function step(name, ok, detail) {
  steps.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} · ${name} · ${detail}`);
}

// Fixtures: reuse Hamrex 99901 + Rosa 99903 + Rosa's product.
const accts = await pgc.query(`SELECT a.id, a.supabase_user_id, a.nex_handle
  FROM nex_account a WHERE a.nex_handle IN ('nex-99901','nex-99903') ORDER BY nex_handle`);
const hamrex = accts.rows.find(r => r.nex_handle === "nex-99901");
const rosa = accts.rows.find(r => r.nex_handle === "nex-99903");
const conv = await pgc.query(`SELECT id FROM nex_peer_conversation
  WHERE (participant_a_id=$1 AND participant_b_id=$2) OR (participant_a_id=$2 AND participant_b_id=$1) LIMIT 1`,
  [hamrex.id, rosa.id]);
const convId = conv.rows[0].id;
const prod = await pgc.query(`SELECT p.id, p.business_id, p.price_pence, p.currency, p.name
  FROM nex_product p JOIN nex_business b ON b.id = p.business_id
  WHERE b.owner_account_id = $1 LIMIT 1`, [rosa.id]);
const product = prod.rows[0];
console.log(`fixtures · hamrex=${hamrex.id.slice(0,8)} rosa=${rosa.id.slice(0,8)} conv=${convId.slice(0,8)} product=${product.id.slice(0,8)}`);

const RUN_TAG = `wrapper-walker-${Date.now()}`;

// Step W1 · wrapper path with full UI-realistic attachment_meta.cart payload.
const sendIntent = randomUUID();
const orderId = randomUUID();
const cartSnapshot = {
  order_id: orderId,
  items: [{
    kind: "product",
    id: product.id,
    title: product.name,
    price_pence: product.price_pence,
    currency: product.currency,
    quantity: 1,
    business_id: product.business_id,
  }],
  totals: {
    subtotal_pence: product.price_pence,
    currency: product.currency,
  },
  buyer_note: `[${RUN_TAG}] test cart submission`,
  // NOTE · delivery_address intentionally omitted · today the legacy path
  // writes this plaintext. This walker exercises the atomic RPC path and
  // confirms the RPC does not require delivery_address plaintext at all.
  run_tag: RUN_TAG,
};

const w1 = await createCartOrderTransactionalCandidate(admin, {
  selfSupabaseUserId: hamrex.supabase_user_id,
  senderAccountId: hamrex.id,
  conversationId: convId,
  messageBody: `cart order ${RUN_TAG}`,
  attachmentMeta: { cart: cartSnapshot },
  sendIntentId: sendIntent,
  orderId: orderId,
  primaryProductId: product.id,
  idempotencyKey: sendIntent,
  customerNote: "wrapper-walker customer note",
});

step("W1 · wrapper call returns ok", w1.ok === true && w1.messageId && w1.orderId === orderId,
  `ok=${w1.ok} msgId=${w1.messageId?.slice(0,8)} orderId=${w1.orderId?.slice(0,8)} skipped=${w1.skipped} error=${w1.error}`);

// Verify nex_peer_message row + attachment_meta.cart payload roundtrips intact.
const m = await pgc.query(`SELECT id, conversation_id, sender_account_id, body, attachment_meta, send_intent_id
  FROM nex_peer_message WHERE id = $1`, [w1.messageId]);
const meta = m.rows[0]?.attachment_meta;
step("W1a · nex_peer_message row + attachment_meta.cart intact",
  m.rows.length === 1 && meta?.cart?.order_id === orderId && meta?.cart?.run_tag === RUN_TAG,
  `rows=${m.rows.length} cart.order_id=${meta?.cart?.order_id?.slice(0,8)} items=${meta?.cart?.items?.length}`);

// Verify nex_order row.
const o = await pgc.query(`SELECT id, customer_account_id, business_id, product_id, state,
  price_pence, currency, idempotency_key, customer_note FROM nex_order WHERE id = $1`, [w1.orderId]);
step("W1b · nex_order row persists w/ customer_note + idem",
  o.rows.length === 1 && o.rows[0].state === "created" && o.rows[0].idempotency_key === sendIntent
    && o.rows[0].customer_note === "wrapper-walker customer note",
  `rows=${o.rows.length} state=${o.rows[0]?.state} customer_note=${o.rows[0]?.customer_note}`);

// Verify nex_order_event row.
const e = await pgc.query(`SELECT event, actor_account_id, metadata FROM nex_order_event WHERE order_id = $1`, [w1.orderId]);
step("W1c · nex_order_event row + metadata.product_id",
  e.rows.length === 1 && e.rows[0].event === "created" && e.rows[0].metadata?.product_id === product.id,
  `rows=${e.rows.length} event=${e.rows[0]?.event} meta.product=${e.rows[0]?.metadata?.product_id?.slice(0,8)}`);

// Step W2 · wrapper dedup replay (same send_intent + same orderId + same idem).
const w2 = await createCartOrderTransactionalCandidate(admin, {
  selfSupabaseUserId: hamrex.supabase_user_id,
  senderAccountId: hamrex.id,
  conversationId: convId,
  messageBody: `cart order ${RUN_TAG} replay`,
  attachmentMeta: { cart: cartSnapshot },
  sendIntentId: sendIntent,
  orderId: randomUUID(), // ignored by RPC when idem hits
  primaryProductId: product.id,
  idempotencyKey: sendIntent,
  customerNote: "replay",
});
step("W2 · wrapper dedup returns order_dedup_hit, same orderId",
  w2.ok === true && w2.skipped === "order_dedup_hit" && w2.orderId === orderId,
  `ok=${w2.ok} skipped=${w2.skipped} orderId=${w2.orderId?.slice(0,8)}`);

// Step W3 · caller-identity-mismatch error mapping.
const w3 = await createCartOrderTransactionalCandidate(admin, {
  selfSupabaseUserId: randomUUID(), // random uuid, not a real account
  senderAccountId: hamrex.id,
  conversationId: convId,
  messageBody: `cart order ${RUN_TAG} bad-identity`,
  attachmentMeta: { cart: cartSnapshot },
  sendIntentId: randomUUID(),
  orderId: randomUUID(),
  primaryProductId: product.id,
  idempotencyKey: randomUUID(),
  customerNote: null,
});
step("W3 · wrong supabase_user_id returns caller_account_not_found",
  w3.ok === false && w3.error === "caller_account_not_found",
  `ok=${w3.ok} error=${w3.error}`);

// Step W4 · product_not_found error mapping.
const w4 = await createCartOrderTransactionalCandidate(admin, {
  selfSupabaseUserId: hamrex.supabase_user_id,
  senderAccountId: hamrex.id,
  conversationId: convId,
  messageBody: `cart order ${RUN_TAG} bad-product`,
  attachmentMeta: { cart: cartSnapshot },
  sendIntentId: randomUUID(),
  orderId: randomUUID(),
  primaryProductId: randomUUID(), // random uuid, no product
  idempotencyKey: randomUUID(),
  customerNote: null,
});
step("W4 · invalid product_id returns product_not_found",
  w4.ok === false && w4.error === "product_not_found",
  `ok=${w4.ok} error=${w4.error}`);

// Step W5 · null product → no_product_item skipped, message-only.
const sendIntentW5 = randomUUID();
const w5 = await createCartOrderTransactionalCandidate(admin, {
  selfSupabaseUserId: hamrex.supabase_user_id,
  senderAccountId: hamrex.id,
  conversationId: convId,
  messageBody: `cart order ${RUN_TAG} msg-only`,
  attachmentMeta: { cart: { ...cartSnapshot, items: [] } },
  sendIntentId: sendIntentW5,
  orderId: randomUUID(),
  primaryProductId: null,
  idempotencyKey: null,
  customerNote: null,
});
step("W5 · null product returns no_product_item skipped",
  w5.ok === true && w5.skipped === "no_product_item" && w5.orderId === null,
  `ok=${w5.ok} skipped=${w5.skipped} orderId=${w5.orderId}`);

// Cleanup: delete only rows from this run.
const cleanOrders = await pgc.query(`SELECT id FROM nex_order WHERE id IN ($1)`, [orderId]);
for (const r of cleanOrders.rows) {
  await pgc.query(`DELETE FROM nex_order_event WHERE order_id = $1`, [r.id]);
  await pgc.query(`DELETE FROM nex_order WHERE id = $1`, [r.id]);
}
const cleanMsgs = await pgc.query(`DELETE FROM nex_peer_message
  WHERE sender_account_id = $1 AND attachment_meta->'cart'->>'run_tag' = $2 RETURNING id`, [hamrex.id, RUN_TAG]);
console.log(`CLEANUP · orders=${cleanOrders.rows.length} messages=${cleanMsgs.rows.length}`);

const passed = steps.filter(s => s.ok).length;
console.log(`\nSUMMARY · ${passed}/${steps.length} passed`);
await pgc.end();
process.exit(passed === steps.length ? 0 : 1);
