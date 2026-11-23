#!/usr/bin/env node
// Sealed 2026-11-23 · nexapp blueprint map generator
// Walks nex-supabase/migrations/*.sql
// Emits docs/map/schema-snapshot.md. Read-only.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const MIG_ROOT = path.join(REPO_ROOT, "nex-supabase", "migrations");
const OUT_FILE = path.join(REPO_ROOT, "docs", "map", "schema-snapshot.md");

/**
 * @typedef {{file:string,number:number|null,prefix:string,proposal:boolean,createTables:Array<{name:string,snippet:string}>,alterTables:Array<{name:string,snippet:string}>,dropTables:Array<{name:string,snippet:string}>,indexes:Array<{name:string,snippet:string}>,policies:Array<{name:string,table:string|null,snippet:string}>,functions:Array<{name:string,snippet:string}>,triggers:Array<{name:string,snippet:string}>}} MigrationInfo
 */

/**
 * @param {string} raw
 */
function stripComments(raw) {
  // Remove -- line comments and /* ... */ block comments to simplify regex.
  const noBlock = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  return noBlock
    .split(/\r?\n/)
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
}

/**
 * Pull up to first N chars of a statement starting at the match index.
 */
function snippetAround(src, idx, len = 200) {
  const end = Math.min(src.length, idx + len);
  return src.slice(idx, end).replace(/\s+/g, " ").trim();
}

/**
 * Normalise an object identifier: strip quotes, drop schema prefix.
 */
function normalizeIdent(raw) {
  if (!raw) return "";
  let s = raw.trim();
  // Strip IF NOT EXISTS / IF EXISTS fragments already — regex handled above.
  // Drop surrounding quotes
  s = s.replace(/^"|"$/g, "");
  // schema.table -> keep full; also keep just table for grouping
  return s;
}

/**
 * @param {string} file
 * @returns {Promise<MigrationInfo>}
 */
async function parseMigration(file) {
  const raw = await fs.readFile(file, "utf8");
  const src = stripComments(raw);

  const base = path.basename(file);
  const numMatch = base.match(/^(\d+)[_-]/);
  const prefixMatch = base.match(/^([A-Za-z0-9]+)[_-]/);
  const number = numMatch ? parseInt(numMatch[1], 10) : null;
  const prefix = prefixMatch ? prefixMatch[1] : "";
  const proposal = /^(P-|p-|999|PROPOSAL)/i.test(base);

  /** @type {MigrationInfo} */
  const info = {
    file: path.relative(REPO_ROOT, file).replaceAll("\\", "/"),
    number,
    prefix,
    proposal,
    createTables: [],
    alterTables: [],
    dropTables: [],
    indexes: [],
    policies: [],
    functions: [],
    triggers: [],
  };

  // CREATE TABLE [IF NOT EXISTS] [schema.]name
  const reCreate = /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_".]+)/gi;
  for (const m of src.matchAll(reCreate)) {
    info.createTables.push({ name: normalizeIdent(m[1]), snippet: snippetAround(src, m.index).slice(0, 200) });
  }
  // ALTER TABLE [ONLY] [schema.]name
  const reAlter = /alter\s+table\s+(?:only\s+)?([a-zA-Z0-9_".]+)/gi;
  for (const m of src.matchAll(reAlter)) {
    info.alterTables.push({ name: normalizeIdent(m[1]), snippet: snippetAround(src, m.index).slice(0, 200) });
  }
  // DROP TABLE [IF EXISTS] name
  const reDrop = /drop\s+table\s+(?:if\s+exists\s+)?([a-zA-Z0-9_".]+)/gi;
  for (const m of src.matchAll(reDrop)) {
    info.dropTables.push({ name: normalizeIdent(m[1]), snippet: snippetAround(src, m.index).slice(0, 200) });
  }
  // CREATE INDEX [IF NOT EXISTS] name
  const reIdx = /create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_".]+)/gi;
  for (const m of src.matchAll(reIdx)) {
    info.indexes.push({ name: normalizeIdent(m[1]), snippet: snippetAround(src, m.index).slice(0, 200) });
  }
  // CREATE POLICY name ON table
  const rePol = /create\s+policy\s+([a-zA-Z0-9_"']+)\s+on\s+([a-zA-Z0-9_".]+)/gi;
  for (const m of src.matchAll(rePol)) {
    info.policies.push({
      name: normalizeIdent(m[1]),
      table: normalizeIdent(m[2]),
      snippet: snippetAround(src, m.index).slice(0, 200),
    });
  }
  // CREATE [OR REPLACE] FUNCTION name
  const reFn = /create\s+(?:or\s+replace\s+)?function\s+([a-zA-Z0-9_".]+)/gi;
  for (const m of src.matchAll(reFn)) {
    info.functions.push({ name: normalizeIdent(m[1]), snippet: snippetAround(src, m.index).slice(0, 200) });
  }
  // CREATE TRIGGER name
  const reTrig = /create\s+(?:or\s+replace\s+)?trigger\s+([a-zA-Z0-9_".]+)/gi;
  for (const m of src.matchAll(reTrig)) {
    info.triggers.push({ name: normalizeIdent(m[1]), snippet: snippetAround(src, m.index).slice(0, 200) });
  }

  return info;
}

async function main() {
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });

  let migFiles = [];
  try {
    const entries = await fs.readdir(MIG_ROOT, { withFileTypes: true });
    migFiles = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".sql"))
      .map((e) => path.join(MIG_ROOT, e.name));
  } catch (err) {
    if (err && err.code === "ENOENT") {
      console.error(`Migrations directory not found: ${MIG_ROOT}`);
      process.exit(1);
    }
    throw err;
  }

  /** @type {MigrationInfo[]} */
  const infos = [];
  for (const f of migFiles) {
    infos.push(await parseMigration(f));
  }
  // Sort by (numeric prefix if any, else lexicographic)
  infos.sort((a, b) => {
    if (a.number != null && b.number != null) return a.number - b.number;
    if (a.number != null) return -1;
    if (b.number != null) return 1;
    return a.file.localeCompare(b.file);
  });

  // Table inventory: table -> Array<{migration, kind}>
  /** @type {Map<string,Array<{migration:string,kind:string}>>} */
  const tables = new Map();
  for (const info of infos) {
    for (const t of info.createTables) {
      if (!tables.has(t.name)) tables.set(t.name, []);
      tables.get(t.name).push({ migration: info.file, kind: "CREATE" });
    }
    for (const t of info.alterTables) {
      if (!tables.has(t.name)) tables.set(t.name, []);
      tables.get(t.name).push({ migration: info.file, kind: "ALTER" });
    }
    for (const t of info.dropTables) {
      if (!tables.has(t.name)) tables.set(t.name, []);
      tables.get(t.name).push({ migration: info.file, kind: "DROP" });
    }
  }

  // Policy inventory
  /** @type {Array<{name:string,table:string|null,migration:string}>} */
  const policies = [];
  for (const info of infos) {
    for (const p of info.policies) {
      policies.push({ name: p.name, table: p.table, migration: info.file });
    }
  }

  const numbered = infos.filter((i) => i.number != null);
  const highest = numbered.length ? Math.max(...numbered.map((i) => i.number)) : null;
  const proposals = infos.filter((i) => i.proposal);

  // Per-month counts if the filename encodes a date.
  /** @type {Record<string,number>} */
  const perMonth = {};
  for (const info of infos) {
    const m = path.basename(info.file).match(/(20\d{2})[-_]?(\d{2})[-_]?\d{0,2}/);
    if (m) {
      const key = `${m[1]}-${m[2]}`;
      perMonth[key] = (perMonth[key] || 0) + 1;
    }
  }

  const lines = [];
  lines.push("# Schema Snapshot");
  lines.push("");
  lines.push("> Auto-generated by `npm run map:schema` (or `node scripts/build-schema-snapshot.mjs`).");
  lines.push("> Do not edit by hand — edits will be overwritten. Sealed 2026-11-23.");
  lines.push("");
  lines.push("## Overview");
  lines.push("");
  lines.push(`- Total migration files: **${infos.length}**`);
  lines.push(`- Numbered migrations: **${numbered.length}** (highest: ${highest ?? "n/a"})`);
  lines.push(`- Proposals / drafts (\`P-*\`, \`999*\`, \`PROPOSAL*\`): **${proposals.length}**`);
  lines.push(`- Distinct tables touched: **${tables.size}**`);
  lines.push(`- Policies defined: **${policies.length}**`);
  lines.push("");
  const monthKeys = Object.keys(perMonth).sort();
  if (monthKeys.length) {
    lines.push("### Datestamped migrations per month");
    lines.push("");
    lines.push("| Month | Count |");
    lines.push("|---|---|");
    for (const k of monthKeys) lines.push(`| ${k} | ${perMonth[k]} |`);
    lines.push("");
  }

  lines.push("## Table inventory");
  lines.push("");
  lines.push("| Table | CREATE migrations | ALTER migrations | DROP migrations |");
  lines.push("|---|---|---|---|");
  for (const name of Array.from(tables.keys()).sort()) {
    const entries = tables.get(name);
    const creates = entries.filter((e) => e.kind === "CREATE").map((e) => path.basename(e.migration));
    const alters = entries.filter((e) => e.kind === "ALTER").map((e) => path.basename(e.migration));
    const drops = entries.filter((e) => e.kind === "DROP").map((e) => path.basename(e.migration));
    const fmt = (arr) => (arr.length === 0 ? "—" : arr.length <= 6 ? arr.join(", ") : `${arr.slice(0, 6).join(", ")} … +${arr.length - 6}`);
    lines.push(`| \`${name}\` | ${fmt(creates)} | ${fmt(alters)} | ${fmt(drops)} |`);
  }
  lines.push("");

  lines.push("## Policy inventory");
  lines.push("");
  if (policies.length === 0) {
    lines.push("_No CREATE POLICY statements detected._");
  } else {
    lines.push("| Policy | Table | Migration |");
    lines.push("|---|---|---|");
    const sorted = [...policies].sort((a, b) => a.name.localeCompare(b.name));
    for (const p of sorted) {
      lines.push(`| \`${p.name}\` | \`${p.table ?? "—"}\` | \`${path.basename(p.migration)}\` |`);
    }
  }
  lines.push("");

  lines.push("## Per-migration detail");
  lines.push("");
  for (const info of infos) {
    if (info.createTables.length + info.alterTables.length + info.dropTables.length + info.indexes.length + info.policies.length + info.functions.length + info.triggers.length === 0) continue;
    lines.push(`### \`${path.basename(info.file)}\``);
    if (info.createTables.length) lines.push(`- CREATE TABLE: ${info.createTables.map((t) => "`" + t.name + "`").join(", ")}`);
    if (info.alterTables.length) lines.push(`- ALTER TABLE: ${info.alterTables.map((t) => "`" + t.name + "`").join(", ")}`);
    if (info.dropTables.length) lines.push(`- DROP TABLE: ${info.dropTables.map((t) => "`" + t.name + "`").join(", ")}`);
    if (info.indexes.length) lines.push(`- INDEX: ${info.indexes.map((t) => "`" + t.name + "`").join(", ")}`);
    if (info.policies.length) lines.push(`- POLICY: ${info.policies.map((t) => "`" + t.name + "`").join(", ")}`);
    if (info.functions.length) lines.push(`- FUNCTION: ${info.functions.map((t) => "`" + t.name + "`").join(", ")}`);
    if (info.triggers.length) lines.push(`- TRIGGER: ${info.triggers.map((t) => "`" + t.name + "`").join(", ")}`);
    lines.push("");
  }

  lines.push("## WIP / proposals");
  lines.push("");
  if (proposals.length === 0) {
    lines.push("_No proposal / WIP migrations detected._");
  } else {
    for (const p of proposals) lines.push(`- \`${p.file}\``);
  }
  lines.push("");

  await fs.writeFile(OUT_FILE, lines.join("\n"), "utf8");
  console.log(`schema-snapshot.md written · ${infos.length} migrations · ${tables.size} tables · ${policies.length} policies · ${lines.length} lines`);
}

main().catch((err) => {
  console.error("build-schema-snapshot failed:", err);
  process.exit(1);
});
