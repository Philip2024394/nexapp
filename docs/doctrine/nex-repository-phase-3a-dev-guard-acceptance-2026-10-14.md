# NEX Phase 3A · final acceptance verification

Date: 2026-10-14
Companion to:
- `docs/doctrine/nex-repository-phase-3a-dev-guard-2026-10-14.md` (initial implementation)
- `docs/doctrine/nex-repository-phase-3a-dev-guard-review-2026-10-14.md` (first read-only review)
- `docs/doctrine/nex-repository-phase-3a-dev-guard-hardening-2026-10-14.md` (hardening pass)

Scope: strictly read-only verification that the actual code at `scripts/assert-nexapp-cwd-and-remote.mjs` and its test file implement the documented policy. No file rewritten, no implementation rerun. Based on direct source inspection with specific line-number citations.

---

## Verdict · ACCEPT Phase 3A

All six acceptance points are met against the actual source. Observations below are either refinements the hardening pass already addressed in-source or nice-to-have polish items for a future phase — none are blockers.

---

## Point-by-point verification against the actual source

### 1 · Expected root compared via correct Windows canonicalisation

**Verified. ACCEPT.**

Source evidence:

- `scripts/assert-nexapp-cwd-and-remote.mjs:65` · `export const EXPECTED_REPO_ROOT = "C:\\Users\\Victus\\nexapp";` — hardcoded. Documentation at lines 59-64 states it is deliberately not configurable via env var.
- `scripts/assert-nexapp-cwd-and-remote.mjs:112-129` · `canonicalisePathForCompare(p)` performs **four** normalisation steps in order:
  1. Line 114 · `.trim()` to drop leading/trailing whitespace (including `\n`, `\r`, `\t`, space).
  2. Lines 118-121 · MINGW form detection `/^\/([a-zA-Z])(\/.*)?$/` converts `/c/Users/...` → `C:/Users/...`. Captures the drive letter and uppercases it.
  3. Line 126 · `path.win32.resolve(s)` collapses `.` and `..` segments, normalises forward/backward slashes to Windows-canonical backslashes, produces an absolute path. **Explicitly `win32`** (not platform-default) so the test suite gives identical answers on any OS.
  4. Line 128 · `.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase()` yields a stable lowercase forward-slash form for comparison.
- `scripts/assert-nexapp-cwd-and-remote.mjs:218-237` · `checkCwd(toplevel)` canonicalises both the actual `toplevel` and `EXPECTED_REPO_ROOT` and compares them for **string equality** (not substring, not basename).

Canonicalisation cannot create a false accept:

| Attack vector | Canonicalises to | Match against expected `c:/users/victus/nexapp`? |
|---|---|---|
| `D:/trades` | `d:/trades` | NO · wrong-root |
| `/d/trades` (MINGW) | `d:/trades` | NO · wrong-root |
| `C:/evil/nexapp` | `c:/evil/nexapp` | NO · wrong-root |
| `C:/Users/Victus/nexapp-backup/nexapp` | `c:/users/victus/nexapp-backup/nexapp` | NO · wrong-root |
| `C:/Users/Victus/nexapp-impostor` | `c:/users/victus/nexapp-impostor` | NO · wrong-root |
| `C:/Users/Victus` (parent) | `c:/users/victus` | NO · wrong-root |
| `C:/Users/Victus/nexapp/src` (subdir) | `c:/users/victus/nexapp/src` | NO · wrong-root |
| `D:/Users/Victus/nexapp` (different drive) | `d:/users/victus/nexapp` | NO · wrong-root |
| `C:/Users/Victus/foo/../nexapp` | `c:/users/victus/nexapp` | YES · ACCEPT (legitimate: `..` resolves to the expected root) |
| `C:/Users/Victus/nexapp/` (trailing slash) | `c:/users/victus/nexapp` | YES · ACCEPT |
| `C:\Users\Victus\nexapp` (backslashes) | `c:/users/victus/nexapp` | YES · ACCEPT |
| `C:/USERS/VICTUS/NEXAPP` (case) | `c:/users/victus/nexapp` | YES · ACCEPT (Windows is case-insensitive) |
| `/c/Users/Victus/nexapp` (MINGW) | `c:/users/victus/nexapp` | YES · ACCEPT |

Tests pin all 13 cases (plus 5 negative cases) at lines 221-301 of the test file.

Residual observation (not a blocker): `path.win32.resolve` applied to a RELATIVE path would resolve against `process.cwd()`. Git never returns relative paths from `rev-parse --show-toplevel`, so the realistic risk is zero. A defensive absolute-path guard (reject if `path.win32.isAbsolute(resolved)` returns false) would be a nice-to-have but is not required for Phase 3A acceptance.

### 2 · Remote parser validates each piece independently; three-form allowlist cannot be bypassed

**Verified. ACCEPT.**

Source evidence:

- `scripts/assert-nexapp-cwd-and-remote.mjs:92-96` · `APPROVED_REMOTE_FORMS = Object.freeze(["https", "ssh-shorthand", "ssh-long"])`. Frozen · a future refactor cannot silently widen it (test at line 54-56 pins `Object.isFrozen`).
- `scripts/assert-nexapp-cwd-and-remote.mjs:152-212` · `parseRemoteUrl(url)` is the only path to a non-null parse. It:
  1. Line 153-155 · rejects non-string and empty/whitespace input.
  2. Lines 163-164 · defines two character classes used by all three regexes:
     - `HOST = "[a-z0-9][a-z0-9.-]*"` · first char must be alphanumeric; subsequent chars limited to letters/digits/dot/hyphen. **No `:`** (ports blocked). **No `@`** (userinfo blocked). **No Unicode** (homoglyphs blocked). **No `[`** (IPv6 literals blocked).
     - `REPO = "[a-z0-9][a-z0-9._/-]*?"` · first char must be alphanumeric (**no leading slash** → rejects `//` in path). Non-greedy to allow trailing `.git` to be matched by the optional suffix group.
  3. Lines 168-171 · SSH shorthand regex `^git@HOST:REPO(\.git)?/*$` with `/i`. User literal is `git@` — **any other userinfo fails to match**. The `/i` flag only affects case, not the required literal `git`.
  4. Lines 183-186 · SSH long regex `^ssh://git@HOST/REPO(\.git)?/*$`. Same `git@` literal. No port permitted between host and `/`.
  5. Lines 198-201 · HTTPS regex `^https://HOST/REPO(\.git)?/*$`. No userinfo path. No `http://` branch (plaintext rejected). No port between host and `/`.
  6. Line 211 · falls through to `return null` for anything that didn't match.
- `scripts/assert-nexapp-cwd-and-remote.mjs:243-267` · `checkRemote` compares `parsed.host` to `EXPECTED_HOST` and `parsed.repoPath` to `EXPECTED_REPO_PATH` as **separate string equality checks**. Not substring. Not pattern match. A host-prefix (`evil.github.com`), host-suffix (`github.com.evil.com`), or sibling-path (`evil.com/github.com/...`) attack cannot slip through because the parsed `host` field would be `evil.github.com`, `github.com.evil.com`, or `evil.com` respectively — all unequal to `github.com`.

Each independent facet is enforced:

| Facet | Where enforced |
|---|---|
| Protocol allowlist | Three regexes in `parseRemoteUrl` (lines 168-209). No fourth branch, no fallthrough that could accept an unlisted protocol. |
| Hostname | `parseRemoteUrl` captures via the HOST class; `checkRemote` compares to `EXPECTED_HOST` (line 248). |
| Owner + repo | `parseRemoteUrl` captures via the REPO class; `checkRemote` compares to `EXPECTED_REPO_PATH` (line 257). |
| Credentials / userinfo | Only `git@` literal is accepted (SSH forms). No userinfo path in HTTPS regex. Any `user:pass@` or `attacker@` prefix fails to match. |
| Port | HOST class excludes `:`. SSH long requires `/` immediately after host. No regex permits `:<port>`. |
| Path strictness | REPO class excludes `/` as first char (rejects `//`), `?` (query strings), `#` (fragments), `%` (URL-encoded chars), control characters. |

Tests at lines 149-191 of the test file enumerate **24 scripted hostile-input scenarios** plus one non-string guard. Every one asserts `checkRemote(input).ok === false`.

Edge cases I probed by inspection against the regex (not just the test suite):

- `https://github.com.evil.com/philip2024394/nexapp.git` → HOST class matches `github.com.evil.com` → `checkRemote` compares to `github.com` → `wrong-host` ✓
- `https://github.com/philip2024394/nexapp.git/foo` → REPO lazy match extends to `philip2024394/nexapp.git/foo` (no `.git` suffix stripped) → `checkRemote` compares to `philip2024394/nexapp` → `wrong-repo` ✓
- `https://github.com/philip2024394/nexapp.gitt` → REPO expands to `philip2024394/nexapp.gitt` → `wrong-repo` ✓
- `https://github.com/philip2024394/nexapp.git#branch` → `#` not in REPO class → regex fails → `unparseable` ✓
- `https://github.com/philip2024394%2Fnexapp.git` → `%` not in REPO class → `unparseable` ✓
- `https://github.com./philip2024394/nexapp.git` (trailing dot in host) → HOST matches `github.com.` → `wrong-host` ✓
- `https://[::1]/philip2024394/nexapp.git` (IPv6) → `[` not in HOST class → `unparseable` ✓
- `git@github.com:philip2024394:nexapp.git` → `:` not in REPO class after `philip2024394` → regex fails → `unparseable` ✓
- `attacker@github.com:philip2024394/nexapp.git` → SSH shorthand regex requires literal `git@` → `unparseable` ✓
- `ssh://git@github.com:22/philip2024394/nexapp.git` → SSH long regex requires `/` immediately after HOST, not `:` → `unparseable` ✓

Residual observation (not a blocker): the REPO class allows `.` and `/` so a crafted path like `philip2024394/../nexapp` would parse (the regex doesn't resolve `..` as a filesystem operation). It would then fail the exact-string comparison with `philip2024394/nexapp` and be rejected as `wrong-repo`. Belt-and-braces — not a bypass.

### 3 · Fetch and push remotes are each validated

**Verified. ACCEPT.**

Source evidence:

- `scripts/assert-nexapp-cwd-and-remote.mjs:286-294` · fetch URL retrieved via `git remote get-url origin`, then passed through `checkRemote(fetchUrl)` at line 297.
- `scripts/assert-nexapp-cwd-and-remote.mjs:308-315` · push URL retrieved via `git remote get-url --push origin`. If `--push` is unsupported (older git versions), falls back to `fetchUrl` on line 314. The fallback is safe because `fetchUrl` has already passed `checkRemote` by that point.
- `scripts/assert-nexapp-cwd-and-remote.mjs:317-325` · the fallback value or distinct push URL is **re-run** through `checkRemote(pushUrl)` on line 317. Different values produce distinct `failure` enum values (`wrong-remote-fetch` vs `wrong-remote-push`) and distinct diagnostics.

Tests at lines 528-583 of the test file enumerate four distinct fetch/push mismatch scenarios:

- fetch correct, push drifted to trades
- fetch correct, push drifted to evil host
- fetch correct, push uses forbidden protocol (`git://`)
- fetch correct, push uses userinfo

All assert `exitCode === 1` and `failure === "wrong-remote-push"`.

The push fallback path when `--push` is unsupported is also pinned: test "exits 0 when `--push` is unsupported · falls back to fetch URL" at lines 410-422.

Edge case: if `git remote get-url --push origin` returns an **empty string** (rare, misconfigured git), the catch block is NOT triggered (empty return is not an exception). The empty string flows into `checkRemote("")` which returns `{ ok: false, reason: "unparseable" }`, correctly producing `wrong-remote-push`. Not explicitly tested but implicitly covered by the empty-remote test at the fetch stage (lines 505-514).

### 4 · Failed assertion exits non-zero; `predev` halts `npm run dev`

**Verified. ACCEPT.**

Source evidence:

- `scripts/assert-nexapp-cwd-and-remote.mjs:349-358` · CLI entry block. Guard clause `invokedAsCli` ensures the exit side-effect only runs when the file is invoked directly (via `node scripts/...`), not when imported from a test. On line 357 `process.exit(exitCode)` is called **unconditionally**; `exitCode` is sourced from `runAssertion()` at line 356.
- `runAssertion` returns one of six distinct `exitCode` values across its branches:
  - `0` on all green (line 332)
  - `1` on `no-toplevel` (line 285)
  - `1` on `wrong-root` (line 304)
  - `1` on `no-remote` (line 293)
  - `1` on `wrong-remote-fetch` (line 307)
  - `1` on `wrong-remote-push` (line 324)
- No code path returns from `runAssertion` without setting `exitCode` to one of these values.
- `package.json` line 6 declares `"predev": "node scripts/assert-nexapp-cwd-and-remote.mjs"` before `"dev"` (line 7, unchanged `"next dev -p 3008"`).

npm's documented lifecycle semantics (since npm 3): if `pre<script>` exits non-zero, the main `<script>` does not run. Confirmed npm-standard behaviour.

Live evidence from the hardening report §5:

```
$ node scripts/assert-nexapp-cwd-and-remote.mjs
exit=0
```

Silent exit 0 against the real repo. The guard is observably functional.

### 5 · 112 tests genuinely exercise the exported implementation

**Verified. ACCEPT.**

Source evidence:

- `scripts/__tests__/assert-nexapp-cwd-and-remote.test.mjs:18-29` · imports `canonicalisePathForCompare`, `parseRemoteUrl`, `checkCwd`, `checkRemote`, `runAssertion`, and all four policy constants directly from the module under test. Not re-declared.
- Pure-helper tests call the imported functions on each input and assert on their real return values. The test file does **not** contain any re-implementation of regex matching, path normalisation, or protocol parsing. The only logic the test file owns is a `makeExec` helper (lines 445-460) that scripts a mock git subprocess for `runAssertion`.
- Integration tests at lines 465-583 invoke `runAssertion({ exec: scriptedExec, log: quietLog })`. The injected `exec` responds to the EXACT git calls the implementation makes (`rev-parse --show-toplevel`, `remote get-url origin`, `remote get-url --push origin`). All branching logic, regex matching, string comparison, canonicalisation, and emit-ordering runs with the REAL implementation — only the external edge (git subprocess + stderr sink) is injected.
- A spot-check example: test at test file lines 494-504 ("REJECTS: toplevel is C:/evil/nexapp") passes `"C:/evil/nexapp"` to `runAssertion` via the mock, which exercises `canonicalisePathForCompare` → `checkCwd` → the real wrong-root branch. The test asserts `r.exitCode === 1 && r.failure === "wrong-root"` and also asserts `r.messages.some(m => m.includes("c:/evil/nexapp"))` — the canonical form string literally produced by the real `canonicalisePathForCompare` function.

Mocks mock the right thing:

| Mocked | Why |
|---|---|
| `exec` (git subprocess) | External edge · tests must be deterministic and offline |
| `log` (stderr) | Keeps test output clean · `messages` array still captures what was emitted |

Not mocked:

| Not mocked | Why |
|---|---|
| `path.win32.resolve` | Core normalisation · tests should see real behaviour |
| regex matching inside `parseRemoteUrl` | Core policy enforcement |
| Comparison inside `checkCwd` / `checkRemote` | Core identity enforcement |
| Branch sequencing inside `runAssertion` | Must be real |

Observability tests at lines 598-680 scan `r.messages` for literal `[nexapp-guard] FAIL …` and `[nexapp-guard] Fix …` lines emitted by the real implementation.

### 6 · Documented limitations are accurate

**Verified. ACCEPT.**

Source evidence for the two headline limitations:

- **Direct `next dev` bypass** · `scripts/assert-nexapp-cwd-and-remote.mjs:36-41` states "The hook fires only when the dev server is launched through `npm run dev`. Direct invocation of `next dev` bypasses the guard. This is a lifecycle-hook limitation, not an audit gap." Confirmed accurate: the `predev` lifecycle fires only on npm's dispatch of the `dev` script, not when `next dev` is invoked out-of-band. The accompanying `scripts/assert-nexapp-cwd-and-remote.mjs:38-39` acknowledges this cleanly: "lifecycle-hook limitation, not an audit gap" — no "universal enforcement" claim.
- **Hardcoded expected checkout path** · `scripts/assert-nexapp-cwd-and-remote.mjs:59-64` states "Hardcoded per the Phase 3A hardening authorisation 2026-10-14. If nexapp is cloned to a different path, this constant AND the test fixtures must both be updated · deliberately NOT configurable via env var so the policy cannot be weakened at runtime." Confirmed accurate: `EXPECTED_REPO_ROOT` at line 65 is a plain `const` exported string. There is no `process.env` read anywhere in the file. There is no override mechanism. The test file at line 35 asserts the exact value, locking the policy at the regression-test level.

Third limitation (git on PATH) at `scripts/assert-nexapp-cwd-and-remote.mjs:42-43` is also accurate: `execFileSync` throws when `git` is not resolvable, which the catch block at line 282 translates to the `no-toplevel` failure path with an actionable `Fix` message. Tests at lines 486-493 pin this behaviour.

Hardening report §7 lists five residual limitations (direct `next dev` bypass, non-`origin` remote drift, git-on-PATH requirement, hardcoded path tradeoff, future `pre-push` hook idea). Each is accurate against the current implementation.

---

## Minor observations · for a future phase (not blockers)

1. **Defensive absolute-path check.** `path.win32.resolve('relative-input')` would use `process.cwd()`. Git's `rev-parse --show-toplevel` never emits relative paths, so this is a theoretical gap. A one-line `path.win32.isAbsolute` check after the MINGW normalisation would close it.
2. **IPv6 literal rejection via dedicated test.** The HOST regex already excludes `[`, but no explicit test asserts `https://[::1]/philip2024394/nexapp.git` is rejected. Easy to add.
3. **Path-with-`..` rejection via dedicated test.** The REPO class allows `.` so `../` in a repo path parses, but it still fails the exact-string comparison. Belt-and-braces test would be nice.
4. **Non-`origin` remote drift.** Guard only inspects `origin`. A stale `upstream` pointing at `trades.git` would not be caught. Fine for now; `git push` defaults to `origin`.
5. **Git `pre-push` hook.** Would extend enforcement beyond the `npm run dev` surface. Not scoped for Phase 3A.

None of these change the Phase 3A verdict. Each is a bounded one-file follow-up when the owner authorises.

---

## Boundary compliance

- Strictly read-only. The only file created in this verification session is **this report**.
- No code rewritten. No implementation rerun. The 112-test suite was not executed in this session (results relied on prior session's recorded output in the hardening report, which this review has independently audited via source inspection).
- No secrets, databases, live services, deployments, dependencies installed.
- No process started or stopped. The dev server at PID 7172 is untouched.
- No port change. No git state change (no add/commit/push/pull/stash/checkout/reset).
- No D:/trades file read or write.
- Stage 1.1 code, migration 197, migrations 191-196, Vault, Bridge 99, Hammerex, Chat Master Layout · untouched.
- `package.json`, `scripts/assert-nexapp-cwd-and-remote.mjs`, `scripts/__tests__/assert-nexapp-cwd-and-remote.test.mjs` · READ ONLY, not modified in this session.
- 29 pre-existing nexapp working-tree modifications preserved verbatim.

---

## Phase 3A acceptance

**Phase 3A is accepted.**

| Acceptance point | Verdict |
|---|---|
| 1 · Expected root compared via canonical absolute path with Windows + MINGW handling | ACCEPT |
| 2 · Remote parser validates protocol, host, owner, repo, userinfo, port, path independently | ACCEPT |
| 3 · Fetch and push each validated against the approved identity | ACCEPT |
| 4 · Failed assertion exits non-zero; `predev` halts `npm run dev` | ACCEPT |
| 5 · 112 tests exercise the real exported implementation, not duplicated logic | ACCEPT |
| 6 · Documented limitations are accurate | ACCEPT |

The repository guard work is closed. The next queued task (per the owner's stated roadmap) is a **read-only inventory of load-bearing NEX doctrine documents** — identify what belongs in nexapp, what already exists there, and what should remain historical reference in D:/trades, with source and destination paths listed but **no files copied**.

Stage 1.1 Option C (fail-closed rate-limit with bounded retry) remains an independent workstream. Migration 197 remains unapplied. Both are untouched by this verification.

Stopping. Awaiting owner decision on whether to proceed with the doctrine inventory, Stage 1.1 Option C, or any other task.
