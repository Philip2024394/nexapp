// Admin-provision 2 FRESH disposable fixtures for mig-356 test battery.
// ADMIN-PROVISIONED label · not proof of email-registration/delivery.
// Hard refuses production ref.
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

const envRaw = readFileSync("C:/Users/Victus/nexapp/.env.local", "utf8");
function envValue(name) {
  const m = envRaw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v || null;
}
const url = envValue("SANDBOX_SUPABASE_URL");
const srv = envValue("SANDBOX_SUPABASE_SERVICE_ROLE_KEY");
const dbUrl = envValue("SANDBOX_DATABASE_URL");
if (!url || !url.includes("kdstoyyeygcopkogqsyv") || url.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("STOP ref");
if (!dbUrl || !dbUrl.includes("kdstoyyeygcopkogqsyv") || dbUrl.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("STOP db ref");

const admin = createClient(url, srv, { auth: { autoRefreshToken: false, persistSession: false } });

const stamp = Date.now();
const emails = [
  `g2-fixture-A-${stamp}@nex-sandbox.invalid`,
  `g2-fixture-B-${stamp}@nex-sandbox.invalid`,
];

const users = [];
for (const email of emails) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `LaneG356-${stamp}-${email.length}`,
    email_confirm: true,
    user_metadata: { fixture_label: "LANE_G_SANDBOX_DISPOSABLE_2026_11_19_MIG356" },
  });
  if (error) throw error;
  users.push({ email, supabase_user_id: data.user.id, password: `LaneG356-${stamp}-${email.length}` });
  console.log("provisioned:", email, "→ auth.id =", data.user.id);
}

const pg = new Client({ connectionString: dbUrl });
await pg.connect();
const out = [];
for (const u of users) {
  const existing = await pg.query(`SELECT id FROM nex_account WHERE supabase_user_id=$1`, [u.supabase_user_id]);
  let aid;
  if (existing.rows.length) {
    aid = existing.rows[0].id;
    console.log("already linked:", u.email, "→", aid);
  } else {
    const r = await pg.query(
      `INSERT INTO nex_account (supabase_user_id, display_name) VALUES ($1, $2) RETURNING id`,
      [u.supabase_user_id, u.email.split("@")[0].slice(0, 32)],
    );
    aid = r.rows[0].id;
    console.log("linked:", u.email, "→", aid);
  }
  out.push({ ...u, nex_account_id: aid });
}
await pg.end();
writeFileSync("C:/Users/Victus/nexapp/tmp-lane-g/fixtures-356.json", JSON.stringify(out, null, 2));
console.log("\n=== FIXTURE REGISTRY (ADMIN-PROVISIONED · NOT email-delivery proof · MIG-356) ===");
console.table(out.map(({ password, ...rest }) => rest));
