// scripts/attachment-migration/_integration-check.mjs
//
// One-shot integration check against the sandbox project. Run
// manually to verify the migration tool end-to-end with synthetic
// fixtures. NOT run by the vitest suite.
//
// Usage: node scripts/attachment-migration/_integration-check.mjs

import fs from "node:fs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import {
  migrateOneRecord,
  parseStoragePath,
} from "./migrate-ciphertext.mjs";

const envText = fs.readFileSync(".env.local", "utf8");
const readEnv = (k) => envText.match(new RegExp("^" + k + "=(.+)$", "m"))?.[1]?.trim() ?? null;

const SANDBOX_DB = readEnv("SANDBOX_DATABASE_URL");
const SB_URL = readEnv("SANDBOX_SUPABASE_URL");
const SB_KEY = readEnv("SANDBOX_SUPABASE_SERVICE_ROLE_KEY");

if (!SANDBOX_DB || !SB_URL || !SB_KEY) {
  console.error("Missing SANDBOX_* env vars. Abort.");
  process.exit(2);
}

const admin = createClient(SB_URL, SB_KEY);
const pgClient = new pg.Client({ connectionString: SANDBOX_DB });
await pgClient.connect();

// Synthetic ids
const ACCT_A = "11111111-2222-3333-4444-aaaaaaaaaa01";
const ACCT_B = "11111111-2222-3333-4444-aaaaaaaaaa02";
const CONV = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const MSG = "12345678-1234-1234-1234-000000000001";
const OBJECT_PATH = "enc/11111111-2222-3333-4444-aaaaaaaaaa01/9999999999-migsy01.bin";

async function clean() {
  // Overlay must be removed BEFORE the peer_message due to FK CASCADE.
  await pgClient.query(`DELETE FROM nex_peer_chat_envelope_overlay WHERE message_id IN ($1, $2)`, [MSG, "12345678-1234-1234-1234-000000000002"]).catch(() => {});
  await pgClient.query(`DELETE FROM nex_peer_message WHERE id IN ($1, $2)`, [MSG, "12345678-1234-1234-1234-000000000002"]).catch(() => {});
  await pgClient.query(`DELETE FROM nex_peer_conversation WHERE id = $1`, [CONV]).catch(() => {});
  await pgClient.query(`DELETE FROM nex_account WHERE id IN ($1, $2)`, [ACCT_A, ACCT_B]).catch(() => {});
  await admin.storage.from("nex-peer-chat-attachments").remove([OBJECT_PATH]).catch(() => {});
  await admin.storage.from("nex-peer-chat-ciphertext").remove([OBJECT_PATH]).catch(() => {});
}

await clean();

// Setup accounts + conversation
await pgClient.query(
  "INSERT INTO nex_account (id, display_name) VALUES ($1, 'Synthetic A') ON CONFLICT (id) DO NOTHING",
  [ACCT_A],
);
await pgClient.query(
  "INSERT INTO nex_account (id, display_name) VALUES ($1, 'Synthetic B') ON CONFLICT (id) DO NOTHING",
  [ACCT_B],
);
await pgClient.query(
  "INSERT INTO nex_peer_conversation (id, participant_a_id, participant_b_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
  [CONV, ACCT_A, ACCT_B],
);

// Seed public bucket
const synthetic = Buffer.from(
  "mock-ciphertext-bytes-for-sandbox-migration-test-only",
);
const up = await admin.storage
  .from("nex-peer-chat-attachments")
  .upload(OBJECT_PATH, synthetic, { contentType: "application/octet-stream", upsert: true });
if (up.error) {
  console.error("seed public upload failed:", up.error.message);
  await pgClient.end();
  process.exit(1);
}

const pubUrl = admin.storage.from("nex-peer-chat-attachments").getPublicUrl(OBJECT_PATH).data.publicUrl;
const envelope = {
  version: 1,
  storage_url: pubUrl,
  content_nonce_b64: "bm9uY2U=",
  sender_public_key: "k",
  sender_device_id: "d",
  wrapped_keys: [],
  content_type: "image/png",
  size_bytes: synthetic.length,
};
await pgClient.query(
  "INSERT INTO nex_peer_message (id, conversation_id, sender_account_id, body, attachment_url, attachment_type, attachment_meta, sent_at) VALUES ($1, $2, $3, '', $4, 'image', $5::jsonb, now())",
  [MSG, CONV, ACCT_A, pubUrl, JSON.stringify({ envelope })],
);

const results = [];

// A · dry-run
const a = await migrateOneRecord({ admin, client: pgClient, messageId: MSG, envelope, dryRun: true });
const afterDry = await pgClient.query(
  "SELECT attachment_meta->'envelope'->>'storage_path' AS p FROM nex_peer_message WHERE id = $1",
  [MSG],
);
results.push({ test: "A · dry-run · returns ok + path", pass: a.ok === true && a.dry_run === true && a.path === OBJECT_PATH });
results.push({ test: "A · dry-run · envelope unchanged (storage_path null)", pass: afterDry.rows[0].p === null });

// B · real migration
const b = await migrateOneRecord({ admin, client: pgClient, messageId: MSG, envelope, dryRun: false });
const afterMig = await pgClient.query(
  "SELECT attachment_meta->'envelope'->>'storage_path' AS p, attachment_meta->'envelope'->>'storage_url' AS u FROM nex_peer_message WHERE id = $1",
  [MSG],
);
const overlayRow = await pgClient.query(
  "SELECT storage_path, verified_sha256 FROM nex_peer_chat_envelope_overlay WHERE message_id = $1",
  [MSG],
);
results.push({ test: "B · real · result ok with path + src_hash + bytes", pass: b.ok === true && b.path === OBJECT_PATH && typeof b.src_hash === "string" && b.bytes === synthetic.length });
results.push({ test: "B · envelope preserved sealed-immutable (storage_path still null in message)", pass: afterMig.rows[0].p === null });
results.push({ test: "B · envelope preserves storage_url (legacy compat)", pass: afterMig.rows[0].u === pubUrl });
results.push({ test: "B · overlay row recorded with path + verified sha256", pass: overlayRow.rows.length === 1 && overlayRow.rows[0].storage_path === OBJECT_PATH && typeof overlayRow.rows[0].verified_sha256 === "string" && overlayRow.rows[0].verified_sha256.length === 64 });

// C · idempotent re-run (no envelope.storage_path on input · simulates re-processing)
const c = await migrateOneRecord({
  admin,
  client: pgClient,
  messageId: MSG,
  envelope: { ...envelope, storage_path: undefined },
  dryRun: false,
});
results.push({ test: "C · idempotent re-run · still ok (upload 'already exists' non-fatal)", pass: c.ok === true });

// D · private bucket has the object
const dl = await admin.storage.from("nex-peer-chat-ciphertext").download(OBJECT_PATH);
const dstBytes = dl.data ? Buffer.from(await dl.data.arrayBuffer()) : null;
results.push({ test: "D · private bucket · object present", pass: !!dstBytes });
results.push({ test: "D · private bucket · bytes bit-identical to source", pass: dstBytes && Buffer.compare(dstBytes, synthetic) === 0 });

// E · tamper detection · sabotage the private bucket then migrate a fresh record
// (We verify the hash_mismatch stage returns · tests the integrity check path.)
const MSG2 = "12345678-1234-1234-1234-000000000002";
const OBJ2 = "enc/11111111-2222-3333-4444-aaaaaaaaaa01/9999999999-migsy02.bin";
await pgClient.query(`DELETE FROM nex_peer_message WHERE id = $1`, [MSG2]).catch(() => {});
await admin.storage.from("nex-peer-chat-attachments").remove([OBJ2]).catch(() => {});
await admin.storage.from("nex-peer-chat-ciphertext").remove([OBJ2]).catch(() => {});
const original = Buffer.from("original-source-bytes-xyz");
await admin.storage.from("nex-peer-chat-attachments").upload(OBJ2, original, { contentType: "application/octet-stream", upsert: true });
// Pre-plant DIFFERENT bytes in the private bucket to force a hash mismatch.
await admin.storage.from("nex-peer-chat-ciphertext").upload(OBJ2, Buffer.from("TAMPERED-BYTES-DIFFERENT-ZZZ"), { contentType: "application/octet-stream", upsert: true });
const pubUrl2 = admin.storage.from("nex-peer-chat-attachments").getPublicUrl(OBJ2).data.publicUrl;
const env2 = { ...envelope, storage_url: pubUrl2 };
await pgClient.query("INSERT INTO nex_peer_message (id, conversation_id, sender_account_id, body, attachment_url, attachment_type, attachment_meta, sent_at) VALUES ($1, $2, $3, '', $4, 'image', $5::jsonb, now())", [MSG2, CONV, ACCT_A, pubUrl2, JSON.stringify({ envelope: env2 })]);
const e = await migrateOneRecord({ admin, client: pgClient, messageId: MSG2, envelope: env2, dryRun: false });
const afterTamper = await pgClient.query("SELECT attachment_meta->'envelope'->>'storage_path' AS p FROM nex_peer_message WHERE id = $1", [MSG2]);
results.push({ test: "E · hash mismatch stops migration (envelope NOT updated)", pass: e.ok === false && e.stage === "hash_mismatch" && afterTamper.rows[0].p === null });

// F · unparseable URL case
const f = await migrateOneRecord({ admin, client: pgClient, messageId: MSG2, envelope: { ...env2, storage_url: "not-a-url" }, dryRun: false });
results.push({ test: "F · unparseable URL · returns stage=unparseable_url · no mutation", pass: f.ok === false && f.stage === "unparseable_url" });

// G · null envelope
const g = await migrateOneRecord({ admin, client: pgClient, messageId: MSG2, envelope: null, dryRun: false });
results.push({ test: "G · null envelope · returns stage=no_envelope_or_url", pass: g.ok === false && g.stage === "no_envelope_or_url" });

// Cleanup
await pgClient.query(`DELETE FROM nex_peer_message WHERE id IN ($1, $2)`, [MSG, MSG2]);
await clean();
await admin.storage.from("nex-peer-chat-attachments").remove([OBJ2]);
await admin.storage.from("nex-peer-chat-ciphertext").remove([OBJ2]);
await pgClient.end();

// Report
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"} · ${r.test}`);
const allPass = results.every((r) => r.pass);
console.log(`--- ${allPass ? "ALL PASS" : "FAILURES PRESENT"} (${results.filter((r) => r.pass).length}/${results.length}) ---`);
if (!allPass) process.exit(1);
