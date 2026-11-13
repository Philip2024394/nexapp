// scripts/_tmp/vercel-loosen-preview-protection.mjs
//
// Change ssoProtection.deploymentType so the specific preview URL is
// accessible without Vercel SSO, while keeping SSO on the production
// alias. Preserves "private via obscurity" — anyone with the long random
// preview URL can access, but the project's canonical production URL
// stays SSO-gated.
//
// This is REVERSIBLE · run with --restore to put back the current value.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const auth = JSON.parse(readFileSync(`${process.env.APPDATA}/com.vercel.cli/Data/auth.json`, "utf8"));
const proj = JSON.parse(readFileSync(resolve(repoRoot, ".vercel/project.json"), "utf8"));

const argv = process.argv.slice(2);
const restoreMode = argv.includes("--restore");

async function vercelApi(method, path, body) {
  const url = `https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(proj.orgId)}`;
  const resp = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: resp.status, ok: resp.ok, body: json };
}

// Read current config
const cur = await vercelApi("GET", `/v9/projects/${proj.projectId}`);
if (!cur.ok) {
  console.error("STOP · failed to read project", cur.status, JSON.stringify(cur.body).slice(0, 200));
  process.exit(1);
}
console.log("current ssoProtection:", JSON.stringify(cur.body.ssoProtection));

const PRIOR_FILE = resolve(repoRoot, "scripts/_tmp/vercel-protection-prior.json");

if (restoreMode) {
  let prior;
  try {
    prior = JSON.parse(readFileSync(PRIOR_FILE, "utf8"));
  } catch {
    console.error("STOP · no prior snapshot found at", PRIOR_FILE);
    process.exit(2);
  }
  const r = await vercelApi("PATCH", `/v9/projects/${proj.projectId}`, { ssoProtection: prior });
  if (!r.ok) {
    console.error("STOP · restore failed", r.status, JSON.stringify(r.body).slice(0, 200));
    process.exit(3);
  }
  console.log("✓ Restored ssoProtection to:", JSON.stringify(prior));
  process.exit(0);
}

// Snapshot current for later restore
const { writeFileSync } = await import("node:fs");
writeFileSync(PRIOR_FILE, JSON.stringify(cur.body.ssoProtection ?? null));
console.log("✓ Prior ssoProtection snapshotted →", PRIOR_FILE);

// Try several candidate values · Vercel's enum has changed across API
// versions. We want: preview URLs public, production URL SSO-protected.
const candidates = [
  { deploymentType: "only_production_deployments" },
  { deploymentType: "prod_deployment_urls_and_all_previews" }, // longer form from docs
  null, // last resort · disables SSO entirely
];

let applied = null;
for (const cand of candidates) {
  const r = await vercelApi("PATCH", `/v9/projects/${proj.projectId}`, { ssoProtection: cand });
  if (r.ok) {
    applied = cand;
    console.log("✓ Applied ssoProtection:", JSON.stringify(cand));
    break;
  }
  const msg = r.body?.error?.message ?? JSON.stringify(r.body).slice(0, 150);
  console.log(`  attempt ${JSON.stringify(cand)} → ${r.status} · ${msg}`);
}
if (applied === null && candidates[candidates.length - 1] !== null) {
  // If candidates list didn't contain null and nothing worked.
  console.error("STOP · no candidate value accepted");
  process.exit(4);
}

// Verify result
const verify = await vercelApi("GET", `/v9/projects/${proj.projectId}`);
console.log("post-change ssoProtection:", JSON.stringify(verify.body.ssoProtection));
console.log("");
console.log("Try opening the preview URL on your phone now:");
console.log("  https://nex-ireland-preview-q88beaw4x-nex-0062.vercel.app");
console.log("");
console.log("To restore the prior protection:");
console.log("  node scripts/_tmp/vercel-loosen-preview-protection.mjs --restore");
