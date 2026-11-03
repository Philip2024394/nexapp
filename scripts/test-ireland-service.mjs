// scripts/test-ireland-service.mjs
// Direct test of suggestZonesForOnboarding using the sealed REST client.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnv(key) {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === key) return m[2];
  }
  return null;
}

const url = readEnv("NEX_SUPABASE_URL") ?? readEnv("NEXT_PUBLIC_NEX_SUPABASE_URL");
const key = readEnv("NEX_SUPABASE_SERVICE_ROLE_KEY");

if (!url || !key) { console.error("missing env"); process.exit(2); }

console.log("URL ->", url);

const client = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await client
  .from("nex_community_zone")
  .select("*")
  .eq("country", "IE")
  .eq("level", "city")
  .is("archived_at", null)
  .order("name", { ascending: true });

if (error) {
  console.error("ERROR", error);
  process.exit(1);
}
console.log(`REST returned ${data?.length ?? 0} rows`);
if (data && data.length > 0) data.slice(0, 5).forEach((r) => console.log(`  ${r.name} (${r.slug})`));
