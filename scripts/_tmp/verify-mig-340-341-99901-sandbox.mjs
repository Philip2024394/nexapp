// scripts/_tmp/verify-mig-340-341-99901-sandbox.mjs
//
// Owner-authorised 2026-11-12 · functional verification of migrations
// 340 (global theme sharing) and 341 (bubble colours) against the
// NEX SANDBOX project using the Hammerex Products dev account 99901
// (UUID 11111111-1111-4111-8111-111111111111).
//
// Tests (all direct SQL · mirrors the service layer):
//   G1 · read current global flag (should be TRUE after mig 340 default)
//   G2 · write OFF, read back
//   G3 · write ON, read back
//   B1 · read current bubble colours (both NULL after mig 341)
//   B2 · write self=#ff7200 peer=#128c7e, read back
//   B3 · write invalid hex, expect CHECK violation
//   B4 · reset to NULL, read back
//
// Each test prints OK/FAIL with the observed value.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadEnvVar(name) {
  const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
  const match = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!match) throw new Error(`${name} not found in .env.local`);
  let v = match[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const databaseUrl = loadEnvVar("SANDBOX_DATABASE_URL");
const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";
const u = new URL(databaseUrl);
const refFromUser = u.username.match(/\.([a-z0-9]{15,})/)?.[1] ?? null;
const refFromHost = u.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/)?.[1] ?? null;
const projectRef = refFromUser ?? refFromHost;
if (projectRef === PROD_REF) { console.error("STOP · production ref detected"); process.exit(2); }
if (projectRef !== SANDBOX_REF) { console.error(`STOP · ref "${projectRef}" is not SANDBOX`); process.exit(2); }

const ACC_ID = "11111111-1111-4111-8111-111111111111";
let pass = 0;
let fail = 0;
function assertEq(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? "✓" : "✗"} ${label} · got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
  if (ok) pass++; else fail++;
}

const c = new Client({ connectionString: databaseUrl });
await c.connect();

// Capture original state so we can restore after tests.
const original = (
  await c.query(
    `SELECT theme_sharing_globally_enabled, bubble_self_hex, bubble_peer_hex
       FROM nex_account WHERE id = $1`,
    [ACC_ID],
  )
).rows[0];
console.log(`[pre] 99901 original state:`, original);

try {
  // ── G1 · read current global flag
  console.log(`\n[G1] global flag default after mig 340`);
  const g1 = (await c.query(
    `SELECT theme_sharing_globally_enabled AS v FROM nex_account WHERE id = $1`,
    [ACC_ID],
  )).rows[0];
  assertEq("default=TRUE", g1.v, true);

  // ── G2 · write OFF
  console.log(`\n[G2] write global=OFF`);
  await c.query(
    `UPDATE nex_account SET theme_sharing_globally_enabled = false WHERE id = $1`,
    [ACC_ID],
  );
  const g2 = (await c.query(
    `SELECT theme_sharing_globally_enabled AS v FROM nex_account WHERE id = $1`,
    [ACC_ID],
  )).rows[0];
  assertEq("read-back=FALSE", g2.v, false);

  // ── G3 · write ON
  console.log(`\n[G3] write global=ON`);
  await c.query(
    `UPDATE nex_account SET theme_sharing_globally_enabled = true WHERE id = $1`,
    [ACC_ID],
  );
  const g3 = (await c.query(
    `SELECT theme_sharing_globally_enabled AS v FROM nex_account WHERE id = $1`,
    [ACC_ID],
  )).rows[0];
  assertEq("read-back=TRUE", g3.v, true);

  // ── B1 · read current bubble colours
  console.log(`\n[B1] bubble colours defaults after mig 341`);
  const b1 = (await c.query(
    `SELECT bubble_self_hex AS s, bubble_peer_hex AS p FROM nex_account WHERE id = $1`,
    [ACC_ID],
  )).rows[0];
  assertEq("self=NULL", b1.s, null);
  assertEq("peer=NULL", b1.p, null);

  // ── B2 · write both hexes
  console.log(`\n[B2] write self=#ff7200 peer=#128c7e`);
  await c.query(
    `UPDATE nex_account SET bubble_self_hex = $1, bubble_peer_hex = $2 WHERE id = $3`,
    ["#ff7200", "#128c7e", ACC_ID],
  );
  const b2 = (await c.query(
    `SELECT bubble_self_hex AS s, bubble_peer_hex AS p FROM nex_account WHERE id = $1`,
    [ACC_ID],
  )).rows[0];
  assertEq("self=#ff7200", b2.s, "#ff7200");
  assertEq("peer=#128c7e", b2.p, "#128c7e");

  // ── B3 · write invalid hex (uppercase + 3-digit) · expect CHECK violation
  console.log(`\n[B3] write invalid hex (uppercase + short) · expect CHECK violation`);
  let threw = false;
  try {
    await c.query(
      `UPDATE nex_account SET bubble_self_hex = 'FF7200' WHERE id = $1`,
      [ACC_ID],
    );
  } catch (err) {
    threw = true;
    console.log(`  (constraint ${err.constraint ?? err.code ?? err.message})`);
  }
  assertEq("invalid rejected", threw, true);
  // Bogus value didn't land · confirm previous valid value still present.
  const b3 = (await c.query(
    `SELECT bubble_self_hex AS s FROM nex_account WHERE id = $1`,
    [ACC_ID],
  )).rows[0];
  assertEq("rollback left #ff7200", b3.s, "#ff7200");

  // ── B4 · reset both to NULL
  console.log(`\n[B4] reset both to NULL`);
  await c.query(
    `UPDATE nex_account SET bubble_self_hex = NULL, bubble_peer_hex = NULL WHERE id = $1`,
    [ACC_ID],
  );
  const b4 = (await c.query(
    `SELECT bubble_self_hex AS s, bubble_peer_hex AS p FROM nex_account WHERE id = $1`,
    [ACC_ID],
  )).rows[0];
  assertEq("self=NULL", b4.s, null);
  assertEq("peer=NULL", b4.p, null);
} finally {
  // Restore original state so the test is idempotent.
  await c.query(
    `UPDATE nex_account
        SET theme_sharing_globally_enabled = $2,
            bubble_self_hex = $3,
            bubble_peer_hex = $4
      WHERE id = $1`,
    [
      ACC_ID,
      original.theme_sharing_globally_enabled,
      original.bubble_self_hex,
      original.bubble_peer_hex,
    ],
  );
  const restored = (
    await c.query(
      `SELECT theme_sharing_globally_enabled, bubble_self_hex, bubble_peer_hex
         FROM nex_account WHERE id = $1`,
      [ACC_ID],
    )
  ).rows[0];
  console.log(`\n[post] 99901 state restored to:`, restored);
  await c.end();
}

console.log(`\n── SUMMARY · pass=${pass} fail=${fail} ──`);
process.exit(fail === 0 ? 0 : 1);
