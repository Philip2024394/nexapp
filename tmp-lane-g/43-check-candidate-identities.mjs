// tmp-lane-g/43-check-candidate-identities.mjs
// Read-only existence probe for the three owner-approved candidate identities.
// Does NOT modify or sign in. If any exists, we STOP and report.

import { readFileSync } from "node:fs";
import pg from "pg";

function env(key) {
  const raw = readFileSync(".env.local", "utf8");
  const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const url = env("SANDBOX_DATABASE_URL") ?? env("DATABASE_URL");
const parsed = new URL(url);
let ref = null;
if (parsed.hostname.endsWith(".pooler.supabase.com")) ref = parsed.username.match(/^postgres\.([a-z0-9]+)$/)?.[1] ?? null;
else if (parsed.hostname.endsWith(".supabase.co")) ref = parsed.hostname.match(/^(?:db\.)?([a-z0-9]+)\.supabase\.co$/)?.[1] ?? null;
if (ref !== "kdstoyyeygcopkogqsyv") { console.error(`STOP · ref '${ref}'`); process.exit(3); }
if (ref === "ijvqdvsvwtwxzcqmoqit") { console.error("STOP · production"); process.exit(3); }
console.log(`Target · sandbox ${ref}`);

const candidates = [
  { tag: "A", email: "<op-email>" },
  { tag: "B", email: "<op-email+1>" },
  { tag: "C", email: "<op-email+2>" },
];

const c = new pg.Client({ connectionString: url });
await c.connect();
try {
  // Case-insensitive match (Supabase lower-cases email) and also check for raw.
  // We use lower() on both sides to catch any mixed-case storage.
  let anyExists = false;
  for (const { tag, email } of candidates) {
    const r = await c.query(
      `SELECT id, email, created_at, confirmed_at, last_sign_in_at
         FROM auth.users
        WHERE lower(email) = lower($1)
        LIMIT 5`,
      [email]
    );
    if (r.rows.length === 0) {
      console.log(`  ${tag} · ${email} · NOT_PRESENT`);
    } else {
      anyExists = true;
      for (const u of r.rows) {
        console.log(`  ${tag} · PRESENT id=${u.id} email=${u.email} created=${u.created_at} confirmed=${u.confirmed_at ?? "null"}`);
      }
    }
  }

  // Also scan for any pre-existing nex_account rows linked to those emails, in case
  // a stale profile row survived without an auth.users entry.
  const emails = candidates.map(x => x.email.toLowerCase());
  const linked = await c.query(
    `SELECT na.id, na.supabase_user_id, u.email
       FROM nex_account na
       LEFT JOIN auth.users u ON u.id = na.supabase_user_id
      WHERE lower(u.email) = ANY($1::text[])`,
    [emails]
  );
  console.log(`nex_account linked to candidates: ${linked.rows.length}`);
  for (const r of linked.rows) console.log(`  nex_account.id=${r.id} sb=${r.supabase_user_id} email=${r.email}`);

  console.log(`\nANY_EXISTS=${anyExists}`);
  process.exit(anyExists ? 2 : 0);
} finally {
  try { await c.end(); } catch {}
}
