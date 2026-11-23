// scripts/test-nex-notification-sandbox.mjs
//
// Runtime test driver for nex_notification (migration 366) against the
// Supabase sandbox kdstoyyeygcopkogqsyv ONLY. Production
// ijvqdvsvwtwxzcqmoqit is sealed.
//
// Owner directive 2026-11-23 · exercise the key runtime behaviours the
// durable-inbox commit promises:
//
//   T1 · UPSERT dedup on (recipient_account_id, source_ref) with
//        source_ref NOT NULL → exactly one row, read_at NULL, created_at
//        refreshed on second write.
//   T2 · Unread reset after read → write once, mark read via explicit
//        UPDATE, write again with same source_ref → read_at should flip
//        back to NULL.
//   T3 · Rows with NULL source_ref do NOT dedup → two inserts both
//        succeed (partial unique index excludes NULLs).
//   T4 · Cross-account access denial · UPDATE with a DIFFERENT
//        recipient_account_id in WHERE affects 0 rows (the server-side
//        scoping used by the reader service).
//   T5 · Column-level grant invariant · the authenticated role has only
//        UPDATE(read_at) grant (already covered by apply-migration's
//        post-check #6; re-verified here).
//
// Dated 2026-11-23b.

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

const sentinel = `__notif_test_${Date.now()}`;
const results = [];
let pass = 0, fail = 0;
function assert(name, cond, detail = "") {
  if (cond) { pass++; results.push({ name, outcome: "PASS", detail }); console.log(`  ✓ ${name}${detail ? " · " + detail : ""}`); }
  else      { fail++; results.push({ name, outcome: "FAIL", detail }); console.error(`  ✗ ${name}${detail ? " · " + detail : ""}`); }
}

const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
let testAccountIdA = null;
let testAccountIdB = null;
try {
  await c.connect();
  console.log("CONNECTED · pooler");

  // ── Set up two throwaway accounts ─────────────────────────────
  testAccountIdA = randomUUID();
  testAccountIdB = randomUUID();
  await c.query(
    `INSERT INTO nex_account (id, display_name) VALUES ($1, $2), ($3, $4)`,
    [testAccountIdA, `${sentinel}_A`, testAccountIdB, `${sentinel}_B`],
  );
  console.log(`  seeded two test accounts · A=${testAccountIdA.slice(0,8)} B=${testAccountIdB.slice(0,8)}`);

  // ── T1 · UPSERT dedup on (recipient, source_ref) ──────────────
  console.log("── T1 · UPSERT dedup on (recipient, source_ref)");
  const ref1 = `test-t1:${randomUUID()}`;
  const ins1 = await c.query(
    `INSERT INTO nex_notification (recipient_account_id, source, source_ref, category, title, subtitle, href)
     VALUES ($1, 'message', $2, 'chats', 'First send', 'first subtitle', '/x')
     RETURNING id, created_at, read_at`,
    [testAccountIdA, ref1],
  );
  const firstId = ins1.rows[0].id;
  const firstCreatedAt = ins1.rows[0].created_at;
  assert("T1 · first write inserts", !!firstId);
  assert("T1 · first write has read_at=NULL", ins1.rows[0].read_at === null);

  // tiny delay so created_at bump is observable
  await new Promise((r) => setTimeout(r, 25));
  const ins2 = await c.query(
    `INSERT INTO nex_notification (recipient_account_id, source, source_ref, category, title, subtitle, href)
     VALUES ($1, 'message', $2, 'chats', 'Second send', 'second subtitle', '/x')
     ON CONFLICT (recipient_account_id, source_ref) WHERE source_ref IS NOT NULL
     DO UPDATE SET
       title = EXCLUDED.title,
       subtitle = EXCLUDED.subtitle,
       href = EXCLUDED.href,
       created_at = now(),
       read_at = NULL
     RETURNING id, created_at, read_at, title`,
    [testAccountIdA, ref1],
  );
  const secondId = ins2.rows[0].id;
  assert("T1 · second write dedups to same row", secondId === firstId, `id=${secondId.slice(0,8)}`);
  assert("T1 · second write bumps created_at", new Date(ins2.rows[0].created_at) > new Date(firstCreatedAt));
  assert("T1 · second write refreshes title", ins2.rows[0].title === "Second send");

  const count1 = await c.query(
    `SELECT count(*)::int FROM nex_notification WHERE recipient_account_id=$1 AND source_ref=$2`,
    [testAccountIdA, ref1],
  );
  assert("T1 · exactly one row for (recipient, source_ref)", count1.rows[0].count === 1);

  // ── T2 · Unread reset after read ──────────────────────────────
  console.log("── T2 · Unread reset after mark-read");
  await c.query(
    `UPDATE nex_notification SET read_at = now() WHERE id = $1 AND recipient_account_id = $2 AND read_at IS NULL`,
    [firstId, testAccountIdA],
  );
  const readState = await c.query(`SELECT read_at FROM nex_notification WHERE id=$1`, [firstId]);
  assert("T2 · mark-read set read_at", readState.rows[0].read_at !== null);

  await new Promise((r) => setTimeout(r, 25));
  const ins3 = await c.query(
    `INSERT INTO nex_notification (recipient_account_id, source, source_ref, category, title, subtitle, href)
     VALUES ($1, 'message', $2, 'chats', 'Third send', 'third subtitle', '/x')
     ON CONFLICT (recipient_account_id, source_ref) WHERE source_ref IS NOT NULL
     DO UPDATE SET
       title = EXCLUDED.title,
       created_at = now(),
       read_at = NULL
     RETURNING id, read_at`,
    [testAccountIdA, ref1],
  );
  assert("T2 · new activity flips group back to unread", ins3.rows[0].read_at === null);

  // ── T3 · NULL source_ref does NOT dedup ───────────────────────
  console.log("── T3 · NULL source_ref rows do not dedup");
  await c.query(
    `INSERT INTO nex_notification (recipient_account_id, source, source_ref, category, title, subtitle, href)
     VALUES ($1, 'system', NULL, 'system', 'one-shot a', 'a', '/x')`,
    [testAccountIdA],
  );
  await c.query(
    `INSERT INTO nex_notification (recipient_account_id, source, source_ref, category, title, subtitle, href)
     VALUES ($1, 'system', NULL, 'system', 'one-shot b', 'b', '/x')`,
    [testAccountIdA],
  );
  const countNull = await c.query(
    `SELECT count(*)::int FROM nex_notification WHERE recipient_account_id=$1 AND source_ref IS NULL`,
    [testAccountIdA],
  );
  assert("T3 · two NULL-source_ref rows coexist", countNull.rows[0].count === 2);

  // ── T4 · Cross-account access denial (WHERE scope) ────────────
  console.log("── T4 · Cross-account mark-read is filtered by WHERE");
  const badUpd = await c.query(
    `UPDATE nex_notification SET read_at = now()
      WHERE id = $1 AND recipient_account_id = $2
      RETURNING id`,
    [firstId, testAccountIdB],
  );
  assert("T4 · UPDATE with wrong recipient affects 0 rows", badUpd.rowCount === 0, `rowCount=${badUpd.rowCount}`);

  // Sanity · the row still belongs to A and is still unread from T2
  const sanity = await c.query(
    `SELECT recipient_account_id, read_at FROM nex_notification WHERE id=$1`,
    [firstId],
  );
  assert("T4 · row still owned by A", sanity.rows[0].recipient_account_id === testAccountIdA);
  assert("T4 · row still unread (UPDATE did not touch it)", sanity.rows[0].read_at === null);

  // ── T5 · Column-level grant invariant ─────────────────────────
  console.log("── T5 · column-level grants");
  const grants = await c.query(`
    SELECT grantee, privilege_type, column_name
      FROM information_schema.column_privileges
     WHERE table_schema='public' AND table_name='nex_notification'
       AND grantee='authenticated' AND privilege_type='UPDATE'
     ORDER BY column_name`);
  const cols = grants.rows.map(r => r.column_name);
  assert("T5 · authenticated UPDATE grant is ONLY read_at", cols.length === 1 && cols[0] === "read_at", `cols=${JSON.stringify(cols)}`);

  const anonAny = await c.query(`
    SELECT 1
      FROM information_schema.column_privileges
     WHERE table_schema='public' AND table_name='nex_notification' AND grantee='anon'
     LIMIT 1`);
  assert("T5 · anon has NO grants", anonAny.rowCount === 0);

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
  // ── Cleanup ─────────────────────────────────────────────────
  try {
    if (testAccountIdA) {
      await c.query(`DELETE FROM nex_notification WHERE recipient_account_id = ANY($1::uuid[])`, [[testAccountIdA, testAccountIdB]]);
      await c.query(`DELETE FROM nex_account WHERE id = ANY($1::uuid[])`, [[testAccountIdA, testAccountIdB]]);
      console.log("cleanup · test rows + accounts removed");
    }
  } catch (ce) {
    console.error(`cleanup warn: ${ce.message}`);
  }
  try { await c.end(); } catch {}
}
