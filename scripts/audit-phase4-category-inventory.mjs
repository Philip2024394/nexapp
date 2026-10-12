#!/usr/bin/env node
// scripts/audit-phase4-category-inventory.mjs
//
// READ-ONLY category inventory. For every CATEGORY_METADATA entry at
// src/lib/nex-native/directory/category-metadata.ts:
//
//   - canonical slug
//   - displayed title
//   - image path on disk + whether file exists
//   - image URL in nex.category_image_library (if any)
//   - entity_type applicability (which of the 9 sealed types match)
//   - products / services applicability guess
//   - live listing count in business_directory_v
//   - alias list
//   - spelling / grammar / inconsistency flags
//   - duplicate / overlap flags (same image reused across multiple slugs,
//     clashing aliases, variant-vN entries, label-vs-slug drift)
//
// No writes. Pure SELECT + fs stat + registry parse.

import pg from "pg";
import { existsSync, statSync, readFileSync } from "node:fs";

const APPROVED_PROJECT_ID = "ijvqdvsvwtwxzcqmoqit";

function verifyTarget(url) {
  const u = new URL(url.replace(/^postgres(ql)?:\/\//, "http://"));
  const m = /^postgres\.([a-z0-9]+)$/.exec(u.username);
  if (!m || m[1] !== APPROVED_PROJECT_ID) {
    throw new Error(`REFUSED · pooler user is not sealed project '${APPROVED_PROJECT_ID}'`);
  }
}

// Entity_type guess based on slug — purely for the audit; the real
// mapping lives in the walker config + CATEGORY_METADATA.
function guessEntityType(slug) {
  const foodSlugs = [
    "fast-food","restaurants","bars","coffee-shop","bakso-soup","noodle-soup",
    "pizza","spaghetti","rice-bowl","steak","grilled-fish","meat-kebab",
    "sandwiches","kebab-house","ice-cream","cake-supplier","bread-supplier",
    "fruit-supplier","herbs-supplier",
  ];
  const accomSlugs = ["hotel","villa"];
  const retailSlugs = [
    "products","leather-products","fish-seller","shoe-seller","coat-seller",
    "handbag-seller","baby-clothes","vitamins","make-up","pet-supplies",
    "pets-supplier","garden-supplies","home-appliances","clothes","electronic",
    "furniture","sports","pets","super-market","tobacco","tool-supplier",
    "skin-care","whitening-cream","watches-supplier","jewelry","gold",
    "home-decor","sofa-supplier","car-sales","bicycle-supplier","cotton-supplier",
    "laser-supply","staircase-supplier",
  ];
  const serviceSlugs = [
    "car-service","massage-spa","massage","nails","foot-massage","pet-grooming",
    "salons","hair-salon","barber-hair","beautician","laundry","cleaning",
    "ac-service","laptop-repair","electronic","computer-services",
    "phone-services","photographer","camera-hire","party-planner",
    "wedding-events","wedding-agents","yoga","yoga-v2","aerobics",
    "gym-weights","gym-instructor","karaoke","relax-therapy","beaches",
    "temples","mountain-hike","jeep-tours","hiking","camping","camping-v2",
    "fishing","fishing-v2","surfing","diving","watersports","boat-hire",
    "horse-riding","jetski","kids-waterworld","museum","church","mosque",
    "graveyard","shopping-mall","security","petrol-station","bars",
  ];
  const professionalSlugs = [
    "property-agent","builder","brick-layer","carpenter","plumbing",
    "lawyers","language-teacher","tour-guide","travel-agent","travel-agency",
    "maintenance","plasterer","electrician","drywaller","welder",
    "metal-fabrication","heavy-machinery","farming","gardening",
    "construction","health","education","home-doctor","dentist",
  ];
  const transportSlugs = [
    "car-taxi","bike-taxi","bike-motor-delivery","bus-service","train-service",
    "tuktuk","truck-transport","air-cargo","cargo-company","car-driver",
  ];
  const vehicleRentalSlugs = ["bike-rental","bike-rental-v2","car-rental"];
  const placeSlugs = [
    "atm-machines","banks","police-stations","hospitals","government",
    "currency-exchange","post-office","storage",
  ];

  const buckets = [];
  if (foodSlugs.includes(slug)) buckets.push("food");
  if (accomSlugs.includes(slug)) buckets.push("accommodation");
  if (retailSlugs.includes(slug)) buckets.push("marketplace_seller");
  if (serviceSlugs.includes(slug)) buckets.push("service");
  if (professionalSlugs.includes(slug)) buckets.push("professional");
  if (transportSlugs.includes(slug)) buckets.push("transport_operator");
  if (vehicleRentalSlugs.includes(slug)) buckets.push("vehicle_rental");
  if (placeSlugs.includes(slug)) buckets.push("place");
  return buckets.length === 0 ? ["unknown"] : buckets;
}

function offersGuess(slug, entityTypes) {
  if (entityTypes.includes("marketplace_seller")) return "products";
  if (entityTypes.includes("accommodation")) return "services";
  if (entityTypes.includes("food")) return "both";
  if (entityTypes.includes("service") || entityTypes.includes("professional") || entityTypes.includes("vehicle_rental") || entityTypes.includes("transport_operator")) {
    return "services";
  }
  if (entityTypes.includes("place")) return "none";
  return "unknown";
}

function parseRegistry() {
  const src = readFileSync("src/lib/nex-native/directory/category-metadata.ts", "utf8");
  const entries = [];
  // The file wraps all entries in one outer Object.freeze. We want ONLY
  // the inner per-category blocks. Each starts with a key followed by
  // `: Object.freeze({` — the key is either an identifier (hotel) or a
  // double-quoted string ("fast-food"). Match that opener, then
  // brace-walk from the `(` to find the balanced close.
  const openerRe = /(?:^|\n)\s*(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))\s*:\s*Object\.freeze\(\{/g;
  const blocks = [];
  let m;
  while ((m = openerRe.exec(src)) !== null) {
    const key = m[1] ?? m[2];
    if (key === "CATEGORY_METADATA") continue; // outer wrapper, skip
    const openIdx = openerRe.lastIndex - 1; // position of the '{' after Object.freeze(
    let depth = 1;
    let j = openIdx + 1;
    while (j < src.length && depth > 0) {
      const c = src[j];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      j++;
    }
    blocks.push({ key, body: src.slice(openIdx, j) });
  }
  for (const { key, body } of blocks) {
    const slug = /slug:\s*"([^"]+)"/.exec(body)?.[1] ?? key;
    const title = /title:\s*"([^"]+)"/.exec(body)?.[1] ?? "";
    const heroImageUrl = /heroImageUrl:\s*"([^"]+)"/.exec(body)?.[1] ?? "";
    const description = /description:\s*\n?\s*"([^"]+)"/.exec(body)?.[1] ?? "";
    const altText = /altText:\s*"([^"]+)"/.exec(body)?.[1] ?? "";
    const aliasesMatch = /aliases:\s*\[([^\]]+)\]/.exec(body);
    const aliases = [];
    if (aliasesMatch) {
      const re = /"([^"]+)"/g;
      let am;
      while ((am = re.exec(aliasesMatch[1])) !== null) aliases.push(am[1]);
    }
    entries.push({ slug, title, heroImageUrl, description, altText, aliases });
  }
  return entries;
}

function spellingFlags(slug, title) {
  const flags = [];
  // Common typos that leaked in from the raw owner notes
  const typoPatterns = [
    [/noondle/i, "noondle → noodle"],
    [/spgettie/i, "spgettie → spaghetti"],
    [/flowerist/i, "flowerist → florist"],
    [/matiance/i, "matiance → maintenance"],
    [/lanudry/i, "lanudry → laundry"],
    [/kebebe/i, "kebebe → kebab (owner source note typo)"],
    [/museium/i, "museium → museum (owner source note typo)"],
    [/graceyard/i, "graceyard → graveyard (owner source note typo)"],
    [/arobick/i, "arobick → aerobic (owner source note typo)"],
    [/jewerly/i, "jewerly → jewelry (owner source note typo)"],
    [/supplyer/i, "supplyer → supplier (owner source note typo)"],
    [/bickle/i, "bickle → bicycle (owner source note typo)"],
    [/dentice/i, "dentice → dentist (owner source note typo)"],
    [/diveing/i, "diveing → diving (owner source note typo)"],
    [/hikeing/i, "hikeing → hiking (owner source note typo)"],
    [/rideing/i, "rideing → riding (owner source note typo)"],
    [/tabaco/i, "tabaco → tobacco (owner source note typo)"],
    [/karoke/i, "karoke → karaoke (owner source note typo)"],
    [/jetskie/i, "jetskie → jetski (owner source note typo)"],
    [/instructure/i, "instructure → instructor (owner source note typo)"],
  ];
  for (const [re, msg] of typoPatterns) {
    if (re.test(slug) || re.test(title)) flags.push(msg);
  }
  // Slug-vs-title drift examples
  if (slug === "jewelry" && !title.toLowerCase().startsWith("jewel")) flags.push(`slug=${slug} title=${title} · mismatch`);
  // "-v2" suffix is an intentional variant marker, not a bug — note it
  if (slug.endsWith("-v2")) flags.push(`variant marker '-v2' (duplicate image for the same canonical category)`);
  return flags;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL unset");
  verifyTarget(url);
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const entries = parseRegistry();
  console.log(`parsed ${entries.length} CATEGORY_METADATA entries\n`);

  // Index by image path to detect reused imagery
  const imageIndex = new Map();
  for (const e of entries) {
    const list = imageIndex.get(e.heroImageUrl) ?? [];
    list.push(e.slug);
    imageIndex.set(e.heroImageUrl, list);
  }

  const inventory = [];
  for (const e of entries) {
    // File-system check
    const fsPath = `public${e.heroImageUrl}`;
    const imageFileExists = existsSync(fsPath);
    const imageFileSize = imageFileExists ? statSync(fsPath).size : 0;

    // Library row count
    const libRows = await client.query(
      `SELECT COUNT(*)::int AS n FROM nex.category_image_library WHERE category_slug = $1 AND active`,
      [e.slug],
    );

    // Directory listing count for this slug (as a category_ids entry)
    const dirRows = await client.query(
      `SELECT COUNT(*)::int AS n FROM nex.business_directory_v WHERE $1 = ANY(category_ids)`,
      [e.slug],
    );

    // Alias collision: are any of this entry's aliases ALSO a slug of
    // another entry?
    const aliasCollisions = e.aliases.filter((a) =>
      entries.some((other) => other.slug !== e.slug && other.slug === a),
    );

    // Shared image detection (same heroImageUrl declared on 2+ entries)
    const sharedWith = (imageIndex.get(e.heroImageUrl) ?? []).filter((s) => s !== e.slug);

    const types = guessEntityType(e.slug);
    inventory.push({
      slug: e.slug,
      title: e.title,
      image_path: e.heroImageUrl,
      image_file_bytes: imageFileExists ? imageFileSize : "MISSING",
      library_rows: libRows.rows[0].n,
      directory_count: dirRows.rows[0].n,
      entity_types: types.join("+"),
      offers: offersGuess(e.slug, types),
      aliases_count: e.aliases.length,
      alias_collisions: aliasCollisions.join(","),
      shared_image_with: sharedWith.join(","),
      flags: spellingFlags(e.slug, e.title).join(" | "),
    });
  }

  // Summary buckets
  const missingImage = inventory.filter((r) => r.image_file_bytes === "MISSING");
  const unknownType = inventory.filter((r) => r.entity_types === "unknown");
  const flaggedSpelling = inventory.filter((r) => r.flags.length > 0 && !r.flags.includes("variant marker"));
  const variantMarkers = inventory.filter((r) => r.flags.includes("variant marker"));
  const sharedImages = inventory.filter((r) => r.shared_image_with.length > 0);
  const aliasCollides = inventory.filter((r) => r.alias_collisions.length > 0);
  const noLibraryRow = inventory.filter((r) => r.library_rows === 0);

  console.log("INVENTORY SUMMARY");
  console.table([
    { bucket: "total entries", n: inventory.length },
    { bucket: "image file MISSING on disk", n: missingImage.length },
    { bucket: "no library row (resolver would miss)", n: noLibraryRow.length },
    { bucket: "entity_type unknown (gap in guesser or truly new)", n: unknownType.length },
    { bucket: "spelling / grammar flags", n: flaggedSpelling.length },
    { bucket: "intentional '-v2' variant markers", n: variantMarkers.length },
    { bucket: "shared image reused across 2+ slugs", n: sharedImages.length },
    { bucket: "alias collides with another entry's slug", n: aliasCollides.length },
  ]);

  if (missingImage.length) {
    console.log("\n═══ MISSING IMAGE FILES ═══");
    console.table(missingImage.map((r) => ({ slug: r.slug, image_path: r.image_path })));
  }
  if (unknownType.length) {
    console.log("\n═══ ENTITY_TYPE UNKNOWN ═══");
    console.table(unknownType.map((r) => ({ slug: r.slug, title: r.title })));
  }
  if (flaggedSpelling.length) {
    console.log("\n═══ SPELLING / GRAMMAR FLAGS ═══");
    console.table(flaggedSpelling.map((r) => ({ slug: r.slug, title: r.title, flags: r.flags })));
  }
  if (sharedImages.length) {
    console.log("\n═══ SHARED IMAGES (same file on >1 slug) ═══");
    console.table(sharedImages.map((r) => ({ slug: r.slug, image_path: r.image_path, shared_with: r.shared_image_with })));
  }
  if (aliasCollides.length) {
    console.log("\n═══ ALIAS COLLISIONS (alias is another entry's slug) ═══");
    console.table(aliasCollides.map((r) => ({ slug: r.slug, collides_with: r.alias_collisions })));
  }
  if (noLibraryRow.length) {
    console.log("\n═══ NO LIBRARY ROW (resolver Tier 1/2 would miss unless entity_type Tier-3 catches) ═══");
    console.table(noLibraryRow.map((r) => ({ slug: r.slug, title: r.title, entity_types: r.entity_types })));
  }

  // Full inventory CSV-style dump at the end for Phase deliverable
  console.log("\n═══ FULL INVENTORY ═══");
  console.log("slug,title,image_bytes,library_rows,directory_count,entity_types,offers,aliases,shared_image_with,flags");
  for (const r of inventory) {
    const safe = (s) => String(s ?? "").replace(/,/g, " ");
    console.log(
      [
        r.slug, safe(r.title), r.image_file_bytes, r.library_rows, r.directory_count,
        r.entity_types, r.offers, r.aliases_count,
        safe(r.shared_image_with), safe(r.flags),
      ].join(","),
    );
  }

  await client.end();
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
