// DISPOSABLE · Lane G round 18 fixture provisioner · sandbox kdstoyyeygcopkogqsyv only.
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
if (!url?.includes("kdstoyyeygcopkogqsyv") || url.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("STOP ref");
if (!dbUrl?.includes("kdstoyyeygcopkogqsyv")) throw new Error("STOP pg ref");

const supa = createClient(url, srv, { auth: { autoRefreshToken: false, persistSession: false } });
const FIXTURES = [
  { email: "g-fixture-A@nex-sandbox.invalid", pwd: "LaneG-A-" + Math.random().toString(36).slice(2) + Date.now() },
  { email: "g-fixture-B@nex-sandbox.invalid", pwd: "LaneG-B-" + Math.random().toString(36).slice(2) + Date.now() },
];
const created = [];
for (const f of FIXTURES) {
  const { data, error } = await supa.auth.admin.createUser({
    email: f.email, password: f.pwd, email_confirm: true,
    user_metadata: { fixture_label: "LANE_G_SANDBOX_DISPOSABLE_2026_11_19" },
  });
  if (error) { console.error("createUser error:", f.email, error); process.exit(3); }
  created.push({ email: f.email, supabase_user_id: data.user.id, password: f.pwd });
  console.log("ADMIN-PROVISIONED (not email-delivery proof):", f.email, "sb_user_id:", data.user.id);
}

const pg = new Client({ connectionString: dbUrl });
await pg.connect();
for (const u of created) {
  const r = await pg.query(
    `INSERT INTO nex_account (supabase_user_id, account_number, display_name, lens_country)
     VALUES ($1, 'g-fix-' || substr(md5($2)::text, 1, 8), $3, 'IE')
     RETURNING id`,
    [u.supabase_user_id, u.supabase_user_id, u.email.split("@")[0]],
  );
  u.nex_account_id = r.rows[0].id;
  console.log("  nex_account.id:", u.nex_account_id);
}
await pg.end();
writeFileSync("C:/Users/Victus/nexapp/tmp-lane-g/fixtures.json", JSON.stringify(created, null, 2));
console.log("\n=== FIXTURE REGISTRY ===");
console.log(JSON.stringify(created.map(x => ({ email: x.email, supabase_user_id: x.supabase_user_id, nex_account_id: x.nex_account_id })), null, 2));
