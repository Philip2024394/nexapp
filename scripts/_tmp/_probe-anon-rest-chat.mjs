import { readFileSync } from "node:fs";
const raw = readFileSync(".env.local","utf8");
const env = (n) => { const m = raw.match(new RegExp(`^${n}=(.*)$`,"m")); if(!m) return null; let v=m[1].trim(); if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1); return v; };
const url = env("NEXT_PUBLIC_NEX_SUPABASE_URL");
const anon = env("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY");
if (!/kdstoyyeygcopkogqsyv/.test(url)) { console.error("STOP not sandbox"); process.exit(2); }
console.log("REST url:", url);

async function probe(table) {
  const r = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` }
  });
  const body = await r.text();
  console.log(`\n${table} → HTTP ${r.status}`);
  console.log("body (first 300):", body.slice(0,300));
}
await probe("nex_peer_message");
await probe("nex_peer_conversation");
