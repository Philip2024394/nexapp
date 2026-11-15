# I22 · NEX_POSTGRES_URL=localhost:5433 · code-paths + migration plan

**Author:** Stream C · 2026-11-16
**Scope:** Document-only. No code changes. No `.env.local` edits.
**Related:** `src/lib/nex/db`, nexapp CLAUDE.md §8 lines 73-77

---

## Current state (evidence)

`grep -rn "NEX_POSTGRES_URL" src/` returns the following live
consumers (not tests):

### Runtime consumers (will attempt a Postgres connection at request time)

- **`src/lib/nex/ai/contact_resolver.ts:68`** — reads
  `process.env.NEX_POSTGRES_URL`. Used by contact resolution that
  reads the sealed `nex.business_canonical` directory layer.
- **`src/lib/nex/brain/adapters/postgres.ts:75`** — throws
  `"[postgres-brain-store] NEX_POSTGRES_URL not configured"` when
  the brain backend is set to postgres but the URL is absent.
  Used by the agent brain adapter.
- **`src/lib/nex/brain/storage.ts:6-125`** — backend selector:
  `NEX_BRAIN_BACKEND=postgres` AND `NEX_POSTGRES_URL` present ⇒
  postgres brain. Otherwise falls back to in-memory / filesystem
  brain depending on backend selection.

### HQ UI surfaces (display the env name for diagnostics)

- `src/app/nex-native/hq/harvest/page.tsx:1046`
- `src/app/nex-native/hq/harvest/_ops-proof-section.tsx:108`

These are DISPLAY ONLY — they don't make connection attempts, they
just surface "ENV X is set / unset" status to the operator.

### Legacy whatsapp-outbox path (DOES NOT use this env)

- `src/lib/nex/brain/adapters/whatsapp-outbox-db.ts:11` — the
  comment explicitly says it NEVER falls back to `NEX_POSTGRES_URL`
  and reads only `NEX_WHATSAPP_OUTBOX_POSTGRES_URL`. Confirmed by
  dedicated test at `whatsapp-outbox-db.test.ts:36`.

### Tests (integration-only, gated on env)

- `src/lib/nex/brain/adapters/postgres.wc-companion.test.ts:37` —
  only runs when `WC_PG_TEST=1` + `NEX_POSTGRES_URL` set.
- `src/lib/nex/brain/tests/*.test.mjs` — multiple tests default to
  `postgresql://postgres:changeme@localhost:5433/nex_dev` when the
  env is unset. These are integration tests, not launch-blockers.
- `src/lib/nex/brain/world-adapters/accommodation-postgres.test.ts:12`
  — integration only.

## Why localhost:5433 is a problem for production

nexapp CLAUDE.md §8 lines 73-77 states:

> `NEX_POSTGRES_URL` currently points at `localhost:5433` (local
> `nex_dev`). The directory read path uses this env var. Switching
> nexapp to read from Supabase requires either (a) applying the
> directory canonical migrations to Supabase and setting
> `NEX_POSTGRES_URL` to the Supabase pooler, or (b) changing the
> `@/lib/nex/db` layer to use the Supabase REST client.

A Vercel production deployment will NOT have a local Postgres
reachable at `localhost:5433`. Any code path that reads
`NEX_POSTGRES_URL` and makes a connection attempt will throw at
request time. The runtime consumers listed above are:

- `/search` surface routes → contact_resolver → throws
- `/hq/harvest` surface → directory canonical reads → throws
- Agent brain features (if brain backend set to postgres) → throws

If the owner selects `NEX_BRAIN_BACKEND=memory` (the in-code
default fallback), the brain path is NOT affected. The
directory-canonical read path IS still affected because
`contact_resolver.ts` reads the env unconditionally when it is
invoked.

## Migration plan

Three options; owner must pick one before any directory-touching
surface ships to production.

### Option A · Apply directory migrations to Supabase + repoint env

1. Apply the canonical directory migrations (business_canonical,
   business_directory_v, business_evidence, source_registry, etc.)
   to the sealed Supabase project `ijvqdvsvwtwxzcqmoqit`. These
   migrations MUST be approved separately (sealed production rule).
2. Set `NEX_POSTGRES_URL` in Vercel prod to the Supabase pooler:
   `postgres://postgres.<ref>:<password>@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`.
3. Verify connection string format matches `node-postgres`
   expectations at `src/lib/nex/db` (TLS, SSL mode).
4. `/hq/harvest` + `/search` work in prod.

### Option B · Rewrite db layer to use Supabase REST client

1. Refactor `@/lib/nex/db` to call the existing
   `nexSupabaseAdmin` client (from
   `src/lib/nex-native/supabase-admin.ts`) instead of opening a
   raw Postgres connection.
2. Remove `NEX_POSTGRES_URL` from runtime code paths (keep in
   tests for integration coverage).
3. No new env needed — `NEX_SUPABASE_URL` +
   `NEX_SUPABASE_SERVICE_ROLE_KEY` are already set.
4. Higher-effort refactor but removes the env-var dependency
   entirely.

### Option C · Disable /search + /hq/harvest for v1

1. Confirm `/search` is gated by `NEX_SEARCH_ENABLED` (it is · per
   `launch-flags.ts`). As long as prod keeps
   `NEX_SEARCH_ENABLED` unset, `/search` never fires a
   `NEX_POSTGRES_URL` read.
2. Confirm `/hq/harvest` is gated (verify independently) — if not,
   gate it behind a new `NEX_HQ_HARVEST_ENABLED` flag OR require
   HQ admin role at the route level.
3. Leave `NEX_POSTGRES_URL` unset in Vercel prod. Any code path
   that reads it must fail-soft (throw an error caught by the
   route's error boundary, NOT crash the whole deployment).
4. Lowest-effort option for v1 ship. Sealed Scope Reduction
   2026-11-06 keeps Directory in v1 → verify whether Directory
   surfaces depend on contact_resolver or a different read path.

**Recommended for v1:** Option C (gate + leave env unset) if
Directory surfaces don't transitively depend on
`contact_resolver.ts`. Confirm by a separate code-path audit.

## Owner action

1. Pick A, B, or C.
2. If A: authorise the directory-migration batch separately (it's
   a prod DB write, sealed production rule applies).
3. If B: authorise the refactor PR separately.
4. If C: verify `NEX_SEARCH_ENABLED` is OFF in prod AND
   `/hq/harvest` is HQ-admin-only. Confirm Directory consumer-
   surfaces don't hit `NEX_POSTGRES_URL`.
5. Do NOT ship Directory v1 without resolving this.

## Validation command

Confirm which runtime files trigger a connection (no live DB
required):

```bash
cd C:/Users/Victus/nexapp
# Returns ONLY the runtime-connection consumers (excludes tests,
# comments, HQ display-only files)
grep -rn "process\.env\.NEX_POSTGRES_URL" src/ \
  --include="*.ts" \
  --exclude="*.test.*" \
  | grep -v "// " \
  | grep -v "/tests/"
```

After migration (whichever option), run the full test suite:

```bash
npm run typecheck
npm run test
```

## What is NOT done here

- No code changes to `@/lib/nex/db`.
- No migration applied to Supabase.
- No new launch flag added for HQ harvest.
- No `.env.local` modification.
- Owner decides A / B / C.
