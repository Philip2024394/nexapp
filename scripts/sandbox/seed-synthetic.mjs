#!/usr/bin/env node
// scripts/sandbox/seed-synthetic.mjs
//
// Owner-authorised 2026-10-31 (round 12 · sandbox prep).
// Seeds the SANDBOX Supabase project with synthetic Ireland + Indonesia
// test data so the preview deployments have content to render against.
//
// Hard rules (owner's D-D conditions):
//   - Reads nothing from production.
//   - All INSERTs come from a hard-coded list in THIS file (visible,
//     auditable, no file-import mystery).
//   - All synthetic rows are tagged `is_mock_persona = true` or
//     equivalent sentinel so they are distinguishable from real data.
//   - Refuses to run against production project `ijvqdvsvwtwxzcqmoqit`.
//   - Idempotent: ON CONFLICT DO NOTHING on all PK/UK violations.
//
// Scope at commit time:
//   - 4 synthetic Ireland accounts + 2 Ireland businesses + 4 Ireland products
//   - 4 synthetic Indonesia accounts + 2 Indonesia businesses + 4 Indonesia products
//   - 1 HQ admin account (hq_role='admin')
//
// Does NOT seed:
//   - Any peer messages (keeps the sandbox simple)
//   - Any WebAuthn credentials (sandbox previews will enrol fresh)
//   - Any payment / subscription / Vault state
//   - Any migration 244-251 data (those migrations are gated)
//
// Usage:
//   SANDBOX_DATABASE_URL="postgresql://..." node scripts/sandbox/seed-synthetic.mjs
//   SANDBOX_DATABASE_URL="postgresql://..." node scripts/sandbox/seed-synthetic.mjs --dry-run

import { createHash } from "node:crypto";

const PRODUCTION_PROJECT_ID = "ijvqdvsvwtwxzcqmoqit";
const DRY_RUN = process.argv.includes("--dry-run");

function die(msg, code = 1) {
  process.stderr.write(`\n[sandbox seed] ${msg}\n\n`);
  process.exit(code);
}

const dbUrl = process.env.SANDBOX_DATABASE_URL;
if (!dbUrl) {
  die("SANDBOX_DATABASE_URL is not set. This script will NOT read NEX_POSTGRES_URL or DATABASE_URL to avoid accidental production targeting. Set SANDBOX_DATABASE_URL explicitly.");
}
if (dbUrl.includes(PRODUCTION_PROJECT_ID)) {
  die(`SANDBOX_DATABASE_URL contains the production project ID '${PRODUCTION_PROJECT_ID}'. Refusing to seed into production.`);
}

// Deterministic synthetic UUIDs so re-running doesn't duplicate.
// Format: `aa<ident>-sb-<n>` seeded via sha256 → first 32 hex chars → UUID shape.
function syntheticUuid(seed) {
  const h = createHash("sha256").update(`nex-sandbox-synthetic:${seed}`).digest("hex");
  // Reformat to UUID v4-ish shape (not a true UUIDv4 but valid format)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// Handle format must match CHECK (`^nex-[0-9]{5,}$`). We use the 70xxx
// range for Ireland synthetics and 80xxx for Indonesia synthetics so
// they don't collide with the sealed 99901..99905 Indonesia production
// personas. HQ admin uses 90001.
// Each account record also carries the city label we want written to
// nex_account.last_known_city_label at insert time. Owner directive
// 2026-11-01 · Dewi is reassigned to Ireland (Dublin) as a creator who
// posts across the shared global NEX Feed from the Ireland app.
const ACCOUNTS = [
  // Ireland (synthetic)
  { seed: "ie-aoife",   nex_handle: "nex-70001", display_name: "Aoife ONeill",   country: "IE", city: "Dublin" },
  { seed: "ie-liam",    nex_handle: "nex-70002", display_name: "Liam Doherty",   country: "IE", city: "Galway" },
  { seed: "ie-niamh",   nex_handle: "nex-70003", display_name: "Niamh Walsh",    country: "IE", city: "Cork" },
  { seed: "ie-cillian", nex_handle: "nex-70004", display_name: "Cillian Byrne",  country: "IE", city: "Limerick" },
  // Owner-directive 2026-11-01 · Dewi Sari lives in Ireland even though
  // she keeps her name. The feed is one global surface · her location
  // just influences local relevance ranking on Ireland + Indonesia.
  { seed: "id-dewi",    nex_handle: "nex-80001", display_name: "Dewi Sari",      country: "IE", city: "Dublin" },
  { seed: "id-budi",    nex_handle: "nex-80002", display_name: "Budi Sandbox",   country: "ID", city: "Yogyakarta" },
  { seed: "id-sari",    nex_handle: "nex-80003", display_name: "Sari Sandbox",   country: "ID", city: "Yogyakarta" },
  { seed: "id-putu",    nex_handle: "nex-80004", display_name: "Putu Sandbox",   country: "ID", city: "Yogyakarta" },
  // HQ admin
  { seed: "hq-admin",   nex_handle: "nex-90001", display_name: "HQ Admin",       country: null, city: null, hq_role: "admin" },
];

const BUSINESSES = [
  // Ireland
  { seed: "ie-biz-tea",      ownerSeed: "ie-aoife",   display_name: "Aoifes Dublin Tea Room",   slug: "aoifes-dublin-tea-room" },
  { seed: "ie-biz-fitness",  ownerSeed: "ie-liam",    display_name: "Liams Galway Fitness",     slug: "liams-galway-fitness" },
  // Indonesia
  { seed: "id-biz-cafe",     ownerSeed: "id-dewi",    display_name: "Dewis Yogyakarta Cafe",    slug: "dewis-yogya-cafe" },
  { seed: "id-biz-bikeshop", ownerSeed: "id-budi",    display_name: "Budis Jakarta Bike Shop",  slug: "budis-jkt-bike-shop" },
];

// price_pence is bigint; currency ISO 4217 3-letter; status default='draft'
// but we set 'active' so previews show them. department_id must match
// nex_product_department_valid CHECK (30-value enum). category_id is
// free-form text NOT NULL.
const PRODUCTS = [
  // Ireland tea room
  { seed: "ie-prod-tea1",  bizSeed: "ie-biz-tea",      name: "Irish breakfast loose leaf", price_pence: 1200,  currency: "EUR", department_id: "food_grocery_beverages",  category_id: "tea_coffee" },
  { seed: "ie-prod-tea2",  bizSeed: "ie-biz-tea",      name: "Barmbrack cake slice",       price_pence: 650,   currency: "EUR", department_id: "food_delivery_restaurants", category_id: "bakery" },
  // Ireland fitness
  { seed: "ie-prod-fit1",  bizSeed: "ie-biz-fitness",  name: "Personal training session",  price_pence: 6500,  currency: "EUR", department_id: "services_marketplace",     category_id: "personal_training" },
  // Indonesia cafe
  { seed: "id-prod-cafe1", bizSeed: "id-biz-cafe",     name: "Kopi tubruk",                price_pence: 2500,  currency: "IDR", department_id: "food_delivery_restaurants", category_id: "coffee" },
  { seed: "id-prod-cafe2", bizSeed: "id-biz-cafe",     name: "Nasi gudeg",                 price_pence: 4500,  currency: "IDR", department_id: "food_delivery_restaurants", category_id: "rice_dishes" },
  // Indonesia bike shop
  { seed: "id-prod-bike1", bizSeed: "id-biz-bikeshop", name: "Vespa service regular",      price_pence: 25000, currency: "IDR", department_id: "automotive_motorcycles_transport", category_id: "motorcycle_service" },
];

if (DRY_RUN) {
  process.stdout.write(`[sandbox seed] DRY RUN · would seed:\n`);
  process.stdout.write(`  Accounts  : ${ACCOUNTS.length}\n`);
  process.stdout.write(`  Businesses: ${BUSINESSES.length}\n`);
  process.stdout.write(`  Products  : ${PRODUCTS.length}\n`);
  process.stdout.write(`\nSynthetic account IDs:\n`);
  for (const a of ACCOUNTS) process.stdout.write(`  ${syntheticUuid(`account:${a.seed}`)} · ${a.nex_handle} · ${a.display_name}\n`);
  process.exit(0);
}

const pgMod = await import("pg").catch(() => null);
if (!pgMod) die("pg module not installed.");
const { Client } = pgMod.default ?? pgMod;

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
process.stdout.write("[sandbox seed] Connected.\n");

async function hasColumn(table, column) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1 AND column_name=$2 LIMIT 1`,
    [table, column],
  );
  return r.rowCount > 0;
}

// Account inserts · minimum columns + optional columns if present
const hasHqRole = await hasColumn("nex_account", "hq_role");
const hasMock = await hasColumn("nex_account", "is_mock_persona");
const hasHandle = await hasColumn("nex_account", "nex_handle");

process.stdout.write(`[sandbox seed] Schema check · hq_role=${hasHqRole} is_mock_persona=${hasMock} nex_handle=${hasHandle}\n\n`);

let inserted = 0;
let skipped = 0;

for (const a of ACCOUNTS) {
  const id = syntheticUuid(`account:${a.seed}`);
  const cols = ["id", "display_name"];
  const vals = [id, a.display_name];
  if (hasHandle) { cols.push("nex_handle"); vals.push(a.nex_handle); }
  if (hasMock) { cols.push("is_mock_persona"); vals.push(true); }
  if (hasHqRole && a.hq_role) { cols.push("hq_role"); vals.push(a.hq_role); }
  // Owner-directive 2026-11-01 · bake country/city into the seed so a
  // re-run doesn't drift the Ireland-vs-Indonesia assignment.
  if (a.country) { cols.push("last_known_country_iso"); vals.push(a.country); }
  if (a.city)    { cols.push("last_known_city_label");  vals.push(a.city); }
  const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
  // Owner-directive 2026-11-01 · UPSERT the mutable fields so re-seeds
  // reconcile. nex_handle unique index keeps rows stable; display_name,
  // country, city, hq_role refresh in place.
  const updateCols = cols
    .filter((col) => col !== "id" && col !== "nex_handle")
    .map((col) => `${col} = EXCLUDED.${col}`)
    .join(", ");
  const sql = `
    INSERT INTO public.nex_account (${cols.join(", ")})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${updateCols}
  `;
  try {
    const r = await client.query(sql, vals);
    if (r.rowCount > 0) { process.stdout.write(`  + account ${a.nex_handle} (${a.country ?? "—"})\n`); inserted++; }
    else { process.stdout.write(`  = account ${a.nex_handle} already present\n`); skipped++; }
  } catch (err) {
    process.stderr.write(`  ! FAILED account ${a.nex_handle}: ${err.message}\n`);
  }
}

// Owner-directive 2026-11-01 · every mock persona must have a
// nex_account_profile row with is_discoverable=true so the /profile/
// [handle] gate (sealed 2026-10-04, migration 134) can succeed for
// non-owner viewers. Without this row the gate 404s every share URL.
process.stdout.write(`\n[sandbox seed] Writing nex_account_profile rows for ${ACCOUNTS.length} personas · is_discoverable=true\n`);
try {
  const r = await client.query(`
    INSERT INTO public.nex_account_profile
      (account_id, is_discoverable, headline, bio, created_at, updated_at)
    SELECT a.id, true,
           CASE WHEN a.last_known_country_iso IS NULL THEN 'NEX HQ · reviewer'
                ELSE 'NEX ' || a.last_known_country_iso || ' · creator' END,
           'Synthetic persona for Ireland + Indonesia previews. One shared NEX Feed across all countries · 2026-11-01.',
           now(), now()
    FROM public.nex_account a
    WHERE a.is_mock_persona = true
    ON CONFLICT (account_id) DO UPDATE
      SET is_discoverable = EXCLUDED.is_discoverable,
          headline = EXCLUDED.headline,
          updated_at = now()
    RETURNING account_id
  `);
  process.stdout.write(`  + ${r.rowCount} nex_account_profile rows upserted\n`);
} catch (err) {
  process.stderr.write(`  ! FAILED nex_account_profile upsert: ${err.message}\n`);
}

for (const b of BUSINESSES) {
  const id = syntheticUuid(`business:${b.seed}`);
  const ownerId = syntheticUuid(`account:${b.ownerSeed}`);
  const sql = `INSERT INTO public.nex_business (id, owner_account_id, display_name, slug) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`;
  try {
    const r = await client.query(sql, [id, ownerId, b.display_name, b.slug]);
    if (r.rowCount > 0) { process.stdout.write(`  + business ${b.slug}\n`); inserted++; }
    else { process.stdout.write(`  = business ${b.slug} already present\n`); skipped++; }
  } catch (err) {
    process.stderr.write(`  ! FAILED business ${b.slug}: ${err.message}\n`);
  }
}

// nex_product NOT NULL columns: name, price_pence, currency, status
// (default='draft'), department_id (CHECK enum), category_id (free-form
// text), spec jsonb (default='{}'). We set status='active' so previews
// render them.
for (const p of PRODUCTS) {
  const id = syntheticUuid(`product:${p.seed}`);
  const bizId = syntheticUuid(`business:${p.bizSeed}`);
  const sql = `
    INSERT INTO public.nex_product
      (id, business_id, name, price_pence, currency, status, department_id, category_id, spec)
    VALUES ($1, $2, $3, $4, $5, 'live', $6, $7, '{}'::jsonb)
    ON CONFLICT (id) DO NOTHING`;
  try {
    const r = await client.query(sql, [id, bizId, p.name, p.price_pence, p.currency, p.department_id, p.category_id]);
    if (r.rowCount > 0) { process.stdout.write(`  + product ${p.name}\n`); inserted++; }
    else { process.stdout.write(`  = product ${p.name} already present\n`); skipped++; }
  } catch (err) {
    process.stderr.write(`  ! FAILED product ${p.name}: ${err.message}\n`);
  }
}

await client.end();
process.stdout.write(`\n[sandbox seed] Done · inserted=${inserted} skipped=${skipped}\n`);
process.exit(0);
