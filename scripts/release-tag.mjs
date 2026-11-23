#!/usr/bin/env node
/**
 * scripts/release-tag.mjs — nexapp release tagging helper
 * Sealed: 2026-11-23
 *
 * Creates an annotated git tag of shape `nexapp-vYYYYMMDD-N`, where N
 * auto-increments if the same date already has tags. Updates CHANGELOG.md
 * by promoting the `[Unreleased]` section to a new dated release section.
 *
 * SAFETY (CLAUDE.md §3, §4, §5):
 *   - Requires explicit `--confirm` and `--reason "<text>"` CLI args.
 *   - Validates branch is `release-audit-v1-2026-11-14` (default) or `main`
 *     when `--prod` is passed.
 *   - Validates the working tree is clean.
 *   - Validates the git remote is `Philip2024394/nexapp`.
 *   - Does NOT push the tag. Prints the exact `git push` command for the
 *     operator to run under separate owner authorisation.
 *
 * Usage:
 *   node scripts/release-tag.mjs --confirm --reason "Perf regression blueprint"
 *   node scripts/release-tag.mjs --confirm --reason "Production cut" --prod
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const CHANGELOG_PATH = resolve(REPO_ROOT, "CHANGELOG.md");

const EXPECTED_REMOTE_HOST = "github.com";
const EXPECTED_REMOTE_PATH = "Philip2024394/nexapp";
const DEFAULT_BRANCH = "release-audit-v1-2026-11-14";
const PROD_BRANCH = "main";

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  }).trim();
}

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { confirm: false, reason: null, prod: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--confirm") args.confirm = true;
    else if (a === "--prod") args.prod = true;
    else if (a === "--reason") {
      args.reason = argv[++i] ?? null;
    } else if (a.startsWith("--reason=")) {
      args.reason = a.slice("--reason=".length);
    } else {
      fail(`Unknown argument: ${a}`);
    }
  }
  return args;
}

function todayYYYYMMDD() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${dd}`;
}

function todayISO() {
  return todayYYYYMMDD().replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
}

function nextTagForDate(dateYYYYMMDD) {
  // List existing tags matching nexapp-v<date>-N
  let existing = "";
  try {
    existing = sh("git", ["tag", "--list", `nexapp-v${dateYYYYMMDD}-*`]);
  } catch {
    existing = "";
  }
  const nums = existing
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const m = t.match(/^nexapp-v\d{8}-(\d+)$/);
      return m ? Number(m[1]) : null;
    })
    .filter((n) => n !== null);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `nexapp-v${dateYYYYMMDD}-${next}`;
}

function validateRemote() {
  let url = "";
  try {
    url = sh("git", ["remote", "get-url", "origin"]);
  } catch {
    fail("Could not read git remote 'origin'.");
  }
  // Accept both https and ssh forms.
  const ok =
    url.includes(`${EXPECTED_REMOTE_HOST}/${EXPECTED_REMOTE_PATH}`) ||
    url.includes(`${EXPECTED_REMOTE_HOST}:${EXPECTED_REMOTE_PATH}`);
  if (!ok) {
    fail(
      `Remote 'origin' is ${url}; expected to point at ${EXPECTED_REMOTE_PATH}. ` +
        `Refusing to tag (CLAUDE.md §2).`,
    );
  }
  return url;
}

function validateBranch(prod) {
  const branch = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  const expected = prod ? PROD_BRANCH : DEFAULT_BRANCH;
  if (branch !== expected) {
    fail(
      `Current branch is '${branch}'; --prod=${prod} requires '${expected}'. ` +
        `Refusing to tag.`,
    );
  }
  return branch;
}

function validateCleanTree() {
  const status = sh("git", ["status", "--porcelain"]);
  if (status) {
    fail(
      `Working tree is not clean:\n${status}\n` +
        `Commit or stash first. Refusing to tag.`,
    );
  }
}

function promoteUnreleased(tagName, reason) {
  if (!existsSync(CHANGELOG_PATH)) {
    console.warn(`WARN: ${CHANGELOG_PATH} not found — skipping changelog update.`);
    return false;
  }
  const original = readFileSync(CHANGELOG_PATH, "utf8");
  const iso = todayISO();
  const unreleasedHeader = "## [Unreleased]";
  const idx = original.indexOf(unreleasedHeader);
  if (idx === -1) {
    console.warn(
      `WARN: no '${unreleasedHeader}' section in CHANGELOG — skipping promote.`,
    );
    return false;
  }
  // Find end of Unreleased section: next "## [" heading.
  const rest = original.slice(idx + unreleasedHeader.length);
  const nextHeadingRel = rest.search(/\n## \[/);
  const unreleasedBody =
    nextHeadingRel === -1 ? rest : rest.slice(0, nextHeadingRel);
  const trailing =
    nextHeadingRel === -1 ? "" : rest.slice(nextHeadingRel);

  const newUnreleased = `${unreleasedHeader}\n\n_Nothing yet._\n\n---\n\n`;
  const promoted =
    `## [${iso}] — ${reason}\n` +
    `\n_Tag: \`${tagName}\`_\n` +
    unreleasedBody.replace(/\n+$/, "") +
    "\n\n---\n";

  const updated =
    original.slice(0, idx) + newUnreleased + promoted + trailing;

  writeFileSync(CHANGELOG_PATH, updated, "utf8");
  return true;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.confirm) {
    fail(
      "Missing --confirm. This script never runs without explicit --confirm " +
        "(CLAUDE.md §3/§4).",
    );
  }
  if (!args.reason || !args.reason.trim()) {
    fail('Missing --reason "<text>". Provide a short release reason.');
  }

  const remote = validateRemote();
  const branch = validateBranch(args.prod);
  validateCleanTree();

  const date = todayYYYYMMDD();
  const tag = nextTagForDate(date);
  const headSha = sh("git", ["rev-parse", "HEAD"]);

  console.log("─".repeat(72));
  console.log("nexapp release-tag");
  console.log("─".repeat(72));
  console.log(`  Remote  : ${remote}`);
  console.log(`  Branch  : ${branch}`);
  console.log(`  HEAD    : ${headSha}`);
  console.log(`  Tag     : ${tag}`);
  console.log(`  Reason  : ${args.reason}`);
  console.log("─".repeat(72));

  // Promote changelog
  const promoted = promoteUnreleased(tag, args.reason);
  if (promoted) {
    console.log(`  CHANGELOG.md promoted [Unreleased] -> [${todayISO()}].`);
    console.log(
      "  NOTE: the CHANGELOG edit is unstaged — commit it as part of this " +
        "release under separate owner authorisation.",
    );
  }

  // Create annotated tag
  const tagMessage = `nexapp release ${tag}\n\nReason: ${args.reason}\nBranch: ${branch}\nHEAD: ${headSha}\n`;
  sh("git", ["tag", "-a", tag, "-m", tagMessage]);
  console.log(`  Annotated tag created locally: ${tag}`);

  console.log("─".repeat(72));
  console.log("NEXT STEP (owner-gated, see CLAUDE.md §4):");
  console.log("  To publish the tag, the operator must run:");
  console.log(`    git push origin ${tag}`);
  console.log("  This script does NOT push.");
  console.log("─".repeat(72));

  process.exit(0);
}

main();
