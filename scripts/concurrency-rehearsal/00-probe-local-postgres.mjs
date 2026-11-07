#!/usr/bin/env node
// scripts/concurrency-rehearsal/00-probe-local-postgres.mjs
// -----------------------------------------------------------------------------
// Owner-authorised 2026-11-07 · Shop concurrency migration 281 local rehearsal.
// Probe for a reachable local Postgres we can safely create a DISPOSABLE
// database on. Does NOT use NEX_POSTGRES_URL / DATABASE_URL · those point
// at production Supabase per .env.local and are off-limits for this task.
//
// Tries, in order:
//   · postgresql://postgres:postgres@localhost:5433/postgres (nex_dev convention)
//   · postgresql://postgres:postgres@localhost:5432/postgres (standard)
//   · Any user-supplied URL on argv[2]
//
// Reports ONLY whether each candidate is reachable + its server version.
// Never queries user data · never creates anything.

import pg from "pg";
const { Client } = pg;

const CANDIDATES = [
  "postgresql://postgres:postgres@127.0.0.1:5433/postgres",
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
  "postgresql://postgres@127.0.0.1:5433/postgres",
  "postgresql://postgres@127.0.0.1:5432/postgres",
];

if (process.argv[2]) CANDIDATES.push(process.argv[2]);

async function probe(url) {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    const r = await client.query("SELECT version() AS v, current_database() AS db, current_user AS u");
    await client.end();
    const masked = url.replace(/:[^:@]*@/, ":***@");
    return {
      url: masked,
      reachable: true,
      version: r.rows[0].v,
      db: r.rows[0].db,
      user: r.rows[0].u,
    };
  } catch (err) {
    try { await client.end(); } catch { /* ignore */ }
    const masked = url.replace(/:[^:@]*@/, ":***@");
    return {
      url: masked,
      reachable: false,
      err: err.code ?? err.message ?? String(err),
    };
  }
}

const results = [];
for (const url of CANDIDATES) {
  results.push(await probe(url));
}

for (const r of results) {
  console.log(JSON.stringify(r));
}
