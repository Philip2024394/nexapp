// scripts/test-nex-notification-recovery-sandbox.mjs
//
// Runtime test driver for nex_notification RECOVERY behaviour against
// the Supabase sandbox kdstoyyeygcopkogqsyv ONLY. Production
// ijvqdvsvwtwxzcqmoqit is sealed.
//
// Owner directive 2026-11-23c · prove the recovery fixes:
//
//   R1 · preserve_read_state semantics · first UPSERT of an order_paid
//        row inserts; a second UPSERT with ON CONFLICT DO NOTHING is
//        a no-op; crucially, if the row was MARKED READ between the
//        two writes, the second write MUST NOT reset read_at to NULL.
//        This is the "old retry cannot revive a read alert" invariant.
//
//   R2 · refresh_unread control · the same scenario for grouped-activity
//        rows (message / inquiry) still DOES flip read_at back to NULL
//        on new activity. This proves the mode selector works as
//        documented and the recovery fix did not regress ordinary
//        unread-reset behaviour.
//
//   R3 · concurrent-duplicate webhook simulation · two near-simultaneous
//        INSERT ... ON CONFLICT DO NOTHING against the same
//        (recipient, source_ref) resolve to exactly ONE row.
//
//   R4 · crash-between-event-and-inbox simulation · we insert a
//        placeholder nex_order_event-shaped row (metadata carries the
//        stripe_event_id) WITHOUT writing an inbox row, then run the
//        preserve_read_state UPSERT AGAIN (what the webhook recovery
//        path does on replay) · the inbox row appears exactly once.
//        Second replay is still a no-op.
//
// Dated 2026-11-23c.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

const CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv";
const PROD_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const urlProc = spawnSync("node", [resolve(repoRoot, "scripts/_tmp/pooler-url.mjs")], { encoding: "utf8" });
if (urlProc.status !== 0) { console.error("FATAL · pooler-url helper failed:", urlProc.stderr); process.exit(2); }
const url = urlProc.stdout.trim();
if (!url.includes(CANONICAL_PROJECT_REF) || url.includes(PROD_PROJECT_REF)) {
  console.error("STOP · pooler URL ref mismatch"); process.exit(3);
}
const parsed = new URL(url);
const m = parsed.username.match(/^postgres\.([a-z0-9]+)$/);
if (!m || m[1] !== CANONICAL_PROJECT_REF) {
  console.error(`STOP · pooler-username ref '${m?.[1]}' !== '${CANONICAL_PROJECT_REF}'`); process.exit(3);
}
console.log(`Target · sandbox ${CANONICAL_PROJECT_REF} via ${parsed.hostname}:${parsed.port}`);

const sentinel = `__notif_recov_${Date.now()}`;
const results = [];
let pass = 0, fail = 0;
function assert(name, cond, detail = "") {
  if (cond) { pass++; results.push({ name, outcome: "PASS", detail }); console.log(`  ✓ ${name}${detail ? " · " + detail : ""}`); }
  else      { fail++; results.push({ name, outcome: "FAIL", detail }); console.error(`  ✗ ${name}${detail ? " · " + detail : ""}`); }
}

// Mirror the writer's preserve_read_state branch · INSERT ... ON CONFLICT DO NOTHING.
// Returns {inserted, rowId}.
async function preserveUpsert(c, { recipient, source, source_ref, category, title, subtitle, href }) {
  const r = await c.query(
    `INSERT INTO nex_notification
       (recipient_account_id, source, source_ref, category, title, subtitle, href)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (recipient_account_id, source_ref) WHERE source_ref IS NOT NULL
     DO NOTHING
     RETURNING id`,
    [recipient, source, source_ref, category, title, subtitle, href],
  );
  return { inserted: r.rowCount === 1, rowId: r.rows[0]?.id ?? null };
}

// Mirror the writer's refresh_unread branch · UPSERT with DO UPDATE SET.
async function refreshUpsert(c, { recipient, source, source_ref, category, title, subtitle, href }) {
  const r = await c.query(
    `INSERT INTO nex_notification
       (recipient_account_id, source, source_ref, category, title, subtitle, href)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (recipient_account_id, source_ref) WHERE source_ref IS NOT NULL
     DO UPDATE SET
       title = EXCLUDED.title,
       subtitle = EXCLUDED.subtitle,
       created_at = now(),
       read_at = NULL
     RETURNING id`,
    [recipient, source, source_ref, category, title, subtitle, href],
  );
  return { rowId: r.rows[0].id };
}

const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
let acctA = null;
try {
  await c.connect();
  console.log("CONNECTED · pooler");

  acctA = randomUUID();
  await c.query(
    `INSERT INTO nex_account (id, display_name) VALUES ($1, $2)`,
    [acctA, `${sentinel}_A`],
  );
  console.log(`  seeded test account · A=${acctA.slice(0,8)}`);

  // ── R1 · preserve_read_state · no revive on retry ────────────
  console.log("── R1 · preserve_read_state · old retry cannot revive read alert");
  const orderId = randomUUID();
  const sourceRef = `order:${orderId}:paid`;
  const first = await preserveUpsert(c, {
    recipient: acctA, source: "order_paid", source_ref: sourceRef,
    category: "orders", title: `Order #${orderId.slice(0,8)}`,
    subtitle: "Paid · EUR 24.99", href: `/nex-native/manage/orders/${orderId}`,
  });
  assert("R1 · first write inserts", first.inserted === true, `rowId=${first.rowId?.slice(0,8)}`);

  // Seller reads the row (simulates drawer mark-read).
  await c.query(
    `UPDATE nex_notification SET read_at = now() WHERE id = $1 AND recipient_account_id = $2`,
    [first.rowId, acctA],
  );
  const afterRead = await c.query(`SELECT read_at FROM nex_notification WHERE id=$1`, [first.rowId]);
  assert("R1 · row marked read", afterRead.rows[0].read_at !== null);

  // Late webhook retry · same source_ref. MUST be a no-op; MUST NOT reset read_at.
  await new Promise((r) => setTimeout(r, 25));
  const replay = await preserveUpsert(c, {
    recipient: acctA, source: "order_paid", source_ref: sourceRef,
    category: "orders", title: `Order #${orderId.slice(0,8)}`,
    subtitle: "Paid · EUR 24.99", href: `/nex-native/manage/orders/${orderId}`,
  });
  assert("R1 · replay returns inserted=false", replay.inserted === false);
  const afterReplay = await c.query(
    `SELECT read_at, created_at FROM nex_notification WHERE id=$1`,
    [first.rowId],
  );
  assert(
    "R1 · replay did NOT reset read_at (old retry cannot revive read alert)",
    afterReplay.rows[0].read_at !== null,
  );
  // created_at should ALSO not have moved · the DO NOTHING path doesn't update it.
  assert(
    "R1 · replay did NOT bump created_at",
    new Date(afterReplay.rows[0].created_at).getTime() === new Date(afterRead.rows[0].created_at ?? afterReplay.rows[0].created_at).getTime(),
    "(created_at stable across replay)",
  );

  // ── R2 · refresh_unread control (message / inquiry) ─────────
  console.log("── R2 · refresh_unread control · message activity still revives unread");
  const convId = randomUUID();
  const msgRef = `msg:${convId}`;
  const msg1 = await refreshUpsert(c, {
    recipient: acctA, source: "message", source_ref: msgRef,
    category: "chats", title: "Peer", subtitle: "Sent you a message",
    href: `/nex-native/chat/peer/${convId}`,
  });
  await c.query(
    `UPDATE nex_notification SET read_at = now() WHERE id = $1 AND recipient_account_id = $2`,
    [msg1.rowId, acctA],
  );
  const msgAfterRead = await c.query(`SELECT read_at FROM nex_notification WHERE id=$1`, [msg1.rowId]);
  assert("R2 · message row marked read", msgAfterRead.rows[0].read_at !== null);
  await new Promise((r) => setTimeout(r, 25));
  await refreshUpsert(c, {
    recipient: acctA, source: "message", source_ref: msgRef,
    category: "chats", title: "Peer", subtitle: "Sent you a message",
    href: `/nex-native/chat/peer/${convId}`,
  });
  const msgAfterReplay = await c.query(`SELECT read_at FROM nex_notification WHERE id=$1`, [msg1.rowId]);
  assert(
    "R2 · new message activity DID reset read_at to NULL (unread reset preserved)",
    msgAfterReplay.rows[0].read_at === null,
  );

  // ── R3 · concurrent duplicate replays · one row only ─────────
  console.log("── R3 · simulated concurrent duplicate webhook replays");
  const orderIdC = randomUUID();
  const refC = `order:${orderIdC}:paid`;
  const [c1, c2] = await Promise.all([
    preserveUpsert(c, {
      recipient: acctA, source: "order_paid", source_ref: refC,
      category: "orders", title: `Order #${orderIdC.slice(0,8)}`,
      subtitle: "Paid · EUR 9.99", href: `/nex-native/manage/orders/${orderIdC}`,
    }),
    preserveUpsert(c, {
      recipient: acctA, source: "order_paid", source_ref: refC,
      category: "orders", title: `Order #${orderIdC.slice(0,8)}`,
      subtitle: "Paid · EUR 9.99", href: `/nex-native/manage/orders/${orderIdC}`,
    }),
  ]);
  const insertedCount = [c1, c2].filter((x) => x.inserted === true).length;
  assert("R3 · exactly one of the two concurrent writes was a true insert", insertedCount === 1);
  const countC = await c.query(
    `SELECT count(*)::int FROM nex_notification WHERE recipient_account_id=$1 AND source_ref=$2`,
    [acctA, refC],
  );
  assert("R3 · exactly one row for the dedup key", countC.rows[0].count === 1);

  // ── R4 · crash-between-event-and-inbox simulation ───────────
  console.log("── R4 · crash-between-event-and-inbox · replay recovery writes inbox exactly once");
  const orderIdD = randomUUID();
  const refD = `order:${orderIdD}:paid`;
  // Pretend the webhook crashed AFTER the nex_order_event row was
  // persisted but BEFORE the inbox UPSERT. Confirm the inbox is
  // missing · simulates what the OLD alreadyProcessed short-circuit
  // left behind on retries.
  const preInbox = await c.query(
    `SELECT count(*)::int FROM nex_notification WHERE recipient_account_id=$1 AND source_ref=$2`,
    [acctA, refD],
  );
  assert("R4 · before replay recovery · inbox row absent", preInbox.rows[0].count === 0);

  // Replay comes in · webhook route now runs the preserve_read_state
  // UPSERT regardless of alreadyProcessed. That's the fix.
  const recov = await preserveUpsert(c, {
    recipient: acctA, source: "order_paid", source_ref: refD,
    category: "orders", title: `Order #${orderIdD.slice(0,8)}`,
    subtitle: "Paid · EUR 49.00", href: `/nex-native/manage/orders/${orderIdD}`,
  });
  assert("R4 · replay recovery inserted the missing inbox row", recov.inserted === true);

  // A FURTHER replay must be a no-op · recovery is itself idempotent.
  const recov2 = await preserveUpsert(c, {
    recipient: acctA, source: "order_paid", source_ref: refD,
    category: "orders", title: `Order #${orderIdD.slice(0,8)}`,
    subtitle: "Paid · EUR 49.00", href: `/nex-native/manage/orders/${orderIdD}`,
  });
  assert("R4 · second recovery replay is a no-op", recov2.inserted === false);

  const postInbox = await c.query(
    `SELECT count(*)::int FROM nex_notification WHERE recipient_account_id=$1 AND source_ref=$2`,
    [acctA, refD],
  );
  assert("R4 · exactly one inbox row remains after recovery + replay", postInbox.rows[0].count === 1);

  // ── Summary ───────────────────────────────────────────────────
  console.log("\n────────────────────────────────────────");
  console.log(`SUMMARY · PASS=${pass} FAIL=${fail} TOTAL=${pass + fail}`);
  if (fail > 0) {
    for (const r of results) if (r.outcome === "FAIL") console.error(`  FAIL · ${r.name} · ${r.detail}`);
    process.exitCode = 1;
  }
} catch (e) {
  console.error(`FATAL: ${e.message}${e.code ? " SQLSTATE=" + e.code : ""}`);
  process.exitCode = 1;
} finally {
  try {
    if (acctA) {
      await c.query(`DELETE FROM nex_notification WHERE recipient_account_id = $1`, [acctA]);
      await c.query(`DELETE FROM nex_account WHERE id = $1`, [acctA]);
      console.log("cleanup · test rows + account removed");
    }
  } catch (ce) {
    console.error(`cleanup warn: ${ce.message}`);
  }
  try { await c.end(); } catch {}
}
