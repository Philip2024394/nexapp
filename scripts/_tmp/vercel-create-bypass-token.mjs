// scripts/_tmp/vercel-create-bypass-token.mjs
//
// Create a Protection Bypass for Automation token on the Vercel project
// and print the ready-to-paste URL for the current preview deployment.
// Uses the local Vercel CLI auth token (never prints it).

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const authPath = `${process.env.APPDATA}/com.vercel.cli/Data/auth.json`;
const auth = JSON.parse(readFileSync(authPath, "utf8"));
if (!auth.token) { console.error("STOP · no Vercel CLI token found"); process.exit(1); }

const projectJson = JSON.parse(readFileSync(resolve(repoRoot, ".vercel/project.json"), "utf8"));
const projectId = projectJson.projectId;
const teamId = projectJson.orgId;
if (!projectId || !teamId) { console.error("STOP · project.json missing projectId or orgId"); process.exit(2); }

const PREVIEW_URL = "https://nex-ireland-preview-q88beaw4x-nex-0062.vercel.app";

async function vercelApi(method, path, body) {
  const url = `https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(teamId)}`;
  const resp = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: resp.status, ok: resp.ok, body: json };
}

// First list existing bypass tokens on the project.
const list = await vercelApi("GET", `/v1/projects/${projectId}/protection-bypass`);
console.log("existing bypass tokens:", list.status);
if (list.ok) {
  const existing = Array.isArray(list.body) ? list.body : list.body.bypassSecrets ?? list.body.tokens ?? [];
  console.log(`  count=${existing.length}`);
}

// Create a new bypass token.
const create = await vercelApi(
  "POST",
  `/v1/projects/${projectId}/protection-bypass`,
  { generate: true },
);

if (!create.ok) {
  // Older API shape may be different · try the alternative endpoint.
  const alt = await vercelApi(
    "POST",
    `/v1/projects/${projectId}/protection-bypass`,
    {},
  );
  console.log("alt create status:", alt.status);
  console.log("alt body:", JSON.stringify(alt.body).slice(0, 400));
  if (!alt.ok) {
    console.error("STOP · bypass token creation failed");
    console.error("primary:", JSON.stringify(create.body).slice(0, 400));
    process.exit(3);
  }
  // Use the alt result if primary failed.
  var tokenResp = alt.body;
} else {
  var tokenResp = create.body;
}

// Response shape varies by Vercel API version. Try several known fields.
const token =
  tokenResp.bypassToken ??
  tokenResp.bypass ??
  tokenResp.token ??
  (Array.isArray(tokenResp) && tokenResp[0]?.bypassToken) ??
  null;

if (!token) {
  console.error("STOP · bypass token not in response");
  console.error("response:", JSON.stringify(tokenResp).slice(0, 400));
  process.exit(4);
}

const previewUrl = new URL(PREVIEW_URL);
previewUrl.searchParams.set("x-vercel-protection-bypass", token);
previewUrl.searchParams.set("x-vercel-set-bypass-cookie", "true");

console.log("");
console.log("================ Protection Bypass Token created ================");
console.log(`token length: ${token.length}`);
console.log("");
console.log("Paste this URL on your phone:");
console.log("");
console.log(previewUrl.toString());
console.log("");
console.log("First visit sets a cookie · subsequent visits (including PWA");
console.log("standalone mode) carry the cookie, so no SSO redirect loop.");
console.log("");
console.log("To revoke later: Vercel dashboard → Project → Settings →");
console.log("Deployment Protection → Protection Bypass for Automation → remove.");
