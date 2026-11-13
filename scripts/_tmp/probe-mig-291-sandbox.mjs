// probe: check which mig 291 variant is installed in sandbox
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
function env(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} not found`);
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const databaseUrl = env("SANDBOX_DATABASE_URL");
const c = new Client({ connectionString: databaseUrl });
await c.connect();
try {
  const src = await c.query(
    `SELECT pg_get_functiondef(oid) AS def, proconfig
       FROM pg_proc
      WHERE proname = 'nex_security_rate_limit_claim'
        AND pronamespace = 'public'::regnamespace`
  );
  if (src.rows.length !== 1) {
    console.log(`Function count: ${src.rows.length}`);
    process.exit(0);
  }
  const def = src.rows[0].def;
  const config = (src.rows[0].proconfig || []).join(",");
  console.log(`search_path config: ${config}`);
  const hasHardcodedEnum = def.includes("'password_change'") && def.includes("'webauthn_enroll'") && def.includes("_action not in (");
  const usesClockTimestamp = def.includes("clock_timestamp()");
  const usesDateTrunc = def.includes("date_trunc('minute'");
  console.log(`Hardcoded enum inside function body: ${hasHardcodedEnum}`);
  console.log(`Uses clock_timestamp() (rpc flavour): ${usesClockTimestamp}`);
  console.log(`Uses date_trunc('minute') flooring: ${usesDateTrunc}`);
  if (hasHardcodedEnum) console.log("→ INSTALLED VARIANT: _claim.sql (OLD · rejects hq_admin_grant)");
  else if (usesClockTimestamp || usesDateTrunc) console.log("→ INSTALLED VARIANT: _claim_rpc.sql (CANONICAL)");
  else console.log("→ INSTALLED VARIANT: unknown · inspect def manually");

  // Prune function check
  const prune = await c.query(
    "SELECT 1 FROM pg_proc WHERE proname='nex_security_rate_limit_prune' AND pronamespace='public'::regnamespace"
  );
  console.log(`\nPrune function present: ${prune.rows.length > 0}`);

  // Live test · try an hq_admin_grant call against the installed function
  const test = await c.query(
    "SELECT * FROM nex_security_rate_limit_claim('acct:00000000-aaaa-4aaa-aaaa-999999999999', 'hq_admin_grant', 15, 30)"
  );
  console.log(`\nLive test · hq_admin_grant claim: allowed=${test.rows[0]?.allowed} retry_after=${test.rows[0]?.retry_after_seconds}`);
  await c.query("DELETE FROM nex_security_rate_limit WHERE key='acct:00000000-aaaa-4aaa-aaaa-999999999999'");
  console.log(`(cleaned up test row)`);
} finally {
  await c.end();
}
