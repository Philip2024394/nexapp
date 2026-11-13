// Force Supabase PostgREST to reload its schema cache on sandbox so
// newly-added columns from mig 285 become visible via the REST API
// the app uses (nexSupabaseAdmin). PostgREST listens for the
// `pgrst, 'reload schema'` NOTIFY channel.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
const url = raw.match(/^SANDBOX_DATABASE_URL=(.*)$/m)[1].replace(/^['"]|['"]$/g, "").trim();
const u = new URL(url);
const SANDBOX = "kdstoyyeygcopkogqsyv";
const PROD = "ijvqdvsvwtwxzcqmoqit";
const ref =
  u.username.match(/\.([a-z0-9]{15,})/)?.[1] ??
  u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1];
if (ref === PROD) { console.error("STOP · production ref"); process.exit(2); }
if (ref !== SANDBOX) { console.error(`STOP · ref ${ref} is not SANDBOX`); process.exit(2); }
console.log(`Target: SANDBOX ${SANDBOX}`);

const c = new Client({ connectionString: url });
await c.connect();
await c.query(`NOTIFY pgrst, 'reload schema'`);
console.log("Sent NOTIFY pgrst, 'reload schema'");
await c.end();
