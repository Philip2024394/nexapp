#!/usr/bin/env node
// scripts/audit-stageA-category-mapping.mjs
//
// Stage A · propose a reversible old-slug → new-slug mapping for the
// 11 alias collisions and 4 "-v2" variant entries flagged in Stage 0.
//
// For every slug in the proposed mapping, measure:
//   · live rows in nex.business_canonical.category_ids
//   · rows in nex.category_image_library
//   · rows in nex_business.profile->'primary'->>'category' (owner side)
//   · what the new slug's current count is (so the merge target is
//     accurate)
//
// Produces logs/stage-ab-prep/stageA-category-mapping-2026-10-13.json
// as the authoritative before-table. ZERO writes.

import pg from "pg";
import { writeFileSync, mkdirSync } from "node:fs";

const APPROVED_PROJECT_ID = "ijvqdvsvwtwxzcqmoqit";
function verifyTarget(url) {
  const u = new URL(url.replace(/^postgres(ql)?:\/\//, "http://"));
  const m = /^postgres\.([a-z0-9]+)$/.exec(u.username);
  if (!m || m[1] !== APPROVED_PROJECT_ID) {
    throw new Error(`REFUSED · pooler user is not sealed project '${APPROVED_PROJECT_ID}'`);
  }
}

// ──────────────────────────────────────────────────────────────────────
// The proposed mapping. Each entry is a SAFE RENAME:
//   from_slug → to_slug (semantic winner)
// kind:
//   "variant"     — "-v2" duplicate image for the SAME category;
//                   collapse into the canonical slug and keep the
//                   image as a second library row with a variant_tag
//                   so the deterministic resolver can rotate between
//                   them.
//   "alias-merge" — two separately registered slugs that mean the
//                   same thing; merge into the semantic winner.
//   "alias-split" — currently share an alias collision but mean
//                   DIFFERENT things in public copy; keep both slugs
//                   but drop the collision alias.
//
// NONE of these are executed. This file is a proposal. The actual
// migration (when authorised) must happen in a transaction with the
// before/after measurement script re-run.
// ──────────────────────────────────────────────────────────────────────
const PROPOSED_MAPPING = [
  { from: "yoga-v2",           to: "yoga",           kind: "variant",     reason: "duplicate image for the same yoga category · keep as library variant" },
  { from: "camping-v2",        to: "camping",        kind: "variant",     reason: "duplicate image for the same camping category" },
  { from: "fishing-v2",        to: "fishing",        kind: "variant",     reason: "duplicate image for the same fishing category" },
  { from: "bike-rental-v2",    to: "bike-rental",    kind: "variant",     reason: "duplicate image for the same bike-rental category" },

  { from: "coat-seller",       to: "clothes",        kind: "alias-merge", reason: "coat-seller is a sub-set of shop=clothes OSM mapping · merge to clothes" },
  { from: "kebab-house",       to: "meat-kebab",     kind: "alias-merge", reason: "kebab-house and meat-kebab both read as kebab outlets · merge" },
  { from: "wedding-events",    to: "wedding-agents", kind: "alias-merge", reason: "same business type · merge to wedding-agents" },
  { from: "pets-supplier",     to: "pet-supplies",   kind: "alias-merge", reason: "same business type · merge to pet-supplies" },

  // alias-splits · keep both slugs, drop the specific alias that
  // currently collides. These are documented so the slug validator
  // (next deliverable) can flag the aliases that must be removed from
  // CATEGORY_METADATA.
  { from: "ALIAS_REMOVE·health·dentist",                    to: "(drop alias only)", kind: "alias-split", reason: "health and dentist are distinct · drop 'dentist' from health.aliases" },
  { from: "ALIAS_REMOVE·travel-agency·tour-guide",          to: "(drop alias only)", kind: "alias-split", reason: "travel-agency and tour-guide are distinct roles · drop 'tour-guide' from travel-agency.aliases" },
  { from: "ALIAS_REMOVE·massage·massage-spa",               to: "(drop alias only)", kind: "alias-split", reason: "massage (practitioner) and massage-spa (venue) differ · drop 'massage-spa' from massage.aliases" },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL unset");
  verifyTarget(url);
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  console.log("Stage A · category mapping · READ-ONLY · " + new Date().toISOString());
  console.log("project: " + APPROVED_PROJECT_ID);

  const results = [];
  for (const row of PROPOSED_MAPPING) {
    if (row.kind === "alias-split") {
      results.push({ ...row, note: "no row movement · drop alias in CATEGORY_METADATA only" });
      continue;
    }
    const canonicalFrom = (await client.query(
      "SELECT COUNT(*)::int AS n FROM nex.business_canonical WHERE $1 = ANY(category_ids)",
      [row.from],
    )).rows[0].n;
    const canonicalTo = (await client.query(
      "SELECT COUNT(*)::int AS n FROM nex.business_canonical WHERE $1 = ANY(category_ids)",
      [row.to],
    )).rows[0].n;
    const libFrom = (await client.query(
      "SELECT COUNT(*)::int AS n FROM nex.category_image_library WHERE category_slug = $1",
      [row.from],
    )).rows[0].n;
    const libTo = (await client.query(
      "SELECT COUNT(*)::int AS n FROM nex.category_image_library WHERE category_slug = $1",
      [row.to],
    )).rows[0].n;
    const ownerFrom = (await client.query(
      "SELECT COUNT(*)::int AS n FROM nex_business WHERE profile->'primary'->>'category' = $1",
      [row.from],
    )).rows[0].n;
    const ownerTo = (await client.query(
      "SELECT COUNT(*)::int AS n FROM nex_business WHERE profile->'primary'->>'category' = $1",
      [row.to],
    )).rows[0].n;

    results.push({
      ...row,
      before: {
        canonical_rows_with_from_slug: canonicalFrom,
        canonical_rows_with_to_slug: canonicalTo,
        library_rows_from: libFrom,
        library_rows_to: libTo,
        owner_profile_from: ownerFrom,
        owner_profile_to: ownerTo,
      },
      expected_after: {
        canonical_rows_with_from_slug: 0, // after array_replace
        canonical_rows_with_to_slug: canonicalFrom + canonicalTo,
        library_rows_from: row.kind === "variant" ? libFrom : 0,
        library_rows_to: libTo + (row.kind === "variant" ? 0 : libFrom),
        owner_profile_from: 0,
        owner_profile_to: ownerFrom + ownerTo,
      },
    });
  }

  // Build the complete category_ids distribution so a later apply can
  // regression-check against a known-good snapshot.
  const dist = await client.query(`
    SELECT unnest(category_ids) AS slug, COUNT(*)::int AS n
      FROM nex.business_canonical
     GROUP BY slug
     ORDER BY slug
  `);

  console.log("\nProposed mapping (before counts):");
  for (const r of results) {
    const b = r.before ?? {};
    console.log(
      `  ${r.kind.padEnd(12)}  ${r.from.padEnd(32)} → ${r.to.padEnd(20)} canonical:${b.canonical_rows_with_from_slug ?? "·"} lib:${b.library_rows_from ?? "·"} owner:${b.owner_profile_from ?? "·"}`,
    );
  }

  mkdirSync("logs/stage-ab-prep", { recursive: true });
  const outPath = "logs/stage-ab-prep/stageA-category-mapping-2026-10-13.json";
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        run_timestamp: new Date().toISOString(),
        project_id: APPROVED_PROJECT_ID,
        mapping: results,
        full_canonical_category_distribution: dist.rows,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log("\n→ wrote full mapping proposal to " + outPath);

  await client.end();
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
