// Links the already-provisioned Supabase users to nex_account rows.
import { readFileSync, writeFileSync } from "node:fs";
import { Client } from "pg";
const envRaw = readFileSync("C:/Users/Victus/nexapp/.env.local", "utf8");
function envValue(name) {
  const m = envRaw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v || null;
}
const dbUrl = envValue("SANDBOX_DATABASE_URL");
if (!dbUrl?.includes("kdstoyyeygcopkogqsyv") || dbUrl.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("STOP ref");

// User IDs from step 01
const PROVISIONED = [
  { email: "g-fixture-A@nex-sandbox.invalid", supabase_user_id: "12e42d55-52ba-4b2e-8746-9636c6aa7050" },
  { email: "g-fixture-B@nex-sandbox.invalid", supabase_user_id: "a1d2a88f-80f3-478e-9ab7-12faa48172a3" },
];

const c = new Client({ connectionString: dbUrl });
await c.connect();
const out = [];
for (const u of PROVISIONED) {
  // Check if an account already exists for this supabase_user_id
  const existing = await c.query(`SELECT id FROM nex_account WHERE supabase_user_id=$1`, [u.supabase_user_id]);
  let aid;
  if (existing.rows.length) {
    aid = existing.rows[0].id;
    console.log("already linked:", u.email, "→", aid);
  } else {
    const r = await c.query(
      `INSERT INTO nex_account (supabase_user_id, display_name) VALUES ($1, $2) RETURNING id`,
      [u.supabase_user_id, u.email.split("@")[0]],
    );
    aid = r.rows[0].id;
    console.log("linked:", u.email, "→", aid);
  }
  out.push({ email: u.email, supabase_user_id: u.supabase_user_id, nex_account_id: aid });
}
await c.end();
writeFileSync("C:/Users/Victus/nexapp/tmp-lane-g/fixtures.json", JSON.stringify(out, null, 2));
console.log("\n=== FIXTURE REGISTRY (ADMIN-PROVISIONED · NOT email-delivery proof) ===");
console.table(out);
