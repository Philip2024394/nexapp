#!/usr/bin/env node
/*
 * scripts/safe-rm.mjs — nexapp guarded rm -rf wrapper
 * Purpose: never delete anything from nexapp without first capturing a
 *          snapshot and logging the action. Refuses to operate on
 *          top-level roots or paths outside the repo. Requires an
 *          env-scoped confirmation for the handful of high-risk roots.
 * Sealed: 2026-11-23
 *
 * Usage:
 *   node scripts/safe-rm.mjs "<reason>" <target> [<target> ...]
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, appendFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve, relative, dirname, join } from 'node:path';
import process from 'node:process';

const DANGEROUS_ROOTS = new Set([
  '.git',
  'nex-supabase',
  'src',
  'scripts',
  'CLAUDE.md',
]);

function die(msg) {
  console.error(`safe-rm: BLOCKED — ${msg}`);
  process.exit(1);
}

function sh(cmd, args) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();
}

let repoRoot;
try { repoRoot = sh('git', ['rev-parse', '--show-toplevel']); }
catch { die('not inside a git repository'); }

const args = process.argv.slice(2);
if (args.length < 2) {
  die('usage: safe-rm.mjs "<reason>" <target> [<target> ...]');
}
const reason = args[0];
const targets = args.slice(1);

// --- Validate each target -------------------------------------------------
const absTargets = [];
for (const t of targets) {
  const abs = resolve(t);
  const rel = relative(repoRoot, abs);
  if (rel.startsWith('..') || resolve(rel) === abs) {
    die(`target outside repo root: ${abs}`);
  }
  // top-level segment
  const topSeg = rel.split(/[\\/]/)[0];
  if (DANGEROUS_ROOTS.has(topSeg)) {
    const expected = `yes-${topSeg}`;
    if (process.env.NEX_CONFIRM_DANGEROUS_RM !== expected) {
      die(`target '${rel}' is a dangerous root — set NEX_CONFIRM_DANGEROUS_RM='${expected}' to confirm`);
    }
  }
  if (!existsSync(abs)) {
    console.error(`safe-rm: note — target does not exist: ${abs}`);
  }
  absTargets.push(abs);
}

// --- Snapshot first -------------------------------------------------------
const snapshotScript = join(repoRoot, 'scripts', 'snapshot-before-destructive.mjs');
if (!existsSync(snapshotScript)) {
  die(`snapshot script missing at ${snapshotScript}`);
}
const snapshotReason = `rm ${targets.join(' ')} :: ${reason}`;
const snapRes = spawnSync(process.execPath, [snapshotScript, '--label', 'pre-rm', snapshotReason], {
  stdio: ['ignore', 'pipe', 'inherit'],
  encoding: 'utf8',
});
if (snapRes.status !== 0) {
  die(`snapshot step failed (status ${snapRes.status}); refusing to delete`);
}
const snapshotPath = (snapRes.stdout || '').trim().split('\n').pop() || '(unknown)';

// --- Append log entry -----------------------------------------------------
const logPath = join(repoRoot, 'docs', 'engineering', 'safe-rm-log.md');
try {
  mkdirSync(dirname(logPath), { recursive: true });
  if (!existsSync(logPath)) {
    appendFileSync(logPath, '# safe-rm log\n\nAppend-only log of every `scripts/safe-rm.mjs` invocation.\n\n', 'utf8');
  }
  const stamp = new Date().toISOString();
  const lines = [
    `## ${stamp}`,
    `- reason: ${reason}`,
    `- targets: ${targets.join(', ')}`,
    `- snapshot: ${snapshotPath}`,
    '',
  ];
  appendFileSync(logPath, lines.join('\n') + '\n', 'utf8');
} catch (err) {
  die(`could not append to log ${logPath}: ${err?.message || err}`);
}

// --- Perform the deletion -------------------------------------------------
// Use Node's own rmSync for cross-platform reliability (equivalent to rm -rf).
import('node:fs').then(({ rmSync }) => {
  for (const abs of absTargets) {
    try {
      if (!existsSync(abs)) continue;
      const st = statSync(abs);
      rmSync(abs, { recursive: true, force: true });
      console.log(`safe-rm: removed ${abs} (${st.isDirectory() ? 'dir' : 'file'})`);
    } catch (err) {
      console.error(`safe-rm: ERROR removing ${abs}: ${err?.message || err}`);
      process.exit(1);
    }
  }
  console.log(`safe-rm: OK (snapshot at ${snapshotPath})`);
  process.exit(0);
}).catch((err) => die(`dynamic import failed: ${err?.message || err}`));
