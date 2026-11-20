#!/usr/bin/env node
// scripts/rotate-pg-password-sandbox.mjs
//
// One-shot, local-only, masked-stdin rotation of the Postgres password
// component inside .env.local for the SANDBOX project only.
//
// Scope (sealed by owner directive 2026-11-19):
//   - Updates ONLY the password segment of two ACTIVE (uncommented)
//     lines: DATABASE_URL=... and NEX_POSTGRES_URL=...
//   - Verifies both active lines point at sandbox ref
//     `kdstoyyeygcopkogqsyv` before prompting. Aborts if either does
//     not, or if either line is unparseable.
//   - Prompts for the new password twice via masked stdin · never
//     echoes, logs, prints, or writes it to argv / shell history.
//   - Percent-encodes the password per encodeURIComponent before
//     substituting into the URI.
//   - Atomic write via temp file + rename · preserves CRLF/LF per
//     line · 0600 mode on the temp file · no backup created
//     (another plaintext backup is another credential at rest).
//
// NOT authorised:
//   - To connect to the DB
//   - To restart :3008
//   - To commit, push, or deploy
//   - To touch any var other than the two above
//   - To change any Supabase URL / anon key / service-role key

import { promises as fs } from "node:fs";
import path from "node:path";

const ENV_PATH = path.resolve(process.cwd(), ".env.local");
const SANDBOX_REF = "kdstoyyeygcopkogqsyv";
const TARGET_VARS = ["DATABASE_URL", "NEX_POSTGRES_URL"];

function status(msg) {
  // Status lines only. Never includes password, URL, or file content.
  process.stdout.write(`[rotate-pg] ${msg}\n`);
}

function fail(msg) {
  process.stderr.write(`[rotate-pg] ABORT · ${msg}\n`);
  process.exit(1);
}

async function readEnv() {
  try {
    return await fs.readFile(ENV_PATH, "utf8");
  } catch (err) {
    fail(`cannot read .env.local (${err.code ?? err.message})`);
  }
}

function findActiveLineIndex(lines, varName) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(`${varName}=`)) return i;
  }
  return -1;
}

function parseConnection(line, varName) {
  // Expect: VAR=postgres(ql)?://user:password@host[:port]/db[?params]
  //   prefix captures everything up to and including the `:` before password
  //   pw     captures password (any chars except literal `@`)
  //   suffix captures `@` + rest of line
  const m = line.match(
    /^([A-Z_]+=postgres(?:ql)?:\/\/[^:@/]+:)([^@]*)(@.+)$/,
  );
  if (!m) fail(`${varName} line is not a parseable Postgres URI · nothing written`);
  return { prefix: m[1], oldPw: m[2], suffix: m[3] };
}

function verifySandbox(parsed, varName) {
  if (!parsed.suffix.includes(SANDBOX_REF)) {
    fail(
      `${varName} does not target sandbox ref · refusing to rotate · check file manually`,
    );
  }
}

// Masked stdin prompt · requires an interactive TTY · never echoes
// the typed characters (writes `*` placeholders instead). Handles
// backspace and Ctrl-C.
function promptMasked(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("stdin is not a TTY · run this script in an interactive terminal"));
      return;
    }
    const stdin = process.stdin;
    const stdout = process.stdout;
    stdout.write(prompt);
    let buf = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch) => {
      if (ch === "\u0003") {
        // Ctrl-C
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        stdout.write("\n");
        reject(new Error("cancelled by user"));
        return;
      }
      if (ch === "\r" || ch === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        stdout.write("\n");
        resolve(buf);
        return;
      }
      if (ch === "\u007f" || ch === "\b") {
        if (buf.length > 0) {
          buf = buf.slice(0, -1);
          stdout.write("\b \b");
        }
        return;
      }
      // Reject other control chars silently
      if (ch.charCodeAt(0) < 0x20) return;
      buf += ch;
      stdout.write("*");
    };
    stdin.on("data", onData);
  });
}

async function atomicWrite(contents) {
  const tmp = `${ENV_PATH}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, contents, { encoding: "utf8", mode: 0o600 });
  await fs.rename(tmp, ENV_PATH);
}

(async () => {
  const contents = await readEnv();

  // Split preserving separators so we can rewrite in place and keep
  // each line's own CRLF/LF ending intact.
  const parts = contents.split(/(\r?\n)/);
  // Real-line view (every other index) for locate-by-name.
  const realLines = [];
  for (let i = 0; i < parts.length; i += 2) realLines.push(parts[i]);

  // Locate + parse + verify BOTH lines before prompting.
  const found = {};
  for (const v of TARGET_VARS) {
    const idx = findActiveLineIndex(realLines, v);
    if (idx === -1) fail(`no active ${v}= line found · nothing written`);
    const parsed = parseConnection(realLines[idx], v);
    verifySandbox(parsed, v);
    found[v] = { idx, parsed };
  }
  status(
    `both ${TARGET_VARS.join(" + ")} active lines located · both target sandbox · ready to rotate`,
  );
  status(`enter the new sandbox password · Ctrl-C to abort`);

  const pw1 = await promptMasked("New sandbox password (masked): ");
  if (pw1.length === 0) fail("empty password · nothing written");
  const pw2 = await promptMasked("Confirm password (masked)      : ");
  if (pw1 !== pw2) fail("passwords did not match · nothing written");

  const encoded = encodeURIComponent(pw1);

  // Rewrite each target line in place.
  let rewritten = 0;
  for (const v of TARGET_VARS) {
    const realIdx = found[v].idx;
    const partsIdx = realIdx * 2;
    const orig = parts[partsIdx];
    if (!orig.startsWith(`${v}=`)) fail(`line drift for ${v} · nothing written`);
    const { prefix, suffix } = found[v].parsed;
    parts[partsIdx] = `${prefix}${encoded}${suffix}`;
    rewritten++;
  }
  if (rewritten !== TARGET_VARS.length) {
    fail(`expected ${TARGET_VARS.length} rewrites, got ${rewritten} · nothing written`);
  }

  await atomicWrite(parts.join(""));
  status(`rewrote ${rewritten} active lines in .env.local`);
  status(`password never echoed · no backup written · no DB connection made`);
  status(`DB pause remains in force · :3008 was not restarted`);
})().catch((err) => fail(err.message ?? String(err)));
