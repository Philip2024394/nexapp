// scripts/attachment-migration/migrate-ciphertext.mjs
//
// NEX Chat Attachments · Phase A·history · historical ciphertext
// migration tool from the public bucket to the private bucket.
// Owner-authorised 2026-11-08 build-only · NOT for production
// execution without separate authorisation.
// -----------------------------------------------------------------------------
// Doctrine
//   · Reads nex_peer_message rows whose attachment_meta.envelope has
//     a storage_url pointing at the legacy public bucket and NO
//     storage_path.
//   · Copies the ciphertext bytes UNCHANGED from public → private.
//     The script NEVER decrypts. The script NEVER accesses device-
//     held encryption keys. It is a pure bytes mover.
//   · Verifies the destination object by downloading it back + SHA-256
//     comparing against the source. Only when the hash matches does
//     the envelope get updated.
//   · Preserves legacy access during transition · the envelope keeps
//     the storage_url field AND gets a new storage_path field. The
//     client code already prefers storage_path when present (signed
//     URL flow) and falls back to storage_url otherwise.
//   · Idempotent · each (message_id, source_path) pair is recorded
//     in a per-run JSONL ledger. Re-runs skip records already marked
//     done. Resumable after Ctrl-C.
//   · Dry-run mode reports what would be migrated without writing.
//   · Never deletes historical public objects. A separate opt-in
//     clean-up pass (not shipped here) handles that after owner
//     confirms every migrated record has been reconciled.
//
// Usage
//   node scripts/attachment-migration/migrate-ciphertext.mjs \
//     [--dry-run] [--limit N] [--project <ref>] [--ledger <path>]
//
// Env variables (read from .env.local by default)
//   SANDBOX_DATABASE_URL        · target Postgres connection
//   SANDBOX_SUPABASE_URL        · target Supabase project URL
//   SANDBOX_SUPABASE_SERVICE_ROLE_KEY · service-role key for Storage
//   MIGRATION_ALLOW_PRODUCTION  · must be "yes" to target production.
//                                  Defence-in-depth · default is NO.

import { readFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const PRODUCTION_SIGIL = "ijvqdvsvwtwxzcqmoqit";
const PUBLIC_BUCKET = "nex-peer-chat-attachments";
const PRIVATE_BUCKET = "nex-peer-chat-ciphertext";
const DEFAULT_LEDGER = "scripts/attachment-migration/ledger.jsonl";

function readDotEnv(key) {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && m[1] === key) return m[2].trim();
    }
  } catch {
    /* ignore · optional */
  }
  return null;
}

function arg(name, dflt = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return dflt;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith("--")) return true; // flag-style
  return next;
}

export function parseStoragePath(storageUrl, bucket) {
  // Shape · https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
  if (typeof storageUrl !== "string" || !storageUrl.startsWith("http")) return null;
  const marker = `/object/public/${bucket}/`;
  const idx = storageUrl.indexOf(marker);
  if (idx < 0) return null;
  const tail = storageUrl.slice(idx + marker.length).split(/[?#]/)[0];
  return tail || null;
}

export function readLedger(ledgerPath) {
  if (!existsSync(ledgerPath)) return new Map();
  const map = new Map();
  const raw = readFileSync(ledgerPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row && row.message_id && row.status === "ok") {
        map.set(row.message_id, row);
      }
    } catch {
      /* skip corrupt line · ledger is append-only and may have been truncated */
    }
  }
  return map;
}

function appendLedger(ledgerPath, row) {
  const dir = path.dirname(ledgerPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(ledgerPath, JSON.stringify(row) + "\n");
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Migrate a single record · exported so integration tests can
 *  exercise the critical path without spawning the CLI.
 *
 *  Returns one of:
 *    { ok: true, src_hash, path }
 *    { ok: false, stage: "...", error: "..." }
 *
 *  Dry-run short-circuits BEFORE any writes. */
export async function migrateOneRecord({
  admin,
  client,
  messageId,
  envelope,
  dryRun = false,
  publicBucket = PUBLIC_BUCKET,
  privateBucket = PRIVATE_BUCKET,
}) {
  if (!envelope || typeof envelope.storage_url !== "string") {
    return { ok: false, stage: "no_envelope_or_url" };
  }
  const sourcePath = parseStoragePath(envelope.storage_url, publicBucket);
  if (!sourcePath) {
    return { ok: false, stage: "unparseable_url" };
  }
  if (dryRun) {
    return { ok: true, path: sourcePath, dry_run: true };
  }
  // Step 1 · download
  const dl = await admin.storage.from(publicBucket).download(sourcePath);
  if (dl.error || !dl.data) {
    return { ok: false, stage: "download_public", error: dl.error?.message ?? "no data" };
  }
  const srcBytes = new Uint8Array(await dl.data.arrayBuffer());
  const srcHash = sha256(srcBytes);
  // Step 2 · upload (idempotent · "already exists" is non-fatal)
  const up = await admin.storage
    .from(privateBucket)
    .upload(sourcePath, srcBytes, {
      contentType: "application/octet-stream",
      upsert: false,
    });
  if (up.error && !/already exists/i.test(up.error.message)) {
    return { ok: false, stage: "upload_private", error: up.error.message };
  }
  // Step 3 · verify hash
  const vd = await admin.storage.from(privateBucket).download(sourcePath);
  if (vd.error || !vd.data) {
    return { ok: false, stage: "verify_download", error: vd.error?.message ?? "no data" };
  }
  const dstBytes = new Uint8Array(await vd.data.arrayBuffer());
  const dstHash = sha256(dstBytes);
  if (dstHash !== srcHash) {
    return { ok: false, stage: "hash_mismatch", src_hash: srcHash, dst_hash: dstHash };
  }
  // Step 4 · record the migration in the append-only overlay (migration 298).
  //     The sealed migration-054 trigger makes attachment_meta immutable,
  //     so we CANNOT update envelope.storage_path on the message row.
  //     The overlay table carries the mapping and the signed-URL endpoint
  //     consults it alongside the envelope's own storage_path.
  const upd = await client.query(
    `INSERT INTO nex_peer_chat_envelope_overlay
       (message_id, storage_path, verified_sha256)
     VALUES ($1, $2, $3)
     ON CONFLICT (message_id) DO NOTHING`,
    [messageId, sourcePath, srcHash],
  );
  // rowCount can be 0 if a row already existed (re-run after a prior
  // success · idempotent · still OK).
  if (upd.rowCount !== 0 && upd.rowCount !== 1) {
    return { ok: false, stage: "overlay_insert", row_count: upd.rowCount };
  }
  return { ok: true, path: sourcePath, src_hash: srcHash, bytes: srcBytes.length };
}

async function main() {
  const dryRun = Boolean(arg("--dry-run", false));
  const limit = Number(arg("--limit", 100));
  const projectRef = arg("--project", "sandbox");
  const ledgerPath = String(arg("--ledger", DEFAULT_LEDGER));

  const dbUrl =
    projectRef === "production"
      ? readDotEnv("DATABASE_URL")
      : readDotEnv("SANDBOX_DATABASE_URL");
  const sbUrl =
    projectRef === "production"
      ? readDotEnv("NEX_SUPABASE_URL") ?? readDotEnv("NEXT_PUBLIC_NEX_SUPABASE_URL")
      : readDotEnv("SANDBOX_SUPABASE_URL");
  const sbKey =
    projectRef === "production"
      ? readDotEnv("NEX_SUPABASE_SERVICE_ROLE_KEY")
      : readDotEnv("SANDBOX_SUPABASE_SERVICE_ROLE_KEY");

  if (!dbUrl || !sbUrl || !sbKey) {
    console.error("ERR · missing env vars for project", projectRef);
    process.exit(2);
  }

  // Defence-in-depth · refuse production unless explicit env var set.
  if (
    (dbUrl.includes(PRODUCTION_SIGIL) || sbUrl.includes(PRODUCTION_SIGIL)) &&
    process.env.MIGRATION_ALLOW_PRODUCTION !== "yes"
  ) {
    console.error(
      "ERR · target appears to be production. Set MIGRATION_ALLOW_PRODUCTION=yes to run.",
    );
    process.exit(3);
  }

  console.log(
    `[migrate-ciphertext] start · project=${projectRef} · dry_run=${dryRun} · limit=${limit} · ledger=${ledgerPath}`,
  );

  const ledger = readLedger(ledgerPath);
  console.log(`[migrate-ciphertext] ledger · ${ledger.size} prior successes · will skip`);

  const admin = createClient(sbUrl, sbKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();

  // Find candidate rows · attachment_meta.envelope.storage_url present
  // AND the row is NOT yet recorded in the migration-298 overlay. The
  // sealed migration-054 trigger makes the envelope itself immutable ·
  // migrated records are tracked in the append-only overlay table.
  const q = await client.query(
    `SELECT m.id, m.attachment_meta
       FROM nex_peer_message m
       LEFT JOIN nex_peer_chat_envelope_overlay o ON o.message_id = m.id
      WHERE m.attachment_meta->'envelope'->>'storage_url' IS NOT NULL
        AND o.message_id IS NULL
      ORDER BY m.sent_at ASC
      LIMIT $1`,
    [limit],
  );
  console.log(`[migrate-ciphertext] candidates · ${q.rows.length}`);

  const summary = { total: q.rows.length, done: 0, skipped: 0, failed: 0, dry: 0 };

  for (const row of q.rows) {
    const messageId = row.id;
    const envelope =
      typeof row.attachment_meta === "object" && row.attachment_meta
        ? row.attachment_meta.envelope
        : null;
    if (!envelope || typeof envelope.storage_url !== "string") {
      appendLedger(ledgerPath, {
        at: new Date().toISOString(),
        message_id: messageId,
        status: "skip",
        reason: "no_envelope_or_url",
      });
      summary.skipped++;
      continue;
    }

    if (ledger.has(messageId)) {
      summary.skipped++;
      continue;
    }

    const sourcePath = parseStoragePath(envelope.storage_url, PUBLIC_BUCKET);
    if (!sourcePath) {
      appendLedger(ledgerPath, {
        at: new Date().toISOString(),
        message_id: messageId,
        status: "skip",
        reason: "unparseable_url",
      });
      summary.skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] would migrate · ${messageId} · ${sourcePath}`);
      summary.dry++;
      continue;
    }

    const r = await migrateOneRecord({
      admin,
      client,
      messageId,
      envelope,
      dryRun: false,
    });
    if (!r.ok) {
      appendLedger(ledgerPath, {
        at: new Date().toISOString(),
        message_id: messageId,
        status: "fail",
        stage: r.stage,
        error: r.error,
        ...(r.src_hash ? { src_hash: r.src_hash, dst_hash: r.dst_hash } : {}),
        ...(r.row_count !== undefined ? { row_count: r.row_count } : {}),
      });
      summary.failed++;
      continue;
    }
    appendLedger(ledgerPath, {
      at: new Date().toISOString(),
      message_id: messageId,
      status: "ok",
      path: r.path,
      bytes: r.bytes,
      src_hash: r.src_hash,
    });
    summary.done++;
    console.log(`[migrate-ciphertext] ok · ${messageId} · ${r.bytes}B`);
  }

  await client.end();
  console.log("[migrate-ciphertext] summary ·", JSON.stringify(summary));
  // Non-zero exit if anything failed · callers treat this as "needs review"
  if (summary.failed > 0) process.exit(1);
}

// Only run when invoked directly (not when imported in tests).
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`) {
  main().catch((e) => {
    console.error("[migrate-ciphertext] fatal ·", e);
    process.exit(10);
  });
}
