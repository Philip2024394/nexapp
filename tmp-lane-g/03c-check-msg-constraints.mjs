import { readFileSync } from "node:fs";
import { Client } from "pg";
const envRaw = readFileSync("C:/Users/Victus/nexapp/.env.local", "utf8");
function envValue(name) { const m = envRaw.match(new RegExp(`^${name}=(.*)$`, "m")); if (!m) return null; let v = m[1].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); return v || null; }
const c = new Client({ connectionString: envValue("SANDBOX_DATABASE_URL") });
await c.connect();
const r = await c.query(`SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='nex_peer_message'::regclass`);
console.log(r.rows.map(x => x.conname + ": " + x.pg_get_constraintdef).join("\n"));
await c.end();
