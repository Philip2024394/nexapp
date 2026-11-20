// scripts/_tmp/pooler-url.mjs
// Builds the sandbox pooler connection string from .env.local passwords.
// Exports POOLER_URL via stdout line "POOLER_URL=..." WITH password · callers
// must NEVER log this stdout back in evidence files. Session-mode 5432 by
// default (safer for DDL); pass "tx" arg for transaction-mode 6543.
import { readFileSync } from "node:fs";
const env = readFileSync(".env.local", "utf8");
function v(k){const m=env.match(new RegExp("^"+k+"=(.*)$","m"));if(!m)return null;let x=m[1].trim();if((x.startsWith('"')&&x.endsWith('"'))||(x.startsWith("'")&&x.endsWith("'")))x=x.slice(1,-1);return x||null;}
const SANDBOX = "kdstoyyeygcopkogqsyv";
const HOST = "aws-1-eu-west-3.pooler.supabase.com";
const port = process.argv[2] === "tx" ? 6543 : 5432;
const raw = v("SANDBOX_DATABASE_URL") || v("DATABASE_URL");
if (!raw) { console.error("no DB URL"); process.exit(2); }
if (raw.includes("ijvqdvsvwtwxzcqmoqit")) { console.error("prod ref · refuse"); process.exit(3); }
const pw = decodeURIComponent(new URL(raw).password);
process.stdout.write(`postgresql://postgres.${SANDBOX}:${encodeURIComponent(pw)}@${HOST}:${port}/postgres`);
