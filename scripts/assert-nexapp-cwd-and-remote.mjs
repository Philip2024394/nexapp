// scripts/assert-nexapp-cwd-and-remote.mjs
//
// Pre-dev guard · nexapp identity enforcement.
//
// Refuses to start Next.js if the current git repository root is not
// the intended nexapp root OR if the configured `origin` fetch/push
// URL is not one of the three approved canonical forms pointing at
// Philip2024394/nexapp on github.com.
//
// Wiring: invoked via npm's `predev` lifecycle hook declared in
// `package.json`. Exits 1 (and prints a corrective diagnostic) on any
// mismatch; exits 0 silently when every check passes so `next dev`
// starts normally.
//
// Policy summary:
//   · Repository root check compares the git toplevel's canonical
//     absolute path against the hardcoded `EXPECTED_REPO_ROOT`.
//     Basename-only matching is rejected. A directory named `nexapp`
//     at any other path (`C:/evil/nexapp`,
//     `C:/Users/Victus/nexapp-backup/nexapp`, etc.) is REJECTED.
//   · Remote URL policy restricted to three canonical approved forms:
//     https, SSH shorthand (`git@github.com:owner/repo`), SSH long
//     (`ssh://git@github.com/owner/repo`). Any `http://`, `git://`,
//     `ssh://` with a non-`git` user, URL with embedded userinfo
//     (`user:pass@` or `user@` other than literal `git`), or any URL
//     with a port is REJECTED.
//   · The host and repo-path are compared as separate structured
//     fields, so host-prefix/host-suffix/IP-substitute/homoglyph
//     attacks are rejected by construction.
//
// Known limitations:
//   · The hook fires only when the dev server is launched through
//     `npm run dev`. Direct invocation of `next dev` bypasses the
//     guard. This is a lifecycle-hook limitation, not an audit gap.
//   · The guard trusts `git` to be on PATH. If git is missing the
//     guard fails closed (exit 1) with an actionable message.
//
// Testability: the heavy lifting lives in `runAssertion({ exec, log })`
// which accepts injected `exec` and `log` so unit tests can drive each
// branch deterministically without ever touching the real git config.
// See `__tests__/assert-nexapp-cwd-and-remote.test.mjs`.

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";

// ─── Policy constants ─────────────────────────────────────────────

/** Strict absolute path the git toplevel must equal (modulo
 *  path.win32 canonicalisation and lowercase). If nexapp is cloned
 *  to a different path, this constant AND the test fixtures must
 *  both be updated · deliberately NOT configurable via env var so
 *  the policy cannot be weakened at runtime. */
export const EXPECTED_REPO_ROOT = "C:\\Users\\Victus\\nexapp";

/** Approved GitHub host (lowercase). */
export const EXPECTED_HOST = "github.com";

/** Approved repo path (owner/repo, lowercase). */
export const EXPECTED_REPO_PATH = "philip2024394/nexapp";

/** Approved canonical remote-URL forms. These are the ONLY forms that
 *  `parseRemoteUrl` will produce; everything else returns null and is
 *  therefore rejected by `checkRemote`.
 *
 *    "https"         https://host/owner/repo[.git]
 *    "ssh-shorthand" git@host:owner/repo[.git]
 *    "ssh-long"      ssh://git@host/owner/repo[.git]
 *
 *  Deliberately rejects (documented policy):
 *    · http://      · plaintext, no transport integrity
 *    · git://       · deprecated by GitHub 2022, no authentication
 *    · ssh://       · with any user other than literal `git`
 *    · any URL with embedded userinfo (`user:pass@` or `user@`) other
 *      than the literal `git@` prefix required by GitHub SSH clone
 *    · any URL with an explicit port (`:22`, `:443`, etc.)
 *    · hosts containing characters outside [A-Za-z0-9.-] (rejects
 *      Unicode homoglyphs, IPv6 literals, raw IPv4 if they don't
 *      match the expected host anyway)
 */
export const APPROVED_REMOTE_FORMS = Object.freeze([
  "https",
  "ssh-shorthand",
  "ssh-long",
]);

// ─── Pure helpers ────────────────────────────────────────────────

/**
 * Canonicalise a filesystem path for Windows-aware comparison.
 *
 * Handles:
 *   · forward or backward slashes
 *   · trailing slashes
 *   · `.` and `..` segments
 *   · case variation (Windows filesystem is case-insensitive)
 *   · the git-bash MINGW form `/c/Users/...` → `C:/Users/...`
 *
 * Returns "" for non-string / empty / whitespace-only input.
 */
export function canonicalisePathForCompare(p) {
  if (typeof p !== "string") return "";
  let s = p.trim();
  if (s.length === 0) return "";

  // git-bash MINGW POSIX form: /c/Users/... → C:/Users/...
  const mingwMatch = s.match(/^\/([a-zA-Z])(\/.*)?$/);
  if (mingwMatch) {
    s = `${mingwMatch[1].toUpperCase()}:${mingwMatch[2] ?? "/"}`;
  }

  // path.win32.resolve collapses .. and . and normalises separators,
  // producing an absolute Windows path. Explicitly using win32 (not
  // the platform default) so tests give the same answer on any OS.
  const resolved = path.win32.resolve(s);

  return resolved.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

/**
 * Parse a git remote URL into one of the three APPROVED_REMOTE_FORMS,
 * or return null if the URL does not fit the strict policy.
 *
 * The parse is structured: on success it returns `{ form, host,
 * repoPath }` where `host` is the hostname (lowercase) and `repoPath`
 * is the lowercase owner/repo string with `.git` stripped. Callers
 * compare `host` and `repoPath` to `EXPECTED_HOST` and
 * `EXPECTED_REPO_PATH` separately so a host-prefix / host-suffix /
 * sibling-path attack cannot slip through by matching a substring.
 *
 * Rejected by construction (parseRemoteUrl returns null):
 *   · http://... (plaintext)
 *   · git://... (deprecated, no auth)
 *   · ssh://user@host/... where user ≠ literal "git"
 *   · https://user@host/... or https://user:pass@host/...
 *   · any URL with explicit `:<port>`
 *   · any URL whose host contains non-DNS characters (Unicode
 *     homoglyphs, raw IPv6, etc.)
 *   · any URL whose repo path doesn't match the strict character set
 */
export function parseRemoteUrl(url) {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;

  // Host pattern · bare DNS, no port, no userinfo, no Unicode.
  //   First char: letter or digit
  //   Rest:       letters, digits, dot, hyphen
  // Repo path pattern · owner/repo, allow nested paths too.
  //   First char: letter or digit (NO slash — rejects double-slash).
  //   Rest:       letters, digits, dot, underscore, slash, hyphen.
  const HOST = "[a-z0-9][a-z0-9.-]*";
  const REPO = "[a-z0-9][a-z0-9._/-]*?";

  // 1. SSH shorthand · git@host:owner/repo[.git][/]
  //    User MUST be literal "git" (GitHub SSH form).
  const sshShorthand = new RegExp(
    `^git@(${HOST}):(${REPO})(\\.git)?/*$`,
    "i",
  );
  let m = sshShorthand.exec(trimmed);
  if (m) {
    return {
      form: "ssh-shorthand",
      host: m[1].toLowerCase(),
      repoPath: m[2].toLowerCase(),
    };
  }

  // 2. SSH long · ssh://git@host/owner/repo[.git][/]
  //    No port. User MUST be literal "git".
  const sshLong = new RegExp(
    `^ssh://git@(${HOST})/(${REPO})(\\.git)?/*$`,
    "i",
  );
  m = sshLong.exec(trimmed);
  if (m) {
    return {
      form: "ssh-long",
      host: m[1].toLowerCase(),
      repoPath: m[2].toLowerCase(),
    };
  }

  // 3. HTTPS · https://host/owner/repo[.git][/]
  //    No userinfo. No port. No http:// (plaintext rejected).
  const httpsForm = new RegExp(
    `^https://(${HOST})/(${REPO})(\\.git)?/*$`,
    "i",
  );
  m = httpsForm.exec(trimmed);
  if (m) {
    return {
      form: "https",
      host: m[1].toLowerCase(),
      repoPath: m[2].toLowerCase(),
    };
  }

  return null;
}

/**
 * Strict root check · compare the git toplevel's canonical absolute
 * path against `EXPECTED_REPO_ROOT`. Not basename-only.
 */
export function checkCwd(toplevel) {
  if (typeof toplevel !== "string" || toplevel.trim().length === 0) {
    return { ok: false, reason: "no-toplevel", toplevel };
  }
  const actual = canonicalisePathForCompare(toplevel);
  const expected = canonicalisePathForCompare(EXPECTED_REPO_ROOT);
  if (!actual) {
    return { ok: false, reason: "no-toplevel", toplevel };
  }
  if (actual !== expected) {
    return {
      ok: false,
      reason: "wrong-root",
      toplevel,
      canonical: actual,
      expected,
    };
  }
  return { ok: true, toplevel, canonical: actual };
}

/**
 * Verify a remote URL matches the strict policy AND points at the
 * expected host + repo-path.
 */
export function checkRemote(remoteUrl) {
  const parsed = parseRemoteUrl(remoteUrl);
  if (parsed === null) {
    return { ok: false, reason: "unparseable", remoteUrl };
  }
  if (parsed.host !== EXPECTED_HOST) {
    return {
      ok: false,
      reason: "wrong-host",
      remoteUrl,
      actualHost: parsed.host,
      expectedHost: EXPECTED_HOST,
    };
  }
  if (parsed.repoPath !== EXPECTED_REPO_PATH) {
    return {
      ok: false,
      reason: "wrong-repo",
      remoteUrl,
      actualRepoPath: parsed.repoPath,
      expectedRepoPath: EXPECTED_REPO_PATH,
    };
  }
  return { ok: true, remoteUrl, form: parsed.form };
}

/**
 * Run every guard check in sequence. Pure of real I/O when the caller
 * injects `exec` and `log`. Returns `{ exitCode, failure, messages }`
 * so a caller (CLI or test) can decide how to react.
 */
export function runAssertion({ exec, log } = {}) {
  const execFn =
    exec ??
    ((cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim());
  const logFn = log ?? ((msg) => console.error(msg));

  const messages = [];
  const emit = (msg) => {
    messages.push(msg);
    logFn(msg);
  };

  // 1 · git toplevel must exist.
  let toplevel;
  try {
    toplevel = execFn("git", ["rev-parse", "--show-toplevel"]);
  } catch (err) {
    emit("[nexapp-guard] FAIL · could not resolve the git repository root.");
    emit(`[nexapp-guard]   ${err?.message ?? String(err)}`);
    emit("[nexapp-guard] Fix · cd into C:/Users/Victus/nexapp and run `npm run dev` again.");
    return { exitCode: 1, failure: "no-toplevel", messages };
  }

  const cwdCheck = checkCwd(toplevel);
  if (!cwdCheck.ok) {
    emit("[nexapp-guard] FAIL · wrong working directory.");
    emit(`[nexapp-guard]   git toplevel = ${toplevel}`);
    if (cwdCheck.canonical) {
      emit(`[nexapp-guard]   canonical    = ${cwdCheck.canonical}`);
    }
    emit(`[nexapp-guard]   expected     = ${canonicalisePathForCompare(EXPECTED_REPO_ROOT)}`);
    emit("[nexapp-guard] Fix · cd into C:/Users/Victus/nexapp and run `npm run dev` again.");
    return { exitCode: 1, failure: "wrong-root", messages };
  }

  // 2 · origin fetch URL must match policy.
  let fetchUrl;
  try {
    fetchUrl = execFn("git", ["remote", "get-url", "origin"]);
  } catch (err) {
    emit("[nexapp-guard] FAIL · no `origin` remote is configured.");
    emit(`[nexapp-guard]   ${err?.message ?? String(err)}`);
    emit("[nexapp-guard]   expected one of:");
    emit(`[nexapp-guard]     https://github.com/${EXPECTED_REPO_PATH}.git`);
    emit(`[nexapp-guard]     git@github.com:${EXPECTED_REPO_PATH}.git`);
    emit(`[nexapp-guard]     ssh://git@github.com/${EXPECTED_REPO_PATH}.git`);
    emit("[nexapp-guard] Fix · verify this is the nexapp clone and configure the correct remote.");
    return { exitCode: 1, failure: "no-remote", messages };
  }

  const fetchCheck = checkRemote(fetchUrl);
  if (!fetchCheck.ok) {
    emit(`[nexapp-guard] FAIL · unexpected \`origin\` fetch URL (${fetchCheck.reason}).`);
    emit(`[nexapp-guard]   origin (fetch) = ${fetchUrl}`);
    emit(`[nexapp-guard]   expected       = https://github.com/${EXPECTED_REPO_PATH}.git (or canonical SSH form)`);
    emit("[nexapp-guard]   approved forms: https · git@host:owner/repo · ssh://git@host/owner/repo");
    emit("[nexapp-guard]   rejected: http:// · git:// · userinfo · explicit port · non-DNS host chars");
    emit("[nexapp-guard] Fix · set `origin` to one of the approved forms pointing at Philip2024394/nexapp.");
    return { exitCode: 1, failure: "wrong-remote-fetch", messages };
  }

  // 3 · origin push URL must also match policy. Some git configs do
  // not surface a separate push URL · in that case we fall back to the
  // fetch URL (which is already validated above).
  let pushUrl;
  try {
    pushUrl = execFn("git", ["remote", "get-url", "--push", "origin"]);
  } catch {
    pushUrl = fetchUrl;
  }

  const pushCheck = checkRemote(pushUrl);
  if (!pushCheck.ok) {
    emit(`[nexapp-guard] FAIL · unexpected \`origin\` push URL (${pushCheck.reason}).`);
    emit(`[nexapp-guard]   origin (push)  = ${pushUrl}`);
    emit(`[nexapp-guard]   expected       = https://github.com/${EXPECTED_REPO_PATH}.git (or canonical SSH form)`);
    emit("[nexapp-guard] Fix · a mismatched push URL means `git push` would land in the wrong repo.");
    return { exitCode: 1, failure: "wrong-remote-push", messages };
  }

  // All green · stay quiet.
  return { exitCode: 0, failure: null, messages };
}

// CLI entry · only runs when the file is invoked directly by node
// (e.g. via npm's `predev` hook). Importing this module from a test
// file does NOT trigger the CLI side effect.
const invokedAsCli =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv.length > 1 &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsCli) {
  const { exitCode } = runAssertion();
  process.exit(exitCode);
}
