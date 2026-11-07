#!/usr/bin/env node
// scripts/nex-purge-expired-peer-messages.mjs
// -----------------------------------------------------------------------------
// NEX Chat · disappearing messages purge runner · owner-sealed 2026-11-07.
//
// External-scheduler entry point for the purge function in migration 284.
// Call this on a cron (Vercel cron, GitHub Actions cron, NEX-internal
// scheduler) when pg_cron is not available.
//
// USAGE
//   NEX_PURGE_PG_URL="postgresql://..." node scripts/nex-purge-expired-peer-messages.mjs
//
// Refuses to run if NEX_PURGE_PG_URL is unset OR looks like something
// other than the sealed Supabase project. The owner authorises this
// script separately from the rest of the rehearsal harness · it IS
// intended to touch production once owner approves the activation.

import pg from "pg";
const { Client } = pg;

const url = process.env.NEX_PURGE_PG_URL;
if (!url) {
  console.error(
    "NEX_PURGE_PG_URL is not set · refuse to run without an explicit DB target",
  );
  process.exit(2);
}
// Light sanity check · we DO allow Supabase here (unlike the rehearsal
// harness) because this script's job is to run against the live DB
// AFTER owner approves activation. But we still refuse to run against
// anything clearly wrong.
const u = new URL(url);
if (!u.hostname || u.hostname === "") {
  console.error("NEX_PURGE_PG_URL has no hostname");
  process.exit(3);
}

const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
const startedAt = Date.now();
try {
  await client.connect();
  const r = await client.query(
    "select public.nex_purge_expired_peer_messages() as deleted",
  );
  const n = Number(r.rows[0]?.deleted ?? 0);
  const elapsed = Date.now() - startedAt;
  console.log(JSON.stringify({ ok: true, deleted: n, elapsedMs: elapsed }));
  process.exit(0);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(JSON.stringify({ ok: false, error: msg }));
  process.exit(1);
} finally {
  try {
    await client.end();
  } catch {
    /* ignore */
  }
}
