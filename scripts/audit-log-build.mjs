#!/usr/bin/env node
// scripts/audit-log-build.mjs
//
// Sealed: 2026-11-23
//
// Compiles a unified audit trail for nexapp from:
//   - `git log --format=... --all`        (every commit)
//   - `.git/HEAD`                         (current branch state)
//   - `docs/engineering/safe-rm-log.md`   (if present)
//   - `docs/engineering/rollback-log.md`  (if present)
//   - `docs/engineering/session-handoff.md` (latest section)
//
// Emits `docs/engineering/audit-log.md` in reverse-chronological order.
//
// Honest-first:
//   - Sources that are missing are reported as "not present" — not
//     silently skipped.
//   - Reflog is inspected for force-push markers if accessible; if the
//     reflog is unavailable (e.g. read-only checkout), that is also
//     reported, not hidden.
//   - The script does NOT mutate git state. It only reads.
//   - Exit code is 0 even with missing sources; non-zero only for
//     catastrophic failure (cannot write the output file).

import { execSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  statSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..");
const ENG_DIR = join(REPO_ROOT, "docs", "engineering");
const OUT_PATH = join(ENG_DIR, "audit-log.md");

const SAFE_RM_PATH = join(ENG_DIR, "safe-rm-log.md");
const ROLLBACK_PATH = join(ENG_DIR, "rollback-log.md");
const HANDOFF_PATH = join(ENG_DIR, "session-handoff.md");
const HEAD_PATH = join(REPO_ROOT, ".git", "HEAD");

function trySync(cmd, opts = {}) {
  try {
    const stdout = execSync(cmd, {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 64,
      ...opts,
    });
    return { ok: true, stdout };
  } catch (err) {
    return {
      ok: false,
      error: err && err.message ? err.message.split("\n")[0] : String(err),
    };
  }
}

function tryRead(path) {
  try {
    if (!existsSync(path)) return { ok: false, missing: true };
    const stat = statSync(path);
    const content = readFileSync(path, "utf8");
    return { ok: true, content, mtime: stat.mtime };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

function headerBlock() {
  const nowIso = new Date().toISOString();
  return `# Audit log — nexapp

**Generated:** ${nowIso}
**Generator:** \`scripts/audit-log-build.mjs\`
**Seal date:** 2026-11-23

This file is REGENERATED on each run. Do not hand-edit — edits here
will be lost next run. The authoritative sources are listed in each
section and should be edited there.

`;
}

function headSection() {
  const lines = ["## Current branch / HEAD", ""];
  const head = tryRead(HEAD_PATH);
  if (!head.ok) {
    lines.push(head.missing
      ? "- `.git/HEAD` not present (is this a git checkout?)"
      : `- could not read \`.git/HEAD\`: ${head.error}`);
  } else {
    lines.push("```");
    lines.push(head.content.trim());
    lines.push("```");
  }
  const branch = trySync("git rev-parse --abbrev-ref HEAD");
  const sha = trySync("git rev-parse HEAD");
  const remote = trySync("git remote -v");
  const status = trySync("git status --short");
  lines.push("");
  lines.push(`- Branch: ${branch.ok ? "`" + branch.stdout.trim() + "`" : "unknown · " + branch.error}`);
  lines.push(`- HEAD:   ${sha.ok ? "`" + sha.stdout.trim() + "`" : "unknown · " + sha.error}`);
  lines.push("");
  lines.push("### Remotes");
  lines.push("");
  if (remote.ok) {
    lines.push("```");
    lines.push(remote.stdout.trim() || "(no remotes configured)");
    lines.push("```");
  } else {
    lines.push(`- could not read remotes: ${remote.error}`);
  }
  lines.push("");
  lines.push("### Working tree status");
  lines.push("");
  if (status.ok) {
    const t = status.stdout.trim();
    lines.push("```");
    lines.push(t || "(clean)");
    lines.push("```");
  } else {
    lines.push(`- could not read status: ${status.error}`);
  }
  lines.push("");
  return lines.join("\n");
}

function reflogSection() {
  const lines = ["## Reflog — force-push / destructive markers", ""];
  const reflog = trySync("git reflog --date=iso --format=%h|%gd|%gs|%ai|%s --all");
  if (!reflog.ok) {
    lines.push(`- reflog not accessible: ${reflog.error}`);
    lines.push("- (this is normal in a shallow clone or read-only checkout)");
    lines.push("");
    return lines.join("\n");
  }
  const rows = reflog.stdout.split(/\r?\n/).filter(Boolean);
  // Suspicious markers: force update to refs, reset --hard, branch -D,
  // "forced-update" strings from reflog messages, pushes with --force.
  const suspiciousPatterns = [
    /force/i,
    /reset: moving to/i,
    /reset --hard/i,
    /branch: renamed/i,
    /update by push --force/i,
    /\bforced-update\b/i,
  ];
  const suspicious = rows.filter((r) =>
    suspiciousPatterns.some((p) => p.test(r)),
  );
  lines.push(`- Total reflog entries read: ${rows.length}`);
  lines.push(`- Entries matching suspicious patterns: ${suspicious.length}`);
  lines.push("");
  if (suspicious.length === 0) {
    lines.push("No force-push or destructive-reset markers detected in reflog.");
  } else {
    lines.push("Suspicious entries (reverse chronological, up to 50 shown):");
    lines.push("");
    lines.push("```");
    for (const s of suspicious.slice(0, 50)) lines.push(s);
    lines.push("```");
    lines.push("");
    lines.push("Each entry above should be cross-referenced against an");
    lines.push("owner-named authorization. An unmatched entry is an audit");
    lines.push("finding, not a crash.");
  }
  lines.push("");
  return lines.join("\n");
}

function commitHistorySection() {
  const lines = ["## Commit history (reverse chronological · all refs)", ""];
  const res = trySync('git log --all --format="%h|%ai|%an|%s"');
  if (!res.ok) {
    lines.push(`- could not read git log: ${res.error}`);
    lines.push("");
    return lines.join("\n");
  }
  const rows = res.stdout.split(/\r?\n/).filter(Boolean);
  lines.push(`- Total commits across all refs: ${rows.length}`);
  lines.push("");
  lines.push("| sha | date (ISO) | author | subject |");
  lines.push("|---|---|---|---|");
  // Already reverse-chronological from git log default.
  for (const row of rows) {
    const [sha, date, author, ...rest] = row.split("|");
    const subject = rest.join("|").replace(/\|/g, "\\|");
    lines.push(`| \`${sha}\` | ${date} | ${author} | ${subject} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function externalLogSection(title, path, label) {
  const lines = [`## ${title}`, ""];
  const res = tryRead(path);
  if (!res.ok) {
    if (res.missing) {
      lines.push(`- \`${label}\` not present. Nothing to merge.`);
    } else {
      lines.push(`- could not read \`${label}\`: ${res.error}`);
    }
    lines.push("");
    return lines.join("\n");
  }
  lines.push(`Source: \`${label}\` (mtime ${res.mtime.toISOString()})`);
  lines.push("");
  lines.push("```markdown");
  lines.push(res.content.trimEnd());
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}

function handoffSection() {
  const lines = ["## Latest session-handoff section", ""];
  const res = tryRead(HANDOFF_PATH);
  if (!res.ok) {
    if (res.missing) {
      lines.push("- `docs/engineering/session-handoff.md` not present.");
    } else {
      lines.push(`- could not read handoff: ${res.error}`);
    }
    lines.push("");
    return lines.join("\n");
  }
  // Pull the first H2-level section (## ...) and everything up to the
  // next H2. If the file has no H2 blocks, show the first 120 lines.
  const content = res.content;
  const h2Idx = content.indexOf("\n## ");
  let block;
  if (h2Idx === -1) {
    block = content.split(/\r?\n/).slice(0, 120).join("\n");
  } else {
    const start = h2Idx + 1;
    const nextH2 = content.indexOf("\n## ", start + 1);
    block = nextH2 === -1
      ? content.slice(start)
      : content.slice(start, nextH2);
  }
  lines.push(`Source: \`docs/engineering/session-handoff.md\` (mtime ${res.mtime.toISOString()})`);
  lines.push("");
  lines.push("```markdown");
  lines.push(block.trimEnd());
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}

function sourcesSummary(sources) {
  const lines = ["## Source summary", ""];
  for (const [label, present, note] of sources) {
    lines.push(`- ${present ? "[present]" : "[missing]"} \`${label}\`${note ? " — " + note : ""}`);
  }
  lines.push("");
  return lines.join("\n");
}

function main() {
  // Check source availability up-front so the summary can be honest.
  const sources = [
    [".git/HEAD", existsSync(HEAD_PATH), null],
    ["docs/engineering/safe-rm-log.md", existsSync(SAFE_RM_PATH), null],
    ["docs/engineering/rollback-log.md", existsSync(ROLLBACK_PATH), null],
    ["docs/engineering/session-handoff.md", existsSync(HANDOFF_PATH), null],
  ];

  const parts = [
    headerBlock(),
    sourcesSummary(sources),
    headSection(),
    reflogSection(),
    handoffSection(),
    externalLogSection(
      "Rollback log (worker rollback intents)",
      ROLLBACK_PATH,
      "docs/engineering/rollback-log.md",
    ),
    externalLogSection(
      "safe-rm log (authorized removals)",
      SAFE_RM_PATH,
      "docs/engineering/safe-rm-log.md",
    ),
    commitHistorySection(),
  ];

  try {
    if (!existsSync(ENG_DIR)) mkdirSync(ENG_DIR, { recursive: true });
    writeFileSync(OUT_PATH, parts.join("\n"), "utf8");
    console.log(`audit-log-build: wrote ${OUT_PATH}`);
    process.exit(0);
  } catch (err) {
    console.error(`audit-log-build: FAILED to write ${OUT_PATH}`);
    console.error(err && err.message ? err.message : String(err));
    process.exit(1);
  }
}

main();
