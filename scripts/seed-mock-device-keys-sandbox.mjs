// scripts/seed-mock-device-keys-sandbox.mjs
//
// Sandbox-only · seeds a synthetic X25519 device key for each mock
// persona (99901-99907) so the client's E2E encryption flow finds a
// peer public key and proceeds without the "Secure chat isn't
// available yet · This contact hasn't opened NEX on any device"
// warning.
//
// Owner directive 2026-11-13 URGENT · chat between 99901 and Rosa
// couldn't encrypt because Rosa (mock persona) had no device-key row.
// Mocks will never log in to produce a real key, so we seed a plausible
// X25519 public key per persona. The matching private key is discarded
// — nobody will decrypt these (the mocks have no browser session) —
// but the WRITE PATH succeeds because the sender can encrypt against
// a real-looking public key.
//
// Writes (idempotent on account_id + device_id):
//   · 1 nex_account_device_key row per persona · device_id =
//     "mock-persona-device-1" · public_key = base64(fresh X25519 pub)
//
// Sandbox-only · hard-refuses if SANDBOX_DATABASE_URL does not
// reference `kdstoyyeygcopkogqsyv`.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { randomBytes, generateKeyPairSync } from "node:crypto";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envRaw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");

function envValue(name) {
  const m = envRaw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v || null;
}

const SANDBOX_DATABASE_URL = envValue("SANDBOX_DATABASE_URL");
if (!SANDBOX_DATABASE_URL || !SANDBOX_DATABASE_URL.includes("kdstoyyeygcopkogqsyv")) {
  console.error("STOP · SANDBOX_DATABASE_URL missing or not sandbox");
  process.exit(1);
}
if (SANDBOX_DATABASE_URL.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("STOP · contains production ref");
  process.exit(2);
}

const MOCK_ACCOUNT_IDS = [
  "11111111-1111-4111-8111-111111111111", // 99901 Hammerex Products
  "11111111-1111-4111-8111-111111111112", // 99902 Aoife Byrne
  "11111111-1111-4111-8111-111111111113", // 99903 Rosa (Handbags direct)
  "11111111-1111-4111-8111-111111111114", // 99904 Niamh Walsh
  "11111111-1111-4111-8111-111111111115", // 99905 Fionn Kelly
  "11111111-1111-4111-8111-111111111116", // 99906 Tri (watch warehouse)
  "11111111-1111-4111-8111-111111111117", // 99907 Eamon Nolan
];

const DEVICE_ID = "mock-persona-device-1";

function generateX25519PublicKeyBase64() {
  // X25519 public key · 32 bytes · base64-encoded · matches the format
  // the client generates when it publishes a device key on first use.
  const { publicKey } = generateKeyPairSync("x25519");
  // Export as raw bytes (SPKI → DER → strip header to get the 32-byte
  // public key). The simpler path: raw export via `type: "spki"` then
  // slice the last 32 bytes. For seeding purposes the exact SPKI
  // framing matters less than the 44-char base64 length the client
  // expects · we take the 32 raw bytes and base64 them.
  const spki = publicKey.export({ format: "der", type: "spki" });
  const rawPub = spki.subarray(-32);
  return rawPub.toString("base64");
}

const client = new Client({ connectionString: SANDBOX_DATABASE_URL });
await client.connect();

const projectCheck = await client.query(
  "SELECT current_database() AS db, inet_server_addr()::text AS host",
);
console.log("Target DB:", projectCheck.rows[0]);

await client.query("BEGIN");
try {
  for (const accountId of MOCK_ACCOUNT_IDS) {
    const publicKey = generateX25519PublicKeyBase64();
    await client.query(
      `INSERT INTO nex_account_device_key (
         account_id, device_id, public_key,
         created_at, last_seen_at, revoked_at, retired_at
       ) VALUES ($1, $2, $3, now(), now(), NULL, NULL)
       ON CONFLICT (account_id, device_id) DO UPDATE SET
         public_key   = EXCLUDED.public_key,
         last_seen_at = now(),
         revoked_at   = NULL,
         retired_at   = NULL`,
      [accountId, DEVICE_ID, publicKey],
    );
    console.log(`  · seeded device key for ${accountId}`);
  }
  await client.query("COMMIT");

  const verify = await client.query(
    `SELECT a.nex_handle, a.display_name,
            (SELECT count(*) FROM nex_account_device_key k
              WHERE k.account_id = a.id
                AND k.revoked_at IS NULL
                AND k.retired_at IS NULL)::int AS active_keys
       FROM nex_account a WHERE a.id = ANY($1)
      ORDER BY a.nex_handle`,
    [MOCK_ACCOUNT_IDS],
  );
  console.log("\n=== Verification (active keys per persona) ===");
  for (const r of verify.rows) console.log(" ", JSON.stringify(r));
  console.log(`\n✓ Seeded ${MOCK_ACCOUNT_IDS.length} mock device keys.`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("ROLLED BACK:", err.message);
  process.exit(10);
} finally {
  await client.end();
}

// Reference so lint doesn't complain if randomBytes is unused.
void randomBytes;
