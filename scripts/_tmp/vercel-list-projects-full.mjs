// scripts/_tmp/vercel-list-projects-full.mjs
//
// Enumerate every project in the Vercel team with:
//   · name, id, created-at, last-activity
//   · deployment count + framework
//   · attached domains (custom + .vercel.app)
//   · linked Git repo
//
// Read-only. No side effects.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const auth = JSON.parse(readFileSync(`${process.env.APPDATA}/com.vercel.cli/Data/auth.json`, "utf8"));
const proj = JSON.parse(readFileSync(resolve(repoRoot, ".vercel/project.json"), "utf8"));
const teamId = proj.orgId;

async function vercelApi(path) {
  const url = `https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(teamId)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${auth.token}` } });
  const text = await r.text();
  try { return { status: r.status, ok: r.ok, body: JSON.parse(text) }; }
  catch { return { status: r.status, ok: r.ok, body: { raw: text } }; }
}

const list = await vercelApi(`/v9/projects?limit=100`);
if (!list.ok) {
  console.error("STOP · project list failed", list.status);
  process.exit(1);
}
const projects = list.body.projects ?? [];
console.log(`Found ${projects.length} projects in team ${teamId}:\n`);

for (const p of projects) {
  const created = new Date(p.createdAt).toISOString().slice(0, 10);
  const updated = new Date(p.updatedAt).toISOString().slice(0, 10);
  const domains = (p.targets?.production?.alias ?? []).join(", ") || "(none)";
  const git = p.link
    ? `${p.link.type}:${p.link.org ?? "?"}/${p.link.repo ?? "?"}#${p.link.productionBranch ?? "main"}`
    : "(not linked)";
  const framework = p.framework ?? "(none)";
  console.log(`─────────────────────────────────────────`);
  console.log(`name:         ${p.name}`);
  console.log(`id:           ${p.id}`);
  console.log(`framework:    ${framework}`);
  console.log(`created:      ${created}`);
  console.log(`last updated: ${updated}`);
  console.log(`prod alias:   ${domains}`);
  console.log(`git link:     ${git}`);
  // Count deployments (first page only to be fast)
  const deps = await vercelApi(`/v6/deployments?projectId=${p.id}&limit=1`);
  const totalDeployments = deps.body?.pagination?.count ?? "?";
  console.log(`deployments:  ${totalDeployments}`);
}
console.log(`─────────────────────────────────────────`);
console.log(`\nCurrently linked locally: ${proj.projectName} (${proj.projectId})`);
