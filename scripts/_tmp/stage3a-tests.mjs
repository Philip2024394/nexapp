#!/usr/bin/env node
// Stage 3A post-apply integration tests
// Sandbox only · all state changes rolled back · nothing persists.

import pg from "pg";
import { readFileSync } from "node:fs";

const SBX_DB = process.env.SBX_DB;
if (!SBX_DB) throw new Error("SBX_DB not set");
if (SBX_DB.includes("ijvqdvsvwtwxzcqmoqit")) throw new Error("safeguard · production ref");

const c = new pg.Client({ connectionString: SBX_DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const DEWI = "11111111-1111-4111-8111-111111111111";
const HOTEL_CAL = "b6b68909-4f4c-4281-aaf7-e24f8d58a9ad";

let passed = 0;
let failed = 0;
async function test(label, fn) {
  try {
    await fn();
    console.log(`  PASS · ${label}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL · ${label} · ${e.message.split("\n")[0]}`);
    failed++;
  }
}

console.log("\n=== 253 · content-existence trigger (all tests inside TXN · rolled back) ===");
await c.query("BEGIN");

await test("T1 music_track + valid Hotel California id → INSERT succeeds", async () => {
  await c.query(
    `INSERT INTO public.nex_country_placement (content_type, content_id, country, placement_status, requested_by)
     VALUES ('music_track', $1, 'IE', 'pending', $2)`,
    [HOTEL_CAL, DEWI],
  );
});

await test("T2 music_track + random UUID → trigger raises orphan placement", async () => {
  let threw = false;
  try {
    await c.query(
      `INSERT INTO public.nex_country_placement (content_type, content_id, country, placement_status, requested_by)
       VALUES ('music_track', $1, 'IE', 'pending', $2)`,
      ["00000000-0000-4000-8000-000000000000", DEWI],
    );
  } catch (e) {
    if (e.message.includes("orphan placement")) threw = true;
  }
  if (!threw) throw new Error("expected orphan placement exception");
});

await c.query("ROLLBACK");
await c.query("BEGIN");

await test("T3 invalid content_type with SQL injection attempt → CHECK violation (trigger never runs)", async () => {
  let errCode = null;
  try {
    await c.query(
      `INSERT INTO public.nex_country_placement (content_type, content_id, country, placement_status, requested_by)
       VALUES ('users; DROP TABLE', $1, 'IE', 'pending', $2)`,
      [HOTEL_CAL, DEWI],
    );
  } catch (e) {
    errCode = e.code;
  }
  if (errCode !== "23514") throw new Error(`expected CHECK violation (23514), got ${errCode}`);
});

await c.query("ROLLBACK");
await c.query("BEGIN");

await test("T4 country not in registry (XX) → FK violation (23503)", async () => {
  let errCode = null;
  try {
    await c.query(
      `INSERT INTO public.nex_country_placement (content_type, content_id, country, placement_status, requested_by)
       VALUES ('music_track', $1, 'XX', 'pending', $2)`,
      [HOTEL_CAL, DEWI],
    );
  } catch (e) {
    errCode = e.code;
  }
  if (errCode !== "23503") throw new Error(`expected FK violation (23503), got ${errCode}`);
});

await c.query("ROLLBACK");
await c.query("BEGIN");

await test("T5 duplicate placement (same content + country) → UNIQUE violation (23505)", async () => {
  await c.query(
    `INSERT INTO public.nex_country_placement (content_type, content_id, country, placement_status, requested_by)
     VALUES ('music_track', $1, 'IE', 'pending', $2)`,
    [HOTEL_CAL, DEWI],
  );
  let errCode = null;
  try {
    await c.query(
      `INSERT INTO public.nex_country_placement (content_type, content_id, country, placement_status, requested_by)
       VALUES ('music_track', $1, 'IE', 'pending', $2)`,
      [HOTEL_CAL, DEWI],
    );
  } catch (e) {
    errCode = e.code;
  }
  if (errCode !== "23505") throw new Error(`expected UNIQUE violation (23505), got ${errCode}`);
});

await c.query("ROLLBACK");

console.log("\n  T6 · all 4 permitted content_types accepted by CHECK (orphan trigger fires correctly):");
for (const ct of ["music_track", "uploaded_video", "live_post", "live_session"]) {
  await c.query("BEGIN");
  let outcome = "UNKNOWN";
  try {
    await c.query(
      `INSERT INTO public.nex_country_placement (content_type, content_id, country, placement_status, requested_by)
       VALUES ($1, '00000000-0000-4000-8000-000000000099', 'IE', 'pending', $2)`,
      [ct, DEWI],
    );
    outcome = "FAIL · should have raised orphan";
  } catch (e) {
    if (e.message.includes("orphan placement")) {
      outcome = "PASS · CHECK accepted · trigger raised orphan";
      passed++;
    } else if (e.code === "23514") {
      outcome = "FAIL · CHECK rejected unexpectedly";
      failed++;
    } else {
      outcome = `UNEXPECTED · ${e.code} · ${e.message.split("\n")[0]}`;
      failed++;
    }
  }
  console.log(`    ${ct} → ${outcome}`);
  await c.query("ROLLBACK");
}

console.log("\n=== 254 · audit immutability triggers (service_role path · WE are service_role) ===");

await c.query("BEGIN");

await test("T7 service_role INSERT audit row → succeeds", async () => {
  await c.query(
    `INSERT INTO public.nex_hq_action_log
       (actor_account_id, action, content_type, content_id, country, previous_status, new_status, reason)
     VALUES ($1, 'country_placement_approved', 'music_track', $2, 'IE', 'pending', 'approved', 'TEST ENTRY · will roll back')`,
    [DEWI, HOTEL_CAL],
  );
});

const insertedId = (await c.query("SELECT id FROM public.nex_hq_action_log WHERE reason='TEST ENTRY · will roll back'")).rows[0]?.id;
if (!insertedId) {
  console.log("  FAIL · T7 inserted row not found");
  failed++;
}

if (insertedId) {
  await test("T8 service_role UPDATE audit row → trigger raises (append-only enforced)", async () => {
    let threw = false;
    try {
      await c.query(`UPDATE public.nex_hq_action_log SET reason='tampered' WHERE id=$1`, [insertedId]);
    } catch (e) {
      if (e.message.includes("append-only") || e.code === "42501") threw = true;
    }
    if (!threw) throw new Error("expected append-only trigger exception");
  });

  await test("T9 service_role DELETE audit row → trigger raises (append-only enforced)", async () => {
    let threw = false;
    try {
      await c.query(`DELETE FROM public.nex_hq_action_log WHERE id=$1`, [insertedId]);
    } catch (e) {
      if (e.message.includes("append-only") || e.code === "42501") threw = true;
    }
    if (!threw) throw new Error("expected append-only trigger exception");
  });
}

await c.query("ROLLBACK");

console.log("\n=== Final state verification (all test transactions rolled back) ===");
const final253 = await c.query("SELECT count(*)::int AS n FROM public.nex_country_placement");
const final254 = await c.query("SELECT count(*)::int AS n FROM public.nex_hq_action_log");
const final252 = await c.query("SELECT count(*)::int AS n FROM public.nex_country_registry");
console.log(`  nex_country_registry rows: ${final252.rows[0].n} (expected 2 · IE + ID)`);
console.log(`  nex_country_placement rows: ${final253.rows[0].n} (expected 0 · all test INSERTs rolled back)`);
console.log(`  nex_hq_action_log rows: ${final254.rows[0].n} (expected 0 · all test INSERTs rolled back)`);

console.log("\n=== Irish Pride unchanged check ===");
const ip = await c.query(
  "SELECT visibility, count(*)::int AS n FROM public.nex_music_track WHERE owner_account_id = $1 GROUP BY visibility ORDER BY visibility",
  [DEWI],
);
for (const row of ip.rows) console.log(`  visibility=${row.visibility} · ${row.n} rows`);
const expectedPrivate = ip.rows.find((r) => r.visibility === "private")?.n;
const expectedShared = ip.rows.find((r) => r.visibility === "shared_live")?.n;
if (expectedPrivate !== 4 || expectedShared !== 2) {
  console.log(`  FAIL · Irish Pride tracks changed · expected 4 private + 2 shared_live`);
  failed++;
} else {
  console.log(`  PASS · exact baseline preserved · 4 private + 2 shared_live`);
}

await c.end();

console.log(`\n==========================================`);
console.log(`PASSED: ${passed}  FAILED: ${failed}`);
console.log(`==========================================`);
if (failed > 0) process.exit(1);
