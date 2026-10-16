# NEX repository separation · Phase 3A · nexapp-only development guard

Date: 2026-10-14
Companion to:
- `docs/doctrine/nex-repository-identity-audit-2026-10-14.md` (Phase 1)
- `docs/doctrine/nex-repository-phase-2-feature-preservation-2026-10-14.md` (Phase 2 · the Option α proposal this phase implements)

Scope: implement the smallest safe pre-dev guard that refuses to launch Next.js if the current repository root or `origin` remote does not match nexapp. Approved per owner authorisation.

Boundaries honoured end-to-end:

- No D:/trades file read or write · no port change · no process started or stopped (except the guard script itself and the test runner).
- No `.env.local` opened · no DB · no migration applied · no deploy · no dependency installed (verified below).
- No git state change · no stage, commit, push, pull, or branch change.
- Hammerex, theme-commerce migrations 191-196, migration 197, Stage 1.1 rate-limit code, Vault, and all other sealed surfaces: **not touched**.
- Doctrine documents (the Phase 2 §Task 3 inventory): **not transferred** in this pass.
- All 29 pre-existing working-tree modifications preserved verbatim.

---

## 1 · Files changed · exact

| Path | Change | Delta | Notes |
|---|---|---|---|
| `scripts/assert-nexapp-cwd-and-remote.mjs` | **New** · 182 lines | +182 | Fail-closed guard · pure helpers + CLI wrapper · ESM `.mjs` matching sibling script convention |
| `scripts/__tests__/assert-nexapp-cwd-and-remote.test.mjs` | **New** · 345 lines · 38 tests | +345 | Mocked `exec` + silent `log` injection · never touches real git config |
| `package.json` | **Modified** · one line added, no deletion | +1 / −0 | `"predev": "node scripts/assert-nexapp-cwd-and-remote.mjs"` inserted immediately above the existing `"dev": "next dev -p 3008"` |
| `docs/doctrine/nex-repository-phase-3a-dev-guard-2026-10-14.md` | **New** · this report | — | audit record |

Exact `package.json` git diff:

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

That is the full extent of the `package.json` change. The existing `dev` script keeps its `-p 3008` flag, and no other script was touched.

---

## 2 · What the guard does

### Checks run in order, each fail-closed

1. **Resolve git toplevel** via `git rev-parse --show-toplevel`.
   - Fail-closed on exception (git missing, not inside a git repo).
   - Diagnostic: `[nexapp-guard] FAIL · could not resolve the git repository root.` + fix line pointing at `C:/Users/Victus/nexapp`.
2. **Validate toplevel basename equals `nexapp`** (case-insensitive, Windows backslashes tolerated, trailing slash tolerated).
   - Fail-closed if the basename does not match.
   - Diagnostic includes the actual toplevel (useful signal when a developer accidentally runs from `D:/trades`) and a pointer to the Phase 1 audit doctrine.
3. **Resolve `origin` fetch URL** via `git remote get-url origin`.
   - Fail-closed on exception (no origin configured).
4. **Normalise the fetch URL and compare against `github.com/philip2024394/nexapp`**.
   - Normalisation strips protocol prefix (`https://` / `http://` / `ssh://`), optional SSH `git@host:` prefix, trailing `.git`, and trailing slashes · lowercases the result.
   - Fail-closed if the normalised URL is not an accepted identity.
5. **Resolve `origin` push URL** via `git remote get-url --push origin`.
   - If the `--push` flag is unsupported by the local git version, falls back to the already-validated fetch URL (does NOT fail-closed on that specific error, since the fetch URL stands in for a repo whose push URL is not separately configured).
6. **Normalise the push URL and compare**.
   - Fail-closed if the push URL has drifted from the fetch URL to a different repo.

### Success behaviour

Silent exit 0. `next dev` proceeds normally.

### Failure behaviour

Exit 1 with structured stderr lines. Every failure path emits:

- A `[nexapp-guard] FAIL · <reason>` opening line.
- One or more `[nexapp-guard]   <evidence>` lines showing exactly what was observed.
- One or more `[nexapp-guard] Fix · <action>` lines telling the developer how to self-serve (typically `cd C:/Users/Victus/nexapp && npm run dev`).
- Pointer to `docs/doctrine/nex-repository-identity-audit-2026-10-14.md` for context on the D:/trades / nexapp split (included on the `wrong-root` branch where it is most useful).

Each failure also returns a stable `failure` enum value in the `runAssertion` return object: `no-toplevel`, `wrong-root`, `no-remote`, `wrong-remote-fetch`, or `wrong-remote-push`. Tests pin on this enum so a future refactor cannot silently reorder the branches.

### Accepted remote identity

Normalisation collapses to one canonical form: `github.com/philip2024394/nexapp`. This accepts every normal variant without being lax:

- `https://github.com/Philip2024394/nexapp.git` ✓
- `https://github.com/Philip2024394/nexapp` ✓
- `https://github.com/Philip2024394/nexapp.git/` ✓
- `http://github.com/Philip2024394/nexapp.git` ✓
- `git@github.com:Philip2024394/nexapp.git` ✓
- `ssh://git@github.com/Philip2024394/nexapp.git` ✓
- `https://github.com/PHILIP2024394/NEXAPP.git` ✓ (GitHub owner/repo is case-insensitive)
- `https://github.com/Philip2024394/trades.git` ✗ · normalises to `github.com/philip2024394/trades` which is not in the whitelist

`ACCEPTABLE_REMOTE_NORMS` is a frozen array · the invariant test verifies `Object.isFrozen` so a future contributor cannot silently add a second entry.

### Known limitation (documented in the script)

The hook fires only when the dev server is launched through `npm run dev`. A direct invocation of `next dev` bypasses the guard. This is a lifecycle-hook limitation, not an audit gap. The in-source comment at `scripts/assert-nexapp-cwd-and-remote.mjs:28-33` is explicit about this.

---

## 3 · Test coverage and results

### Design

The heavy lifting lives in `runAssertion({ exec, log })` which accepts injected `exec` and `log` callables. Tests pass a `makeExec(responses)` factory that answers a scripted set of `git <args>` calls (and raises test-authored `Error` instances to simulate git failures). The `log` sink is a no-op `() => undefined` so test output is clean.

**No test touches real git.** The real `git` binary is never invoked in any test case. The real `origin` remote is never queried. The real toplevel is never asked. Even the real `child_process.execFileSync` is never reached from the test file.

### Suite · 38 tests across 7 describe blocks

| Block | Tests | What it exercises |
|---|---|---|
| `normalizeRemoteUrl` | 9 | strip-.git · trailing slash · http vs https · SSH form · ssh:// explicit protocol · case-insensitive · null/empty rejection · trades-vs-nexapp disambiguation |
| `normalizePathForCompare` | 4 | Windows backslash → forward slash · trailing slash strip · lowercase · non-string input |
| `checkCwd` | 6 | valid toplevel (POSIX) · valid toplevel (Windows backslash) · trailing slash tolerance · D:/trades rejection · empty rejection · non-string rejection |
| `checkRemote` | 6 | canonical HTTPS .git · HTTPS no-.git · SSH · trades rejection · empty rejection · non-string rejection |
| `ACCEPTABLE_REMOTE_NORMS` | 2 | contains exactly one canonical identity · array is frozen |
| `runAssertion · valid state` | 3 | HTTPS fetch+push · SSH fetch+push · `--push` unsupported fallback to fetch URL |
| `runAssertion · failure modes` | 6 | wrong root (D:/trades) · git missing · no origin · wrong fetch URL (trades) · wrong push URL (fetch ok, push drifted) · empty fetch URL |
| `runAssertion · observability` | 2 | every failure path emits a `FAIL` line AND a `Fix ·` line · happy path emits no stderr noise |

### Results

```
$ npx vitest run scripts/__tests__/assert-nexapp-cwd-and-remote.test.mjs

RUN  v4.1.11 C:/Users/Victus/nexapp
Test Files  1 passed (1)
Tests       38 passed (38)
Duration    293ms
```

### Combined regression

```
$ npx vitest run src/app/nex-native/chat/guest/[ownerAccountId]/__tests__/send-guest-message-rate-limit.test.ts \
                 src/lib/nex-native/community/__tests__/types.test.ts \
                 scripts/__tests__/assert-nexapp-cwd-and-remote.test.mjs

Test Files  3 passed (3)
Tests       70 passed (70)
Duration    347ms
```

21 Stage 1.1 behavioural+structural tests + 11 community types tests + 38 Phase 3A tests. **70/70 pass. Zero regressions.**

### Live-cwd verification

Running the real `predev` hook against the real git config (safe · does not start the dev server):

```
$ npm run predev
> nexapp@0.1.0 predev
> node scripts/assert-nexapp-cwd-and-remote.mjs

(silent)
exit=0
```

Silent exit 0 confirms the guard accepts the current real state (cwd = `C:/Users/Victus/nexapp`, remote = `https://github.com/Philip2024394/nexapp.git`).

Direct script invocation produces the identical result:

```
$ node scripts/assert-nexapp-cwd-and-remote.mjs
exit=0
```

### `dev` script integrity after the edit

Read of `package.json` after the edit confirms every pre-existing script survives verbatim:

```
"predev":  "node scripts/assert-nexapp-cwd-and-remote.mjs"   ← new
"dev":     "next dev -p 3008"                                 ← unchanged · -p 3008 preserved
"build":   "next build"                                       ← unchanged
"start":   "next start -p 3008"                               ← unchanged
"typecheck": "tsc --noEmit"                                   ← unchanged
"test":    "vitest run"                                       ← unchanged
"test:watch": "vitest"                                        ← unchanged
… and all 25+ nex:* scripts unchanged
```

`git diff package.json` confirms the delta is strictly +1 insertion, 0 deletion.

---

## 4 · Verification that no dependency was installed

The owner rule says "Do not install dependencies." During test runs I observed one shell session where the working directory had reset to `C:/Users/Victus/` (one level above the project root) and `npx vitest` fell back to fetching vitest@5.0.4 into **npx's own cache**. Verifying that this did not modify the project:

| Evidence | Result |
|---|---|
| `pwd` after cwd restoration | `/c/Users/Victus/nexapp` |
| `stat` on `package-lock.json` | mtime `2026-10-10 20:19:03` · unchanged (today is 2026-10-14) |
| `stat` on `package.json` | mtime `2026-10-14 18:06:41` · reflects only my explicit `predev` insertion |
| `node_modules/.bin/vitest` | present · mtime `Oct 10 20:18` · untouched |
| Re-run from correct cwd | `RUN v4.1.11` (the project-local vitest version from `devDependencies` `"vitest": "^4.1.10"`) · 38/38 pass |

`npx` loads to its global cache without touching project `node_modules`. The project's declared dependencies and lockfile are byte-identical to their pre-session state.

---

## 5 · Risks and known limitations

| Risk | Severity | Mitigation |
|---|---|---|
| Developer bypasses `npm` and runs `next dev` directly | Medium | Documented in the script's header comment. Could be hardened in a future phase by adding a wrapper or a pre-git-push hook, but is out of scope for Phase 3A. |
| GitHub rebrands or domain changes | Low | `ACCEPTABLE_REMOTE_NORMS` is a single `const` string. One-line update. Caught by test suite because the expected norm is referenced by name throughout. |
| User renames the local checkout directory (e.g., `nexapp-main`) | Medium | Guard would fail-closed on `wrong-root`. The diagnostic suggests `cd C:/Users/Victus/nexapp` which may not match the renamed path. A future hardening could read the expected basename from an env var or a config file; out of scope for Phase 3A. |
| False positive if someone forks `Philip2024394/nexapp` to their own GitHub | Medium | Guard would fail-closed on `wrong-remote-fetch`. The diagnostic lists the expected remote so a fork-based developer could update `ACCEPTABLE_REMOTE_NORMS` by one-line edit. Not in scope to automate. |
| `git remote get-url --push` not supported on very old git versions | Low | Script falls back silently to the fetch URL (already validated). Observed git 2.x everywhere relevant. |
| Lifecycle-hook bypass via `yarn dev` / `pnpm dev` | Low | `yarn` and `pnpm` both honour npm-lifecycle `predev` hooks. The limitation only hits with `next dev` run directly. |

---

## 6 · What this phase does **not** do

- **Does not** apply migration 197. Still an unapplied draft.
- **Does not** touch Stage 1.1 rate-limit code (`_actions.ts`, `_guest-chat-client.tsx`, `rate-limit.ts`, `community/types.ts`, or the Stage 1.1 test file).
- **Does not** transfer any doctrine documents from D:/trades to nexapp. Phase 2 §Task 3 proposed a selective transfer; it remains queued.
- **Does not** modify any port or any shell profile.
- **Does not** modify D:/trades · zero file read, zero file write.
- **Does not** modify the sealed `recordIfAllowed` primitive, the sealed `NexCommunityRateLimitError` class, or any sealed Vault / Bridge 99 / Chat Master Layout surface.
- **Does not** stage, commit, push, or pull. The three new files and the one `package.json` edit are present only in the working tree.

---

## 7 · Summary

| Checklist | Status |
|---|---|
| Pre-dev check added | ✅ `scripts/assert-nexapp-cwd-and-remote.mjs` |
| Fail-closed on all failure branches | ✅ 5 enumerated failure modes, each exits 1 |
| Verifies git root resolves to nexapp root | ✅ `checkCwd` + runAssertion §1-§2 |
| Verifies origin fetch identity matches nexapp.git | ✅ `checkRemote` + runAssertion §3-§4 |
| Verifies origin push identity matches nexapp.git | ✅ runAssertion §5-§6 |
| Allows `.git` suffix and URL normalisation | ✅ `normalizeRemoteUrl` handles 7+ variants |
| Rejects missing / unexpected origin | ✅ `no-remote`, `wrong-remote-fetch`, `wrong-remote-push` branches |
| Integrated into existing dev script | ✅ `predev` lifecycle hook; `dev` body unchanged |
| Clear diagnostic for correction | ✅ Every failure emits `FAIL` + evidence + `Fix ·` lines |
| Tests for all four cases | ✅ 38 tests cover valid / wrong root / missing / wrong remote |
| Tests use mocks or temp fixtures (no real git config altered) | ✅ Injected `exec` and `log`; zero real git invocations in tests |
| No dependency installed | ✅ `package-lock.json` + `node_modules/.bin/vitest` byte-identical to pre-session mtimes |
| `dev` script preserves `-p 3008` and all other flags | ✅ Byte-identical in diff |
| No `D:/trades` touch | ✅ Zero file read, zero file write |
| No port change, no process stop | ✅ Dev server (PID 7172) still running from nexapp on 3008, untouched |
| Working-tree preservation | ✅ 29 pre-existing modifications intact |

Stopping. Awaiting owner review of the diff before any further work. The queued next-steps remain:

1. **Selective doctrine transfer** from `D:/trades/docs/doctrine/` to `nexapp/docs/doctrine/` with an explicit source + destination list before any copying (Phase 2 §Task 3 recommendation).
2. **Stage 1.1 Option C implementation** · client UI handling for `rate_limited` and `rate_limit_unavailable`, minimal observability, bounded-retry server policy, tests. Migration 197 remains unapplied; separate authorisation still required.

Each is independent and separately reviewable.
