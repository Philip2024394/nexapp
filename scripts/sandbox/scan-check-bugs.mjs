#!/usr/bin/env node
// Scan migrations 160+ for two PG bug classes:
//   1. Table-level CHECK ( ... SELECT ... )  — subquery in CHECK (illegal)
//   2. CREATE INDEX ... WHERE ... (now()|current_timestamp)  — STABLE fn in index predicate (illegal)
// Skips RLS WITH CHECK (CREATE POLICY) and CREATE FUNCTION bodies.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "nex-supabase/migrations";
const EXCLUDE = [
  /SUPERSEDED/,
  /\.rollback\.sql$/,
  /^999_WIP_/,
  /^244_/, /^245_/, /^246_/, /^247_/, /^248_/, /^249_/, /^251_/,
];

const files = readdirSync(DIR)
  .filter((f) => /^\d{3}_.*\.sql$/.test(f))
  .filter((f) => !EXCLUDE.some((rx) => rx.test(f)))
  .filter((f) => {
    const n = parseInt(f.slice(0, 3), 10);
    return n >= 160; // only un-applied range
  })
  .sort();

for (const file of files) {
  const path = join(DIR, file);
  let src = readFileSync(path, "utf8");
  // Strip CREATE FUNCTION bodies ($$ ... $$)
  src = src.replace(/\$\$[\s\S]*?\$\$/g, "<<FUNCTION_BODY>>");
  // Strip CREATE POLICY blocks (contain WITH CHECK but not table-level CHECK)
  src = src.replace(/CREATE\s+POLICY[\s\S]*?;/gi, "<<POLICY>>");

  // Pattern 1: CHECK ( ... SELECT ... )  — balanced-paren scan
  const chkRx = /\bCHECK\s*\(/gi;
  let m;
  const hits1 = [];
  while ((m = chkRx.exec(src)) !== null) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      i++;
    }
    const body = src.slice(start, i - 1);
    if (/\bSELECT\b/i.test(body)) {
      // Line number of CHECK
      const upto = src.slice(0, m.index);
      const line = upto.split("\n").length;
      hits1.push({ line, snippet: body.slice(0, 160).replace(/\s+/g, " ") });
    }
  }

  // Pattern 2: CREATE INDEX ... WHERE ... now()|current_timestamp (not inside CREATE POLICY)
  const idxRx = /CREATE\s+(UNIQUE\s+)?INDEX[\s\S]*?;/gi;
  const hits2 = [];
  let mi;
  while ((mi = idxRx.exec(src)) !== null) {
    const stmt = mi[0];
    const whereMatch = stmt.match(/\bWHERE\b([\s\S]*?);/i);
    if (whereMatch && /\b(now\(\)|current_timestamp|clock_timestamp\(\)|statement_timestamp\(\))\b/i.test(whereMatch[1])) {
      const upto = src.slice(0, mi.index);
      const line = upto.split("\n").length;
      hits2.push({ line, snippet: stmt.slice(0, 200).replace(/\s+/g, " ") });
    }
  }

  if (hits1.length || hits2.length) {
    console.log(`\n=== ${file} ===`);
    for (const h of hits1) console.log(`  CHECK_SUBQUERY  line ${h.line}  ${h.snippet}`);
    for (const h of hits2) console.log(`  INDEX_NOW       line ${h.line}  ${h.snippet}`);
  }
}
