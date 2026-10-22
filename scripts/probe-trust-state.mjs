// scripts/probe-trust-state.mjs
//
// Read-only probe · verifies the live Supabase has the directory
// primitives + reports what's in them so we can prepare an honest
// trust-seed script. Written for the Phase 1 Verified-Directory
// wedge (sealed 2026-10-20).
//
// Usage:  node scripts/probe-trust-state.mjs
//
// Zero writes. Only SELECT. Safe to run any time.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
const envRaw = readFileSync(envPath, "utf-8");
const env = Object.fromEntries(
  envRaw
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const url = env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const key = env.NEX_SUPABASE_SERVICE_ROLE_KEY;
console.log(`\n== Probe target ==\n${url}\n`);
if (!url?.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("Project URL does not match sealed Supabase project. Aborting.");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function count(table, schema = "public") {
  const builder = schema === "nex" ? sb.schema("nex").from(table) : sb.from(table);
  const { count: n, error } = await builder.select("*", {
    count: "exact",
    head: true,
  });
  if (error) return `ERROR: ${error.message}`;
  return n;
}

async function sample(table, select, schema = "public", limit = 3) {
  const builder = schema === "nex" ? sb.schema("nex").from(table) : sb.from(table);
  const { data, error } = await builder.select(select).limit(limit);
  if (error) return `ERROR: ${error.message}`;
  return data;
}

console.log("== Table existence + row counts ==");
console.log("nex.source_registry        :", await count("source_registry", "nex"));
console.log("nex.business_canonical     :", await count("business_canonical", "nex"));
console.log("nex.business_evidence      :", await count("business_evidence", "nex"));
console.log("nex_business (public)      :", await count("nex_business"));
console.log("nex_account (public)       :", await count("nex_account"));

console.log("\n== Sample source_registry rows (if any) ==");
console.log(await sample("source_registry", "source_id, display_name, source_kind", "nex", 10));

console.log("\n== Sample business_canonical rows (if any) ==");
console.log(
  await sample(
    "business_canonical",
    "canonical_business_id, name_canonical, lifecycle_state",
    "nex",
    3,
  ),
);

console.log("\n== Sample business_evidence rows (if any) ==");
console.log(
  await sample(
    "business_evidence",
    "evidence_id, canonical_business_id, source_id, observation_generated_at",
    "nex",
    3,
  ),
);

console.log("\n== Done ==\n");
