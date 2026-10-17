#!/usr/bin/env node
// scripts/verify-icu.mjs
//
// Pre-test ICU verification · asserts that the deployed runtime's
// Intl.Segmenter and Unicode property matcher behave as the v12
// handle-normalise fixtures expect.
//
// Run before the test suite. On runtime drift (Node/ICU bump,
// Vercel runtime change), this script fails fast with a precise diff
// instead of leaving the actual tests to produce confusing failures.
//
// Usage:   node scripts/verify-icu.mjs
// Exit 0 on success, 1 on drift.

import { POSITIVE_FIXTURES } from "../src/lib/nex-native/__tests__/handle-normalise.fixtures.ts";

const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
function graphemes(s) {
  const out = [];
  for (const { segment } of seg.segment(s)) out.push(segment);
  return out;
}
function cpArray(s) {
  return [...s].map(
    (c) => "U+" + c.codePointAt(0).toString(16).padStart(4, "0").toUpperCase(),
  );
}

let failures = 0;

for (const f of POSITIVE_FIXTURES) {
  // Code-point annotation self-check
  const actualCps = cpArray(f.name);
  const expectedCps = [...f.codepoints];
  if (
    actualCps.length !== expectedCps.length ||
    actualCps.some((v, i) => v !== expectedCps[i])
  ) {
    console.error(`FAIL · ${f.label} · code-point mismatch`);
    console.error(`  expected: ${expectedCps.join(" ")}`);
    console.error(`  actual:   ${actualCps.join(" ")}`);
    failures++;
    continue;
  }
  // Grapheme-count self-check against actual Intl.Segmenter output
  const actualG = graphemes(f.name).length;
  if (actualG !== f.expectedGraphemes) {
    console.error(`FAIL · ${f.label} · grapheme count ${actualG} != expected ${f.expectedGraphemes}`);
    failures++;
    continue;
  }
}

// Pictographic property smoke-test · a stable Unicode set.
// U+2744 SNOWFLAKE and U+2764 HEAVY BLACK HEART have been
// Extended_Pictographic since Unicode 11.0 (2018).
const ptest = /\p{Extended_Pictographic}/u;
if (!ptest.test("❄")) {
  console.error("FAIL · U+2744 SNOWFLAKE not matched by \\p{Extended_Pictographic}");
  failures++;
}
if (!ptest.test("❤")) {
  console.error("FAIL · U+2764 HEAVY BLACK HEART not matched by \\p{Extended_Pictographic}");
  failures++;
}

console.log(`Node: ${process.version} · ICU: ${process.versions.icu}`);
console.log(`${POSITIVE_FIXTURES.length} fixtures checked · ${failures} failures`);

process.exit(failures === 0 ? 0 : 1);
