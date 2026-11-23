#!/usr/bin/env node
// scripts/rollback-worker.mjs
//
// Sealed: 2026-11-23
//
// READ-ONLY by default. This script does NOT call the Cloudflare API.
// It prints the exact dashboard URL to click and the exact curl
// commands that WOULD execute the rollback if a Cloudflare API token
// with `workers_scripts:write` scope existed. It appends an intent
// record to docs/engineering/rollback-log.md when --confirm is passed.
//
// Why no API call: the Wrangler OAuth token in use for nexapp lacks
// the `workers_scripts:write` scope (noted in CLAUDE.md §10.1.2 for
// the read side; same gap exists on the write side). Papering over
// that gap by shelling out to an uninstalled tool, or by requesting a
// token the owner has not provided, would be dishonest.
//
// Every real rollback requires a fresh owner-named authorization per
// docs/runbooks/worker-rollback.md. This helper is a logger, not a
// shortcut around CLAUDE.md §5.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..");
const LOG_PATH = join(REPO_ROOT, "docs", "engineering", "rollback-log.md");

function parseArgs(argv) {
  const out = { confirm: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--confirm") { out.confirm = true; continue; }
    if (a === "--help" || a === "-h") { out.help = true; continue; }
    const next = argv[i + 1];
    if (a === "--worker") { out.worker = next; i++; continue; }
    if (a === "--to-sha") { out.toSha = next; i++; continue; }
    if (a === "--reason") { out.reason = next; i++; continue; }
    console.error(`unknown argument: ${a}`);
    process.exit(2);
  }
  return out;
}

function printHelp() {
  console.log(`rollback-worker.mjs — READ-ONLY rollback intent logger

Usage:
  node scripts/rollback-worker.mjs \\
    --worker <name> \\
    --to-sha <7-char-sha> \\
    --reason "<short text>" \\
    [--confirm]

Flags:
  --worker <name>    Cloudflare Worker script name (e.g. nexapp-preview).
  --to-sha <sha>     Target rollback commit (7+ hex chars).
  --reason <text>    Short human-readable reason. Required.
  --confirm          Append an intent line to docs/engineering/rollback-log.md.
                     Without --confirm, nothing is written.
  --help, -h         Print this help and exit.

This script NEVER calls the Cloudflare API. It prints instructions and
(with --confirm) logs intent. The actual rollback is a manual action
in the Cloudflare dashboard, per docs/runbooks/worker-rollback.md,
and requires a fresh owner-named authorization.
`);
}

function validate(args) {
  const errs = [];
  if (!args.worker) errs.push("--worker is required");
  if (!args.toSha) errs.push("--to-sha is required");
  if (args.toSha && !/^[0-9a-f]{7,40}$/i.test(args.toSha)) {
    errs.push(`--to-sha "${args.toSha}" is not a valid hex SHA (7-40 chars)`);
  }
  if (!args.reason) errs.push('--reason "<text>" is required');
  if (args.reason && args.reason.length < 10) {
    errs.push(`--reason must be at least 10 characters (got ${args.reason.length})`);
  }
  return errs;
}

function dashboardUrl(workerName) {
  // The exact deployments-tab deep link path has varied across
  // Cloudflare dashboard revisions. The script prints the canonical
  // landing URL and the user clicks through — that path is stable.
  return `https://dash.cloudflare.com/?to=/:account/workers/services/view/${encodeURIComponent(workerName)}/production/deployments`;
}

function hypotheticalCurl(workerName, toSha) {
  // These are printed for the owner's reference ONLY. They are NOT
  // executed by this script. The deployment-id-to-SHA mapping must be
  // retrieved from the Cloudflare dashboard (or a workers_scripts:read
  // -scoped token) first — see `curl #1` below.
  return [
    "",
    "# -- The following commands are REFERENCE ONLY. This script does",
    "#    not execute them. They require a Cloudflare API token with",
    "#    scopes:  workers_scripts:read, workers_scripts:write   plus",
    "#    the account id and (at seal time) the owner has NOT provided",
    "#    such a token. Do NOT run these commands without a fresh",
    "#    owner-named authorization and a fresh scoped token.",
    "",
    "# 1. List deployments to find the deployment id whose annotation",
    "#    `workers/triggered_by` matches the target commit",
    `#    ${toSha}:`,
    "#",
    `#    curl -sS -H "Authorization: Bearer $CF_API_TOKEN" \\`,
    `#      "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/scripts/${workerName}/deployments" \\`,
    "#      | jq '.result.deployments[] | {id, annotations}'",
    "#",
    "# 2. Re-point the Worker at the chosen deployment id:",
    "#",
    `#    curl -sS -X POST -H "Authorization: Bearer $CF_API_TOKEN" \\`,
    `#      -H "Content-Type: application/json" \\`,
    `#      "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/scripts/${workerName}/deployments" \\`,
    '#      --data \'{"strategy":"percentage","versions":[{"version_id":"<deployment-id-from-step-1>","percentage":100}]}\'',
    "",
    "# After either path (dashboard or API), verify with:",
    "#",
    `#    curl -sI https://nexapp-preview.nex-sandbox.workers.dev/api/nex-native/version | grep -i x-nex-commit-sha`,
    "",
  ].join("\n");
}

function ensureLogHeader() {
  if (existsSync(LOG_PATH)) return;
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  const header = `# Rollback log — nexapp

Sealed: 2026-11-23

This file is append-only. Every entry is a rollback INTENT recorded by
\`scripts/rollback-worker.mjs --confirm\`. The script does not execute
rollbacks; it prints instructions and writes an intent line here.

Fields:
- timestamp (UTC, ISO-8601)
- worker
- to-sha (7+ hex chars)
- reason
- initiator (process.env.USER || "unknown")

---

`;
  writeFileSync(LOG_PATH, header, "utf8");
}

function appendLogEntry(args) {
  ensureLogHeader();
  const nowIso = new Date().toISOString();
  const initiator = process.env.USER || process.env.USERNAME || "unknown";
  const line = `- ${nowIso} · worker=\`${args.worker}\` · to-sha=\`${args.toSha}\` · initiator=\`${initiator}\` · reason: ${args.reason}\n`;
  const existing = readFileSync(LOG_PATH, "utf8");
  writeFileSync(LOG_PATH, existing + line, "utf8");
  return { logPath: LOG_PATH, line };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }
  const errs = validate(args);
  if (errs.length) {
    console.error("Argument errors:");
    for (const e of errs) console.error(`  - ${e}`);
    console.error("");
    printHelp();
    process.exit(2);
  }

  console.log("=".repeat(72));
  console.log("rollback-worker.mjs — READ-ONLY intent logger");
  console.log("=".repeat(72));
  console.log("");
  console.log(`Worker : ${args.worker}`);
  console.log(`To-SHA : ${args.toSha}`);
  console.log(`Reason : ${args.reason}`);
  console.log(`Confirm: ${args.confirm ? "YES — will append to rollback-log.md" : "no — dry-run only"}`);
  console.log("");
  console.log("-".repeat(72));
  console.log("Manual rollback — Cloudflare dashboard (primary path):");
  console.log("-".repeat(72));
  console.log("");
  console.log(`  1. Open: ${dashboardUrl(args.worker)}`);
  console.log("  2. Select the deployment row matching the target SHA.");
  console.log(`     Target SHA: ${args.toSha}`);
  console.log("  3. Click the row's overflow menu → Rollback to this version.");
  console.log("  4. Confirm the dashboard dialog.");
  console.log("  5. Verify by curling the version endpoint and comparing");
  console.log("     the `x-nex-commit-sha` response header against the");
  console.log("     target SHA (see runbook for exact command).");
  console.log("");
  console.log("-".repeat(72));
  console.log("Hypothetical API path (for owner reference — NOT executed):");
  console.log("-".repeat(72));
  console.log(hypotheticalCurl(args.worker, args.toSha));

  if (args.confirm) {
    const res = appendLogEntry(args);
    console.log("-".repeat(72));
    console.log(`Appended intent to ${res.logPath}`);
    console.log(res.line.trimEnd());
    console.log("-".repeat(72));
  } else {
    console.log("-".repeat(72));
    console.log("Dry-run complete. Re-run with --confirm to append an intent");
    console.log("line to docs/engineering/rollback-log.md.");
    console.log("");
    console.log("Reminder: this script did NOT perform a rollback. The");
    console.log("rollback itself is a manual dashboard action under a fresh");
    console.log("owner-named authorization per docs/runbooks/worker-rollback.md.");
    console.log("-".repeat(72));
  }
}

main();
