// scripts/seed-test-env-e2e.mjs
//
// Owner-authorised 2026-10-31 (Decision 1 Part A). Idempotent seed
// script for the dedicated Supabase test project used by the
// Playwright E2E suite (see tests/e2e-product-upload/README.md).
//
// Hard safety:
//   · Refuses to run if TEST_SUPABASE_URL or TEST_DATABASE_URL
//     contains the production project ref `ijvqdvsvwtwxzcqmoqit`
//     (CLAUDE.md §8 sealed production ref).
//   · Requires TEST_* env vars to be explicitly set — never reads
//     DATABASE_URL or NEX_SUPABASE_URL to avoid pointing at prod by
//     accident.
//
// Idempotency:
//   · Looks up a seed account by stable email `e2e-seller@test.nex.local`.
//     If found, returns its id. If not, inserts.
//   · Same pattern for the business keyed by stable slug `e2e-test-shop`.
//
// Output:
//   · Prints the three UUIDs/slug to stdout, one line each:
//       TEST_SELLER_ACCOUNT_ID=<uuid>
//       TEST_BUSINESS_ID=<uuid>
//       TEST_BUSINESS_SLUG=e2e-test-shop
//     Export these into your shell / .env.test.local before running
//     `npm run test:product-upload`.
//
// Dependencies:
//   · `pg` is already in package.json (used by apply-migration-NNN.mjs).

import pg from "pg";

const PROD_SIGIL = "ijvqdvsvwtwxzcqmoqit";
const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? "";
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";

if (!TEST_SUPABASE_URL || !TEST_DATABASE_URL) {
  console.error(
    "ERR: both TEST_SUPABASE_URL and TEST_DATABASE_URL must be set.",
  );
  console.error("Provision the dedicated test Supabase project per");
  console.error("tests/e2e-product-upload/README.md before running this seed.");
  process.exit(2);
}

if (
  TEST_SUPABASE_URL.includes(PROD_SIGIL)
  || TEST_DATABASE_URL.includes(PROD_SIGIL)
) {
  console.error(
    `REFUSED: a TEST_* env var contains the production project ref ${PROD_SIGIL}.`,
  );
  console.error("This script never writes to production. Aborting.");
  process.exit(2);
}

const SEED_EMAIL = "e2e-seller@test.nex.local";
const SEED_DISPLAY_NAME = "E2E Test Seller";
const SEED_BUSINESS_SLUG = "e2e-test-shop";
const SEED_BUSINESS_NAME = "E2E Test Shop";

const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
await client.connect();

try {
  await client.query("BEGIN");

  // ─── Seed nex_account ───────────────────────────────────────────
  let accountId;
  {
    const { rows } = await client.query(
      `SELECT id FROM nex_account WHERE email = $1 LIMIT 1`,
      [SEED_EMAIL],
    );
    if (rows.length > 0) {
      accountId = rows[0].id;
    } else {
      const insert = await client.query(
        `INSERT INTO nex_account (
           email, display_name, is_mock_persona, tier,
           phone_country_code, last_known_country_iso
         ) VALUES ($1, $2, true, 'bisnis', '+62', 'ID')
         RETURNING id`,
        [SEED_EMAIL, SEED_DISPLAY_NAME],
      );
      accountId = insert.rows[0].id;
    }
  }

  // ─── Seed nex_business ──────────────────────────────────────────
  let businessId;
  {
    const { rows } = await client.query(
      `SELECT id FROM nex_business WHERE slug = $1 LIMIT 1`,
      [SEED_BUSINESS_SLUG],
    );
    if (rows.length > 0) {
      businessId = rows[0].id;
      // Re-attach to our seed account in case someone changed it.
      await client.query(
        `UPDATE nex_business SET owner_account_id = $1 WHERE id = $2`,
        [accountId, businessId],
      );
    } else {
      const insert = await client.query(
        `INSERT INTO nex_business (
           slug, display_name, owner_account_id, business_category
         ) VALUES ($1, $2, $3, 'other')
         RETURNING id`,
        [SEED_BUSINESS_SLUG, SEED_BUSINESS_NAME, accountId],
      );
      businessId = insert.rows[0].id;
    }
  }

  await client.query("COMMIT");

  console.log(`TEST_SELLER_ACCOUNT_ID=${accountId}`);
  console.log(`TEST_BUSINESS_ID=${businessId}`);
  console.log(`TEST_BUSINESS_SLUG=${SEED_BUSINESS_SLUG}`);
  console.log("");
  console.log("Seed complete. Export the three env vars above and run:");
  console.log("  npm run test:product-upload");
} catch (e) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error("SEED FAILED:", e instanceof Error ? e.message : String(e));
  process.exit(1);
} finally {
  await client.end();
}
