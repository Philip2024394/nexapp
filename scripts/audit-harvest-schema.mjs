// Read-only audit script · dumps live schema + row counts for the harvest
// tables so we can confirm the engine's SQL matches reality before any
// migration DDL is authored.

import pg from "pg";

const tables = [
  "harvest_job",
  "harvest_worker",
  "harvest_yield",
  "harvest_business_candidate",
  "harvest_source",
  "meaningful_area",
  "world_country",
  "discovery_programme_country",
];

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL unset");
const client = new pg.Client({ connectionString: url });
await client.connect();

for (const t of tables) {
  console.log(`\n=== nex.${t} ===`);
  const cols = await client.query(
    `SELECT column_name, data_type, udt_name, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema='nex' AND table_name=$1
     ORDER BY ordinal_position`,
    [t],
  );
  cols.rows.forEach((x) =>
    console.log(
      "  " +
        x.column_name.padEnd(32) +
        (x.udt_name || x.data_type).padEnd(26) +
        "nullable=" +
        x.is_nullable +
        " default=" +
        (x.column_default || "(none)"),
    ),
  );
  const n = await client.query(`SELECT count(*) AS n FROM nex.${t}`);
  console.log("  row count: " + n.rows[0].n);

  // Indexes
  const idx = await client.query(
    `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='nex' AND tablename=$1`,
    [t],
  );
  if (idx.rowCount > 0) {
    console.log("  indexes:");
    idx.rows.forEach((x) => console.log("    " + x.indexname));
  }

  // Check constraints
  const chk = await client.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def
     FROM pg_constraint WHERE conrelid=('nex.' || $1)::regclass AND contype='c'`,
    [t],
  );
  if (chk.rowCount > 0) {
    console.log("  check constraints:");
    chk.rows.forEach((x) => console.log("    " + x.conname + ": " + x.def));
  }

  // FKs
  const fk = await client.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def
     FROM pg_constraint WHERE conrelid=('nex.' || $1)::regclass AND contype='f'`,
    [t],
  );
  if (fk.rowCount > 0) {
    console.log("  foreign keys:");
    fk.rows.forEach((x) => console.log("    " + x.conname + ": " + x.def));
  }
}

await client.end();
