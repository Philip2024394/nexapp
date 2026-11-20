// Sandbox-only · probe device-key counts for disposable buyer/seller
// to confirm the 32-row fan-out cap hypothesis for the R3/R5 probe
// non-delivery.
import { readFileSync } from "node:fs";
import { Client } from "pg";

// Load the sandbox env explicitly.
const envText = readFileSync("C:/Users/Victus/nexapp/.env.local", "utf8");
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  const [, k, rawV] = m;
  if (process.env[k]) continue;
  let v = rawV.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  process.env[k] = v;
}

const url = process.env.DATABASE_URL || process.env.NEX_POSTGRES_URL;
if (!url || !/kdstoyyeygcopkogqsyv/.test(url)) {
  throw new Error("Refusing to run · DATABASE_URL does not point at sandbox kdstoyyeygcopkogqsyv");
}

const BUYER = "d977070d-6210-4cd5-a731-f4892dc7047f";
const SELLER = "b7a0cfb1-c71e-41c9-b84b-c20e515b63b3";

const client = new Client({ connectionString: url });
await client.connect();

const schemaCols = (await client.query(
  `select column_name from information_schema.columns
    where table_schema='public' and table_name='nex_account_device_key'
    order by ordinal_position`
)).rows.map((r) => r.column_name);

const hasRetired = schemaCols.includes("retired_at");
const hasLastSeen = schemaCols.includes("last_seen_at");

// Total rows per account
async function countAll(accountId) {
  const r = await client.query(
    `select count(*)::int as c from nex_account_device_key where account_id = $1`,
    [accountId]
  );
  return r.rows[0].c;
}

// Active (retired_at IS NULL) if column present
async function countActive(accountId) {
  if (!hasRetired) return countAll(accountId);
  const r = await client.query(
    `select count(*)::int as c from nex_account_device_key
      where account_id = $1 and retired_at is null`,
    [accountId]
  );
  return r.rows[0].c;
}

// Active within last 24h · last 7d · last 30d (if last_seen_at exists)
async function countFresh(accountId, days) {
  if (!hasLastSeen) return null;
  const whereRetired = hasRetired ? "and retired_at is null" : "";
  const r = await client.query(
    `select count(*)::int as c from nex_account_device_key
      where account_id = $1 ${whereRetired}
        and last_seen_at >= now() - ($2::int || ' days')::interval`,
    [accountId, days]
  );
  return r.rows[0].c;
}

const probe = {
  schema_cols: schemaCols,
  has_retired_at: hasRetired,
  has_last_seen_at: hasLastSeen,
  seller: {
    account_id: SELLER,
    total: await countAll(SELLER),
    active: await countActive(SELLER),
    fresh_1d: await countFresh(SELLER, 1),
    fresh_7d: await countFresh(SELLER, 7),
    fresh_30d: await countFresh(SELLER, 30),
  },
  buyer: {
    account_id: BUYER,
    total: await countAll(BUYER),
    active: await countActive(BUYER),
    fresh_1d: await countFresh(BUYER, 1),
    fresh_7d: await countFresh(BUYER, 7),
    fresh_30d: await countFresh(BUYER, 30),
  },
};

probe.fanout_predicted = {
  seller_plus_buyer_active: probe.seller.active + probe.buyer.active,
  cap: 32,
  exceeds_cap: probe.seller.active + probe.buyer.active > 32,
};

console.log(JSON.stringify(probe, null, 2));

await client.end();
