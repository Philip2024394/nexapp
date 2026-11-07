// scripts/concurrency-rehearsal/_lib.mjs
// -----------------------------------------------------------------------------
// Shared helpers for the migration-281 local rehearsal scripts.
// Enforces the DISPOSABLE-POSTGRES-ONLY posture: refuses to run if
// NEX_REHEARSAL_PG_URL looks like a Supabase / production hostname, and
// refuses to use NEX_POSTGRES_URL / DATABASE_URL.

import pg from "pg";
const { Client } = pg;

const PRODUCTION_HOSTNAME_FRAGMENTS = [
  "supabase.co",
  "supabase.net",
  "pooler.supabase.com",
  "rds.amazonaws.com",
  "neon.tech",
];

/** Read the rehearsal DB URL from env and refuse to proceed if it
 *  points at anything that could be production. */
export function getRehearsalConnection(options = {}) {
  const url = process.env.NEX_REHEARSAL_PG_URL;
  if (!url) {
    throw new Error(
      "NEX_REHEARSAL_PG_URL is not set · refuse to default to " +
        "NEX_POSTGRES_URL / DATABASE_URL (production). Export an " +
        "URL pointing at a disposable local Postgres instance.",
    );
  }
  for (const frag of PRODUCTION_HOSTNAME_FRAGMENTS) {
    if (url.includes(frag)) {
      throw new Error(
        `NEX_REHEARSAL_PG_URL contains '${frag}' · refuse to run ` +
          `against what looks like production. Rehearsal is DISPOSABLE ` +
          `LOCAL ONLY.`,
      );
    }
  }
  return { url, dbOverride: options.database };
}

/** Clone the base URL and swap in a different database name. */
export function withDatabase(baseUrl, dbName) {
  const u = new URL(baseUrl);
  u.pathname = `/${encodeURIComponent(dbName)}`;
  return u.toString();
}

export async function connect(url) {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

export async function withClient(url, fn) {
  const client = await connect(url);
  try {
    return await fn(client);
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
}

export function assertEquals(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${message}\n  expected: ${e}\n  actual:   ${a}`);
  }
}

export function assertAtLeast(actual, minimum, message) {
  if (!(actual >= minimum)) {
    throw new Error(`${message}\n  expected >= ${minimum}\n  actual:    ${actual}`);
  }
}

export function assertAtMost(actual, maximum, message) {
  if (!(actual <= maximum)) {
    throw new Error(`${message}\n  expected <= ${maximum}\n  actual:    ${actual}`);
  }
}

export function freshDbName(prefix = "nex_rehearsal") {
  const now = new Date();
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "_");
  return `${prefix}_${stamp}`;
}

export function uuid(prefix = "00000000-0000-4000-8000-") {
  // Fixed-prefix UUIDs so the rehearsal is deterministic + easy to
  // grep. Six hex trailing digits give 16.7M possible fixtures ·
  // plenty for a 20-request boundary test.
  const hex = Math.floor(Math.random() * 0xffffff).toString(16).padStart(12, "0");
  return `${prefix}${hex}`;
}

export async function callRpc(client, args) {
  const text = `SELECT public.nex_product_create_with_cap_gate(
    $1::uuid, $2::text, $3::text, $4::text, $5::text[], $6::text[],
    $7::text, $8::text, $9::integer, $10::text, $11::text,
    $12::text, $13::text, $14::jsonb, $15::text, $16::uuid,
    $17::text, $18::uuid, $19::integer
  ) AS id`;
  const values = [
    args.businessId,
    args.name ?? "T",
    args.description ?? null,
    args.imageUrl ?? null,
    args.galleryUrls ?? null,
    args.tags ?? null,
    args.sku ?? null,
    args.stockStatus ?? "in_stock",
    args.pricePence ?? 100,
    args.currency ?? "EUR",
    args.status ?? "live",
    args.departmentId ?? null,
    args.categoryId ?? null,
    args.spec ?? {},
    args.dispatchTime ?? null,
    args.backgroundVideoId ?? null,
    args.backgroundImageUrl ?? null,
    args.backgroundMusicId ?? null,
    args.cap,
  ];
  const r = await client.query(text, values);
  return r.rows[0].id;
}
