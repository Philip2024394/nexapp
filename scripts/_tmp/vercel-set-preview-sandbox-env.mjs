// scripts/_tmp/vercel-set-preview-sandbox-env.mjs
//
// One-shot helper · reads SANDBOX_* from .env.local and writes them as
// Preview-scope env vars on the currently-linked Vercel project. Uses
// `vercel env add --value <value> --yes --force` for non-interactive
// upsert behaviour. Does NOT touch Development or Production scopes.

import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const raw = readFileSync(".env.local", "utf8");
function envValue(name) {
  const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v || null;
}

const SANDBOX_DATABASE_URL = envValue("SANDBOX_DATABASE_URL");
const SANDBOX_SUPABASE_URL = envValue("SANDBOX_SUPABASE_URL");
const SANDBOX_SUPABASE_SERVICE_ROLE_KEY = envValue("SANDBOX_SUPABASE_SERVICE_ROLE_KEY");
const SANDBOX_SUPABASE_ANON_KEY = envValue("SANDBOX_SUPABASE_ANON_KEY");

if (!SANDBOX_DATABASE_URL || !SANDBOX_SUPABASE_URL || !SANDBOX_SUPABASE_SERVICE_ROLE_KEY || !SANDBOX_SUPABASE_ANON_KEY) {
  console.error("STOP · one or more SANDBOX_* env vars missing from .env.local");
  process.exit(1);
}

if (!SANDBOX_SUPABASE_URL.includes("kdstoyyeygcopkogqsyv")) {
  console.error("STOP · SANDBOX_SUPABASE_URL does not reference sandbox kdstoyyeygcopkogqsyv");
  process.exit(2);
}
if (SANDBOX_DATABASE_URL.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("STOP · SANDBOX_DATABASE_URL contains production ref ijvqdvsvwtwxzcqmoqit");
  process.exit(3);
}

const assignments = [
  { name: "DATABASE_URL",                       value: SANDBOX_DATABASE_URL,              sensitive: true },
  { name: "NEX_POSTGRES_URL",                   value: SANDBOX_DATABASE_URL,              sensitive: true },
  { name: "NEX_SUPABASE_URL",                   value: SANDBOX_SUPABASE_URL,              sensitive: false },
  { name: "NEXT_PUBLIC_NEX_SUPABASE_URL",       value: SANDBOX_SUPABASE_URL,              sensitive: false },
  { name: "NEX_SUPABASE_SERVICE_ROLE_KEY",      value: SANDBOX_SUPABASE_SERVICE_ROLE_KEY, sensitive: true },
  { name: "NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY",  value: SANDBOX_SUPABASE_ANON_KEY,         sensitive: false },
  { name: "NEX_APP_IDENTITY",                   value: "ireland",                         sensitive: false },
  { name: "NEX_APP_COUNTRY",                    value: "IE",                              sensitive: false },
];

function run(args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn("vercel", args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
      ...opts,
    });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d.toString()));
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("close", (code) => {
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
    p.on("error", (e) => resolve({ code: -1, error: e.message }));
  });
}

const PREVIEW_BRANCH = "ui-drawer-cleanup-plus-loading-2026-11-09";

async function removeIfExists(name) {
  const r = await run(["env", "rm", name, "preview", PREVIEW_BRANCH, "--yes"]);
  if (r.code === 0) return { ok: true, removed: true };
  if (/not found|does not exist|No Environment Variable/i.test(r.stderr + r.stdout)) {
    return { ok: true, removed: false };
  }
  return { ok: true, removed: false, warning: (r.stderr || r.stdout).slice(0, 120) };
}

async function addVar(name, value, sensitive) {
  const args = ["env", "add", name, "preview", PREVIEW_BRANCH, "--value", value, "--yes"];
  if (sensitive) args.push("--sensitive");
  const r = await run(args);
  if (r.code === 0) return { ok: true };
  return { ok: false, stderr: r.stderr.slice(0, 200), stdout: r.stdout.slice(0, 200) };
}

for (const { name, value, sensitive } of assignments) {
  await removeIfExists(name);
  const result = await addVar(name, value, sensitive);
  if (result.ok) {
    console.log(`✓ preview · ${name}${sensitive ? " (sensitive)" : ""}`);
  } else {
    console.error(`✗ preview · ${name}`);
    console.error(`  stderr: ${result.stderr}`);
    console.error(`  stdout: ${result.stdout}`);
    process.exit(10);
  }
}

console.log("\n✓ All preview-scope env vars set from sandbox values.");
console.log("  Project: nex-ireland-preview");
console.log("  Scope:   preview");
console.log("  Supabase ref: kdstoyyeygcopkogqsyv (sandbox)");
