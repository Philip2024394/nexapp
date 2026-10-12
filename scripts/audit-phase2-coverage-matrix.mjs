#!/usr/bin/env node
// scripts/audit-phase2-coverage-matrix.mjs
//
// Phase 2 · Category coverage matrix · READ-ONLY.
//
// For every registered category tile (from CATEGORY_METADATA at
// src/lib/nex-native/directory/category-metadata.ts), produce:
//   - image_registered       true/false
//   - published_count        rows in business_directory_v carrying slug
//   - owner_operated_count   excludes POI landmarks
//   - phone_coverage_pct     % of published rows with phone
//   - website_coverage_pct   % of published rows with website_apex
//   - source_mix             which source_ids feed this slug
//   - acquisition_hint       suggested path for empty / low tiles
//   - r_s2_health_restricted true for pharmacies/dentists/opticians/
//                            home-doctor/hospitals/clinic categories
//
// No writes. Pure SELECT.

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

const R_S2_HEALTH_SLUGS = new Set([
  "pharmacies", "dentist", "dentists", "opticians", "hospitals",
  "home-doctor", "clinic", "clinics",
]);

const POI_SLUGS = new Set([
  "atm-machines", "banks", "bus-service", "train-service",
  "police-stations", "hospitals", "petrol-station",
]);

function parseRegistry() {
  const src = readFileSync("src/lib/nex-native/directory/category-metadata.ts", "utf8");
  const slugs = [];
  const re = /Object\.freeze\(\s*\{[^}]+slug:\s*"([^"]+)"[^}]+heroImageUrl:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    slugs.push({ slug: m[1], image: m[2] });
  }
  return slugs;
}

function acquisitionHint(slug, publishedCount, hasImage, phonePct, websitePct) {
  if (R_S2_HEALTH_SLUGS.has(slug)) {
    return "BLOCKED · R-S2 health carve-out · requires qualified Indonesian health-regulator review before publication.";
  }
  if (POI_SLUGS.has(slug)) {
    return "POI landmark · fine to display for area context; NOT a chat/claim target.";
  }
  if (publishedCount >= 50) {
    return "Healthy OSM yield · promote via existing walker on scheduled refresh; next step is enrichment (phone / website / products).";
  }
  if (publishedCount > 0 && publishedCount < 50) {
    return "Light OSM yield · the primary OSM tag is sparse in Indonesia · consider secondary tags OR seeded web-discovery agents.";
  }
  if (publishedCount === 0 && hasImage) {
    return "Image registered but zero listings · OSM has no matching tag in Indonesia · needs evidence-based web-discovery (per-domain adapters, robots.txt, legal review) OR owner-signup seeding.";
  }
  return "Unexpected state · investigate.";
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL unset");
  verifyTarget(url);
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const slugs = parseRegistry();
  console.log(`parsed ${slugs.length} CATEGORY_METADATA entries\n`);

  const matrix = [];
  for (const { slug, image } of slugs) {
    const pub = await client.query(
      `SELECT COUNT(*)::int AS n FROM nex.business_directory_v WHERE $1 = ANY(category_ids)`,
      [slug],
    );
    const phoneWeb = await client.query(
      `SELECT
         SUM(CASE WHEN phone_e164 IS NOT NULL AND phone_e164 != '' THEN 1 ELSE 0 END)::int AS phones,
         SUM(CASE WHEN website_apex IS NOT NULL AND website_apex != '' THEN 1 ELSE 0 END)::int AS websites
         FROM nex.business_directory_v WHERE $1 = ANY(category_ids)`,
      [slug],
    );
    const srcMix = await client.query(
      `SELECT be.source_id, COUNT(DISTINCT bc.canonical_business_id)::int AS n
         FROM nex.business_canonical bc
         JOIN nex.business_evidence be ON be.canonical_business_id = bc.canonical_business_id
        WHERE $1 = ANY(bc.category_ids)
        GROUP BY be.source_id ORDER BY n DESC`,
      [slug],
    );
    const published = pub.rows[0].n;
    const phones = phoneWeb.rows[0].phones ?? 0;
    const websites = phoneWeb.rows[0].websites ?? 0;
    const phonePct = published > 0 ? Math.round((100 * phones) / published) : 0;
    const websitePct = published > 0 ? Math.round((100 * websites) / published) : 0;
    const sources = srcMix.rows.map((r) => `${r.source_id}:${r.n}`).join(" ") || "—";
    const poi = POI_SLUGS.has(slug);
    const health = R_S2_HEALTH_SLUGS.has(slug);
    matrix.push({
      slug,
      image_registered: true,
      published,
      phone_pct: phonePct,
      website_pct: websitePct,
      kind: poi ? "POI" : health ? "HEALTH" : "BUSINESS",
      sources,
      acquisition_hint: acquisitionHint(slug, published, true, phonePct, websitePct),
    });
  }

  // Sort: zero-count tiles first (biggest acquisition gap), then by
  // published count desc within non-zero.
  matrix.sort((a, b) => {
    if (a.published === 0 && b.published !== 0) return -1;
    if (a.published !== 0 && b.published === 0) return 1;
    return b.published - a.published;
  });

  // Buckets for summary
  const zero = matrix.filter((r) => r.published === 0);
  const low = matrix.filter((r) => r.published > 0 && r.published < 50);
  const mid = matrix.filter((r) => r.published >= 50 && r.published < 1000);
  const high = matrix.filter((r) => r.published >= 1000);

  console.log("CATEGORY MATRIX · summary buckets:");
  console.table([
    { bucket: "zero_listings", slugs: zero.length },
    { bucket: "low_1_to_49", slugs: low.length },
    { bucket: "mid_50_to_999", slugs: mid.length },
    { bucket: "high_1000_plus", slugs: high.length },
    { bucket: "TOTAL", slugs: matrix.length },
  ]);

  console.log("\n═══ ZERO-COUNT TILES (acquisition gaps) ═══");
  console.table(zero.map((r) => ({ slug: r.slug, kind: r.kind, acquisition_hint: r.acquisition_hint })));

  console.log("\n═══ LOW-COUNT TILES (1-49 listings) ═══");
  console.table(low.map((r) => ({
    slug: r.slug, published: r.published, kind: r.kind,
    phone_pct: r.phone_pct, website_pct: r.website_pct, sources: r.sources,
  })));

  console.log("\n═══ MID-COUNT TILES (50-999 listings) ═══");
  console.table(mid.map((r) => ({
    slug: r.slug, published: r.published, kind: r.kind,
    phone_pct: r.phone_pct, website_pct: r.website_pct,
  })));

  console.log("\n═══ HIGH-COUNT TILES (1000+ listings) ═══");
  console.table(high.map((r) => ({
    slug: r.slug, published: r.published, kind: r.kind,
    phone_pct: r.phone_pct, website_pct: r.website_pct,
  })));

  await client.end();
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
