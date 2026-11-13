// scripts/_tmp/verify-first-free-sandbox.mjs
//
// Verify the first-free claim flow against the live SANDBOX schema.
// Walks:
//   · canClaim pre-check for 99901 (should be TRUE · 0 rows)
//   · insert a first_free row for 99901 with themeId 'nex-default'
//   · canClaim re-check (should be FALSE · row present)
//   · delete the test row (restore idempotence of this probe)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
function loadEnvVar(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} not found`);
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const databaseUrl = loadEnvVar("SANDBOX_DATABASE_URL");
const PROD = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX = "kdstoyyeygcopkogqsyv";
const u = new URL(databaseUrl);
const ref =
  u.username.match(/\.([a-z0-9]{15,})/)?.[1] ??
  u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1];
if (ref === PROD) { console.error("STOP · production"); process.exit(2); }
if (ref !== SANDBOX) { console.error(`STOP · ref ${ref} is not SANDBOX`); process.exit(2); }

const ACC = "11111111-1111-4111-8111-111111111111";
const TEST_THEME = "nex-default";
let pass = 0, fail = 0;
function eq(label, a, b) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  console.log(`  ${ok ? "✓" : "✗"} ${label} · got=${JSON.stringify(a)} expected=${JSON.stringify(b)}`);
  if (ok) pass++; else fail++;
}

const c = new Client({ connectionString: databaseUrl });
await c.connect();

// Clean any residue
await c.query(
  `DELETE FROM nex_theme_ownership WHERE account_id = $1 AND acquired_via = 'first_free'`,
  [ACC],
);

// Pre
console.log(`\n[pre] canClaim first-free for 99901`);
const pre = (await c.query(
  `SELECT count(*)::int AS n FROM nex_theme_ownership
    WHERE account_id = $1 AND acquired_via = 'first_free' AND revoked_at IS NULL`,
  [ACC],
)).rows[0].n;
eq("rows=0", pre, 0);

// Insert
console.log(`\n[insert] write first_free row for 99901`);
try {
  await c.query(
    `INSERT INTO nex_theme_ownership (account_id, theme_id, acquired_via, acquired_at)
     VALUES ($1, $2, 'first_free', now())`,
    [ACC, TEST_THEME],
  );
  eq("insert succeeded", true, true);
} catch (e) {
  eq("insert succeeded", `FAILED: ${e.message}`, true);
}

// Post
console.log(`\n[post] canClaim first-free re-check`);
const post = (await c.query(
  `SELECT count(*)::int AS n FROM nex_theme_ownership
    WHERE account_id = $1 AND acquired_via = 'first_free' AND revoked_at IS NULL`,
  [ACC],
)).rows[0].n;
eq("rows=1", post, 1);

// Idempotency · second insert of first_free should be blockable at app level
// (we rely on canClaimFirstFreeTheme returning false pre-insert).

// Cleanup
console.log(`\n[cleanup] delete test row`);
await c.query(
  `DELETE FROM nex_theme_ownership WHERE account_id = $1 AND acquired_via = 'first_free'`,
  [ACC],
);
const after = (await c.query(
  `SELECT count(*)::int AS n FROM nex_theme_ownership WHERE account_id = $1`,
  [ACC],
)).rows[0].n;
eq("cleanup rows=0", after, 0);

await c.end();
console.log(`\n── SUMMARY · pass=${pass} fail=${fail} ──`);
process.exit(fail === 0 ? 0 : 1);
