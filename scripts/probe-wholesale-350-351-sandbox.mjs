#!/usr/bin/env node
// scripts/probe-wholesale-350-351-sandbox.mjs
//
// Read-only probe · asks the sandbox whether:
//   · public.nex_wholesale_buyer_approval exists (mig 350)
//   · public.nex_wholesale_quote exists (mig 351)
// WITHOUT applying anything. Hard-refuses if URL isn't the sandbox.
//
// 2026-11-18 · prompt-2 Task #145 non-mutating confirmation.

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const key =
  process.env.NEX_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_NEX_SUPABASE_URL or service role key.");
  process.exit(2);
}

const SANDBOX_REF = "kdstoyyeygcopkogqsyv";
if (!url.includes(SANDBOX_REF)) {
  console.error(
    `REFUSED · URL ${url} is not the sandbox (${SANDBOX_REF}). This script` +
      " only runs against the sandbox.",
  );
  process.exit(3);
}

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function probeTable(name) {
  // SELECT 1 column WITH LIMIT 0 · only reads schema cache / plans;
  // zero data rows read, no writes.
  const { error } = await client
    .from(name)
    .select("id", { head: true, count: "exact" })
    .limit(0);
  if (!error) return { exists: true, code: null, message: null };
  // PGRST205 = schema cache miss (table doesn't exist in exposed schema)
  // 42P01    = Postgres undefined_table
  const code = error.code ?? null;
  return { exists: false, code, message: error.message ?? null };
}

const results = {
  project_ref: SANDBOX_REF,
  ts: new Date().toISOString(),
  nex_wholesale_buyer_approval: await probeTable("nex_wholesale_buyer_approval"),
  nex_wholesale_quote: await probeTable("nex_wholesale_quote"),
};

console.log(JSON.stringify(results, null, 2));
process.exit(0);
