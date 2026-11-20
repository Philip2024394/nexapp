import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const raw = readFileSync(".env.local","utf8");
const env = (n) => { const m = raw.match(new RegExp(`^${n}=(.*)$`,"m")); let v=m[1].trim(); if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1); return v; };
const url = env("NEXT_PUBLIC_NEX_SUPABASE_URL");
const key = env("NEX_SUPABASE_SERVICE_ROLE_KEY");
if (!/kdstoyyeygcopkogqsyv/.test(url)) { console.error("STOP not sandbox"); process.exit(2); }
console.log("REST url:", url);
const admin = createClient(url, key, { auth: { persistSession: false }});
const { data, error } = await admin.from("nex_account")
  .select("id, nex_handle, display_name, bubble_self_hex, bubble_peer_hex, bubble_self_appearance, bubble_peer_appearance")
  .eq("id","11111111-1111-4111-8111-111111111111")
  .maybeSingle();
if (error) { console.log("ERROR:", error.message, error.code ?? ""); process.exit(1); }
console.log("row:", JSON.stringify(data, null, 2));
