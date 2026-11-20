// Check whether nex-99901 / nex-99903 are backed by real auth.users entries
// or mock accounts (is_mock_persona=true). Guides genuine-auth test strategy.
import { spawnSync } from "node:child_process";
import { Client } from "pg";
const u = spawnSync("node", ["scripts/_tmp/pooler-url.mjs"], { encoding: "utf8" });
const url = u.stdout.trim();
const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(`
  SELECT a.nex_handle, a.id, a.supabase_user_id, a.is_mock_persona,
         u.id IS NOT NULL AS has_auth_user, u.email,
         u.email_confirmed_at, u.last_sign_in_at
    FROM nex_account a
    LEFT JOIN auth.users u ON u.id = a.supabase_user_id
   WHERE a.nex_handle IN ('nex-99901','nex-99903')
   ORDER BY a.nex_handle`);
console.table(r.rows.map(row => ({
  handle: row.nex_handle,
  acct: row.id.slice(0, 8),
  sup: row.supabase_user_id?.slice(0, 8),
  mock: row.is_mock_persona,
  has_auth: row.has_auth_user,
  email: row.email ? row.email.replace(/^(.)(.*)(@.*)$/, "$1***$3") : null,
  confirmed: !!row.email_confirmed_at,
  last_signin: row.last_sign_in_at,
})));
await c.end();
