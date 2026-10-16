# NEX Phase 3A · final read-only implementation review

Date: 2026-10-14
Companion to:
- `docs/doctrine/nex-repository-phase-3a-dev-guard-2026-10-14.md` (the implementation report)
- `docs/doctrine/nex-repository-identity-audit-2026-10-14.md` (Phase 1)
- `docs/doctrine/nex-repository-phase-2-feature-preservation-2026-10-14.md` (Phase 2)

Scope: inspect `scripts/assert-nexapp-cwd-and-remote.mjs`, its test file, and the `package.json` diff. Verify seven correctness properties. No file edited. No server started/stopped. No port changed. No dependency installed. No `.env.local` read. No DB. No git mutation. No D:/trades touch. No Stage 1.1 touch.

---

## Method

- Read all three files in full in their current working-tree state.
- Replayed the hostile-input matrix through the live normalizer by invoking `normalizeRemoteUrl`, `checkRemote`, `checkCwd` from a one-liner (`node --input-type=module -e …`). This exercises the real exported functions, equivalent to running an additional test suite · no file was edited.
- Reviewed the regex patterns at a character level for each normalisation step.
- Compared the staged `package.json` diff against the full pre-session file via `git diff`.

---

## Point-by-point findings

### 1 · Repository root validation cannot accept D:/trades or similar sibling directories

**Verdict: PASS for the primary target (`D:/trades`), with a documented residual gap on arbitrarily-nested identically-named directories.**

Direct probe through the live `checkCwd` function:

```
D:/trades                                   → wrong-basename   REJECT
D:/foo/bar/trades                           → wrong-basename   REJECT
C:/Users/Victus/nexapp-impostor             → wrong-basename   REJECT
/mnt/d/trades (POSIX form)                  → wrong-basename   REJECT
""                                          → no-toplevel      REJECT
```

All of these are the real "accidentally in the legacy monorepo" footguns. All rejected.

Residual gap (basename-only check):

```
C:/evil/nexapp                              → (matched)        ACCEPT
C:/Users/Victus/nexapp-backup/nexapp        → (matched)        ACCEPT
C:/Users/Victus/NEXAPP (case variant)       → (matched)        ACCEPT
C:/Users/Victus/nexapp/ (trailing slash)    → (matched)        ACCEPT
```

The check validates the **basename** of the git toplevel only. Any directory whose basename equals `nexapp` (case-insensitive) passes. The gap is bounded because the guard also validates the git **remote**: an impostor directory must have BOTH `/nexapp` as its basename AND the correct `origin` remote wired to pass. The combined check reduces the exposed scenario to "a legitimate clone of nexapp at an unexpected path," which is not the "wrong-project launch" risk the Phase 3A guard was designed to prevent.

**Evidence anchor.** The result `C:/evil/nexapp → (matched) ACCEPT` is the actual runtime output of `checkCwd("C:/evil/nexapp", "nexapp")`.

**Risk assessment.** This gap does not reopen the "accidental D:/trades launch" problem — D:/trades fails both checks. It does mean an attacker who has already compromised the filesystem (planted a nexapp clone with the correct remote at `C:/evil/nexapp`) could bypass the guard; but at that point the attack has already succeeded independently of the guard.

**Recommendation.** Document the limitation in-source. Optionally, a future hardening (not scoped for Phase 3A) could compare the full normalised toplevel against a known-good anchor path from an env var or config, giving a stricter but less portable check.

### 2 · Remote validation rejects wrong hosts, owners, repos, fetch and push URLs

**Verdict: PASS. Every hostile remote URL I probed produced the correct ACCEPT/REJECT outcome.**

Hostile-input matrix, actual output of `normalizeRemoteUrl` + `checkRemote`:

| Input | Normalised to | Verdict |
|---|---|---|
| `https://evil.com/github.com/Philip2024394/nexapp.git` | `evil.com/github.com/philip2024394/nexapp` | **REJECT** ✓ |
| `https://github.com.evil.com/Philip2024394/nexapp.git` | `github.com.evil.com/philip2024394/nexapp` | **REJECT** ✓ |
| `https://evil.github.com/Philip2024394/nexapp.git` | `evil.github.com/philip2024394/nexapp` | **REJECT** ✓ |
| `https://github.com/attacker/nexapp.git` | `github.com/attacker/nexapp` | **REJECT** ✓ |
| `https://github.com/Philip2024394/trades.git` | `github.com/philip2024394/trades` | **REJECT** ✓ |
| `https://github.com/Philip2024394/nexapp-fork.git` | `github.com/philip2024394/nexapp-fork` | **REJECT** ✓ |
| `https://192.168.1.1/Philip2024394/nexapp.git` | `192.168.1.1/philip2024394/nexapp` | **REJECT** ✓ |
| `https://github.com/Philip2024394/nexapp.git.git` | `github.com/philip2024394/nexapp.git` | **REJECT** ✓ (double `.git` suffix) |
| `https://github.com//Philip2024394//nexapp.git` | `github.com//philip2024394//nexapp` | **REJECT** ✓ (double-slash in path) |
| `https://ɡithub.com/Philip2024394/nexapp.git` (Unicode `ɡ`) | `ɡithub.com/philip2024394/nexapp` | **REJECT** ✓ (homoglyph attack) |
| `ssh://git@github.com:22/Philip2024394/nexapp.git` (explicit port) | `github.com:22/philip2024394/nexapp` | **REJECT** · false negative on an uncommon SSH form |

Accepted (correctly):

| Input | Normalised to | Verdict |
|---|---|---|
| `https://github.com/Philip2024394/nexapp.git` | `github.com/philip2024394/nexapp` | ACCEPT ✓ |
| `https://github.com/Philip2024394/nexapp.git/` (trailing slash) | same | ACCEPT ✓ |
| `HTTPS://GITHUB.COM/PHILIP2024394/NEXAPP.GIT` (case) | same | ACCEPT ✓ |
| `git@github.com:Philip2024394/nexapp.git` (SSH) | same | ACCEPT ✓ |
| `ssh://git@github.com/Philip2024394/nexapp.git` | same | ACCEPT ✓ |
| `https://user:pass@github.com/Philip2024394/nexapp.git` | same | ACCEPT ✓ (userinfo stripped · legitimate git form) |
| `https://github.com/Philip2024394/nexapp.git\n` (trailing newline) | same | ACCEPT ✓ (trim handles) |
| `https://github.com/Philip2024394/nexapp.git ` (trailing spaces) | same | ACCEPT ✓ |
| `git://github.com/Philip2024394/nexapp.git` (deprecated protocol) | same | ACCEPT · deprecated by GitHub 2022, legitimate historical form |
| `https:///github.com/Philip2024394/nexapp.git` (triple slash) | `github.com/philip2024394/nexapp` | ACCEPT · tolerant to extra protocol slashes |

**Key observations.**

- The whitelist is a **single frozen string** (`EXPECTED_REMOTE_NORMALISED = "github.com/philip2024394/nexapp"`). `Object.freeze` on the one-entry array is asserted by the test suite. A future refactor cannot silently widen the whitelist.
- Host-prefix attacks (`evil.github.com`), host-suffix attacks (`github.com.evil.com`), and sibling-path attacks (`evil.com/github.com/...`) are all rejected because normalisation does **not** collapse hostnames — it keeps the full host string before the first `/` after protocol-stripping, so `evil.github.com` and `github.com` remain distinct strings and the equality check fails cleanly.
- `.git.git` double-suffix inputs are correctly rejected because the regex strips only one trailing `.git`.
- Internal double-slashes in the path are NOT collapsed, which produces a safe REJECT for intentionally-malformed URLs.
- Fetch and push URLs are validated separately. The push-URL branch falls back to the fetch URL only when `git remote get-url --push` is unsupported, i.e. the system cannot report a distinct push URL — not when the push URL is distinct and wrong (the test at `scripts/__tests__/.../rejects a wrong push URL · fetch is correct but push diverged` pins this).

**Residual observations (not safety-critical).**

- `ssh://git@github.com:22/...` with the explicit port `:22` is REJECTED (false negative). This is because the SSH regex `/^git@([^:]+):(.+)$/` captures `github.com` and `22/Philip2024394/nexapp.git`, producing `github.com:22/philip2024394/nexapp` after `.git` strip. The default SSH port is 22 so this URL form is unusual; omitting the port is normal and works.
- The deprecated `git://` protocol is ACCEPTED. GitHub turned off `git://` cloning in 2022, so this would not occur in practice today. Not a security concern.
- Credential-embedded URL (`user:pass@github.com/...`) is ACCEPTED. This is correct — it's a legitimate (if not recommended) git clone form. The guard is not a credential-handling audit.

### 3 · Failed guard exits non-zero and prevents `npm run dev` from launching Next.js

**Verdict: PASS.**

Script-level evidence (`scripts/assert-nexapp-cwd-and-remote.mjs:213-216`):

```js
if (invokedAsCli) {
  const { exitCode } = runAssertion();
  process.exit(exitCode);
}
```

`runAssertion` returns one of six `exitCode` values:

- `0` · all checks pass (silent exit)
- `1` · `no-toplevel`
- `1` · `wrong-root`
- `1` · `no-remote`
- `1` · `wrong-remote-fetch`
- `1` · `wrong-remote-push`

Every failure path, per the implementation and tests, returns `exitCode: 1`. The CLI wrapper unconditionally calls `process.exit(exitCode)` — no code path can accidentally fall through to `next dev`.

npm lifecycle behaviour: a `pre<script>` hook that exits non-zero stops npm from running the main `<script>` (documented npm behaviour since npm 3). The `predev` → `dev` chain therefore halts at `predev` on any guard failure. I did not deliberately break the local state to prove this at runtime (would require either a cwd change or a remote mutation, both outside the read-only scope), but the behaviour is npm-standard and the implementation is correct.

Observed working path:

```
$ npm run predev
> nexapp@0.1.0 predev
> node scripts/assert-nexapp-cwd-and-remote.mjs

(silent)
exit=0
```

Silent exit 0 on the real nexapp cwd + remote.

### 4 · Test suite coverage of hostile and malformed inputs

**Verdict: PASS on documented happy path and documented failure modes · PARTIAL on hostile inputs (test gap, not implementation gap).**

What the 38 tests cover:

| Category | Tested? |
|---|---|
| HTTPS with `.git`, without `.git`, trailing slash | ✓ |
| HTTP (not just HTTPS) | ✓ |
| SSH form (`git@host:owner/repo.git`) | ✓ |
| `ssh://` explicit protocol | ✓ |
| Case-insensitive owner/repo | ✓ |
| Empty / whitespace / null / undefined / non-string inputs | ✓ |
| D:/trades path rejection | ✓ |
| trades remote rejection | ✓ |
| Windows backslash path | ✓ |
| Trailing slash on path | ✓ |
| Trailing slash on URL | ✓ |
| Lowercase comparison on path | ✓ |
| Missing origin · `git remote get-url` throws | ✓ |
| `git rev-parse` throws | ✓ |
| Mismatched push URL (fetch correct, push drifted) | ✓ |
| `--push` unsupported → fallback | ✓ |
| Frozen whitelist invariant | ✓ |
| Every failure path emits `FAIL` line and `Fix ·` line | ✓ |

What the tests do **not** cover (hostile inputs I probed manually):

- Host-prefix attack (`https://evil.github.com/...`)
- Host-suffix attack (`https://github.com.evil.com/...`)
- IP substitution (`https://192.168.1.1/...`)
- Sibling-path attack (`https://evil.com/github.com/...`)
- Unicode homoglyph host (`ɡithub.com`)
- Double `.git.git` suffix
- Internal double-slash in path
- Nested fake directory `C:/evil/nexapp` (ACCEPTED by the current implementation — see Point 1 gap)
- Non-`origin` remote drift (the guard only checks `origin`; a stale `upstream` or `heroku` remote is not validated)
- `ssh://` with explicit port

**Implementation behaviour is correct on all of the above** (verified by probe) **but the behaviour is not locked by a regression test.** A future refactor that accidentally collapses the host or normalises differently could pass the current suite while regressing one of these cases.

**Recommendation.** Add ~8 additional unit tests to pin the hostile-input behaviours. These are structural tests that do not touch real git — same `vi.mock` pattern as the existing suite. Not actioned in this review (read-only).

### 5 · Existing `dev` command and all unrelated package scripts remain unchanged

**Verdict: PASS.**

`git diff package.json` (full):

```
diff --git a/package.json b/package.json
index 638b352..f896f2c 100644
--- a/package.json
+++ b/package.json
@@ -3,6 +3,7 @@
   "version": "0.1.0",
   "private": true,
   "scripts": {
+    "predev": "node scripts/assert-nexapp-cwd-and-remote.mjs",
     "dev": "next dev -p 3008",
     "build": "next build",
     "start": "next start -p 3008",
```

Exactly `+1 insertion, 0 deletions`. The `dev` script and the 25+ `nex:*` scripts, `build`, `start`, `typecheck`, `test`, `test:watch` are all byte-identical. The `-p 3008` flag on `dev` is preserved.

### 6 · Script works with the project's Windows shell / Node environment

**Verdict: PASS.**

- Dependencies used: `node:child_process#execFileSync` and `node:url#pathToFileURL`. Both are available since Node 14. Project runs on Node 24.18 (observed during test runs).
- Backslash tolerance: `normalizePathForCompare` converts `\\` to `/`. Tested with `C:\\Users\\Victus\\nexapp`.
- CLI invocation detection: `import.meta.url === pathToFileURL(process.argv[1]).href`. `pathToFileURL` normalises Windows paths to `file:///C:/...` form. Observed working: `npm run predev` exits 0 silently on the real Windows filesystem.
- Live-cwd invocation observed working: `exit=0` reported.
- The ESM `.mjs` extension matches the convention of other scripts in the directory (`scripts/*.mjs`).

Caveat: `execFileSync` throws synchronously if `git` is not on PATH, and the guard catches that error with a clear fix message. The npm environment on Windows typically has git on PATH; the fail-closed branch is the correct safety net.

### 7 · Direct `next dev` bypass documented accurately

**Verdict: PASS.**

Script header comment, lines 23-28:

```
// Known limitations:
//   · The hook fires only when the dev server is launched through
//     `npm run dev`. Direct invocation of `next dev` bypasses the
//     guard. This is a lifecycle-hook limitation, not an audit gap.
```

Phase 3A implementation report, §2 "Known limitation (documented in the script)":

> "The hook fires only when the dev server is launched through `npm run dev`. A direct invocation of `next dev` bypasses the guard. This is a lifecycle-hook limitation, not an audit gap."

Phase 3A implementation report, §5 "Risks and known limitations" table row:

> "Developer bypasses `npm` and runs `next dev` directly … Documented in the script's header comment. … out of scope for Phase 3A."

Phase 3A implementation report, §5 further entry:

> "Lifecycle-hook bypass via `yarn dev` / `pnpm dev` · Low · `yarn` and `pnpm` both honour npm-lifecycle `predev` hooks. The limitation only hits with `next dev` run directly."

No wording claims "universal enforcement." The limitation is stated plainly and in three places.

---

## Summary table

| # | Property | Verdict | Notes |
|---|---|---|---|
| 1 | Root check rejects D:/trades and similar siblings | **PASS** | Basename-only; residual gap on `C:/evil/nexapp` with correct remote. Documented. |
| 2 | Remote check rejects wrong hosts/owners/repos/fetch/push | **PASS** | Every hostile variant probed REJECTED. 1 rare false negative (`ssh://.../:22/...`), 1 historically-ok ACCEPT (`git://`). Both documented. |
| 3 | Failed guard exits non-zero and halts dev | **PASS** | `process.exit(exitCode)` unconditional. npm `predev` lifecycle semantics documented and relied upon. |
| 4 | Tests cover hostile and malformed inputs | **PARTIAL** | 38 tests cover documented happy path + 5 failure modes + observability. Hostile inputs (host-prefix/suffix/IP-swap/homoglyph/nested-fake-path accept) are implementation-correct but not test-locked. |
| 5 | `dev` and unrelated scripts unchanged | **PASS** | `git diff package.json` is strictly +1 insertion / 0 deletion. |
| 6 | Works with the Windows shell/Node environment | **PASS** | Node 24.18 verified; backslash + case-insensitive path tolerated; `pathToFileURL` CLI detection works. |
| 7 | Direct `next dev` bypass documented accurately | **PASS** | Three places in-source and in-doctrine; no "universal enforcement" claim. |

---

## Remaining limitations (collected · for owner decision)

1. **Basename-only path check (Point 1).** `C:/evil/nexapp` or `C:/Users/Victus/nexapp-backup/nexapp` with the correct remote would pass. Not a problem for the "accidental D:/trades launch" case. A future hardening could compare the full toplevel to a configured anchor path.
2. **Test gap on hostile remote variants (Point 4).** The implementation handles host-prefix, host-suffix, IP-substitution, homoglyph, double-`.git`, and nested-fake-path correctly, but no regression test locks the behaviour. ~8 additional unit tests would close this gap.
3. **`ssh://git@github.com:22/...` false negative (Point 2).** Rare SSH form rejected. Fix would be to peel off `:<port>` after the SSH-form transform.
4. **Deprecated `git://` protocol ACCEPTED (Point 2).** GitHub turned this off in 2022, so irrelevant in practice, but if strictly desired the regex can be tightened to `(https?|ssh):` and the SSH-form explicit.
5. **Direct `next dev` bypass (Point 7).** Documented; out of scope for Phase 3A. A git `pre-push` hook or wrapper CLI could extend the enforcement surface.
6. **Non-`origin` remote drift not validated.** If someone adds an `upstream` or `heroku` remote pointing elsewhere, the guard does not notice. Not a safety issue (push goes to `origin` by default) but worth awareness.

Items 1-5 are small, each actionable in a bounded follow-up pass if the owner authorises. Item 6 is informational.

---

## Boundary compliance

- Read-only. No file edited, moved, copied, or deleted.
- No `git add`, `git commit`, `git push`, `git pull`, `git stash`, `git checkout`, `git reset`, or any state-changing git command.
- No file in D:/trades read or written.
- No `.env.local` opened. No secret accessed. No DB queried. No deploy. No dep installed.
- No port change. No process started/stopped (the running dev server at PID 7172 on port 3008 is untouched).
- No change to Stage 1.1 rate-limit code (`_actions.ts`, `_guest-chat-client.tsx`, test file).
- No change to Hammerex seed, theme-commerce migrations 191-196, migration 197, Vault, Bridge 99, Chat Master Layout.
- All 29 pre-existing nexapp working-tree modifications preserved verbatim.

Stopping. Awaiting owner review before any further action (hostile-input test additions, Point-1 strict-path hardening, selective doctrine transfer, Stage 1.1 Option C).
