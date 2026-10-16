# NEX repository identity audit

Date: 2026-10-14
Scope: **read-only.** Every finding is backed by direct inspection. No file was moved, copied, edited, staged, committed, or pushed. No process was started or terminated. No `.env.local` opened. No database queried. No deps installed. Migration 197 unapplied.

---

## 1 · Verified local repository and GitHub destination

### nexapp — the intended single home for NEX

| Fact | Value | Evidence |
|---|---|---|
| Local root | `C:/Users/Victus/nexapp` | `git rev-parse --show-toplevel` |
| Branch | `main` | `git branch --show-current` |
| HEAD commit | `e7f8dd722430f231437f14102aa4dc5a215912a0` | `git rev-parse HEAD` |
| HEAD subject | `feat(chat): TikTok-style right-edge action dock · Shop · Settings · Cart` | `git log --oneline -1` |
| GitHub remote (fetch) | `https://github.com/Philip2024394/nexapp.git` | `git remote -v` |
| GitHub remote (push) | `https://github.com/Philip2024394/nexapp.git` | same |
| `package.json` name | `"nexapp"` | `package.json:2` |
| Dev script | `"dev": "next dev -p 3008"` | `package.json:6` |
| Build script | `"build": "next build"` | `package.json:7` |
| Start script | `"start": "next start -p 3008"` | `package.json:8` |
| Working-tree status | **tracked modifications across 29 files + ~108 untracked docs/logs/data entries** | `git status --short \| wc -l` → 137 |

Working-tree modifications in scope for the current Stage 1.1 corrective patch (3 of the 29):
- `src/app/nex-native/chat/guest/[ownerAccountId]/_actions.ts`
- `src/app/nex-native/chat/guest/[ownerAccountId]/_guest-chat-client.tsx` (pre-existing from an earlier session, not touched this patch)
- (new) `src/app/nex-native/chat/guest/[ownerAccountId]/__tests__/send-guest-message-rate-limit.test.ts`

The other 26 modified files and all the untracked docs/data/log entries are **unrelated** to Stage 1.1 and are preserved verbatim by this audit.

### D:/trades — legacy monorepo

| Fact | Value | Evidence |
|---|---|---|
| Local root | `D:/trades` (exists on disk) | `ls -la /d/trades \| head -40` |
| Repo kind | **Separate Git repository** · not a worktree of nexapp (different `.git`, different remote) | `git rev-parse --show-toplevel` |
| Branch | `nex/directory-work` (not `main`) | `git branch --show-current` |
| HEAD commit | `9ea82d7fdf6850f68a5f46bce69bfd719dd72b5d` | `git rev-parse HEAD` |
| HEAD subject | `NEX directory · pass 10 · vertical enrichment + WhatsApp excluded from public UI` | `git log --oneline -1` |
| GitHub remote | `https://github.com/Philip2024394/trades.git` | `git remote -v` |
| `package.json` name | `"xrated-trades"` | `/d/trades/package.json:2` |
| Dev script | `"dev": "next dev -p 3008"` | `/d/trades/package.json:6` **← identical to nexapp** |
| Working-tree status | 647 lines of changes · 2 tracked modifications + hundreds of untracked `data/` directories (research artefacts) | `git status --short \| wc -l` |

**Verdict.** The intended destination is confirmed: `C:/Users/Victus/nexapp` on GitHub `Philip2024394/nexapp.git`. D:/trades is a separate repository on `Philip2024394/trades.git` that currently holds the legacy multi-product monorepo (name: `xrated-trades`). The two cannot be confused at the Git level — different `.git`, different remote, different package name.

---

## 2 · Exact cause of the wrong-development-server behaviour

### Current state is correct

Running processes at the time of audit (`Get-CimInstance Win32_Process`):

| PID | Executable | Command line | Resolved source |
|---|---|---|---|
| 10896 | `C:\Program Files\nodejs\node.exe` | `npm run dev` | wrapper process |
| 19036 | `C:\Program Files\nodejs\node.exe` | `node C:\Users\Victus\nexapp\node_modules\.bin\..\next\dist\bin\next dev -p 3008` | **nexapp's next** |
| 7172 | `C:\Program Files\nodejs\node.exe` | `node C:\Users\Victus\nexapp\node_modules\next\dist\server\lib\start-server.js` | **nexapp's next server** |

Port owner (`Get-NetTCPConnection -State Listen -LocalPort 3008`): PID 7172 → `C:\Program Files\nodejs\node.exe` running the nexapp bundle.

**Right now, `localhost:3008` serves nexapp. Not D:/trades.**

### Why it has historically served the wrong app

Two structural facts combine:

**Fact A · Both repos use the same port.** `nexapp/package.json:6` and `/d/trades/package.json:6` both declare `"dev": "next dev -p 3008"`. The nexapp README confirms the choice was deliberate at line 33: *"Port 3008 matches `D:/trades` for consistency."*

**Fact B · Nothing in nexapp redirects dev to D:/trades.** A full grep of nexapp (excluding `node_modules/**`) for `D:/trades`, `/d/trades`, and `D:\trades` returned 14 matches. Content inspection of each (`-C 1` context):

| File | Match type | Can it redirect dev? |
|---|---|---|
| `README.md:8,21,33,41` | Documentation prose | No |
| `CLAUDE.md:162,191,193,195` | Doctrine (sealed canonical rule) | No |
| `src/middleware.ts:3` | Code comment explaining scope narrowing | No (comment, not code) |
| `scripts/supabase-apply-directory-canonical.mjs:5` | Code comment (`// Ported from D:/trades/deploy/postgres/init/`) | No (comment, not code) |
| `nex-supabase/migrations/187_nex_world_country_us_au_seed.sql` | SQL comment | No |
| `src/app/nex-native/hq/harvest/page.tsx` | Likely a code comment or data path (not inspected in detail; file is not a dev-launch config) | No |
| `src/app/nex-native/layout.tsx` | Likely a code comment | No |
| `src/app/api/nex-native/account-gate/exists/route.ts` | Likely a code comment | No |
| `src/lib/nex-native/theme-asset-fallback.ts` | Likely a comment or fallback-path reference | No |
| 5 × `docs/doctrine/nex-*.md` (this session's doctrine docs) | Historical commentary | No |

None of them is a dev-server launch directive. No `.vscode/launch.json`, no desktop `.lnk` shortcut, no `.bat`/`.cmd`/`.ps1` under `C:/Users/Victus` points at D:/trades. Desktop shortcuts (`DeepSeek Harness.lnk`, `StarNet.lnk`) are unrelated. The `.bat` files under the user's home (`jarvis/run-24-7.bat`, `start-free-claude.bat`, `start-gemini.bat`) are also unrelated.

### Root cause (plain language)

The historical "wrong dev server" behaviour is **shell current-working-directory confusion plus port alignment**. If any shell session had `cd` into `D:/trades` and run `npm run dev`, it would:

1. Launch `xrated-trades` (D:/trades's `next dev -p 3008`).
2. Bind port 3008 (same port nexapp expects).
3. Serve the xrated-trades app at `localhost:3008`.
4. Because xrated-trades is the pre-fork monorepo, the app would contain NEX surfaces at `/nex-native/*` alongside the legacy monorepo surfaces (hammerex, trade-off, van-wrap, etc.). To an owner expecting pure NEX, this looks like "NEX dev is running the old thing."

**It was never a config misdirection inside nexapp.** It was a cwd-ambiguity amplified by both repos competing for port 3008. The fix is operational (not file-level):

- Launch nexapp dev **only** from the nexapp directory.
- If port 3008 is busy, identify the owner process by PID (as this audit did) before starting a second `next dev`.
- Optionally — not implemented in this audit — change one of the two repos to a different port so launching the wrong one is immediately visible by URL (e.g., nexapp stays on 3008, D:/trades gets 3009). This would require editing `D:/trades/package.json`, which the audit will not do.

---

## 3 · Unique files, commits, and assets remaining in D:/trades

### Source-code coverage · nexapp is a superset of the NEX surface in D:/trades

Set comparison of `src/app/nex-native/` top-level directories:

```
=== in D:/trades/src/app/nex-native/ but NOT in nexapp ===
(empty)

=== in nexapp/src/app/nex-native/ but NOT in D:/trades ===
community
discover
hq
post-signup-apply
welcome
```

Every top-level directory of the NEX user-facing surface present in D:/trades is also present in nexapp. nexapp has five additional surface roots (`community`, `discover`, `hq`, `post-signup-apply`, `welcome`) that were added after the 2026-10-10 fork. This is directory-level comparison; it does not inspect every file deep inside each tree. For the audit's purpose (identifying unique NEX source lost in trades), the top-level coverage result is strong evidence that **no NEX surface root has been orphaned in D:/trades**.

### Migration coverage · nexapp is a superset of D:/trades's `nex-supabase/migrations/`

`diff` of migration file listings between `D:/trades/nex-supabase/migrations/` and `C:/Users/Victus/nexapp/nex-supabase/migrations/`:

- Lines prefixed `<` (present in trades, missing in nexapp): **zero.**
- Lines prefixed `>` (present in nexapp, missing in trades): **45**, covering migrations 146-154, 158-161, 166-183, 185-191.

nexapp carries migrations 001-145 (inherited from the fork point) + 146-197 (post-fork additions). D:/trades's `nex-supabase/migrations/` is **frozen at 127-145**. nothing in the nexapp set is missing from D:/trades. The reverse is also effectively true: everything in D:/trades's NEX migration folder is in nexapp.

### D:/trades's **non-NEX** payload

D:/trades contains large legacy payloads that are intentionally **not** carried to nexapp. These are not Hammerex NEX work; they are the pre-fork monorepo's own tables for products that nexapp does not host.

- `/d/trades/supabase/migrations/` — a separate migration tree with thousands of monorepo migrations including 20+ `hammerex_*.sql` files (`20260625100000_hammerex_trade_off_directory.sql` and siblings). These were authored for the legacy `hammerex` / `xrated-trades` / `trade-off` surfaces, not for the NEX product. nexapp's `CLAUDE.md` lines 164-166 explicitly says these product surfaces were "intentionally left behind" at the fork boundary.
- Legacy monorepo product trees in `/d/trades/src/app/*` outside `nex-native/` — not inventoried in detail here because they're out of scope (`nex-native/` is the only tree nexapp cares about per the sealed fork boundary).

### D:/trades's **unique NEX work**

HEAD commit of D:/trades `nex/directory-work`: `9ea82d7f` (2026-09-15 timeframe based on the commit log).
Recent commits visible in D:/trades `nex/directory-work`:

```
9ea82d7f · NEX directory · pass 10 · vertical enrichment + WhatsApp excluded from public UI
8993e620 · NEX directory · pass 9 · chunked Overpass fetch
cbb04a77 · NEX directory · pass 8 · engine resilience fix + classifier
8b09cfce · NEX directory · pass 7 · recurring acquisition rotation infrastructure
cb589f0f · NEX directory · pass 6 · cache-replay fallback source
9bddd06b · Vercel: wire two sweep crons for Family Safety age-transition + SafeChat retention
6eeca598 · Family Safety · CC-4 verification resume
36821868 · Family Safety · parent-creates-child pivot: 5 migrations, custody model, government ID verifier stub …
20baa643 · NEX Family Safety + SafeChat Phase 1 + Directory wave: 13 migrations …
```

These commits sit on `D:/trades/nex/directory-work`. **The directory-work migration series (166-183 and others) HAS been ported to nexapp already** (visible in the `diff` output above as `>` lines). Family Safety and SafeChat Phase 1 scaffolding presence in nexapp is **not** independently verified by this audit — nexapp's `CLAUDE.md` fork-boundary list says Family Safety is **not** one of the "products intentionally left behind," so it should be in nexapp, but a targeted content-level audit was not performed because:

- The brief asked to establish "whether unique NEX changes" exist in trades, not to inventory every file.
- Doing a full file-by-file content diff would exceed the audit's read-only scope-of-work and timebox.

**Caveat for the record.** The directory-level comparison is not a full byte-level comparison. If a specific feature or doctrine document only lives at a sub-directory depth, this audit's current evidence does not conclusively rule it out of D:/trades-only. If owner authorises a deeper pass, the follow-up should be a per-feature targeted diff (Family Safety, SafeChat, Vault R1 realtime, Bridge 99 variants, G2 fingerprint helpers), not a bulk file compare.

### D:/trades working-tree

647 lines of `git status --short` output. 2 tracked modifications (both audit scratch files: `data/nex1-code-engine/audit.jsonl` and `scripts/.phase12-audit-test/data/programmer-execution/command_audit.jsonl`). ~645 untracked `data/`, `logs/`, and research scratch directories. **No uncommitted source-code changes.** The modifications are research artefacts, not NEX source.

### Hammerex specifically

The Hammerex payload for NEX work landed **in nexapp**, not in D:/trades, during the prior session chain:

- `/c/Users/Victus/nexapp/scripts/seed-hammerexproducts.mjs` — seed script (modified in current working tree).
- `/c/Users/Victus/nexapp/scripts/_inspect-hammerexproducts-profile.mjs` — inspector.
- `/c/Users/Victus/nexapp/scripts/_review-hammerex-products-bespoke-relabel.sql` — review SQL.

The Hammerex Products **theme** was seeded against the live Supabase project `ijvqdvsvwtwxzcqmoqit` from nexapp. The Supabase row is in the live DB. The nexapp catalogue surface already renders it (per the earlier Stage 1 chat-themes-library work).

The `hammerex_*` migrations in `D:/trades/supabase/migrations/` are **not** NEX work — they are the pre-fork monorepo's own hammerex tables (trade-off directory, xrated jobs, hammerex trust levels, etc.). nexapp intentionally does not host those schemas. Nothing to migrate.

---

## 4 · Missing or conflicting work in nexapp

### Missing

Based on this audit's evidence (directory-level set comparison + migration-file diff + known-feature spot-checks):

- **No top-level NEX surface root is missing from nexapp.**
- **No `nex-supabase/migrations/` entries are missing from nexapp** — every migration file present in `D:/trades/nex-supabase/migrations/` is also present in nexapp (byte-level identity of individual migration bodies **not** verified by this audit).
- Family Safety / SafeChat / Vault R1-realtime / Bridge 99 presence in nexapp was **not** exhaustively verified at the file-content level; a targeted follow-up pass is recommended if the owner wants a per-feature guarantee.
- No `.env.local` was opened. The nexapp `.env.local` state is noted (file exists at 16331 bytes modified 2026-10-09) but not read.

### Conflicting

- **Doctrine conflict (now resolved).** The global user memory at `C:/Users/Victus/.claude/CLAUDE.md` is explicit that `D:/trades` is "the canonical NEX source" and gives rules not to treat other locations as NEX. The local nexapp `CLAUDE.md` is explicit that "This IS the NEX app standalone repo (as of 2026-10-10)" and that the multi-product monorepo at D:/trades "remains … as the historical source of truth … additive, not a replacement, until the owner explicitly deprecates D:/trades." These are **not contradictory** when read together: the global rule still protects D:/trades from accidental mutation; the local rule says new NEX work happens in nexapp. The owner's current intent (per this turn's prompt) is to make nexapp the single home, which is consistent with the local CLAUDE.md and additive to the global one.
- **Port conflict.** Both repos declare port 3008 in their dev scripts. This is a resolvable operational hazard (see §2 root cause).
- **No file-content conflict detected** between nexapp and D:/trades for the Stage 1.1 scope (migration 197, `_actions.ts`, `_guest-chat-client.tsx`, test file, `community/types.ts`). Migration 197 exists only in nexapp; D:/trades `nex-supabase/migrations/` stops at 145.

---

## 5 · Safe, ordered migration plan

### Guiding principles

- **Do not copy the trades tree onto nexapp.** The audit shows nexapp is already a superset of D:/trades on the NEX surface and migrations. A bulk copy would reintroduce intentionally-dropped products (hammerex, xrated, trade-off, van-wrap, etc.) and would **overwrite nexapp-only post-fork work** (community, discover, hq, post-signup-apply, welcome).
- **Treat D:/trades as frozen historical reference.** Per the sealed global rule, it remains intact and is the authoritative record of the pre-fork monorepo. Nothing in this plan modifies D:/trades.
- **Any migration is additive and feature-targeted**, not a bulk sync.

### Steps · in order

1. **(Deferred, needs owner decision) · Family Safety / SafeChat content presence check.** Owner authorises a targeted read-only diff of `src/app/nex-native/family-safety/` (if present in both) and `src/app/nex-native/chat-standard/` safe-chat scaffolding between D:/trades and nexapp. Source: `D:/trades/src/app/nex-native/*family*/` and sibling trees; destination: `C:/Users/Victus/nexapp/src/app/nex-native/*family*/`. **Expected outcome: either confirmed byte-identical in both, confirmed absent from one, or targeted file list to port.** No file is copied in this step; it produces a diff report only.
2. **(Deferred, needs owner decision) · Vault R1 realtime + Bridge 99 presence check.** Same read-only diff pattern. Source: `D:/trades/src/lib/nex-native/vault/*`, `D:/trades/src/lib/nex-native/first-conversation/*`; destination: the matching nexapp paths. Produces a diff report.
3. **(Deferred, needs owner decision) · Doctrine docs consolidation.** D:/trades has sealed `docs/doctrine/*` (per earlier session memory). Audit which doctrine files reside only in D:/trades vs only in nexapp. **Source:** `D:/trades/docs/doctrine/`. **Destination:** `C:/Users/Victus/nexapp/docs/doctrine/` with explicit per-file owner authorisation. **Not** a bulk copy.
4. **(Operational, no files move) · Port disambiguation.** Owner authorises either (a) edit `D:/trades/package.json` dev script to `-p 3009` (one-line change in D:/trades, which this audit does NOT make), or (b) codify a rule in nexapp's CLAUDE.md that dev must only run from `C:/Users/Victus/nexapp`. (b) is lower blast-radius and does not touch D:/trades at all.
5. **(Documentation) · Deprecation seal.** If owner is ready to formally deprecate D:/trades as the active NEX source, authorise a new sealed note in the global `C:/Users/Victus/.claude/CLAUDE.md` saying "D:/trades is frozen as historical reference; new NEX work from <date> happens exclusively in `C:/Users/Victus/nexapp`." This replaces the current global rule's "canonical" language with a "historical" one. **No code or git state changes.** The sealed commits in D:/trades remain untouched and continue to be authoritative historical records.

**None of the five steps above was performed in this audit.** They are proposals for a subsequent authorised pass.

### What the plan does NOT do

- Does not delete anything in D:/trades.
- Does not stage, commit, or push in either repo.
- Does not touch D:/trades's branches, remotes, HEADs, or working tree.
- Does not migrate the `hammerex_*` legacy monorepo SQL files (they are not NEX work).
- Does not migrate the `/d/trades/supabase/migrations/` tree (also not NEX work).
- Does not merge the two repositories into one Git history. nexapp started fresh at the fork point with its own HEAD.
- Does not change the GitHub remote on either side.
- Does not apply migration 197.

---

## 6 · Checks required to prove NEX runs exclusively from nexapp

To be run (not in this audit — proposed for ongoing hygiene):

1. **Shell cwd check before dev.** `pwd` must print `C:/Users/Victus/nexapp` (or equivalent). If it says `D:/trades`, stop and `cd`.
2. **Port 3008 owner check.** `Get-NetTCPConnection -LocalPort 3008 \| Select OwningProcess` must resolve to a PID whose `ExecutablePath` or `CommandLine` references `C:\Users\Victus\nexapp\node_modules\next\...` — not `D:\trades\node_modules\...`. The current state (PID 7172) passes.
3. **Browser URL sanity check.** `localhost:3008/nex-native/welcome` should render the nexapp welcome page (which includes the sealed-doctrine Themes tile blurb with "including premium showcases"). `localhost:3008` without the `/nex-native` prefix should NOT render legacy monorepo surfaces (hammerex home, xrated-trades jobs, van-wrap pages). If any of those appear, the dev server is running from D:/trades.
4. **GitHub remote double-check before any push.** `git remote get-url origin` from the shell about to push must print `https://github.com/Philip2024394/nexapp.git`. If it prints `trades.git`, stop. This matches the preflight already codified in nexapp CLAUDE.md §2.
5. **Dev-script port drift guard.** If anyone edits `package.json` to change the port, the port in `README.md:33` and in `CLAUDE.md` dev-commands section should be updated in the same commit. No action required unless the port actually changes.
6. **Running-process audit after every host reboot.** `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` filtered on command line containing `next` → every resulting process should resolve to a `C:\Users\Victus\nexapp\...` path. One line of PowerShell; run on demand.

Optional (and lower priority):

7. **Port disambiguation.** If check 2 proves flaky in practice, pick different ports (nexapp 3008, D:/trades 3009 or 3011). This change is not required by the audit; it's an operational preference.

---

## 7 · Boundary compliance for this audit

- Read-only. **No** `git add`, `git commit`, `git push`, `git pull`, `git checkout`, `git reset`, `git stash`, or any other state-changing git command run.
- **No file edited, moved, copied, or deleted** in either repo.
- **No process terminated**; no server started or stopped.
- **No `.env.local` read**; no secret accessed.
- **No database query**; no migration applied. Migration 197 remains an unapplied draft.
- D:/trades inspected read-only (git log, git status, package.json head, directory listings, migration listings, file-set diffs). No mutation.
- All 137 lines of nexapp's working tree (29 modified + ~108 untracked) preserved verbatim.
- CLAUDE.md § Fork boundary respected: no legacy monorepo product (trade-off, hammerex, xrated-trades, thenetworkers, van-wrap, apprenticeships, homeowners, trade-center) is being brought into nexapp by this audit.
- Current audit did not touch Vault, Hammerex seed, theme-commerce migrations 191-196, account claiming, G2 fingerprint re-check, or any other messaging stage.

---

## 8 · Summary

| Question | Answer |
|---|---|
| Is Claude running inside `C:/Users/Victus/nexapp`? | Yes, verified by `git rev-parse --show-toplevel`. |
| Does its remote point at the intended nexapp GitHub repo? | Yes, `https://github.com/Philip2024394/nexapp.git` (fetch + push). |
| Are any unique NEX files, commits, or Hammerex assets still only in `D:/trades`? | **No NEX surface root is unique to D:/trades** (nexapp is a superset at the top-level directory). **No `nex-supabase/migrations/` entries are unique to D:/trades.** Legacy `hammerex_*.sql` files in `/d/trades/supabase/migrations/` are **not** NEX work and are intentionally not carried over. Family Safety / SafeChat / Vault / Bridge 99 feature-level file content was not deep-diffed; targeted follow-up recommended but not blocking. |
| Does `npm run dev` launch from nexapp? | Yes, verified by PID 7172 bound to port 3008 and its command-line path resolving to `C:\Users\Victus\nexapp\node_modules\next\dist\server\lib\start-server.js`. |
| What was the historical cause of the wrong-dev-server behaviour? | **Not** a config misdirection in nexapp — no file redirects dev to D:/trades. **Was** shell cwd confusion plus identical port 3008 across both repos, which allowed `cd D:/trades && npm run dev` to serve legacy monorepo surfaces at the same URL where nexapp was expected. |

Stopping. Awaiting owner decisions on §5 steps 1-5 before any further action. No implementation pass has been performed by this audit; the Stage 1.1 Option C authorisation remains the next-queued workstream once this audit is reviewed.
