// Probe the chat-view-preferences columns via the Supabase REST client
// (same path the app uses · via nexSupabaseAdmin). Confirms the
// PostgREST schema cache now exposes the mig-285 columns.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
function envVar(name) {
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`${name} not found`);
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const url = envVar("NEXT_PUBLIC_NEX_SUPABASE_URL");
const key = envVar("NEX_SUPABASE_SERVICE_ROLE_KEY");
console.log(`REST url: ${url}`);
if (!/kdstoyyeygcopkogqsyv/.test(url)) {
  console.error("STOP · not pointing at sandbox");
  process.exit(2);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

console.log("\nProbing nex_account.screenshot_copy_protection_enabled ...");
const { data, error } = await admin
  .from("nex_account")
  .select("id, chat_font_family, chat_font_size, screenshot_copy_protection_enabled")
  .eq("id", "11111111-1111-4111-8111-111111111111")
  .maybeSingle();
if (error) {
  console.log(`  ERROR: ${error.message}`);
  process.exit(1);
} else {
  console.log(`  OK · row:`, data);
}
