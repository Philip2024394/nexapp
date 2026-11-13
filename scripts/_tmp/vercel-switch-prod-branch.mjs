// scripts/_tmp/vercel-switch-prod-branch.mjs
//
// 1. PATCH nex-ireland-preview project: change production branch from
//    `main` to `ui-drawer-cleanup-plus-loading-2026-11-09`.
// 2. Mirror the 8 sandbox env vars we set on Preview scope → Production
//    scope so builds on the new production branch use sandbox Supabase.
// 3. Report the new state. Does NOT trigger a deploy here.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const auth = JSON.parse(readFileSync(`${process.env.APPDATA}/com.vercel.cli/Data/auth.json`, "utf8"));
const proj = JSON.parse(readFileSync(resolve(repoRoot, ".vercel/project.json"), "utf8"));

const NEW_PROD_BRANCH = "ui-drawer-cleanup-plus-loading-2026-11-09";

async function api(method, path, body) {
  const u = `https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(proj.orgId)}`;
  const r = await fetch(u, {
    method,
    headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: r.status, ok: r.ok, body: json };
}

// Step 1 · PATCH production branch (via project link update)
console.log("Step 1 · changing production branch to", NEW_PROD_BRANCH);
const patch = await api("PATCH", `/v9/projects/${proj.projectId}`, {
  link: { productionBranch: NEW_PROD_BRANCH },
});
if (!patch.ok) {
  console.error("STOP · PATCH failed", patch.status, JSON.stringify(patch.body).slice(0, 200));
  // Try an alternative endpoint shape
  const alt = await api("PATCH", `/v4/projects/${proj.projectId}`, {
    link: { productionBranch: NEW_PROD_BRANCH },
  });
  if (!alt.ok) {
    console.error("alt also failed", alt.status, JSON.stringify(alt.body).slice(0, 200));
    process.exit(1);
  }
  console.log("✓ alt endpoint accepted");
} else {
  console.log("✓ production branch patched");
}

// Verify
const verify = await api("GET", `/v9/projects/${proj.projectId}`);
console.log("post-patch production branch:", verify.body?.link?.productionBranch);

// Step 2 · mirror the 8 sandbox env vars from Preview → Production scope
console.log("\nStep 2 · mirroring sandbox env vars to Production scope");
const raw = readFileSync(resolve(repoRoot, ".env.local"), "utf8");
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

if (!SANDBOX_SUPABASE_URL.includes("kdstoyyeygcopkogqsyv")) {
  console.error("STOP · SANDBOX_SUPABASE_URL does not reference sandbox");
  process.exit(2);
}
if (SANDBOX_DATABASE_URL.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("STOP · SANDBOX_DATABASE_URL contains production ref");
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

function run(args) {
  return new Promise((resolve) => {
    const p = spawn("vercel", args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });
}

for (const { name, value, sensitive } of assignments) {
  // Remove then add for a clean overwrite. Production scope.
  await run(["env", "rm", name, "production", "--yes"]);
  const args = ["env", "add", name, "production", "--value", value, "--yes"];
  if (sensitive) args.push("--sensitive");
  const r = await run(args);
  if (r.code === 0) {
    console.log(`✓ production · ${name}${sensitive ? " (sensitive)" : ""}`);
  } else {
    console.error(`✗ production · ${name} · ${r.err || r.out}`);
    process.exit(10);
  }
}

console.log("\n✓ Production branch + production env vars updated.");
console.log("  Project: nex-ireland-preview");
console.log(`  Production branch: ${NEW_PROD_BRANCH}`);
console.log("  All 8 sandbox env vars mirrored to Production scope.");
console.log("\nNext: run `vercel deploy --prod` to make the production alias serve the latest code.");
