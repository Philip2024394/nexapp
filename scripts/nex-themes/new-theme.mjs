#!/usr/bin/env node
// scripts/nex-themes/new-theme.mjs
//
// NEX Theme Production · Phase A2 · CLI entry.
// --------------------------------------------------------------------------
// Owner-authorised 2026-10-19. Isolated from production rendering.
//
// Usage:
//   node scripts/nex-themes/new-theme.mjs \
//     --name "Pink Dream" \
//     --category teddy \
//     --intro ./assets/intro.mp4 \
//     --wallpaper ./assets/bg.png
//
//   npm run nex:theme:new -- --help
//
// Honesty invariants (also see sibling modules):
//   · Writes ONLY to scripts/nex-themes/generated/<slug>/. Never touches
//     src/app/nex-native/chat-standard/packages/.
//   · Refuses to overwrite an existing generated theme · reports clearly.
//   · Prints a report with every validation gate explicitly labelled
//     "pending" (Phase A3). Never claims the theme is production-ready.
//   · If palette extraction fails for any input, reports the failure and
//     exits non-zero rather than fabricating a palette.

import { parseArgs } from "node:util";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import {
  extractDominantColours,
  extractFrameFromVideo,
  deriveTokensFromColours,
  deriveColourSystemFromTokens,
  analyseWallpaperLuma,
} from "./extract-palette.mjs";
import { emitPackageFile } from "./generate-package.mjs";
import {
  buildValidationReport,
  formatReportForConsole,
} from "./validate-theme.mjs";
import { runAllGates } from "./gates.mjs";
import { writePreviewCard } from "./preview-card.mjs";

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v"];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

async function main() {
  const parsed = parseCliArgs();
  if (parsed.help) {
    printHelp();
    process.exit(0);
  }

  const { name, category, intro, wallpaper, slug, accent, dryRun, noVideo } =
    parsed;

  for (const [k, v] of Object.entries({ name, category, intro, wallpaper })) {
    if (!v) {
      console.error(`error · required flag --${k} missing`);
      console.error("");
      printHelp();
      process.exit(2);
    }
  }

  const resolvedSlug = slug ?? slugify(name);
  const projectRoot = path.resolve(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..", ".."));
  const outputDir = path.join(projectRoot, "scripts", "nex-themes", "generated", resolvedSlug);

  console.log(`\n→ NEX Theme Production · Phase A2`);
  console.log(`  slug · ${resolvedSlug}`);
  console.log(`  staging dir · ${outputDir}`);

  await fs.mkdir(outputDir, { recursive: true });

  const introAbs = path.resolve(intro);
  const wallpaperAbs = path.resolve(wallpaper);

  // 1 · intro extraction (video → frame → palette · or direct image)
  let introColours = [];
  let introSampledFromFrame = null;
  const introExt = path.extname(introAbs).toLowerCase();
  const isVideo = VIDEO_EXTENSIONS.includes(introExt);

  if (isVideo && !noVideo) {
    const framePath = path.join(outputDir, "intro-frame.jpg");
    try {
      await extractFrameFromVideo(introAbs, framePath);
      introSampledFromFrame = framePath;
      introColours = await extractDominantColours(framePath);
    } catch (err) {
      console.error(`\n❌ intro video frame extraction failed: ${err.message}`);
      console.error(`   supply --intro as an image, or pass --no-video to skip`);
      process.exit(3);
    }
  } else if (IMAGE_EXTENSIONS.includes(introExt)) {
    introColours = await extractDominantColours(introAbs);
  } else if (noVideo) {
    console.error(`\n❌ --no-video set but --intro extension "${introExt}" is not a known image type`);
    process.exit(3);
  } else {
    console.error(`\n❌ unknown intro extension "${introExt}"`);
    process.exit(3);
  }

  // 2 · wallpaper extraction
  let wallpaperColours = [];
  const wallpaperExt = path.extname(wallpaperAbs).toLowerCase();
  if (!IMAGE_EXTENSIONS.includes(wallpaperExt)) {
    console.error(`\n❌ wallpaper extension "${wallpaperExt}" is not a known image type`);
    process.exit(3);
  }
  wallpaperColours = await extractDominantColours(wallpaperAbs);

  // 3 · token derivation · A3.3 passes wallpaper luma statistics so
  // bubble derivation can place colours outside the wallpaper's
  // dominant band.
  const overrides = accent ? { accent } : {};
  const wallpaperStats = await analyseWallpaperLuma(wallpaperAbs).catch(() => null);
  const tokens = deriveTokensFromColours(introColours, wallpaperColours, overrides, wallpaperStats);
  const colourSystem = deriveColourSystemFromTokens(tokens);

  // 4 · package emission
  const emission = await emitPackageFile({
    outputDir,
    slug: resolvedSlug,
    name,
    category,
    introPath: toPublicPath(introAbs, projectRoot),
    wallpaperPath: toPublicPath(wallpaperAbs, projectRoot),
    tokens,
    colourSystem,
    dryRun,
  });

  if (emission.overwriteBlocked) {
    console.error(`\n❌ refusing to overwrite existing file at ${emission.path}`);
    console.error(`   remove the generated/<slug>/ directory first or use a different --slug`);
    process.exit(4);
  }

  // 5 · Phase A3 · run automated quality gates
  let gateResults = null;
  if (!dryRun) {
    gateResults = await runAllGates({
      tokens,
      introPath: introAbs,
      wallpaperPath: wallpaperAbs,
      packagePath: emission.path,
      cliInputs: { name, category, slug: resolvedSlug },
    });
  }

  // 6 · validation report (includes real gate results when present)
  const report = buildValidationReport({
    inputs: {
      name,
      category,
      introPath: intro,
      wallpaperPath: wallpaper,
      accentOverride: accent ?? null,
    },
    extraction: {
      algorithm: "sharp-histogram-bucket",
      sampleSize: "64x64",
      introSampled: introColours.length > 0,
      wallpaperSampled: wallpaperColours.length > 0,
      introSampledFromFrame,
      dominantColours: dedupeByHex([...introColours, ...wallpaperColours]).slice(0, 10),
    },
    tokens,
    generation: {
      slug: resolvedSlug,
      packagePath: emission.path,
      jsonPath: emission.jsonPath,
      bytes: emission.bytes,
      status: dryRun ? "dry-run (not written)" : "generated",
    },
    gateResults,
  });

  const reportPath = path.join(outputDir, "report.json");
  let previewCardPath = null;
  if (!dryRun) {
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
    previewCardPath = await writePreviewCard({
      outputDir,
      name,
      slug: resolvedSlug,
      tokens,
      gates: gateResults,
      introFramePath: introSampledFromFrame,
      wallpaperPath: wallpaperAbs,
    });
  }

  console.log(formatReportForConsole(report));
  if (!dryRun) {
    console.log(`report written · ${reportPath}`);
    console.log(`package written · ${emission.path}`);
    console.log(`JSON sidecar written · ${emission.jsonPath}`);
    console.log(`palette card written · ${previewCardPath}`);
    console.log("");
    console.log("Next step · real-chrome Playwright previews:");
    console.log(`  1. ensure the dev server is running (npm run dev)`);
    console.log(`  2. visit /nex-native/dev/theme-preview-generated?slug=${resolvedSlug}`);
    console.log(`  3. run: npx playwright test --config=playwright.themes.config.ts`);
  } else {
    console.log(`DRY RUN · no files written`);
  }
  console.log("");
}

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      name: { type: "string" },
      category: { type: "string" },
      intro: { type: "string" },
      wallpaper: { type: "string" },
      slug: { type: "string" },
      accent: { type: "string" },
      "no-video": { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    allowPositionals: false,
    strict: true,
  });
  return {
    name: values.name,
    category: values.category,
    intro: values.intro,
    wallpaper: values.wallpaper,
    slug: values.slug,
    accent: values.accent,
    noVideo: values["no-video"],
    dryRun: values["dry-run"],
    help: values.help,
  };
}

function printHelp() {
  console.log(`
NEX Theme Production CLI · Phase A2 (owner-authorised 2026-10-19)

Usage:
  node scripts/nex-themes/new-theme.mjs \\
    --name "<theme name>" \\
    --category <category-id> \\
    --intro <path to .mp4 / .webm / .png / .jpg> \\
    --wallpaper <path to .png / .jpg> \\
    [--slug <explicit-slug>] [--accent #hex] [--no-video] [--dry-run]

Writes to:
  scripts/nex-themes/generated/<slug>/
    <slug>.package.ts    · generated ThemePackage
    report.json          · generation + pending-validation report
    intro-frame.jpg      · (if intro was a video) extracted frame

Honesty:
  · This CLI generates a theme package · it does NOT certify quality.
  · All validation gates (contrast, legibility, preview) are PENDING
    for Phase A3. The report explicitly marks the output as
    productionReady: false.
  · The generated theme is NOT registered with the live-worlds adapter.
    Promoting a generated theme into the live catalogue is a separate
    owner-authorised step.
`);
}

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toPublicPath(absPath, projectRoot) {
  const publicDir = path.join(projectRoot, "public");
  if (absPath.startsWith(publicDir)) {
    return absPath.slice(publicDir.length).replace(/\\/g, "/");
  }
  return absPath;
}

function dedupeByHex(colours) {
  const seen = new Set();
  const out = [];
  for (const c of colours) {
    if (seen.has(c.hex)) continue;
    seen.add(c.hex);
    out.push(c);
  }
  return out;
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  if (process.env.NEX_THEME_DEBUG) {
    console.error(err.stack);
  }
  process.exit(1);
});
