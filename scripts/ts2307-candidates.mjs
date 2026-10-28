// Analyse TS2307 missing-module imports and classify each as:
//   · all-unused   · every symbol imported is NOT referenced elsewhere in the file.
//                    Safe candidate for Wave 2 removal · the import line alone goes.
//   · partial-use  · some symbols are referenced, others aren't · AMBIGUOUS · skip ·
//                    reporting both sets so the operator can decide (not autonomous).
//   · all-used     · every symbol IS referenced · NOT a candidate · the import is
//                    load-bearing · its missing module is a separate problem.
//   · side-effect  · `import 'x';` form · NEVER removable without owner intent.
//   · parse-failed · AST shape outside the regex supported here · skip and record.
//
// This is a Wave-2 safety gate · we only touch all-unused.

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const out = execSync("npx tsc --noEmit --pretty false 2>&1 || true", {
  encoding: "utf8",
  maxBuffer: 50 * 1024 * 1024,
});

const ts2307 = out
  .split(/\r?\n/)
  .filter((l) => l.includes("error TS2307"))
  .map((l) => {
    const m = l.match(/^(.+?)\((\d+),(\d+)\): error TS2307: Cannot find module '([^']+)'/);
    if (!m) return null;
    return { file: m[1].replace(/\\/g, "/"), line: +m[2], module: m[4] };
  })
  .filter(Boolean);

console.log("TS2307 locations:", ts2307.length);

function extractSymbols(fileLines, startLine) {
  let full = fileLines[startLine - 1] ?? "";
  let i = startLine;
  while (!full.includes(";") && i < fileLines.length && i < startLine + 20) {
    full += " " + fileLines[i];
    i++;
  }
  if (/^\s*import\s+['"]/.test(full)) return { kind: "side-effect", symbols: [], full };
  const symbols = [];
  const star = full.match(/^\s*import\s+(?:type\s+)?\*\s+as\s+(\w+)\s+from/);
  if (star) symbols.push(star[1]);
  const def = full.match(/^\s*import\s+(?:type\s+)?(\w+)\s*(?:,\s*\{|from\s+['"])/);
  if (def && !star) symbols.push(def[1]);
  const named = full.match(/\{([^}]+)\}/);
  if (named) {
    for (const seg of named[1].split(",")) {
      const t = seg.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop().trim();
      if (t) symbols.push(t);
    }
  }
  return { kind: symbols.length ? "symbol" : "parse-failed", symbols, full };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const candidates = [];
const ambiguous = [];
const skipped = [];

for (const loc of ts2307) {
  let src;
  try {
    src = readFileSync(loc.file, "utf8");
  } catch {
    skipped.push({ ...loc, reason: "cannot-read" });
    continue;
  }
  const fileLines = src.split(/\r?\n/);
  const { kind, symbols, full } = extractSymbols(fileLines, loc.line);
  if (kind === "side-effect") {
    ambiguous.push({ ...loc, reason: "side-effect-import", importText: full.trim() });
    continue;
  }
  if (kind === "parse-failed" || symbols.length === 0) {
    ambiguous.push({ ...loc, reason: "parse-failed", importText: full.trim() });
    continue;
  }

  // Reference count: strip the entire import statement region (which may span lines),
  // then search for each symbol as a whole-word match.
  const importRegion = full;
  const bodyLines = fileLines.map((ln) => (importRegion.includes(ln) && ln.trim() ? "" : ln));
  const body = bodyLines.join("\n");
  const unused = [];
  const used = [];
  for (const sym of symbols) {
    const re = new RegExp("\\b" + escapeRe(sym) + "\\b");
    if (re.test(body)) used.push(sym);
    else unused.push(sym);
  }
  if (unused.length === symbols.length) {
    candidates.push({ ...loc, importText: full.trim(), symbols, verdict: "all-unused" });
  } else if (unused.length > 0) {
    ambiguous.push({ ...loc, reason: "partial-use", importText: full.trim(), unused, used });
  } else {
    skipped.push({ ...loc, reason: "all-used", importText: full.trim(), symbols });
  }
}

console.log("all-unused candidates:", candidates.length);
console.log(
  "partial-use (needs owner intent):",
  ambiguous.filter((a) => a.reason === "partial-use").length,
);
console.log(
  "side-effect imports (skipped):",
  ambiguous.filter((a) => a.reason === "side-effect-import").length,
);
console.log(
  "parse-failed (skipped):",
  ambiguous.filter((a) => a.reason === "parse-failed").length,
);
console.log(
  "all-used (NOT dead · load-bearing imports with missing modules):",
  skipped.filter((s) => s.reason === "all-used").length,
);

writeFileSync(
  "scripts/ts2307-candidates-report.json",
  JSON.stringify({ counts: { total: ts2307.length, candidates: candidates.length, ambiguous: ambiguous.length, skipped: skipped.length }, candidates, ambiguous, skipped }, null, 2),
);
console.log("wrote scripts/ts2307-candidates-report.json");
