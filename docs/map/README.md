# Codebase Map Index

> Sealed 2026-11-23. The files in this directory are **auto-generated navigation
> maps** produced by the `scripts/build-*.mjs` generators. They are safe to
> regenerate at any time — hand edits will be overwritten.
>
> Hand-written docs live elsewhere (`docs/engineering/`, `docs/product/`,
> `docs/architecture/decisions/`) and are governed by CLAUDE.md §9.

## What each map is

| File | Generator | What it answers |
|---|---|---|
| [`routes.md`](./routes.md) | `scripts/build-route-map.mjs` | Every page and API route under `src/app/nex-native/**` and `src/app/api/nex-native/**`, with client/server flag, metadata presence, and HTTP methods. |
| [`libraries.md`](./libraries.md) | `scripts/build-library-map.mjs` | File-by-file inventory of exports from `src/lib/nex-native/**` and (depth-limited) `src/lib/nex/**`. Deep-nested shared-lib files are flagged. |
| [`env.md`](./env.md) | `scripts/build-env-registry.mjs` | All `process.env.*` references across `src/`, `scripts/`, `.github/workflows/`, grouped by category (NEXT_PUBLIC, SUPABASE, STRIPE, NEX, …), plus reconciliation against `.env*.example`. |
| [`schema-snapshot.md`](./schema-snapshot.md) | `scripts/build-schema-snapshot.mjs` | Migration-by-migration table inventory from `nex-supabase/migrations/*.sql` — which migrations create/alter/drop each table, which policies exist, which files are proposals. |
| [`dependency-graph.md`](./dependency-graph.md) | `scripts/build-dependency-graph.mjs` | Mermaid flowchart + text list of top-level module dependencies inside `src/lib/nex-native`, with cycle detection. |

## How to regenerate

Run all five in sequence:

```bash
node scripts/build-all-maps.mjs
```

Once the caller has wired npm scripts, equivalently:

```bash
npm run map:all
```

Individual generators (useful when iterating on one map):

```bash
node scripts/build-route-map.mjs
node scripts/build-library-map.mjs
node scripts/build-env-registry.mjs
node scripts/build-schema-snapshot.mjs
node scripts/build-dependency-graph.mjs
```

All generators are **read-only** — they never write back to the parsed
source. They are idempotent: running twice produces the same output. Each
generator exits non-zero on failure; `build-all-maps.mjs` stops on the
first failure.

## When to regenerate (pre-commit check)

Regenerate and commit the map files alongside any change that touches:

- `src/app/nex-native/**` (page routes)
- `src/app/api/nex-native/**` (API routes)
- `src/lib/**` (library layer)
- `nex-supabase/migrations/**` (schema)
- `.github/workflows/**` or `scripts/**` that read env vars

Suggested pre-commit workflow:

```bash
git status --short
# If any of the paths above are staged, regenerate:
node scripts/build-all-maps.mjs
git add docs/map/
```

The maps commit together with the code change so reviewers see both the
code and its map update in a single diff. If a map regenerates to an empty
diff, the change didn't affect that surface — no harm done.

## Auto-generated vs hand-written docs

**Auto-generated (this directory):** regenerate on demand. Do not hand-edit.
Treat the map files as a view over the source tree; the source tree wins.

**Hand-written (CLAUDE.md §9):**

- `docs/engineering/session-handoff.md` — current session state
- `docs/product/feature-ledger.md` — authoritative feature status
- `docs/architecture/decisions/` — ADRs
- `docs/product/requirements/` — requirement specs

Hand-written docs encode intent, decisions, and verification evidence —
things the generators cannot infer. Never replace them with an auto-map,
and never silently update them without the evidence trail CLAUDE.md §9
requires.

## Reading order for a new session

A future assistant orienting to this codebase should read in this order:

1. `CLAUDE.md` (root) — constitution and preflight rules.
2. `docs/engineering/session-handoff.md` — where we are right now.
3. `docs/product/feature-ledger.md` — what is / isn't verified.
4. `docs/map/README.md` (this file) — map index.
5. The specific map(s) relevant to the task (routes, libraries, env, schema, deps).
6. The code itself.

Maps are a navigation aid, not a substitute for reading the code when the
work requires it.
