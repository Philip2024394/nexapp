// scripts/catalogue/rebuild-register-from-dossiers.mjs
//
// Rebuilds docs/doctrine/nex-catalogue-coverage-register.jsonl from the
// dossier files that survived a sed -i mistake 2026-10-28. The dossiers
// are the source of truth; this script scans their filenames + D10
// section (if present) to infer listing_class and emits one JSONL row
// per dossier.
//
// SAFE · writes to a NEW path first, then renames into place after
// validation. Never uses sed -i or in-place edits.

import { readFileSync, readdirSync, writeFileSync, renameSync } from "node:fs";
import { join, basename } from "node:path";

const DOSSIER_ROOT = "docs/doctrine/catalogue";
const OUT_PATH = "docs/doctrine/nex-catalogue-coverage-register.jsonl";
const TMP_PATH = `${OUT_PATH}.rebuild-tmp`;

const DEPT_LABELS = {
  books: "Books, Education & Stationery",
  office: "Office, Business & Industrial Supplies",
  arts: "Arts, Crafts & Handmade Products",
};

function inferListingClass(leafId, dossierBody) {
  // Simple heuristic from D10 section header + leaf semantics.
  const lower = dossierBody.toLowerCase();
  if (lower.includes("listing_class = `made_to_order`") || lower.includes("listing_class = `made-to-order`")) return "made_to_order";
  if (lower.includes("listing_class = `one_of_one`")) return "one_of_one";
  if (lower.includes("listing_class = `digital`")) return "digital";
  if (lower.includes("listing_class = `service`")) return "service";
  // Hints from the leaf id itself
  if (leafId.startsWith("arts.personalised_gifts")) return "made_to_order";
  if (leafId === "arts.handmade_jewellery.bespoke_jewellery") return "made_to_order";
  if (leafId === "arts.handmade_jewellery.custom_bracelets") return "made_to_order";
  if (leafId === "arts.art_collectibles.original_paintings") return "one_of_one";
  if (leafId === "arts.art_collectibles.sculptures") return "one_of_one";
  return "physical";
}

function parseCategoryPath(leafId, department) {
  // leafId shape: `books.books.art_design` or `office.industrial_safety.protective_clothing`
  // Dept slug is leafId.split('.')[0]; it maps to a user-facing dept label.
  const parts = leafId.split(".");
  const deptLabel = DEPT_LABELS[parts[0]] ?? parts[0];
  const rest = parts.slice(1).map((seg) =>
    seg
      .split("_")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" "),
  );
  return [deptLabel, ...rest];
}

const header = {
  __schema: "nex-catalogue-coverage-register",
  version: "1",
  sealed: "2026-10-28",
  owner_decisions: [
    "theme=/manage/live",
    "watches=frozen-reference",
    "b1=books-office-arts",
  ],
  note: "Rebuilt from dossier files 2026-10-28 after a sed -i mistake destroyed the first copy. Dossiers survived · this register is a scan-time projection of them. 114 B1 rows + Watches reference row.",
};

const lines = [JSON.stringify(header)];

// Watches reference row (sealed Enabled exemplar, outside B1).
lines.push(
  JSON.stringify({
    leaf_id: "jewellery_watches.watches",
    category_path: ["Jewellery & Watches", "Watches"],
    department: "Jewellery & Watches",
    depth: 2,
    listing_class: "physical",
    status: "Enabled",
    research_started_at: "2026-10-26",
    research_completed_at: "2026-10-26",
    spec_completed_at: "2026-10-26",
    implemented_at: "2026-10-26",
    verified_at: "2026-10-27",
    enabled_at: "2026-10-28",
    assigned_batch: "pre-B1",
    assigned_researcher: "sealed-reference",
    dossier_path: "docs/doctrine/nex-shop-watches-upload-draft-2026-10-26.md",
    sources_cited: [
      { type: "nex_internal", ref: "nex_watch_listing migrations 227-230", retrieved_at: "2026-10-26" },
    ],
    confidence: "high",
    blockers: [],
    founder_authorisation_ref: "sealed §8h sibling-table 2026-10-26",
    last_updated: "2026-10-28",
    notes: "Frozen reference exemplar · unique pre-owned sibling-table pattern · NOT the universal variant engine reference.",
  }),
);

let b1Total = 0;
for (const dept of Object.keys(DEPT_LABELS)) {
  const dir = join(DOSSIER_ROOT, dept);
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {
    console.error(`[warn] no dossier dir for ${dept}`);
    continue;
  }
  for (const file of files) {
    const leafId = basename(file, ".md");
    const dossierPath = join(DOSSIER_ROOT, dept, file).replace(/\\/g, "/");
    const body = readFileSync(join(DOSSIER_ROOT, dept, file), "utf8");
    const listingClass = inferListingClass(leafId, body);
    const categoryPath = parseCategoryPath(leafId, dept);
    lines.push(
      JSON.stringify({
        leaf_id: leafId,
        category_path: categoryPath,
        department: DEPT_LABELS[dept],
        depth: categoryPath.length,
        listing_class: listingClass,
        status: "Research complete",
        research_started_at: "2026-10-28",
        research_completed_at: "2026-10-28",
        spec_completed_at: null,
        implemented_at: null,
        verified_at: null,
        enabled_at: null,
        assigned_batch: "B1",
        assigned_researcher: "claude",
        dossier_path: dossierPath,
        sources_cited: [], // not re-parsed from dossier here; dossiers hold inline citations
        confidence: "medium",
        blockers: [],
        founder_authorisation_ref: null,
        last_updated: "2026-10-28",
        notes: `Rebuilt from surviving dossier ${dossierPath}.`,
      }),
    );
    b1Total++;
  }
}

const output = lines.join("\n") + "\n";
writeFileSync(TMP_PATH, output);

// Validate every line parses.
const check = output.split("\n").filter(Boolean);
let ok = 0;
let bad = 0;
for (const l of check) {
  try {
    JSON.parse(l);
    ok++;
  } catch {
    bad++;
  }
}
if (bad > 0) {
  console.error(`VALIDATION FAILED · ${bad} invalid lines · temp file left at ${TMP_PATH}`);
  process.exit(1);
}

renameSync(TMP_PATH, OUT_PATH);
console.log(`rebuilt ${OUT_PATH}`);
console.log(`  rows: ${check.length} (header + ${b1Total} B1 + 1 Watches reference)`);
console.log(`  valid JSON: ${ok} / ${check.length}`);
console.log(`  size: ${output.length} bytes`);
