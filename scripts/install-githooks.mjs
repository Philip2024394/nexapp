#!/usr/bin/env node
/*
 * scripts/install-githooks.mjs — nexapp git hooks installer
 * Purpose: point git at `.githooks/` as the hooks directory, mark each
 *          hook executable on POSIX, verify the config took, exit non-zero
 *          on any failure. Idempotent.
 * Sealed: 2026-11-23
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, chmodSync } from 'node:fs';
import { resolve, join } from 'node:path';
import process from 'node:process';

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:\/)/, '$1'));
const HOOKS_DIR = '.githooks';

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', ...opts }).trim();
}

function die(msg, err) {
  console.error(`install-githooks: FAILED — ${msg}`);
  if (err) console.error(String(err?.stderr || err?.message || err));
  process.exit(1);
}

try {
  run('git', ['rev-parse', '--git-dir']);
} catch (err) {
  die('not inside a git repository (run from nexapp root)', err);
}

try {
  run('git', ['config', 'core.hooksPath', HOOKS_DIR]);
} catch (err) {
  die(`could not set core.hooksPath=${HOOKS_DIR}`, err);
}

const isWindows = process.platform === 'win32';
try {
  const hooksAbs = resolve(REPO_ROOT, HOOKS_DIR);
  const entries = readdirSync(hooksAbs);
  for (const entry of entries) {
    const abs = join(hooksAbs, entry);
    if (!statSync(abs).isFile()) continue;
    try {
      chmodSync(abs, 0o755);
    } catch (chmodErr) {
      if (!isWindows) {
        die(`chmod +x failed on ${entry}`, chmodErr);
      }
      // On Windows chmod is a no-op in many FS configs — ignore.
    }
  }
} catch (err) {
  die(`could not enumerate ${HOOKS_DIR}/`, err);
}

let observed;
try {
  observed = run('git', ['config', '--get', 'core.hooksPath']);
} catch (err) {
  die('verification read of core.hooksPath failed', err);
}
if (observed !== HOOKS_DIR) {
  die(`verification mismatch: core.hooksPath='${observed}' (expected '${HOOKS_DIR}')`);
}

console.log('\u2713 nexapp git hooks installed');
process.exit(0);
