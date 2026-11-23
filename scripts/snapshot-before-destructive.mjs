#!/usr/bin/env node
/*
 * scripts/snapshot-before-destructive.mjs — nexapp pre-op snapshot
 * Purpose: take a tar snapshot of the working tree before any
 *          potentially destructive action, plus a JSON sidecar
 *          recording HEAD, branch, remote, reason, and file count.
 * Sealed: 2026-11-23
 *
 * Usage:
 *   node scripts/snapshot-before-destructive.mjs [--label <name>] "<reason>"
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, accessSync, constants, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { homedir } from 'node:os';
import process from 'node:process';

function parseArgs(argv) {
  const out = { label: 'manual', reason: '' };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--label' && argv[i + 1]) { out.label = argv[++i]; continue; }
    rest.push(a);
  }
  out.reason = rest.join(' ').trim() || '(no reason given)';
  return out;
}

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', ...opts }).trim();
}

function trySh(cmd, args) {
  try { return sh(cmd, args); } catch { return ''; }
}

function die(msg, err) {
  console.error(`snapshot: FAILED — ${msg}`);
  if (err) console.error(String(err?.stderr || err?.message || err));
  process.exit(1);
}

function canWrite(dir) {
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    return true;
  } catch { return false; }
}

function sanitizeLabel(s) {
  return String(s).replace(/[^A-Za-z0-9_.-]+/g, '-').slice(0, 64) || 'manual';
}

function timestamp() {
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, '0');
  const ms = p(d.getUTCMilliseconds(), 3);
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}${ms}`;
}

function collectGitignoreTopLevel(repoRoot) {
  const gi = join(repoRoot, '.gitignore');
  if (!existsSync(gi)) return [];
  const lines = readFileSync(gi, 'utf8').split(/\r?\n/);
  const out = [];
  for (let raw of lines) {
    let line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('!')) continue;
    // Only keep simple top-level directory/file patterns.
    line = line.replace(/\/$/, '');
    if (line.startsWith('/')) line = line.slice(1);
    if (line.includes('/') || line.includes('*')) continue;
    out.push(line);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const label = sanitizeLabel(args.label);

let repoRoot;
try { repoRoot = sh('git', ['rev-parse', '--show-toplevel']); }
catch (err) { die('not inside a git repository', err); }

const head    = trySh('git', ['rev-parse', 'HEAD']);
const branch  = trySh('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
const remote  = trySh('git', ['remote', 'get-url', 'origin']);

// Destination
const primary = 'D:/nex-backups';
const fallback = join(homedir(), '.nex-backups');
let destDir = primary;
if (!canWrite(primary)) {
  destDir = fallback;
  if (!canWrite(fallback)) die(`neither ${primary} nor ${fallback} is writable`);
}

const ts = timestamp();
const base = `nexapp-pre-op-${ts}-${label}`;
const tarPath  = join(destDir, `${base}.tar`);
const jsonPath = join(destDir, `${base}.json`);

// Build exclude list
const alwaysExclude = [
  'node_modules',
  '.next',
  '.git',
  'playwright-report',
  'playwright-report-perf',
  'data/.manifest-backups',
  'data/.recovery-*',
];
const gitignoreTop = collectGitignoreTopLevel(repoRoot);
const excludes = Array.from(new Set([...alwaysExclude, ...gitignoreTop]));

// Build tar args. Use POSIX-style since Git Bash + Windows tar both accept it.
const tarArgs = ['-cf', tarPath];
for (const ex of excludes) tarArgs.push(`--exclude=${ex}`);
tarArgs.push('-C', repoRoot, '.');

const tarRes = spawnSync('tar', tarArgs, { stdio: ['ignore', 'inherit', 'inherit'] });
if (tarRes.status !== 0) die(`tar exited with status ${tarRes.status}`);

// Count included files (best-effort).
let fileCount = 0;
try {
  const listed = sh('tar', ['-tf', tarPath]);
  fileCount = listed.split('\n').filter(Boolean).length;
} catch { /* ignore */ }

const sidecar = {
  timestamp_utc: new Date().toISOString(),
  head_sha: head,
  branch,
  remote,
  reason: args.reason,
  label,
  snapshot_path: tarPath,
  included_file_count: fileCount,
  excludes,
};
try {
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(sidecar, null, 2) + '\n', 'utf8');
} catch (err) { die('failed to write sidecar JSON', err); }

console.log(tarPath);
process.exit(0);
