#!/usr/bin/env node
// scripts/audit-stageA-validator-dryrun.mjs
//
// Stage A final · dry-run the slug/alias validator against:
//   1. the current CATEGORY_METADATA (expected: 11 collisions)
//   2. the "proposed clean" projection after Stage A rename (expected: 0)
//
// We don't execute the vitest validator because the DRAFT lives in
// logs/ (not src/) and vitest's default glob wouldn't pick it up. We
// read category-metadata.ts via the same regex parser used by the
// seeder + Phase-4 audit, then apply the two guard functions
// directly. Pure logic. Zero network, zero DB, zero writes.

import { readFileSync } from "node:fs";

const SLUG_PATTERN = /^([a-z][a-z0-9-]*|\*)$/;

// Entries to be dropped by the Stage A rename apply.
const ENTRIES_TO_DROP = new Set([
  "yoga-v2",
  "camping-v2",
  "fishing-v2",
  "bike-rental-v2",
  "coat-seller",
  "kebab-house",
  "wedding-events",
  "pets-supplier",
]);

// Aliases to be dropped (keep entries, drop specific alias values).
const ALIASES_TO_DROP = {
  health:         ["dentist"],
  "travel-agency":["tour-guide"],
  massage:        ["massage-spa"],
};

function parseRegistry(filePath) {
  const src = readFileSync(filePath, "utf8");
  const entries = [];
  const openerRe = /(?:^|\n)\s*(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))\s*:\s*Object\.freeze\(\{/g;
  let m;
  while ((m = openerRe.exec(src)) !== null) {
    const key = m[1] ?? m[2];
    if (key === "CATEGORY_METADATA") continue;
    const openIdx = openerRe.lastIndex - 1;
    let depth = 1, j = openIdx + 1;
    while (j < src.length && depth > 0) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") depth--;
      j++;
    }
    const body = src.slice(openIdx, j);
    const slug = /slug:\s*"([^"]+)"/.exec(body)?.[1] ?? key;
    const aliasesMatch = /aliases:\s*\[([^\]]+)\]/.exec(body);
    const aliases = [];
    if (aliasesMatch) {
      const re = /"([^"]+)"/g;
      let am;
      while ((am = re.exec(aliasesMatch[1])) !== null) aliases.push(am[1]);
    }
    entries.push({ entryKey: key, slug, aliases });
  }
  return entries;
}

function auditEntries(entries) {
  const issues = [];
  const canonicalSlugs = new Set(entries.map((e) => e.slug));

  // Duplicate canonical slugs
  const slugCounts = new Map();
  for (const e of entries) {
    const list = slugCounts.get(e.slug) ?? [];
    list.push(e.entryKey);
    slugCounts.set(e.slug, list);
  }
  for (const [slug, keys] of slugCounts) {
    if (keys.length > 1) {
      issues.push({
        kind: "duplicate-canonical-slug",
        entryKey: keys.join(" & "),
        subject: slug,
      });
    }
  }

  for (const e of entries) {
    if (!SLUG_PATTERN.test(e.slug)) {
      issues.push({
        kind: "slug-pattern-violation",
        entryKey: e.entryKey,
        subject: e.slug,
      });
    }
    for (const alias of e.aliases) {
      if (canonicalSlugs.has(alias) && alias !== e.slug) {
        issues.push({
          kind: "alias-collides-with-canonical",
          entryKey: e.entryKey,
          subject: alias,
          detail: `alias '${alias}' on entry '${e.slug}' is the canonical slug of another entry`,
        });
      }
    }
  }
  return issues;
}

function projectClean(entries) {
  // Simulate the Stage A rename WITHOUT modifying the source file.
  // 1. Drop entries whose slug is in ENTRIES_TO_DROP.
  // 2. For every surviving entry, drop any alias listed in
  //    ALIASES_TO_DROP for that slug.
  return entries
    .filter((e) => !ENTRIES_TO_DROP.has(e.slug))
    .map((e) => ({
      ...e,
      aliases: e.aliases.filter((a) => {
        const toDrop = ALIASES_TO_DROP[e.slug] ?? [];
        return !toDrop.includes(a);
      }),
    }));
}

function printIssues(label, issues) {
  console.log(`\n═══ ${label} ═══`);
  console.log(`total issues: ${issues.length}`);
  const byKind = new Map();
  for (const i of issues) byKind.set(i.kind, (byKind.get(i.kind) ?? 0) + 1);
  for (const [k, n] of byKind) console.log(`  ${k.padEnd(32)} ${n}`);
  if (issues.length === 0) return;
  console.log("\n  details:");
  for (const i of issues) {
    console.log(
      `  · ${i.kind.padEnd(32)} ${(i.entryKey ?? "").padEnd(28)} ${i.subject}` +
        (i.detail ? ` · ${i.detail}` : ""),
    );
  }
}

const metadataPath = "src/lib/nex-native/directory/category-metadata.ts";
const entries = parseRegistry(metadataPath);
console.log(`parsed ${entries.length} CATEGORY_METADATA entries from ${metadataPath}`);

const currentIssues = auditEntries(entries);
printIssues("CURRENT metadata · expected to FAIL", currentIssues);

const cleanEntries = projectClean(entries);
console.log(`\nprojected post-rename entries: ${cleanEntries.length}`);
console.log(`  (${entries.length} − ${entries.length - cleanEntries.length} dropped = ${cleanEntries.length})`);

const cleanIssues = auditEntries(cleanEntries);
printIssues("PROJECTED clean metadata · expected to pass with 0", cleanIssues);

console.log("\n═══ summary ═══");
console.log(`current issues:   ${currentIssues.length}`);
console.log(`projected issues: ${cleanIssues.length}`);
console.log(`net reduction:    ${currentIssues.length - cleanIssues.length}`);

process.exit(cleanIssues.length === 0 ? 0 : 2);
