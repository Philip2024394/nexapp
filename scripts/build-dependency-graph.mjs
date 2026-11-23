#!/usr/bin/env node
// Sealed 2026-11-23 · nexapp blueprint map generator
// Parses imports within src/lib/nex-native/** to build an adjacency map.
// Emits docs/map/dependency-graph.md (Mermaid + text). Read-only.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const LIB_ROOT = path.join(REPO_ROOT, "src", "lib", "nex-native");
const OUT_FILE = path.join(REPO_ROOT, "docs", "map", "dependency-graph.md");

/**
 * @param {string} dir
 * @param {RegExp} match
 * @returns {Promise<string[]>}
 */
async function walk(dir, match) {
  /** @type {string[]} */
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === "ENOENT") return out;
    throw err;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      out.push(...(await walk(full, match)));
    } else if (entry.isFile() && match.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Extract import specifiers from source. Captures:
 *  import ... from "spec";
 *  import("spec")
 *  export ... from "spec";
 * @param {string} src
 * @returns {string[]}
 */
function extractImports(src) {
  const specs = new Set();
  const re1 = /import\s+(?:[^'"`]*?\s+from\s+)?["']([^"']+)["']/g;
  const re2 = /export\s+[^'"`]*?\s+from\s+["']([^"']+)["']/g;
  const re3 = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
  let m;
  while ((m = re1.exec(src))) specs.add(m[1]);
  while ((m = re2.exec(src))) specs.add(m[1]);
  while ((m = re3.exec(src))) specs.add(m[1]);
  return Array.from(specs);
}

/**
 * Map a nex-native file to its top-level module (first directory under nex-native).
 * @param {string} absFile
 */
function moduleFor(absFile) {
  const rel = path.relative(LIB_ROOT, absFile);
  const parts = rel.split(path.sep);
  if (parts.length === 1) return `_root (${parts[0]})`;
  return parts[0];
}

/**
 * Resolve an import spec starting at fromFile. Returns absolute path or null.
 * Handles relative specs and `@/lib/nex-native/...` alias (common Next.js alias).
 * @param {string} spec
 * @param {string} fromFile
 */
async function resolveSpec(spec, fromFile) {
  if (spec.startsWith(".")) {
    const base = path.resolve(path.dirname(fromFile), spec);
    return tryResolve(base);
  }
  if (spec.startsWith("@/")) {
    const base = path.resolve(REPO_ROOT, "src", spec.slice(2));
    return tryResolve(base);
  }
  // Non-local (node_modules) — skip
  return null;
}

/**
 * Try candidate file extensions / index files.
 * @param {string} base
 */
async function tryResolve(base) {
  const candidates = [
    base + ".ts",
    base + ".tsx",
    base + ".mjs",
    base + ".js",
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.mjs"),
    path.join(base, "index.js"),
  ];
  for (const c of candidates) {
    try {
      await fs.access(c);
      return c;
    } catch {
      // continue
    }
  }
  return null;
}

/**
 * DFS to find cycles. Returns list of cycles (each as array of module names).
 * @param {Map<string,Set<string>>} graph
 */
function findCycles(graph) {
  /** @type {Set<string>} */
  const visited = new Set();
  /** @type {Set<string>} */
  const stackSet = new Set();
  /** @type {string[]} */
  const stack = [];
  /** @type {string[][]} */
  const cycles = [];
  const seen = new Set();

  function dfs(node) {
    if (stackSet.has(node)) {
      const idx = stack.indexOf(node);
      const cycle = stack.slice(idx).concat(node);
      const key = cycle.slice().sort().join("|");
      if (!seen.has(key)) {
        seen.add(key);
        cycles.push(cycle);
      }
      return;
    }
    if (visited.has(node)) return;
    stackSet.add(node);
    stack.push(node);
    const neighbors = graph.get(node) || new Set();
    for (const n of neighbors) dfs(n);
    stack.pop();
    stackSet.delete(node);
    visited.add(node);
  }

  for (const node of graph.keys()) dfs(node);
  return cycles;
}

async function main() {
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });

  const files = await walk(LIB_ROOT, /\.(ts|tsx)$/);

  // File-level adjacency (absolute paths)
  /** @type {Map<string,Set<string>>} */
  const fileGraph = new Map();
  for (const f of files) fileGraph.set(f, new Set());

  // Module-level adjacency (top-level nex-native subdirs)
  /** @type {Map<string,Set<string>>} */
  const modGraph = new Map();

  for (const f of files) {
    const text = await fs.readFile(f, "utf8");
    const specs = extractImports(text);
    for (const spec of specs) {
      const target = await resolveSpec(spec, f);
      if (!target) continue;
      // Only track edges to files inside nex-native
      const rel = path.relative(LIB_ROOT, target);
      if (rel.startsWith("..") || path.isAbsolute(rel)) continue;
      fileGraph.get(f).add(target);
      const srcMod = moduleFor(f);
      const dstMod = moduleFor(target);
      if (srcMod !== dstMod) {
        if (!modGraph.has(srcMod)) modGraph.set(srcMod, new Set());
        modGraph.get(srcMod).add(dstMod);
      }
    }
  }

  const cycles = findCycles(modGraph);

  const lines = [];
  lines.push("# Dependency Graph (`src/lib/nex-native`)");
  lines.push("");
  lines.push("> Auto-generated by `npm run map:deps` (or `node scripts/build-dependency-graph.mjs`).");
  lines.push("> Do not edit by hand — edits will be overwritten. Sealed 2026-11-23.");
  lines.push("");
  lines.push(`- Files scanned: **${files.length}**`);
  lines.push(`- Top-level modules: **${modGraph.size}**`);
  lines.push(`- Module-level edges: **${Array.from(modGraph.values()).reduce((a, s) => a + s.size, 0)}**`);
  lines.push(`- Module-level cycles detected: **${cycles.length}**`);
  lines.push("");

  lines.push("## Top-level module graph");
  lines.push("");
  lines.push("```mermaid");
  lines.push("flowchart LR");
  const mods = Array.from(new Set([...modGraph.keys(), ...Array.from(modGraph.values()).flatMap((s) => Array.from(s))])).sort();
  const idOf = (name) => "m_" + name.replace(/[^A-Za-z0-9_]/g, "_");
  for (const m of mods) {
    lines.push(`  ${idOf(m)}["${m}"]`);
  }
  for (const [src, dsts] of Array.from(modGraph.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const dst of Array.from(dsts).sort()) {
      lines.push(`  ${idOf(src)} --> ${idOf(dst)}`);
    }
  }
  lines.push("```");
  lines.push("");

  lines.push("## Module dependencies (text)");
  lines.push("");
  for (const src of Array.from(modGraph.keys()).sort()) {
    const dsts = Array.from(modGraph.get(src)).sort();
    if (dsts.length === 0) {
      lines.push(`- **${src}** depends on: _(none)_`);
    } else {
      lines.push(`- **${src}** depends on: ${dsts.map((d) => "`" + d + "`").join(", ")}`);
    }
  }
  lines.push("");

  lines.push("## Cycles");
  lines.push("");
  if (cycles.length === 0) {
    lines.push("_No module-level cycles detected._");
  } else {
    for (const c of cycles) {
      lines.push(`- ${c.map((n) => "`" + n + "`").join(" → ")}`);
    }
  }
  lines.push("");

  await fs.writeFile(OUT_FILE, lines.join("\n"), "utf8");
  console.log(`dependency-graph.md written · ${files.length} files · ${modGraph.size} modules · ${cycles.length} cycles · ${lines.length} lines`);
}

main().catch((err) => {
  console.error("build-dependency-graph failed:", err);
  process.exit(1);
});
