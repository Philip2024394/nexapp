// scripts/create-sandbox-bucket-merchant-qr.mjs
// Create the private nex-merchant-qr storage bucket in SANDBOX. Idempotent.

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

const BUCKET_ID = "nex-merchant-qr";
const FILE_SIZE_LIMIT = 2 * 1024 * 1024; // 2 MB (QR PNG)
const MIME_WHITELIST = ["image/png", "image/jpeg", "image/webp"];

async function getBucket() {
  const r = await fetch(`${projectUrl}/storage/v1/bucket/${BUCKET_ID}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (r.status === 404) return null;
  if (r.status === 400) {
    const body = await r.text();
    if (/not.?found|NoSuchBucket|404/i.test(body)) return null;
    throw new Error(`GET bucket failed · 400 · ${body}`);
  }
  if (!r.ok) throw new Error(`GET bucket failed · ${r.status} · ${await r.text()}`);
  return r.json();
}
async function createBucket() {
  const r = await fetch(`${projectUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: BUCKET_ID, name: BUCKET_ID, public: false,
      file_size_limit: FILE_SIZE_LIMIT, allowed_mime_types: MIME_WHITELIST,
    }),
  });
  if (!r.ok) throw new Error(`POST bucket failed · ${r.status} · ${await r.text()}`);
  return r.json();
}

const existing = await getBucket();
if (existing) {
  console.log(`Bucket exists · public=${existing.public} · size_limit=${existing.file_size_limit}`);
  if (existing.public !== false) { console.error("✗ Bucket is PUBLIC · must be private"); process.exit(4); }
  console.log("✓ Idempotent");
} else {
  const created = await createBucket();
  const verify = await getBucket();
  if (!verify || verify.public !== false) { console.error("✗ Created bucket not private"); process.exit(5); }
  console.log(`✓ Bucket created · public=${verify.public} · size_limit=${verify.file_size_limit}`);
}
console.log("\nSandbox merchant-qr bucket ready.");
