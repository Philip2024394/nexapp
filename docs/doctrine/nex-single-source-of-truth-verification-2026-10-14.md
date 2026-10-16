# NEX · single-source-of-truth verification

Date: 2026-10-14
Scope: strictly read-only confirmation that nexapp is the single operational source of truth, the application does **not** use D:/trades at runtime, and the Supabase project is `asknexapp@gmail.com`'s `ijvqdvsvwtwxzcqmoqit`. No file edited, no git state change, no port change, no process started/stopped, no `.env.local` read, no live DB query, no D:/trades mutation, no bulk copy.

Companion to:
- `docs/doctrine/nex-repository-identity-audit-2026-10-14.md` (Phase 1)
- `docs/doctrine/nex-repository-phase-2-feature-preservation-2026-10-14.md` (Phase 2)
- `docs/doctrine/nex-repository-phase-3a-dev-guard-hardening-2026-10-14.md` (Phase 3A hardening)
- `docs/doctrine/nex-repository-phase-3a-dev-guard-acceptance-2026-10-14.md` (Phase 3A acceptance)

---

## Headline · nexapp IS the single operational source

Every active runtime surface points at nexapp. D:/trades is **not** consulted by anything running. The Supabase wiring is correct and matches `asknexapp@gmail.com`.

| Check | Expected | Observed | Source evidence |
|---|---|---|---|
| Local repo root | `C:/Users/Victus/nexapp` | `C:/Users/Victus/nexapp` | `git rev-parse --show-toplevel` |
| Branch | `main` | `main` | `git branch --show-current` |
| HEAD commit | `e7f8dd72…` | `e7f8dd722430f231437f14102aa4dc5a215912a0` | `git rev-parse HEAD` |
| GitHub fetch remote | `Philip2024394/nexapp.git` | `https://github.com/Philip2024394/nexapp.git` | `git remote get-url origin` |
| GitHub push remote | `Philip2024394/nexapp.git` | `https://github.com/Philip2024394/nexapp.git` | `git remote get-url --push origin` |
| Dev server bound to :3008 | nexapp's next | PID 7172 · `C:\Program Files\nodejs\node.exe` running nexapp's next | `Get-NetTCPConnection -LocalPort 3008` + `Get-CimInstance Win32_Process` (Phase 1) |
| Predev guard | present + fail-closed | 112/112 tests pass; live exit=0 | `scripts/assert-nexapp-cwd-and-remote.mjs` + `package.json:6` |
| Supabase authoritative project | `ijvqdvsvwtwxzcqmoqit` (asknexapp@gmail.com) | 30+ references to that project ID across runtime code, migrations, and doctrine | `grep ijvqdvsvwtwxzcqmoqit` |
| Legacy Supabase project usage | NONE active (boundary refs only) | 2 files reference the legacy `msdonkkechxzgagyguoe`; both are **routing-away** boundaries, not active clients | `grep msdonkkechxzgagyguoe` |

---

## 1 · Local source · verified

```
$ git -C C:/Users/Victus/nexapp rev-parse --show-toplevel
C:/Users/Victus/nexapp
$ git -C C:/Users/Victus/nexapp branch --show-current
main
$ git -C C:/Users/Victus/nexapp rev-parse HEAD
e7f8dd722430f231437f14102aa4dc5a215912a0
$ git -C C:/Users/Victus/nexapp remote get-url origin
https://github.com/Philip2024394/nexapp.git
$ git -C C:/Users/Victus/nexapp remote get-url --push origin
https://github.com/Philip2024394/nexapp.git
```

Both fetch and push remotes resolve to `Philip2024394/nexapp.git`. Not `trades.git`. Not any legacy repo.

## 2 · Dev server source · verified

```
$ Get-NetTCPConnection -State Listen -LocalPort 3008
Port  PID  Name  Path
3008 7172 node  C:\Program Files\nodejs\node.exe
```

PID 7172's full command line (established in Phase 1) is:

```
node C:\Users\Victus\nexapp\node_modules\next\dist\server\lib\start-server.js
```

The dev server is running next from **nexapp**'s own `node_modules`. There is no process bound to port 3008 originating from `D:\trades\node_modules`. The predev guard added in Phase 3A would refuse to launch anything else.

## 3 · Supabase wiring · verified

### Authoritative project · active in runtime code

`ijvqdvsvwtwxzcqmoqit` is the Supabase project ID owned by `asknexapp@gmail.com` per `nexapp/CLAUDE.md:§8` (lines 65-100). It appears in **30+ files** across the repo including runtime code paths:

- `src/app/nex-native/themes/{theme-1,cyber-grid,...}/page.tsx` · theme viewers
- `src/lib/nex-native/directory/directory-service.ts` · directory canonical layer client
- `src/lib/nex-native/directory/__tests__/*` · directory tests
- `src/lib/nex-native/first-conversation/__tests__/first-message-orchestrator.test.ts` · Bridge 99 test
- Several migrations in `nex-supabase/migrations/` reference it in COMMENT metadata
- Multiple scripts in `scripts/` for seeding, verification, and audit

### The Supabase admin client reads the correct env var

`src/lib/nex-native/supabase-admin.ts` lines 28-37:

```ts
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEX_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const serviceKey = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY;

// … error branch if missing:
throw new Error(
  "nex-native/supabase-admin: Missing NEX_SUPABASE_URL (or NEXT_PUBLIC_NEX_SUPABASE_URL). " +
    "NEX-native services require the authoritative NEX Supabase project · not the legacy thenetworkers substrate."
);
```

The admin client reads from `NEX_SUPABASE_URL` or `NEXT_PUBLIC_NEX_SUPABASE_URL`. Per `CLAUDE.md §8`, those point at the authoritative project `ijvqdvsvwtwxzcqmoqit`. The error message explicitly flags the legacy project (`thenetworkers substrate`) as the WRONG target, confirming the guard-rail is in the source.

### `NEXT_PUBLIC_NEX_SUPABASE_URL` consumers (sample)

Runtime files reading the canonical env var:

- `src/middleware.ts` · edge middleware for Supabase SSR
- `src/lib/nex-native/directory/media-resolver.ts` · directory read path
- `src/app/nex-native/community/lost-found/page.tsx` · community lost-found UI
- `src/app/nex-native/community/lost-found/[id]/page.tsx` · community detail
- `src/lib/nex/brain/adapters/supabase.ts` · brain adapter
- `src/lib/nex/brain/storage.ts` + `warehouse.ts` · brain storage
- `src/lib/nex/brains/_supabase.ts` + `_auth.ts` · auth layer

All of these resolve to the canonical NEX project when the env var is set correctly.

### Legacy Supabase project · boundary-only, not active

Exactly **two** files in `src/` reference the legacy `msdonkkechxzgagyguoe` project. Both are explicit **routing-away** boundaries, not active clients:

**File 1 · `src/lib/nex/images/manifestWriter.ts:44`**:

```ts
const NEX_STORAGE_BOUNDARY_TRADES_HOST = "msdonkkechxzgagyguoe.supabase.co";
```

The variable name — `NEX_STORAGE_BOUNDARY_TRADES_HOST` — says it all. This is a boundary constant used to **reject** new writes that would land on the legacy project. The surrounding comments (lines 41-43) describe it as a migration-away guard.

**File 2 · `src/lib/nex-native/realtime/client.ts:29-35`**:

```
// This file previously resolved the UNPREFIXED
// `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
// which in the trades/hammerex-shared .env.local resolve to the
// legacy `msdonkkechxzgagyguoe` project — a different Supabase
// project than everything NEX-native server-side talks to. The
// result was that every NEX realtime feature (calls, typing,
// presence, read-up-to, and now R1 arrivals) silently subscribed
// …
```

This file has been **fixed** to no longer use the legacy project. The reference is now **historical documentation** inside a comment explaining the previous bug and why the file routes to the canonical project instead.

Neither file is a live client of the legacy Supabase. Both are explicit routing-away guards. This matches `CLAUDE.md §8`'s stated posture (lines 83-87): *"a legacy boundary that routes AWAY from the NEX project — do not reactivate it."*

### Supabase owner identity

Per `nexapp/CLAUDE.md:71` the authoritative Supabase project is owned by `asknexapp@gmail.com`. The runtime wiring (above) routes to that project. Nothing in the active code paths points at any other owner.

## 4 · D:/trades · not used by the application

Phase 1 established and Phase 2 confirmed:

- Zero file in nexapp redirects dev to D:/trades. All 14 textual references found in nexapp are documentation prose or in-source comments explaining historical context (README, CLAUDE.md, doctrine docs, middleware header comment, migration-port header comment).
- No `.vscode/launch.json`, no desktop `.lnk`, no `.bat`/`.cmd`/`.ps1` launcher under `C:/Users/Victus` targets D:/trades.
- The dev server currently bound to port 3008 originates from nexapp's `node_modules` (verified above).
- Phase 2 confirmed 249 of 251 inspected source files are byte-identical between the two repos; the 2 differences are nexapp-only post-fork fixes tagged in-source with `"Fixed 2026-10-14 during Hammerexproducts guest-handoff build"`.
- The Phase 3A predev guard refuses to launch anything whose git root isn't nexapp and whose remote isn't `Philip2024394/nexapp.git`.

**The application does not use D:/trades at runtime.** D:/trades remains on disk as historical reference per your own sealed global rule but is not consulted by any running NEX process.

## 5 · Residual gap · historical doctrine only

Phase 2 §Task 3 established that `D:/trades/docs/doctrine/` holds 246 historical doctrine documents, `nexapp/docs/doctrine/` holds 16, and there is **zero filename overlap**. Among the 246 trades-only docs, ~10-20 are architecturally load-bearing (Bridge 99 plan, Family Safety architecture, ADRs); the rest are session-closure records.

**None of these is a runtime dependency.** The implementations referenced by the load-bearing doctrine docs (Bridge 99 code, Family Safety code, Vault code, etc.) all live in nexapp byte-identical to D:/trades (Phase 2 verified).

This gap is a documentation-level finding, not an operational one. It can be closed later via a selective port of the ~10-20 load-bearing docs under separate owner authorisation. **Not actioned by this verification.**

## 6 · What was NOT done, by boundary

- ❌ No bulk copy of D:/trades → nexapp.
- ❌ No file in D:/trades read for mutation purposes.
- ❌ No file in nexapp edited (only this report created).
- ❌ No git stage, commit, push, pull, stash, checkout, reset, or any state-changing git command.
- ❌ No port change. Dev server at PID 7172 untouched.
- ❌ No `.env.local` read. No DB query. No deployment. No dependency installed.
- ❌ No change to Stage 1.1 code, migration 197, migrations 191-196, Vault, Bridge 99, Chat Master Layout, Hammerex, or any sealed surface.
- ❌ No change to the Phase 3A predev guard.
- ❌ No change to the global `C:/Users/Victus/.claude/CLAUDE.md` sealed rule (D:/trades is still the "canonical" historical repo per that document).
- ❌ No change to the nexapp-local `CLAUDE.md` (D:/trades is still "additive, not a replacement, until the owner explicitly deprecates D:/trades").

## 7 · Verdict

**nexapp is already the single operational source of truth for NEX.**

- Local source: `C:/Users/Victus/nexapp` ✓
- GitHub remote: `Philip2024394/nexapp.git` (fetch and push identical) ✓
- Dev server: launches from nexapp exclusively (predev guard enforces this on every `npm run dev`) ✓
- Supabase project: `ijvqdvsvwtwxzcqmoqit` (asknexapp@gmail.com) ✓
- D:/trades: present on disk as historical reference, but **not used at runtime by any NEX process** ✓

No change required. No bulk copy warranted — a bulk copy would overwrite the deliberate post-fork Bridge 99 fixes, the sealed Chat Master Layout primitives, the five nexapp-only surface roots (`community`, `discover`, `hq`, `post-signup-apply`, `welcome`), the 45 nexapp-only migrations (146-197), the Stage 1.1 code, the Phase 3A guard, and would reintroduce the "intentionally left behind" legacy monorepo products (hammerex, trade-off, xrated-trades, thenetworkers, van-wrap, etc.).

### Remaining optional steps (each requires separate authorisation)

- **Selective doctrine port** · Phase 2 §Task 3 proposal · identify ~10-20 load-bearing historical doctrine docs in `D:/trades/docs/doctrine/`, list source → destination paths, authorise case-by-case before any copy. Pure documentation work.
- **Formal D:/trades deprecation seal** · add a new sealed note to the global `C:/Users/Victus/.claude/CLAUDE.md` reclassifying D:/trades from "canonical" to "frozen historical reference" and nexapp as the single ongoing NEX source. One file edit to the global rules file. Zero code change, zero data move.
- **Stage 1.1 Option C implementation** · independent of repository work. Client UI handling for `rate_limited` and `rate_limit_unavailable` → minimal observability → bounded-retry server policy → tests. Migration 197 remains unapplied; separate authorisation.

None of these is urgent. The application is already operating from the single correct source.

Stopping. Awaiting your decision on whether to proceed with any of the three optional steps above or leave the state as-is.
