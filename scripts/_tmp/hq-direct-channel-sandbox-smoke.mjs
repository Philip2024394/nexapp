#!/usr/bin/env node
// HQ direct channel · sandbox smoke test (NOT production).
// -----------------------------------------------------------------------------
// Steps (owner-authorised 2026-11-08):
//   1. Verify SBX_DB is the sandbox (kdstoyyeygcopkogqsyv).
//   2. Apply migration 301 inside a transaction wrapper.
//   3. Seed two synthetic nex_account rows (hq-admin + target).
//   4. Call nex_hq_direct_send twice and nex_hq_direct_channel_upsert once.
//   5. Verify:
//      · the sentinel row exists in nex_account
//      · a channel row was created and is idempotent
//      · a nex_peer_message row exists with sender=sentinel + the HQ marker
//      · a nex_peer_conversation row exists (canonical ordering)
//   6. Clean up: delete the test target + its conversation + channel row.
//      The sentinel row stays · future apps depend on it.
//
// Usage:
//   SBX_DB="postgresql://..." node scripts/_tmp/hq-direct-channel-sandbox-smoke.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

// Resolve SBX_DB · env var preferred · fall back to parsing
// SANDBOX_DATABASE_URL out of .env.local.
let SBX_DB = process.env.SBX_DB;
if (!SBX_DB) {
  const envPath = path.join(repoRoot, ".env.local");
  if (fs.existsSync(envPath)) {
    const txt = fs.readFileSync(envPath, "utf8");
    const match = txt.match(/^SANDBOX_DATABASE_URL=(.+)$/m);
    if (match) SBX_DB = match[1].trim();
  }
}
if (!SBX_DB) throw new Error("SBX_DB not set and SANDBOX_DATABASE_URL not in .env.local");
if (SBX_DB.includes("ijvqdvsvwtwxzcqmoqit")) {
  throw new Error("safeguard · production ref detected · aborting");
}
if (!SBX_DB.includes("kdstoyyeygcopkogqsyv")) {
  throw new Error("safeguard · unexpected sandbox ref · aborting");
}

const SENTINEL = "11111111-aaaa-aaaa-aaaa-111111111111";
const HQ_ACCOUNT = "99999999-dddd-4000-8000-000000000001";
const TARGET_ACCOUNT = "99999999-dddd-4000-8000-000000000002";

const client = new pg.Client({
  connectionString: SBX_DB,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const ref = await client.query(
  "SELECT current_database() AS db, inet_server_addr() AS host",
);
console.log("sandbox db:", ref.rows[0].db, "host:", ref.rows[0].host);

async function run(label, fn) {
  console.log(`\n=== ${label} ===`);
  try {
    await fn();
    console.log(`PASS · ${label}`);
  } catch (e) {
    console.error(`FAIL · ${label}`);
    console.error(e);
    throw e;
  }
}

// Clean up any prior run artifacts (idempotent).
async function cleanup() {
  await client.query(
    `delete from nex_hq_direct_channel where target_account_id = $1`,
    [TARGET_ACCOUNT],
  );
  await client.query(
    `delete from nex_peer_message where sender_account_id = $1 and conversation_id in (
       select id from nex_peer_conversation where participant_a_id = $2 or participant_b_id = $2
     )`,
    [SENTINEL, TARGET_ACCOUNT],
  );
  await client.query(
    `delete from nex_peer_conversation where participant_a_id = $1 or participant_b_id = $1`,
    [TARGET_ACCOUNT],
  );
  await client.query(`delete from nex_account where id in ($1,$2)`, [
    HQ_ACCOUNT,
    TARGET_ACCOUNT,
  ]);
}

// Step 2 · apply migration 301 (BEFORE cleanup · cleanup uses the
// new tables).
await run("apply migration 301", async () => {
  // Skip if already applied.
  const applied = await client.query(
    `select 1 from nex_migration_history where version = '301'`,
  );
  if (applied.rowCount > 0) {
    console.log("migration 301 already applied · skipping apply step");
    return;
  }
  const sqlPath = path.join(
    repoRoot,
    "nex-supabase",
    "migrations",
    "301_nex_hq_direct_channel.sql",
  );
  const sql = fs.readFileSync(sqlPath, "utf8");
  await client.query(sql);
  console.log("migration 301 applied");
});

await run("post-apply cleanup (idempotent)", cleanup);

// Step 3 · seed synthetic accounts.
await run("seed synthetic HQ + target accounts", async () => {
  await client.query(
    `insert into nex_account (id, display_name) values ($1, $2)
     on conflict (id) do nothing`,
    [HQ_ACCOUNT, "HQ admin · sandbox smoke"],
  );
  await client.query(
    `insert into nex_account (id, display_name) values ($1, $2)
     on conflict (id) do nothing`,
    [TARGET_ACCOUNT, "Target user · sandbox smoke"],
  );
});

// Step 4 · verify sentinel exists.
await run("sentinel account exists", async () => {
  const r = await client.query(
    `select id, display_name from nex_account where id = $1`,
    [SENTINEL],
  );
  if (r.rowCount !== 1) throw new Error("sentinel row missing");
  if (r.rows[0].display_name !== "Nex") {
    throw new Error(`sentinel display_name is '${r.rows[0].display_name}' expected 'Nex'`);
  }
});

// Step 5 · call upsert · first call creates, second call returns same id.
let channelIdA;
let channelIdB;
await run("upsert idempotency", async () => {
  const r1 = await client.query(
    `select nex_hq_direct_channel_upsert($1, $2) as id`,
    [TARGET_ACCOUNT, HQ_ACCOUNT],
  );
  channelIdA = r1.rows[0].id;
  const r2 = await client.query(
    `select nex_hq_direct_channel_upsert($1, $2) as id`,
    [TARGET_ACCOUNT, HQ_ACCOUNT],
  );
  channelIdB = r2.rows[0].id;
  if (channelIdA !== channelIdB) {
    throw new Error(`channel id not idempotent: ${channelIdA} vs ${channelIdB}`);
  }
  console.log("channel id:", channelIdA);
});

// Step 6 · send a message · verify message + conversation.
let messageId;
await run("send a direct message", async () => {
  const r = await client.query(
    `select nex_hq_direct_send($1, $2, $3) as id`,
    [TARGET_ACCOUNT, HQ_ACCOUNT, "hello · sandbox smoke"],
  );
  messageId = r.rows[0].id;
  if (!messageId) throw new Error("no message id returned");
  console.log("message id:", messageId);
});

// Step 7 · verify the message row.
await run("message row has sentinel sender + HQ origin marker", async () => {
  const r = await client.query(
    `select sender_account_id, body, attachment_meta from nex_peer_message where id = $1`,
    [messageId],
  );
  if (r.rowCount !== 1) throw new Error("message row missing");
  const row = r.rows[0];
  if (row.sender_account_id !== SENTINEL) {
    throw new Error(`sender_account_id=${row.sender_account_id} expected ${SENTINEL}`);
  }
  if (row.body !== "hello · sandbox smoke") {
    throw new Error(`body mismatch: ${row.body}`);
  }
  if (
    !row.attachment_meta ||
    row.attachment_meta.nex_hq_origin !== true ||
    row.attachment_meta.authored_by_hq_account_id !== HQ_ACCOUNT
  ) {
    throw new Error(
      `attachment_meta shape mismatch: ${JSON.stringify(row.attachment_meta)}`,
    );
  }
  console.log("message attachment_meta:", row.attachment_meta);
});

// Step 8 · verify conversation ordering + last_message_at.
await run("peer conversation canonical + last_message_at bumped", async () => {
  const r = await client.query(
    `select participant_a_id, participant_b_id, last_message_at
       from nex_peer_conversation
      where (participant_a_id = $1 and participant_b_id = $2)
         or (participant_a_id = $2 and participant_b_id = $1)`,
    [SENTINEL, TARGET_ACCOUNT],
  );
  if (r.rowCount !== 1) throw new Error("conversation row missing");
  const row = r.rows[0];
  if (!(row.participant_a_id < row.participant_b_id)) {
    throw new Error(
      `canonical ordering violated: a=${row.participant_a_id} b=${row.participant_b_id}`,
    );
  }
  if (!row.last_message_at) {
    throw new Error("last_message_at not set");
  }
});

// Step 9 · idempotent second send.
await run("second send inserts another message in same channel", async () => {
  const r = await client.query(
    `select nex_hq_direct_send($1, $2, $3) as id`,
    [TARGET_ACCOUNT, HQ_ACCOUNT, "second · sandbox smoke"],
  );
  const id2 = r.rows[0].id;
  if (!id2 || id2 === messageId) throw new Error("second send did not produce a distinct message id");
  const countR = await client.query(
    `select count(*)::int as n from nex_peer_message where sender_account_id = $1
       and conversation_id in (select id from nex_peer_conversation
                                 where participant_a_id = $1 and participant_b_id = $2
                                    or participant_a_id = $2 and participant_b_id = $1)`,
    [SENTINEL, TARGET_ACCOUNT],
  );
  if (countR.rows[0].n !== 2) {
    throw new Error(`expected 2 messages, got ${countR.rows[0].n}`);
  }
});

// Step 10 · verify body-length validation rejects empty + overlong.
await run("body-length validation", async () => {
  let threw = false;
  try {
    await client.query(`select nex_hq_direct_send($1, $2, $3) as id`, [
      TARGET_ACCOUNT,
      HQ_ACCOUNT,
      "",
    ]);
  } catch (e) {
    threw = /_body length must be 1..4000/.test(String(e.message));
  }
  if (!threw) throw new Error("empty body did not throw");
  threw = false;
  try {
    await client.query(`select nex_hq_direct_send($1, $2, $3) as id`, [
      TARGET_ACCOUNT,
      HQ_ACCOUNT,
      "x".repeat(4001),
    ]);
  } catch (e) {
    threw = /_body length must be 1..4000/.test(String(e.message));
  }
  if (!threw) throw new Error("overlong body did not throw");
});

// Step 11 · cleanup.
await run("cleanup", cleanup);

console.log("\nALL SANDBOX SMOKE STEPS PASSED");
await client.end();
