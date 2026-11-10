// scripts/create-sandbox-bucket-ciphertext.mjs
//
// Create the private nex-peer-chat-ciphertext storage bucket in SANDBOX.
// Hard-refuses production ref. Idempotent · if the bucket already
// exists with the correct config, reports success and exits.
//
// Called before `node scripts/apply-migration-295-sandbox.mjs`.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function env(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} not found`);
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const projectUrl = env("SANDBOX_SUPABASE_URL");
const serviceKey = env("SANDBOX_SUPABASE_SERVICE_ROLE_KEY");

const refMatch = projectUrl.match(/https:\/\/([a-z0-9]{15,})\.supabase\.co/);
const ref = refMatch?.[1];
if (ref === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production ref"); process.exit(2); }
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · unknown ref ${ref}`); process.exit(2); }
console.log(`Target · sandbox ${ref}`);

const BUCKET_ID = "nex-peer-chat-ciphertext";
const FILE_SIZE_LIMIT = 27262976; // 25 MiB + 1 KiB Poly1305 overhead + 1 MiB padding room
const MIME_WHITELIST = ["application/octet-stream"];

async function getBucket() {
  const r = await fetch(`${projectUrl}/storage/v1/bucket/${BUCKET_ID}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (r.status === 404) return null;
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`GET bucket failed · ${r.status} · ${body}`);
  }
  return r.json();
}

async function createBucket() {
  const r = await fetch(`${projectUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: BUCKET_ID,
      name: BUCKET_ID,
      public: false,
      file_size_limit: FILE_SIZE_LIMIT,
      allowed_mime_types: MIME_WHITELIST,
    }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`POST bucket failed · ${r.status} · ${body}`);
  }
  return r.json();
}

const existing = await getBucket();
if (existing) {
  console.log(`Bucket already exists · id=${existing.id} · public=${existing.public} · size_limit=${existing.file_size_limit}`);
  if (existing.public !== false) {
    console.error("✗ Bucket is PUBLIC · must be private for ciphertext");
    process.exit(4);
  }
  if (existing.file_size_limit !== FILE_SIZE_LIMIT) {
    console.warn(`! file_size_limit=${existing.file_size_limit} · expected ${FILE_SIZE_LIMIT} · leave manual-fix for owner review`);
  }
  console.log("✓ Idempotent · nothing to do");
} else {
  const created = await createBucket();
  console.log(`Bucket created · id=${created.name ?? BUCKET_ID}`);

  const verify = await getBucket();
  if (!verify) {
    console.error("✗ Post-create readback returned no bucket");
    process.exit(5);
  }
  if (verify.public !== false) {
    console.error("✗ Created bucket is PUBLIC · aborting · investigate Supabase API behaviour");
    process.exit(6);
  }
  console.log(`✓ Bucket verified · public=${verify.public} · size_limit=${verify.file_size_limit}`);
  console.log(`✓ mime whitelist · ${(verify.allowed_mime_types || []).join(", ")}`);
}

console.log("\nSandbox ciphertext bucket ready.");
