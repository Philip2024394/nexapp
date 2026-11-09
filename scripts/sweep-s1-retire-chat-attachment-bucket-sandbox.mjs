// scripts/sweep-s1-retire-chat-attachment-bucket-sandbox.mjs
//
// Historical secure-deletion sweep · Phase S1 · DRAFT.
// Retires the sealed-public chat-attachment bucket in sandbox.
//
// Hard-refuses production ref.
// Hard-requires BOTH:
//   · S0 inventory signed (docs/sweep/s0-inventory-*.json exists)
//   · owner "--execute" flag on the command line (no dry-run-opt-out)
//
// Otherwise runs DRY · reports what would be deleted · no mutation.
//
// Sealed I-4 compliance: this script DOES NOT run unless the owner has
// explicitly authorised S1 in a separate message. The script itself
// requires the --execute flag as a secondary safety.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXECUTE = process.argv.includes("--execute");
const TARGET_BUCKET = "nex-peer-chat-attachments";

function env(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} not found in .env.local`);
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const databaseUrl = env("SANDBOX_DATABASE_URL");
const u = new URL(databaseUrl);
const ref = u.username.match(/\.([a-z0-9]{15,})/)?.[1]
  ?? u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1];
if (ref === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production ref"); process.exit(2); }
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · unknown ref ${ref}`); process.exit(2); }
console.log(`Target · sandbox ${ref}`);
console.log(`Mode: ${EXECUTE ? "EXECUTE · will delete bucket" : "DRY RUN · report only"}`);

// S0 prerequisite check: an S0 inventory file must exist for this sandbox.
const sweepDir = resolve(repoRoot, "docs/sweep");
if (!existsSync(sweepDir)) {
  console.error(`STOP · no docs/sweep/ directory · run S0 inventory first`);
  process.exit(3);
}
const s0Files = readdirSync(sweepDir).filter((f) => f.startsWith(`s0-inventory-${ref}-`));
if (s0Files.length === 0) {
  console.error(`STOP · no S0 inventory report for ${ref} · run sweep-s0-inventory-sandbox.mjs first`);
  process.exit(3);
}
console.log(`✓ S0 prerequisite · ${s0Files.length} inventory report(s) present`);

const c = new Client({ connectionString: databaseUrl });
await c.connect();

// Pre-check: does the bucket exist?
const bucketRes = await c.query(
  `SELECT id, name, public, created_at FROM storage.buckets WHERE name = $1`,
  [TARGET_BUCKET],
);
if (bucketRes.rows.length === 0) {
  console.log(`✓ Bucket "${TARGET_BUCKET}" already absent · S1 complete (or nothing to do)`);
  await c.end();
  process.exit(0);
}
const bucket = bucketRes.rows[0];
console.log(`Found bucket: ${bucket.name} · public=${bucket.public} · created_at=${bucket.created_at}`);

// Count objects
const objRes = await c.query(
  `SELECT COUNT(*)::bigint AS n, SUM(COALESCE((metadata->>'size')::bigint, 0))::bigint AS total_bytes
     FROM storage.objects WHERE bucket_id = $1`,
  [bucket.id],
);
const objectCount = Number(objRes.rows[0].n);
const totalBytes = Number(objRes.rows[0].total_bytes ?? 0);
console.log(`Objects in bucket: ${objectCount} · total size: ${totalBytes} bytes (${Math.round(totalBytes / 1024 / 1024)} MB)`);

// Last-write-time check: no uploads in the last 7 days
const lastWrite = await c.query(
  `SELECT MAX(COALESCE(updated_at, created_at)) AS last_write FROM storage.objects WHERE bucket_id = $1`,
  [bucket.id],
);
const lw = lastWrite.rows[0].last_write;
if (lw) {
  const lwDate = new Date(lw);
  const ageMs = Date.now() - lwDate.getTime();
  const ageDays = Math.round(ageMs / 1000 / 60 / 60 / 24);
  console.log(`Last write to bucket: ${lw} (${ageDays} days ago)`);
  if (ageDays < 7 && EXECUTE) {
    console.error(`STOP · bucket had writes within last 7 days · investigate before retirement`);
    await c.end();
    process.exit(4);
  }
}

if (!EXECUTE) {
  console.log("\nDRY RUN complete. To execute, re-run with --execute AND owner-authorised 'S1' message.");
  await c.end();
  process.exit(0);
}

// EXECUTE path
console.log("\nDeleting objects...");
await c.query(`DELETE FROM storage.objects WHERE bucket_id = $1`, [bucket.id]);
console.log(`✓ Deleted ${objectCount} objects`);

console.log("Deleting bucket row...");
await c.query(`DELETE FROM storage.buckets WHERE id = $1`, [bucket.id]);
console.log(`✓ Deleted bucket "${TARGET_BUCKET}"`);

// Record in migration history for audit trail
try {
  await c.query(
    `INSERT INTO nex_migration_history (version, applied_at, description, notes)
     VALUES ('SWEEP-S1', NOW(), 'Historical sweep S1 · chat attachment bucket retired',
             $1)`,
    [`Bucket "${TARGET_BUCKET}" (${objectCount} objects · ${totalBytes} bytes) deleted. S0 inventory: ${s0Files.join(", ")}`],
  );
  console.log(`✓ Recorded in nex_migration_history`);
} catch (e) {
  console.log(`⚠ Could not record in nex_migration_history · ${e?.message ?? e}`);
}

await c.end();
console.log("\nS1 sandbox complete. Owner must now verify + authorise production S1 separately.");
