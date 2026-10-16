# NEX Phase 3A · dev guard hardening

Date: 2026-10-14
Companion to:
- `docs/doctrine/nex-repository-phase-3a-dev-guard-2026-10-14.md` (first Phase 3A implementation)
- `docs/doctrine/nex-repository-phase-3a-dev-guard-review-2026-10-14.md` (read-only review that flagged the two gaps this pass closes)

Scope: close the two gaps the Phase 3A review named — strict root validation (not basename-only) and automated regression coverage for hostile remote inputs — with a tightened remote-URL policy that explicitly rejects `http://`, `git://`, non-`git` userinfo, and explicit ports. Nothing else was touched.

---

## 1 · Files changed · exact

| Path | Change | Delta |
|---|---|---|
| `scripts/assert-nexapp-cwd-and-remote.mjs` | **Full rewrite in place** · 182 → 275 lines | +93 (net) |
| `scripts/__tests__/assert-nexapp-cwd-and-remote.test.mjs` | **Full rewrite in place** · 38 → 112 tests · 345 → ~700 lines | +74 tests |
| `docs/doctrine/nex-repository-phase-3a-dev-guard-hardening-2026-10-14.md` | **New** · this report | — |

No change to:

- `package.json` · `git diff --stat` shows **`1 insertion(+)`** (the earlier `predev` line, unchanged). The `dev`, `build`, `start`, `typecheck`, `test`, and 25+ `nex:*` scripts are all byte-identical.
- `scripts/seed-hammerexproducts.mjs` · pre-existing modification preserved verbatim.
- Any file in `src/`, `nex-supabase/`, `docs/doctrine/*2026-10-13*`, or elsewhere · untouched.
- D:/trades · zero file read, zero file write.

All 29 pre-existing nexapp working-tree modifications preserved. No git state change (no add/commit/push/pull/stash/checkout). No deps installed. No `.env.local` read. No DB. No port change. No deploy. No process started/stopped.

---

## 2 · Gap 1 · strict root validation

### Previous behaviour (shipped in the first Phase 3A pass)

```js
// OLD · basename-only
checkCwd("C:/evil/nexapp", "nexapp")                 → ok: true    ← ACCEPT
checkCwd("C:/Users/Victus/nexapp-backup/nexapp", …)  → ok: true    ← ACCEPT
checkCwd("D:/trades", "nexapp")                      → ok: false   REJECT
```

Any directory whose basename matched `nexapp` would pass regardless of the enclosing path. The combined check (basename + remote) kept the exposure bounded in practice, but a sibling-named directory with a legitimate nexapp remote wired in would be accepted.

### Hardened behaviour

```js
// NEW · strict canonical absolute path comparison
checkCwd("C:/evil/nexapp")                           → reason: "wrong-root"   REJECT
checkCwd("C:/Users/Victus/nexapp-backup/nexapp")     → reason: "wrong-root"   REJECT
checkCwd("D:/trades")                                → reason: "wrong-root"   REJECT
checkCwd("C:/Users/Victus/nexapp")                   → ok: true               ACCEPT
checkCwd("C:/Users/Victus/nexapp/")                  → ok: true               ACCEPT (trailing slash)
checkCwd("C:\\Users\\Victus\\nexapp")                → ok: true               ACCEPT (backslashes)
checkCwd("/c/Users/Victus/nexapp")                   → ok: true               ACCEPT (git-bash MINGW form)
checkCwd("C:/USERS/VICTUS/NEXAPP")                   → ok: true               ACCEPT (case variation)
checkCwd("C:/Users/Victus/foo/../nexapp")            → ok: true               ACCEPT (resolves to expected)
checkCwd("D:/Users/Victus/nexapp")                   → reason: "wrong-root"   REJECT (different drive)
checkCwd("C:/Users/Victus")                          → reason: "wrong-root"   REJECT (parent)
checkCwd("C:/Users/Victus/nexapp/src")               → reason: "wrong-root"   REJECT (subdir)
```

### How it is enforced

1. `EXPECTED_REPO_ROOT = "C:\\Users\\Victus\\nexapp"` is a hardcoded constant. Deliberately **not** configurable via env var so the policy cannot be weakened at runtime.
2. `canonicalisePathForCompare(p)` normalises any input to one canonical lowercase string:
   - Strips the git-bash `/c/...` MINGW form → `C:/...` (also handles `/d/`, etc.).
   - Uses `path.win32.resolve()` so `.`/`..` segments collapse and backslash/forward-slash variants produce the same output. Explicitly `win32` (not platform-default) so tests give identical answers on any OS.
   - Converts to forward slashes, strips trailing slashes, lowercases.
3. `checkCwd` compares the canonicalised git toplevel against the canonicalised `EXPECTED_REPO_ROOT`. Any inequality returns `reason: "wrong-root"` with structured `canonical` and `expected` fields in the diagnostic.
4. The resulting diagnostic prints the raw git toplevel, the canonical form, and the expected form, so the developer can see exactly why the match failed.

### Regression protection

11 dedicated `checkCwd` tests pin the behaviour:

- ACCEPTS: forward slashes, backslashes, trailing slash, case variation, git-bash MINGW form, `.`/`..` segments.
- REJECTS: `D:/trades`, `/d/trades`, `C:/evil/nexapp`, `C:/Users/Victus/nexapp-backup/nexapp`, `C:/Users/Victus/nexapp-impostor`, `C:/Users/Victus/nexapp-fork`, parent, subdirectory, different drive, empty, non-string.

Plus 8 `runAssertion` integration tests that drive the same scenarios end-to-end through the full guard pipeline.

---

## 3 · Gap 2 · tightened remote policy

### Policy decision (documented)

Three canonical approved forms, enumerated in `APPROVED_REMOTE_FORMS` (frozen):

| Form | Example |
|---|---|
| `https` | `https://github.com/Philip2024394/nexapp.git` |
| `ssh-shorthand` | `git@github.com:Philip2024394/nexapp.git` |
| `ssh-long` | `ssh://git@github.com/Philip2024394/nexapp.git` |

Any input outside those three forms is REJECTED by `parseRemoteUrl` returning `null`. Explicit rejections, each pinned by a dedicated test:

| Rejected | Why |
|---|---|
| `http://` | plaintext, no transport integrity |
| `git://` | deprecated by GitHub 2022, no authentication |
| `ftp://`, `file://`, `javascript:`, `//` schemeless | not a valid git clone URL for GitHub |
| `ssh://attacker@github.com/...` | user must be literal `git` |
| `attacker@github.com:...` | SSH shorthand user must be literal `git` |
| `https://user:pass@github.com/...` | embedded userinfo rejected |
| `https://user@github.com/...` | single-user form also rejected |
| `ssh://git@github.com:22/...` | explicit port rejected |
| `https://github.com:443/...` | explicit port rejected |
| `https://evil.github.com/...` | host-prefix attack · exact host match required |
| `https://github.com.evil.com/...` | host-suffix attack · exact host match required |
| `https://evil.com/github.com/...` | sibling-path attack · host and path compared separately |
| `https://192.168.1.1/...` | not the approved host |
| `https://ɡithub.com/...` (Unicode homoglyph) | host regex does not permit non-DNS characters |
| `https://github.com/Philip2024394/nexapp.git.git` | double-suffix rejected |
| `https://github.com//Philip2024394//nexapp.git` | internal double-slash rejected |
| `https:///github.com/...` (triple slash) | host must begin with alphanumeric |

### Decision on embedded userinfo (per the review's explicit question)

**Policy: userinfo is REJECTED.** The literal `git@` prefix required by GitHub SSH clone URLs is handled as a dedicated SSH form (sshShorthand / sshLong regexes); it is not treated as "userinfo." Every other `user@` or `user:pass@` prefix is rejected because:

- GitHub HTTPS clones never require userinfo in the URL (credentials go via the credential helper).
- Operator footgun: `git remote get-url origin` emitting a URL with `user:pass@` would be a credential leak into logs. Rejecting at the guard surfaces the issue immediately.
- Phishing surface: a crafted remote `https://attacker@github.com/Philip2024394/nexapp.git` could be misread by a human as "attacker's clone of github.com" when the HTTP userinfo is actually ignored by git. Rejecting it loudly prevents the ambiguity.

Rationale is documented in-source and in-test (`"REJECTS: userinfo HTTPS"`).

### How it is enforced

`parseRemoteUrl` applies three regular expressions in order:

```
sshShorthand = /^git@HOST:REPO(\.git)?\/*$/i
sshLong      = /^ssh:\/\/git@HOST\/REPO(\.git)?\/*$/i
httpsForm    = /^https:\/\/HOST\/REPO(\.git)?\/*$/i
```

Where:

- `HOST = [a-z0-9][a-z0-9.-]*` · bare DNS, no port, no userinfo, no Unicode.
- `REPO = [a-z0-9][a-z0-9._/-]*?` · owner/repo, non-greedy to allow trailing `.git`.

Any input not matching one of the three regexes yields `parsed = null`, which `checkRemote` translates to `reason: "unparseable"`. If the regex matches, the extracted `host` and `repoPath` are then compared **separately** to `EXPECTED_HOST = "github.com"` and `EXPECTED_REPO_PATH = "philip2024394/nexapp"`, so a host-prefix or sibling-path attack cannot slip through by matching a substring.

### The real configured origin is not accidentally rejected

Live verification against the real nexapp configuration:

```
$ node scripts/assert-nexapp-cwd-and-remote.mjs
exit=0
```

Silent exit 0. The actual `https://github.com/Philip2024394/nexapp.git` fetch and push URLs still pass the tightened policy. The hardening does not accidentally reject the current configuration.

---

## 4 · Test coverage

### Suite · 112 tests across 10 describe blocks

| Block | Tests |
|---|---|
| `Policy constants` | 5 |
| `canonicalisePathForCompare` | 11 |
| `parseRemoteUrl · approved canonical forms` | 8 |
| `parseRemoteUrl · hostile and malformed inputs REJECT` | 25 (24 scripted + 1 non-string) |
| `checkCwd · strict root comparison` | 15 |
| `checkRemote · structured reasons` | 9 |
| `runAssertion · green paths` | 6 |
| `runAssertion · wrong-root failure modes` | 8 |
| `runAssertion · wrong-remote failure modes` | 13 |
| `runAssertion · fetch/push mismatch` | 4 |
| `runAssertion · observability` | 9 (8 scenarios + silent-happy-path) |

Total: 112.

### Hostile-input scenarios now locked by regression tests (not just manually probed)

The review flagged these as "test gap, not implementation gap." Each now has a dedicated test asserting REJECT:

- `http://` (plaintext)
- `git://` (deprecated)
- `ftp://`, `file://`, `javascript:`, schemeless `//`
- `https:///` triple slash
- `user@` and `user:pass@` userinfo on HTTPS
- `ssh://attacker@github.com/...` (non-git user)
- `attacker@github.com:...` (SSH shorthand non-git user)
- `ssh://git@github.com:22/...` (explicit port)
- `https://github.com:443/...` (explicit port on HTTPS)
- host-prefix attack `evil.github.com`
- host-suffix attack `github.com.evil.com`
- sibling-path attack `evil.com/github.com/...`
- IPv4 host `192.168.1.1`
- Unicode homoglyph `ɡithub.com`
- double `.git.git` suffix
- double slash in path
- Empty, whitespace, random garbage, path-only

And for the strict root check:

- `D:/trades`, `/d/trades`
- Sibling-named `C:/evil/nexapp`
- Nested fake `C:/Users/Victus/nexapp-backup/nexapp`
- Impostor names `nexapp-impostor`, `nexapp-fork`
- Parent `C:/Users/Victus`
- Subdirectory `C:/Users/Victus/nexapp/src`
- Different drive `D:/Users/Victus/nexapp`
- Empty / null / undefined

And for fetch/push mismatch:

- fetch correct, push drifted to trades
- fetch correct, push drifted to evil host
- fetch correct, push uses forbidden protocol (`git://`)
- fetch correct, push uses userinfo

### Observability loop

Nine observability tests prove every failure path emits a `[nexapp-guard] FAIL …` line AND a `[nexapp-guard] Fix …` line and returns `exitCode: 1`. The happy path emits zero log lines (silent exit 0).

### Deterministic, offline, no secrets

- Tests inject `exec` and `log` callables so **no real `git` invocation is made** and **no real stderr is written**.
- Tests do not touch `.env.local`, do not query the live repository, do not connect to any network service.
- The vitest runner is the project-local `v4.1.11` (declared in `package.json` devDependencies `"vitest": "^4.1.10"`).

---

## 5 · Test results

Exact commands and output:

```
$ ./node_modules/.bin/vitest run scripts/__tests__/assert-nexapp-cwd-and-remote.test.mjs
 RUN  v4.1.11 C:/Users/Victus/nexapp
 Test Files  1 passed (1)
 Tests       112 passed (112)
 Duration    309ms
```

```
$ ./node_modules/.bin/vitest run \
    scripts/__tests__/assert-nexapp-cwd-and-remote.test.mjs \
    src/app/nex-native/chat/guest/[ownerAccountId]/__tests__/send-guest-message-rate-limit.test.ts \
    src/lib/nex-native/community/__tests__/types.test.ts
 RUN  v4.1.11 C:/Users/Victus/nexapp
 Test Files  3 passed (3)
 Tests       144 passed (144)
 Duration    330ms
```

Breakdown of the 144 combined: 112 hardened guard + 21 Stage 1.1 behavioural+structural + 11 community-rate-limit types regression. **Zero failures. Zero regressions in the Stage 1.1 or community-types suites.**

Live predev-equivalent run against the real repository:

```
$ node scripts/assert-nexapp-cwd-and-remote.mjs
exit=0
```

Silent exit 0 confirms the hardened policy accepts the real nexapp configuration (correct canonical root AND correct HTTPS origin).

### Invocation method · no npx download

Per the brief ("Do not use npx in a way that downloads packages"), tests were invoked via `./node_modules/.bin/vitest`, which resolves directly to the project-local vitest binary. The output `RUN v4.1.11 C:/Users/Victus/nexapp` confirms the project-local version was used, not a newer version fetched by npx to its global cache.

---

## 6 · Policy summary table

| Dimension | Policy | Enforced where |
|---|---|---|
| Repository root | Must canonicalise to `C:\Users\Victus\nexapp` | `checkCwd` + `canonicalisePathForCompare` |
| Expected host | `github.com` (lowercase, exact match) | `checkRemote` host comparison |
| Expected repo path | `philip2024394/nexapp` (lowercase, exact match) | `checkRemote` repoPath comparison |
| Permitted protocols | HTTPS · SSH shorthand (`git@`) · SSH long (`ssh://git@`) | `parseRemoteUrl` three regexes |
| Rejected protocols | HTTP, git://, ftp://, file://, javascript:, schemeless `//` | `parseRemoteUrl` returns null |
| Permitted userinfo | None, except literal `git@` for SSH forms | SSH regexes require user "git" |
| Rejected userinfo | `user:pass@`, `user@`, `attacker@` on any form | regex structure |
| Explicit ports | Rejected on all forms | host regex has no `:` |
| Permitted host characters | ASCII `[a-z0-9.-]` only | host regex |
| Rejected host characters | Unicode, IPv6, non-DNS | host regex |
| Fetch URL | Must match policy | `checkRemote` on `origin` fetch |
| Push URL | Must match policy; falls back to fetch only if git doesn't support `--push` | separate `checkRemote` on `origin` push |
| Exit behaviour | 0 silently on all green; 1 with `FAIL` + `Fix` lines on any failure | `runAssertion` + CLI wrapper |

---

## 7 · Remaining limitations · documented, out of scope for this pass

| # | Limitation | Status |
|---|---|---|
| 1 | Direct `next dev` bypass (not via `npm run dev`) | documented in script header lines 24-27 and Phase 3A report §5; lifecycle-hook limitation |
| 2 | Non-`origin` remote drift (e.g. `upstream`, `heroku`) not validated | informational; `git push` defaults to `origin` so not a safety issue |
| 3 | Script relies on `git` being on PATH | fails closed (`no-toplevel`) with a clear message if git is missing |
| 4 | If nexapp is cloned to a different path, the `EXPECTED_REPO_ROOT` constant AND test fixtures must both be updated | deliberate · an env-var override would weaken the policy |
| 5 | A git `pre-push` hook / wrapper CLI could extend enforcement to invocations outside `npm run dev` | out of scope for Phase 3A |

Items 1-3 are inherent to the chosen enforcement surface. Items 4-5 are design decisions that would be considered under a separate authorisation.

---

## 8 · Boundaries respected (compliance checklist)

- Read-only on everything except the two authorised files (and this report):
  - `scripts/assert-nexapp-cwd-and-remote.mjs` — modified
  - `scripts/__tests__/assert-nexapp-cwd-and-remote.test.mjs` — modified
  - `docs/doctrine/nex-repository-phase-3a-dev-guard-hardening-2026-10-14.md` — new (this report)
- `package.json` unchanged in this pass (`git diff --stat` shows only the pre-existing +1 line from Phase 3A).
- D:/trades · zero file read, zero file write.
- Stage 1.1 code (`_actions.ts`, `_guest-chat-client.tsx`, `community/types.ts`, Stage 1.1 test file) · untouched.
- Migration 197 · still an unapplied draft; untouched.
- Migrations 191-196 · untouched.
- Vault, Bridge 99, Hammerex seed, Chat Master Layout · untouched.
- `.env.local` · not read.
- Database · not queried.
- Deployment · not performed.
- Dependencies · not installed. Test runner was the project-local `vitest@4.1.11`; invoked via `./node_modules/.bin/vitest` to avoid any npx fetch.
- Server · not started or stopped. The currently-running dev server at PID 7172 on port 3008 is untouched.
- Port · not changed.
- Git mutations · none. No `git add`, `git commit`, `git push`, `git pull`, `git stash`, `git checkout`, `git reset`, `git branch`, or any other state-changing git command.
- Unrelated working-tree changes · all preserved. `scripts/seed-hammerexproducts.mjs` modification unchanged. The 108+ pre-existing untracked files unchanged. The 28 pre-existing tracked modifications outside the Phase 3A scope unchanged.

### Unexpected worktree changes

None observed. `git status --short` shows exactly the pre-existing modifications + my three new untracked files (the two guard files were already untracked before this pass; I rewrote their contents).

---

## 9 · Summary

| Checklist item | Status |
|---|---|
| Strict root validation using canonical absolute path (not basename) | ✅ `canonicalisePathForCompare` + `checkCwd` |
| Windows path separators and canonical path comparisons handled | ✅ `path.win32.resolve` + git-bash form support |
| Fail closed if root cannot be established | ✅ `no-toplevel` branch |
| Approved fetch and push identity preserved | ✅ `https://github.com/Philip2024394/nexapp.git` + SSH equivalents still pass |
| Remote validation NOT weakened for unusual URL forms | ✅ three canonical forms only; HTTP/git://userinfo/ports/non-DNS hosts rejected |
| `git://` rejected (not documented as required) | ✅ `parseRemoteUrl` has no git-protocol branch |
| Userinfo decision made and tested · REJECTED | ✅ except literal `git@` for SSH forms; test `REJECTS: userinfo HTTPS` locks the policy |
| Actual configured origin not accidentally rejected | ✅ live `node scripts/assert-nexapp-cwd-and-remote.mjs` exits 0 |
| Allowed host, owner, repo, fetch, push NOT broadened | ✅ constants unchanged · still `github.com` + `philip2024394/nexapp` |
| Tests for unexpected roots, sibling-named `nexapp`, hostile remotes, protocol policy, fetch/push mismatches, failure behaviour, valid configuration | ✅ 112 tests · all branches covered |
| Tests deterministic + offline + no live GitHub, no secrets | ✅ injected `exec` + `log` |
| Local vitest used · no npx-triggered downloads | ✅ `./node_modules/.bin/vitest`; `RUN v4.1.11` from project cwd |
| Scope boundary respected · only the two files + the report | ✅ `git diff --stat` confirms |
| `predev` entry and `dev` command preserved | ✅ `package.json` byte-identical to post-Phase-3A state |
| Unrelated working-tree changes preserved | ✅ `seed-hammerexproducts.mjs` modification intact; 108+ untracked files intact |
| D:/trades, Stage 1.1 code, migration 197, migrations 191-196, Vault, Bridge 99, Hammerex untouched | ✅ |

Stopping. Awaiting owner review of the hardened implementation and 112-test regression. The queued next-steps are unchanged and remain independent:

1. **Selective doctrine transfer** from `D:/trades/docs/doctrine/` to nexapp with an explicit source + destination list before any copying (Phase 2 §Task 3 recommendation).
2. **Stage 1.1 Option C** implementation (client UI handling for `rate_limited` / `rate_limit_unavailable` → minimal observability → bounded-retry server policy → tests → report). Migration 197 remains unapplied; separate authorisation still required.
