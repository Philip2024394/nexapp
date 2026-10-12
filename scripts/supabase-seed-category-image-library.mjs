#!/usr/bin/env node
// scripts/supabase-seed-category-image-library.mjs
//
// Seed `nex.category_image_library` from the TypeScript CATEGORY_METADATA
// registry at `src/lib/nex-native/directory/category-metadata.ts`.
//
// Why this exists:
//   The sealed category-image resolver only consumes
//   `nex.category_image_library`. The TS CATEGORY_METADATA registry is
//   the owner-curated source of truth for which image represents each
//   category tile. This script projects CATEGORY_METADATA → the DB
//   table so the directory card's representative-image slot finally
//   has rows to resolve.
//
//   Each metadata entry's `slug` and every `alias` become separate rows
//   in the library with the SAME url, so a canonical row carrying ANY
//   of those slugs in `category_ids` resolves to the registered image.
//
// Safety:
//   · Hard-gates on Supabase project id ijvqdvsvwtwxzcqmoqit.
//   · UPSERT by (category_slug, variant_tag=NULL, url) · idempotent.
//   · Only writes active=TRUE rows the resolver would honour.
//   · Does NOT delete existing library rows · if the operator has
//     curated per-category variants in DB directly, this script
//     leaves them intact.
//
// Usage:
//   node --env-file=.env.local scripts/supabase-seed-category-image-library.mjs

import pg from "pg";
import { readFileSync } from "node:fs";

const APPROVED_PROJECT_ID = "ijvqdvsvwtwxzcqmoqit";

function verifyTarget(url) {
  const u = new URL(url.replace(/^postgres(ql)?:\/\//, "http://"));
  const m = /^postgres\.([a-z0-9]+)$/.exec(u.username);
  if (!m || m[1] !== APPROVED_PROJECT_ID) {
    throw new Error(`REFUSED · pooler user is not sealed project '${APPROVED_PROJECT_ID}'`);
  }
}

// Parse CATEGORY_METADATA entries from the TS registry via regex.
// Shape per entry:
//   "<slug-or-key>": Object.freeze({
//     slug: "<slug>",
//     title: "<title>",
//     description: "<desc>",
//     heroImageUrl: "<path>",
//     altText: "<alt>",
//     aliases: ["<a>", "<b>"],  // optional
//   }),
function parseRegistry() {
  const src = readFileSync("src/lib/nex-native/directory/category-metadata.ts", "utf8");
  const entries = [];
  const entryRe = /Object\.freeze\(\s*\{([^}]+)\}\s*\)/g;
  let m;
  while ((m = entryRe.exec(src)) !== null) {
    const body = m[1];
    const slug = /slug:\s*"([^"]+)"/.exec(body)?.[1];
    const heroImageUrl = /heroImageUrl:\s*"([^"]+)"/.exec(body)?.[1];
    const altText = /altText:\s*"([^"]+)"/.exec(body)?.[1];
    if (!slug || !heroImageUrl) continue;
    const aliasesMatch = /aliases:\s*\[([^\]]+)\]/.exec(body);
    const aliases = [];
    if (aliasesMatch) {
      const inner = aliasesMatch[1];
      const re = /"([^"]+)"/g;
      let am;
      while ((am = re.exec(inner)) !== null) aliases.push(am[1]);
    }
    entries.push({ slug, heroImageUrl, altText: altText ?? null, aliases });
  }
  return entries;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL unset");
  verifyTarget(url);

  const entries = parseRegistry();
  if (entries.length === 0) throw new Error("No CATEGORY_METADATA entries parsed");
  console.log(`parsed ${entries.length} metadata entries`);

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const beforeTotal = (await client.query("SELECT COUNT(*)::int AS n FROM nex.category_image_library")).rows[0].n;
  console.log(`nex.category_image_library · before: ${beforeTotal}`);

  // Flat list of (slug, url, altText) · one row per registered slug
  // AND one row per alias (same url), so canonical rows carrying any
  // of those slugs resolve. The DB has a sealed CHECK constraint
  // `category_image_library_category_valid` that only allows
  // lowercase-letter/digit/hyphen slugs (`^([a-z][a-z0-9-]*|\*)$`) ·
  // underscore-bearing OSM-style aliases are dropped here with a note.
  const SLUG_PATTERN = /^([a-z][a-z0-9-]*|\*)$/;
  const rows = [];
  const droppedAliases = [];
  for (const e of entries) {
    rows.push({ slug: e.slug, url: e.heroImageUrl, altText: e.altText });
    for (const a of e.aliases) {
      if (!SLUG_PATTERN.test(a)) { droppedAliases.push(a); continue; }
      rows.push({ slug: a, url: e.heroImageUrl, altText: e.altText });
    }
  }
  // Deduplicate by (slug, url) in case the same alias was declared twice.
  const seen = new Set();
  const unique = [];
  for (const r of rows) {
    const k = r.slug + "|" + r.url;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(r);
  }
  console.log(`projected ${unique.length} unique (slug,url) rows · dropped ${droppedAliases.length} underscore-bearing aliases`);

  let inserted = 0;
  for (const r of unique) {
    // ON CONFLICT target depends on a unique index · we use a plain
    // check-then-insert so there is no dependency on a specific index.
    const existing = await client.query(
      "SELECT id FROM nex.category_image_library WHERE category_slug = $1 AND url = $2 AND variant_tag IS NULL",
      [r.slug, r.url],
    );
    if (existing.rowCount && existing.rowCount > 0) continue;
    await client.query(
      `INSERT INTO nex.category_image_library
         (category_slug, variant_tag, url, attribution, licence, priority, active, notes, added_by)
       VALUES ($1, NULL, $2, NULL, NULL, 100, TRUE, $3, 'scripts/supabase-seed-category-image-library.mjs · 2026-10-12')`,
      [r.slug, r.url, r.altText],
    );
    inserted++;
  }

  const afterTotal = (await client.query("SELECT COUNT(*)::int AS n FROM nex.category_image_library")).rows[0].n;
  const activeCovered = (await client.query(`
    SELECT COUNT(DISTINCT category_slug)::int AS n
      FROM nex.category_image_library
     WHERE active = TRUE
  `)).rows[0].n;

  console.log("");
  console.log(JSON.stringify({
    metadata_entries: entries.length,
    projected_rows: unique.length,
    inserted_rows: inserted,
    library_before: beforeTotal,
    library_after: afterTotal,
    distinct_slugs_covered: activeCovered,
  }, null, 2));

  await client.end();
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
