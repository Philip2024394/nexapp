// scripts/_tmp/vercel-check-git-wiring.mjs
//
// Read-only · inspect the GitHub → Vercel wiring for nex-ireland-preview:
//   · project link + production branch
//   · last 10 deployments with their git ref + target + creator
//   · what nex-ireland-preview.vercel.app currently aliases to
//   · whether auto-deploy is enabled for preview branches

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const auth = JSON.parse(readFileSync(`${process.env.APPDATA}/com.vercel.cli/Data/auth.json`, "utf8"));
const proj = JSON.parse(readFileSync(resolve(repoRoot, ".vercel/project.json"), "utf8"));

async function api(path) {
  const u = `https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(proj.orgId)}`;
  const r = await fetch(u, { headers: { Authorization: `Bearer ${auth.token}` } });
  return { status: r.status, body: await r.json() };
}

// Project details
const p = await api(`/v9/projects/${proj.projectId}`);
const info = p.body;
console.log("=== Project ===");
console.log(`name:              ${info.name}`);
console.log(`production branch: ${info.link?.productionBranch ?? "(default: main)"}`);
console.log(`git link type:     ${info.link?.type} → ${info.link?.org}/${info.link?.repo}`);
console.log(`gitForkProtection: ${info.gitForkProtection}`);
console.log(`autoExposeSystemEnvs: ${info.autoExposeSystemEnvs ?? false}`);
console.log(`crons.enabledScope: ${info.crons?.enabledScope ?? "(none)"}`);

// autoAssignCustomDomains + auto-deploy flags
console.log(`auto-assign domains: ${info.autoAssignCustomDomains ?? "(default)"}`);
console.log(`disableEligibleDeploys: ${info.disableEligibleDeployments ?? false}`);
console.log(`link.deployHooks:   ${(info.link?.deployHooks ?? []).length} hook(s)`);

// Recent deployments
console.log("\n=== Last 10 deployments ===");
const d = await api(`/v6/deployments?projectId=${proj.projectId}&limit=10`);
for (const dep of d.body.deployments ?? []) {
  const when = new Date(dep.createdAt).toISOString().replace("T", " ").slice(0, 19);
  const branch = dep.meta?.githubCommitRef ?? dep.meta?.gitBranch ?? "(no git ref)";
  const source = dep.source ?? dep.readyState === "READY" ? dep.source ?? "?" : "?";
  const creator = dep.creator?.username ?? dep.creator?.email ?? "?";
  const target = dep.target ?? "preview";
  console.log(`  ${when} · ${dep.state ?? dep.readyState} · ${target} · ${branch} · by=${creator} · ${dep.url}`);
}

// Check production alias
console.log("\n=== Production aliases ===");
const aliases = await api(`/v4/aliases?projectId=${proj.projectId}&limit=50`);
for (const a of aliases.body.aliases ?? []) {
  console.log(`  ${a.alias} → ${a.deploymentId} (created ${new Date(a.created).toISOString().slice(0, 10)})`);
}
